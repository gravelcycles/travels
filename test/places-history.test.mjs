import '../dist/assets/atlas-utils.js';
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
    window: { JOURNEY_ATLAS_UTILS:globalThis.JOURNEY_ATLAS_UTILS, addEventListener: (name, listener) => events.set(name, listener) },
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

function placeHistoryFixture({ mobile = false, cameraReady = null, scope = 'journey', photos = [], visibleDayIds, interactiveMap = false } = {}) {
  const nodes = new Map(), events = new Map(), queue = [];
  const mobileState = { viewer: false, dayId: 'one', scope: 'journey', tab: 'map' };
  const stack = [{ priorPage: true }, { mobileAtlas: mobileState }];
  let cursor = 1, restoreCalls = 0, currentDay = 'one';
  const cameraJumps = [], cameraMoves = [], openedPhotos = [], frames = [], mapEvents = new Map(), pinButtons = [], popups = []; let elementId = 0;
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
  const document = { getElementById: id => node(`#${id}`), querySelector: node, createElement: () => node(interactiveMap ? `element-${elementId++}` : 'gallery'), body: node('body'), addEventListener() {}, activeElement: node('#open-places') };
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
    window: { JOURNEY_ATLAS_UTILS:globalThis.JOURNEY_ATLAS_UTILS, addEventListener: (name, listener) => events.set(name, listener) }, document, history, URL,
    FormData: class { constructor(form) { this.values = form.values || {}; } get(name) { return this.values[name]; } },
    location: { href: 'https://example.test/journey' }, matchMedia: query => ({ matches: mobile && query.includes('900px') }),
    requestAnimationFrame(fn) { if(interactiveMap)frames.push(fn); return 1; }, cancelAnimationFrame() {}, setTimeout() {}, clearTimeout() {}
  });
  for (const file of ['photo-places.js','places-comments.js', 'places-panel.js']) vm.runInContext(fs.readFileSync(new URL(`../dist/assets/${file}`, import.meta.url), 'utf8'), context);
  const stored = new Map();
  const store = context.window.JOURNEY_ATLAS_PLACES.createDemoStore({ getItem: key => stored.get(key), setItem: (key, value) => stored.set(key, value) }, 'trip');
  const originalCamera = { center: [8.53, 47.38], zoom: 9, bearing: 30, pitch: 12, padding: { top: 10, right: 20, bottom: 30, left: 40 } };
  const map = cameraReady === null ? null : {
    on(name,fn) { mapEvents.set(name,fn); }, off(name) { mapEvents.delete(name); }, resize() {}, easeTo(value) { cameraMoves.push(value); }, fitBounds(value) { cameraMoves.push(value); }, project: ([x,y])=>({x,y}), loaded: () => cameraReady, isMoving: () => false,
    getCenter: () => ({ toArray: () => [...originalCamera.center] }), getZoom: () => originalCamera.zoom,
    getBearing: () => originalCamera.bearing, getPitch: () => originalCamera.pitch, getPadding: () => ({ ...originalCamera.padding }),
    getContainer: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0, right: 1000, bottom: 800 }) }),
    jumpTo: camera => cameraJumps.push(structuredClone(camera))
  };
  if (interactiveMap) context.window.maplibregl = {
    Marker: class { constructor({element}) { this.element=element; } setLngLat(){return this;} addTo(){pinButtons.push(this.element);return this;} remove(){this.removed=true;} },
    Popup: class { constructor(){popups.push(this);this.open=false;} setLngLat(){return this;} setDOMContent(){return this;} addTo(){this.open=true;return this;} remove(){this.open=false;} },
    LngLatBounds: class { extend(){return this;} }
  };
  let journey = { id: 'journey', days: [{ id: 'one', number: 1, date: 'Today' }], pointsOfInterest: [point] };
  const controller = context.window.JOURNEY_ATLAS_PLACE_PANEL.create({
    journey: () => journey,
    photos:()=>photos, preview: true, mapScope:()=>scope, visibleDayIds:()=>visibleDayIds, openPhoto:(id, options)=>openedPhotos.push({id, options}), dayId: () => currentDay, store: () => store, explore() {}, map: () => map,
    canRestoreMapCamera: () => cameraReady === true, restoreMap() { restoreCalls++; }
  });
  return {
    controller, history, node, mobileState, store, originalCamera, cameraJumps, cameraMoves, journey, openedPhotos, pinButtons, popups,
    flushFrames() { while(frames.length)frames.shift()(); }, flushFrame() { frames.shift()?.(); }, mapEvent(name){mapEvents.get(name)?.();},
    setJourney(value) { journey = value; controller.update(); },
    get restoreCalls() { return restoreCalls; }, setDay(id) { currentDay = id; },
    click(id, dataset = {}, attributes = []) {
      const target = { id, dataset, hasAttribute: name => attributes.includes(name) };
      target.closest = () => target;
      node('#places-panel').fire('click', { target });
    },
    flush() { let count = 0; while (queue.length) { assert.ok(++count < 30, 'Place history must settle'); queue.shift()(); } }
  };
}

test('Places buttons follow trip content, including empty trips and switching back to populated trips', () => {
  const f = placeHistoryFixture();
  const assertButtons = hidden => {
    for (const id of ['open-places', 'mobile-open-places', 'experience-places']) assert.equal(f.node(`#${id}`).hidden, hidden, id);
  };
  assertButtons(false);
  f.setDay('two'); f.controller.update();
  assertButtons(false); // A day without places is still part of a trip with places.
  for (const pointsOfInterest of [undefined, []]) {
    f.setJourney({ id:'empty', days:f.journey.days, pointsOfInterest });
    assertButtons(true);
    assert.equal(f.node('#place-count').textContent, '0');
    f.setJourney(f.journey);
    assertButtons(false);
    assert.equal(f.node('#place-count').textContent, '1');
  }
});

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
  f.controller.open(); f.click('', { placeId: 'cafe' }); f.click('', { showPlaceTab:'reviews' });
  const form = f.node('#place-review-form');
  form.values = { name: 'Alex', rating: '4', body: 'Unfinished edited impression' };
  form.fire('input', {});
  assert.equal(f.store.draft('place-review:cafe').body, 'Unfinished edited impression');
  f.store.reset(); f.controller.update(true);
  assert.doesNotMatch(f.node('.pp-reviews-content').innerHTML, /Posted impression|Unfinished edited impression|pp-own-review/);
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

test('Places to inline trip photos preserves Back and Forward to the original place detail',()=>{
  const f=placeHistoryFixture();f.controller.openPlace('cafe');const detail=structuredClone(f.history.state);
  f.controller.closeForPhotos();assert.equal(f.controller.isOpen(),false);
  f.history.pushState({...detail,atlasPlaces:{...detail.atlasPlaces,open:false,depth:0},atlasPhotoBubble:{journeyId:'journey',dayId:'one',ids:['photo'],photoId:'photo'}});
  f.history.back();f.flush();assert.equal(f.controller.isOpen(),true);assert.equal(f.history.state.atlasPlaces.selectedId,'cafe');
  f.history.go(1);f.flush();assert.equal(f.controller.isOpen(),false);assert.equal(f.history.state.atlasPhotoBubble.photoId,'photo');
});


test('place reviews float over the current detail and Back/Forward restore only the conversation', () => {
  const f=placeHistoryFixture();f.controller.openPlace('cafe');
  f.click('', {showPlaceTab:'reviews'});
  assert.equal(f.node('#place-reviews-dialog').open,true);
  assert.equal(f.controller.isOpen(),true);
  assert.equal(f.history.state.atlasPlaces.tab,'overview');
  assert.equal(f.history.state.atlasPlaces.reviews,true);
  f.history.back();f.flush();
  assert.equal(f.node('#place-reviews-dialog').open,false);
  assert.equal(f.history.state.atlasPlaces.selectedId,'cafe');
  assert.equal(f.controller.isOpen(),true);
  f.history.go(1);f.flush();assert.equal(f.node('#place-reviews-dialog').open,true);
  f.controller.close();f.flush();assert.equal(f.node('#place-reviews-dialog').open,false);
});

test('Places opens in the current stop and preserves a deliberate whole-trip scope through detail history and reopening', () => {
  const f = placeHistoryFixture({ scope: 'day' });
  const one = f.journey.pointsOfInterest[0], two = { ...one, id: 'other', name: 'Another city café', dayIds: ['two'] };
  f.setJourney({ ...f.journey, eventMode: 'city', days: [{ id:'one', number:7, title:'Prague', date:'6–11 Oct' }, { id:'two', number:8, title:'Brno' }], pointsOfInterest: [one, two] });
  f.controller.open();
  assert.equal(f.history.state.atlasPlaces.dayOnly, true);
  assert.match(f.node('#places-content').innerHTML, /A café/);
  assert.doesNotMatch(f.node('#places-content').innerHTML, /Another city café/);
  assert.equal(f.node('#places-event-only-label').textContent, 'Prague');
  assert.equal(f.node('#mobile-day-places').textContent, 'Places · 1');
  f.click('', { placeScope: 'all' });
  f.node('#places-content').scrollTop = 120; f.node('#places-content').fire('scroll', {});
  f.click('', { placeId: 'other' });
  f.history.back(); f.flush();
  assert.match(f.node('#places-content').innerHTML, /Another city café/);
  assert.equal(f.node('#places-content').scrollTop, 120);
  f.controller.close(); f.flush(); f.controller.open();
  assert.equal(f.history.state.atlasPlaces.dayOnly, false);
  assert.equal(f.history.state.atlasPlaces.scopeChoice, 'all');
  f.node('#mobile-day-places').fire('click');
  assert.equal(f.history.state.atlasPlaces.dayOnly, true, 'The explicit stop action can intentionally narrow a remembered all-place list');
});

test('an empty focused stop offers all places, and saved venue details do not invent a visit or an empty review dialog', () => {
  const f = placeHistoryFixture({ scope: 'day' });
  const point = { ...f.journey.pointsOfInterest[0], status: 'saved', note: 'Try next time' };
  f.setJourney({ ...f.journey, eventMode: 'city', days: [{id:'one', number:7, title:'Prague', date:'6–11 Oct'}, {id:'two', number:8, title:'Brno'}], pointsOfInterest:[point] });
  f.setDay('two'); f.controller.update(); f.controller.open();
  assert.match(f.node('#places-content').innerHTML, /No places found/);
  assert.match(f.node('#places-content').innerHTML, /See all places/);
  f.click('', {}, ['data-clear-filters']); f.click('', { placeId:'cafe' });
  const html = f.node('#places-content').innerHTML;
  assert.match(html, /Stop 7 · Prague/);
  assert.match(html, /Saved note/);
  assert.match(html, /Venue photos/);
  assert.doesNotMatch(html, /Day 7|Our memory|route group|No linked trip|data-show-place-tab="reviews"|pp-trip-photos/);
  f.click('', {showPlaceTab:'reviews'});
  assert.equal(f.node('#place-reviews-dialog').open, false, 'A saved, unreviewed place never opens an empty review modal');
  f.controller.close();f.flush();f.controller.open();
  assert.equal(f.history.state.atlasPlaces.scopeChoice, 'all', 'See all places is an explicit remembered scope choice');
});

test('a manually linked trip-photo thumbnail opens the ordered linked collection directly', () => {
  const photos = [{id:'a', alt:'Accessibility description'}, {id:'b'}, {id:'unlinked'}];
  const f = placeHistoryFixture({photos});
  f.setJourney({...f.journey, pointsOfInterest:[{...f.journey.pointsOfInterest[0], photoIds:['b','a']}]});
  f.controller.openPlace('cafe');
  assert.match(f.node('#places-content').innerHTML, /data-trip-photo="b"/);
  assert.doesNotMatch(f.node('#places-content').innerHTML, /data-trip-photo="unlinked"/);
  f.click('', {tripPhoto:'a'});
  assert.equal(f.controller.isOpen(), false);
  assert.equal(f.openedPhotos.length, 1);
  assert.equal(f.openedPhotos[0].id, 'a');
  assert.deepEqual(Array.from(f.openedPhotos[0].options.photos, photo=>photo.id), ['b','a']);
  assert.equal(f.openedPhotos[0].options.collectionLabel, 'A café');
});

test('Places respects the visible itinerary when TBD stops are excluded', () => {
  const f = placeHistoryFixture({visibleDayIds:['one']});
  const point = f.journey.pointsOfInterest[0];
  f.setJourney({...f.journey, pointsOfInterest:[point,{...point,id:'tbd',name:'Later city',dayIds:['two']}]});
  f.controller.open();
  assert.doesNotMatch(f.node('#places-content').innerHTML, /Later city/);
  assert.equal(f.node('#places-all-count').textContent, '1');
});

test('changing the event closes a Places cluster chooser even when the Places panel is hidden', () => {
  const f=placeHistoryFixture({cameraReady:true,scope:'day',interactiveMap:true});
  const original=f.journey.pointsOfInterest[0];
  f.setJourney({...f.journey,pointsOfInterest:[original,{...original,id:'neighbor'}]});f.flushFrames();
  f.pinButtons.at(-1).fire('click',{stopPropagation(){}});
  assert.equal(f.controller.isOpen(),false);
  assert.equal(f.popups.at(-1).open,true);
  f.controller.dayChanged();
  assert.equal(f.popups.at(-1).open,false,'Close the transient chooser synchronously, before the active event changes');
  assert.equal(f.cameraJumps.length,0);
});

test('map movement dismisses a Places cluster chooser without waiting for moveend', () => {
  const f=placeHistoryFixture({cameraReady:true,scope:'day',interactiveMap:true});
  const original=f.journey.pointsOfInterest[0];
  f.setJourney({...f.journey,pointsOfInterest:[original,{...original,id:'neighbor'}]});f.flushFrames();
  f.pinButtons.at(-1).fire('click',{stopPropagation(){}});
  assert.equal(f.popups.at(-1).open,true);
  f.mapEvent('movestart');
  assert.equal(f.popups.at(-1).open,false);
});

test('opening photos dismisses a Places cluster chooser even when the panel is hidden', () => {
  const f=placeHistoryFixture({cameraReady:true,scope:'day',interactiveMap:true});
  const original=f.journey.pointsOfInterest[0];
  f.setJourney({...f.journey,pointsOfInterest:[original,{...original,id:'neighbor'}]});f.flushFrames();
  f.pinButtons.at(-1).fire('click',{stopPropagation(){}});
  assert.equal(f.popups.at(-1).open,true);
  f.controller.closeForPhotos();
  assert.equal(f.popups.at(-1).open,false);
  assert.equal(f.cameraJumps.length,0);
});

test('leaving a selected place closes its detail first without jumping back to the old camera', () => {
  const f=placeHistoryFixture({cameraReady:true});
  f.controller.openPlace('cafe');
  f.controller.dayChanged();
  assert.equal(f.controller.isOpen(),false);
  assert.equal(f.history.state.atlasPlaces.selectedId,'');
  assert.equal(f.history.state.atlasPlaces.open,false);
  assert.equal(f.cameraJumps.length,0,'Event navigation owns the next camera; closing Places must not replay its saved old camera');
  assert.equal(f.restoreCalls,0);
});

test('changing events cancels deferred Places camera work before and after its opening frame', () => {
  for (const finishOpeningFrame of [false, true]) {
    const f = placeHistoryFixture({cameraReady:true,scope:'day',interactiveMap:true});
    f.flushFrames(); f.controller.open();
    if (finishOpeningFrame) { f.flushFrame(); f.flushFrame(); }
    f.controller.dayChanged(); f.setDay('two'); f.controller.update(); f.flushFrames();
    assert.equal(f.cameraMoves.length,0,'Queued Places fitting cannot override the new event camera');
  }
});

test('selecting a place cancels a previously queued list fit', () => {
  const f = placeHistoryFixture({cameraReady:true,scope:'day',interactiveMap:true});
  f.flushFrames(); f.controller.open(); f.flushFrames();
  f.node('#places-fit').fire('click');
  f.click('', {placeId:'cafe'});
  const afterSelection = f.cameraMoves.length;
  f.flushFrames();
  assert.equal(f.cameraMoves.length,afterSelection,'The selected place remains in focus when an old results fit was queued');
});


test('returning from trip photos and reopening Places retain the detail scroll', () => {
  const f = placeHistoryFixture(); f.controller.openPlace('cafe');
  const content = f.node('#places-content');
  content.scrollTop = 287; content.fire('scroll', {});
  const detail = structuredClone(f.history.state);
  f.controller.closeForPhotos();
  f.history.pushState({...detail, atlasPlaces:{...detail.atlasPlaces, open:false, depth:0}});
  f.history.back(); f.flush();
  assert.equal(content.scrollTop, 287, 'Back from a photo retains the presenting detail position');
  f.controller.close(); f.flush(); f.controller.open();
  assert.equal(content.scrollTop, 287, 'Reopening the remembered detail retains its position');
});


test('an unchanged Places detail keeps its mounted contents through updates and photo returns', () => {
  const f = placeHistoryFixture(); f.controller.openPlace('cafe');
  const content = f.node('#places-content'); let replacements = 0, html = content.innerHTML;
  Object.defineProperty(content, 'innerHTML', {get:()=>html, set:value=>{html=value; replacements++;}});
  f.controller.update(); f.controller.closeForPhotos(); f.controller.open();
  assert.equal(replacements, 0, 'Keep expanded disclosures, images and detail nodes');
  f.journey.pointsOfInterest[0].summary = 'Updated owner guidance'; f.controller.update();
  assert.equal(replacements, 1, 'Real content changes still render');
  assert.match(content.innerHTML, /Updated owner guidance/);
  f.click('places-back-to-list'); f.flush(); f.click('', {placeId:'cafe'});
  assert.match(content.innerHTML, /place-detail-title/, 'A list-to-detail transition still builds the detail');
});


test('Places Back and Forward retain the detail tab and its independent scroll positions',()=>{
  const f=placeHistoryFixture();f.controller.open();f.click('',{placeId:'cafe'});
  const content=f.node('#places-content');content.scrollTop=187;content.fire('scroll',{});
  f.click('',{placeTab:'photos'});content.scrollTop=419;content.fire('scroll',{});
  f.history.back();f.flush();assert.equal(f.history.state.atlasPlaces.selectedId,'');
  f.history.go(1);f.flush();assert.equal(f.history.state.atlasPlaces.tab,'photos');
  assert.equal(content.scrollTop,419);
  f.click('',{placeTab:'overview'});assert.equal(content.scrollTop,187);
});


test('phone Places opens its list and automatic camera fits never collapse the reading sheet', () => {
  const f = placeHistoryFixture({ mobile:true, cameraReady:true, interactiveMap:true, scope:'day' });
  f.flushFrames(); f.controller.open(); f.flushFrames();
  assert.equal(f.node('#places-panel').dataset.expanded, 'true');
  assert.equal(f.node('#places-sheet-label').textContent, 'Show map');
  assert.match(f.node('#places-content').innerHTML, /A café/);
  f.click('', {placeScope:'all'}); f.flushFrames();
  assert.equal(f.node('#places-panel').dataset.expanded, 'true');
  f.controller.mapReady(); f.flushFrames();
  assert.equal(f.node('#places-panel').dataset.expanded, 'true', 'Late map readiness must not hide results');
  f.node('#places-sheet-toggle').fire('click');
  assert.equal(f.node('#places-panel').dataset.expanded, 'false', 'Only the deliberate map action contracts the sheet');
  assert.equal(f.node('#places-sheet-label').textContent, 'Show list');
  f.click('', {placeId:'cafe'});
  assert.equal(f.node('#places-panel').dataset.expanded, 'true', 'A compact result opens readable details');
  f.history.back(); f.flush();
  assert.equal(f.node('#places-panel').dataset.expanded, 'true');
  f.node('#places-sheet-toggle').fire('click');
  f.controller.close(); f.flush(); f.controller.open(); f.flushFrames();
  assert.equal(f.node('#places-panel').dataset.expanded, 'true', 'Reopening never inherits a controls-only compact state');
});

test('phone category disclosure preserves filtering and returns space to results after selection', () => {
  const f = placeHistoryFixture({mobile:true}); f.controller.open();
  const target = f.node('#places-filter-toggle'); target.id = 'places-filter-toggle';
  // Exercise the delegated handler with the real control attributes.
  target.dataset = {}; target.closest = () => target; target.hasAttribute = () => false;
  f.node('#places-panel').fire('click', {target});
  assert.equal(target['aria-expanded'], 'true');
  assert.equal(f.node('#places-panel').dataset.filtersOpen, 'true');
  f.click('', {placeFilter:'sight'});
  assert.equal(target['aria-expanded'], 'false');
  assert.equal(target.textContent, 'Filters · 1');
  assert.match(f.node('#places-content').innerHTML, /No places found/);
  f.click('', {}, ['data-clear-filters']);
  assert.match(f.node('#places-content').innerHTML, /A café/);
  assert.equal(target.textContent, 'Filters');
});
