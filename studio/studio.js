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
  const proposalGate = window.JOURNEY_ATLAS_UTILS.proposalGate();
  const proposalContext = () => [journey.id, selectedSegmentId, routePoints];
  let routeProposal = null;
  let routeProposalMeta = null;
  let networkRequestId=0, gpxRequestId=0;
  let availabilityRequestId = 0;
  let networkAvailable = false;
  let dirty = false;
  let savedRevisions = {};
  let savedStateRevision = null;
  let uploadingPhotos = false;
  const pendingPhotoDays = new Map();
  let photoUploadSerial = 0;

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
    if (/^\/private-photos\/assets\/v1\/[a-f0-9]{64}\.webp$/.test(url || "")) return `/build/private-photo-assets/${url.slice("/private-photos/assets/".length)}`;
    const release = url?.match(/^https:\/\/github\.com\/gravelcycles\/travels\/releases\/download\/([a-z0-9-]+)\/([^/]+\.webp)$/);
    if (release) return `/build/${release[1]}/${release[2]}`;
    if (url?.startsWith("./assets/")) return `/dist/${url.slice(2)}`;
    return url || "";
  }

  function photoWithOverride(photo) {
    const override = state.photos[photo.id] || {};
    return window.JOURNEY_ATLAS_UTILS.resolvePhoto(photo, override);
  }

  function photosForDay(dayId, { visibleOnly = false } = {}) {
    const photos = basePhotos.map(photoWithOverride).filter((photo) => photo.dayId === dayId && (!visibleOnly || (!photo.hidden && !photo.trashed)));
    const order = state.days[dayId]?.photoOrder || [];
    const positions = new Map(order.map((id, index) => [id, index]));
    return photos.map((photo, index) => ({ photo, index })).sort((a, b) => {
      const aPosition = positions.has(a.photo.id) ? positions.get(a.photo.id) : order.length + a.index;
      const bPosition = positions.has(b.photo.id) ? positions.get(b.photo.id) : order.length + b.index;
      return aPosition - bPosition || a.index - b.index;
    }).map(({ photo }) => photo);
  }

  function explicitPhotoOrder(dayId) {
    return photosForDay(dayId).map((photo) => photo.id);
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
    if ([...plans.values()].some(plan=>plan.dirty)) { markDirty("Other trip plans still need saving"); return; }
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

  function photoBrowserPhotos(dayId) {
    const inTrash = $('#show-photo-trash').checked;
    return photosForDay(dayId).filter(photo => Boolean(photo.trashed) === inTrash);
  }

  function optionMarkup(day, includeCount = false) {
    const count = photoBrowserPhotos(day.id).length;
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
    const uploadDay = $('#upload-photo-day');
    const previousUploadDay = uploadDay.value;
    uploadDay.innerHTML = '<option value="auto">Automatically match capture dates</option>' + days.map(day => optionMarkup(day)).join('');
    uploadDay.value = days.some(day => day.id === previousUploadDay) ? previousUploadDay : 'auto';
    routeFilter.innerHTML = days.map((day) => `<option value="${escapeHtml(day.id)}">Day ${day.number} · ${escapeHtml(day.date)} · ${escapeHtml(day.title)}</option>`).join("");
    dayFilter.innerHTML = days.map((day) => `<option value="${escapeHtml(day.id)}">Day ${day.number} · ${escapeHtml(day.date)} · ${escapeHtml(day.title)}</option>`).join("");
    photoFilter.value = previousPhotoFilter === "all" || days.some((day) => day.id === previousPhotoFilter) ? previousPhotoFilter : (basePhotos[0] ? photoWithOverride(basePhotos[0]).dayId : "all");
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
      ...(state.days[selectedDayId] || {}),
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
    const inTrash = $('#show-photo-trash').checked;
    const photos = (filter === "all" ? journey.days.flatMap(day => photoBrowserPhotos(day.id)) : photoBrowserPhotos(filter));
    $("#studio-photo-grid").innerHTML = photos.length ? photos.map((photo) => {
      const thumb = photo.srcset?.[0]?.src || photo.src;
      const located = Number.isFinite(photo.lat) && Number.isFinite(photo.lng);
      const day = dayById(photo.dayId);
      const lead = day?.leadPhotoId === photo.id;
      return `<button type="button" data-photo-id="${photo.id}" class="${photo.id === selectedPhotoId ? "active" : ""}" aria-label="Edit ${escapeHtml(photo.caption || photo.sourceFilename || photo.id)}${lead ? ", lead photo" : ""}">
        <img src="${photoUrl(thumb)}" alt="" loading="lazy" />
        <span>${photo.hidden ? "HIDDEN · " : ""}${lead ? "LEAD · " : ""}${escapeHtml(photo.takenAt || photo.caption)}</span>
        <i class="${located ? "" : "unlocated"}" title="${located ? "Located" : "Needs location"}"></i>
      </button>`;
    }).join("") : `<p class="editor-note">${inTrash ? 'No photos in trash for this selection.' : 'No photos here yet. Use Upload photos to add some.'}</p>`;
    const selected = $("#studio-photo-grid .active");
    if (selected) selected.scrollIntoView({ block: "nearest" });
  }

  function refreshPhotoOrderControls() {
    const photo = basePhotos.find((item) => item.id === selectedPhotoId);
    const panel = $(".photo-order-panel");
    if (!photo) {
      panel.inert = true;
      $("#photo-order-status").textContent = "No photo selected.";
      return;
    }
    const resolved = photoWithOverride(photo);
    panel.inert = Boolean(resolved.trashed);
    const ordered = photosForDay(resolved.dayId);
    const index = ordered.findIndex((item) => item.id === selectedPhotoId);
    const day = dayById(resolved.dayId);
    $("#photo-order-status").textContent = `${day?.leadPhotoId === selectedPhotoId ? "Lead photo · " : ""}${index + 1} of ${ordered.length} in Day ${day?.number || "—"}. Album order is independent from the lead choice.`;
    $("#photo-move-earlier").disabled = index <= 0;
    $("#photo-move-later").disabled = index < 0 || index >= ordered.length - 1;
    $("#photo-make-lead").disabled = Boolean(resolved.hidden) || day?.leadPhotoId === selectedPhotoId;
    $("#photo-make-lead").textContent = day?.leadPhotoId === selectedPhotoId ? "Current lead photo" : "Use as lead photo";
  }

  function selectPhoto(id, center) {
    const base = basePhotos.find((photo) => photo.id === id);
    $("#photo-form").inert = !base;
    $("#switch-photo-view").disabled = true;
    if (!base) {
      selectedPhotoId = null;
      if (mapReady) clearActiveMap();
      $("#photo-form").reset();
      $("#selected-photo").textContent = "Choose a photo, or use Upload photos to add one.";
      return;
    }
    const previous = basePhotos.find(photo => photo.id === selectedPhotoId);
    const photo = photoWithOverride(base);
    // Keep the working camera when moving between points in the same day.
    // Initial load and journey/mode changes can still request an explicit fit.
    center ??= !previous || photoWithOverride(previous).dayId !== photo.dayId;
    selectedPhotoId = id;
    $("#selected-photo").innerHTML = `<img src="${photoUrl(photo.srcset?.find((item) => item.width >= 1280)?.src || photo.src)}" alt="" /><span>${escapeHtml(photo.sourceFilename || photo.id)}</span>`;
    $("#photo-day").value = photo.dayId;
    $("#photo-place").value = photo.locationLabel || "";
    $("#photo-lat").value = Number.isFinite(photo.lat) ? photo.lat : "";
    $("#photo-lng").value = Number.isFinite(photo.lng) ? photo.lng : "";
    $("#photo-zoom").value = photo.zoom || 16;
    $("#photo-caption").value = photo.caption || "";
    $("#photo-description").value = photo.description || "";
    $("#photo-hidden").checked = Boolean(photo.hidden);
    $('#trash-photo').textContent = photo.trashed ? 'Restore photo from trash' : 'Move photo to trash';
    $('#photo-asset-status').textContent = photo.trashed ? 'In trash. Save locally to remove it from the atlas on the next deployment. Originals and hosted files are retained for recovery.' : photo.assetStatus === 'local' ? 'Local upload · ready to review. Asset publishing is needed before this photo can appear on the live site.' : 'Photo assets published · edits appear after the next site deployment.';
    refreshPhotoOrderControls();
    renderPhotoGrid();
    if (mapReady) {
      if (!center) map.stop();
      renderPhotoMap(photo, center);
    }
  }

  function switchToCurrentPhotoView() {
    const base = basePhotos.find(photo => photo.id === selectedPhotoId);
    if (!mapReady || !base) return;
    const photo = photoWithOverride(base);
    if (!Number.isFinite(photo.lat) || !Number.isFinite(photo.lng)) return;
    renderPhotoMap(photo, true);
  }

  function readPhotoForm() {
    const base = basePhotos.find((photo) => photo.id === selectedPhotoId);
    if (!base) return;
    const lat = Number($("#photo-lat").value);
    const lng = Number($("#photo-lng").value);
    const zoom = Number($("#photo-zoom").value);
    const previous = photoWithOverride(base);
    const override = {
      ...(state.photos[selectedPhotoId] || {}),
      dayId: $("#photo-day").value,
      caption: $("#photo-caption").value.trim(),
      description: $("#photo-description").value.trim(),
      locationLabel: $("#photo-place").value.trim(),
      hidden: $("#photo-hidden").checked
    };
    if (Number.isFinite(lat) && Number.isFinite(lng) && $("#photo-lat").value !== "" && $("#photo-lng").value !== "") {
      override.location = { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
      override.zoom = Number.isFinite(zoom) ? clampPhotoZoom(zoom) : 16;
    } else {
      override.location = null;
      delete override.zoom;
    }
    state.photos[selectedPhotoId] = override;
    if (override.hidden && state.days[override.dayId]?.leadPhotoId === selectedPhotoId) {
      const { leadPhotoId, ...dayOverride } = state.days[override.dayId];
      state.days[override.dayId] = { ...dayOverride, photoOrder: explicitPhotoOrder(override.dayId) };
    }
    if (previous.dayId !== override.dayId) {
      for (const dayId of [previous.dayId, override.dayId]) {
        const current = state.days[dayId] || {};
        const photoOrder = explicitPhotoOrder(dayId);
        state.days[dayId] = { ...current, photoOrder };
        if (current.leadPhotoId === selectedPhotoId && dayId !== override.dayId) delete state.days[dayId].leadPhotoId;
      }
    }
    markDirty();
    renderDaySelectors();
    $("#photo-day").value = override.dayId;
    renderPhotoGrid();
    refreshPhotoOrderControls();
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
    $("#switch-photo-view").disabled = !Number.isFinite(photo.lat) || !Number.isFinite(photo.lng);
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

  function clearRouteProposal(message = "Points changed. Generate a new route to see the updated green line. The saved route remains active.") {
    proposalGate.invalidate();
    routeProposal = null;
    routeProposalMeta = null;
    $("#accept-route-proposal").disabled = true;
    $("#accept-route-gpx").disabled = true;
    setProposalStatus(message);
  }

  function updateRouteAnchors(changedEndpoints = []) {
    const segment = segmentById(selectedSegmentId);
    const existing = state.routes[selectedSegmentId] || {};
    // Endpoint edits touch only the detailed line's terminal vertices. Never
    // regenerate the route from the much sparser drawing anchors here.
    const geometry = (existing.geometry?.length > 1 ? existing.geometry : baseSegmentCoordinates(segment)).map(point => [...point]);
    for (const end of changedEndpoints) {
      geometry[end === "start" ? 0 : geometry.length - 1] = [...routePoints[end === "start" ? 0 : routePoints.length - 1]];
    }
    state.routes[selectedSegmentId] = {
      ...existing,
      controlPoints: routePoints.map((point) => [...point]),
      geometry,
      smoothing: routeSmoothed ? "chaikin" : "none",
      ...(changedEndpoints.length ? { routing: { kind: "manual", mode: segment.mode, edit: "endpoints" } } : {})
    };
    clearRouteProposal(changedEndpoints.length
      ? "Endpoint updated; the rest of the detailed route is unchanged. Save locally to keep it."
      : undefined);
    $("#route-saved-state").textContent = changedEndpoints.length ? "Endpoint changed · pending save" : "Geometry kept · anchors pending";
    markDirty(changedEndpoints.length ? "Endpoint updated · Save locally" : "Anchor changes pending; saved geometry kept");
    drawRouteEditor(false);
    renderRouteList();
  }

  function acceptRouteGeometry(geometry, routing, message, source) {
    state.routes[selectedSegmentId] = {
      ...(state.routes[selectedSegmentId] || {}),
      controlPoints: routePoints.map((point) => [...point]),
      geometry: geometry.map((point) => [...point]),
      smoothing: routeSmoothed ? "chaikin" : "none",
      routing,
      ...(source ? { source } : {})
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
    const values = ["#route-start-lng", "#route-start-lat", "#route-end-lng", "#route-end-lat"].map(selector => {
      const value = $(selector).value.trim();
      return value ? Number(value) : NaN;
    });
    if (!values.every(Number.isFinite) || Math.abs(values[0]) > 180 || Math.abs(values[2]) > 180 || Math.abs(values[1]) > 90 || Math.abs(values[3]) > 90) {
      setStatus("Enter valid longitude/latitude values for both endpoints", "error");
      syncEndpointFields();
      return;
    }
    const next = routePoints.map((point) => [...point]);
    if (values[0] !== next[0][0] || values[1] !== next[0][1]) next[0] = [values[0], values[1]];
    if (values[2] !== next.at(-1)[0] || values[3] !== next.at(-1)[1]) next[next.length - 1] = [values[2], values[3]];
    commitRoutePoints(next, { endpointsOnly: true });
  }

  function routeEditSnapshot() {
    return {
      points: routePoints.map(point => [...point]),
      smoothed: routeSmoothed,
      override: state.routes[selectedSegmentId] ? structuredClone(state.routes[selectedSegmentId]) : null
    };
  }

  function resetHistory(points) {
    routeHistory = [{ ...routeEditSnapshot(), points: points.map(point => [...point]) }];
    routeHistoryIndex = 0;
    $("#undo-route").disabled = true;
    $("#redo-route").disabled = true;
  }

  function commitRoutePoints(points, { endpointsOnly = false } = {}) {
    const previous = routeEditSnapshot();
    if (JSON.stringify(previous.points) === JSON.stringify(points)) return;
    routeHistory[routeHistoryIndex] = previous;
    const changedEndpoints = endpointsOnly
      ? ["start", "end"].filter(end => {
        const index = end === "start" ? 0 : points.length - 1;
        return JSON.stringify(points[index]) !== JSON.stringify(previous.points[index]);
      }) : [];
    routePoints = points.map(point => [...point]);
    selectedRoutePoint = -1;
    updateRouteAnchors(changedEndpoints);
    routeHistory = routeHistory.slice(0, routeHistoryIndex + 1);
    routeHistory.push(routeEditSnapshot());
    routeHistoryIndex = routeHistory.length - 1;
    updateUndoButtons();
  }

  function restoreRouteHistory(direction) {
    const nextIndex = routeHistoryIndex + direction;
    if (nextIndex < 0 || nextIndex >= routeHistory.length) return;
    routeHistory[routeHistoryIndex] = routeEditSnapshot();
    routeHistoryIndex = nextIndex;
    const snapshot = routeHistory[routeHistoryIndex];
    routePoints = snapshot.points.map(point => [...point]);
    routeSmoothed = snapshot.smoothed;
    if (snapshot.override) state.routes[selectedSegmentId] = structuredClone(snapshot.override);
    else delete state.routes[selectedSegmentId];
    selectedRoutePoint = -1;
    clearRouteProposal("Route edit restored. Save locally to keep it.");
    $("#smooth-route").textContent = routeSmoothed ? "Use straight anchor guide" : "Smooth anchor guide";
    $("#route-saved-state").textContent = "Pending save";
    markDirty("Route edit restored · Save locally");
    renderRouteList();
    drawRouteEditor(false);
  }

  function updateUndoButtons() {
    $("#undo-route").disabled = routeHistoryIndex <= 0;
    $("#redo-route").disabled = routeHistoryIndex >= routeHistory.length - 1;
    $("#delete-route-point").disabled = selectedRoutePoint <= 0 || selectedRoutePoint >= routePoints.length - 1;
    $("#delete-route-point").textContent = $("#delete-route-point").disabled ? "Select a point to delete" : `Delete point ${selectedRoutePoint + 1}`;
  }

  function clearSelectedRoute() {
    selectedSegmentId = null;
    availabilityRequestId += 1;
    networkAvailable = false;
    $("#propose-route").disabled = true;
    routePoints = []; routeHistory = []; routeHistoryIndex = -1;
    proposalGate.invalidate();
    routeProposal = null; routeProposalMeta = null;
    $("#route-editor").inert = true;
    $("#route-tools").inert = true;
    $("#route-title").textContent = "No travel legs for this day";
    $("#route-summary").textContent = "Start with the day plan; routes can be added as destinations become known.";
    document.querySelectorAll(".endpoint-fields input").forEach(input => { input.value = ""; });
    $("#route-point-count").textContent = "—";
    $("#route-saved-state").textContent = "—";
    $("#route-gpx-file").value = "";
    clearRouteProposal("No route selected.");
  }

  async function refreshRouteAvailability() {
    const requestId = ++availabilityRequestId;
    const requestedJourneyId = journey.id;
    const requestedSegmentId = selectedSegmentId;
    networkAvailable = false;
    $("#propose-route").disabled = true;
    $("#route-network-status").textContent = "Checking routing data…";
    try {
      const query = new URLSearchParams({ journeyId: requestedJourneyId, segmentId: requestedSegmentId });
      const response = await fetch(`/api/route-availability?${query}`);
      if (!response.ok) throw new Error("Routing check failed. Restart Studio and reselect this leg to try again.");
      const result = await response.json();
      if (requestId !== availabilityRequestId || journey.id !== requestedJourneyId || selectedSegmentId !== requestedSegmentId) return;
      networkAvailable = result.available === true;
      $("#route-network-status").textContent = result.message;
      $("#propose-route").disabled = !networkAvailable;
    } catch (error) {
      if (requestId !== availabilityRequestId || journey.id !== requestedJourneyId || selectedSegmentId !== requestedSegmentId) return;
      $("#route-network-status").textContent = "Cannot check routing data. Make sure Studio is running, then reselect this leg.";
    }
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
    proposalGate.invalidate();
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
    $("#propose-route").textContent = `Generate ${segment.mode === "boat" ? "ferry" : segment.mode} route`;
    refreshRouteAvailability();
    $("#accept-route-proposal").disabled = true;
    $("#accept-route-gpx").disabled = true;
    const acceptsGpx = ["bike", "walk"].includes(segment.mode);
    $("#route-gpx-file").disabled = !acceptsGpx;
    $("#import-route-gpx").disabled = !acceptsGpx;
    $("#route-gpx-file").value = "";
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
        commitRoutePoints(next, { endpointsOnly: index === 0 || index === routePoints.length - 1 });
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
    if (!networkAvailable) return;
    const requestId=++networkRequestId;
    $("#accept-route-gpx").disabled=true;
    const token = proposalGate.capture(proposalContext());
    const requestPoints = routePoints.map(p => [...p]);
    const requestedJourneyId = journey.id;
    const requestedSegmentId = selectedSegmentId;
    const button = $("#propose-route");
    button.disabled = true;
    $("#accept-route-proposal").disabled = true;
    routeProposal = null;
    routeProposalMeta = null;
    drawRouteEditor(false);
    setProposalStatus("Generating a route from your points…");
    try {
      const response = await fetch("/api/route-proposal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ journeyId: requestedJourneyId, segmentId: requestedSegmentId, controlPoints: requestPoints })
      });
      const result = await response.json();
      if (!proposalGate.current(token, proposalContext())) return;
      if (!response.ok || !result.ok) {
        const warning = result.warnings?.length ? ` ${result.warnings.join(" ")}` : "";
        throw new Error(`${result.error || "Route proposal failed"}${warning}`);
      }
      routeProposal = result.proposal.geometry.map((point) => [...point]);
      routeProposalMeta = { ...result.proposal, kind: "network", token };
      $("#accept-route-proposal").disabled = false;
      setProposalStatus(`Proposed ${result.proposal.mode} route: ${result.proposal.pointCount} points, maximum anchor snap ${result.proposal.maxSnapKm.toFixed(2)} km. Review the green line before accepting.`, "ready");
      drawRouteEditor(false);
    } catch (error) {
      if (!proposalGate.current(token, proposalContext())) return;
      proposalGate.invalidate();
      routeProposal = null;
      routeProposalMeta = null;
      setProposalStatus(error.message, "error");
      drawRouteEditor(false);
    } finally {
      const segment = segmentById(selectedSegmentId);
      if (requestId === networkRequestId && journey.id === requestedJourneyId && selectedSegmentId === requestedSegmentId) button.disabled = !segment || !networkAvailable;
    }
  }

  function acceptNetworkProposal() {
    if (!routeProposal || routeProposalMeta?.kind !== "network" || !proposalGate.current(routeProposalMeta.token, proposalContext())) return;
    acceptRouteGeometry(routeProposal, {
      kind: "network",
      mode: routeProposalMeta.mode,
      network: routeProposalMeta.network,
      provider: routeProposalMeta.provider
    }, "Network proposal accepted; save locally to persist it");
    $("#accept-route-proposal").disabled = true;
    setProposalStatus("Proposal accepted as the pending saved line. Human anchors were preserved; use Save locally to persist it.", "ready");
  }

  async function proposeGpxTrack() {
    const requestId=++gpxRequestId;
    const segment = segmentById(selectedSegmentId);
    const file = $("#route-gpx-file").files[0];
    if (!["bike", "walk"].includes(segment?.mode)) return setProposalStatus("Choose a bicycle or walking leg before importing GPX.", "error");
    if (!file) return setProposalStatus("Choose a private .gpx file first.", "error");
    if (file.size > 12_000_000) return setProposalStatus("The GPX file is larger than the 12 MB review limit.", "error");
    const token = proposalGate.capture(proposalContext());
    const requestPoints = routePoints.map(p => [...p]);
    const requestedJourneyId = journey.id;
    const requestedSegmentId = selectedSegmentId;
    $("#import-route-gpx").disabled = true;
    $("#accept-route-gpx").disabled = true;
    $("#accept-route-proposal").disabled = true;
    setProposalStatus("Checking GPX order, gaps, distance, and meaningful turns…");
    try {
      const response = await fetch("/api/gpx-proposal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ journeyId: requestedJourneyId, segmentId: requestedSegmentId, controlPoints: requestPoints, text: await file.text() })
      });
      const result = await response.json();
      if (!proposalGate.current(token, proposalContext())) return;
      if (!response.ok || !result.ok) {
        const warning = result.warnings?.length ? ` ${result.warnings.join(" ")}` : "";
        throw new Error(`${result.error || "GPX review failed"}${warning}`);
      }
      routeProposal = result.proposal.geometry.map((point) => [...point]);
      routeProposalMeta = { ...result.proposal, kind: "gpx", token };
      $("#accept-route-gpx").disabled = false;
      const warnings = result.proposal.warnings.length ? ` ${result.proposal.warnings.join(" ")}` : "";
      setProposalStatus(`GPX preview: ${result.proposal.distanceKm.toFixed(1)} km recorded, ${result.proposal.rawPointCount} source points simplified to ${result.proposal.pointCount}.${warnings} Review the green line before accepting.`, "ready");
      drawRouteEditor(false);
    } catch (error) {
      if (!proposalGate.current(token, proposalContext())) return;
      proposalGate.invalidate();
      routeProposal = null;
      routeProposalMeta = null;
      setProposalStatus(error.message, "error");
      drawRouteEditor(false);
    } finally {
      if(requestId===gpxRequestId) $("#import-route-gpx").disabled = !["bike", "walk"].includes(segmentById(selectedSegmentId)?.mode);
    }
  }

  function acceptGpxProposal() {
    if (!routeProposal || routeProposalMeta?.kind !== "gpx" || !proposalGate.current(routeProposalMeta.token, proposalContext())) return;
    acceptRouteGeometry(routeProposal, { kind: "gpx", mode: routeProposalMeta.mode }, "GPX track accepted; save locally to persist reviewed coordinates", routeProposalMeta.provenance);
    routePoints = routeProposalMeta.controlPoints.map((point) => [...point]);
    $("#accept-route-gpx").disabled = true;
    setProposalStatus("GPX track accepted as the pending saved line. The private original was not copied; use Save locally to persist the reviewed geometry and provenance.", "ready");
  }

  function moveSelectedPhoto(delta) {
    const photo = basePhotos.find((item) => item.id === selectedPhotoId);
    if (!photo) return;
    const dayId = photoWithOverride(photo).dayId;
    const order = explicitPhotoOrder(dayId);
    const index = order.indexOf(selectedPhotoId);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target], order[index]];
    state.days[dayId] = { ...(state.days[dayId] || {}), photoOrder: order };
    markDirty("Photo order changed; save locally to persist it");
    renderPhotoGrid();
    refreshPhotoOrderControls();
  }

  function makeSelectedPhotoLead() {
    const photo = basePhotos.find((item) => item.id === selectedPhotoId);
    if (!photo) return;
    const resolved = photoWithOverride(photo);
    if (resolved.hidden) return setStatus("A hidden photo cannot be the day lead", "error");
    state.days[resolved.dayId] = { ...(state.days[resolved.dayId] || {}), photoOrder: explicitPhotoOrder(resolved.dayId), leadPhotoId: selectedPhotoId };
    markDirty("Lead photo changed; save locally to persist it");
    renderPhotoGrid();
    refreshPhotoOrderControls();
  }

  function acceptManualFallback() {
    const segment = segmentById(selectedSegmentId);
    if (!segment) return;
    acceptRouteGeometry(editedGeometry(), { kind: "manual", mode: segment.mode }, "Manual fallback accepted; save locally to persist it");
    clearRouteProposal("The anchor guide is now the pending saved fallback. Use Save locally to persist it.");
    drawRouteEditor(false);
  }

  function renderPendingPhotoDays() {
    $('#photo-upload-review').innerHTML = [...pendingPhotoDays].filter(([,item]) => item.journeyId === journey.id).map(([id,item]) => `<section class="upload-day-review">
      <strong>${escapeHtml(item.file.name)}</strong><p>${escapeHtml(item.error)}</p>
      <label for="pending-photo-day-${id}">Journey day for this photo</label>
      <select id="pending-photo-day-${id}">${journey.days.map(day => optionMarkup(day)).join('')}</select>
      <button type="button" data-retry-photo-day="${id}" ${uploadingPhotos ? 'disabled' : ''}>Add this photo</button>
    </section>`).join('');
  }

  async function uploadPhotos(retries) {
    const dayId = $('#upload-photo-day').value || 'auto';
    const entries = retries || [...$('#upload-photo-files').files].map(file => ({file, dayId}));
    const currentJourney = journey;
    if (!entries.length) { $('#photo-upload-status').textContent = 'Choose one or more photos first.'; return; }
    if (uploadingPhotos) return;
    uploadingPhotos = true;
    $('#upload-photos').disabled = true;
    $('#studio-journey').disabled = true;
    ['#new-trip', '#upload-photo-files', '#upload-photo-day'].forEach(id => { $(id).disabled = true; });
    const messages = [];
    const addedDayIds = new Set();
    renderPendingPhotoDays();
    let lastPhotoId;
    try {
      for (const [index, entry] of entries.entries()) {
        const {file} = entry;
        $('#photo-upload-status').textContent = `Processing ${index + 1} of ${entries.length}: ${file.name}`;
        try {
          if (file.size > 50 * 1024 * 1024) throw new Error('File exceeds 50 MB.');
          const query = new URLSearchParams({ journeyId:currentJourney.id, dayId:entry.dayId, filename:file.name });
          const response = await fetch(`/api/photos/import?${query}`, { method:'POST', headers:{'Content-Type':'application/octet-stream'}, body:file });
          const result = await response.json();
          if (!response.ok || !result.ok) {
            if (result.needsDay) {
              const reviewId = entry.reviewId || String(++photoUploadSerial);
              pendingPhotoDays.set(reviewId, {file, journeyId:currentJourney.id, error:result.error});
            }
            throw new Error(result.error || 'Import failed.');
          }
          if (entry.reviewId) pendingPhotoDays.delete(entry.reviewId);
          if (!basePhotos.some(photo => photo.id === result.photo.id)) basePhotos.push(result.photo);
          photosByJourney[currentJourney.id] = basePhotos;
          currentJourney.photos = basePhotos;
          lastPhotoId = result.photo.id;
          addedDayIds.add(photoWithOverride(result.photo).dayId);
          messages.push(`${file.name}: ${result.duplicate ? 'already imported' : 'added locally'} · Day ${dayById(photoWithOverride(result.photo).dayId)?.number || '—'}.${result.warnings.length ? ' ' + result.warnings.join(' ') : ''}`);
        } catch(error) { messages.push(`${file.name}: ${error.message} You can retry this file.`); }
      }
      // Photo intake changes the planner revision; force a fresh preview.
      const revisions = await (await fetch('/api/state')).json();
      savedRevisions = revisions.revisions || savedRevisions;
      const plan = plans.get(currentJourney.id);
      if (plan) { plan.revision = savedRevisions[currentJourney.id]; plan.previewed = false; plan.draft.photos = basePhotos; }
      renderDaySelectors();
      $('#photo-day-filter').value = addedDayIds.size > 1 ? 'all' : lastPhotoId ? photoWithOverride(basePhotos.find(p => p.id === lastPhotoId)).dayId : dayId === 'auto' ? 'all' : dayId;
      $('#show-photo-trash').checked = Boolean(lastPhotoId && photoWithOverride(basePhotos.find(p => p.id === lastPhotoId)).trashed);
      renderPhotoGrid();
      if (lastPhotoId) selectPhoto(lastPhotoId, false);
      if (!retries) { $('#upload-photo-files').value = ''; $('#photo-upload-selection').textContent = 'Choose more photos to add another batch.'; }
    } catch(error) { messages.push(error.message); }
    finally {
      uploadingPhotos = false;
      $('#upload-photos').disabled = false;
      $('#studio-journey').disabled = false;
      ['#new-trip', '#upload-photo-files', '#upload-photo-day'].forEach(id => { $(id).disabled = false; });
      $('#photo-upload-status').textContent = messages.join('\n');
      renderPendingPhotoDays();
    }
  }

  async function saveAll() {
    if (plans.get(journey.id)?.dirty) return savePlan();
    setStatus("Saving…");
    try {
      const response = await fetch("/api/state", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...state, stateRevision:savedStateRevision })
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "Save failed");
      savedStateRevision = result.stateRevision;
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
    renderPendingPhotoDays();
    if (mode === "planner") renderPlanner();
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
        ? "Drag the first or last numbered point to adjust only that endpoint, then Save locally. Click the orange guide to add intermediate anchors for a route proposal."
        : "Edit this day's date label, title, and description. The map shows every travel leg assigned to the day.");
    if (mode === "planner") { renderPlanner(); return; }
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

  const modeLabels = {train:"Train",boat:"Ferry",bus:"Bus",gondola:"Gondola",walk:"Walk",car:"Car",bike:"Bike"};
  const plans = new Map();
  function planForJourney() {
    if (!plans.has(journey.id)) plans.set(journey.id, { draft:structuredClone(journey), dirty:false, revision:savedRevisions[journey.id] || null });
    return plans.get(journey.id);
  }
  const planFields = ['title','startDate','endDate','timeZone','places','segments','days','coverPhoto','replayMoments','subtitle'];
  function planChanges(draft) { return Object.fromEntries(planFields.filter(k => draft[k] !== undefined).map(k => [k, draft[k]])); }
  function dirtyPlan() { const plan = planForJourney(); plan.dirty = true; plan.previewed = false; markDirty('Trip plan changed · preview before saving'); $('#plan-save').disabled = true; }
  function uniquePlanId(kind, items) { let n=1; while (items.some(item => item.id === `${journey.id}-${kind}${n}`)) n++; return `${journey.id}-${kind}${n}`; }
  function renderPlanner() {
    const plan = planForJourney(), draft = plan.draft;
    $('#plan-title').value = draft.title;
    $('#plan-subtitle').value = draft.subtitle || '';
    $('#plan-start').value = draft.startDate || draft.days[0]?.calendarDate || '';
    $('#plan-end').value = draft.endDate || draft.days.at(-1)?.calendarDate || '';
    $('#plan-timezone').value = draft.timeZone || 'UTC';
    const placeOptions = '<option value="">Choose a place</option>'+draft.places.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`).join('');
    $('#plan-places').innerHTML = draft.places.map(p => `<div class="plan-place" data-place="${escapeHtml(p.id)}"><label>Name<input data-place-field="name" value="${escapeHtml(p.name)}"></label><label>Longitude<input type="number" step="any" min="-180" max="180" data-place-field="lng" value="${p.lng??''}"></label><label>Latitude<input type="number" step="any" min="-90" max="90" data-place-field="lat" value="${p.lat??''}"></label></div>`).join('');
    $('#plan-days').innerHTML = draft.days.map((day,index) => `<section class="plan-day" data-plan-day="${escapeHtml(day.id)}"><div class="plan-row"><strong>Day ${index+1} · ${escapeHtml(day.calendarDate || day.date)} · ${escapeHtml(state.days[day.id]?.title || day.title)}</strong><button type="button" data-move-day="-1" ${index===0?'disabled':''}>Earlier</button><button type="button" data-move-day="1" ${index===draft.days.length-1?'disabled':''}>Later</button></div><label>Destination<select data-day-destination>${placeOptions}</select></label><ol>${day.segmentIds.map((id, i) => { const s=draft.segments.find(s=>s.id===id); return `<li data-plan-leg="${escapeHtml(id)}"><div class="plan-leg"><label>Mode<select data-leg-field="mode">${Object.entries(modeLabels).map(([key,label])=>`<option value="${key}" ${s.mode===key?'selected':''}>${label}</option>`).join('')}</select></label><label>From<select data-leg-field="from">${draft.places.map(p=>`<option value="${escapeHtml(p.id)}" ${p.id===s.from?'selected':''}>${escapeHtml(p.name)}</option>`).join('')}</select></label><label>To<select data-leg-field="to">${draft.places.map(p=>`<option value="${escapeHtml(p.id)}" ${p.id===s.to?'selected':''}>${escapeHtml(p.name)}</option>`).join('')}</select></label><label>Travel minutes<input data-leg-field="durationMinutes" type="number" min="0" value="${s.durationMinutes??''}"></label></div><button type="button" data-move-leg="-1" ${i===0?'disabled':''}>Earlier leg</button><button type="button" data-move-leg="1" ${i===day.segmentIds.length-1?'disabled':''}>Later leg</button>${s.geometry || routeGeometry[id] || state.routes[id] ? '<small>Reviewed route: endpoint/mode edits require a new route review.</small>' : '<small>Provisional endpoint guide; review geometry in Route drawing.</small>'}</li>`; }).join('')}</ol><button type="button" data-add-leg ${draft.places.length<1?'disabled':''}>+ Travel leg</button></section>`).join('');
    draft.days.forEach(day => { const select = [...document.querySelectorAll('[data-plan-day]')].find(e=>e.dataset.planDay===day.id)?.querySelector('[data-day-destination]'); if (select) select.value=day.destinationId || day.placeId || ''; });
    const visible = basePhotos.map(photoWithOverride).filter(p=>!p.hidden && !p.trashed);
    $('#cover-picker').innerHTML = '<option value="">First visible photo</option>'+visible.map(p=>`<option value="${escapeHtml(p.id)}">${escapeHtml(p.caption || p.id)}</option>`).join('');
    $('#cover-picker').value = draft.coverPhoto?.photoId || '';
    $('#cover-x').value = draft.coverPhoto?.focal?.[0] ?? 50; $('#cover-y').value = draft.coverPhoto?.focal?.[1] ?? 50;
    $('#cover-thumbnails').innerHTML = visible.map(p=>`<button type="button" data-pick-cover="${escapeHtml(p.id)}" aria-label="Use ${escapeHtml(p.caption || p.id)} as trip cover" aria-pressed="${draft.coverPhoto?.photoId===p.id}"><img loading="lazy" src="${escapeHtml(photoUrl(p.srcset?.[0]?.src || p.src))}" alt="${escapeHtml(p.caption || '')}"></button>`).join('');
    renderCoverPreviews(); renderMomentEditor();
    $('#plan-save').disabled = !plan.previewed;
  }
  function renderCoverPreviews() {
    const {photo,position} = window.JOURNEY_ATLAS_UTILS.resolveCover(planForJourney().draft, basePhotos.map(photoWithOverride).filter(p=>!p.hidden && !p.trashed));
    $('#cover-previews').innerHTML = ['Desktop','Phone'].map(label=>`<figure class="cover-preview ${label.toLowerCase()}"><figcaption>${label}</figcaption>${photo?`<img src="${escapeHtml(photoUrl(photo.srcset?.find(v=>v.width>=1280)?.src || photo.src))}" style="object-position:${position}" alt="${escapeHtml(photo.caption)}">`:'<p>A journey taking shape</p>'}</figure>`).join('');
  }
  function renderMomentEditor() {
    const draft=planForJourney().draft;
    $('#plan-moments').innerHTML=(draft.replayMoments||[]).map((m,i)=>`<section class="plan-moment" data-moment="${escapeHtml(m.id)}"><div class="plan-row"><strong>Moment ${i+1}</strong><button type="button" data-move-moment="-1" ${!i?'disabled':''}>Earlier</button><button type="button" data-move-moment="1" ${i===draft.replayMoments.length-1?'disabled':''}>Later</button><button type="button" data-remove-moment>Remove moment</button></div><label>Day<select data-moment-field="dayId">${draft.days.map(d=>`<option value="${escapeHtml(d.id)}" ${d.id===m.dayId?'selected':''}>Day ${d.number} · ${escapeHtml(d.title)}</option>`).join('')}</select></label><label>Photograph<select data-moment-field="photoId"><option value="">Route / text chapter</option>${basePhotos.map(photoWithOverride).filter(p=>!p.hidden && !p.trashed && p.dayId===m.dayId).map(p=>`<option value="${escapeHtml(p.id)}" ${p.id===m.photoId?'selected':''}>${escapeHtml(p.caption)}</option>`).join('')}</select></label><label>One sentence (optional)<input data-moment-field="caption" value="${escapeHtml(m.caption)}"></label><label>Duration (seconds)<input type="number" min="1" max="120" data-moment-field="duration" value="${m.duration}"></label><fieldset><legend>Travel legs (in day order)</legend>${(draft.days.find(d=>d.id===m.dayId)?.segmentIds||[]).map(id=>{ const s=draft.segments.find(s=>s.id===id); return `<label class="checkbox"><input type="checkbox" data-moment-segment="${escapeHtml(id)}" ${m.segmentIds?.includes(id)?'checked':''}>${escapeHtml(modeLabels[s.mode])} · ${escapeHtml(draft.places.find(p=>p.id===s.from)?.name)} → ${escapeHtml(draft.places.find(p=>p.id===s.to)?.name)}</label>`; }).join('')}</fieldset></section>`).join('') || '<p>Add a few moments to curate Replay. With none selected it follows the existing day/route sequence.</p>';
  }
  async function previewPlan() {
    const plan=planForJourney();
    const changes={...planChanges(plan.draft),title:$('#plan-title').value,subtitle:$('#plan-subtitle').value,startDate:$('#plan-start').value,endDate:$('#plan-end').value,timeZone:$('#plan-timezone').value};
    if (!changes.startDate && !changes.endDate) { delete changes.startDate; delete changes.endDate; }
    const input={journeyId:journey.id,changes,state,alignment:$('#plan-alignment').value,preview:true,revision:plan.revision};
    try {
      const result=await (await fetch('/api/journey-plan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)})).json();
      if (!result.ok) throw new Error(result.error);
      state=result.state; plan.draft=result.journey; plan.revision=result.revision; plan.previewed=true;
      $('#plan-status').textContent=`Ready to save: ${result.journey.days.length} days. Added: ${result.added.join(', ') || 'none'}. Removed empty dates: ${result.removed.join(', ') || 'none'}. Existing IDs, notes and overrides are preserved.`;
      renderPlanner();
    } catch(error) { $('#plan-status').textContent=error.message; }
  }
  async function savePlan() {
    const plan=planForJourney();
    if (!plan.previewed) { setStatus('Preview the trip plan before saving','error'); return false; }
    try {
      const result=await (await fetch('/api/journey-plan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({journeyId:journey.id,changes:planChanges(plan.draft),revision:plan.revision,state,stateRevision:savedStateRevision,preview:false})})).json();
      if (!result.ok) throw new Error(result.error);
      savedStateRevision=result.stateRevision;
      state=result.state; Object.assign(journey,result.journey); plan.revision=result.revision; plan.dirty=false; plan.previewed=false;
      renderJourneySelector(); renderDaySelectors(); renderDayList(); renderRouteList(); renderPlanner(); markSaved('Trip plan and edits saved locally');
      $('#plan-status').textContent='Saved. The selected trip preview now includes these changes.'; return true;
    } catch(error) { $('#plan-status').textContent=error.message; return false; }
  }
  $('#trip-planner').addEventListener('input',event=>{
    const e=event.target, draft=planForJourney().draft;
    const headerFields={'plan-title':'title','plan-subtitle':'subtitle','plan-start':'startDate','plan-end':'endDate','plan-timezone':'timeZone'};
    if(headerFields[e.id]) draft[headerFields[e.id]]=e.value;
    if (e.dataset.placeField) { const p=draft.places.find(p=>p.id===e.closest('[data-place]').dataset.place); p[e.dataset.placeField]=e.dataset.placeField==='name'?e.value:(e.value===''?null:Number(e.value)); }
    if (e.hasAttribute('data-day-destination')) { const day=draft.days.find(d=>d.id===e.closest('[data-plan-day]').dataset.planDay); if(e.value) day.destinationId=e.value; else delete day.destinationId; }
    if(e.dataset.legField) { const leg=draft.segments.find(s=>s.id===e.closest('[data-plan-leg]').dataset.planLeg); if (['from','to','mode'].includes(e.dataset.legField) && (leg.geometry || routeGeometry[leg.id] || state.routes[leg.id])) { $('#plan-status').textContent='Reviewed leg endpoints and modes stay fixed here. Use Route drawing to review a changed line; add a new leg for a different journey.'; renderPlanner(); return; } if(e.value==='') delete leg[e.dataset.legField]; else leg[e.dataset.legField]=e.dataset.legField==='durationMinutes'?Number(e.value):e.value; }
    if (['cover-picker','cover-x','cover-y'].includes(e.id)) { const photoId=$('#cover-picker').value; draft.coverPhoto=photoId?{photoId,focal:[Number($('#cover-x').value),Number($('#cover-y').value)]}:null; renderCoverPreviews(); }
    if(e.dataset.momentField || e.dataset.momentSegment) {
      const m=draft.replayMoments.find(m=>m.id===e.closest('[data-moment]').dataset.moment);
      if(e.dataset.momentSegment) m.segmentIds=[...e.closest('fieldset').querySelectorAll('input:checked')].map(el=>el.dataset.momentSegment);
      else { if(e.value==='') delete m[e.dataset.momentField]; else m[e.dataset.momentField]=e.dataset.momentField==='duration'?Number(e.value):e.value; if(e.dataset.momentField==='dayId') { delete m.photoId; m.segmentIds=[]; renderMomentEditor(); } }
    }
    dirtyPlan();
  });
  $('#trip-planner').addEventListener('click',event=>{
    const e=event.target.closest('button'); if(!e) return;
    const draft=planForJourney().draft;
    const day=draft.days.find(d=>d.id===e.closest('[data-plan-day]')?.dataset.planDay);
    const swap=(arr,i,delta)=>{ const j=i+Number(delta); if(j>=0&&j<arr.length) [arr[i],arr[j]]=[arr[j],arr[i]]; };
    if(e.hasAttribute('data-move-day')) { const dates=draft.days.map(d=>[d.calendarDate,d.date]); swap(draft.days,draft.days.indexOf(day),e.dataset.moveDay); draft.days.forEach((d,i)=>{d.number=i+1; d.calendarDate=dates[i][0]; d.date=dates[i][1];}); }
    else if(e.hasAttribute('data-add-leg')) { const id=uniquePlanId('leg',draft.segments); draft.segments.push({id,mode:'walk',from:draft.places[0].id,to:(draft.places[1]||draft.places[0]).id,geometryStatus:'provisional'}); day.segmentIds.push(id); }
    else if(e.hasAttribute('data-move-leg')) swap(day.segmentIds,day.segmentIds.indexOf(e.closest('[data-plan-leg]').dataset.planLeg),e.dataset.moveLeg);
    else if(e.dataset.pickCover) draft.coverPhoto={photoId:e.dataset.pickCover,focal:[50,50]};
    else if(e.hasAttribute('data-move-moment')) swap(draft.replayMoments,draft.replayMoments.findIndex(m=>m.id===e.closest('[data-moment]').dataset.moment),e.dataset.moveMoment);
    else if(e.hasAttribute('data-remove-moment')) draft.replayMoments=draft.replayMoments.filter(m=>m.id!==e.closest('[data-moment]').dataset.moment);
    else return;
    dirtyPlan(); renderPlanner();
  });
  $('#plan-add-place').addEventListener('click',()=>{ const draft=planForJourney().draft; draft.places.push({id:uniquePlanId('place',draft.places),name:'New place',lng:null,lat:null}); dirtyPlan(); renderPlanner(); $('#plan-status').textContent='Enter the known coordinates before previewing. Coordinates are never inferred from the name.'; });
  $('#plan-add-moment').addEventListener('click',()=>{const draft=planForJourney().draft; draft.replayMoments ||= []; draft.replayMoments.push({id:uniquePlanId('moment',draft.replayMoments),dayId:draft.days[0].id,caption:draft.days[0].title,duration:8,segmentIds:[]}); dirtyPlan(); renderMomentEditor();});
  $('#plan-preview').addEventListener('click',previewPlan);
  $('#plan-save').addEventListener('click',savePlan);

  async function init() {
    try {
      const response = await fetch("/api/state");
      const loadedState = await response.json();
      savedRevisions = loadedState.revisions || {};
      savedStateRevision = loadedState.stateRevision;
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
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
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
  $("#photo-day-filter").addEventListener("change", () => {
    renderPhotoGrid();
  });
  $('#show-photo-trash').addEventListener('change', () => {
    renderDaySelectors();
    renderPhotoGrid();
    selectPhoto($('#studio-photo-grid [data-photo-id]')?.dataset.photoId || null, false);
  });
  $('#trash-photo').addEventListener('click', () => {
    const photo = basePhotos.find(p => p.id === selectedPhotoId);
    if (!photo) return;
    const trashed = !photoWithOverride(photo).trashed;
    state.photos[photo.id] = { ...(state.photos[photo.id] || {}), trashed };
    markDirty(trashed ? 'Photo moved to trash · Save locally to keep this change' : 'Photo restored · Save locally to keep this change');
    renderDaySelectors();
    renderPhotoGrid();
    selectPhoto($('#studio-photo-grid [data-photo-id]')?.dataset.photoId || null, false);
  });
  $('#upload-photos').addEventListener('click', () => uploadPhotos());
  $('#upload-photo-files').addEventListener('change', () => {
    const files = [...$('#upload-photo-files').files];
    $('#photo-upload-selection').textContent = `${files.length} photo${files.length === 1 ? '' : 's'} selected${files.length ? ': ' + files.map(file => file.name).join(', ') : ''}`;
  });
  $('#photo-upload-review').addEventListener('click', event => {
    const button = event.target.closest('[data-retry-photo-day]');
    if (!button || uploadingPhotos) return;
    const reviewId = button.dataset.retryPhotoDay;
    const item = pendingPhotoDays.get(reviewId);
    if (item?.journeyId === journey.id) uploadPhotos([{file:item.file, dayId:$(`#pending-photo-day-${reviewId}`).value, reviewId}]);
  });
  $("#route-day-filter").addEventListener("change", () => {
    renderRouteList();
    const first = dayById($("#route-day-filter").value).segmentIds[0];
    if (first) selectRoute(first, true);
    else { clearSelectedRoute(); if (mapReady) renderDayMap(dayById($("#route-day-filter").value), true); }
  });
  $("#studio-photo-grid").addEventListener("click", (event) => {
    const button = event.target.closest("[data-photo-id]");
    if (button) selectPhoto(button.dataset.photoId);
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
  $("#switch-photo-view").addEventListener("click", switchToCurrentPhotoView);
  $("#clear-photo-location").addEventListener("click", () => {
    $("#photo-lat").value = "";
    $("#photo-lng").value = "";
    readPhotoForm();
    selectPhoto(selectedPhotoId, false);
  });
  $("#photo-move-earlier").addEventListener("click", () => moveSelectedPhoto(-1));
  $("#photo-move-later").addEventListener("click", () => moveSelectedPhoto(1));
  $("#photo-make-lead").addEventListener("click", makeSelectedPhotoLead);
  $("#apply-route-endpoints").addEventListener("click", readEndpointFields);
  $("#propose-route").addEventListener("click", proposeNetworkRoute);
  $("#accept-route-proposal").addEventListener("click", acceptNetworkProposal);
  $("#import-route-gpx").addEventListener("click", proposeGpxTrack);
  $("#accept-route-gpx").addEventListener("click", acceptGpxProposal);
  $("#accept-manual-route").addEventListener("click", acceptManualFallback);
  $("#smooth-route").addEventListener("click", () => {
    routeSmoothed = !routeSmoothed;
    $("#smooth-route").textContent = routeSmoothed ? "Use straight anchor guide" : "Smooth anchor guide";
    updateRouteAnchors();
  });
  $("#reset-route").addEventListener("click", () => {
    const segment = segmentById(selectedSegmentId);
    delete state.routes[selectedSegmentId];
    proposalGate.invalidate();
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
  $("#undo-route").addEventListener("click", () => restoreRouteHistory(-1));
  $("#redo-route").addEventListener("click", () => restoreRouteHistory(1));
  window.addEventListener("beforeunload", (event) => {
    if (!dirty && !uploadingPhotos && !pendingPhotoDays.size) return;
    event.preventDefault();
    event.returnValue = "";
  });

  init();
})();
