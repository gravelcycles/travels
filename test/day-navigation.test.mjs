import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import '../dist/assets/media-utils.js';

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
    window: {}, mediaUtils:globalThis.JOURNEY_ATLAS_MEDIA, videoPlayer:{stop(){},show(){}},
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

test('the same day viewer switches photo to video and back without sending video bytes to the image loader', () => {
  const context = selection(), calls = [];
  const media = globalThis.JOURNEY_ATLAS_MEDIA.items({photos:[{id:'photo',alt:'A photograph'}],videos:[{id:'clip',title:'A clip',src:'https://example.com/clip.mp4'}]});
  context.photosForDay = () => media;
  context.window.JOURNEY_ATLAS_UTILS = {photoCaption:item => item.caption || item.alt};
  context.sizeViewerBackdrop = () => {};
  context.setPublicFullImage = (_image,item) => calls.push(['image',item.id]);
  context.videoPlayer = {stop:()=>calls.push(['stop']),show:item=>calls.push(['video',item.id])};
  context.updateViewer();
  assert.equal(context.$('#modal-photo').hidden,false);
  context.viewerPhotoIndex = 1; context.updateViewer();
  assert.equal(context.$('#modal-photo').hidden,true);
  assert.equal(context.$('.photo-viewer').dataset.mediaType,'video');
  assert.equal(context.$('#modal-progress').textContent,'VIDEO 2 OF 2');
  assert.equal(context.$('#viewer-media-title').textContent,'A clip');
  context.viewerPhotoIndex = 0; context.updateViewer();
  assert.equal(context.$('#modal-photo').hidden,false);
  assert.equal(context.$('#viewer-media-title').hidden,true);
  assert.deepEqual(calls,[['stop'],['image','photo'],['video','clip'],['stop'],['image','photo']]);
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
  const context=vm.createContext({viewerPhotoIndex:0,mediaUtils:globalThis.JOURNEY_ATLAS_MEDIA,escapeHtml:value=>value,photoImageMarkup:()=>'<img>',prepareProgressiveImages(){prepares++;},$:selector=>selector==='#viewer-filmstrip'?strip:buttons.find(b=>b.classList.active)});
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
 const context=vm.createContext({window:{},mediaUtils:globalThis.JOURNEY_ATLAS_MEDIA,viewerMapReady:true,photoDialog:{open:true},viewerMap:{},mapIsReady:()=>true,viewerDay:()=>day,
  viewerPhotoIndex:0,photosForDay:()=>[{id:'one'},{id:'two'}],viewerCameraPhoto:null,viewerTransition:{cancel(){}},viewerPhotoMarkers:[],viewerRouteKey:null,viewerDecorations:{},
  journey:{id:'trip',segments:[{id:'a'},{id:'b'}]},dayCoordinates:()=>[],
  clearDecorations:()=>calls.push('clear'),addSegmentLayer:()=>calls.push('route'),addDayStopMarkers:()=>calls.push('stops')});
 vm.runInContext(functionSource('syncViewerMap'),context);vm.runInContext('syncViewerMap()',context);
 assert.deepEqual(calls,['clear','route','route','stops']);context.viewerPhotoIndex=1;vm.runInContext('syncViewerMap()',context);assert.equal(calls.length,4);
 day={id:'d2',segmentIds:['b']};vm.runInContext('syncViewerMap()',context);assert.deepEqual(calls.slice(4),['clear','route','route','stops']);
});

test('a collapsed mobile location panel does not schedule hidden viewer map work',()=>{
  const context=vm.createContext({viewerMapReady:true,photoDialog:{open:true},window:{JOURNEY_ATLAS_MOBILE_UI:{enabled:()=>true,locationVisible:()=>false}}});
  vm.runInContext(functionSource('syncViewerMap'),context);
  assert.doesNotThrow(()=>vm.runInContext('syncViewerMap()',context),'hidden maps must return before checking readiness or scheduling retries');
});

test('choosing a day clears an existing route detail, including when choosing the same day again', () => {
  for (const selected of ['d1', 'd2']) {
    const context = selection();
    context.journey.days[0].segmentIds = ['leg'];
    context.inspectedSegmentId = 'leg';
    context.routeInspectionPinned = true;
    context.setInspectedFeatureState = () => {};
    context.syncInspectionClasses = () => {};
    vm.runInContext(functionSource('clearSegmentInspection'), context);
    context.setActiveDay(selected, true);
    assert.equal(context.inspectedSegmentId, null, selected);
    assert.equal(context.routeInspectionPinned, false, selected);
    assert.equal(context.$('#route-inspector').hidden, true, selected);
  }
});

test('mobile and touch map hover cannot open route details; route taps select their day', () => {
  for (const [mobile, hover, shouldPreview] of [[true, true, false], [true, false, false], [false, false, false], [false, true, true]]) {
    const context = selection(), events = new Map(), calls = [], canvas = {style:{}};
    Object.assign(context, {
      mainMapReady: true,
      window: {maplibregl: {}, matchMedia: query => ({matches: query.includes('900px') ? mobile : hover})},
      createMap: () => ({on: (name, handler) => events.set(name, handler), getCanvas: () => canvas}),
      routeFeatureAtPoint: () => ({properties:{segmentId:'leg'}}),
      dayForSegment: () => context.journey.days[0],
      inspectSegment: (id, pinned = false) => calls.push({id, pinned})
    });
    vm.runInContext(functionSource('routeHoverEnabled') + '\n' + functionSource('initMainMap'), context);
    context.initMainMap();
    events.get('mousemove')({point:{x:10,y:20}});
    assert.equal(calls.length, Number(shouldPreview), `mobile=${mobile}, hover=${hover}`);
    calls.length = 0;
    events.get('click')({point:{x:10,y:20}});
    assert.deepEqual(calls, [{id:'leg',pinned:true}]);
  }
});


test('route inspection is suppressed on phones while desktop retains its tooltip',()=>{
  for(const mobile of [true,false]) {
    const nodes=new Map(), $=id=>{if(!nodes.has(id))nodes.set(id,{hidden:true});return nodes.get(id);};
    const context=vm.createContext({$,window:{matchMedia:()=>({matches:mobile})},
      segmentById:()=>({from:'a',to:'b',mode:'train'}),dayForSegment:()=>({number:1}),
      placeById:id=>({name:id}),labels:{train:'Train'},conciseDayStory:()=> 'Day story',
      routeInspectionPinned:false,inspectedSegmentId:null,setInspectedFeatureState(){},syncInspectionClasses(){},
      clearSegmentInspection(){ $('#route-inspector').hidden=true; }
    });
    vm.runInContext(functionSource('inspectSegment'),context);context.inspectSegment('leg',true);
    assert.equal($('#route-inspector').hidden,mobile);
    assert.equal(context.routeInspectionPinned,!mobile);
  }
});
