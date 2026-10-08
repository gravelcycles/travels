import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { assessStudioReadiness, assessReadinessMedia } from '../scripts/studio-readiness.mjs';
import { loadContent } from '../scripts/journey-content.mjs';
import { readOverrides } from '../scripts/build-site.mjs';
import { journeyRevision } from '../scripts/journey-planner.mjs';
import '../studio/ready-to-share.js';

const repo = path.resolve(import.meta.dirname, '..');
const changes = globalThis.JOURNEY_ATLAS_PLAN_EXTRAS.changes;
const { createSession, handoff } = globalThis.JOURNEY_ATLAS_READINESS;
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-readiness-'));
  t.after(() => fs.rmSync(root, { recursive:true, force:true }));
  fs.cpSync(path.join(repo, 'content'), path.join(root, 'content'), { recursive:true, filter:source => !source.includes(`${path.sep}drafts`) });
  return root;
}
function inputFor(root, index = 0) {
  const journey = loadContent(root, { includeDrafts:true }).data.journeys[index], state = readOverrides(root);
  return { journeyId:journey.id, changes:changes(journey), state, revision:journeyRevision(journey), stateRevision:journeyRevision(state) };
}
const issue = (report, id) => report.items.find(item => item.id === id);
const contentSnapshot = root => fs.readdirSync(path.join(root, 'content'), { recursive:true }).filter(file => fs.statSync(path.join(root, 'content', file)).isFile()).map(file => [file, fs.readFileSync(path.join(root, 'content', file), 'utf8')]);

test('readiness distinguishes a current draft from saved sources and never asserts a public version', t => {
  const root = fixture(t), input = inputFor(root), before = contentSnapshot(root);
  const saved = assessStudioReadiness(root, input);
  assert.deepEqual(saved.draft, { valid:true, unsaved:false, sourceChanged:false });
  assert.equal(saved.public.status, 'unverified');
  assert.equal(saved.items.filter(item => item.severity === 'blocker').length, 0);
  input.state.days[input.changes.days[0].id] = { text:'A current, unsaved story.' };
  input.changes.title = 'A current, unsaved trip title';
  const draft = assessStudioReadiness(root, input);
  assert.equal(draft.journey.title, input.changes.title);
  assert.equal(draft.draft.unsaved, true); assert.ok(issue(draft, 'unsaved'));
  assert.notEqual(draft.revisions.draft, saved.revisions.draft);
  assert.equal(draft.revisions.savedPlan, saved.revisions.savedPlan);
  assert.deepEqual(contentSnapshot(root), before);
  assert.equal(fs.existsSync(path.join(root, 'build')), false, 'The assessment does not create revisions, assets or backups.');
});

test('invalid current overrides, plan fields and unassigned media do not fall back to a saved ready result', t => {
  const root = fixture(t), input = inputFor(root), photo = loadContent(root).data.journeys[0].photos[0];
  input.state.photos[photo.id] = { dayId:'missing-day' };
  let report = assessStudioReadiness(root, input);
  assert.equal(report.draft.valid, false); assert.equal(issue(report, 'invalid-draft').action.mode, 'photos');
  assert.equal(issue(report, 'invalid-draft').action.id, photo.id);
  const plan = inputFor(root); plan.changes.places[0].lat = null;
  report = assessStudioReadiness(root, plan);
  assert.equal(report.draft.valid, false); assert.equal(issue(report, 'invalid-draft').severity, 'blocker');
  plan.changes = { ...inputFor(root).changes, title:'' };
  assert.match(issue(assessStudioReadiness(root, plan), 'invalid-draft').detail, /title/i);
});

test('changed saved sources and route evidence invalidate a previous assessment', t => {
  const root = fixture(t), input = inputFor(root), before = assessStudioReadiness(root, input);
  const file = path.join(root, 'content/day-overrides.json'), days = JSON.parse(fs.readFileSync(file));
  days[input.changes.days[0].id] = { text:'Changed in another tab.' }; fs.writeFileSync(file, JSON.stringify(days));
  const changed = assessStudioReadiness(root, input);
  assert.ok(issue(changed, 'source-changed')); assert.notEqual(changed.assessmentRevision, before.assessmentRevision);
  const current = inputFor(root), currentReport = assessStudioReadiness(root, current);
  const routeFile = path.join(root, `content/route-geometry/${input.journeyId}.json`), routes = JSON.parse(fs.readFileSync(routeFile));
  routes[Object.keys(routes)[0]][1][0] += 0.001; fs.writeFileSync(routeFile, JSON.stringify(routes));
  const routeReport = assessStudioReadiness(root, current);
  assert.notEqual(routeReport.revisions.savedRoutes, currentReport.revisions.savedRoutes);
  assert.notEqual(routeReport.assessmentRevision, currentReport.assessmentRevision);
});

test('local media requires publishing, missing derivatives are explicit, and trashed/hidden media is excluded', t => {
  const root = fixture(t), hash = 'a'.repeat(64), photoSrc = `/private-photos/assets/v1/${hash}.webp`, videoSrc = `/private-videos/assets/v1/${hash}.mp4`;
  const journey = { days:[{id:'day'}], photos:[{id:'photo',dayId:'day',src:photoSrc,srcset:[{src:photoSrc}],assetStatus:'local',sourceFilename:'/private/originals/picture.heic'}], videos:[{id:'video',dayId:'day',src:videoSrc,poster:photoSrc,visibility:'private',protected:true,assetStatus:'local'}] };
  const state = {photos:{}}, collect = () => { const items = []; assessReadinessMedia(root, journey, state, (id,severity,title,detail,action) => items.push({id,severity,title,detail,action})); return {items}; };
  let report = collect();
  assert.match(issue(report,'asset:photo').detail, /1 required photo derivative is missing/);
  assert.match(issue(report,'asset:video').detail, /2 required video\/poster derivatives are missing/);
  assert.equal(issue(report,'asset:video').action.mode, 'media');
  assert.doesNotMatch(JSON.stringify(report), /private\/originals|private-photo-assets|private-video-assets/);
  for (const [directory, suffix] of [['private-photo-assets','webp'],['private-video-assets','mp4']]) {
    fs.mkdirSync(path.join(root,'build',directory,'v1'),{recursive:true}); fs.writeFileSync(path.join(root,'build',directory,'v1',`${hash}.${suffix}`),'nonempty');
  }
  report = collect(); assert.match(issue(report,'asset:video').detail, /Local derivatives are present/);
  assert.equal(issue(report,'asset:video').severity,'blocker','Presence does not mean published.');
  state.photos.photo={trashed:true}; journey.videos[0].hidden=true;
  assert.deepEqual(collect().items,[]);
  state.photos.photo={};journey.videos[0].hidden=false;journey.photos[0].assetStatus='published';journey.videos[0].assetStatus='published';
  assert.equal(collect().items.some(item=>item.id.startsWith('asset:')),false);
  assert.equal(issue(collect(),'location:photo').severity,'review','Unknown photo location is an explicit choice, not a fabricated pin.');
});

test('provisional geometry stays a review choice and blank optional captions or stories are valid', t => {
  const root = fixture(t), journeys = loadContent(root).data.journeys, index = journeys.findIndex(journey => journey.segments.some(segment => segment.geometryStatus==='provisional'));
  const input=inputFor(root,index); for(const day of input.changes.days) input.state.days[day.id]={text:'',tagline:''};
  const report=assessStudioReadiness(root,input), route=report.items.find(item=>item.id.startsWith('route:'));
  assert.equal(report.draft.valid,true); assert.equal(route.severity,'review');
  assert.match(route.detail,/does not certify/);
  assert.equal(report.items.some(item=>/caption|story/.test(item.id)),false);
  const text=handoff(report,new Set([route.id]));
  assert.ok(text.includes(`[REVIEWED — keep as described] ${route.title}`));
  assert.match(text,/Public version: UNVERIFIED/);assert.match(text,/BLOCKER.*not saved/);
});

test('review choices bind to the current draft and saved assessment; async journey switches discard old results', async t => {
  const root=fixture(t); let input=inputFor(root), resolve;
  const report=assessStudioReadiness(root,input), review=report.items.find(item=>item.severity==='review');
  const session=createSession({getInput:()=>input,request:()=>new Promise(done=>resolve=done)});
  let pending=session.check();resolve(report);await pending;
  assert.equal(session.acknowledge(review.id,true),true);assert.match(session.brief(),/REVIEWED — keep as described/);
  pending=session.check();resolve({...report,checkedAt:'next check'});await pending;
  assert.equal(session.acknowledged.has(review.id),true,'Identical revision keeps an explicit choice.');
  pending=session.check();resolve({...report,assessmentRevision:'changed-on-disk'});await pending;
  assert.equal(session.acknowledged.size,0);
  session.acknowledge(review.id,true);input.changes.title='Changed while editing';
  assert.equal(session.report,null);assert.throws(()=>session.brief(),/draft changed/);
  input=inputFor(root);pending=session.check();input=inputFor(root,1);resolve(report);
  assert.equal(await pending,null);assert.equal(session.report,null);
  input=inputFor(root);pending=session.check();session.invalidate();resolve(report);
  assert.equal(await pending,null);assert.equal(session.acknowledged.size,0);
});

test('readiness endpoint is read-only, same-origin and bounded', {timeout:30000}, async t => {
  const root=fixture(t), input=inputFor(root), before=contentSnapshot(root);
  const child=spawn(process.execPath,[path.join(repo,'scripts/studio-server.mjs')],{env:{...process.env,ATLAS_STUDIO_ROOT:root,ATLAS_STUDIO_PORT:'0'},stdio:['ignore','pipe','pipe']});
  t.after(()=>child.kill());let output='';child.stderr.on('data',chunk=>output+=chunk);
  const origin=await new Promise((resolve,reject)=>{child.stdout.on('data',chunk=>{const match=String(chunk).match(/http:\/\/127.0.0.1:\d+/);if(match)resolve(match[0]);});child.on('error',reject);child.on('exit',code=>reject(Error(`Server exited ${code}: ${output}`)));});
  const post=(body,headers={})=>fetch(`${origin}/api/readiness`,{method:'POST',headers:{'Content-Type':'application/json',...headers},body});
  const response=await post(JSON.stringify(input),{Origin:origin});assert.equal(response.status,200);assert.equal((await response.json()).report.public.status,'unverified');
  assert.equal((await post(JSON.stringify(input),{Origin:'https://unrelated.example'})).status,403);
  const wrongHost = await new Promise((resolve,reject) => { const request=http.request(`${origin}/api/readiness`,{method:'POST',headers:{Host:'unrelated.example'}},response=>{response.resume();resolve(response.statusCode);});request.on('error',reject);request.end(JSON.stringify(input)); });
  assert.equal(wrongHost,403);
  assert.equal((await post(' '.repeat(5_000_001))).status,413);
  assert.equal((await post('{}')).status,400);
  assert.deepEqual(contentSnapshot(root),before);assert.equal(fs.existsSync(path.join(root,'build')),false);
});
