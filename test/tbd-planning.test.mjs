import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadContent} from '../scripts/journey-content.mjs';
import {resizeCalendar} from '../scripts/journey-planner.mjs';
import {haversine} from '../scripts/route-geometry-lib.mjs';
import '../dist/assets/atlas-utils.js';
import '../dist/assets/replay-utils.js';
const root=new URL('..',import.meta.url).pathname;
const {data,routes}=loadContent(root);
const j=data.journeys.find(j=>j.id==='backpacking-europe-heading-east');
const utils=globalThis.JOURNEY_ATLAS_UTILS;

test('the requested undated extension keeps the photo itinerary and transport geometry distinct',()=>{
 const pending=j.days.slice(12);
 assert.deepEqual(pending.map(d=>d.title),['Vienna','Wrocław','Warsaw','Kraków','Bratislava','Budapest','Oradea','Sibiu','Timișoara','Belgrade','Zagreb','Ljubljana','Lake Bled','Split','Dubrovnik','Sarajevo','Ohrid','Qeparo','Athens']);
 assert.ok(pending.every(d=>d.planningStatus==='tbd' && !d.calendarDate && !d.calendarEndDate));
 assert.equal(utils.eventForDate(j,'2026-10-23').title,'Forni di Sopra');
 assert.equal(utils.eventForDate(j,'2026-10-29').title,'Forni di Sopra');
 assert.equal(utils.eventForDate(j,'2026-11-01'),undefined);
 const manifest=JSON.parse(fs.readFileSync(new URL('../content/route-sources/backpacking-europe-heading-east.json',import.meta.url)));
 const legs=pending.flatMap(d=>d.segmentIds.map(id=>j.segments.find(s=>s.id===id)));
 assert.equal(legs.filter(s=>s.mode==='train').length,13);assert.equal(legs.filter(s=>s.mode==='bus').length,15);
 for(const s of legs){
  const coords=routes[s.id],p=manifest.segments[s.id].provenance;
  assert.equal(manifest.segments[s.id].strategy,'preserve');assert.ok(coords.length>20);
  assert.ok(p.endpointOffsetsMeters.every(m=>m<100));
  assert.ok(Math.abs(p.rawDistanceKm-p.distanceKm)/p.rawDistanceKm<.005);
  assert.ok(p.maxSectionJoinMeters<=1);
  for(const [index,placeId] of [[0,s.from],[coords.length-1,s.to]]){const place=j.places.find(p=>p.id===placeId);assert.ok(haversine(coords[index],[place.lng,place.lat])<.1);}
  assert.ok(Math.abs(s.distanceKm-p.distanceKm)<.051);
  if(s.mode==='bus'){assert.match(p.provider,/OSRM/);assert.equal(p.profile,'driving');assert.ok(p.requestUrls.every(url=>url.includes('overview=full')&&url.includes('geometries=geojson')));}
 }
 // The moved Slovenian stays retain the direct Sava rail corridor, then
 // return through Lesce/Ljubljana/Zagreb without creating another Zagreb stay.
 assert.ok(legs.find(s=>s.id.endsWith('-zagreb-ljubljana')).distanceKm<160);
 assert.ok(legs.find(s=>s.id.endsWith('-lesce-zagreb')).distanceKm<220);
 const forni=j.days[11];
 assert.deepEqual([forni.title,forni.calendarDate,forni.calendarEndDate],['Forni di Sopra','2026-10-23','2026-10-29']);
 assert.equal(forni.planningStatus,undefined);
 assert.deepEqual(forni.segmentIds.map(id=>j.segments.find(s=>s.id===id).mode),['train','bus','bus']);
 const placeName=id=>j.places.find(p=>p.id===id).name;
 assert.deepEqual(forni.segmentIds.map(id=>placeName(j.segments.find(s=>s.id===id).to)),['Udine','Tolmezzo','Forni di Sopra']);
 for(let i=1;i<j.days.length;i++){
  const day=j.days[i],incoming=day.segmentIds.map(id=>j.segments.find(s=>s.id===id));
  assert.equal(incoming[0].from,j.days[i-1].destinationId);
  incoming.slice(1).forEach((s,index)=>assert.equal(s.from,incoming[index].to));
  assert.equal(incoming.at(-1).to,day.destinationId);
 }
 assert.deepEqual(new Set(j.days.flatMap(d=>d.segmentIds)),new Set(j.segments.map(s=>s.id)));
});

test('date resizing preserves undated city and calendar-day tails',()=>{
 const shifted=resizeCalendar(j,'2026-09-02','2026-10-30','itinerary');
 assert.deepEqual(shifted.days.slice(12),j.days.slice(12));
 assert.equal(shifted.days[11].calendarEndDate,'2026-10-30');
 const daily={id:'new-trip',days:[{id:'dated',number:1,calendarDate:'2026-10-01',date:'1 Oct',segmentIds:[]},{id:'future',number:2,planningStatus:'tbd',date:'TBD',segmentIds:[]}]};
 const extended=resizeCalendar(daily,'2026-10-01','2026-10-02');
 assert.equal(extended.days.at(-1).id,'future');assert.equal(extended.days.at(-1).number,3);
 assert.equal(extended.days.at(-1).calendarDate,undefined);assert.equal(extended.removed.length,0);
});

test('TBD visibility filters curated Replay and mixed media without mutating IDs or confidence',()=>{
 const source={places:[{id:'a'},{id:'b'}],segments:[{id:'leg',from:'a',to:'b',mode:'bus'}],days:[{id:'known',number:1,date:'1 Oct',destinationId:'a',segmentIds:[]},{id:'pending',number:2,planningStatus:'tbd',calendarDate:'2026-10-02',date:'2 Oct',destinationId:'b',segmentIds:['leg']}],photos:[{id:'photo',dayId:'pending'}],videos:[{id:'video',dayId:'pending'}],replayMoments:[{id:'first',dayId:'known'},{id:'second',dayId:'pending',segmentIds:['leg']}]};
 const shown=utils.projectPlanning(source),hidden=utils.projectPlanning(source,false);
 assert.equal(shown.days[1].date,'TBD · 2 Oct');assert.equal(shown.segments[0].planningStatus,'tbd');
 assert.equal(hidden.days.length,1);assert.equal(hidden.replayMoments.length,1);assert.equal(hidden.photos.length,0);assert.equal(hidden.videos.length,0);
 assert.equal(source.days[1].date,'2 Oct');assert.equal(source.segments[0].planningStatus,undefined);
 source.meetup={dayId:'pending',placeId:'b'};
 assert.equal(utils.projectPlanning(source,false).meetup,undefined);
 source.places.push({id:'meetup-only'}); source.meetup={dayId:'known',placeId:'meetup-only'};
 assert.ok(utils.projectPlanning(source,false).places.some(place=>place.id==='meetup-only'));
});
