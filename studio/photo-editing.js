(function (root) {
  'use strict';
  function fingerprint(photo, state) {
    const value = root.JOURNEY_ATLAS_UTILS.resolvePhoto(photo, state.photos[photo.id] || {});
    return JSON.stringify([
      value.dayId, value.caption || '', value.description || '', value.locationLabel || '',
      value.lat ?? null, value.lng ?? null, value.zoom || 16,
      value.mapFrame || null, Boolean(value.trashed),
      state.days[value.dayId]?.photoOrder || null
    ]);
  }
  function status({photo, state, saved, saving, failed = false, pending = false}) {
    if (!photo) return {kind:'empty', label:''};
    if (!saved) return {kind:'loading', label:'Loading saved photo…'};
    const current = fingerprint(photo, state);
    if (!pending && current === fingerprint(photo, saved)) return {kind:'saved', label:'Saved locally', icon:'✓'};
    if (!pending && saving && current === fingerprint(photo, saving)) return {kind:'saving', label:'Saving locally…', icon:'…'};
    if (failed) return {kind:'error', label:'Not saved · try Save locally again', icon:'!'};
    return {kind:'dirty', label:'Unsaved changes · Save locally', icon:'●'};
  }
  function arrowStep(event) {
    if (event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return 0;
    if (event.target?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="slider"], #studio-map, dialog')) return 0;
    return event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
  }
  function coordinates(fields) {
    const lat = String(fields.lat ?? '').trim(), lng = String(fields.lng ?? '').trim(), zoom = String(fields.zoom ?? '').trim();
    const number = value => /^[-+]?(?:\d+\.?\d*|\.\d+)$/.test(value) && Number.isFinite(Number(value));
    if ((lat || lng) && (!number(lat) || Math.abs(Number(lat)) > 90)) return {error:'Finish the latitude (−90 to 90).',field:'lat'};
    if ((lat || lng) && (!number(lng) || Math.abs(Number(lng)) > 180)) return {error:'Finish the longitude (−180 to 180).',field:'lng'};
    if (!number(zoom) || Number(zoom) < 2 || Number(zoom) > 20) return {error:'Finish the map zoom (2 to 20).',field:'zoom'};
    return {location:lat || lng ? {lat:Number(lat),lng:Number(lng)} : null,zoom:Number(zoom)};
  }
  root.JOURNEY_ATLAS_PHOTO_EDITING = {fingerprint, status, arrowStep, coordinates};
})(typeof window === 'undefined' ? globalThis : window);
