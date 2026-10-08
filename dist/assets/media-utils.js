(function(root) {
  'use strict';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const isVideo = item => item?.mediaType === 'video';
  const videoItem = video => ({ ...video, mediaType:'video', videoSrc:video.src, src:video.poster || '', alt:video.title, caption:video.title, description:video.caption });
  const items = journey => [...(journey.photos || []), ...(journey.videos || []).filter(video => !video.hidden).map(videoItem)];
  const label = media => {
    const videos = media.filter(isVideo).length, photos = media.length - videos;
    return [photos ? `${photos} photo${photos === 1 ? '' : 's'}` : '', videos ? `${videos} video${videos === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ') || 'No photos or videos';
  };
  function duration(seconds) { const total = Math.round(seconds || 0); return `${Math.floor(total / 60)}:${String(total % 60).padStart(2,'0')}`; }
  function thumbnail(item, { alt = item.alt || '', eager = false } = {}) {
    if (item.protected && root.JOURNEY_ATLAS_AUTH) return root.JOURNEY_ATLAS_AUTH.markup({src:item.poster,protected:true,width:item.width,height:item.height},{alt,eager}) + `<i class="media-video-badge" aria-hidden="true">▶ ${duration(item.durationSeconds)}</i>`;
    return `<img class="video-thumbnail" data-video-poster="${escape(item.id)}"${item.poster ? ` src="${escape(item.poster)}"` : ''} alt="${escape(alt)}" loading="${eager ? 'eager' : 'lazy'}" /><i class="media-video-badge" aria-hidden="true">▶ ${duration(item.durationSeconds)}</i>`;
  }
  // One decoded opening frame is shared by the journal, grid, filmstrip and player.
  // Supplied posters need no video transfer; legacy public clips are sampled once.
  function createPosterLoader(document, { timeoutMs = 15000, privatePoster = src=>root.JOURNEY_ATLAS_AUTH.acquirePoster(src) } = {}) {
    const cache = new Map(); let queue = Promise.resolve();
    function extract(src) {
      return new Promise(resolve => {
        const video = document.createElement('video'); let settled = false;
        const finish = poster => {
          if (settled) return; settled = true; clearTimeout(timer);
          video.onloadeddata = video.onloadedmetadata = video.onseeked = video.onerror = null;
          video.pause(); video.removeAttribute('src'); video.load(); resolve(poster);
        };
        const capture = () => {
          if (settled || video.readyState < 2 || !video.videoWidth) return;
          try {
            const canvas = document.createElement('canvas');
            canvas.width = Math.min(960, video.videoWidth); canvas.height = Math.round(canvas.width * video.videoHeight / video.videoWidth);
            canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
            finish(canvas.toDataURL('image/webp', .8));
          } catch { finish(''); }
        };
        const timer = setTimeout(() => finish(''), timeoutMs);
        video.muted = true; video.playsInline = true; video.crossOrigin = 'anonymous'; video.preload = 'metadata';
        video.onloadedmetadata = () => { if (video.duration > .001) video.currentTime = .001; };
        video.onloadeddata = capture; video.onseeked = capture; video.onerror = () => finish('');
        video.src = src; video.load();
      });
    }
    function get(item) {
      if (item.protected) return Promise.resolve(''); // Private posters use a releasable authenticated lease.
      if (item.poster) return Promise.resolve(item.poster);
      const src = item.videoSrc;
      if (!src) return Promise.resolve('');
      if (!cache.has(src)) {
        const pending = queue.then(() => extract(src)); queue = pending.catch(() => '');
        cache.set(src, pending);
        pending.then(value => { if (!value) cache.delete(src); });
        if (cache.size > 24) cache.delete(cache.keys().next().value);
      }
      return cache.get(src);
    }
    async function set(image, item) {
      image.dataset.videoPoster = item.id;
      const poster = await get(item);
      if (image.dataset.videoPoster !== item.id) return;
      if (poster) { image.src = poster; image.dataset.posterState = 'ready'; }
      else { image.dataset.posterState = 'error'; image.alt = item.alt || 'Video preview unavailable'; }
    }
    function acquire(item) { return item.protected ? privatePoster(item.poster) : get(item).then(url=>({url,release(){}})); }
    return { get, set, acquire };
  }
  function captionVtt(captions) {
    const stamp=value=>new Date(Math.round(value*1000)).toISOString().slice(11,23);
    return 'WEBVTT\n\n'+captions.map(cue=>`${stamp(cue.start)} --> ${stamp(cue.end)}\n${String(cue.text).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')}\n`).join('\n');
  }
  function createVideoPlayer({ video, shell, play, status, retry, sourceLink, posters, privateSource=src=>root.JOURNEY_ATLAS_AUTH.videoSource(src) }) {
    let current = null, generation = 0, ready=Promise.resolve(),posterLease=null,captionUrl=null,captionTrack=null,transcript=null;
    function stop() {
      generation++; current = null; video.pause(); video.removeAttribute('src'); video.removeAttribute('poster'); video.load();
      posterLease?.release();posterLease=null;captionTrack?.remove();captionTrack=null;if(captionUrl)URL.revokeObjectURL(captionUrl);captionUrl=null;transcript?.remove();transcript=null;
      shell.hidden = true; play.hidden = false; retry.hidden = true; status.textContent = ''; sourceLink.hidden = true;
    }
    function show(item) {
      if (current?.id === item.id) return;
      stop(); current = item; const epoch = generation;
      shell.hidden = false; video.setAttribute('aria-label', item.title || item.alt);
      video.crossOrigin = 'anonymous';video.setAttribute('referrerpolicy','no-referrer');
      if(item.protected) {
        status.textContent='Preparing private video…';
        ready=privateSource(item.videoSrc).then(src=>{if(epoch===generation){video.src=src;status.textContent='';}return epoch===generation;},error=>{if(epoch===generation){status.textContent=error.message||'Private video could not load.';retry.hidden=false;}return false;});
      } else {video.src = item.videoSrc;ready=Promise.resolve(true);}
      if(!item.protected)status.textContent = '';
      sourceLink.hidden = !item.creditUrl;
      if (item.creditUrl) { sourceLink.href = item.creditUrl; sourceLink.textContent = item.credit || 'Video source'; }
      const pending=posters.acquire?posters.acquire(item):posters.get(item).then(url=>({url,release(){}}));
      pending.then(lease=>{if(epoch!==generation){lease.release();return;}posterLease=lease;if(lease.url)video.poster=lease.url;},()=>{});
      if(!item.protected && item.captions?.length && video.ownerDocument) {
        captionUrl=URL.createObjectURL(new Blob([captionVtt(item.captions)],{type:'text/vtt'}));captionTrack=video.ownerDocument.createElement('track');
        captionTrack.kind='captions';captionTrack.label='Captions';captionTrack.srclang=item.captionLanguage||'und';captionTrack.src=captionUrl;video.appendChild(captionTrack);
      }
      if(!item.protected && item.transcript && video.ownerDocument) {
        transcript=video.ownerDocument.createElement('details');transcript.className='video-transcript';const summary=video.ownerDocument.createElement('summary'),text=video.ownerDocument.createElement('p');summary.textContent='Transcript';text.textContent=item.transcript;transcript.append(summary,text);shell.appendChild(transcript);
      }
    }
    function pause() { video.pause(); }
    async function start() {
      if (!current) return;
      const epoch = generation; play.hidden = true; status.textContent = 'Loading video…';
      try { if(!await ready || epoch!==generation){if(epoch===generation){play.hidden=false;if(status.textContent==='Loading video…')status.textContent='Video access is unavailable. Unlock photos or retry.';}return;}await video.play(); if (epoch === generation) status.textContent = ''; }
      catch { if (epoch === generation) { play.hidden = false; status.textContent = 'Press play to try again.'; } }
    }
    play.addEventListener('click', start);
    retry.addEventListener('click', () => { if (current) { const item = current; stop(); show(item); start(); } });
    video.addEventListener('playing', () => { if (current) { play.hidden = true; retry.hidden = true; status.textContent = ''; } });
    video.addEventListener('error', () => { if (current) { play.hidden = true; status.textContent = 'This video could not load.'; retry.hidden = false; } });
    video.addEventListener('ended', () => { if (current) { play.hidden = false; status.textContent = ''; } });
    root.addEventListener?.('atlas-photos-locked',()=>{if(current?.protected){const item=current;stop();current=item;shell.hidden=false;status.textContent='Unlock photos to watch this video.';retry.hidden=false;ready=Promise.resolve(false);}});
    root.addEventListener?.('atlas-photos-unlocked',()=>{if(current?.protected){const item=current;stop();show(item);}});
    return { show, stop, pause };
  }
  root.JOURNEY_ATLAS_MEDIA = { isVideo, videoItem, items, label, duration, thumbnail, createPosterLoader, createVideoPlayer,captionVtt };
})(typeof window !== 'undefined' ? window : globalThis);
