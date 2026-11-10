import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../dist/assets/page-entry.js',import.meta.url),'utf8');
function fixture(){
  const classes=new Set(),timers=new Map(),events=new Map(),styles=[];let id=0,reloads=0;
  const message={},retry={},panel={hidden:true,querySelector:selector=>selector==='p'?message:retry};
  const document={documentElement:{classList:{add:name=>classes.add(name),remove:name=>classes.delete(name)}},head:{append:style=>styles.push(style.textContent)},createElement:()=>({}),querySelector:()=>panel,addEventListener:(name,fn)=>events.set(name,fn)};
  const context={document,window:{},Set,location:{reload(){reloads++;}},setTimeout:(fn,delay)=>{timers.set(++id,{fn,delay});return id;},clearTimeout:id=>timers.delete(id)};
  vm.runInNewContext(source,context);
  return {classes,panel,message,retry,timers,events,styles,entry:context.window.JOURNEY_ATLAS_ENTRY,get reloads(){return reloads;}};
}
test('first paint waits for both the actual view and access in either completion order',()=>{
  for(const order of [['view','access'],['access','view']]){
    const f=fixture();assert.ok(f.classes.has('page-starting'));
    f.entry.ready(order[0]);f.events.get('DOMContentLoaded')();
    assert.ok(f.classes.has('page-starting'));assert.equal(f.panel.hidden,true);
    f.entry.ready(order[1]);assert.ok(!f.classes.has('page-starting'));assert.equal(f.panel.hidden,true);assert.equal(f.timers.size,0);
    assert.match(f.styles[0],/body \*\{visibility:hidden!important\}/);assert.match(f.styles[0],/dialog::backdrop/);
  }
});
test('a slow initial load shows only neutral progress, then the chosen destination',()=>{
  const f=fixture();f.entry.ready('view');[...f.timers.values()].find(t=>t.delay===500).fn();
  assert.equal(f.panel.hidden,false);assert.equal(f.message.textContent,'Opening Journey Atlas…');assert.equal(f.retry.hidden,true);
  assert.ok(f.classes.has('page-starting'));f.entry.ready('access');
  assert.equal(f.panel.hidden,true);assert.ok(!f.classes.has('page-starting'));assert.equal(f.timers.size,0);
});
test('an unavailable page script offers retry without exposing an unfinished view',()=>{
  const f=fixture();f.entry.ready('access');[...f.timers.values()].find(t=>t.delay===20000).fn();
  assert.ok(f.classes.has('page-starting'));assert.equal(f.panel.hidden,false);assert.equal(f.retry.hidden,false);
  assert.match(f.message.textContent,/could not finish/);f.retry.onclick();assert.equal(f.reloads,1);
  f.entry.ready('view');assert.equal(f.panel.hidden,true);assert.ok(!f.classes.has('page-starting'));
});
function restoreFixture({service='https://photos.example.com',hint='1',tab={},hash='#day=d1&view=map',search='',digestFails=false}={}){
  const classes=new Set(),timers=new Map(),events=new Map(),windowEvents=new Map(),replaced=[];let id=0;
  const message={},retry={},panel={hidden:true,querySelector:selector=>selector==='p'?message:retry};
  const session=new Map(Object.entries(tab)),local=new Map(hint===null?[]:[['atlas-photo-remembered',hint]]);
  const storage=map=>({getItem:key=>map.has(key)?map.get(key):null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)});
  const document={currentScript:{dataset:service===null?{}:{photoService:service}},documentElement:{classList:{add:name=>classes.add(name),remove:name=>classes.delete(name)}},head:{append(){}},createElement:()=>({}),querySelector:()=>panel,addEventListener:(name,fn)=>events.set(name,fn)};
  const location={origin:'https://gravelcycles.github.io',pathname:'/travels/trip.html',search,hash,replace:url=>replaced.push(url),reload(){}};
  const subtle=digestFails?{digest:()=>Promise.reject(new Error('unavailable'))}:crypto.subtle;
  const context={document,window:{addEventListener:(name,fn,capture)=>windowEvents.set(name,{fn,capture})},Set,location,localStorage:storage(local),sessionStorage:storage(session),crypto:{subtle,getRandomValues:array=>crypto.getRandomValues(array)},URL,URLSearchParams,TextEncoder,Uint8Array,btoa,Date,String,JSON,Promise,setTimeout:(fn,delay)=>{timers.set(++id,{fn,delay});return id;},clearTimeout:key=>timers.delete(key)};
  vm.runInNewContext(source,context);
  return {classes,panel,message,retry,timers,events,windowEvents,replaced,session,entry:context.window.JOURNEY_ATLAS_ENTRY};
}
test('a browser that unlocked before starts its remembered-access check from the head and replaces the pending page',async()=>{
  const f=restoreFixture();assert.ok(f.entry.restoring,'photo-auth must see that the navigation is already under way');
  assert.equal(await f.entry.restoring,true);assert.equal(f.replaced.length,1);
  const target=new URL(f.replaced[0]),flow=JSON.parse(f.session.get('atlas-photo-login'));
  assert.equal(target.origin+target.pathname,'https://photos.example.com/private-photos/auth/window');
  assert.equal(target.searchParams.get('action'),'restore');assert.equal(target.searchParams.get('origin'),'https://gravelcycles.github.io');
  assert.equal(target.searchParams.get('returnTo'),'https://gravelcycles.github.io/travels/trip.html');assert.equal(target.searchParams.get('state'),flow.state);
  assert.match(target.searchParams.get('challenge'),/^[A-Za-z0-9_-]{43}$/);assert.match(flow.verifier,/^[A-Za-z0-9_-]{43}$/);
  const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(flow.verifier)));
  assert.equal(target.searchParams.get('challenge'),Buffer.from(digest).toString('base64url'),'The challenge must match the stored PKCE verifier');
  assert.equal(flow.hash,'#day=d1&view=map','The shared destination survives the round trip');assert.ok(!f.replaced[0].includes(flow.verifier));
  assert.ok(f.classes.has('page-starting'),'The departing page stays hidden');
});
test('every other visitor stays on the page: never unlocked, guest, existing tab access, auth returns, demos and local previews',async()=>{
  const cases=[{hint:'0'},{hint:null},{service:null},{service:'http://photos.example.com'},{service:'https://photos.example.com/path'},{tab:{'atlas-photo-guest':'1'}},{tab:{'atlas-photo-access':'{"token":"t"}'}},{tab:{'atlas-photo-login':'{"state":"s"}'}},{search:'?photoSource=local'},
    ...['photoAuthCode','photoAuthLogout','photoAuthCancel','photoAuthMissing'].map(key=>({hash:`#state=s&${key}=1`}))];
  for(const options of cases){const f=restoreFixture(options);assert.equal(f.entry.restoring,undefined,JSON.stringify(options));assert.equal(f.replaced.length,0);assert.equal(f.session.has('atlas-photo-login'),Boolean(options.tab?.['atlas-photo-login']));}
  const failed=restoreFixture({digestFails:true});assert.equal(await failed.entry.restoring,false,'photo-auth takes over when the early check cannot start');
  assert.equal(failed.replaced.length,0);assert.equal(failed.session.has('atlas-photo-login'),false);
});
test('a page script that fails to load offers Retry at once; other resource errors and settled pages are ignored',()=>{
  const f=restoreFixture({hint:'0'}),{fn,capture}=f.windowEvents.get('error');assert.equal(capture,true,'Resource errors do not bubble');
  fn({target:{tagName:'IMG'}});assert.equal(f.panel.hidden,true);
  fn({target:{tagName:'SCRIPT'}});assert.equal(f.panel.hidden,false);assert.equal(f.retry.hidden,false);assert.match(f.message.textContent,/could not finish/);
  assert.ok(f.classes.has('page-starting'),'A broken page never exposes unfinished chrome');
  const settled=restoreFixture({hint:'0'});settled.entry.ready('view');settled.entry.ready('access');settled.windowEvents.get('error').fn({target:{tagName:'SCRIPT'}});
  assert.equal(settled.panel.hidden,true);
});
