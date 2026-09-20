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
  // Local persistence is the UX adapter. Shared writes will replace this boundary,
  // without changing the cards, conversations or the existing photo authorization.
  function createDemoStore(storage, key) {
    const empty = () => ({ comments: [], reviews: [], drafts: {} });
    const validComment = c => c && typeof c.id === 'string' && typeof c.photoId === 'string' && typeof c.visitorId === 'string' && typeof c.displayName === 'string' && c.displayName.trim() && c.displayName.length <= 40 && typeof c.body === 'string' && c.body.trim() && c.body.length <= 1000 && Number.isFinite(c.createdAt);
    function read() {
      let value;
      try { value = JSON.parse(storage.getItem(key) || 'null'); } catch { return empty(); }
      if (!value || !Array.isArray(value.comments) || !Array.isArray(value.reviews)) return empty();
      return {
        comments: value.comments.slice(0, 500).filter(validComment),
        reviews: value.reviews.slice(0, 200).filter(r => r && typeof r.pointId === 'string' && r.authorId === 'demo-you' && typeof r.authorName === 'string' && r.authorName.trim() && r.authorName.length <= 40 && Number.isInteger(r.rating) && r.rating >= 1 && r.rating <= 5 && typeof r.text === 'string' && r.text.length <= 1000),
        drafts: value.drafts && typeof value.drafts === 'object' && !Array.isArray(value.drafts) ? value.drafts : {}
      };
    }
    function save(data) {
      try { storage.setItem(key, JSON.stringify(data)); } catch { throw new Error('This browser could not save your changes. Your text is still here. Allow browser storage and try again.'); }
    }
    function owned(data, id, visitorId) {
      const comment = data.comments.find(c => c.id === id);
      if (!comment || !visitorId || comment.visitorId !== visitorId) throw new Error('You can only change your own comments.');
      return comment;
    }
    return {
      comments: photoId => read().comments.filter(c => c.photoId === photoId).sort((a,b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id)),
      reviews: pointId => read().reviews.filter(r => r.pointId === pointId),
      addComment(photoId, visitor, body, id, createdAt = Date.now()) {
        if (!photoId || !visitor?.id) throw new Error('Unlock the demo before commenting.');
        const fields = validateComment(visitor.name, body), data = read();
        if (typeof id !== 'string' || !id || !Number.isFinite(createdAt)) throw new Error('This comment could not be saved. Please try again.');
        const existing = data.comments.find(c => c.id === id);
        if (existing) {
          if (existing.visitorId === visitor.id && existing.photoId === photoId && existing.body === fields.body) return existing;
          throw new Error('This comment could not be saved. Please try again.');
        }
        if (data.comments.length >= 500) throw new Error('This preview is full. Reset it from Preview options to start again.');
        const comment = { id, photoId, visitorId: visitor.id, ...fields, createdAt };
        data.comments.push(comment); save(data); return comment;
      },
      removeComment(commentId, visitorId) {
        const data = read(), comment = owned(data, commentId, visitorId);
        data.comments = data.comments.filter(c => c.id !== commentId); save(data); return comment;
      },
      editComment(commentId, visitorId, body) {
        const data = read(), comment = owned(data, commentId, visitorId);
        const fields = validateComment(comment.displayName, body);
        comment.body = fields.body; comment.editedAt = Date.now(); save(data); return comment;
      },
      restoreComment(comment, visitorId) {
        if (!validComment(comment) || !visitorId || comment.visitorId !== visitorId) throw new Error('You can only restore your own comments.');
        const data = read();
        if (data.comments.some(c => c.id === comment.id)) throw new Error('This comment has already been restored.');
        if (data.comments.length >= 500) throw new Error('This preview is full. Remove another comment before restoring this one.');
        data.comments.push(comment); save(data); return comment;
      },
      saveReview(pointId, name, rating, body = '') {
        if (typeof name !== 'string' || !name.trim() || name.trim().length > 40) throw new Error('Choose a name of 1–40 characters.');
        if (!pointId || !Number.isInteger(rating) || rating < 1 || rating > 5) throw new Error('Choose a rating from 1 to 5.');
        if (typeof body !== 'string' || body.trim().length > 1000) throw new Error('Keep your review to 1,000 characters.');
        const data = read();
        data.reviews = data.reviews.filter(r => r.pointId !== pointId);
        if (data.reviews.length >= 200) throw new Error('This preview is full. Reset it from Preview options to start again.');
        const review = { pointId, authorId: 'demo-you', authorName: name.trim(), rating, text: body.trim() };
        data.reviews.push(review); save(data); return review;
      },
      removeReview(pointId) {
        const data = read(), review = data.reviews.find(r => r.pointId === pointId);
        data.reviews = data.reviews.filter(r => r.pointId !== pointId); save(data); return review;
      },
      draft(id, value) {
        const data = read();
        if (typeof id !== 'string' || !id || ['__proto__','constructor','prototype'].includes(id)) throw new Error('Invalid draft.');
        if (value === undefined) return Object.hasOwn(data.drafts, id) ? data.drafts[id] : null;
        if (value === null) delete data.drafts[id];
        else {
          const serialized = JSON.stringify(value);
          if (!serialized || serialized.length > 32768) throw new Error('This draft is too long to save.');
          if (!Object.hasOwn(data.drafts, id) && Object.keys(data.drafts).length >= 300) throw new Error('This preview has too many unfinished drafts.');
          data.drafts[id] = JSON.parse(serialized);
        }
        save(data); return value;
      },
      reset() { save(empty()); }
    };
  }

  function create(options) {
    const preview = ['places', 'comments'].includes(new URLSearchParams(location.search).get('experience'));
    let journeyId = '', store;
    function selectStore() {
      const id = options.journey().id;
      if (journeyId === id) return;
      journeyId = id;
      let storage;
      try { storage = localStorage; } catch { storage = { getItem() { return null; }, setItem() { throw new Error('Storage unavailable'); } }; }
      store = createDemoStore(storage, `atlas-experience-v1:${id}`);
    }
    selectStore();
    const shared = { ...options, preview, store: () => store };
    const places = root.JOURNEY_ATLAS_PLACE_PANEL.create(shared);
    const comments = root.JOURNEY_ATLAS_PHOTO_COMMENTS.create({ ...shared, onPlaces: () => places.open(), onReset: () => places.update(true) });
    function update() { selectStore(); places.update(); comments.update(); }
    update();
    return {
      update, isOpen: () => places.isOpen(), mapReady: () => places.mapReady(), photoChanged: photo => comments.photoChanged(photo),
      restoreOverlay: id => comments.restore?.(id),
      start() { comments.start(); if (preview && new URLSearchParams(location.search).get('experience') === 'places') places.open(); }
    };
  }
  root.JOURNEY_ATLAS_PLACES = { escape, average, ratingSummary, placeTabs, filterPlaces, validateComment, createDemoStore, create };
})(typeof window === 'undefined' ? globalThis : window);
