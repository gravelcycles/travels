import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { proposeStudioRoute, RouteProposalError } from "../scripts/studio-route-service.mjs";

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
    /Mode network is unavailable locally.*saved route was kept/
  );
});
