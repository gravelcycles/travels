import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { GpxImportError, parseGpx, proposeGpxRoute } from "../scripts/gpx-route-service.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const fixture = fs.readFileSync(path.join(import.meta.dirname, "fixtures/gpx/bicycle-day.gpx"), "utf8");

test("reads ordered GPX track sections, removes duplicates, measures, and simplifies", () => {
  const result = parseGpx(fixture, { gapThresholdKm: 1, simplifyToleranceMeters: 5 });
  assert.equal(result.rawPointCount, 9);
  assert.equal(result.validPointCount, 8);
  assert.equal(result.sectionCount, 2);
  assert.ok(result.distanceKm > 0.4 && result.distanceKm < 0.7);
  assert.deepEqual(result.geometry[0], [8.3093, 47.0502]);
  assert.deepEqual(result.geometry.at(-1), [8.314, 47.047]);
  assert.ok(result.pointCount >= 4 && result.pointCount < result.validPointCount);
  assert.match(result.warnings.join(" "), /duplicate point.*2 recorded sections/i);
});

test("accepts a matching bicycle GPX while retaining private-source provenance", () => {
  const proposal = proposeGpxRoute({
    repoRoot,
    journeyId: "switzerland-italy-family-2026",
    segmentId: "family-luzern-kehrsiten-bike",
    controlPoints: [[8.3093, 47.0502], [8.314, 47.047]],
    text: fixture
  });
  assert.equal(proposal.mode, "bike");
  assert.equal(proposal.provenance.originalPrivate, true);
  assert.equal(proposal.provenance.source, "Private traveler-supplied GPX track");
  assert.ok(!JSON.stringify(proposal).includes("bicycle-day.gpx"));
});

test("rejects reversed tracks and large gaps without inventing a bridge", () => {
  assert.throws(() => proposeGpxRoute({
    repoRoot,
    journeyId: "switzerland-italy-family-2026",
    segmentId: "family-luzern-kehrsiten-bike",
    controlPoints: [[8.314, 47.047], [8.3093, 47.0502]],
    text: fixture
  }), (error) => error instanceof GpxImportError && error.unsafe && /opposite/.test(error.message));
  const gap = fixture.replace('lat="47.048100" lon="8.312200"', 'lat="47.500000" lon="8.900000"');
  assert.throws(() => proposeGpxRoute({
    repoRoot,
    journeyId: "switzerland-italy-family-2026",
    segmentId: "family-luzern-kehrsiten-bike",
    controlPoints: [[8.3093, 47.0502], [8.314, 47.047]],
    text: gap
  }), (error) => error instanceof GpxImportError && error.unsafe && /large gap/.test(error.message) && error.warnings.some((warning) => /gap/.test(warning)));
});
