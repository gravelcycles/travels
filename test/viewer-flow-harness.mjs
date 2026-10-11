import fs from 'node:fs';
import vm from 'node:vm';
import '../dist/assets/mobile-ux.js';
const source = fs.readFileSync(new URL('../dist/assets/app.js', import.meta.url), 'utf8');
export function viewerFunction(name) {
  const start = source.indexOf(`  function ${name}(`);
  return source.slice(start, source.indexOf('\n  function ', start + 1));
}
// Exercise real entry/navigation functions with rendering isolated; no copied
// navigation decisions, browser source snippets, or journey-specific branches.
export function photoEntryFixture(journey, media = journey.photos || [], {mobile = false} = {}) {
  const events = [], active = journey.days[0];
  const context = vm.createContext({journey, viewerDayId:active.id, activeDayId:active.id, viewerPhotoIndex:0, viewerCollection:null,
    photosForDay:id=>media.filter(photo=>photo.dayId===id), orderedPhotos:()=>media,
    photoById:id=>media.find(photo=>photo.id===id), dayById:id=>journey.days.find(day=>day.id===id),
    activeDay:()=>journey.days.find(day=>day.id===context.activeDayId),
    photoDialog:{open:false,showModal(){this.open=true;events.push('fullscreen');}},
    setActiveDay(id,_focus,options){context.activeDayId=id;events.push({day:id,options});},
    arrivalChapter:{phase:'explore'},settleAtCity(){events.push('camera');},
    mediaUtils:{isVideo:photo=>photo.mediaType==='video',items:()=>media},photoStrip:{},storyMedia:{},
    photoBubbles:{open(photos,id,options){events.push({selection:id,photos:photos.map(photo=>photo.id),options});}},
    updateViewer(){const photo=context.viewerPhotos()[context.viewerPhotoIndex];if(photo)context.viewerDayId=photo.dayId;events.push('render');},
    initViewerMap(){},window:{requestAnimationFrame(){},JOURNEY_ATLAS_MOBILE:globalThis.JOURNEY_ATLAS_MOBILE,JOURNEY_ATLAS_MOBILE_UI:{enabled:()=>mobile,open(){events.push('entry');}}}
  });
  vm.runInContext(['photosForDay','orderedPhotos','viewerPhotos','viewerDay','selectPhoto','handlePhotoEntry','openCommentPhoto','openPhoto','moveViewer','openDayViewer','moveViewerDay'].map(viewerFunction).join('\n'),context);
  return {context,events,open:(id,options)=>context.openPhoto(id,options),click:(surface,id)=>context.handlePhotoEntry({currentTarget:context[surface],target:{closest:()=>({dataset:{openPhoto:id}})}}),photos:()=>Array.from(context.viewerPhotos())};
}
