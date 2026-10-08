import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

// Run explicitly after editing the brand artwork; the site build copies these
// reviewed rasters verbatim, avoiding platform-dependent font rasterization.
const root = path.resolve(import.meta.dirname, '..');
const source = path.join(root, 'content/branding');
const icon = await fs.readFile(path.join(source, 'icon.svg'));
for (const [name, size] of [['favicon-16.png', 16], ['favicon-32.png', 32], ['apple-touch-icon.png', 180]]) {
  await sharp(icon).resize(size, size).png().toFile(path.join(source, name));
}
await sharp(path.join(source, 'share.svg')).png().toFile(path.join(source, 'share.png'));
console.log('Brand icons and share image regenerated in content/branding. Run npm run build next.');
