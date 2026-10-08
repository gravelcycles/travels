import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {importStudioVideo} from '../scripts/studio-video-service.mjs';
import {probeVideo,privateVideoFile,verifyVideoDerivative,videoFacts} from '../scripts/video-assets.mjs';
import {publishVideoAssets,accountStorageBytes} from '../scripts/publish-video-assets.mjs';
import {readJson,loadContent,writeJson} from '../scripts/journey-content.mjs';
import {privatePhotoFile} from '../scripts/photo-variants.mjs';
import {buildSite} from '../scripts/build-site.mjs';
import {writePlanSources} from '../scripts/studio-plan-sources.mjs';
import sharp from 'sharp';
const repo=path.resolve(import.meta.dirname,'..');
function fixture(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-video-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));for(const dir of ['content','dist'])fs.cpSync(path.join(repo,dir),path.join(root,dir),{recursive:true,filter:file=>!file.includes('/drafts/')});return root;}
function synthetic(root){const file=path.join(root,'fixture.mov');execFileSync(process.env.ATLAS_FFMPEG||'ffmpeg',['-nostdin','-v','error','-f','lavfi','-i','testsrc2=size=320x180:rate=24','-f','lavfi','-i','sine=frequency=440:sample_rate=44100','-t','1','-c:v','libx264','-c:a','aac','-metadata','title=PRIVATE SOURCE','-metadata','location=+47.5000+008.5000/','-metadata','creation_time=2026-08-14T12:00:00Z','-y',file],{timeout:30000});return fs.readFileSync(file);}
function remoteFixture(){const writes=[],objects=new Map();let usage=100_000_000,badChecksum=false,publicBucket=false;return{writes,objects,set usage(v){usage=v;},set badChecksum(v){badChecksum=v;},set publicBucket(v){publicBucket=v;},async api(resource,options={}){
 if(resource.endsWith('/domains/managed'))return Response.json({success:true,result:{enabled:publicBucket}});
 if(resource.endsWith('/domains/custom'))return Response.json({success:true,result:{domains:[]}});
 if(resource==='/r2/metrics')return Response.json({success:true,result:{standard:{published:{payloadSize:usage,metadataSize:0}}}});
 if(options.method==='PUT'){writes.push(resource);objects.set(resource,options.body);return new Response(null,{status:200});}
 return objects.has(resource)?new Response(badChecksum?new Uint8Array([1]):objects.get(resource)):new Response(null,{status:404});
 }};}
test('private intake strips metadata, retains originals privately, deduplicates and publishes only verified derivatives',async t=>{
 const root=fixture(t),journey=loadContent(root).data.journeys.find(j=>j.kind==='real'),bytes=synthetic(root);
 const input={journeyId:journey.id,dayId:journey.days[0].id,title:'Synthetic clip',filename:'PRIVATE-original.mov',bytes};
 const first=await importStudioVideo(root,input),video=first.video;
 assert.equal(video.assetStatus,'local');assert.equal(video.visibility,'private');assert.equal(video.protected,true);
 const metadata=await probeVideo(privateVideoFile(root,video.src));assert.equal(verifyVideoDerivative(metadata).video.codec_name,'h264');assert.doesNotMatch(JSON.stringify(metadata),/PRIVATE SOURCE|47\.5000|2026-08-14/);
 const poster=await sharp(privatePhotoFile(root,video.poster)).metadata();assert.equal(poster.format,'webp');assert.equal(poster.exif,undefined);
 const original=readJson(path.join(root,'photos/studio-video-uploads',journey.id,`${video.sourceHash}.json`));assert.equal(original.sourceFilename,'PRIVATE-original.mov');assert.match(JSON.stringify(original),/PRIVATE SOURCE/);
 assert.equal((await importStudioVideo(root,{...input,dayId:journey.days.at(-1).id,title:'Changed'})).video.dayId,video.dayId);
 buildSite(root);assert.doesNotMatch(fs.readFileSync(path.join(root,'dist/assets/journeys.js'),'utf8'),new RegExp(video.id));
 const remote=remoteFixture();const dry=await publishVideoAssets(root,journey.id,{remote:remote.api});assert.equal(dry.assets,2);assert.equal(dry.published,false);assert.equal(remote.writes.length,0);
 remote.badChecksum=true;await assert.rejects(publishVideoAssets(root,journey.id,{publish:true,remote:remote.api}),/size mismatch|checksum mismatch/);assert.equal(loadContent(root).data.journeys.find(j=>j.id===journey.id).videos[0].assetStatus,'local');
 remote.badChecksum=false;const done=await publishVideoAssets(root,journey.id,{publish:true,remote:remote.api});assert.equal(done.published,true);assert.equal(remote.writes.length,2);
 const publicData=fs.readFileSync(path.join(root,'dist/assets/journeys.js'),'utf8');assert.match(publicData,new RegExp(video.id));assert.doesNotMatch(publicData,new RegExp(video.sourceHash));assert.doesNotMatch(publicData,/PRIVATE-original|PRIVATE SOURCE/);
 const sourceFile=path.join(root,`content/journeys/${journey.id}.json`),source=readJson(sourceFile);
 for(const field of ['transcript','captions']){
   const unsafe=structuredClone(source);unsafe.videos[0][field]=field==='transcript'?'PRIVATE SPEECH':[{start:0,end:.5,text:'PRIVATE SPEECH'}];writeJson(sourceFile,unsafe);
   assert.throws(()=>buildSite(root),/private transcripts/);assert.doesNotMatch(fs.readFileSync(path.join(root,'dist/assets/journeys.js'),'utf8'),/PRIVATE SPEECH/);
 }
 writeJson(sourceFile,source);
 const saved=loadContent(root).data.journeys.find(j=>j.id===journey.id),edited=structuredClone(saved);edited.videos[0].assetStatus='local';assert.throws(()=>writePlanSources(root,saved,edited),/managed by import\/publish/);
});
test('bad inputs, missing day, oversized/long videos and exceeded storage never publish',async t=>{
 const root=fixture(t),journey=loadContent(root).data.journeys[0],input={journeyId:journey.id,dayId:journey.days[0].id,title:'Fixture',filename:'clip.mov',bytes:Buffer.from('not-video')};
 await assert.rejects(importStudioVideo(root,{...input,dayId:'unknown'}),/Choose a day/);await assert.rejects(importStudioVideo(root,{...input,filename:'bad.m3u8'}),/Choose a MOV/);await assert.rejects(importStudioVideo(root,input),/could not be read/);
 assert.throws(()=>videoFacts({streams:[{codec_type:'video',width:20,height:20}],format:{duration:301}}),/5 minutes/);
 assert.throws(()=>verifyVideoDerivative({streams:[{codec_type:'video',width:20,height:20,codec_name:'h264',pix_fmt:'yuv420p',tags:{location:'secret'}}],format:{duration:1}}),/private source metadata/);
 assert.throws(()=>accountStorageBytes({}),/Cannot verify/);
 await importStudioVideo(root,{...input,bytes:synthetic(root)});const remote=remoteFixture();remote.usage=8_999_999_999;
 await assert.rejects(publishVideoAssets(root,journey.id,{publish:true,remote:remote.api}),/9 GB/);assert.equal(remote.writes.length,0);
 remote.usage=1;remote.publicBucket=true;await assert.rejects(publishVideoAssets(root,journey.id,{publish:true,remote:remote.api}),/Disable all public/);assert.equal(remote.writes.length,0);
});
