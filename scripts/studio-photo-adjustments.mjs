import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {loadContent} from './journey-content.mjs';
import {buildPhotoVariants,privatePhotoFile,isPrivatePhotoUrl} from './photo-variants.mjs';
import '../dist/assets/photo-adjustments.js';

const model = globalThis.JOURNEY_ATLAS_PHOTO_ADJUSTMENTS;
export function adjustmentSource(root, photo) {
  // Always start from the unedited derivative; reopening never compounds edits.
  for (const src of [photo.fullAvif?.src,photo.src]) {
    if (isPrivatePhotoUrl(src)) {
      const file = privatePhotoFile(root,src);
      if (fs.existsSync(file)) return file;
    } else if (src?.startsWith('./assets/photos/')) {
      const file = path.resolve(root,'dist',src.slice(2));
      if (file.startsWith(path.join(root,'dist/assets/photos')+path.sep) && fs.existsSync(file)) return file;
    }
  }
  throw new Error('The original photo preview is unavailable locally. Restore its private photo assets, then try again.');
}
export async function preparePhotoAdjustment(root, {journeyId,photoId,recipe}) {
  if (!model.validRecipe(recipe)) throw new Error('Use a valid crop and a rotation between −180° and 180°.');
  const journey = loadContent(root,{includeDrafts:true}).data.journeys.find(j=>j.id===journeyId);
  const photo = journey?.photos.find(p=>p.id===photoId);
  if (!photo) throw new Error('Choose a photo in this journey.');
  const source = adjustmentSource(root,photo);
  const original = sharp(source,{limitInputPixels:100_000_000});
  const info = await original.metadata();
  // Materialize the rotation before extracting: Sharp's operation order must
  // match the browser frame even at arbitrary angles and quarter turns.
  const rotated = await original.rotate(recipe.rotation,{background:'#ffffff'}).raw().toBuffer({resolveWithObject:true});
  const safe = model.frame(info.width,info.height,recipe.rotation);
  const safeW = Math.max(1,Math.floor(safe.width)), safeH = Math.max(1,Math.floor(safe.height));
  const left = Math.max(0,Math.floor((rotated.info.width-safeW)/2 + recipe.crop.x*safeW));
  const top = Math.max(0,Math.floor((rotated.info.height-safeH)/2 + recipe.crop.y*safeH));
  const width = Math.min(rotated.info.width-left,Math.max(1,Math.floor(recipe.crop.width*safeW)));
  const height = Math.min(rotated.info.height-top,Math.max(1,Math.floor(recipe.crop.height*safeH)));
  if (width < 16 || height < 16) throw new Error('Choose a larger crop (at least 16 pixels on each side).');
  const image = sharp(rotated.data,{raw:{width:rotated.info.width,height:rotated.info.height,channels:rotated.info.channels}}).extract({left,top,width,height});
  const variants = await buildPhotoVariants(root,image,width,height);
  const blur = await image.clone().resize({width:32,withoutEnlargement:true}).blur(1.1).webp({quality:28}).toBuffer();
  const largest = variants.at(-1);
  return {rotation:recipe.rotation,crop:{...recipe.crop},sourceSrc:photo.src,assets:{
    src:largest.src,srcset:variants,width:largest.width,height:largest.height,
    blur:`data:image/webp;base64,${blur.toString('base64')}`,protected:true,assetStatus:'local'
  }};
}
