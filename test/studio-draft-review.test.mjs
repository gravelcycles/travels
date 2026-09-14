import test from 'node:test';
import assert from 'node:assert/strict';
import {studioDraftDiff} from '../scripts/studio-draft-diff.mjs';
import '../studio/draft-review.js';
const {render,highlight}=globalThis.JOURNEY_ATLAS_DRAFT_REVIEW;
const journey={id:'trip',title:'A trip',days:[{id:'d1',number:1,title:'Lakeside'},{id:'d2',number:2,title:'Mountains'}],photos:[{id:'p1',dayId:'d1',sourceFilename:'IMG_0001.HEIC',caption:'Morning at the lake',src:'/photos/one.webp'},{id:'p2',dayId:'d2',sourceFilename:'IMG_0002.HEIC'}],places:[{id:'a',name:'Lakeside station'},{id:'b',name:'Mountain village'}],segments:[{id:'r1',from:'a',to:'b'}]};
const saved={photos:{p1:{description:'Coffee before the train',location:{lat:47,lng:8}}},days:{d1:{title:'First morning'}},routes:{}};
const diff=(state,plans=[])=>studioDraftDiff({journeys:[journey]},saved,{state,plans},{r1:[[8,47],[9,48]]});

test('photo changes form one identifiable card with readable day references, status and a precise edit count',()=>{
  const state=structuredClone(saved);
  Object.assign(state.photos.p1,{caption:'Evening at the lake',description:'Coffee after the train',dayId:'d2',trashed:true});
  const changes=diff(state),review=render(changes);
  assert.equal(changes.length,4);assert.equal(new Set(changes.map(c=>c.groupId)).size,1);
  assert.equal(changes[0].subject,'IMG_0001.HEIC');assert.equal(changes[0].context,'Day 1 · First morning');
  assert.equal(changes.find(c=>c.field==='Journey day').displayBefore.text,'Day 1 · First morning');
  assert.equal(changes.find(c=>c.field==='Journey day').displayAfter.text,'Day 2 · Mountains');
  assert.deepEqual(changes.find(c=>c.field==='Trash').displayAfter,{text:'In Trash'});
  assert.equal(review.summary,'4 changes in 1 photo.');
  assert.equal((review.html.match(/class="draft-change-group"/g)||[]).length,1);
  assert.match(review.html,/<img src="\/photos\/one.webp"/);
  assert.match(review.html,/<del>before<\/del>/);assert.match(review.html,/<ins>after<\/ins>/);
  assert.doesNotMatch(review.html,/dayId|trip \/|p1|<pre>/);
});

test('cleared text, legacy flags and empty optional fields produce no misleading changes',()=>{
  const state=structuredClone(saved);state.photos.p1.description='';state.photos.p1.locationLabel='';state.photos.p1.hidden=true;
  const changes=diff(state);assert.equal(changes.length,1);assert.equal(changes[0].field,'Notes');
  assert.deepEqual(changes[0].displayAfter,{text:'Empty',empty:true});
  assert.match(render(changes).html,/<em>Empty<\/em>/);
  assert.deepEqual(diff(structuredClone(saved)),[]);
});

test('location edits stay together; detailed geometry is preserved behind a concise summary',()=>{
  const state=structuredClone(saved);state.photos.p1.location={lat:47.1,lng:8.2};state.routes.r1={geometry:[[8,47],[8.1,47.2],[9,48]]};
  const changes=diff(state);assert.equal(changes.length,2);
  const location=changes.find(c=>c.field==='Photo location');assert.equal(location.displayAfter.text,'47.1° latitude, 8.2° longitude');
  const route=changes.find(c=>c.field==='Route line');assert.equal(route.subject,'Lakeside station → Mountain village');
  assert.equal(route.displayBefore.text,'2 route points');assert.equal(route.displayAfter.text,'3 route points');
  assert.deepEqual(JSON.parse(route.displayAfter.details),state.routes.r1.geometry);
  assert.match(render(changes).html,/<details class="draft-value-details"><summary>Show full details<\/summary>/);
});

test('plan additions, removals and reordering preserve readable item identity and reference names',()=>{
  const plan=structuredClone(journey);plan.days.reverse();plan.places.splice(0,1);plan.places.push({id:'c',name:'New harbor'});
  plan.segments[0].to='c';plan.coverPhoto={photoId:'p2'};
  const changes=diff(structuredClone(saved),[['trip',{draft:plan,dirty:true}]]);
  assert.ok(changes.some(c=>c.field==='Removed' && c.subject==='Lakeside station'));
  assert.ok(changes.some(c=>c.field==='Added' && c.subject==='New harbor'));
  assert.ok(changes.some(c=>c.field==='Days · Order' && c.displayAfter.text.startsWith('1. Day 2 · Mountains')));
  assert.ok(changes.some(c=>c.field==='To' && c.displayAfter.text==='New harbor'));
  assert.ok(changes.some(c=>c.field==='Cover photo · Photo' && c.displayAfter.text==='IMG_0002.HEIC'));
});

test('review escapes user text and unsafe thumbnails, with bounded comparison for long stories',()=>{
  const state=structuredClone(saved);state.photos.p1.caption='<script>alert("x")</script> & flowers';
  const changes=diff(state);changes[0].subject='<img src=x onerror=bad>';changes[0].thumbnail='javascript:bad';
  const html=render(changes).html;
  assert.doesNotMatch(html,/<script>|<img|javascript:bad/);assert.match(html,/&lt;script&gt;/);
  assert.deepEqual(highlight('a b c d','a x c y'),['a <del>b</del> c <del>d</del>','a <ins>x</ins> c <ins>y</ins>']);
  const long='word '.repeat(15000);assert.equal(highlight(long,long+'more')[0],long);
  assert.equal(highlight('',long)[1],`<ins>${long}</ins>`);
  assert.equal(render([]).summary,'Your draft matches the saved files.');
});
