import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { buildSite, renderJourneyPage, studioAsset, readOverrides } from '../scripts/build-site.mjs';
import { createJourney } from '../scripts/create-journey.mjs';
import { loadContent, writeJson } from '../scripts/journey-content.mjs';
import { prepareJourneyPlan } from '../scripts/journey-planner.mjs';
import { studioRouteAvailability, proposeStudioRoute } from '../scripts/studio-route-service.mjs';
import { photoImportConfig } from '../scripts/photo-import-config.mjs';
import '../dist/assets/replay-utils.js';
import '../dist/assets/atlas-utils.js';

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

test('one template supplies every control and asset to real trips, all samples, and a blank new draft', t => {
  const root = fixture(t), draft = createJourney(root, input);
  const { data } = loadContent(root, { includeDrafts: true });
  buildSite(root);
  const reference = read(root, 'dist/switzerland-italy.html');
  assert.equal(ids(reference).length, new Set(ids(reference)).size, 'No duplicate control IDs');
  assert.ok(reference.indexOf('id="replay-photo-stage"') < reference.indexOf('<aside class="replay-story"'), 'Mobile Replay media is outside the scrolling story');
  assert.match(reference, /<div id="replay-photo-slot"><figure class="replay-photo" id="replay-photo-frame"/, 'One photo frame has a desktop home and a separate mobile stage');
  for (const id of ['mobile-open-replay', 'mobile-photo-back', 'mobile-photo-location', 'mobile-grid-back', 'mobile-replay-back', 'replay-view-map', 'replay-view-photos']) {
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
  assert.deepEqual(automatic.filter(m => m.type === 'photo').map(m => m.photoId), photos.map(p => p.id).reverse());
  assert.equal(automatic.filter(m => m.type === 'day').length, 2, 'Rest days remain in Replay');
  journey.replayMoments = [{ id: `${prefix}-chapter`, dayId: days[0].id, segmentIds: days[0].segmentIds, photoId: photos[1].id, caption: 'An editorial choice', duration: 12 }];
  const curated = globalThis.JOURNEY_ATLAS_REPLAY.createTimeline(journey);
  assert.equal(curated[0].curated, true);
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
  for (const filename of ['dist/assets/app.js', 'dist/assets/atlas-utils.js', 'dist/assets/replay-utils.js', 'dist/assets/catalog.js', 'dist/assets/mobile-ux.js', 'dist/assets/mobile.css', 'studio/studio.js', 'content/templates/journey.html', 'content/templates/catalog.html']) {
    const source = read(repo, filename);
    for (const journey of data.journeys) {
      assert.ok(!source.includes(journey.id), `${filename} must express ${journey.id} behavior through data`);
      if (journey.slug) assert.ok(!source.includes(journey.slug), `${filename} must not link to a specific trip`);
    }
  }
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
