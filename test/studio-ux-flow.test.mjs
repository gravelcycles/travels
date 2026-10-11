import test from 'node:test';
import assert from 'node:assert/strict';
import '../dist/assets/atlas-utils.js';
import '../studio/photo-batch.js';
import {uiHarness} from './studio-photo-batch-harness.mjs';
const model=globalThis.JOURNEY_ATLAS_PHOTO_BATCH;
const fixture=()=>({journey:{id:'fixture',eventMode:'city',days:[{id:'a',number:1,title:'Base name'},{id:'b',number:2,title:'Prague'}]},photos:[{id:'hash-a',dayId:'a',takenAt:'2026:10:07 18:01:59',caption:'',sourceFilename:'IMG_1234.HEIC'},{id:'hash-b',dayId:'b',caption:'Our dinner'}],state:{photos:{},days:{a:{title:'The edited stop'}},routes:{}}});
test('visual photo metadata uses capture dates and resolved stop titles without inventing captions',()=>{
  const f=fixture(),journey=model.resolvedJourney(f.journey,f.state),photo=f.photos[0];
  assert.deepEqual(model.photoMetadata(photo,journey),{title:'7 Oct · 18:01',detail:'The edited stop'});
  assert.equal(model.matchesPhoto(photo,journey,'7 Oct edited'),true);
  assert.equal(model.matchesPhoto(photo,journey,'IMG_1234'),true);
  assert.equal(model.captureLabel({...photo,takenAt:'2026-10-07 · 12:01'}),'7 Oct · 12:01');
  assert.equal(photo.caption,'');assert.equal(f.journey.days[0].title,'Base name');
  assert.equal(model.photoMetadata({...photo,takenAt:''},journey).title,'Photograph');
});
test('outside-filter selections can be inspected and cleared before an outcome-specific batch action',()=>{
  const h=uiHarness(fixture());h.node('#photo-batch-toggle').handlers.click();h.api.click('hash-a');
  h.node('#photo-day-filter').value='b';h.render();assert.match(h.node('#photo-batch-count').textContent,/1 outside this filter/);
  h.node('#photo-batch-inspect').handlers.click();assert.match(h.node('#studio-photo-grid').innerHTML,/hash-a/);assert.doesNotMatch(h.node('#studio-photo-grid').innerHTML,/hash-b/);
  h.node('#photo-batch-inspect').handlers.click();h.api.click('hash-b');
  h.node('#photo-batch-clear-hidden').handlers.click();assert.match(h.node('#photo-batch-count').textContent,/1 selected · 1 shown/);
  h.node('#photo-batch-action').value='trash';h.render();assert.equal(h.node('#photo-batch-apply').textContent,'Move 1 photo to Trash');
  h.node('#photo-batch-apply').handlers.click();assert.equal(h.f.state.photos['hash-b'].trashed,true);assert.equal(h.f.state.photos['hash-a'],undefined);
});
test('cover focal placement translates the visible crop into image coordinates and clamps its bounds',()=>{
  assert.deepEqual(model.focalFromPoint({x:100,y:50,width:200,height:100,naturalWidth:400,naturalHeight:200}),[50,50]);
  assert.deepEqual(model.focalFromPoint({x:0,y:100,width:100,height:200,naturalWidth:400,naturalHeight:200}),[38,50]);
  assert.deepEqual(model.focalFromPoint({x:-999,y:999,width:100,height:100,naturalWidth:100,naturalHeight:100}),[0,100]);
});

test('single-photo filtering clears an excluded inspector but a previous journey filter cannot clear a new selection',()=>{
  const h=uiHarness(fixture());h.api.click('hash-a');assert.equal(h.selectedPhotoId,'hash-a');
  h.node('#photo-search').value='unmatched';h.render();assert.equal(h.selectedPhotoId,null);
  h.node('#photo-search').value='';h.node('#photo-day-filter').value='previous-journey-day';
  h.api.click('hash-b');assert.equal(h.selectedPhotoId,'hash-b');assert.match(h.node('#studio-photo-grid').innerHTML,/hash-b/);
});
