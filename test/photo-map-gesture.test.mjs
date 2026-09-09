import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import '../dist/assets/atlas-utils.js';

function fixture() {
  const handlers = new Map(), timers = new Map();
  const map = {
    dragging: false, moves: 0,
    on(name, fn) { handlers.set(name, fn); },
    off(name, fn) { if (handlers.get(name) === fn) handlers.delete(name); },
    stop() { this.dragging = false; },
    easeTo() { this.moves++; },
    fitBounds() { this.moves++; },
    getZoom() { return 16; },
    getCenter() { return { lng: 8, lat: 47 }; },
    getCanvas() { return { clientWidth: 300, clientHeight: 260 }; },
    project() { return { x: -100, y: -100 }; },
    cameraForBounds() { return { center: [8.5, 46.5], zoom: 8 }; }
  };
  const controller = globalThis.JOURNEY_ATLAS_UTILS.photoMapTransition(map, {
    schedule(fn) { timers.set(1, fn); return 1; },
    unschedule(id) { timers.delete(id); }
  });
  const source = fs.readFileSync(new URL('../dist/assets/app.js', import.meta.url), 'utf8');
  const start = source.indexOf('  function initViewerMap(');
  const context = vm.createContext({ viewerMap: null, viewerTransition: null, viewerMapReady: false,
    window: { maplibregl: {}, JOURNEY_ATLAS_UTILS: { photoMapTransition: () => controller } },
    createMap: () => map, mapIsReady: () => false });
  vm.runInContext(source.slice(start, source.indexOf('\n  function ', start + 1)) + '\ninitViewerMap();', context);
  return { map, controller, handlers, timers };
}

test('manual pan and zoom preserve the gesture while cancelling a pending photo move', () => {
  for (const event of ['movestart', 'zoomstart']) {
    const f = fixture(); let cleaned = 0;
    f.controller.move({ id: 'a', lng: 8, lat: 47 }, { id: 'b', lng: 9, lat: 46 }, { onFinish: () => cleaned++ });
    f.handlers.get('moveend')();
    const stale = f.timers.get(1), moves = f.map.moves;
    assert.equal(typeof stale, 'function');
    f.map.dragging = true;
    f.handlers.get(event)({ originalEvent: {} });
    assert.equal(f.map.dragging, true, 'The map must keep processing the active gesture');
    assert.equal(f.timers.size, 0); assert.equal(cleaned, 1);
    stale(); assert.equal(f.map.moves, moves, 'The photo must not pull the map back after dragging');
  }
});

test('programmatic motion is allowed; explicit cancellation still stops the map', () => {
  const f = fixture();
  f.controller.move(null, { id: 'a', lng: 8, lat: 47 });
  f.handlers.get('movestart')({});
  assert.ok(f.handlers.has('moveend'));
  f.map.dragging = true;
  f.controller.cancel();
  assert.equal(f.map.dragging, false); assert.equal(f.handlers.has('moveend'), false);
});
