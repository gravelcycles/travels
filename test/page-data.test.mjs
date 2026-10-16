import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { buildSite, renderJourneyPage, studioAsset } from '../scripts/build-site.mjs';
import { journeyPageData, catalogData } from '../scripts/page-data.mjs';
import { createJourney } from '../scripts/create-journey.mjs';
import { writeJson } from '../scripts/journey-content.mjs';

const repo = path.resolve(import.meta.dirname, '..');
const read = (root, file) => fs.readFileSync(path.join(root, file), 'utf8');
const run = source => { const context = { window: {} }; vm.runInNewContext(source, context); return JSON.parse(JSON.stringify(context.window)); };
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-page-data-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.cpSync(path.join(repo,'content'), path.join(root,'content'), { recursive: true, filter: source => !source.includes(`${path.sep}drafts`) });
  fs.cpSync(path.join(repo,'dist'), path.join(root,'dist'), { recursive: true });
  return root;
}

test('published real pages preserve their complete data while demos omit all real trips', t => {
  const root = fixture(t); buildSite(root);
  const all = run(['journeys','route-geometry','trip-photos','content-overrides'].map(name => read(root,`dist/assets/${name}.js`)).join('\n'));
  for (const page of ['switzerland-italy.html','backpacking-europe-heading-east.html','florence-genoa.html','demo.html']) {
    const html = read(root,`dist/${page}`), refs = [...html.matchAll(/src="\.\/(assets\/journey-data\/[^?]+)\?v=/g)];
    assert.equal(refs.length,1);
    assert.doesNotMatch(html, /src="\.\/assets\/(journeys|route-geometry|trip-photos|content-overrides)\.js/);
    const scoped = run(read(root,`dist/${refs[0][1]}`));
    const journeys = all.JOURNEY_ATLAS_DATA.journeys.filter(journey => page === 'demo.html' ? journey.kind === 'demo' : journey.slug === page);
    const expected = journeyPageData(all.JOURNEY_ATLAS_DATA, all.JOURNEY_ATLAS_ROUTE_GEOMETRY, all.JOURNEY_ATLAS_PHOTOS, all.JOURNEY_ATLAS_CONTENT_OVERRIDES, journeys);
    assert.deepEqual(scoped, expected, page);
    assert.ok(scoped.JOURNEY_ATLAS_DATA.journeys.every(journey => page === 'demo.html' ? journey.kind === 'demo' : journey.slug === page));
  }
});

test('small catalog retains authored cover focal point, counts and distance without loading whole trips', t => {
  const root=fixture(t);buildSite(root);
  const all=run(['journeys','trip-photos','content-overrides'].map(name=>read(root,`dist/assets/${name}.js`)).join('\n'));
  const catalog=run(read(root,'dist/assets/catalog-data.js')).JOURNEY_ATLAS_CATALOG;
  assert.deepEqual(catalog,JSON.parse(JSON.stringify(catalogData(all.JOURNEY_ATLAS_DATA,all.JOURNEY_ATLAS_PHOTOS,all.JOURNEY_ATLAS_CONTENT_OVERRIDES,catalog.metadata))));
  assert.equal(catalog.journeys.length,all.JOURNEY_ATLAS_DATA.journeys.filter(j=>j.kind==='real').length);
  assert.ok(catalog.journeys.every(j=>!j.days&&!j.segments&&!j.places&&!j.photos));
  assert.doesNotMatch(read(root,'dist/index.html'), /src="\.\/assets\/(journeys|trip-photos|content-overrides)\.js/);
  for(const url of Object.values(catalog.metadata))assert.match(url,/^\.\/assets\/[a-z-]+\.js\?v=[a-f0-9]{12}$/);
});

test('format extensions survive scoped and catalog data; independent populated drafts retain live preview assets', t => {
  const root=fixture(t),draft=createJourney(root,{title:'Independent coast',slug:'independent-coast',startDate:'2028-01-01',endDate:'2028-01-02',timeZone:'UTC'});
  draft.places=[{id:'independent-harbor',name:'Harbor',lng:139.7,lat:35.6}];
  draft.days[0].placeId=draft.places[0].id;
  writeJson(path.join(root,`content/drafts/${draft.id}.json`),draft);
  const photo={id:'independent-photo',dayId:draft.days[0].id,src:'https://example.test/photo.webp',width:2400,height:3200,formats:{avif:{src:'https://example.test/photo.avif',mime:'image/avif'}}};
  writeJson(path.join(root,`build/draft-assets/${draft.id}/photos.json`),[photo]);
  buildSite(root);
  const preview=renderJourneyPage(root,draft,{preview:true});
  for(const name of ['journeys','route-geometry','trip-photos','content-overrides'])assert.match(preview,new RegExp(`/api/preview-assets/${name}\\.js`));
  assert.equal(run(studioAsset(root,'trip-photos')).JOURNEY_ATLAS_PHOTOS[draft.id][0].id,photo.id);
  assert.ok(!read(root,'dist/assets/catalog-data.js').includes(draft.id));
  const journey={...draft,kind:'real',published:true,photos:[]},data={defaultJourneyId:journey.id,journeys:[journey]},photos={[journey.id]:[photo]},overrides={photos:{},routes:{},days:{}};
  assert.deepEqual(journeyPageData(data,{},photos,overrides,[journey]).JOURNEY_ATLAS_PHOTOS[journey.id][0],photo);
  assert.deepEqual(catalogData(data,photos,overrides,{}).journeys[0].cover.photo.formats,photo.formats);
});

test('every referenced local JS/CSS receives its exact hash, including newly added and nested assets', t => {
  const root=fixture(t),file=path.join(root,'dist/assets/new-feature.js');
  fs.writeFileSync(file,'window.newFeature = 1;');
  fs.appendFileSync(path.join(root,'content/templates/journey.html'),'\n<script src="./assets/new-feature.js"></script>\n');
  const pages=['switzerland-italy.html','backpacking-europe-heading-east.html','demo.html','index.html'];
  for(let iteration=0;iteration<2;iteration++){
    buildSite(root);
    for(const page of pages)for(const [,asset,version] of read(root,`dist/${page}`).matchAll(/(?:src|href)="\.\/(assets\/[^"?]+\.(?:js|css))(?:\?v=([^"]+))?"/g)){
      assert.equal(version,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'dist',asset))).digest('hex').slice(0,12),`${page}: ${asset}`);
    }
    fs.writeFileSync(file,'window.newFeature = 2;');
  }
  fs.unlinkSync(file);
  assert.throws(()=>buildSite(root),/ENOENT/,'Missing references fail instead of falling back to v=1');
});

test('catalog covers choose a sufficient derivative for crop size and DPR, preserving bindings on unchanged resize', () => {
  const source=read(repo,'dist/assets/catalog.js');
  for(const [width,height,dpr,photoWidth,photoHeight,expected] of [[176,104,1,3200,2400,480],[112,168,2,3200,2400,480],[112,168,3,3200,2400,1280],[176,104,2,2400,3200,480]]){
    const photo={id:'cover',src:'full',width:photoWidth,height:photoHeight,srcset:[{src:'small',width:480},{src:'medium',width:1280},{src:'full',width:photoWidth}]};
    const calls=[],card={innerHTML:'',getBoundingClientRect:()=>({width,height})},catalog={innerHTML:'',querySelectorAll:()=>[card]};let resize;
    const window={devicePixelRatio:dpr,JOURNEY_ATLAS_CATALOG:{journeys:[{kind:'real',title:'Test',cover:{photo,position:'30% 60%'},eventCount:1,eventLabel:'days',distanceLabel:'Route to plan'}]},
      JOURNEY_ATLAS_AUTH:{isProtected:()=>true,markup:(p,o)=>{calls.push(o.targetWidth);return '<img>';},prepare(){}},JOURNEY_ATLAS_UTILS:{prepareImageReveals(){}},addEventListener:(name,fn)=>{resize=fn;}};
    vm.runInNewContext(source,{window,document:{querySelector:()=>catalog}});
    const selected=photo.srcset.find(v=>v.width>=calls[0]);assert.equal(selected.width,expected);
    resize();assert.equal(calls.length,1,'Unchanged crop does not restart the photo loader');
    assert.match(catalog.innerHTML,/--cover-position:30% 60%/);
  }
});

test('cached legacy catalog HTML can use the current renderer during a deployment transition',()=>{
  const catalog={innerHTML:'',querySelectorAll:()=>[]};
  const window={},context=vm.createContext({window,globalThis:window,document:{querySelector:()=>catalog}});
  for(const name of ['journeys','trip-photos','content-overrides','atlas-utils'])vm.runInContext(read(repo,`dist/assets/${name}.js`),context);
  context.window.JOURNEY_ATLAS_UTILS.prepareImageReveals=()=>{};
  context.window.addEventListener=()=>{};
  vm.runInContext(read(repo,'dist/assets/catalog.js'),context);
  assert.match(catalog.innerHTML,/Switzerland/);assert.match(catalog.innerHTML,/Heading east/i);
});

test('build fails rather than silently retaining all-trip scripts if the shared template data block changes',t=>{
  const root=fixture(t),file=path.join(root,'content/templates/journey.html');
  fs.writeFileSync(file,read(root,'content/templates/journey.html').replace('<script src="./assets/trip-photos.js"></script>',''));
  assert.throws(()=>buildSite(root),/missing its shared data script block/);
});
