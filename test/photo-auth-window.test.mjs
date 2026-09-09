import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {loginWindow} from '../workers/photo-auth/window.mjs';
async function runWindow(action,status,fetchImpl){
 const html=loginWindow('fixture',[]),nodes=new Map(),redirects=[],calls=[],timers=new Map();let timerId=0;
 const getNode=selector=>{if(!nodes.has(selector))nodes.set(selector,{hidden:['#login','#intro','#retry-session'].includes(selector),textContent:'',focus(){this.focused=true;}});return nodes.get(selector);};
 getNode('main');assert.ok(!html.includes('<main hidden>'));
 const url=new URL('https://photos.example.com/private-photos/auth/window');url.search=new URLSearchParams({origin:'https://gravelcycles.github.io',state:'fixture-state',challenge:'fixture-challenge',returnTo:'https://gravelcycles.github.io/travels/',action});
 const context=vm.createContext({URL,URLSearchParams,AbortController,setTimeout:(fn,delay)=>{timers.set(++timerId,{fn,delay});return timerId;},clearTimeout:id=>timers.delete(id),document:{querySelector:getNode},location:{href:url.href,replace:url=>redirects.push(new URL(url))},fetch:async(url,options)=>{calls.push(url);if(fetchImpl)return fetchImpl(url,options);return Response.json(status===200?{code:'single-use-fixture-code'}:{error:'Enter a photo password.'},{status});}});
 vm.runInContext(html.match(/<script nonce="fixture">([\s\S]*?)<\/script>/)[1],context);await new Promise(resolve=>setImmediate(resolve));
 return {nodes,redirects,calls,timers};
}
test('remembered sessions return automatically without revealing the password form',async()=>{
 const f=await runWindow('restore',200);
 assert.equal(f.nodes.get('#login').hidden,true);assert.equal(f.nodes.get('main')?.hidden??false,false);assert.equal(f.redirects.length,1);
 assert.equal(new URLSearchParams(f.redirects[0].hash.slice(1)).get('photoAuthCode'),'single-use-fixture-code');
 assert.deepEqual(f.calls,['/private-photos/auth/session']);
});
test('automatic restoration with no session returns to the atlas without asking on Cloudflare',async()=>{
 const f=await runWindow('restore',401);
 assert.equal(f.nodes.get('#login').hidden,true);assert.equal(f.nodes.get('main')?.hidden??false,false);assert.equal(f.redirects.length,1);
 assert.equal(new URLSearchParams(f.redirects[0].hash.slice(1)).get('photoAuthMissing'),'1');
});
test('explicit login still offers the password form when the session is absent',async()=>{
 const f=await runWindow('login',401);
 assert.equal(f.nodes.get('main').hidden,false);assert.equal(f.nodes.get('#login').hidden,false);assert.equal(f.nodes.get('#password').focused,true);assert.equal(f.redirects.length,0);
});
test('stalled session headers/body leave restoration controls visible and time out with retry',async()=>{
 for(const phase of ['headers','body']){
  let signal;const f=await runWindow('restore',200,(_url,options)=>{signal=options.signal;return phase==='headers'?new Promise(()=>{}):Promise.resolve({ok:true,json:()=>new Promise(()=>{})});});
  assert.equal(f.nodes.get('main').hidden,false);assert.equal(f.nodes.get('#done').hidden,false);assert.match(f.nodes.get('#message').textContent,/Restoring/);
  [...f.timers.values()][0].fn();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(signal.aborted,true);assert.match(f.nodes.get('#message').textContent,/taking too long/);assert.equal(f.nodes.get('#retry-session').hidden,false);assert.equal(f.redirects.length,0);
 }
});
test('returning to the atlas cancels restoration and ignores a late successful response',async()=>{
 let complete;const f=await runWindow('restore',200,()=>new Promise(resolve=>complete=resolve));
 f.nodes.get('#done').onclick();complete(Response.json({code:'late-code'}));await new Promise(resolve=>setImmediate(resolve));
 assert.equal(f.redirects.length,1);assert.equal(new URLSearchParams(f.redirects[0].hash.slice(1)).get('photoAuthCancel'),'1');
});
