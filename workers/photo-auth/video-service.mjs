import {base64url,unbase64url,credentials,validateToken,random} from './crypto.mjs';
const encoder = new TextEncoder();
export const VIDEO_GRANT_SECONDS = 600;
export const videoPath = /^\/private-videos\/assets\/(v1\/[a-f0-9]{64}\.mp4)$/;
const reply = (status,body,headers,extra={}) => new Response(body == null ? null : JSON.stringify(body),{status,headers:{...headers,'Content-Type':'application/json; charset=utf-8',...extra}});
async function key(env) {
  const bytes = unbase64url(env.SESSION_SIGNING_KEY);
  if (bytes.length !== 32) throw new Error('Invalid signing configuration');
  return crypto.subtle.importKey('raw',bytes,{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
}
export async function issueVideoGrant(env,session,path,now=Math.floor(Date.now()/1000)) {
  const payload = {v:1,kind:'video',id:session.id,aud:session.aud,path,iat:now,exp:Math.min(now+VIDEO_GRANT_SECONDS,session.exp),nonce:random()};
  const body = base64url(encoder.encode(JSON.stringify(payload)));
  return {grant:`${body}.${base64url(await crypto.subtle.sign('HMAC',await key(env),encoder.encode(`atlas-video-v1:${body}`)))}`,expiresAt:payload.exp};
}
export async function validVideoGrant(value,env,origin,path,now=Math.floor(Date.now()/1000)) {
  const active = credentials(env), signing = await key(env);
  try {
    if (typeof value !== 'string' || value.length > 2048) return false;
    const parts = value.split('.');
    if (parts.length !== 2 || !await crypto.subtle.verify('HMAC',signing,unbase64url(parts[1]),encoder.encode(`atlas-video-v1:${parts[0]}`))) return false;
    const p = JSON.parse(new TextDecoder().decode(unbase64url(parts[0])));
    return p.v===1 && p.kind==='video' && p.aud===origin && p.path===path && videoPath.test(p.path) && Number.isInteger(p.exp) && Number.isInteger(p.iat) && p.iat<=now+30 && p.exp>now && p.exp>p.iat && p.exp-p.iat<=VIDEO_GRANT_SECONDS && unbase64url(p.nonce).length===32 && active.some(c=>c.id===p.id);
  } catch { return false; }
}
export function byteRange(value,size) {
  if (!value) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!match || (!match[1]&&!match[2])) return false;
  let start = match[1] ? Number(match[1]) : Math.max(0,size-Number(match[2]));
  let end = match[1] && match[2] ? Math.min(Number(match[2]),size-1) : size-1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || (match[2]&&!Number.isSafeInteger(Number(match[2]))) || (!match[1]&&Number(match[2])===0) || start<0 || start>=size || end<start) return false;
  return {offset:start,length:end-start+1,end};
}
export async function videoRequest(request,env,origin,headers,boundedJson) {
  const url = new URL(request.url), grantRoute = url.pathname==='/private-photos/video-access';
  if (!grantRoute && !url.pathname.startsWith('/private-videos/')) return null;
  if (grantRoute) {
    if (request.method!=='POST') return reply(405,{error:'Method not allowed'},headers,{Allow:'POST'});
    const authorization = request.headers.get('Authorization') || '';
    const session = await validateToken(authorization.startsWith('Bearer ')?authorization.slice(7):'',env,origin||'','access');
    if (!origin || !session) return reply(401,{error:'Videos are locked'},headers);
    let body; try { body = await boundedJson(request); } catch { return reply(400,{error:'Invalid request'},headers); }
    const match = videoPath.exec(body?.src || '');
    if (!match || url.search) return reply(400,{error:'Invalid video'},headers);
    const object = await env.PHOTOS.head(`video/${match[1]}`);
    if (!object || object.httpMetadata?.contentType!=='video/mp4') return reply(404,{error:'Video not found'},headers);
    return reply(200,await issueVideoGrant(env,session,body.src),headers);
  }
  if (!['GET','HEAD'].includes(request.method)) return reply(405,{error:'Method not allowed'},headers,{Allow:'GET, HEAD'});
  // Native playback cannot attach Authorization. Its grant is restricted to one
  // immutable video, one audience and at most ten minutes of the parent session.
  // It is not the photo bearer token and cannot authorize images or other clips.
  if (!origin || !await validVideoGrant(url.searchParams.get('grant'),env,origin,url.pathname)) return reply(401,{error:'Videos are locked'},headers);
  const match = videoPath.exec(url.pathname);
  if (!match || [...url.searchParams.keys()].some(k=>k!=='grant') || url.searchParams.getAll('grant').length!==1) return reply(404,{error:'Video not found'},headers);
  const objectKey=`video/${match[1]}`, object=await env.PHOTOS.head(objectKey);
  if (!object) return reply(404,{error:'Video not found'},headers);
  if (object.httpMetadata?.contentType!=='video/mp4' || !Number.isSafeInteger(object.size) || object.size<=0) throw new Error('Unexpected video object');
  const etag=`"${match[1].slice(3,-4)}"`;
  const base={...headers,'Content-Type':'video/mp4','Accept-Ranges':'bytes','ETag':etag,'Content-Disposition':'inline','Cross-Origin-Resource-Policy':'cross-origin','Access-Control-Expose-Headers':'Accept-Ranges, Content-Range, Content-Length, ETag'};
  // If-Range mismatch deliberately returns the complete representation.
  const range=byteRange(request.headers.get('If-Range')&&request.headers.get('If-Range')!==etag?null:request.headers.get('Range'),object.size);
  if (range===false) return new Response(null,{status:416,headers:{...base,'Content-Range':`bytes */${object.size}`,'Content-Length':'0'}});
  const responseHeaders={...base,'Content-Length':String(range?.length || object.size),...(range?{'Content-Range':`bytes ${range.offset}-${range.end}/${object.size}`}:{})};
  if (request.method==='HEAD') return new Response(null,{status:range?206:200,headers:responseHeaders});
  const result=await env.PHOTOS.get(objectKey,range?{range:{offset:range.offset,length:range.length}}:undefined);
  if (!result) return reply(404,{error:'Video not found'},headers);
  return new Response(result.body,{status:range?206:200,headers:responseHeaders});
}
