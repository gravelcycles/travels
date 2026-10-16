import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const source=fs.readFileSync(new URL('../dist/assets/photo-auth.js',import.meta.url),'utf8');
const photo={protected:true,src:`/private-photos/assets/v1/${'b'.repeat(64)}.webp`,srcset:[{src:`/private-photos/assets/v1/${'a'.repeat(64)}.webp`,width:1280},{src:`/private-photos/assets/v1/${'b'.repeat(64)}.webp`,width:3200}],blur:'data:image/webp;base64,placeholder',width:3200,height:2400};
class Element extends EventTarget {
 constructor(){super();this.dataset={};this.children=new Map();this.isConnected=true;this.classList={add(){},remove(){}};this.src='';this.open=false;}
 querySelector(s){if(!this.children.has(s))this.children.set(s,new Element());return this.children.get(s);}
 querySelectorAll(){return [];}
 append(){}setAttribute(){}removeAttribute(name){if(name==='srcset')this.srcset='';}focus(){}showModal(){this.open=true;}close(){this.open=false;}
}
function fixture(fetchImpl=async()=>new Response(new Uint8Array([1,2]),{headers:{'Content-Type':'image/webp'}}),{startup=false,tabStorage=new Map(),clock=Date,hash='',avifSupport}={}){
 const elements=[],header=new Element(),events=new Map(),calls=[],revoked=[],timers=new Map(),blobs=new Map(),probes=[];let loginFlow,timerId=0,blobId=0;
 const document={body:new Element(),hidden:false,activeElement:new Element(),createElement(){const e=new Element();elements.push(e);return e;},querySelector(){return header;},querySelectorAll(){return [elements[0].querySelector('[data-unlock]'),elements[1].querySelector('[data-unlock]')];},addEventListener(n,fn){events.set(n,fn);}};
 const window={JOURNEY_ATLAS_PHOTO_SERVICE:{origin:'https://photos.example.com'},addEventListener(n,fn){events.set(n,fn);},dispatchEvent(event){events.get(event.type)?.(event);},open(){throw new Error('Login should not require a popup');}};
 const Url=class extends URL{};Url.createObjectURL=blob=>{const url=`blob:fixture-${++blobId}`;blobs.set(url,blob);return url;};Url.revokeObjectURL=u=>revoked.push(u);
 class Probe {
  constructor(){probes.push(this);}
  set src(value){this.source=value;if(avifSupport!=='pending')queueMicrotask(()=>this.finish(avifSupport));}
  finish(supported){this.naturalWidth=supported?1:0;this.naturalHeight=supported?1:0;if(supported)this.onload?.();else this.onerror?.();}
 }
 document.body.dataset.journeyScope=startup?'real':'demo';
 const navigations=[],historyUrls=[];const location=new URL('https://gravelcycles.github.io/travels/');location.hash=hash;location.assign=url=>navigations.push(url);
 const storage={getItem:k=>k==='atlas-photo-login'?JSON.stringify(loginFlow):tabStorage.get(k)||null,removeItem:k=>tabStorage.delete(k),setItem(k,v){if(k==='atlas-photo-login')loginFlow=JSON.parse(v);else tabStorage.set(k,v);}};
 const context=vm.createContext({window,document,location,...(avifSupport!==undefined?{Image:Probe}:{}),history:{replaceState(_state,_title,url){historyUrls.push(url);}},sessionStorage:storage,URL:Url,URLSearchParams,Event,AbortController,TextEncoder,crypto,Uint8Array,Blob,btoa,Date:clock,setTimeout:(fn,delay)=>{timers.set(++timerId,{fn,delay});return timerId;},clearTimeout:id=>timers.delete(id),setInterval:()=>2,clearInterval(){},fetch:async(...args)=>{if(args[0].endsWith('/auth/redeem'))return Response.json({token:'fixture-access-token',expiresAt:Math.floor(clock.now()/1000)+3600});calls.push(args);return fetchImpl(...args);}});
 vm.runInContext(source.replace('completeReturn();}', 'window.__startup=completeReturn();}').replace(/\}\)\(\);\s*$/, 'window.__completeReturn=completeReturn;})();'),context);
 async function unlock(spoof=false){loginFlow={state:'fixture-state',verifier:'v'.repeat(43),created:Date.now(),hash:''};location.hash=new URLSearchParams({photoAuthCode:'c'.repeat(43),state:spoof?'wrong-state':'fixture-state'}).toString();await window.__completeReturn();}

 async function returnFrom(kind){location.hash=new URLSearchParams({[kind]:kind==='photoAuthCode'?'c'.repeat(43):'1',state:loginFlow.state}).toString();await window.__completeReturn();}
 return {window,events,document,timers,auth:window.JOURNEY_ATLAS_AUTH,calls,revoked,blobs,probes,unlock,navigations,dialog:elements[0],returnFrom,ready:window.__startup,tabStorage,historyUrls,header:elements[1]};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
async function waitForNavigation(f) {
 // Web Crypto completes on a worker thread; a few event-loop turns are not a completion signal.
 for(let i=0;i<200&&!f.navigations.length;i++)await new Promise(resolve=>setTimeout(resolve,5));
 assert.equal(f.navigations.length,1,'The remembered-session redirect should finish');
}
test('all sharp loads/preloads stay gated; markup contains only a placeholder src',async()=>{
 const f=fixture(),img=new Element();f.auth.setImage(img,photo);f.auth.preload(photo,1280);await settle();assert.equal(f.calls.length,0);assert.equal(img.src,photo.blur);
 const html=f.auth.markup(photo);assert.match(html,/src="data:image/);assert.ok(!html.includes(' src="/private-photos/'));assert.ok(!html.includes(' srcset='));
 await f.unlock(true);await settle();assert.equal(f.calls.length,0);assert.equal(f.auth.unlocked,false);
});
test('filmstrips request a thumbnail and the viewer reuses it while the full photo downloads',async()=>{
 const thumb={src:`/private-photos/assets/v1/${'c'.repeat(64)}.webp`,width:480};
 const sized={...photo,srcset:[thumb,...photo.srcset]};
 const f=fixture();
 const markup=f.auth.markup(sized,{targetWidth:480});assert.ok(markup.includes(`data-private-src="${thumb.src}"`));
 await f.unlock();f.auth.preload(sized,480);await settle();
 const img=new Element();f.auth.setImage(img,sized,Infinity);
 assert.match(img.src,/^blob:/,'The loaded thumbnail should appear synchronously');
 await settle();assert.ok(f.calls.some(([url])=>url.endsWith(photo.src)));
 assert.equal(f.calls.filter(([url])=>url.endsWith(thumb.src)).length,1);
 assert.equal(f.calls.filter(([url])=>url.endsWith(photo.srcset[0].src)).length,0,'A cached thumbnail avoids downloading an extra preview on the way to full size');
});
test('visible photos receive high browser priority while speculative preloads stay low',async()=>{
 const f=fixture();await f.unlock();const img=new Element();
 img.dataset.privateSrc=photo.src;await f.auth.hydrate(img);
 assert.equal(f.calls[0][1].priority,'high');
 assert.equal(f.calls[0][1].cache,'no-cache','Allow browser storage with access revalidation');
 f.auth.preload(albumPhoto(9),1280);await settle();
 assert.equal(f.calls[1][1].priority,'low');
});
test('full-only presentation ignores cached previews and waits for the largest image to decode',async()=>{
 let finishDownload,finishDecode;
 const f=fixture(url=>url.endsWith(photo.src)?new Promise(resolve=>finishDownload=resolve):Promise.resolve(new Response(new Uint8Array([1]),{headers:{'Content-Type':'image/webp'}})));
 await f.unlock();f.auth.preload(photo,1280);await settle();
 const img=new Element();img.decode=()=>new Promise(resolve=>finishDecode=resolve);
 f.auth.setImage(img,photo,1280,{fullOnly:true});await settle();
 assert.equal(img.dataset.privateSrc,photo.src);assert.equal(img.dataset.photoState,'loading');
 assert.ok(!img.src.startsWith('blob:'));assert.notEqual(img.src,photo.blur);
 finishDownload(new Response(new Uint8Array([2]),{headers:{'Content-Type':'image/webp'}}));await settle();
 assert.match(img.src,/^blob:/);assert.equal(img.dataset.photoState,'loading','Do not reveal an undecoded image');
 finishDecode();await settle();assert.equal(img.dataset.photoState,'ready');
 const count=f.calls.length;f.auth.setImage(img,photo,Infinity,{fullOnly:true});assert.equal(img.dataset.photoState,'ready');assert.equal(f.calls.length,count);
});
test('full-only failures remain blank rather than falling back to a cached smaller image',async()=>{
 const f=fixture(url=>Promise.resolve(url.endsWith(photo.src)?new Response('',{status:404}):new Response(new Uint8Array([1]),{headers:{'Content-Type':'image/webp'}})));
 await f.unlock();f.auth.preload(photo,1280);await settle();const img=new Element();
 f.auth.setImage(img,photo,Infinity,{fullOnly:true});await settle();
 assert.equal(img.dataset.photoState,'error');assert.ok(!img.src.startsWith('blob:'));assert.notEqual(img.src,photo.blur);
});
test('revisiting a decoded full photo skips loading state without another download',async()=>{
 const f=fixture();await f.unlock();const img=new Element();img.decode=()=>Promise.resolve();
 f.auth.setImage(img,photo,Infinity,{fullOnly:true});await settle();const original=img.src;
 f.auth.setImage(img,albumPhoto(5),Infinity,{fullOnly:true});await settle();const count=f.calls.length;
 const states=[];img.addEventListener('atlas-photo-state',()=>states.push(img.dataset.photoState));
 img.decode=()=>new Promise(()=>{});
 f.auth.setImage(img,photo,Infinity,{fullOnly:true});
 assert.equal(img.src,original);assert.equal(img.dataset.photoState,'ready');assert.deepEqual(states,['ready']);
 assert.equal(img.dataset.photoReveal,'instant');
 await settle();assert.equal(f.calls.length,count);
});
test('a full-image decode finishing after lock cannot reveal the photo',async()=>{
 const f=fixture();await f.unlock();let decoded;const img=new Element();img.decode=()=>new Promise(resolve=>decoded=resolve);
 f.auth.setImage(img,photo,Infinity,{fullOnly:true});await settle();assert.equal(img.dataset.photoState,'loading');
 f.auth.lock();decoded();await settle();assert.equal(img.dataset.photoState,'locked');assert.ok(!img.src.startsWith('blob:'));
});
test('thumbnail reveal waits for decoding and ignores a queued blur load',async()=>{
 const f=fixture();await f.unlock();let decoded;const img=new Element();img.decode=()=>new Promise(resolve=>decoded=resolve);
 f.auth.setImage(img,photo,1280);await settle();assert.equal(img.dataset.photoState,'loading');
 img.complete=false;img.naturalWidth=32;img.currentSrc=photo.blur;img.dispatchEvent(new Event('load'));
 assert.equal(img.dataset.photoState,'loading');decoded();await settle();assert.equal(img.dataset.photoState,'ready');
 assert.equal(img.dataset.photoReveal,'soft');
});
test('late decoding cannot reveal a newly selected photo or finish its animation early',async()=>{
 const f=fixture();await f.unlock();const decodes=[],img=new Element();img.decode=()=>new Promise(resolve=>decodes.push(resolve));
 f.auth.setImage(img,photo,Infinity,{fullOnly:true});await settle();
 f.auth.setImage(img,albumPhoto(5),Infinity,{fullOnly:true});await settle();const current=img.src;
 decodes[0]();await settle();assert.equal(img.src,current);assert.equal(img.dataset.photoState,'loading');
 decodes[1]();await settle();assert.equal(img.dataset.photoState,'ready');
});
test('reselecting a photo with bytes but unfinished decoding keeps it loading',async()=>{
 const f=fixture();await f.unlock();let decoded;const img=new Element();img.decode=()=>new Promise(resolve=>decoded=resolve);
 f.auth.setImage(img,photo,Infinity,{fullOnly:true});await settle();
 f.auth.setImage(img,photo,Infinity,{fullOnly:true});assert.equal(img.dataset.photoState,'loading');
 decoded();await settle();assert.equal(img.dataset.photoState,'ready');
});
test('a loaded full photo is revealed even when decode stalls, ignoring a queued placeholder load',async()=>{
 const f=fixture();await f.unlock();const img=new Element();img.decode=()=>new Promise(()=>{});
 f.auth.setImage(img,photo,Infinity,{fullOnly:true});await settle();
 img.complete=false;img.naturalWidth=32;img.currentSrc=photo.blur;img.dispatchEvent(new Event('load'));
 assert.equal(img.dataset.photoState,'loading');
 img.complete=true;img.naturalWidth=3200;img.currentSrc=img.src;img.dispatchEvent(new Event('load'));
 assert.equal(img.dataset.photoState,'ready');
});
test('decode rejection does not hide a full image that subsequently loads normally',async()=>{
 const f=fixture();await f.unlock();const img=new Element();img.decode=()=>Promise.reject(new Error('Decode interrupted'));
 f.auth.setImage(img,photo,Infinity,{fullOnly:true});await settle();
 assert.equal(img.dataset.photoState,'loading');
 img.complete=true;img.naturalWidth=3200;img.currentSrc=img.src;img.dispatchEvent(new Event('load'));
 assert.equal(img.dataset.photoState,'ready');
});
test('authorized consumers share one request, and logout revokes blobs and restores placeholders',async()=>{
 const f=fixture(),a=new Element(),b=new Element();f.auth.setImage(a,photo);f.auth.setImage(b,photo);await f.unlock();await settle();await settle();
 assert.equal(f.calls.length,1);assert.equal(f.calls[0][1].headers.Authorization,'Bearer fixture-access-token');assert.equal(f.calls[0][1].credentials,'omit');assert.match(a.src,/^blob:/);assert.equal(a.src,b.src);
 f.auth.lock();assert.equal(f.auth.unlocked,false);assert.equal(a.src,photo.blur);assert.equal(b.src,photo.blur);assert.equal(f.revoked.length,1);
});
test('logout during a pending fetch cannot restore a sharp image',async()=>{
 let complete;const pending=new Promise(resolve=>{complete=resolve;});const f=fixture(()=>pending),img=new Element();f.auth.setImage(img,photo,Infinity);await f.unlock();await settle();assert.equal(f.calls.length,1);
 f.auth.lock();complete(new Response(new Uint8Array([1]),{headers:{'Content-Type':'image/webp'}}));await settle();await settle();assert.equal(img.src,photo.blur);assert.equal(f.auth.unlocked,false);
});
test('401 relocks every loaded photo and clears tab access',async()=>{
 const f=fixture(async()=>new Response('{}',{status:401})),img=new Element();f.auth.setImage(img,photo);await f.unlock();await settle();assert.equal(f.auth.unlocked,false);assert.equal(img.src,photo.blur);assert.ok(!/localStorage|document\.cookie/.test(source));assert.equal(f.tabStorage.has('atlas-photo-access'),false);await waitForNavigation(f);
});
test('cleared viewer slots do not regain an old photo when access changes',async()=>{
 const f=fixture(),img=new Element();f.auth.setImage(img,photo);f.auth.clearImage(img);img.src='';
 await f.unlock();await settle();assert.equal(f.calls.length,0);f.auth.lock();assert.equal(img.src,'');
});
const albumPhoto=index=>({...photo,src:`/private-photos/assets/v1/${index.toString(16).padStart(64,'0')}.webp`,srcset:[]});
test('a large album keeps every requested image alive while loads are pending',async()=>{
 const pending=[];
 const f=fixture((url,options)=>new Promise((resolve,reject)=>{
  options.signal.addEventListener('abort',()=>reject(new Error('Cancelled')),{once:true});
  pending.push({resolve,signal:options.signal});
 }));
 const images=Array.from({length:21},(_,i)=>{const img=new Element();f.auth.setImage(img,albumPhoto(i+1));return img;});
 await f.unlock();await settle();
 assert.equal(pending.length,4,'Visible downloads must stay within the four-request budget');
 assert.equal(pending.filter(p=>p.signal.aborted).length,0,'Cache eviction must not cancel images waiting to display');
 for(let i=0;i<21;i++){assert.ok(pending[i]);pending[i].resolve(new Response(new Uint8Array([1]),{headers:{'Content-Type':'image/webp'}}));await settle();}
 await settle();await settle();
 assert.ok(images.every(img=>img.src.startsWith('blob:')),'All 21 photographs must become sharp');
 assert.equal(f.revoked.length,0,'Displayed images must keep their blob URLs');
 f.auth.lock();assert.ok(images.every(img=>img.src===photo.blur));assert.equal(f.revoked.length,21);
});
test('unused photo preloads remain bounded after leaving a large album',async()=>{
 const f=fixture();await f.unlock();
 const images=Array.from({length:21},(_,i)=>{const img=new Element();f.auth.setImage(img,albumPhoto(i+1));return img;});
 await settle();await settle();assert.ok(images.every(img=>img.src.startsWith('blob:')));
 images.forEach(img=>{img.isConnected=false;});
 for(let i=22;i<=125;i++){f.auth.preload(albumPhoto(i),1280);await settle();}
 assert.ok(f.revoked.length>=29,'Only a bounded set of unused images should remain cached');
});

test('cached viewer photos display immediately without a placeholder or another request',async()=>{
 const f=fixture(),img=new Element();await f.unlock();
 f.auth.setImage(img,photo,Infinity);await settle();const original=img.src;
 f.auth.setImage(img,albumPhoto(5));await settle();const count=f.calls.length;
 f.auth.setImage(img,photo,Infinity);
 assert.equal(img.src,original,'Previously viewed photos should appear synchronously');
 assert.equal(f.calls.length,count);await settle();assert.equal(f.calls.length,count);
 f.auth.lock();f.auth.setImage(img,photo,Infinity);assert.equal(img.src,photo.blur);
});
test('a fresh page automatically restores remembered access without opening the unlock prompt',async()=>{
 const f=fixture(undefined,{startup:true});await f.ready;
 assert.equal(f.dialog.open,false);assert.equal(f.navigations.length,1);
 assert.equal(new URL(f.navigations[0]).searchParams.get('action'),'restore');
 await f.returnFrom('photoAuthCode');assert.equal(f.auth.unlocked,true);assert.equal(f.dialog.open,false);
 assert.equal(f.navigations.length,1,'Completing restoration must not redirect again');
});
test('missing remembered access prompts once without a redirect loop',async()=>{
 const f=fixture(undefined,{startup:true});await f.ready;
 await f.returnFrom('photoAuthMissing');assert.equal(f.auth.unlocked,false);assert.equal(f.dialog.open,true);assert.equal(f.navigations.length,1);
});
test('logout and cancelled login do not automatically unlock again',async()=>{
 for(const kind of ['photoAuthLogout','photoAuthCancel']){
  const f=fixture(undefined,{startup:true});await f.ready;
  await f.returnFrom(kind);assert.equal(f.auth.unlocked,false);assert.equal(f.dialog.open,false);assert.equal(f.navigations.length,1);
 }
});

test('reload validates tab access before loading photos and avoids the restoration redirect',async()=>{
 const first=fixture();await first.unlock();const saved=JSON.parse(first.tabStorage.get('atlas-photo-access'));
 assert.ok(saved.expiresAt<=Date.now()/1000+3600);assert.deepEqual(Object.keys(saved).sort(),['expiresAt','token']);
 let authorize;const confirmation=new Promise(resolve=>authorize=resolve);
 const next=fixture((url)=>url.endsWith('/auth/status')?confirmation:Promise.resolve(new Response(new Uint8Array([1]),{headers:{'Content-Type':'image/webp'}})),{startup:true,tabStorage:first.tabStorage});
 const img=new Element();next.auth.setImage(img,photo);await settle();
 assert.equal(next.auth.unlocked,false);assert.equal(img.src,photo.blur);
 authorize(Response.json({unlocked:true,expiresAt:saved.expiresAt}));await next.ready;await settle();
 assert.equal(next.auth.unlocked,true);assert.equal(next.navigations.length,0);assert.equal(next.dialog.open,false);assert.match(img.src,/^blob:/);
 assert.ok(!/lock/i.test(next.header.innerHTML.replace(/<[^>]*>/g,'')));
 next.auth.lock();assert.equal(next.tabStorage.has('atlas-photo-access'),false);assert.equal(next.tabStorage.get('atlas-photo-guest'),'1');
});
test('known guests stay on the atlas on reload and same-tab navigation, with photos still gated',async()=>{
 for(const kind of ['photoAuthMissing','photoAuthLogout','photoAuthCancel']){
  const first=fixture(undefined,{startup:true});await first.ready;await first.returnFrom(kind);
  const next=fixture(undefined,{startup:true,tabStorage:first.tabStorage});await next.ready;
  const img=new Element();next.auth.setImage(img,photo);next.auth.preload(photo,1280);await settle();
  assert.equal(next.navigations.length,0);assert.equal(next.dialog.open,false);assert.equal(next.auth.unlocked,false);
  assert.equal(next.header.querySelector('[data-unlock]').hidden,false);assert.equal(next.calls.length,0);assert.equal(img.src,photo.blur);
  // The guest preference never prevents the visitor from explicitly unlocking.
  next.header.querySelector('[data-unlock]').dispatchEvent(new Event('click'));await waitForNavigation(next);
  assert.equal(new URL(next.navigations[0]).searchParams.get('action'),'login');
  await next.returnFrom('photoAuthCode');assert.equal(next.auth.unlocked,true);assert.equal(next.tabStorage.has('atlas-photo-guest'),false);
 }
});
test('pending tab validation keeps the unlock control and password prompt hidden',async()=>{
 let complete;const expiresAt=Math.floor(Date.now()/1000)+3600;
 const tabStorage=new Map([['atlas-photo-access',JSON.stringify({token:'fixture-token',expiresAt})]]);
 const f=fixture(()=>new Promise(resolve=>complete=resolve),{startup:true,tabStorage});await settle();
 assert.equal(f.header.querySelector('[data-unlock]').hidden,true);assert.equal(f.dialog.open,false);
 complete(Response.json({unlocked:true,expiresAt}));await f.ready;
 assert.equal(f.header.querySelector('[data-unlock]').hidden,true);assert.equal(f.dialog.open,false);assert.equal(f.auth.unlocked,true);
});
test('revoked or invalid cached access cannot display private photos',async()=>{
 for(const expiresAt of [Math.floor(Date.now()/1000)+3600,Math.floor(Date.now()/1000)-1,Math.floor(Date.now()/1000)+30*86400]){
  const tabStorage=new Map([['atlas-photo-access',JSON.stringify({token:'revoked-fixture-token',expiresAt})]]);
  const f=fixture(async()=>Response.json({unlocked:false},{status:401}),{startup:true,tabStorage});const img=new Element();f.auth.setImage(img,photo);
  await f.ready;assert.equal(f.auth.unlocked,false);assert.equal(img.src,photo.blur);assert.equal(f.navigations.length,1);
 }
});


test('browsing more than twelve full-size photos retains earlier images without refetching',async()=>{
 const f=fixture(),img=new Element();await f.unlock();
 for(let i=1;i<=24;i++){f.auth.setImage(img,albumPhoto(i));await settle();img.dispatchEvent(new Event('load'));}
 const count=f.calls.length;f.auth.setImage(img,albumPhoto(1));await settle();
 assert.equal(f.calls.length,count);assert.equal(f.revoked.length,0);
});
test('unused image bytes stay bounded even before the entry-count limit',async()=>{
 const f=fixture(async()=>({status:200,ok:true,headers:new Headers({'Content-Type':'image/webp'}),blob:async()=>({size:10*1024*1024})}));await f.unlock();
 for(let i=1;i<=10;i++){f.auth.preload(albumPhoto(i));await settle();}
 assert.equal(f.revoked.length,4,'64 MiB retains six unused ten-MiB photos');
 assert.equal(f.calls.length,10,'Evicted background bytes must not be fetched in a loop');
 f.auth.setPreloads(Array.from({length:10},(_,i)=>({photo:albumPhoto(i+1),width:Infinity})));
 await settle();assert.equal(f.calls.length,10);
 f.auth.setImage(new Element(),albumPhoto(1),Infinity,{fullOnly:true});await settle();assert.equal(f.calls.length,11,'Visible selection can reload an evicted photo');
});
test('focus, visibility and timer checks share a minute throttle and ignore stale 401s',async()=>{
 let now=Date.now(),resolveStatus;
 class Clock extends Date {static now(){return now;}}
 const f=fixture(()=>new Promise(resolve=>{resolveStatus=resolve;}),{clock:Clock});await f.unlock();
 f.events.get('focus')();f.events.get('visibilitychange')();await settle();assert.equal(f.calls.length,0);
 now+=60001;const check=f.events.get('focus')();f.events.get('visibilitychange')();f.events.get('focus')();await settle();assert.equal(f.calls.length,1);
 await f.unlock();resolveStatus(Response.json({unlocked:false},{status:401}));await check;assert.equal(f.auth.unlocked,true,'An old check cannot relock new access');
 now+=60001;const current=f.events.get('focus')();await settle();resolveStatus(Response.json({unlocked:false},{status:401}));await current;assert.equal(f.auth.unlocked,false);
});


test('a selected photo bypasses a backlog of preloads using reserved download capacity',async()=>{
 const f=fixture((_url,options)=>new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new Error('Cancelled')))));
 await f.unlock();for(let i=1;i<=10;i++)f.auth.preload(albumPhoto(i));await settle();assert.equal(f.calls.length,1);
 const img=new Element();f.auth.setImage(img,albumPhoto(11));await settle();assert.equal(f.calls.length,2);
 assert.ok(f.calls[1][0].endsWith(albumPhoto(11).src));assert.equal(f.calls[1][1].priority,'high');f.auth.lock();await settle();
});
test('a cached small image stays visible while the full-size download is pending or fails',async()=>{
 let fail;const f=fixture(url=>url.endsWith(photo.src)?new Promise(resolve=>fail=resolve):Promise.resolve(new Response(new Uint8Array([1]),{headers:{'Content-Type':'image/webp'}})));
 await f.unlock();f.auth.preload(photo,1280);await settle();const img=new Element();f.auth.setImage(img,photo,Infinity);
 assert.match(img.src,/^blob:/);assert.equal(img.dataset.photoState,'loading');
 img.complete=true;img.naturalWidth=1280;img.currentSrc=img.src;img.dispatchEvent(new Event('load'));
 assert.equal(img.dataset.photoState,'ready');const preview=img.src;await settle();
 fail(new Response('',{status:404}));await settle();assert.equal(img.src,preview);assert.equal(img.dataset.photoState,'ready');assert.equal(img.dataset.photoError,undefined);
});
test('a stalled photo times out, retries once, and offers a recoverable error',async()=>{
 const f=fixture((_url,options)=>new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new Error('Aborted')))));
 await f.unlock();const img=new Element();f.auth.setImage(img,albumPhoto(1));await settle();
 for(let attempt=0;attempt<2;attempt++){const timer=[...f.timers.values()].find(t=>t.delay===15000);assert.ok(timer);timer.fn();await settle();}
 assert.equal(f.calls.length,2);assert.equal(img.dataset.photoState,'error');assert.equal(img.dataset.photoError,'true');
 f.auth.setImage(img,albumPhoto(1));await settle();assert.equal(f.calls.length,3);assert.equal(img.dataset.photoState,'loading');f.auth.lock();await settle();
});
test('timeouts cover a stalled response body as well as response headers',async()=>{
 const f=fixture((_url,options)=>Promise.resolve({status:200,ok:true,headers:new Headers({'Content-Type':'image/webp'}),blob:()=>new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new Error('Aborted body'))))}));
 await f.unlock();const img=new Element();f.auth.setImage(img,albumPhoto(1));await settle();
 for(let attempt=0;attempt<2;attempt++){[...f.timers.values()].find(t=>t.delay===15000).fn();await settle();}
 assert.equal(f.calls.length,2);assert.equal(img.dataset.photoState,'error');
});
test('transient server errors recover automatically; permanent missing photos do not retry',async()=>{
 let requests=0;const f=fixture(async()=>++requests===1?new Response('',{status:503}):new Response(new Uint8Array([1]),{headers:{'Content-Type':'image/webp'}}));await f.unlock();
 const img=new Element();f.auth.setImage(img,albumPhoto(1));await settle();assert.equal(f.calls.length,2);assert.match(img.src,/^blob:/);
 const missing=fixture(async()=>new Response('',{status:404}));await missing.unlock();missing.auth.setImage(new Element(),albumPhoto(1));await settle();assert.equal(missing.calls.length,1);
});
test('changing photos cancels an abandoned request without reporting its failure on the new photo',async()=>{
 let late;const f=fixture(url=>url.endsWith(albumPhoto(1).src)?new Promise(resolve=>late=resolve):Promise.resolve(new Response(new Uint8Array([1]),{headers:{'Content-Type':'image/webp'}})));await f.unlock();
 const img=new Element();img.decode=()=>Promise.resolve();f.auth.setImage(img,albumPhoto(1));await settle();f.auth.setImage(img,albumPhoto(2));await settle();assert.equal(f.calls[0][1].signal.aborted,true);
 late(new Response('',{status:503}));await settle();assert.equal(img.dataset.photoState,'ready');assert.equal(img.dataset.photoError,undefined);assert.match(img.src,/^blob:/);
});

test('reselecting a pending photo cannot bypass expired access',async()=>{
 let now=Date.now();class Clock extends Date{static now(){return now;}}
 const f=fixture((_url,options)=>new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new Error('Cancelled')))),{clock:Clock});
 await f.unlock();const img=new Element();f.auth.setImage(img,albumPhoto(1));await settle();now+=3601000;
 f.auth.setImage(img,albumPhoto(1));await settle();assert.equal(f.auth.unlocked,false);assert.equal(img.dataset.photoState,'locked');assert.equal(f.calls.length,1);assert.equal(f.calls[0][1].signal.aborted,true);
});
test('one-hour expiry automatically restores remembered access once instead of leaving every photo locked',async()=>{
 let now=Date.now();class Clock extends Date{static now(){return now;}}
 const f=fixture(undefined,{clock:Clock});await f.unlock();const img=new Element();f.auth.setImage(img,photo);await settle();
 const expiry=[...f.timers.values()].find(timer=>timer.delay>3500000);assert.ok(expiry);
 now+=3601000;expiry.fn();f.events.get('focus')();f.events.get('visibilitychange')();
 await waitForNavigation(f);
 assert.equal(f.auth.unlocked,false);assert.equal(f.navigations.length,1);
 assert.equal(new URL(f.navigations[0]).searchParams.get('action'),'restore');assert.equal(f.dialog.open,false);
 await f.returnFrom('photoAuthCode');await settle();assert.equal(f.auth.unlocked,true);assert.match(img.src,/^blob:/);
});
test('hidden-tab expiry waits for visibility before restoring and explicit lock cancels restoration',async()=>{
 for(const cancel of [false,true]){
  const f=fixture();await f.unlock();f.document.hidden=true;
  [...f.timers.values()].find(timer=>timer.delay>3500000).fn();await settle();assert.equal(f.navigations.length,0);
  if(cancel)f.auth.lock();f.document.hidden=false;f.events.get('visibilitychange')();
  if(!cancel)await waitForNavigation(f);else await settle();
  assert.equal(f.navigations.length,cancel?0:1);
 }
});

test('a slow but progressing full image passes the old deadline without restarting',async()=>{
 let now=Date.now(),stream;
 class Clock extends Date{static now(){return now;}}
 const f=fixture((_url,options)=>Promise.resolve(new Response(new ReadableStream({start(controller){stream=controller;options.signal.addEventListener('abort',()=>controller.error(new Error('Aborted')),{once:true});}}),{headers:{'Content-Type':'image/webp'}})),{clock:Clock});
 await f.unlock();const img=new Element();img.decode=()=>Promise.resolve();f.auth.setImage(img,photo,Infinity,{fullOnly:true});await settle();
 for(let i=0;i<3;i++){
   const oldTimer=[...f.timers].find(([,t])=>t.delay===15000)[0];now+=12000;stream.enqueue(new Uint8Array([1]));await settle();
   assert.equal(f.timers.has(oldTimer),false,'Each chunk resets the idle timeout');assert.equal(f.calls.length,1);assert.equal(f.calls[0][1].signal.aborted,false);
 }
 stream.close();await settle();assert.equal(img.dataset.photoState,'ready');assert.equal(img.dataset.photoDownloadMs,'36000');assert.equal(img.dataset.photoAttempts,'1');
 assert.equal([...f.timers.values()].filter(t=>t.delay===15000||t.delay===120000).length,0);
});
test('an overall transfer cap remains even while the idle deadline is being extended',async()=>{
 let stream;
 const f=fixture((_url,options)=>Promise.resolve(new Response(new ReadableStream({start(controller){stream=controller;options.signal.addEventListener('abort',()=>controller.error(new Error('Aborted')),{once:true});}}),{headers:{'Content-Type':'image/webp'}})));
 await f.unlock();f.auth.setImage(new Element(),photo,Infinity,{fullOnly:true});await settle();
 stream.enqueue(new Uint8Array([1]));await settle();[...f.timers.values()].find(t=>t.delay===120000).fn();await settle();
 assert.equal(f.calls[0][1].signal.aborted,true);assert.equal(f.calls.length,2);f.auth.lock();await settle();
});
test('failed decoded bytes are evicted and Retry bypasses the browser copy',async()=>{
 const f=fixture();await f.unlock();const img=new Element();img.decode=()=>Promise.reject(new Error('Bad image'));
 f.auth.setImage(img,photo,Infinity,{fullOnly:true});await settle();const bad=img.src;img.dispatchEvent(new Event('error'));
 assert.equal(img.dataset.photoState,'error');assert.ok(f.revoked.includes(bad));
 img.decode=()=>Promise.resolve();f.auth.setImage(img,photo,Infinity,{fullOnly:true});await settle();
 assert.equal(f.calls.length,2);assert.equal(f.calls[1][1].cache,'reload');assert.notEqual(img.src,bad);assert.equal(img.dataset.photoState,'ready');
});
test('startup auth headers and JSON bodies time out without navigating away on network failure',async()=>{
 for(const phase of ['headers','body']){
  const tabStorage=new Map([['atlas-photo-access',JSON.stringify({token:'fixture-token',expiresAt:Math.floor(Date.now()/1000)+3600})]]);
  const f=fixture(()=>phase==='headers'?new Promise(()=>{}):Promise.resolve({ok:true,json:()=>new Promise(()=>{})}),{startup:true,tabStorage});
  await settle();const img=new Element();f.auth.setImage(img,photo);[...f.timers.values()].find(t=>t.delay===15000).fn();await f.ready;
  assert.equal(f.auth.unlocked,false);assert.equal(f.navigations.length,0);assert.equal(f.dialog.open,true);assert.equal(f.calls[0][1].signal.aborted,true);
  assert.ok(f.tabStorage.has('atlas-photo-access'),'A timeout must not delete a potentially valid tab credential');
 }
});
test('timed-out periodic checks release their latch and allow a later check',async()=>{
 let now=Date.now();class Clock extends Date{static now(){return now;}}
 const f=fixture(()=>new Promise(()=>{}),{clock:Clock});await f.unlock();now+=60001;
 const first=f.events.get('focus')();await settle();[...f.timers.values()].find(t=>t.delay===15000).fn();await first;
 assert.equal(f.auth.unlocked,true);now+=60001;const second=f.events.get('focus')();await settle();assert.equal(f.calls.length,2);
 [...f.timers.values()].find(t=>t.delay===15000).fn();await second;
});
test('a rejected restored token prompts instead of entering another automatic redirect loop',async()=>{
 const f=fixture(()=>Promise.resolve(new Response('{}',{status:401})));await f.unlock();
 f.auth.setImage(new Element(),photo,Infinity,{fullOnly:true});await waitForNavigation(f);
 await f.returnFrom('photoAuthCode');await settle();await settle();
 assert.equal(f.navigations.length,1);assert.equal(f.auth.unlocked,false);assert.equal(f.dialog.open,true);
});
test('locking during asynchronous renewal preparation cancels navigation',async()=>{
 const f=fixture();await f.unlock();[...f.timers.values()].find(t=>t.delay>3500000).fn();f.auth.lock();
 for(let i=0;i<10;i++)await settle();assert.equal(f.navigations.length,0);
});
test('preload plans are bounded and transfer only one speculative image at a time',async()=>{
 const pending=[];const f=fixture((_url,options)=>new Promise((resolve,reject)=>{pending.push({resolve,options});options.signal.addEventListener('abort',()=>reject(new Error('Cancelled')));}));await f.unlock();
 f.auth.setPreloads(Array.from({length:100},(_,i)=>({photo:albumPhoto(i+1),width:Infinity})));await settle();assert.equal(pending.length,1);
 for(let i=0;i<80;i++){assert.equal(pending.length,i+1);pending[i].resolve(new Response(new Uint8Array([1]),{headers:{'Content-Type':'image/webp'}}));await settle();}
 assert.equal(pending.length,80);f.auth.setPreloads([]);await settle();assert.equal(pending.length,80);
});
test('visible thumbnails preempt speculative bytes and resume the plan after loading',async()=>{
 const pending=[];const f=fixture((url,options)=>new Promise((resolve,reject)=>{pending.push({url,resolve,options});options.signal.addEventListener('abort',()=>reject(new Error('Cancelled')));}));await f.unlock();
 f.auth.setPreloads([{photo:albumPhoto(1),width:Infinity}]);await settle();const img=new Element();img.dataset.privateSrc=albumPhoto(2).src;
 const visible=f.auth.hydrate(img);await settle();assert.equal(pending[0].options.signal.aborted,true);assert.ok(pending[1].url.endsWith(albumPhoto(2).src));
 pending[1].resolve(new Response(new Uint8Array([1]),{headers:{'Content-Type':'image/webp'}}));await visible;await settle();
 assert.equal(pending.length,3);assert.ok(pending[2].url.endsWith(albumPhoto(1).src));f.auth.lock();await settle();
});
test('selecting an in-flight preload promotes and reuses its request',async()=>{
 const pending=[];const f=fixture((url,options)=>new Promise((resolve,reject)=>{pending.push({url,resolve,options});options.signal.addEventListener('abort',()=>reject(new Error('Cancelled')));}));await f.unlock();
 f.auth.setPreloads([{photo:albumPhoto(1),width:Infinity},{photo:albumPhoto(2),width:Infinity}]);await settle();
 const img=new Element();img.decode=()=>Promise.resolve();f.auth.setImage(img,albumPhoto(1),Infinity,{fullOnly:true});await settle();
 assert.equal(pending.length,1);assert.equal(pending[0].options.signal.aborted,false);
 pending[0].resolve(new Response(new Uint8Array([1]),{headers:{'Content-Type':'image/webp'}}));await settle();
 assert.equal(img.dataset.photoState,'ready');assert.equal(pending.length,2);f.auth.lock();await settle();
});
test('changing plans cancels obsolete preloads; a failed visible photo holds speculation',async()=>{
 const pending=[];const f=fixture((url,options)=>new Promise((resolve,reject)=>{pending.push({url,resolve,options});options.signal.addEventListener('abort',()=>reject(new Error('Cancelled')));}));await f.unlock();
 f.auth.setPreloads([{photo:albumPhoto(1),width:Infinity}]);await settle();f.auth.setPreloads([{photo:albumPhoto(2),width:Infinity}]);await settle();
 assert.equal(pending[0].options.signal.aborted,true);assert.ok(pending[1].url.endsWith(albumPhoto(2).src));
 const img=new Element();f.auth.setImage(img,albumPhoto(3),Infinity,{fullOnly:true});await settle();assert.equal(pending[1].options.signal.aborted,true);
 pending[2].resolve(new Response('',{status:404}));await settle();assert.equal(img.dataset.photoState,'error');assert.equal(pending.length,3);
 f.auth.clearImage(img);f.auth.setPreloads([]);await settle();assert.equal(pending.length,3);
});
test('hidden tabs and data-saving connections suspend speculative work',async()=>{
 const f=fixture((_url,options)=>new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new Error('Cancelled')))));await f.unlock();
 f.window.navigator={connection:{saveData:true,effectiveType:'4g'}};f.auth.setPreloads([{photo:albumPhoto(1),width:Infinity}]);await settle();assert.equal(f.calls.length,0);
 f.window.navigator.connection.saveData=false;f.document.hidden=true;f.auth.setPreloads([{photo:albumPhoto(1),width:Infinity}]);await settle();assert.equal(f.calls.length,0);
 f.document.hidden=false;f.events.get('visibilitychange')();await settle();assert.equal(f.calls.length,1);
 f.document.hidden=true;f.events.get('visibilitychange')();await settle();assert.equal(f.calls[0][1].signal.aborted,true);f.auth.lock();
});

test('a newly relevant photo preempts a later target even when both remain in the plan',async()=>{
 const pending=[];const f=fixture((url,options)=>new Promise((resolve,reject)=>{pending.push({url,resolve,options});options.signal.addEventListener('abort',()=>reject(new Error('Cancelled')));}));await f.unlock();
 const a={photo:albumPhoto(1),width:Infinity},b={photo:albumPhoto(2),width:Infinity};
 f.auth.setPreloads([a,b]);await settle();f.auth.setPreloads([b,a]);await settle();
 assert.equal(pending[0].options.signal.aborted,true);assert.ok(pending[1].url.endsWith(b.photo.src));
 pending[1].resolve(new Response(new Uint8Array([1]),{headers:{'Content-Type':'image/webp'}}));await settle();
 assert.ok(pending[2].url.endsWith(a.photo.src));f.auth.lock();await settle();
});
test('shared variants are deduplicated before the preload bound and cached plans do not refetch',async()=>{
 const f=fixture();await f.unlock();const same={photo:albumPhoto(1),width:480};
 const requests=[...Array(90).fill(same),{photo:albumPhoto(2),width:1280}];
 f.auth.setPreloads(requests);for(let i=0;i<5;i++)await settle();assert.equal(f.calls.length,2);
 f.auth.setPreloads(requests);await settle();assert.equal(f.calls.length,2);
});


test('swipe neighbors use cached full photos without starting or promoting downloads',async()=>{
  const f=fixture();await f.unlock();const neighbor=new Element();
  assert.equal(f.auth.setCachedImage(neighbor,photo),false);assert.equal(f.calls.length,0);
  f.auth.preload(photo,1280);await settle();const count=f.calls.length;
  assert.equal(f.auth.setCachedImage(neighbor,photo),false);assert.equal(f.calls.length,count,'A smaller cached preview is not a full photo');
  f.auth.preload(photo,Infinity);await settle();const loaded=f.calls.length;
  assert.equal(f.auth.setCachedImage(neighbor,photo),true);assert.match(neighbor.src,/^blob:/);assert.equal(f.calls.length,loaded);
  assert.ok(f.calls.every(([,options])=>options.priority==='low'));
  f.auth.lock();assert.equal(f.auth.setCachedImage(neighbor,photo),false);
});

test('a completed private preload notifies a waiting neighbor without promoting work; locking clears its pixels',async()=>{
  let finish;
  const f=fixture(()=>new Promise(resolve=>{finish=resolve;}));await f.unlock();
  const neighbor=new Element();neighbor.decode=()=>Promise.resolve();let notifications=0;
  f.window.addEventListener('atlas-photo-cache-ready',()=>{notifications++;f.auth.setCachedImage(neighbor,photo);});
  f.auth.preload(photo,Infinity);await settle();assert.equal(notifications,0);
  finish(new Response(new Uint8Array([1]),{headers:{'Content-Type':'image/webp'}}));await settle();
  assert.equal(notifications,1);assert.equal(neighbor.dataset.photoState,'ready');assert.match(neighbor.src,/^blob:/);
  assert.equal(f.calls.length,1);assert.equal(f.calls[0][1].priority,'low');
  f.auth.lock();assert.equal(neighbor.src,photo.blur);assert.equal(neighbor.dataset.photoState,'locked');
});

test('a cancelled private preload cannot publish cache readiness after access is locked',async()=>{
  let finish;
  const f=fixture(()=>new Promise(resolve=>{finish=resolve;}));await f.unlock();let notifications=0;
  f.window.addEventListener('atlas-photo-cache-ready',()=>{notifications++;});
  f.auth.preload(photo,Infinity);await settle();f.auth.lock();
  finish(new Response(new Uint8Array([1]),{headers:{'Content-Type':'image/webp'}}));await settle();
  assert.equal(notifications,0);
});

test('private videos obtain only short-lived scoped grants while poster bytes use the existing private cache',async()=>{
 const videoSrc=`/private-videos/assets/v1/${'d'.repeat(64)}.mp4`;
 const f=fixture(url=>url.endsWith('/video-access')?Response.json({grant:'scoped.signature',expiresAt:Math.floor(Date.now()/1000)+500}):new Response(new Uint8Array([1]),{headers:{'Content-Type':'image/webp'}}));
 await assert.rejects(f.auth.videoSource(videoSrc),/Unlock/);assert.equal(f.calls.length,0);
 await f.unlock();const url=await f.auth.videoSource(videoSrc);assert.equal(url,`https://photos.example.com${videoSrc}?grant=scoped.signature`);assert.doesNotMatch(url,/fixture-access-token/);
 const request=f.calls.find(([url])=>url.endsWith('/video-access'));assert.equal(request[1].headers.Authorization,'Bearer fixture-access-token');assert.equal(JSON.parse(request[1].body).src,videoSrc);
 const lease=await f.auth.acquirePoster(photo.src);assert.match(lease.url,/^blob:/);f.auth.lock();assert.ok(f.revoked.includes(lease.url));lease.release();
 await assert.rejects(f.auth.videoSource('https://evil.example/movie.mp4'),/Invalid/);
});
test('a late grant cannot unlock video after locking, and excessive grant lifetimes fail closed',async()=>{
 const videoSrc=`/private-videos/assets/v1/${'d'.repeat(64)}.mp4`;let finish;
 const f=fixture(()=>new Promise(resolve=>{finish=resolve;}));await f.unlock();const pending=f.auth.videoSource(videoSrc);await settle();f.auth.lock();finish(Response.json({grant:'scoped.signature',expiresAt:Math.floor(Date.now()/1000)+500}));await assert.rejects(pending,/access changed/);
 const excessive=fixture(()=>Response.json({grant:'scoped.signature',expiresAt:Math.floor(Date.now()/1000)+1800}));await excessive.unlock();await assert.rejects(excessive.auth.videoSource(videoSrc),/unavailable/);
});


test('fresh shared photo views survive remembered-access and locked login returns without credentials in the URL',async()=>{
 for(const view of ['map','photo'])for(const result of ['photoAuthCode','photoAuthMissing']) {
  const hash=`#day=fixture-day&photo=fixture-photo&view=${view}`;
  const f=fixture(undefined,{startup:true,hash});await f.ready;
  assert.equal(f.navigations.length,1);
  await f.returnFrom(result);
  assert.equal(f.historyUrls.at(-1),`/travels/${hash}`);
  assert.equal(f.auth.unlocked,result==='photoAuthCode');
  assert.ok(!f.historyUrls.at(-1).includes('photoAuthCode'));
  assert.ok(!f.historyUrls.at(-1).includes('fixture-access-token'));
 }
});

const avifPhoto={...photo,fullAvif:{src:`/private-photos/assets/v1/${'d'.repeat(64)}.avif`,width:4032,height:3024,bytes:287}};
const avifBytes=Buffer.from(source.match(/data:image\/avif;base64,([^']+)/)[1],'base64');
const mediaResponse=url=>new Response(url.endsWith('.avif')?avifBytes:new Uint8Array([1,2]),{headers:{'Content-Type':url.endsWith('.avif')?'image/avif':'image/webp'}});

test('supported fullscreen AVIF keeps its MIME and uses one authenticated request while previews stay WebP',async()=>{
 const f=fixture(mediaResponse,{avifSupport:true});await f.unlock();
 assert.equal(f.probes.length,1);assert.match(f.probes[0].source,/^data:image\/avif;base64,/);
 const img=new Element();img.decode=()=>Promise.resolve();
 f.auth.setImage(img,avifPhoto,1280,{fullOnly:true});await settle();
 assert.equal(img.dataset.privateSrc,avifPhoto.fullAvif.src);assert.equal(img.dataset.photoState,'ready');
 assert.equal(f.calls.length,1);assert.equal(f.calls[0][1].headers.Authorization,'Bearer fixture-access-token');
 assert.equal(f.blobs.get(img.src).type,'image/avif');assert.deepEqual(Buffer.from(await f.blobs.get(img.src).arrayBuffer()),avifBytes);
 assert.equal(f.calls[0][1].credentials,'omit');assert.equal(f.calls[0][1].cache,'no-cache');
 const count=f.calls.length;f.auth.setImage(img,avifPhoto,Infinity,{fullOnly:true});await settle();assert.equal(f.calls.length,count);
 assert.ok(f.auth.markup(avifPhoto,{targetWidth:1280}).includes(photo.srcset[0].src));
 const preview=new Element();preview.decode=()=>Promise.resolve();f.auth.setImage(preview,avifPhoto,1280);await settle();
 assert.equal(preview.dataset.privateSrc,photo.srcset[0].src);assert.equal(f.blobs.get(preview.src).type,'image/webp');
 f.auth.lock();assert.equal(img.dataset.photoState,'locked');assert.ok(f.revoked.length>=2);
});

test('unsupported AVIF, older manifests and unpublished alternatives retain full WebP',async()=>{
 for(const [support,value] of [[false,avifPhoto],[true,photo],[true,{...avifPhoto,fullAvif:{...avifPhoto.fullAvif,assetStatus:'local'}}]]){
  const f=fixture(mediaResponse,{avifSupport:support});await f.unlock();const img=new Element();img.decode=()=>Promise.resolve();
  f.auth.setImage(img,value,Infinity,{fullOnly:true});await settle();
  assert.equal(f.calls.length,1);assert.ok(f.calls[0][0].endsWith(photo.src));assert.equal(img.dataset.photoState,'ready');
 }
});

test('a delayed capability probe never blocks or replaces an in-flight or cached full WebP',async()=>{
 let finish;const f=fixture(()=>new Promise(resolve=>{finish=resolve;}),{avifSupport:'pending'});await f.unlock();
 const img=new Element();img.decode=()=>Promise.resolve();f.auth.setImage(img,avifPhoto,Infinity,{fullOnly:true});await settle();
 assert.equal(f.calls.length,1);assert.ok(f.calls[0][0].endsWith(photo.src));
 f.probes[0].finish(true);f.auth.setImage(img,avifPhoto,Infinity,{fullOnly:true});await settle();
 assert.equal(f.calls.length,1);assert.equal(f.calls[0][1].signal.aborted,false);
 finish(mediaResponse(photo.src));await settle();assert.equal(img.dataset.photoState,'ready');
 f.auth.setImage(img,avifPhoto,Infinity,{fullOnly:true});await settle();assert.equal(f.calls.length,1);
 const neighbor=new Element();assert.equal(f.auth.setCachedImage(neighbor,avifPhoto),true);assert.equal(f.calls.length,1);
});

test('missing, unavailable, wrong-MIME and failed AVIF transfers automatically use the full WebP',async()=>{
 for(const failure of ['missing','server','mime','network']){
  const f=fixture(url=>{
   if(!url.endsWith('.avif'))return mediaResponse(url);
   if(failure==='network')throw new Error('Connection interrupted');
   if(failure==='mime')return new Response(avifBytes,{headers:{'Content-Type':'image/webp'}});
   return new Response('',{status:failure==='missing'?404:503});
  },{avifSupport:true});await f.unlock();const img=new Element();img.decode=()=>Promise.resolve();const states=[];
  img.addEventListener('atlas-photo-state',()=>states.push(img.dataset.photoState));
  f.auth.setImage(img,avifPhoto,Infinity,{fullOnly:true});await settle();
  assert.equal(img.dataset.photoState,'ready',failure);assert.equal(img.dataset.privateSrc,photo.src);
  assert.equal(f.blobs.get(img.src).type,'image/webp');assert.equal(states.includes('error'),false);
  assert.equal(f.calls.filter(([url])=>url.endsWith(photo.src)).length,1);
  assert.equal(f.calls.filter(([url])=>url.endsWith(photo.srcset[0].src)).length,0,'Fallback must remain full size');
  assert.equal(f.calls.filter(([url])=>url.endsWith('.avif')).length,['server','network'].includes(failure)?2:1);
  const count=f.calls.length;f.auth.setImage(img,avifPhoto,Infinity,{fullOnly:true});await settle();assert.equal(f.calls.length,count);
 }
});

test('AVIF decode and image-error failures evict corrupt bytes and fall back for every current consumer',async()=>{
 for(const kind of ['decode','error']){
  const f=fixture(mediaResponse,{avifSupport:true});await f.unlock();const images=[new Element(),new Element()];
  for(const img of images){
   img.decode=()=>{
    if(f.blobs.get(img.src)?.type!=='image/avif')return Promise.resolve();
    if(kind==='error'){queueMicrotask(()=>img.dispatchEvent(new Event('error')));return new Promise(()=>{});}
    img.complete=true;img.naturalWidth=0;return Promise.reject(new Error('Invalid AVIF'));
   };
   f.auth.setImage(img,avifPhoto,Infinity,{fullOnly:true});
  }
  await settle();await settle();
  assert.ok(images.every(img=>img.dataset.photoState==='ready'));assert.ok(images.every(img=>img.dataset.privateSrc===photo.src));
  assert.equal(f.calls.length,2,'Consumers share both the AVIF and fallback request');assert.equal(f.revoked.length,1);
  assert.equal(f.blobs.get(images[0].src).type,'image/webp');
 }
});

test('an interrupted AVIF decode can still complete through its normal image load event',async()=>{
 const f=fixture(mediaResponse,{avifSupport:true});await f.unlock();const img=new Element();img.decode=()=>Promise.reject(new Error('Decode interrupted'));
 f.auth.setImage(img,avifPhoto,Infinity,{fullOnly:true});await settle();assert.equal(img.dataset.photoState,'loading');
 img.complete=true;img.naturalWidth=4032;img.currentSrc=img.src;img.dispatchEvent(new Event('load'));
 assert.equal(img.dataset.photoState,'ready');assert.equal(f.calls.length,1);
});

test('AVIF 401 expires access and never tries a WebP fallback or bypasses the locked state',async()=>{
 const f=fixture(()=>new Response('',{status:401}),{avifSupport:true});await f.unlock();const img=new Element();img.decode=()=>Promise.resolve();
 f.auth.setImage(img,avifPhoto,Infinity,{fullOnly:true});await settle();
 assert.equal(f.calls.length,1);assert.ok(f.calls[0][0].endsWith('.avif'));assert.equal(f.auth.unlocked,false);
 assert.equal(img.dataset.photoState,'locked');assert.ok(!img.src.startsWith('blob:'));assert.equal(f.blobs.size,0);await waitForNavigation(f);
});

test('rapid switching and locking ignore late AVIF downloads without launching stale fallbacks',async()=>{
 const pending=[];const f=fixture((url,options)=>new Promise(resolve=>pending.push({url,options,resolve})),{avifSupport:true});await f.unlock();
 const img=new Element();img.decode=()=>Promise.resolve();const next={...albumPhoto(7),fullAvif:{...avifPhoto.fullAvif,src:`/private-photos/assets/v1/${'e'.repeat(64)}.avif`}};
 f.auth.setImage(img,avifPhoto,Infinity,{fullOnly:true});await settle();f.auth.setImage(img,next,Infinity,{fullOnly:true});await settle();
 assert.equal(pending[0].options.signal.aborted,true);pending[0].resolve(new Response('',{status:404}));pending[1].resolve(mediaResponse(next.fullAvif.src));await settle();
 assert.equal(img.dataset.privateSrc,next.fullAvif.src);assert.equal(img.dataset.photoState,'ready');assert.equal(f.calls.length,2);
 f.auth.setImage(img,avifPhoto,Infinity,{fullOnly:true});await settle();f.auth.lock();pending[2].resolve(mediaResponse(avifPhoto.fullAvif.src));await settle();
 assert.equal(img.dataset.photoState,'locked');assert.ok(!img.src.startsWith('blob:'));assert.equal(f.calls.length,3);
});

test('AVIF preloads remain speculative and cached-only neighbors never promote or start work',async()=>{
 const f=fixture(mediaResponse,{avifSupport:true});await f.unlock();const neighbor=new Element();neighbor.decode=()=>Promise.resolve();
 assert.equal(f.auth.setCachedImage(neighbor,avifPhoto),false);assert.equal(f.calls.length,0);
 f.auth.preload(avifPhoto,Infinity);await settle();assert.equal(f.calls.length,1);assert.equal(f.calls[0][1].priority,'low');
 assert.equal(f.auth.setCachedImage(neighbor,avifPhoto),true);await settle();assert.equal(f.blobs.get(neighbor.src).type,'image/avif');assert.equal(f.calls.length,1);
 const img=new Element();img.decode=()=>Promise.resolve();f.auth.setImage(img,avifPhoto,Infinity,{fullOnly:true});await settle();assert.equal(f.calls.length,1);
 f.auth.lock();assert.equal(neighbor.dataset.photoState,'locked');assert.equal(f.auth.setCachedImage(neighbor,avifPhoto),false);
});

test('failed AVIF preloads warm only their full WebP fallback at speculative priority',async()=>{
 const f=fixture(url=>url.endsWith('.avif')?new Response('',{status:404}):mediaResponse(url),{avifSupport:true});await f.unlock();
 f.auth.setPreloads([{photo:avifPhoto,width:Infinity}]);await settle();await settle();
 assert.equal(f.calls.length,2);assert.ok(f.calls[0][0].endsWith(avifPhoto.fullAvif.src));assert.ok(f.calls[1][0].endsWith(photo.src));
 assert.ok(f.calls.every(([,options])=>options.priority==='low'));
 const img=new Element();img.decode=()=>Promise.resolve();f.auth.setImage(img,avifPhoto,Infinity,{fullOnly:true});await settle();
 assert.equal(img.dataset.photoState,'ready');assert.equal(f.calls.length,2);
});

test('a cached-only AVIF decode failure starts no fallback transfer until foreground selection',async()=>{
 const f=fixture(mediaResponse,{avifSupport:true});await f.unlock();f.auth.preload(avifPhoto,Infinity);await settle();
 const neighbor=new Element();neighbor.decode=()=>{neighbor.complete=true;neighbor.naturalWidth=0;return Promise.reject(new Error('Invalid AVIF'));};
 assert.equal(f.auth.setCachedImage(neighbor,avifPhoto),true);await settle();assert.equal(f.calls.length,1);assert.ok(!neighbor.src.startsWith('blob:'));
 await f.auth.hydrate(neighbor);assert.equal(f.calls.length,1,'Lazy hydration cannot promote a cached-only slot');
 const img=new Element();img.decode=()=>Promise.resolve();f.auth.setImage(img,avifPhoto,Infinity,{fullOnly:true});await settle();
 assert.equal(f.calls.length,2);assert.ok(f.calls[1][0].endsWith(photo.src));assert.equal(img.dataset.photoState,'ready');
});

function pendingFixture(options) {
 const pending=[];
 const f=fixture((url,options)=>new Promise((resolve,reject)=>{
  pending.push({url,options,resolve});options.signal.addEventListener('abort',()=>reject(new Error('Cancelled')),{once:true});
 }),options);
 const thumbnail=index=>{const img=new Element();img.decode=()=>Promise.resolve();img.dataset.privateSrc=albumPhoto(index).src;f.auth.hydrate(img);return img;};
 const finish=item=>item.resolve(mediaResponse(item.url));
 return {...f,pending,thumbnail,finish};
}

test('only one explicitly marked full neighbor shares thumbnail capacity; far warmers still wait',async()=>{
 const f=pendingFixture();await f.unlock();for(let i=10;i<14;i++)f.thumbnail(i);
 f.auth.setPreloads([{photo:albumPhoto(1),width:Infinity,immediate:true},{photo:albumPhoto(2),width:Infinity,immediate:true},{photo:albumPhoto(3),width:480}]);await settle();
 assert.equal(f.pending.length,4);assert.ok(f.pending[3].url.endsWith(albumPhoto(1).src));assert.equal(f.pending[3].options.priority,'low');
 f.finish(f.pending[3]);await settle();assert.equal(f.pending.length,4,'Finishing the marked neighbor cannot promote the next warmer');
 for(let i=0;i<3;i++){f.finish(f.pending[i]);await settle();}
 assert.ok(f.pending[4].url.endsWith(albumPhoto(13).src));assert.equal(f.pending.length,5,'Queued visible thumbnail remains ahead of far preloads');
 f.finish(f.pending[4]);await settle();assert.ok(f.pending[5].url.endsWith(albumPhoto(2).src));f.auth.lock();await settle();
});

test('a new selected photo reclaims the neighbor slot while an in-flight selected neighbor is reused',async()=>{
 for(const selected of [1,2]){
  const f=pendingFixture();await f.unlock();for(let i=10;i<13;i++)f.thumbnail(i);
  f.auth.setPreloads([{photo:albumPhoto(1),width:Infinity,immediate:true}]);await settle();
  const neighbor=f.pending[3],image=new Element();image.decode=()=>Promise.resolve();
  f.auth.setImage(image,albumPhoto(selected),Infinity,{fullOnly:true});await settle();
  if(selected===1){assert.equal(f.pending.length,4);assert.equal(neighbor.options.signal.aborted,false,'Selecting that neighbor promotes its existing request');}
  else {assert.equal(neighbor.options.signal.aborted,true);assert.equal(f.pending.length,5);assert.ok(f.pending[4].url.endsWith(albumPhoto(2).src));assert.equal(f.pending[4].options.priority,'high');}
  assert.equal(f.pending.filter(item=>!item.options.signal.aborted).length,4,'The selected photo immediately gets the reserved capacity');
  f.auth.lock();await settle();
 }
});

test('the marked neighbor waits for the actual selected full image readiness, including decode',async()=>{
 const f=pendingFixture();await f.unlock();for(let i=10;i<13;i++)f.thumbnail(i);
 let decoded;const image=new Element();image.decode=()=>new Promise(resolve=>decoded=resolve);
 f.auth.setImage(image,albumPhoto(5),Infinity,{fullOnly:true});f.auth.setPreloads([{photo:albumPhoto(1),width:Infinity,immediate:true}]);await settle();
 assert.equal(f.pending.length,4);f.finish(f.pending[3]);await settle();assert.equal(f.pending.length,4,'Transferred bytes alone do not release neighbor speculation');
 decoded();await settle();assert.equal(f.pending.length,5);assert.ok(f.pending[4].url.endsWith(albumPhoto(1).src));f.auth.lock();await settle();
});

test('marked AVIF failure retains one low-priority full-WebP fallback opportunity',async()=>{
 const f=pendingFixture({avifSupport:true});await f.unlock();for(let i=10;i<13;i++)f.thumbnail(i);
 f.auth.setPreloads([{photo:avifPhoto,width:Infinity,immediate:true}]);await settle();assert.ok(f.pending[3].url.endsWith(avifPhoto.fullAvif.src));
 f.pending[3].resolve(new Response('',{status:404}));await settle();await settle();
 assert.equal(f.pending.length,5);assert.ok(f.pending[4].url.endsWith(photo.src));assert.equal(f.pending[4].options.priority,'low');
 assert.equal(f.pending.filter(item=>!item.options.signal.aborted).length,4);f.auth.lock();await settle();
});

test('marked neighbors retain data-saving, hidden-tab, current-error and stale-plan cancellation guards',async()=>{
 for(const guard of ['saveData','slow-2g','2g','hidden']){
  const f=pendingFixture();await f.unlock();f.window.navigator={connection:{saveData:guard==='saveData',effectiveType:guard}};f.document.hidden=guard==='hidden';
  f.auth.setPreloads([{photo:albumPhoto(1),width:Infinity,immediate:true}]);await settle();assert.equal(f.pending.length,0,guard);
  f.window.navigator.connection={effectiveType:'4g'};f.document.hidden=false;f.events.get('visibilitychange')();await settle();assert.equal(f.pending.length,1);
  f.document.hidden=true;f.events.get('visibilitychange')();await settle();assert.equal(f.pending[0].options.signal.aborted,true);f.auth.lock();await settle();
 }
 const f=pendingFixture();await f.unlock();f.auth.setPreloads([{photo:albumPhoto(1),width:Infinity,immediate:true}]);await settle();
 f.auth.setPreloads([{photo:albumPhoto(2),width:Infinity,immediate:true}]);await settle();assert.equal(f.pending[0].options.signal.aborted,true);assert.ok(f.pending[1].url.endsWith(albumPhoto(2).src));
 const image=new Element();f.auth.setImage(image,albumPhoto(3),Infinity,{fullOnly:true});await settle();assert.equal(f.pending[1].options.signal.aborted,true);
 f.pending[2].resolve(new Response('',{status:404}));await settle();assert.equal(image.dataset.photoState,'error');assert.equal(f.pending.length,3);f.auth.lock();await settle();
});


test('refreshing the same immediate marker retains its request and later refreshes retain the full-WebP fallback',async()=>{
 const f=pendingFixture({avifSupport:true});await f.unlock();for(let i=10;i<13;i++)f.thumbnail(i);
 const plan=()=>[{photo:avifPhoto,width:Infinity,immediate:true},{photo:albumPhoto(4),width:Infinity}];
 f.auth.setPreloads(plan());await settle();const avif=f.pending[3];
 for(let i=0;i<5;i++)f.auth.setPreloads(plan());await settle();
 assert.equal(f.pending.length,4);assert.equal(avif.options.signal.aborted,false);
 avif.resolve(new Response('',{status:404}));await settle();await settle();const fallback=f.pending[4];
 for(let i=0;i<5;i++)f.auth.setPreloads(plan());await settle();
 assert.equal(f.pending.length,5);assert.ok(fallback.url.endsWith(photo.src));assert.equal(fallback.options.signal.aborted,false);
 f.auth.lock();await settle();
});
