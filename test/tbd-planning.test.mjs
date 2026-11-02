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

test('confirmed Vienna and Poland dates retain the undated tail and reviewed transport geometry',()=>{
 const pending=j.days.slice(12);
 assert.deepEqual(pending.map(d=>d.title),['Vienna','Warsaw','Kraków','Bratislava','Budapest','Oradea','Sibiu','Timișoara','Belgrade','Zagreb','Ljubljana','Lake Bled','Split','Dubrovnik','Sarajevo','Ohrid','Qeparo','Athens']);
 assert.deepEqual(pending.slice(0,3).map(d=>[d.calendarDate,d.calendarEndDate,d.planningStatus]),[['2026-10-29','2026-11-01',undefined],['2026-11-02','2026-11-06',undefined],['2026-11-06','2026-11-11',undefined]]);
 assert.ok(pending.slice(3).every(d=>d.planningStatus==='tbd' && !d.calendarDate && !d.calendarEndDate));
 assert.equal(j.days.length,30);assert.equal(j.endDate,'2026-11-11');
 assert.equal(utils.eventForDate(j,'2026-10-23').title,'Forni di Sopra');
 assert.equal(utils.eventForDate(j,'2026-10-29').title,'Vienna');
 assert.equal(utils.eventForDate(j,'2026-11-01').title,'Vienna');
 assert.equal(utils.eventForDate(j,'2026-11-02').title,'Warsaw');
 assert.equal(utils.eventForDate(j,'2026-11-06').title,'Kraków');
 assert.equal(utils.eventForDate(j,'2026-11-12'),undefined);
 const manifest=JSON.parse(fs.readFileSync(new URL('../content/route-sources/backpacking-europe-heading-east.json',import.meta.url)));
 const legs=pending.flatMap(d=>d.segmentIds.map(id=>j.segments.find(s=>s.id===id)));
 assert.equal(legs.filter(s=>s.mode==='train').length,16);assert.equal(legs.filter(s=>s.mode==='bus').length,15);
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
 const vienna=j.days[12],viennaLegs=vienna.segmentIds.map(id=>j.segments.find(s=>s.id===id));
 assert.deepEqual(viennaLegs.map(s=>s.mode),['bus','bus','train']);
 assert.deepEqual(viennaLegs.map(s=>placeName(s.to)),['Tolmezzo','Udine','Vienna']);
 assert.ok(viennaLegs[1].distanceKm>50 && viennaLegs[1].distanceKm<52);
 assert.ok(viennaLegs.at(-1).distanceKm>490 && viennaLegs.at(-1).distanceKm<500);
 const rail=manifest.segments[viennaLegs.at(-1).id].provenance;
 assert.equal(rail.restoredFrom.commit,'93fc1f6');
 assert.equal(rail.serviceEvidence.service,'ÖBB Railjet');
 assert.match(j.note,/bus 110 to Tolmezzo and bus 100 to Udine, then an ÖBB Railjet to Vienna/);
 const warsaw=j.days[13],arrival=warsaw.segmentIds.map(id=>j.segments.find(s=>s.id===id));
 assert.deepEqual(arrival.map(s=>placeName(s.to)),['Břeclav','Bohumín','Kraków','Zawiercie','Warsaw']);
 assert.ok(arrival.every(s=>s.mode==='train'));
 assert.deepEqual(arrival.slice(0,3).map(s=>manifest.segments[s.id].provenance.serviceEvidence.train),['RJ 252','EC 130','IC 115']);
 assert.match(arrival[0].duration,/1 Nov 11:10–12:04/);
 assert.match(arrival[3].duration,/Os 34132 · 2 Nov 12:06–13:12/);
 assert.match(arrival[4].duration,/EIC 4504 · 2 Nov 13:34–15:24/);
 assert.deepEqual(arrival.slice(3).map(s=>manifest.segments[s.id].provenance.serviceEvidence.train),['Os 34132','EIC 4504']);
 assert.equal(j.days.filter(d=>d.destinationId.endsWith('-krakow')).length,1);
 assert.ok(!j.places.some(p=>p.id.endsWith('-wroclaw')));
 const distanceToLine=(point,line)=>{
  const scale=Math.cos(point[1]*Math.PI/180);let min=Infinity;
  for(let i=1;i<line.length;i++){const a=line[i-1],b=line[i],dx=(b[0]-a[0])*scale,dy=b[1]-a[1],px=(point[0]-a[0])*scale,py=point[1]-a[1],t=Math.max(0,Math.min(1,(px*dx+py*dy)/(dx*dx+dy*dy||1)));min=Math.min(min,Math.hypot(px-t*dx,py-t*dy)*111.32);}return min;
 };
 const western=routes[arrival[3].id],express=routes[arrival[4].id];
 assert.deepEqual(western.at(-1),express[0],'both trains meet at the same Zawiercie track point');
 for(const point of [[19.4529,50.1540],[19.2933,50.2471],[19.2720,50.2600],[19.2650,50.3668]]) assert.ok(distanceToLine(point,western)<.2,'regional line visits the western station corridor');
 assert.ok(arrival[3].distanceKm>88&&arrival[3].distanceKm<90);
 assert.ok(arrival[4].distanceKm>250&&arrival[4].distanceKm<255,'express has no mismatched-platform return loop');
 assert.ok(distanceToLine([20.9655,52.2195],express)<.15,'express passes Warszawa Zachodnia');
 assert.deepEqual(arrival[3].via.map(p=>p.name),['Trzebinia','Jaworzno Szczakowa','Dąbrowa Górnicza Ząbkowice']);
 assert.deepEqual(arrival[2].via.map(p=>p.name),['Zebrzydowice','Czechowice-Dziedzice','Oświęcim','Chrzanów Śródmieście','Trzebinia','Krzeszowice']);
 // Both directions follow the same 100/110 corridor. Compare physical
 // lines, allowing only carriageway/one-way terminal differences, not detours.
 const offset=(point,line)=>{
  const scale=Math.cos(point[1]*Math.PI/180),x=point[0]*scale,y=point[1];let min=Infinity;
  for(let i=1;i<line.length;i++){
   const ax=line[i-1][0]*scale,ay=line[i-1][1],dx=(line[i][0]-line[i-1][0])*scale,dy=line[i][1]-line[i-1][1];
   const t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy||1)));
   min=Math.min(min,Math.hypot(x-ax-t*dx,y-ay-t*dy)*111.32);
  }return min;
 };
 for(const [a,b,service] of [['udine-tolmezzo','tolmezzo-udine','100'],['tolmezzo-forni','forni-tolmezzo','110']]){
  const ids=[a,b].map(short=>'backpacking-europe-heading-east-'+short),[out,back]=ids.map(id=>routes[id]);
  for(const id of ids) assert.equal(manifest.segments[id].provenance.service,service);
  for(const [line,other] of [[out,back],[back,out]])
   assert.ok(line.every(point=>offset(point,other)<.35),`Bus ${service} must not invent a different corridor on return`);
 }
 assert.ok(j.segments.find(s=>s.id.endsWith('-udine-tolmezzo')).distanceKm<51);
 for(const old of ['tolmezzo-carnia','carnia-tarvisio','tarvisio-boscoverde','boscoverde-vienna','vienna-wroclaw','wroclaw-warsaw']) {
  const id='backpacking-europe-heading-east-'+old;
  assert.ok(!j.segments.some(s=>s.id===id));
  assert.equal(routes[id],undefined); assert.equal(manifest.segments[id],undefined);
 }
 for(let i=1;i<j.days.length;i++){
  const day=j.days[i],incoming=day.segmentIds.map(id=>j.segments.find(s=>s.id===id));
  assert.equal(incoming[0].from,j.days[i-1].destinationId);
  incoming.slice(1).forEach((s,index)=>assert.equal(s.from,incoming[index].to));
  assert.equal(incoming.at(-1).to,day.destinationId);
 }
 assert.deepEqual(new Set(j.days.flatMap(d=>d.segmentIds)),new Set(j.segments.map(s=>s.id)));
});

test('date resizing preserves undated city and calendar-day tails',()=>{
 const shifted=resizeCalendar(j,'2026-09-02','2026-11-12','itinerary');
 assert.deepEqual(shifted.days.slice(15),j.days.slice(15));
 assert.equal(shifted.days[11].calendarEndDate,'2026-10-30');
 assert.equal(shifted.days[12].calendarEndDate,'2026-11-02');
 assert.equal(shifted.days[13].calendarDate,'2026-11-03');
 assert.equal(shifted.days[14].calendarEndDate,'2026-11-12');
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
