import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
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

export function proposeStudioRoute({ repoRoot, journeyId, segmentId, controlPoints }) {
  if (!Array.isArray(controlPoints) || controlPoints.length < 2 || !controlPoints.every(validCoordinate)) {
    throw new RouteProposalError("At least two valid control-point anchors are required.");
  }
  const data = journeyData(repoRoot);
  const journey = data.journeys.find((item) => item.id === journeyId);
  if (!journey) throw new RouteProposalError(`Unknown journey: ${journeyId}`);
  const segment = journey.segments.find((item) => item.id === segmentId);
  if (!segment) throw new RouteProposalError(`Unknown route: ${segmentId}`);
  const manifestPath = path.join(repoRoot, "content/route-sources", `${journeyId}.json`);
  if (!fs.existsSync(manifestPath)) throw new RouteProposalError(`No local route-source manifest exists for ${journey.label}. The saved route was kept.`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const segmentSource = manifest.segments?.[segmentId];
  if (segmentSource?.strategy === "preserve") {
    throw new RouteProposalError(`${segmentId} is marked as a reviewed preserve exception; its saved route was kept.`, { unsafe: true });
  }
  const networkId = segmentSource?.network || manifest.modeNetworks?.[segment.mode];
  const network = manifest.networks?.[networkId];
  if (!networkId || !network) throw new RouteProposalError(`No ${segment.mode} network is configured for this journey. The saved route was kept.`);
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
