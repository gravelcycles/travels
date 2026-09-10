import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { loadContent } from '../scripts/journey-content.mjs';
import { readOverrides } from '../scripts/build-site.mjs';

const root = new URL('../', import.meta.url).pathname;
const source = fs.readFileSync(new URL('../dist/assets/app.js', import.meta.url), 'utf8');
const names = ['dayMarkerPlace', 'groupedDayMarkers', 'markerLabel', 'markerBox', 'boxesOverlap', 'markerRouteObstacles', 'routeCrossesMarkerBox', 'markerOffsetFor', 'applyDayMarkerOffset', 'railStopCoordinate', 'addRailStopMarkers'];
const functions = names.map(name => {
  const start = source.indexOf(`  function ${name}(`);
  assert.ok(start >= 0, name);
  return source.slice(start, source.indexOf('\n  function ', start + 1));
}).join('\n');
const modeStyles = vm.runInNewContext(`(${source.match(/const modeStyles = (\{[\s\S]*?\n  \});/)[1]})`);
const { data, routes } = loadContent(root);
const overrides = readOverrides(root);
function harness(journey, day = journey.days[0], width = 850, height = 650) {
  const coordinates = segment => overrides.routes[segment.id]?.geometry || routes[segment.id] || segment.geometry || [
    [place(segment.from).lng, place(segment.from).lat],
    ...(segment.via || segment.stops || []).map(p => Array.isArray(p) ? [p[1], p[0]] : [p.lng, p.lat]),
    [place(segment.to).lng, place(segment.to).lat]
  ];
  const place = id => journey.places.find(p => p.id === id);
  const segments = d => d.segmentIds.map(id => journey.segments.find(s => s.id === id));
  const mercator = ([lng, lat]) => ({ x: lng, y: -Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) * 180 / Math.PI });
  const focus = segments(day).flatMap(coordinates);
  if (!focus.length && place(day.destinationId || day.placeId)) {
    const p = place(day.destinationId || day.placeId); focus.push([p.lng, p.lat]);
  }
  const points = (focus.length ? focus : [[0, 0]]).map(mercator);
  const minX = Math.min(...points.map(p => p.x)), maxX = Math.max(...points.map(p => p.x));
  const minY = Math.min(...points.map(p => p.y)), maxY = Math.max(...points.map(p => p.y));
  const scale = Math.min((width - 100) / Math.max(0.001, maxX - minX), (height - 200) / Math.max(0.001, maxY - minY));
  const project = coordinate => {
    const p = mercator(coordinate);
    return { x: width / 2 + (p.x - (minX + maxX) / 2) * scale, y: (height - 70) / 2 + (p.y - (minY + maxY) / 2) * scale };
  };
  const context = vm.createContext({ journey, modeStyles, activeDay: () => day, destinationForDay: d => place(d.destinationId || d.placeId),
    segmentsForDay: segments, segmentCoordinates: coordinates, placeById: place,
    mainMap: { project, getZoom: () => width < 500 ? 6 : 10, getCanvas: () => ({clientWidth: width, clientHeight: height, getBoundingClientRect: () => ({bottom: height})}), getStyle: () => ({layers: []}) },
    $: () => ({getBoundingClientRect: () => ({top: height - 64})})
  });
  vm.runInContext(functions, context);
  return context;
}

test('day bubbles clear complete route strokes on every real and sample day at desktop and phone sizes', () => {
  for (const journey of data.journeys) for (const day of journey.days) for (const [width, height] of [[850,650], [390,560]]) {
    const h = harness(journey, day, width, height), place = h.dayMarkerPlace(day);
    if (!place) continue;
    const obstacles = h.markerRouteObstacles(), boxes = [];
    h.markerOffsetFor(place, h.markerLabel([day]), boxes, obstacles);
    assert.ok(!obstacles.some(route => h.routeCrossesMarkerBox(route, boxes[0])), `${journey.id}: ${day.id} at ${width}px overlaps a route`);
    assert.ok(boxes[0].left >= 8 && boxes[0].right <= width - 8 && boxes[0].top >= 60 && boxes[0].bottom <= height - 76, `${day.id} remains visible`);
  }
});

test('sparse straight and zero-length route segments cannot pass through a bubble or its halo', () => {
  const h = harness(data.journeys[0]);
  const box = {left: 90, right: 110, top: 90, bottom: 110};
  assert.equal(h.routeCrossesMarkerBox({start:{x:0,y:100},end:{x:200,y:100},padding:5},box),true);
  assert.equal(h.routeCrossesMarkerBox({start:{x:0,y:84},end:{x:200,y:84},padding:5},box),false);
  assert.equal(h.routeCrossesMarkerBox({start:{x:100,y:100},end:{x:100,y:100},padding:5},box),true);
});

test('bubbles attach to reviewed arrival vertices, with rest-day and empty-day fallbacks', () => {
  const journey = {places:[{id:'start',lng:0,lat:0},{id:'end',lng:1,lat:1}],segments:[{id:'leg',from:'start',to:'end',geometry:[[0.1,0.1],[0.9,0.9]]}],days:[{segmentIds:['leg'],placeId:'end'},{segmentIds:[],placeId:'start'},{segmentIds:[]}]};
  const h = harness(journey);
  assert.equal(h.dayMarkerPlace(journey.days[0]).lng,0.9);
  assert.equal(h.dayMarkerPlace(journey.days[1]).lng,0);
  assert.equal(h.dayMarkerPlace(journey.days[2]),null);
  for (const offset of [[0,-42],[60,30],[-80,-40]]) {
    const style = {}, entry = {marker:{setOffset(){}},element:{style:{setProperty(k,v){style[k]=v;}},classList:{toggle(){}}}};
    h.applyDayMarkerOffset(entry,{offset,compact:false});
    const length = parseFloat(style['--leader-length']), angle = parseFloat(style['--leader-angle']) * Math.PI / 180;
    assert.ok(Math.abs(offset[0] + Math.cos(angle)*length) < 1e-9);
    assert.ok(Math.abs(offset[1] + Math.sin(angle)*length) < 1e-9);
  }
});

test('repeat stays remain one overview bubble and use the active day’s mapped arrival', () => {
  const journey = {places:[{id:'home',lng:1,lat:1}],segments:[{id:'trip',from:'home',to:'home',geometry:[[1,1],[1.01,1.01]]}],days:[{id:'rest',segmentIds:[],placeId:'home'},{id:'travel',segmentIds:['trip'],placeId:'home'}]};
  const h = harness(journey,journey.days[1]), groups = h.groupedDayMarkers();
  assert.equal(groups.length,1); assert.equal(groups[0].days.length,2);
  assert.equal(groups[0].place.lng,1.01);
});

test('rail stop dots sit on route centerlines and retain names, including duplicate vertices', () => {
  const h = harness(data.journeys[0]);
  const map = {project: ([x,y])=>({x,y}),unproject: p=>({toArray:()=>p})};
  assert.deepEqual([...h.railStopCoordinate(map,{lng:5,lat:2},[[0,0],[0,0],[10,0]])],[5,0]);
  const journey = {places:[{id:'a',name:'Start',lng:0,lat:2},{id:'b',name:'Finish',lng:10,lat:2}],segments:[{id:'test-rail',mode:'train',from:'a',to:'b',geometry:[[0,0],[10,0]],stops:[{name:'Middle',lng:5,lat:2}]}],days:[{segmentIds:['test-rail']}]};
  const markers = [], context = harness(journey);
  context.document = {createElement:()=>({setAttribute(k,v){this[k]=v;}})};
  context.maplibregl = {Marker:class {constructor({element}){this.element=element;}setLngLat(p){this.coordinate=p;return this;}addTo(){markers.push(this);return this;}}};
  context.addRailStopMarkers(map,{markers:[]},journey.days[0]);
  assert.deepEqual(markers.map(m=>[...m.coordinate]),[[0,0],[5,0],[10,0]]);
  assert.equal(markers[1].element['aria-label'],'Rail stop: Middle');
  const css = fs.readFileSync(new URL('../dist/assets/styles.css',import.meta.url),'utf8');
  const style = css.match(/\.rail-stop-marker \{([^}]+)\}/)[1];
  const diameter = Number(style.match(/width: (\d+)px/)[1]);
  assert.ok(diameter < modeStyles.train.width);
  assert.match(style,/border: 0;/);assert.match(style,/box-shadow: none;/);
});
