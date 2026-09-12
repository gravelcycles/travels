import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import '../dist/assets/replay-utils.js';
const source=fs.readFileSync(new URL('../dist/assets/app.js',import.meta.url),'utf8');
function fn(name){const start=source.indexOf(`  function ${name}(`);return source.slice(start,source.indexOf('\n  function ',start+1));}
function harness(){
  const calls=[];
  const segments=[{id:'out',geometry:[[8,47],[8.5,47.2]]},{id:'return',geometry:[[8.5,47.2],[8,47]]}];
  const photo={id:'photo',lng:10,lat:45,zoom:19};
  const context=vm.createContext({replayFeedback:null,replayMapReady:true,replayProgress:0,replayUtils:globalThis.JOURNEY_ATLAS_REPLAY,
    replayMap:{fitBounds:(bounds,options)=>calls.push({type:'fit',bounds,options}),easeTo:options=>calls.push({type:'ease',options})},
    replayMomentDay:()=>({id:'d'}),photoById:()=>photo,segmentById:id=>segments.find(s=>s.id===id),segmentCoordinates:s=>s.geometry,
    prefersReducedMotion:()=>false,replayMapPadding:()=>40,boundsFromCoordinates:points=>points,PHOTO_ZOOM_LIMITS:{min:2,max:20},dayCoordinates:()=>[],journeyCoordinates:()=>[]});
  vm.runInContext(fn('replaySegment')+'\n'+fn('fitReplayMoment'),context);
  return {context,calls};
}
test('Replay frames each travel leg even when its chapter has a pinned photo and saved camera',()=>{
  const {context,calls}=harness();
  context.moment={type:'chapter',segmentIds:['out','return'],photoId:'photo',camera:{reviewed:true,center:[20,30],zoom:18}};
  vm.runInContext('fitReplayMoment(moment)',context);
  assert.equal(calls[0].type,'fit');assert.deepEqual(calls[0].bounds,[[8,47],[8.5,47.2]]);
  assert.equal(calls[0].options.maxZoom,13);
  context.replayProgress=.8;
  vm.runInContext('fitReplayMoment(moment)',context);
  assert.deepEqual(calls[1].bounds,[[8.5,47.2],[8,47]]);
  assert.ok(calls.every(c=>c.type==='fit'));
});
test('rest-day Replay uses the reviewed map camera; reduced motion skips the move',()=>{
  const {context,calls}=harness();context.moment={type:'chapter',camera:{reviewed:true,center:[10,45],zoom:19}};
  vm.runInContext('fitReplayMoment(moment)',context);
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0])),{type:'ease',options:{center:[10,45],zoom:19,duration:700}});
  context.prefersReducedMotion=()=>true;
  vm.runInContext('fitReplayMoment(moment)',context);assert.equal(calls[1].options.duration,0);
});

test('2× gives rest days 50% more screen time while 1× and travel timing stay unchanged', () => {
  const context = vm.createContext({ replaySpeed: 1, replayMomentDay: () => ({segmentIds: []}) });
  vm.runInContext(fn('replayMomentDuration'), context);
  for (const duration of [2.4, 2.8, 6]) {
    context.moment = {duration};
    const wallTime = speed => { context.replaySpeed = speed; return vm.runInContext('replayMomentDuration(moment)', context) / speed; };
    assert.equal(wallTime(1), duration * 1000);
    assert.equal(wallTime(0.5), duration * 2000);
    assert.equal(wallTime(2), duration * 750);
    context.replayMomentDay = () => ({segmentIds: ['train']});
    assert.equal(wallTime(2), duration * 500);
    context.replayMomentDay = () => ({segmentIds: []});
  }
});
