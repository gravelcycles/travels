import test from 'node:test';
import assert from 'node:assert/strict';
import { photoBubbleFixture as fixture } from './photo-bubble-harness.mjs';
test('real bubble controller preserves selection across refresh and restores previous history on close',()=>{
 const f=fixture();f.controller.open(f.photos.slice(0,2),'b');assert.equal(f.node('map-photo-card').dataset.photoId,'b');assert.equal(f.node('[data-bubble-count]').textContent,'2 / 2');
 f.controller.refresh();assert.equal(f.node('map-photo-card').dataset.photoId,'b');f.node('[data-bubble-prev]').onclick();assert.equal(f.node('map-photo-card').dataset.photoId,'a');
 f.node('[data-bubble-close]').onclick();assert.equal(f.node('map-photo-card').hidden,true);assert.equal(f.controller.isOpen(),false);assert.equal(f.node('img').src,undefined);
});
test('auth expiry clears protected card pixels and unlock restores through the auth loader',()=>{
 const f=fixture();f.controller.open(f.photos.slice(0,2));assert.equal(f.node('img').src,'blob:a');f.lock();assert.equal(f.node('img').src,undefined);assert.equal(f.node('img').hidden,true);assert.equal(f.node('[data-bubble-unlock]').hidden,false);
 f.unlock();assert.equal(f.node('img').src,'blob:a');assert.ok(f.cleared.length);assert.equal(f.node('[data-bubble-unlock]').hidden,true);
});
test('cross-day linked selection follows the photo day without discarding group order; filter removal cannot show stale content',()=>{
 const f=fixture();f.controller.open([f.photos[0],f.photos[2]]);f.node('[data-bubble-next]').onclick();assert.equal(f.day,'two');assert.equal(f.node('map-photo-card').dataset.photoId,'c');assert.equal(f.node('[data-bubble-count]').textContent,'2 / 2');
 f.setPhotos([f.photos[0]]);f.controller.refresh();assert.equal(f.node('map-photo-card').dataset.photoId,'a');assert.equal(f.day,'one');assert.equal(f.node('[data-bubble-count]').textContent,'1 / 1');f.setPhotos([]);f.controller.refresh();assert.equal(f.node('map-photo-card').hidden,true);
});

test('desktop selection stays inside the existing album sidebar through Places and responsive changes',()=>{
 const f=fixture(),card=f.node('map-photo-card');
 f.node('.story-panel').scrollTop=400;
 f.controller.open(f.photos.slice(0,2),'b');
 assert.equal(card.parentElement,f.node('.story-album-entry'));
 assert.equal(f.node('.story-panel').scrollTop,0);
 assert.equal(f.node('sidebar-day-details').open,false);
 assert.equal(f.node('.photo-section').position,'before');
 f.places(true);assert.equal(card.hidden,true);
 f.places(false);assert.equal(card.hidden,false);assert.equal(card.dataset.photoId,'b');
 f.resize(true);assert.equal(card.parentElement,f.node('.map-panel'));
 assert.equal(f.node('sidebar-day-details').open,true);assert.equal(f.node('.photo-section').position,'after');
 assert.equal(card.dataset.photoId,'b');assert.equal(f.node('[data-bubble-count]').textContent,'2 / 2');
 f.resize(false);assert.equal(card.parentElement,f.node('.story-album-entry'));
 f.controller.close();assert.equal(card.hidden,true);
 assert.equal(card.parentElement,f.node('.story-album-entry'));
});

test('the photo button opens the selected photo with mouse or keyboard, while swipes only browse',()=>{
 const f=fixture(),button=f.node('[data-bubble-full]');
 f.controller.open(f.photos.slice(0,2));
 button.onclick({detail:1});assert.deepEqual(f.opened,['a']);
 button.fire('pointerdown',{clientX:100,clientY:50,pointerId:1});
 button.fire('pointerup',{clientX:20,clientY:52,pointerId:1});
 let prevented=false;button.onclick({detail:1,preventDefault(){prevented=true;}});
 assert.equal(prevented,true);assert.deepEqual(f.opened,['a']);
 assert.equal(f.node('map-photo-card').dataset.photoId,'b');
 button.onclick({detail:0});assert.deepEqual(f.opened,['a','b']);
 f.lock();button.onclick({detail:0});assert.equal(f.prompts,1);assert.deepEqual(f.opened,['a','b']);
});
test('scrolling or cancelled touches cannot accidentally open full screen',()=>{
 const f=fixture(),button=f.node('[data-bubble-full]');f.controller.open(f.photos.slice(0,2));
 for(const cancel of [false,true]){
  button.fire('pointerdown',{clientX:20,clientY:20,pointerId:1});
  if(cancel)button.fire('pointercancel',{});
  else button.fire('pointerup',{clientX:22,clientY:100,pointerId:1});
  button.onclick({detail:1,preventDefault(){}});
 }
 assert.deepEqual(f.opened,[]);assert.equal(f.node('map-photo-card').dataset.photoId,'a');
 button.fire('pointerdown',{clientX:20,clientY:20,pointerId:2});
 button.fire('pointerup',{clientX:21,clientY:22,pointerId:2});
 button.onclick({detail:1});assert.deepEqual(f.opened,['a']);
});
test('portraits use their own proportions and blank captions never repeat accessibility text',()=>{
 const f=fixture();f.photos[0].alt='Accessibility only';f.controller.open(f.photos.slice(0,1));
 assert.equal(f.node('map-photo-card').style['--selected-photo-ratio'],'0.75');
 assert.equal(f.node('[data-bubble-caption]').textContent,'');assert.equal(f.node('[data-bubble-caption]').hidden,true);
});
test('browsing a selection keeps each map thumbnail tied to its anchor and filters cross-day members',()=>{
 const f=fixture();f.controller.open(f.photos.slice(0,2));
 let markers=f.draw();assert.equal(markers.length,1);
 assert.equal(markers[0].element.children[0].children[1].src,'blob:a');
 f.node('[data-bubble-next]').onclick();markers=f.draw();
 assert.equal(markers[0].element.children[0].children[1].src,'blob:a','The map anchor must not turn into the currently browsed photo');
 f.controller.open([f.photos[0],f.photos[2]]);f.node('[data-bubble-next]').onclick();markers=f.draw();
 assert.equal(markers.length,1);assert.deepEqual(Array.from(markers[0].position),[9,48]);
 assert.equal(markers[0].element.children[0].children[1].src,'c.jpg');
});

test('album browsing does not collapse the day map into a selected bubble',()=>{
 const f=fixture();f.setPhotos([...f.photos,{id:'d',dayId:'one',lng:8.4,lat:47}]);
 assert.equal(f.draw().length,2);
 f.controller.open(f.photos.filter(photo=>photo.dayId==='one'),'d');
 const markers=f.draw();assert.equal(markers.length,2);
 assert.deepEqual(markers.map(marker=>marker.element.children[0].children[1].src),['blob:a','d.jpg']);
});
