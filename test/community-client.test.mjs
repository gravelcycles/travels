import test from 'node:test';
import assert from 'node:assert/strict';
import '../dist/assets/community-client.js';
import '../dist/assets/places-comments.js';
test('live adapter retains retry ID after uncertain writes and keeps foreign ownership private', async () => {
  const data = new Map(), calls = []; let fail = true;
  const drafts = globalThis.JOURNEY_ATLAS_PLACES.createDemoStore({ getItem: k => data.get(k), setItem: (k, v) => data.set(k, v) }, 'drafts');
  const store = globalThis.JOURNEY_ATLAS_COMMUNITY.createStore({ drafts, request: async (path, options) => {
    calls.push({ path, options });
    if (path === '/community/profile') return { identity: 'signed-identity', name: 'Alex' };
    if (!options) return { comments: [{ id: 'foreign', photoId: 'photo', own: false, body: 'Hi', createdAt: 1 }], next: null };
    if (fail) { fail = false; throw new Error('lost response'); }
    return { comment: { id: 'saved', photoId: 'photo', own: true, body: options.body.body, createdAt: 2 } };
  } });
  await store.profile(); await store.refresh('journey', 'photo');
  assert.equal(store.comments('photo')[0].visitorId, null);
  await assert.rejects(store.addComment('photo', {}, 'hello', 'ignored', 'journey'));
  const result = await store.addComment('photo', {}, 'hello', 'ignored', 'journey');
  assert.equal(calls.at(-1).options.body.clientRequestId, calls.at(-2).options.body.clientRequestId);
  assert.equal(result.visitorId, 'signed-identity');
  store.identity.lock(); assert.deepEqual(store.comments('photo'), []); assert.equal(store.identity.get(), null);
});

test('late reads cannot overwrite a mutation or repopulate private comments after lock', async () => {
  const data = new Map(), drafts = globalThis.JOURNEY_ATLAS_PLACES.createDemoStore({ getItem: k => data.get(k), setItem: (k, v) => data.set(k, v) }, 'drafts');
  let finish;
  const store = globalThis.JOURNEY_ATLAS_COMMUNITY.createStore({ drafts, request: async (path, options) => {
    if (path === '/community/profile') return { identity: 'signed', name: 'Alex' };
    if (options?.method === 'POST') return { comment: { id: 'new', photoId: 'photo', own: true, body: 'new', createdAt: 2 } };
    return new Promise(resolve => { finish = resolve; });
  } });
  await store.profile();
  const read = store.refresh('journey', 'photo');
  await store.addComment('photo', {}, 'new', '', 'journey');
  finish({ comments: [], next: null }); await read;
  assert.equal(store.comments('photo')[0].id, 'new');
  const second = store.refresh('journey', 'photo'); store.identity.lock();
  finish({ comments: [{ id: 'private', photoId: 'photo', own: false, body: 'private', createdAt: 3 }], next: null }); await second;
  assert.deepEqual(store.comments('photo'), []);
});
