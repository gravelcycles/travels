import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../dist/assets/app.js',import.meta.url),'utf8');
const fn=name=>{const start=source.indexOf(`  function ${name}(`);return source.slice(start,source.indexOf('\n  function ',start+1));};
function harness(){
  const days=[{id:'first',segmentIds:['a','b']},{id:'second',segmentIds:['c']},{id:'rest',segmentIds:[]}];
  const rows=days.map(day=>({dataset:{dayId:day.id},classes:new Set(),classList:{toggle(name,on){on?this.owner.classes.add(name):this.owner.classes.delete(name);}}}));rows.forEach(row=>row.classList.owner=row);
  const states=new Map(),timers=new Map(),previews=[];let timer=0;
  const context=vm.createContext({previewSegmentId:null,previewDayIds:[],previewSource:null,previewShowCard:false,previewClearTimer:null,inspectedSegmentId:null,
    window:{clearTimeout:id=>timers.delete(id),setTimeout:callback=>{timers.set(++timer,callback);return timer;}},
    dayById:id=>days.find(day=>day.id===id),dayForSegment:id=>days.find(day=>day.segmentIds.includes(id)),
    journey:{days,segments:['a','b','c'].map(id=>({id}))},mainMapReady:true,
    mainMap:{getSource:()=>true,setFeatureState:({id},state)=>states.set(id,{...states.get(id),...state})},
    document:{querySelectorAll:selector=>selector==='.day-row'?rows:[]},
    locationLabels:{setPreview:(ids,options)=>previews.push({ids:[...ids],options})}
  });
  vm.runInContext(['syncInspectionClasses','setDayPreview','clearDayPreview','deferDayPreviewClear'].map(fn).join('\n'),context);
  return {context,rows,states,timers,previews};
}

test('pin, day and route previews highlight the entire matching day without changing selection or camera',()=>{
  const {context,rows,states,previews}=harness();
  for(const source of ['pin','list','route']){
    context.setDayPreview(['first'],source,source!=='pin');
    assert.equal(rows[0].classes.has('route-preview'),true);assert.equal(rows[1].classes.has('route-preview'),false);
    assert.equal(states.get('a').previewed,true);assert.equal(states.get('b').previewed,true);assert.equal(states.get('c').previewMuted,true);
    assert.deepEqual(previews.at(-1).ids,['first']);
    context.clearDayPreview(source);
    assert.ok([...states.values()].every(state=>!state.previewed&&!state.previewMuted));
  }
  context.setDayPreview(['rest'],'list');assert.equal(rows[2].classes.has('route-preview'),true);assert.equal(states.get('a').previewed,false);
});

test('moving from a route/day into its card transfers preview ownership and cancels stale clears',()=>{
  const {context,timers}=harness();
  context.setDayPreview(['first'],'list');context.deferDayPreviewClear('list');
  assert.equal(timers.size,1);
  const stale=[...timers.values()][0];
  context.setDayPreview(['second'],'pin',false);assert.equal(timers.size,0);
  stale();assert.deepEqual([...context.previewDayIds],['second']);
  context.clearDayPreview('route');assert.deepEqual([...context.previewDayIds],['second']);
  context.clearDayPreview();assert.equal(context.previewDayIds.length,0);
});

test('actual day-row mouse handlers preview on desktop without selecting and ignore touch hover',()=>{
  for(const enabled of [true,false]){
    const {context}=harness(),events=new Map();
    context.dayList={addEventListener:(name,handler)=>events.set(name,handler)};
    context.routeHoverEnabled=()=>enabled;context.clearSegmentInspection=()=>{};
    const start=source.indexOf("  dayList.addEventListener('mouseover'");
    vm.runInContext(source.slice(start,source.indexOf('  detailPanel.addEventListener',start)),context);
    const row={dataset:{dayId:'first'},contains:()=>false};
    events.get('mouseover')({target:{closest:()=>row},relatedTarget:null});
    assert.deepEqual([...context.previewDayIds],enabled?['first']:[]);
  }
});

test('route inspection connects to a day preview and uses a small pinned inspector only on explicit selection',()=>{
  const {context,rows}=harness(), nodes=new Map();
  Object.assign(context,{routeInspectionPinned:false,setInspectedFeatureState(){},segmentById:()=>({from:'from',to:'to',mode:'train'}),
    placeById:id=>({name:id}),labels:{train:'Train'},conciseDayStory:()=>'',
    $:id=>{if(!nodes.has(id))nodes.set(id,{hidden:true});return nodes.get(id);}});
  context.window.matchMedia=()=>({matches:false});
  vm.runInContext(fn('inspectSegment')+fn('clearSegmentInspection'),context);
  context.inspectSegment('a');
  assert.deepEqual([...context.previewDayIds],['first']);assert.equal(rows[0].classes.has('route-preview'),true);
  assert.equal(context.$('#route-inspector').hidden,true,'Hover only uses the shared place card');
  assert.equal(context.previewShowCard,true);
  context.inspectSegment('a',true);
  assert.equal(context.$('#route-inspector').hidden,false);assert.equal(context.previewShowCard,false,'No duplicate place card on route selection');
});

test('route sources preserve textual segment IDs for MapLibre rendered feature state',()=>{
  const sources=new Map(),layers=[];
  const context=vm.createContext({window:{JOURNEY_ATLAS_MAP_STYLE:{routeInsertionLayer:()=>undefined}},
    palette:{route:'#0072b2',casing:'#fff'},modeStyles:{train:{color:'#0072b2',width:5}},segmentCoordinates:()=>[[8,47],[7,47]]});
  vm.runInContext(fn('addSegmentLayer'),context);
  context.addSegmentLayer({addSource:(id,source)=>sources.set(id,source),addLayer:layer=>layers.push(layer)},
    {sourceIds:[],layerIds:[],hitLayerIds:[]},{id:'arrival-train',mode:'train'},{prefix:'main',interactive:true,selected:false,opacity:1});
  const route=sources.get('main-source-arrival-train');
  assert.equal(route.data.properties[route.promoteId],'arrival-train','String IDs must survive vector tiling to match setFeatureState');
  assert.ok(layers.filter(layer=>!layer.id.includes('-hit-')).every(layer=>JSON.stringify(layer.paint).includes('previewed')));
});
