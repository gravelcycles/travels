(function (root) {
  'use strict';
  const validId = id => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,180}$/.test(id);
  // Match SQLite's binary cursor ordering, including case and punctuation.
  const oldestFirst = (a, b) => a.createdAt - b.createdAt || (a.id > b.id ? 1 : a.id < b.id ? -1 : 0);
  const newestFirst = (a, b) => oldestFirst(b, a);

  function createReadState({ storage, journeyId = '', eventTarget = root } = {}) {
    const key = `atlas-comment-read-v1:${encodeURIComponent(journeyId)}`, listeners = new Set();
    let ids = new Set(), persistent = Boolean(storage && journeyId), destroyed = false;
    function parse(raw) {
      if (!raw) return new Set();
      try {
        const value = JSON.parse(raw);
        return value?.version === 1 && Array.isArray(value.read) ? new Set(value.read.filter(validId)) : null;
      } catch { return null; }
    }
    function stored() {
      try { return storage && journeyId ? parse(storage.getItem(key)) : null; }
      catch { persistent = false; return null; }
    }
    function merge(incoming) {
      let changed = false;
      for (const id of incoming || []) if (!ids.has(id)) { ids.add(id); changed = true; }
      return changed;
    }
    function emit() { for (const listener of listeners) listener(); }
    function save() {
      // Merge first so independent tabs cannot replace one another's read IDs.
      merge(stored());
      try {
        if (!storage || !journeyId) throw new Error('Storage unavailable');
        storage.setItem(key, JSON.stringify({ version: 1, read: [...ids].sort() }));
        persistent = true;
      } catch { persistent = false; }
    }
    merge(stored());
    function onStorage(event) {
      if (destroyed || event.storageArea && event.storageArea !== storage || event.key !== null && event.key !== key) return;
      if (event.key === null || event.newValue === null) {
        if (ids.size) { ids.clear(); emit(); }
        return;
      }
      const incoming = parse(event.newValue);
      if (!incoming) return; // A corrupt write does not erase this page's read state.
      const changed = merge(incoming);
      if ([...ids].some(id => !incoming.has(id))) save();
      if (changed) emit();
    }
    eventTarget?.addEventListener?.('storage', onStorage);
    return {
      isRead: id => ids.has(id),
      markRead(comments = []) {
        if (destroyed) return false;
        const rows = typeof comments === 'string' ? [comments] : comments;
        const changed = merge([...rows].map(row => typeof row === 'string' ? row : row?.id).filter(validId));
        if (changed) { save(); emit(); }
        return changed;
      },
      persistent: () => persistent,
      subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
      destroy() { destroyed = true; listeners.clear(); eventTarget?.removeEventListener?.('storage', onStorage); }
    };
  }

  function summarize(comments, readState) {
    const result = { loaded: true, total: 0, unread: 0, photos: Object.create(null) }, seen = new Set();
    for (const comment of comments) {
      if (!validId(comment?.id) || typeof comment.photoId !== 'string' || !comment.photoId || seen.has(comment.id)) continue;
      seen.add(comment.id);
      const photo = result.photos[comment.photoId] ||= { total: 0, unread: 0 };
      photo.total++; result.total++;
      if (!readState?.isRead(comment.id)) { photo.unread++; result.unread++; }
    }
    return result;
  }
  root.JOURNEY_ATLAS_COMMENT_NOTIFICATIONS = { createReadState, summarize, oldestFirst, newestFirst };
})(typeof window === 'undefined' ? globalThis : window);
