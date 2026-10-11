import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import '../dist/assets/comment-notifications.js';
import '../dist/assets/places-comments.js';
import '../dist/assets/trip-notifications.js';

const { badgeState, updatePhotoBadge } = globalThis.JOURNEY_ATLAS_TRIP_NOTIFICATIONS;
const { createReadState } = globalThis.JOURNEY_ATLAS_COMMENT_NOTIFICATIONS;
const memory = () => { const values = new Map(); return { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) }; };

test('photo counts distinguish unknown, empty, unread and fully read discussions', () => {
  assert.deepEqual(badgeState({ loaded: false }, 'p'), { known: false, count: '', unread: false, label: 'Comments' });
  assert.deepEqual(badgeState({ loaded: true, photos: {} }, 'p'), { known: true, count: '0', unread: false, label: 'Comments, 0 comments' });
  const summary = { loaded: true, photos: { p: { total: 75, unread: 3 } } };
  assert.deepEqual(badgeState(summary, 'p'), { known: true, count: '3', unread: true, label: 'Comments, 75 comments, 3 unread' });
  const badge = { dataset: {} }, button = { querySelector: () => badge, setAttribute(key, value) { this[key] = value; } };
  updatePhotoBadge(button, summary, 'p'); assert.equal(badge.dataset.unread, 'true'); assert.equal(badge.textContent, '3');
  summary.photos.p.unread = 0; updatePhotoBadge(button, summary, 'p');
  assert.equal(badge.dataset.unread, 'false'); assert.equal(badge.textContent, '75'); assert.equal(button['aria-label'], 'Comments, 75 comments');
});

test('visible-row reader respects clipping, hidden tabs, closed surfaces and batches only displayed IDs', () => {
  const reads = [], events = new Map(), frames = [], nodes = [];
  let active = true, visible = true, intersection;
  const container = { getClientRects: () => visible ? [{}] : [], getBoundingClientRect: () => ({ top: 100, bottom: 300, left: 0, right: 400 }), querySelectorAll: () => nodes, addEventListener: (name, fn) => events.set(name, fn) };
  const row = (id, top, bottom) => ({ dataset: { commentId: id }, getBoundingClientRect: () => ({ top, bottom, height: bottom - top, width: 200, left: 0, right: 200 }) });
  nodes.push(row('above', 0, 99), row('clipped', 50, 150), row('seen', 120, 220), row('below', 310, 400));
  const document = { visibilityState: 'visible', addEventListener: (name, fn) => events.set(name, fn) };
  const window = { requestAnimationFrame: fn => { frames.push(fn); return frames.length; }, cancelAnimationFrame() {}, addEventListener: (name, fn) => events.set(name, fn), IntersectionObserver: class { constructor(fn) { intersection = fn; } observe() {} disconnect() {} } };
  vm.runInNewContext(fs.readFileSync(new URL('../dist/assets/trip-notifications.js', import.meta.url), 'utf8'), { window, document });
  const observer = window.JOURNEY_ATLAS_TRIP_NOTIFICATIONS.observeVisible({ container, active: () => active, read: ids => reads.push([...ids]) });
  observer.refresh(); frames.shift()(); assert.deepEqual(reads, [['seen']]);
  active = false; intersection(); frames.shift()(); assert.equal(reads.length, 1);
  active = true; document.visibilityState = 'hidden'; events.get('visibilitychange')(); frames.shift()(); assert.equal(reads.length, 1);
  document.visibilityState = 'visible'; visible = false; observer.refresh(); frames.shift()(); assert.equal(reads.length, 1);
  visible = true; nodes[1] = row('now-seen', 101, 181); events.get('scroll')(); frames.shift()(); assert.deepEqual(reads.at(-1), ['now-seen', 'seen']);
});

test('replacing a comment page waits for its target scroll before marking rows read', () => {
  const frames = new Map(), read = []; let frame = 0, selected = 'old-page';
  const window = { requestAnimationFrame(fn) { frames.set(++frame, fn); return frame; }, cancelAnimationFrame(id) { frames.delete(id); }, addEventListener() {} };
  const document = { visibilityState: 'visible', addEventListener() {} };
  const container = {
    addEventListener() {}, getClientRects: () => [{}],
    getBoundingClientRect: () => ({ top: 0, bottom: 200, left: 0, right: 300 }),
    querySelectorAll: () => [{ dataset: { commentId: selected }, getBoundingClientRect: () => ({ top: 0, bottom: 100, left: 0, right: 200, width: 200, height: 100 }) }]
  };
  vm.runInNewContext(fs.readFileSync(new URL('../dist/assets/trip-notifications.js', import.meta.url), 'utf8'), { window, document });
  const observer = window.JOURNEY_ATLAS_TRIP_NOTIFICATIONS.observeVisible({ container, active: () => true, read: ids => read.push(...ids) });
  observer.refresh();
  window.requestAnimationFrame(() => { selected = 'requested-comment'; });
  observer.refresh();
  for (const callback of frames.values()) callback();
  assert.deepEqual(read, ['requested-comment'], 'Transient rows before the target scroll were never displayed');
});

test('demo notification adapter covers the whole eligible trip and preserves local read counts across paging', async () => {
  const storage = memory(), readState = createReadState({ storage, journeyId: 'demo', eventTarget: null });
  const store = globalThis.JOURNEY_ATLAS_PLACES.createDemoStore(storage, 'demo-comments', { readState, eligiblePhotos: () => [{ id: 'a' }, { id: 'b' }] });
  const author = { id: 'author', name: 'Alex' };
  for (let n = 0; n < 55; n++) store.addComment(n % 2 ? 'a' : 'b', author, `Comment ${n}`, `comment-${n}`, n + 1);
  store.addComment('removed-photo', author, 'Gone', 'gone', 99);
  assert.equal(store.notificationSummary().total, 55); assert.equal(store.notificationSummary().unread, 55);
  assert.equal(store.recentComments().length, 50); assert.equal(store.recentComments()[0].id, 'comment-54'); assert.equal(store.hasMoreRecent(), true);
  store.markRead(store.recentComments().slice(0, 2)); assert.equal(store.notificationSummary().unread, 53);
  await store.refreshRecent('demo', { more: true }); assert.equal(store.recentComments().length, 55); assert.equal(store.hasMoreRecent(), false);
  store.removeComment('comment-54', author.id); assert.equal(store.notificationSummary().unread, 53); assert.equal(store.notificationSummary().total, 54);
  store.destroy();
});

test('notification navigation survives native history microtask checkpoints between listeners', async () => {
  const nodes = new Map(), tasks = []; let selected = null, commentsOpen = false;
  const row = { id: 'latest', photoId: 'p', displayName: 'Alex', body: 'Newest comment', createdAt: 10 };
  const node = selector => {
    if (!nodes.has(selector)) nodes.set(selector, {
      id: selector.slice(1), dataset: {}, open: false, hidden: false, scrollTop: 0, listeners: new Map(),
      querySelector: child => node(`${selector} ${child}`), querySelectorAll: () => [],
      addEventListener(name, fn) { const rows = this.listeners.get(name) || []; rows.push(fn); this.listeners.set(name, rows); },
      emit(name, event) { for (const fn of this.listeners.get(name) || []) fn(event); },
      setAttribute(name, value) { this[name] = value; }, focus() {}, getClientRects: () => [{}], replaceChildren() {},
      showModal() { this.open = true; }, close() { this.open = false; this.emit('close'); }
    });
    return nodes.get(selector);
  };
  const document = { querySelector: node, querySelectorAll: () => [], activeElement: null, visibilityState: 'visible', addEventListener() {} };
  const store = { notificationSummary: () => ({ loaded: true, total: 1, unread: 1, photos: { p: { total: 1, unread: 1 } } }), recentComments: () => [row], hasRecent: () => true, hasMoreRecent: () => false, readState: { isRead: () => false, persistent: () => true }, subscribe: () => () => {}, refreshSummary: async () => {}, refreshRecent: async () => {}, markRead() {} };
  const window = {
    requestAnimationFrame: () => 1, cancelAnimationFrame() {}, addEventListener() {},
    setTimeout(fn, delay) { assert.equal(delay, 0); tasks.push(fn); },
    JOURNEY_ATLAS_PHOTO_COMMENTS: { photoTitle: () => 'Photograph' },
    JOURNEY_ATLAS_MOBILE_UI: {
      presentOverlay: id => node(`#${id}`).showModal(),
      dismissOverlay(id, after) {
        node(`#${id}`).close();
        after(); // The mobile history listener completes dismissal first.
        // Native dispatch can checkpoint microtasks before the next listener.
        // A promise-based opener would run first, then be discarded here.
        Promise.resolve().then(() => { selected = null; commentsOpen = false; });
      }
    }
  };
  vm.runInNewContext(fs.readFileSync(new URL('../dist/assets/trip-notifications.js', import.meta.url), 'utf8'), { window, document });
  const controller = window.JOURNEY_ATLAS_TRIP_NOTIFICATIONS.create({ live: true, unlocked: () => true, store: () => store, journey: () => ({ id: 'trip', days: [], photos: [{ id: 'p' }] }), openComment(comment) { selected = comment.photoId; commentsOpen = true; } });
  controller.update(); controller.open();
  node('#trip-notifications-list').emit('click', { target: { closest: () => ({ dataset: { openComment: 'latest' } }) } });
  assert.equal(node('#trip-notifications-dialog').open, false);
  await Promise.resolve();
  assert.equal(selected, null, 'Destination does not open during the history dispatch');
  for (const task of tasks) task();
  assert.equal(selected, 'p'); assert.equal(commentsOpen, true, 'The old photo selection cannot dismiss the new conversation');
});
