// Option 6 · City lens. Landing in a city never loses the journey: the main
// map stays on the incoming route and its region, and a round lens beside the
// city shows its streets, photos and places. The camera holds still while the
// viewer's own arrival trace draws the leg (O09), on a real, light map (O23).
import { escapeHtml, icon, placeIcon, bboxOf, boundsCenter } from '../data.js';
import { injectStyle, markerLayer, OFM } from './common.js';
import { BASE_CSS, createBaseMap, addRoutes, bindStopClicks, jobs, trace, paperStyle, reveal, cameraFor, onUserInput } from './base-map.js';

export const meta = {
  number: 6, name: 'City lens', modes: ['light'], keyBackground: '#f7f5ef',
  tagline: 'Arrive without losing the way you came. The map stays on the route and its region; a lens beside the city opens onto its streets, photos and places.',
  whatsNew: [
    'Focus + context: a second, round street-scale map anchored to the city with a leader line, while the main map keeps the incoming route in view.',
    'The leg is drawn by the viewer’s own arrival trace (same plan, interpolation and canvas as the live site), camera still.',
    'Photos sit in the lens as blurred circles with counts; curated places as small labelled pins. Drag the lens by its caption; pan inside it.'
  ],
  keeps: ['Real, light map (O23), current transport colours, dash patterns and casing; TBD dotted without casing.', 'Still camera and current arrival timing: 850 ms frame, 1.5 s trace, 0.25 s hold (O09).', 'Unselected opening with the 3-second whole-route trace (O06); direct links land without animation; input interrupts; reduced motion shows the end state.'],
  departures: [
    'Arrival no longer zooms the main map into the city; the city appears in the lens instead (O09’s settle into the city).',
    'A second map instance on screen while a stop is open.',
    'Whole-trip Replay re-runs the opening (O09).'
  ],
  phone: 'The lens docks bottom-right above the stop picker with a leader to the city; the route stays visible above it. Lens 190 px, targets 44 px.'
};

const CSS = `${BASE_CSS}
.o6-lens { position:absolute; z-index:4; width:var(--d); left:0; top:0; transform-origin: 50% 50%; transition: transform 260ms cubic-bezier(.2,.9,.3,1.15), opacity 200ms; }
.o6-lens[hidden] { display:none; }
.o6-lens.is-closed { transform: scale(.4); opacity:0; pointer-events:none; }
.o6-lens-map { position:relative; width:var(--d); height:var(--d); border-radius:50%; overflow:hidden; box-shadow: 0 0 0 4px #fffdf8, 0 0 0 5.5px #1f2b2f, 0 14px 34px rgba(20,30,35,.32); background:#f4f1ea; }
.o6-lens-map .maplibregl-ctrl-attrib { display:none; }
.o6-cap { margin:10px auto 0; width:max-content; max-width:calc(var(--d) + 80px); display:flex; align-items:center; gap:4px; padding:0 4px 0 14px; min-height:44px; border-radius:22px; background:#fffdf8; box-shadow: var(--chrome-shadow); cursor:grab; touch-action:none; user-select:none; }
.o6-cap b { font-size:15px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.o6-cap span { font-size:12px; color:#59686b; white-space:nowrap; }
.o6-cap button { width:44px; height:44px; border:0; background:none; border-radius:22px; cursor:pointer; color:#59686b; flex:none; }
.o6-leader { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; z-index:3; overflow:visible; }
.o6-chip { width:44px; height:44px; display:grid; place-items:center; }
.o6-chip span { min-width:26px; height:26px; padding:0 7px; border-radius:13px; background:#fffdf8; color:#1f2b2f; font:700 12px/26px var(--font-ui); display:inline-flex; align-items:center; gap:3px; box-shadow: 0 1px 4px rgba(20,30,35,.3); }
.o6-chip.is-dim { opacity:.45; }
.o6-ph { width:44px; height:44px; display:grid; place-items:center; }
.o6-ph i { position:relative; width:34px; height:34px; border-radius:50%; background:#ccd center/cover; box-shadow: 0 0 0 2.5px #fffdf8, 0 2px 6px rgba(20,30,35,.35); }
.o6-ph b { position:absolute; right:-6px; top:-6px; min-width:18px; height:18px; padding:0 4px; border-radius:9px; background:#d4512c; color:#fff; font:700 12px/18px var(--font-ui); }
.o6-pin { display:flex; align-items:center; gap:3px; min-height:44px; padding:0 2px; color:#1f2b2f; }
.o6-pin span { display:inline-flex; align-items:center; gap:3px; height:24px; padding:0 7px 0 5px; border-radius:12px; background:#fffdf8; box-shadow:0 1px 4px rgba(20,30,35,.3); font:600 12px/1 var(--font-ui); max-width:110px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
:root[data-reduced] .o6-lens { transition:none; }
@media (max-width:760px) { .o6-cap { position:absolute; right:0; margin:10px 0 0; max-width:calc(100vw - 28px); } .o6-cap span { overflow:hidden; text-overflow:ellipsis; } }
`;

let S = null;

export async function mount(container, trip, ctx) {
  injectStyle('lab-o6', CSS);
  container.classList.add('o6');
  S = { trip, ctx, container, reduced: false, selected: null, job: null, revealed: false, drag: null };
  const mine = S;
  const map = await createBaseMap(container, trip);
  if (S !== mine) { map.remove(); return; }
  S.map = map;
  S.jobs = jobs(S);
  S.routes = addRoutes(map, trip);
  S.offStops = bindStopClicks(map, trip, id => ctx.onEventPicked(id));
  S.chips = markerLayer(map, { radius: 58, className: 'o6-chip', render: renderChip, onClick: group => { const e = group.items[0].eventId; if (e) ctx.onEventPicked(e); } });
  S.chips.set(trip.located);
  S.offInput = onUserInput(map, interrupt);
  buildLens();
  map.on('move', placeLens);
  map.on('resize', placeLens);
}

// ---------------------------------------------------------------- lens
function buildLens() {
  S.leader = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  S.leader.setAttribute('class', 'o6-leader');
  S.leader.innerHTML = '<line stroke="#1f2b2f" stroke-width="1.6" stroke-dasharray="4 3"/><circle r="14" fill="none" stroke="#d4512c" stroke-width="3"/>';
  S.leader.style.display = 'none';
  S.container.append(S.leader);
  S.lens = document.createElement('div');
  S.lens.className = 'o6-lens is-closed';
  S.lens.hidden = true;
  S.lens.innerHTML = '<div class="o6-lens-map" role="region" aria-label="City lens"></div><div class="o6-cap"><b></b><span></span><button type="button" aria-label="Close the city lens"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>';
  S.container.append(S.lens);
  S.lens.querySelector('button').addEventListener('click', () => closeLens());
  const cap = S.lens.querySelector('.o6-cap');
  cap.addEventListener('pointerdown', event => {
    if (event.target.closest('button')) return;
    cap.setPointerCapture(event.pointerId);
    S.drag = { x: event.clientX, y: event.clientY, ox: S.offset?.x || 0, oy: S.offset?.y || 0 };
  });
  cap.addEventListener('pointermove', event => {
    if (!S.drag) return;
    S.offset = { x: S.drag.ox + event.clientX - S.drag.x, y: S.drag.oy + event.clientY - S.drag.y };
    placeLens();
  });
  const end = () => { S.drag = null; };
  cap.addEventListener('pointerup', end);
  cap.addEventListener('pointercancel', end);
  S.lensMap = new maplibregl.Map({ container: S.lens.querySelector('.o6-lens-map'), style: OFM('positron'), center: boundsCenter(S.trip.bounds), zoom: 11, attributionControl: false,
    dragRotate: false, pitchWithRotate: false, touchPitch: false, fadeDuration: 0, renderWorldCopies: false });
  S.lensMap.touchZoomRotate.disableRotation();
  S.lensReady = new Promise(resolve => {
    S.lensMap.once('style.load', () => paperStyle(S.lensMap));
    S.lensMap.once('load', () => {
      addRoutes(S.lensMap, S.trip);
      S.lensPhotos = markerLayer(S.lensMap, { radius: 42, className: 'o6-ph', render: renderLensPhoto, onClick: group => S.lensMap.easeTo({ center: [group.lng, group.lat], zoom: Math.min(17, S.lensMap.getZoom() + 1.6), duration: 500 }) });
      S.lensPlaces = markerLayer(S.lensMap, { radius: 46, className: 'o6-pin', render: renderLensPin, anchor: 'left', onClick: group => {
        new maplibregl.Popup({ className: 'lab-base-popup', offset: 10 }).setLngLat([group.lng, group.lat]).setHTML(`<b>${escapeHtml(group.items[0].name)}</b>${group.items.length > 1 ? `<small>+${group.items.length - 1} more nearby</small>` : `<small>${escapeHtml(group.items[0].category)}</small>`}`).addTo(S.lensMap);
      } });
      S.lensPhotos.set(S.trip.located);
      S.lensPlaces.set(S.trip.locatedPois);
      resolve();
    });
  });
}
const lensSize = () => (S.ctx.isPhone() ? 190 : 260);
function placeLens() {
  if (!S?.lens || S.lens.hidden || !S.anchor) { if (S?.leader) S.leader.style.display = 'none'; return; }
  const D = lensSize(), W = S.container.clientWidth, H = S.container.clientHeight, inset = S.ctx.insets();
  const a = S.map.project(S.anchor);
  let x, y;
  if (S.ctx.isPhone()) { x = W - D - 14; y = H - inset.bottom - D - 60; }
  else {
    const gap = 70, options = [[a.x + gap, a.y - D / 2], [a.x - gap - D, a.y - D / 2], [a.x - D / 2, a.y - gap - D - 54], [a.x - D / 2, a.y + gap]];
    const fits = ([px, py]) => px >= inset.left && px + D <= W - inset.right && py >= inset.top && py + D + 54 <= H - inset.bottom;
    [x, y] = options.find(fits) || [W - inset.right - D, inset.top];
  }
  x += S.offset?.x || 0; y += S.offset?.y || 0;
  S.lens.style.setProperty('--d', `${D}px`);
  S.lens.style.left = `${x}px`; S.lens.style.top = `${y}px`;
  // Leader from the city to the lens rim.
  const cx = x + D / 2, cy = y + D / 2, dx = a.x - cx, dy = a.y - cy, len = Math.hypot(dx, dy) || 1;
  const rx = cx + (dx / len) * (D / 2 + 5), ry = cy + (dy / len) * (D / 2 + 5);
  const line = S.leader.querySelector('line'), ring = S.leader.querySelector('circle');
  line.setAttribute('x1', a.x); line.setAttribute('y1', a.y); line.setAttribute('x2', rx); line.setAttribute('y2', ry);
  ring.setAttribute('cx', a.x); ring.setAttribute('cy', a.y);
  S.leader.style.display = len > D / 2 + 20 ? '' : 'none';
}
async function openLens(event, animate) {
  await S.lensReady;
  if (!S || S.selected !== event.id) return;
  S.anchor = event.place ? [event.place.lng, event.place.lat] : null;
  if (!S.anchor) return;
  S.lens.hidden = false;
  placeLens();
  S.lensMap.resize();
  const frame = S.trip.eventFrame(event);
  const D = lensSize();
  let camera;
  if (frame?.bounds) camera = S.lensMap.cameraForBounds(frame.bounds, { padding: Math.round(D * 0.14), maxZoom: 14.5 });
  S.lensMap.jumpTo(camera ? { center: camera.center, zoom: camera.zoom } : { center: S.anchor, zoom: 13.5 });
  S.lensPhotos?.rebuildNow(); S.lensPlaces?.rebuildNow();
  const located = event.located.length, places = event.pois.filter(p => p.located).length;
  S.lens.querySelector('.o6-cap b').textContent = event.place?.name || event.title;
  S.lens.querySelector('.o6-cap span').textContent = [located ? `${located} photo${located > 1 ? 's' : ''}` : 'No located photos', places ? `${places} place${places > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ');
  if (animate && !S.reduced) requestAnimationFrame(() => S.lens.classList.remove('is-closed'));
  else S.lens.classList.remove('is-closed');
}
function closeLens() {
  if (!S?.lens) return;
  S.lens.classList.add('is-closed');
  S.lens.hidden = true;
  S.leader.style.display = 'none';
  S.anchor = null;
}

// ---------------------------------------------------------------- markers
function renderChip(el, group, first) {
  if (first) {
    el.innerHTML = `<span>${icon('photo', { size: 13, stroke: 2.4 })}${group.items.length}</span>`;
    el.setAttribute('aria-label', `${group.items.length} photo${group.items.length > 1 ? 's' : ''} here`);
  }
  // The open city's photos live in the lens; elsewhere they stay as quiet counts.
  const mine = S.selected && group.items.some(p => p.eventId === S.selected);
  el.style.display = mine && !S.lens?.hidden ? 'none' : '';
  el.classList.toggle('is-dim', Boolean(S.selected && !mine));
}
function renderLensPhoto(el, group, first) {
  if (!first) return;
  const url = group.items.find(p => p.preview)?.preview;
  el.innerHTML = `<i>${group.items.length > 1 ? `<b>${group.items.length}</b>` : ''}</i>`;
  if (url) el.querySelector('i').style.backgroundImage = `url("${url}")`;
  el.setAttribute('aria-label', group.items.length > 1 ? `${group.items.length} photos` : `Photo${group.items[0].takenLabel ? ` · ${group.items[0].takenLabel}` : ''}`);
}
function renderLensPin(el, group, first) {
  if (!first) return;
  el.innerHTML = `<span>${icon(placeIcon(group.items[0].category), { size: 13, stroke: 2.4 })}${escapeHtml(group.items.length > 1 ? `${group.items.length} places` : group.items[0].name)}</span>`;
  el.setAttribute('aria-label', group.items.length > 1 ? `${group.items.length} places` : `Place: ${group.items[0].name}`);
}

// ---------------------------------------------------------------- jobs
function interrupt() { if (S?.job) S.jobs.cancel('settle'); }
function revealOnce() { if (!S.revealed) { S.revealed = true; reveal(S.map); } }
function overviewCamera() { return cameraFor(S.map, S.ctx, { bounds: S.trip.bounds, maxZoom: 10 }, { extra: 30 }); }
// Context frame: the incoming route and the city, leaving room for the lens.
function contextCamera(event) {
  const coords = event.legs.flatMap(leg => leg.lite.coords);
  if (event.place) coords.push([event.place.lng, event.place.lat]);
  let bounds = bboxOf(coords);
  if (!bounds) return null;
  const span = Math.max(bounds[1][0] - bounds[0][0], bounds[1][1] - bounds[0][1]);
  if (span < 0.6) { const c = boundsCenter(bounds); bounds = [[c[0] - 0.6, c[1] - 0.4], [c[0] + 0.6, c[1] + 0.4]]; }
  const inset = S.ctx.insets(), D = lensSize(), phone = S.ctx.isPhone();
  const pad = { top: inset.top + 30, bottom: inset.bottom + 30 + (phone ? D + 50 : 0), left: inset.left + 30, right: inset.right + 30 + (phone ? 0 : D + 70) };
  try { const c = S.map.cameraForBounds(bounds, { padding: pad, maxZoom: 11 }); return c && { center: c.center, zoom: c.zoom, bearing: 0, pitch: 0 }; } catch (error) { return null; }
}
function land(event, animate) {
  S.routes.select(event.id, true);
  S.chips.refresh();
  openLens(event, animate).then(() => S?.chips.refresh());
}

export function showOverview({ opening = false } = {}) {
  if (!S?.map) return;
  S.jobs.cancel(); closeLens();
  S.selected = null; S.offset = null;
  S.routes.select(null, false); S.chips.refresh();
  const camera = overviewCamera();
  if (!opening || S.reduced) {
    if (!S.revealed || S.reduced) S.map.jumpTo(camera); else S.map.easeTo({ ...camera, duration: 850 });
    revealOnce();
    return;
  }
  const job = S.jobs.start(() => {}, () => S.map.jumpTo(camera));
  S.map.jumpTo(camera);
  revealOnce();
  (async () => {
    await trace(S, S.routes, job, S.trip.orderedLegs, 3000);
    if (!job.cancelled) S.jobs.finish(job);
  })();
}
export function selectEvent(id, { animate = true } = {}) {
  if (!S?.map) return;
  const event = S.trip.eventById(id);
  if (!event) return;
  S.jobs.cancel(); closeLens();
  S.selected = id; S.offset = null;
  S.routes.select(id, false); S.chips.refresh();
  const camera = contextCamera(event);
  if (!animate || S.reduced || !event.legs.length) {
    if (camera) { if (!S.revealed || S.reduced || !animate) S.map.jumpTo(camera); else S.map.easeTo({ ...camera, duration: 850 }); }
    revealOnce();
    land(event, animate && !S.reduced);
    return;
  }
  revealOnce();
  const job = S.jobs.start(() => land(event, false), () => { if (camera) S.map.jumpTo(camera); land(event, false); });
  (async () => {
    await S.jobs.ease(job, camera, 850);
    await trace(S, S.routes, job, event.legs, 1500);
    await S.jobs.sleep(job, 250);
    if (job.cancelled) return;
    S.jobs.finish(job); land(event, true);
  })();
}
export function playLeg(id) {
  if (!S?.map) return;
  if (S.trip.eventById(id)) { selectEvent(id, { animate: true }); return; }
  const leg = S.trip.legById.get(id);
  if (leg?.eventId) selectEvent(leg.eventId, { animate: true });
}
export function skip() { S?.jobs.cancel('final'); }
export function setReducedMotion(value) { if (!S) return; S.reduced = Boolean(value); if (S.reduced && S.job) S.jobs.cancel('final'); }
export function legendExtras() {
  return [
    { swatch: '<svg width="44" height="30" viewBox="0 0 44 30"><circle cx="28" cy="15" r="12" fill="#f4f1ea" stroke="#1f2b2f" stroke-width="2"/><line x1="4" y1="22" x2="16" y2="18" stroke="#1f2b2f" stroke-dasharray="3 2"/><circle cx="4" cy="22" r="3" fill="none" stroke="#d4512c" stroke-width="2"/></svg>', label: 'City lens', note: 'street-scale view of the stop, linked to the city' },
    { swatch: '<svg width="44" height="24" viewBox="0 0 44 24"><circle cx="22" cy="12" r="9" fill="#9aa" stroke="#fff" stroke-width="2.5"/></svg>', label: 'Photos (in the lens)', note: 'blurred circles; a number means a group' },
    { swatch: '<svg width="44" height="24" viewBox="0 0 44 24"><rect x="6" y="4" width="32" height="16" rx="8" fill="#fffdf8" stroke="#ccc"/><text x="22" y="16" font-size="11" font-weight="700" text-anchor="middle" fill="#1f2b2f">12</text></svg>', label: 'Photo count', note: 'photos at other stops, at their true groups' }
  ];
}
export function destroy() {
  if (!S) return;
  S.jobs?.cancel();
  S.offInput?.(); S.offStops?.();
  S.chips?.destroy(); S.lensPhotos?.destroy(); S.lensPlaces?.destroy();
  S.lensMap?.remove(); S.map?.remove();
  S.lens?.remove(); S.leader?.remove();
  S.container.classList.remove('o6');
  S = null;
}
