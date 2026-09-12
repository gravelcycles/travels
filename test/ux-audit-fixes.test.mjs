import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import '../dist/assets/atlas-utils.js';
import '../dist/assets/media-utils.js';
import '../studio/plan-extras.js';
const app = fs.readFileSync(new URL('../dist/assets/app.js', import.meta.url),'utf8');
function fn(source,name) {const start=source.indexOf(`  function ${name}(`);assert.ok(start>=0,name);return source.slice(start,source.indexOf('\n  function ',start+1));}
function editor() {
  const nodes=new Map(), requests=[];
  const $=selector=>{if(!nodes.has(selector))nodes.set(selector,{value:'',dataset:{},handlers:{},classList:{toggle(){}},setAttribute(){},addEventListener(n,fn){this.handlers[n]=fn;},reset(){},querySelectorAll(){return [];}});return nodes.get(selector);};
  const photos=[{id:'p1',dayId:'d1',caption:'One'},{id:'p2',dayId:'d2',caption:'Two'}];
  const journey={id:'trip',places:[{id:'a',name:'A',lng:8,lat:47}],segments:[{id:'leg',from:'a',to:'a',mode:'walk',geometry:[[8,47],[8.01,47.01],[8,47]]}],photos,
    days:[{id:'d1',title:'One',segmentIds:['leg']},{id:'d2',title:'Two',segmentIds:[]}],replayMoments:[{id:'m',dayId:'d1',caption:'Sentence',segmentIds:[]}]};
  const context=vm.createContext({structuredClone,URL,URLSearchParams,document:{querySelector:$,querySelectorAll:()=>[],addEventListener(){}},
    fetch:(url,options)=>new Promise(resolve=>requests.push({url,body:JSON.parse(options.body),resolve})),
    window:{addEventListener(){},JOURNEY_ATLAS_DATA:{journeys:[journey]},JOURNEY_ATLAS_UTILS:globalThis.JOURNEY_ATLAS_UTILS,JOURNEY_ATLAS_MEDIA:globalThis.JOURNEY_ATLAS_MEDIA,JOURNEY_ATLAS_PLAN_EXTRAS:globalThis.JOURNEY_ATLAS_PLAN_EXTRAS}});
  const source=fs.readFileSync(new URL('../studio/studio.js',import.meta.url),'utf8');
  vm.runInContext(source.replace('  init();\n})();', `
    drawRouteEditor=()=>{};renderRouteList=()=>{};renderPhotoGrid=()=>{};refreshPhotoOrderControls=()=>{};renderDaySelectors=()=>{};
    routePoints=[[8,47],[8,47]]; resetHistory(routePoints);
    window.audit={saveAll,acceptRouteGeometry,restoreRouteHistory,routeEditSnapshot,newPlaceCanBeRemoved,planForJourney,
      state:()=>state,dirty:()=>dirty,editDay:text=>{state.days.d1={title:text};markDirty();}};
  })();`),context);
  return {api:context.window.audit,$,requests,journey};
}
test('ordinary Studio saves acknowledge only the sent edits and serialize repeated clicks',async()=>{
  const f=editor();f.api.editDay('Sent');const saving=f.api.saveAll();
  f.api.editDay('Newer');assert.equal(await f.api.saveAll(),false);assert.equal(f.requests.length,1);
  assert.equal(f.requests[0].body.days.d1.title,'Sent');
  f.requests[0].resolve({ok:true,json:async()=>({ok:true,stateRevision:'r1'})});assert.equal(await saving,true);
  assert.equal(f.api.dirty(),true);assert.match(f.$('#save-status').textContent,/newer changes still need saving/);
  const next=f.api.saveAll();assert.equal(f.requests[1].body.days.d1.title,'Newer');assert.equal(f.requests[1].body.stateRevision,'r1');
  f.requests[1].resolve({ok:true,json:async()=>({ok:true,stateRevision:'r2'})});await next;assert.equal(f.api.dirty(),false);
});
test('failed Studio save keeps edits and enables a retry',async()=>{
  const f=editor();f.api.editDay('Keep me');const saving=f.api.saveAll();f.requests[0].resolve({ok:false,json:async()=>({error:'Revision conflict'})});
  assert.equal(await saving,false);assert.equal(f.api.dirty(),true);assert.equal(f.$('#save-all').disabled,false);assert.match(f.$('#save-status').textContent,/Revision conflict/);
});
test('route replacement, smoothing and reset are undoable with the full reviewed geometry',()=>{
  const f=editor(), detailed=[[8,47],[8.005,47.009],[8.007,47.001],[8,47]];
  f.api.state().routes.leg={geometry:detailed,controlPoints:[[8,47],[8,47]],routing:{kind:'gpx'}};
  const original=JSON.stringify(f.api.routeEditSnapshot());
  f.api.acceptRouteGeometry([[8,47],[8,47]],{kind:'manual'},'Fallback');
  f.api.restoreRouteHistory(-1);assert.equal(JSON.stringify(f.api.routeEditSnapshot()),original);
  f.api.restoreRouteHistory(1);const accepted=JSON.stringify(f.api.routeEditSnapshot());
  f.$('#smooth-route').handlers.click();f.api.restoreRouteHistory(-1);assert.equal(JSON.stringify(f.api.routeEditSnapshot()),accepted);
  f.$('#reset-route').handlers.click();assert.equal(f.api.state().routes.leg,undefined);
  f.api.restoreRouteHistory(-1);assert.equal(JSON.stringify(f.api.routeEditSnapshot()),accepted);
});
test('changing the photo day filter moves the editor to a result and clears it for an empty day',()=>{
  const f=editor();f.$('#show-photo-trash').checked=false;f.$('#photo-day-filter').value='d2';f.$('#photo-day-filter').handlers.change();
  assert.equal(f.$('#photo-day').value,'d2');assert.equal(f.$('#photo-caption').value,'Two');
  f.$('#photo-day-filter').value='empty';f.$('#photo-day-filter').handlers.change();assert.equal(f.$('#photo-form').inert,true);
});
test('only newly added unused places can be removed, including group overnight references',()=>{
  const f=editor(), draft={places:[],segments:[],days:[]};
  assert.equal(f.api.newPlaceCanBeRemoved(draft,'new'),true);assert.equal(f.api.newPlaceCanBeRemoved(draft,'a'),false);
  for(const reference of [{segments:[{from:'new',to:'a'}]},{days:[{destinationId:'new'}]},{days:[{groupPlaces:{group:'new'}}]},{meetup:{placeId:'new'}}]) {
    assert.equal(f.api.newPlaceCanBeRemoved({...draft,...reference},'new'),false);
  }
});
test('clearing the optional Replay sentence retains a valid empty string',()=>{
  const f=editor(), target={dataset:{momentField:'caption'},value:'',hasAttribute:()=>false,closest:()=>({dataset:{moment:'m'}})};
  f.$('#trip-planner').handlers.input({target});assert.equal(f.api.planForJourney().draft.replayMoments[0].caption,'');
});
test('round trips render from known endpoints without an optional destination',()=>{
  for(const segments of [[{from:'a',to:'a'}],[{from:'a',to:'b'},{from:'b',to:'a'}]]) {
    const context=vm.createContext({journey:{},activeGroupId:null,segmentsForDay:()=>segments,destinationForDay:()=>null,placeById:id=>({id,name:id==='a'?'Home':'Hill'})});
    vm.runInContext(fn(app,'routeLabel'),context);assert.equal(context.routeLabel({}), 'Home · day trip');
  }
});
test('public image Retry uses the public loader regardless of private access',()=>{
  const start=app.indexOf("  $('#viewer-photo-retry').addEventListener('click',"),end=app.indexOf('\n  $(".photo-close")',start);
  for(const unlocked of [false,true]) {
    let retry,publicLoads=0;const context=vm.createContext({$:()=>({addEventListener:(_n,fn)=>retry=fn}),viewerImage:{},viewerDay:()=>({id:'day'}),viewerPhotoIndex:0,photosForDay:()=>[{id:'public'}],setPublicFullImage:()=>publicLoads++,window:{JOURNEY_ATLAS_AUTH:{unlocked,isProtected:()=>false,showPrompt:()=>assert.fail('Public photos never require authentication'),setImage:()=>assert.fail('Public URL cannot enter private loader')}}});
    vm.runInContext(app.slice(start,end),context);retry();assert.equal(publicLoads,1);
  }
});
test('map feedback clears recovered failures, has bounded waiting and a real retry action',()=>{
  const nodes=[],timers=new Map(),events=new Map();let retries=0;
  const node=()=>{const n={children:[],append(...c){this.children.push(...c);},setAttribute(){},remove(){this.removed=true;}};nodes.push(n);return n;};
  const host=node(),context=vm.createContext({window:{},document:{getElementById:()=>host,createElement:node},setTimeout:fn=>{timers.set(1,fn);return 1;},clearTimeout:id=>timers.delete(id)});
  vm.runInContext(fs.readFileSync(new URL('../dist/assets/map-feedback.js',import.meta.url),'utf8'),context);
  const feedback=context.window.JOURNEY_ATLAS_MAP_FEEDBACK.create('map',()=>retries++),panel=host.children[0];
  feedback.watch({on:(n,fn)=>events.set(n,fn),isStyleLoaded:()=>true});timers.get(1)();assert.match(panel.children[0].textContent,/unavailable/);
  panel.children[1].onclick();assert.equal(retries,1);events.get('load')();assert.equal(panel.hidden,true);
  feedback.empty(true);assert.equal(panel.hidden,false);assert.match(panel.children[0].textContent,/No location/);
  events.get('error')();events.get('idle')();assert.match(panel.children[0].textContent,/No location/);
  feedback.empty(false);assert.equal(panel.hidden,true);feedback.destroy();assert.equal(timers.size,0);
});
