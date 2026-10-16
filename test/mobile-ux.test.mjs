import test from 'node:test';
import assert from 'node:assert/strict';
import '../dist/assets/mobile-ux.js';
const {gestureAxis, swipeStep, panLimit} = globalThis.JOURNEY_ATLAS_MOBILE;

test('photo gestures wait for a clear direction instead of choosing on taps or diagonals', () => {
  assert.equal(gestureAxis(7, 3), null);
  assert.equal(gestureAxis(45, 44), null);
  assert.equal(gestureAxis(-45, 12), 'x');
  assert.equal(gestureAxis(12, -45), 'y');
  assert.equal(gestureAxis(-12, 45), 'y');
});

test('swipes accept deliberate distance or a quick flick but reject small slow drags', () => {
  assert.equal(swipeStep(-120, 900, 390, 1, 21), 1);
  assert.equal(swipeStep(120, 900, 390, 1, 21), -1);
  assert.equal(swipeStep(-40, 60, 390, 1, 21), 1);
  assert.equal(swipeStep(-40, 600, 390, 1, 21), 0);
  assert.equal(swipeStep(-15, 10, 390, 1, 21), 0);
});

test('album boundaries never wrap or skip into a different day, including empty albums', () => {
  assert.equal(swipeStep(180, 200, 320, 0, 21), 0);
  assert.equal(swipeStep(-180, 200, 320, 20, 21), 0);
  assert.equal(swipeStep(-180, 200, 320, 0, 1), 0);
  assert.equal(swipeStep(180, 200, 320, 0, 0), 0);
  assert.equal(swipeStep(-75, 400, 320, 0, 2), 1);
});

test('zoom panning stays inside the photograph and does not move letterboxed axes', () => {
  assert.equal(panLimit(390, 1, 390), 0);
  assert.equal(panLimit(390, 2, 390), 195);
  assert.equal(panLimit(292, 2, 706), 0);
  assert.equal(panLimit(292, 4, 706), 231);
});

import {viewerFixture} from './mobile-viewer-harness.mjs';

test('video scrubbing stays native, video taps cannot zoom, and opening the media grid pauses playback', () => {
  const f = viewerFixture({videoIndex:1}); f.api.openDay(); f.api.selectPhoto(1);
  const stage = f.node('.photo-stage'), target = {closest:query => query === '#viewer-video' ? target : null};
  const event = {pointerId:1,button:0,clientX:250,clientY:650,target,currentTarget:stage};
  stage.handlers.get('pointerdown')(event);
  stage.handlers.get('pointermove')({...event,clientX:50});
  stage.handlers.get('pointerup')({...event,type:'pointerup',clientX:50}); f.flush();
  assert.equal(f.index,1); assert.equal(f.locations,0);
  f.click('.photo-stage'); f.click('.photo-stage');
  assert.notEqual(f.node('.photo-viewer').dataset.zoomed,'true');
  assert.equal(f.node('#mobile-photo-time').textContent,'A video');
  f.click('#mobile-photo-grid');
  assert.equal(f.mediaPauses,1); assert.equal(f.node('#mobile-grid-title').textContent,'2 photos · 1 video');
});

test('swiping, opening location and returning from it keep the same selected photo',()=>{
  const f=viewerFixture();f.api.openDay();f.drag('.photo-stage',-150,4);f.flush();assert.equal(f.index,1);
  f.drag('.photo-stage',3,-150);assert.equal(f.locations,1);assert.equal(f.history.state.mobileAtlas.layer,'location');
  assert.equal(f.node('#photo-map').handlers.size,0,'photo gestures must not intercept the map');
  f.drag('.photo-location-heading',3,150);assert.equal(f.history.state.mobileAtlas.layer,'photo');assert.equal(f.index,1);
  assert.equal(f.node('#photo-location-panel').inert,true);
});

test('the entire location header accepts downward drags after a sideways start, including Close',()=>{
  for (const selector of ['.photo-location-heading','#photo-location-title','#photo-location-subtitle','#mobile-location-close']) {
    const f=viewerFixture();f.api.openDay();f.api.selectPhoto(1);f.click('#mobile-photo-location');
    const header='.photo-location-heading', target=f.node(selector), start={target,clientX:100,clientY:350};
    const initialReveal=parseFloat(f.node('.photo-viewer').style['--reveal']);
    f.dispatch(header,'pointerdown',start);
    f.dispatch(header,'pointermove',{...start,clientX:118,clientY:352});
    f.dispatch(header,'pointermove',{...start,clientX:155,clientY:420});
    assert.equal(parseFloat(f.node('.photo-viewer').style['--reveal']),initialReveal-70,'The panel follows the finger');
    f.dispatch(header,'pointerup',{...start,clientX:155,clientY:420});
    assert.equal(f.controller.locationVisible(),false,selector);
    assert.equal(f.node('#photo-dialog').open,true);
    assert.equal(f.index,1);
    assert.equal(f.history.state.mobileAtlas.layer,'photo');
    assert.equal(f.click(selector,header,{synthetic:true}).prevented,true,'No click leaks from the drag');
  }
});

test('location Close retains native pointer capture through taps and drags',()=>{
  const f=viewerFixture();f.api.openDay();f.click('#mobile-photo-location');
  const header='.photo-location-heading',start={target:f.node('#mobile-location-close'),clientX:200,clientY:350};
  let captures=0,buttonCaptures=0;f.node(header).setPointerCapture=()=>captures++;
  f.node('#mobile-location-close').setPointerCapture=()=>buttonCaptures++;
  f.dispatch(header,'pointerdown',start);f.dispatch(header,'pointerup',start);
  assert.equal(captures,0,'A tap must not be retargeted to the header');
  assert.equal(buttonCaptures,1);
  f.dispatch(header,'pointerdown',start);f.dispatch(header,'pointermove',{...start,clientY:380});
  assert.equal(captures,0,'Transferring capture would cancel a touch drag via lostpointercapture');
  assert.equal(buttonCaptures,2);
});

test('short, horizontal and cancelled location-header drags do not activate Close',()=>{
  for (const [dx,dy,end] of [[0,18,'pointerup'],[70,3,'pointerup'],[8,100,'pointercancel'],[8,100,'lostpointercapture']]) {
    const f=viewerFixture();f.api.openDay();f.click('#mobile-photo-location');
    const header='.photo-location-heading', start={target:f.node('#mobile-location-close'),clientX:200,clientY:350};
    f.dispatch(header,'pointerdown',start);
    f.dispatch(header,'pointermove',{...start,clientX:200+dx,clientY:350+dy});
    f.dispatch(header,end,{...start,clientX:200+dx,clientY:350+dy});
    assert.equal(f.controller.locationVisible(),true);
    assert.equal(f.node('.photo-viewer').style['--reveal'],f.node('.photo-viewer').style['--location-height']);
    assert.equal(f.click('#mobile-location-close',header,{synthetic:true}).prevented,true);
    assert.equal(f.controller.locationVisible(),true);
    assert.equal(f.click('#mobile-location-close',header).prevented,undefined,'A fresh tap still works');
    assert.equal(f.controller.locationVisible(),false);
  }
});

test('a second finger cancels a location-header drag without zooming or closing the photo',()=>{
  const f=viewerFixture();f.api.openDay();f.click('#mobile-photo-location');
  const header='.photo-location-heading';
  f.dispatch(header,'pointerdown',{clientX:120,clientY:350});
  f.dispatch(header,'pointermove',{clientX:125,clientY:410});
  f.dispatch(header,'pointerdown',{pointerId:2,clientX:240,clientY:400});
  f.dispatch(header,'pointermove',{pointerId:2,clientX:300,clientY:470});
  f.dispatch(header,'pointerup',{pointerId:2});f.dispatch(header,'pointerup');
  assert.equal(f.controller.locationVisible(),true);
  assert.equal(f.node('.photo-viewer').style['--reveal'],f.node('.photo-viewer').style['--location-height']);
  assert.notEqual(f.node('.photo-viewer').dataset.zoomed,'true');
  assert.equal(f.node('#photo-dialog').open,true);
});

test('a second finger on the map or native video cancels the header pull without intercepting content',()=>{
  for(const nativeVideo of [false,true]) {
  const f=viewerFixture();f.api.openDay();f.click('#mobile-photo-location');
  const header='.photo-location-heading';
  f.dispatch(header,'pointerdown',{clientX:120,clientY:350});
  f.dispatch(header,'pointermove',{clientX:125,clientY:410});
  const target=nativeVideo?{closest:query=>query==='.photo-stage'?f.node('.photo-stage'):query==='button,#viewer-video'?f.node('#viewer-video'):null}:f.node('#photo-map');
  const second=f.dispatch('#photo-dialog','pointerdown',{target,pointerId:2,clientX:240,clientY:500});
  assert.equal(second.prevented,undefined);assert.equal(second.stopped,undefined);
  f.dispatch(header,'pointermove',{clientX:125,clientY:490});
  f.dispatch(header,'pointerup',{clientX:125,clientY:490});
  assert.equal(f.controller.locationVisible(),true);
  assert.equal(f.node('.photo-viewer').style['--reveal'],f.node('.photo-viewer').style['--location-height']);
  assert.equal(f.node('#photo-dialog').open,true);
  }
});

test('cancelled and ambiguous drags settle without navigating or opening location',()=>{
  const f=viewerFixture();f.api.openDay();
  f.drag('.photo-stage',-150,4,500,'pointercancel');f.flush();assert.equal(f.index,0);
  f.drag('.photo-stage',-80,-80);f.flush();assert.equal(f.index,0);assert.equal(f.locations,0);
  f.drag('#mobile-photo-location',2,-160,500,'pointercancel');assert.equal(f.locations,0);assert.equal(f.node('#photo-location-panel').inert,true);
});

test('visual swipe settling cannot advance a newly opened album after the old viewer closes',()=>{
  const f=viewerFixture();f.api.openDay();f.drag('.photo-stage',-160,0);
  f.node('#photo-dialog').close();f.api.openDay('two');f.flush();assert.equal(f.index,0);
});

test('Back from an in-viewer grid restores its presenting photo and location layer',()=>{
  const f=viewerFixture();f.api.openDay();f.api.selectPhoto(2);f.click('#mobile-photo-location');
  f.click('#mobile-photo-grid');f.click('#mobile-grid-back');
  assert.equal(f.node('#photo-dialog').open,true);assert.equal(f.controller.gridVisible(),false);
  assert.equal(f.controller.locationVisible(),true);assert.equal(f.index,2);
  f.click('#mobile-photo-back');assert.equal(f.node('#photo-dialog').open,false);
});

test('a quick location-close tap after dragging is accepted, and the next swipe leaves it closed',()=>{
  const f=viewerFixture();f.api.openDay();f.drag('#mobile-photo-location',0,-180);
  const close=f.click('#mobile-location-close','.photo-location-heading');
  assert.equal(close.prevented,undefined);assert.equal(f.controller.locationVisible(),false);
  f.drag('.photo-stage',-140,2);assert.equal(f.index,1,'selection changes when the swipe ends');
  assert.equal(f.node('.photo-viewer').dataset.locationVisible,'false');assert.equal(f.pauses,1);
});

test('discard the synthetic drag click without blocking a fresh location-toggle tap',()=>{
  const f=viewerFixture();f.api.openDay();f.drag('#mobile-photo-location',0,-180);
  assert.equal(f.click('#mobile-photo-location','#mobile-photo-location',{synthetic:true}).prevented,true);
  assert.equal(f.controller.locationVisible(),true);
  assert.equal(f.click('#mobile-photo-location').prevented,undefined);
  assert.equal(f.controller.locationVisible(),false);
});

test('swipe-neighbor placeholders stay hidden until mobile photos exist and when closing or resizing to desktop', () => {
  const f = viewerFixture(), neighbors = f.node('#viewer-photo-frame').children;
  assert.equal(neighbors.length, 2);
  assert.ok(neighbors.every(node => node.hidden), 'Empty images cannot paint a broken-image frame on first desktop open');
  f.resize(false); f.api.openDay();
  assert.ok(neighbors.every(node => node.hidden));
  f.resize(true); f.api.selectPhoto(1);
  assert.ok(neighbors.every(node => !node.hidden), 'Both neighbors remain available for mobile swipes');
  f.resize(false);
  assert.ok(neighbors.every(node => node.hidden));
  f.resize(true); f.api.selectPhoto(1); f.node('#photo-dialog').close();
  assert.ok(neighbors.every(node => node.hidden), 'Cleared sources stay hidden after closing');
});

test('double taps cancel the pending chrome toggle and animate zoom',()=>{
  const f=viewerFixture();f.api.openDay();f.click('.photo-stage');
  assert.equal(f.node('.photo-viewer').dataset.chrome,'true');
  f.click('.photo-stage');
  assert.match(f.node('#modal-photo').style.transform,/scale\(1\)/,'zoom starts at the existing size');
  assert.equal(f.node('.photo-viewer').dataset.zoomed,'false','Resting chrome follows the rendered scale');
  f.flush(150);
  const midway=f.node('#modal-photo').style.transform;
  assert.equal(f.node('.photo-viewer').dataset.zoomed,'true','Bars clear as soon as the photo starts enlarging');
  const coverScale=706/(390/(1200/800));
  assert.ok(Number(midway.match(/scale\(([^)]+)\)/)[1]) > 1);
  assert.ok(Number(midway.match(/scale\(([^)]+)\)/)[1]) < coverScale);
  f.flush(150);assert.equal(Number(f.node('#modal-photo').style.transform.match(/scale\(([^)]+)\)/)[1]),coverScale);
  assert.equal(f.node('.photo-viewer').dataset.chrome,'true');
});

test('a delayed history response to closing location cannot restart it or animate the next drag',()=>{
  const f=viewerFixture({deferredHistory:true});f.api.openDay();f.drag('#mobile-photo-location',0,-180);
  f.click('#mobile-location-close','.photo-location-heading');f.drag('.photo-stage',-140,0);
  f.flushHistory();assert.equal(f.index,1);assert.equal(f.controller.locationVisible(),false);
  assert.equal(f.node('.photo-viewer').classList.contains('is-location-settling'),false);
  assert.equal(f.tabs,0,'nested photo navigation must not refit the background day map');
});

test('consecutive swipes advance immediately instead of dropping input during a timer',()=>{
  const f=viewerFixture();f.api.openDay();f.drag('.photo-stage',-150,0);assert.equal(f.index,1);
  f.drag('.photo-stage',-150,0);assert.equal(f.index,2);f.flush();assert.equal(f.index,2);
});

test('photo Back, pull and browser Back return to the presenting grid before the map',()=>{
  for(const control of ['button','pull','browser','escape']) {
    const f=viewerFixture({deferredHistory:true});f.controller.openGrid('one');
    f.node('#viewer-filmstrip').scrollTop=612;
    f.api.selectPhoto(1);f.controller.gridSelected();
    assert.equal(f.node('#mobile-photo-back .button-label').textContent,'Back');
    assert.equal(f.history.state.mobileAtlas.depth,2);
    if(control==='button')f.click('#mobile-photo-back');
    if(control==='pull'){f.drag('.photo-stage',8,180);f.flush();}
    if(control==='browser')f.history.back();
    if(control==='escape')f.node('#photo-dialog').handlers.get('cancel')({preventDefault(){}});
    f.flushHistory();
    assert.equal(f.node('#photo-dialog').open,true,control);assert.equal(f.controller.gridVisible(),true,control);
    assert.equal(f.node('#viewer-filmstrip').scrollTop,612,control);assert.equal(f.index,1,control);
    assert.equal(f.history.state.mobileAtlas.depth,1);
    f.click('#mobile-grid-back');f.flushHistory();
    assert.equal(f.node('#photo-dialog').open,false,control);
    assert.equal(f.node('.atlas-shell').dataset.mobileTab,'map',control);
    f.history.go(1);f.flushHistory();assert.equal(f.controller.gridVisible(),true);
    f.history.go(1);f.flushHistory();assert.equal(f.controller.gridVisible(),false);assert.equal(f.index,1);
  }
});

test('a closed location stays closed through sideways photo swipes and grid round trips',()=>{
  const f=viewerFixture({deferredHistory:true});f.controller.openGrid('one');
  f.api.selectPhoto(1);f.controller.gridSelected();f.click('#mobile-photo-location');
  assert.equal(f.controller.locationVisible(),true);
  f.click('#mobile-location-close','.photo-location-heading');
  f.drag('.photo-stage',-100,-20);
  assert.equal(f.controller.locationVisible(),false,'sideways swipes do not reveal location');
  assert.equal(f.node('.photo-viewer').dataset.locationVisible,'false');
  f.drag('.photo-stage',-150,-35);f.click('#mobile-photo-grid');
  f.api.selectPhoto(0);f.controller.gridSelected();f.flushHistory();
  assert.equal(f.node('#photo-dialog').open,true);
  assert.equal(f.index,0);
  assert.equal(f.controller.locationVisible(),false);
  assert.equal(f.node('#photo-location-panel')['aria-hidden'],'true');
  assert.equal(f.node('#mobile-photo-location')['aria-expanded'],'false');
  assert.equal(f.history.state.mobileAtlas.layer,'photo');
  assert.equal(f.history.state.mobileAtlas.depth,4);
  assert.equal(f.locations,1,'no delayed navigation restarts the location map');
});

test('browser Back restores a photo from its grid, then the original story screen',()=>{
  const f=viewerFixture({deferredHistory:true});f.api.tab('story');f.api.openDay();
  f.click('#mobile-photo-grid');f.history.back();f.flushHistory();
  assert.equal(f.node('#photo-dialog').open,true);assert.equal(f.controller.gridVisible(),false);
  f.click('#mobile-photo-location');f.history.back();f.flushHistory();
  assert.equal(f.node('#photo-dialog').open,false);
  assert.equal(f.node('.atlas-shell').dataset.mobileTab,'story');
});

test('the bottom Day button opens and dismisses the day picker',()=>{
  const f=viewerFixture();f.controller.renderDay();
  f.click('#mobile-day-picker');f.controller.tabChanged();
  assert.equal(f.node('.atlas-shell').dataset.mobileTab,'route');
  assert.equal(f.node('#mobile-day-picker')['aria-expanded'],'true');
  f.click('#mobile-day-picker');f.controller.tabChanged();
  assert.equal(f.node('.atlas-shell').dataset.mobileTab,'map');
  assert.equal(f.node('#mobile-day-picker')['aria-expanded'],'false');
});


test('double-tap zoom respects reduced motion and zooms back to the whole photo',()=>{
  const f=viewerFixture({reducedMotion:true});f.api.openDay();
  f.click('.photo-stage');f.click('.photo-stage');
  assert.equal(Number(f.node('#modal-photo').style.transform.match(/scale\(([^)]+)\)/)[1]),706/(390/(1200/800)));
  f.click('.photo-stage');f.click('.photo-stage');
  assert.match(f.node('#modal-photo').style.transform,/translate3d\(0px,0px,0\) scale\(1\)/);
});

test('a pan interrupts zoom at its current size, and changing photos cancels the animation',()=>{
  const f=viewerFixture();f.api.openDay();f.click('.photo-stage');f.click('.photo-stage');f.flush(100);
  const size=f.node('#modal-photo').style.transform.match(/scale\(([^)]+)\)/)[1];
  f.drag('.photo-stage',30,-100);f.flush();
  assert.equal(f.node('#modal-photo').style.transform.match(/scale\(([^)]+)\)/)[1],size);
  assert.equal(f.controller.locationVisible(),false,'a zoomed photo pans instead of opening location');
  f.api.selectPhoto(1);f.flush();assert.match(f.node('#modal-photo').style.transform,/scale\(1\)/);
});

test('upward photo drags reopen location after dismissal without stale history changing the photo',()=>{
  const f=viewerFixture({deferredHistory:true});f.api.openDay();
  f.drag('.photo-stage',0,-150);assert.equal(f.controller.locationVisible(),true);
  f.click('#mobile-location-close','.photo-location-heading');
  f.drag('.photo-stage',0,-150);f.flushHistory();
  assert.equal(f.controller.locationVisible(),true);assert.equal(f.index,0);
  assert.equal(f.node('#photo-location-panel').inert,false);
  f.drag('.photo-stage',0,150);assert.equal(f.controller.locationVisible(),false);
});

test('All days restores the whole map, saves its scope and supports Back to the selected day',()=>{
  const f=viewerFixture();f.controller.renderDay();
  assert.equal(f.node('#mobile-back .button-label').textContent,'All days');
  f.click('#mobile-back');
  assert.equal(f.api.scope(),'journey');assert.equal(f.node('.atlas-shell').dataset.mobileTab,'map');
  assert.equal(f.node('.atlas-shell').dataset.mapScope,'journey');
  assert.equal(f.history.state.mobileAtlas.scope,'journey');
  assert.equal(f.node('#mobile-day-title').textContent,'Journey');
  f.history.back();assert.equal(f.api.scope(),'day');
  assert.equal(f.node('.atlas-shell').dataset.mapScope,'day');
});


test('Album and About dismiss with Back and restore with Forward on phone and desktop',()=>{
  for(const mobile of [true,false])for(const id of ['album-dialog','notes-dialog']){
    const f=viewerFixture();if(!mobile)f.resize(false);
    f.controller.presentOverlay(id);assert.equal(f.node(`#${id}`).open,true);
    f.history.back();assert.equal(f.node(`#${id}`).open,false);
    f.history.go(1);assert.equal(f.node(`#${id}`).open,true);
    f.controller.dismissOverlay(id);assert.equal(f.node(`#${id}`).open,false);assert.equal(f.history.state.mobileAtlas.overlay,null);
  }
});
test('an album opens its grid, Back restores the album, and Forward restores the same grid',()=>{
  const f=viewerFixture();f.controller.presentOverlay('album-dialog');f.controller.openGrid('two');
  assert.equal(f.node('#album-dialog').open,false);assert.equal(f.controller.gridVisible(),true);
  assert.equal(f.neighborLoads,0,'A grid must not request full-size neighbor images');
  f.history.back();assert.equal(f.node('#photo-dialog').open,false);assert.equal(f.node('#album-dialog').open,true);
  f.history.go(1);assert.equal(f.node('#photo-dialog').open,true);assert.equal(f.controller.gridVisible(),true);
  f.history.back();assert.equal(f.node('#album-dialog').open,true,'Forward must not create extra history entries');
});
test('opening a desktop photo keeps its map and caption controls interactive',()=>{
  const f=viewerFixture();f.resize(false);f.api.openDay('one');
  assert.equal(f.node('#photo-location-panel').inert,false);assert.equal(f.node('.photo-stage').inert,false);
  f.history.back();assert.equal(f.node('#photo-dialog').open,false);
  f.history.go(1);assert.equal(f.node('#photo-dialog').open,true);
});

test('Back and Forward restore the selected index when two collections share the same day',()=>{
  const f=viewerFixture();let collection={ids:['p0','p1','p2'],label:'Day photos'};
  f.api.collection=()=>collection;
  const openDay=f.api.openDay;
  f.api.openDay=(id,options)=>{if(options?.collection)collection=options.collection;openDay(id,options);};
  f.api.openDay();f.api.selectPhoto(2);
  const saved=structuredClone(f.history.state);
  collection={ids:['p2','p0'],label:'Map photos'};f.api.selectPhoto(1);
  f.history.pushState(saved);f.history.go(-1);f.history.go(1);
  assert.deepEqual(collection,{ids:['p0','p1','p2'],label:'Day photos'});
  assert.equal(f.index,2,'Restoring a collection cannot silently return to its first photo');
});

test('deep-link and desktop day rendering update the snapshot inherited by Places history',()=>{
  const f=viewerFixture();f.api.selectDay('two');f.controller.renderDay();
  assert.equal(f.history.state.mobileAtlas.dayId,'two');
  const list={...structuredClone(f.history.state),atlasPlaces:{open:true,placeId:'',depth:1}};
  f.history.pushState(list);
  f.history.pushState({...structuredClone(list),atlasPlaces:{open:true,placeId:'venue',depth:2}});
  f.resize(false);f.resize(true);f.history.back();
  assert.equal(f.api.day().id,'two');
  assert.equal(f.history.state.mobileAtlas.dayId,'two');
});

test('closing an explicit collection returns to the map without leaving a collection on that history entry',()=>{
  const f=viewerFixture();f.api.collection=()=>({ids:['p0','p2'],label:'Map photos'});
  f.api.openDay();f.api.selectPhoto(1);
  f.click('#mobile-photo-back');
  assert.equal(f.node('#photo-dialog').open,false);
  assert.equal(f.history.state.mobileAtlas.viewer,false);
  assert.equal(f.history.state.mobileAtlas.collection,null);
  assert.equal(f.node('.atlas-shell').dataset.mobileTab,'map');
});

test('closing Comments after browsing a cross-day collection keeps the current photo and day',()=>{
  const f=viewerFixture();f.api.collection=()=>({ids:['p0','p1','p2'],label:'Linked place photos'});
  f.api.openDay('one');f.api.selectPhoto(1);f.controller.presentOverlay('comments-dialog');
  f.api.selectDay('two');f.api.selectPhoto(2);
  f.controller.dismissOverlay('comments-dialog');
  assert.equal(f.node('#photo-dialog').open,true);
  assert.equal(f.node('#comments-dialog').open,false);
  assert.equal(f.api.day().id,'two');
  assert.equal(f.index,2);
});


test('disabled Replay cannot open or restore from stale overlay history',()=>{
  for(const mobile of [true,false]) {
    const f=viewerFixture();if(!mobile)f.resize(false);
    // Model a history entry saved before Replay was disabled.
    f.controller.presentOverlay('replay-dialog');f.history.back();
    f.node('#replay-dialog').inert=true;f.node('#replay-dialog').hidden=true;
    const previous=JSON.stringify(f.history.state);
    f.controller.presentOverlay('replay-dialog');
    assert.equal(f.node('#replay-dialog').open,false);
    assert.equal(JSON.stringify(f.history.state),previous,'No new history entry');
    f.history.go(1);assert.equal(f.node('#replay-dialog').open,false);
    f.controller.presentOverlay('album-dialog');assert.equal(f.node('#album-dialog').open,true);
    f.history.back();assert.equal(f.node('#album-dialog').open,false);
    assert.equal(f.node('#replay-dialog').open,false);
  }
});


test('downward pulls dismiss; short, cancelled and lost-capture pulls snap back',()=>{
  for(const [dy,elapsed,type,closed] of [[160,600,'pointerup',true],[50,60,'pointerup',true],[45,700,'pointerup',false],[20,20,'pointerup',false],[180,600,'pointercancel',false],[180,600,'lostpointercapture',false]]) {
    const f=viewerFixture();f.api.openDay();f.api.selectPhoto(1);
    f.drag('.photo-stage',4,dy,elapsed,type);f.flush();
    assert.equal(f.node('#photo-dialog').open,!closed,`${dy}px / ${elapsed}ms / ${type}`);
    assert.equal(f.node('#photo-dialog').classList.contains('is-photo-dismissing'),false);
    assert.equal(f.index,1,'Dismissal never advances the photograph');
    if(closed){f.history.go(1);assert.equal(f.node('#photo-dialog').open,true);assert.equal(f.index,1,'Forward restores the selected photo');}
  }
});

test('a downward pull follows the finger, and a second finger cancels dismissal for pinch',()=>{
  const f=viewerFixture();f.api.openDay();
  const stage=f.node('.photo-stage'),dialog=f.node('#photo-dialog');
  const event={pointerId:1,button:0,clientX:180,clientY:200,target:stage,currentTarget:stage};
  stage.handlers.get('pointerdown')(event);
  stage.handlers.get('pointermove')({...event,clientX:195,clientY:360});
  assert.equal(dialog.style['--dismiss-x'],'15px');assert.equal(dialog.style['--dismiss-y'],'160px');
  assert.ok(Number(dialog.style['--dismiss-scale'])<1);assert.ok(Number(dialog.style['--dismiss-backdrop'])<1);
  stage.handlers.get('pointerdown')({...event,pointerId:2,clientX:250,clientY:360});
  assert.equal(dialog.classList.contains('is-photo-dismissing'),false);
  stage.handlers.get('pointermove')({...event,pointerId:2,clientX:310,clientY:400});
  stage.handlers.get('pointerup')({...event,type:'pointerup'});
  stage.handlers.get('pointerup')({...event,pointerId:2,type:'pointerup'});f.flush();
  assert.equal(dialog.open,true);assert.match(f.node('#modal-photo').style.transform,/scale\([234]/);
});

test('location collapses before photo dismissal; zoom, grids, video and desktop retain their gestures',()=>{
  const f=viewerFixture({reducedMotion:true});f.api.openDay();
  f.drag('.photo-stage',0,-160);f.drag('.photo-stage',0,200);f.flush();
  assert.equal(f.controller.locationVisible(),false);assert.equal(f.node('#photo-dialog').open,true);
  f.click('.photo-stage');f.click('.photo-stage');f.drag('.photo-stage',0,220);f.flush();
  assert.equal(f.node('#photo-dialog').open,true);assert.ok(Number(f.node('#modal-photo').style.transform.match(/scale\(([^)]+)\)/)[1])>1);
  for(const state of ['grid','video','desktop','handle']) {
    const g=viewerFixture({videoIndex:state==='video'?0:-1});g.api.openDay();
    if(state==='grid')g.click('#mobile-photo-grid');if(state==='desktop')g.resize(false);
    g.drag(state==='handle'?'#mobile-photo-location':'.photo-stage',0,220);g.flush();
    assert.equal(g.node('#photo-dialog').open,true,state);
  }
});

test('dismissal settling is cancelled by a new gesture, selection, grid, close or resize',()=>{
  for(const interrupt of ['gesture','photo','grid','overlay','close','resize']) {
    const f=viewerFixture();f.api.openDay();f.drag('.photo-stage',0,180);
    if(interrupt==='gesture')f.drag('.photo-stage',-150,0);
    if(interrupt==='photo')f.api.selectPhoto(1);
    if(interrupt==='grid')f.click('#mobile-photo-grid');
    if(interrupt==='overlay')f.controller.presentOverlay('comments-dialog');
    if(interrupt==='close'){f.node('#photo-dialog').close();f.api.openDay('two');}
    if(interrupt==='resize')f.resize(false);
    f.flush();assert.equal(f.node('#photo-dialog').open,true,interrupt);
    assert.equal(f.node('#photo-dialog').classList.contains('is-photo-dismissing'),false,interrupt);
  }
});

test('reduced motion dismisses immediately without a settling animation',()=>{
  const f=viewerFixture({reducedMotion:true});f.api.openDay();f.drag('.photo-stage',0,180);
  assert.equal(f.node('#photo-dialog').open,false);
  f.api.openDay('two');f.flush();assert.equal(f.node('#photo-dialog').open,true);
});


test('pulling a photo back to its starting point cancels a potential dismissal',()=>{
  const f=viewerFixture();f.api.openDay();
  const stage=f.node('.photo-stage'),event={pointerId:1,button:0,clientX:180,clientY:200,target:stage,currentTarget:stage};
  stage.handlers.get('pointerdown')(event);
  stage.handlers.get('pointermove')({...event,clientY:380});
  stage.handlers.get('pointermove')({...event,clientY:205});
  stage.handlers.get('pointerup')({...event,type:'pointerup',clientY:205});f.flush();
  assert.equal(f.node('#photo-dialog').open,true);
  assert.equal(f.node('#photo-dialog').classList.contains('is-photo-dismissing'),false);
});


test('rapid Back requests cannot skip the source grid while history is pending',()=>{
  const f=viewerFixture({deferredHistory:true});f.controller.openGrid('one');f.controller.gridSelected();
  f.click('#mobile-photo-back');f.click('#mobile-photo-back');f.flushHistory();
  assert.equal(f.node('#photo-dialog').open,true);assert.equal(f.controller.gridVisible(),true);
});

test('the source grid stays under the photo through browsing, a cancelled pull and queued Back',()=>{
  const f=viewerFixture({deferredHistory:true});f.controller.openGrid('one');
  f.node('#viewer-filmstrip').scrollTop=350;f.api.selectPhoto(1);f.controller.gridSelected();
  const origin=JSON.stringify(f.controller.gridOrigin());
  assert.equal(f.node('.photo-viewer').dataset.gridOrigin,'true');
  assert.equal(f.node('.mobile-grid-heading').inert,true);
  assert.equal(f.node('.mobile-grid-heading')['aria-hidden'],'true');
  f.api.selectDay('two');f.api.selectPhoto(2);
  assert.equal(JSON.stringify(f.controller.gridOrigin()),origin,'The source grid does not follow the foreground photo to a different day');
  f.drag('.photo-stage',0,28,800);f.flush();
  assert.equal(f.node('.photo-viewer').dataset.gridOrigin,'true');
  assert.equal(f.node('#viewer-filmstrip').scrollTop,350);
  f.drag('.photo-stage',0,180);f.flush();
  assert.equal(f.node('#photo-dialog').classList.contains('is-photo-dismissing'),true);
  assert.equal(f.node('.photo-viewer').dataset.gridOrigin,'true','Even a delayed history traversal keeps the source grid behind the faded photo');
  f.flushHistory();
  assert.equal(f.controller.gridVisible(),true);assert.equal(f.controller.gridOrigin(),null);
  assert.equal(f.node('.mobile-grid-heading').inert,false);
  assert.equal(f.node('#viewer-filmstrip').scrollTop,350);
  f.history.go(1);f.flushHistory();
  assert.equal(JSON.stringify(f.controller.gridOrigin()),origin,'Forward restores the same source grid');
});

test('Back from a grid opened inside a direct photo never invents a grid background',()=>{
  const f=viewerFixture();f.api.openDay();f.click('#mobile-photo-grid');f.click('#mobile-grid-back');
  assert.equal(f.controller.gridOrigin(),null);
  assert.equal(f.node('.photo-viewer').dataset.gridOrigin,'false');
});

test('opening the current event grid replaces the retained source grid title',()=>{
  const f=viewerFixture();f.controller.openGrid('one');f.controller.gridSelected();
  f.controller.update({day:f.api.days()[1],photos:[{id:'another'}],gridPhotos:[{id:'another'}],index:0});
  assert.equal(f.node('#mobile-grid-title').textContent,'3 photos');
  f.click('#mobile-photo-grid');
  assert.equal(f.node('#mobile-grid-title').textContent,'1 photo');
  assert.equal(f.controller.gridOrigin(),null);
});

test('grid return restores its source event and explicit collection across photo browsing',()=>{
  const f=viewerFixture();const collection={ids:['p2','p0','p1'],label:'Linked place photos'};
  f.api.collection=()=>collection;f.controller.openGrid('one');f.node('#viewer-filmstrip').scrollTop=350;
  f.api.selectPhoto(1);f.controller.gridSelected();f.api.selectDay('two');f.api.selectPhoto(2);
  f.drag('.photo-stage',0,180);f.flush();
  assert.equal(f.api.day().id,'one');assert.equal(f.controller.gridVisible(),true);assert.equal(f.index,1);
  assert.equal(f.node('#viewer-filmstrip').scrollTop,350);
  assert.deepEqual(f.history.state.mobileAtlas.collection,collection);
  f.history.go(1);assert.equal(f.api.day().id,'two');assert.equal(f.index,2);
});


test('album and About history restores dialog scroll after native opening resets it',()=>{
  for(const mobile of [true,false])for(const id of ['album-dialog','notes-dialog']){
    const f=viewerFixture();if(!mobile)f.resize(false);
    const surface=f.node(`#${id}`), original=surface.showModal;
    surface.showModal=function(){original.call(this);this.scrollTop=0;this.scrollLeft=0;};
    f.controller.presentOverlay(id);surface.scrollTop=844;surface.scrollLeft=12;
    f.dispatch(`#${id}`,'scroll');
    f.history.back();f.history.go(1);
    assert.equal(surface.scrollTop,844);assert.equal(surface.scrollLeft,12);
    if(id==='album-dialog'){
      f.controller.openGrid('two');f.history.back();
      assert.equal(surface.scrollTop,844, 'Returning from a day grid keeps the album position');
    }
  }
});
