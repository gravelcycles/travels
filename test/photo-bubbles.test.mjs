import test from 'node:test';
import assert from 'node:assert/strict';
import { photoBubbleFixture as fixture } from './photo-bubble-harness.mjs';

test('stationary refreshes keep bubble focus, decoded pixels and pending image requests',()=>{
 const f=fixture({ready:true});f.controller.mapReady();f.flush();
 const marker=f.liveMarkers()[0],button=marker.element.children[0],thumbnail=button.children[1];
 button.focus();const initialLoads=f.loaded.length,initialClears=f.cleared.length;
 for(let i=0;i<3;i++){f.mapEvent('resize');f.mapEvent('moveend');f.controller.refresh();f.flush();}
 assert.equal(f.liveMarkers()[0],marker,'Keep the marker and focused button attached');
 assert.equal(thumbnail.src,'blob:a');assert.equal(f.loaded.length,initialLoads,'Do not restart thumbnail downloads');
 assert.equal(f.cleared.length,initialClears,'Do not release decoded pixels on an unchanged view');
 f.lock();f.flush();assert.equal(thumbnail.hidden,true);assert.equal(thumbnail.src,undefined);
 f.unlock();f.flush();assert.equal(thumbnail.hidden,false);assert.equal(thumbnail.src,'blob:a');
 f.setScope('journey');f.controller.refresh();f.flush();assert.equal(f.liveMarkers().length,0);assert.equal(thumbnail.src,undefined);
});

test('selected groups stay visible when their first photo is offscreen without reordering the album',()=>{
 const f=fixture({ready:true});f.controller.mapReady();f.controller.open(f.photos.slice(0,2),'b');f.flush();
 f.map.project=([lng])=>({x:lng===8?-20:200,y:200});f.mapEvent('moveend');f.flush();
 assert.equal(f.liveMarkers().length,1);assert.deepEqual([...f.liveMarkers()[0].coordinate],[8.001,47]);
 assert.equal(f.node('[data-bubble-count]').textContent,'2 of 2');assert.equal(f.node('map-photo-card').dataset.photoId,'b');
 f.node('[data-bubble-prev]').onclick();f.flush();assert.equal(f.node('map-photo-card').dataset.photoId,'a');
 assert.equal(f.liveMarkers().length,1,'An offscreen current photo still has its visible group');
 f.map.project=()=>({x:-20,y:200});f.mapEvent('moveend');f.flush();assert.equal(f.liveMarkers().length,0);
});

test('a crowded first anchor does not hide a photo group with another usable location',()=>{
 const f=fixture({ready:true});f.controller.mapReady();
 f.map.project=([lng])=>({x:lng===8?100:300,y:200});
 f.setObstacles([{left:0,top:80,right:200,bottom:320}]);
 f.controller.open(f.photos.slice(0,2),'b');f.flush();
 assert.equal(f.liveMarkers().length,1);assert.deepEqual([...f.liveMarkers()[0].coordinate],[8.001,47]);
 assert.equal(f.node('[data-bubble-count]').textContent,'2 of 2');
 const marker=f.liveMarkers()[0];f.setMoving(true);f.map.project=()=>({x:-200,y:-200});f.controller.refresh();f.flush();
 assert.equal(f.liveMarkers()[0],marker,'Intermediate camera positions must not cull the group');
 f.setMoving(false);f.mapEvent('moveend');f.flush();assert.equal(f.liveMarkers().length,0);
});
test('real bubble controller preserves selection across refresh and restores previous history on close',()=>{
 const f=fixture();f.controller.open(f.photos.slice(0,2),'b');assert.equal(f.node('map-photo-card').dataset.photoId,'b');assert.equal(f.node('[data-bubble-count]').textContent,'2 of 2');
 f.controller.refresh();assert.equal(f.node('map-photo-card').dataset.photoId,'b');f.node('[data-bubble-prev]').onclick();assert.equal(f.node('map-photo-card').dataset.photoId,'a');
 f.node('[data-bubble-close]').onclick();assert.equal(f.node('map-photo-card').hidden,true);assert.equal(f.controller.isOpen(),false);assert.equal(f.node('img').src,undefined);
});
test('auth expiry clears protected card pixels and unlock restores through the auth loader',()=>{
 const f=fixture();f.controller.open(f.photos.slice(0,2));assert.equal(f.node('img').src,'blob:a');f.lock();assert.equal(f.node('img').src,undefined);assert.equal(f.node('img').hidden,true);assert.equal(f.node('[data-bubble-unlock]').hidden,false);
 f.unlock();assert.equal(f.node('img').src,'blob:a');assert.ok(f.cleared.length);assert.equal(f.node('[data-bubble-unlock]').hidden,true);
});
test('cross-day linked selection follows the photo day without discarding group order; filter removal cannot show stale content',()=>{
 const f=fixture();f.controller.open([f.photos[0],f.photos[2]]);f.node('[data-bubble-next]').onclick();assert.equal(f.day,'two');assert.equal(f.node('map-photo-card').dataset.photoId,'c');assert.equal(f.node('[data-bubble-count]').textContent,'2 of 2');
 f.setPhotos([f.photos[0]]);f.controller.refresh();assert.equal(f.node('map-photo-card').dataset.photoId,'a');assert.equal(f.day,'one');assert.equal(f.node('[data-bubble-count]').textContent,'1 of 1');f.setPhotos([]);f.controller.refresh();assert.equal(f.node('map-photo-card').hidden,true);
});

test('desktop selection stays inside the existing album sidebar through Places and responsive changes',()=>{
 const f=fixture(),card=f.node('map-photo-card');
 f.node('.story-panel').scrollTop=400;
 f.controller.open(f.photos.slice(0,2),'b');
 assert.equal(card.parentElement,f.node('.story-album-entry'));
 assert.equal(f.node('.story-panel').scrollTop,0);
 f.places(true);assert.equal(card.hidden,true);
 f.places(false);assert.equal(card.hidden,false);assert.equal(card.dataset.photoId,'b');
 f.resize(true);assert.equal(card.parentElement,f.node('.map-panel'));
 assert.equal(card.dataset.photoId,'b');assert.equal(f.node('[data-bubble-count]').textContent,'2 of 2');
 f.resize(false);assert.equal(card.parentElement,f.node('.story-album-entry'));
 f.controller.close();assert.equal(card.hidden,true);
 assert.equal(card.parentElement,f.node('.story-album-entry'));
});
