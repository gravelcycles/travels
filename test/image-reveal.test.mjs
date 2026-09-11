import test from 'node:test';
import assert from 'node:assert/strict';
import '../dist/assets/atlas-utils.js';

class ImageElement extends EventTarget {
  constructor(src = 'https://example.com/photo.webp') {
    super();
    Object.assign(this, { src, currentSrc: src, complete: true, naturalWidth: 1200, isConnected: true, dataset: {}, animations: [] });
    const classes = new Set();
    this.classList = { contains: name => classes.has(name), add: name => classes.add(name) };
  }
  getAttribute(name) { return name === 'src' ? this.src : null; }
  getClientRects() { return this.isConnected ? [{}] : []; }
  animate(frames, options) {
    const animation = { frames, options, cancelled: false, cancel() { this.cancelled = true; } };
    this.animations.push(animation);
    return animation;
  }
}
function fixture(enabled = true) {
  const targets = new Set();
  let intersection;
  const media = new EventTarget(); media.matches = enabled;
  const env = { queueMicrotask, matchMedia: query => {
    assert.equal(query, '(min-width: 901px) and (prefers-reduced-motion: no-preference)');
    return media;
  }, IntersectionObserver: class {
    constructor(callback) { intersection = callback; }
    observe(image) { targets.add(image); }
    unobserve(image) { targets.delete(image); }
  } };
  const controller = globalThis.JOURNEY_ATLAS_UTILS.createImageReveals(env);
  return { ...controller, targets, show: (image, visible = true) => intersection([{ target: image, isIntersecting: visible }]),
    enable(value) { media.matches = value; media.dispatchEvent(new Event('change')); } };
}
const container = (...images) => ({ querySelectorAll: () => images });
const settle = () => new Promise(resolve => queueMicrotask(resolve));

test('cached desktop images reveal on appearance and cached viewer selections restart without reloading', async () => {
  const f = fixture(), image = new ImageElement();
  image.dataset.photoState = 'ready'; image.dataset.photoReveal = 'instant';
  f.prepare(container(image));
  assert.equal(image.animations.length, 0, 'Wait until a cached image is visible');
  f.show(image);
  assert.equal(image.animations.length, 1);
  assert.equal(image.dataset.imageRevealing, 'true', 'The preview covers the foreground fade');
  assert.deepEqual(image.animations[0].frames, [{ opacity: 0, filter: 'blur(16px)' }, { opacity: 1, filter: 'blur(0px)' }]);
  assert.equal(image.animations[0].options.duration, 650);
  image.dispatchEvent(new Event('load')); image.dispatchEvent(new Event('atlas-photo-state'));
  f.prepare(container(image)); await settle();
  assert.equal(image.animations.length, 1, 'Duplicate ready events do not restart a reveal');
  f.reset(image);
  image.dispatchEvent(new Event('atlas-photo-state')); await settle();
  assert.equal(image.animations.length, 2);
  assert.equal(image.animations[0].cancelled, true);
  assert.equal(image.src, 'https://example.com/photo.webp', 'Reveals never replace or refetch the source');
  image.animations[1].onfinish();
  assert.equal(image.dataset.imageRevealing, undefined, 'The preview disappears when the actual animation finishes');
});

test('protected images wait for decoded readiness and never animate locked or failed placeholders', async () => {
  const f = fixture(), image = new ImageElement('data:image/webp;base64,placeholder');
  image.dataset.privateSrc = '/private-photos/full.webp'; image.dataset.photoState = 'locked';
  f.prepare(container(image)); f.show(image);
  for (const state of ['locked', 'loading', 'error']) {
    image.dataset.photoState = state; image.dispatchEvent(new Event('load')); await settle();
    assert.equal(image.animations.length, 0);
    assert.equal(image.dataset.imageRevealing, undefined);
  }
  image.src = image.currentSrc = 'blob:decoded-photo'; image.dataset.photoState = 'ready'; image.complete = false;
  image.dispatchEvent(new Event('atlas-photo-state')); await settle();
  assert.equal(image.animations.length, 0);
  image.complete = true; image.dispatchEvent(new Event('load')); await settle();
  assert.equal(image.animations.length, 1);
  image.dataset.photoState = 'locked'; image.dispatchEvent(new Event('atlas-photo-state')); await settle();
  assert.equal(image.animations[0].cancelled, true);
});

test('progressive and plain images reveal after load, including readiness set by a later load handler', async () => {
  const f = fixture(), progressive = new ImageElement(), plain = new ImageElement();
  progressive.dataset.src = progressive.src; progressive.classList.add('progressive-image');
  plain.complete = false;
  f.prepare(container(progressive, plain)); f.show(progressive); f.show(plain);
  assert.equal(progressive.animations.length + plain.animations.length, 0);
  delete progressive.dataset.src;
  progressive.dispatchEvent(new Event('load'));
  progressive.classList.add('is-loaded');
  plain.complete = true; plain.dispatchEvent(new Event('load')); await settle();
  assert.equal(progressive.animations.length, 1); assert.equal(plain.animations.length, 1);
});

test('cached images reveal again after re-entry, while removed images release observers and queued events', async () => {
  const f = fixture(), image = new ImageElement();
  f.prepare(container(image)); f.show(image); f.show(image, false);
  assert.equal(image.animations[0].cancelled, true);
  f.show(image); assert.equal(image.animations.length, 2);
  image.dispatchEvent(new Event('load'));
  image.isConnected = false; f.prepare(container()); await settle();
  assert.equal(f.targets.size, 0); assert.equal(image.animations[1].cancelled, true);
  assert.equal(image.animations.length, 2);
});

test('phone widths and reduced motion skip the desktop reveal and cancel an in-progress effect', () => {
  const f = fixture(false), image = new ImageElement();
  f.prepare(container(image)); f.show(image); assert.equal(image.animations.length, 0);
  f.enable(true); assert.equal(image.animations.length, 1);
  f.enable(false); assert.equal(image.animations[0].cancelled, true);
  assert.equal(image.dataset.imageRevealing, undefined, 'Reduced motion clears the reveal backdrop immediately');
  f.reset(image); f.prepare(container(image)); assert.equal(image.animations.length, 1);
});

test('fast selection changes cannot reveal stale loading images or let an old completion clear a new animation', async () => {
  const f = fixture(), image = new ImageElement();
  f.prepare(container(image)); f.show(image);
  const first = image.animations[0];
  f.reset(image); image.dataset.photoState = 'loading';
  image.dispatchEvent(new Event('load')); await settle();
  assert.equal(image.animations.length, 1);
  image.src = image.currentSrc = 'https://example.com/next.webp'; image.dataset.photoState = 'ready';
  image.dispatchEvent(new Event('atlas-photo-state')); await settle();
  assert.equal(image.animations.length, 2);
  first.onfinish();
  assert.equal(image.dataset.imageRevealing, 'true', 'A stale completion cannot remove the new photo preview');
  f.reset(image); assert.equal(image.animations[1].cancelled, true);
  assert.equal(image.dataset.imageRevealing, undefined, 'Navigation cancels the old preview along with its animation');
});

test('external animation cancellation releases its preview without replaying a settled source', () => {
  const f = fixture(), image = new ImageElement();
  f.prepare(container(image)); f.show(image);
  image.animations[0].oncancel();
  assert.equal(image.dataset.imageRevealing, undefined);
  f.prepare(container(image));
  assert.equal(image.animations.length, 1);
});
