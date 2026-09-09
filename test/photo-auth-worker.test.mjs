import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../workers/photo-auth/worker.mjs';
import { cachedPhoto } from '../workers/photo-auth/photo-cache.mjs';
import { createCredential, issueToken, random, validateToken, base64url, hashPasswordProof } from '../workers/photo-auth/crypto.mjs';
import { derivePasswordProofs } from '../workers/photo-auth/password-kdf.mjs';
import { pbkdf2Sync } from 'node:crypto';
const origin = 'https://gravelcycles.github.io', host = 'https://photos.example.com';
const verifier=random(),challenge=base64url(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)));
const key = `v1/${'a'.repeat(64)}.webp`;
const first = await createCredential('family', 'fixture-only-family-password');
const second = await createCredential('friends', 'fixture-only-friends-password');
test('browser derivation matches PBKDF2 and stored verifier cannot be submitted as proof', async () => {
  const [derived]=await derivePasswordProofs('fixture-only-family-password',[first]);
  const reference=pbkdf2Sync('fixture-only-family-password',Buffer.from(first.salt,'base64url'),600000,32,'sha256').toString('base64url');
  assert.equal(derived.proof,reference);assert.notEqual(derived.proof,first.hash);
  assert.equal(await hashPasswordProof(derived.proof,first),first.hash);
  await assert.rejects(derivePasswordProofs('password',[{...first,iterations:1000}]));
});
function fixture() {
  const reads = [], grants = new Map();
  const AUTH_CODES={idFromName:id=>id,get:id=>({fetch:async(url,options)=>{const body=JSON.parse(options.body);if(url.endsWith('/create')){grants.set(id,body);return Response.json({ok:true});}const grant=grants.get(id);if(!grant||grant.exp<=Date.now()/1000||grant.origin!==body.origin||grant.challenge!==body.challenge)return Response.json(null,{status:401});grants.delete(id);return Response.json(grant);}})};
  const env = { AUTH_CODES, PHOTO_CREDENTIALS: JSON.stringify({ version: 2, credentials: [first, second] }), SESSION_SIGNING_KEY: random(), ALLOWED_ORIGINS: JSON.stringify([origin]), LOGIN_LIMITER: { limit: async () => ({ success: true }) }, PHOTOS: { get: async k => { reads.push(k); return { body: new Uint8Array([1,2,3]), size: 3, httpMetadata: { contentType: 'image/webp' } }; }, head: async k => { reads.push(k); return { size: 3, httpMetadata: { contentType: 'image/webp' } }; } } };
  const forwarded = [];
  const ctx = { exports: { PhotoCache: { fetch: async request => { forwarded.push(request); return cachedPhoto(request,env); } } } };
  const request = (route, options = {}) => worker.fetch(new Request(`${host}/private-photos/${route}`, options), env, ctx);
  const post = async (route, body, cookie) => { if(route==='login'&&typeof body.password==='string'&&body.password.length<=512){const {password,...rest}=body;body={...rest,proofs:await derivePasswordProofs(password,[first,second])};} return request(`auth/${route}`, { method: 'POST', headers: { Origin: host, 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify({ origin, challenge, ...body }) }); };
  const redeem=code=>request('auth/redeem',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({code,verifier})});
  return { env, reads, forwarded, ctx, request, post, redeem };
}
test('both passwords unlock, repeat logins differ, and cookies remember only on the first-party service', async () => {
  const f = fixture();
  const tokens = [];
  for (const password of ['fixture-only-family-password', 'fixture-only-friends-password', 'fixture-only-family-password']) {
    const response = await f.post('login', { password }); assert.equal(response.status, 200);
    const cookie = response.headers.get('set-cookie');
    assert.match(cookie, /__Host-travel_photo_session=/); assert.match(cookie, /Secure; HttpOnly; SameSite=Strict; Max-Age=2592000/); assert.ok(!cookie.includes('Domain='));
    const grant = await response.json(); const exchange=await f.redeem(grant.code);assert.equal(exchange.status,200);const body = await exchange.json(); tokens.push(body.token);assert.equal((await f.redeem(grant.code)).status,401);
    const resumed = await f.post('session', {}, cookie.split(';')[0]); assert.equal(resumed.status, 200);
    const get = await f.request(`assets/${key}`, { headers: { Origin: origin, Authorization: `Bearer ${body.token}` } }); assert.equal(get.status, 200); assert.equal((await get.arrayBuffer()).byteLength, 3);
  }
  assert.equal(new Set(tokens).size, 3);
  const denied = await f.post('login', { password: 'incorrect' }); assert.equal(denied.status, 401);
  const logout = await f.post('logout', {}); assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
});
test('anonymous, tampered, expired, wrong-audience and revoked tokens never touch R2, for GET or HEAD', async () => {
  const f = fixture(); const now = Math.floor(Date.now()/1000);
  const good = await issueToken(f.env, first.id, origin);
  const expired = await issueToken(f.env, first.id, origin, 'access', { now: now - 4000 });
  const wrong = await issueToken(f.env, first.id, 'https://other.example');
  const removed = await issueToken(f.env, 'removed', origin);
  const remembered = await issueToken(f.env, first.id, host, 'remember');
  for (const token of ['', `${good.token.slice(0, -5)}abcde`, expired.token, wrong.token, removed.token, remembered.token]) for (const method of ['GET','HEAD']) for (const path of [key, 'v1/unknown.webp', '%252e%252e/secrets']) {
    const response = await f.request(`assets/${path}`, { method, headers: { Origin: origin, Authorization: `Bearer ${token}` } }); assert.equal(response.status, 401); assert.equal(response.headers.get('cache-control'), 'no-store');
  }
  assert.equal(f.reads.length, 0);
  f.env.PHOTO_CREDENTIALS = JSON.stringify({ version: 2, credentials: [second] });
  assert.equal(await validateToken(good.token, f.env, origin), null);
  f.env.SESSION_SIGNING_KEY = random(); assert.equal(await validateToken(good.token, f.env, origin), null);
});
test('preflight allows only explicit origins/headers; cookie endpoints reject cross-site calls', async () => {
  const f = fixture();
  const pre = await f.request(`assets/${key}`, { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method':'GET', 'Access-Control-Request-Headers':'authorization' } });
  assert.equal(pre.status, 204); assert.equal(pre.headers.get('access-control-max-age'), '86400'); assert.equal(pre.headers.get('access-control-allow-origin'), origin); assert.equal(pre.headers.get('access-control-allow-credentials'), null);
  const bad = await f.request(`assets/${key}`, { method: 'OPTIONS', headers: { Origin:'https://evil.example', 'Access-Control-Request-Method':'GET' } }); assert.equal(bad.status, 403); assert.equal(bad.headers.get('access-control-allow-origin'), null);
  const csrf = await f.request('auth/login', { method:'POST', headers: { Origin: origin, 'Content-Type':'application/json' }, body: JSON.stringify({origin,password:'fixture-only-family-password'}) }); assert.equal(csrf.status, 403);
  assert.equal(f.reads.length, 0);
});
test('rate limiting, malformed bodies, broken configuration and storage failures fail closed', async () => {
  const f = fixture(); f.env.LOGIN_LIMITER.limit = async () => ({ success:false }); assert.equal((await f.post('login',{password:'fixture-only-family-password'})).status,429);
  f.env.LOGIN_LIMITER.limit = async () => ({success:true});
  assert.equal((await f.post('login',{password:'x'.repeat(2500)})).status,400);
  const good = await issueToken(f.env, first.id, origin); const headers = { Origin:origin, Authorization:`Bearer ${good.token}` };
  for (const path of ['v1/no.webp', `${key}?token=ignored`, 'v1/%61.webp']) assert.equal((await f.request(`assets/${path}`,{headers})).status,404);
  assert.equal(f.reads.length,0);
  f.env.PHOTOS.get = async()=>null; assert.equal((await f.request(`assets/${key}`,{headers})).status,404);
  f.env.PHOTOS.get = async()=>{throw new Error('private internal detail');}; const failure = await f.request(`assets/${key}`,{headers}); assert.equal(failure.status,503); assert.ok(!(await failure.text()).includes('private internal'));
  f.env.PHOTO_CREDENTIALS='{}'; assert.equal((await f.request(`assets/${key}`,{headers})).status,503);
});
test('auth window validates return origin/state and blocks framing; valid HEAD stays private', async () => {
  const f=fixture();
  assert.equal((await f.request(`auth/window?origin=https://evil.example&state=${random()}`)).status,400);
  const page=await f.request(`auth/window?origin=${encodeURIComponent(origin)}&state=${random()}&challenge=${challenge}&returnTo=${encodeURIComponent(origin+'/travels/')}`);
  assert.equal(page.status,200);assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'none'/);const html=await page.text();assert.match(html,/location.replace/);assert.ok(html.includes(first.salt));assert.ok(!html.includes(first.hash));assert.ok(!html.includes(second.hash));
  const restore=await f.request(`auth/window?origin=${encodeURIComponent(origin)}&state=${random()}&challenge=${challenge}&returnTo=${encodeURIComponent(origin+'/travels/')}&action=restore`);
  assert.equal(restore.status,200);
  const token=await issueToken(f.env,first.id,origin);
  const head=await f.request(`assets/${key}`,{method:'HEAD',headers:{Origin:origin,Authorization:`Bearer ${token.token}`}});
  assert.equal(head.status,200);assert.equal((await head.arrayBuffer()).byteLength,0);assert.equal(head.headers.get('cache-control'),'private, no-cache');
});
test('remembered access lasts 30 days and rotation invalidates access, cookies, and pending codes', async () => {
  const f=fixture(), now=Math.floor(Date.now()/1000);
  const saved=await issueToken(f.env,first.id,host,'remember',{now});
  assert.ok(await validateToken(saved.token,f.env,host,'remember',now+29*86400));
  assert.equal(await validateToken(saved.token,f.env,host,'remember',now+30*86400),null);
  const access=await issueToken(f.env,first.id,origin);
  const grant=await (await f.post('session',{},`__Host-travel_photo_session=${saved.token}`)).json();
  f.env.SESSION_SIGNING_KEY=random();
  assert.equal(await validateToken(access.token,f.env,origin),null);
  assert.equal(await validateToken(saved.token,f.env,host,'remember'),null);
  assert.equal((await f.redeem(grant.code)).status,401);
});
test('login codes reject wrong verifiers and origins without consuming the rightful login', async () => {
  const f=fixture(),saved=await issueToken(f.env,first.id,host,'remember');
  const grant=await (await f.post('session',{},`__Host-travel_photo_session=${saved.token}`)).json();
  for(const [caller,proof,status] of [[origin,random(),401],['https://evil.example',verifier,403]]){
    const result=await f.request('auth/redeem',{method:'POST',headers:{Origin:caller,'Content-Type':'application/json'},body:JSON.stringify({code:grant.code,verifier:proof})});
    assert.equal(result.status,status);
  }
  assert.equal((await f.redeem(grant.code)).status,200);
});

test('server verification never derives passwords and rejects leaked stored verifiers',async t=>{
 const f=fixture(),proofs=await derivePasswordProofs('fixture-only-family-password',[first,second]);
 t.mock.method(crypto.subtle,'deriveBits',()=>{throw new Error('KDF must only run in the browser');});
 assert.equal((await f.post('login',{proofs})).status,200);
 assert.equal((await f.post('login',{proofs:[{id:first.id,proof:first.hash},{id:second.id,proof:second.hash}]})).status,401);
 assert.equal((await f.post('login',{proofs:[proofs[0],proofs[0]]})).status,401);
 assert.equal((await f.request('auth/login',{method:'POST',headers:{Origin:host,'Content-Type':'application/json'},body:JSON.stringify({origin,challenge,password:'fixture-only-family-password'})})).status,401);
});

test('internal cache hits remain behind auth; credentials and browser bypass headers never enter the cache', async () => {
  const f=fixture(), token=await issueToken(f.env,first.id,origin);
  let stored, calls=0;
  f.ctx.exports.PhotoCache.fetch=async request=>{
    calls++;
    assert.deepEqual([...request.headers],[]);
    if(!stored)stored=await cachedPhoto(request,f.env);
    const response=stored.clone();response.headers.set('Cf-Cache-Status',calls===1?'MISS':'HIT');return response;
  };
  const headers={Origin:origin,Authorization:`Bearer ${token.token}`,Cookie:'ignored=value','Cache-Control':'no-cache',Range:'bytes=0-1'};
  for(const expected of ['MISS','HIT']) {
    const response=await f.request(`assets/${key}`,{headers});
    assert.equal(response.status,200);assert.equal(response.headers.get('X-Photo-Cache'),expected);
    assert.equal(response.headers.get('Cache-Control'),'private, no-cache');
    assert.equal(response.headers.get('Access-Control-Allow-Origin'),origin);
    assert.equal(response.headers.get('Set-Cookie'),null);
    assert.equal((await response.arrayBuffer()).byteLength,3);
  }
  assert.equal(f.reads.length,1);
  assert.equal((await f.request(`assets/${key}`,{headers:{Origin:origin}})).status,401);
  assert.equal((await f.request(`assets/${key}`,{headers:{...headers,Origin:'https://evil.example'}})).status,401);
  f.env.PHOTO_CREDENTIALS=JSON.stringify({version:2,credentials:[second]});
  assert.equal((await f.request(`assets/${key}`,{headers})).status,401);
  assert.equal(calls,2,'revoked and anonymous requests must not consult a warm cache');
});

test('only immutable successful photo bytes are cacheable internally', async () => {
  const f=fixture(),request=new Request(`${host}/private-photos/assets/${key}`);
  const good=await cachedPhoto(request,f.env);
  assert.equal(good.headers.get('Cache-Control'),'public, max-age=31536000, immutable');
  f.env.PHOTOS.get=async()=>null;
  for(const url of [request.url,request.url+'?extra=1',`${host}/private-photos/auth/status`]) {
    const response=await cachedPhoto(new Request(url),f.env);
    assert.equal(response.status,404);assert.equal(response.headers.get('Cache-Control'),'no-store');
  }
});

test('browser revalidation reuses bytes only after successful authorization and existence checks', async () => {
  const f=fixture(), token=await issueToken(f.env,first.id,origin);
  const headers={Origin:origin,Authorization:`Bearer ${token.token}`};
  const initial=await f.request(`assets/${key}`,{headers}),etag=initial.headers.get('ETag');
  assert.equal(initial.status,200);assert.equal(etag,`"${'a'.repeat(64)}"`);
  assert.equal(initial.headers.get('Cache-Control'),'private, no-cache');
  for(const tag of [etag,`W/${etag}`,`"different", ${etag}`]) {
    const response=await f.request(`assets/${key}`,{headers:{...headers,'If-None-Match':tag}});
    assert.equal(response.status,304);assert.equal((await response.arrayBuffer()).byteLength,0);
    assert.equal(response.headers.get('X-Photo-Revalidated'),'1');assert.equal(response.headers.get('ETag'),etag);
    assert.equal(response.headers.get('Content-Length'),null);
    assert.equal(f.forwarded.at(-1).method,'HEAD');
  }
  const changed=await f.request(`assets/${key}`,{headers:{...headers,'If-None-Match':'"different"'}});
  assert.equal(changed.status,200);assert.equal(changed.headers.get('X-Photo-Revalidated'),'0');
  const reads=f.reads.length;
  for(const authorization of ['',`Bearer ${(await issueToken(f.env,first.id,origin,'access',{now:Math.floor(Date.now()/1000)-4000})).token}`]) {
    const denied=await f.request(`assets/${key}`,{headers:{...headers,Authorization:authorization,'If-None-Match':etag}});
    assert.equal(denied.status,401);assert.equal(denied.headers.get('Cache-Control'),'no-store');
  }
  assert.equal(f.reads.length,reads,'invalid access must not reach the cache despite a matching ETag');
  f.env.PHOTOS.head=async()=>null;
  assert.equal((await f.request(`assets/${key}`,{headers:{...headers,'If-None-Match':etag}})).status,404);
  f.env.PHOTO_CREDENTIALS=JSON.stringify({version:2,credentials:[second]});
  assert.equal((await f.request(`assets/${key}`,{headers:{...headers,'If-None-Match':etag}})).status,401);
});
