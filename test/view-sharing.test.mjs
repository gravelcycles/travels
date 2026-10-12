import test from 'node:test';
import assert from 'node:assert/strict';
import '../dist/assets/view-sharing.js';
const {read,urlFor,shareLink,create} = globalThis.JOURNEY_ATLAS_SHARING;

test('view URLs round-trip selected, fullscreen, grid and overview states with stable escaped IDs',()=>{
  for(const view of ['map','story','photo','grid']) {
    const state={dayId:'city / café',photoId:view==='grid'?'':'image + 2',view,scope:'day'};
    const url=urlFor('https://atlas.test/demo.html?journey=sample&group=walk&day=old&photo=stale#photo=old',state);
    assert.deepEqual(read(url),state);
    assert.equal(new URL(url).search,'?journey=sample&group=walk');
  }
  const overview={dayId:'one',photoId:'',view:'map',scope:'journey'};
  assert.deepEqual(read(urlFor('https://atlas.test/trip',overview)),overview);
  assert.equal(urlFor('https://atlas.test/trip#photo=old',null),'https://atlas.test/trip');
});

test('legacy photo/day links still open directly and shared URLs strip every non-context query',()=>{
  assert.equal(read('https://atlas.test/?photo=one').view,'photo');
  assert.equal(read('https://atlas.test/#photo=one').view,'photo');
  assert.equal(read('https://atlas.test/?day=one&view=story').view,'story');
  assert.equal(read('https://atlas.test/#day=one&view=unknown').view,'map');
  const url=urlFor('https://atlas.test/trip?journey=demo&group=walk&photo=old&token=secret&photoSource=local&experience=comments&arbitrary=private',{dayId:'one',photoId:'two',view:'photo'},{share:true});
  assert.equal(new URL(url).search,'?journey=demo&group=walk');
  assert.ok(!url.includes('secret'));assert.ok(!url.includes('private'));assert.ok(!url.includes('local'));
});

test('share sends a page link, cancellation is silent, failure falls back without false success',async()=>{
  const payload={url:'https://atlas.test/trip#photo=p',title:'Journey'},calls=[];
  const fallback=url=>calls.push(['manual',url]),announce=message=>calls.push(['status',message]);
  assert.equal(await shareLink(payload,{navigator:{share:async data=>calls.push(data)},fallback,announce}),'shared');
  assert.deepEqual(calls,[payload]);calls.length=0;
  assert.equal(await shareLink(payload,{navigator:{share:async()=>{throw {name:'AbortError'};}},fallback,announce}),'cancelled');
  assert.deepEqual(calls,[]);
  assert.equal(await shareLink(payload,{navigator:{share:async()=>{throw Error();},clipboard:{writeText:async url=>calls.push(['copied',url])}},fallback,announce}),'copied');
  assert.deepEqual(calls,[['copied',payload.url],['status','Link copied']]);calls.length=0;
  assert.equal(await shareLink(payload,{navigator:{clipboard:{writeText:async()=>{throw Error();}}},fallback,announce}),'manual');
  assert.deepEqual(calls,[['manual',payload.url]]);
});

function fixture(href='https://atlas.test/trip') {
  const listeners={},queue=[],writes=[],restored=[];
  const env={location:{href},history:{state:{mobileAtlas:{viewer:false},atlasPlaces:{scroll:120}},replaceState(state,_title,url){this.state=state;env.location.href=url;writes.push(url);}},setTimeout:fn=>queue.push(fn),addEventListener:(name,fn)=>{const previous=listeners[name];listeners[name]=event=>{previous?.(event);fn(event);};}};
  let state=null;
  const api={state:()=>state,title:()=> 'Journey',restore:target=>{restored.push(target);state=target;}};
  const ui=create(api,env);
  return {ui,env,listeners,writes,restored,set:value=>state=value,flush(){while(queue.length)queue.shift()();}};
}

test('URL sync preserves surface history and coalesces browsing without pushing per photo',()=>{
  const f=fixture();const saved=f.env.history.state;f.ui.start();assert.equal(f.writes.length,0,'Bare entry stays bare');
  f.set({dayId:'one',photoId:'p1',view:'map'});f.ui.changed();f.ui.changed();f.flush();
  assert.equal(read(f.env.location.href).photoId,'p1');assert.equal(f.env.history.state,saved);
  for(let i=0;i<30;i++){f.set({dayId:i>15?'two':'one',photoId:`p${i}`,view:'photo'});f.ui.changed();f.flush();}
  assert.equal(read(f.env.location.href).photoId,'p29');assert.equal(read(f.env.location.href).dayId,'two');
  assert.equal(f.env.history.state,saved);assert.equal(f.env.history.state.atlasPlaces.scroll,120);
});

test('initial and manually changed links restore; owned Back/Forward is not reopened by hashchange',()=>{
  const f=fixture('https://atlas.test/trip#day=two&photo=p2&view=map');f.ui.start();
  assert.equal(read(f.env.location.href).photoId,'p2','Target is ready synchronously before an auth redirect');f.flush();
  assert.equal(f.restored.length,1);assert.equal(f.restored[0].view,'map');
  const newURL='https://atlas.test/trip#day=one&view=map';f.env.location.href=newURL;
  f.set({dayId:'one',photoId:'',view:'map',scope:'day'});
  f.listeners.popstate({state:f.env.history.state});f.flush();
  f.listeners.hashchange({newURL});f.flush();assert.equal(f.restored.length,1,'History owners restore once');
  f.env.location.href='https://atlas.test/trip#photo=p3';f.listeners.hashchange({newURL:f.env.location.href});f.flush();
  assert.equal(f.restored.length,2);assert.equal(f.restored[1].view,'photo');
});


test('a native close leaves its forward photo URL intact until history traversal settles',()=>{
  const f=fixture('https://atlas.test/trip#photo=p2');f.ui.start();f.flush();
  // This pending-close guard is independent of the existing history payload.
  let pending=true;const listeners={},queue=[];
  const env={...f.env,setTimeout:fn=>queue.push(fn),addEventListener:(name,fn,capture)=>{listeners[name+(capture?'Capture':'')]=fn;}};
  let state={dayId:'one',photoId:'p2',view:'photo'};
  const restored=[];
  const ui=create({state:()=>state,pending:()=>pending,restore:target=>restored.push(target)},env);
  ui.start();const forwardUrl=env.location.href;state={dayId:'one',photoId:'p2',view:'map'};ui.changed();queue.shift()();
  assert.equal(env.location.href,forwardUrl);
  const destination='https://atlas.test/trip#photo=p1&view=map';env.location.href=destination;
  listeners.popstateCapture();
  // Model a surface listener replacing the URL before the sharing listener.
  pending=false;env.location.href='https://atlas.test/trip#photo=p2&view=map';
  listeners.popstate({state:{mobileAtlas:{viewer:false}}});
  listeners.hashchange({newURL:destination});
  assert.equal(restored.length,1,'Only startup restores; paired hashchange does not add another entry');
});

test('a fresh photo target is written before an asynchronous auth redirect can capture the temporary return surface',async()=>{
  const env={location:{href:'https://atlas.test/trip#day=one&photo=p2&view=photo'},history:{state:{},replaceState(_state,_title,url){env.location.href=url;}},setTimeout(){},addEventListener(){}};
  let selected;
  const ui=create({state:()=>selected,restore:target=>{
    // Real entry first creates a map URL for Back, then opens the photo.
    env.history.replaceState({},'', 'https://atlas.test/trip#day=one&view=map');
    selected=target;
  }},env);
  ui.start();
  await Promise.resolve();
  assert.equal(read(env.location.href).photoId,'p2');
  assert.equal(read(env.location.href).view,'photo');
});
