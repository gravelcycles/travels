import test from 'node:test';
import assert from 'node:assert/strict';
import '../dist/assets/atlas-utils.js';
import '../studio/photo-batch.js';
import '../studio/photo-editing.js';
import {uiHarness} from './studio-photo-batch-harness.mjs';
import {loadContent} from '../scripts/journey-content.mjs';

const {status, arrowStep} = globalThis.JOURNEY_ATLAS_PHOTO_EDITING;
const empty = () => ({photos:{}, days:{}, routes:{}});
const photo = {id:'p', dayId:'d', caption:'', lat:47, lng:8};
test('per-photo status separates draft edits, acknowledged saves, failures and newer in-flight edits', () => {
  const saved=empty(), state=empty();
  assert.equal(status({photo,state,saved}).kind,'saved');
  state.photos.other={caption:'Unrelated edit'};
  assert.equal(status({photo,state,saved}).kind,'saved');
  state.photos.p={caption:'My words'};
  assert.equal(status({photo,state,saved}).kind,'dirty');
  const saving=structuredClone(state);
  assert.equal(status({photo,state,saved,saving}).kind,'saving');
  state.photos.p.caption='Newer words';
  assert.equal(status({photo,state,saved,saving}).kind,'dirty');
  assert.equal(status({photo,state,saved:saving}).kind,'dirty');
  assert.equal(status({photo,state,saved,failed:true}).kind,'error');
  assert.equal(status({photo,state,saved:structuredClone(state)}).kind,'saved');
  assert.equal(status({photo,state:saved,saved,pending:true}).kind,'dirty');
  assert.equal(status({photo,state:saved,saved,failed:true}).kind,'saved');
  assert.equal(status({photo:null,state,saved}).kind,'empty');
});
test('blank defaults, location, map frame, Trash and album changes have honest save status', () => {
  const saved=empty(),state=empty();
  state.photos.p={dayId:'d',caption:'',description:'',locationLabel:'',location:{lat:47,lng:8},zoom:16};
  assert.equal(status({photo,state,saved}).kind,'saved');
  for (const edit of [{description:'Notes'},{location:{lat:48,lng:9}},{mapFrame:{bounds:[[7,46],[9,48]]}},{trashed:true},{dayId:'elsewhere'}]) {
    assert.equal(status({photo,state:{...saved,photos:{p:edit}},saved}).kind,'dirty');
  }
  assert.equal(status({photo,state:{...saved,days:{d:{photoOrder:['other','p']}}},saved}).kind,'dirty');
});
test('arrow shortcuts leave typing, map controls, dialogs, modifiers and IME alone', () => {
  const event={key:'ArrowRight',target:{closest:()=>null}};
  assert.equal(arrowStep(event),1);assert.equal(arrowStep({...event,key:'ArrowLeft'}),-1);
  for (const key of ['ArrowUp','ArrowDown','Enter']) assert.equal(arrowStep({...event,key}),0);
  for (const flag of ['altKey','ctrlKey','metaKey','shiftKey','defaultPrevented','isComposing']) assert.equal(arrowStep({...event,[flag]:true}),0);
  assert.equal(arrowStep({...event,target:{closest:()=>({})}}),0);
});
test('editing metadata keeps the thumbnail pointer target attached through blur', () => {
  const f={journey:{id:'test',days:[{id:'d',number:1,title:'Day'}]},photos:[photo,{id:'next',dayId:'d'}],state:empty()};
  const h=uiHarness(f),grid=h.node('#studio-photo-grid');
  const buttons=f.photos.map(photo=>({dataset:{photoId:photo.id},attributes:{},setAttribute(key,value){this.attributes[key]=value;},removeAttribute(key){delete this.attributes[key];}}));
  grid.querySelectorAll=()=>buttons;
  Object.defineProperty(grid,'innerHTML',{set(){assert.fail('A blur must not replace the thumbnail click target');}});
  f.state.photos.p={caption:'Changed while leaving the field',location:{lat:48,lng:9}};
  h.render();
  assert.match(buttons[0].attributes['aria-label'],/Changed while leaving/);
  h.api.click('next');assert.equal(h.selectedPhotoId,'next');
  assert.equal(grid.querySelectorAll()[1],buttons[1]);
});
test('typing past a search match keeps the current photo until an intentional filter change', () => {
  const f={journey:{id:'test',days:[{id:'d',number:1,title:'Day'}]},photos:[{...photo,caption:'Search match'},{id:'next',dayId:'d',caption:'Search next'}],state:empty()};
  const h=uiHarness(f);h.api.click('p');h.node('#photo-search').value='Search';h.render();
  f.state.photos.p={caption:'Completely changed'};
  h.api.render(globalThis.JOURNEY_ATLAS_PHOTO_BATCH.orderedPhotos(f.journey,f.photos,f.state),h.selectedPhotoId,{keepSelected:true});
  assert.equal(h.selectedPhotoId,'p');assert.match(h.node('#studio-photo-grid').innerHTML,/Completely changed/);
  h.render();assert.equal(h.selectedPhotoId,'next');
});
const {data}=loadContent(new URL('..',import.meta.url).pathname);
const independent={id:'independent-draft',published:false,eventMode:'city',days:[{id:'north',number:1,title:'North'},{id:'south',number:2,title:'South'}],photos:[{id:'one',dayId:'north'},{id:'two',dayId:'south'},{id:'three',dayId:'south'}]};
for (const journey of [data.journeys.find(j=>j.id==='switzerland-italy-family-2026'),data.journeys.find(j=>j.kind==='demo'),independent]) {
  test(`${journey.id}: navigation follows filters/order, stays at boundaries, and does not change batch selection`, () => {
    const h=uiHarness({journey,photos:journey.photos,state:empty()});
    const ordered=globalThis.JOURNEY_ATLAS_PHOTO_BATCH.orderedPhotos(journey,journey.photos,h.f.state).filter(p=>!p.trashed);
    h.api.click(ordered[0].id);
    assert.equal(h.api.navigate(-1,h.selectedPhotoId),false);
    assert.equal(h.api.navigate(1,h.selectedPhotoId),true);
    assert.equal(h.selectedPhotoId,ordered[1].id);
    h.api.click(ordered.at(-1).id);assert.equal(h.api.navigate(1,h.selectedPhotoId),false);
    h.node('#photo-day-filter').value=ordered[0].dayId;h.render();
    const filtered=ordered.filter(p=>p.dayId===ordered[0].dayId);
    h.api.click(filtered.at(-1).id);assert.equal(h.api.navigate(1,h.selectedPhotoId),false);
    h.node('#photo-batch-toggle').handlers.click();
    assert.equal(h.api.navigate(-1,h.selectedPhotoId),false);
    assert.equal(h.node('#photo-next').disabled,true);
  });
}
