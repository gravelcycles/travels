import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {loginWindow} from '../workers/photo-auth/window.mjs';
async function runWindow(action,status){
 const html=loginWindow('fixture',[]),nodes=new Map(),redirects=[],calls=[];
 const getNode=selector=>{if(!nodes.has(selector))nodes.set(selector,{hidden:['#login','#intro','#done'].includes(selector),textContent:'',focus(){this.focused=true;}});return nodes.get(selector);};
 const url=new URL('https://photos.example.com/private-photos/auth/window');url.search=new URLSearchParams({origin:'https://gravelcycles.github.io',state:'fixture-state',challenge:'fixture-challenge',returnTo:'https://gravelcycles.github.io/travels/',action});
 const context=vm.createContext({URL,URLSearchParams,document:{querySelector:getNode},location:{href:url.href,replace:url=>redirects.push(new URL(url))},fetch:async(url,options)=>{calls.push(url);return Response.json(status===200?{code:'single-use-fixture-code'}:{error:'Enter a photo password.'},{status});}});
 vm.runInContext(html.match(/<script nonce="fixture">([\s\S]*?)<\/script>/)[1],context);await new Promise(resolve=>setImmediate(resolve));
 return {nodes,redirects,calls};
}
test('remembered sessions return automatically without revealing the password form',async()=>{
 const f=await runWindow('restore',200);
 assert.equal(f.nodes.get('#login').hidden,true);assert.equal(f.redirects.length,1);
 assert.equal(new URLSearchParams(f.redirects[0].hash.slice(1)).get('photoAuthCode'),'single-use-fixture-code');
 assert.deepEqual(f.calls,['/private-photos/auth/session']);
});
test('automatic restoration with no session returns to the atlas without asking on Cloudflare',async()=>{
 const f=await runWindow('restore',401);
 assert.equal(f.nodes.get('#login').hidden,true);assert.equal(f.redirects.length,1);
 assert.equal(new URLSearchParams(f.redirects[0].hash.slice(1)).get('photoAuthMissing'),'1');
});
test('explicit login still offers the password form when the session is absent',async()=>{
 const f=await runWindow('login',401);
 assert.equal(f.nodes.get('#login').hidden,false);assert.equal(f.nodes.get('#password').focused,true);assert.equal(f.redirects.length,0);
});
