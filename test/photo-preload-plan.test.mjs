import test from 'node:test';import assert from 'node:assert/strict';
import '../dist/assets/atlas-utils.js';
const {photoPreloadPlan}=globalThis.JOURNEY_ATLAS_UTILS;
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
