import fs from 'node:fs';
import path from 'node:path';
import '../dist/assets/atlas-utils.js';

const privateThumbnail = /^\/private-photos\/assets\/(v1\/[a-f0-9]{64}\.webp)$/;
const validId = value => typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
const positive = value => Number.isSafeInteger(value) && value > 0;

// Consume the same public projection as the site, so a local or trashed photo
// cannot accidentally acquire a share capability through a second source load.
export function photoShareIndex({ journeys, photos, overrides, site }) {
  const base = new URL(site.url);
  if (base.protocol !== 'https:' || base.username || base.password) throw new Error('Invalid share site URL');
  const result = {};
  for (const journey of journeys.filter(item => item.published)) {
    const page = new URL(journey.kind === 'demo' ? 'demo.html' : journey.slug, base);
    if (page.origin !== base.origin || !page.pathname.startsWith(base.pathname)) throw new Error('Invalid share journey URL');
    if (journey.kind === 'demo') page.searchParams.set('journey', journey.id);
    const groups = (journey.routeGroups || []).map(group => group.id).filter(validId);
    const entries = {};
    for (const raw of photos[journey.id] || []) {
      const photo = globalThis.JOURNEY_ATLAS_UTILS.resolvePhoto(raw, overrides?.photos?.[raw.id]);
      if (photo.trashed || raw.assetStatus === 'local' || photo.mediaType === 'video') continue;
      const day = journey.days.find(item => item.id === photo.dayId);
      if (!day || !validId(photo.id) || !validId(photo.dayId)) continue;
      const candidates = (photo.srcset || []).filter(item => positive(item.width) && item.width <= 480).sort((a, b) => b.width - a.width);
      let thumbnail;
      if (photo.protected || photo.src?.startsWith('/private-photos/')) {
        const candidate = candidates.find(item => privateThumbnail.test(item.src));
        if (!candidate) continue; // Never substitute a private preview/full image.
        const height = candidate.height || (positive(photo.width) && positive(photo.height) ? Math.round(candidate.width * photo.height / photo.width) : undefined);
        thumbnail = { key: privateThumbnail.exec(candidate.src)[1], width: candidate.width, ...(positive(height) ? { height } : {}) };
      } else {
        const candidate = candidates[0] || (positive(photo.width) && photo.width <= 480 ? { src: photo.src, width: photo.width, height: photo.height } : null);
        if (!candidate) continue; // Public samples use an explicit small derivative too.
        if (typeof candidate.src !== 'string' || !candidate.src) continue;
        let image; try { image = new URL(candidate.src, base); } catch { continue; }
        if (image.protocol !== 'https:' || image.username || image.password || image.pathname.startsWith('/private-photos/')) continue;
        thumbnail = { url: image.href, width: candidate.width, ...(positive(candidate.height) ? { height: candidate.height } : {}) };
      }
      entries[photo.id] = {
        dayId: day.id, title: photo.caption?.trim() || day.title || journey.title,
        ...(photo.caption?.trim() ? { alt: photo.caption.trim() } : {}),
        thumbnail
      };
    }
    if (Object.keys(entries).length) result[journey.id] = { page: page.href, title: journey.title, groups, photos: entries };
  }
  return { siteName: site.name, icon: new URL('assets/brand/apple-touch-icon.png', base).href, journeys: result };
}

export function buildPhotoShareIndex(root, projection) {
  const index = photoShareIndex(projection);
  const filename = path.join(root, 'workers/photo-auth/photo-share-index.mjs');
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, `// Generated from the site's published photo projection. Only share thumbnails, never full private media.\nexport default ${JSON.stringify(index, null, 2)};\n`);
  return index;
}
