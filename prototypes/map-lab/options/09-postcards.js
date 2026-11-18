// Option 9 · Postcards. Every stop is a postcard pinned at its city: the
// stop's first photo on the front with its name and dates. Choosing a stop
// draws the leg with the viewer's own arrival trace (camera still), settles
// on the city and turns its card over: the back holds the traveler's own
// words for the stop (blank stays blank), how they got there and a stamp.
// Real, light map (O23).
import { escapeHtml, icon, modeOf, fmtKm, placeIcon } from '../data.js';
import { injectStyle, markerLayer, zoomToGroup } from './common.js';
import { BASE_CSS, createBaseMap, addRoutes, bindStopClicks, jobs, trace, reveal, cameraFor, onUserInput } from './base-map.js';

export const meta = {
  number: 9, name: 'Postcards', modes: ['light'], keyBackground: '#f7f5ef',
  tagline: 'Every stop is a postcard pinned at its city: its first photo on the front, and on the back the traveler’s own words, how they got there and a stamp. Choose a stop and its card turns over.',
  whatsNew: [
    'Postcards at every stop on the real map, stacked where stops crowd at trip scale; the front is the stop’s first photo (album order) with its name and dates.',
    'Arrival turns the card over (3D flip) to a postcard back: the traveler’s own words if written, the legs with mode icons and distances, photo and place counts, a stamp with the stop number.',
    'Stops without photos get a lettered card; TBD stops are blank cards with a dashed edge, pencilled “TBD”.'
  ],
  keeps: ['Real, light map (O23), current transport styles, viewer’s arrival trace with a still camera and current timing (O09).', 'First album photo is the stop’s preview (O10); only traveler-written words appear, never generated copy (O01/O10).', 'Unselected opening and 3-second trace; direct links land without animation; input interrupts; reduced motion shows the end state.'],
  departures: [
    'Postcards replace upright signposts (O07) and are larger, so the trip-scale map shows stacks rather than every stop.',
    'The card back puts the stop’s story on the map, where the viewer keeps it in the journal sidebar (O03).',
    'Whole-trip Replay re-runs the opening (O09).'
  ],
  phone: 'Cards shrink at trip scale and the open card turns over above the stop picker as a bottom card; tapping it turns it back.'
};

const INK = '#1f2b2f';
const CSS = `${BASE_CSS}
.o9-card { width:var(--w,84px); }
.o9-card .o9-in { position:relative; transform-origin: 50% 100%; transition: transform 180ms ease; }
.o9-card .o9-front { display:block; background:#fffdf8; padding:4px 4px 0; box-shadow: 0 2px 6px rgba(30,30,25,.32); transform: rotate(var(--r,0deg)); }
.o9-card .o9-photo { display:block; width:100%; aspect-ratio: 4 / 3; background:#d9dcd8 center/cover no-repeat; }
.o9-card .o9-letter { display:grid; place-items:center; width:100%; aspect-ratio: 4 / 3; background: linear-gradient(135deg, #e9ecef, #dfe7ea); color:${INK}; font:700 15px/1.05 Fraunces, Georgia, serif; text-align:center; padding:4px; }
.o9-card .o9-cap { display:block; padding:3px 1px 4px; font:600 12px/1.2 var(--font-ui); color:${INK}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; text-align:left; }
.o9-card .o9-cap small { display:block; font-weight:500; color:#59686b; font-size:12px; }
.o9-card .o9-tack { position:absolute; left:50%; bottom:-9px; width:10px; height:10px; margin-left:-5px; border-radius:50%; background:#d4512c; box-shadow:0 0 0 2px #fffdf8, 0 1px 3px rgba(0,0,0,.4); }
.o9-card.is-stack .o9-front { box-shadow: 4px -3px 0 -1px #fffdf8, 4px -3px 0 0 #d8d2c5, 8px -6px 0 -1px #fffdf8, 8px -6px 0 0 #d8d2c5, 0 2px 6px rgba(30,30,25,.32); }
.o9-card .o9-count { position:absolute; right:-8px; top:-10px; min-width:22px; height:22px; padding:0 6px; border-radius:11px; background:${INK}; color:#fff; font:700 12px/22px var(--font-ui); }
.o9-card.is-tbd .o9-front { background:#fbfaf6; border:1.5px dashed #9aa3a3; box-shadow:none; }
.o9-card.is-tbd .o9-letter { background:transparent; color:#59686b; font:700 17px/1 Caveat, cursive; }
.o9-card.is-dim { opacity:.55; }
.o9-card.is-mine .o9-front { box-shadow: 0 0 0 3px #d4512c, 0 3px 10px rgba(30,30,25,.35); }
.o9-open { position:absolute; z-index:5; width:min(360px, calc(100% - 20px)); perspective:1200px; }
.o9-open[hidden] { display:none; }
.o9-flip { position:relative; width:100%; aspect-ratio: 3 / 2; transform-style:preserve-3d; transition: transform 620ms cubic-bezier(.3,.7,.2,1); cursor:pointer; }
.o9-open.is-back .o9-flip { transform: rotateY(180deg); }
.o9-face { position:absolute; inset:0; backface-visibility:hidden; -webkit-backface-visibility:hidden; background:#fffdf8; box-shadow: 0 14px 40px rgba(20,25,20,.32); border-radius:4px; overflow:hidden; }
.o9-face.front { padding:8px; display:flex; flex-direction:column; }
.o9-face.front .o9-big { flex:1; background:#d9dcd8 center/cover no-repeat; }
.o9-face.front .o9-big.is-letter { display:grid; place-items:center; background: linear-gradient(135deg, #e9ecef, #dfe7ea); font:700 34px/1 Fraunces, Georgia, serif; color:${INK}; text-align:center; }
.o9-face.front .o9-bigcap { display:flex; justify-content:space-between; gap:8px; padding-top:6px; font:600 15px var(--font-ui); color:${INK}; }
.o9-face.front .o9-bigcap small { font-weight:500; color:#59686b; font-size:12px; }
.o9-face.back { transform: rotateY(180deg); display:grid; grid-template-columns: 1.25fr 1fr; padding:14px; gap:12px; background: #fffdf8 repeating-linear-gradient(transparent 0 27px, #ece6da 27px 28px); }
.o9-back-left { overflow:auto; font:14px/1.45 Fraunces, Georgia, serif; color:${INK}; border-right:1.5px solid #d8d2c5; padding-right:12px; }
.o9-back-left .o9-words { font-style:italic; margin:0 0 8px; }
.o9-back-left .o9-legs { list-style:none; margin:0; padding:0; font:12px/1.5 var(--font-ui); color:#3e4c50; }
.o9-back-left .o9-legs li { display:flex; align-items:center; gap:5px; }
.o9-back-right { display:flex; flex-direction:column; gap:8px; font:12px/1.4 var(--font-ui); color:#3e4c50; }
.o9-stamp { align-self:flex-end; width:74px; height:84px; border:2.5px dashed #b0402a; padding:4px; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#b0402a; font:700 12px/1.1 var(--font-ui); text-align:center; transform: rotate(3deg); }
.o9-stamp b { font:700 26px/1 Fraunces, Georgia, serif; }
.o9-addr { border-bottom:1.5px solid #d8d2c5; padding-bottom:2px; font:600 14px var(--font-ui); color:${INK}; }
.o9-close { position:absolute; right:-6px; top:-14px; z-index:2; width:44px; height:44px; border:0; border-radius:22px; background:#fffdf8; box-shadow: var(--chrome-shadow); cursor:pointer; color:#59686b; }
.o9-hint { margin-top:6px; text-align:center; font:12px var(--font-ui); color:#59686b; }
.o9-ph { width:44px; height:44px; display:grid; place-items:center; }
.o9-ph i { position:relative; width:30px; height:30px; border-radius:7px; background:#ccd center/cover; box-shadow:0 0 0 2px #fffdf8, 0 2px 6px rgba(20,30,35,.35); }
.o9-ph b { position:absolute; right:-8px; top:-8px; min-width:18px; height:18px; padding:0 4px; border-radius:9px; background:#d4512c; color:#fff; font:700 12px/18px var(--font-ui); }
.o9-pin { display:flex; align-items:center; min-height:44px; }
.o9-pin span { display:inline-flex; align-items:center; gap:3px; height:24px; padding:0 7px 0 5px; border-radius:12px; background:#fffdf8; box-shadow:0 1px 4px rgba(20,30,35,.3); font:600 12px/1 var(--font-ui); color:${INK}; max-width:130px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.o9-hide-cards .o9-card { opacity:0 !important; pointer-events:none; }
.o9-card { transition: opacity 300ms; }
@media (max-width:760px) { .o9-open { left:10px !important; right:10px; width:auto; top:auto !important; bottom: calc(var(--safe-b) + 72px); } .o9-face.back { grid-template-columns: 1fr 0.8fr; padding:10px; gap:8px; } .o9-stamp { width:62px; height:70px; } }
:root[data-reduced] .o9-flip, :root[data-reduced] .o9-card { transition:none; }
`;

let S = null;
const hash = text => { let h = 2166136261; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; };

export async function mount(container, trip, ctx) {
  injectStyle('lab-o9', CSS);
  container.classList.add('o9');
  S = { trip, ctx, container, reduced: false, selected: null, job: null, revealed: false };
  const mine = S;
  const map = await createBaseMap(container, trip);
  if (S !== mine) { map.remove(); return; }
  S.map = map;
  S.jobs = jobs(S);
  S.routes = addRoutes(map, trip);
  S.offStops = bindStopClicks(map, trip, id => ctx.onEventPicked(id));
  // One postcard per stop place (repeat stays share a card: their first visit with photos).
  S.stops = [...S.routes.stopsByPlace.values()].map(entry => {
    const withPhoto = entry.events.find(e => e.photos.length) || entry.events[0];
    return { id: entry.place.id, lng: entry.place.lng, lat: entry.place.lat, place: entry.place, events: entry.events, cover: withPhoto, tbd: entry.tbd };
  });
  S.cards = markerLayer(map, { radius: z => (z < 6 ? 104 : z < 9 ? 112 : 120), className: 'o9-card', render: renderCard, onClick: cardClick, anchor: 'bottom' });
  S.cards.set(S.stops);
  S.photos = markerLayer(map, { radius: 46, className: 'o9-ph', render: renderPhoto, onClick: group => zoomToGroup(map, ctx, group) });
  S.places = markerLayer(map, { radius: 56, className: 'o9-pin', render: renderPin, anchor: 'left', onClick: group => zoomToGroup(map, ctx, group, 16) });
  S.open = document.createElement('div');
  S.open.className = 'o9-open';
  S.open.hidden = true;
  container.append(S.open);
  S.open.addEventListener('click', event => {
    if (event.target.closest('.o9-close')) { closeCard(); return; }
    if (event.target.closest('.o9-flip')) S.open.classList.toggle('is-back');
  });
  S.offInput = onUserInput(map, interrupt);
  map.on('move', placeOpen);
  map.on('zoomend', () => { const city = map.getZoom() >= 9.5; S.photos.set(city && S.selected ? S.trip.eventById(S.selected).located : []); S.places.set(city && S.selected ? S.trip.eventById(S.selected).pois.filter(p => p.located) : []); });
}

// ---------------------------------------------------------------- cards on the map
function renderCard(el, group, first) {
  const lead = group.items.slice().sort((a, b) => (a.events[0].number || 0) - (b.events[0].number || 0))[0];
  const n = group.items.length;
  if (first) {
    const cover = lead.cover, photo = cover.photos[0];
    el.style.setProperty('--r', `${Math.round(hash(lead.id) * 8 - 4)}deg`);
    el.classList.toggle('is-stack', n > 1);
    el.classList.toggle('is-tbd', n === 1 && lead.tbd);
    const face = photo ? `<span class="o9-photo" style="background-image:url('${photo.preview || ''}')"></span>` : `<span class="o9-letter">${escapeHtml(lead.tbd ? 'TBD' : lead.place.name)}</span>`;
    const caption = n > 1 ? `${lead.place.name} +${n - 1}` : lead.place.name;
    const date = n > 1 ? `${n} stops` : lead.tbd ? 'Dates to decide' : (cover.date || '').replace(/^TBD · /, '');
    el.innerHTML = `<span class="o9-in"><span class="o9-front">${face}<span class="o9-cap">${escapeHtml(caption)}<small>${escapeHtml(date)}</small></span></span>${n > 1 ? `<span class="o9-count">${n}</span>` : ''}<span class="o9-tack"></span></span>`;
    el.setAttribute('aria-label', n > 1 ? `${n} stops: ${group.items.map(s => s.place.name).join(', ')}` : `${lead.place.name}${lead.tbd ? ' (TBD)' : ''}`);
  }
  const zoom = S.map.getZoom();
  el.style.setProperty('--w', zoom < 6 ? '66px' : zoom < 9 ? '86px' : '104px');
  const mine = S.selected && group.items.some(s => s.events.some(e => e.id === S.selected));
  el.classList.toggle('is-mine', Boolean(mine));
  el.classList.toggle('is-dim', Boolean(S.selected && !mine));
  el.style.visibility = mine && !S.open.hidden ? 'hidden' : '';
}
function cardClick(group) {
  if (group.items.length > 1) { zoomToGroup(S.map, S.ctx, group, 11); return; }
  const stop = group.items[0];
  if (stop.events.length === 1) { S.ctx.onEventPicked(stop.events[0].id); return; }
  // A repeat stay (e.g. a base city): choose which visit.
  S.chooser?.remove();
  S.chooser = new maplibregl.Popup({ className: 'lab-base-popup', offset: 14 }).setLngLat([stop.lng, stop.lat])
    .setHTML(`<b>${escapeHtml(stop.place.name)}</b>${stop.events.map(e => `<button type="button" class="lab-choice" data-event="${escapeHtml(e.id)}">${escapeHtml(`${S.trip.eventWord} ${e.number} · ${e.title}`)}<small>${escapeHtml(e.date)}</small></button>`).join('')}`).addTo(S.map);
  S.chooser.getElement().addEventListener('click', event => { const b = event.target.closest('[data-event]'); if (b) { S.chooser.remove(); S.ctx.onEventPicked(b.dataset.event); } });
}
function renderPhoto(el, group, first) {
  if (!first) return;
  el.innerHTML = `<i>${group.items.length > 1 ? `<b>${group.items.length}</b>` : ''}</i>`;
  const url = group.items.find(p => p.preview)?.preview;
  if (url) el.querySelector('i').style.backgroundImage = `url("${url}")`;
  el.setAttribute('aria-label', group.items.length > 1 ? `${group.items.length} photos` : `Photo${group.items[0].takenLabel ? ` · ${group.items[0].takenLabel}` : ''}`);
}
function renderPin(el, group, first) {
  if (!first) return;
  el.innerHTML = `<span>${icon(placeIcon(group.items[0].category), { size: 13, stroke: 2.4 })}${escapeHtml(group.items.length > 1 ? `${group.items.length} places` : group.items[0].name)}</span>`;
  el.setAttribute('aria-label', group.items.length > 1 ? `${group.items.length} places` : `Place: ${group.items[0].name}`);
}

// ---------------------------------------------------------------- the open card
function openCard(event, flip) {
  const photo = event.photos[0];
  const legs = event.legs.map(l => `<li>${icon(l.mode, { size: 14, stroke: 2.2 })}${escapeHtml(`${modeOf(l.mode).label}${l.tbd ? ' (TBD)' : ''} from ${l.fromPlace.name} · ${fmtKm(l.km)}`)}</li>`).join('');
  const dates = event.date.replace(/^TBD · /, '');
  S.open.innerHTML = `<button type="button" class="o9-close" aria-label="Close the postcard"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
    <div class="o9-flip" role="button" tabindex="0" aria-label="Turn the postcard over">
      <div class="o9-face front">${photo ? `<div class="o9-big" style="background-image:url('${photo.preview || ''}')"></div>` : `<div class="o9-big is-letter">${escapeHtml(event.tbd ? 'TBD' : event.place?.name || event.title)}</div>`}
        <div class="o9-bigcap"><span>${escapeHtml(event.title)}</span><small>${escapeHtml(dates)}</small></div></div>
      <div class="o9-face back"><div class="o9-back-left">${event.text ? `<p class="o9-words">${escapeHtml(event.text)}</p>` : ''}${legs ? `<ul class="o9-legs">${legs}</ul>` : ''}</div>
        <div class="o9-back-right"><div class="o9-stamp">${escapeHtml(S.trip.eventWord.toUpperCase())}<b>${event.number}</b>${event.legs[0] ? icon(event.legs.at(-1).mode, { size: 18, stroke: 2.2 }) : ''}</div>
          <span class="o9-addr">${escapeHtml(event.place?.name || event.title)}</span><span class="o9-addr">${escapeHtml(event.place?.country || '')}</span>
          <span>${event.photos.length} photo${event.photos.length === 1 ? '' : 's'}${event.pois.length ? ` · ${event.pois.length} place${event.pois.length === 1 ? '' : 's'}` : ''}</span></div></div>
    </div><div class="o9-hint">Tap the card to turn it over</div>`;
  S.open.querySelector('.o9-flip').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); S.open.classList.toggle('is-back'); } });
  S.open.hidden = false;
  S.open.classList.remove('is-back');
  S.openEvent = event;
  placeOpen();
  S.cards.refresh();
  if (flip && !S.reduced) setTimeout(() => S?.open?.classList.add('is-back'), 380);
  else if (flip) S.open.classList.add('is-back');
}
function placeOpen() {
  if (!S?.open || S.open.hidden || !S.openEvent?.place || S.ctx.isPhone()) return;
  const p = S.map.project([S.openEvent.place.lng, S.openEvent.place.lat]), W = S.container.clientWidth, inset = S.ctx.insets();
  const w = Math.min(360, W - 20), h = w / 1.5 + 30;
  let x = p.x + 30, y = p.y - h / 2;
  if (x + w > W - inset.right) x = p.x - 30 - w;
  x = Math.max(inset.left, Math.min(W - inset.right - w, x));
  y = Math.max(inset.top + 10, Math.min(S.container.clientHeight - inset.bottom - h, y));
  S.open.style.left = `${x}px`; S.open.style.top = `${y}px`;
}
function closeCard() { if (!S?.open) return; S.open.hidden = true; S.openEvent = null; S.cards?.refresh(); }

// ---------------------------------------------------------------- jobs
function interrupt() { if (S?.job) S.jobs.cancel('settle'); }
function revealOnce() { if (!S.revealed) { S.revealed = true; reveal(S.map); } }
const overviewCamera = () => cameraFor(S.map, S.ctx, { bounds: S.trip.bounds, maxZoom: 10 }, { extra: 60 });
function landingCamera(event) {
  const camera = cameraFor(S.map, S.ctx, S.trip.eventFrame(event), { extra: 50 });
  return camera && { ...camera, zoom: Math.min(camera.zoom, 12.5) };
}
function land(event, flip) {
  S.routes.select(event.id, true);
  S.container.classList.remove('o9-hide-cards');
  const city = S.map.getZoom() >= 9.5;
  S.photos.set(city ? event.located : []); S.places.set(city ? event.pois.filter(p => p.located) : []);
  openCard(event, flip);
}

export function showOverview({ opening = false } = {}) {
  if (!S?.map) return;
  S.jobs.cancel(); closeCard();
  S.selected = null;
  S.routes.select(null, false);
  S.photos.set([]); S.places.set([]);
  S.cards.refresh();
  const camera = overviewCamera();
  if (!opening || S.reduced) {
    S.container.classList.remove('o9-hide-cards');
    if (!S.revealed || S.reduced) S.map.jumpTo(camera); else S.map.easeTo({ ...camera, duration: 850 });
    revealOnce();
    return;
  }
  const settle = () => S.container.classList.remove('o9-hide-cards');
  const job = S.jobs.start(settle, () => { S.map.jumpTo(camera); settle(); });
  S.map.jumpTo(camera);
  S.container.classList.add('o9-hide-cards');
  revealOnce();
  (async () => { await trace(S, S.routes, job, S.trip.orderedLegs, 3000); if (job.cancelled) return; settle(); S.jobs.finish(job); })();
}
export function selectEvent(id, { animate = true } = {}) {
  if (!S?.map) return;
  const event = S.trip.eventById(id);
  if (!event) return;
  S.jobs.cancel(); closeCard();
  S.selected = id;
  S.routes.select(id, false);
  S.cards.refresh();
  const destination = landingCamera(event);
  if (!animate || S.reduced || !event.legs.length) {
    if (destination) { if (!S.revealed || S.reduced || !animate) S.map.jumpTo(destination); else S.map.easeTo({ ...destination, duration: 900 }); }
    revealOnce();
    land(event, animate && !S.reduced);
    return;
  }
  revealOnce();
  const job = S.jobs.start(() => land(event, false), () => { if (destination) S.map.jumpTo(destination); land(event, false); });
  (async () => {
    await S.jobs.ease(job, cameraFor(S.map, S.ctx, { bounds: S.trip.routeFrame(event.legs), maxZoom: 12.5 }, { extra: 50 }), 850);
    await trace(S, S.routes, job, event.legs, 1500);
    await S.jobs.sleep(job, 250);
    await S.jobs.ease(job, destination, 900);
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
    { swatch: '<svg width="44" height="34" viewBox="0 0 44 34"><g transform="rotate(-3 22 17)"><rect x="8" y="2" width="28" height="26" fill="#fffdf8" stroke="#d8d2c5"/><rect x="10" y="4" width="24" height="17" fill="#aab"/></g><circle cx="22" cy="31" r="3" fill="#d4512c"/></svg>', label: 'Postcard', note: 'first photo of the stop; a number means a stack' },
    { swatch: '<svg width="44" height="34" viewBox="0 0 44 34"><rect x="8" y="2" width="28" height="26" fill="#fbfaf6" stroke="#9aa3a3" stroke-dasharray="3 2"/><text x="22" y="20" font-family="Caveat" font-size="12" text-anchor="middle" fill="#59686b">TBD</text></svg>', label: 'TBD stop', note: 'blank card, dashed edge' },
    { swatch: '<svg width="44" height="34" viewBox="0 0 44 34"><rect x="4" y="4" width="36" height="26" fill="#fffdf8" stroke="#d8d2c5"/><line x1="22" y1="7" x2="22" y2="27" stroke="#d8d2c5"/><rect x="28" y="7" width="9" height="10" fill="none" stroke="#b0402a" stroke-dasharray="2 1.5"/></svg>', label: 'Card back', note: 'traveler’s words, legs with mode icons, stamp' }
  ];
}
export function destroy() {
  if (!S) return;
  S.jobs?.cancel(); S.chooser?.remove();
  S.offInput?.(); S.offStops?.();
  S.cards?.destroy(); S.photos?.destroy(); S.places?.destroy();
  S.map?.remove(); S.open?.remove();
  S.container.classList.remove('o9', 'o9-hide-cards');
  S = null;
}
