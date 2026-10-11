import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import '../dist/assets/mobile-ux.js';
import {photoEntryFixture, viewerFunction} from './viewer-flow-harness.mjs';

const journey = {
  id:'camera-roll-fixture', eventMode:'city',
  days:[{id:'harbor',number:1,title:'Harbor',photoOrder:['a2','a1']},{id:'transfer',number:2,title:'Transfer'},{id:'hill',number:3,title:'Hill'},{id:'empty',number:4,title:'Empty'}],
  photos:[{id:'b2',dayId:'hill'},{id:'a1',dayId:'harbor'},{id:'a2',dayId:'harbor'},{id:'clip',dayId:'hill',mediaType:'video'}]
};
const {eventPhotoTarget} = globalThis.JOURNEY_ATLAS_MOBILE;

test('phone entry keeps the exact photo in a journey camera roll ordered by event and album',()=>{
  const f=photoEntryFixture(journey,undefined,{mobile:true});
  f.open('b2');
  assert.deepEqual(f.photos().map(photo=>photo.id),['a2','a1','b2','clip']);
  assert.equal(f.context.viewerPhotoIndex,2);
  f.context.moveViewer(-1);
  assert.equal(f.context.viewerDayId,'harbor');
  assert.equal(f.photos()[f.context.viewerPhotoIndex].id,'a1');
  f.context.moveViewer(1);
  assert.equal(f.context.viewerDayId,'hill');
  f.context.moveViewer(1);
  assert.equal(f.photos()[f.context.viewerPhotoIndex].id,'clip','Video remains in its existing media sequence');
  f.context.moveViewer(1);assert.equal(f.context.viewerPhotoIndex,3,'The camera roll does not wrap');
  f.context.openDayViewer('hill',{grid:true});
  assert.equal(f.context.viewerPhotoIndex,2,'A later event grid starts at that event, not the first trip photo');
});

test('event jumps skip empty events and select the destination album first photo',()=>{
  const f=photoEntryFixture(journey,undefined,{mobile:true});f.open('a1');
  f.context.moveViewerDay(1);assert.equal(f.photos()[f.context.viewerPhotoIndex].id,'b2');
  f.context.moveViewerDay(1);assert.equal(f.photos()[f.context.viewerPhotoIndex].id,'b2');
  f.context.moveViewerDay(-1);assert.equal(f.photos()[f.context.viewerPhotoIndex].id,'a2');
  assert.equal(eventPhotoTarget([],journey.days,'harbor',1),null);
  assert.equal(eventPhotoTarget(journey.photos,journey.days,'missing',1),null);
  assert.equal(eventPhotoTarget(journey.photos,journey.days,'hill',0),null);
});

test('phone Places collections and Comments retain explicit order and scope',()=>{
  const f=photoEntryFixture(journey,undefined,{mobile:true});
  f.open('a1');f.context.openCommentPhoto('b2',{photos:f.photos(),collectionLabel:'Journey',preserveCollection:true});
  assert.equal(f.context.viewerCollection,null);
  assert.equal(f.context.viewerPhotoIndex,2);
  const collection=[journey.photos[0],journey.photos[2]];
  f.open('a2',{photos:collection,collectionLabel:'Saved place'});
  assert.deepEqual(f.photos().map(photo=>photo.id),['b2','a2']);
  f.context.moveViewerDay(1);assert.equal(f.context.viewerPhotoIndex,1);
  f.context.openCommentPhoto('b2',{photos:collection,preserveCollection:true});
  assert.equal(f.context.viewerCollection.label,'Saved place');
  assert.equal(f.context.viewerPhotoIndex,0);
});

test('the phone grid shows the current event with camera-roll indices; desktop remains day scoped',()=>{
  const f=photoEntryFixture(journey,undefined,{mobile:true}), nodes=new Map();
  f.open('b2');
  const node=selector=>{if(!nodes.has(selector))nodes.set(selector,{dataset:{},querySelectorAll:()=>[]});return nodes.get(selector);};
  Object.assign(f.context,{$:selector=>selector==='#viewer-filmstrip .active'?null:node(selector),escapeHtml:value=>value||'',photoImageMarkup:photo=>`<img data-photo="${photo.id}"/>`,prepareProgressiveImages(){}});
  vm.runInContext(viewerFunction('renderViewerFilmstrip'),f.context);
  f.context.renderViewerFilmstrip(f.context.viewerPhotos());
  const html=node('#viewer-filmstrip').innerHTML;
  assert.deepEqual([...html.matchAll(/data-viewer-index="(\d+)"/g)].map(match=>Number(match[1])),[2,3]);
  assert.match(html,/photo 1 of 2/);assert.doesNotMatch(html,/data-photo="a[12]"/);
  const desktop=photoEntryFixture(journey);desktop.open('a1');
  assert.deepEqual(desktop.photos().map(photo=>photo.id),['a2','a1']);
  desktop.context.moveViewer(1);assert.equal(desktop.context.viewerPhotoIndex,1);
});

test('thumbnail reveal scrolls only a visible grid and never the fullscreen shell',()=>{
  const photo={id:'selected',dayId:'one'};
  let grid=true, thumbRect={top:920,bottom:1040,left:8,right:132};
  const shell={scrollTop:0,scrollLeft:0};
  const thumb={dataset:{viewerIndex:'0'},classList:{toggle(){}},setAttribute(){},getBoundingClientRect:()=>thumbRect,
    scrollIntoView(){shell.scrollTop=276;assert.fail('Thumbnail reveal must not scroll ancestor surfaces');}};
  const strip={dataset:{album:JSON.stringify([{photo,index:0}])},clientWidth:390,clientHeight:790,scrollTop:300,scrollLeft:0,querySelectorAll:()=>[thumb],
    getBoundingClientRect:()=>({top:54,bottom:844,left:0,right:390})};
  const context=vm.createContext({viewerPhotoIndex:0,viewerCollection:null,viewerDay:()=>({id:'one'}),
    window:{JOURNEY_ATLAS_MOBILE_UI:{enabled:()=>true,gridVisible:()=>grid}},$:selector=>selector==='#viewer-filmstrip'?strip:thumb});
  vm.runInContext(viewerFunction('renderViewerFilmstrip'),context);
  context.renderViewerFilmstrip([photo]);
  assert.equal(strip.scrollTop,496,'A below-fold selection is revealed within the grid');
  thumbRect={top:70,bottom:190,left:8,right:132};context.renderViewerFilmstrip([photo]);
  assert.equal(strip.scrollTop,496,'A fully visible selection does not move');
  grid=false;thumbRect={top:1100,bottom:1220,left:8,right:132};context.renderViewerFilmstrip([photo]);
  assert.equal(strip.scrollTop,496,'The hidden grid cannot scroll during image/city navigation');
  assert.deepEqual(shell,{scrollTop:0,scrollLeft:0});
});

function gestureFixture({scoped=false}={}) {
  const nodes=new Map(), events=new Map();let now=0, index=0, moves=[], controller;
  const photos=[{id:'a1',dayId:'harbor'},{id:'a2',dayId:'harbor'},{id:'b1',dayId:'hill'}];
  const node=selector=>{
    if(!nodes.has(selector))nodes.set(selector,{dataset:{},style:{setProperty(){}},classList:{add(){},remove(){}},clientWidth:390,clientHeight:706,offsetHeight:80,naturalWidth:1200,naturalHeight:800,open:false,handlers:new Map(),
      addEventListener(type,fn){this.handlers.set(type,fn);},setAttribute(name,value){this[name]=value;},removeAttribute(){},append(){},focus(){},setPointerCapture(){},getBoundingClientRect(){return {left:0,top:0,width:390,height:706};},closest:()=>null});
    return nodes.get(selector);
  };
  const update=()=>controller.update({day:journey.days.find(day=>day.id===photos[index].dayId),photos,index,scoped,gridPhotos:photos.filter(photo=>photo.dayId===photos[index].dayId)});
  const api={eventWord:form=>form==='title'?'Stop':form==='plural'?'stops':'stop',day:()=>journey.days.find(day=>day.id===photos[index].dayId),days:()=>journey.days,scope:()=> 'day',collection:()=>scoped?{ids:photos.map(photo=>photo.id)}:null,
    clearImage(){},loadImage(){},move(delta){moves.push(['photo',delta]);index+=delta;update();},moveEvent(delta){const target=eventPhotoTarget(photos,journey.days,photos[index].dayId,delta);if(target){moves.push(['event',delta]);index=target.index;update();}}};
  const context=vm.createContext({window:{addEventListener(type,fn){events.set(type,fn);}},document:{querySelector:node,createElement:()=>node(`image-${nodes.size}`)},matchMedia:query=>({matches:query.includes('900px'),addEventListener(){}}),ResizeObserver:class{observe(){}},
    history:{state:{},replaceState(value){this.state=value;},pushState(value){this.state=value;}},location:{href:'https://example.test'},performance:{now:()=>now},requestAnimationFrame:()=>1,cancelAnimationFrame(){},setTimeout:()=>1,clearTimeout(){}});
  vm.runInContext(fs.readFileSync(new URL('../dist/assets/mobile-ux.js',import.meta.url),'utf8'),context);
  controller=context.window.JOURNEY_ATLAS_MOBILE.create(api);node('#photo-dialog').open=true;update();
  function drag(selector,dx,dy,type='pointerup',target=node(selector)) {
    const currentTarget=node(selector),event={pointerId:1,button:0,clientX:200,clientY:350,target,currentTarget};
    currentTarget.handlers.get('pointerdown')(event);now+=500;
    currentTarget.handlers.get('pointermove')({...event,clientX:200+dx,clientY:350+dy});
    currentTarget.handlers.get(type)({...event,type,clientX:200+dx,clientY:350+dy});
  }
  return {node,drag,get index(){return index;},moves};
}

test('image swipes browse individual photos across cities; header swipes jump cities',()=>{
  const f=gestureFixture();f.drag('.photo-stage',-140,0);assert.equal(f.index,1);
  f.drag('.photo-stage',-140,0);assert.equal(f.index,2);
  f.drag('.mobile-photo-event-nav',140,0);assert.equal(f.index,0);
  f.drag('.mobile-photo-event-nav',-140,0);assert.equal(f.index,2);
  assert.deepEqual(f.moves,[['photo',1],['photo',1],['event',-1],['event',1]]);
  assert.equal(f.node('#mobile-photo-next-event').disabled,true);
  assert.match(f.node('#mobile-photo-previous-event')['aria-label'],/Previous city · Harbor/);
  assert.equal(f.node('#mobile-grid-title').textContent,'1 photo');
  assert.equal(f.node('#mobile-photo-count').textContent,'3 of 3');
});

test('header swipes ignore button starts, cancellation, vertical drags, diagonals and explicit collections',()=>{
  const f=gestureFixture();
  f.drag('.mobile-photo-event-nav',-140,0,'pointercancel');
  f.drag('.mobile-photo-event-nav',0,-140);
  f.drag('.mobile-photo-event-nav',-140,-140);
  f.drag('.mobile-photo-event-nav',-140,0,'pointerup',{closest:()=>({})});
  assert.equal(f.index,0);assert.deepEqual(f.moves,[]);
  const collection=gestureFixture({scoped:true});collection.drag('.mobile-photo-event-nav',-140,0);
  assert.equal(collection.node('.mobile-photo-event-nav').hidden,true);
  assert.deepEqual(collection.moves,[]);
});
