(function () {
  "use strict";

  const data = window.JOURNEY_ATLAS_DATA;
  const journey = data.journeys.find((item) => item.id === data.defaultJourneyId);
  const routeGeometry = window.JOURNEY_ATLAS_ROUTE_GEOMETRY || {};
  const basePhotos = window.JOURNEY_ATLAS_TRIP_PHOTOS || [];
  const styleUrl = "https://tiles.openfreemap.org/styles/liberty";
  const photoZoomLimits = { min: 2, max: 20 };
  let state = { photos: {}, routes: {} };
  let mode = "photos";
  let selectedPhotoId = basePhotos[0]?.id || null;
  let selectedSegmentId = journey.days.flatMap((day) => day.segmentIds)[0] || null;
  let map;
  let mapReady = false;
  let activeMarkers = [];
  let routePoints = [];
  let routeSmoothed = false;
  let routeHistory = [];
  let routeHistoryIndex = -1;
  let selectedRoutePoint = -1;
  let dirty = false;

  const $ = (selector) => document.querySelector(selector);

  function clampPhotoZoom(value) {
    return Math.max(photoZoomLimits.min, Math.min(photoZoomLimits.max, value));
  }

  function captureCurrentMapZoom() {
    if (!mapReady) return;
    $("#photo-zoom").value = clampPhotoZoom(Number(map.getZoom().toFixed(2)));
  }

  function applyBasemapTreatment() {
    const layers = map.getStyle().layers || [];
    layers.forEach((layer) => {
      if (/poi/i.test(layer.id || "")) map.setLayoutProperty(layer.id, "visibility", "none");
    });
    const paint = (id, property, value) => {
      if (map.getLayer(id)) map.setPaintProperty(id, property, value);
    };
    paint("background", "background-color", "#f1eee5");
    paint("natural_earth", "raster-opacity", ["interpolate", ["linear"], ["zoom"], 0, 0.62, 5.5, 0.34, 8, 0.06]);
    paint("natural_earth", "raster-contrast", 0.12);
    paint("water", "fill-color", "#a5cadb");
    paint("waterway_river", "line-color", "#82b5cc");
    paint("waterway_other", "line-color", "#82b5cc");
    paint("park", "fill-color", "#c2d9b5");
    paint("park", "fill-opacity", 0.7);
    paint("landcover_wood", "fill-color", "#a3c393");
    paint("landcover_wood", "fill-opacity", 0.5);
    paint("landcover_grass", "fill-color", "#cbdcbe");
    paint("landcover_grass", "fill-opacity", 0.38);
    paint("road_motorway_casing", "line-color", "#cf8960");
    paint("road_trunk_primary_casing", "line-color", "#d19b70");
    paint("road_secondary_tertiary_casing", "line-color", "#d8ad82");
  }

  function placeById(id) {
    return journey.places.find((place) => place.id === id);
  }

  function segmentById(id) {
    return journey.segments.find((segment) => segment.id === id);
  }

  function dayById(id) {
    return journey.days.find((day) => day.id === id);
  }

  function dayForSegment(segmentId) {
    return journey.days.find((day) => day.segmentIds.includes(segmentId));
  }

  function photoUrl(url) {
    if (url?.includes("/releases/download/trip-photos-v1/")) return `/build/trip-photos-v1/${decodeURIComponent(url.split("/").pop())}`;
    return url || "";
  }

  function photoWithOverride(photo) {
    const override = state.photos[photo.id] || {};
    return { ...photo, ...override, ...(override.location || {}) };
  }

  function baseSegmentCoordinates(segment) {
    if (segment.geometry?.length > 1) return segment.geometry;
    if (routeGeometry[segment.id]?.length > 1) return routeGeometry[segment.id];
    const from = placeById(segment.from);
    const to = placeById(segment.to);
    const intermediate = segment.via || segment.stops || [];
    return [
      [from.lng, from.lat],
      ...intermediate.map((point) => Array.isArray(point) ? [point[1], point[0]] : [point.lng, point.lat]),
      [to.lng, to.lat]
    ];
  }

  function segmentCoordinates(segment) {
    if (state.routes[segment.id]?.geometry?.length > 1) return state.routes[segment.id].geometry;
    return baseSegmentCoordinates(segment);
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
    const amount = length ? Math.max(0, Math.min(1, ((px - sx) * dx + (py - sy) * dy) / length)) : 0;
    return Math.hypot(px - (sx + amount * dx), py - (sy + amount * dy));
  }

  function simplifyCoordinates(points, tolerance) {
    if (points.length <= 2) return points.map((point) => [...point]);
    let maximum = 0;
    let splitIndex = 0;
    for (let index = 1; index < points.length - 1; index += 1) {
      const distance = pointLineDistance(points[index], points[0], points[points.length - 1]);
      if (distance > maximum) {
        maximum = distance;
        splitIndex = index;
      }
    }
    if (maximum <= tolerance) return [[...points[0]], [...points[points.length - 1]]];
    return [
      ...simplifyCoordinates(points.slice(0, splitIndex + 1), tolerance).slice(0, -1),
      ...simplifyCoordinates(points.slice(splitIndex), tolerance)
    ];
  }

  function defaultControlPoints(segment) {
    const geometry = baseSegmentCoordinates(segment);
    let tolerance = 0.000015;
    let simplified = geometry.map((point) => [...point]);
    while (simplified.length > 26) {
      simplified = simplifyCoordinates(geometry, tolerance);
      tolerance *= 1.6;
    }
    return simplified;
  }

  function markDirty(message = "Unsaved changes") {
    dirty = true;
    const status = $("#save-status");
    status.textContent = message;
    status.className = "dirty";
  }

  function markSaved(message = "Saved locally") {
    dirty = false;
    const status = $("#save-status");
    status.textContent = message;
    status.className = "saved";
  }

  function setStatus(message, className = "") {
    const status = $("#save-status");
    status.textContent = message;
    status.className = className;
  }

  function optionMarkup(day, includeCount = false) {
    const count = basePhotos.filter((photo) => photoWithOverride(photo).dayId === day.id && !photoWithOverride(photo).hidden).length;
    return `<option value="${day.id}">Day ${day.number} · ${day.date} · ${day.title}${includeCount ? ` (${count})` : ""}</option>`;
  }

  function renderDaySelectors() {
    const photoFilter = $("#photo-day-filter");
    const photoDay = $("#photo-day");
    const routeFilter = $("#route-day-filter");
    const previousPhotoFilter = photoFilter.value;
    const previousRouteFilter = routeFilter.value;
    photoFilter.innerHTML = '<option value="all">All days</option>' + journey.days.map((day) => optionMarkup(day, true)).join("");
    photoDay.innerHTML = journey.days.map((day) => optionMarkup(day)).join("");
    routeFilter.innerHTML = journey.days.map((day) => `<option value="${day.id}">Day ${day.number} · ${day.date} · ${day.title}</option>`).join("");
    photoFilter.value = previousPhotoFilter || photoWithOverride(basePhotos[0]).dayId;
    routeFilter.value = previousRouteFilter || dayForSegment(selectedSegmentId)?.id || journey.days[0].id;
  }

  function renderPhotoGrid() {
    const filter = $("#photo-day-filter").value;
    const photos = basePhotos.map(photoWithOverride).filter((photo) => filter === "all" || photo.dayId === filter);
    $("#studio-photo-grid").innerHTML = photos.map((photo) => {
      const thumb = photo.srcset?.[0]?.src || photo.src;
      const located = Number.isFinite(photo.lat) && Number.isFinite(photo.lng);
      return `<button type="button" data-photo-id="${photo.id}" class="${photo.id === selectedPhotoId ? "active" : ""}" aria-label="Edit ${photo.caption}">
        <img src="${photoUrl(thumb)}" alt="" loading="lazy" />
        <span>${photo.takenAt || photo.caption}</span>
        <i class="${located ? "" : "unlocated"}" title="${located ? "Located" : "Needs location"}"></i>
      </button>`;
    }).join("");
    const selected = $("#studio-photo-grid .active");
    if (selected) selected.scrollIntoView({ block: "nearest" });
  }

  function selectPhoto(id, center = true) {
    const base = basePhotos.find((photo) => photo.id === id);
    if (!base) return;
    selectedPhotoId = id;
    const photo = photoWithOverride(base);
    $("#selected-photo").innerHTML = `<img src="${photoUrl(photo.srcset?.find((item) => item.width >= 1280)?.src || photo.src)}" alt="" /><span>${photo.sourceFilename || photo.id}</span>`;
    $("#photo-day").value = photo.dayId;
    $("#photo-place").value = photo.locationLabel || "";
    $("#photo-lat").value = Number.isFinite(photo.lat) ? photo.lat : "";
    $("#photo-lng").value = Number.isFinite(photo.lng) ? photo.lng : "";
    $("#photo-zoom").value = photo.zoom || 16;
    $("#photo-caption").value = photo.caption || "";
    $("#photo-description").value = photo.description || "";
    $("#photo-alt").value = photo.alt || "";
    $("#photo-hidden").checked = Boolean(photo.hidden);
    renderPhotoGrid();
    if (mapReady) renderPhotoMap(photo, center);
  }

  function readPhotoForm() {
    const base = basePhotos.find((photo) => photo.id === selectedPhotoId);
    if (!base) return;
    const lat = Number($("#photo-lat").value);
    const lng = Number($("#photo-lng").value);
    const zoom = Number($("#photo-zoom").value);
    const override = {
      dayId: $("#photo-day").value,
      caption: $("#photo-caption").value.trim(),
      description: $("#photo-description").value.trim(),
      alt: $("#photo-alt").value.trim(),
      locationLabel: $("#photo-place").value.trim(),
      hidden: $("#photo-hidden").checked
    };
    if (Number.isFinite(lat) && Number.isFinite(lng) && $("#photo-lat").value !== "" && $("#photo-lng").value !== "") {
      override.location = { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
      override.zoom = Number.isFinite(zoom) ? clampPhotoZoom(zoom) : 16;
    }
    state.photos[selectedPhotoId] = override;
    markDirty();
    renderDaySelectors();
    $("#photo-day").value = override.dayId;
    renderPhotoGrid();
    if (mapReady) renderPhotoMap(photoWithOverride(base), false);
  }

  function clearActiveMap() {
    activeMarkers.forEach((marker) => marker.remove());
    activeMarkers = [];
    ["studio-photo-routes-casing", "studio-photo-routes", "studio-original-route", "studio-edited-route-casing", "studio-edited-route"].forEach((id) => {
      if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource(id)) map.removeSource(id);
    });
  }

  function firstLabelLayerId() {
    return map.getStyle().layers.find((layer) => layer.type === "symbol" && layer.layout?.["text-field"])?.id;
  }

  function addLine(id, features, color, width, opacity = 1, dashed = false) {
    map.addSource(id, { type: "geojson", data: { type: "FeatureCollection", features } });
    const paint = { "line-color": color, "line-width": width, "line-opacity": opacity };
    if (dashed) paint["line-dasharray"] = [2, 2];
    map.addLayer({ id, type: "line", source: id, layout: { "line-cap": "round", "line-join": "round" }, paint }, firstLabelLayerId());
  }

  function fitCoordinates(coordinates, maxZoom = 14) {
    if (!coordinates.length) return;
    if (coordinates.length === 1) return map.easeTo({ center: coordinates[0], zoom: maxZoom, duration: 450 });
    const bounds = coordinates.reduce((result, coordinate) => result.extend(coordinate), new maplibregl.LngLatBounds(coordinates[0], coordinates[0]));
    map.fitBounds(bounds, { padding: 70, maxZoom, duration: 500 });
  }

  function renderPhotoMap(photo, center = true) {
    clearActiveMap();
    const day = dayById(photo.dayId);
    const features = day.segmentIds.map(segmentById).filter(Boolean).map((segment) => ({
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: segmentCoordinates(segment) }
    }));
    if (features.length) {
      addLine("studio-photo-routes-casing", features, "#fffef8", 8.5, .82);
      addLine("studio-photo-routes", features, "#006f92", 4.7, .88);
    }
    if (Number.isFinite(photo.lat) && Number.isFinite(photo.lng)) {
      const element = document.createElement("div");
      element.className = "studio-photo-marker";
      const marker = new maplibregl.Marker({ element, draggable: true, anchor: "center" }).setLngLat([photo.lng, photo.lat]).addTo(map);
      marker.on("dragend", () => {
        const position = marker.getLngLat();
        $("#photo-lat").value = position.lat.toFixed(6);
        $("#photo-lng").value = position.lng.toFixed(6);
        captureCurrentMapZoom();
        readPhotoForm();
      });
      activeMarkers.push(marker);
      if (center) map.easeTo({ center: [photo.lng, photo.lat], zoom: photo.zoom || 16, duration: 500 });
    } else if (center) {
      const destination = placeById(day.destinationId || day.placeId);
      const coordinates = day.segmentIds.flatMap((id) => segmentCoordinates(segmentById(id)));
      if (coordinates.length) fitCoordinates(coordinates, 13);
      else map.easeTo({ center: [destination.lng, destination.lat], zoom: 13, duration: 500 });
    }
  }

  function renderRouteList() {
    const day = dayById($("#route-day-filter").value);
    const segments = day.segmentIds.map(segmentById).filter(Boolean);
    $("#studio-route-list").innerHTML = segments.length ? segments.map((segment) => {
      const from = placeById(segment.from);
      const to = placeById(segment.to);
      return `<button type="button" data-segment-id="${segment.id}" class="${segment.id === selectedSegmentId ? "active" : ""}">
        <small>${segment.mode} · ${segment.distanceKm || "—"} km</small>
        <strong>${from.name} → ${to.name}</strong>
        ${state.routes[segment.id] ? "<em>LOCAL OVERRIDE</em>" : ""}
      </button>`;
    }).join("") : '<p class="editor-note">This day has no travel legs.</p>';
  }

  function chaikin(points, iterations = 2) {
    let result = points.map((point) => [...point]);
    for (let pass = 0; pass < iterations; pass += 1) {
      const next = [result[0]];
      for (let index = 1; index < result.length; index += 1) {
        const a = result[index - 1];
        const b = result[index];
        next.push([a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25]);
        next.push([a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75]);
      }
      next.push(result[result.length - 1]);
      result = next;
    }
    return result.map(([lng, lat]) => [Number(lng.toFixed(6)), Number(lat.toFixed(6))]);
  }

  function editedGeometry() {
    return routeSmoothed ? chaikin(routePoints) : routePoints.map((point) => [...point]);
  }

  function updateRouteOverride() {
    state.routes[selectedSegmentId] = {
      controlPoints: routePoints.map((point) => [...point]),
      geometry: editedGeometry(),
      smoothing: routeSmoothed ? "chaikin" : "none"
    };
    $("#route-saved-state").textContent = "Pending save";
    markDirty();
    drawRouteEditor(false);
    renderRouteList();
  }

  function resetHistory(points) {
    routeHistory = [points.map((point) => [...point])];
    routeHistoryIndex = 0;
    $("#undo-route").disabled = true;
    $("#redo-route").disabled = true;
  }

  function commitRoutePoints(points) {
    const previous = routePoints.map((point) => [...point]);
    const recorded = routeHistory[routeHistoryIndex];
    if (!recorded || JSON.stringify(recorded) !== JSON.stringify(previous)) {
      routeHistory = [previous];
      routeHistoryIndex = 0;
    }
    routePoints = points.map((point) => [...point]);
    routeHistory = routeHistory.slice(0, routeHistoryIndex + 1);
    routeHistory.push(routePoints.map((point) => [...point]));
    routeHistoryIndex = routeHistory.length - 1;
    selectedRoutePoint = -1;
    updateRouteOverride();
  }

  function updateUndoButtons() {
    $("#undo-route").disabled = routeHistoryIndex <= 0;
    $("#redo-route").disabled = routeHistoryIndex >= routeHistory.length - 1;
    $("#delete-route-point").disabled = selectedRoutePoint <= 0 || selectedRoutePoint >= routePoints.length - 1;
  }

  function selectRoute(id, center = true) {
    const segment = segmentById(id);
    if (!segment) return;
    selectedSegmentId = id;
    const override = state.routes[id];
    routePoints = (override?.controlPoints || defaultControlPoints(segment)).map((point) => [...point]);
    routeSmoothed = override?.smoothing === "chaikin";
    selectedRoutePoint = -1;
    resetHistory(routePoints);
    const from = placeById(segment.from);
    const to = placeById(segment.to);
    $("#route-title").textContent = `${from.name} → ${to.name}`;
    $("#route-summary").textContent = `${segment.mode.toUpperCase()} · ${segment.distanceKm || "—"} km · ${segment.duration || "duration not set"}`;
    $("#route-saved-state").textContent = override ? "Yes" : "No";
    $("#smooth-route").textContent = routeSmoothed ? "Use straight preview" : "Smooth preview";
    renderRouteList();
    if (mapReady) drawRouteEditor(center);
  }

  function drawRouteEditor(center = false) {
    clearActiveMap();
    const segment = segmentById(selectedSegmentId);
    if (!segment) return;
    const original = segment.geometry?.length > 1 ? segment.geometry : (routeGeometry[segment.id] || segmentCoordinates(segment));
    addLine("studio-original-route", [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: original } }], "#60787b", 7, .42);
    addLine("studio-edited-route-casing", [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: editedGeometry() } }], "#fffef8", 9.5, .94);
    addLine("studio-edited-route", [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: editedGeometry() } }], "#d4512c", 5.8, 1, !routeSmoothed);
    routePoints.forEach((point, index) => {
      const element = document.createElement("button");
      element.type = "button";
      element.className = `route-point-marker ${index === selectedRoutePoint ? "selected" : ""}`;
      element.textContent = String(index + 1);
      element.setAttribute("aria-label", `Route control point ${index + 1}`);
      element.addEventListener("click", (event) => {
        event.stopPropagation();
        selectedRoutePoint = index;
        drawRouteEditor(false);
      });
      const marker = new maplibregl.Marker({ element, draggable: index > 0 && index < routePoints.length - 1, anchor: "center" }).setLngLat(point).addTo(map);
      marker.on("dragend", () => {
        const next = routePoints.map((item) => [...item]);
        const position = marker.getLngLat();
        next[index] = [Number(position.lng.toFixed(6)), Number(position.lat.toFixed(6))];
        commitRoutePoints(next);
      });
      activeMarkers.push(marker);
    });
    $("#route-point-count").textContent = String(routePoints.length);
    updateUndoButtons();
    if (center) fitCoordinates(original, 14);
  }

  function distanceToSegment(point, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = dx * dx + dy * dy;
    const t = length ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length)) : 0;
    return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
  }

  function insertRoutePoint(event) {
    if (routePoints.length < 2) return;
    let nearest = { index: -1, distance: Infinity };
    for (let index = 1; index < routePoints.length; index += 1) {
      const distance = distanceToSegment(event.point, map.project(routePoints[index - 1]), map.project(routePoints[index]));
      if (distance < nearest.distance) nearest = { index, distance };
    }
    if (nearest.distance > 38) {
      setStatus("Click closer to the orange line to insert a point", "error");
      return;
    }
    const next = routePoints.map((point) => [...point]);
    next.splice(nearest.index, 0, [Number(event.lngLat.lng.toFixed(6)), Number(event.lngLat.lat.toFixed(6))]);
    commitRoutePoints(next);
  }

  async function saveAll() {
    setStatus("Saving…");
    try {
      const response = await fetch("/api/state", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state)
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "Save failed");
      markSaved();
      if (mode === "routes") {
        $("#route-saved-state").textContent = "Yes";
        renderRouteList();
      }
    } catch (error) {
      setStatus(error.message, "error");
    }
  }

  function setMode(nextMode) {
    mode = nextMode;
    $(".studio-shell").dataset.mode = mode;
    document.querySelectorAll(".studio-header [data-mode]").forEach((button) => button.classList.toggle("active", button.dataset.mode === mode));
    document.querySelectorAll("[data-panel]").forEach((panel) => { panel.hidden = panel.dataset.panel !== mode; });
    $("#route-tools").hidden = mode !== "routes";
    $("#map-instructions").textContent = mode === "photos"
      ? "Click the map or drag the pin to save this photo's exact location and the current map zoom. Located photos open at that view in the atlas."
      : "Click close to the orange line to insert a control point, then drag numbered points to shape the route.";
    if (!mapReady) return;
    if (mode === "photos") selectPhoto(selectedPhotoId, true);
    else selectRoute(selectedSegmentId, true);
  }

  async function init() {
    try {
      const response = await fetch("/api/state");
      state = await response.json();
    } catch (error) {
      setStatus(`Could not load local edits: ${error.message}`, "error");
      return;
    }
    renderDaySelectors();
    renderPhotoGrid();
    renderRouteList();
    map = new maplibregl.Map({ container: "studio-map", style: styleUrl, center: [8.45, 46.7], zoom: 7.5, attributionControl: false });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }), "bottom-right");
    map.on("load", () => {
      mapReady = true;
      applyBasemapTreatment();
      selectPhoto(selectedPhotoId, true);
      markSaved("Ready");
    });
    map.on("click", (event) => {
      if (mode === "routes") return insertRoutePoint(event);
      if (!selectedPhotoId) return;
      $("#photo-lat").value = event.lngLat.lat.toFixed(6);
      $("#photo-lng").value = event.lngLat.lng.toFixed(6);
      captureCurrentMapZoom();
      readPhotoForm();
      selectPhoto(selectedPhotoId, false);
    });
  }

  document.querySelectorAll(".studio-header [data-mode]").forEach((button) => button.addEventListener("click", () => setMode(button.dataset.mode)));
  $("#save-all").addEventListener("click", saveAll);
  $("#photo-day-filter").addEventListener("change", renderPhotoGrid);
  $("#route-day-filter").addEventListener("change", () => {
    renderRouteList();
    const first = dayById($("#route-day-filter").value).segmentIds[0];
    if (first) selectRoute(first, true);
  });
  $("#studio-photo-grid").addEventListener("click", (event) => {
    const button = event.target.closest("[data-photo-id]");
    if (button) selectPhoto(button.dataset.photoId, true);
  });
  $("#studio-route-list").addEventListener("click", (event) => {
    const button = event.target.closest("[data-segment-id]");
    if (button) selectRoute(button.dataset.segmentId, true);
  });
  $("#photo-form").addEventListener("input", (event) => {
    if (!["photo-lat", "photo-lng", "photo-zoom"].includes(event.target.id)) readPhotoForm();
  });
  $("#photo-form").addEventListener("change", readPhotoForm);
  $("#clear-photo-location").addEventListener("click", () => {
    $("#photo-lat").value = "";
    $("#photo-lng").value = "";
    readPhotoForm();
    selectPhoto(selectedPhotoId, true);
  });
  $("#smooth-route").addEventListener("click", () => {
    routeSmoothed = !routeSmoothed;
    $("#smooth-route").textContent = routeSmoothed ? "Use straight preview" : "Smooth preview";
    updateRouteOverride();
  });
  $("#reset-route").addEventListener("click", () => {
    const segment = segmentById(selectedSegmentId);
    delete state.routes[selectedSegmentId];
    routeSmoothed = false;
    routePoints = defaultControlPoints(segment);
    resetHistory(routePoints);
    markDirty("Override removed; save to keep the reset");
    $("#route-saved-state").textContent = "Removed pending save";
    $("#smooth-route").textContent = "Smooth preview";
    renderRouteList();
    drawRouteEditor(false);
  });
  $("#delete-route-point").addEventListener("click", () => {
    if (selectedRoutePoint <= 0 || selectedRoutePoint >= routePoints.length - 1) return;
    const next = routePoints.map((point) => [...point]);
    next.splice(selectedRoutePoint, 1);
    commitRoutePoints(next);
  });
  $("#undo-route").addEventListener("click", () => {
    if (routeHistoryIndex <= 0) return;
    routeHistoryIndex -= 1;
    routePoints = routeHistory[routeHistoryIndex].map((point) => [...point]);
    selectedRoutePoint = -1;
    updateRouteOverride();
  });
  $("#redo-route").addEventListener("click", () => {
    if (routeHistoryIndex >= routeHistory.length - 1) return;
    routeHistoryIndex += 1;
    routePoints = routeHistory[routeHistoryIndex].map((point) => [...point]);
    selectedRoutePoint = -1;
    updateRouteOverride();
  });
  window.addEventListener("beforeunload", (event) => {
    if (!dirty) return;
    event.preventDefault();
    event.returnValue = "";
  });

  init();
})();
