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
  const queued=new Map(),states=[],frames=[],stays=[],samples=[];let next=0;
  const controller=create({onState:phase=>states.push(phase),onFrame:(f,c)=>{frames.push(c.key);samples.push(f);},onStay:c=>stays.push(c.key),requestFrame:cb=>{queued.set(++next,cb);return next;},cancelFrame:id=>queued.delete(id)});
  const tick=t=>{const [id,cb]=queued.entries().next().value;queued.delete(id);cb(t);};
  return {controller,queued,states,frames,stays,samples,tick};
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

test('cached sampling keeps the marker on unevenly spaced route geometry without remeasuring it',()=>{
  const route={id:'uneven',geometry:[[10,48],[10,48],[10.001,48],[10.4,48.2],[10.4,48.2],[11,49]]};
  const p=plan([route],routes),replay=globalThis.JOURNEY_ATLAS_REPLAY;
  const expected=[0,.001,.1,.5,.9,.999,1].map(progress=>({progress,point:replay.partialLine(route.geometry,progress).at(-1)}));
  const distance=replay.coordinateDistance;
  replay.coordinateDistance=()=>{throw Error('Distance must only be measured when planning');};
  try {
    for(const {progress,point} of expected){
      const f=frame(p,progress);
      assert.deepEqual(f.position,point);
      assert.deepEqual(f.lines[0].coordinates.at(-1),point);
    }
  } finally { replay.coordinateDistance=distance; }
  assert.deepEqual(frame(plan([{id:'still',geometry:[[10,48],[10,48]]}],routes),.5).position,[10,48]);
});

test('speed stays continuous across connected legs with different lengths',()=>{
  const p=plan([{id:'short',geometry:[[0,0],[1,0]]},{id:'long',geometry:[[1,0],[4,0]]}],routes);
  for(const progress of [.1,.249,.25,.251,.5,.9]) assert.ok(Math.abs(frame(p,progress).position[0]-4*progress)<1e-10);
  const f=frame(p,.3,{since:.2});
  assert.deepEqual(f.lines.map(line=>line.segment.id),['short','long']);
  assert.deepEqual(f.lines[0].coordinates,[[0,0],[1,0]]);
  assert.deepEqual(frame(p,.4,{since:.3}).lines.map(line=>line.segment.id),['long'],'Completed legs are not sent to the map again');
});

test('marker advances every display frame while line updates are capped and the endpoints ease gently',()=>{
  const h=harness(),p=plan([{id:'rail',geometry:[[0,0],[4,0]]}],routes);
  h.controller.start('smooth',p);h.tick(0);
  let lineUpdates=0,markerUpdates=0,previous=0;
  for(let timestamp=660;timestamp<=1660;timestamp+=10){
    h.tick(timestamp);const f=h.samples.at(-1);
    if(f.lines.length)lineUpdates++;
    if(f.progress>previous)markerUpdates++;
    previous=f.progress;
  }
  assert.equal(markerUpdates,101);
  assert.ok(lineUpdates<=31,`${lineUpdates} updates exceeded 30 Hz over one second`);
  assert.ok(h.samples.find(f=>f.progress>0).progress<.001,'Departure eases in');
  h.tick(650+p.duration-10);assert.ok(h.samples.at(-1).progress>.999,'Arrival eases out');
  h.tick(650+p.duration);
  assert.deepEqual(h.samples.at(-1).position,[4,0]);
  assert.deepEqual(h.samples.at(-1).lines[0].coordinates,[[0,0],[4,0]],'The final line is always flushed');
  h.tick(p.duration+1001);assert.deepEqual(h.stays,['smooth']);
});
