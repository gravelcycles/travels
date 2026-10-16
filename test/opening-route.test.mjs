import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {openingRouteHarness} from './opening-route-harness.mjs';

const journey = {id:'independent', days:[{segmentIds:['north','bus']},{segmentIds:[]},{segmentIds:['south']}], segments:[
  {id:'south',mode:'boat',geometry:[[30,10],[31,11],[32,12]]},
  {id:'north',mode:'train',geometry:[[0,0],[0,1],[0,2]]},
  {id:'bus',mode:'bus',geometry:[[0,2],[1,2]]}
]};

test('opening trace follows event/leg order, preserves gaps and completes in exactly three seconds', () => {
  const h = openingRouteHarness(journey); h.start();
  assert.deepEqual(h.plan.legs.map(leg=>leg.segment.id), ['north','bus','south']);
  assert.equal(h.plan.duration, 3000); assert.equal(h.plan.arrivalHold, 0);
  assert.ok([...h.layers.values()].every(value=>value==='none'));
  assert.deepEqual(h.frames[0].position,[0,0]);
  h.tick(100);
  for (const leg of h.plan.legs) {
    h.tick(100 + (leg.start + (leg.end-leg.start)/2)*3000);
    assert.equal(h.frames.at(-1).active.segment.id,leg.segment.id);
  }
  h.tick(3099); assert.equal(h.destroyed,0);
  h.tick(3100); assert.equal(h.frames.at(-1).progress,1);
  assert.deepEqual(h.frames.at(-1).position,[32,12]);
  assert.equal(h.destroyed,1); assert.equal(h.pending.size,0);
  assert.ok([...h.layers.values()].every(value=>value==='visible'));
  assert.equal(h.classes.size,0); assert.equal(h.events.size,0);
  assert.deepEqual(h.plan.legs[2].coordinates[0],[30,10],'A separate leg does not start at the previous endpoint');
});

test('cancellation restores original visibility and stale frames cannot draw again', () => {
  for (const movement of [false,true]) {
    const h=openingRouteHarness(journey); h.layers.set('main-line-north','none');
    const animation=h.start(); h.tick(0); h.tick(500);
    const stale=[...h.pending.values()][0], count=h.frames.length;
    if(movement)h.events.get('movestart')({originalEvent:{type:'pointermove'}});else animation.cancel();
    animation.cancel(); stale(3000);
    assert.equal(h.frames.length,count);assert.equal(h.pending.size,0);assert.equal(h.destroyed,1);
    assert.equal(h.layers.get('main-line-north'),'none');assert.equal(h.layers.get('main-line-bus'),'visible');
  }
});

test('automatic MapLibre resizing preserves the same three-second trace', () => {
  const h=openingRouteHarness(journey); let refits=0;
  h.start({fit:()=>refits++}); h.tick(0); h.tick(400);
  // MapLibre resize emits movestart/move/resize/moveend without originalEvent,
  // including a ResizeObserver update after the cover is dismissed on a phone.
  for (const time of [450,650,1200]) {
    h.events.get('movestart')?.({type:'movestart'});
    h.events.get('resize')?.({type:'resize'});
    h.tick(time);
    assert.equal(h.destroyed,0,'Internal layout work must not reveal the entire route');
    assert.equal(h.frames.at(-1).progress,time/3000,'Resize does not restart the clock');
  }
  assert.equal(refits,3);
  h.tick(2999);assert.equal(h.destroyed,0);
  h.tick(3000);assert.equal(h.destroyed,1);
  assert.equal(h.events.size,0);
});

test('late native route redraws remain hidden until the opening completes', () => {
  const h=openingRouteHarness(journey), animation=h.start();h.tick(0);h.tick(500);
  for(const id of h.layers.keys())h.layers.set(id,'visible');
  animation.syncLayers();
  assert.ok([...h.layers.values()].every(value=>value==='none'));
  h.tick(1500);assert.equal(h.frames.at(-1).progress,0.5);
  h.tick(3000);assert.ok([...h.layers.values()].every(value=>value==='visible'));
  animation.syncLayers();
  assert.ok([...h.layers.values()].every(value=>value==='visible'),'A stale redraw cannot hide completed routes');
});

test('reduced motion, route-less drafts and unavailable canvas preserve the immediate map', () => {
  for (const [data,options] of [[journey,{reducedMotion:true}],[{id:'empty',days:[{segmentIds:[]}],segments:[]},{}],[journey,{drawing:()=>null}]]) {
    const h=openingRouteHarness(data);h.start(options).cancel();
    assert.equal(h.frames.length,0);assert.equal(h.pending.size,0);assert.equal(h.classes.size,0);
    assert.ok([...h.layers.values()].every(value=>value==='visible'));
  }
});

test('opening entry waits for map readiness, consumes its request once, and can be cancelled before readiness', () => {
  const app=fs.readFileSync(new URL('../dist/assets/app.js',import.meta.url),'utf8');
  const fn=name=>{const start=app.indexOf(`  function ${name}(`);return app.slice(start,app.indexOf('\n  function ',start+1));};
  for(const interrupt of [false,true]) {
    const calls=[];
    const context=vm.createContext({journey,openingRoutePending:false,openingRoute:null,mainMapReady:false,mapScope:'day',mobileMapTimer:80,
      clearTimeout:id=>{assert.equal(id,80);calls.push('cancel-tab-resize');},
      document:{hidden:false,body:{classList:{contains:()=>false}}},
      mainMap:{stop(){},resize(){}},segmentCoordinates:s=>s.geometry,prefersReducedMotion:()=>false,
      modeStyles:{},palette:{},renderDays(){},renderStory(){},drawMainMap(){},setMobileTab:tab=>calls.push(tab),fitJourneyBounds:duration=>calls.push(duration),
      window:{JOURNEY_ATLAS_OPENING_ROUTE:{start:()=>{calls.push('trace');return {cancel:()=>calls.push('cancel')};}}}
    });
    vm.runInContext(['cancelOpeningRoute','openJourneyMap','playOpeningRoute'].map(fn).join('\n')+'\nfunction cancelArrival(){cancelOpeningRoute();}',context);
    context.openJourneyMap();assert.equal(context.mapScope,'journey');assert.deepEqual(calls,['map','cancel-tab-resize']);
    assert.equal(context.mobileMapTimer,null);
    if(interrupt)context.cancelOpeningRoute();
    context.mainMapReady=true;context.playOpeningRoute();context.playOpeningRoute();
    assert.deepEqual(calls,interrupt?['map','cancel-tab-resize']:['map','cancel-tab-resize',0,'trace']);
    assert.equal(context.openingRoutePending,false);
  }
});
