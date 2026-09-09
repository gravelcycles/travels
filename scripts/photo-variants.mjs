import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
export const PRIVATE_PREFIX = '/private-photos/assets/';
export const isPrivatePhotoUrl = src => /^\/private-photos\/assets\/v1\/[a-f0-9]{64}\.webp$/.test(src || '');
export function photoWidths(width, height) {
  if (![width,height].every(n=>Number.isInteger(n)&&n>0)) throw new Error('Invalid photo dimensions');
  const big = Math.max(1, Math.round(width * Math.min(1, 3200 / Math.max(width,height))));
  return [...new Set([Math.min(480,big),Math.min(1280,big),big])];
}
export function privatePhotoFile(root, src) {
  if (!isPrivatePhotoUrl(src)) throw new Error('Invalid private photo path');
  return path.join(root, 'build/private-photo-assets', src.slice(PRIVATE_PREFIX.length));
}
export function storeDerivative(root, bytes) {
  const hash = crypto.createHash('sha256').update(bytes).digest('hex');
  const src = `${PRIVATE_PREFIX}v1/${hash}.webp`, file = privatePhotoFile(root,src);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!fs.existsSync(file)) { fs.writeFileSync(`${file}.tmp`,bytes);fs.renameSync(`${file}.tmp`,file); }
  else if (!fs.readFileSync(file).equals(bytes)) throw new Error('Photo content hash collision');
  return src;
}
export async function buildPhotoVariants(root, image, width, height) {
  const variants=[];
  for (const size of photoWidths(width,height)) {
    const { data, info } = await image.clone().resize({width:size,withoutEnlargement:true}).webp({quality:size<=480?80:84,effort:5,smartSubsample:true}).toBuffer({resolveWithObject:true});
    variants.push({src:storeDerivative(root,data),width:info.width,height:info.height,bytes:info.size});
  }
  return variants;
}
export function existingPhotoVariants(photo) {
  const candidates=[...(photo.srcset||[])].sort((a,b)=>a.width-b.width);
  if(!candidates.length)throw new Error(`Photo ${photo.id} has no derivatives`);
  const big=candidates.at(-1),small=candidates.find(v=>v.width>=1280)||big,thumbnail=candidates.find(v=>v.width>=480)||big;
  return [...new Map([thumbnail,small,big].map(v=>[v.src,v])).values()];
}
