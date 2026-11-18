// Option 7 · Photo roll. The trip's photos, in album order, are the control:
// scroll the roll and the map follows each photo to where it was taken, with
// the route reached so far drawn in full. The camera stays put while the next
// pin is already in view (O05) and only travels when it has to. Real, light
// map (O23); legs are drawn by the viewer's own arrival trace.
import { escapeHtml, icon } from '../data.js';
import { injectStyle } from './common.js';
import { BASE_CSS, createBaseMap, addRoutes, bindStopClicks, jobs, trace, reveal, cameraFor, onUserInput } from './base-map.js';

export const meta = {
  number: 7, name: 'Photo roll', modes: ['light'], keyBackground: '#f7f5ef',
  tagline: 'The photographs lead. Scroll the trip’s photo roll and the map follows each picture to where it was taken, drawing the route as far as you have scrolled.',
  whatsNew: [
    'A whole-trip filmstrip in album order with stop dividers, bound to the map: the centred photo’s pin, the current stop and the route reached so far.',
    'Camera rule from O05: no move while the next pin is in view, a short pan nearby, a framed move to the next stop when the roll crosses into it.',
    'Tapping a photo dot on the map scrolls the roll to it; photos without a location stay in the roll with a “no location” mark and never get a pin.'
  ],
  keeps: ['Real, light map (O23), current transport styles and the viewer’s arrival trace with a still camera (O09).', 'Album order from photoOrder; capture time is the only text shown for a photo (O01).', 'Unselected opening and 3-second trace; direct links land without animation; input interrupts; reduced motion shows the end state.'],
  departures: [
    'A persistent photo strip above the stop picker (O03/O08 keep photos in the sidebar and phone card).',
    'Scrolling across a stop boundary changes the selected stop without an arrival animation.',
    'Whole-trip Replay re-runs the opening (O09).'
  ],
  phone: 'Thumb-native: one horizontal swipe moves through the whole trip while the map follows above it. The strip takes about 120 px over the stop picker.'
};

const CSS = `${BASE_CSS}
.o7-roll { background:#fffdf8; border-radius:18px; box-shadow: var(--chrome-shadow); padding:8px 0 8px; color:#1f2b2f; }
.o7-read { display:flex; align-items:baseline; gap:8px; padding:0 14px; min-height:22px; white-space:nowrap; overflow:hidden; }
.o7-read b { font-size:15px; overflow:hidden; text-overflow:ellipsis; letter-spacing:-.01em; }
.o7-read span { font-size:12px; color:#59686b; overflow:hidden; text-overflow:ellipsis; }
.o7-strip { display:flex; gap:6px; overflow-x:auto; padding:8px 50%; scroll-snap-type:x mandatory; scrollbar-width:none; outline:none; overscroll-behavior-x: contain; }
.o7-strip::-webkit-scrollbar { display:none; }
.o7-strip:focus-visible { box-shadow: inset 0 0 0 2px #006f92; border-radius:12px; }
.o7-tile { flex:none; position:relative; width:72px; height:72px; border:0; padding:0; border-radius:10px; background:#dfe3e4 center/cover no-repeat; cursor:pointer; scroll-snap-align:center; transition: transform 160ms ease, box-shadow 160ms; }
.o7-tile.is-current { transform: scale(1.08); box-shadow: 0 0 0 3px #d4512c, 0 4px 12px rgba(20,30,35,.3); z-index:1; }
.o7-tile .o7-nl { position:absolute; left:4px; bottom:4px; padding:0 5px; border-radius:6px; background:#1f2b2fd9; color:#fff; font:600 12px/18px var(--font-ui); }
.o7-div { flex:none; align-self:stretch; display:flex; flex-direction:column; justify-content:center; padding:0 8px 0 10px; border-left:2px solid #1f2b2f; font:600 12px/1.25 var(--font-ui); color:#1f2b2f; white-space:nowrap; scroll-snap-align:start; }
.o7-div small { color:#59686b; font-weight:500; font-size:12px; }
.o7-div.is-tbd { border-left-style:dashed; color:#59686b; }
.o7-empty { flex:none; width:110px; height:72px; border-radius:10px; border:1.5px dashed #c8c2b5; display:grid; place-items:center; font:12px var(--font-ui); color:#59686b; }
.o7-pin { width:52px; height:52px; display:grid; place-items:center; pointer-events:none; }
.o7-pin i { width:46px; height:46px; border-radius:50%; background:#ccd center/cover; box-shadow: 0 0 0 3px #d4512c, 0 0 0 5px #fffdf8, 0 6px 16px rgba(20,30,35,.35); }
@media (max-width:760px) { .o7-tile { width:60px; height:60px; } .o7-empty { height:60px; } }
:root[data-reduced] .o7-tile { transition:none; }
`;

let S = null;

export async function mount(container, trip, ctx) {
  injectStyle('lab-o7', CSS);
  container.classList.add('o7');
  S = { trip, ctx, container, reduced: false, selected: null, job: null, revealed: false, current: null, programmatic: 0 };
  buildRoll();
  const mine = S;
  const map = await createBaseMap(container, trip);
  if (S !== mine) { map.remove(); return; }
  S.map = map;
  S.jobs = jobs(S);
  S.routes = addRoutes(map, trip);
  S.offStops = bindStopClicks(map, trip, id => ctx.onEventPicked(id));
  const before = map.getStyle().layers.find(layer => layer.id === 'lab-stop')?.id;
  map.addSource('o7-photos', { type: 'geojson', data: { type: 'FeatureCollection', features: trip.located.map(p => ({ type: 'Feature', properties: { id: p.id, eventId: p.eventId }, geometry: { type: 'Point', coordinates: [p.lng, p.lat] } })) } });
  map.addLayer({ id: 'o7-photo-dots', type: 'circle', source: 'o7-photos', paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 2.6, 12, 5], 'circle-color': '#e8912d', 'circle-stroke-color': '#fffdf8', 'circle-stroke-width': 1.4, 'circle-opacity': 0.9 } }, before);
  map.addLayer({ id: 'o7-photo-hit', type: 'circle', source: 'o7-photos', paint: { 'circle-radius': 14, 'circle-color': '#000', 'circle-opacity': 0.01 } });
  map.on('click', 'o7-photo-hit', event => { const id = event.features?.[0]?.properties.id; if (id) scrollToPhoto(id, true); });
  map.on('mouseenter', 'o7-photo-hit', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'o7-photo-hit', () => { map.getCanvas().style.cursor = ''; });
  S.pinEl = document.createElement('div');
  S.pinEl.className = 'o7-pin';
  S.pinEl.innerHTML = '<i></i>';
  S.pin = new maplibregl.Marker({ element: S.pinEl });
  S.offInput = onUserInput(map, interrupt);
}

// ---------------------------------------------------------------- roll
function buildRoll() {
  const wrap = document.createElement('div');
  wrap.className = 'o7-roll';
  wrap.style.visibility = 'hidden';
  const parts = [];
  for (const event of S.trip.events) {
    parts.push(`<div class="o7-div${event.tbd ? ' is-tbd' : ''}" data-event="${escapeHtml(event.id)}">${escapeHtml(`${S.trip.eventWord} ${event.number}`)}<small>${escapeHtml(event.title)}</small></div>`);
    if (!event.photos.length) parts.push(`<div class="o7-empty" data-empty="${escapeHtml(event.id)}">No photos</div>`);
    for (const photo of event.photos) parts.push(`<button type="button" class="o7-tile" data-id="${escapeHtml(photo.id)}" aria-label="${escapeHtml(`${event.title}${photo.takenLabel ? ` · ${photo.takenLabel}` : ''}${photo.located ? '' : ' · no location'}`)}" style="background-image:url('${photo.preview || ''}')">${photo.located ? '' : '<span class="o7-nl">No location</span>'}</button>`);
  }
  wrap.innerHTML = `<div class="o7-read"><b></b><span></span></div><div class="o7-strip" tabindex="0" role="listbox" aria-label="Trip photos in album order">${parts.join('')}</div>`;
  S.ctx.slots.panel.append(wrap);
  S.roll = wrap;
  S.strip = wrap.querySelector('.o7-strip');
  S.title = wrap.querySelector('.o7-read b');
  S.meta = wrap.querySelector('.o7-read span');
  S.photoById = new Map(S.trip.photos.map(p => [p.id, p]));
  S.tiles = [...S.strip.querySelectorAll('.o7-tile')];
  S.strip.addEventListener('scroll', () => { if (!S.raf) S.raf = requestAnimationFrame(onScroll); }, { passive: true });
  for (const type of ['pointerdown', 'wheel', 'touchstart']) S.strip.addEventListener(type, () => { S.programmatic = 0; interrupt(); }, { passive: true });
  S.strip.addEventListener('click', event => { const tile = event.target.closest('.o7-tile'); if (tile) scrollToPhoto(tile.dataset.id, true); });
  S.strip.addEventListener('keydown', event => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault(); event.stopPropagation();
    const index = S.current ? S.tiles.findIndex(t => t.dataset.id === S.current.id) : -1;
    const next = S.tiles[Math.max(0, Math.min(S.tiles.length - 1, index + (event.key === 'ArrowRight' ? 1 : -1)))];
    if (next) scrollToPhoto(next.dataset.id, true);
  });
}
function centredTile() {
  const box = S.strip.getBoundingClientRect(), mid = box.left + box.width / 2;
  let best = null, dist = Infinity;
  for (const tile of S.tiles) {
    const r = tile.getBoundingClientRect(), d = Math.abs(r.left + r.width / 2 - mid);
    if (d < dist) { dist = d; best = tile; }
    else if (r.left > mid + 200) break;
  }
  return best;
}
function onScroll() {
  S.raf = 0;
  if (!S?.map || S.programmatic) return;
  const tile = centredTile();
  if (tile && tile.dataset.id !== S.current?.id) setCurrent(S.photoById.get(tile.dataset.id), { camera: true });
}
function scrollToPhoto(id, smooth) {
  const tile = S.tiles.find(t => t.dataset.id === id);
  if (!tile) return;
  const left = tile.offsetLeft - S.strip.clientWidth / 2 + tile.offsetWidth / 2;
  S.strip.scrollTo({ left, behavior: smooth && !S.reduced ? 'smooth' : 'auto' });
  if (!smooth || S.reduced) setCurrent(S.photoById.get(id), { camera: true });
}
function scrollToEvent(event, smooth) {
  const marker = S.strip.querySelector(`[data-event="${window.CSS.escape(event.id)}"]`);
  if (!marker) return;
  // Programmatic scrolls do not walk the map through every photo on the way.
  S.programmatic += 1;
  const first = event.photos[0] && S.tiles.find(t => t.dataset.id === event.photos[0].id);
  const target = first || marker;
  S.strip.scrollTo({ left: target.offsetLeft - S.strip.clientWidth / 2 + target.offsetWidth / 2, behavior: smooth && !S.reduced ? 'smooth' : 'auto' });
  setTimeout(() => { if (S) S.programmatic = Math.max(0, S.programmatic - 1); }, smooth && !S.reduced ? 700 : 30);
}

// ---------------------------------------------------------------- current photo
function reachedIds(event) {
  const index = S.trip.eventIndex.get(event.id);
  return S.trip.events.slice(0, index + 1).map(e => e.id);
}
function setCurrent(photo, { camera = false } = {}) {
  if (!photo) return;
  const previous = S.current;
  S.current = photo;
  S.tiles.forEach(t => t.classList.toggle('is-current', t.dataset.id === photo.id));
  const event = S.trip.eventById(photo.eventId);
  const index = event.photos.indexOf(photo) + 1;
  S.title.textContent = event.title;
  S.meta.textContent = [`${S.trip.eventWord} ${event.number}`, `photo ${index} of ${event.photos.length}`, photo.takenLabel, photo.located ? '' : 'no location saved'].filter(Boolean).join(' · ');
  if (photo.located) {
    S.pinEl.querySelector('i').style.backgroundImage = photo.preview ? `url("${photo.preview}")` : '';
    S.pin.setLngLat([photo.lng, photo.lat]).addTo(S.map);
    S.pinEl.removeAttribute('tabindex');
  } else S.pin.remove();
  if (S.selected !== event.id) {
    S.selected = event.id;
    S.ctx.onEventShown(event.id);
  }
  S.routes.progress(reachedIds(event));
  S.map.setPaintProperty('o7-photo-dots', 'circle-opacity', ['case', ['==', ['get', 'eventId'], event.id], 1, 0.35]);
  if (!camera) return;
  const sameStop = previous && previous.eventId === photo.eventId;
  if (photo.located) {
    const p = S.map.project([photo.lng, photo.lat]), inset = S.ctx.insets(), W = S.container.clientWidth, H = S.container.clientHeight;
    const inView = p.x > inset.left + 40 && p.x < W - inset.right - 40 && p.y > inset.top + 40 && p.y < H - inset.bottom - 40;
    if (sameStop && inView) return;                       // O05: keep the camera while the pin is in view
    if (sameStop) { S.map.easeTo({ center: [photo.lng, photo.lat], duration: S.reduced ? 0 : 450 }); return; }
  } else if (sameStop) return;
  const frame = cameraFor(S.map, S.ctx, S.trip.eventFrame(event), { extra: 40 });
  if (frame) S.map.easeTo({ ...frame, duration: S.reduced ? 0 : 900 });
}

// ---------------------------------------------------------------- jobs
function interrupt() { if (S?.job) S.jobs.cancel('settle'); }
function revealOnce() { if (!S.revealed) { S.revealed = true; reveal(S.map); S.roll.style.visibility = ''; } }
const overviewCamera = () => cameraFor(S.map, S.ctx, { bounds: S.trip.bounds, maxZoom: 10 }, { extra: 30 });
function overviewReadout() {
  S.title.textContent = 'Whole trip';
  S.meta.textContent = S.trip.photos.length ? `${S.trip.photos.length} photos · scroll the roll to travel through them` : 'No photos on this trip yet';
}
function land(event) {
  scrollToEvent(event, false);
  const first = event.photos[0];
  if (first) setCurrent(first, { camera: false });
  else {
    S.current = null; S.pin.remove();
    S.tiles.forEach(t => t.classList.remove('is-current'));
    S.selected = event.id;
    S.routes.progress(reachedIds(event));
    S.title.textContent = event.title;
    S.meta.textContent = `${S.trip.eventWord} ${event.number} · no photos at this stop`;
  }
}

export function showOverview({ opening = false } = {}) {
  if (!S?.map) return;
  S.jobs.cancel();
  S.selected = null; S.current = null; S.pin.remove();
  S.tiles.forEach(t => t.classList.remove('is-current'));
  S.routes.progress(null);
  S.map.setPaintProperty('o7-photo-dots', 'circle-opacity', 0.9);
  S.programmatic += 1; S.strip.scrollTo({ left: 0 }); setTimeout(() => { if (S) S.programmatic = Math.max(0, S.programmatic - 1); }, 50);
  overviewReadout();
  const camera = overviewCamera();
  if (!opening || S.reduced) {
    if (!S.revealed || S.reduced) S.map.jumpTo(camera); else S.map.easeTo({ ...camera, duration: 850 });
    revealOnce();
    return;
  }
  const job = S.jobs.start(() => {}, () => S.map.jumpTo(camera));
  S.map.jumpTo(camera);
  revealOnce();
  (async () => { await trace(S, S.routes, job, S.trip.orderedLegs, 3000); if (!job.cancelled) S.jobs.finish(job); })();
}
export function selectEvent(id, { animate = true } = {}) {
  if (!S?.map) return;
  const event = S.trip.eventById(id);
  if (!event) return;
  S.jobs.cancel();
  S.selected = id;
  const destination = cameraFor(S.map, S.ctx, S.trip.eventFrame(event), { extra: 40 });
  if (!animate || S.reduced || !event.legs.length) {
    if (destination) { if (!S.revealed || S.reduced || !animate) S.map.jumpTo(destination); else S.map.easeTo({ ...destination, duration: 900 }); }
    revealOnce();
    land(event);
    return;
  }
  revealOnce();
  S.routes.progress(reachedIds(event));
  const job = S.jobs.start(() => land(event), () => { if (destination) S.map.jumpTo(destination); land(event); });
  (async () => {
    await S.jobs.ease(job, cameraFor(S.map, S.ctx, { bounds: S.trip.routeFrame(event.legs), maxZoom: 12.5 }, { extra: 50 }), 850);
    await trace(S, S.routes, job, event.legs, 1500);
    await S.jobs.sleep(job, 250);
    await S.jobs.ease(job, destination, 900);
    if (job.cancelled) return;
    S.jobs.finish(job); land(event);
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
    { swatch: '<svg width="44" height="24" viewBox="0 0 44 24"><rect x="8" y="2" width="20" height="20" rx="4" fill="#bbb"/><rect x="18" y="2" width="20" height="20" rx="4" fill="#999" stroke="#d4512c" stroke-width="2.5"/></svg>', label: 'Photo roll', note: 'the centred photo drives the map; dividers mark stops' },
    { swatch: '<svg width="44" height="24" viewBox="0 0 44 24"><circle cx="22" cy="12" r="9" fill="#bbb" stroke="#d4512c" stroke-width="3"/></svg>', label: 'Current photo', note: 'at its true capture point' },
    { swatch: '<svg width="44" height="24" viewBox="0 0 44 24"><circle cx="14" cy="12" r="3.5" fill="#e8912d" stroke="#fff"/><circle cx="26" cy="9" r="3.5" fill="#e8912d" stroke="#fff"/><circle cx="31" cy="15" r="3.5" fill="#e8912d" stroke="#fff"/></svg>', label: 'Other photos', note: 'tap one to scroll the roll to it' }
  ];
}
export function destroy() {
  if (!S) return;
  S.jobs?.cancel(); cancelAnimationFrame(S.raf);
  S.offInput?.(); S.offStops?.();
  S.pin?.remove(); S.map?.remove();
  S.container.classList.remove('o7');
  S = null;
}
void icon;
