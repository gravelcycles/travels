import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../dist/assets/app.js',import.meta.url),'utf8');
function fn(name){const start=source.indexOf(`  function ${name}(`);return source.slice(start,source.indexOf('\n  function ',start+1));}
function fixture(){
 const timers=new Map(),elements=new Map();let id=0,frames=0;
 const context=vm.createContext({replayAutoplayTimer:null,replayPlaying:false,replayFrame:null,replayLastTimestamp:null,replayCompleted:false,
  replayTimeline:[{id:'d'}],replayJourneyId:'trip',journey:{id:'trip'},replayUtils:{},document:{hidden:false},
  replayDialog:{open:false,showModal(){this.open=true;}},replayMomentDay:()=>({id:'d'}),updateReplayControls(){},renderReplayMoment(){},initReplayMap(){},replayTick(){},
  $:selector=>{if(!elements.has(selector))elements.set(selector,{focus(){}});return elements.get(selector);},
  window:{setTimeout(callback,delay){timers.set(++id,{callback,delay});return id;},clearTimeout:id=>timers.delete(id),requestAnimationFrame:()=>++frames,cancelAnimationFrame(){}}});
 vm.runInContext(['cancelReplayAutoplay','scheduleReplayAutoplay','pauseReplay','startReplay','toggleReplay','openReplay'].map(fn).join('\n'),context);
 return {context,timers,run:code=>vm.runInContext(code,context)};
}
test('opening Replay waits two seconds, then starts; repeated opens keep one timer',()=>{
 const f=fixture();f.run('openReplay()');assert.equal(f.context.replayPlaying,false);assert.equal(f.timers.size,1);
 assert.equal([...f.timers.values()][0].delay,2000);
 f.run('openReplay()');assert.equal(f.timers.size,1);
 [...f.timers.values()][0].callback();assert.equal(f.context.replayPlaying,true);assert.equal(f.context.replayAutoplayTimer,null);
});
test('pausing during countdown cancels autoplay; manual play starts immediately',()=>{
 const f=fixture();f.run('openReplay();toggleReplay()');assert.equal(f.timers.size,0);assert.equal(f.context.replayPlaying,false);
 f.run('toggleReplay()');assert.equal(f.context.replayPlaying,true);
});
test('closing or hiding Replay prevents a queued timer from starting playback',()=>{
 for(const change of ['replayDialog.open=false','document.hidden=true']){
  const f=fixture();f.run('openReplay()');const timer=[...f.timers.values()][0];f.run(change);timer.callback();assert.equal(f.context.replayPlaying,false);
 }
});
test('Replay waits for image readiness, ignores placeholder loads and reuses a ready photo',()=>{
 const image=Object.assign(new EventTarget(),{src:'blob:cached',complete:true,naturalWidth:3200,dataset:{photoState:'ready'}}),elements=new Map([['#replay-photo',image]]),photo={protected:true,alt:'Test'},requested=[];
 const context=vm.createContext({replayPhotoToken:0,replayPhotoReady:false,replayLastTimestamp:5,replayTimeline:[],replayMomentIndex:0,photo,
  $:selector=>{if(!elements.has(selector))elements.set(selector,{style:{setProperty(){}}});return elements.get(selector);},
  window:{JOURNEY_ATLAS_AUTH:{isProtected:()=>true,unlocked:true,setImage(...args){requested.push(args);}}},replayLeadPhoto:()=>null,replayMomentDay(){},pauseReplay(){},preloadPhoto(){},refreshPreloads(){}});
 vm.runInContext(fn('renderReplayPhoto')+'\nrenderReplayPhoto(photo)',context);assert.equal(context.replayPhotoReady,true);assert.equal(elements.get('#replay-photo-status').textContent,'');
 assert.equal(requested[0][2],Infinity);assert.equal(requested[0][3].fullOnly,true);
 image.src='data:image/webp;base64,blur';image.dataset.photoState='loading';vm.runInContext('renderReplayPhoto(photo)',context);image.dispatchEvent(new Event('load'));assert.equal(context.replayPhotoReady,false);
 image.src='blob:loaded';image.dispatchEvent(new Event('load'));assert.equal(context.replayPhotoReady,false,'A source load alone must not start playback');
 image.dataset.photoState='ready';image.dispatchEvent(new Event('atlas-photo-state'));assert.equal(context.replayPhotoReady,true);
});
test('public photo decoding cannot reveal an abandoned selection and cached revisits skip animation',async()=>{
 const image=Object.assign(new EventTarget(),{dataset:{},src:'',complete:false,naturalWidth:0,classList:{add(){}}}),decodes=[];
 image.decode=()=>new Promise(resolve=>decodes.push(resolve));
 const context=vm.createContext({image,URL,Event,decodedPhotoUrls:new Set(),document:{baseURI:'https://example.com/'},window:{},preferredPhotoUrl:photo=>photo.src});
 vm.runInContext(fn('setPublicFullImage'),context);
 vm.runInContext('setPublicFullImage(image,{src:"/first.webp"});setPublicFullImage(image,{src:"/second.webp"})',context);
 decodes[0]();await new Promise(resolve=>setImmediate(resolve));assert.equal(image.dataset.photoState,'loading');
 decodes[1]();await new Promise(resolve=>setImmediate(resolve));assert.equal(image.dataset.photoState,'ready');assert.equal(image.dataset.photoReveal,'soft');
 vm.runInContext('setPublicFullImage(image,{src:"/third.webp"})',context);
 image.complete=true;image.naturalWidth=3200;image.currentSrc='https://example.com/second.webp';
 vm.runInContext('setPublicFullImage(image,{src:"/second.webp"})',context);
 assert.equal(image.dataset.photoState,'ready');assert.equal(image.dataset.photoReveal,'instant');
 decodes[2]();await new Promise(resolve=>setImmediate(resolve));assert.equal(image.src,'https://example.com/second.webp');
});
