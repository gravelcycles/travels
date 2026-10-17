import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../dist/assets/photo-swipe-raster.js', import.meta.url), 'utf8');
function fixture({query='?swipeRenderer=prepared', supported=true}={}) {
  const workers=[],canvases=[],events=new Map(),revoked=[];
  const stage={dataset:{}},frame={children:[],append(node){this.children.push(node);},addEventListener(name,fn){events.set(name,fn);}};
  let authorized=true;
  class Worker {
    constructor(){this.jobs=[];workers.push(this);}
    postMessage(job){this.jobs.push(job);}
    terminate(){this.terminated=true;}
  }
  class SourceURL extends URL {static createObjectURL(){return 'blob:https://example.test/worker';}static revokeObjectURL(url){revoked.push(url);}}
  const env={location:{origin:'https://example.test',href:'https://example.test/trip',search:query},devicePixelRatio:3,URL:SourceURL,Blob,Worker:supported?Worker:null,OffscreenCanvas:class{},createImageBitmap(){},
    document:{createElement(){const attrs={};const canvas={hidden:true,width:0,height:0,style:{},setAttribute(k,v){attrs[k]=v;},getAttribute(k){return attrs[k]??null;},getContext(){return{transferFromImageBitmap(bitmap){canvas.bitmap=bitmap;}};}};canvases.push(canvas);return canvas;}},
    addEventListener:(name,fn)=>events.set(name,fn),JOURNEY_ATLAS_AUTH:{imageBlob:()=>authorized?{encoded:'full authorized AVIF'}:null}};
  vm.runInNewContext(source,{window:env,URLSearchParams});
  const api=env.JourneyPhotoSwipeRaster.create({stage,frame,enabled:()=>true});
  const images=[0,1,2].map(i=>({id:i===0?'modal-photo':'',alt:i===0?'Selected photo':'',src:`blob:https://example.test/p${i}`,currentSrc:'',hidden:false,complete:true,naturalWidth:4032,dataset:{photoState:'ready',photoReveal:'instant',privateSrc:'protected'},style:{transform:`translate3d(${i*406}px,0,0)`}}));
  function complete(worker=workers.at(-1),job=worker.jobs.at(-1)){
    const bitmap={close(){this.closed=true;}};worker.onmessage({data:{slot:job.slot,id:job.id,bitmap}});return bitmap;
  }
  return {api,env,stage,frame,images,workers,canvases,events,revoked,complete,deny(){authorized=false;}};
}

test('normal links and unavailable APIs allocate no rendering resources',()=>{
  for(const options of [{query:''},{supported:false}]){
    const f=fixture(options);assert.equal(f.api,null);assert.equal(f.workers.length,0);assert.equal(f.canvases.length,0);
  }
});
test('three physical-resolution surfaces reuse full authorized bytes and preserve native sources',()=>{
  const f=fixture();f.images.forEach(f.api.register);f.api.register({...f.images[0]});assert.equal(f.canvases.length,3);
  f.api.resize(390,666);assert.equal(f.workers.length,1);assert.equal(f.workers[0].jobs.length,3);
  const job=f.workers[0].jobs[0];assert.equal(job.width,1170);assert.equal(job.height,1998);
  assert.equal(job.blob.encoded,'full authorized AVIF');assert.equal(job.src,undefined,'No protected network request is delegated');
  f.api.active(true);assert.ok(f.canvases.every(c=>c.hidden));
  f.complete(f.workers[0],job);
  assert.equal(f.images[0].dataset.photoRasterVisible,'true');assert.equal(f.canvases[0].hidden,false);
  assert.equal(f.canvases[0].getAttribute('aria-label'),'Selected photo');assert.equal(f.canvases[0].getAttribute('aria-hidden'),'false');
  assert.equal(f.canvases[1].getAttribute('aria-hidden'),'true');
  assert.equal(f.canvases[0].width,1170);assert.equal(f.canvases[0].height,1998);
  f.api.active(false);assert.equal(f.images[0].dataset.photoRasterVisible,undefined);assert.equal(f.canvases[0].getAttribute('aria-hidden'),'true');
  f.api.active(true);f.api.prepareAll();assert.equal(f.workers[0].jobs.length,3);
  assert.equal(f.images[0].src,'blob:https://example.test/p0','Full original stays attached for zoom and ordinary loader ownership');
});
test('replaced sources reject late worker pixels and follow the current slot transform',()=>{
  const f=fixture();f.images.forEach(f.api.register);f.api.resize(390,666);f.api.active(true);
  const worker=f.workers[0],old=worker.jobs[0];f.images[0].src='blob:https://example.test/new';f.api.prepareAll();
  const stale=f.complete(worker,old);assert.equal(stale.closed,true);assert.equal(f.canvases[0].hidden,true);
  f.complete(worker,worker.jobs.at(-1));assert.equal(f.canvases[0].hidden,false);
  f.images[0].style.transform='translate3d(-123px,0,0)';f.api.sync();assert.equal(f.canvases[0].style.transform,f.images[0].style.transform);
  f.images[0].src='https://other.example/image.jpg';f.api.prepareAll();assert.equal(f.canvases[0].hidden,true);assert.equal(f.canvases[0].width,0);
});
test('a prepared selected surface preserves the opening reveal until completion or direct manipulation',()=>{
  const f=fixture();f.images[0].dataset.photoReveal='soft';f.api.register(f.images[0]);f.api.resize(390,666);f.api.active(true);
  f.complete();assert.equal(f.canvases[0].hidden,true);
  f.events.get('animationend')({target:f.images[0],animationName:'photo-resolve'});assert.equal(f.canvases[0].hidden,false);
  f.images[0].src='blob:https://example.test/another';f.api.prepareAll();f.complete();assert.equal(f.canvases[0].hidden,true);
  f.images[0].dataset.photoReveal='instant';f.api.sync();assert.equal(f.canvases[0].hidden,false);
});
test('lock, unavailable authorization and failed preparation fall back without retaining protected surfaces',()=>{
  const f=fixture();f.images.forEach(f.api.register);f.api.resize(390,666);f.api.active(true);const worker=f.workers[0];
  f.complete(worker,worker.jobs[0]);f.events.get('atlas-photos-locked')();
  assert.equal(worker.terminated,true);assert.ok(f.canvases.every(c=>c.hidden&&c.width===0&&c.height===0));
  assert.ok(f.images.every(i=>!i.dataset.photoRasterVisible));assert.equal(f.complete(worker,worker.jobs[1]).closed,true);
  f.deny();f.api.prepareAll();assert.equal(f.workers.length,1,'Expired access must not start another worker or private request');
  assert.equal(f.stage.dataset.swipeRasterReady,'0');
});
test('orientation changes discard old-sized pixels; large viewports retain native detail',()=>{
  const f=fixture();f.images.forEach(f.api.register);f.api.resize(390,666);const old=f.workers[0];
  f.api.resize(844,390);assert.equal(old.terminated,true);assert.equal(f.complete(old,old.jobs[0]).closed,true);
  assert.equal(f.workers[1].jobs[0].width,2532);assert.equal(f.workers[1].jobs[0].height,1170);
  f.api.resize(900,1600);assert.ok(f.canvases.every(c=>c.hidden&&c.width===0));assert.equal(f.workers.length,2,'No downscaled substitute is created for an oversized physical surface');
});
test('worker preparation uses contain fitting and releases the full decode after drawing',async()=>{
  let script='';const f=fixture();f.env.Blob=class{constructor(parts){script=parts.join('');}};
  f.api.register(f.images[0]);f.api.resize(390,666);
  const posted=[],drawn=[],sources=[],surfaces=[],self={postMessage(value,transfers){posted.push({value,transfers});}};
  class OffscreenCanvas{
    constructor(width,height){this.width=width;this.height=height;surfaces.push(this);}
    getContext(){return{drawImage(...args){drawn.push(args);}};}
    transferToImageBitmap(){return{width:this.width,height:this.height};}
  }
  vm.runInNewContext(script,{self,OffscreenCanvas,fetch(){throw Error('Authorized bytes must not be fetched again');},
    async createImageBitmap(blob){assert.equal(blob.encoded,'full authorized AVIF');const image={width:4032,height:3024,close(){this.closed=true;}};sources.push(image);return image;}});
  self.onmessage({data:f.workers[0].jobs[0]});await new Promise(resolve=>setImmediate(resolve));
  assert.equal(posted.length,1);assert.equal(sources[0].closed,true);assert.equal(surfaces[0].width,0);
  assert.equal(drawn[0][1],0);assert.equal(drawn[0][3],1170);assert.ok(Math.abs(drawn[0][4]-877.5)<1e-9);
  assert.ok(Math.abs(drawn[0][2]-(1998-877.5)/2)<1e-9);assert.equal(posted[0].value.bitmap.width,1170);assert.equal(posted[0].value.bitmap.height,1998);
});
test('failed preparation restores the original and never reports a ready surface',()=>{
  const f=fixture();f.api.register(f.images[0]);f.api.resize(390,666);f.api.active(true);
  const worker=f.workers[0],job=worker.jobs[0];worker.onmessage({data:{slot:job.slot,id:job.id,error:'decode'}});
  assert.equal(f.stage.dataset.swipeRasterError,'decode');assert.equal(f.stage.dataset.swipeRasterReady,'0');
  assert.equal(f.images[0].dataset.photoRasterVisible,undefined);assert.equal(f.canvases[0].hidden,true);
});
