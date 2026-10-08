import test from 'node:test';
import assert from 'node:assert/strict';
import {loadContent,validateJourneys} from '../scripts/journey-content.mjs';
import {assignPhotoDay} from '../scripts/studio-photo-service.mjs';
import '../dist/assets/atlas-utils.js';

const utils=globalThis.JOURNEY_ATLAS_UTILS;
const city={eventMode:'city',timeZone:'Europe/Berlin',days:[
 {id:'origin',calendarDate:'2026-09-01',calendarEndDate:'2026-09-01'},
 {id:'first-city',calendarDate:'2026-09-01',calendarEndDate:'2026-09-17'},
 {id:'second-city',calendarDate:'2026-09-17',calendarEndDate:'2026-09-29'}]};
test('city photo uploads match the entire stay, respect time zones and allow departure-city overrides',()=>{
 assert.equal(assignPhotoDay(city,{DateTimeOriginal:'2026:09:10 12:00:00'}).day.id,'first-city');
 assert.equal(assignPhotoDay(city,{DateTimeOriginal:'2026:09:16 22:30:00Z'}).day.id,'second-city');
 assert.equal(assignPhotoDay(city,{DateTimeOriginal:'2026:09:17 10:00:00'}).day.id,'second-city');
 assert.equal(assignPhotoDay(city,{DateTimeOriginal:'2026:09:17 10:00:00'},'first-city').warnings.length,0);
 assert.equal(assignPhotoDay(city,{DateTimeOriginal:'2026:09:01 10:00:00'},'origin').warnings.length,0);
 assert.throws(()=>assignPhotoDay(city,{DateTimeOriginal:'2026:09:30 10:00:00'}),/outside this journey/);
});
test('event labels update authored copy and accessible controls in both directions',()=>{
 const copy={dataset:{eventCopy:'THE DAYS'}},aria={dataset:{eventAria:'Previous day'},setAttribute(k,v){this[k]=v;}};
 const dom={querySelectorAll:selector=>selector==='[data-event-copy]'?[copy]:[aria]};
 utils.applyEventCopy(city,dom);assert.equal(copy.textContent,'THE STOPS');assert.equal(aria['aria-label'],'Previous stop');
 utils.applyEventCopy({},dom);assert.equal(copy.textContent,'THE DAYS');assert.equal(aria['aria-label'],'Previous day');
});
test('city schema rejects unknown modes and requires explicit, complete ranges',()=>{
 const {data}=loadContent(new URL('..',import.meta.url).pathname);const j=data.journeys[0];
 j.eventMode='week';assert.throws(()=>validateJourneys(data),/eventMode/);
 j.eventMode='city';delete j.startDate;assert.throws(()=>validateJourneys(data),/date range/);
});

test('Heading East preserves corrected city order and the researched train–bus–train connection',()=>{
 const {data,routes}=loadContent(new URL('..',import.meta.url).pathname);
 const j=data.journeys.find(j=>j.id==='backpacking-europe-heading-east');
 assert.equal(j.eventMode,'city');assert.equal(j.published,true);
 assert.deepEqual(j.days.map(d=>d.title),['Luzern','Freiburg','Hamburg','Köln','Düsseldorf','Berlin','Prague','Salzburg']);
 assert.deepEqual(j.days.slice(3,6).map(d=>[d.calendarDate,d.calendarEndDate]),[['2026-09-29','2026-09-30'],['2026-09-30','2026-10-01'],['2026-10-01','2026-10-05']]);
 const prague=j.days.find(d=>d.title==='Prague');
 const legs=prague.segmentIds.map(id=>j.segments.find(s=>s.id===id));
 assert.deepEqual(legs.map(s=>s.mode),['train','bus','train']);
 assert.equal(j.places.find(p=>p.id===legs[1].from).name,'Dresden Hbf');
 assert.equal(j.places.find(p=>p.id===legs[1].to).name,'Ústí nad Labem hl. n.');
 assert.equal(j.segments.filter(s=>s.mode==='bus').length,1);
 assert.ok(j.segments.every(s=>routes[s.id].length>100&&s.geometryStatus==='reconstructed'));
 assert.ok(j.days.every(d=>d.text===''));assert.equal(j.photos.length,0);
});
