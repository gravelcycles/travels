import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { commentChildren } from './photo-comments-dom-harness.mjs';

export function commentsFixture({ sourceRoot = new URL('..', import.meta.url).pathname, initialRows = [], loaded = true, initialDrafts = {} } = {}) {
  const nodes = new Map(), data = new Map(), events = new Map(), pending = [];
  const counts = { writes: 0, reads: 0, listReplacements: 0, rowBuilds: 0, rowsBuilt: 0, inserted: 0, visibilityRefreshes: 0 };
  let rows = initialRows, known = loaded, failStorage = false, deferRefresh = false, visitor = { id: 'me', name: 'Alex' }, nextId = 0;
  const storage = { getItem(key) { counts.reads++; return data.get(key) ?? null; }, setItem(key, value) { counts.writes++; if (failStorage) throw new Error('blocked'); data.set(key, value); } };
  data.set('drafts', JSON.stringify({comments: [], reviews: [], drafts: initialDrafts}));
  function node(selector) {
    if (nodes.has(selector)) return nodes.get(selector);
    const listeners = new Map(), classes = new Set();
    const element = { selector, value: '', textContent: '', innerHTML: '', hidden: false, open: false, dataset: {}, style: { setProperty() {}, removeProperty() {} }, scrollHeight: 50, scrollTop: 0, isConnected: true,
      src: 'https://example.test/assets/photo-comments.js', classList: { add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name) },
      setAttribute(key, value) { this[key] = value; }, removeAttribute(key) { delete this[key]; },
      querySelector: node, querySelectorAll(selector) { return selector === '[data-comment-id]' ? this.children.filter(child => child.dataset.commentId) : []; }, getClientRects: () => [{}], contains: () => false,
      closest: () => node('edit-form'), setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; },
      addEventListener(type, listener) { const handlers = listeners.get(type) || []; handlers.push(listener); listeners.set(type, handlers); },
      fire(type, event = {}) { return Promise.all((listeners.get(type) || []).map(fn => fn({currentTarget: this, ...event}))); },
      showModal() { this.open = true; }, close() { this.open = false; this.fire('close'); }, focus() { document.activeElement = this; }, scrollIntoView() {},
    };
    commentChildren(element, (kind, changed) => {
      if (kind === 'html' && changed.selector === '#comments-list') { counts.listReplacements++; counts.rowsBuilt += (changed.innerHTML.match(/data-comment-id=/g) || []).length; }
      if (kind === 'html' && changed.tagName === 'ARTICLE') { counts.rowBuilds++; counts.rowsBuilt++; }
      if (kind === 'insert') counts.inserted++;
    });
    nodes.set(selector, element); return element;
  }
  const document = { querySelector: node, querySelectorAll: () => [], body: node('body'), documentElement: node('html'), activeElement: node('opener'), addEventListener() {},
    createElement(tag) { const value = node(`created-${++nextId}`); value.tagName = tag.toUpperCase(); return value; } };
  const window = { localStorage: storage, addEventListener(type, fn) { const handlers = events.get(type) || []; handlers.push(fn); events.set(type, handlers); },
    JOURNEY_ATLAS_AUTH: { clearImage() {} }, JOURNEY_ATLAS_TRIP_NOTIFICATIONS: { updatePhotoBadge() {}, observeVisible: () => ({ refresh() { counts.visibilityRefreshes++; }, stop() {} }) } };
  const context = vm.createContext({ window, document, URL, URLSearchParams, location: {href: 'https://example.test'}, innerHeight: 844, requestAnimationFrame: fn => fn(), MutationObserver: class {observe() {}} });
  for (const file of ['places-comments.js', 'photo-comments.js']) vm.runInContext(fs.readFileSync(path.join(sourceRoot, 'dist/assets', file), 'utf8'), context);
  const drafts = window.JOURNEY_ATLAS_PLACES.createDemoStore(storage, 'drafts');
  const store = { identity: { get: () => visitor, allowed: () => true, lock() {}, async save(name) { visitor = {...visitor, name}; return {visitor, persistent: true}; } },
    comments: () => rows.map(row => ({...row})), hasLoaded: () => known, fresh: () => true, hasMore: () => false, draft: drafts.draft,
    profile: async () => visitor, refresh() { if (deferRefresh) return new Promise((resolve, reject) => pending.push({resolve(next = rows) { rows = next; known = true; resolve(); }, reject})); known = true; return Promise.resolve(); }, refreshSummary: async () => {},
    async editComment(id, _visitor, body) { rows = rows.map(row => row.id === id ? {...row, body, editedAt: 2} : row); },
  };
  const photos = ['a', 'b', 'c', 'd'].map(id => ({id, src: `https://example.test/${id}.jpg`}));
  node('#photo-dialog').open = true;
  const controller = window.JOURNEY_ATLAS_PHOTO_COMMENTS.create({live: true, store: () => store, journey: () => ({id: 'trip'}), photos: () => photos, protected: () => false, unlocked: () => true});
  controller.update(); controller.photoChanged(photos[0]);
  return {controller, photos, node, counts, pending, store, data,
    resetCounts() { for (const key of Object.keys(counts)) counts[key] = 0; },
    rows(value) { rows = value; }, visitor(value) { visitor = value; }, defer(value = true) { deferRefresh = value; }, fail(value = true) { failStorage = value; },
    emit(type) { for (const fn of events.get(type) || []) fn(); },
    saved() { return JSON.parse(data.get('drafts')).drafts; },
  };
}
export const comments = count => Array.from({length: count}, (_, index) => ({id: `row-${index}`, photoId: 'a', visitorId: index ? 'other' : 'me', displayName: index ? 'Sam' : 'Alex', body: `Memory ${index}`, createdAt: 1700000000000 + index}));
