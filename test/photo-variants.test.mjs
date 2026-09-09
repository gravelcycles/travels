import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import sharp from 'sharp';
import {photoWidths,buildPhotoVariants,privatePhotoFile} from '../scripts/photo-variants.mjs';
test('thumbnail, preview and full sizes cap the long edge, never upscale, and collapse small sources',()=>{
 assert.deepEqual(photoWidths(4000,3000),[480,1280,3200]);assert.deepEqual(photoWidths(3000,4000),[480,1280,2400]);assert.deepEqual(photoWidths(700,400),[480,700]);assert.deepEqual(photoWidths(200,400),[200]);
});
test('repeat processing shares content-addressed files and removes camera metadata',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-variants-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const image=sharp(await sharp({create:{width:1600,height:1000,channels:3,background:'#366455'}}).jpeg().withExif({IFD0:{Artist:'Private fixture'}}).toBuffer());
 const a=await buildPhotoVariants(root,image,1600,1000),b=await buildPhotoVariants(root,image,1600,1000);assert.deepEqual(a,b);assert.equal(fs.readdirSync(path.join(root,'build/private-photo-assets/v1')).length,3);
 const info=await sharp(privatePhotoFile(root,a[0].src)).metadata();assert.equal(info.exif,undefined);assert.equal(info.width,480);
});
