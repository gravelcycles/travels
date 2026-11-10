// Compact public encodings for geometry that visitors download with a trip.
// Sources, Studio previews and the legacy verification bundles keep their
// original coordinate arrays; only the per-page data and public boundaries
// pass through here.
import '../dist/assets/atlas-utils.js';

const { decodeRoute } = globalThis.JOURNEY_ATLAS_UTILS;
const isPair = point => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite);

function encodeNumber(value) {
  let rest = value < 0 ? -2 * value - 1 : 2 * value, text = '';
  while (rest >= 32) { text += String.fromCharCode((32 + (rest % 32)) + 63); rest = Math.floor(rest / 32); }
  return text + String.fromCharCode(rest + 63);
}

// A route becomes a delta-encoded string at the smallest decimal precision
// that reproduces every source coordinate exactly: a plain string for five
// decimals, [decimals, string] otherwise. Anything that cannot round-trip
// exactly stays as its original array, so encoding never moves a reviewed line.
export function encodeRoute(coordinates) {
  if (!Array.isArray(coordinates) || coordinates.length < 2 || !coordinates.every(isPair)) return coordinates;
  const expected = JSON.stringify(coordinates);
  for (const decimals of [5, 6, 7]) {
    const factor = 10 ** decimals;
    let text = '', previousX = 0, previousY = 0, exact = true;
    for (const [lng, lat] of coordinates) {
      const x = Math.round(lng * factor), y = Math.round(lat * factor);
      if (x / factor !== lng || y / factor !== lat) { exact = false; break; }
      text += encodeNumber(x - previousX) + encodeNumber(y - previousY);
      previousX = x; previousY = y;
    }
    if (!exact) continue;
    const encoded = decimals === 5 ? text : [decimals, text];
    if (JSON.stringify(decodeRoute(encoded)) === expected) return encoded;
  }
  return coordinates;
}

export const encodeRoutes = routes => Object.fromEntries(Object.entries(routes).map(([id, coordinates]) => [id, encodeRoute(coordinates)]));

// City boundaries only decide which photos and places belong in a city view:
// inside the boundary or within five miles of it. Dropping vertices that sit
// within `toleranceMeters` of the simplified outline moves that five-mile
// edge by at most the same distance. Kept vertices are original source points.
export function simplifyRing(ring, toleranceMeters = 100) {
  if (!Array.isArray(ring) || ring.length <= 5 || !ring.every(isPair)) return ring;
  const tolerance = toleranceMeters / 111320, keep = new Uint8Array(ring.length);
  const scale = Math.cos(ring[0][1] * Math.PI / 180);
  const offset = (point, a, b) => {
    const dx = (b[0] - a[0]) * scale, dy = b[1] - a[1], px = (point[0] - a[0]) * scale, py = point[1] - a[1];
    const length = dx * dx + dy * dy, t = length ? Math.max(0, Math.min(1, (px * dx + py * dy) / length)) : 0;
    return Math.hypot(px - t * dx, py - t * dy);
  };
  // Split the closed ring at the vertex farthest from its start so both halves
  // have distinct endpoints.
  let far = 0, farDistance = -1;
  for (let i = 1; i < ring.length - 1; i++) { const d = offset(ring[i], ring[0], ring[0]); if (d > farDistance) { farDistance = d; far = i; } }
  keep[0] = keep[far] = keep[ring.length - 1] = 1;
  const stack = [[0, far], [far, ring.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop();
    let index = -1, distance = tolerance;
    for (let i = start + 1; i < end; i++) { const d = offset(ring[i], ring[start], ring[end]); if (d > distance) { distance = d; index = i; } }
    if (index > 0) { keep[index] = 1; stack.push([start, index], [index, end]); }
  }
  const simplified = ring.filter((_, i) => keep[i]);
  return simplified.length >= 4 ? simplified : ring;
}

export function simplifyBoundary(boundary, toleranceMeters = 100) {
  if (!globalThis.JOURNEY_ATLAS_UTILS.validCityBoundary(boundary)) return boundary;
  const polygon = rings => rings.map(ring => simplifyRing(ring, toleranceMeters));
  const coordinates = boundary.type === 'Polygon' ? polygon(boundary.coordinates) : boundary.coordinates.map(polygon);
  const simplified = { ...boundary, coordinates };
  return globalThis.JOURNEY_ATLAS_UTILS.validCityBoundary(simplified) ? simplified : boundary;
}
