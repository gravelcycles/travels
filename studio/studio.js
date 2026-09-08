(function () {
  "use strict";

  const data = window.JOURNEY_ATLAS_DATA;
  let journey = data.journeys.find((item) => item.id === data.defaultJourneyId) || data.journeys[0];
  const routeGeometry = window.JOURNEY_ATLAS_ROUTE_GEOMETRY || {};
  const photosByJourney = window.JOURNEY_ATLAS_PHOTOS || {};
  let basePhotos = photosByJourney[journey.id] || journey.photos || [];
  const styleUrl = "https://tiles.openfreemap.org/styles/liberty";
  const photoZoomLimits = { min: 2, max: 20 };
  let state = { photos: {}, routes: {}, days: {} };
  let mode = "photos";
  let selectedPhotoId = basePhotos[0]?.id || null;
  let selectedSegmentId = journey.days.flatMap((day) => day.segmentIds)[0] || null;
  let selectedDayId = journey.days[0]?.id || null;
  let map;
  let mapReady = false;
  let activeMarkers = [];
  let routePoints = [];
  let routeSmoothed = false;
  let routeHistory = [];
  let routeHistoryIndex = -1;
  let selectedRoutePoint = -1;
  let routeProposal = null;
  let routeProposalMeta = null;
  let dirty = false;

  const $ = (selector) => document.querySelector(selector);

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

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
    const day = journey.days.find((item) => item.id === id);
    return day ? { ...day, ...(state.days[day.id] || {}) } : undefined;
  }

  function dayForSegment(segmentId) {
    const day = journey.days.find((item) => item.segmentIds.includes(segmentId));
    return day ? dayById(day.id) : undefined;
  }

  function photoUrl(url) {
    const release = url?.match(/^https:\/\/github\.com\/gravelcycles\/travels\/releases\/download\/([a-z0-9-]+)\/([^/]+\.webp)$/);
    if (release) return `/build/${release[1]}/${release[2]}`;
    if (url?.startsWith("./assets/")) return `/dist/${url.slice(2)}`;
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
    return `<option value="${escapeHtml(day.id)}">Day ${day.number} · ${escapeHtml(day.date)} · ${escapeHtml(day.title)}${includeCount ? ` (${count})` : ""}</option>`;
  }

  function renderDaySelectors() {
    const photoFilter = $("#photo-day-filter");
    const photoDay = $("#photo-day");
    const routeFilter = $("#route-day-filter");
    const dayFilter = $("#day-editor-filter");
    const previousPhotoFilter = photoFilter.value;
    const previousRouteFilter = routeFilter.value;
    const previousDayFilter = dayFilter.value;
    const days = journey.days.map((day) => dayById(day.id));
    photoFilter.innerHTML = '<option value="all">All days</option>' + days.map((day) => optionMarkup(day, true)).join("");
    photoDay.innerHTML = days.map((day) => optionMarkup(day)).join("");
    routeFilter.innerHTML = days.map((day) => `<option value="${escapeHtml(day.id)}">Day ${day.number} · ${escapeHtml(day.date)} · ${escapeHtml(day.title)}</option>`).join("");
    dayFilter.innerHTML = days.map((day) => `<option value="${escapeHtml(day.id)}">Day ${day.number} · ${escapeHtml(day.date)} · ${escapeHtml(day.title)}</option>`).join("");
    photoFilter.value = days.some((day) => day.id === previousPhotoFilter) ? previousPhotoFilter : (basePhotos[0] ? photoWithOverride(basePhotos[0]).dayId : "all");
    routeFilter.value = days.some((day) => day.id === previousRouteFilter) ? previousRouteFilter : (dayForSegment(selectedSegmentId)?.id || days[0]?.id || "");
    dayFilter.value = days.some((day) => day.id === previousDayFilter) ? previousDayFilter : (selectedDayId || days[0]?.id || "");
  }

  function renderJourneySelector() {
    $("#preview-journey").href = `/preview/${journey.slug || `${journey.id}.html`}?photoSource=local`;
    $("#journey-draft-note").hidden = journey.published !== false;
    $("#studio-journey").innerHTML = data.journeys.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === journey.id ? "selected" : ""}>${escapeHtml(item.label)}${item.published === false ? " · Draft" : ""}</option>`).join("");
  }

  function renderDayList() {
    $("#studio-day-list").innerHTML = journey.days.map((baseDay) => {
      const day = dayById(baseDay.id);
      return `<button type="button" data-day-edit-id="${escapeHtml(day.id)}" class="${day.id === selectedDayId ? "active" : ""}">
        <small>Day ${day.number} · ${escapeHtml(day.date)}</small>
        <strong>${escapeHtml(day.title)}</strong>
      </button>`;
    }).join("");
  }

  function selectDay(id, center = true) {
    const day = dayById(id);
    if (!day) return;
    selectedDayId = id;
    $("#day-editor-filter").value = id;
    $("#day-editor-heading").textContent = `Day ${day.number}`;
    $("#day-date").value = day.date || "";
    $("#day-title").value = day.title || "";
    $("#day-description").value = day.text || "";
    renderDayList();
    if (mapReady && mode === "days") renderDayMap(day, center);
  }

  function readDayForm() {
    const baseDay = journey.days.find((day) => day.id === selectedDayId);
    if (!baseDay) return;
    state.days[selectedDayId] = {
      date: $("#day-date").value.trim(),
      title: $("#day-title").value.trim(),
      text: $("#day-description").value.trim()
    };
    markDirty();
    renderDaySelectors();
    $("#day-editor-filter").value = selectedDayId;
    renderDayList();
  }

  function renderPhotoGrid() {
    const filter = $("#photo-day-filter").value;
    const photos = basePhotos.map(photoWithOverride).filter((photo) => filter === "all" || photo.dayId === filter);
    $("#studio-photo-grid").innerHTML = photos.length ? photos.map((photo) => {
      const thumb = photo.srcset?.[0]?.src || photo.src;
      const located = Number.isFinite(photo.lat) && Number.isFinite(photo.lng);
      return `<button type="button" data-photo-id="${photo.id}" class="${photo.id === selectedPhotoId ? "active" : ""}" aria-label="Edit ${escapeHtml(photo.caption)}">
        <img src="${photoUrl(thumb)}" alt="" loading="lazy" />
        <span>${escapeHtml(photo.takenAt || photo.caption)}</span>
        <i class="${located ? "" : "unlocated"}" title="${located ? "Located" : "Needs location"}"></i>
      </button>`;
    }).join("") : '<p class="editor-note">This journey has no photographs to edit.</p>';
    const selected = $("#studio-photo-grid .active");
    if (selected) selected.scrollIntoView({ block: "nearest" });
  }

  function selectPhoto(id, center = true) {
    const base = basePhotos.find((photo) => photo.id === id);
    $("#photo-form").inert = !base;
    if (!base) {
      $("#photo-form").reset();
      $("#selected-photo").textContent = "No photographs yet. Start with the day plan.";
      return;
    }
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
    ["studio-photo-routes-casing", "studio-photo-routes", "studio-original-route", "studio-saved-route-casing", "studio-saved-route", "studio-anchor-guide", "studio-proposed-route-casing", "studio-proposed-route"].forEach((id) => {
      if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource(id)) map.removeSource(id);
    });
  }

  function firstLabelLayerId() {
    return map.getStyle().layers.find((layer) => layer.type === "symbol" && layer.layout?.["text-field"])?.id;
  }

  function addLine(id, features, color, width, opacity = 1, dashArray = null) {
    map.addSource(id, { type: "geojson", data: { type: "FeatureCollection", features } });
    const paint = { "line-color": color, "line-width": width, "line-opacity": opacity };
    if (dashArray) paint["line-dasharray"] = dashArray;
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
      else if (destination) map.easeTo({ center: [destination.lng, destination.lat], zoom: 13, duration: 500 });
      else map.easeTo({ center: [0, 20], zoom: 1.5, duration: 450 });
    }
  }

  function renderDayMap(day, center = true) {
    clearActiveMap();
    const coordinates = day.segmentIds.flatMap((id) => {
      const segment = segmentById(id);
      return segment ? segmentCoordinates(segment) : [];
    });
    const features = day.segmentIds.map(segmentById).filter(Boolean).map((segment) => ({
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: segmentCoordinates(segment) }
    }));
    if (features.length) {
      addLine("studio-photo-routes-casing", features, "#fffef8", 8.5, .82);
      addLine("studio-photo-routes", features, "#006f92", 4.7, .9);
    }
    if (!center) return;
    if (coordinates.length) fitCoordinates(coordinates, 13);
    else {
      const destination = placeById(day.destinationId || day.placeId);
      if (destination) map.easeTo({ center: [destination.lng, destination.lat], zoom: 12, duration: 450 });
      else map.easeTo({ center: [0, 20], zoom: 1.5, duration: 450 });
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
        <strong>${escapeHtml(from.name)} → ${escapeHtml(to.name)}</strong>
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

  function setProposalStatus(message, className = "") {
    const status = $("#route-proposal-status");
    status.textContent = message;
    status.className = className;
  }

  function clearRouteProposal(message = "Anchors changed. Request a new network proposal; the saved route remains active.") {
    routeProposal = null;
    routeProposalMeta = null;
    $("#accept-route-proposal").disabled = true;
    setProposalStatus(message);
  }

  function updateRouteAnchors() {
    const segment = segmentById(selectedSegmentId);
    const existing = state.routes[selectedSegmentId] || {};
    state.routes[selectedSegmentId] = {
      ...existing,
      controlPoints: routePoints.map((point) => [...point]),
      geometry: existing.geometry?.length > 1 ? existing.geometry : baseSegmentCoordinates(segment),
      smoothing: routeSmoothed ? "chaikin" : "none"
    };
    clearRouteProposal();
    $("#route-saved-state").textContent = "Geometry kept · anchors pending";
    markDirty("Anchor changes pending; saved geometry kept");
    drawRouteEditor(false);
    renderRouteList();
  }

  function acceptRouteGeometry(geometry, routing, message) {
    state.routes[selectedSegmentId] = {
      ...(state.routes[selectedSegmentId] || {}),
      controlPoints: routePoints.map((point) => [...point]),
      geometry: geometry.map((point) => [...point]),
      smoothing: routeSmoothed ? "chaikin" : "none",
      routing
    };
    $("#route-saved-state").textContent = "Pending save";
    markDirty(message);
    renderRouteList();
    drawRouteEditor(false);
  }

  function syncEndpointFields() {
    const start = routePoints[0] || [];
    const end = routePoints[routePoints.length - 1] || [];
    $("#route-start-lng").value = Number.isFinite(start[0]) ? start[0] : "";
    $("#route-start-lat").value = Number.isFinite(start[1]) ? start[1] : "";
    $("#route-end-lng").value = Number.isFinite(end[0]) ? end[0] : "";
    $("#route-end-lat").value = Number.isFinite(end[1]) ? end[1] : "";
  }

  function readEndpointFields() {
    if (routePoints.length < 2) return;
    const values = [
      Number($("#route-start-lng").value), Number($("#route-start-lat").value),
      Number($("#route-end-lng").value), Number($("#route-end-lat").value)
    ];
    if (!values.every(Number.isFinite) || Math.abs(values[0]) > 180 || Math.abs(values[2]) > 180 || Math.abs(values[1]) > 90 || Math.abs(values[3]) > 90) {
      setStatus("Enter valid longitude/latitude values for both endpoints", "error");
      syncEndpointFields();
      return;
    }
    const next = routePoints.map((point) => [...point]);
    next[0] = [Number(values[0].toFixed(6)), Number(values[1].toFixed(6))];
    next[next.length - 1] = [Number(values[2].toFixed(6)), Number(values[3].toFixed(6))];
    commitRoutePoints(next);
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
    updateRouteAnchors();
  }

  function updateUndoButtons() {
    $("#undo-route").disabled = routeHistoryIndex <= 0;
    $("#redo-route").disabled = routeHistoryIndex >= routeHistory.length - 1;
    $("#delete-route-point").disabled = selectedRoutePoint <= 0 || selectedRoutePoint >= routePoints.length - 1;
  }

  function clearSelectedRoute() {
    selectedSegmentId = null;
    routePoints = []; routeHistory = []; routeHistoryIndex = -1;
    routeProposal = null; routeProposalMeta = null;
    $("#route-editor").inert = true;
    $("#route-tools").inert = true;
    $("#route-title").textContent = "No travel legs for this day";
    $("#route-summary").textContent = "Start with the day plan; routes can be added as destinations become known.";
    document.querySelectorAll(".endpoint-fields input").forEach(input => { input.value = ""; });
    $("#route-point-count").textContent = "—";
    $("#route-saved-state").textContent = "—";
    clearRouteProposal("No route selected.");
  }

  function selectRoute(id, center = true) {
    $("#route-editor").inert = false;
    $("#route-tools").inert = false;
    const segment = segmentById(id);
    if (!segment) return;
    selectedSegmentId = id;
    const override = state.routes[id];
    routePoints = (override?.controlPoints || defaultControlPoints(segment)).map((point) => [...point]);
    routeSmoothed = override?.smoothing === "chaikin";
    routeProposal = null;
    routeProposalMeta = null;
    selectedRoutePoint = -1;
    resetHistory(routePoints);
    const from = placeById(segment.from);
    const to = placeById(segment.to);
    $("#route-title").textContent = `${from.name} → ${to.name}`;
    $("#route-summary").textContent = `${segment.mode.toUpperCase()} · ${segment.distanceKm || "—"} km · ${segment.duration || "duration not set"}`;
    $("#route-saved-state").textContent = override ? "Yes" : "No";
    $("#smooth-route").textContent = routeSmoothed ? "Use straight anchor guide" : "Smooth anchor guide";
    $("#propose-route").textContent = `Propose ${segment.mode === "boat" ? "ferry" : segment.mode} network route`;
    $("#propose-route").disabled = segment.mode === "gondola";
    $("#accept-route-proposal").disabled = true;
    setProposalStatus(segment.mode === "gondola" ? "No automatic gondola network is configured; the reviewed saved route remains active." : "No proposal yet. The saved route remains active.");
    syncEndpointFields();
    renderRouteList();
    if (mapReady) drawRouteEditor(center);
  }

  function drawRouteEditor(center = false) {
    clearActiveMap();
    const segment = segmentById(selectedSegmentId);
    if (!segment) return;
    const original = baseSegmentCoordinates(segment);
    const saved = state.routes[segment.id]?.geometry?.length > 1 ? state.routes[segment.id].geometry : original;
    const feature = (coordinates) => [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates } }];
    addLine("studio-original-route", feature(original), "#60787b", 7.5, .55, [2, 2]);
    addLine("studio-saved-route-casing", feature(saved), "#fffef8", 9, .9);
    addLine("studio-saved-route", feature(saved), "#006f92", 5, .92);
    addLine("studio-anchor-guide", feature(editedGeometry()), "#d4512c", 3, .92, routeSmoothed ? [1, 1.8] : [1, 2.3]);
    if (routeProposal?.length > 1) {
      addLine("studio-proposed-route-casing", feature(routeProposal), "#fffef8", 11, .94);
      addLine("studio-proposed-route", feature(routeProposal), "#568c3b", 6.5, 1);
    }
    routePoints.forEach((point, index) => {
      const element = document.createElement("button");
      element.type = "button";
      element.className = `route-point-marker ${index === selectedRoutePoint ? "selected" : ""}`;
      element.textContent = String(index + 1);
      const pointName = index === 0 ? "Route start point" : (index === routePoints.length - 1 ? "Route end point" : `Route control point ${index + 1}`);
      element.setAttribute("aria-label", pointName);
      element.addEventListener("click", (event) => {
        event.stopPropagation();
        selectedRoutePoint = index;
        drawRouteEditor(false);
      });
      const marker = new maplibregl.Marker({ element, draggable: true, anchor: "center" }).setLngLat(point).addTo(map);
      marker.on("dragend", () => {
        const next = routePoints.map((item) => [...item]);
        const position = marker.getLngLat();
        next[index] = [Number(position.lng.toFixed(6)), Number(position.lat.toFixed(6))];
        commitRoutePoints(next);
      });
      activeMarkers.push(marker);
    });
    $("#route-point-count").textContent = String(routePoints.length);
    syncEndpointFields();
    updateUndoButtons();
    if (center) fitCoordinates([...original, ...saved, ...(routeProposal || [])], 14);
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

  async function proposeNetworkRoute() {
    const requestedJourneyId = journey.id;
    const requestedSegmentId = selectedSegmentId;
    const button = $("#propose-route");
    button.disabled = true;
    $("#accept-route-proposal").disabled = true;
    setProposalStatus("Routing through the local mode network…");
    try {
      const response = await fetch("/api/route-proposal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ journeyId: requestedJourneyId, segmentId: requestedSegmentId, controlPoints: routePoints })
      });
      const result = await response.json();
      if (journey.id !== requestedJourneyId || selectedSegmentId !== requestedSegmentId) return;
      if (!response.ok || !result.ok) {
        const warning = result.warnings?.length ? ` ${result.warnings.join(" ")}` : "";
        throw new Error(`${result.error || "Route proposal failed"}${warning}`);
      }
      routeProposal = result.proposal.geometry.map((point) => [...point]);
      routeProposalMeta = result.proposal;
      $("#accept-route-proposal").disabled = false;
      setProposalStatus(`Proposed ${result.proposal.mode} route: ${result.proposal.pointCount} points, maximum anchor snap ${result.proposal.maxSnapKm.toFixed(2)} km. Review the green line before accepting.`, "ready");
      drawRouteEditor(false);
    } catch (error) {
      routeProposal = null;
      routeProposalMeta = null;
      setProposalStatus(error.message, "error");
      drawRouteEditor(false);
    } finally {
      const segment = segmentById(selectedSegmentId);
      button.disabled = segment?.mode === "gondola";
    }
  }

  function acceptNetworkProposal() {
    if (!routeProposal || !routeProposalMeta) return;
    acceptRouteGeometry(routeProposal, {
      kind: "network",
      mode: routeProposalMeta.mode,
      network: routeProposalMeta.network,
      provider: routeProposalMeta.provider
    }, "Network proposal accepted; save locally to persist it");
    $("#accept-route-proposal").disabled = true;
    setProposalStatus("Proposal accepted as the pending saved line. Human anchors were preserved; use Save locally to persist it.", "ready");
  }

  function acceptManualFallback() {
    const segment = segmentById(selectedSegmentId);
    if (!segment) return;
    acceptRouteGeometry(editedGeometry(), { kind: "manual", mode: segment.mode }, "Manual fallback accepted; save locally to persist it");
    clearRouteProposal("The anchor guide is now the pending saved fallback. Use Save locally to persist it.");
    drawRouteEditor(false);
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

  function setJourney(id) {
    const nextJourney = data.journeys.find((item) => item.id === id);
    if (!nextJourney) return;
    journey = nextJourney;
    basePhotos = photosByJourney[journey.id] || journey.photos || [];
    selectedPhotoId = basePhotos[0]?.id || null;
    selectedSegmentId = journey.days.flatMap((day) => day.segmentIds)[0] || null;
    selectedDayId = journey.days[0]?.id || null;
    renderJourneySelector();
    if (!selectedSegmentId) clearSelectedRoute();
    selectPhoto(selectedPhotoId, false);
    renderDaySelectors();
    renderPhotoGrid();
    renderRouteList();
    renderDayList();
    selectDay(selectedDayId, false);
    if (mode === "photos") {
      selectPhoto(selectedPhotoId, true);
      if (!selectedPhotoId && selectedDayId && mapReady) renderDayMap(dayById(selectedDayId), true);
    } else if (mode === "routes") {
      if (selectedSegmentId) selectRoute(selectedSegmentId, true);
      else if (selectedDayId && mapReady) renderDayMap(dayById(selectedDayId), true);
    } else if (selectedDayId) {
      selectDay(selectedDayId, true);
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
      : (mode === "routes"
        ? "Click close to the orange line to insert a control point, then drag any numbered point—including the endpoints—to shape the route."
        : "Edit this day's date label, title, and description. The map shows every travel leg assigned to the day.");
    if (mode === "days" && selectedDayId) selectDay(selectedDayId, false);
    if (!mapReady) return;
    if (mode === "photos") {
      selectPhoto(selectedPhotoId, true);
      if (!selectedPhotoId && selectedDayId) renderDayMap(dayById(selectedDayId), true);
    } else if (mode === "routes") {
      if (selectedSegmentId) selectRoute(selectedSegmentId, true);
      else if (selectedDayId) renderDayMap(dayById(selectedDayId), true);
    } else if (selectedDayId) selectDay(selectedDayId, true);
  }

  async function init() {
    try {
      const response = await fetch("/api/state");
      const loadedState = await response.json();
      state = { photos: loadedState.photos || {}, routes: loadedState.routes || {}, days: loadedState.days || {} };
    } catch (error) {
      setStatus(`Could not load local edits: ${error.message}`, "error");
      return;
    }
    renderJourneySelector();
    if (!selectedSegmentId) clearSelectedRoute();
    selectPhoto(selectedPhotoId, false);
    renderDaySelectors();
    renderPhotoGrid();
    renderRouteList();
    renderDayList();
    if (selectedDayId) selectDay(selectedDayId, false);
    markSaved("Ready");
    map = new maplibregl.Map({ container: "studio-map", style: styleUrl, center: [8.45, 46.7], zoom: 7.5, attributionControl: false });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }), "bottom-right");
    map.on("load", () => {
      mapReady = true;
      applyBasemapTreatment();
      setMode(journey.published === false ? "days" : mode);
    });
    map.on("click", (event) => {
      if (mode === "routes") return insertRoutePoint(event);
      if (mode === "days") return;
      if (!selectedPhotoId) return;
      $("#photo-lat").value = event.lngLat.lat.toFixed(6);
      $("#photo-lng").value = event.lngLat.lng.toFixed(6);
      captureCurrentMapZoom();
      readPhotoForm();
      selectPhoto(selectedPhotoId, false);
    });
  }

  document.querySelectorAll(".studio-header [data-mode]").forEach((button) => button.addEventListener("click", () => setMode(button.dataset.mode)));
  $("#new-trip").addEventListener("click", () => {
    $("#new-trip-error").textContent = "";
    $("#new-trip-dialog").showModal();
    $("#new-trip-title").focus();
  });
  $("#cancel-new-trip").addEventListener("click", () => $("#new-trip-dialog").close());
  $("#new-trip-start").addEventListener("change", () => {
    const start = $("#new-trip-start").value;
    $("#new-trip-end").min = start;
    if (!$("#new-trip-end").value) $("#new-trip-end").value = start;
  });
  $("#new-trip-form").addEventListener("submit", async event => {
    event.preventDefault();
    $("#create-trip").disabled = true;
    $("#new-trip-error").textContent = "";
    try {
      const input = Object.fromEntries(new FormData(event.target));
      input.timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const response = await fetch("/api/journeys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not create the trip");
      data.journeys.push(result.journey);
      setJourney(result.journey.id);
      setMode("days");
      $("#new-trip-dialog").close();
      event.target.reset();
      $("#new-trip-end").removeAttribute("min");
      setStatus(dirty ? "Draft created · Other edits still need saving" : "Draft created · Start with a day title or a few notes", dirty ? "dirty" : "saved");
      $("#day-title").focus();
    } catch (error) { $("#new-trip-error").textContent = error.message; }
    finally { $("#create-trip").disabled = false; }
  });
  $("#save-all").addEventListener("click", saveAll);
  $("#studio-journey").addEventListener("change", (event) => setJourney(event.target.value));
  $("#photo-day-filter").addEventListener("change", renderPhotoGrid);
  $("#route-day-filter").addEventListener("change", () => {
    renderRouteList();
    const first = dayById($("#route-day-filter").value).segmentIds[0];
    if (first) selectRoute(first, true);
    else { clearSelectedRoute(); if (mapReady) renderDayMap(dayById($("#route-day-filter").value), true); }
  });
  $("#studio-photo-grid").addEventListener("click", (event) => {
    const button = event.target.closest("[data-photo-id]");
    if (button) selectPhoto(button.dataset.photoId, true);
  });
  $("#studio-route-list").addEventListener("click", (event) => {
    const button = event.target.closest("[data-segment-id]");
    if (button) selectRoute(button.dataset.segmentId, true);
  });
  $("#day-editor-filter").addEventListener("change", (event) => selectDay(event.target.value, true));
  $("#studio-day-list").addEventListener("click", (event) => {
    const button = event.target.closest("[data-day-edit-id]");
    if (button) selectDay(button.dataset.dayEditId, true);
  });
  $("#day-form").addEventListener("input", readDayForm);
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
  $("#apply-route-endpoints").addEventListener("click", readEndpointFields);
  $("#propose-route").addEventListener("click", proposeNetworkRoute);
  $("#accept-route-proposal").addEventListener("click", acceptNetworkProposal);
  $("#accept-manual-route").addEventListener("click", acceptManualFallback);
  $("#smooth-route").addEventListener("click", () => {
    routeSmoothed = !routeSmoothed;
    $("#smooth-route").textContent = routeSmoothed ? "Use straight anchor guide" : "Smooth anchor guide";
    updateRouteAnchors();
  });
  $("#reset-route").addEventListener("click", () => {
    const segment = segmentById(selectedSegmentId);
    delete state.routes[selectedSegmentId];
    routeProposal = null;
    routeProposalMeta = null;
    routeSmoothed = false;
    routePoints = defaultControlPoints(segment);
    resetHistory(routePoints);
    markDirty("Override removed; save to keep the reset");
    $("#route-saved-state").textContent = "Removed pending save";
    $("#smooth-route").textContent = "Smooth anchor guide";
    $("#accept-route-proposal").disabled = true;
    setProposalStatus("Override removed. The original route is active; save locally to persist the reset.");
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
    updateRouteAnchors();
  });
  $("#redo-route").addEventListener("click", () => {
    if (routeHistoryIndex >= routeHistory.length - 1) return;
    routeHistoryIndex += 1;
    routePoints = routeHistory[routeHistoryIndex].map((point) => [...point]);
    selectedRoutePoint = -1;
    updateRouteAnchors();
  });
  window.addEventListener("beforeunload", (event) => {
    if (!dirty) return;
    event.preventDefault();
    event.returnValue = "";
  });

  init();
})();
