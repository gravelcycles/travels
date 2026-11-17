// Option 1 · Globe. MapLibre globe on a real basemap, light by default with
// an optional night mode (O23): glowing trails, comet legs with a gently
// following camera, photos that bloom as the comet passes.
import { modeOf, along, prefix, tracePlan, clock, ease, icon, escapeHtml, boundsCenter, bearing as bearingOf, fmtKm, legTitle, placeIcon } from '../data.js';
import { createMap, reveal, cameraFor, onUserInput, markerLayer, zoomToGroup, overlayCanvas, injectStyle, swatchSvg, OFM } from './common.js';

export const meta = {
  number: 1, name: 'Globe', modes: ['light', 'dark'],
  get keyBackground() { return S?.dark ? '#0a1322' : '#f7f5ef'; },
  tagline: 'The journey crossing a real globe. The whole trip opens from space; each leg runs as a comet with a fading tail while the camera leans in behind it. Light by default, with a night mode.',
  whatsNew: [
    'MapLibre globe projection with an atmosphere over a warm, light OpenFreeMap restyle; a dark night restyle with a starfield is the optional mode.',
    'Comet animation (additive glow at night); travelled trails settle into soft-haloed lines that keep each mode’s dash pattern.',
    'Photos are small dots that bloom into blurred circular thumbnails as the comet passes; places are small stars.'
  ],
  keeps: ['Real, light basemap by default (O23); current mode colours and dash patterns (brightened only at night).', 'Unselected opening, endpoint-only overview, TBD dotted without casing.', 'Direct links land in the city without animation; input interrupts; reduced motion shows the end state.'],
  departures: [
    'Moving camera: the opening flies in from space and legs tilt and follow the travel direction (O06/O09 hold the camera still).',
    'Optional dark map (offered only when chosen, per O23).',
    'Whole-trip Replay re-runs the opening (O09 disables full-trip Replay).'
  ],
  phone: 'Same globe and follow camera; markers keep 44 px targets. Long follow shots crop the leg on narrow screens.'
};

const GLOW = { train: '#56c8ff', boat: '#3de8d8', bus: '#ffb54d', gondola: '#cda6ff', walk: '#e6edf2', car: '#ff806f', bike: '#66e8a2' };
const CORE_DASH = { train: null, boat: [1.4, 2.2], bus: [5, 2.4], gondola: [0.1, 2.8], walk: [0.1, 1.9], car: [6, 1.8, 1.2, 1.8], bike: [2.6, 1.6] };
const DAY = { train: '#0072b2', boat: '#007f8b', bus: '#a85c00', gondola: '#7b4ba3', walk: '#3d4a4d', car: '#a43a2f', bike: '#24804f' };
let PAL = DAY;
const glow = mode => PAL[mode] || '#006f92';

const CSS = `
.o1 { background: radial-gradient(1200px 800px at 50% 40%, #0b1730 0%, #050a13 60%, #03060c 100%); }
.o1-stars { position:absolute; inset:0; pointer-events:none; opacity:.75;
  background-image: radial-gradient(1px 1px at 12% 22%, #fff8 50%, transparent 51%), radial-gradient(1px 1px at 72% 12%, #fff9 50%, transparent 51%),
  radial-gradient(1.5px 1.5px at 38% 78%, #cfe6ff 50%, transparent 51%), radial-gradient(1px 1px at 88% 64%, #fff7 50%, transparent 51%),
  radial-gradient(1px 1px at 55% 40%, #fff5 50%, transparent 51%), radial-gradient(1.2px 1.2px at 22% 58%, #fff8 50%, transparent 51%),
  radial-gradient(1px 1px at 64% 88%, #fff6 50%, transparent 51%), radial-gradient(1px 1px at 8% 86%, #fff7 50%, transparent 51%),
  radial-gradient(1.3px 1.3px at 94% 30%, #e7f2ff 50%, transparent 51%), radial-gradient(1px 1px at 46% 8%, #fff8 50%, transparent 51%);
  background-size: 420px 380px; }
.o1 .maplibregl-canvas { outline: none; }
.o1-glow { mix-blend-mode: normal; }
.o1-photo { width: 44px; height: 44px; display: grid; place-items: center; }
.o1-photo .o1-dot { width: 9px; height: 9px; border-radius: 50%; background: #ffd58a; box-shadow: 0 0 6px 2px #ffb94a99, 0 0 16px 4px #ff9b2e44; transition: transform 380ms cubic-bezier(.2,.8,.2,1), opacity 260ms; }
.o1-photo[data-n="many"] .o1-dot { width: 12px; height: 12px; }
.o1-photo .o1-thumb { position:absolute; width: 46px; height: 46px; border-radius: 50%; background: #1b2638 center/cover no-repeat; transform: scale(.2); opacity: 0;
  box-shadow: 0 0 0 2px #ffd58acc, 0 0 18px 4px #ffb94a77; transition: transform 420ms cubic-bezier(.2,.9,.25,1.2), opacity 260ms; }
.o1-photo .o1-count { position:absolute; left: 30px; top: 2px; min-width: 20px; height: 20px; padding: 0 5px; border-radius: 10px; background: #111a28; color: #ffe2ae;
  font-size: 12px; font-weight: 700; line-height: 20px; box-shadow: 0 0 0 1px #ffd58a66; }
.o1-photo.is-bloom .o1-thumb { transform: scale(1); opacity: 1; }
.o1-photo.is-bloom .o1-dot { transform: scale(.2); opacity: 0; }
.o1-photo.is-bloom .o1-count { left: 34px; top: -2px; }
.o1-photo.is-dim { opacity: .55; }
.o1-photo.is-dim .o1-count { display: none; }
.o1-place { width: 44px; height: 44px; display: grid; place-items: center; color: #fff1c4; }
.o1-place .o1-star { width: 16px; height: 16px; filter: drop-shadow(0 0 4px #ffe39a) drop-shadow(0 0 10px #ffd36a88); }
.o1-place .o1-count { position:absolute; left: 30px; top: 6px; font-size: 12px; font-weight: 700; color: #fff1c4; text-shadow: 0 0 6px #000; }
.o1-place.is-dim { opacity: .45; }
.o1-hidden-markers .o1-photo, .o1-hidden-markers .o1-place { opacity: 0 !important; pointer-events: none; }
.o1-photo, .o1-place { transition: opacity 400ms ease; }
:root[data-reduced] .o1-photo *, :root[data-reduced] .o1-place, :root[data-reduced] .o1-photo { transition: none !important; }
.o1-popup .maplibregl-popup-content { background: #111a28; color: #eaf2fb; border-radius: 14px; padding: 10px 12px; box-shadow: 0 10px 30px #0009; font: 13px/1.35 var(--font-ui); max-width: 240px; }
.o1-popup .maplibregl-popup-tip { border-top-color: #111a28 !important; border-bottom-color: #111a28 !important; }
.o1-popup .maplibregl-popup-close-button { width: 32px; height: 32px; color: #9fb3c8; font-size: 18px; }
.o1-popup b { display:block; font-size: 14px; }
.o1-popup small { color: #9fb3c8; font-size: 12px; }
.o1-popup .o1-pop-img { width: 200px; height: 140px; border-radius: 10px; background: #1b2638 center/cover; margin: 2px 0 8px; }
.o1-popup .o1-choice { display:block; width:100%; min-height:44px; margin-top:4px; border:0; border-radius:10px; background:#1b2840; color:#eaf2fb; text-align:left; padding:6px 10px; font:inherit; cursor:pointer; }
.o1-popup .o1-choice small { display:block; }
.o1.o1-light { background: radial-gradient(1200px 800px at 50% 35%, #f8fbfd 0%, #e5edf3 60%, #d8e3eb 100%); }
.o1-light .o1-photo .o1-dot { background:#e8912d; box-shadow: 0 0 0 2px #fffdf8, 0 1px 4px rgba(30,40,45,.35); }
.o1-light .o1-photo .o1-thumb { background-color:#dfe6ea; box-shadow: 0 0 0 2.5px #fffdf8, 0 3px 10px rgba(30,40,45,.35); }
.o1-light .o1-photo .o1-count { background:#fffdf8; color:#1f2b2f; box-shadow: 0 1px 3px rgba(30,40,45,.3); }
.o1-light .o1-place { color:#b07d00; }
.o1-light .o1-place .o1-star { filter: drop-shadow(0 0 1.5px #fffdf8) drop-shadow(0 1px 2px rgba(30,40,45,.35)); }
.o1-light .o1-place .o1-count { color:#1f2b2f; text-shadow: 0 0 3px #fffdf8, 0 0 5px #fffdf8; }
.o1-light .o1-popup .maplibregl-popup-content { background:#fffdf8; color:#1f2b2f; box-shadow: 0 10px 30px rgba(20,30,35,.25); }
.o1-light .o1-popup .maplibregl-popup-tip { border-top-color:#fffdf8 !important; border-bottom-color:#fffdf8 !important; }
.o1-light .o1-popup small { color:#59686b; }
.o1-light .o1-popup .o1-choice { background:#f1eee7; color:#1f2b2f; }
`;

let S = null;

export async function mount(container, trip, ctx) {
  injectStyle('lab-o1', CSS);
  container.classList.add('o1');
  const stars = document.createElement('div');
  stars.className = 'o1-stars';
  stars.hidden = ctx.mode !== 'dark';
  container.append(stars);
  S = { trip, ctx, container, reduced: false, selected: null, landed: false, hidden: new Set(), job: null, revealed: false, bloomed: new Set(), dark: ctx.mode === 'dark' };
  PAL = S.dark ? GLOW : DAY;
  container.classList.add(S.dark ? 'o1-dark' : 'o1-light');
  const mine = S;
  const map = await createMap(container, { style: OFM(S.dark ? 'dark' : 'positron'), center: boundsCenter(trip.bounds), zoom: 1.6, minZoom: 0.5, maxZoom: 17.5 }, { onStyle: S.dark ? styleMap : styleLight });
  if (S !== mine) { map.remove(); return; }
  S.map = map;
  addLayers();
  S.overlay = overlayCanvas(map, 'o1-glow');
  S.photos = markerLayer(map, { radius: 46, className: 'o1-photo', render: renderPhoto, onClick: photoClick });
  S.places = markerLayer(map, { radius: 40, className: 'o1-place', render: renderPlace, onClick: placeClick });
  S.photos.set(trip.located);
  S.places.set(trip.locatedPois);
  S.offInput = onUserInput(map, interrupt);
  map.on('click', 'o1-stop-hit', event => stopClick(event));
  map.on('mouseenter', 'o1-stop-hit', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'o1-stop-hit', () => { map.getCanvas().style.cursor = ''; });
}

// Light default: warm paper land, soft blue water, quiet roads (O22/O23).
function styleLight(map) {
  try { map.setProjection({ type: 'globe' }); } catch (error) { console.warn(error); }
  const paint = (id, prop, value) => { if (map.getLayer(id)) try { map.setPaintProperty(id, prop, value); } catch (e) { /* type mismatch */ } };
  const hide = id => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none'); };
  for (const layer of map.getStyle().layers) {
    const id = layer.id;
    if (layer.type === 'background') paint(id, 'background-color', '#f4f1ea');
    else if (id === 'water') paint(id, 'fill-color', '#c4dae4');
    else if (layer.type === 'fill' && /park|wood|glacier|ice/.test(id)) { paint(id, 'fill-color', '#dfe7d2'); paint(id, 'fill-opacity', 0.6); }
    else if (layer.type === 'fill' && /building/.test(id)) paint(id, 'fill-color', '#e6e0d4');
    else if (layer.type === 'line' && /boundary/.test(id)) paint(id, 'line-color', '#c3b8a5');
    else if (layer.type === 'line' && /waterway/.test(id)) paint(id, 'line-color', '#aecbd8');
    else if (layer.type === 'symbol') {
      if (/highway|shield|road|poi|airport|label_other|water_name_line|label_state/.test(id)) hide(id);
      else {
        paint(id, 'text-color', /country/.test(id) ? '#8a8f8c' : '#4f5d61'); paint(id, 'text-halo-color', '#f8f6f0'); paint(id, 'text-halo-width', 1.4);
        if (/label_(city|town|village)/.test(id)) map.setLayerZoomRange(id, 8.5, 24);
      }
    }
  }
  try {
    map.setSky({
      'sky-color': '#bcd6ec', 'horizon-color': '#f6f2ea', 'fog-color': '#f1eee7',
      'sky-horizon-blend': 0.6, 'horizon-fog-blend': 0.6, 'fog-ground-blend': 0.3,
      'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 8, 0]
    });
  } catch (error) { console.warn(error); }
}

function styleMap(map) {
  try { map.setProjection({ type: 'globe' }); } catch (error) { console.warn(error); }
  const paint = (id, prop, value) => { if (map.getLayer(id)) try { map.setPaintProperty(id, prop, value); } catch (e) { /* layer type mismatch */ } };
  const hide = id => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none'); };
  for (const layer of map.getStyle().layers) {
    const id = layer.id;
    if (layer.type === 'background') paint(id, 'background-color', '#08111f');
    else if (id === 'water') paint(id, 'fill-color', '#02060d');
    else if (layer.type === 'fill') { paint(id, 'fill-color', '#0d1a2b'); paint(id, 'fill-opacity', 0.55); }
    else if (/railway/.test(id) && layer.type === 'line') { paint(id, 'line-color', /dash/.test(id) ? '#08111f' : '#2a4262'); }
    else if (/boundary_country/.test(id)) { paint(id, 'line-color', '#395273'); }
    else if (/boundary_state/.test(id)) { paint(id, 'line-color', '#18273b'); }
    else if (layer.type === 'line' && /highway|road|aeroway|waterway/.test(id)) { paint(id, 'line-color', /waterway/.test(id) ? '#06101e' : '#172538'); }
    else if (layer.type === 'symbol') {
      if (/highway|road|oneway|water_name|place_other|place_suburb|place_state/.test(id)) hide(id);
      else {
        paint(id, 'text-color', /country/.test(id) ? '#4f6787' : '#7f95b0');
        paint(id, 'text-halo-color', '#050b16'); paint(id, 'text-halo-width', 1.2);
        // Our stop labels lead at trip scale; basemap towns return when you land.
        if (/place_(city|town|village)/.test(id)) map.setLayerZoomRange(id, 8.5, 24);
      }
    }
  }
  try {
    map.setSky({
      'sky-color': '#071022', 'horizon-color': '#1d3a66', 'fog-color': '#0a1528',
      'sky-horizon-blend': 0.7, 'horizon-fog-blend': 0.6, 'fog-ground-blend': 0.3,
      'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 8, 0]
    });
  } catch (error) { console.warn(error); }
}

function routeData() {
  return {
    type: 'FeatureCollection',
    features: S.trip.legs.map(leg => ({ type: 'Feature', properties: { id: leg.id, mode: leg.mode, tbd: leg.tbd, eventId: leg.eventId || '' }, geometry: { type: 'LineString', coordinates: leg.lite.coords } }))
  };
}
function stopData() {
  const byPlace = new Map();
  for (const event of S.trip.events) {
    if (!event.place) continue;
    const entry = byPlace.get(event.place.id) || { place: event.place, events: [], tbd: true };
    entry.events.push(event);
    entry.tbd = entry.tbd && event.tbd;
    byPlace.set(event.place.id, entry);
  }
  S.stopsByPlace = byPlace;
  return {
    type: 'FeatureCollection',
    features: [...byPlace.values()].map(entry => ({ type: 'Feature', properties: { placeId: entry.place.id, name: entry.place.name, tbd: entry.tbd, events: entry.events.map(e => e.id).join(' ') }, geometry: { type: 'Point', coordinates: [entry.place.lng, entry.place.lat] } }))
  };
}
// Lines run a little bolder on the light map, where there is no glow to carry them.
const width = scale => { const k = scale * (S?.dark ? 1 : 1.3); return ['interpolate', ['linear'], ['zoom'], 2, 1.4 * k, 6, 2.4 * k, 10, 3.4 * k, 14, 4.4 * k]; };

function addLayers() {
  const map = S.map;
  const before = map.getStyle().layers.find(layer => layer.type === 'symbol' && /place/.test(layer.id))?.id;
  map.addSource('o1-routes', { type: 'geojson', data: routeData() });
  map.addSource('o1-stops', { type: 'geojson', data: stopData() });
  for (const mode of S.trip.modes) {
    map.addLayer({ id: `o1-glow-${mode}`, type: 'line', source: 'o1-routes', layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': glow(mode), 'line-width': width(3.4), 'line-blur': width(1.6), 'line-opacity': 0.4,
        ...(CORE_DASH[mode] ? { 'line-dasharray': CORE_DASH[mode].map(v => v / 3.4) } : {}) } }, before);
    map.addLayer({ id: `o1-core-${mode}`, type: 'line', source: 'o1-routes', layout: { 'line-cap': CORE_DASH[mode] && CORE_DASH[mode][0] < 0.5 ? 'round' : 'butt', 'line-join': 'round' },
      paint: { 'line-color': glow(mode), 'line-width': width(1), 'line-opacity': 0.95, ...(CORE_DASH[mode] ? { 'line-dasharray': CORE_DASH[mode] } : {}) } }, before);
  }
  map.addLayer({ id: 'o1-tbd', type: 'line', source: 'o1-routes', layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': ['match', ['get', 'mode'], ...Object.entries(GLOW).flat(), '#b9c7d8'], 'line-width': width(0.95), 'line-opacity': 0.6, 'line-dasharray': [0.1, 2.6] } }, before);
  map.addLayer({ id: 'o1-stop', type: 'circle', source: 'o1-stops', paint: {
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 2.5, 6, 4, 10, 6],
    'circle-color': S.dark ? ['case', ['get', 'tbd'], '#08111f', '#eaf5ff'] : ['case', ['get', 'tbd'], '#fffdf8', '#1f2b2f'],
    'circle-stroke-color': S.dark ? ['case', ['get', 'tbd'], '#9db3cd', '#08111f'] : ['case', ['get', 'tbd'], '#71878a', '#fffdf8'],
    'circle-stroke-width': ['case', ['get', 'tbd'], 1.4, 1.2], 'circle-opacity': 1 } });
  map.addLayer({ id: 'o1-stop-sel', type: 'circle', source: 'o1-stops', filter: ['==', ['get', 'placeId'], ''], paint: {
    'circle-radius': 12, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': S.dark ? '#ffd58a' : '#d4512c', 'circle-stroke-width': 2, 'circle-blur': 0.1 } });
  map.addLayer({ id: 'o1-stop-hit', type: 'circle', source: 'o1-stops', paint: { 'circle-radius': 22, 'circle-color': '#000', 'circle-opacity': 0.01 } });
  map.addLayer({ id: 'o1-stop-label', type: 'symbol', source: 'o1-stops', layout: {
    'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': ['interpolate', ['linear'], ['zoom'], 3, 12, 9, 14],
    'text-variable-anchor': ['left', 'right', 'top', 'bottom'], 'text-radial-offset': 0.9, 'text-optional': true, 'text-max-width': 9 },
    paint: S.dark ? { 'text-color': ['case', ['get', 'tbd'], '#9fb3cc', '#e3eef9'], 'text-halo-color': '#050b16', 'text-halo-width': 1.6 }
      : { 'text-color': ['case', ['get', 'tbd'], '#59686b', '#1f2b2f'], 'text-halo-color': '#fffdf8', 'text-halo-width': 1.8 } });
  applyRouteState();
}

function selectionPaint(selected, other, overview) {
  return S.selected ? ['case', ['==', ['get', 'eventId'], S.selected], selected, other] : overview;
}
function applyRouteState() {
  const map = S.map;
  const hidden = [...S.hidden];
  const visible = hidden.length ? ['!', ['in', ['get', 'id'], ['literal', hidden]]] : true;
  for (const mode of S.trip.modes) {
    const filter = ['all', ['==', ['get', 'mode'], mode], ['!', ['get', 'tbd']], visible];
    map.setFilter(`o1-glow-${mode}`, filter);
    map.setFilter(`o1-core-${mode}`, filter);
    map.setPaintProperty(`o1-glow-${mode}`, 'line-opacity', S.dark ? selectionPaint(0.75, 0.12, 0.42) : selectionPaint(0.32, 0.04, 0.18));
    map.setPaintProperty(`o1-core-${mode}`, 'line-opacity', selectionPaint(1, 0.32, 0.95));
    map.setPaintProperty(`o1-core-${mode}`, 'line-width', S.selected ? ['case', ['==', ['get', 'eventId'], S.selected], width(1.35), width(0.85)] : width(1));
  }
  map.setFilter('o1-tbd', ['all', ['get', 'tbd'], visible]);
  map.setPaintProperty('o1-tbd', 'line-opacity', selectionPaint(0.95, 0.3, 0.6));
  const place = S.selected ? S.trip.eventById(S.selected)?.place?.id || '' : '';
  map.setFilter('o1-stop-sel', ['==', ['get', 'placeId'], S.landed ? place : '']);
}

// --------------------------------------------------------------- markers
function photoPreview(group) { return group.items.find(p => p.preview)?.preview || ''; }
function renderPhoto(el, group, first) {
  const n = group.items.length;
  if (first) {
    el.dataset.n = n > 1 ? 'many' : 'one';
    el.innerHTML = `<span class="o1-dot"></span><span class="o1-thumb"></span>${n > 1 ? `<span class="o1-count">${n}</span>` : ''}`;
    const url = photoPreview(group);
    if (url) el.querySelector('.o1-thumb').style.backgroundImage = `url("${url}")`;
    el.setAttribute('aria-label', n > 1 ? `${n} photos here` : `Photo${group.items[0].takenLabel ? ` · ${group.items[0].takenLabel}` : ''}`);
  }
  const mine = S.selected && group.items.some(p => p.eventId === S.selected);
  el.classList.toggle('is-bloom', Boolean(mine && (S.landed || S.bloomed.has(group.key))));
  el.classList.toggle('is-dim', Boolean(S.selected && !mine));
}
function renderPlace(el, group, first) {
  const n = group.items.length;
  if (first) {
    el.innerHTML = `<svg class="o1-star" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 1.5l2.4 7.6 8.1.1-6.5 4.8 2.4 7.7L12 17l-6.4 4.7L8 14 1.5 9.2l8.1-.1z"/></svg>${n > 1 ? `<span class="o1-count">${n}</span>` : ''}`;
    el.setAttribute('aria-label', n > 1 ? `${n} places` : `Place: ${group.items[0].name}`);
  }
  const mine = S.selected && group.items.some(p => p.eventIds.includes(S.selected));
  el.classList.toggle('is-dim', Boolean(S.selected && !mine));
}
let popup = null;
function showPopup(lngLat, htmlText) {
  popup?.remove();
  popup = new maplibregl.Popup({ className: 'o1-popup', offset: 18, maxWidth: '260px' }).setLngLat(lngLat).setHTML(htmlText).addTo(S.map);
  return popup;
}
function photoClick(group) {
  if (group.items.length > 1 && S.map.getZoom() < 15) { zoomToGroup(S.map, S.ctx, group); return; }
  const photo = group.items[0];
  const event = S.trip.eventById(photo.eventId);
  showPopup([group.lng, group.lat], `<div class="o1-pop-img" style="background-image:url('${photo.preview || ''}')"></div><b>${escapeHtml(event?.title || '')}</b><small>${escapeHtml(photo.takenLabel || '')}${photo.sharp ? '' : ' · blurred preview'}${group.items.length > 1 ? ` · ${group.items.length} photos` : ''}</small>`);
}
function placeClick(group) {
  if (group.items.length > 1 && S.map.getZoom() < 15) { zoomToGroup(S.map, S.ctx, group, 16); return; }
  const place = group.items[0];
  showPopup([place.lng, place.lat], `<b>${escapeHtml(place.name)}</b><small>${escapeHtml(place.category)}${place.photoIds.length ? ` · ${place.photoIds.length} linked photo${place.photoIds.length > 1 ? 's' : ''}` : ''}</small>`);
}
function stopClick(event) {
  const feature = event.features?.[0];
  if (!feature) return;
  const ids = feature.properties.events.split(' ').filter(Boolean);
  if (ids.length === 1) { popup?.remove(); S.ctx.onEventPicked(ids[0]); return; }
  const node = showPopup(feature.geometry.coordinates, `<b>${escapeHtml(feature.properties.name)}</b>${ids.map(id => { const e = S.trip.eventById(id); return `<button type="button" class="o1-choice" data-event="${escapeHtml(id)}">${escapeHtml(`${S.trip.eventWord} ${e.number} · ${e.title}`)}<small>${escapeHtml(e.date)}</small></button>`; }).join('')}`);
  node.getElement().addEventListener('click', clickEvent => {
    const button = clickEvent.target.closest('[data-event]');
    if (button) { node.remove(); S.ctx.onEventPicked(button.dataset.event); }
  });
}

// --------------------------------------------------------------- animation
function startJob(settle, final) {
  cancelJob();
  const job = { cancelled: false, clocks: new Set(), settle, final };
  S.job = job;
  S.ctx.onPlayState(true);
  return job;
}
function cancelJob(mode) {
  const job = S?.job;
  if (!job) return;
  job.cancelled = true;
  job.clocks.forEach(c => c.cancel());
  S.job = null;
  S.map.stop();
  if (mode === 'settle') job.settle();
  if (mode === 'final') job.final();
  S.ctx.onPlayState(false);
}
function interrupt() { if (S?.job) cancelJob('settle'); }
// Start the move first, then listen: easeTo stops any earlier move and that
// stop emits its own moveend synchronously.
function moved(duration) {
  return new Promise(resolve => {
    let done = false;
    const finish = () => { if (!done) { done = true; clearTimeout(timer); S?.map?.off('moveend', finish); resolve(); } };
    const timer = setTimeout(finish, duration + 400);
    S.map.on('moveend', finish);
  });
}
const easeCamera = (job, camera, duration) => {
  if (job.cancelled) return Promise.resolve();
  S.map.easeTo({ ...camera, duration, essential: true });
  return moved(duration);
};
const flyCamera = (job, camera, duration) => {
  if (job.cancelled) return Promise.resolve();
  S.map.flyTo({ ...camera, duration, curve: 1.25, essential: true });
  return moved(duration);
};
const playClock = (job, duration, onFrame) => new Promise(resolve => {
  if (job.cancelled) return resolve();
  const c = clock(duration, onFrame, () => { job.clocks.delete(c); resolve(); }, { perf: S.ctx.perf });
  job.clocks.add(c);
});

function project(coords) {
  const out = new Array(coords.length);
  for (let i = 0; i < coords.length; i++) out[i] = S.map.project(coords[i]);
  return out;
}
function strokeTrail(context, pts, leg, alpha, w) {
  if (pts.length < 2) return;
  context.beginPath();
  context.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) context.lineTo(pts[i].x, pts[i].y);
  const dash = leg.tbd ? [0.1, 2.6] : CORE_DASH[leg.mode];
  context.setLineDash(dash ? dash.map(v => v * w) : []);
  context.lineCap = dash && dash[0] < 0.5 ? 'round' : 'butt';
  context.lineWidth = w;
  context.globalAlpha = alpha;
  context.strokeStyle = glow(leg.mode);
  context.stroke();
}
// One frame of comets: every leg that has started keeps its travelled trail,
// active legs add a glowing tail and head (additive blending).
function drawComets(entries, progress, coarse) {
  const { context, width: w, height: h } = S.overlay;
  context.clearRect(0, 0, w, h);
  context.globalCompositeOperation = 'source-over';
  const heads = [];
  for (const entry of entries) {
    if (progress <= entry.start) continue;
    const local = Math.min(1, (progress - entry.start) / (entry.end - entry.start || 1));
    const path = coarse ? entry.leg.coarse : entry.leg.lite;
    const pts = project(local >= 1 ? path.coords : prefix(path, local));
    strokeTrail(context, pts, entry.leg, 0.95, 2.4);
    if (local < 1) heads.push({ pts, leg: entry.leg });
  }
  context.globalCompositeOperation = S.dark ? 'lighter' : 'source-over';
  context.setLineDash([]);
  context.lineCap = 'round';
  for (const { pts, leg } of heads) {
    // Tail: walk back ~150 px along the projected trail.
    let length = 0, i = pts.length - 1;
    const tail = [pts[i]];
    while (i > 0 && length < 150) { length += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); tail.push(pts[--i]); }
    const n = tail.length;
    for (let k = n - 1; k > 0; k--) {
      const f = 1 - k / n;
      context.beginPath();
      context.moveTo(tail[k].x, tail[k].y); context.lineTo(tail[k - 1].x, tail[k - 1].y);
      context.globalAlpha = 0.08 + 0.6 * f * f;
      context.lineWidth = 1.5 + 6 * f;
      context.strokeStyle = glow(leg.mode);
      context.stroke();
    }
    const head = pts[pts.length - 1];
    const gradient = context.createRadialGradient(head.x, head.y, 0, head.x, head.y, 24);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.2, glow(leg.mode));
    gradient.addColorStop(1, S.dark ? 'rgba(0,0,0,0)' : 'rgba(255,255,255,0)');
    context.globalAlpha = 1;
    context.fillStyle = gradient;
    context.beginPath(); context.arc(head.x, head.y, 24, 0, Math.PI * 2); context.fill();
  }
  context.globalCompositeOperation = 'source-over';
  context.globalAlpha = 1;
  return heads.map(h => h.pts[h.pts.length - 1]);
}

function settleRoutes() {
  S.overlay.clear();
  S.hidden.clear();
  applyRouteState();
  S.container.classList.remove('o1-hidden-markers');
}
function setSelected(id, landed) {
  S.selected = id;
  S.landed = landed;
  if (!landed) S.bloomed.clear();
  applyRouteState();
  S.photos.refresh();
  S.places.refresh();
}
function revealOnce() { if (!S.revealed) { S.revealed = true; reveal(S.map); } }

function overviewCamera() { return cameraFor(S.map, S.ctx, { bounds: S.trip.bounds, maxZoom: 10 }, { extra: 28 }); }

export function showOverview({ opening = false } = {}) {
  if (!S?.map) return;
  cancelJob();
  popup?.remove();
  setSelected(null, false);
  const target = overviewCamera();
  if (!opening || S.reduced) {
    settleRoutes();
    if (!S.revealed || S.reduced) S.map.jumpTo(target); else S.map.easeTo({ ...target, duration: 900 });
    revealOnce();
    return;
  }
  const plan = tracePlan(S.trip.orderedLegs);
  const settle = () => settleRoutes();
  const job = startJob(settle, () => { settle(); S.map.jumpTo(target); });
  S.hidden = new Set(S.trip.legs.map(leg => leg.id));
  applyRouteState();
  S.container.classList.add('o1-hidden-markers');
  const start = { center: [target.center.lng ?? target.center[0], target.center.lat ?? target.center[1]], zoom: 1.15, pitch: 0, bearing: 0 };
  start.center = [start.center[0] - 38, Math.max(-50, start.center[1] - 14)];
  S.map.jumpTo(start);
  revealOnce();
  (async () => {
    const flight = flyCamera(job, target, 2600);
    await new Promise(r => setTimeout(r, 500));
    if (job.cancelled) return;
    await playClock(job, 3400, t => drawComets(plan, ease.inOut(t), true));
    await flight;
    if (job.cancelled) return;
    S.job = null; settle(); S.ctx.onPlayState(false);
  })();
}

function landingCamera(event) {
  const camera = cameraFor(S.map, S.ctx, S.trip.eventFrame(event), { extra: 36 });
  return camera && { ...camera, pitch: 32 };
}

function travel(event, chains, destinationCamera) {
  const legs = chains.flat();
  const settle = () => { settleRoutes(); setSelected(event?.id || S.selected, true); };
  const job = startJob(settle, () => { settle(); if (destinationCamera) S.map.jumpTo(destinationCamera); });
  setSelected(event?.id || S.selected, false);
  S.hidden = new Set(legs.map(leg => leg.id));
  applyRouteState();
  const entries = chains.flatMap(chain => tracePlan(chain));
  const km = Math.max(...chains.map(chain => chain.reduce((sum, leg) => sum + leg.lengthKm, 0)));
  const duration = Math.max(2600, Math.min(5600, 2300 + 560 * Math.log2(1 + km / 12)));
  const frame = cameraFor(S.map, S.ctx, { bounds: S.trip.routeFrame(legs), maxZoom: 12.5 }, { extra: 44 });
  const follow = chains.length === 1;
  const lead = chains[0];
  const leadPlan = tracePlan(lead);
  const bloomTargets = [];
  (async () => {
    await easeCamera(job, frame, 850);
    if (job.cancelled) return;
    S.photos.each(entry => { if (event && entry.group.items.some(p => p.eventId === event.id)) bloomTargets.push(entry); });
    let camBearing = S.map.getBearing(), last = performance.now();
    await playClock(job, duration, (t, now) => {
      const p = t; // linear travel, like the current arrival
      const heads = drawComets(entries, p, false);
      if (follow) {
        const dt = Math.min(64, now - last); last = now;
        const active = leadPlan.find(e => p < e.end) || leadPlan.at(-1);
        const local = Math.min(1, Math.max(0, (p - active.start) / (active.end - active.start || 1)));
        const here = along(active.leg.lite, local), ahead = along(active.leg.lite, Math.min(1, local + 0.06)), behind = along(active.leg.lite, Math.max(0, local - 0.06));
        const heading = bearingOf(behind.point, ahead.point);
        let delta = ((heading - camBearing + 540) % 360) - 180;
        camBearing += delta * (1 - Math.exp(-dt / 420));
        const lean = Math.min(1, t * 3.5), settleOut = t > 0.85 ? (1 - (t - 0.85) / 0.15) : 1;
        const k = lean * settleOut;
        const fc = frame.center.lng !== undefined ? [frame.center.lng, frame.center.lat] : frame.center;
        S.map.jumpTo({
          center: [fc[0] + (here.point[0] - fc[0]) * 0.7 * k, fc[1] + (here.point[1] - fc[1]) * 0.7 * k],
          zoom: frame.zoom + 0.75 * k, pitch: 46 * k, bearing: camBearing * k
        });
      }
      if (heads.length) for (const entry of bloomTargets) {
        if (S.bloomed.has(entry.group.key)) continue;
        const pt = S.map.project([entry.group.lng, entry.group.lat]);
        if (heads.some(h => Math.hypot(h.x - pt.x, h.y - pt.y) < 70)) { S.bloomed.add(entry.group.key); entry.el.classList.add('is-bloom'); }
      }
    });
    if (job.cancelled) return;
    await new Promise(r => setTimeout(r, 200));
    if (job.cancelled) return;
    settleRoutes();
    if (destinationCamera) await easeCamera(job, destinationCamera, 1150);
    if (job.cancelled) return;
    S.job = null; settle(); S.ctx.onPlayState(false);
  })();
}

export function selectEvent(id, { animate = true } = {}) {
  if (!S?.map) return;
  const event = S.trip.eventById(id);
  if (!event) return;
  cancelJob();
  popup?.remove();
  const camera = landingCamera(event);
  if (!animate || S.reduced || !event.legs.length) {
    settleRoutes();
    setSelected(id, true);
    if (camera) { if (!S.revealed || S.reduced || !animate) S.map.jumpTo(camera); else S.map.easeTo({ ...camera, duration: 1000 }); }
    revealOnce();
    return;
  }
  revealOnce();
  travel(event, event.chains, camera);
}

export function playLeg(id) {
  if (!S?.map) return;
  const event = S.trip.eventById(id);
  if (event) { selectEvent(id, { animate: true }); return; }
  const leg = S.trip.legById.get(id);
  if (!leg) return;
  cancelJob();
  const camera = { center: [leg.toPlace.lng, leg.toPlace.lat], zoom: 11, pitch: 32, bearing: 0 };
  travel(S.trip.eventById(leg.eventId), [[leg]], camera);
}

export function skip() { cancelJob('final'); }

export function setReducedMotion(value) {
  if (!S) return;
  S.reduced = Boolean(value);
  if (S.reduced && S.job) cancelJob('final');
}

export function legendSwatch(mode) {
  if (mode === 'tbd') return swatchSvg({ color: S?.dark ? '#b9c7d8' : '#71878a', width: 2.6, dash: [0.1, 6.5] });
  const dash = CORE_DASH[mode] ? CORE_DASH[mode].map(v => v * 2.8) : null;
  return swatchSvg({ color: glow(mode), width: 2.8, dash, cap: dash && dash[0] < 1 ? 'round' : 'butt',
    extra: `<path d="M5 8h54" stroke="${glow(mode)}" stroke-opacity=".28" stroke-width="10" stroke-linecap="round"/>` });
}
export function legendExtras() {
  return [
    { swatch: `<svg width="40" height="20" viewBox="0 0 40 20"><circle cx="20" cy="10" r="4.5" fill="${S?.dark ? '#ffd58a' : '#e8912d'}" stroke="#fff"/><circle cx="20" cy="10" r="8" fill="#ffb94a" opacity=".25"/></svg>`, label: 'Photo (dot)', note: 'blooms into a blurred thumbnail when the comet passes' },
    { swatch: `<svg width="40" height="20" viewBox="0 0 24 24"><path fill="${S?.dark ? '#fff1c4' : '#b07d00'}" stroke="#fff" d="M12 1.5l2.4 7.6 8.1.1-6.5 4.8 2.4 7.7L12 17l-6.4 4.7L8 14 1.5 9.2l8.1-.1z"/></svg>`, label: 'Curated place', note: 'star; a number means several' },
    { swatch: `<svg width="40" height="20" viewBox="0 0 40 20"><circle cx="20" cy="10" r="5" fill="${S?.dark ? '#eaf5ff' : '#1f2b2f'}" stroke="${S?.dark ? '#08111f' : '#fff'}"/></svg>`, label: 'Stop', note: 'hollow ring = TBD stop' }
  ];
}

export function destroy() {
  if (!S) return;
  cancelJob();
  popup?.remove(); popup = null;
  S.offInput?.();
  S.photos?.destroy(); S.places?.destroy(); S.overlay?.destroy();
  S.map?.remove();
  S.container.classList.remove('o1', 'o1-dark', 'o1-light', 'o1-hidden-markers');
  S = null;
}

// Silence unused-import lint in this demo module.
void icon; void fmtKm; void legTitle; void placeIcon;
