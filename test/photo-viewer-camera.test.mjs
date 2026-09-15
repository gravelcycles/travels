import test from 'node:test';
import assert from 'node:assert/strict';
import '../dist/assets/atlas-utils.js';
import { photoMapHarness } from './photo-map-harness.mjs';
const { photoMapTransition, photoMapFrame, photoMapCamera, frameContainsPhoto, resolvePhoto } = globalThis.JOURNEY_ATLAS_UTILS;
const photo = (id, lng, lat = 47, zoom = 16) => ({ id, lng, lat, zoom });

function cameraHarness(options) {
  const h = photoMapHarness(options), timers = new Map();
  let timerId = 0;
  const controller = photoMapTransition(h.map, {
    schedule(fn, delay) { const id = ++timerId; timers.set(id, { fn, delay }); return id; },
    unschedule(id) { timers.delete(id); }
  });
  return { ...h, controller, timers,
    finishPause() { const pending = [...timers.values()]; timers.clear(); pending.forEach(({ fn }) => fn()); }
  };
}

test('long moves form a quadratic arc with a brief apex and the exact saved destination', () => {
  const h = cameraHarness(); let finished = 0;
  h.controller.move(photo('before', 8), photo('after', 9, 46, 14.38), { padding: 30, onFinish: () => finished++ });
  const outbound = h.moves()[0].options;
  assert.ok(outbound.zoom < 14.38);
  assert.deepEqual(h.calls.find(c => c.type === 'calculate').bounds, [[8,46],[9,47]]);
  assert.equal(outbound.easing(0.5), 0.75);
  h.finishMove();
  assert.equal([...h.timers.values()][0].delay, 40);
  h.finishPause();
  const inbound = h.moves()[1].options;
  assert.deepEqual(inbound.center, [9,46]); assert.equal(inbound.zoom, 14.38);
  assert.equal(inbound.easing(0.5), 0.25);
  assert.ok(outbound.duration + 40 + inbound.duration <= 1640);
  h.finishMove();
  assert.equal(finished, 1); assert.equal(h.handlers.size, 0);
});

test('nearby pins, coincident pins and shared frames leave the camera completely still', () => {
  for (const reducedMotion of [false, true]) for (const lng of [8, 8.0001, 8.001]) {
    const h = cameraHarness(); let finished = 0;
    const mapFrame = { bounds: [[7.999,46.999], [8.002,47.001]] };
    h.controller.move({ ...photo('before', 8), mapFrame }, { ...photo('after', lng, 47, 19), mapFrame }, { reducedMotion, onFinish: () => finished++ });
    assert.equal(h.moves().length, 0); assert.equal(h.timers.size, 0);
    assert.equal(h.handlers.size, 0); assert.equal(finished, 1);
    assert.deepEqual(h.camera, { center: [8,47], zoom: 16 });
  }
});

test('actual viewport size and manual panning decide whether pins are in frame', () => {
  const from = photo('a', 8), to = photo('b', 8.0015);
  const wide = cameraHarness({ width: 500 });
  wide.controller.move(from, to); assert.equal(wide.moves().length, 0);
  const narrow = cameraHarness({ width: 120 });
  narrow.controller.move(from, to); assert.ok(narrow.moves().length > 0);
  const panned = cameraHarness({ center: [9,47] });
  panned.controller.move(from, from); assert.equal(panned.moves().length, 1);
  assert.deepEqual(panned.moves()[0].options.center, [8,47]);
});

test('short pans and a wider destination avoid an unnecessary zoom excursion', () => {
  for (const to of [photo('nearby', 8.002), photo('wide', 9, 47, 5)]) {
    const h = cameraHarness();
    h.controller.move(photo('before', 8), to);
    assert.equal(h.moves().length, 1);
    assert.deepEqual(h.moves()[0].options.center, [to.lng,to.lat]);
    assert.equal(h.moves()[0].options.zoom, to.zoom);
    h.finishMove(); assert.equal(h.timers.size, 0);
  }
});

test('rapid navigation and cancellation prevent stale moves and remove previous pins', () => {
  const h = cameraHarness(); let cleanup = 0;
  h.controller.move(photo('a', 8), photo('b', 9), { onFinish: () => cleanup++ });
  h.finishMove();
  const stale = [...h.timers.values()][0].fn;
  h.controller.move(photo('b', 9), photo('c', 10, 48, 18));
  assert.equal(cleanup, 1);
  const count = h.calls.length;
  stale(); assert.equal(h.calls.length, count);
  h.finishMove(); h.finishPause();
  assert.deepEqual(h.moves().at(-1).options.center, [10,48]);
  h.controller.cancel();
  assert.equal(h.handlers.size, 0); assert.equal(h.timers.size, 0);
});

test('reduced motion, first photos and missing locations clean up without a tour', () => {
  for (const [from, reducedMotion, duration] of [[photo('a', 8), true, 0], [null, false, 500]]) {
    const h = cameraHarness();
    h.controller.move(from, photo('b', 9, 46, 17), { reducedMotion });
    assert.equal(h.moves()[0].options.duration, duration); assert.equal(h.timers.size, 0);
  }
  const h = cameraHarness(); let finished = 0;
  h.controller.move(photo('a', 8), { id: 'unlocated' }, { onFinish: () => finished++ });
  assert.equal(h.moves().length, 0); assert.equal(finished, 1);
});

test('saved bounds fit portrait and landscape maps while retaining an off-center pin', () => {
  const p = { ...photo('custom', 8.01, 47.002), mapFrame: { bounds: [[8,47],[8.1,47.05]] } };
  for (const [width, height] of [[360,260], [120,270], [800,400]]) {
    const h = cameraHarness({ width, height });
    h.controller.move(null, p); h.finishMove();
    assert.notDeepEqual(h.camera.center, [p.lng,p.lat]);
    for (const point of p.mapFrame.bounds) {
      const pixel = h.map.project(point);
      assert.ok(pixel.x >= -1e-5 && pixel.x <= width + 1e-5);
      assert.ok(pixel.y >= -1e-5 && pixel.y <= height + 1e-5);
    }
    assert.equal(h.moves()[0].options.pitch, 0);
  }
});

test('old photos infer bounds from existing zoom at each size, including the date line', () => {
  for (const lng of [8, 179.9999, -179.9999]) for (const width of [180,600]) {
    const p = photo('old', lng, 47, 14.38);
    const frame = photoMapFrame(p, { width, height: 260 });
    assert.ok(frameContainsPhoto(frame, p));
    const h = cameraHarness({ width });
    const fitted = photoMapCamera(h.map, { ...p, mapFrame: frame });
    assert.ok(Math.abs(fitted.zoom - p.zoom) < 1e-7);
    assert.ok(Math.abs(fitted.center[1] - p.lat) < 1e-7);
    assert.equal(p.mapFrame, undefined);
  }
  const cleared = resolvePhoto({ ...photo('p', 8), mapFrame: { bounds: [[7,46],[9,48]] } }, { location: null });
  assert.equal(photoMapFrame(cleared), null); assert.equal(cleared.mapFrame, undefined);
});
