import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { viewerFunction } from './viewer-flow-harness.mjs';
import { libertyLabels } from './map-style-harness.mjs';
import '../dist/assets/map-style.js';

// A map that records structural work, so a restyle can be told from a rebuild.
function recordingMap({ featureState = true } = {}) {
  let layers = structuredClone(libertyLabels);
  const sources = new Map(), states = new Map(), calls = { addSource: 0, addLayer: 0, removeLayer: 0, removeSource: 0, moveLayer: 0, setPaintProperty: 0 };
  const map = {
    calls, states, sources,
    getStyle: () => ({ layers: structuredClone(layers) }),
    getLayer: id => layers.find(layer => layer.id === id),
    getSource: id => sources.get(id),
    addSource(id, source) { calls.addSource++; sources.set(id, source); },
    removeSource(id) { calls.removeSource++; sources.delete(id); states.delete(id); },
    addLayer(layer, before) {
      calls.addLayer++;
      const index = before ? layers.findIndex(item => item.id === before) : layers.length;
      if (index < 0) throw new Error(`Missing layer ${before}`);
      layers.splice(index, 0, structuredClone(layer));
    },
    removeLayer(id) { calls.removeLayer++; layers = layers.filter(layer => layer.id !== id); },
    moveLayer(id, before) {
      calls.moveLayer++;
      const layer = this.getLayer(id); layers = layers.filter(item => item.id !== id);
      const index = before ? layers.findIndex(item => item.id === before) : layers.length;
      layers.splice(index, 0, layer);
    },
    setLayoutProperty(id, key, value) { (this.getLayer(id).layout ||= {})[key] = structuredClone(value); },
    setPaintProperty(id, key, value) { calls.setPaintProperty++; (this.getLayer(id).paint ||= {})[key] = structuredClone(value); },
    setFeatureState({ source, id }, state) { states.set(source, { ...(states.get(source) || {}), [id]: { ...(states.get(source)?.[id] || {}), ...state } }); }
  };
  if (featureState) map.removeFeatureState = ({ source }) => { states.delete(source); };
  return map;
}

const journeyFixture = () => ({
  id: 'restyle-trip',
  segments: [
    { id: 'leg-rail', mode: 'train' },
    { id: 'leg-plan', mode: 'train', planningStatus: 'tbd' },
    { id: 'leg-bus', mode: 'bus' },
    { id: 'leg-return', mode: 'train' }
  ],
  days: [
    { id: 'd1', segmentIds: ['leg-rail'] },
    { id: 'd2', segmentIds: ['leg-bus', 'leg-plan'] },
    { id: 'd3', segmentIds: [] },
    { id: 'd4', segmentIds: ['leg-return'] }
  ]
});

function harness(journey, { scope = 'journey', dayId = 'd1', map = recordingMap(), routes = {} } = {}) {
  const markers = [];
  const context = vm.createContext({
    journey, mainMap: map, mainMapReady: true, mapScope: scope, activeDayId: dayId, inspectedSegmentId: null,
    mainDecorations: { markers: [], layerIds: [], sourceIds: [], hitLayerIds: [], routeLayers: [] },
    window: { JOURNEY_ATLAS_MAP_STYLE: globalThis.JOURNEY_ATLAS_MAP_STYLE },
    palette: { route: '#006f92', casing: '#fffef8', muted: '#71878a' },
    modeStyles: { train: { color: '#0072b2', width: 5.8 }, bus: { color: '#a85c00', width: 5, dash: [5.5, 2.2] } },
    segmentCoordinates: segment => segment.geometry || routes[segment.id] || [[1, 1], [2, 2]],
    activeDay: () => context.journey.days.find(day => day.id === context.activeDayId),
    mapIsReady: () => true, renderPlanningFilters() {}, photoBubbles: null, renderLegend() {},
    clearDayPreview() {}, syncArrivalLayers() {}, openingRoute: null, renderDayNavigator() {}, locationLabels: null,
    addDayStopMarkers(_map, decorations) { const marker = { removed: false, remove() { this.removed = true; } }; markers.push(marker); decorations.markers.push(marker); return []; }
  });
  vm.runInContext(['clearDecorations', 'segmentLayerPaint', 'addSegmentLayer', 'restyleMainRoutes', 'drawMainMap'].map(viewerFunction).join('\n'), context);
  context.drawMainMap(false);
  const show = (nextScope, nextDay = context.activeDayId) => { context.mapScope = nextScope; context.activeDayId = nextDay; context.drawMainMap(false); };
  return { context, map, markers, show };
}

// Default visibility is "visible"; a restyle states it, a fresh layer omits it.
const style = map => map.getStyle().layers.map(layer => ({ ...layer, layout: { ...(layer.layout || {}), ...(layer.source?.startsWith?.('main-source-') ? { visibility: layer.layout?.visibility || 'visible' } : {}) } }));
const bookkeeping = context => JSON.parse(JSON.stringify({ ...context.mainDecorations, markers: undefined, cancelStopReveal: undefined, routeSignature: undefined }));
const fresh = (scope, dayId) => harness(journeyFixture(), { scope, dayId });

test('changing the day or scope restyles the existing route layers into exactly a fresh draw', () => {
  const f = harness(journeyFixture());
  const built = { ...f.map.calls };
  assert.equal(built.addSource, 4); assert.equal(built.addLayer, 12);
  for (const [scope, dayId] of [['day', 'd1'], ['day', 'd2'], ['day', 'd3'], ['day', 'd4'], ['journey', 'd4'], ['day', 'd2'], ['journey', 'd1']]) {
    f.show(scope, dayId);
    const expected = fresh(scope, dayId);
    assert.deepEqual(style(f.map), style(expected.map), `${scope}/${dayId}: paint, order and visibility match a fresh draw`);
    assert.deepEqual(bookkeeping(f.context), bookkeeping(expected.context), `${scope}/${dayId}: layer bookkeeping matches a fresh draw`);
  }
  assert.equal(f.map.calls.addSource, built.addSource, 'no route source is re-created');
  assert.equal(f.map.calls.addLayer, built.addLayer, 'no route layer is re-created');
  assert.equal(f.map.calls.removeLayer, 0); assert.equal(f.map.calls.removeSource, 0);
  assert.ok(f.markers.slice(0, -1).every(marker => marker.removed) && !f.markers.at(-1).removed, 'each draw replaces the previous stop markers');
});

test('a restyle clears what a rebuild used to discard: hidden layers, feature state and temporary arrival guides', () => {
  const f = harness(journeyFixture(), { scope: 'day', dayId: 'd1' });
  // Arrival playback hides the travelled leg, previews mark feature state and
  // the grey guide adds its own layers to the same decoration list.
  f.map.setLayoutProperty('main-line-leg-rail', 'visibility', 'none');
  f.map.setLayoutProperty('main-casing-leg-rail', 'visibility', 'none');
  f.map.setFeatureState({ source: 'main-source-leg-bus', id: 'leg-bus' }, { previewed: true, legMuted: true });
  f.context.addSegmentLayer(f.map, f.context.mainDecorations, f.context.journey.segments[0], { prefix: 'arrival-guide', color: '#71878a', opacity: 0.35, selected: false });
  assert.ok(f.map.getLayer('arrival-guide-line-leg-rail'));
  f.show('day', 'd2');
  assert.equal(f.map.getLayer('arrival-guide-line-leg-rail'), undefined); assert.equal(f.map.getLayer('arrival-guide-casing-leg-rail'), undefined);
  assert.equal(f.map.getSource('arrival-guide-source-leg-rail'), undefined);
  assert.equal(f.map.states.size, 0, 'no preview or inspection state survives the day change');
  assert.deepEqual(style(f.map), style(fresh('day', 'd2').map));
  assert.equal(f.map.calls.addSource, 5, 'only the temporary guide added a source after the first draw');
});

test('routes are rebuilt when the journey, its legs, their status or their line shape change', () => {
  const changes = [
    journey => { journey.id = 'another-trip'; },
    journey => { journey.segments = journey.segments.slice(0, 3); journey.days[3].segmentIds = []; },
    journey => { journey.segments[1].planningStatus = 'confirmed'; },
    journey => { journey.segments[2].mode = 'train'; },
    journey => { journey.segments[0].geometry = [[1, 1], [1.5, 1.2], [2, 2]]; },
    journey => { journey.segments[0].geometry = [[1, 1], [2.5, 2.5]]; }
  ];
  for (const change of changes) {
    const journey = journeyFixture(), f = harness(journey), before = { ...f.map.calls };
    change(journey); f.show('journey');
    assert.ok(f.map.calls.addSource > before.addSource, 'changed route data gets fresh sources');
    assert.equal(f.map.calls.removeSource, before.addSource, 'every old source is removed');
    const expected = harness(journey);
    assert.deepEqual(style(f.map), style(expected.map));
  }
});

test('a map that lost a route layer, or cannot restyle, falls back to a full draw', () => {
  const lost = harness(journeyFixture());
  lost.map.removeLayer('main-hit-leg-bus'); const before = { ...lost.map.calls };
  lost.show('day', 'd2');
  assert.ok(lost.map.calls.addLayer >= before.addLayer + 12);
  assert.deepEqual(style(lost.map), style(fresh('day', 'd2').map));
  const limited = harness(journeyFixture(), { map: recordingMap({ featureState: false }) });
  limited.show('day', 'd1');
  assert.equal(limited.map.calls.addSource, 8, 'without removeFeatureState the proven rebuild path stays in use');
  assert.deepEqual(style(limited.map), style(fresh('day', 'd1').map));
});
