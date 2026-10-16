import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {viewerFixture} from './mobile-viewer-harness.mjs';
import {viewerFunction} from './viewer-flow-harness.mjs';

function cachedFixture(options = {}) {
  const photos = [0, 1, 2, 3].map(index => ({id:`p${index}`,dayId:'one',blur:`data:image/webp;base64,blur${index}`}));
  const f = viewerFixture({...options,journey:{days:[{id:'one',number:1,title:'One'}],photos}});
  const cached = new Set(), attempts = [], binds = [];
  f.api.loadImage = (node, photo) => {
    attempts.push(photo.id);
    if (!cached.has(photo.id)) return false;
    binds.push(photo.id); node.src = `blob:${photo.id}`; node.classList.add('is-loaded'); return true;
  };
  const neighbors = f.node('#viewer-photo-frame').children;
  return {...f,cached,attempts,binds,photos,neighbors};
}

test('a first-use neighbor gains cached full bytes before the first swipe without resetting ready pixels', () => {
  const f = cachedFixture(); f.api.openDay();
  assert.equal(f.neighbors[1].src, f.photos[1].blur);
  f.cached.add('p1'); f.dispatch('atlas-photo-cache-ready');
  assert.equal(f.neighbors[1].src, 'blob:p1');
  const count = f.attempts.length;
  f.dispatch('atlas-photo-cache-ready'); f.click('.photo-stage');
  assert.equal(f.attempts.length, count, 'An unrelated cache completion or tap does not rebind a ready neighbor');
  assert.deepEqual(f.binds, ['p1']);
});

test('a delayed neighbor fills during the drag without changing its position or the selected photo', () => {
  const f = cachedFixture(); f.api.openDay();
  const stage = f.node('.photo-stage'), event = {pointerId:1,button:0,clientX:220,clientY:300,target:stage,currentTarget:stage};
  stage.handlers.get('pointerdown')(event);
  stage.handlers.get('pointermove')({...event,clientX:100}); f.frame();
  assert.equal(f.neighbors[1].style.transform, 'translate3d(286px,0,0)');
  f.cached.add('p1'); f.dispatch('atlas-photo-cache-ready');
  assert.equal(f.neighbors[1].src, 'blob:p1');
  assert.equal(f.neighbors[1].style.transform, 'translate3d(286px,0,0)');
  assert.match(f.node('#modal-photo').style.transform, /^translate3d\(-120px/);
  stage.handlers.get('pointercancel')({...event,type:'pointercancel'}); f.flush();
  assert.equal(f.node('#mobile-photo-count').textContent, '1 of 4');
});

test('late cache notifications respect a changed selection, a grid, a closed viewer and desktop', () => {
  const f = cachedFixture(); f.api.openDay(); f.api.selectPhoto(2);
  f.cached.add('p1'); f.cached.add('p3'); f.dispatch('atlas-photo-cache-ready');
  assert.equal(f.neighbors[0].src, 'blob:p1'); assert.equal(f.neighbors[1].src, 'blob:p3');
  f.click('#mobile-photo-grid'); const count = f.attempts.length;
  f.dispatch('atlas-photo-cache-ready'); assert.equal(f.attempts.length, count);
  assert.ok(f.neighbors.every(node => node.hidden));
  f.node('#photo-dialog').close(); f.dispatch('atlas-photo-cache-ready'); assert.equal(f.attempts.length, count);
  f.resize(false); f.dispatch('atlas-photo-cache-ready'); assert.equal(f.attempts.length, count);
});

test('drag frames coalesce pointer updates and reuse the initial stage width', () => {
  const f = cachedFixture(); f.api.openDay();
  const stage = f.node('.photo-stage'), image = f.node('#modal-photo');
  let reads = 0, writes = 0, transform = image.style.transform;
  Object.defineProperty(stage, 'clientWidth', {get(){ reads++; return 390; }});
  Object.defineProperty(image.style, 'transform', {get(){return transform;},set(value){writes++; transform=value;}});
  const event = {pointerId:1,button:0,clientX:240,clientY:300,target:stage,currentTarget:stage};
  stage.handlers.get('pointerdown')(event);
  for (const clientX of [220, 180, 120]) stage.handlers.get('pointermove')({...event,clientX});
  assert.equal(writes, 0); assert.equal(reads, 1);
  f.frame(); assert.equal(writes, 1); assert.equal(reads, 1);
  assert.match(transform, /^translate3d\(-120px/);
  assert.equal(stage.style['--photo-swipe-x'], '-120px', 'The loading preview follows the same frame');
});

test('release preserves incoming and outgoing positions, including the cold preview', () => {
  const f = cachedFixture(); f.api.openDay(); f.drag('.photo-stage',-150,0);
  assert.equal(f.node('#mobile-photo-count').textContent, '2 of 4', 'Selection changes immediately');
  assert.match(f.node('#modal-photo').style.transform, /^translate3d\(256px/);
  assert.equal(f.neighbors[0].style.transform, 'translate3d(-150px,0,0)');
  assert.equal(f.node('.photo-stage').style['--photo-swipe-x'], '256px');
  f.frame();
  assert.match(f.node('#modal-photo').style.transform, /^translate3d\(0px/);
  assert.equal(f.node('.photo-viewer').classList.contains('is-swipe-settling'), true);
  f.drag('.photo-stage',150,0); f.flush();
  assert.equal(f.node('#mobile-photo-count').textContent, '1 of 4', 'A rapid reversal remains responsive');
});

test('reduced motion selects immediately and cancelling a queued frame cannot move a new photo', () => {
  const f = cachedFixture({reducedMotion:true}); f.api.openDay(); f.drag('.photo-stage',-150,0);
  assert.match(f.node('#modal-photo').style.transform, /^translate3d\(0px/);
  assert.equal(f.node('.photo-viewer').classList.contains('is-swipe-settling'), false);
  f.api.selectPhoto(3); f.flush();
  assert.equal(f.node('#mobile-photo-count').textContent, '4 of 4');
  assert.match(f.node('#modal-photo').style.transform, /^translate3d\(0px/);
});

test('resize, desktop and grid transitions cancel a queued drag before it can move another layout', () => {
  for (const transition of ['resize','desktop','grid']) {
    const f = cachedFixture(); f.api.openDay();
    const stage = f.node('.photo-stage'), event = {pointerId:1,button:0,clientX:240,clientY:300,target:stage,currentTarget:stage};
    stage.handlers.get('pointerdown')(event);
    stage.handlers.get('pointermove')({...event,clientX:100});
    if (transition === 'resize') f.dispatch('resize');
    else if (transition === 'desktop') f.resize(false);
    else f.click('#mobile-photo-grid');
    const transform = f.node('#modal-photo').style.transform;
    f.frame(); assert.equal(f.node('#modal-photo').style.transform, transform, transition);
    stage.handlers.get('pointerup')({...event,type:'pointerup',clientX:100});
    assert.equal(f.node('#mobile-photo-count').textContent,'1 of 4', transition);
  }
});

test('public preload readiness publishes the decoded full URL once without another request', async () => {
  let decoded; const images = [], events = [];
  const context = vm.createContext({window:{navigator:{},dispatchEvent:event=>events.push(event.type)},document:{hidden:false,baseURI:'https://example.test/trip/'},
    preloadedPhotoUrls:new Set(),decodedPhotoUrls:new Set(),preferredPhotoUrl:photo=>photo.src,URL,Event,
    Image:class { constructor(){images.push(this);} decode(){return new Promise(resolve=>{decoded=resolve;});} }});
  vm.runInContext(viewerFunction('preloadPhoto'),context);
  const photo = {src:'full.webp'};
  context.preloadPhoto(photo,Infinity); assert.equal(context.decodedPhotoUrls.size,0);
  decoded(); await Promise.resolve();
  assert.equal(context.decodedPhotoUrls.has('https://example.test/trip/full.webp'),true);
  assert.deepEqual(events,['atlas-photo-cache-ready']);
  context.preloadPhoto(photo,Infinity); assert.equal(images.length,1);
  images[0].complete=true;images[0].naturalWidth=1600;images[0].onload();
  assert.deepEqual(events,['atlas-photo-cache-ready']);
});
