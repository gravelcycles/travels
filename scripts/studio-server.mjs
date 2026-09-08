#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createJourney } from "./create-journey.mjs";
import { loadContent, validateOverrides } from "./journey-content.mjs";
import { renderJourneyPage, studioAsset, readOverrides } from "./build-site.mjs";
import { proposeStudioRoute } from "./studio-route-service.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.ATLAS_STUDIO_PORT || 4173);
const photoPath = path.join(repoRoot, "content/photo-overrides.json");
const routePath = path.join(repoRoot, "content/route-overrides.json");
const dayPath = path.join(repoRoot, "content/day-overrides.json");
const backupDirectory = path.join(repoRoot, "build/studio-backups");
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp"
};

function readJson(filename) {
  return JSON.parse(fs.readFileSync(filename, "utf8"));
}

function isPlainObject(value) {
  return Boolean(value) && !Array.isArray(value) && typeof value === "object";
}

function validCoordinate(point) {
  return Array.isArray(point) && point.length === 2 && Number.isFinite(point[0]) && Number.isFinite(point[1]) && Math.abs(point[0]) <= 180 && Math.abs(point[1]) <= 90;
}

function validateState(state) {
  if (!isPlainObject(state) || !isPlainObject(state.photos) || !isPlainObject(state.routes) || !isPlainObject(state.days)) throw new Error("State must contain photo, route, and day objects");
  for (const [id, photo] of Object.entries(state.photos)) {
    if (!id || !isPlainObject(photo)) throw new Error("Invalid photo override");
    if (photo.location != null) {
      if (!isPlainObject(photo.location) || !Number.isFinite(photo.location.lng) || !Number.isFinite(photo.location.lat)) throw new Error(`Invalid location for ${id}`);
      if (Math.abs(photo.location.lng) > 180 || Math.abs(photo.location.lat) > 90) throw new Error(`Out-of-range location for ${id}`);
    }
    for (const field of ["caption", "description", "alt", "locationLabel", "dayId"]) {
      if (photo[field] != null && typeof photo[field] !== "string") throw new Error(`Invalid ${field} for ${id}`);
    }
  }
  for (const [id, route] of Object.entries(state.routes)) {
    if (!id || !isPlainObject(route)) throw new Error("Invalid route override");
    for (const field of ["controlPoints", "geometry"]) {
      if (!Array.isArray(route[field]) || route[field].length < 2 || !route[field].every(validCoordinate)) throw new Error(`Invalid ${field} for ${id}`);
    }
  }
  for (const [id, day] of Object.entries(state.days)) {
    if (!id || !isPlainObject(day)) throw new Error("Invalid day override");
    for (const field of ["date", "title", "text"]) {
      if (day[field] != null && typeof day[field] !== "string") throw new Error(`Invalid ${field} for ${id}`);
    }
  }
}

function writeJsonAtomic(filename, value) {
  const temporary = `${filename}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(temporary, filename);
}

function saveState(state) {
  validateState(state);
  validateOverrides(state, loadContent(repoRoot, { includeDrafts: true }).data);
  fs.mkdirSync(backupDirectory, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  fs.copyFileSync(photoPath, path.join(backupDirectory, `${stamp}-photo-overrides.json`));
  fs.copyFileSync(routePath, path.join(backupDirectory, `${stamp}-route-overrides.json`));
  fs.copyFileSync(dayPath, path.join(backupDirectory, `${stamp}-day-overrides.json`));
  const { data } = loadContent(repoRoot, { includeDrafts: true });
  const published = data.journeys.filter(j => j.published);
  const publicIds = { photos: new Set(published.flatMap(j => j.photos.map(p => p.id))), routes: new Set(published.flatMap(j => j.segments.map(s => s.id))), days: new Set(published.flatMap(j => j.days.map(d => d.id))) };
  const subset = (kind, publicOnly) => Object.fromEntries(Object.entries(state[kind]).filter(([id]) => publicIds[kind].has(id) === publicOnly));
  const draftPath = path.join(repoRoot, "build/studio-draft-overrides.json");
  if (fs.existsSync(draftPath)) fs.copyFileSync(draftPath, path.join(backupDirectory, `${stamp}-draft-overrides.json`));
  writeJsonAtomic(draftPath, Object.fromEntries(Object.keys(publicIds).map(kind => [kind, subset(kind, false)])));
  writeJsonAtomic(photoPath, subset("photos", true));
  writeJsonAtomic(routePath, subset("routes", true));
  writeJsonAtomic(dayPath, subset("days", true));
  execFileSync(process.execPath, [path.join(repoRoot, "scripts/build-content-overrides.mjs")], { cwd: repoRoot, stdio: "inherit" });
}

function send(response, status, body, contentType = "text/plain; charset=utf-8") {
  response.writeHead(status, { "Content-Type": contentType, "Cache-Control": "no-store" });
  response.end(body);
}

function serveFile(response, filename) {
  if (!fs.existsSync(filename) || !fs.statSync(filename).isFile()) return send(response, 404, "Not found");
  response.writeHead(200, { "Content-Type": mimeTypes[path.extname(filename)] || "application/octet-stream", "Cache-Control": "no-store" });
  fs.createReadStream(filename).pipe(response);
}

function staticFileFor(pathname) {
  if (pathname === "/" || pathname === "/studio" || pathname === "/studio/") return path.join(repoRoot, "studio/index.html");
  if (pathname === "/studio.css" || pathname === "/studio.js") return path.join(repoRoot, "studio", pathname.slice(1));
  if (pathname.startsWith("/dist/")) {
    const relative = pathname.slice(6);
    const resolved = path.resolve(repoRoot, "dist", relative || "index.html");
    const distRoot = path.join(repoRoot, "dist");
    if (resolved === distRoot || resolved.startsWith(`${distRoot}${path.sep}`)) return resolved;
  }
  if (/^\/build\/[a-z0-9-]+\/[^/]+\.webp$/.test(pathname)) {
    const resolved = path.resolve(repoRoot, pathname.slice(1));
    if (resolved.startsWith(`${path.join(repoRoot, "build")}${path.sep}`)) return resolved;
  }

  return null;
}

const server = http.createServer((request, response) => {
  const remote = request.socket.remoteAddress;
  if (remote !== "127.0.0.1" && remote !== "::1" && remote !== "::ffff:127.0.0.1") return send(response, 403, "Atlas Studio is local only");
  if (![ `127.0.0.1:${port}`, `localhost:${port}` ].includes(request.headers.host)) return send(response, 403, "Unexpected host");
  const url = new URL(request.url, `http://127.0.0.1:${port}`);
  // Only same-origin browser writes may reach the loopback editor.
  if (!["GET", "HEAD"].includes(request.method) && request.headers.origin && request.headers.origin !== `http://127.0.0.1:${port}` && request.headers.origin !== `http://localhost:${port}`) return send(response, 403, "Unexpected origin");
  if (request.method === "GET" && url.pathname.startsWith("/api/preview-assets/")) {
    try { return send(response, 200, studioAsset(repoRoot, path.basename(url.pathname, ".js")), "text/javascript; charset=utf-8"); }
    catch (error) { return send(response, 400, error.message); }
  }
  if (request.method === "GET" && url.pathname.startsWith("/preview/")) {
    try {
      const { data } = loadContent(repoRoot, { includeDrafts: true });
      const journey = data.journeys.find(j => (j.slug || `${j.id}.html`) === url.pathname.slice(9));
      if (!journey) return send(response, 404, "Unknown journey");
      return send(response, 200, renderJourneyPage(repoRoot, journey, { preview: true }), "text/html; charset=utf-8");
    } catch (error) { return send(response, 400, error.message); }
  }
  if (request.method === "POST" && url.pathname === "/api/journeys") {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", chunk => { body += chunk; if (body.length > 10000) request.destroy(); });
    request.on("end", () => {
      try { const journey = createJourney(repoRoot, JSON.parse(body)); return send(response, 201, JSON.stringify({ ok: true, journey }), "application/json; charset=utf-8"); }
      catch (error) { return send(response, 400, JSON.stringify({ ok: false, error: error.message }), "application/json; charset=utf-8"); }
    });
    return;
  }
  if (request.method === "GET" && url.pathname === "/api/state") {
    return send(response, 200, JSON.stringify(readOverrides(repoRoot)), "application/json; charset=utf-8");
  }
  if (request.method === "PUT" && url.pathname === "/api/state") {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2_000_000) request.destroy();
    });
    request.on("end", () => {
      try {
        saveState(JSON.parse(body));
        send(response, 200, JSON.stringify({ ok: true }), "application/json; charset=utf-8");
      } catch (error) {
        send(response, 400, JSON.stringify({ ok: false, error: error.message }), "application/json; charset=utf-8");
      }
    });
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/route-proposal") {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 500_000) request.destroy();
    });
    request.on("end", () => {
      try {
        const proposal = proposeStudioRoute({ ...JSON.parse(body), repoRoot });
        send(response, 200, JSON.stringify({ ok: true, proposal }), "application/json; charset=utf-8");
      } catch (error) {
        send(response, 422, JSON.stringify({ ok: false, error: error.message, unsafe: Boolean(error.unsafe), warnings: error.warnings || [] }), "application/json; charset=utf-8");
      }
    });
    return;
  }
  if (request.method !== "GET") return send(response, 405, "Method not allowed");
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { return send(response, 400, "Invalid URL encoding"); }
  const filename = staticFileFor(pathname);
  if (!filename) return send(response, 404, "Not found");
  serveFile(response, filename);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Atlas Studio: http://127.0.0.1:${port}/studio/`);
  console.log("Press Ctrl+C to stop.");
});
