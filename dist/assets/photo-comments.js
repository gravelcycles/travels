(function (root) {
  'use strict';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MAX_COMMENT = 1000;
  const uuid = () => root.crypto?.randomUUID?.() || `visitor-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  function displayName(value) {
    const name = String(value || '').trim();
    if (!name || name.length > 40) throw new Error('Choose a name between 1 and 40 characters.');
    return name;
  }
  function initials(name) { return Array.from(String(name || '').trim())[0]?.toLocaleUpperCase() || '·'; }
  function commentState(value, busy = false) {
    const text = String(value || '');
    return { count: text.length, remaining: MAX_COMMENT - text.length, valid: Boolean(text.trim()) && text.trim().length <= MAX_COMMENT && !busy };
  }
  function photoNavigation(photos, id) {
    const index = photos.findIndex(photo => photo.id === id);
    return { index, count: photos.length, previous: index > 0 ? photos[index - 1] : null, next: index >= 0 ? photos[index + 1] || null : null };
  }
  // The visitor's stable local identity survives a session; demo access does not.
  // Neither record is a private-photo credential or changes the real auth service.
  function createIdentityStore(storage, session, makeId = uuid) {
    const key = 'atlas-experience-visitor-v2', accessKey = 'atlas-experience-access-v2';
    let visitor = null, access = false;
    try { const saved = JSON.parse(storage?.getItem(key) || 'null'); if (typeof saved?.id === 'string' && saved.id && typeof saved.name === 'string') visitor = { id: saved.id, name: displayName(saved.name) }; } catch { /* Fresh visitor if storage is absent or corrupt. */ }
    try {
      if (!visitor) {
        const previous = JSON.parse(session?.getItem('atlas-experience-visitor-v1') || 'null');
        if (typeof previous?.id === 'string' && previous.id && typeof previous.name === 'string') {
          visitor = { id: previous.id, name: displayName(previous.name) };
          storage?.setItem(key, JSON.stringify(visitor)); session?.setItem(accessKey, visitor.id); session?.removeItem('atlas-experience-visitor-v1');
        }
      }
      access = Boolean(visitor && session?.getItem(accessKey) === visitor.id);
    } catch { /* In-memory access is still usable. */ }
    return {
      get: () => visitor,
      allowed: () => access,
      save(name, grantAccess = false) {
        const next = { id: visitor?.id || makeId(), name: displayName(name) };
        let persistent = true;
        try { storage.setItem(key, JSON.stringify(next)); } catch { persistent = false; }
        visitor = next;
        if (grantAccess) { access = true; try { session?.setItem(accessKey, visitor.id); } catch { /* Current-page access remains available. */ } }
        return { visitor, persistent };
      },
      lock() { access = false; try { session?.removeItem(accessKey); } catch { /* No persisted access to clear. */ } }
    };
  }
  const icons = {
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    comment: '<path d="M20 11.5a8 8 0 0 1-8 8H5l-3 2 1.5-5A8 8 0 1 1 20 11.5Z"/>',
    back: '<path d="m14 6-6 6 6 6"/>', next: '<path d="m10 6 6 6-6 6"/>',
    arrow: '<path d="m7 11 5-5 5 5M12 6v13"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    lock: '<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    pin: '<path d="M18 10c0 5-6 11-6 11S6 15 6 10a6 6 0 1 1 12 0Z"/><circle cx="12" cy="10" r="2"/>'
  };
  const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.comment}</svg>`;
  function create(options) {
    const $ = selector => document.querySelector(selector);
    const preview = Boolean(options.preview), dialog = $('#comments-dialog'), unlock = $('#experience-unlock'), bar = $('#experience-bar');
    if (!dialog || !unlock || !bar) return { photoChanged() {}, update() {}, start() {} };
    let storage, session;
    try { storage = root.localStorage; } catch { /* Browser restrictions are reflected when a write is attempted. */ }
    try { session = root.sessionStorage; } catch { /* Current-page visitor state remains usable. */ }
    const identity = createIdentityStore(storage, session);
    const script = document.querySelector('script[src*="/photo-comments.js"]');
    const assetBase = new URL('.', script?.src || location.href);
    let currentPhoto = null, journeyId = '', store, lastPhotoId = '', afterUnlock = null, unlockMode = 'unlock', busy = false, editingId = '', deleted = null, photoOpener = null;
    const transientDrafts = new Map(), editsByPhoto = new Map();
    const draftKey = (photoId = currentPhoto?.id) => `photo-comment:${photoId}`;
    const fallbackKey = key => `${journeyId}:${key}`;
    function readDraft(key, fallback = '') {
      if (transientDrafts.has(fallbackKey(key))) { const value = transientDrafts.get(fallbackKey(key)); return typeof value === 'string' ? value : fallback; }
      try { const value = store?.draft(key); return typeof value === 'string' ? value : fallback; } catch { return fallback; }
    }
    function saveDraft(key, value) {
      transientDrafts.set(fallbackKey(key), value);
      try { store?.draft(key, value); return true; } catch { return false; }
    }
    function present(id) {
      if ($(`#${id}`).open) return;
      const overlays = root.JOURNEY_ATLAS_MOBILE_UI;
      if (overlays?.presentOverlay) overlays.presentOverlay(id); else $(`#${id}`).showModal();
    }
    function dismiss(id, after) {
      const surface = $(`#${id}`);
      if (!surface.open) { after?.(); return; }
      const overlays = root.JOURNEY_ATLAS_MOBILE_UI;
      if (overlays?.dismissOverlay) overlays.dismissOverlay(id, after); else { surface.close(); after?.(); }
    }
    const status = (message = '', error = false) => { const node = $('#comment-status'); node.textContent = message; node.dataset.error = String(error); };
    function announce(message, error = false) { const node = $('#experience-status'); if (node) { node.textContent = message; node.dataset.error = String(error); } }
    function mount() {
      bar.className = 'experience-bar';
      bar.innerHTML = `<span class="experience-preview-label">UX preview</span><div class="experience-switch" role="group" aria-label="Preview feature"><button id="experience-places" type="button">${icon('pin')}<span>Places</span></button><button id="experience-comments" type="button">${icon('comment')}<span>Comments</span></button></div><details class="experience-menu"><summary aria-label="Preview options">${icon('more')}</summary><div><p>Changes stay in this browser.</p><button id="experience-reset" type="button">Reset preview edits…</button><a id="experience-exit">Exit preview</a></div></details><span id="experience-status" role="status"></span>`;
      dialog.innerHTML = `<header class="comments-heading"><div><span class="comments-eyebrow">LITTLE MEMORIES</span><h2 id="comments-title">Around this photo</h2></div><button id="close-comments" class="comments-icon-button" type="button" aria-label="Close comments">${icon('close')}</button></header><section class="comments-photo-context" aria-label="Current photograph"><button id="comments-view-photo" class="comments-photo-preview" type="button" aria-label="Return to photograph"><img id="comments-photo-image" alt=""/><span>${icon('comment')}</span></button><div><p id="comments-photo-title"></p><span id="comments-photo-position"></span></div><div class="comments-photo-navigation"><button id="comments-previous-photo" class="comments-icon-button" type="button" aria-label="Previous photograph">${icon('back')}</button><button id="comments-next-photo" class="comments-icon-button" type="button" aria-label="Next photograph">${icon('next')}</button></div></section><div class="comments-meta"><span id="comments-count"></span><span>Saved in this browser</span></div><div id="comments-list" class="comments-list" tabindex="-1"></div><div id="comment-undo" class="comment-undo" hidden><span>Comment deleted.</span><button id="comment-undo-button" type="button">Undo</button><button id="comment-undo-dismiss" class="comments-icon-button" type="button" aria-label="Dismiss undo">${icon('close')}</button></div><form id="comment-form" class="comment-form"><div class="comment-byline"><span id="comment-self-avatar" class="comment-avatar" aria-hidden="true"></span><span>Commenting as <strong id="comment-author"></strong></span><button id="comment-change-name" type="button">Change name</button></div><label for="comment-body" class="comments-sr-only">Your comment</label><div class="comment-compose"><textarea id="comment-body" maxlength="1000" rows="2" placeholder="Leave a little memory…" aria-describedby="comment-status comment-character-count"></textarea><div class="comment-compose-footer"><span id="comment-draft-state"></span><span id="comment-character-count" hidden></span><button id="comment-submit" class="experience-primary" type="submit" disabled><span>Post</span>${icon('arrow')}</button></div></div><p id="comment-status" role="status"></p></form>`;
      const trigger = $('#open-photo-comments');
      trigger.innerHTML = `${icon('comment')}<span>Comments</span><span id="photo-comments-count">0</span>`;
      trigger.setAttribute('aria-expanded', 'false');
      const exit = new URL(location.href); exit.searchParams.delete('experience'); $('#experience-exit').href = exit.href;
    }
    function updateToolbar() {
      $('#experience-places').setAttribute('aria-pressed', String(document.body.classList.contains('places-open')));
      $('#experience-comments').setAttribute('aria-pressed', String(dialog.open || unlock.open && unlockMode === 'unlock'));
    }
    function resizeComposer(textarea = $('#comment-body')) {
      textarea.style.height = 'auto'; textarea.style.height = `${Math.min(textarea.scrollHeight, 140)}px`;
    }
    function updateComposer() {
      const field = $('#comment-body'), state = commentState(field.value, busy);
      $('#comment-submit').disabled = !state.valid;
      $('#comment-character-count').hidden = state.count < 750;
      $('#comment-character-count').textContent = `${state.count.toLocaleString()} / 1,000`;
      resizeComposer(field);
    }
    function persistComposer() {
      if (!currentPhoto || !store) return;
      const body = $('#comment-body').value;
      const persisted = saveDraft(draftKey(), body);
      $('#comment-draft-state').textContent = body ? (persisted ? 'Draft saved' : 'Draft kept on this page') : '';
    }
    function clearUndo() { deleted = null; $('#comment-undo').hidden = true; }
    function updateIdentity() {
      const visitor = identity.get();
      $('#comment-author').textContent = visitor?.name || 'you';
      $('#comment-self-avatar').textContent = initials(visitor?.name);
    }
    function refreshCounts() {
      const count = currentPhoto && store ? store.comments(currentPhoto.id).length : 0;
      $('#photo-comments-count').textContent = String(count);
      $('#photo-comments-count').hidden = !count;
      $('#open-photo-comments').setAttribute('aria-label', `Comments${count ? `, ${count} ${count === 1 ? 'comment' : 'comments'}` : ''}`);
      $('#comments-count').textContent = `${count} ${count === 1 ? 'comment' : 'comments'}`;
    }
    function photoTitle(photo) { return photo?.caption || photo?.alt || 'A moment from the journey'; }
    function syncThumbnail() {
      const image = $('#comments-photo-image'), photo = currentPhoto;
      if (!photo) return;
      let src = '';
      if (options.protected(photo)) {
        const visible = $('#modal-photo');
        const sources = [photo.src, ...(photo.srcset || []).map(source => source.src)];
        if (options.unlocked() && visible?.dataset.photoState === 'ready' && sources.includes(visible.dataset.privateSrc)) src = visible.currentSrc || visible.src;
      } else if (photo.src) src = photo.src.startsWith('./assets/') ? new URL(photo.src.slice(9), assetBase).href : photo.src;
      if (src) { image.src = src; image.hidden = false; } else { image.removeAttribute('src'); image.hidden = true; }
    }
    function renderPhotoContext() {
      $('#comments-photo-title').textContent = photoTitle(currentPhoto);
      const navigation = photoNavigation(options.photos(), currentPhoto?.id);
      $('#comments-photo-position').textContent = navigation.index >= 0 ? `Photo ${navigation.index + 1} of ${navigation.count}` : '';
      $('#comments-previous-photo').disabled = !navigation.previous;
      $('#comments-next-photo').disabled = !navigation.next;
      syncThumbnail();
    }
    function dateHtml(comment) {
      const date = new Date(comment.createdAt);
      const readable = Number.isFinite(date.getTime()) ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
      return `<time${readable ? ` datetime="${date.toISOString()}" title="${escape(date.toLocaleString())}"` : ''}>${escape(readable)}${comment.editedAt ? ' · edited' : ''}</time>`;
    }
    function renderComments({ revealId } = {}) {
      updateIdentity(); refreshCounts(); renderPhotoContext();
      const visitor = identity.get(), comments = currentPhoto && store ? store.comments(currentPhoto.id) : [];
      $('#comments-list').innerHTML = comments.length ? comments.map(comment => {
        const own = comment.visitorId === visitor?.id;
        const editing = own && editingId === comment.id;
        return `<article class="photo-comment${own ? ' is-own' : ''}" data-comment-id="${escape(comment.id)}"><span class="comment-avatar" aria-hidden="true">${escape(initials(comment.displayName))}</span><div class="photo-comment-content"><header><div><strong>${escape(comment.displayName)}</strong>${own ? '<span class="comment-you">you</span>' : ''}${dateHtml(comment)}</div>${own && !editing ? `<details class="comment-actions"><summary aria-label="Options for your comment">${icon('more')}</summary><div><button data-edit-comment="${escape(comment.id)}" type="button">Edit comment</button><button data-delete-comment="${escape(comment.id)}" type="button">Delete comment</button></div></details>` : ''}</header>${editing ? `<form class="comment-edit-form" data-edit-form="${escape(comment.id)}"><label class="comments-sr-only" for="comment-edit-body">Edit your comment</label><textarea id="comment-edit-body" maxlength="1000" rows="3">${escape(readDraft(`comment-edit:${comment.id}`, comment.body))}</textarea><div><span id="comment-edit-count"></span><button data-cancel-edit type="button">Cancel</button><button class="experience-primary" type="submit">Save</button></div><p class="comment-edit-status" role="status"></p></form>` : `<p>${escape(comment.body)}</p>`}</div></article>`;
      }).join('') : `<div class="comments-empty"><span class="comments-empty-symbol" aria-hidden="true">${icon('comment')}</span><h3>A photo starts the story.</h3><p>Leave a memory, a detail you noticed,<br/>or a little hello from home.</p><button id="write-first-comment" type="button">Write the first comment ${icon('arrow')}</button></div>`;
      if (revealId) requestAnimationFrame(() => {
        const row = [...$('#comments-list').querySelectorAll('[data-comment-id]')].find(node => node.dataset.commentId === revealId);
        row?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
      });
      if (editingId) updateEditForm();
    }
    function beginUnlock(mode = 'unlock', after) {
      unlockMode = mode; afterUnlock = after || null;
      const visitor = identity.get(), rename = mode === 'name', reset = mode === 'reset';
      unlock.innerHTML = `<button id="experience-unlock-cancel" class="comments-icon-button unlock-close" type="button" aria-label="${reset ? 'Cancel reset' : 'Close'}">${icon('close')}</button><div class="unlock-mark" aria-hidden="true">${icon(rename ? 'comment' : reset ? 'back' : 'lock')}</div><h2 id="experience-unlock-title">${rename ? 'What should we call you?' : reset ? 'A fresh start?' : 'Come on in.'}</h2><p class="unlock-intro">${rename ? 'Choose the name beside your next comments.' : reset ? 'Remove your comments, reviews and drafts for this journey. The original sample stays as it is.' : 'Photos to look back on.<br/>A place to leave a little memory.'}</p>${reset ? '<div class="unlock-actions"><button id="experience-confirm-reset" class="experience-primary" type="button">Reset preview edits</button><button id="experience-keep-edits" class="experience-secondary" type="button">Keep my edits</button></div><p id="experience-unlock-error" role="alert"></p>' : `<form id="experience-unlock-form" novalidate><label for="experience-display-name">Your display name</label><input id="experience-display-name" maxlength="40" placeholder="Your name" value="${escape(visitor?.name || '')}" autocomplete="nickname" enterkeyhint="${rename ? 'done' : 'next'}" aria-describedby="experience-name-hint"/><small id="experience-name-hint">${rename ? 'Your earlier comments keep their original name.' : 'No account needed. Just a name for your comments.'}</small>${rename ? '' : `<label for="experience-password">Shared password</label><div class="experience-password-field"><input id="experience-password" type="password" autocomplete="off" enterkeyhint="go" aria-describedby="experience-password-hint"/><button id="experience-show-password" type="button" aria-label="Show password" aria-pressed="false">${icon('eye')}</button></div><small id="experience-password-hint">Try it with <button id="experience-use-demo" type="button">demo</button>. Private photos keep their own password.</small>`}<p id="experience-unlock-error" role="alert"></p><button class="experience-primary" type="submit">${rename ? 'Save name' : 'Unlock & join in'}${icon(rename ? 'check' : 'next')}</button><button id="experience-maybe-later" class="experience-secondary" type="button">${rename ? 'Cancel' : 'Maybe later'}</button></form>`}`;
      present('experience-unlock'); updateToolbar();
      if (rename) $('#experience-display-name').focus(); else $('#experience-unlock-cancel').focus();
    }
    function openComments() {
      if (!preview || !currentPhoto) return;
      if (options.protected(currentPhoto) && !options.unlocked()) { options.unlock(); return; }
      if (!identity.allowed()) { beginUnlock('unlock', openComments); return; }
      if (!dialog.open) {
        photoOpener = document.activeElement;
        $('#comment-body').value = readDraft(draftKey());
        editingId = editsByPhoto.get(currentPhoto.id) || '';
        status(); renderComments();
        document.body.classList.add('comments-open');
        present('comments-dialog'); $('#close-comments').focus();
        $('#open-photo-comments').setAttribute('aria-expanded', 'true');
        updateComposer(); persistComposer(); updateViewport();
      }
      updateToolbar();
    }
    function closeComments() { persistComposer(); dismiss('comments-dialog'); }
    function startComments() {
      if (!preview) return;
      const photo = currentPhoto || options.photos().find(photo => !options.protected(photo)) || options.photos()[0];
      if (!photo) { announce('There are no photos in this journey yet.'); return; }
      // The real viewer and its real credential check always own private media.
      options.openPhoto(photo.id);
      if (options.protected(photo) && !options.unlocked()) { options.unlock(); return; }
      openComments();
    }
    function updateEditForm() {
      const field = $('#comment-edit-body'); if (!field) return;
      const state = commentState(field.value);
      const form = field.closest('form'); form.querySelector('[type=submit]').disabled = !state.valid;
      $('#comment-edit-count').textContent = state.count >= 750 ? `${state.count} / 1,000` : '';
      resizeComposer(field);
    }
    function editComment(id) {
      const comment = store.comments(currentPhoto.id).find(row => row.id === id && row.visitorId === identity.get()?.id);
      if (!comment) return;
      editingId = id; editsByPhoto.set(currentPhoto.id, id);
      renderComments({ revealId: id });
      $('#comment-edit-body').focus(); $('#comment-edit-body').setSelectionRange(comment.body.length, comment.body.length);
    }
    function finishEditing(discard = false) { const id = editingId; if (discard) saveDraft(`comment-edit:${id}`, null); editingId = ''; editsByPhoto.delete(currentPhoto.id); renderComments({ revealId: id }); }
    function updateViewport() {
      const viewport = root.visualViewport;
      document.documentElement.style.setProperty('--comments-viewport-height', `${viewport?.height || innerHeight}px`);
      document.documentElement.style.setProperty('--comments-keyboard-inset', `${Math.max(0, innerHeight - (viewport?.height || innerHeight) - (viewport?.offsetTop || 0))}px`);
      dialog.dataset.keyboard = String(Boolean(viewport && viewport.height < innerHeight * .75));
      if (dialog.open && dialog.dataset.keyboard === 'true' && dialog.contains(document.activeElement)) requestAnimationFrame(() => document.activeElement?.scrollIntoView({ block: 'nearest', behavior: 'instant' }));
    }
    mount();
    $('#open-photo-comments').addEventListener('click', openComments);
    $('#close-comments').addEventListener('click', closeComments);
    $('#comments-view-photo').addEventListener('click', closeComments);
    dialog.addEventListener('cancel', event => { event.preventDefault(); closeComments(); });
    unlock.addEventListener('cancel', event => { event.preventDefault(); afterUnlock = null; dismiss('experience-unlock'); });
    dialog.addEventListener('close', () => {
      if (dialog.open) return;
      persistComposer(); document.body.classList.remove('comments-open'); $('#open-photo-comments').setAttribute('aria-expanded', 'false');
      updateToolbar();
      if (!unlock.open && $('#photo-dialog')?.open && photoOpener?.isConnected) photoOpener.focus({ preventScroll: true });
    });
    unlock.addEventListener('close', () => { if (!unlock.open) updateToolbar(); });
    dialog.addEventListener('keydown', event => {
      const menu = dialog.querySelector('.comment-actions[open]');
      if (event.key === 'Escape' && menu) { event.preventDefault(); event.stopPropagation(); menu.open = false; menu.querySelector('summary').focus(); }
    });
    bar.addEventListener('keydown', event => {
      const menu = bar.querySelector('details[open]');
      if (event.key === 'Escape' && menu) { event.preventDefault(); event.stopPropagation(); menu.open = false; menu.querySelector('summary').focus(); }
    });
    for (const surface of [dialog, unlock]) surface.addEventListener('click', event => {
      if (event.target !== surface) return;
      const rect = surface.getBoundingClientRect();
      if (event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) return;
      if (surface === dialog) closeComments(); else { afterUnlock = null; dismiss('experience-unlock'); }
    });
    $('#comment-body').addEventListener('input', () => { persistComposer(); updateComposer(); status(); });
    $('#comment-body').addEventListener('keydown', event => {
      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && commentState(event.currentTarget.value, busy).valid) { event.preventDefault(); $('#comment-form').requestSubmit(); }
    });
    $('#comment-form').addEventListener('submit', event => {
      event.preventDefault();
      if (!currentPhoto || !identity.allowed() || !commentState($('#comment-body').value, busy).valid) return;
      busy = true; updateComposer(); $('#comment-submit span').textContent = 'Posting…';
      try {
        const comment = store.addComment(currentPhoto.id, identity.get(), $('#comment-body').value, uuid());
        $('#comment-body').value = ''; persistComposer(); renderComments({ revealId: comment.id });
        status('Comment added.'); $('#comment-body').focus();
      } catch (error) { status(error.message || 'Your comment could not be saved. Your draft is still here; try again.', true); }
      finally { busy = false; $('#comment-submit span').textContent = 'Post'; updateComposer(); }
    });
    $('#comment-change-name').addEventListener('click', () => beginUnlock('name', () => { updateIdentity(); $('#comment-change-name').focus(); }));
    unlock.addEventListener('click', event => {
      if (event.target.closest('#experience-unlock-cancel, #experience-maybe-later, #experience-keep-edits')) { afterUnlock = null; dismiss('experience-unlock'); }
      if (event.target.closest('#experience-show-password')) {
        const field = $('#experience-password'), button = $('#experience-show-password'), show = field.type === 'password';
        field.type = show ? 'text' : 'password'; button.setAttribute('aria-label', show ? 'Hide password' : 'Show password'); button.setAttribute('aria-pressed', String(show));
      }
      if (event.target.closest('#experience-use-demo')) { $('#experience-password').value = 'demo'; $('#experience-password').focus(); }
      if (event.target.closest('#experience-confirm-reset')) {
        try { store.reset(); transientDrafts.clear(); editsByPhoto.clear(); editingId = ''; $('#comment-body').value = ''; clearUndo(); renderComments(); updateComposer(); options.onReset?.(); dismiss('experience-unlock', () => announce('Your preview edits have been reset.')); }
        catch (error) { $('#experience-unlock-error').textContent = error.message; }
      }
    });
    unlock.addEventListener('input', event => { event.target.removeAttribute('aria-invalid'); $('#experience-unlock-error').textContent = ''; });
    unlock.addEventListener('submit', event => {
      event.preventDefault();
      let name;
      try { name = displayName($('#experience-display-name').value); }
      catch (error) { $('#experience-display-name').setAttribute('aria-invalid', 'true'); $('#experience-unlock-error').textContent = error.message; $('#experience-display-name').focus(); return; }
      if (unlockMode !== 'name' && $('#experience-password').value !== 'demo') {
        $('#experience-password').setAttribute('aria-invalid', 'true'); $('#experience-unlock-error').textContent = 'Use “demo” for this preview. Your real trip password is not needed.'; $('#experience-password').focus(); return;
      }
      const result = identity.save(name, unlockMode !== 'name'), callback = afterUnlock;
      afterUnlock = null; if ($('#experience-password')) $('#experience-password').value = '';
      dismiss('experience-unlock', () => { callback?.(); if (!result.persistent) status('Your name is kept for this page. Browser storage is unavailable.', true); });
    });
    $('#comments-list').addEventListener('click', event => {
      if (event.target.closest('#write-first-comment')) $('#comment-body').focus();
      const edit = event.target.closest('[data-edit-comment]'); if (edit) editComment(edit.dataset.editComment);
      const remove = event.target.closest('[data-delete-comment]');
      if (remove) {
        try { const row = store.removeComment(remove.dataset.deleteComment, identity.get().id); deleted = row; $('#comment-undo').hidden = false; renderComments(); status(); $('#comment-undo-button').focus(); }
        catch (error) { status(error.message, true); }
      }
      if (event.target.closest('[data-cancel-edit]')) finishEditing(true);
    });
    $('#comments-list').addEventListener('input', event => { if (event.target.id === 'comment-edit-body') { saveDraft(`comment-edit:${editingId}`, event.target.value); updateEditForm(); } });
    $('#comments-list').addEventListener('keydown', event => {
      if (event.target.id !== 'comment-edit-body') return;
      if (event.key === 'Escape') { event.stopPropagation(); event.preventDefault(); finishEditing(true); }
      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && commentState(event.target.value).valid) { event.preventDefault(); event.target.closest('form').requestSubmit(); }
    });
    $('#comments-list').addEventListener('submit', event => {
      const form = event.target.closest('[data-edit-form]'); if (!form) return;
      event.preventDefault();
      try { store.editComment(form.dataset.editForm, identity.get().id, $('#comment-edit-body').value); saveDraft(`comment-edit:${editingId}`, null); finishEditing(); status('Changes saved.'); }
      catch (error) { form.querySelector('.comment-edit-status').textContent = error.message; }
    });
    $('#comment-undo-button').addEventListener('click', () => {
      if (!deleted) return;
      try { const id = deleted.id; store.restoreComment(deleted, identity.get().id); clearUndo(); renderComments({ revealId: id }); status('Comment restored.'); $('#comment-body').focus(); }
      catch (error) { status(error.message, true); }
    });
    $('#comment-undo-dismiss').addEventListener('click', clearUndo);
    for (const [id, direction] of [['comments-previous-photo', 'previous'], ['comments-next-photo', 'next']]) $(`#${id}`).addEventListener('click', () => {
      const photo = photoNavigation(options.photos(), currentPhoto?.id)[direction]; if (!photo) return;
      if (options.protected(photo) && !options.unlocked()) { options.unlock(); return; }
      options.openPhoto(photo.id); $(`#${id}`).focus();
    });
    $('#experience-places').addEventListener('click', () => { options.onPlaces?.(); updateToolbar(); });
    $('#experience-comments').addEventListener('click', startComments);
    $('#experience-reset').addEventListener('click', () => { bar.querySelector('details').open = false; beginUnlock('reset'); });
    document.addEventListener('click', event => {
      for (const details of document.querySelectorAll('.experience-menu[open], .comment-actions[open]')) if (!details.contains(event.target)) details.open = false;
    });
    $('#modal-photo')?.addEventListener('load', () => { if (dialog.open) syncThumbnail(); });
    $('#modal-photo')?.addEventListener('atlas-photo-state', () => { if (dialog.open) syncThumbnail(); });
    $('#comments-photo-image').addEventListener('error', event => { event.target.hidden = true; });
    $('#photo-dialog')?.addEventListener('close', () => { if (!$('#photo-dialog').open && dialog.open) dialog.close(); });
    root.addEventListener('atlas-photos-locked', () => {
      persistComposer(); identity.lock(); afterUnlock = null; $('#comments-photo-image').removeAttribute('src'); $('#comments-photo-image').hidden = true;
      const finish = () => { if (dialog.open) dismiss('comments-dialog'); };
      if (unlock.open) dismiss('experience-unlock', finish); else finish();
    });
    new MutationObserver(updateToolbar).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    root.visualViewport?.addEventListener('resize', updateViewport);
    root.visualViewport?.addEventListener('scroll', updateViewport);
    root.addEventListener('resize', updateViewport);
    function update() {
      const nextId = options.journey()?.id || '';
      if (journeyId !== nextId) {
        if (dialog.open) { persistComposer(); dialog.close(); }
        if (unlock.open) unlock.close();
        journeyId = nextId; store = options.store(); currentPhoto = null; lastPhotoId = ''; editingId = ''; editsByPhoto.clear(); clearUndo(); $('#comment-body').value = '';
      } else store = options.store();
      $('#open-photo-comments').hidden = !preview || !currentPhoto;
      refreshCounts(); updateToolbar();
    }
    return {
      update,
      photoChanged(photo) {
        const next = photo && !photo.mimeType ? photo : null;
        if (lastPhotoId !== next?.id) {
          if (currentPhoto) persistComposer();
          currentPhoto = next; lastPhotoId = next?.id || ''; editingId = editsByPhoto.get(lastPhotoId) || '';
          $('#comment-body').value = next ? readDraft(draftKey()) : ''; status(); $('#comment-undo').hidden = !deleted || deleted.photoId !== next?.id;
          if (dialog.open && next) { renderComments(); updateComposer(); persistComposer(); $('#comments-list').scrollTop = 0; }
          else if (dialog.open && !next) dismiss('comments-dialog');
        } else currentPhoto = next;
        $('#open-photo-comments').hidden = !preview || !currentPhoto; refreshCounts();
      },
      restore(id) {
        if (id === 'comments-dialog') { if (!currentPhoto || !identity.allowed()) return; renderComments(); document.body.classList.add('comments-open'); present(id); $('#open-photo-comments').setAttribute('aria-expanded', 'true'); updateComposer(); }
        else if (id === 'experience-unlock') { if (unlockMode === 'unlock') afterUnlock = openComments; else if (unlockMode === 'name') afterUnlock = updateIdentity; present(id); }
        updateToolbar();
      },
      start() { update(); if (!preview) return; bar.hidden = false; updateViewport(); if (new URLSearchParams(location.search).get('experience') === 'comments') startComments(); }
    };
  }
  root.JOURNEY_ATLAS_PHOTO_COMMENTS = { displayName, initials, commentState, photoNavigation, createIdentityStore, create };
})(typeof window === 'undefined' ? globalThis : window);
