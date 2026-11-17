// Option 3 · Ink atlas. A warm printed map: routes draw themselves like a pen
// with a cartographic symbol per mode, stops are passport stamps, photos are
// pinned polaroids and places are hand-lettered. Camera stays still while the
// pen draws (current O09 timing: frame, 1.5 s trace, 0.25 s hold, settle).
import { along, prefix, tracePlan, clock, ease, escapeHtml, boundsCenter, modeOf } from '../data.js';
import { createMap, reveal, cameraFor, onUserInput, markerLayer, zoomToGroup, overlayCanvas, injectStyle, fontsReady, OFM } from './common.js';

export const meta = {
  number: 3, name: 'Ink atlas', theme: 'light', keyBackground: '#f3e8cf',
  tagline: 'A travel journal printed on warm paper. The pen draws each leg in its own cartographic symbol, each arrival is stamped like a passport, photos are pinned polaroids.',
  whatsNew: [
    'Paper restyle of OpenFreeMap with hatched water and a grain overlay; serif stop names and hand-lettered places.',
    'Canvas pen strokes with classic map symbols: railway cross-ties, ferry stitches, gondola cable-and-cabins, dotted walks, dashed buses; TBD is pencilled in.',
    'Passport stamps on arrival that collect as you browse; polaroid stacks with handwritten counts.'
  ],
  keeps: ['Camera still during the trace and current arrival timings (850 ms frame, 1.5 s trace, 0.25 s hold, 900 ms settle).', '3-second whole-route opening trace with the whole route framed (O06).', 'Warm paper, serif character (O22); selected routes keep colour and full weight after arrival.'],
  departures: [
    'Mode colours become ink tones; the primary cue is the symbol, not the current palette.',
    'Stops become passport stamps instead of upright signposts (O07).',
    'Whole-trip Replay re-runs the opening trace (O09 disables full-trip Replay).'
  ],
  phone: 'Fits naturally: the camera never moves during drawing, stamps sit beside the city and polaroids shrink at trip scale. Hand-lettering stays at 16 px or more.'
};

const INK = { train: '#1d3d72', boat: '#14666b', bus: '#8b4510', gondola: '#5b3684', walk: '#34352f', car: '#7c271f', bike: '#2a6440' };
const PENCIL = '#6e6658';
const PAPER = '#f2e7cf';
const STAMP_INKS = ['#7c271f', '#1d3d72', '#2a6440', '#5b3684', '#8b4510', '#14666b'];
const hash = text => { let h = 2166136261; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; };

const CSS = `
.o3 .lab-map canvas.maplibregl-canvas { outline: none; }
.o3-paper { position:absolute; inset:0; pointer-events:none; mix-blend-mode:multiply; opacity:.55; z-index:2; }
.o3-vignette { position:absolute; inset:0; pointer-events:none; z-index:2; background: radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(110,80,40,.18) 100%); }
.o3-nib { position:absolute; left:0; top:0; width:44px; height:44px; pointer-events:none; z-index:3; display:none; transform-origin: 0 0; }
.o3-stop { width:44px; height:44px; display:block; }
.o3-stop .o3-in { position:absolute; inset:0; }
.o3-stop .o3-dot { position:absolute; left:16px; top:16px; width:12px; height:12px; border-radius:50%; background:${PAPER}; border:2.4px solid #2b2620; }
.o3-stop.is-tbd .o3-dot { border-style: dashed; border-color: ${PENCIL}; }
.o3-stop.is-current .o3-dot { background:#d4512c; border-color:#2b2620; }
.o3-stop .o3-name { position:absolute; left:36px; top:11px; white-space:nowrap; font: italic 500 15px/22px Fraunces, Georgia, serif; color:#2b2620;
  text-shadow: 0 0 2px ${PAPER}, 0 0 4px ${PAPER}, 0 0 6px ${PAPER}; letter-spacing:.01em; }
.o3-stop.is-tbd .o3-name { color:${PENCIL}; font-family: Caveat, cursive; font-style: normal; font-size: 18px; }
.o3-stop.no-label .o3-name { display:none; }
.o3-stop.is-pending { opacity:0; }
.o3-stop { transition: opacity 260ms; }
.o3-stamp { pointer-events:none; mix-blend-mode:multiply; }
.o3-stamp .o3-stamp-in { transform-origin: 50% 50%; transform: rotate(var(--r)); transition: transform 300ms, opacity 300ms; }
.o3-stamp svg { display:block; }
.o3-stamp.is-new .o3-stamp-in { animation: o3-thunk 340ms cubic-bezier(.2,.9,.3,1.25) both; }
.o3-stamp.is-old .o3-stamp-in { opacity:.5; transform: scale(.62) rotate(var(--r)); }
@keyframes o3-thunk { 0% { transform: scale(1.7) rotate(var(--r)); opacity:0; } 60% { opacity:1; } 100% { transform: scale(1) rotate(var(--r)); opacity:1; } }
.o3-pola { width:44px; height:52px; display:grid; place-items:center; }
.o3-pola .o3-frame { position:relative; display:block; width:var(--pw,34px); padding:3px 3px 9px; background:#fffdf6; box-shadow: 0 2px 5px rgba(60,40,10,.35); transform: rotate(var(--r)); transition: transform 260ms; }
.o3-pola .o3-img { display:block; width:100%; aspect-ratio:1; background:#ccc center/cover no-repeat; filter: sepia(.15) saturate(.95); }
.o3-pola.is-stack .o3-frame::before, .o3-pola.is-stack .o3-frame::after { content:''; position:absolute; inset:0; background:#fffdf6; box-shadow:0 1px 3px rgba(60,40,10,.3); z-index:-1; }
.o3-pola.is-stack .o3-frame::before { transform: rotate(7deg) translate(3px,1px); }
.o3-pola.is-stack .o3-frame::after { transform: rotate(-6deg) translate(-3px,2px); }
.o3-pola .o3-pin { position:absolute; left:50%; top:-4px; width:9px; height:9px; margin-left:-4.5px; border-radius:50%; background: radial-gradient(circle at 35% 30%, #f08a6a, #a8321c 70%); box-shadow:0 1px 2px #0006; }
.o3-pola .o3-count { position:absolute; right:-14px; bottom:-8px; font: 700 18px/1 Caveat, cursive; color:#7c271f; text-shadow: 0 0 3px ${PAPER}, 0 0 5px ${PAPER}; }
.o3-pola.is-dim { opacity:.45; }
.o3-pola.is-dim .o3-count { display:none; }
.o3.o3-city .o3-pola .o3-frame { --pw: 46px; }
.o3-pola.is-drop .o3-frame { animation: o3-drop 420ms cubic-bezier(.2,.9,.3,1.2) both; animation-delay: var(--d,0ms); }
@keyframes o3-drop { from { transform: translateY(-18px) scale(1.15) rotate(var(--r)); opacity:0; } to { transform: rotate(var(--r)); opacity:1; } }
.o3-place { display:flex; align-items:center; gap:2px; min-height:44px; min-width:44px; padding:0 4px; color:#7c271f; }
.o3-place svg { flex:none; }
.o3-place .o3-hand { font: 700 18px/1 Caveat, cursive; white-space:nowrap; text-shadow: 0 0 3px ${PAPER}, 0 0 6px ${PAPER}; max-width: 170px; overflow:hidden; text-overflow:ellipsis; }
.o3-place.is-dim { opacity:.5; }
.o3-note { pointer-events:none; font: 700 17px/1 Caveat, cursive; color:${PENCIL}; text-shadow: 0 0 3px ${PAPER}, 0 0 5px ${PAPER}; white-space:nowrap; }
.o3-hidden-markers .o3-pola, .o3-hidden-markers .o3-place { opacity:0 !important; pointer-events:none; }
.o3-pola, .o3-place { transition: opacity 360ms; }
:root[data-reduced] .o3 * { animation: none !important; transition: none !important; }
.o3-card .maplibregl-popup-content { background:#fffdf6; color:#2b2620; border-radius:4px; padding:10px 12px 12px; box-shadow:0 8px 24px rgba(60,40,10,.3); font:14px/1.35 Fraunces, Georgia, serif; max-width:240px; }
.o3-card .maplibregl-popup-tip { border-top-color:#fffdf6 !important; border-bottom-color:#fffdf6 !important; }
.o3-card .maplibregl-popup-close-button { width:32px; height:32px; font-size:18px; }
.o3-card .o3-card-img { width:200px; height:150px; background:#ddd center/cover; margin-bottom:8px; }
.o3-card small { display:block; font:12px/1.3 var(--font-ui); color:#6e6658; }
.o3-card .o3-choice { display:block; width:100%; min-height:44px; margin-top:4px; border:1px solid #d9c9a8; border-radius:6px; background:transparent; text-align:left; padding:6px 10px; font:inherit; cursor:pointer; }
`;

let S = null;

function paperTexture() {
  const size = 256, canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const c = canvas.getContext('2d'), image = c.createImageData(size, size);
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < image.data.length; i += 4) {
    const v = 236 + rand() * 19;
    image.data[i] = v; image.data[i + 1] = v - 4; image.data[i + 2] = v - 14; image.data[i + 3] = 255;
  }
  c.putImageData(image, 0, 0);
  c.globalAlpha = 0.07; c.strokeStyle = '#7a5a30';
  for (let i = 0; i < 70; i++) { c.beginPath(); const x = rand() * size, y = rand() * size; c.moveTo(x, y); c.quadraticCurveTo(x + rand() * 30 - 15, y + rand() * 30 - 15, x + rand() * 40 - 20, y + rand() * 40 - 20); c.stroke(); }
  return canvas.toDataURL('image/png');
}
function hatchImage() {
  const size = 12, canvas = document.createElement('canvas');
  canvas.width = canvas.height = size * 2;
  const c = canvas.getContext('2d');
  c.fillStyle = '#d3ddd3'; c.fillRect(0, 0, size * 2, size * 2);
  c.strokeStyle = 'rgba(52, 92, 104, 0.30)'; c.lineWidth = 1.4;
  for (let i = -2; i < 3; i++) { c.beginPath(); c.moveTo(i * size, size * 2); c.lineTo(i * size + size * 2, 0); c.stroke(); }
  return c.getImageData(0, 0, size * 2, size * 2);
}

export async function mount(container, trip, ctx) {
  injectStyle('lab-o3', CSS);
  container.classList.add('o3');
  S = { trip, ctx, container, reduced: false, selected: null, landed: false, job: null, trace: null, revealed: false, stamps: [], notes: [] };
  const mine = S;
  const [map] = await Promise.all([
    createMap(container, { style: OFM('positron'), center: boundsCenter(trip.bounds), zoom: 4, maxZoom: 17, dragRotate: false, pitchWithRotate: false, touchPitch: false }, { onStyle: styleMap }),
    fontsReady(['italic 500 15px Fraunces', '700 18px Caveat'])
  ]);
  if (S !== mine) { map.remove(); return; }
  S.map = map;
  map.touchZoomRotate.disableRotation();
  const paper = document.createElement('div');
  paper.className = 'o3-paper';
  paper.style.backgroundImage = `url(${paperTexture()})`;
  const vignette = document.createElement('div');
  vignette.className = 'o3-vignette';
  container.append(paper, vignette);
  S.overlay = overlayCanvas(map, 'o3-ink');
  S.nib = document.createElement('div');
  S.nib.className = 'o3-nib';
  S.nib.innerHTML = '<svg viewBox="0 0 44 44" width="44" height="44" aria-hidden="true"><path d="M2 42 L14 18 L26 6 Q31 1 36 6 L38 8 Q43 13 38 18 L26 30 Z" fill="#2b2620"/><path d="M2 42 L14 18 L26 30 Z" fill="#c9a24a"/><path d="M2 42 L18 26" stroke="#2b2620" stroke-width="1.3"/><circle cx="17.5" cy="26.5" r="1.8" fill="#2b2620"/></svg>';
  map.getContainer().append(S.nib);
  buildStops();
  S.photos = markerLayer(map, { radius: z => (z < 8 ? 58 : 66), className: 'o3-pola', render: renderPola, onClick: photoClick, anchor: 'bottom' });
  S.places = markerLayer(map, { radius: 70, className: 'o3-place', render: renderPlace, onClick: placeClick, anchor: 'left' });
  S.photos.set(trip.located);
  S.places.set(trip.locatedPois);
  S.offInput = onUserInput(map, interrupt);
  map.on('render', () => draw());
  map.on('moveend', layoutStops);
  const zoomClass = () => { container.classList.toggle('o3-city', map.getZoom() >= 10); S.places.hide(map.getZoom() < 7.2); };
  map.on('zoomend', zoomClass); zoomClass();
}

function styleMap(map) {
  map.addImage('o3-hatch', hatchImage(), { pixelRatio: 2 });
  const paint = (id, prop, value) => { if (map.getLayer(id)) try { map.setPaintProperty(id, prop, value); } catch (e) { /* skip */ } };
  const layout = (id, prop, value) => { if (map.getLayer(id)) try { map.setLayoutProperty(id, prop, value); } catch (e) { /* skip */ } };
  for (const layer of map.getStyle().layers) {
    const id = layer.id;
    if (layer.type === 'background') paint(id, 'background-color', PAPER);
    else if (id === 'water') { paint(id, 'fill-pattern', 'o3-hatch'); }
    else if (layer.type === 'fill') {
      if (/building/.test(id)) { paint(id, 'fill-color', '#e4d4b2'); paint(id, 'fill-opacity', 0.6); }
      else if (/park|wood|glacier|ice/.test(id)) { paint(id, 'fill-color', '#dfdcb6'); paint(id, 'fill-opacity', 0.55); }
      else { paint(id, 'fill-color', '#ead9b9'); paint(id, 'fill-opacity', 0.5); }
    } else if (layer.type === 'line') {
      if (/waterway/.test(id)) paint(id, 'line-color', '#9fb6b1');
      else if (/boundary/.test(id)) { paint(id, 'line-color', '#9b876a'); paint(id, 'line-dasharray', [3, 2]); }
      else if (/rail/.test(id)) { paint(id, 'line-color', '#d9c9a9'); paint(id, 'line-opacity', 0.6); }
      else if (/motorway/.test(id)) paint(id, 'line-color', '#d1b98f');
      else paint(id, 'line-color', '#ddc9a5');
    } else if (layer.type === 'symbol') {
      if (/highway|shield|road|poi|airport|label_other|water_name_line|waterway/.test(id)) layout(id, 'visibility', 'none');
      else {
        paint(id, 'text-color', /country/.test(id) ? '#8c7656' : '#5d4c35');
        paint(id, 'text-halo-color', PAPER); paint(id, 'text-halo-width', 1.6);
        if (/country/.test(id)) { layout(id, 'text-transform', 'uppercase'); layout(id, 'text-letter-spacing', 0.25); }
        if (/label_(city|town|village)/.test(id)) map.setLayerZoomRange(id, 8.5, 24);
        if (/state/.test(id)) layout(id, 'visibility', 'none');
      }
    }
  }
}

// ---------------------------------------------------------------- drawing
function strokePath(c, pts) {
  c.beginPath(); c.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y);
}
function inkStroke(c, pts, leg, alpha, w) {
  if (pts.length < 2) return;
  const kind = leg.tbd ? 'tbd' : leg.mode;
  strokePath(c, pts);
  c.lineJoin = 'round';
  if (kind !== 'tbd') { // paper halo lifts ink off the basemap (TBD keeps no casing)
    c.setLineDash([]); c.lineCap = 'round'; c.lineWidth = 6 * w; c.strokeStyle = PAPER; c.globalAlpha = alpha * 0.75; c.stroke();
  }
  c.strokeStyle = leg.tbd ? PENCIL : INK[leg.mode] || '#2b2620';
  c.globalAlpha = alpha;
  switch (kind) {
    case 'train':
      c.setLineDash([]); c.lineCap = 'round'; c.lineWidth = 1.9 * w; c.stroke();
      c.lineCap = 'butt'; c.lineWidth = 7.5 * w; c.setLineDash([1.4 * w, 7.5 * w]); c.globalAlpha = alpha * 0.9; c.stroke(); break;
    case 'boat':
      c.lineCap = 'round'; c.lineWidth = 2.2 * w; c.setLineDash([4.6 * w, 3.8 * w]); c.stroke();
      c.lineWidth = 0.9 * w; c.globalAlpha = alpha * 0.35; c.lineDashOffset = 4.2 * w; c.stroke(); c.lineDashOffset = 0; break;
    case 'bus': c.lineCap = 'butt'; c.lineWidth = 2.5 * w; c.setLineDash([11 * w, 5 * w]); c.stroke(); break;
    case 'gondola':
      c.lineCap = 'round'; c.lineWidth = 1.1 * w; c.setLineDash([]); c.stroke();
      c.lineWidth = 6 * w; c.setLineDash([0.1, 10 * w]); c.stroke(); break;
    case 'walk': c.lineCap = 'round'; c.lineWidth = 2.7 * w; c.setLineDash([0.1, 4.8 * w]); c.stroke(); break;
    case 'car': c.lineCap = 'butt'; c.lineWidth = 2.5 * w; c.setLineDash([9 * w, 3 * w, 1.6 * w, 3 * w]); c.stroke(); break;
    case 'bike': c.lineCap = 'butt'; c.lineWidth = 2.3 * w; c.setLineDash([6 * w, 3.6 * w]); c.stroke(); break;
    default:
      c.lineCap = 'round'; c.lineWidth = 2.2 * w; c.setLineDash([0.1, 5.4 * w]); c.globalAlpha = alpha * 0.9; c.stroke();
      if (leg.mode === 'train') { c.lineCap = 'butt'; c.lineWidth = 6 * w; c.setLineDash([1.1 * w, 9 * w]); c.globalAlpha = alpha * 0.55; c.stroke(); }
      if (leg.mode === 'gondola') { c.lineWidth = 5 * w; c.setLineDash([0.1, 11 * w]); c.stroke(); }
  }
  c.setLineDash([]); c.globalAlpha = 1;
}
function detail(leg, zoom) { return zoom < 5.6 ? leg.coarse : zoom < 9.5 ? leg.lite : { coords: leg.coords, cum: leg.cum }; }
function draw() {
  if (!S?.overlay) return;
  const t0 = performance.now();
  const map = S.map, { context: c, width, height } = S.overlay;
  c.clearRect(0, 0, width, height);
  const zoom = map.getZoom(), bounds = map.getBounds(), w0 = bounds.getWest(), e0 = bounds.getEast(), s0 = bounds.getSouth(), n0 = bounds.getNorth();
  const trace = S.trace, progress = new Map();
  let head = null;
  if (trace) for (const entry of trace.plan) progress.set(entry.leg.id, Math.max(0, Math.min(1, (trace.t - entry.start) / (entry.end - entry.start || 1))));
  const scale = zoom < 5 ? 0.85 : zoom < 8 ? 1 : 1.15;
  const order = S.trip.legs.slice().sort((a, b) => (a.eventId === S.selected) - (b.eventId === S.selected));
  for (const leg of order) {
    const f = progress.has(leg.id) ? progress.get(leg.id) : 1;
    if (f <= 0) continue;
    const path = detail(leg, zoom);
    let lw = Infinity, le = -Infinity, ls = Infinity, ln = -Infinity;
    if (!leg.bbox) { for (const [x, y] of leg.coarse.coords) { lw = Math.min(lw, x); le = Math.max(le, x); ls = Math.min(ls, y); ln = Math.max(ln, y); } leg.bbox = [lw, ls, le, ln]; }
    const [bw, bs, be, bn] = leg.bbox;
    if (be < w0 - 0.5 || bw > e0 + 0.5 || bn < s0 - 0.5 || bs > n0 + 0.5) continue;
    const coords = f >= 1 ? path.coords : prefix(path, f);
    const pts = coords.map(p => map.project(p));
    const selected = S.selected && leg.eventId === S.selected;
    inkStroke(c, pts, leg, S.selected ? (selected ? 1 : 0.42) : 0.92, scale * (selected ? 1.15 : 1));
    if (f > 0 && f < 1) head = pts[pts.length - 1];
  }
  if (S.nib) {
    if (head && trace) { S.nib.style.display = 'block'; S.nib.style.transform = `translate(${head.x}px, ${head.y - 44}px)`; S.nib.style.transformOrigin = '0 44px'; }
    else S.nib.style.display = 'none';
  }
  if (trace) S.ctx.perf(performance.now() - t0);
}

// ---------------------------------------------------------------- stops & stamps
function buildStops() {
  const byPlace = new Map();
  for (const event of S.trip.events) {
    if (!event.place) continue;
    const entry = byPlace.get(event.place.id) || { place: event.place, events: [], tbd: true };
    entry.events.push(event); entry.tbd = entry.tbd && event.tbd;
    byPlace.set(event.place.id, entry);
  }
  S.stops = [...byPlace.values()].map((entry, index) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `lab-marker o3-stop${entry.tbd ? ' is-tbd' : ''}`;
    el.innerHTML = `<span class="o3-in"><span class="o3-dot"></span><span class="o3-name">${escapeHtml(entry.place.name)}</span></span>`;
    el.setAttribute('aria-label', `${entry.place.name}${entry.tbd ? ' (TBD)' : ''}`);
    el.addEventListener('click', event => { event.stopPropagation(); stopClick(entry); });
    const marker = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([entry.place.lng, entry.place.lat]).addTo(S.map);
    // Itinerary position of the first visit, for the opening reveal.
    return { ...entry, el, marker, index, firstLeg: entry.events[0].legs.at(-1)?.id || null };
  });
}
function layoutStops() {
  if (!S?.stops) return;
  const boxes = [];
  const priority = stop => (stop.events.some(e => e.id === S.selected) ? 0 : stop.tbd ? 2 : 1);
  const sorted = S.stops.slice().sort((a, b) => priority(a) - priority(b) || a.index - b.index);
  for (const stop of sorted) {
    const p = S.map.project([stop.place.lng, stop.place.lat]);
    const width = stop.labelWidth ??= stop.el.querySelector('.o3-name').getBoundingClientRect().width || stop.place.name.length * 8;
    const box = { l: p.x + 12, r: p.x + 18 + width, t: p.y - 11, b: p.y + 11 };
    const hit = boxes.some(o => box.l < o.r && box.r > o.l && box.t < o.b && box.b > o.t);
    stop.el.classList.toggle('no-label', hit);
    if (!hit) boxes.push(box, { l: p.x - 7, r: p.x + 7, t: p.y - 7, b: p.y + 7 });
  }
}
function markStops(pendingIds) {
  for (const stop of S.stops) {
    stop.el.classList.toggle('is-pending', Boolean(pendingIds && stop.firstLeg && pendingIds.has(stop.firstLeg)));
    stop.el.classList.toggle('is-current', Boolean(S.landed && stop.events.some(e => e.id === S.selected)));
  }
}
function stampSvg(event, color, seed) {
  const id = `s${Math.round(seed * 1e6)}`;
  const name = (event.place?.name || event.title).toUpperCase();
  const size = name.length > 14 ? 9.5 : name.length > 10 ? 11 : 12.5;
  const date = (event.tbd ? 'PENCILLED IN · TBD' : event.rawDate.toUpperCase()).replace(/–/g, '—');
  return `<svg viewBox="0 0 120 120" width="104" height="104" aria-hidden="true">
    <defs><path id="${id}t" d="M 19 60 A 41 41 0 0 1 101 60"/><path id="${id}b" d="M 14 60 A 46 46 0 0 0 106 60"/>
    <filter id="${id}f"><feTurbulence type="fractalNoise" baseFrequency="1.2" numOctaves="2" seed="${Math.floor(seed * 90)}"/><feDisplacementMap in="SourceGraphic" scale="2.4"/></filter></defs>
    <g filter="url(#${id}f)" fill="none" stroke="${color}" opacity=".88">
      <circle cx="60" cy="60" r="55" stroke-width="3.2" ${event.tbd ? 'stroke-dasharray="6 4"' : ''}/><circle cx="60" cy="60" r="48" stroke-width="1.1"/>
      <circle cx="60" cy="60" r="27" stroke-width="1.1"/>
      <text fill="${color}" stroke="none" font-family="Fraunces, Georgia, serif" font-weight="600" font-size="${size}" letter-spacing="1.6"><textPath href="#${id}t" startOffset="50%" text-anchor="middle">${escapeHtml(name)}</textPath></text>
      <text fill="${color}" stroke="none" font-family="Fraunces, Georgia, serif" font-size="8.5" letter-spacing="1"><textPath href="#${id}b" startOffset="50%" text-anchor="middle">${escapeHtml(date)}</textPath></text>
      <text x="60" y="58" fill="${color}" stroke="none" text-anchor="middle" font-family="Fraunces, Georgia, serif" font-size="9" letter-spacing="1.5">${escapeHtml(S.trip.eventWord.toUpperCase())}</text>
      <text x="60" y="76" fill="${color}" stroke="none" text-anchor="middle" font-family="Fraunces, Georgia, serif" font-weight="600" font-size="20">${event.number}</text>
    </g></svg>`;
}
function stamp(event, animate) {
  if (!event.place) return;
  for (const old of S.stamps) { old.el.classList.remove('is-new'); old.el.classList.add('is-old'); }
  const existing = S.stamps.findIndex(s => s.eventId === event.id);
  if (existing >= 0) { S.stamps[existing].marker.remove(); S.stamps.splice(existing, 1); }
  const seed = hash(event.id), r = Math.round(seed * 24 - 12);
  const el = document.createElement('div');
  el.className = `o3-stamp${animate ? ' is-new' : ''}`;
  el.style.setProperty('--r', `${r}deg`);
  el.innerHTML = `<div class="o3-stamp-in">${stampSvg(event, STAMP_INKS[(event.number || 0) % STAMP_INKS.length], seed)}</div>`;
  const phone = S.ctx.isPhone();
  const marker = new maplibregl.Marker({ element: el, anchor: 'center', offset: phone ? [58, -62] : [74, -70] }).setLngLat([event.place.lng, event.place.lat]).addTo(S.map);
  S.stamps.push({ el, marker, r, eventId: event.id });
  while (S.stamps.length > 6) S.stamps.shift().marker.remove();
}
function clearNotes() { S.notes.forEach(n => n.remove()); S.notes = []; }
function tbdNotes(event) {
  clearNotes();
  for (const leg of event.legs.filter(l => l.tbd)) {
    const at = along(leg.lite, 0.5).point;
    const el = document.createElement('div');
    el.className = 'o3-note';
    el.textContent = `${modeOf(leg.mode).label.toLowerCase()}?`;
    S.notes.push(new maplibregl.Marker({ element: el, anchor: 'bottom-left', offset: [6, -6] }).setLngLat(at).addTo(S.map));
  }
}

// ---------------------------------------------------------------- markers
function renderPola(el, group, first) {
  const n = group.items.length;
  if (first) {
    const r = Math.round(hash(group.key) * 16 - 8);
    el.style.setProperty('--r', `${r}deg`);
    el.classList.toggle('is-stack', n > 1);
    el.innerHTML = `<span class="o3-frame"><span class="o3-img"></span><span class="o3-pin"></span></span>${n > 1 ? `<span class="o3-count">×${n}</span>` : ''}`;
    const url = group.items.find(p => p.preview)?.preview;
    if (url) el.querySelector('.o3-img').style.backgroundImage = `url("${url}")`;
    el.setAttribute('aria-label', n > 1 ? `${n} photos here` : `Photo${group.items[0].takenLabel ? ` · ${group.items[0].takenLabel}` : ''}`);
  }
  const mine = S.selected && group.items.some(p => p.eventId === S.selected);
  el.classList.toggle('is-dim', Boolean(S.selected && !mine));
  if (first && S.dropping && mine) { el.classList.add('is-drop'); el.style.setProperty('--d', `${Math.round(hash(group.key) * 260)}ms`); }
}
function renderPlace(el, group, first) {
  const n = group.items.length;
  if (first) {
    const label = n > 1 ? `${n} places` : group.items[0].name;
    el.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg><span class="o3-hand">${escapeHtml(label)}</span>`;
    el.setAttribute('aria-label', n > 1 ? `${n} places` : `Place: ${group.items[0].name}`);
  }
  const mine = S.selected && group.items.some(p => p.eventIds.includes(S.selected));
  el.classList.toggle('is-dim', Boolean(S.selected && !mine));
}
let popup = null;
function card(lngLat, body) {
  popup?.remove();
  popup = new maplibregl.Popup({ className: 'o3-card', offset: 22, maxWidth: '260px' }).setLngLat(lngLat).setHTML(body).addTo(S.map);
  return popup;
}
function photoClick(group) {
  if (group.items.length > 1 && S.map.getZoom() < 15) { zoomToGroup(S.map, S.ctx, group); return; }
  const photo = group.items[0], event = S.trip.eventById(photo.eventId);
  card([group.lng, group.lat], `<div class="o3-card-img" style="background-image:url('${photo.preview || ''}')"></div>${escapeHtml(event?.title || '')}<small>${escapeHtml(photo.takenLabel || '')}${photo.sharp ? '' : ' · blurred preview'}${group.items.length > 1 ? ` · ${group.items.length} photos` : ''}</small>`);
}
function placeClick(group) {
  if (group.items.length > 1 && S.map.getZoom() < 15.5) { zoomToGroup(S.map, S.ctx, group, 16); return; }
  const place = group.items[0];
  card([place.lng, place.lat], `${escapeHtml(place.name)}<small>${escapeHtml(place.category)}${place.photoIds.length ? ` · ${place.photoIds.length} linked photo${place.photoIds.length > 1 ? 's' : ''}` : ''}</small>`);
}
function stopClick(entry) {
  if (entry.events.length === 1) { popup?.remove(); S.ctx.onEventPicked(entry.events[0].id); return; }
  const node = card([entry.place.lng, entry.place.lat], `${escapeHtml(entry.place.name)}${entry.events.map(e => `<button type="button" class="o3-choice" data-event="${escapeHtml(e.id)}">${escapeHtml(`${S.trip.eventWord} ${e.number} · ${e.title}`)}<small>${escapeHtml(e.date)}</small></button>`).join('')}`);
  node.getElement().addEventListener('click', event => {
    const button = event.target.closest('[data-event]');
    if (button) { node.remove(); S.ctx.onEventPicked(button.dataset.event); }
  });
}

// ---------------------------------------------------------------- jobs
function startJob(settle, final) {
  cancelJob();
  const job = { cancelled: false, clocks: new Set(), settle, final };
  S.job = job; S.ctx.onPlayState(true);
  return job;
}
function cancelJob(mode) {
  const job = S?.job;
  if (!job) return;
  job.cancelled = true; job.clocks.forEach(c => c.cancel()); S.job = null; S.map.stop();
  if (mode === 'settle') job.settle();
  if (mode === 'final') job.final();
  S.ctx.onPlayState(false);
}
function interrupt() { if (S?.job) cancelJob('settle'); }
function moved(duration) {
  return new Promise(resolve => {
    let done = false;
    const finish = () => { if (!done) { done = true; clearTimeout(timer); S?.map?.off('moveend', finish); resolve(); } };
    const timer = setTimeout(finish, duration + 400);
    S.map.on('moveend', finish);
  });
}
const easeCamera = (job, camera, duration) => { if (job.cancelled) return Promise.resolve(); S.map.easeTo({ ...camera, duration, essential: true }); return moved(duration); };
const playClock = (job, duration, onFrame) => new Promise(resolve => {
  if (job.cancelled) return resolve();
  const c = clock(duration, onFrame, () => { job.clocks.delete(c); resolve(); });
  job.clocks.add(c);
});
const sleep = (job, ms) => new Promise(resolve => setTimeout(resolve, job.cancelled ? 0 : ms));

function setSelected(id, landed) {
  S.selected = id; S.landed = landed;
  S.photos.refresh(); S.places.refresh();
  markStops(null); layoutStops();
}
function revealOnce() { if (!S.revealed) { S.revealed = true; reveal(S.map); } }
function overviewCamera() { return cameraFor(S.map, S.ctx, { bounds: S.trip.bounds, maxZoom: 10 }, { extra: 26 }); }
function settleTrace() { S.trace = null; markStops(null); S.container.classList.remove('o3-hidden-markers'); draw(); }

export function showOverview({ opening = false } = {}) {
  if (!S?.map) return;
  cancelJob(); popup?.remove(); clearNotes();
  setSelected(null, false);
  const target = overviewCamera();
  if (!opening || S.reduced) {
    settleTrace();
    if (!S.revealed || S.reduced) S.map.jumpTo(target); else S.map.easeTo({ ...target, duration: 850 });
    revealOnce();
    return;
  }
  const settle = () => settleTrace();
  const job = startJob(settle, () => { settle(); S.map.jumpTo(target); });
  S.map.jumpTo(target);
  const plan = tracePlan(S.trip.orderedLegs);
  S.trace = { plan, t: 0 };
  S.container.classList.add('o3-hidden-markers');
  const pending = new Set(S.trip.legs.map(l => l.id));
  markStops(pending);
  revealOnce();
  (async () => {
    // 3-second itinerary-order trace with the whole route framed (O06).
    await playClock(job, 3000, t => {
      S.trace.t = t;
      for (const entry of plan) if (t >= entry.end) pending.delete(entry.leg.id);
      markStops(pending);
      draw();
    });
    if (job.cancelled) return;
    S.job = null; settle(); S.ctx.onPlayState(false);
  })();
}

function landingCamera(event) { return cameraFor(S.map, S.ctx, S.trip.eventFrame(event), { extra: 40 }); }
function land(event, animate) {
  S.dropping = animate && !S.reduced;
  setSelected(event.id, true);
  markStops(null);
  stamp(event, animate && !S.reduced);
  tbdNotes(event);
  S.photos.rebuildNow();
  setTimeout(() => { if (S) S.dropping = false; }, 1200);
}

function travel(event, legs, destination) {
  const settle = () => { settleTrace(); land(event, false); };
  const job = startJob(settle, () => { settle(); if (destination) S.map.jumpTo(destination); });
  setSelected(event.id, false);
  clearNotes();
  const plan = (event.chains.length > 1 && legs === event.legs ? event.chains : [legs]).flatMap(chain => tracePlan(chain));
  S.trace = { plan, t: 0 };
  draw();
  const frame = cameraFor(S.map, S.ctx, { bounds: S.trip.routeFrame(legs), maxZoom: 12.5 }, { extra: 46 });
  (async () => {
    await easeCamera(job, frame, 850);
    if (job.cancelled) return;
    await playClock(job, 1500, t => { S.trace.t = t; draw(); });
    if (job.cancelled) return;
    await sleep(job, 250);
    if (job.cancelled) return;
    S.trace = null; draw();
    if (destination) await easeCamera(job, destination, 900);
    if (job.cancelled) return;
    S.job = null; settleTrace(); land(event, true); S.ctx.onPlayState(false);
  })();
}

export function selectEvent(id, { animate = true } = {}) {
  if (!S?.map) return;
  const event = S.trip.eventById(id);
  if (!event) return;
  cancelJob(); popup?.remove();
  const camera = landingCamera(event);
  if (!animate || S.reduced || !event.legs.length) {
    settleTrace();
    if (camera) { if (!S.revealed || S.reduced || !animate) S.map.jumpTo(camera); else S.map.easeTo({ ...camera, duration: 900 }); }
    land(event, animate && S.revealed);
    revealOnce();
    return;
  }
  revealOnce();
  travel(event, event.legs, camera);
}
export function playLeg(id) {
  if (!S?.map) return;
  if (S.trip.eventById(id)) { selectEvent(id, { animate: true }); return; }
  const leg = S.trip.legById.get(id);
  if (!leg) return;
  const event = S.trip.eventById(leg.eventId);
  cancelJob();
  travel(event, [leg], { center: [leg.toPlace.lng, leg.toPlace.lat], zoom: 11, bearing: 0, pitch: 0 });
}
export function skip() { cancelJob('final'); }
export function setReducedMotion(value) { if (!S) return; S.reduced = Boolean(value); if (S.reduced && S.job) cancelJob('final'); }

export function legendSwatch(mode) {
  const color = mode === 'tbd' ? PENCIL : INK[mode];
  const base = `<path d="M5 8h54" stroke="${color}"`;
  const body = {
    train: `${base} stroke-width="2"/>${base} stroke-width="8" stroke-dasharray="1.4 7.5"/>`,
    boat: `${base} stroke-width="2.3" stroke-dasharray="4.6 3.8" stroke-linecap="round"/>`,
    bus: `${base} stroke-width="2.6" stroke-dasharray="11 5"/>`,
    gondola: `${base} stroke-width="1.1"/>${base} stroke-width="6" stroke-linecap="round" stroke-dasharray="0.1 10"/>`,
    walk: `${base} stroke-width="2.8" stroke-linecap="round" stroke-dasharray="0.1 4.8"/>`,
    car: `${base} stroke-width="2.6" stroke-dasharray="9 3 1.6 3"/>`,
    bike: `${base} stroke-width="2.4" stroke-dasharray="6 3.6"/>`,
    tbd: `${base} stroke-width="2.3" stroke-linecap="round" stroke-dasharray="0.1 5.4"/>`
  }[mode] || `${base} stroke-width="2"/>`;
  return `<svg width="64" height="16" viewBox="0 0 64 16" aria-hidden="true">${body}</svg>`;
}
export function legendExtras() {
  return [
    { swatch: '<svg width="44" height="24" viewBox="0 0 44 24"><g transform="rotate(-5 22 12)"><rect x="12" y="1" width="20" height="22" fill="#fffdf6" stroke="#cbbd9f"/><rect x="14" y="3" width="16" height="14" fill="#b8a98a"/></g></svg>', label: 'Photos', note: 'pinned polaroid; a stack with ×N is a group' },
    { swatch: '<svg width="44" height="24" viewBox="0 0 44 24"><path d="M6 8l8 8M14 8l-8 8" stroke="#7c271f" stroke-width="2.2" stroke-linecap="round"/><text x="17" y="17" font-family="Caveat" font-size="15" font-weight="700" fill="#7c271f">Café</text></svg>', label: 'Curated place', note: 'hand-lettered' },
    { swatch: '<svg width="44" height="24" viewBox="0 0 44 24"><circle cx="22" cy="12" r="10" fill="none" stroke="#7c271f" stroke-width="2"/><circle cx="22" cy="12" r="6.5" fill="none" stroke="#7c271f" stroke-width=".8"/></svg>', label: 'Passport stamp', note: 'marks the stop you arrived at; dashed for TBD' }
  ];
}

export function destroy() {
  if (!S) return;
  cancelJob(); popup?.remove(); popup = null; clearNotes();
  S.offInput?.();
  S.photos?.destroy(); S.places?.destroy(); S.overlay?.destroy();
  S.stamps.forEach(s => s.marker.remove());
  S.stops?.forEach(s => s.marker.remove());
  S.map?.remove();
  S.container.classList.remove('o3', 'o3-city', 'o3-hidden-markers');
  S = null;
}
void ease;
