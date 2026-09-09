import { credentials, verifyPasswordProofs, issueToken, validateToken, random, REMEMBER_SECONDS } from './crypto.mjs';
import { base64url } from './crypto.mjs';
import { loginWindow } from './window.mjs';
const PREFIX = '/private-photos/';
const COOKIE = '__Host-travel_photo_session';
const assetPattern = /^v1\/[a-f0-9]{64}\.webp$/;
const cookie = (value, age) => `${COOKIE}=${value}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${age}`;
function allowedOrigins(env) {
  const values = JSON.parse(env.ALLOWED_ORIGINS);
  if (!Array.isArray(values) || !values.length || values.some(v => typeof v !== 'string' || new URL(v).origin !== v || (!v.startsWith('https://') && !(env.DEVELOPMENT === 'true' && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(v))))) throw new Error('Invalid origin configuration');
  return values;
}
function headers(origin, extra = {}) {
  return { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Vary': 'Origin', ...(origin ? { 'Access-Control-Allow-Origin': origin } : {}), ...extra };
}
function json(status, body, origin, extra) { return new Response(JSON.stringify(body), { status, headers: headers(origin, { 'Content-Type': 'application/json; charset=utf-8', ...extra }) }); }
async function boundedJson(request) {
  if (request.headers.get('Content-Type')?.split(';')[0] !== 'application/json') throw new Error('Invalid body');
  if (Number(request.headers.get('Content-Length') || 0) > 2048) throw new Error('Invalid body');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Invalid body');
  let length = 0; const chunks = [];
  while (true) { const { done, value } = await reader.read(); if (done) break; length += value.length; if (length > 2048) { await reader.cancel(); throw new Error('Invalid body'); } chunks.push(value); }
  const bytes = new Uint8Array(length); let offset = 0; for (const c of chunks) { bytes.set(c, offset); offset += c.length; }
  return JSON.parse(new TextDecoder().decode(bytes));
}
function bearer(request) { const value = request.headers.get('Authorization') || ''; return value.startsWith('Bearer ') ? value.slice(7) : ''; }
function remembered(request) { const values = (request.headers.get('Cookie') || '').split(';').map(v => v.trim()).filter(v => v.startsWith(`${COOKIE}=`)); return values.length === 1 ? values[0].slice(COOKIE.length + 1) : ''; }
const keyVersion = async env => base64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(env.SESSION_SIGNING_KEY)));
async function grantCode(env, id, origin, challenge, rememberExpires) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(challenge || '')) throw new Error('Invalid login challenge');
  const code = random();
  const response = await env.AUTH_CODES.get(env.AUTH_CODES.idFromName(code)).fetch('https://code/create', { method: 'POST', body: JSON.stringify({ id, origin, challenge, rememberExpires, keyVersion: await keyVersion(env), exp: Math.floor(Date.now()/1000) + 120 }) });
  if (!response.ok) throw new Error('Unable to create login grant');
  return { code };
}
export default {
  async fetch(request, env, ctx) {
    let corsOrigin = null, stage = 'configuration';
    try {
      const url = new URL(request.url), ownOrigin = url.origin, origin = request.headers.get('Origin');
      const allowed = allowedOrigins(env);
      corsOrigin = allowed.includes(origin) ? origin : null;
      if (request.method === 'OPTIONS') {
        const requested = (request.headers.get('Access-Control-Request-Headers') || '').toLowerCase().split(',').map(x => x.trim()).filter(Boolean);
        if (!corsOrigin || !['GET', 'HEAD', 'POST'].includes(request.headers.get('Access-Control-Request-Method')) || requested.some(h => !['authorization', 'content-type'].includes(h)) || !(url.pathname.startsWith(`${PREFIX}assets/`) || url.pathname === `${PREFIX}auth/status` || url.pathname === `${PREFIX}auth/redeem`)) return json(403, { error: 'Not allowed' }, corsOrigin);
        return new Response(null, { status: 204, headers: headers(corsOrigin, { 'Access-Control-Allow-Methods': 'GET, HEAD, POST', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Max-Age': '86400' }) });
      }
      if (url.pathname === `${PREFIX}auth/window` && request.method === 'GET') {
        let target; try { target = new URL(url.searchParams.get('returnTo')); } catch { return json(400, { error: 'Open this page from the atlas.' }, null); }
        if (!allowed.includes(url.searchParams.get('origin')) || target.origin !== url.searchParams.get('origin') || (target.origin === 'https://gravelcycles.github.io' && !target.pathname.startsWith('/travels/')) || !/^[A-Za-z0-9_-]{43}$/.test(url.searchParams.get('state') || '') || !/^[A-Za-z0-9_-]{43}$/.test(url.searchParams.get('challenge') || '') || !['login', 'logout', 'restore'].includes(url.searchParams.get('action') || 'login')) return json(400, { error: 'Open this page from the atlas.' }, null);
        const nonce = random();
        return new Response(loginWindow(nonce, credentials(env).map(({ id, salt, iterations }) => ({ id, salt, iterations }))), { headers: headers(null, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'`, 'X-Frame-Options': 'DENY' }) });
      }
      if (url.pathname === `${PREFIX}auth/redeem`) {
        if (request.method !== 'POST') return json(405, { error: 'Method not allowed' }, corsOrigin);
        if (!corsOrigin) return json(403, { error: 'Not allowed' }, null);
        let body; try { body = await boundedJson(request); } catch { return json(400, { error: 'Invalid request' }, corsOrigin); }
        if (!/^[A-Za-z0-9_-]{43}$/.test(body.code || '') || !/^[A-Za-z0-9_-]{43}$/.test(body.verifier || '')) return json(401, { error: 'Login expired. Please unlock again.' }, corsOrigin);
        const challenge = base64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body.verifier)));
        const response = await env.AUTH_CODES.get(env.AUTH_CODES.idFromName(body.code)).fetch('https://code/redeem', { method: 'POST', body: JSON.stringify({ origin: corsOrigin, challenge }) });
        if (!response.ok) return json(401, { error: 'Login expired. Please unlock again.' }, corsOrigin);
        const grant = await response.json();
        if (!credentials(env).some(c => c.id === grant.id) || grant.keyVersion !== await keyVersion(env) || grant.rememberExpires <= Math.floor(Date.now()/1000)) return json(401, { error: 'Photos are locked' }, corsOrigin);
        return json(200, await issueToken(env, grant.id, corsOrigin, 'access', { expires: grant.rememberExpires }), corsOrigin);
      }
      if ([`${PREFIX}auth/login`, `${PREFIX}auth/session`, `${PREFIX}auth/logout`].includes(url.pathname)) {
        if (request.method !== 'POST') return json(405, { error: 'Method not allowed' }, corsOrigin, { Allow: 'POST' });
        // Cookie endpoints are first-party only, never credentialed cross-site APIs.
        if (origin !== ownOrigin) return json(403, { error: 'Not allowed' }, null);
        stage = 'credential-config';
        const active = credentials(env);stage = 'rate-limit';
        if (!env.LOGIN_LIMITER?.limit) throw new Error('Missing rate limiter');
        if (!(await env.LOGIN_LIMITER.limit({ key: `auth:${request.headers.get('CF-Connecting-IP') || 'local'}` })).success) return json(429, { error: 'Too many attempts. Try again in a minute.' }, null, { 'Retry-After': '60' });
        let body; try { body = await boundedJson(request); } catch { return json(400, { error: 'Invalid request' }, null); }
        if (!allowed.includes(body?.origin)) return json(403, { error: 'Not allowed' }, null);
        if (url.pathname.endsWith('/logout')) return json(200, { loggedOut: true }, null, { 'Set-Cookie': cookie('', 0) });
        if (!/^[A-Za-z0-9_-]{43}$/.test(body.challenge || '')) return json(400, { error: 'Invalid login challenge' }, null);
        if (url.pathname.endsWith('/session')) {
          const saved = await validateToken(remembered(request), env, ownOrigin, 'remember');
          if (!saved) return json(401, { error: 'Enter a photo password.' }, null);
          return json(200, await grantCode(env, saved.id, body.origin, body.challenge, saved.exp), null);
        }
        stage = 'password';
        const accepted = await verifyPasswordProofs(body.proofs, active);
        if (!accepted) return json(401, { error: 'That password did not work. Please try again.' }, null);
        stage = 'signing';
        const remember = await issueToken(env, accepted.id, ownOrigin, 'remember');
        stage = 'authorization-code';
        const access = await grantCode(env, accepted.id, body.origin, body.challenge, remember.expiresAt);
        return json(200, access, null, { 'Set-Cookie': cookie(remember.token, REMEMBER_SECONDS) });
      }
      if (url.pathname === `${PREFIX}auth/status` || url.pathname.startsWith(`${PREFIX}assets/`)) {
        if (!['GET', 'HEAD'].includes(request.method)) return json(405, { error: 'Method not allowed' }, corsOrigin, { Allow: 'GET, HEAD' });
        // Origin is not a substitute for auth. A direct request without it has no usable audience.
        const session = await validateToken(bearer(request), env, corsOrigin || '', 'access');
        if (!session || !corsOrigin) return json(401, { error: 'Photos are locked', unlocked: false }, corsOrigin);
        if (url.pathname.endsWith('/auth/status')) return json(200, { unlocked: true, expiresAt: session.exp }, corsOrigin);
        const key = url.pathname.slice(`${PREFIX}assets/`.length);
        if (!assetPattern.test(key) || url.search) return json(404, { error: 'Photo not found' }, corsOrigin);
        stage = 'photo-cache';
        // A fresh header-free request keeps credentials, Origin, Range and browser
        // no-cache directives out of the internal shared cache key and policy.
        // The default public entrypoint is NEVER cached: auth above runs on hits too.
        const started = performance.now();
        const response = await ctx.exports.PhotoCache.fetch(new Request(url.toString(), { method: request.method }));
        if (response.status === 404) return json(404, { error: 'Photo not found' }, corsOrigin);
        if (!response.ok || response.headers.get('Content-Type') !== 'image/webp') throw new Error('Photo cache unavailable');
        const cacheStatus = response.headers.get('Cf-Cache-Status') || 'UNKNOWN';
        return new Response(request.method === 'HEAD' ? null : response.body, { headers: headers(corsOrigin, {
          'Content-Type': 'image/webp', 'Content-Length': response.headers.get('Content-Length'),
          'Content-Disposition': 'inline', 'Cross-Origin-Resource-Policy': 'cross-origin',
          'X-Photo-Cache': cacheStatus,
          'Server-Timing': `photo;dur=${(performance.now()-started).toFixed(1)}`,
          'Access-Control-Expose-Headers': 'X-Photo-Cache, Server-Timing',
        }) });
      }
      return json(404, { error: 'Not found' }, corsOrigin);
    } catch (error) {
      // Only a fixed operation label and error class, never exception messages,
      // request bodies, cookies, credentials, keys, or token contents.
      const type = /^[A-Za-z]*Error$/.test(error?.name || '') ? error.name : 'Error';
      return json(503, { error: 'Photo service unavailable. Please try again later.' }, corsOrigin, { 'X-Photo-Service-Failure': `${stage}:${type}` });
    }
  }
};
