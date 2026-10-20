(function () {
  'use strict';
  // Run in the head, before any page chrome can paint. Keep layout measurable
  // while the view and access controllers independently resolve initial state.
  const root = document.documentElement, pending = new Set(['view', 'access']);
  root.classList.add('page-starting');
  const style = document.createElement('style');
  style.textContent = `html.page-starting{background:#ecefeb}html.page-starting body *{visibility:hidden!important}html.page-starting dialog::backdrop{visibility:hidden!important}html.page-starting #page-entry,html.page-starting #page-entry *{visibility:visible!important}#page-entry{position:fixed;inset:0;z-index:2147483647;display:grid;place-content:center;gap:16px;padding:32px;background:#ecefeb;color:#153238;font:16px/1.6 system-ui,sans-serif;text-align:center}#page-entry[hidden]{display:none!important}#page-entry p{margin:0}#page-entry button{font:inherit;padding:12px 20px;border:1px solid #728b86;border-radius:8px;background:#235c56;color:white;cursor:pointer}`;
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
  document.addEventListener('DOMContentLoaded', update, {once:true});
})();
