import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import assert from 'node:assert/strict';
import { createCredential, random, base64url } from '../workers/photo-auth/crypto.mjs';
import { derivePasswordProofs } from '../workers/photo-auth/password-kdf.mjs';
const verifier=random(),challenge=base64url(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)));
const credential=await createCredential('runtime-fixture','runtime-fixture-password');
const mf=new Miniflare(convertV4MiniflareOptions({modules:true,scriptPath:'workers/photo-auth/build/photo-worker/entry.js',compatibilityDate:'2026-09-09',bindings:{PHOTO_CREDENTIALS:JSON.stringify({version:2,credentials:[credential]}),SESSION_SIGNING_KEY:random(),ALLOWED_ORIGINS:'["https://gravelcycles.github.io"]'},r2Buckets:['PHOTOS'],durableObjects:{AUTH_CODES:{className:'PhotoAuthCode',useSQLite:true}},ratelimits:{LOGIN_LIMITER:{namespace_id:'19092026',simple:{limit:10,period:60}}}}));
try{
 const proofs=await derivePasswordProofs('runtime-fixture-password',[credential]);
 const started=Date.now();const response=await mf.dispatchFetch('https://photos.example.com/private-photos/auth/login',{method:'POST',headers:{Origin:'https://photos.example.com','Content-Type':'application/json'},body:JSON.stringify({origin:'https://gravelcycles.github.io',proofs,challenge})});
 console.log('Runtime login status:',response.status,'elapsed ms:',Date.now()-started);
 assert.equal(response.status,200);
 const grant=await response.json(), cookie=response.headers.get('set-cookie').split(';')[0];
 const redeem=()=>mf.dispatchFetch('https://photos.example.com/private-photos/auth/redeem',{method:'POST',headers:{Origin:'https://gravelcycles.github.io','Content-Type':'application/json'},body:JSON.stringify({code:grant.code,verifier})});
 const exchange=await redeem();assert.equal(exchange.status,200);const access=await exchange.json();
 assert.equal((await redeem()).status,401,'A code can only be used once');
 const bucket=await mf.getR2Bucket('PHOTOS'),key=`v1/${'a'.repeat(64)}.webp`,bytes=new Uint8Array([82,73,70,70]);
 await bucket.put(key,bytes,{httpMetadata:{contentType:'image/webp'}});
 const asset='https://photos.example.com/private-photos/assets/'+key;
 assert.equal((await mf.dispatchFetch(asset)).status,401);
 const photo=await mf.dispatchFetch(asset,{headers:{Origin:'https://gravelcycles.github.io',Authorization:`Bearer ${access.token}`}});
 assert.equal(photo.status,200);assert.deepEqual(new Uint8Array(await photo.arrayBuffer()),bytes);assert.equal(photo.headers.get('Cache-Control'),'no-store');
 const resumed=await mf.dispatchFetch('https://photos.example.com/private-photos/auth/session',{method:'POST',headers:{Origin:'https://photos.example.com',Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({origin:'https://gravelcycles.github.io',challenge})});
 assert.equal(resumed.status,200);assert.ok((await resumed.json()).code);
 console.log('Runtime PKCE, single-use grant, remembered session, and private R2 checks passed.');
}finally{await mf.dispose();}
