#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {loadJourneys,readJson} from './journey-content.mjs';
import {buildSite} from './build-site.mjs';
import {atomicJson} from './studio-photo-service.mjs';
import {privatePhotoFile,PRIVATE_PREFIX} from './photo-variants.mjs';
import {privateVideoFile,VIDEO_PREFIX,probeVideo,verifyVideoDerivative} from './video-assets.mjs';
import {cloudflareClient} from './cloudflare-client.mjs';

// Leave one decimal GB of headroom under R2 Standard's 10 GB-month allowance.
// This is a conservative preflight, not an account-wide billing guarantee.
export const VIDEO_STORAGE_CEILING = 9_000_000_000;
export function accountStorageBytes(metrics) {
  if (!metrics?.standard?.published || !Number.isFinite(metrics.standard.published.payloadSize)) throw new Error('Cannot verify account storage; video publishing stopped.');
  let bytes=0;
  for (const tier of ['standard','infrequentAccess']) for (const state of ['published','uploaded']) {
    const usage=metrics[tier]?.[state];
    if (!usage) continue;
    for (const field of ['payloadSize','metadataSize']) {
      const value=usage[field] ?? 0;
      if (!Number.isFinite(value) || value<0) throw new Error('Invalid account storage metrics; video publishing stopped.');
      bytes+=value;
    }
  }
  return bytes;
}
export async function publishVideoAssets(root,journeyId,{publish=false,videoId,remote,progress=()=>{}}={}) {
  const journey=loadJourneys(root,{includeDrafts:true}).journeys.find(j=>j.id===journeyId);
  if (!journey) throw new Error('Choose a known journey.');
  if (!journey.published && publish) throw new Error('Draft journeys stay private.');
  const videos=(journey.videos||[]).filter(v=>v.visibility==='private' && !v.hidden && v.assetStatus==='local' && (!videoId || v.id===videoId));
  if (videoId && !videos.length) throw new Error('Choose an unpublished private video in this journey.');
  const assets=new Map();
  for (const video of videos) {
    const file=privateVideoFile(root,video.src);verifyVideoDerivative(await probeVideo(file));
    for (const asset of [
      {file,key:`video/${video.src.slice(VIDEO_PREFIX.length)}`,type:'video/mp4',expected:video.bytes},
      {file:privatePhotoFile(root,video.poster),key:video.poster.slice(PRIVATE_PREFIX.length),type:'image/webp',expected:video.posterBytes}
    ]) {
      const bytes=fs.readFileSync(asset.file),digest=crypto.createHash('sha256').update(bytes).digest('hex');
      if (!asset.key.endsWith(`/${digest}.${asset.type==='video/mp4'?'mp4':'webp'}`) || bytes.length!==asset.expected) throw new Error('Video/poster checksum or size mismatch.');
      if (asset.type==='image/webp') { const m=await sharp(bytes).metadata();if(m.format!=='webp'||m.exif||m.xmp||m.iptc)throw new Error('Poster must be metadata-stripped WebP.'); }
      assets.set(asset.key,{...asset,digest,size:bytes.length});
    }
  }
  const result={journeyId,videos:videos.length,videoIds:videos.map(v=>v.id),assets:assets.size,bytes:[...assets.values()].reduce((n,a)=>n+a.size,0),published:false};
  if (!publish || !videos.length) return result;
  const api=remote || await cloudflareClient(),bucket='/r2/buckets/travels-private-photos';
  for (const endpoint of ['/domains/managed','/domains/custom']) {
    const response=await api(bucket+endpoint);if(!response.ok)throw new Error('Cannot verify private bucket access.');
    const body=await response.json();if(!body.success||body.result?.enabled||body.result?.domains?.length)throw new Error('Disable all public R2 access before publishing.');
  }
  const response=await api('/r2/metrics');if(!response.ok)throw new Error('Cannot verify account storage; video publishing stopped.');
  const usage=await response.json();if(!usage.success)throw new Error('Cannot verify account storage; video publishing stopped.');
  const used=accountStorageBytes(usage.result);
  if (used+result.bytes>VIDEO_STORAGE_CEILING) throw new Error('Video upload would exceed the 9 GB account storage ceiling. Remove reviewed assets or shorten clips first.');
  let completed=0;
  // Sequential streaming verification bounds memory and makes retries idempotent.
  for (const asset of assets.values()) {
    const resource=`${bucket}/objects/${asset.key}`;let existing=await api(resource);
    if (existing.status===404) {
      const uploaded=await api(resource,{method:'PUT',headers:{'Content-Type':asset.type,'Cache-Control':'no-store'},body:fs.readFileSync(asset.file)});
      if (!uploaded.ok) throw new Error(`Video upload failed (${uploaded.status}).`);
      existing=await api(resource);
    }
    if (!existing.ok) throw new Error(`Video verification failed (${existing.status}).`);
    const hash=crypto.createHash('sha256');let size=0;
    for await (const chunk of existing.body) { size+=chunk.length;if(size>asset.size)throw new Error('Remote video size mismatch.');hash.update(chunk); }
    if (size!==asset.size || hash.digest('hex')!==asset.digest) throw new Error('Remote video checksum mismatch; existing objects are never overwritten.');
    progress(++completed,assets.size);
  }
  const source=path.join(root,`content/journeys/${journeyId}.json`),latest=readJson(source);
  // An edited/replaced/removed clip during publishing must never gain a status
  // from an older asset selection. Mark only the exact verified pair.
  const verified=new Map(videos.map(video=>[video.id,video]));
  for(const [id,original] of verified) {
    const current=latest.videos?.find(video=>video.id===id);
    if(!current || current.src!==original.src || current.poster!==original.poster || current.visibility!=='private') throw new Error('Video sources changed during publication. Assets are verified, but local status is unchanged; review and rerun.');
  }
  atomicJson(source,{...latest,videos:(latest.videos||[]).map(video=>{
    const original=verified.get(video.id);
    return original && video.src===original.src && video.poster===original.poster ? {...video,assetStatus:'published'} : video;
  })});
  buildSite(root);
  return {...result,accountStorageBytes:used,storageCeilingBytes:VIDEO_STORAGE_CEILING,published:true};
}
if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const args=process.argv.slice(2),id=args.indexOf('--video');
  if (args[0]!=='--journey'||!args[1]||args.some((a,i)=>i>1&&a!=='--publish'&&a!=='--video'&&i!==id+1)) throw new Error('Usage: npm run videos:publish -- --journey <id> [--video <id>] [--publish]');
  try { console.log(await publishVideoAssets(path.resolve(import.meta.dirname,'..'),args[1],{publish:args.includes('--publish'),videoId:id<0?undefined:args[id+1]})); }
  catch(error) {console.error(error.message);process.exitCode=1;}
}
