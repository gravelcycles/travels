import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import sharp from 'sharp';
import exifr from 'exifr';

const run = promisify(execFile);
export const MAX_PHOTO_PIXELS = 100_000_000;

// Decode HEIC at source resolution. DNG keeps its established Quick Look RAW
// rendering, requesting and verifying native pixels instead of a capped preview.
// Temporary PNGs stay private.
export async function decodePhotoSource(source, staging, { allowRaw = false } = {}) {
  const extension = path.extname(source).toLowerCase();
  let decoded = source, expectedRawDimensions;
  if (['.heic', '.heif', '.dng'].includes(extension)) {
    if (extension === '.dng' && !allowRaw) throw new Error('RAW photographs require bulk intake');
    if (process.platform !== 'darwin') throw new Error('HEIC/DNG conversion requires macOS ImageIO. Export a JPEG and try again.');
    const { stdout } = await run('/usr/bin/sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', source], { timeout: 60000 });
    const width = Number(stdout.match(/pixelWidth:\s*(\d+)/)?.[1]);
    const height = Number(stdout.match(/pixelHeight:\s*(\d+)/)?.[1]);
    if (!width || !height || width * height > MAX_PHOTO_PIXELS) throw new Error('Invalid or oversized source photograph');
    if (extension === '.dng') {
      const metadata = await exifr.parse(source, { pick: ['Orientation'], translateValues: false });
      const orientation = metadata?.Orientation ?? 1;
      if (!Number.isInteger(orientation) || orientation < 1 || orientation > 8) throw new Error('Invalid RAW photograph orientation');
      expectedRawDimensions = orientation >= 5 ? { width: height, height: width } : { width, height };
      await run('/usr/bin/qlmanage', ['-t', '-s', String(Math.max(width, height)), '-o', staging, source], { timeout: 120000 });
      decoded = path.join(staging, `${path.basename(source)}.png`);
    } else {
      decoded = path.join(staging, `${path.basename(source)}.decoded.png`);
      await run('/usr/bin/sips', ['-s', 'format', 'png', source, '--out', decoded], { timeout: 120000 });
    }
  }
  const image = sharp(decoded, { limitInputPixels: MAX_PHOTO_PIXELS }).rotate().toColourspace('srgb');
  const info = await image.metadata();
  const width = info.autoOrient?.width || info.width;
  const height = info.autoOrient?.height || info.height;
  if (!width || !height || (info.pages || 1) > 1) throw new Error('Choose a single still photograph');
  if (expectedRawDimensions && (width !== expectedRawDimensions.width || height !== expectedRawDimensions.height)) throw new Error('RAW preview does not match the original resolution/orientation');
  return { image, width, height, decoded };
}
