(function (root) {
  'use strict';
  // Authorized bodies stay in memory. Only drafts/retry IDs and separate read IDs persist.
  function createStore({ request, drafts, readState, journeyId = '' }) {
    const notifications = root.JOURNEY_ATLAS_COMMENT_NOTIFICATIONS;
    const ownsReadState = !readState;
    readState ||= notifications.createReadState({ journeyId, eventTarget: null });
    const pages = new Map(), included = new Map(), includedRevisions = new Map(), revisions = new Map(), pending = new Map(), listeners = new Set();
    const COMMENT_FRESH_MS = 30000, PROFILE_FRESH_MS = 300000;
    let epoch = 0, profileRevision = 0, profilePending = null, profileAt = null, visitor = null, destroyed = false;
    let activeJourney = journeyId, notificationRevision = 0, summaryRows = new Map(), summaryLoaded = false, summaryAt = null, summaryPending = null, summaryView = null;
    let recent = { comments: [], next: null, loaded: false, fetchedAt: null, bodyRevision: 0 }, recentRevision = 0, bodyRevision = 0;
    const recentPending = new Map();
    const emit = (type, photoId) => { for (const listener of listeners) listener({ type, photoId }); };
    const unsubscribeRead = readState.subscribe(() => { summaryView = null; emit('read'); });
    const freshAt = (at, ttl = COMMENT_FRESH_MS) => at !== null && Date.now() - at < ttl;
    const invalidate = photo => revisions.set(photo, (revisions.get(photo) || 0) + 1);
    const assertActive = journey => {
      if (destroyed) throw new Error('This journey is no longer active.');
      if (journey && activeJourney && journey !== activeJourney) throw new Error('This journey changed. Try again.');
      if (journey) activeJourney = journey;
    };
    const assertEpoch = generation => { if (generation !== epoch || destroyed) throw new Error('Photo access changed. Try again.'); };
    const normalize = row => ({ ...row, visitorId: row.own ? visitor?.id : null });
    const base = (journey, photo) => `/community/journeys/${encodeURIComponent(journey)}/photos/${encodeURIComponent(photo)}/comments`;
    const tripBase = journey => `/community/journeys/${encodeURIComponent(journey)}/comments`;
    const merged = rows => [...new Map(rows.map(row => [row.id, row])).values()];
    function invalidateNotifications() {
      notificationRevision++; recentRevision++; summaryAt = null; recent.fetchedAt = null; summaryView = null;
    }
    function clear() {
      epoch++; profileRevision++; visitor = null; profileAt = null; profilePending = null;
      pages.clear(); included.clear(); includedRevisions.clear(); pending.clear(); revisions.clear();
      invalidateNotifications(); summaryRows = new Map(); summaryLoaded = false; summaryPending = null;
      recent = { comments: [], next: null, loaded: false, fetchedAt: null, bodyRevision: ++bodyRevision }; recentPending.clear();
      emit('lock');
    }
    function include(comment) {
      if (!comment?.id || !comment.photoId) return;
      assertActive(comment.journeyId);
      const extras = included.get(comment.photoId) || new Map();
      extras.set(comment.id, comment); included.set(comment.photoId, extras); includedRevisions.set(comment.id, ++bodyRevision);
    }
    function patch(comment, markOwnRead = false) {
      include(comment); invalidate(comment.photoId);
      const page = pages.get(comment.photoId);
      if (page) {
        page.comments = page.comments.map(row => row.id === comment.id ? comment : row);
        page.fetchedAt = null;
      }
      invalidateNotifications();
      if (summaryLoaded) summaryRows.set(comment.id, { id: comment.id, photoId: comment.photoId, createdAt: comment.createdAt });
      if (recent.loaded) { recent.comments = merged([...recent.comments, comment]).sort(notifications.newestFirst); recent.bodyRevision = ++bodyRevision; }
      if (markOwnRead) readState.markRead([comment.id]);
      emit('mutation', comment.photoId);
      return normalize(comment);
    }
    const profile = async ({ force = false } = {}) => {
      assertActive();
      if (!force && visitor && freshAt(profileAt, PROFILE_FRESH_MS)) return visitor;
      if (profilePending) return profilePending;
      const generation = epoch, revision = profileRevision;
      const task = (async () => {
        const result = await request('/community/profile');
        if (generation !== epoch || revision !== profileRevision || destroyed) return null;
        visitor = { id: result.identity, name: result.name }; profileAt = Date.now(); emit('identity'); return visitor;
      })();
      profilePending = task;
      try { return await task; } finally { if (profilePending === task) profilePending = null; }
    };
    return {
      readState,
      identity: {
        get: () => visitor, allowed: () => Boolean(visitor?.name), lock: clear,
        async save(name) {
          assertActive(); const generation = epoch, revision = ++profileRevision; profilePending = null;
          const result = await request('/community/profile', { method: 'PATCH', body: { name } });
          assertEpoch(generation); if (revision !== profileRevision) throw new Error('Photo access changed. Try again.');
          visitor = { id: result.identity, name: result.name }; profileAt = Date.now(); emit('identity'); return { visitor, persistent: true };
        }
      },
      profile,
      subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
      destroy() { destroyed = true; clear(); unsubscribeRead(); if (ownsReadState) readState.destroy(); listeners.clear(); },
      comments: photo => merged([...(pages.get(photo)?.comments || []), ...(included.get(photo)?.values() || [])]).sort(notifications.oldestFirst).map(normalize),
      hasLoaded: photo => Boolean(pages.get(photo)?.loaded),
      fresh: photo => Boolean(pages.get(photo) && freshAt(pages.get(photo).fetchedAt)),
      hasMore: photo => Boolean(pages.get(photo)?.next),
      includeComment(comment) { if (!destroyed) { include(comment); emit('comments', comment.photoId); } },
      markRead(comments) { return !destroyed && readState.markRead(comments); },
      notificationSummary() {
        if (!summaryView) summaryView = { ...notifications.summarize(summaryRows.values(), readState), loaded: summaryLoaded };
        return summaryView;
      },
      async refreshSummary(journey, { force = false } = {}) {
        assertActive(journey);
        if (!force && summaryLoaded && freshAt(summaryAt)) return;
        if (summaryPending?.revision === notificationRevision) return summaryPending.task;
        const revision = notificationRevision, generation = epoch, priorBodies = bodyRevision;
        const task = (async () => {
          const rows = new Map(), cursors = new Set(); let after = '';
          do {
            const result = await request(`${tripBase(journey)}/summary${after ? `?after=${encodeURIComponent(after)}` : ''}`);
            if (generation !== epoch || revision !== notificationRevision || destroyed) return;
            if (!Array.isArray(result.comments)) throw new Error('Could not load comment counts. Try again.');
            for (const row of result.comments) {
              if (!row?.id || !row.photoId || !Number.isFinite(row.createdAt)) throw new Error('Could not load comment counts. Try again.');
              rows.set(row.id, { id: row.id, photoId: row.photoId, createdAt: row.createdAt });
            }
            after = result.next || '';
            if (after && (typeof after !== 'string' || cursors.has(after))) throw new Error('Could not load comment counts. Try again.');
            if (after) cursors.add(after);
          } while (after);
          // Never expose incomplete totals after a partial page failure.
          summaryRows = rows; summaryLoaded = true; summaryAt = Date.now(); summaryView = null;
          // A snapshot started earlier must not erase comments obtained from a
          // later feed/photo read (another visitor may have just posted them).
          for (const page of pages.values()) if (page.bodyRevision <= priorBodies) page.comments = page.comments.filter(row => rows.has(row.id));
          for (const extras of included.values()) for (const id of extras.keys()) if (includedRevisions.get(id) <= priorBodies && !rows.has(id)) { extras.delete(id); includedRevisions.delete(id); }
          if (recent.bodyRevision <= priorBodies) recent.comments = recent.comments.filter(row => rows.has(row.id));
          emit('summary');
        })();
        summaryPending = { revision, task };
        try { await task; } finally { if (summaryPending?.task === task) summaryPending = null; }
      },
      recentComments: () => recent.comments.map(normalize),
      hasRecent: () => recent.loaded,
      hasMoreRecent: () => Boolean(recent.next),
      async refreshRecent(journey, { more = false, force = false } = {}) {
        assertActive(journey);
        const head = recentPending.get('');
        if (more && head?.revision === recentRevision) {
          const generation = epoch; await head.task;
          if (generation !== epoch || destroyed) return;
        }
        const before = more ? recent.next : '';
        if (more && !before || !more && !force && recent.loaded && freshAt(recent.fetchedAt)) return;
        const key = before || '', existing = recentPending.get(key);
        if (existing?.revision === recentRevision) return existing.task;
        if (!more) recentRevision++;
        const revision = recentRevision, generation = epoch, previous = recent.comments, headFetchedAt = recent.fetchedAt;
        const task = (async () => {
          const result = await request(`${tripBase(journey)}${before ? `?before=${encodeURIComponent(before)}` : ''}`);
          if (generation !== epoch || revision !== recentRevision || destroyed) return;
          if (!Array.isArray(result.comments)) throw new Error('Could not load recent comments. Try again.');
          recent = { comments: merged([...(more ? previous : []), ...result.comments]).sort(notifications.newestFirst), next: result.next || null, loaded: true, fetchedAt: more ? headFetchedAt : Date.now(), bodyRevision: ++bodyRevision };
          emit('recent');
        })();
        recentPending.set(key, { revision, task });
        try { await task; } finally { if (recentPending.get(key)?.task === task) recentPending.delete(key); }
      },
      async refresh(journey, photo, more = false, force = false) {
        assertActive(journey);
        const previous = pages.get(photo), after = more ? previous?.next : '';
        if (more && !after) return;
        if (!more && !force && previous && freshAt(previous.fetchedAt)) return;
        const key = `${journey}:${photo}:${after || ''}`, existing = pending.get(key);
        if (existing && existing.revision === revisions.get(photo)) return existing.task;
        invalidate(photo); const revision = revisions.get(photo), generation = epoch;
        const task = (async () => {
          const result = await request(base(journey, photo) + (after ? `?after=${encodeURIComponent(after)}` : ''));
          if (generation !== epoch || revisions.get(photo) !== revision || destroyed) return;
          const rows = merged([...(more ? previous.comments : []), ...result.comments]);
          pages.set(photo, { comments: rows, next: result.next, fetchedAt: more ? previous.fetchedAt : Date.now(), loaded: true, bodyRevision: ++bodyRevision });
          const extras = included.get(photo); if (extras) for (const row of result.comments) { extras.delete(row.id); includedRevisions.delete(row.id); }
          emit('comments', photo);
        })();
        pending.set(key, { revision, task });
        try { await task; } finally { if (pending.get(key)?.task === task) pending.delete(key); }
      },
      draft: (key, value) => drafts.draft(key, value),
      async addComment(photo, _visitor, body, _id, journey) {
        assertActive(journey); const generation = epoch;
        const key = `retry:${photo}`, prior = drafts.draft(key);
        const retry = prior?.body === body ? prior : { body, id: root.crypto.randomUUID() };
        // Persist before sending, so a failed reload retry cannot duplicate a post.
        drafts.draft(key, retry);
        const result = await request(base(journey, photo), { method: 'POST', body: { body, clientRequestId: retry.id } });
        assertEpoch(generation);
        try { drafts.draft(key, null); } catch { /* Retaining a confirmed ID cannot duplicate a write. */ }
        return patch(result.comment, true);
      },
      async removeComment(id, _visitor, photo) {
        assertActive(); const generation = epoch;
        const result = await request(`/community/comments/${encodeURIComponent(id)}`, { method: 'DELETE' });
        assertEpoch(generation); photo ||= result.comment.photoId; invalidate(photo); invalidateNotifications();
        const page = pages.get(photo); if (page) { page.comments = page.comments.filter(row => row.id !== id); page.fetchedAt = null; }
        included.get(photo)?.delete(id); includedRevisions.delete(id); summaryRows.delete(id); recent.comments = recent.comments.filter(row => row.id !== id);
        emit('mutation', photo); return normalize(result.comment);
      },
      async editComment(id, _visitor, body) {
        assertActive(); const generation = epoch;
        const result = await request(`/community/comments/${encodeURIComponent(id)}`, { method: 'PATCH', body: { body } });
        assertEpoch(generation); return patch(result.comment);
      },
      async restoreComment(comment) {
        assertActive(); const generation = epoch;
        const result = await request(`/community/comments/${encodeURIComponent(comment.id)}/restore`, { method: 'POST', body: {} });
        assertEpoch(generation); return patch(result.comment);
      }
    };
  }
  root.JOURNEY_ATLAS_COMMUNITY = { createStore };
})(typeof window === 'undefined' ? globalThis : window);
