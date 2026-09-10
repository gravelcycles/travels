import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { loadJourneys } from "./journey-content.mjs";
import { buildGraph, routeSegment } from "./route-geometry-lib.mjs";

const graphCache = new Map();

export class RouteProposalError extends Error {
  constructor(message, { unsafe = false, warnings = [] } = {}) {
    super(message);
    this.name = "RouteProposalError";
    this.unsafe = unsafe;
    this.warnings = warnings;
  }
}

function validCoordinate(point) {
  return Array.isArray(point) && point.length === 2 && Number.isFinite(point[0]) && Number.isFinite(point[1]) && Math.abs(point[0]) <= 180 && Math.abs(point[1]) <= 90;
}

function journeyData(repoRoot) {
  if (fs.existsSync(path.join(repoRoot, "content/atlas.json"))) return loadJourneys(repoRoot, { includeDrafts: true });
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(repoRoot, "dist/assets/journeys.js"), "utf8"), context);
  return context.window.JOURNEY_ATLAS_DATA;
}

function networkGraph(repoRoot, network) {
  const filename = path.resolve(repoRoot, network.input);
  if (!fs.existsSync(filename)) throw new RouteProposalError(`Mode network is unavailable locally (${network.input}). The saved route was kept.`);
  const stat = fs.statSync(filename);
  const cacheKey = `${filename}:${stat.mtimeMs}:${network.weldGapsKm || 0}:${network.weldCellDegrees || 0.0008}`;
  if (!graphCache.has(cacheKey)) {
    graphCache.set(cacheKey, buildGraph(JSON.parse(fs.readFileSync(filename, "utf8")), {
      weldGapsKm: network.weldGapsKm || 0,
      weldCellDegrees: network.weldCellDegrees || 0.0008
    }));
  }
  return graphCache.get(cacheKey);
}

function routeNetwork({ repoRoot, journeyId, segmentId }) {
  const data = journeyData(repoRoot);
  const journey = data.journeys.find((item) => item.id === journeyId);
  if (!journey) throw new RouteProposalError(`Unknown journey: ${journeyId}`);
  const segment = journey.segments.find((item) => item.id === segmentId);
  if (!segment) throw new RouteProposalError(`Unknown route: ${segmentId}`);
  if (segment.mode === "gondola") throw new RouteProposalError("Gondola routes use manual points. You can edit the guide or keep the saved route.");
  const manifestPath = path.join(repoRoot, journey.published === false ? `build/draft-assets/${journeyId}/route-sources.json` : `content/route-sources/${journeyId}.json`);
  if (!fs.existsSync(manifestPath)) throw new RouteProposalError(`Routing data is not set up for ${journey.label}. Ask the agent to prepare local ${segment.mode} routing data, then reselect this leg. The saved route was kept.`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const segmentSource = manifest.segments?.[segmentId];
  // Preserve protects unattended builds. An explicit Studio proposal is read-only
  // and still requires acceptance, so it may use the configured network.
  const networkId = segmentSource?.network || manifest.modeNetworks?.[segment.mode];
  const network = manifest.networks?.[networkId];
  if (!networkId || !network) throw new RouteProposalError(`Routing data is not set up for this ${segment.mode} leg. Ask the agent to prepare its local network, then reselect this leg. The saved route was kept.`);
  if (!network.input || !fs.existsSync(path.resolve(repoRoot, network.input))) {
    throw new RouteProposalError(`Local ${segment.mode} routing data is missing. Ask the agent to prepare it, then reselect this leg. The saved route was kept.`);
  }
  return { segment, segmentSource, networkId, network };
}

export function studioRouteAvailability(options) {
  try {
    const { segment } = routeNetwork(options);
    return { available: true, message: `Local ${segment.mode} routing data is ready. Edit points, generate a route, then review the green line.` };
  } catch (error) {
    return { available: false, message: error.message };
  }
}

export function proposeStudioRoute({ repoRoot, journeyId, segmentId, controlPoints }) {
  if (!Array.isArray(controlPoints) || controlPoints.length < 2 || !controlPoints.every(validCoordinate)) {
    throw new RouteProposalError("At least two valid control-point anchors are required.");
  }
  const { segment, segmentSource, networkId, network } = routeNetwork({ repoRoot, journeyId, segmentId });
  const result = routeSegment(networkGraph(repoRoot, network), controlPoints, segmentId, {
    maxSnapKm: segmentSource?.maxSnapKm ?? network.maxSnapKm ?? 1,
    ambiguityKm: segmentSource?.ambiguityKm ?? network.ambiguityKm ?? 0.05,
    simplifyTolerance: segmentSource?.simplifyTolerance ?? network.simplifyTolerance ?? 0.00004
  });
  if (result.warnings.length) {
    throw new RouteProposalError(`The ${segment.mode} network produced an ambiguous snap. The saved route was kept.`, { unsafe: true, warnings: result.warnings });
  }
  const safeSnapKm = segmentSource?.safeSnapKm ?? network.safeSnapKm ?? network.maxSnapKm ?? 1;
  if (result.maxSnapKm > safeSnapKm) {
    throw new RouteProposalError(`The nearest ${segment.mode} network is ${result.maxSnapKm.toFixed(2)} km from an anchor, above the ${safeSnapKm.toFixed(2)} km safety limit. The saved route was kept.`, { unsafe: true });
  }
  return {
    geometry: result.geometry,
    mode: segment.mode,
    network: networkId,
    provider: network.provenance?.provider || "Local network source",
    maxSnapKm: result.maxSnapKm,
    pointCount: result.pointCount,
    controlPoints: controlPoints.map((point) => [...point])
  };
}
