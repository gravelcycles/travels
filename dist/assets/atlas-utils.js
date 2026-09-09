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
    return (manifests?.[journey.id] || journey.photos || []).map(p => resolvePhoto(p, overrides?.photos?.[p.id])).filter(p => !p.hidden);
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
  root.JOURNEY_ATLAS_UTILS = { resolvePhoto, visiblePhotos, resolveCover, photoCaption, travelDuration, proposalGate };
})(typeof globalThis === "undefined" ? this : globalThis);
