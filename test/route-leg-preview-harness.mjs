import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../dist/assets/app.js', import.meta.url), 'utf8');
const fn = name => { const start = source.indexOf(`  function ${name}(`); return source.slice(start, source.indexOf('\n  function ', start + 1)); };

export function legPreviewHarness(journey) {
  const states = new Map(), layers = new Map(), sources = new Map(), order = [], timers = new Map(), events = new Map(), nodes = new Map();
  const cards = journey.segments.map(segment => {
    const classes = new Set();
    const card = { dataset: { routeSegment: segment.id }, classes, classList: { toggle: (name, on) => on ? classes.add(name) : classes.delete(name) } };
    card.closest = selector => selector === '[data-route-segment]' ? card : null;
    card.contains = node => node === card;
    return card;
  });
  let mobile = false, timer = 0, resize, openedMap = 0;
  const context = vm.createContext({ journey, previewSegmentId: null, previewDayIds: [], previewSource: null, previewShowCard: false, previewClearTimer: null,
    inspectedSegmentId: null, routeInspectionPinned: false, mainMapReady: true,
    mainDecorations: { layerIds: [], hitLayerIds: [], sourceIds: [] },
    palette: { route: '#006f92', casing: '#fffef8' }, modeStyles: { train: { color: '#0072b2', width: 5.8 }, boat: { color: '#007f8b', width: 5.1, dash: [1.1, 1.6] } }, labels: { train: 'Train' },
    lineSwatch: () => '', formatDistance: value => `${value} km`, groupTravel: { audience: () => 'Everyone' },
    segmentCoordinates: segment => segment.geometry || [[0, 0], [1, 1]],
    document: { querySelectorAll: selector => selector === '.leg-card' ? cards : [] },
    detailPanel: { addEventListener: (name, handler) => events.set(name, handler), querySelector: () => null },
    locationLabels: { setPreview: (ids, options) => { context.lastPlacePreview = { ids: [...ids], ...options }; } },
    $: selector => { if (!nodes.has(selector)) nodes.set(selector, { hidden: true }); return nodes.get(selector); },
    window: {
      JOURNEY_ATLAS_MAP_STYLE: { routeInsertionLayer: () => 'labels' },
      matchMedia: query => ({ matches: query.includes('max-width') ? mobile : !mobile, addEventListener: (name, handler) => { resize = handler; } }),
      clearTimeout: id => timers.delete(id), setTimeout: handler => { timers.set(++timer, handler); return timer; }
    },
    mainMap: {
      addSource: (id, source) => sources.set(id, source), getSource: id => sources.get(id),
      addLayer: layer => { layers.set(layer.id, layer); order.push(layer.id); }, getLayer: id => layers.get(id),
      setFeatureState: ({ id }, state) => states.set(id, { ...states.get(id), ...state }),
      moveLayer: id => { order.splice(order.indexOf(id), 1); order.push(id); },
      fitBounds() { throw Error('Leg hover must not move the camera'); }, easeTo() { throw Error('Leg hover must not move the camera'); }
    },
    setMobileTab: () => openedMap++, pendingMapAction: null,
    moveActiveDay() { throw Error('Leg hover must not select another day'); }
  });
  vm.runInContext(['placeById', 'segmentById', 'segmentsForDay', 'dayById', 'dayForSegment', 'escapeHtml', 'renderRouteLegs', 'syncInspectionClasses', 'setDayPreview', 'previewRouteLeg', 'deferDayPreviewClear', 'clearDayPreview', 'setInspectedFeatureState', 'clearSegmentInspection', 'routeHoverEnabled', 'addSegmentLayer'].map(fn).join('\n'), context);
  const start = source.indexOf('  detailPanel.addEventListener("mouseover"');
  vm.runInContext(source.slice(start, source.indexOf('  [storyMedia, photoStrip]', start)), context);
  for (const segment of journey.segments) context.addSegmentLayer(context.mainMap, context.mainDecorations, segment, { prefix: 'main', interactive: true, selected: true, opacity: 1 });
  function paint(segmentId, property) {
    const evaluate = expression => {
      if (!Array.isArray(expression)) return expression;
      const [operation, ...args] = expression;
      if (operation === 'feature-state') return states.get(segmentId)?.[args[0]];
      if (operation === 'boolean') return evaluate(args[0]) ?? args[1];
      if (operation === 'any') return args.some(evaluate);
      if (operation === 'case') { for (let i = 0; i < args.length - 1; i += 2) if (evaluate(args[i])) return evaluate(args[i + 1]); return evaluate(args.at(-1)); }
      throw Error(`Unhandled paint expression ${operation}`);
    };
    return evaluate(layers.get(`main-line-${segmentId}`).paint[property]);
  }
  return { context, cards, states, order, timers, paint, fire: (name, card, relatedTarget = null) => events.get(name)({ target: card, relatedTarget }),
    setMobile: value => { mobile = value; resize(); }, get openedMap() { return openedMap; } };
}
