import test from 'node:test';
import assert from 'node:assert/strict';
import '../dist/assets/places-panel.js';

const { searchPlaces, nearbyPlaces, clusterPoints, mapInsets } = globalThis.JOURNEY_ATLAS_PLACE_PANEL;
const points = [
  { id: 'cafe', name: 'Café du Rhône', category: 'food', dayIds: ['one'], summary: 'A quiet terrace by the water', address: 'Rue du Pont', coordinates: [10, 10] },
  { id: 'tower', name: 'Old tower', category: 'sight', dayIds: ['one', 'two'], summary: 'A view over the city', note: 'Worth the climb', coordinates: [40, 10] },
  { id: 'garden', name: 'The garden', category: 'sight', dayIds: ['two'], summary: 'A quiet place', coordinates: [200, 100] }
];

test('place search combines independent category, day and accent-insensitive word filters', () => {
  const before = structuredClone(points);
  assert.deepEqual(searchPlaces(points, { query: '  RHONE cafe  ' }).map(p => p.id), ['cafe']);
  assert.deepEqual(searchPlaces(points, { query: 'pont water', dayId: 'one', category: 'food' }).map(p => p.id), ['cafe']);
  assert.deepEqual(searchPlaces(points, { query: 'climb' }).map(p => p.id), ['tower']);
  assert.deepEqual(searchPlaces(points, { dayId: 'two', category: 'food' }), []);
  assert.equal(searchPlaces(points, { query: '  ' }).length, 3);
  assert.deepEqual(searchPlaces([]), []);
  assert.deepEqual(points, before, 'Filters never rewrite source data or reorder its collection');
});

test('a nearby selection preserves the current result filters and clears without changing their order', () => {
  const results = searchPlaces(points, { category: 'sight', dayId: 'two' }), before = structuredClone(results);
  assert.deepEqual(nearbyPlaces(results, ['cafe', 'tower', 'unknown']).map(point => point.id), ['tower']);
  assert.deepEqual(nearbyPlaces(results, null).map(point => point.id), ['tower', 'garden']);
  assert.deepEqual(nearbyPlaces(results, []), []);
  assert.deepEqual(results, before);
});

test('nearby place pins have one accessible cluster, with distant pins kept separate', () => {
  const groups = clusterPoints(points, ([x, y]) => ({ x, y }));
  assert.deepEqual(groups.map(group => group.points.map(p => p.id)), [['cafe', 'tower'], ['garden']]);
  assert.equal(groups[0].x, 10);
  assert.equal(clusterPoints(points, ([x, y]) => ({ x: x * 3, y: y * 3 })).length, 3, 'Zooming in naturally separates nearby points');
  assert.deepEqual(clusterPoints([], () => ({ x: 0, y: 0 })), []);
});

test('a selected place anchors its cluster exactly and never makes coincident places unreachable', () => {
  const sameLocation = [...points, { ...points[0], id: 'neighbor' }], before = structuredClone(sameLocation);
  const groups = clusterPoints(sameLocation, ([x, y]) => ({ x, y }), 'tower');
  assert.equal(groups[0].selected, true);
  assert.equal(groups[0].points[0].id, 'tower');
  assert.equal(groups[0].x, 40, 'Selected place retains its exact projected position');
  assert.deepEqual(groups[0].points.map(p => p.id), ['tower', 'cafe', 'neighbor']);
  assert.deepEqual(sameLocation, before);
  assert.equal(clusterPoints(points, () => ({ x: NaN, y: 0 })).length, 0, 'Unprojectable positions never become broken markers');
});

test('place camera insets reserve floating controls without producing invalid small-phone bounds', () => {
  const frame = { left: 0, right: 834, top: 54, bottom: 1054, width: 834, height: 1000 };
  const toolbar = { left: 300, right: 534, top: 64, bottom: 114 };
  const sheet = { left: 0, right: 834, top: 454, bottom: 1054 };
  const tablet = mapInsets(frame, { toolbar, sheet, mobile: true });
  assert.equal(tablet.top, 96, 'Pins sit below the preview toolbar with a 36 px buffer');
  assert.equal(tablet.bottom, 636);
  const narrow = mapInsets({ left: 0, right: 320, top: 54, bottom: 510, width: 320, height: 456 }, { toolbar: { ...toolbar, left: 40, right: 280 }, sheet: { left: 0, right: 320, top: 120, bottom: 510 }, mobile: true });
  assert.ok(narrow.top + narrow.bottom <= 444, 'A transitioning sheet keeps a valid 12 px camera area without needlessly uncovering the sheet');
  assert.ok(narrow.left + narrow.right < 320);
  const desktop = mapInsets(frame, { toolbar: { left: 300, right: 534, top: 980, bottom: 1030 } });
  assert.equal(desktop.top, 64, 'A bottom toolbar never consumes top camera padding');
  assert.equal(desktop.bottom, 110);
  assert.equal(mapInsets(frame, { toolbar: { ...toolbar, left: 900, right: 1100 } }).top, 64, 'Controls outside this map do not affect its camera');
});

test('a short phone clusters places inside the real strip between the toolbar and sheet', () => {
  const frame = { left: 0, right: 320, top: 54, bottom: 393, width: 320, height: 339 };
  const toolbar = { left: 40, right: 280, top: 64, bottom: 114 };
  const sheet = { left: 0, right: 320, top: 203.28, bottom: 510 };
  const insets = mapInsets(frame, { toolbar, sheet, mobile: true });
  const upperCenter = frame.top + insets.top, lowerCenter = frame.bottom - insets.bottom;
  assert.equal(upperCenter, 150);
  assert.ok(Math.abs(lowerCenter - 167.28) < 0.001);
  assert.ok(upperCenter - 22 > toolbar.bottom, 'The 44 px marker clears the toolbar');
  assert.ok(lowerCenter + 22 < sheet.top, 'The 44 px marker clears the sheet');
  assert.ok(frame.height - insets.top - insets.bottom >= 12);
  assert.ok(lowerCenter - upperCenter < 54, 'The fit naturally collapses nearby places into a compact cluster');
});
