// Option 5 · Cinematic follow-cam. Terrain and 3D buildings, a chase camera
// behind a vehicle for each mode, a split-flap departure board announcing each
// leg, and photo cards popping up at their capture points as you pass.
import { MODES, modeOf, along, prefix, tracePlan, clock, ease, icon, escapeHtml, boundsCenter, bearing as bearingOf, fmtKm, fmtDuration, haversine, placeIcon } from '../data.js';
import { createMap, reveal, cameraFor, onUserInput, markerLayer, zoomToGroup, injectStyle, swatchSvg, OFM } from './common.js';

export const meta = {
  number: 5, name: 'Follow-cam', modes: ['light', 'dark'],
  get keyBackground() { return S?.dark ? '#111823' : '#f4f1ea'; },
  tagline: 'Each leg as a short film: a split-flap board announces it, the camera chases a train, bus, ferry or gondola across real terrain, and photos pop up where they were taken.',
  whatsNew: [
    'MapLibre terrain (AWS Terrain Tiles) with hillshade, sky and OpenFreeMap 3D buildings.',
    'Chase camera with smoothed heading and a zoom curve that lifts out for long legs and drops in at each station.',
    'Split-flap departure board per leg (mode · from → to · date · distance · duration · TBD status) and cinematic letterbox during travel.',
    'Photo cards pop up at their true capture points as the vehicle passes; places rise as labelled pins on arrival.'
  ],
  keeps: ['Real, light basemap and light controls by default (O23); a night drive is the optional dark mode.', 'Current transport colours and dash patterns with white casing; TBD dotted without casing.', 'Unselected overview; direct links land without animation; input interrupts; reduced motion shows the end state.', 'Board shows only real data: no invented times or platforms.'],
  departures: [
    'Optional dark map (night drive), offered only when chosen (O23); the board keeps dark split-flap tiles in both modes.',
    'Moving, rotating, pitched camera throughout travel (O09 holds the camera still; leg playback is 2.4–7.5 s per leg instead of 1.5 s per stop).',
    'The opening is a tilting drone reveal rather than a flat still trace (O06).',
    'Full leg geometry is not always visible while travelling (O09 asks for the whole leg in view).',
    'Whole-trip Replay re-runs the opening (O09).'
  ],
  phone: 'Strongest on a phone held upright: the chase view fills the screen and the board compresses to one title line and one detail line. Terrain and per-frame camera moves are the heaviest work of the five.'
};

let CASING = '#fffef8';
const NIGHT = { train: '#56c8ff', boat: '#3de8d8', bus: '#ffb54d', gondola: '#cda6ff', walk: '#e6edf2', car: '#ff806f', bike: '#66e8a2' };
const lineColor = mode => (S?.dark ? NIGHT[mode] : MODES[mode]?.color) || '#006f92';
const CSS = `
.o5 { background:#0c0f12; }
.o5-board { position:absolute; z-index:6; left:50%; top: calc(var(--safe-t) + 70px); transform: translateX(-50%); width: min(560px, calc(100% - 20px));
  background: #0d0f11; color:#f6d36b; border-radius: 12px; padding: 8px 10px; box-shadow: 0 10px 30px #0008, inset 0 0 0 1px #2a2d31;
  font: 600 15px/1 "JetBrains Mono", ui-monospace, Menlo, monospace; opacity:0; transform: translate(-50%, -8px); transition: opacity 260ms, transform 260ms; pointer-events:none; }
.o5-board.is-on { opacity:1; transform: translate(-50%, 0); }
.o5-row { display:flex; align-items:center; gap:8px; min-height: 30px; }
.o5-row + .o5-row { margin-top: 5px; }
.o5-mode { flex:none; display:grid; place-items:center; width:30px; height:30px; border-radius:6px; background:#1b1e22; color:#fff; }
.o5-flaps { display:flex; gap:2px; overflow:hidden; flex:1; min-width:0; }
.o5-flap { flex:none; width: 14px; height: 26px; display:grid; place-items:center; border-radius:3px; background: linear-gradient(#202328 0 49%, #15171a 51% 100%); color:#f8f4e6;
  box-shadow: inset 0 -1px 0 #0006; position:relative; font-size:15px; }
.o5-flap::after { content:''; position:absolute; left:0; right:0; top:50%; height:1px; background:#000a; }
.o5-flap.is-flip { animation: o5-flip 90ms linear; }
.o5-row-b .o5-flap { color:#f6d36b; width: 12px; height: 22px; font-size: 13px; }
.o5-status { flex:none; padding: 0 7px; height:22px; line-height:22px; border-radius:4px; font-size:12px; letter-spacing:.06em; background:#1b1e22; color:#9fe0a8; }
.o5-status.is-tbd { color:#f6a96b; border:1px dashed #f6a96b; line-height:20px; }
@keyframes o5-flip { 0% { transform: scaleY(1); } 50% { transform: scaleY(.15); } 100% { transform: scaleY(1); } }
.o5-letter { position:absolute; left:0; right:0; height:0; background:#000; z-index:4; pointer-events:none; transition: height 600ms cubic-bezier(.3,.1,.2,1); }
.o5-letter.top { top:0; } .o5-letter.bottom { bottom:0; }
.o5.is-travel .o5-letter { height: 7vh; }
.o5-vignette { position:absolute; inset:0; z-index:3; pointer-events:none; background: radial-gradient(ellipse at 50% 55%, transparent 55%, rgba(0,0,0,.42) 100%); opacity:0; transition: opacity 600ms; }
.o5.is-travel .o5-vignette { opacity:1; }
.o5-vehicle { width:46px; height:46px; display:grid; place-items:center; border-radius:50%; background:#fffef8; color:var(--c,#0072b2); box-shadow: 0 0 0 3px #d4512c, 0 6px 16px #0007; pointer-events:none; }
.o5-photo { width:44px; height:44px; display:grid; place-items:center; }
.o5-photo .o5-chip { position:relative; width:30px; height:30px; border-radius:8px; background:#223 center/cover; box-shadow: 0 0 0 2px #fffef8, 0 3px 8px #0006; }
.o5-photo .o5-n { position:absolute; right:-10px; top:-8px; min-width:20px; height:20px; padding:0 5px; border-radius:10px; background:#d4512c; color:#fff; font:700 12px/20px var(--font-ui); }
.o5-photo.is-card { width:auto; height:auto; }
.o5-photo.is-card .o5-chip { width:96px; height:72px; border-radius:10px; box-shadow: 0 0 0 3px #fffef8, 0 10px 24px #0007; }
.o5-photo .o5-time { display:none; }
.o5-photo.is-card .o5-time { display:block; position:absolute; left:0; right:0; bottom:-24px; text-align:center; font:600 12px/20px var(--font-ui); color:#fff; text-shadow:0 1px 3px #000; white-space:nowrap; }
.o5-photo.is-dim { opacity:.6; }
.o5-pop { pointer-events:none; }
.o5-pop .o5-pop-in { width:120px; border-radius:12px; overflow:hidden; background:#fffef8; box-shadow:0 12px 30px #0008; transform-origin: 50% 100%; animation: o5-pop 420ms cubic-bezier(.2,.9,.25,1.25) both; transition: transform 420ms, opacity 420ms; }
.o5-pop .o5-pop-img { height:84px; background:#ccc center/cover; }
.o5-pop .o5-pop-cap { padding:5px 8px; font:600 12px/1.2 var(--font-ui); color:#1f2b2f; }
.o5-pop.is-gone .o5-pop-in { transform: scale(.2); opacity:0; }
@keyframes o5-pop { from { transform: translateY(16px) scale(.4); opacity:0; } }
.o5-pin { display:flex; flex-direction:column; align-items:center; min-width:44px; }
.o5-pin .o5-pin-label { display:flex; align-items:center; gap:5px; padding: 6px 10px; border-radius: 16px; background:#fffef8; color:#1f2b2f; box-shadow: 0 6px 16px #0005; font:600 13px/1 var(--font-ui); white-space:nowrap; max-width: 200px; overflow:hidden; text-overflow: ellipsis; }
.o5-pin .o5-pin-stem { width:2px; height:26px; background: linear-gradient(#fffef8, #fffef800); }
.o5-pin.is-count .o5-pin-label { background:#1f2b2f; color:#fffef8; }
.o5-pin.is-rise .o5-pin-label { animation: o5-rise 420ms cubic-bezier(.2,.9,.3,1.2) both; animation-delay: var(--d,0ms); }
@keyframes o5-rise { from { transform: translateY(20px); opacity:0; } }
.o5-hidden-markers .o5-photo, .o5-hidden-markers .o5-pin { opacity:0 !important; pointer-events:none; }
.o5-photo, .o5-pin { transition: opacity 300ms; }
:root[data-reduced] .o5 *, :root[data-reduced] .o5-board { animation:none !important; transition:none !important; }
/* Light default (O23): light board panel, paper letterbox, no darkening vignette. */
.o5-light .o5-board { background:#fffdf8; color:#a06a00; box-shadow: 0 10px 30px rgba(20,30,35,.2), inset 0 0 0 1px #e4ddd0; }
.o5-light .o5-status { background:#f1eee7; color:#2a7a3b; }
.o5-light .o5-status.is-tbd { color:#a85c00; border-color:#a85c00; background:transparent; }
.o5-light .o5-letter { background:#f4f1ea; }
.o5-light .o5-vignette { display:none; }
.o5-card .maplibregl-popup-content { border-radius:14px; padding:10px 12px; font:13px/1.35 var(--font-ui); color:#1f2b2f; box-shadow:0 12px 30px #0006; max-width:240px; }
.o5-card .maplibregl-popup-close-button { width:32px; height:32px; font-size:18px; }
.o5-card .o5-card-img { width:200px; height:140px; border-radius:10px; background:#ccc center/cover; margin-bottom:6px; }
.o5-card small { display:block; color:#59686b; font-size:12px; }
.o5-card .o5-choice { display:block; width:100%; min-height:44px; margin-top:4px; border:1px solid #d9d2c3; border-radius:10px; background:transparent; text-align:left; padding:6px 10px; font:inherit; cursor:pointer; }
@media (max-width: 760px) {
  .o5-board { top: calc(var(--safe-t) + 64px); padding: 6px 8px; }
  .o5-flap { width: 12px; height: 24px; font-size: 13px; }
  .o5-row-b .o5-flap { width: 11px; height: 20px; font-size: 12px; }
  .o5-mode { width: 26px; height: 26px; }
}
`;

let S = null;

export async function mount(container, trip, ctx) {
  injectStyle('lab-o5', CSS);
  container.classList.add('o5');
  S = { trip, ctx, container, reduced: false, selected: null, landed: false, job: null, revealed: false, pops: [], timers: new Set(), dark: ctx.mode === 'dark' };
  CASING = S.dark ? '#0b1220' : '#fffef8';
  container.classList.add(S.dark ? 'o5-dark' : 'o5-light');
  const mine = S;
  const map = await createMap(container, { style: OFM(S.dark ? 'dark' : 'liberty'), center: boundsCenter(trip.bounds), zoom: 4, maxZoom: 17.5, maxPitch: 78 }, { onStyle: styleMap });
  if (S !== mine) { map.remove(); return; }
  S.map = map;
  addLayers();
  for (const name of ['top', 'bottom']) { const bar = document.createElement('div'); bar.className = `o5-letter ${name}`; container.append(bar); }
  const vignette = document.createElement('div'); vignette.className = 'o5-vignette'; container.append(vignette);
  S.board = buildBoard(); container.append(S.board.el);
  S.vehicleEl = document.createElement('div');
  S.vehicleEl.className = 'o5-vehicle';
  S.vehicle = new maplibregl.Marker({ element: S.vehicleEl, pitchAlignment: 'viewport', rotationAlignment: 'viewport' }).setLngLat(boundsCenter(trip.bounds));
  S.photos = markerLayer(map, { radius: z => (z < 9 ? 50 : 84), className: 'o5-photo', render: renderPhoto, onClick: photoClick });
  S.places = markerLayer(map, { radius: 80, className: 'o5-pin', render: renderPin, onClick: placeClick, anchor: 'bottom' });
  S.photos.set(trip.located);
  S.places.set(trip.locatedPois);
  S.offInput = onUserInput(map, interrupt);
  const zoomGate = () => S?.places.hide(map.getZoom() < 8.5);
  map.on('zoomend', zoomGate); zoomGate();
  map.on('click', 'o5-stop-hit', event => stopClick(event));
  map.on('mouseenter', 'o5-stop-hit', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'o5-stop-hit', () => { map.getCanvas().style.cursor = ''; });
}

function styleMap(map) {
  const tiles = ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'];
  const attribution = 'Terrain: <a href="https://registry.opendata.aws/terrain-tiles/">Terrain Tiles</a> (Mapzen, AWS)';
  map.addSource('o5-dem', { type: 'raster-dem', tiles, tileSize: 256, encoding: 'terrarium', maxzoom: 12, attribution });
  map.addSource('o5-hs', { type: 'raster-dem', tiles, tileSize: 256, encoding: 'terrarium', maxzoom: 12 });
  const first = map.getStyle().layers.find(layer => layer.type === 'line' || layer.type === 'symbol')?.id;
  map.addLayer({ id: 'o5-hillshade', type: 'hillshade', source: 'o5-hs', paint: S.dark
    ? { 'hillshade-exaggeration': 0.55, 'hillshade-shadow-color': '#000000', 'hillshade-highlight-color': '#3b4c66', 'hillshade-accent-color': '#16202e' }
    : { 'hillshade-exaggeration': 0.45, 'hillshade-shadow-color': '#3d3a33', 'hillshade-highlight-color': '#fffaf0', 'hillshade-accent-color': '#5a5446' } }, first);
  try { map.setTerrain({ source: 'o5-dem', exaggeration: 1.3 }); } catch (error) { console.warn(error); }
  try {
    map.setSky(S.dark
      ? { 'sky-color': '#0a1222', 'horizon-color': '#22324c', 'fog-color': '#0f1828', 'sky-horizon-blend': 0.5, 'horizon-fog-blend': 0.5, 'fog-ground-blend': 0.35, 'atmosphere-blend': 0 }
      : { 'sky-color': '#7fb0dc', 'horizon-color': '#f2e6d2', 'fog-color': '#e9e2d4', 'sky-horizon-blend': 0.5, 'horizon-fog-blend': 0.5, 'fog-ground-blend': 0.35, 'atmosphere-blend': 0 });
  } catch (error) { console.warn(error); }
  for (const layer of map.getStyle().layers) {
    if (/poi|shield|highway-name|highway_name|road_one_way|road_oneway/.test(layer.id)) map.setLayoutProperty(layer.id, 'visibility', 'none');
    if (/(label|place)_(city|town|village)/.test(layer.id)) map.setLayerZoomRange(layer.id, 8, 24);
    if (S.dark && layer.type === 'symbol' && layer.layout?.['text-field']) { try { map.setPaintProperty(layer.id, 'text-color', '#8ea4bf'); map.setPaintProperty(layer.id, 'text-halo-color', '#050b16'); } catch (e) { /* skip */ } }
  }
}

function routeFeatures(legs, progress) {
  return { type: 'FeatureCollection', features: legs.map(leg => ({ type: 'Feature', properties: { id: leg.id, mode: leg.mode, tbd: leg.tbd, eventId: leg.eventId || '' },
    geometry: { type: 'LineString', coordinates: progress?.has(leg.id) ? prefix(leg.lite, progress.get(leg.id)) : leg.lite.coords } })) };
}
function stopData() {
  const byPlace = new Map();
  for (const event of S.trip.events) {
    if (!event.place) continue;
    const entry = byPlace.get(event.place.id) || { place: event.place, events: [], tbd: true };
    entry.events.push(event); entry.tbd = entry.tbd && event.tbd;
    byPlace.set(event.place.id, entry);
  }
  return { type: 'FeatureCollection', features: [...byPlace.values()].map(entry => ({ type: 'Feature', properties: { placeId: entry.place.id, name: entry.place.name, tbd: entry.tbd, events: entry.events.map(e => e.id).join(' ') }, geometry: { type: 'Point', coordinates: [entry.place.lng, entry.place.lat] } })) };
}
const lineWidth = base => ['interpolate', ['linear'], ['zoom'], 4, base * 0.6, 9, base, 14, base * 1.5];
function routeLayers(source, prefixId, before) {
  const map = S.map;
  for (const mode of S.trip.modes) {
    const m = MODES[mode];
    map.addLayer({ id: `${prefixId}-case-${mode}`, type: 'line', source, filter: ['all', ['==', ['get', 'mode'], mode], ['!', ['get', 'tbd']]], layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': CASING, 'line-width': lineWidth(m.width + 3), 'line-opacity': 0.92 } }, before);
    map.addLayer({ id: `${prefixId}-line-${mode}`, type: 'line', source, filter: ['all', ['==', ['get', 'mode'], mode], ['!', ['get', 'tbd']]], layout: { 'line-cap': m.dash && m.dash[0] < 0.5 ? 'round' : 'butt', 'line-join': 'round' },
      paint: { 'line-color': lineColor(mode), 'line-width': lineWidth(m.width), ...(m.dash ? { 'line-dasharray': m.dash } : {}) } }, before);
  }
  map.addLayer({ id: `${prefixId}-tbd`, type: 'line', source, filter: ['get', 'tbd'], layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': ['match', ['get', 'mode'], ...Object.keys(MODES).flatMap(k => [k, lineColor(k)]), '#71878a'], 'line-width': lineWidth(4.2), 'line-dasharray': [0.1, 1.9], 'line-opacity': 0.85 } }, before);
}
function addLayers() {
  const map = S.map;
  const before = map.getStyle().layers.find(layer => /label_(other|village|town)/.test(layer.id))?.id;
  map.addSource('o5-routes', { type: 'geojson', data: routeFeatures(S.trip.legs) });
  map.addSource('o5-draw', { type: 'geojson', data: routeFeatures([]) });
  map.addSource('o5-stops', { type: 'geojson', data: stopData() });
  routeLayers('o5-routes', 'o5r', before);
  routeLayers('o5-draw', 'o5d', before);
  map.addLayer({ id: 'o5-stop', type: 'circle', source: 'o5-stops', paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 4, 10, 6.5],
    'circle-color': S.dark ? ['case', ['get', 'tbd'], '#0b1220', '#eaf5ff'] : ['case', ['get', 'tbd'], '#fffef8', '#1f2b2f'],
    'circle-stroke-color': S.dark ? ['case', ['get', 'tbd'], '#9db3cd', '#0b1220'] : ['case', ['get', 'tbd'], '#71878a', '#fffef8'], 'circle-stroke-width': 2, 'circle-pitch-alignment': 'map' } });
  map.addLayer({ id: 'o5-stop-sel', type: 'circle', source: 'o5-stops', filter: ['==', ['get', 'placeId'], ''], paint: { 'circle-radius': 13, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': '#d4512c', 'circle-stroke-width': 3, 'circle-pitch-alignment': 'map' } });
  map.addLayer({ id: 'o5-stop-hit', type: 'circle', source: 'o5-stops', paint: { 'circle-radius': 22, 'circle-color': '#000', 'circle-opacity': 0.01 } });
  map.addLayer({ id: 'o5-stop-label', type: 'symbol', source: 'o5-stops', layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Bold'], 'text-size': 13, 'text-variable-anchor': ['top', 'bottom', 'left', 'right'], 'text-radial-offset': 0.9, 'text-optional': true },
    paint: S.dark ? { 'text-color': ['case', ['get', 'tbd'], '#9fb3cc', '#e3eef9'], 'text-halo-color': '#050b16', 'text-halo-width': 1.6 }
      : { 'text-color': ['case', ['get', 'tbd'], '#4c5d61', '#1f2b2f'], 'text-halo-color': '#fffef8', 'text-halo-width': 1.8 } });
  setRouteVisibility('o5r', true); setRouteVisibility('o5d', false);
  applySelection();
}
function setRouteVisibility(prefixId, visible) {
  for (const layer of S.map.getStyle().layers) if (layer.id.startsWith(`${prefixId}-`)) S.map.setLayoutProperty(layer.id, 'visibility', visible ? 'visible' : 'none');
}
function applySelection() {
  const map = S.map, sel = S.selected;
  const pick = (a, b, c) => (sel ? ['case', ['==', ['get', 'eventId'], sel], a, b] : c);
  for (const mode of S.trip.modes) {
    map.setPaintProperty(`o5r-line-${mode}`, 'line-opacity', pick(1, 0.35, 1));
    map.setPaintProperty(`o5r-case-${mode}`, 'line-opacity', pick(0.95, 0.25, 0.9));
  }
  map.setPaintProperty('o5r-tbd', 'line-opacity', pick(1, 0.3, 0.85));
  const place = sel && S.landed ? S.trip.eventById(sel)?.place?.id || '' : '';
  map.setFilter('o5-stop-sel', ['==', ['get', 'placeId'], place]);
}

// ---------------------------------------------------------------- board
const FLAP_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789·→';
function buildBoard() {
  const el = document.createElement('div');
  el.className = 'o5-board';
  el.setAttribute('role', 'status');
  el.innerHTML = '<div class="o5-row o5-row-a"><span class="o5-mode"></span><span class="o5-flaps" data-f="a"></span></div><div class="o5-row o5-row-b"><span class="o5-flaps" data-f="b"></span><span class="o5-status"></span></div>';
  return { el, a: el.querySelector('[data-f="a"]'), b: el.querySelector('[data-f="b"]'), mode: el.querySelector('.o5-mode'), status: el.querySelector('.o5-status') };
}
function flapText(container, text, cellWidth) {
  const max = Math.max(8, Math.floor((container.clientWidth || 300) / (cellWidth + 2)));
  let value = text.toUpperCase();
  if (value.length > max) value = `${value.slice(0, max - 1)}…`;
  const cells = [...container.children];
  while (cells.length < value.length) { const cell = document.createElement('span'); cell.className = 'o5-flap'; container.append(cell); cells.push(cell); }
  cells.forEach((cell, index) => {
    const target = value[index] || '';
    if (index >= value.length) { cell.remove(); return; }
    if (cell.textContent === target) return;
    if (S.reduced) { cell.textContent = target; return; }
    let steps = 3 + Math.floor(Math.random() * 6) + Math.floor(index / 3);
    const tick = () => {
      if (!S) return;
      cell.classList.remove('is-flip'); void cell.offsetWidth; cell.classList.add('is-flip');
      if (--steps <= 0 || target === ' ') { cell.textContent = target; return; }
      cell.textContent = FLAP_CHARS[Math.floor(Math.random() * FLAP_CHARS.length)];
      const timer = setTimeout(() => { S?.timers.delete(timer); tick(); }, 45);
      S.timers.add(timer);
    };
    tick();
  });
}
function announce(leg, index, total, groupLabel) {
  const b = S.board;
  b.el.classList.add('is-on');
  b.mode.innerHTML = icon(leg.mode, { size: 20, stroke: 2 });
  b.mode.style.color = modeOf(leg.mode).color === '#3d4a4d' ? '#e6edf2' : '#fff';
  b.mode.style.background = modeOf(leg.mode).color;
  const cell = S.ctx.isPhone() ? 12 : 14;
  flapText(b.a, `${modeOf(leg.mode).label} · ${leg.fromPlace.name} → ${leg.toPlace.name}`, cell);
  const event = S.trip.eventById(leg.eventId);
  const parts = [groupLabel, event?.tbd ? '' : event?.rawDate, fmtKm(leg.km), leg.durationMin ? fmtDuration(leg.durationMin) : leg.duration].filter(Boolean);
  flapText(b.b, parts.join(' · '), cell - 2);
  b.status.textContent = leg.tbd ? 'TBD' : total > 1 ? `LEG ${index + 1}/${total}` : 'LEG';
  b.status.classList.toggle('is-tbd', leg.tbd);
}
function announceArrival(event) {
  const b = S.board;
  b.el.classList.add('is-on');
  b.mode.innerHTML = icon('place', { size: 20, stroke: 2 });
  b.mode.style.background = '#d4512c'; b.mode.style.color = '#fff';
  const cell = S.ctx.isPhone() ? 12 : 14;
  flapText(b.a, `Arrived · ${event.place?.name || event.title}`, cell);
  flapText(b.b, [`${S.trip.eventWord} ${event.number}`, event.date.replace(/^TBD · /, ''), event.photos.length ? `${event.photos.length} photo${event.photos.length === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · '), cell - 2);
  b.status.textContent = event.tbd ? 'TBD' : 'ARRIVED';
  b.status.classList.toggle('is-tbd', event.tbd);
}
function hideBoard() { S.board.el.classList.remove('is-on'); }

// ---------------------------------------------------------------- markers
function renderPhoto(el, group, first) {
  const n = group.items.length;
  const mine = S.selected && S.landed && group.items.some(p => p.eventId === S.selected);
  if (first) {
    el.innerHTML = `<span class="o5-chip"></span>${n > 1 ? `<span class="o5-n">${n}</span>` : ''}<span class="o5-time"></span>`;
    const url = group.items.find(p => p.preview)?.preview;
    if (url) el.querySelector('.o5-chip').style.backgroundImage = `url("${url}")`;
    const time = group.items[0].takenLabel?.split(' · ')[1] || '';
    el.querySelector('.o5-time').textContent = n > 1 ? `${n} photos` : time;
    el.setAttribute('aria-label', n > 1 ? `${n} photos here` : `Photo${group.items[0].takenLabel ? ` · ${group.items[0].takenLabel}` : ''}`);
    if (el.querySelector('.o5-n') && mine) el.querySelector('.o5-n').style.display = 'none';
  }
  el.classList.toggle('is-card', Boolean(mine));
  el.classList.toggle('is-dim', Boolean(S.selected && !group.items.some(p => p.eventId === S.selected)));
}
function renderPin(el, group, first) {
  const n = group.items.length;
  if (first) {
    el.classList.toggle('is-count', n > 1);
    el.innerHTML = `<span class="o5-pin-label">${icon(n > 1 ? 'place' : placeIcon(group.items[0].category), { size: 14, stroke: 2 })}${escapeHtml(n > 1 ? `${n} places` : group.items[0].name)}</span><span class="o5-pin-stem"></span>`;
    el.setAttribute('aria-label', n > 1 ? `${n} places` : `Place: ${group.items[0].name}`);
    if (S.rising) { el.classList.add('is-rise'); el.style.setProperty('--d', `${Math.round(Math.random() * 240)}ms`); }
  }
  el.style.opacity = S.selected && !group.items.some(p => p.eventIds.includes(S.selected)) ? '0.55' : '';
}
let popup = null;
function card(lngLat, body) {
  popup?.remove();
  popup = new maplibregl.Popup({ className: 'o5-card', offset: 24, maxWidth: '260px' }).setLngLat(lngLat).setHTML(body).addTo(S.map);
  return popup;
}
function photoClick(group) {
  if (group.items.length > 1 && S.map.getZoom() < 15) { zoomToGroup(S.map, S.ctx, group); return; }
  const photo = group.items[0], event = S.trip.eventById(photo.eventId);
  card([group.lng, group.lat], `<div class="o5-card-img" style="background-image:url('${photo.preview || ''}')"></div><b>${escapeHtml(event?.title || '')}</b><small>${escapeHtml(photo.takenLabel || '')}${photo.sharp ? '' : ' · blurred preview'}</small>`);
}
function placeClick(group) {
  if (group.items.length > 1 && S.map.getZoom() < 15.5) { zoomToGroup(S.map, S.ctx, group, 16); return; }
  const place = group.items[0];
  card([place.lng, place.lat], `<b>${escapeHtml(place.name)}</b><small>${escapeHtml(place.category)}</small>`);
}
function stopClick(event) {
  const feature = event.features?.[0];
  if (!feature) return;
  const ids = feature.properties.events.split(' ').filter(Boolean);
  if (ids.length === 1) { popup?.remove(); S.ctx.onEventPicked(ids[0]); return; }
  const node = card(feature.geometry.coordinates, `<b>${escapeHtml(feature.properties.name)}</b>${ids.map(id => { const e = S.trip.eventById(id); return `<button type="button" class="o5-choice" data-event="${escapeHtml(id)}">${escapeHtml(`${S.trip.eventWord} ${e.number} · ${e.title}`)}<small>${escapeHtml(e.date)}</small></button>`; }).join('')}`);
  node.getElement().addEventListener('click', clickEvent => { const button = clickEvent.target.closest('[data-event]'); if (button) { node.remove(); S.ctx.onEventPicked(button.dataset.event); } });
}
// Photos within ~1.2 km of a leg pop up as the vehicle passes their nearest point.
function popCandidates(leg, event) {
  const path = leg.coarse, total = path.cum[path.cum.length - 1] || 1, out = [];
  for (const photo of S.trip.located) {
    if (photo.eventId !== event?.id && photo.eventId !== leg.eventId) continue;
    let best = Infinity, at = 0;
    for (let i = 0; i < path.coords.length; i++) {
      const d = haversine(path.coords[i], [photo.lng, photo.lat]);
      if (d < best) { best = d; at = path.cum[i] / total; }
    }
    if (best <= 1.2 && at < 0.97) out.push({ photo, at });
  }
  return out.sort((a, b) => a.at - b.at).slice(0, 6);
}
function pop(photo) {
  const el = document.createElement('div');
  el.className = 'o5-pop';
  el.innerHTML = `<div class="o5-pop-in"><div class="o5-pop-img" style="background-image:url('${photo.preview || ''}')"></div><div class="o5-pop-cap">${escapeHtml(photo.takenLabel || 'Photo')}</div></div>`;
  const marker = new maplibregl.Marker({ element: el, anchor: 'bottom', offset: [0, -14] }).setLngLat([photo.lng, photo.lat]).addTo(S.map);
  S.pops.push(marker);
  const timer = setTimeout(() => { S?.timers.delete(timer); el.classList.add('is-gone'); }, 2400);
  S.timers.add(timer);
}
function clearPops() { S.pops.forEach(m => m.remove()); S.pops = []; }

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
    const timer = setTimeout(finish, duration + 500);
    S.map.on('moveend', finish);
  });
}
const easeCamera = (job, camera, duration) => { if (job.cancelled) return Promise.resolve(); S.map.easeTo({ ...camera, duration, essential: true }); return moved(duration); };
const playClock = (job, duration, onFrame) => new Promise(resolve => {
  if (job.cancelled) return resolve();
  const c = clock(duration, onFrame, () => { job.clocks.delete(c); resolve(); }, { perf: S.ctx.perf });
  job.clocks.add(c);
});
const sleep = (job, ms) => new Promise(resolve => setTimeout(resolve, job.cancelled ? 0 : ms));
const centerOf = c => (Array.isArray(c) ? c : [c.lng, c.lat]);

function setSelected(id, landed) {
  S.selected = id; S.landed = landed;
  applySelection();
  S.photos.refresh(); S.places.refresh();
}
function revealOnce() { if (!S.revealed) { S.revealed = true; reveal(S.map); } }
function travelMode(on) { S.container.classList.toggle('is-travel', on && !S.reduced); }
function overviewCamera() { const c = cameraFor(S.map, S.ctx, { bounds: S.trip.bounds, maxZoom: 10 }, { extra: 40 }); return { ...c, pitch: 28 }; }
function settleOpening() {
  setRouteVisibility('o5d', false); setRouteVisibility('o5r', true);
  S.container.classList.remove('o5-hidden-markers');
}

export function showOverview({ opening = false } = {}) {
  if (!S?.map) return;
  cancelJob(); popup?.remove(); clearPops(); hideBoard(); travelMode(false); S.vehicle.remove();
  setSelected(null, false);
  const target = overviewCamera();
  if (!opening || S.reduced) {
    settleOpening();
    if (!S.revealed || S.reduced) S.map.jumpTo(target); else S.map.easeTo({ ...target, duration: 1100 });
    revealOnce();
    return;
  }
  const settle = () => settleOpening();
  const job = startJob(settle, () => { settle(); S.map.jumpTo(target); });
  const plan = tracePlan(S.trip.orderedLegs);
  setRouteVisibility('o5r', false); setRouteVisibility('o5d', true);
  S.container.classList.add('o5-hidden-markers');
  const center = centerOf(target.center);
  S.map.jumpTo({ center, zoom: target.zoom - 0.5, pitch: 0, bearing: 22 });
  revealOnce();
  let lastPush = 0;
  (async () => {
    await playClock(job, 3600, (t, now) => {
      const k = ease.inOut(t);
      S.map.jumpTo({ center, zoom: target.zoom - 0.5 + 0.5 * k, pitch: 28 * k, bearing: 22 * (1 - k) });
      if (now - lastPush > 66 || t >= 1) {
        lastPush = now;
        const progress = new Map(), legs = [];
        for (const entry of plan) {
          if (t <= entry.start) continue;
          legs.push(entry.leg);
          const f = (t - entry.start) / (entry.end - entry.start || 1);
          if (f < 1) progress.set(entry.leg.id, f);
        }
        S.map.getSource('o5-draw').setData(routeFeatures(legs, progress));
      }
    });
    if (job.cancelled) return;
    S.job = null; settle(); S.ctx.onPlayState(false);
  })();
}

function landingCamera(event) {
  const camera = cameraFor(S.map, S.ctx, S.trip.eventFrame(event), { extra: 50 });
  return camera && { ...camera, zoom: camera.zoom - 0.3, pitch: 48, bearing: 0 };
}
function legDuration(leg) { return Math.max(2400, Math.min(7500, 2000 + 1500 * Math.log2(1 + leg.lengthKm / 20))); }

function land(event, animate) {
  clearPops();
  S.photos.hide(false); S.places.hide(S.map.getZoom() < 8.5);
  S.vehicle.remove();
  travelMode(false);
  S.rising = animate && !S.reduced;
  setSelected(event.id, true);
  S.places.rebuildNow(); S.photos.rebuildNow();
  S.rising = false;
  announceArrival(event);
  const timer = setTimeout(() => { S?.timers.delete(timer); if (S && !S.job) hideBoard(); }, 3200);
  S.timers.add(timer);
}

function travel(event, chains, destination) {
  const settle = () => land(event, false);
  const job = startJob(settle, () => { settle(); if (destination) S.map.jumpTo(destination); });
  setSelected(event.id, false);
  clearPops();
  // Clustered markers reproject on every camera frame; the chase needs only
  // the vehicle and pop-up cards, so the groups wait for the arrival.
  S.photos.hide(true); S.places.hide(true);
  const legs = chains.flat();
  const scale = Math.min(1, 18000 / legs.reduce((sum, leg) => sum + legDuration(leg), 0));
  (async () => {
    const firstLeg = legs[0];
    S.vehicleEl.innerHTML = icon(firstLeg.mode, { size: 24, stroke: 2 });
    S.vehicleEl.style.setProperty('--c', modeOf(firstLeg.mode).color);
    S.vehicle.setLngLat(firstLeg.coords[0]).addTo(S.map);
    announce(firstLeg, 0, legs.length, groupLabel(firstLeg));
    travelMode(true);
    const startBearing = bearingOf(along(firstLeg.coarse, 0).point, along(firstLeg.coarse, Math.min(1, 0.08)).point);
    await easeCamera(job, { center: firstLeg.coords[0], zoom: endZoom(firstLeg), pitch: 60, bearing: startBearing }, 1100);
    let camBearing = S.map.getBearing();
    let index = 0;
    for (const chain of chains) {
      for (const leg of chain) {
        if (job.cancelled) return;
        if (index > 0) announce(leg, index, legs.length, groupLabel(leg));
        S.vehicleEl.innerHTML = icon(leg.mode, { size: 24, stroke: 2 });
        S.vehicleEl.style.setProperty('--c', modeOf(leg.mode).color);
        const zEnd = endZoom(leg), zCruise = Math.max(6.8, Math.min(zEnd, 12.8 - 1.15 * Math.log2(1 + leg.lengthKm / 6)));
        const pops = popCandidates(leg, event);
        let last = performance.now();
        if (chain.indexOf(leg) === 0 && index > 0) {
          await easeCamera(job, { center: leg.coords[0], zoom: zEnd, pitch: 60, bearing: bearingOf(leg.coords[0], along(leg.coarse, 0.08).point) }, 900);
          camBearing = S.map.getBearing();
        }
        await playClock(job, legDuration(leg) * scale, (t, now) => {
          const p = (1 - Math.cos(Math.PI * t)) / 2;
          const here = along(leg.lite, p).point;
          const a = along(leg.coarse, Math.max(0, p - 0.02)).point, b = along(leg.coarse, Math.min(1, p + 0.04)).point;
          const dt = Math.min(64, now - last); last = now;
          if (haversine(a, b) > 0.05) {
            const delta = ((bearingOf(a, b) - camBearing + 540) % 360) - 180;
            camBearing += delta * (1 - Math.exp(-dt / 520));
          }
          const zoom = zEnd + (zCruise - zEnd) * Math.pow(Math.sin(Math.PI * p), 0.6);
          S.vehicle.setLngLat(here);
          S.map.jumpTo({ center: here, zoom, pitch: 60, bearing: camBearing });
          while (pops.length && p >= pops[0].at) pop(pops.shift().photo);
        });
        index += 1;
      }
    }
    if (job.cancelled) return;
    await sleep(job, 300);
    if (job.cancelled) return;
    travelMode(false);
    S.vehicle.remove();
    if (destination) await easeCamera(job, destination, 1500);
    if (job.cancelled) return;
    S.job = null; land(event, true); S.ctx.onPlayState(false);
  })();
}
function endZoom(leg) { return Math.max(11.2, Math.min(14, 13.8 - 0.35 * Math.log2(1 + leg.lengthKm))); }
function groupLabel(leg) {
  if (!S.trip.routeGroups.length || !leg.groupIds.length) return '';
  return leg.groupIds.map(id => S.trip.routeGroups.find(g => g.id === id)?.label).filter(Boolean).join(' + ');
}

export function selectEvent(id, { animate = true } = {}) {
  if (!S?.map) return;
  const event = S.trip.eventById(id);
  if (!event) return;
  cancelJob(); popup?.remove();
  const camera = landingCamera(event);
  if (!animate || S.reduced || !event.legs.length) {
    settleOpening();
    if (camera) { if (!S.revealed || S.reduced || !animate) S.map.jumpTo(camera); else S.map.easeTo({ ...camera, duration: 1200 }); }
    land(event, animate && S.revealed && !S.reduced);
    revealOnce();
    return;
  }
  settleOpening();
  revealOnce();
  travel(event, event.chains, camera);
}
export function playLeg(id) {
  if (!S?.map) return;
  if (S.trip.eventById(id)) { selectEvent(id, { animate: true }); return; }
  const leg = S.trip.legById.get(id);
  if (!leg) return;
  cancelJob();
  travel(S.trip.eventById(leg.eventId), [[leg]], { center: [leg.toPlace.lng, leg.toPlace.lat], zoom: 12, pitch: 48, bearing: 0 });
}
export function skip() { cancelJob('final'); }
export function setReducedMotion(value) { if (!S) return; S.reduced = Boolean(value); if (S.reduced && S.job) cancelJob('final'); }

export function legendSwatch(mode) {
  if (mode === 'tbd') return swatchSvg({ color: '#71878a', width: 4, dash: [0.1, 7.6] });
  const m = MODES[mode];
  return swatchSvg({ color: lineColor(mode), width: 4, dash: m.dash ? m.dash.map(v => v * 4) : null, cap: m.dash && m.dash[0] < 0.5 ? 'round' : 'butt', casing: CASING });
}
export function legendExtras() {
  return [
    { swatch: `<span style="display:grid;place-items:center;width:30px;height:30px;border-radius:50%;background:#fffef8;color:#0072b2;box-shadow:0 0 0 2px #d4512c">${icon('train', { size: 18, stroke: 2 })}</span>`, label: 'Vehicle', note: 'one icon per mode, chased by the camera' },
    { swatch: '<span style="display:block;width:30px;height:22px;border-radius:5px;background:#8aa;box-shadow:0 0 0 2px #fff"></span>', label: 'Photo card', note: 'pops up at its capture point; number = group' },
    { swatch: `<span style="display:inline-flex;align-items:center;gap:3px;padding:3px 8px;border-radius:12px;background:#fffef8;color:#1f2b2f;font-size:12px;font-weight:600;box-shadow:0 1px 3px #0003">${icon('food', { size: 12, stroke: 2 })}Café</span>`, label: 'Curated place', note: 'pin rises on arrival' }
  ];
}

export function destroy() {
  if (!S) return;
  cancelJob(); popup?.remove(); popup = null;
  S.timers.forEach(clearTimeout);
  clearPops();
  S.offInput?.();
  S.photos?.destroy(); S.places?.destroy(); S.vehicle?.remove();
  S.map?.remove();
  S.container.classList.remove('o5', 'o5-dark', 'o5-light', 'is-travel', 'o5-hidden-markers');
  S = null;
}
void clock;
