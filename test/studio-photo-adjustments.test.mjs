import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import sharp from 'sharp';
import {preparePhotoAdjustment} from '../scripts/studio-photo-adjustments.mjs';
import {importStudioPhoto,atomicJson,uploadManifestPath} from '../scripts/studio-photo-service.mjs';
import {privatePhotoFile} from '../scripts/photo-variants.mjs';
import {loadContent,readJson,validateOverrides} from '../scripts/journey-content.mjs';
import {readOverrides,buildSite} from '../scripts/build-site.mjs';
import {publishPhotoAssets} from '../scripts/publish-photo-assets.mjs';
import {reconcile} from '../scripts/studio-reconcile.mjs';
import {studioDraftDiff} from '../scripts/studio-draft-diff.mjs';
import {photoShareIndex} from '../scripts/build-photo-share-index.mjs';
import {writeStudioDraft,readStudioDraft} from '../scripts/studio-drafts.mjs';
import '../studio/photo-editing.js';

const model=globalThis.JOURNEY_ATLAS_PHOTO_ADJUSTMENTS,utils=globalThis.JOURNEY_ATLAS_UTILS;
const repo=path.resolve(import.meta.dirname,'..'),journeyId='switzerland-italy-family-2026';
const recipe=(rotation=0,crop=model.fullCrop())=>({rotation,crop});
async function fixture(t) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-adjust-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  fs.cpSync(path.join(repo,'content'),path.join(root,'content'),{recursive:true,filter:file=>!file.includes('/drafts')});
  fs.cpSync(path.join(repo,'dist'),path.join(root,'dist'),{recursive:true});
  const bytes=await sharp({create:{width:600,height:400,channels:3,background:'#dc3030'}})
    .composite([{input:await sharp({create:{width:300,height:400,channels:3,background:'#205de0'}}).png().toBuffer(),left:300,top:0}])
    .jpeg().withExif({IFD0:{Artist:'Private fixture'}}).toBuffer();
  const {photo}=await importStudioPhoto(root,{journeyId,dayId:'family-d1',filename:'original.jpg',bytes},{encodeAvif:async()=>undefined});
  const journey=loadContent(root).data.journeys.find(j=>j.id===journeyId),file=uploadManifestPath(root,journey);
  atomicJson(file,readJson(file).map(p=>p.id===photo.id?{...p,assetStatus:'published'}:p));
  return {root,photo:{...photo,assetStatus:'published'}};
}
const install=(root,id,edit)=>{const state=readOverrides(root);state.photos[id]={...state.photos[id],caption:'My caption',imageEdit:edit};atomicJson(path.join(root,'content/photo-overrides.json'),state.photos);return state;};
function publicState(root) { const context={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'dist/assets/content-overrides.js'),'utf8'),context);return JSON.parse(JSON.stringify(context.window.JOURNEY_ATLAS_CONTENT_OVERRIDES)); }
const remoteStore=()=>{const objects=new Map();return {objects,remote:async(resource,options={})=>{if(options.method==='PUT'){objects.set(resource,{body:Buffer.from(options.body),type:options.headers['Content-Type']});return new Response('',{status:200});}const object=objects.get(resource);return object?new Response(object.body,{headers:{'Content-Type':object.type}}):new Response('',{status:404});}};};

test('rotation geometry keeps all four crop corners inside the source and quarter turns keep all pixels',()=>{
  for (const [width,height] of [[600,400],[400,600]]) for(let rotation=-180;rotation<=180;rotation+=3) {
    const f=model.frame(width,height,rotation),angle=-rotation*Math.PI/180;
    for(const x of [-f.width/2,f.width/2])for(const y of [-f.height/2,f.height/2]) {
      assert.ok(Math.abs(x*Math.cos(angle)-y*Math.sin(angle))<=width/2+.00001,`${rotation}° x`);
      assert.ok(Math.abs(x*Math.sin(angle)+y*Math.cos(angle))<=height/2+.00001,`${rotation}° y`);
    }
  }
  assert.deepEqual(model.frame(600,400,90),{width:400,height:600});
  assert.deepEqual(model.frame(600,400,180),{width:600,height:400});
  for(const ratio of [1,4/3,3/2,16/9,4/5,2/3,9/16]) {
    const c=model.presetCrop(600,400,ratio);assert.ok(model.validRecipe(recipe(0,c)));assert.ok(Math.abs(c.width*600/(c.height*400)-ratio)<1e-8);
  }
});
test('rotation/crop produce the selected pixels, matching dimensions and stripped derivatives without modifying source bytes',async t=>{
  const {root,photo}=await fixture(t),original=fs.readFileSync(privatePhotoFile(root,photo.src));
  const edit=await preparePhotoAdjustment(root,{journeyId,photoId:photo.id,recipe:recipe(90,{x:0,y:0,width:1,height:.5})});
  assert.equal(edit.assets.width,400);assert.equal(edit.assets.height,300);
  const image=sharp(privatePhotoFile(root,edit.assets.src)),info=await image.metadata();
  assert.equal(info.exif,undefined);assert.equal(info.xmp,undefined);assert.equal(info.icc,undefined);
  const {data}=await image.raw().toBuffer({resolveWithObject:true});assert.ok(data[0]>data[2],'The top half after clockwise rotation is the red left half');
  assert.deepEqual(fs.readFileSync(privatePhotoFile(root,photo.src)),original);
  const again=await preparePhotoAdjustment(root,{journeyId,photoId:photo.id,recipe:recipe(90,{x:0,y:0,width:1,height:.5})});assert.deepEqual(again,edit);
  const angled=await preparePhotoAdjustment(root,{journeyId,photoId:photo.id,recipe:recipe(13.7)});
  assert.ok(angled.assets.width<600&&angled.assets.height<400);assert.ok(model.validEdit(angled,photo));
  for(const invalid of [recipe(NaN),recipe(181),recipe(0,{x:-.1,y:0,width:1,height:1}),recipe(0,{x:0,y:0,width:0,height:1}),recipe(0,{x:.5,y:0,width:.8,height:1})])await assert.rejects(()=>preparePhotoAdjustment(root,{journeyId,photoId:photo.id,recipe:invalid}));
  await assert.rejects(()=>preparePhotoAdjustment(root,{journeyId,photoId:photo.id,recipe:recipe(0,{x:0,y:0,width:.001,height:.001})}),/larger crop/);
  await assert.rejects(()=>preparePhotoAdjustment(root,{journeyId:'wrong',photoId:photo.id,recipe:recipe()}),/Choose a photo/);
});
test('local crops preserve the published photo until verified, retain the prior crop during reediting, and reset to original',async t=>{
  const {root,photo}=await fixture(t),edit=await preparePhotoAdjustment(root,{journeyId,photoId:photo.id,recipe:recipe(90)});
  install(root,photo.id,edit);buildSite(root);
  assert.equal(publicState(root).photos[photo.id].imageEdit,undefined);
  const api=remoteStore();const result=await publishPhotoAssets(root,journeyId,{publish:true,remote:api.remote});
  assert.equal(result.published,true);assert.ok(api.objects.size>0);
  const published=readOverrides(root).photos[photo.id].imageEdit;assert.equal(published.assets.assetStatus,'published');
  assert.equal(publicState(root).photos[photo.id].imageEdit.assets.src,edit.assets.src);
  const share=photoShareIndex({journeys:[{...loadContent(root).data.journeys.find(j=>j.id===journeyId),photos:[]}],photos:{[journeyId]:[photo]},overrides:publicState(root),site:readJson(path.join(root,'content/site.json'))});
  assert.equal(share.journeys[journeyId].photos[photo.id].thumbnail.key,edit.assets.srcset[0].src.slice('/private-photos/assets/'.length));
  const second=await preparePhotoAdjustment(root,{journeyId,photoId:photo.id,recipe:recipe(-3.2,model.presetCrop(600,400,1))});
  install(root,photo.id,{...second,publishedAssets:published.assets});buildSite(root);
  assert.equal(publicState(root).photos[photo.id].imageEdit.assets.src,edit.assets.src);
  const resolved=utils.resolvePhoto({...photo,fullAvif:{src:'uncropped.avif'}},{imageEdit:second});
  assert.equal(resolved.src,second.assets.src);assert.equal(resolved.fullAvif,undefined);
  await publishPhotoAssets(root,journeyId,{publish:true,remote:api.remote});assert.equal(publicState(root).photos[photo.id].imageEdit.assets.src,second.assets.src);
  install(root,photo.id,null);buildSite(root);
  assert.equal(utils.resolvePhoto(photo,publicState(root).photos[photo.id]).src,photo.src);
  assert.equal(readOverrides(root).photos[photo.id].caption,'My caption');
});
test('failed or raced publication never marks a crop published; independently edited copy survives a successful publish',async t=>{
  const {root,photo}=await fixture(t),edit=await preparePhotoAdjustment(root,{journeyId,photoId:photo.id,recipe:recipe(2)});install(root,photo.id,edit);
  await assert.rejects(()=>publishPhotoAssets(root,journeyId,{publish:true,remote:async()=>new Response('',{status:500})}),/verification failed/);
  assert.equal(readOverrides(root).photos[photo.id].imageEdit.assets.assetStatus,'local');
  const api=remoteStore();let changed=false;
  const remote=async(...args)=>{if(!changed){changed=true;const state=readOverrides(root);state.photos[photo.id].caption='New words during upload';atomicJson(path.join(root,'content/photo-overrides.json'),state.photos);}return api.remote(...args);};
  await publishPhotoAssets(root,journeyId,{publish:true,remote});assert.equal(readOverrides(root).photos[photo.id].caption,'New words during upload');
  install(root,photo.id,edit);changed=false;
  await assert.rejects(()=>publishPhotoAssets(root,journeyId,{publish:true,remote:async(...args)=>{
    if(!changed){changed=true;install(root,photo.id,null);}return api.remote(...args);
  }}),/crop changed/);
  assert.equal(readOverrides(root).photos[photo.id].imageEdit,null);
});
test('unfinished angle/crop survives draft recovery and blocks Save; concurrent recipes conflict as a complete edit',async t=>{
  const {root,photo}=await fixture(t),{data}=loadContent(root),state=install(root,photo.id,{rotation:0,rotationInput:'-',crop:model.fullCrop(),sourceSrc:photo.src,pending:true});
  writeStudioDraft(root,'crop-tab',{schema:1,sequence:1,dirty:true,state,plans:[]});
  assert.equal(readStudioDraft(root,'crop-tab').state.photos[photo.id].imageEdit.rotationInput,'-');
  assert.throws(()=>validateOverrides(state,data),/finish applying/);
  const saved={...state,photos:{...state.photos,[photo.id]:{caption:'My caption'}}};
  assert.equal(globalThis.JOURNEY_ATLAS_PHOTO_EDITING.status({photo,state,saved}).kind,'dirty');
  const diff=studioDraftDiff(data,saved,{state});assert.ok(diff.some(change=>change.displayAfter.text.includes('unfinished')));
  const before={imageEdit:{rotation:0,crop:model.fullCrop()}},mine={imageEdit:{rotation:2,crop:model.fullCrop()}},disk={imageEdit:{rotation:0,crop:{x:0,y:0,width:.5,height:1}}};
  assert.equal(reconcile(before,mine,disk).conflicts.length,1);
  assert.deepEqual(reconcile(before,mine,disk).conflicts[0].path,['imageEdit']);
});
