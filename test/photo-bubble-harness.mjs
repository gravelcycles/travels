import fs from 'node:fs';
import vm from 'node:vm';
import '../dist/assets/atlas-utils.js';
export function photoBubbleFixture(journey={id:'trip',days:[{id:'one',number:1,title:'One'},{id:'two',number:2,title:'Two'}]}){
 const nodes=new Map(),events=new Map(),frames=[],stack=[{}],cleared=[],loaded=[],opened=[],mapMarkers=[];let cursor=0,unlocked=true,phone=false,placesOpen=false,ready=false,prompts=0,day=journey.days[0].id,photos=[{id:'a',dayId:'one',lat:47,lng:8,protected:true,width:1200,height:1600},{id:'b',dayId:'one',lat:47,lng:8.001,protected:true},{id:'c',dayId:'two',lat:48,lng:9}];
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
 const controller=window.JOURNEY_ATLAS_PHOTO_BUBBLES.create({journey:()=>journey,photos:()=>photos,dayId:()=>day,map:()=>map,ready:()=>ready,scope:()=> 'day',photoUrl:photo=>photo.id+'.jpg',placesOpen:()=>placesOpen,explore(){},selectPhotoDay:id=>{day=id;controller.refresh();},photoChanged(){},commentsAvailable:()=>true,fullscreen:id=>opened.push(id)});
 return {controller,node,history,loaded,cleared,opened,get prompts(){return prompts;},draw(){ready=true;controller.refresh();while(frames.length)frames.shift()();return mapMarkers.filter(marker=>!marker.removed);},resize(value){phone=value;for(const fn of events.get('resize')||[])fn();},places(value){placesOpen=value;controller.placesChanged();},get day(){return day;},get photos(){return photos;},setPhotos:value=>photos=value,lock(){unlocked=false;for(const fn of events.get('atlas-photos-locked')||[])fn();},unlock(){unlocked=true;for(const fn of events.get('atlas-photos-unlocked')||[])fn();}};
}
