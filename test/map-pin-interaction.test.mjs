import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code=fs.readFileSync(new URL('../dist/assets/location-labels.js',import.meta.url),'utf8');
function fixture({routes=[]}={}){
  const timers=new Map(),frames=[],markers=[],preview=[],selected=[];let timer=0;
  class Element {
    constructor(tag){this.tagName=tag;this.children=[];this.attrs={};this.listeners=new Map();this.dataset={};this.className='';this.style={setProperty(k,v){this[k]=v;}};this.clientWidth=800;this.clientHeight=600;this.offsetWidth=216;this.offsetHeight=110;this.isConnected=true;const classes=new Set();this.classList={toggle:(name,on)=>on?classes.add(name):classes.delete(name),contains:name=>classes.has(name)};}
    setAttribute(k,v){this.attrs[k]=v;} removeAttribute(k){delete this.attrs[k];} getAttribute(k){return this.attrs[k];}
    addEventListener(k,fn){this.listeners.set(k,fn);} removeEventListener(k){this.listeners.delete(k);}
    append(...items){for(const item of items){item.parent=this;this.children.push(item);}}
    remove(){this.isConnected=false;if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);}
    contains(item){return this===item||this.children.some(child=>child.contains(item));}
    querySelector(selector){return this.children.find(child=>selector==='button'?child.tagName==='button':child.className===selector.slice(1))||this.children.map(child=>child.querySelector(selector)).find(Boolean);}
    getBoundingClientRect(){const coordinate=this.parent?.coordinate;if(coordinate){const x=100+coordinate[0],y=100+coordinate[1]+parseFloat(this.style['--pin-y']),height=parseFloat(this.style['--pin-height']);return {left:x-16,top:y-height/2,right:x+16,bottom:y+height/2,width:32,height};}return {left:100,top:100,bottom:700,right:900,width:800,height:600};}
    focus(){document.activeElement=this;this.listeners.get('focus')?.({target:this});}
  }
  const document=new Element('document');document.documentElement={dataset:{inputMode:'pointer'}};document.createElement=tag=>new Element(tag);
  const container=new Element('container'), events=new Map();
  const map={getContainer:()=>container,project:([x,y])=>({x,y}),isMoving:()=>false,on:(name,fn)=>events.set(name,fn),off:name=>events.delete(name)};
  const maplibregl={Marker:class{constructor({element}){this.element=element;markers.push(this);}setLngLat(coordinate){this.coordinate=coordinate;this.element.coordinate=coordinate;return this;}addTo(){container.append(this.element);return this;}remove(){this.element.remove();}}};
  const context=vm.createContext({document,matchMedia:query=>({matches:query.includes('hover: hover')}),requestAnimationFrame:fn=>{frames.push(fn);return frames.length;},cancelAnimationFrame(){},setTimeout:fn=>{timers.set(++timer,fn);return timer;},clearTimeout:id=>timers.delete(id)});
  vm.runInContext(code,context);
  let controller;
  controller=context.JOURNEY_ATLAS_LOCATION_LABELS.create({map,maplibregl,onSelectDay:id=>selected.push(id),onPreviewDays:ids=>{preview.push([...ids]);controller.setPreview(ids);}});
  const groups=[{key:'a',name:'A',coordinate:[200,200],selected:true,days:[{id:'day1',number:1,date:'1 May',title:'Arrival'}]},
    {key:'b',name:'B',coordinate:[500,300],selected:false,days:[{id:'day2',number:2,date:'2 May'},{id:'day3',number:3,date:'3 May'}]}];
  controller.update(groups,routes);frames.shift()();
  const fire=(element,type,extra={})=>element.listeners.get(type)?.({target:element,pointerType:'mouse',stopPropagation(){},...extra});
  const flush=()=>{const pending=[...timers.values()];timers.clear();pending.forEach(fn=>fn());};
  return {controller,document,container,markers,preview,selected,events,fire,flush,timers};
}

test('pin hover previews immediately, opens one delayed card, and touch taps a single day directly',()=>{
  const f=fixture(),button=f.markers[0].element.children[0];
  f.fire(button,'pointerenter');assert.deepEqual(f.preview.at(-1),["day1"]);
  f.flush();assert.ok(f.container.querySelector('.map-place-card'));
  f.fire(button,'click');assert.deepEqual(f.selected,['day1']);assert.equal(f.container.querySelector('.map-place-card'),undefined);
  f.flush();assert.equal(f.container.querySelector('.map-place-card'),undefined,'No abandoned timer can reopen a card after selection');
});

test('repeat dots open explicit day choices; Escape restores focus and cancels reopening',()=>{
  const f=fixture(),button=f.markers[1].element.children[0];
  f.fire(button,'pointerenter',{pointerType:'touch'});assert.equal(f.preview.length,0,'Touch has no hover');
  f.fire(button,'click');const card=f.container.querySelector('.map-place-card');assert.equal(card.getAttribute('role'),'dialog');
  const visits=card.querySelector('.map-place-visits');assert.equal(visits.children.length,2);
  f.document.documentElement.dataset.inputMode='keyboard';
  f.fire(f.document,'keydown',{key:'Escape'});f.flush();
  assert.equal(f.document.activeElement,button);assert.equal(f.container.querySelector('.map-place-card'),undefined);
  f.fire(button,'click');f.fire(f.container.querySelector('.map-place-visits').children[1],'click');assert.deepEqual(f.selected,['day3']);
});

test('cards remain usable across pointer handoff and map movement dismisses previews',()=>{
  const f=fixture(),button=f.markers[0].element.children[0];
  f.fire(button,'pointerenter');f.flush();f.fire(button,'pointerleave');
  const card=f.container.querySelector('.map-place-card');f.fire(card,'pointerenter');f.flush();
  assert.equal(f.container.querySelector('.map-place-card'),card);
  f.events.get('movestart')();assert.equal(f.container.querySelector('.map-place-card'),undefined);
  f.controller.destroy();assert.equal(f.events.size,0);assert.equal(f.timers.size,0);
});

test('linked cards persist on pointer handoff but close for explicit route inspection',()=>{
  const f=fixture();f.controller.setPreview(['day1'],{show:true});
  const card=f.container.querySelector('.map-place-card');assert.ok(card);
  f.controller.setPreview(['day1'],{preserveCard:true});assert.equal(f.container.querySelector('.map-place-card'),card);
  f.controller.setPreview(['day1']);assert.equal(f.container.querySelector('.map-place-card'),undefined);
});

test('the compact card chooses space below the pin when its previewed route runs above',()=>{
  const f=fixture({routes:[{coordinates:[[140,120],[260,120]],padding:3,dayIds:['day1']}]});
  f.controller.setPreview(['day1'],{show:true});
  const card=f.container.querySelector('.map-place-card');
  assert.ok(parseFloat(card.style.top)>=206,'Keep the route above visible and leave a gap beneath the pin');
});
