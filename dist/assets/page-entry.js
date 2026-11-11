(function () {
  'use strict';
  // Run in the head, before any page chrome can paint. Keep layout measurable
  // while the view and access controllers independently resolve initial state.
  const root = document.documentElement, pending = new Set(['view', 'access']), entryScript = document.currentScript;
  root.classList.add('page-starting');
  const style = document.createElement('style');
  style.textContent = `html.page-starting{background:#f4f1ea}html.page-starting body *{visibility:hidden!important}html.page-starting dialog::backdrop{visibility:hidden!important}html.page-starting #page-entry,html.page-starting #page-entry *{visibility:visible!important}#page-entry{position:fixed;inset:0;z-index:2147483647;display:grid;place-content:center;gap:16px;padding:32px;background:#f4f1ea;color:#153238;font:16px/1.6 system-ui,sans-serif;text-align:center}#page-entry[hidden]{display:none!important}#page-entry p{margin:0}#page-entry button{font:inherit;padding:12px 20px;border:1px solid #728b86;border-radius:8px;background:#235c56;color:white;cursor:pointer}`;
  document.head.append(style);
  let slow = false, failed = false;
  const panel = () => document.querySelector('#page-entry');
  function update() {
    const entry = panel();
    if (!pending.size) {
      clearTimeout(progressTimer);clearTimeout(failureTimer);
      root.classList.remove('page-starting');
      if (entry) entry.hidden = true;
    } else if (entry) {
      entry.hidden = !slow;
      entry.querySelector('p').textContent = failed ? 'Journey Atlas could not finish opening. Please try again.' : 'Opening Journey Atlas…';
      const retry = entry.querySelector('button');retry.hidden = !failed;
      retry.onclick = () => location.reload();
    }
  }
  const progressTimer = setTimeout(() => {slow = true;update();}, 500);
  // A missing/failed script must offer recovery, never expose an unchosen view.
  const failureTimer = setTimeout(() => {slow = failed = true;update();}, 20000);
  window.JOURNEY_ATLAS_ENTRY = {
    ready(part) {pending.delete(part);update();}
  };
  // A page script that fails to load can never report its milestone: offer
  // Retry at once instead of holding neutral progress for the full deadline.
  if (typeof window.addEventListener === 'function') window.addEventListener('error', event => {
    if (pending.size && event.target && event.target.tagName === 'SCRIPT') {slow = failed = true;update();}
  }, true);
  // A browser that has unlocked before checks its first-party remembered
  // cookie on a fresh tab. Start that navigation here, before the map and trip
  // scripts download and run only to be discarded; photo-auth.js keeps every
  // other case and takes over if this cannot start. Mirrors begin('restore').
  function startRememberedCheck() {
    try {
      const service = entryScript && entryScript.dataset && entryScript.dataset.photoService;
      if (!service || !service.startsWith('https://') || new URL(service).origin !== service) return null;
      if (new URLSearchParams(location.search).get('photoSource') === 'local') return null;
      if (localStorage.getItem('atlas-photo-remembered') !== '1') return null;
      if (['atlas-photo-guest', 'atlas-photo-access', 'atlas-photo-login'].some(key => sessionStorage.getItem(key))) return null;
      const params = new URLSearchParams(location.hash.slice(1));
      if (['photoAuthCode', 'photoAuthLogout', 'photoAuthCancel', 'photoAuthMissing'].some(key => params.has(key))) return null;
      const encode = bytes => btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
      const random = () => encode(crypto.getRandomValues(new Uint8Array(32)));
      const state = random(), verifier = random();
      return crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)).then(digest => {
        sessionStorage.setItem('atlas-photo-login', JSON.stringify({state, verifier, hash: location.hash, created: Date.now()}));
        location.replace(`${service}/private-photos/auth/window?${new URLSearchParams({origin: location.origin, state, challenge: encode(new Uint8Array(digest)), returnTo: location.origin + location.pathname + location.search, action: 'restore'})}`);
        return true;
      }).catch(() => false);
    } catch { return null; }
  }
  const restoring = startRememberedCheck();
  if (restoring) window.JOURNEY_ATLAS_ENTRY.restoring = restoring;
  document.addEventListener('DOMContentLoaded', update, {once:true});
})();
