import fs from 'node:fs';
import path from 'node:path';
import { loadContent, readJson } from './journey-content.mjs';
import { readOverrides } from './build-site.mjs';
import { prepareJourneyPlan, journeyRevision } from './journey-planner.mjs';
import '../studio/plan-extras.js';

const changes = journey => globalThis.JOURNEY_ATLAS_PLAN_EXTRAS.changes(journey);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const photoAsset = /^\/private-photos\/assets\/(v1\/[a-f0-9]{64}\.webp)$/;
const videoAsset = /^\/private-videos\/assets\/(v1\/[a-f0-9]{64}\.mp4)$/;
const named = item => item.sourceFilename ? String(item.sourceFilename).split(/[\\/]/).at(-1) : item.title || item.id;
const scopedState = (state, journey) => Object.fromEntries([['days', journey.days], ['photos', journey.photos], ['routes', journey.segments]]
  .map(([kind, items]) => [kind, Object.fromEntries(items.filter(item => Object.hasOwn(state[kind] || {}, item.id)).map(item => [item.id, state[kind][item.id]]))]));

// Checks only files under the managed, hash-addressed derivative directories.
// Neither absolute paths nor bytes are included in the report or handoff.
function localAssetExists(root, url) {
  const photo = String(url || '').match(photoAsset), video = String(url || '').match(videoAsset);
  if (!photo && !video) return false;
  const file = path.join(root, 'build', photo ? 'private-photo-assets' : 'private-video-assets', (photo || video)[1]);
  try { const stat = fs.statSync(file); return stat.isFile() && stat.size > 0; } catch { return false; }
}

export function assessReadinessMedia(root, journey, state, add) {
  const visiblePhotos = journey.photos.map(photo => globalThis.JOURNEY_ATLAS_UTILS.resolvePhoto(photo, state.photos[photo.id] || {})).filter(photo => !photo.trashed);
  const visibleVideos = (journey.videos || []).filter(video => !video.hidden);
  const dayIds = new Set(journey.days.map(day => day.id));
  for (const [kind, media] of [['photo', visiblePhotos], ['video', visibleVideos]]) for (const item of media) {
    const action = { mode: kind === 'photo' ? 'photos' : 'media', id: item.id, label: kind === 'photo' ? 'Review photo' : 'Review video' };
    if (!dayIds.has(item.dayId)) add(`day:${item.id}`, 'blocker', `${named(item)} has no valid day`, 'Assign this item to a day in this journey.', action);
    if (item.assetStatus === 'local') {
      const urls = kind === 'photo' ? [...new Set([item.src, ...(item.srcset || []).map(variant => variant.src)])] : [item.src, item.poster];
      const missing = urls.filter(url => !localAssetExists(root, url)).length;
      add(`asset:${item.id}`, 'blocker', `${named(item)} is only stored locally`, missing ? `${missing} required ${kind === 'video' ? 'video/poster' : 'photo'} derivative${missing === 1 ? ' is' : 's are'} missing or empty. Restore or regenerate them before the agent publishes this item.` : 'Local derivatives are present. The agent must publish and verify the protected assets before deploying the journey.', action);
    } else if (!item.src) add(`source:${item.id}`, 'blocker', `${named(item)} has no media source`, 'Supply a usable source or remove this item from the published selection.', action);
    if (kind === 'photo' && (!Number.isFinite(item.lat) || !Number.isFinite(item.lng))) add(`location:${item.id}`, 'review', `${named(item)} has no exact map location`, 'Keep it in the day album without an exact pin, or add a location you know. No coordinate is inferred.', action);
  }
  return { visiblePhotos, visibleVideos };
}

export function assessStudioReadiness(root, input) {
  if (!input || typeof input.journeyId !== 'string' || !input.state || typeof input.changes !== 'object' || !input.changes || Array.isArray(input.changes)) throw new Error('Choose a journey and include its current draft and trip plan.');
  const { data, routes } = loadContent(root, { includeDrafts: true });
  const base = data.journeys.find(journey => journey.id === input.journeyId);
  if (!base) throw new Error('This journey is no longer in the local sources. Reopen Studio to load the current journeys.');
  const saved = readOverrides(root), savedStateRevision = journeyRevision(saved), savedPlanRevision = journeyRevision(base);
  const items = [];
  const add = (id, severity, title, detail, action) => items.push({ id, severity, title, detail, action });
  const planner = { mode: 'planner', label: 'Open trip plan & media' };
  const save = { mode: 'save', label: 'Return to Save locally' };
  const manifest = readJson(path.join(root, `content/route-sources/${base.id}.json`), {});
  const savedRoutesRevision = journeyRevision({ routes: Object.fromEntries(base.segments.map(segment => [segment.id, routes[segment.id] || null])), manifest });
  let journey = base, state = input.state, valid = true;
  try {
    ({ journey, state } = prepareJourneyPlan(data, base, input.changes, state, input.alignment || 'dates'));
  } catch (error) {
    valid = false;
    // Prefer the editor for an identifiable invalid item over a generic dead end.
    const misplaced = base.photos.find(photo => state.photos?.[photo.id]?.dayId && !(input.changes.days || base.days).some(day => day.id === state.photos[photo.id].dayId));
    const item = misplaced ? { ...misplaced, mode: 'photos' } : [...base.photos.map(item => ({ ...item, mode: 'photos' })), ...base.segments.map(item => ({ ...item, mode: 'routes' })), ...base.days.map(item => ({ ...item, mode: 'days' }))]
      .find(item => error.message.includes(item.id));
    add('invalid-draft', 'blocker', 'The current draft needs a correction', error.message, error.message.includes('pointsOfInterest') || error.message.includes('curated place') ? {mode:'places',label:'Open Places editor'} : item ? { mode: item.mode, id: item.id, label: 'Open affected editor' } : planner);
  }
  const sourceChanged = input.stateRevision !== savedStateRevision || input.revision !== savedPlanRevision;
  if (sourceChanged) add('source-changed', 'blocker', 'Saved sources changed or their baseline is missing', 'Save locally to reconcile your draft with the current files. Studio will show field choices if both versions changed the same field, then run this check again.', save);
  const unsaved = !same(scopedState(state, base), scopedState(saved, base)) || !same(changes(journey), changes(base)) || !valid;
  if (unsaved) add('unsaved', 'blocker', 'This journey has edits that are not saved to its sources', 'Draft recovery is separate from Save locally. Review your edits, save them locally, then check again before publishing.', save);

  // Invalid data is never turned into a clean result by falling back to saved data.
  // The next check after correction will assess the fully validated current plan.
  if (valid) {
    const { visiblePhotos, visibleVideos } = assessReadinessMedia(root, journey, state, add);
    const coverId = typeof journey.coverPhoto === 'string' ? journey.coverPhoto : journey.coverPhoto?.photoId;
    if (coverId && !visiblePhotos.some(photo => photo.id === coverId)) add('cover', 'review', 'The chosen cover is excluded', 'The viewer will use its normal cover fallback. Keep that choice or select a visible photo.', planner);
    for (const segment of journey.segments) {
      const override = state.routes[segment.id], geometry = override?.geometry || segment.geometry || routes[segment.id];
      const source = override?.source || segment.source || manifest.segments?.[segment.id];
      const provisional = segment.geometryStatus === 'provisional' || !geometry || geometry.length <= 2;
      const routeName = segment.label || segment.title || `${journey.places.find(place => place.id === segment.from)?.name || segment.from} → ${journey.places.find(place => place.id === segment.to)?.name || segment.to}`;
      if (provisional || !source) add(`route:${segment.id}`, 'review', `${routeName}: ${provisional ? 'provisional route' : 'route evidence needs review'}`, provisional ? 'This line remains an approximate guide. Review its source and keep that provenance, or replace it with reviewed geometry. Acknowledgement does not certify the route.' : 'Detailed geometry is present, but this check found no recorded source. Review and retain the evidence before publishing.', { mode: 'routes', id: segment.id, label: 'Review route' });
    }
    const noDestination = journey.days.filter(day => !day.placeId && !day.destinationId && !day.segmentIds.length && !Object.values(day.groupPlaces || {}).length);
    if (noDestination.length) add('day-context', 'review', `${noDestination.length} day${noDestination.length === 1 ? ' has' : 's have'} no mapped destination`, 'An empty or photo-only day is valid. Keep its map empty, or add known destinations in the trip plan; stories and routes are optional.', planner);
    if (!visiblePhotos.length && !visibleVideos.length && !journey.segments.length) add('empty-content', 'review', 'This is a story-only or empty journey', 'It can be shared intentionally as it stands. Check its title and days; photos, routes and story paragraphs are optional.', { mode: 'days', id: journey.days[0]?.id, label: 'Review days' });
    if (visiblePhotos.length || visibleVideos.length) add('media-selection', 'review', 'Review the selected photos and videos', `${visiblePhotos.length} photo${visiblePhotos.length === 1 ? '' : 's'} and ${visibleVideos.length} video${visibleVideos.length === 1 ? '' : 's'} are included. Confirm the selection and access expectations. Trashed photos and hidden videos are excluded; blank captions are valid.`, visiblePhotos.length ? { mode: 'photos', label: 'Review photo selection' } : { mode: 'media', label: 'Review video selection' });
  }
  if (!base.published) add('draft-promotion', 'blocker', 'This journey is still a local draft', 'The agent must review and promote its sources into the public build before deployment. This panel never promotes or publishes a draft.', planner);
  const report = {
    journey: { id: base.id, title: valid ? journey.title : base.title, kind: base.kind, slug: base.slug, includedInPublicBuild: Boolean(base.published) },
    revisions: { draft: journeyRevision({ journeyId: base.id, changes: input.changes, state: input.state, alignment: input.alignment || 'dates' }), savedState: savedStateRevision, savedPlan: savedPlanRevision, savedRoutes: savedRoutesRevision },
    draft: { valid, unsaved, sourceChanged },
    public: { status: 'unverified', message: 'Public version not verified. Saved files, uploaded assets and inclusion in the public build do not prove what is live.' },
    items,
  };
  return { ...report, assessmentRevision: journeyRevision(report), checkedAt: new Date().toISOString() };
}
