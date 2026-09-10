/* Shared destination labels: trip data in, measured map controls out. */
(function (root) {
  'use strict';
  function groupsForJourney(journey, { destinationForDay, segmentsForDay, segmentCoordinates, includeGroupPlaces = true }, selectedId, scope) {
    const groups = new Map();
    for (const day of journey.days) {
      if (scope === 'day' && day.id !== selectedId) continue;
      const destinations = [destinationForDay(day), ...Object.values(includeGroupPlaces ? day.groupPlaces || {} : {}).map(id => journey.places.find(p => p.id === id))];
      for (const place of destinations.filter(Boolean)) {
        if (!Number.isFinite(place.lng) || !Number.isFinite(place.lat)) continue;
        const segments = segmentsForDay(day);
        const arrival = [...segments].reverse().find(segment => segment.to === place.id);
        const departure = segments.find(segment => segment.from === place.id);
        const coordinate = arrival ? segmentCoordinates(arrival).at(-1)
          : departure ? segmentCoordinates(departure)[0] : [place.lng, place.lat];
        if (!coordinate?.every(Number.isFinite)) continue;
        const key = place.id;
        if (!groups.has(key)) groups.set(key, { key, name: place.name, coordinate, days: [], selected: false });
        const group = groups.get(key);
        if (!group.days.some(entry => entry.id === day.id)) group.days.push(day);
        if (day.id === selectedId) { group.coordinate = coordinate; group.selected = true; }
      }
    }
    return [...groups.values()].sort((a, b) => Number(b.selected) - Number(a.selected));
  }

  function dayText(days) {
    const numbers = days.map(day => day.number);
    if (numbers.length === 1) return `Day ${numbers[0]}`;
    if (numbers.every((number, index) => !index || number === numbers[index - 1] + 1)) return `Days ${numbers[0]}–${numbers.at(-1)}`;
    return `Day ${numbers[0]} +${numbers.length - 1}`;
  }

  function overlaps(a, b, gap = 4) {
    return a.left < b.right + gap && a.right > b.left - gap && a.top < b.bottom + gap && a.bottom > b.top - gap;
  }

  function crossesRoute(route, box) {
    // Segment/rectangle clipping also catches sparse and zero-length geometry.
    let near = 0, far = 1;
    for (const [axis, low, high] of [['x', box.left, box.right], ['y', box.top, box.bottom]]) {
      const start = route.start[axis], delta = route.end[axis] - start;
      const min = low - route.padding, max = high + route.padding;
      if (!delta) { if (start < min || start > max) return false; }
      else {
        const first = (min - start) / delta, last = (max - start) / delta;
        near = Math.max(near, Math.min(first, last)); far = Math.min(far, Math.max(first, last));
        if (near > far) return false;
      }
    }
    return true;
  }

  function placeLabel(point, sizes, { bounds, occupied = [], routes = [], labelCost = () => 0 }) {
    // Offscreen locations must not be pulled onto the map as misleading labels.
    if (point.x < 0 || point.y < 0 || point.x > bounds.right + 8 || point.y > bounds.bottom + 8) return null;
    const candidates = [];
    for (const size of sizes) {
      for (const gap of [14, 28, 48, 72, 104]) {
        const x = size.width / 2 + gap, y = size.height / 2 + gap;
        for (const [dx, dy] of [[x, 0], [-x, 0], [0, -y], [0, y], [x, -y], [-x, -y], [x, y], [-x, y]]) {
          const center = { x: point.x + dx, y: point.y + dy };
          const box = { left: center.x - size.width / 2 - 3, right: center.x + size.width / 2 + 3,
            top: center.y - size.height / 2 - 3, bottom: center.y + size.height / 2 + 3 };
          if (box.left < bounds.left || box.right > bounds.right || box.top < bounds.top || box.bottom > bounds.bottom) continue;
          if (occupied.some(other => overlaps(box, other)) || routes.some(route => crossesRoute(route, box))) continue;
          // Prefer short association lines; sample basemap costs only after hard constraints.
          candidates.push({ offset: [dx, dy], box, compact: size.compact, distance: Math.hypot(dx, dy) + (size.compact ? 58 : 0) });
        }
      }
    }
    let best = null, bestCost = Infinity;
    for (const candidate of candidates.sort((a, b) => a.distance - b.distance).slice(0, 8)) {
      const cost = candidate.distance + Math.min(3, labelCost(candidate.box)) * 4;
      if (cost < bestCost) { best = candidate; bestCost = cost; }
    }
    if (best) return best;
    // Cull instead of drawing over the route or another destination. Zoom reveals more.
    return null;
  }

  function create({ map, maplibregl, onSelectDay, obstacles = () => [] }) {
    const container = map.getContainer();
    let entries = [], routeData = [], frame = null, chooser = null, chooserEntry = null, pendingFocus = false;
    const closeChooser = (restore = false) => {
      if (!chooser) return;
      chooser.remove(); chooser = null;
      const entry = chooserEntry; chooserEntry = null;
      entry.button.setAttribute('aria-expanded', 'false');
      if (restore && entry.element.isConnected) entry.button.focus({ preventScroll: true });
    };
    const select = day => { pendingFocus = true; closeChooser(); onSelectDay(day.id); };
    const openChooser = entry => {
      if (chooserEntry === entry) { closeChooser(true); return; }
      closeChooser(); chooserEntry = entry;
      chooser = document.createElement('section');
      chooser.className = 'location-day-chooser';
      chooser.setAttribute('role', 'dialog'); chooser.setAttribute('aria-label', `Days in ${entry.group.name}`);
      const heading = document.createElement('strong'); heading.textContent = entry.group.name;
      const close = document.createElement('button'); close.type = 'button'; close.textContent = '×';
      close.className = 'location-chooser-close'; close.setAttribute('aria-label', 'Close day choices');
      close.addEventListener('click', () => closeChooser(true));
      chooser.append(heading, close);
      for (const day of entry.group.days) {
        const button = document.createElement('button'); button.type = 'button';
        button.className = 'location-day-choice'; button.textContent = `Day ${day.number} · ${day.date || day.title || ''}`;
        button.addEventListener('click', () => select(day)); chooser.append(button);
      }
      chooser.addEventListener('click', event => event.stopPropagation());
      chooser.addEventListener('keydown', event => { if (event.key === 'Escape') { event.stopPropagation(); closeChooser(true); } });
      container.append(chooser);
      entry.button.setAttribute('aria-expanded', 'true');
      const rect = entry.button.getBoundingClientRect(), mapRect = container.getBoundingClientRect();
      chooser.style.left = `${Math.max(8, Math.min(container.clientWidth - chooser.offsetWidth - 8, rect.left - mapRect.left))}px`;
      chooser.style.top = `${Math.max(8, Math.min(container.clientHeight - chooser.offsetHeight - 8, rect.bottom - mapRect.top + 8))}px`;
      chooser.querySelector('.location-day-choice').focus({ preventScroll: true });
    };
    const refresh = () => {
      frame = null;
      if (map.isMoving()) return;
      const width = container.clientWidth, height = container.clientHeight;
      if (!width || !height) return;
      const occupied = obstacles();
      const bounds = { left: 8, right: width - 8, top: 8, bottom: height - 8 };
      const routes = routeData.flatMap(route => {
        const points = route.coordinates.map(coordinate => map.project(coordinate));
        return points.slice(1).map((end, index) => ({ start: points[index], end, padding: route.padding }));
      }).filter(route => Math.max(route.start.x, route.end.x) >= -10 && Math.min(route.start.x, route.end.x) <= width + 10
        && Math.max(route.start.y, route.end.y) >= -10 && Math.min(route.start.y, route.end.y) <= height + 10);
      const layers = (map.getStyle()?.layers || []).filter(layer => layer.type === 'symbol' && layer.layout?.['text-field'] && layer.layout.visibility !== 'none').map(layer => layer.id);
      const labelCost = box => {
        try { return layers.length ? map.queryRenderedFeatures([[box.left, box.top], [box.right, box.bottom]], { layers }).length : 0; }
        catch { return 0; } // Styles may be replaced while a map is settling.
      };
      for (const entry of entries) {
        entry.element.style.visibility = 'hidden';
        const sizes = [false, true].map(compact => {
          entry.element.classList.toggle('is-compact', compact);
          return { width: entry.button.offsetWidth, height: entry.button.offsetHeight, compact };
        });
        const point = map.project(entry.group.coordinate);
        const placement = placeLabel(point, sizes, { bounds, occupied, routes, labelCost });
        if (!placement) { if (chooserEntry === entry) closeChooser(); continue; }
        occupied.push(placement.box);
        entry.element.classList.toggle('is-compact', placement.compact);
        entry.marker.setOffset(placement.offset);
        const [x, y] = placement.offset;
        entry.element.style.setProperty('--location-leader-length', `${Math.hypot(x, y)}px`);
        entry.element.style.setProperty('--location-leader-angle', `${Math.atan2(-y, -x)}rad`);
        entry.element.style.visibility = '';
      }
      if (pendingFocus) {
        const selected = entries.find(entry => entry.group.selected && entry.element.style.visibility !== 'hidden');
        if (selected) { selected.button.focus({ preventScroll: true }); pendingFocus = false; }
      }
    };
    const schedule = () => { if (frame === null) frame = requestAnimationFrame(refresh); };
    const hide = () => { closeChooser(); entries.forEach(entry => { entry.element.style.visibility = 'hidden'; }); };
    const dismissOutside = event => { if (chooser && !chooser.contains(event.target) && !chooserEntry.element.contains(event.target)) closeChooser(); };
    container.addEventListener('pointerdown', dismissOutside);
    map.on('movestart', hide); map.on('moveend', schedule); map.on('resize', schedule); map.on('idle', schedule);
    return {
      update(groups, routes) {
        closeChooser(); entries.forEach(entry => entry.marker.remove());
        routeData = routes;
        entries = groups.map(group => {
          const element = document.createElement('div'); element.className = 'location-label-anchor'; element.style.visibility = 'hidden';
          const button = document.createElement('button'); button.type = 'button'; button.className = 'location-label';
          const days = document.createElement('span'); days.className = 'location-label-days'; days.textContent = dayText(group.days);
          const name = document.createElement('span'); name.className = 'location-label-name'; name.textContent = group.name;
          button.append(days, name);
          button.classList.toggle('is-selected', group.selected);
          if (group.selected) button.setAttribute('aria-current', 'true');
          const accessible = `${group.name} · ${group.days.map(day => `Day ${day.number}${day.date ? `, ${day.date}` : ''}`).join('; ')}`;
          button.title = `${accessible} · ${group.days.length > 1 ? 'Choose a day' : 'Open day'}`;
          button.setAttribute('aria-label', button.title);
          if (group.days.length > 1) { button.setAttribute('aria-haspopup', 'dialog'); button.setAttribute('aria-expanded', 'false'); }
          element.append(button);
          const marker = new maplibregl.Marker({ element, anchor: 'center' }).setLngLat(group.coordinate).addTo(map);
          // MapLibre adds generic button semantics to markers; only the actual button is interactive.
          element.removeAttribute('role'); element.removeAttribute('tabindex'); element.removeAttribute('aria-label');
          const entry = { element, button, marker, group };
          button.addEventListener('click', event => {
            event.stopPropagation();
            if (group.days.length > 1) openChooser(entry); else select(group.days[0]);
          });
          button.addEventListener('dblclick', event => event.stopPropagation());
          return entry;
        });
        schedule();
      },
      destroy() {
        closeChooser(); if (frame !== null) cancelAnimationFrame(frame);
        entries.forEach(entry => entry.marker.remove());
        container.removeEventListener('pointerdown', dismissOutside);
        map.off('movestart', hide); map.off('moveend', schedule); map.off('resize', schedule); map.off('idle', schedule);
      }
    };
  }
  root.JOURNEY_ATLAS_LOCATION_LABELS = { groupsForJourney, dayText, overlaps, crossesRoute, placeLabel, create };
})(typeof window === 'undefined' ? globalThis : window);
