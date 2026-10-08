import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../workers/photo-auth/worker.mjs';
import {random,issueToken} from '../workers/photo-auth/crypto.mjs';
import {issueVideoGrant,validVideoGrant,byteRange} from '../workers/photo-auth/video-service.mjs';
const origin='https://atlas.example',host='https://photos.example',src=`/private-videos/assets/v1/${'a'.repeat(64)}.mp4`;
function fixture(){
 const reads=[],data=new Uint8Array([0,1,2,3,4,5,6,7,8,9]);
 const env={ALLOWED_ORIGINS:JSON.stringify([origin]),SESSION_SIGNING_KEY:random(),PHOTO_CREDENTIALS:JSON.stringify({version:2,credentials:[{id:'family',salt:random(),hash:random(),iterations:600000}]}),PHOTOS:{head:async key=>{reads.push(['head',key]);return{size:data.length,httpMetadata:{contentType:'video/mp4'}};},get:async(key,options)=>{reads.push(['get',key,options]);return{body:options?.range?data.slice(options.range.offset,options.range.offset+options.range.length):data};}}};
 const request=(path,options={})=>worker.fetch(new Request(host+path,options),env,{});
 return{env,reads,request};
}
test('native video grant is scoped, short-lived, audience bound and credential/signing-key revocable',async()=>{
 const f=fixture(),now=Math.floor(Date.now()/1000),session={id:'family',aud:origin,exp:now+70};
 const {grant,expiresAt}=await issueVideoGrant(f.env,session,src,now);
 assert.equal(expiresAt,session.exp);assert.ok(await validVideoGrant(grant,f.env,origin,src,now));
 for(const [o,p,t] of [[origin,src,now+70],['https://evil.example',src,now],[origin,src.replace('aaaa','bbbb'),now]])assert.equal(await validVideoGrant(grant,f.env,o,p,t),false);
 assert.equal(await validVideoGrant(grant+'x',f.env,origin,src),false);
 f.env.PHOTO_CREDENTIALS=JSON.stringify({version:2,credentials:[{id:'other',salt:random(),hash:random(),iterations:600000}]});assert.equal(await validVideoGrant(grant,f.env,origin,src),false);
 f.env.SESSION_SIGNING_KEY=random();assert.equal(await validVideoGrant(grant,f.env,origin,src),false);
});
test('grant issuance requires valid photo access; denial never touches R2 and bearer never appears in grants',async()=>{
 const f=fixture(),route='/private-photos/video-access';
 for(const headers of [{Origin:origin},{Origin:'https://evil.example'}])assert.equal((await f.request(route,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({src})})).status,401);
 assert.equal(f.reads.length,0);
 const token=await issueToken(f.env,'family',origin);
 const response=await f.request(route,{method:'POST',headers:{Origin:origin,Authorization:`Bearer ${token.token}`,'Content-Type':'application/json'},body:JSON.stringify({src})});
 assert.equal(response.status,200);const data=await response.json();assert.ok(data.grant);assert.ok(!JSON.stringify(data).includes(token.token));assert.equal(response.headers.get('cache-control'),'no-store');
 const direct=await f.request(src,{headers:{Origin:origin,Authorization:`Bearer ${token.token}`}});assert.equal(direct.status,401);
});
test('streaming handles bounded, suffix, open, clipped and invalid ranges; HEAD never fetches a body',async()=>{
 const f=fixture(),{grant}=await issueVideoGrant(f.env,{id:'family',aud:origin,exp:Math.floor(Date.now()/1000)+3600},src);
 for(const [range,status,expected,contentRange] of [[undefined,200,[0,1,2,3,4,5,6,7,8,9],null],['bytes=2-5',206,[2,3,4,5],'bytes 2-5/10'],['bytes=8-',206,[8,9],'bytes 8-9/10'],['bytes=-3',206,[7,8,9],'bytes 7-9/10'],['bytes=9-999',206,[9],'bytes 9-9/10'],['bytes=10-',416,[],'bytes */10'],['bytes=-0',416,[],'bytes */10'],['bytes=0-1,4-5',416,[],'bytes */10'],['bytes=6-2',416,[],'bytes */10']]){
  const r=await f.request(`${src}?grant=${grant}`,{headers:{Origin:origin,...(range?{Range:range}:{})}});assert.equal(r.status,status,range);assert.deepEqual([...new Uint8Array(await r.arrayBuffer())],expected);assert.equal(r.headers.get('content-range'),contentRange);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.get('referrer-policy'),'no-referrer');
 }
 const count=f.reads.filter(x=>x[0]==='get').length;
 const head=await f.request(`${src}?grant=${grant}`,{method:'HEAD',headers:{Origin:origin,Range:'bytes=2-4'}});assert.equal(head.status,206);assert.equal(await head.text(),'');assert.equal(head.headers.get('content-length'),'3');assert.equal(f.reads.filter(x=>x[0]==='get').length,count);
 assert.deepEqual(f.reads.find(x=>x[2]?.range?.offset===2),['get',`video/v1/${'a'.repeat(64)}.mp4`,{range:{offset:2,length:4}}]);
 const changed=await f.request(`${src}?grant=${grant}`,{headers:{Origin:origin,Range:'bytes=2-4','If-Range':'"other"'}});assert.equal(changed.status,200);
 assert.equal(byteRange('bytes=99999999999999999999-',10),false);
});
test('video preflight is explicit and invalid/expired grants fail before R2; errors disclose no URL or grant',async()=>{
 const f=fixture();const pre=await f.request(src,{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'GET','Access-Control-Request-Headers':'range,if-range'}});assert.equal(pre.status,204);assert.equal(pre.headers.get('access-control-allow-origin'),origin);
 for(const method of ['GET','HEAD'])assert.equal((await f.request(src+'?grant=secret-invalid',{method,headers:{Origin:origin,Range:'bytes=0-1'}})).status,401);
 assert.equal(f.reads.length,0);
 const {grant}=await issueVideoGrant(f.env,{id:'family',aud:origin,exp:Math.floor(Date.now()/1000)+300},src);f.env.PHOTOS.head=()=>{throw new Error('private original filename');};
 const failed=await f.request(`${src}?grant=${grant}`,{headers:{Origin:origin}});assert.equal(failed.status,503);assert.doesNotMatch(await failed.text(),/filename|grant|secret/);
});
