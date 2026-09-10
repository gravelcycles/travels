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
    if (!nodes.has(selector)) nodes.set(selector, { dataset: {}, style: { setProperty() {} }, closest: getNode, classList: { toggle() {}, remove() {} }, offsetParent: null, setAttribute() {}, removeAttribute() {} });
    return nodes.get(selector);
  };
  const days = [{ id: 'd1', number: 1, segmentIds: [] }, { id: 'd2', number: 2, segmentIds: [] }];
  const context = vm.createContext({
    window: {},
    activeDayId: 'd1', mapScope: 'journey', inspectedSegmentId: null,
    viewerPhotoIndex: 0, viewerMapReady: false, pendingMapAction: null,
    journey: { days, segments: [] }, $: getNode, dayById: id => days.find(day => day.id === id), viewerDay: () => days[1],
    photosForDay: () => [], routeLabel: () => '', escapeHtml: value => value || '',
    refreshPreloads() {}, renderDays() {}, renderStory() {}, drawMainMap() {}, renderViewerFilmstrip() {}, clearSegmentInspection() {}
  });
  vm.runInContext(`${functionSource('setActiveDay')}\n${functionSource('updateViewer')}`, context);
  return context;
}

test('selecting a day leaves overview scope even when the mobile map is hidden', () => {
  const context = selection();
  vm.runInContext('setActiveDay("d2", true)', context);
  assert.equal(context.activeDayId, 'd2');
  assert.equal(context.mapScope, 'day');
});

test('a day selected without a camera fit still updates the route scope', () => {
  const context = selection();
  vm.runInContext('setActiveDay("d2", false)', context);
  assert.equal(context.mapScope, 'day');
});

test('opening or changing a viewer day updates the atlas day and route scope', () => {
  const context = selection();
  vm.runInContext('updateViewer()', context);
  assert.equal(context.activeDayId, 'd2');
  assert.equal(context.mapScope, 'day');
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

test('Fit route returns to journey scope and fits the route', () => {
  const context = selection(), calls = [];
  Object.assign(context, { mapScope: 'day', drawMainMap: () => calls.push('draw'), fitJourneyBounds: () => calls.push('fit') });
  vm.runInContext(functionSource('fitRoute'), context);
  vm.runInContext('fitRoute()', context);
  assert.equal(context.mapScope, 'journey');
  assert.deepEqual(calls, ['draw', 'fit']);
});

test('Fit route bounds use routes and journey places, excluding distant photo pins', () => {
  const context=vm.createContext({journey:{segments:[{geometry:[[8,47],[9,46]]}],places:[{lng:8,lat:47}],photos:[{lng:-80,lat:20}]},segmentCoordinates:s=>s.geometry});
  vm.runInContext(functionSource('journeyCoordinates'),context);
  assert.deepEqual(JSON.parse(JSON.stringify(vm.runInContext('journeyCoordinates()',context))),[[8,47],[9,46],[8,47]]);
});

test('selecting another viewer photo preserves thumbnail elements and updates selection only', () => {
  let builds=0,prepares=0,buttons=[];
  const strip={dataset:{},querySelectorAll:()=>buttons,set innerHTML(html){builds++;buttons=[...html.matchAll(/data-viewer-index="(\d+)"/g)].map(m=>({dataset:{viewerIndex:m[1]},selected:false,classList:{toggle(name,value){this.active=value;}},setAttribute(name,value){this[name]=value;},scrollIntoView(){}}));}};
  const context=vm.createContext({viewerPhotoIndex:0,photoImageMarkup:()=>'<img>',prepareProgressiveImages(){prepares++;},$:selector=>selector==='#viewer-filmstrip'?strip:buttons.find(b=>b.classList.active)});
  vm.runInContext(functionSource('renderViewerFilmstrip'),context);
  const photos=[{id:'one'},{id:'two'},{id:'three'}];context.photos=photos;
  vm.runInContext('renderViewerFilmstrip(photos)',context);const original=[...buttons];
  context.viewerPhotoIndex=2;vm.runInContext('renderViewerFilmstrip(photos)',context);
  assert.equal(builds,1);assert.equal(prepares,1);assert.deepEqual(buttons,original);
  assert.equal(buttons[0]['aria-pressed'],'false');assert.equal(buttons[2]['aria-pressed'],'true');
  context.photos=[{id:'different-day'}];vm.runInContext('renderViewerFilmstrip(photos)',context);
  assert.equal(builds,2);assert.equal(prepares,2);assert.equal(buttons.length,1);
});

test('same-day viewer navigation does not rebuild background photos or redraw the main map', () => {
  const context=selection(),calls=[];
  Object.assign(context,{activeDayId:'d2',mapScope:'day',renderDays:()=>calls.push('days'),renderStory:()=>calls.push('photos'),drawMainMap:()=>calls.push('map')});
  vm.runInContext('updateViewer()',context);assert.deepEqual(calls,[]);
});
test('viewer route layers are reused within a day and rebuilt when the day changes',()=>{
 const calls=[];let day={id:'d1',segmentIds:['a']};
 const context=vm.createContext({window:{},viewerMapReady:true,photoDialog:{open:true},viewerMap:{},mapIsReady:()=>true,viewerDay:()=>day,
  viewerPhotoIndex:0,photosForDay:()=>[{id:'one'},{id:'two'}],viewerCameraPhoto:null,viewerTransition:{cancel(){}},viewerPhotoMarkers:[],viewerRouteKey:null,viewerDecorations:{},
  journey:{id:'trip',segments:[{id:'a'},{id:'b'}]},dayCoordinates:()=>[],
  clearDecorations:()=>calls.push('clear'),addSegmentLayer:()=>calls.push('route'),addRailStopMarkers:()=>calls.push('stops')});
 vm.runInContext(functionSource('syncViewerMap'),context);vm.runInContext('syncViewerMap()',context);
 assert.deepEqual(calls,['clear','route','route','stops']);context.viewerPhotoIndex=1;vm.runInContext('syncViewerMap()',context);assert.equal(calls.length,4);
 day={id:'d2',segmentIds:['b']};vm.runInContext('syncViewerMap()',context);assert.deepEqual(calls.slice(4),['clear','route','route','stops']);
});

test('a collapsed mobile location panel does not schedule hidden viewer map work',()=>{
  const context=vm.createContext({viewerMapReady:true,photoDialog:{open:true},window:{JOURNEY_ATLAS_MOBILE_UI:{enabled:()=>true,locationVisible:()=>false}}});
  vm.runInContext(functionSource('syncViewerMap'),context);
  assert.doesNotThrow(()=>vm.runInContext('syncViewerMap()',context),'hidden maps must return before checking readiness or scheduling retries');
});
