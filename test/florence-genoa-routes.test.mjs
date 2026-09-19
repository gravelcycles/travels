import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { haversine } from '../scripts/route-geometry-lib.mjs';

const read = name => JSON.parse(fs.readFileSync(new URL(`../content/${name}`, import.meta.url), 'utf8'));
const journey = read('journeys/florence-genoa.json');
const geometry = read('route-geometry/florence-genoa.json');
const manifest = read('route-sources/florence-genoa.json');
const overrides = read('route-overrides.json');
test('Florence–Genoa keeps detailed geometry for all six cycling legs', () => {
  assert.equal(journey.segments.length, 6);
  assert.ok(journey.segments.every(s => s.mode === 'bike'));
  assert.deepEqual(Object.keys(manifest.segments).sort(), Object.keys(geometry).sort());
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

test('the cycling-only itinerary keeps riding dates and stable IDs after removing arrivals', () => {
  assert.equal(journey.days.length, 6);
  assert.equal(journey.startDate, '2026-05-10');
  assert.equal(journey.endDate, '2026-05-15');
  assert.deepEqual(journey.days.map(d => d.number), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(journey.days.map(d => d.id), [2, 3, 4, 5, 6, 7].map(n => `florence-genoa-d${n}`));
  assert.deepEqual(journey.days.map(d => d.calendarDate), [10, 11, 12, 13, 14, 15].map(n => `2026-05-${n}`));
  assert.deepEqual(journey.days.flatMap(d => d.segmentIds), journey.segments.map(s => s.id));
  assert.equal(journey.routeGroups, undefined);
  assert.equal(journey.meetup, undefined);
  assert.equal(journey.travelers.length, 9);
  assert.ok(journey.places.every(p => p.country === 'Italy' && p.id !== 'fg-milan'));
  const thursday = journey.days.find(d => d.calendarDate === '2026-05-14');
  assert.match(thursday.text, /62 km/);
  assert.match(thursday.text, /25\.8 km/);
});
