import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {loadJourneys,readJson,validateJourneys,loadContent} from './journey-content.mjs';
import {atomicJson} from './studio-photo-service.mjs';
import {MAX_VIDEO_BYTES,buildVideoAssets} from './video-assets.mjs';
export {MAX_VIDEO_BYTES} from './video-assets.mjs';

export async function importStudioVideo(root,{journeyId,dayId,filename,title,bytes}) {
  if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > MAX_VIDEO_BYTES) throw new Error('Choose a nonempty video up to 250 MB.');
  const extension = path.extname(filename || '').toLowerCase();
  if (!['.mov','.mp4','.m4v','.webm'].includes(extension)) throw new Error('Choose a MOV, MP4 or WebM video.');
  const journey = loadJourneys(root,{includeDrafts:true}).journeys.find(item=>item.id===journeyId);
  if (!journey?.days.some(day=>day.id===dayId)) throw new Error('Choose a day in this journey.');
  if (typeof title !== 'string' || !title.trim() || title.length > 200) throw new Error('Give this video a title (up to 200 characters).');
  const sourceHash = crypto.createHash('sha256').update(bytes).digest('hex'), id = `${journey.id}-video-${sourceHash.slice(0,20)}`;
  const existing = journey.videos?.find(video=>video.id===id);
  if (existing) return {video:existing,duplicate:true,warnings:['This video is already imported. Its day and edits were kept.']};
  fs.mkdirSync(path.join(root,'build'),{recursive:true});
  const staging = fs.mkdtempSync(path.join(root,'build/video-upload-')), original = path.join(staging,`source${extension}`);
  fs.writeFileSync(original,bytes);
  try {
    const {asset,metadata} = await buildVideoAssets(root,original,staging);
    const video = {id,dayId,title:title.trim(),caption:'',...asset,mimeType:'video/mp4',visibility:'private',protected:true,assetStatus:'local',sourceHash};
    // Re-read after transcoding; other saved content and completed imports win.
    const sourcePath = path.join(root,`content/${journey.published?'journeys':'drafts'}/${journey.id}.json`), latest = readJson(sourcePath);
    const duplicate = latest.videos?.find(item=>item.id===id);
    if (duplicate) return {video:duplicate,duplicate:true,warnings:['This video is already imported. Its day and edits were kept.']};
    const candidate = {...latest,videos:[...(latest.videos || []),video]};
    const {data} = loadContent(root,{includeDrafts:true});
    validateJourneys({...data,journeys:data.journeys.map(item=>item.id===journey.id?{...candidate,photos:item.photos}:item)});
    const originals = path.join(root,'photos/studio-video-uploads',journey.id);
    fs.mkdirSync(originals,{recursive:true});fs.copyFileSync(original,path.join(originals,`${sourceHash}${extension}`));
    atomicJson(path.join(originals,`${sourceHash}.json`),{id,sourceFilename:path.basename(filename),metadata,importedAt:new Date().toISOString()});
    fs.mkdirSync(path.join(root,'build/studio-backups'),{recursive:true});
    fs.copyFileSync(sourcePath,path.join(root,'build/studio-backups',`${Date.now()}-${crypto.randomUUID()}-${journey.id}.json`));
    atomicJson(sourcePath,candidate);
    return {video,duplicate:false,warnings:['Prepared privately. Review in the journey preview before publishing. Original metadata is retained only on this computer.']};
  } finally { fs.rmSync(staging,{recursive:true,force:true}); }
}
