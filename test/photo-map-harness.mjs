// North-up Mercator camera double; exercise viewport geometry at each size.
export function photoMapHarness({ center = [8, 47], zoom = 16, width = 360, height = 260 } = {}) {
  const camera = { center, zoom }, calls = [], handlers = new Set();
  const mercator = lat => Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
  const latitude = y => (2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180 / Math.PI;
  const map = {
    on(type, fn) { if (type === 'moveend') handlers.add(fn); },
    off(type, fn) { handlers.delete(fn); },
    stop() { calls.push({ type: 'stop' }); },
    easeTo(options) { calls.push({ type: 'ease', options }); },
    getZoom: () => camera.zoom,
    getCenter: () => ({ lng: camera.center[0], lat: camera.center[1] }),
    getCanvas: () => ({ clientWidth: width, clientHeight: height }),
    project([lng, lat]) {
      const scale = 512 * 2 ** camera.zoom;
      return { x: width / 2 + (lng - camera.center[0]) / 360 * scale,
        y: height / 2 - (mercator(lat) - mercator(camera.center[1])) / (2 * Math.PI) * scale };
    },
    cameraForBounds(bounds, { padding = 0, maxZoom = 20 } = {}) {
      calls.push({ type: 'calculate', bounds, padding, maxZoom });
      const [[west, south], [east, north]] = bounds;
      return { center: [(west + east) / 2, latitude((mercator(south) + mercator(north)) / 2)],
        zoom: Math.min(maxZoom, Math.log2((width - 2 * padding) * 360 / (east - west) / 512),
          Math.log2((height - 2 * padding) * Math.PI * 2 / (mercator(north) - mercator(south)) / 512)) };
    }
  };
  return { map, camera, calls, handlers,
    finishMove() {
      const move = calls.findLast(call => call.type === 'ease');
      if (move) { camera.center = move.options.center; camera.zoom = move.options.zoom; }
      for (const fn of [...handlers]) fn();
    },
    moves: () => calls.filter(call => call.type === 'ease')
  };
}
