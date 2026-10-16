import fs from 'node:fs';
import vm from 'node:vm';
import '../dist/assets/atlas-utils.js';
import '../dist/assets/location-labels.js';
import '../dist/assets/view-sharing.js';
import '../dist/assets/media-utils.js';

const app = fs.readFileSync(new URL('../dist/assets/app.js', import.meta.url), 'utf8');
const mobile = fs.readFileSync(new URL('../dist/assets/mobile-ux.js', import.meta.url), 'utf8');
function appFunction(name) {
  const start = app.indexOf(`  function ${name}(`);
  if (start < 0) throw new Error(`Missing app function ${name}`);
  const end = app.indexOf('\n  function ', start + 1);
  return app.slice(start, end < 0 ? undefined : end).split('\n  // Any deliberate input')[0];
}

// Run the real opening, selection, map rendering and mobile controller together.
// Only map drawing, image loading and unrelated service surfaces are replaced.
export function mapEntryHarness(journey, {mobile: isMobile = false, ready = true} = {}) {
  const nodes = new Map(), listeners = new Map(), timers = new Map();
  const routes = [], calls = [];
  let groups = [], clock = 0, cursor = 0, context;
  const stack = [{}];
  function node(selector) {
    if (nodes.has(selector)) return nodes.get(selector);
    const classes = new Set(), handlers = new Map();
    const value = {dataset:{}, innerHTML:'', textContent:'', hidden:false, open:false, inert:false,
      style:{setProperty(name, value){this[name] = value;}}, children:[], handlers,
      clientWidth:isMobile ? 390 : 1360, clientHeight:844, offsetHeight:150, offsetTop:0, offsetParent:{},
      classList:{add:name=>classes.add(name), remove:name=>classes.delete(name), contains:name=>classes.has(name), toggle(name, force){if(force)classes.add(name);else classes.delete(name);}},
      setAttribute(name,value){this[name]=value;},removeAttribute(name){delete this[name];},append(child){this.children.push(child);},
      querySelector(){return null;},querySelectorAll(){return [];},focus(){},scrollBy(){},
      getBoundingClientRect(){return {top:0,left:0,bottom:844,width:this.clientWidth,height:844};},
      addEventListener(name,handler){handlers.set(name,handler);},showModal(){this.open=true;},close(){this.open=false;},
    };
    nodes.set(selector,value);return value;
  }
  const history = {get state(){return stack[cursor];},replaceState(state){stack[cursor]=structuredClone(state);},
    pushState(state){stack.splice(++cursor);stack[cursor]=structuredClone(state);},
    go(delta){cursor=Math.max(0,Math.min(stack.length-1,cursor+delta));listeners.get('popstate')?.({state:this.state});},back(){this.go(-1);}};
  const schedule = callback => {timers.set(++clock,callback);return clock;};
  const window = {JOURNEY_ATLAS_UTILS:globalThis.JOURNEY_ATLAS_UTILS,JOURNEY_ATLAS_LOCATION_LABELS:globalThis.JOURNEY_ATLAS_LOCATION_LABELS,
    JOURNEY_ATLAS_SHARING_UI:{changed(){},sync(){}},
    JOURNEY_ATLAS_OPENING_ROUTE:{start(){calls.push('opening-trace');return {cancel(){},syncLayers(){}};}},
    setTimeout:schedule,addEventListener:(name,handler)=>listeners.set(name,handler),matchMedia:()=>({matches:isMobile})};
  const sourceDays = journey.days;
  context = vm.createContext({journey,sourceJourney:journey,activeDayId:sourceDays[0].id,mapScope:'journey',
    mainMapReady:ready,mainMap:{stop(){},resize(){},jumpTo(camera){calls.push({camera});}},mainDecorations:{},
    activeGroupId:'',openingRoute:null,openingRoutePending:false,mobileMapTimer:null,pendingMapAction:null,
    arrivalChapter:null,arrivalKey:day=>day.id,inspectedSegmentId:null,modeStyles:{},palette:{muted:'#71878a'},
    placesUI:{update(){},dayChanged(){}},photoBubbles:{refresh(){},clearMap(){},close(){}},
    locationLabels:{update(value){groups=value;},closePreview(){}},
    $:node,dayList:node('#day-list'),detailPanel:node('#story-detail'),storyMedia:node('#story-media'),photoStrip:node('#photo-strip'),
    photoDialog:node('#photo-dialog'),replayDialog:node('#replay-dialog'),replayJourneyId:null,
    document:{querySelector:node,createElement:()=>node(`created-${nodes.size}`),body:node('body'),hidden:false,addEventListener(){}},
    window,history,location:{href:'https://example.test/trip',hash:'',search:''},URLSearchParams,
    matchMedia:query=>({matches:query.includes('900px') && isMobile,addEventListener(){}}),
    ResizeObserver:class{observe(){}},requestAnimationFrame(){},cancelAnimationFrame(){},performance:{now:()=>0},
    setTimeout:schedule,clearTimeout:id=>timers.delete(id),
    eventWord:form=>globalThis.JOURNEY_ATLAS_UTILS.eventWord(journey,form),
    mediaUtils:{...globalThis.JOURNEY_ATLAS_MEDIA,label:photos=>`${photos.length} photos`},
    photoById:id=>(journey.photos || []).find(photo=>photo.id===id),
    segmentCoordinates:segment=>segment.geometry || segment.coordinates || [],
    modesForDay:day=>[...new Set(day.segmentIds.map(id=>journey.segments.find(segment=>segment.id===id)?.mode).filter(Boolean))],
    modeLabel:()=>'',dayDistance:()=>0,dayDuration:()=>'',dayCoordinates:()=>[[8,47]],formatDistance:value=>String(value),
    escapeHtml:value=>String(value ?? ''),lineSwatch:()=>'',photoImageMarkup:()=>'<img alt="Fixture" />',
    groupTravel:{dayDetails:()=>''},renderRouteLegs:()=>'',renderParty(){},renderPlanningFilters(){},renderLegend(){},renderArrivalChapter(){},
    mapIsReady:()=>true,clearDayPreview(){},clearSegmentInspection(){},syncInspectionClasses(){},syncArrivalLayers(){},
    clearDecorations(){routes.length=0;},addSegmentLayer(_map,_decorations,segment,options){routes.push({segment,options});},addDayStopMarkers:()=>[],
    fitJourneyBounds(){calls.push('fit');},scrollActiveDayIntoView(){},prepareProgressiveImages(){},refreshPreloads(){},prefersReducedMotion:()=>false,
    cancelArrival(){context.cancelOpeningRoute();},startArrival(){context.drawMainMap(false);},settleAtCity(){context.drawMainMap(false);},showJournal(){},
    setMobileTab(tab){node('.atlas-shell').dataset.mobileTab=tab;window.JOURNEY_ATLAS_MOBILE_UI?.tabChanged();},
    openPhoto(id){context.openedPhoto=id;node('#photo-dialog').open=true;},openDayViewer(id){context.openedGrid=id;},selectPhoto(id){context.selectedPhoto=id;},
  });
  const functions = ['placeById','segmentById','dayById','activeDay','destinationForDay','segmentsForDay','photosForDay','orderedPhotos',
    'segmentCoordinates','drawMainMap','renderDayNavigator','moveActiveDay','fitRoute','cancelOpeningRoute','openJourneyMap','playOpeningRoute',
    'renderDays','dayCopyMarkup','renderStory','setActiveDay','restoreMapView','renderIntroduction','dismissIntroduction','restoreSharedView'];
  vm.runInContext(functions.map(appFunction).join('\n'), context);
  vm.runInContext(mobile,context);
  const controller = window.JOURNEY_ATLAS_MOBILE.create({
    eventWord:context.eventWord,day:context.activeDay,days:()=>journey.days,scope:()=>context.mapScope,title:()=>journey.title,
    dayInfo:day=>({tagline:day.tagline || '',meta:'',count:context.photosForDay(day.id).length,albumCount:context.orderedPhotos().length}),
    selectDay:id=>context.setActiveDay(id,true),stepDay:context.moveActiveDay,tab:context.setMobileTab,overview:context.fitRoute,
    preview(){},album(){},replay(){},clearImage(){},loadImage(){},
  });
  window.JOURNEY_ATLAS_MOBILE_UI=controller;
  node('.atlas-shell').dataset.mobileTab='map';
  const clickStart=app.indexOf('  dayList.addEventListener("click"');
  vm.runInContext(app.slice(clickStart,app.indexOf('\n  });',clickStart)+6),context);
  context.renderDays();context.renderStory();context.drawMainMap(false);
  return {context,node,routes,calls,controller,history,get groups(){return groups;},
    open(){context.renderIntroduction();node('#intro-relive').onclick();},
    choose(id){node('#day-list').handlers.get('click')({target:{closest:()=>({dataset:{dayId:id}})}});},
    link(href){const url=new URL(href);context.location={href,hash:url.hash,search:url.search};context.renderIntroduction();context.restoreSharedView(globalThis.JOURNEY_ATLAS_SHARING.read(href));},
  };
}
