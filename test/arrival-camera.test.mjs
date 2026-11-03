import test from 'node:test';
import assert from 'node:assert/strict';
import {arrivalCameraHarness,arrivalLayerHarness,arrivalRouteHarness} from './arrival-camera-harness.mjs';
const legs=[{id:'north-south',geometry:[[11,49],[11.1,47],[11,45]]}];

test('arrival resizes after rendering the card and applies fitted bounds padding exactly once',()=>{
  for(const phone of [false,true]){
    const h=arrivalCameraHarness(legs,{width:phone?390:600,height:540,phone});let started=0;
    h.prepare(()=>started++);
    assert.deepEqual(h.calls.map(c=>c.type),['draw','resize','fit','ease']);
    assert.deepEqual(h.calls[2].bounds,legs[0].geometry);
    assert.equal(h.calls[2].options.padding.bottom,phone?64:154);
    const camera=h.calls[3].camera;
    assert.equal(camera.center,h.boundsCamera.center);
    assert.equal(camera.zoom,h.boundsCamera.zoom);
    assert.equal(camera.padding,undefined,'cameraForBounds already offsets its center for padding');
    assert.equal(started,0,'The route clock cannot consume the framing time');
    h.finish();assert.equal(started,1);assert.equal(h.calls.length,4,'No camera moves during travel');
    h.city();assert.equal(h.calls.at(-1).type,'ease');assert.equal(h.calls.at(-1).camera.padding,undefined);
  }
});


test('arrival tolerates late route layers and keeps the untravelled line quiet after a redraw',()=>{
  const h=arrivalLayerHarness();
  assert.doesNotThrow(()=>h.start(),'Missing main layers must not emit a map error over the route');
  assert.equal(h.drawing,true);assert.ok(h.layers.has('arrival-guide-line-rail'));
  h.redraw();
  assert.equal(h.layers.get('main-line-rail').visibility,'none');
  assert.equal(h.layers.get('main-casing-rail').visibility,'none');
  assert.ok(h.layers.has('arrival-guide-line-rail'),'A late main-map redraw restores the quiet guide');
});


test('north–south endpoint labels sit outside the travelled line, keeping the departing circle visible',()=>{
  for(const southbound of [true,false]){
    const geometry=southbound?legs[0].geometry:legs[0].geometry.toReversed();
    const h=arrivalCameraHarness([{id:'rail',geometry}],{phone:true,width:390,height:540});h.prepare();
    assert.deepEqual(h.markers.map(marker=>marker.anchor),southbound?['bottom','top']:['top','bottom']);
    const padding=h.calls.find(call=>call.type==='fit').options.padding;
    assert.ok(padding.top>=64);assert.ok(padding.bottom>=64);
  }
});


test('completed, skipped, repeated and reduced-motion arrivals retain active route styling and quiet context',()=>{
  const journey={id:'route-style',places:[],segments:[
    {id:'rail',mode:'train',geometry:[[11,49],[11,47]]},
    {id:'bus',mode:'bus',planningStatus:'tbd',geometry:[[11,47],[11,46]]},
    {id:'other',mode:'train',geometry:[[11,49],[11,46]]}
  ],days:[{id:'selected',segmentIds:['rail','bus']},{id:'other-day',segmentIds:['other']}]};
  const h=arrivalRouteHarness(journey,{},'selected');
  const expected=journey.segments.flatMap(segment=>['line','casing'].map(part=>({id:`main-${part}-${segment.id}`,paint:structuredClone(h.map.getLayer(`main-${part}-${segment.id}`).paint)})));
  const check=()=>{
    assert.equal(h.context.phase,'stay');assert.equal(h.context.mapScope,'day');
    for(const {id,paint} of expected){assert.deepEqual(JSON.parse(JSON.stringify(h.map.getLayer(id).paint)),paint,id);if(!id.endsWith('-other'))assert.equal(h.map.getLayer(id).layout.visibility,'visible',id);}
    for(const id of ['rail','bus'])for(const part of ['line','casing'])assert.equal(h.map.getLayer(`arrival-guide-${part}-${id}`).layout.visibility,'none','The gray guide must not cover the active route after playback');
    assert.equal(h.map.getLayer('main-casing-bus').paint['line-opacity'],0,'TBD gaps stay transparent');
  };
  h.start();h.tick(0);h.tick(1750);check();
  h.start();h.skip();check();
  h.start();h.tick(0);h.tick(1750);check();
  h.start(true);check();
  assert.equal(h.cameraMoves.length,4,'Each stay still frames the destination');
});
