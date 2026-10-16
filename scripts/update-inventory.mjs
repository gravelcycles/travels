const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const record = (value, name) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} must be an object`);
  return value;
};
const array = (value, name) => {
  if (!Array.isArray(value)) throw new Error(`${name} must be an array`);
  return value;
};
const id = (value, name) => {
  if (typeof value !== 'string' || !ID.test(value)) throw new Error(`${name} must be a stable ID`);
  return value;
};
const label = (value, name) => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} must contain text`);
  return value.trim().replace(/\s+/g, ' ');
};
const unique = (values, name) => {
  if (new Set(values).size !== values.length) throw new Error(`${name} contains duplicate IDs`);
};
const locationId = (value, name) => {
  if (typeof value !== 'string' || !/^(?:place|event):[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) throw new Error(`${name} must be a location ID`);
  return value;
};
function siteBase(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('siteUrl must be an absolute HTTP(S) URL'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('siteUrl must be an HTTP(S) base URL without credentials, query or fragment');
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  return url.href;
}
function photoOverrides(overrides, photoId) {
  const value = own(overrides, photoId) ? record(overrides[photoId], `Photo ${photoId} override`) : {};
  if (own(value, 'trashed') && typeof value.trashed !== 'boolean') throw new Error(`Photo ${photoId}: trashed must be boolean`);
  return value;
}

/** A compact snapshot of published real trips; media URLs and private metadata are omitted. */
export function createInventory({ data, photos, overrides = {}, siteUrl, capturedAt, source = {} }) {
  record(data, 'data');
  const journeys = array(data.journeys, 'data.journeys');
  if (photos !== undefined) record(photos, 'photos');
  record(overrides, 'overrides');
  const photoEdits = record(overrides.photos ?? {}, 'overrides.photos');
  const dayEdits = record(overrides.days ?? {}, 'overrides.days');
  if (typeof capturedAt !== 'string' || !Number.isFinite(Date.parse(capturedAt))) throw new Error('capturedAt must be a valid timestamp');
  record(source, 'source');
  const base = siteBase(siteUrl), result = [];
  const journeyIds = journeys.map(journey => id(record(journey, 'Journey').id, 'Journey ID'));
  unique(journeyIds, 'Journeys');
  for (const journey of journeys) {
    if (!['real', 'demo'].includes(journey.kind) || typeof journey.published !== 'boolean') throw new Error(`${journey.id}: kind and published must be explicit`);
    if (journey.kind !== 'real' || !journey.published) continue;
    const title = label(journey.title, `${journey.id} title`);
    if (typeof journey.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*\.html$/.test(journey.slug)) throw new Error(`${journey.id}: invalid public slug`);
    const url = new URL(journey.slug, base).href;
    const days = array(journey.days, `${journey.id} days`), places = array(journey.places, `${journey.id} places`);
    unique(days.map(day => id(record(day, 'Event').id, 'Event ID')), `${journey.id} events`);
    unique(places.map(place => id(record(place, 'Place').id, 'Place ID')), `${journey.id} places`);
    const placesById = new Map(places.map(place => [place.id, place]));
    const events = new Map(days.map(day => {
      const edit = own(dayEdits, day.id) ? record(dayEdits[day.id], `${day.id} override`) : {};
      const destinationId = day.destinationId || day.placeId;
      let group;
      if (destinationId) {
        id(destinationId, `${day.id} destination`);
        const place = placesById.get(destinationId);
        if (!place) throw new Error(`${day.id}: destination ${destinationId} does not exist`);
        group = { id: `place:${destinationId}`, label: label(place.name, `${destinationId} name`) };
      } else group = { id: `event:${day.id}`, label: label(edit.title ?? day.title, `${day.id} title`) };
      return [day.id, group];
    }));
    // A separate manifest is authoritative. Missing it is an error, never an empty album.
    if (photos !== undefined && !own(photos, journey.id)) throw new Error(`${journey.id}: photo manifest is missing`);
    const media = array(photos === undefined ? journey.photos : photos[journey.id], `${journey.id} photos`);
    unique(media.map(photo => id(record(photo, 'Photo').id, 'Photo ID')), `${journey.id} photos`);
    const selected = [];
    for (const photo of media) {
      const edit = photoOverrides(photoEdits, photo.id);
      if (photo.assetStatus != null && !['local', 'published'].includes(photo.assetStatus)) throw new Error(`${photo.id}: unknown assetStatus`);
      if (own(photo, 'trashed') && typeof photo.trashed !== 'boolean') throw new Error(`${photo.id}: trashed must be boolean`);
      const eventId = id(own(edit, 'dayId') ? edit.dayId : photo.dayId, `${photo.id} dayId`);
      if (!events.has(eventId)) throw new Error(`${photo.id}: event ${eventId} does not exist in ${journey.id}`);
      if (photo.assetStatus === 'local' || (edit.trashed ?? photo.trashed) || photo.mediaType === 'video' || photo.mimeType?.startsWith('video/')) continue;
      selected.push({ id: photo.id, locationId: events.get(eventId).id, eventId });
    }
    const occupiedEvents = new Set(selected.map(photo => photo.eventId));
    const locations = new Map();
    for (const day of days) {
      if (!occupiedEvents.has(day.id)) continue;
      const group = events.get(day.id);
      if (!locations.has(group.id)) locations.set(group.id, { ...group, eventIds: [] });
      locations.get(group.id).eventIds.push(day.id);
    }
    result.push({ id: journey.id, title, url, locations: [...locations.values()], photos: selected });
  }
  return { schemaVersion: 1, siteUrl: base, capturedAt, source: structuredClone(source), journeys: result };
}

function validateInventory(inventory) {
  record(inventory, 'Inventory');
  if (inventory.schemaVersion !== 1) throw new Error('Unsupported inventory schemaVersion');
  const base = new URL(siteBase(inventory.siteUrl));
  if (typeof inventory.capturedAt !== 'string' || !Number.isFinite(Date.parse(inventory.capturedAt))) throw new Error('Inventory capturedAt must be a valid timestamp');
  record(inventory.source, 'Inventory source');
  const journeys = array(inventory.journeys, 'Inventory journeys');
  unique(journeys.map(journey => id(record(journey, 'Inventory journey').id, 'Journey ID')), 'Inventory journeys');
  unique(journeys.map(journey => journey.url), 'Inventory journey URLs');
  for (const journey of journeys) {
    label(journey.title, `${journey.id} title`);
    let url;
    try { url = new URL(journey.url); } catch { throw new Error(`${journey.id}: invalid journey URL`); }
    if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname) || url.username || url.password || url.search || url.hash) throw new Error(`${journey.id}: invalid journey URL`);
    const locations = array(journey.locations, `${journey.id} locations`);
    unique(locations.map(location => locationId(record(location, 'Location').id, 'Location ID')), `${journey.id} locations`);
    const groups = new Map(locations.map(location => {
      label(location.label, `${location.id} label`);
      const eventIds = array(location.eventIds, `${location.id} eventIds`).map(eventId => id(eventId, 'Event ID'));
      if (!eventIds.length) throw new Error(`${location.id}: must contain an event`);
      unique(eventIds, `${location.id} events`);
      return [location.id, new Set(eventIds)];
    }));
    unique(locations.flatMap(location => location.eventIds), `${journey.id} location events`);
    const photos = array(journey.photos, `${journey.id} photos`);
    unique(photos.map(photo => id(record(photo, 'Inventory photo').id, 'Photo ID')), `${journey.id} photos`);
    for (const photo of photos) {
      if (!groups.get(photo.locationId)?.has(photo.eventId)) throw new Error(`${photo.id}: missing inventory location/event`);
    }
    const populated = new Set(photos.map(photo => photo.locationId));
    if (locations.some(location => !populated.has(location.id))) throw new Error(`${journey.id}: inventory locations must contain photos`);
    const populatedEvents = new Set(photos.map(photo => photo.eventId));
    if (locations.some(location => location.eventIds.some(eventId => !populatedEvents.has(eventId)))) throw new Error(`${journey.id}: inventory location events must contain photos`);
  }
  return inventory;
}

function validateKnown(known) {
  record(known, 'Known inventory');
  const journeys = record(known.journeys, 'Known journeys');
  for (const [journeyId, journey] of Object.entries(journeys)) {
    id(journeyId, 'Known journey ID');
    record(journey, `Known ${journeyId}`);
    unique(array(journey.photoIds, `${journeyId} photoIds`).map(photoId => id(photoId, 'Known photo ID')), `${journeyId} known photos`);
    unique(array(journey.locationIds, `${journeyId} locationIds`).map(value => locationId(value, 'Known location ID')), `${journeyId} known locations`);
  }
  return known;
}

/** Membership only; retaining acknowledged IDs prevents Trash/restore from becoming new. */
export function knownFromInventory(inventory) {
  validateInventory(inventory);
  return { journeys: Object.fromEntries(inventory.journeys.map(journey => [journey.id, {
    photoIds: journey.photos.map(photo => photo.id).sort(),
    locationIds: journey.locations.map(location => location.id).sort()
  }])) };
}

/** Acknowledging a snapshot unions history instead of forgetting removed trips or photos. */
export function mergeKnown(known, inventory) {
  validateKnown(known);
  const result = structuredClone(known), incoming = knownFromInventory(inventory);
  for (const [journeyId, journey] of Object.entries(incoming.journeys)) {
    const previous = own(result.journeys, journeyId) ? result.journeys[journeyId] : { photoIds: [], locationIds: [] };
    result.journeys[journeyId] = {
      photoIds: [...new Set([...previous.photoIds, ...journey.photoIds])].sort(),
      locationIds: [...new Set([...previous.locationIds, ...journey.locationIds])].sort()
    };
  }
  return result;
}

/** Additions since an acknowledged baseline, grouped by the current authored destination. */
export function diffInventory(current, known) {
  validateInventory(current); validateKnown(known);
  const journeys = [];
  for (const journey of current.journeys) {
    const isNewTrip = !own(known.journeys, journey.id), previous = isNewTrip ? { photoIds: [], locationIds: [] } : known.journeys[journey.id];
    const knownPhotos = new Set(previous.photoIds), knownLocations = new Set(previous.locationIds);
    const added = journey.photos.filter(photo => !knownPhotos.has(photo.id));
    if (!isNewTrip && !added.length) continue;
    const locations = [];
    for (const location of journey.locations) {
      const photos = added.filter(photo => photo.locationId === location.id);
      if (!photos.length) continue;
      const selectedEvents = new Set(photos.map(photo => photo.eventId));
      const eventIds = location.eventIds.filter(eventId => selectedEvents.has(eventId));
      const links = eventIds.map(eventId => { const url = new URL(journey.url); url.hash = new URLSearchParams({ day: eventId }).toString(); return { eventId, url: url.href }; });
      locations.push({ id: location.id, label: location.label, isNewLocation: !knownLocations.has(location.id), newPhotoCount: photos.length, photoIds: photos.map(photo => photo.id), eventIds, url: links[0].url, links });
    }
    journeys.push({ id: journey.id, title: journey.title, url: journey.url, isNewTrip, newPhotoCount: added.length, locationCount: locations.length, photoIds: added.map(photo => photo.id), locations });
  }
  return {
    newTripCount: journeys.filter(journey => journey.isNewTrip).length,
    newPhotoCount: journeys.reduce((total, journey) => total + journey.newPhotoCount, 0),
    locationCount: journeys.reduce((total, journey) => total + journey.locationCount, 0),
    journeys, hasChanges: journeys.length > 0
  };
}

const count = (number, noun) => `${number} ${noun}${number === 1 ? '' : 's'}`;

/** Plain text for a manual broadcast. Formatting this message never acknowledges or sends it. */
export function formatUpdateMessage(diff) {
  if (!diff.hasChanges) return 'No new trips or photos since the last checkpoint.';
  const summary = [];
  if (diff.newTripCount) summary.push(count(diff.newTripCount, 'new trip'));
  if (diff.newPhotoCount) summary.push(`${count(diff.newPhotoCount, 'new photo')} across ${count(diff.locationCount, 'location')}`);
  const parts = ['Journey Atlas update', summary.join(' · ')];
  for (const journey of diff.journeys) {
    const lines = [`${journey.isNewTrip ? 'New trip: ' : ''}${journey.title}`];
    for (const location of journey.locations) {
      lines.push(`• ${location.label}: ${count(location.newPhotoCount, 'new photo')}${location.isNewLocation ? ' (first photos)' : ''}`);
    }
    lines.push(journey.url);
    parts.push('', ...lines);
  }
  return parts.join('\n');
}
