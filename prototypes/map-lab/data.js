// Map Lab — shared data loading and geometry helpers.
//
// Reads the generated public journey bundles in dist/assets/journey-data
// directly (no copies), applies CONTENT_OVERRIDES the way the viewer does
// (day photoOrder, photo location/mapFrame overrides, route geometry
// overrides, Trash), decodes compact routes with the shared decodeRoute and
// returns one small, normalised model that every option reads.
//
// Privacy (O14): protected trip photos expose only their embedded `blur`
// preview. Their private `src`/`srcset` never leave this module, so an option
// cannot request them by accident. Public demo photos keep a local thumbnail.

const utils = () => window.JOURNEY_ATLAS_UTILS;
const media = () => window.JOURNEY_ATLAS_MEDIA;

export const BRAND = '#006f92';
export const SELECT = '#d4512c';

// Current transport vocabulary (dist/assets/app.js modeStyles).
export const MODES = {
  train: { label: 'Train', color: '#0072b2', width: 5.8, dash: null, cue: 'solid' },
  boat: { label: 'Ferry', color: '#007f8b', width: 5.1, dash: [1.1, 1.6], cue: 'short dash' },
  bus: { label: 'Bus', color: '#a85c00', width: 5, dash: [5.5, 2.2], cue: 'long dash' },
  gondola: { label: 'Gondola', color: '#7b4ba3', width: 4.2, dash: [0.5, 2.1], cue: 'spaced dots' },
  walk: { label: 'Walk', color: '#3d4a4d', width: 4, dash: [0.1, 1.5], cue: 'fine dots' },
  car: { label: 'Car', color: '#a43a2f', width: 5.4, dash: [7, 1.8, 1.2, 1.8], cue: 'dash-dot' },
  bike: { label: 'Bike', color: '#24804f', width: 4.7, dash: [2.4, 1.2], cue: 'medium dash' }
};
export const MODE_ORDER = ['train', 'boat', 'bus', 'gondola', 'walk', 'car', 'bike'];
export const modeOf = mode => MODES[mode] || { label: mode || 'Route', color: BRAND, width: 4.7, dash: null, cue: 'solid' };

export const TRIPS = [
  { id: 'backpacking-europe-heading-east', file: 'trip-backpacking-europe-heading-east.js', label: 'Heading East', note: 'City stops · 31 stops · TBD tail' },
  { id: 'switzerland-italy-family-2026', file: 'trip-switzerland-italy-family-2026.js', label: 'Switzerland–Italy', note: 'Reference · days · ferry, gondola' },
  { id: 'nine-to-como', file: 'demos.js', label: 'Nine to Como (demo)', note: 'Three route groups · meetup' },
  { id: 'alpine-crossing', file: 'demos.js', label: 'Alpine Crossing (demo)', note: 'Public photos · sample places' },
  { id: 'florence-genoa', file: 'trip-florence-genoa.js', label: 'Florence–Genoa', note: 'Bike only · no photos' },
  { id: 'rail-to-adriatic', file: 'demos.js', label: 'Rail to the Adriatic (demo)', note: 'Train and bus' },
  { id: 'dolomites-road', file: 'demos.js', label: 'Dolomites road (demo)', note: 'Car and gondola' },
  { id: 'danube-ride', file: 'demos.js', label: 'Danube ride (demo)', note: 'Bike' }
];

const bundleText = new Map();
function bundleUrl(file) { return new URL(`../../dist/assets/journey-data/${file}`, import.meta.url).href; }
function assetUrl(path) {
  // Demo photo paths are written relative to dist/ ("./assets/photos/…").
  if (/^\.\/assets\/photos\/[\w.-]+\.webp$/.test(path || '')) return new URL(`../../dist/${path.slice(2)}`, import.meta.url).href;
  return null;
}

async function loadBundle(file) {
  if (!bundleText.has(file)) {
    bundleText.set(file, fetch(bundleUrl(file), { cache: 'force-cache' }).then(response => {
      if (!response.ok) throw new Error(`Could not load ${file} (${response.status})`);
      return response.text();
    }));
  }
  const text = await bundleText.get(file);
  // Each bundle assigns four globals. Evaluate it against a private object so
  // trips never overwrite one another and every load yields fresh objects.
  const sandbox = {};
  new Function('window', 'globalThis', text)(sandbox, sandbox);
  return sandbox;
}

// ---------------------------------------------------------------- geometry
const R = 6371;
const rad = d => d * Math.PI / 180;
export function haversine(a, b) {
  const h = Math.sin(rad(b[1] - a[1]) / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(rad(b[0] - a[0]) / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
export function bearing(a, b) {
  const d = rad(b[0] - a[0]), la = rad(a[1]), lb = rad(b[1]);
  return (Math.atan2(Math.sin(d) * Math.cos(lb), Math.cos(la) * Math.sin(lb) - Math.sin(la) * Math.cos(lb) * Math.cos(d)) * 180 / Math.PI + 360) % 360;
}
export function merc([lng, lat]) {
  const s = Math.sin(rad(Math.max(-85.05, Math.min(85.05, lat))));
  return [(lng + 180) / 360, 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)];
}
export function unmerc([x, y]) {
  return [x * 360 - 180, 360 / Math.PI * Math.atan(Math.exp((0.5 - y) * 2 * Math.PI)) - 90];
}
export function bboxOf(coords, into) {
  let [w, s, e, n] = into ? [into[0][0], into[0][1], into[1][0], into[1][1]] : [Infinity, Infinity, -Infinity, -Infinity];
  for (const c of coords) {
    if (!c || !Number.isFinite(c[0]) || !Number.isFinite(c[1])) continue;
    if (c[0] < w) w = c[0]; if (c[0] > e) e = c[0]; if (c[1] < s) s = c[1]; if (c[1] > n) n = c[1];
  }
  return Number.isFinite(w) ? [[w, s], [e, n]] : null;
}
export function boundsCenter(b) { return [(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2]; }

// Douglas–Peucker in Web Mercator units (tolerance as a fraction of the world).
export function simplify(coords, tolerance) {
  if (coords.length < 3) return coords.slice();
  const pts = coords.map(merc), keep = new Uint8Array(coords.length), stack = [[0, coords.length - 1]];
  keep[0] = keep[coords.length - 1] = 1;
  const t2 = tolerance * tolerance;
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy;
    let worst = -1, max = t2;
    for (let i = a + 1; i < b; i++) {
      const t = len ? Math.max(0, Math.min(1, ((pts[i][0] - ax) * dx + (pts[i][1] - ay) * dy) / len)) : 0;
      const d = (pts[i][0] - ax - t * dx) ** 2 + (pts[i][1] - ay - t * dy) ** 2;
      if (d > max) { max = d; worst = i; }
    }
    if (worst > 0) { keep[worst] = 1; stack.push([a, worst], [worst, b]); }
  }
  return coords.filter((_, i) => keep[i]);
}

function measure(coords) {
  const cum = new Float64Array(coords.length);
  for (let i = 1; i < coords.length; i++) cum[i] = cum[i - 1] + haversine(coords[i - 1], coords[i]);
  return cum;
}

// Point at a fraction of a measured path: { point, index, bearing }.
export function along(path, fraction) {
  const { coords, cum } = path, total = cum[cum.length - 1];
  const f = Math.max(0, Math.min(1, fraction));
  if (!total || coords.length < 2) return { point: coords[0], index: 1, bearing: 0 };
  const target = f * total;
  let lo = 1, hi = cum.length - 1;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < target) lo = mid + 1; else hi = mid; }
  const a = coords[lo - 1], b = coords[lo], span = cum[lo] - cum[lo - 1] || 1, t = (target - cum[lo - 1]) / span;
  return { point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], index: lo, bearing: bearing(a, b) };
}
// Prefix of a measured path up to a fraction (for progressive drawing).
export function prefix(path, fraction) {
  const at = along(path, fraction);
  return path.coords.slice(0, at.index).concat([at.point]);
}
// Evenly spaced resample by distance (n points).
export function resample(path, n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(along(path, i / (n - 1)).point);
  return out;
}

// Screen-space greedy grid clustering. `project` maps [lng,lat] → {x,y}.
export function cluster(items, project, radius, coordOf = item => [item.lng, item.lat]) {
  const cells = new Map(), clusters = [], size = radius;
  for (const item of items) {
    const c = coordOf(item);
    if (!c || !Number.isFinite(c[0]) || !Number.isFinite(c[1])) continue;
    const p = project(c);
    if (!p || !Number.isFinite(p.x)) continue;
    const gx = Math.floor(p.x / size), gy = Math.floor(p.y / size);
    let target = null, best = radius * radius;
    for (let ix = gx - 1; ix <= gx + 1; ix++) for (let iy = gy - 1; iy <= gy + 1; iy++) {
      for (const k of cells.get(`${ix},${iy}`) || []) {
        const d = (k.x - p.x) ** 2 + (k.y - p.y) ** 2;
        if (d < best) { best = d; target = k; }
      }
    }
    if (target) {
      target.items.push(item); target.sx += c[0]; target.sy += c[1];
    } else {
      const k = { x: p.x, y: p.y, items: [item], sx: c[0], sy: c[1] };
      clusters.push(k);
      const key = `${gx},${gy}`;
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push(k);
    }
  }
  return clusters.map(k => ({ items: k.items, lng: k.sx / k.items.length, lat: k.sy / k.items.length, key: k.items[0].id }));
}

// ---------------------------------------------------------------- formatting
export const fmtKm = km => Number.isFinite(km) ? `${km >= 100 ? Math.round(km).toLocaleString('en-GB') : km.toFixed(km < 10 ? 1 : 0)} km` : '';
export function fmtDuration(min) {
  if (!Number.isFinite(min)) return '';
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return `${h ? `${h} h` : ''}${h && m ? ' ' : ''}${m ? `${m} min` : ''}` || '0 min';
}
export const legTitle = leg => `${modeOf(leg.mode).label} · ${leg.fromPlace?.name || '?'} → ${leg.toPlace?.name || '?'}`;
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));

// Line icons (24 × 24, stroke = currentColor) for modes, photos and places.
const ICONS = {
  train: '<rect x="5" y="3" width="14" height="14" rx="3.2"/><path d="M5 10h14M9 21l1.4-4M15 21l-1.4-4"/><circle cx="8.6" cy="13.6" r=".7"/><circle cx="15.4" cy="13.6" r=".7"/>',
  bus: '<rect x="4" y="3" width="16" height="15" rx="2.6"/><path d="M4 7.5h16M4 11.5h16M8 21v-3M16 21v-3"/><circle cx="8" cy="14.7" r=".7"/><circle cx="16" cy="14.7" r=".7"/>',
  boat: '<path d="M3.5 14.5h17l-2.2 4.5H5.7z"/><path d="M6.5 14.5V9.5h11v5M10 9.5V6h4v3.5"/><path d="M3 21.5c1.5 0 1.5-.8 3-.8s1.5.8 3 .8 1.5-.8 3-.8 1.5.8 3 .8 1.5-.8 3-.8 1.5.8 3 .8"/>',
  gondola: '<path d="M2.5 3.5l19 3M12 5.1V9"/><rect x="6" y="9" width="12" height="10.5" rx="2.6"/><path d="M6 13.5h12"/>',
  walk: '<circle cx="13.5" cy="4" r="1.7"/><path d="M9.5 21l2.3-6.2 3 3V21M11.8 14.8l-.9-5.2 3.9.9 2 3.2M10.9 9.6L7.6 12.4"/>',
  car: '<path d="M5 15.5v-3.8l2-4.7h10l2 4.7v3.8M3.5 15.5h17v3h-17zM5 11.7h14"/><circle cx="7.6" cy="18.6" r="1.4"/><circle cx="16.4" cy="18.6" r="1.4"/>',
  bike: '<circle cx="6" cy="16" r="3.6"/><circle cx="18" cy="16" r="3.6"/><path d="M6 16l3.8-7h5.4L18 16M9.8 9l2.4 7H6M13.5 6h2.2"/>',
  photo: '<path d="M4 8h3.2l1.9-2.6h5.8L16.8 8H20v11H4z"/><circle cx="12" cy="13.4" r="3.4"/>',
  food: '<path d="M7 3v18M4.6 3v5.2a2.4 2.4 0 0 0 4.8 0V3M17 21V3c-2.2 1.2-3.3 4-3.3 7.6H17"/>',
  place: '<path d="M12 21s-6.8-6.1-6.8-11a6.8 6.8 0 0 1 13.6 0c0 4.9-6.8 11-6.8 11z"/><circle cx="12" cy="10" r="2.4"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z"/>',
  replay: '<path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4.4h4.4"/>',
  skip: '<path d="M5 5.5l9 6.5-9 6.5zM18 5.5v13"/>'
};
export function icon(name, { size = 20, stroke = 1.8, cls = '' } = {}) {
  const body = ICONS[name] || ICONS.place;
  return `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}
export const placeIcon = category => category === 'food' ? 'food' : 'place';

// ---------------------------------------------------------------- the model
function legChains(legs, routeGroups) {
  if (!legs.length) return [];
  if (routeGroups?.length && legs.some(leg => leg.groupIds?.length)) {
    const byKey = new Map();
    for (const leg of legs) {
      const key = leg.groupIds?.join('+') || 'together';
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(leg);
    }
    return [...byKey.values()];
  }
  const chains = [[legs[0]]];
  for (const leg of legs.slice(1)) {
    const chain = chains.at(-1);
    if (chain.at(-1).to === leg.from) chain.push(leg); else chains.push([leg]);
  }
  return chains;
}

function displayDate(day) {
  if (day.planningStatus !== 'tbd') return day.date || '';
  return day.calendarDate ? `TBD · ${day.date}` : 'TBD · Dates to decide';
}

export async function loadTrip(tripId) {
  const entry = TRIPS.find(trip => trip.id === tripId) || TRIPS[0];
  const bundle = await loadBundle(entry.file);
  const data = bundle.JOURNEY_ATLAS_DATA;
  const source = data.journeys.find(journey => journey.id === entry.id);
  if (!source) throw new Error(`Journey ${entry.id} is not in ${entry.file}`);
  const overrides = bundle.JOURNEY_ATLAS_CONTENT_OVERRIDES || { photos: {}, routes: {}, days: {} };
  const geometry = bundle.JOURNEY_ATLAS_ROUTE_GEOMETRY || {};
  const U = utils(), Media = media();
  const city = source.eventMode === 'city';

  const days = source.days.map(day => ({ ...day, ...(overrides.days?.[day.id] || {}) }));
  const places = new Map(source.places.map(place => [place.id, {
    id: place.id, name: place.name, country: place.country || '', lng: place.lng, lat: place.lat,
    boundary: place.cityBoundary && U.validCityBoundary(place.cityBoundary) ? place.cityBoundary : null
  }]));
  const owner = new Map();
  for (const day of days) for (const id of day.segmentIds) if (!owner.has(id)) owner.set(id, day);

  const legs = source.segments.map(segment => {
    const override = overrides.routes?.[segment.id];
    let coords = override?.geometry?.length > 1 ? override.geometry : null;
    if (!coords && segment.geometry) coords = U.decodeRoute(segment.geometry);
    if (!coords && geometry[segment.id]) coords = U.decodeRoute(geometry[segment.id]);
    const fromPlace = places.get(segment.from), toPlace = places.get(segment.to);
    let guide = false;
    if (!Array.isArray(coords) || coords.length < 2) {
      guide = true;
      const via = (segment.via || segment.stops || []).map(p => Array.isArray(p) ? [p[1], p[0]] : [p.lng, p.lat]);
      coords = [[fromPlace.lng, fromPlace.lat], ...via, [toPlace.lng, toPlace.lat]];
    }
    coords = coords.filter(c => Number.isFinite(c?.[0]) && Number.isFinite(c?.[1]));
    const day = owner.get(segment.id);
    const cum = measure(coords);
    const leg = {
      id: segment.id, mode: segment.mode, from: segment.from, to: segment.to, fromPlace, toPlace,
      coords, cum, lengthKm: cum[cum.length - 1],
      km: Number.isFinite(segment.distanceKm) ? segment.distanceKm : cum[cum.length - 1],
      durationMin: Number.isFinite(segment.durationMinutes) ? segment.durationMinutes : null,
      duration: segment.duration || '',
      tbd: day?.planningStatus === 'tbd', guide, groupIds: segment.groupIds || [],
      eventId: day?.id || null,
      stops: (segment.stops || []).filter(s => Number.isFinite(s?.lng) && Number.isFinite(s?.lat)).map(s => ({ name: s.name, lng: s.lng, lat: s.lat }))
    };
    leg.lite = { coords: simplify(coords, 4e-6) };
    leg.lite.cum = measure(leg.lite.coords);
    leg.coarse = { coords: simplify(coords, 2.5e-5) };
    leg.coarse.cum = measure(leg.coarse.coords);
    return leg;
  });
  const legById = new Map(legs.map(leg => [leg.id, leg]));

  // Photos: viewer resolution (overrides, Trash), stills only, album order.
  const raw = (bundle.JOURNEY_ATLAS_PHOTOS?.[source.id] || source.photos || [])
    .map(photo => U.resolvePhoto(photo, overrides.photos?.[photo.id] || {}))
    .filter(photo => !photo.trashed && photo.mediaType !== 'video');
  const dayById = new Map(days.map(day => [day.id, day]));
  const photosByDay = new Map();
  for (const photo of raw) {
    if (!photosByDay.has(photo.dayId)) photosByDay.set(photo.dayId, []);
    photosByDay.get(photo.dayId).push(photo);
  }
  const photos = [];
  for (const day of days) {
    const ordered = Media.orderForDay(photosByDay.get(day.id) || [], day);
    for (const p of ordered) {
      const isPrivate = Boolean(p.protected) || /^\/private-photos\//.test(p.src || '');
      const thumb = isPrivate ? null : assetUrl((p.srcset || []).slice().sort((a, b) => a.width - b.width)[0]?.src || p.src);
      const located = U.locatedPhoto(p);
      photos.push({
        id: p.id, eventId: day.id,
        lng: located ? p.lng : undefined, lat: located ? p.lat : undefined, located,
        takenAt: p.takenAt || '', takenLabel: U.displayTakenAt(p.takenAt || ''),
        time: Media.captureTime(p.takenAt, day),
        preview: isPrivate ? (p.blur || null) : (thumb || p.blur || null),
        sharp: !isPrivate && Boolean(thumb),
        aspect: p.width && p.height ? p.width / p.height : 4 / 3,
        alt: isPrivate ? '' : (p.alt || '')
      });
    }
  }
  // Any photo whose event is not in the itinerary is left out, as in the viewer.

  const pois = (source.pointsOfInterest || []).map(point => ({
    id: point.id, name: point.name, category: point.category || 'place',
    lng: point.coordinates?.[0], lat: point.coordinates?.[1],
    located: Number.isFinite(point.coordinates?.[0]) && Number.isFinite(point.coordinates?.[1]),
    eventIds: point.dayIds || [], photoIds: point.photoIds || [], status: point.status || '', sample: Boolean(point.sample),
    coordinates: point.coordinates, dayIds: point.dayIds || []
  }));

  const events = days.map(day => {
    const eventLegs = day.segmentIds.map(id => legById.get(id)).filter(Boolean);
    const eventPhotos = photos.filter(photo => photo.eventId === day.id);
    return {
      id: day.id, number: day.number, title: day.title || '', date: displayDate(day), rawDate: day.date || '',
      calendarDate: day.calendarDate || null, calendarEndDate: day.calendarEndDate || day.calendarDate || null,
      tbd: day.planningStatus === 'tbd',
      place: places.get(day.destinationId || day.placeId) || eventLegs.at(-1)?.toPlace || null,
      legs: eventLegs, chains: legChains(eventLegs, source.routeGroups),
      photos: eventPhotos, located: eventPhotos.filter(photo => photo.located),
      pois: pois.filter(point => point.eventIds.includes(day.id)),
      meetup: source.meetup?.dayId === day.id ? source.meetup : null
    };
  });
  const eventIndex = new Map(events.map((event, index) => [event.id, index]));

  // Itinerary order for whole-trip traces: events in order, then any legs no event owns.
  const ordered = [...new Set([...events.flatMap(event => event.legs), ...legs])];
  const allCoords = legs.flatMap(leg => leg.coarse.coords).concat([...places.values()].map(p => [p.lng, p.lat]));
  const routeBounds = bboxOf(allCoords) || [[5, 44], [15, 50]];

  // Planning state relative to today, with the viewer's own rules (past /
  // future locked in / future TBD). `?today=YYYY-MM-DD` previews another day.
  const requested = new URLSearchParams(location.search).get('today');
  const today = /^\d{4}-\d{2}-\d{2}$/.test(requested || '') ? requested : U.journeyToday(source);
  for (const event of events) event.category = U.planningCategory({ calendarDate: event.calendarDate, planningStatus: event.tbd ? 'tbd' : '' }, source, today);
  const trip = {
    id: source.id, title: source.title || entry.label, kicker: source.kicker || '', city,
    status: source.status || '', timeZone: source.timeZone || 'UTC', today, startDate: source.startDate || null, endDate: source.endDate || null,
    eventWord: city ? 'Stop' : 'Day', eventsWord: city ? 'stops' : 'days', kind: source.kind,
    places, legs, legById, orderedLegs: ordered, events, eventIndex, photos,
    located: photos.filter(photo => photo.located), pois, locatedPois: pois.filter(point => point.located),
    routeGroups: source.routeGroups || [], meetup: source.meetup || null,
    bounds: source.overviewBounds || routeBounds, routeBounds,
    modes: MODE_ORDER.filter(mode => legs.some(leg => leg.mode === mode)),
    hasTbd: legs.some(leg => leg.tbd) || events.some(event => event.tbd),
    eventById: id => events[eventIndex.get(id)] || null,
    // Frame for landing in an event, following the viewer's cityCamera/dayCoordinates.
    eventFrame(event) {
      const place = event.place;
      let coords;
      if (city && place) {
        coords = U.cityFrameCoordinates({ center: [place.lng, place.lat], boundary: place.boundary, photos: photos.filter(p => p.located), places: pois, dayId: event.id });
      } else {
        coords = event.legs.flatMap(leg => leg.lite.coords).concat(event.located.map(p => [p.lng, p.lat]));
        if (!coords.length && place) coords = [[place.lng, place.lat]];
      }
      if (!coords.length) return null;
      if (coords.length === 1) return { center: coords[0], zoom: 12.5 };
      const bounds = bboxOf(coords);
      return { bounds, maxZoom: 12.5 };
    },
    routeFrame(legsToFrame) {
      const coords = legsToFrame.flatMap(leg => leg.lite.coords);
      return coords.length ? bboxOf(coords) : null;
    }
  };
  return trip;
}

// Small helper for options: a cancellable requestAnimationFrame clock.
export function clock(duration, onFrame, onDone, { perf } = {}) {
  let start = null, raf = 0, done = false;
  function tick(now) {
    if (done) return;
    if (start === null) start = now;
    const t = Math.min(1, duration ? (now - start) / duration : 1);
    const t0 = performance.now();
    onFrame(t, now);
    perf?.(performance.now() - t0);
    if (t >= 1) { done = true; onDone?.(); return; }
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);
  return {
    cancel() { done = true; cancelAnimationFrame(raf); },
    finish() { if (done) return; done = true; cancelAnimationFrame(raf); onFrame(1, performance.now()); onDone?.(); },
    get done() { return done; }
  };
}
export const ease = {
  inOut: t => t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2,
  out: t => 1 - (1 - t) ** 3,
  linear: t => t
};
// Whole-route plan: each leg's share of a trace, weighted by length.
export function tracePlan(legs, weight = leg => Math.max(leg.lengthKm, 1)) {
  const total = legs.reduce((sum, leg) => sum + weight(leg), 0) || 1;
  let at = 0;
  return legs.map(leg => { const start = at; at += weight(leg) / total; return { leg, start, end: at }; });
}
