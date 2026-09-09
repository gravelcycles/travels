#!/usr/bin/env node
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import sharp from 'sharp';import {fileURLToPath} from 'node:url';
import {loadJourneys,readJson} from './journey-content.mjs';
import {readOverrides,buildSite} from './build-site.mjs';
import {atomicJson} from './studio-photo-service.mjs';
import {privatePhotoFile,isPrivatePhotoUrl,PRIVATE_PREFIX} from './photo-variants.mjs';
import {cloudflareClient} from './cloudflare-client.mjs';
export async function publishPhotoAssets(root,journeyId,{publish=false,all=false,remote,progress=()=>{}}={}){
 const journey=loadJourneys(root,{includeDrafts:true}).journeys.find(j=>j.id===journeyId);
 if(!journey)throw new Error('Choose a known journey.');if(!journey.published&&publish)throw new Error('Draft journeys stay private.');
 const files=['','-uploads'].map(suffix=>path.join(root,journey.published?`content/photo-manifests/${journeyId}${suffix}.json`:`build/draft-assets/${journeyId}/${suffix?'uploads':'photos'}.json`)).filter(f=>fs.existsSync(f));
 const overrides=readOverrides(root),photos=files.flatMap(f=>readJson(f)).filter(p=>(all||p.assetStatus==='local')&&!overrides.photos[p.id]?.hidden&&!overrides.photos[p.id]?.trashed);
 const assets=new Map();
 for(const photo of photos){if(!photo.protected||!photo.srcset?.length||photo.srcset.length>2)throw new Error('Migrate this photo to the private two-size format first.');for(const variant of photo.srcset){
  if(!isPrivatePhotoUrl(variant.src))throw new Error('Only private photo paths may be published.');
  const filename=privatePhotoFile(root,variant.src),data=fs.readFileSync(filename),key=variant.src.slice(PRIVATE_PREFIX.length),digest=crypto.createHash('sha256').update(data).digest('hex');
  if(key!==`v1/${digest}.webp`)throw new Error('Photo checksum does not match its storage key.');
  const metadata=await sharp(data).metadata();if(metadata.format!=='webp'||metadata.exif||metadata.xmp||metadata.iptc)throw new Error('Only metadata-stripped WebP files may be uploaded.');
  assets.set(key,{key,filename,digest,size:data.length});
 }}
 const result={journeyId,photos:photos.length,assets:assets.size,bytes:[...assets.values()].reduce((n,a)=>n+a.size,0),published:false};
 if(!publish||!photos.length)return result;
 const api=remote||await cloudflareClient();const bucket='/r2/buckets/travels-private-photos';
 if(!remote){for(const endpoint of ['/domains/managed','/domains/custom']){const response=await api(bucket+endpoint);if(!response.ok)throw new Error('Cannot verify private bucket access.');const data=await response.json();if(!data.success||data.result?.enabled||data.result?.domains?.length)throw new Error('Disable all public R2 access before publishing.');}}
 let completed=0;
 // A small pool keeps upload/checksum verification bounded and retryable.
 const queue=[...assets.values()];
 await Promise.all(Array.from({length:Math.min(4,queue.length)},async()=>{while(queue.length){const asset=queue.shift(),resource=`${bucket}/objects/${asset.key}`;let response=await api(resource);
  if(response.status===404){const uploaded=await api(resource,{method:'PUT',headers:{'Content-Type':'image/webp','Cache-Control':'no-store'},body:fs.readFileSync(asset.filename)});if(!uploaded.ok)throw new Error(`Photo upload failed (${uploaded.status}).`);response=await api(resource);}
  if(!response.ok)throw new Error(`Photo verification failed (${response.status}).`);
  const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length!==asset.size||crypto.createHash('sha256').update(bytes).digest('hex')!==asset.digest)throw new Error('Remote photo checksum mismatch; existing objects are never overwritten.');
  progress(++completed,assets.size);
 }}));
 const ids=new Set(photos.map(p=>p.id));for(const file of files)atomicJson(file,readJson(file).map(p=>ids.has(p.id)?{...p,assetStatus:'published'}:p));
 buildSite(root);return {...result,published:true};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2);if(args[0]!=='--journey'||!args[1]||args.slice(2).some(a=>!['--publish','--all'].includes(a)))throw new Error('Usage: npm run photos:publish -- --journey <id> [--all] [--publish]');
 try{console.log(await publishPhotoAssets(path.resolve(import.meta.dirname,'..'),args[1],{publish:args.includes('--publish'),all:args.includes('--all'),progress:(done,total)=>{if(done%20===0||done===total)console.log(`Verified ${done}/${total} private objects`);}}));}catch(error){console.error(error.message);process.exitCode=1;}
}
