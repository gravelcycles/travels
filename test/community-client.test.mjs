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


function cacheFixture() {
  const calls=[],resolves=[];
  const store=globalThis.JOURNEY_ATLAS_COMMUNITY.createStore({drafts:{draft(){}},request:(path,options)=>{
    calls.push({path,options});return new Promise((resolve,reject)=>resolves.push({resolve,reject}));
  }});
  return {store,calls,resolves};
}
test('profile and comment reads coalesce, reuse fresh pages, and retain ownership when comments arrive first',async()=>{
  const f=cacheFixture(),profile=f.store.profile(),alsoProfile=f.store.profile();
  const first=f.store.refresh('trip','photo'),alsoFirst=f.store.refresh('trip','photo');
  assert.equal(f.calls.length,2);
  f.resolves[1].resolve({comments:[{id:'mine',own:true,photoId:'photo',body:'Hello',createdAt:1}],next:null});await first;
  f.resolves[0].resolve({identity:'signed',name:'Alex'});await Promise.all([profile,alsoProfile,alsoFirst]);
  assert.equal(f.store.comments('photo')[0].visitorId,'signed');
  await Promise.all([f.store.profile(),f.store.refresh('trip','photo')]);assert.equal(f.calls.length,2);
  assert.equal(f.store.hasLoaded('photo'),true);assert.equal(f.store.fresh('photo'),true);
  const forced=f.store.refresh('trip','photo',false,true);assert.equal(f.calls.length,3);
  f.resolves[2].reject(new Error('offline'));await assert.rejects(forced);
  assert.equal(f.store.comments('photo')[0].body,'Hello','Offline refresh retains the authorized in-memory page');
  const retry=f.store.refresh('trip','photo',false,true);f.resolves[3].resolve({comments:[],next:null});await retry;
  assert.deepEqual(f.store.comments('photo'),[]);
});
test('a late profile response cannot restore identity after locking or undo a name change',async()=>{
  const f=cacheFixture(),profile=f.store.profile();f.store.identity.lock();
  f.resolves[0].resolve({identity:'old',name:'Old'});await profile;assert.equal(f.store.identity.get(),null);
  const newer=f.store.profile(),rename=f.store.identity.save('New');
  f.resolves[2].resolve({identity:'signed',name:'New'});await rename;
  f.resolves[1].resolve({identity:'signed',name:'Old'});await newer;
  assert.equal(f.store.identity.get().name,'New');
});
test('pagination deduplicates pending requests and cached reopening preserves loaded later pages',async()=>{
  const f=cacheFixture(),first=f.store.refresh('trip','photo');
  f.resolves[0].resolve({comments:[{id:'a',createdAt:1}],next:'cursor'});await first;
  const more=f.store.refresh('trip','photo',true),same=f.store.refresh('trip','photo',true);
  assert.equal(f.calls.length,2);assert.match(f.calls[1].path,/after=cursor/);
  f.resolves[1].resolve({comments:[{id:'b',createdAt:2}],next:null});await Promise.all([more,same]);
  await f.store.refresh('trip','photo');assert.deepEqual(f.store.comments('photo').map(c=>c.id),['a','b']);
});


test('stale comment pages refresh while profiles remain cached until their longer expiry',async t=>{
  let now=1000;t.mock.method(Date,'now',()=>now);
  const f=cacheFixture(),profile=f.store.profile(),first=f.store.refresh('trip','photo');
  f.resolves[0].resolve({identity:'signed',name:'Alex'});f.resolves[1].resolve({comments:[],next:null});await Promise.all([profile,first]);
  now+=31000;assert.equal(f.store.fresh('photo'),false);await f.store.profile();
  const stale=f.store.refresh('trip','photo');assert.equal(f.calls.length,3);
  f.resolves[2].resolve({comments:[],next:null});await stale;
  now+=300000;const expired=f.store.profile();assert.equal(f.calls.length,4);
  f.resolves[3].resolve({identity:'signed',name:'Alex'});await expired;
});
