import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import '../dist/assets/atlas-utils.js';
import '../studio/photo-batch.js';
import {writeStudioDraft, readStudioDraft} from '../scripts/studio-drafts.mjs';
import {reconcile} from '../scripts/studio-reconcile.mjs';
import {validateOverrides, loadContent} from '../scripts/journey-content.mjs';
import {readOverrides} from '../scripts/build-site.mjs';
import {studioSaveHarness} from './studio-save-harness.mjs';
import {uiHarness} from './studio-photo-batch-harness.mjs';
const batch = globalThis.JOURNEY_ATLAS_PHOTO_BATCH;
const repo = path.resolve(import.meta.dirname, '..');
function fixture() {
  return {journey:{id:'trip', days:[{id:'a', number:1, title:'Mountain morning', date:'10 Oct'},{id:'b',number:2,title:'Lake',date:'11 Oct'}]},
    photos:[{id:'p1',dayId:'a',sourceFilename:'IMG_101.HEIC',takenAt:'2026-10-10 08:30'},{id:'p2',dayId:'a',hidden:true},{id:'p3',dayId:'b'},{id:'p4',dayId:'b',trashed:true}],
    state:{photos:{p1:{caption:'Personal words', location:{lat:40,lng:10},hidden:true}},days:{a:{photoOrder:['p2','p1'],leadPhotoId:'p2',text:'Keep day story'},b:{photoOrder:['p4','p3']}},routes:{r:{keep:true}}}};
}

test('batch day assignment is atomic, appends in album order and preserves every unrelated field and source',()=>{
  const f=fixture(),before=structuredClone(f);
  const result=batch.applyBatch({...f,selectedIds:['p1','p2'],action:'assign',dayId:'b'});
  assert.deepEqual(f,before);
  assert.deepEqual(result.state.days.a.photoOrder,[]);
  assert.deepEqual(result.state.days.b.photoOrder,['p4','p3','p2','p1']);
  assert.equal(result.state.days.a.leadPhotoId,undefined);
  assert.equal(result.state.days.a.text,'Keep day story');
  assert.deepEqual(result.state.photos.p1,{...f.state.photos.p1,dayId:'b'});
  assert.equal(result.state.photos.p2.dayId,'b');
  assert.deepEqual(batch.undoBatch(result.state,result.transaction),f.state);
  for(const invalid of [{selectedIds:['p1','foreign']},{dayId:'outside'},{action:'bad'},{selectedIds:[]}]){
    assert.throws(()=>batch.applyBatch({...f,selectedIds:['p1'],action:'assign',dayId:'b',...invalid}));
    assert.deepEqual(f,before,'Failed requests leave the whole draft unchanged');
  }
});
test('move to album start respects existing order, groups per day, and never restores trash',()=>{
  const f=fixture();
  const result=batch.applyBatch({...f,selectedIds:['p3','p1'],action:'first'});
  assert.deepEqual(result.state.days.a.photoOrder,['p1','p2']);
  assert.deepEqual(result.state.days.b.photoOrder,['p3','p4']);
  assert.deepEqual(result.state.photos,f.state.photos);
  assert.throws(()=>batch.applyBatch({...f,selectedIds:['p1','p4'],action:'first'}),/Restore/);
  const both=batch.applyBatch({...f,selectedIds:['p1','p2'],action:'first'});
  assert.deepEqual(both.state.days.a.photoOrder,['p2','p1'],'selection click order does not rewrite album order');
});
test('trash/restore keeps legacy hidden, original pins, order and copy; Undo rejects later conflicting fields',()=>{
  const f=fixture();
  const result=batch.applyBatch({...f,selectedIds:['p1','p2'],action:'trash'});
  assert.equal(result.state.photos.p1.hidden,true);
  assert.deepEqual(result.state.days,f.state.days);
  const later=structuredClone(result.state);later.photos.p1.caption='Later caption';later.days.a.text='Later story';
  const undone=batch.undoBatch(later,result.transaction);
  assert.equal(undone.photos.p1.caption,'Later caption');assert.equal(undone.days.a.text,'Later story');assert.equal(undone.photos.p1.trashed,undefined);
  later.photos.p2.trashed=false;
  const previous=structuredClone(later);
  assert.throws(()=>batch.undoBatch(later,result.transaction),/changed again/);assert.deepEqual(later,previous);
  const restored=batch.applyBatch({...f,state:result.state,selectedIds:['p1','p2'],action:'restore'});
  assert.equal(restored.state.photos.p1.trashed,false);assert.equal(restored.state.photos.p1.hidden,true);
});
test('search combines day, filename, capture date and text without treating hidden photos as trash; select-all touches only shown',()=>{
  const f=fixture(),photos=batch.orderedPhotos(f.journey,f.photos,f.state);
  assert.deepEqual(batch.filterPhotos(photos,f.journey).map(p=>p.id),['p2','p1','p3']);
  assert.deepEqual(batch.filterPhotos(photos,f.journey,{query:'img_101 08:30',dayId:'a'}).map(p=>p.id),['p1']);
  assert.equal(batch.filterPhotos(photos,f.journey,{query:'personal mountain'}).length,1);
  assert.deepEqual(batch.filterPhotos(photos,f.journey,{trash:true}).map(p=>p.id),['p4']);
  assert.deepEqual([...batch.toggleVisible(new Set(['outside']),['p1','p2'])],['outside','p1','p2']);
  assert.deepEqual([...batch.toggleVisible(new Set(['outside','p1','p2']),['p1','p2'])],['outside']);
});
test('batch changes survive standard disk draft recovery and real planner Save, with existing concurrent-edit conflict review',async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'studio-batch-recovery-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const {data}=loadContent(repo), journey=data.journeys.find(j=>j.published&&j.photos.length>2), state=readOverrides(repo);
  const chosen=journey.photos.find(p=>p.dayId!==journey.days.at(-1).id);
  const edited=batch.applyBatch({journey,photos:journey.photos,state,selectedIds:[chosen.id],action:'assign',dayId:journey.days.at(-1).id}).state;
  validateOverrides(edited,data);
  writeStudioDraft(root,'batch-tab',{schema:1,sequence:1,dirty:true,state:edited,plans:[],journeyId:journey.id});
  const recovered=readStudioDraft(root,'batch-tab').state;assert.deepEqual(recovered,edited);
  const f=studioSaveHarness(data,journey,recovered);assert.equal(await f.context.savePlan(),true);
  assert.equal(f.requests[0].state.photos[chosen.id].dayId,journey.days.at(-1).id);
  const disk=structuredClone(state);disk.days[journey.days[0].id]={...disk.days[journey.days[0].id],text:'Another editor'};
  const merged=reconcile(state,recovered,disk,{prefix:['state']});
  assert.equal(merged.value.photos[chosen.id].dayId,journey.days.at(-1).id);
  assert.equal(merged.value.days[journey.days[0].id].text,'Another editor');
  disk.photos[chosen.id]={...disk.photos[chosen.id],dayId:journey.days[1].id};
  assert.ok(reconcile(state,recovered,disk,{prefix:['state']}).conflicts.some(conflict=>conflict.path.includes(chosen.id)));
});

test('contact-sheet controls keep selection across filters, apply all selected and show empty search / journey reset',()=>{
  const h=uiHarness(fixture());h.node('#photo-batch-toggle').handlers.click();
  h.api.click('p1');h.node('#photo-day-filter').value='b';h.render();
  assert.match(h.node('#photo-batch-count').textContent,/1 selected · 1 outside this filter · 1 shown/);
  h.node('#photo-batch-all').handlers.click();assert.match(h.node('#photo-batch-count').textContent,/2 selected/);
  h.node('#photo-batch-action').value='trash';h.node('#photo-batch-apply').handlers.click();
  assert.equal(h.f.state.photos.p1.trashed,true);assert.equal(h.f.state.photos.p3.trashed,true);
  h.node('#photo-batch-undo').handlers.click();assert.equal(h.f.state.photos.p1.trashed,undefined);
  h.node('#photo-search').value='no match';h.node('#photo-search').handlers.input();assert.match(h.node('#studio-photo-grid').innerHTML,/No matching photos/);
  h.api.reset();assert.match(h.node('#photo-batch-count').textContent,/0 selected/);assert.equal(h.node('#photo-batch-undo').disabled,true);
});
