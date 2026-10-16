import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkpoint, readLedger, calculateUpdate, prepareUpdate, markShared, runCli } from '../scripts/update-announcements.mjs';

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-update-ledger-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}
function inventory(ids, { siteUrl = 'https://example.test/travels/', trip = 'independent-city-trip' } = {}) {
  return { schemaVersion: 1, capturedAt: '2026-10-16T12:00:00.000Z', siteUrl, source: { kind: 'public-metadata' },
    journeys: [{ id: trip, title: 'Independent cities', url: `${siteUrl}${trip}.html`,
      locations: ids.length ? [{ id: 'place:river', label: 'River City', eventIds: ['river-day'] }] : [],
      photos: ids.map(id => ({ id, locationId: 'place:river', eventId: 'river-day' })) }] };
}

test('starting checkpoint is durable, counts existing photos as known, and refuses replacement', t => {
  const dir = fixture(t);
  checkpoint(dir, inventory(['old']));
  assert.equal(readLedger(dir).baseline.journeys[0].photos[0].id, 'old');
  assert.equal(calculateUpdate(dir, inventory(['old'])).diff.hasChanges, false);
  assert.throws(() => checkpoint(dir, inventory(['other'])), /already exists/);
  assert.equal(readLedger(dir).shared.length, 0, 'starting baseline does not claim a message was shared');
});

test('diff and repeated prepare do not acknowledge content; mark-shared consumes only the frozen update', t => {
  const dir = fixture(t);
  checkpoint(dir, inventory(['old']));
  const before = fs.readFileSync(path.join(dir, 'ledger.json'), 'utf8');
  assert.equal(calculateUpdate(dir, inventory(['old', 'a'])).diff.newPhotoCount, 1);
  assert.equal(fs.readFileSync(path.join(dir, 'ledger.json'), 'utf8'), before);
  const first = prepareUpdate(dir, inventory(['old', 'a']));
  assert.equal(fs.readFileSync(first.messageFile, 'utf8').trim(), first.message);
  assert.equal(prepareUpdate(dir, inventory(['old', 'a'])).draft.id, first.draft.id);
  assert.equal(readLedger(dir).drafts.length, 1);
  assert.equal(calculateUpdate(dir, inventory(['old', 'a'])).diff.newPhotoCount, 1);
  markShared(dir, first.draft.id);
  assert.equal(markShared(dir, first.draft.id).alreadyShared, true);
  assert.equal(readLedger(dir).shared.length, 1);
  assert.equal(calculateUpdate(dir, inventory(['old', 'a', 'later'])).diff.newPhotoCount, 1);
  assert.match(calculateUpdate(dir, inventory(['old', 'a', 'later'])).message, /River City/);
});

test('acknowledgment union survives removing/restoring photos and sharing older drafts out of order', t => {
  const dir = fixture(t);
  checkpoint(dir, inventory(['old']));
  const a = prepareUpdate(dir, inventory(['a']));
  const b = prepareUpdate(dir, inventory(['b']));
  markShared(dir, b.draft.id);
  markShared(dir, a.draft.id);
  assert.equal(calculateUpdate(dir, inventory(['old', 'a', 'b'])).diff.hasChanges, false);
  assert.equal(prepareUpdate(dir, inventory(['old', 'a', 'b'])).draft, null);
});

test('unknown acknowledgments, mismatched sites, locks and corrupt files preserve the checkpoint', t => {
  const dir = fixture(t);
  checkpoint(dir, inventory(['old']));
  const file = path.join(dir, 'ledger.json'), before = fs.readFileSync(file, 'utf8');
  assert.throws(() => markShared(dir, '../not-a-draft'), /Unknown/);
  assert.throws(() => prepareUpdate(dir, inventory(['new'], {siteUrl:'https://different.test/'})), /site differs/);
  fs.mkdirSync(path.join(dir, '.lock'));
  assert.throws(() => prepareUpdate(dir, inventory(['new'])), /operation is active/);
  fs.rmdirSync(path.join(dir, '.lock'));
  assert.equal(fs.readFileSync(file, 'utf8'), before);
  fs.writeFileSync(file, '{unfinished');
  assert.throws(() => prepareUpdate(dir, inventory(['new'])), /unreadable/);
  assert.equal(fs.readFileSync(file, 'utf8'), '{unfinished');
});

test('each acknowledged state has a recovery backup and prepare does not erase it', t => {
  const dir = fixture(t);
  checkpoint(dir, inventory(['old']));
  const original = fs.readFileSync(path.join(dir, 'ledger.json'), 'utf8');
  const prepared = prepareUpdate(dir, inventory(['new']));
  markShared(dir, prepared.draft.id);
  const backups = fs.readdirSync(path.join(dir, 'backups')).map(name => fs.readFileSync(path.join(dir, 'backups', name), 'utf8'));
  assert.equal(backups.length, 2);
  assert.ok(backups.includes(original));
});

test('structurally corrupt inventories and modified prepared message bodies fail closed', t => {
  const dir = fixture(t);
  checkpoint(dir, inventory(['old']));
  prepareUpdate(dir, inventory(['old', 'new']));
  const file = path.join(dir, 'ledger.json'), original = fs.readFileSync(file, 'utf8');
  const edited = JSON.parse(original);
  edited.drafts[0].message = 'different contents';
  fs.writeFileSync(file, JSON.stringify(edited));
  assert.throws(() => readLedger(dir), /Invalid prepared update/);
  const corrupted = JSON.parse(original);
  corrupted.baseline.journeys[0].photos[0].locationId = 'place:missing';
  fs.writeFileSync(file, JSON.stringify(corrupted));
  assert.throws(() => readLedger(dir), /missing inventory/);
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).baseline.journeys[0].photos[0].locationId, 'place:missing');
});

test('incomplete shared receipts cannot consume pending content and local history works without site config', async t => {
  const dir = fixture(t);
  checkpoint(dir, inventory(['old']));
  const prepared = prepareUpdate(dir, inventory(['old', 'new']));
  assert.throws(() => markShared(dir, prepared.draft.id, 'invalid-time'), /valid timestamp/);
  const file = path.join(dir, 'ledger.json'), original = fs.readFileSync(file, 'utf8');
  const malformed = JSON.parse(original);
  malformed.shared.push({ draftId: prepared.draft.id });
  const malformedText = JSON.stringify(malformed);
  fs.writeFileSync(file, malformedText);
  assert.throws(() => calculateUpdate(dir, inventory(['old', 'new'])), /Invalid update history/);
  assert.equal(fs.readFileSync(file, 'utf8'), malformedText);
  fs.writeFileSync(file, original);
  const options = { root: path.join(dir, 'missing-config'), output: () => {} };
  const status = await runCli(['status', '--state-dir', dir], options);
  assert.equal(status.drafts[0].sharedAt, null);
  await runCli(['mark-shared', prepared.draft.id, '--state-dir', dir], options);
  assert.equal(calculateUpdate(dir, inventory(['old', 'new'])).diff.hasChanges, false);
});

test('CLI starts from captured public metadata, prints a useful message and never sends or auto-acknowledges', async t => {
  const dir = fixture(t), root = path.join(dir, 'repo'), state = path.join(dir, 'state');
  fs.mkdirSync(path.join(root, 'content'), { recursive: true });
  fs.writeFileSync(path.join(root, 'content/site.json'), JSON.stringify({ url:'https://example.test/travels/' }));
  const base = { siteUrl:'https://example.test/travels/', capturedAt:'2026-10-16T12:00:00Z',source:{kind:'public-metadata'},
    data:{journeys:[{id:'fresh',kind:'real',published:true,title:'Fresh trip',slug:'fresh.html',places:[{id:'river',name:'River City'}],days:[{id:'river-day',title:'River City',destinationId:'river'}]}]},
    photos:{fresh:[{id:'old',dayId:'river-day'}]},overrides:{photos:{},days:{}} };
  const lines = [], options = { root, capture: async () => structuredClone(base), output: text => lines.push(text) };
  await runCli(['checkpoint','--state-dir',state], options);
  base.photos.fresh.push({id:'new',dayId:'river-day'});
  const prepared = await runCli(['prepare','--state-dir',state], options);
  assert.match(prepared.message, /Fresh trip/);
  assert.match(prepared.message, /River City/);
  assert.match(prepared.message, /https:\/\/example.test\/travels\/fresh.html/);
  assert.equal(readLedger(state).shared.length, 0);
  await assert.rejects(() => runCli(['checkpoint','--state-dir',state], options), /already exists/);
  await assert.rejects(() => runCli(['mark-shared','--state-dir',state], options), /prepared update ID/);
  await runCli(['mark-shared',prepared.draft.id,'--state-dir',state], {...options,capture:()=>assert.fail('mark-shared must not fetch new content')});
  assert.equal((await runCli(['diff','--state-dir',state], options)).diff.hasChanges, false);
});
