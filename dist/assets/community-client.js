(function (root) {
  'use strict';
  // Cache contains authorized responses only, never persisted comment text from others.
  // Drafts and stable retry IDs remain local; server authorship always wins.
  function createStore({ request, drafts }) {
    const pages = new Map(), revisions = new Map(), pending = new Map();
    const COMMENT_FRESH_MS = 30000, PROFILE_FRESH_MS = 300000;
    let epoch = 0, profileRevision = 0, profilePending = null, profileAt = 0;
    const invalidate = photo => revisions.set(photo, (revisions.get(photo) || 0) + 1);
    let visitor = null;
    const profile = async ({ force = false } = {}) => {
      if (!force && visitor && Date.now() - profileAt < PROFILE_FRESH_MS) return visitor;
      if (profilePending) return profilePending;
      const generation = epoch, revision = profileRevision;
      const task = (async () => {
        const result = await request('/community/profile');
        if (generation !== epoch || revision !== profileRevision) return null;
        visitor = { id: result.identity, name: result.name }; profileAt = Date.now(); return visitor;
      })();
      profilePending = task;
      try { return await task; } finally { if (profilePending === task) profilePending = null; }
    };
    const normalize = row => ({ ...row, visitorId: row.own ? visitor?.id : null });
    const base = (journey, photo) => `/community/journeys/${encodeURIComponent(journey)}/photos/${encodeURIComponent(photo)}/comments`;
    const patch = comment => {
      invalidate(comment.photoId);
      const page = pages.get(comment.photoId) || { comments: [], next: null };
      page.comments = [...page.comments.filter(row => row.id !== comment.id), normalize(comment)].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
      pages.set(comment.photoId, page);
      return normalize(comment);
    };
    return {
      identity: {
        get: () => visitor, allowed: () => Boolean(visitor?.name), lock() { epoch++; profileRevision++; visitor = null; profileAt = 0; profilePending = null; pages.clear(); pending.clear(); for (const photo of revisions.keys()) invalidate(photo); },
        async save(name) { const generation = epoch, revision = ++profileRevision; profilePending = null; const result = await request('/community/profile', { method: 'PATCH', body: { name } }); if (generation !== epoch || revision !== profileRevision) throw new Error('Photo access changed. Try again.'); visitor = { id: result.identity, name: result.name }; profileAt = Date.now(); return { visitor, persistent: true }; }
      },
      profile,
      comments: photo => (pages.get(photo)?.comments || []).map(normalize),
      hasLoaded: photo => pages.has(photo),
      fresh: photo => Boolean(pages.get(photo)?.fetchedAt && Date.now() - pages.get(photo).fetchedAt < COMMENT_FRESH_MS),
      hasMore: photo => Boolean(pages.get(photo)?.next),
      async refresh(journey, photo, more = false, force = false) {
        const previous = pages.get(photo), after = more ? previous?.next : '';
        if (more && !after) return;
        if (!more && !force && previous?.fetchedAt && Date.now() - previous.fetchedAt < COMMENT_FRESH_MS) return;
        const key = `${journey}:${photo}:${after || ''}`, existing = pending.get(key);
        if (existing && existing.revision === revisions.get(photo)) return existing.task;
        invalidate(photo); const revision = revisions.get(photo), generation = epoch;
        const task = (async () => {
          const result = await request(base(journey, photo) + (after ? `?after=${encodeURIComponent(after)}` : ''));
          if (generation !== epoch || revisions.get(photo) !== revision) return;
          const rows = [...(more ? previous.comments : []), ...result.comments];
          pages.set(photo, { comments: [...new Map(rows.map(row => [row.id, row])).values()], next: result.next, fetchedAt: Date.now() });
        })();
        pending.set(key, { revision, task });
        try { await task; } finally { if (pending.get(key)?.task === task) pending.delete(key); }
      },
      draft: (key, value) => drafts.draft(key, value),
      async addComment(photo, _visitor, body, _id, journey) {
        const key = `retry:${photo}`, prior = drafts.draft(key);
        const retry = prior?.body === body ? prior : { body, id: root.crypto.randomUUID() };
        // A failed local write must prevent sending: otherwise reload could duplicate.
        drafts.draft(key, retry);
        const result = await request(base(journey, photo), { method: 'POST', body: { body, clientRequestId: retry.id } });
        // Confirmed responses complete this logical submission. Uncertain requests keep the ID.
        try { drafts.draft(key, null); } catch { /* Retaining the confirmed ID cannot duplicate a write. */ }
        return patch(result.comment);
      },
      async removeComment(id, _visitor, photo) {
        const result = await request(`/community/comments/${encodeURIComponent(id)}`, { method: 'DELETE' });
        invalidate(photo); const page = pages.get(photo); if (page) page.comments = page.comments.filter(row => row.id !== id);
        return normalize(result.comment);
      },
      async editComment(id, _visitor, body) { return patch((await request(`/community/comments/${encodeURIComponent(id)}`, { method: 'PATCH', body: { body } })).comment); },
      async restoreComment(comment) { return patch((await request(`/community/comments/${encodeURIComponent(comment.id)}/restore`, { method: 'POST', body: {} })).comment); }
    };
  }
  root.JOURNEY_ATLAS_COMMUNITY = { createStore };
})(typeof window === 'undefined' ? globalThis : window);
