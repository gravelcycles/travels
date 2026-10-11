import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../workers/photo-auth/worker.mjs';
import { createCredential, issueToken, random } from '../workers/photo-auth/crypto.mjs';
import index from '../workers/photo-auth/community-index.mjs';
import { UNDO_MS, SUMMARY_PAGE_SIZE, RECENT_PAGE_SIZE } from '../workers/photo-auth/community.mjs';
const origin = 'https://gravelcycles.github.io';
const credential = await createCredential('test-visitor', 'test-only-private-password');
const journey = Object.keys(index).find(id => index[id].length), photo = index[journey][0];
const target = `/community/journeys/${journey}/photos/${photo}/comments`;
const recentTarget = `/community/journeys/${journey}/comments`, summaryTarget = `${recentTarget}/summary`;
function fixture(t) {
  const db = new DatabaseSync(':memory:'); t.after(() => db.close());
  const migrations = new URL('../workers/photo-auth/migrations/', import.meta.url), queries = [];
  for (const name of fs.readdirSync(migrations).filter(name => name.endsWith('.sql')).sort()) db.exec(fs.readFileSync(new URL(name, migrations), 'utf8'));
  const binding = { prepare(sql) { return { bind(...args) { queries.push({ sql, args }); const statement = db.prepare(sql); return { first: async () => statement.get(...args) || null, all: async () => ({ results: statement.all(...args) }), run: async () => { const info = statement.run(...args); return { meta: { changes: info.changes } }; } }; } }; } };
  const env = { COMMUNITY_DB: binding, COMMUNITY_ADMIN_KEY: random(), COMMUNITY_LIMITER: { limit: async () => ({ success: true }) }, PHOTO_CREDENTIALS: JSON.stringify({ version: 2, credentials: [credential] }), SESSION_SIGNING_KEY: random(), ALLOWED_ORIGINS: JSON.stringify([origin]) };
  const token = (visitorId = random(), options = {}) => issueToken(env, credential.id, origin, 'access', { visitorId, displayName: 'Alex', ...options });
  const request = (url, access, method = 'GET', body, caller = origin) => worker.fetch(new Request(`https://photos.example${url}`, { method, headers: { ...(caller ? { Origin: caller } : {}), Authorization: `Bearer ${access?.token || ''}`, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }), env, {});
  return { db, env, token, request, queries };
}
test('community authentication fails closed for expiry, revoked credential, origin and legacy identity', async t => {
  const f = fixture(t), now = Math.floor(Date.now()/1000);
  const access = await f.token(), expired = await f.token(random(), { now: now - 4000 }), legacy = await issueToken(f.env, credential.id, origin);
  for (const path of [target, recentTarget, summaryTarget]) {
    for (const token of [null, expired]) assert.equal((await f.request(path, token)).status, 401);
    assert.equal((await f.request(path, access, 'GET', undefined, 'https://other.example')).status, 403);
    assert.equal((await f.request(path, access, 'GET', undefined, null)).status, 403);
    assert.equal((await f.request(path, legacy)).status, 409);
  }
  f.env.PHOTO_CREDENTIALS = JSON.stringify({ version: 2, credentials: [{ ...credential, id: 'changed' }] });
  for (const path of [target, recentTarget, summaryTarget]) assert.equal((await f.request(path, access)).status, 401);
  assert.equal(f.queries.length, 0, 'Denied reads never reach D1');
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM comments').get().n, 0);
});
test('real SQL persistence ignores client author, retries safely and owns edit/delete/Undo', async t => {
  const f = fixture(t), first = await f.token(), other = await f.token();
  const input = { body: 'Hello <script>literal text</script>', clientRequestId: random(), visitorId: 'forged', displayName: 'Admin', createdAt: 1 };
  const [a, b] = await Promise.all([f.request(target, first, 'POST', input), f.request(target, first, 'POST', input)]);
  assert.equal(a.status, 200); assert.equal(b.status, 200);
  const { comment } = await a.json(); assert.equal(comment.journeyId, journey); assert.equal(comment.displayName, 'Alex'); assert.equal(comment.own, true); assert.equal(comment.visitorId, undefined); assert.ok(comment.createdAt > 1);
  assert.equal((await b.json()).comment.id, comment.id);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM comments').get().n, 1);
  assert.equal((await f.request(target, first, 'POST', { ...input, body: 'different' })).status, 409);
  assert.equal((await f.request(`/community/comments/${comment.id}`, other, 'DELETE')).status, 404);
  const edit = await f.request(`/community/comments/${comment.id}`, first, 'PATCH', { body: 'Edited' }); assert.equal(edit.status, 200); assert.equal((await edit.json()).comment.body, 'Edited');
  await f.request('/community/profile', first, 'PATCH', { name: 'New name' });
  const rows = (await (await f.request(target, other)).json()).comments; assert.equal(rows[0].displayName, 'Alex'); assert.equal(rows[0].own, false);
  assert.equal((await f.request(`/community/comments/${comment.id}`, first, 'DELETE')).status, 200);
  assert.equal((await (await f.request(target, first)).json()).comments.length, 0);
  assert.equal((await f.request(`/community/comments/${comment.id}/restore`, first, 'POST', {})).status, 200);
  await f.request(`/community/comments/${comment.id}`, first, 'DELETE');
  f.db.prepare('UPDATE comments SET deleted_at = ?').run(Date.now() - UNDO_MS - 1000);
  assert.equal((await f.request(`/community/comments/${comment.id}/restore`, first, 'POST', {})).status, 409);
});
test('pagination is stable, moderation stays separate, removed targets cannot be accessed', async t => {
  const f = fixture(t), access = await f.token();
  for (let i = 0; i < 53; i++) assert.equal((await f.request(target, access, 'POST', { body: `Comment ${i}`, clientRequestId: random() })).status, 200);
  const first = await (await f.request(target, access)).json(), next = await (await f.request(`${target}?after=${first.next}`, access)).json();
  assert.equal(first.comments.length, 50); assert.equal(next.comments.length, 3); assert.equal(new Set([...first.comments, ...next.comments].map(row => row.id)).size, 53);
  assert.equal((await f.request('/community/admin/export', access)).status, 401);
  const admin = { token: f.env.COMMUNITY_ADMIN_KEY }, id = first.comments[0].id;
  assert.equal((await f.request(`/community/admin/comments/${id}`, admin, 'PATCH', { hidden: true }, null)).status, 200);
  assert.equal((await f.request(`/community/comments/${id}/restore`, access, 'POST', {})).status, 404);
  const exported = await f.request('/community/admin/export', admin, 'GET', undefined, null); assert.equal(exported.status, 200); assert.equal((await exported.json()).comments.length, 53);
  assert.equal((await f.request(target.replace(photo, 'missing-photo'), access)).status, 404);
  f.db.prepare('UPDATE comments SET photo_id = ? WHERE id = ?').run('trashed-photo', first.comments[1].id);
  assert.equal((await f.request(`/community/comments/${first.comments[1].id}`, access, 'PATCH', { body: 'Cannot edit removed photo' })).status, 404);
});
test('community validates text/bodies, rate limits writes, and handles missing bindings privately', async t => {
  const f = fixture(t), access = await f.token();
  assert.equal((await f.request(target, access, 'POST', { body: 'x'.repeat(1001), clientRequestId: random() })).status, 400);
  assert.equal((await f.request('/community/profile', access, 'PATCH', { name: 'x'.repeat(41) })).status, 400);
  assert.equal((await f.request(target, access, 'POST', { body: 'x'.repeat(9000), clientRequestId: random() })).status, 400);
  f.env.COMMUNITY_LIMITER.limit = async () => ({ success: false });
  assert.equal((await f.request(target, access, 'POST', { body: 'hello', clientRequestId: random() })).status, 429);
  assert.equal((await f.request(target, access)).status, 200);
  f.env.COMMUNITY_DB = null;
  const missing = await f.request(target, access); assert.equal(missing.status, 503); assert.equal(missing.headers.get('Cache-Control'), 'no-store');
});

test('trip metadata and recent feed paginate by stable indexed cursors and filter eligibility before limits', async t => {
  const f = fixture(t), visitor = random(), access = await f.token(visitor), expected = [];
  const insert = f.db.prepare('INSERT INTO comments(id, journey_id, photo_id, visitor_id, display_name_snapshot, body, created_at, client_request_id, request_body, deleted_at, hidden_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const seed = (id, photoId, createdAt, { journeyId = journey, deletedAt = null, hiddenAt = null } = {}) => insert.run(id, journeyId, photoId, visitor, 'Private name', 'Private text', createdAt, id, 'Original private text', deletedAt, hiddenAt);
  for (let i = 0; i < SUMMARY_PAGE_SIZE + 5; i++) {
    const id = `notification_${String(i).padStart(8, '0')}`, photoId = index[journey][i % 2], createdAt = 1000 + Math.floor(i / 3);
    seed(id, photoId, createdAt); expected.push({ id, photoId, createdAt });
  }
  // Ineligible rows at both ends must neither leak IDs nor consume a page.
  for (let i = 0; i < RECENT_PAGE_SIZE + 5; i++) {
    seed(`removed_old_${String(i).padStart(8, '0')}`, 'removed-photo', 500 + i);
    seed(`removed_new_${String(i).padStart(8, '0')}`, 'removed-photo', 5000 + i);
  }
  seed('hidden_notification_001', photo, 6000, { hiddenAt: 1 });
  seed('deleted_notification_01', photo, 6001, { deletedAt: 1 });
  seed('different_journey_0001', photo, 6002, { journeyId: 'other-journey' });

  const firstResponse = await f.request(summaryTarget, access);
  assert.equal(firstResponse.status, 200); assert.equal(firstResponse.headers.get('Cache-Control'), 'no-store');
  const first = await firstResponse.json(), second = await (await f.request(`${summaryTarget}?after=${first.next}`, access)).json();
  assert.equal(first.comments.length, SUMMARY_PAGE_SIZE); assert.equal(second.comments.length, 5); assert.equal(second.next, null);
  assert.deepEqual([...first.comments, ...second.comments], expected, 'Metadata is exact across both photos, with no body, author or ownership fields');
  assert.equal(f.queries.length, 2, 'A metadata page takes one trip query, independent of the number of photos');

  const recentResponse = await f.request(recentTarget, access);
  assert.equal(recentResponse.status, 200); assert.equal(recentResponse.headers.get('Cache-Control'), 'no-store');
  const recent = await recentResponse.json(), older = await (await f.request(`${recentTarget}?before=${recent.next}`, access)).json();
  const latest = [...expected].reverse();
  assert.deepEqual([...recent.comments, ...older.comments].map(row => row.id), latest.slice(0, RECENT_PAGE_SIZE * 2).map(row => row.id));
  assert.equal(recent.comments.length, RECENT_PAGE_SIZE); assert.equal(older.comments.length, RECENT_PAGE_SIZE);
  assert.equal(recent.comments[0].journeyId, journey); assert.equal(recent.comments[0].own, true);
  assert.deepEqual(Object.keys(recent.comments[0]).sort(), ['id', 'journeyId', 'photoId', 'displayName', 'body', 'createdAt', 'editedAt', 'own'].sort());
  assert.equal(f.queries.length, 4);
  for (const { sql, args } of f.queries) {
    const plan = f.db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...args).map(row => row.detail).join('\n');
    assert.match(plan, /SEARCH comments USING INDEX comments_journey_order/);
    assert.doesNotMatch(plan, /SCAN comments|TEMP B-TREE FOR ORDER BY/);
  }
  const other = await (await f.request(recentTarget, await f.token())).json();
  assert.equal(other.comments[0].own, false);
});

test('trip notifications reflect hide/delete/restore, return empty states, and validate targets and cursors', async t => {
  const f = fixture(t), access = await f.token();
  for (const path of [summaryTarget, recentTarget]) {
    const empty = await f.request(path, access); assert.equal(empty.status, 200); assert.deepEqual(await empty.json(), { comments: [], next: null });
    assert.equal((await f.request(path.replace(journey, 'unpublished-draft'), access)).status, 404);
    assert.equal((await f.request(path.replace(journey, 'alpine-crossing'), access)).status, 404, 'Fictional demos have no live notification target');
    assert.equal((await f.request(path, access, 'POST', {})).status, 405);
  }
  for (const value of ['not-a-cursor', '9007199254740992.abcdefghijklmnop', '1.short', '-1.abcdefghijklmnop']) {
    assert.equal((await f.request(`${summaryTarget}?after=${value}`, access)).status, 400);
    assert.equal((await f.request(`${recentTarget}?before=${value}`, access)).status, 400);
  }
  const { comment } = await (await f.request(target, access, 'POST', { body: 'A real SQL fixture', clientRequestId: random() })).json();
  const counts = async () => Promise.all([summaryTarget, recentTarget].map(async path => (await (await f.request(path, access)).json()).comments.length));
  assert.deepEqual(await counts(), [1, 1]);
  await f.request(`/community/comments/${comment.id}`, access, 'DELETE'); assert.deepEqual(await counts(), [0, 0]);
  await f.request(`/community/comments/${comment.id}/restore`, access, 'POST', {}); assert.deepEqual(await counts(), [1, 1]);
  const admin = { token: f.env.COMMUNITY_ADMIN_KEY };
  await f.request(`/community/admin/comments/${comment.id}`, admin, 'PATCH', { hidden: true }, null); assert.deepEqual(await counts(), [0, 0]);
  await f.request(`/community/admin/comments/${comment.id}`, admin, 'PATCH', { hidden: false }, null); assert.deepEqual(await counts(), [1, 1]);
  f.env.COMMUNITY_DB = null;
  for (const path of [summaryTarget, recentTarget]) {
    const missing = await f.request(path, access); assert.equal(missing.status, 503); assert.equal(missing.headers.get('Cache-Control'), 'no-store');
  }
});
