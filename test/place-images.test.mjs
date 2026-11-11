import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import worker from '../workers/photo-auth/worker.mjs';
import { placeImageRequest } from '../workers/photo-auth/place-images.mjs';
import { publishPlaceImages } from '../scripts/publish-place-images.mjs';

const digest = 'a'.repeat(64), host = 'https://photos.example.test', route = `/place-images/assets/v1/${digest}.webp`;
function publicFixture() {
  const reads = [];
  const object = { body: new Uint8Array([1, 2, 3]), size: 3, httpMetadata: { contentType: 'image/webp' } };
  const env = { ALLOWED_ORIGINS: '["https://gravelcycles.github.io"]', PHOTO_CREDENTIALS: JSON.stringify({ version: 2, credentials: [{ id: 'fixture', salt: 'A'.repeat(43), hash: 'A'.repeat(43), iterations: 600000 }] }), SESSION_SIGNING_KEY: 'A'.repeat(43), PHOTOS: {
    get: async key => { reads.push(['get', key]); return object; },
    head: async key => { reads.push(['head', key]); return object; },
  } };
  const request = (pathname = route, options) => worker.fetch(new Request(host + pathname, options), env, {});
  return { env, object, reads, request };
}

test('venue images are public, immutable GET/HEADs and only read the isolated places namespace', async () => {
  const f = publicFixture();
  for (const method of ['GET', 'HEAD']) {
    const response = await f.request(route, { method });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Content-Type'), 'image/webp');
    assert.equal(response.headers.get('Cache-Control'), 'public, max-age=31536000, immutable');
    assert.equal(response.headers.get('ETag'), `"${digest}"`);
    assert.equal(response.headers.get('Cross-Origin-Resource-Policy'), 'cross-origin');
    assert.equal(response.headers.get('Set-Cookie'), null);
    assert.equal((await response.arrayBuffer()).byteLength, method === 'GET' ? 3 : 0);
  }
  const unchanged = await f.request(route, { headers: { 'If-None-Match': `W/"${digest}"` } });
  assert.equal(unchanged.status, 304); assert.equal((await unchanged.arrayBuffer()).byteLength, 0);
  assert.deepEqual(f.reads, [['get', `places/v1/${digest}.webp`], ['head', `places/v1/${digest}.webp`], ['head', `places/v1/${digest}.webp`]]);
});

test('public venue delivery rejects private keys, traversal, queries, arbitrary URLs and write methods before R2', async () => {
  const f = publicFixture();
  for (const pathname of [route + '?url=https://example.test/photo.jpg', route.replace('/v1/', '/v1/%2e%2e%2f'), route.replace('/v1/', '/v1/%2F'), '/place-images/assets/places/v1/' + digest + '.webp', '/place-images/assets/private-photos/assets/v1/' + digest + '.webp', '/place-images/assets/https://example.test/picture.jpg', route.replace('.webp', '.avif'), route.replace(digest, digest.toUpperCase())]) {
    assert.equal((await f.request(pathname)).status, 404, pathname);
  }
  for (const method of ['POST', 'PUT', 'DELETE', 'OPTIONS']) {
    const response = await f.request(route, { method });
    assert.equal(response.status, 405); assert.equal(response.headers.get('Allow'), 'GET, HEAD');
  }
  assert.deepEqual(f.reads, []);
  const privatePath = '/private-photos/assets/v1/' + digest + '.webp';
  assert.equal(await placeImageRequest(new Request(host + privatePath), f.env), null);
  assert.equal((await f.request(privatePath)).status, 401);
  assert.deepEqual(f.reads, []);
});

test('missing and invalid venue objects fail without caching errors or returning a false 304', async () => {
  const f = publicFixture();
  f.env.PHOTOS.head = f.env.PHOTOS.get = async () => null;
  const missing = await f.request(route, { headers: { 'If-None-Match': '*' } });
  assert.equal(missing.status, 404); assert.equal(missing.headers.get('Cache-Control'), 'no-store');
  f.env.PHOTOS.head = f.env.PHOTOS.get = async () => ({ ...f.object, httpMetadata: { contentType: 'image/avif' } });
  const wrong = await f.request(route); assert.equal(wrong.status, 503); assert.equal(wrong.headers.get('Cache-Control'), 'no-store');
});

async function publicationFixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-place-images-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'content'), { recursive: true });
  fs.mkdirSync(path.join(root, 'build/venue-images'), { recursive: true });
  fs.writeFileSync(path.join(root, 'content/photo-service.json'), JSON.stringify({ origin: host }));
  const inputFile = 'build/venue-images/venue.jpg';
  await sharp({ create: { width: 2000, height: 1000, channels: 3, background: '#668899' } }).jpeg().withExif({ IFD0: { Artist: 'Unpublished camera metadata' } }).toFile(path.join(root, inputFile));
  const image = { pointId: 'a-venue', imageIndex: 0, inputFile, originalSrc: 'https://venue.example.test/picture.jpg', alt: 'Tables outside the venue.', credit: 'Venue photographer', sourceUrl: 'https://venue.example.test/', permission: 'cached' };
  const manifest = { reviewed: true, journeyId: 'trip-a', images: [image] };
  return { root, manifest, image, now: '2026-11-11T12:00:00.000Z' };
}
function remoteFixture() {
  const objects = new Map(), requests = [];
  const remote = async (resource, options = {}) => {
    requests.push([resource, options.method || 'GET']);
    if (resource.endsWith('/domains/managed')) return Response.json({ success: true, result: { enabled: false } });
    if (resource.endsWith('/domains/custom')) return Response.json({ success: true, result: { domains: [] } });
    if (options.method === 'PUT') { objects.set(resource, { body: Buffer.from(options.body), type: options.headers['Content-Type'] }); return new Response(null); }
    const object = objects.get(resource);
    return object ? new Response(object.body, { headers: { 'Content-Type': object.type } }) : new Response(null, { status: 404 });
  };
  return { objects, requests, remote };
}

test('explicit reviewed preparation strips metadata, caps dimensions, preserves source and creates hashed WebP', async t => {
  const f = await publicationFixture(t), before = fs.readFileSync(path.join(f.root, f.image.inputFile)), manifest = structuredClone(f.manifest);
  const result = await publishPlaceImages(f.root, f.manifest, { now: f.now });
  assert.equal(result.published, false); assert.equal(result.assets, 1);
  const prepared = result.images[0], bytes = fs.readFileSync(prepared.file), metadata = await sharp(bytes).metadata();
  assert.equal(metadata.width, 1600); assert.equal(metadata.height, 800); assert.equal(metadata.format, 'webp');
  for (const key of ['exif', 'xmp', 'iptc', 'icc']) assert.equal(metadata[key], undefined);
  const hash = crypto.createHash('sha256').update(bytes).digest('hex');
  assert.equal(prepared.key, `places/v1/${hash}.webp`);
  assert.deepEqual(prepared.picture, { src: `${host}/place-images/assets/v1/${hash}.webp`, alt: f.image.alt, credit: f.image.credit, sourceUrl: f.image.sourceUrl, originalSrc: f.image.originalSrc, permission: 'cached', cachedAt: f.now });
  assert.deepEqual(fs.readFileSync(path.join(f.root, f.image.inputFile)), before); assert.deepEqual(f.manifest, manifest);
  await assert.rejects(publishPlaceImages(f.root, { ...f.manifest, reviewed: false }), /reviewed/);
  await assert.rejects(publishPlaceImages(f.root, { ...f.manifest, images: [{ ...f.image, permission: 'linked' }] }), /provenance/);
  await assert.rejects(publishPlaceImages(f.root, { ...f.manifest, images: [{ ...f.image, licenseUrl: 'https://example.test/license' }] }), /cannot assert/);
  await assert.rejects(publishPlaceImages(f.root, { ...f.manifest, images: [{ ...f.image, originalSrc: `${host}/place-images/assets/v1/${digest}.webp` }] }), /upstream source/);
  await assert.rejects(publishPlaceImages(f.root, { ...f.manifest, images: [f.image, f.image] }), /only be selected once/);
  const privateFiles = path.join(f.root, 'build/protected-files'); fs.mkdirSync(privateFiles);
  fs.copyFileSync(path.join(f.root, f.image.inputFile), path.join(privateFiles, 'photo.jpg'));
  fs.symlinkSync(privateFiles, path.join(f.root, 'build/private-photo-assets'));
  await assert.rejects(publishPlaceImages(f.root, { ...f.manifest, images: [{ ...f.image, inputFile: path.join(privateFiles, 'photo.jpg') }] }), /Protected trip derivatives/);
});

test('venue publication verifies immutable bytes and resumes without PUT or journey-source changes', async t => {
  const f = await publicationFixture(t), remote = remoteFixture();
  const first = await publishPlaceImages(f.root, f.manifest, { publish: true, remote: remote.remote, now: f.now });
  assert.equal(first.published, true); assert.equal(remote.objects.size, 1);
  assert.ok(remote.requests.every(([resource]) => resource.includes('/domains/') || /\/objects\/places\/v1\/[a-f0-9]{64}\.webp$/.test(resource)));
  const puts = remote.requests.filter(([, method]) => method === 'PUT').length;
  const repeat = await publishPlaceImages(f.root, f.manifest, { publish: true, remote: remote.remote, now: f.now });
  assert.equal(repeat.published, true); assert.equal(remote.requests.filter(([, method]) => method === 'PUT').length, puts);
  assert.equal(fs.existsSync(path.join(f.root, 'content/journeys/trip-a.json')), false);
});

test('remote checksum/MIME failures and a public bucket abort publication without replacing an existing object', async t => {
  const f = await publicationFixture(t), prepared = await publishPlaceImages(f.root, f.manifest, { now: f.now });
  const resource = '/r2/buckets/travels-private-photos/objects/' + prepared.images[0].key;
  for (const object of [{ body: Buffer.from('wrong content'), type: 'image/webp' }, { body: fs.readFileSync(prepared.images[0].file), type: 'image/jpeg' }]) {
    const remote = remoteFixture(); remote.objects.set(resource, object);
    await assert.rejects(publishPlaceImages(f.root, f.manifest, { publish: true, remote: remote.remote, now: f.now }), /Remote venue-image (?:checksum|MIME) mismatch/);
    assert.ok(remote.requests.every(([, method]) => method !== 'PUT'));
    assert.equal(remote.objects.get(resource), object);
  }
  const requests = [];
  await assert.rejects(publishPlaceImages(f.root, f.manifest, { publish: true, now: f.now, remote: async resource => { requests.push(resource); return Response.json({ success: true, result: { enabled: true } }); } }), /direct public R2 access disabled/);
  assert.equal(requests.length, 1);
});
