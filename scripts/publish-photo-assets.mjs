#!/usr/bin/env node
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import sharp from 'sharp';import {fileURLToPath} from 'node:url';
import {loadJourneys,readJson} from './journey-content.mjs';
import {readOverrides,buildSite} from './build-site.mjs';
import {atomicJson} from './studio-photo-service.mjs';
import {privatePhotoFile,isPrivatePhotoUrl,PRIVATE_PREFIX} from './photo-variants.mjs';
import {cloudflareClient} from './cloudflare-client.mjs';
export async function publishPhotoAssets(root,journeyId,{publish=false,all=false,concurrency=4,remote,progress=()=>{}}={}){
 if(!Number.isInteger(concurrency)||concurrency<1||concurrency>4)throw new Error('Photo upload concurrency must be 1–4.');
 const journey=loadJourneys(root,{includeDrafts:true}).journeys.find(j=>j.id===journeyId);
 if(!journey)throw new Error('Choose a known journey.');if(!journey.published&&publish)throw new Error('Draft journeys stay private.');
 const files=['','-uploads'].map(suffix=>path.join(root,journey.published?`content/photo-manifests/${journeyId}${suffix}.json`:`build/draft-assets/${journeyId}/${suffix?'uploads':'photos'}.json`)).filter(f=>fs.existsSync(f));
 const overrides=readOverrides(root),photos=files.flatMap(f=>readJson(f)).filter(p=>(all||p.assetStatus==='local')&&!overrides.photos[p.id]?.trashed);
 const assets=new Map();
 for(const photo of photos){if(!photo.protected||!photo.srcset?.length||photo.srcset.length>3)throw new Error('Migrate this photo to the private thumbnail/preview/full-size format first.');for(const variant of photo.srcset){
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
 await Promise.all(Array.from({length:Math.min(concurrency,queue.length)},async()=>{while(queue.length){const asset=queue.shift(),resource=`${bucket}/objects/${asset.key}`;
  for(let attempt=1;attempt<=3;attempt++){
   try{
    let response=await api(resource);
    if(response.status===404){const uploaded=await api(resource,{method:'PUT',headers:{'Content-Type':'image/webp','Cache-Control':'no-store'},body:fs.readFileSync(asset.filename)});if(!uploaded.ok)throw new Error(`Photo upload failed (${uploaded.status}).`);response=await api(resource);}
    if(!response.ok)throw new Error(`Photo verification failed (${response.status}).`);
    const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length!==asset.size||crypto.createHash('sha256').update(bytes).digest('hex')!==asset.digest)throw new Error('Remote photo checksum mismatch; existing objects are never overwritten.');
    break;
   }catch(error){
    if(attempt===3||!['TypeError','TimeoutError','AbortError'].includes(error.name))throw error;
    // A PUT may have succeeded before the connection broke: always check the
    // object again, and never overwrite an existing checksum mismatch.
    await new Promise(resolve=>setTimeout(resolve,1000*attempt));
   }
  }
  progress(++completed,assets.size);
 }}));
 const ids=new Set(photos.map(p=>p.id));for(const file of files)atomicJson(file,readJson(file).map(p=>ids.has(p.id)?{...p,assetStatus:'published'}:p));
 buildSite(root);return {...result,published:true};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2);let concurrency=4;
 const usage='Usage: npm run photos:publish -- --journey <id> [--all] [--publish] [--concurrency 1–4]';
 if(args[0]!=='--journey'||!args[1])throw new Error(usage);
 for(let i=2;i<args.length;i++){if(['--publish','--all'].includes(args[i]))continue;if(args[i]==='--concurrency'&&/^[1-4]$/.test(args[i+1]||'')){concurrency=Number(args[++i]);continue;}throw new Error(usage);}
 try{console.log(await publishPhotoAssets(path.resolve(import.meta.dirname,'..'),args[1],{publish:args.includes('--publish'),all:args.includes('--all'),concurrency,progress:(done,total)=>{if(concurrency===1||done%20===0||done===total)console.log(`Verified ${done}/${total} private objects`);}}));}catch(error){console.error(error.message);process.exitCode=1;}
}
