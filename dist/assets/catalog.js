(function () {
  "use strict";

  const data = window.JOURNEY_ATLAS_DATA;
  const catalog = document.querySelector("#journey-catalog");
  const realJourneys = data.journeys.filter((journey) => journey.kind === "real");

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function routeDistance(journey) {
    return journey.segments.reduce((total, segment) => total + (segment.distanceKm || 0), 0);
  }

  if (!realJourneys.length) {
    catalog.innerHTML = '<div class="catalog-empty">The next mapped journey will appear here.</div>';
    return;
  }

  catalog.innerHTML = realJourneys.map((journey) => {
    const photos = window.JOURNEY_ATLAS_UTILS.visiblePhotos(journey, window.JOURNEY_ATLAS_PHOTOS, window.JOURNEY_ATLAS_CONTENT_OVERRIDES);
    const {photo,position} = window.JOURNEY_ATLAS_UTILS.resolveCover(journey, photos);
    return `
    <a class="journey-card" href="./${escapeHtml(journey.slug)}">
      <div class="journey-card-media">
        ${photo ? `<img src="${escapeHtml(photo.srcset?.find(v=>v.width>=1280)?.src || photo.src)}" srcset="${escapeHtml((photo.srcset||[]).map(v=>`${v.src} ${v.width}w`).join(", "))}" sizes="(max-width: 700px) 100vw, 1180px" style="object-position:${position};${photo.blur?`background-image:url(${escapeHtml(photo.blur)})`:""}" alt="${escapeHtml(photo.alt || "")}" loading="eager" fetchpriority="high" />` : '<div class="journey-card-placeholder"><span>A JOURNEY TAKING SHAPE</span><strong>Places to go.<br>Days to make your own.</strong></div>'}
      </div>
      <div class="journey-card-copy">
        <small>${escapeHtml(journey.kicker)}</small>
        <h3>${escapeHtml(journey.title)}</h3>
        <p>${escapeHtml(journey.subtitle)}</p>
        <div class="journey-card-meta">
          <span>${escapeHtml(journey.dates)}</span>
          <span>${journey.days.length} days</span>
          <span>${journey.status === "planned" && !journey.segments.length ? "Route to plan" : `${Math.round(routeDistance(journey))} km`}</span>
        </div>
      </div>
    </a>
  `; }).join("");
})();
