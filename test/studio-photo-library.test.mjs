import '../dist/assets/atlas-utils.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import sharp from 'sharp';
import { importStudioPhoto, uploadManifestPath, atomicJson } from '../scripts/studio-photo-service.mjs';
import { publishPhotoAssets } from '../scripts/publish-photo-assets.mjs';
import { privatePhotoFile } from '../scripts/photo-variants.mjs';
import { buildSite } from '../scripts/build-site.mjs';
import { loadContent, readJson } from '../scripts/journey-content.mjs';
const repo = path.resolve(import.meta.dirname, '..');
const journeyId = 'switzerland-italy-family-2026';
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-photo-library-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  // Each test owns its upload manifest and generated assets; exclude local intake.
  fs.cpSync(path.join(repo, 'content'), path.join(root, 'content'), { recursive: true, filter: name => !name.includes('/drafts') && !name.endsWith('-uploads.json') });
  // Publication tests supply their own upgrades rather than inheriting a
  // concurrently prepared real-photo migration without its private bytes.
  for (const name of fs.readdirSync(path.join(root, 'content/photo-manifests'))) {
    const filename = path.join(root, 'content/photo-manifests', name);
    atomicJson(filename, readJson(filename).map(({ fullAvif, ...photo }) => photo));
  }
  const overridesPath = path.join(root, 'content/photo-overrides.json');
  const knownPhotos = new Set(loadContent(root).data.journeys.flatMap(journey => journey.photos.map(photo => photo.id)));
  atomicJson(overridesPath, Object.fromEntries(Object.entries(readJson(overridesPath)).filter(([id]) => knownPhotos.has(id))));
  // Removing local intake also removes references to it from the fixture's albums.
  const daysPath = path.join(root, 'content/day-overrides.json'), days = readJson(daysPath);
  for (const day of Object.values(days)) {
    if (day.photoOrder) day.photoOrder = day.photoOrder.filter(id => knownPhotos.has(id));
    if (day.leadPhotoId && !knownPhotos.has(day.leadPhotoId)) delete day.leadPhotoId;
  }
  atomicJson(daysPath, days);
  fs.cpSync(path.join(repo, 'dist'), path.join(root, 'dist'), { recursive: true });
  return root;
}
async function photoBytes(width = 700) {
  return sharp({ create: { width, height: 400, channels: 3, background: '#537b9e' } }).jpeg().withExif({ IFD0: { Artist: 'Private camera owner' } }).toBuffer();
}
function publicPhotos(root) {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'dist/assets/trip-photos.js'), 'utf8'), context);
  return JSON.parse(JSON.stringify(context.window.JOURNEY_ATLAS_PHOTOS[journeyId]));
}

test('upload appends a deduplicated photo with blank copy, safe sizes, private original and stripped metadata', async t => {
  const root = fixture(t), bytes = await photoBytes();
  const before = loadContent(root).data.journeys.find(j => j.id === journeyId).photos.length;
  const { photo } = await importStudioPhoto(root, { journeyId, dayId: 'family-d3', filename: '../../camera.jpg', bytes });
  assert.equal(photo.caption, ''); assert.equal(photo.description, '');
  assert.equal(photo.sourceFilename, 'camera.jpg'); assert.equal(photo.dayId, 'family-d3');
  assert.equal(photo.assetStatus, 'local'); assert.equal(photo.lng, undefined);
  assert.deepEqual(photo.srcset.map(v => v.width), [480, 700]);
  assert.equal(photo.fullAvif.assetStatus, 'local');
  assert.equal(photo.fullAvif.width, 700); assert.equal(photo.fullAvif.height, 400);
  assert.match(photo.fullAvif.src, /\.avif$/);
  assert.ok(photo.blur.startsWith('data:image/webp;base64,'));
  const file = privatePhotoFile(root, photo.src);
  const meta = await sharp(file).metadata();
  assert.equal(meta.width, 700); assert.equal(meta.exif, undefined); assert.equal(meta.xmp, undefined);
  const originalDir = path.join(root, 'photos/studio-uploads', journeyId);
  assert.deepEqual(fs.readFileSync(path.join(originalDir, fs.readdirSync(originalDir).find(f => f.endsWith('.jpg')))), bytes);
  const duplicate = await importStudioPhoto(root, { journeyId, dayId:'family-d4', filename:'renamed.jpg', bytes });
  assert.equal(duplicate.duplicate, true); assert.equal(duplicate.photo.dayId, 'family-d3');
  assert.equal(loadContent(root).data.journeys.find(j => j.id === journeyId).photos.length, before + 1);
  buildSite(root); assert.ok(!publicPhotos(root).some(p => p.id === photo.id));
});

test('bad image and foreign day fail without replacing an existing album or leaving staged files', async t => {
  const root = fixture(t), bytes = await photoBytes();
  await assert.rejects(importStudioPhoto(root, { journeyId, dayId:'another-trip-d1', filename:'test.jpg', bytes }), /Choose a day/);
  await assert.rejects(importStudioPhoto(root, { journeyId, dayId:'family-d1', filename:'test.mov', bytes }), /Videos/);
  await assert.rejects(importStudioPhoto(root, { journeyId, dayId:'family-d1', filename:'test.jpg', bytes:Buffer.from('not an image') }));
  const journey = loadContent(root).data.journeys.find(j => j.id === journeyId);
  assert.equal(fs.existsSync(uploadManifestPath(root, journey)), false);
  assert.equal(fs.readdirSync(path.join(root, 'build')).filter(f => f.startsWith('photo-upload-')).length, 0);
});

test('camera GPS is retained privately for review with signed hemisphere coordinates', async t => {
  const root = fixture(t);
  const bytes = await sharp({ create: { width: 480, height: 320, channels: 3, background: '#537b9e' } }).jpeg().withExif({
    IFD2: { DateTimeOriginal: '2026:08:13 12:00:00' },
    IFD3: { GPSLatitudeRef: 'S', GPSLatitude: '34/1 30/1 0/1', GPSLongitudeRef: 'W', GPSLongitude: '58/1 18/1 0/1' }
  }).toBuffer();
  const { photo, warnings } = await importStudioPhoto(root, { journeyId, filename: 'gps-fixture.jpg', bytes });
  const metadata = readJson(path.join(root, 'photos/studio-uploads', journeyId, `${photo.sourceHash}.json`));
  assert.deepEqual(metadata.candidateLocation, { lat: -34.5, lng: -58.3 });
  assert.ok(warnings.some(message => message.includes('GPS')));
  assert.equal(photo.lat, undefined); assert.equal(photo.lng, undefined); assert.equal(photo.location, undefined);
  const derivative = await sharp(privatePhotoFile(root, photo.src)).metadata();
  assert.equal(derivative.exif, undefined);
});

test('publishing is preview-only by default and retryable; failed verification keeps photos local', async t => {
  const root = fixture(t), bytes = await photoBytes(200);
  // Existing local assets belong to other authoring sessions; this fixture
  // owns only the generated upload below.
  const manifestFile=path.join(root,`content/photo-manifests/${journeyId}.json`);
  atomicJson(manifestFile,readJson(manifestFile).map(photo=>({...photo,assetStatus:'published'})));
  const { photo } = await importStudioPhoto(root, { journeyId, dayId:'family-d1', filename:'small.jpg', bytes });
  assert.deepEqual(photo.srcset.map(v => v.width), [200]);
  const overridesFile=path.join(root,'content/photo-overrides.json');
  atomicJson(overridesFile,{...readJson(overridesFile),[photo.id]:{hidden:true}}); // Legacy Hide never blocks publishing.
  const calls = [], stored = new Map(); let offline = false;
  const remote = async (resource, options = {}) => {
    calls.push({resource,method:options.method||'GET'});
    if(options.method==='PUT'){stored.set(resource,options.body);return new Response(null,{status:200});}
    if(offline && stored.has(resource))throw new Error('offline');
    return stored.has(resource)?new Response(stored.get(resource),{headers:{'Content-Type':resource.endsWith('.avif')?'image/avif':'image/webp'}}):new Response(null,{status:404});
  };
  const preview = await publishPhotoAssets(root, journeyId, { remote });
  assert.equal(preview.photos, 1); assert.equal(calls.length, 0);
  offline=true;
  await assert.rejects(publishPhotoAssets(root, journeyId, { publish:true, remote }), /offline/);
  const journey = loadContent(root).data.journeys.find(j => j.id === journeyId);
  assert.equal(readJson(uploadManifestPath(root, journey))[0].assetStatus, 'local');
  offline=false;
  const published = await publishPhotoAssets(root, journeyId, { publish:true, remote });
  assert.equal(published.published, true); assert.ok(publicPhotos(root).some(p => p.id === photo.id));
  assert.equal((await publishPhotoAssets(root, journeyId, { publish:true, remote })).photos, 0);
  assert.equal(calls.filter(c=>c.method==='PUT').length,2);
  assert.ok(calls.every(c=>c.resource.includes('/objects/v1/')&&/\.(webp|avif)$/.test(c.resource)));
  assert.equal(publicPhotos(root).find(p=>p.id===photo.id).fullAvif.src,photo.fullAvif.src);
});

test('trash excludes photos from public data even without hidden; restoring preserves copy and pins', t => {
  const root = fixture(t), filename = path.join(root, 'content/photo-overrides.json');
  const state = readJson(filename), id = 'family-img-1425', previous = structuredClone(state[id]);
  state[id].trashed = true; atomicJson(filename, state); buildSite(root);
  assert.ok(!publicPhotos(root).some(p => p.id === id));
  state[id].trashed = false; atomicJson(filename, state); buildSite(root);
  assert.ok(publicPhotos(root).some(p => p.id === id));
  delete state[id].trashed; assert.deepEqual(state[id], previous);
});

test('slow-connection publishing serializes requests and rejects unsafe concurrency values', async t => {
  const root = fixture(t);
  const manifestFile = path.join(root, `content/photo-manifests/${journeyId}.json`);
  atomicJson(manifestFile, readJson(manifestFile).map(photo => ({ ...photo, assetStatus: 'published' })));
  await importStudioPhoto(root, { journeyId, dayId: 'family-d1', filename: 'serial.jpg', bytes: await photoBytes(1500) });
  const stored = new Map(); let active = 0, maximum = 0, uploads = 0;
  const remote = async (resource, options = {}) => {
    active++; maximum = Math.max(maximum, active);
    try {
      await new Promise(resolve => setTimeout(resolve, 5));
      if (options.method === 'PUT') {
        stored.set(resource, options.body); uploads++;
        if (uploads === 1) throw new TypeError('Connection lost after upload');
        return new Response(null, { status: 200 });
      }
      return stored.has(resource) ? new Response(stored.get(resource), { headers: { 'Content-Type': resource.endsWith('.avif') ? 'image/avif' : 'image/webp' } }) : new Response(null, { status: 404 });
    } finally { active--; }
  };
  for (const concurrency of [0, 5, 1.5]) await assert.rejects(publishPhotoAssets(root, journeyId, { publish: true, concurrency, remote }), /concurrency/);
  assert.equal(maximum, 0);
  const result = await publishPhotoAssets(root, journeyId, { publish: true, concurrency: 1, remote });
  assert.equal(result.assets, 4); assert.equal(stored.size, 4); assert.equal(maximum, 1);
  assert.equal(uploads, 4, 'An uncertain successful upload is verified and reused without a second PUT');
  assert.equal(result.published, true);
});

test('the upload UI retains successful files when a batch also contains a failure', async () => {
  const source = fs.readFileSync(path.join(repo, 'studio/studio.js'), 'utf8');
  const start = source.indexOf('  async function uploadPhotos(');
  const end = source.indexOf('\n  function retainNewerEdits(', start);
  const nodes = new Map();
  const node = id => { if(!nodes.has(id)) nodes.set(id, { value:'', textContent:'', disabled:false }); return nodes.get(id); };
  node('#upload-photo-files').files = [{name:'broken.jpg',size:10},{name:'good.jpg',size:10}];
  node('#upload-photo-day').value = 'd1';
  const photo = {id:'new-photo',dayId:'d1',caption:'',description:'',assetStatus:'local'};
  const basePhotos = [];
  let readinessInvalidations = 0;
  const context = vm.createContext({eventWord: form => globalThis.JOURNEY_ATLAS_UTILS.eventWord({}, form),
    $:node, journey:{id:'trip'}, basePhotos, photosByJourney:{}, plans:new Map(), savedRevisions:{}, uploadingPhotos:false,
    URLSearchParams, dayById:id=>({id,number:1}), photoWithOverride:p=>p,
    pendingPhotoDays:new Map(),photoUploadSerial:0,renderPendingPhotoDays(){},
    readiness:{invalidate(){readinessInvalidations++;}},
    renderDaySelectors(){},renderPhotoGrid(){},selectPhoto(id){context.selected=id;},
    fetch:async url=>({ok:true,json:async()=>url.includes('filename=broken')?{ok:false,error:'Cannot decode'}:url==='/api/state'?{revisions:{trip:'new-revision'}}:{ok:true,photo,duplicate:false,warnings:[]}})
  });
  vm.runInContext(source.slice(start,end), context);
  await vm.runInContext('uploadPhotos()', context);
  assert.equal(basePhotos.length,1); assert.equal(context.selected,photo.id);
  assert.match(node('#photo-upload-status').textContent,/broken.jpg: Cannot decode/);
  assert.match(node('#photo-upload-status').textContent,/good.jpg: added locally/);
  assert.equal(node('#upload-photos').disabled,false);
  assert.equal(readinessInvalidations,1,'A successful import invalidates an earlier readiness review.');
});

test('batch imports use each capture date with the journey timezone and keep captions blank', async t => {
  const root=fixture(t);
  const bytesFor=async metadata=>sharp({create:{width:480,height:320,channels:3,background:'#38745e'}}).jpeg().withExif({IFD2:metadata}).toBuffer();
  const first=await importStudioPhoto(root,{journeyId,filename:'late-evening.jpg',bytes:await bytesFor({DateTimeOriginal:'2026:08:13 23:30:00',OffsetTimeOriginal:'-04:00'})});
  const second=await importStudioPhoto(root,{journeyId,dayId:'auto',filename:'afternoon.jpg',bytes:await bytesFor({DateTimeOriginal:'2026:08:15 15:00:00'})});
  assert.equal(first.photo.dayId,'family-d2');
  assert.equal(second.photo.dayId,'family-d3');
  assert.match(first.photo.takenAt,/2026-08-14/);
  assert.equal(first.photo.caption,'');assert.equal(second.photo.description,'');
  assert.equal(first.photo.lng,undefined);
});

test('missing and out-of-trip capture dates require an individual day instead of guessing', async t=>{
  const root=fixture(t), bytes=await photoBytes();
  await assert.rejects(importStudioPhoto(root,{journeyId,filename:'undated.jpg',bytes}),error=>error.needsDay===true && /No usable capture date/.test(error.message));
  const outside=await sharp({create:{width:480,height:320,channels:3,background:'#356754'}}).jpeg().withExif({IFD2:{DateTimeOriginal:'2025:01:01 12:00:00'}}).toBuffer();
  await assert.rejects(importStudioPhoto(root,{journeyId,filename:'outside.jpg',bytes:outside}),error=>error.needsDay===true && /outside this journey/.test(error.message));
  const manual=await importStudioPhoto(root,{journeyId,filename:'undated.jpg',bytes,dayId:'family-d4'});
  assert.equal(manual.photo.dayId,'family-d4');
  const duplicate=await importStudioPhoto(root,{journeyId,filename:'renamed.jpg',bytes});
  assert.equal(duplicate.duplicate,true);assert.equal(duplicate.photo.dayId,'family-d4');
});

test('auto batch UI shows all assigned days and retains undated files for individual retry', async () => {
  const source=fs.readFileSync(path.join(repo,'studio/studio.js'),'utf8');
  const start=source.indexOf('  async function uploadPhotos('), end=source.indexOf('\n  function retainNewerEdits(',start);
  const nodes=new Map(), node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',disabled:false});return nodes.get(id);};
  node('#upload-photo-day').value='auto';
  node('#upload-photo-files').files=['first','second','undated'].map(name=>({name:`${name}.jpg`,size:10}));
  const basePhotos=[], pendingPhotoDays=new Map(), requested=[];
  let readinessInvalidations=0;
  const context=vm.createContext({eventWord: form => globalThis.JOURNEY_ATLAS_UTILS.eventWord({}, form),$:node,journey:{id:'trip'},basePhotos,photosByJourney:{},plans:new Map(),savedRevisions:{},uploadingPhotos:false,
    pendingPhotoDays,photoUploadSerial:0,URLSearchParams,dayById:id=>({id,number:id==='d1'?1:2}),photoWithOverride:p=>p,
    readiness:{invalidate(){readinessInvalidations++;}},
    renderPendingPhotoDays(){},renderDaySelectors(){},renderPhotoGrid(){},selectPhoto(){},
    fetch:async url=>({ok:true,json:async()=>{
      if(url==='/api/state')return {revisions:{trip:'revision'}};
      const query=new URL(url,'http://localhost').searchParams;requested.push(query.get('dayId'));
      const id=query.get('filename');
      if(id==='undated.jpg' && query.get('dayId')==='auto')return {ok:false,needsDay:true,error:'Choose a day'};
      return {ok:true,photo:{id,dayId:id==='first.jpg'?'d1':'d2'},duplicate:false,warnings:[]};
    }})});
  vm.runInContext(source.slice(start,end),context);
  await vm.runInContext('uploadPhotos()',context);
  assert.deepEqual(requested,['auto','auto','auto']);assert.equal(basePhotos.length,2);
  assert.equal(node('#photo-day-filter').value,'all');assert.equal(pendingPhotoDays.size,1);
  const [reviewId,pending]=[...pendingPhotoDays][0];
  context.retries=[{file:pending.file,dayId:'d2',reviewId}];
  await vm.runInContext('uploadPhotos(retries)',context);
  assert.equal(basePhotos.length,3);assert.equal(pendingPhotoDays.size,0);
  assert.equal(requested.at(-1),'d2');
  assert.equal(readinessInvalidations,3,'Every successful import or retry invalidates the old review.');
});

async function avifUpgrade(root, background = '#537b9e', format = 'avif', metadata = false) {
  let image = sharp({ create: { width: 90, height: 60, channels: 3, background } });
  if (metadata) image = image.withExif({ IFD0: { Artist: 'Private fixture' } });
  const bytes = await image[format]().toBuffer(), hash = crypto.createHash('sha256').update(bytes).digest('hex');
  const src = `/private-photos/assets/v1/${hash}.avif`, filename = path.join(root, 'build/private-photo-assets/v1', `${hash}.avif`);
  fs.mkdirSync(path.dirname(filename), { recursive: true }); fs.writeFileSync(filename, bytes);
  return { src, width: 90, height: 60, bytes: bytes.length, assetStatus: 'local' };
}
function withUpgrade(root, fullAvif, index = 0) {
  const filename = path.join(root, `content/photo-manifests/${journeyId}.json`), photos = readJson(filename);
  const src = `/private-photos/assets/v1/${crypto.createHash('sha256').update(`published fixture ${photos[index].id}`).digest('hex')}.webp`;
  photos[index] = { ...photos[index], src, srcset: [{ src, width: 90, height: 60 }], width: 90, height: 60, assetStatus: 'published', fullAvif };
  atomicJson(filename, photos);
  return { filename, photo: photos[index] };
}
function memoryRemote({ mutate = () => {}, fail = () => false, type = resource => resource.endsWith('.avif') ? 'image/avif' : 'image/webp' } = {}) {
  const calls = [], stored = new Map();
  const remote = async (resource, options = {}) => {
    calls.push({ resource, method: options.method || 'GET', headers: options.headers });
    mutate(resource, options, calls);
    if (options.method === 'PUT') { stored.set(resource, options.body); return new Response(null, { status: 200 }); }
    if (fail(resource, options, stored)) return new Response(null, { status: 503 });
    return stored.has(resource) ? new Response(stored.get(resource), { headers: { 'Content-Type': type(resource) } }) : new Response(null, { status: 404 });
  };
  return { remote, calls, stored };
}

test('AVIF-only publication upgrades existing photos without requiring WebP bytes or publishing local intake or trash', async t => {
  const root = fixture(t), fullAvif = await avifUpgrade(root), { filename, photo } = withUpgrade(root, fullAvif);
  const photos = readJson(filename);
  photos[1] = { ...photos[1], width: 90, height: 60, assetStatus: 'local', fullAvif };
  photos[2] = { ...photos[2], width: 90, height: 60, fullAvif };
  atomicJson(filename, photos);
  const overridesFile = path.join(root, 'content/photo-overrides.json');
  atomicJson(overridesFile, { ...readJson(overridesFile), [photos[2].id]: { trashed: true } });
  const { remote, calls } = memoryRemote();
  const preview = await publishPhotoAssets(root, journeyId, { remote, avifOnly: true });
  assert.equal(preview.photos, 1); assert.equal(preview.assets, 1); assert.equal(calls.length, 0);
  await publishPhotoAssets(root, journeyId, { remote, publish: true, avifOnly: true });
  assert.equal(calls.filter(call => call.method === 'PUT').length, 1);
  assert.ok(calls.every(call => call.resource.endsWith('.avif')));
  assert.equal(calls.find(call => call.method === 'PUT').headers['Content-Type'], 'image/avif');
  const current = readJson(filename);
  assert.equal(current[0].fullAvif.assetStatus, 'published');
  assert.equal(current[1].assetStatus, 'local'); assert.equal(current[1].fullAvif.assetStatus, 'local');
  assert.equal(current[2].fullAvif.assetStatus, 'local');
  const publicPhoto = publicPhotos(root).find(item => item.id === photo.id);
  assert.equal(publicPhoto.src, photo.src); assert.deepEqual(publicPhoto.srcset, photo.srcset);
  assert.equal(publicPhoto.fullAvif.src, fullAvif.src);
  assert.deepEqual(Object.keys(publicPhoto.fullAvif).sort(), ['bytes', 'height', 'src', 'width']);
  assert.ok(!publicPhotos(root).some(item => item.id === photos[1].id || item.id === photos[2].id));
  assert.equal((await publishPhotoAssets(root, journeyId, { remote, publish: true, avifOnly: true })).photos, 0);
  await assert.rejects(publishPhotoAssets(root, journeyId, { all: true, avifOnly: true }), /either all/);
});

test('a failed migration batch leaves every AVIF unpublished and every existing public fallback available; retry reuses verified objects', async t => {
  const root = fixture(t), first = await avifUpgrade(root), second = await avifUpgrade(root, '#e7ae25');
  const { filename } = withUpgrade(root, first); withUpgrade(root, second, 1);
  buildSite(root); const before = fs.readFileSync(path.join(root, 'dist/assets/trip-photos.js'), 'utf8');
  let fail = true;
  const transport = memoryRemote({ fail: (resource, options, stored) => fail && resource.endsWith(second.src.split('/').at(-1)) && stored.has(resource) });
  await assert.rejects(publishPhotoAssets(root, journeyId, { publish: true, avifOnly: true, concurrency: 1, remote: transport.remote }), /verification failed/);
  assert.ok(readJson(filename).slice(0, 2).every(photo => photo.fullAvif.assetStatus === 'local' && photo.assetStatus === 'published'));
  buildSite(root); assert.equal(fs.readFileSync(path.join(root, 'dist/assets/trip-photos.js'), 'utf8'), before);
  assert.ok(publicPhotos(root).slice(0, 2).every(photo => !photo.fullAvif));
  fail = false;
  await publishPhotoAssets(root, journeyId, { publish: true, avifOnly: true, remote: transport.remote });
  assert.equal(transport.calls.filter(call => call.method === 'PUT').length, 2, 'Rerun reuses both immutable objects, including the uncertain upload');
  assert.ok(readJson(filename).slice(0, 2).every(photo => photo.fullAvif.assetStatus === 'published'));
});

test('publisher preserves concurrent copy, pins, new photos and upgrade fields while marking only verified derivatives', async t => {
  const root = fixture(t), { filename, photo } = withUpgrade(root, await avifUpgrade(root));
  let edited = false;
  const { remote } = memoryRemote({ mutate: () => {
    if (edited) return; edited = true;
    const current = readJson(filename);
    current[0].caption = 'Saved during upload'; current[0].lat = 40.1; current[0].lng = 11.2;
    current[0].fullAvif.editorialMarker = 'Keep this new field';
    current.push({ ...current[0], id: 'concurrent-photo', assetStatus: 'local', fullAvif: undefined });
    atomicJson(filename, current);
  } });
  await publishPhotoAssets(root, journeyId, { publish: true, avifOnly: true, remote });
  const current = readJson(filename), updated = current.find(item => item.id === photo.id);
  assert.equal(updated.caption, 'Saved during upload'); assert.equal(updated.lat, 40.1);
  assert.equal(updated.fullAvif.editorialMarker, 'Keep this new field'); assert.equal(updated.fullAvif.assetStatus, 'published');
  assert.equal(current.find(item => item.id === 'concurrent-photo').assetStatus, 'local');
  assert.equal(publicPhotos(root).find(item => item.id === photo.id).fullAvif.editorialMarker, undefined);
});

test('a concurrently replaced AVIF or WebP source cannot inherit verification of the old asset', async t => {
  for (const replacement of ['avif', 'webp', 'trash']) await t.test(replacement, async t => {
    const root = fixture(t), { filename, photo } = withUpgrade(root, await avifUpgrade(root));
    let changed = false;
    const { remote } = memoryRemote({ mutate: () => {
      if (changed) return; changed = true;
      const current = readJson(filename);
      if (replacement === 'avif') current[0].fullAvif.src = `/private-photos/assets/v1/${'d'.repeat(64)}.avif`;
      if (replacement === 'webp') current[0].src = `/private-photos/assets/v1/${'d'.repeat(64)}.webp`;
      if (replacement === 'trash') {
        const overridesFile = path.join(root, 'content/photo-overrides.json');
        atomicJson(overridesFile, { ...readJson(overridesFile), [photo.id]: { trashed: true } });
      }
      atomicJson(filename, current);
    } });
    await assert.rejects(publishPhotoAssets(root, journeyId, { publish: true, avifOnly: true, remote }), /sources changed/);
    assert.equal(readJson(filename)[0].fullAvif.assetStatus, 'local');
  });
});

test('AVIF uploads reject disguised formats, metadata, incorrect size/dimensions and incorrect hashes before network access', async t => {
  for (const invalid of ['webp', 'metadata', 'width', 'height', 'bytes', 'hash']) await t.test(invalid, async t => {
    const root = fixture(t), fullAvif = await avifUpgrade(root, '#123456', invalid === 'webp' ? 'webp' : 'avif', invalid === 'metadata');
    if (['width', 'height', 'bytes'].includes(invalid)) fullAvif[invalid]++;
    if (invalid === 'hash') fs.appendFileSync(privatePhotoFile(root, fullAvif.src), 'tampered');
    withUpgrade(root, fullAvif);
    const { remote, calls } = memoryRemote();
    await assert.rejects(publishPhotoAssets(root, journeyId, { publish: true, avifOnly: true, remote }), /metadata-stripped|does not match/);
    assert.equal(calls.length, 0);
  });
});

test('existing objects with different bytes are never overwritten or published', async t => {
  const root = fixture(t), fullAvif = await avifUpgrade(root), { filename } = withUpgrade(root, fullAvif);
  const { remote, calls, stored } = memoryRemote();
  stored.set(`/r2/buckets/travels-private-photos/objects/${fullAvif.src.replace('/private-photos/assets/', '')}`, Buffer.from('wrong bytes'));
  await assert.rejects(publishPhotoAssets(root, journeyId, { publish: true, avifOnly: true, remote }), /never overwritten/);
  assert.equal(calls.filter(call => call.method === 'PUT').length, 0);
  assert.equal(readJson(filename)[0].fullAvif.assetStatus, 'local');
});

test('matching remote bytes with the wrong MIME type cannot become public or be overwritten', async t => {
  const root = fixture(t), fullAvif = await avifUpgrade(root), { filename } = withUpgrade(root, fullAvif);
  const { remote, calls, stored } = memoryRemote({ type: () => 'image/webp' });
  stored.set(`/r2/buckets/travels-private-photos/objects/${fullAvif.src.replace('/private-photos/assets/', '')}`, fs.readFileSync(privatePhotoFile(root, fullAvif.src)));
  await assert.rejects(publishPhotoAssets(root, journeyId, { publish: true, avifOnly: true, remote }), /MIME type mismatch/);
  assert.equal(calls.filter(call => call.method === 'PUT').length, 0);
  assert.equal(readJson(filename)[0].fullAvif.assetStatus, 'local');
  buildSite(root); assert.equal(publicPhotos(root).find(photo => photo.fullAvif?.src === fullAvif.src), undefined);
});

test('optional AVIF encoder failure preserves the successful WebP import and warns about the pending quality upgrade', async t => {
  const root = fixture(t), bytes = await photoBytes(200);
  const { photo, warnings } = await importStudioPhoto(root, { journeyId, dayId: 'family-d1', filename: 'fallback.jpg', bytes }, { encodeAvif: async () => { throw new Error('Synthetic encoder unavailable'); } });
  assert.equal(photo.assetStatus, 'local'); assert.equal(photo.fullAvif, undefined);
  assert.match(photo.src, /\.webp$/); assert.equal(photo.srcset.length, 1);
  assert.ok(fs.existsSync(privatePhotoFile(root, photo.src)));
  assert.ok(warnings.some(message => /AVIF|quality|upgrade/i.test(message)));
  const current = loadContent(root).data.journeys.find(item => item.id === journeyId).photos.find(item => item.id === photo.id);
  assert.equal(current.src, photo.src); assert.equal(current.fullAvif, undefined);
  const duplicate = await importStudioPhoto(root, { journeyId, dayId: 'family-d1', filename: 'fallback-again.jpg', bytes });
  assert.equal(duplicate.duplicate, true); assert.equal(duplicate.photo.id, photo.id);
});
