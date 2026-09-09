#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { loadJourneys, readJson } from './journey-content.mjs';
import { readOverrides, buildSite } from './build-site.mjs';
import { uploadManifestPath, atomicJson } from './studio-photo-service.mjs';
const repo = 'gravelcycles/travels';
const run = async args => (await promisify(execFile)('gh', args, { maxBuffer: 10 * 1024 * 1024 })).stdout;

export async function publishPhotoAssets(root, journeyId, { publish = false, gh = run, verify = async url => {
  const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Published asset is not accessible (${response.status}). Retry publishing before deploying the site.`);
} } = {}) {
  const journey = loadJourneys(root, { includeDrafts: true }).journeys.find(j => j.id === journeyId);
  if (!journey) throw new Error('Select a known journey with --journey <id>.');
  if (!journey.published && publish) throw new Error('Draft journeys stay private. Publish/review the journey before its photo assets.');
  const manifestPath = uploadManifestPath(root, journey);
  const photos = readJson(manifestPath, []);
  const overrides = readOverrides(root);
  const pending = photos.filter(p => p.assetStatus === 'local' && !overrides.photos[p.id]?.trashed && !overrides.photos[p.id]?.hidden);
  const tag = `${journey.id}-uploads-v1`;
  const assets = pending.flatMap(photo => photo.srcset.map(v => {
    const url = new URL(v.src);
    const name = path.basename(url.pathname);
    if (url.origin !== 'https://github.com' || url.pathname !== `/${repo}/releases/download/${tag}/${name}` || !name.startsWith(`${photo.id}-w`) || !/\.webp$/.test(name)) throw new Error('Unexpected photo asset URL.');
    const filename = path.join(root, 'build', tag, name);
    const bytes = fs.readFileSync(filename);
    return { name, filename, url: v.src, size: bytes.length, digest: `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}` };
  }));
  const result = { journeyId, photos: pending.length, assets: assets.length, bytes: assets.reduce((n, a) => n + a.size, 0), releaseTag: tag, published: false };
  if (!publish || !pending.length) return result;
  let release;
  // Listing releases distinguishes a missing tag from authentication/network errors.
  const releases = JSON.parse(await gh(['release', 'list', '--repo', repo, '--limit', '1000', '--json', 'tagName,isDraft']));
  const existing = releases.find(r => r.tagName === tag);
  if (existing?.isDraft) throw new Error('The photo release is a draft; review its visibility before publishing.');
  if (!existing) await gh(['release', 'create', tag, '--repo', repo, '--title', `${journey.title} photo uploads`, '--notes', 'Optimized, metadata-stripped photo derivatives. Originals remain private.']);
  release = JSON.parse(await gh(['release', 'view', tag, '--repo', repo, '--json', 'assets']));
  for (const asset of assets) {
    const remote = release.assets.find(a => a.name === asset.name);
    if (remote) {
      if (remote.size !== asset.size || (remote.digest && remote.digest !== asset.digest)) throw new Error(`Existing asset differs: ${asset.name}. Immutable assets are never overwritten.`);
    } else await gh(['release', 'upload', tag, asset.filename, '--repo', repo]);
    await verify(asset.url);
  }
  // Do not overwrite an import that completed during the upload.
  const completed = new Set(pending.map(p => p.id));
  atomicJson(manifestPath, readJson(manifestPath, []).map(p => completed.has(p.id) ? { ...p, assetStatus: 'published' } : p));
  buildSite(root);
  return { ...result, published: true };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (![2, 3].includes(args.length) || args[0] !== '--journey' || (args[2] && args[2] !== '--publish')) throw new Error('Usage: npm run photos:publish -- --journey <id> [--publish]');
  const root = path.resolve(import.meta.dirname, '..');
  console.log(await publishPhotoAssets(root, args[1], { publish: args.includes('--publish') }));
  console.log(args.includes('--publish') ? 'Assets checked; commit and deploy the generated site to publish album changes.' : 'Preview only. Add --publish after reviewing photos in Studio.');
}
