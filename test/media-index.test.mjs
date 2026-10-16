import test from 'node:test';
import assert from 'node:assert/strict';
import '../dist/assets/media-utils.js';
import fs from 'node:fs';
import vm from 'node:vm';
const {index}=globalThis.JOURNEY_ATLAS_MEDIA;

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
