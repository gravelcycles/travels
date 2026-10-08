(function (root) {
  'use strict';
  const located = point => Array.isArray(point) && point.length >= 2 && Number.isFinite(point[0]) && Number.isFinite(point[1]);

  function plan(segments, coordinates) {
    const legs = segments.map(segment => ({ segment, coordinates: coordinates(segment).filter(located) })).filter(leg => leg.coordinates.length > 1);
    for (const leg of legs) {
      const meters = leg.coordinates.slice(1).reduce((sum, point, index) => sum + root.JOURNEY_ATLAS_REPLAY.coordinateDistance(leg.coordinates[index], point), 0);
      leg.weight = Math.max(1, Math.sqrt(meters / 1000));
    }
    const total = legs.reduce((sum, leg) => sum + leg.weight, 0);
    let start = 0;
    for (const leg of legs) { leg.start = start; leg.end = start += leg.weight / total; }
    return { legs, duration: Math.min(8500, 4500 + Math.max(0, legs.length - 1) * 1000) };
  }

  function frame(plan, progress) {
    const amount = Math.max(0, Math.min(1, progress));
    const active = plan.legs.find(leg => amount < leg.end) || plan.legs.at(-1);
    return { active, progress: amount, lines: plan.legs.map(leg => ({ segment: leg.segment,
      coordinates: root.JOURNEY_ATLAS_REPLAY.partialLine(leg.coordinates, Math.max(0, Math.min(1, (amount - leg.start) / (leg.end - leg.start)))) })) };
  }

  function destination(day, places, segments, coordinates) {
    const place = places.find(place => place.id === (day.destinationId || day.placeId));
    if (Number.isFinite(place?.lng) && Number.isFinite(place?.lat)) return [place.lng, place.lat];
    return segments.slice().reverse().flatMap(segment => coordinates(segment).slice().reverse()).find(located) || null;
  }

  // An owned clock prevents a previous city from stealing the camera after navigation.
  function create({ onFrame, onStay, onState, requestFrame = callback => root.requestAnimationFrame(callback), cancelFrame = id => root.cancelAnimationFrame(id) }) {
    let pending = null, generation = 0, current = null, phase = 'idle';
    const state = value => { phase = value; onState?.(value, current); };
    function stop() { generation++; if (pending !== null) cancelFrame(pending); pending = null; }
    function stay() { stop(); if (!current) return; state('stay'); onStay(current); }
    function start(key, plan, { reducedMotion = false } = {}) {
      stop(); current = { key, plan };
      if (reducedMotion || !plan.legs.length) { stay(); return; }
      const owner = generation;
      state('arrival'); onFrame(frame(plan, 0), current);
      let origin;
      function tick(now) {
        if (owner !== generation) return;
        origin ??= now;
        const elapsed = now - origin;
        const progress = Math.max(0, Math.min(1, (elapsed - 650) / plan.duration));
        onFrame(frame(plan, progress), current);
        if (elapsed >= plan.duration + 1000) { stay(); return; }
        pending = requestFrame(tick);
      }
      pending = requestFrame(tick);
    }
    function cancel() { stop(); state('idle'); current = null; }
    function explore() { stop(); state('explore'); }
    return { start, stay, cancel, explore, get phase() { return phase; }, get key() { return current?.key; } };
  }
  root.JOURNEY_ATLAS_ARRIVAL = { plan, frame, destination, create };
})(typeof window === 'undefined' ? globalThis : window);
