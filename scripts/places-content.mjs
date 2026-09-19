const id = value => typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
const text = (value, max = 2000) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const https = value => {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; }
};

// Points of interest are editorial annotations, not itinerary routing nodes.
export function validatePointsOfInterest(journey) {
  const fail = message => { throw new Error(`${journey.id}: pointsOfInterest ${message}`); };
  const points = journey.pointsOfInterest ?? [];
  if (!Array.isArray(points) || points.length > 200) fail('must be an array of at most 200 places');
  const ids = new Set();
  for (const point of points) {
    if (!point || !id(point.id) || ids.has(point.id)) fail('needs unique stable IDs');
    ids.add(point.id);
    if (!text(point.name, 120) || !text(point.summary) || !['food', 'sight'].includes(point.category)) fail(`${point.id} needs a name, summary and food/sight category`);
    if (!Array.isArray(point.coordinates) || point.coordinates.length !== 2 || !point.coordinates.every(Number.isFinite) || Math.abs(point.coordinates[0]) > 180 || Math.abs(point.coordinates[1]) > 90) fail(`${point.id} needs valid longitude/latitude`);
    if (!['approximate', 'verified'].includes(point.locationAccuracy)) fail(`${point.id} needs explicit location accuracy`);
    if (!['visited', 'saved'].includes(point.status)) fail(`${point.id} needs visited/saved status`);
    if (!Array.isArray(point.dayIds) || new Set(point.dayIds).size !== point.dayIds.length || point.dayIds.some(id => !journey.days.some(day => day.id === id))) fail(`${point.id} references an unknown or duplicate day`);
    for (const key of ['note', 'address']) if (point[key] != null && !text(point[key])) fail(`${point.id} has invalid ${key}`);
    if (point.sample != null && typeof point.sample !== 'boolean') fail(`${point.id} sample must be boolean`);
    if (point.mapsUrl != null && !https(point.mapsUrl)) fail(`${point.id} needs a safe maps link`);
    if (!Array.isArray(point.sources) || !point.sources.length || point.sources.some(source => !text(source.label, 120) || !https(source.url))) fail(`${point.id} needs labeled HTTPS sources`);
    if (!Array.isArray(point.images ?? []) || (point.images || []).length > 12) fail(`${point.id} has invalid images`);
    for (const picture of point.images || []) {
      if (!picture || !(https(picture.src) || /^\.\/assets\/(?:photos|places)\/[a-z0-9-]+\.(?:webp|jpg|png)$/.test(picture.src)) || !text(picture.alt, 300) || !text(picture.credit, 300) || !https(picture.sourceUrl) || !['owned', 'permission', 'licensed', 'illustration'].includes(picture.permission)) fail(`${point.id} image needs a safe source, alt, credit, source URL and permission basis`);
    }
    if (!Array.isArray(point.reviews ?? []) || (point.reviews || []).length > 50) fail(`${point.id} has invalid reviews`);
    const reviewers = new Set();
    for (const review of point.reviews || []) {
      if (!review || !id(review.authorId) || reviewers.has(review.authorId) || !text(review.authorName, 60) || !Number.isInteger(review.rating) || review.rating < 1 || review.rating > 5 || !text(review.text, 1000)) fail(`${point.id} review needs a unique author, rating 1–5 and text`);
      reviewers.add(review.authorId);
    }
    if (point.status === 'saved' && point.reviews?.length) fail(`${point.id} cannot review an unvisited place`);
  }
}
