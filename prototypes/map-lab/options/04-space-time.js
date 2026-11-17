// Option 4 · Space-time. A draggable story-time scrubber drives the map, and
// a deck.gl time cube lifts the journey into the third dimension: height is
// time, stays rise as columns, legs climb as diagonals, photos float at the
// moment and place they were taken. Selecting a stop collapses the cube onto
// the map and lands in the city.
import { MODES, modeOf, along, tracePlan, clock, ease, icon, escapeHtml, boundsCenter, haversine, fmtKm, fmtDuration, placeIcon } from '../data.js';
import { createMap, reveal, cameraFor, onUserInput, injectStyle, loadScript, OFM } from './common.js';

export const meta = {
  number: 4, name: 'Space-time', theme: 'light', keyBackground: '#f4f6f6',
  tagline: 'Time becomes a dimension you can hold. Drag the scrubber to move through the trip; in the cube, height is time, so long stays rise as columns and travel days climb as diagonals.',
  whatsNew: [
    'Story-time scrubber as the main control: stays, legs (with their patterns), TBD stretch and a photo histogram on one draggable track.',
    'deck.gl space-time cube over a light basemap: stays are vertical columns, legs are diagonals, photos are points at their capture time and place.',
    'The cube collapses onto the flat map when you choose a stop, and rises again for the whole trip.'
  ],
  keeps: ['Transport colours with dash cues on legs; TBD stays and legs dashed/dotted and lighter.', 'Unselected opening; direct links land without animation; input interrupts; reduced motion shows the end state.', 'Photos only where they have coordinates; capture time is the only text shown for them.'],
  departures: [
    'Story time is non-linear: stays are compressed and short legs stretched so travel is draggable (calendar dates are shown, not distances in time).',
    'Tilted, rotated 3D camera in the cube; a scrubber panel takes space above the stop picker (O06/O08 layout).',
    'deck.gl (1.6 MB) is a new dependency; car dash-dot is approximated by a long dash in the cube.',
    'Whole-trip Replay re-runs the opening sweep (O09).'
  ],
  phone: 'The scrubber is thumb-friendly and works one-handed; the cube reads on a phone but its labels thin out, so Map view is the better phone default. deck.gl adds a second WebGL canvas.'
};

const DECK = 'https://cdn.jsdelivr.net/npm/deck.gl@9.1.14/dist.min.js';
const DAY = 86400000;
const hex = (h, a = 255) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), a];
const DECK_DASH = { train: [0, 0], boat: [1.2, 1.5], bus: [5, 2], gondola: [0.6, 2.4], walk: [0.4, 1.6], car: [8, 2.4], bike: [2.4, 1.3] };
const INK = '#22313a';
const PHOTO = '#c2255c';
const CSS = `
.o4 { background:#eceff0; }
.o4-scrub { position:relative; background:#fbfcfc; border-radius:18px; box-shadow: var(--chrome-shadow); padding:8px 12px 10px; color:#1f2b2f; }
.o4-readout { display:flex; align-items:baseline; gap:8px; min-height:22px; font:13px/1.3 var(--font-ui); white-space:nowrap; overflow:hidden; }
.o4-readout b { font-size:15px; letter-spacing:-.01em; overflow:hidden; text-overflow:ellipsis; }
.o4-readout span { color:#59686b; overflow:hidden; text-overflow:ellipsis; font-family: "JetBrains Mono", ui-monospace, monospace; font-size:12px; }
.o4-track { position:relative; height:58px; margin-top:6px; touch-action:none; cursor:ew-resize; border-radius:10px; outline:none; }
.o4-track:focus-visible { box-shadow: 0 0 0 2px #006f92; }
.o4-track canvas { position:absolute; inset:0; width:100%; height:100%; }
.o4-photo-card { position:absolute; right:12px; bottom: calc(100% + 8px); display:flex; gap:8px; align-items:center; background:#fff; border-radius:12px; padding:6px; box-shadow: var(--chrome-shadow); font:12px/1.3 var(--font-ui); max-width: calc(100% - 24px); }
.o4-photo-card span.o4-ph { width:64px; height:48px; border-radius:8px; background:#ccc center/cover; flex:none; }
.o4-photo-card button { width:44px; height:44px; border:0; background:none; border-radius:22px; cursor:pointer; color:#59686b; }
@media (max-width: 760px) { .o4-track { height: 52px; } .o4-readout b { font-size:14px; } }
`;

let S = null;

// ---------------------------------------------------------------- story time
function buildTimeline(trip) {
  const items = [];
  for (const event of trip.events) {
    for (const leg of event.legs) items.push({ type: 'leg', leg, event, weight: 0.45 + 0.2 * Math.log2(1 + leg.lengthKm / 25) });
    const start = event.calendarDate ? Date.parse(`${event.calendarDate}T00:00:00Z`) : null;
    const end = event.calendarEndDate ? Date.parse(`${event.calendarEndDate}T00:00:00Z`) + DAY : start !== null ? start + DAY : null;
    const nights = start !== null ? Math.max(0.5, (end - start) / DAY - 1) : null;
    items.push({ type: 'stay', event, start, end, weight: nights === null ? 0.8 : 0.6 + 0.5 * Math.sqrt(nights) });
  }
  const total = items.reduce((sum, item) => sum + item.weight, 0) || 1;
  let at = 0;
  for (const item of items) { item.t0 = at / total; at += item.weight; item.t1 = at / total; }
  const byEvent = new Map();
  for (const item of items) { if (!byEvent.has(item.event.id)) byEvent.set(item.event.id, []); byEvent.get(item.event.id).push(item); }
  return { items, byEvent };
}
function itemAt(T) {
  const items = S.timeline.items;
  let lo = 0, hi = items.length - 1;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (items[mid].t1 < T) lo = mid + 1; else hi = mid; }
  return items[Math.max(0, Math.min(items.length - 1, lo))];
}
function positionAt(T) {
  const item = itemAt(T);
  if (!item) return null;
  if (item.type === 'stay') { const p = item.event.place; return p ? [p.lng, p.lat] : null; }
  const f = (T - item.t0) / ((item.t1 - item.t0) || 1);
  return along(item.leg.lite, f).point;
}
// Photos sit at their capture moment within their event's span.
function photoTime(photo) {
  const items = S.timeline.byEvent.get(photo.eventId) || [];
  const stay = items.find(i => i.type === 'stay');
  if (!stay) return null;
  const span = S.trip.city ? [stay.t0, stay.t1] : [items[0].t0, stay.t1];
  let f = 0.5;
  if (photo.time !== null && stay.start !== null) {
    const day0 = stay.start, day1 = stay.end;
    if (S.trip.city) f = (photo.time - day0) / ((day1 - day0) || DAY);
    else { const hours = ((photo.time - day0) / 3600000); f = (hours - 6) / 18; }
  }
  f = Math.max(0.03, Math.min(0.97, f));
  return span[0] + (span[1] - span[0]) * f;
}

// ---------------------------------------------------------------- layers
function geometry(zScale) {
  if (S.geomCache?.z === zScale) return S.geomCache;
  const H = S.height * zScale;
  const paths = [], stays = [];
  for (const item of S.timeline.items) {
    if (item.type === 'leg') {
      const { coords, cum } = item.leg.lite, total = cum[cum.length - 1] || 1;
      paths.push({ item, mode: item.leg.mode, tbd: item.leg.tbd, path: coords.map((c, i) => [c[0], c[1], (item.t0 + (item.t1 - item.t0) * (cum[i] / total)) * H]), t1: item.t1, eventId: item.event.id });
    } else if (item.event.place) {
      const p = item.event.place;
      stays.push({ item, tbd: item.event.tbd, path: [[p.lng, p.lat, item.t0 * H], [p.lng, p.lat, item.t1 * H]], t1: item.t1, eventId: item.event.id, name: p.name, top: [p.lng, p.lat, item.t1 * H] });
    }
  }
  const photos = S.trip.located.map(photo => ({ photo, t: photoTime(photo) })).filter(d => d.t !== null).map(d => ({ ...d, position: [d.photo.lng, d.photo.lat, d.t * H] }));
  const places = S.trip.locatedPois.map(point => {
    const stay = (S.timeline.byEvent.get(point.eventIds[0]) || []).find(i => i.type === 'stay');
    return { point, position: [point.lng, point.lat, stay ? ((stay.t0 + stay.t1) / 2) * H : 0], eventId: point.eventIds[0] };
  });
  S.geomCache = { z: zScale, H, paths, stays, photos, places };
  return S.geomCache;
}
function clipped(paths, T) {
  // The leg in progress, cut at the playhead (opening sweep and travel).
  const out = [];
  for (const d of paths) {
    if (d.item.t0 >= T || d.item.t1 <= T) continue;
    const f = (T - d.item.t0) / ((d.item.t1 - d.item.t0) || 1);
    const cut = Math.max(1, Math.ceil(f * (d.path.length - 1)));
    const a = d.path[cut - 1], b = d.path[Math.min(cut, d.path.length - 1)];
    const local = f * (d.path.length - 1) - (cut - 1);
    out.push({ ...d, path: [...d.path.slice(0, cut), [a[0] + (b[0] - a[0]) * local, a[1] + (b[1] - a[1]) * local, a[2] + (b[2] - a[2]) * local]] });
  }
  return out;
}
function layers() {
  const D = window.deck, g = geometry(S.z), sel = S.selected, T = S.T, reveal = S.reveal ?? 1;
  const dim = d => sel && d.eventId !== sel;
  const pathStyle = new D.PathStyleExtension({ dash: true });
  const filter = new D.DataFilterExtension({ filterSize: 1 });
  const bounds = S.trip.bounds, pad = 0.6;
  const plane = [[bounds[0][0] - pad, bounds[0][1] - pad], [bounds[1][0] + pad, bounds[0][1] - pad], [bounds[1][0] + pad, bounds[1][1] + pad], [bounds[0][0] - pad, bounds[1][1] + pad]];
  const z = T * g.H;
  const pos = positionAt(T);
  const legColor = d => hex(modeOf(d.mode).color, d.tbd ? 150 : dim(d) ? 70 : 255);
  const out = [
    // Ground tracks (the map footprint of every leg).
    new D.PathLayer({ id: 'floor', data: g.paths, getPath: d => d.path.map(p => [p[0], p[1], 0]), getColor: d => hex(modeOf(d.mode).color, S.z > 0.05 ? 60 : 0), getWidth: 2, widthUnits: 'pixels', updateTriggers: { getColor: S.z > 0.05 } }),
    new D.PathLayer({ id: 'legs', data: g.paths, getPath: d => d.path, getColor: legColor, getWidth: d => (sel && d.eventId === sel ? 5 : 3.5), widthUnits: 'pixels', billboard: true, capRounded: true, jointRounded: true,
      getDashArray: d => (d.tbd ? [0.4, 2.2] : DECK_DASH[d.mode] || [0, 0]), dashJustified: true, extensions: [pathStyle, filter], getFilterValue: d => d.t1, filterRange: [0, reveal],
      updateTriggers: { getColor: [sel], getWidth: [sel] }, pickable: true, onClick: info => info.object && S.ctx.onEventPicked(info.object.eventId) }),
    new D.PathLayer({ id: 'legs-live', data: reveal < 1 ? clipped(g.paths, reveal) : [], getPath: d => d.path, getColor: legColor, getWidth: 4, widthUnits: 'pixels', billboard: true, capRounded: true,
      getDashArray: d => (d.tbd ? [0.4, 2.2] : DECK_DASH[d.mode] || [0, 0]), extensions: [pathStyle] }),
    new D.PathLayer({ id: 'stays', data: g.stays, getPath: d => d.path, getColor: d => hex(d.tbd ? '#7c8c90' : INK, dim(d) ? 70 : 235), getWidth: d => (sel && d.eventId === sel ? 8 : 5.5), widthUnits: 'pixels', billboard: true, capRounded: true,
      getDashArray: d => (d.tbd ? [1.2, 1.2] : [0, 0]), extensions: [pathStyle, filter], getFilterValue: d => d.t1, filterRange: [0, reveal + 1e-6], updateTriggers: { getColor: [sel], getWidth: [sel] },
      pickable: true, onClick: info => info.object && S.ctx.onEventPicked(info.object.eventId) }),
    new D.ScatterplotLayer({ id: 'photos', data: g.photos.filter(d => d.t <= reveal + 1e-6), getPosition: d => d.position, getFillColor: d => hex(PHOTO, sel && d.photo.eventId !== sel ? 70 : 230), getLineColor: [255, 255, 255, 230], lineWidthMinPixels: 1, stroked: true,
      radiusUnits: 'pixels', getRadius: d => (Math.abs(d.t - T) < 0.004 ? 7 : 3.6), billboard: true, pickable: true, updateTriggers: { getFillColor: [sel], getRadius: [Math.round(T * 500)] }, onClick: info => info.object && photoCard(info.object) }),
    new D.ScatterplotLayer({ id: 'places', data: g.places, getPosition: d => d.position, getFillColor: [255, 255, 255, 230], getLineColor: d => hex('#9a6b00', sel && d.eventId !== sel ? 80 : 255), stroked: true, lineWidthUnits: 'pixels', getLineWidth: 2.4, radiusUnits: 'pixels', getRadius: 5.5, billboard: true, pickable: true, updateTriggers: { getLineColor: [sel] },
      onClick: info => info.object && placeCard(info.object.point) }),
    new D.TextLayer({ id: 'labels', data: g.stays.filter(d => !d.tbd || !sel).filter((d, i, all) => all.findIndex(o => o.name === d.name) === i || (sel && d.eventId === sel)), getPosition: d => d.top, getText: d => d.name, characterSet: 'auto',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', fontWeight: 600, getSize: 12.5, sizeUnits: 'pixels', getColor: d => hex(d.tbd ? '#5d6b6e' : '#1f2b2f', dim(d) ? 90 : 255),
      getPixelOffset: [0, -12], background: true, getBackgroundColor: [251, 252, 252, 220], backgroundPadding: [4, 2], billboard: true, updateTriggers: { getColor: [sel] }, getFilterValue: d => d.t1, filterRange: [0, reveal + 1e-6],
      extensions: D.CollisionFilterExtension ? [filter, new D.CollisionFilterExtension()] : [filter], collisionEnabled: true, getCollisionPriority: d => (sel && d.eventId === sel ? 100 : d.tbd ? 0 : 10), collisionTestProps: { sizeScale: 1.6 } })
  ];
  if (S.z > 0.02) {
    out.push(new D.SolidPolygonLayer({ id: 'plane', data: [{ polygon: plane.map(p => [p[0], p[1], z]) }], getPolygon: d => d.polygon, _full3d: true, getFillColor: [0, 111, 146, 16], updateTriggers: { getPolygon: z } }));
    out.push(new D.PathLayer({ id: 'plane-edge', data: [{ path: [...plane, plane[0]].map(p => [p[0], p[1], z]) }], getPath: d => d.path, getColor: [0, 111, 146, 120], getWidth: 1.2, widthUnits: 'pixels', updateTriggers: { getPath: z } }));
    if (pos) out.push(new D.PathLayer({ id: 'drop', data: [{ path: [[pos[0], pos[1], 0], [pos[0], pos[1], z]] }], getPath: d => d.path, getColor: [212, 81, 44, 160], getWidth: 1.5, widthUnits: 'pixels', getDashArray: [3, 3], extensions: [pathStyle], updateTriggers: { getPath: [pos, z] } }));
  }
  if (pos) out.push(new D.ScatterplotLayer({ id: 'now', data: [{ position: [pos[0], pos[1], z] }], getPosition: d => d.position, getFillColor: hex('#d4512c'), getLineColor: [255, 255, 255, 255], stroked: true, lineWidthMinPixels: 2.5, radiusUnits: 'pixels', getRadius: 8, billboard: true, updateTriggers: { getPosition: [pos, z] } }));
  return out;
}
let raf = 0;
function draw() {
  if (!S?.overlay) return;
  const t0 = performance.now();
  S.overlay.setProps({ layers: layers() });
  drawTrack();
  updateReadout();
  if (S.job) S.ctx.perf(performance.now() - t0);
}
function schedule() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; draw(); }); }

// ---------------------------------------------------------------- scrubber
function buildScrubber() {
  const wrap = document.createElement('div');
  wrap.className = 'o4-scrub';
  wrap.style.visibility = 'hidden'; // shown with its first drawn state, never empty
  wrap.innerHTML = `<div class="o4-readout"><b></b><span></span></div><div class="o4-track" role="slider" tabindex="0" aria-label="Journey time" aria-valuemin="0" aria-valuemax="1000"><canvas></canvas></div>`;
  S.ctx.slots.panel.append(wrap);
  S.scrub = { wrap, title: wrap.querySelector('b'), meta: wrap.querySelector('.o4-readout span'), track: wrap.querySelector('.o4-track'), canvas: wrap.querySelector('canvas') };
  const track = S.scrub.track;
  const setFrom = event => {
    const box = track.getBoundingClientRect();
    scrubTo((event.clientX - box.left - 6) / (box.width - 12));
  };
  track.addEventListener('pointerdown', event => { interrupt(); hideCard(); track.setPointerCapture(event.pointerId); S.dragging = true; setFrom(event); });
  track.addEventListener('pointermove', event => { if (S.dragging) setFrom(event); });
  const end = () => { if (!S.dragging) return; S.dragging = false; settleScrub(); };
  track.addEventListener('pointerup', end);
  track.addEventListener('pointercancel', end);
  track.addEventListener('keydown', event => {
    const items = S.timeline.items, current = items.indexOf(itemAt(S.T));
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault(); event.stopPropagation(); interrupt();
      const next = items[Math.max(0, Math.min(items.length - 1, current + (event.key === 'ArrowRight' ? 1 : -1)))];
      scrubTo((next.t0 + next.t1) / 2); settleScrub();
    }
  });
}
function scrubTo(T) {
  S.T = Math.max(0, Math.min(1, T));
  S.reveal = 1;
  const item = itemAt(S.T);
  if (item !== S.lastItem) {
    S.lastItem = item;
    if (S.z < 0.5) {
      const camera = item.type === 'stay' ? cameraFor(S.map, S.ctx, S.trip.eventFrame(item.event), { extra: 40 }) : cameraFor(S.map, S.ctx, { bounds: S.trip.routeFrame([item.leg]) }, { extra: 50 });
      if (camera) S.map.easeTo({ ...camera, pitch: 0, bearing: 0, duration: S.reduced ? 0 : 450 });
    }
  }
  schedule();
}
function settleScrub() {
  const item = itemAt(S.T);
  if (item.type === 'stay') { S.selected = item.event.id; S.ctx.onEventShown(item.event.id); }
  schedule();
}
function drawTrack() {
  const { canvas, track } = S.scrub;
  const w = track.clientWidth, h = track.clientHeight, ratio = Math.min(2, devicePixelRatio || 1);
  if (canvas.width !== Math.round(w * ratio)) { canvas.width = Math.round(w * ratio); canvas.height = Math.round(h * ratio); }
  const c = canvas.getContext('2d');
  c.setTransform(ratio, 0, 0, ratio, 0, 0);
  c.clearRect(0, 0, w, h);
  const x = t => 6 + t * (w - 12);
  const sel = S.selected;
  // Photo histogram (located and unlocated: the album size over story time).
  const buckets = new Array(Math.max(20, Math.floor(w / 4))).fill(0);
  for (const photo of S.trip.photos) { const t = photoTime(photo); if (t !== null) buckets[Math.min(buckets.length - 1, Math.floor(t * buckets.length))]++; }
  const max = Math.max(1, ...buckets);
  c.fillStyle = PHOTO;
  buckets.forEach((n, i) => { if (!n) return; const bh = 3 + (n / max) * 14; c.globalAlpha = 0.55; c.fillRect(x(i / buckets.length), 18 - bh, Math.max(1.5, (w - 12) / buckets.length - 1), bh); });
  c.globalAlpha = 1;
  // Stays as blocks, legs as patterned lines.
  for (const item of S.timeline.items) {
    const x0 = x(item.t0), x1 = x(item.t1), dim = sel && item.event.id !== sel;
    if (item.type === 'stay') {
      c.globalAlpha = dim ? 0.35 : 1;
      c.fillStyle = item.event.tbd ? '#ffffff' : INK;
      c.strokeStyle = item.event.tbd ? '#7c8c90' : INK;
      c.setLineDash(item.event.tbd ? [3, 2] : []);
      c.beginPath(); c.roundRect(x0 + 0.5, 24, Math.max(2, x1 - x0 - 1), 16, 4); c.fill(); c.lineWidth = 1.2; c.stroke();
      if (x1 - x0 > 18) { c.fillStyle = item.event.tbd ? '#5d6b6e' : '#fff'; c.font = '600 12px -apple-system, system-ui, sans-serif'; c.textAlign = 'center'; c.fillText(String(item.event.number), (x0 + x1) / 2, 36.5); }
    } else {
      const m = modeOf(item.leg.mode);
      c.globalAlpha = dim ? 0.35 : 1;
      c.strokeStyle = m.color; c.lineWidth = 4; c.lineCap = item.leg.tbd ? 'round' : 'butt';
      c.setLineDash(item.leg.tbd ? [0.1, 5] : (m.dash || []).map(v => v * 3));
      c.beginPath(); c.moveTo(x0 + 1, 32); c.lineTo(x1 - 1, 32); c.stroke();
    }
  }
  c.setLineDash([]); c.globalAlpha = 1;
  // Month marks where the calendar month changes.
  c.fillStyle = '#59686b'; c.font = '12px -apple-system, system-ui, sans-serif'; c.textAlign = 'left';
  let lastMonth = '', lastX = -100;
  for (const item of S.timeline.items) {
    if (item.type !== 'stay' || item.start === null) continue;
    const month = new Date(item.start).toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' });
    if (month !== lastMonth && x(item.t0) - lastX > 34) { c.fillText(month, x(item.t0), h - 3); lastX = x(item.t0); lastMonth = month; }
  }
  const tbdStart = S.timeline.items.find(item => item.event.tbd);
  if (tbdStart && x(tbdStart.t0) - lastX > 30) { c.fillStyle = '#7c8c90'; c.fillText('TBD', x(tbdStart.t0), h - 3); }
  // Playhead.
  const hx = x(S.T);
  c.fillStyle = '#d4512c'; c.fillRect(hx - 1.25, 4, 2.5, h - 18);
  c.beginPath(); c.arc(hx, 32, 8, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#fff'; c.lineWidth = 2.5; c.stroke();
  track.setAttribute('aria-valuenow', String(Math.round(S.T * 1000)));
  S.scrub.wrap.style.visibility = '';
}
function updateReadout() {
  const item = itemAt(S.T);
  if (!item) return;
  let title, metaText;
  if (item.type === 'stay') {
    const e = item.event;
    title = `${e.place?.name || e.title}`;
    metaText = [`${S.trip.eventWord} ${e.number}`, e.date, e.photos.length ? `${e.photos.length} photo${e.photos.length > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ');
  } else {
    const leg = item.leg;
    title = `${leg.fromPlace.name} → ${leg.toPlace.name}`;
    metaText = [`${modeOf(leg.mode).label}${leg.tbd ? ' (TBD)' : ''}`, fmtKm(leg.km), leg.durationMin ? fmtDuration(leg.durationMin) : '', item.event.tbd ? '' : item.event.rawDate].filter(Boolean).join(' · ');
  }
  if (S.scrub.title.textContent !== title) S.scrub.title.textContent = title;
  if (S.scrub.meta.textContent !== metaText) S.scrub.meta.textContent = metaText;
  S.scrub.track.setAttribute('aria-valuetext', `${title}, ${metaText}`);
}
function photoCard(d) {
  hideCard();
  const card = document.createElement('div');
  card.className = 'o4-photo-card';
  const event = S.trip.eventById(d.photo.eventId);
  card.innerHTML = `<span class="o4-ph" style="background-image:url('${d.photo.preview || ''}')"></span><span><b>${escapeHtml(event?.title || '')}</b><br>${escapeHtml(d.photo.takenLabel || 'Photo')}${d.photo.sharp ? '' : '<br><span style="color:#59686b">blurred preview</span>'}</span><button type="button" aria-label="Close">✕</button>`;
  card.querySelector('button').addEventListener('click', hideCard);
  S.scrub.wrap.append(card);
  S.card = card;
  interrupt();
  scrubTo(d.t); settleScrub();
}
function placeCard(point) {
  hideCard();
  const card = document.createElement('div');
  card.className = 'o4-photo-card';
  card.innerHTML = `<span style="padding:0 6px">${icon(placeIcon(point.category), { size: 20 })}</span><span><b>${escapeHtml(point.name)}</b><br>${escapeHtml(point.category)}</span><button type="button" aria-label="Close">✕</button>`;
  card.querySelector('button').addEventListener('click', hideCard);
  S.scrub.wrap.append(card);
  S.card = card;
}
function hideCard() { S?.card?.remove(); if (S) S.card = null; }

// ---------------------------------------------------------------- mount
export async function mount(container, trip, ctx) {
  injectStyle('lab-o4', CSS);
  container.classList.add('o4');
  S = { trip, ctx, container, reduced: false, selected: null, job: null, T: 0, z: 1, cubePref: !ctx.isPhone(), revealed: false, reveal: 1 };
  const mine = S;
  S.timeline = buildTimeline(trip);
  const b = trip.bounds, mid = (b[0][1] + b[1][1]) / 2;
  const widthKm = haversine([b[0][0], mid], [b[1][0], mid]), heightKm = haversine([(b[0][0] + b[1][0]) / 2, b[0][1]], [(b[0][0] + b[1][0]) / 2, b[1][1]]);
  S.height = Math.max(widthKm, heightKm, 20) * 1000 * 0.5;
  buildScrubber();
  const [map] = await Promise.all([
    createMap(container, { style: OFM('positron'), center: boundsCenter(trip.bounds), zoom: 4, maxZoom: 16, maxPitch: 70 }, { onStyle: m => {
      for (const layer of m.getStyle().layers) {
        if (/poi|shield|highway-name|label_other|label_village/.test(layer.id)) m.setLayoutProperty(layer.id, 'visibility', 'none');
        if (layer.type === 'background') m.setPaintProperty(layer.id, 'background-color', '#eceff0');
        if (layer.id === 'water') m.setPaintProperty(layer.id, 'fill-color', '#d3dde2');
        if (/label_(city|town)/.test(layer.id)) m.setLayerZoomRange(layer.id, 7.5, 24);
      }
    } }),
    loadScript(DECK)
  ]);
  if (S !== mine) { map.remove(); return; }
  S.map = map;
  S.overlay = new window.deck.MapboxOverlay({ interleaved: false, layers: [], pickingRadius: 18, useDevicePixels: Math.min(2, devicePixelRatio || 1) });
  map.addControl(S.overlay);
  const segment = document.createElement('div');
  segment.className = 'lab-segment';
  segment.setAttribute('role', 'group');
  segment.setAttribute('aria-label', 'View');
  segment.innerHTML = `<button type="button" data-cube="1" aria-pressed="${S.cubePref}">Cube</button><button type="button" data-cube="0" aria-pressed="${!S.cubePref}">Map</button>`;
  segment.addEventListener('click', event => {
    const button = event.target.closest('button[data-cube]');
    if (!button) return;
    S.cubePref = button.dataset.cube === '1';
    segment.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === button)));
    if (S.selected && !S.cubePref) return;
    morph(S.cubePref ? 1 : 0, S.cubePref ? cubeCamera() : (S.selected ? landingCamera(S.trip.eventById(S.selected)) : flatCamera()));
  });
  ctx.slots.tools.append(segment);
  S.segment = segment;
  S.offInput = onUserInput(map, interrupt);
  S.onResize = () => schedule();
  window.addEventListener('resize', S.onResize);
}

// The floor sits low in the view so the cube's height has room above it.
function cubeCamera() {
  const c = cameraFor(S.map, S.ctx, { bounds: S.trip.bounds, maxZoom: 9 }, { extra: 30 });
  const inset = S.ctx.insets(), h = S.container.clientHeight;
  return { ...c, zoom: c.zoom - 0.55, pitch: 55, bearing: -22, offset: [0, Math.round((h - inset.top - inset.bottom) * 0.2)] };
}
// jumpTo has no offset; a zero-length ease does.
function place(camera) { S.map.easeTo({ ...camera, duration: 0 }); }
function flatCamera() { return { ...cameraFor(S.map, S.ctx, { bounds: S.trip.bounds, maxZoom: 10 }, { extra: 30 }), pitch: 0, bearing: 0 }; }
function landingCamera(event) { const c = cameraFor(S.map, S.ctx, S.trip.eventFrame(event), { extra: 40 }); return c && { ...c, pitch: 0, bearing: 0 }; }

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
const playClock = (job, duration, onFrame) => new Promise(resolve => {
  if (job.cancelled) return resolve();
  const c = clock(duration, onFrame, () => { job.clocks.delete(c); resolve(); });
  job.clocks.add(c);
});
function moved(duration) {
  return new Promise(resolve => {
    let done = false;
    const finish = () => { if (!done) { done = true; clearTimeout(timer); S?.map?.off('moveend', finish); resolve(); } };
    const timer = setTimeout(finish, duration + 400);
    S.map.on('moveend', finish);
  });
}
// Cube ↔ map: z scale and camera move together.
function morph(target, camera, job) {
  const from = S.z;
  S.map.easeTo({ ...camera, duration: S.reduced ? 0 : 1100, essential: true });
  if (S.reduced || from === target) { S.z = target; S.geomCache = null; schedule(); return Promise.resolve(); }
  return new Promise(resolve => {
    const c = clock(1100, t => { S.z = from + (target - from) * ease.inOut(t); draw(); }, () => { S.z = target; draw(); resolve(); });
    if (job) job.clocks.add(c); else S.morphClock = c;
  });
}
function revealOnce() { if (!S.revealed) { S.revealed = true; reveal(S.map); } }

export function showOverview({ opening = false } = {}) {
  if (!S?.map) return;
  cancelJob(); hideCard(); S.morphClock?.cancel();
  S.selected = null; S.lastItem = null;
  const cube = S.cubePref;
  const camera = cube ? cubeCamera() : flatCamera();
  if (!opening || S.reduced) {
    S.reveal = 1;
    if (!S.revealed || S.reduced) { place(camera); S.z = cube ? 1 : 0; S.geomCache = null; S.T = 0; schedule(); }
    else morph(cube ? 1 : 0, camera);
    revealOnce();
    return;
  }
  const settle = () => { S.reveal = 1; S.T = 1; schedule(); };
  const job = startJob(settle, () => { place(camera); S.z = cube ? 1 : 0; settle(); });
  place({ ...camera, bearing: (camera.bearing || 0) + (cube ? 18 : 0) });
  S.z = cube ? 1 : 0; S.geomCache = null;
  S.T = 0; S.reveal = 0;
  revealOnce();
  (async () => {
    if (cube) S.map.easeTo({ ...camera, duration: 3200, easing: t => t });
    // The playhead sweeps the whole trip in three seconds, drawing as it goes.
    await playClock(job, 3000, t => { S.T = ease.inOut(t); S.reveal = S.T; draw(); });
    if (job.cancelled) return;
    S.job = null; settle(); S.ctx.onPlayState(false);
  })();
}

function travel(event, items, destination) {
  const settle = () => { S.reveal = 1; S.T = stayMid(event); schedule(); };
  const job = startJob(settle, () => { settle(); S.z = 0; S.geomCache = null; if (destination) S.map.jumpTo(destination); schedule(); });
  S.selected = event.id; S.reveal = 1; S.lastItem = null;
  const from = items[0].t0, to = items.at(-1).t1 + (stayStart(event) - items.at(-1).t1) + 0.002;
  (async () => {
    if (S.z < 0.5) {
      const frame = cameraFor(S.map, S.ctx, { bounds: S.trip.routeFrame(items.map(i => i.leg)) }, { extra: 50 });
      S.map.easeTo({ ...frame, pitch: 0, bearing: 0, duration: 850 });
      await moved(850);
    }
    if (job.cancelled) return;
    S.T = from;
    const km = items.reduce((sum, i) => sum + i.leg.lengthKm, 0);
    await playClock(job, Math.max(1500, Math.min(3200, 1200 + 420 * Math.log2(1 + km / 20))), t => { S.T = from + (to - from) * t; draw(); });
    if (job.cancelled) return;
    if (destination) await morph(0, destination, job);
    if (job.cancelled) return;
    S.job = null; settle(); S.ctx.onPlayState(false);
  })();
}
const stayStart = event => (S.timeline.byEvent.get(event.id) || []).find(i => i.type === 'stay')?.t0 ?? 0;
const stayMid = event => { const stay = (S.timeline.byEvent.get(event.id) || []).find(i => i.type === 'stay'); return stay ? stay.t0 + (stay.t1 - stay.t0) * 0.15 : 0; };

export function selectEvent(id, { animate = true } = {}) {
  if (!S?.map) return;
  const event = S.trip.eventById(id);
  if (!event) return;
  cancelJob(); hideCard(); S.morphClock?.cancel();
  const camera = landingCamera(event);
  const items = (S.timeline.byEvent.get(id) || []).filter(i => i.type === 'leg');
  if (!animate || S.reduced || !items.length) {
    S.selected = id; S.reveal = 1; S.T = stayMid(event); S.lastItem = itemAt(S.T);
    if (!S.revealed || S.reduced || !animate) { if (camera) S.map.jumpTo(camera); S.z = 0; S.geomCache = null; schedule(); }
    else morph(0, camera);
    revealOnce();
    return;
  }
  revealOnce();
  travel(event, items, camera);
}
export function playLeg(id) {
  if (!S?.map) return;
  if (S.trip.eventById(id)) { selectEvent(id, { animate: true }); return; }
  const item = S.timeline.items.find(i => i.type === 'leg' && i.leg.id === id);
  if (!item) return;
  cancelJob();
  travel(item.event, [item], landingCamera(item.event));
}
export function skip() { cancelJob('final'); }
export function setReducedMotion(value) { if (!S) return; S.reduced = Boolean(value); if (S.reduced && S.job) cancelJob('final'); }

export function legendSwatch(mode) {
  if (mode === 'tbd') return '<svg width="64" height="16" viewBox="0 0 64 16"><path d="M5 8h54" stroke="#0072b2" stroke-opacity=".6" stroke-width="4" stroke-linecap="round" stroke-dasharray="0.1 8"/></svg>';
  const m = MODES[mode], dash = DECK_DASH[mode];
  return `<svg width="64" height="16" viewBox="0 0 64 16"><path d="M5 8h54" stroke="${m.color}" stroke-width="4" ${dash[0] ? `stroke-dasharray="${dash.map(v => v * 4).join(' ')}"` : ''}/></svg>`;
}
export function legendExtras() {
  return [
    { swatch: '<svg width="44" height="30" viewBox="0 0 44 30"><path d="M22 28V4" stroke="#22313a" stroke-width="5" stroke-linecap="round"/></svg>', label: 'Stay column', note: 'height is time in the cube; dashed = TBD' },
    { swatch: '<svg width="44" height="24" viewBox="0 0 44 24"><circle cx="22" cy="12" r="4.5" fill="#c2255c" stroke="#fff"/></svg>', label: 'Photo', note: 'point at its capture time and place; click to scrub there' },
    { swatch: '<svg width="44" height="24" viewBox="0 0 44 24"><circle cx="22" cy="12" r="6" fill="#fff" stroke="#9a6b00" stroke-width="2.4"/></svg>', label: 'Curated place', note: 'ring at its stop’s time' },
    { swatch: '<svg width="44" height="24" viewBox="0 0 44 24"><rect x="4" y="8" width="36" height="8" rx="3" fill="#006f92" fill-opacity=".18" stroke="#006f92"/><circle cx="22" cy="12" r="5" fill="#d4512c" stroke="#fff" stroke-width="2"/></svg>', label: 'Now', note: 'playhead plane and position' }
  ];
}

export function destroy() {
  if (!S) return;
  cancelJob(); S.morphClock?.cancel(); cancelAnimationFrame(raf); raf = 0;
  window.removeEventListener('resize', S.onResize);
  S.offInput?.();
  try { if (S.overlay) S.map?.removeControl(S.overlay); } catch (error) { /* already gone */ }
  S.overlay?.finalize?.();
  S.map?.remove();
  S.container.classList.remove('o4');
  S = null;
}
void tracePlan; void boundsCenter;
