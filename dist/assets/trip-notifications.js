(function (root) {
  'use strict';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const countLabel = count => `${count} ${count === 1 ? 'comment' : 'comments'}`;
  function badgeState(summary, photoId) {
    if (!summary?.loaded) return { known: false, count: '', unread: false, label: 'Comments' };
    const { total = 0, unread = 0 } = summary.photos[photoId] || {};
    return { known: true, count: String(unread || total), unread: unread > 0, label: `Comments, ${countLabel(total)}${unread ? `, ${unread} unread` : ''}` };
  }
  function updatePhotoBadge(button, summary, photoId) {
    if (!button) return;
    const state = badgeState(summary, photoId), badge = button.querySelector('[data-comment-count]');
    if (badge) { badge.textContent = state.count; badge.hidden = !state.known; badge.dataset.unread = String(state.unread); }
    button.setAttribute('aria-label', state.label); button.title = state.label;
  }
  // Read only rows visible inside their scrolling viewport. Observing DOM insertion
  // alone would incorrectly consume every fetched page, including offscreen rows.
  function observeVisible({ container, active, read }) {
    let frame = 0;
    function measure() {
      frame = 0;
      if (!active() || document.visibilityState === 'hidden' || !container.getClientRects().length) return;
      const box = container.getBoundingClientRect(), ids = [];
      for (const node of container.querySelectorAll('[data-comment-id]')) {
        const row = node.getBoundingClientRect();
        const height = Math.min(box.bottom, row.bottom) - Math.max(box.top, row.top);
        if (row.width > 0 && height >= Math.min(80, row.height) && row.right > box.left && row.left < box.right) ids.push(node.dataset.commentId);
      }
      if (ids.length) read(ids);
    }
    function schedule() { if (!frame) frame = root.requestAnimationFrame(measure); }
    const observer = root.IntersectionObserver ? new root.IntersectionObserver(schedule, { root: container, threshold: [0, .1, .25, .5, .75, 1] }) : null;
    container.addEventListener('scroll', schedule, { passive: true });
    root.addEventListener('resize', schedule); document.addEventListener('visibilitychange', schedule);
    return {
      refresh() {
        observer?.disconnect();
        // A rendered target may schedule a scroll before this measurement. Drop
        // a pending measurement of the replaced page so transient rows cannot
        // become read before the requested comment is revealed.
        if (frame) root.cancelAnimationFrame(frame); frame = 0;
        for (const row of container.querySelectorAll('[data-comment-id]')) observer?.observe(row);
        schedule();
      },
      stop() { observer?.disconnect(); if (frame) root.cancelAnimationFrame(frame); frame = 0; }
    };
  }
  function create(options) {
    const $ = selector => document.querySelector(selector), dialog = $('#trip-notifications-dialog');
    const buttons = [...document.querySelectorAll('[data-trip-notifications]')];
    const live = Boolean(options.live), enabled = live || Boolean(options.preview);
    let store, unsubscribe, journeyId = '', revision = 0, loading = false, error = '', opener, rendered = '', identityRequired = false;
    const allowed = () => enabled && (!live || options.unlocked());
    dialog.innerHTML = '<header class="conversation-heading"><div><h2 id="trip-notifications-title">Most recent comments</h2><p id="trip-notifications-journey"></p></div><button id="close-trip-notifications" class="pp-icon-button" type="button" aria-label="Close notifications"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header><div id="trip-notifications-content" class="trip-notifications-content"><ul id="trip-notifications-list" aria-label="Recent comments"></ul><div id="trip-notifications-empty" class="trip-notifications-empty"></div></div><div class="trip-notifications-footer"><p id="trip-notifications-status" role="status"></p><button id="trip-notifications-retry" type="button" hidden>Try again</button><button id="trip-notifications-unlock" type="button" hidden>Unlock photos</button><button id="trip-notifications-more" type="button" hidden>Load more comments</button><small id="trip-notifications-local-note" hidden>Read status is kept for this visit because browser storage is unavailable.</small></div>';
    const visibility = observeVisible({ container: $('#trip-notifications-content'), active: () => dialog.open && allowed() && !document.querySelector('.photo-unlock-dialog[open], #experience-unlock[open]'), read: ids => store.markRead(ids) });
    function updateBadges() {
      const summary = allowed() ? store?.notificationSummary() : null, unread = summary?.loaded ? summary.unread : 0;
      for (const button of buttons) {
        const badge = button.querySelector('[data-notifications-count]');
        badge.hidden = !unread; badge.textContent = String(unread); badge.dataset.unread = 'true';
        button.setAttribute('aria-label', `Notifications${unread ? `, ${unread} unread ${unread === 1 ? 'comment' : 'comments'}` : ''}`);
        button.setAttribute('aria-expanded', String(dialog.open));
      }
      $('#trip-notifications-local-note').hidden = !allowed() || store?.readState?.persistent() !== false;
      for (const row of $('#trip-notifications-list').querySelectorAll('[data-comment-id]')) row.dataset.unread = String(!store.readState?.isRead(row.dataset.commentId));
    }
    function render() {
      updateBadges();
      if (!dialog.open) return;
      $('#trip-notifications-journey').textContent = options.journey().title || '';
      const rows = allowed() ? store.recentComments() : [], list = $('#trip-notifications-list'), empty = $('#trip-notifications-empty');
      const signature = JSON.stringify(rows);
      if (signature !== rendered) {
        const scrollTop = $('#trip-notifications-content').scrollTop;
        rendered = signature;
        list.innerHTML = rows.map(comment => {
          const photo = (options.journey().photos || []).find(item => item.id === comment.photoId);
          const day = options.journey().days.find(item => item.id === photo?.dayId);
          const label = root.JOURNEY_ATLAS_PHOTO_COMMENTS.photoTitle(photo, day);
          const date = new Date(comment.createdAt), valid = Number.isFinite(date.getTime());
          return `<li data-comment-id="${escape(comment.id)}" data-unread="${!store.readState?.isRead(comment.id)}"><button type="button" data-open-comment="${escape(comment.id)}"><span class="notification-author">${escape(comment.displayName)}<time${valid ? ` datetime="${date.toISOString()}" title="${escape(date.toLocaleString())}"` : ''}>${valid ? escape(date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })) : ''}</time></span><span class="notification-body">${escape(comment.body)}</span><span class="notification-photo">${escape(label)}<span aria-hidden="true"> →</span></span></button></li>`;
        }).join('');
        $('#trip-notifications-content').scrollTop = scrollTop;
        visibility.refresh();
      }
      list.hidden = !rows.length; empty.hidden = Boolean(rows.length);
      empty.innerHTML = !enabled ? `<h3>No comments yet</h3><p>${options.journey().kind === 'demo' ? 'Try photo conversations in the comments preview.' : 'Comments will appear here when this journey is published.'}</p>` : !allowed() ? '<h3>Join the conversation</h3><p>Unlock photos to see comments from this journey.</p>' : loading && !store.hasRecent() ? '<h3>Loading comments…</h3><p>Gathering the latest conversations from this journey.</p>' : error && !store.hasRecent() ? '<h3>Comments unavailable</h3><p>Try again when your connection is ready.</p>' : '<h3>No comments yet</h3><p>Comments on any photo in this journey will appear here.</p>';
      list.setAttribute('aria-busy', String(loading));
      $('#trip-notifications-status').textContent = error || (loading && rows.length ? 'Updating…' : '');
      $('#trip-notifications-retry').hidden = !error || identityRequired;
      $('#trip-notifications-unlock').hidden = !live || (allowed() && !identityRequired);
      $('#trip-notifications-more').hidden = !allowed() || !store.hasMoreRecent();
      $('#trip-notifications-more').disabled = loading;
    }
    async function refresh({ more = false, force = false, feed = dialog.open } = {}) {
      if (!allowed() || document.visibilityState === 'hidden') return;
      if (!feed) { try { await store.refreshSummary(journeyId, { force }); } catch { /* The next explicit open exposes an error and Retry. */ } return; }
      const previousCount = store.recentComments().length, focusMore = more && document.activeElement === $('#trip-notifications-more');
      const activeStore = store, generation = ++revision; loading = true; error = ''; identityRequired = false; render();
      const results = await Promise.allSettled([activeStore.refreshSummary(journeyId, { force }), ...(dialog.open ? [activeStore.refreshRecent(journeyId, { more, force })] : [])]);
      if (generation !== revision || activeStore !== store || !allowed()) return;
      loading = false;
      const failure = results.find(result => result.status === 'rejected')?.reason;
      identityRequired = failure?.code === 'identity_required';
      error = failure ? (identityRequired ? 'Unlock photos again to see comments.' : store.hasRecent() ? 'Couldn’t update. Showing the comments already loaded.' : failure.message || 'Couldn’t load comments.') : '';
      render();
      if (focusMore && !failure && dialog.open) {
        const next = $('#trip-notifications-list').querySelectorAll('[data-open-comment]')[previousCount];
        next?.focus({ preventScroll: true }); next?.scrollIntoView({ block: 'nearest' });
      }
    }
    function open() {
      if (!dialog.open) {
        opener = document.activeElement;
        const overlays = root.JOURNEY_ATLAS_MOBILE_UI;
        if (overlays?.presentOverlay) overlays.presentOverlay(dialog.id); else dialog.showModal();
        $('#close-trip-notifications').focus();
      }
      render(); visibility.refresh(); refresh();
    }
    function close(after) {
      const overlays = root.JOURNEY_ATLAS_MOBILE_UI;
      if (overlays?.dismissOverlay) overlays.dismissOverlay(dialog.id, after); else { dialog.close(); after?.(); }
    }
    for (const button of buttons) button.addEventListener('click', open);
    $('#close-trip-notifications').addEventListener('click', () => close());
    $('#trip-notifications-retry').addEventListener('click', () => refresh({ force: true }));
    $('#trip-notifications-unlock').addEventListener('click', () => identityRequired ? root.JOURNEY_ATLAS_AUTH.begin() : options.unlock());
    $('#trip-notifications-more').addEventListener('click', () => refresh({ more: true }));
    $('#trip-notifications-list').addEventListener('click', event => {
      const button = event.target.closest('[data-open-comment]');
      const comment = button && store.recentComments().find(row => row.id === button.dataset.openComment);
      // Native event dispatch can run microtasks between its listeners. Use the
      // next task so every popstate listener has reconciled the old selection
      // before the new photo/conversation writes its own history entry.
      if (comment && allowed()) {
        const activeStore = store;
        close(() => root.setTimeout(() => { if (activeStore === store && allowed()) options.openComment(comment); }, 0));
      }
    });
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
    });
    dialog.addEventListener('close', () => { if (dialog.open) return; visibility.stop(); updateBadges(); if (opener?.isConnected && opener.getClientRects().length) opener.focus({ preventScroll: true }); });
    root.addEventListener('atlas-photos-locked', () => { revision++; loading = false; error = ''; rendered = ''; visibility.stop(); $('#trip-notifications-list').replaceChildren(); render(); });
    root.addEventListener('atlas-photos-unlocked', () => { render(); refresh({ force: true }); });
    root.addEventListener('focus', () => refresh({ feed: false }));
    document.addEventListener('visibilitychange', () => { if (document.visibilityState !== 'hidden') refresh({ feed: false }); });
    function update() {
      const next = options.store();
      if (store !== next) {
        revision++; unsubscribe?.(); store = next; journeyId = options.journey().id; loading = false; error = ''; rendered = '';
        $('#trip-notifications-list').replaceChildren();
        unsubscribe = store.subscribe(event => { if (event?.type === 'read') updateBadges(); else render(); });
        if (dialog.open) close();
      }
      render();
    }
    return { update, open, start() { update(); refresh({ feed: false }); } };
  }
  root.JOURNEY_ATLAS_TRIP_NOTIFICATIONS = { badgeState, updatePhotoBadge, observeVisible, create };
})(typeof window === 'undefined' ? globalThis : window);
