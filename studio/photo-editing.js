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
  root.JOURNEY_ATLAS_PHOTO_EDITING = {fingerprint, status, arrowStep};
})(typeof window === 'undefined' ? globalThis : window);
