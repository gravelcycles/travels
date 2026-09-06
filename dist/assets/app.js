(function () {
  "use strict";

  const data = window.JOURNEY_ATLAS_DATA;
  const OPENFREEMAP_STYLE = "https://tiles.openfreemap.org/styles/positron";
  const palette = {
    route: "#1f6671",
    selected: "#b35f3f",
    casing: "#f7f4ed",
    muted: "#7f999c"
  };
  const labels = { train: "Train", boat: "Boat", bus: "Bus", gondola: "Gondola", walk: "Walk", car: "Car", bike: "Bike" };
  const dashes = {
    train: null,
    boat: [2.2, 1.4],
    bus: [4.2, 2.5],
    gondola: [0.3, 1.4],
    walk: [0.2, 1.15],
    car: [0.15, 1.8],
    bike: [1.25, 1.25]
  };
  const attribution = '<a href="https://openfreemap.org/">OpenFreeMap</a> · <a href="https://openmaptiles.org/">© OpenMapTiles</a> · Data from <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

  let journey = data.journeys.find((item) => item.id === data.defaultJourneyId) || data.journeys[0];
  let activeDayId = journey.days[0].id;
  let activeMode = "all";
  let mapScope = "journey";
  let mainMap;
  let viewerMap;
  let mainMapReady = false;
  let viewerMapReady = false;
  let mainDecorations = { layerIds: [], sourceIds: [], markers: [] };
  let viewerDecorations = { layerIds: [], sourceIds: [], markers: [] };
  let viewerPhotoIndex = 0;
  let swipeStartX = null;

  const $ = (selector) => document.querySelector(selector);
  const dayList = $("#day-list");
  const detailPanel = $("#story-detail");
  const storyMedia = $("#story-media");
  const photoStrip = $("#photo-strip");
  const photoDialog = $("#photo-dialog");
  const mapStatus = $("#map-status");

  function placeById(id) {
    return journey.places.find((place) => place.id === id);
  }

  function segmentById(id) {
    return journey.segments.find((segment) => segment.id === id);
  }

  function dayById(id) {
    return journey.days.find((day) => day.id === id);
  }

  function photoById(id) {
    return journey.photos.find((photo) => photo.id === id);
  }

  function activeDay() {
    return dayById(activeDayId) || journey.days[0];
  }

  function destinationForDay(day) {
    return placeById(day.destinationId || day.placeId);
  }

  function segmentsForDay(day) {
    return day.segmentIds.map(segmentById).filter(Boolean);
  }

  function photosForDay(dayId) {
    return journey.photos.filter((photo) => photo.dayId === dayId);
  }

  function orderedPhotos() {
    const dayOrder = new Map(journey.days.map((day, index) => [day.id, index]));
    return journey.photos
      .map((photo, index) => ({ photo, index }))
      .sort((a, b) => (dayOrder.get(a.photo.dayId) ?? 9999) - (dayOrder.get(b.photo.dayId) ?? 9999) || a.index - b.index)
      .map(({ photo }) => photo);
  }

  function modesForDay(day) {
    return [...new Set(segmentsForDay(day).map((segment) => segment.mode))];
  }

  function formatDistance(value) {
    return new Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(value) + " km";
  }

  function totalDistance() {
    return journey.segments.reduce((sum, segment) => sum + (segment.distanceKm || 0), 0);
  }

  function dayDistance(day) {
    return segmentsForDay(day).reduce((sum, segment) => sum + (segment.distanceKm || 0), 0);
  }

  function dayDuration(day) {
    return segmentsForDay(day).map((segment) => segment.duration).filter(Boolean).join(" + ");
  }

  function renderRouteLegs(day) {
    const segments = segmentsForDay(day);
    if (!segments.length) return "";
    return `
      <div class="route-legs">
        <h3>Route legs</h3>
        <ol>
          ${segments.map((segment) => {
            const from = placeById(segment.from);
            const to = placeById(segment.to);
            const mappedPoints = segmentCoordinates(segment).length;
            const stopCount = (segment.stops || []).length + 2;
            return `
              <li>
                <span class="leg-mode">${lineSwatch(segment.mode)}${escapeHtml(labels[segment.mode] || segment.mode)}</span>
                <strong>${escapeHtml(from.name)} → ${escapeHtml(to.name)}</strong>
                <small>${segment.distanceKm ? formatDistance(segment.distanceKm) : "Distance not added"}${segment.duration ? ` · ${escapeHtml(segment.duration)}` : ""}${segment.stops ? ` · ${stopCount} stops` : ` · ${mappedPoints} mapped points`}</small>
              </li>
            `;
          }).join("")}
        </ol>
      </div>
    `;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function segmentCoordinates(segment) {
    const from = placeById(segment.from);
    const to = placeById(segment.to);
    const points = segment.stops || segment.via || [];
    return [
      [from.lng, from.lat],
      ...points.map((point) => Array.isArray(point) ? [point[1], point[0]] : [point.lng, point.lat]),
      [to.lng, to.lat]
    ];
  }

  function dayCoordinates(day) {
    const coordinates = segmentsForDay(day).flatMap(segmentCoordinates);
    if (coordinates.length) return coordinates;
    const place = destinationForDay(day);
    return place ? [[place.lng, place.lat]] : [];
  }

  function journeyCoordinates() {
    return journey.segments.flatMap(segmentCoordinates).concat(journey.places.map((place) => [place.lng, place.lat]));
  }

  function boundsFromCoordinates(coordinates) {
    if (!coordinates.length || !window.maplibregl) return null;
    return coordinates.reduce(
      (bounds, coordinate) => bounds.extend(coordinate),
      new maplibregl.LngLatBounds(coordinates[0], coordinates[0])
    );
  }

  function routeLabel(day) {
    const segments = segmentsForDay(day);
    const place = destinationForDay(day);
    if (!segments.length) return `${place.name} · stayed here`;
    const from = placeById(segments[0].from);
    const to = placeById(segments[segments.length - 1].to);
    if (from.id === to.id) return `${place.name} · day trip`;
    return `${from.name} → ${to.name}`;
  }

  function modeLabel(day) {
    const modes = modesForDay(day);
    return modes.length ? modes.map((mode) => labels[mode]).join(" + ") : "In one place";
  }

  function mapIsReady(map) {
    return map && map.isStyleLoaded();
  }

  function applyBasemapTreatment(map) {
    const roadWords = /(road|highway|motorway|trunk|primary|secondary|tertiary|minor|street|transportation|bridge|tunnel)/i;
    const keepWords = /(rail|ferry|boundary|waterway)/i;
    const layers = map.getStyle().layers || [];
    layers.forEach((layer) => {
      const id = layer.id || "";
      if ((roadWords.test(id) && !keepWords.test(id)) || /poi/i.test(id)) {
        map.setLayoutProperty(id, "visibility", "none");
      }
      if (layer.type === "background") {
        map.setPaintProperty(id, "background-color", "#edf0ed");
      }
      if (layer.type === "fill" && /water/i.test(id)) {
        map.setPaintProperty(id, "fill-color", "#dce5e4");
      }
    });
  }

  function createMap(container, compact) {
    const map = new maplibregl.Map({
      container,
      style: OPENFREEMAP_STYLE,
      center: [9.2, 47.1],
      zoom: 5,
      minZoom: 2,
      attributionControl: false
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.AttributionControl({ compact: compact, customAttribution: attribution }), "bottom-right");
    return map;
  }

  function initMainMap() {
    if (!window.maplibregl) {
      mapStatus.hidden = false;
      mapStatus.textContent = "The live map could not load. The day journal and photos still work.";
      return;
    }
    mainMap = createMap("map", true);
    const initialBounds = boundsFromCoordinates(journeyCoordinates());
    if (initialBounds) mainMap.fitBounds(initialBounds, { padding: 62, maxZoom: 8, duration: 0 });
    const finishMainMapSetup = () => {
      if (mainMapReady || !mapIsReady(mainMap)) return;
      mainMapReady = true;
      applyBasemapTreatment(mainMap);
      drawMainMap(true);
    };
    mainMap.on("styledata", finishMainMapSetup);
    mainMap.on("load", finishMainMapSetup);
    mainMap.on("click", (event) => {
      const feature = mainMap.queryRenderedFeatures(event.point).find((item) => item.properties && item.properties.segmentId);
      if (!feature) return;
      const day = journey.days.find((item) => item.segmentIds.includes(feature.properties.segmentId));
      if (day) setActiveDay(day.id, true);
    });
    mainMap.on("mousemove", (event) => {
      const overRoute = mainMap.queryRenderedFeatures(event.point).some((item) => item.properties && item.properties.segmentId);
      mainMap.getCanvas().style.cursor = overRoute ? "pointer" : "";
    });
    mainMap.on("error", () => {
      if (!mainMapReady) {
        mapStatus.hidden = false;
        mapStatus.textContent = "OpenFreeMap is temporarily unavailable; the day journal and photos still work.";
      }
    });
  }

  function clearDecorations(map, decorations) {
    decorations.markers.forEach((marker) => marker.remove());
    decorations.layerIds.slice().reverse().forEach((id) => {
      if (map.getLayer(id)) map.removeLayer(id);
    });
    decorations.sourceIds.slice().reverse().forEach((id) => {
      if (map.getSource(id)) map.removeSource(id);
    });
    decorations.layerIds = [];
    decorations.sourceIds = [];
    decorations.markers = [];
  }

  function addSegmentLayer(map, decorations, segment, options) {
    const prefix = options.prefix;
    const sourceId = `${prefix}-source-${segment.id}`;
    const casingId = `${prefix}-casing-${segment.id}`;
    const lineId = `${prefix}-line-${segment.id}`;
    map.addSource(sourceId, {
      type: "geojson",
      data: {
        type: "Feature",
        properties: { segmentId: segment.id },
        geometry: { type: "LineString", coordinates: segmentCoordinates(segment) }
      }
    });
    map.addLayer({
      id: casingId,
      type: "line",
      source: sourceId,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": palette.casing,
        "line-width": options.selected ? 8.5 : 7,
        "line-opacity": options.opacity
      }
    });
    const paint = {
      "line-color": options.selected ? palette.selected : palette.route,
      "line-width": options.selected ? 5.5 : 3.6,
      "line-opacity": options.opacity
    };
    if (dashes[segment.mode]) paint["line-dasharray"] = dashes[segment.mode];
    map.addLayer({
      id: lineId,
      type: "line",
      source: sourceId,
      layout: { "line-cap": "round", "line-join": "round" },
      paint
    });
    decorations.sourceIds.push(sourceId);
    decorations.layerIds.push(casingId, lineId);
  }

  function groupedDayMarkers() {
    const groups = new Map();
    journey.days.forEach((day) => {
      const place = destinationForDay(day);
      if (!place) return;
      const key = place.id;
      if (!groups.has(key)) groups.set(key, { place, days: [] });
      groups.get(key).days.push(day);
    });
    return [...groups.values()];
  }

  function markerLabel(days) {
    const numbers = days.map((day) => day.number);
    const consecutive = numbers.every((number, index) => index === 0 || number === numbers[index - 1] + 1);
    if (numbers.length === 1) return String(numbers[0]).padStart(2, "0");
    if (consecutive) return `${String(numbers[0]).padStart(2, "0")}–${String(numbers[numbers.length - 1]).padStart(2, "0")}`;
    return numbers.map((number) => String(number).padStart(2, "0")).join(",");
  }

  function addDayMarkers() {
    groupedDayMarkers()
      .filter((group) => mapScope === "journey" || group.days.some((day) => day.id === activeDayId))
      .forEach((group) => {
      const containsActive = group.days.some((day) => day.id === activeDayId);
      const element = document.createElement("button");
      element.type = "button";
      element.className = `day-marker ${containsActive ? "selected" : ""}`;
      element.textContent = markerLabel(group.days);
      element.title = group.days.map((day) => `Day ${day.number}: ${day.title}`).join("\n");
      element.setAttribute("aria-label", `${group.place.name}: ${group.days.map((day) => `day ${day.number}`).join(", ")}`);
      element.addEventListener("click", (event) => {
        event.stopPropagation();
        const activeIndex = group.days.findIndex((day) => day.id === activeDayId);
        const next = group.days[activeIndex >= 0 ? (activeIndex + 1) % group.days.length : 0];
        setActiveDay(next.id, true);
      });
      const marker = new maplibregl.Marker({ element, anchor: "center" })
        .setLngLat([group.place.lng, group.place.lat])
        .addTo(mainMap);
      mainDecorations.markers.push(marker);
    });
  }

  function addRailStopMarkers(map, decorations, day) {
    const seen = new Set();
    segmentsForDay(day).filter((segment) => segment.mode === "train").forEach((segment) => {
      const from = placeById(segment.from);
      const to = placeById(segment.to);
      const stops = [
        { name: from.name, lat: from.lat, lng: from.lng },
        ...(segment.stops || []),
        { name: to.name, lat: to.lat, lng: to.lng }
      ];
      stops.forEach((stop) => {
        const key = `${stop.name}-${stop.lat}-${stop.lng}`;
        if (seen.has(key)) return;
        seen.add(key);
        const element = document.createElement("div");
        element.className = "rail-stop-marker";
        element.title = stop.name;
        element.setAttribute("role", "img");
        element.setAttribute("aria-label", `Rail stop: ${stop.name}`);
        const marker = new maplibregl.Marker({ element, anchor: "center" })
          .setLngLat([stop.lng, stop.lat])
          .addTo(map);
        decorations.markers.push(marker);
      });
    });
  }

  function drawMainMap(fit) {
    if (!mainMapReady || !mapIsReady(mainMap)) return;
    clearDecorations(mainMap, mainDecorations);
    const selectedSegments = new Set(activeDay().segmentIds);
    [...journey.segments]
      .filter((segment) => mapScope === "journey" || selectedSegments.has(segment.id))
      .sort((a, b) => Number(selectedSegments.has(a.id)) - Number(selectedSegments.has(b.id)))
      .forEach((segment) => {
        const visible = activeMode === "all" || activeMode === segment.mode;
        const selected = selectedSegments.has(segment.id);
        addSegmentLayer(mainMap, mainDecorations, segment, {
          prefix: "main",
          selected,
          opacity: visible ? (selected ? 1 : 0.72) : 0.025
        });
      });
    addDayMarkers();
    if (mapScope === "day") addRailStopMarkers(mainMap, mainDecorations, activeDay());
    if (fit) fitJourneyBounds();
  }

  function fitJourneyBounds() {
    if (!mainMapReady) return;
    const bounds = boundsFromCoordinates(journeyCoordinates());
    if (bounds) mainMap.fitBounds(bounds, { padding: 62, maxZoom: 8, duration: 650 });
  }

  function fitRoute() {
    mapScope = "journey";
    drawMainMap(false);
    fitJourneyBounds();
  }

  function focusDay(day) {
    if (!mainMapReady) return;
    mapScope = "day";
    drawMainMap(false);
    const coordinates = dayCoordinates(day);
    if (coordinates.length > 1) {
      mainMap.fitBounds(boundsFromCoordinates(coordinates), { padding: 54, maxZoom: 12.5, duration: 650 });
    } else if (coordinates.length === 1) {
      mainMap.easeTo({ center: coordinates[0], zoom: 12, duration: 650 });
    }
  }

  function renderJourneyIdentity() {
    $("#journey-name").textContent = journey.label;
  }

  function renderOverview() {
    $("#site-badge").textContent = journey.badge || "ATLAS DEMO";
    $("#journey-kicker").textContent = journey.kicker;
    $("#journey-title").textContent = journey.title;
    $("#journey-subtitle").textContent = journey.subtitle;
    $("#day-count").textContent = `${journey.days.length} days`;
    $("#photo-count").textContent = journey.photos.length;
    $("#journey-summary").innerHTML = `
      <div><strong>${escapeHtml(journey.dates)}</strong><span>TRAVEL DATES</span></div>
      <div><strong>${formatDistance(totalDistance())}</strong><span>ROUTE LENGTH</span></div>
      <div><strong>${journey.days.length}</strong><span>DAYS</span></div>
    `;
  }

  function lineSwatch(mode) {
    return `<i class="line-swatch ${escapeHtml(mode)}" aria-hidden="true"></i>`;
  }

  function renderModeFilter() {
    const modes = [...new Set(journey.segments.map((segment) => segment.mode))];
    const options = ["all", ...modes];
    $("#mode-filter").innerHTML = options.map((mode) => {
      const label = mode === "all" ? "All modes" : labels[mode];
      return `<button type="button" data-mode="${mode}" class="${activeMode === mode ? "active" : ""}">${mode === "all" ? "" : lineSwatch(mode)}${label}</button>`;
    }).join("");
    $("#map-legend").innerHTML = modes.map((mode) => `<span>${lineSwatch(mode)}${labels[mode]}</span>`).join("") + '<span><i class="rail-stop-swatch" aria-hidden="true"></i>Rail stop</span>';
  }

  function renderDays() {
    dayList.innerHTML = journey.days.map((day) => {
      const modes = modesForDay(day);
      const photos = photosForDay(day.id);
      const muted = activeMode !== "all" && modes.length && !modes.includes(activeMode);
      const pattern = modes[0] || "stay";
      return `
        <button class="day-row ${day.id === activeDayId ? "active" : ""} ${muted ? "muted" : ""}" data-day-id="${escapeHtml(day.id)}" type="button">
          <span class="day-index">${String(day.number).padStart(2, "0")}</span>
          <span class="day-copy">
            <small>${escapeHtml(day.date)} · ${escapeHtml(modeLabel(day))}</small>
            <strong>${escapeHtml(day.title)}</strong>
            <em>${escapeHtml(routeLabel(day))}</em>
          </span>
          <span class="day-meta">${photos.length ? `${photos.length} photo${photos.length === 1 ? "" : "s"}` : ""}${pattern !== "stay" ? lineSwatch(pattern) : ""}</span>
        </button>
      `;
    }).join("");
    const current = dayList.querySelector(".day-row.active");
    if (current) current.scrollIntoView({ block: "nearest" });
  }

  function renderStory() {
    const day = activeDay();
    const photos = photosForDay(day.id);
    const leadPhoto = photos[0];
    if (leadPhoto) {
      storyMedia.innerHTML = `
        <button type="button" data-open-photo="${escapeHtml(leadPhoto.id)}" aria-label="Open ${escapeHtml(leadPhoto.caption)} full screen">
          <img src="${escapeHtml(leadPhoto.src)}" alt="${escapeHtml(leadPhoto.alt)}" />
          <span>DAY ${String(day.number).padStart(2, "0")} · ${photos.length} PHOTO${photos.length === 1 ? "" : "S"}</span>
          <small>${escapeHtml(leadPhoto.caption)}</small>
        </button>
      `;
    } else {
      storyMedia.innerHTML = `
        <div class="story-empty" aria-label="No photos for this day">
          <span>DAY ${String(day.number).padStart(2, "0")}</span>
          <strong>${escapeHtml(destinationForDay(day).name)}</strong>
          <small>No photographs added yet</small>
        </div>
      `;
    }

    const distance = dayDistance(day);
    const duration = dayDuration(day);
    const modes = modesForDay(day);
    detailPanel.innerHTML = `
      <div class="detail-eyebrow">DAY ${String(day.number).padStart(2, "0")} · ${escapeHtml(day.date)}</div>
      <h2>${escapeHtml(day.title)}</h2>
      <p class="place-line">${escapeHtml(routeLabel(day))}</p>
      <div class="detail-stats">
        <div><strong>${distance ? formatDistance(distance) : escapeHtml(destinationForDay(day).name)}</strong><span>${distance ? "DISTANCE" : "WHERE"}</span></div>
        <div><strong>${duration ? escapeHtml(duration) : "No travel"}</strong><span>${modes.length ? escapeHtml(modeLabel(day).toUpperCase()) : "DAY TYPE"}</span></div>
      </div>
      ${renderRouteLegs(day)}
      <h3>The day</h3>
      <p>${escapeHtml(day.text)}</p>
      <div class="detail-foot">${escapeHtml(journey.note)}</div>
    `;

    photoStrip.innerHTML = photos.length
      ? photos.map((photo, index) => `
          <button type="button" data-open-photo="${escapeHtml(photo.id)}" aria-label="Open ${escapeHtml(photo.caption)} full screen">
            <img src="${escapeHtml(photo.src)}" alt="" />
            <span>${String(index + 1).padStart(2, "0")}</span>
            <small>${escapeHtml(photo.caption)}</small>
          </button>
        `).join("")
      : '<div class="photo-empty">This day is ready for photos whenever you add them.</div>';
  }

  function renderAll(options) {
    renderJourneyIdentity();
    renderOverview();
    renderModeFilter();
    renderDays();
    renderStory();
    drawMainMap(Boolean(options && options.fit));
  }

  function setActiveDay(id, focus) {
    if (!dayById(id)) return;
    activeDayId = id;
    renderDays();
    renderStory();
    if (focus) {
      focusDay(activeDay());
    } else {
      drawMainMap(false);
    }
  }

  function setMobileTab(tab) {
    $(".atlas-shell").dataset.mobileTab = tab;
    document.querySelectorAll(".mobile-nav button").forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
    if (tab === "map" && mainMap) window.setTimeout(() => mainMap.resize(), 80);
  }

  function initViewerMap() {
    if (viewerMap || !window.maplibregl) {
      if (viewerMap) {
        viewerMap.resize();
        syncViewerMap();
      }
      return;
    }
    viewerMap = createMap("photo-map", true);
    const finishViewerMapSetup = () => {
      if (viewerMapReady || !mapIsReady(viewerMap)) return;
      viewerMapReady = true;
      applyBasemapTreatment(viewerMap);
      syncViewerMap();
    };
    viewerMap.on("styledata", finishViewerMapSetup);
    viewerMap.on("load", finishViewerMapSetup);
  }

  function renderViewerFilmstrip(photos) {
    $("#viewer-filmstrip").innerHTML = photos.map((photo, index) => {
      const day = dayById(photo.dayId);
      return `
        <button type="button" data-viewer-index="${index}" class="${index === viewerPhotoIndex ? "active" : ""}" aria-label="Show photo ${index + 1}, day ${day.number}">
          <img src="${escapeHtml(photo.src)}" alt="" />
          <span>D${day.number}</span>
        </button>
      `;
    }).join("");
    const activeThumb = $("#viewer-filmstrip .active");
    if (activeThumb) activeThumb.scrollIntoView({ block: "nearest", inline: "center" });
  }

  function updateViewer() {
    const photos = orderedPhotos();
    const photo = photos[viewerPhotoIndex];
    if (!photo) return;
    const day = dayById(photo.dayId);
    activeDayId = day.id;
    $("#modal-photo").src = photo.src;
    $("#modal-photo").alt = photo.alt;
    $("#modal-caption").textContent = `${photo.caption} · ${photo.takenAt || `Day ${day.number}`}`;
    $("#modal-progress").textContent = `PHOTO ${viewerPhotoIndex + 1} OF ${photos.length} · DAY ${day.number}`;
    $("#modal-day-title").textContent = day.title;
    $("#modal-day-route").textContent = routeLabel(day);
    $(".photo-prev").disabled = viewerPhotoIndex === 0;
    $(".photo-next").disabled = viewerPhotoIndex === photos.length - 1;
    renderViewerFilmstrip(photos);
    renderDays();
    renderStory();
    drawMainMap(false);
    if (viewerMapReady) syncViewerMap();
  }

  function syncViewerMap() {
    if (!viewerMapReady || !mapIsReady(viewerMap)) return;
    clearDecorations(viewerMap, viewerDecorations);
    const photo = orderedPhotos()[viewerPhotoIndex];
    if (!photo) return;
    const day = dayById(photo.dayId);
    const selectedSegments = new Set(day.segmentIds);
    [...journey.segments]
      .sort((a, b) => Number(selectedSegments.has(a.id)) - Number(selectedSegments.has(b.id)))
      .forEach((segment) => {
      addSegmentLayer(viewerMap, viewerDecorations, segment, {
        prefix: "viewer",
        selected: selectedSegments.has(segment.id),
        opacity: selectedSegments.has(segment.id) ? 1 : 0.24
      });
    });
    addRailStopMarkers(viewerMap, viewerDecorations, day);
    if (Number.isFinite(photo.lng) && Number.isFinite(photo.lat)) {
      const element = document.createElement("div");
      element.className = "photo-location-marker";
      element.setAttribute("aria-label", "Current photo location");
      const marker = new maplibregl.Marker({ element, anchor: "center" }).setLngLat([photo.lng, photo.lat]).addTo(viewerMap);
      viewerDecorations.markers.push(marker);
      viewerMap.easeTo({ center: [photo.lng, photo.lat], zoom: 9.5, duration: 650 });
    } else {
      const coordinates = dayCoordinates(day);
      if (coordinates.length > 1) {
        viewerMap.fitBounds(boundsFromCoordinates(coordinates), { padding: 45, maxZoom: 9, duration: 650 });
      } else if (coordinates.length === 1) {
        viewerMap.easeTo({ center: coordinates[0], zoom: 9, duration: 650 });
      }
    }
  }

  function openPhoto(photoId) {
    const photos = orderedPhotos();
    const index = photos.findIndex((photo) => photo.id === photoId);
    viewerPhotoIndex = index >= 0 ? index : 0;
    if (!photoDialog.open) photoDialog.showModal();
    updateViewer();
    window.requestAnimationFrame(initViewerMap);
  }

  function moveViewer(delta) {
    const next = Math.max(0, Math.min(orderedPhotos().length - 1, viewerPhotoIndex + delta));
    if (next === viewerPhotoIndex) return;
    viewerPhotoIndex = next;
    updateViewer();
  }

  $("#mode-filter").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-mode]");
    if (!button) return;
    activeMode = button.dataset.mode;
    renderModeFilter();
    renderDays();
    drawMainMap(false);
  });

  dayList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-day-id]");
    if (button) setActiveDay(button.dataset.dayId, true);
  });

  [storyMedia, photoStrip].forEach((container) => container.addEventListener("click", (event) => {
    const button = event.target.closest("[data-open-photo]");
    if (button) openPhoto(button.dataset.openPhoto);
  }));

  $("#fit-route").addEventListener("click", fitRoute);
  $("#focus-day").addEventListener("click", () => focusDay(activeDay()));
  $("#show-all-photos").addEventListener("click", () => {
    const first = orderedPhotos()[0];
    if (first) openPhoto(first.id);
  });
  $("#open-notes").addEventListener("click", () => $("#notes-dialog").showModal());
  $(".photo-close").addEventListener("click", () => photoDialog.close());
  $(".photo-prev").addEventListener("click", () => moveViewer(-1));
  $(".photo-next").addEventListener("click", () => moveViewer(1));
  $("#viewer-filmstrip").addEventListener("click", (event) => {
    const button = event.target.closest("[data-viewer-index]");
    if (!button) return;
    viewerPhotoIndex = Number(button.dataset.viewerIndex);
    updateViewer();
  });
  photoDialog.addEventListener("click", (event) => {
    if (event.target === photoDialog) photoDialog.close();
  });
  $(".photo-stage").addEventListener("pointerdown", (event) => { swipeStartX = event.clientX; });
  $(".photo-stage").addEventListener("pointerup", (event) => {
    if (swipeStartX === null) return;
    const distance = event.clientX - swipeStartX;
    if (Math.abs(distance) > 60) moveViewer(distance < 0 ? 1 : -1);
    swipeStartX = null;
  });
  document.addEventListener("keydown", (event) => {
    if (!photoDialog.open) return;
    if (event.key === "ArrowLeft") moveViewer(-1);
    if (event.key === "ArrowRight") moveViewer(1);
  });
  document.querySelectorAll(".mobile-nav button").forEach((button) => button.addEventListener("click", () => setMobileTab(button.dataset.tab)));
  window.addEventListener("resize", () => {
    if (mainMap) mainMap.resize();
    if (viewerMap && photoDialog.open) viewerMap.resize();
  });

  renderAll({ fit: false });
  initMainMap();
})();
