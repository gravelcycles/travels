import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { loadContent } from '../scripts/journey-content.mjs';
import { readOverrides } from '../scripts/build-site.mjs';

const root = new URL('../', import.meta.url).pathname;
const source = fs.readFileSync(new URL('../dist/assets/app.js', import.meta.url), 'utf8');
const names = ['railStopCoordinate', 'dayMapStops', 'addDayStopMarkers', 'revealStopsWithRoutes', 'clearDecorations', 'addSegmentLayer', 'syncViewerMap'];
const functions = names.map(name => {
  const start = source.indexOf(`  function ${name}(`);
  assert.ok(start >= 0, name);
  return source.slice(start, source.indexOf('\n  function ', start + 1));
}).join('\n');
const modeStyles = vm.runInNewContext(`(${source.match(/const modeStyles = (\{[\s\S]*?\n  \});/)[1]})`);
const { data, routes } = loadContent(root);
const overrides = readOverrides(root);
function harness(journey) {
  const coordinates = segment => overrides.routes[segment.id]?.geometry || routes[segment.id] || segment.geometry || [
    [place(segment.from).lng, place(segment.from).lat],
    ...(segment.via || segment.stops || []).map(p => Array.isArray(p) ? [p[1], p[0]] : [p.lng, p.lat]),
    [place(segment.to).lng, place(segment.to).lat]
  ];
  const place = id => journey.places.find(p => p.id === id);
  const segments = d => d.segmentIds.map(id => journey.segments.find(s => s.id === id));
  const context = vm.createContext({ journey, modeStyles,
    segmentsForDay: segments, segmentCoordinates: coordinates, placeById: place
  });
  vm.runInContext(functions, context);
  return context;
}

test('rail stop dots sit on route centerlines and retain names, including duplicate vertices', () => {
  const h = harness(data.journeys[0]);
  const map = {project: ([x,y])=>({x,y}),unproject: p=>({toArray:()=>p})};
  assert.deepEqual([...h.railStopCoordinate(map,{lng:5,lat:2},[[0,0],[0,0],[10,0]])],[5,0]);
  const journey = {places:[{id:'a',name:'Start',lng:0,lat:2},{id:'b',name:'Finish',lng:10,lat:2}],segments:[{id:'test-rail',mode:'train',from:'a',to:'b',geometry:[[0,0],[10,0]],stops:[{name:'Middle',lng:5,lat:2}]}],days:[{segmentIds:['test-rail']}]};
  const markers = [], context = harness(journey);
  context.document = {createElement:()=>({style:{},setAttribute(k,v){this[k]=v;}})};
  context.revealStopsWithRoutes = () => {};
  context.maplibregl = {Marker:class {constructor({element}){this.element=element;}setLngLat(p){this.coordinate=p;return this;}addTo(){markers.push(this);return this;}}};
  context.addDayStopMarkers(map,{markers:[]},journey.days[0]);
  assert.deepEqual(markers.map(m=>[...m.coordinate]),[[0,0],[5,0],[10,0]]);
  assert.equal(markers[1].element['aria-label'],'Rail stop: Middle');
  assert.equal(markers[0].element['aria-label'],'Start: Start');
  assert.equal(markers[2].element['aria-label'],'End: Finish');
  assert.match(markers[0].element.className,/route-endpoint-marker/);
  assert.doesNotMatch(markers[1].element.className,/route-endpoint-marker/);
  assert.match(markers[2].element.className,/route-endpoint-marker/);
  const css = fs.readFileSync(new URL('../dist/assets/styles.css',import.meta.url),'utf8');
  const style = css.match(/\.rail-stop-marker \{([^}]+)\}/)[1];
  const diameter = Number(style.match(/width: ([\d.]+)px/)[1]);
  assert.match(style,/box-sizing: content-box;/, 'White rim sits outside the orange center');
  const rim = Number(style.match(/border: ([\d.]+)px solid #fff/)[1]);
  const lineWidth = modeStyles.train.width + 1.4;
  assert.ok(diameter < lineWidth, 'Orange center stays inside the selected rail line');
  assert.ok(diameter + 2 * rim > lineWidth, 'White rim spans the selected rail line');
  assert.match(style,/box-shadow: none;/);
});

test('real and sample days mark both endpoints of every train leg, including transfers and turnarounds', () => {
  const map = {project: ([x,y])=>({x,y}),unproject: p=>({toArray:()=>p})};
  for (const journey of data.journeys) for (const day of journey.days) {
    const h = harness(journey,day), stops = h.dayMapStops(map,day);
    const segments = h.segmentsForDay(day).filter(segment=>segment.mode==='train'), endpoints = stops.filter(stop=>stop.endpoint);
    if (!segments.length) { assert.equal(stops.length,0); continue; }
    const key = coordinate=>coordinate.map(value=>value.toFixed(7)).join(',');
    const expected = new Set(segments.flatMap(segment=>{const coordinates=h.segmentCoordinates(segment);return [key(coordinates[0]),key(coordinates.at(-1))];}));
    assert.deepEqual(new Set(Array.from(endpoints,stop=>key(stop.coordinate))),expected,day.id);
  }
});

test('a shared transfer remains large and intermediate stops cannot downgrade another leg’s endpoint', () => {
  const journey = {places:[{id:'a',name:'A',lng:0,lat:0},{id:'b',name:'B',lng:10,lat:0},{id:'c',name:'C',lng:0,lat:10}],segments:[
    {id:'out',mode:'train',from:'a',to:'b',geometry:[[0,0],[10,0]],stops:[{name:'Middle',lng:5,lat:0}]},
    {id:'back-through',mode:'train',from:'b',to:'c',geometry:[[10,0],[0,0],[0,10]],stops:[{name:'A',lng:0,lat:0}]}
  ],days:[{segmentIds:['out','back-through']}]};
  const h = harness(journey), map = {project: ([x,y])=>({x,y}),unproject: p=>({toArray:()=>p})};
  const stops = h.dayMapStops(map,journey.days[0]);
  assert.equal(stops.length,4);
  assert.equal(stops.find(stop=>stop.name==='A').endpoint,'Start');
  assert.equal(stops.find(stop=>stop.name==='B').endpoint,'Start and end');
  assert.equal(stops.find(stop=>stop.name==='C').endpoint,'End');
  assert.equal(stops.find(stop=>stop.name==='Middle').endpoint,undefined);
});

function renderFixture(journey, prefix = 'main') {
  const context = harness(journey), listeners = new Map(), sources = new Map(), layers = new Map(), markers = [];
  const decorations = {markers:[],sourceIds:[],layerIds:[],hitLayerIds:[]};
  const map = {
    rendered:new Set(), project:([x,y])=>({x,y}),unproject:p=>({toArray:()=>p}),
    getStyle:()=>({layers:[]}),addSource:(id,data)=>sources.set(id,{...data,loaded:false}),getSource:id=>sources.get(id),removeSource:id=>sources.delete(id),
    addLayer:layer=>layers.set(layer.id,layer),getLayer:id=>layers.get(id),removeLayer:id=>layers.delete(id),isSourceLoaded:id=>sources.get(id)?.loaded,
    on(event,fn){if(!listeners.has(event))listeners.set(event,new Set());listeners.get(event).add(fn);},
    off(event,fn){listeners.get(event)?.delete(fn);},triggerRepaint(){},
    emit(event){for(const fn of [...(listeners.get(event)||[])])fn();},
    queryRenderedFeatures:({layers:ids})=>ids.filter(id=>map.rendered.has(id)).map(id=>({layer:{id}}))
  };
  context.palette = {casing:'#fff',route:'#0072b2'};
  context.document = {createElement:()=>({style:{},setAttribute(k,v){this[k]=v;}})};
  context.maplibregl = {Marker:class {constructor({element}){this.element=element;}setLngLat(p){this.coordinate=p;return this;}addTo(){markers.push(this);return this;}remove(){this.removed=true;}}};
  const draw = day => {
    for(const segment of journey.segments)context.addSegmentLayer(map,decorations,segment,{prefix,selected:day.segmentIds.includes(segment.id),opacity:1});
    context.addDayStopMarkers(map,decorations,day);
  };
  const trainRoutes = day=>decorations.routeLayers.filter(route=>day.segmentIds.includes(route.segmentId)&&journey.segments.find(s=>s.id===route.segmentId).mode==='train');
  return {context,map,decorations,markers,listeners,sources,draw,trainRoutes};
}

test('real and sample stop dots wait for a rendered train frame on both journey and photo maps', () => {
  for(const journey of data.journeys)for(const prefix of ['main','viewer']) {
    const day = [...journey.days].sort((a,b)=>b.segmentIds.length-a.segmentIds.length)[0];
    const f = renderFixture(journey,prefix); f.draw(day);
    if(!f.markers.length){assert.equal(f.listeners.get('render')?.size||0,0);continue;}
    const hidden = ()=>f.markers.every(marker=>marker.element.style.visibility==='hidden');
    assert.ok(hidden(),'No flash when DOM markers are added');
    f.map.emit('render'); assert.ok(hidden(),'A basemap frame does not reveal markers');
    const routes = f.trainRoutes(day);
    for(const route of routes)f.sources.get(route.sourceId).loaded=true;
    assert.ok(hidden(),'Source readiness does not reveal markers before a render');
    f.map.emit('render'); assert.ok(hidden(),'Offscreen/unrendered train lines keep their dots hidden');
    for(const route of routes)f.map.rendered.add(route.lineId);
    f.sources.get(routes[0].sourceId).loaded=false;
    f.map.emit('render'); assert.ok(hidden(),'Partial/stale tiles cannot reveal dots while a train source is loading');
    f.sources.get(routes[0].sourceId).loaded=true;
    f.map.emit('render');
    assert.ok(f.markers.every(marker=>marker.element.style.visibility===''),'Dots appear with the rendered train lines');
    assert.equal(f.listeners.get('render').size,0,'The completed reveal leaves no per-frame listener');
    assert.equal(f.listeners.get('remove').size,0);
  }
});

test('rapid day switches cancel old reveals even when route source IDs are reused', () => {
  const journey = data.journeys.find(journey=>journey.segments.some(segment=>segment.mode==='train'));
  const day = journey.days.find(day=>day.segmentIds.some(id=>journey.segments.find(segment=>segment.id===id).mode==='train'));
  const f = renderFixture(journey); f.draw(day);
  const staleReveal = [...f.listeners.get('render')][0], oldMarkers = [...f.markers];
  f.context.clearDecorations(f.map,f.decorations);
  assert.equal(f.listeners.get('render').size,0); assert.ok(oldMarkers.every(marker=>marker.removed));
  f.draw(day);
  for(const route of f.trainRoutes(day)){f.sources.get(route.sourceId).loaded=true;f.map.rendered.add(route.lineId);}
  staleReveal();
  assert.ok(oldMarkers.every(marker=>marker.element.style.visibility==='hidden'));
  assert.ok(f.markers.filter(marker=>!marker.removed).every(marker=>marker.element.style.visibility==='hidden'));
  f.map.emit('render');
  assert.ok(f.markers.filter(marker=>!marker.removed).every(marker=>marker.element.style.visibility===''));
});

test('removing a map cancels its pending reveal', () => {
  const journey = data.journeys.find(journey=>journey.segments.some(segment=>segment.mode==='train'));
  const day = journey.days.find(day=>day.segmentIds.some(id=>journey.segments.find(segment=>segment.id===id).mode==='train'));
  const f = renderFixture(journey); f.draw(day); f.map.emit('remove');
  assert.equal(f.listeners.get('render').size,0); assert.equal(f.listeners.get('remove').size,0);
  assert.equal(f.decorations.cancelStopReveal,null);
});

test('a changed selection cancels a pending reveal before the next route redraw is ready', () => {
  const journey = data.journeys.find(journey=>journey.segments.some(segment=>segment.mode==='train'));
  const day = journey.days.find(day=>day.segmentIds.some(id=>journey.segments.find(segment=>segment.id===id).mode==='train'));
  const f = renderFixture(journey); f.draw(day);
  const elements = f.markers.map(marker=>marker.element);
  let currentDayId = day.id;
  f.context.revealStopsWithRoutes(f.map,f.decorations,day,elements,candidate=>candidate.id===currentDayId);
  currentDayId='another-day';
  f.map.emit('render');
  assert.equal(f.listeners.get('render').size,0,'Cancel even if the next redraw is still waiting for style readiness');
  assert.ok(elements.every(element=>element.style.visibility==='hidden'));
});

test('reopening the photo map or returning to a cancelled day cannot leave cached dots hidden', () => {
  const journey = data.journeys.find(journey=>journey.segments.some(segment=>segment.mode==='train'));
  const day = journey.days.find(day=>day.segmentIds.some(id=>journey.segments.find(segment=>segment.id===id).mode==='train'));
  const f = renderFixture(journey,'viewer');
  let currentDay = day;
  Object.assign(f.context,{viewerMap:f.map,viewerDecorations:f.decorations,viewerMapReady:true,viewerRouteKey:null,
    viewerPhotoIndex:0,viewerCameraPhoto:null,viewerPhotoMarkers:[],viewerTransition:null,window:{},photoDialog:{open:true},
    viewerDay:()=>currentDay,photosForDay:()=>[],dayCoordinates:()=>[],mapIsReady:()=>true});
  f.context.syncViewerMap();
  f.context.photoDialog.open=false;
  for(const route of f.trainRoutes(day)){f.sources.get(route.sourceId).loaded=true;f.map.rendered.add(route.lineId);}
  f.map.emit('render');
  f.context.photoDialog.open=true; f.context.syncViewerMap();
  assert.ok(f.decorations.markers.every(marker=>marker.element.style.visibility===''),'Closing does not invalidate the cached day');

  f.context.clearDecorations(f.map,f.decorations); f.context.viewerRouteKey=null;
  f.context.syncViewerMap();
  const oldMarkers = [...f.decorations.markers];
  currentDay=journey.days.find(candidate=>candidate.id!==day.id);
  f.map.emit('render');
  assert.equal(f.context.viewerRouteKey,null,'A cancelled day is no longer cached');
  currentDay=day; f.context.syncViewerMap();
  assert.ok(oldMarkers.every(marker=>marker.removed));
  for(const route of f.trainRoutes(day)){f.sources.get(route.sourceId).loaded=true;f.map.rendered.add(route.lineId);}
  f.map.emit('render');
  assert.ok(f.decorations.markers.every(marker=>marker.element.style.visibility===''),'Returning rebuilds and reveals the day');
});
