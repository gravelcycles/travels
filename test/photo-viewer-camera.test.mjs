import test from 'node:test';
import assert from 'node:assert/strict';
import '../dist/assets/atlas-utils.js';
const { photoMapTransition } = globalThis.JOURNEY_ATLAS_UTILS;
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
