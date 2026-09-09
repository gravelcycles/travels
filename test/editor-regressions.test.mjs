import test from 'node:test';
import assert from 'node:assert/strict';
import '../dist/assets/atlas-utils.js';
import { captureDateParts } from '../scripts/photo-import-config.mjs';
const { resolvePhoto, proposalGate } = globalThis.JOURNEY_ATLAS_UTILS;
test('cleared inherited GPS survives serialization; explicit pin restores it', () => {
  const photo = { id: 'gps', lat: 46, lng: 8, zoom: 17, locationLabel: 'Old pin' };
  const cleared = resolvePhoto(photo, JSON.parse(JSON.stringify({ location: null })));
  assert.equal(cleared.lat, undefined); assert.equal(cleared.lng, undefined); assert.equal(cleared.zoom, undefined); assert.equal(cleared.locationLabel, '');
  assert.equal(resolvePhoto(photo, { location: { lat: 47, lng: 9 }, zoom: 12 }).lat, 47);
  assert.equal(resolvePhoto(photo, {}).lat, 46);
});
test('proposal gate rejects same-segment anchor edits, edit/undo and late requests', async () => {
  const gate = proposalGate(), initial = ['trip', 'leg', [[8,46],[9,47]]];
  const request = gate.capture(initial);
  assert.ok(gate.current(request, initial));
  assert.ok(!gate.current(request, ['trip','leg',[[8,46],[10,48]]]));
  gate.invalidate(); assert.ok(!gate.current(request, initial));
  const next = gate.capture(initial), latest = gate.capture(initial);
  assert.ok(!gate.current(next, initial)); assert.ok(gate.current(latest, initial));
});
test('naive EXIF is camera-local even at DST boundaries and across host zones', () => {
  for (const host of ['UTC','America/Los_Angeles','Asia/Tokyo']) {
    const previous = process.env.TZ; process.env.TZ = host;
    try {
      assert.deepEqual(captureDateParts({ DateTimeOriginal: '2026:09:01 00:15:00' }, 'Europe/Zurich'), { date:'2026-09-01', time:'00:15', rule:'camera-local' });
      assert.equal(captureDateParts({ DateTimeOriginal: '2026:10:25 02:30:00' }, 'Europe/Berlin').time, '02:30');
    } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
  }
});
test('explicit EXIF offsets convert the instant into the journey calendar', () => {
  assert.deepEqual(captureDateParts({ DateTimeOriginal:'2026:09:01 00:15:00', OffsetTimeOriginal:'+09:00' }, 'Europe/Zurich'), { date:'2026-08-31', time:'17:15', rule:'explicit-offset' });
  assert.equal(captureDateParts({ CreateDate:'2026-09-01T00:15:00Z' }, 'America/Los_Angeles').date, '2026-08-31');
  assert.equal(captureDateParts({ CreateDate:'2026:09:01 00:15:00', OffsetTimeDigitized:'-0700' }, 'Asia/Tokyo').time, '16:15');
  assert.throws(() => captureDateParts({ DateTimeOriginal:'2026:02:30 01:00:00' }, 'UTC'));
  assert.throws(() => captureDateParts({ DateTimeOriginal:new Date() }, 'UTC'));
  assert.throws(() => captureDateParts({ DateTimeOriginal:'2026:09:01 25:00:00' }, 'UTC'));
});
test('hidden or missing covers fall back to a visible photo and then text',()=>{
  const {resolveCover,visiblePhotos,photoCaption,travelDuration}=globalThis.JOURNEY_ATLAS_UTILS;
  const j={id:'trip',coverPhoto:{photoId:'hidden',focal:[30,70]}};
  const photos=visiblePhotos(j,{trip:[{id:'hidden'},{id:'visible'}]},{photos:{hidden:{hidden:true}}});
  assert.equal(resolveCover(j,photos).photo.id,'visible');assert.equal(resolveCover(j,[]).photo,undefined);
  assert.equal(photoCaption({caption:'Day · 12:30',takenAt:'18 Aug · 12:30'},{title:'Day'}),'Day');
  assert.equal(photoCaption({caption:'Lunch · 12:30',takenAt:'18 Aug · 12:30'},{title:'Day'}),'Lunch · 12:30');
  assert.equal(travelDuration([{durationMinutes:120,durationMaxMinutes:180,durationQualifier:'with stops'},{durationMinutes:55}]),'2 h 55 min–3 h 55 min travel · with stops');
  assert.equal(travelDuration([{duration:'1 hr'},{duration:'All afternoon'}]),'');
  assert.match(travelDuration([{durationMinutes:30},{}]),/1 of 2 legs timed/);
});
