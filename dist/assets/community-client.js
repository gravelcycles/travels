(function (root) {
  'use strict';
  // Cache contains authorized responses only, never persisted comment text from others.
  // Drafts and stable retry IDs remain local; server authorship always wins.
  function createStore({ request, drafts }) {
    const pages = new Map(), revisions = new Map();
    const invalidate = photo => revisions.set(photo, (revisions.get(photo) || 0) + 1);
    let visitor = null;
    const profile = async () => { const result = await request('/community/profile'); visitor = { id: result.identity, name: result.name }; return visitor; };
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
        get: () => visitor, allowed: () => Boolean(visitor?.name), lock() { visitor = null; pages.clear(); for (const photo of revisions.keys()) invalidate(photo); },
        async save(name) { const result = await request('/community/profile', { method: 'PATCH', body: { name } }); visitor = { id: result.identity, name: result.name }; return { visitor, persistent: true }; }
      },
      profile,
      comments: photo => pages.get(photo)?.comments || [],
      hasMore: photo => Boolean(pages.get(photo)?.next),
      async refresh(journey, photo, more = false) {
        const previous = pages.get(photo), after = more ? previous?.next : '';
        if (more && !after) return;
        invalidate(photo); const revision = revisions.get(photo);
        const result = await request(base(journey, photo) + (after ? `?after=${encodeURIComponent(after)}` : ''));
        if (revisions.get(photo) !== revision) return;
        const rows = [...(more ? previous.comments : []), ...result.comments.map(normalize)];
        pages.set(photo, { comments: [...new Map(rows.map(row => [row.id, row])).values()], next: result.next });
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
