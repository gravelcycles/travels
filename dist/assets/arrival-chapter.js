(function (root) {
  'use strict';
  const located = point => Array.isArray(point) && point.length >= 2 && Number.isFinite(point[0]) && Number.isFinite(point[1]);

  function overhead(coordinates) {
    let previous = coordinates[0][0];
    return coordinates.map(([longitude, latitude]) => {
      // Unwrap dateline crossings before measuring the flat overview.
      const x = longitude + 360 * Math.round((previous - longitude) / 360);
      previous = x;
      const lat = Math.max(-85.051129, Math.min(85.051129, latitude));
      return [x, Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) * 180 / Math.PI];
    });
  }

  function overviewAnchors(points, tolerance) {
    const anchors = new Set([0, points.length - 1]), pending = [[0, points.length - 1]];
    while (pending.length) {
      const [first, last] = pending.pop(), a = points[first], b = points[last];
      const dx = b[0] - a[0], dy = b[1] - a[1], squaredLength = dx * dx + dy * dy;
      let furthest = -1, maximum = tolerance * tolerance;
      for (let index = first + 1; index < last; index++) {
        const point = points[index];
        const fraction = squaredLength ? Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / squaredLength)) : 0;
        const distance = (point[0] - a[0] - fraction * dx) ** 2 + (point[1] - a[1] - fraction * dy) ** 2;
        if (distance > maximum) { maximum = distance; furthest = index; }
      }
      if (furthest >= 0) { anchors.add(furthest); pending.push([first, furthest], [furthest, last]); }
    }
    return [...anchors].sort((a, b) => a - b);
  }

  function plan(segments, coordinates) {
    const legs = segments.map(segment => ({ segment, coordinates: coordinates(segment).filter(located) })).filter(leg => leg.coordinates.length > 1);
    for (const leg of legs) {
      const points = overhead(leg.coordinates), path = [0];
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (let index = 0; index < points.length; index++) {
        const [x, y] = points[index];
        minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        if (index) path.push(path[index - 1] + Math.hypot(x - points[index - 1][0], y - points[index - 1][1]));
      }
      // The clock follows the broad shape; the rendered route keeps every vertex.
      const anchors = overviewAnchors(points, Math.hypot(maxX - minX, maxY - minY) * 0.025);
      leg.distances = [0]; leg.offsets = [0];
      for (let span = 1; span < anchors.length; span++) {
        const first = anchors[span - 1], last = anchors[span];
        const dx = points[last][0] - points[first][0], dy = points[last][1] - points[first][1];
        const chord = Math.hypot(dx, dy), start = leg.distances.at(-1), clock = [];
        let forward = 0, folded = 0, previousProjection = 0;
        for (let index = first + 1; index <= last; index++) {
          const projection = chord ? ((points[index][0] - points[first][0]) * dx + (points[index][1] - points[first][1]) * dy) / (chord * chord) : 0;
          const next = Math.max(forward, Math.min(1, projection));
          if (next === forward) folded += path[index] - path[index - 1];
          else if (previousProjection < forward) {
            // Split the returning edge where it catches up, so its forward part
            // resumes normal overview speed instead of lingering in the fold.
            const fraction = (forward - previousProjection) / (projection - previousProjection);
            folded += (path[index] - path[index - 1]) * fraction;
            clock.push({ offset: index - 1 + fraction, forward, folded });
          }
          forward = next;
          previousProjection = projection;
          clock.push({ offset: index, forward, folded });
        }
        // Actual backtracking gets a small time budget instead of an instantaneous jump.
        const foldBudget = folded ? 0.04 : 0;
        for (const point of clock) {
          leg.offsets.push(point.offset);
          leg.distances.push(start + chord * ((1 - foldBudget) * point.forward + (folded ? foldBudget * point.folded / folded : 0)));
        }
      }
      leg.overviewIndices = anchors;
      leg.distance = leg.distances.at(-1);
      leg.weight = leg.distance || 1e-12;
    }
    const total = legs.reduce((sum, leg) => sum + leg.weight, 0);
    let start = 0;
    for (const leg of legs) { leg.start = start; leg.end = start += leg.weight / total; }
    if (legs.length) legs.at(-1).end = 1;
    return { legs, duration: 2500 };
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
    const clockFraction = (target - leg.distances[low - 1]) / (leg.distances[low] - leg.distances[low - 1]);
    const offset = leg.offsets[low - 1] + (leg.offsets[low] - leg.offsets[low - 1]) * clockFraction;
    const index = Math.max(1, Math.ceil(offset)), from = leg.coordinates[index - 1], to = leg.coordinates[index];
    const fraction = offset - index + 1;
    return { index, point: [from[0] + (to[0] - from[0]) * fraction, from[1] + (to[1] - from[1]) * fraction] };
  }

  function frame(plan, progress, { drawLines = true, since = -1 } = {}) {
    const amount = Math.max(0, Math.min(1, progress));
    const active = plan.legs.find(leg => amount < leg.end) || plan.legs.at(-1);
    const localProgress = leg => leg.end > leg.start ? (amount - leg.start) / (leg.end - leg.start) : amount >= leg.end ? 1 : 0;
    const tip = active && sample(active, localProgress(active));
    const lines = drawLines ? plan.legs.filter(leg => since < 0 || (leg.end > since && leg.start <= amount)).map(leg => {
      const point = leg === active ? tip : sample(leg, localProgress(leg));
      return { segment: leg.segment, coordinates: [...leg.coordinates.slice(0, point.index), point.point] };
    }) : [];
    return { active, progress: amount, position: tip?.point, lines };
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
        const progress = Math.max(0, Math.min(1, elapsed / plan.duration));
        // Keep the marker on every display frame; expensive GeoJSON updates run at most 30 Hz.
        const drawLines = progress !== lastLineProgress && (now - lastLineTime >= 1000 / 30 || progress === 1);
        onFrame(frame(plan, progress, { drawLines, since: lastLineProgress }), current);
        if (drawLines) { lastLineTime = now; lastLineProgress = progress; }
        if (progress === 1) { stay(); return; }
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
