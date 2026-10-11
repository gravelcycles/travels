import test from 'node:test';
import assert from 'node:assert/strict';
import { photoBubbleFixture as fixture } from './photo-bubble-harness.mjs';
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
