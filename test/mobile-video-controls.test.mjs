import test from 'node:test';
import assert from 'node:assert/strict';
import {viewerFixture} from './mobile-viewer-harness.mjs';

function fixture(options={}) {
  const journey={days:[{id:'one',number:1,title:'First'},{id:'two',number:2,title:'Second'}],photos:[
    {id:'still-before',dayId:'one',width:1200,height:800},
    {id:'clip-one',dayId:'one',mediaType:'video',width:1280,height:720},
    {id:'clip-two',dayId:'one',mediaType:'video',width:720,height:1280},
    {id:'still-after',dayId:'two',width:800,height:1200}]};
  const f=viewerFixture({...options,journey}),video=f.node('#journey-video');
  video.closest=query=>query==='video'?video:null;
  video.getBoundingClientRect=()=>({left:0,top:0,width:video.clientWidth,height:video.clientHeight,bottom:video.clientHeight,right:video.clientWidth});
  const play=f.node('#viewer-video-play');play.closest=query=>query.startsWith('button')?play:null;
  f.api.openDay();f.api.selectPhoto(1);
  function drag(dx,dy=0,{y=180,type='pointerup'}={}) {
    const event={target:video,clientX:300,clientY:y};
    f.dispatch('.photo-stage','pointerdown',event);
    f.dispatch('.photo-stage','pointermove',{...event,clientX:300+dx,clientY:y+dy});f.frame();
    f.dispatch('.photo-stage',type,{...event,clientX:300+dx,clientY:y+dy});f.flush();
  }
  return {...f,video,drag,get index(){return f.index;}};
}

test('a video picture swipes through adjacent clips and stills in both directions',()=>{
  const f=fixture();f.drag(-150);assert.equal(f.index,2);
  f.drag(-150);assert.equal(f.index,3);
  f.api.selectPhoto(1);f.drag(150);assert.equal(f.index,0);
});

test('cancelled and short video gestures stay selected and settle the moving player',()=>{
  const f=fixture();f.drag(-150,0,{type:'pointercancel'});assert.equal(f.index,1);
  f.drag(-10);assert.equal(f.index,1);
  assert.equal(f.node('#viewer-video').style.transform,'translate3d(0px,0,0)');
});

test('native video control drags and taps keep their own actions',()=>{
  const f=fixture(),bottom=f.video.getBoundingClientRect().bottom;
  f.drag(-150,0,{y:bottom-20});assert.equal(f.index,1);
  const event=f.click('#journey-video','.photo-stage',{y:bottom-20});
  assert.equal(f.node('.photo-viewer').dataset.chrome,'true');assert.equal(event.prevented,undefined);
  f.dispatch('.photo-stage','pointerdown',{target:f.node('#viewer-video-play')});
  f.dispatch('.photo-stage','pointermove',{clientX:0});f.dispatch('.photo-stage','pointerup');
  assert.equal(f.index,1);
});

test('video taps hide and restore chrome and release the full media viewport',()=>{
  const f=fixture();const header=f.node('.mobile-photo-header'),footer=f.node('.mobile-photo-footer'),actions=f.node('.mobile-photo-actions');
  Object.assign(header,{offsetWidth:390,offsetHeight:102});Object.assign(footer,{offsetWidth:390,offsetHeight:84});Object.assign(actions,{offsetWidth:44,offsetTop:566});f.resizeViewport();
  const viewer=f.node('.photo-viewer');assert.equal(viewer.style['--media-head'],'102px');assert.equal(viewer.style['--media-foot'],'140px');
  f.click('#journey-video','.photo-stage');assert.equal(viewer.dataset.chrome,'false');assert.equal(f.video.controls,false);
  assert.equal(viewer.style['--media-head'],'0px');assert.equal(viewer.style['--media-foot'],'0px');
  f.click('#journey-video','.photo-stage');assert.equal(viewer.dataset.chrome,'true');assert.equal(f.video.controls,true);
  assert.equal(viewer.style['--media-foot'],'140px');
  f.dispatch('.photo-stage','pointerdown',{target:f.video});f.dispatch('.photo-stage','pointermove',{target:f.video,clientX:30});f.frame();f.dispatch('.photo-stage','pointerup',{target:f.video,clientX:30});
  const dragClick=f.click('#journey-video','.photo-stage',{synthetic:true});assert.equal(dragClick.stopped,true);
});

test('video pull gestures open location, collapse it, and dismiss to the presenting surface',()=>{
  const f=fixture();f.drag(0,-150);assert.equal(f.controller.locationVisible(),true);
  f.drag(0,150);assert.equal(f.controller.locationVisible(),false);assert.equal(f.node('#photo-dialog').open,true);
  const dismissal=fixture();dismissal.drag(0,200);assert.equal(dismissal.node('#photo-dialog').open,false);
});

test('a second finger on video cancels picture navigation without a photo zoom',()=>{
  const f=fixture();f.dispatch('.photo-stage','pointerdown',{target:f.video,pointerId:1,clientX:100,clientY:160});
  f.dispatch('.photo-stage','pointerdown',{target:f.video,pointerId:2,clientX:200,clientY:160});
  f.dispatch('.photo-stage','pointermove',{target:f.video,pointerId:2,clientX:330,clientY:160});f.frame();
  f.dispatch('.photo-stage','pointerup',{target:f.video,pointerId:2});f.dispatch('.photo-stage','pointerup',{target:f.video,pointerId:1});
  assert.equal(f.index,1);assert.notEqual(f.node('.photo-viewer').dataset.zoomed,'true');
  assert.equal(f.click('#journey-video','.photo-stage',{synthetic:true}).stopped,true);
  assert.equal(f.node('.photo-viewer').dataset.chrome,'true');
});

test('native fullscreen video retains all gestures even when its chrome is hidden',()=>{
  const f=fixture();f.video.webkitDisplayingFullscreen=true;f.video.controls=false;
  f.drag(-150);assert.equal(f.index,1);
  const event=f.click('#journey-video','.photo-stage');assert.equal(event.prevented,undefined);
  assert.equal(f.node('.photo-viewer').dataset.chrome,'true');
});
