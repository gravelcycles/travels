import fs from 'node:fs';
import path from 'node:path';
import { journeyRevision } from './journey-planner.mjs';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const keyed = value => Array.isArray(value) && value.every(item => object(item) && typeof item.id === 'string') && new Set(value.map(item => item.id)).size === value.length;
const copy = value => value === undefined ? undefined : structuredClone(value);

// Keep the exact version a tab read, across reloads and server restarts. Hashes
// are checked on read; a missing old baseline requires explicit field choices.
export function rememberRevision(root, value) {
  const revision = journeyRevision(value);
  const directory = path.join(root, 'build/studio-revisions');
  fs.mkdirSync(directory, { recursive: true });
  const filename = path.join(directory, `${revision}.json`);
  if (!fs.existsSync(filename)) {
    fs.writeFileSync(`${filename}.tmp`, JSON.stringify(value));
    fs.renameSync(`${filename}.tmp`, filename);
  }
  return revision;
}
export function readRevision(root, revision) {
  if (!/^[a-f0-9]{64}$/.test(revision || '')) return undefined;
  try {
    const value = JSON.parse(fs.readFileSync(path.join(root, 'build/studio-revisions', `${revision}.json`), 'utf8'));
    return journeyRevision(value) === revision ? value : undefined;
  } catch { return undefined; }
}

export function reconcile(base, draft, saved, { choices = {}, prefix = [] } = {}) {
  const conflicts = [];
  function merge(before, mine, disk, keys) {
    if (equal(mine, disk)) return copy(disk);
    if (base !== undefined && equal(mine, before)) return copy(disk);
    if (base !== undefined && equal(disk, before)) return copy(mine);
    if (object(mine) && object(disk) && (before === undefined || object(before))) {
      const result = {};
      for (const key of new Set([...Object.keys(before || {}), ...Object.keys(mine), ...Object.keys(disk)])) {
        const value = merge(before?.[key], mine[key], disk[key], [...keys, key]);
        if (value !== undefined) Object.defineProperty(result, key, { value, enumerable: true, writable: true, configurable: true });
      }
      return result;
    }
    if (keyed(before) && keyed(mine) && keyed(disk)) {
      const order = merge(before.map(x => x.id), mine.map(x => x.id), disk.map(x => x.id), [...keys, 'order']);
      const items = new Map();
      for (const id of new Set([...before, ...mine, ...disk].map(x => x.id))) {
        const item = merge(before.find(x => x.id === id), mine.find(x => x.id === id), disk.find(x => x.id === id), [...keys, id]);
        if (item !== undefined) items.set(id, item);
      }
      // An edited item chosen over a concurrent deletion must remain present.
      return [...new Set([...order, ...items.keys()])].filter(id => items.has(id)).map(id => items.get(id));
    }
    const id = JSON.stringify(keys);
    if (choices[id] === 'draft') return copy(mine);
    if (choices[id] === 'saved') return copy(disk);
    conflicts.push({ id, path: keys, draft: mine ?? null, saved: disk ?? null });
    return copy(disk);
  }
  return { value: merge(base, draft, saved, prefix), conflicts };
}

export function conflictReview(conflicts, data, saved = {}) {
  const names = new Map(), owners = new Map();
  for (const journey of data.journeys) {
    names.set(journey.id, journey.title);
    for (const key of ['days', 'photos', 'segments', 'places', 'videos', 'travelers', 'routeGroups', 'replayMoments']) {
      for (const item of journey[key] || []) {
        owners.set(item.id, journey);
        const route = key === 'segments' ? `${journey.places.find(p => p.id === item.from)?.name} → ${journey.places.find(p => p.id === item.to)?.name}` : null;
        names.set(item.id, key === 'days' ? `Day ${item.number} · ${saved.days?.[item.id]?.title || item.title}` : item.sourceFilename || item.name || item.title || route || item.caption || item.id);
      }
    }
  }
  const labels = { state: 'Saved edits', plan: 'Trip plan', text: 'Day story', tagline: 'Tagline', photoId: 'Photo', focal: 'Crop position' };
  const label = key => names.get(key) || labels[key] || key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase());
  const display = value => value === null || value === '' ? 'Empty' : typeof value === 'string' ? names.get(value) || value : JSON.stringify(value, null, 2);
  const containers = new Set(['state','plan','days','photos','routes','segments','places','videos','travelers','routeGroups','replayMoments']);
  return conflicts.map(item => {
    const owner = owners.get(item.path.find(key => owners.has(key)));
    const parts = item.path.filter(key => !containers.has(key)).map(label);
    if (owner && !item.path.includes(owner.id)) parts.unshift(owner.title);
    return { ...item, label:parts.join(' / ') || 'Saved edits', draftText:display(item.draft), savedText:display(item.saved) };
  });
}
