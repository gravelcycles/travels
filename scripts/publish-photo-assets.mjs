#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import {fileURLToPath} from 'node:url';
import {loadJourneys,readJson,validatePhotoAvif} from './journey-content.mjs';
import {readOverrides,buildSite} from './build-site.mjs';
import {atomicJson} from './studio-photo-service.mjs';
import {privatePhotoFile,PRIVATE_PREFIX,MAX_PHOTO_ASSET_BYTES} from './photo-variants.mjs';
import {cloudflareClient} from './cloudflare-client.mjs';

const checksum = data => crypto.createHash('sha256').update(data).digest('hex');
const descriptor = variant => variant && JSON.stringify([variant.src,variant.width,variant.height,variant.bytes]);
const fallbackDescriptor = photo => JSON.stringify([photo.src,photo.width,photo.height,photo.protected,(photo.srcset||[]).map(descriptor)]);

async function prepareAsset(root,variant,format) {
 const pattern=new RegExp(`^/private-photos/assets/v1/[a-f0-9]{64}\\.${format}$`);
 if(!pattern.test(variant?.src||''))throw new Error(`Only private ${format.toUpperCase()} photo paths may be published.`);
 const filename=privatePhotoFile(root,variant.src),data=fs.readFileSync(filename),key=variant.src.slice(PRIVATE_PREFIX.length),digest=checksum(data);
 if(data.length>MAX_PHOTO_ASSET_BYTES)throw new Error('Photo derivative exceeds the protected delivery size limit.');
 if(key!==`v1/${digest}.${format}`)throw new Error('Photo checksum does not match its storage key.');
 const metadata=await sharp(data).metadata();
 if(metadata.width*metadata.height>100_000_000)throw new Error('Photo derivative exceeds the protected delivery dimension limit.');
 const validFormat=format==='webp'?metadata.format==='webp':metadata.format==='heif'&&metadata.compression==='av1'&&metadata.mediaType==='image/avif';
 if(!validFormat||metadata.exif||metadata.xmp||metadata.iptc||metadata.icc||(metadata.pages||1)!==1)throw new Error(`Only metadata-stripped, single-frame ${format.toUpperCase()} files may be uploaded.`);
 // Old WebP manifests can lack height/bytes. New AVIF descriptors are complete.
 for(const [field,actual] of [['width',metadata.width],['height',metadata.height],['bytes',data.length]]) {
  if((format==='avif'||variant[field]!=null)&&(!Number.isInteger(variant[field])||variant[field]!==actual))throw new Error(`Photo ${field} does not match its derivative.`);
 }
 return {key,filename,digest,size:data.length,type:`image/${format}`,width:metadata.width,height:metadata.height};
}

export async function publishPhotoAssets(root,journeyId,{publish=false,all=false,avifOnly=false,concurrency=4,remote,progress=()=>{}}={}) {
 if(!Number.isInteger(concurrency)||concurrency<1||concurrency>4)throw new Error('Photo upload concurrency must be 1–4.');
 if(all&&avifOnly)throw new Error('Choose either all photo assets or pending AVIF upgrades.');
 const journey=loadJourneys(root,{includeDrafts:true}).journeys.find(j=>j.id===journeyId);
 if(!journey)throw new Error('Choose a known journey.');
 if(!journey.published&&publish)throw new Error('Draft journeys stay private.');
 const files=['','-uploads'].map(suffix=>path.join(root,journey.published?`content/photo-manifests/${journeyId}${suffix}.json`:`build/draft-assets/${journeyId}/${suffix?'uploads':'photos'}.json`)).filter(f=>fs.existsSync(f));
 const overrides=readOverrides(root),selected=[];
 for(const file of files)for(const photo of readJson(file)) {
  if(overrides.photos[photo.id]?.trashed)continue;
  const pendingAvif=photo.assetStatus==='published'&&photo.fullAvif?.assetStatus==='local';
  if(avifOnly?!pendingAvif:!(all||photo.assetStatus==='local'||pendingAvif))continue;
  selected.push({file,photo,webp:!avifOnly&&(all||photo.assetStatus==='local'),avif:!!photo.fullAvif&&(all||photo.fullAvif.assetStatus==='local')});
 }
 // Edited derivatives are overrides, so a new crop never replaces its source
 // manifest, photo ID or original pixels. Publish them with the same verifier.
 const sourcePhotos=()=>[...(journey.photos||[]),...files.flatMap(file=>readJson(file))];
 if (!avifOnly) for (const photo of sourcePhotos()) {
  const edit=overrides.photos[photo.id]?.imageEdit;
  if (overrides.photos[photo.id]?.trashed || !edit || (!all && edit.assets?.assetStatus!=='local')) continue;
  if (!globalThis.JOURNEY_ATLAS_PHOTO_ADJUSTMENTS.validEdit(edit,photo)) throw new Error('Finish applying the crop before publishing.');
  selected.push({edit,baseDescriptor:fallbackDescriptor(photo),photo:{...photo,...edit.assets,fullAvif:undefined},webp:true,avif:false});
 }
 const assets=new Map();
 for(const selection of selected) {
  const {photo,webp,avif}=selection;
  validatePhotoAvif(photo);
  if(!photo.protected||!photo.srcset?.length||photo.srcset.length>3)throw new Error('Migrate this photo to the private thumbnail/preview/full-size format first.');
  if(!photo.srcset.some(variant=>variant.src===photo.src)||!/^\/private-photos\/assets\/v1\/[a-f0-9]{64}\.webp$/.test(photo.src))throw new Error('The photo must retain its private WebP fallback.');
  const variants=[...(webp?photo.srcset.map(variant=>[variant,'webp']):[]),...(avif?[[photo.fullAvif,'avif']]:[])];
  if(photo.fullAvif&&!['local','published'].includes(photo.fullAvif.assetStatus))throw new Error('AVIF publication status is invalid.');
  for(const [variant,format] of variants) {
   const asset=await prepareAsset(root,variant,format);
   if(format==='webp'&&variant.src===photo.src&&['width','height'].some(field=>photo[field]!=null&&photo[field]!==asset[field]))throw new Error('Photo dimensions do not match its WebP fallback.');
   assets.set(asset.key,asset);
  }
 }
 const result={journeyId,photos:new Set(selected.map(s=>s.photo.id)).size,assets:assets.size,bytes:[...assets.values()].reduce((n,a)=>n+a.size,0),published:false};
 if(!publish||!selected.length)return result;
 const api=remote||await cloudflareClient(),bucket='/r2/buckets/travels-private-photos';
 if(!remote)for(const endpoint of ['/domains/managed','/domains/custom']) {
  const response=await api(bucket+endpoint);if(!response.ok)throw new Error('Cannot verify private bucket access.');
  const data=await response.json();if(!data.success||data.result?.enabled||data.result?.domains?.length)throw new Error('Disable all public R2 access before publishing.');
 }
 let completed=0,failure;
 const queue=[...assets.values()];
 // Wait for the bounded pool to finish before returning a failed batch. No
 // manifest changes happen until every object has been downloaded and checked.
 await Promise.all(Array.from({length:Math.min(concurrency,queue.length)},async()=>{
  try { while(queue.length&&!failure) {
   const asset=queue.shift(),resource=`${bucket}/objects/${asset.key}`;
   for(let attempt=1;attempt<=3;attempt++) {
    try {
     let response=await api(resource);
     if(response.status===404) {
      const body=fs.readFileSync(asset.filename);
      if(body.length!==asset.size||checksum(body)!==asset.digest)throw new Error('Local photo changed during publication.');
      const uploaded=await api(resource,{method:'PUT',headers:{'Content-Type':asset.type,'Cache-Control':'no-store'},body});
      if(!uploaded.ok)throw new Error(`Photo upload failed (${uploaded.status}).`);
      response=await api(resource);
     }
     if(!response.ok)throw new Error(`Photo verification failed (${response.status}).`);
     if(response.headers.get('Content-Type')!==asset.type)throw new Error('Remote photo MIME type mismatch; existing objects are never overwritten.');
     const bytes=Buffer.from(await response.arrayBuffer());
     if(bytes.length!==asset.size||checksum(bytes)!==asset.digest)throw new Error('Remote photo checksum mismatch; existing objects are never overwritten.');
     break;
    } catch(error) {
     if(attempt===3||!['TypeError','TimeoutError','AbortError'].includes(error.name))throw error;
     // An uncertain PUT is always read again before another write is attempted.
     await new Promise(resolve=>setTimeout(resolve,1000*attempt));
    }
   }
   progress(++completed,assets.size);
  } } catch(error) { failure ||= error; }
 }));
 if(failure)throw failure;

 // Preserve editorial edits made while network requests were in flight. A
 // replaced or removed derivative cannot inherit another asset's verified state.
 const currentOverrides=readOverrides(root),updates=new Map();
 for(const file of new Set(selected.filter(s=>!s.edit).map(selection=>selection.file)))updates.set(file,readJson(file,[]));
 for(const {file,photo,webp,avif,edit,baseDescriptor} of selected) {
  if (edit) {
   const base=sourcePhotos().find(p=>p.id===photo.id);
   if(!base || currentOverrides.photos[photo.id]?.trashed || fallbackDescriptor(base)!==baseDescriptor || base.src!==edit.sourceSrc || JSON.stringify(currentOverrides.photos[photo.id]?.imageEdit)!==JSON.stringify(edit)) throw new Error('Photo crop changed during publication. Verified assets are retained; review and rerun.');
   continue;
  }
  const current=updates.get(file).find(item=>item.id===photo.id);
  if(!current||currentOverrides.photos[photo.id]?.trashed||fallbackDescriptor(current)!==fallbackDescriptor(photo)||
    (!webp&&current.assetStatus!=='published')||(avif&&descriptor(current.fullAvif)!==descriptor(photo.fullAvif))) {
   throw new Error('Photo sources changed during publication. Assets are verified, but local status is unchanged; review and rerun.');
  }
 }
 for(const [file,photos] of updates) {
  const verified=new Map(selected.filter(selection=>selection.file===file).map(selection=>[selection.photo.id,selection]));
  atomicJson(file,photos.map(photo=>{
   const selection=verified.get(photo.id);if(!selection)return photo;
   return {...photo,...(selection.webp?{assetStatus:'published'}:{}),...(selection.avif?{fullAvif:{...photo.fullAvif,assetStatus:'published'}}:{})};
  }));
 }
 if (selected.some(s=>s.edit)) {
  const file=path.join(root,'content/photo-overrides.json');
  const latest=readJson(file,{});
  for(const {photo,edit} of selected.filter(s=>s.edit)) {
   const {publishedAssets,...current}=edit;
   latest[photo.id]={...latest[photo.id],imageEdit:{...current,assets:{...current.assets,assetStatus:'published'}}};
  }
  atomicJson(file,latest);
 }
 buildSite(root);
 return {...result,published:true};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 const args=process.argv.slice(2);let concurrency=4;
 const usage='Usage: npm run photos:publish -- --journey <id> [--all | --avif-only] [--publish] [--concurrency 1–4]';
 if(args[0]!=='--journey'||!args[1])throw new Error(usage);
 for(let i=2;i<args.length;i++) {if(['--publish','--all','--avif-only'].includes(args[i]))continue;if(args[i]==='--concurrency'&&/^[1-4]$/.test(args[i+1]||'')){concurrency=Number(args[++i]);continue;}throw new Error(usage);}
 try {console.log(await publishPhotoAssets(path.resolve(import.meta.dirname,'..'),args[1],{publish:args.includes('--publish'),all:args.includes('--all'),avifOnly:args.includes('--avif-only'),concurrency,progress:(done,total)=>{if(concurrency===1||done%20===0||done===total)console.log(`Verified ${done}/${total} private objects`);}}));}
 catch(error) {console.error(error.message);process.exitCode=1;}
}
