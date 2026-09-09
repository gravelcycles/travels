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

test('landmarks group nearby pins, split at closer zoom, and retain every located photo exactly once', () => {
  const photos = [photo('a', 10), photo('b', 12), photo('same-position', 12), photo('far', 50)];
  const view = { width: 800, height: 600 };
  const zoomedOut = photoLandmarkGroups(photos, ([x,y]) => ({ x: x * 5, y }), view);
  assert.deepEqual(zoomedOut.map(g => g.photos.map(p => p.id)), [['a','b','same-position'],['far']]);
  const zoomedIn = photoLandmarkGroups(photos, ([x,y]) => ({ x: (x - 10) * 40, y }), { width: 2000, height: 600 });
  assert.deepEqual(zoomedIn.map(g => g.photos.map(p => p.id)), [['a'],['b','same-position'],['far']]);
  assert.deepEqual(zoomedIn.flatMap(g => g.photos), photos);
});

test('hidden, missing, invalid and offscreen locations never become landmarks', () => {
  const photos = [photo('valid', 10), { ...photo('hidden', 11), hidden: true }, { id: 'missing' },
    photo('invalid', 181), photo('nan', NaN), photo('offscreen', 100)];
  const groups = photoLandmarkGroups(photos, ([x,y]) => ({ x: x * 10, y }), { width: 400, height: 300 });
  assert.deepEqual(groups.flatMap(g => g.photos.map(p => p.id)), ['valid']);
});

test('groups use fixed real pins instead of chaining all adjacent locations together', () => {
  const groups = photoLandmarkGroups([photo('a', 0), photo('b', 5), photo('c', 10)],
    ([x,y]) => ({ x: x * 10, y }), { width: 400, height: 300 });
  assert.deepEqual(groups.map(g => g.photos.map(p => p.id)), [['a','b'],['c']]);
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

test('overlapping photos fan out as individual non-overlapping targets with exact pin connections', () => {
  const photos = Array.from({ length: 6 }, (_, index) => photo(`p${index}`, 8 + index * 0.00001, 47));
  const project = ([lng, lat]) => ({ x: 250 + (lng - 8) * 100, y: 220 + (lat - 47) * 100 });
  const layout = globalThis.JOURNEY_ATLAS_UTILS.photoLandmarkLayout(photos, project, { width: 650, height: 500 });
  assert.deepEqual(layout.map(item => item.photo.id), photos.map(item => item.id));
  for (const item of layout) {
    assert.deepEqual(item.anchor, project([item.photo.lng, item.photo.lat]));
    assert.equal(item.anchor.x + item.offset[0], item.point.x);
    assert.equal(item.anchor.y + item.offset[1], item.point.y);
    assert.ok(Math.hypot(...item.offset) > 5);
    for (const other of layout.filter(other => other !== item)) {
      assert.ok(Math.abs(item.point.x - other.point.x) >= 56 || Math.abs(item.point.y - other.point.y) >= 56);
    }
  }
});

test('fans stay inside a phone map even when all pins share an edge location', () => {
  const photos = Array.from({ length: 12 }, (_, index) => photo(`p${index}`, 8, 47));
  const layout = globalThis.JOURNEY_ATLAS_UTILS.photoLandmarkLayout(photos, () => ({ x: 5, y: 540 }), { width: 390, height: 560 });
  assert.equal(layout.length, photos.length);
  for (const item of layout) {
    assert.ok(item.point.x >= 28 && item.point.x <= 362);
    assert.ok(item.point.y >= 82 && item.point.y <= 456);
    for (const other of layout.filter(other => other !== item)) {
      assert.ok(Math.abs(item.point.x - other.point.x) >= 56 || Math.abs(item.point.y - other.point.y) >= 56);
    }
  }
});
