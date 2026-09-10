import test from 'node:test';import assert from 'node:assert/strict';
import '../dist/assets/atlas-utils.js';
const {photoPreloadPlan,dayPreloadPlan}=globalThis.JOURNEY_ATLAS_UTILS;
const photo=id=>({id});const days=[{photos:[photo('a'),photo('b'),photo('c')]},{photos:[]},{photos:[photo('d'),photo('e')]},{photos:[photo('f')]}];
const full=plan=>plan.filter(r=>r.width===Infinity).map(r=>r.photo.id);
test('forward preloading follows reviewed order across empty days and warms the next day thumbnail',()=>{
 const plan=photoPreloadPlan(days,'c',1);assert.deepEqual(full(plan),['d','e','b']);assert.deepEqual(plan.filter(r=>r.width===480).map(r=>r.photo.id),['d']);
});
test('backward preloading favors the previous photos and the previous day entry photo',()=>{
 const plan=photoPreloadPlan(days,'d',-1);assert.deepEqual(full(plan),['c','b','e','a']);assert.equal(plan.at(-1).photo.id,'a');assert.equal(plan.at(-1).width,480);
});
test('first/last/single/unknown photos do not wrap, duplicate or request nonexistent photos',()=>{
 assert.deepEqual(full(photoPreloadPlan(days,'a')),['b','c','d']);assert.deepEqual(full(photoPreloadPlan(days,'f')),['e']);
 assert.deepEqual(photoPreloadPlan([{photos:[photo('only')]}],'only'),[]);assert.deepEqual(photoPreloadPlan(days,'missing'),[]);
 for(const id of ['a','b','c','d','e','f'])for(const direction of [-1,1]){
  const plan=photoPreloadPlan(days,id,direction);assert.ok(plan.length<=6);assert.ok(plan.every(r=>r.photo.id!==id));assert.equal(new Set(plan.map(r=>`${r.photo.id}:${r.width}`)).size,plan.length);
 }
});

const journalDays=days.map((day,index)=>({...day,id:`day-${index}`}));
const has=(plan,id,width)=>plan.some(request=>request.photo.id===id&&request.width===width);
test('upcoming strips and every album cover and journal lead are warmed without full-photo bulk downloads',()=>{
 const plan=dayPreloadPlan(journalDays,'day-0');
 assert.deepEqual(plan.slice(0,2).map(r=>r.photo.id),['d','f']);
 for(const id of ['a','d','f'])for(const width of [480,1280])assert.ok(has(plan,id,width),`${id} ${width}`);
 assert.ok(has(plan,'e',480));assert.ok(!has(plan,'b',480));assert.ok(!has(plan,'c',480));
 assert.ok(plan.every(r=>r.width!==Infinity));assert.equal(new Set(plan.map(r=>`${r.photo.id}:${r.width}`)).size,plan.length);
});
test('backward plans warm previous strips and empty selected days still prepare following days',()=>{
 const back=dayPreloadPlan(journalDays,'day-3',-1);
 assert.deepEqual(back.slice(0,2).map(r=>r.photo.id),['d','a']);
 for(const id of ['b','c','e'])assert.ok(has(back,id,480));
 const empty=dayPreloadPlan(journalDays,'day-1');assert.ok(has(empty,'e',480));
 assert.deepEqual(dayPreloadPlan(journalDays,'missing'),[]);assert.deepEqual(dayPreloadPlan([{id:'empty',photos:[]}],'empty'),[]);
});
test('only the next two nonempty strips are speculated, interleaved in reviewed order',()=>{
 const rows=Array.from({length:5},(_,d)=>({id:String(d),photos:Array.from({length:4},(_,i)=>photo(`${d}-${i}`))}));
 const plan=dayPreloadPlan(rows,'0');
 assert.deepEqual(plan.filter(r=>r.width===480&&!r.photo.id.endsWith('-0')).map(r=>r.photo.id),['1-1','2-1','1-2','2-2','1-3','2-3']);
 for(let d=0;d<5;d++)for(const width of [480,1280])assert.ok(has(plan,`${d}-0`,width));
});
test('large strips cannot exhaust the bounded queue or displace daily main images',()=>{
 const rows=Array.from({length:14},(_,d)=>({id:String(d),photos:Array.from({length:100},(_,i)=>photo(`${d}-${i}`))}));
 const plan=dayPreloadPlan(rows,'0');assert.equal(plan.length,74);
 for(let d=0;d<14;d++)for(const width of [480,1280])assert.ok(has(plan,`${d}-0`,width),`${d} ${width}`);
 assert.equal(new Set(plan.map(r=>`${r.photo.id}:${r.width}`)).size,plan.length);
});

import fs from 'node:fs';
import vm from 'node:vm';
const appSource=fs.readFileSync(new URL('../dist/assets/app.js',import.meta.url),'utf8');
const refreshStart=appSource.indexOf('  function refreshPreloads(');
const refreshSource=appSource.slice(refreshStart,appSource.indexOf('\n  function ',refreshStart+1));
function appPlan(mode){
 let result;
 const context=vm.createContext({journey:{days:journalDays},activeDayId:'day-0',preloadSelection:null,preloadDirection:1,
  photoDialog:{open:mode==='viewer'},replayDialog:{open:mode==='replay'},viewerPhotoIndex:2,viewerDay:()=>journalDays[0],
  photosForDay:id=>journalDays.find(day=>day.id===id).photos,orderedPhotos:()=>days.flatMap(day=>day.photos),
  window:{JOURNEY_ATLAS_UTILS:globalThis.JOURNEY_ATLAS_UTILS},applyPreloads:requests=>{result=requests;}});
 vm.runInContext(refreshSource+'\nrefreshPreloads()',context);return result;
}
for(const mode of ['journal','viewer'])test(`${mode} keeps immediate full photos ahead of day covers and upcoming strips`,()=>{
 const plan=appPlan(mode);
 assert.deepEqual(Array.from(full(plan).slice(0,mode==='journal'?1:2)),mode==='journal'?['a']:['d','e']);
 for(const id of ['a','d','f'])for(const width of [480,1280])assert.ok(has(plan,id,width));
 assert.ok(has(plan,'e',480));assert.ok(plan.length<=80);
});

test('Replay cancels photo preloads instead of downloading chapter images or album covers',()=>{
 assert.deepEqual(Array.from(appPlan('replay')),[]);
});
