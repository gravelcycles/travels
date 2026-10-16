(function (root) {
  'use strict';
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  // Coordinates are relative to the viewport center. The same image pixel
  // remains underneath a moving pinch midpoint or a fixed zoom cursor.
  function focalZoom(state, nextScale, fromPoint, toPoint = fromPoint) {
    const ratio = nextScale / state.scale;
    return {scale: nextScale, x: toPoint.x - (fromPoint.x - state.x) * ratio, y: toPoint.y - (fromPoint.y - state.y) * ratio};
  }
  function panLimit(size, scale, viewport) { return Math.max(0, (size * scale - viewport) / 2); }
  function maxScale(width, height, viewportWidth, viewportHeight) {
    return Math.max(8, viewportWidth / Math.max(1, width), viewportHeight / Math.max(1, height));
  }
  function clampTransform(state, width, height, viewportWidth, viewportHeight) {
    const x = panLimit(width, state.scale, viewportWidth), y = panLimit(height, state.scale, viewportHeight);
    return {scale: state.scale, x: clamp(state.x, -x, x) || 0, y: clamp(state.y, -y, y) || 0};
  }
  function createController({dialog, frame, image, viewer, onSwipe}) {
    const desktop = root.matchMedia('(min-width: 901px)'), reduced = root.matchMedia('(prefers-reduced-motion: reduce)');
    let state = {scale: 1, x: 0, y: 0}, photoId = null, ownedTransform = null;
    let pointers = new Map(), drag = null, pinch = null, nativeGesture = null, animation = null;
    let lastPoint = {x: 0, y: 0};
    const active = () => desktop.matches && dialog.open && !image.hidden && viewer.dataset.mediaType !== 'video';
    const eligible = event => active() && !event.target.closest('button, a, input, select, textarea, video, #viewer-video, #viewer-photo-feedback');
    function dimensions() {
      const rect = frame.getBoundingClientRect();
      const width = Number(image.getAttribute('width')) || image.naturalWidth || rect.width;
      const height = Number(image.getAttribute('height')) || image.naturalHeight || rect.height;
      const fit = Math.min(rect.width / Math.max(1, width), rect.height / Math.max(1, height));
      return {rect, width: width * fit, height: height * fit};
    }
    function point(event) {
      const {rect} = dimensions();
      return {x: event.clientX - rect.left - rect.width / 2, y: event.clientY - rect.top - rect.height / 2};
    }
    function render(next) {
      const {rect, width, height} = dimensions();
      const scale = clamp(next.scale, 1, maxScale(width, height, rect.width, rect.height));
      state = clampTransform({...next, scale}, width, height, rect.width, rect.height);
      if (state.scale <= 1.001) state = {scale: 1, x: 0, y: 0};
      ownedTransform = `translate3d(${state.x}px, ${state.y}px, 0) scale(${state.scale})`;
      image.style.transform = ownedTransform;
      viewer.dataset.desktopZoomed = String(state.scale > 1);
    }
    function stopAnimation() {
      if (animation !== null) root.cancelAnimationFrame(animation);
      animation = null;
    }
    function clearGesture() { pointers.clear(); drag = pinch = nativeGesture = null; delete viewer.dataset.desktopPanning; }
    function reset() {
      stopAnimation(); clearGesture(); state = {scale: 1, x: 0, y: 0};
      // The mobile breakpoint listener may already have painted its transform.
      // Release only our own value regardless of matchMedia callback ordering.
      if (ownedTransform !== null && image.style.transform === ownedTransform) image.style.transform = '';
      ownedTransform = null; delete viewer.dataset.desktopZoomed;
    }
    function zoom(nextScale, fromPoint, toPoint = fromPoint) {
      const {rect, width, height} = dimensions();
      render(focalZoom(state, clamp(nextScale, 1, maxScale(width, height, rect.width, rect.height)), fromPoint, toPoint));
    }
    function zoomAnimated(nextScale, focus) {
      stopAnimation();
      if (reduced.matches) { zoom(nextScale, focus); return; }
      const start = {...state}, began = root.performance.now();
      const tick = now => {
        if (!active()) { reset(); return; }
        const progress = Math.min(1, (now - began) / 180), eased = 1 - (1 - progress) ** 3;
        render(focalZoom(start, start.scale + (nextScale - start.scale) * eased, focus));
        animation = progress < 1 ? root.requestAnimationFrame(tick) : null;
      };
      animation = root.requestAnimationFrame(tick);
    }
    function pair() {
      const [a, b] = [...pointers.values()];
      return {distance: Math.hypot(b.x - a.x, b.y - a.y), center: {x: (a.x + b.x) / 2, y: (a.y + b.y) / 2}};
    }
    frame.addEventListener('pointerdown', event => {
      if (!eligible(event) || event.button > 0) return;
      stopAnimation(); const current = point(event); lastPoint = current;
      pointers.set(event.pointerId, current); frame.setPointerCapture?.(event.pointerId);
      if (pointers.size > 1) { pinch = pair(); drag = null; }
      else drag = {start: current, last: current, zoomed: state.scale > 1, wasPinch: false};
      if (state.scale > 1 || pinch) event.preventDefault();
    });
    frame.addEventListener('pointermove', event => {
      if (!active() || !pointers.has(event.pointerId)) return;
      const current = point(event); lastPoint = current; pointers.set(event.pointerId, current);
      if (pointers.size > 1 && pinch) {
        const next = pair();
        zoom(state.scale * next.distance / Math.max(1, pinch.distance), pinch.center, next.center);
        pinch = next; event.preventDefault();
      } else if (drag) {
        if (state.scale > 1) {
          render({...state, x: state.x + current.x - drag.last.x, y: state.y + current.y - drag.last.y});
          viewer.dataset.desktopPanning = 'true'; event.preventDefault();
        }
        drag.last = current;
      }
    });
    function finishPointer(event) {
      if (!pointers.has(event.pointerId)) return;
      const current = point(event), wasPinch = Boolean(pinch); pointers.delete(event.pointerId);
      if (pointers.size >= 2) { pinch = pair(); return; }
      pinch = null; delete viewer.dataset.desktopPanning;
      if (pointers.size === 1) {
        const remaining = [...pointers.values()][0];
        drag = {start: remaining, last: remaining, zoomed: true, wasPinch: true}; return;
      }
      const dx = drag ? current.x - drag.start.x : 0, dy = drag ? current.y - drag.start.y : 0;
      if (event.type === 'pointerup' && active() && drag && !drag.zoomed && !drag.wasPinch && !wasPinch && state.scale === 1 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.2) onSwipe?.(dx < 0 ? 1 : -1);
      drag = null;
    }
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) frame.addEventListener(type, finishPointer);
    frame.addEventListener('dragstart', event => { if (active()) event.preventDefault(); });
    frame.addEventListener('dblclick', event => {
      if (!eligible(event)) return;
      event.preventDefault();
      const {rect, width, height} = dimensions();
      const cover = Math.max(rect.width / Math.max(1, width), rect.height / Math.max(1, height));
      zoomAnimated(state.scale > 1 ? 1 : Math.max(2.5, cover), point(event));
    });
    frame.addEventListener('wheel', event => {
      if (!eligible(event) || !event.ctrlKey && state.scale === 1) return;
      event.preventDefault(); stopAnimation();
      if (nativeGesture) return; // Safari may also emit wheel events for its GestureEvent stream.
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? frame.clientHeight : 1;
      if (event.ctrlKey) zoom(state.scale * Math.exp(-clamp(event.deltaY * unit, -120, 120) * .01), point(event));
      else render({...state, x: state.x - event.deltaX * unit, y: state.y - event.deltaY * unit});
    }, {passive: false});
    // Safari trackpad pinch is a GestureEvent; Chromium/Firefox use Ctrl+wheel.
    frame.addEventListener('gesturestart', event => {
      if (!eligible(event)) return;
      event.preventDefault(); stopAnimation();
      nativeGesture = {scale: Number(event.scale) || 1, center: Number.isFinite(event.clientX) ? point(event) : lastPoint};
    }, {passive: false});
    frame.addEventListener('gesturechange', event => {
      if (!nativeGesture || !active()) return;
      event.preventDefault();
      const center = Number.isFinite(event.clientX) ? point(event) : nativeGesture.center, scale = Number(event.scale) || 1;
      zoom(state.scale * scale / nativeGesture.scale, nativeGesture.center, center); nativeGesture = {scale, center};
    }, {passive: false});
    frame.addEventListener('gestureend', event => { if (nativeGesture) { event.preventDefault(); nativeGesture = null; } }, {passive: false});
    dialog.addEventListener('close', () => { if (!dialog.open) reset(); });
    desktop.addEventListener('change', reset); root.addEventListener('resize', reset);
    root.addEventListener('blur', () => { stopAnimation(); clearGesture(); });
    let previousSize = '';
    if (root.ResizeObserver) new root.ResizeObserver(() => {
      const next = `${frame.clientWidth}:${frame.clientHeight}`;
      if (previousSize && next !== previousSize) reset(); previousSize = next;
    }).observe(frame);
    image.addEventListener('atlas-photo-state', () => { if (['locked', 'error'].includes(image.dataset.photoState)) reset(); });
    return {reset,
      setPhoto(photo) { if ((photo?.id || null) !== photoId) { reset(); photoId = photo?.id || null; } },
      zoomed: () => active() && state.scale > 1, state: () => ({...state})};
  }
  root.JourneyPhotoZoom = {focalZoom, panLimit, maxScale, clampTransform, createController};
})(typeof window === 'undefined' ? globalThis : window);
