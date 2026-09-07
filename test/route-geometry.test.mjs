import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildGraph, routeSegment } from "../scripts/route-geometry-lib.mjs";

const fixtureDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures/routes");
const repoRoot = path.resolve(fixtureDirectory, "../../..");
const fixture = (name) => JSON.parse(fs.readFileSync(path.join(fixtureDirectory, name), "utf8"));

function generatedGeometry(filename) {
  const source = fs.readFileSync(filename, "utf8");
  const match = source.match(/JOURNEY_ATLAS_ROUTE_GEOMETRY\s*=\s*([^;]+);/);
  return JSON.parse(match[1]);
}

test("reports disconnected waypoint networks instead of inventing a bridge", () => {
  const graph = buildGraph(fixture("disconnected.json"));
  assert.throws(() => routeSegment(graph, [[0, 0], [0.03, 0]], "disconnected", { maxSnapKm: 0.2 }), /Network points are disconnected at leg 1/);
});

test("warns on a near-tied component and chooses deterministically", () => {
  const graph = buildGraph(fixture("ambiguous.json"));
  const result = routeSegment(graph, [[0, 0], [0.02, 0]], "ambiguous", { maxSnapKm: 0.5, ambiguityKm: 0.01 });
  const repeated = routeSegment(graph, [[0, 0], [0.02, 0]], "ambiguous", { maxSnapKm: 0.5, ambiguityKm: 0.01 });
  assert.match(result.warnings[0], /Ambiguous network snap at leg 1/);
  assert.deepEqual(result.geometry, [[0, 0], [0.01, 0.001], [0.02, 0]]);
  assert.deepEqual(repeated, result);
});

test("routes through ordered intermediate stops", () => {
  const graph = buildGraph(fixture("ordered-stops.json"));
  const result = routeSegment(graph, [[0, 0], [0.01, 0.01], [0.02, 0]], "ordered", { maxSnapKm: 0.2 });
  assert.deepEqual(result.geometry, [[0, 0], [0.01, 0.01], [0.02, 0]]);
});

test("journey manifests preserve reviewed geometry when a source is unavailable", (context) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "travels-route-test-"));
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const output = path.join(directory, "route-geometry.js");
  const manifest = path.join(directory, "manifest.json");
  fs.copyFileSync(path.join(repoRoot, "dist/assets/route-geometry.js"), output);
  fs.writeFileSync(manifest, JSON.stringify({
    schemaVersion: 1,
    journeyId: "switzerland-italy-family-2026",
    networks: {
      absent: {
        input: "test/fixtures/routes/does-not-exist.json",
        provenance: { provider: "Fixture", retrievedAt: "2026-09-07", query: "missing fixture" }
      }
    },
    segments: { "family-airport-luzern": { network: "absent" } }
  }));
  const run = spawnSync(process.execPath, [
    path.join(repoRoot, "scripts/build-route-geometry.mjs"),
    "--journey", "switzerland-italy-family-2026",
    "--manifest", manifest,
    "--output", output
  ], { cwd: repoRoot, encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stderr, /kept reviewed geometry/);
  assert.deepEqual(generatedGeometry(output), generatedGeometry(path.join(repoRoot, "dist/assets/route-geometry.js")));
});
