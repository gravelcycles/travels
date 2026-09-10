import test from 'node:test';
import assert from 'node:assert/strict';
import '../dist/assets/media-utils.js';

const {createPosterLoader} = globalThis.JOURNEY_ATLAS_MEDIA;
function fixture({fail = false} = {}) {
  const videos = [], draws = [];
  const document = {createElement(type) {
    if (type === 'canvas') return {getContext: () => ({drawImage: (...args) => draws.push(args)}), toDataURL: () => 'data:image/webp;base64,frame'};
    const video = {readyState:2, videoWidth:1920, videoHeight:1080, duration:5, pauseCount:0, loadCount:0,
      pause() { this.pauseCount++; }, removeAttribute(name) { delete this[name]; }, load() {
        this.loadCount++;
        if (this.src) queueMicrotask(() => { if (fail) this.onerror?.(); else { this.onloadedmetadata?.(); this.onloadeddata?.(); } });
      }};
    videos.push(video); return video;
  }};
  return {document, videos, draws};
}

test('opening-frame thumbnails share one extraction, size it and release the video source', async () => {
  const f = fixture(), loader = createPosterLoader(f.document), item = {id:'clip',videoSrc:'https://example.com/clip.mp4'};
  const results = await Promise.all([loader.get(item), loader.get(item)]);
  assert.deepEqual(results, ['data:image/webp;base64,frame','data:image/webp;base64,frame']);
  assert.equal(f.videos.length,1);
  const video = f.videos[0];
  assert.equal(video.currentTime,.001); assert.equal(video.crossOrigin,'anonymous');
  assert.equal(video.pauseCount,1); assert.equal(video.src,undefined); assert.equal(video.onloadeddata,null);
  assert.deepEqual(f.draws[0].slice(1),[0,0,960,540]);
  await loader.get(item); assert.equal(f.videos.length,1, 'The player reuses the gallery frame');
  const image = {dataset:{}};
  await loader.set(image,item); assert.equal(image.dataset.posterState,'ready');
  assert.equal(image.src,results[0]);
});

test('a supplied poster avoids video requests, and a stale extraction cannot replace a new thumbnail', async () => {
  const f = fixture(), loader = createPosterLoader(f.document), image = {dataset:{}};
  assert.equal(await loader.get({poster:'https://example.com/poster.webp'}),'https://example.com/poster.webp');
  assert.equal(f.videos.length,0);
  const pending = loader.set(image,{id:'old',videoSrc:'https://example.com/old.mp4'});
  image.dataset.videoPoster = 'new'; image.src = 'new-poster';
  await pending; assert.equal(image.src,'new-poster');
});

test('thumbnail failures clean up, leave playback available and can retry', async () => {
  const f = fixture({fail:true}), loader = createPosterLoader(f.document), image = {dataset:{}};
  const item = {id:'clip',videoSrc:'https://example.com/blocked.mp4'};
  await loader.set(image,item);
  assert.equal(image.dataset.posterState,'error'); assert.equal(image.src,undefined);
  assert.equal(f.videos[0].src,undefined); assert.equal(f.videos[0].pauseCount,1);
  await loader.get(item); assert.equal(f.videos.length,2);
});
