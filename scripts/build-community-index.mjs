import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadContent, readJson } from './journey-content.mjs';
export function communityIndex(root) {
  const { data } = loadContent(root);
  const overrides = readJson(path.join(root, 'content/photo-overrides.json'), {});
  return Object.fromEntries(data.journeys.filter(journey => journey.published && journey.kind === 'real').map(journey => [journey.id,
    journey.photos.filter(photo => photo.assetStatus !== 'local' && !overrides[photo.id]?.trashed).map(photo => photo.id).sort()
  ]).sort(([a], [b]) => a.localeCompare(b)));
}
export function buildCommunityIndex(root) {
  const file = path.join(root, 'workers/photo-auth/community-index.mjs');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `// Generated from published real journeys. No photo URLs or private metadata.\nexport default ${JSON.stringify(communityIndex(root), null, 2)};\n`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) buildCommunityIndex(path.resolve(import.meta.dirname, '..'));
