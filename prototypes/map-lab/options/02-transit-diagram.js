// Option 2 · Transit diagram. The trip as a metro map: an octilinear
// schematic solved from the real itinerary, stations for stops, mode bullets
// on every line, a vehicle token per leg, and a morph to real geography.
import { MODES, modeOf, merc, along, prefix, tracePlan, clock, ease, icon, escapeHtml, boundsCenter, fmtKm, fmtDuration, placeIcon, resample } from '../data.js';
import { createMap, reveal, cameraFor, onUserInput, markerLayer, zoomToGroup, injectStyle, OFM } from './common.js';

export const meta = {
  number: 2, name: 'Transit diagram', theme: 'light', keyBackground: '#ffffff',
  tagline: 'The journey drawn like a metro map: every stop is a station, every leg a line at 45° angles, and a vehicle token runs the line. One tap morphs the diagram back into real geography.',
  whatsNew: [
    'Octilinear schematic solved in the browser from the itinerary (relaxation with 45° snapping), re-laid out for the screen’s shape, so a phone gets a tall diagram.',
    'Mode bullets on every line keep transport readable without colour, including dotted TBD lines.',
    'Animated morph between the diagram and true geography; stations, lines and labels travel together.',
    'Photos are counts on stations; curated places are interchange-style badges; a station card lands you in the city.'
  ],
  keeps: ['Mode colours and dash patterns; TBD dotted with no casing; dashed TBD stations.', 'Unselected opening; direct links land without animation; input interrupts; reduced motion shows the end state.', 'No photo is placed at an invented coordinate (diagram shows counts only).'],
  departures: [
    'Default view is not geographic (O06 makes the map the main experience).',
    'No basemap or terrain in diagram mode; distance and direction are approximate by design.',
    'Stops are stations rather than upright signposts (O07); whole-trip Replay re-runs the opening (O09).'
  ],
  phone: 'Best phone fit of the five: the layout is re-solved for a tall screen, labels never compete with basemap names and every station is a 44 px target. Very long trips get dense at 320 px; pinch to zoom.'
};

const NS = 'http://www.w3.org/2000/svg';
const DASH = { train: null, boat: '6 5', bus: '15 6', gondola: '0.5 9', walk: '0.5 6', car: '14 4 3 4', bike: '9 5' };
const ROUND = { gondola: true, walk: true };
const INKY = '#1f2b2f';
const CSS = `
.o2 { background:#f6f5f0; }
.o2 .lab-map { transition: opacity 600ms; }
.o2-svg { position:absolute; inset:0; width:100%; height:100%; touch-action:none; user-select:none; -webkit-user-select:none; }
.o2.is-geo .o2-svg { pointer-events:none; }
.o2.is-geo .o2-svg .o2-hit { pointer-events:auto; }
.o2-svg text { font: 650 13px/1 -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif; paint-order: stroke; stroke:#f6f5f0; stroke-width:4px; stroke-linejoin:round; fill:${INKY}; }
.o2.is-geo .o2-svg text { stroke:#ffffff; }
.o2-svg .o2-label.is-tbd { fill:#5d6b6e; font-weight:600; }
.o2-svg .o2-label.is-minor { font-size:12px; font-weight:500; fill:#4c5a5d; }
.o2-svg .o2-date { font-size:12px; font-weight:500; fill:#59686b; }
.o2-station { transition: transform 260ms cubic-bezier(.2,.9,.3,1.3); }
.o2-hidden { opacity:0; }
.o2-fade { transition: opacity 260ms; }
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
.o2-card .o2-card-actions { display:flex; gap:6px; margin-top:10px; }
.o2-card .o2-card-actions button { height:44px; padding:0 14px; border-radius:22px; border:1.5px solid ${INKY}; background:#fff; font:600 13px var(--font-ui); cursor:pointer; }
.o2-card .o2-choice { display:block; width:100%; min-height:44px; margin-top:4px; border:1px solid #d9d2c3; border-radius:10px; background:transparent; text-align:left; padding:6px 10px; font:inherit; cursor:pointer; }
.o2-card .o2-choice small { display:block; color:#59686b; font-size:12px; }
.o2-count { width:44px; height:44px; display:grid; place-items:center; }
.o2-count span { min-width:28px; height:28px; padding:0 7px; border-radius:14px; background:${INKY}; color:#fff; font:700 12px/28px var(--font-ui); display:inline-flex; align-items:center; gap:3px; box-shadow:0 0 0 2px #fff; }
.o2-xchg { width:44px; height:44px; display:grid; place-items:center; }
.o2-xchg span { height:26px; min-width:26px; padding:0 6px; border-radius:13px; background:#fff; color:${INKY}; border:2.5px solid ${INKY}; display:inline-flex; align-items:center; gap:3px; font:700 12px/1 var(--font-ui); }
.o2-hide-geo-markers .o2-count, .o2-hide-geo-markers .o2-xchg { display:none; }
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

export async function mount(container, trip, ctx) {
  injectStyle('lab-o2', CSS);
  container.classList.add('o2', 'o2-hide-geo-markers');
  S = { trip, ctx, container, reduced: false, selected: null, landed: false, job: null, geo: 0, view: { s: 1, x: 0, y: 0 }, progress: null, token: null, revealed: false };
  const mine = S;
  const map = await createMap(container, { style: OFM('positron'), center: boundsCenter(trip.bounds), zoom: 4, maxZoom: 16, dragRotate: false, pitchWithRotate: false, touchPitch: false }, { onStyle: m => {
    for (const layer of m.getStyle().layers) {
      if (/poi|shield|highway-name|label_other|label_village/.test(layer.id)) m.setLayoutProperty(layer.id, 'visibility', 'none');
      if (layer.type === 'background') m.setPaintProperty(layer.id, 'background-color', '#f4f4f1');
    }
  } });
  if (S !== mine) { map.remove(); return; }
  S.map = map;
  map.touchZoomRotate.disableRotation();
  map.getContainer().style.visibility = 'hidden';
  buildGraph();
  S.svg = el('svg', { class: 'o2-svg', role: 'img', 'aria-label': `Transit diagram of ${trip.title}` });
  S.svg.style.opacity = 0;
  container.append(S.svg);
  S.layers = {};
  for (const name of ['edges', 'trail', 'bullets', 'stations', 'labels', 'badges', 'token']) S.layers[name] = el('g', { class: `o2-${name}` }, S.svg);
  buildElements();
  S.lastSize = [container.clientWidth, container.clientHeight];
  layout();
  fitDiagram(S.nodes);
  S.card = document.createElement('div');
  S.card.className = 'o2-card';
  S.card.hidden = true;
  container.append(S.card);
  S.photoCounts = markerLayer(map, { radius: 54, className: 'o2-count', render: renderCount, onClick: group => zoomToGroup(map, ctx, group) });
  S.xchg = markerLayer(map, { radius: 50, className: 'o2-xchg', render: renderXchg, onClick: placesClick });
  buildTools();
  bindGestures();
  S.offInput = onUserInput(map, interrupt);
  map.on('move', () => { if (S.geo > 0) schedule(); });
  S.onResize = () => {
    const size = [container.clientWidth, container.clientHeight];
    const ratio = (size[0] / size[1]) / (S.lastSize[0] / S.lastSize[1]);
    S.lastSize = size;
    if (ratio > 1.4 || ratio < 0.7) { layout(); }
    fitDiagram(S.selected ? focusNodes(S.trip.eventById(S.selected)) : S.nodes);
    schedule();
  };
  window.addEventListener('resize', S.onResize);
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
  const pairs = new Map();
  S.edges = S.trip.legs.map(leg => {
    const key = [leg.from, leg.to].sort().join('|');
    if (!pairs.has(key)) pairs.set(key, []);
    const edge = { leg, u: nodes.get(leg.from), v: nodes.get(leg.to), key };
    pairs.get(key).push(edge);
    return edge;
  });
  for (const list of pairs.values()) list.forEach((edge, index) => { edge.lane = index - (list.length - 1) / 2; });
  S.pairs = pairs;
}

// Octilinear relaxation: edges snap toward multiples of 45°, stations repel,
// and a weak anchor keeps the drawing recognisably like the real map.
function layout() {
  const W = Math.max(320, S.container.clientWidth), H = Math.max(420, S.container.clientHeight - 140);
  const list = S.nodes, n = list.length;
  const m = list.map(node => merc([node.place.lng, node.place.lat]));
  let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
  for (const [x, y] of m) { minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y); }
  const spanx = Math.max(1e-6, maxx - minx), spany = Math.max(1e-6, maxy - miny);
  const sx = W / spanx, sy = H / spany, s = Math.min(sx, sy);
  const kx = s + (sx - s) * 0.7, ky = s + (sy - s) * 0.7;
  const orig = m.map(([x, y], i) => ({ x: (x - minx) * kx + (i % 3) * 0.01, y: (y - miny) * ky + (i % 5) * 0.01 }));
  const p = orig.map(o => ({ ...o }));
  const index = new Map(list.map((node, i) => [node.id, i]));
  const unique = [...S.pairs.values()].map(edges => [index.get(edges[0].u.id), index.get(edges[0].v.id)]).filter(([a, b]) => a !== b);
  const L = Math.sqrt((W * H) / Math.max(6, n)) * 0.62;
  const step = Math.PI / 4;
  for (let it = 0; it < 520; it++) {
    const k = 0.42 * (1 - it / 640);
    for (const [a, b] of unique) {
      const dx = p[b].x - p[a].x, dy = p[b].y - p[a].y, len = Math.hypot(dx, dy) || 1e-6;
      const snap = Math.round(Math.atan2(dy, dx) / step) * step;
      const tl = Math.max(0.5 * L, Math.min(1.7 * L, len));
      const cx = (Math.cos(snap) * tl - dx) * 0.5 * k, cy = (Math.sin(snap) * tl - dy) * 0.5 * k;
      p[a].x -= cx; p[a].y -= cy; p[b].x += cx; p[b].y += cy;
    }
    const minD = 0.62 * L;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const dx = p[j].x - p[i].x, dy = p[j].y - p[i].y, d = Math.hypot(dx, dy) || 1e-3;
      if (d < minD) { const f = ((minD - d) / d) * 0.22; p[i].x -= dx * f; p[i].y -= dy * f; p[j].x += dx * f; p[j].y += dy * f; }
    }
    for (let i = 0; i < n; i++) { p[i].x += (orig[i].x - p[i].x) * 0.006; p[i].y += (orig[i].y - p[i].y) * 0.006; }
  }
  // Final pass: make each edge exactly octilinear where it is nearly so.
  list.forEach((node, i) => { node.sx = p[i].x; node.sy = p[i].y; });
  for (const edge of S.edges) edge.sch = routeEdge(edge);
}
function routeEdge(edge) {
  const a = { x: edge.u.sx, y: edge.u.sy }, b = { x: edge.v.sx, y: edge.v.sy };
  const dx = b.x - a.x, dy = b.y - a.y, adx = Math.abs(dx), ady = Math.abs(dy);
  if (adx < 1e-6 || ady < 1e-6 || Math.abs(adx - ady) < Math.max(adx, ady) * 0.04) return [a, b];
  const diag = Math.min(adx, ady), sxn = Math.sign(dx), syn = Math.sign(dy);
  const diagFirst = { x: a.x + sxn * diag, y: a.y + syn * diag };
  const straightFirst = adx > ady ? { x: b.x - sxn * diag, y: a.y } : { x: a.x, y: b.y - syn * diag };
  // Choose the bend whose first direction is closer to the real departure.
  const start = edge.leg.coarse.coords[0], early = along(edge.leg.coarse, 0.25).point;
  const [mx0, my0] = merc(start), [mx1, my1] = merc(early);
  const real = Math.atan2(my1 - my0, mx1 - mx0);
  const angle = q => Math.abs(((Math.atan2(q.y - a.y, q.x - a.x) - real + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
  return [a, angle(diagFirst) <= angle(straightFirst) ? diagFirst : straightFirst, b];
}

// ---------------------------------------------------------------- view transform
const toScreen = q => ({ x: q.x * S.view.s + S.view.x, y: q.y * S.view.s + S.view.y });
function fitDiagram(nodes, { animate = false, duration = 700 } = {}) {
  if (!nodes.length) return;
  const inset = S.ctx.insets();
  const W = S.container.clientWidth, H = S.container.clientHeight;
  let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
  for (const node of nodes) { minx = Math.min(minx, node.sx); maxx = Math.max(maxx, node.sx); miny = Math.min(miny, node.sy); maxy = Math.max(maxy, node.sy); }
  const padX = 34, padRight = 96;
  const availW = Math.max(80, W - inset.left - inset.right - padX - padRight), availH = Math.max(80, H - inset.top - inset.bottom - 60);
  const spanx = Math.max(maxx - minx, 1), spany = Math.max(maxy - miny, 1);
  let s = Math.min(availW / spanx, availH / spany);
  s = Math.min(s, nodes.length <= 3 ? 2.2 : 3);
  const target = { s, x: inset.left + padX + (availW - spanx * s) / 2 - minx * s, y: inset.top + 30 + (availH - spany * s) / 2 - miny * s };
  if (!animate || S.reduced) { S.view = target; schedule(); return Promise.resolve(); }
  const from = { ...S.view };
  return new Promise(resolve => {
    const c = clock(duration, t => { const k = ease.inOut(t); S.view = { s: from.s + (target.s - from.s) * k, x: from.x + (target.x - from.x) * k, y: from.y + (target.y - from.y) * k }; render(); }, resolve);
    S.viewClock = c;
    if (S.job) S.job.clocks.add(c);
  });
}
function focusNodes(event) {
  if (!event) return S.nodes;
  const set = new Set([event.place?.id, ...event.legs.flatMap(l => [l.from, l.to])].filter(Boolean));
  const list = S.nodes.filter(node => set.has(node.id));
  return list.length ? list : S.nodes;
}

// ---------------------------------------------------------------- elements
function buildElements() {
  for (const edge of S.edges) {
    const leg = edge.leg, m = modeOf(leg.mode);
    edge.casing = leg.tbd ? null : el('path', { fill: 'none', stroke: '#fff', 'stroke-width': 11, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, S.layers.edges);
    edge.line = el('path', { fill: 'none', stroke: m.color, 'stroke-width': leg.tbd ? 5 : 6.5, 'stroke-linecap': leg.tbd || ROUND[leg.mode] ? 'round' : 'butt', 'stroke-linejoin': 'round',
      ...(leg.tbd ? { 'stroke-dasharray': '0.5 8', opacity: 0.9 } : DASH[leg.mode] ? { 'stroke-dasharray': DASH[leg.mode] } : {}) }, S.layers.edges);
    edge.hit = el('path', { fill: 'none', stroke: 'transparent', 'stroke-width': 22, class: 'o2-hit', 'data-leg': leg.id, style: 'cursor:pointer' }, S.layers.edges);
    edge.hit.addEventListener('click', () => { if (leg.eventId) S.ctx.onEventPicked(leg.eventId); });
    const bullet = el('g', { class: 'o2-bullet' }, S.layers.bullets);
    el('circle', { r: 11.5, fill: '#fff', stroke: m.color, 'stroke-width': 2.5, ...(leg.tbd ? { 'stroke-dasharray': '3 2.4' } : {}) }, bullet);
    const glyph = el('svg', { x: -8, y: -8, width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: INKY, 'stroke-width': 2.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, bullet);
    glyph.innerHTML = icon(leg.mode).replace(/^<svg[^>]*>|<\/svg>$/g, '');
    edge.bullet = bullet;
    edge.title = el('title', {}, edge.hit); edge.title.textContent = `${m.label}${leg.tbd ? ' (TBD)' : ''} · ${leg.fromPlace.name} → ${leg.toPlace.name}`;
  }
  const measure = document.createElement('canvas').getContext('2d');
  for (const node of S.nodes) {
    const g = el('g', { class: 'o2-station o2-hit', tabindex: 0, role: 'button', 'aria-label': `${node.name}${node.tbd ? ' (TBD)' : ''}`, style: 'cursor:pointer' }, S.layers.stations);
    el('circle', { r: 22, fill: 'transparent' }, g);
    node.ring = el('circle', { r: 14, fill: 'none', stroke: '#d4512c', 'stroke-width': 3, opacity: 0 }, g);
    if (node.isEvent) el('circle', { r: 8, fill: '#fff', stroke: node.tbd ? '#5d6b6e' : INKY, 'stroke-width': 3.2, ...(node.tbd ? { 'stroke-dasharray': '3.2 2.6' } : {}) }, g);
    else el('circle', { r: 4.5, fill: '#fff', stroke: node.tbd ? '#71878a' : INKY, 'stroke-width': 2, ...(node.tbd ? { 'stroke-dasharray': '2 2' } : {}) }, g);
    g.addEventListener('click', event => { event.stopPropagation(); stationClick(node); });
    g.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); stationClick(node); } });
    node.g = g;
    node.label = el('text', { class: `o2-label${node.tbd ? ' is-tbd' : ''}${node.isEvent ? '' : ' is-minor'}` }, S.layers.labels);
    node.label.textContent = node.name;
    measure.font = node.isEvent ? '650 13px -apple-system, system-ui, sans-serif' : '500 12px -apple-system, system-ui, sans-serif';
    node.labelWidth = measure.measureText(node.name).width;
    if (node.photos) {
      node.pill = el('g', { class: 'o2-pill' }, S.layers.badges);
      const text = String(node.photos);
      const w = 26 + text.length * 7;
      el('rect', { x: 0, y: -10, width: w, height: 20, rx: 10 }, node.pill);
      const cam = el('svg', { x: 5, y: -7, width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: '#fff', 'stroke-width': 2.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, node.pill);
      cam.innerHTML = icon('photo').replace(/^<svg[^>]*>|<\/svg>$/g, '');
      const t = el('text', { x: 21, y: 4.5 }, node.pill); t.textContent = text;
      node.pillWidth = w;
    }
    if (node.pois.length) {
      node.xchg = el('g', { class: 'o2-xchg-badge o2-hit', role: 'button', tabindex: 0, 'aria-label': `${node.pois.length} curated place${node.pois.length > 1 ? 's' : ''} at ${node.name}`, style: 'cursor:pointer' }, S.layers.badges);
      el('rect', { x: -22, y: -22, width: 44, height: 44, fill: 'transparent' }, node.xchg);
      const n = node.pois.length;
      const w = n > 1 ? 40 : 26;
      el('rect', { x: -w / 2, y: -13, width: w, height: 26, rx: 13, fill: '#fff', stroke: INKY, 'stroke-width': 2.6 }, node.xchg);
      const fork = el('svg', { x: n > 1 ? -15 : -8, y: -8, width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: INKY, 'stroke-width': 2.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, node.xchg);
      fork.innerHTML = icon(placeIcon(node.pois[0].category)).replace(/^<svg[^>]*>|<\/svg>$/g, '');
      if (n > 1) { const t = el('text', { x: 3, y: 4.5, style: 'font-size:12px;font-weight:700;stroke:none;fill:#1f2b2f' }, node.xchg); t.textContent = n; }
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
function nodePos(node) {
  const sch = toScreen({ x: node.sx, y: node.sy });
  if (S.geo <= 0) return sch;
  const geo = S.map.project([node.place.lng, node.place.lat]);
  return S.geo >= 1 ? { x: geo.x, y: geo.y } : { x: sch.x + (geo.x - sch.x) * S.geo, y: sch.y + (geo.y - sch.y) * S.geo };
}
function laneOffset(points, lane) {
  if (!lane || points.length < 2) return points;
  const gap = 8 * lane, out = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)];
    let nx = -(b.y - a.y), ny = b.x - a.x; const len = Math.hypot(nx, ny) || 1; nx /= len; ny /= len;
    let scale = 1;
    if (i > 0 && i < points.length - 1) {
      const n1 = norm(points[i - 1], points[i]), n2 = norm(points[i], points[i + 1]);
      const mx = n1.x + n2.x, my = n1.y + n2.y, ml = Math.hypot(mx, my) || 1;
      nx = mx / ml; ny = my / ml; scale = 1 / Math.max(0.5, (nx * n1.x + ny * n1.y));
    }
    out.push({ x: points[i].x + nx * gap * scale, y: points[i].y + ny * gap * scale });
  }
  return out;
}
function norm(a, b) { const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1; return { x: -dy / l, y: dx / l }; }
function schematicPoints(edge) {
  const pts = edge.sch.map(toScreen);
  return laneOffset(edge.leg.from === edge.u.id ? pts : pts, edge.lane);
}
function geoPoints(edge) { return (S.map.getZoom() < 7 ? edge.leg.coarse : edge.leg.lite).coords.map(c => S.map.project(c)); }
function pathFromRounded(pts) {
  if (pts.length === 2) return `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}L${pts[1].x.toFixed(1)},${pts[1].y.toFixed(1)}`;
  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1], b = pts[i], c = pts[i + 1];
    const r = Math.min(16, Math.hypot(b.x - a.x, b.y - a.y) / 2, Math.hypot(c.x - b.x, c.y - b.y) / 2);
    const u = unit(a, b), v = unit(b, c);
    d += `L${(b.x - u.x * r).toFixed(1)},${(b.y - u.y * r).toFixed(1)}Q${b.x.toFixed(1)},${b.y.toFixed(1)} ${(b.x + v.x * r).toFixed(1)},${(b.y + v.y * r).toFixed(1)}`;
  }
  const z = pts[pts.length - 1];
  return `${d}L${z.x.toFixed(1)},${z.y.toFixed(1)}`;
}
const unit = (a, b) => { const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1; return { x: dx / l, y: dy / l }; };
const polyPath = pts => pts.length ? `M${pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('L')}` : '';
function measured(pts) { const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)); return cum; }
function cut(pts, f) {
  if (f >= 1) return pts;
  const cum = measured(pts), target = cum[cum.length - 1] * Math.max(0, f);
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    if (cum[i] >= target) { const t = (target - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1); out.push({ x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t }); return out; }
    out.push(pts[i]);
  }
  return out;
}
function resamplePts(pts, n) {
  const cum = measured(pts), total = cum[cum.length - 1] || 1, out = [];
  let j = 1;
  for (let i = 0; i < n; i++) {
    const target = (total * i) / (n - 1);
    while (j < pts.length - 1 && cum[j] < target) j++;
    const t = (target - cum[j - 1]) / ((cum[j] - cum[j - 1]) || 1);
    out.push({ x: pts[j - 1].x + (pts[j].x - pts[j - 1].x) * t, y: pts[j - 1].y + (pts[j].y - pts[j - 1].y) * t });
  }
  return out;
}
function edgePoints(edge) {
  if (S.geo <= 0) return { pts: schematicPoints(edge), rounded: true };
  if (S.geo >= 1) return { pts: geoPoints(edge), rounded: false };
  const a = resamplePts(schematicPoints(edge), 40), b = resamplePts(geoPoints(edge), 40);
  return { pts: a.map((p, i) => ({ x: p.x + (b[i].x - p.x) * S.geo, y: p.y + (b[i].y - p.y) * S.geo })), rounded: false };
}
function render() {
  if (!S?.svg) return;
  const t0 = performance.now();
  const sel = S.selected, progress = S.progress;
  const W = S.container.clientWidth, H = S.container.clientHeight;
  const labelBoxes = [];
  const positions = new Map(S.nodes.map(node => [node.id, nodePos(node)]));
  const tokenTargets = [];
  for (const edge of S.edges) {
    let { pts, rounded } = edgePoints(edge);
    if (edge.leg.from !== edge.u.id) { /* edges are stored from→to already */ }
    const f = progress ? (progress.get(edge.leg.id) ?? 1) : 1;
    const hidden = f <= 0;
    const partial = f > 0 && f < 1;
    const drawPts = partial ? cut(rounded ? resamplePts(pts, 32) : pts, f) : pts;
    const d = hidden ? '' : rounded && !partial ? pathFromRounded(drawPts) : polyPath(drawPts);
    edge.line.setAttribute('d', d);
    edge.casing?.setAttribute('d', d);
    edge.hit.setAttribute('d', hidden ? '' : d);
    const dim = sel && edge.leg.eventId !== sel;
    edge.line.classList.toggle('o2-dim', Boolean(dim));
    edge.casing?.classList.toggle('o2-dim', Boolean(dim));
    // Bullet on the longest straight run, only where there is room.
    let best = null, bestLen = 0;
    for (let i = 1; i < pts.length && S.geo <= 0; i++) { const l = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); if (l > bestLen) { bestLen = l; best = [pts[i - 1], pts[i]]; } }
    if (S.geo > 0 && pts.length > 1) { const total = measured(pts).at(-1); bestLen = total; const mid = cut(pts, 0.5).at(-1); best = [mid, mid]; }
    // Patterns already separate confirmed modes; bullets are always offered for
    // dotted TBD lines and for confirmed lines once there is generous room.
    const room = S.geo > 0 ? 130 : edge.leg.tbd ? 58 : 104;
    const showBullet = !hidden && !partial && best && bestLen > room && (S.geo <= 0 || S.geo >= 1);
    edge.bullet.style.display = showBullet ? '' : 'none';
    if (showBullet) { const mx = (best[0].x + best[1].x) / 2, my = (best[0].y + best[1].y) / 2; edge.bullet.setAttribute('transform', `translate(${mx.toFixed(1)},${my.toFixed(1)})`); edge.bullet.classList.toggle('o2-dim', Boolean(dim)); }
    if (partial && S.token?.legId === edge.leg.id) tokenTargets.push(drawPts.at(-1));
  }
  // Stations, labels, badges.
  const order = S.nodes.slice().sort((a, b) => (b.isEvent - a.isEvent) || (a.tbd - b.tbd));
  const minorVisible = S.view.s > 1.6 || S.geo >= 1;
  for (const node of order) {
    const p = positions.get(node.id);
    const reached = !progress || node.revealed;
    node.g.setAttribute('transform', `translate(${p.x.toFixed(1)},${p.y.toFixed(1)})${reached ? '' : ' scale(0.01)'}`);
    const active = sel && node.events.some(e => e.id === sel);
    node.ring.setAttribute('opacity', active && S.landed ? 1 : 0);
    const dim = sel && !active && !node.legs.some(l => l.eventId === sel);
    node.g.classList.toggle('o2-dim', Boolean(dim));
    // Label placement: try sides away from incident lines, avoid other labels.
    let placed = null;
    const showLabel = reached && (node.isEvent || minorVisible) && p.x > -50 && p.x < W + 50 && p.y > -20 && p.y < H + 20;
    if (showLabel) {
      const w = node.labelWidth + (node.pill ? node.pillWidth + 6 : 0), h = 16;
      const r = node.isEvent ? 13 : 9;
      const candidates = [
        { x: p.x + r, y: p.y + 4.5, a: 'start', box: [p.x + r - 2, p.y - h / 2, p.x + r + w, p.y + h / 2] },
        { x: p.x - r, y: p.y + 4.5, a: 'end', box: [p.x - r - w, p.y - h / 2, p.x - r + 2, p.y + h / 2] },
        { x: p.x, y: p.y - r - 5, a: 'middle', box: [p.x - w / 2, p.y - r - 5 - h, p.x + w / 2, p.y - r - 3] },
        { x: p.x, y: p.y + r + 15, a: 'middle', box: [p.x - w / 2, p.y + r + 2, p.x + w / 2, p.y + r + 2 + h] }
      ];
      const scores = candidates.map(c => {
        let score = labelBoxes.some(b => c.box[0] < b[2] && c.box[2] > b[0] && c.box[1] < b[3] && c.box[3] > b[1]) ? 100 : 0;
        for (const edge of S.edges) {
          if (edge.u !== node && edge.v !== node) continue;
          const other = positions.get(edge.u === node ? edge.v.id : edge.u.id);
          const dir = edge.sch && S.geo <= 0 ? unit(p, toScreen(edge.sch[edge.u === node ? 1 : edge.sch.length - 2])) : unit(p, other);
          const cx = (c.box[0] + c.box[2]) / 2 - p.x, cy = (c.box[1] + c.box[3]) / 2 - p.y, cl = Math.hypot(cx, cy) || 1;
          score += Math.max(0, (dir.x * cx + dir.y * cy) / cl) * 6;
        }
        if (c.box[2] > W - 8 || c.box[0] < 8) score += 30;
        return score;
      });
      const bestIndex = scores.indexOf(Math.min(...scores));
      if (scores[bestIndex] < 100 || node.isEvent && active) placed = candidates[bestIndex];
    }
    node.label.style.display = placed ? '' : 'none';
    if (placed) {
      labelBoxes.push(placed.box);
      node.label.setAttribute('x', placed.a === 'start' ? placed.x : placed.a === 'end' ? placed.x - (node.pill ? node.pillWidth + 6 : 0) : placed.x - (node.pill ? (node.pillWidth + 6) / 2 : 0));
      node.label.setAttribute('y', placed.y);
      node.label.setAttribute('text-anchor', placed.a);
      node.label.classList.toggle('o2-dim', Boolean(dim));
    }
    if (node.pill) {
      node.pill.style.display = placed ? '' : 'none';
      if (placed) {
        const end = placed.a === 'start' ? placed.x + node.labelWidth + 6 : placed.a === 'end' ? placed.x - node.pillWidth : placed.x + node.labelWidth / 2 - (node.pillWidth + 6) / 2 + 6;
        node.pill.setAttribute('transform', `translate(${end.toFixed(1)},${(placed.y - 4.5).toFixed(1)})`);
        node.pill.classList.toggle('o2-dim', Boolean(dim));
      }
    }
    if (node.xchg) {
      // Interchange badges need room: offer them on focus, zoom or open space.
      let room = Infinity;
      for (const other of S.nodes) if (other !== node && other.isEvent) { const q = positions.get(other.id); room = Math.min(room, Math.hypot(q.x - p.x, q.y - p.y)); }
      const focus = sel ? node.events.some(e => e.id === sel) || node.legs.some(l => l.eventId === sel) : false;
      node.xchg.style.display = reached && S.geo < 1 && (focus || room > 58 || S.view.s > 2) ? '' : 'none';
      node.xchg.setAttribute('transform', `translate(${p.x.toFixed(1)},${(placed && placed.y > p.y + 4 ? p.y - 27 : p.y + 27).toFixed(1)})`);
      node.xchg.classList.toggle('o2-dim', Boolean(dim));
    }
  }
  if (S.token && tokenTargets.length) {
    const at = tokenTargets[0];
    S.tokenG.setAttribute('transform', `translate(${at.x.toFixed(1)},${at.y.toFixed(1)})`);
    S.tokenG.setAttribute('opacity', 1);
  } else S.tokenG.setAttribute('opacity', 0);
  if (S.job) S.ctx.perf(performance.now() - t0);
}

// ---------------------------------------------------------------- tools & gestures
function buildTools() {
  const segment = document.createElement('div');
  segment.className = 'lab-segment';
  segment.setAttribute('role', 'group');
  segment.setAttribute('aria-label', 'Drawing');
  segment.innerHTML = '<button type="button" data-geo="0" aria-pressed="true">Diagram</button><button type="button" data-geo="1" aria-pressed="false">Geography</button>';
  segment.addEventListener('click', event => {
    const button = event.target.closest('button[data-geo]');
    if (!button) return;
    morphTo(Number(button.dataset.geo));
  });
  S.segment = segment;
  S.ctx.slots.tools.append(segment);
}
function syncSegment() { S.segment.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.geo) === Math.round(S.geoTarget ?? S.geo)))); }
function bindGestures() {
  const svg = S.svg, pointers = new Map();
  let last = null;
  svg.addEventListener('pointerdown', event => {
    if (S.geo > 0) return;
    interrupt();
    svg.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    last = null;
  });
  svg.addEventListener('pointermove', event => {
    if (!pointers.has(event.pointerId) || S.geo > 0) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const pts = [...pointers.values()];
    const center = pts.reduce((a, p) => ({ x: a.x + p.x / pts.length, y: a.y + p.y / pts.length }), { x: 0, y: 0 });
    const spread = pts.length > 1 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0;
    if (last && last.count === pts.length) {
      const k = pts.length > 1 && last.spread ? spread / last.spread : 1;
      zoomAt(center.x, center.y, k);
      S.view.x += center.x - last.x; S.view.y += center.y - last.y;
      schedule();
    }
    last = { x: center.x, y: center.y, spread, count: pts.length };
  });
  const end = event => { pointers.delete(event.pointerId); last = null; };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);
  svg.addEventListener('wheel', event => {
    if (S.geo > 0) return;
    event.preventDefault(); interrupt();
    zoomAt(event.clientX, event.clientY, Math.exp(-event.deltaY * 0.0016));
    schedule();
  }, { passive: false });
  svg.addEventListener('dblclick', event => { if (S.geo > 0) return; zoomAt(event.clientX, event.clientY, 1.6); schedule(); });
}
function zoomAt(x, y, k) {
  const s = Math.max(0.25, Math.min(12, S.view.s * k)), real = s / S.view.s;
  S.view.x = x - (x - S.view.x) * real; S.view.y = y - (y - S.view.y) * real; S.view.s = s;
}

// ---------------------------------------------------------------- geography markers
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

// ---------------------------------------------------------------- cards
function showCard(html, at) {
  S.card.innerHTML = `<button type="button" class="o2-card-close" aria-label="Close"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>${html}`;
  S.card.hidden = false;
  const W = S.container.clientWidth, inset = S.ctx.insets();
  const x = Math.min(W - 300, Math.max(10, (at?.x ?? 20) + 22)), y = Math.max(inset.top, Math.min(S.container.clientHeight - inset.bottom - S.card.offsetHeight, (at?.y ?? inset.top) - 40));
  S.card.style.left = `${x}px`; S.card.style.top = `${y}px`;
  S.card.querySelector('.o2-card-close').addEventListener('click', () => { S.card.hidden = true; });
  return S.card;
}
function hideCard() { if (S?.card) S.card.hidden = true; }
function stationCard(event) {
  const node = S.nodeMap.get(event.place?.id);
  if (!node) return;
  const legs = event.legs.map(leg => `<li>${icon(leg.mode, { size: 16, stroke: 2.2 })}<span>${escapeHtml(`${modeOf(leg.mode).label}${leg.tbd ? ' (TBD)' : ''} · ${leg.fromPlace.name} → ${leg.toPlace.name}`)} <span style="color:#59686b">${escapeHtml(fmtKm(leg.km))}</span></span></li>`).join('');
  const strip = event.photos.slice(0, 5).map(p => `<span style="background-image:url('${p.preview || ''}')"></span>`).join('');
  const places = event.pois.map(p => `<span>${icon(placeIcon(p.category), { size: 12, stroke: 2.4 })}${escapeHtml(p.name)}</span>`).join('');
  const card = showCard(`<h3>${escapeHtml(event.title)}</h3><div class="o2-card-date">${event.tbd ? '<span class="lab-tbd">TBD</span>' : ''}${escapeHtml(`${S.trip.eventWord} ${event.number} · ${event.date.replace(/^TBD · /, '')}`)}</div>
    ${legs ? `<ul class="o2-card-legs">${legs}</ul>` : ''}
    ${strip ? `<div class="o2-strip">${strip}<b>${event.photos.length} photo${event.photos.length > 1 ? 's' : ''}</b></div>` : ''}
    ${places ? `<div class="o2-places">${places}</div>` : ''}
    <div class="o2-card-actions"><button type="button" data-act="geo">${S.geo >= 1 ? 'Show diagram' : 'Open in geography'}</button></div>`, nodePos(node));
  card.querySelector('[data-act="geo"]').addEventListener('click', () => { hideCard(); morphTo(S.geo >= 1 ? 0 : 1, event); });
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

// ---------------------------------------------------------------- morph
function geoCamera(event) {
  if (event) return cameraFor(S.map, S.ctx, S.trip.eventFrame(event), { extra: 40 });
  return cameraFor(S.map, S.ctx, { bounds: S.trip.bounds, maxZoom: 10 }, { extra: 40 });
}
function setGeoMarkers() {
  const geo = S.geo >= 1;
  S.container.classList.toggle('is-geo', geo);
  S.container.classList.toggle('o2-hide-geo-markers', !geo);
  if (geo) { S.photoCounts.set(S.trip.located); S.xchg.set(S.trip.locatedPois); } else { S.photoCounts.set([]); S.xchg.set([]); }
}
function morphTo(target, event = S.selected ? S.trip.eventById(S.selected) : null) {
  if (!S) return;
  cancelJob('settle');
  S.geoTarget = target; syncSegment();
  const mapEl = S.map.getContainer();
  if (target >= 1) { mapEl.style.visibility = 'visible'; S.map.resize(); S.map.jumpTo(geoCamera(event)); if (!S.revealed) { S.revealed = true; } mapEl.style.opacity = 1; }
  const from = S.geo;
  const finish = () => {
    S.geo = target;
    if (target <= 0) { mapEl.style.visibility = 'hidden'; fitDiagram(event ? focusNodes(event) : S.nodes); }
    setGeoMarkers(); render();
  };
  if (S.reduced) { finish(); return; }
  if (target <= 0) mapEl.style.opacity = 0;
  S.morphClock?.cancel();
  S.morphClock = clock(900, t => { S.geo = from + (target - from) * ease.inOut(t); render(); }, finish);
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
  job.cancelled = true; job.clocks.forEach(c => c.cancel()); S.job = null;
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
const sleep = (job, ms) => new Promise(resolve => setTimeout(resolve, job.cancelled ? 0 : ms));
function revealAll() { S.progress = null; S.token = null; for (const node of S.nodes) node.revealed = true; }
function firstReveal() {
  if (S.revealed) return;
  S.revealed = true;
  // The SVG appears in its first drawn state; no default view flashes.
  S.svg.style.opacity = 1;
}

export function showOverview({ opening = false } = {}) {
  if (!S?.svg) return;
  cancelJob(); hideCard();
  S.selected = null; S.landed = false;
  if (S.geo >= 1) S.map.easeTo({ ...geoCamera(null), duration: S.revealed && !S.reduced ? 800 : 0 });
  if (!opening || S.reduced) {
    revealAll();
    if (S.geo <= 0) fitDiagram(S.nodes, { animate: S.revealed && !S.reduced }); else render();
    firstReveal(); render();
    return;
  }
  const settle = () => { revealAll(); render(); };
  const job = startJob(settle, settle);
  fitDiagram(S.nodes);
  const plan = tracePlan(S.trip.orderedLegs, () => 1);
  S.progress = new Map(plan.map(e => [e.leg.id, 0]));
  for (const node of S.nodes) node.revealed = false;
  const starts = new Set(S.trip.orderedLegs.slice(0, 1).map(l => l.from));
  for (const node of S.nodes) if (starts.has(node.id) || (!node.legs.length)) node.revealed = true;
  firstReveal();
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

function runToken(job, legs, chains) {
  const plans = (chains.length > 1 ? chains : [legs]).map(chain => tracePlan(chain, () => 1));
  const entries = plans.flat();
  S.progress = new Map(entries.map(e => [e.leg.id, 0]));
  const duration = Math.max(1400, Math.min(3600, 900 * Math.max(...plans.map(p => p.length))));
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
      S.tokenIcon.innerHTML = icon(active.mode).replace(/^<svg[^>]*>|<\/svg>$/g, '');
    }
    if (!active) S.token = null;
    render();
  });
}

function land(event) {
  S.landed = true;
  revealAll();
  render();
  stationCard(event);
}

export function selectEvent(id, { animate = true } = {}) {
  if (!S?.svg) return;
  const event = S.trip.eventById(id);
  if (!event) return;
  cancelJob(); hideCard();
  S.selected = id; S.landed = false;
  const focus = focusNodes(event);
  if (!animate || S.reduced || !event.legs.length) {
    revealAll();
    if (S.geo >= 1) S.map.jumpTo(geoCamera(event)); else fitDiagram(focus, { animate: animate && S.revealed && !S.reduced });
    firstReveal();
    land(event);
    return;
  }
  firstReveal();
  const settle = () => land(event);
  const job = startJob(settle, () => { if (S.geo >= 1) S.map.jumpTo(geoCamera(event)); else fitDiagram(focus); settle(); });
  revealAll();
  (async () => {
    if (S.geo >= 1) {
      S.map.fitBounds(S.trip.routeFrame(event.legs), { padding: 60, duration: 800 });
      await sleep(job, 820);
    } else await fitDiagram(focus, { animate: true });
    if (job.cancelled) return;
    await runToken(job, event.legs, event.chains);
    if (job.cancelled) return;
    S.progress = null; S.token = null;
    if (S.geo >= 1) { S.map.easeTo({ ...geoCamera(event), duration: 900 }); await sleep(job, 920); }
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
  const job = startJob(() => land(event), () => land(event));
  S.selected = event.id;
  (async () => { await runToken(job, [leg], [[leg]]); if (job.cancelled) return; S.job = null; land(event); S.ctx.onPlayState(false); })();
}
export function skip() { cancelJob('final'); }
export function setReducedMotion(value) { if (!S) return; S.reduced = Boolean(value); if (S.reduced && S.job) cancelJob('final'); }

export function legendSwatch(mode) {
  if (mode === 'tbd') return '<svg width="64" height="16" viewBox="0 0 64 16"><path d="M5 8h54" stroke="#0072b2" stroke-width="5" stroke-linecap="round" stroke-dasharray="0.5 8"/></svg>';
  const m = MODES[mode];
  return `<svg width="64" height="16" viewBox="0 0 64 16"><path d="M5 8h54" stroke="#fff" stroke-width="9"/><path d="M5 8h54" stroke="${m.color}" stroke-width="6" stroke-linecap="${ROUND[mode] ? 'round' : 'butt'}" ${DASH[mode] ? `stroke-dasharray="${DASH[mode]}"` : ''}/></svg>`;
}
export function legendExtras() {
  return [
    { swatch: `<svg width="60" height="24" viewBox="0 0 60 24"><circle cx="30" cy="12" r="10" fill="#fff" stroke="#0072b2" stroke-width="2.4"/><g transform="translate(23 5) scale(.58)" fill="none" stroke="#1f2b2f" stroke-width="2.4">${icon('train').replace(/^<svg[^>]*>|<\/svg>$/g, '')}</g></svg>`, label: 'Mode bullet', note: 'names the mode on every line, also when TBD' },
    { swatch: '<svg width="60" height="24" viewBox="0 0 60 24"><circle cx="18" cy="12" r="7" fill="#fff" stroke="#1f2b2f" stroke-width="3"/><circle cx="42" cy="12" r="7" fill="#fff" stroke="#5d6b6e" stroke-width="3" stroke-dasharray="3 2.4"/></svg>', label: 'Stop station', note: 'dashed = TBD; small ring = transfer' },
    { swatch: '<svg width="60" height="24" viewBox="0 0 60 24"><rect x="12" y="2" width="36" height="20" rx="10" fill="#1f2b2f"/><text x="34" y="16" fill="#fff" font-size="12" font-weight="700" text-anchor="middle">24</text></svg>', label: 'Photo count', note: 'album size at the station; geography shows located groups' },
    { swatch: '<svg width="60" height="24" viewBox="0 0 60 24"><rect x="17" y="1" width="26" height="22" rx="11" fill="#fff" stroke="#1f2b2f" stroke-width="2.5"/></svg>', label: 'Curated places', note: 'interchange badge with a count' }
  ];
}

export function destroy() {
  if (!S) return;
  cancelJob(); S.morphClock?.cancel(); cancelAnimationFrame(raf); raf = 0;
  window.removeEventListener('resize', S.onResize);
  S.offInput?.();
  S.photoCounts?.destroy(); S.xchg?.destroy();
  S.map?.remove();
  S.container.classList.remove('o2', 'is-geo', 'o2-hide-geo-markers');
  S = null;
}
void prefix; void resample; void fmtDuration; void reveal;
