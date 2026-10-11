import test from 'node:test';
import assert from 'node:assert/strict';
import '../dist/assets/comment-notifications.js';
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

const metadata = (count, offset = 0) => Array.from({ length: count }, (_, i) => ({ id: `comment-${i + offset}`, photoId: `photo-${(i + offset) % 4}`, createdAt: i + offset + 1 }));
test('one paged trip summary provides exact photo totals without loading discussions and commits atomically', async () => {
  const f = cacheFixture(), first = f.store.refreshSummary('trip'), same = f.store.refreshSummary('trip');
  assert.equal(f.calls.length, 1); assert.match(f.calls[0].path, /journeys\/trip\/comments\/summary$/);
  f.resolves[0].resolve({ comments: metadata(500), next: 'cursor' }); await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.calls.length, 2); assert.match(f.calls[1].path, /summary\?after=cursor$/);
  assert.equal(f.store.notificationSummary().loaded, false, 'A partial page never masquerades as a complete count');
  f.resolves[1].resolve({ comments: metadata(104, 500), next: null }); await Promise.all([first, same]);
  let result = f.store.notificationSummary();
  assert.equal(result.loaded, true); assert.equal(result.total, 604); assert.equal(result.unread, 604);
  assert.deepEqual(result.photos['photo-0'], { total: 151, unread: 151 });
  f.store.markRead(metadata(50)); result = f.store.notificationSummary();
  assert.equal(result.unread, 554); assert.deepEqual(result.photos['photo-0'], { total: 151, unread: 138 });
  assert.equal(f.store.comments('photo-0').length, 0);
  await f.store.refreshSummary('trip'); assert.equal(f.calls.length, 2);
  assert.equal(f.calls.some(call => call.path.includes('/photos/')), false, 'No per-photo badge request storm');
  const forced = f.store.refreshSummary('trip', { force: true });
  f.resolves[2].resolve({ comments: metadata(10), next: 'next' }); await new Promise(resolve => setImmediate(resolve));
  f.resolves[3].reject(new Error('offline')); await assert.rejects(forced);
  assert.equal(f.store.notificationSummary().total, 604, 'Failed paging keeps the previous complete snapshot');
});

test('summary and feed TTL refresh independently, deduplicate paging, and preserve SQL newest-first order', async t => {
  let now = 1000; t.mock.method(Date, 'now', () => now);
  const f = cacheFixture(), summary = f.store.refreshSummary('trip'), feed = f.store.refreshRecent('trip'), same = f.store.refreshRecent('trip');
  assert.equal(f.calls.length, 2);
  f.resolves[0].resolve({ comments: [], next: null });
  f.resolves[1].resolve({ comments: ['_', 'a', 'A'].map(id => ({ id, photoId: 'photo', createdAt: 5 })), next: 'older' });
  await Promise.all([summary, feed, same]);
  assert.deepEqual(f.store.recentComments().map(row => row.id), ['a', '_', 'A']);
  const more = f.store.refreshRecent('trip', { more: true }), sameMore = f.store.refreshRecent('trip', { more: true });
  assert.equal(f.calls.length, 3); assert.match(f.calls[2].path, /comments\?before=older$/);
  f.resolves[2].resolve({ comments: [{ id: '-', photoId: 'photo', createdAt: 5 }, { id: 'A', photoId: 'photo', createdAt: 5 }], next: null });
  await Promise.all([more, sameMore]);
  assert.deepEqual(f.store.recentComments().map(row => row.id), ['a', '_', 'A', '-']);
  await Promise.all([f.store.refreshSummary('trip'), f.store.refreshRecent('trip')]); assert.equal(f.calls.length, 3);
  now += 31000;
  const freshSummary = f.store.refreshSummary('trip'), freshFeed = f.store.refreshRecent('trip'); assert.equal(f.calls.length, 5);
  f.resolves[3].resolve({ comments: [], next: null }); f.resolves[4].resolve({ comments: [], next: null });
  await Promise.all([freshSummary, freshFeed]); assert.equal(f.store.recentComments().length, 0);
});

test('mutations update complete counts, keep own posts read, and invalidate summary/feed freshness', async () => {
  const rows = new Map(metadata(60).map(row => [row.id, row])), calls = [], drafts = new Map();
  const own = { id: 'mine', journeyId: 'trip', photoId: 'photo-0', createdAt: 100, own: true, body: 'Private body', displayName: 'Alex' };
  const store = globalThis.JOURNEY_ATLAS_COMMUNITY.createStore({ journeyId: 'trip', drafts: { draft(key, value) { if (value === undefined) return drafts.get(key); drafts.set(key, value); } }, request: async (path, options) => {
    calls.push({ path, options });
    if (path.endsWith('/summary')) return { comments: [...rows.values()], next: null };
    if (!options) return { comments: [], next: null };
    if (options.method === 'DELETE') rows.delete('mine'); else rows.set('mine', own);
    return { comment: own };
  } });
  await Promise.all([store.refreshSummary('trip'), store.refreshRecent('trip')]);
  await store.addComment('photo-0', null, own.body, '', 'trip');
  assert.equal(store.notificationSummary().total, 61); assert.equal(store.notificationSummary().unread, 60);
  assert.equal(store.readState.isRead('mine'), true); assert.equal(store.recentComments()[0].id, 'mine');
  await Promise.all([store.refreshSummary('trip'), store.refreshRecent('trip')]); assert.equal(calls.length, 5);
  await store.removeComment('mine', null, 'photo-0'); assert.equal(store.notificationSummary().total, 60);
  await store.restoreComment(own); assert.equal(store.notificationSummary().total, 61); assert.equal(store.notificationSummary().unread, 60);
});

test('late notification reads and every mutation response cannot repopulate private data after lock', async () => {
  const f = cacheFixture(), summary = f.store.refreshSummary('trip'), feed = f.store.refreshRecent('trip');
  f.store.identity.lock();
  f.resolves[0].resolve({ comments: metadata(1), next: null }); f.resolves[1].resolve({ comments: [{ id: 'private', body: 'Hidden', photoId: 'photo', createdAt: 1 }], next: null });
  await Promise.all([summary, feed]); assert.equal(f.store.notificationSummary().loaded, false); assert.deepEqual(f.store.recentComments(), []);
  for (const action of ['add', 'edit', 'delete', 'restore']) {
    const current = cacheFixture();
    const task = action === 'add' ? current.store.addComment('photo', null, 'Words', '', 'trip') : action === 'edit' ? current.store.editComment('comment', null, 'Words') : action === 'delete' ? current.store.removeComment('comment', null, 'photo') : current.store.restoreComment({ id: 'comment', photoId: 'photo' });
    current.store.identity.lock(); current.resolves[0].resolve({ comment: { id: 'comment', photoId: 'photo', createdAt: 1, body: 'Words', own: true } });
    await assert.rejects(task, /Photo access changed/);
    assert.deepEqual(current.store.comments('photo'), []); assert.equal(current.store.readState.isRead('comment'), false);
  }
});

test('clicking a recent row beyond the first discussion page remains visible after refresh', async () => {
  const f = cacheFixture(), target = { id: 'latest', photoId: 'photo', journeyId: 'trip', createdAt: 100, body: 'Selected from notifications' };
  f.store.includeComment(target); assert.equal(f.store.hasLoaded('photo'), false);
  const read = f.store.refresh('trip', 'photo');
  f.resolves[0].resolve({ comments: Array.from({ length: 50 }, (_, i) => ({ id: `old-${i}`, photoId: 'photo', createdAt: i })), next: 'more' }); await read;
  assert.equal(f.store.comments('photo').length, 51); assert.equal(f.store.comments('photo').at(-1).id, 'latest');
  assert.equal(f.store.hasMore('photo'), true); assert.equal(f.store.readState.isRead('latest'), false);
  f.store.destroy(); assert.deepEqual(f.store.comments('photo'), []); await assert.rejects(f.store.refreshSummary('trip'), /no longer active/);
});

test('a fresh feed wins over an older pagination request and subsequent pagination waits for its cursor', async () => {
  const f = cacheFixture(), first = f.store.refreshRecent('trip');
  f.resolves[0].resolve({ comments: [{ id: 'first', createdAt: 1 }], next: 'old-cursor' }); await first;
  const oldMore = f.store.refreshRecent('trip', { more: true }), fresh = f.store.refreshRecent('trip', { force: true });
  const nextMore = f.store.refreshRecent('trip', { more: true }); assert.equal(f.calls.length, 3);
  f.resolves[2].resolve({ comments: [{ id: 'new', createdAt: 5 }], next: 'new-cursor' }); await fresh; await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.calls.length, 4); assert.match(f.calls[3].path, /before=new-cursor$/);
  f.resolves[1].resolve({ comments: [{ id: 'stale', createdAt: 0 }], next: null }); await oldMore;
  f.resolves[3].resolve({ comments: [{ id: 'older-new', createdAt: 4 }], next: null }); await nextMore;
  assert.deepEqual(f.store.recentComments().map(row => row.id), ['new', 'older-new']);
});

test('an older summary cannot prune a newer feed/photo response or selected comment', async () => {
  const f = cacheFixture(), summary = f.store.refreshSummary('trip');
  const feed = f.store.refreshRecent('trip'), photo = f.store.refresh('trip', 'photo');
  const row = { id: 'new-arrival', photoId: 'photo', createdAt: 10, body: 'Arrived while summary was pending' };
  f.resolves[1].resolve({ comments: [row], next: null }); f.resolves[2].resolve({ comments: [row], next: null });
  await Promise.all([feed, photo]);
  f.store.includeComment({ ...row, id: 'selected-later' });
  f.resolves[0].resolve({ comments: [], next: null }); await summary;
  assert.equal(f.store.recentComments()[0].id, 'new-arrival');
  assert.deepEqual(f.store.comments('photo').map(comment => comment.id), ['new-arrival', 'selected-later']);
  const subsequent = f.store.refreshSummary('trip', { force: true });
  f.resolves[3].resolve({ comments: [], next: null }); await subsequent;
  assert.deepEqual(f.store.recentComments(), []); assert.deepEqual(f.store.comments('photo'), []);
});

test('loading older pages never extends freshness of the feed or discussion first page', async t => {
  let now = 1000; t.mock.method(Date, 'now', () => now);
  const f = cacheFixture(), feed = f.store.refreshRecent('trip'), photo = f.store.refresh('trip', 'photo');
  f.resolves[0].resolve({ comments: [], next: 'feed-more' }); f.resolves[1].resolve({ comments: [], next: 'photo-more' });
  await Promise.all([feed, photo]); now += 31000;
  const moreFeed = f.store.refreshRecent('trip', { more: true }), morePhoto = f.store.refresh('trip', 'photo', true);
  f.resolves[2].resolve({ comments: [], next: null }); f.resolves[3].resolve({ comments: [], next: null });
  await Promise.all([moreFeed, morePhoto]); assert.equal(f.store.fresh('photo'), false);
  const refreshedFeed = f.store.refreshRecent('trip'), refreshedPhoto = f.store.refresh('trip', 'photo');
  assert.equal(f.calls.length, 6); assert.equal(f.calls[4].path.endsWith('/comments'), true);
  f.resolves[4].resolve({ comments: [], next: null }); f.resolves[5].resolve({ comments: [], next: null });
  await Promise.all([refreshedFeed, refreshedPhoto]);
});
