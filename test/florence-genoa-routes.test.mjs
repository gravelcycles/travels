import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { haversine } from '../scripts/route-geometry-lib.mjs';

const read = name => JSON.parse(fs.readFileSync(new URL(`../content/${name}`, import.meta.url), 'utf8'));
const journey = read('journeys/florence-genoa.json');
const geometry = read('route-geometry/florence-genoa.json');
const manifest = read('route-sources/florence-genoa.json');
const overrides = read('route-overrides.json');
function distanceToEdge(point, a, b) {
  const scale = Math.cos(point[1] * Math.PI / 180);
  const dx = (b[0] - a[0]) * scale, dy = b[1] - a[1];
  const length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((point[0] - a[0]) * scale * dx + (point[1] - a[1]) * dy) / length)) : 0;
  return haversine(point, [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
}

test('Florence–Genoa keeps detailed geometry for every arrival and cycling leg', () => {
  assert.equal(journey.segments.length, 11);
  assert.deepEqual(Object.keys(geometry).sort(), journey.segments.map(s => s.id).sort());
  for (const segment of journey.segments) {
    const line = geometry[segment.id];
    assert.ok(line.length > 100, `${segment.id}: cannot regress to an endpoint guide`);
    assert.notEqual(segment.geometryStatus, 'provisional');
    assert.equal(segment.geometry, undefined, 'inline geometry must not mask the reviewed file');
    assert.equal(overrides[segment.id]?.geometry, undefined, 'review a new override before replacing this baseline');
    for (const point of line) {
      assert.equal(point.length, 2);
      assert.ok(point.every(Number.isFinite));
      assert.ok(Math.abs(point[0]) <= 180 && Math.abs(point[1]) <= 90);
    }
    for (const [placeId, point] of [[segment.from, line[0]], [segment.to, line.at(-1)]]) {
      const place = journey.places.find(p => p.id === placeId);
      assert.ok(haversine([place.lng, place.lat], point) < 0.25, `${segment.id}: endpoint must stay near its place`);
    }
    const measured = line.slice(1).reduce((km, p, i) => km + haversine(line[i], p), 0);
    assert.ok(Math.abs(segment.distanceKm - measured) < 0.051, `${segment.id}: display mapped distance, not the old estimate`);
    const source = manifest.segments[segment.id];
    assert.equal(source.strategy, 'preserve');
    assert.equal(new URL(source.provenance.requestUrl).protocol, 'https:');
    assert.ok(source.provenance.provider && source.provenance.retrievedAt);
    assert.equal(source.provenance.outputPointCount, line.length);
  }
});

test('rail reconstructions retain the reviewed corridors in geographical order', () => {
  const anchors = {
    'hamburg-freiburg': [[9.7429, 52.3779], [9.4471, 51.3129], [8.6638, 50.1076], [8.4687, 49.4795], [8.4013, 48.9936]],
    'lucerne-milan': [[8.5491, 47.0489], [9.0290, 46.1952], [8.9465, 46.0052], [9.0318, 45.8329]],
    'milan-florence': [[9.7065, 45.05186], [10.3283, 44.8111], [11.3414, 44.5051], [11.1108, 43.8790]],
  };
  for (const [suffix, points] of Object.entries(anchors)) {
    const line = geometry[`florence-genoa-${suffix}`];
    let previous = -1;
    for (const point of points) {
      // Simplification may remove a vertex on a straight station platform.
      const distances = line.slice(1).map((p, i) => distanceToEdge(point, line[i], p));
      const distance = Math.min(...distances), index = distances.indexOf(distance);
      assert.ok(distance < 0.3, `${suffix}: missing corridor anchor`);
      assert.ok(index > previous, `${suffix}: reversed anchor order`);
      previous = index;
    }
  }
});

test('all arrival parties still join six shared cycling stages without invented origins', () => {
  const bikes = journey.segments.filter(s => s.mode === 'bike');
  assert.equal(bikes.length, 6);
  assert.ok(bikes.every(s => !s.groupIds?.length));
  for (const group of journey.routeGroups) {
    const arrivals = journey.segments.filter(s => s.groupIds?.includes(group.id));
    assert.equal(arrivals.at(-1).to, 'fg-florence');
    if (['lucerne', 'kawan'].includes(group.id)) assert.ok(arrivals.every(s => s.mode === 'train'));
  }
  assert.match(journey.days[0].text, /Kawan’s starting point still needs adding/);
  assert.match(journey.days[5].text, /62 km/);
  assert.match(journey.days[5].text, /25\.8 km/);
});
