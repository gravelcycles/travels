import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import sharp from 'sharp';

const run = promisify(execFile);
export const MAX_PHOTO_PIXELS = 100_000_000;

// ImageIO decodes the actual HEIC/RAW source; Quick Look's thumbnail path caps
// the input before the AVIF encoder ever sees it. Temporary PNGs stay private.
export async function decodePhotoSource(source, staging, { allowRaw = false } = {}) {
  const extension = path.extname(source).toLowerCase();
  let decoded = source;
  if (['.heic', '.heif', '.dng'].includes(extension)) {
    if (extension === '.dng' && !allowRaw) throw new Error('RAW photographs require bulk intake');
    if (process.platform !== 'darwin') throw new Error('HEIC/DNG conversion requires macOS ImageIO. Export a JPEG and try again.');
    const { stdout } = await run('/usr/bin/sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', source], { timeout: 60000 });
    const width = Number(stdout.match(/pixelWidth:\s*(\d+)/)?.[1]);
    const height = Number(stdout.match(/pixelHeight:\s*(\d+)/)?.[1]);
    if (!width || !height || width * height > MAX_PHOTO_PIXELS) throw new Error('Invalid or oversized source photograph');
    decoded = path.join(staging, `${path.basename(source)}.decoded.png`);
    await run('/usr/bin/sips', ['-s', 'format', 'png', source, '--out', decoded], { timeout: 120000 });
  }
  const image = sharp(decoded, { limitInputPixels: MAX_PHOTO_PIXELS }).rotate().toColourspace('srgb');
  const info = await image.metadata();
  const width = info.autoOrient?.width || info.width;
  const height = info.autoOrient?.height || info.height;
  if (!width || !height || (info.pages || 1) > 1) throw new Error('Choose a single still photograph');
  return { image, width, height, decoded };
}
