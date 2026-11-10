import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import '../dist/assets/atlas-utils.js';
import '../dist/assets/location-labels.js';

const labels = globalThis.JOURNEY_ATLAS_LOCATION_LABELS, utils = globalThis.JOURNEY_ATLAS_UTILS;
const repo = path.resolve(import.meta.dirname, '..');

// A flat Web Mercator camera with optional bearing, like MapLibre at pitch 0.
function flatMap({ center = [14, 47], zoom = 4.6, bearing = 0, width = 1100, height = 760, pitch = 0 } = {}) {
  const scale = 512 * 2 ** zoom, turn = bearing * Math.PI / 180, calls = { project: 0 };
  const x = lng => lng / 360 + 0.5, y = lat => 0.5 - Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) / (2 * Math.PI);
  return { calls, width, height, getPitch: () => pitch, project([lng, lat]) {
    calls.project++;
    const dx = (x(lng) - x(center[0])) * scale, dy = (y(lat) - y(center[1])) * scale;
    return { x: width / 2 + dx * Math.cos(turn) + dy * Math.sin(turn), y: height / 2 - dx * Math.sin(turn) + dy * Math.cos(turn) };
  } };
}
function publishedRoutes() {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(repo, 'dist/assets/journey-data/trip-backpacking-europe-heading-east.js'), 'utf8'), context);
  return Object.entries(utils.decodeRoutes(JSON.parse(JSON.stringify(context.window.JOURNEY_ATLAS_ROUTE_GEOMETRY)))).map(([id, coordinates], index) => ({ coordinates, padding: 9, dayIds: [`d${index % 7}`] }));
}
const boxesAround = (points, size = 22) => points.map(({ x, y }) => ({ left: x - size / 2, right: x + size / 2, top: y - size / 2, bottom: y + size / 2 }));

test('the prepared projection finds the same route crossings as point-by-point projection, with far fewer projections', () => {
  const routes = publishedRoutes(), prepared = routes.map(labels.prepareRoute), points = routes.reduce((total, route) => total + route.coordinates.length, 0);
  assert.ok(points > 20000, 'the long city trip is the fixture');
  for (const camera of [{}, { zoom: 6.5, center: [13.4, 52.5] }, { zoom: 11, center: [16.37, 48.21] }, { bearing: 30 }, { zoom: 3, center: [20, 45], width: 390, height: 600 }]) {
    const exactMap = flatMap(camera), fastMap = flatMap(camera);
    const exact = labels.routeStrokesFor(exactMap, routes, exactMap.width, exactMap.height);
    const fast = labels.routeStrokesFor(fastMap, prepared, fastMap.width, fastMap.height);
    assert.equal(exactMap.calls.project, points); assert.ok(fastMap.calls.project <= 4, 'only the reference points are projected');
    assert.ok(fast.length <= exact.length);
    // Candidate pin boxes: every route endpoint, plus a grid across the viewport.
    const candidates = boxesAround([...routes.flatMap(route => [route.coordinates[0], route.coordinates.at(-1)]).map(coordinate => exactMap.project(coordinate)),
      ...Array.from({ length: 150 }, (_, index) => ({ x: (index % 15 + 0.5) * exactMap.width / 15, y: (Math.floor(index / 15) + 0.5) * exactMap.height / 10 }))]);
    let crossed = 0;
    for (const box of candidates) {
      const visible = box.right >= 0 && box.left <= exactMap.width && box.bottom >= 0 && box.top <= exactMap.height;
      if (!visible) continue;
      const a = exact.some(stroke => labels.crossesRoute(stroke, box)), b = fast.some(stroke => labels.crossesRoute(stroke, box));
      // Merging sub-pixel steps can move a stroke by under half a pixel; allow
      // only that margin when the two disagree.
      if (a !== b) {
        const grown = { left: box.left - 1, right: box.right + 1, top: box.top - 1, bottom: box.bottom + 1 }, shrunk = { left: box.left + 1, right: box.right - 1, top: box.top + 1, bottom: box.bottom - 1 };
        assert.ok(exact.some(stroke => labels.crossesRoute(stroke, grown)) && !exact.some(stroke => labels.crossesRoute({ ...stroke, padding: stroke.padding - 1 }, shrunk)), 'a disagreement is confined to the half-pixel edge');
      }
      if (a) crossed++;
    }
    assert.ok(crossed > 0, 'the fixture exercises real crossings');
  }
});

test('pitched maps, unprepared routes and inexact fits keep the exact projection', () => {
  const routes = [{ coordinates: [[8, 47], [9, 48], [10, 47]], padding: 8, dayIds: ['d1'] }], prepared = routes.map(labels.prepareRoute);
  const pitched = flatMap({ pitch: 40 });
  assert.equal(labels.routeStrokesFor(pitched, prepared, 1100, 760).length, 2); assert.equal(pitched.calls.project, 3);
  const plain = flatMap();
  assert.equal(labels.routeStrokesFor(plain, routes, 1100, 760).length, 2); assert.equal(plain.calls.project, 3);
  const warped = flatMap(); const project = warped.project.bind(warped);
  warped.project = coordinate => { const point = project(coordinate); return { x: point.x + (coordinate[0] - 8) ** 2 * 4, y: point.y }; };
  const strokes = labels.routeStrokesFor(warped, prepared, 1100, 760);
  assert.deepEqual(strokes.map(stroke => stroke.end), routes[0].coordinates.slice(1).map(warped.project), 'a non-affine map is projected point by point');
  const double = { project: ([x, y]) => ({ x, y }) };
  assert.equal(labels.routeStrokesFor(double, [{ coordinates: [[1, 1], [2, 2]], padding: 4 }].map(labels.prepareRoute), 100, 100).length, 1);
  assert.equal(labels.prepareRoute(routes[0]).mercator, prepared[0].mercator, 'a route is converted once');
});
