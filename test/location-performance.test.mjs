import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {viewerFixture} from './mobile-viewer-harness.mjs';
import {viewerFunction} from './viewer-flow-harness.mjs';

test('location pulls coalesce to one visual update without resizing the photo stage during the drag',()=>{
  const f=viewerFixture();f.api.openDay();f.click('#mobile-photo-location');f.flush();
  const viewer=f.node('.photo-viewer'),stage=f.node('.photo-stage'),initial=parseFloat(viewer.style['--reveal']),inset=stage.style['--location-inset'];
  let writes=0;const write=viewer.style.setProperty;
  viewer.style.setProperty=function(name,value){if(name==='--reveal')writes++;return write.call(this,name,value);};
  const start={clientX:200,clientY:300};f.dispatch('.photo-location-heading','pointerdown',start);
  for(const dy of [20,40,70])f.dispatch('.photo-location-heading','pointermove',{...start,clientY:300+dy});
  assert.equal(writes,0);assert.equal(stage.style['--location-inset'],inset);
  f.frame();assert.equal(writes,1);assert.equal(parseFloat(viewer.style['--reveal']),initial-70);
  assert.equal(stage.style['--location-inset'],inset,'Only the fitted transform changes before release');
  f.dispatch('.photo-location-heading','pointerup',{...start,clientY:370});f.flush();
  assert.equal(stage.style['--location-inset'],'0px');assert.equal(viewer.dataset.locationVisible,'false');
});

test('grid, close and resize cancel a queued location pull before it can affect the next view',()=>{
  for(const boundary of ['grid','close','resize']){
    const f=viewerFixture();f.api.openDay();f.click('#mobile-photo-location');f.flush();
    f.dispatch('.photo-location-heading','pointerdown',{clientY:300});
    f.dispatch('.photo-location-heading','pointermove',{clientY:360});
    if(boundary==='grid')f.click('#mobile-photo-grid');
    if(boundary==='close')f.node('#photo-dialog').close();
    if(boundary==='resize')f.resizeViewport();
    const reveal=f.node('.photo-viewer').style['--reveal'];f.frame();
    assert.equal(f.node('.photo-viewer').style['--reveal'],reveal,boundary);
  }
});

test('releasing before the queued drag frame starts settling from the last rendered photo fit',()=>{
  const f=viewerFixture();f.api.openDay();f.click('#mobile-photo-location');f.flush();
  const inset=parseFloat(f.node('.photo-stage').style['--location-inset']);
  f.dispatch('.photo-location-heading','pointerdown',{clientY:300});
  f.dispatch('.photo-location-heading','pointermove',{clientY:370});
  f.dispatch('.photo-location-heading','pointerup',{clientY:370});
  const transform=f.node('.photo-stage').style['--location-photo-transform'];
  assert.ok(transform.includes(`translate3d(0,${-inset/2}px,0)`),transform);
});

test('reduced-motion location settles directly to its fitted endpoint',()=>{
  const f=viewerFixture({reducedMotion:true});f.api.openDay();f.click('#mobile-photo-location');
  assert.equal(f.node('.photo-viewer').classList.contains('is-location-settling'),false);
  assert.match(f.node('.photo-stage').style['--location-photo-transform'],/translate3d\(0,0px,0\) scale\(1\)/);
  f.click('#mobile-location-close');assert.equal(f.node('.photo-stage').style['--location-inset'],'0px');
});

test('interrupting before the first location animation frame cannot leave the photo at its inverse fit',()=>{
  const f=viewerFixture();f.api.openDay();f.click('#mobile-photo-location');
  f.dispatch('.photo-location-heading','pointerdown');
  f.dispatch('.photo-location-heading','pointerup');
  f.frame();assert.equal(f.node('.photo-stage').style['--location-photo-transform'],'none');
  assert.equal(f.controller.locationVisible(),true);
  f.dispatch('.photo-location-heading','pointerdown',{clientY:300});
  f.dispatch('.photo-location-heading','pointermove',{clientY:290});
  f.dispatch('.photo-location-heading','pointerup',{clientY:290});f.flush();
  assert.equal(f.node('.photo-viewer').classList.contains('is-location-dragging'),false);
});

test('unchanged location reopen retains the map camera, marker and canvas without redundant work',()=>{
  const photo={id:'same-photo'},box={clientWidth:362,clientHeight:196},calls=[];
  const context=vm.createContext({viewerMap:{resize(){calls.push('resize');}},viewerMapSize:'362:196',viewerMapReady:true,viewerCameraPhoto:photo,viewerPhotoIndex:0,viewerPhotos:()=>[photo],$:()=>box,syncViewerMap(){calls.push('sync');}});
  vm.runInContext(viewerFunction('initViewerMap'),context);
  for(let i=0;i<5;i++)context.initViewerMap();assert.deepEqual(calls,[]);
  box.clientWidth=500;context.initViewerMap();assert.deepEqual(calls,['resize','sync']);
  calls.length=0;context.viewerCameraPhoto=null;context.initViewerMap();assert.deepEqual(calls,['sync'],'New photo context refreshes without resizing an unchanged canvas');
});

test('location map construction waits for the first sheet paint and cancels on close or grid entry',()=>{
  for(const interrupt of ['none','close','grid','pause']){
    const frames=new Map();let id=0,inits=0,grid=false;
    const context=vm.createContext({viewerMapFrame:null,viewerCameraMoving:false,viewerTransition:{cancel(){}},photoDialog:{open:true},initViewerMap(){inits++;},window:{requestAnimationFrame(fn){frames.set(++id,fn);return id;},cancelAnimationFrame(n){frames.delete(n);},JOURNEY_ATLAS_MOBILE_UI:{enabled:()=>true,locationVisible:()=>true,gridVisible:()=>grid}}});
    vm.runInContext(viewerFunction('pauseViewerLocation')+'\n'+viewerFunction('showViewerLocation'),context);
    const frame=()=>{const work=[...frames.values()];frames.clear();work.forEach(fn=>fn());};
    context.showViewerLocation();frame();assert.equal(inits,0,'The first frame can paint the sheet before WebGL setup');
    if(interrupt==='close')context.photoDialog.open=false;
    if(interrupt==='grid')grid=true;
    if(interrupt==='pause')context.pauseViewerLocation();
    frame();assert.equal(inits,interrupt==='none'?1:0,interrupt);
  }
});

test('closing interrupts an automatic camera move without discarding a settled or manually explored camera',()=>{
  for(const moving of [false,true]){
    const photo={id:'selected'};let stopped=0;
    const context=vm.createContext({viewerMapFrame:null,viewerCameraMoving:moving,viewerCameraPhoto:photo,viewerTransition:{cancel(){stopped++;}},window:{cancelAnimationFrame(){}}});
    vm.runInContext(viewerFunction('pauseViewerLocation'),context);context.pauseViewerLocation();
    assert.equal(context.viewerCameraPhoto,moving?null:photo);assert.equal(stopped,1);
  }
});
