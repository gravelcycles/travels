import fs from "node:fs";
import path from "node:path";

export const readJson = (filename, fallback) => fs.existsSync(filename) ? JSON.parse(fs.readFileSync(filename, "utf8")) : fallback;
export const writeJson = (filename, value) => {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, `${JSON.stringify(value, null, 2)}\n`);
};
export const validId = (id) => typeof id === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id);
export const validCoordinate = (p) => Array.isArray(p) && p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90;
export function calendarDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Use dates in YYYY-MM-DD format");
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.valueOf()) || date.toISOString().slice(0, 10) !== value) throw new Error(`Invalid calendar date: ${value}`);
  return date;
}

export function loadJourneys(root, { includeDrafts = false } = {}) {
  const config = readJson(path.join(root, "content/atlas.json"));
  if (!config || config.schemaVersion !== 1) throw new Error("Missing or invalid content/atlas.json");
  const folders = ["journeys", ...(includeDrafts ? ["drafts"] : [])];
  const journeys = folders.flatMap((folder) => {
    const dir = path.join(root, "content", folder);
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter(f => f.endsWith(".json")).sort().map(f => {
      const journey = readJson(path.join(dir, f));
      if (f !== `${journey.id}.json`) throw new Error(`Journey filename must match its ID: ${f}`);
      if (folder === "drafts" && journey.published !== false) throw new Error(`Draft ${journey.id} must remain unpublished; move reviewed sources to content/journeys to publish`);
      return journey;
    });
  });
  const order = config.journeyOrder || [];
  journeys.sort((a, b) => {
    const ai = order.indexOf(a.id), bi = order.indexOf(b.id);
    return (ai < 0 ? Infinity : ai) - (bi < 0 ? Infinity : bi) || a.id.localeCompare(b.id);
  });
  return { defaultJourneyId: config.defaultJourneyId, journeys };
}

export function validateJourneys(data) {
  const ids = new Set(), slugs = new Set(), globalIds = { days: new Set(), segments: new Set(), photos: new Set() };
  const fail = message => { throw new Error(message); };
  for (const j of data.journeys) {
    if (!validId(j.id) || ids.has(j.id)) fail(`Invalid or duplicate journey ID: ${j.id}`);
    ids.add(j.id);
    if (!["real", "demo"].includes(j.kind)) fail(`${j.id}: kind must be real or demo`);
    if (typeof j.published !== "boolean") fail(`${j.id}: published must be explicit`);
    if (j.kind === "real") {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*\.html$/.test(j.slug) || ["index.html", "demo.html", "404.html"].includes(j.slug) || slugs.has(j.slug)) fail(`Invalid, reserved, or duplicate slug: ${j.slug}`);
      slugs.add(j.slug);
    }
    for (const field of ["title", "label", "dates"]) if (typeof j[field] !== "string" || !j[field].trim()) fail(`${j.id}: missing ${field}`);
    for (const collection of ["places", "days", "segments", "photos"]) {
      if (!Array.isArray(j[collection])) fail(`${j.id}: ${collection} must be an array`);
      const localIds = new Set();
      for (const item of j[collection]) {
        if (!validId(item.id) || localIds.has(item.id) || globalIds[collection]?.has(item.id)) fail(`Invalid or duplicate ${collection} ID: ${item.id}`);
        localIds.add(item.id); globalIds[collection]?.add(item.id);
      }
    }
    if (!j.days.length) fail(`${j.id}: at least one calendar day is required`);
    const places = new Set(j.places.map(p => p.id)), segments = new Set(j.segments.map(s => s.id)), days = new Set(j.days.map(d => d.id));
    for (const p of j.places) if (!p.name || !validCoordinate([p.lng, p.lat])) fail(`${p.id}: invalid place coordinates or name`);
    for (const s of j.segments) {
      if (!places.has(s.from) || !places.has(s.to)) fail(`${s.id}: unknown route endpoint`);
      if (!["train", "boat", "bus", "gondola", "walk", "car", "bike"].includes(s.mode)) fail(`${s.id}: unsupported mode`);
      if (s.distanceKm != null && (!Number.isFinite(s.distanceKm) || s.distanceKm < 0)) fail(`${s.id}: invalid distance`);
      if (s.geometry && (s.geometry.length < 2 || !s.geometry.every(validCoordinate))) fail(`${s.id}: invalid geometry`);
    }
    const assigned = new Set();
    j.days.forEach((d, i) => {
      if (d.number !== i + 1) fail(`${d.id}: day numbers must be consecutive`);
      if (typeof d.title !== "string" || !d.title.trim()) fail(`${d.id}: missing title`);
      for (const field of ["placeId", "destinationId"]) if (d[field] != null && !places.has(d[field])) fail(`${d.id}: unknown ${field}`);
      if (!Array.isArray(d.segmentIds)) fail(`${d.id}: missing ordered segmentIds`);
      for (const id of d.segmentIds) {
        if (!segments.has(id) || assigned.has(id)) fail(`${d.id}: unknown or multiply assigned segment ${id}`);
        assigned.add(id);
      }
      if (d.calendarDate) calendarDate(d.calendarDate);
    });
    if (assigned.size !== segments.size) fail(`${j.id}: every segment must belong to one day`);
    if (j.startDate || j.endDate) {
      const start = calendarDate(j.startDate), end = calendarDate(j.endDate);
      if ((end - start) / 86400000 + 1 !== j.days.length) fail(`${j.id}: date range must include every calendar day`);
      j.days.forEach((d,i) => { if (d.calendarDate !== new Date(+start + i * 86400000).toISOString().slice(0,10)) fail(`${d.id}: calendar date does not match trip range`); });
    }
    for (const p of j.photos) if (!days.has(p.dayId)) fail(`${p.id}: photo references an unknown day`);
  }
  if (!ids.has(data.defaultJourneyId)) fail("Default journey does not exist");
  return data;
}

export function journeyAssets(root, journey) {
  const routes = readJson(path.join(root, journey.published ? `content/route-geometry/${journey.id}.json` : `build/draft-assets/${journey.id}/routes.json`), {});
  const photos = readJson(path.join(root, journey.published ? `content/photo-manifests/${journey.id}.json` : `build/draft-assets/${journey.id}/photos.json`), journey.photos || []);
  const ids = new Set(journey.segments.map(s => s.id));
  for (const [id, geometry] of Object.entries(routes)) {
    if (!ids.has(id) || !Array.isArray(geometry) || geometry.length < 2 || !geometry.every(validCoordinate)) throw new Error(`Invalid generated route or reference: ${id}`);
  }
  return { routes, photos };
}

export function loadContent(root, options) {
  const data = loadJourneys(root, options);
  const routes = {};
  data.journeys = data.journeys.map(j => {
    const assets = journeyAssets(root, j);
    Object.assign(routes, assets.routes);
    return { ...j, photos: assets.photos };
  });
  validateJourneys(data);
  return { data, routes };
}

export function validateOverrides(state, data) {
  const owners = { days: new Map(), routes: new Map(), photos: new Map() };
  for (const j of data.journeys) {
    for (const d of j.days) owners.days.set(d.id, j);
    for (const s of j.segments) owners.routes.set(s.id, j);
    for (const p of j.photos) owners.photos.set(p.id, j);
  }
  for (const kind of Object.keys(owners)) {
    if (!state[kind] || Array.isArray(state[kind]) || typeof state[kind] !== "object") throw new Error(`Overrides require ${kind}`);
    for (const [id, value] of Object.entries(state[kind])) {
      const owner = owners[kind].get(id);
      if (!owner) throw new Error(`Unknown ${kind} override ID: ${id}`);
      if (!value || Array.isArray(value) || typeof value !== "object") throw new Error(`Invalid override: ${id}`);
      const allowed = kind === "days" ? ["date", "title", "text"] : kind === "routes" ? ["controlPoints", "geometry", "smoothed", "smoothing", "routing", "source", "updatedAt"] : ["caption", "description", "alt", "locationLabel", "dayId", "location", "zoom", "hidden"];
      for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new Error(`${id}: unsupported override field ${key}`);
      if (kind === "photos" && value.dayId && !owner.days.some(d => d.id === value.dayId)) throw new Error(`${id}: photo day belongs to another journey or does not exist`);
      if (kind === "routes") for (const key of ["geometry", "controlPoints"]) if (!Array.isArray(value[key]) || value[key].length < 2 || !value[key].every(validCoordinate)) throw new Error(`${id}: invalid ${key}`);
      for (const key of ["date", "title", "text", "caption", "description", "alt", "locationLabel", "dayId"]) if (value[key] != null && typeof value[key] !== "string") throw new Error(`${id}: invalid ${key}`);
      if (value.title != null && !value.title.trim()) throw new Error(`${id}: title cannot be empty`);
      if (value.location != null && !validCoordinate([value.location.lng, value.location.lat])) throw new Error(`${id}: invalid photo location`);
      if (value.zoom != null && (!Number.isFinite(value.zoom) || value.zoom < 2 || value.zoom > 20)) throw new Error(`${id}: invalid photo zoom`);
      if (value.hidden != null && typeof value.hidden !== "boolean") throw new Error(`${id}: invalid photo visibility`);
    }
  }
}
