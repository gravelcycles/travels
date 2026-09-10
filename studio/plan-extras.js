(function(root) {
  'use strict';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const publicUrl = value => { try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; } };
  function changes(draft) {
    const fields=['title','startDate','endDate','timeZone','places','segments','days','coverPhoto','replayMoments','subtitle','travelers','routeGroups','meetup','videos'];
    return {...Object.fromEntries(fields.filter(key=>draft[key]!==undefined).map(key=>[key,draft[key]])),photoGroups:Object.fromEntries(draft.photos.map(photo=>[photo.id,photo.groupIds || null]))};
  }
  function nextId(draft, kind, items) { let n = 1; while (items.some(item => item.id === `${draft.id}-${kind}${n}`)) n++; return `${draft.id}-${kind}${n}`; }
  function assignTraveler(draft, personId, groupId) {
    if (!(draft.travelers || []).some(person => person.id === personId)) throw new Error('Choose a traveler.');
    if (groupId && !(draft.routeGroups || []).some(group => group.id === groupId)) throw new Error('Choose a route group.');
    for (const group of draft.routeGroups || []) {
      group.travelerIds = group.travelerIds.filter(id => id !== personId);
      if (group.id === groupId) group.travelerIds.push(personId);
    }
  }
  function groupReferences(draft, groupId, photos = draft.photos || []) {
    return [
      [draft.routeGroups?.find(group => group.id === groupId)?.travelerIds.length || 0, 'travelers'],
      [draft.segments.filter(leg => leg.groupIds?.includes(groupId)).length, 'legs'],
      [photos.filter(photo => photo.groupIds?.includes(groupId)).length, 'photos'],
      [(draft.videos || []).filter(video => video.groupIds?.includes(groupId)).length, 'videos'],
      [draft.days.filter(day => day.groupPlaces?.[groupId]).length, 'overnight places']
    ].filter(([count]) => count).map(([count, label]) => `${count} ${label}`);
  }
  function removeGroup(draft, groupId, photos) {
    const references = groupReferences(draft, groupId, photos);
    if (references.length) throw new Error(`Reassign this group's ${references.join(', ')} before removing it.`);
    draft.routeGroups = (draft.routeGroups || []).filter(group => group.id !== groupId);
  }
  function setAudience(item, ids) { if (ids.length) item.groupIds = [...new Set(ids)]; else delete item.groupIds; }
  function audience(draft, item, kind, legend) {
    if (!draft.routeGroups?.length) return '';
    return `<fieldset class="plan-audience" data-audience-kind="${kind}" data-audience-id="${escape(item.id)}"><legend>${escape(legend)}</legend><small>No groups selected means everyone.</small>${draft.routeGroups.map(group => `<label class="checkbox"><input type="checkbox" data-audience-group="${escape(group.id)}" ${item.groupIds?.includes(group.id) ? 'checked' : ''}><span data-route-group-name="${escape(group.id)}">${escape(group.label)}</span></label>`).join('')}</fieldset>`;
  }
  function overnights(draft, day) {
    if (!draft.routeGroups?.length) return '';
    return `<div class="plan-overnights"><strong>Overnight places by group</strong><p>Leave blank to use the group's final leg or the day's destination.</p>${draft.routeGroups.map(group => `<label><span data-route-group-name="${escape(group.id)}">${escape(group.label)}</span><select data-group-overnight="${escape(group.id)}"><option value="">Use arrival / day destination</option>${draft.places.map(place => `<option value="${escape(place.id)}" ${day.groupPlaces?.[group.id] === place.id ? 'selected' : ''}>${escape(place.name)}</option>`).join('')}</select></label>`).join('')}</div>`;
  }
  function party(draft) {
    const groups = draft.routeGroups || [], people = draft.travelers || [];
    return `<p>${people.length} traveler${people.length === 1 ? '' : 's'} · ${groups.length} route group${groups.length === 1 ? '' : 's'}. Group membership stays the same throughout this trip; legs can split and rejoin.</p>
      <div class="plan-people">${people.map(person => `<div class="plan-person" data-person="${escape(person.id)}"><label>Traveler name<input data-person-name value="${escape(person.name)}" maxlength="120"></label><label>Route group<select data-person-group><option value="">${groups.length ? 'Choose a group' : 'Everyone together'}</option>${groups.map(group => `<option value="${escape(group.id)}" ${group.travelerIds.includes(person.id) ? 'selected' : ''}>${escape(group.label)}</option>`).join('')}</select></label><button type="button" data-remove-person aria-label="Remove traveler ${escape(person.name)}">Remove</button></div>`).join('') || '<p>No travelers added yet.</p>'}</div>
      <button type="button" data-add-person>+ Traveler</button>
      <h3>Route groups</h3><p>Name the different routes, then assign each traveler above. Each group needs at least one person.</p>
      ${groups.map(group => `<div class="plan-group" data-group="${escape(group.id)}"><label>Group name<input data-group-label value="${escape(group.label)}" maxlength="120"></label><small>${escape(group.travelerIds.map(id => people.find(person => person.id === id)?.name).filter(Boolean).join(' · ') || 'Assign travelers above')}</small><button type="button" data-remove-group>Remove group</button></div>`).join('')}
      <button type="button" data-add-group>+ Route group</button>`;
  }
  function meetup(draft) {
    const value = draft.meetup;
    return `<label class="checkbox"><input type="checkbox" data-meetup-enabled ${value ? 'checked' : ''}>Plan a shared meetup</label>${value ? `<div class="plan-row"><label>Meetup day<select data-meetup-field="dayId">${draft.days.map(day => `<option value="${escape(day.id)}" ${day.id === value.dayId ? 'selected' : ''}>Day ${day.number} · ${escape(day.calendarDate || day.date)}</option>`).join('')}</select></label><label>Meetup place<select data-meetup-field="placeId"><option value="">Choose a place</option>${draft.places.map(place => `<option value="${escape(place.id)}" ${place.id === value.placeId ? 'selected' : ''}>${escape(place.name)}</option>`).join('')}</select></label></div><label>Meetup description<input data-meetup-field="label" value="${escape(value.label)}" placeholder="Dinner together by the lake"></label><p>Every group's arrival or overnight place on this day must match the meetup.</p>` : '<p>Add a meetup when the different routes come back together.</p>'}`;
  }
  function videos(draft) {
    return (draft.videos || []).map((video, index, list) => `<section class="plan-video" data-video="${escape(video.id)}"><div class="plan-row"><h3>${escape(video.title || 'New video')}</h3><button type="button" data-preview-video>Preview video</button><button type="button" data-remove-video>Remove video</button></div>
      <label>Video title<input data-video-field="title" value="${escape(video.title)}" maxlength="200"></label>
      <label>Public video link<input type="url" data-video-field="src" value="${escape(video.src)}" placeholder="https://…/clip.mp4"></label>
      <div class="plan-row"><label>Day<select data-video-field="dayId">${draft.days.map(day => `<option value="${escape(day.id)}" ${day.id === video.dayId ? 'selected' : ''}>Day ${day.number} · ${escape(day.calendarDate || day.date)}</option>`).join('')}</select></label><label>Video format<select data-video-field="mimeType"><option value="video/mp4" ${video.mimeType === 'video/mp4' ? 'selected' : ''}>MP4</option><option value="video/webm" ${video.mimeType === 'video/webm' ? 'selected' : ''}>WebM</option></select></label><label>Duration in seconds<input type="number" min="0.01" step="any" data-video-field="durationSeconds" value="${video.durationSeconds ?? ''}" placeholder="Filled when preview plays"></label></div>
      <label>Opening-frame image link (optional)<input type="url" data-video-field="poster" value="${escape(video.poster)}" placeholder="https://…/opening-frame.webp"></label>
      <small>Without an image link, the viewer extracts an opening frame when the video host permits it.</small>
      <label>Caption / notes<textarea data-video-field="caption" rows="3">${escape(video.caption)}</textarea></label>
      ${audience(draft, video, 'video', 'Who is this video for?')}
      <details ${video.visibility !== 'public' ? 'open' : ''}><summary>Credit and publication</summary><label>Credit<input data-video-field="credit" value="${escape(video.credit)}"></label><label>Credit link<input type="url" data-video-field="creditUrl" value="${escape(video.creditUrl)}"></label><label class="checkbox"><input type="checkbox" data-video-field="visibility" ${video.visibility === 'public' ? 'checked' : ''}>This link is intended for public viewing</label><label class="checkbox"><input type="checkbox" data-video-field="hidden" ${video.hidden ? 'checked' : ''}>Hide from the atlas</label><label class="checkbox"><input type="checkbox" data-video-field="sample" ${video.sample ? 'checked' : ''}>Sample / test footage</label><label>Publication status<select data-video-field="assetStatus"><option value="published" ${video.assetStatus !== 'local' ? 'selected' : ''}>Include in the next published build</option><option value="local" ${video.assetStatus === 'local' ? 'selected' : ''}>Local preview only</option></select></label></details>
      <div class="plan-row"><button type="button" data-move-video="-1" ${index === 0 ? 'disabled' : ''}>Earlier video</button><button type="button" data-move-video="1" ${index === list.length - 1 ? 'disabled' : ''}>Later video</button></div></section>`).join('') || '<p>No videos yet. Add a public MP4 or WebM link to a journey day.</p>';
  }
  function create({container, getDraft, getPhotos, onPhotoGroups, onChange, onStatus, previewVideo}) {
    const render = () => {
      const draft = getDraft();
      container.querySelector('#plan-party').innerHTML = party(draft);
      container.querySelector('#plan-meetup').innerHTML = meetup(draft);
      container.querySelector('#plan-videos').innerHTML = videos(draft);
      container.querySelector('#plan-photo-groups').innerHTML = draft.routeGroups?.length ? getPhotos().map(photo => `<details><summary>${escape(draft.days.find(day => day.id === photo.dayId)?.date || '')} · ${escape(photo.caption || photo.id)}${photo.hidden || photo.trashed ? ' (hidden)' : ''}</summary>${audience(draft, photo, 'photo', 'Photo route groups')}</details>`).join('') || '<p>Add photos in the Photos editor, then assign their route groups here.</p>' : '<p>Add route groups to assign photos. Photos are shared with everyone by default.</p>';
    };
    container.addEventListener('input', event => {
      const target = event.target, draft = getDraft(); let handled = true, refresh = false;
      try {
        if (target.hasAttribute('data-person-name')) {
          const personId=target.closest('[data-person]').dataset.person;
          draft.travelers.find(person => person.id === personId).name = target.value;
          target.closest('[data-person]').querySelector('[data-remove-person]').setAttribute('aria-label', `Remove traveler ${target.value}`);
          for (const group of draft.routeGroups || []) {
            const card=[...container.querySelectorAll('[data-group]')].find(card=>card.dataset.group===group.id);
            if(card)card.querySelector('small').textContent=group.travelerIds.map(id=>draft.travelers.find(person=>person.id===id)?.name).filter(Boolean).join(' · ') || 'Assign travelers above';
          }
        }
        else if (target.hasAttribute('data-person-group')) { assignTraveler(draft, target.closest('[data-person]').dataset.person, target.value); refresh = true; }
        else if (target.hasAttribute('data-group-label')) {
          const groupId=target.closest('[data-group]').dataset.group;
          draft.routeGroups.find(group => group.id === groupId).label = target.value;
          container.querySelectorAll('[data-person-group] option').forEach(option=>{if(option.value===groupId)option.textContent=target.value;});
          container.querySelectorAll('[data-route-group-name]').forEach(label=>{if(label.dataset.routeGroupName===groupId)label.textContent=target.value;});
        }
        else if (target.hasAttribute('data-group-overnight')) {
          const day = draft.days.find(day => day.id === target.closest('[data-plan-day]').dataset.planDay);
          day.groupPlaces ||= {}; if (target.value) day.groupPlaces[target.dataset.groupOvernight] = target.value; else delete day.groupPlaces[target.dataset.groupOvernight];
          if (!Object.keys(day.groupPlaces).length) delete day.groupPlaces;
        } else if (target.hasAttribute('data-meetup-enabled')) { draft.meetup = target.checked ? {dayId:draft.days.at(-1).id,placeId:'',label:''} : null; refresh = true; }
        else if (target.dataset.meetupField) draft.meetup[target.dataset.meetupField] = target.value;
        else if (target.dataset.audienceGroup) {
          const fieldset = target.closest('[data-audience-kind]'), kind = fieldset.dataset.audienceKind, id = fieldset.dataset.audienceId;
          const ids = [...fieldset.querySelectorAll('input:checked')].map(input => input.dataset.audienceGroup);
          if (kind === 'photo') onPhotoGroups(id, ids.length ? ids : null);
          else setAudience((kind === 'video' ? draft.videos : draft.segments).find(item => item.id === id), ids);
        } else if (target.dataset.videoField) {
          const video = draft.videos.find(video => video.id === target.closest('[data-video]').dataset.video), field = target.dataset.videoField;
          if (field === 'visibility') video.visibility = target.checked ? 'public' : null;
          else if (['hidden','sample'].includes(field)) video[field] = target.checked;
          else if (field === 'durationSeconds') video[field] = target.value === '' ? null : Number(target.value);
          else if (!target.value && ['poster','credit','creditUrl'].includes(field)) delete video[field];
          else video[field] = target.value;
        } else handled = false;
        if (handled) { event.stopImmediatePropagation(); onChange(refresh); }
      } catch (error) { event.stopImmediatePropagation(); onStatus(error.message); }
    });
    container.addEventListener('click', event => {
      const button = event.target.closest('button'); if (!button) return;
      const draft = getDraft(); let handled = true;
      try {
        if (button.hasAttribute('data-add-person')) { draft.travelers ||= []; const person = {id:nextId(draft,'traveler',draft.travelers),name:''}; draft.travelers.push(person); if (draft.routeGroups?.length) draft.routeGroups[0].travelerIds.push(person.id); }
        else if (button.hasAttribute('data-remove-person')) { const id = button.closest('[data-person]').dataset.person; assignTraveler(draft,id,''); draft.travelers = draft.travelers.filter(person => person.id !== id); }
        else if (button.hasAttribute('data-add-group')) { draft.routeGroups ||= []; const first = !draft.routeGroups.length; draft.routeGroups.push({id:nextId(draft,'group',draft.routeGroups),label:'New route',travelerIds:first ? (draft.travelers || []).map(person => person.id) : []}); }
        else if (button.hasAttribute('data-remove-group')) removeGroup(draft,button.closest('[data-group]').dataset.group,getPhotos());
        else if (button.hasAttribute('data-add-video')) { draft.videos ||= []; draft.videos.push({id:nextId(draft,'video',[...draft.videos,...draft.photos]),dayId:draft.days[0].id,title:'',caption:'',src:'',mimeType:'video/mp4',durationSeconds:null,visibility:null}); }
        else if (button.hasAttribute('data-remove-video')) draft.videos = draft.videos.filter(video => video.id !== button.closest('[data-video]').dataset.video);
        else if (button.hasAttribute('data-move-video')) { const i = draft.videos.findIndex(video => video.id === button.closest('[data-video]').dataset.video), j = i + Number(button.dataset.moveVideo); if (j >= 0 && j < draft.videos.length) [draft.videos[i], draft.videos[j]] = [draft.videos[j], draft.videos[i]]; }
        else if (button.hasAttribute('data-preview-video')) { event.stopImmediatePropagation(); previewVideo(draft.videos.find(video => video.id === button.closest('[data-video]').dataset.video)); return; }
        else handled = false;
        if (handled) { event.stopImmediatePropagation(); onChange(true); }
      } catch (error) { event.stopImmediatePropagation(); onStatus(error.message); }
    });
    return {render};
  }
  root.JOURNEY_ATLAS_PLAN_EXTRAS = {publicUrl, changes, nextId, assignTraveler, groupReferences, removeGroup, setAudience, audience, overnights, party, meetup, videos, create};
})(typeof window !== 'undefined' ? window : globalThis);
