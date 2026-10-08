import test from 'node:test';
import assert from 'node:assert/strict';
import '../dist/assets/replay-utils.js';
import '../dist/assets/arrival-chapter.js';
const {plan,frame,destination,create}=globalThis.JOURNEY_ATLAS_ARRIVAL;
const legs=[{id:'rail',geometry:[[10,48],[11,48]]},{id:'bus',geometry:[[11.1,48],[11.2,48]]}];
const routes=segment=>segment.geometry;

test('arrival traces ordered legs separately, including a disconnected replacement bus',()=>{
  const p=plan(legs,routes),a=frame(p,0),b=frame(p,1);
  assert.equal(a.active.segment.id,'rail');
  assert.deepEqual(a.lines[0].coordinates,[[10,48],[10,48]]);
  assert.deepEqual(b.lines.map(l=>l.coordinates),legs.map(l=>l.geometry));
  assert.equal(frame(p,p.legs[0].end+.001).active.segment.id,'bus');
  assert.deepEqual(b.lines[1].coordinates[0],[11.1,48],'No bridge is invented between legs');
});

function harness(){
  const queued=new Map(),states=[],frames=[],stays=[];let next=0;
  const controller=create({onState:phase=>states.push(phase),onFrame:(f,c)=>frames.push(c.key),onStay:c=>stays.push(c.key),requestFrame:cb=>{queued.set(++next,cb);return next;},cancelFrame:id=>queued.delete(id)});
  const tick=t=>{const [id,cb]=queued.entries().next().value;queued.delete(id);cb(t);};
  return {controller,queued,states,frames,stays,tick};
}
test('arrival completes once, can be skipped, and stale city callbacks cannot move the camera',()=>{
  const h=harness(),p=plan(legs,routes);
  h.controller.start('first',p);const stale=[...h.queued.values()][0];
  h.controller.start('second',p);stale(50000);assert.deepEqual(h.stays,[]);
  h.tick(0);h.tick(p.duration+1001);assert.deepEqual(h.stays,['second']);assert.equal(h.queued.size,0);
  h.controller.start('third',p);h.controller.stay();assert.deepEqual(h.stays,['second','third']);assert.equal(h.queued.size,0);
});
test('panning cancels the automatic camera, while reduced motion and empty routes skip travel',()=>{
  const h=harness(),p=plan(legs,routes);
  h.controller.start('pan',p);const stale=[...h.queued.values()][0];h.controller.explore();stale(99999);
  assert.equal(h.controller.phase,'explore');assert.deepEqual(h.stays,[]);
  h.controller.start('reduced',p,{reducedMotion:true});assert.equal(h.queued.size,0);assert.deepEqual(h.stays,['reduced']);
  h.controller.start('empty',plan([],routes));assert.deepEqual(h.stays,['reduced','empty']);
  h.controller.cancel();assert.equal(h.controller.key,undefined);assert.equal(h.controller.phase,'idle');
});
test('stay framing uses destination, then the final available endpoint, and invents no location',()=>{
  assert.deepEqual(destination({destinationId:'city'},[{id:'city',lng:12,lat:47}],legs,routes),[12,47]);
  assert.deepEqual(destination({},[],legs,routes),[11.2,48]);
  assert.equal(destination({},[],[],routes),null);
});
