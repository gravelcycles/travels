import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareJourneyPlan, resizeCalendar } from '../scripts/journey-planner.mjs';
import { loadContent } from '../scripts/journey-content.mjs';
import { readOverrides } from '../scripts/build-site.mjs';
const root=new URL('..',import.meta.url).pathname;
const {data}=loadContent(root); const base=data.journeys[0], state=readOverrides(root);
test('range extension preserves notes, IDs, routes, photos and override ownership',()=>{
  const result=prepareJourneyPlan(data,base,{title:'A new title',startDate:'2026-08-12'},state);
  assert.equal(result.journey.id,base.id);assert.equal(result.journey.slug,base.slug);
  assert.equal(result.journey.days[1].id,base.days[0].id);
  assert.equal(result.journey.days[1].text,base.days[0].text);
  assert.deepEqual(result.journey.photos,base.photos);
  assert.deepEqual(result.added,['2026-08-12']);
  assert.equal(new Set(result.journey.days.map(d=>d.id)).size,15);
});
test('moving full itinerary changes calendar dates without losing content',()=>{
  const result=prepareJourneyPlan(data,base,{startDate:'2026-09-01',endDate:'2026-09-14'},state,'itinerary');
  assert.deepEqual(result.journey.days.map(d=>d.id),base.days.map(d=>d.id));
  assert.equal(result.journey.days[0].calendarDate,'2026-09-01');
  assert.equal(result.journey.days[0].text,base.days[0].text);
  const dated={...state,days:{...state.days,[base.days[0].id]:{date:base.days[0].date,title:'Keep title'}}};
  const moved=prepareJourneyPlan(data,base,{startDate:'2026-09-01',endDate:'2026-09-14'},dated,'itinerary');
  assert.equal(moved.state.days[base.days[0].id].date,'1 Sept');
  assert.equal(moved.state.days[base.days[0].id].title,'Keep title');
});
test('destructive trims and forged removals are refused even after preview',()=>{
  assert.throws(()=>prepareJourneyPlan(data,base,{startDate:'2026-08-14'},state),/has content/);
  const days=base.days.slice(1).map((d,i)=>({...d,number:i+1}));
  assert.throws(()=>prepareJourneyPlan(data,base,{days,startDate:'2026-08-14'},state),/has content/);
  assert.throws(()=>prepareJourneyPlan(data,base,{id:'new-id'},state),/Cannot change id/);
});
test('empty date trims, leap dates and duplicate place/leg IDs validate',()=>{
  const j={id:'draft',days:[{id:'draft-d1',calendarDate:'2028-02-28',title:'Day to plan',segmentIds:[]},{id:'draft-d2',calendarDate:'2028-02-29',title:'Day to plan',segmentIds:[]}]};
  const resized=resizeCalendar(j,'2028-02-29','2028-03-01');
  assert.equal(resized.days[0].id,'draft-d2');assert.equal(resized.added[0].calendarDate,'2028-03-01');
  assert.throws(()=>prepareJourneyPlan(data,base,{places:[...base.places,base.places[0]]},state),/duplicate/);
  assert.throws(()=>prepareJourneyPlan(data,base,{segments:[...base.segments,base.segments[0]]},state),/duplicate/);
});
test('leg reordering preserves curated selections in the new travel order',()=>{
  const days=structuredClone(base.days), day=days.find(d=>d.number===6);
  day.segmentIds.reverse();
  const result=prepareJourneyPlan(data,base,{days},state);
  assert.deepEqual(result.journey.replayMoments.find(m=>m.dayId===day.id).segmentIds,day.segmentIds);
});
test('invalid editorial references, durations and unreviewed cameras fail validation',()=>{
  const moment={...base.replayMoments[0]};
  for(const patch of [{caption:42},{duration:0},{dayId:'missing'},{photoId:'missing'},{segmentIds:['missing']},{camera:{center:[8,46],zoom:12}}]) {
    assert.throws(()=>prepareJourneyPlan(data,base,{replayMoments:[{...moment,...patch}]},state),/replay/);
  }
});

test('Replay allows intentionally blank day copy without changing routes or timing', () => {
  const moment = {...base.replayMoments[0], caption: ''};
  const result = prepareJourneyPlan(data, base, {replayMoments: [moment]}, state);
  assert.equal(result.journey.replayMoments[0].caption, '');
  assert.equal(result.journey.replayMoments[0].duration, moment.duration);
  assert.deepEqual(result.journey.replayMoments[0].segmentIds, moment.segmentIds);
});
