import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { encodeRoute, encodeRoutes, simplifyRing, simplifyBoundary } from '../scripts/public-geometry.mjs';

const utils = globalThis.JOURNEY_ATLAS_UTILS;
const repo = path.resolve(import.meta.dirname, '..');
const run = file => { const context = { window: {} }; vm.runInNewContext(fs.readFileSync(path.join(repo, file), 'utf8'), context); return JSON.parse(JSON.stringify(context.window)); };

test('routes round-trip exactly at five, six and seven decimals, across signs and long jumps', () => {
  const cases = [
    [[7.58946, 47.54726], [7.59552, 47.54522], [7.6, 47.5], [-0.00001, -0.00001], [179.99999, -89.99999], [-179.99999, 89.99999]],
    [[8.309301, 47.050168], [8.309302, 47.050167], [-122.419416, 37.774929]],
    [[13.4049541, 52.5200066], [13.4049542, 52.5200065], [-73.9856644, 40.7484405]],
    [[0, 0], [0, 0], [1, 1]]
  ];
  for (const [index, route] of cases.entries()) {
    const encoded = encodeRoute(route);
    assert.equal(typeof encoded === 'string', index === 0 || index === 3, 'five-decimal routes are plain strings');
    if (index === 1) assert.equal(encoded[0], 6);
    if (index === 2) assert.equal(encoded[0], 7);
    assert.deepEqual(utils.decodeRoute(encoded), route);
    assert.equal(JSON.stringify(utils.decodeRoute(JSON.parse(JSON.stringify(encoded)))), JSON.stringify(route), 'JSON transport preserves every digit');
  }
});

test('anything that cannot be reproduced exactly stays as its original array', () => {
  const precise = [[7.123456789, 47.1], [7.2, 47.2]];
  assert.equal(encodeRoute(precise), precise);
  for (const value of [[], [[1, 2]], [[1, 2], [3]], [[1, 2], ['3', 4]], null, 'text', { type: 'LineString' }]) assert.equal(encodeRoute(value), value);
  for (const value of [[], [[1, 2], [3, 4]], [5, [1, 2]], null, undefined, { a: 1 }]) assert.equal(utils.decodeRoute(value), value, 'plain geometry passes through the decoder untouched');
  const routes = { a: [[1.5, 2.5], [1.50001, 2.50001]], b: precise };
  assert.deepEqual(utils.decodeRoutes(encodeRoutes(routes)), routes);
});

test('every published page route decodes to the legacy verification bundle', () => {
  const all = run('dist/assets/route-geometry.js').JOURNEY_ATLAS_ROUTE_GEOMETRY;
  let routes = 0, encoded = 0;
  for (const file of JSON.parse(fs.readFileSync(path.join(repo, 'dist/generated-data.json'), 'utf8'))) {
    const scoped = run(`dist/${file}`).JOURNEY_ATLAS_ROUTE_GEOMETRY;
    for (const [id, value] of Object.entries(scoped)) {
      routes++; if (typeof value === 'string' || typeof value?.[1] === 'string') encoded++;
      if (all[id]) assert.deepEqual(utils.decodeRoute(value), all[id], id);
    }
  }
  assert.ok(routes > 0 && encoded > 0, 'published pages ship encoded routes');
  // The update-snapshot reader accepts only pure JSON assignments.
  const source = fs.readFileSync(path.join(repo, 'dist/assets/journey-data/trip-switzerland-italy-family-2026.js'), 'utf8');
  assert.doesNotMatch(source, /function|=>/);
});

test('simplified boundaries keep only original vertices, stay closed and within tolerance', () => {
  const ring = Array.from({ length: 361 }, (_, i) => [13.4 + 0.2 * Math.cos(i * Math.PI / 180) + (i % 2 ? 0.00002 : 0), 52.5 + 0.1 * Math.sin(i * Math.PI / 180)]);
  ring[360] = [...ring[0]];
  const simplified = simplifyRing(ring, 100);
  assert.ok(simplified.length < ring.length / 3 && simplified.length >= 4);
  assert.deepEqual(simplified[0], simplified.at(-1));
  assert.ok(simplified.every(point => ring.includes(point)), 'no invented coordinates');
  const scale = Math.cos(52.5 * Math.PI / 180), meters = (a, b) => Math.hypot((a[0] - b[0]) * scale, a[1] - b[1]) * 111320;
  for (const point of ring) assert.ok(Math.min(...simplified.map(kept => meters(kept, point))) < 2500);
  const square = [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]];
  assert.equal(simplifyRing(square), square, 'small rings are returned untouched');
  const boundary = { type: 'MultiPolygon', coordinates: [[ring, square.map(([x, y]) => [13.4 + x / 100, 52.5 + y / 100])], [square]], sourceUrl: 'https://example.test', retrievedAt: '2026-01-01' };
  const result = simplifyBoundary(boundary, 100);
  assert.ok(utils.validCityBoundary(result));
  assert.equal(result.sourceUrl, boundary.sourceUrl);
  assert.equal(result.coordinates[1][0], square);
  assert.ok(result.coordinates[0][0].length < ring.length);
  assert.equal(boundary.coordinates[0][0].length, 361, 'the source boundary is not modified');
  const invalid = { type: 'Point' };
  assert.equal(simplifyBoundary(invalid), invalid, 'an invalid boundary is left for validation to report');
});

test('the five-mile bounding-box shortcut never drops a point the boundary test would keep', () => {
  const offset = ([lng, lat], km, bearing) => {
    const d = km / 6371, b = bearing * Math.PI / 180, p = lat * Math.PI / 180, l = lng * Math.PI / 180;
    const lat2 = Math.asin(Math.sin(p) * Math.cos(d) + Math.cos(p) * Math.sin(d) * Math.cos(b));
    const lng2 = l + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(p), Math.cos(d) - Math.sin(p) * Math.sin(lat2));
    return [((lng2 * 180 / Math.PI + 540) % 360) - 180, lat2 * 180 / Math.PI];
  };
  for (const [lng, lat] of [[13.4, 52.5], [8.3, 0], [-70.6, -33.4], [18.9, 69.6], [179.95, -16.8], [-179.9, 65.5]]) {
    const corners = [[-0.1, -0.05], [0.1, -0.05], [0.1, 0.05], [-0.1, 0.05]].map(([dx, dy]) => [((lng + dx + 540) % 360) - 180, lat + dy]);
    const boundary = { type: 'Polygon', coordinates: [[...corners, corners[0]]] };
    assert.ok(utils.validCityBoundary(boundary));
    // The city centre is deliberately far away so only the boundary can include a photo.
    const frame = photos => utils.cityFrameCoordinates({ center: null, boundary, photos: photos.map(([x, y]) => ({ lng: x, lat: y })), places: [], dayId: 'd' }).map(String);
    const inside = [((lng + 540) % 360) - 180, lat];
    assert.deepEqual(frame([inside]), [String(inside)]);
    for (let bearing = 0; bearing < 360; bearing += 15) for (const corner of corners) {
      const near = offset(corner, 7.9, bearing), far = offset(corner, 60, bearing);
      const outsideNear = !(Math.abs((((near[0] - lng + 540) % 360) - 180)) <= 0.1 && Math.abs(near[1] - lat) <= 0.05);
      if (outsideNear) assert.deepEqual(frame([near]), [String(near)], `${lat}: 7.9 km at ${bearing}° stays in the city view`);
      const insideFar = Math.abs((((far[0] - lng + 540) % 360) - 180)) <= 0.1 && Math.abs(far[1] - lat) <= 0.05;
      if (!insideFar && bearing % 90 === 45) assert.deepEqual(frame([far]), [], `${lat}: 60 km at ${bearing}° is outside`);
    }
  }
});
