import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { loadContent } from '../scripts/journey-content.mjs';
import { readOverrides } from '../scripts/build-site.mjs';

const root = new URL('../', import.meta.url).pathname;
const source = fs.readFileSync(new URL('../dist/assets/app.js', import.meta.url), 'utf8');
const names = ['railStopCoordinate', 'dayMapStops', 'addDayStopMarkers'];
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
  context.document = {createElement:()=>({setAttribute(k,v){this[k]=v;}})};
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
  const rim = Number(style.match(/border: ([\d.]+)px solid #fff/)[1]);
  assert.ok(Math.abs(diameter - (modeStyles.train.width + 1.4)) < 1e-9, 'White rim spans the selected rail line');
  assert.equal(diameter - 2 * rim,4, 'Orange center stays small');
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
