import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { checkpoint, readLedger, calculateUpdate, prepareUpdate, markShared, runCli } from '../scripts/update-announcements.mjs';
import { knownFromInventory, diffInventory, formatUpdateMessage } from '../scripts/update-inventory.mjs';

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
function multiTripInventory(entries) {
  return { ...inventory([]), journeys: Object.entries(entries).map(([trip, ids]) => ({
    ...inventory(ids, { trip }).journeys[0], title: `Journey ${trip}`
  })) };
}
function publicTrips(entries) {
  const snapshot = multiTripInventory(entries);
  return { siteUrl: snapshot.siteUrl, capturedAt: snapshot.capturedAt, source: snapshot.source,
    data: { journeys: snapshot.journeys.map(trip => ({ id: trip.id, title: trip.title, slug: `${trip.id}.html`, kind: 'real', published: true,
      places: [{ id: 'river', name: 'River City' }], days: [{ id: 'river-day', title: 'River City', destinationId: 'river' }] })) },
    photos: Object.fromEntries(snapshot.journeys.map(trip => [trip.id, trip.photos.map(photo => ({ id: photo.id, dayId: photo.eventId }))])),
    overrides: { photos: {}, days: {} } };
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
  const prepared = await runCli(['prepare','--trip','fresh','--state-dir',state], options);
  assert.match(prepared.message, /Fresh trip/);
  assert.match(prepared.message, /River City/);
  assert.match(prepared.message, /https:\/\/example.test\/travels\/fresh.html/);
  assert.equal(readLedger(state).shared.length, 0);
  await assert.rejects(() => runCli(['checkpoint','--state-dir',state], options), /already exists/);
  await assert.rejects(() => runCli(['mark-shared','--state-dir',state], options), /prepared update ID/);
  await runCli(['mark-shared',prepared.draft.id,'--state-dir',state], {...options,capture:()=>assert.fail('mark-shared must not fetch new content')});
  assert.equal((await runCli(['diff','--trip','fresh','--state-dir',state], options)).diff.hasChanges, false);
});

test('trip-scoped preparation and sharing leave the other audience and later additions pending', t => {
  const dir = fixture(t), baseline = multiTripInventory({ 'trip-a': ['old'], 'trip-b': ['old'] });
  checkpoint(dir, baseline);
  const originalBaseline = structuredClone(readLedger(dir).baseline);
  const pending = multiTripInventory({ 'trip-a': ['old', 'same-new-id'], 'trip-b': ['old', 'same-new-id'] });
  const a = calculateUpdate(dir, pending, { tripId: 'trip-a' });
  assert.deepEqual(a.diff.journeys.map(trip => trip.id), ['trip-a']);
  assert.equal(a.diff.newPhotoCount, 1);
  assert.match(a.message, /Journey trip-a/);
  assert.doesNotMatch(a.message, /trip-b/);
  const preparedA = prepareUpdate(dir, pending, '2026-10-16T13:00:00.000Z', { tripId: 'trip-a' });
  assert.deepEqual(preparedA.draft.inventory.journeys.map(trip => trip.id), ['trip-a']);
  assert.doesNotMatch(JSON.stringify(preparedA.draft), /trip-b/, 'The frozen update must not consume another audience’s content');
  const laterB = multiTripInventory({ 'trip-a': ['old', 'same-new-id'], 'trip-b': ['old', 'same-new-id', 'b-later'] });
  assert.equal(prepareUpdate(dir, laterB, '2026-10-16T13:10:00.000Z', { tripId: 'trip-a' }).draft.id, preparedA.draft.id,
    'Changes to another trip do not create a different A message or snapshot');
  assert.equal(calculateUpdate(dir, laterB, { tripId: 'trip-a' }).diff.newPhotoCount, 1, 'Preparing does not acknowledge A');
  markShared(dir, preparedA.draft.id, '2026-10-16T14:00:00.000Z');
  const after = multiTripInventory({ 'trip-a': ['old', 'same-new-id', 'a-later'], 'trip-b': ['old', 'same-new-id', 'b-later'] });
  const pendingA = calculateUpdate(dir, after, { tripId: 'trip-a' }), pendingB = calculateUpdate(dir, after, { tripId: 'trip-b' });
  assert.deepEqual(pendingA.diff.journeys[0].photoIds, ['a-later']);
  assert.deepEqual(pendingB.diff.journeys[0].photoIds, ['same-new-id', 'b-later'], 'Equal photo IDs in different trips retain separate known membership');
  assert.doesNotMatch(pendingB.message, /trip-a/);
  assert.equal(readLedger(dir).schemaVersion, 1);
  assert.deepEqual(readLedger(dir).baseline, originalBaseline, 'Trip selection never migrates or resets the original full baseline');
});

test('a trip first published after the full baseline can be shared independently', t => {
  const dir = fixture(t), baseline = multiTripInventory({ 'trip-a': ['old-a'], 'trip-b': ['old-b'] });
  checkpoint(dir, baseline);
  const current = multiTripInventory({ 'trip-a': ['old-a', 'a-new'], 'trip-b': ['old-b', 'b-new'], 'trip-c': [] });
  const c = prepareUpdate(dir, current, '2026-10-16T13:00:00.000Z', { tripId: 'trip-c' });
  assert.equal(c.diff.newTripCount, 1);
  assert.equal(c.diff.newPhotoCount, 0);
  assert.equal(c.diff.locationCount, 0);
  assert.match(c.message, /New trip: Journey trip-c/);
  assert.doesNotMatch(c.message, /trip-a|trip-b/);
  markShared(dir, c.draft.id);
  assert.equal(calculateUpdate(dir, current, { tripId: 'trip-c' }).diff.hasChanges, false);
  const remaining = calculateUpdate(dir, current, { allTrips: true }).diff;
  assert.equal(remaining.newTripCount, 0);
  assert.equal(remaining.newPhotoCount, 2);
  assert.deepEqual(remaining.journeys.map(trip => trip.id), ['trip-a', 'trip-b']);
  assert.deepEqual(readLedger(dir).baseline, baseline);
});

test('existing schema-1 combined drafts and acknowledgments remain readable and retain their union', t => {
  const dir = fixture(t), baseline = multiTripInventory({ 'trip-a': ['old-a'], 'trip-b': ['old-b'] });
  // This is the original on-disk format: no trip-selection field or migration marker.
  const combined = multiTripInventory({ 'trip-a': ['shared-a'], 'trip-b': ['shared-b'] });
  const diff = diffInventory(combined, knownFromInventory(baseline)), message = formatUpdateMessage(diff);
  const draftId = '11111111-1111-4111-8111-111111111111';
  const draft = { id: draftId, createdAt: '2026-10-16T13:00:00.000Z',
    fingerprint: createHash('sha256').update(JSON.stringify({ siteUrl: combined.siteUrl, journeys: combined.journeys, message })).digest('hex'),
    inventory: combined, diff, message };
  const ledger = { schemaVersion: 1, channel: 'manual-whatsapp', baseline, drafts: [draft], shared: [{ draftId, sharedAt: '2026-10-16T14:00:00.000Z' }] };
  const file = path.join(dir, 'ledger.json'), original = JSON.stringify(ledger);
  fs.writeFileSync(file, original);
  assert.deepEqual(readLedger(dir), ledger);
  const current = multiTripInventory({ 'trip-a': ['old-a', 'shared-a', 'new-a'], 'trip-b': ['old-b', 'shared-b', 'new-b'] });
  assert.deepEqual(calculateUpdate(dir, current, { tripId: 'trip-a' }).diff.journeys[0].photoIds, ['new-a']);
  assert.deepEqual(calculateUpdate(dir, current, { tripId: 'trip-b' }).diff.journeys[0].photoIds, ['new-b']);
  assert.equal(fs.readFileSync(file, 'utf8'), original, 'Reading and scoping legacy history performs no rewrite');
  const nextA = prepareUpdate(dir, current, '2026-10-16T15:00:00.000Z', { tripId: 'trip-a' });
  markShared(dir, nextA.draft.id);
  assert.equal(calculateUpdate(dir, current, { tripId: 'trip-a' }).diff.hasChanges, false);
  assert.deepEqual(calculateUpdate(dir, current, { tripId: 'trip-b' }).diff.journeys[0].photoIds, ['new-b']);
  const saved = readLedger(dir);
  assert.equal(saved.schemaVersion, 1);
  assert.deepEqual(saved.baseline, baseline);
  assert.deepEqual(saved.drafts[0], draft);
  assert.deepEqual(saved.shared[0], ledger.shared[0]);
});

test('ambiguous, unknown or conflicting trip selection fails without changing ledger or prepared exports', async t => {
  const dir = fixture(t), initial = multiTripInventory({ 'trip-a': ['old-a'], 'trip-b': ['old-b'] });
  checkpoint(dir, initial);
  const file = path.join(dir, 'ledger.json'), original = fs.readFileSync(file, 'utf8'), files = fs.readdirSync(dir);
  const current = multiTripInventory({ 'trip-a': ['old-a', 'new-a'], 'trip-b': ['old-b', 'new-b'] });
  const assertUntouched = () => {
    assert.equal(fs.readFileSync(file, 'utf8'), original);
    assert.deepEqual(fs.readdirSync(dir), files);
  };
  for (const scope of [undefined, { tripId: 'missing-trip' }, { tripId: 'trip-a', allTrips: true }]) {
    assert.throws(() => calculateUpdate(dir, current, scope), /trip|choose|select|all/i);
    assert.throws(() => prepareUpdate(dir, current, '2026-10-16T13:00:00.000Z', scope), /trip|choose|select|all/i);
    assertUntouched();
  }
  assert.throws(() => calculateUpdate(dir, multiTripInventory({ 'trip-a': ['old-a'] }), { tripId: 'trip-b' }), /trip/i,
    'A historical trip cannot be selected if it is absent from the current published inventory');
  const options = { root: path.join(dir, 'no-config'), capture: async () => publicTrips({ 'trip-a': ['new-a'], 'trip-b': ['new-b'] }), output: () => {} };
  for (const args of [
    ['prepare'], ['diff'], ['prepare', '--trip'], ['diff', '--trip', 'missing-trip'],
    ['prepare', '--trip', 'trip-a', '--all'], ['diff', '--all', '--trip', 'trip-b'], ['status', '--all']
  ]) {
    await assert.rejects(() => runCli([...args, '--state-dir', dir, '--site-url', initial.siteUrl], options), /trip|choose|select|all|value/i);
    assertUntouched();
  }
});

test('CLI --all deliberately prepares a combined message while --trip keeps messages and status separate', async t => {
  const dir = fixture(t), initial = multiTripInventory({ 'trip-a': ['old-a'], 'trip-b': ['old-b'] });
  checkpoint(dir, initial);
  const capture = async () => publicTrips({ 'trip-a': ['old-a', 'new-a'], 'trip-b': ['old-b', 'new-b'] });
  const options = { root: path.join(dir, 'no-config'), capture, output: () => {} };
  const flags = ['--state-dir', dir, '--site-url', initial.siteUrl];
  const all = await runCli(['prepare', '--all', ...flags], options);
  assert.equal(all.diff.newPhotoCount, 2);
  assert.deepEqual(all.draft.inventory.journeys.map(trip => trip.id), ['trip-a', 'trip-b']);
  assert.match(all.message, /Journey trip-a/);
  assert.match(all.message, /Journey trip-b/);
  const a = await runCli(['prepare', '--trip', 'trip-a', ...flags], options);
  const b = await runCli(['prepare', '--trip', 'trip-b', ...flags], options);
  assert.notEqual(a.draft.id, b.draft.id);
  assert.notEqual(a.draft.id, all.draft.id);
  markShared(dir, a.draft.id, '2026-10-16T14:00:00.000Z');
  const noNetwork = { ...options, capture: () => assert.fail('status reads local history without a public fetch') };
  const status = await runCli(['status', '--state-dir', dir], noNetwork);
  assert.deepEqual(status.trips.map(({ id, title, knownPhotoCount, lastSharedAt }) => ({ id, title, knownPhotoCount, lastSharedAt })), [
    { id: 'trip-a', title: 'Journey trip-a', knownPhotoCount: 2, lastSharedAt: '2026-10-16T14:00:00.000Z' },
    { id: 'trip-b', title: 'Journey trip-b', knownPhotoCount: 1, lastSharedAt: null }
  ]);
  const filtered = await runCli(['status', '--trip', 'trip-b', '--state-dir', dir], noNetwork);
  assert.deepEqual(filtered.trips.map(trip => trip.id), ['trip-b']);
  assert.deepEqual(new Set(filtered.drafts.map(draft => draft.id)), new Set([all.draft.id, b.draft.id]));
  assert.ok(filtered.drafts.every(draft => draft.tripIds.includes('trip-b')));
  assert.equal((await runCli(['diff', '--trip', 'trip-a', ...flags], options)).diff.hasChanges, false);
  assert.equal((await runCli(['diff', '--trip', 'trip-b', ...flags], options)).diff.newPhotoCount, 1);
});

test('combined snapshots only attribute draft history and sharing to trips present in the message', async t => {
  for (const legacy of [false, true]) {
    const dir = fixture(t), baseline = multiTripInventory({ 'trip-a': ['old-a'], 'trip-b': ['old-b'] });
    const current = multiTripInventory({ 'trip-a': ['old-a', 'new-a'], 'trip-b': ['old-b'] });
    let draftId;
    if (legacy) {
      // Original schema-1 combined drafts froze every trip even when only A had additions.
      const diff = diffInventory(current, knownFromInventory(baseline)), message = formatUpdateMessage(diff);
      draftId = '22222222-2222-4222-8222-222222222222';
      const draft = { id: draftId, createdAt: '2026-10-16T13:00:00.000Z',
        fingerprint: createHash('sha256').update(JSON.stringify({ siteUrl: current.siteUrl, journeys: current.journeys, message })).digest('hex'),
        inventory: current, diff, message };
      fs.writeFileSync(path.join(dir, 'ledger.json'), JSON.stringify({ schemaVersion: 1, channel: 'manual-whatsapp', baseline, drafts: [draft], shared: [] }));
    } else {
      checkpoint(dir, baseline);
      const prepared = prepareUpdate(dir, current, '2026-10-16T13:00:00.000Z', { allTrips: true });
      draftId = prepared.draft.id;
      assert.deepEqual(prepared.draft.inventory.journeys.map(trip => trip.id), ['trip-a', 'trip-b']);
      assert.deepEqual(prepared.diff.journeys.map(trip => trip.id), ['trip-a']);
      assert.doesNotMatch(prepared.message, /trip-b/);
    }
    const options = { root: path.join(dir, 'no-config'), output: () => {}, capture: () => assert.fail('status must not fetch') };
    const beforeB = await runCli(['status', '--trip', 'trip-b', '--state-dir', dir], options);
    assert.deepEqual(beforeB.drafts, [], `${legacy ? 'legacy' : 'new'}: B must not list a pending A-only message`);
    markShared(dir, draftId, '2026-10-16T14:00:00.000Z');
    const status = await runCli(['status', '--state-dir', dir], options);
    assert.deepEqual(status.drafts[0].tripIds, ['trip-a']);
    assert.equal(status.trips.find(trip => trip.id === 'trip-a').lastSharedAt, '2026-10-16T14:00:00.000Z');
    assert.equal(status.trips.find(trip => trip.id === 'trip-b').lastSharedAt, null, 'Being frozen in a combined snapshot does not mean B was announced');
    const sharedB = await runCli(['status', '--trip', 'trip-b', '--state-dir', dir], options);
    assert.deepEqual(sharedB.drafts, []);
    assert.equal(sharedB.trips[0].knownPhotoCount, 1);
    const later = multiTripInventory({ 'trip-a': ['old-a', 'new-a'], 'trip-b': ['old-b', 'later-b'] });
    assert.deepEqual(calculateUpdate(dir, later, { tripId: 'trip-b' }).diff.journeys[0].photoIds, ['later-b']);
  }
});

test('missing, empty, unknown or duplicate frozen diff trip IDs fail closed and preserve history', async t => {
  const dir = fixture(t);
  checkpoint(dir, multiTripInventory({ 'trip-a': ['old-a'], 'trip-b': ['old-b'] }));
  const current = multiTripInventory({ 'trip-a': ['old-a', 'new-a'], 'trip-b': ['old-b'] });
  const prepared = prepareUpdate(dir, current, '2026-10-16T13:00:00.000Z', { allTrips: true });
  const file = path.join(dir, 'ledger.json'), valid = readLedger(dir);
  const corruptions = [
    draft => { delete draft.diff; },
    draft => { delete draft.diff.journeys; },
    draft => { draft.diff.journeys = []; },
    draft => { draft.diff.journeys[0].id = 'unknown-trip'; },
    draft => { delete draft.diff.journeys[0].id; },
    draft => { draft.diff.journeys.push(structuredClone(draft.diff.journeys[0])); }
  ];
  const options = { root: path.join(dir, 'no-config'), output: () => {}, capture: () => assert.fail('status must not fetch') };
  for (const corrupt of corruptions) {
    const invalid = structuredClone(valid); corrupt(invalid.drafts[0]);
    const serialized = JSON.stringify(invalid);
    fs.writeFileSync(file, serialized);
    assert.throws(() => readLedger(dir), /invalid|prepared|history/i);
    assert.throws(() => markShared(dir, prepared.draft.id), /invalid|prepared|history/i);
    await assert.rejects(() => runCli(['status', '--state-dir', dir], options), /invalid|prepared|history/i);
    assert.equal(fs.readFileSync(file, 'utf8'), serialized);
  }
});
