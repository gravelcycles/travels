#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { cloudflareClient } from './cloudflare-client.mjs';

const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const id = value => typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const https = value => { try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; } };
const MAX_BYTES = 5 * 1024 * 1024;

function reviewedImage(image) {
  if (!id(image?.pointId) || !Number.isInteger(image.imageIndex) || image.imageIndex < 0 || image.imageIndex > 11 || !text(image.inputFile, 4096)) throw new Error('Each selected image needs a place ID, zero-based image index and local input file.');
  if (!text(image.alt, 300) || !text(image.credit, 300) || !https(image.sourceUrl) || !https(image.originalSrc) || !['owned', 'permission', 'licensed', 'illustration', 'cached'].includes(image.permission)) throw new Error('Each selected image needs reviewed description, credit, source, original image URL and provenance.');
  if (image.licenseUrl != null && (!https(image.licenseUrl) || image.permission === 'cached')) throw new Error('Invalid venue-image license; cached references cannot assert a license.');
  if (new URL(image.originalSrc).pathname.startsWith('/place-images/')) throw new Error('Retain the upstream source URL, not another hosted venue copy.');
  for (const src of [image.originalSrc, image.sourceUrl]) if (/^\/private-(?:photos|videos)\//.test(new URL(src).pathname)) throw new Error('Private trip media cannot become public venue imagery.');
}

function store(root, bytes) {
  const digest = hash(bytes), key = `places/v1/${digest}.webp`, file = path.join(root, 'build/place-image-assets/v1', `${digest}.webp`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  try { fs.writeFileSync(file, bytes, { flag: 'wx' }); } catch (error) { if (error.code !== 'EEXIST') throw error; }
  if (!fs.readFileSync(file).equals(bytes)) throw new Error('Venue-image content hash collision.');
  return { digest, key, file };
}

// Preparation reads only this explicitly reviewed list. It neither scrapes
// sources nor changes journey JSON; the report is applied after publication.
export async function publishPlaceImages(root, manifest, { publish = false, remote, now = new Date().toISOString(), progress = () => {} } = {}) {
  if (!manifest || manifest.reviewed !== true || !id(manifest.journeyId) || !Array.isArray(manifest.images) || !manifest.images.length || manifest.images.length > 2400) throw new Error('Choose an explicitly reviewed venue-image manifest.');
  const service = JSON.parse(fs.readFileSync(path.join(root, 'content/photo-service.json'), 'utf8')).origin;
  if (!https(service) || new URL(service).origin !== service) throw new Error('Venue images require the configured HTTPS photo-service origin.');
  if (typeof now !== 'string' || !Number.isFinite(Date.parse(now)) || new Date(now).toISOString() !== now) throw new Error('Use an ISO timestamp for cachedAt.');
  const selected = new Set(), images = [], assets = new Map();
  for (const image of manifest.images) {
    reviewedImage(image);
    const selection = `${image.pointId}:${image.imageIndex}`;
    if (selected.has(selection)) throw new Error('A venue-image position may only be selected once.');
    selected.add(selection);
    const inputPath = path.resolve(root, image.inputFile), input = fs.realpathSync(inputPath);
    const privatePath = path.resolve(root, 'build/private-photo-assets'), privateAssets = fs.existsSync(privatePath) ? fs.realpathSync(privatePath) : privatePath;
    if (input === privateAssets || input.startsWith(`${privateAssets}${path.sep}`) || [inputPath, input].some(value => /(?:^|[\\/])private-photo-assets(?:[\\/]|$)/.test(value))) throw new Error('Protected trip derivatives cannot become public venue imagery.');
    if (fs.statSync(input).size > 50 * 1024 * 1024) throw new Error('Venue source exceeds the 50 MiB input limit.');
    const source = fs.readFileSync(input);
    if (source.length > 50 * 1024 * 1024) throw new Error('Venue source exceeds the 50 MiB input limit.');
    const decoder = sharp(source, { limitInputPixels: 100_000_000 });
    const metadata = await decoder.metadata();
    if (!['jpeg', 'png', 'webp', 'heif'].includes(metadata.format) || (metadata.pages || 1) !== 1) throw new Error('Choose a single-frame photographic venue image.');
    const { data, info } = await decoder.rotate().toColourspace('srgb').resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 84, effort: 5 }).toBuffer({ resolveWithObject: true });
    if (data.length > MAX_BYTES) throw new Error('Venue derivative exceeds the 5 MiB delivery limit.');
    const encoded = await sharp(data).metadata();
    if (encoded.format !== 'webp' || encoded.exif || encoded.xmp || encoded.iptc || encoded.icc || (encoded.pages || 1) !== 1) throw new Error('Venue derivative must be metadata-stripped WebP.');
    const asset = { ...store(root, data), bytes: data.length, width: info.width, height: info.height };
    assets.set(asset.key, asset);
    const { alt, credit, sourceUrl, originalSrc, permission, licenseUrl } = image;
    images.push({ pointId: image.pointId, imageIndex: image.imageIndex, ...asset, picture: { src: `${service}/place-images/assets/v1/${asset.digest}.webp`, alt, credit, sourceUrl, originalSrc, permission, cachedAt: now, ...(licenseUrl ? { licenseUrl } : {}) } });
  }
  const result = { journeyId: manifest.journeyId, published: false, assets: assets.size, bytes: [...assets.values()].reduce((total, asset) => total + asset.bytes, 0), images };
  if (!publish) return result;
  const api = remote || await cloudflareClient(), bucket = '/r2/buckets/travels-private-photos';
  for (const endpoint of ['/domains/managed', '/domains/custom']) {
    const response = await api(bucket + endpoint);
    if (!response.ok) throw new Error('Cannot verify private bucket access.');
    const data = await response.json();
    if (!data.success || data.result?.enabled || data.result?.domains?.length) throw new Error('Keep all direct public R2 access disabled.');
  }
  let completed = 0;
  for (const asset of assets.values()) {
    const resource = `${bucket}/objects/${asset.key}`;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        let response = await api(resource);
        if (response.status === 404) {
          const bytes = fs.readFileSync(asset.file);
          if (bytes.length !== asset.bytes || hash(bytes) !== asset.digest) throw new Error('Local venue derivative changed during publication.');
          const uploaded = await api(resource, { method: 'PUT', headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=31536000, immutable' }, body: bytes });
          if (!uploaded.ok) throw new Error(`Venue-image upload failed (${uploaded.status}).`);
          response = await api(resource);
        }
        if (!response.ok) throw new Error(`Venue-image verification failed (${response.status}).`);
        if (response.headers.get('Content-Type') !== 'image/webp') throw new Error('Remote venue-image MIME mismatch; existing objects are never overwritten.');
        const remoteHash = crypto.createHash('sha256'); let size = 0;
        for await (const chunk of response.body) {
          size += chunk.length;
          if (size > asset.bytes) throw new Error('Remote venue-image checksum mismatch; existing objects are never overwritten.');
          remoteHash.update(chunk);
        }
        if (size !== asset.bytes || remoteHash.digest('hex') !== asset.digest) throw new Error('Remote venue-image checksum mismatch; existing objects are never overwritten.');
        break;
      } catch (error) {
        if (attempt === 3 || !['TypeError', 'TimeoutError', 'AbortError'].includes(error.name)) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
    progress(++completed, assets.size);
  }
  return { ...result, published: true };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), usage = 'Usage: npm run places:publish -- --manifest <reviewed.json> [--publish] [--report <report.json>]';
  try {
    if (args[0] !== '--manifest' || !args[1]) throw new Error(usage);
    let report;
    for (let i = 2; i < args.length; i++) { if (args[i] === '--publish') continue; if (args[i] === '--report' && args[i + 1]) { report = path.resolve(args[++i]); continue; } throw new Error(usage); }
    const root = path.resolve(import.meta.dirname, '..'), manifest = JSON.parse(fs.readFileSync(path.resolve(args[1]), 'utf8'));
    const result = await publishPlaceImages(root, manifest, { publish: args.includes('--publish'), progress: (done, total) => console.log(`Verified ${done}/${total} venue objects`) });
    if (report) { fs.mkdirSync(path.dirname(report), { recursive: true }); const temporary = `${report}.${crypto.randomUUID()}.tmp`; fs.writeFileSync(temporary, JSON.stringify(result, null, 2) + '\n'); fs.renameSync(temporary, report); }
    console.log(JSON.stringify({ journeyId: result.journeyId, images: result.images.length, assets: result.assets, bytes: result.bytes, published: result.published, ...(report ? { report } : {}) }));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
