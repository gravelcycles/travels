import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import '../dist/assets/photo-comments.js';

const { bindDismissGesture } = globalThis.JOURNEY_ATLAS_PHOTO_COMMENTS;
function element() {
  const events = new Map(), properties = new Map(), captures = new Set();
  return {
    open: true, dataset: {}, hidden: false, value: '', scrollHeight: 58,
    style: { setProperty: (key, value) => properties.set(key, value), removeProperty: key => properties.delete(key), getPropertyValue: key => properties.get(key) || '' },
    addEventListener(type, fn) { const list = events.get(type) || []; list.push(fn); events.set(type, list); },
    emit(type, event = {}) { for (const fn of events.get(type) || []) fn(event); },
    setPointerCapture: id => captures.add(id), hasPointerCapture: id => captures.has(id), releasePointerCapture: id => captures.delete(id),
    setAttribute(name, value) { this[name] = value; }, removeAttribute(name) { delete this[name]; },
    getBoundingClientRect: () => ({ height: 500 }), closest: () => null,
    querySelectorAll: () => [], focus() {}, contains: () => false,
    showModal() { this.open = true; }, close() { this.open = false; this.emit('close'); }
  };
}
function dragFixture() {
  const surface = element(), heading = element(); let closes = 0;
  bindDismissGesture(surface, heading, () => { closes++; surface.close(); });
  const point = (type, x, y, extra = {}) => {
    const event = { pointerId: 1, isPrimary: true, button: 0, clientX: x, clientY: y, target: heading, preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; }, ...extra };
    heading.emit(type, event); return event;
  };
  return { surface, heading, point, closes: () => closes };
}
test('heading drag follows the pointer and dismisses only after deliberate downward travel', () => {
  const f = dragFixture();
  f.point('pointerdown', 100, 100);
  assert.equal(f.point('pointermove', 102, 104).prevented, undefined);
  assert.equal(f.surface.style.getPropertyValue('--comments-drag-y'), '');
  assert.equal(f.point('pointermove', 102, 210).prevented, true);
  assert.equal(f.surface.style.getPropertyValue('--comments-drag-y'), '110px');
  f.point('pointerup', 102, 210);
  assert.equal(f.closes(), 1);
  assert.equal(f.surface.open, false);
  assert.equal(f.surface.style.getPropertyValue('--comments-drag-y'), '');
  assert.equal(f.surface.dataset.dragging, undefined);
});
test('short drags, reversing a drag and pointer cancellation restore the sheet without closing', () => {
  for (const mode of ['short', 'reverse', 'cancel']) {
    const f = dragFixture(); f.point('pointerdown', 100, 100);
    f.point('pointermove', 100, mode === 'short' ? 140 : 250);
    if (mode === 'reverse') f.point('pointermove', 100, 110);
    f.point(mode === 'cancel' ? 'pointercancel' : 'pointerup', 100, 110);
    assert.equal(f.closes(), 0, mode);
    assert.equal(f.surface.style.getPropertyValue('--comments-drag-y'), '', mode);
    assert.equal(f.surface.dataset.dragging, undefined, mode);
  }
});
test('the whole header tolerates sideways or upward thumb wobble before a downward touch drag', () => {
  for (const [x, y] of [[160, 105], [100, 60]]) {
    const f = dragFixture(); f.point('pointerdown', 100, 100, { pointerType: 'touch' });
    f.point('pointermove', x, y); f.point('pointermove', 120, 170);
    assert.equal(f.surface.dataset.dragging, 'true');
    f.point('pointerup', 125, 182);
    assert.equal(f.closes(), 1, 'Release position completes an easy deliberate pull');
  }
  for (const [x, y] of [[160, 105], [100, 60]]) {
    const f = dragFixture(); f.point('pointerdown', 100, 100); f.point('pointermove', x, y); f.point('pointerup', x, y);
    assert.equal(f.closes(), 0, 'Horizontal or upward travel alone cannot dismiss');
  }
});
test('Close-origin drags work, moved drags suppress their click, and ordinary taps and keyboard actions remain available', () => {
  const button = element(); button.closest = () => button;
  for (const distance of [30, 90]) {
    const f = dragFixture();
    f.point('pointerdown', 100, 100, { target: button, pointerType: 'touch' });
    assert.equal(f.heading.hasPointerCapture(1), false, 'A resting tap must still target the button');
    f.point('pointermove', 110, 100 + distance);
    assert.equal(button.hasPointerCapture(1), true, 'Button capture keeps drag tracking beyond the header');
    f.point('pointerup', 110, 100 + distance);
    assert.equal(f.closes(), distance >= 80 ? 1 : 0);
    const generated = f.point('click', 110, 100 + distance, { detail: 1, target: button });
    assert.equal(generated.prevented, true);
    assert.equal(generated.stopped, true);
  }
  const f = dragFixture();
  f.point('pointerdown', 100, 100, { target: button }); f.point('pointermove', 100, 130); f.point('pointerup', 100, 130);
  assert.equal(f.point('click', 100, 130, { detail: 0, target: button }).prevented, undefined, 'Keyboard Close is never suppressed');
  f.point('pointerdown', 100, 100, { target: button }); f.point('pointerup', 100, 100);
  assert.equal(f.point('click', 100, 100, { detail: 1, target: button }).prevented, undefined, 'Next ordinary tap remains available');
});
test('horizontal, upward and cancelled button drags never become accidental Close taps', () => {
  for (const [x, y, end] of [[150, 100, 'pointerup'], [100, 50, 'pointerup'], [150, 100, 'pointercancel']]) {
    const f = dragFixture(), button = element(); button.closest = () => button;
    f.point('pointerdown', 100, 100, { target: button }); f.point('pointermove', x, y); f.point(end, x, y);
    assert.equal(f.closes(), 0);
    assert.equal(f.surface.style.getPropertyValue('--comments-drag-y'), '');
    const click = f.point('click', x, y, { target: button, detail: 1 });
    assert.equal(click.prevented, true);
    assert.equal(click.stopped, true);
  }
});
test('secondary pointers and nonprimary buttons cannot initiate a header dismissal', () => {
  for (const extra of [{ isPrimary: false }, { button: 2 }]) {
    const f = dragFixture(); f.point('pointerdown', 100, 100, extra); f.point('pointermove', 100, 300); f.point('pointerup', 100, 300);
    assert.equal(f.closes(), 0);
  }
});
test('another pointer or a history close cancels the active gesture without an extra dismissal', () => {
  for (const interrupt of [f => f.point('pointerdown', 50, 50, { pointerId: 2, isPrimary: false }), f => f.surface.close()]) {
    const f = dragFixture(); f.point('pointerdown', 100, 100); f.point('pointermove', 100, 250); interrupt(f); f.point('pointerup', 100, 250);
    assert.equal(f.closes(), 0);
    assert.equal(f.surface.style.getPropertyValue('--comments-drag-y'), '');
  }
});
test('a second finger in the thread or composer cancels the header drag without taking over that touch', () => {
  for (const id of ['comments-thread', 'comment-body']) {
    const f = dragFixture();
    f.point('pointerdown', 100, 100); f.point('pointermove', 100, 250);
    const touch = { pointerId: 2, isPrimary: false, target: { id }, preventDefault() { throw new Error('Body touch must remain native'); }, stopPropagation() { throw new Error('Body touch must remain native'); } };
    f.surface.emit('pointerdown', touch);
    assert.equal(f.surface.style.getPropertyValue('--comments-drag-y'), '');
    assert.equal(f.heading.hasPointerCapture(1), false);
    f.point('pointermove', 100, 300); f.point('pointerup', 100, 300);
    assert.equal(f.closes(), 0, id);
    assert.equal(f.surface.open, true);
    f.surface.emit('pointerdown', touch); // No active header drag: leave it alone.
  }
});

function conversationFixture({ fullscreen = true, known = true } = {}) {
  const nodes = new Map(), drafts = new Map(), imageRequests = [], dismissed = [], rootEvents = new Map();
  const node = selector => {
    if (!nodes.has(selector)) {
      const el = element(); el.open = false; el.id = selector.slice(1);
      el.querySelector = child => node(child.startsWith('.') ? child : `${selector} ${child}`);
      nodes.set(selector, el);
    }
    return nodes.get(selector);
  };
  const classes = new Set();
  const document = { querySelector: node, querySelectorAll: () => [], activeElement: null, addEventListener() {},
    body: { classList: { add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name) } }, documentElement: { style: element().style } };
  const photo = { id: 'picture', dayId: 'day', caption: 'Traveler caption', src: '/photo.jpg' };
  const store = {
    identity: { allowed: () => true, get: () => ({ id: 'visitor', name: 'Alex' }) },
    comments: () => known ? [{ id: 'one', photoId: photo.id, visitorId: 'other', displayName: 'Sam', body: 'A memory', createdAt: 1 }] : [],
    notificationSummary: () => ({ loaded: known, photos: { picture: { total: 3 } } }),
    hasLoaded: () => known, hasMore: () => false, fresh: () => true, subscribe() {}, profile: async () => {}, refresh: async () => {}, refreshSummary: async () => {},
    draft(key, value) { if (arguments.length > 1) drafts.set(key, value); return drafts.get(key); }
  };
  node('#photo-dialog').open = fullscreen;
  const window = { addEventListener(type, fn) { const handlers = rootEvents.get(type) || []; handlers.push(fn); rootEvents.set(type, handlers); }, JOURNEY_ATLAS_AUTH: { clearImage() {}, setImage: (...args) => imageRequests.push(args) },
    JOURNEY_ATLAS_MOBILE_UI: { presentOverlay: id => node(`#${id}`).showModal(), dismissOverlay(id) { dismissed.push(id); node(`#${id}`).close(); } } };
  const context = vm.createContext({ window, document, URL, URLSearchParams, location: { href: 'https://example.com/trip' }, innerHeight: 844, requestAnimationFrame: fn => fn(), MutationObserver: class { observe() {} } });
  vm.runInContext(fs.readFileSync(new URL('../dist/assets/photo-comments.js', import.meta.url), 'utf8'), context);
  const api = window.JOURNEY_ATLAS_PHOTO_COMMENTS.create({ live: true, store: () => store, unlocked: () => true, protected: () => true, journey: () => ({ id: 'trip' }), photos: () => [photo] });
  api.update(); api.photoChanged(photo);
  return { api, node, drafts, imageRequests, dismissed, resize: () => { for (const fn of rootEvents.get('resize') || []) fn(); } };
}
test('fullscreen comments omit repeated photograph context and thumbnail loading, keeping a concise exact count', async () => {
  const f = conversationFixture(); await f.api.open();
  assert.equal(f.node('#comments-title').textContent, 'Comments');
  assert.equal(f.node('.comments-photo-context').hidden, true);
  assert.equal(f.node('.comments-meta').hidden, true);
  assert.equal(f.node('#comments-heading-count').textContent, '3');
  assert.equal(f.node('#comments-heading-count').hidden, false);
  assert.equal(f.imageRequests.length, 0);
});
test('unknown fullscreen counts stay absent; a sidebar conversation retains photograph context and navigation', async () => {
  const unknown = conversationFixture({ known: false }); await unknown.api.open();
  assert.equal(unknown.node('#comments-heading-count').hidden, true);
  const context = conversationFixture({ fullscreen: false }); await context.api.open();
  assert.equal(context.node('.comments-photo-context').hidden, false);
  assert.equal(context.node('.comments-meta').hidden, false);
  assert.equal(context.node('#comments-photo-title').textContent, 'Traveler caption');
  assert.equal(context.node('#comments-photo-position').textContent, 'Photo 1 of 1');
  assert.equal(context.node('#comments-heading-count').hidden, true);
  assert.equal(context.imageRequests.length, 1);
});
test('drag dismissal uses the overlay history path and preserves both draft and underlying photograph', async () => {
  const f = conversationFixture(); await f.api.open();
  f.node('#comment-body').value = 'Unfinished thought';
  const heading = f.node('.comments-heading');
  const event = (y) => ({ pointerId: 1, isPrimary: true, button: 0, clientX: 10, clientY: y, target: heading, preventDefault() {} });
  heading.emit('pointerdown', event(10)); heading.emit('pointermove', event(130)); heading.emit('pointerup', event(130));
  assert.deepEqual(f.dismissed, ['comments-dialog']);
  assert.equal(f.node('#photo-dialog').open, true);
  assert.equal(f.drafts.get('photo-comment:picture'), 'Unfinished thought');
  await f.api.open();
  assert.equal(f.node('#comment-body').value, 'Unfinished thought');
});


test('a resize, photo change, new opening or nested name sheet invalidates a pending drag', async () => {
  for (const interrupt of [f => f.resize(), f => f.api.photoChanged({ id: 'second', dayId: 'day' }), f => f.api.open(), f => f.node('#comment-change-name').emit('click')]) {
    const f = conversationFixture(); await f.api.open();
    const heading = f.node('.comments-heading');
    const event = y => ({ pointerId: 1, isPrimary: true, button: 0, clientX: 10, clientY: y, target: heading, preventDefault() {} });
    heading.emit('pointerdown', event(10)); heading.emit('pointermove', event(140));
    await interrupt(f);
    heading.emit('pointerup', event(140));
    assert.deepEqual(f.dismissed, []);
    assert.equal(f.node('#comments-dialog').open, true);
    assert.equal(f.node('#comments-dialog').style.getPropertyValue('--comments-drag-y'), '');
    assert.equal(f.node('#comments-dialog').dataset.dragging, undefined);
  }
});
test('conversation scrolling and name-dialog returns keep the compact sheet, draft and photo', async () => {
  const f = conversationFixture(); await f.api.open();
  const list = f.node('#comments-list');
  const event = y => ({ pointerId: 1, isPrimary: true, button: 0, clientX: 10, clientY: y, target: list, preventDefault() { throw new Error('Conversation scrolling must stay native'); } });
  list.emit('pointerdown', event(10)); list.emit('pointermove', event(300)); list.emit('pointerup', event(300));
  assert.deepEqual(f.dismissed, []);
  f.node('#comment-body').value = 'Still writing'; f.node('#comment-body').emit('input');
  f.node('#comment-change-name').emit('click');
  assert.equal(f.node('#experience-unlock').open, true);
  f.node('#experience-unlock').close();
  assert.equal(f.node('#comments-dialog').open, true);
  assert.equal(f.node('#comments-dialog').dataset.presentation, 'photo');
  assert.equal(f.node('.comments-photo-context').hidden, true);
  assert.equal(f.node('#comment-body').value, 'Still writing');
  assert.equal(f.node('#photo-dialog').open, true);
});
