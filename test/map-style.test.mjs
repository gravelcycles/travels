import test from 'node:test';
import assert from 'node:assert/strict';
import '../dist/assets/map-style.js';
import { libertyLabels, mapStyleHarness } from './map-style-harness.mjs';
const { applyBasemapTreatment, routeInsertionLayer, isSettlementLabel } = globalThis.JOURNEY_ATLAS_MAP_STYLE;

test('only settlement labels rise above routes; highway shields and administrative names stay below', () => {
  const map = mapStyleHarness();
  applyBasemapTreatment(map);
  map.addLayer({ id: 'route', type: 'line' }, routeInsertionLayer(map));
  const layers = map.getStyle().layers, routeIndex = layers.findIndex(l => l.id === 'route');
  assert.deepEqual(layers.slice(routeIndex + 1).map(l => l.id), ['label_village', 'label_town', 'label_city', 'label_city_capital']);
  for (const original of libertyLabels.filter(l => l.type === 'symbol' && !isSettlementLabel(l))) {
    assert.deepEqual(map.getLayer(original.id), original, `${original.id} retains its styling`);
    assert.ok(layers.findIndex(l => l.id === original.id) < routeIndex);
  }
  applyBasemapTreatment(map);
  assert.deepEqual(map.getStyle().layers, layers, 'Repeated application does not duplicate or reorder routes');
});

test('crisp settlement halos improve contrast while type remains regular and restrained', () => {
  const map = mapStyleHarness();
  applyBasemapTreatment(map);
  for (const original of libertyLabels.filter(isSettlementLabel)) {
    const label = map.getLayer(original.id), size = label.layout['text-size'];
    assert.equal(label.minzoom, original.minzoom);
    assert.deepEqual(label.filter, original.filter);
    assert.deepEqual(label.layout['text-font'], ['Noto Sans Regular']);
    assert.deepEqual(label.layout['text-field'], original.layout['text-field']);
    assert.deepEqual(label.layout['text-offset'], [0, -0.6]);
    assert.equal(label.layout['text-allow-overlap'], undefined);
    assert.equal(label.layout['text-ignore-placement'], undefined);
    assert.ok(size.at(-1) <= original.layout['text-size'].at(-1));
    assert.ok(size.at(-1) <= 15);
    assert.equal(label.paint['text-halo-color'], '#fffef8');
    assert.equal(label.paint['text-halo-width'], 2);
    assert.ok(label.paint['text-halo-blur'] < original.paint['text-halo-blur']);
  }
});

test('partial styles tolerate absent settlement layers without using road labels as a fallback', () => {
  const map = mapStyleHarness(libertyLabels.filter(l => !isSettlementLabel(l)));
  applyBasemapTreatment(map);
  assert.equal(routeInsertionLayer(map), undefined);
  map.addLayer({ id: 'route', type: 'line' }, routeInsertionLayer(map));
  assert.equal(map.getStyle().layers.at(-1).id, 'route');
  applyBasemapTreatment(mapStyleHarness([]));
});
