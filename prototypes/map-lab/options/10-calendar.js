// Option 10 · Calendar. A real calendar strip under the map: one cell per
// day grouped into stays, travel days carrying their mode icons, photo days
// dotted, today marked, and the stops still to be decided as dashed cells
// after the dates. Tap a day to travel there; hover previews it. Real, light
// map (O23); legs drawn by the viewer's arrival trace, camera still (O09).
import { escapeHtml, icon, modeOf, fmtKm, placeIcon } from '../data.js';
import { injectStyle, markerLayer, zoomToGroup } from './common.js';
import { BASE_CSS, createBaseMap, addRoutes, bindStopClicks, jobs, trace, reveal, cameraFor, onUserInput } from './base-map.js';

export const meta = {
  number: 10, name: 'Calendar', modes: ['light'], keyBackground: '#f7f5ef',
  tagline: 'The trip as the days it took: a calendar strip of real dates under the map, each stay a block of days, travel days marked with their mode, photos as dots, today marked and the undecided stops waiting at the end.',
  whatsNew: [
    'Calendar strip of every real day, grouped into stays with the stop name above; the arrival day shows the mode icons of the legs that got you there.',
    'Photo days carry dots from capture dates; today is marked (or a Today marker sits between the past and the TBD stops); TBD stops are dashed cells after the dates.',
    'Tap a day to travel there; hovering a day highlights its stop’s legs on the map without moving the camera.'
  ],
  keeps: ['Real, light map (O23), current transport styles, the viewer’s arrival trace, still camera and current timing (O09).', 'Dates come only from the itinerary; capture dates only from the photos.', 'Unselected opening and 3-second trace; direct links land without animation; input interrupts; reduced motion shows the end state.'],
  departures: [
    'A calendar panel sits above the stop picker (O08 keeps one picker on phones).',
    'Hover previews a stop’s legs on desktop as the day list does, but from the strip.',
    'Whole-trip Replay re-runs the opening (O09).'
  ],
  phone: 'The strip scrolls with one thumb above the stop picker and centres on the chosen stop; every day is a 44 × 56 px target.'
};

const INK = '#1f2b2f';
const CSS = `${BASE_CSS}
.o10-panel { background:#fffdf8; border-radius:18px; box-shadow: var(--chrome-shadow); padding:8px 0 6px; color:${INK}; }
.o10-read { display:flex; align-items:baseline; gap:8px; padding:0 14px 6px; min-height:22px; white-space:nowrap; overflow:hidden; }
.o10-read b { font-size:15px; overflow:hidden; text-overflow:ellipsis; letter-spacing:-.01em; }
.o10-read span { font-size:12px; color:#59686b; overflow:hidden; text-overflow:ellipsis; }
.o10-strip { display:flex; align-items:flex-end; gap:6px; overflow-x:auto; padding:0 14px 4px; scrollbar-width:thin; scroll-behavior:auto; }
.o10-stay { flex:none; display:flex; flex-direction:column; gap:3px; }
.o10-name { font:650 12px/16px var(--font-ui); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100%; padding-left:2px; color:${INK}; }
.o10-name small { color:#59686b; font-weight:500; margin-right:3px; font-size:12px; }
.o10-cell .o10-icons small { font:600 12px/16px var(--font-ui); }
.o10-stay.is-tbd .o10-name { color:#59686b; }
.o10-days { display:flex; gap:2px; }
.o10-cell { position:relative; width:44px; height:56px; border:0; border-radius:8px; padding:4px 0 0; background:#f1eee7; cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:2px; font:inherit; color:${INK}; transition: transform 120ms ease, background-color 160ms; }
.o10-cell:active { transform: scale(.95); }
.o10-cell .o10-num { font:600 12px/14px var(--font-ui); color:#3e4c50; }
.o10-cell .o10-icons { display:flex; gap:1px; height:18px; color:${INK}; }
.o10-cell .o10-icons svg { width:16px; height:16px; }
.o10-cell .o10-dots { display:flex; gap:2px; height:6px; }
.o10-cell .o10-dots i { width:5px; height:5px; border-radius:50%; background:#e8912d; }
.o10-cell.is-travel { background:#e7eef2; box-shadow: inset 0 3px 0 var(--c, #0072b2); }
.o10-cell.is-tbd { background:#fbfaf6; border:1.5px dashed #9aa3a3; }
.o10-cell.is-tbd .o10-num { font:700 14px/14px Caveat, cursive; color:#59686b; }
.o10-cell.is-sel { background:#fbe3d9; box-shadow: inset 0 0 0 2px #d4512c; }
.o10-cell.is-sel.is-travel { box-shadow: inset 0 0 0 2px #d4512c, inset 0 5px 0 var(--c, #0072b2); }
.o10-cell.is-today::after { content:'Today'; position:absolute; bottom:-15px; left:50%; transform:translateX(-50%); font:700 12px/14px var(--font-ui); color:#d4512c; white-space:nowrap; }
.o10-cell.is-today { outline:2px solid #d4512c; outline-offset:1px; }
.o10-today { flex:none; align-self:stretch; display:flex; flex-direction:column; justify-content:flex-end; padding:0 4px; font:700 12px/1.2 var(--font-ui); color:#d4512c; white-space:nowrap; border-left:2px solid #d4512c; margin-bottom:4px; }
.o10-pad { flex:none; height:14px; }
@media (hover:hover) { .o10-cell:hover { background:#e9e4d8; } }
.o10-ph { width:44px; height:44px; display:grid; place-items:center; }
.o10-ph i { position:relative; width:30px; height:30px; border-radius:7px; background:#ccd center/cover; box-shadow:0 0 0 2px #fffdf8, 0 2px 6px rgba(20,30,35,.35); }
.o10-ph b { position:absolute; right:-8px; top:-8px; min-width:18px; height:18px; padding:0 4px; border-radius:9px; background:#d4512c; color:#fff; font:700 12px/18px var(--font-ui); }
.o10-pin { display:flex; align-items:center; min-height:44px; }
.o10-pin span { display:inline-flex; align-items:center; gap:3px; height:24px; padding:0 7px 0 5px; border-radius:12px; background:#fffdf8; box-shadow:0 1px 4px rgba(20,30,35,.3); font:600 12px/1 var(--font-ui); color:${INK}; max-width:130px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
:root[data-reduced] .o10-cell { transition:none; }
`;

let S = null;
const DAY = 86400000;
const iso = ms => new Date(ms).toISOString().slice(0, 10);
const ms = date => Date.parse(`${date}T00:00:00Z`);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Days partitioned into stays: each dated stop owns its arrival day up to the
// day before the next stop's arrival (the last stop keeps its own end date).
function buildDays(trip) {
  const dated = trip.events.filter(e => e.calendarDate);
  const photoDays = new Map();
  for (const photo of trip.photos) if (photo.time !== null) { const d = iso(photo.time); photoDays.set(d, (photoDays.get(d) || 0) + 1); }
  const stays = dated.map((event, index) => {
    const start = event.calendarDate;
    const next = dated[index + 1]?.calendarDate;
    const end = next && next > start ? iso(ms(next) - DAY) : (event.calendarEndDate && event.calendarEndDate >= start ? event.calendarEndDate : start);
    const days = [];
    for (let t = ms(start); t <= ms(end) && days.length < 120; t += DAY) days.push(iso(t));
    return { event, days };
  });
  const tbd = trip.events.filter(e => !e.calendarDate);
  return { stays, tbd, photoDays };
}

export async function mount(container, trip, ctx) {
  injectStyle('lab-o10', CSS);
  container.classList.add('o10');
  S = { trip, ctx, container, reduced: false, selected: null, job: null, revealed: false, preview: null };
  S.cal = buildDays(trip);
  buildStrip();
  const mine = S;
  const map = await createBaseMap(container, trip);
  if (S !== mine) { map.remove(); return; }
  S.map = map;
  S.jobs = jobs(S);
  S.routes = addRoutes(map, trip);
  S.offStops = bindStopClicks(map, trip, id => ctx.onEventPicked(id));
  S.photos = markerLayer(map, { radius: 46, className: 'o10-ph', render: renderPhoto, onClick: group => zoomToGroup(map, ctx, group) });
  S.places = markerLayer(map, { radius: 56, className: 'o10-pin', render: renderPin, anchor: 'left', onClick: group => zoomToGroup(map, ctx, group, 16) });
  S.offInput = onUserInput(map, interrupt);
  map.on('zoomend', cityMarkers);
}

// ---------------------------------------------------------------- strip
function icons(legs) {
  const modes = [...new Set(legs.map(l => l.mode))];
  return modes.slice(0, 2).map(m => icon(m, { size: 16, stroke: 2.2 })).join('') + (modes.length > 2 ? `<small>+${modes.length - 2}</small>` : '');
}
function buildStrip() {
  const { stays, tbd, photoDays } = S.cal, today = S.trip.today;
  const lastDay = stays.at(-1)?.days.at(-1);
  let lastMonth = '', html = '';
  for (const { event, days } of stays) {
    const legs = event.legs, color = legs.length ? modeOf(legs.at(-1).mode).color : '';
    html += `<div class="o10-stay" data-event="${escapeHtml(event.id)}" style="max-width:${days.length * 46}px"><div class="o10-name" title="${escapeHtml(event.title)}"><small>${event.number}</small>${escapeHtml(event.place?.name || event.title)}</div><div class="o10-days">`;
    days.forEach((day, i) => {
      const [y, m, d] = day.split('-');
      const month = MONTHS[Number(m) - 1];
      const travel = i === 0 && legs.length;
      const photos = Math.min(3, photoDays.get(day) || 0);
      html += `<button type="button" class="o10-cell${travel ? ' is-travel' : ''}${day === today ? ' is-today' : ''}" data-event="${escapeHtml(event.id)}" data-day="${day}" ${travel ? `style="--c:${color}"` : ''}
        aria-label="${escapeHtml(`${Number(d)} ${month} ${y}: ${event.title}${travel ? `, travel by ${[...new Set(legs.map(l => modeOf(l.mode).label))].join(' and ')}` : ''}${photoDays.get(day) ? `, ${photoDays.get(day)} photos` : ''}`)}">
        <span class="o10-num">${month !== lastMonth ? `${Number(d)} ${month}` : Number(d)}</span><span class="o10-icons">${travel ? icons(legs) : ''}</span><span class="o10-dots">${'<i></i>'.repeat(photos)}</span></button>`;
      lastMonth = month;
    });
    html += '</div></div>';
  }
  if (tbd.length && lastDay && today > lastDay) html += `<div class="o10-today">Today<br>${Number(today.slice(8))} ${MONTHS[Number(today.slice(5, 7)) - 1]}</div>`;
  for (const event of tbd) {
    html += `<div class="o10-stay is-tbd" data-event="${escapeHtml(event.id)}" style="max-width:120px"><div class="o10-name" title="${escapeHtml(event.title)}"><small>${event.number}</small>${escapeHtml(event.place?.name || event.title)}</div><div class="o10-days">
      <button type="button" class="o10-cell is-tbd" data-event="${escapeHtml(event.id)}" aria-label="${escapeHtml(`${event.title}: dates to decide${event.legs.length ? `, by ${[...new Set(event.legs.map(l => modeOf(l.mode).label))].join(' and ')}` : ''}`)}"><span class="o10-num">TBD</span><span class="o10-icons">${icons(event.legs)}</span><span class="o10-dots"></span></button></div></div>`;
  }
  const panel = document.createElement('div');
  panel.className = 'o10-panel';
  panel.style.visibility = 'hidden';
  panel.innerHTML = `<div class="o10-read"><b></b><span></span></div><div class="o10-pad"></div><div class="o10-strip" role="group" aria-label="Trip calendar">${html}</div><div class="o10-pad"></div>`;
  S.ctx.slots.panel.append(panel);
  S.panel = panel;
  S.strip = panel.querySelector('.o10-strip');
  S.title = panel.querySelector('.o10-read b');
  S.meta = panel.querySelector('.o10-read span');
  S.cells = [...S.strip.querySelectorAll('.o10-cell')];
  S.strip.addEventListener('click', event => { const cell = event.target.closest('.o10-cell'); if (cell) { interrupt(); S.ctx.onEventPicked(cell.dataset.event); } });
  S.strip.addEventListener('pointerover', event => { const cell = event.target.closest('.o10-cell'); if (cell && event.pointerType === 'mouse') preview(cell.dataset.event); });
  S.strip.addEventListener('pointerleave', () => preview(null));
  for (const type of ['pointerdown', 'wheel', 'touchstart']) S.strip.addEventListener(type, () => interrupt(), { passive: true });
  S.strip.addEventListener('keydown', event => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    const index = S.cells.indexOf(document.activeElement);
    if (index < 0) return;
    event.preventDefault(); event.stopPropagation();
    S.cells[Math.max(0, Math.min(S.cells.length - 1, index + (event.key === 'ArrowRight' ? 1 : -1)))].focus();
  });
}
function preview(id) {
  if (!S?.routes || S.job || id === S.preview) return;
  S.preview = id;
  S.routes.select(id || S.selected, Boolean(!id && S.selected));
}
function markStrip(event) {
  S.cells.forEach(cell => cell.classList.toggle('is-sel', Boolean(event) && cell.dataset.event === event.id));
  if (event) {
    const first = S.cells.find(cell => cell.dataset.event === event.id);
    if (first) S.strip.scrollTo({ left: Math.max(0, first.offsetLeft - S.strip.clientWidth / 3), behavior: S.reduced || !S.revealed ? 'auto' : 'smooth' });
    const legs = event.legs.map(l => `${modeOf(l.mode).label}${l.tbd ? ' (TBD)' : ''} from ${l.fromPlace.name} ${fmtKm(l.km)}`).join(' · ');
    S.title.textContent = event.title;
    S.meta.textContent = [`${S.trip.eventWord} ${event.number}`, event.date.replace(/^TBD · /, event.tbd ? 'TBD · ' : ''), legs, event.photos.length ? `${event.photos.length} photo${event.photos.length === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ');
  } else {
    const dated = S.cal.stays.reduce((n, s) => n + s.days.length, 0);
    S.title.textContent = 'Whole trip';
    S.meta.textContent = [`${dated} days`, S.cal.tbd.length ? `${S.cal.tbd.length} stops still to date` : '', 'tap a day to go there'].filter(Boolean).join(' · ');
  }
}

// ---------------------------------------------------------------- markers
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
function cityMarkers() {
  if (!S?.map) return;
  const event = S.selected && S.trip.eventById(S.selected), city = S.map.getZoom() >= 9.5;
  S.photos.set(city && event ? event.located : []);
  S.places.set(city && event ? event.pois.filter(p => p.located) : []);
}

// ---------------------------------------------------------------- jobs
function interrupt() { if (S?.job) S.jobs.cancel('settle'); }
function revealOnce() { if (!S.revealed) { S.revealed = true; reveal(S.map); S.panel.style.visibility = ''; } }
const overviewCamera = () => cameraFor(S.map, S.ctx, { bounds: S.trip.bounds, maxZoom: 10 }, { extra: 30 });
function land(event) { S.routes.select(event.id, true); cityMarkers(); }

export function showOverview({ opening = false } = {}) {
  if (!S?.map) return;
  S.jobs.cancel();
  S.selected = null; S.preview = null;
  S.routes.select(null, false);
  markStrip(null); cityMarkers();
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
  S.selected = id; S.preview = null;
  S.routes.select(id, false);
  const destination = cameraFor(S.map, S.ctx, S.trip.eventFrame(event), { extra: 40 });
  if (!animate || S.reduced || !event.legs.length) {
    if (destination) { if (!S.revealed || S.reduced || !animate) S.map.jumpTo(destination); else S.map.easeTo({ ...destination, duration: 900 }); }
    revealOnce(); markStrip(event); land(event);
    return;
  }
  revealOnce(); markStrip(event);
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
    { swatch: '<svg width="44" height="30" viewBox="0 0 44 30"><rect x="2" y="2" width="18" height="26" rx="4" fill="#e7eef2"/><rect x="2" y="2" width="18" height="3" fill="#0072b2"/><rect x="24" y="2" width="18" height="26" rx="4" fill="#f1eee7"/><circle cx="33" cy="22" r="2.5" fill="#e8912d"/></svg>', label: 'Calendar day', note: 'travel days carry mode icons; dots are photos' },
    { swatch: '<svg width="44" height="30" viewBox="0 0 44 30"><rect x="12" y="2" width="20" height="26" rx="4" fill="#fbfaf6" stroke="#9aa3a3" stroke-dasharray="3 2"/></svg>', label: 'TBD stop', note: 'after the dated days' },
    { swatch: '<svg width="44" height="30" viewBox="0 0 44 30"><rect x="12" y="2" width="20" height="26" rx="4" fill="#f1eee7" stroke="#d4512c" stroke-width="2"/></svg>', label: 'Today', note: 'or a marker before the TBD stops' }
  ];
}
export function destroy() {
  if (!S) return;
  S.jobs?.cancel();
  S.offInput?.(); S.offStops?.();
  S.photos?.destroy(); S.places?.destroy();
  S.map?.remove();
  S.container.classList.remove('o10');
  S = null;
}
