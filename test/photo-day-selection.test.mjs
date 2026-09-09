import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../dist/assets/app.js', import.meta.url), 'utf8');
function functionSource(name) {
  const start = source.indexOf(`  function ${name}(`);
  const end = source.indexOf('\n  function ', start + 1);
  return source.slice(start, end);
}
function selection() {
  const nodes = new Map();
  const getNode = selector => {
    if (!nodes.has(selector)) nodes.set(selector, { dataset: {}, classList: { toggle() {} }, offsetParent: null, setAttribute() {}, removeAttribute() {} });
    return nodes.get(selector);
  };
  const days = [{ id: 'd1', number: 1, segmentIds: [] }, { id: 'd2', number: 2, segmentIds: [] }];
  const context = vm.createContext({
    activeDayId: 'd1', photoLandmarkDayId: null, mapScope: 'journey', inspectedSegmentId: null,
    viewerPhotoIndex: 0, viewerMapReady: false, pendingMapAction: null,
    journey: { days }, $: getNode, dayById: id => days.find(day => day.id === id), viewerDay: () => days[1],
    photosForDay: () => [], routeLabel: () => '', escapeHtml: value => value || '',
    renderDays() {}, renderStory() {}, drawMainMap() {}, renderViewerFilmstrip() {}, clearSegmentInspection() {}
  });
  vm.runInContext(`${functionSource('setActiveDay')}\n${functionSource('updateViewer')}`, context);
  return context;
}

test('selecting a day leaves overview photo scope even when the mobile map is hidden', () => {
  const context = selection();
  vm.runInContext('setActiveDay("d2", true)', context);
  assert.equal(context.activeDayId, 'd2');
  assert.equal(context.photoLandmarkDayId, 'd2');
  assert.equal(context.mapScope, 'day');
});

test('a day selected without a camera fit still filters its photo landmarks', () => {
  const context = selection();
  vm.runInContext('setActiveDay("d2", false)', context);
  assert.equal(context.photoLandmarkDayId, 'd2');
  assert.equal(context.mapScope, 'day');
});

test('opening or changing a viewer day replaces the all-days landmark scope', () => {
  const context = selection();
  vm.runInContext('updateViewer()', context);
  assert.equal(context.activeDayId, 'd2');
  assert.equal(context.photoLandmarkDayId, 'd2');
  assert.equal(context.mapScope, 'day');
});

test('day changes refresh photo landmarks immediately while route/style loading is incomplete', () => {
  const context = selection();
  const scopes = [];
  Object.assign(context, {
    mainMapReady: true, mainMap: {}, mapIsReady: () => false, renderLegend() {},
    refreshPhotoLandmarks() { scopes.push(context.photoLandmarkDayId); },
    window: { setTimeout() {} }
  });
  vm.runInContext(functionSource('drawMainMap'), context);
  vm.runInContext('setActiveDay("d2", false)', context);
  assert.deepEqual(scopes, ['d2']);
});

test('returning to the mobile map positions day controls and frames the selected day after resize', () => {
  const context = selection();
  const calls = [];
  Object.assign(context, {
    mapScope: 'day', activeDayId: 'd2', pendingMapAction: null,
    mainMap: { resize() { calls.push('resize'); } },
    document: { querySelectorAll: () => [] },
    window: { setTimeout: fn => fn() },
    renderDayNavigator() { calls.push('controls'); },
    activeDay: () => ({ id: context.activeDayId }),
    focusDay(day) { calls.push(day.id); }
  });
  vm.runInContext(functionSource('setMobileTab'), context);
  vm.runInContext('setMobileTab("map")', context);
  assert.deepEqual(calls, ['resize', 'controls', 'd2']);
});
