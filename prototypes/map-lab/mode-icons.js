// Mode icons everywhere: a small upright icon on every route line, in any
// map-based concept, so transport stays readable without colour and dotted
// TBD legs still say which mode they are (dashed ring). One icon sits at the
// middle of each leg; MapLibre handles collisions. Demo-wide switch.
import { MODES, icon } from './data.js';

const SOURCE = 'lab-mode-lines', LAYER = 'lab-mode-icons';
const imageCache = new Map();

function badgeSvg(mode, tbd) {
  const color = MODES[mode]?.color || '#006f92';
  const body = icon(mode).replace(/^<svg[^>]*>|<\/svg>$/g, '');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
    <circle cx="24" cy="24" r="20" fill="#ffffff" stroke="${color}" stroke-width="4" ${tbd ? 'stroke-dasharray="6 4.5"' : ''}/>
    <g transform="translate(12 12)" fill="none" stroke="#1f2b2f" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;
}
function loadImage(key, svg) {
  if (!imageCache.has(key)) {
    imageCache.set(key, new Promise((resolve, reject) => {
      const image = new Image(48, 48);
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    }));
  }
  return imageCache.get(key);
}

export async function addModeIcons(map, trip) {
  if (!map || map.getLayer(LAYER)) return;
  const kinds = new Set(trip.legs.map(leg => `${leg.mode}${leg.tbd ? '-tbd' : ''}`));
  const images = await Promise.all([...kinds].map(async kind => {
    const [mode, tbd] = kind.split('-');
    return [`lab-mode-${kind}`, await loadImage(kind, badgeSvg(mode, tbd === 'tbd'))];
  }));
  try { if (!map.getStyle() || map.getLayer(LAYER)) return; } catch (error) { return; }
  for (const [key, image] of images) if (!map.hasImage(key)) map.addImage(key, image, { pixelRatio: 2 });
  map.addSource(SOURCE, { type: 'geojson', data: { type: 'FeatureCollection', features: trip.legs.map(leg => ({ type: 'Feature',
    properties: { key: `lab-mode-${leg.mode}${leg.tbd ? '-tbd' : ''}`, eventId: leg.eventId || '' }, geometry: { type: 'LineString', coordinates: leg.lite.coords } })) } });
  map.addLayer({ id: LAYER, type: 'symbol', source: SOURCE, layout: {
    // One icon per leg, at its middle; MapLibre drops ones that would collide.
    'symbol-placement': 'line-center', 'icon-image': ['get', 'key'], 'icon-size': ['interpolate', ['linear'], ['zoom'], 4, 0.82, 10, 1],
    'icon-rotation-alignment': 'viewport', 'icon-pitch-alignment': 'viewport', 'icon-padding': 8, 'symbol-avoid-edges': true
  } });
}
export function setModeIcons(map, visible) {
  try { if (map?.getLayer?.(LAYER)) map.setLayoutProperty(LAYER, 'visibility', visible ? 'visible' : 'none'); } catch (error) { /* map already removed */ }
}
// One sample for the key.
export function modeIconSwatch(mode = 'train', tbd = false) {
  return badgeSvg(mode, tbd).replace('width="48" height="48"', 'width="26" height="26"');
}
