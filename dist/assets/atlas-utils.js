(function (root) {
  "use strict";
  function resolvePhoto(photo, override = {}) {
    const result = { ...photo, ...override, ...(override.location || {}) };
    if (override.location === null) {
      delete result.lat; delete result.lng; delete result.zoom;
      result.locationLabel = "";
    }
    return result;
  }
  function visiblePhotos(journey, manifests, overrides) {
    return (manifests?.[journey.id] || journey.photos || []).map(p => resolvePhoto(p, overrides?.photos?.[p.id])).filter(p => !p.hidden && !p.trashed);
  }
  function resolveCover(journey, photos) {
    const photo = photos.find(p => p.id === journey.coverPhoto?.photoId && !p.hidden) || photos.find(p => !p.hidden);
    const focal = photo && photo.id === journey.coverPhoto?.photoId ? (journey.coverPhoto.focal || [50,50]) : [50, 50];
    return { photo, position: `${focal[0]}% ${focal[1]}%` };
  }
  function photoCaption(photo, day) {
    const caption = photo.caption || "";
    const time = photo.takenAt?.match(/(\d{2}:\d{2})$/)?.[1];
    // Only strip the importer's exact generated pattern; leave custom prose alone.
    return time && caption === `${day.title} · ${time}` ? day.title : caption;
  }
  function travelDuration(segments) {
    if (!segments.length) return "";
    const known = segments.filter(s => Number.isFinite(s.durationMinutes) && s.durationMinutes >= 0);
    if (!known.length) return segments.length === 1 ? segments[0].duration || "" : "";
    const format = minutes => `${Math.floor(minutes / 60) ? `${Math.floor(minutes / 60)} h ` : ""}${minutes % 60 ? `${minutes % 60} min` : ""}`.trim() || "0 min";
    const min = known.reduce((sum, s) => sum + s.durationMinutes, 0);
    const max = known.reduce((sum, s) => sum + (s.durationMaxMinutes ?? s.durationMinutes), 0);
    const qualifiers = [...new Set(known.map(s => s.durationQualifier).filter(Boolean))];
    return `${format(min)}${max > min ? `–${format(max)}` : ""} travel${known.length < segments.length ? ` (${known.length} of ${segments.length} legs timed)` : ""}${qualifiers.length ? ` · ${qualifiers.join(", ")}` : ""}`;
  }
  function proposalGate() {
    let revision = 0;
    return { invalidate() { revision++; }, capture(context) { return { revision: ++revision, context: JSON.stringify(context) }; }, current(token, context) { return token.revision === revision && token.context === JSON.stringify(context); } };
  }
  function locatedPhoto(photo) {
    return Boolean(photo && !photo.hidden && !photo.trashed && Number.isFinite(photo.lng) && Number.isFinite(photo.lat)
      && Math.abs(photo.lng) <= 180 && Math.abs(photo.lat) <= 90);
  }

  function photoDistanceMeters(a, b) {
    const radians = Math.PI / 180;
    const dLat = (b.lat - a.lat) * radians, dLng = (b.lng - a.lng) * radians;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * radians) * Math.cos(b.lat * radians) * Math.sin(dLng / 2) ** 2;
    return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
  }

  function photoLandmarkGroups(photos, project, { width, height, maxDistance = 500 }) {
    const groups = [];
    for (const photo of photos.filter(locatedPhoto)) {
      // Every pair must satisfy the distance limit: nearby chains must not join
      // photos more than 500 metres apart. Grouping never depends on zoom.
      const group = groups.find(group => group.photos.every(member => member.dayId === photo.dayId && photoDistanceMeters(member, photo) <= maxDistance));
      if (group) group.photos.push(photo);
      else groups.push({ photos: [photo] });
    }
    const visible = point => Number.isFinite(point.x) && Number.isFinite(point.y)
      && point.x >= -24 && point.y >= -24 && point.x <= width + 24 && point.y <= height + 24;
    return groups.flatMap(group => {
      const photo = group.photos.find(photo => visible(project([photo.lng, photo.lat])));
      return photo ? [{ ...group, photo, point: project([photo.lng, photo.lat]) }] : [];
    });
  }

  function routeIntersectsPhotoBox(point, routes, radius = 36) {
    const left = point.x - radius, right = point.x + radius;
    const top = point.y - radius, bottom = point.y + radius;
    return routes.some(route => route.some((end, index) => {
      if (!index) return false;
      const start = route[index - 1];
      if (Math.max(start.x, end.x) < left || Math.min(start.x, end.x) > right
        || Math.max(start.y, end.y) < top || Math.min(start.y, end.y) > bottom) return false;
      // Clip the entire segment to the padded thumbnail box; checking vertices
      // alone misses long route edges crossing between two off-box endpoints.
      let enter = 0, exit = 1;
      for (const [origin, delta, min, max] of [[start.x, end.x - start.x, left, right], [start.y, end.y - start.y, top, bottom]]) {
        if (!delta) { if (origin < min || origin > max) return false; }
        else {
          const a = (min - origin) / delta, b = (max - origin) / delta;
          enter = Math.max(enter, Math.min(a, b)); exit = Math.min(exit, Math.max(a, b));
          if (enter > exit) return false;
        }
      }
      return true;
    }));
  }

  function photoLandmarkLayout(photos, project, { width, height, spacing = 64, top = 54, bottom = 76, routes = [] }) {
    const inset = 28;
    const bounds = { left: inset, right: Math.max(inset, width - inset),
      top: Math.min(top + inset, height / 3), bottom: Math.max(height / 3, height - bottom - inset) };
    const clampPoint = point => ({ x: Math.max(bounds.left, Math.min(bounds.right, point.x)),
      y: Math.max(bounds.top, Math.min(bounds.bottom, point.y)) });
    const grid = [];
    for (let y = bounds.top; y <= bounds.bottom; y += 20) {
      for (let x = bounds.left; x <= bounds.right; x += 20) {
        const point = { x, y };
        if (!routeIntersectsPhotoBox(point, routes)) grid.push(point);
      }
    }
    const placements = [];
    for (const group of photoLandmarkGroups(photos, project, { width, height })) {
      const anchor = group.point;
      const desired = clampPoint(anchor);
      const candidates = routeIntersectsPhotoBox(desired, routes) ? grid : [desired, ...grid];
      const free = candidates.filter(point => placements.every(placed =>
        Math.abs(point.x - placed.point.x) >= spacing || Math.abs(point.y - placed.point.y) >= spacing));
      // Never fall back to placing a thumbnail over the route. At a completely
      // packed view the day's album still provides access to every photograph.
      if (!free.length) continue;
      const point = free.reduce((best, candidate) =>
        Math.hypot(candidate.x - desired.x, candidate.y - desired.y) < Math.hypot(best.x - desired.x, best.y - desired.y) ? candidate : best);
      placements.push({ photo: group.photo, photos: group.photos, anchor, point, offset: [point.x - anchor.x, point.y - anchor.y] });
    }
    return placements;
  }

  function photoMapTransition(map, { schedule = setTimeout, unschedule = clearTimeout } = {}) {
    let generation = 0, timer = null, listener = null, cleanup = null;
    function cancel() {
      generation++;
      if (timer !== null) unschedule(timer);
      timer = null;
      if (listener) map.off("moveend", listener);
      listener = null;
      const finish = cleanup; cleanup = null; finish?.();
      map.stop();
    }
    function move(from, to, { reducedMotion = false, padding = 36, onFinish } = {}) {
      cancel();
      if (!locatedPhoto(to)) return;
      const token = generation;
      cleanup = onFinish;
      const target = { center: [to.lng, to.lat], zoom: Math.max(2, Math.min(20, to.zoom || 16)) };
      const finish = () => { const fn = cleanup; cleanup = null; fn?.(); };
      const listen = fn => {
        listener = () => {
          map.off("moveend", listener); listener = null;
          if (token === generation) fn();
        };
        map.on("moveend", listener);
      };
      const settle = () => {
        listen(finish);
        map.easeTo({ ...target, duration: reducedMotion ? 0 : 950 });
      };
      const separate = locatedPhoto(from) && from.id !== to.id
        && (Math.abs(from.lng - to.lng) > 0.00001 || Math.abs(from.lat - to.lat) > 0.00001);
      if (!separate || reducedMotion) {
        listen(finish);
        map.easeTo({ ...target, duration: reducedMotion ? 0 : 650 });
        return;
      }
      listen(() => {
        timer = schedule(() => { timer = null; if (token === generation) settle(); }, 150);
      });
      // About two seconds total: orient to both pins, pause briefly, settle.
      map.fitBounds([[Math.min(from.lng, to.lng), Math.min(from.lat, to.lat)],
        [Math.max(from.lng, to.lng), Math.max(from.lat, to.lat)]], {
        padding, maxZoom: Math.max(2, Math.min(map.getZoom(), target.zoom) - 0.8),
        duration: 850, linear: true
      });
    }
    return { move, cancel };
  }

  root.JOURNEY_ATLAS_UTILS = { resolvePhoto, visiblePhotos, resolveCover, photoCaption, travelDuration, proposalGate, locatedPhoto, photoDistanceMeters, routeIntersectsPhotoBox, photoLandmarkGroups, photoLandmarkLayout, photoMapTransition };
})(typeof globalThis === "undefined" ? this : globalThis);
