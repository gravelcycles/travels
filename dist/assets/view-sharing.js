(function (root) {
  'use strict';
  const views = new Set(['map', 'story', 'photo', 'grid']);
  function read(href) {
    const url = new URL(href), hash = new URLSearchParams(url.hash.slice(1));
    const get = key => hash.get(key) || url.searchParams.get(key) || '';
    const photoId = get('photo'), dayId = get('day'), requestedView = get('view');
    return {dayId, photoId, view: views.has(requestedView) ? requestedView : photoId ? 'photo' : dayId ? 'map' : '', scope:get('scope') === 'journey' ? 'journey' : 'day'};
  }
  function urlFor(href, state, {share = false} = {}) {
    const url = new URL(href);
    // Share page identifiers only; never propagate credentials, service URLs or
    // local preview/debug switches into a message to another person.
    for (const key of [...url.searchParams.keys()]) {
      if (share ? !['journey','group'].includes(key) : ['day','photo','view','scope'].includes(key)) url.searchParams.delete(key);
    }
    const hash = new URLSearchParams();
    if (state?.dayId) hash.set('day', state.dayId);
    if (state?.photoId) hash.set('photo', state.photoId);
    if (views.has(state?.view)) hash.set('view', state.view);
    if (state?.scope === 'journey') hash.set('scope', 'journey');
    url.hash = hash.toString();
    return url.href;
  }
  async function shareLink({url, title}, {navigator, fallback, announce, retry}) {
    if (typeof navigator.share === 'function') {
      try { await navigator.share({url, title}); return 'shared'; }
      catch (error) {
        if (error?.name === 'AbortError') return 'cancelled';
        if (error?.name === 'NotAllowedError' && retry) { retry({url,title}); return 'ready'; }
      }
    }
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(url);
      announce('Link copied');
      return 'copied';
    } catch (_) { fallback(url); return 'manual'; }
  }
  function create(api, env = root) {
    let ready = false, queued = false, traversedUrl = '', busy = false;
    function sync(force = false) {
      if ((!ready && !force) || (!force && api.pending?.())) return;
      const next = urlFor(env.location.href, api.state());
      if (next !== env.location.href) env.history.replaceState(env.history.state, '', next);
    }
    function changed() {
      if (!ready || queued) return;
      queued = true;
      env.setTimeout(() => { queued = false; sync(); }, 0);
    }
    function restore() {
      const target = read(env.location.href);
      if (!target.view && !target.dayId && !target.photoId) return;
      // The app first establishes the return surface, then opens the requested
      // photo. Its existing history controller remains the only history owner.
      api.restore(target);
      // Authentication may redirect as soon as its pending crypto work finishes.
      // Preserve the completed target before that continuation captures the URL.
      sync(true);
    }
    // Surface controllers run first; defer writes until the complete event has
    // settled, and retain the destination for its paired hashchange.
    env.addEventListener('popstate', () => { traversedUrl = env.location.href; }, true);
    env.addEventListener('popstate', event => {
      if (!event.state?.mobileAtlas && !event.state?.atlasPhotoBubble && !event.state?.atlasPlaces) restore();
      changed();
    });
    env.addEventListener('hashchange', event => {
      // A returning surface can keep its most recently browsed photo and replace
      // the URL. Ignore the older hash event queued by the traversal.
      if (event.newURL && event.newURL !== env.location.href) return;
      if (event.newURL === traversedUrl) { traversedUrl = ''; return; }
      restore();
    });
    async function share(button) {
      if (busy) return;
      busy = true;
      const state = api.state(button), title = api.title();
      let url = urlFor(env.location.href, state, {share:true});
      try {
        // Capture the clicked photo before any asynchronous work. Browsing and
        // history keep their ordinary atlas URLs; only explicit sharing grants
        // a messaging preview access to this photo's small thumbnail.
        if (state?.photoId && api.photoShareLink) {
          try { url = await api.photoShareLink(url, state) || url; }
          catch (_) { api.announce('Photo preview unavailable; sharing the link', button); }
        }
        // A slow request can outlast Safari's user activation. Keep the prepared
        // link and offer a fresh tap; retrying must not wait for another request.
        if (typeof env.navigator.share === 'function' && env.navigator.userActivation?.isActive === false && api.ready) {
          api.ready({url,title}); return 'ready';
        }
        return await shareLink({url,title}, {
        navigator:env.navigator, fallback:api.fallback,
        retry:api.ready,
        announce:message => api.announce(message, button)
      }); } finally { busy = false; }
    }
    return {changed,sync,share,start() { ready = true; restore(); }};
  }
  root.JOURNEY_ATLAS_SHARING = {read,urlFor,shareLink,create};
})(typeof window === 'undefined' ? globalThis : window);
