// Local review fixtures use the shared page and runtime, with no private media.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadContent} from './journey-content.mjs';
import {renderJourneyPage,escapeHtml} from './build-site.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const {data,routes}=loadContent(root,{includeDrafts:true});
const id=process.argv[2];
const original=data.journeys.find(j=>j.id===id);
if(!original) throw Error('Pass an existing journey or local draft ID');
const journey=structuredClone(original);
journey.published=false;journey.photos=[];journey.videos=[];journey.pointsOfInterest=[];
journey.kicker='UNPUBLISHED DEMO · ARRIVAL → CITY';
for(const day of journey.days){
  if(!day.placeId&&!day.destinationId)continue;
  day.text='Demo only. Your city story will appear here. The arrival plays once, then the map stays close while you browse your photos.';
  delete day.photoOrder;delete day.leadPhotoId;
  for(let n=1;n<=3;n++){
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><rect width="1200" height="800" fill="${['#203b43','#32586b','#3c584e'][n-1]}"/><circle cx="1050" cy="160" r="300" fill="#fffdf7" opacity=".045"/><circle cx="140" cy="780" r="400" fill="#fffdf7" opacity=".035"/><text x="85" y="120" fill="#dbe5dd" font-family="sans-serif" font-size="23" letter-spacing="5">DEMO PHOTO ${n} / 3</text><text x="85" y="465" fill="#fffdf7" font-family="Georgia,serif" font-size="100">${escapeHtml(day.title)}</text><path d="M85 510h110" stroke="#df794f" stroke-width="5"/><text x="85" y="580" fill="#dbe5dd" font-family="sans-serif" font-size="26">Your photos will go here.</text></svg>`;
    journey.photos.push({id:`${day.id}-arrival-preview-${n}`,dayId:day.id,locationLabel:day.title,src:`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`,width:1200,height:800,caption:`Demo placeholder ${n} · ${day.title}`,alt:`Labelled placeholder for a future ${day.title} photo`,description:'Local interface demonstration. This is not a trip photograph and has no invented photo coordinates.'});
  }
}
const inline=(name,value)=>`<script>window.${name}=${JSON.stringify(value).replaceAll('<','\\u003c')};</script>`;
let html=renderJourneyPage(root,journey,{preview:true});
for(const [asset,name,value] of [
  ['journeys','JOURNEY_ATLAS_DATA',{...data,defaultJourneyId:journey.id,journeys:[journey]}],
  ['route-geometry','JOURNEY_ATLAS_ROUTE_GEOMETRY',Object.fromEntries(journey.segments.map(s=>[s.id,routes[s.id]||s.geometry||[]]))],
  ['trip-photos','JOURNEY_ATLAS_PHOTOS',{[journey.id]:journey.photos}],
  ['content-overrides','JOURNEY_ATLAS_CONTENT_OVERRIDES',{days:{},routes:{},photos:{}}]
]) html=html.replace(new RegExp(`<script src="/api/preview-assets/${asset}\\.js"></script>`),inline(name,value));
html=html.replace(/<script src="\/dist\/assets\/photo-(?:service|auth)\.js"><\/script>/g,'');
const filename=`qa-arrival-${id}.html`;
fs.writeFileSync(path.join(root,'dist',filename),html);
console.log(`/dist/${filename}`);
