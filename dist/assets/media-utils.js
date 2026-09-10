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
    return `<img class="video-thumbnail" data-video-poster="${escape(item.id)}"${item.poster ? ` src="${escape(item.poster)}"` : ''} alt="${escape(alt)}" loading="${eager ? 'eager' : 'lazy'}" /><i class="media-video-badge" aria-hidden="true">▶ ${duration(item.durationSeconds)}</i>`;
  }
  // One decoded opening frame is shared by the journal, grid, filmstrip and player.
  // Supplied posters need no video transfer; legacy public clips are sampled once.
  function createPosterLoader(document, { timeoutMs = 15000 } = {}) {
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
    return { get, set };
  }
  function createVideoPlayer({ video, shell, play, status, retry, sourceLink, posters }) {
    let current = null, generation = 0;
    function stop() {
      generation++; current = null; video.pause(); video.removeAttribute('src'); video.removeAttribute('poster'); video.load();
      shell.hidden = true; play.hidden = false; retry.hidden = true; status.textContent = ''; sourceLink.hidden = true;
    }
    function show(item) {
      if (current?.id === item.id) return;
      stop(); current = item; const epoch = generation;
      shell.hidden = false; video.setAttribute('aria-label', item.title || item.alt);
      video.src = item.videoSrc;
      status.textContent = '';
      sourceLink.hidden = !item.creditUrl;
      if (item.creditUrl) { sourceLink.href = item.creditUrl; sourceLink.textContent = item.credit || 'Video source'; }
      posters.get(item).then(poster => { if (epoch === generation && poster) video.poster = poster; });
    }
    function pause() { video.pause(); }
    async function start() {
      if (!current) return;
      const epoch = generation; play.hidden = true; status.textContent = 'Loading video…';
      try { await video.play(); if (epoch === generation) status.textContent = ''; }
      catch { if (epoch === generation) { play.hidden = false; status.textContent = 'Press play to try again.'; } }
    }
    play.addEventListener('click', start);
    retry.addEventListener('click', () => { if (current) { const item = current; stop(); show(item); start(); } });
    video.addEventListener('playing', () => { if (current) { play.hidden = true; retry.hidden = true; status.textContent = ''; } });
    video.addEventListener('error', () => { if (current) { play.hidden = true; status.textContent = 'This video could not load.'; retry.hidden = false; } });
    video.addEventListener('ended', () => { if (current) { play.hidden = false; status.textContent = ''; } });
    return { show, stop, pause };
  }
  root.JOURNEY_ATLAS_MEDIA = { isVideo, videoItem, items, label, duration, thumbnail, createPosterLoader, createVideoPlayer };
})(typeof window !== 'undefined' ? window : globalThis);
