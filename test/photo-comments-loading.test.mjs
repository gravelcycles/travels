import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function fixture({ photos, collection, selectedId } = {}) {
  const nodes=new Map(),calls=[],pending=[];let visitor=null,rows=[],loaded=false;
  function node(selector) {
    if(nodes.has(selector))return nodes.get(selector);
    const listeners=new Map(),classes=new Set(),n={value:'',textContent:'',innerHTML:'',hidden:false,open:false,dataset:{},style:{setProperty(){}},scrollHeight:50,isConnected:true,
      src:'https://example.test/assets/photo-comments.js',
      classList:{add:k=>classes.add(k),remove:k=>classes.delete(k),contains:k=>classes.has(k)},
      setAttribute(k,v){this[k]=v;},removeAttribute(k){delete this[k];},
      querySelector:s=>node(s),querySelectorAll:()=>[],getClientRects:()=>[{}],contains:()=>false,
      addEventListener(k,fn){listeners.set(k,fn);},fire(k,e={}){return listeners.get(k)?.(e);},
      showModal(){this.open=true;},close(){this.open=false;this.fire('close');},focus(){document.activeElement=this;},replaceChildren(){this.innerHTML='';}
    };nodes.set(selector,n);return n;
  }
  const document={querySelector:node,querySelectorAll:()=>[],body:node('body'),documentElement:node('html'),activeElement:node('opener'),addEventListener(){}};
  const store={identity:{get:()=>visitor,allowed:()=>Boolean(visitor?.name),lock(){},async save(name){visitor={...visitor,name};return {visitor,persistent:true};}},
    profile(){calls.push('profile');return new Promise((resolve,reject)=>pending.push({resolve(value){visitor=value;resolve(value);},reject}));},
    refresh(){calls.push('comments');return new Promise((resolve,reject)=>pending.push({resolve(value){rows=value;loaded=true;resolve();},reject}));},
    comments:()=>rows,hasLoaded:()=>loaded,fresh:()=>false,hasMore:()=>false,draft(){}
  };
  const context=vm.createContext({window:{JOURNEY_ATLAS_AUTH:{clearImage(){}},addEventListener(){}},document,location:{href:'https://example.test/'},URL,URLSearchParams,innerHeight:720,requestAnimationFrame:fn=>fn(),MutationObserver:class{observe(){}}});
  vm.runInContext(fs.readFileSync(new URL('../dist/assets/photo-comments.js',import.meta.url),'utf8'),context);
  const photo={id:'photo',src:'https://example.test/photo.jpg'}; photos ||= [photo]; const openedPhotos=[]; const controller=context.window.JOURNEY_ATLAS_PHOTO_COMMENTS.create({live:true,store:()=>store,journey:()=>({id:'trip'}),photos:()=>photos,photoCollection:()=>collection,openPhoto:(id, options)=>{openedPhotos.push({id,options});controller.photoChanged(photos.find(photo=>photo.id===id));},protected:()=>false,unlocked:()=>true});
  controller.update();controller.photoChanged(photos.find(photo=>photo.id===selectedId) || photo);
  return {controller,node,calls,pending,openedPhotos};
}

test('photo comments appear immediately and profile/comments load together without blocking drafting',async()=>{
  const f=fixture(),opening=f.controller.open();
  assert.equal(f.node('#comments-dialog').open,true,'Present before either response resolves');
  assert.deepEqual(f.calls,['profile','comments']);
  assert.equal(f.node('#comments-list')['aria-busy'],'true');
  assert.equal(f.node('#comment-submit').disabled,true);
  f.node('#comment-body').value='An unfinished thought';f.node('#comment-body').fire('input');
  f.pending[0].resolve({id:'signed',name:'Alex'});f.pending[1].resolve([]);await opening;
  assert.equal(f.node('#comment-body').value,'An unfinished thought');
  assert.equal(f.node('#comment-submit').disabled,false);
  assert.equal(f.node('#comments-list')['aria-busy'],'false');
});

test('network failure stays in the conversation with Retry and does not discard the draft',async()=>{
  const f=fixture(),opening=f.controller.open();f.node('#comment-body').value='Keep this';
  f.pending[0].resolve({id:'signed',name:'Alex'});f.pending[1].reject(new Error('Network unavailable'));await opening;
  assert.equal(f.node('#comments-dialog').open,true);
  assert.equal(f.node('#comments-retry').hidden,false);
  assert.match(f.node('#comments-loading').textContent,/Network unavailable/);
  assert.equal(f.node('#comment-body').value,'Keep this');
});

test('closing while comments load cannot reopen the panel or replace its latest state',async()=>{
  const f=fixture(),opening=f.controller.open();f.node('#comments-dialog').close();
  f.pending[0].resolve({id:'signed',name:'Alex'});f.pending[1].resolve([]);await opening;
  assert.equal(f.node('#comments-dialog').open,false);
});


test('reading does not require a name, and adding a name enables an existing draft',async()=>{
  const f=fixture(),opening=f.controller.open();
  f.pending[0].resolve({id:'signed',name:''});f.pending[1].resolve([]);await opening;
  assert.equal(f.node('#experience-unlock').open,false);
  f.node('#comment-body').value='Ready to post';f.node('#comment-body').fire('input');
  assert.equal(f.node('#comment-submit').disabled,true);
  f.node('#comment-change-name').fire('click');
  f.node('#experience-display-name').value='Alex';
  await f.node('#experience-unlock').fire('submit',{preventDefault(){}});
  assert.equal(f.node('#comment-submit').disabled,false);
  assert.equal(f.node('#comment-body').value,'Ready to post');
});

test('conversation arrows retain the presenting collection, selection order, boundary and each photo draft', async () => {
  const photos = ['a','b','c','d'].map(id=>({id,src:`https://example.test/${id}.jpg`,alt:'Accessibility text',caption:'',takenAt:'7 Oct · 18:01'}));
  const collection = {photos:[photos[2],photos[0],photos[1]],label:'Prague'};
  const f=fixture({photos,collection,selectedId:'a'}), opening=f.controller.open();
  f.pending[0].resolve({id:'signed',name:'Alex'}); f.pending[1].resolve([]); await opening;
  assert.equal(f.node('#comments-photo-position').textContent, 'Photo 2 of 3 · Prague');
  assert.equal(f.node('#comments-photo-title').textContent, '7 Oct · 18:01');
  f.node('#comment-body').value='A draft for a';f.node('#comment-body').fire('input');
  f.node('#comments-next-photo').fire('click');
  assert.equal(f.openedPhotos.at(-1).id,'b');
  assert.equal(f.openedPhotos.at(-1).options.photos,collection.photos);
  assert.equal(f.openedPhotos.at(-1).options.preserveCollection,true,'Comment navigation retains the presenting viewer mode as well as its members');
  assert.equal(f.node('#comments-photo-position').textContent,'Photo 3 of 3 · Prague');
  assert.equal(f.node('#comments-next-photo').disabled,true);
  f.node('#comment-body').value='A draft for b';f.node('#comment-body').fire('input');
  f.node('#comments-next-photo').fire('click');
  assert.equal(f.openedPhotos.length,1,'A synthetic click cannot escape the final item boundary');
  f.node('#comments-previous-photo').fire('click');
  assert.equal(f.node('#comment-body').value,'A draft for a');
  assert.equal(f.node('#comments-photo-position').textContent,'Photo 2 of 3 · Prague');
  f.node('#comments-next-photo').fire('click');
  assert.equal(f.node('#comment-body').value,'A draft for b');
  collection.photos=[photos[1]];f.controller.photoChanged(photos[1]);
  assert.equal(f.node('#comments-photo-position').textContent,'Photo 1 of 1 · Prague','Changing a collection around the same photograph refreshes its context');
});
