import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createInventory, knownFromInventory, mergeKnown, diffInventory, formatUpdateMessage } from './update-inventory.mjs';
import { fetchPublicSnapshot } from './update-public-snapshot.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const json = value => `${JSON.stringify(value, null, 2)}\n`;
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const validTime = value => typeof value === 'string' && Number.isFinite(Date.parse(value));

export function readLedger(directory) {
  const file = path.join(directory, 'ledger.json');
  if (!fs.existsSync(file)) return null;
  let ledger;
  try { ledger = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { throw new Error('The update checkpoint is unreadable. It has been preserved; recover from a backup before continuing.'); }
  if (ledger?.schemaVersion !== 1 || !ledger.baseline?.journeys || !Array.isArray(ledger.drafts) || !Array.isArray(ledger.shared)) {
    throw new Error('Unsupported or invalid update checkpoint. Existing data has been preserved.');
  }
  if (ledger.drafts.some(draft => !draft.id || !draft.inventory?.journeys || typeof draft.message !== 'string' || !validTime(draft.createdAt)) ||
      ledger.shared.some(entry => !validTime(entry?.sharedAt) || !ledger.drafts.some(draft => draft.id === entry.draftId))) {
    throw new Error('Invalid update history. Existing data has been preserved.');
  }
  if (new Set(ledger.drafts.map(draft => draft.id)).size !== ledger.drafts.length ||
      new Set(ledger.shared.map(entry => entry.draftId)).size !== ledger.shared.length) throw new Error('Duplicate update history IDs; existing data has been preserved.');
  knownFromInventory(ledger.baseline);
  for (const draft of ledger.drafts) {
    knownFromInventory(draft.inventory);
    const announcedTrips = draft.diff?.journeys;
    if (!Array.isArray(announcedTrips) || !announcedTrips.length ||
        new Set(announcedTrips.map(trip => trip?.id)).size !== announcedTrips.length ||
        announcedTrips.some(trip => !draft.inventory.journeys.some(item => item.id === trip?.id))) {
      throw new Error('Invalid prepared update trip list; existing data has been preserved.');
    }
    if (draft.inventory.siteUrl !== ledger.baseline.siteUrl || !/^[a-f0-9-]{36}$/.test(draft.id) ||
        draft.fingerprint !== digest({ siteUrl: draft.inventory.siteUrl, journeys: draft.inventory.journeys, message: draft.message })) {
      throw new Error('Invalid prepared update; existing data has been preserved.');
    }
  }
  return ledger;
}

export function knownFromLedger(ledger) {
  let known = knownFromInventory(ledger.baseline);
  for (const { draftId } of ledger.shared) {
    known = mergeKnown(known, ledger.drafts.find(draft => draft.id === draftId).inventory);
  }
  return known;
}

function writeLedger(directory, ledger) {
  const file = path.join(directory, 'ledger.json');
  const temp = path.join(directory, `.ledger-${randomUUID()}.tmp`);
  if (fs.existsSync(file)) {
    const backupDir = path.join(directory, 'backups');
    fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
    const backup = path.join(backupDir, `${randomUUID()}.json`);
    fs.copyFileSync(file, backup, fs.constants.COPYFILE_EXCL);
    fs.chmodSync(backup, 0o600);
  }
  try {
    const fd = fs.openSync(temp, 'wx', 0o600);
    try { fs.writeFileSync(fd, json(ledger)); fs.fsyncSync(fd); }
    finally { fs.closeSync(fd); }
    fs.renameSync(temp, file);
  } finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
}

function withLock(directory, action) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const lock = path.join(directory, '.lock');
  try { fs.mkdirSync(lock); }
  catch (error) {
    if (error.code === 'EEXIST') throw new Error('Another checkpoint operation is active (or was interrupted). Check it before removing the .lock directory.');
    throw error;
  }
  try { return action(); }
  finally { fs.rmdirSync(lock); }
}

export function checkpoint(directory, inventory) {
  return withLock(directory, () => {
    if (readLedger(directory)) throw new Error('A starting checkpoint already exists. Use diff or prepare; existing history will not be reset.');
    // Validate the inventory before persisting a starting baseline.
    knownFromInventory(inventory);
    const ledger = { schemaVersion: 1, channel: 'manual-whatsapp', baseline: inventory, drafts: [], shared: [] };
    writeLedger(directory, ledger);
    return ledger;
  });
}

function requireLedger(directory, inventory) {
  const ledger = readLedger(directory);
  if (!ledger) throw new Error('No starting checkpoint yet. Run updates checkpoint first.');
  if (inventory && ledger.baseline.siteUrl !== inventory.siteUrl) throw new Error('The public site differs from this checkpoint. Use a separate state directory.');
  return ledger;
}

function selectInventory(inventory, { tripId, allTrips = false } = {}) {
  knownFromInventory(inventory);
  if (typeof allTrips !== 'boolean' || (tripId !== undefined && (typeof tripId !== 'string' || !tripId))) throw new Error('Invalid trip selection. Use --trip ID or --all.');
  if (tripId !== undefined && allTrips) throw new Error('Choose --trip or --all, not both.');
  if (allTrips) return structuredClone(inventory);
  const selected = tripId === undefined && inventory.journeys.length === 1 ? inventory.journeys[0] : inventory.journeys.find(trip => trip.id === tripId);
  if (!selected) {
    const choices = inventory.journeys.map(trip => `${trip.id} (${trip.title})`).join(', ');
    throw new Error(`${tripId === undefined ? 'Choose a trip with --trip ID, or explicitly use --all for a combined update.' : `Unknown published trip: ${tripId}.`} Available trips: ${choices || 'none'}`);
  }
  // Freeze only the selected trip: acknowledging it must never consume another
  // audience's additions, even when both were present in the same public read.
  return structuredClone({ ...inventory, journeys: [selected] });
}

export function calculateUpdate(directory, inventory, selection = {}) {
  const ledger = requireLedger(directory, inventory);
  inventory = selectInventory(inventory, selection);
  const diff = diffInventory(inventory, knownFromLedger(ledger));
  return { diff, message: formatUpdateMessage(diff) };
}

export function prepareUpdate(directory, inventory, now = new Date().toISOString(), selection = {}) {
  if (!validTime(now)) throw new Error('Prepared update time must be a valid timestamp.');
  return withLock(directory, () => {
    const ledger = requireLedger(directory, inventory);
    inventory = selectInventory(inventory, selection);
    const diff = diffInventory(inventory, knownFromLedger(ledger));
    const message = formatUpdateMessage(diff);
    if (!diff.hasChanges) return { diff, message, draft: null };
    const fingerprint = digest({ siteUrl: inventory.siteUrl, journeys: inventory.journeys, message });
    let draft = ledger.drafts.find(item => item.fingerprint === fingerprint && !ledger.shared.some(entry => entry.draftId === item.id));
    if (!draft) {
      draft = { id: randomUUID(), createdAt: now, fingerprint, inventory, diff, message };
      ledger.drafts.push(draft);
      writeLedger(directory, ledger);
    }
    // This file is an export, not the authoritative acknowledged state.
    const messageFile = path.join(directory, `${draft.id}.txt`);
    fs.writeFileSync(messageFile, `${draft.message}\n`, { mode: 0o600 });
    return { diff, message, draft, messageFile };
  });
}

export function markShared(directory, draftId, now = new Date().toISOString()) {
  if (!validTime(now)) throw new Error('Shared update time must be a valid timestamp.');
  return withLock(directory, () => {
    const ledger = requireLedger(directory);
    const draft = ledger.drafts.find(item => item.id === draftId);
    if (!draft) throw new Error('Unknown prepared update ID; no checkpoint changed.');
    const existing = ledger.shared.find(entry => entry.draftId === draftId);
    if (existing) return { draft, sharedAt: existing.sharedAt, alreadyShared: true };
    ledger.shared.push({ draftId, sharedAt: now });
    writeLedger(directory, ledger);
    return { draft, sharedAt: now, alreadyShared: false };
  });
}

const help = `Track public additions and prepare text for manual WhatsApp broadcasts.

  npm run updates -- checkpoint       Start tracking the current live site once
  npm run updates -- diff --trip ID   Print this trip's additions without changing history
  npm run updates -- prepare --trip ID  Save this trip's message and frozen update ID
  npm run updates -- mark-shared ID   Acknowledge that exact update after sharing it
  npm run updates -- status           Show the local checkpoint/history

Options: --state-dir PATH (default build/update-announcements/whatsapp)
         --site-url URL (default content/site.json; checkpoint/diff/prepare only)
         --trip ID (diff/prepare/status; use status to find tracked trip IDs)
         --all (diff/prepare; deliberately combine all trips)
         --json (structured output)

Nothing sends a message. Prepare/copy never marks an update shared. The initial
checkpoint treats today's public content as already known, not as a sent message.
Each trip's shared history is independent. With multiple trips, select one with
--trip; combined updates require --all. Sharing a trip leaves other trips pending.
State and backups stay local; keep the state directory when moving checkouts.`;

export async function runCli(args, { root = ROOT, capture = fetchPublicSnapshot, output = console.log } = {}) {
  if (!args.length || args.includes('--help')) { output(help); return; }
  const command = args.shift();
  let directory = path.join(root, 'build/update-announcements/whatsapp');
  let siteUrl;
  let asJson = false, draftId, tripId, allTrips = false;
  while (args.length) {
    const arg = args.shift();
    if (arg === '--json') asJson = true;
    else if (arg === '--all') allTrips = true;
    else if (arg === '--state-dir' || arg === '--site-url' || arg === '--trip') {
      const value = args.shift();
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
      if (arg === '--state-dir') directory = path.resolve(value);
      else if (arg === '--site-url') siteUrl = value;
      else {
        if (tripId !== undefined) throw new Error('Choose only one --trip.');
        tripId = value;
      }
    } else if (command === 'mark-shared' && !draftId && !arg.startsWith('--')) draftId = arg;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!['checkpoint', 'diff', 'prepare', 'mark-shared', 'status'].includes(command)) throw new Error(`Unknown command: ${command}`);
  if (tripId !== undefined && allTrips) throw new Error('Choose --trip or --all, not both.');
  if (tripId !== undefined && !['diff', 'prepare', 'status'].includes(command)) throw new Error('--trip is supported for diff, prepare and status.');
  if (allTrips && !['diff', 'prepare'].includes(command)) throw new Error('--all is supported for diff and prepare.');
  if (command === 'mark-shared') {
    if (!draftId) throw new Error('Provide the prepared update ID after mark-shared.');
    const result = markShared(directory, draftId);
    output(asJson ? json(result) : `${result.alreadyShared ? 'Already recorded' : 'Recorded as manually shared'}: ${draftId}`);
    return result;
  }
  if (command === 'status') {
    const ledger = requireLedger(directory);
    const known = knownFromLedger(ledger);
    const tracked = new Map(ledger.baseline.journeys.map(trip => [trip.id, trip]));
    for (const draft of ledger.drafts) for (const trip of draft.inventory.journeys) tracked.set(trip.id, trip);
    if (tripId !== undefined && !tracked.has(tripId)) throw new Error(`Unknown tracked trip: ${tripId}. Use diff --all to discover newly published trips.`);
    const selected = [...tracked.values()].filter(trip => tripId === undefined || trip.id === tripId);
    const baseline = ledger.baseline.journeys.filter(trip => tripId === undefined || trip.id === tripId);
    const drafts = ledger.drafts.filter(draft => tripId === undefined || draft.diff.journeys.some(trip => trip.id === tripId));
    const result = { directory, siteUrl: ledger.baseline.siteUrl, startedAt: ledger.baseline.capturedAt,
      baselineTrips: baseline.length, baselinePhotos: baseline.reduce((n,j) => n + j.photos.length, 0),
      trips: selected.map(trip => ({ id: trip.id, title: trip.title, knownPhotoCount: known.journeys[trip.id]?.photoIds?.length || 0,
        lastSharedAt: ledger.shared.filter(entry => ledger.drafts.find(draft => draft.id === entry.draftId).diff.journeys.some(item => item.id === trip.id))
          .map(entry => entry.sharedAt).sort((a,b) => Date.parse(b)-Date.parse(a))[0] || null })),
      drafts: drafts.map(({id,createdAt,diff}) => ({id,createdAt,tripIds:diff.journeys.map(trip => trip.id),sharedAt:ledger.shared.find(entry => entry.draftId === id)?.sharedAt || null})) };
    output(json(result)); return result;
  }
  // Reject an accidental reset or missing baseline before any network requests.
  if (command === 'checkpoint' && readLedger(directory)) throw new Error('A starting checkpoint already exists. Use diff or prepare.');
  if (command !== 'checkpoint') requireLedger(directory);
  siteUrl ??= JSON.parse(fs.readFileSync(path.join(root, 'content/site.json'), 'utf8')).url;
  const inventory = createInventory(await capture(siteUrl));
  if (command === 'checkpoint') {
    const ledger = checkpoint(directory, inventory);
    const result = { directory, capturedAt: inventory.capturedAt, trips: inventory.journeys.length,
      photos: inventory.journeys.reduce((n,j) => n + j.photos.length, 0), ledger: path.join(directory, 'ledger.json') };
    output(asJson ? json(result) : `Checkpoint saved: ${result.trips} trips, ${result.photos} photos. Future additions will appear in the next update.\n${result.ledger}`);
    return ledger;
  }
  const selection = {tripId, allTrips};
  const result = command === 'prepare' ? prepareUpdate(directory, inventory, undefined, selection) : calculateUpdate(directory, inventory, selection);
  output(asJson ? json(result) : result.message);
  if (!asJson && result.draft) output(`\nMessage saved: ${result.messageFile}\nUpdate ID: ${result.draft.id}\nAfter you share it, tell the agent to mark this update shared. Until then it stays pending.`);
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
}
