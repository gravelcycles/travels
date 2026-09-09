import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import sharp from 'sharp';
import exifr from 'exifr';
import { loadJourneys, readJson, writeJson } from './journey-content.mjs';
import { photoImportConfig, captureDateParts } from './photo-import-config.mjs';

export const MAX_PHOTO_BYTES = 50 * 1024 * 1024;
export function uploadManifestPath(root, journey) {
  return path.join(root, journey.published ? `content/photo-manifests/${journey.id}-uploads.json` : `build/draft-assets/${journey.id}/uploads.json`);
}
export function atomicJson(filename, value) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  const temporary = `${filename}.${crypto.randomUUID()}.tmp`;
  writeJson(temporary, value);
  fs.renameSync(temporary, filename);
}

export function assignPhotoDay(journey, metadata, dayId = 'auto') {
  let captured;
  try { captured = captureDateParts(metadata, journey.timeZone); } catch { /* Requires a manual day below. */ }
  if (!dayId || dayId === 'auto') {
    const day = captured && journey.days.find(day => day.calendarDate === captured.date);
    if (!day) {
      const error = new Error(captured ? `Capture date ${captured.date} is outside this journey. Choose a day for this photo.` : 'No usable capture date. Choose a day for this photo.');
      error.needsDay = true;
      throw error;
    }
    return { day, captured, warnings: [] };
  }
  const day = journey.days.find(day => day.id === dayId);
  if (!day) throw new Error('Choose a day in this journey.');
  const warnings = !captured ? ['No usable capture date; used your selected day.']
    : captured.date !== day.calendarDate ? [`Camera date is ${captured.date}; used your selected day (${day.calendarDate}).`] : [];
  return { day, captured, warnings };
}

// Imports append separately from bulk camera imports. Originals and GPS stay
// private; the public build excludes assetStatus:local until publishing succeeds.
export async function importStudioPhoto(root, { journeyId, dayId = 'auto', filename, bytes }) {
  if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > MAX_PHOTO_BYTES) throw new Error('Choose a nonempty photo up to 50 MB.');
  const extension = path.extname(filename || '').toLowerCase();
  if (!['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'].includes(extension)) throw new Error('Choose a JPEG, PNG, WebP, or HEIC photograph. Videos are not supported.');
  const config = photoImportConfig(root, loadJourneys(root, { includeDrafts: true }), { journey: journeyId });
  const { journey } = config;
  if (dayId && dayId !== 'auto' && !journey.days.some(day => day.id === dayId)) throw new Error('Choose a day in this journey.');
  const hash = crypto.createHash('sha256').update(bytes).digest('hex');
  const id = `${journey.id}-upload-${hash.slice(0, 20)}`;
  const manifestPath = uploadManifestPath(root, journey);
  const existing = readJson(manifestPath, []).find(photo => photo.id === id);
  if (existing) return { photo: existing, duplicate: true, warnings: ['This photo is already imported. Its existing day and edits were kept.'] };
  // A separate release keeps incremental uploads independent of bulk rebuilds.
  const releaseTag = `${journey.id}-uploads-v1`;
  const outputDirectory = path.join(root, 'build', releaseTag);
  const originalDirectory = path.join(root, 'photos/studio-uploads', journey.id);
  const stagingRoot = path.join(root, 'build');
  fs.mkdirSync(stagingRoot, { recursive: true });
  const staging = fs.mkdtempSync(path.join(stagingRoot, 'photo-upload-'));
  const source = path.join(staging, `${hash}${extension}`);
  fs.writeFileSync(source, bytes);
  const warnings = [];
  try {
    let metadata = {};
    try { metadata = await exifr.parse(source, { reviveValues: false, pick: ['DateTimeOriginal', 'CreateDate', 'OffsetTimeOriginal', 'OffsetTimeDigitized', 'latitude', 'longitude', 'Orientation'] }) || {}; }
    catch { warnings.push('Camera metadata could not be read.'); }
    const assignment = assignPhotoDay(journey, metadata, dayId);
    const { day, captured } = assignment;
    warnings.push(...assignment.warnings);
    let decoded = source;
    if (['.heic', '.heif'].includes(extension)) {
      if (process.platform !== 'darwin') throw new Error('HEIC conversion requires macOS. Export a JPEG and try again.');
      await promisify(execFile)('/usr/bin/qlmanage', ['-t', '-s', '3200', '-o', staging, source], { timeout: 60000 });
      decoded = `${source}.png`;
    }
    const image = sharp(decoded, { limitInputPixels: 100_000_000 }).rotate();
    const info = await image.metadata();
    const width = info.autoOrient?.width || info.width;
    if (!width || !info.height || (info.pages || 1) > 1) throw new Error('Choose a single still photograph.');
    const widths = [...new Set([480, 1280, 2560, 3200].map(w => Math.min(w, width)))];
    const variants = [];
    for (const size of widths) {
      const name = `${id}-w${size}.webp`;
      const result = await image.clone().resize({ width: size, withoutEnlargement: true }).webp({ quality: size <= 480 ? 78 : 84, effort: 5 }).toFile(path.join(staging, name));
      variants.push({ src: `https://github.com/gravelcycles/travels/releases/download/${releaseTag}/${name}`, width: result.width, height: result.height });
    }
    const blur = await image.clone().resize({ width: 32, withoutEnlargement: true }).blur(1.1).webp({ quality: 28 }).toBuffer();
    const largest = variants.at(-1);
    const photo = { id, dayId: day.id, src: largest.src, srcset: variants.map(({ src, width }) => ({ src, width })), width: largest.width, height: largest.height,
      blur: `data:image/webp;base64,${blur.toString('base64')}`, caption: '', description: '', captionSource: 'user',
      alt: `Photo from Day ${day.number}`, sourceFilename: path.basename(filename),
      takenAt: captured ? `${captured.date} · ${captured.time}` : '', assetStatus: 'local' };
    fs.mkdirSync(originalDirectory, { recursive: true });
    fs.copyFileSync(source, path.join(originalDirectory, `${hash}${extension}`));
    fs.mkdirSync(outputDirectory, { recursive: true });
    for (const variant of variants) {
      const name = path.basename(new URL(variant.src).pathname);
      fs.renameSync(path.join(staging, name), path.join(outputDirectory, name));
    }
    const candidate = Number.isFinite(metadata.latitude) && Number.isFinite(metadata.longitude) ? { lat: metadata.latitude, lng: metadata.longitude } : null;
    if (candidate) warnings.push('Camera GPS is retained privately; add a map pin after checking the location.');
    atomicJson(path.join(originalDirectory, `${hash}.json`), { id, sourceFilename: path.basename(filename), captured, candidateLocation: candidate, importedAt: new Date().toISOString() });
    // Re-read after asynchronous processing to preserve other completed imports.
    const latest = readJson(manifestPath, []);
    if (!latest.some(p => p.id === id)) atomicJson(manifestPath, [...latest, photo]);
    return { photo, duplicate: false, warnings };
  } finally { fs.rmSync(staging, { recursive: true, force: true }); }
}
