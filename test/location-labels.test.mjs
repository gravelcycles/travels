import test from 'node:test';
import assert from 'node:assert/strict';
import { loadContent } from '../scripts/journey-content.mjs';
import { readOverrides } from '../scripts/build-site.mjs';
import '../dist/assets/location-labels.js';
const { groupsForJourney, dayText, overlaps, crossesRoute, clusterGroups, placePin } = globalThis.JOURNEY_ATLAS_LOCATION_LABELS;
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


test('nearby locations cluster without dropping days and separate again on zoom', () => {
  const groups = [0,1,2].map(i=>({key:`p${i}`,coordinate:[i*30,100],name:`Place ${i}`,days:[{id:`d${i}`,number:i+1}],selected:i===1}));
  const project = ([x,y])=>({x,y});
  const clustered = clusterGroups(groups,project,40);
  assert.equal(clustered.length,1);
  assert.equal(clustered[0].members.length,3);
  assert.deepEqual(clustered[0].days.map(d=>d.id),['d0','d1','d2']);
  assert.deepEqual(clustered[0].coordinate,groups[1].coordinate,'Selected location anchors the cluster');
  assert.equal(clusterGroups(groups,([x,y])=>({x:x*2,y}),40).length,3);
  assert.equal(groups[0].members,undefined,'Source records remain untouched');
});

test('pins keep their tips on the location, prefer clear bodies, and never pull offscreen places inward', () => {
  const point={x:150,y:150}, bounds={left:0,right:300,top:0,bottom:300};
  const routes=[{start:{x:0,y:150},end:{x:300,y:150},padding:3}];
  const pin=placePin(point,{dot:false,targetSize:32,bounds,routes});
  assert.equal(pin.dot,false);
  const [x,y]=pin.offset, radians=pin.angle*Math.PI/180;
  assert.ok(Math.abs(x-20*Math.sin(radians))<1e-9);
  assert.ok(Math.abs(y+20*Math.cos(radians))<1e-9);
  assert.ok(!crossesRoute(routes[0],{left:150+x-13,right:150+x+13,top:150+y-13,bottom:150+y+13}));
  assert.equal(placePin({x:-1,y:150},{dot:false,targetSize:32,bounds}),null);
  assert.equal(placePin(point,{dot:false,targetSize:32,bounds,occupied:[bounds]}),null);
  assert.deepEqual(placePin(point,{dot:true,targetSize:44,bounds}).offset,[0,0]);
});

test('real and demo maps use clustered pins with separate touch targets and protected controls', () => {
  for (const journey of data.journeys) for (const [width,height,targetSize] of [[850,650,32],[390,580,44],[320,300,44]]) {
    const h=helpers(journey), groups=groupsForJourney(journey,h,journey.days[0].id,'journey');
    const coordinates=[...journey.segments.flatMap(h.segmentCoordinates),...groups.map(group=>group.coordinate)];
    if(!coordinates.length)continue;
    const xs=coordinates.map(c=>c[0]),ys=coordinates.map(c=>c[1]);
    const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
    const scale=Math.min((width-120)/Math.max(.001,maxX-minX),(height-160)/Math.max(.001,maxY-minY));
    const project=([x,y])=>({x:width/2+(x-(minX+maxX)/2)*scale,y:height/2-(y-(minY+maxY)/2)*scale});
    const clustered=clusterGroups(groups,project,targetSize+8);
    assert.deepEqual(new Set(clustered.flatMap(g=>g.members.map(m=>m.key))),new Set(groups.map(g=>g.key)));
    const occupied=[{left:width-50,right:width,top:0,bottom:90},{left:8,right:width-8,top:height-45,bottom:height}];
    let visible=0;
    for(const group of clustered){
      const placement=placePin(project(group.coordinate),{dot:group.days.length>1||group.members.length>1,targetSize,bounds:{left:4,right:width-4,top:4,bottom:height-4},occupied});
      if(!placement)continue;
      assert.ok(!occupied.some(box=>overlaps(placement.box,box,2)));
      assert.ok(Math.abs(placement.box.right-placement.box.left-targetSize)<1e-9);
      occupied.push(placement.box);visible++;
    }
    assert.ok(visible,`${journey.id} at ${width}px`);
  }
});
