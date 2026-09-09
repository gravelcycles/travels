import test from 'node:test';
import assert from 'node:assert/strict';
import '../dist/assets/atlas-utils.js';
const { photoLandmarkGroups, photoMapTransition } = globalThis.JOURNEY_ATLAS_UTILS;
const photo = (id, lng, lat = 10, zoom = 16) => ({ id, lng, lat, zoom });

function cameraHarness() {
  const calls = [], handlers = new Set(), timers = new Map();
  let timerId = 0;
  const map = {
    on(type, fn) { assert.equal(type, 'moveend'); handlers.add(fn); },
    off(type, fn) { handlers.delete(fn); },
    stop() { calls.push({ type: 'stop' }); },
    easeTo(options) { calls.push({ type: 'ease', options }); },
    fitBounds(bounds, options) { calls.push({ type: 'fit', bounds, options }); },
    getZoom() { return 16; }
  };
  const controller = photoMapTransition(map, {
    schedule(fn, delay) { const id = ++timerId; timers.set(id, { fn, delay }); return id; },
    unschedule(id) { timers.delete(id); }
  });
  return { controller, calls, handlers, timers,
    finishMove() { for (const fn of [...handlers]) fn(); },
    finishPause() { const pending = [...timers.values()]; timers.clear(); pending.forEach(({ fn }) => fn()); }
  };
}

test('photo groups use a 500 metre limit independent of screen distance and zoom', () => {
  const photos = [photo('a', 8, 47), photo('near', 8.003, 47), photo('far', 8.03, 47)];
  const view = { width: 2000, height: 1000 };
  const project = scale => ([lng,lat]) => ({ x: 200 + (lng - 8) * scale, y: 200 });
  const ids = scale => photoLandmarkGroups(photos, project(scale), view).map(g => g.photos.map(p => p.id));
  assert.deepEqual(ids(10), [['a', 'near'], ['far']]);
  assert.deepEqual(ids(50000), ids(10));
  const meters = globalThis.JOURNEY_ATLAS_UTILS.photoDistanceMeters;
  const edge = delta => photo('edge', 8, 47 + delta / 6371000 * 180 / Math.PI);
  assert.ok(meters(photos[0], edge(499.9)) < 500);
  assert.equal(photoLandmarkGroups([photos[0],edge(499.9)], project(10), view).length, 1);
  assert.equal(photoLandmarkGroups([photos[0],edge(500.1)], project(10), view).length, 2);
});

test('hidden, trashed, missing, invalid and offscreen photos never become landmarks', () => {
  const photos = [photo('valid', 10), { ...photo('hidden', 11), hidden: true }, { ...photo('trashed', 10), trashed:true }, { id: 'missing' },
    photo('invalid', 181), photo('nan', NaN), photo('offscreen', 100)];
  const groups = photoLandmarkGroups(photos, ([x,y]) => ({ x: x * 10, y }), { width: 400, height: 300 });
  assert.deepEqual(groups.flatMap(g => g.photos.map(p => p.id)), ['valid']);
});

test('groups never chain beyond 500 metres or combine different days', () => {
  const latitude = meters => 47 + meters / 6371000 * 180 / Math.PI;
  const photos = [photo('a',8,latitude(0)), photo('b',8,latitude(400)), photo('c',8,latitude(800))];
  const groups = photoLandmarkGroups(photos, () => ({ x: 100, y:100 }), { width: 400, height: 300 });
  assert.deepEqual(groups.map(g => g.photos.map(p => p.id)), [['a','b'],['c']]);
  const days = photoLandmarkGroups([{...photos[0],dayId:'d1'}, {...photos[0],id:'d2-photo',dayId:'d2'}], () => ({x:100,y:100}), {width:400,height:300});
  assert.equal(days.length,2);
});

test('photo transition frames both pins then settles at the saved zoom in about two seconds', () => {
  const h = cameraHarness(); let finished = 0;
  h.controller.move(photo('before', 8, 47), photo('after', 9, 46, 14.38), { padding: 30, onFinish: () => finished++ });
  const fit = h.calls.at(-1);
  assert.equal(fit.type, 'fit');
  assert.deepEqual(fit.bounds, [[8,46],[9,47]]);
  assert.equal(fit.options.padding, 30);
  assert.ok(fit.options.maxZoom < 14.38);
  h.finishMove();
  assert.equal([...h.timers.values()][0].delay, 150);
  assert.equal(h.calls.at(-1).type, 'fit');
  h.finishPause();
  assert.deepEqual(h.calls.at(-1), { type: 'ease', options: { center: [9,46], zoom: 14.38, duration: 950 } });
  assert.equal(fit.options.duration + 150 + h.calls.at(-1).options.duration, 1950);
  h.finishMove();
  assert.equal(finished, 1);
  assert.equal(h.handlers.size, 0);
});

test('rapid navigation and cancellation prevent stale camera moves and clean up previous pins', () => {
  const h = cameraHarness(); let cleanup = 0;
  h.controller.move(photo('a', 8), photo('b', 9), { onFinish: () => cleanup++ });
  h.finishMove();
  const stale = [...h.timers.values()][0].fn;
  h.controller.move(photo('b', 9), photo('c', 10, 11, 18));
  assert.equal(cleanup, 1);
  const count = h.calls.length;
  stale(); assert.equal(h.calls.length, count);
  h.finishMove(); h.finishPause();
  assert.deepEqual(h.calls.at(-1).options.center, [10,11]);
  h.controller.cancel();
  assert.equal(h.handlers.size, 0);
  assert.equal(h.timers.size, 0);
});

test('reduced motion, first photos and coincident points avoid the two-stage tour', () => {
  for (const [from, reducedMotion, duration] of [[photo('a', 8), true, 0], [null, false, 650], [photo('a', 9), false, 650]]) {
    const h = cameraHarness();
    h.controller.move(from, photo('b', 9, 10, 17), { reducedMotion });
    assert.equal(h.calls.at(-1).type, 'ease');
    assert.equal(h.calls.at(-1).options.duration, duration);
    assert.equal(h.timers.size, 0);
  }
  const h = cameraHarness();
  h.controller.move(photo('a', 8), { id: 'unlocated' });
  assert.equal(h.calls.filter(c => c.type !== 'stop').length, 0);
});

test('a nearby group occupies one clickable target retaining all its photos', () => {
  const photos = Array.from({length:12}, (_,i) => photo(`p${i}`, 8 + i * .00001, 47));
  const layout = globalThis.JOURNEY_ATLAS_UTILS.photoLandmarkLayout(photos, () => ({ x:5,y:540 }), {width:390,height:560});
  assert.equal(layout.length,1);
  assert.deepEqual(layout[0].photos.map(p => p.id), photos.map(p => p.id));
  assert.ok(layout[0].point.x >= 28 && layout[0].point.y <= 456);
  assert.equal(layout[0].anchor.x + layout[0].offset[0], layout[0].point.x);
  assert.equal(layout[0].anchor.y + layout[0].offset[1], layout[0].point.y);
});

test('distant groups that overlap on screen move apart without merging', () => {
  const photos = Array.from({length:6}, (_,i) => photo(`p${i}`, 8 + i * .03, 47));
  const layout = globalThis.JOURNEY_ATLAS_UTILS.photoLandmarkLayout(photos, () => ({x:180,y:230}), {width:390,height:560});
  assert.equal(layout.length,6);
  for (const item of layout) for (const other of layout.filter(p => p !== item)) {
    assert.ok(Math.abs(item.point.x-other.point.x)>=56 || Math.abs(item.point.y-other.point.y)>=56);
  }
});
