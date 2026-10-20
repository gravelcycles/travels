import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../dist/assets/page-entry.js',import.meta.url),'utf8');
function fixture(){
  const classes=new Set(),timers=new Map(),events=new Map(),styles=[];let id=0,reloads=0;
  const message={},retry={},panel={hidden:true,querySelector:selector=>selector==='p'?message:retry};
  const document={documentElement:{classList:{add:name=>classes.add(name),remove:name=>classes.delete(name)}},head:{append:style=>styles.push(style.textContent)},createElement:()=>({}),querySelector:()=>panel,addEventListener:(name,fn)=>events.set(name,fn)};
  const context={document,window:{},Set,location:{reload(){reloads++;}},setTimeout:(fn,delay)=>{timers.set(++id,{fn,delay});return id;},clearTimeout:id=>timers.delete(id)};
  vm.runInNewContext(source,context);
  return {classes,panel,message,retry,timers,events,styles,entry:context.window.JOURNEY_ATLAS_ENTRY,get reloads(){return reloads;}};
}
test('first paint waits for both the actual view and access in either completion order',()=>{
  for(const order of [['view','access'],['access','view']]){
    const f=fixture();assert.ok(f.classes.has('page-starting'));
    f.entry.ready(order[0]);f.events.get('DOMContentLoaded')();
    assert.ok(f.classes.has('page-starting'));assert.equal(f.panel.hidden,true);
    f.entry.ready(order[1]);assert.ok(!f.classes.has('page-starting'));assert.equal(f.panel.hidden,true);assert.equal(f.timers.size,0);
    assert.match(f.styles[0],/body \*\{visibility:hidden!important\}/);assert.match(f.styles[0],/dialog::backdrop/);
  }
});
test('a slow initial load shows only neutral progress, then the chosen destination',()=>{
  const f=fixture();f.entry.ready('view');[...f.timers.values()].find(t=>t.delay===500).fn();
  assert.equal(f.panel.hidden,false);assert.equal(f.message.textContent,'Opening Journey Atlas…');assert.equal(f.retry.hidden,true);
  assert.ok(f.classes.has('page-starting'));f.entry.ready('access');
  assert.equal(f.panel.hidden,true);assert.ok(!f.classes.has('page-starting'));assert.equal(f.timers.size,0);
});
test('an unavailable page script offers retry without exposing an unfinished view',()=>{
  const f=fixture();f.entry.ready('access');[...f.timers.values()].find(t=>t.delay===20000).fn();
  assert.ok(f.classes.has('page-starting'));assert.equal(f.panel.hidden,false);assert.equal(f.retry.hidden,false);
  assert.match(f.message.textContent,/could not finish/);f.retry.onclick();assert.equal(f.reloads,1);
  f.entry.ready('view');assert.equal(f.panel.hidden,true);assert.ok(!f.classes.has('page-starting'));
});
