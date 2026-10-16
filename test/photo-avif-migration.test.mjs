import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { migratePhotoAvif, originalIndex, findOriginal } from '../scripts/migrate-photo-avif.mjs';
import { buildFullAvif, buildPhotoVariants, privatePhotoFile, storeDerivative } from '../scripts/photo-variants.mjs';
import { decodePhotoSource } from '../scripts/photo-decode.mjs';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-avif-migration-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const dir of ['content/journeys', 'content/photo-manifests', 'photos', 'build']) fs.mkdirSync(path.join(root, dir), { recursive: true });
  fs.writeFileSync(path.join(root, 'content/journeys/fixture.json'), JSON.stringify({ id: 'fixture', published: true }));
  fs.writeFileSync(path.join(root, 'content/photo-overrides.json'), '{}');
  const file = path.join(root, 'content/photo-manifests/fixture.json');
  return { root, file, read: () => JSON.parse(fs.readFileSync(file)), write: photos => fs.writeFileSync(file, JSON.stringify(photos)) };
}
async function source(root, name = 'photo.jpg', colour = '#668899') {
  const bytes = await sharp({ create: { width: 90, height: 60, channels: 3, background: colour } }).jpeg().withExif({ IFD0: { Artist: 'Private metadata' } }).toBuffer();
  fs.writeFileSync(path.join(root, 'photos', name), bytes);
  return { id: name, sourceFilename: name, sourceHash: crypto.createHash('sha256').update(bytes).digest('hex'), src: `/private-photos/assets/v1/${'a'.repeat(64)}.webp`, srcset: [{ src: `/private-photos/assets/v1/${'a'.repeat(64)}.webp`, width: 90 }], width: 90, height: 60, protected: true, assetStatus: 'published', dayId: 'day-1', caption: 'Owner words', description: '', takenAt: '2026-01-01 · 12:00', lat: 1.2, lng: 3.4 };
}

test('AVIF retains source dimensions/orientation, strips private metadata, and leaves WebP sizes capped', async t => {
  const { root } = fixture(t);
  const input = await sharp({ create: { width: 3301, height: 30, channels: 3, background: '#668899' } }).jpeg().withExif({ IFD0: { Artist: 'Private' } }).toBuffer();
  const image = sharp(input).rotate(), fallback = await buildPhotoVariants(root, image, 3301, 30), avif = await buildFullAvif(root, image);
  assert.equal(fallback.at(-1).width, 3200);
  assert.equal(avif.width, 3301); assert.equal(avif.height, 30); assert.equal(avif.assetStatus, 'local');
  const meta = await sharp(privatePhotoFile(root, avif.src)).metadata();
  assert.equal(meta.format, 'heif'); assert.equal(meta.compression, 'av1'); assert.equal(meta.exif, undefined); assert.equal(meta.xmp, undefined); assert.equal(meta.iptc, undefined);
  assert.throws(() => storeDerivative(root, input, '../jpg'), /Unsupported/);
  assert.throws(() => privatePhotoFile(root, '/private-photos/assets/v1/../photo.avif'), /Invalid/);
  const rotated = path.join(root, 'photos/rotated.jpg');
  await sharp({ create: { width: 90, height: 60, channels: 3, background: '#668899' } }).jpeg().withMetadata({ orientation: 6 }).toFile(rotated);
  const decoded = await decodePhotoSource(rotated, path.join(root, 'build'));
  const oriented = await buildFullAvif(root, decoded.image);
  assert.equal(decoded.width, 60); assert.equal(decoded.height, 90);
  assert.equal(oriented.width, 60); assert.equal(oriented.height, 90);
});

test('dry run verifies originals without changing content; migration adds only local AVIF and resumes without reencoding', async t => {
  const f = fixture(t), photo = await source(f.root); f.write([photo]);
  const before = fs.readFileSync(f.file), original = fs.readFileSync(path.join(f.root, 'photos/photo.jpg'));
  const preview = await migratePhotoAvif(f.root, { journeyId: 'fixture' });
  assert.equal(preview.originalsVerified, 1); assert.deepEqual(fs.readFileSync(f.file), before);
  const result = await migratePhotoAvif(f.root, { journeyId: 'fixture', apply: true });
  assert.equal(result.created, 1); assert.deepEqual(result.failures, []);
  const { fullAvif, ...preserved } = f.read()[0];
  assert.deepEqual(preserved, photo); assert.equal(fullAvif.assetStatus, 'local'); assert.equal(fullAvif.width, 90);
  assert.deepEqual(fs.readFileSync(path.join(f.root, 'photos/photo.jpg')), original);
  const repeated = await migratePhotoAvif(f.root, { journeyId: 'fixture', apply: true, encode: () => { throw new Error('must not encode'); } });
  assert.deepEqual(repeated.failures, []); assert.equal(repeated.reused, 1); assert.equal(repeated.created, 0);
});

test('mismatched hashes and ambiguous filenames fail before mutation', async t => {
  const f = fixture(t), photo = await source(f.root); photo.sourceHash = 'f'.repeat(64); f.write([photo]);
  const before = fs.readFileSync(f.file);
  await assert.rejects(migratePhotoAvif(f.root, { journeyId: 'fixture', apply: true }), /mismatched/);
  assert.deepEqual(fs.readFileSync(f.file), before);
  fs.mkdirSync(path.join(f.root, 'photos/second'));
  await sharp({ create: { width: 90, height: 60, channels: 3, background: '#111111' } }).jpeg().toFile(path.join(f.root, 'photos/second/photo.jpg'));
  delete photo.sourceHash;
  assert.throws(() => findOriginal(photo, originalIndex(path.join(f.root, 'photos'))), /Ambiguous/);
});

test('only published nontrashed photographs are upgraded and a failed encode leaves fallback intact', async t => {
  const f = fixture(t), photos = [];
  for (const name of ['published.jpg', 'failed.jpg', 'local.jpg', 'trashed.jpg']) photos.push(await source(f.root, name));
  photos[2].assetStatus = 'local'; f.write(photos);
  fs.writeFileSync(path.join(f.root, 'content/photo-overrides.json'), JSON.stringify({ 'trashed.jpg': { trashed: true } }));
  let count = 0;
  const result = await migratePhotoAvif(f.root, { journeyId: 'fixture', apply: true, concurrency: 1, encode: async (...args) => { if (++count === 2) throw new Error('Encoder failed'); return buildFullAvif(...args); } });
  assert.equal(result.selected, 2); assert.equal(result.created, 1); assert.equal(result.failures.length, 1);
  assert.ok(f.read()[0].fullAvif);
  assert.deepEqual(f.read().slice(1), photos.slice(1));
});

test('edits during encoding are preserved while replacement sources abort adding the AVIF', async t => {
  const f = fixture(t), photo = await source(f.root); f.write([photo]);
  const result = await migratePhotoAvif(f.root, { journeyId: 'fixture', apply: true, encode: async (...args) => { f.write([{ ...photo, caption: 'Edited during encode', dayId: 'day-2' }]); return buildFullAvif(...args); } });
  assert.equal(result.created, 1); assert.equal(f.read()[0].caption, 'Edited during encode'); assert.equal(f.read()[0].dayId, 'day-2');
  f.write([photo]);
  const replacement = await migratePhotoAvif(f.root, { journeyId: 'fixture', apply: true, encode: async (...args) => { f.write([{ ...photo, src: photo.src.replaceAll('a', 'b') }]); return buildFullAvif(...args); } });
  assert.equal(replacement.failures.length, 1); assert.equal(f.read()[0].fullAvif, undefined);
});
