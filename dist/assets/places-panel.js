(function (root) {
  'use strict';
  const tabs = ['overview', 'reviews', 'photos'];
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim();
  function searchPlaces(points, { category = 'all', dayId = '', query = '' } = {}) {
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    return points.filter(point => (category === 'all' || point.category === category) && (!dayId || point.dayIds.includes(dayId)) && terms.every(term => normalize([point.name, point.summary, point.address, point.note].filter(Boolean).join(' ')).includes(term)));
  }
  function nearbyPlaces(points, ids) {
    if (!ids) return points;
    const included = new Set(ids); return points.filter(point => included.has(point.id));
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
    let top = 64, bottom = mobile && overlaps(sheet) ? Math.max(40, frame.bottom - sheet.top + 36) : 68;
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
    return { top, bottom, left: side, right: side };
  }
  function create(options) {
    const { escape, average, ratingSummary } = root.JOURNEY_ATLAS_PLACES;
    const panel = document.getElementById('places-panel');
    if (!panel) return { open() {}, close() {}, update() {}, mapReady() {}, isOpen: () => false };
    const preview = Boolean(options.preview);
    const assetScript = document.querySelector('script[src*="/places-panel.js"]');
    const assetBase = new URL('.', assetScript?.src || location.href);
    const mobile = () => matchMedia('(max-width:900px)').matches;
    const duration = value => matchMedia('(prefers-reduced-motion:reduce)').matches ? 0 : value;
    const $ = selector => panel.querySelector(selector);
    const points = () => options.journey()?.pointsOfInterest || [];
    const store = () => options.store();
    let journeyId = '', selectedId = '', category = 'all', query = '', dayOnly = false, tab = 'overview', expanded = false, visible = false;
    let listScroll = 0, nearbyIds = null, nearbyScroll = 0, selectedTabScroll = {}, lastDay = '', markers = [], markerMap = null, markerFrame = 0, returnFocus = null;
    let galleryIndex = -1, galleryReturn = null, restoring = false, undo = null, toastTimer, lastHistory = '', clusterPopup = null, historyDepth = 0, savedCamera = null;
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
    panel.innerHTML = `<button id="places-sheet-toggle" class="pp-sheet-handle" type="button" aria-label="Expand places" aria-expanded="false"><span></span></button><header class="pp-heading"><div><span class="pp-eyebrow">ALONG THE WAY</span><h2 id="places-title">Places we found</h2></div><button id="close-places" class="pp-icon-button" type="button" aria-label="Close places">${icon('close')}</button></header><div class="pp-browse-controls"><label class="pp-search">${icon('search')}<span class="pp-sr-only">Search places</span><input id="places-search" type="search" placeholder="Find a place" autocomplete="off"/><button type="button" data-clear-search aria-label="Clear search" hidden>${icon('close')}</button></label><div class="pp-filters" role="group" aria-label="Filter places"><button data-place-filter="all" aria-pressed="true">All places</button><button data-place-filter="food" aria-pressed="false">${icon('food')}Food & drink</button><button data-place-filter="sight" aria-pressed="false">${icon('sight')}Sights</button></div><div class="pp-options"><label><input id="places-day-only" type="checkbox"/><span>This day only</span></label><button id="places-fit" type="button">${icon('fit')}Show all on map</button></div></div><div class="pp-detail-nav" hidden><button id="places-back-to-list" class="pp-back" aria-label="Back to all places">${icon('back')}<span>Places</span></button><span class="pp-detail-nav-name"></span><button id="close-place-details" class="pp-icon-button" type="button" aria-label="Close place details">${icon('close')}</button></div><div id="places-content" class="pp-content"></div><div class="pp-toast" role="status" aria-live="polite" hidden><span></span><button data-undo-review hidden>Undo</button><button data-dismiss-toast class="pp-icon-button" aria-label="Dismiss message">${icon('close')}</button></div><p id="places-message" class="pp-sr-only" role="status" aria-live="polite"></p>`;
    const content = $('#places-content');
    const gallery = document.createElement('dialog');
    gallery.className = 'pp-gallery-dialog'; gallery.setAttribute('aria-label', 'Place photos');
    gallery.innerHTML = `<header><div><strong class="pp-gallery-name"></strong><span class="pp-gallery-count" aria-live="polite"></span></div><button class="pp-icon-button" data-gallery-close aria-label="Close place photos">${icon('close')}</button></header><div class="pp-gallery-stage"><button class="pp-gallery-arrow" data-gallery-prev aria-label="Previous place photo">${icon('back')}</button><figure></figure><button class="pp-gallery-arrow" data-gallery-next aria-label="Next place photo">${icon('next')}</button></div><footer></footer>`;
    document.body.append(gallery);
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
    function renderList() {
      const results = nearbyPlaces(filtered(), nearbyIds), hasFilters = category !== 'all' || dayOnly || Boolean(query.trim());
      const saved = nearbyIds ? nearbyScroll : listScroll;
      panel.classList.remove('pp-selected'); panel.setAttribute('aria-labelledby', 'places-title');
      $('.pp-heading').hidden = false; $('.pp-browse-controls').hidden = false; $('.pp-detail-nav').hidden = true;
      $('#places-fit').disabled = !results.length;
      $('[data-clear-search]').hidden = !query;
      for (const button of panel.querySelectorAll('[data-place-filter]')) button.setAttribute('aria-pressed', String(button.dataset.placeFilter === category));
      content.innerHTML = results.length ? `<div class="pp-list-meta${nearbyIds ? ' pp-nearby-meta' : ''}"><span id="places-count">${results.length} ${results.length === 1 ? 'place' : 'places'}${nearbyIds ? ' nearby' : hasFilters ? ` of ${points().length}` : ''}</span>${nearbyIds ? '<button class="pp-text-button" type="button" data-clear-nearby>Show all results</button>' : `<span>${points().some(point => point.sample) ? 'A sample of our journey' : 'Collected along the way'}</span>`}</div><div class="pp-cards">${results.map(point => {
        const reviews = reviewsFor(point), score = average(reviews), picture = point.images?.[0];
        return `<button class="pp-card" data-place-id="${escape(point.id)}" type="button"><span class="pp-card-copy"><span class="pp-card-kind">${point.category === 'food' ? 'Food & drink' : 'Sight'}${point.status === 'saved' ? '<span class="pp-saved">Saved for later</span>' : ''}</span><strong>${escape(point.name)}</strong><span class="pp-card-rating">${score ? `<b>${score}</b>${ratingStars(score)}<span>${reviews.length} group ${reviews.length === 1 ? 'review' : 'reviews'}</span>` : '<span>No group reviews yet</span>'}</span><span class="pp-card-summary">${escape(point.summary)}</span></span>${picture ? pictureHtml(picture, { thumbnail: true }) : `<span class="pp-no-thumbnail">${icon(point.category)}</span>`}</button>`;
      }).join('')}</div>` : `<div class="pp-empty">${icon(points().length ? 'search' : 'pin')}<h3>${points().length ? 'No places found' : 'Good places stay with us.'}</h3><p>${points().length ? `${query.trim() ? `No matches for “${escape(query.trim())}”. ` : ''}${dayOnly ? 'Try another day, or explore the whole journey.' : 'Try a different search or filter.'}` : 'The memorable meals, little discoveries and places worth coming back to will live here.'}</p>${points().length ? '<button class="pp-primary" data-clear-filters>Show all places</button>' : '<button class="pp-secondary" data-return-journey>Back to the journey</button>'}</div>`;
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
    function renderDetail({ preserveScroll = false } = {}) {
      const point = current(); if (!point) { selectedId = ''; renderList(); return; }
      const scroll = preserveScroll ? content.scrollTop : 0, reviews = reviewsFor(point), score = average(reviews);
      panel.classList.add('pp-selected'); panel.setAttribute('aria-labelledby', 'place-detail-title');
      $('.pp-heading').hidden = true; $('.pp-browse-controls').hidden = true; $('.pp-detail-nav').hidden = false;
      $('.pp-detail-nav-name').textContent = point.name;
      content.innerHTML = `${point.images?.length ? `<button class="pp-hero" data-open-gallery="0" aria-label="View photos of ${escape(point.name)}">${pictureHtml(point.images[0], { hero: true })}</button>` : ''}<header class="pp-identity"><div class="pp-card-kind">${icon(point.category)}${point.category === 'food' ? 'Food & drink' : 'Place of interest'}<span class="pp-visit-status">${point.status === 'visited' ? 'Visited' : 'Saved for later'}</span></div><h3 id="place-detail-title" tabindex="-1">${escape(point.name)}</h3><button class="pp-rating-link" data-show-place-tab="reviews">${score ? `<b>${score}</b>${ratingStars(score)}<span>${reviews.length} group ${reviews.length === 1 ? 'review' : 'reviews'}</span>` : '<span>No group reviews yet</span>'}${icon('next')}</button>${point.sample ? '<p class="pp-sample-note">Sample place · fictional group memories</p>' : ''}</header><div class="pp-tabs" role="tablist" aria-label="Place details">${tabs.map((name, i) => `<button type="button" role="tab" id="place-tab-${name}" data-place-tab="${name}" aria-controls="place-tab-panel-${name}" aria-selected="${tab === name}" tabindex="${tab === name ? 0 : -1}">${name[0].toUpperCase() + name.slice(1)}${name === 'photos' && point.images?.length ? ` <span>${point.images.length}</span>` : ''}</button>`).join('')}</div><section id="place-tab-panel-overview" role="tabpanel" aria-labelledby="place-tab-overview" data-place-tab-panel="overview"${tab === 'overview' ? '' : ' hidden'}><div class="pp-quick-actions"><button class="pp-primary" data-place-map>${icon('pin')}Show on map</button>${point.mapsUrl ? `<a class="pp-secondary" href="${escape(point.mapsUrl)}" target="_blank" rel="noopener noreferrer">Google Maps${icon('link')}</a>` : ''}</div><div class="pp-overview-copy"><p>${escape(point.summary)}</p>${point.note ? `<blockquote><span>Our memory</span>${escape(point.note)}</blockquote>` : ''}</div><div class="pp-facts">${point.address ? `<div>${icon('pin')}<span>${escape(point.address)}${point.locationAccuracy === 'approximate' ? '<small>Approximate map position</small>' : ''}</span></div>` : ''}${point.dayIds.length ? `<div>${icon('day')}<span>${point.dayIds.map(id => { const day = options.journey().days.find(day => day.id === id); return day ? `Day ${day.number} · ${escape(day.date || day.title)}` : ''; }).filter(Boolean).join('<br/>')}</span></div>` : ''}</div><details class="pp-sources"><summary>About this place & sources${icon('next')}</summary><p>Place details are collected for this journey.${!point.address && point.locationAccuracy === 'approximate' ? ' The map position is approximate.' : ''}</p>${(point.sources || []).map(source => `<a href="${escape(source.url)}" target="_blank" rel="noopener noreferrer">${icon('globe')}<span>${escape(source.label)}</span>${icon('link')}</a>`).join('')}</details></section><section id="place-tab-panel-reviews" role="tabpanel" aria-labelledby="place-tab-reviews" data-place-tab-panel="reviews"${tab === 'reviews' ? '' : ' hidden'}>${reviewHtml(point)}</section><section id="place-tab-panel-photos" role="tabpanel" aria-labelledby="place-tab-photos" data-place-tab-panel="photos"${tab === 'photos' ? '' : ' hidden'}><div class="pp-place-photos"><div class="pp-section-heading"><h4>A closer look</h4><span>${point.images?.length || 0} ${(point.images?.length || 0) === 1 ? 'photo' : 'photos'}</span></div>${point.images?.length ? `<div class="pp-photo-grid">${point.images.map((picture, index) => `<figure><button data-open-gallery="${index}" aria-label="Open photo ${index + 1}: ${escape(picture.alt)}">${pictureHtml(picture, { index })}</button><figcaption><span>${escape(picture.credit)}</span><a href="${escape(picture.sourceUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Source for photo ${index + 1}">Source${icon('link')}</a>${picture.licenseUrl ? `<a href="${escape(picture.licenseUrl)}" target="_blank" rel="noopener noreferrer">License${icon('link')}</a>` : ''}</figcaption></figure>`).join('')}</div>` : `<div class="pp-quiet-empty">${icon('photos')}<h5>A picture for another day.</h5><p>Photos of this place haven’t been added yet.</p></div>`}</div></section>`;
      wireImages(content); bindReviewForm(); content.scrollTop = scroll;
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
    function snapshot() { return { journeyId, open: visible, selectedId, nearbyIds, tab, gallery: galleryIndex, depth: visible ? historyDepth : 0 }; }
    function rememberHistory(push = false) {
      if (restoring) return;
      if (push) historyDepth += 1;
      const state = snapshot(); history[push ? 'pushState' : 'replaceState']({ ...history.state, atlasPlaces: state }, '', location.href); lastHistory = JSON.stringify(state);
    }
    function setExpanded(value) {
      expanded = value; panel.dataset.expanded = String(value);
      $('#places-sheet-toggle').setAttribute('aria-expanded', String(value));
      $('#places-sheet-toggle').setAttribute('aria-label', value ? 'Show more map' : 'Expand places');
    }
    function changeTab(name, { focus = true, scroll = true, historyWrite = true } = {}) {
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
      const wasDetail = Boolean(selectedId); if (!wasDetail) { if (nearbyIds) nearbyScroll = content.scrollTop; else listScroll = content.scrollTop; }
      if (nearbyIds && !nearbyIds.includes(id)) nearbyIds = null;
      if (selectedId !== id) { selectedId = id; tab = 'overview'; selectedTabScroll = {}; }
      renderDetail(); closeCluster(); renderMarkers();
      if (historyWrite) rememberHistory(!wasDetail);
      if (move) focusPlace(current());
      $('#place-detail-title')?.focus({ preventScroll: true });
    }
    function backToList(historyWrite = true) {
      const previous = selectedId; selectedId = ''; tab = 'overview'; selectedTabScroll = {};
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
      markers.forEach(marker => marker.remove()); markers = [];
      const map = options.map(); if (!visible || !map || !root.maplibregl) return;
      const results = filtered(); if (current() && !results.includes(current())) results.push(current());
      for (const group of clusterPoints(results, coordinates => map.project(coordinates), selectedId)) {
        const point = group.points[0], cluster = group.points.length > 1, button = document.createElement('button');
        button.type = 'button'; button.className = `pp-pin pp-pin-${cluster ? 'cluster' : point.category}${group.selected ? ' is-selected' : ''}`;
        button.setAttribute('aria-label', cluster ? `${group.points.length} places nearby. Show places.` : `${point.name}, ${point.category === 'food' ? 'food and drink' : 'sight'}`);
        button.innerHTML = cluster ? `<b>${group.points.length}</b>` : icon(point.category);
        if (!cluster) { const label = document.createElement('span'); label.className = 'pp-pin-label'; label.textContent = point.name; button.append(label); }
        button.addEventListener('click', event => {
          event.stopPropagation();
          if (!cluster) { selectPlace(point.id, false); return; }
          if (mobile()) { showNearby(group.points.map(point => point.id)); return; }
          closeCluster(); const chooser = document.createElement('div'); chooser.className = 'pp-cluster-chooser';
          chooser.innerHTML = `<strong>${group.points.length} places nearby</strong>${group.points.map(item => `<button data-cluster-place="${escape(item.id)}">${icon(item.category)}<span>${escape(item.name)}</span>${icon('next')}</button>`).join('')}`;
          chooser.addEventListener('click', event => { const target = event.target.closest('[data-cluster-place]'); if (target) selectPlace(target.dataset.clusterPlace); });
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
      setExpanded(false);
      requestAnimationFrame(() => { const bounds = results.reduce((bounds, point) => bounds.extend(point.coordinates), new root.maplibregl.LngLatBounds(results[0].coordinates, results[0].coordinates)); map.fitBounds(bounds, { padding: mapPadding(), maxZoom: 15.5, duration: duration(650) }); });
    }
    function focusPlace(point) {
      const map = options.map(); if (!map || !point) { showToast('The map is still loading. Your place is ready to read.'); return; }
      const padding = mapPadding();
      map.easeTo({ center: point.coordinates, zoom: Math.max(15, map.getZoom()), padding: 0, offset: [0, (padding.top - padding.bottom) / 2], duration: duration(500) });
    }
    function renderGallery() {
      const point = current(), pictures = point?.images || [], picture = pictures[galleryIndex]; if (!picture) return;
      gallery.querySelector('.pp-gallery-name').textContent = point.name;
      gallery.querySelector('.pp-gallery-count').textContent = `${galleryIndex + 1} of ${pictures.length}`;
      gallery.querySelector('figure').innerHTML = `<div class="pp-media is-loading"><img src="${escape(imageUrl(picture))}" alt="${escape(picture.alt)}"/><div class="pp-media-fallback">${icon('photos')}<p>This photo couldn’t load.</p><button class="pp-gallery-retry" data-gallery-retry>Try again</button></div></div>`;
      gallery.querySelector('footer').innerHTML = `<p>${escape(picture.alt)}</p><span>${picture.permission === 'illustration' ? 'Illustration · ' : ''}${escape(picture.credit)}</span><a href="${escape(picture.sourceUrl)}" target="_blank" rel="noopener noreferrer">Photo source${icon('link')}</a>${picture.licenseUrl ? `<a href="${escape(picture.licenseUrl)}" target="_blank" rel="noopener noreferrer">License${icon('link')}</a>` : ''}`;
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
    function open({ historyWrite = true, focus = true } = {}) {
      if (visible) return;
      const map = options.map();
      // A cold MapLibre map has a neutral world camera. It is not a journey
      // context, nor is an opening animation's intermediate position.
      const canRestoreCamera = options.canRestoreMapCamera ? options.canRestoreMapCamera() : map?.loaded?.() === true && !map.isMoving?.();
      const center = canRestoreCamera ? map?.getCenter?.() : null;
      savedCamera = center ? { dayId: options.dayId(), center: center.toArray ? center.toArray() : center, zoom: map.getZoom(), bearing: map.getBearing?.() || 0, pitch: map.getPitch?.() || 0, padding: map.getPadding?.() || 0 } : null;
      returnFocus = document.activeElement; options.explore(); visible = true; panel.hidden = false; document.body.classList.add('places-open');
      if (historyWrite) historyDepth = 0;
      for (const id of ['open-places', 'mobile-open-places']) document.getElementById(id)?.setAttribute('aria-expanded', 'true');
      update(); selectedId ? renderDetail() : renderList(); setExpanded(expanded);
      if (historyWrite) rememberHistory(true);
      requestAnimationFrame(() => { options.map()?.resize(); renderMarkers(); if (!selectedId) fitPlaces(); else focusPlace(current()); });
      if (focus) (selectedId ? $('#places-back-to-list') : $('#places-title')).focus({ preventScroll: true });
    }
    function close({ historyWrite = true, focus = true } = {}) {
      if (!visible) return;
      if (historyWrite && history.state?.atlasPlaces?.open) { history.go(-Math.max(1, history.state.atlasPlaces.depth || 1)); return; }
      if (!selectedId) { if (nearbyIds) nearbyScroll = content.scrollTop; else listScroll = content.scrollTop; }
      if (gallery.open) closeGallery(false); visible = false; historyDepth = 0; panel.hidden = true; document.body.classList.remove('places-open'); closeCluster(); renderMarkers();
      for (const id of ['open-places', 'mobile-open-places']) document.getElementById(id)?.setAttribute('aria-expanded', 'false');
      const map = options.map(); map?.resize();
      if (savedCamera && savedCamera.dayId === options.dayId() && map?.jumpTo) {
        const { dayId, ...camera } = savedCamera; map.jumpTo(camera);
      } else options.restoreMap?.();
      if (focus) { const target = returnFocus?.isConnected && returnFocus.getClientRects().length ? returnFocus : document.getElementById(mobile() ? 'mobile-day-picker' : 'open-places'); target?.focus({ preventScroll: true }); }
    }
    function update(reset = false) {
      const journey = options.journey(); if (!journey) return;
      const changedJourney = journeyId !== journey.id, changedDay = lastDay !== options.dayId();
      if (changedJourney) {
        journeyId = journey.id; selectedId = ''; tab = 'overview'; category = 'all'; query = ''; dayOnly = false; listScroll = 0; nearbyIds = null; nearbyScroll = 0; selectedTabScroll = {}; expanded = false;
        $('#places-search').value = ''; $('#places-day-only').checked = false;
        if (gallery.open) closeGallery(false); closeCluster();
        if (history.state?.atlasPlaces?.open) rememberHistory();
      }
      lastDay = options.dayId(); const count = document.getElementById('place-count'); if (count) count.textContent = String(points().length);
      if (reset) {
        for (const key of memoryDrafts.keys()) if (key.startsWith(`${journeyId}:`)) memoryDrafts.delete(key);
        undo = null; clearTimeout(toastTimer); $('.pp-toast').hidden = true;
        if (visible) selectedId ? renderDetail({ preserveScroll: true }) : renderList();
      }
      if (changedDay && dayOnly) nearbyIds = null;
      if (visible && (changedJourney || (changedDay && dayOnly && !selectedId))) renderList();
      if (visible && (changedJourney || changedDay)) scheduleMarkers();
    }
    function mapReady() {
      const map = options.map(); if (map && map !== markerMap) { markerMap?.off('moveend', scheduleMarkers); markerMap = map; map.on('moveend', scheduleMarkers); }
      if (visible) { scheduleMarkers(); current() ? focusPlace(current()) : fitPlaces(); }
    }
    for (const id of ['open-places', 'mobile-open-places']) document.getElementById(id)?.addEventListener('click', () => open());
    $('#places-title').tabIndex = -1;
    panel.addEventListener('click', event => {
      const target = event.target.closest('button'); if (!target) return;
      if (target.id === 'close-places' || target.id === 'close-place-details' || target.hasAttribute('data-return-journey')) { close(); return; }
      if (target.id === 'places-back-to-list') { history.state?.atlasPlaces?.selectedId && historyDepth > 1 ? history.back() : backToList(); return; }
      if (target.dataset.placeId) { selectPlace(target.dataset.placeId); return; }
      if (target.hasAttribute('data-clear-nearby')) { clearNearby(); return; }
      if (target.dataset.placeFilter) { nearbyIds = null; category = target.dataset.placeFilter; listScroll = 0; renderList(); renderMarkers(); fitPlaces(); rememberHistory(); return; }
      if (target.hasAttribute('data-clear-filters')) { nearbyIds = null; category = 'all'; query = ''; dayOnly = false; $('#places-search').value = ''; $('#places-day-only').checked = false; listScroll = 0; renderList(); renderMarkers(); fitPlaces(); rememberHistory(); $('#places-search').focus(); return; }
      if (target.hasAttribute('data-clear-search')) { nearbyIds = null; query = ''; $('#places-search').value = ''; listScroll = 0; renderList(); renderMarkers(); rememberHistory(); $('#places-search').focus(); return; }
      if (target.id === 'places-fit') { fitPlaces(); return; }
      if (target.dataset.placeTab || target.dataset.showPlaceTab) { changeTab(target.dataset.placeTab || target.dataset.showPlaceTab); return; }
      if (target.hasAttribute('data-place-map')) { setExpanded(false); requestAnimationFrame(() => focusPlace(current())); announce(`${current().name} shown on the map.`); return; }
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
    });
    $('#places-search').addEventListener('input', event => { nearbyIds = null; query = event.target.value; listScroll = 0; renderList(); renderMarkers(); rememberHistory(); });
    $('#places-day-only').addEventListener('change', event => { nearbyIds = null; dayOnly = event.target.checked; listScroll = 0; renderList(); renderMarkers(); fitPlaces(); rememberHistory(); });
    content.addEventListener('scroll', () => { if (!selectedId) { if (nearbyIds) nearbyScroll = content.scrollTop; else listScroll = content.scrollTop; } }, { passive: true });
    panel.addEventListener('keydown', event => {
      const target = event.target.closest('[data-place-tab]');
      if (!target || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault(); const index = tabs.indexOf(target.dataset.placeTab);
      changeTab(tabs[event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length], { scroll: false });
    });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && visible && !document.querySelector('dialog[open]')) { event.preventDefault(); selectedId ? $('#places-back-to-list').click() : close(); } });
    const handle = $('#places-sheet-toggle'); let startY = null, ignoreClick = false;
    handle.addEventListener('click', () => { if (!ignoreClick) setExpanded(!expanded); ignoreClick = false; });
    handle.addEventListener('pointerdown', event => { startY = event.clientY; handle.setPointerCapture(event.pointerId); });
    handle.addEventListener('pointerup', event => { if (startY !== null && Math.abs(event.clientY - startY) > 28) { setExpanded(event.clientY < startY); ignoreClick = true; setTimeout(() => { ignoreClick = false; }, 0); } startY = null; });
    handle.addEventListener('pointercancel', () => { startY = null; });
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
      viewportWidth = root.innerWidth; viewportHeight = root.innerHeight; clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { if (visible && !gallery.open) { options.map()?.resize(); current() ? focusPlace(current()) : fitPlaces(); } }, 180);
    });
    window.addEventListener('popstate', event => {
      const state = event.state?.atlasPlaces, signature = JSON.stringify(state || null); if (signature === lastHistory) return;
      lastHistory = signature; restoring = true; historyDepth = state?.depth || 0;
      if (!state?.open || state.journeyId !== journeyId) close({ historyWrite: false });
      else {
        if (!visible) open({ historyWrite: false, focus: false });
        const nextNearby = Array.isArray(state.nearbyIds) ? state.nearbyIds : null, nearbyChanged = JSON.stringify(nextNearby) !== JSON.stringify(nearbyIds);
        nearbyIds = nextNearby;
        if (state.selectedId !== selectedId) { if (state.selectedId) selectPlace(state.selectedId, true, false); else backToList(false); }
        else if (nearbyChanged && !selectedId) renderList();
        if (state.selectedId && state.tab !== tab) changeTab(state.tab, { historyWrite: false, focus: false });
        if (state.gallery >= 0) openGallery(state.gallery, false); else if (gallery.open) closeGallery(false);
      }
      restoring = false;
    });
    update(); mapReady();
    return { open, close, update, mapReady, showNearby, isOpen: () => visible };
  }
  root.JOURNEY_ATLAS_PLACE_PANEL = { create, searchPlaces, nearbyPlaces, clusterPoints, mapInsets };
})(typeof window === 'undefined' ? globalThis : window);
