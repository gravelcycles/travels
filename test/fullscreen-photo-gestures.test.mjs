import test from 'node:test';
import assert from 'node:assert/strict';
import {viewerFixture} from './mobile-viewer-harness.mjs';

function imageTransform(f) {
  const transform=f.node('#modal-photo').style.transform;
  const match=transform.match(/translate3d\(([-\d.e]+)px,\s*([-\d.e]+)px,\s*0\) scale\(([-\d.e]+)\)/);
  assert.ok(match,`Expected image transform, got ${transform}`);
  return {x:Number(match[1]),y:Number(match[2]),scale:Number(match[3])};
}
function touch(f,type,id,x,y) {
  return f.dispatch('.photo-stage',type,{pointerId:id,pointerType:'touch',clientX:x,clientY:y});
}
function assertClose(actual,expected,message) {assert.ok(Math.abs(actual-expected)<.001,`${message}: ${actual} versus ${expected}`);}

test('one photo tap hides every chrome group; a second separated tap restores them',()=>{
  const f=viewerFixture();f.api.openDay();
  const controls=['.mobile-photo-header','.mobile-photo-footer','.mobile-photo-actions','.photo-close','#album-continue'];
  f.click('.photo-stage');f.flush(200);
  assert.equal(f.node('.photo-viewer').dataset.chrome,'true','Wait for a possible double tap');
  f.flush(100);
  assert.equal(f.node('.photo-viewer').dataset.chrome,'false');
  for(const selector of controls)assert.equal(f.node(selector).inert,true,`${selector} is excluded from focus and input`);
  f.click('.photo-stage');f.flush(300);
  assert.equal(f.node('.photo-viewer').dataset.chrome,'true');
  for(const selector of controls)assert.equal(f.node(selector).inert,false,`${selector} is usable again`);
});

test('a double tap preserves hidden chrome while zooming around the tapped point',()=>{
  const f=viewerFixture({reducedMotion:true});f.api.openDay();f.click('.photo-stage');f.flush();
  f.node('#modal-photo').naturalHeight=1200;
  f.click('.photo-stage','.photo-stage',{x:120,y:350});f.flush(100);f.click('.photo-stage','.photo-stage',{x:120,y:350});
  assert.equal(imageTransform(f).scale,2);
  assert.equal(f.node('.photo-viewer').dataset.chrome,'false');
  f.flush(400);assert.equal(f.node('.photo-viewer').dataset.chrome,'false','No delayed first-tap toggle survives the double tap');
});

test('the top-right Close action returns to the presenting grid and keyboard navigation restores hidden controls',()=>{
  const f=viewerFixture();f.api.openDay('one',{grid:true});f.node('#viewer-filmstrip').scrollTop=300;f.controller.gridSelected();
  f.click('.photo-stage');f.flush();assert.equal(f.node('.photo-viewer').dataset.chrome,'false');
  f.keydown('Tab');
  assert.equal(f.node('.photo-viewer').dataset.chrome,'true');
  assert.equal(f.node('.photo-close').inert,false);
  f.click('.photo-close');
  assert.equal(f.node('#photo-dialog').open,true);assert.equal(f.controller.gridVisible(),true);
  assert.equal(f.node('#viewer-filmstrip').scrollTop,300);
});

test('swipe, grid, close, overlay and resize cancel a pending photo tap',()=>{
  for(const interrupt of ['swipe','grid','close','overlay','resize','desktop','cancel']) {
    const f=viewerFixture();f.api.openDay();f.click('.photo-stage');
    if(interrupt==='swipe')f.drag('.photo-stage',-150,0);
    if(interrupt==='grid')f.click('#mobile-photo-grid');
    if(interrupt==='close'){f.node('#photo-dialog').close();f.api.openDay('two');}
    if(interrupt==='overlay')f.controller.presentOverlay('comments-dialog');
    if(interrupt==='resize')f.resizeViewport();
    if(interrupt==='desktop')f.resize(false);
    if(interrupt==='cancel'){touch(f,'pointerdown',1,180,350);touch(f,'pointercancel',1,180,350);}
    f.flush(500);
    assert.equal(f.node('.photo-viewer').dataset.chrome,'true',`${interrupt} must not hide a replacement surface later`);
  }
});

test('pinch follows the moving midpoint while preserving the image point under it',()=>{
  const f=viewerFixture();f.api.openDay();f.node('#modal-photo').naturalWidth=1200;f.node('#modal-photo').naturalHeight=1200;
  f.click('.photo-stage');
  touch(f,'pointerdown',1,180,353);touch(f,'pointerdown',2,280,353);
  touch(f,'pointermove',1,150,363);touch(f,'pointermove',2,350,363);f.frame();
  const result=imageTransform(f);
  assertClose(result.scale,2,'Finger distance controls scale');
  assertClose(result.x,-15,'The initial midpoint image coordinate stays under the moving fingers');
  assertClose(result.y,10,'Moving both fingers vertically pans the image');
  touch(f,'pointerup',1,150,363);
  touch(f,'pointermove',2,365,373);f.frame();
  const continued=imageTransform(f);
  assertClose(continued.scale,2,'Lifting one finger keeps the zoom scale');
  assertClose(continued.x,0,'The remaining finger continues panning without a jump');
  assertClose(continued.y,20,'The remaining finger pans vertically');
  touch(f,'pointerup',2,365,373);f.flush(500);
  assert.equal(f.node('.photo-viewer').dataset.chrome,'true','Starting a pinch cancels the preceding single tap');
  assert.equal(f.index,0);assert.equal(f.controller.locationVisible(),false);
  assert.equal(f.node('#photo-dialog').open,true);
});

test('a narrow panoramic photo can zoom far enough to cover the full phone viewport',()=>{
  const f=viewerFixture();f.api.openDay();const img=f.node('#modal-photo');img.naturalWidth=4000;img.naturalHeight=500;
  touch(f,'pointerdown',1,170,353);touch(f,'pointerdown',2,220,353);
  touch(f,'pointermove',1,-305,353);touch(f,'pointermove',2,695,353);f.frame();
  const {scale}=imageTransform(f), fittedHeight=390/(4000/500);
  assert.ok(fittedHeight*scale>=706-.001,'The four-times default limit must not leave a panoramic photo trapped in a strip');
  touch(f,'pointerup',1,-305,353);touch(f,'pointerup',2,695,353);
  f.drag('.photo-stage',2000,2000);
  const panned=imageTransform(f);
  assert.ok(Math.abs(panned.x)<=(390*scale-390)/2+.001);
  assert.ok(Math.abs(panned.y)<=(fittedHeight*scale-706)/2+.001);
  assert.equal(f.controller.locationVisible(),false);assert.equal(f.node('#photo-dialog').open,true);
});

test('a pinch returning to fitted size cannot turn its remaining finger into browse or dismiss',()=>{
  for (const [dx,dy] of [[0,180],[-180,0],[0,-180]]) {
    const f=viewerFixture();f.api.openDay();
    touch(f,'pointerdown',1,140,350);touch(f,'pointerdown',2,240,350);
    touch(f,'pointermove',2,245,350);touch(f,'pointerup',1,140,350);
    touch(f,'pointermove',2,245+dx,350+dy);touch(f,'pointerup',2,245+dx,350+dy);f.flush();
    assert.equal(f.index,0);assert.equal(f.controller.locationVisible(),false);assert.equal(f.node('#photo-dialog').open,true);
  }
});

test('control taps and native video taps never toggle photo chrome',()=>{
  const f=viewerFixture();f.api.openDay();
  for(const selector of ['.photo-close','#open-photo-comments','#mobile-share-photo']) {
    f.click(selector,'.photo-stage');f.flush(500);
    assert.equal(f.node('.photo-viewer').dataset.chrome,'true',selector);
  }
  const video=viewerFixture({videoIndex:0});video.api.openDay();video.click('.photo-stage');video.flush(500);
  assert.equal(video.node('.photo-viewer').dataset.chrome,'true');
});

test('photo-only browsing stays clean across swipes and hides an open location panel',()=>{
  const f=viewerFixture();f.api.openDay();f.click('#mobile-photo-location');
  assert.equal(f.controller.locationVisible(),true);
  f.click('.photo-stage');f.flush(300);
  assert.equal(f.controller.locationVisible(),false);
  assert.equal(f.node('#photo-location-panel').inert,true);
  assert.equal(f.node('.photo-viewer').dataset.chrome,'false');
  f.drag('.photo-stage',-150,0);
  const generatedClick=f.click('.photo-stage','.photo-stage',{synthetic:true});f.flush(400);
  assert.equal(generatedClick.prevented,true);
  assert.equal(f.index,1);
  assert.equal(f.node('.photo-viewer').dataset.chrome,'false','Swipes and their synthetic click do not reveal chrome');
  f.click('.photo-stage');f.flush(300);
  assert.equal(f.node('.photo-viewer').dataset.chrome,'true');
  assert.equal(f.controller.locationVisible(),false,'Restoring controls does not reopen location');
});


test('zoomed chrome follows the photo through pan, hidden controls and reset boundaries',()=>{
  for(const reset of ['zoom-out','photo','location','desktop','close']) {
    const f=viewerFixture({reducedMotion:true});f.api.openDay();
    f.click('.photo-stage');f.click('.photo-stage');
    assert.equal(f.node('.photo-viewer').dataset.zoomed,'true');
    f.drag('.photo-stage',30,20);
    assert.equal(f.node('.photo-viewer').dataset.zoomed,'true');
    f.click('.photo-stage');f.flush(300);
    assert.equal(f.node('.photo-viewer').dataset.chrome,'false');
    assert.equal(f.node('.photo-viewer').dataset.zoomed,'true');
    f.click('.photo-stage');f.flush(300);
    assert.equal(f.node('.photo-viewer').dataset.chrome,'true');
    if(reset==='zoom-out'){f.click('.photo-stage');f.click('.photo-stage');}
    if(reset==='photo')f.api.selectPhoto(1);
    if(reset==='location')f.click('#mobile-photo-location');
    if(reset==='desktop')f.resize(false);
    if(reset==='close'){f.node('#photo-dialog').close();f.resizeViewport();}
    assert.equal(f.node('.photo-viewer').dataset.zoomed,'false',reset);
  }
});
