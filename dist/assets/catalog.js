(function () {
  "use strict";

  // A previously cached HTML page can still reference the legacy data scripts
  // while this updated runtime reaches it during deployment.
  const data = window.JOURNEY_ATLAS_CATALOG || { journeys: (window.JOURNEY_ATLAS_DATA?.journeys || []).map(journey => {
    const utils = window.JOURNEY_ATLAS_UTILS;
    const photos = utils.visiblePhotos(journey, window.JOURNEY_ATLAS_PHOTOS, window.JOURNEY_ATLAS_CONTENT_OVERRIDES);
    return { ...journey, eventCount: journey.days.length, eventLabel: utils.eventWord(journey, 'plural'),
      distanceLabel: utils.journeyPresentation(journey, photos).distanceLabel, cover: utils.resolveCover(journey, photos) };
  }) };
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

  if (!realJourneys.length) {
    catalog.innerHTML = '<div class="catalog-empty">The next mapped journey will appear here.</div>';
    return;
  }

  catalog.innerHTML = realJourneys.map((journey, index) => {
    const {photo,position} = journey.cover;
    return `
    <a class="journey-card" href="./${escapeHtml(journey.slug)}">
      <div class="journey-card-media" style="--cover-position:${escapeHtml(position)}">
        ${photo ? '' : '<div class="journey-card-placeholder"><span>A JOURNEY TAKING SHAPE</span><strong>Places to go.<br>Memories to make your own.</strong></div>'}
      </div>
      <div class="journey-card-copy">
        <small>${escapeHtml(journey.kicker)}</small>
        <h2>${escapeHtml(journey.title)}</h2>
        <p>${escapeHtml(journey.subtitle)}</p>
        <div class="journey-card-meta">
          <span>${escapeHtml(journey.dates)}</span>
          <span>${journey.eventCount} ${escapeHtml(journey.eventLabel)}</span>
          <span>${escapeHtml(journey.distanceLabel)}</span>
        </div>
      </div>
    </a>
  `; }).join("");
  const cards = [...catalog.querySelectorAll('.journey-card-media')];
  const selectedSources = new Map();
  function renderCovers() {
    // Read every crop box before inserting images so layout is resolved once.
    const boxes = cards.map(card => card.getBoundingClientRect());
    cards.forEach((card, index) => {
      const photo = realJourneys[index].cover.photo;
      if (!photo) return;
      const box = boxes[index], ratio = photo.width > 0 && photo.height > 0 ? photo.width / photo.height : 1;
      const targetWidth = Math.ceil(Math.max(box.width, box.height * ratio) * (window.devicePixelRatio || 1));
      const variants = [...(photo.srcset || [])].sort((a, b) => a.width - b.width);
      const variant = variants.find(item => item.width >= targetWidth) || variants.at(-1);
      const src = variant?.src || photo.src;
      if (selectedSources.get(card) === src) return;
      selectedSources.set(card, src);
      card.innerHTML = window.JOURNEY_ATLAS_AUTH?.isProtected(photo)
        ? window.JOURNEY_ATLAS_AUTH.markup(photo, { eager: index < 5, targetWidth: targetWidth || 480 })
        : `<img src="${escapeHtml(src)}" alt="${escapeHtml(photo.alt || '')}" loading="${index < 5 ? 'eager' : 'lazy'}" decoding="async" />`;
      window.JOURNEY_ATLAS_AUTH?.prepare(card);
      window.JOURNEY_ATLAS_UTILS.prepareImageReveals(card);
    });
  }
  renderCovers();
  if (window.ResizeObserver) {
    const observer = new ResizeObserver(renderCovers);
    cards.forEach(card => observer.observe(card));
  } else window.addEventListener('resize', renderCovers);
  window.JOURNEY_ATLAS_UTILS.prepareImageReveals(catalog);
})();
