import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {loadContent, writeJson} from '../scripts/journey-content.mjs';
import {prepareJourneyPlan, journeyRevision} from '../scripts/journey-planner.mjs';
import {writePlanSources} from '../scripts/studio-plan-sources.mjs';
import {readOverrides, buildSite} from '../scripts/build-site.mjs';
import {createJourney} from '../scripts/create-journey.mjs';
import '../studio/plan-extras.js';
const extras = globalThis.JOURNEY_ATLAS_PLAN_EXTRAS;
const repo = path.resolve(import.meta.dirname,'..');
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(),'atlas-studio-plan-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  for (const dir of ['content','dist']) fs.cpSync(path.join(repo,dir),path.join(root,dir),{recursive:true,filter:filename=>!filename.includes('/drafts/')});
  return root;
}
const sample = () => loadContent(repo).data.journeys.find(journey=>journey.routeGroups?.length);

test('membership moves are exclusive and referenced groups cannot silently become shared', () => {
  const draft=sample(), original=structuredClone(draft), [first,second]=draft.routeGroups, person=first.travelerIds[0];
  extras.assignTraveler(draft,person,second.id);
  assert.ok(!first.travelerIds.includes(person)); assert.ok(second.travelerIds.includes(person));
  assert.throws(()=>extras.assignTraveler(draft,person,'missing'),/Choose a route/);
  assert.throws(()=>extras.removeGroup(draft,first.id),/Reassign.*travelers.*legs.*photos/);
  draft.routeGroups.push({id:'unused',label:'Unused',travelerIds:[]});
  extras.removeGroup(draft,'unused'); assert.ok(!draft.routeGroups.some(group=>group.id==='unused'));
  assert.deepEqual(draft.segments,original.segments); assert.deepEqual(draft.photos,original.photos);
});

test('Studio forms escape editorial text and expose editable group, overnight, meetup and video fields', () => {
  const draft=sample(); draft.travelers[0].name='<img onerror=evil>'; draft.routeGroups[0].label='A "route"';
  draft.videos[0].caption='</textarea><script>bad</script>';
  assert.match(extras.party(draft), /&lt;img onerror=evil&gt;/);
  assert.doesNotMatch(extras.videos(draft), /<script>/);
  assert.match(extras.videos(draft), /data-video-field="poster"/);
  assert.match(extras.videos(draft), /data-video-field="assetStatus"/);
  assert.match(extras.meetup(draft), /data-meetup-field="placeId"/);
  assert.match(extras.overnights(draft,draft.days[0]), /data-group-overnight=/);
  assert.match(extras.audience(draft,draft.segments[0],'leg','Travelers'), /data-audience-group=/);
  assert.equal(extras.audience({routeGroups:[]},{},'leg','Travelers'),'');
  assert.equal(extras.publicUrl('javascript:alert(1)'),false); assert.equal(extras.publicUrl('https://user:pass@example.com/clip.mp4'),false);
});

test('planner round-trips group/video edits and photo assignments through their canonical sources', t => {
  const root=fixture(t), {data}=loadContent(root), base=data.journeys.find(j=>j.routeGroups?.length), state=readOverrides(root);
  const draft=structuredClone(base), first=draft.routeGroups[0], second=draft.routeGroups[1];
  draft.travelers[0].name='Alex edited'; first.label='Mountain route edited';
  extras.assignTraveler(draft,first.travelerIds[0],second.id);
  draft.meetup.label='Lunch together'; draft.videos[0].title='Edited video'; draft.videos[0].hidden=true;
  const changes=Object.fromEntries(['travelers','routeGroups','meetup','videos','days','segments'].map(key=>[key,draft[key]]));
  changes.photoGroups={[base.photos[0].id]:[second.id]};
  const result=prepareJourneyPlan(data,base,changes,state);
  assert.equal(loadContent(root).data.journeys.find(j=>j.id===base.id).videos[0].title,base.videos[0].title,'Checking does not write');
  const write=writePlanSources(root,base,result.journey), saved=loadContent(root).data.journeys.find(j=>j.id===base.id);
  assert.equal(saved.travelers[0].name,'Alex edited'); assert.equal(saved.meetup.label,'Lunch together');
  assert.deepEqual(saved.photos[0].groupIds,[second.id]);
  assert.deepEqual({...saved.photos[0],groupIds:base.photos[0].groupIds},base.photos[0],'Photo metadata and file choices stay intact');
  assert.deepEqual(saved.segments,base.segments,'Assignments never alter reviewed geometry');
  assert.equal(journeyRevision(saved),journeyRevision(result.journey));
  buildSite(root); assert.ok(!fs.readFileSync(path.join(root,'dist/assets/journeys.js'),'utf8').includes('Edited video'),'Hidden video stays out of public bundles');
  write.restore(); assert.deepEqual(loadContent(root).data.journeys.find(j=>j.id===base.id),base,'A failed later save can roll back every source');
});

test('photo group edits preserve reviewed and upload manifests and cannot replace photos', t => {
  const root=fixture(t), {data}=loadContent(root), base=data.journeys.find(j=>j.kind==='real'), state=readOverrides(root);
  const upload={...base.photos[0],id:`${base.id}-fixture-upload`,src:'https://example.com/upload.webp',assetStatus:'local'};
  const uploadFile=path.join(root,`content/photo-manifests/${base.id}-uploads.json`);
  const existingUploads=fs.existsSync(uploadFile)?JSON.parse(fs.readFileSync(uploadFile,'utf8')):[];
  writeJson(uploadFile,[...existingUploads,upload]);
  const current=loadContent(root), journey=current.data.journeys.find(j=>j.id===base.id);
  const changes={travelers:[{id:'one',name:'One'}],routeGroups:[{id:'route-one',label:'Route one',travelerIds:['one']}],photoGroups:{[base.photos[0].id]:['route-one'],[upload.id]:['route-one']}};
  const result=prepareJourneyPlan(current.data,journey,changes,state);
  const write=writePlanSources(root,journey,result.journey), saved=loadContent(root).data.journeys.find(j=>j.id===base.id);
  assert.deepEqual(saved.photos.find(photo=>photo.id===upload.id).groupIds,['route-one']);
  assert.equal(saved.photos.find(photo=>photo.id===upload.id).assetStatus,'local');
  assert.deepEqual({...saved.photos[0],groupIds:undefined},{...base.photos[0],groupIds:undefined});
  assert.throws(()=>prepareJourneyPlan(current.data,journey,{photoGroups:{foreign:['route-one']}},state),/existing photos/);
  assert.throws(()=>prepareJourneyPlan(current.data,journey,{photos:[]},state),/Cannot change photos/);
  assert.throws(()=>prepareJourneyPlan(current.data,journey,{...changes,photoGroups:{[base.photos[0].id]:[]}},state),/groupIds/);
  write.restore(); assert.deepEqual(JSON.parse(fs.readFileSync(uploadFile,'utf8')),[...existingUploads,upload]);
});

test('a fresh draft can add, edit, reassign and remove hosted videos without losing day ownership', t => {
  const root=fixture(t), draft=createJourney(root,{title:'New group trip',slug:'new-group-trip',startDate:'2028-06-01',endDate:'2028-06-02',timeZone:'Europe/Rome'});
  let {data}=loadContent(root,{includeDrafts:true}), state=readOverrides(root);
  const video={...sample().videos[0],id:`${draft.id}-video1`,dayId:draft.days[0].id};
  let result=prepareJourneyPlan(data,draft,{videos:[video]},state);
  writePlanSources(root,draft,result.journey);
  data=loadContent(root,{includeDrafts:true}).data;
  let base=data.journeys.find(j=>j.id===draft.id);
  result=prepareJourneyPlan(data,base,{videos:[{...video,title:'Moved video',dayId:draft.days[1].id,assetStatus:'local'}]},state);
  writePlanSources(root,base,result.journey);
  base=loadContent(root,{includeDrafts:true}).data.journeys.find(j=>j.id===draft.id);
  assert.equal(base.videos[0].dayId,draft.days[1].id);
  result=prepareJourneyPlan({...data,journeys:data.journeys.map(j=>j.id===base.id?base:j)},base,{videos:[]},state);
  writePlanSources(root,base,result.journey);
  assert.deepEqual(loadContent(root,{includeDrafts:true}).data.journeys.find(j=>j.id===draft.id).videos,[]);
  buildSite(root); assert.ok(!fs.readFileSync(path.join(root,'dist/assets/journeys.js'),'utf8').includes(video.id));
});

test('the actual Studio check handler discards stale responses after another edit', async () => {
  const source=fs.readFileSync(path.join(repo,'studio/studio.js'),'utf8'), start=source.indexOf('  async function previewPlan()'), end=source.indexOf('\n  async function savePlan()',start);
  const nodes=new Map(), $=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',disabled:false});return nodes.get(id);};
  let resolve, rendered=0;
  const journey=sample(), draft=structuredClone(journey), plan={draft,version:1,revision:'r1'}, state={photos:{},routes:{},days:{}};
  const context=vm.createContext({$,journey,state,planForJourney:()=>plan,planChanges:()=>({}),renderPlanner:()=>rendered++,fetch:()=>new Promise(done=>{resolve=done;})});
  vm.runInContext(source.slice(start,end),context);
  const check=context.previewPlan(); plan.version++; draft.travelers[0].name='Latest edit';
  resolve({json:async()=>({ok:true,journey:structuredClone(journey),state,revision:'r1',added:[],removed:[]})}); await check;
  assert.equal(plan.draft.travelers[0].name,'Latest edit'); assert.equal(plan.previewed,false); assert.equal(rendered,0);
  assert.match($('#plan-status').textContent,/changed while checking/);
});
