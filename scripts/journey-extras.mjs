const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const safeUrl = value => {
  if (typeof value !== 'string') return false;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; }
};
export function validateJourneyExtras(journey) {
  const fail = message => { throw new Error(`${journey.id}: ${message}`); };
  const collection = name => {
    const items = journey[name] ?? [];
    if (!Array.isArray(items)) fail(`${name} must be an array`);
    const ids = new Set();
    for (const item of items) {
      if (!item || typeof item.id !== 'string' || !idPattern.test(item.id) || ids.has(item.id)) fail(`invalid or duplicate ${name} ID`);
      ids.add(item.id);
    }
    return items;
  };
  const travelers = collection('travelers'), groups = collection('routeGroups'), videos = collection('videos');
  const travelerIds = new Set(travelers.map(person => person.id)), groupIds = new Set(groups.map(group => group.id));
  const uniqueReferences = (values, ids) => Array.isArray(values) && values.length && new Set(values).size === values.length && values.every(id => ids.has(id));
  for (const person of travelers) if (typeof person.name !== 'string' || !person.name.trim()) fail('traveler needs a name');
  const assigned = new Set();
  for (const group of groups) {
    if (typeof group.label !== 'string' || !group.label.trim() || !uniqueReferences(group.travelerIds, travelerIds)) fail('route group needs a label and valid travelers');
    for (const id of group.travelerIds) { if (assigned.has(id)) fail('a traveler must belong to only one route group'); assigned.add(id); }
  }
  if (groups.length && assigned.size !== travelers.length) fail('each traveler must belong to a route group');
  for (const item of [...journey.segments, ...journey.photos, ...videos]) {
    if (item.groupIds != null && !uniqueReferences(item.groupIds, groupIds)) fail(`${item.id}: groupIds must reference unique route groups; omit for everyone`);
  }
  for (const day of journey.days) {
    if (day.groupPlaces != null) {
      if (typeof day.groupPlaces !== 'object' || Array.isArray(day.groupPlaces) || Object.entries(day.groupPlaces).some(([groupId, placeId]) => !groupIds.has(groupId) || !journey.places.some(place => place.id === placeId))) fail(`${day.id}: invalid group overnight place`);
    }
    for (const group of groups) {
      const legs = day.segmentIds.map(id => journey.segments.find(segment => segment.id === id)).filter(segment => segment && (!segment.groupIds || segment.groupIds.includes(group.id)));
      if (legs.some((leg, index) => index && legs[index - 1].to !== leg.from)) fail(`${day.id}: ${group.label} legs must form an ordered route`);
      if (day.groupPlaces?.[group.id] && legs.length && legs.at(-1).to !== day.groupPlaces[group.id]) fail(`${day.id}: group overnight place must match its arrival`);
    }
  }
  if (journey.meetup != null) {
    const meetup = journey.meetup, day = journey.days.find(day => day.id === meetup.dayId);
    if (!day || !journey.places.some(place => place.id === meetup.placeId) || typeof meetup.label !== 'string' || !meetup.label.trim()) fail('meetup needs a valid day, place and label');
    // A named meetup is a content promise: every group's arrival must agree.
    for (const group of groups) {
      const legs = day.segmentIds.map(id => journey.segments.find(segment => segment.id === id)).filter(segment => segment && (!segment.groupIds || segment.groupIds.includes(group.id)));
      if ((legs.at(-1)?.to || day.groupPlaces?.[group.id] || day.placeId) !== meetup.placeId) fail(`${group.label} does not end at the meetup`);
    }
  }
  for (const video of videos) {
    if (!journey.days.some(day => day.id === video.dayId)) fail(`${video.id}: video references an unknown day`);
    if (typeof video.title !== 'string' || !video.title.trim() || typeof video.caption !== 'string') fail(`${video.id}: video needs title and caption text`);
    if (!safeUrl(video.src) || !['video/mp4', 'video/webm'].includes(video.mimeType)) fail(`${video.id}: video needs an HTTPS MP4 or WebM source`);
    if (video.visibility !== 'public') fail(`${video.id}: only explicitly public videos are supported; keep private originals out of journey sources`);
    if (video.poster != null && !safeUrl(video.poster)) fail(`${video.id}: invalid video poster URL`);
    if (video.creditUrl != null && !safeUrl(video.creditUrl)) fail(`${video.id}: invalid video credit URL`);
    if (!Number.isFinite(video.durationSeconds) || video.durationSeconds <= 0) fail(`${video.id}: video duration must be positive`);
    for (const key of ['hidden', 'sample']) if (video[key] != null && typeof video[key] !== 'boolean') fail(`${video.id}: ${key} must be boolean`);
    if (video.assetStatus != null && !['local', 'published'].includes(video.assetStatus)) fail(`${video.id}: invalid video asset status`);
  }
}
