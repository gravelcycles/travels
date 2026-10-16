import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { loadContent } from '../scripts/journey-content.mjs';
import { readOverrides } from '../scripts/build-site.mjs';
import '../dist/assets/location-labels.js';
const { groupsForJourney, dayText, overlaps, crossesRoute, clusterGroups, placePin } = globalThis.JOURNEY_ATLAS_LOCATION_LABELS;
const { data, routes } = loadContent(new URL('../', import.meta.url).pathname);
const overrides = readOverrides(new URL('../', import.meta.url).pathname);
function helpers(journey) {
  const place = id => journey.places.find(p => p.id === id);
  return { destinationForDay: day => place(day.destinationId || day.placeId),
    segmentsForDay: day => day.segmentIds.map(id => journey.segments.find(s => s.id === id)),
    segmentCoordinates: segment => overrides.routes[segment.id]?.geometry || routes[segment.id] || segment.geometry || [
      [place(segment.from).lng, place(segment.from).lat], ...(segment.via || segment.stops || []).map(p => Array.isArray(p) ? [p[1],p[0]] : [p.lng,p.lat]), [place(segment.to).lng, place(segment.to).lat]] };
}

test('all real and sample destination labels preserve day membership and reviewed arrival points', () => {
  for (const journey of data.journeys) {
    const h = helpers(journey);
    for (const day of journey.days) {
      const focused = groupsForJourney(journey, h, day.id, 'day');
      assert.ok(focused.every(group => group.days.length === 1 && group.days[0].id === day.id));
      for (const group of focused) {
        const arrival = h.segmentsForDay(day).filter(segment => segment.to === group.key).at(-1);
        if (arrival) assert.deepEqual(group.coordinate, h.segmentCoordinates(arrival).at(-1));
      }
      const overview = groupsForJourney(journey, h, day.id, 'journey');
      assert.equal(new Set(overview.map(group => group.key)).size, overview.length);
      assert.ok(overview.filter(group => group.selected).every(group => group.days.some(d => d.id === day.id)));
      if (h.destinationForDay(day)) assert.ok(overview.some(group => group.days.includes(day)));
    }
  }
});

test('repeat stays and skipped days get honest labels', () => {
  assert.equal(dayText([{number:4}]),'Day 4');
  assert.equal(dayText([{number:4},{number:5},{number:6}]),'Days 4–6');
  assert.equal(dayText([{number:4},{number:8}]),'Day 4 +1');
});

test('group filters exclude other destinations even when those places remain in the journey', () => {
  const journey = {places:[{id:'a',name:'A',lng:1,lat:1},{id:'b',name:'B',lng:2,lat:2}],segments:[],days:[{id:'d1',number:1,placeId:'a',groupPlaces:{first:'a',second:'b'},segmentIds:[]}]};
  assert.equal(groupsForJourney(journey,helpers(journey),'d1','journey').length,2);
  const selected = groupsForJourney(journey,{...helpers(journey),includeGroupPlaces:false},'d1','journey');
  assert.deepEqual(selected.map(group=>group.name),['A']);
});


test('nearby locations cluster without dropping days and separate again on zoom', () => {
  const groups = [0,1,2].map(i=>({key:`p${i}`,coordinate:[i*30,100],name:`Place ${i}`,days:[{id:`d${i}`,number:i+1}],selected:i===1}));
  const project = ([x,y])=>({x,y});
  const clustered = clusterGroups(groups,project,40);
  assert.equal(clustered.length,1);
  assert.equal(clustered[0].members.length,3);
  assert.deepEqual(clustered[0].days.map(d=>d.id),['d0','d1','d2']);
  assert.deepEqual(clustered[0].coordinate,groups[1].coordinate,'Selected location anchors the cluster');
  assert.equal(clusterGroups(groups,([x,y])=>({x:x*2,y}),40).length,3);
  assert.equal(groups[0].members,undefined,'Source records remain untouched');
});

test('signposts stay upright above their location with the complete marker inside its hit target', () => {
  const point={x:150,y:150}, bounds={left:0,right:300,top:0,bottom:300};
  for (const targetSize of [32,44]) {
    const routes=[{start:{x:0,y:150},end:{x:300,y:150},padding:3}];
    const pin=placePin(point,{dot:false,targetSize,bounds,routes});
    assert.equal(pin.dot,false); assert.equal(pin.offset[0],0); assert.equal(pin.postHeight,18);
    assert.ok(pin.box.top<=point.y-pin.postHeight-11,'The entire board is clickable');
    assert.ok(pin.box.bottom>=point.y+2.5,'The location foot is clickable too');
    assert.ok(!crossesRoute(routes[0],{left:139,right:161,top:150-pin.postHeight-11,bottom:150-pin.postHeight+11}));
    const crossing=[{start:{x:0,y:142},end:{x:300,y:142},padding:1}];
    const taller=placePin(point,{dot:false,targetSize,bounds,routes:crossing});
    assert.equal(taller.postHeight,22); assert.equal(taller.offset[0],0,'Clear nearby lines by extending upward only');
    assert.ok(taller.height>=targetSize);
    const endpoint=placePin(point,{dot:false,endpoint:true,targetSize,bounds,routes});
    assert.equal(endpoint.postHeight,25,'The board leaves room for the orange endpoint ring');
    assert.ok(endpoint.box.top<=point.y-endpoint.postHeight-11);
    assert.ok(endpoint.box.bottom>=point.y+7,'The whole endpoint fits in desktop and phone targets');
    const endpointEdge=placePin({x:150,y:26},{dot:false,endpoint:true,targetSize,bounds});
    assert.equal(endpointEdge.dot,true,'Endpoint posts retain the tight-edge fallback');
    const edge=placePin({x:150,y:26},{dot:false,targetSize,bounds});
    assert.equal(edge.dot,true,'Tight edges use a dot rather than a sideways or inverted post');
    assert.deepEqual(edge.offset,[0,0]);
    assert.equal(placePin({x:-1,y:150},{dot:false,targetSize,bounds}),null);
    assert.equal(placePin(point,{dot:false,targetSize,bounds,occupied:[bounds]}),null);
  }
});

test('real and demo maps use clustered pins with separate touch targets and protected controls', () => {
  for (const journey of data.journeys) for (const [width,height,targetSize] of [[850,650,32],[390,580,44],[320,300,44]]) {
    const h=helpers(journey), groups=groupsForJourney(journey,h,journey.days[0].id,'journey');
    const coordinates=[...journey.segments.flatMap(h.segmentCoordinates),...groups.map(group=>group.coordinate)];
    if(!coordinates.length)continue;
    const xs=coordinates.map(c=>c[0]),ys=coordinates.map(c=>c[1]);
    const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
    const scale=Math.min((width-120)/Math.max(.001,maxX-minX),(height-160)/Math.max(.001,maxY-minY));
    const project=([x,y])=>({x:width/2+(x-(minX+maxX)/2)*scale,y:height/2-(y-(minY+maxY)/2)*scale});
    const clustered=clusterGroups(groups,project,targetSize+8);
    assert.deepEqual(new Set(clustered.flatMap(g=>g.members.map(m=>m.key))),new Set(groups.map(g=>g.key)));
    const occupied=[{left:width-50,right:width,top:0,bottom:90},{left:8,right:width-8,top:height-45,bottom:height}];
    let visible=0;
    for(const group of clustered){
      const placement=placePin(project(group.coordinate),{dot:group.days.length>1||group.members.length>1,targetSize,bounds:{left:4,right:width-4,top:4,bottom:height-4},occupied});
      if(!placement)continue;
      assert.ok(!occupied.some(box=>overlaps(placement.box,box,2)));
      assert.ok(Math.abs(placement.box.right-placement.box.left-targetSize)<1e-9);
      occupied.push(placement.box);visible++;
    }
    assert.ok(visible,`${journey.id} at ${width}px`);
  }
});

function previewFixture() {
  const frames = new Map(), timers = new Map(), mapEvents = new Map(), previews = [], selections = [];
  const work = {projects:0,geometry:0,markers:0};
  let nextId = 1, moving = false, controller;
  function node(tag) {
    const listeners = new Map(), attributes = new Map(), classes = new Set();
    return {
      tag, children: [], parent: null, dataset: {}, style: { setProperty() {} }, clientWidth: 800, clientHeight: 600,
      offsetWidth: 240, offsetHeight: 150, isConnected: true,
      classList: { add(name) { classes.add(name); }, remove(name) { classes.delete(name); }, toggle(name, value) { value ? classes.add(name) : classes.delete(name); }, contains(name) { return classes.has(name); } },
      append(...children) { children.forEach(child => { child.parent = this; this.children.push(child); }); },
      remove() { this.isConnected = false; if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); },
      setAttribute(name, value) { attributes.set(name, value); }, removeAttribute(name) { attributes.delete(name); }, getAttribute(name) { return attributes.get(name); },
      getBoundingClientRect() { work.geometry++; return { left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 }; },
      contains(target) { return this === target || this.children.some(child => child.contains(target)); },
      querySelector(selector) { return this.children.find(child => child.tag === selector) || this.children.map(child => child.querySelector(selector)).find(Boolean); },
      addEventListener(name, listener) { if (!listeners.has(name)) listeners.set(name, []); listeners.get(name).push(listener); },
      removeEventListener(name, listener) { listeners.set(name, (listeners.get(name) || []).filter(item => item !== listener)); },
      fire(name, event = {}) { for (const listener of listeners.get(name) || []) listener({ stopPropagation() {}, ...event }); },
      focus() { document.activeElement = this; this.fire('focus'); }
    };
  }
  const container = node('map');
  const document = { createElement: node, documentElement: { dataset: { inputMode: 'keyboard' } }, addEventListener() {}, removeEventListener() {}, activeElement: null };
  const map = { getContainer: () => container, isMoving: () => moving, project: ([x,y]) => {work.projects++;return {x,y};}, on: (name, listener) => mapEvents.set(name, listener), off: name => mapEvents.delete(name) };
  const maplibregl = { Marker: class {
    constructor({ element }) { this.element = element; }
    setLngLat() { return this; }
    addTo() { work.markers++;container.append(this.element); return this; }
    remove() { this.element.remove(); }
  } };
  const context = vm.createContext({ window: {}, document, matchMedia: query => ({ matches: query.includes('hover: hover') }),
    requestAnimationFrame(callback) { const id = nextId++; frames.set(id, callback); return id; }, cancelAnimationFrame: id => frames.delete(id),
    setTimeout(callback) { const id = nextId++; timers.set(id, callback); return id; }, clearTimeout: id => timers.delete(id)
  });
  vm.runInContext(fs.readFileSync(new URL('../dist/assets/location-labels.js', import.meta.url), 'utf8'), context);
  const group = { key: 'lake', name: 'Lakeside', coordinate: [200,200], days: [{ id: 'one', number: 1, title: 'A day' }], selected: true };
  controller = context.window.JOURNEY_ATLAS_LOCATION_LABELS.create({ map, maplibregl,
    onPreviewDays: ids => previews.push([...ids]), onSelectDay(id) { selections.push(id); controller.closePreview(); controller.update([group], []); }
  });
  const flush = queue => { while (queue.size) { const [id, callback] = queue.entries().next().value; queue.delete(id); callback(); } };
  controller.update([group], []); flush(frames);
  return { controller, previews, selections, document, work, group, get pendingFrames(){return frames.size;},get button() { return container.children.find(child => child.className === 'location-label-anchor')?.children[0]; },
    get card() { return container.children.find(child => child.className === 'map-place-card'); },
    flushTimers() { flush(timers); }, flushFrames() { flush(frames); },
    startMoving() { moving = true; mapEvents.get('movestart')(); }, stopMoving() { moving = false; mapEvents.get('moveend')(); flush(frames); }
  };
}

test('covered labels cancel queued geometry and resume once with the latest groups', () => {
  const f=previewFixture(), initial={...f.work}, old=f.button;
  f.button.fire('pointerenter',{pointerType:'mouse'});
  f.controller.refresh();assert.equal(f.pendingFrames,1);
  f.controller.setSuspended(true);
  for(let i=0;i<5;i++)f.controller.update([{...f.group,name:`Latest ${i}`}],[]);
  f.flushTimers();f.flushFrames();f.startMoving();f.stopMoving();
  assert.deepEqual(f.work,initial,'Covered updates perform no projections, card geometry or marker rebuilding');
  assert.equal(f.button,old);assert.equal(f.card,undefined);assert.equal(f.pendingFrames,0);
  f.controller.setSuspended(false);f.controller.setSuspended(false);
  assert.equal(f.pendingFrames,1);f.flushFrames();
  assert.equal(f.work.markers,initial.markers+1,'One refresh consumes the latest model');
  assert.match(f.button.getAttribute('aria-label'),/Latest 4/);
});

test('an event change dismisses the location preview before map movement and cancels pending hover', () => {
  const f = previewFixture();
  f.button.fire('pointerenter', { pointerType: 'mouse' });
  f.controller.closePreview(); f.flushTimers();
  assert.equal(f.card, undefined, 'A hover queued on the previous event cannot open later');
  assert.deepEqual(f.previews.at(-1), []);
  f.button.fire('pointerenter', { pointerType: 'mouse' }); f.flushTimers();
  assert.ok(f.card);
  f.controller.closePreview();
  assert.equal(f.card, undefined, 'The card is gone synchronously before the camera changes');
  assert.equal(f.button.getAttribute('aria-expanded'), 'false');
});

test('location hover cards cannot open during camera movement', () => {
  const f = previewFixture();
  f.button.fire('pointerenter', { pointerType: 'mouse' }); f.flushTimers(); assert.ok(f.card);
  f.startMoving(); assert.equal(f.card, undefined);
  f.button.fire('pointerenter', { pointerType: 'mouse' }); f.flushTimers();
  assert.equal(f.card, undefined, 'A moving marker cannot create a new stale card');
  f.stopMoving(); f.flushTimers(); assert.equal(f.card, undefined);
});

test('keyboard selection restores the selected marker focus without reopening its preview', () => {
  const f = previewFixture();
  f.button.focus(); f.flushTimers(); assert.ok(f.card);
  f.card.children.find(child => child.className === 'map-place-visits').children[0].fire('click');
  assert.deepEqual(f.selections, ['one']);
  assert.equal(f.card, undefined);
  f.flushFrames(); f.flushTimers();
  assert.equal(f.document.activeElement, f.button);
  assert.equal(f.card, undefined, 'Programmatic focus after selection must not reopen a popup');
  assert.deepEqual(f.previews.at(-1), []);
});

test('keyboard selection keeps pending marker focus through camera movement', () => {
  const f = previewFixture();
  f.button.focus(); f.flushTimers();
  f.card.children.find(child => child.className === 'map-place-visits').children[0].fire('click');
  f.startMoving(); f.flushFrames(); f.flushTimers();
  assert.equal(f.card, undefined);
  f.stopMoving(); f.flushTimers();
  assert.equal(f.document.activeElement, f.button, 'The selected marker receives keyboard focus after the camera settles');
  assert.equal(f.card, undefined, 'Restoring keyboard focus must not recreate the dismissed preview');
  assert.deepEqual(f.previews.at(-1), []);
});

test('an explicit event change still cancels pending marker focus from an older selection', () => {
  const f = previewFixture();
  f.button.focus(); f.flushTimers();
  f.card.children.find(child => child.className === 'map-place-visits').children[0].fire('click');
  f.controller.closePreview();
  f.startMoving(); f.flushFrames(); f.stopMoving(); f.flushTimers();
  assert.notEqual(f.document.activeElement, f.button, 'An unrelated event change must not inherit the previous keyboard selection');
  assert.equal(f.card, undefined);
});
