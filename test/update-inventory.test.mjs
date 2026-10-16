import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createInventory, knownFromInventory, mergeKnown, diffInventory, formatUpdateMessage } from '../scripts/update-inventory.mjs';
import { loadContent } from '../scripts/journey-content.mjs';
import { createJourney } from '../scripts/create-journey.mjs';
import { readOverrides } from '../scripts/build-site.mjs';

const repo = path.resolve(import.meta.dirname, '..');
const meta = { siteUrl: 'https://atlas.example.test/travels/', capturedAt: '2026-10-16T12:00:00.000Z', source: { type: 'fixture' } };
const emptyKnown = () => ({ journeys: {} });
const copy = value => structuredClone(value);
function journey(extra = {}) {
  return {
    id: 'independent-trip', title: 'Independent journey', slug: 'independent-trip.html', kind: 'real', published: true,
    places: [{ id: 'north', name: 'North harbour' }, { id: 'south', name: 'South gardens' }],
    days: [
      { id: 'arrival', title: 'Arrival', destinationId: 'north' },
      { id: 'explore', title: 'Explore', placeId: 'north' },
      { id: 'departure', title: 'Departure', destinationId: 'south' },
      { id: 'untitled-place', title: 'Across the valley' }
    ],
    photos: [{ id: 'old-one', dayId: 'arrival', assetStatus: 'published', takenAt: '2001-05-04 · 11:30' }],
    ...extra
  };
}
const inventory = (journeys = [journey()], options = {}) => createInventory({ ...meta, data: { journeys }, ...options });

test('new-photo counts use stable membership, include old capture dates, and do not subtract deletions', () => {
  const baseline = inventory([journey({ photos: [{ id: 'old-one', dayId: 'arrival' }, { id: 'old-two', dayId: 'departure' }] })]);
  const current = inventory([journey({ photos: [
    { id: 'old-one', dayId: 'arrival', caption: 'An edited caption', src: '/new-derivative.webp' },
    { id: 'new-old-capture', dayId: 'arrival', takenAt: '1995-01-01 · 08:00' },
    { id: 'new-second', dayId: 'departure' }
  ] })]);
  const diff = diffInventory(current, knownFromInventory(baseline));
  assert.equal(diff.newPhotoCount, 2);
  assert.equal(diff.newTripCount, 0);
  assert.equal(diff.locationCount, 2);
  assert.deepEqual(diff.journeys[0].photoIds, ['new-old-capture', 'new-second']);
  assert.deepEqual(diff.journeys[0].locations.map(location => location.isNewLocation), [false, false]);
});

test('publication eligibility resolves album/Trash overrides, excludes local/video/demo/drafts, and ignores legacy Hide', () => {
  const main = journey({ photos: [
    { id: 'moved', dayId: 'arrival', hidden: true },
    { id: 'trashed', dayId: 'arrival' },
    { id: 'local-only', dayId: 'arrival', assetStatus: 'local' },
    { id: 'video-entry', dayId: 'arrival', mediaType: 'video' },
    { id: 'legacy-visible', dayId: 'arrival', hidden: true }
  ], videos: [{ id: 'private-video', dayId: 'arrival', assetStatus: 'published' }] });
  const result = inventory([main, journey({ id: 'sample', kind: 'demo' }), journey({ id: 'draft', published: false })], {
    overrides: { photos: { moved: { dayId: 'departure', hidden: true }, trashed: { trashed: true } } }
  });
  assert.equal(result.journeys.length, 1);
  assert.deepEqual(result.journeys[0].photos, [
    { id: 'moved', eventId: 'departure', locationId: 'place:south' },
    { id: 'legacy-visible', eventId: 'arrival', locationId: 'place:north' }
  ]);
  assert.deepEqual(result.journeys[0].locations.map(location => location.label), ['North harbour', 'South gardens']);
  assert.equal(diffInventory(result, emptyKnown()).newPhotoCount, 2);
  assert.equal(JSON.stringify(result).includes('private-video'), false);
  assert.equal(JSON.stringify(result).includes('sourceFilename'), false);
});

test('group repeated destinations once, prefer meaningful destination over base, and use authored fallback titles', () => {
  const result = inventory([journey({
    days: [
      { id: 'arrival', title: 'Arrival', destinationId: 'north', placeId: 'south' },
      { id: 'explore', title: 'Explore', placeId: 'north' },
      { id: 'untitled-place', title: 'Original title' }
    ], photos: [{ id: 'a', dayId: 'arrival' }, { id: 'b', dayId: 'explore' }, { id: 'c', dayId: 'untitled-place' }]
  })], { overrides: { days: { 'untitled-place': { title: 'Owner’s valley walk' } } } });
  assert.deepEqual(result.journeys[0].locations, [
    { id: 'place:north', label: 'North harbour', eventIds: ['arrival', 'explore'] },
    { id: 'event:untitled-place', label: 'Owner’s valley walk', eventIds: ['untitled-place'] }
  ]);
  const diff = diffInventory(result, emptyKnown());
  assert.equal(diff.locationCount, 2);
  assert.equal(diff.journeys[0].locations[0].newPhotoCount, 2);
  assert.deepEqual(diff.journeys[0].locations[0].links.map(link => link.url), [
    'https://atlas.example.test/travels/independent-trip.html#day=arrival',
    'https://atlas.example.test/travels/independent-trip.html#day=explore'
  ]);
  assert.equal(formatUpdateMessage(diff), 'Journey Atlas update\n1 new trip · 3 new photos across 2 locations\n\nNew trip: Independent journey\n• North harbour: 2 new photos (first photos)\n• Owner’s valley walk: 1 new photo (first photos)\nhttps://atlas.example.test/travels/independent-trip.html');
});

test('first-photo location status ignores empty planned stops in an earlier checkpoint', () => {
  const baseline = inventory();
  const next = journey();
  next.photos.push({ id: 'new-south', dayId: 'departure' });
  const diff = diffInventory(inventory([next]), knownFromInventory(baseline));
  assert.equal(diff.journeys[0].locations[0].isNewLocation, true);
  assert.match(formatUpdateMessage(diff), /South gardens: 1 new photo \(first photos\)/);
});

test('moves, order, titles, captions, pins and replacement derivatives are not new photos', () => {
  const baseline = inventory([journey({ photos: [{ id: 'one', dayId: 'arrival' }, { id: 'two', dayId: 'departure' }] })]);
  const moved = journey({ title: 'Renamed journey', photos: [
    { id: 'two', dayId: 'departure', src: '/different.webp', caption: 'Changed', location: [14, 50] },
    { id: 'one', dayId: 'arrival', takenAt: '2026-10-16 · 09:00' }
  ] });
  const current = inventory([moved], { overrides: { photos: { one: { dayId: 'departure' } } } });
  const diff = diffInventory(current, knownFromInventory(baseline));
  assert.equal(diff.hasChanges, false);
  assert.equal(diff.newPhotoCount, 0);
  assert.deepEqual(diff.journeys, []);
  assert.equal(formatUpdateMessage(diff), 'No new trips or photos since the last checkpoint.');
});

test('union acknowledgement preserves removed trips and photos and never mutates caller state', () => {
  const baseline = inventory(), known = knownFromInventory(baseline), original = copy(known);
  const afterRemoval = mergeKnown(known, inventory([]));
  assert.deepEqual(afterRemoval, known);
  assert.equal(diffInventory(baseline, afterRemoval).hasChanges, false, 'Restoring a removed trip and its photo does not reannounce them');
  const trashed = inventory([journey()], { overrides: { photos: { 'old-one': { trashed: true } } } });
  assert.deepEqual(mergeKnown(known, trashed), known);
  assert.equal(diffInventory(baseline, mergeKnown(known, trashed)).hasChanges, false, 'Trash/restore retains history');
  const additional = journey(); additional.photos.push({ id: 'new-one', dayId: 'departure' });
  const current = inventory([additional]), preserved = copy(current);
  const merged = mergeKnown(known, current);
  assert.deepEqual(known, original);
  assert.deepEqual(current, preserved);
  assert.deepEqual(merged.journeys['independent-trip'].photoIds, ['new-one', 'old-one']);
  assert.equal(diffInventory(current, merged).hasChanges, false);
});

test('new empty trips remain announceable and do not invent photos or locations', () => {
  const result = inventory([journey({ photos: [] })]);
  const diff = diffInventory(result, emptyKnown());
  assert.equal(diff.hasChanges, true);
  assert.equal(diff.newTripCount, 1);
  assert.equal(diff.newPhotoCount, 0);
  assert.equal(diff.locationCount, 0);
  assert.equal(formatUpdateMessage(diff), 'Journey Atlas update\n1 new trip\n\nNew trip: Independent journey\nhttps://atlas.example.test/travels/independent-trip.html');
});

test('photo and location identity is scoped to its trip', () => {
  const first = inventory();
  const second = journey({ id: 'other-trip', slug: 'other-trip.html', title: 'Another journey' });
  const diff = diffInventory(inventory([journey(), second]), knownFromInventory(first));
  assert.equal(diff.newTripCount, 1);
  assert.equal(diff.newPhotoCount, 1);
  assert.equal(diff.locationCount, 1);
  assert.equal(diff.journeys[0].id, 'other-trip');
});

test('a separate published-photo bundle is authoritative; corrupt references and IDs fail closed', () => {
  const result = inventory([journey()], { photos: { 'independent-trip': [{ id: 'bundle-photo', dayId: 'departure' }] } });
  assert.deepEqual(result.journeys[0].photos.map(photo => photo.id), ['bundle-photo']);
  const cases = [
    [{ photos: {} }, /manifest is missing/],
    [{ photos: { 'independent-trip': null } }, /must be an array/],
    [{ photos: { 'independent-trip': [{ id: 'bad id', dayId: 'arrival' }] } }, /stable ID/],
    [{ photos: { 'independent-trip': [{ id: 'one', dayId: 'missing' }] } }, /does not exist/],
    [{ photos: { 'independent-trip': [{ id: 'one', dayId: 'arrival' }, { id: 'one', dayId: 'arrival' }] } }, /duplicate/],
    [{ overrides: { photos: { 'old-one': { dayId: '' } } } }, /stable ID/],
    [{ overrides: { photos: { 'old-one': { trashed: 'false' } } } }, /boolean/],
    [{ capturedAt: 'yesterday' }, /timestamp/]
  ];
  for (const [options, expected] of cases) assert.throws(() => inventory([journey()], options), expected);
  assert.throws(() => inventory([journey({ days: [{ id: 'arrival', title: 'Missing', placeId: 'no-place' }] })]), /does not exist/);
  assert.throws(() => inventory([journey({ published: 'true' })]), /explicit/);
});

test('persisted inventories and known membership reject malformed structures before counting or saving', () => {
  const original = inventory();
  const invalid = [
    value => { value.schemaVersion = 2; },
    value => { delete value.capturedAt; },
    value => { value.siteUrl = 'not a URL'; },
    value => { value.source = null; },
    value => { value.journeys[0].url = 'https://outside.example.test/trip.html'; },
    value => { value.journeys[0].photos[0].eventId = 'absent'; },
    value => { value.journeys[0].photos.push(copy(value.journeys[0].photos[0])); },
    value => { value.journeys[0].locations[0].eventIds.push('empty-event'); },
    value => { value.journeys[0].photos = []; }
  ];
  for (const mutate of invalid) {
    const value = copy(original); mutate(value);
    assert.throws(() => knownFromInventory(value));
    assert.throws(() => diffInventory(value, emptyKnown()));
    assert.throws(() => mergeKnown(emptyKnown(), value));
  }
  assert.throws(() => diffInventory(original, { journeys: { 'independent-trip': { photoIds: null, locationIds: [] } } }), /array/);
  assert.throws(() => mergeKnown({ journeys: { 'independent-trip': { photoIds: ['repeat', 'repeat'], locationIds: [] } } }, original), /duplicate/);
});

test('reference, demo and generated independent daily/city drafts use the same inventory rules', t => {
  const { data } = loadContent(repo), overrides = readOverrides(repo);
  const reference = data.journeys.find(item => item.id === 'switzerland-italy-family-2026');
  const demo = data.journeys.find(item => item.kind === 'demo');
  const actual = inventory([reference, demo], { overrides });
  assert.deepEqual(actual.journeys.map(item => item.id), [reference.id]);
  const visible = reference.photos.filter(photo => photo.assetStatus !== 'local' && !overrides.photos[photo.id]?.trashed);
  assert.equal(actual.journeys[0].photos.length, visible.length);
  assert.equal(diffInventory(actual, knownFromInventory(actual)).hasChanges, false);

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-update-inventory-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.cpSync(path.join(repo, 'content'), path.join(root, 'content'), { recursive: true, filter: filename => !filename.includes(`${path.sep}drafts`) });
  for (const eventMode of ['day', 'city']) {
    const draft = createJourney(root, { title: `Independent ${eventMode} journey`, slug: `updates-fixture-${eventMode}`, startDate: '2028-02-28', endDate: '2028-03-01', timeZone: 'Asia/Tokyo', eventMode });
    draft.days[0].title = 'Harbour walk';
    draft.photos = [{ id: `${draft.id}-a`, dayId: draft.days[0].id }, { id: `${draft.id}-b`, dayId: draft.days.at(-1).id }];
    assert.equal(inventory([draft]).journeys.length, 0, 'Unpublished generated drafts are not broadcast targets');
    draft.published = true;
    const ready = inventory([draft]), diff = diffInventory(ready, emptyKnown());
    assert.equal(diff.newTripCount, 1);
    assert.equal(diff.newPhotoCount, 2);
    assert.equal(diff.locationCount, eventMode === 'city' ? 1 : 2);
    assert.equal(diff.journeys[0].locations[0].label, 'Harbour walk');
    assert.match(formatUpdateMessage(diff), /2 new photos/);
  }
});
