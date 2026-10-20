(function (root) {
  'use strict';
  // Prepared fitted surfaces for the shared mobile viewer. Full sources,
  // access and zoom remain owned by the existing image elements and loader.
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
          step = 'draw';
          context.drawImage(source, 0, 0, job.width, job.height);
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

  function create({stage, frame, enabled, preview = () => '', moving = () => false}, env = root) {
    if (!env.Worker || !env.OffscreenCanvas || !env.createImageBitmap) {
      stage.dataset.swipeRenderer = 'unsupported'; return null;
    }
    const slots = new Map();
    const reduced = env.matchMedia?.('(prefers-reduced-motion: reduce)') || {matches:false};
    let worker = null, workerURL = '', serial = 0, width = 0, height = 0, active = false, blocked = false;
    stage.dataset.swipeRenderer = 'prepared';
    function discard(slot) {
      env.clearTimeout(slot.timer); slot.timer = null;
      slot.bitmap?.close(); slot.bitmap = null;
      slot.id = ++serial; slot.key = ''; slot.src = ''; slot.ready = false;
      slot.canvas.width = slot.canvas.height = 0;
      slot.canvas.hidden = true;
      slot.canvas.style.backgroundImage = '';
      slot.canvas.style.backgroundSize = '';
      delete slot.canvas.dataset.photoRasterPreview;
      delete slot.image.dataset.photoRasterVisible;
    }
    function present(slot) {
      const bitmap = slot.bitmap;
      slot.bitmap = null;
      try {
        slot.canvas.width = slot.width; slot.canvas.height = slot.height;
        slot.context.transferFromImageBitmap(bitmap);
        slot.ready = true;
      } catch { bitmap.close(); slot.failed = true; slot.ready = false; }
    }
    function sync() {
      let ready = 0;
      const canUpdate = active && enabled() && !moving();
      for (const slot of slots.values()) {
        const {image, canvas} = slot;
        // Keep bitmap adoption and its first paint out of horizontal motion.
        // The existing pixels/embedded preview remain until settling finishes.
        if (slot.bitmap && canUpdate) present(slot);
        const revealDone = reduced.matches || image.id !== 'modal-photo' || image.dataset.photoReveal === 'instant' || slot.revealedSrc === image.src;
        const pendingPreview = Boolean(!slot.ready && !slot.failed && slot.neighbor && slot.preview);
        // The first selected photo stays native and visible while work proceeds.
        // A newly ready surface must not replace it halfway through a swipe.
        const canPresent = !slot.initial || slot.presented || !moving();
        const visible = active && enabled() && canPresent && slot.src === image.src && !image.hidden &&
          image.dataset.photoState === 'ready' && (slot.ready && revealDone || pendingPreview);
        ready += Number(slot.ready);
        if (canvas.style.transform !== image.style.transform) canvas.style.transform = image.style.transform;
        const layer = image.id === 'modal-photo' ? '1' : '0';
        if (canvas.style.zIndex !== layer) canvas.style.zIndex = layer;
        if (canvas.hidden === visible) canvas.hidden = !visible;
        if (visible && pendingPreview) {
          if (!canvas.dataset.photoRasterPreview) {
            canvas.style.backgroundImage = `url(${JSON.stringify(slot.preview)})`;
            canvas.style.backgroundSize = slot.previewSize;
            canvas.dataset.photoRasterPreview = 'true';
          }
        } else if (canvas.dataset.photoRasterPreview) {
          canvas.style.backgroundImage = canvas.style.backgroundSize = '';
          delete canvas.dataset.photoRasterPreview;
        }
        if (visible && slot.ready) slot.presented = true;
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
          env.clearTimeout(slot.timer); slot.timer = null;
          if (data.error) { stage.dataset.swipeRasterError = data.error; slot.failed = true; slot.ready = false; sync(); return; }
          slot.bitmap?.close(); slot.bitmap = data.bitmap;
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
      if (blocked || !enabled() || !width || !height || image.hidden || image.dataset.photoState !== 'ready' ||
          !image.complete || !image.naturalWidth || !src || src.startsWith('data:') ||
          image.currentSrc && image.currentSrc !== src) {
        if (slot.key) discard(slot);
        return;
      }
      const key = `${src}:${width}x${height}`;
      if (slot.key === key) return;
      discard(slot);
      // The opening reveal already uses native pixels. Let adjacent preparation
      // run first; this never gates the original photo's load or presentation.
      if (!reduced.matches && image.id === 'modal-photo' && image.dataset.photoReveal !== 'instant' && slot.revealedSrc !== src) return;
      // Do not grant a new origin access to private pixels. Blob and same-origin
      // public assets use the ordinary loader's already-authorized sources.
      if (new env.URL(src, env.location.href).origin !== env.location.origin) return;
      slot.key = key; slot.src = src;
      slot.initial = image.id === 'modal-photo'; slot.neighbor = !slot.initial;
      slot.presented = false; slot.failed = false;
      const blur = image.dataset.privateBlur || preview(image);
      slot.preview = /^data:image\//.test(blur) ? blur : '';
      const fit = Math.min(width / image.naturalWidth, height / image.naturalHeight);
      // Allocate only the photo's fitted pixels. Letterboxing belongs to the
      // frame, not to three mostly transparent, full-viewport GPU surfaces.
      const fittedWidth = image.naturalWidth * fit, fittedHeight = image.naturalHeight * fit;
      slot.width = Math.ceil(fittedWidth); slot.height = Math.ceil(fittedHeight);
      slot.canvas.style.width = `${fittedWidth / (env.devicePixelRatio || 1)}px`;
      slot.canvas.style.height = `${fittedHeight / (env.devicePixelRatio || 1)}px`;
      slot.previewSize = '100% 100%';
      const blob = env.JOURNEY_ATLAS_AUTH?.imageBlob?.(image);
      // Protected sources are reused from their live authorized binding. No
      // Worker token, HTTP credential, cache lease or extra private fetch exists.
      if (image.dataset.privateSrc && !blob) { discard(slot); return; }
      const target = ensureWorker();
      try {
        if (!target) throw Error('Preparation unavailable');
        target.postMessage({slot:slot.slot, id:slot.id, src:blob ? undefined : src, blob, width:slot.width, height:slot.height});
        const id = slot.id;
        slot.timer = env.setTimeout(() => {
          if (id !== slot.id) return;
          // A stalled decoder must never leave a permanent preview. Recover
          // native display for this viewing session rather than retrying a loop.
          blocked = true; stopWorker();
          for (const item of slots.values()) discard(item);
          sync();
        }, 3000);
      } catch { slot.failed = true; }
    }
    function prepareAll() {
      const images = [...slots.keys()];
      for (const image of [...images.filter(image => image.id !== 'modal-photo'), ...images.filter(image => image.id === 'modal-photo')]) prepare(image);
      sync();
    }
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
      active = false; blocked = false; stopWorker();
      for (const slot of slots.values()) { discard(slot); slot.revealedSrc = ''; }
      sync();
    }
    frame.addEventListener('atlas-photo-state', event => { prepare(event.target); sync(); }, true);
    frame.addEventListener('animationend', event => {
      const slot = slots.get(event.target);
      if (slot && event.animationName === 'photo-resolve') { slot.revealedSrc = event.target.src; prepareAll(); }
    });
    env.addEventListener('atlas-photos-locked', clear);
    return {register, prepareAll, resize, sync, clear, active(value) { active = value; sync(); }};
  }
  root.JourneyPhotoSwipeRaster = {create};
})(typeof window === 'undefined' ? globalThis : window);
