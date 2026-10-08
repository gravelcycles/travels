(function (root) {
  'use strict';
  const copy = value => value === undefined ? undefined : structuredClone(value);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  function orderedPhotos(journey, photos, state) {
    const resolved = photos.map(photo => root.JOURNEY_ATLAS_UTILS.resolvePhoto(photo, state.photos[photo.id] || {}));
    return journey.days.flatMap(day => {
      const order = state.days[day.id]?.photoOrder || [];
      const positions = new Map(order.map((id, index) => [id, index]));
      return resolved.filter(photo => photo.dayId === day.id).map((photo, index) => ({photo, index}))
        .sort((a, b) => (positions.get(a.photo.id) ?? order.length + a.index) - (positions.get(b.photo.id) ?? order.length + b.index))
        .map(item => item.photo);
    });
  }

  function filterPhotos(photos, journey, {query = '', dayId = 'all', trash = false} = {}) {
    const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    const days = new Map(journey.days.map(day => [day.id, day]));
    return photos.filter(photo => {
      if (Boolean(photo.trashed) !== trash || dayId !== 'all' && photo.dayId !== dayId) return false;
      const day = days.get(photo.dayId);
      const haystack = [photo.id, photo.sourceFilename, photo.takenAt, photo.caption, photo.description, photo.locationLabel,
        day?.date, day?.calendarDate, day?.title, `day ${day?.number}`, `stop ${day?.number}`].join(' ').toLocaleLowerCase();
      return terms.every(term => haystack.includes(term));
    });
  }

  function toggleVisible(selectedIds, visibleIds) {
    const next = new Set(selectedIds), all = visibleIds.length > 0 && visibleIds.every(id => next.has(id));
    for (const id of visibleIds) all ? next.delete(id) : next.add(id);
    return next;
  }

  // Validate the entire request before returning a new state. Manifests, source
  // photo metadata, and the caller's draft are never mutated by batch editing.
  function applyBatch({journey, photos, state, selectedIds, action, dayId}) {
    const ids = [...new Set(selectedIds)], known = new Set(photos.map(photo => photo.id));
    if (!ids.length) throw new Error('Select at least one photo.');
    if (ids.some(id => typeof id !== 'string' || !known.has(id))) throw new Error('Some selected photos are no longer in this journey. Select them again.');
    if (!['assign', 'trash', 'restore', 'first'].includes(action)) throw new Error('Choose a batch action.');
    if (action === 'assign' && !journey.days.some(day => day.id === dayId)) throw new Error('Choose a day in this journey.');
    const ordered = orderedPhotos(journey, photos, state), selected = new Set(ids);
    if (ordered.filter(photo => selected.has(photo.id)).length !== ids.length) throw new Error('A selected photo has no valid journey day. Review its day before editing this batch.');
    if (action === 'first' && ordered.some(photo => selected.has(photo.id) && photo.trashed)) throw new Error('Restore selected photos from trash before reordering them.');
    const next = copy(state), changes = [];
    function set(kind, id, field, value) {
      const before = next[kind][id]?.[field];
      if (same(before, value)) return;
      changes.push({kind, id, field, before:copy(before), after:copy(value)});
      next[kind][id] = {...(next[kind][id] || {})};
      if (value === undefined) delete next[kind][id][field]; else next[kind][id][field] = copy(value);
    }
    if (action === 'trash' || action === 'restore') {
      for (const id of ids) set('photos', id, 'trashed', action === 'trash');
    } else if (action === 'first') {
      for (const day of journey.days) {
        const album = ordered.filter(photo => photo.dayId === day.id).map(photo => photo.id);
        if (album.some(id => selected.has(id))) set('days', day.id, 'photoOrder', [...album.filter(id => selected.has(id)), ...album.filter(id => !selected.has(id))]);
      }
    } else {
      const moved = ordered.filter(photo => selected.has(photo.id) && photo.dayId !== dayId);
      for (const photo of moved) set('photos', photo.id, 'dayId', dayId);
      const movedIds = new Set(moved.map(photo => photo.id));
      for (const changedDayId of new Set([...moved.map(photo => photo.dayId), ...(moved.length ? [dayId] : [])])) {
        const album = ordered.filter(photo => photo.dayId === changedDayId && !movedIds.has(photo.id)).map(photo => photo.id);
        if (changedDayId === dayId) album.push(...moved.map(photo => photo.id));
        set('days', changedDayId, 'photoOrder', album);
        if (movedIds.has(next.days[changedDayId]?.leadPhotoId) && changedDayId !== dayId) set('days', changedDayId, 'leadPhotoId', undefined);
      }
    }
    return {state:next, transaction:changes.length ? {journeyId:journey.id, changes} : null, count:ids.length};
  }

  function undoBatch(state, transaction) {
    if (!transaction?.changes?.length) throw new Error('There is no batch change to undo.');
    if (transaction.changes.some(change => !same(state[change.kind]?.[change.id]?.[change.field], change.after))) {
      throw new Error('A field in this batch changed again. Undo is unavailable; use Review / discard draft to review your changes.');
    }
    const next = copy(state);
    for (const {kind, id, field, before} of transaction.changes) {
      next[kind][id] = {...(next[kind][id] || {})};
      if (before === undefined) delete next[kind][id][field]; else next[kind][id][field] = copy(before);
      if (!Object.keys(next[kind][id]).length) delete next[kind][id];
    }
    return next;
  }

  root.JOURNEY_ATLAS_PHOTO_BATCH = {orderedPhotos, filterPhotos, toggleVisible, applyBatch, undoBatch};
})(typeof window === 'undefined' ? globalThis : window);
