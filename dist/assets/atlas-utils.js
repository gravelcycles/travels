(function (root) {
  "use strict";
  function addMapAttribution(map, maplibre) {
    class CollapsedAttributionControl extends maplibre.AttributionControl {
      onAdd(map) {
        const container = super.onAdd(map);
        // MapLibre opens compact attribution initially. Set compact even before
        // source credits arrive so loading tiles cannot expand it again.
        container.classList.add("maplibregl-compact");
        container.classList.remove("maplibregl-compact-show");
        container.removeAttribute("open");
        return container;
      }
    }
    map.addControl(new CollapsedAttributionControl({ compact: true }), "bottom-right");
  }
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
    function cancel({ stopMap = true } = {}) {
      generation++;
      if (timer !== null) unschedule(timer);
      timer = null;
      if (listener) map.off("moveend", listener);
      listener = null;
      const finish = cleanup; cleanup = null; finish?.();
      // User gestures already interrupt the camera animation. Stopping the map
      // from their movestart event would also reset the active drag/zoom handler.
      if (stopMap) map.stop();
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

  function dayPreloadPlan(days, currentDayId, direction = 1) {
    const index = days.findIndex(day => day.id === currentDayId);
    if (index < 0) return [];
    const step = direction < 0 ? -1 : 1, ahead = [], behind = [];
    for (let i = index + step; i >= 0 && i < days.length; i += step) if (days[i].photos.length) ahead.push(days[i]);
    for (let i = index - step; i >= 0 && i < days.length; i -= step) if (days[i].photos.length) behind.push(days[i]);
    const ordered = [...ahead, days[index], ...behind].filter(day => day.photos.length);
    const nearby = ahead.slice(0, 2), requests = [], seen = new Set();
    // Leave six slots for the viewer's full-size neighbors in the 80-item queue.
    const limit = 74;
    const add = (photo, width) => {
      const key = `${photo.id}:${width}`;
      if (!seen.has(key) && requests.length < limit) { seen.add(key); requests.push({photo, width}); }
    };
    for (const day of nearby) add(day.photos[0], 1280);
    // The All photos dialog needs a small cover for every nonempty day.
    for (const day of ordered) add(day.photos[0], 480);
    // Reserve room for each journal's main image before filling filmstrips.
    const remainingLeads = ordered.filter(day => !seen.has(`${day.photos[0].id}:1280`));
    const thumbnailLimit = Math.max(requests.length, limit - remainingLeads.length);
    // Interleave the next two strips so one large day cannot monopolize the queue.
    const longest = Math.max(0, ...nearby.map(day => day.photos.length));
    for (let i = 1; i < longest && requests.length < thumbnailLimit; i++) {
      for (const day of nearby) if (day.photos[i] && requests.length < thumbnailLimit) add(day.photos[i], 480);
    }
    for (const day of remainingLeads) add(day.photos[0], 1280);
    return requests;
  }

  // Presentation is independent of fetching/decoding, so cached photos reveal too.
  function createImageReveals(env = root) {
    const media = env.matchMedia('(min-width: 901px) and (prefers-reduced-motion: no-preference)');
    const records = new Map();
    const observer = env.IntersectionObserver ? new env.IntersectionObserver(entries => {
      for (const entry of entries) {
        const record = records.get(entry.target);
        if (!record) continue;
        record.visible = entry.isIntersecting;
        if (record.visible) reveal(record);
        else resetRecord(record);
      }
    }) : null;
    function resetRecord(record) {
      record.animation?.cancel();
      record.animation = null;
      record.source = '';
      delete record.image.dataset.imageRevealing;
    }
    function reveal(record) {
      const image = record.image;
      const ready = image.complete && image.naturalWidth > 0 && image.getAttribute('src')
        && !image.dataset.src
        && (!image.dataset.privateSrc || image.dataset.photoState === 'ready')
        && (!image.dataset.photoState || image.dataset.photoState === 'ready')
        && (!image.classList.contains('progressive-image') || image.classList.contains('is-loaded'));
      if (!ready) { resetRecord(record); return; }
      if (!media.matches || !record.visible || !image.isConnected || !image.getClientRects().length || !image.animate) return;
      const source = image.currentSrc || image.src;
      if (record.source === source) return;
      resetRecord(record);
      record.source = source;
      image.dataset.imageRevealing = 'true';
      // A new animation always starts, even when ready/loading changes share a paint.
      const animation = image.animate([
        { opacity: 0, filter: 'blur(16px)' },
        { opacity: 1, filter: 'blur(0px)' }
      ], { duration: 650, easing: 'ease' });
      record.animation = animation;
      animation.onfinish = animation.oncancel = () => {
        if (record.animation !== animation) return;
        record.animation = null;
        delete image.dataset.imageRevealing;
      };
    }
    function watch(image) {
      if (records.has(image)) return records.get(image);
      const record = { image, visible: !observer, source: '', animation: null };
      // Wait for the loader's other load handlers to mark progressive images ready.
      record.loaded = () => env.queueMicrotask(() => { if (records.get(image) === record) reveal(record); });
      for (const event of ['load', 'error', 'atlas-photo-state']) image.addEventListener(event, record.loaded);
      records.set(image, record);
      observer?.observe(image);
      return record;
    }
    function prepare(container) {
      for (const [image, record] of records) if (!image.isConnected) {
        resetRecord(record);
        observer?.unobserve(image);
        for (const event of ['load', 'error', 'atlas-photo-state']) image.removeEventListener(event, record.loaded);
        records.delete(image);
      }
      for (const image of container.querySelectorAll('img')) reveal(watch(image));
    }
    function reset(image) { resetRecord(watch(image)); }
    media.addEventListener('change', () => {
      for (const record of records.values()) {
        if (media.matches) reveal(record);
        else resetRecord(record);
      }
    });
    return { prepare, reset };
  }
  let imageReveals;
  function prepareImageReveals(container) { (imageReveals ||= createImageReveals()).prepare(container); }
  function resetImageReveal(image) { (imageReveals ||= createImageReveals()).reset(image); }

  root.JOURNEY_ATLAS_UTILS = { createImageReveals, prepareImageReveals, resetImageReveal, addMapAttribution, photoPreloadPlan, dayPreloadPlan, resolvePhoto, visiblePhotos, resolveCover, photoCaption, travelDuration, proposalGate, locatedPhoto, photoMapTransition };
})(typeof globalThis === "undefined" ? this : globalThis);
