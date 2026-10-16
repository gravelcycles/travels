import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import '../dist/assets/photo-zoom.js';
const {focalZoom, panLimit, maxScale, clampTransform} = globalThis.JourneyPhotoZoom;
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} should equal ${b}`);

function fixture({mobile = false, reducedMotion = false} = {}) {
  const events = new Map(), frames = new Map(), queries = new Map();
  let now = 0, nextFrame = 0, resize;
  function node() { return {dataset: {}, style: {}, hidden: false, handlers: new Map(),
    addEventListener(type, handler) { this.handlers.set(type, handler); },
    closest() { return null; }, setPointerCapture() {},
    getAttribute(name) { return this[name]; }}; }
  const frame = node(), image = node(), dialog = node(), viewer = node();
  Object.assign(frame, {clientWidth: 1000, clientHeight: 800, getBoundingClientRect: () => ({left: 100, top: 50, width: frame.clientWidth, height: frame.clientHeight})});
  Object.assign(image, {width: 1250, height: 1000}); dialog.open = true; viewer.dataset.mediaType = 'photo';
  const root = {matchMedia(query) { const result = {matches: query.includes('901') ? !mobile : reducedMotion, addEventListener(_type, fn) { this.changed = fn; }}; queries.set(query, result); return result; },
    addEventListener(type, handler) { events.set(type, handler); }, performance: {now: () => now},
    requestAnimationFrame(fn) { frames.set(++nextFrame, fn); return nextFrame; }, cancelAnimationFrame(id) { frames.delete(id); },
    ResizeObserver: class {constructor(fn) { resize = fn; } observe() {}}};
  const context = vm.createContext({window: root});
  vm.runInContext(fs.readFileSync(new URL('../dist/assets/photo-zoom.js', import.meta.url), 'utf8'), context);
  const swipes = [], controller = root.JourneyPhotoZoom.createController({dialog, frame, image, viewer, onSwipe: step => swipes.push(step)});
  controller.setPhoto({id: 'a'});
  function send(type, detail = {}, targetNode = frame) {
    const event = {type, target: frame, pointerId: 1, button: 0, clientX: 600, clientY: 450,
      deltaX: 0, deltaY: 0, deltaMode: 0, preventDefault() { this.prevented = true; }, ...detail};
    targetNode.handlers.get(type)?.(event); return event;
  }
  return {controller, frame, image, dialog, viewer, swipes, send,
    tick(ms = 200) { now += ms; const tasks = [...frames.values()]; frames.clear(); tasks.forEach(task => task(now)); },
    resize() { events.get('resize')(); }, observeResize() { resize(); },
    mobile(value) { const query = queries.get('(min-width: 901px)'); query.matches = !value; query.changed(); },
    blur() { events.get('blur')(); }};
}

function imagePixel(state, point) { return {x: (point.x - state.x) / state.scale, y: (point.y - state.y) / state.scale}; }
function assertSamePixel(before, fromPoint, after, toPoint = fromPoint) {
  const a = imagePixel(before, fromPoint), b = imagePixel(after, toPoint); near(a.x, b.x); near(a.y, b.y);
}

test('focal zoom preserves the pixel under an off-center cursor from an already panned image', () => {
  const state = {scale: 2, x: -75, y: 50}, focus = {x: 130, y: -120};
  assertSamePixel(state, focus, focalZoom(state, 3.5, focus));
});

test('pinch zoom follows both scale and the moving midpoint', () => {
  const state = {scale: 1.5, x: -25, y: 12}, from = {x: -100, y: 40}, to = {x: 20, y: 90};
  assertSamePixel(state, from, focalZoom(state, 2.7, from, to), to);
});

test('a same-scale moving pinch pans and zoom-out reverses the focal transform', () => {
  const state = {scale: 2, x: 30, y: -15}, from = {x: 60, y: 25}, to = {x: 80, y: -45};
  assert.deepEqual(focalZoom(state, 2, from, to), {scale: 2, x: 50, y: -85});
  const enlarged = focalZoom(state, 4, from);
  assert.deepEqual(focalZoom(enlarged, 2, from), state);
});

test('bounds use fitted image size and allow extreme panoramas to fill the viewport', () => {
  assert.equal(panLimit(200, 2, 800), 0);
  assert.deepEqual(clampTransform({scale: 2, x: 400, y: -500}, 1000, 200, 1000, 800), {scale: 2, x: 400, y: 0});
  assert.equal(maxScale(1000, 50, 1000, 800), 16);
  assert.equal(maxScale(1000, 800, 1000, 800), 8);
});

test('desktop trackpad pinch zooms at the cursor and ordinary wheel pans the enlarged photo', () => {
  const f = fixture(), focus = {x: 180, y: -100};
  const before = f.controller.state();
  const event = f.send('wheel', {ctrlKey: true, deltaY: -Math.log(2) / .01, clientX: 780, clientY: 350});
  assert.equal(event.prevented, true); near(f.controller.state().scale, 2);
  assertSamePixel(before, focus, f.controller.state());
  const x = f.controller.state().x;
  f.send('wheel', {deltaX: 40, deltaY: 10}); near(f.controller.state().x, x - 40);
  assert.equal(f.swipes.length, 0);
});

test('ordinary wheel and browser zoom outside an active still photo remain native', () => {
  const f = fixture();
  assert.equal(f.send('wheel', {deltaY: 100}).prevented, undefined);
  f.dialog.open = false;
  assert.equal(f.send('wheel', {ctrlKey: true, deltaY: -50}).prevented, undefined);
  f.dialog.open = true; f.viewer.dataset.mediaType = 'video';
  assert.equal(f.send('wheel', {ctrlKey: true, deltaY: -50}).prevented, undefined);
  f.viewer.dataset.mediaType = 'photo';
  const button = {closest: () => ({})};
  assert.equal(f.send('wheel', {ctrlKey: true, deltaY: -50, target: button}).prevented, undefined);
  near(f.controller.state().scale, 1);
});

test('desktop pointer pinch retains a moving focal point and never advances the photo', () => {
  const f = fixture(), start = f.controller.state(), from = {x: 100, y: -50};
  f.send('pointerdown', {pointerId: 1, clientX: 650, clientY: 400});
  f.send('pointerdown', {pointerId: 2, clientX: 750, clientY: 400});
  f.send('pointermove', {pointerId: 1, clientX: 630, clientY: 420});
  f.send('pointermove', {pointerId: 2, clientX: 830, clientY: 420});
  assertSamePixel(start, from, f.controller.state(), {x: 130, y: -30});
  near(f.controller.state().scale, 2);
  f.send('pointerup', {pointerId: 2, clientX: 830, clientY: 420});
  f.send('pointermove', {pointerId: 1, clientX: 900, clientY: 420});
  f.send('pointerup', {pointerId: 1, clientX: 900, clientY: 420});
  assert.deepEqual(f.swipes, []);
});

test('one-finger desktop drag pans a zoomed image and keeps edges bounded', () => {
  const f = fixture({reducedMotion: true}); f.send('dblclick');
  f.send('pointerdown'); f.send('pointermove', {clientX: 10000, clientY: -10000});
  near(f.controller.state().x, 750); near(f.controller.state().y, -600);
  f.send('pointerup', {clientX: 10000, clientY: -10000});
  assert.deepEqual(f.swipes, []); assert.equal(f.viewer.dataset.desktopPanning, undefined);
});

test('unzoomed desktop horizontal swipes still browse; vertical and canceled drags do not', () => {
  const f = fixture();
  f.send('pointerdown'); f.send('pointerup', {clientX: 480});
  assert.deepEqual(f.swipes, [1]);
  f.send('pointerdown'); f.send('pointerup', {clientX: 480, clientY: 700});
  f.send('pointerdown'); f.send('pointercancel', {clientX: 480});
  assert.deepEqual(f.swipes, [1]);
});

test('Safari gesture events use their moving center without double-applying wheel zoom', () => {
  const f = fixture(), start = f.controller.state(), focus = {x: 100, y: 30};
  f.send('gesturestart', {scale: 1, clientX: 700, clientY: 480});
  f.send('wheel', {ctrlKey: true, deltaY: -70}); near(f.controller.state().scale, 1);
  f.send('gesturechange', {scale: 2, clientX: 720, clientY: 500});
  assertSamePixel(start, focus, f.controller.state(), {x: 120, y: 50}); near(f.controller.state().scale, 2);
  f.send('gestureend');
  f.send('wheel', {ctrlKey: true, deltaY: -Math.log(1.5) / .01}); near(f.controller.state().scale, 3);
});

test('double-click animates focal zoom, a second restores the whole photo, and new input interrupts', () => {
  const f = fixture(), focus = {x: 100, y: -50};
  f.send('dblclick', {clientX: 700, clientY: 400}); f.tick(90);
  assert.ok(f.controller.state().scale > 1 && f.controller.state().scale < 2.5);
  assertSamePixel({scale: 1, x: 0, y: 0}, focus, f.controller.state());
  f.tick(100); near(f.controller.state().scale, 2.5);
  f.send('dblclick'); f.tick(); near(f.controller.state().scale, 1);
  f.send('dblclick'); f.tick(50); const partial = f.controller.state().scale;
  f.send('pointerdown'); f.tick(); near(f.controller.state().scale, partial);
});

test('selection, close, resize and failed access reset zoom and cancel queued animations', () => {
  const f = fixture();
  for (const reset of [() => f.controller.setPhoto({id: 'b'}), () => { f.dialog.open = false; f.send('close', {}, f.dialog); f.dialog.open = true; }, () => f.resize(), () => { f.image.dataset.photoState = 'locked'; f.send('atlas-photo-state', {}, f.image); }]) {
    f.send('dblclick'); f.tick(50); reset(); f.tick(); near(f.controller.state().scale, 1); assert.equal(f.image.style.transform, '');
  }
});

test('unchanged selection preserves zoom and a desktop-to-mobile change releases its transform', () => {
  const f = fixture({reducedMotion: true}); f.send('dblclick'); f.controller.setPhoto({id: 'a'});
  near(f.controller.state().scale, 2.5); f.mobile(true); near(f.controller.state().scale, 1);
  assert.equal(f.image.style.transform, '');
  f.image.style.transform = 'mobile-owned'; f.controller.setPhoto({id: 'c'}); f.resize();
  assert.equal(f.image.style.transform, 'mobile-owned');
  assert.equal(f.send('wheel', {ctrlKey: true, deltaY: -80}).prevented, undefined);
});


test('double-click fills the frame even for a very wide panorama', () => {
  const f = fixture({reducedMotion: true}); f.image.width = 20000; f.image.height = 1000;
  f.send('dblclick'); near(f.controller.state().scale, 16);
});

test('desktop reset never erases a mobile transform painted before its breakpoint callback', () => {
  const f = fixture({reducedMotion: true}); f.send('dblclick');
  f.image.style.transform = 'translate3d(12px,34px,0) scale(3)';
  f.mobile(true);
  assert.equal(f.image.style.transform, 'translate3d(12px,34px,0) scale(3)');
  f.resize(); assert.equal(f.image.style.transform, 'translate3d(12px,34px,0) scale(3)');
});
