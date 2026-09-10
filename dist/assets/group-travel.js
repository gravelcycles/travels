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
  function dayGroups(journey, day) {
    const groups = journey.routeGroups || [];
    return groups.map(group => {
      const segments = day.segmentIds.map(id => journey.segments.find(segment => segment.id === id)).filter(segment => segment && belongsTo(segment, group.id));
      const from = journey.places.find(place => place.id === segments[0]?.from);
      const to = journey.places.find(place => place.id === (day.groupPlaces?.[group.id] || segments.at(-1)?.to || day.destinationId || day.placeId));
      return { ...group, travelers: (journey.travelers || []).filter(person => group.travelerIds.includes(person.id)), segments, from, to };
    });
  }
  function dayDetails(journey, day, selected = '') {
    const groups = dayGroups(journey, day);
    if (!groups.length) return '';
    const modes = {train:'Train', boat:'Ferry', car:'Car', bus:'Bus', walk:'Walk', bike:'Bike', gondola:'Gondola'};
    const meetup = journey.meetup?.dayId === day.id ? journey.meetup : null;
    const place = journey.places.find(place => place.id === meetup?.placeId);
    return `<section class="day-route-groups" aria-label="Who took each route"><h3>Who went which way</h3>
      ${meetup ? `<p class="day-meetup"><strong>Everyone meets in ${escape(place.name)}</strong><span>${escape(meetup.label)}</span></p>` : ''}
      <div class="day-group-list">${groups.map(group => `<article class="day-group${selected === group.id ? ' is-selected' : ''}">
        <h4>${escape(group.label)} <span>${group.travelers.length} traveler${group.travelers.length === 1 ? '' : 's'}</span></h4>
        <p class="day-group-people">${group.travelers.map(person => escape(person.name)).join(' · ')}</p>
        <p class="day-group-route">${group.from ? `${escape(group.from.name)} → ` : ''}${escape(group.to?.name || 'Destination to plan')}</p>
        <p class="day-group-meta">${group.segments.length ? [...new Set(group.segments.map(segment => modes[segment.mode] || segment.mode))].join(' + ') + ` · ${group.segments.length} leg${group.segments.length === 1 ? '' : 's'}` : group.to ? 'No travel legs · staying here' : 'No travel legs planned'}${group.to ? ` · Overnight: ${escape(group.to.name)}` : ''}</p>
        <button type="button" data-route-group="${escape(group.id)}" data-day-route-group="true" aria-pressed="${selected === group.id}">${selected === group.id ? 'Showing this route' : 'Show this route'}</button>
      </article>`).join('')}</div></section>`;
  }
  root.JOURNEY_ATLAS_GROUPS = { belongsTo, audience, projectJourney, dayGroups, dayDetails };
})(typeof window !== 'undefined' ? window : globalThis);
