import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import '../dist/assets/atlas-utils.js';
import '../studio/photo-batch.js';
const repo = path.resolve(import.meta.dirname, '..');
const batch = globalThis.JOURNEY_ATLAS_PHOTO_BATCH;
export function uiHarness(f) {
  const nodes=new Map(),node=key=>{if(!nodes.has(key))nodes.set(key,{value:'',checked:false,hidden:false,disabled:false,dataset:{},handlers:{},textContent:'',innerHTML:'',setAttribute(){},addEventListener(type,handler){this.handlers[type]=handler;},querySelectorAll(){return [];}});return nodes.get(key);};
  node('#photo-day-filter').value='all';node('#photo-batch-action').value='assign';
  const context=vm.createContext({window:{JOURNEY_ATLAS_PHOTO_BATCH:batch,JOURNEY_ATLAS_UTILS:globalThis.JOURNEY_ATLAS_UTILS},document:{querySelector:node},Set});
  vm.runInContext(fs.readFileSync(path.join(repo,'studio/photo-batch-ui.js'),'utf8'),context);
  let api,selectedPhotoId=null;
  const render=()=>api.render(batch.orderedPhotos(f.journey,f.photos,f.state),selectedPhotoId);
  api=context.window.JOURNEY_ATLAS_PHOTO_BATCH_UI.create({getContext:()=>f,replaceState:state=>{f.state=state;render();},redraw:render,selectPhoto:id=>{selectedPhotoId=id;render();},resizeMap(){},photoUrl:x=>x||'',escapeHtml:x=>String(x??'')});
  render();return {api,node,render,f};
}
