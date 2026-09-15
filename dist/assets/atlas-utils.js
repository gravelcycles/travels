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
      delete result.lat; delete result.lng; delete result.zoom; delete result.mapFrame;
      result.locationLabel = "";
    }
    // Legacy Hide flags never exclude photos; Trash is the removal mechanism.
    delete result.hidden;
    return result;
  }
  function visiblePhotos(journey, manifests, overrides) {
    return (manifests?.[journey.id] || journey.photos || []).map(p => resolvePhoto(p, overrides?.photos?.[p.id])).filter(p => !p.trashed);
  }
  function resolveCover(journey, photos) {
    const photo = photos.find(p => p.id === journey.coverPhoto?.photoId && !p.trashed) || photos.find(p => !p.trashed);
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
    return Boolean(photo && !photo.trashed && Number.isFinite(photo.lng) && Number.isFinite(photo.lat)
      && Math.abs(photo.lng) <= 180 && Math.abs(photo.lat) <= 90);
  }

  function validPhotoFrame(frame) {
    const b = frame?.bounds;
    return Array.isArray(b) && b.length === 2 && b.every(p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite))
      && b[0][0] >= -180 && b[0][0] < 180 && b[1][0] > b[0][0] && b[1][0] - b[0][0] <= 360
      && b[0][1] >= -85.051129 && b[1][1] <= 85.051129 && b[1][1] > b[0][1];
  }

  function frameContainsPhoto(frame, photo) {
    if (!validPhotoFrame(frame) || !locatedPhoto(photo)) return false;
    const [[west, south], [east, north]] = frame.bounds;
    const lng = west + ((photo.lng - west) % 360 + 360) % 360;
    return lng <= east && photo.lat >= south && photo.lat <= north;
  }

  function normalizePhotoFrame(bounds) {
    const [[west, south], [east, north]] = bounds;
    const width = Math.min(360, east - west);
    const start = west >= -180 && west < 180 ? west : ((west + 180) % 360 + 360) % 360 - 180;
    return { bounds: [[start, Math.max(-85.051129, south)], [start + width, Math.min(85.051129, north)]] };
  }

  // Older photos have no viewport recorded. Reconstruct their north-up frame
  // from the pin, saved zoom and the actual display size without rewriting data.
  function photoMapFrame(photo, { width = 360, height = 260 } = {}) {
    if (!locatedPhoto(photo)) return null;
    if (validPhotoFrame(photo.mapFrame)) return photo.mapFrame;
    const world = 512 * 2 ** Math.max(2, Math.min(20, photo.zoom || 16));
    const lat = Math.max(-85.051128, Math.min(85.051128, photo.lat)) * Math.PI / 180;
    const y = (1 - Math.log(Math.tan(Math.PI / 4 + lat / 2)) / Math.PI) / 2;
    const latitude = value => Math.atan(Math.sinh(Math.PI * (1 - 2 * value))) * 180 / Math.PI;
    const halfWidth = Math.min(180, width / world * 180);
    return normalizePhotoFrame([[photo.lng - halfWidth, latitude(y + height / world / 2)],
      [photo.lng + halfWidth, latitude(y - height / world / 2)]]);
  }

  function photoMapCamera(map, photo, { padding = 0 } = {}) {
    if (validPhotoFrame(photo.mapFrame)) {
      const camera = map.cameraForBounds(photo.mapFrame.bounds, { padding, maxZoom: 20 });
      if (camera) return { center: camera.center, zoom: camera.zoom, bearing: 0, pitch: 0 };
    }
    return { center: [photo.lng, photo.lat], zoom: Math.max(2, Math.min(20, photo.zoom || 16)) };
  }

  function photoInMapFrame(map, photo, padding = 0) {
    if (!locatedPhoto(photo)) return false;
    const canvas = map.getCanvas();
    const center = map.getCenter();
    const lng = photo.lng + 360 * Math.round((center.lng - photo.lng) / 360);
    const point = map.project([lng, photo.lat]);
    return point.x >= padding && point.x <= canvas.clientWidth - padding
      && point.y >= padding && point.y <= canvas.clientHeight - padding;
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
      if (!locatedPhoto(to)) { onFinish?.(); return; }
      const token = generation;
      cleanup = onFinish;
      const target = photoMapCamera(map, to);
      const finish = () => { const fn = cleanup; cleanup = null; fn?.(); };
      // Navigation changes the active pin, not the camera, while both pins fit.
      // Use the live viewport so manual pans, resizing and rapid navigation count.
      if (locatedPhoto(from) && photoInMapFrame(map, from) && photoInMapFrame(map, to)) {
        finish();
        return;
      }
      const listen = fn => {
        listener = () => {
          map.off("moveend", listener); listener = null;
          if (token === generation) fn();
        };
        map.on("moveend", listener);
      };
      const separate = locatedPhoto(from) && from.id !== to.id
        && (Math.abs(from.lng - to.lng) > 0.00001 || Math.abs(from.lat - to.lat) > 0.00001);
      if (!separate || reducedMotion) {
        listen(finish);
        map.easeTo({ ...target, duration: reducedMotion ? 0 : 500 });
        return;
      }
      const toLng = to.lng + 360 * Math.round((from.lng - to.lng) / 360);
      const bounds = [[Math.min(from.lng, toLng), Math.min(from.lat, to.lat)],
        [Math.max(from.lng, toLng), Math.max(from.lat, to.lat)]];
      const overview = map.cameraForBounds(bounds, { padding, maxZoom: Math.min(map.getZoom(), target.zoom) });
      // A small pan or a direct zoom to a wider destination needs no extra arc.
      if (!overview || overview.zoom >= Math.min(map.getZoom(), target.zoom) - 0.35) {
        listen(finish);
        map.easeTo({ ...target, duration: 500 });
        return;
      }
      const duration = Math.round(Math.min(800, 500 + (Math.min(map.getZoom(), target.zoom) - overview.zoom) * 45));
      listen(() => {
        timer = schedule(() => {
          timer = null;
          if (token !== generation) return;
          listen(finish);
          map.easeTo({ ...target, duration, easing: t => t * t });
        }, 40);
      });
      // Quadratic halves form a parabolic zoom arc with only 40 ms at its peak.
      map.easeTo({ ...overview, pitch: 0, duration, easing: t => 1 - (1 - t) ** 2 });
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
      ], { duration: image.id === 'modal-photo' ? 350 : 650, easing: 'ease' });
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

  root.JOURNEY_ATLAS_UTILS = { createImageReveals, prepareImageReveals, resetImageReveal, addMapAttribution, photoPreloadPlan, dayPreloadPlan, resolvePhoto, visiblePhotos, resolveCover, photoCaption, travelDuration, proposalGate, locatedPhoto, validPhotoFrame, frameContainsPhoto, normalizePhotoFrame, photoMapFrame, photoMapCamera, photoInMapFrame, photoMapTransition };
})(typeof globalThis === "undefined" ? this : globalThis);
