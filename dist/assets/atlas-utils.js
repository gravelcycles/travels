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

  // Inputs are already filtered and ordered by the reviewed album/day order.
  function photoPreloadPlan(days, currentId, direction = 1) {
    const photos = days.flatMap(day => day.photos);
    const index = photos.findIndex(photo => photo.id === currentId);
    if (index < 0) return [];
    const step = direction < 0 ? -1 : 1, requests = [], seen = new Set();
    const add = (photo, width = Infinity) => {
      if (!photo || photo.id === currentId) return;
      const key = `${photo.id}:${width}`;
      if (!seen.has(key)) { seen.add(key);requests.push({photo, width}); }
    };
    add(photos[index + step]);add(photos[index + step * 2]);add(photos[index - step]);
    const dayIndex = days.findIndex(day => day.photos.some(photo => photo.id === currentId));
    for (let i = dayIndex + step; i >= 0 && i < days.length; i += step) {
      if (!days[i].photos.length) continue;
      // Day controls open the first photo, including when browsing backwards.
      add(days[i].photos[0]);add(days[i].photos[0], 480);break;
    }
    return requests.slice(0, 6);
  }

  root.JOURNEY_ATLAS_UTILS = { photoPreloadPlan, resolvePhoto, visiblePhotos, resolveCover, photoCaption, travelDuration, proposalGate, locatedPhoto, photoMapTransition };
})(typeof globalThis === "undefined" ? this : globalThis);
