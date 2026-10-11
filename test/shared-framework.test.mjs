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
import '../dist/assets/atlas-utils.js';
import '../dist/assets/map-style.js';
import { mapStyleHarness } from './map-style-harness.mjs';
import '../dist/assets/group-travel.js';
import '../dist/assets/media-utils.js';
import '../dist/assets/places-comments.js';
import '../studio/plan-extras.js';
import '../studio/photo-batch.js';
import { validateJourneyExtras } from '../scripts/journey-extras.mjs';
import { assessStudioReadiness } from '../scripts/studio-readiness.mjs';
import { journeyRevision } from '../scripts/journey-planner.mjs';
import { fixture as photoBubbleFixture } from './photo-bubbles-harness.mjs';

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
  assert.equal(config.daysByDate.size, 53);
  assert.equal(config.daysByDate.get('2026-09-30').title, 'Düsseldorf');
  assert.equal(config.daysByDate.has('2026-10-24'), false);
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
      arrivalChapter:null,arrivalKey:day=>day.id,cancelArrival(){},placesUI:null,photoBubbles:null,dayById: id => journey.days.find(day => day.id === id), clearSegmentInspection() {},
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
    const $ = selector => { if (!nodes.has(selector)) nodes.set(selector, { hidden: true, inert: false }); return nodes.get(selector); };
    const context = vm.createContext({eventWord: form => globalThis.JOURNEY_ATLAS_UTILS.eventWord({}, form), $, isDemoPage, location: { hash: '', search: '' }, URLSearchParams,
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
    const html=renderJourneyPage(root,journey,{preview:true});assert.match(html,/<aside class="story-panel"[\s\S]*?<div class="story-album-entry">[\s\S]*?<section id="map-photo-card"[\s\S]*?<div class="story-detail"[\s\S]*?id="photo-strip"[\s\S]*?<\/aside>/);assert.match(html,/assets\/photo-places.js/);assert.match(html,/assets\/photo-bubbles.js/);
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
