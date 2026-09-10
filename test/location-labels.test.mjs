import test from 'node:test';
import assert from 'node:assert/strict';
import { loadContent } from '../scripts/journey-content.mjs';
import { readOverrides } from '../scripts/build-site.mjs';
import '../dist/assets/location-labels.js';
const { groupsForJourney, dayText, overlaps, crossesRoute, placeLabel } = globalThis.JOURNEY_ATLAS_LOCATION_LABELS;
const { data, routes } = loadContent(new URL('../', import.meta.url).pathname);
const overrides = readOverrides(new URL('../', import.meta.url).pathname);
function helpers(journey) {
  const place = id => journey.places.find(p => p.id === id);
  return { destinationForDay: day => place(day.destinationId || day.placeId),
    segmentsForDay: day => day.segmentIds.map(id => journey.segments.find(s => s.id === id)),
    segmentCoordinates: segment => overrides.routes[segment.id]?.geometry || routes[segment.id] || segment.geometry || [
      [place(segment.from).lng, place(segment.from).lat], ...(segment.via || segment.stops || []).map(p => Array.isArray(p) ? [p[1],p[0]] : [p.lng,p.lat]), [place(segment.to).lng, place(segment.to).lat]] };
}

test('all real and sample destination labels preserve day membership and reviewed arrival points', () => {
  for (const journey of data.journeys) {
    const h = helpers(journey);
    for (const day of journey.days) {
      const focused = groupsForJourney(journey, h, day.id, 'day');
      assert.ok(focused.every(group => group.days.length === 1 && group.days[0].id === day.id));
      for (const group of focused) {
        const arrival = h.segmentsForDay(day).filter(segment => segment.to === group.key).at(-1);
        if (arrival) assert.deepEqual(group.coordinate, h.segmentCoordinates(arrival).at(-1));
      }
      const overview = groupsForJourney(journey, h, day.id, 'journey');
      assert.equal(new Set(overview.map(group => group.key)).size, overview.length);
      assert.ok(overview.filter(group => group.selected).every(group => group.days.some(d => d.id === day.id)));
      if (h.destinationForDay(day)) assert.ok(overview.some(group => group.days.includes(day)));
    }
  }
});

test('full and compact labels avoid complete route strokes at desktop and phone sizes for every day', () => {
  for (const journey of data.journeys) for (const day of journey.days) for (const [width, height, labelHeight] of [[850,650,32],[390,480,44],[320,300,44]]) {
    const h = helpers(journey), groups = groupsForJourney(journey,h,day.id,'day');
    const coordinates = h.segmentsForDay(day).flatMap(h.segmentCoordinates);
    if (!coordinates.length) coordinates.push(...groups.map(group => group.coordinate));
    if (!coordinates.length) continue;
    const minX = Math.min(...coordinates.map(c=>c[0])), maxX = Math.max(...coordinates.map(c=>c[0]));
    const minY = Math.min(...coordinates.map(c=>c[1])), maxY = Math.max(...coordinates.map(c=>c[1]));
    const scale = Math.min((width-120)/Math.max(.001,maxX-minX),(height-160)/Math.max(.001,maxY-minY));
    const project = ([x,y]) => ({x:width/2+(x-(minX+maxX)/2)*scale,y:height/2-(y-(minY+maxY)/2)*scale});
    const segments = journey.segments.flatMap(segment => {
      const points = h.segmentCoordinates(segment).map(project);
      return points.slice(1).map((end,index)=>({start:points[index],end,padding:9}));
    });
    const occupied = [];
    for (const group of groups) {
      const placement = placeLabel(project(group.coordinate), [{width:Math.min(width<500?164:200,60+group.name.length*7),height:labelHeight,compact:false},{width:60,height:labelHeight,compact:true}], {
        bounds:{left:8,right:width-8,top:8,bottom:height-8}, occupied,routes:segments });
      // A label can be culled in a dense area, but must never obscure the line.
      if (!placement) continue;
      assert.ok(!segments.some(route=>crossesRoute(route,placement.box)),`${journey.id} ${day.id} ${width}`);
      assert.ok(!occupied.some(box=>overlaps(box,placement.box)));
      occupied.push(placement.box);
    }
    assert.ok(occupied.length,`${journey.id} ${day.id}: selected destination can be placed at ${width}px`);
  }
});

test('dense labels collapse then cull, selected groups sort first, and offscreen anchors stay offscreen', () => {
  const bounds = {left:8,right:172,top:8,bottom:112};
  const sizes = [{width:200,height:44,compact:false},{width:60,height:44,compact:true}];
  const compact = placeLabel({x:90,y:60},sizes,{bounds});
  assert.equal(compact.compact,true);
  assert.equal(placeLabel({x:90,y:60},sizes,{bounds,occupied:[bounds]}),null);
  assert.equal(placeLabel({x:-1,y:60},sizes,{bounds}),null);
  const route = {start:{x:0,y:50},end:{x:200,y:50},padding:6};
  assert.equal(crossesRoute(route,{left:90,right:100,top:40,bottom:60}),true);
  assert.equal(crossesRoute({...route,end:route.start},{left:-5,right:5,top:40,bottom:60}),true);
  assert.equal(crossesRoute(route,{left:90,right:100,top:20,bottom:40}),false);
});

test('repeat stays and skipped days get honest labels', () => {
  assert.equal(dayText([{number:4}]),'Day 4');
  assert.equal(dayText([{number:4},{number:5},{number:6}]),'Days 4–6');
  assert.equal(dayText([{number:4},{number:8}]),'Day 4 +1');
});

test('group filters exclude other destinations even when those places remain in the journey', () => {
  const journey = {places:[{id:'a',name:'A',lng:1,lat:1},{id:'b',name:'B',lng:2,lat:2}],segments:[],days:[{id:'d1',number:1,placeId:'a',groupPlaces:{first:'a',second:'b'},segmentIds:[]}]};
  assert.equal(groupsForJourney(journey,helpers(journey),'d1','journey').length,2);
  const selected = groupsForJourney(journey,{...helpers(journey),includeGroupPlaces:false},'d1','journey');
  assert.deepEqual(selected.map(group=>group.name),['A']);
});

test('overview labels never collide with another label, route stroke or map control', () => {
  for (const journey of data.journeys) for (const [width,height,labelHeight] of [[850,650,32],[390,580,44]]) {
    const h=helpers(journey), groups=groupsForJourney(journey,h,journey.days[0].id,'journey');
    const coordinates=[...journey.segments.flatMap(h.segmentCoordinates),...groups.map(group=>group.coordinate)];
    if(!coordinates.length)continue;
    const xs=coordinates.map(c=>c[0]),ys=coordinates.map(c=>c[1]);
    const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
    const scale=Math.min((width-120)/Math.max(.001,maxX-minX),(height-160)/Math.max(.001,maxY-minY));
    const project=([x,y])=>({x:width/2+(x-(minX+maxX)/2)*scale,y:height/2-(y-(minY+maxY)/2)*scale});
    const strokes=journey.segments.flatMap(segment=>{const points=h.segmentCoordinates(segment).map(project);return points.slice(1).map((end,index)=>({start:points[index],end,padding:9}));});
    const occupied=[{left:width-50,right:width,top:0,bottom:90},{left:8,right:width-8,top:height-45,bottom:height}];
    let visible=0;
    for(const group of groups){
      const placement=placeLabel(project(group.coordinate),[{width:Math.min(200,60+group.name.length*7),height:labelHeight,compact:false},{width:65,height:labelHeight,compact:true}],{bounds:{left:8,right:width-8,top:8,bottom:height-8},occupied,routes:strokes});
      if(!placement)continue;
      assert.ok(!occupied.some(box=>overlaps(placement.box,box)));assert.ok(!strokes.some(route=>crossesRoute(route,placement.box)));
      occupied.push(placement.box);visible++;
    }
    assert.ok(visible,journey.id);
  }
});
