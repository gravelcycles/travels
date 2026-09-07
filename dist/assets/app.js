(function () {
  "use strict";

  const data = window.JOURNEY_ATLAS_DATA;
  const realJourney = data.journeys.find((item) => item.id === data.defaultJourneyId);
  if (realJourney && Array.isArray(window.JOURNEY_ATLAS_TRIP_PHOTOS)) {
    const contentOverrides = window.JOURNEY_ATLAS_CONTENT_OVERRIDES || { photos: {}, routes: {} };
    realJourney.photos = window.JOURNEY_ATLAS_TRIP_PHOTOS
      .map((photo) => {
        const override = contentOverrides.photos?.[photo.id] || {};
        const location = override.location || {};
        return { ...photo, ...override, ...location };
      })
      .filter((photo) => !photo.hidden);
    realJourney.segments.forEach((segment) => {
      const override = contentOverrides.routes?.[segment.id];
      if (override?.geometry?.length > 1) segment.geometry = override.geometry;
    });
  }
  const OPENFREEMAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";
  const PHOTO_ZOOM_LIMITS = { min: 2, max: 20 };
  const palette = {
    route: "#006f92",
    selected: "#d4512c",
    casing: "#fffef8",
    muted: "#71878a"
  };
  const labels = { train: "Train", boat: "Ferry", bus: "Bus", gondola: "Gondola", walk: "Walk", car: "Car", bike: "Bike" };
  const modeStyles = {
    train: { color: "#0072b2", width: 5.8, dash: null, cue: "solid" },
    boat: { color: "#007f8b", width: 5.1, dash: [1.1, 1.6], cue: "short dash" },
    bus: { color: "#a85c00", width: 5, dash: [5.5, 2.2], cue: "long dash" },
    gondola: { color: "#7b4ba3", width: 4.2, dash: [0.5, 2.1], cue: "spaced dot" },
    walk: { color: "#3d4a4d", width: 4, dash: [0.1, 1.5], cue: "fine dot" },
    car: { color: "#a43a2f", width: 5.4, dash: [7, 1.8, 1.2, 1.8], cue: "dash-dot" },
    bike: { color: "#24804f", width: 4.7, dash: [2.4, 1.2], cue: "medium dash" }
  };
  const attribution = '<a href="https://openfreemap.org/">OpenFreeMap</a> · <a href="https://openmaptiles.org/">© OpenMapTiles</a> · Data from <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

  const pageScope = document.body.dataset.journeyScope;
  const requestedJourneyId = document.body.dataset.journeyId;
  const isDemoPage = pageScope === "demo";
  const availableJourneys = isDemoPage
    ? data.journeys.filter((item) => item.kind === "demo")
    : data.journeys.filter((item) => item.kind === "real");
  let journey = availableJourneys.find((item) => item.id === requestedJourneyId)
    || availableJourneys.find((item) => item.id === data.defaultJourneyId)
    || availableJourneys[0]
    || data.journeys[0];
  let activeDayId = journey.days[0].id;
  let mapScope = "journey";
  let mainMap;
  let viewerMap;
  let mainMapReady = false;
  let viewerMapReady = false;
  let mainDecorations = { layerIds: [], sourceIds: [], markers: [], hitLayerIds: [] };
  let mainDayMarkers = [];
  let viewerDecorations = { layerIds: [], sourceIds: [], markers: [], hitLayerIds: [] };
  let inspectedSegmentId = null;
  let routeInspectionPinned = false;
  let viewerDayId = activeDayId;
  let viewerPhotoIndex = 0;
  let swipeStartX = null;
  let hasPlayedOpeningMove = false;
  let pendingMapAction = null;
  const preloadedPhotoUrls = new Set();
  const lazyImageObserver = "IntersectionObserver" in window
    ? new IntersectionObserver((entries, observer) => {
        entries.filter((entry) => entry.isIntersecting).forEach((entry) => {
          hydrateImage(entry.target);
          observer.unobserve(entry.target);
        });
      }, { rootMargin: "700px 300px" })
    : null;

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

  function photoAssetUrl(url) {
    if (!url) return "";
    const useLocalAssets = new URLSearchParams(window.location.search).get("photoSource") === "local";
    if (useLocalAssets && url.includes("/releases/download/trip-photos-v1/")) {
      return `../build/trip-photos-v1/${decodeURIComponent(url.split("/").pop())}`;
    }
    return url;
  }

  function photoSrcset(photo) {
    return (photo.srcset || []).map((variant) => `${photoAssetUrl(variant.src)} ${variant.width}w`).join(", ");
  }

  function photoImageMarkup(photo, options = {}) {
    const alt = options.alt ?? photo.alt ?? "";
    if (!photo.blur || !photo.srcset?.length) {
      return `<img src="${escapeHtml(photo.src)}" alt="${escapeHtml(alt)}" loading="${options.eager ? "eager" : "lazy"}" decoding="async" />`;
    }
    return `<img class="progressive-image" src="${escapeHtml(photo.blur)}" data-src="${escapeHtml(photoAssetUrl(photo.src))}" data-srcset="${escapeHtml(photoSrcset(photo))}" sizes="${escapeHtml(options.sizes || "100vw")}" alt="${escapeHtml(alt)}" width="${photo.width}" height="${photo.height}" loading="${options.eager ? "eager" : "lazy"}" decoding="async"${options.eager ? ' data-eager="true"' : ""} />`;
  }

  function hydrateImage(image) {
    if (!image?.dataset.src) return;
    const markLoaded = () => image.classList.add("is-loaded");
    image.addEventListener("load", markLoaded, { once: true });
    if (image.dataset.srcset) image.srcset = image.dataset.srcset;
    image.src = image.dataset.src;
    image.removeAttribute("data-src");
    image.removeAttribute("data-srcset");
    if (image.complete) markLoaded();
  }

  function prepareProgressiveImages(container) {
    container.querySelectorAll("img.progressive-image").forEach((image) => {
      if (image.dataset.eager === "true" || !lazyImageObserver) hydrateImage(image);
      else lazyImageObserver.observe(image);
    });
  }

  function preferredPhotoUrl(photo, targetWidth) {
    const variants = photo.srcset || [];
    const selected = variants.find((variant) => variant.width >= targetWidth) || variants[variants.length - 1];
    return photoAssetUrl(selected?.src || photo.src);
  }

  function preloadPhoto(photo, targetWidth = 1280) {
    if (!photo) return;
    const url = preferredPhotoUrl(photo, targetWidth);
    if (!url || preloadedPhotoUrls.has(url)) return;
    preloadedPhotoUrls.add(url);
    const image = new Image();
    image.decoding = "async";
    image.src = url;
  }

  function preloadAround(photoId, radius = 2, targetWidth = 1280) {
    const photos = orderedPhotos();
    const index = photos.findIndex((photo) => photo.id === photoId);
    if (index < 0) return;
    for (let offset = 1; offset <= radius; offset += 1) {
      preloadPhoto(photos[index - offset], targetWidth);
      preloadPhoto(photos[index + offset], targetWidth);
    }
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
                <button class="leg-card" type="button" data-route-segment="${escapeHtml(segment.id)}" aria-label="Explore ${escapeHtml(labels[segment.mode] || segment.mode)} route from ${escapeHtml(from.name)} to ${escapeHtml(to.name)}">
                  <span class="leg-mode">${lineSwatch(segment.mode)}${escapeHtml(labels[segment.mode] || segment.mode)}</span>
                  <strong>${escapeHtml(from.name)} → ${escapeHtml(to.name)}</strong>
                  <small>${segment.distanceKm ? formatDistance(segment.distanceKm) : "Distance not added"}${segment.duration ? ` · ${escapeHtml(segment.duration)}` : ""}${segment.stops ? ` · ${stopCount} stops` : ` · ${mappedPoints} mapped points`}</small>
                </button>
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
    const detailedGeometry = segment.geometry || window.JOURNEY_ATLAS_ROUTE_GEOMETRY?.[segment.id];
    if (Array.isArray(detailedGeometry) && detailedGeometry.length >= 2) {
      return detailedGeometry;
    }
    const points = segment.via || segment.stops || [];
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

  function dayForSegment(segmentId) {
    return journey.days.find((day) => day.segmentIds.includes(segmentId));
  }

  function conciseDayStory(day) {
    const text = String(day?.text || "").trim();
    const firstSentence = text.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim() || text;
    return firstSentence.length > 175 ? `${firstSentence.slice(0, 172).trimEnd()}…` : firstSentence;
  }

  function syncInspectionClasses() {
    const inspectedDay = inspectedSegmentId ? dayForSegment(inspectedSegmentId) : null;
    document.querySelectorAll(".day-row").forEach((row) => row.classList.toggle("route-preview", row.dataset.dayId === inspectedDay?.id));
    document.querySelectorAll(".leg-card").forEach((card) => card.classList.toggle("route-preview", card.dataset.routeSegment === inspectedSegmentId));
  }

  function setInspectedFeatureState(segmentId, inspected) {
    if (!mainMapReady || !segmentId) return;
    const sourceId = `main-source-${segmentId}`;
    if (mainMap.getSource(sourceId)) mainMap.setFeatureState({ source: sourceId, id: segmentId }, { inspected });
  }

  function inspectSegment(segmentId, pinned = false) {
    const segment = segmentById(segmentId);
    const day = dayForSegment(segmentId);
    if (!segment || !day) return;
    if (routeInspectionPinned && !pinned && inspectedSegmentId !== segmentId) return;
    if (inspectedSegmentId && inspectedSegmentId !== segmentId) setInspectedFeatureState(inspectedSegmentId, false);
    inspectedSegmentId = segmentId;
    routeInspectionPinned = pinned || routeInspectionPinned;
    setInspectedFeatureState(segmentId, true);
    syncInspectionClasses();
    const from = placeById(segment.from);
    const to = placeById(segment.to);
    $("#route-inspector").hidden = false;
    $("#route-inspector-meta").textContent = `Day ${day.number} · ${labels[segment.mode] || segment.mode}`;
    $("#route-inspector-title").textContent = `${from.name} → ${to.name}`;
    $("#route-inspector-story").textContent = conciseDayStory(day);
  }

  function clearSegmentInspection(force = false) {
    if (routeInspectionPinned && !force) return;
    setInspectedFeatureState(inspectedSegmentId, false);
    inspectedSegmentId = null;
    routeInspectionPinned = false;
    $("#route-inspector").hidden = true;
    syncInspectionClasses();
  }

  function routeFeatureAtPoint(point) {
    const layers = mainDecorations.hitLayerIds.filter((id) => mainMap.getLayer(id));
    if (!layers.length) return null;
    return mainMap.queryRenderedFeatures(point, { layers }).find((feature) => feature.properties?.segmentId) || null;
  }

  function mapIsReady(map) {
    return map && map.isStyleLoaded();
  }

  function applyBasemapTreatment(map) {
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

  function createMap(container, compact) {
    const options = {
      container,
      style: OPENFREEMAP_STYLE,
      center: [9.2, 47.4],
      zoom: 4.35,
      minZoom: 2,
      attributionControl: false
    };
    const map = new maplibregl.Map(options);
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
    let setupAttempts = 0;
    const finishMainMapSetup = () => {
      if (mainMapReady) return;
      if (!mapIsReady(mainMap)) {
        setupAttempts += 1;
        if (setupAttempts < 24) window.setTimeout(finishMainMapSetup, 500);
        return;
      }
      mainMapReady = true;
      applyBasemapTreatment(mainMap);
      drawMainMap(false);
      if (!hasPlayedOpeningMove) {
        hasPlayedOpeningMove = true;
        window.requestAnimationFrame(() => fitJourneyBounds(prefersReducedMotion() ? 0 : 2500));
      }
    };
    mainMap.on("styledata", finishMainMapSetup);
    mainMap.on("load", finishMainMapSetup);
    mainMap.on("moveend", refreshDayMarkerOffsets);
    finishMainMapSetup();
    mainMap.on("click", (event) => {
      const feature = routeFeatureAtPoint(event.point);
      if (!feature) {
        clearSegmentInspection(true);
        return;
      }
      const segmentId = feature.properties.segmentId;
      const day = dayForSegment(segmentId);
      if (day) setActiveDay(day.id, true);
      inspectSegment(segmentId, true);
    });
    mainMap.on("mousemove", (event) => {
      const feature = routeFeatureAtPoint(event.point);
      mainMap.getCanvas().style.cursor = feature ? "pointer" : "";
      if (feature) inspectSegment(feature.properties.segmentId);
      else clearSegmentInspection();
    });
    mainMap.on("mouseleave", () => {
      mainMap.getCanvas().style.cursor = "";
      clearSegmentInspection();
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
    decorations.hitLayerIds = [];
  }

  function addSegmentLayer(map, decorations, segment, options) {
    const prefix = options.prefix;
    const sourceId = `${prefix}-source-${segment.id}`;
    const casingId = `${prefix}-casing-${segment.id}`;
    const lineId = `${prefix}-line-${segment.id}`;
    const hitId = `${prefix}-hit-${segment.id}`;
    const modeStyle = modeStyles[segment.mode] || { color: palette.route, width: 4.7, dash: null };
    map.addSource(sourceId, {
      type: "geojson",
      data: {
        type: "Feature",
        id: segment.id,
        properties: { segmentId: segment.id },
        geometry: { type: "LineString", coordinates: segmentCoordinates(segment) }
      }
    });
    const firstLabelLayer = (map.getStyle().layers || []).find((layer) => layer.type === "symbol" && layer.layout?.["text-field"]);
    const beforeLabelId = firstLabelLayer?.id;
    map.addLayer({
      id: casingId,
      type: "line",
      source: sourceId,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": palette.casing,
        "line-width": modeStyle.width + (options.selected ? 5.2 : 3.8),
        "line-opacity": options.opacity * (options.selected ? 0.96 : 0.82)
      }
    }, beforeLabelId);
    const baseColor = options.selected ? palette.selected : (options.color || modeStyle.color);
    const baseWidth = modeStyle.width + (options.selected ? 1.4 : 0);
    const paint = {
      "line-color": ["case", ["boolean", ["feature-state", "inspected"], false], "#f0a235", baseColor],
      "line-width": ["case", ["boolean", ["feature-state", "inspected"], false], baseWidth + 3, baseWidth],
      "line-opacity": options.opacity
    };
    if (modeStyle.dash) paint["line-dasharray"] = modeStyle.dash;
    map.addLayer({
      id: lineId,
      type: "line",
      source: sourceId,
      layout: { "line-cap": "round", "line-join": "round" },
      paint
    }, beforeLabelId);
    if (options.interactive) {
      map.addLayer({
        id: hitId,
        type: "line",
        source: sourceId,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#000000", "line-width": Math.max(22, modeStyle.width + 14), "line-opacity": 0.001 }
      }, beforeLabelId);
      decorations.hitLayerIds.push(hitId);
      decorations.layerIds.push(hitId);
    }
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
    return `${String(numbers[0]).padStart(2, "0")} +${numbers.length - 1}`;
  }

  function markerBox(center, label) {
    const width = Math.max(30, 15 + label.length * 6.5);
    return { left: center.x - width / 2, right: center.x + width / 2, top: center.y - 17, bottom: center.y + 17 };
  }

  function boxesOverlap(first, second, gap = 6) {
    return first.left < second.right + gap && first.right > second.left - gap && first.top < second.bottom + gap && first.bottom > second.top - gap;
  }

  function markerOffsetFor(place, label, occupiedBoxes) {
    const point = mainMap.project([place.lng, place.lat]);
    const canvas = mainMap.getCanvas();
    const compact = mainMap.getZoom() < 7;
    const radius = compact ? 34 : 42;
    const candidates = [
      [0, -radius], [radius, -Math.round(radius * 0.7)], [-radius, -Math.round(radius * 0.7)],
      [radius, Math.round(radius * 0.7)], [-radius, Math.round(radius * 0.7)], [0, radius],
      [radius + 12, 0], [-(radius + 12), 0]
    ];
    let best = { offset: candidates[0], score: Number.POSITIVE_INFINITY, box: null };

    candidates.forEach((offset, index) => {
      const center = { x: point.x + offset[0], y: point.y + offset[1] };
      const box = markerBox(center, label);
      let score = index * 0.05;
      if (box.left < 8 || box.top < 8 || box.right > canvas.clientWidth - 8 || box.bottom > canvas.clientHeight - 8) score += 100;
      occupiedBoxes.forEach((occupied) => { if (boxesOverlap(box, occupied)) score += 40; });
      try {
        const labelLayerIds = (mainMap.getStyle().layers || [])
          .filter((layer) => layer.type === "symbol" && layer.layout?.["text-field"] && layer.layout.visibility !== "none")
          .map((layer) => layer.id);
        if (labelLayerIds.length) {
          score += mainMap.queryRenderedFeatures([[box.left, box.top], [box.right, box.bottom]], { layers: labelLayerIds }).length * 12;
        }
      } catch (_error) {
        // The next map move retries after all style layers are available.
      }
      if (score < best.score) best = { offset, score, box };
    });
    occupiedBoxes.push(best.box);
    return { offset: best.offset, compact };
  }

  function applyDayMarkerOffset(entry, placement) {
    const [x, y] = placement.offset;
    const length = Math.hypot(x, y);
    const angle = Math.atan2(-y, -x) * 180 / Math.PI;
    entry.marker.setOffset(placement.offset);
    entry.element.classList.toggle("compact", placement.compact);
    entry.element.style.setProperty("--leader-length", `${Math.max(0, length - 13)}px`);
    entry.element.style.setProperty("--leader-angle", `${angle}deg`);
  }

  function refreshDayMarkerOffsets() {
    if (!mainMapReady || !mainDayMarkers.length) return;
    const occupiedBoxes = [];
    mainDayMarkers.forEach((entry) => applyDayMarkerOffset(entry, markerOffsetFor(entry.place, entry.label, occupiedBoxes)));
  }

  function addDayMarkers() {
    const occupiedBoxes = [];
    groupedDayMarkers()
      .filter((group) => mapScope === "journey" || group.days.some((day) => day.id === activeDayId))
      .forEach((group) => {
      const containsActive = group.days.some((day) => day.id === activeDayId);
      const label = markerLabel(group.days);
      const element = document.createElement("div");
      element.className = "day-marker-anchor";
      const button = document.createElement("button");
      button.type = "button";
      button.className = `day-marker ${containsActive ? "selected" : ""}`;
      button.textContent = label;
      button.title = group.days.map((day) => `Day ${day.number}: ${day.title}`).join("\n");
      button.setAttribute("aria-label", `${group.place.name}: ${group.days.map((day) => `day ${day.number}`).join(", ")}`);
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        const activeIndex = group.days.findIndex((day) => day.id === activeDayId);
        const next = group.days[activeIndex >= 0 ? (activeIndex + 1) % group.days.length : 0];
        setActiveDay(next.id, true);
      });
      element.append(button);
      const placement = markerOffsetFor(group.place, label, occupiedBoxes);
      const marker = new maplibregl.Marker({ element, anchor: "center", offset: placement.offset })
        .setLngLat([group.place.lng, group.place.lat])
        .addTo(mainMap);
      const entry = { marker, element, place: group.place, label };
      applyDayMarkerOffset(entry, placement);
      mainDayMarkers.push(entry);
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

  function drawMainMap(fit, attempt = 0) {
    if (!mainMapReady) return;
    if (!mapIsReady(mainMap)) {
      if (attempt < 24) window.setTimeout(() => drawMainMap(fit, attempt + 1), 500);
      return;
    }
    clearDecorations(mainMap, mainDecorations);
    mainDayMarkers = [];
    const selectedSegments = new Set(activeDay().segmentIds);
    [...journey.segments]
      .sort((a, b) => Number(selectedSegments.has(a.id)) - Number(selectedSegments.has(b.id)))
      .forEach((segment) => {
        const selected = selectedSegments.has(segment.id);
        addSegmentLayer(mainMap, mainDecorations, segment, {
          prefix: "main",
          interactive: true,
          selected,
          color: mapScope === "day" && !selected ? palette.muted : undefined,
          opacity: selected ? 1 : (mapScope === "day" ? 0.32 : 0.78)
        });
      });
    addDayMarkers();
    if (mapScope === "day") addRailStopMarkers(mainMap, mainDecorations, activeDay());
    if (inspectedSegmentId) setInspectedFeatureState(inspectedSegmentId, true);
    renderDayNavigator();
    if (fit) fitJourneyBounds();
  }

  function renderDayNavigator() {
    const navigator = $("#day-navigator");
    const dayIndex = journey.days.findIndex((day) => day.id === activeDayId);
    navigator.hidden = mapScope !== "day";
    navigator.style.top = `${$("#map").offsetTop + 14}px`;
    $("#focused-day-label").textContent = `Day ${dayIndex + 1} of ${journey.days.length}`;
    $("#previous-day").disabled = dayIndex <= 0;
    $("#next-day").disabled = dayIndex >= journey.days.length - 1;
  }

  function moveActiveDay(delta) {
    const currentIndex = journey.days.findIndex((day) => day.id === activeDayId);
    const next = journey.days[currentIndex + delta];
    if (next) setActiveDay(next.id, true);
  }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function mapPadding(extraBottom) {
    const mapElement = $("#map");
    const legend = $("#map-legend");
    const width = Math.max(mapElement.clientWidth, 320);
    const height = Math.max(mapElement.clientHeight, 260);
    const side = Math.max(28, Math.min(62, Math.floor(width * 0.08)));
    const top = Math.max(28, Math.min(56, Math.floor(height * 0.11)));
    const legendRoom = legend ? legend.offsetHeight + 30 : 70;
    const bottom = Math.min(Math.max(legendRoom, extraBottom || 0), Math.floor(height * 0.36));
    return { top, right: side, bottom, left: side };
  }

  function fitJourneyBounds(duration = 650) {
    if (!mainMapReady) return;
    const bounds = boundsFromCoordinates(journeyCoordinates());
    if (bounds) mainMap.fitBounds(bounds, { padding: mapPadding(76), maxZoom: 8, duration });
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
      mainMap.fitBounds(boundsFromCoordinates(coordinates), { padding: mapPadding(112), maxZoom: 12.5, duration: 650 });
    } else if (coordinates.length === 1) {
      mainMap.easeTo({ center: coordinates[0], zoom: 12, duration: 650 });
    }
  }

  function renderJourneyIdentity() {
    $("#journey-name").textContent = journey.label;
    document.title = `${journey.title} · ${isDemoPage ? "Journey samples" : "Journey Atlas"}`;
  }

  function renderOverview() {
    $("#site-badge").textContent = journey.badge || "ATLAS DEMO";
    $("#journey-kicker").textContent = journey.kicker;
    $("#journey-title").textContent = journey.title;
    $("#journey-subtitle").textContent = journey.subtitle;
    $("#day-count").textContent = `${journey.days.length} days`;
    $("#photo-count").textContent = journey.photos.length;
    $("#show-all-photos").disabled = journey.photos.length === 0;
    $("#journey-summary").innerHTML = `
      <div><strong>${escapeHtml(journey.dates)}</strong><span>TRAVEL DATES</span></div>
      <div><strong>${formatDistance(totalDistance())}</strong><span>ROUTE LENGTH</span></div>
      <div><strong>${journey.days.length}</strong><span>DAYS</span></div>
    `;
  }

  function lineSwatch(mode) {
    return `<i class="line-swatch ${escapeHtml(mode)}" aria-hidden="true"></i>`;
  }

  function renderLegend() {
    const modes = [...new Set(journey.segments.map((segment) => segment.mode))];
    $("#map-legend").innerHTML = modes.map((mode) => {
      const cue = modeStyles[mode]?.cue || "route";
      return `<span title="${escapeHtml(`${labels[mode]} · ${cue}`)}" aria-label="${escapeHtml(`${labels[mode]}, ${cue} line`)}">${lineSwatch(mode)}${labels[mode]}</span>`;
    }).join("") + '<span><i class="rail-stop-swatch" aria-hidden="true"></i>Rail stop</span>';
  }

  function renderJourneyPicker() {
    const picker = $("#journey-picker");
    const select = $("#journey-select");
    picker.hidden = !isDemoPage || availableJourneys.length < 2;
    if (picker.hidden) return;
    select.innerHTML = availableJourneys.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === journey.id ? "selected" : ""}>${escapeHtml(item.label)}</option>`).join("");
  }

  function renderDays() {
    dayList.innerHTML = journey.days.map((day) => {
      const modes = modesForDay(day);
      const photos = photosForDay(day.id);
      const pattern = modes[0] || "stay";
      return `
        <button class="day-row ${day.id === activeDayId ? "active" : ""}" data-day-id="${escapeHtml(day.id)}" type="button" ${day.id === activeDayId ? 'aria-current="true"' : ""}>
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
    syncInspectionClasses();
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
          ${photoImageMarkup(leadPhoto, { alt: leadPhoto.alt, sizes: "(max-width: 900px) 100vw, 26vw", eager: true })}
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
            ${photoImageMarkup(photo, { alt: "", sizes: "180px" })}
            <span>${String(index + 1).padStart(2, "0")}</span>
            <small>${escapeHtml(photo.caption)}</small>
          </button>
        `).join("")
      : '<div class="photo-empty">This day is ready for photos whenever you add them.</div>';
    prepareProgressiveImages(storyMedia);
    prepareProgressiveImages(photoStrip);
    syncInspectionClasses();
    if (leadPhoto) preloadAround(leadPhoto.id, 2, 1280);
  }

  function renderAll(options) {
    renderJourneyIdentity();
    renderOverview();
    renderJourneyPicker();
    renderLegend();
    renderDays();
    renderStory();
    drawMainMap(Boolean(options && options.fit));
  }

  function setActiveDay(id, focus) {
    if (!dayById(id)) return;
    if (inspectedSegmentId && !dayById(id).segmentIds.includes(inspectedSegmentId)) clearSegmentInspection(true);
    activeDayId = id;
    renderDays();
    renderStory();
    if (focus) {
      if ($(".map-panel").offsetParent === null) {
        mapScope = "day";
        pendingMapAction = "focus";
        drawMainMap(false);
      } else {
        focusDay(activeDay());
      }
    } else {
      drawMainMap(false);
    }
  }

  function setMobileTab(tab) {
    $(".atlas-shell").dataset.mobileTab = tab;
    document.querySelectorAll(".mobile-nav button").forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
    if (tab === "map" && mainMap) {
      window.setTimeout(() => {
        mainMap.resize();
        if (pendingMapAction === "focus") focusDay(activeDay());
        if (pendingMapAction === "fit") fitJourneyBounds();
        pendingMapAction = null;
      }, 80);
    }
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
    $("#viewer-filmstrip").innerHTML = photos.length
      ? photos.map((photo, index) => `
          <button type="button" data-viewer-index="${index}" class="${index === viewerPhotoIndex ? "active" : ""}" aria-label="Show photo ${index + 1} of ${photos.length}">
            ${photoImageMarkup(photo, { alt: "", sizes: "180px" })}
            <span>${String(index + 1).padStart(2, "0")}</span>
          </button>
        `).join("")
      : '<div class="viewer-empty-strip">No photographs for this day.</div>';
    prepareProgressiveImages($("#viewer-filmstrip"));
    const activeThumb = $("#viewer-filmstrip .active");
    if (activeThumb) activeThumb.scrollIntoView({ block: "nearest", inline: "center" });
  }

  function viewerDay() {
    return dayById(viewerDayId) || activeDay();
  }

  function preloadWithinDay(photos, index, radius = 2, targetWidth = 2560) {
    for (let offset = 1; offset <= radius; offset += 1) {
      preloadPhoto(photos[index - offset], targetWidth);
      preloadPhoto(photos[index + offset], targetWidth);
    }
  }

  function updateViewer() {
    const day = viewerDay();
    const photos = photosForDay(day.id);
    viewerPhotoIndex = Math.max(0, Math.min(photos.length - 1, viewerPhotoIndex));
    const photo = photos[viewerPhotoIndex];
    activeDayId = day.id;
    const modalPhoto = $("#modal-photo");
    const emptyStage = $("#viewer-empty");
    modalPhoto.hidden = !photo;
    emptyStage.hidden = Boolean(photo);
    if (photo) {
      modalPhoto.className = photo.blur ? "progressive-image" : "";
      modalPhoto.srcset = "";
      modalPhoto.src = photo.blur || photoAssetUrl(photo.src);
      modalPhoto.alt = photo.alt;
      modalPhoto.sizes = "(max-width: 900px) 100vw, 75vw";
      if (photo.width) modalPhoto.width = photo.width;
      if (photo.height) modalPhoto.height = photo.height;
      if (photo.srcset?.length) {
        modalPhoto.dataset.src = photoAssetUrl(photo.src);
        modalPhoto.dataset.srcset = photoSrcset(photo);
        modalPhoto.dataset.eager = "true";
        hydrateImage(modalPhoto);
      }
      $("#modal-caption").textContent = `${photo.caption} · ${photo.takenAt || `Day ${day.number}`}`;
      $("#modal-location").textContent = photo.locationLabel ? `⌖ ${photo.locationLabel}` : "";
      $("#modal-description").textContent = photo.description || "";
      preloadWithinDay(photos, viewerPhotoIndex);
    } else {
      modalPhoto.removeAttribute("src");
      modalPhoto.removeAttribute("srcset");
      modalPhoto.alt = "";
      $("#modal-caption").textContent = "";
      $("#modal-location").textContent = "";
      $("#modal-description").textContent = "This day does not have photographs yet.";
    }
    $("#modal-progress").textContent = photo ? `PHOTO ${viewerPhotoIndex + 1} OF ${photos.length}` : "NO PHOTOS";
    $("#modal-day-title").textContent = day.title;
    $("#modal-day-route").textContent = routeLabel(day);
    $("#viewer-day-label").textContent = `Day ${day.number} · ${day.date}`;
    $("#viewer-day-label").setAttribute("aria-label", `Day ${day.number} of ${journey.days.length} · ${day.date}`);
    const dayIndex = journey.days.findIndex((item) => item.id === day.id);
    $("#viewer-previous-day").disabled = dayIndex <= 0;
    $("#viewer-next-day").disabled = dayIndex >= journey.days.length - 1;
    $(".photo-prev").disabled = !photo || viewerPhotoIndex === 0;
    $(".photo-next").disabled = !photo || viewerPhotoIndex === photos.length - 1;
    renderViewerFilmstrip(photos);
    renderDays();
    renderStory();
    drawMainMap(false);
    if (viewerMapReady) syncViewerMap();
  }

  function syncViewerMap(attempt = 0) {
    if (!viewerMapReady) return;
    if (!mapIsReady(viewerMap)) {
      if (attempt < 24) window.setTimeout(() => syncViewerMap(attempt + 1), 500);
      return;
    }
    clearDecorations(viewerMap, viewerDecorations);
    const day = viewerDay();
    const photo = photosForDay(day.id)[viewerPhotoIndex];
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
    if (photo && Number.isFinite(photo.lng) && Number.isFinite(photo.lat)) {
      const element = document.createElement("div");
      element.className = "photo-location-marker";
      element.setAttribute("aria-label", "Current photo location");
      const marker = new maplibregl.Marker({ element, anchor: "center" }).setLngLat([photo.lng, photo.lat]).addTo(viewerMap);
      viewerDecorations.markers.push(marker);
      viewerMap.easeTo({ center: [photo.lng, photo.lat], zoom: Math.max(PHOTO_ZOOM_LIMITS.min, Math.min(PHOTO_ZOOM_LIMITS.max, photo.zoom || 16)), duration: 650 });
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
    const photo = photoById(photoId);
    if (!photo) return;
    viewerDayId = photo.dayId;
    const photos = photosForDay(viewerDayId);
    const index = photos.findIndex((photo) => photo.id === photoId);
    viewerPhotoIndex = index >= 0 ? index : 0;
    if (!photoDialog.open) photoDialog.showModal();
    updateViewer();
    window.requestAnimationFrame(initViewerMap);
  }

  function moveViewer(delta) {
    const photos = photosForDay(viewerDay().id);
    const next = Math.max(0, Math.min(photos.length - 1, viewerPhotoIndex + delta));
    if (next === viewerPhotoIndex) return;
    viewerPhotoIndex = next;
    updateViewer();
  }

  function openDayViewer(dayId = activeDayId) {
    viewerDayId = dayById(dayId)?.id || journey.days[0].id;
    viewerPhotoIndex = 0;
    if (!photoDialog.open) photoDialog.showModal();
    updateViewer();
    window.requestAnimationFrame(initViewerMap);
  }

  function moveViewerDay(delta) {
    const currentIndex = journey.days.findIndex((day) => day.id === viewerDay().id);
    const nextDay = journey.days[currentIndex + delta];
    if (!nextDay) return;
    viewerDayId = nextDay.id;
    viewerPhotoIndex = 0;
    updateViewer();
  }

  $("#journey-select").addEventListener("change", (event) => {
    const nextJourney = availableJourneys.find((item) => item.id === event.target.value);
    if (!nextJourney) return;
    clearSegmentInspection(true);
    journey = nextJourney;
    activeDayId = journey.days[0].id;
    viewerDayId = activeDayId;
    mapScope = "journey";
    renderAll({ fit: false });
    if ($(".map-panel").offsetParent === null) {
      pendingMapAction = "fit";
    } else {
      fitJourneyBounds();
    }
  });

  dayList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-day-id]");
    if (button) setActiveDay(button.dataset.dayId, true);
  });

  detailPanel.addEventListener("mouseover", (event) => {
    const card = event.target.closest("[data-route-segment]");
    if (card && !routeInspectionPinned) inspectSegment(card.dataset.routeSegment);
  });
  detailPanel.addEventListener("mouseout", (event) => {
    const card = event.target.closest("[data-route-segment]");
    if (card && !card.contains(event.relatedTarget)) clearSegmentInspection();
  });
  detailPanel.addEventListener("focusin", (event) => {
    const card = event.target.closest("[data-route-segment]");
    if (!card) return;
    clearSegmentInspection(true);
    inspectSegment(card.dataset.routeSegment);
  });
  detailPanel.addEventListener("focusout", (event) => {
    const card = event.target.closest("[data-route-segment]");
    if (card && !card.contains(event.relatedTarget)) clearSegmentInspection();
  });
  detailPanel.addEventListener("click", (event) => {
    const card = event.target.closest("[data-route-segment]");
    if (card) inspectSegment(card.dataset.routeSegment, true);
  });

  [storyMedia, photoStrip].forEach((container) => container.addEventListener("click", (event) => {
    const button = event.target.closest("[data-open-photo]");
    if (button) openPhoto(button.dataset.openPhoto);
  }));

  $("#fit-route").addEventListener("click", fitRoute);
  $("#focus-day").addEventListener("click", () => focusDay(activeDay()));
  $("#previous-day").addEventListener("click", () => moveActiveDay(-1));
  $("#next-day").addEventListener("click", () => moveActiveDay(1));
  $("#show-all-photos").addEventListener("click", () => {
    openDayViewer(activeDayId);
  });
  $("#open-notes").addEventListener("click", () => $("#notes-dialog").showModal());
  $("#close-route-inspector").addEventListener("click", () => clearSegmentInspection(true));
  $(".photo-close").addEventListener("click", () => photoDialog.close());
  $(".photo-prev").addEventListener("click", () => moveViewer(-1));
  $(".photo-next").addEventListener("click", () => moveViewer(1));
  $("#viewer-previous-day").addEventListener("click", () => moveViewerDay(-1));
  $("#viewer-next-day").addEventListener("click", () => moveViewerDay(1));
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
    if (event.key === "Escape" && !photoDialog.open && inspectedSegmentId) {
      clearSegmentInspection(true);
      return;
    }
    if (!photoDialog.open) return;
    if (event.key === "ArrowLeft" && event.shiftKey) moveViewerDay(-1);
    else if (event.key === "ArrowRight" && event.shiftKey) moveViewerDay(1);
    else if (event.key === "ArrowLeft") moveViewer(-1);
    else if (event.key === "ArrowRight") moveViewer(1);
  });
  document.querySelectorAll(".mobile-nav button").forEach((button) => button.addEventListener("click", () => setMobileTab(button.dataset.tab)));
  window.addEventListener("resize", () => {
    if (mainMap) mainMap.resize();
    if (viewerMap && photoDialog.open) viewerMap.resize();
    renderDayNavigator();
  });

  renderAll({ fit: false });
  initMainMap();
})();
