import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import '../dist/assets/atlas-utils.js';
import '../dist/assets/media-utils.js';
import '../studio/plan-extras.js';

const detailed = [[8, 47], [8.01, 47.004], [8.02, 47.002], [8.03, 47.01], [8.04, 47.015]];
const anchors = [detailed[0], detailed[2], detailed.at(-1)];
const copy = value => JSON.parse(JSON.stringify(value));

// Run the actual Studio handlers with a tiny DOM/map adapter. No trip files or
// browser save endpoint are touched by these regression fixtures.
function editor(override = null, fetch = async () => ({ ok: true, json: async () => ({ available: true, message: "Ready" }) })) {
  const nodes = new Map(), markers = [];
  const node = () => ({ _value: '', get value() { return this._value; }, set value(value) { this._value = String(value); }, disabled: false, handlers: {}, dataset: {},
    addEventListener(type, fn) { this.handlers[type] = fn; }, setAttribute() {} });
  const getNode = selector => {
    if (!nodes.has(selector)) nodes.set(selector, node());
    return nodes.get(selector);
  };
  const context = vm.createContext({ structuredClone, fetch, URLSearchParams,
    document: { addEventListener() {}, querySelector: getNode, querySelectorAll: () => [], createElement: node },
    window: { addEventListener() {}, JOURNEY_ATLAS_UTILS: globalThis.JOURNEY_ATLAS_UTILS, JOURNEY_ATLAS_MEDIA:globalThis.JOURNEY_ATLAS_MEDIA, JOURNEY_ATLAS_PLAN_EXTRAS:globalThis.JOURNEY_ATLAS_PLAN_EXTRAS,
      JOURNEY_ATLAS_DATA: { journeys: [{ id: 'trip', places: [], days: [{ id: 'day', segmentIds: ['train'] }],
        segments: [{ id: 'train', mode: 'train', geometry: detailed }] }] } },
    maplibregl: { Marker: class {
      constructor() { this.handlers = {}; markers.push(this); }
      setLngLat(point) { this.point = point; return this; }
      addTo() { return this; }
      on(type, fn) { this.handlers[type] = fn; }
      getLngLat() { return { lng: this.point[0], lat: this.point[1] }; }
    } }
  });
  const source = fs.readFileSync(new URL('../studio/studio.js', import.meta.url), 'utf8');
  vm.runInContext(source.replace('  init();\n})();', `
    renderRouteList = () => {};
    clearActiveMap = () => {};
    addLine = () => {};
    fitCoordinates = () => {};
    window.editor = {
      seed(points, override) {
        routePoints = points;
        routeSmoothed = override?.smoothing === "chaikin";
        if (override) state.routes[selectedSegmentId] = override;
        resetHistory(routePoints);
        drawRouteEditor();
      },
      snapshot: () => routeEditSnapshot(),
      readEndpointFields, commitRoutePoints, restoreRouteHistory, refreshRouteAvailability, proposeNetworkRoute, acceptNetworkProposal,
      proposal: () => routeProposal, selectPoint: index => { selectedRoutePoint = index; updateUndoButtons(); }
    };
  })();`), context);
  const api = context.window.editor;
  api.seed(copy(override?.controlPoints || anchors), copy(override));
  return { api, nodes, markers, snapshot: () => copy(api.snapshot()) };
}

test('dragging a train endpoint preserves every other detailed coordinate; undo/redo restores geometry', () => {
  const ed = editor();
  const end = ed.markers.at(-1);
  end.point = [8.0405, 47.0155];
  end.handlers.dragend();
  const changed = ed.snapshot();
  assert.deepEqual(changed.override.geometry.slice(0, -1), detailed.slice(0, -1));
  assert.deepEqual(changed.override.geometry.at(-1), end.point);
  assert.equal(changed.override.geometry.length, detailed.length);
  assert.equal(ed.nodes.get('#undo-route').disabled, false);
  ed.nodes.get('#undo-route').handlers.click();
  assert.equal(ed.snapshot().override, null);
  assert.deepEqual(ed.snapshot().points, anchors);
  ed.nodes.get('#redo-route').handlers.click();
  assert.deepEqual(ed.snapshot(), changed);
  assert.equal(ed.nodes.get('#accept-route-proposal').disabled, true);
});

test('typed endpoint edits preserve the current override, interior anchors and the opposite endpoint', () => {
  const geometry = detailed.map(([x,y]) => [x + 0.00012345, y + 0.00012345]);
  const preciseAnchors = [geometry[0], geometry[2], geometry.at(-1)];
  const override = { geometry, controlPoints: preciseAnchors, smoothing: 'chaikin', source: { provider: 'Reviewed track' } };
  const ed = editor(override);
  ed.nodes.get('#route-end-lng').value = '8.041';
  ed.nodes.get('#route-end-lat').value = '47.016';
  ed.nodes.get('#apply-route-endpoints').handlers.click();
  const changed = ed.snapshot();
  assert.deepEqual(changed.override.geometry.slice(0,-1), geometry.slice(0,-1));
  assert.deepEqual(changed.override.geometry.at(-1), [8.041,47.016]);
  assert.deepEqual(changed.override.controlPoints.slice(0,-1), preciseAnchors.slice(0,-1));
  assert.deepEqual(changed.override.source, override.source);
  ed.api.restoreRouteHistory(-1);
  assert.deepEqual(ed.snapshot().override, override);
  ed.api.restoreRouteHistory(1);
  assert.deepEqual(ed.snapshot(), changed);
  // Re-selecting after serialized save/reload must keep the adjusted geometry.
  const reloaded = editor(copy(changed.override));
  assert.deepEqual(reloaded.snapshot().override.geometry, changed.override.geometry);
});

test('start and end fields update only the two terminal vertices, even with smoothing enabled', () => {
  const ed = editor({ geometry: detailed, controlPoints: anchors, smoothing: 'chaikin' });
  ed.nodes.get('#route-start-lng').value = '7.999';
  ed.nodes.get('#route-start-lat').value = '47.001';
  ed.nodes.get('#route-end-lng').value = '8.041';
  ed.nodes.get('#route-end-lat').value = '47.016';
  ed.api.readEndpointFields();
  assert.deepEqual(ed.snapshot().override.geometry, [[7.999,47.001], ...detailed.slice(1,-1), [8.041,47.016]]);
});

test('intermediate anchor drags still require acceptance and do not replace the detailed route', () => {
  const ed = editor();
  ed.markers[1].point = [8.021,47.003];
  ed.markers[1].handlers.dragend();
  assert.deepEqual(ed.snapshot().override.geometry, detailed);
  const intermediateEdit = ed.snapshot();
  const endpoint = ed.markers.at(-1);
  endpoint.point = [8.041,47.016];
  endpoint.handlers.dragend();
  ed.api.restoreRouteHistory(-1);
  assert.deepEqual(ed.snapshot(), intermediateEdit);
  ed.api.restoreRouteHistory(-1);
  assert.equal(ed.snapshot().override, null);
  // An edit after undo discards the abandoned redo branch.
  const start = ed.markers.at(-3);
  start.point = [7.999,47.001];
  start.handlers.dragend();
  assert.equal(ed.nodes.get('#redo-route').disabled, true);
});


test('delete, regenerate and accept updates geometry only after explicit acceptance', async () => {
  let requestBody;
  const ed = editor({ geometry: detailed, controlPoints: anchors }, async (url, options) => {
    if (url.startsWith('/api/route-availability')) return { ok: true, json: async () => ({ available: true, message: 'Ready' }) };
    requestBody = JSON.parse(options.body);
    return { ok: true, json: async () => ({ ok: true, proposal: { geometry: [detailed[0], detailed[1], detailed.at(-1)], mode: 'train', network: 'rail', pointCount: 3, maxSnapKm: 0 } }) };
  });
  await ed.api.refreshRouteAvailability();
  ed.api.selectPoint(1);
  assert.equal(ed.nodes.get('#delete-route-point').textContent, 'Delete point 2');
  ed.nodes.get('#delete-route-point').handlers.click();
  assert.deepEqual(ed.snapshot().points, [anchors[0], anchors.at(-1)]);
  assert.deepEqual(ed.snapshot().override.geometry, detailed);
  await ed.api.proposeNetworkRoute();
  assert.deepEqual(requestBody.controlPoints, [anchors[0], anchors.at(-1)]);
  assert.deepEqual(ed.snapshot().override.geometry, detailed, 'Generation only previews');
  assert.equal(ed.nodes.get('#accept-route-proposal').disabled, false);
  ed.api.acceptNetworkProposal();
  assert.deepEqual(ed.snapshot().override.geometry, [detailed[0], detailed[1], detailed.at(-1)]);
});

test('editing points while generation is in flight invalidates the pending proposal', async () => {
  let finish;
  const ed = editor(null, async url => {
    if (url.startsWith('/api/route-availability')) return { ok: true, json: async () => ({ available: true, message: 'Ready' }) };
    return await new Promise(resolve => { finish = resolve; });
  });
  await ed.api.refreshRouteAvailability();
  const request = ed.api.proposeNetworkRoute();
  ed.api.commitRoutePoints([anchors[0], anchors.at(-1)]);
  finish({ ok: true, json: async () => ({ ok: true, proposal: { geometry: detailed, pointCount: detailed.length, maxSnapKm: 0 } }) });
  await request;
  assert.equal(ed.api.proposal(), null);
  assert.equal(ed.nodes.get('#accept-route-proposal').disabled, true);
  assert.deepEqual(ed.snapshot().override.geometry, detailed);
});

test('routing availability disables generation with a visible next step', async () => {
  const ed = editor(null, async () => ({ ok: true, json: async () => ({ available: false, message: 'Ask the agent to prepare local routing data.' }) }));
  await ed.api.refreshRouteAvailability();
  assert.equal(ed.nodes.get('#propose-route').disabled, true);
  assert.match(ed.nodes.get('#route-network-status').textContent, /Ask the agent/);
});
