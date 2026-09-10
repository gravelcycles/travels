import test from 'node:test';
import assert from 'node:assert/strict';
import '../dist/assets/mobile-ux.js';
const {gestureAxis, swipeStep, panLimit} = globalThis.JOURNEY_ATLAS_MOBILE;

test('photo gestures wait for a clear direction instead of choosing on taps or diagonals', () => {
  assert.equal(gestureAxis(7, 3), null);
  assert.equal(gestureAxis(45, 44), null);
  assert.equal(gestureAxis(-45, 12), 'x');
  assert.equal(gestureAxis(12, -45), 'y');
  assert.equal(gestureAxis(-12, 45), 'y');
});

test('swipes accept deliberate distance or a quick flick but reject small slow drags', () => {
  assert.equal(swipeStep(-120, 900, 390, 1, 21), 1);
  assert.equal(swipeStep(120, 900, 390, 1, 21), -1);
  assert.equal(swipeStep(-40, 60, 390, 1, 21), 1);
  assert.equal(swipeStep(-40, 600, 390, 1, 21), 0);
  assert.equal(swipeStep(-15, 10, 390, 1, 21), 0);
});

test('album boundaries never wrap or skip into a different day, including empty albums', () => {
  assert.equal(swipeStep(180, 200, 320, 0, 21), 0);
  assert.equal(swipeStep(-180, 200, 320, 20, 21), 0);
  assert.equal(swipeStep(-180, 200, 320, 0, 1), 0);
  assert.equal(swipeStep(180, 200, 320, 0, 0), 0);
  assert.equal(swipeStep(-75, 400, 320, 0, 2), 1);
});

test('zoom panning stays inside the photograph and does not move letterboxed axes', () => {
  assert.equal(panLimit(390, 1, 390), 0);
  assert.equal(panLimit(390, 2, 390), 195);
  assert.equal(panLimit(292, 2, 706), 0);
  assert.equal(panLimit(292, 4, 706), 231);
});

import vm from 'node:vm';
import fs from 'node:fs';
function viewerFixture() {
  const nodes = new Map(), events = new Map(), timers = new Map();
  let clock = 0, timer = 0, controller;
  function node(selector) {
    if (!nodes.has(selector)) nodes.set(selector, {
      dataset:{},style:{setProperty(){}},classList:{add(){},remove(){}},clientWidth:390,clientHeight:706,offsetHeight:160,
      open:false,hidden:false,handlers:new Map(),textContent:'',inert:false,
      setAttribute(name,value){this[name]=value;},removeAttribute(name){delete this[name];},append(){},focus(){},setPointerCapture(){},
      querySelectorAll(){return [];},closest(){return null;},
      addEventListener(name,fn){this.handlers.set(name,fn);},
      showModal(){this.open=true;},close(){this.open=false;controller?.closed();}
    });
    return nodes.get(selector);
  }
  const days=[{id:'one',number:1,date:'Today',title:'One'},{id:'two',number:2,date:'Tomorrow',title:'Two'}];
  const photos=[0,1,2].map(i=>({id:`p${i}`,lng:8+i,lat:47}));
  let day=days[0], index=0, locations=0;
  const stack=[{}]; let cursor=0;
  const history={get state(){return stack[cursor];},replaceState(state){stack[cursor]=structuredClone(state);},pushState(state){stack.splice(++cursor);stack[cursor]=structuredClone(state);},back(){this.go(-1);},go(delta){cursor=Math.max(0,Math.min(stack.length-1,cursor+delta));events.get('popstate')?.({state:this.state});}};
  const api={day:()=>day,days:()=>days,scope:()=> 'day',title:()=> 'Journey',dayInfo:()=>({route:'Route',meta:'Train',count:3}),
    tab:value=>{node('.atlas-shell').dataset.mobileTab=value;},selectDay:id=>{day=days.find(d=>d.id===id);},preview(){},stepDay(){},album(){},overview(){},replay(){},
    location(){locations++;},clearImage(){},loadImage(){},
    move(delta){index+=delta;update();},selectPhoto(value){index=value;update();},
    openDay(id=day.id){controller.open();day=days.find(d=>d.id===id);index=0;node('#photo-dialog').open=true;update();}};
  const context=vm.createContext({window:{addEventListener:(name,fn)=>events.set(name,fn)},document:{querySelector:node,createElement:()=>node(`image${nodes.size}`)},
    matchMedia:query=>({matches:query.includes('900px'),addEventListener(){}}),ResizeObserver:class{observe(){}},
    history,location:{href:'https://example.test/day'},performance:{now:()=>clock},requestAnimationFrame:fn=>fn(),
    setTimeout:fn=>{timers.set(++timer,fn);return timer;},clearTimeout:id=>timers.delete(id)});
  vm.runInContext(fs.readFileSync(new URL('../dist/assets/mobile-ux.js',import.meta.url),'utf8'),context);
  controller=context.window.JOURNEY_ATLAS_MOBILE.create(api);
  function update(){controller.update({day,photos,index});}
  function drag(selector,dx,dy,elapsed=500,type='pointerup') {
    const target=node(selector),event={pointerId:1,button:0,clientX:200,clientY:350,target,currentTarget:target};
    target.handlers.get('pointerdown')(event);clock+=elapsed;
    target.handlers.get('pointermove')({...event,clientX:200+dx,clientY:350+dy});
    target.handlers.get(type)({...event,type,clientX:200+dx,clientY:350+dy});
  }
  return {api,node,controller,history,drag,get index(){return index;},get locations(){return locations;},flush(){const work=[...timers.values()];timers.clear();work.forEach(fn=>fn());}};
}

test('swiping, opening location and returning from it keep the same selected photo',()=>{
  const f=viewerFixture();f.api.openDay();f.drag('.photo-stage',-150,4);f.flush();assert.equal(f.index,1);
  f.drag('.photo-stage',3,-150);assert.equal(f.locations,1);assert.equal(f.history.state.mobileAtlas.layer,'location');
  assert.equal(f.node('#photo-map').handlers.size,0,'photo gestures must not intercept the map');
  f.drag('.photo-location-heading',3,150);assert.equal(f.history.state.mobileAtlas.layer,'photo');assert.equal(f.index,1);
  assert.equal(f.node('#photo-location-panel').inert,true);
});

test('cancelled and ambiguous drags settle without navigating or opening location',()=>{
  const f=viewerFixture();f.api.openDay();
  f.drag('.photo-stage',-150,4,500,'pointercancel');f.flush();assert.equal(f.index,0);
  f.drag('.photo-stage',-80,-80);f.flush();assert.equal(f.index,0);assert.equal(f.locations,0);
  f.drag('.photo-stage',2,-160,500,'pointercancel');assert.equal(f.locations,0);assert.equal(f.node('#photo-location-panel').inert,true);
});

test('a queued swipe cannot advance a newly opened album after the old viewer closes',()=>{
  const f=viewerFixture();f.api.openDay();f.drag('.photo-stage',-160,0);
  f.node('#photo-dialog').close();f.api.openDay('two');f.flush();assert.equal(f.index,0);
});

test('closing the grid returns to its selected image and closing nested layers exits the viewer',()=>{
  const f=viewerFixture();f.api.openDay();f.node('#mobile-photo-grid').onclick();
  f.api.selectPhoto(2);f.controller.gridSelected();assert.equal(f.index,2);assert.equal(f.node('.photo-viewer').dataset.grid,'false');
  f.node('#mobile-photo-location').onclick();f.node('#mobile-photo-grid').onclick();
  f.node('#mobile-grid-close').onclick();assert.equal(f.node('#photo-dialog').open,false);
});
