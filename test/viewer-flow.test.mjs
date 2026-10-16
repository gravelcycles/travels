import test from 'node:test';
import assert from 'node:assert/strict';
import '../dist/assets/atlas-utils.js';
import {photoEntryFixture} from './viewer-flow-harness.mjs';
import {photoBubbleFixture} from './photo-bubble-harness.mjs';
const journey = {id:'independent-trip',eventMode:'city',days:[{id:'harbor',number:1,title:'Harbor'},{id:'hill',number:2,title:'Hill'}],photos:[{id:'first',dayId:'harbor'},{id:'second',dayId:'harbor'},{id:'clip',dayId:'harbor',mediaType:'video'},{id:'fourth',dayId:'hill'}]};

test('the large sidebar photograph opens full screen and leaves the presenting map camera alone',()=>{
  const f=photoEntryFixture(journey);
  f.click('storyMedia','second');
  assert.equal(f.context.photoDialog.open,true);
  assert.deepEqual(f.events,[{bubblesSuspended:true},{labelsSuspended:true},'entry','fullscreen','render']);
  assert.equal(f.context.viewerPhotoIndex,1);
  assert.deepEqual(f.photos().map(photo=>photo.id),['first','second','clip','fourth']);
  assert.equal(f.context.viewerCollection,null);
});

test('fullscreen covers decorations before event changes and ignores a stale close after reopening',()=>{
  for(const dayEntry of [false,true]){
    const f=photoEntryFixture(journey);
    f.context.window.JOURNEY_ATLAS_MOBILE_UI.prepareOpen=()=>f.events.push('capture-return');
    if(dayEntry)f.context.openDayViewer('hill');else f.open('fourth');
    assert.deepEqual(f.events.slice(0,3),['capture-return',{bubblesSuspended:true},{labelsSuspended:true}]);
    assert.ok(f.events.findIndex(event=>event?.day==='hill')>2);
    f.context.setMainMapCovered(false);
    assert.equal(f.context.mainMapCovered,true,'A queued close cannot uncover a replacement viewer');
    f.context.photoDialog.open=false;f.context.setMainMapCovered(false);f.context.setMainMapCovered(false);
    assert.deepEqual(f.events.slice(-2),[{bubblesSuspended:false},{labelsSuspended:false}]);
    assert.equal(f.events.filter(event=>event?.labelsSuspended===false).length,1);
  }
});

test('explicit Places collections preserve their order, boundaries, and current-photo day',()=>{
  const f=photoEntryFixture(journey), collection=[journey.photos[3],journey.photos[1]];
  f.open('second',{photos:collection,collectionLabel:'Saved place'});
  assert.deepEqual(f.photos().map(photo=>photo.id),['fourth','second']);
  assert.equal(f.context.viewerPhotoIndex,1);
  f.context.moveViewer(1);assert.equal(f.context.viewerPhotoIndex,1,'Never wrap out of the chosen collection');
  f.context.moveViewer(-1);assert.equal(f.context.viewerDayId,'hill');
  assert.equal(f.context.viewerCollection.label,'Saved place');
  f.context.moveViewerDay(-1);assert.equal(f.context.viewerDayId,'hill','Day arrows do not silently change a named collection');
  f.open('first');assert.equal(f.context.viewerCollection,null,'A fresh album entry starts the journey roll again');
});

test('the right reel selects the large photo without opening fullscreen or moving the map',()=>{
  const f=photoEntryFixture(journey);
  f.click('photoStrip','second');
  assert.equal(f.context.photoDialog.open,false);
  assert.deepEqual(JSON.parse(JSON.stringify(f.events)),[{selection:'second',photos:['first','second','fourth'],options:{label:'Journey photos',browseJourney:true}}]);
  f.click('storyMedia','second');
  assert.equal(f.context.photoDialog.open,true);
  assert.equal(f.context.viewerPhotoIndex,1);
});

test('a reel video still opens its player rather than entering the still-photo card',()=>{
  const f=photoEntryFixture(journey);f.click('photoStrip','clip');
  assert.equal(f.context.photoDialog.open,true);
  assert.equal(f.context.viewerPhotoIndex,2);
});

test('both single and clustered map thumbnails select a card; only its large image opens fullscreen',()=>{
  for(const phone of [false,true])for(const count of [1,2]){
    const f=photoBubbleFixture();f.setPhotos(f.photos.slice(0,count));
    f.resize(phone);
    const button=f.draw()[0].element.children[0];
    button.onclick({stopPropagation(){}});
    assert.deepEqual(f.opened,[]);
    assert.equal(f.controller.isOpen(),true);
    assert.equal(f.node('map-photo-card').hidden,false);
    assert.equal(f.node('map-photo-card').dataset.photoId,'a');
    assert.deepEqual(Array.from(f.controller.collection().photos,photo=>photo.id),count===1?['a']:['a','b']);
    f.controller.refresh();assert.equal(f.node('map-photo-card').hidden,false);
    if(count===2){f.node('[data-bubble-next]').onclick();assert.deepEqual(f.opened,[]);}
    f.node('[data-bubble-full]').onclick({detail:0});
    assert.deepEqual(f.opened,[count===1?'a':'b']);
  }
});

test('empty, planned, partial and Places-only journeys communicate their actual content',()=>{
  const describe=globalThis.JOURNEY_ATLAS_UTILS.journeyPresentation;
  const empty={days:[{id:'one',number:1,text:'',tagline:''}],photos:[],places:[],segments:[]};
  assert.equal(describe(empty).entryLabel,'View days');
  assert.equal(describe(empty).hasReplay,false);
  assert.equal(describe(empty).hasContent,false);
  assert.equal(describe({...empty,eventMode:'city'}).entryLabel,'View stops');
  assert.equal(describe({...empty,pointsOfInterest:[{lat:50,lng:14}]}).hasMap,true);
  assert.equal(describe({...empty,videos:[{hidden:true}]}).hasMedia,false);
  assert.equal(describe({...empty,status:'planned',segments:[{distanceKm:120}]}).distanceLabel,'120 km planned');
  assert.equal(describe({...empty,days:[{planningStatus:'tbd'}],segments:[{distanceKm:120},{}]}).distanceLabel,'120 km + distance pending · includes TBD');
  assert.equal(describe({...empty,days:[{text:'Traveler-written story'}]}).hasReplay,true);
});

import vm from 'node:vm';
import {viewerFunction} from './viewer-flow-harness.mjs';
test('phone arrival is one state of the stop card and blank days never promise a story',()=>{
  const nodes=new Map();
  const node=key=>{
    if(!nodes.has(key))nodes.set(key,{hidden:false,dataset:{},style:{},append(child){child.parentElement=this;},before(child){child.parentElement=node('.map-panel');}});
    return nodes.get(key);
  };
  let phone=true;
  const day={id:'one',title:'A long independent city name',date:'1–3 Jan',text:''};
  const context=vm.createContext({$:node,activeDay:()=>day,mapScope:'day',arrivalChapter:{phase:'stay'},window:{matchMedia:()=>({matches:phone})},destinationForDay:()=>null,segmentsForDay:()=>[],photosForDay:()=>[],eventWord:()=> 'stop',modeLabel:()=> 'Train',routeLabel:()=> 'Harbor → Hill'});
  vm.runInContext(viewerFunction('renderArrivalChapter'),context);
  context.renderArrivalChapter();
  assert.equal(node('#arrival-chapter').parentElement,node('.mobile-day-summary'));
  assert.equal(node('.mobile-day-summary').dataset.arrivalTraveling,'false');
  assert.equal(node('#arrival-city').textContent,'View stop');
  context.renderArrivalChapter('arrival');
  assert.equal(node('.mobile-day-summary').dataset.arrivalTraveling,'true');
  assert.equal(node('#arrival-city').textContent,'Skip to city');
  phone=false;context.renderArrivalChapter('stay');
  assert.equal(node('#arrival-chapter').parentElement,node('.map-panel'),'Desktop keeps its existing map arrival surface');
  context.mapScope='journey';context.renderArrivalChapter('stay');
  assert.equal(node('#arrival-chapter').hidden,true);
  assert.equal(node('.mobile-day-summary').dataset.arrivalTraveling,'false');
});

test('Comments navigation preserves the implicit trip roll and explicit Places collections',()=>{
  const f=photoEntryFixture(journey);
  f.open('first');
  f.open('second',{photos:f.photos(),collectionLabel:'Harbor',preserveCollection:true});
  assert.equal(f.context.viewerCollection,null,'Comments must not convert the trip roll into a new collection and reset it on Back');
  assert.equal(f.context.viewerPhotoIndex,1);
  f.open('first',{photos:journey.photos.slice(0,2),collectionLabel:'Saved place'});
  const original=f.context.viewerCollection;
  f.open('second',{photos:f.photos(),collectionLabel:'Saved place',preserveCollection:true});
  assert.equal(f.context.viewerCollection,original);
  assert.equal(f.context.viewerPhotoIndex,1);
});

test('Comments navigation stays on the presenting sidebar or fullscreen surface',()=>{
  const f=photoEntryFixture(journey), options={photos:journey.photos.slice(0,2),collectionLabel:'Harbor',preserveCollection:true};
  f.context.openCommentPhoto('second',options);
  assert.equal(f.context.photoDialog.open,false);
  assert.equal(f.events.at(-1).selection,'second');
  assert.equal(f.events.at(-1).options.label,'Harbor');
  f.open('first');
  f.context.openCommentPhoto('second',options);
  assert.equal(f.context.viewerPhotoIndex,1);
  assert.equal(f.context.viewerCollection,null);
});
