// Option 8 · Now. A time-aware map for a trip in progress: what has happened
// (solid), what is locked in (lighter) and what is still TBD (dotted), with an
// honest "where are they now" built only from itinerary dates and the latest
// located photo. Real, light map (O23); legs drawn by the viewer's arrival trace.
import { MODES, modeOf, escapeHtml, icon, fmtKm } from '../data.js';
import { injectStyle } from './common.js';
import { BASE_CSS, createBaseMap, addRoutes, bindStopClicks, jobs, trace, reveal, cameraFor, onUserInput } from './base-map.js';

export const meta = {
  number: 8, name: 'Now', modes: ['light'], keyBackground: '#f7f5ef',
  tagline: 'Where is the trip today? The map shows the journey so far in full colour, the plan ahead in lighter and dotted lines, and a short, honest status built only from the itinerary and the photos.',
  whatsNew: [
    'Time-aware styling with the viewer’s own planning rules: past solid, future locked in lighter, future TBD dotted; filter chips match Heading East’s Past / Locked in / TBD filters.',
    '“Now” card: today’s date, last confirmed and next planned stop, distance so far by mode, stops, countries and photos; completed trips show their totals.',
    'The opening traces only the trip so far, then the plan ahead appears. A date field previews any day of the trip.'
  ],
  keeps: ['Real, light map (O23), current transport styles, still camera and arrival timing (O09).', 'No invented location: the card says “last confirmed” and “next planned” from dates, and the latest photo’s own capture date and stop.', 'Unselected overview (no stop selected); direct links land without animation; input interrupts; reduced motion shows the end state.'],
  departures: [
    'The overview gains a status card and a “last confirmed” marker (O06 keeps the opening to the map and one action).',
    'Future legs are drawn lighter by default rather than in full transport colour (O06 key consistency).',
    'The opening traces the past only, then reveals the plan; whole-trip Replay re-runs it (O09).'
  ],
  phone: 'The card compresses to the status line and a distance bar above the stop picker; filters move into the top-right tool slot as three 44 px chips.'
};

const CSS = `${BASE_CSS}
.o8-card { background:#fffdf8; border-radius:18px; box-shadow: var(--chrome-shadow); padding:10px 14px 12px; color:#1f2b2f; font:13px/1.35 var(--font-ui); }
.o8-top { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.o8-date { font-size:12px; color:#59686b; text-transform:none; }
.o8-status { margin:2px 0 0; font-size:15px; font-weight:650; letter-spacing:-.01em; }
.o8-status .o8-sub { display:block; font-size:12px; font-weight:500; color:#59686b; }
.o8-stats { display:flex; flex-wrap:wrap; gap:4px 14px; margin-top:8px; font-size:12px; color:#3e4c50; }
.o8-stats b { font-size:14px; color:#1f2b2f; }
.o8-bar { display:flex; height:10px; border-radius:5px; overflow:hidden; margin-top:8px; background:#ece8df; }
.o8-bar i { display:block; height:100%; }
.o8-modes { display:flex; flex-wrap:wrap; gap:2px 12px; margin-top:4px; font-size:12px; color:#3e4c50; }
.o8-modes span { display:inline-flex; align-items:center; gap:4px; }
.o8-preview { display:inline-flex; align-items:center; gap:6px; margin-left:auto; font-size:12px; color:#59686b; }
.o8-preview input { height:44px; border:1px solid #d9d2c3; border-radius:10px; padding:0 8px; font:13px var(--font-ui); color:#1f2b2f; background:#fff; }
.o8-back { height:44px; padding:0 14px; border-radius:22px; border:1.5px solid #1f2b2f; background:#fff; font:600 13px var(--font-ui); cursor:pointer; }
.o8-chips { display:flex; gap:6px; flex-wrap:wrap; justify-content:flex-end; }
.o8-chips [hidden] { display:none; }
.o8-now { display:flex; flex-direction:column; align-items:center; pointer-events:none; }
.o8-now span { padding:5px 10px; border-radius:14px; background:#1f2b2f; color:#fffdf8; font:650 12px/1.2 var(--font-ui); white-space:nowrap; box-shadow:0 4px 12px rgba(20,30,35,.3); }
.o8-now i { width:2px; height:14px; background:#1f2b2f; }
.o8-now b { width:16px; height:16px; border-radius:50%; background:#d4512c; box-shadow: 0 0 0 3px #fffdf8, 0 0 0 4.5px #1f2b2f; }
.o8-latest { display:flex; align-items:center; gap:6px; pointer-events:none; }
.o8-latest i { width:34px; height:34px; border-radius:50%; background:#ccd center/cover; box-shadow:0 0 0 2.5px #fffdf8, 0 2px 8px rgba(20,30,35,.35); }
.o8-latest span { padding:3px 8px; border-radius:10px; background:#fffdf8; font:600 12px/1.2 var(--font-ui); color:#1f2b2f; box-shadow:0 1px 4px rgba(20,30,35,.25); white-space:nowrap; }
.o8-fade { opacity:0; transition: opacity 400ms; }
.o8-fade.is-in { opacity:1; }
@media (max-width:760px) { .o8-stats, .o8-modes, .o8-preview { display:none; } .o8-card.is-open .o8-stats, .o8-card.is-open .o8-modes { display:flex; } }
:root[data-reduced] .o8-fade { transition:none; }
`;

let S = null;
const DAY = 86400000;
const dateLabel = iso => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const shortDate = iso => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

export async function mount(container, trip, ctx) {
  injectStyle('lab-o8', CSS);
  container.classList.add('o8');
  S = { trip, ctx, container, reduced: false, selected: null, job: null, revealed: false, today: trip.today };
  buildCard();
  buildChips();
  const mine = S;
  const map = await createBaseMap(container, trip);
  if (S !== mine) { map.remove(); return; }
  S.map = map;
  S.jobs = jobs(S);
  S.routes = addRoutes(map, trip, { planning: true });
  S.offStops = bindStopClicks(map, trip, id => ctx.onEventPicked(id));
  S.nowEl = document.createElement('div'); S.nowEl.className = 'o8-now o8-fade';
  S.nowMarker = new maplibregl.Marker({ element: S.nowEl, anchor: 'bottom', offset: [0, 8] });
  S.latestEl = document.createElement('div'); S.latestEl.className = 'o8-latest o8-fade';
  S.latestMarker = new maplibregl.Marker({ element: S.latestEl, anchor: 'left', offset: [-17, 0] });
  S.offInput = onUserInput(map, interrupt);
  computeStatus();
}

// ---------------------------------------------------------------- status from data only
function computeStatus() {
  const U = window.JOURNEY_ATLAS_UTILS, trip = S.trip, today = S.today;
  for (const event of trip.events) event.category = U.planningCategory({ calendarDate: event.calendarDate, planningStatus: event.tbd ? 'tbd' : '' }, { status: trip.status }, today);
  const dated = trip.events.filter(e => e.calendarDate);
  const past = trip.events.filter(e => e.category === 'past');
  const ahead = trip.events.filter(e => e.category !== 'past');
  const current = dated.filter(e => e.calendarDate <= today && (e.calendarEndDate || e.calendarDate) >= today).at(-1) || null;
  const last = past.at(-1) || null;
  const next = ahead[0] || null;
  const pastLegs = past.flatMap(e => e.legs), aheadLegs = ahead.flatMap(e => e.legs);
  const byMode = new Map();
  for (const leg of pastLegs) byMode.set(leg.mode, (byMode.get(leg.mode) || 0) + leg.km);
  const latest = trip.located.filter(p => p.time !== null && trip.eventById(p.eventId)?.category === 'past').sort((a, b) => b.time - a.time)[0] || null;
  S.status = {
    today, current, last, next, latest, byMode,
    complete: !ahead.length, notStarted: !past.length,
    km: pastLegs.reduce((s, l) => s + l.km, 0), aheadKm: aheadLegs.reduce((s, l) => s + l.km, 0),
    stops: new Set(past.map(e => e.place?.id).filter(Boolean)).size,
    countries: new Set(past.map(e => e.place?.country).filter(Boolean)).size,
    photos: past.reduce((s, e) => s + e.photos.length, 0),
    lockedAhead: ahead.filter(e => e.category === 'locked').length, tbdAhead: ahead.filter(e => e.category === 'tbd').length,
    first: dated[0] || null, end: dated.at(-1) || null
  };
  if (S.map) S.routes.refresh();
  updateChipCounts();
}
function eventDates(e) {
  if (!e?.calendarDate) return 'dates to decide';
  const end = e.calendarEndDate && e.calendarEndDate !== e.calendarDate ? `–${shortDate(e.calendarEndDate)}` : '';
  return `${shortDate(e.calendarDate)}${end}`;
}
function statusLine() {
  const st = S.status;
  if (st.complete) return { main: `Trip complete · ${st.first ? shortDate(st.first.calendarDate) : ''}${st.end ? ` – ${shortDate(st.end.calendarEndDate || st.end.calendarDate)}` : ''}`, sub: `${S.trip.events.length} ${S.trip.eventsWord}` };
  if (st.notStarted) return { main: `Starts ${st.next?.calendarDate ? shortDate(st.next.calendarDate) : 'soon'}${st.next?.place ? ` in ${st.next.place.name}` : ''}`, sub: 'Nothing travelled yet' };
  if (st.current) return { main: `By the itinerary: ${st.current.place?.name || st.current.title}`, sub: `${eventDates(st.current)}${st.next && st.next !== st.current ? ` · next ${st.next.place?.name || st.next.title}, ${eventDates(st.next)}` : ''}` };
  return { main: `Last confirmed: ${st.last.place?.name || st.last.title} (until ${shortDate(st.last.calendarEndDate || st.last.calendarDate)})`, sub: st.next ? `Next planned: ${st.next.place?.name || st.next.title} · ${eventDates(st.next)}` : '' };
}

// ---------------------------------------------------------------- card and chips
function buildCard() {
  const card = document.createElement('div');
  card.className = 'o8-card';
  card.style.visibility = 'hidden';
  S.ctx.slots.panel.append(card);
  S.card = card;
  card.addEventListener('click', event => {
    if (event.target.closest('.o8-back')) S.ctx.onOverviewPicked();
    else if (S.ctx.isPhone() && !event.target.closest('input, button')) card.classList.toggle('is-open');
  });
  card.addEventListener('change', event => {
    if (!event.target.matches('input[type="date"]') || !event.target.value) return;
    S.today = event.target.value;
    computeStatus();
    renderSummary();
    placeMarkers(true);
  });
}
function modeBar(byMode) {
  const total = [...byMode.values()].reduce((a, b) => a + b, 0) || 1;
  const entries = [...byMode.entries()].sort((a, b) => b[1] - a[1]);
  return `<div class="o8-bar" role="img" aria-label="${escapeHtml(entries.map(([m, km]) => `${modeOf(m).label} ${fmtKm(km)}`).join(', '))}">${entries.map(([m, km]) => `<i style="width:${(100 * km / total).toFixed(1)}%;background:${MODES[m]?.color || '#006f92'}${MODES[m]?.dash ? `;background-image:repeating-linear-gradient(90deg,transparent 0 6px,#fffdf8aa 6px 8px)` : ''}"></i>`).join('')}</div>
    <div class="o8-modes">${entries.map(([m, km]) => `<span>${icon(m, { size: 14, stroke: 2.2 })}${escapeHtml(modeOf(m).label)} ${escapeHtml(fmtKm(km))}</span>`).join('')}</div>`;
}
function renderSummary() {
  const st = S.status, line = statusLine();
  const latest = st.latest ? `<span>Latest photo: <b>${escapeHtml(st.latest.takenLabel.split(' · ')[0] || '')}</b> · ${escapeHtml(S.trip.eventById(st.latest.eventId)?.title || '')}</span>` : '';
  S.card.innerHTML = `<div class="o8-top"><span class="o8-date">${escapeHtml(dateLabel(st.today))}${st.today !== S.trip.today ? ' · preview' : ''}</span>
      <label class="o8-preview">Preview a day <input type="date" value="${st.today}" ${S.trip.startDate ? `min="${S.trip.startDate}"` : ''}></label></div>
    <p class="o8-status">${escapeHtml(line.main)}<span class="o8-sub">${escapeHtml(line.sub)}</span></p>
    ${st.notStarted ? '' : `<div class="o8-stats"><span><b>${escapeHtml(fmtKm(st.km))}</b> ${st.complete ? 'travelled' : 'so far'}</span><span><b>${st.stops}</b> stops</span>${st.countries ? `<span><b>${st.countries}</b> countries</span>` : ''}<span><b>${st.photos}</b> photos</span>${!st.complete ? `<span>Ahead: ${st.lockedAhead} locked in · ${st.tbdAhead} TBD · ${escapeHtml(fmtKm(st.aheadKm))}</span>` : ''}${latest}</div>
    ${st.byMode.size ? modeBar(st.byMode) : ''}`}`;
  S.card.style.visibility = '';
}
function renderEvent(event) {
  const st = S.status, today = Date.parse(`${st.today}T12:00:00Z`);
  let relative = 'dates to decide';
  if (event.calendarDate) {
    const start = Date.parse(`${event.calendarDate}T12:00:00Z`), end = Date.parse(`${event.calendarEndDate || event.calendarDate}T12:00:00Z`);
    if (today >= start && today <= end) relative = 'now, by the itinerary';
    else if (today > end) { const d = Math.round((today - end) / DAY); relative = `${d} day${d === 1 ? '' : 's'} ago`; }
    else { const d = Math.round((start - today) / DAY); relative = `in ${d} day${d === 1 ? '' : 's'}`; }
  }
  const legs = event.legs.map(l => `${modeOf(l.mode).label}${l.tbd ? ' (TBD)' : ''} ${fmtKm(l.km)}`).join(' · ');
  S.card.innerHTML = `<div class="o8-top"><span class="o8-date">${escapeHtml(`${S.trip.eventWord} ${event.number} · ${event.category === 'past' ? 'past' : event.category === 'tbd' ? 'TBD' : 'locked in'}`)}</span><button type="button" class="o8-back">Back to now</button></div>
    <p class="o8-status">${escapeHtml(event.title)}<span class="o8-sub">${escapeHtml([eventDates(event), relative].join(' · '))}</span></p>
    <div class="o8-stats">${legs ? `<span>${escapeHtml(legs)}</span>` : ''}<span><b>${event.photos.length}</b> photo${event.photos.length === 1 ? '' : 's'}</span>${event.pois.length ? `<span><b>${event.pois.length}</b> place${event.pois.length === 1 ? '' : 's'}</span>` : ''}</div>`;
  S.card.style.visibility = '';
}
function buildChips() {
  const box = document.createElement('div');
  box.className = 'o8-chips';
  box.setAttribute('role', 'group');
  box.setAttribute('aria-label', 'Show');
  box.innerHTML = ['past', 'locked', 'tbd'].map(k => `<button type="button" class="lab-chip" data-state="${k}" aria-pressed="true"></button>`).join('');
  box.addEventListener('click', event => {
    const chip = event.target.closest('[data-state]');
    if (!chip || !S.routes) return;
    const on = chip.getAttribute('aria-pressed') !== 'true';
    chip.setAttribute('aria-pressed', String(on));
    S.routes.show({ [chip.dataset.state]: on });
  });
  S.ctx.slots.tools.append(box);
  S.chipsBox = box;
}
function updateChipCounts() {
  const counts = { past: 0, locked: 0, tbd: 0 };
  for (const e of S.trip.events) counts[e.category]++;
  const names = { past: 'Past', locked: 'Locked in', tbd: 'TBD' };
  S.chipsBox.querySelectorAll('[data-state]').forEach(chip => {
    chip.textContent = `${names[chip.dataset.state]} · ${counts[chip.dataset.state]}`;
    chip.hidden = !counts[chip.dataset.state];
  });
}
function placeMarkers(visible) {
  const st = S.status, anchor = st.current || st.last;
  if (anchor?.place && !st.complete && !st.notStarted) {
    S.nowEl.innerHTML = `<span>${escapeHtml(st.current ? `Now · ${anchor.place.name}` : `Last confirmed · ${anchor.place.name}`)}</span><i></i><b></b>`;
    S.nowMarker.setLngLat([anchor.place.lng, anchor.place.lat]).addTo(S.map);
    S.nowEl.removeAttribute('tabindex');
  } else S.nowMarker.remove();
  if (st.latest) {
    S.latestEl.innerHTML = `<i></i><span>Latest photo · ${escapeHtml(st.latest.takenLabel.split(' · ')[0] || '')}</span>`;
    if (st.latest.preview) S.latestEl.querySelector('i').style.backgroundImage = `url("${st.latest.preview}")`;
    S.latestMarker.setLngLat([st.latest.lng, st.latest.lat]).addTo(S.map);
    S.latestEl.removeAttribute('tabindex'); // a label, not a control
  } else S.latestMarker.remove();
  const show = () => { S.nowEl.classList.toggle('is-in', visible); S.latestEl.classList.toggle('is-in', visible); };
  if (S.reduced) show(); else requestAnimationFrame(show);
}

// ---------------------------------------------------------------- jobs
function interrupt() { if (S?.job) S.jobs.cancel('settle'); }
function revealOnce() { if (!S.revealed) { S.revealed = true; reveal(S.map); } }
const overviewCamera = () => cameraFor(S.map, S.ctx, { bounds: S.trip.bounds, maxZoom: 10 }, { extra: 30 });

export function showOverview({ opening = false } = {}) {
  if (!S?.map) return;
  S.jobs.cancel();
  S.selected = null;
  S.routes.select(null, false);
  renderSummary();
  const camera = overviewCamera();
  if (!opening || S.reduced) {
    if (!S.revealed || S.reduced) S.map.jumpTo(camera); else S.map.easeTo({ ...camera, duration: 850 });
    revealOnce(); placeMarkers(true);
    return;
  }
  // The trip so far draws first; the plan ahead appears after it.
  const pastLegs = S.trip.orderedLegs.filter(l => S.trip.eventById(l.eventId)?.category === 'past');
  const futureIds = S.trip.legs.filter(l => !pastLegs.includes(l)).map(l => l.id);
  const settle = () => { S.routes.hide([]); placeMarkers(true); };
  const job = S.jobs.start(settle, () => { S.map.jumpTo(camera); settle(); });
  S.map.jumpTo(camera);
  revealOnce();
  placeMarkers(false);
  S.routes.hide(futureIds);
  (async () => {
    if (pastLegs.length) {
      // trace() hides and restores its own legs; keep the future hidden during it.
      const A = window.JOURNEY_ATLAS_ARRIVAL;
      if (A) {
        const plan = { ...A.plan(pastLegs, leg => leg.lite.coords), duration: 3000, arrivalHold: 0 };
        const { styleFor } = await import('./base-map.js');
        const drawing = A.createDrawing({ map: S.map, plan, styleForSegment: styleFor });
        S.routes.hide([...futureIds, ...pastLegs.map(l => l.id)]);
        const cleanup = () => drawing?.destroy();
        job.cleanups.add(cleanup);
        await S.jobs.play(job, 3000, t => drawing?.draw(A.frame(plan, t, { drawLines: false })));
        cleanup(); job.cleanups.delete(cleanup);
      }
    }
    if (job.cancelled) return;
    S.routes.hide([]);
    placeMarkers(true);
    S.jobs.finish(job);
  })();
}
export function selectEvent(id, { animate = true } = {}) {
  if (!S?.map) return;
  const event = S.trip.eventById(id);
  if (!event) return;
  S.jobs.cancel();
  S.selected = id;
  S.routes.select(id, false);
  renderEvent(event);
  placeMarkers(true);
  const destination = cameraFor(S.map, S.ctx, S.trip.eventFrame(event), { extra: 40 });
  if (!animate || S.reduced || !event.legs.length) {
    if (destination) { if (!S.revealed || S.reduced || !animate) S.map.jumpTo(destination); else S.map.easeTo({ ...destination, duration: 900 }); }
    revealOnce(); S.routes.select(id, true);
    return;
  }
  revealOnce();
  const job = S.jobs.start(() => S.routes.select(id, true), () => { if (destination) S.map.jumpTo(destination); S.routes.select(id, true); });
  (async () => {
    await S.jobs.ease(job, cameraFor(S.map, S.ctx, { bounds: S.trip.routeFrame(event.legs), maxZoom: 12.5 }, { extra: 50 }), 850);
    await trace(S, S.routes, job, event.legs, 1500);
    await S.jobs.sleep(job, 250);
    await S.jobs.ease(job, destination, 900);
    if (job.cancelled) return;
    S.jobs.finish(job); S.routes.select(id, true);
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
export function legendSwatch(mode) {
  if (mode === 'tbd') return '<svg width="64" height="16" viewBox="0 0 64 16"><path d="M5 8h54" stroke="#0072b2" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="0.1 7"/></svg>';
  const m = MODES[mode], dash = m.dash ? m.dash.map(v => v * 4).join(' ') : '';
  return `<svg width="64" height="16" viewBox="0 0 64 16"><path d="M5 5h54" stroke="#fffef8" stroke-width="7"/><path d="M5 5h54" stroke="${m.color}" stroke-width="4" ${dash ? `stroke-dasharray="${dash}"` : ''}/><path d="M5 12h54" stroke="${m.color}" stroke-opacity=".42" stroke-width="2.8" ${dash ? `stroke-dasharray="${dash}"` : ''}/></svg>`;
}
export function legendExtras() {
  return [
    { swatch: '<svg width="44" height="24" viewBox="0 0 44 24"><path d="M4 8h36" stroke="#0072b2" stroke-width="4"/><path d="M4 17h36" stroke="#0072b2" stroke-opacity=".42" stroke-width="2.8"/></svg>', label: 'Past · locked in', note: 'solid = travelled; lighter = planned with dates' },
    { swatch: '<span style="display:inline-block;padding:3px 8px;border-radius:10px;background:#1f2b2f;color:#fff;font-size:12px;font-weight:650">Now</span>', label: 'Now / last confirmed', note: 'from itinerary dates only' },
    { swatch: '<svg width="44" height="24" viewBox="0 0 44 24"><circle cx="22" cy="12" r="9" fill="#aab" stroke="#fff" stroke-width="2.5"/></svg>', label: 'Latest photo', note: 'its own capture date and place' }
  ];
}
export function destroy() {
  if (!S) return;
  S.jobs?.cancel();
  S.offInput?.(); S.offStops?.();
  S.nowMarker?.remove(); S.latestMarker?.remove(); S.map?.remove();
  S.container.classList.remove('o8');
  S = null;
}
