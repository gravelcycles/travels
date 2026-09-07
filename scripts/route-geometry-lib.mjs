export function haversine(a, b) {
  const radians = Math.PI / 180;
  const dLat = (b[1] - a[1]) * radians;
  const dLng = (b[0] - a[0]) * radians;
  const lat1 = a[1] * radians;
  const lat2 = b[1] * radians;
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function compareIds(a, b) {
  return String(a).localeCompare(String(b), "en", { numeric: true });
}

function compareQueueItems(a, b) {
  return a[0] - b[0] || compareIds(a[1], b[1]);
}

class MinHeap {
  constructor() { this.items = []; }
  push(item) {
    this.items.push(item);
    let index = this.items.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (compareQueueItems(this.items[parent], item) <= 0) break;
      this.items[index] = this.items[parent];
      index = parent;
    }
    this.items[index] = item;
  }
  pop() {
    if (!this.items.length) return null;
    const first = this.items[0];
    const last = this.items.pop();
    if (this.items.length) {
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        if (left >= this.items.length) break;
        const child = right < this.items.length && compareQueueItems(this.items[right], this.items[left]) < 0 ? right : left;
        if (compareQueueItems(this.items[child], last) >= 0) break;
        this.items[index] = this.items[child];
        index = child;
      }
      this.items[index] = last;
    }
    return first;
  }
}

export function buildGraph(overpass, { weldGapsKm = 0, weldCellDegrees = 0.0008 } = {}) {
  if (!overpass || !Array.isArray(overpass.elements)) throw new Error("Network input must contain an Overpass elements array");
  const coordinates = new Map();
  const adjacency = new Map();
  for (const element of overpass.elements) {
    if (element.type === "node" && Number.isFinite(element.lon) && Number.isFinite(element.lat)) coordinates.set(element.id, [element.lon, element.lat]);
  }
  for (const element of overpass.elements) {
    if (element.type !== "way" || !Array.isArray(element.nodes)) continue;
    for (let index = 1; index < element.nodes.length; index += 1) {
      const a = element.nodes[index - 1];
      const b = element.nodes[index];
      if (!coordinates.has(a) || !coordinates.has(b)) continue;
      const distance = haversine(coordinates.get(a), coordinates.get(b));
      if (!adjacency.has(a)) adjacency.set(a, []);
      if (!adjacency.has(b)) adjacency.set(b, []);
      adjacency.get(a).push([b, distance]);
      adjacency.get(b).push([a, distance]);
    }
  }
  if (weldGapsKm > 0) {
    const cells = new Map();
    const endpoints = [...adjacency.keys()].filter((id) => adjacency.get(id).length === 1).sort(compareIds);
    for (const id of endpoints) {
      const [lng, lat] = coordinates.get(id);
      const x = Math.floor(lng / weldCellDegrees);
      const y = Math.floor(lat / weldCellDegrees);
      for (let dx = -1; dx <= 1; dx += 1) {
        for (let dy = -1; dy <= 1; dy += 1) {
          for (const candidate of cells.get(`${x + dx}:${y + dy}`) || []) {
            const distance = haversine(coordinates.get(id), coordinates.get(candidate));
            if (distance > weldGapsKm) continue;
            adjacency.get(id).push([candidate, distance]);
            adjacency.get(candidate).push([id, distance]);
          }
        }
      }
      const key = `${x}:${y}`;
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push(id);
    }
  }
  for (const neighbors of adjacency.values()) neighbors.sort((a, b) => a[1] - b[1] || compareIds(a[0], b[0]));
  const components = new Map();
  let componentId = 0;
  for (const id of [...adjacency.keys()].sort(compareIds)) {
    if (components.has(id)) continue;
    componentId += 1;
    const stack = [id];
    components.set(id, componentId);
    while (stack.length) {
      const current = stack.pop();
      for (const [next] of adjacency.get(current) || []) {
        if (components.has(next)) continue;
        components.set(next, componentId);
        stack.push(next);
      }
    }
  }
  return { coordinates, adjacency, components };
}

export function nearestNodes(graph, point, { limit = 250, maxDistanceKm = 4 } = {}) {
  const best = [];
  for (const [id, coordinate] of graph.coordinates) {
    if (!graph.adjacency.has(id)) continue;
    const cutoff = best.length === limit ? best[best.length - 1].distance : maxDistanceKm;
    const roughLat = Math.abs(coordinate[1] - point[1]) * 111;
    const roughLng = Math.abs(coordinate[0] - point[0]) * 111 * Math.max(0.15, Math.cos(point[1] * Math.PI / 180));
    if (roughLat > cutoff || roughLng > cutoff) continue;
    const distance = haversine(coordinate, point);
    if (distance > cutoff) continue;
    best.push({ id, distance, component: graph.components.get(id) });
    best.sort((a, b) => a.distance - b.distance || compareIds(a.id, b.id));
    if (best.length > limit) best.pop();
  }
  if (!best.length) throw new Error(`No network node within ${maxDistanceKm} km`);
  return best;
}

export function shortestPath(graph, start, target) {
  if (start === target) return [start];
  const targetCoordinate = graph.coordinates.get(target);
  const queue = new MinHeap();
  const distances = new Map([[start, 0]]);
  const previous = new Map();
  queue.push([haversine(graph.coordinates.get(start), targetCoordinate), start, 0]);
  while (queue.items.length) {
    const [, current, traveled] = queue.pop();
    if (traveled !== distances.get(current)) continue;
    if (current === target) break;
    for (const [next, edgeDistance] of graph.adjacency.get(current) || []) {
      const candidate = traveled + edgeDistance;
      const known = distances.get(next) ?? Infinity;
      if (candidate > known || (candidate === known && compareIds(current, previous.get(next)) >= 0)) continue;
      distances.set(next, candidate);
      previous.set(next, current);
      queue.push([candidate + haversine(graph.coordinates.get(next), targetCoordinate), next, candidate]);
    }
  }
  if (!previous.has(target)) throw new Error("Network points are disconnected");
  const path = [target];
  while (path[path.length - 1] !== start) path.push(previous.get(path[path.length - 1]));
  return path.reverse();
}

function pointLineDistance(point, start, end) {
  const latitudeScale = Math.cos(((start[1] + end[1]) / 2) * Math.PI / 180);
  const px = point[0] * latitudeScale;
  const py = point[1];
  const sx = start[0] * latitudeScale;
  const sy = start[1];
  const ex = end[0] * latitudeScale;
  const ey = end[1];
  const dx = ex - sx;
  const dy = ey - sy;
  const length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((px - sx) * dx + (py - sy) * dy) / length)) : 0;
  return Math.hypot(px - (sx + t * dx), py - (sy + t * dy));
}

export function simplify(points, tolerance = 0.00008) {
  if (points.length <= 2) return points;
  let maxDistance = 0;
  let split = 0;
  for (let index = 1; index < points.length - 1; index += 1) {
    const distance = pointLineDistance(points[index], points[0], points[points.length - 1]);
    if (distance > maxDistance) { maxDistance = distance; split = index; }
  }
  if (maxDistance <= tolerance) return [points[0], points[points.length - 1]];
  return [...simplify(points.slice(0, split + 1), tolerance).slice(0, -1), ...simplify(points.slice(split), tolerance)];
}

function snapPair(startCandidates, targetCandidates, legNumber, ambiguityKm) {
  const pairs = [];
  for (const start of startCandidates) {
    for (const target of targetCandidates) {
      if (start.component !== target.component) continue;
      pairs.push({ start, target, component: start.component, score: start.distance + target.distance });
    }
  }
  pairs.sort((a, b) => a.score - b.score || a.component - b.component || compareIds(a.start.id, b.start.id) || compareIds(a.target.id, b.target.id));
  if (!pairs.length) {
    const startSummary = startCandidates.slice(0, 5).map((item) => `${item.component}@${item.distance.toFixed(2)}`).join(",");
    const targetSummary = targetCandidates.slice(0, 5).map((item) => `${item.component}@${item.distance.toFixed(2)}`).join(",");
    throw new Error(`Network points are disconnected at leg ${legNumber} (${startSummary} → ${targetSummary})`);
  }
  const selected = pairs[0];
  const competing = pairs.find((pair) => pair.component !== selected.component && pair.score - selected.score <= ambiguityKm);
  return { selected, warning: competing ? `Ambiguous network snap at leg ${legNumber}: components ${selected.component} and ${competing.component} differ by ${(competing.score - selected.score).toFixed(3)} km` : null };
}

export function routeSegment(graph, waypoints, segmentId, { maxSnapKm = 4, ambiguityKm = 0.05, simplifyTolerance = 0.00008 } = {}) {
  if (!Array.isArray(waypoints) || waypoints.length < 2) throw new Error(`${segmentId}: at least two waypoints are required`);
  const candidates = waypoints.map((point) => nearestNodes(graph, point, { maxDistanceKm: maxSnapKm }));
  const snapped = [];
  const warnings = [];
  const coordinates = [];
  for (let index = 1; index < candidates.length; index += 1) {
    const { selected, warning } = snapPair(candidates[index - 1], candidates[index], index, ambiguityKm);
    if (warning) warnings.push(warning);
    snapped.push(selected.start, selected.target);
    const leg = shortestPath(graph, selected.start.id, selected.target.id).map((id) => graph.coordinates.get(id));
    coordinates.push(...(coordinates.length ? leg.slice(1) : leg));
  }
  if (coordinates.length === 1) coordinates.push([...coordinates[0]]);
  coordinates[0] = waypoints[0];
  coordinates[coordinates.length - 1] = waypoints[waypoints.length - 1];
  const geometry = simplify(coordinates, simplifyTolerance).map(([lng, lat]) => [Number(lng.toFixed(5)), Number(lat.toFixed(5))]);
  return { geometry, warnings, rawPointCount: coordinates.length, pointCount: geometry.length, maxSnapKm: Math.max(...snapped.map((item) => item.distance)) };
}
