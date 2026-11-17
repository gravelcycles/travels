// Map Lab shell: option + trip switchers, stop picker, Replay/Skip, reduced
// motion and shareable URL state (?option=3&trip=…&event=…&motion=reduced).
import { TRIPS, loadTrip, MODES, modeOf, icon, escapeHtml } from './data.js';

const OPTIONS = {
  1: () => import('./options/01-globe.js'),
  2: () => import('./options/02-transit-map.js'),
  3: () => import('./options/03-ink-atlas.js'),
  4: () => import('./options/04-space-time.js'),
  5: () => import('./options/05-follow-cam.js')
};
const $ = id => document.getElementById(id);
const html = document.documentElement;
const params = new URLSearchParams(location.search);
const clampOption = value => (Number(value) >= 1 && Number(value) <= 5 ? Number(value) : 1);

const state = {
  option: clampOption(params.get('option')),
  trip: TRIPS.some(t => t.id === params.get('trip')) ? params.get('trip') : TRIPS[0].id,
  event: params.get('event') || null,
  reduced: html.dataset.reduced === '1',
  // Light by default (O23); dark only when chosen.
  mode: params.get('mode') === 'dark' ? 'dark' : 'light'
};
let trip = null, mod = null, playing = false, token = 0;
const lab = window.__mapLab = { frames: [], playing: false, ready: false, option: state.option, log: [] };

function writeUrl() {
  const next = new URLSearchParams();
  next.set('option', state.option);
  next.set('trip', state.trip);
  if (state.event) next.set('event', state.event);
  if (state.reduced) next.set('motion', 'reduced');
  if (state.mode === 'dark' && supportsDark()) next.set('mode', 'dark');
  const url = `${location.pathname}?${next}`;
  // Replace, never push: an unchanged view writes nothing (O20).
  if (url !== location.pathname + location.search) history.replaceState(null, '', url);
}

function insets() {
  const top = document.querySelector('.lab-top').getBoundingClientRect().bottom + 10;
  const dockTop = document.querySelector('.lab-dock').getBoundingClientRect().top;
  const panel = $('slot-panel');
  const panelTop = panel.childElementCount ? panel.getBoundingClientRect().top : dockTop;
  const tools = $('slot-tools');
  const toolsWidth = tools.childElementCount && innerWidth > 760 ? tools.getBoundingClientRect().width + 16 : 0;
  return { top, bottom: innerHeight - Math.min(dockTop, panelTop) + 10, left: 16, right: 16 + toolsWidth };
}

function supportsDark(module = mod) { return Boolean(module?.meta?.modes?.includes('dark')); }
const ctx = {
  slots: { tools: $('slot-tools'), panel: $('slot-panel') },
  mode: 'light',
  insets,
  isPhone: () => matchMedia('(max-width: 760px)').matches,
  onPlayState: value => setPlaying(value),
  onEventPicked: id => select(id),
  onOverviewPicked: () => overview(false),
  // The option already shows this stop (e.g. after scrubbing); sync the chrome only.
  onEventShown: id => { if (id === state.event || (id && !trip?.eventById(id))) return; state.event = id || null; writeUrl(); updateChrome(); },
  perf: ms => { if (lab.frames.length < 20000) lab.frames.push(ms); }
};

function setPlaying(value) {
  playing = Boolean(value);
  lab.playing = playing;
  const button = $('play-button');
  button.toggleAttribute('data-playing', playing);
  button.setAttribute('aria-label', playing ? 'Skip' : 'Replay');
  button.title = playing ? 'Skip' : 'Replay';
}

function status(text, sticky = false) {
  const el = $('lab-status');
  el.textContent = text || '';
  el.toggleAttribute('data-show', Boolean(text));
  if (text && !sticky) setTimeout(() => { if (el.textContent === text) status(''); }, 2400);
}

// ------------------------------------------------------------ chrome
function populateTrips() {
  for (const select of [$('trip-select'), $('trip-select-more')]) {
    select.replaceChildren(...TRIPS.map(t => new Option(t.label, t.id, false, t.id === state.trip)));
    select.value = state.trip;
  }
}
function updateOptionButtons() {
  document.querySelectorAll('.lab-options button').forEach(button => {
    button.setAttribute('aria-pressed', String(Number(button.dataset.option) === state.option));
  });
}
function syncModeButtons() {
  const offered = supportsDark(), dark = offered && state.mode === 'dark';
  $('mode-button').hidden = !offered;
  $('mode-row-more').hidden = !offered;
  $('mode-button').setAttribute('aria-pressed', String(dark));
  $('mode-button').title = dark ? 'Dark map is on' : 'Dark map';
  $('mode-button-more').setAttribute('aria-pressed', String(dark));
  $('mode-button-more').textContent = dark ? 'On' : 'Off';
}
function syncMotionButtons() {
  $('motion-button').setAttribute('aria-pressed', String(state.reduced));
  $('motion-button').title = state.reduced ? 'Reduced motion is on' : 'Reduce motion';
  $('motion-button-more').setAttribute('aria-pressed', String(state.reduced));
  $('motion-button-more').textContent = state.reduced ? 'On' : 'Off';
}
function eventKicker(event) {
  const date = event.date.replace(/^TBD · /, '');
  return `${event.tbd ? '<span class="lab-tbd">TBD</span>' : ''}${escapeHtml(`${trip.eventWord} ${event.number}${date ? ` · ${date}` : ''}`)}`;
}
function updateChrome() {
  if (!trip) return;
  const event = state.event && trip.eventById(state.event);
  const index = event ? trip.eventIndex.get(event.id) : -1;
  $('event-kicker').innerHTML = event ? eventKicker(event) : escapeHtml(trip.title);
  $('event-title').textContent = event ? event.title : `Whole trip · ${trip.events.length} ${trip.eventsWord}`;
  $('event-button').setAttribute('aria-label', `${event ? `${trip.eventWord} ${event.number}: ${event.title}` : 'Whole trip'}. Choose a ${trip.eventWord.toLowerCase()}`);
  $('prev-button').disabled = index < 0;
  $('next-button').disabled = index >= trip.events.length - 1;
  $('prev-button').setAttribute('aria-label', index > 0 ? `Previous ${trip.eventWord.toLowerCase()}: ${trip.events[index - 1].title}` : 'Whole trip');
  $('next-button').setAttribute('aria-label', index < trip.events.length - 1 ? `Next ${trip.eventWord.toLowerCase()}: ${trip.events[index + 1].title}` : 'Last stop');
  $('overview-button').disabled = !event;
  document.querySelector('.lab-dock').removeAttribute('data-loading');
  $('stops-heading').textContent = trip.city ? 'Stops' : 'Days';
}
function renderStopList() {
  const list = $('stop-list');
  const row = (id, num, name, date, meta, current, tbd) => `<li><button type="button" data-event="${escapeHtml(id)}" aria-current="${current}">
    <span class="lab-stop-num">${escapeHtml(num)}</span>
    <span><span class="lab-stop-name">${escapeHtml(name)}</span><span class="lab-stop-date">${tbd ? '<span class="lab-tbd">TBD</span>' : ''}${escapeHtml(date)}</span></span>
    <span class="lab-stop-meta">${meta}</span></button></li>`;
  list.innerHTML = row('', '', 'Whole trip', `${trip.events.length} ${trip.eventsWord}`, '', !state.event, false) +
    trip.events.map(event => row(event.id, event.number, event.title, event.date.replace(/^TBD · /, ''),
      `${event.legs.length ? escapeHtml(event.legs.map(l => modeOf(l.mode).label).filter((v, i, a) => a.indexOf(v) === i).join(' · ')) : ''}${event.photos.length ? ` ${icon('photo', { size: 14 })}${event.photos.length}` : ''}`,
      state.event === event.id, event.tbd)).join('');
}
function defaultSwatch(mode) {
  const m = modeOf(mode), dash = (m.dash || []).map(v => v * 3).join(' ');
  return `<svg width="64" height="14" viewBox="0 0 64 14" aria-hidden="true"><path d="M4 7h56" stroke="${mode === 'tbd' ? '#71878a' : m.color}" stroke-width="${mode === 'tbd' ? 3 : 4}" stroke-linecap="round" ${mode === 'tbd' ? 'stroke-dasharray="0.1 6"' : dash ? `stroke-dasharray="${dash}"` : ''}/></svg>`;
}
function renderKey() {
  const meta = mod?.meta || {};
  const rows = trip.modes.map(mode => ({ swatch: mod?.legendSwatch?.(mode) || defaultSwatch(mode), label: MODES[mode].label, note: MODES[mode].cue }));
  if (trip.hasTbd) rows.push({ swatch: mod?.legendSwatch?.('tbd') || defaultSwatch('tbd'), label: 'Unconfirmed (TBD)', note: 'dotted, no casing' });
  rows.push(...(mod?.legendExtras?.(trip) || []));
  if (!trip.located.length) rows.push({ swatch: '', label: 'No located photos', note: 'This trip shows no photo markers.' });
  $('key-list').style.setProperty('--key-bg', meta.keyBackground || 'transparent');
  $('key-list').innerHTML = rows.map(r => `<li><span class="lab-key-swatch">${r.swatch}</span><span>${escapeHtml(r.label)}<small>${escapeHtml(r.note || '')}</small></span></li>`).join('');
}
function renderAbout() {
  const meta = mod?.meta;
  if (!meta) return;
  $('about-heading').textContent = `${meta.number} · ${meta.name}`;
  const list = items => `<ul>${items.map(item => `<li>${item}</li>`).join('')}</ul>`;
  $('about-body').innerHTML = `<p>${meta.tagline}</p>
    <h3>What is new</h3>${list(meta.whatsNew)}
    <h3>Keeps</h3>${list(meta.keeps)}
    <h3>Deliberate departures</h3>${list(meta.departures.map(d => `<span class="lab-break">${d}</span>`))}
    <h3>Phone</h3><p>${meta.phone}</p>`;
}
function openSheet(id) {
  document.querySelectorAll('dialog[open]').forEach(d => d.close());
  if (id === 'stops-sheet') renderStopList();
  if (id === 'key-sheet') renderKey();
  if (id === 'about-sheet') renderAbout();
  const sheet = $(id);
  sheet.showModal();
  if (id === 'stops-sheet') sheet.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'center' });
}

// ------------------------------------------------------------ actions
function select(id, { animate = true } = {}) {
  if (!trip?.eventById(id) || !mod) return;
  state.event = id;
  writeUrl();
  updateChrome();
  mod.selectEvent(id, { animate });
}
function overview(opening) {
  if (!mod) return;
  state.event = null;
  writeUrl();
  updateChrome();
  mod.showOverview({ opening });
}
function step(delta) {
  if (!trip) return;
  const index = state.event ? trip.eventIndex.get(state.event) : -1;
  const next = index + delta;
  if (next < 0) { if (index >= 0) overview(false); return; }
  if (next >= trip.events.length) return;
  select(trip.events[next].id);
}

async function mountCurrent(entry) {
  const mine = ++token;
  lab.ready = false;
  setPlaying(false);
  let module;
  try {
    module = await OPTIONS[state.option]();
  } catch (error) {
    console.error(error); status(`Could not load option ${state.option}`, true); return;
  }
  if (mine !== token) return;
  if (mod) { try { mod.destroy(); } catch (error) { console.error(error); } }
  mod = null;
  $('slot-tools').replaceChildren(); $('slot-panel').replaceChildren();
  const stage = $('stage');
  stage.replaceChildren();
  const root = document.createElement('div');
  root.className = 'lab-option-root';
  stage.append(root);
  ctx.mode = supportsDark(module) && state.mode === 'dark' ? 'dark' : 'light';
  html.dataset.theme = ctx.mode;
  lab.option = state.option; lab.frames = []; lab.mode = ctx.mode;
  try {
    await module.mount(root, trip, ctx);
  } catch (error) {
    console.error(error); status(`Option ${state.option} could not start: ${error.message}`, true); return;
  }
  if (mine !== token) { module.destroy(); return; }
  mod = module;
  syncModeButtons();
  module.setReducedMotion(state.reduced);
  const event = state.event && trip.eventById(state.event);
  if (!event) state.event = null;
  writeUrl();
  updateChrome();
  // 'direct' (shared link) and 'static' (appearance switch) land without animation.
  if (event) module.selectEvent(event.id, { animate: entry !== 'direct' && entry !== 'static' });
  else module.showOverview({ opening: entry !== 'static' });
  lab.ready = true;
}

async function loadAndMount(entry) {
  const mine = ++token;
  document.querySelector('.lab-dock').setAttribute('data-loading', '');
  const slow = setTimeout(() => status('Loading trip…', true), 700);
  try {
    trip = await loadTrip(state.trip);
  } catch (error) {
    clearTimeout(slow); console.error(error); status(`Could not load trip: ${error.message}`, true); return;
  }
  clearTimeout(slow); status('');
  if (mine !== token) return;
  lab.trip = trip.id;
  await mountCurrent(entry);
}

// ------------------------------------------------------------ wiring
populateTrips();
updateOptionButtons();
syncMotionButtons();
document.querySelectorAll('.lab-options button').forEach(button => button.addEventListener('click', () => {
  const option = Number(button.dataset.option);
  if (option === state.option) return;
  state.option = option;
  html.dataset.option = option;
  updateOptionButtons();
  writeUrl();
  mountCurrent('replay');
}));
for (const select of [$('trip-select'), $('trip-select-more')]) select.addEventListener('change', () => {
  state.trip = select.value; state.event = null;
  populateTrips(); writeUrl();
  document.querySelectorAll('dialog[open]').forEach(d => d.close());
  loadAndMount('opening');
});
$('prev-button').addEventListener('click', () => step(-1));
$('next-button').addEventListener('click', () => step(1));
$('overview-button').addEventListener('click', () => overview(false));
$('play-button').addEventListener('click', () => {
  if (!mod) return;
  if (playing) { mod.skip?.(); setPlaying(false); return; }
  if (state.event) mod.playLeg(state.event); else mod.showOverview({ opening: true });
});
$('event-button').addEventListener('click', () => openSheet('stops-sheet'));
$('key-button').addEventListener('click', () => openSheet('key-sheet'));
$('about-button').addEventListener('click', () => openSheet('about-sheet'));
$('more-button').addEventListener('click', () => openSheet('more-sheet'));
$('key-button-more').addEventListener('click', () => openSheet('key-sheet'));
$('about-button-more').addEventListener('click', () => openSheet('about-sheet'));
const toggleMotion = () => {
  state.reduced = !state.reduced;
  if (state.reduced) html.dataset.reduced = '1'; else delete html.dataset.reduced;
  syncMotionButtons(); writeUrl();
  mod?.setReducedMotion(state.reduced);
  if (state.reduced && playing) { mod?.skip?.(); setPlaying(false); }
};
const toggleMode = () => {
  if (!supportsDark()) return;
  state.mode = state.mode === 'dark' ? 'light' : 'dark';
  writeUrl(); syncModeButtons();
  document.querySelectorAll('dialog[open]').forEach(d => d.close());
  mountCurrent('static');
};
$('mode-button').addEventListener('click', toggleMode);
$('mode-button-more').addEventListener('click', toggleMode);
$('motion-button').addEventListener('click', toggleMotion);
$('motion-button-more').addEventListener('click', toggleMotion);
$('stop-list').addEventListener('click', event => {
  const button = event.target.closest('button[data-event]');
  if (!button) return;
  $('stops-sheet').close();
  if (button.dataset.event) select(button.dataset.event); else overview(false);
});
document.querySelectorAll('dialog').forEach(dialog => {
  dialog.addEventListener('click', event => {
    if (event.target === dialog || event.target.closest('[data-close]')) dialog.close();
  });
});
document.addEventListener('keydown', event => {
  if (document.querySelector('dialog[open]') || event.target.closest?.('select, input, textarea') || event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.key === 'ArrowRight') { event.preventDefault(); step(1); }
  else if (event.key === 'ArrowLeft') { event.preventDefault(); step(-1); }
  else if (/^[1-5]$/.test(event.key)) document.querySelector(`.lab-options button[data-option="${event.key}"]`)?.click();
  else if (event.key === 'Home') overview(false);
});

loadAndMount(state.event ? 'direct' : 'opening');
