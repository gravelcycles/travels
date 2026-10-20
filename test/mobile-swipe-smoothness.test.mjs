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

function preparedFixture(options = {}) {
  const f = cachedFixture(options), writes = new Map();
  const main = f.node('#modal-photo'), frame = f.node('#viewer-photo-frame');
  frame.children.unshift(main); main.parentElement = frame;
  for (const node of frame.children) {
    let src = node.src || '';
    Object.defineProperty(node,'src',{get:()=>src,set(value){src=value;writes.set(node,(writes.get(node)||0)+1);}});
    const remove = node.removeAttribute;
    node.removeAttribute = name => name === 'src' ? node.src = '' : remove.call(node,name);
  }
  const bind = (node,photo) => {
    const src = `blob:${photo.id}`;
    if (node.src !== src) node.src = src;
    node.dataset.photoState = 'ready'; node.complete = true; node.classList.add('is-loaded');
    return true;
  };
  f.api.loadImage = bind; f.api.openDay(); bind(main,f.photos[0]); writes.clear();
  return {...f,main,writes};
}

test('a ready incoming photo keeps its element and source through release and immediate reversal', () => {
  const f = preparedFixture(), nodes = [...f.node('#viewer-photo-frame').children];
  const incoming = nodes[2], outgoing = f.main;
  f.drag('.photo-stage',-150,0);
  assert.equal(f.node('#modal-photo'),incoming);
  assert.equal(incoming['aria-hidden'],undefined);
  assert.equal(outgoing['aria-hidden'],'true');
  assert.match(incoming.style.transform,/^translate3d\(256px/);
  assert.equal(outgoing.style.transform,'translate3d(-150px,0,0)');
  assert.equal(f.writes.get(incoming)||0,0,'Prepared pixels are never rebound at release');
  assert.equal(f.writes.get(outgoing)||0,0,'The reverse neighbor retains the old main pixels');
  assert.equal(nodes.filter(node=>node.id==='modal-photo').length,1);
  f.frame(); f.drag('.photo-stage',150,0);
  assert.equal(f.node('#modal-photo'),outgoing);
  assert.equal(f.writes.get(outgoing)||0,0);
  assert.equal(f.writes.get(incoming)||0,0);
  assert.deepEqual(f.node('#viewer-photo-frame').children,nodes,'The same three elements are retained');
  assert.equal(outgoing['aria-hidden'],undefined);
  assert.equal(incoming['aria-hidden'],'true');
  assert.equal(f.node('#mobile-photo-count').textContent,'1 of 4');
});

test('a loaded neighbor never starts a cold reveal while taking the selected role', () => {
  const f = preparedFixture(), incoming = f.node('#viewer-photo-frame').children[2];
  let id = incoming.id, promotions = 0;
  Object.defineProperty(incoming, 'id', {
    get: () => id,
    set(value) {
      if (value === 'modal-photo') {
        promotions++;
        assert.equal(incoming.dataset.photoReveal, 'instant',
          'Role changes can flush layout before the foreground loader runs');
      }
      id = value;
    }
  });
  assert.equal(incoming.dataset.photoState, 'ready');
  f.drag('.photo-stage', -150, 0);
  assert.equal(promotions, 1);
  assert.equal(f.node('#modal-photo'), incoming);
  assert.equal(f.writes.get(incoming) || 0, 0);
});

test('promotion requires a matching complete full still and leaves unready, stale and inactive slots alone', () => {
  for (const condition of ['loading','locked','error','incomplete','noPixels','differentSource','preview','hiddenGrid','desktop','closed','video','changedPhoto']) {
    const f=preparedFixture(), next=f.node('#viewer-photo-frame').children[2], photo=f.photos[1];
    if (['loading','locked','error'].includes(condition)) next.dataset.photoState=condition;
    if (condition==='incomplete') next.complete=false;
    if (condition==='noPixels') next.naturalWidth=0;
    if (condition==='differentSource') next.currentSrc='blob:stale';
    if (condition==='preview') next.src='data:image/webp;base64,preview';
    if (condition==='hiddenGrid') f.click('#mobile-photo-grid');
    if (condition==='desktop') f.resize(false);
    if (condition==='closed') f.node('#photo-dialog').open=false;
    if (condition==='video') photo.mediaType='video';
    assert.equal(f.controller.preparePhoto(condition==='changedPhoto'?{...photo}:photo),null,condition);
    assert.equal(f.node('#modal-photo'),f.main,condition);
  }
});

test('promoted images remain the target of pinch, grid and close cleanup in portrait and landscape', () => {
  for (const [width,height] of [[390,844],[844,390]]) {
    const f=preparedFixture({width,height}); f.drag('.photo-stage',-150,0); f.frame();
    const selected=f.node('#modal-photo');
    f.dispatch('.photo-stage','pointerdown',{pointerId:1,clientX:100,clientY:200});
    f.dispatch('.photo-stage','pointerdown',{pointerId:2,clientX:200,clientY:200});
    f.dispatch('.photo-stage','pointermove',{pointerId:2,clientX:300,clientY:200}); f.frame();
    assert.match(selected.style.transform,/scale\(2\)/);
    f.dispatch('.photo-stage','pointercancel',{pointerId:2});
    f.click('#mobile-photo-grid');
    assert.equal(f.node('#modal-photo'),selected);
    assert.ok(f.node('#viewer-photo-frame').children.filter(node=>node!==selected).every(node=>node.hidden));
    f.node('#photo-dialog').close();
    assert.equal(f.node('.photo-viewer').dataset.zoomed,'false');
  }
});

test('a prepared public image is reused without resetting its source or entering loading again', () => {
  let writes=0, src='https://example.test/full.webp'; const states=[];
  const image={dataset:{photoState:'ready'},complete:true,naturalWidth:1600,currentSrc:src,classList:{add(){}},dispatchEvent(){states.push(this.dataset.photoState);},get src(){return src;},set src(value){writes++;src=value;}};
  const context=vm.createContext({window:{},document:{baseURI:'https://example.test/'},preferredPhotoUrl:photo=>photo.src,decodedPhotoUrls:new Set(),URL,Event});
  vm.runInContext(viewerFunction('setPublicFullImage'),context);
  context.setPublicFullImage(image,{src:'full.webp'});
  assert.equal(writes,0); assert.deepEqual(states,['ready']); assert.equal(image.dataset.photoReveal,'instant');
});

test('horizontal photo intent finishes only the current reveal while taps and sub-threshold moves leave it alone',()=>{
  const f=viewerFixture();f.api.openDay();
  const image=f.node('#modal-photo'),neighbors=f.node('#viewer-photo-frame').children;
  image.dataset.photoState='ready';image.dataset.photoReveal='soft';image.src='blob:current';
  for(const node of neighbors)node.dataset.photoReveal='soft';
  f.dispatch('.photo-stage','pointerdown',{clientX:200,clientY:300});
  f.dispatch('.photo-stage','pointermove',{clientX:196,clientY:300});
  assert.equal(image.dataset.photoReveal,'soft');
  f.dispatch('.photo-stage','pointermove',{clientX:170,clientY:300});
  assert.equal(image.dataset.photoReveal,'instant');
  assert.equal(image.dataset.photoState,'ready');assert.equal(image.src,'blob:current');
  assert.ok(neighbors.every(node=>node.dataset.photoReveal==='soft'));
  f.dispatch('.photo-stage','pointercancel');
});

test('photo pinch takeover finishes the reveal without altering focal zoom',()=>{
  const f=viewerFixture();f.api.openDay();const image=f.node('#modal-photo');
  image.dataset.photoState='ready';image.dataset.photoReveal='soft';
  f.dispatch('.photo-stage','pointerdown',{pointerId:1,clientX:100,clientY:300});
  assert.equal(image.dataset.photoReveal,'soft');
  f.dispatch('.photo-stage','pointerdown',{pointerId:2,clientX:200,clientY:300});
  assert.equal(image.dataset.photoReveal,'instant');
  f.dispatch('.photo-stage','pointermove',{pointerId:2,clientX:300,clientY:300}); f.frame();
  assert.match(image.style.transform,/scale\(2\)/);
});

test('non-photo manipulation and unavailable images retain their reveal policy',()=>{
  for(const condition of ['tap','vertical','header','grid','desktop','video','reduced','loading','closed']){
    const f=viewerFixture({reducedMotion:condition==='reduced',videoIndex:condition==='video'?0:-1});f.api.openDay();
    const image=f.node('#modal-photo');image.dataset.photoState=condition==='loading'?'loading':'ready';image.dataset.photoReveal='soft';
    if(condition==='grid')f.click('#mobile-photo-grid');
    if(condition==='desktop')f.resize(false);
    if(condition==='closed')f.node('#photo-dialog').open=false;
    if(condition==='tap')f.click('.photo-stage');
    else if(condition==='vertical')f.drag('.photo-stage',0,-50);
    else f.drag(condition==='header'?'.photo-location-heading':'.photo-stage',-50,0);
    assert.equal(image.dataset.photoReveal,'soft',condition);
  }
});

test('a later cold public image receives its own soft reveal after gesture interruption',()=>{
  const image={dataset:{photoState:'ready',photoReveal:'instant'},src:'https://example.test/previous.webp',complete:false,naturalWidth:0,classList:{add(){}},dispatchEvent(){}};
  const context=vm.createContext({window:{},document:{baseURI:'https://example.test/'},preferredPhotoUrl:photo=>photo.src,decodedPhotoUrls:new Set(),URL,Event});
  vm.runInContext(viewerFunction('setPublicFullImage'),context);
  context.setPublicFullImage(image,{src:'cold.webp'});
  assert.equal(image.dataset.photoReveal,'soft');assert.equal(image.dataset.photoState,'loading');
  image.complete=true;image.naturalWidth=1600;image.onload();
  assert.equal(image.dataset.photoReveal,'soft');assert.equal(image.dataset.photoState,'ready');
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
  f.dispatch('.photo-stage','pointermove',{pointerId:2,clientX:300,clientY:300}); f.frame();
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
  touch('pointermove',1,120,363); touch('pointermove',2,320,363); f.frame();
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
