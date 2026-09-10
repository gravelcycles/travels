import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { proposeStudioRoute, studioRouteAvailability, RouteProposalError } from "../scripts/studio-route-service.mjs";

const fixtureDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures/routes");

function makeRepository(context, inputName) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "travels-studio-route-"));
  context.after(() => fs.rmSync(repoRoot, { recursive: true, force: true }));
  fs.mkdirSync(path.join(repoRoot, "dist/assets"), { recursive: true });
  fs.mkdirSync(path.join(repoRoot, "content/route-sources"), { recursive: true });
  fs.copyFileSync(path.join(fixtureDirectory, inputName), path.join(repoRoot, inputName));
  fs.writeFileSync(path.join(repoRoot, "dist/assets/journeys.js"), `window.JOURNEY_ATLAS_DATA = ${JSON.stringify({
    journeys: [{ id: "fixture-journey", label: "Fixture journey", segments: [{ id: "fixture-walk", mode: "walk" }] }]
  })};\n`);
  fs.writeFileSync(path.join(repoRoot, "content/route-sources/fixture-journey.json"), JSON.stringify({
    journeyId: "fixture-journey",
    modeNetworks: { walk: "walking" },
    networks: {
      walking: {
        input: inputName,
        maxSnapKm: 0.5,
        safeSnapKm: 0.2,
        ambiguityKm: 0.01,
        provenance: { provider: "Fixture walking network" }
      }
    },
    segments: {}
  }));
  return repoRoot;
}

test("returns a reviewable local-network proposal without changing anchors", (context) => {
  const repoRoot = makeRepository(context, "ordered-stops.json");
  const anchors = [[0, 0], [0.01, 0.01], [0.02, 0]];
  const proposal = proposeStudioRoute({ repoRoot, journeyId: "fixture-journey", segmentId: "fixture-walk", controlPoints: anchors });
  assert.deepEqual(proposal.controlPoints, anchors);
  assert.deepEqual(proposal.geometry, anchors);
  assert.equal(proposal.network, "walking");
});

test("rejects an ambiguous proposal as unsafe", (context) => {
  const repoRoot = makeRepository(context, "ambiguous.json");
  assert.throws(
    () => proposeStudioRoute({ repoRoot, journeyId: "fixture-journey", segmentId: "fixture-walk", controlPoints: [[0, 0], [0.02, 0]] }),
    (error) => error instanceof RouteProposalError && error.unsafe && /ambiguous snap/.test(error.message) && error.warnings.length === 1
  );
});

test("surfaces an unavailable mode network without fabricating geometry", (context) => {
  const repoRoot = makeRepository(context, "ordered-stops.json");
  fs.unlinkSync(path.join(repoRoot, "ordered-stops.json"));
  assert.throws(
    () => proposeStudioRoute({ repoRoot, journeyId: "fixture-journey", segmentId: "fixture-walk", controlPoints: [[0, 0], [0.02, 0]] }),
    /routing data is missing.*saved route was kept/
  );
});

test("reviewed preserve routes allow explicit proposals while retaining source files", context => {
  const repoRoot = makeRepository(context, "ordered-stops.json");
  const file = path.join(repoRoot, 'content/route-sources/fixture-journey.json');
  const manifest = JSON.parse(fs.readFileSync(file));
  manifest.segments['fixture-walk'] = { strategy: 'preserve' };
  fs.writeFileSync(file, JSON.stringify(manifest));
  const inputPath = path.join(repoRoot, 'ordered-stops.json');
  const input = JSON.parse(fs.readFileSync(inputPath));
  input.elements.push({ type: 'way', id: 102, nodes: [1,3] });
  fs.writeFileSync(inputPath, JSON.stringify(input));
  const before = fs.readFileSync(file, 'utf8');
  const options = { repoRoot, journeyId: 'fixture-journey', segmentId: 'fixture-walk' };
  assert.equal(studioRouteAvailability(options).available, true);
  const via = proposeStudioRoute({ ...options, controlPoints: [[0,0],[0.01,0.01],[0.02,0]] });
  const direct = proposeStudioRoute({ ...options, controlPoints: [[0,0],[0.02,0]] });
  assert.notDeepEqual(via.geometry, direct.geometry, 'Removing a detour point regenerates the route');
  assert.equal(fs.readFileSync(file, 'utf8'), before, 'A proposal must never rewrite the preserve policy');
});

test('availability explains missing inputs before generation', context => {
  const repoRoot = makeRepository(context, 'ordered-stops.json');
  const options = { repoRoot, journeyId: 'fixture-journey', segmentId: 'fixture-walk' };
  fs.unlinkSync(path.join(repoRoot, 'ordered-stops.json'));
  assert.equal(studioRouteAvailability(options).available, false);
  assert.match(studioRouteAvailability(options).message, /Ask the agent to prepare/);
});
