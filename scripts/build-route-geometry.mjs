#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { buildGraph, routeSegment } from "./route-geometry-lib.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function usage() {
  console.error("Usage: node scripts/build-route-geometry.mjs --journey <journey-id> [--manifest <route-sources.json>] [--output <route-geometry.js>] [--strict]");
}

function parseArgs(argv) {
  const options = { strict: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--strict") options.strict = true;
    else if (["--journey", "--manifest", "--output"].includes(value)) {
      if (!argv[index + 1]) throw new Error(`${value} requires a value`);
      options[value.slice(2)] = argv[index + 1];
      index += 1;
    } else if (value === "--help" || value === "-h") options.help = true;
    else throw new Error(`Unknown argument: ${value}`);
  }
  return options;
}

function readJourneyData() {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(repoRoot, "dist/assets/journeys.js"), "utf8"), context);
  return context.window.JOURNEY_ATLAS_DATA;
}

function readExistingGeometry(filename) {
  if (!fs.existsSync(filename)) return {};
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(filename, "utf8"), context);
  const geometry = context.window.JOURNEY_ATLAS_ROUTE_GEOMETRY;
  return geometry && typeof geometry === "object" ? geometry : {};
}

function validateManifest(manifest, journey) {
  if (!manifest || manifest.schemaVersion !== 1) throw new Error("Route source manifest must use schemaVersion 1");
  if (manifest.journeyId !== journey.id) throw new Error(`Manifest journeyId ${manifest.journeyId || "(missing)"} does not match ${journey.id}`);
  if (!manifest.networks || typeof manifest.networks !== "object") throw new Error("Manifest must define networks");
  if (!manifest.segments || typeof manifest.segments !== "object") throw new Error("Manifest must define segments");
  const segmentIds = new Set(journey.segments.map((segment) => segment.id));
  for (const [segmentId, source] of Object.entries(manifest.segments)) {
    if (!segmentIds.has(segmentId)) throw new Error(`Manifest references unknown segment ${segmentId}`);
    if (source.strategy === "preserve") continue;
    if (!source.network || !manifest.networks[source.network]) throw new Error(`${segmentId} references unknown network ${source.network || "(missing)"}`);
  }
  for (const [networkId, network] of Object.entries(manifest.networks)) {
    if (!network.input) throw new Error(`Network ${networkId} is missing input`);
    if (!network.provenance?.provider || !network.provenance?.retrievedAt || !network.provenance?.query) {
      throw new Error(`Network ${networkId} must record provider, retrievedAt, and query provenance`);
    }
  }
}

function pointFromIntermediate(point) {
  if (Array.isArray(point) && point.length >= 2) return [point[1], point[0]];
  if (point && Number.isFinite(point.lng) && Number.isFinite(point.lat)) return [point.lng, point.lat];
  throw new Error("Invalid stop or via point");
}

function segmentWaypoints(segment, places) {
  const from = places.get(segment.from);
  const to = places.get(segment.to);
  if (!from || !to) throw new Error(`Unknown endpoint ${!from ? segment.from : segment.to}`);
  const intermediate = segment.stops || segment.via || [];
  return [[from.lng, from.lat], ...intermediate.map(pointFromIntermediate), [to.lng, to.lat]];
}

function stableGeometry(geometry) {
  return Object.fromEntries(Object.entries(geometry).sort(([a], [b]) => a.localeCompare(b)));
}

function run() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    usage();
    process.exitCode = 1;
    return;
  }
  if (options.help) {
    usage();
    return;
  }
  if (!options.journey) {
    usage();
    process.exitCode = 1;
    return;
  }

  const data = readJourneyData();
  const journey = data.journeys.find((item) => item.id === options.journey);
  if (!journey) throw new Error(`Unknown journey: ${options.journey}`);
  const manifestPath = path.resolve(repoRoot, options.manifest || `content/route-sources/${journey.id}.json`);
  const outputPath = path.resolve(repoRoot, options.output || "dist/assets/route-geometry.js");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  validateManifest(manifest, journey);

  const geometry = readExistingGeometry(outputPath);
  const places = new Map(journey.places.map((place) => [place.id, place]));
  const graphs = new Map();
  const unavailable = new Map();
  const warnings = [];
  let generatedCount = 0;
  let preservedCount = 0;

  for (const segment of journey.segments) {
    const source = manifest.segments[segment.id];
    if (!source) continue;
    if (source.strategy === "preserve") {
      if (!geometry[segment.id]) warnings.push(`${segment.id}: preserve requested but no reviewed geometry exists`);
      else preservedCount += 1;
      continue;
    }
    const network = manifest.networks[source.network];
    if (!graphs.has(source.network) && !unavailable.has(source.network)) {
      const inputPath = path.resolve(repoRoot, network.input);
      if (!fs.existsSync(inputPath)) unavailable.set(source.network, `source file not found: ${network.input}`);
      else {
        try {
          graphs.set(source.network, buildGraph(JSON.parse(fs.readFileSync(inputPath, "utf8")), {
            weldGapsKm: network.weldGapsKm || 0,
            weldCellDegrees: network.weldCellDegrees || 0.0008
          }));
          console.log(`${source.network}: ${network.provenance.provider}, retrieved ${network.provenance.retrievedAt}`);
        } catch (error) {
          unavailable.set(source.network, error.message);
        }
      }
    }
    const unavailableReason = unavailable.get(source.network);
    if (unavailableReason) {
      const fallback = geometry[segment.id] ? "kept reviewed geometry" : "no reviewed geometry available";
      warnings.push(`${segment.id}: ${fallback} (${unavailableReason})`);
      if (geometry[segment.id]) preservedCount += 1;
      continue;
    }
    try {
      const result = routeSegment(graphs.get(source.network), segmentWaypoints(segment, places), segment.id, {
        maxSnapKm: source.maxSnapKm ?? network.maxSnapKm ?? 4,
        ambiguityKm: source.ambiguityKm ?? network.ambiguityKm ?? 0.05,
        simplifyTolerance: source.simplifyTolerance ?? network.simplifyTolerance ?? 0.00008
      });
      geometry[segment.id] = result.geometry;
      generatedCount += 1;
      console.log(`${segment.id}: ${result.rawPointCount} network nodes → ${result.pointCount} points; max snap ${result.maxSnapKm.toFixed(2)} km`);
      warnings.push(...result.warnings.map((warning) => `${segment.id}: ${warning}`));
    } catch (error) {
      const fallback = geometry[segment.id] ? "kept reviewed geometry" : "no reviewed geometry available";
      warnings.push(`${segment.id}: ${fallback} (${error.message})`);
      if (geometry[segment.id]) preservedCount += 1;
    }
  }

  for (const warning of warnings) console.warn(`WARNING: ${warning}`);
  if (options.strict && warnings.length) {
    console.error(`Strict mode stopped the build with ${warnings.length} warning${warnings.length === 1 ? "" : "s"}; output was not changed.`);
    process.exitCode = 1;
    return;
  }

  const output = `// Generated deterministically by scripts/build-route-geometry.mjs. Coordinates are [longitude, latitude].\nwindow.JOURNEY_ATLAS_ROUTE_GEOMETRY = ${JSON.stringify(stableGeometry(geometry))};\n`;
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, output);
  console.log(`Wrote ${Object.keys(geometry).length} total geometries to ${path.relative(repoRoot, outputPath)} (${generatedCount} generated, ${preservedCount} preserved, ${warnings.length} warnings)`);
}

run();
