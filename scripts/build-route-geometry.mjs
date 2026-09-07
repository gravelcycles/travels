#!/usr/bin/env node

import fs from "node:fs";
import vm from "node:vm";

const [railPath, ferryPath, outputPath = "dist/assets/route-geometry.js"] = process.argv.slice(2);
if (!railPath || !ferryPath) {
  console.error("Usage: node scripts/build-route-geometry.mjs <rail-overpass.json> <ferry-overpass.json> [output.js]");
  process.exit(1);
}

const context = { window: {} };
vm.runInNewContext(fs.readFileSync("dist/assets/journeys.js", "utf8"), context);
const data = context.window.JOURNEY_ATLAS_DATA;
const journey = data.journeys.find((item) => item.id === data.defaultJourneyId);

function haversine(a, b) {
  const radians = Math.PI / 180;
  const dLat = (b[1] - a[1]) * radians;
  const dLng = (b[0] - a[0]) * radians;
  const lat1 = a[1] * radians;
  const lat2 = b[1] * radians;
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

class MinHeap {
  constructor() { this.items = []; }
  push(item) {
    this.items.push(item);
    let index = this.items.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.items[parent][0] <= item[0]) break;
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
        const child = right < this.items.length && this.items[right][0] < this.items[left][0] ? right : left;
        if (this.items[child][0] >= last[0]) break;
        this.items[index] = this.items[child];
        index = child;
      }
      this.items[index] = last;
    }
    return first;
  }
}

function buildGraph(overpass, weldGaps = false) {
  const coordinates = new Map();
  const adjacency = new Map();
  for (const element of overpass.elements) {
    if (element.type === "node") coordinates.set(element.id, [element.lon, element.lat]);
  }
  for (const element of overpass.elements) {
    if (element.type !== "way" || !element.nodes) continue;
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
  if (weldGaps) {
    const cellSize = 0.0008;
    const cells = new Map();
    const endpoints = [...adjacency.keys()].filter((id) => adjacency.get(id).length === 1);
    for (const id of endpoints) {
      const [lng, lat] = coordinates.get(id);
      const x = Math.floor(lng / cellSize);
      const y = Math.floor(lat / cellSize);
      for (let dx = -1; dx <= 1; dx += 1) {
        for (let dy = -1; dy <= 1; dy += 1) {
          for (const candidate of cells.get(`${x + dx}:${y + dy}`) || []) {
            const distance = haversine(coordinates.get(id), coordinates.get(candidate));
            if (distance > 0.065) continue;
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
  const components = new Map();
  let componentId = 0;
  for (const id of adjacency.keys()) {
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

function nearestNodes(graph, point, limit = 250, maxDistanceKm = 4) {
  const best = [];
  for (const [id, coordinate] of graph.coordinates) {
    if (!graph.adjacency.has(id)) continue;
    const cutoff = best.length === limit ? best[best.length - 1].distance : maxDistanceKm;
    const roughLat = Math.abs(coordinate[1] - point[1]) * 111;
    const roughLng = Math.abs(coordinate[0] - point[0]) * 78;
    if (roughLat > cutoff || roughLng > cutoff) continue;
    const distance = haversine(coordinate, point);
    if (distance > cutoff) continue;
    best.push({ id, distance, component: graph.components.get(id) });
    best.sort((a, b) => a.distance - b.distance);
    if (best.length > limit) best.pop();
  }
  if (!best.length) throw new Error(`No network node within ${maxDistanceKm} km`);
  return best;
}

function shortestPath(graph, start, target) {
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
      if (candidate >= (distances.get(next) ?? Infinity)) continue;
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

function simplify(points, tolerance = 0.00008) {
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

function routeSegment(graph, waypoints, segmentId) {
  const candidates = waypoints.map((point) => nearestNodes(graph, point));
  const snapped = [];
  const coordinates = [];
  for (let index = 1; index < candidates.length; index += 1) {
    let pair = null;
    for (const start of candidates[index - 1]) {
      for (const target of candidates[index]) {
        if (start.component !== target.component) continue;
        const score = start.distance + target.distance;
        if (!pair || score < pair.score) pair = { start, target, score };
      }
    }
    if (!pair) {
      const startSummary = candidates[index - 1].slice(0, 5).map((item) => `${item.component}@${item.distance.toFixed(2)}`).join(",");
      const targetSummary = candidates[index].slice(0, 5).map((item) => `${item.component}@${item.distance.toFixed(2)}`).join(",");
      throw new Error(`Network points are disconnected at leg ${index} (${startSummary} → ${targetSummary})`);
    }
    snapped.push(pair.start, pair.target);
    const nodePath = shortestPath(graph, pair.start.id, pair.target.id);
    const leg = nodePath.map((id) => graph.coordinates.get(id));
    coordinates.push(...(coordinates.length ? leg.slice(1) : leg));
  }
  coordinates[0] = waypoints[0];
  coordinates[coordinates.length - 1] = waypoints[waypoints.length - 1];
  const simplified = simplify(coordinates).map(([lng, lat]) => [Number(lng.toFixed(5)), Number(lat.toFixed(5))]);
  console.log(`${segmentId}: ${coordinates.length} OSM nodes → ${simplified.length} points; max snap ${Math.max(...snapped.map((item) => item.distance)).toFixed(2)} km`);
  return simplified;
}

const railGraph = buildGraph(JSON.parse(fs.readFileSync(railPath, "utf8")), true);
const ferryGraph = buildGraph(JSON.parse(fs.readFileSync(ferryPath, "utf8")));
const places = new Map(journey.places.map((place) => [place.id, place]));
const geometry = {};

for (const segment of journey.segments) {
  if (segment.mode !== "train" && segment.mode !== "boat") continue;
  const from = places.get(segment.from);
  const to = places.get(segment.to);
  const intermediate = segment.stops || segment.via || [];
  const waypoints = [
    [from.lng, from.lat],
    ...intermediate.map((point) => Array.isArray(point) ? [point[1], point[0]] : [point.lng, point.lat]),
    [to.lng, to.lat]
  ];
  try {
    geometry[segment.id] = routeSegment(segment.mode === "train" ? railGraph : ferryGraph, waypoints, segment.id);
  } catch (error) {
    console.warn(`${segment.id}: kept reviewed fallback (${error.message})`);
  }
}

const source = `/* Generated from OpenStreetMap geometry via scripts/build-route-geometry.mjs. */\nwindow.JOURNEY_ATLAS_ROUTE_GEOMETRY = ${JSON.stringify(geometry)};\n`;
fs.writeFileSync(outputPath, source);
console.log(`Wrote ${Object.keys(geometry).length} route geometries to ${outputPath}`);
