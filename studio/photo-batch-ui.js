(function (root) {
  'use strict';
  root.JOURNEY_ATLAS_PHOTO_BATCH_UI = {create({getContext, replaceState, redraw, selectPhoto, resizeMap, photoUrl, escapeHtml}) {
    const $ = selector => document.querySelector(selector), model = root.JOURNEY_ATLAS_PHOTO_BATCH;
    let active = false, selected = new Set(), undo = null, visible = [];
    const label = photo => photo.sourceFilename || photo.caption || photo.id;
    function render(photos, selectedPhotoId) {
      const {journey} = getContext();
      const known = new Set(photos.map(photo => photo.id));
      selected = new Set([...selected].filter(id => known.has(id)));
      visible = model.filterPhotos(photos, journey, {query:$('#photo-search').value, dayId:$('#photo-day-filter').value || 'all', trash:$('#show-photo-trash').checked});
      const outside = [...selected].filter(id => !visible.some(photo => photo.id === id)).length;
      $('#photo-batch-count').textContent = `${selected.size} selected${outside ? ` · ${outside} outside this filter` : ''} · ${visible.length} shown`;
      $('#photo-batch-apply').textContent = `Apply to ${selected.size} photo${selected.size === 1 ? '' : 's'}`;
      $('#photo-batch-apply').disabled = !selected.size;
      $('#photo-batch-clear').disabled = !selected.size;
      $('#photo-batch-all').disabled = !visible.length;
      $('#photo-batch-all').textContent = visible.length && visible.every(photo => selected.has(photo.id)) ? 'Deselect shown' : 'Select all shown';
      $('#photo-batch-undo').disabled = !undo;
      const daySelect = $('#photo-batch-day'), previous = daySelect.value;
      const eventWord = root.JOURNEY_ATLAS_UTILS.eventWord(journey, 'title');
      daySelect.innerHTML = journey.days.map(day => `<option value="${escapeHtml(day.id)}">${eventWord} ${day.number} · ${escapeHtml(day.title)}</option>`).join('');
      daySelect.value = journey.days.some(day => day.id === previous) ? previous : journey.days[0]?.id || '';
      $('#photo-batch-day-label').hidden = $('#photo-batch-action').value !== 'assign';
      $('#studio-photo-grid').innerHTML = visible.length ? visible.map(photo => {
        const thumb = photo.srcset?.[0]?.src || photo.src, chosen = selected.has(photo.id);
        const day = journey.days.find(day => day.id === photo.dayId);
        return `<button type="button" data-photo-id="${escapeHtml(photo.id)}" class="${active ? chosen ? 'batch-selected' : '' : photo.id === selectedPhotoId ? 'active' : ''}" ${active ? `aria-pressed="${chosen}"` : ''} aria-label="${active ? 'Select' : 'Edit'} ${escapeHtml(label(photo))}, ${eventWord} ${day?.number}${photo.trashed ? ', in trash' : ''}">
          <img src="${escapeHtml(photoUrl(thumb))}" alt="" loading="lazy" />
          ${active ? `<b class="batch-check" aria-hidden="true">${chosen ? '✓' : ''}</b>` : ''}
          <span>${escapeHtml(active ? label(photo) : photo.takenAt || photo.caption || label(photo))}${active ? `<small>${eventWord} ${day?.number} · ${escapeHtml(photo.takenAt || day?.date || '')}${photo.trashed ? ' · In trash' : ''}</small>` : ''}</span>
          <i class="${Number.isFinite(photo.lat) && Number.isFinite(photo.lng) ? '' : 'unlocated'}" title="${Number.isFinite(photo.lat) && Number.isFinite(photo.lng) ? 'Located' : 'Needs location'}"></i></button>`;
      }).join('') : `<p class="editor-note">${$('#photo-search').value.trim() ? 'No matching photos. Try a different search or day.' : $('#show-photo-trash').checked ? 'No photos in trash for this selection.' : 'No photos here yet. Use Upload photos to add some.'}</p>`;
    }
    function setActive(value) {
      active = value;
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
      selected.clear(); undo = null; $('#photo-search').value = ''; $('#photo-batch-message').textContent = ''; setActive(false);
    }};
  }};
})(window);
