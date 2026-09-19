(function (root) {
  'use strict';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const average = reviews => reviews.length ? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1) : null;
  const filterPlaces = (journey, category = 'all', dayId = '') => (journey.pointsOfInterest || []).filter(point => (category === 'all' || point.category === category) && (!dayId || point.dayIds.includes(dayId)));
  const ratingSummary = reviews => ({
    average: average(reviews), count: reviews.length,
    distribution: [5, 4, 3, 2, 1].map(stars => ({ stars, count: reviews.filter(review => review.rating === stars).length }))
  });
  const placeTabs = ['overview', 'reviews', 'photos'];
  function validateComment(name, body) {
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 40) throw new Error('Choose a display name of 1–40 characters.');
    if (typeof body !== 'string' || !body.trim() || body.trim().length > 1000) throw new Error('Write a comment of 1–1,000 characters.');
    return { displayName: name.trim(), body: body.trim() };
  }
  // This is an explicitly local UX simulation. It never calls photo auth or a write API.
  function createDemoStore(storage, key) {
    const empty = () => ({ comments: [], reviews: [] });
    function read() {
      let value;
      try { value = JSON.parse(storage.getItem(key) || 'null'); } catch { return empty(); }
      if (!value || !Array.isArray(value.comments) || !Array.isArray(value.reviews)) return empty();
      return {
        comments: value.comments.slice(0, 500).filter(c => c && typeof c.id === 'string' && typeof c.photoId === 'string' && typeof c.visitorId === 'string' && typeof c.displayName === 'string' && c.displayName.length <= 40 && typeof c.body === 'string' && c.body.length <= 1000 && Number.isFinite(c.createdAt)),
        reviews: value.reviews.slice(0, 200).filter(r => r && typeof r.pointId === 'string' && r.authorId === 'demo-you' && typeof r.authorName === 'string' && r.authorName.length <= 40 && Number.isInteger(r.rating) && r.rating >= 1 && r.rating <= 5 && typeof r.text === 'string' && r.text.length <= 1000)
      };
    }
    function save(data) {
      try { storage.setItem(key, JSON.stringify(data)); } catch { throw new Error('This browser could not save the demo. Your text is still here; enable browser storage and retry.'); }
    }
    return {
      comments: photoId => read().comments.filter(c => c.photoId === photoId),
      reviews: pointId => read().reviews.filter(r => r.pointId === pointId),
      addComment(photoId, visitor, body, id, createdAt = Date.now()) {
        if (!photoId || !visitor?.id) throw new Error('Unlock the demo before commenting.');
        const fields = validateComment(visitor.name, body), data = read();
        if (data.comments.length >= 500) throw new Error('This demo is full. Reset the demo to try again.');
        const comment = { id, photoId, visitorId: visitor.id, ...fields, createdAt };
        data.comments.push(comment); save(data); return comment;
      },
      removeComment(commentId, visitorId) {
        const data = read(), comment = data.comments.find(c => c.id === commentId);
        if (!comment || comment.visitorId !== visitorId) throw new Error('You can only delete your own comments.');
        data.comments = data.comments.filter(c => c.id !== commentId); save(data);
      },
      saveReview(pointId, name, rating, body) {
        const fields = validateComment(name, body);
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new Error('Choose a rating from 1 to 5.');
        const data = read();
        data.reviews = data.reviews.filter(r => r.pointId !== pointId);
        data.reviews.push({ pointId, authorId: 'demo-you', authorName: fields.displayName, rating, text: fields.body }); save(data);
      },
      reset() { save(empty()); }
    };
  }

  function create(options) {
    const $ = selector => document.querySelector(selector);
    const preview = ['places', 'comments'].includes(new URLSearchParams(location.search).get('experience'));
    const panel = $('#places-panel'), list = $('#places-content'), commentsDialog = $('#comments-dialog'), unlockDialog = $('#experience-unlock');
    const assetBase = new URL('.', document.querySelector('script[src*="/places-comments.js"]').src);
    let category = 'all', selectedId = '', placeTab = 'overview', expanded = false, markers = [], open = false, journeyId = '', store, visitor = null, currentPhoto = null, afterUnlock;
    const visitorKey = 'atlas-experience-visitor-v1';
    if (preview) {
      try { const saved = JSON.parse(sessionStorage.getItem(visitorKey)); if (typeof saved?.id === 'string' && typeof saved?.name === 'string' && saved.name.trim() && saved.name.length <= 40) visitor = saved; } catch { /* An unavailable session starts as a new demo visitor. */ }
    }
    const uuid = () => crypto.randomUUID();
    const status = (selector, message = '') => { $(selector).textContent = message; };
    const stars = rating => `<span class="place-stars" aria-label="${rating} out of 5 stars">${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}</span>`;
    const reviewsFor = point => [...(point.reviews || []), ...(preview ? store.reviews(point.id) : [])];
    function renderMarkers() {
      markers.forEach(marker => marker.remove()); markers = [];
      const map = options.map();
      if (!open || !map) return;
      for (const point of filterPlaces(options.journey(), category, $('#places-day-only').checked ? options.dayId() : '')) {
        const button = document.createElement('button');
        button.type = 'button'; button.className = `place-pin ${point.category}${point.id === selectedId ? ' selected' : ''}`;
        button.setAttribute('aria-label', `${point.name} · ${point.category === 'food' ? 'Food & drink' : 'Place of interest'}`);
        button.innerHTML = `<span aria-hidden="true">${point.category === 'food' ? '♨' : '◇'}</span>`;
        button.addEventListener('click', event => { event.stopPropagation(); selectPlace(point.id, false); });
        markers.push(new maplibregl.Marker({ element: button }).setLngLat(point.coordinates).addTo(map));
      }
    }
    function fitPlaces() {
      const points = filterPlaces(options.journey(), category, $('#places-day-only').checked ? options.dayId() : '');
      const map = options.map();
      if (!map || !points.length) return;
      const bounds = points.reduce((bounds, point) => bounds.extend(point.coordinates), new maplibregl.LngLatBounds(points[0].coordinates, points[0].coordinates));
      const mobile = matchMedia('(max-width:900px)').matches;
      const frame = map.getContainer().getBoundingClientRect();
      const bottom = mobile ? Math.max(40, frame.bottom - panel.getBoundingClientRect().top + 30) : (preview ? 110 : 80);
      map.fitBounds(bounds, { padding: { top: mobile ? 105 : 80, bottom, left: 45, right: 45 }, maxZoom: 16, duration: matchMedia('(prefers-reduced-motion:reduce)').matches ? 0 : 700 });
    }
    function selectPlace(id, move = true) {
      selectedId = id; placeTab = 'overview'; renderPlaces(); renderMarkers();
      if (move) {
        const point = options.journey().pointsOfInterest?.find(p => p.id === id);
        if (point) options.map()?.easeTo({ center: point.coordinates, zoom: 15, padding: 0, offset: [0, matchMedia('(max-width:900px)').matches ? -innerHeight * 0.2 : 0], duration: matchMedia('(prefers-reduced-motion:reduce)').matches ? 0 : 600 });
      }
      list.scrollTop = 0; list.querySelector('h3')?.focus({ preventScroll: true });
    }
    const icon = name => {
      const paths = {
        pin: '<path d="M18 10c0 5-6 10-6 10S6 15 6 10a6 6 0 1 1 12 0Z"/><circle cx="12" cy="10" r="2"/>',
        photos: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8" cy="9" r="1.5"/><path d="m3 17 5-5 4 4 3-3 6 5"/>',
        review: '<path d="m4 16 12-12 4 4L8 20H4v-4Z"/><path d="m13 7 4 4"/>',
        link: '<path d="M14 4h6v6M20 4 10 14M10 4H4v16h16v-6"/>',
        day: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18"/>',
        back: '<path d="m12 5-7 7 7 7M5 12h15"/>',
        close: '<path d="m6 6 12 12M18 6 6 18"/>',
        globe: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>'
      };
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.pin}</svg>`;
    };
    const imageUrl = picture => picture.src.startsWith('./assets/') ? new URL(picture.src.slice(9), assetBase).href : picture.src;
    const ratingStars = score => `<span class="place-score-stars" aria-label="${score} out of 5 stars"><span aria-hidden="true">★★★★★</span><span aria-hidden="true" style="width:${Number(score) * 20}%">★★★★★</span></span>`;
    function imageHtml(picture, { hero = false } = {}) {
      if (!picture) return `<div class="place-no-image">${icon('photos')}<span>No photos added yet</span></div>`;
      return `<figure class="place-image${hero ? ' place-hero' : ''}"><img src="${escape(imageUrl(picture))}" alt="${escape(picture.alt)}"/>${hero ? '<button class="place-photo-count" data-show-place-tab="photos" type="button">' + icon('photos') + ' View photos</button>' : ''}<figcaption>${escape(picture.credit)} · <a href="${escape(picture.sourceUrl)}" target="_blank" rel="noopener noreferrer">Source ↗</a></figcaption></figure>`;
    }
    function showPlaceTab(name, { focus = false, scroll = true } = {}) {
      if (!placeTabs.includes(name) || !selectedId) return;
      placeTab = name;
      for (const tab of list.querySelectorAll('[data-place-tab]')) {
        const active = tab.dataset.placeTab === name;
        tab.setAttribute('aria-selected', String(active)); tab.tabIndex = active ? 0 : -1;
        if (active && focus) tab.focus({ preventScroll: true });
      }
      for (const section of list.querySelectorAll('[data-place-tab-panel]')) section.hidden = section.dataset.placeTabPanel !== name;
      if (scroll) list.querySelector('.place-tabs')?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    }
    function reviewHtml(point, reviews) {
      const summary = ratingSummary(reviews), own = preview ? store.reviews(point.id)[0] : null;
      return `<section class="place-reviews"><h4>Review summary</h4><p class="place-sample-note">${point.sample ? 'Sample reviews from our group' : 'Ratings from our traveling group'}</p><div class="place-rating-summary"><div class="place-rating-bars">${summary.distribution.map(row => `<div aria-label="${row.count} ${row.stars}-star reviews"><span>${row.stars}</span><span class="place-rating-track"><i style="width:${summary.count ? row.count / summary.count * 100 : 0}%"></i></span></div>`).join('')}</div><div class="place-score-total"><strong>${summary.average || '—'}</strong>${summary.average ? ratingStars(summary.average) : ''}<span>${summary.count} ${summary.count === 1 ? 'review' : 'reviews'}</span></div></div><p id="place-review-notice" role="status"></p>${preview && point.status === 'visited' ? `<details class="place-review-editor"><summary>${icon('review')} Write a review</summary><form id="place-review-form"><label>Your name<input name="name" maxlength="40" required autocomplete="off" value="${escape(own?.authorName || '')}"/></label><fieldset><legend>Your rating</legend><div class="place-rating-input">${[1, 2, 3, 4, 5].map(n => `<label><input type="radio" name="rating" value="${n}" aria-label="${n} ${n === 1 ? 'star' : 'stars'}" required ${own?.rating === n ? 'checked' : ''}/><span aria-hidden="true">★</span></label>`).join('')}</div></fieldset><label>Your review<textarea name="body" rows="3" maxlength="1000" required placeholder="Share your experience at this place">${escape(own?.text || '')}</textarea></label><p id="place-review-status" role="status"></p><button class="experience-primary">Post demo review</button><small>Only you see this browser’s demo changes.</small></form></details>` : ''}${!reviews.length ? `<p class="place-review-empty">${point.status === 'saved' ? 'Saved for a future visit. No group ratings yet.' : 'No reviews yet. A place for your group’s memories.'}</p>` : ''}${reviews.map(review => `<article><span class="place-review-avatar" aria-hidden="true">${escape(review.authorName.slice(0, 1).toUpperCase())}</span><div class="place-review-copy"><strong>${escape(review.authorName)}</strong><small>Our group${point.sample && review.authorId !== 'demo-you' ? ' · Sample review' : ''}</small>${stars(review.rating)}<p>${escape(review.text)}</p></div></article>`).join('')}</section>`;
    }
    function renderPlaces() {
      const journey = options.journey(), points = filterPlaces(journey, category, $('#places-day-only').checked ? options.dayId() : '');
      const point = points.find(p => p.id === selectedId);
      panel.classList.toggle('place-selected', Boolean(point));
      $('#places-count').textContent = `${points.length} ${points.length === 1 ? 'place' : 'places'}`;
      $('#places-fit').disabled = !points.length;
      for (const button of document.querySelectorAll('[data-place-filter]')) button.setAttribute('aria-pressed', String(button.dataset.placeFilter === category));
      if (!point) {
        selectedId = ''; placeTab = 'overview';
        list.innerHTML = points.length ? points.map(point => {
          const reviews = reviewsFor(point), score = average(reviews), photo = point.images?.[0];
          return `<button class="place-card" data-place-id="${escape(point.id)}"><span class="place-card-copy"><strong>${escape(point.name)}</strong><span class="place-card-rating">${score ? `${score} ${ratingStars(score)} <span>(${reviews.length})</span>` : 'No group ratings yet'}</span><span class="place-card-type">${point.category === 'food' ? 'Food & drink' : 'Place of interest'} · ${point.status === 'visited' ? 'Visited' : 'Saved'}</span><span class="place-card-description">${escape(point.summary)}</span><small>${point.sample ? 'Our group · Sample content' : 'Our group’s places'}</small></span>${photo ? `<span class="place-card-picture"><img src="${escape(imageUrl(photo))}" alt="${escape(photo.alt)}"/><span>${photo.permission === 'illustration' ? 'Illustration' : 'Photo'}</span></span>` : `<span class="place-card-picture place-card-placeholder">${icon('photos')}</span>`}</button>`;
        }).join('') : '<div class="places-empty"><span aria-hidden="true">◇</span><h3>No places here yet</h3><p>Meals and discoveries can be added as the journey takes shape.</p></div>';
        return;
      }
      const reviews = reviewsFor(point), score = average(reviews);
      list.innerHTML = `${imageHtml(point.images?.[0], { hero: true })}<header class="place-identity"><h3 tabindex="-1">${escape(point.name)}</h3><button class="place-rating-link" data-show-place-tab="reviews" type="button">${score ? `${score} ${ratingStars(score)} <span>(${reviews.length})</span>` : 'No ratings yet'}<span>Our group</span></button><p>${point.category === 'food' ? 'Food & drink' : 'Place of interest'} · <span>${point.status === 'visited' ? 'Visited on this trip' : 'Saved for next time'}</span></p>${point.sample ? '<small>Demo place · reviews are fictional</small>' : ''}</header><div class="place-tabs" role="tablist" aria-label="Place details">${placeTabs.map((tab, index) => `<button type="button" id="place-tab-${tab}" role="tab" data-place-tab="${tab}" aria-controls="place-tab-panel-${tab}" aria-selected="${index === 0}" tabindex="${index === 0 ? 0 : -1}">${tab[0].toUpperCase() + tab.slice(1)}</button>`).join('')}</div><div id="place-tab-panel-overview" data-place-tab-panel="overview" role="tabpanel" aria-labelledby="place-tab-overview"><div class="place-quick-actions"><button data-place-map type="button"><span>${icon('pin')}</span>Show on map</button><button data-show-place-tab="reviews" type="button"><span>${icon('review')}</span>Reviews</button><button data-show-place-tab="photos" type="button"><span>${icon('photos')}</span>Photos</button>${point.mapsUrl ? `<a href="${escape(point.mapsUrl)}" target="_blank" rel="noopener noreferrer"><span>${icon('link')}</span>Google Maps</a>` : ''}</div><div class="place-overview-copy"><p>${escape(point.summary)}</p>${point.note ? `<blockquote>${escape(point.note)}</blockquote>` : ''}</div><div class="place-facts">${point.address ? `<div>${icon('pin')}<span>${escape(point.address)}</span></div>` : ''}${point.dayIds.length ? `<div>${icon('day')}<span>${point.dayIds.map(id => { const day = journey.days.find(day => day.id === id); return `Day ${day.number} · ${escape(day.date)}`; }).join('<br/>')}</span></div>` : ''}${point.sources.map(source => `<a href="${escape(source.url)}" target="_blank" rel="noopener noreferrer">${icon('globe')}<span>${escape(source.label)}</span>${icon('link')}</a>`).join('')}</div><p class="place-accuracy">${point.locationAccuracy === 'approximate' ? 'Approximate map position' : 'Reviewed map position'}</p></div><div id="place-tab-panel-reviews" data-place-tab-panel="reviews" role="tabpanel" aria-labelledby="place-tab-reviews" hidden>${reviewHtml(point, reviews)}</div><div id="place-tab-panel-photos" data-place-tab-panel="photos" role="tabpanel" aria-labelledby="place-tab-photos" hidden><div class="place-photo-gallery"><h4>Photos <span>(${point.images?.length || 0})</span></h4>${point.images?.length ? point.images.map(picture => imageHtml(picture)).join('') : imageHtml(null)}</div></div>`;
      showPlaceTab(placeTab, { scroll: false });
      const form = $('#place-review-form');
      form?.addEventListener('submit', event => {
        event.preventDefault(); const data = new FormData(form);
        try {
          store.saveReview(point.id, data.get('name'), Number(data.get('rating')), data.get('body'));
          renderPlaces(); status('#place-review-notice', 'Demo review saved in this browser.');
          $('#place-review-notice').scrollIntoView({ block: 'nearest' });
        } catch (error) { status('#place-review-status', error.message); }
      });
    }
    function setSheetExpanded(value) {
      expanded = value; panel.dataset.expanded = String(value);
      $('#places-sheet-toggle').setAttribute('aria-expanded', String(value));
      $('#places-sheet-toggle').setAttribute('aria-label', value ? 'Show more map' : 'Expand places');
    }
    function openPlaces() {
      options.explore(); open = true; document.body.classList.add('places-open'); panel.hidden = false;
      $('#open-places').setAttribute('aria-expanded', 'true'); setSheetExpanded(false); renderPlaces(); renderMarkers();
      requestAnimationFrame(() => { options.map()?.resize(); fitPlaces(); }); (selectedId ? $('#places-back-to-list') : $('#close-places')).focus();
    }
    function closePlaces() {
      open = false; panel.hidden = true; document.body.classList.remove('places-open'); renderMarkers();
      $('#open-places').setAttribute('aria-expanded', 'false'); options.map()?.resize(); (matchMedia('(max-width:900px)').matches ? $('#mobile-day-picker') : $('#open-places')).focus();
    }
    function openComments() {
      if (!currentPhoto) return;
      if (options.protected(currentPhoto) && !options.unlocked()) { options.unlock(); return; }
      if (!visitor) { showUnlock(() => openComments()); return; }
      renderComments(); document.body.classList.add('comments-open'); commentsDialog.showModal(); $('#close-comments').focus();
    }
    function showUnlock(callback) {
      afterUnlock = callback; $('#experience-unlock-form').reset(); status('#experience-unlock-error');
      $('#experience-display-name').value = visitor?.name || ''; unlockDialog.showModal();
    }
    function renderComments() {
      $('#comments-photo-title').textContent = currentPhoto.caption || currentPhoto.alt || 'This photograph';
      $('#comment-author').textContent = visitor.name;
      const comments = store.comments(currentPhoto.id);
      $('#comments-list').innerHTML = comments.length ? comments.map(comment => `<article class="photo-comment"><span class="comment-avatar" aria-hidden="true">${escape(comment.displayName.slice(0, 1).toUpperCase())}</span><div><header><strong>${escape(comment.displayName)}</strong><time>${new Date(comment.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time></header><p>${escape(comment.body)}</p>${comment.visitorId === visitor.id ? `<button data-delete-comment="${escape(comment.id)}">Delete your comment</button>` : ''}</div></article>`).join('') : '<div class="comments-empty"><span aria-hidden="true">“</span><h3>Be the first to leave a memory.</h3><p>A detail you noticed. A story behind the photo. A hello from home.</p></div>';
      $('#comments-count').textContent = `${comments.length} ${comments.length === 1 ? 'comment' : 'comments'}`;
      $('#photo-comments-count').textContent = String(comments.length);
    }
    function startComments() {
      const photo = currentPhoto || options.photos().find(photo => !options.protected(photo)) || options.photos()[0];
      if (!photo) { status('#experience-status', 'Add a photo to this journey to try comments.'); return; }
      // Real protected media always keeps its own authorization gate.
      if (options.protected(photo)) { options.openPhoto(photo.id); return; }
      const present = () => { options.openPhoto(photo.id); openComments(); };
      if (visitor) present(); else showUnlock(present);
    }
    function update() {
      const journey = options.journey();
      if (journeyId !== journey.id) {
        journeyId = journey.id; selectedId = ''; category = 'all'; $('#places-day-only').checked = false;
        // The getter may itself throw in privacy-restricted browsers.
        let storage; try { storage = localStorage; } catch { storage = { getItem() { return null; }, setItem() { throw new Error('Storage unavailable'); } }; }
        store = createDemoStore(storage, `atlas-experience-v1:${journey.id}`);
        if (commentsDialog.open) commentsDialog.close();
      }
      $('#place-count').textContent = String(journey.pointsOfInterest?.length || 0);
      if (open) { renderPlaces(); renderMarkers(); }
    }
    $('#open-places').addEventListener('click', openPlaces);
    $('#mobile-open-places').addEventListener('click', openPlaces);
    $('#close-places').addEventListener('click', closePlaces);
    $('#close-place-details').addEventListener('click', closePlaces);
    $('#places-back-to-list').addEventListener('click', () => { selectedId = ''; renderPlaces(); renderMarkers(); list.scrollTop = 0; $('#close-places').focus(); });
    $('#places-fit').addEventListener('click', fitPlaces);
    $('#places-day-only').addEventListener('change', () => { selectedId = ''; renderPlaces(); renderMarkers(); fitPlaces(); });
    document.querySelectorAll('[data-place-filter]').forEach(button => button.addEventListener('click', () => { category = button.dataset.placeFilter; selectedId = ''; renderPlaces(); renderMarkers(); fitPlaces(); }));
    list.addEventListener('click', event => {
      const card = event.target.closest('[data-place-id]'); if (card) selectPlace(card.dataset.placeId);
      const tab = event.target.closest('[data-place-tab], [data-show-place-tab]');
      if (tab) showPlaceTab(tab.dataset.placeTab || tab.dataset.showPlaceTab, { focus: true });
      if (event.target.closest('[data-place-map]')) {
        const point = options.journey().pointsOfInterest.find(point => point.id === selectedId);
        setSheetExpanded(false);
        options.map()?.easeTo({ center: point.coordinates, zoom: 16, padding: 0, offset: [0, matchMedia('(max-width:900px)').matches ? -innerHeight * 0.18 : 0], duration: matchMedia('(prefers-reduced-motion:reduce)').matches ? 0 : 500 });
      }
    });
    list.addEventListener('keydown', event => {
      const tab = event.target.closest('[data-place-tab]');
      if (!tab || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const index = placeTabs.indexOf(tab.dataset.placeTab);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? placeTabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + placeTabs.length) % placeTabs.length;
      showPlaceTab(placeTabs[next], { focus: true, scroll: false });
    });
    $('#places-sheet-toggle').addEventListener('click', () => setSheetExpanded(!expanded));
    let sheetTouch = null;
    $('#places-sheet-toggle').addEventListener('pointerdown', event => { sheetTouch = event.clientY; event.currentTarget.setPointerCapture(event.pointerId); });
    $('#places-sheet-toggle').addEventListener('pointerup', event => {
      if (sheetTouch !== null && Math.abs(event.clientY - sheetTouch) > 30) {
        // The following click is suppressed by pointer travel in most browsers;
        // use a one-shot capture listener for the remaining click-producing ones.
        setSheetExpanded(event.clientY < sheetTouch);
        const suppress = click => { click.stopImmediatePropagation(); click.preventDefault(); };
        const handle = event.currentTarget;
        handle.addEventListener('click', suppress, { once: true, capture: true });
        setTimeout(() => handle.removeEventListener('click', suppress, true), 0);
      }
      sheetTouch = null;
    });
    $('#places-sheet-toggle').addEventListener('pointercancel', () => { sheetTouch = null; });
    list.addEventListener('error', event => { if (event.target.tagName === 'IMG') { event.target.hidden = true; event.target.parentElement.classList.add('image-unavailable'); } }, true);
    $('#open-photo-comments').addEventListener('click', openComments);
    $('#close-comments').addEventListener('click', () => commentsDialog.close());
    commentsDialog.addEventListener('close', () => document.body.classList.remove('comments-open'));
    $('#experience-unlock-cancel').addEventListener('click', () => unlockDialog.close());
    $('#experience-unlock-form').addEventListener('submit', event => {
      event.preventDefault();
      const name = $('#experience-display-name').value.trim(), password = $('#experience-password').value;
      if (!name || name.length > 40) { status('#experience-unlock-error', 'Choose a display name of 1–40 characters.'); return; }
      if (password !== 'demo') { status('#experience-unlock-error', 'Use “demo” to try this sample. Your real photo password is not needed.'); return; }
      visitor = { id: visitor?.id || uuid(), name }; $('#experience-password').value = ''; unlockDialog.close(); afterUnlock?.();
      try { sessionStorage.setItem(visitorKey, JSON.stringify(visitor)); } catch { /* In-memory access still works for this page. */ }
    });
    $('#comment-form').addEventListener('submit', event => {
      event.preventDefault();
      try { store.addComment(currentPhoto.id, visitor, $('#comment-body').value, uuid()); $('#comment-body').value = ''; renderComments(); status('#comment-status', 'Saved in this browser.'); } catch (error) { status('#comment-status', error.message); }
    });
    $('#comments-list').addEventListener('click', event => {
      const button = event.target.closest('[data-delete-comment]'); if (!button) return;
      try { store.removeComment(button.dataset.deleteComment, visitor.id); renderComments(); status('#comment-status', 'Comment deleted.'); } catch (error) { status('#comment-status', error.message); }
    });
    $('#comment-change-name').addEventListener('click', () => { commentsDialog.close(); showUnlock(openComments); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && open && !document.querySelector('dialog[open]')) { event.preventDefault(); closePlaces(); } });
    window.addEventListener('atlas-photos-locked', () => { if (commentsDialog.open) commentsDialog.close(); visitor = null; try { sessionStorage.removeItem(visitorKey); } catch {} });
    $('#photo-dialog').addEventListener('close', () => { if (commentsDialog.open) commentsDialog.close(); });
    if (preview) {
      $('#experience-bar').hidden = false;
      $('#experience-places').addEventListener('click', openPlaces);
      $('#experience-comments').addEventListener('click', startComments);
      $('#experience-reset').addEventListener('click', () => {
        try { store.reset(); visitor = null; try { sessionStorage.removeItem(visitorKey); } catch {} if (commentsDialog.open) commentsDialog.close(); renderPlaces(); if (currentPhoto) $('#photo-comments-count').textContent = '0'; status('#experience-status', 'Demo changes cleared.'); } catch (error) { status('#experience-status', error.message); }
      });
      const url = new URL(location.href); url.searchParams.delete('experience'); $('#experience-exit').href = url.href;
    }
    update();
    return {
      update, mapReady() { renderMarkers(); if (open) fitPlaces(); },
      photoChanged(photo) {
        const previousId = currentPhoto?.id;
        currentPhoto = photo && !photo.mimeType ? photo : null;
        $('#open-photo-comments').hidden = !preview || !currentPhoto;
        if (currentPhoto) $('#photo-comments-count').textContent = String(store.comments(currentPhoto.id).length);
        if (previousId !== currentPhoto?.id) {
          if (commentsDialog.open) commentsDialog.close();
          $('#comment-body').value = ''; status('#comment-status');
        }
      },
      start() {
        if (!preview) return;
        if (new URLSearchParams(location.search).get('experience') === 'comments') startComments(); else openPlaces();
      }
    };
  }
  root.JOURNEY_ATLAS_PLACES = { average, ratingSummary, placeTabs, filterPlaces, validateComment, createDemoStore, create };
})(typeof window === 'undefined' ? globalThis : window);
