import { random, validateToken } from './crypto.mjs';
import eligiblePhotos from './community-index.mjs';
const PREFIX = '/community/';
const idPattern = /^[a-zA-Z0-9_-]{1,180}$/;
const requestIdPattern = /^[a-zA-Z0-9_-]{16,80}$/;
export const UNDO_MS = 5 * 60 * 1000;
export function validName(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 40 || /[\u0000-\u001f\u007f]/.test(value)) throw new Error('Choose a name of 1–40 characters.');
  return value.trim();
}
function validBody(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 1000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) throw new Error('Write a comment of 1–1,000 characters.');
  return value.trim();
}
export async function communityBody(request) {
  if (request.headers.get('Content-Type')?.split(';')[0] !== 'application/json') throw new Error('Send a JSON request.');
  const reader = request.body?.getReader(); if (!reader) throw new Error('A request body is required.');
  let size = 0; const chunks = [];
  while (true) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > 8192) { await reader.cancel(); throw new Error('The request is too large.'); } chunks.push(value); }
  const data = new Uint8Array(size); let offset = 0; for (const c of chunks) { data.set(c, offset); offset += c.length; }
  const value = JSON.parse(new TextDecoder().decode(data));
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Send a JSON object.');
  return value;
}
function cursor(value) {
  if (!value) return [0, ''];
  const parts = value.split('.');
  if (parts.length !== 2 || !/^\d{1,16}$/.test(parts[0]) || !requestIdPattern.test(parts[1])) throw new Error('Invalid page cursor.');
  return [Number(parts[0]), parts[1]];
}
const nextCursor = row => row ? `${row.created_at}.${row.id}` : null;
const view = (row, visitorId) => ({ id: row.id, photoId: row.photo_id, displayName: row.display_name_snapshot, body: row.body, createdAt: row.created_at, editedAt: row.edited_at, own: row.visitor_id === visitorId });
const eligible = (journey, photo) => Object.hasOwn(eligiblePhotos, journey) && eligiblePhotos[journey].includes(photo);
async function adminAllowed(value, secret) {
  if (typeof secret !== 'string' || secret.length < 43 || typeof value !== 'string' || value.length > 256) return false;
  const bytes = new TextEncoder(), key = await crypto.subtle.importKey('raw', bytes.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const candidate = await crypto.subtle.importKey('raw', bytes.encode(value || 'missing'), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  return crypto.subtle.verify('HMAC', candidate, await crypto.subtle.sign('HMAC', key, bytes.encode('community-admin')), bytes.encode('community-admin'));
}
export async function community(request, env, origin, json) {
  const url = new URL(request.url), route = url.pathname.slice(PREFIX.length), admin = route.startsWith('admin/');
  const bearer = (request.headers.get('Authorization') || '').replace(/^Bearer /, '');
  // Admin CLI has no browser Origin. Web callers must still use the allowlist.
  if ((!admin && !origin) || (request.headers.has('Origin') && !origin)) return json(403, { error: 'Not allowed' }, origin);
  let session;
  if (admin) {
    if (!await adminAllowed(bearer, env.COMMUNITY_ADMIN_KEY)) return json(401, { error: 'Administrator access required.' }, origin);
  } else {
    session = await validateToken(bearer, env, origin, 'access');
    if (!session) return json(401, { error: 'Unlock photos to read or leave comments.' }, origin);
    if (!session.visitorId) return json(409, { error: 'Unlock photos again to create your remembered comment identity.', code: 'identity_required' }, origin);
  }
  if (!env.COMMUNITY_DB?.prepare || !env.COMMUNITY_LIMITER?.limit) return json(503, { error: 'Comments are being prepared. Your photos are still available.' }, origin);
  const db = env.COMMUNITY_DB, method = request.method;
  const query = (sql, ...args) => db.prepare(sql).bind(...args);
  const isWrite = !['GET', 'HEAD'].includes(method);
  if (isWrite) {
    const scope = admin ? 'admin' : session.visitorId;
    const limits = await Promise.all([env.COMMUNITY_LIMITER.limit({ key: `visitor:${scope}` }), env.COMMUNITY_LIMITER.limit({ key: `ip:${request.headers.get('CF-Connecting-IP') || 'local'}` })]);
    if (limits.some(result => !result.success)) return json(429, { error: 'Please wait a minute before making more changes.' }, origin, { 'Retry-After': '60' });
  }
  let body;
  try { if (isWrite && method !== 'DELETE') body = await communityBody(request); }
  catch { return json(400, { error: 'Invalid request. Keep comments to 1,000 characters.' }, origin); }
  try {
    if (route === 'profile') {
      if (!['GET', 'PATCH'].includes(method)) return json(405, { error: 'Method not allowed' }, origin);
      if (method === 'PATCH') await query('INSERT INTO community_visitors(id, display_name, updated_at) VALUES(?, ?, ?) ON CONFLICT(id) DO UPDATE SET display_name = excluded.display_name, updated_at = excluded.updated_at', session.visitorId, validName(body.name), Date.now()).run();
      const profile = await query('SELECT display_name FROM community_visitors WHERE id = ?', session.visitorId).first();
      return json(200, { name: profile?.display_name || session.displayName || '', identity: session.visitorId }, origin);
    }
    if (route === 'admin/export' && method === 'GET') {
      const [at, id] = cursor(url.searchParams.get('after'));
      const { results } = await query('SELECT * FROM comments WHERE (created_at, id) > (?, ?) ORDER BY created_at, id LIMIT 101', at, id).all();
      return json(200, { comments: results.slice(0, 100), next: results.length > 100 ? nextCursor(results[99]) : null }, origin);
    }
    const moderation = route.match(/^admin\/comments\/([A-Za-z0-9_-]+)$/);
    if (moderation && method === 'PATCH') {
      if (typeof body.hidden !== 'boolean') return json(400, { error: 'Specify whether to hide the comment.' }, origin);
      const result = await query('UPDATE comments SET hidden_at = ? WHERE id = ?', body.hidden ? Date.now() : null, moderation[1]).run();
      return json(result.meta.changes ? 200 : 404, { changed: Boolean(result.meta.changes) }, origin);
    }
    const target = route.match(/^journeys\/([A-Za-z0-9_-]+)\/photos\/([A-Za-z0-9_-]+)\/comments$/);
    if (target) {
      const [, journey, photo] = target;
      if (!idPattern.test(journey) || !idPattern.test(photo) || !eligible(journey, photo)) return json(404, { error: 'This photo is not available for comments.' }, origin);
      if (method === 'GET') {
        const [at, id] = cursor(url.searchParams.get('after'));
        const { results } = await query('SELECT * FROM comments WHERE journey_id = ? AND photo_id = ? AND deleted_at IS NULL AND hidden_at IS NULL AND (created_at, id) > (?, ?) ORDER BY created_at, id LIMIT 51', journey, photo, at, id).all();
        return json(200, { comments: results.slice(0, 50).map(row => view(row, session.visitorId)), next: results.length > 50 ? nextCursor(results[49]) : null }, origin);
      }
      if (method !== 'POST') return json(405, { error: 'Method not allowed' }, origin);
      const text = validBody(body.body), requestId = body.clientRequestId;
      if (!requestIdPattern.test(requestId || '')) return json(400, { error: 'A valid retry identifier is required.' }, origin);
      const profile = await query('SELECT display_name FROM community_visitors WHERE id = ?', session.visitorId).first();
      const name = validName(profile?.display_name || session.displayName);
      // The unique constraint resolves simultaneous retries; never trust client author/timestamps.
      await query('INSERT INTO comments(id, journey_id, photo_id, visitor_id, display_name_snapshot, body, created_at, client_request_id, request_body) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(visitor_id, client_request_id) DO NOTHING', random(), journey, photo, session.visitorId, name, text, Date.now(), requestId, text).run();
      const row = await query('SELECT * FROM comments WHERE visitor_id = ? AND client_request_id = ?', session.visitorId, requestId).first();
      if (row.journey_id !== journey || row.photo_id !== photo || row.request_body !== text) return json(409, { error: 'This retry belongs to a different comment.' }, origin);
      if (row.deleted_at || row.hidden_at) return json(409, { error: 'This comment was removed.' }, origin);
      return json(200, { comment: view(row, session.visitorId) }, origin);
    }
    const comment = route.match(/^comments\/([A-Za-z0-9_-]+)(\/restore)?$/);
    if (comment) {
      const row = await query('SELECT * FROM comments WHERE id = ? AND visitor_id = ?', comment[1], session.visitorId).first();
      if (!row || !eligible(row.journey_id, row.photo_id) || row.hidden_at) return json(404, { error: 'Comment unavailable.' }, origin);
      if (comment[2] && method === 'POST') {
        if (row.deleted_at && Date.now() - row.deleted_at > UNDO_MS) return json(409, { error: 'The five-minute Undo period has ended.' }, origin);
        await query('UPDATE comments SET deleted_at = NULL WHERE id = ? AND visitor_id = ? AND hidden_at IS NULL AND (deleted_at IS NULL OR deleted_at >= ?)', row.id, session.visitorId, Date.now() - UNDO_MS).run();
      } else if (!comment[2] && method === 'DELETE') {
        await query('UPDATE comments SET deleted_at = COALESCE(deleted_at, ?) WHERE id = ? AND visitor_id = ?', Date.now(), row.id, session.visitorId).run();
        return json(200, { deleted: true, comment: view(row, session.visitorId), undoSeconds: UNDO_MS / 1000 }, origin);
      } else if (!comment[2] && method === 'PATCH' && !row.deleted_at) {
        await query('UPDATE comments SET body = ?, edited_at = ? WHERE id = ? AND visitor_id = ? AND deleted_at IS NULL AND hidden_at IS NULL', validBody(body.body), Date.now(), row.id, session.visitorId).run();
      } else return json(405, { error: 'Method not allowed' }, origin);
      const saved = await query('SELECT * FROM comments WHERE id = ? AND visitor_id = ? AND deleted_at IS NULL AND hidden_at IS NULL', row.id, session.visitorId).first();
      if (!saved) return json(409, { error: 'The comment changed. Refresh and try again.' }, origin);
      return json(200, { comment: view(saved, session.visitorId) }, origin);
    }
    return json(404, { error: 'Not found' }, origin);
  } catch (error) {
    // Only our validation messages are public; SQL/runtime errors stay private.
    if (/^(Choose a name|Write a comment|Invalid page cursor)/.test(error.message || '')) return json(400, { error: error.message }, origin);
    throw error;
  }
}
