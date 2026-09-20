import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Native dialog close events and history traversals are queued. Keep that
// ordering here: synchronous DOM stubs conceal nested-overlay regressions.
function historyFixture({ mobile = true, earlierPage = false, scope = 'day' } = {}) {
  const nodes = new Map(), events = new Map(), queue = [], stack = earlierPage ? [{ priorPage: true }, {}] : [{}];
  let cursor = stack.length - 1, controller, selected = 0, closeChildren = false, overviewCalls = 0;
  const day = { id: 'day-one', number: 1, date: 'Today', title: 'A day' };
  const photos = [0, 1, 2].map(index => ({ id: `photo-${index}` }));
  function node(selector) {
    if (nodes.has(selector)) return nodes.get(selector);
    const listeners = new Map();
    const value = {
      dataset: {}, style: { setProperty() {} }, classList: { add() {}, remove() {}, contains() { return false; } },
      clientWidth: 390, clientHeight: 706, offsetHeight: 160, naturalWidth: 1200, naturalHeight: 800,
      open: false, hidden: false, inert: false, children: [], textContent: '',
      setAttribute(name, item) { this[name] = item; }, removeAttribute(name) { delete this[name]; },
      append(child) { this.children.push(child); }, focus() {}, getBoundingClientRect() { return { left: 0, top: 0, width: 390, height: 706 }; },
      querySelectorAll() { return []; }, closest() { return null; },
      addEventListener(name, listener) { if (!listeners.has(name)) listeners.set(name, []); listeners.get(name).push(listener); },
      showModal() { this.open = true; },
      close() {
        if (!this.open) return;
        this.open = false;
        queue.push(() => {
          if (selector === '#photo-dialog') {
            controller.closed();
            if (closeChildren) for (const id of ['comments-dialog', 'experience-unlock']) node(`#${id}`).close();
          }
          for (const listener of listeners.get('close') || []) listener();
        });
      }
    };
    nodes.set(selector, value); return value;
  }
  const history = {
    get state() { return stack[cursor]; },
    get position() { return cursor; },
    replaceState(value) { stack[cursor] = structuredClone(value); },
    pushState(value) { stack.splice(++cursor); stack[cursor] = structuredClone(value); },
    back() { this.go(-1); },
    go(delta) { queue.push(() => { cursor = Math.max(0, Math.min(stack.length - 1, cursor + delta)); events.get('popstate')?.({ state: this.state }); }); }
  };
  const api = {
    day: () => day, days: () => [day], scope: () => scope, title: () => 'Journey',
    dayInfo: () => ({ route: 'Route', meta: '', count: photos.length }),
    tab: value => { node('.atlas-shell').dataset.mobileTab = value; }, selectDay() {}, preview() {}, stepDay() {}, album() {}, overview() { overviewCalls++; }, replay() {},
    location() {}, pauseLocation() {}, pauseMedia() {}, clearImage() {}, loadImage() {},
    restoreOverlay: id => controller.presentOverlay(id),
    selectPhoto(value) { selected = value; controller.update({ day, photos, index: selected }); },
    openDay() { controller.open(); node('#photo-dialog').showModal(); this.selectPhoto(selected); }
  };
  const context = vm.createContext({
    window: { addEventListener: (name, listener) => events.set(name, listener) },
    document: { querySelector: node, createElement: () => node(`image-${nodes.size}`) },
    history, location: { href: 'https://example.test/journey' },
    matchMedia: query => ({ matches: query.includes('900px') && mobile, addEventListener() {} }),
    ResizeObserver: class { observe() {} }, requestAnimationFrame() {}, cancelAnimationFrame() {}, setTimeout() {}, clearTimeout() {}, performance: { now: () => 0 }
  });
  vm.runInContext(fs.readFileSync(new URL('../dist/assets/mobile-ux.js', import.meta.url), 'utf8'), context);
  node('.atlas-shell').dataset.mobileTab = 'map';
  controller = context.window.JOURNEY_ATLAS_MOBILE.create(api);
  return {
    node, api, controller, history, get selected() { return selected; }, get overviewCalls() { return overviewCalls; },
    closePhotoAndChildren() { closeChildren = true; node('#photo-dialog').close(); },
    flush() { let count = 0; while (queue.length) { assert.ok(++count < 40, 'History must settle without a traversal loop'); queue.shift()(); } }
  };
}

test('comments Back and Forward preserve the selected photo on phone and desktop', () => {
  for (const mobile of [true, false]) {
    const f = historyFixture({ mobile }); f.api.openDay(); f.api.selectPhoto(2);
    f.controller.presentOverlay('comments-dialog');
    f.history.back(); f.flush();
    assert.equal(f.node('#comments-dialog').open, false);
    assert.equal(f.node('#photo-dialog').open, true);
    assert.equal(f.selected, 2);
    f.history.go(1); f.flush();
    assert.equal(f.node('#comments-dialog').open, true);
    assert.equal(f.selected, 2);
    f.controller.dismissOverlay('comments-dialog'); f.flush();
    assert.equal(f.node('#photo-dialog').open, true);
    assert.equal(f.history.state.mobileAtlas.overlay, null);
    assert.equal(f.history.position, 1, 'Dismiss consumes exactly the comment entry');
  }
});

test('cancelling a nested rename returns to the existing conversation and then its photo', () => {
  const f = historyFixture(); f.api.openDay(); f.api.selectPhoto(1);
  f.controller.presentOverlay('comments-dialog');
  f.controller.presentOverlay('experience-unlock');
  f.controller.dismissOverlay('experience-unlock'); f.flush();
  assert.equal(f.node('#experience-unlock').open, false);
  assert.equal(f.node('#comments-dialog').open, true);
  assert.equal(f.history.state.mobileAtlas.overlay, 'comments-dialog');
  assert.equal(f.selected, 1);
  f.history.back(); f.flush();
  assert.equal(f.node('#comments-dialog').open, false);
  assert.equal(f.node('#photo-dialog').open, true);
  assert.equal(f.history.position, 1);
});

test('successful unlock replaces its history step with comments without a stale password return', () => {
  const f = historyFixture(); f.api.openDay();
  f.controller.presentOverlay('experience-unlock');
  f.controller.dismissOverlay('experience-unlock', () => f.controller.presentOverlay('comments-dialog')); f.flush();
  assert.equal(f.node('#experience-unlock').open, false);
  assert.equal(f.node('#comments-dialog').open, true);
  assert.equal(f.history.state.mobileAtlas.overlay, 'comments-dialog');
  f.history.back(); f.flush();
  assert.equal(f.node('#photo-dialog').open, true);
  assert.equal(f.node('#comments-dialog').open, false);
  assert.equal(f.node('#experience-unlock').open, false);
  f.history.go(1); f.flush();
  assert.equal(f.node('#comments-dialog').open, true);
  assert.equal(f.node('#experience-unlock').open, false);
});

test('queued close from a replaced overlay does not dismiss the replacement', () => {
  const f = historyFixture(); f.api.openDay();
  f.controller.presentOverlay('experience-unlock');
  f.node('#experience-unlock').close();
  f.controller.presentOverlay('comments-dialog');
  f.flush();
  assert.equal(f.node('#comments-dialog').open, true);
  assert.equal(f.history.state.mobileAtlas.overlay, 'comments-dialog');
});

test('closing a photo with an open conversation unwinds both layers without resurrecting the photo', () => {
  for (const nestedRename of [false, true]) {
    const f = historyFixture({ earlierPage: true }); f.api.openDay();
    f.controller.presentOverlay('comments-dialog');
    if (nestedRename) f.controller.presentOverlay('experience-unlock');
    f.closePhotoAndChildren(); f.flush();
    assert.equal(f.node('#photo-dialog').open, false);
    assert.equal(f.node('#comments-dialog').open, false);
    assert.equal(f.node('#experience-unlock').open, false);
    assert.equal(f.history.state.mobileAtlas.viewer, false);
    assert.equal(f.history.state.mobileAtlas.overlay, null);
    assert.equal(f.history.position, 1, 'Queued child close must not leave the journey for the earlier page');
  }
});

test('place-only history changes do not refit an unchanged whole-journey map', () => {
  const f = historyFixture({ scope: 'journey' });
  const mobileSnapshot = structuredClone(f.history.state.mobileAtlas);
  f.history.pushState({ ...f.history.state, atlasPlaces: { open: true, selectedId: 'cafe' } });
  f.history.back(); f.flush(); f.history.go(1); f.flush();
  assert.deepEqual(f.history.state.mobileAtlas, mobileSnapshot);
  assert.equal(f.overviewCalls, 0, 'Independent places navigation cannot reset its camera through the mobile controller');
});

function placeHistoryFixture({ cameraReady = null } = {}) {
  const nodes = new Map(), events = new Map(), queue = [];
  const mobileState = { viewer: false, dayId: 'one', scope: 'journey', tab: 'map' };
  const stack = [{ priorPage: true }, { mobileAtlas: mobileState }];
  let cursor = 1, restoreCalls = 0, currentDay = 'one';
  const cameraJumps = [];
  function node(selector) {
    if (nodes.has(selector)) return nodes.get(selector);
    const listeners = new Map(), classes = new Set();
    const value = {
      dataset: {}, hidden: false, open: false, isConnected: true, scrollTop: 0, offsetTop: 0, innerHTML: '', value: '',
      classList: { add(...names) { names.forEach(name => classes.add(name)); }, remove(...names) { names.forEach(name => classes.delete(name)); }, contains: name => classes.has(name) },
      querySelector: child => node(child), querySelectorAll: () => [], append() {},
      setAttribute(name, content) { this[name] = content; }, getClientRects: () => [{ width: 44, height: 44 }],
      getBoundingClientRect: () => ({ left: 0, top: 0, right: 44, bottom: 44, width: 44, height: 44 }),
      focus() { document.activeElement = this; }, closest() { return null; }, contains: () => false,
      addEventListener(name, listener) { if (!listeners.has(name)) listeners.set(name, []); listeners.get(name).push(listener); },
      fire(name, event) { (listeners.get(name) || []).forEach(listener => listener(event)); },
      showModal() { this.open = true; }, close() { this.open = false; }, scrollIntoView() {}
    };
    nodes.set(selector, value); return value;
  }
  const document = { getElementById: id => node(`#${id}`), querySelector: node, createElement: () => node('gallery'), body: node('body'), addEventListener() {}, activeElement: node('#open-places') };
  node('script[src*="/places-panel.js"]').src = 'https://example.test/assets/places-panel.js';
  node('#experience-bar').hidden = true;
  const history = {
    get state() { return stack[cursor]; }, get position() { return cursor; },
    replaceState(value) { stack[cursor] = structuredClone(value); },
    pushState(value) { stack.splice(++cursor); stack[cursor] = structuredClone(value); },
    back() { this.go(-1); },
    go(delta) { queue.push(() => { cursor = Math.max(0, Math.min(stack.length - 1, cursor + delta)); events.get('popstate')?.({ state: this.state }); }); }
  };
  const point = { id: 'cafe', name: 'A café', summary: 'Lunch', category: 'food', status: 'visited', coordinates: [8, 47], dayIds: ['one'], sources: [], reviews: [], images: [{ src: 'https://example.test/photo.jpg', alt: 'A photo', credit: 'Us', sourceUrl: 'https://example.test/source', permission: 'owned' }] };
  const context = vm.createContext({
    window: { addEventListener: (name, listener) => events.set(name, listener) }, document, history, URL,
    FormData: class { constructor(form) { this.values = form.values || {}; } get(name) { return this.values[name]; } },
    location: { href: 'https://example.test/journey' }, matchMedia: () => ({ matches: false }),
    requestAnimationFrame() { return 1; }, cancelAnimationFrame() {}, setTimeout() {}, clearTimeout() {}
  });
  for (const file of ['places-comments.js', 'places-panel.js']) vm.runInContext(fs.readFileSync(new URL(`../dist/assets/${file}`, import.meta.url), 'utf8'), context);
  const stored = new Map();
  const store = context.window.JOURNEY_ATLAS_PLACES.createDemoStore({ getItem: key => stored.get(key), setItem: (key, value) => stored.set(key, value) }, 'trip');
  const originalCamera = { center: [8.53, 47.38], zoom: 9, bearing: 30, pitch: 12, padding: { top: 10, right: 20, bottom: 30, left: 40 } };
  const map = cameraReady === null ? null : {
    on() {}, off() {}, resize() {}, easeTo() {}, loaded: () => cameraReady, isMoving: () => false,
    getCenter: () => ({ toArray: () => [...originalCamera.center] }), getZoom: () => originalCamera.zoom,
    getBearing: () => originalCamera.bearing, getPitch: () => originalCamera.pitch, getPadding: () => ({ ...originalCamera.padding }),
    getContainer: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0, right: 1000, bottom: 800 }) }),
    jumpTo: camera => cameraJumps.push(structuredClone(camera))
  };
  const controller = context.window.JOURNEY_ATLAS_PLACE_PANEL.create({
    journey: () => ({ id: 'journey', days: [{ id: 'one', number: 1, date: 'Today' }], pointsOfInterest: [point] }),
    preview: true, dayId: () => currentDay, store: () => store, explore() {}, map: () => map,
    canRestoreMapCamera: () => cameraReady === true, restoreMap() { restoreCalls++; }
  });
  return {
    controller, history, node, mobileState, store, originalCamera, cameraJumps,
    get restoreCalls() { return restoreCalls; }, setDay(id) { currentDay = id; },
    click(id, dataset = {}, attributes = []) {
      const target = { id, dataset, hasAttribute: name => attributes.includes(name) };
      target.closest = () => target;
      node('#places-panel').fire('click', { target });
    },
    flush() { let count = 0; while (queue.length) { assert.ok(++count < 30, 'Place history must settle'); queue.shift()(); } }
  };
}

test('closing and reopening a remembered place never consumes an earlier unrelated page', () => {
  const f = placeHistoryFixture();
  f.controller.open(); f.click('', { placeId: 'cafe' });
  f.controller.close(); f.flush();
  assert.equal(f.history.position, 1);
  f.controller.open();
  assert.equal(f.controller.isOpen(), true);
  f.controller.close(); f.flush();
  assert.equal(f.controller.isOpen(), false);
  assert.equal(f.history.position, 1, 'Reopened detail owns only entries actually pushed by that opening');
  assert.deepEqual(f.history.state.mobileAtlas, f.mobileState);
});

test('Back to all places after reopening a detail returns to the list before the journey', () => {
  const f = placeHistoryFixture();
  f.controller.open(); f.click('', { placeId: 'cafe' });
  f.controller.close(); f.flush(); f.controller.open();
  f.click('places-back-to-list'); f.flush();
  assert.equal(f.controller.isOpen(), true);
  assert.equal(f.history.state.atlasPlaces.selectedId, '');
  f.controller.close(); f.flush();
  assert.equal(f.history.position, 1);
});

test('place gallery Back restores the detail and preserves the underlying mobile atlas snapshot', () => {
  const f = placeHistoryFixture();
  f.controller.open(); f.click('', { placeId: 'cafe' });
  f.click('', { openGallery: '0' }, ['data-open-gallery']);
  assert.equal(f.node('gallery').open, true);
  f.history.back(); f.flush();
  assert.equal(f.node('gallery').open, false);
  assert.equal(f.controller.isOpen(), true);
  assert.equal(f.history.state.atlasPlaces.selectedId, 'cafe');
  assert.deepEqual(f.history.state.mobileAtlas, f.mobileState);
  f.history.go(1); f.flush();
  assert.equal(f.node('gallery').open, true);
});

test('resetting preview edits removes the rendered review and its in-memory draft', () => {
  const f = placeHistoryFixture();
  f.store.saveReview('cafe', 'Alex', 5, 'Posted impression');
  f.controller.open(); f.click('', { placeId: 'cafe' });
  const form = f.node('#place-review-form');
  form.values = { name: 'Alex', rating: '4', body: 'Unfinished edited impression' };
  form.fire('input', {});
  assert.equal(f.store.draft('place-review:cafe').body, 'Unfinished edited impression');
  f.store.reset(); f.controller.update(true);
  assert.doesNotMatch(f.node('#places-content').innerHTML, /Posted impression|Unfinished edited impression|pp-own-review/);
  assert.equal(f.store.draft('place-review:cafe'), null);
});

test('closing Places restores an established camera but never a cold startup world view', () => {
  for (const cameraReady of [false, true]) {
    const f = placeHistoryFixture({ cameraReady });
    f.controller.open(); f.click('', { placeId: 'cafe' }); f.controller.close(); f.flush();
    assert.equal(f.restoreCalls, cameraReady ? 0 : 1);
    assert.equal(f.cameraJumps.length, cameraReady ? 1 : 0);
    if (cameraReady) assert.deepEqual(f.cameraJumps[0], f.originalCamera);
  }
});

test('changing the journey day while Places is open restores that day instead of its older camera', () => {
  const f = placeHistoryFixture({ cameraReady: true });
  f.controller.open(); f.setDay('two'); f.controller.close(); f.flush();
  assert.equal(f.restoreCalls, 1);
  assert.equal(f.cameraJumps.length, 0);
});

test('nearby cluster choices stay in the expanded Places sheet and retain the original list position', () => {
  const f = placeHistoryFixture();
  f.controller.open();
  const content = f.node('#places-content');
  content.scrollTop = 164; content.fire('scroll', {});
  f.controller.showNearby(['cafe']);
  assert.equal(f.node('#places-panel').dataset.expanded, 'true');
  assert.deepEqual(f.history.state.atlasPlaces.nearbyIds, ['cafe']);
  assert.match(content.innerHTML, /data-clear-nearby/);
  f.click('', { placeId: 'cafe' });
  f.history.back(); f.flush();
  assert.equal(f.controller.isOpen(), true);
  assert.equal(f.history.state.atlasPlaces.selectedId, '');
  assert.deepEqual(f.history.state.atlasPlaces.nearbyIds, ['cafe']);
  f.click('', {}, ['data-clear-nearby']);
  assert.equal(f.history.state.atlasPlaces.nearbyIds, null);
  assert.equal(content.scrollTop, 164);
  assert.doesNotMatch(content.innerHTML, /data-clear-nearby/);
});
