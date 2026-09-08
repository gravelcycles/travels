import { loadJourneys } from "./journey-content.mjs";

const EARTH_RADIUS_KM = 6371.0088;

export class GpxImportError extends Error {
  constructor(message, { unsafe = false, warnings = [] } = {}) {
    super(message);
    this.name = "GpxImportError";
    this.unsafe = unsafe;
    this.warnings = warnings;
  }
}

function finiteCoordinate(point) {
  return Array.isArray(point) && point.length === 2 && Number.isFinite(point[0]) && Number.isFinite(point[1]) && Math.abs(point[0]) <= 180 && Math.abs(point[1]) <= 90;
}

function distanceKm(a, b) {
  const radians = Math.PI / 180;
  const latitudeDelta = (b[1] - a[1]) * radians;
  const longitudeDelta = (b[0] - a[0]) * radians;
  const latitudeA = a[1] * radians;
  const latitudeB = b[1] * radians;
  const haversine = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

function pointLineDistanceMeters(point, start, end) {
  const latitude = ((start[1] + end[1]) / 2) * Math.PI / 180;
  const scaleX = Math.cos(latitude) * 111_320;
  const scaleY = 110_540;
  const px = point[0] * scaleX;
  const py = point[1] * scaleY;
  const sx = start[0] * scaleX;
  const sy = start[1] * scaleY;
  const ex = end[0] * scaleX;
  const ey = end[1] * scaleY;
  const dx = ex - sx;
  const dy = ey - sy;
  const length = dx * dx + dy * dy;
  const amount = length ? Math.max(0, Math.min(1, ((px - sx) * dx + (py - sy) * dy) / length)) : 0;
  return Math.hypot(px - (sx + amount * dx), py - (sy + amount * dy));
}

function simplify(points, toleranceMeters) {
  if (points.length <= 2) return points.map((point) => [...point]);
  let farthest = 0;
  let split = 0;
  for (let index = 1; index < points.length - 1; index += 1) {
    const distance = pointLineDistanceMeters(points[index], points[0], points[points.length - 1]);
    if (distance > farthest) {
      farthest = distance;
      split = index;
    }
  }
  if (farthest <= toleranceMeters) return [[...points[0]], [...points[points.length - 1]]];
  return [
    ...simplify(points.slice(0, split + 1), toleranceMeters).slice(0, -1),
    ...simplify(points.slice(split), toleranceMeters)
  ];
}

function attribute(source, name) {
  const match = source.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "i"));
  return match?.[2];
}

function pointsFromXml(source, tag, counters) {
  const points = [];
  const expression = new RegExp(`<${tag}\\b([^>]*?)(?:\\/?>)`, "gi");
  for (const match of source.matchAll(expression)) {
    counters.raw += 1;
    const lat = Number(attribute(match[1], "lat"));
    const lng = Number(attribute(match[1], "lon"));
    const point = [lng, lat];
    if (!finiteCoordinate(point)) {
      counters.invalid += 1;
      continue;
    }
    if (points.length && points.at(-1)[0] === point[0] && points.at(-1)[1] === point[1]) {
      counters.duplicates += 1;
      continue;
    }
    points.push(point);
  }
  return points;
}

export function parseGpx(text, { gapThresholdKm = 1, simplifyToleranceMeters = 8 } = {}) {
  if (typeof text !== "string" || !text.trim()) throw new GpxImportError("Choose a non-empty GPX file.");
  if (!/<gpx\b/i.test(text)) throw new GpxImportError("The selected file is not recognizable GPX XML.");
  if (!Number.isFinite(gapThresholdKm) || gapThresholdKm <= 0) throw new GpxImportError("The GPX gap threshold must be positive.");
  if (!Number.isFinite(simplifyToleranceMeters) || simplifyToleranceMeters < 0) throw new GpxImportError("The GPX simplification tolerance cannot be negative.");

  const counters = { raw: 0, invalid: 0, duplicates: 0 };
  const groups = [];
  for (const match of text.matchAll(/<(trkseg|rte)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const kind = match[1].toLowerCase() === "trkseg" ? "track" : "route";
    const points = pointsFromXml(match[2], kind === "track" ? "trkpt" : "rtept", counters);
    if (points.length) groups.push({ kind, points });
  }
  if (!groups.length) {
    const points = pointsFromXml(text, "trkpt", counters);
    if (points.length) groups.push({ kind: "track", points });
  }
  if (!groups.length) throw new GpxImportError("The GPX contains no valid track or route points.");

  const gaps = [];
  let distance = 0;
  for (const [groupIndex, group] of groups.entries()) {
    for (let index = 1; index < group.points.length; index += 1) {
      const length = distanceKm(group.points[index - 1], group.points[index]);
      distance += length;
      if (length > gapThresholdKm) gaps.push({ kind: "recording", group: groupIndex + 1, afterPoint: index, distanceKm: length });
    }
    const next = groups[groupIndex + 1];
    if (next) {
      const length = distanceKm(group.points.at(-1), next.points[0]);
      if (length > gapThresholdKm) gaps.push({ kind: "segment-break", group: groupIndex + 1, distanceKm: length });
    }
  }

  const simplifiedGroups = groups.map((group) => simplify(group.points, simplifyToleranceMeters));
  const geometry = simplifiedGroups.flatMap((points, index) => index && points[0][0] === simplifiedGroups[index - 1].at(-1)[0] && points[0][1] === simplifiedGroups[index - 1].at(-1)[1] ? points.slice(1) : points);
  if (geometry.length < 2) throw new GpxImportError("The GPX needs at least two distinct valid points.");
  const warnings = [];
  if (counters.invalid) warnings.push(`${counters.invalid} invalid point${counters.invalid === 1 ? " was" : "s were"} ignored.`);
  if (counters.duplicates) warnings.push(`${counters.duplicates} immediate duplicate point${counters.duplicates === 1 ? " was" : "s were"} removed.`);
  if (groups.length > 1) warnings.push(`${groups.length} recorded sections were kept in source order.`);
  if (gaps.length) warnings.push(`${gaps.length} gap${gaps.length === 1 ? "" : "s"} larger than ${gapThresholdKm} km must be reviewed before the track can be used.`);

  return {
    geometry: geometry.map(([lng, lat]) => [Number(lng.toFixed(6)), Number(lat.toFixed(6))]),
    distanceKm: Number(distance.toFixed(3)),
    rawPointCount: counters.raw,
    validPointCount: groups.reduce((sum, group) => sum + group.points.length, 0),
    pointCount: geometry.length,
    sectionCount: groups.length,
    gaps: gaps.map((gap) => ({ ...gap, distanceKm: Number(gap.distanceKm.toFixed(3)) })),
    warnings
  };
}

export function proposeGpxRoute({ repoRoot, journeyId, segmentId, controlPoints, text, gapThresholdKm = 1, simplifyToleranceMeters }) {
  if (!Array.isArray(controlPoints) || controlPoints.length < 2 || !controlPoints.every(finiteCoordinate)) throw new GpxImportError("The selected leg needs valid start and end anchors.");
  const data = loadJourneys(repoRoot, { includeDrafts: true });
  const journey = data.journeys.find((item) => item.id === journeyId);
  if (!journey) throw new GpxImportError(`Unknown journey: ${journeyId}`);
  const segment = journey.segments.find((item) => item.id === segmentId);
  if (!segment) throw new GpxImportError(`Unknown route: ${segmentId}`);
  if (!["bike", "walk"].includes(segment.mode)) throw new GpxImportError("GPX import is available only for bicycle and walking legs.");
  const tolerance = simplifyToleranceMeters ?? (segment.mode === "walk" ? 4 : 8);
  const parsed = parseGpx(text, { gapThresholdKm, simplifyToleranceMeters: tolerance });
  const normal = distanceKm(parsed.geometry[0], controlPoints[0]) + distanceKm(parsed.geometry.at(-1), controlPoints.at(-1));
  const reversed = distanceKm(parsed.geometry[0], controlPoints.at(-1)) + distanceKm(parsed.geometry.at(-1), controlPoints[0]);
  if (reversed + 0.05 < normal) throw new GpxImportError("The GPX appears to run opposite the selected leg. Reverse the track before importing it so travel order stays explicit.", { unsafe: true, warnings: parsed.warnings });
  const endpointDistances = [distanceKm(parsed.geometry[0], controlPoints[0]), distanceKm(parsed.geometry.at(-1), controlPoints.at(-1))];
  const maximumEndpointKm = Math.max(...endpointDistances);
  const warnings = [...parsed.warnings];
  if (maximumEndpointKm > 2) warnings.push(`A recorded endpoint is ${maximumEndpointKm.toFixed(2)} km from the selected leg anchor.`);
  if (parsed.gaps.length || maximumEndpointKm > 5) throw new GpxImportError("The GPX has a large gap or does not align safely with the selected leg. The saved route was kept.", { unsafe: true, warnings });
  return {
    ...parsed,
    mode: segment.mode,
    maxEndpointKm: maximumEndpointKm,
    warnings,
    controlPoints: controlPoints.map((point) => [...point]),
    provenance: {
      kind: "gpx",
      source: "Private traveler-supplied GPX track",
      originalPrivate: true,
      mode: segment.mode,
      distanceKm: parsed.distanceKm,
      rawPointCount: parsed.rawPointCount,
      simplifiedPointCount: parsed.pointCount,
      sectionCount: parsed.sectionCount,
      simplifyToleranceMeters: tolerance,
      gapThresholdKm
    }
  };
}
