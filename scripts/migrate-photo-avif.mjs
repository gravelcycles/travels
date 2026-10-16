#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { readJson } from './journey-content.mjs';
import { atomicJson } from './studio-photo-service.mjs';
import { buildFullAvif, privatePhotoFile, AVIF_OPTIONS } from './photo-variants.mjs';
import { decodePhotoSource } from './photo-decode.mjs';

const hashFile = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const media = /\.(heic|heif|dng|jpe?g|png|webp)$/i;
export function originalIndex(directory) {
  const names = new Map(), hashes = new Map(), ids = new Map();
  const add = (map, key, file) => { if (key) map.set(key, [...(map.get(key) || []), file]); };
  function visit(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile() && media.test(entry.name)) {
        add(names, entry.name.toLowerCase(), file);
        if (/^[a-f0-9]{64}$/.test(path.parse(entry.name).name)) add(hashes, path.parse(entry.name).name, file);
      } else if (entry.isFile() && /^[a-f0-9]{64}\.json$/.test(entry.name)) {
        const record = readJson(file), stem = path.parse(entry.name).name;
        for (const candidate of fs.readdirSync(dir).filter(name => name.startsWith(`${stem}.`) && media.test(name))) {
          add(ids, record.id, path.join(dir, candidate));
        }
      }
    }
  }
  visit(directory);
  return { names, hashes, ids };
}

export function findOriginal(photo, index) {
  const expected = photo.sourceHash || photo.id.match(/-upload-([a-f0-9]{20})$/)?.[1];
  const candidates = [...new Set([
    ...(index.ids.get(photo.id) || []), ...(index.hashes.get(photo.sourceHash) || []),
    ...(index.names.get(String(photo.sourceFilename || '').toLowerCase()) || [])
  ])].map(file => ({ file, hash: hashFile(file) }));
  const matching = expected ? candidates.filter(source => source.hash.startsWith(expected)) : candidates;
  const unique = new Map(matching.map(source => [source.hash, source]));
  if (unique.size !== 1) throw new Error(`${photo.id}: ${unique.size ? 'Ambiguous' : 'Missing or mismatched'} untouched original`);
  return [...unique.values()][0];
}

export async function migratePhotoAvif(root, { journeyId, sourceRoot = path.join(root, 'photos'), apply = false, concurrency = 2, progress = () => {}, encode = buildFullAvif, decode = decodePhotoSource } = {}) {
  if (!/^[a-z0-9-]+$/.test(journeyId || '')) throw new Error('Select a journey');
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4) throw new Error('Concurrency must be 1–4');
  const journey = readJson(path.join(root, 'content/journeys', `${journeyId}.json`));
  if (!journey.published) throw new Error('AVIF migration only upgrades published journeys');
  const overrides = readJson(path.join(root, 'content/photo-overrides.json'), {});
  const files = ['', '-uploads'].map(suffix => path.join(root, `content/photo-manifests/${journeyId}${suffix}.json`)).filter(file => fs.existsSync(file));
  const selected = files.flatMap(file => readJson(file).map(photo => ({ file, photo }))).filter(({ photo }) => photo.protected && photo.assetStatus === 'published' && !overrides[photo.id]?.trashed);
  const index = originalIndex(sourceRoot), jobs = selected.map(job => ({ ...job, source: findOriginal(job.photo, index) }));
  const result = { journeyId, selected: jobs.length, created: 0, reused: 0, bytes: 0, failures: [], options: AVIF_OPTIONS, photos: [] };
  if (!apply) return { ...result, originalsVerified: jobs.length, apply: false };
  const reportDir = path.join(root, 'build/avif-migration', journeyId);
  fs.mkdirSync(reportDir, { recursive: true });
  for (const file of files) {
    const backup = path.join(reportDir, `${path.basename(file)}.${hashFile(file)}.backup.json`);
    if (!fs.existsSync(backup)) fs.copyFileSync(file, backup, fs.constants.COPYFILE_EXCL);
  }
  const queue = [...jobs];
  await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, async () => {
    while (queue.length) {
      const { file, photo, source } = queue.shift();
      let staging;
      try {
        let fullAvif = photo.fullAvif;
        if (fullAvif) {
          const saved = privatePhotoFile(root, fullAvif.src);
          if (!fs.existsSync(saved) || fullAvif.src !== `/private-photos/assets/v1/${hashFile(saved)}.avif` || fs.statSync(saved).size !== fullAvif.bytes) throw new Error('Existing AVIF is missing or does not match its checksum');
          result.reused++;
        } else {
          staging = fs.mkdtempSync(path.join(reportDir, 'decode-'));
          const { image, width, height } = await decode(source.file, staging, { allowRaw: true });
          if (Math.abs(width / height - photo.width / photo.height) > 0.005 || width * height < photo.width * photo.height * 0.99) throw new Error('Original dimensions/orientation do not match the existing photograph');
          fullAvif = await encode(root, image);
          if (hashFile(source.file) !== source.hash) throw new Error('Original changed during generation');
          const latest = readJson(file), current = latest.find(item => item.id === photo.id);
          if (!current || current.src !== photo.src || current.sourceFilename !== photo.sourceFilename || current.sourceHash !== photo.sourceHash || current.assetStatus !== 'published' || current.fullAvif) throw new Error('Photo source changed during generation; retry against current manifest');
          // Only add the independently local derivative; preserve every newer edit.
          current.fullAvif = fullAvif;
          atomicJson(file, latest);
          result.created++;
        }
        result.bytes += fullAvif.bytes;
        result.photos.push({ id: photo.id, sourceHash: source.hash, sourceFilename: photo.sourceFilename, fullAvif });
        progress({ id: photo.id, completed: result.photos.length + result.failures.length, total: jobs.length, fullAvif });
      } catch (error) {
        result.failures.push({ id: photo.id, error: error.message });
        progress({ id: photo.id, completed: result.photos.length + result.failures.length, total: jobs.length, error: error.message });
      } finally {
        if (staging) fs.rmSync(staging, { recursive: true, force: true });
        atomicJson(path.join(reportDir, 'report.json'), result);
      }
    }
  }));
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), options = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--apply') options.apply = true;
    else if (['--journey', '--source-root', '--concurrency'].includes(args[i]) && args[i + 1]) {
      const key = { '--journey': 'journeyId', '--source-root': 'sourceRoot', '--concurrency': 'concurrency' }[args[i]];
      options[key] = key === 'concurrency' ? Number(args[++i]) : args[++i];
    } else throw new Error('Usage: node scripts/migrate-photo-avif.mjs --journey <id> [--source-root <private originals>] [--apply] [--concurrency 1–4]');
  }
  sharp.concurrency(2);
  const result = await migratePhotoAvif(path.resolve(import.meta.dirname, '..'), { ...options, progress: item => console.log(JSON.stringify(item)) });
  console.log(JSON.stringify({ ...result, photos: undefined }, null, 2));
  if (result.failures.length) process.exitCode = 1;
}
