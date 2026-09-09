import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import sharp from 'sharp';
import { importStudioPhoto, uploadManifestPath, atomicJson } from '../scripts/studio-photo-service.mjs';
import { publishPhotoAssets } from '../scripts/publish-photo-assets.mjs';
import { buildSite } from '../scripts/build-site.mjs';
import { loadContent, readJson } from '../scripts/journey-content.mjs';
const repo = path.resolve(import.meta.dirname, '..');
const journeyId = 'switzerland-italy-family-2026';
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-photo-library-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.cpSync(path.join(repo, 'content'), path.join(root, 'content'), { recursive: true, filter: name => !name.includes('/drafts') });
  fs.cpSync(path.join(repo, 'dist'), path.join(root, 'dist'), { recursive: true });
  return root;
}
async function photoBytes(width = 700) {
  return sharp({ create: { width, height: 400, channels: 3, background: '#537b9e' } }).jpeg().withExif({ IFD0: { Artist: 'Private camera owner' } }).toBuffer();
}
function publicPhotos(root) {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'dist/assets/trip-photos.js'), 'utf8'), context);
  return context.window.JOURNEY_ATLAS_PHOTOS[journeyId];
}

test('upload appends a deduplicated photo with blank copy, safe sizes, private original and stripped metadata', async t => {
  const root = fixture(t), bytes = await photoBytes();
  const before = loadContent(root).data.journeys.find(j => j.id === journeyId).photos.length;
  const { photo } = await importStudioPhoto(root, { journeyId, dayId: 'family-d3', filename: '../../camera.jpg', bytes });
  assert.equal(photo.caption, ''); assert.equal(photo.description, '');
  assert.equal(photo.sourceFilename, 'camera.jpg'); assert.equal(photo.dayId, 'family-d3');
  assert.equal(photo.assetStatus, 'local'); assert.equal(photo.lng, undefined);
  assert.deepEqual(photo.srcset.map(v => v.width), [480, 700]);
  assert.ok(photo.blur.startsWith('data:image/webp;base64,'));
  const file = path.join(root, 'build', `${journeyId}-uploads-v1`, path.basename(photo.src));
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

test('publishing is preview-only by default and retryable; failed verification keeps photos local', async t => {
  const root = fixture(t), bytes = await photoBytes(200);
  const { photo } = await importStudioPhoto(root, { journeyId, dayId:'family-d1', filename:'small.jpg', bytes });
  assert.deepEqual(photo.srcset.map(v => v.width), [200]);
  const calls = [];
  const gh = async args => { calls.push(args); if(args[1] === 'list') return JSON.stringify([{tagName:`${journeyId}-uploads-v1`,isDraft:false}]); if(args[1] === 'view') return JSON.stringify({assets:[]}); return ''; };
  const preview = await publishPhotoAssets(root, journeyId, { gh });
  assert.equal(preview.photos, 1); assert.equal(calls.length, 0);
  await assert.rejects(publishPhotoAssets(root, journeyId, { publish:true, gh, verify:async () => { throw new Error('offline'); } }), /offline/);
  const journey = loadContent(root).data.journeys.find(j => j.id === journeyId);
  assert.equal(readJson(uploadManifestPath(root, journey))[0].assetStatus, 'local');
  const published = await publishPhotoAssets(root, journeyId, { publish:true, gh, verify:async () => {} });
  assert.equal(published.published, true); assert.ok(publicPhotos(root).some(p => p.id === photo.id));
  assert.equal((await publishPhotoAssets(root, journeyId, { publish:true, gh })).photos, 0);
  assert.ok(calls.filter(c => c[1] === 'upload').every(c => c[3].endsWith('.webp') && !c.includes('--clobber')));
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

test('the upload UI retains successful files when a batch also contains a failure', async () => {
  const source = fs.readFileSync(path.join(repo, 'studio/studio.js'), 'utf8');
  const start = source.indexOf('  async function uploadPhotos()');
  const end = source.indexOf('\n  async function saveAll()', start);
  const nodes = new Map();
  const node = id => { if(!nodes.has(id)) nodes.set(id, { value:'', textContent:'', disabled:false }); return nodes.get(id); };
  node('#upload-photo-files').files = [{name:'broken.jpg',size:10},{name:'good.jpg',size:10}];
  node('#upload-photo-day').value = 'd1';
  const photo = {id:'new-photo',dayId:'d1',caption:'',description:'',assetStatus:'local'};
  const basePhotos = [];
  const context = vm.createContext({
    $:node, journey:{id:'trip'}, basePhotos, photosByJourney:{}, plans:new Map(), savedRevisions:{}, uploadingPhotos:false,
    URLSearchParams, dayById:id=>({id}), photoWithOverride:p=>p,
    renderDaySelectors(){},renderPhotoGrid(){},selectPhoto(id){context.selected=id;},
    fetch:async url=>({ok:true,json:async()=>url.includes('filename=broken')?{ok:false,error:'Cannot decode'}:url==='/api/state'?{revisions:{trip:'new-revision'}}:{ok:true,photo,duplicate:false,warnings:[]}})
  });
  vm.runInContext(source.slice(start,end), context);
  await vm.runInContext('uploadPhotos()', context);
  assert.equal(basePhotos.length,1); assert.equal(context.selected,photo.id);
  assert.match(node('#photo-upload-status').textContent,/broken.jpg: Cannot decode/);
  assert.match(node('#photo-upload-status').textContent,/good.jpg: added locally/);
  assert.equal(node('#upload-photos').disabled,false);
});
