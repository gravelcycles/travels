// Option 2 · Transit map. Metro-map styling on the real map (O23): bold cased
// lines in true geography, stations for stops (dashed when TBD), a mode bullet
// on every line, a vehicle token per leg, photo counts on stations at trip
// scale and at their true groups in a city, places as interchange badges.
// The earlier schematic-only view was removed on the owner's correction.
import { MODES, modeOf, tracePlan, clock, ease, icon, escapeHtml, boundsCenter, fmtKm, placeIcon } from '../data.js';
import { createMap, reveal, cameraFor, onUserInput, markerLayer, zoomToGroup, injectStyle, OFM } from './common.js';

export const meta = {
  number: 2, name: 'Transit map', modes: ['light'], keyBackground: '#ffffff',
  tagline: 'The journey drawn with the clarity of a metro map, on the real map: bold cased lines, stations for every stop, a mode bullet on every line and a vehicle token that runs each leg.',
  whatsNew: [
    'Transit-map rendering in SVG over a quiet, light OpenFreeMap basemap: thick cased lines in true geography, return legs drawn side by side, roundel stations.',
    'Mode bullets on lines keep transport readable without colour, including dotted TBD lines.',
    'A vehicle token runs each leg while the camera holds still; a station card lands you in the city.',
    'Photos are counts on stations at trip scale and counts at their true groups once you are in a city; curated places are interchange badges.'
  ],
  keeps: ['Real, light basemap (O23); mode colours and dash patterns; TBD dotted with no casing; dashed TBD stations.', 'Still camera during the leg (850 ms frame, then the token, 900 ms settle).', 'Unselected opening; direct links land without animation; input interrupts; reduced motion shows the end state.'],
  departures: [
    'Stops are stations rather than upright signposts (O07); basemap town names wait until city zoom.',
    'Token run is 1.4–3.6 s per stop rather than the 1.5 s trace.',
    'Whole-trip Replay re-runs the opening (O09).'
  ],
  phone: 'Fits well: bold lines and 44 px stations read at 320 px, and the station card becomes a bottom sheet. Dense clusters (Köln–Düsseldorf) need a pinch at trip scale.'
};

const NS = 'http://www.w3.org/2000/svg';
const DASH = { train: null, boat: '6 5', bus: '15 6', gondola: '0.5 9', walk: '0.5 6', car: '14 4 3 4', bike: '9 5' };
const ROUND = { gondola: true, walk: true };
const INKY = '#1f2b2f';
const CITY_ZOOM = 8.5;
const CSS = `
.o2 { background:#f6f5f0; }
.o2-svg { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; user-select:none; -webkit-user-select:none; }
.o2-svg .o2-hit { pointer-events:auto; }
.o2-svg text { font: 650 13px/1 -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif; paint-order: stroke; stroke:#ffffff; stroke-width:4px; stroke-linejoin:round; fill:${INKY}; }
.o2-svg .o2-label.is-tbd { fill:#5d6b6e; font-weight:600; }
.o2-svg .o2-label.is-minor { font-size:12px; font-weight:500; fill:#4c5a5d; }
.o2-dim { opacity:.22; }
.o2-svg .o2-pill rect { fill:${INKY}; }
.o2-svg .o2-pill text { fill:#fff; stroke:none; font-size:12px; font-weight:700; }
.o2-card { position:absolute; z-index:5; width: 280px; max-width: calc(100% - 20px); background:#fff; border-radius: 16px; box-shadow: 0 12px 36px rgba(20,30,35,.22); padding: 12px 14px 14px; color:${INKY}; font: 14px/1.35 var(--font-ui); }
.o2-card h3 { margin:0 34px 2px 0; font-size:18px; letter-spacing:-.01em; }
.o2-card .o2-card-date { font-size:12px; color:#59686b; }
.o2-card .o2-card-legs { margin:8px 0 0; padding:0; list-style:none; display:grid; gap:4px; font-size:13px; }
.o2-card .o2-card-legs li { display:flex; align-items:center; gap:6px; }
.o2-card .o2-card-legs svg { flex:none; }
.o2-card .o2-strip { display:flex; gap:4px; margin-top:10px; }
.o2-card .o2-strip span { width:40px; height:40px; border-radius:8px; background:#ddd center/cover; }
.o2-card .o2-strip b { align-self:center; font-size:12px; color:#59686b; margin-left:4px; }
.o2-card .o2-places { display:flex; flex-wrap:wrap; gap:4px; margin-top:8px; }
.o2-card .o2-places span { display:inline-flex; align-items:center; gap:4px; padding:4px 8px; border-radius:12px; border:1.5px solid ${INKY}; font-size:12px; font-weight:600; }
.o2-card .o2-card-close { position:absolute; right:4px; top:4px; width:44px; height:44px; border:0; background:none; border-radius:22px; cursor:pointer; color:#59686b; }
.o2-card .o2-choice { display:block; width:100%; min-height:44px; margin-top:4px; border:1px solid #d9d2c3; border-radius:10px; background:transparent; text-align:left; padding:6px 10px; font:inherit; cursor:pointer; }
.o2-card .o2-choice small { display:block; color:#59686b; font-size:12px; }
.o2-count { width:44px; height:44px; display:grid; place-items:center; }
.o2-count span { min-width:28px; height:28px; padding:0 7px; border-radius:14px; background:${INKY}; color:#fff; font:700 12px/28px var(--font-ui); display:inline-flex; align-items:center; gap:3px; box-shadow:0 0 0 2px #fff; }
.o2-xchg { width:44px; height:44px; display:grid; place-items:center; }
.o2-xchg span { height:26px; min-width:26px; padding:0 6px; border-radius:13px; background:#fff; color:${INKY}; border:2.5px solid ${INKY}; display:inline-flex; align-items:center; gap:3px; font:700 12px/1 var(--font-ui); }
@media (max-width: 760px) { .o2-card { left: 10px !important; right: 10px; width:auto; top:auto !important; bottom: calc(var(--safe-b) + 72px); } }
:root[data-reduced] .o2 * { transition:none !important; animation:none !important; }
`;

let S = null;
const el = (name, attrs = {}, parent) => {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  parent?.append(node);
  return node;
};
const glyph = name => icon(name).replace(/^<svg[^>]*>|<\/svg>$/g, '');

export async function mount(container, trip, ctx) {
  injectStyle('lab-o2', CSS);
  container.classList.add('o2');
  S = { trip, ctx, container, reduced: false, selected: null, landed: false, job: null, progress: null, token: null, revealed: false };
  const mine = S;
  const map = await createMap(container, { style: OFM('positron'), center: boundsCenter(trip.bounds), zoom: 4, maxZoom: 16, dragRotate: false, pitchWithRotate: false, touchPitch: false }, { onStyle: styleBasemap });
  if (S !== mine) { map.remove(); return; }
  S.map = map;
  map.touchZoomRotate.disableRotation();
  buildGraph();
  S.svg = el('svg', { class: 'o2-svg', role: 'img', 'aria-label': `Transit map of ${trip.title}` });
  S.svg.style.opacity = 0;
  map.getCanvas().after(S.svg); // below markers, above the basemap
  S.layers = {};
  for (const name of ['edges', 'bullets', 'stations', 'labels', 'badges', 'token']) S.layers[name] = el('g', { class: `o2-${name}` }, S.svg);
  buildElements();
  S.card = document.createElement('div');
  S.card.className = 'o2-card';
  S.card.hidden = true;
  container.append(S.card);
  S.photoCounts = markerLayer(map, { radius: 54, className: 'o2-count', render: renderCount, onClick: group => zoomToGroup(map, ctx, group) });
  S.xchg = markerLayer(map, { radius: 50, className: 'o2-xchg', render: renderXchg, onClick: placesClick });
  S.offInput = onUserInput(map, interrupt);
  map.on('move', schedule);
  map.on('resize', schedule);
  map.on('zoomend', cityMarkers);
  cityMarkers();
}

// A quiet, light basemap so the transit lines lead; town names wait for city zoom.
function styleBasemap(map) {
  const paint = (id, prop, value) => { if (map.getLayer(id)) try { map.setPaintProperty(id, prop, value); } catch (e) { /* skip */ } };
  for (const layer of map.getStyle().layers) {
    const id = layer.id;
    if (layer.type === 'background') paint(id, 'background-color', '#f6f5f0');
    else if (id === 'water') paint(id, 'fill-color', '#d3e1e7');
    else if (layer.type === 'fill') { paint(id, 'fill-color', /park|wood/.test(id) ? '#e4eadc' : '#efede6'); paint(id, 'fill-opacity', 0.6); }
    else if (layer.type === 'line') {
      if (/waterway/.test(id)) paint(id, 'line-color', '#c0d6df');
      else if (/boundary/.test(id)) paint(id, 'line-color', '#cfc8bb');
      else paint(id, 'line-color', '#e7e4dc');
    } else if (layer.type === 'symbol') {
      if (/poi|shield|highway-name|label_other|label_village|label_state|water_name_line|airport/.test(id)) map.setLayoutProperty(id, 'visibility', 'none');
      else {
        paint(id, 'text-color', /country/.test(id) ? '#9aa3a3' : '#6a777a');
        if (/label_(city|town)/.test(id)) map.setLayerZoomRange(id, CITY_ZOOM, 24);
      }
    }
  }
}

// ---------------------------------------------------------------- graph
function buildGraph() {
  const nodes = new Map();
  const ensure = place => {
    if (!nodes.has(place.id)) nodes.set(place.id, { id: place.id, place, name: place.name, events: [], legs: [], photos: 0, pois: [], isEvent: false });
    return nodes.get(place.id);
  };
  for (const leg of S.trip.legs) { ensure(leg.fromPlace).legs.push(leg); ensure(leg.toPlace).legs.push(leg); }
  for (const event of S.trip.events) {
    if (!event.place) continue;
    const node = ensure(event.place);
    node.events.push(event); node.isEvent = true; node.photos += event.photos.length;
    for (const point of event.pois) if (point.located && !node.pois.includes(point)) node.pois.push(point);
  }
  for (const node of nodes.values()) node.tbd = node.events.length ? node.events.every(e => e.tbd) : node.legs.every(l => l.tbd);
  S.nodeMap = nodes;
  S.nodes = [...nodes.values()];
  // Legs between the same two places run side by side like parallel lines.
  const pairs = new Map();
  S.edges = S.trip.legs.map(leg => {
    const key = [leg.from, leg.to].sort().join('|');
    if (!pairs.has(key)) pairs.set(key, []);
    const edge = { leg, key, flip: leg.from > leg.to };
    pairs.get(key).push(edge);
    return edge;
  });
  for (const list of pairs.values()) list.forEach((edge, index) => { edge.lane = index - (list.length - 1) / 2; });
}

function buildElements() {
  for (const edge of S.edges) {
    const leg = edge.leg, m = modeOf(leg.mode);
    edge.casing = leg.tbd ? null : el('path', { fill: 'none', stroke: '#fff', 'stroke-width': 9.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, S.layers.edges);
    edge.line = el('path', { fill: 'none', stroke: m.color, 'stroke-width': leg.tbd ? 4.5 : 5.5, 'stroke-linecap': leg.tbd || ROUND[leg.mode] ? 'round' : 'butt', 'stroke-linejoin': 'round',
      ...(leg.tbd ? { 'stroke-dasharray': '0.5 7.5', opacity: 0.9 } : DASH[leg.mode] ? { 'stroke-dasharray': DASH[leg.mode] } : {}) }, S.layers.edges);
    edge.hit = el('path', { fill: 'none', stroke: 'transparent', 'stroke-width': 22, class: 'o2-hit', style: 'cursor:pointer' }, S.layers.edges);
    edge.hit.addEventListener('click', () => { if (leg.eventId) S.ctx.onEventPicked(leg.eventId); });
    el('title', {}, edge.hit).textContent = `${m.label}${leg.tbd ? ' (TBD)' : ''} · ${leg.fromPlace.name} → ${leg.toPlace.name}`;
    const bullet = el('g', { class: 'o2-bullet' }, S.layers.bullets);
    el('circle', { r: 11.5, fill: '#fff', stroke: m.color, 'stroke-width': 2.5, ...(leg.tbd ? { 'stroke-dasharray': '3 2.4' } : {}) }, bullet);
    el('svg', { x: -8, y: -8, width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: INKY, 'stroke-width': 2.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, bullet).innerHTML = glyph(leg.mode);
    edge.bullet = bullet;
  }
  const measure = document.createElement('canvas').getContext('2d');
  for (const node of S.nodes) {
    const g = el('g', { class: 'o2-station o2-hit', tabindex: 0, role: 'button', 'aria-label': `${node.name}${node.tbd ? ' (TBD)' : ''}`, style: 'cursor:pointer' }, S.layers.stations);
    el('circle', { r: 22, fill: 'transparent' }, g);
    node.ring = el('circle', { r: 14, fill: 'none', stroke: '#d4512c', 'stroke-width': 3, opacity: 0 }, g);
    if (node.isEvent) el('circle', { r: 7.5, fill: '#fff', stroke: node.tbd ? '#5d6b6e' : INKY, 'stroke-width': 3.2, ...(node.tbd ? { 'stroke-dasharray': '3.2 2.6' } : {}) }, g);
    else el('circle', { r: 4.2, fill: '#fff', stroke: node.tbd ? '#71878a' : INKY, 'stroke-width': 2, ...(node.tbd ? { 'stroke-dasharray': '2 2' } : {}) }, g);
    g.addEventListener('click', event => { event.stopPropagation(); stationClick(node); });
    g.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); stationClick(node); } });
    node.g = g;
    node.label = el('text', { class: `o2-label${node.tbd ? ' is-tbd' : ''}${node.isEvent ? '' : ' is-minor'}` }, S.layers.labels);
    node.label.textContent = node.name;
    measure.font = node.isEvent ? '650 13px -apple-system, system-ui, sans-serif' : '500 12px -apple-system, system-ui, sans-serif';
    node.labelWidth = measure.measureText(node.name).width;
    if (node.photos) {
      node.pill = el('g', { class: 'o2-pill' }, S.layers.badges);
      const text = String(node.photos), w = 26 + text.length * 7;
      el('rect', { x: 0, y: -10, width: w, height: 20, rx: 10 }, node.pill);
      el('svg', { x: 5, y: -7, width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: '#fff', 'stroke-width': 2.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, node.pill).innerHTML = glyph('photo');
      el('text', { x: 21, y: 4.5 }, node.pill).textContent = text;
      node.pillWidth = w;
    }
    if (node.pois.length) {
      const n = node.pois.length, w = n > 1 ? 40 : 26;
      node.xchg = el('g', { class: 'o2-hit', role: 'button', tabindex: 0, 'aria-label': `${n} curated place${n > 1 ? 's' : ''} at ${node.name}`, style: 'cursor:pointer' }, S.layers.badges);
      el('rect', { x: -22, y: -22, width: 44, height: 44, fill: 'transparent' }, node.xchg);
      el('rect', { x: -w / 2, y: -13, width: w, height: 26, rx: 13, fill: '#fff', stroke: INKY, 'stroke-width': 2.6 }, node.xchg);
      el('svg', { x: n > 1 ? -15 : -8, y: -8, width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: INKY, 'stroke-width': 2.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, node.xchg).innerHTML = glyph(placeIcon(node.pois[0].category));
      if (n > 1) el('text', { x: 3, y: 4.5, style: 'font-size:12px;font-weight:700;stroke:none;fill:#1f2b2f' }, node.xchg).textContent = n;
      node.xchg.addEventListener('click', event => { event.stopPropagation(); showPlaces(node); });
    }
  }
  S.tokenG = el('g', { class: 'o2-token', opacity: 0 }, S.layers.token);
  S.tokenRect = el('rect', { x: -17, y: -13, width: 34, height: 26, rx: 8, fill: INKY, stroke: '#fff', 'stroke-width': 2.5 }, S.tokenG);
  S.tokenIcon = el('svg', { x: -9, y: -9, width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: '#fff', 'stroke-width': 2.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, S.tokenG);
}

// ---------------------------------------------------------------- render
let raf = 0;
function schedule() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; render(); }); }
const unit = (a, b) => { const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1; return { x: dx / l, y: dy / l }; };
function measured(pts) { const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)); return cum; }
function cut(pts, f) {
  if (f >= 1) return pts;
  const cum = measured(pts), target = cum[cum.length - 1] * Math.max(0, f), out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    if (cum[i] >= target) { const t = (target - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1); out.push({ x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t }); return out; }
    out.push(pts[i]);
  }
  return out;
}
// Offset in screen space so parallel legs sit side by side.
function lane(pts, offset) {
  if (!offset || pts.length < 2) return pts;
  return pts.map((p, i) => {
    const d = unit(pts[Math.max(0, i - 1)], pts[Math.min(pts.length - 1, i + 1)]);
    return { x: p.x - d.y * offset, y: p.y + d.x * offset };
  });
}
const polyPath = pts => (pts.length ? `M${pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('L')}` : '');

function render() {
  if (!S?.svg) return;
  const t0 = performance.now();
  const map = S.map, sel = S.selected, progress = S.progress, zoom = map.getZoom();
  const W = S.container.clientWidth, H = S.container.clientHeight;
  const positions = new Map(S.nodes.map(node => [node.id, map.project([node.place.lng, node.place.lat])]));
  const detail = zoom < 6.5 ? 'coarse' : 'lite';
  let tokenAt = null;
  for (const edge of S.edges) {
    const f = progress ? (progress.get(edge.leg.id) ?? 1) : 1;
    if (f <= 0) { edge.line.setAttribute('d', ''); edge.casing?.setAttribute('d', ''); edge.hit.setAttribute('d', ''); edge.bullet.style.display = 'none'; continue; }
    // A direction-independent lane side, so both directions of a pair separate.
    const pts = lane(edge.leg[detail].coords.map(c => map.project(c)), edge.lane * 7 * (edge.flip ? -1 : 1));
    const drawPts = f < 1 ? cut(pts, f) : pts;
    const d = polyPath(drawPts);
    edge.line.setAttribute('d', d);
    edge.casing?.setAttribute('d', d);
    edge.hit.setAttribute('d', d);
    const dim = sel && edge.leg.eventId !== sel;
    edge.line.classList.toggle('o2-dim', Boolean(dim));
    edge.casing?.classList.toggle('o2-dim', Boolean(dim));
    const showBullet = f >= 1 && measured(pts).at(-1) > (edge.leg.tbd ? 60 : 110);
    edge.bullet.style.display = showBullet ? '' : 'none';
    if (showBullet) {
      const mid = cut(pts, 0.5).at(-1);
      edge.bullet.setAttribute('transform', `translate(${mid.x.toFixed(1)},${mid.y.toFixed(1)})`);
      edge.bullet.classList.toggle('o2-dim', Boolean(dim));
    }
    if (f < 1 && S.token?.legId === edge.leg.id) tokenAt = drawPts.at(-1);
  }
  const atTrip = zoom < CITY_ZOOM, labelBoxes = [];
  const order = S.nodes.slice().sort((a, b) => (b.isEvent - a.isEvent) || (a.tbd - b.tbd));
  for (const node of order) {
    const p = positions.get(node.id);
    const reached = !progress || node.revealed;
    node.g.setAttribute('transform', `translate(${p.x.toFixed(1)},${p.y.toFixed(1)})${reached ? '' : ' scale(0.01)'}`);
    const active = sel && node.events.some(e => e.id === sel);
    node.ring.setAttribute('opacity', active && S.landed ? 1 : 0);
    const dim = sel && !active && !node.legs.some(l => l.eventId === sel);
    node.g.classList.toggle('o2-dim', Boolean(dim));
    let placed = null;
    const pill = atTrip && node.pill ? node.pillWidth + 6 : 0;
    const onScreen = p.x > -60 && p.x < W + 60 && p.y > -30 && p.y < H + 30;
    if (reached && onScreen && (node.isEvent || zoom >= 9)) {
      const w = node.labelWidth + pill, h = 16, r = node.isEvent ? 13 : 9;
      const candidates = [
        { x: p.x + r, y: p.y + 4.5, a: 'start', box: [p.x + r - 2, p.y - h / 2, p.x + r + w, p.y + h / 2] },
        { x: p.x - r, y: p.y + 4.5, a: 'end', box: [p.x - r - w, p.y - h / 2, p.x - r + 2, p.y + h / 2] },
        { x: p.x, y: p.y - r - 5, a: 'middle', box: [p.x - w / 2, p.y - r - 5 - h, p.x + w / 2, p.y - r - 3] },
        { x: p.x, y: p.y + r + 15, a: 'middle', box: [p.x - w / 2, p.y + r + 2, p.x + w / 2, p.y + r + 2 + h] }
      ];
      const scores = candidates.map(c => {
        let score = labelBoxes.some(b => c.box[0] < b[2] && c.box[2] > b[0] && c.box[1] < b[3] && c.box[3] > b[1]) ? 100 : 0;
        for (const leg of node.legs) {
          const dir = unit(p, positions.get(leg.from === node.id ? leg.to : leg.from));
          const cx = (c.box[0] + c.box[2]) / 2 - p.x, cy = (c.box[1] + c.box[3]) / 2 - p.y, cl = Math.hypot(cx, cy) || 1;
          score += Math.max(0, (dir.x * cx + dir.y * cy) / cl) * 6;
        }
        if (c.box[2] > W - 8 || c.box[0] < 8) score += 30;
        return score;
      });
      const best = scores.indexOf(Math.min(...scores));
      if (scores[best] < 100 || active) placed = candidates[best];
      if (placed) {
        labelBoxes.push(placed.box);
        node.label.setAttribute('x', placed.a === 'start' ? placed.x : placed.a === 'end' ? placed.x - pill : placed.x - pill / 2);
        node.label.setAttribute('y', placed.y);
        node.label.setAttribute('text-anchor', placed.a);
        node.label.classList.toggle('o2-dim', Boolean(dim));
      }
    }
    node.label.style.display = placed ? '' : 'none';
    if (node.pill) {
      const show = Boolean(placed && pill);
      node.pill.style.display = show ? '' : 'none';
      if (show) {
        const x = placed.a === 'start' ? placed.x + node.labelWidth + 6 : placed.a === 'end' ? placed.x - node.pillWidth : placed.x + node.labelWidth / 2 - (node.pillWidth + 6) / 2 + 6;
        node.pill.setAttribute('transform', `translate(${x.toFixed(1)},${(placed.y - 4.5).toFixed(1)})`);
        node.pill.classList.toggle('o2-dim', Boolean(dim));
      }
    }
    if (node.xchg) {
      let room = Infinity;
      for (const other of S.nodes) if (other !== node && other.isEvent) { const q = positions.get(other.id); room = Math.min(room, Math.hypot(q.x - p.x, q.y - p.y)); }
      node.xchg.style.display = reached && atTrip && onScreen && (active || room > 58) ? '' : 'none';
      node.xchg.setAttribute('transform', `translate(${p.x.toFixed(1)},${(placed && placed.y > p.y + 4 ? p.y - 27 : p.y + 27).toFixed(1)})`);
      node.xchg.classList.toggle('o2-dim', Boolean(dim));
    }
  }
  if (S.token && tokenAt) {
    S.tokenG.setAttribute('transform', `translate(${tokenAt.x.toFixed(1)},${tokenAt.y.toFixed(1)})`);
    S.tokenG.setAttribute('opacity', 1);
  } else S.tokenG.setAttribute('opacity', 0);
  if (S.job) S.ctx.perf(performance.now() - t0);
}
// In a city, photos and places appear at their true groups instead of on the station.
function cityMarkers() {
  if (!S?.map) return;
  const city = S.map.getZoom() >= CITY_ZOOM;
  S.photoCounts.set(city ? S.trip.located : []);
  S.xchg.set(city ? S.trip.locatedPois : []);
  schedule();
}

// ---------------------------------------------------------------- markers & cards
function renderCount(element, group, first) {
  if (!first) return;
  element.innerHTML = `<span>${icon('photo', { size: 13, stroke: 2.4 })}${group.items.length}</span>`;
  element.setAttribute('aria-label', `${group.items.length} photo${group.items.length > 1 ? 's' : ''} here`);
}
function renderXchg(element, group, first) {
  if (!first) return;
  element.innerHTML = `<span>${icon(placeIcon(group.items[0].category), { size: 14, stroke: 2.4 })}${group.items.length > 1 ? group.items.length : ''}</span>`;
  element.setAttribute('aria-label', group.items.length > 1 ? `${group.items.length} places` : `Place: ${group.items[0].name}`);
}
function placesClick(group) {
  if (group.items.length > 1 && S.map.getZoom() < 15) { zoomToGroup(S.map, S.ctx, group, 16); return; }
  showCard(`<h3>${escapeHtml(group.items[0].name)}</h3><div class="o2-card-date">${escapeHtml(group.items[0].category)}</div>`, S.map.project([group.lng, group.lat]));
}
function showCard(html, at) {
  S.card.innerHTML = `<button type="button" class="o2-card-close" aria-label="Close"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>${html}`;
  S.card.hidden = false;
  const W = S.container.clientWidth, inset = S.ctx.insets();
  const x = Math.min(W - 300, Math.max(10, (at?.x ?? 20) + 22));
  const y = Math.max(inset.top, Math.min(S.container.clientHeight - inset.bottom - S.card.offsetHeight, (at?.y ?? inset.top) - 40));
  S.card.style.left = `${x}px`; S.card.style.top = `${y}px`;
  S.card.querySelector('.o2-card-close').addEventListener('click', () => { S.card.hidden = true; });
  return S.card;
}
function hideCard() { if (S?.card) S.card.hidden = true; }
const nodePos = node => S.map.project([node.place.lng, node.place.lat]);
function stationCard(event) {
  const node = S.nodeMap.get(event.place?.id);
  if (!node) return;
  const legs = event.legs.map(leg => `<li>${icon(leg.mode, { size: 16, stroke: 2.2 })}<span>${escapeHtml(`${modeOf(leg.mode).label}${leg.tbd ? ' (TBD)' : ''} · ${leg.fromPlace.name} → ${leg.toPlace.name}`)} <span style="color:#59686b">${escapeHtml(fmtKm(leg.km))}</span></span></li>`).join('');
  const strip = event.photos.slice(0, 5).map(p => `<span style="background-image:url('${p.preview || ''}')"></span>`).join('');
  const places = event.pois.map(p => `<span>${icon(placeIcon(p.category), { size: 12, stroke: 2.4 })}${escapeHtml(p.name)}</span>`).join('');
  showCard(`<h3>${escapeHtml(event.title)}</h3><div class="o2-card-date">${event.tbd ? '<span class="lab-tbd">TBD</span>' : ''}${escapeHtml(`${S.trip.eventWord} ${event.number} · ${event.date.replace(/^TBD · /, '')}`)}</div>
    ${legs ? `<ul class="o2-card-legs">${legs}</ul>` : ''}
    ${strip ? `<div class="o2-strip">${strip}<b>${event.photos.length} photo${event.photos.length > 1 ? 's' : ''}</b></div>` : ''}
    ${places ? `<div class="o2-places">${places}</div>` : ''}`, nodePos(node));
}
function showPlaces(node) {
  showCard(`<h3>${escapeHtml(node.name)}</h3><div class="o2-card-date">${node.pois.length} curated place${node.pois.length > 1 ? 's' : ''}</div><div class="o2-places">${node.pois.map(p => `<span>${icon(placeIcon(p.category), { size: 12, stroke: 2.4 })}${escapeHtml(p.name)}</span>`).join('')}</div>`, nodePos(node));
}
function stationClick(node) {
  interrupt();
  if (node.events.length === 1) { S.ctx.onEventPicked(node.events[0].id); return; }
  if (!node.events.length) { showCard(`<h3>${escapeHtml(node.name)}</h3><div class="o2-card-date">Transfer · ${node.legs.length} line${node.legs.length > 1 ? 's' : ''}</div>`, nodePos(node)); return; }
  const card = showCard(`<h3>${escapeHtml(node.name)}</h3>${node.events.map(e => `<button type="button" class="o2-choice" data-event="${escapeHtml(e.id)}">${escapeHtml(`${S.trip.eventWord} ${e.number} · ${e.title}`)}<small>${escapeHtml(e.date)}</small></button>`).join('')}`, nodePos(node));
  card.addEventListener('click', event => { const b = event.target.closest('[data-event]'); if (b) { hideCard(); S.ctx.onEventPicked(b.dataset.event); } }, { once: true });
}

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
const easeCamera = (job, camera, duration) => { if (job.cancelled || !camera) return Promise.resolve(); S.map.easeTo({ ...camera, duration, essential: true }); return moved(duration); };
function revealAll() { S.progress = null; S.token = null; for (const node of S.nodes) node.revealed = true; }
function revealOnce() {
  if (S.revealed) return;
  S.revealed = true;
  reveal(S.map);
  S.svg.style.opacity = 1;
}
const overviewCamera = () => cameraFor(S.map, S.ctx, { bounds: S.trip.bounds, maxZoom: 10 }, { extra: 40 });
const landingCamera = event => cameraFor(S.map, S.ctx, S.trip.eventFrame(event), { extra: 44 });

export function showOverview({ opening = false } = {}) {
  if (!S?.svg) return;
  cancelJob(); hideCard();
  S.selected = null; S.landed = false;
  const camera = overviewCamera();
  if (!opening || S.reduced) {
    revealAll();
    if (!S.revealed || S.reduced) S.map.jumpTo(camera); else S.map.easeTo({ ...camera, duration: 850 });
    revealOnce(); render();
    return;
  }
  const settle = () => { revealAll(); render(); };
  const job = startJob(settle, () => { S.map.jumpTo(camera); settle(); });
  S.map.jumpTo(camera);
  // Lines build station by station over the real map with the camera still (3 s).
  const plan = tracePlan(S.trip.orderedLegs);
  S.progress = new Map(plan.map(e => [e.leg.id, 0]));
  for (const node of S.nodes) node.revealed = !node.legs.length || node.id === S.trip.orderedLegs[0]?.from;
  revealOnce();
  (async () => {
    await playClock(job, 3000, t => {
      for (const entry of plan) {
        const f = Math.max(0, Math.min(1, (t - entry.start) / (entry.end - entry.start || 1)));
        S.progress.set(entry.leg.id, f);
        if (f > 0) S.nodeMap.get(entry.leg.from).revealed = true;
        if (f >= 1) S.nodeMap.get(entry.leg.to).revealed = true;
      }
      render();
    });
    if (job.cancelled) return;
    S.job = null; settle(); S.ctx.onPlayState(false);
  })();
}

function runToken(job, chains) {
  const entries = chains.flatMap(chain => tracePlan(chain, () => 1));
  S.progress = new Map(entries.map(e => [e.leg.id, 0]));
  const duration = Math.max(1400, Math.min(3600, 900 * Math.max(...chains.map(c => c.length))));
  return playClock(job, duration, t => {
    const p = ease.inOut(t);
    let active = null;
    for (const entry of entries) {
      const f = Math.max(0, Math.min(1, (p - entry.start) / (entry.end - entry.start || 1)));
      S.progress.set(entry.leg.id, f);
      if (f > 0 && f < 1 && !active) active = entry.leg;
    }
    if (active && S.token?.legId !== active.id) {
      S.token = { legId: active.id };
      S.tokenRect.setAttribute('fill', modeOf(active.mode).color);
      S.tokenIcon.innerHTML = glyph(active.mode);
    }
    if (!active) S.token = null;
    render();
  });
}
function land(event) { S.landed = true; revealAll(); render(); stationCard(event); }

export function selectEvent(id, { animate = true } = {}) {
  if (!S?.svg) return;
  const event = S.trip.eventById(id);
  if (!event) return;
  cancelJob(); hideCard();
  S.selected = id; S.landed = false;
  const destination = landingCamera(event);
  if (!animate || S.reduced || !event.legs.length) {
    revealAll();
    if (destination) { if (!S.revealed || S.reduced || !animate) S.map.jumpTo(destination); else S.map.easeTo({ ...destination, duration: 900 }); }
    revealOnce();
    land(event);
    return;
  }
  revealOnce();
  const job = startJob(() => land(event), () => { if (destination) S.map.jumpTo(destination); land(event); });
  revealAll();
  (async () => {
    await easeCamera(job, cameraFor(S.map, S.ctx, { bounds: S.trip.routeFrame(event.legs), maxZoom: 12.5 }, { extra: 50 }), 850);
    if (job.cancelled) return;
    await runToken(job, event.chains);
    if (job.cancelled) return;
    S.progress = null; S.token = null; render();
    await easeCamera(job, destination, 900);
    if (job.cancelled) return;
    S.job = null; land(event); S.ctx.onPlayState(false);
  })();
}
export function playLeg(id) {
  if (!S?.svg) return;
  if (S.trip.eventById(id)) { selectEvent(id, { animate: true }); return; }
  const leg = S.trip.legById.get(id);
  if (!leg) return;
  const event = S.trip.eventById(leg.eventId);
  cancelJob(); hideCard();
  S.selected = event.id;
  const job = startJob(() => land(event), () => land(event));
  (async () => { await runToken(job, [[leg]]); if (job.cancelled) return; S.job = null; land(event); S.ctx.onPlayState(false); })();
}
export function skip() { cancelJob('final'); }
export function setReducedMotion(value) { if (!S) return; S.reduced = Boolean(value); if (S.reduced && S.job) cancelJob('final'); }

export function legendSwatch(mode) {
  if (mode === 'tbd') return '<svg width="64" height="16" viewBox="0 0 64 16"><path d="M5 8h54" stroke="#0072b2" stroke-width="4.5" stroke-linecap="round" stroke-dasharray="0.5 7.5"/></svg>';
  const m = MODES[mode];
  return `<svg width="64" height="16" viewBox="0 0 64 16"><path d="M5 8h54" stroke="#fff" stroke-width="9"/><path d="M5 8h54" stroke="${m.color}" stroke-width="5.5" stroke-linecap="${ROUND[mode] ? 'round' : 'butt'}" ${DASH[mode] ? `stroke-dasharray="${DASH[mode]}"` : ''}/></svg>`;
}
export function legendExtras() {
  return [
    { swatch: `<svg width="60" height="24" viewBox="0 0 60 24"><circle cx="30" cy="12" r="10" fill="#fff" stroke="#0072b2" stroke-width="2.4"/><g transform="translate(23 5) scale(.58)" fill="none" stroke="#1f2b2f" stroke-width="2.4">${glyph('train')}</g></svg>`, label: 'Mode bullet', note: 'names the mode on every line, also when TBD' },
    { swatch: '<svg width="60" height="24" viewBox="0 0 60 24"><circle cx="18" cy="12" r="7" fill="#fff" stroke="#1f2b2f" stroke-width="3"/><circle cx="42" cy="12" r="7" fill="#fff" stroke="#5d6b6e" stroke-width="3" stroke-dasharray="3 2.4"/></svg>', label: 'Stop station', note: 'dashed = TBD; small ring = transfer' },
    { swatch: '<svg width="60" height="24" viewBox="0 0 60 24"><rect x="12" y="2" width="36" height="20" rx="10" fill="#1f2b2f"/><text x="34" y="16" fill="#fff" font-size="12" font-weight="700" text-anchor="middle">24</text></svg>', label: 'Photo count', note: 'album size on the station; true groups once in a city' },
    { swatch: '<svg width="60" height="24" viewBox="0 0 60 24"><rect x="17" y="1" width="26" height="22" rx="11" fill="#fff" stroke="#1f2b2f" stroke-width="2.5"/></svg>', label: 'Curated places', note: 'interchange badge with a count' }
  ];
}

export function destroy() {
  if (!S) return;
  cancelJob(); cancelAnimationFrame(raf); raf = 0;
  S.offInput?.();
  S.photoCounts?.destroy(); S.xchg?.destroy();
  S.svg?.remove();
  S.map?.remove();
  S.container.classList.remove('o2');
  S = null;
}
