import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePointsOfInterest } from '../scripts/places-content.mjs';
import { loadContent } from '../scripts/journey-content.mjs';
import '../dist/assets/places-comments.js';

const { average, filterPlaces, validateComment, createDemoStore } = globalThis.JOURNEY_ATLAS_PLACES;
const memory = () => { const values = new Map(); return { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) }; };
const example = () => structuredClone(loadContent(new URL('..', import.meta.url).pathname).data.journeys.find(journey => journey.pointsOfInterest?.length));

test('places filter by category/day without changing itinerary or assigning a rating to saved places', () => {
  const journey = example(), original = structuredClone(journey);
  assert.equal(filterPlaces(journey).length, 3);
  assert.equal(filterPlaces(journey, 'food').length, 1);
  assert.equal(filterPlaces(journey, 'sight', journey.days[1].id).length, 2);
  assert.equal(filterPlaces(journey, 'food', journey.days[1].id).length, 0);
  assert.deepEqual(filterPlaces({}), []);
  assert.equal(average(journey.pointsOfInterest[0].reviews), '4.7');
  assert.equal(average([]), null);
  assert.deepEqual(journey, original);
});

test('place sources reject unsafe assets, bad references, missing attribution and malformed ratings', () => {
  assert.doesNotThrow(() => validatePointsOfInterest({ id: 'empty' }));
  const edits = [
    point => { point.coordinates = [181, 20]; },
    point => { point.coordinates = [8, '47']; },
    point => { point.dayIds = ['unknown-day']; },
    point => { point.dayIds = [point.dayIds[0], point.dayIds[0]]; },
    point => { point.category = 'arbitrary'; },
    point => { point.status = 'saved'; },
    point => { point.locationAccuracy = undefined; },
    point => { point.sources = [{ label: 'Source', url: 'javascript:alert(1)' }]; },
    point => { point.images[0].src = 'data:image/svg+xml,<svg onload="alert(1)"/>'; },
    point => { point.images[0].src = './assets/places/../../secret.jpg'; },
    point => { point.images[0].credit = ''; },
    point => { point.images[0].permission = 'found-online'; },
    point => { point.mapsUrl = 'https://user:password@example.com'; },
    point => { point.reviews[0].rating = 6; },
    point => { point.reviews[0].rating = 3.5; },
    point => { point.reviews.push(point.reviews[0]); }
  ];
  for (const edit of edits) { const journey = example(); edit(journey.pointsOfInterest[0]); assert.throws(() => validatePointsOfInterest(journey), /pointsOfInterest/); }
  const duplicate = example(); duplicate.pointsOfInterest.push(duplicate.pointsOfInterest[0]);
  assert.throws(() => validatePointsOfInterest(duplicate), /unique stable IDs/);
});

test('local comment simulation scopes journeys/photos and author deletion, retaining literal text', () => {
  const storage = memory(), trip = createDemoStore(storage, 'trip-a'), other = createDemoStore(storage, 'trip-b');
  const visitor = { id: 'visitor-one', name: ' Alex ' };
  assert.throws(() => trip.addComment('photo-a', null, 'Hello', 'one'), /Unlock/);
  trip.addComment('photo-a', visitor, ' <script>Hello</script> ', 'one', 100);
  trip.addComment('photo-b', visitor, 'Another photo', 'two', 101);
  assert.equal(trip.comments('photo-a').length, 1);
  assert.equal(trip.comments('photo-a')[0].displayName, 'Alex');
  assert.equal(trip.comments('photo-a')[0].body, '<script>Hello</script>');
  assert.equal(other.comments('photo-a').length, 0);
  assert.equal(createDemoStore(storage, 'trip-a').comments('photo-a').length, 1, 'Reload retains the demo comments');
  assert.throws(() => trip.removeComment('one', 'another-visitor'), /own comments/);
  trip.removeComment('one', visitor.id);
  assert.equal(trip.comments('photo-a').length, 0);
  assert.equal(trip.comments('photo-b').length, 1);
});

test('demo validation, storage failure and review updates preserve truthful state', () => {
  for (const args of [['', 'text'], ['   ', 'text'], ['x'.repeat(41), 'text'], ['Alex', '  '], ['Alex', 'x'.repeat(1001)]]) assert.throws(() => validateComment(...args));
  const storage = memory(), store = createDemoStore(storage, 'trip');
  store.saveReview('place', 'Alex', 4, 'Good');
  store.saveReview('place', 'Alex', 5, 'Great');
  assert.equal(store.reviews('place').length, 1);
  assert.equal(store.reviews('place')[0].rating, 5);
  assert.throws(() => store.saveReview('place', 'Alex', 0, 'Invalid'));
  assert.equal(store.reviews('place')[0].rating, 5);
  const unavailable = createDemoStore({ getItem() { throw new Error(); }, setItem() { throw new Error(); } }, 'trip');
  assert.deepEqual(unavailable.comments('photo'), []);
  assert.throws(() => unavailable.addComment('photo', { id: 'one', name: 'Alex' }, 'A memory', 'one'), /could not save/);
  assert.deepEqual(unavailable.comments('photo'), [], 'Failed writes must not appear as saved');
  storage.setItem('trip', '{broken'); assert.deepEqual(store.comments('photo'), []);
  store.reset(); assert.deepEqual(store.reviews('place'), []);
});
