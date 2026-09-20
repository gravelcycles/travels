import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePointsOfInterest } from '../scripts/places-content.mjs';
import { loadContent } from '../scripts/journey-content.mjs';
import '../dist/assets/places-comments.js';

const { average, ratingSummary, filterPlaces, validateComment, createDemoStore } = globalThis.JOURNEY_ATLAS_PLACES;
const memory = () => { const values = new Map(); return { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) }; };
const example = () => structuredClone(loadContent(new URL('..', import.meta.url).pathname).data.journeys.find(journey => journey.pointsOfInterest?.length));

test('group rating summaries retain empty states and count every star level accurately', () => {
  const reviews = [{ rating: 5 }, { rating: 4 }, { rating: 5 }, { rating: 1 }];
  assert.deepEqual(ratingSummary(reviews), {
    average: '3.8', count: 4,
    distribution: [{ stars: 5, count: 2 }, { stars: 4, count: 1 }, { stars: 3, count: 0 }, { stars: 2, count: 0 }, { stars: 1, count: 1 }]
  });
  const empty = ratingSummary([]);
  assert.equal(empty.average, null);
  assert.equal(empty.count, 0);
  assert.ok(empty.distribution.every(row => row.count === 0));
});

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
    point => { point.images[0].licenseUrl = 'javascript:alert(1)'; },
    point => { point.mapsUrl = 'https://user:password@example.com'; },
    point => { point.reviews[0].rating = 6; },
    point => { point.reviews[0].rating = 3.5; },
    point => { point.reviews[0].text = null; },
    point => { point.reviews.push(point.reviews[0]); }
  ];
  for (const edit of edits) { const journey = example(); edit(journey.pointsOfInterest[0]); assert.throws(() => validatePointsOfInterest(journey), /pointsOfInterest/); }
  const ratingOnly = example(); ratingOnly.pointsOfInterest[0].reviews[0].text = '';
  assert.doesNotThrow(() => validatePointsOfInterest(ratingOnly));
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

test('editing and undo retain comment author attribution and reject other visitors', () => {
  const storage = memory(), store = createDemoStore(storage, 'trip');
  const visitor = { id: 'alex-device', name: 'Alex' };
  store.addComment('photo', visitor, 'Original', 'one', 100);
  visitor.name = 'New name';
  assert.throws(() => store.editComment('one', 'another-device', 'Changed'), /own comments/);
  store.editComment('one', visitor.id, ' Edited ');
  const edited = store.comments('photo')[0];
  assert.equal(edited.body, 'Edited'); assert.equal(edited.displayName, 'Alex');
  assert.equal(edited.createdAt, 100); assert.ok(Number.isFinite(edited.editedAt));
  assert.throws(() => store.editComment('one', visitor.id, ' '));
  assert.equal(store.comments('photo')[0].body, 'Edited');
  const removed = store.removeComment('one', visitor.id);
  assert.equal(store.comments('photo').length, 0);
  assert.throws(() => store.restoreComment(removed, 'another-device'), /own comments/);
  store.restoreComment(removed, visitor.id);
  assert.deepEqual(store.comments('photo')[0], edited);
  assert.throws(() => store.restoreComment(removed, visitor.id), /already/);
  store.addComment('photo', visitor, 'New comment', 'two', 101);
  assert.equal(store.comments('photo')[1].displayName, 'New name');
});

test('comment retries are idempotent while conflicting IDs cannot overwrite a memory', () => {
  const store = createDemoStore(memory(), 'trip'), visitor = { id:'visitor',name:'Alex' };
  const comment = store.addComment('photo',visitor,'Hello','id',10);
  assert.deepEqual(store.addComment('photo',visitor,'Hello','id',11),comment);
  assert.equal(store.comments('photo').length,1);
  assert.throws(()=>store.addComment('photo',visitor,'Other','id',12));
  assert.throws(()=>store.addComment('other-photo',visitor,'Hello','id',12));
});

test('rating-only reviews, removal and restore keep the group average accurate', () => {
  const store = createDemoStore(memory(), 'trip');
  store.saveReview('place',' Alex ',4,'');
  assert.equal(store.reviews('place')[0].text,'');
  const deleted = store.removeReview('place');
  assert.equal(average(store.reviews('place')),null);
  store.saveReview(deleted.pointId,deleted.authorName,deleted.rating,deleted.text);
  assert.equal(average(store.reviews('place')),'4.0');
  assert.throws(()=>store.saveReview('place',' ',4,''));
});

test('unfinished drafts survive reopening, stay scoped to their journey and reset explicitly', () => {
  const storage = memory(), store = createDemoStore(storage,'trip');
  store.draft('photo:a',{body:'Unsent memory'});
  store.draft('photo:b',{body:'A different photo',editingId:'existing'});
  store.draft('review:a',{name:'Alex',rating:0,body:'An unfinished review'});
  assert.deepEqual(createDemoStore(storage,'trip').draft('photo:a'),{body:'Unsent memory'});
  assert.equal(createDemoStore(storage,'other-trip').draft('photo:a'),null);
  const retrieved = store.draft('photo:a'); retrieved.body='Changed outside storage';
  assert.equal(store.draft('photo:a').body,'Unsent memory');
  store.draft('photo:a',null); assert.equal(store.draft('photo:a'),null);
  assert.equal(store.draft('photo:b').editingId,'existing');
  assert.throws(()=>store.draft('__proto__',{}));
  store.reset(); assert.equal(store.draft('photo:b'),null); assert.equal(store.draft('review:a'),null);
});

test('failed edits, deletes and draft writes leave persisted text intact', () => {
  const values = memory(); let fail = false;
  const store = createDemoStore({getItem:values.getItem,setItem(k,v){if(fail)throw Error('full');values.setItem(k,v);}},'trip');
  store.addComment('p',{id:'v',name:'Alex'},'Keep me','c',1);
  store.draft('photo:p',{body:'Keep draft'}); fail=true;
  assert.throws(()=>store.editComment('c','v','Lost edit'),/could not save/);
  assert.throws(()=>store.removeComment('c','v'),/could not save/);
  assert.throws(()=>store.draft('photo:p',null),/could not save/);
  assert.equal(store.comments('p')[0].body,'Keep me');
  assert.equal(store.draft('photo:p').body,'Keep draft');
});
