import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { reconcile, rememberRevision, readRevision } from '../scripts/studio-reconcile.mjs';
import { loadContent } from '../scripts/journey-content.mjs';
import { readOverrides } from '../scripts/build-site.mjs';
import { journeyRevision } from '../scripts/journey-planner.mjs';
import '../studio/plan-extras.js';
const repo=path.resolve(import.meta.dirname,'..');
const changes=globalThis.JOURNEY_ATLAS_PLAN_EXTRAS.changes;

test('three-way saves combine independent fields, including different days and imported photos',()=>{
  const base={title:'Trip',days:[{id:'day-one',text:''},{id:'day-two',text:''}],photoGroups:{photo:null}};
  const mine=structuredClone(base),disk=structuredClone(base);mine.days[0].text='My story';disk.days[1].text='Other story';disk.photoGroups.imported=null;
  const result=reconcile(base,mine,disk);
  assert.deepEqual(result.conflicts,[]);assert.equal(result.value.days[0].text,'My story');assert.equal(result.value.days[1].text,'Other story');assert.ok(Object.hasOwn(result.value.photoGroups,'imported'));
  assert.equal(base.days[0].text,'');assert.equal(disk.days[0].text,'');
});
test('same-field conflicts, deletions and unknown old versions require explicit choices',()=>{
  const base={days:{d:{text:'Original',tagline:'Old line'}}},mine={days:{d:{text:'Mine',tagline:'Old line'}}},disk={days:{d:{text:'Theirs',tagline:'New line'}}};
  const result=reconcile(base,mine,disk);assert.equal(result.conflicts.length,1);const id=result.conflicts[0].id;
  assert.equal(reconcile(base,mine,disk,{choices:{[id]:'draft'}}).value.days.d.text,'Mine');
  assert.equal(reconcile(base,mine,disk,{choices:{[id]:'saved'}}).value.days.d.text,'Theirs');
  assert.equal(reconcile(base,mine,disk,{choices:{[id]:'draft'}}).value.days.d.tagline,'New line');
  assert.equal(reconcile(base,{days:{}},disk).conflicts.length,1);
  assert.equal(reconcile(undefined,mine,disk).conflicts.length,2);
});
test('revisions survive server restarts and reject corrupt or invalid snapshot paths',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'studio-revision-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const value={days:{d:{text:'Saved'}}},id=rememberRevision(root,value);
  assert.deepEqual(readRevision(root,id),value);assert.equal(readRevision(root,'../../secret'),undefined);
  fs.writeFileSync(path.join(root,'build/studio-revisions',`${id}.json`),'{}');assert.equal(readRevision(root,id),undefined);
});

test('real Studio API reconciles, saves repeatedly, serves story/tagline and rejects stale conflict choices', {timeout:60000}, async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'studio-save-api-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  for(const dir of ['content','dist','scripts'])fs.cpSync(path.join(repo,dir),path.join(root,dir),{recursive:true,filter:src=>!src.includes(`${path.sep}drafts`)});
  const child=spawn(process.execPath,[path.join(repo,'scripts/studio-server.mjs')],{env:{...process.env,ATLAS_STUDIO_ROOT:root,ATLAS_STUDIO_PORT:'0'},stdio:['ignore','pipe','pipe']});
  t.after(()=>child.kill());
  let output='';child.stderr.on('data',chunk=>output+=chunk);
  const origin=await new Promise((resolve,reject)=>{child.stdout.on('data',chunk=>{const m=String(chunk).match(/http:\/\/127.0.0.1:\d+/);if(m)resolve(m[0]);});child.on('error',reject);child.on('exit',code=>reject(Error(`Server exited ${code}: ${output}`)));});
  const api=async(url,body,method='POST')=>{const response=await fetch(origin+url,body===undefined?{}:{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:response.status,...await response.json()};};
  const loaded=await api('/api/state'),journey=loadContent(root).data.journeys.find(j=>j.kind==='real'),state=readOverrides(root);
  const baseline=structuredClone(journey),draft=structuredClone(journey),day=journey.days[4]||journey.days[0];
  draft.title='My changed trip';state.days[day.id]={...state.days[day.id],text:'A full story.\n\nSecond paragraph <kept>.',tagline:'Rain & a slow morning'};
  // Simulate the site's newer immutable map framing and another saved day.
  const sourceFile=path.join(root,`content/journeys/${journey.id}.json`),source=JSON.parse(fs.readFileSync(sourceFile));source.overviewBounds=[[0,0],[10,50]];fs.writeFileSync(sourceFile,JSON.stringify(source));
  const diskDays=JSON.parse(fs.readFileSync(path.join(root,'content/day-overrides.json')));diskDays[journey.days[1].id]={...diskDays[journey.days[1].id],text:'Another tab story'};fs.writeFileSync(path.join(root,'content/day-overrides.json'),JSON.stringify(diskDays));
  const input={journeyId:journey.id,revision:loaded.revisions[journey.id],stateRevision:loaded.stateRevision,changes:changes(draft),state,preview:false};
  const saved=await api('/api/journey-plan',input);assert.equal(saved.status,200,saved.error);assert.equal(saved.journey.title,draft.title);assert.deepEqual(saved.journey.overviewBounds,source.overviewBounds);assert.equal(saved.state.days[day.id].text,state.days[day.id].text);assert.equal(saved.state.days[journey.days[1].id].text,'Another tab story');
  assert.equal(saved.revision,journeyRevision(loadContent(root).data.journeys.find(j=>j.id===journey.id)));
  const again=await api('/api/journey-plan',{...input,revision:saved.revision,stateRevision:saved.stateRevision,state:saved.state,changes:changes(saved.journey)});assert.equal(again.status,200,again.error);
  const preview=await(await fetch(origin+'/api/preview-assets/content-overrides.js')).text();assert.ok(preview.includes('Rain & a slow morning'));assert.ok(preview.includes('Second paragraph \\u003ckept>'));
  // An old tab changes the same title. No content is written before a choice.
  const conflicting=await api('/api/journey-plan',{...input,changes:{...changes(baseline),title:'Different title'}});assert.equal(conflicting.status,409);assert.equal(loadContent(root).data.journeys.find(j=>j.id===journey.id).title,draft.title);
  const choice={revision:conflicting.revision,stateRevision:conflicting.stateRevision,choices:Object.fromEntries(conflicting.conflicts.map(c=>[c.id,'draft']))};
  const newer=JSON.parse(fs.readFileSync(sourceFile));newer.title='An even newer title';fs.writeFileSync(sourceFile,JSON.stringify(newer));
  const stale=await api('/api/journey-plan',{...input,changes:{...changes(baseline),title:'Different title'},resolution:choice});assert.equal(stale.status,409);assert.ok(stale.conflicts.some(c=>c.saved==='An even newer title'));
  const resolved=await api('/api/journey-plan',{...input,changes:{...changes(baseline),title:'Different title'},resolution:{revision:stale.revision,stateRevision:stale.stateRevision,choices:Object.fromEntries(stale.conflicts.map(c=>[c.id,'saved']))}});assert.equal(resolved.status,200,resolved.error);assert.equal(resolved.journey.title,'An even newer title');assert.equal(resolved.state.days[day.id].text,state.days[day.id].text);
  // Ordinary day saves merge as well; an invalid build rolls every override back.
  const latest=await api('/api/state'),editorial={photos:latest.photos,routes:latest.routes,days:latest.days};editorial.days[day.id].tagline='New tagline';
  const ordinary=await api('/api/state',{...editorial,stateRevision:latest.stateRevision},'PUT');assert.equal(ordinary.status,200,ordinary.error);assert.equal(ordinary.state.days[day.id].tagline,'New tagline');
  const beforeFailure=readOverrides(root);fs.writeFileSync(path.join(root,'scripts/build-content-overrides.mjs'),"throw new Error('Build failure fixture');");
  const failed=await api('/api/state',{...editorial,days:{...editorial.days,[day.id]:{text:'Must roll back'}},stateRevision:ordinary.stateRevision},'PUT');assert.equal(failed.status,400);assert.deepEqual(readOverrides(root),beforeFailure);
});
