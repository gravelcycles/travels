#!/usr/bin/env node
// Review-demo-only publisher: reuse the existing private bucket, hash keys and
// authorization; never alter journey photo manifests or upload source photos.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {cloudflareClient} from '../../cloudflare-client.mjs';
import {privatePhotoFile, isPrivatePhotoUrl, PRIVATE_PREFIX} from '../../photo-variants.mjs';
import {accountStorageBytes, VIDEO_STORAGE_CEILING} from '../../publish-video-assets.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const args = process.argv.slice(2), sourceIndex = args.indexOf('--source-root');
if (sourceIndex < 0 || !args[sourceIndex + 1] || args.some((a, i) => i !== sourceIndex + 1 && !['--source-root', '--publish'].includes(a))) {
  throw new Error('Usage: node scripts/experiments/depth/publish-depth-assets.mjs --source-root <checkout-with-private-assets> [--publish]');
}
const sourceRoot = path.resolve(args[sourceIndex + 1]);
const manifestPath = path.join(root, 'dist/experiments/depth/assets/manifest.json');
const manifestBytes = fs.readFileSync(manifestPath);
const manifest = JSON.parse(manifestBytes);
const selected = manifest.samples.filter(sample => sample.protected);
if (selected.length !== 7) throw new Error('Expected the seven reviewed protected demo samples.');
const journeyId = 'backpacking-europe-heading-east';
const photos = new Map(['', '-uploads'].flatMap(suffix => JSON.parse(fs.readFileSync(path.join(root, `content/photo-manifests/${journeyId}${suffix}.json`), 'utf8'))).map(photo => [photo.id, photo]));
const overrides = JSON.parse(fs.readFileSync(path.join(root, 'content/photo-overrides.json'), 'utf8'));
const depths = new Map(), existingImages = new Map();
for (const sample of selected) {
  const photo = photos.get(sample.sourcePhotoId);
  if (sample.journeyId !== journeyId || !photo?.protected || photo.assetStatus !== 'published' || overrides[photo.id]?.trashed || ![sample.image, sample.thumbnail].every(src => photo.srcset.some(variant => variant.src === src))) throw new Error('Selected source photo changed or is no longer eligible.');
  for (const [kind, src] of [['depth', sample.depth], ['image', sample.image], ['thumbnail', sample.thumbnail]]) {
    if (!isPrivatePhotoUrl(src)) throw new Error('Every protected sample resource must use the existing private photo namespace.');
    const filename = privatePhotoFile(sourceRoot, src), data = fs.readFileSync(filename);
    const digest = crypto.createHash('sha256').update(data).digest('hex');
    if (src !== `${PRIVATE_PREFIX}v1/${digest}.webp`) throw new Error('Local protected asset checksum mismatch.');
    const metadata = await sharp(data).metadata();
    if (metadata.format !== 'webp' || metadata.exif || metadata.xmp || metadata.iptc) throw new Error('Protected demo assets must be metadata-stripped WebP.');
    if (kind === 'depth' && (data.length !== sample.depthBytes || digest !== sample.depthSha256 || Math.max(metadata.width, metadata.height) > 518)) throw new Error('Depth metadata does not match the generated manifest.');
    const asset = {key: src.slice(PRIVATE_PREFIX.length), digest, data};
    (kind === 'depth' ? depths : existingImages).set(asset.key, asset);
  }
}
const result = {samples: selected.length, depthObjects: depths.size, depthBytes: [...depths.values()].reduce((sum, asset) => sum + asset.data.length, 0), published: false};
if (!args.includes('--publish')) {
  console.log(JSON.stringify(result));
  process.exit(0);
}

// Wrangler reads authorization in memory; the existing helper prints no token.
process.chdir(sourceRoot);
const api = await cloudflareClient(), bucket = '/r2/buckets/travels-private-photos';
for (const endpoint of ['/domains/managed', '/domains/custom']) {
  const response = await api(bucket + endpoint), body = await response.json();
  if (!response.ok || !body.success || body.result?.enabled || body.result?.domains?.length) throw new Error('Cannot verify that all public R2 access is disabled.');
}
const metricsResponse = await api('/r2/metrics'), metrics = await metricsResponse.json();
if (!metricsResponse.ok || !metrics.success) throw new Error('Cannot verify account storage.');
const used = accountStorageBytes(metrics.result);
if (used + result.depthBytes > VIDEO_STORAGE_CEILING) throw new Error('Depth upload exceeds the existing conservative account storage ceiling.');

async function verify(asset, uploadMissing) {
  const resource = `${bucket}/objects/${asset.key}`;
  let response = await api(resource);
  if (response.status === 404 && uploadMissing) {
    const uploaded = await api(resource, {method: 'PUT', headers: {'Content-Type': 'image/webp', 'Cache-Control': 'no-store'}, body: asset.data});
    if (!uploaded.ok) throw new Error(`Protected depth upload failed (${uploaded.status}).`);
    response = await api(resource);
  }
  if (!response.ok) throw new Error(`Protected asset verification failed (${response.status}).`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length !== asset.data.length || crypto.createHash('sha256').update(bytes).digest('hex') !== asset.digest) throw new Error('Remote protected asset checksum mismatch; existing objects are never overwritten.');
}
for (const asset of existingImages.values()) await verify(asset, false);
let verified = 0;
for (const asset of depths.values()) {
  await verify(asset, true);
  console.log(`Verified protected depth ${++verified}/${depths.size}`);
}
const origin = JSON.parse(fs.readFileSync(path.join(root, 'content/photo-service.json'), 'utf8')).origin;
for (const sample of selected) {
  const response = await fetch(origin + sample.depth, {method: 'HEAD', headers: {Origin: 'https://gravelcycles.github.io'}, signal: AbortSignal.timeout(30000)});
  if (response.status !== 401 || !response.headers.get('cache-control')?.includes('no-store')) throw new Error('Protected depth gateway did not reject anonymous access.');
}
if (!fs.readFileSync(manifestPath).equals(manifestBytes)) throw new Error('Demo manifest changed during publication; review and rerun before marking published.');
for (const sample of selected) sample.assetStatus = 'published';
fs.writeFileSync(manifestPath + '.tmp', JSON.stringify(manifest, null, 2) + '\n');
fs.renameSync(manifestPath + '.tmp', manifestPath);
console.log(JSON.stringify({...result, published: true, accountStorageBytes: used, anonymousAccess: '401/no-store'}));
