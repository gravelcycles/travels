import test from 'node:test';
import assert from 'node:assert/strict';
import '../dist/assets/replay-utils.js';
import '../dist/assets/arrival-chapter.js';
const {plan,frame,destination,create,createDrawing,afterCamera}=globalThis.JOURNEY_ATLAS_ARRIVAL;
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
  const queued=new Map(),states=[],frames=[],stays=[],samples=[],arrivals=[];let next=0;
  const controller=create({onState:phase=>states.push(phase),onArrival:c=>arrivals.push(c.key),onFrame:(f,c)=>{frames.push(c.key);samples.push(f);},onStay:c=>stays.push(c.key),requestFrame:cb=>{queued.set(++next,cb);return next;},cancelFrame:id=>queued.delete(id)});
  const tick=t=>{const [id,cb]=queued.entries().next().value;queued.delete(id);cb(t);};
  return {controller,queued,states,frames,stays,samples,arrivals,tick};
}

function cameraHarness(){
  const listeners=new Set();let moving=false,eventData;
  const emit=data=>{for(const listener of [...listeners])listener(data);};
  const map={
    stop(){const wasMoving=moving;moving=false;if(wasMoving)emit(eventData);},
    on(name,listener){assert.equal(name,'moveend');listeners.add(listener);},
    off(name,listener){assert.equal(name,'moveend');listeners.delete(listener);},
    isMoving:()=>moving
  };
  return {map,listeners,emit,move:data=>{eventData=data;moving=true;},finish(){moving=false;emit(eventData);}};
}

test('arrival waits for its camera to finish before drawing or starting its travel clock',()=>{
  const h=harness(),camera=cameraHarness(),p=plan(legs,routes);
  h.controller.start('city',p,{prepare:ready=>afterCamera(camera.map,camera.move,ready)});
  assert.equal(p.framingDuration,250);assert.equal(h.controller.phase,'framing');
  assert.equal(h.queued.size,0);assert.deepEqual(h.arrivals,[]);assert.deepEqual(h.frames,[]);
  camera.emit({arrivalCamera:{}});assert.equal(h.controller.phase,'framing','Unrelated map events cannot start playback');
  camera.finish();assert.equal(h.controller.phase,'arrival');assert.deepEqual(h.arrivals,['city']);assert.equal(camera.listeners.size,0);
  h.tick(5000);assert.equal(h.samples.at(-1).progress,0,'Framing time does not consume travel time');
  h.tick(7500);assert.deepEqual(h.stays,[]);h.tick(7750);assert.deepEqual(h.stays,['city']);
});

test('new selections, skip and manual exploration cancel an unfinished camera preparation',()=>{
  const h=harness(),camera=cameraHarness(),p=plan(legs,routes);
  const prepare=ready=>afterCamera(camera.map,camera.move,ready);
  h.controller.start('first',p,{prepare});const stale=[...camera.listeners][0];
  h.controller.start('second',p,{prepare});stale();assert.deepEqual(h.arrivals,[]);
  assert.equal(h.controller.key,'second');assert.equal(camera.listeners.size,1);
  h.controller.stay();camera.finish();assert.deepEqual(h.stays,['second']);assert.deepEqual(h.arrivals,[]);assert.equal(camera.listeners.size,0);
  h.controller.start('third',p,{prepare});h.controller.explore();camera.finish();assert.equal(h.controller.phase,'explore');assert.deepEqual(h.arrivals,[]);assert.equal(camera.listeners.size,0);
});

test('an already-framed camera starts once, while reduced-motion and empty days skip preparation',()=>{
  const h=harness(),camera=cameraHarness(),p=plan(legs,routes);
  h.controller.start('same view',p,{prepare:ready=>afterCamera(camera.map,()=>{},ready)});
  assert.deepEqual(h.arrivals,['same view']);assert.equal(h.queued.size,1);assert.equal(camera.listeners.size,0);
  const prepare=()=>{throw Error('Should not move the camera before a reduced-motion or empty stay');};
  h.controller.start('reduced',p,{reducedMotion:true,prepare});
  h.controller.start('empty',plan([],routes),{prepare});
  assert.deepEqual(h.stays,['reduced','empty']);assert.equal(h.queued.size,0);
});
test('arrival completes once, can be skipped, and stale city callbacks cannot move the camera',()=>{
  const h=harness(),p=plan(legs,routes);
  h.controller.start('first',p);const stale=[...h.queued.values()][0];
  h.controller.start('second',p);stale(50000);assert.deepEqual(h.stays,[]);
  h.tick(0);h.tick(p.duration+p.arrivalHold);assert.deepEqual(h.stays,['second']);assert.equal(h.queued.size,0);
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
  const route={id:'uneven',geometry:[[0,0],[0,0],[.001,0],[.4,0],[.4,0],[1,0]]};
  const p=plan([route],routes),distance=Math.hypot;
  Math.hypot=()=>{throw Error('Distance must only be measured when planning');};
  try {
    for(const progress of [0,.001,.1,.5,.9,.999,1]){
      const f=frame(p,progress);
      assert.ok(Math.abs(f.position[0]-progress)<1e-10);
      assert.equal(f.position[1],0);
      assert.deepEqual(f.lines[0].coordinates.at(-1),f.position);
    }
  } finally { Math.hypot=distance; }
  assert.deepEqual(frame(plan([{id:'still',geometry:[[10,48],[10,48]]}],routes),.5).position,[10,48]);
});

test('overhead progress is linear through small switchbacks while the full track is drawn',()=>{
  const geometry=Array.from({length:101},(_,index)=>[index*.005,index===0||index===100?0:index%2?.02:-.02]);
  geometry.push([1,0]);
  const p=plan([{id:'switchbacks',geometry}],routes);
  for(const progress of [.1,.2,.3,.4,.5,.75]) assert.ok(Math.abs(frame(p,progress).position[0]-progress)<1e-10,'Winding sections must not consume extra overview time');
  assert.deepEqual(frame(p,1).lines[0].coordinates,geometry,'Only the timing is simplified');
  assert.deepEqual(frame(p,.25).position,geometry[50],'The marker follows the real track, not the shortcut');
});

test('backtracking has positive time while major bends and closed loops stay meaningful',()=>{
  const p=plan([{id:'folded',geometry:[[0,0],[.4,.01],[.1,-.01],[.45,.01],[.3,-.01],[.5,0],[1,0]]}],routes);
  assert.ok(p.legs[0].distances.every((distance,index,all)=>!index||distance>all[index-1]),'Reverse sections must not teleport');
  assert.ok(Math.abs(frame(p,.5).position[0]-.5)<.025,'Reverse sections only get a small share of time');
  const bent=plan([{id:'bend',geometry:[[0,0],[1,0],[1,1]]}],routes);
  assert.deepEqual(bent.legs[0].overviewIndices,[0,1,2]);
  const loop=plan([{id:'loop',geometry:[[0,0],[1,0],[1,1],[0,0]]}],routes);
  assert.ok(loop.legs[0].distance>3);
  assert.ok(frame(loop,.5).position.every(Number.isFinite));
  assert.deepEqual(frame(loop,1).position,[0,0]);
});

test('speed stays continuous across connected legs with different lengths',()=>{
  const p=plan([{id:'short',geometry:[[0,0],[1,0]]},{id:'long',geometry:[[1,0],[4,0]]}],routes);
  for(const progress of [.1,.249,.25,.251,.5,.9]) assert.ok(Math.abs(frame(p,progress).position[0]-4*progress)<1e-10);
  const f=frame(p,.3,{since:.2});
  assert.deepEqual(f.lines.map(line=>line.segment.id),['short','long']);
  assert.deepEqual(f.lines[0].coordinates,[[0,0],[1,0]]);
  assert.deepEqual(frame(p,.4,{since:.3}).lines.map(line=>line.segment.id),['long'],'Completed legs are not sent to the map again');
});

test('travel updates on every display frame for 2.5 seconds, then holds the endpoint for 250 ms',()=>{
  const h=harness(),p=plan([{id:'rail',geometry:[[0,0],[4,0]]}],routes);
  assert.equal(p.duration,2500);assert.equal(plan(legs,routes).duration,2500);
  h.controller.start('smooth',p);h.tick(0);
  let markerUpdates=0,previous=0;
  for(let timestamp=10;timestamp<=1010;timestamp+=10){
    h.tick(timestamp);const f=h.samples.at(-1);
    assert.equal(f.progress,timestamp/2500);
    assert.deepEqual(f.lines,[],'The animation must not rebuild GeoJSON');
    if(f.progress>previous)markerUpdates++;
    previous=f.progress;
  }
  assert.equal(markerUpdates,101);
  h.tick(2499);assert.equal(h.controller.phase,'arrival');assert.deepEqual(h.stays,[]);
  h.tick(2500);
  assert.deepEqual(h.samples.at(-1).position,[4,0]);
  assert.deepEqual(h.stays,[]);assert.equal(h.controller.phase,'arrival');
  h.tick(2749);assert.deepEqual(h.samples.at(-1).position,[4,0]);assert.deepEqual(h.stays,[]);
  h.tick(2750);
  assert.deepEqual(h.stays,['smooth']);assert.equal(h.queued.size,0);
});

test('navigation and skip cancel the quarter-second hold without leaving a late zoom',()=>{
  const h=harness(),p=plan(legs,routes);
  h.controller.start('first',p);h.tick(0);h.tick(2500);const stale=[...h.queued.values()][0];
  h.controller.start('second',p);stale(2750);assert.deepEqual(h.stays,[]);
  h.tick(0);h.tick(2500);h.controller.stay();assert.deepEqual(h.stays,['second']);assert.equal(h.queued.size,0);
});

function drawingHarness(p){
  const events=new Map(),strokes=[],icons=[];let clears=0,projects=0,removed=false,inserted=false;
  class Path {
    constructor(other){this.points=other?.points.slice()||[];}
    moveTo(x,y){this.points.push(['move',x,y]);}
    lineTo(x,y){this.points.push(['line',x,y]);}
  }
  const context={
    clearRect(){clears++;},setTransform(){},setLineDash(dash){this.dash=dash;},
    stroke(path){if(path)strokes.push({points:path.points.slice(),dash:this.dash.slice(),color:this.strokeStyle});},
    save(){},restore(){},beginPath(){},arc(){},fill(){},fillText(text,x,y){icons.push([x,y]);}
  };
  const canvas={getContext:()=>context,setAttribute(){},remove(){removed=true;}};
  const base={clientWidth:800,clientHeight:600,after(node){assert.equal(node,canvas);inserted=true;}};
  const map={getCanvas:()=>base,project:([lng,lat])=>{projects++;return{x:lng*10,y:lat*10};},on:(name,callback)=>events.set(name,callback),off:name=>events.delete(name)};
  const drawing=createDrawing({map,plan:p,document:{createElement:()=>canvas},Path,pixelRatio:()=>2,styleForSegment:s=>({color:s.id,casing:'#fff',width:6,casingWidth:10,dash:s.id==='bus'?[2,2]:null})});
  return {drawing,events,strokes,icons,canvas,base,get clears(){return clears;},get projects(){return projects;},get removed(){return removed;},get inserted(){return inserted;}};
}

test('canvas trail and icon paint together at display cadence without reprojecting the full route',()=>{
  const p=plan(legs,routes),h=drawingHarness(p);
  assert.equal(h.inserted,true);assert.equal(h.canvas.width,1600);assert.equal(h.canvas.height,1200);
  const initialProjects=h.projects;
  for(let index=0;index<=120;index++)h.drawing.draw(frame(p,index/120,{drawLines:false}));
  assert.equal(h.clears,121,'No 30 Hz cap: every new display-frame position is painted');
  assert.equal(h.projects-initialProjects,121,'Only the moving tip is projected per frame');
  assert.equal(h.icons.length,121);
  const last=h.strokes.at(-1);
  assert.deepEqual(last.points.at(-1).slice(1),h.icons.at(-1),'The trail reaches the icon in the same paint');
  assert.deepEqual(last.dash,[12,12],'Bus dash styling survives the fast renderer');
  assert.deepEqual(last.points[0],['move',111,480],'Disconnected legs have separate paths');
  h.drawing.draw(frame(p,1,{drawLines:false}));assert.equal(h.clears,121,'The endpoint holds without repeated painting');
});

test('canvas reprojection handles resize and cleanup removes all animation drawing listeners',()=>{
  const p=plan(legs,routes),h=drawingHarness(p);
  h.drawing.draw(frame(p,.5,{drawLines:false}));h.base.clientWidth=400;h.events.get('resize')();
  assert.equal(h.canvas.width,800);assert.equal(h.clears,2);
  const stale=h.events.get('move');h.drawing.destroy();
  assert.equal(h.removed,true);assert.equal(h.events.size,0);
  stale();h.drawing.draw(frame(p,.9,{drawLines:false}));assert.equal(h.clears,2);
});
