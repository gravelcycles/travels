import test from 'node:test';
import assert from 'node:assert/strict';
import '../dist/assets/media-utils.js';
import fs from 'node:fs';
import vm from 'node:vm';
const {index}=globalThis.JOURNEY_ATLAS_MEDIA;

test('timestamped clips join the chronological anchors without sorting or moving stills',()=>{
  const day={id:'stay',calendarDate:'2026-10-23',calendarEndDate:'2026-10-29',photoOrder:['pinned','early','late','misplaced','last','undated']};
  const photo=(id,takenAt)=>({id,dayId:'stay',takenAt});
  const journey={days:[day],photos:[photo('pinned','2026-11-01 · 12:00'),photo('early','2026-10-26 · 14:43'),photo('late','2026-10-26 · 14:48'),photo('misplaced','2026-10-24 · 09:00'),photo('last','2026-10-26 · 14:52'),photo('undated')],videos:[
    {...photo('second-clip','2026-10-26 · 14:51:40'),src:'two.mp4'},
    {...photo('first-clip','2026-10-26 · 14:47:49'),src:'one.mp4'},
    {...photo('same-minute','2026-10-26 · 14:48:56'),src:'three.mp4'},
    {...photo('legacy'),title:'2026-10-26 · 14:40',src:'legacy.mp4'}]};
  const before=structuredClone(journey),ordered=index(journey).ordered;
  assert.deepEqual(ordered.filter(item=>item.mediaType!=='video').map(item=>item.id),day.photoOrder);
  assert.deepEqual(ordered.map(item=>item.id),['pinned','early','first-clip','late','misplaced','same-minute','second-clip','last','undated','legacy']);
  assert.deepEqual(journey,before,'Ordering does not rewrite the traveler’s sources');
});

test('video-only days sort recorded capture times and retain undated legacy clips at the end',()=>{
  const journey={days:[{id:'day'}],videos:[{id:'late',dayId:'day',takenAt:'2026-10-26 · 14:50'},{id:'legacy',dayId:'day'},{id:'early',dayId:'day',takenAt:'2026-10-26 · 14:47'}]};
  assert.deepEqual(index(journey).ordered.map(item=>item.id),['early','late','legacy']);
  const {captureTime}=globalThis.JOURNEY_ATLAS_MEDIA;
  assert.equal(captureTime('2026-10-26 · 14:47:49'),Date.UTC(2026,9,26,14,47,49));
  for(const bad of ['26 Oct 2026 · 14:47','2026-02-30 · 12:00','2026-10-26 · 24:00','2026-10-26 · 14:47:99'])assert.equal(captureTime(bad),null,bad);
});

test('reader remains usable when cached HTML loads the older media helper during deployment',()=>{
  const source=fs.readFileSync(new URL('../dist/assets/app.js',import.meta.url),'utf8');
  const fn=name=>{const start=source.indexOf(`  function ${name}(`);return source.slice(start,source.indexOf('\n  function ',start+1));};
  const journey={days:[{id:'day',photoOrder:['two','one']}],photos:[{id:'one',dayId:'day'},{id:'two',dayId:'day'}]};
  const context=vm.createContext({journey,mediaUtils:{items:globalThis.JOURNEY_ATLAS_MEDIA.items},dayById:id=>journey.days.find(day=>day.id===id)});
  vm.runInContext(['photoById','photosForDay','orderedPhotos'].map(fn).join('\n'),context);
  assert.deepEqual(Array.from(context.orderedPhotos(),photo=>photo.id),['two','one']);
  assert.equal(context.photoById('one'),journey.photos[0]);
});

test('reader index preserves event and explicit photo order, visible video and unlisted media',()=>{
  const journey={days:[{id:'a',photoOrder:['clip','second']},{id:'empty'},{id:'b'}],
    photos:[{id:'last',dayId:'b'},{id:'first',dayId:'a'},{id:'second',dayId:'a'},{id:'orphan',dayId:'unknown'}],
    videos:[{id:'clip',dayId:'a',src:'video.mp4',poster:'poster.avif'},{id:'hidden',dayId:'a',hidden:true}]};
  const result=index(journey);
  assert.deepEqual(result.ordered.map(p=>p.id),['clip','second','first','last']);
  assert.deepEqual(result.byDay.get('empty'),[]);
  assert.equal(result.byId.get('orphan'),journey.photos[3]);
  assert.equal(result.byId.has('hidden'),false);
  assert.equal(result.ordered[0].videoSrc,'video.mp4');
  assert.equal(result.ordered[0].src,'poster.avif');
  assert.equal(index(journey),result,'Warm access shares the same ordering and normalized videos');
});

test('reader index refreshes for new projections and replaced content arrays',()=>{
  const journey={days:[{id:'a'}],photos:[{id:'first',dayId:'a',src:'old.webp'}]};
  const old=index(journey);
  journey.photos=[{...journey.photos[0],src:'new.avif'}];
  assert.notEqual(index(journey),old);
  assert.equal(index(journey).byId.get('first').src,'new.avif');
  journey.days=[{id:'b'}];assert.deepEqual(index(journey).ordered,[]);
  journey.videos=[{id:'clip',dayId:'b',src:'clip.mp4'}];assert.equal(index(journey).ordered[0].id,'clip');
  const projection={...journey,days:[{id:'a'}]};
  assert.deepEqual(index(projection).ordered.map(p=>p.id),['first']);
  assert.deepEqual(index(journey).ordered.map(p=>p.id),['clip']);
});
