import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../studio/studio.js', import.meta.url),'utf8');
function fn(name) { const start=source.indexOf(`  function ${name}(`);return source.slice(start,source.indexOf('\n  function ',start+1)); }
test('Photos from counts match the grid, including hidden photos and the selected trash view', () => {
  const nodes=new Map();
  const $=key=>{ if(key === '#studio-photo-grid .active')return null; if(!nodes.has(key))nodes.set(key,{});return nodes.get(key); };
  $('#photo-day-filter').value='d8'; $('#show-photo-trash').checked=false;
  const day={id:'d8',number:8,date:'20 Aug',title:'Como'};
  const context=vm.createContext({$,basePhotos:[{id:'hidden',dayId:'d8',hidden:true},{id:'trash',dayId:'d8',trashed:true}],state:{days:{}},
    journey:{days:[day]},photoWithOverride:p=>p,escapeHtml:v=>v,dayById:()=>day,photoUrl:v=>v,selectedPhotoId:null});
  vm.runInContext(['photosForDay','photoBrowserPhotos','optionMarkup','renderPhotoGrid'].map(fn).join('\n'),context);
  for(const trashed of [false,true]){
    $('#show-photo-trash').checked=trashed;
    const option=vm.runInContext('optionMarkup(journey.days[0],true)',context);
    vm.runInContext('renderPhotoGrid()',context);
    assert.match(option,/\(1\)/);
    assert.equal(($('#studio-photo-grid').innerHTML.match(/data-photo-id=/g)||[]).length,1);
    assert.match($('#studio-photo-grid').innerHTML,trashed?/data-photo-id="trash"/:/HIDDEN ·/);
  }
  context.basePhotos[0].trashed=true;
  $('#show-photo-trash').checked=false;
  assert.match(vm.runInContext('optionMarkup(journey.days[0],true)',context),/\(0\)/);
});
