(function (root) {
  'use strict';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const average = reviews => reviews.length ? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1) : null;
  const filterPlaces = (journey, category = 'all', dayId = '') => (journey.pointsOfInterest || []).filter(point => (category === 'all' || point.category === category) && (!dayId || point.dayIds.includes(dayId)));
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
    let category = 'all', selectedId = '', imageIndex = 0, markers = [], open = false, journeyId = '', store, visitor = null, currentPhoto = null, afterUnlock;
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
      map.fitBounds(bounds, { padding: { top: mobile ? 105 : 80, bottom: mobile ? map.getContainer().clientHeight * 0.5 + 10 : 80, left: 45, right: 45 }, maxZoom: 16, duration: matchMedia('(prefers-reduced-motion:reduce)').matches ? 0 : 700 });
    }
    function selectPlace(id, move = true) {
      selectedId = id; imageIndex = 0; renderPlaces(); renderMarkers();
      if (move) {
        const point = options.journey().pointsOfInterest?.find(p => p.id === id);
        if (point) options.map()?.easeTo({ center: point.coordinates, zoom: 15, offset: [0, matchMedia('(max-width:900px)').matches ? -innerHeight * 0.2 : 0], duration: matchMedia('(prefers-reduced-motion:reduce)').matches ? 0 : 600 });
      }
      list.scrollTop = 0; list.querySelector('h3')?.focus({ preventScroll: true });
    }
    function imageHtml(point) {
      const picture = point.images?.[imageIndex];
      if (!picture) return '<div class="place-no-image">A place worth remembering<span>No photos added yet</span></div>';
      const src = picture.src.startsWith('./assets/') ? new URL(picture.src.slice(9), assetBase).href : picture.src;
      return `<figure class="place-image"><img src="${escape(src)}" alt="${escape(picture.alt)}"/><figcaption>${escape(picture.credit)} · <a href="${escape(picture.sourceUrl)}" target="_blank" rel="noopener noreferrer">Source ↗</a></figcaption></figure>${point.images.length > 1 ? `<div class="place-image-nav"><button data-image-step="-1" aria-label="Previous place image">←</button><span>${imageIndex + 1} / ${point.images.length}</span><button data-image-step="1" aria-label="Next place image">→</button></div>` : ''}`;
    }
    function renderPlaces() {
      const journey = options.journey(), points = filterPlaces(journey, category, $('#places-day-only').checked ? options.dayId() : '');
      const point = points.find(p => p.id === selectedId);
      $('#places-count').textContent = `${points.length} ${points.length === 1 ? 'place' : 'places'}`;
      $('#places-fit').disabled = !points.length;
      for (const button of document.querySelectorAll('[data-place-filter]')) button.setAttribute('aria-pressed', String(button.dataset.placeFilter === category));
      if (!point) {
        selectedId = '';
        list.innerHTML = points.length ? `<p class="places-intro">The meals, small discoveries and detours we want to remember.</p>${points.map(point => {
          const reviews = reviewsFor(point), score = average(reviews);
          return `<button class="place-card" data-place-id="${escape(point.id)}"><span class="place-card-category ${point.category}">${point.category === 'food' ? 'FOOD & DRINK' : 'WORTH A STOP'}${point.sample ? ' · SAMPLE' : ''}</span><strong>${escape(point.name)}</strong><span>${escape(point.summary)}</span><span class="place-card-bottom">${score ? `<b>★ ${score}</b> Our group · ${reviews.length}` : point.status === 'saved' ? '♡ Saved for next time' : 'No group reviews yet'}<span aria-hidden="true">↗</span></span></button>`;
        }).join('')}` : '<div class="places-empty"><span aria-hidden="true">◇</span><h3>No places here yet</h3><p>Meals and discoveries can be added as the journey takes shape.</p></div>';
        return;
      }
      const reviews = reviewsFor(point), score = average(reviews);
      list.innerHTML = `<button class="places-back" data-place-back>← All places</button>${imageHtml(point)}<div class="place-detail"><span class="place-card-category ${point.category}">${point.category === 'food' ? 'FOOD & DRINK' : 'WORTH A STOP'}${point.sample ? ' · SAMPLE' : ''}</span><h3 tabindex="-1">${escape(point.name)}</h3><p>${escape(point.summary)}</p>${point.address ? `<p class="place-address">${escape(point.address)}</p>` : ''}<div class="place-day-chips">${point.dayIds.map(id => { const day = journey.days.find(day => day.id === id); return `<span>Day ${day.number} · ${escape(day.date)}</span>`; }).join('')}<span>${point.status === 'visited' ? 'Visited' : 'Saved for next time'}</span></div>${point.note ? `<blockquote>${escape(point.note)}</blockquote>` : ''}<div class="place-links">${point.mapsUrl ? `<a target="_blank" rel="noopener noreferrer" href="${escape(point.mapsUrl)}">Open in Maps ↗</a>` : ''}${point.sources.map(source => `<a target="_blank" rel="noopener noreferrer" href="${escape(source.url)}">${escape(source.label)} ↗</a>`).join('')}</div><small class="place-accuracy">${point.locationAccuracy === 'approximate' ? 'Approximate map position' : 'Reviewed map position'}</small><section class="place-reviews"><header><div><span class="place-card-category">OUR GROUP</span><h4>${score ? `<b>${score}</b> <span aria-hidden="true">★</span>` : 'No ratings yet'}</h4></div><span>${reviews.length} ${reviews.length === 1 ? 'review' : 'reviews'}</span></header>${point.sample ? '<p class="place-sample-note">Invented reviews for this UX demo.</p>' : ''}${reviews.map(review => `<article><div><strong>${escape(review.authorName)}</strong>${stars(review.rating)}</div><p>${escape(review.text)}</p></article>`).join('')}${preview && point.status === 'visited' ? `<details class="place-review-editor"><summary>Try a group review</summary><form id="place-review-form"><label>Your name<input name="name" maxlength="40" required autocomplete="off" value="${escape(store.reviews(point.id)[0]?.authorName || '')}"/></label><fieldset><legend>Your rating</legend><div class="place-rating-input">${[1, 2, 3, 4, 5].map(n => `<label><input type="radio" name="rating" value="${n}" required ${store.reviews(point.id)[0]?.rating === n ? 'checked' : ''}/><span>${n} ★</span></label>`).join('')}</div></fieldset><label>Your review<textarea name="body" rows="3" maxlength="1000" required>${escape(store.reviews(point.id)[0]?.text || '')}</textarea></label><p id="place-review-status" role="status"></p><button class="experience-primary">Save demo review</button><small>Only you see this browser’s demo changes.</small></form></details>` : ''}</section></div>`;
      const form = $('#place-review-form');
      form?.addEventListener('submit', event => {
        event.preventDefault(); const data = new FormData(form);
        try { store.saveReview(point.id, data.get('name'), Number(data.get('rating')), data.get('body')); renderPlaces(); $('#places-message').textContent = 'Demo review saved in this browser.'; } catch (error) { status('#place-review-status', error.message); }
      });
    }
    function openPlaces() {
      options.explore(); open = true; document.body.classList.add('places-open'); panel.hidden = false;
      $('#open-places').setAttribute('aria-expanded', 'true'); renderPlaces(); renderMarkers();
      requestAnimationFrame(() => { options.map()?.resize(); fitPlaces(); }); $('#close-places').focus();
    }
    function closePlaces() {
      open = false; panel.hidden = true; document.body.classList.remove('places-open'); renderMarkers();
      $('#open-places').setAttribute('aria-expanded', 'false'); options.map()?.resize(); $('#open-places').focus();
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
    $('#places-fit').addEventListener('click', fitPlaces);
    $('#places-day-only').addEventListener('change', () => { selectedId = ''; renderPlaces(); renderMarkers(); fitPlaces(); });
    document.querySelectorAll('[data-place-filter]').forEach(button => button.addEventListener('click', () => { category = button.dataset.placeFilter; selectedId = ''; renderPlaces(); renderMarkers(); fitPlaces(); }));
    list.addEventListener('click', event => {
      const card = event.target.closest('[data-place-id]'); if (card) selectPlace(card.dataset.placeId);
      if (event.target.closest('[data-place-back]')) { selectedId = ''; renderPlaces(); renderMarkers(); }
      const step = event.target.closest('[data-image-step]');
      if (step) { const point = options.journey().pointsOfInterest.find(point => point.id === selectedId); imageIndex = (imageIndex + Number(step.dataset.imageStep) + point.images.length) % point.images.length; renderPlaces(); }
    });
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
  root.JOURNEY_ATLAS_PLACES = { average, filterPlaces, validateComment, createDemoStore, create };
})(typeof window === 'undefined' ? globalThis : window);
