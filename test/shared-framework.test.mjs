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
import '../dist/assets/atlas-utils.js';
import '../dist/assets/map-style.js';
import { mapStyleHarness } from './map-style-harness.mjs';
import '../dist/assets/group-travel.js';
import '../dist/assets/media-utils.js';
import '../studio/plan-extras.js';
import { validateJourneyExtras } from '../scripts/journey-extras.mjs';

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
const assets = html => [...html.matchAll(/(?:src|href)="[^" ]*\/(?:assets|preview-assets)\/([a-z-]+\.(?:js|css))[^" ]*"/g)].map(match => match[1]);
function bundle(source, key) {
  const context = { window: {} };
  vm.runInNewContext(source, context);
  return JSON.parse(JSON.stringify(context.window[key]));
}
const app = read(repo, 'dist/assets/app.js');
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
    const context = vm.createContext({ journey, mainMapReady: true,
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
    const context = vm.createContext({ journey, activeDayId: journey.days[0].id, prefersReducedMotion: () => false,
      dayById: id => journey.days.find(day => day.id === id), clearSegmentInspection() {},
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
  const replay = reference.match(/<dialog class="replay-dialog"[\s\S]*?<\/dialog>/)[0];
  assert.doesNotMatch(replay, /<img|replay-photo|replay-view-(?:map|photos)/, 'Replay has no photo surface or media switch');
  assert.match(replay, /id="replay-map"/);
  assert.match(replay, /id="replay-toggle"/);
  for (const id of ['mobile-open-replay', 'mobile-photo-back', 'mobile-photo-location', 'mobile-grid-back', 'mobile-replay-back']) {
    assert.ok(ids(reference).includes(id), `Shared mobile control ${id} exists`);
    assert.match(reference, new RegExp(`<button[^>]*id="${id}"[^>]*>\\s*<svg[^>]*aria-hidden="true"`), `${id} uses a drawn icon with an accessible button label`);
  }
  for (const removed of ['mobile-menu', 'mobile-menu-open', 'mobile-photo-close', 'mobile-photo-zoom', 'mobile-grid-close']) {
    assert.ok(!ids(reference).includes(removed), `Redundant mobile control ${removed} stays absent`);
  }
  assert.match(reference, /id="mobile-day-picker"[^>]*aria-controls="mobile-journey-panel"[^>]*aria-expanded="false"/);
  const header = reference.match(/<header class="mobile-header"[\s\S]*?<\/header>/)?.[0];
  assert.match(header, /id="mobile-open-replay"[^>]*aria-controls="replay-dialog"[^>]*aria-haspopup="dialog"/);
  assert.match(header, /<span>Replay<\/span>/, 'Replay is a direct, labeled header action');
  const actions = reference.match(/<nav id="mobile-journey-actions"[\s\S]*?<\/nav>/)?.[0];
  for (const action of ['overview', 'photos', 'unlock', 'about']) assert.ok(actions?.includes(`data-journey-action="${action}"`), `${action} remains accessible in the day picker`);
  assert.ok(ids(reference).includes('mobile-story-legend'), 'Route key remains available in day details');
  for (const journey of data.journeys) {
    const preview = renderJourneyPage(root, journey, { preview: true });
    assert.deepEqual(ids(preview), ids(reference), journey.id);
    assert.deepEqual(assets(preview), assets(reference), journey.id);
    assert.match(preview, /\/api\/preview-assets\/journeys.js/);
  }
  assert.deepEqual(ids(read(root, 'dist/demo.html')), ids(reference));
  assert.deepEqual(assets(read(root, 'dist/demo.html')), assets(reference));
  assert.match(read(root, 'dist/demo.html'), /data-journey-scope="demo"/);
  assert.ok(!read(root, 'dist/assets/journeys.js').includes(draft.id));
  assert.ok(!fs.existsSync(path.join(root, 'dist', draft.slug)));
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
  const targets=[data.journeys.find(j=>j.kind==='real' && j.published),data.journeys.find(j=>j.routeGroups?.length),data.journeys.find(j=>j.id===draft.id)];
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
    const $ = selector => { if (!nodes.has(selector)) nodes.set(selector, { hidden: true, inert: false }); return nodes.get(selector); };
    const context = vm.createContext({ $, isDemoPage, location: { hash: '', search: '' }, URLSearchParams,
      journey: { title: 'New trip', subtitle: '', dates: 'Tomorrow', days: [{}], photos: hasPhoto ? [{ id: 'photo' }] : [] },
      document: { body: { classList: { add() {} } } }, window: { JOURNEY_ATLAS_UTILS: globalThis.JOURNEY_ATLAS_UTILS },
      escapeHtml: value => value, photoImageMarkup: () => '<img alt="Sample" />', prepareProgressiveImages() {}
    });
    vm.runInContext(appFunction('renderIntroduction') + '\nrenderIntroduction()', context);
    assert.equal($('#trip-intro').hidden, false);
    assert.equal($('.atlas-shell').inert, true);
    assert.match($('#trip-intro').innerHTML, /Relive the trip/);
    assert.match($('#trip-intro').innerHTML, /Explore the map/);
    if (!hasPhoto) assert.match($('#trip-intro').innerHTML, /A journey taking shape/);
    for (const [hash, search] of [['#day=d1', ''], ['', '?photo=p1']]) {
      context.location = { hash, search };
      vm.runInContext('renderIntroduction()', context);
      assert.equal($('#trip-intro').hidden, true);
    }
  }
});

test('shared browser code and HTML templates contain no concrete trip IDs or URLs', () => {
  const { data } = loadContent(repo);
  for (const filename of ['dist/assets/app.js', 'dist/assets/map-style.js', 'dist/assets/location-labels.js', 'dist/assets/atlas-utils.js', 'dist/assets/replay-utils.js', 'dist/assets/catalog.js', 'dist/assets/mobile-ux.js', 'dist/assets/mobile.css', 'dist/assets/input-mode.js', 'dist/assets/group-travel.js', 'dist/assets/media-utils.js', 'studio/studio.js', 'studio/plan-extras.js', 'content/templates/journey.html', 'content/templates/catalog.html']) {
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
  const context = vm.createContext({ journey: draft,
    placeById: id => draft.places.find(place => place.id === id),
    segmentsForDay: day => day.segmentIds.map(id => draft.segments.find(segment => segment.id === id)),
    segmentCoordinates: segment => segment.geometry
  });
  vm.runInContext(appFunction('dayMapStops') + appFunction('railStopCoordinate'), context);
  assert.equal(context.dayMapStops(null,draft.days[0]).length,0, 'Empty drafts invent no endpoints');
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
  const sample = data.journeys.find(j => j.routeGroups?.length);
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
  const source = loadContent(repo).data.journeys.find(j => j.routeGroups?.length);
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
  const sample = loadContent(repo).data.journeys.find(j => j.routeGroups?.length);
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
  const context = vm.createContext({}); vm.runInContext(code,context);
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
    const context = vm.createContext({ window: { JOURNEY_ATLAS_MAP_STYLE: mapStyle },
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
