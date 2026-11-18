// Shared base for options 6–8: a warm, light real map (O23), the current
// viewer's route styles (mode colours, dash patterns, white casing, TBD dotted
// without casing), stops, selection styling, and the viewer's own arrival
// trace (dist/assets/arrival-chapter.js) for leg animation with a still camera.
import { MODES, clock, boundsCenter } from '../data.js';
import { createMap, reveal, cameraFor, onUserInput, loadScript, OFM } from './common.js';

const ARRIVAL = new URL('../../../dist/assets/arrival-chapter.js', import.meta.url).href;
const CASING = '#fffef8';
export const BASE_CSS = `
.arrival-trace { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; }
.lab-base-popup .maplibregl-popup-content { border-radius:14px; padding:10px 12px; font:13px/1.35 var(--font-ui); color:#1f2b2f; box-shadow:0 12px 30px rgba(20,30,35,.22); max-width:240px; }
.lab-base-popup .maplibregl-popup-close-button { width:32px; height:32px; font-size:18px; }
.lab-base-popup small { display:block; color:#59686b; font-size:12px; }
.lab-base-popup .lab-choice { display:block; width:100%; min-height:44px; margin-top:4px; border:1px solid #d9d2c3; border-radius:10px; background:transparent; text-align:left; padding:6px 10px; font:inherit; cursor:pointer; }
`;

// Warm paper land, soft blue water, quiet roads; town names wait for city zoom.
export function paperStyle(map) {
  const paint = (id, prop, value) => { if (map.getLayer(id)) try { map.setPaintProperty(id, prop, value); } catch (e) { /* type mismatch */ } };
  for (const layer of map.getStyle().layers) {
    const id = layer.id;
    if (layer.type === 'background') paint(id, 'background-color', '#f4f1ea');
    else if (id === 'water') paint(id, 'fill-color', '#c6dbe4');
    else if (layer.type === 'fill' && /park|wood|glacier|ice/.test(id)) { paint(id, 'fill-color', '#dfe7d2'); paint(id, 'fill-opacity', 0.6); }
    else if (layer.type === 'fill' && /building/.test(id)) paint(id, 'fill-color', '#e6e0d4');
    else if (layer.type === 'line' && /boundary/.test(id)) paint(id, 'line-color', '#c8bfae');
    else if (layer.type === 'line' && /waterway/.test(id)) paint(id, 'line-color', '#aecbd8');
    else if (layer.type === 'symbol') {
      if (/poi|shield|highway-name|label_other|label_state|water_name_line|airport/.test(id)) map.setLayoutProperty(id, 'visibility', 'none');
      else {
        paint(id, 'text-color', /country/.test(id) ? '#8f948f' : '#4f5d61'); paint(id, 'text-halo-color', '#f8f6f0'); paint(id, 'text-halo-width', 1.4);
        if (/label_(city|town|village)/.test(id)) map.setLayerZoomRange(id, 8.5, 24);
      }
    }
  }
}

export async function createBaseMap(container, trip, options = {}) {
  const [map] = await Promise.all([
    createMap(container, { style: OFM('positron'), center: boundsCenter(trip.bounds), zoom: 4, maxZoom: 17, dragRotate: false, pitchWithRotate: false, touchPitch: false, ...options }, { onStyle: paperStyle }),
    window.JOURNEY_ATLAS_ARRIVAL ? null : loadScript(ARRIVAL)
  ]);
  map.touchZoomRotate.disableRotation();
  return map;
}

const width = base => ['interpolate', ['linear'], ['zoom'], 4, base * 0.62, 9, base, 14, base * 1.45];
export function styleFor(leg) {
  const m = MODES[leg.mode] || { color: '#006f92', width: 4.7, dash: null };
  return leg.tbd ? { color: m.color, width: 4, dash: [0.1, 2] } : { color: m.color, width: m.width, dash: m.dash, casing: CASING, casingWidth: m.width + 3 };
}

// Routes and stops in the current viewer style. `state` drives the optional
// planning look (past solid, future locked lighter, TBD dotted).
export function addRoutes(map, trip, { planning = false } = {}) {
  const before = map.getStyle().layers.find(layer => /label_(other|village|town)/.test(layer.id))?.id;
  const stateOf = leg => (trip.eventById(leg.eventId)?.category) || 'past';
  const routeData = () => ({ type: 'FeatureCollection', features: trip.legs.map(leg => ({ type: 'Feature', properties: { id: leg.id, mode: leg.mode, tbd: leg.tbd, eventId: leg.eventId || '', state: stateOf(leg) }, geometry: { type: 'LineString', coordinates: leg.lite.coords } })) });
  map.addSource('lab-routes', { type: 'geojson', data: routeData() });
  for (const mode of trip.modes) {
    const m = MODES[mode];
    map.addLayer({ id: `lab-case-${mode}`, type: 'line', source: 'lab-routes', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': CASING, 'line-width': width(m.width + 3), 'line-opacity': 0.92 } }, before);
    map.addLayer({ id: `lab-line-${mode}`, type: 'line', source: 'lab-routes', layout: { 'line-cap': m.dash && m.dash[0] < 0.5 ? 'round' : 'butt', 'line-join': 'round' }, paint: { 'line-color': m.color, 'line-width': width(m.width), ...(m.dash ? { 'line-dasharray': m.dash } : {}) } }, before);
  }
  map.addLayer({ id: 'lab-tbd', type: 'line', source: 'lab-routes', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['match', ['get', 'mode'], ...Object.entries(MODES).flatMap(([k, v]) => [k, v.color]), '#71878a'], 'line-width': width(4.2), 'line-dasharray': [0.1, 2], 'line-opacity': 0.85 } }, before);
  let byPlace = new Map();
  const stopData = () => {
    byPlace = new Map();
    for (const event of trip.events) {
      if (!event.place) continue;
      const entry = byPlace.get(event.place.id) || { place: event.place, events: [], tbd: true, past: false };
      entry.events.push(event); entry.tbd = entry.tbd && event.tbd; entry.past = entry.past || event.category === 'past';
      byPlace.set(event.place.id, entry);
    }
    return { type: 'FeatureCollection', features: [...byPlace.values()].map(entry => ({ type: 'Feature', properties: { placeId: entry.place.id, name: entry.place.name, tbd: entry.tbd, state: entry.past ? 'past' : entry.tbd ? 'tbd' : 'locked', events: entry.events.map(e => e.id).join(' ') }, geometry: { type: 'Point', coordinates: [entry.place.lng, entry.place.lat] } })) };
  };
  map.addSource('lab-stops', { type: 'geojson', data: stopData() });
  map.addLayer({ id: 'lab-stop', type: 'circle', source: 'lab-stops', paint: {
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 3.6, 10, 6], 'circle-color': ['case', ['get', 'tbd'], '#fffdf8', planning ? ['case', ['==', ['get', 'state'], 'past'], '#1f2b2f', '#fffdf8'] : '#1f2b2f'],
    'circle-stroke-color': ['case', ['get', 'tbd'], '#71878a', planning ? ['case', ['==', ['get', 'state'], 'past'], '#fffdf8', '#1f2b2f'] : '#fffdf8'], 'circle-stroke-width': 1.8 } });
  map.addLayer({ id: 'lab-stop-sel', type: 'circle', source: 'lab-stops', filter: ['==', ['get', 'placeId'], ''], paint: { 'circle-radius': 12, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': '#d4512c', 'circle-stroke-width': 3 } });
  map.addLayer({ id: 'lab-stop-hit', type: 'circle', source: 'lab-stops', paint: { 'circle-radius': 22, 'circle-color': '#000', 'circle-opacity': 0.01 } });
  map.addLayer({ id: 'lab-stop-label', type: 'symbol', source: 'lab-stops', layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Bold'], 'text-size': 12.5, 'text-variable-anchor': ['top', 'bottom', 'left', 'right'], 'text-radial-offset': 0.85, 'text-optional': true },
    paint: { 'text-color': ['case', ['get', 'tbd'], '#59686b', '#1f2b2f'], 'text-halo-color': '#fffdf8', 'text-halo-width': 1.8 } });
  const state = { selected: null, landed: false, hidden: new Set(), visibleStates: { past: true, locked: true, tbd: true }, progress: null };
  function apply() {
    const hidden = [...state.hidden];
    const notHidden = hidden.length ? ['!', ['in', ['get', 'id'], ['literal', hidden]]] : true;
    const shown = ['match', ['get', 'state'], ...Object.entries(state.visibleStates).flatMap(([k, v]) => [k, v]), true];
    const sel = state.selected;
    // `progress`: the events reached so far (Photo roll) stay full, later ones quiet.
    const reached = state.progress ? ['in', ['get', 'eventId'], ['literal', state.progress]] : null;
    const pick = (a, b, c) => (sel ? ['case', ['==', ['get', 'eventId'], sel], a, b] : reached ? ['case', reached, a, b] : c);
    // Planning look: future legs locked in are lighter and thinner; TBD stays dotted.
    const future = planning ? ['case', ['==', ['get', 'state'], 'past'], 1, 0.42] : 1;
    for (const mode of trip.modes) {
      const filter = ['all', ['==', ['get', 'mode'], mode], ['!', ['get', 'tbd']], notHidden, shown];
      map.setFilter(`lab-case-${mode}`, filter); map.setFilter(`lab-line-${mode}`, filter);
      map.setPaintProperty(`lab-line-${mode}`, 'line-opacity', pick(1, 0.32, planning ? future : 1));
      map.setPaintProperty(`lab-case-${mode}`, 'line-opacity', pick(0.95, 0.25, 0.9));
      map.setPaintProperty(`lab-line-${mode}`, 'line-width', planning && !sel ? ['case', ['==', ['get', 'state'], 'past'], width(MODES[mode].width), width(MODES[mode].width * 0.7)] : width(MODES[mode].width));
    }
    map.setFilter('lab-tbd', ['all', ['get', 'tbd'], notHidden, shown]);
    map.setPaintProperty('lab-tbd', 'line-opacity', pick(1, 0.3, 0.85));
    map.setFilter('lab-stop', ['match', ['get', 'state'], ...Object.entries(state.visibleStates).flatMap(([k, v]) => [k, v]), true]);
    map.setFilter('lab-stop-label', ['match', ['get', 'state'], ...Object.entries(state.visibleStates).flatMap(([k, v]) => [k, v]), true]);
    const place = sel && state.landed ? trip.eventById(sel)?.place?.id || '' : '';
    map.setFilter('lab-stop-sel', ['==', ['get', 'placeId'], place]);
  }
  apply();
  return {
    state, apply,
    select(id, landed) { state.selected = id; state.landed = landed; apply(); },
    hide(ids) { state.hidden = new Set(ids); apply(); },
    progress(ids) { state.progress = ids; apply(); },
    refresh() { map.getSource('lab-routes').setData(routeData()); map.getSource('lab-stops').setData(stopData()); apply(); },
    show(states) { Object.assign(state.visibleStates, states); apply(); },
    get stopsByPlace() { return byPlace; }
  };
}

// Stop clicks: a single visit selects it; a repeat place offers its visits.
export function bindStopClicks(map, trip, onPick) {
  let popup = null;
  map.on('click', 'lab-stop-hit', event => {
    const feature = event.features?.[0];
    if (!feature) return;
    const ids = feature.properties.events.split(' ').filter(Boolean);
    popup?.remove();
    if (ids.length === 1) { onPick(ids[0]); return; }
    popup = new maplibregl.Popup({ className: 'lab-base-popup', offset: 14 }).setLngLat(feature.geometry.coordinates)
      .setHTML(`<b>${feature.properties.name}</b>${ids.map(id => { const e = trip.eventById(id); return `<button type="button" class="lab-choice" data-event="${id}">${trip.eventWord} ${e.number} · ${e.title.replace(/</g, '&lt;')}<small>${e.date}</small></button>`; }).join('')}`).addTo(map);
    popup.getElement().addEventListener('click', clickEvent => { const button = clickEvent.target.closest('[data-event]'); if (button) { popup.remove(); onPick(button.dataset.event); } });
  });
  map.on('mouseenter', 'lab-stop-hit', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'lab-stop-hit', () => { map.getCanvas().style.cursor = ''; });
  return () => popup?.remove();
}

// Cancellable sequences: settle (keep the camera the viewer chose) or final (jump to the end).
export function jobs(S) {
  function start(settle, final) {
    cancel();
    const job = { cancelled: false, clocks: new Set(), cleanups: new Set(), settle, final };
    S.job = job; S.ctx.onPlayState(true);
    return job;
  }
  function cancel(mode) {
    const job = S?.job;
    if (!job) return;
    job.cancelled = true; job.clocks.forEach(c => c.cancel()); job.cleanups.forEach(f => f()); S.job = null; S.map.stop();
    if (mode === 'settle') job.settle();
    if (mode === 'final') job.final();
    S.ctx.onPlayState(false);
  }
  function finish(job) { if (S?.job === job) { S.job = null; S.ctx.onPlayState(false); } }
  function moved(duration) {
    return new Promise(resolve => {
      let done = false;
      const end = () => { if (!done) { done = true; clearTimeout(timer); S?.map?.off('moveend', end); resolve(); } };
      const timer = setTimeout(end, duration + 400);
      S.map.on('moveend', end);
    });
  }
  const ease = (job, camera, duration) => { if (job.cancelled || !camera) return Promise.resolve(); S.map.easeTo({ ...camera, duration, essential: true }); return moved(duration); };
  const play = (job, duration, onFrame) => new Promise(resolve => {
    if (job.cancelled) return resolve();
    const c = clock(duration, onFrame, () => { job.clocks.delete(c); resolve(); }, { perf: S.ctx.perf });
    job.clocks.add(c);
  });
  const sleep = (job, ms) => new Promise(resolve => setTimeout(resolve, job.cancelled ? 0 : ms));
  return { start, cancel, finish, ease, play, sleep };
}

// The viewer's arrival trace: shared plan, interpolation and canvas, camera still.
export function trace(S, routes, job, legs, duration) {
  const A = window.JOURNEY_ATLAS_ARRIVAL;
  if (!A || !legs.length || job.cancelled) return Promise.resolve();
  const plan = { ...A.plan(legs, leg => leg.lite.coords), duration, arrivalHold: 0 };
  const drawing = A.createDrawing({ map: S.map, plan, styleForSegment: styleFor });
  if (!drawing) return Promise.resolve();
  routes.hide(legs.map(leg => leg.id));
  const cleanup = () => { drawing.destroy(); routes.hide([]); job.cleanups.delete(cleanup); };
  job.cleanups.add(cleanup);
  return S.jobs.play(job, duration, t => drawing.draw(A.frame(plan, t, { drawLines: false }))).then(cleanup);
}

export { reveal, cameraFor, onUserInput };
