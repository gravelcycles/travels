(function (root) {
  'use strict';
  const belongsTo = (item, groupId) => !groupId || !item.groupIds?.length || item.groupIds.includes(groupId);
  function audience(journey, item) {
    if (!journey.routeGroups?.length) return '';
    return item.groupIds?.length ? item.groupIds.map(id => journey.routeGroups.find(group => group.id === id)?.label).filter(Boolean).join(' + ') : 'Everyone together';
  }
  // Derive a view; never mutate the itinerary saved by Studio or another filter.
  function projectJourney(source, groupId) {
    if (!source.routeGroups?.some(group => group.id === groupId)) return source;
    const segments = source.segments.filter(segment => belongsTo(segment, groupId));
    const ids = new Set(segments.map(segment => segment.id));
    const places = new Set(segments.flatMap(segment => [segment.from, segment.to]));
    const days = source.days.map(day => {
      const segmentIds = day.segmentIds.filter(id => ids.has(id));
      const destination = day.groupPlaces?.[groupId] || segments.find(segment => segment.id === segmentIds.at(-1))?.to;
      const scoped = { ...day, segmentIds, ...(destination ? { placeId: destination, destinationId: destination } : {}) };
      if (scoped.placeId) places.add(scoped.placeId);
      if (scoped.destinationId) places.add(scoped.destinationId);
      return scoped;
    });
    if (source.meetup) places.add(source.meetup.placeId);
    return { ...source, segments, days, places: source.places.filter(place => places.has(place.id)),
      photos: source.photos.filter(photo => belongsTo(photo, groupId)),
      videos: (source.videos || []).filter(video => belongsTo(video, groupId)),
      replayMoments: source.replayMoments?.map(moment => ({ ...moment, segmentIds: (moment.segmentIds || []).filter(id => ids.has(id)) })) };
  }
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[char]));
  const duration = seconds => `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`;
  function videoCards(journey, dayId) {
    const videos = (journey.videos || []).filter(video => video.dayId === dayId && !video.hidden);
    if (!videos.length) return '';
    return `<section class="day-videos" aria-label="Day videos"><h3>Videos · ${videos.length}</h3><div class="video-cards">${videos.map(video => `<button type="button" class="video-card" data-open-video="${escape(video.id)}" aria-label="Play ${escape(video.title)}"><span class="video-poster">${video.poster ? `<img src="${escape(video.poster)}" alt="" loading="lazy" />` : ''}<span class="video-play" aria-hidden="true">▶</span><span class="video-duration">${duration(video.durationSeconds)}</span></span><strong>${escape(video.title)}</strong><small>${escape(audience(journey, video) || 'Video')}${video.sample ? ' · Test clip' : ''}</small></button>`).join('')}</div></section>`;
  }
  function createVideoPlayer({ dialog, video, title, caption, status, retry, close, sourceLink }) {
    let current = null;
    function stop() {
      current = null;
      video.pause(); video.removeAttribute('src'); video.removeAttribute('poster');
      video.replaceChildren(); video.load();
      status.textContent = ''; retry.hidden = true;
    }
    function open(item) {
      stop(); current = item;
      title.textContent = item.title; caption.textContent = item.caption || '';
      sourceLink.hidden = !item.creditUrl;
      if (item.creditUrl) { sourceLink.href = item.creditUrl; sourceLink.textContent = item.credit || 'Video source'; }
      video.setAttribute('aria-label', item.title);
      if (item.poster) video.poster = item.poster;
      video.src = item.src;
      status.textContent = 'Ready to play';
      if (!dialog.open) dialog.showModal();
      // Playback requires an explicit press of the native play control.
    }
    video.addEventListener('error', () => { if (current) { status.textContent = 'This video could not load. Try again.'; retry.hidden = false; } });
    video.addEventListener('loadeddata', () => { if (current) { status.textContent = ''; retry.hidden = true; } });
    retry.addEventListener('click', () => { if (current) open(current); });
    close.addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', stop);
    return { open, stop };
  }
  root.JOURNEY_ATLAS_GROUPS = { belongsTo, audience, projectJourney, videoCards, createVideoPlayer };
})(typeof window !== 'undefined' ? window : globalThis);
