import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { buildSite, renderJourneyPage, studioAsset, readOverrides } from '../scripts/build-site.mjs';
import { createJourney } from '../scripts/create-journey.mjs';
import { loadContent, writeJson, validateJourneys } from '../scripts/journey-content.mjs';
import { prepareJourneyPlan } from '../scripts/journey-planner.mjs';
import { studioRouteAvailability, proposeStudioRoute } from '../scripts/studio-route-service.mjs';
import { photoImportConfig } from '../scripts/photo-import-config.mjs';
import '../dist/assets/replay-utils.js';
import '../dist/assets/arrival-chapter.js';
import {arrivalCameraHarness} from './arrival-camera-harness.mjs';
import {openingRouteHarness} from './opening-route-harness.mjs';
import '../dist/assets/atlas-utils.js';
import '../dist/assets/map-style.js';
import { mapStyleHarness } from './map-style-harness.mjs';
import { viewerFixture } from './mobile-viewer-harness.mjs';
import { photoEntryFixture, viewerFunction } from './viewer-flow-harness.mjs';
import { photoBubbleFixture } from './photo-bubble-harness.mjs';
import '../dist/assets/group-travel.js';
import '../dist/assets/media-utils.js';
import '../dist/assets/places-comments.js';
import '../studio/plan-extras.js';
import '../studio/photo-batch.js';
import { validateJourneyExtras } from '../scripts/journey-extras.mjs';
import { assessStudioReadiness } from '../scripts/studio-readiness.mjs';
import { journeyRevision } from '../scripts/journey-planner.mjs';

const repo = path.resolve(import.meta.dirname, '..');
const input = { title: 'A completely new trip', slug: 'framework-test-trip', startDate: '2028-02-28', endDate: '2028-03-01', timeZone: 'Asia/Tokyo' };
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-framework-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.cpSync(path.join(repo, 'content'), path.join(root, 'content'), { recursive: true, filter: source => !source.includes(`${path.sep}drafts`) });
  fs.cpSync(path.join(repo, 'dist'), path.join(root, 'dist'), { recursive: true });
  return root;
}
const read = (root, file) => fs.readFileSync(path.join(root, file), 'utf8');
const ids = html => [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]).sort();
// Runtime parity is independent of public scoped bundles vs live Studio data.
const assets = html => [...html.matchAll(/(?:src|href)="[^" ]*\/(?:assets|preview-assets)\/([a-z-]+\.(?:js|css))[^" ]*"/g)].map(match => match[1]).filter(name => !['journeys.js','route-geometry.js','trip-photos.js','content-overrides.js'].includes(name));
function bundle(source, key) {
  const context = { window: {} };
  vm.runInNewContext(source, context);
  return JSON.parse(JSON.stringify(context.window[key]));
}
const app = read(repo, 'dist/assets/app.js');

test('prepared photo surfaces default to mobile across reference, demo and populated fresh drafts',t=>{
  const root=fixture(t),draft=createJourney(root,input),{data}=loadContent(root);
  draft.photos=[{id:'prepared-surface-fixture',dayId:draft.days[0].id,caption:'',src:'https://images.example.test/photo.jpg'}];
  for(const journey of [data.journeys.find(j=>j.id==='switzerland-italy-family-2026'),data.journeys.find(j=>j.kind==='demo'&&j.photos.length),draft]){
    const html=renderJourneyPage(root,journey,{preview:true}),scripts=assets(html);
    assert.ok(scripts.includes('photo-swipe-raster.js'));
    assert.ok(scripts.indexOf('photo-swipe-raster.js')<scripts.indexOf('mobile-ux.js'));
    assert.doesNotMatch(html,/swipeRenderer=prepared/,'Ordinary journey links need no renderer parameter');
    for(const mobile of [false,true]){
      const created=[],registered=[];let clears=0;
      const f=viewerFixture({journey,mobile,rasterFactory:options=>{
        created.push(options);
        return {register:image=>registered.push(image),resize(){},prepareAll(){},sync(){},active(){},clear(){clears++;}};
      }});
      assert.equal(created.length,mobile?1:0,'Desktop startup never creates mobile rendering resources');
      f.api.openDay(journey.photos[0].dayId);
      assert.equal(created.length,mobile?1:0);
      if(!mobile)f.resize(true);
      assert.equal(created.length,1);assert.equal(new Set(registered).size,3);
      assert.equal(created[0].enabled(),true);
      f.resize(false);assert.equal(created[0].enabled(),false);assert.ok(clears>0);
      f.resize(true);assert.equal(created.length,1,'Breakpoint changes reuse the same three slots');
      assert.equal(registered.length,3);assert.equal(created[0].enabled(),true);
    }
  }
});

test('notification photo entry opens fullscreen directly across reference, city, demo and populated fresh draft', t => {
  const root = fixture(t), draft = createJourney(root, { ...input, eventMode: 'city' });
  draft.photos = [1, 2].map(n => ({ id: `${draft.id}-notice-${n}`, dayId: draft.days[0].id, caption: '', src: `https://images.example.test/notice-${n}.jpg` }));
  const { data } = loadContent(root);
  for (const journey of [data.journeys.find(j => j.id === 'switzerland-italy-family-2026'), data.journeys.find(j => j.id === 'backpacking-europe-heading-east'), data.journeys.find(j => j.kind === 'demo' && j.photos.length), draft]) {
    for (const mobile of [false, true]) {
      const f = photoEntryFixture(journey, journey.photos, { mobile }), photo = f.photos().at(-1);
      Object.assign(f.context, { sourceJourney: journey, planningVisibility: { past: true, locked: true, tbd: true }, activeGroupId: '' });
      f.context.window.JOURNEY_ATLAS_UTILS = globalThis.JOURNEY_ATLAS_UTILS;
      vm.runInContext(viewerFunction('openNotificationPhoto'), f.context);
      assert.equal(f.context.openNotificationPhoto(photo.id), true, journey.id);
      assert.equal(f.context.photoDialog.open, true, 'The comment destination already has a fullscreen photograph');
      assert.equal(f.photos()[f.context.viewerPhotoIndex].id, photo.id);
      assert.equal(f.events.some(event => event?.selection), false, 'No intermediate sidebar/card selection');
      assert.equal(f.context.viewerCollection, null, 'Trip-wide notification entry uses ordinary journey browsing');
    }
  }
});

test('whole location-header dismissal inherits reference, demo and a populated fresh city draft',t=>{
  const root=fixture(t),draft=createJourney(root,{...input,eventMode:'city'}),{data}=loadContent(root);
  draft.photos=[{id:`${draft.id}-located`,dayId:draft.days[0].id,caption:'',lng:139.7,lat:35.7,src:'https://images.example.test/location.jpg'}];
  for (const journey of [data.journeys.find(j=>j.id==='switzerland-italy-family-2026'),data.journeys.find(j=>j.kind==='demo'&&j.photos.length),draft]) {
    const f=viewerFixture({journey});f.api.openDay(journey.photos[0].dayId);f.click('#mobile-photo-location');
    const header='.photo-location-heading',start={target:f.node('#mobile-location-close'),clientX:120,clientY:350};
    f.dispatch(header,'pointerdown',start);
    f.dispatch(header,'pointermove',{...start,clientX:138,clientY:352});
    f.dispatch(header,'pointermove',{...start,clientX:160,clientY:420});
    f.dispatch(header,'pointerup',{...start,clientX:160,clientY:420});
    assert.equal(f.controller.locationVisible(),false,journey.id);
    assert.equal(f.node('#photo-dialog').open,true);
    assert.equal(f.index,0);
    assert.equal(f.history.state.mobileAtlas.layer,'photo');
  }
});

test('three-second opening trace inherits resolved routes for reference, city atlas, demo and independent fresh draft', t => {
  const root = fixture(t), draft = createJourney(root, {...input,slug:'opening-route-fixture'});
  const {data, routes} = loadContent(root), overrides = readOverrides(root);
  draft.places = [{id:'qa-north',name:'North',lng:139.7,lat:35.7},{id:'qa-south',name:'South',lng:139.8,lat:35.6}];
  draft.segments = [{id:'qa-walk',mode:'walk',from:'qa-north',to:'qa-south',geometry:[[139.7,35.7],[139.72,35.64],[139.8,35.6]]}];
  draft.days[0].segmentIds = ['qa-walk'];
  for (const journey of [data.journeys.find(j=>j.id==='switzerland-italy-family-2026'),data.journeys.find(j=>j.id==='backpacking-europe-heading-east'),data.journeys.find(j=>j.kind==='demo'),draft]) {
    for (const segment of journey.segments) if (overrides.routes[segment.id]?.geometry) segment.geometry=overrides.routes[segment.id].geometry;
    const context=vm.createContext({journey,window:{JOURNEY_ATLAS_ROUTE_GEOMETRY:routes}});
    vm.runInContext(appFunction('placeById')+'\n'+appFunction('segmentCoordinates'),context);
    const h=openingRouteHarness(journey,context.segmentCoordinates), animation=h.start();
    assert.match(renderJourneyPage(root,journey,{preview:true}),/opening-route\.js/);
    assert.deepEqual(h.plan.legs.map(leg=>leg.segment.id),[...new Set(journey.days.flatMap(day=>day.segmentIds))],journey.id);
    h.tick(0);h.tick(450);
    h.events.get('movestart')({type:'movestart'});h.events.get('resize')({type:'resize'});
    for(const id of h.layers.keys())h.layers.set(id,'visible');
    animation.syncLayers();
    assert.ok([...h.layers.values()].every(value=>value==='none'),journey.id);
    h.tick(1500);assert.equal(h.frames.at(-1).progress,0.5);assert.equal(h.destroyed,0);
    h.tick(3000);assert.deepEqual(h.frames.at(-1).position,h.plan.legs.at(-1).coordinates.at(-1));
    assert.equal(h.destroyed,1);assert.equal(h.pending.size,0);
  }
});

test('trip read state and counts are inherited across reference, demo and independently populated city draft', async t => {
  await import('../dist/assets/comment-notifications.js');
  const model = globalThis.JOURNEY_ATLAS_COMMENT_NOTIFICATIONS;
  const root = fixture(t), created = createJourney(root, { ...input, eventMode: 'city' });
  const { data } = loadContent(root, { includeDrafts: true });
  const draft = data.journeys.find(item => item.id === created.id);
  draft.photos = [1, 2].map(n => ({ id: `${draft.id}-photo-${n}`, dayId: draft.days[0].id, caption: '', takenAt: `2028-02-28 12:0${n}`, src: `https://images.example.test/independent-${n}.jpg` }));
  const values = new Map(), storage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
  for (const journey of [data.journeys.find(item => item.id === 'switzerland-italy-family-2026'), data.journeys.find(item => item.kind === 'demo' && item.photos.length), draft]) {
    const state = model.createReadState({ storage, journeyId: journey.id, eventTarget: null });
    assert.equal(model.summarize([], state).total, 0);
    const photoId = journey.photos[0].id;
    const comments = Array.from({ length: 53 }, (_, n) => ({ id: `fixture-comment-${n}`, photoId, createdAt: n + 1 }));
    assert.equal(model.summarize(comments, state).unread, 53, `${journey.id}: another trip's read IDs cannot clear this trip`);
    state.markRead(comments.slice(0, 3));
    const partial = model.summarize(comments, state);
    assert.equal(partial.photos[photoId].total, 53);
    assert.equal(partial.photos[photoId].unread, 50, 'Unread includes comments beyond the conversation page');
    state.destroy();
    const restored = model.createReadState({ storage, journeyId: journey.id, eventTarget: null });
    assert.equal(model.summarize(comments, restored).unread, 50, 'Reload keeps read membership');
    restored.markRead(comments);
    assert.equal(model.summarize(comments, restored).unread, 0);
    assert.equal(model.summarize(comments, restored).total, 53);
    const html = renderJourneyPage(root, journey, { preview: true });
    assert.match(html, /trip-notifications\.js/);
    assert.match(html, /comment-notifications\.js/);
    assert.match(html, /id="trip-notifications-dialog"/);
    restored.destroy();
  }
  for (const value of values.values()) assert.deepEqual(Object.keys(JSON.parse(value)), ['version', 'read'], 'Read storage contains no comment text or identity');
});


test('desktop and phone journey browsing inherits across reference, city atlas, demo and an independent fresh draft', t => {
  const root=fixture(t), draft=createJourney(root,{...input,slug:'phone-camera-roll-fixture'});
  const {data}=loadContent(root);
  const controls=['mobile-photo-prev','mobile-photo-next','mobile-photo-previous-event','mobile-photo-next-event','mobile-photo-event-label'];
  const independent={...draft,eventMode:'city',days:draft.days.map((day,index)=>({...day,title:['North harbour','Museum quarter','South gardens'][index],calendarEndDate:draft.days[Math.min(index+1,draft.days.length-1)].calendarDate}))};
  const empty=photoEntryFixture(independent,[],{mobile:true});
  assert.deepEqual(empty.photos(),[],'A new empty city draft does not inherit another trip’s photos');
  for(const journey of [data.journeys.find(j=>j.id==='switzerland-italy-family-2026'),data.journeys.find(j=>j.id==='backpacking-europe-heading-east'),data.journeys.find(j=>j.kind==='demo'),independent]) {
    const html=renderJourneyPage(root,journey,{preview:true});
    for(const id of controls)assert.equal(ids(html).filter(value=>value===id).length,1,`${journey.id}: ${id}`);
    const [first,emptyDay,last]=journey.days;
    const media=[{id:`${journey.id}-north-a`,dayId:first.id},{id:`${journey.id}-north-b`,dayId:first.id},{id:`${journey.id}-south`,dayId:last.id}];
    for (const mobile of [false,true]) {
    const f=photoEntryFixture(journey,media,{mobile});
    f.open(media[1].id);
    assert.equal(f.context.viewerPhotoIndex,1,journey.id);
    assert.deepEqual(f.photos().map(photo=>photo.id),media.map(photo=>photo.id));
    f.context.moveViewer(1);
    assert.equal(f.context.viewerDayId,last.id,'Adjacent photo browsing crosses the empty event');
    f.context.moveViewerDay(-1);
    assert.equal(f.context.viewerDayId,first.id,'Event jump skips empty events');
    assert.equal(f.context.viewerPhotoIndex,0,'An event jump starts at that album’s first photo');
    f.open(media[2].id,{photos:[media[2],media[0]],collectionLabel:'Saved place'});
    assert.deepEqual(f.photos().map(photo=>photo.id),[media[2].id,media[0].id],'Explicit collections preserve their own order');
    assert.equal(f.context.viewerPhotoIndex,0);
    f.context.moveViewerDay(-1);
    assert.equal(f.context.viewerDayId,last.id,'Event jumps do not escape explicit collections');
    assert.notEqual(emptyDay.id,last.id);
    }
  }
});

test('pull-to-dismiss inherits reference, city atlas, demo and independently populated fresh draft',t=>{
  const root=fixture(t), created=createJourney(root,{...input,slug:'pull-dismiss-fixture'}),{data}=loadContent(root,{includeDrafts:true});
  const draft=data.journeys.find(j=>j.id===created.id);
  draft.photos=[{id:'independent-portrait',dayId:draft.days[0].id,src:'https://images.example.test/portrait.jpg',width:800,height:1200}];
  for(const journey of [data.journeys.find(j=>j.id==='switzerland-italy-family-2026'),data.journeys.find(j=>j.id==='backpacking-europe-heading-east'),data.journeys.find(j=>j.kind==='demo' && j.photos.length),draft]) {
    const f=viewerFixture({journey});f.api.openDay(journey.photos[0].dayId);
    f.drag('.photo-stage',0,32,700);f.flush();assert.equal(f.node('#photo-dialog').open,true,journey.id);
    f.drag('.photo-stage',12,180,600);f.flush();assert.equal(f.node('#photo-dialog').open,false,journey.id);
    f.history.go(1);assert.equal(f.node('#photo-dialog').open,true,journey.id);
    assert.equal(f.api.day().id,journey.photos[0].dayId);
    f.node('#mobile-photo-grid').onclick();f.node('#viewer-filmstrip').scrollTop=410;f.controller.gridSelected();
    assert.equal(f.node('.photo-viewer').dataset.gridOrigin,'true',journey.id);
    assert.equal(f.controller.gridOrigin().dayId,journey.photos[0].dayId);
    f.drag('.photo-stage',0,180,600);f.flush();
    assert.equal(f.controller.gridVisible(),true,journey.id);
    assert.equal(f.node('#viewer-filmstrip').scrollTop,410);
    assert.equal(f.node('#mobile-photo-back .button-label').textContent,'Back');
    const html=renderJourneyPage(root,journey,{preview:true});
    assert.match(html, /id="mobile-photo-back"[^]*?<span class="button-label">Back<\/span>/);
  }
});

test('stationary photo bubbles stay attached for reference, demo and freshly generated draft',t=>{
  const root=fixture(t),draft=createJourney(root,input),{data}=loadContent(root);
  for(const journey of [data.journeys.find(j=>j.id==='switzerland-italy-family-2026'),data.journeys.find(j=>j.kind==='demo'),draft]){
    for(const [width,height] of [[800,600],[360,400]]){
      const f=photoBubbleFixture({ready:true,journey,initialPhotos:[],width,height});
      f.controller.mapReady();f.flush();assert.equal(f.liveMarkers().length,0,'Empty trips have no invented photo markers');
      f.setPhotos([{id:`${journey.id}-fixture-photo`,dayId:journey.days[0].id,lat:47,lng:8}]);
      f.controller.refresh();f.flush();const marker=f.liveMarkers()[0];assert.ok(marker,journey.id);
      f.mapEvent('resize');f.controller.refresh();f.flush();assert.equal(f.liveMarkers()[0],marker,journey.id);
    }
  }
});

test('mobile fullscreen chrome and zoom inherit reference, demo and independently populated fresh draft',t=>{
  const root=fixture(t),created=createJourney(root,{...input,slug:'fullscreen-gestures-fixture',eventMode:'city'}),{data}=loadContent(root,{includeDrafts:true});
  const draft=data.journeys.find(journey=>journey.id===created.id);
  draft.photos=[{id:'independent-fullscreen-photo',dayId:draft.days[0].id,src:'https://images.example.test/fullscreen-portrait.jpg',width:800,height:1200}];
  for(const journey of [data.journeys.find(j=>j.id==='switzerland-italy-family-2026'),data.journeys.find(j=>j.kind==='demo'&&j.photos.length),draft]) {
    const html=renderJourneyPage(root,journey,{preview:true});
    assert.equal(ids(html).filter(id=>id==='mobile-share-photo').length,1,journey.id);
    assert.equal(ids(html).filter(id=>id==='open-photo-comments').length,1,journey.id);
    assert.match(html,/class="mobile-photo-actions"[^]*?id="mobile-share-photo"[^]*?id="open-photo-comments"/,journey.id);
    assert.match(html,/class="photo-close"[^]*?aria-label="Close photo and video viewer"/,journey.id);
    const f=viewerFixture({journey,reducedMotion:true});f.api.openDay(journey.photos[0].dayId);
    f.click('.photo-stage');f.flush(300);
    assert.equal(f.node('.photo-viewer').dataset.chrome,'false',journey.id);
    assert.equal(f.node('.mobile-photo-actions').inert,true,journey.id);
    assert.equal(f.node('.photo-close').inert,true,journey.id);
    f.click('.photo-stage');f.click('.photo-stage');
    assert.ok(Number(f.node('#modal-photo').style.transform.match(/scale\(([^)]+)\)/)[1])>1,journey.id);
    assert.equal(f.node('.photo-viewer').dataset.zoomed,'true',journey.id);
    assert.equal(f.node('.photo-viewer').dataset.chrome,'false',journey.id);
    f.click('.photo-stage');f.flush(300);
    assert.equal(f.node('.photo-viewer').dataset.chrome,'true',journey.id);
  }
});

test('reference, demo and fresh-draft photo cards keep visible copy separate from accessibility text', t => {
  const root = fixture(t), draft = createJourney(root, input);
  const { data } = loadContent(root, { includeDrafts: true });
  for (const journey of [data.journeys.find(j => j.id === 'switzerland-italy-family-2026'), data.journeys.find(j => j.kind === 'demo'), draft]) {
    const point = { id: 'unrelated-cafe', name: 'Unrelated cafe', coordinates: [8,47], dayIds: [journey.days[0].id], photoIds: [] };
    const f = photoBubbleFixture({journey:{...journey, pointsOfInterest: [point]}});
    const photo = { id: `${journey.id}-copy-fixture`, dayId: journey.days[0].id, lat: 47, lng: 8, caption: '', description: '', alt: 'Accessible scene description', takenAt: '2028-02-28 · 12:34' };
    f.setPhotos([photo]); f.controller.open([photo]);
    assert.equal(f.node('[data-bubble-caption]').textContent, '');
    assert.equal(f.node('[data-bubble-caption]').hidden, true);
    assert.equal(f.node('[data-bubble-description]').hidden, true);
    assert.equal(f.node('[data-bubble-title]').textContent, photo.takenAt);
    assert.equal(f.node('[data-bubble-place]').hidden, true, 'Identical coordinates do not produce an About place button');
    assert.equal(f.node('img').alt, photo.alt, 'Alt text remains available to screen readers');
    point.photoIds = [photo.id]; f.controller.refresh();
    assert.equal(f.node('[data-bubble-title]').textContent, `At ${point.name}`);
    assert.equal(f.node('[data-bubble-place]').hidden, false, 'An owner-saved link remains available');
    assert.equal(f.node('[data-bubble-place]').textContent, `About ${point.name} →`);
    point.photoIds = []; f.controller.refresh();
    assert.equal(f.node('[data-bubble-title]').textContent, photo.takenAt);
    assert.equal(f.node('[data-bubble-place]').hidden, true, 'Removing a link clears the association');
    Object.assign(photo, { caption: 'Our lunch together', description: 'A note from the traveler', locationLabel: 'My chosen place label' });
    f.controller.refresh();
    assert.equal(f.node('[data-bubble-caption]').textContent, photo.caption);
    assert.equal(f.node('[data-bubble-caption]').hidden, false);
    assert.equal(f.node('[data-bubble-description]').textContent, photo.description);
    assert.equal(f.node('[data-bubble-description]').hidden, false);
    assert.equal(f.node('[data-bubble-title]').textContent, photo.locationLabel);
  }
});

test('photo intake skips undated TBD entries for the reference, demo and a fresh draft', t => {
  const root = fixture(t), draft = createJourney(root, input);
  const { data } = loadContent(root, { includeDrafts: true });
  for (const journey of [data.journeys.find(j => j.id === 'switzerland-italy-family-2026'), data.journeys.find(j => j.kind === 'demo'), data.journeys.find(j => j.id === draft.id)]) {
    const before = photoImportConfig(root, data, { journey: journey.id });
    journey.days.push({ id: `${journey.id}-future`, number: journey.days.length + 1, planningStatus: 'tbd', date: 'TBD', segmentIds: [] });
    const after = photoImportConfig(root, data, { journey: journey.id });
    assert.deepEqual([...after.daysByDate], [...before.daysByDate]);
    assert.ok(![...after.daysByDate.values()].some(day => day.id.endsWith('-future')));
  }
  const city = data.journeys.find(j => j.id === 'backpacking-europe-heading-east');
  const config = photoImportConfig(root, data, { journey: city.id });
  assert.equal(config.daysByDate.size, 59);
  assert.equal(config.daysByDate.get('2026-09-30').title, 'Düsseldorf');
  assert.equal(config.daysByDate.get('2026-10-24').title, 'Forni di Sopra');
  assert.equal(config.daysByDate.has('2026-10-30'), false);
});

test('full-trip Replay stays inaccessible while arrival works for reference, demo and populated city draft', t => {
  const root = fixture(t), draft = createJourney(root, {...input, eventMode:'city'});
  draft.places = [{id:'qa-origin', name:'Origin', lng:139.7, lat:35.6}, {id:'qa-city', name:'City', lng:139.8, lat:35.7}];
  draft.segments = [{id:'qa-leg', mode:'train', from:'qa-origin', to:'qa-city', geometry:[[139.7,35.6],[139.75,35.65],[139.8,35.7]]}];
  draft.days[0].placeId = 'qa-city'; draft.days[0].segmentIds = ['qa-leg'];
  draft.replayMoments = [{id:'qa-chapter', dayId:draft.days[0].id, segmentIds:['qa-leg'], caption:'Saved chapter', duration:8}];
  const {data,routes} = loadContent(root);
  const functions = ['openReplay','startReplay','initReplayMap'].map(name => {
    const start = app.indexOf(`  function ${name}(`);
    return app.slice(start, app.indexOf('\n  function ',start+1));
  }).join('\n');
  for (const journey of [data.journeys.find(j=>j.id==='switzerland-italy-family-2026'), data.journeys.find(j=>j.kind==='demo'), draft]) {
    const html = renderJourneyPage(root,journey,{preview:true});
    assert.doesNotMatch(html, /id="(?:open-replay|mobile-open-replay|resume-replay)"/,journey.id);
    const shell = html.match(/<dialog[^>]*id="replay-dialog"[^>]*>/)[0];
    assert.match(shell,/ hidden inert>/,journey.id);
    for(const id of ['arrival-replay','arrival-city','mobile-day-picker']) assert.ok(ids(html).includes(id),journey.id);
    const before = JSON.stringify(journey.replayMoments);
    // The real entry functions must return before touching arrival, history,
    // maps or clocks, even if old navigation requests the dormant player.
    const context = vm.createContext({journey,replayDialog:{inert:true},arrivalChapter:{phase:'arrival'}});
    vm.runInContext(functions+'\nopenReplay();startReplay();initReplayMap();',context);
    assert.equal(context.arrivalChapter.phase,'arrival');
    assert.equal(JSON.stringify(journey.replayMoments),before);
    const day = journey.days.find(d=>d.segmentIds.length);
    const segments = day.segmentIds.map(id=>journey.segments.find(s=>s.id===id));
    const plan = globalThis.JOURNEY_ATLAS_ARRIVAL.plan(segments,s=>s.geometry||routes[s.id]||[s.from,s.to].map(id=>journey.places.find(p=>p.id===id)).filter(Boolean).map(p=>[p.lng,p.lat]));
    assert.ok(plan.legs.length,journey.id);
    assert.equal(plan.duration,1500); assert.equal(plan.arrivalHold,250);
    assert.ok(globalThis.JOURNEY_ATLAS_ARRIVAL.frame(plan,.5).position.every(Number.isFinite));
  }
  const studio = read(repo,'studio/index.html');
  assert.match(studio,/<details hidden inert><summary>Curated Replay moments<\/summary>/);
  assert.doesNotMatch(app, /id="resume-replay"/);
});

test('arrival and stay controls inherit across reference, demo and fresh draft without new trip flags', t => {
  const root = fixture(t), draft = createJourney(root, input);
  const {data,routes}=loadContent(root,{includeDrafts:true});
  const family=data.journeys.find(j=>j.id==='switzerland-italy-family-2026');
  for(const journey of [family,data.journeys.find(j=>j.kind==='demo'),draft]){
    const html=renderJourneyPage(root,journey,{preview:true});
    for(const id of ['arrival-chapter','arrival-replay','arrival-city']) assert.ok(ids(html).includes(id),journey.id);
    assert.ok(assets(html).includes('arrival-chapter.js'));assert.ok(assets(html).includes('arrival-chapter.css'));
    const day=journey.days.find(day=>day.segmentIds.length)||journey.days[0];
    const segments=day.segmentIds.map(id=>journey.segments.find(s=>s.id===id)).filter(Boolean);
    const coordinate=s=>s.geometry||routes[s.id]||[];
    const plan=globalThis.JOURNEY_ATLAS_ARRIVAL.plan(segments,coordinate);
    assert.equal(plan.duration,1500,'Every journey inherits the same 1.5-second arrival');
    assert.equal(plan.arrivalHold,250,'Every journey inherits the quarter-second arrival pause');
    const place=journey.places.find(p=>p.id===(day.destinationId||day.placeId));
    const center=place?[place.lng,place.lat]:null;
    const cityPoints=globalThis.JOURNEY_ATLAS_UTILS.cityFrameCoordinates({center,photos:center?[{lng:center[0]+.01,lat:center[1]}]:[],places:[{coordinates:[12,45],dayIds:[day.id]}],dayId:day.id});
    assert.ok(cityPoints.some(point=>point[0]===12&&point[1]===45),'Marked places inherit in family, demo and fresh drafts');
    if(center) assert.ok(cityPoints.some(point=>point[0]===center[0]+.01),'Nearby photos inherit without boundary configuration');
    assert.ok(plan.legs.every(leg=>day.segmentIds.includes(leg.segment.id)));
    for(const progress of [0,.25,.5,.75,1]){
      const animated=globalThis.JOURNEY_ATLAS_ARRIVAL.frame(plan,progress,{drawLines:false});
      assert.deepEqual(animated.lines,[],'The icon can move independently of map source updates');
      if(plan.legs.length){
        assert.ok(animated.position.every(Number.isFinite),journey.id);
        const drawn=globalThis.JOURNEY_ATLAS_ARRIVAL.frame(plan,progress);
        assert.deepEqual(animated.position,drawn.lines.find(line=>line.segment.id===animated.active.segment.id).coordinates.at(-1));
      }else assert.equal(animated.position,undefined);
    }
    if(journey===draft){assert.equal(plan.legs.length,0);assert.equal(globalThis.JOURNEY_ATLAS_ARRIVAL.destination(day,journey.places,segments,coordinate),null);}
  }
});

test('city boundaries are optional, validated geometry with source attribution',t=>{
  const root=fixture(t),{data}=loadContent(root);
  const place=data.journeys[0].places[0];
  place.cityBoundary={type:'Polygon',coordinates:[[[0,0],[1,0],[1,1],[0,0]]],sourceUrl:'https://www.openstreetmap.org/relation/62422',retrievedAt:'2026-10-10'};
  assert.doesNotThrow(()=>validateJourneys(data));
  delete place.cityBoundary.sourceUrl;
  assert.throws(()=>validateJourneys(data),/city boundary/);
  place.cityBoundary.sourceUrl='https://www.openstreetmap.org/relation/62422';
  place.cityBoundary.coordinates[0][0]=[181,0];
  assert.throws(()=>validateJourneys(data),/city boundary/);
});

test('Studio readiness uses the same validation for reference, demo and fresh empty drafts', t => {
  const root = fixture(t), draft = createJourney(root, input);
  const { data } = loadContent(root, { includeDrafts:true }), state = readOverrides(root);
  for (const journey of [data.journeys.find(j => j.kind === 'real'), data.journeys.find(j => j.kind === 'demo'), data.journeys.find(j => j.id === draft.id)]) {
    const report = assessStudioReadiness(root, { journeyId:journey.id, state, stateRevision:journeyRevision(state), revision:journeyRevision(journey), changes:globalThis.JOURNEY_ATLAS_PLAN_EXTRAS.changes(journey) });
    assert.equal(report.draft.valid,true,journey.id);assert.equal(report.draft.unsaved,false,journey.id);
    assert.equal(report.public.status,'unverified',journey.id);
    assert.deepEqual(report.items.filter(item=>item.severity==='blocker').map(item=>item.id),journey.published?[]:['draft-promotion']);
    if(journey.id===draft.id){
      assert.ok(report.items.some(item=>item.id==='empty-content' && item.severity==='review'));
      assert.ok(report.items.some(item=>item.id==='day-context' && item.severity==='review'));
    }
  }
});

test('catalog, real trips, demos and fresh drafts inherit the globe icon and public share image', async t => {
  const root = fixture(t), draft = createJourney(root, input);
  buildSite(root);
  const site = JSON.parse(read(root, 'content/site.json'));
  const pages = ['index.html', 'switzerland-italy.html', 'demo.html'];
  const preview = renderJourneyPage(root, { ...draft, title: 'A <new> trip & "friends"' }, { preview: true });
  const sharp = (await import('sharp')).default;
  for (const [name, width, height] of [['favicon-16.png', 16, 16], ['favicon-32.png', 32, 32], ['apple-touch-icon.png', 180, 180], ['share.png', 1200, 630]]) {
    const output = fs.readFileSync(path.join(root, 'dist/assets/brand', name));
    assert.deepEqual(output, fs.readFileSync(path.join(root, 'content/branding', name)));
    const info = await sharp(output).metadata();
    assert.equal(info.width, width); assert.equal(info.height, height);
  }
  let sharedImage;
  for (const [file, html] of [...pages.map(file => [file, read(root, `dist/${file}`)]), ['preview', preview]]) {
    const assetBase = file === 'preview' ? '/dist/assets/brand/' : './assets/brand/';
    const icons = [...html.matchAll(/<link rel="(?:icon|apple-touch-icon)"[^>]*href="([^"]+)"/g)].map(match => match[1]);
    assert.equal(icons.length, 4, file);
    for (const href of icons) {
      assert.ok(href.startsWith(assetBase), `${file}: correct base path`);
      assert.match(href, /\?v=[a-f0-9]{12}$/);
      assert.ok(fs.existsSync(path.join(root, 'dist/assets/brand', href.slice(assetBase.length).split('?')[0])));
    }
    const image = html.match(/property="og:image" content="([^"]+)"/)[1];
    sharedImage ||= image;
    assert.equal(image, sharedImage, 'Every page uses the same public brand image');
    assert.equal(new URL(image).origin, new URL(site.url).origin);
    assert.match(image, /\/travels\/assets\/brand\/share\.png\?v=[a-f0-9]{12}$/);
    assert.ok(html.includes(`name="twitter:image" content="${image}"`));
    assert.match(html, /name="twitter:card" content="summary_large_image"/);
    assert.match(html, /property="og:image:alt" content="[^"]+"/);
    assert.match(html, /<img class="brand-mark"[^>]*alt=""/);
    assert.doesNotMatch(html, /\{\{siteHead\}\}/);
    if (file === 'preview') {
      assert.doesNotMatch(html, /property="og:url"/, 'A local draft must not claim a public URL');
      assert.match(html, /property="og:title" content="A &lt;new&gt; trip &amp; &quot;friends&quot; · Journey Atlas"/);
    } else {
      assert.ok(html.includes(`property="og:url" content="${new URL(file === 'index.html' ? '' : file, site.url).href}"`));
    }
  }
  assert.ok(!fs.existsSync(path.join(root, 'dist', draft.slug)), 'A brand update never publishes a draft');
});

function appFunction(name) {
  const start = app.indexOf(`  function ${name}(`);
  assert.ok(start >= 0, `Shared function ${name} exists`);
  const end = app.indexOf('\n  function ', start + 1);
  return app.slice(start, end < 0 ? undefined : end);
}

test('full-trip context expands real, demo and fresh-draft maps without cropping travel', t => {
  const root = fixture(t), draft = createJourney(root, input);
  const { data, routes } = loadContent(root, { includeDrafts: true });
  class Bounds {
    constructor(point) { this.west = this.east = point[0]; this.south = this.north = point[1]; }
    extend([lng, lat]) {
      this.west = Math.min(this.west, lng); this.east = Math.max(this.east, lng);
      this.south = Math.min(this.south, lat); this.north = Math.max(this.north, lat);
      return this;
    }
    contains([lng, lat]) { return lng >= this.west && lng <= this.east && lat >= this.south && lat <= this.north; }
  }
  const family = data.journeys.find(j => j.id === 'switzerland-italy-family-2026');
  for (const journey of [family, data.journeys.find(j => j.kind === 'demo'), draft]) {
    let fitted, fallback;
    const context = vm.createContext({eventWord: form => globalThis.JOURNEY_ATLAS_UTILS.eventWord({}, form), journey, mainFeedback:null,mainMapReady: true,
      window: { maplibregl: {}, JOURNEY_ATLAS_ROUTE_GEOMETRY: routes }, maplibregl: { LngLatBounds: Bounds },
      placeById: id => journey.places.find(p => p.id === id), mapPadding: () => 40,
      mainMap: { fitBounds: bounds => { fitted = bounds; }, easeTo: camera => { fallback = camera; } }
    });
    vm.runInContext(['segmentCoordinates', 'journeyCoordinates', 'boundsFromCoordinates', 'fitJourneyBounds'].map(appFunction).join('\n'), context);
    context.fitJourneyBounds(0);
    if (journey === draft) {
      assert.equal(fitted, undefined, 'Empty drafts invent no geography');
      assert.equal(fallback.zoom, 1.5);
      journey.places.push({ id: 'fresh-place', name: 'New destination', lng: 139.7, lat: 35.6 });
    } else {
      const coordinates = context.journeyCoordinates();
      assert.ok(coordinates.every(point => fitted.contains(point)), `${journey.id}: every route/place fits`);
      if (journey === family) {
        assert.ok(fitted.contains([5.956, 45.817]) && fitted.contains([10.493, 47.809]), 'All Swiss geographic extremes fit');
      } else {
        const automatic = coordinates.reduce((bounds, point) => bounds.extend(point), new Bounds(coordinates[0]));
        assert.deepEqual(fitted, automatic, 'Absent bounds preserve automatic framing');
      }
    }
    const points = context.journeyCoordinates(), point = points[0];
    journey.overviewBounds = [[point[0] - 0.5, point[1] - 0.5], [point[0] + 0.5, point[1] + 0.5]];
    context.fitJourneyBounds(0);
    assert.ok([...points, ...journey.overviewBounds].every(p => fitted.contains(p)), `${journey.id}: context and all travel fit together`);
  }
  buildSite(root);
  const published = bundle(read(root, 'dist/assets/journeys.js'), 'JOURNEY_ATLAS_DATA');
  assert.deepEqual(published.journeys.find(j => j.id === family.id).overviewBounds, [[5.9, 45.75], [10.55, 47.85]]);
});

test('overview bounds reject malformed, reversed and degenerate geographic frames', () => {
  const { data } = loadContent(repo);
  const journey = data.journeys[0];
  for (const value of [undefined, null, [[-5, 40], [10, 50]]]) {
    journey.overviewBounds = value;
    assert.doesNotThrow(() => validateJourneys(data));
  }
  for (const value of [{}, [], [[0, 0]], [[0, 0], [1, 1], [2, 2]], [[10, 40], [5, 50]],
    [[0, 50], [1, 40]], [[0, 0], [0, 1]], [[0, 0], [1, 0]], [[-181, 0], [1, 1]],
    [[0, 0], [1, 91]], [[0, 0], [NaN, 1]], [[0, 0], ['1', 1]]]) {
    journey.overviewBounds = value;
    assert.throws(() => validateJourneys(data), /overviewBounds/);
  }
});

test('selecting a real, demo or fresh-draft day scrolls its newly selected row into view', t => {
  const root = fixture(t), draft = createJourney(root, input);
  const { data } = loadContent(root);
  for (const journey of [data.journeys.find(j => j.id === 'switzerland-italy-family-2026'), data.journeys.find(j => j.kind === 'demo'), draft]) {
    const selected = journey.days[Math.min(10, journey.days.length - 1)];
    let renderedId, scrolled = false;
    const context = vm.createContext({eventWord: form => globalThis.JOURNEY_ATLAS_UTILS.eventWord({}, form), journey, activeDayId: journey.days[0].id, prefersReducedMotion: () => false,
      arrivalChapter:null,arrivalKey:day=>day.id,cancelArrival(){},locationLabels:null,clearDayPreview(){},placesUI:null,photoBubbles:null,dayById: id => journey.days.find(day => day.id === id), clearSegmentInspection() {},
      renderDays() { renderedId = context.activeDayId; }, renderStory() {}, drawMainMap() {},
      dayList: { clientHeight: 400, getBoundingClientRect: () => ({ top: 100, bottom: 500 }),
        querySelector: () => {
          assert.equal(renderedId, selected.id, 'Selection renders before scrolling');
          return { getBoundingClientRect: () => ({ top: 600, bottom: 680 }) };
        }, scrollBy: options => { assert.ok(options.top > 0); scrolled = true; } }
    });
    vm.runInContext(appFunction('scrollActiveDayIntoView') + appFunction('setActiveDay'), context);
    context.setActiveDay(selected.id, false);
    assert.ok(scrolled, journey.id);
  }
});

test('one template supplies every control and asset to real trips, all samples, and a blank new draft', t => {
  const root = fixture(t), draft = createJourney(root, input);
  const { data } = loadContent(root, { includeDrafts: true });
  buildSite(root);
  const reference = read(root, 'dist/switzerland-italy.html');
  assert.match(reference, /<script src="\.\/assets\/input-mode\.js\?v=[a-f0-9]{12}"><\/script>/);
  assert.match(read(root, 'dist/index.html'), /<script src="\.\/assets\/input-mode\.js\?v=[a-f0-9]{12}"><\/script>/);
  assert.equal(ids(reference).length, new Set(ids(reference)).size, 'No duplicate control IDs');
  for (const page of [reference, read(root, 'dist/demo.html'), read(root, 'dist/index.html'), ...data.journeys.map(journey => renderJourneyPage(root, journey, {preview:true}))]) {
    const desktopHeader = page.match(/<header class="site-header"[\s\S]*?<\/header>/)[0];
    assert.doesNotMatch(desktopHeader, /Sample journeys|Family journey|About this atlas|site-badge|open-notes/);
  }
  assert.ok(ids(reference).includes('mobile-back'), 'The shared header provides the return to all days');
  for (const id of ['open-places', 'mobile-open-places', 'places-panel', 'open-photo-comments', 'comments-dialog', 'experience-unlock']) assert.ok(ids(reference).includes(id), `Shared places/comments control ${id} exists`);
  for (const asset of ['places-comments.js', 'places-comments.css', 'places-panel.js', 'places-panel.css', 'photo-comments.js', 'photo-comments.css']) assert.ok(assets(reference).includes(asset));
  const replay = reference.match(/<dialog class="replay-dialog"[\s\S]*?<\/dialog>/)[0];
  assert.doesNotMatch(replay, /<img|replay-photo|replay-view-(?:map|photos)/, 'Replay has no photo surface or media switch');
  assert.match(replay, /id="replay-map"/);
  assert.match(replay, /id="replay-toggle"/);
  for (const id of ['mobile-photo-back', 'mobile-photo-location', 'mobile-grid-back', 'mobile-replay-back']) {
    assert.ok(ids(reference).includes(id), `Shared mobile control ${id} exists`);
    assert.match(reference, new RegExp(`<button[^>]*id="${id}"[^>]*>\\s*<svg[^>]*aria-hidden="true"`), `${id} uses a drawn icon with an accessible button label`);
  }
  for (const removed of ['mobile-menu', 'mobile-menu-open', 'mobile-photo-close', 'mobile-photo-zoom', 'mobile-grid-close']) {
    assert.ok(!ids(reference).includes(removed), `Redundant mobile control ${removed} stays absent`);
  }
  assert.match(reference, /id="mobile-day-picker"[^>]*aria-controls="mobile-journey-panel"[^>]*aria-expanded="false"/);
  const header = reference.match(/<header class="mobile-header"[\s\S]*?<\/header>/)?.[0];
  assert.doesNotMatch(header, /mobile-open-replay|>Replay</, 'Full-trip Replay is disabled on phones');
  const actions = reference.match(/<nav id="mobile-journey-actions"[\s\S]*?<\/nav>/)?.[0];
  for (const action of ['overview', 'photos', 'unlock', 'about']) assert.ok(actions?.includes(`data-journey-action="${action}"`), `${action} remains accessible in the day picker`);
  assert.ok(ids(reference).includes('mobile-story-legend'), 'Route key remains available in day details');
  for (const journey of data.journeys) {
    const preview = renderJourneyPage(root, journey, { preview: true });
    assert.deepEqual(ids(preview), ids(reference), journey.id);
    assert.deepEqual(assets(preview), assets(reference), journey.id);
    assert.match(preview, /\/api\/preview-assets\/journeys.js/);
    for (const id of ['open-places', 'mobile-open-places']) {
      assert.match(preview, new RegExp(`<button[^>]*id="${id}"[^>]* hidden[ >]`), `${journey.id}: Places stays hidden until its content is loaded`);
    }
  }
  assert.deepEqual(ids(read(root, 'dist/demo.html')), ids(reference));
  assert.deepEqual(assets(read(root, 'dist/demo.html')), assets(reference));
  assert.match(read(root, 'dist/demo.html'), /data-journey-scope="demo"/);
  assert.ok(!read(root, 'dist/assets/journeys.js').includes(draft.id));
  assert.ok(!fs.existsSync(path.join(root, 'dist', draft.slug)));
});

test('Places sheet style changes invalidate the cached stylesheet across generated journey pages', t => {
  const root = fixture(t), draft = createJourney(root, input);
  const pages = ['switzerland-italy.html', 'backpacking-europe-heading-east.html', 'demo.html'];
  const version = file => read(root, `dist/${file}`).match(/places-panel\.css\?v=([a-f0-9]{12})"/)?.[1];
  buildSite(root);
  const before = pages.map(version);
  assert.ok(before.every(Boolean), 'Places CSS must use its content hash, not the fallback version');
  fs.appendFileSync(path.join(root, 'dist/assets/places-panel.css'), '\n/* changed shared sheet style */\n');
  buildSite(root);
  for (const [index, file] of pages.entries()) assert.notEqual(version(file), before[index], file);
  assert.equal(new Set(pages.map(version)).size, 1, 'Every public trip uses the same updated stylesheet');
  assert.ok(assets(renderJourneyPage(root, draft, {preview:true})).includes('places-panel.css'), 'Draft previews load the same live stylesheet');
});

test('a shared template edit propagates on rebuild, replacing edited generated HTML', t => {
  const root = fixture(t), draft = createJourney(root, input);
  const source = path.join(root, 'content/templates/journey.html');
  fs.appendFileSync(source, '\n<!-- future-shared-feature -->\n');
  for (const file of ['switzerland-italy.html', 'demo.html', 'index.html']) fs.writeFileSync(path.join(root, 'dist', file), 'obsolete page fork');
  buildSite(root);
  for (const file of ['switzerland-italy.html', 'demo.html']) assert.match(read(root, `dist/${file}`), /future-shared-feature/);
  assert.match(renderJourneyPage(root, draft, { preview: true }), /future-shared-feature/);
  assert.match(read(root, 'dist/index.html'), /id="journey-catalog"/);
  assert.doesNotMatch(read(root, 'dist/index.html'), /obsolete page fork/);
});

test('Studio planner requests preserve the shared group/video contract for the reference, a demo and a fresh draft', t => {
  const root=fixture(t), draft=createJourney(root,input), {data}=loadContent(root,{includeDrafts:true}), state=readOverrides(root);
  const targets=[data.journeys.find(j=>j.kind==='real' && j.published),data.journeys.find(j=>j.kind === 'demo' && j.routeGroups?.length),data.journeys.find(j=>j.id===draft.id)];
  for(const journey of targets) {
    const changes=globalThis.JOURNEY_ATLAS_PLAN_EXTRAS.changes(journey);
    assert.deepEqual(Object.keys(changes.photoGroups),journey.photos.map(photo=>photo.id));
    const result=prepareJourneyPlan(data,journey,changes,state).journey;
    for(const key of ['travelers','routeGroups','meetup','videos','photos','segments','days']) assert.deepEqual(result[key],journey[key],`${journey.id}: ${key}`);
    assert.equal(result.photoGroups,undefined,'Photo assignments are an edit operation, not a second stored model');
  }
});

test('every sample supports calendar editing and the same photo intake configuration as real trips', () => {
  const { data } = loadContent(repo);
  for (const journey of data.journeys.filter(j => j.kind === 'demo')) {
    const config = photoImportConfig(repo, data, { journey: journey.id });
    assert.equal(config.daysByDate.size, journey.days.length);
    const edited = prepareJourneyPlan(data, journey, { subtitle: 'Edited sample' }, { days: {}, photos: {}, routes: {} });
    assert.equal(edited.journey.subtitle, 'Edited sample');
    assert.match(journey.note, /Fictional sample/);
  }
});

test('a fresh trip inherits ordered travel, albums, cover selection and automatic/curated Replay through data alone', t => {
  const root = fixture(t), draft = createJourney(root, input), prefix = draft.id;
  const { data } = loadContent(root, { includeDrafts: true });
  const places = [{ id: `${prefix}-a`, name: 'Start', lng: 139.7, lat: 35.6 }, { id: `${prefix}-b`, name: 'Finish', lng: 139.8, lat: 35.7 }];
  const segments = ['train', 'walk'].map((mode, i) => ({ id: `${prefix}-leg-${i}`, mode, from: places[0].id, to: places[1].id, geometry: [[139.7, 35.6], [139.8, 35.7]], distanceKm: 3 }));
  const photos = [1, 2].map(n => ({ id: `${prefix}-photo-${n}`, dayId: draft.days[0].id, src: `https://example.com/${n}.webp`, lat: 35.6, lng: 139.7 }));
  writeJson(path.join(root, `build/draft-assets/${prefix}/photos.json`), photos);
  const days = structuredClone(draft.days);
  days[0].segmentIds = segments.map(s => s.id); days[0].placeId = places[1].id;
  const base = { ...draft, photos };
  const state = { photos: {}, routes: {}, days: { [days[0].id]: { photoOrder: photos.map(p => p.id).reverse(), leadPhotoId: photos[0].id } } };
  const { journey } = prepareJourneyPlan({ ...data, journeys: data.journeys.map(j => j.id === prefix ? base : j) }, base, {
    places, segments, days, coverPhoto: { photoId: photos[1].id, focal: [30, 60] }
  }, state);
  writeJson(path.join(root, `content/drafts/${prefix}.json`), { ...journey, photos: [] });
  writeJson(path.join(root, 'build/studio-draft-overrides.json'), state);
  const preview = bundle(studioAsset(root, 'journeys'), 'JOURNEY_ATLAS_DATA').journeys.find(j => j.id === prefix);
  preview.days = preview.days.map(day => ({ ...day, ...readOverrides(root).days[day.id] }));
  const cover = globalThis.JOURNEY_ATLAS_UTILS.resolveCover(preview, preview.photos);
  assert.equal(cover.photo.id, photos[1].id); assert.equal(cover.position, '30% 60%');
  const automatic = globalThis.JOURNEY_ATLAS_REPLAY.createTimeline(preview);
  assert.deepEqual(automatic.filter(m => m.type === 'segment').map(m => m.segmentId), segments.map(s => s.id));
  assert.ok(automatic.every(m => m.type !== 'photo' && !m.photoId), 'Replay uses only routes and days');
  assert.equal(automatic.filter(m => m.type === 'day').length, 2, 'Rest days remain in Replay');
  journey.replayMoments = [{ id: `${prefix}-chapter`, dayId: days[0].id, segmentIds: days[0].segmentIds, photoId: photos[1].id, caption: 'An editorial choice', duration: 12 }];
  const curated = globalThis.JOURNEY_ATLAS_REPLAY.createTimeline(journey);
  assert.equal(curated[0].curated, true);
  assert.equal(curated[0].photoId, undefined);
  assert.deepEqual(curated[0].segmentIds, segments.map(s => s.id));
  // Promote only this synthetic fixture; never publish a test trip to the repository.
  fs.unlinkSync(path.join(root, `content/drafts/${prefix}.json`));
  writeJson(path.join(root, `content/journeys/${prefix}.json`), { ...journey, published: true, photos: [] });
  writeJson(path.join(root, `content/photo-manifests/${prefix}.json`), photos);
  writeJson(path.join(root, 'content/day-overrides.json'), { ...JSON.parse(read(root, 'content/day-overrides.json')), ...state.days });
  buildSite(root);
  const published = bundle(read(root, 'dist/assets/journeys.js'), 'JOURNEY_ATLAS_DATA').journeys.find(j => j.id === prefix);
  assert.deepEqual(published.coverPhoto, journey.coverPhoto);
  assert.deepEqual(published.replayMoments, journey.replayMoments);
  assert.deepEqual(ids(read(root, `dist/${journey.slug}`)), ids(read(root, 'dist/switzerland-italy.html')));
});

test('the same introduction opens for real trips, samples and empty drafts; deep links retain direct entry', () => {
  for (const isDemoPage of [false, true]) for (const hasPhoto of [false, true]) {
    const nodes = new Map();
    const $ = selector => { if (!nodes.has(selector)) nodes.set(selector, { hidden: true, inert: false, style: { setProperty() {} } }); return nodes.get(selector); };
    const context = vm.createContext({eventWord: form => globalThis.JOURNEY_ATLAS_UTILS.eventWord({}, form), $, isDemoPage, location: { hash: '', search: '' }, URLSearchParams,
      journey: { title: 'New trip', subtitle: '', dates: 'Tomorrow', days: [{}], photos: hasPhoto ? [{ id: 'photo' }] : [] },
      document: { body: { classList: { add() {} } } }, window: { JOURNEY_ATLAS_UTILS: globalThis.JOURNEY_ATLAS_UTILS },
      escapeHtml: value => value, photoImageMarkup: () => '<img alt="Sample" />', orderedPhotos: () => hasPhoto ? [{id:'photo'}] : [], prepareProgressiveImages() {}
    });
    vm.runInContext(appFunction('renderIntroduction') + '\nrenderIntroduction()', context);
    assert.equal($('#trip-intro').hidden, false);
    assert.equal($('.atlas-shell').inert, true);
    assert.match($('#intro-relive').textContent, hasPhoto ? /Explore the journey/ : /View days/);
    if (!hasPhoto) assert.match($('.intro-photo').innerHTML, /A journey taking shape/);
    assert.equal($('.intro-scroll').scrollTop,0,'Each introduction starts at its beginning');
    for (const [hash, search] of [['#day=d1', ''], ['', '?photo=p1']]) {
      context.location = { hash, search };
      vm.runInContext('renderIntroduction()', context);
      assert.equal($('#trip-intro').hidden, true);
    }
  }
});

test('one opening action reaches the whole-trip map for reference, Heading East, demo and a populated fresh draft', t => {
  const root=fixture(t), draft=createJourney(root,{...input,eventMode:'city'}), {data}=loadContent(root);
  const populated={...draft,places:[{id:'qa-stay',name:'A new stay',lng:139.8,lat:35.7}],days:draft.days.map(day=>({...day,placeId:'qa-stay'}))};
  for(const journey of [data.journeys.find(j=>j.id==='switzerland-italy-family-2026'),data.journeys.find(j=>j.id==='backpacking-europe-heading-east'),data.journeys.find(j=>j.kind==='demo'),draft,populated]) {
    const nodes=new Map(), calls=[];
    const $=selector=>{if(!nodes.has(selector))nodes.set(selector,{hidden:true,inert:false,style:{setProperty(){}}});return nodes.get(selector);};
    const context=vm.createContext({journey,$,location:{hash:'',search:''},URLSearchParams,
      eventWord:form=>globalThis.JOURNEY_ATLAS_UTILS.eventWord(journey,form),
      window:{JOURNEY_ATLAS_UTILS:globalThis.JOURNEY_ATLAS_UTILS},document:{body:{classList:{add(){},remove(){}}}},
      escapeHtml:value=>value,photoImageMarkup:()=>'<img alt="Fixture" />',orderedPhotos:()=>journey.photos||[],prepareProgressiveImages(){},
      setMobileTab:tab=>calls.push(tab),openJourneyMap:()=>calls.push('whole-trip-map-with-opening-trace'),
      setActiveDay:()=>assert.fail('Opening must not focus an individual day'),
      dayList:{querySelector:()=>({focus:()=>calls.push('day-list-focus')})}
    });
    vm.runInContext(appFunction('renderIntroduction')+'\n'+appFunction('dismissIntroduction')+'\nrenderIntroduction()',context);
    const html=renderJourneyPage(root,journey,{preview:true}).match(/<section id="trip-intro"[\s\S]*?<\/section>/)[0];
    assert.equal((html.match(/<button\b/g)||[]).length,1,journey.id);
    assert.doesNotMatch(html,/id="intro-map"/);
    assert.match(html,/<div class="intro-scroll" tabindex="0" role="region" aria-label="Journey introduction details">[\s\S]*?<div class="intro-copy"><\/div>\s*<\/div>\s*<div class="intro-actions">/, 'The keyboard-scrollable content and action are siblings');
    const longIntroduction='An independently authored introduction. '.repeat(200);
    context.journey={...journey,subtitle:longIntroduction};
    vm.runInContext('renderIntroduction()',context);
    assert.ok($('.intro-copy').innerHTML.includes(globalThis.JOURNEY_ATLAS_UTILS.journeyPresentation(context.journey).introduction),'Long descriptions remain complete; empty drafts retain their deliberate fallback');
    $('#intro-relive').onclick();
    assert.equal($('#trip-intro').hidden,true);assert.equal($('.atlas-shell').inert,false);
    const mapped=globalThis.JOURNEY_ATLAS_UTILS.journeyPresentation(journey).hasMap;
    assert.deepEqual(calls,mapped?['whole-trip-map-with-opening-trace']:['route','day-list-focus'],journey.id);
  }
});

test('shared browser code and HTML templates contain no concrete trip IDs or URLs', () => {
  const { data } = loadContent(repo);
  for (const filename of ['dist/assets/places-panel.js', 'dist/assets/photo-comments.js', 'dist/assets/places-panel.css', 'dist/assets/photo-comments.css', 'dist/assets/places-comments.js', 'dist/assets/places-comments.css', 'dist/assets/app.js', 'dist/assets/map-style.js', 'dist/assets/location-labels.js', 'dist/assets/atlas-utils.js', 'dist/assets/replay-utils.js', 'dist/assets/catalog.js', 'dist/assets/mobile-ux.js', 'dist/assets/mobile.css', 'dist/assets/input-mode.js', 'dist/assets/group-travel.js', 'dist/assets/media-utils.js', 'studio/studio.js', 'studio/plan-extras.js', 'content/templates/journey.html', 'content/templates/catalog.html']) {
    const source = read(repo, filename);
    for (const journey of data.journeys) {
      assert.ok(!source.includes(journey.id), `${filename} must express ${journey.id} behavior through data`);
      if (journey.slug) assert.ok(!source.includes(journey.slug), `${filename} must not link to a specific trip`);
    }
  }
});

test('focus presentation follows keyboard and pointer input without moving or clearing focus', () => {
  const handlers = new Map(), root = { dataset: {} }, focused = { id: 'restored-dialog-button' };
  const document = { documentElement: root, activeElement: focused,
    addEventListener(type, handler, capture) { assert.equal(capture, true); handlers.set(type, handler); }
  };
  vm.runInNewContext(read(repo, 'dist/assets/input-mode.js'), { document });
  assert.equal(root.dataset.inputMode, 'pointer', 'Auto-focused controls do not begin with a keyboard ring');
  for (const pointerType of ['touch', 'mouse', 'pen']) {
    for (const key of ['Tab', 'ArrowRight', 'Enter', ' ']) {
      handlers.get('keydown')({ key });
      assert.equal(root.dataset.inputMode, 'keyboard');
      handlers.get('pointerdown')({ pointerType });
      assert.equal(root.dataset.inputMode, 'pointer', `${pointerType} clears a preceding keyboard ring`);
      assert.equal(document.activeElement, focused, 'Dialog/history focus remains intact');
    }
  }
  handlers.get('keydown')({ key: 'Shift' });
  handlers.get('keydown')({ key: 'r', metaKey: true });
  assert.equal(root.dataset.inputMode, 'pointer', 'Modifier and browser shortcuts do not create rings');
  handlers.get('keydown')({ key: 'Tab', shiftKey: true });
  assert.equal(root.dataset.inputMode, 'keyboard', 'Reverse keyboard navigation retains a visible cue');
});

test('a newly generated draft inherits large endpoints for every train leg as route data is added', t => {
  const root = fixture(t), draft = createJourney(root, input);
  const context = vm.createContext({eventWord: form => globalThis.JOURNEY_ATLAS_UTILS.eventWord({}, form), journey: draft,
    placeById: id => draft.places.find(place => place.id === id),
    segmentsForDay: day => day.segmentIds.map(id => draft.segments.find(segment => segment.id === id)),
    segmentCoordinates: segment => segment.geometry
  });
  vm.runInContext(appFunction('dayMapStops') + appFunction('railStopCoordinate'), context);
  assert.equal(context.dayMapStops(null,draft.days[0]).length,0, 'Empty drafts invent no endpoints');
  assert.equal(context.dayMapStops(null,null).length,0, 'Empty overview maps invent no endpoints');
  draft.places.push({id:'new-start',name:'New start',lng:139.7,lat:35.6},{id:'new-arrival',name:'New arrival',lng:139.8,lat:35.7});
  draft.segments.push({id:'new-leg',mode:'train',from:'new-start',to:'new-arrival',geometry:[[139.7,35.6],[139.801,35.701]]});
  draft.days[0].placeId = 'new-arrival'; draft.days[0].segmentIds = ['new-leg'];
  const stops = context.dayMapStops(null,draft.days[0]);
  assert.equal(stops[1].coordinate[0],139.801); assert.equal(stops[1].coordinate[1],35.701);
  assert.deepEqual(Array.from(stops,stop=>stop.endpoint),['Start','End']);
  draft.places.push({id:'new-finish',name:'New finish',lng:139.9,lat:35.8});
  draft.segments.push({id:'new-connection',mode:'train',from:'new-arrival',to:'new-finish',geometry:[[139.801,35.701],[139.9,35.8]]});
  draft.days[0].segmentIds.push('new-connection');
  assert.deepEqual(Array.from(context.dayMapStops(null,draft.days[0]),stop=>stop.endpoint),['Start','Start and end','End']);
  assert.deepEqual(Array.from(context.dayMapStops(null,null),stop=>stop.endpoint),['Start','Start and end','End'],'A populated fresh draft inherits overview endpoints');
  vm.runInContext(appFunction('revealStopsWithRoutes'),context);
  const sources = new Map(draft.segments.map(segment=>[segment.id,{}])), listeners = new Map();
  const elements = [{style:{visibility:'hidden'}}];
  const decorations = {routeLayers:draft.segments.map(segment=>({segmentId:segment.id,sourceId:segment.id,lineId:segment.id}))};
  let loaded = false, rendered = false;
  const map = {getSource:id=>sources.get(id),getLayer:()=>true,isSourceLoaded:()=>loaded,
    queryRenderedFeatures:()=>rendered?[{}]:[],on:(name,fn)=>listeners.set(name,fn),off:name=>listeners.delete(name),triggerRepaint(){}};
  context.revealStopsWithRoutes(map,decorations,draft.days[0],elements);
  loaded=true; listeners.get('render')(); assert.equal(elements[0].style.visibility,'hidden');
  rendered=true; listeners.get('render')(); assert.equal(elements[0].style.visibility,'');
  assert.equal(listeners.size,0);
  assert.deepEqual(assets(renderJourneyPage(root,draft,{preview:true})),assets(read(root,'dist/switzerland-italy.html')));
});


test('real, demo and fresh draft share routing readiness and explicit replacement of preserved routes', t => {
  const root = fixture(t), draft = createJourney(root, input);
  const prefix = draft.id;
  const places = [{ id: `${prefix}-start`, name: 'Start', lng: 0, lat: 0 }, { id: `${prefix}-end`, name: 'End', lng: 0.02, lat: 0 }];
  const segment = { id: `${prefix}-bike`, from: places[0].id, to: places[1].id, mode: 'bike' };
  draft.places = places; draft.segments = [segment]; draft.days[0].segmentIds = [segment.id];
  writeJson(path.join(root, `content/drafts/${draft.id}.json`), draft);
  const { data } = loadContent(root, { includeDrafts: true });
  const journeys = [data.journeys.find(j => j.kind !== 'demo' && j.published), data.journeys.find(j => j.kind === 'demo'), data.journeys.find(j => j.id === draft.id)];
  fs.copyFileSync(path.join(repo, 'test/fixtures/routes/ordered-stops.json'), path.join(root, 'network.json'));
  for (const journey of journeys) {
    const leg = journey.segments.find(s => s.mode !== 'gondola');
    const manifestPath = path.join(root, journey.published === false ? `build/draft-assets/${journey.id}/route-sources.json` : `content/route-sources/${journey.id}.json`);
    fs.rmSync(manifestPath, { force: true });
    const options = { repoRoot: root, journeyId: journey.id, segmentId: leg.id };
    assert.equal(studioRouteAvailability(options).available, false, journey.id);
    assert.match(studioRouteAvailability(options).message, /Ask the agent/);
    writeJson(manifestPath, { modeNetworks: { [leg.mode]: 'local' }, networks: { local: { input: 'network.json' } }, segments: { [leg.id]: { strategy: 'preserve' } } });
    assert.equal(studioRouteAvailability(options).available, true, journey.id);
    const anchors = [[0,0], [0.01,0.01], [0.02,0]];
    assert.deepEqual(proposeStudioRoute({ ...options, controlPoints: anchors }).geometry, anchors, journey.id);
  }
});

test('group routes and day videos are shared by the reference, sample and a fresh draft', t => {
  const root = fixture(t), draft = createJourney(root, input);
  const { data } = loadContent(root, { includeDrafts: true });
  const sample = data.journeys.find(j => j.kind === 'demo' && j.routeGroups?.length);
  assert.equal(sample.travelers.length, 9);
  assert.equal(sample.routeGroups.length, 3);
  const utils = globalThis.JOURNEY_ATLAS_GROUPS;
  for (const journey of [data.journeys.find(j => j.kind === 'real' && j.published), sample, draft]) {
    const html = renderJourneyPage(root, journey, { preview: true });
    for (const id of ['travel-party', 'viewer-video', 'journey-video', 'mobile-routes-action', 'viewer-video-play']) assert.ok(ids(html).includes(id));
    assert.match(html, /<video id="journey-video" controls playsinline preload="none"/);
    assert.ok(html.indexOf('id="journey-video"') > html.indexOf('id="photo-dialog"'));
    assert.ok(html.indexOf('id="journey-video"') < html.indexOf('id="replay-dialog"'));
    assert.doesNotMatch(html, /id="video-dialog"|id="mobile-day-videos"/);
    assert.equal(utils.projectJourney(journey, 'missing-group'), journey, 'Absent groups preserve existing behavior');
  }
  for (const group of sample.routeGroups) {
    const selected = utils.projectJourney(sample, group.id);
    assert.equal(selected.segments.length, 2);
    assert.equal(selected.days[1].destinationId, sample.meetup.placeId);
    assert.equal(selected.days[2].segmentIds.length, 0, 'Shared rest day remains');
    const replay = globalThis.JOURNEY_ATLAS_REPLAY.createTimeline(selected);
    assert.deepEqual(replay.filter(m => m.segmentId).map(m => m.segmentId), selected.segments.map(s => s.id));
  }
  const before = JSON.stringify(draft);
  // New dates/places/people are fixture data, never copied from a family itinerary.
  const p = draft.id;
  const planned = { ...draft,
    travelers: [{ id: 'one', name: 'One' }, { id: 'two', name: 'Two' }],
    routeGroups: [{ id: 'first', label: 'First route', travelerIds: ['one'] }, { id: 'second', label: 'Second route', travelerIds: ['two'] }],
    places: [{ id:'a', name:'A', lng:139.7, lat:35.6 }, { id:'b', name:'B', lng:139.8, lat:35.7 }, { id:'c', name:'C', lng:139.9, lat:35.8 }],
    segments: [{ id:`${p}-first`, mode:'train', from:'a', to:'b', groupIds:['first'] }, { id:`${p}-second`, mode:'bike', from:'a', to:'b', groupIds:['second'] }, { id:`${p}-shared`, mode:'walk', from:'b', to:'c' }],
    videos: [{ ...sample.videos[0], id:`${p}-video`, dayId:draft.days[0].id, groupIds:['second'] }]
  };
  planned.days = structuredClone(draft.days);
  planned.days[0].segmentIds = planned.segments.map(s => s.id);
  planned.days[1].groupPlaces = { first:'c', second:'b' };
  validateJourneyExtras(planned);
  for (const group of planned.routeGroups) {
    const selected = utils.projectJourney(planned, group.id);
    assert.equal(selected.segments.length, 2);
    assert.equal(selected.segments.at(-1).id, `${p}-shared`);
    assert.equal(selected.days[1].placeId, planned.days[1].groupPlaces[group.id], 'Separate overnight places also work on rest days');
    assert.equal(selected.videos.length, group.id === 'second' ? 1 : 0);
  }
  assert.equal(JSON.stringify(draft), before, 'Filtering never mutates the original draft');
  const changes = Object.fromEntries(['travelers','routeGroups','places','segments','days','videos'].map(key => [key, planned[key]]));
  const edited = prepareJourneyPlan(data, draft, changes, { days:{}, photos:{}, routes:{} });
  writeJson(path.join(root, `content/drafts/${draft.id}.json`), edited.journey);
  const saved = loadContent(root, { includeDrafts:true }).data.journeys.find(j => j.id === draft.id);
  assert.equal(saved.videos.length, 1);
  const media = globalThis.JOURNEY_ATLAS_MEDIA.items(saved);
  assert.equal(media.length,1); assert.equal(media[0].dayId,saved.days[0].id);
  assert.equal(media[0].mediaType,'video', 'A video-only fresh draft uses the shared gallery');
});

test('photo and video IDs cannot collide in the shared viewer or across journeys', () => {
  const {data} = loadContent(repo), sample = data.journeys.find(j=>j.videos?.length);
  sample.videos[0].id = sample.photos[0].id;
  assert.throws(() => validateJourneys(data), /duplicate.*ID/i);
  sample.videos[0].id = data.journeys.find(j=>j!==sample && j.photos.length).photos[0].id;
  assert.throws(() => validateJourneys(data), /duplicate.*ID/i);
});

test('group and media validation reject broken references, false meetups and unsafe/publication-ambiguous video sources', () => {
  const source = loadContent(repo).data.journeys.find(j => j.kind === 'demo' && j.routeGroups?.length);
  const invalid = [
    [j => j.travelers.push({ id:j.travelers[0].id, name:'Duplicate' }), /duplicate travelers/],
    [j => j.routeGroups[1].travelerIds.push(j.travelers[0].id), /only one route group/],
    [j => j.segments[0].groupIds = ['missing'], /groupIds/],
    [j => j.meetup.placeId = j.segments[0].from, /does not end at the meetup/],
    [j => j.days[0].groupPlaces['mountain-rail'] = 'missing', /overnight place/],
    [j => j.videos[0].dayId = 'missing', /unknown day/],
    [j => j.videos[0].src = 'javascript:alert(1)', /HTTPS/],
    [j => j.videos[0].poster = 'http://example.com/poster.jpg', /poster URL/],
    [j => delete j.videos[0].visibility, /explicitly public/],
    [j => j.videos[0].visibility = 'private', /explicitly public/],
    [j => j.videos[0].durationSeconds = -1, /duration/]
  ];
  for (const [mutate, message] of invalid) { const copy = structuredClone(source); mutate(copy); assert.throws(() => validateJourneyExtras(copy), message); }
});

test('build omits hidden/local videos and planner protects days containing only video', t => {
  const root = fixture(t), draft = createJourney(root, input);
  const { data } = loadContent(root, { includeDrafts:true });
  const sample = data.journeys.find(j => j.videos?.length);
  sample.videos.push({ ...sample.videos[0], id:'hidden-clip', hidden:true, src:'https://example.com/HIDDEN-CLIP.mp4' });
  sample.videos.push({ ...sample.videos[0], id:'local-clip', assetStatus:'local', src:'https://example.com/LOCAL-CLIP.mp4' });
  writeJson(path.join(root, `content/journeys/${sample.id}.json`), sample);
  buildSite(root);
  const publicBundle = read(root, 'dist/assets/journeys.js');
  assert.doesNotMatch(publicBundle, /HIDDEN-CLIP|LOCAL-CLIP/);
  draft.videos = [{ ...sample.videos[0], dayId:draft.days.at(-1).id }];
  assert.throws(() => prepareJourneyPlan(data, draft, { endDate:draft.days[1].calendarDate }, { days:{}, photos:{}, routes:{} }), /has content/);
});

test('unified media items keep photo order and include day-linked video thumbnails', () => {
  const media = globalThis.JOURNEY_ATLAS_MEDIA;
  const photo = {id:'photo', dayId:'d1', src:'https://example.com/photo.webp'};
  const clip = {id:'clip', dayId:'d1', src:'https://example.com/video.mp4', title:'A <scene>', caption:'Description', durationSeconds:5};
  const source = {photos:[photo], videos:[clip, {...clip,id:'hidden',hidden:true}]};
  const all = media.items(source);
  assert.equal(all.length,2); assert.equal(all[0],photo);
  assert.equal(all[1].mediaType,'video'); assert.equal(all[1].videoSrc,clip.src);
  assert.equal(all[1].src,'', 'Video bytes never enter an image loader');
  assert.equal(media.label(all),'1 photo · 1 video');
  const thumbnail = media.thumbnail(all[1]);
  assert.match(thumbnail, /data-video-poster="clip"/); assert.match(thumbnail, /A &lt;scene&gt;/);
  assert.match(thumbnail, /0:05/); assert.doesNotMatch(thumbnail, /video.mp4/);
  assert.equal(clip.mediaType,undefined, 'Normalization does not mutate source content');
});

test('video playback uses the existing viewer and stops, releases and retries media safely', async () => {
  const media = globalThis.JOURNEY_ATLAS_MEDIA;
  const node = () => ({ listeners:{}, hidden:false, textContent:'', addEventListener(name, fn) { this.listeners[name] = fn; }, setAttribute(key, value) { this[key] = value; }, removeAttribute(key) { delete this[key]; } });
  const video = { ...node(), pauseCount:0, playCount:0, loadCount:0, pause() { this.pauseCount++; }, play() { this.playCount++; return Promise.resolve(); }, load() { this.loadCount++; } };
  let resolvePoster;
  const options = { video, shell:node(), play:node(), status:node(), retry:node(), sourceLink:node(), posters:{get:()=>new Promise(resolve=>{resolvePoster=resolve;})} };
  const player = media.createVideoPlayer(options);
  const item = { id:'clip', title:'Title', videoSrc:'https://example.com/clip.mp4' };
  player.show(item); assert.equal(options.shell.hidden,false); assert.equal(video.src,item.videoSrc);
  assert.equal(video.playCount,0, 'Opening a thumbnail does not autoplay');
  await options.play.listeners.click(); assert.equal(video.playCount,1);
  video.listeners.error(); assert.equal(options.retry.hidden,false);
  options.retry.listeners.click(); assert.equal(video.src,item.videoSrc);
  player.pause(); assert.ok(video.pauseCount>0);
  player.stop(); assert.equal(video.src,undefined); assert.equal(options.shell.hidden,true);
  resolvePoster('https://example.com/old-frame.webp'); await Promise.resolve();
  assert.equal(video.poster,undefined, 'A late thumbnail cannot appear over a new photo');
  video.listeners.error(); assert.equal(options.status.textContent,'');
});

test('Day details include the full roster, route and overnight for each group, including shared rest days', () => {
  const groups = globalThis.JOURNEY_ATLAS_GROUPS;
  const sample = loadContent(repo).data.journeys.find(j => j.kind === 'demo' && j.routeGroups?.length);
  const first = groups.dayDetails(sample, sample.days[0], 'lake-ferry');
  for (const traveler of sample.travelers) assert.ok(first.includes(traveler.name));
  for (const place of ['Lugano','Varenna','Menaggio']) assert.ok(first.includes(`Overnight: ${place}`));
  assert.match(first, /Who went which way/); assert.match(first, /Showing this route/);
  const arrival = groups.dayDetails(sample, sample.days[1]);
  assert.match(arrival, /Everyone meets in Como/); assert.match(arrival, /Dinner together/);
  const rest = groups.dayGroups(sample,sample.days[2]);
  assert.ok(rest.every(group => group.segments.length===0 && group.to.name==='Como'));
  assert.equal(groups.dayDetails({routeGroups:[]},{}),'');
});

test('location labels are inherited by real trips, samples, and a fresh data-only draft', t => {
  const root = fixture(t), draft = createJourney(root, input);
  const code = read(repo, 'dist/assets/location-labels.js');
  const context = vm.createContext({eventWord: form => globalThis.JOURNEY_ATLAS_UTILS.eventWord({}, form),}); vm.runInContext(code,context);
  const labels = context.JOURNEY_ATLAS_LOCATION_LABELS;
  const hooks = journey => ({ destinationForDay: day => journey.places.find(p=>p.id===(day.destinationId||day.placeId)),
    segmentsForDay: day => day.segmentIds.map(id=>journey.segments.find(s=>s.id===id)),
    segmentCoordinates:segment=>segment.geometry || [segment.from,segment.to].map(id=>{const place=journey.places.find(p=>p.id===id);return [place.lng,place.lat];}) });
  assert.equal(labels.groupsForJourney(draft,hooks(draft),draft.days[0].id,'journey').length,0,'Blank days invent no destinations');
  draft.places.push({id:'new-place',name:'New place',lng:139.7,lat:35.6});
  draft.days[0].placeId='new-place'; draft.days[1].placeId='new-place';
  const groups = labels.groupsForJourney(draft,hooks(draft),draft.days[1].id,'journey');
  assert.equal(groups.length,1); assert.equal(groups[0].days.length,2); assert.equal(groups[0].name,'New place');
  assert.equal(groups[0].selected,true);
  const pins = labels.clusterGroups(groups, ([x,y]) => ({x,y}), 44);
  assert.equal(pins.length,1); assert.equal(pins[0].days.length,2, 'Repeat stays become one unnumbered pin with every day retained');
  assert.deepEqual(Array.from(pins[0].members,member=>member.name),['New place']);
  draft.places.push({id:'next-place',name:'Next place',lng:139.8,lat:35.7});
  draft.days[2].placeId='next-place';
  const {data} = loadContent(root);
  for (const journey of [data.journeys.find(j=>j.kind!=='demo'), data.journeys.find(j=>j.kind==='demo'),draft]) {
    assert.ok(assets(renderJourneyPage(root,journey,{preview:true})).includes('location-labels.js'));
    for (const group of labels.groupsForJourney(journey,hooks(journey),journey.days[0].id,'journey')) {
      const placement=labels.placePin({x:100,y:100},{dot:group.days.length>1,targetSize:44,bounds:{left:0,right:320,top:0,bottom:300}});
      assert.equal(placement.offset[0],0);
      assert.equal(placement.postHeight,group.days.length>1?0:18,'Every journey inherits upright signposts and repeated-stay dots');
    }
  }
  buildSite(root);
  assert.match(read(root,'dist/switzerland-italy.html'),/location-labels\.js\?v=[a-f0-9]+/);
});


test('real, demo and a fresh draft inherit settlement contrast and route stacking', t => {
  const root = fixture(t), draft = createJourney(root, input);
  const { data } = loadContent(root, { includeDrafts: true });
  const journeys = [data.journeys.find(j => j.kind === 'real'), data.journeys.find(j => j.kind === 'demo'), draft];
  const mapStyle = globalThis.JOURNEY_ATLAS_MAP_STYLE;
  for (const journey of journeys) {
    const html = renderJourneyPage(root, journey, { preview: true });
    assert.ok(assets(html).includes('map-style.js'), journey.id);
    assert.ok(assets(html).indexOf('map-style.js') < assets(html).indexOf('app.js'));
    const map = mapStyleHarness();
    mapStyle.applyBasemapTreatment(map);
    const context = vm.createContext({eventWord: form => globalThis.JOURNEY_ATLAS_UTILS.eventWord({}, form), window: { JOURNEY_ATLAS_MAP_STYLE: mapStyle },
      modeStyles: { train: { width: 5.8, color: '#0072b2' } }, palette: { casing: '#fffef8' },
      segmentCoordinates: segment => segment.geometry || [[0, 0], [0.1, 0.1]]
    });
    vm.runInContext(appFunction('addSegmentLayer'), context);
    const segment = journey.segments.find(s => s.mode === 'train') || { id: 'fresh-draft-leg', mode: 'train' };
    const decorations = { layerIds: [], sourceIds: [], hitLayerIds: [] };
    context.addSegmentLayer(map, decorations, segment, { prefix: 'test', selected: true, interactive: true, opacity: 1 });
    const layerIds = map.getStyle().layers.map(l => l.id);
    for (const id of decorations.layerIds) {
      assert.ok(layerIds.indexOf(id) > layerIds.indexOf('highway-shield-non-us'), journey.id);
      assert.ok(layerIds.indexOf(id) < layerIds.indexOf('label_village'), journey.id);
    }
    assert.equal(map.getLayer('label_city').paint['text-halo-width'], 2);
  }
  const studio = read(repo, 'studio/index.html');
  assert.ok(studio.indexOf('/dist/assets/map-style.js') < studio.indexOf('/studio.js'));
});

test('desktop leg previews and mobile tap rows carry over to real, demo and a newly populated draft', async t => {
  const { legPreviewHarness } = await import('./route-leg-preview-harness.mjs');
  const root = fixture(t), draft = createJourney(root, input);
  assert.equal(legPreviewHarness(draft).context.renderRouteLegs(draft.days[0]), '', 'Empty drafts invent no legs');
  draft.places = [{ id: 'fresh-start', name: 'Start' }, { id: 'fresh-end', name: 'End' }];
  draft.segments = ['train', 'boat'].map((mode, i) => ({ id: `fresh-leg-${i}`, from: 'fresh-start', to: 'fresh-end', mode }));
  draft.days[0].segmentIds = draft.segments.map(segment => segment.id);
  const { data } = loadContent(root);
  for (const journey of [data.journeys.find(j => j.kind === 'real' && j.published), data.journeys.find(j => j.kind === 'demo'), draft]) {
    const h = legPreviewHarness(journey), day = journey.days.find(day => day.segmentIds.length);
    const markup = h.context.renderRouteLegs(day);
    assert.match(markup, /<div class="leg-card" tabindex="0" role="group"/);
    assert.doesNotMatch(markup, /<button|aria-label="Explore/);
    const card = h.cards.find(card => card.dataset.routeSegment === day.segmentIds[0]);
    h.fire('mouseover', card);
    for (const segment of journey.segments) {
      assert.equal(h.states.get(segment.id).previewed, segment.id === day.segmentIds[0], `${journey.id}: ${segment.id}`);
      if (segment.id !== day.segmentIds[0]) assert.equal(h.paint(segment.id, 'line-color'), '#92999a');
    }
    h.fire('mouseout', card); assert.ok([...h.states.values()].every(state => !state.previewed && !state.previewMuted && !state.legMuted));
    h.setMobile(true); assert.match(h.context.renderRouteLegs(day), /<button class="leg-card" type="button"/);
    h.setMobile(false); assert.match(h.context.renderRouteLegs(day), /<div class="leg-card" tabindex="0"/);
  }
});

test('real, sample and fresh-draft pages inherit map recovery, named About and locally pinned maps',t=>{
  const root=fixture(t),draft=createJourney(root,{...input,slug:'audit-map-fixture'}),{data}=loadContent(root);
  for(const journey of [data.journeys.find(j=>j.kind==='real'),data.journeys.find(j=>j.kind==='demo'),draft]){
    const html=renderJourneyPage(root,journey,{preview:true});
    assert.match(html,/id="notes-dialog" aria-labelledby="notes-journey-title"/);
    assert.match(html,/id="mobile-photo-caption"/);
    assert.match(html,/\/dist\/assets\/map-feedback.js/);
    assert.match(html,/\/dist\/assets\/vendor\/maplibre-5\.24\.0\/maplibre-gl.js/);
    assert.doesNotMatch(html,/unpkg\.com/);
  }
  const css=read(root,'dist/assets/styles.css'),muted=css.match(/--muted:\s*(#[a-f0-9]{6})/)[1];
  const luminance=hex=>{const c=hex.slice(1).match(/../g).map(n=>parseInt(n,16)/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;};
  for(const background of ['#fbfaf6','#e7ece8'])assert.ok((luminance(background)+.05)/(luminance(muted)+.05)>=4.5,background);
});


test('family, demo and freshly generated draft save directly and retain incomplete recovery drafts', async t => {
  const {studioSaveHarness}=await import('./studio-save-harness.mjs');
  const {writeStudioDraft,readStudioDraft}=await import('../scripts/studio-drafts.mjs');
  const root=fixture(t), draft=createJourney(root,input), {data}=loadContent(root,{includeDrafts:true}), state=readOverrides(root);
  const journeys=[data.journeys.find(j=>j.kind!=='demo' && j.published),data.journeys.find(j=>j.kind==='demo'),data.journeys.find(j=>j.id===draft.id)];
  for (const journey of journeys) {
    const f=studioSaveHarness(data,journey,state);
    f.plan.draft.title=`${journey.title} edited`;
    assert.equal(await f.context.savePlan(),true,journey.id);
    assert.equal(f.requests.length,1);assert.equal(f.requests[0].preview,false);
    const recovery={schema:1,sequence:1,dirty:true,state,plans:[[journey.id,{draft:{...journey,title:''},dirty:true}]]};
    writeStudioDraft(root,journey.id,recovery);
    assert.equal(readStudioDraft(root,journey.id).plans[0][1].draft.title,'');
  }
  buildSite(root);
  assert.ok(!read(root,'dist/assets/journeys.js').includes('studio-drafts'),'Automatic draft snapshots never enter the public bundle');
});


test('every journey ignores old photo Hide flags while respecting Trash', t => {
  const root=fixture(t), draft=createJourney(root,input), {data}=loadContent(root,{includeDrafts:true});
  const journeys=[data.journeys.find(j=>j.kind!=='demo' && j.published),data.journeys.find(j=>j.kind==='demo'),draft];
  for (const journey of journeys) {
    const photos=[{id:`${journey.id}-visible`,dayId:journey.days[0].id},{id:`${journey.id}-hidden`,dayId:journey.days[0].id,hidden:true},{id:`${journey.id}-trash`,dayId:journey.days[0].id,trashed:true}];
    const overrides={photos:{[photos[0].id]:{hidden:true}}};
    const visible=globalThis.JOURNEY_ATLAS_UTILS.visiblePhotos(journey,{[journey.id]:photos},overrides);
    assert.deepEqual(visible.map(photo=>photo.id),photos.slice(0,2).map(photo=>photo.id));
    assert.equal(globalThis.JOURNEY_ATLAS_UTILS.resolveCover({...journey,coverPhoto:{photoId:photos[1].id}},visible).photo.id,photos[1].id);
  }
});

test('family, demo and fresh drafts share readable grouped edit reviews', async t => {
  const {studioDraftDiff}=await import('../scripts/studio-draft-diff.mjs');
  await import('../studio/draft-review.js');
  const root=fixture(t),draft=createJourney(root,input),{data}=loadContent(root,{includeDrafts:true}),saved=readOverrides(root);
  const journeys=[data.journeys.find(j=>j.kind!=='demo' && j.published),data.journeys.find(j=>j.kind==='demo'),data.journeys.find(j=>j.id===draft.id)];
  for(const journey of journeys){
    const state=structuredClone(saved),day=journey.days[0];
    state.days[day.id]={...state.days[day.id],text:'A new day story'};
    const changes=studioDraftDiff(data,saved,{state,plans:[]});
    assert.equal(changes.length,1,journey.id);assert.equal(changes[0].field,'Day story');
    assert.match(changes[0].subject,/^Day 1 · /);assert.equal(changes[0].journey,journey.title);
    const review=globalThis.JOURNEY_ATLAS_DRAFT_REVIEW.render(changes);
    assert.equal(review.summary,'1 change in 1 day.');assert.match(review.html,/<ins>/);
  }
});

test('photo map frames validate, persist and fit the viewer for the family, a demo and a fresh draft', t => {
  const root=fixture(t),draft=createJourney(root,input);
  draft.photos=[{id:`${draft.id}-photo`,dayId:draft.days[0].id,src:'./assets/sample.webp',caption:'',lat:35.6,lng:139.7}];
  writeJson(path.join(root,`content/drafts/${draft.id}.json`),draft);
  const {data}=loadContent(root,{includeDrafts:true}),state=readOverrides(root);
  const journeys=[data.journeys.find(j=>j.kind!=='demo' && j.published),data.journeys.find(j=>j.kind==='demo'),data.journeys.find(j=>j.id===draft.id)];
  const utils=globalThis.JOURNEY_ATLAS_UTILS;
  for (const journey of journeys) {
    const base=journey.photos[0],point={lng:8,lat:47},frame={bounds:[[7.99,46.99],[8.03,47.02]]};
    state.photos[base.id]={...state.photos[base.id],location:point,mapFrame:frame};
    const resolved=utils.resolvePhoto(base,state.photos[base.id]);
    assert.equal(utils.frameContainsPhoto(frame,resolved),true,journey.id);
    const calls=[],map={cameraForBounds:(bounds,options)=>{calls.push({bounds,options});return {center:[8.01,47.005],zoom:13};}};
    assert.deepEqual(utils.photoMapCamera(map,resolved),{center:[8.01,47.005],zoom:13,bearing:0,pitch:0});
    assert.deepEqual(calls[0].bounds,frame.bounds);
  }
  writeJson(path.join(root,'content/photo-overrides.json'),Object.fromEntries(Object.entries(state.photos).filter(([id])=>!id.startsWith(draft.id))));
  writeJson(path.join(root,'build/studio-draft-overrides.json'),{photos:{[draft.photos[0].id]:state.photos[draft.photos[0].id]},routes:{},days:{}});
  buildSite(root);
  const preview=bundle(studioAsset(root,'content-overrides'),'JOURNEY_ATLAS_CONTENT_OVERRIDES');
  for(const journey of journeys)assert.deepEqual(preview.photos[journey.photos[0].id].mapFrame,state.photos[journey.photos[0].id].mapFrame);
});

test('saved day stories and optional taglines reach real, demo and fresh draft previews', t => {
  const root=fixture(t),fresh=createJourney(root,input),{data}=loadContent(root,{includeDrafts:true});
  const selected=[data.journeys.find(j=>j.kind==='real'),data.journeys.find(j=>j.kind==='demo'),fresh];
  const overrides=readOverrides(root),copy=vm.createContext({eventWord: form => globalThis.JOURNEY_ATLAS_UTILS.eventWord({}, form),});
  vm.runInContext(appFunction('escapeHtml')+appFunction('dayCopyMarkup'),copy);
  for(const journey of selected) {
    const day=journey.days[4] || journey.days[0];
    overrides.days[day.id]={...overrides.days[day.id],title:'A slower day',tagline:'Rain & <quiet>',text:'First paragraph.\n\nThe full second paragraph.'};
  }
  writeJson(path.join(root,'content/day-overrides.json'),Object.fromEntries(Object.entries(overrides.days).filter(([id])=>!fresh.days.some(day=>day.id===id))));
  writeJson(path.join(root,'build/studio-draft-overrides.json'),{photos:{},routes:{},days:Object.fromEntries(Object.entries(overrides.days).filter(([id])=>fresh.days.some(day=>day.id===id)))});
  buildSite(root);
  const live=bundle(studioAsset(root,'content-overrides'),'JOURNEY_ATLAS_CONTENT_OVERRIDES');
  for(const journey of selected) {
    const base=journey.days[4] || journey.days[0],day={...base,...live.days[base.id]};
    assert.equal(day.text,'First paragraph.\n\nThe full second paragraph.');
    const markup=copy.dayCopyMarkup(day);
    assert.match(markup,/Rain &amp; &lt;quiet&gt;/);assert.ok(markup.includes(day.text));
    assert.doesNotMatch(copy.dayCopyMarkup({...day,tagline:' ',text:''}),/place-line|day-story|stayed here/);
    const page=renderJourneyPage(root,journey,{preview:true});
    assert.match(page,/id="mobile-story-tagline"/);assert.match(page,/id="mobile-day-tagline"/);
  }
  const publicCopy=bundle(read(root,'dist/assets/content-overrides.js'),'JOURNEY_ATLAS_CONTENT_OVERRIDES');
  assert.equal(publicCopy.days[fresh.days[0].id],undefined,'Fresh draft prose stays unpublished');
  assert.match(appFunction('renderStory'),/<details class="travel-details"><summary>Travel details/);
  assert.doesNotMatch(appFunction('renderStory'),/<details[^>]*open/);
  assert.match(read(repo,'dist/assets/styles.css'),/\.day-story[^}]*white-space:pre-wrap/);
  const broken=structuredClone(data);broken.journeys[0].days[0].tagline={bad:true};assert.throws(()=>validateJourneys(broken),/invalid tagline/);
});

test('days without travel omit automatic stay labels across real, demo and fresh draft views', t => {
  const root=fixture(t),fresh=createJourney(root,input),{data}=loadContent(root,{includeDrafts:true});
  for (const original of [data.journeys.find(j=>j.kind==='real'),data.journeys.find(j=>j.kind==='demo'),fresh]) {
    const day={...original.days[0],segmentIds:[]},journey={...original,days:[day]},dayList={innerHTML:''},legend={innerHTML:''};
    const context=vm.createContext({eventWord: form => globalThis.JOURNEY_ATLAS_UTILS.eventWord({}, form),journey,dayList,activeDayId:day.id,mapScope:'day',activeDay:()=>day,
      modesForDay:()=>[],segmentsForDay:()=>[],photosForDay:()=>[],mediaUtils:{label:()=>''},syncInspectionClasses(){},
      $:()=>legend,palette:{muted:'#888'},lineSwatch:()=>'',labels:{train:'Train'}});
    vm.runInContext(['escapeHtml','modeLabel','renderDays','renderLegend'].map(appFunction).join('\n'),context);
    context.renderDays();context.renderLegend();
    assert.doesNotMatch(dayList.innerHTML+legend.innerHTML,/In one place|·\s*<\/small>/);
    assert.equal(context.modeLabel(day),journey.status==='planned'?'To plan':'');
    context.modesForDay=()=>['train'];assert.equal(context.modeLabel(day),'Train');
  }
  assert.doesNotMatch(app,/In one place/);
  assert.match(appFunction('renderStory'),/travelSummary \? `<p class="travel-summary">/);
});


test('places are data-only annotations inherited by real, demo and fresh-draft journeys', t => {
  const root = fixture(t), draft = createJourney(root, input);
  const { data } = loadContent(root, { includeDrafts: true });
  const targets = [data.journeys.find(j => j.id === 'switzerland-italy-family-2026'), data.journeys.find(j => j.id === 'alpine-crossing'), ...data.journeys.filter(j => j.kind === 'real' && j.pointsOfInterest?.length), data.journeys.find(j => j.id === draft.id)];
  for (const journey of targets) {
    const before = structuredClone({ days: journey.days, places: journey.places, segments: journey.segments });
    if (!journey.pointsOfInterest) {
      assert.deepEqual(globalThis.JOURNEY_ATLAS_PLACES.filterPlaces(journey), []);
      journey.pointsOfInterest = [{ id: 'a-new-discovery', name: 'A new discovery', category: 'sight', coordinates: [139.7, 35.6], locationAccuracy: 'approximate', status: 'saved', dayIds: [journey.days[0].id], summary: 'A place for a future visit.', sources: [{ label: 'Source', url: 'https://example.com/place' }], images: [], reviews: [] }];
    }
    validateJourneys(data);
    assert.ok(globalThis.JOURNEY_ATLAS_PLACES.filterPlaces(journey).length > 0);
    const result = prepareJourneyPlan(data, journey, { title: journey.title + ' reviewed' }, readOverrides(root)).journey;
    assert.deepEqual(result.pointsOfInterest, journey.pointsOfInterest, 'Ordinary Studio saves retain curated places');
    assert.deepEqual({ days: journey.days, places: journey.places, segments: journey.segments }, before, 'Annotations never become route nodes or alter the itinerary');
    assert.ok(ids(renderJourneyPage(root, journey, { preview: true })).includes('places-panel'));
  }
  buildSite(root);
  const output = bundle(read(root, 'dist/assets/journeys.js'), 'JOURNEY_ATLAS_DATA');
  assert.equal(output.journeys.find(j => j.id === 'alpine-crossing').pointsOfInterest.length, 3);
  for (const journey of loadContent(root).data.journeys.filter(j => j.kind === 'real' && j.pointsOfInterest?.length)) {
    assert.deepEqual(output.journeys.find(j => j.id === journey.id).pointsOfInterest, journey.pointsOfInterest, 'Published real places retain their saved status, sources and city assignments');
  }
  assert.ok(!output.journeys.some(j => j.id === draft.id), 'Fresh local data stays unpublished');
});

test('city events keep shared controls, date ranges, photo intake and Replay without daily expansion', t => {
  const root = fixture(t), city = createJourney(root, {...input, eventMode:'city'});
  const {data} = loadContent(root, {includeDrafts:true});
  const utils = globalThis.JOURNEY_ATLAS_UTILS;
  assert.equal(city.days.length, 1);
  assert.equal(city.days[0].calendarEndDate, input.endDate);
  const first = {...city.days[0], title:'First city', calendarEndDate:'2028-02-29', date:utils.eventDateLabel('2028-02-28','2028-02-29')};
  const second = {...first, id:city.id+'-stop2', number:2, title:'Second city', calendarDate:'2028-02-29', calendarEndDate:'2028-03-01', date:utils.eventDateLabel('2028-02-29','2028-03-01')};
  const state = {days:{},photos:{},routes:{}};
  const planned = prepareJourneyPlan(data, city, {days:[first,second]}, state).journey;
  assert.equal(planned.days.length,2);
  const planData = {...data,journeys:data.journeys.map(j=>j.id===city.id?planned:j)};
  const config = photoImportConfig(root, planData, {journey:city.id});
  assert.equal(config.daysByDate.size,3);
  assert.equal(config.daysByDate.get('2028-02-28').id,first.id);
  assert.equal(config.daysByDate.get('2028-02-29').id,second.id,'transfer dates belong to the arriving city by default');
  assert.equal(utils.eventForDate(planned,'2028-03-01').id,second.id);
  assert.equal(utils.eventForDate(planned,'2028-03-02'),undefined);
  const timeline = globalThis.JOURNEY_ATLAS_REPLAY.createTimeline(planned);
  assert.deepEqual([...new Set(timeline.map(m=>m.dayId))], [first.id,second.id]);
  const shifted = prepareJourneyPlan(planData, planned, {startDate:'2028-03-01',endDate:'2028-03-03'}, state,'itinerary').journey;
  assert.deepEqual(shifted.days.map(d=>[d.id,d.calendarDate,d.calendarEndDate]),[[first.id,'2028-03-01','2028-03-02'],[second.id,'2028-03-02','2028-03-03']]);
  assert.throws(()=>prepareJourneyPlan(planData, planned,{endDate:'2028-02-28'},state),/departure cannot precede arrival/);
  for(const range of [{calendarDate:'2028-02-28'},{calendarDate:'2028-03-01'},{calendarEndDate:'2028-02-28'}]) {
    assert.throws(()=>prepareJourneyPlan(planData,planned,{days:[first,{...second,...range}]},state),/transfer date|departure cannot precede arrival/);
  }
  for(const j of [data.journeys.find(j=>j.kind==='real'),data.journeys.find(j=>j.kind==='demo'),planned]) {
    assert.deepEqual(ids(renderJourneyPage(root,j)),ids(renderJourneyPage(root,city)));
    assert.deepEqual(assets(renderJourneyPage(root,j)),assets(renderJourneyPage(root,city)));
    assert.equal(utils.eventWord(j,'plural'),j.eventMode==='city'?'stops':'days');
    assert.equal(utils.eventCopy(j,'Day details'),j.eventMode==='city'?'Stop details':'Day details');
  }
  writeJson(path.join(root,`content/drafts/${city.id}.json`),planned);
  buildSite(root);
  assert.ok(!bundle(read(root,'dist/assets/journeys.js'),'JOURNEY_ATLAS_DATA').journeys.some(j=>j.id===city.id),'city drafts remain private');
});


test('batch photo editing uses the same state contract for family, demo and an empty then populated fresh draft', t => {
  const root=fixture(t), draft=createJourney(root,input), {data}=loadContent(root,{includeDrafts:true});
  const batch=globalThis.JOURNEY_ATLAS_PHOTO_BATCH;
  assert.deepEqual(batch.filterPhotos([],draft),[]);
  const generated=data.journeys.find(journey=>journey.id===draft.id);
  generated.photos=[{id:`${draft.id}-batch-test-photo`,dayId:generated.days[0].id,src:'https://images.example.test/independent.jpg',caption:'',description:'',alt:'Synthetic draft fixture'}];
  for (const journey of [data.journeys.find(journey=>journey.id==='switzerland-italy-family-2026'),data.journeys.find(journey=>journey.kind==='demo'),generated]) {
    const state={photos:{},days:{},routes:{}},photo=journey.photos[0];
    const result=batch.applyBatch({journey,photos:journey.photos,state,selectedIds:[photo.id],action:'assign',dayId:journey.days.at(-1).id});
    assert.equal(batch.orderedPhotos(journey,journey.photos,result.state).find(item=>item.id===photo.id).dayId,journey.days.at(-1).id);
    assert.deepEqual(state,{photos:{},days:{},routes:{}});
  }
});

test('community UI is inherited while eligibility includes only published real visible photos', async t => {
  const { communityIndex } = await import('../scripts/build-community-index.mjs');
  const root = fixture(t), draft = createJourney(root, input), { data } = loadContent(root, { includeDrafts: true });
  const index = communityIndex(root), family = data.journeys.find(j => j.id === 'switzerland-italy-family-2026'), demo = data.journeys.find(j => j.kind === 'demo');
  assert.ok(index[family.id].length > 0); assert.equal(index[demo.id], undefined); assert.equal(index[draft.id], undefined);
  const overrides = readOverrides(root);
  for (const id of index[family.id]) { assert.notEqual(overrides.photos[id]?.trashed, true); assert.notEqual(family.photos.find(p => p.id === id).assetStatus, 'local'); }
  for (const journey of [family, demo, draft]) {
    const html = renderJourneyPage(root, journey, { preview: !journey.published });
    assert.match(html, /community-client\.js/); assert.match(html, /id="open-photo-comments"/);
  }
});

test('private video contracts, intake controls and local-only exclusion are shared by family, demo and a fresh draft', t => {
  const root=fixture(t), created=createJourney(root,input),{data}=loadContent(root,{includeDrafts:true});
  const journeys=[data.journeys.find(j=>j.kind==='real'&&j.published),data.journeys.find(j=>j.kind==='demo'),data.journeys.find(j=>j.id===created.id)];
  for (const journey of journeys) {
    const video={id:`${journey.id}-private-fixture`,dayId:journey.days[0].id,title:'Local synthetic video',caption:'',mimeType:'video/mp4',visibility:'private',protected:true,assetStatus:'local',src:`/private-videos/assets/v1/${'a'.repeat(64)}.mp4`,poster:`/private-photos/assets/v1/${'b'.repeat(64)}.webp`,width:320,height:180,bytes:1000,posterBytes:100,durationSeconds:2};
    journey.videos=[video];validateJourneyExtras(journey);
    const preview=renderJourneyPage(root,journey,{preview:true});assert.match(preview,/journey-video/);assert.match(preview,/media-utils\.js/);
    const controls=globalThis.JOURNEY_ATLAS_PLAN_EXTRAS.videos(journey);assert.match(controls,/data-import-video/);assert.match(controls,/Local preview only/);assert.doesNotMatch(controls,/data-video-field="assetStatus"/);
    const planned=prepareJourneyPlan(data,journey,{videos:journey.videos},readOverrides(root)).journey;assert.deepEqual(planned.videos,journey.videos);
    const source=path.join(root,`content/${journey.published?'journeys':'drafts'}/${journey.id}.json`);const original=JSON.parse(fs.readFileSync(source,'utf8'));writeJson(source,{...original,videos:journey.videos});
    for(const key of ['transcript','captions']){const invalid=structuredClone(journey);invalid.videos[0][key]=key==='transcript'?'Private words':[{start:0,end:1,text:'Private words'}];assert.throws(()=>validateJourneyExtras(invalid),/private transcripts/);}
  }
  buildSite(root);const output=fs.readFileSync(path.join(root,'dist/assets/journeys.js'),'utf8');assert.doesNotMatch(output,/private-fixture/);
});

test('Photos + Places editing and rendering are inherited by family, sample and a fresh empty draft',async t=>{
  await import('../dist/assets/photo-places.js');await import('../studio/place-editor.js');
  const root=fixture(t),draft=createJourney(root,input),{data}=loadContent(root,{includeDrafts:true});
  const family=data.journeys.find(j=>j.id==='switzerland-italy-family-2026'),demo=data.journeys.find(j=>j.kind==='demo'&&j.photos.length);
  for(const journey of [family,demo,data.journeys.find(j=>j.id===draft.id)]){
    const html=renderJourneyPage(root,journey,{preview:true});assert.match(html,/<aside class="story-panel"[\s\S]*?<div class="story-album-entry">[\s\S]*?<section id="map-photo-card"[\s\S]*?<div class="story-detail"[\s\S]*?id="photo-strip"[\s\S]*?<\/aside>/);assert.match(html,/<button[^>]+data-bubble-full[^>]*>[\s\S]*?<img/);
    assert.match(html,/<details[^>]+id="sidebar-day-details"[^>]*open/);
    assert.match(html,/<dialog id="place-reviews-dialog" class="pp-reviews-dialog conversation-surface"/);
    assert.match(html,/<dialog id="comments-dialog" class="comments-dialog conversation-surface"/);
    assert.match(html,/assets\/photo-places.js/);assert.match(html,/assets\/photo-bubbles.js/);
    const point={...globalThis.JOURNEY_ATLAS_PLACE_EDITOR.newPoint(journey),name:'A reviewed place',summary:'An owner-authored place',coordinates:[8,47],sources:[{label:'Official source',url:'https://example.test/place'}],dayIds:[journey.days[0].id],photoIds:journey.photos.slice(0,1).map(photo=>photo.id)};
    point.images=[{src:'https://images.example.test/venue.jpg',alt:'The venue',credit:'Venue contributor via source',sourceUrl:'https://example.test/place',permission:'linked'}];
    const changed=prepareJourneyPlan(data,journey,{pointsOfInterest:[...(journey.pointsOfInterest||[]),point]},{photos:{},days:{},routes:{}}).journey;
    assert.deepEqual(changed.pointsOfInterest.at(-1).photoIds,point.photoIds);
    assert.deepEqual(changed.pointsOfInterest.at(-1).images,point.images);
    assert.deepEqual(globalThis.JOURNEY_ATLAS_PHOTO_PLACES.photosForPlace(point,journey.photos).linked.map(photo=>photo.id),point.photoIds);
    assert.ok(Object.hasOwn(globalThis.JOURNEY_ATLAS_PLAN_EXTRAS.changes(changed),'pointsOfInterest'));
  }
});

test('TBD planning is shared by the family, demo and fresh draft without inventing dates', t => {
  const root = fixture(t), draft = createJourney(root, input);
  const {data} = loadContent(root);
  const utils = globalThis.JOURNEY_ATLAS_UTILS;
  for (const original of [data.journeys.find(j => j.id === 'switzerland-italy-family-2026'), data.journeys.find(j => j.kind === 'demo'), draft]) {
    const journey = structuredClone(original);
    assert.equal(utils.projectPlanning(journey, false), journey, 'Absent status keeps existing behavior');
    const place = {id:`${journey.id}-future-place`,name:'A possible destination',lng:20,lat:40};
    journey.places.push(place);
    const segment = {id:`${journey.id}-future-leg`,from:journey.places[0].id,to:place.id,mode:'bus'};
    journey.segments.push(segment);
    const pending = {id:`${journey.id}-future-stop`,number:journey.days.length+1,title:'Next city',planningStatus:'tbd',date:'TBD',text:'',destinationId:place.id,segmentIds:[segment.id]};
    journey.days.push(pending);
    const record = {defaultJourneyId:journey.id,journeys:[journey]};
    assert.doesNotThrow(() => validateJourneys(record));
    const snapshot = JSON.stringify(journey);
    const shown = utils.projectPlanning(journey), hidden = utils.projectPlanning(journey, false);
    assert.match(shown.days.at(-1).date, /TBD.*Dates to decide/);
    assert.equal(shown.segments.at(-1).planningStatus, 'tbd');
    assert.equal(shown.days.at(-1).calendarDate, undefined);
    assert.ok(!hidden.days.some(day => day.id === pending.id));
    assert.ok(!hidden.segments.some(leg => leg.id === segment.id));
    assert.ok(!hidden.places.some(p => p.id === place.id));
    assert.equal(JSON.stringify(journey), snapshot, 'Filtering never mutates the source');
    assert.ok(renderJourneyPage(root, journey, {preview:true}).includes('id="show-tbd"'));
    const shifted = prepareJourneyPlan({...data, journeys:[journey],defaultJourneyId:journey.id}, journey, {endDate:journey.endDate}, {days:{},routes:{},photos:{}}).journey;
    assert.equal(shifted.days.at(-1).planningStatus, 'tbd');
    pending.planningStatus = 'maybe'; assert.throws(() => validateJourneys(record), /planningStatus/);
    pending.planningStatus = 'tbd'; pending.calendarEndDate = '2028-04-01'; assert.throws(() => validateJourneys(record), /undated TBD/);
    delete pending.calendarEndDate;
    journey.days.push({...pending,id:`${journey.id}-bad-after`,number:pending.number+1,planningStatus:'confirmed',segmentIds:[]});
    assert.throws(() => validateJourneys(record), /undated TBD entries/);
  }
});


test('reference, demo and independently populated city draft share reel selection, large-photo fullscreen and collection boundaries', t => {
  const root = fixture(t), draft = createJourney(root, {...input, eventMode:'city'});
  const {data} = loadContent(root, {includeDrafts:true});
  for (const source of [data.journeys.find(j=>j.id==='switzerland-italy-family-2026'), data.journeys.find(j=>j.kind==='demo'), draft]) {
    const journey = structuredClone(source);
    // Independent fixtures: no family photo, caption, date or itinerary is copied.
    journey.photos = [{id:`${source.id}-qa-first`,dayId:journey.days[0].id,caption:'',alt:'Accessibility only'},
      {id:`${source.id}-qa-second`,dayId:journey.days[0].id,caption:'Traveler supplied words'}];
    const f=photoEntryFixture(journey);
    f.click('photoStrip',journey.photos[1].id);
    assert.equal(f.context.photoDialog.open,false,source.id);
    assert.equal(f.events.at(-1).selection,journey.photos[1].id);
    assert.deepEqual(Array.from(f.events.at(-1).photos),journey.photos.map(photo=>photo.id));
    f.click('storyMedia',journey.photos[1].id);
    assert.equal(f.context.photoDialog.open,true,source.id);
    assert.equal(f.context.viewerPhotoIndex,1);
    f.open(journey.photos[0].id,{photos:[journey.photos[1],journey.photos[0]],collectionLabel:'Explicit linked photos'});
    assert.deepEqual(f.photos().map(photo=>photo.id),[journey.photos[1].id,journey.photos[0].id]);
    assert.equal(f.context.viewerPhotoIndex,1);
    f.context.moveViewer(1);
    assert.equal(f.context.viewerPhotoIndex,1,'Collection boundary stays fixed');
    assert.equal(globalThis.JOURNEY_ATLAS_UTILS.journeyPresentation(journey).hasMedia,true);
    const html=renderJourneyPage(root,journey,{preview:true});
    assert.ok(ids(html).includes('replay-chapter'),source.id);
    assert.ok(ids(html).includes('mobile-day-places'),source.id);
  }
});


test('reference, demo, city stops and independent populated draft inherit visible arrival framing', t => {
  const root=fixture(t),draft=createJourney(root,{...input,slug:'arrival-framing-draft',eventMode:'city'});
  draft.places=[{id:'north',name:'Synthetic north',lng:139.7,lat:38},{id:'south',name:'Synthetic south',lng:139.7,lat:34}];
  draft.segments=[{id:'new-southbound',mode:'train',from:'north',to:'south',geometry:[[139.7,38],[139.9,36],[139.7,34]]}];
  draft.days[0].placeId='south';draft.days[0].segmentIds=['new-southbound'];
  const {data,routes}=loadContent(root,{includeDrafts:true});
  for(const journey of [data.journeys.find(j=>j.id==='switzerland-italy-family-2026'),data.journeys.find(j=>j.kind==='demo'),data.journeys.find(j=>j.id==='backpacking-europe-heading-east'),draft]){
    for(const day of journey.days.filter(day=>day.segmentIds.length)){
      const legs=day.segmentIds.map(id=>journey.segments.find(s=>s.id===id)).map(s=>({...s,geometry:s.geometry||routes[s.id]||[journey.places.find(p=>p.id===s.from),journey.places.find(p=>p.id===s.to)].map(p=>[p.lng,p.lat])}));
      for(const phone of [false,true]){
        const h=arrivalCameraHarness(legs,{width:phone?390:600,height:540,phone});h.prepare();
        const fits=h.calls.filter(c=>c.type==='fit'),moves=h.calls.filter(c=>c.type==='ease');
        assert.equal(fits.length,1,journey.id);assert.equal(moves.length,1,journey.id);
        assert.equal(fits[0].bounds.length,legs.reduce((n,leg)=>n+leg.geometry.length,0),'Every incoming leg is fitted');
        assert.equal(moves[0].camera.padding,undefined,'No second offset can crop vertical routes');
        assert.equal(fits[0].options.padding.bottom,phone?64:154);
      }
    }
  }
});

test('day visibility uses trip-local dates, including today, ongoing stays and dated TBD events', () => {
  const utils = globalThis.JOURNEY_ATLAS_UTILS, journey = {timeZone:'Europe/Berlin', status:'ongoing', days:[]};
  const now = new Date('2026-10-10T22:30:00Z');
  assert.equal(utils.journeyToday(journey, now), '2026-10-11');
  journey.days = [
    {calendarDate:'2026-10-01',calendarEndDate:'2026-10-15'},
    {calendarDate:'2026-10-11'}, {calendarDate:'2026-10-12'},
    {calendarDate:'2026-10-12',planningStatus:'tbd'}, {planningStatus:'tbd'},
    {calendarDate:'2026-10-09',planningStatus:'tbd'}
  ];
  assert.deepEqual(utils.planningCounts(journey, now), {past:3,locked:1,tbd:2});
  assert.deepEqual(utils.planningCounts({...journey,timeZone:'America/New_York'}, now), {past:2,locked:2,tbd:2});
});

test('Heading East groups the real city stays without inventing onward dates or changing confirmation', () => {
  const journey = loadContent(repo).data.journeys.find(j => j.id === 'backpacking-europe-heading-east');
  const utils = globalThis.JOURNEY_ATLAS_UTILS, now = new Date('2026-10-11T12:00:00Z');
  assert.deepEqual(utils.planningCounts(journey, now), {past:8,locked:4,tbd:19});
  const snapshot = JSON.stringify(journey);
  const locked = utils.projectPlanning(journey, {past:false,locked:true,tbd:false}, now);
  assert.deepEqual(locked.days.map(day => day.title), ['Innsbruck','Bolzano','Venice','Forni di Sopra']);
  assert.deepEqual(locked.days.map(day => day.number), [9,10,11,12]);
  assert.equal(locked.segments.length, 6);
  assert.ok(!locked.places.some(place => /Athens|Prague/.test(place.name)));
  assert.equal(JSON.stringify(journey), snapshot);
});

test('visibility projections and synchronized controls work for reference, demo and an independently populated new draft', t => {
  const root=fixture(t), draft=createJourney(root,input), {data}=loadContent(root);
  const utils=globalThis.JOURNEY_ATLAS_UTILS;
  for (const original of [data.journeys.find(j=>j.id==='switzerland-italy-family-2026'),data.journeys.find(j=>j.kind==='demo'),draft]) {
    const journey={...structuredClone(original), timeZone:'UTC', overviewBounds:[[0,0],[100,80]],
      days:['past','locked','tbd'].map((key,index)=>({id:`fixture-${key}`,number:index+1,title:key,date:key,
        ...(key==='tbd'?{planningStatus:'tbd'}:{calendarDate:index?'2099-01-02':'2000-01-01'}),
        placeId:`place-${key}`,destinationId:`place-${key}`,segmentIds:[`leg-${key}`]})),
      places:['past','locked','tbd'].map((key,index)=>({id:`place-${key}`,name:key,lng:10+index,lat:40})),
      segments:['past','locked','tbd'].map(key=>({id:`leg-${key}`,from:`place-${key}`,to:`place-${key}`,mode:'train'})),
      photos:['past','locked','tbd'].map(key=>({id:`photo-${key}`,dayId:`fixture-${key}`})),
      videos:['past','locked','tbd'].map(key=>({id:`video-${key}`,dayId:`fixture-${key}`})),
      replayMoments:['past','locked','tbd'].map(key=>({id:`moment-${key}`,dayId:`fixture-${key}`})),
      pointsOfInterest:['past','locked','tbd'].map(key=>({id:`point-${key}`,dayIds:[`fixture-${key}`]})),
      meetup:{dayId:'fixture-past',placeId:'place-past'}};
    const snapshot=JSON.stringify(journey);
    for(const key of ['past','locked','tbd']) {
      const view=utils.projectPlanning(journey,{past:false,locked:false,tbd:false,[key]:true});
      assert.deepEqual(view.days.map(day=>day.id),[`fixture-${key}`]);
      for(const [field,prefix] of [['segments','leg'],['places','place'],['photos','photo'],['videos','video'],['replayMoments','moment'],['pointsOfInterest','point']]) {
        assert.deepEqual(view[field].map(item=>item.id),[`${prefix}-${key}`],`${original.id}: ${field}`);
      }
      assert.equal(view.overviewBounds,undefined,'Hidden geography cannot widen filtered framing');
      assert.equal(Boolean(view.meetup),key==='past');
    }
    const controls=['list','map'].flatMap(surface=>['past','locked','tbd'].map(category=>({surface,dataset:{planningCategory:category}})));
    const counts=['past','locked','tbd'].map(category=>({dataset:{planningCount:category}}));
    const nodes=new Map(); const node=selector=>{if(!nodes.has(selector))nodes.set(selector,{style:{},offsetTop:80,offsetParent:{}});return nodes.get(selector);};
    const closed=[];
    const context=vm.createContext({sourceJourney:journey,journey,planningVisibility:{past:true,locked:true,tbd:true},activeDayId:'fixture-past',activeGroupId:'',mapScope:'day',
      window:{JOURNEY_ATLAS_UTILS:utils},document:{querySelectorAll:selector=>selector==='[data-planning-category]'?controls:counts},$:node,
      eventWord:form=>utils.eventWord(journey,form),groupTravel:{projectJourney:j=>j},dayById:id=>context.journey.days.find(day=>day.id===id),
      cancelArrival(){},locationLabels:{closePreview(){closed.push('preview');}},clearDayPreview(){},placesUI:{dayChanged(){closed.push('places');}},
      photoBubbles:{clearMap(){closed.push('bubbles');},close(){}},clearSegmentInspection(){},pauseReplay(){},videoPlayer:{stop(){}},photoDialog:{open:false},
      renderAll(){assert.ok(closed.length>=3);context.renderPlanningFilters();},fitJourneyBounds(){},
      viewerDayId:'fixture-past',storyMapDay:null,viewerRouteKey:null,replayJourneyId:journey.id});
    vm.runInContext(appFunction('renderPlanningFilters')+appFunction('selectPlanningCategory'),context);
    context.selectPlanningCategory('past',false);
    assert.equal(context.activeDayId,'fixture-locked');
    assert.equal(context.mapScope,'journey');
    assert.ok(controls.filter(c=>c.dataset.planningCategory==='past').every(c=>!c.checked));
    context.selectPlanningCategory('tbd',false);
    assert.ok(controls.filter(c=>c.dataset.planningCategory==='locked').every(c=>c.checked&&c.disabled));
    assert.equal(node('#map-planning-summary').textContent,`Filter ${utils.eventWord(journey,'plural')} · Future locked in`);
    context.selectPlanningCategory('locked',false);
    assert.equal(context.journey.days.length,1,'Reject an empty visible journey');
    context.selectPlanningCategory('past',true);context.selectPlanningCategory('tbd',true);
    assert.equal(context.journey.days.length,3);
    assert.deepEqual(context.journey.overviewBounds,journey.overviewBounds);
    assert.equal(JSON.stringify(journey),snapshot,'Projection and controller preserve traveler sources');
    const html=renderJourneyPage(root,original,{preview:true});
    for(const id of ['planning-filter','map-planning-filter','show-past','show-locked','show-tbd','map-show-past','map-show-locked','map-show-tbd']) assert.ok(html.includes(`id="${id}"`));
  }
});


test('real, demo and independently populated draft albums retain their tiles through nested history', t=>{
  const root=fixture(t);createJourney(root,input);
  const {data}=loadContent(root,{includeDrafts:true}), draft=data.journeys.find(j=>j.id===input.slug);
  draft.days.forEach((day,i)=>{day.title=`Independent stop ${i+1}`;day.text='A local fixture journal entry.';});
  draft.photos=draft.days.map((day,i)=>({id:`independent-${i}`,dayId:day.id,src:`https://example.test/${i}.jpg`}));
  for(const journey of [data.journeys.find(j=>j.id==='switzerland-italy-family-2026'),data.journeys.find(j=>j.id==='backpacking-europe-heading-east'),data.journeys.find(j=>j.kind==='demo'),draft]){
    const f=viewerFixture({journey}), album=f.node('#album-dialog'), days=f.node('#album-days');
    let builds=0,html='';Object.defineProperty(days,'innerHTML',{get:()=>html,set:value=>{html=value;builds++;}});
    const photos=journey.photos||[],context=vm.createContext({journey,$:f.node,orderedPhotos:()=>photos,photosForDay:id=>photos.filter(p=>p.dayId===id),
      eventWord:form=>globalThis.JOURNEY_ATLAS_UTILS.eventWord(journey,form),escapeHtml:s=>s||'',
      photoImageMarkup:p=>`<img src="${p.src||''}">`,mediaUtils:{label:items=>`${items.length} photos`},prepareProgressiveImages(){},window:{JOURNEY_ATLAS_MOBILE_UI:f.controller}});
    vm.runInContext(appFunction('openAlbum'),context);f.api.restoreOverlay=id=>id==='album-dialog'?context.openAlbum():f.controller.presentOverlay(id);
    context.openAlbum();album.scrollTop=410;f.dispatch('#album-dialog','scroll');
    f.controller.openGrid(journey.days[0].id);f.history.back();
    assert.equal(builds,1,journey.id);assert.equal(album.scrollTop,410,journey.id);
    assert.equal((html.match(/data-album-day=/g)||[]).length,journey.days.length,journey.id);
  }
});

test('current-view sharing is inherited by reference, city atlas, demo and a populated fresh draft', async t => {
  await import('../dist/assets/view-sharing.js');
  const sharing=globalThis.JOURNEY_ATLAS_SHARING;
  const root=fixture(t), draft=createJourney(root,input), {data}=loadContent(root);
  draft.photos=[{id:'independent-share-photo',dayId:draft.days[1].id,src:'https://example.test/fixture.webp',caption:''}];
  for(const journey of [data.journeys.find(j=>j.id==='switzerland-italy-family-2026'),data.journeys.find(j=>j.id==='backpacking-europe-heading-east'),data.journeys.find(j=>j.kind==='demo'),draft]) {
    const html=renderJourneyPage(root,journey,{preview:journey===draft});
    for(const id of ['share-lead-photo','share-photo','mobile-share-photo','share-link-dialog','retry-share-link','share-link-description']) assert.ok(ids(html).includes(id),`${journey.id}: ${id}`);
    assert.ok(assets(html).includes('view-sharing.js'));assert.ok(assets(html).includes('view-sharing.css'));
    assert.match(html, /<aside class="photo-context">[\s\S]*?id="share-photo"[\s\S]*?<\/aside>/, `${journey.id}: fullscreen Share belongs in the right sidebar`);
    const photo=journey.photos[0], nodes=new Map();
    const $=selector=>{if(!nodes.has(selector))nodes.set(selector,{hidden:false,dataset:{mobileTab:'map'}});return nodes.get(selector);};
    const context=vm.createContext({$,
      activeDayId:photo.dayId,mapScope:'day',photoDialog:{open:false},viewerPhotoIndex:0,
      photosForDay:id=>journey.photos.filter(p=>p.dayId===id),viewerPhotos:()=>journey.photos,
      photoBubbles:{currentPhoto:()=>photo},document:{body:{classList:{contains:()=>false}}},
      window:{JOURNEY_ATLAS_MOBILE_UI:{gridVisible:()=>false}}
    });
    vm.runInContext(appFunction('currentSharedView'),context);
    for(const fullscreen of [false,true]) {
      context.photoDialog.open=fullscreen;
      const state=JSON.parse(JSON.stringify(context.currentSharedView()));
      const url=sharing.urlFor(`https://atlas.test/${journey.slug}`,state,{share:true});
      assert.equal(sharing.read(url).photoId,photo.id);
      assert.equal(sharing.read(url).dayId,photo.dayId);
      assert.equal(sharing.read(url).view,fullscreen?'photo':'map');
      assert.ok(!url.includes(photo.src),'Share references the page, never the media object');
    }
  }
});

// Selection is visible only after choosing an event, including when its ID is
// already the internal first-event fallback used by albums and history.
import {mapEntryHarness} from './map-entry-harness.mjs';
function mapEntryJourneys(t) {
  const root=fixture(t), draft=createJourney(root,{...input,slug:'neutral-map-entry',eventMode:'city'}), {data}=loadContent(root);
  const populated={...draft,places:[{id:'qa-north',name:'North shore',lng:139.7,lat:35.6},{id:'qa-south',name:'South shore',lng:139.9,lat:35.4}],
    segments:[{id:'qa-outward',mode:'train',from:'qa-north',to:'qa-south',geometry:[[139.7,35.6],[139.8,35.5],[139.9,35.4]]},
      {id:'qa-return',mode:'boat',from:'qa-south',to:'qa-north',geometry:[[139.9,35.4],[139.85,35.6],[139.7,35.6]]}],
    days:draft.days.map((day,index)=>({...day,title:index?'North shore':'South shore',placeId:index?'qa-north':'qa-south',segmentIds:[index?'qa-return':'qa-outward']}))};
  return [data.journeys.find(j=>j.id==='switzerland-italy-family-2026'),data.journeys.find(j=>j.id==='backpacking-europe-heading-east'),data.journeys.find(j=>j.kind==='demo'),populated]
    .map(journey=>({...journey,photos:[{id:`${journey.id}-entry-photo`,dayId:journey.days.at(-1).id,caption:'',src:'https://images.example.test/map-entry.jpg'}]}));
}
function assertNeutralMap(f,journey) {
  assert.equal(f.context.mapScope,'journey',journey.id);
  assert.doesNotMatch(f.node('#day-list').innerHTML,/class="day-row active|aria-current="true"/,`${journey.id}: overview rows are not selected`);
  assert.ok(f.routes.every(({options})=>!options.selected),`${journey.id}: overview routes have no selected event`);
  assert.ok(f.groups.every(group=>!group.selected),`${journey.id}: overview signposts have no selected event`);
  assert.match(f.node('#mobile-day-picker .button-label').textContent,/All|Choose/);
  assert.doesNotMatch(f.node('#mobile-day-picker')['aria-label'],/current|(?:Day|Stop) \d/);
  assert.equal(f.node('#mobile-day-title').textContent,journey.title);
  assert.equal(f.node('#sidebar-day-summary').textContent,'Journey details','Overview details do not retain a previously selected city');
  assert.doesNotMatch(f.node('#story-detail').innerHTML,/class="detail-eyebrow">(?:DAY|STOP) 0?1/,'Desktop overview cannot present the first event as selected');
}
function assertChosenMap(f,journey,day) {
  assert.equal(f.context.mapScope,'day');assert.equal(f.context.activeDayId,day.id);
  const row=f.node('#day-list').innerHTML.match(/<button class="day-row active"[^>]*>/g) || [];
  assert.equal(row.length,1,`${journey.id}: one chosen row`);assert.ok(row[0].includes(`data-day-id="${day.id}"`));assert.match(row[0],/aria-current="true"/);
  assert.deepEqual(f.routes.filter(({options})=>options.selected).map(({segment})=>segment.id).sort(),[...day.segmentIds].sort());
  const selectedGroups=f.groups.filter(group=>group.selected);
  if(f.context.destinationForDay(day))assert.ok(selectedGroups.some(group=>group.days.some(item=>item.id===day.id)));
  assert.match(f.node('#mobile-day-picker .button-label').textContent,new RegExp(`${f.context.eventWord('title')} ${day.number}\\b`));
  assert.equal(f.node('#mobile-day-title').textContent,day.title);
  assert.equal(f.node('#sidebar-day-summary').textContent,`${f.context.eventWord('title')} details · ${day.title}`);
}

test('first map entry has no selected event on desktop and phone across reference, city, demo and fresh draft',t=>{
  for(const journey of mapEntryJourneys(t))for(const mobile of [false,true]){
    const f=mapEntryHarness(journey,{mobile});f.open();
    assert.equal(f.node('#trip-intro').hidden,true);assert.equal(f.node('.atlas-shell').inert,false);
    assert.ok(f.calls.includes('opening-trace'),'The existing entry trace remains intact');
    assertNeutralMap(f,journey);
    if(mobile){f.node('#mobile-day-picker').onclick();assert.equal(f.node('.atlas-shell').dataset.mobileTab,'route');assertNeutralMap(f,journey);}
    f.choose(journey.days[0].id);assertChosenMap(f,journey,journey.days[0]);
    const photo={...journey.photos[0],dayId:journey.days[0].id};
    const bubbles=photoBubbleFixture({journey,initialPhotos:[photo]});bubbles.resize(mobile);
    f.context.photoBubbles=bubbles.controller;bubbles.controller.open([photo],photo.id);
    assert.equal(bubbles.node('map-photo-card').hidden,false,'Fixture presents an actual selected photo card');
    f.context.fitRoute();assertNeutralMap(f,journey);
    assert.equal(bubbles.controller.isOpen(),false,'Returning to overview clears selected photo state');
    assert.equal(bubbles.node('map-photo-card').hidden,true,'Returning to overview removes the old event card');
    assert.equal(f.node('#mobile-previous-day').disabled,true);
    f.node('#mobile-next-day').onclick();assertChosenMap(f,journey,journey.days[0]);
  }
});

test('explicit day and photo links select their event while shared overview links remain neutral',t=>{
  for(const journey of mapEntryJourneys(t))for(const mobile of [false,true]){
    const f=mapEntryHarness(journey,{mobile}),day=journey.days.at(-1),photo=journey.photos[0];
    f.link(`https://example.test/trip?day=${encodeURIComponent(day.id)}&view=map`);assertChosenMap(f,journey,day);
    assert.equal(f.node('#trip-intro').hidden,true);assert.ok(!f.calls.includes('opening-trace'));
    f.link(`https://example.test/trip#photo=${encodeURIComponent(photo.id)}`);assertChosenMap(f,journey,day);assert.equal(f.context.openedPhoto,photo.id);
    f.link(`https://example.test/trip#day=${encodeURIComponent(day.id)}&view=map&scope=journey`);assertNeutralMap(f,journey);
  }
});

test('restoring an overview camera clears event selection and early entry remains neutral before map readiness',t=>{
  const journeys=mapEntryJourneys(t), draft=journeys.at(-1), onlyDay=draft.days[0];
  journeys.push({...draft,id:`${draft.id}-single`,days:[onlyDay],segments:draft.segments.filter(segment=>onlyDay.segmentIds.includes(segment.id)),photos:draft.photos.map(photo=>({...photo,dayId:onlyDay.id}))});
  for(const journey of journeys){
    const f=mapEntryHarness(journey,{mobile:true,ready:false});f.open();
    assert.equal(f.context.openingRoutePending,true);assertNeutralMap(f,journey);
    f.context.mainMapReady=true;f.context.drawMainMap(false);f.context.playOpeningRoute();assertNeutralMap(f,journey);
    assert.equal(f.node('#mobile-next-day').disabled,false,'Even a one-event overview can begin with Next');
    f.node('#mobile-next-day').onclick();assertChosenMap(f,journey,journey.days[0]);
    assert.equal(f.node('#mobile-next-day').disabled,journey.days.length===1,'The selected last event has a bounded Next control');
    f.context.fitRoute();assertNeutralMap(f,journey);
    const day=journey.days[0];f.choose(day.id);assertChosenMap(f,journey,day);
    const camera={center:[139.8,35.5],zoom:7,bearing:0,pitch:0,padding:{top:0,right:0,bottom:0,left:0}};
    f.context.restoreMapView({dayId:day.id,scope:'journey',camera});assertNeutralMap(f,journey);
    assert.deepEqual(f.calls.at(-1),{camera},'Selection cleanup preserves the exact returning map camera');
  }
});

test('AVIF upgrades preserve public WebP until verified across reference, demo and an independent fresh draft', t => {
  const root = fixture(t), draft = createJourney(root, { ...input, slug: 'avif-contract-fixture' });
  const { data } = loadContent(root), state = readOverrides(root);
  const targets = [data.journeys.find(journey => journey.id === 'switzerland-italy-family-2026'), data.journeys.find(journey => journey.kind === 'demo' && journey.photos.length), draft];
  const upgrades = [];
  for (const [index, journey] of targets.entries()) {
    const fullAvif = { src: `/private-photos/assets/v1/${String(index + 1).repeat(64)}.avif`, width: journey.published ? 4032 : 3024, height: journey.published ? 3024 : 4032, bytes: 950000, assetStatus: 'local', localEncodingNote: 'Private preparation detail' };
    const photo = journey.published ? { ...journey.photos.find(photo => !state.photos[photo.id]?.trashed && photo.assetStatus !== 'local') } : { id: `${draft.id}-own-photo`, dayId: draft.days[1].id, caption: '', src: `/private-photos/assets/v1/${'f'.repeat(64)}.webp`, srcset: [{ src: `/private-photos/assets/v1/${'f'.repeat(64)}.webp`, width: 2400 }], width: 2400, height: 3200, assetStatus: 'local', protected: true };
    if (journey.kind === 'demo') Object.assign(photo, { protected: true, width: 3200, height: 2400, src: `/private-photos/assets/v1/${'e'.repeat(64)}.webp`, assetStatus: 'published', srcset: [{ src: `/private-photos/assets/v1/${'e'.repeat(64)}.webp`, width: 3200 }] });
    const filename = path.join(root, journey.published ? `content/photo-manifests/${journey.id}.json` : `build/draft-assets/${journey.id}/photos.json`);
    const photos = journey.published ? fs.existsSync(filename) ? JSON.parse(fs.readFileSync(filename, 'utf8')) : journey.photos : [photo];
    const position = photos.findIndex(item => item.id === photo.id);
    photos[position] = { ...photo, fullAvif };
    writeJson(filename, photos);
    upgrades.push({ journey, photo, filename, fullAvif });
  }
  buildSite(root);
  let publicData = bundle(read(root, 'dist/assets/trip-photos.js'), 'JOURNEY_ATLAS_PHOTOS');
  const preview = bundle(studioAsset(root, 'trip-photos'), 'JOURNEY_ATLAS_PHOTOS');
  for (const { journey, photo, fullAvif } of upgrades) {
    assert.deepEqual(preview[journey.id].find(item => item.id === photo.id).fullAvif, fullAvif, 'Each local preview retains its pending upgrade');
    if (!journey.published) { assert.equal(publicData[journey.id], undefined); continue; }
    const visible = publicData[journey.id].find(item => item.id === photo.id);
    assert.equal(visible.src, photo.src); assert.deepEqual(visible.srcset, photo.srcset);
    assert.equal(visible.fullAvif, undefined, 'Pending upgrades never introduce unavailable public URLs');
  }
  for (const { filename, photo } of upgrades) {
    const photos = JSON.parse(fs.readFileSync(filename, 'utf8'));
    photos.find(item => item.id === photo.id).fullAvif.assetStatus = 'published';
    writeJson(filename, photos);
  }
  buildSite(root); publicData = bundle(read(root, 'dist/assets/trip-photos.js'), 'JOURNEY_ATLAS_PHOTOS');
  for (const { journey, photo, fullAvif } of upgrades.filter(item => item.journey.published)) {
    const visible = publicData[journey.id].find(item => item.id === photo.id);
    const { assetStatus, localEncodingNote, ...expected } = fullAvif;
    assert.deepEqual(visible.fullAvif, expected); assert.equal(visible.src, photo.src);
  }
  assert.equal(publicData[draft.id], undefined, 'Verified media never publishes an unpromoted draft');
  // Independently authored draft data gets the same gate after normal promotion.
  const source = JSON.parse(fs.readFileSync(path.join(root, `content/drafts/${draft.id}.json`), 'utf8'));
  writeJson(path.join(root, `content/journeys/${draft.id}.json`), { ...source, published: true });
  fs.rmSync(path.join(root, `content/drafts/${draft.id}.json`));
  const own = upgrades.at(-1), ownPhotos = JSON.parse(fs.readFileSync(own.filename, 'utf8'));
  ownPhotos[0].assetStatus = 'published'; ownPhotos[0].fullAvif.assetStatus = 'local';
  writeJson(path.join(root, `content/photo-manifests/${draft.id}.json`), ownPhotos);
  buildSite(root); publicData = bundle(read(root, 'dist/assets/trip-photos.js'), 'JOURNEY_ATLAS_PHOTOS');
  assert.equal(publicData[draft.id][0].src, own.photo.src); assert.equal(publicData[draft.id][0].fullAvif, undefined);
  ownPhotos[0].fullAvif.assetStatus = 'published';
  writeJson(path.join(root, `content/photo-manifests/${draft.id}.json`), ownPhotos);
  buildSite(root); publicData = bundle(read(root, 'dist/assets/trip-photos.js'), 'JOURNEY_ATLAS_PHOTOS');
  assert.equal(publicData[draft.id][0].fullAvif.src, own.fullAvif.src);
  assert.equal(publicData[draft.id][0].fullAvif.assetStatus, undefined);
});

test('public build rejects malformed or external AVIF descriptors before replacing existing output', t => {
  const root = fixture(t), filename = path.join(root, 'content/photo-manifests/switzerland-italy-family-2026.json');
  const photos = JSON.parse(fs.readFileSync(filename, 'utf8'));
  const asset = { src: `/private-photos/assets/v1/${'a'.repeat(64)}.avif`, width: 4032, height: 3024, bytes: 950000, assetStatus: 'published' };
  const publicBefore = read(root, 'dist/assets/trip-photos.js');
  for (const invalid of [
    { src: 'https://external.example/photo.avif' }, { src: `/private-photos/assets/v1/${'a'.repeat(64)}.webp` },
    { src: `/private-photos/assets/v1/../../original.avif` }, { assetStatus: 'ready' }, { assetStatus: undefined },
    { width: 0 }, { height: 2.5 }, { bytes: -1 }, { bytes: 16 * 1024 * 1024 + 1 }, { width: 10001, height: 10000 },
    { width: 1600, height: 1200 }, { width: 3024, height: 4032 }, { width: 4032, height: 2688 },
  ]) {
    photos[0].fullAvif = { ...asset, ...invalid }; writeJson(filename, photos);
    assert.throws(() => buildSite(root), /invalid protected AVIF derivative/);
    assert.equal(read(root, 'dist/assets/trip-photos.js'), publicBefore);
  }
  photos[0].fullAvif = asset; photos[0].protected = false; writeJson(filename, photos);
  assert.throws(() => buildSite(root), /invalid protected AVIF derivative/);
});
