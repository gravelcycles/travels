import test from 'node:test';
import assert from 'node:assert/strict';
import { legPreviewHarness } from './route-leg-preview-harness.mjs';
const journey = { places: [{ id: 'a', name: 'Start' }, { id: 'b', name: 'End' }],
  segments: ['out', 'back', 'later'].map(id => ({ id, from: 'a', to: 'b', mode: 'train' })),
  days: [{ id: 'first', segmentIds: ['out', 'back'] }, { id: 'second', segmentIds: ['later'] }] };

test('desktop rows isolate one leg, grey other legs, and restore overlapping routes on leave', () => {
  const h = legPreviewHarness(journey), [first, second] = h.cards;
  const originalOrder = [...h.context.mainDecorations.layerIds];
  h.fire('mouseover', first);
  assert.equal(h.paint('out', 'line-color'), '#0072b2');
  assert.equal(h.paint('out', 'line-opacity'), 1);
  for (const id of ['back', 'later']) { assert.equal(h.paint(id, 'line-color'), '#92999a'); assert.equal(h.paint(id, 'line-opacity'), 0.24); }
  assert.deepEqual(h.order.slice(-2), ['main-casing-out', 'main-line-out']);
  assert.equal(first.classes.has('route-preview'), true); assert.equal(second.classes.has('route-preview'), false);
  assert.equal(h.context.lastPlacePreview.show, false); assert.equal(h.context.$('#route-inspector').hidden, true);
  h.fire('click', first); assert.equal(h.context.routeInspectionPinned, false); assert.equal(h.openedMap, 0);
  h.fire('mouseout', first, first); assert.equal(h.context.previewSegmentId, 'out', 'Moving within a row keeps its preview');
  h.fire('mouseout', first, second); h.fire('mouseover', second, first);
  assert.equal(h.paint('out', 'line-color'), '#92999a'); assert.equal(h.paint('back', 'line-color'), '#0072b2');
  h.fire('mouseout', second);
  assert.equal(h.context.previewSegmentId, null); assert.deepEqual(h.order, originalOrder);
  for (const { id } of journey.segments) { assert.equal(h.paint(id, 'line-color'), '#0072b2'); assert.equal(h.paint(id, 'line-opacity'), 1); }
});

test('keyboard focus uses the same preview; resets and phone transitions clear it', () => {
  const h = legPreviewHarness(journey), [first, second] = h.cards;
  h.context.routeInspectionPinned = true; h.context.inspectedSegmentId = 'back';
  h.context.setInspectedFeatureState('back', true);
  h.fire('focusin', first);
  assert.equal(h.context.previewSegmentId, 'out'); assert.equal(h.context.routeInspectionPinned, false);
  assert.equal(h.states.get('back').inspected, false);
  h.fire('focusout', first); assert.equal(h.context.previewSegmentId, null);
  h.fire('focusin', second); h.context.clearSegmentInspection(true); assert.equal(h.context.previewSegmentId, null, 'Escape/day/group selection cleanup');
  h.fire('mouseover', first); h.setMobile(true); assert.equal(h.context.previewSegmentId, null);
  h.fire('mouseover', first); h.fire('focusin', first); assert.equal(h.context.previewSegmentId, null);
  h.fire('click', first); assert.equal(h.openedMap, 1, 'Phone retains tap-to-map');
});

test('leg preview cancels delayed day previews and survives a map loading late', () => {
  const h = legPreviewHarness(journey);
  h.context.setDayPreview(['second'], 'list'); h.context.deferDayPreviewClear('list');
  h.fire('mouseover', h.cards[0]); assert.equal(h.timers.size, 0);
  h.context.clearDayPreview('list'); assert.equal(h.context.previewSegmentId, 'out');
  h.context.mainMapReady = false;
  h.fire('mouseout', h.cards[0]); h.fire('mouseover', h.cards[1]); h.fire('mouseout', h.cards[1]);
  assert.equal(h.context.previewSegmentId, null);
});
