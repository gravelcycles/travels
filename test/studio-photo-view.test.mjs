import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import '../dist/assets/atlas-utils.js';

function editor() {
  const nodes = new Map(), markers = [], moves = [];
  const node = () => ({ _value: '', get value() { return this._value; }, set value(v) { this._value = String(v); },
    handlers: {}, dataset: {}, addEventListener(type, fn) { this.handlers[type] = fn; }, reset() {} });
  const getNode = selector => { if (!nodes.has(selector)) nodes.set(selector, node()); return nodes.get(selector); };
  const camera = { center: [8.4, 47.2], zoom: 14.25 };
  const map = { stop() {}, getZoom: () => camera.zoom,
    easeTo(view) { moves.push(view); camera.center = [...view.center]; camera.zoom = view.zoom; } };
  const photos = [
    { id: 'first', dayId: 'day', lat: 47, lng: 8, zoom: 16 },
    { id: 'next', dayId: 'day', lat: 48, lng: 9, zoom: 11 },
    { id: 'unlocated', dayId: 'day' },
    { id: 'tomorrow', dayId: 'day2', lat: 49, lng: 10, zoom: 12 }
  ];
  const context = vm.createContext({ structuredClone, testMap: map,
    document: { querySelector: getNode, querySelectorAll: () => [], createElement: node },
    window: { addEventListener() {}, JOURNEY_ATLAS_UTILS: globalThis.JOURNEY_ATLAS_UTILS,
      JOURNEY_ATLAS_DATA: { journeys: [{ id: 'trip', photos, places: [], segments: [],
        days: [{ id: 'day', segmentIds: [] }, { id: 'day2', segmentIds: [] }] }] } },
    maplibregl: { Marker: class {
      constructor() { this.handlers = {}; markers.push(this); }
      setLngLat(point) { this.point = point; return this; }
      addTo() { return this; }
      on(type, fn) { this.handlers[type] = fn; }
      getLngLat() { return { lng: this.point[0], lat: this.point[1] }; }
    } }
  });
  const source = fs.readFileSync(new URL('../studio/studio.js', import.meta.url), 'utf8');
  vm.runInContext(source.replace('  init();\n})();', `
    map = testMap; mapReady = true;
    clearActiveMap = () => {};
    renderPhotoGrid = () => {};
    refreshPhotoOrderControls = () => {};
    renderDaySelectors = () => {};
    window.editor = { selectPhoto, state: () => JSON.parse(JSON.stringify(state)), dirty: () => dirty };
    selectPhoto('first', false);
  })();`), context);
  return { api: context.window.editor, nodes, markers, camera, moves,
    select(id) { nodes.get('#studio-photo-grid').handlers.click({ target: { closest: () => ({ dataset: { photoId: id } }) } }); } };
}

test('same-day selections preserve camera and saved photo data; explicit button restores the selected view', () => {
  const ed = editor();
  ed.select('next');
  assert.deepEqual(ed.camera, { center: [8.4,47.2], zoom: 14.25 });
  assert.equal(ed.moves.length, 0);
  assert.equal(ed.nodes.get('#photo-zoom').value, '11');
  assert.equal(ed.api.dirty(), false);
  assert.equal(JSON.stringify(ed.api.state().photos), '{}');
  ed.nodes.get('#switch-photo-view').handlers.click();
  assert.deepEqual(ed.camera, { center: [9,48], zoom: 11 });
  assert.equal(ed.api.dirty(), false);
  ed.select('first');
  assert.deepEqual(ed.camera, { center: [9,48], zoom: 11 });
});

test('unlocated and cleared points keep the camera and disable saved-view navigation', () => {
  const ed = editor();
  ed.select('unlocated');
  assert.equal(ed.moves.length, 0);
  assert.equal(ed.nodes.get('#switch-photo-view').disabled, true);
  ed.nodes.get('#switch-photo-view').handlers.click();
  assert.equal(ed.moves.length, 0);
  ed.select('next');
  assert.equal(ed.nodes.get('#switch-photo-view').disabled, false);
  ed.nodes.get('#clear-photo-location').handlers.click();
  assert.equal(ed.nodes.get('#switch-photo-view').disabled, true);
  assert.equal(ed.api.state().photos.next.location, null);
  assert.equal(ed.moves.length, 0);
});

test('a pin adjustment records the retained working zoom for Replay, and another day still frames its point', () => {
  const ed = editor();
  ed.select('next');
  const marker = ed.markers.at(-1);
  marker.point = [8.401,47.201];
  marker.handlers.dragend();
  const saved = ed.api.state().photos.next;
  assert.equal(saved.zoom, 14.25);
  assert.equal(saved.location.lng, 8.401);
  assert.equal(saved.location.lat, 47.201);
  assert.equal(ed.moves.length, 0);
  ed.select('tomorrow');
  assert.deepEqual(ed.camera, { center: [10,49], zoom: 12 });
});
