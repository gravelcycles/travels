#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { loadJourneys, readJson, writeJson } from './journey-content.mjs';
import { privatePhotoFile, storeDerivative } from './photo-variants.mjs';

// Add thumbnails without re-encoding existing previews/full-size photos.
export async function addPhotoThumbnails(root, { apply = false } = {}) {
  let photos = 0, bytes = 0;
  for (const journey of loadJourneys(root, { includeDrafts: true }).journeys.filter(j => j.kind === 'real')) {
    for (const suffix of ['', '-uploads']) {
      const file = path.join(root, journey.published ? `content/photo-manifests/${journey.id}${suffix}.json` : `build/draft-assets/${journey.id}/${suffix ? 'uploads' : 'photos'}.json`);
      if (!fs.existsSync(file)) continue;
      const updated = readJson(file); let changed = false;
      for (const photo of updated) {
        if (!photo.protected || !photo.srcset?.length) continue;
        const variants = [...photo.srcset].sort((a,b) => a.width-b.width);
        if (variants[0].width <= 480) continue;
        const { data, info } = await sharp(privatePhotoFile(root, variants[0].src))
          .resize({ width: 480, withoutEnlargement: true }).webp({ quality: 80, effort: 5 }).toBuffer({ resolveWithObject: true });
        photos++; bytes += data.length;
        if (apply) {
          photo.srcset = [{ src: storeDerivative(root, data), width: info.width, height: info.height, bytes: info.size }, ...variants];
          photo.assetStatus = 'local'; changed = true;
        }
      }
      if (changed) {
        const backup = path.join(root, 'build/backups/photo-thumbnails');
        fs.mkdirSync(backup, { recursive: true });
        fs.copyFileSync(file, path.join(backup, `${Date.now()}-${path.basename(file)}`));
        writeJson(file, updated);
      }
    }
  }
  return { photos, bytes, applied: apply };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(await addPhotoThumbnails(path.resolve(import.meta.dirname, '..'), { apply: process.argv.includes('--apply') }));
}
