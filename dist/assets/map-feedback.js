(function (root) {
  'use strict';
  function create(container, retry) {
    const host = typeof container === 'string' ? document.getElementById(container) : container;
    const panel = document.createElement('div');
    panel.className = 'map-feedback'; panel.setAttribute('role', 'status');
    const message = document.createElement('span'), button = document.createElement('button');
    button.type = 'button'; button.textContent = 'Retry map'; button.onclick = retry;
    panel.append(message, button); host.append(panel);
    let loaded = false, failed = false, empty = false, disposed = false;
    function render() {
      panel.hidden = loaded && !failed && !empty;
      message.textContent = failed ? 'Map unavailable. Please try again.' : empty ? 'No location added for this day.' : 'Loading map…';
      button.hidden = !failed;
    }
    function ready() { if (disposed) return; loaded = true; failed = false; clearTimeout(timer); render(); }
    function fail() { if (disposed) return; failed = true; render(); }
    const timer = setTimeout(fail, 15000);
    render();
    return {
      watch(map) {
        map.on('error', fail);
        map.on('load', ready); map.on('style.load', ready);
        map.on('idle', () => { if (map.isStyleLoaded()) ready(); });
      },
      ready, fail,
      empty(value) { empty = Boolean(value); render(); },
      destroy() { disposed = true; clearTimeout(timer); panel.remove(); }
    };
  }
  root.JOURNEY_ATLAS_MAP_FEEDBACK = {create};
})(typeof window !== 'undefined' ? window : globalThis);
