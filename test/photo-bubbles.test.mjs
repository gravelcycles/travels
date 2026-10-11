import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import '../dist/assets/atlas-utils.js';
function fixture(){
 const nodes=new Map(),events=new Map(),frames=[],stack=[{}],cleared=[],loaded=[],opened=[],mapMarkers=[];let cursor=0,unlocked=true,phone=false,placesOpen=false,ready=false,prompts=0,day='one',points=[],photos=[{id:'a',dayId:'one',lat:47,lng:8,protected:true,width:1200,height:1600},{id:'b',dayId:'one',lat:47,lng:8.001,protected:true},{id:'c',dayId:'two',lat:48,lng:9}];
 function node(key){if(nodes.has(key))return nodes.get(key);const listeners=new Map(),value={tagName:key==='img'?'IMG':'DIV',children:[],dataset:{},style:{setProperty(name,value){this[name]=value;}},hidden:false,src:'',isConnected:true,clientWidth:800,clientHeight:600,
 classList:{toggle(){},add(){},remove(){}},removeAttribute(name){delete this[name];},setAttribute(name,v){this[name]=v;},querySelector:name=>node(name),querySelectorAll:()=>[],append(...children){for(const child of children)child.parentElement=this;this.children.push(...children);},before(child){child.parentElement=node(key==='.mobile-day-summary'?'.map-panel':'.story-panel');child.position='before';},after(child){child.parentElement=node('.story-panel');child.position='after';},getBoundingClientRect:()=>({left:0,top:0}),focus(){document.activeElement=this;},getClientRects:()=>[{}],
 addEventListener(name,fn){listeners.set(name,fn);},fire(name,event){listeners.get(name)?.(event);}};nodes.set(key,value);return value;}
 const document={getElementById:node,querySelector:node,querySelectorAll:()=>[],createElement:tag=>node(`${tag}-${nodes.size}`),body:node('body'),activeElement:null};
 const history={get state(){return stack[cursor];},pushState(value){stack.splice(++cursor);stack[cursor]=structuredClone(value);},replaceState(value){stack[cursor]=structuredClone(value);},back(){cursor=Math.max(0,cursor-1);for(const listener of events.get('popstate')||[])listener({state:this.state});}};
 const map={resize(){},on(){},off(){},getContainer:()=>node('map'),getZoom:()=>12,project:([lng,lat])=>({x:200+(lng-(day==='one'?8:9))*1000,y:200+(lat-(day==='one'?47:48))*1000}),easeTo(){}};
 const window={JOURNEY_ATLAS_UTILS:globalThis.JOURNEY_ATLAS_UTILS,addEventListener(name,fn){if(!events.has(name))events.set(name,[]);events.get(name).push(fn);},JOURNEY_ATLAS_AUTH:{get unlocked(){return unlocked;},isProtected:photo=>photo.protected,setImage(image,photo){loaded.push(photo.id);image.src='blob:'+photo.id;},clearImage(image){cleared.push(image);},showPrompt(){prompts++;}}};
 window.maplibregl={Marker:class{
  constructor({element}){this.element=element;mapMarkers.push(this);}
  getElement(){return this.element;}
  setLngLat(position){this.position=position;return this;}
  addTo(){return this;}
  remove(){this.removed=true;}
 }};
 const context=vm.createContext({window,document,history,location:{href:'https://example.test/'},CSS:{escape:v=>v},matchMedia:()=>({matches:phone}),requestAnimationFrame:fn=>{frames.push(fn);return frames.length;}});
 for(const file of ['photo-places.js','photo-bubbles.js'])vm.runInContext(fs.readFileSync(new URL(`../dist/assets/${file}`,import.meta.url),'utf8'),context);
 const controller=window.JOURNEY_ATLAS_PHOTO_BUBBLES.create({journey:()=>({id:'trip',days:[{id:'one',number:1,title:'One'},{id:'two',number:2,title:'Two'}],pointsOfInterest:points}),photos:()=>photos,dayId:()=>day,map:()=>map,ready:()=>ready,scope:()=> 'day',photoUrl:photo=>photo.id+'.jpg',placesOpen:()=>placesOpen,explore(){},selectPhotoDay:id=>{day=id;controller.refresh();},photoChanged(){},commentsAvailable:()=>true,fullscreen:id=>opened.push(id)});
 return {controller,node,history,loaded,cleared,opened,get prompts(){return prompts;},draw(){ready=true;controller.refresh();while(frames.length)frames.shift()();return mapMarkers.filter(marker=>!marker.removed);},resize(value){phone=value;for(const fn of events.get('resize')||[])fn();},places(value){placesOpen=value;controller.placesChanged();},get day(){return day;},get photos(){return photos;},setPhotos:value=>photos=value,lock(){unlocked=false;for(const fn of events.get('atlas-photos-locked')||[])fn();},unlock(){unlocked=true;for(const fn of events.get('atlas-photos-unlocked')||[])fn();}};
}
test('real bubble controller preserves selection across refresh and restores previous history on close',()=>{
 const f=fixture();f.controller.open(f.photos.slice(0,2),'b');assert.equal(f.node('map-photo-card').dataset.photoId,'b');assert.equal(f.node('[data-bubble-count]').textContent,'2 / 2');
 f.controller.refresh();assert.equal(f.node('map-photo-card').dataset.photoId,'b');f.node('[data-bubble-prev]').onclick();assert.equal(f.node('map-photo-card').dataset.photoId,'a');
 f.node('[data-bubble-close]').onclick();assert.equal(f.node('map-photo-card').hidden,true);assert.equal(f.controller.isOpen(),false);assert.equal(f.node('img').src,undefined);
});
test('auth expiry clears protected card pixels and unlock restores through the auth loader',()=>{
 const f=fixture();f.controller.open(f.photos.slice(0,2));assert.equal(f.node('img').src,'blob:a');f.lock();assert.equal(f.node('img').src,undefined);assert.equal(f.node('img').hidden,true);assert.equal(f.node('[data-bubble-unlock]').hidden,false);
 f.unlock();assert.equal(f.node('img').src,'blob:a');assert.ok(f.cleared.length);assert.equal(f.node('[data-bubble-unlock]').hidden,true);
});
test('cross-day linked selection follows the photo day without discarding group order; filter removal cannot show stale content',()=>{
 const f=fixture();f.controller.open([f.photos[0],f.photos[2]]);f.node('[data-bubble-next]').onclick();assert.equal(f.day,'two');assert.equal(f.node('map-photo-card').dataset.photoId,'c');assert.equal(f.node('[data-bubble-count]').textContent,'2 / 2');
 f.setPhotos([f.photos[0]]);f.controller.refresh();assert.equal(f.node('map-photo-card').dataset.photoId,'a');assert.equal(f.day,'one');assert.equal(f.node('[data-bubble-count]').textContent,'1 / 1');f.setPhotos([]);f.controller.refresh();assert.equal(f.node('map-photo-card').hidden,true);
});

test('desktop selection stays inside the existing album sidebar through Places and responsive changes',()=>{
 const f=fixture(),card=f.node('map-photo-card');
 f.node('.story-panel').scrollTop=400;
 f.controller.open(f.photos.slice(0,2),'b');
 assert.equal(card.parentElement,f.node('.story-album-entry'));
 assert.equal(f.node('.story-panel').scrollTop,0);
 assert.equal(f.node('sidebar-day-details').open,false);
 assert.equal(f.node('.photo-section').position,'before');
 f.places(true);assert.equal(card.hidden,true);
 f.places(false);assert.equal(card.hidden,false);assert.equal(card.dataset.photoId,'b');
 f.resize(true);assert.equal(card.parentElement,f.node('.map-panel'));
 assert.equal(f.node('sidebar-day-details').open,true);assert.equal(f.node('.photo-section').position,'after');
 assert.equal(card.dataset.photoId,'b');assert.equal(f.node('[data-bubble-count]').textContent,'2 / 2');
 f.resize(false);assert.equal(card.parentElement,f.node('.story-album-entry'));
 f.controller.close();assert.equal(card.hidden,true);
 assert.equal(card.parentElement,f.node('.story-album-entry'));
});

test('the photo button opens the selected photo with mouse or keyboard, while swipes only browse',()=>{
 const f=fixture(),button=f.node('[data-bubble-full]');
 f.controller.open(f.photos.slice(0,2));
 button.onclick({detail:1});assert.deepEqual(f.opened,['a']);
 button.fire('pointerdown',{clientX:100,clientY:50,pointerId:1});
 button.fire('pointerup',{clientX:20,clientY:52,pointerId:1});
 let prevented=false;button.onclick({detail:1,preventDefault(){prevented=true;}});
 assert.equal(prevented,true);assert.deepEqual(f.opened,['a']);
 assert.equal(f.node('map-photo-card').dataset.photoId,'b');
 button.onclick({detail:0});assert.deepEqual(f.opened,['a','b']);
 f.lock();button.onclick({detail:0});assert.equal(f.prompts,1);assert.deepEqual(f.opened,['a','b']);
});
test('scrolling or cancelled touches cannot accidentally open full screen',()=>{
 const f=fixture(),button=f.node('[data-bubble-full]');f.controller.open(f.photos.slice(0,2));
 for(const cancel of [false,true]){
  button.fire('pointerdown',{clientX:20,clientY:20,pointerId:1});
  if(cancel)button.fire('pointercancel',{});
  else button.fire('pointerup',{clientX:22,clientY:100,pointerId:1});
  button.onclick({detail:1,preventDefault(){}});
 }
 assert.deepEqual(f.opened,[]);assert.equal(f.node('map-photo-card').dataset.photoId,'a');
 button.fire('pointerdown',{clientX:20,clientY:20,pointerId:2});
 button.fire('pointerup',{clientX:21,clientY:22,pointerId:2});
 button.onclick({detail:1});assert.deepEqual(f.opened,['a']);
});
test('portraits use their own proportions and blank captions never repeat accessibility text',()=>{
 const f=fixture();f.photos[0].alt='Accessibility only';f.controller.open(f.photos.slice(0,1));
 assert.equal(f.node('map-photo-card').style['--selected-photo-ratio'],'0.75');
 assert.equal(f.node('[data-bubble-caption]').textContent,'');assert.equal(f.node('[data-bubble-caption]').hidden,true);
});
test('browsing a selection keeps each map thumbnail tied to its anchor and filters cross-day members',()=>{
 const f=fixture();f.controller.open(f.photos.slice(0,2));
 let markers=f.draw();assert.equal(markers.length,1);
 assert.equal(markers[0].element.children[0].children[1].src,'blob:a');
 f.node('[data-bubble-next]').onclick();markers=f.draw();
 assert.equal(markers[0].element.children[0].children[1].src,'blob:a','The map anchor must not turn into the currently browsed photo');
 f.controller.open([f.photos[0],f.photos[2]]);f.node('[data-bubble-next]').onclick();markers=f.draw();
 assert.equal(markers.length,1);assert.deepEqual(Array.from(markers[0].position),[9,48]);
 assert.equal(markers[0].element.children[0].children[1].src,'c.jpg');
});

test('album browsing does not collapse the day map into a selected bubble',()=>{
 const f=fixture();f.setPhotos([...f.photos,{id:'d',dayId:'one',lng:8.4,lat:47}]);
 assert.equal(f.draw().length,2);
 f.controller.open(f.photos.filter(photo=>photo.dayId==='one'),'d');
 const markers=f.draw();assert.equal(markers.length,2);
 assert.deepEqual(markers.map(marker=>marker.element.children[0].children[1].src),['blob:a','d.jpg']);
});
