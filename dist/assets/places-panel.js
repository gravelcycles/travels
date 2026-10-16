(function (root) {
  'use strict';
  const tabs = ['overview', 'photos'];
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim();
  function searchPlaces(points, { category = 'all', dayId = '', query = '' } = {}) {
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    return points.filter(point => (category === 'all' || point.category === category) && (!dayId || point.dayIds.includes(dayId)) && terms.every(term => normalize([point.name, point.summary, point.address, point.note].filter(Boolean).join(' ')).includes(term)));
  }
  function nearbyPlaces(points, ids) {
    if (!ids) return points;
    const included = new Set(ids); return points.filter(point => included.has(point.id));
  }
  function placesInView(points, dayIds) {
    if (!Array.isArray(dayIds)) return points;
    const visible = new Set(dayIds);
    return points.filter(point => !point.dayIds.length || point.dayIds.some(id => visible.has(id)));
  }
  // Cluster by rendered distance, never by invented geographic precision. The
  // selected point anchors its cluster exactly; coincident neighbors remain selectable.
  function clusterPoints(points, project, selectedId = '', distance = 54) {
    const groups = [];
    for (const point of [...points].sort((a, b) => Number(b.id === selectedId) - Number(a.id === selectedId))) {
      const position = project(point.coordinates);
      if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) continue;
      const group = groups.find(group => Math.hypot(group.x - position.x, group.y - position.y) < distance);
      if (group) { group.points.push(point); continue; }
      groups.push({ points: [point], x: position.x, y: position.y, selected: point.id === selectedId });
    }
    return groups;
  }
  function mapInsets(frame, { sheet = null, toolbar = null, mobile = false } = {}) {
    const width = Math.max(1, frame.width ?? frame.right - frame.left), height = Math.max(1, frame.height ?? frame.bottom - frame.top);
    const overlaps = rect => rect && rect.right > frame.left && rect.left < frame.right && rect.bottom > frame.top && rect.top < frame.bottom;
    const sideSheet = mobile && overlaps(sheet) && sheet.left > frame.left + width * .2 && sheet.top < frame.top + height * .25;
    let top = 64, bottom = mobile && !sideSheet && overlaps(sheet) ? Math.max(40, frame.bottom - sheet.top + 36) : 68;
    if (overlaps(toolbar)) {
      if ((toolbar.top + toolbar.bottom) / 2 < frame.top + height / 2) top = Math.max(top, toolbar.bottom - frame.top + 36);
      else bottom = Math.max(bottom, frame.bottom - toolbar.top + 36);
    }
    // Small phones and an animating sheet still need a valid camera area. Keep
    // controls clear and let nearby places cluster in the remaining map space.
    const available = Math.max(0, height - Math.min(12, height / 2));
    top = Math.min(top, available / 2);
    bottom = Math.min(bottom, available - top);
    const side = Math.min(mobile ? 36 : 64, Math.max(0, (width - Math.min(80, width / 2)) / 2));
    return { top, bottom, left: side, right: sideSheet ? Math.min(width - side - 80, frame.right - sheet.left + 24) : side };
  }
  function create(options) {
    const { escape, average, ratingSummary } = root.JOURNEY_ATLAS_PLACES;
    const panel = document.getElementById('places-panel');
    if (!panel) return { open() {}, close() {}, update() {}, mapReady() {}, isOpen: () => false };
    const reviewDialog = document.getElementById('place-reviews-dialog');
    let reviewReturn = null;
    const preview = Boolean(options.preview);
    const assetScript = document.querySelector('script[src*="/places-panel.js"]');
    const assetBase = new URL('.', assetScript?.src || location.href);
    const mobile = () => matchMedia('(max-width:900px)').matches;
    const duration = value => matchMedia('(prefers-reduced-motion:reduce)').matches ? 0 : value;
    const $ = selector => (reviewDialog.open ? reviewDialog.querySelector(selector) : null) || panel.querySelector(selector) || reviewDialog.querySelector(selector);
    const eventWord = form => root.JOURNEY_ATLAS_UTILS.eventWord(options.journey(), form);
    const points = () => placesInView(options.journey()?.pointsOfInterest || [], options.visibleDayIds?.());
    const resolvedDay = id => options.resolvedDay?.(id) || options.journey()?.days.find(day => day.id === id);
    const store = () => options.store();
    let journeyId = '', selectedId = '', category = 'all', query = '', dayOnly = false, scopeChoice = null, tab = 'overview', expanded = false, visible = false;
    let listScroll = 0, nearbyIds = null, nearbyScroll = 0, selectedTabScroll = {}, lastDay = '', markers = [], markerMap = null, markerFrame = 0, returnFocus = null;
    let galleryIndex = -1, galleryReturn = null, restoring = false, undo = null, toastTimer, lastHistory = '', clusterPopup = null, historyDepth = 0, savedCamera = null;
    let panelVersion = 0, cameraVersion = 0, detailSignature = '', historyEntry = 0, nextHistoryEntry = 0;
    const scrollEntries = new Map();
    const memoryDrafts = new Map();
    const icon = name => {
      const paths = {
        pin: '<path d="M18 10c0 5-6 10-6 10S6 15 6 10a6 6 0 1 1 12 0Z"/><circle cx="12" cy="10" r="2"/>',
        food: '<path d="M7 3v7m-3-7v5a3 3 0 0 0 6 0V3M7 11v10M17 3v18m0-18c-4 3-4 9 0 9"/>',
        sight: '<path d="m3 11 9-7 9 7M5 10v11h14V10M9 21v-7h6v7M3 21h18"/>',
        photos: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="8" cy="9" r="1.5"/><path d="m3 17 5-5 4 4 3-3 6 5"/>',
        review: '<path d="m4 16 12-12 4 4L8 20H4v-4Z"/><path d="m13 7 4 4"/>',
        link: '<path d="M14 4h6v6M20 4 10 14M10 4H4v16h16v-6"/>',
        day: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18"/>',
        back: '<path d="m14 6-6 6 6 6"/>',
        next: '<path d="m10 6 6 6-6 6"/>',
        close: '<path d="m6 6 12 12M18 6 6 18"/>',
        search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
        check: '<path d="m5 12 4 4L19 6"/>',
        globe: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
        fit: '<path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6"/><circle cx="12" cy="12" r="3"/>'
      };
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.pin}</svg>`;
    };
    const imageUrl = picture => picture.src.startsWith('./assets/') ? new URL(picture.src.slice(9), assetBase).href : picture.src;
    const ratingStars = rating => `<span class="pp-stars" role="img" aria-label="${rating} out of 5 stars"><span aria-hidden="true">★★★★★</span><span aria-hidden="true" style="width:${Math.max(0, Math.min(5, Number(rating))) * 20}%">★★★★★</span></span>`;
    const filtered = () => searchPlaces(points(), { category, query, dayId: dayOnly ? options.dayId() : '' });
    const current = () => points().find(point => point.id === selectedId);
    const ownReview = point => preview ? store().reviews(point.id)[0] : null;
    const reviewsFor = point => [...(point.reviews || []), ...(preview ? store().reviews(point.id) : [])];
    const draftKey = point => `place-review:${point.id}`;
    function readDraft(point) {
      const key = `${journeyId}:${point.id}`;
      if (memoryDrafts.has(key)) return memoryDrafts.get(key);
      try { return store().draft(draftKey(point)); } catch { return null; }
    }
    function clearDraft(point) {
      memoryDrafts.delete(`${journeyId}:${point.id}`);
      try { store().draft(draftKey(point), null); } catch { /* A saved review stays saved even if draft cleanup fails. */ }
    }
    panel.classList.add('pp-panel');
    panel.innerHTML = `<button id="places-sheet-toggle" class="pp-sheet-handle" type="button" aria-label="Expand places" aria-expanded="false" aria-controls="places-content"><span></span><span id="places-sheet-label">Show list</span></button><header class="pp-heading"><div><span class="pp-eyebrow">ALONG THE WAY</span><h2 id="places-title">Places we found</h2></div><button id="close-places" class="pp-icon-button" type="button" aria-label="Close places">${icon('close')}</button></header><div class="pp-browse-controls"><div class="pp-search-row"><label class="pp-search">${icon('search')}<span class="pp-sr-only">Search places</span><input id="places-search" type="search" placeholder="Find a place" autocomplete="off"/><button type="button" data-clear-search aria-label="Clear search" hidden>${icon('close')}</button></label><button id="places-filter-toggle" class="pp-filter-toggle" type="button" aria-expanded="false" aria-controls="places-filters">Filters</button></div><div id="places-filters" class="pp-filters" role="group" aria-label="Filter places"><button data-place-filter="all" aria-pressed="true">All types</button><button data-place-filter="food" aria-pressed="false">${icon('food')}Food & drink</button><button data-place-filter="sight" aria-pressed="false">${icon('sight')}Sights</button></div><div class="pp-scope" role="group" aria-label="Places scope"><button type="button" data-place-scope="day" aria-pressed="false"><span id="places-event-only-label">This ${eventWord()}</span><span id="places-day-count"></span></button><button type="button" data-place-scope="all" aria-pressed="true">All places<span id="places-all-count"></span></button></div><div class="pp-options"><button id="places-fit" type="button">${icon('fit')}Show results on map</button></div></div><div class="pp-detail-nav" hidden><button id="places-back-to-list" class="pp-back" aria-label="Back to all places">${icon('back')}<span>Places</span></button><span class="pp-detail-nav-name"></span><button id="close-place-details" class="pp-icon-button" type="button" aria-label="Close place details">${icon('close')}</button></div><div id="places-content" class="pp-content"></div><div class="pp-toast" role="status" aria-live="polite" hidden><span></span><button data-undo-review hidden>Undo</button><button data-dismiss-toast class="pp-icon-button" aria-label="Dismiss message">${icon('close')}</button></div><p id="places-message" class="pp-sr-only" role="status" aria-live="polite"></p>`;
    const content = $('#places-content');
    const gallery = document.createElement('dialog');
    gallery.className = 'pp-gallery-dialog'; gallery.setAttribute('aria-label', 'Place photos');
    gallery.innerHTML = `<header><div><strong class="pp-gallery-name"></strong><span class="pp-gallery-count" aria-live="polite"></span></div><button class="pp-icon-button" data-gallery-close aria-label="Close place photos">${icon('close')}</button></header><div class="pp-gallery-stage"><button class="pp-gallery-arrow" data-gallery-prev aria-label="Previous place photo">${icon('back')}</button><figure></figure><button class="pp-gallery-arrow" data-gallery-next aria-label="Next place photo">${icon('next')}</button></div><footer></footer>`;
    document.body.append(gallery);
    reviewDialog.innerHTML = `<header class="conversation-heading"><div><h2 id="place-reviews-title">Place reviews</h2><p id="place-reviews-name"></p></div><button class="pp-icon-button" data-close-reviews aria-label="Close place reviews">${icon('close')}</button></header><div class="pp-reviews-content"></div>`;
    function renderReviews() {
      if (!current()) return;
      reviewDialog.querySelector('#place-reviews-name').textContent = current().name;
      const body = reviewDialog.querySelector('.pp-reviews-content'), scroll = body.scrollTop;
      body.innerHTML = reviewHtml(current()); bindReviewForm(); body.scrollTop = scroll;
    }
    function openReviews(historyWrite = true) {
      if (!current() || (!reviewsFor(current()).length && !(preview && current().status === 'visited'))) return;
      const wasOpen = reviewDialog.open;
      if (!wasOpen) reviewReturn = document.activeElement;
      if (!wasOpen) reviewDialog.showModal();
      renderReviews();
      const toast = panel.querySelector('.pp-toast'); if (toast) reviewDialog.append(toast);
      if (!wasOpen) reviewDialog.querySelector('[data-close-reviews]').focus({preventScroll:true});
      if (historyWrite) rememberHistory(!wasOpen);
    }
    function closeReviews(historyWrite = true, focus = true) {
      if (reviewDialog.open) reviewDialog.close();
      const toast = reviewDialog.querySelector('.pp-toast'); if (toast) panel.append(toast);
      if (focus) (reviewReturn?.isConnected ? reviewReturn : $('[data-show-place-tab="reviews"]'))?.focus({preventScroll:true});
      if (historyWrite) rememberHistory();
    }
    function requestReviewsClose() {
      if (history.state?.atlasPlaces?.reviews && historyDepth > 1) history.back(); else closeReviews();
    }
    reviewDialog.addEventListener('cancel', event => { event.preventDefault(); requestReviewsClose(); });
    reviewDialog.addEventListener('click', event => {
      if (event.target.closest('[data-close-reviews]')) { requestReviewsClose(); return; }
      if (event.target === reviewDialog) {
        const r = reviewDialog.getBoundingClientRect();
        if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) requestReviewsClose();
      }
    });
    function announce(message) { $('#places-message').textContent = message; }
    function showToast(message, restore = null) {
      clearTimeout(toastTimer); undo = restore;
      const toast = $('.pp-toast'); toast.hidden = false; toast.querySelector('span').textContent = message;
      toast.querySelector('[data-undo-review]').hidden = !restore;
      // Undo never expires while its control has focus.
      toastTimer = setTimeout(() => { if (!toast.contains(document.activeElement)) toast.hidden = true; }, restore ? 12000 : 6000);
    }
    function wireImages(container) {
      container.querySelectorAll('img').forEach(img => {
        const loaded = () => { img.closest('.pp-media')?.classList.remove('is-loading', 'is-unavailable'); };
        const failed = () => { const media = img.closest('.pp-media'); if (media) { media.classList.remove('is-loading'); media.classList.add('is-unavailable'); } };
        img.addEventListener('load', loaded); img.addEventListener('error', failed);
        if (img.complete) img.naturalWidth ? loaded() : failed();
      });
    }
    function pictureHtml(picture, { hero = false, index = 0, thumbnail = false } = {}) {
      const label = picture.permission === 'illustration' ? 'Illustration' : '';
      return `<span class="pp-media is-loading${hero ? ' pp-hero-media' : ''}${thumbnail ? ' pp-thumbnail' : ''}"><img src="${escape(imageUrl(picture))}" alt="${thumbnail ? '' : escape(picture.alt)}" ${hero ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"/><span class="pp-media-fallback">${icon('photos')}<span>Photo unavailable</span></span>${label ? `<span class="pp-media-label">${label}</span>` : ''}${hero ? `<span class="pp-photo-count">${icon('photos')}${current().images.length} ${current().images.length === 1 ? 'photo' : 'photos'}</span>` : ''}</span>`;
    }
    function renderScope() {
      const day = resolvedDay(options.dayId()), local = searchPlaces(points(), { dayId: day?.id || '__none__' });
      $('#places-title').textContent = points().length && points().every(point => point.status === 'saved') ? 'Saved places' : 'Places';
      $('#places-event-only-label').textContent = day?.title || `This ${eventWord()}`;
      $('#places-day-count').textContent = String(local.length);
      $('#places-all-count').textContent = String(points().length);
      for (const button of panel.querySelectorAll('[data-place-scope]')) {
        button.setAttribute('aria-pressed', String(button.dataset.placeScope === (dayOnly ? 'day' : 'all')));
        if (button.dataset.placeScope === 'day') button.disabled = !day;
      }
      const back = $('#places-back-to-list');
      back.querySelector('span').textContent = dayOnly && day?.title ? day.title : 'Places';
      back.setAttribute('aria-label', `Back to ${dayOnly && day?.title ? `${day.title} places` : 'all places'}`);
    }
    function setScope(scope) {
      scopeChoice = scope === 'day' ? 'day' : 'all'; dayOnly = scopeChoice === 'day';
      nearbyIds = null; selectedId = ''; listScroll = 0;
      renderList(); renderMarkers(); fitPlaces(); rememberHistory();
    }
    function renderList() {
      detailSignature = '';
      clearTripImages();
      const results = nearbyPlaces(filtered(), nearbyIds), hasFilters = category !== 'all' || dayOnly || Boolean(query.trim());
      const saved = nearbyIds ? nearbyScroll : listScroll;
      renderScope();
      panel.classList.remove('pp-selected'); panel.setAttribute('aria-labelledby', 'places-title');
      $('.pp-heading').hidden = false; $('.pp-browse-controls').hidden = false; $('.pp-detail-nav').hidden = true;
      $('#places-fit').disabled = !results.length;
      $('#places-filter-toggle').textContent = category === 'all' ? 'Filters' : 'Filters · 1';
      $('[data-clear-search]').hidden = !query;
      for (const button of panel.querySelectorAll('[data-place-filter]')) button.setAttribute('aria-pressed', String(button.dataset.placeFilter === category));
      content.innerHTML = results.length ? `<div class="pp-list-meta${nearbyIds ? ' pp-nearby-meta' : ''}"><span id="places-count">${results.length} ${results.length === 1 ? 'place' : 'places'}${nearbyIds ? ' nearby' : hasFilters ? ` of ${points().length}` : ''}</span>${nearbyIds ? '<button class="pp-text-button" type="button" data-clear-nearby>Show all results</button>' : `<span>${points().some(point => point.sample) ? 'Sample places' : points().every(point => point.status === 'saved') ? 'Saved for the journey' : ''}</span>`}</div><div class="pp-cards">${results.map(point => {
        const reviews = reviewsFor(point), score = average(reviews), picture = point.images?.[0];
        return `<button class="pp-card" data-place-id="${escape(point.id)}" type="button"><span class="pp-card-copy"><span class="pp-card-kind">${point.category === 'food' ? 'Food & drink' : 'Sight'}${point.status === 'saved' ? '<span class="pp-saved">Saved for later</span>' : ''}</span><strong>${escape(point.name)}</strong>${score ? `<span class="pp-card-rating"><b>${score}</b>${ratingStars(score)}<span>${reviews.length} group ${reviews.length === 1 ? 'review' : 'reviews'}</span></span>` : ''}<span class="pp-card-summary">${escape(point.summary)}</span></span>${picture ? pictureHtml(picture, { thumbnail: true }) : `<span class="pp-no-thumbnail">${icon(point.category)}</span>`}</button>`;
      }).join('')}</div>` : `<div class="pp-empty">${icon(points().length ? 'search' : 'pin')}<h3>${points().length ? 'No places found' : 'Good places stay with us.'}</h3><p>${points().length ? `${query.trim() ? `No matches for “${escape(query.trim())}”. ` : ''}${dayOnly ? `Try another ${eventWord()}, or explore the whole journey.` : 'Try a different search or filter.'}` : 'The memorable meals, little discoveries and places worth coming back to will live here.'}</p>${points().length ? '<button class="pp-primary" data-clear-filters>See all places</button>' : '<button class="pp-secondary" data-return-journey>Back to the journey</button>'}</div>`;
      wireImages(content); content.scrollTop = saved;
      announce(`${results.length} ${results.length === 1 ? 'place' : 'places'}${nearbyIds ? ' nearby' : hasFilters ? ' matching your filters' : ''}.`);
    }
    function reviewHtml(point) {
      const reviews = reviewsFor(point), summary = ratingSummary(reviews), own = ownReview(point), draft = readDraft(point);
      return `<section class="pp-reviews"><div class="pp-section-heading"><h4>Our group’s reviews</h4>${preview && point.status === 'visited' ? `<button class="pp-text-button" data-edit-review>${icon('review')}${own ? 'Edit your review' : 'Write a review'}</button>` : ''}</div><p class="pp-section-note">${point.sample ? 'Sample reviews from fictional travelers.' : 'Personal impressions from the people on this trip.'}</p>${reviews.length ? `<div class="pp-rating-summary"><div class="pp-score"><strong>${summary.average}</strong>${ratingStars(summary.average)}<span>${summary.count} ${summary.count === 1 ? 'review' : 'reviews'}</span></div><div class="pp-rating-bars" aria-label="Rating distribution">${summary.distribution.map(row => `<div aria-label="${row.count} ${row.stars}-star ${row.count === 1 ? 'review' : 'reviews'}"><span>${row.stars}</span><span class="pp-rating-track"><i style="width:${row.count / summary.count * 100}%"></i></span></div>`).join('')}</div></div>` : ''}${preview && point.status === 'visited' ? reviewFormHtml(point, own, draft) : ''}${!reviews.length ? `<div class="pp-quiet-empty">${icon(point.status === 'saved' ? 'pin' : 'review')}<h5>${point.status === 'saved' ? 'One for next time.' : 'What stayed with you?'}</h5><p>${point.status === 'saved' ? 'We’ll collect our impressions after a visit.' : 'A favorite dish, a little detail, a reason to return.'}</p></div>` : ''}<div class="pp-review-list">${reviews.slice().sort((a, b) => Number(b.authorId === 'demo-you') - Number(a.authorId === 'demo-you')).map(review => `<article class="pp-review${review.authorId === 'demo-you' ? ' pp-own-review' : ''}" tabindex="-1"><span class="pp-avatar" aria-hidden="true">${escape(review.authorName.slice(0, 1).toUpperCase())}</span><div><header><strong>${escape(review.authorName)}${review.authorId === 'demo-you' ? '<span>You</span>' : ''}</strong>${review.authorId === 'demo-you' ? '<button data-edit-review class="pp-text-button" aria-label="Edit your review">Edit</button>' : ''}</header>${ratingStars(review.rating)}${review.text ? `<p>${escape(review.text)}</p>` : ''}${review.authorId === 'demo-you' ? '<small>Saved in this browser</small><button class="pp-delete" data-delete-review>Delete your review</button>' : ''}</div></article>`).join('')}</div></section>`;
    }
    function reviewFormHtml(point, own, savedDraft) {
      const draft = savedDraft || { name: own?.authorName || '', rating: own?.rating || 0, body: own?.text || '' };
      return `<form id="place-review-form" class="pp-review-form"${savedDraft ? '' : ' hidden'}><h5>${own ? 'Your review' : 'How was it?'}</h5><fieldset><legend class="pp-sr-only">Your rating</legend><div class="pp-rating-input">${[1, 2, 3, 4, 5].map(n => `<label><input type="radio" name="rating" value="${n}" required aria-label="${n} ${n === 1 ? 'star' : 'stars'}" ${Number(draft.rating) === n ? 'checked' : ''}/><span aria-hidden="true">★</span></label>`).join('')}</div><span class="pp-rating-word">${['Choose a rating', 'Not for us', 'Could be better', 'Good', 'Really good', 'Loved it'][Number(draft.rating)] || 'Choose a rating'}</span></fieldset><label>Your name<input name="name" maxlength="40" required autocomplete="nickname" value="${escape(draft.name || '')}" placeholder="How your group knows you"/></label><label>Review <span>(optional)</span><textarea name="body" rows="3" maxlength="1000" placeholder="What would you tell a friend?">${escape(draft.body || '')}</textarea></label><div class="pp-draft-meta"><span data-draft-status>${savedDraft ? 'Draft restored' : 'Only visible in this browser'}</span><span data-review-length>${(draft.body || '').length}/1,000</span></div><p class="pp-form-error" id="place-review-status" role="alert"></p><div class="pp-form-actions"><button class="pp-secondary" type="button" data-cancel-review>Keep draft</button><button class="pp-primary" type="submit">${own ? 'Save changes' : 'Post review'}</button></div></form>`;
    }
    function tripPhotosHtml(point, photos) {
      if (!photos.length) return '';
      return `<section class="pp-trip-photos"><div class="pp-section-heading"><h4>Our photos</h4><span>${photos.length} ${photos.length === 1 ? 'photo' : 'photos'}</span></div><div class="pp-trip-photo-grid">${photos.map((photo, index) => `<button type="button" data-trip-photo="${escape(photo.id)}" aria-label="Open trip photo ${index + 1}${photo.caption ? `: ${escape(photo.caption)}` : ''}"><span class="pp-media is-loading"><img data-trip-image="${escape(photo.id)}" alt="${escape(photo.alt || '')}" loading="lazy"/><span class="pp-media-fallback">${icon('photos')}<span>Open photo</span></span></span></button>`).join('')}</div></section>`;
    }
    function clearTripImages() {
      content.querySelectorAll('[data-trip-image]').forEach(image => root.JOURNEY_ATLAS_AUTH?.clearImage(image));
    }
    function wireTripImages(photos) {
      for (const image of content.querySelectorAll('[data-trip-image]')) {
        const photo = photos.find(item => item.id === image.dataset.tripImage);
        if (!photo) continue;
        if (options.protected?.(photo)) {
          if (options.unlocked?.() && root.JOURNEY_ATLAS_AUTH?.setImage) root.JOURNEY_ATLAS_AUTH.setImage(image, photo, 480);
          else { image.hidden = true; image.closest('.pp-media').classList.add('is-unavailable'); }
        } else {
          const source = options.photoUrl?.(photo, 480) || photo.src;
          if (source) image.src = source.startsWith('./assets/') ? new URL(source.slice(9), assetBase).href : source;
        }
      }
    }
    function renderDetail({ preserveScroll = false } = {}) {
      const point = current(); if (!point) { selectedId = ''; renderList(); return; }
      const scroll = preserveScroll ? content.scrollTop : 0, reviews = reviewsFor(point), score = average(reviews);
      const related = root.JOURNEY_ATLAS_PHOTO_PLACES.photosForPlace(point, options.photos()).linked;
      const signature = JSON.stringify([point, reviews, related, Boolean(options.unlocked?.())]);
      // Returning from a photo, gallery or temporary panel dismissal keeps the
      // actual detail, image bindings and expanded disclosures in place.
      if (detailSignature === signature) { if (!preserveScroll) content.scrollTop = 0; return; }
      detailSignature = signature;
      const images = point.images || [], ownReviewAvailable = preview && point.status === 'visited';
      clearTripImages(); renderScope();
      panel.classList.add('pp-selected'); panel.setAttribute('aria-labelledby', 'place-detail-title');
      $('.pp-heading').hidden = true; $('.pp-browse-controls').hidden = true; $('.pp-detail-nav').hidden = false;
      $('.pp-detail-nav-name').textContent = point.name;
      content.innerHTML = `<header class="pp-identity"><div class="pp-identity-copy"><div class="pp-card-kind">${icon(point.category)}${point.category === 'food' ? 'Food & drink' : 'Place of interest'}<span class="pp-visit-status">${point.status === 'visited' ? 'Visited' : 'Saved for later'}</span></div><h3 id="place-detail-title" tabindex="-1">${escape(point.name)}</h3>${score ? `<button class="pp-rating-link" data-show-place-tab="reviews" aria-haspopup="dialog" aria-controls="place-reviews-dialog"><b>${score}</b>${ratingStars(score)}<span>${reviews.length} group ${reviews.length === 1 ? 'review' : 'reviews'}</span>${icon('next')}</button>` : ''}${point.sample ? '<p class="pp-sample-note">Sample place · fictional group memories</p>' : ''}</div>${images.length ? `<button class="pp-identity-image" data-open-gallery="0" aria-label="View venue photos of ${escape(point.name)}">${pictureHtml(images[0], { thumbnail: true })}<span>Venue ${images.length === 1 ? 'photo' : 'photos'}</span></button>` : ''}</header>
        <div class="pp-tabs"><div class="pp-tablist" role="tablist" aria-label="Place details">${tabs.map(name => `<button type="button" role="tab" id="place-tab-${name}" data-place-tab="${name}" aria-controls="place-tab-panel-${name}" aria-selected="${tab === name}" tabindex="${tab === name ? 0 : -1}">${name[0].toUpperCase() + name.slice(1)}${name === 'photos' && images.length + related.length ? ` <span>${images.length + related.length}</span>` : ''}</button>`).join('')}</div></div>
        <section id="place-tab-panel-overview" role="tabpanel" aria-labelledby="place-tab-overview" data-place-tab-panel="overview"${tab === 'overview' ? '' : ' hidden'}><div class="pp-overview-copy"><p>${escape(point.summary)}</p>${point.note ? `<blockquote><span>${point.status === 'saved' ? 'Saved note' : 'Our memory'}</span>${escape(point.note)}</blockquote>` : ''}</div><div class="pp-quick-actions">${point.mapsUrl ? `<a class="pp-primary" href="${escape(point.mapsUrl)}" target="_blank" rel="noopener noreferrer">Google Maps${icon('link')}</a>` : ''}<button class="pp-text-button" data-place-map>${icon('pin')}Recenter map</button></div>
        <div class="pp-facts">${point.address ? `<div>${icon('pin')}<span>${escape(point.address)}${point.locationAccuracy === 'approximate' ? '<small>Approximate map position</small>' : ''}</span></div>` : ''}${point.dayIds.length ? `<div>${icon('day')}<span>${point.dayIds.map(id => { const day = resolvedDay(id); return day ? `${eventWord('title')} ${day.number}${day.title ? ` · ${escape(day.title)}` : ''}${day.date ? `<small>${escape(day.date)}</small>` : ''}` : ''; }).filter(Boolean).join('<br/>')}</span></div>` : ''}</div>
        ${!score ? `<div class="pp-review-state"><p>No reviews yet.</p>${ownReviewAvailable ? '<button class="pp-text-button" data-show-place-tab="reviews" aria-haspopup="dialog" aria-controls="place-reviews-dialog">Write a group review</button>' : ''}</div>` : ''}
        <details class="pp-sources"><summary>About this place & sources${icon('next')}</summary><p>Place details are collected for this journey.${!point.address && point.locationAccuracy === 'approximate' ? ' The map position is approximate.' : ''}</p>${(point.sources || []).map(source => `<a href="${escape(source.url)}" target="_blank" rel="noopener noreferrer">${icon('globe')}<span>${escape(source.label)}</span>${icon('link')}</a>`).join('')}</details></section>
        <section id="place-tab-panel-photos" role="tabpanel" aria-labelledby="place-tab-photos" data-place-tab-panel="photos"${tab === 'photos' ? '' : ' hidden'}>${tripPhotosHtml(point, related)}<div class="pp-place-photos"><div class="pp-section-heading"><h4>Venue photos</h4>${images.length ? `<span>${images.length} ${images.length === 1 ? 'photo' : 'photos'}</span>` : ''}</div>${images.length ? `<div class="pp-photo-grid">${images.map((picture, index) => `<figure><button data-open-gallery="${index}" aria-label="Open venue photo ${index + 1}: ${escape(picture.alt)}">${pictureHtml(picture, { index })}</button><figcaption><span>${escape(picture.credit)}</span><a href="${escape(picture.sourceUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Source for venue photo ${index + 1}">Source${icon('link')}</a>${picture.licenseUrl ? `<a href="${escape(picture.licenseUrl)}" target="_blank" rel="noopener noreferrer">License${icon('link')}</a>` : ''}</figcaption></figure>`).join('')}</div>` : '<p class="pp-section-note">No venue photos added yet.</p>'}</div></section>`;
      wireImages(content); wireTripImages(related); if (reviewDialog.open) renderReviews(); content.scrollTop = scroll;
    }
    function bindReviewForm() {
      const form = $('#place-review-form'); if (!form) return;
      form.addEventListener('input', () => {
        const point = current(), data = new FormData(form), value = { name: String(data.get('name') || ''), rating: Number(data.get('rating') || 0), body: String(data.get('body') || '') };
        memoryDrafts.set(`${journeyId}:${point.id}`, value);
        $('.pp-rating-word').textContent = ['Choose a rating', 'Not for us', 'Could be better', 'Good', 'Really good', 'Loved it'][value.rating] || 'Choose a rating';
        $('[data-review-length]').textContent = `${value.body.length}/1,000`;
        try { store().draft(draftKey(point), value); $('[data-draft-status]').textContent = 'Draft saved in this browser'; }
        catch { $('[data-draft-status]').textContent = 'Text kept here. Browser storage is unavailable.'; }
      });
      form.addEventListener('submit', event => {
        event.preventDefault(); const point = current(), data = new FormData(form);
        try {
          store().saveReview(point.id, data.get('name'), Number(data.get('rating')), data.get('body'));
          clearDraft(point); renderDetail({ preserveScroll: true });
          const own = $('.pp-own-review'); own?.focus({ preventScroll: true }); own?.scrollIntoView({ block: 'nearest', behavior: duration(1) ? 'smooth' : 'instant' });
          showToast('Your review is saved in this browser.');
        } catch (error) { $('#place-review-status').textContent = error.message; }
      });
    }
    function snapshot() { return { journeyId, open: visible, selectedId, nearbyIds, category, query, dayOnly, scopeChoice, tab, entry:historyEntry, scroll:visible ? {top:content.scrollTop || 0,tabs:{...selectedTabScroll}} : null, reviews:reviewDialog.open, gallery: galleryIndex, depth: visible ? historyDepth : 0 }; }
    function rememberHistory(push = false) {
      if (restoring) return;
      if (push) { historyDepth += 1; historyEntry = ++nextHistoryEntry; }
      const state = snapshot(); history[push ? 'pushState' : 'replaceState']({ ...history.state, atlasPlaces: state }, '', location.href); lastHistory = JSON.stringify(state);
    }
    function setExpanded(value) {
      resetSheetDrag();
      expanded = value; panel.dataset.expanded = String(value);
      $('#places-sheet-toggle').setAttribute('aria-expanded', String(value));
      $('#places-sheet-toggle').setAttribute('aria-label', value ? 'Show map' : 'Show list');
      $('#places-sheet-label').textContent = value ? 'Show map' : 'Show list';
    }
    function changeTab(name, { focus = true, scroll = true, historyWrite = true } = {}) {
      if (name === 'reviews') { openReviews(historyWrite); return; }
      if (!tabs.includes(name) || !selectedId) return;
      if (mobile() && name !== 'overview') setExpanded(true);
      selectedTabScroll[tab] = content.scrollTop; tab = name;
      for (const button of panel.querySelectorAll('[data-place-tab]')) {
        const active = button.dataset.placeTab === name; button.setAttribute('aria-selected', String(active)); button.tabIndex = active ? 0 : -1;
        if (active && focus) button.focus({ preventScroll: true });
      }
      for (const section of panel.querySelectorAll('[data-place-tab-panel]')) section.hidden = section.dataset.placeTabPanel !== name;
      if (scroll) content.scrollTop = selectedTabScroll[name] ?? Math.max(0, $('.pp-tabs').offsetTop - content.offsetTop);
      if (historyWrite) rememberHistory();
    }
    function selectPlace(id, move = true, historyWrite = true) {
      if (!points().some(point => point.id === id)) return;
      if (reviewDialog.open) closeReviews(false, false);
      const wasDetail = Boolean(selectedId); if (!wasDetail) { if (nearbyIds) nearbyScroll = content.scrollTop; else listScroll = content.scrollTop; }
      if (nearbyIds && !nearbyIds.includes(id)) nearbyIds = null;
      if (selectedId !== id) { selectedId = id; tab = 'overview'; selectedTabScroll = {}; }
      if (mobile()) setExpanded(true);
      renderDetail(); closeCluster(); renderMarkers();
      if (historyWrite) rememberHistory(!wasDetail);
      if (move) focusPlace(current());
      $('#place-detail-title')?.focus({ preventScroll: true });
    }
    function backToList(historyWrite = true) {
      if (reviewDialog.open) closeReviews(false, false);
      const previous = selectedId; selectedId = ''; tab = 'overview'; selectedTabScroll = {};
      if (mobile()) setExpanded(true);
      renderList(); renderMarkers();
      const card = [...panel.querySelectorAll('[data-place-id]')].find(button => button.dataset.placeId === previous); card?.focus({ preventScroll: true });
      if (historyWrite) rememberHistory();
    }
    function closeCluster() { clusterPopup?.remove(); clusterPopup = null; }
    function showNearby(ids) {
      const valid = nearbyPlaces(filtered(), ids); if (!valid.length) return;
      if (!visible) open({ focus: false });
      if (!selectedId && !nearbyIds) listScroll = content.scrollTop;
      nearbyIds = valid.map(point => point.id); nearbyScroll = 0; selectedId = ''; tab = 'overview'; selectedTabScroll = {};
      closeCluster(); setExpanded(true); renderList(); renderMarkers(); rememberHistory();
      const heading = $('#places-count'); if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
    }
    function clearNearby() {
      nearbyIds = null; nearbyScroll = 0; renderList(); rememberHistory(); $('#places-title').focus({ preventScroll: true });
    }
    function scheduleMarkers() { if (markerFrame) return; markerFrame = requestAnimationFrame(() => { markerFrame = 0; renderMarkers(); }); }
    function renderMarkers() {
      closeCluster();
      markers.forEach(marker => marker.remove()); markers = [];
      const map = options.map(); if ((!visible && options.mapScope?.() !== 'day') || !map || !root.maplibregl) return;
      const results = visible ? filtered() : points().filter(point=>!point.dayIds.length || point.dayIds.includes(options.dayId())); if (visible && current() && !results.includes(current())) results.push(current());
      for (const group of clusterPoints(results, coordinates => map.project(coordinates), selectedId)) {
        const point = group.points[0], cluster = group.points.length > 1, button = document.createElement('button');
        button.type = 'button'; button.className = `pp-pin pp-pin-${cluster ? 'cluster' : point.category}${group.selected ? ' is-selected' : ''}`;
        button.setAttribute('aria-label', cluster ? `${group.points.length} places nearby. Show places.` : `${point.name}, ${point.category === 'food' ? 'food and drink' : 'sight'}`);
        button.innerHTML = cluster ? `<b>${group.points.length}</b>` : icon(point.category);
        if (!cluster) { const label = document.createElement('span'); label.className = 'pp-pin-label'; label.textContent = point.name; button.append(label); }
        button.addEventListener('click', event => {
          event.stopPropagation();
          if (!cluster) { openPlace(point.id); return; }
          if (mobile()) { showNearby(group.points.map(point => point.id)); return; }
          closeCluster(); const chooser = document.createElement('div'); chooser.className = 'pp-cluster-chooser';
          chooser.innerHTML = `<strong>${group.points.length} places nearby</strong>${group.points.map(item => `<button data-cluster-place="${escape(item.id)}">${icon(item.category)}<span>${escape(item.name)}</span>${icon('next')}</button>`).join('')}`;
          chooser.addEventListener('click', event => { const target = event.target.closest('[data-cluster-place]'); if (target) openPlace(target.dataset.clusterPlace); });
          clusterPopup = new root.maplibregl.Popup({ offset: 28, closeButton: true, closeOnClick: true, className: 'pp-cluster-popup', maxWidth: '290px' }).setLngLat(point.coordinates).setDOMContent(chooser).addTo(map);
          chooser.querySelector('button')?.focus();
        });
        markers.push(new root.maplibregl.Marker({ element: button, anchor: 'center' }).setLngLat(point.coordinates).addTo(map));
      }
    }
    function mapPadding() {
      const map = options.map(), frame = map?.getContainer().getBoundingClientRect();
      if (!frame) return { top: 64, bottom: 68, left: 64, right: 64 };
      const toolbar = document.getElementById('experience-bar');
      const isMobile = mobile();
      return mapInsets(frame, { mobile: isMobile, sheet: isMobile ? panel.getBoundingClientRect() : null, toolbar: toolbar && !toolbar.hidden && toolbar.getClientRects?.()?.length ? toolbar.getBoundingClientRect() : null });
    }
    function fitPlaces() {
      const map = options.map(), results = filtered(); if (!map || !results.length || !root.maplibregl) { if (!map) showToast('The map is still loading. Your places are ready to browse.'); return; }
      const request = ++cameraVersion;
      requestAnimationFrame(() => {
        if (!visible || request !== cameraVersion) return;
        const bounds = results.reduce((bounds, point) => bounds.extend(point.coordinates), new root.maplibregl.LngLatBounds(results[0].coordinates, results[0].coordinates));
        map.fitBounds(bounds, { padding: mapPadding(), maxZoom: 15.5, duration: duration(650) });
      });
    }
    function focusPlace(point) {
      cameraVersion++;
      const map = options.map(); if (!map || !point) { showToast('The map is still loading. Your place is ready to read.'); return; }
      const padding = mapPadding();
      map.easeTo({ center: point.coordinates, zoom: Math.max(15, map.getZoom()), padding: 0, offset: [0, (padding.top - padding.bottom) / 2], duration: duration(500) });
    }
    function renderGallery() {
      const point = current(), pictures = point?.images || [], picture = pictures[galleryIndex]; if (!picture) return;
      gallery.querySelector('.pp-gallery-name').textContent = point.name;
      gallery.querySelector('.pp-gallery-count').textContent = `${galleryIndex + 1} of ${pictures.length}`;
      gallery.querySelector('figure').innerHTML = `<div class="pp-media is-loading"><img src="${escape(imageUrl(picture))}" alt="${escape(picture.alt)}"/><div class="pp-media-fallback">${icon('photos')}<p>This photo couldn’t load.</p><button class="pp-gallery-retry" data-gallery-retry>Try again</button></div></div>`;
      gallery.querySelector('footer').innerHTML = `<span>${picture.permission === 'illustration' ? 'Illustration · ' : ''}${escape(picture.credit)}</span><a href="${escape(picture.sourceUrl)}" target="_blank" rel="noopener noreferrer">Photo source${icon('link')}</a>${picture.licenseUrl ? `<a href="${escape(picture.licenseUrl)}" target="_blank" rel="noopener noreferrer">License${icon('link')}</a>` : ''}`;
      gallery.querySelector('[data-gallery-prev]').disabled = galleryIndex === 0;
      gallery.querySelector('[data-gallery-next]').disabled = galleryIndex === pictures.length - 1;
      wireImages(gallery);
    }
    function openGallery(index, historyWrite = true) {
      if (!current()?.images?.[index]) return;
      const wasOpen = gallery.open; if (!wasOpen) galleryReturn = document.activeElement;
      galleryIndex = index; renderGallery();
      if (!wasOpen) { gallery.showModal(); gallery.querySelector('[data-gallery-close]').focus(); }
      if (historyWrite) rememberHistory(!wasOpen);
    }
    function closeGallery(historyWrite = true) {
      galleryIndex = -1; if (gallery.open) gallery.close();
      if (galleryReturn?.isConnected) galleryReturn.focus({ preventScroll: true });
      if (historyWrite) rememberHistory();
    }
    function requestGalleryClose() { if (history.state?.atlasPlaces?.gallery >= 0 && historyDepth > 1) history.back(); else closeGallery(); }
    function open({ historyWrite = true, focus = true, scope } = {}) {
      update();
      if (scope === 'day' || scope === 'all') { scopeChoice = scope; selectedId = ''; nearbyIds = null; listScroll = 0; }
      if (!restoring) dayOnly = scopeChoice ? scopeChoice === 'day' : options.mapScope?.() === 'day';
      if (!resolvedDay(options.dayId())) dayOnly = false;
      if (visible) { if (mobile()) setExpanded(true); if (scope) { renderList(); renderMarkers(); rememberHistory(); } return; }
      const map = options.map();
      // A cold MapLibre map has a neutral world camera. It is not a journey
      // context, nor is an opening animation's intermediate position.
      const canRestoreCamera = options.canRestoreMapCamera ? options.canRestoreMapCamera() : map?.loaded?.() === true && !map.isMoving?.();
      const center = canRestoreCamera ? map?.getCenter?.() : null;
      savedCamera = center ? { dayId: options.dayId(), center: center.toArray ? center.toArray() : center, zoom: map.getZoom(), bearing: map.getBearing?.() || 0, pitch: map.getPitch?.() || 0, padding: map.getPadding?.() || 0 } : null;
      returnFocus = document.activeElement; options.explore(); visible = true; panel.hidden = false; document.body.classList.add('places-open');
      const opening = ++panelVersion;
      if (historyWrite) historyDepth = 0;
      for (const id of ['open-places', 'mobile-open-places', 'mobile-day-places']) document.getElementById(id)?.setAttribute('aria-expanded', 'true');
      update(); selectedId ? renderDetail({ preserveScroll: true }) : renderList(); setExpanded(mobile() || expanded);options.onPlacesVisibility?.();
      if (historyWrite) rememberHistory(true);
      requestAnimationFrame(() => { if (!visible || opening !== panelVersion) return; options.map()?.resize(); renderMarkers(); if (!selectedId) fitPlaces(); else focusPlace(current()); });
      if (focus) (selectedId ? $('#places-back-to-list') : $('#places-title')).focus({ preventScroll: true });
    }
    function close({ historyWrite = true, focus = true, restoreCamera = true } = {}) {
      closeCluster();
      if (!visible) return;
      if (historyWrite && history.state?.atlasPlaces?.open) { history.go(-Math.max(1, history.state.atlasPlaces.depth || 1)); return; }
      panelVersion++; cameraVersion++;
      resetSheetDrag();
      if (!selectedId) { if (nearbyIds) nearbyScroll = content.scrollTop; else listScroll = content.scrollTop; }
      if (reviewDialog.open) closeReviews(false, false);
      if (gallery.open) closeGallery(false); visible = false; historyDepth = 0; panel.hidden = true; document.body.classList.remove('places-open'); renderMarkers();
      options.onPlacesVisibility?.();
      for (const id of ['open-places', 'mobile-open-places', 'mobile-day-places']) document.getElementById(id)?.setAttribute('aria-expanded', 'false');
      const map = options.map(); map?.resize();
      if (restoreCamera && savedCamera && savedCamera.dayId === options.dayId() && map?.jumpTo) {
        const { dayId, ...camera } = savedCamera; map.jumpTo(camera);
      } else if (restoreCamera) options.restoreMap?.();
      if (focus) { const target = returnFocus?.isConnected && returnFocus.getClientRects().length ? returnFocus : document.getElementById(mobile() ? 'mobile-day-picker' : 'open-places'); target?.focus({ preventScroll: true }); }
    }
    function update(reset = false) {
      const journey = options.journey(); if (!journey) return;
      const changedJourney = journeyId !== journey.id, changedDay = lastDay !== options.dayId();
      if (changedJourney) {
        if (reviewDialog.open) closeReviews(false, false);
        journeyId = journey.id; selectedId = ''; tab = 'overview'; category = 'all'; query = ''; dayOnly = false; scopeChoice = null; listScroll = 0; nearbyIds = null; nearbyScroll = 0; selectedTabScroll = {}; expanded = false;
        $('#places-search').value = '';
        if (gallery.open) closeGallery(false); closeCluster();
        if (history.state?.atlasPlaces?.open) rememberHistory();
      }
      renderScope();
      lastDay = options.dayId(); const placeCount = points().length;
      const count = document.getElementById('place-count'); if (count) count.textContent = String(placeCount);
      for (const id of ['open-places', 'mobile-open-places', 'mobile-day-places', 'experience-places']) {
        const button = document.getElementById(id); if (button) button.hidden = placeCount === 0;
      }
      const dayPlaces = document.getElementById('mobile-day-places'), dayCount = searchPlaces(points(), { dayId: options.dayId() }).length;
      if (dayPlaces) { dayPlaces.hidden = dayCount === 0; dayPlaces.textContent = `Places · ${dayCount}`; }
      if (reset) {
        detailSignature = '';
        for (const key of memoryDrafts.keys()) if (key.startsWith(`${journeyId}:`)) memoryDrafts.delete(key);
        undo = null; clearTimeout(toastTimer); $('.pp-toast').hidden = true;
        if (visible) selectedId ? renderDetail({ preserveScroll: true }) : renderList();
      }
      if (changedDay && dayOnly) nearbyIds = null;
      if (visible && (changedJourney || (changedDay && dayOnly && !selectedId))) renderList();
      if (visible && selectedId) renderDetail({preserveScroll:true});
      scheduleMarkers();
    }
    function mapReady() {
      const map = options.map(); if (map && map !== markerMap) { markerMap?.off('moveend', scheduleMarkers); markerMap?.off('movestart', closeCluster); markerMap = map; map.on('moveend', scheduleMarkers); map.on('movestart', closeCluster); }
      scheduleMarkers();if (visible) { current() ? focusPlace(current()) : fitPlaces(); }
    }
    for (const id of ['open-places', 'mobile-open-places']) document.getElementById(id)?.addEventListener('click', () => open());
    document.getElementById('mobile-day-places')?.addEventListener('click', () => open({ scope: 'day' }));
    $('#places-title').tabIndex = -1;
    function handlePanelClick(event) {
      const target = event.target.closest('button'); if (!target) return;
      if (target.id === 'close-places' || target.id === 'close-place-details' || target.hasAttribute('data-return-journey')) { close(); return; }
      if (target.id === 'places-back-to-list') { history.state?.atlasPlaces?.selectedId && historyDepth > 1 ? history.back() : backToList(); return; }
      if (target.dataset.placeId) { selectPlace(target.dataset.placeId); return; }
      if (target.hasAttribute('data-clear-nearby')) { clearNearby(); return; }
      if (target.dataset.placeScope) { setScope(target.dataset.placeScope); return; }
      if (target.dataset.placeFilter) { nearbyIds = null; category = target.dataset.placeFilter; if (mobile()) { panel.dataset.filtersOpen = 'false'; $('#places-filter-toggle').setAttribute('aria-expanded', 'false'); $('#places-filter-toggle').focus({ preventScroll: true }); } listScroll = 0; renderList(); renderMarkers(); fitPlaces(); rememberHistory(); return; }
      if (target.hasAttribute('data-clear-filters')) { nearbyIds = null; category = 'all'; query = ''; dayOnly = false; scopeChoice = 'all'; $('#places-search').value = ''; listScroll = 0; renderList(); renderMarkers(); fitPlaces(); rememberHistory(); $('#places-search').focus(); return; }
      if (target.hasAttribute('data-clear-search')) { nearbyIds = null; query = ''; $('#places-search').value = ''; listScroll = 0; renderList(); renderMarkers(); rememberHistory(); $('#places-search').focus(); return; }
      if (target.id === 'places-filter-toggle') {
        const show = panel.dataset.filtersOpen !== 'true';
        panel.dataset.filtersOpen = String(show); target.setAttribute('aria-expanded', String(show));
        if (mobile()) setExpanded(true);
        return;
      }
      if (target.id === 'places-fit') { setExpanded(false); fitPlaces(); return; }
      if (target.dataset.placeTab || target.dataset.showPlaceTab) { changeTab(target.dataset.placeTab || target.dataset.showPlaceTab); return; }
      if (target.hasAttribute('data-place-map')) { toggleSheet(false); announce(`${current().name} shown on the map.`); return; }
      if (target.dataset.tripPhoto) {
        const point = current(), photos = root.JOURNEY_ATLAS_PHOTO_PLACES.photosForPlace(point, options.photos()).linked;
        if (photos.some(photo => photo.id === target.dataset.tripPhoto)) { closeForPhotos(); options.openPhoto?.(target.dataset.tripPhoto, { photos, collectionLabel: point.name }); }
        return;
      }
      if (target.hasAttribute('data-open-gallery')) { openGallery(Number(target.dataset.openGallery)); return; }
      if (target.hasAttribute('data-edit-review')) { const form = $('#place-review-form'); if (form) { if (mobile()) setExpanded(true); form.hidden = false; form.querySelector('input:checked, input').focus({ preventScroll: true }); form.scrollIntoView({ block: 'start', behavior: duration(1) ? 'smooth' : 'instant' }); } return; }
      if (target.hasAttribute('data-cancel-review')) { $('#place-review-form').hidden = true; $('[data-edit-review]')?.focus(); showToast(readDraft(current()) ? 'Your draft is here when you come back.' : 'Review closed.'); return; }
      if (target.hasAttribute('data-delete-review')) {
        const point = current(), own = ownReview(point); if (!own) return;
        try { store().removeReview(point.id); clearDraft(point); renderDetail({ preserveScroll: true }); $('[data-edit-review]')?.focus({ preventScroll: true }); showToast('Your review was deleted.', { pointId: point.id, ...own }); }
        catch (error) { showToast(error.message); } return;
      }
      if (target.hasAttribute('data-undo-review') && undo) {
        try { store().saveReview(undo.pointId, undo.authorName, undo.rating, undo.text); if (selectedId === undo.pointId) renderDetail({ preserveScroll: true }); else if (!selectedId) renderList(); showToast('Your review was restored.'); $('.pp-own-review')?.focus({ preventScroll: true }); }
        catch (error) { showToast(error.message, undo); } return;
      }
      if (target.hasAttribute('data-dismiss-toast')) { $('.pp-toast').hidden = true; clearTimeout(toastTimer); return; }
    }
    panel.addEventListener('click', handlePanelClick);
    reviewDialog.addEventListener('click', handlePanelClick);
    $('#places-search').addEventListener('focus', () => { if (mobile()) setExpanded(true); });
    $('#places-search').addEventListener('input', event => { nearbyIds = null; query = event.target.value; listScroll = 0; renderList(); renderMarkers(); rememberHistory(); });
    content.addEventListener('scroll', () => {
      if (!visible || restoring) return;
      if (selectedId) selectedTabScroll[tab] = content.scrollTop;
      else if (nearbyIds) nearbyScroll = content.scrollTop;
      else listScroll = content.scrollTop;
      // Each browser-history entry owns the view it is leaving, including a
      // detail revisited with Forward after Back has rebuilt the places list.
      // Keep scroll updates in memory: avoid replacing browser history on every
      // animation frame.
      if (history.state?.atlasPlaces?.open) scrollEntries.set(historyEntry, {top:content.scrollTop,tabs:{...selectedTabScroll}});
    }, { passive: true });
    panel.addEventListener('keydown', event => {
      const target = event.target.closest('[data-place-tab]');
      if (!target || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault(); const index = tabs.indexOf(target.dataset.placeTab);
      changeTab(tabs[event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length], { scroll: false });
    });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && visible && !document.querySelector('dialog[open]')) { event.preventDefault(); selectedId ? $('#places-back-to-list').click() : close(); } });
    const handle = $('#places-sheet-toggle');
    let sheetDrag = null, sheetDragFrame = 0, ignoreClick = false, sheetMapRequest = 0;
    function resetSheetDrag() {
      if (sheetDragFrame) cancelAnimationFrame(sheetDragFrame);
      sheetDragFrame = 0;
      const drag = sheetDrag; sheetDrag = null;
      if (drag?.surface.hasPointerCapture?.(drag.pointerId)) drag.surface.releasePointerCapture(drag.pointerId);
      panel.classList.remove('pp-sheet-dragging');
      panel.style?.removeProperty('--pp-sheet-drag-height');
    }
    function paintSheetDrag() {
      sheetDragFrame = 0;
      if (sheetDrag?.moved) panel.style.setProperty('--pp-sheet-drag-height', `${sheetDrag.height}px`);
    }
    function startSheetDrag(event) {
      if (!visible || !mobile() || event.isPrimary === false || (event.button !== undefined && event.button !== 0)) return;
      // Short landscape keeps its full-height side sheet. Its controls and map
      // remain independent, rather than applying a bottom-sheet drag sideways.
      if (matchMedia('(max-height:560px) and (max-width:900px) and (orientation:landscape)').matches) return;
      const surface = event.currentTarget;
      if (surface !== handle && event.target.closest('button,a,input,select,textarea,[contenteditable="true"]')) return;
      resetSheetDrag(); sheetMapRequest++; cameraVersion++;
      const frame = panel.getBoundingClientRect(), style = getComputedStyle(panel);
      sheetDrag = { surface, pointerId: event.pointerId, x: event.clientX, y: event.clientY, startHeight: frame.height, height: frame.height,
        min: parseFloat(style.minHeight) || 0, max: parseFloat(style.maxHeight) || frame.height, expanded, moved: false };
      // Catch an in-progress map/list animation at its visible height, so a
      // new drag starts under the finger rather than from the animation target.
      panel.classList.add('pp-sheet-dragging');
      panel.style.setProperty('--pp-sheet-drag-height', `${frame.height}px`);
      surface.setPointerCapture(event.pointerId);
    }
    function moveSheetDrag(event) {
      const drag = sheetDrag;
      if (!drag || event.pointerId !== drag.pointerId) return;
      const dy = event.clientY - drag.y, dx = event.clientX - drag.x;
      if (!drag.moved && (Math.abs(dy) < 6 || Math.abs(dy) < Math.abs(dx))) return;
      if (!drag.moved) { drag.moved = true; options.map()?.stop?.(); }
      event.preventDefault();
      drag.height = Math.max(drag.min, Math.min(drag.max, drag.startHeight - dy));
      if (!sheetDragFrame) sheetDragFrame = requestAnimationFrame(paintSheetDrag);
    }
    function endSheetDrag(event, cancelled = false) {
      const drag = sheetDrag;
      if (!drag || event.pointerId !== drag.pointerId) return;
      const moved = drag.moved, dy = event.clientY - drag.y;
      if (moved) {
        if (sheetDragFrame) cancelAnimationFrame(sheetDragFrame);
        paintSheetDrag();
        // Commit the finger-following height before reenabling the short snap.
        panel.getBoundingClientRect();
        ignoreClick = true;
        setTimeout(() => { ignoreClick = false; }, 0);
      }
      const next = !cancelled && moved && Math.abs(dy) > 28 ? dy < 0 : drag.expanded;
      resetSheetDrag(); setExpanded(next);
      if (moved) scheduleMarkers();
    }
    function toggleSheet(value) {
      setExpanded(value);
      const request = ++sheetMapRequest;
      // Reframe only on a deliberate map request, after the sheet has settled.
      if (!value) {
        const version = panelVersion;
        setTimeout(() => { if (visible && !expanded && version === panelVersion && request === sheetMapRequest) current() ? focusPlace(current()) : fitPlaces(); }, duration(300));
      }
    }
    handle.addEventListener('click', () => { if (!ignoreClick) toggleSheet(!expanded); ignoreClick = false; });
    for (const surface of [handle, $('.pp-heading'), $('.pp-detail-nav')]) {
      surface.addEventListener('pointerdown', startSheetDrag);
      surface.addEventListener('pointermove', moveSheetDrag);
      surface.addEventListener('pointerup', event => endSheetDrag(event));
      surface.addEventListener('pointercancel', event => endSheetDrag(event, true));
      surface.addEventListener('lostpointercapture', event => endSheetDrag(event, true));
    }
    gallery.addEventListener('cancel', event => { event.preventDefault(); requestGalleryClose(); });
    gallery.addEventListener('click', event => {
      if (event.target.closest('[data-gallery-close]')) requestGalleryClose();
      if (event.target.closest('[data-gallery-prev]') && galleryIndex > 0) openGallery(galleryIndex - 1);
      if (event.target.closest('[data-gallery-next]') && galleryIndex < current().images.length - 1) openGallery(galleryIndex + 1);
      if (event.target.closest('[data-gallery-retry]')) renderGallery();
    });
    gallery.addEventListener('keydown', event => { if (event.key === 'ArrowLeft' && galleryIndex > 0) { event.preventDefault(); openGallery(galleryIndex - 1); } if (event.key === 'ArrowRight' && galleryIndex < current().images.length - 1) { event.preventDefault(); openGallery(galleryIndex + 1); } });
    let galleryTouch = null;
    gallery.addEventListener('touchstart', event => { galleryTouch = event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null; }, { passive: true });
    gallery.addEventListener('touchend', event => { if (!galleryTouch) return; const touch = event.changedTouches[0], dx = touch.clientX - galleryTouch.x, dy = touch.clientY - galleryTouch.y; galleryTouch = null; if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 2) { const next = galleryIndex + (dx < 0 ? 1 : -1); if (next >= 0 && next < current().images.length) openGallery(next); } }, { passive: true });
    let viewportWidth = root.innerWidth, viewportHeight = root.innerHeight, resizeTimer;
    window.addEventListener('resize', () => {
      const changedWidth = Math.abs(root.innerWidth - viewportWidth) > 1, changedHeight = Math.abs(root.innerHeight - viewportHeight) > 100;
      if (!changedWidth && (!changedHeight || document.activeElement?.matches('input,textarea,[contenteditable="true"]'))) return;
      resetSheetDrag();
      viewportWidth = root.innerWidth; viewportHeight = root.innerHeight; clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { if (visible && !gallery.open) { options.map()?.resize(); current() ? focusPlace(current()) : fitPlaces(); } }, 180);
    });
    window.addEventListener('popstate', event => {
      const state = event.state?.atlasPlaces, signature = JSON.stringify(state || null); if (signature === lastHistory) return;
      lastHistory = signature; restoring = true; historyDepth = state?.depth || 0; historyEntry = state?.entry || 0;
      if (!state?.open || state.journeyId !== journeyId) close({ historyWrite: false });
      else {
        category = state.category || 'all'; query = state.query || ''; dayOnly = Boolean(state.dayOnly); scopeChoice = state.scopeChoice || null;
        $('#places-search').value = query; renderScope();
        if (!visible) open({ historyWrite: false, focus: false });
        const nextNearby = Array.isArray(state.nearbyIds) ? state.nearbyIds : null, nearbyChanged = JSON.stringify(nextNearby) !== JSON.stringify(nearbyIds);
        nearbyIds = nextNearby;
        if (state.selectedId !== selectedId) { if (state.selectedId) selectPlace(state.selectedId, true, false); else backToList(false); }
        else if (!selectedId) renderList();
        if (state.selectedId && state.tab !== tab) changeTab(state.tab, { historyWrite: false, focus: false });
        const scroll = scrollEntries.get(historyEntry) || state.scroll;
        if (scroll) {
          selectedTabScroll = {...scroll.tabs};
          content.scrollTop = scroll.top;
          if (!selectedId) { if (nearbyIds) nearbyScroll = scroll.top; else listScroll = scroll.top; }
        }
        if (state.reviews) openReviews(false); else if (reviewDialog.open) closeReviews(false);
        if (state.gallery >= 0) openGallery(state.gallery, false); else if (gallery.open) closeGallery(false);
      }
      restoring = false;
    });
    update(); mapReady();
    function openPlace(id) { if(!points().some(point=>point.id===id))return;open({focus:false});selectPlace(id,true); }
    function closeForPhotos() { close({historyWrite:false,focus:false});lastHistory=JSON.stringify(snapshot()); }
    function dayChanged() {
      // A desktop cluster chooser may be open while the Places panel is hidden.
      // Clear it first, and never restore the previous stop's camera on the way
      // to a newly selected stop.
      closeCluster();
      const wasOpen = visible;
      if (wasOpen) close({ historyWrite: false, focus: false, restoreCamera: false });
      selectedId = ''; nearbyIds = null; tab = 'overview'; selectedTabScroll = {}; savedCamera = null;
      if (wasOpen) rememberHistory();
    }
    return { open, close, update, mapReady, showNearby, openPlace, closeForPhotos, dayChanged, isOpen: () => visible };
  }
  root.JOURNEY_ATLAS_PLACE_PANEL = { create, searchPlaces, nearbyPlaces, placesInView, clusterPoints, mapInsets };
})(typeof window === 'undefined' ? globalThis : window);
