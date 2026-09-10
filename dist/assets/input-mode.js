/* Keep programmatic focus useful without leaving keyboard rings after taps. */
(() => {
  const root = document.documentElement;
  root.dataset.inputMode = 'pointer';
  document.addEventListener('pointerdown', () => { root.dataset.inputMode = 'pointer'; }, true);
  document.addEventListener('keydown', event => {
    if (event.metaKey || event.ctrlKey || event.altKey || ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(event.key)) return;
    root.dataset.inputMode = 'keyboard';
  }, true);
})();
