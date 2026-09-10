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
function viewerFixture({deferredHistory=false} = {}) {
  const nodes = new Map(), events = new Map(), timers = new Map(), frames = new Map(), traversals = [], queries = new Map();
  let clock = 0, timer = 0, controller;
  function node(selector) {
    if (!nodes.has(selector)) nodes.set(selector, {
      dataset:{},style:{setProperty(name,value){this[name]=value;}},classList:{names:new Set(),add(name){this.names.add(name);},remove(name){this.names.delete(name);},contains(name){return this.names.has(name);}},getBoundingClientRect(){return {width:390,height:706};},clientWidth:390,clientHeight:706,offsetHeight:160,
      open:false,hidden:false,handlers:new Map(),captures:new Map(),textContent:'',inert:false,
      setAttribute(name,value){this[name]=value;},removeAttribute(name){delete this[name];},append(child){child.parentElement=this;},focus(){},setPointerCapture(){},
      querySelectorAll(){return [];},closest(query){return selector.startsWith('#mobile-') && (query==='button' || query==='button:not(#mobile-photo-location)' && selector!=='#mobile-photo-location')?this:null;},
      addEventListener(name,fn,capture){(capture?this.captures:this.handlers).set(name,fn);},
      showModal(){this.open=true;},close(){this.open=false;controller?.closed();}
    });
    return nodes.get(selector);
  }
  const days=[{id:'one',number:1,date:'Today',title:'One'},{id:'two',number:2,date:'Tomorrow',title:'Two'}];
  const photos=[0,1,2].map(i=>({id:`p${i}`,lng:8+i,lat:47}));
  let day=days[0], index=0, locations=0, pauses=0, tabs=0;
  const stack=[{}]; let cursor=0;
  const history={get state(){return stack[cursor];},replaceState(state){stack[cursor]=structuredClone(state);},pushState(state){stack.splice(++cursor);stack[cursor]=structuredClone(state);},back(){this.go(-1);},go(delta){const traverse=()=>{cursor=Math.max(0,Math.min(stack.length-1,cursor+delta));events.get('popstate')?.({state:this.state});};if(deferredHistory)traversals.push(traverse);else traverse();}};
  const api={day:()=>day,days:()=>days,scope:()=> 'day',title:()=> 'Journey',dayInfo:()=>({route:'Route',meta:'Train',count:3}),
    tab:value=>{tabs++;node('.atlas-shell').dataset.mobileTab=value;},selectDay:id=>{day=days.find(d=>d.id===id);},preview(){},stepDay(){},album(){},overview(){},replay(){},
    location(){locations++;},pauseLocation(){pauses++;},clearImage(){},loadImage(){},
    move(delta){index+=delta;update();},selectPhoto(value){index=value;update();},
    openDay(id=day.id){controller.open();day=days.find(d=>d.id===id);index=0;node('#photo-dialog').open=true;update();}};
  const context=vm.createContext({window:{addEventListener:(name,fn)=>events.set(name,fn)},document:{querySelector:node,createElement:()=>node(`image${nodes.size}`)},
    matchMedia:query=>{if(!queries.has(query))queries.set(query,{matches:query.includes('900px'),addEventListener(_name,fn){this.changed=fn;}});return queries.get(query);},ResizeObserver:class{observe(){}},
    history,location:{href:'https://example.test/day'},performance:{now:()=>clock},requestAnimationFrame:fn=>{frames.set(++timer,fn);return timer;},cancelAnimationFrame:id=>frames.delete(id),
    setTimeout:fn=>{timers.set(++timer,fn);return timer;},clearTimeout:id=>timers.delete(id)});
  vm.runInContext(fs.readFileSync(new URL('../dist/assets/mobile-ux.js',import.meta.url),'utf8'),context);
  node('.atlas-shell').dataset.mobileTab='map';
  controller=context.window.JOURNEY_ATLAS_MOBILE.create(api);
  function update(){controller.update({day,photos,index});}
  function drag(selector,dx,dy,elapsed=500,type='pointerup') {
    const target=node(selector),event={pointerId:1,button:0,clientX:200,clientY:350,target,currentTarget:target};
    target.handlers.get('pointerdown')(event);clock+=elapsed;
    target.handlers.get('pointermove')({...event,clientX:200+dx,clientY:350+dy});
    target.handlers.get(type)({...event,type,clientX:200+dx,clientY:350+dy});
  }
  function click(selector,surface=selector,{synthetic=false,keyboard=false}={}) {
    const target=node(selector),currentTarget=node(surface);
    const event={target,currentTarget,pointerId:1,button:0,clientX:180,clientY:350,detail:keyboard?0:1,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;}};
    if(!synthetic && !keyboard){currentTarget.handlers.get('pointerdown')?.(event);currentTarget.handlers.get('pointerup')?.({...event,type:'pointerup'});}
    currentTarget.captures.get('click')?.(event);
    if(!event.stopped){currentTarget.handlers.get('click')?.(event);target.onclick?.(event);}
    return event;
  }
  return {api,node,controller,history,drag,click,resize(mobile){const query=queries.get('(max-width: 900px)');query.matches=mobile;query.changed();},get tabs(){return tabs;},get pauses(){return pauses;},flushHistory(){while(traversals.length)traversals.shift()();},get index(){return index;},get locations(){return locations;},flush(){const raf=[...frames.values()];frames.clear();raf.forEach(fn=>fn());const work=[...timers.values()];timers.clear();work.forEach(fn=>fn());}};
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

test('visual swipe settling cannot advance a newly opened album after the old viewer closes',()=>{
  const f=viewerFixture();f.api.openDay();f.drag('.photo-stage',-160,0);
  f.node('#photo-dialog').close();f.api.openDay('two');f.flush();assert.equal(f.index,0);
});

test('closing the grid returns to its selected image and closing nested layers exits the viewer',()=>{
  const f=viewerFixture();f.api.openDay();f.node('#mobile-photo-grid').onclick();
  f.api.selectPhoto(2);f.controller.gridSelected();assert.equal(f.index,2);assert.equal(f.node('.photo-viewer').dataset.grid,'false');
  f.node('#mobile-photo-location').onclick();f.node('#mobile-photo-grid').onclick();
  f.node('#mobile-grid-close').onclick();assert.equal(f.node('#photo-dialog').open,false);
});


test('a quick location-close tap after dragging is accepted, and the next swipe leaves it closed',()=>{
  const f=viewerFixture();f.api.openDay();f.drag('.photo-stage',0,-180);
  const close=f.click('#mobile-location-close','.photo-location-heading');
  assert.equal(close.prevented,undefined);assert.equal(f.controller.locationVisible(),false);
  f.drag('.photo-stage',-140,2);assert.equal(f.index,1,'selection changes when the swipe ends');
  assert.equal(f.node('.photo-viewer').dataset.locationVisible,'false');assert.equal(f.pauses,1);
});

test('discard the synthetic drag click without blocking a fresh location-toggle tap',()=>{
  const f=viewerFixture();f.api.openDay();f.drag('#mobile-photo-location',0,-180);
  assert.equal(f.click('#mobile-photo-location','#mobile-photo-location',{synthetic:true}).prevented,true);
  assert.equal(f.controller.locationVisible(),true);
  assert.equal(f.click('#mobile-photo-location').prevented,undefined);
  assert.equal(f.controller.locationVisible(),false);
});

test('single taps never hide controls; double taps still zoom',()=>{
  const f=viewerFixture();f.api.openDay();f.click('.photo-stage');
  assert.equal(f.node('.photo-viewer').dataset.chrome,'true');
  f.click('.photo-stage');assert.match(f.node('#modal-photo').style.transform,/scale\(2\)/);
  assert.equal(f.node('.photo-viewer').dataset.chrome,'true');
});

test('a delayed history response to closing location cannot restart it or animate the next drag',()=>{
  const f=viewerFixture({deferredHistory:true});f.api.openDay();f.drag('.photo-stage',0,-180);
  f.click('#mobile-location-close','.photo-location-heading');f.drag('.photo-stage',-140,0);
  f.flushHistory();assert.equal(f.index,1);assert.equal(f.controller.locationVisible(),false);
  assert.equal(f.node('.photo-viewer').classList.contains('is-location-settling'),false);
  assert.equal(f.tabs,0,'nested photo navigation must not refit the background day map');
});

test('consecutive swipes advance immediately instead of dropping input during a timer',()=>{
  const f=viewerFixture();f.api.openDay();f.drag('.photo-stage',-150,0);assert.equal(f.index,1);
  f.drag('.photo-stage',-150,0);assert.equal(f.index,2);f.flush();assert.equal(f.index,2);
});

test('Photos opens the day grid, while Back and Close leave every photo layer for the day',()=>{
  for(const control of ['#mobile-photo-back','#mobile-photo-close','#mobile-grid-back','#mobile-grid-close']){
    const f=viewerFixture();f.controller.openGrid('one');assert.equal(f.node('.photo-viewer').dataset.grid,'true');
    if(control.startsWith('#mobile-photo-')){f.api.selectPhoto(1);f.controller.gridSelected();f.click('#mobile-photo-location');}
    f.node(control).onclick();assert.equal(f.node('#photo-dialog').open,false,control);
    assert.equal(f.node('.atlas-shell').dataset.mobileTab,'map',control);
  }
});

test('Replay shows one mobile media view and falls back to the map when a moment has no photo',()=>{
  const f=viewerFixture();f.node('#replay-dialog').open=true;
  f.controller.replayControlsChanged({playing:true,completed:false,day:f.api.day()});
  f.node('#replay-view-photos').onclick();
  assert.equal(f.controller.replayMapVisible(),false);
  assert.equal(f.node('#replay-map').inert,true);
  assert.equal(f.node('#replay-map')['aria-hidden'],'true');
  assert.equal(f.node('#replay-view-photos')['aria-pressed'],'true');
  f.node('#replay-photo-frame').hidden=true;
  f.controller.replayControlsChanged({playing:false,completed:false,day:f.api.day()});
  assert.equal(f.node('#replay-view-photos').disabled,true);
  assert.equal(f.controller.replayMapVisible(),true);
  assert.equal(f.node('#replay-map').inert,false);
  assert.equal(f.node('#replay-view-map')['aria-pressed'],'true');
  f.node('#replay-view-photos').onclick();
  assert.equal(f.controller.replayMapVisible(),true,'empty photo moments cannot expose a blank photo stage');
});

test('Replay keeps the same photo outside the scrolling story on mobile and restores it on desktop',()=>{
  const f=viewerFixture(),frame=f.node('#replay-photo-frame');
  assert.equal(frame.parentElement,f.node('#replay-photo-stage'));
  f.node('#replay-view-photos').onclick();
  f.resize(false);
  assert.equal(frame.parentElement,f.node('#replay-photo-slot'));
  assert.equal(f.node('#replay-map').inert,false);
  f.resize(true);
  assert.equal(frame.parentElement,f.node('#replay-photo-stage'));
  assert.equal(f.node('.replay-player').dataset.replayView,'photos');
  assert.equal(f.node('#replay-photo-frame'),frame,'rotation must preserve the loaded image element');
});
