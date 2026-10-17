(function (root) {
  'use strict';
  // Temporary, opt-in physical-iPhone comparison. Normal URLs keep the existing
  // renderer until device evidence establishes a benefit. Full sources, access
  // and zoom remain owned by the existing image elements and loader.
  function rasterWorker() {
    let pending = [], working = false;
    self.onmessage = event => {
      const job = event.data;
      pending = pending.filter(item => item.slot !== job.slot);
      pending.push(job); run();
    };
    async function run() {
      if (working) return;
      working = true;
      while (pending.length) {
        const job = pending.shift();
        let source, surface, step = 'fetch';
        try {
          let blob = job.blob;
          if (!blob) {
            const response = await fetch(job.src);
            if (!response.ok) throw Error('Image unavailable');
            blob = await response.blob();
          }
          step = 'decode';
          source = await createImageBitmap(blob);
          step = 'surface';
          surface = new OffscreenCanvas(job.width, job.height);
          const context = surface.getContext('2d');
          if (!context) throw Error('Raster context unavailable');
          context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high';
          const fit = Math.min(job.width / source.width, job.height / source.height);
          const width = source.width * fit, height = source.height * fit;
          step = 'draw';
          context.drawImage(source, (job.width - width) / 2, (job.height - height) / 2, width, height);
          source.close(); source = null;
          step = 'transfer';
          const bitmap = surface.transferToImageBitmap();
          self.postMessage({slot:job.slot, id:job.id, bitmap}, [bitmap]);
        } catch {
          self.postMessage({slot:job.slot, id:job.id, error:step});
        } finally {
          source?.close();
          if (surface) surface.width = surface.height = 0;
        }
      }
      working = false;
    }
  }

  function create({stage, frame, enabled}, env = root) {
    if (new URLSearchParams(env.location.search).get('swipeRenderer') !== 'prepared') return null;
    if (!env.Worker || !env.OffscreenCanvas || !env.createImageBitmap) {
      stage.dataset.swipeRenderer = 'unsupported'; return null;
    }
    const slots = new Map();
    let worker = null, workerURL = '', serial = 0, width = 0, height = 0, active = false;
    stage.dataset.swipeRenderer = 'prepared';
    function discard(slot) {
      slot.id = ++serial; slot.key = ''; slot.src = ''; slot.ready = false;
      slot.canvas.width = slot.canvas.height = 0;
      slot.canvas.hidden = true;
      delete slot.image.dataset.photoRasterVisible;
    }
    function sync() {
      let ready = 0;
      for (const slot of slots.values()) {
        const {image, canvas} = slot;
        const revealDone = image.id !== 'modal-photo' || image.dataset.photoReveal === 'instant' || slot.revealDone;
        const visible = active && enabled() && revealDone && slot.ready && slot.src === image.src && !image.hidden && image.dataset.photoState === 'ready';
        ready += Number(slot.ready);
        if (canvas.style.transform !== image.style.transform) canvas.style.transform = image.style.transform;
        const layer = image.id === 'modal-photo' ? '1' : '0';
        if (canvas.style.zIndex !== layer) canvas.style.zIndex = layer;
        if (canvas.hidden === visible) canvas.hidden = !visible;
        const accessible = visible && layer === '1';
        const label = image.alt || 'Photograph';
        if (canvas.getAttribute('aria-hidden') !== String(!accessible)) canvas.setAttribute('aria-hidden', String(!accessible));
        if (accessible && canvas.getAttribute('aria-label') !== label) canvas.setAttribute('aria-label', label);
        if (visible && image.dataset.photoRasterVisible !== 'true') image.dataset.photoRasterVisible = 'true';
        else if (!visible && image.dataset.photoRasterVisible) delete image.dataset.photoRasterVisible;
      }
      if (stage.dataset.swipeRasterReady !== String(ready)) stage.dataset.swipeRasterReady = String(ready);
    }
    function stopWorker() {
      worker?.terminate(); worker = null;
      if (workerURL) env.URL.revokeObjectURL(workerURL);
      workerURL = '';
    }
    function ensureWorker() {
      if (worker) return worker;
      try {
        workerURL = env.URL.createObjectURL(new env.Blob([`(${rasterWorker.toString()})();`], {type:'text/javascript'}));
        worker = new env.Worker(workerURL);
        worker.onmessage = ({data}) => {
          const slot = [...slots.values()].find(item => item.slot === data.slot);
          if (!slot || data.id !== slot.id || !enabled()) { data.bitmap?.close(); return; }
          if (data.error) { stage.dataset.swipeRasterError = data.error; slot.ready = false; sync(); return; }
          try {
            slot.canvas.width = width; slot.canvas.height = height;
            slot.context.transferFromImageBitmap(data.bitmap);
            slot.ready = true;
          } catch { data.bitmap?.close(); slot.ready = false; }
          sync();
        };
        worker.onerror = () => { stopWorker(); for (const slot of slots.values()) discard(slot); sync(); };
        return worker;
      } catch { stopWorker(); return null; }
    }
    function register(image) {
      if (slots.has(image) || slots.size >= 3) return;
      const canvas = env.document.createElement('canvas');
      const context = canvas.getContext('bitmaprenderer');
      if (!context) { stage.dataset.swipeRenderer = 'unsupported'; return; }
      canvas.className = 'mobile-photo-raster'; canvas.hidden = true;
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-hidden', 'true'); canvas.width = canvas.height = 0;
      frame.append(canvas);
      slots.set(image, {image, canvas, context, slot:slots.size, id:0, key:'', ready:false});
    }
    function prepare(image) {
      const slot = slots.get(image);
      if (!slot) return;
      const src = image.src;
      if (!enabled() || !width || !height || image.hidden || image.dataset.photoState !== 'ready' ||
          !image.complete || !image.naturalWidth || !src || src.startsWith('data:') ||
          image.currentSrc && image.currentSrc !== src) {
        if (slot.key) discard(slot);
        return;
      }
      const key = `${src}:${width}x${height}`;
      if (slot.key === key) return;
      discard(slot);
      // Do not grant a new origin access to private pixels. Blob and same-origin
      // public assets use the ordinary loader's already-authorized sources.
      if (new env.URL(src, env.location.href).origin !== env.location.origin) return;
      slot.key = key; slot.src = src;
      slot.revealDone = false;
      const blob = env.JOURNEY_ATLAS_AUTH?.imageBlob?.(image);
      // Protected sources are reused from their live authorized binding. No
      // Worker token, HTTP credential, cache lease or extra private fetch exists.
      if (image.dataset.privateSrc && !blob) { discard(slot); return; }
      const target = ensureWorker();
      if (target) target.postMessage({slot:slot.slot, id:slot.id, src:blob ? undefined : src, blob, width, height});
    }
    function prepareAll() { for (const image of slots.keys()) prepare(image); sync(); }
    function resize(cssWidth, cssHeight) {
      const ratio = env.devicePixelRatio || 1;
      let nextWidth = Math.ceil(cssWidth * ratio), nextHeight = Math.ceil(cssHeight * ratio);
      // At most three physical-resolution surfaces, <=48 MB in RGBA storage.
      // Larger viewports retain full images rather than reducing display detail.
      if (nextWidth * nextHeight > 4000000) nextWidth = nextHeight = 0;
      if (width !== nextWidth || height !== nextHeight) {
        stopWorker(); width = nextWidth; height = nextHeight;
        for (const slot of slots.values()) discard(slot);
      }
      prepareAll();
    }
    function clear() {
      active = false; stopWorker();
      for (const slot of slots.values()) discard(slot);
      sync();
    }
    frame.addEventListener('atlas-photo-state', event => { prepare(event.target); sync(); }, true);
    frame.addEventListener('animationend', event => {
      const slot = slots.get(event.target);
      if (slot && event.animationName === 'photo-resolve') { slot.revealDone = true; sync(); }
    });
    env.addEventListener('atlas-photos-locked', clear);
    return {register, prepareAll, resize, sync, clear, active(value) { active = value; sync(); }};
  }
  root.JourneyPhotoSwipeRaster = {create};
})(typeof window === 'undefined' ? globalThis : window);
