import test from 'node:test';
import assert from 'node:assert/strict';
import '../dist/assets/comment-notifications.js';
const { createReadState, summarize, newestFirst } = globalThis.JOURNEY_ATLAS_COMMENT_NOTIFICATIONS;
function fixture() {
  const data = new Map(), listeners = new Set();
  return { data, storage: { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }, events: {
    addEventListener: (_name, listener) => listeners.add(listener), removeEventListener: (_name, listener) => listeners.delete(listener),
    send(event) { for (const listener of listeners) listener(event); }, size: () => listeners.size
  } };
}
test('read metadata persists exact IDs by journey without names, bodies, or visitor identity', () => {
  const f = fixture(), a = createReadState({ storage: f.storage, journeyId: 'trip-a', eventTarget: f.events });
  const b = createReadState({ storage: f.storage, journeyId: 'trip-b', eventTarget: f.events });
  const rows = Array.from({ length: 80 }, (_, i) => ({ id: `comment-${i}`, photoId: i < 70 ? 'photo-a' : 'photo-b', body: 'Private words', displayName: 'Private name', visitorId: 'private-identity' }));
  a.markRead(rows.slice(0, 5));
  const summary = summarize(rows, a);
  assert.equal(summary.total, 80); assert.equal(summary.unread, 75);
  assert.deepEqual(summary.photos['photo-a'], { total: 70, unread: 65 });
  assert.equal(b.isRead('comment-0'), false);
  const saved = JSON.parse([...f.data.values()][0]);
  assert.deepEqual(Object.keys(saved).sort(), ['read', 'version']);
  assert.deepEqual(saved.read, ['comment-0', 'comment-1', 'comment-2', 'comment-3', 'comment-4']);
  const reloaded = createReadState({ storage: f.storage, journeyId: 'trip-a', eventTarget: f.events });
  assert.equal(reloaded.isRead('comment-0'), true);
  assert.equal(summarize([], a).total, 0);
  assert.equal(summarize([rows[0]], a).unread, 0, 'Deleted then restored comments retain read state');
});
test('cross-tab reads merge concurrent IDs, respond to browser clearing, and dispose listeners', () => {
  const f = fixture(), a = createReadState({ storage: f.storage, journeyId: 'trip', eventTarget: f.events });
  const b = createReadState({ storage: f.storage, journeyId: 'trip', eventTarget: f.events });
  let changes = 0; a.subscribe(() => changes++);
  a.markRead(['a']); const key = [...f.data.keys()][0];
  b.markRead(['b']);
  f.events.send({ key, newValue: f.storage.getItem(key), storageArea: f.storage });
  assert.equal(a.isRead('b'), true); assert.equal(b.isRead('a'), true);
  f.storage.setItem(key, JSON.stringify({ version: 1, read: ['c'] }));
  f.events.send({ key, newValue: f.storage.getItem(key) });
  assert.deepEqual(JSON.parse(f.storage.getItem(key)).read, ['a', 'b', 'c']);
  f.events.send({ key: 'atlas-comment-read-v1:another', newValue: null });
  assert.equal(a.isRead('a'), true);
  f.events.send({ key, newValue: '{broken' }); assert.equal(a.isRead('a'), true);
  f.data.delete(key); f.events.send({ key, newValue: null }); assert.equal(a.isRead('a'), false);
  assert.equal(changes, 4);
  a.destroy(); b.destroy(); assert.equal(f.events.size(), 0); assert.equal(a.markRead(['later']), false);
});
test('corrupt or unavailable storage keeps working read state on the current page', () => {
  const f = fixture(); f.storage.setItem('atlas-comment-read-v1:trip', '{broken');
  const a = createReadState({ storage: f.storage, journeyId: 'trip' });
  assert.equal(a.isRead('old'), false); a.markRead([{ id: 'safe', body: 'Never store' }, { id: '../invalid' }]);
  assert.deepEqual(JSON.parse(f.storage.getItem('atlas-comment-read-v1:trip')).read, ['safe']);
  const offline = createReadState({ journeyId: 'trip', storage: { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } } });
  offline.markRead(['one']); assert.equal(offline.isRead('one'), true); assert.equal(offline.persistent(), false);
});
test('summary deduplicates IDs safely and equal timestamps match SQL binary feed ordering', () => {
  const rows = ['a', '_', 'Z', '-', 'A'].map(id => ({ id, photoId: '__proto__', createdAt: 10 }));
  assert.deepEqual([...rows].sort(newestFirst).map(row => row.id), ['a', '_', 'Z', 'A', '-']);
  assert.deepEqual(summarize([...rows, rows[0]], null).photos.__proto__, { total: 5, unread: 5 });
});
