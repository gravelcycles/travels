import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {writeStudioDraft,readStudioDraft,listStudioDrafts,studioWorkspaceId} from '../scripts/studio-drafts.mjs';
import {studioSaveHarness} from './studio-save-harness.mjs';
import {loadContent} from '../scripts/journey-content.mjs';
import {readOverrides} from '../scripts/build-site.mjs';
const repo = path.resolve(import.meta.dirname, '..');
const clone = value => JSON.parse(JSON.stringify(value));
const storage = () => {const values=new Map();return {getItem:key=>values.get(key) || null,setItem:(key,value)=>values.set(key,value)};};
const snapshot = (text='Unfinished',sequence=1) => ({schema:1,sequence,dirty:true,state:{photos:{p:{caption:text}},days:{d:{text}},routes:{}},plans:[['trip',{dirty:true,draft:{title:'',places:[{name:'Incomplete',lng:null,lat:null}]}}]],savedStateRevision:'old-revision'});
function recovery({local=storage(),session=storage(),fetch=async()=>({ok:true,json:async()=>({ok:true,draft:{updatedAt:new Date().toISOString()}})})}={}) {
  const timers=new Map(),messages=[];let serial=0;
  const context=vm.createContext({crypto:{randomUUID:()=>`session-${Math.random().toString(36).slice(2)}`},setTimeout:fn=>{timers.set(++serial,fn);return serial;},clearTimeout:id=>timers.delete(id)});
  vm.runInContext(fs.readFileSync(path.join(repo,'studio/studio-recovery.js'),'utf8'),context);
  return {api:context.JOURNEY_ATLAS_STUDIO_RECOVERY.create({workspaceId:'checkout',storage:local,session,fetch,onStatus:(...message)=>messages.push(message)}),messages,local,session,timers};
}
test('reload before the debounce restores every incomplete edit from browser storage',async()=>{
  const first=recovery(), draft=snapshot();first.api.capture(draft);
  const reloaded=recovery({local:first.local,session:first.session,fetch:async()=>({ok:true,json:async()=>({draft:null})})});
  assert.equal(first.api.id,reloaded.api.id);
  assert.deepEqual(clone(await reloaded.api.recover()),draft);
  assert.equal(first.timers.size,1,'No network request is required before reload recovery');
});
test('autosave writes invalid/incomplete drafts only under ignored build data, and rejects stale arrivals',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'studio-draft-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const draft=snapshot();writeStudioDraft(root,'tab-one',draft);
  assert.deepEqual(fs.readdirSync(root),['build']);assert.equal(readStudioDraft(root,'tab-one').plans[0][1].draft.title,'');
  writeStudioDraft(root,'tab-one',{...snapshot('Latest',3)});writeStudioDraft(root,'tab-one',snapshot('Older',2));
  assert.equal(readStudioDraft(root,'tab-one').state.days.d.text,'Latest');assert.equal(listStudioDrafts(root).length,1);
  writeStudioDraft(root,'tab-one',{...draft,sequence:4,dirty:false});assert.equal(listStudioDrafts(root).length,0);
  assert.throws(()=>writeStudioDraft(root,'../outside',draft),/Invalid draft ID/);
  assert.notEqual(studioWorkspaceId(root),studioWorkspaceId(root+'/other'));
});
test('autosave serializes requests and retains edits made during an outstanding save',async()=>{
  const requests=[];const f=recovery({fetch:(_url,options)=>new Promise(resolve=>requests.push({body:JSON.parse(options.body),resolve}))});
  f.api.capture(snapshot('First'));const saving=f.api.flush();f.api.capture(snapshot('Latest'));
  assert.equal(requests.length,1);assert.equal(requests[0].body.state.days.d.text,'First');
  requests[0].resolve({ok:true,json:async()=>({ok:true,draft:{updatedAt:new Date().toISOString()}})});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(requests.length,2);
  requests[1].resolve({ok:true,json:async()=>({ok:true,draft:{updatedAt:new Date().toISOString()}})});await saving;
  assert.equal(requests[1].body.state.days.d.text,'Latest');assert.match(f.messages.at(-1)[0],/Draft autosaved locally/);
});
test('offline or failed autosaves preserve the browser draft and retry; successful Save clears recovery',async()=>{
  let fail=true,remote=null;
  const f=recovery({fetch:async(_url,options)=>{if(fail)throw new Error('Offline');remote=JSON.parse(options.body);return {ok:true,json:async()=>({ok:true,draft:{updatedAt:new Date().toISOString()}})};}});
  f.api.capture(snapshot());await f.api.flush();assert.equal(f.messages.at(-1)[1],true);
  assert.equal((await f.api.recover()).state.days.d.text,'Unfinished');
  fail=false;await f.api.flush();assert.equal(remote.dirty,true);
  f.api.capture({...snapshot(),dirty:false});await f.api.flush();assert.equal(await f.api.recover(),null);
});
test('separate tabs keep separate draft streams',()=>{
  const local=storage(),a=recovery({local}),b=recovery({local});
  a.api.capture(snapshot('A'));b.api.capture(snapshot('B'));assert.notEqual(a.api.id,b.api.id);
});

test('Save writes trip and day copy without any Preview request',async()=>{
  const {data}=loadContent(repo),journey=data.journeys.find(j=>j.published && j.kind!=='demo');
  const f=studioSaveHarness(data,journey,readOverrides(repo));f.plan.draft.title='Saved in one click';
  f.context.state.days[journey.days[0].id]={text:'Keep this day copy'};
  assert.equal(await f.context.savePlan(),true);assert.equal(f.requests.length,1);assert.equal(f.requests[0].preview,false);
  assert.equal(f.saved().title,'Saved in one click');assert.equal(f.context.state.days[journey.days[0].id].text,'Keep this day copy');assert.equal(f.context.dirty,false);
});
test('Preview never replaces live edits; Save applies itinerary alignment once',async()=>{
  const {data}=loadContent(repo),journey=data.journeys.find(j=>j.kind!=='demo' && j.published),f=studioSaveHarness(data,journey,readOverrides(repo));
  f.plan.draft.startDate='2027-08-13';f.plan.draft.endDate='2027-08-26';f.plan.alignment='itinerary';
  const before=JSON.stringify(f.context.state),planBefore=JSON.stringify(f.plan.draft);
  await f.context.previewPlan();assert.equal(JSON.stringify(f.context.state),before);assert.equal(JSON.stringify(f.plan.draft),planBefore);
  assert.equal(await f.context.savePlan(),true);assert.equal(f.saved().days[0].calendarDate,'2027-08-13');assert.equal(f.saved().days[0].id,journey.days[0].id);
});
test('invalid plans keep their draft and show errors in the global status, including outside the planner',async()=>{
  const {data}=loadContent(repo),journey=data.journeys[0],f=studioSaveHarness(data,journey,readOverrides(repo));f.plan.draft.title='';
  assert.equal(await f.context.savePlan(),false);assert.equal(f.context.dirty,true);assert.equal(f.plan.draft.title,'');
  assert.match(f.$('#save-status').textContent,/Not saved:.*title/);assert.equal(f.$('#save-all').disabled,false);assert.equal(f.$('.studio-shell').inert,false);
});

test('discard archives the current draft and clears automatic reload recovery without touching sources',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'studio-discard-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  writeStudioDraft(root,'tab',snapshot('Older',1));
  writeStudioDraft(root,'tab',{...snapshot('Latest edit',2),dirty:false,discarded:true});
  assert.equal(readStudioDraft(root,'tab').dirty,false);
  const [archive]=listStudioDrafts(root);assert.match(archive.title,/Discarded draft/);
  assert.equal(readStudioDraft(root,archive.id).state.days.d.text,'Latest edit');
  assert.deepEqual(fs.readdirSync(root),['build']);
});
test('draft diff compares day text, cleared values, plan fields and route coordinates without mutating either version',async()=>{
  const {studioDraftDiff}=await import('../scripts/studio-draft-diff.mjs');
  const {data,routes}=loadContent(repo),saved=readOverrides(repo),journey=data.journeys[0];
  const edited=structuredClone(saved),day=journey.days[0],photo=journey.photos[0],plan=structuredClone(journey);
  edited.days[day.id]={...edited.days[day.id],text:'Fresh day copy'};
  edited.photos[photo.id]={...edited.photos[photo.id],caption:'Fresh caption'};
  plan.title='Draft trip name';
  const draft={state:edited,plans:[[journey.id,{dirty:true,draft:plan}]]},before=JSON.stringify({saved,draft});
  const changes=studioDraftDiff(data,saved,draft,routes);
  assert.ok(changes.some(c=>c.section==='Day copy' && c.after==='Fresh day copy'));
  assert.ok(changes.some(c=>c.section==='Photos' && c.after==='Fresh caption'));
  assert.ok(changes.some(c=>c.section==='Trip plan' && c.before===journey.title && c.after==='Draft trip name'));
  assert.equal(JSON.stringify({saved,draft}),before);
  assert.deepEqual(studioDraftDiff(data,saved,{state:saved,plans:[]},routes),[]);
});
