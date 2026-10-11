import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadContent } from '../scripts/journey-content.mjs';
import { validatePointsOfInterest } from '../scripts/places-content.mjs';
import { prepareJourneyPlan } from '../scripts/journey-planner.mjs';
import { reconcile,conflictReview } from '../scripts/studio-reconcile.mjs';
import { studioDraftDiff } from '../scripts/studio-draft-diff.mjs';
import { writePlanSources } from '../scripts/studio-plan-sources.mjs';
import { buildSite } from '../scripts/build-site.mjs';
import '../dist/assets/photo-places.js';
import '../studio/place-editor.js';
import '../studio/plan-extras.js';
const model=globalThis.JOURNEY_ATLAS_PHOTO_PLACES, editor=globalThis.JOURNEY_ATLAS_PLACE_EDITOR;
const photo=(id,lng=8,lat=47)=>({id,dayId:'one',lng,lat});
const point={id:'cafe',name:'Cafe',coordinates:[8,47],dayIds:['one'],photoIds:['no-location','second']};

test('explicit links preserve editorial order, admit unlocated photos and filter trash/hidden/group projection',()=>{
 const noLocation={id:'no-location',dayId:'two'},photos=[photo('first'),photo('second'),noLocation,{...photo('hidden'),hidden:true},{...photo('trash'),trashed:true}];
 const result=model.photosForPlace(point,photos);assert.deepEqual(result.linked.map(p=>p.id),['no-location','second']);
 assert.deepEqual(model.photosForPlace(point,photos.filter(p=>p.id!=='second')).linked.map(p=>p.id),['no-location']);
 const before=structuredClone(point);model.photosForPlace(point,photos);assert.deepEqual(point,before,'Rendering never writes editorial associations');
 assert.equal(model.placeForPhoto(noLocation,[point]).point,point);assert.equal(model.placeForPhoto(photo('first'),[point]),null);
 assert.equal(model.placeForPhoto({...photo('other'),dayId:'three'},[point]),null);
});
test('GPS proximity never associates photos with places, even at identical coordinates',()=>{
 for(const dayIds of [[],['one']]){
  const unlinked={...point,dayIds,photoIds:[]},photos=[photo('same'),photo('close',8.0001),photo('far',8.1),{id:'unlocated',dayId:'one'}];
  assert.deepEqual(model.photosForPlace(unlinked,photos),{linked:[]});
  for(const p of photos)assert.equal(model.placeForPhoto(p,[unlinked]),null);
 }
});
test('selected groups retain members, order and selected photo through zoom and pan, with no duplicates',()=>{
 const photos=[photo('a'),photo('b',8.001),photo('c',8.1)],chosen={ids:['b','a'],photoId:'a'};
 for(const scale of [100,10000]){const groups=model.bubbleGroups(photos,[photos[1],photos[0]],([x,y])=>({x:x*scale,y:y*scale}),80,6);assert.deepEqual(groups[0].photos.map(p=>p.id),['b','a']);assert.equal(new Set(groups.flatMap(g=>g.photos.map(p=>p.id))).size,3);}
 assert.deepEqual(model.retainedSelection(chosen,photos),chosen);assert.deepEqual(model.retainedSelection(chosen,[photos[1]]),{ids:['b'],photoId:'b'});
 assert.equal(model.retainedSelection(chosen,[]),null);
});
test('bubble placement avoids map controls and never invents a map coordinate for unlocated photos',()=>{
 const project=([x,y])=>({x,y});assert.equal(model.groupPhotos([{id:'unlocated'}],project).length,0);
 const obstacle={left:0,right:200,top:0,bottom:200};assert.equal(model.bubblePlacement({x:100,y:100},48,{width:200,height:200},[obstacle]),null);
 const result=model.bubblePlacement({x:100,y:100},48,{width:400,height:400},[{left:60,right:140,top:10,bottom:80}]);assert.ok(result);assert.ok(result.box.top>=80 || result.box.left>=140 || result.box.right<=60);
});

test('selected membership and order survive when only a later member is in view',()=>{
 const selected=[photo('outside'),photo('inside',8.001)],groups=model.bubbleGroups([selected[1]],selected,([x,y])=>({x,y}),80,6);
 assert.deepEqual(groups.map(group=>group.photos.map(photo=>photo.id)),[['outside','inside']]);
 assert.deepEqual(model.bubbleGroups([],selected,([x,y])=>({x,y}),80,6),[]);
});
test('owner link/unlink/reorder edits explicit references without changing photo metadata',()=>{
 const item=structuredClone(point),photos=[photo('a'),{id:'no-location'},photo('second')],original=structuredClone(photos);
 editor.linkPhoto(item,'a',true,photos);editor.move(item.photoIds,2,-1);assert.deepEqual(item.photoIds,['no-location','a','second']);editor.linkPhoto(item,'a',false,photos);assert.deepEqual(item.photoIds,point.photoIds);assert.deepEqual(photos,original);
 assert.throws(()=>editor.linkPhoto(item,'foreign',true,photos),/journey/);const draft={id:'blank'};assert.deepEqual(editor.newPoint(draft).coordinates,[],'An unfinished place never gets [0,0]');
});
test('place association validation rejects missing, foreign and duplicate photo references',()=>{
 const journey=structuredClone(loadContent(path.resolve(import.meta.dirname,'..')).data.journeys.find(j=>j.id==='alpine-crossing'));
 assert.doesNotThrow(()=>validatePointsOfInterest(journey));
 for(const photoIds of [['foreign'],[journey.photos[0].id,journey.photos[0].id],'not-an-array']){const changed=structuredClone(journey);changed.pointsOfInterest[0].photoIds=photoIds;assert.throws(()=>validatePointsOfInterest(changed),/photoIds/);}
});
test('independent place edits merge; concurrent ordering and remove/edit have named conflicts',()=>{
 const base={pointsOfInterest:[{...point,summary:'Original'}]},draft=structuredClone(base),saved=structuredClone(base);draft.pointsOfInterest[0].summary='Mine';saved.pointsOfInterest[0].note='Theirs';
 const merged=reconcile(base,draft,saved,{prefix:['plan','trip']});assert.equal(merged.conflicts.length,0);assert.equal(merged.value.pointsOfInterest[0].note,'Theirs');
 saved.pointsOfInterest[0].summary='Conflict';const conflicts=reconcile(base,draft,saved,{prefix:['plan','trip']}).conflicts;const rows=conflictReview(conflicts,{journeys:[{id:'trip',title:'Trip',pointsOfInterest:base.pointsOfInterest}]});assert.match(rows[0].label,/Cafe.*Summary/);
 saved.pointsOfInterest=[];assert.ok(reconcile(base,draft,saved).conflicts.length);
});
test('place saving preserves split photo manifests and excludes local/trashed links only from public output',t=>{
 const repo=path.resolve(import.meta.dirname,'..'),root=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-photo-places-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));for(const directory of ['content','dist','workers'])fs.cpSync(path.join(repo,directory),path.join(root,directory),{recursive:true});
 const data=loadContent(root).data,base=data.journeys.find(j=>j.id==='alpine-crossing'),state={photos:{},days:{},routes:{}};
 const next=structuredClone(base);next.pointsOfInterest[0].note='A changed memory';next.pointsOfInterest[0].photoIds=[base.photos[0].id];
 const sourcesBefore=fs.readFileSync(path.join(root,'content/photo-manifests/alpine-crossing.json'),'utf8');const planned=prepareJourneyPlan(data,base,globalThis.JOURNEY_ATLAS_PLAN_EXTRAS.changes(next),state);writePlanSources(root,base,planned.journey);
 assert.equal(fs.readFileSync(path.join(root,'content/photo-manifests/alpine-crossing.json'),'utf8'),sourcesBefore);assert.equal(loadContent(root).data.journeys.find(j=>j.id===base.id).pointsOfInterest[0].note,'A changed memory');
 fs.writeFileSync(path.join(root,'content/photo-overrides.json'),JSON.stringify({[base.photos[0].id]:{trashed:true}}));buildSite(root);
 const bundle=fs.readFileSync(path.join(root,'dist/assets/journeys.js'),'utf8');const publicData=JSON.parse(bundle.slice(bundle.indexOf(' = ')+3).trim().slice(0,-1));assert.deepEqual(publicData.journeys.find(j=>j.id===base.id).pointsOfInterest[0].photoIds,[]);
 assert.deepEqual(loadContent(root).data.journeys.find(j=>j.id===base.id).pointsOfInterest[0].photoIds,[base.photos[0].id]);
 const diff=studioDraftDiff(data,state,{state,plans:[[base.id,{draft:next}]]});assert.ok(diff.some(row=>row.kind==='Place' && row.field==='Memory'));
});
