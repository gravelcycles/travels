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

test('an interrupted release follows the visible position through a reverse drag and commit', () => {
  const f = cachedFixture(); f.api.openDay(); f.drag('.photo-stage',-150,0); f.frame();
  const image = f.node('#modal-photo'), stage = f.node('.photo-stage');
  image.computedTransform = 'matrix(1, 0, 0, 1, 53.0267, 0)';
  f.dispatch('.photo-stage','pointerdown',{clientX:100,clientY:300});
  assert.match(image.style.transform,/^translate3d\(53\.0267px/);
  assert.equal(stage.style['--photo-swipe-x'],'53.0267px');
  assert.equal(f.neighbors[0].style.transform,'translate3d(-352.9733px,0,0)');
  f.dispatch('.photo-stage','pointermove',{clientX:140,clientY:300}); f.frame();
  assert.match(image.style.transform,/^translate3d\(93\.0267px/,'The next movement adds only the finger delta');
  f.dispatch('.photo-stage','pointermove',{clientX:250,clientY:300}); f.frame();
  f.dispatch('.photo-stage','pointerup',{clientX:250,clientY:300});
  assert.equal(f.node('#mobile-photo-count').textContent,'1 of 4');
  assert.match(image.style.transform,/^translate3d\(-202\.9733px/,'The outgoing position survives the selection change');
  f.frame(); assert.match(image.style.transform,/^translate3d\(0px/);
});

test('interrupted taps and cancelled drags settle without changing selection or stranding the photo', () => {
  for (const end of ['pointerup','pointercancel','lostpointercapture']) {
    for (const move of [false,true]) {
      const f = cachedFixture(); f.api.openDay(); f.drag('.photo-stage',-150,0); f.frame();
      const image = f.node('#modal-photo');
      image.computedTransform = 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,53,0,0,1)';
      f.dispatch('.photo-stage','pointerdown',{clientX:200,clientY:300});
      if (move) { f.dispatch('.photo-stage','pointermove',{clientX:220,clientY:300}); f.frame(); }
      f.dispatch('.photo-stage',end,{clientX:move ? 220 : 200,clientY:300});
      assert.equal(f.node('#mobile-photo-count').textContent,'2 of 4',end);
      assert.match(image.style.transform,new RegExp(`^translate3d\\(${move ? 73 : 53}px`),end);
      f.frame(); assert.match(image.style.transform,/^translate3d\(0px/,end);
      f.flush(); assert.equal(f.node('.photo-viewer').classList.contains('is-swipe-settling'),false,end);
    }
  }
});

test('touch before the first settle frame preserves the release position, and pinch can take over it', () => {
  const f = cachedFixture(); f.api.openDay(); f.drag('.photo-stage',-150,0);
  const image = f.node('#modal-photo');
  f.dispatch('.photo-stage','pointerdown',{pointerId:1,clientX:100,clientY:300});
  assert.match(image.style.transform,/^translate3d\(256px/);
  f.frame(); assert.match(image.style.transform,/^translate3d\(256px/,'The canceled settle frame cannot snap to zero');
  f.dispatch('.photo-stage','pointerdown',{pointerId:2,clientX:200,clientY:300});
  assert.match(image.style.transform,/^translate3d\(256px/,'Pinch takes ownership without a pointer-down jump');
  f.dispatch('.photo-stage','pointermove',{pointerId:2,clientX:300,clientY:300});
  assert.match(image.style.transform,/scale\(2\)/);
  f.dispatch('.photo-stage','pointercancel',{pointerId:2}); f.flush();
  assert.equal(f.node('#mobile-photo-count').textContent,'2 of 4');
});

test('fitted selection resets pan without measuring image bounds, including a not-yet-decoded photo', () => {
  for (const [width,height] of [[390,844],[844,390]]) {
    const f = cachedFixture({width,height}); f.api.openDay();
    f.click('.photo-stage'); f.click('.photo-stage'); f.flush(320);
    assert.equal(f.node('.photo-viewer').dataset.zoomed,'true');
    const stage = f.node('.photo-stage'); let widthReads = 0, heightReads = 0;
    Object.defineProperty(stage,'clientWidth',{get(){widthReads++;return width;}});
    Object.defineProperty(stage,'clientHeight',{get(){heightReads++;return height;}});
    f.node('#modal-photo').naturalWidth = f.node('#modal-photo').naturalHeight = 0;
    f.api.selectPhoto(1);
    assert.equal(f.node('#modal-photo').style.transform,'translate3d(0px,0px,0) scale(1)');
    assert.equal(f.node('.photo-viewer').dataset.zoomed,'false');
    assert.equal(heightReads,0,'Fitted resets do not need vertical pan bounds');
    assert.equal(widthReads,3,'Only the three transform placements need the stage width');
  }
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

test('pinch takes over a queued swipe, and late neighbor readiness preserves focal zoom and hidden controls', () => {
  const f = cachedFixture(); f.api.openDay();
  f.click('.photo-stage'); f.flush(300);
  assert.equal(f.node('.photo-viewer').dataset.chrome,'false');
  f.node('#modal-photo').naturalHeight = 1200;
  const touch = (type, pointerId, clientX, clientY) => f.dispatch('.photo-stage',type,{pointerId,clientX,clientY,pointerType:'touch'});
  touch('pointerdown',1,180,353); touch('pointermove',1,150,353);
  touch('pointerdown',2,250,353);
  touch('pointermove',1,120,363); touch('pointermove',2,320,363);
  const zoom = f.node('#modal-photo').style.transform;
  assert.match(zoom,/scale\(2\)/);
  f.cached.add('p1'); f.dispatch('atlas-photo-cache-ready'); f.frame();
  assert.equal(f.neighbors[1].src,'blob:p1');
  assert.equal(f.node('#modal-photo').style.transform,zoom,'No queued swipe frame or readiness update resets the focal zoom');
  touch('pointerup',1,120,363); touch('pointerup',2,320,363); f.flush(400);
  assert.equal(f.node('.photo-viewer').dataset.chrome,'false');
  assert.equal(f.node('#mobile-photo-count').textContent,'1 of 4');
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
