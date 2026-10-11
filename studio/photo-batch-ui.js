(function (root) {
  'use strict';
  root.JOURNEY_ATLAS_PHOTO_BATCH_UI = {create({getContext, replaceState, redraw, selectPhoto, resizeMap, photoUrl, escapeHtml}) {
    const $ = selector => document.querySelector(selector), model = root.JOURNEY_ATLAS_PHOTO_BATCH;
    let active = false, selected = new Set(), undo = null, visible = [], filtered = [], inspectSelected = false;
    const label = photo => model.photoMetadata(photo, model.resolvedJourney(getContext().journey, getContext().state)).title;
    function render(photos, selectedPhotoId) {
      const context = getContext(), journey = model.resolvedJourney(context.journey, context.state);
      const known = new Set(photos.map(photo => photo.id));
      selected = new Set([...selected].filter(id => known.has(id)));
      const requestedDay = $('#photo-day-filter').value;
      const dayId = journey.days.some(day => day.id === requestedDay) ? requestedDay : 'all';
      filtered = model.filterPhotos(photos, journey, {query:$('#photo-search').value, dayId, trash:$('#show-photo-trash').checked});
      visible = inspectSelected ? photos.filter(photo => selected.has(photo.id)) : filtered;
      if (!active && selectedPhotoId && !visible.some(photo => photo.id === selectedPhotoId)) {
        selectedPhotoId = visible[0]?.id || null; selectPhoto(selectedPhotoId, false);
      }
      const outside = [...selected].filter(id => !filtered.some(photo => photo.id === id)).length;
      $('#photo-batch-inspect').hidden = !selected.size;
      $('#photo-batch-inspect').textContent = inspectSelected ? 'Back to filter' : 'Show selected';
      $('#photo-batch-inspect').setAttribute('aria-pressed', String(inspectSelected));
      $('#photo-batch-clear-hidden').hidden = !outside;
      $('#photo-batch-clear-hidden').textContent = `Clear ${outside} outside filter`;
      $('#photo-batch-count').textContent = `${selected.size} selected${outside ? ` · ${outside} outside this filter` : ''} · ${visible.length} shown`;

      $('#photo-batch-apply').disabled = !selected.size;
      $('#photo-batch-clear').disabled = !selected.size;
      $('#photo-batch-all').disabled = !visible.length;
      $('#photo-batch-all').textContent = visible.length && visible.every(photo => selected.has(photo.id)) ? 'Deselect shown' : 'Select all shown';
      $('#photo-batch-undo').disabled = !undo;
      $('.photo-batch-actions').hidden = !selected.size && !undo;
      const daySelect = $('#photo-batch-day'), previous = daySelect.value;
      const eventWord = root.JOURNEY_ATLAS_UTILS.eventWord(journey, 'title');
      daySelect.innerHTML = journey.days.map(day => `<option value="${escapeHtml(day.id)}">${eventWord} ${day.number} · ${escapeHtml(day.title)}</option>`).join('');
      daySelect.value = journey.days.some(day => day.id === previous) ? previous : journey.days[0]?.id || '';
      const action = $('#photo-batch-action').value, count = `${selected.size} photo${selected.size === 1 ? '' : 's'}`;
      $('#photo-batch-day-label').hidden = action !== 'assign';
      $('#photo-batch-apply').textContent = action === 'assign' ? `Move ${count} to ${journey.days.find(day => day.id === daySelect.value)?.title || 'selected day'}` : action === 'trash' ? `Move ${count} to Trash` : action === 'restore' ? `Restore ${count}` : `Move ${count} to album starts`;
      $('#studio-photo-grid').innerHTML = visible.length ? visible.map(photo => {
        const thumb = photo.srcset?.[0]?.src || photo.src, chosen = selected.has(photo.id);
        const day = journey.days.find(day => day.id === photo.dayId);
        return `<button type="button" data-photo-id="${escapeHtml(photo.id)}" class="${active ? chosen ? 'batch-selected' : '' : photo.id === selectedPhotoId ? 'active' : ''}" ${active ? `aria-pressed="${chosen}"` : ''} aria-label="${active ? 'Select' : 'Edit'} ${escapeHtml(label(photo))}, ${eventWord} ${day?.number}${photo.trashed ? ', in trash' : ''}">
          <img src="${escapeHtml(photoUrl(thumb))}" alt="" loading="lazy" />
          ${active ? `<b class="batch-check" aria-hidden="true">${chosen ? '✓' : ''}</b>` : ''}
          <span>${escapeHtml(label(photo))}${active ? `<small>${escapeHtml(model.photoMetadata(photo, journey).detail)}${photo.trashed ? ' · In trash' : ''}</small>` : ''}</span>
          <i class="${Number.isFinite(photo.lat) && Number.isFinite(photo.lng) ? '' : 'unlocated'}" title="${Number.isFinite(photo.lat) && Number.isFinite(photo.lng) ? 'Located' : 'Needs location'}"></i></button>`;
      }).join('') : `<p class="editor-note">${$('#photo-search').value.trim() ? 'No matching photos. Try a different search or day.' : $('#show-photo-trash').checked ? 'No photos in trash for this selection.' : 'No photos here yet. Use Add photos to begin.'}</p>`;
    }
    function setActive(value) {
      active = value;
      if (!active) inspectSelected = false;
      $('.studio-shell').dataset.batch = String(active);
      $('#photo-batch-toggle').textContent = active ? 'Done selecting' : 'Select multiple';
      $('#photo-batch-toggle').setAttribute('aria-pressed', String(active));
      $('#photo-batch-tools').hidden = !active;
      redraw(); resizeMap();
    }
    $('#photo-search').addEventListener('input', redraw);
    $('#photo-batch-toggle').addEventListener('click', () => setActive(!active));
    $('#photo-batch-all').addEventListener('click', () => {selected = model.toggleVisible(selected, visible.map(photo => photo.id)); redraw();});
    $('#photo-batch-clear').addEventListener('click', () => {selected.clear(); redraw();});
    $('#photo-batch-action').addEventListener('change', redraw);
    $('#photo-batch-day').addEventListener('change', redraw);
    $('#photo-batch-inspect').addEventListener('click', () => {inspectSelected = !inspectSelected; redraw();});
    $('#photo-batch-clear-hidden').addEventListener('click', () => {selected = new Set([...selected].filter(id => filtered.some(photo => photo.id === id))); redraw();});
    $('#photo-batch-apply').addEventListener('click', () => {
      try {
        const result = model.applyBatch({...getContext(), selectedIds:selected, action:$('#photo-batch-action').value, dayId:$('#photo-batch-day').value});
        if (!result.transaction) {$('#photo-batch-message').textContent = 'These photos already have the selected arrangement.'; return;}
        undo = result.transaction;
        replaceState(result.state, `${result.count} photos updated · Save locally to apply`);
        $('#photo-batch-message').textContent = `${result.count} photos updated. Undo batch is available until you reload or switch journeys. Your draft is autosaved.`;
        redraw();
      } catch(error) {$('#photo-batch-message').textContent = error.message;}
    });
    $('#photo-batch-undo').addEventListener('click', () => {
      try {
        const next = model.undoBatch(getContext().state, undo);
        undo = null; replaceState(next, 'Batch change undone · Save locally to apply'); redraw();
        $('#photo-batch-message').textContent = 'Batch change undone. Other edits were kept.';
      } catch(error) {$('#photo-batch-message').textContent = error.message;}
    });
    return {render, click(id) {
      if (!active) {selectPhoto(id); return;}
      selected.has(id) ? selected.delete(id) : selected.add(id); redraw();
      [...$('#studio-photo-grid').querySelectorAll('[data-photo-id]')].find(button => button.dataset.photoId === id)?.focus({preventScroll:true});
    }, reset() {
      selected.clear(); undo = null; inspectSelected = false; $('#photo-search').value = ''; $('#photo-batch-message').textContent = ''; setActive(false);
    }};
  }};
})(window);
