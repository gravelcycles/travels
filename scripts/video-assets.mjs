import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import sharp from 'sharp';
import {storeDerivative} from './photo-variants.mjs';
import {VIDEO_PREFIX,MAX_VIDEO_BYTES,MAX_VIDEO_SECONDS,isPrivateVideoUrl} from './video-contract.mjs';
export {VIDEO_PREFIX,MAX_VIDEO_BYTES,MAX_VIDEO_SECONDS,isPrivateVideoUrl} from './video-contract.mjs';
export function privateVideoFile(root, src) {
  if (!isPrivateVideoUrl(src)) throw new Error('Invalid private video path');
  return path.join(root, 'build/private-video-assets', src.slice(VIDEO_PREFIX.length));
}
const run = promisify(execFile);
export async function probeVideo(filename) {
  try {
    const {stdout} = await run(process.env.ATLAS_FFPROBE || 'ffprobe', ['-v','error','-protocol_whitelist','file,pipe','-show_format','-show_streams','-of','json',filename], {timeout:30000,maxBuffer:2*1024*1024});
    return JSON.parse(stdout);
  } catch (error) {
    throw new Error(error.code === 'ENOENT' ? 'Install ffmpeg (including ffprobe) to import videos.' : 'This video could not be read. Export a MOV, MP4 or WebM and try again.');
  }
}
export function videoFacts(metadata) {
  const streams = metadata.streams || [], video = streams.find(stream => stream.codec_type === 'video' && !stream.disposition?.attached_pic);
  const durationSeconds = Number(metadata.format?.duration || video?.duration);
  if (!video || !Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > MAX_VIDEO_SECONDS) throw new Error('Choose a video no longer than 5 minutes.');
  if (![video.width,video.height].every(n => Number.isInteger(n) && n > 0 && n <= 8192) || video.width*video.height > 34_000_000) throw new Error('Video dimensions exceed the supported limit.');
  return {durationSeconds,width:video.width,height:video.height,video,audio:streams.find(stream=>stream.codec_type==='audio')};
}
// Only structural encoder/container fields survive; camera time, GPS, names,
// device tags, extra tracks and chapters never enter published derivatives.
export function verifyVideoDerivative(metadata) {
  const facts = videoFacts(metadata), streams = metadata.streams || [];
  if (facts.video.codec_name !== 'h264' || facts.video.pix_fmt !== 'yuv420p' || Math.max(facts.width,facts.height) > 1280 || streams.some(s => !['video','audio'].includes(s.codec_type)) || streams.filter(s=>s.codec_type==='video').length !== 1 || streams.filter(s=>s.codec_type==='audio').length > 1 || (facts.audio && facts.audio.codec_name !== 'aac')) throw new Error('Video must be a bounded H.264/AAC derivative.');
  const allowed = new Set(['major_brand','minor_version','compatible_brands','encoder','language','handler_name','vendor_id']);
  for (const item of [metadata.format,...streams]) for (const key of Object.keys(item?.tags || {})) if (!allowed.has(key.toLowerCase())) throw new Error('Video contains private source metadata.');
  return facts;
}
export async function buildVideoAssets(root, source, staging) {
  const metadata = await probeVideo(source), facts = videoFacts(metadata);
  const output = path.join(staging,'derivative.mp4'), poster = path.join(staging,'poster.png');
  const args = ['-nostdin','-v','error','-protocol_whitelist','file,pipe','-i',source,'-map',`0:${facts.video.index}`,'-map','0:a:0?','-map_metadata','-1','-map_chapters','-1','-sn','-dn','-vf',"scale=w='min(1280,iw)':h='min(1280,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2,setsar=1",'-c:v','libx264','-pix_fmt','yuv420p','-preset','fast','-crf','23','-maxrate','4000k','-bufsize','8000k','-r','30','-c:a','aac','-b:a','128k','-ac','2','-movflags','+faststart','-y',output];
  try {
    await run(process.env.ATLAS_FFMPEG || 'ffmpeg', args, {timeout:15*60*1000,maxBuffer:1024*1024});
    await run(process.env.ATLAS_FFMPEG || 'ffmpeg', ['-nostdin','-v','error','-i',output,'-frames:v','1','-vf','scale=640:-2','-map_metadata','-1','-y',poster], {timeout:30000,maxBuffer:1024*1024});
  } catch (error) { throw new Error(error.code === 'ENOENT' ? 'Install ffmpeg to import videos.' : 'Video conversion failed. The source is unchanged; try a shorter clip or export it again.'); }
  const checked = verifyVideoDerivative(await probeVideo(output)), bytes = fs.readFileSync(output);
  if (bytes.length > MAX_VIDEO_BYTES) throw new Error('Prepared video exceeds 250 MB. Use a shorter clip.');
  const digest = crypto.createHash('sha256').update(bytes).digest('hex'), src = `${VIDEO_PREFIX}v1/${digest}.mp4`, destination = privateVideoFile(root,src);
  fs.mkdirSync(path.dirname(destination),{recursive:true});
  if (fs.existsSync(destination) && !fs.readFileSync(destination).equals(bytes)) throw new Error('Video content hash collision');
  fs.writeFileSync(destination,bytes);
  const posterBytes = await sharp(poster).resize({width:640,withoutEnlargement:true}).webp({quality:82}).toBuffer();
  return {asset:{src,poster:storeDerivative(root,posterBytes),durationSeconds:checked.durationSeconds,width:checked.width,height:checked.height,bytes:bytes.length,posterBytes:posterBytes.length},metadata,sourceDurationSeconds:facts.durationSeconds};
}
