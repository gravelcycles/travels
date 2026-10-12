(function (root) {
  'use strict';

  function orderedSegments(journey) {
    const byId = new Map(journey.segments.map(segment => [segment.id, segment]));
    const ids = new Set([...journey.days.flatMap(day => day.segmentIds), ...byId.keys()]);
    return [...ids].map(id => byId.get(id)).filter(Boolean);
  }

  // One short overview trace, using the same geometry, clock and canvas as arrival.
  function start({ map, journey, coordinates, styleForSegment, fit, reducedMotion = false,
    requestFrame, cancelFrame, drawing = options => root.JOURNEY_ATLAS_ARRIVAL.createDrawing(options) }) {
    const arrival = root.JOURNEY_ATLAS_ARRIVAL;
    const plan = { ...arrival.plan(orderedSegments(journey), coordinates), duration: 3000, arrivalHold: 0 };
    if (reducedMotion || !plan.legs.length) return { cancel() {}, syncLayers() {} };
    const trace = drawing({ map, plan, styleForSegment });
    if (!trace) return { cancel() {}, syncLayers() {} };
    const container = map.getContainer(), hidden = new Map();
    let finished = false;
    function syncLayers() {
      if (finished) return;
      for (const leg of plan.legs) for (const part of ['line', 'casing']) {
        const id = `main-${part}-${leg.segment.id}`;
        if (!map.getLayer(id)) continue;
        if (!hidden.has(id)) hidden.set(id, map.getLayoutProperty(id, 'visibility') || 'visible');
        map.setLayoutProperty(id, 'visibility', 'none');
      }
    }
    syncLayers();
    container.classList.add('opening-route-tracing');
    function cleanup() {
      if (finished) return;
      finished = true;
      trace.destroy();
      container.classList.remove('opening-route-tracing');
      map.off('movestart', onMoveStart);
      map.off('resize', onResize);
      for (const [id, visibility] of hidden) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visibility);
    }
    const clock = arrival.create({ requestFrame, cancelFrame,
      onFrame: frame => trace.draw(frame), onStay: cleanup });
    function cancel() { clock.cancel(); cleanup(); }
    // MapLibre also emits movestart for its automatic ResizeObserver updates.
    // Only a user's gesture interrupts; layout updates keep the same clock.
    function onMoveStart(event) { if (event?.originalEvent) cancel(); }
    function onResize() { if (!finished) fit?.(); }
    map.on('movestart', onMoveStart);
    map.on('resize', onResize);
    clock.start(journey.id, plan);
    return { cancel, syncLayers };
  }

  root.JOURNEY_ATLAS_OPENING_ROUTE = { start, orderedSegments };
})(typeof window === 'undefined' ? globalThis : window);
