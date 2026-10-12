import '../dist/assets/arrival-chapter.js';
import '../dist/assets/opening-route.js';

export function openingRouteHarness(journey, coordinates = segment => segment.geometry) {
  const layers = new Map(), events = new Map(), pending = new Map(), frames = [], classes = new Set();
  let sequence = 0, destroyed = 0, capturedPlan;
  for (const segment of journey.segments) for (const part of ['line', 'casing']) layers.set(`main-${part}-${segment.id}`, 'visible');
  const map = {
    getLayer: id => layers.has(id), getLayoutProperty: id => layers.get(id),
    setLayoutProperty: (id, property, value) => layers.set(id, value),
    getContainer: () => ({classList:{add:name=>classes.add(name),remove:name=>classes.delete(name)}}),
    on: (name, listener) => events.set(name, listener), off: name => events.delete(name)
  };
  const start = (options = {}) => globalThis.JOURNEY_ATLAS_OPENING_ROUTE.start({
    map, journey, coordinates, styleForSegment: segment => segment.mode,
    requestFrame: callback => { pending.set(++sequence, callback); return sequence; }, cancelFrame: id => pending.delete(id),
    drawing: ({plan}) => { capturedPlan = plan; return { draw:frame=>frames.push(frame), destroy:()=>destroyed++ }; }, ...options
  });
  return {map,layers,events,pending,frames,classes,start,
    tick(time) { const callbacks = [...pending.values()]; pending.clear(); callbacks.forEach(callback => callback(time)); },
    get plan() { return capturedPlan; }, get destroyed() { return destroyed; }
  };
}
