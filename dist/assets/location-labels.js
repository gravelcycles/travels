/* Shared destination pins: trip data, quiet markers and connected day previews. */
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

  function clusterGroups(groups, project, spacing) {
    const clusters = [];
    // Selected locations lead a cluster; proximity merges preserve every member/day.
    for (const group of groups) {
      const point = project(group.coordinate);
      const touching = clusters.filter(cluster => cluster.members.some(member => {
        const other = project(member.coordinate);
        return Math.abs(point.x - other.x) < spacing && Math.abs(point.y - other.y) < spacing;
      }));
      const members = [group, ...touching.flatMap(cluster => cluster.members)].sort((a, b) => Number(b.selected) - Number(a.selected));
      touching.forEach(cluster => clusters.splice(clusters.indexOf(cluster), 1));
      const days = [...new Map(members.flatMap(member => member.days).map(day => [day.id, day])).values()].sort((a, b) => a.number - b.number);
      clusters.push({ ...members[0], key: members.map(member => member.key).sort().join('|'), members, days,
        name: members.length === 1 ? members[0].name : 'Nearby places', selected: members.some(member => member.selected) });
    }
    return clusters.sort((a, b) => Number(b.selected) - Number(a.selected));
  }

  function placePin(point, { dot, targetSize, bounds, occupied = [], routes = [] }) {
    if (point.x < bounds.left || point.x > bounds.right || point.y < bounds.top || point.y > bounds.bottom) return null;
    const candidates = dot ? [[0, 0, 0]] : [[0, -20, 0], [20, 0, 90], [-20, 0, -90], [0, 20, 180]];
    let best = null, score = Infinity;
    for (const [index, [x, y, angle]] of candidates.entries()) {
      const box = {left:point.x+x-targetSize/2,right:point.x+x+targetSize/2,top:point.y+y-targetSize/2,bottom:point.y+y+targetSize/2};
      if (box.left < bounds.left || box.right > bounds.right || box.top < bounds.top || box.bottom > bounds.bottom) continue;
      if (occupied.some(other => overlaps(box, other, 2))) continue;
      const body = {left:point.x+x-13,right:point.x+x+13,top:point.y+y-13,bottom:point.y+y+13};
      // The tip/dot marks the actual route point; prefer keeping the round body clear.
      const cost = routes.filter(route => crossesRoute(route, body)).length * 20 + index;
      if (cost < score) { best = {offset:[x,y],angle,box,dot}; score = cost; }
    }
    if (!best && !dot) return placePin(point, {dot:true,targetSize,bounds,occupied,routes});
    return best;
  }

  function create({ map, maplibregl, onSelectDay, onPreviewDays = () => {}, obstacles = () => [] }) {
    const container = map.getContainer();
    let groups = [], routes = [], routeStrokes = [], entries = [], frame = null, card = null, cardEntry = null, cardKey = '', persistent = false;
    let previewIds = [], pendingFocus = false, closeTimer = null, openTimer = null, suppressedEntry = null;
    const finePointer = () => matchMedia('(hover: hover) and (pointer: fine)').matches;
    const cancelTimers = () => { clearTimeout(closeTimer); clearTimeout(openTimer); };
    const closeCard = (restore = false) => {
      cancelTimers();
      if (!card) return;
      const entry = cardEntry;
      card.remove(); card = null; cardEntry = null; cardKey = ''; persistent = false;
      entry.button.removeAttribute('aria-describedby'); entry.button.setAttribute('aria-expanded', 'false');
      if (restore && entry.element.isConnected) entry.button.focus({ preventScroll: true });
    };
    const endPreview = () => { onPreviewDays([]); };
    const dismiss = (restore = false) => { suppressedEntry = cardEntry; closeCard(restore); endPreview(); };
    const deferClose = () => {
      clearTimeout(openTimer); clearTimeout(closeTimer);
      if (!persistent) closeTimer = setTimeout(() => { closeCard(); endPreview(); }, 150);
    };
    const select = day => { pendingFocus = true; closeCard(); endPreview(); onSelectDay(day.id); };
    const positionCard = entry => {
      if (!card) return;
      const rect = entry.button.getBoundingClientRect(), area = container.getBoundingClientRect();
      const width = card.offsetWidth, height = card.offsetHeight;
      const pin = {left:rect.left-area.left,right:rect.right-area.left,top:rect.top-area.top,bottom:rect.bottom-area.top};
      const centerX = (pin.left+pin.right)/2, centerY = (pin.top+pin.bottom)/2;
      const candidates = [[centerX-width/2,pin.top-height-10],[centerX-width/2,pin.bottom+10],
        [pin.left-width-10,centerY-height/2],[pin.right+10,centerY-height/2]];
      const blocked = [pin,...obstacles()];
      let best;
      for (const [index,[x,y]] of candidates.entries()) {
        const left = Math.max(8,Math.min(container.clientWidth-width-8,x));
        const top = Math.max(8,Math.min(container.clientHeight-height-8,y));
        const box = {left,right:left+width,top,bottom:top+height};
        // Keep the previewed route visible where space permits, as well as its pin.
        const score = blocked.filter(other=>overlaps(box,other,2)).length*100000 + index +
          routeStrokes.filter(route=>crossesRoute(route,box)).reduce((cost,route)=>cost+(route.dayIds.some(id=>previewIds.includes(id))?8:1),0);
        if (!best || score<best.score) best = {...box,score};
      }
      card.style.left = `${best.left}px`; card.style.top = `${best.top}px`;
    };
    const showCard = (entry, { pinned = false, dayIds = [], origin = 'pin' } = {}) => {
      if (!entry || entry.element.style.visibility === 'hidden') return;
      cancelTimers();
      const key = `${entry.group.key}:${dayIds.join(',')}:${pinned}:${origin}`;
      if (key === cardKey) return;
      closeCard(); cardEntry = entry; cardKey = key; persistent = pinned;
      const members = entry.group.members.map(member => ({...member, days: member.days.filter(day => !dayIds.length || dayIds.includes(day.id))})).filter(member => member.days.length);
      const days = [...new Map(members.flatMap(member => member.days).map(day => [day.id,day])).values()];
      if (!days.length) return;
      card = document.createElement('section'); card.className = 'map-place-card'; card.dataset.origin = origin;
      card.setAttribute('role', pinned ? 'dialog' : 'region'); card.setAttribute('aria-label', 'Place preview');
      const title = document.createElement('strong'); title.textContent = members.length === 1 ? members[0].name : 'Nearby places';
      const description = document.createElement('span'); description.id = 'map-place-description'; description.className = 'map-place-meta';
      description.textContent = days.length === 1 ? `Day ${days[0].number} · ${days[0].date || ''}` : `${days.length} days · ${members.length === 1 ? 'Choose a visit' : 'Choose a place'}`;
      card.append(title, description);
      const close = document.createElement('button'); close.type = 'button'; close.className = 'map-place-close'; close.textContent = '×'; close.setAttribute('aria-label', 'Close place preview');
      close.addEventListener('click', () => dismiss(true)); card.append(close);
      const list = document.createElement('div'); list.className = 'map-place-visits';
      const visits = members.flatMap(member => member.days.map(day => ({member,day}))).sort((a,b) => a.day.number-b.day.number);
      for (const {member,day} of visits) {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'map-place-visit';
        const heading = document.createElement('span'); heading.textContent = days.length === 1 ? 'Explore day' : `${members.length > 1 ? member.name + ' · ' : ''}Day ${day.number}`;
        const note = document.createElement('small'); note.textContent = days.length === 1 ? (day.title === member.name ? '' : day.title || '') : day.date || '';
        button.append(heading, note);
        button.setAttribute('aria-label', `Open day ${day.number}: ${day.title || member.name}`);
        button.addEventListener('click', () => select(day));
        button.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch') onPreviewDays([day.id]); });
        button.addEventListener('focus', () => onPreviewDays([day.id]));
        list.append(button);
      }
      card.append(list);
      card.addEventListener('pointerenter', () => { cancelTimers(); onPreviewDays(dayIds.length ? dayIds : entry.group.days.map(day => day.id)); }); card.addEventListener('pointerleave', deferClose);
      card.addEventListener('focusin', cancelTimers);
      card.addEventListener('focusout', event => { if (!card?.contains(event.relatedTarget)) deferClose(); });
      card.addEventListener('pointerdown', event => event.stopPropagation());
      card.addEventListener('click', event => event.stopPropagation());
      container.append(card); positionCard(entry);
      entry.button.setAttribute('aria-describedby', description.id); entry.button.setAttribute('aria-expanded', 'true');
      if (pinned) list.querySelector('button')?.focus({ preventScroll: true });
    };
    const setPreview = (dayIds, { show = false, preserveCard = false } = {}) => {
      previewIds = dayIds;
      entries.forEach(entry => {
        const highlighted = entry.group.days.some(day => dayIds.includes(day.id));
        entry.button.classList.toggle('is-preview', highlighted);
        entry.button.classList.toggle('is-muted', Boolean(dayIds.length) && !highlighted);
        entry.element.style.zIndex = highlighted ? '4' : entry.group.selected ? '2' : '1';
      });
      if (show) {
        const entry = entries.find(item => item.group.days.some(day => dayIds.includes(day.id)) && item.element.style.visibility !== 'hidden');
        if (entry) showCard(entry, {dayIds,origin:'linked'});
        else if (card?.dataset.origin === 'linked') closeCard();
      } else if (card?.dataset.origin === 'linked' && (!preserveCard || !dayIds.length)) closeCard();
    };
    const refresh = () => {
      frame = null;
      if (map.isMoving()) return;
      closeCard(); entries.forEach(entry => entry.marker.remove()); entries = [];
      const width = container.clientWidth, height = container.clientHeight;
      if (!width || !height) return;
      const targetSize = matchMedia('(max-width: 900px), (pointer: coarse)').matches ? 44 : 32;
      const clustered = clusterGroups(groups, coordinate => map.project(coordinate), targetSize + 8);
      const occupied = obstacles(), bounds = {left:4,right:width-4,top:4,bottom:height-4};
      routeStrokes = routes.flatMap(route => {
        const points = route.coordinates.map(coordinate => map.project(coordinate));
        return points.slice(1).map((end,index) => ({start:points[index],end,padding:route.padding,dayIds:route.dayIds || []}));
      });
      for (const group of clustered) {
        const dot = group.days.length > 1 || group.members.length > 1;
        const placement = placePin(map.project(group.coordinate), {dot,targetSize,bounds,occupied,routes:routeStrokes});
        if (!placement) continue;
        occupied.push(placement.box);
        const element = document.createElement('div'); element.className = 'location-label-anchor';
        const button = document.createElement('button'); button.type = 'button'; button.className = 'location-pin';
        button.classList.toggle('is-dot', placement.dot); button.classList.toggle('is-selected', group.selected);
        button.style.setProperty('--pin-x', `${placement.offset[0]}px`); button.style.setProperty('--pin-y', `${placement.offset[1]}px`); button.style.setProperty('--pin-angle', `${placement.angle}deg`);
        button.innerHTML = '<svg class="location-pin-shape" viewBox="-18 -18 36 40" aria-hidden="true"><path d="M0 20 L-5 12 A13 13 0 1 1 5 12 Z" /></svg><span class="location-pin-dot" aria-hidden="true"></span>';
        const number = document.createElement('span'); number.className = 'location-pin-number'; number.textContent = dot ? '' : group.days[0].number; number.setAttribute('aria-hidden','true'); button.append(number);
        const accessible = group.members.map(member => `${member.name} · ${dayText(member.days)}`).join('; ');
        button.setAttribute('aria-label', `${accessible} · ${dot ? 'Choose a day' : 'Open day'}`);
        button.setAttribute('aria-expanded','false');
        if (dot) button.setAttribute('aria-haspopup','dialog');
        if (group.selected) button.setAttribute('aria-current','true');
        element.append(button);
        const marker = new maplibregl.Marker({element,anchor:'center'}).setLngLat(group.coordinate).addTo(map);
        element.removeAttribute('role'); element.removeAttribute('tabindex'); element.removeAttribute('aria-label');
        const entry = {element,button,marker,group}; entries.push(entry);
        const preview = () => {
          if (suppressedEntry === entry) return;
          onPreviewDays(group.days.map(day => day.id));
          clearTimeout(closeTimer); clearTimeout(openTimer);
          openTimer = setTimeout(() => showCard(entry), 140);
        };
        button.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch' && finePointer()) { suppressedEntry = null; preview(); } });
        button.addEventListener('pointerleave', () => { suppressedEntry = null; deferClose(); });
        button.addEventListener('focus', () => { if (document.documentElement.dataset.inputMode === 'keyboard') preview(); });
        button.addEventListener('blur', event => { if (!card?.contains(event.relatedTarget)) deferClose(); });
        button.addEventListener('click', event => {
          event.stopPropagation(); cancelTimers(); suppressedEntry = null;
          if (dot) { onPreviewDays(group.days.map(day => day.id)); showCard(entry,{pinned:true}); }
          else select(group.days[0]);
        });
        button.addEventListener('dblclick', event => event.stopPropagation());
      }
      setPreview(previewIds);
      if (pendingFocus) {
        const selected = entries.find(entry => entry.group.selected);
        if (selected) selected.button.focus({preventScroll:true});
        pendingFocus = false;
      }
    };
    const schedule = () => { if (frame === null) frame = requestAnimationFrame(refresh); };
    const moving = () => { closeCard(); endPreview(); };
    const outside = event => { if (card && !card.contains(event.target) && !cardEntry.element.contains(event.target)) dismiss(); };
    const escape = event => { if (event.key === 'Escape' && card) { event.stopPropagation(); suppressedEntry = cardEntry; closeCard(true); endPreview(); } };
    container.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape);
    map.on('movestart', moving); map.on('moveend', schedule); map.on('resize', schedule);
    return {
      update(nextGroups, nextRoutes) { groups = nextGroups; routes = nextRoutes; previewIds = []; closeCard(); schedule(); },
      setPreview,
      destroy() {
        closeCard(); if (frame !== null) cancelAnimationFrame(frame);
        entries.forEach(entry => entry.marker.remove());
        container.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape);
        map.off('movestart', moving); map.off('moveend', schedule); map.off('resize', schedule);
      }
    };
  }
  root.JOURNEY_ATLAS_LOCATION_LABELS = { groupsForJourney, dayText, overlaps, crossesRoute, clusterGroups, placePin, create };
})(typeof window === 'undefined' ? globalThis : window);
