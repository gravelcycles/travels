import vm from 'node:vm';
import fs from 'node:fs';
export function viewerFixture({deferredHistory=false, reducedMotion=false, videoIndex=-1, journey} = {}) {
  const nodes = new Map(), events = new Map(), timers = new Map(), frames = new Map(), traversals = [], queries = new Map();
  let clock = 0, timer = 0, controller;
  function node(selector) {
    if (!nodes.has(selector)) nodes.set(selector, {
      dataset:{},style:{setProperty(name,value){this[name]=value;}},classList:{names:new Set(),add(name){this.names.add(name);},remove(name){this.names.delete(name);},contains(name){return this.names.has(name);}},getBoundingClientRect(){return {left:0,top:0,width:390,height:706};},clientWidth:390,clientHeight:706,offsetHeight:160,naturalWidth:1200,naturalHeight:800,
      open:false,hidden:false,handlers:new Map(),captures:new Map(),textContent:'',inert:false,
      setAttribute(name,value){this[name]=value;},removeAttribute(name){delete this[name];},children:[],append(child){child.parentElement=this;this.children.push(child);},focus(){},setPointerCapture(){},
      querySelectorAll(){return [];},closest(query){return selector.startsWith('#mobile-') && (query==='button' || query==='button:not(#mobile-photo-location)' && selector!=='#mobile-photo-location')?this:null;},
      addEventListener(name,fn,capture){(capture?this.captures:this.handlers).set(name,fn);},
      showModal(){this.open=true;},close(){this.open=false;if(selector==='#photo-dialog')controller?.closed();else this.handlers.get('close')?.();}
    });
    return nodes.get(selector);
  }
  const days=journey?.days || [{id:'one',number:1,date:'Today',title:'One'},{id:'two',number:2,date:'Tomorrow',title:'Two'}];
  const photos=journey?.photos || [0,1,2].map(i=>({id:`p${i}`,lng:8+i,lat:47}));
  if (videoIndex >= 0) Object.assign(photos[videoIndex], {mediaType:'video',title:'A video'});
  let mediaPauses = 0, neighborLoads = 0;
  let day=days[0], index=0, locations=0, pauses=0, tabs=0, scope='day';
  const stack=[{}]; let cursor=0;
  const history={get state(){return stack[cursor];},replaceState(state){stack[cursor]=structuredClone(state);},pushState(state){stack.splice(++cursor);stack[cursor]=structuredClone(state);},back(){this.go(-1);},go(delta){const traverse=()=>{cursor=Math.max(0,Math.min(stack.length-1,cursor+delta));events.get('popstate')?.({state:this.state});};if(deferredHistory)traversals.push(traverse);else traverse();}};
  const api={day:()=>day,days:()=>days,scope:()=>scope,title:()=> 'Journey',dayInfo:()=>({route:'Route',meta:'Train',count:3}),
    tab:value=>{tabs++;node('.atlas-shell').dataset.mobileTab=value;},selectDay:id=>{day=days.find(d=>d.id===id);scope='day';},preview(){},stepDay(){},album(){},overview(){scope='journey';controller.renderDay();},replay(){},
    location(){locations++;},pauseLocation(){pauses++;},pauseMedia(){mediaPauses++;},clearImage(){},loadImage(){neighborLoads++;},restoreOverlay:id=>controller.presentOverlay(id),
    resumePhoto(){update();},move(delta){index+=delta;update();},selectPhoto(value){index=value;update();},
    openDay(id=day.id,options){controller.open(options);day=days.find(d=>d.id===id);index=0;node('#photo-dialog').open=true;update();}};
  const context=vm.createContext({window:{addEventListener:(name,fn)=>events.set(name,fn)},document:{querySelector:node,createElement:()=>node(`image${nodes.size}`)},
    matchMedia:query=>{if(!queries.has(query))queries.set(query,{matches:query.includes('900px') || reducedMotion && query.includes('reduced-motion'),addEventListener(_name,fn){this.changed=fn;}});return queries.get(query);},ResizeObserver:class{observe(){}},
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
  return {api,node,controller,history,drag,click,get neighborLoads(){return neighborLoads;},get mediaPauses(){return mediaPauses;},resize(mobile){const query=queries.get('(max-width: 900px)');query.matches=mobile;query.changed();},get tabs(){return tabs;},get pauses(){return pauses;},flushHistory(){while(traversals.length)traversals.shift()();},get index(){return index;},get locations(){return locations;},flush(elapsed=300){clock+=elapsed;const raf=[...frames.values()];frames.clear();raf.forEach(fn=>fn(clock));const work=[...timers.values()];timers.clear();work.forEach(fn=>fn());}};
}

