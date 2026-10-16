import '../dist/assets/atlas-utils.js';

const utils = globalThis.JOURNEY_ATLAS_UTILS;
const select = (values, ids) => Object.fromEntries(Object.entries(values).filter(([id]) => ids.has(id)).sort(([a], [b]) => a.localeCompare(b)));

// Keep the runtime's four existing data contracts. Photo records are copied
// whole, including format/variant fields added by the media pipeline.
export function journeyPageData(data, routes, photos, overrides, journeys) {
  const routeIds = new Set(journeys.flatMap(journey => journey.segments.map(segment => segment.id)));
  const dayIds = new Set(journeys.flatMap(journey => journey.days.map(day => day.id)));
  const photoIds = new Set(journeys.flatMap(journey => photos[journey.id].map(photo => photo.id)));
  return {
    JOURNEY_ATLAS_DATA: { ...data, defaultJourneyId: journeys.some(journey => journey.id === data.defaultJourneyId) ? data.defaultJourneyId : journeys[0]?.id, journeys },
    JOURNEY_ATLAS_ROUTE_GEOMETRY: select(routes, routeIds),
    JOURNEY_ATLAS_PHOTOS: Object.fromEntries(journeys.map(journey => [journey.id, photos[journey.id]])),
    JOURNEY_ATLAS_CONTENT_OVERRIDES: { photos: select(overrides.photos, photoIds), routes: select(overrides.routes, routeIds), days: select(overrides.days, dayIds) }
  };
}

export function catalogData(data, photos, overrides, metadata) {
  return {
    defaultJourneyId: data.defaultJourneyId,
    // Verification tools can inspect the complete public metadata without
    // making visitors download it. These URLs are data, not preload requests.
    metadata,
    journeys: data.journeys.filter(journey => journey.kind === 'real').map(journey => {
      const visible = utils.visiblePhotos(journey, photos, overrides);
      return {
        id: journey.id, slug: journey.slug, kind: journey.kind, published: journey.published,
        kicker: journey.kicker, title: journey.title, subtitle: journey.subtitle, dates: journey.dates,
        eventCount: journey.days.length, eventLabel: utils.eventWord(journey, 'plural'),
        distanceLabel: utils.journeyPresentation(journey, visible).distanceLabel,
        cover: utils.resolveCover(journey, visible)
      };
    })
  };
}
