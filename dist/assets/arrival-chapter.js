(function (root) {
  'use strict';
  const located = point => Array.isArray(point) && point.length >= 2 && Number.isFinite(point[0]) && Number.isFinite(point[1]);

  function plan(segments, coordinates) {
    const legs = segments.map(segment => ({ segment, coordinates: coordinates(segment).filter(located) })).filter(leg => leg.coordinates.length > 1);
    for (const leg of legs) {
      leg.distances = [0];
      for (let index = 1; index < leg.coordinates.length; index++) {
        leg.distances.push(leg.distances[index - 1] + root.JOURNEY_ATLAS_REPLAY.coordinateDistance(leg.coordinates[index - 1], leg.coordinates[index]));
      }
      leg.distance = leg.distances.at(-1);
      leg.weight = Math.max(1, leg.distance);
    }
    const total = legs.reduce((sum, leg) => sum + leg.weight, 0);
    let start = 0;
    for (const leg of legs) { leg.start = start; leg.end = start += leg.weight / total; }
    return { legs, duration: Math.min(10000, 6500 + Math.max(0, legs.length - 1) * 750) };
  }

  // Interpolate by distance, with no route-wide measurements in the animation loop.
  function sample(leg, progress) {
    const amount = Math.max(0, Math.min(1, progress));
    if (!leg.distance || amount === 0) return { index: 1, point: leg.coordinates[0] };
    if (amount === 1) return { index: leg.coordinates.length - 1, point: leg.coordinates.at(-1) };
    const target = leg.distance * amount;
    let low = 1, high = leg.distances.length - 1;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (leg.distances[middle] < target) low = middle + 1; else high = middle;
    }
    const from = leg.coordinates[low - 1], to = leg.coordinates[low];
    const fraction = (target - leg.distances[low - 1]) / (leg.distances[low] - leg.distances[low - 1]);
    return { index: low, point: [from[0] + (to[0] - from[0]) * fraction, from[1] + (to[1] - from[1]) * fraction] };
  }

  function frame(plan, progress, { drawLines = true, since = -1 } = {}) {
    const amount = Math.max(0, Math.min(1, progress));
    const active = plan.legs.find(leg => amount < leg.end) || plan.legs.at(-1);
    const localProgress = leg => (amount - leg.start) / (leg.end - leg.start);
    const tip = active && sample(active, localProgress(active));
    const lines = drawLines ? plan.legs.filter(leg => since < 0 || (leg.end > since && leg.start <= amount)).map(leg => {
      const point = leg === active ? tip : sample(leg, localProgress(leg));
      return { segment: leg.segment, coordinates: [...leg.coordinates.slice(0, point.index), point.point] };
    }) : [];
    return { active, progress: amount, position: tip?.point, lines };
  }

  // Short acceleration/deceleration ramps, with steady travel between them.
  function travelProgress(progress) {
    const t = Math.max(0, Math.min(1, progress)), ramp = 0.12;
    if (t < ramp) return t * t / (2 * ramp * (1 - ramp));
    if (t > 1 - ramp) return 1 - (1 - t) ** 2 / (2 * ramp * (1 - ramp));
    return (t - ramp / 2) / (1 - ramp);
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
      let origin, lastLineTime = -Infinity, lastLineProgress = 0;
      function tick(now) {
        if (owner !== generation) return;
        origin ??= now;
        const elapsed = now - origin;
        const progress = travelProgress((elapsed - 650) / plan.duration);
        // Keep the marker on every display frame; expensive GeoJSON updates run at most 30 Hz.
        const drawLines = progress !== lastLineProgress && (now - lastLineTime >= 1000 / 30 || progress === 1);
        onFrame(frame(plan, progress, { drawLines, since: lastLineProgress }), current);
        if (drawLines) { lastLineTime = now; lastLineProgress = progress; }
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
