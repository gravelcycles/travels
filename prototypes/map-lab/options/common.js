// Helpers shared by the MapLibre-based options. Demo code only.
import { cluster, MODES, modeOf } from '../data.js';

export const OFM = name => `https://tiles.openfreemap.org/styles/${name}`;

// Create a map and resolve once its style and first frame are ready. The
// container stays invisible until then so no unstyled tiles flash.
export function createMap(container, options, { onStyle } = {}) {
  const el = document.createElement('div');
  el.className = 'lab-map';
  el.style.cssText = 'position:absolute;inset:0;opacity:0;';
  container.append(el);
  const map = new maplibregl.Map({
    container: el, attributionControl: false, fadeDuration: 0, dragRotate: true, pitchWithRotate: true,
    maxPitch: 75, renderWorldCopies: false, ...options
  });
  // Credits start collapsed but stay reachable (O06), as in the viewer.
  class Collapsed extends maplibregl.AttributionControl {
    onAdd(m) { const c = super.onAdd(m); c.classList.add('maplibregl-compact'); c.classList.remove('maplibregl-compact-show'); c.removeAttribute('open'); return c; }
  }
  map.addControl(new Collapsed({ compact: true }), 'bottom-right');
  return new Promise((resolve, reject) => {
    let settled = false;
    map.once('style.load', () => { try { onStyle?.(map); } catch (error) { console.error(error); } });
    map.once('load', () => { settled = true; if (window.__mapLab) window.__mapLab.map = map; resolve(map); });
    map.on('error', event => { if (!settled && event?.error?.status === undefined && /style/i.test(event?.error?.message || '')) reject(event.error); });
  });
}
export function reveal(map) {
  const el = map.getContainer();
  el.style.transition = 'opacity 160ms linear';
  requestAnimationFrame(() => { el.style.opacity = '1'; });
}

export function padding(ctx, extra = 0) {
  const inset = ctx.insets();
  return { top: inset.top + extra, bottom: inset.bottom + extra, left: inset.left + extra, right: inset.right + extra };
}
// Camera for bounds inside the visible map area. cameraForBounds already
// offsets the centre for its padding; never pass the padding again (arrival doc).
export function cameraFor(map, ctx, frame, { extra = 24, maxZoom = 12.5, minZoom } = {}) {
  if (!frame) return null;
  if (frame.center) return { center: frame.center, zoom: Math.min(frame.zoom ?? 12, maxZoom), bearing: 0, pitch: 0 };
  const bounds = frame.bounds || frame;
  const [[w, s], [e, n]] = bounds;
  const pad = padding(ctx, extra);
  const container = map.getContainer();
  const fitW = container.clientWidth - pad.left - pad.right, fitH = container.clientHeight - pad.top - pad.bottom;
  if (fitW < 40 || fitH < 40) { pad.left = pad.right = pad.top = pad.bottom = 8; }
  let camera;
  try {
    camera = map.cameraForBounds([[w, s], [e === w ? e + 0.01 : e, n === s ? n + 0.01 : n]], { padding: pad, maxZoom: frame.maxZoom ?? maxZoom, bearing: 0 });
  } catch (error) { camera = null; }
  if (!camera) return { center: [(w + e) / 2, (s + n) / 2], zoom: 5, bearing: 0, pitch: 0 };
  if (minZoom !== undefined) camera.zoom = Math.max(minZoom, camera.zoom);
  return { center: camera.center, zoom: camera.zoom, bearing: 0, pitch: 0 };
}

// Interrupt animation on the viewer's first input on the map surface.
export function onUserInput(map, callback) {
  const surface = map.getCanvasContainer();
  const handler = () => callback();
  surface.addEventListener('pointerdown', handler, { capture: true, passive: true });
  surface.addEventListener('wheel', handler, { capture: true, passive: true });
  surface.addEventListener('touchstart', handler, { capture: true, passive: true });
  const onMove = event => { if (event?.originalEvent) callback(); };
  map.on('movestart', onMove);
  return () => {
    surface.removeEventListener('pointerdown', handler, { capture: true });
    surface.removeEventListener('wheel', handler, { capture: true });
    surface.removeEventListener('touchstart', handler, { capture: true });
    map.off('movestart', onMove);
  };
}

// Clustered HTML markers that re-group after camera moves and keep the same
// DOM node for an unchanged group (no image reload, no flicker).
export function markerLayer(map, { radius = 56, className = '', render, onClick, anchor = 'center', minItems = 1 }) {
  let items = [], entries = new Map(), raf = 0, hidden = false;
  function rebuild() {
    raf = 0;
    if (hidden) { for (const entry of entries.values()) entry.marker.remove(); entries.clear(); return; }
    const r = typeof radius === 'function' ? radius(map.getZoom()) : radius;
    const groups = cluster(items, c => map.project(c), r);
    const next = new Map();
    for (const group of groups) {
      if (group.items.length < minItems) continue;
      const key = group.items.map(item => item.id).join('|');
      let entry = entries.get(key);
      if (entry) entries.delete(key);
      else {
        const el = document.createElement('button');
        el.type = 'button';
        el.className = `lab-marker ${className}`;
        render(el, group, true);
        el.addEventListener('click', event => { event.stopPropagation(); onClick?.(entry.group, el, event); });
        const marker = new maplibregl.Marker({ element: el, anchor }).setLngLat([group.lng, group.lat]).addTo(map);
        entry = { marker, el, group };
      }
      entry.group = group;
      next.set(key, entry);
    }
    for (const entry of entries.values()) entry.marker.remove();
    entries = next;
  }
  const schedule = () => { if (!raf) raf = requestAnimationFrame(rebuild); };
  map.on('moveend', schedule);
  map.on('resize', schedule);
  return {
    set(next) { items = next; schedule(); },
    refresh() { for (const entry of entries.values()) render(entry.el, entry.group, false); },
    rebuildNow() { cancelAnimationFrame(raf); rebuild(); },
    each(fn) { for (const entry of entries.values()) fn(entry); },
    hide(value) { hidden = value; schedule(); },
    destroy() { cancelAnimationFrame(raf); map.off('moveend', schedule); map.off('resize', schedule); for (const entry of entries.values()) entry.marker.remove(); entries.clear(); }
  };
}

// Zoom to a marker group (used when a cluster is tapped).
export function zoomToGroup(map, ctx, group, maxZoom = 15) {
  const coords = group.items.map(item => [item.lng, item.lat]);
  if (coords.length === 1) { map.easeTo({ center: coords[0], zoom: Math.max(map.getZoom() + 2, 13), duration: 600 }); return; }
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const [x, y] of coords) { w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y); }
  const camera = cameraFor(map, ctx, { bounds: [[w, s], [e, n]], maxZoom });
  if (camera && camera.zoom <= map.getZoom() + 0.2) camera.zoom = Math.min(maxZoom, map.getZoom() + 1.5);
  map.easeTo({ ...camera, pitch: map.getPitch(), bearing: map.getBearing(), duration: 650 });
}

export function loadScript(src) {
  const existing = [...document.scripts].find(s => s.src === src);
  if (existing?.dataset.loaded) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = existing || document.createElement('script');
    script.addEventListener('load', () => { script.dataset.loaded = '1'; resolve(); }, { once: true });
    script.addEventListener('error', () => reject(new Error(`Could not load ${src}`)), { once: true });
    if (!existing) { script.src = src; script.crossOrigin = 'anonymous'; document.head.append(script); }
  });
}
export async function fontsReady(fonts, timeout = 1500) {
  if (!document.fonts?.load) return;
  await Promise.race([Promise.all(fonts.map(f => document.fonts.load(f).catch(() => null))), new Promise(r => setTimeout(r, timeout))]);
}

export function injectStyle(id, css) {
  let style = document.getElementById(id);
  if (!style) { style = document.createElement('style'); style.id = id; document.head.append(style); }
  style.textContent = css;
  return style;
}

// A canvas overlay that tracks the map container size and device pixels.
export function overlayCanvas(map, className = 'lab-overlay') {
  const canvas = document.createElement('canvas');
  canvas.className = className;
  canvas.style.cssText = 'position:absolute;inset:0;pointer-events:none;';
  map.getCanvasContainer().after(canvas);
  const context = canvas.getContext('2d');
  let width = 0, height = 0, ratio = 1;
  function resize() {
    const box = map.getContainer();
    ratio = Math.min(2, window.devicePixelRatio || 1);
    width = box.clientWidth; height = box.clientHeight;
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }
  resize();
  map.on('resize', resize);
  return {
    canvas, context,
    get width() { return width; }, get height() { return height; },
    clear() { context.clearRect(0, 0, width, height); },
    destroy() { map.off('resize', resize); canvas.remove(); }
  };
}

// Line sample for a key, in this option's own colours/patterns.
export function swatchSvg({ color, width = 4, dash = null, cap = 'round', casing = null, extra = '' }) {
  return `<svg width="64" height="16" viewBox="0 0 64 16" aria-hidden="true">${casing ? `<path d="M5 8h54" stroke="${casing}" stroke-width="${width + 3}" stroke-linecap="round"/>` : ''}<path d="M5 8h54" stroke="${color}" stroke-width="${width}" stroke-linecap="${cap}" ${dash ? `stroke-dasharray="${dash.join(' ')}"` : ''}/>${extra}</svg>`;
}
export { MODES, modeOf };
