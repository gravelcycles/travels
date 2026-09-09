import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const source=fs.readFileSync(new URL('../dist/assets/photo-auth.js',import.meta.url),'utf8');
const photo={protected:true,src:`/private-photos/assets/v1/${'b'.repeat(64)}.webp`,srcset:[{src:`/private-photos/assets/v1/${'a'.repeat(64)}.webp`,width:1280},{src:`/private-photos/assets/v1/${'b'.repeat(64)}.webp`,width:3200}],blur:'data:image/webp;base64,placeholder',width:3200,height:2400};
class Element extends EventTarget {
 constructor(){super();this.dataset={};this.children=new Map();this.isConnected=true;this.classList={add(){},remove(){}};this.src='';this.open=false;}
 querySelector(s){if(!this.children.has(s))this.children.set(s,new Element());return this.children.get(s);}
 querySelectorAll(){return [];}
 append(){}setAttribute(){}removeAttribute(name){if(name==='srcset')this.srcset='';}focus(){}showModal(){this.open=true;}close(){this.open=false;}
}
function fixture(fetchImpl=async()=>new Response(new Uint8Array([1,2]),{headers:{'Content-Type':'image/webp'}})){
 const elements=[],header=new Element(),events=new Map(),calls=[],revoked=[];let loginFlow;
 const document={body:new Element(),hidden:false,activeElement:new Element(),createElement(){const e=new Element();elements.push(e);return e;},querySelector(){return header;},querySelectorAll(){return [elements[0].querySelector('[data-unlock]'),elements[1].querySelector('[data-unlock]')];},addEventListener(){}};
 const window={JOURNEY_ATLAS_PHOTO_SERVICE:{origin:'https://photos.example.com'},addEventListener(n,fn){events.set(n,fn);},dispatchEvent(){},open(){throw new Error('Login should not require a popup');}};
 const Url=class extends URL{};Url.createObjectURL=()=>`blob:fixture-${calls.length}`;Url.revokeObjectURL=u=>revoked.push(u);
 const location=new URL('https://gravelcycles.github.io/travels/');location.assign=()=>{};
 const storage={getItem:()=>JSON.stringify(loginFlow),removeItem(){},setItem(k,v){loginFlow=JSON.parse(v);}};
 const context=vm.createContext({window,document,location,history:{replaceState(){}},sessionStorage:storage,URL:Url,URLSearchParams,Event,AbortController,TextEncoder,crypto,Uint8Array,btoa,setTimeout:()=>1,clearTimeout(){},setInterval:()=>2,clearInterval(){},fetch:async(...args)=>{if(args[0].endsWith('/auth/redeem'))return Response.json({token:'fixture-access-token',expiresAt:Math.floor(Date.now()/1000)+3600});calls.push(args);return fetchImpl(...args);}});
 vm.runInContext(source.replace('})();','window.__completeReturn=completeReturn;})();'),context);
 async function unlock(spoof=false){loginFlow={state:'fixture-state',verifier:'v'.repeat(43),created:Date.now(),hash:''};location.hash=new URLSearchParams({photoAuthCode:'c'.repeat(43),state:spoof?'wrong-state':'fixture-state'}).toString();await window.__completeReturn();}

 return {auth:window.JOURNEY_ATLAS_AUTH,calls,revoked,unlock};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('all sharp loads/preloads stay gated; markup contains only a placeholder src',async()=>{
 const f=fixture(),img=new Element();f.auth.setImage(img,photo);f.auth.preload(photo,1280);await settle();assert.equal(f.calls.length,0);assert.equal(img.src,photo.blur);
 const html=f.auth.markup(photo);assert.match(html,/src="data:image/);assert.ok(!html.includes(' src="/private-photos/'));assert.ok(!html.includes(' srcset='));
 await f.unlock(true);await settle();assert.equal(f.calls.length,0);assert.equal(f.auth.unlocked,false);
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
test('401 relocks every loaded photo and tokens never use browser storage',async()=>{
 const f=fixture(async()=>new Response('{}',{status:401})),img=new Element();f.auth.setImage(img,photo);await f.unlock();await settle();assert.equal(f.auth.unlocked,false);assert.equal(img.src,photo.blur);assert.ok(!/localStorage|document\.cookie/.test(source));assert.ok(!/setItem\([^;]*token/.test(source));
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
 assert.equal(pending.length,21);
 assert.equal(pending.filter(p=>p.signal.aborted).length,0,'Cache eviction must not cancel images waiting to display');
 for(const p of pending)p.resolve(new Response(new Uint8Array([1]),{headers:{'Content-Type':'image/webp'}}));
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
 for(let i=22;i<=45;i++){f.auth.preload(albumPhoto(i),1280);await settle();}
 assert.ok(f.revoked.length>=33,'Only a bounded set of unused images should remain cached');
});
