import test from 'node:test';
import assert from 'node:assert/strict';
import '../dist/assets/photo-comments.js';

const { displayName, initials, commentState, photoNavigation, createIdentityStore } = globalThis.JOURNEY_ATLAS_PHOTO_COMMENTS;
const memory = () => { const values = new Map(); return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }; };

test('visitor name changes retain ownership while session access is independent of durable identity', () => {
  const disk = memory(), session = memory();
  const first = createIdentityStore(disk, session, () => 'visitor-1');
  assert.equal(first.get(), null);
  assert.equal(first.allowed(), false);
  assert.deepEqual(first.save('  Alex  ', true), { visitor: { id: 'visitor-1', name: 'Alex' }, persistent: true });
  assert.equal(first.allowed(), true);
  first.save('Sasha');
  assert.deepEqual(first.get(), { id: 'visitor-1', name: 'Sasha' });
  assert.equal(first.allowed(), true, 'Rename does not require or revoke access');
  const reloaded = createIdentityStore(disk, session);
  assert.equal(reloaded.allowed(), true);
  assert.equal(reloaded.get().id, 'visitor-1');
  const nextSession = createIdentityStore(disk, memory());
  assert.equal(nextSession.get().id, 'visitor-1', 'Local comments remain owned after a new browser session');
  assert.equal(nextSession.allowed(), false, 'A persisted display name is not access');
  reloaded.lock();
  assert.equal(createIdentityStore(disk, session).allowed(), false);
  assert.equal(reloaded.get().id, 'visitor-1', 'Locking must not discard comment ownership');
});

test('unavailable or corrupted identity storage has an honest, stable current-page fallback', () => {
  const unavailable = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
  const identity = createIdentityStore(unavailable, unavailable, () => 'ephemeral');
  assert.deepEqual(identity.save('Me', true), { visitor: { id: 'ephemeral', name: 'Me' }, persistent: false });
  identity.save('Still me');
  assert.equal(identity.get().id, 'ephemeral');
  assert.equal(identity.allowed(), true);
  identity.lock(); assert.equal(identity.allowed(), false);
  const malformed = memory(); malformed.setItem('atlas-experience-visitor-v2', '{');
  assert.equal(createIdentityStore(malformed, memory()).get(), null);
  malformed.setItem('atlas-experience-visitor-v2', JSON.stringify({ id: 'same', name: ' '.repeat(10) }));
  assert.equal(createIdentityStore(malformed, memory()).get(), null);
});

test('comment composer accepts meaningful multiline text, rejects empty/oversize and prevents double posting', () => {
  assert.deepEqual(commentState(' \n '), { count: 3, remaining: 997, valid: false });
  assert.equal(commentState('First line\nSecond line').valid, true);
  assert.equal(commentState('x'.repeat(1000)).valid, true);
  assert.equal(commentState('x'.repeat(1001)).valid, false);
  assert.equal(commentState('A memory', true).valid, false);
  assert.equal(commentState('   A memory   ').valid, true);
});

test('names are human chosen and initials preserve Unicode characters', () => {
  assert.equal(displayName('  Zoë  '), 'Zoë');
  for (const name of ['', '   ', 'x'.repeat(41)]) assert.throws(() => displayName(name));
  assert.equal(initials('Zoë'), 'Z');
  assert.equal(initials('  🥐 breakfast  '), '🥐');
  assert.equal(initials(''), '·');
});

test('photo navigation is bounded, handles empty journeys and derives the actual selected photo', () => {
  const photos = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.deepEqual(photoNavigation(photos, 'a'), { index: 0, count: 3, previous: null, next: photos[1] });
  assert.deepEqual(photoNavigation(photos, 'b'), { index: 1, count: 3, previous: photos[0], next: photos[2] });
  assert.equal(photoNavigation(photos, 'c').next, null);
  assert.deepEqual(photoNavigation([], 'a'), { index: -1, count: 0, previous: null, next: null });
  assert.deepEqual(photoNavigation(photos, 'missing'), { index: -1, count: 3, previous: null, next: null });
  assert.deepEqual(photos, [{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
});

test('an existing preview visitor migrates without losing ownership of earlier local comments', () => {
  const storage = memory(), session = memory();
  session.setItem('atlas-experience-visitor-v1', JSON.stringify({ id: 'original-visitor', name: 'Alex' }));
  const visitor = createIdentityStore(storage, session, () => 'unexpected-new-id');
  assert.equal(visitor.get().id, 'original-visitor');
  assert.equal(visitor.allowed(), true);
  assert.equal(createIdentityStore(storage, memory()).get().id, 'original-visitor');
});
