import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { viewerFunction } from './viewer-flow-harness.mjs';

// Run the real mobile history controller and main-map camera/tab functions.
// Native close events and history traversals are queued, as in the browser.
function fixture({ scope = 'day', tab = 'map' } = {}) {
  const nodes = new Map(), events = new Map(), queue = [], timers = new Map();
  let timerId = 0, controller, cursor = 0, selected = 0, sidebarPhoto = null;
  const stack = [{}], days = ['one', 'two'].map((id, index) => ({ id, number:index + 1, title:id, date:id }));
  let camera = {center:[8.5423,47.3791],zoom:16.25,bearing:24,pitch:18,padding:{top:7,right:12,bottom:28,left:19}};
  const originalCamera = structuredClone(camera), calls = [];
  const defaultCamera = id => ({center:id === 'one' ? [8,47] : [12,45],zoom:11,bearing:0,pitch:0,padding:{top:30,right:30,bottom:80,left:30}});
  const clone = value => JSON.parse(JSON.stringify(value));
  function node(selector) {
    if (nodes.has(selector)) return nodes.get(selector);
    const listeners = new Map(), value = {
      dataset:{},style:{setProperty(){}},classList:{add(){},remove(){}},open:false,children:[],
      clientWidth:390,clientHeight:706,offsetHeight:150,naturalWidth:1200,naturalHeight:800,
      setAttribute(name,value){this[name]=value;},removeAttribute(name){delete this[name];},append(child){this.children.push(child);},focus(){},
      setPointerCapture(){},closest(){return null;},
      dispatch(type, values={}){for(const handler of listeners.get(type)||[])handler({type,pointerId:1,button:0,clientX:180,clientY:200,target:this,currentTarget:this,...values});},
      getBoundingClientRect(){return {left:0,top:0,width:390,height:706};},
      addEventListener(name,handler){if(!listeners.has(name))listeners.set(name,[]);listeners.get(name).push(handler);},
      showModal(){this.open=true;},close(){if(!this.open)return;this.open=false;queue.push(()=>{
        if(selector === '#photo-dialog')controller.closed();
        for(const handler of listeners.get('close') || [])handler();
      });}
    };
    nodes.set(selector,value);return value;
  }
  const history = {
    get state(){return stack[cursor];},get position(){return cursor;},
    replaceState(value){stack[cursor]=structuredClone(value);},pushState(value){stack.splice(++cursor);stack[cursor]=structuredClone(value);},
    back(){this.go(-1);},go(delta){queue.push(()=>{cursor=Math.max(0,Math.min(stack.length-1,cursor+delta));events.get('popstate')({state:this.state});});}
  };
  const schedule = fn => {timers.set(++timerId,fn);return timerId;};
  const map = {
    getCenter:()=>({toArray:()=>[...camera.center]}),getZoom:()=>camera.zoom,getBearing:()=>camera.bearing,getPitch:()=>camera.pitch,getPadding:()=>({...camera.padding}),
    resize(){calls.push('resize');},stop(){calls.push('stop');},jumpTo(value){camera=clone(value);calls.push('jump');}
  };
  const context = vm.createContext({
    mainMap:map,mainMapReady:true,activeDayId:'one',mapScope:scope,mobileMapTimer:null,pendingMapAction:null,
    $:node,clearTimeout:id=>timers.delete(id),setTimeout:schedule,
    settleAtCity(){camera=defaultCamera(context.activeDayId);calls.push('city');},restoreDayCamera(){camera=defaultCamera(context.activeDayId);calls.push('city');},
    fitJourneyBounds(){camera={...defaultCamera('one'),zoom:4};calls.push('overview');},startArrival(){camera=defaultCamera(context.activeDayId);calls.push('arrival');},
    drawMainMap(){calls.push('draw');},renderArrivalChapter(){},renderDayNavigator(){},placesUI:{isOpen:()=>false},activeDay:()=>days.find(day=>day.id===context.activeDayId),
    window:{addEventListener:(name,handler)=>events.set(name,handler),setTimeout:schedule},
    document:{querySelector:node,createElement:()=>node(`image-${nodes.size}`)},
    history,location:{href:'https://example.test/journey'},matchMedia:query=>({matches:query.includes('900px'),addEventListener(){}}),
    ResizeObserver:class{observe(){}},requestAnimationFrame(){},cancelAnimationFrame(){},performance:{now:()=>0}
  });
  vm.runInContext(['captureMapView','restoreMapView','setMobileTab'].map(viewerFunction).join('\n'),context);
  const api = {
    day:context.activeDay,days:()=>days,scope:()=>context.mapScope,title:()=> 'Journey',dayInfo:()=>({meta:'',count:2}),
    captureMapView:context.captureMapView,restoreMapView:context.restoreMapView,tab:context.setMobileTab,sidebarPhoto:()=>sidebarPhoto,
    selectDay(id){context.activeDayId=id;context.mapScope='day';camera=defaultCamera(id);calls.push('selectDay');},
    stepDay(){},preview(){},overview(){context.mapScope='journey';context.fitJourneyBounds();},album(){},replay(){},
    location(){},pauseLocation(){},clearImage(){},loadImage(){},restoreOverlay:id=>controller.presentOverlay(id),
    selectPhoto(index){selected=index;update();},
    openDay(id=context.activeDayId,options={}){
      controller.prepareOpen();
      if(id !== context.activeDayId)this.selectDay(id);
      // Actual entry can settle an explored city before displaying the viewer.
      if(options.settle)context.settleAtCity();
      controller.open(options);node('#photo-dialog').showModal();selected=0;update();
    }
  };
  function update(){controller.update({day:api.day(),photos:[{id:'p0'},{id:'p1'}],index:selected});}
  vm.runInContext(fs.readFileSync(new URL('../dist/assets/mobile-ux.js',import.meta.url),'utf8'),context);
  node('.atlas-shell').dataset.mobileTab=tab;
  controller=context.window.JOURNEY_ATLAS_MOBILE.create(api);
  context.window.JOURNEY_ATLAS_MOBILE_UI=controller;
  function flush(){let count=0;while(queue.length || timers.size){assert.ok(++count<40,'Return must settle');while(queue.length)queue.shift()();const pending=[...timers.values()];timers.clear();pending.forEach(fn=>fn());}}
  return {api,controller,node,history,context,calls,originalCamera,flush,get camera(){return camera;},
    crossDay(id){api.selectDay(id);update();},
    selectSidebar(photo){sidebarPhoto=photo;api.selectDay(photo.dayId);},
    close(control){if(control === 'pull'){const stage=node('.photo-stage');stage.dispatch('pointerdown');stage.dispatch('pointermove',{clientY:400});stage.dispatch('pointerup',{clientY:400});}else if(control === 'browser')history.back();else if(control === 'close')node('#photo-dialog').close();else node(control).onclick();}}
}

test('Close, Day/Stop, grid Back and browser Back preserve the exact presenting map camera',()=>{
  for(const control of ['close','#mobile-photo-back','#mobile-grid-back','browser','pull']){
    const f=fixture();f.api.openDay('one',{settle:true,grid:control === '#mobile-grid-back'});
    assert.notDeepEqual(f.camera,f.originalCamera,'Fixture reproduces an entry that fits the city');
    f.close(control);f.flush();
    assert.deepEqual(f.camera,f.originalCamera,control);
    assert.equal(f.node('#photo-dialog').open,false,control);
    assert.equal(f.api.scope(),'day');assert.equal(f.history.position,0);
    assert.deepEqual(f.history.state.mobileAtlas.mapView.camera,f.originalCamera);
  }
});

test('a queued map-tab resize cannot overwrite restored photo-return zoom',()=>{
  const f=fixture({tab:'story'});f.api.openDay('one',{settle:true});
  f.close('browser');f.flush();
  assert.equal(f.node('.atlas-shell').dataset.mobileTab,'map');
  assert.deepEqual(f.camera,f.originalCamera);
  assert.equal(f.calls.filter(call=>call === 'city').length,1,'Only initial entry may fit the city');
});

test('photo return restores a manually framed journey overview without fitting the full route',()=>{
  const f=fixture({scope:'journey'});f.api.openDay('one');
  f.context.mapScope='day';f.controller.update({day:f.api.day(),photos:[{id:'p0'}],index:0});
  f.close('#mobile-photo-back');f.flush();
  assert.equal(f.api.scope(),'journey');assert.deepEqual(f.camera,f.originalCamera);
  assert.equal(f.calls.includes('overview'),false);
});

test('cross-event browsing returns to the selected event and records that map for the next entry',()=>{
  const f=fixture();f.api.openDay('one');f.crossDay('two');
  const nextCamera=structuredClone(f.camera);f.close('pull');f.flush();
  assert.equal(f.api.day().id,'two');assert.deepEqual(f.camera,nextCamera);
  assert.equal(f.history.state.mobileAtlas.dayId,'two');
  f.api.openDay('two',{settle:true});f.close('#mobile-photo-back');f.flush();
  assert.equal(f.api.day().id,'two');assert.deepEqual(f.camera,nextCamera);
});

test('browsing away and back to the presenting event restores its original explored camera',()=>{
  const f=fixture();f.api.openDay();f.crossDay('two');f.crossDay('one');
  f.close('browser');f.flush();assert.deepEqual(f.camera,f.originalCamera);
});

test('returning from Comments preserves the viewer and its eventual original map camera',()=>{
  const f=fixture();f.api.openDay('one',{settle:true});f.api.selectPhoto(1);
  f.controller.presentOverlay('comments-dialog');f.controller.dismissOverlay('comments-dialog');f.flush();
  assert.equal(f.node('#photo-dialog').open,true);assert.equal(f.history.state.mobileAtlas.index,1);
  f.close('close');f.flush();assert.deepEqual(f.camera,f.originalCamera);
});

test('Forward reopens the photo and another Back still restores the original map',()=>{
  const f=fixture();f.api.openDay('one',{settle:true});f.api.selectPhoto(1);f.close('browser');f.flush();
  f.history.go(1);f.flush();assert.equal(f.node('#photo-dialog').open,true);
  assert.equal(f.history.state.mobileAtlas.index,1);
  f.close('browser');f.flush();assert.deepEqual(f.camera,f.originalCamera);
});


test('closing sidebar Comments keeps the city chosen by conversation photo arrows',()=>{
 const f=fixture();
 f.selectSidebar({id:'a',dayId:'one'});
 f.controller.presentOverlay('comments-dialog');
 f.selectSidebar({id:'b',dayId:'two'});
 const expected=structuredClone(f.camera);f.calls.length=0;
 f.node('#comments-dialog').close();f.flush();
 assert.equal(f.context.activeDayId,'two');assert.deepEqual(f.camera,expected);
 assert.ok(!f.calls.includes('selectDay'),'History must not clear the sidebar by selecting its old day');
 assert.equal(f.history.state.mobileAtlas.dayId,'two');
});
