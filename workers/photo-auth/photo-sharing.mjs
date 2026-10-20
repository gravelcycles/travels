import index from './photo-share-index.mjs';
import { base64url, unbase64url, random, validateToken } from './crypto.mjs';

const encoder = new TextEncoder();
const route = /^\/share\/([a-z0-9]+(?:-[a-z0-9]+)*)\/([a-z0-9]+(?:-[a-z0-9]+)*)\/([A-Za-z0-9_-]{43})(\/thumbnail\.webp)?$/;
const privateKey = /^v1\/[a-f0-9]{64}\.webp$/;
const escape = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const scriptValue = value => JSON.stringify(value).replaceAll('<', '\\u003c');
const baseHeaders = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow, noarchive' };
const reply = (status, value, origin, extra = {}) => new Response(JSON.stringify(value), { status, headers: { ...baseHeaders, 'Content-Type': 'application/json; charset=utf-8', ...(origin ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}), ...extra } });

async function signingKey(env) {
  const bytes = unbase64url(env.SESSION_SIGNING_KEY);
  if (bytes.length !== 32) throw new Error('Invalid signing configuration');
  return crypto.subtle.importKey('raw', bytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
function signatureInput(journeyId, photoId, thumbnail) {
  return encoder.encode(`atlas-photo-share-v1:${JSON.stringify([journeyId, photoId, thumbnail.key || thumbnail.url])}`);
}
async function signature(env, journeyId, photoId, thumbnail) {
  return base64url(await crypto.subtle.sign('HMAC', await signingKey(env), signatureInput(journeyId, photoId, thumbnail)));
}
async function validSignature(value, env, journeyId, photoId, thumbnail) {
  const key = await signingKey(env);
  try { return await crypto.subtle.verify('HMAC', key, unbase64url(value), signatureInput(journeyId, photoId, thumbnail)); }
  catch { return false; }
}
function entryFor(source, journeyId, photoId) {
  const journey = Object.hasOwn(source.journeys, journeyId) && source.journeys[journeyId];
  const photo = journey && Object.hasOwn(journey.photos, photoId) && journey.photos[photoId];
  if (!photo) return null;
  const thumb = photo.thumbnail;
  if (thumb?.key) {
    if (!privateKey.test(thumb.key) || !Number.isSafeInteger(thumb.width) || thumb.width < 1 || thumb.width > 480) return null;
  } else {
    let url; try { url = new URL(thumb?.url); } catch { return null; }
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname.startsWith('/private-photos/') || !Number.isSafeInteger(thumb.width) || thumb.width < 1 || thumb.width > 480) return null;
  }
  return { journey, photo };
}
function shareState(values, journey) {
  const view = values.view ?? 'photo', scope = values.scope ?? 'day', group = values.group ?? '';
  if (!['map', 'story', 'photo'].includes(view) || !['day', 'journey'].includes(scope) || typeof group !== 'string' || (group && !journey.groups.includes(group))) return null;
  return { view, scope, group };
}
function stateQuery(url, state) {
  url.searchParams.set('view', state.view);
  if (state.scope === 'journey') url.searchParams.set('scope', 'journey');
  if (state.group) url.searchParams.set('group', state.group);
}
function destination(journey, photoId, photo, state) {
  const url = new URL(journey.page);
  if (state.group) url.searchParams.set('group', state.group);
  const hash = new URLSearchParams({ day: photo.dayId, photo: photoId, view: state.view });
  if (state.scope === 'journey') hash.set('scope', 'journey');
  url.hash = hash.toString();
  return url.href;
}
function shareHtml(source, url, journey, photoId, photo, state, nonce) {
  const canonical = destination(journey, photoId, photo, state);
  const image = photo.thumbnail.key ? `${url.origin}${url.pathname}/thumbnail.webp` : photo.thumbnail.url;
  const meta = (name, value, type = 'property') => `<meta ${type}="${name}" content="${escape(value)}">`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(photo.title)} · ${escape(journey.title)}</title>
${meta('og:type', 'website')}${meta('og:site_name', source.siteName)}${meta('og:title', photo.title)}${meta('og:description', journey.title)}${meta('og:url', url.href)}${meta('og:image', image)}
${photo.thumbnail.key ? meta('og:image:type', 'image/webp') : ''}${photo.thumbnail.width ? meta('og:image:width', photo.thumbnail.width) : ''}${photo.thumbnail.height ? meta('og:image:height', photo.thumbnail.height) : ''}${meta('og:image:alt', photo.alt || 'Shared photograph')}
${meta('twitter:card', 'summary_large_image', 'name')}${meta('twitter:title', photo.title, 'name')}${meta('twitter:image', image, 'name')}
<link rel="apple-touch-icon" href="${escape(source.icon)}"><link rel="icon" href="${escape(source.icon)}"><meta name="robots" content="noindex, nofollow, noarchive"><style nonce="${nonce}">:root{background:#ecefeb;color:#153238;font:16px/1.6 system-ui,sans-serif}body{margin:0;min-height:100svh;display:grid;place-items:center}main{padding:32px;text-align:center}a{color:#235c56}[hidden]{display:none!important}</style></head><body><main hidden><p role="status">Opening Journey Atlas…</p><a href="${escape(canonical)}">Open photograph in ${escape(journey.title)}</a></main><noscript><a href="${escape(canonical)}">Open photograph in ${escape(journey.title)}</a></noscript><script nonce="${nonce}">setTimeout(()=>{document.querySelector('main').hidden=false;},1500);location.replace(${scriptValue(canonical)});</script></body></html>`;
  return html;
}

// Public access is a capability for one thumbnail. It cannot authorize the
// ordinary photo endpoint, other photos, private previews, or full derivatives.
export async function photoSharingRequest(request, env, origin, boundedJson, source = index) {
  const url = new URL(request.url), mint = url.pathname === '/private-photos/share';
  if (!mint && !url.pathname.startsWith('/share/')) return null;
  if (mint) {
    if (request.method !== 'POST') return reply(405, { error: 'Method not allowed' }, origin, { Allow: 'POST' });
    if (!origin) return reply(403, { error: 'Not allowed' });
    let body; try { body = await boundedJson(request); } catch { return reply(400, { error: 'Invalid request' }, origin); }
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !['journeyId', 'photoId', 'view', 'scope', 'group'].includes(key)) || typeof body.journeyId !== 'string' || typeof body.photoId !== 'string' || url.search) return reply(400, { error: 'Invalid request' }, origin);
    const entry = entryFor(source, body.journeyId, body.photoId);
    if (!entry) return reply(404, { error: 'Photo unavailable for sharing' }, origin);
    const { journey, photo } = entry, state = shareState(body, journey);
    if (!state) return reply(400, { error: 'Invalid view' }, origin);
    if (photo.thumbnail.key) {
      const header = request.headers.get('Authorization') || '';
      if (!await validateToken(header.startsWith('Bearer ') ? header.slice(7) : '', env, origin, 'access')) return reply(401, { error: 'Photos are locked' }, origin);
    }
    const signed = await signature(env, body.journeyId, body.photoId, photo.thumbnail);
    const shared = new URL(`/share/${body.journeyId}/${body.photoId}/${signed}`, url.origin);
    stateQuery(shared, state);
    return reply(200, { url: shared.href }, origin);
  }
  if (!['GET', 'HEAD'].includes(request.method)) return reply(405, { error: 'Method not allowed' }, null, { Allow: 'GET, HEAD' });
  const match = route.exec(url.pathname), entry = match && entryFor(source, match[1], match[2]);
  if (!entry) return reply(404, { error: 'Shared photograph not found' });
  const { journey, photo } = entry;
  if (!await validSignature(match[3], env, match[1], match[2], photo.thumbnail)) return reply(404, { error: 'Shared photograph not found' });
  if (match[4]) {
    if (url.search || !photo.thumbnail.key) return reply(404, { error: 'Shared photograph not found' });
    const object = request.method === 'HEAD' ? await env.PHOTOS.head(photo.thumbnail.key) : await env.PHOTOS.get(photo.thumbnail.key);
    if (!object) return reply(404, { error: 'Shared photograph not found' });
    if (object.httpMetadata?.contentType !== 'image/webp' || !Number.isSafeInteger(object.size) || object.size <= 0 || object.size > 1024 * 1024) throw new Error('Invalid thumbnail object');
    return new Response(request.method === 'HEAD' ? null : object.body, { headers: { ...baseHeaders, 'Content-Type': 'image/webp', 'Content-Length': String(object.size), 'Content-Disposition': 'inline', 'Cross-Origin-Resource-Policy': 'cross-origin' } });
  }
  const keys = [...url.searchParams.keys()];
  if (keys.some(key => !['view', 'scope', 'group'].includes(key)) || new Set(keys).size !== keys.length) return reply(404, { error: 'Shared photograph not found' });
  const state = shareState(Object.fromEntries(url.searchParams), journey);
  if (!state) return reply(404, { error: 'Shared photograph not found' });
  const nonce = random(), html = shareHtml(source, url, journey, match[2], photo, state, nonce);
  return new Response(request.method === 'HEAD' ? null : html, { headers: { ...baseHeaders, 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; base-uri 'none'; frame-ancestors 'none'`, 'X-Frame-Options': 'DENY' } });
}
