(function () {
  "use strict";

  const data = window.JOURNEY_ATLAS_DATA;
  const replayUtils = window.JOURNEY_ATLAS_REPLAY;
  const contentOverrides = window.JOURNEY_ATLAS_CONTENT_OVERRIDES || { photos: {}, routes: {}, days: {} };
  data.journeys.forEach((item) => {
    item.days = item.days.map((day) => ({ ...day, ...(contentOverrides.days?.[day.id] || {}) }));
    item.segments.forEach((segment) => {
      const override = contentOverrides.routes?.[segment.id];
      if (override?.geometry?.length > 1) segment.geometry = override.geometry;
    });
    const basePhotos = window.JOURNEY_ATLAS_PHOTOS?.[item.id] || item.photos || [];
    item.photos = basePhotos
      .map((photo) => {
        const override = contentOverrides.photos?.[photo.id] || {};
        return window.JOURNEY_ATLAS_UTILS.resolvePhoto(photo, override);
      })
      .filter((photo) => !photo.hidden);
  });
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
  let replayMap;
  let mainMapReady = false;
  let viewerMapReady = false;
  let replayMapReady = false;
  let mainDecorations = { layerIds: [], sourceIds: [], markers: [], hitLayerIds: [] };
  let mainDayMarkers = [];
  let viewerCameraPhoto = null;
  let viewerTransition = null;
  let viewerDecorations = { layerIds: [], sourceIds: [], markers: [], hitLayerIds: [] };
  let replayDecorations = { layerIds: [], sourceIds: [], markers: [], hitLayerIds: [] };
  let replayTimeline = [];
  let replayJourneyId = null;
  let replayMomentIndex = 0;
  let replayPlaying = false;
  let replayCompleted = false;
  let replayFrame = null;
  let replayLastTimestamp = null;
  let replayElapsed = 0;
  let replayProgress = 0;
  let replaySpeed = 2;
  let replayActiveSourceId = null;
  let replayPositionMarker = null;
  let replayDrawnSegmentId = null;
  let replayLabeledSegmentId = null;
  let replayPhotoReady = true;
  let replayPhotoToken = 0;
  const modeSymbols = {train:"🚆",boat:"⛴",bus:"🚌",gondola:"🚠",walk:"🚶",car:"🚗",bike:"🚲"};
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
  const replayDialog = $("#replay-dialog");
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
    const photos = journey.photos.filter((photo) => photo.dayId === dayId);
    const order = dayById(dayId)?.photoOrder || [];
    const positions = new Map(order.map((id, index) => [id, index]));
    return photos.map((photo, index) => ({ photo, index })).sort((a, b) => {
      const aPosition = positions.has(a.photo.id) ? positions.get(a.photo.id) : order.length + a.index;
      const bPosition = positions.has(b.photo.id) ? positions.get(b.photo.id) : order.length + b.index;
      return aPosition - bPosition || a.index - b.index;
    }).map(({ photo }) => photo);
  }

  function orderedPhotos() {
    return journey.days.flatMap((day) => photosForDay(day.id));
  }

  function photoAssetUrl(url) {
    if (!url) return "";
    const useLocalAssets = new URLSearchParams(window.location.search).get("photoSource") === "local";
    const release = url.match(/^https:\/\/github\.com\/gravelcycles\/travels\/releases\/download\/([a-z0-9-]+)\/([^/]+\.webp)$/);
    if (useLocalAssets && release) return `../build/${release[1]}/${release[2]}`;
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
    return window.JOURNEY_ATLAS_UTILS.travelDuration(segmentsForDay(day));
  }

  function renderRouteLegs(day) {
    const segments = segmentsForDay(day);
    if (!segments.length) return "";
    return `
      <div class="route-legs">
        <ol>
          ${segments.map((segment) => {
            const from = placeById(segment.from);
            const to = placeById(segment.to);
            const stopCount = (segment.stops || []).length + 2;
            return `
              <li>
                <button class="leg-card" type="button" data-route-segment="${escapeHtml(segment.id)}" aria-label="Explore ${escapeHtml(labels[segment.mode] || segment.mode)} route from ${escapeHtml(from.name)} to ${escapeHtml(to.name)}">
                  <span class="leg-mode">${lineSwatch(segment.mode)}${escapeHtml(labels[segment.mode] || segment.mode)}</span>
                  <strong>${escapeHtml(from.name)} → ${escapeHtml(to.name)}</strong>
                  <small>${segment.distanceKm ? formatDistance(segment.distanceKm) : "Distance not added"}${segment.duration ? ` · ${escapeHtml(segment.duration)}` : ""}${segment.stops ? ` · ${stopCount} stops` : ""}${segment.geometryStatus === "provisional" ? " · Provisional route" : ""}</small>
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
    const coordinates = segmentsForDay(day).flatMap(segmentCoordinates)
      .concat(photosForDay(day.id).filter(window.JOURNEY_ATLAS_UTILS.locatedPhoto).map(photo => [photo.lng, photo.lat]));
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
    if (!segments.length) return place ? `${place.name} · ${journey.status === "planned" ? "planned stay" : "stayed here"}` : "Destination to plan";
    const from = placeById(segments[0].from);
    const to = placeById(segments[segments.length - 1].to);
    if (from.id === to.id) return `${place.name} · day trip`;
    return `${from.name} → ${to.name}`;
  }

  function modeLabel(day) {
    const modes = modesForDay(day);
    return modes.length ? modes.map((mode) => labels[mode]).join(" + ") : (journey.status === "planned" ? "To plan" : "In one place");
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
    map.addControl(new maplibregl.AttributionControl({ compact: compact}), "bottom-right");
    return map;
  }

  function initMainMap() {
    if (!window.maplibregl) {
      mapStatus.hidden = false;
      mapStatus.textContent = "The live map could not load. The day journal and photos still work.";
      return;
    }
    try { mainMap = createMap("map", true); }
    catch (_error) { mapStatus.hidden=false; mapStatus.textContent="The map is unavailable. The journal and photographs still work."; return; }
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
        window.requestAnimationFrame(() => {
          if(mapScope === 'day') {
            if($('.map-panel').offsetParent !== null) { focusDay(activeDay()); pendingMapAction=null; }
          } else fitJourneyBounds(prefersReducedMotion() ? 0 : 2500);
        });
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
        geometry: { type: "LineString", coordinates: options.coordinates || segmentCoordinates(segment) }
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
        "line-width": ["case", ["boolean", ["feature-state", "inspected"], false], modeStyle.width + (options.selected ? 8.2 : 6.8), modeStyle.width + (options.selected ? 5.2 : 3.8)],
        "line-opacity": options.opacity * (options.selected ? 0.96 : 0.82)
      }
    }, beforeLabelId);
    const baseColor = options.color || modeStyle.color;
    const baseWidth = modeStyle.width + (options.selected ? 1.4 : 0);
    const paint = {
      "line-color": baseColor,
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
      [radius + 12, 0], [-(radius + 12), 0],
      [radius * 2, 0], [-radius * 2, 0], [0, -radius * 2], [0, radius * 2],
      [radius * 2, -radius], [-radius * 2, -radius]
    ];
    let best = { offset: candidates[0], score: Number.POSITIVE_INFINITY, box: null };

    candidates.forEach((offset, index) => {
      const center = { x: point.x + offset[0], y: point.y + offset[1] };
      const box = markerBox(center, label);
      let score = index * 0.05;
      const legendRoom = Math.max(76, canvas.getBoundingClientRect().bottom - $("#map-legend").getBoundingClientRect().top + 12);
      if (box.left < 8 || box.top < 60 || box.right > canvas.clientWidth - 8 || box.bottom > canvas.clientHeight - legendRoom) score += 100;
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
      .map(group => ({ ...group, days: mapScope === "day" ? group.days.filter(day => day.id === activeDayId) : group.days }))
      .filter(group => group.days.length)
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
    renderLegend();
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
    else mainMap.easeTo({ center: [0, 20], zoom: 1.5, duration: 0 });
  }

  function fitRoute() {
    mapScope = "journey";
    drawMainMap(false);
    fitJourneyBounds();
  }

  function focusDay(day) {
    mapScope = "day";
    renderLegend();
    if (!mainMapReady) { pendingMapAction="focus"; return; }
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
    $("#open-replay").disabled = !replayUtils || journey.days.length === 0;
    $("#focus-day").disabled = !dayCoordinates(activeDay()).length;
    $("#fit-route").disabled = !journeyCoordinates().length;
    $("#journey-summary").innerHTML = `
      <div><strong>${escapeHtml(journey.dates)}</strong><span>TRAVEL DATES</span></div>
      <div><strong>${journey.status === "planned" && !journey.segments.length ? "To plan" : formatDistance(totalDistance())}</strong><span>ROUTE LENGTH</span></div>
      <div><strong>${journey.days.length}</strong><span>DAYS</span></div>
    `;
  }

  function lineSwatch(mode, color, opacity = 1) {
    return `<i class="line-swatch ${escapeHtml(mode)}"${color ? ` style="--swatch:${escapeHtml(color)};opacity:${opacity}"` : ""} aria-hidden="true"></i>`;
  }

  function renderLegend() {
    const focused = mapScope === "day";
    const segments = focused ? segmentsForDay(activeDay()) : journey.segments;
    const modes = [...new Set(segments.map((segment) => segment.mode))];
    const selectedSegments = new Set(activeDay().segmentIds);
    const stateKey = (label, color, opacity = 1) => `<span>${lineSwatch("train", color, opacity)}${escapeHtml(label)}</span>`;
    let markup = focused ? `<strong class="legend-heading">Day ${activeDay().number}${modes.length ? " routes" : " · In one place"}</strong>` : "";
    markup += modes.map((mode) => {
      const cue = modeStyles[mode]?.cue || "route";
      return `<span title="${escapeHtml(`${labels[mode]} · ${cue}`)}" aria-label="${escapeHtml(`${labels[mode]}, ${cue} line`)}">${lineSwatch(mode, modeStyles[mode]?.color)}${labels[mode]}</span>`;
    }).join("");
    if (focused && journey.segments.some((segment) => !selectedSegments.has(segment.id))) markup += stateKey("Other days", palette.muted, 0.32);
    if (focused && modes.includes("train")) markup += '<span><i class="rail-stop-swatch" aria-hidden="true"></i>Rail stop</span>';
    $("#map-legend").innerHTML = markup;
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

  }

  function renderStory() {
    const day = activeDay();
    $("#focus-day").disabled = !dayCoordinates(day).length;
    const photos = photosForDay(day.id);
    const selectedLead = day.leadPhotoId ? photoById(day.leadPhotoId) : null;
    const leadPhoto = selectedLead?.dayId === day.id ? selectedLead : photos[0];
    if (leadPhoto) {
      storyMedia.innerHTML = `
        <button type="button" data-open-photo="${escapeHtml(leadPhoto.id)}" aria-label="Open ${escapeHtml(leadPhoto.caption || leadPhoto.alt || 'photo')} full screen">
          ${photoImageMarkup(leadPhoto, { alt: leadPhoto.alt, sizes: "(max-width: 900px) 100vw, 26vw", eager: true })}
          <span>DAY ${String(day.number).padStart(2, "0")} · ${photos.length} PHOTO${photos.length === 1 ? "" : "S"}</span>
          <small>${escapeHtml(leadPhoto.caption)}</small>
        </button>
      `;
    } else {
      storyMedia.innerHTML = `
        <div class="story-empty" aria-label="A page from the journey">
          <span>DAY ${String(day.number).padStart(2, "0")}</span>
          <strong>${escapeHtml((destinationForDay(day)?.name || "Destination to plan"))}</strong>
          <small>${escapeHtml(day.date)} · A page from the journey</small>
        </div>
      `;
    }

    $('#story-view-photos').hidden = !photos.length;
    $('#story-view-photos').textContent = `View ${photos.length} photo${photos.length === 1 ? '' : 's'}`;

    const distance = dayDistance(day);
    const duration = dayDuration(day);
    const modes = modesForDay(day);
    detailPanel.innerHTML = `
      <div class="detail-eyebrow">DAY ${String(day.number).padStart(2, "0")} · ${escapeHtml(day.date)}</div>
      <h2>${escapeHtml(day.title)}</h2>
      <p class="place-line">${escapeHtml(routeLabel(day))}</p>
      ${day.text?.trim() ? `<p class="day-story">${escapeHtml(day.text)}</p>` : ""}
      <p class="travel-summary">${distance ? `${formatDistance(distance)} · ` : ''}${escapeHtml(modeLabel(day))}${duration ? ` · ${escapeHtml(duration)}` : ''}</p>
      ${day.segmentIds.length ? `<section class="travel-details" aria-label="Travel details"><h3>Travel details · ${day.segmentIds.length} leg${day.segmentIds.length===1?'':'s'}</h3>${renderRouteLegs(day)}</section>` : ''}
      <nav class="journal-day-nav" aria-label="Journal days"><button type="button" data-journal-step="-1" ${day.number===1?'disabled':''}>← Previous day</button><span>Day ${day.number} of ${journey.days.length}</span><button type="button" data-journal-step="1" ${day.number===journey.days.length?'disabled':''}>Next day →</button></nav>
      <button id="resume-replay" type="button" ${replayJourneyId===journey.id?'':'hidden'}>Return to paused Replay</button>
    `;

    photoStrip.innerHTML = photos.length
      ? photos.map((photo, index) => `
          <button type="button" data-open-photo="${escapeHtml(photo.id)}" aria-label="Open ${escapeHtml(photo.caption || photo.alt || 'photo')} full screen">
            ${photoImageMarkup(photo, { alt: "", sizes: "180px" })}
            <span>${String(index + 1).padStart(2, "0")}</span>
            <small>${escapeHtml(photo.caption)}</small>
          </button>
        `).join("")
      : "";
    $(".photo-section").hidden = !photos.length;
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
    mapScope = "day";
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
    document.querySelectorAll(".mobile-nav button").forEach((button) => { button.classList.toggle("active", button.dataset.tab === tab); button.setAttribute("aria-pressed", String(button.dataset.tab === tab)); });
    if (tab === "map" && mainMap) {
      window.setTimeout(() => {
        mainMap.resize();
        renderDayNavigator();
        if (pendingMapAction === "fit") fitJourneyBounds();
        else if (pendingMapAction === "focus" || mapScope === "day") focusDay(activeDay());
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
    viewerTransition = window.JOURNEY_ATLAS_UTILS.photoMapTransition(viewerMap);
    const stopPhotoTransition = event => { if (event.originalEvent) viewerTransition.cancel(); };
    viewerMap.on("movestart", stopPhotoTransition);
    viewerMap.on("zoomstart", stopPhotoTransition);
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
          <button type="button" data-viewer-index="${index}" class="${index === viewerPhotoIndex ? "active" : ""}" aria-pressed="${index === viewerPhotoIndex}" aria-label="Show photo ${index + 1} of ${photos.length}">
            ${photoImageMarkup(photo, { alt: "", sizes: "180px" })}
            <span>${String(index + 1).padStart(2, "0")}</span>
          </button>
        `).join("")
      : "";
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
    const dayChanged = activeDayId !== day.id;
    const photos = photosForDay(day.id);
    viewerPhotoIndex = Math.max(0, Math.min(photos.length - 1, viewerPhotoIndex));
    const photo = photos[viewerPhotoIndex];
    activeDayId = day.id;
    mapScope = "day";
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
      $("#modal-caption").textContent = window.JOURNEY_ATLAS_UTILS.photoCaption(photo, day);
      $("#modal-time").textContent = photo.takenAt || day.date;
      $("#modal-location").textContent = photo.locationLabel ? `⌖ ${photo.locationLabel}` : "";
      $("#modal-description").textContent = photo.description || "";
      preloadWithinDay(photos, viewerPhotoIndex);
    } else {
      modalPhoto.removeAttribute("src");
      modalPhoto.removeAttribute("srcset");
      modalPhoto.alt = "";
      $("#modal-caption").textContent = "";
      $("#modal-location").textContent = "";
      $("#modal-description").textContent = "";
      $("#modal-time").textContent = day.date;
      emptyStage.innerHTML = `<strong>${escapeHtml(day.title)}</strong><span>${escapeHtml(day.text || routeLabel(day))}</span>`;
    }
    $("#modal-progress").textContent = photo ? `PHOTO ${viewerPhotoIndex + 1} OF ${photos.length}` : `DAY ${day.number}`;
    $("#modal-day-title").textContent = day.title;
    $("#modal-day-route").textContent = routeLabel(day);
    $("#viewer-day-label").textContent = `Day ${day.number} · ${day.date}`;
    $("#viewer-day-label").setAttribute("aria-label", `Day ${day.number} of ${journey.days.length} · ${day.date}`);
    const dayIndex = journey.days.findIndex((item) => item.id === day.id);
    $("#viewer-previous-day").disabled = dayIndex <= 0;
    $("#viewer-next-day").disabled = dayIndex >= journey.days.length - 1;
    $(".photo-prev").disabled = !photo || viewerPhotoIndex === 0;
    $(".photo-next").disabled = !photo || viewerPhotoIndex === photos.length - 1;
    const next = photo ? journey.days[dayIndex+1] : journey.days.slice(dayIndex+1).find(d => photosForDay(d.id).length);
    const continuation = $("#album-continue");
    continuation.hidden = Boolean(photo && viewerPhotoIndex < photos.length-1);
    continuation.dataset.day = next?.id || '';
    continuation.innerHTML = next ? `<strong>${photo ? 'Next day' : 'Next day with photos'} <span aria-hidden="true">→</span></strong><small>Day ${next.number} · ${escapeHtml(next.title)}</small>` : '<strong>Back to journey →</strong>';
    continuation.classList.toggle('ready-to-continue', Boolean(photo && next && !continuation.hidden));
    renderViewerFilmstrip(photos);
    renderDays();
    renderStory();
    if (dayChanged) setActiveDay(day.id, true);
    else drawMainMap(false);
    if (viewerMapReady) syncViewerMap();
  }

  function syncViewerMap(attempt = 0) {
    if (!viewerMapReady || !photoDialog.open) return;
    if (!mapIsReady(viewerMap)) {
      if (attempt < 24) window.setTimeout(() => syncViewerMap(attempt + 1), 500);
      return;
    }
    clearDecorations(viewerMap, viewerDecorations);
    const day = viewerDay();
    const photo = photosForDay(day.id)[viewerPhotoIndex];
    const previous = viewerCameraPhoto;
    const photoChanged = previous?.id !== photo?.id;
    if (photoChanged) viewerTransition?.cancel();
    viewerCameraPhoto = photo || null;
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
      if (photoChanged) {
        let previousMarker;
        if (window.JOURNEY_ATLAS_UTILS.locatedPhoto(previous) && !prefersReducedMotion()) {
          const oldPoint = document.createElement("div");
          oldPoint.className = "photo-location-marker photo-location-previous";
          oldPoint.setAttribute("aria-label", "Previous photo location");
          previousMarker = new maplibregl.Marker({ element: oldPoint, anchor: "center" }).setLngLat([previous.lng, previous.lat]).addTo(viewerMap);
          viewerDecorations.markers.push(previousMarker);
        }
        const canvas = viewerMap.getCanvas();
        const padding = Math.max(16, Math.min(40, canvas.clientWidth / 5, canvas.clientHeight / 5));
        viewerTransition.move(previous, photo, { reducedMotion: prefersReducedMotion(), padding, onFinish: () => previousMarker?.remove() });
      }
    } else {
      viewerTransition?.cancel();
      const coordinates = dayCoordinates(day);
      if (coordinates.length > 1) {
        viewerMap.fitBounds(boundsFromCoordinates(coordinates), { padding: 45, maxZoom: 9, duration: prefersReducedMotion() ? 0 : 650 });
      } else if (coordinates.length === 1) {
        viewerMap.easeTo({ center: coordinates[0], zoom: 9, duration: prefersReducedMotion() ? 0 : 650 });
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

  function currentReplayMoment() {
    return replayTimeline[replayMomentIndex];
  }

  function replayMomentDay(moment = currentReplayMoment()) {
    return dayById(moment?.dayId) || journey.days[0];
  }

  function replayLeadPhoto(day, moment) {
    if (moment?.curated) return moment.photoId ? photoById(moment.photoId) : null;
    if (moment?.photoId) return photoById(moment.photoId);
    const photos = photosForDay(day.id);
    const selectedLead = day.leadPhotoId ? photoById(day.leadPhotoId) : null;
    return selectedLead?.dayId === day.id ? selectedLead : photos[0];
  }

  function replaySegment(moment = currentReplayMoment()) {
    return segmentById(replayUtils.routePhase(moment, replayProgress).segmentId) || null;
  }

  function replayMomentProgress(moment) {
    return replayUtils.initialMomentProgress(moment, prefersReducedMotion());
  }

  function replayMapPadding() {
    if (window.matchMedia("(max-width: 900px)").matches) {
      return { top: 24, right: 24, bottom: 34, left: 24 };
    }
    return { top: 70, right: 70, bottom: 145, left: 405 };
  }

  function fitReplayMoment(moment) {
    if (!replayMapReady || !moment) return;
    const day = replayMomentDay(moment);
    const photo = moment.photoId ? photoById(moment.photoId) : null;
    const duration = prefersReducedMotion() ? 0 : 700;
    const segment = replaySegment(moment);
    // Chapters may show a photograph alongside travel. Its pin/zoom must never
    // override the active leg's route framing, including at leg changes.
    if (segment) {
      const coordinates = segmentCoordinates(segment);
      if (coordinates.length > 1) replayMap.fitBounds(boundsFromCoordinates(coordinates), { padding: replayMapPadding(), maxZoom: 13, duration });
      else if (coordinates.length === 1) replayMap.easeTo({ center: coordinates[0], zoom: 10.5, duration });
      return;
    }
    if (moment.camera?.reviewed) { replayMap.easeTo({center:moment.camera.center,zoom:moment.camera.zoom,duration}); return; }
    if (photo && Number.isFinite(photo.lng) && Number.isFinite(photo.lat)) {
      replayMap.easeTo({
        center: [photo.lng, photo.lat],
        zoom: Math.max(PHOTO_ZOOM_LIMITS.min, Math.min(PHOTO_ZOOM_LIMITS.max, photo.zoom || 15)),
        duration
      });
      return;
    }
    const coordinates = dayCoordinates(day);
    if (coordinates.length > 1) {
      replayMap.fitBounds(boundsFromCoordinates(coordinates), { padding: replayMapPadding(), maxZoom: 13, duration });
    } else if (coordinates.length === 1) {
      replayMap.easeTo({ center: coordinates[0], zoom: 10.5, duration });
    } else {
      const bounds = boundsFromCoordinates(journeyCoordinates());
      if (bounds) replayMap.fitBounds(bounds, { padding: replayMapPadding(), maxZoom: 7.5, duration });
    }
  }

  function addReplayMarker(coordinate, className, label, color) {
    if (!coordinate || !replayMapReady) return null;
    const element = document.createElement("div");
    element.className = className;
    element.setAttribute("role", "img");
    element.setAttribute("aria-label", label);
    if (color) element.style.setProperty("--marker-color", color);
    const marker = new maplibregl.Marker({ element, anchor: "center" }).setLngLat(coordinate).addTo(replayMap);
    replayDecorations.markers.push(marker);
    return marker;
  }

  function drawReplayMomentMap(moment, progress, fit = true) {
    if (!replayMapReady || !moment) return;
    clearDecorations(replayMap, replayDecorations);
    replayActiveSourceId = null;
    replayPositionMarker = null;

    journey.segments.forEach((segment) => {
      addSegmentLayer(replayMap, replayDecorations, segment, {
        prefix: "replay-base",
        color: palette.muted,
        opacity: 0.15,
        selected: false
      });
    });

    const completedSegmentIds = new Set(replayTimeline.slice(0, replayMomentIndex)
      .flatMap((item) => item.segmentIds || (item.segmentId ? [item.segmentId] : [])));
    replayUtils.routePhase(moment, progress).completed.forEach(id => completedSegmentIds.add(id));
    journey.segments.filter((segment) => completedSegmentIds.has(segment.id)).forEach((segment) => {
      addSegmentLayer(replayMap, replayDecorations, segment, {
        prefix: "replay-complete",
        opacity: 0.9,
        selected: false
      });
    });

    const segment = replaySegment(moment);
    if (segment) {
      const coordinates = replayUtils.partialLine(segmentCoordinates(segment), replayUtils.routePhase(moment,progress).progress);
      addSegmentLayer(replayMap, replayDecorations, segment, {
        prefix: "replay-active",
        coordinates,
        opacity: 1,
        selected: false
      });
      replayDrawnSegmentId=segment.id;
      replayActiveSourceId = `replay-active-source-${segment.id}`;
      replayPositionMarker = addReplayMarker(
        coordinates[coordinates.length - 1],
        "replay-position-marker",
        `Current ${labels[segment.mode] || segment.mode} position`,
        modeStyles[segment.mode]?.color || palette.route
      );
      if(replayPositionMarker) replayPositionMarker.getElement().textContent=modeSymbols[segment.mode] || "";
    } else if (moment.type === "photo" || moment.photoId) {
      const photo = photoById(moment.photoId);
      if (photo && Number.isFinite(photo.lng) && Number.isFinite(photo.lat)) {
        addReplayMarker([photo.lng, photo.lat], "replay-photo-marker", `Photograph: ${photo.caption}`, palette.selected);
      }
    } else {
      const place = destinationForDay(replayMomentDay(moment));
      if (place) addReplayMarker([place.lng, place.lat], "replay-place-marker", `Day destination: ${place.name}`, palette.selected);
    }
    if (fit) fitReplayMoment(moment);
  }

  function setReplayProgress(progress) {
    replayProgress = replayUtils.clamp(progress);
    const moment = currentReplayMoment();
    const segment = replaySegment(moment);
    if (segment && segment.id !== replayLabeledSegmentId) renderReplayRouteLabel(moment);
    if (replayMapReady && segment && segment.id !== replayDrawnSegmentId) drawReplayMomentMap(moment,replayProgress,true);
    if (!segment || !replayMapReady || !replayActiveSourceId) return;
    const coordinates = replayUtils.partialLine(segmentCoordinates(segment), replayUtils.routePhase(moment,replayProgress).progress);
    const source = replayMap.getSource(replayActiveSourceId);
    if (source) {
      source.setData({
        type: "Feature",
        id: segment.id,
        properties: { segmentId: segment.id },
        geometry: { type: "LineString", coordinates }
      });
    }
    if (replayPositionMarker) replayPositionMarker.setLngLat(coordinates[coordinates.length - 1]);
  }

  function renderReplayPhoto(photo) {
    const frame=$('#replay-photo-frame'), image=$('#replay-photo');
    const token=++replayPhotoToken;
    replayPhotoReady=!photo; frame.hidden=!photo;
    $('#replay-retry-photo').hidden=true;
    $('#replay-photo-status').textContent=photo?'Loading photograph…':'';
    image.onload=null; image.onerror=null;
    if(!photo) {image.removeAttribute('src');image.removeAttribute('srcset');image.alt='';$('#replay-photo-caption').textContent='';return;}
    image.className=''; image.alt=photo.alt || ''; image.sizes='(max-width: 900px) 100vw, 355px';
    image.onload=()=>{ if(token!==replayPhotoToken) return; replayPhotoReady=true; replayLastTimestamp=null; $('#replay-photo-status').textContent=''; };
    image.onerror=()=>{ if(token!==replayPhotoToken) return; replayPhotoReady=false; pauseReplay(); $('#replay-photo-status').textContent='The photograph could not load. Retry or choose the next moment.'; $('#replay-retry-photo').hidden=false; };
    image.srcset=photoSrcset(photo); image.src=preferredPhotoUrl(photo,1280);
    $('#replay-photo-caption').textContent=photo.caption || '';
    const nextPhoto=replayLeadPhoto(replayMomentDay(replayTimeline[replayMomentIndex+1]),replayTimeline[replayMomentIndex+1]);
    if(nextPhoto) preloadPhoto(nextPhoto,1280);
  }

  function updateReplayControls(day) {
    const dayIndex = journey.days.findIndex((item) => item.id === day.id);
    const timeline = $("#replay-timeline");
    timeline.max = Math.max(0, replayTimeline.length - 1);
    timeline.value = replayMomentIndex;
    timeline.setAttribute("aria-valuetext", `Moment ${replayMomentIndex+1} of ${replayTimeline.length}, Day ${day.number}: ${day.title}`);
    $("#replay-day-label").textContent = `${replayMomentIndex+1} / ${replayTimeline.length} · Day ${day.number}`;
    $("#replay-previous-day").disabled = replayMomentIndex <= 0;
    $("#replay-next-day").disabled = replayMomentIndex >= replayTimeline.length - 1;
    $("#replay-toggle").textContent = replayPlaying ? "Pause" : (replayCompleted ? "Replay" : "Play");
    $("#replay-toggle").setAttribute("aria-label", replayPlaying ? "Pause Trip Replay" : "Play Trip Replay");
    $("#replay-status").textContent = replayPlaying
      ? `Playing at ${replaySpeed}×${prefersReducedMotion() ? " with reduced motion" : ""}`
      : `Paused${prefersReducedMotion() ? " · reduced motion" : ""}`;
  }

  function renderReplayMoment({ fit = true } = {}) {
    const moment = currentReplayMoment();
    if (!moment) return;
    const day = replayMomentDay(moment);
    const segment = replaySegment(moment);
    const photo = replayLeadPhoto(day, moment);
    $("#replay-complete").hidden = true;
    $("#replay-eyebrow").textContent = `DAY ${String(day.number).padStart(2, "0")} · ${day.date}`;
    $("#replay-title").textContent = day.title;
    $("#replay-copy").textContent = moment.caption || conciseDayStory(day);
    renderReplayRouteLabel(moment);
    renderReplayPhoto(photo);
    updateReplayControls(day);
    drawReplayMomentMap(moment, replayProgress, fit);
  }

  function renderReplayRouteLabel(moment) {
    const day=replayMomentDay(moment), segment=replaySegment(moment), photo=replayLeadPhoto(day,moment);
    replayLabeledSegmentId=segment?.id || null;
    if (segment) {
      const from = placeById(segment.from);
      const to = placeById(segment.to);
      $("#replay-mode").innerHTML = `${lineSwatch(segment.mode)}${escapeHtml(labels[segment.mode] || segment.mode)} · leg ${day.segmentIds.indexOf(segment.id) + 1} of ${day.segmentIds.length}`;
      $("#replay-route").textContent = `${from.name} → ${to.name}`;
    } else if (moment.type === "photo") {
      $("#replay-mode").textContent = "Photograph";
      $("#replay-route").textContent = photo?.locationLabel || routeLabel(day);
    } else {
      $("#replay-mode").textContent = journey.status === "planned" ? "Planned day" : "A chapter of the journey";
      $("#replay-route").textContent = routeLabel(day);
    }
  }

  function replayMomentDuration(moment) {
    const restDay = replayMomentDay(moment).segmentIds.length === 0;
    const hold = replaySpeed === 2 && restDay ? 1.5 : 1;
    return (moment?.duration || 2.4) * 1000 * hold;
  }

  function pauseReplay() {
    replayPlaying = false;
    replayLastTimestamp = null;
    if (replayFrame !== null) window.cancelAnimationFrame(replayFrame);
    replayFrame = null;
    const day = replayMomentDay();
    if (day) updateReplayControls(day);
  }

  function finishReplay() {
    replayPlaying = false;
    replayCompleted = true;
    replayLastTimestamp = null;
    replayFrame = null;
    replayElapsed = 0;
    setReplayProgress(1);
    updateReplayControls(replayMomentDay());
    $("#replay-status").textContent = "Journey complete";
    $("#replay-complete-title").textContent = journey.title;
    $("#replay-complete").hidden = false;
    $("#replay-again").focus();
  }

  function advanceReplayMoment() {
    if (replayMomentIndex >= replayTimeline.length - 1) {
      finishReplay();
      return false;
    }
    replayMomentIndex += 1;
    replayElapsed = 0;
    replayProgress = replayMomentProgress(currentReplayMoment());
    renderReplayMoment({ fit: replayMomentDay(replayTimeline[replayMomentIndex - 1]).id !== replayMomentDay().id });
    return true;
  }

  function replayTick(timestamp) {
    if (!replayPlaying || !replayDialog.open) return;
    if (replayLastTimestamp === null) replayLastTimestamp = timestamp;
    const elapsed = Math.min(100, timestamp - replayLastTimestamp);
    replayLastTimestamp = timestamp;
    if(replayPhotoReady) replayElapsed += elapsed * replaySpeed;
    const moment = currentReplayMoment();
    const duration = replayMomentDuration(moment);
    if ((moment.type === "segment" || moment.segmentIds?.length) && !prefersReducedMotion()) setReplayProgress(replayElapsed / duration);
    else if (replayProgress < 1) setReplayProgress(1);
    if (replayElapsed >= duration && !advanceReplayMoment()) return;
    replayFrame = window.requestAnimationFrame(replayTick);
  }

  function startReplay() {
    if (!replayTimeline.length) return;
    if (replayCompleted) {
      replayMomentIndex = 0;
      replayCompleted = false;
      replayElapsed = 0;
      replayProgress = replayMomentProgress(currentReplayMoment());
      renderReplayMoment();
    }
    replayPlaying = true;
    replayLastTimestamp = null;
    updateReplayControls(replayMomentDay());
    if (replayFrame !== null) window.cancelAnimationFrame(replayFrame);
    replayFrame = window.requestAnimationFrame(replayTick);
  }

  function toggleReplay() {
    if (replayPlaying) pauseReplay();
    else startReplay();
  }

  function jumpReplayToMoment(index) {
    if(!replayTimeline.length) return;
    pauseReplay(); replayMomentIndex=Math.max(0,Math.min(replayTimeline.length-1,index));
    replayCompleted=false; replayElapsed=0; replayProgress=replayMomentProgress(currentReplayMoment());
    renderReplayMoment();
  }
  function jumpReplayToDay(dayIndex) { jumpReplayToMoment(replayUtils.firstMomentIndexForDay(replayTimeline, journey.days[dayIndex]?.id)); }
  function stepReplayDay(delta) { jumpReplayToMoment(replayMomentIndex+delta); }

  function initReplayMap() {
    if (replayMap || !window.maplibregl) {
      if (replayMap) {
        replayMap.resize();
        if (replayMapReady) drawReplayMomentMap(currentReplayMoment(), replayProgress, true);
      } else {
        $("#replay-map-error").hidden=false;
      }
      return;
    }
    try { replayMap = createMap("replay-map", true); }
    catch(_error) { $('#replay-map-error').hidden=false; return; }
    let setupAttempts = 0;
    const finishReplayMapSetup = () => {
      if (replayMapReady) return;
      try {
        applyBasemapTreatment(replayMap);
        replayMapReady = true;
        $("#replay-map-error").hidden=true;
        window.requestAnimationFrame(() => {
          replayMap.resize();
          drawReplayMomentMap(currentReplayMoment(), replayProgress, true);
        });
      } catch (_error) {
        replayMapReady = false;
        setupAttempts += 1;
        $("#replay-map-error").hidden=false;
      }
    };
    replayMap.on("load", finishReplayMapSetup);
    replayMap.on("style.load", finishReplayMapSetup);
    replayMap.on("error", () => {
      if (!replayMapReady) $("#replay-map-error").hidden=false;
    });
  }

  function openReplay() {
    if (!replayUtils) return;
    if (replayJourneyId !== journey.id) {
      replayJourneyId = journey.id;
      replayTimeline = replayUtils.createTimeline(journey);
      replayMomentIndex = 0;
      replayCompleted = false;
      replayElapsed = 0;
      replayProgress = replayMomentProgress(currentReplayMoment());
    }
    if (!replayDialog.open) replayDialog.showModal();
    renderReplayMoment({ fit: false });
    window.requestAnimationFrame(() => {
      if(!replayDialog.open) return;
      initReplayMap();
      $("#replay-toggle").focus({preventScroll:true});
    });
  }

  function exploreReplayDay() {
    const day = replayMomentDay();
    pauseReplay();
    replayDialog.close();
    setActiveDay(day.id, true);
    if (window.matchMedia("(max-width: 900px)").matches) setMobileTab("story");
  }

  function exploreReplayJourney() {
    pauseReplay();
    replayDialog.close();
    fitRoute();
    if (window.matchMedia("(max-width: 900px)").matches) setMobileTab("map");
  }

  function showJournal(atHeading = false) {
    if (window.matchMedia('(max-width: 900px)').matches) setMobileTab('story');
    if (atHeading) { $('.story-panel').scrollTop=0; detailPanel.querySelector('h2')?.setAttribute('tabindex','-1'); detailPanel.querySelector('h2')?.focus({preventScroll:true}); }
  }
  function openAlbum() {
    $('#album-title').textContent = `All photos · ${journey.photos.length}`;
    $('#album-days').innerHTML = journey.days.map(day=>{
      const photos=photosForDay(day.id); const lead=photos.find(p=>p.id===day.leadPhotoId)||photos[0];
      return `<button class="album-day" data-album-day="${escapeHtml(day.id)}">${lead?photoImageMarkup(lead,{sizes:'280px'}):'<span class="album-text-scene">A page from the journey</span>'}<strong>Day ${day.number} · ${escapeHtml(day.title)}</strong><small>${escapeHtml(day.date)} · ${photos.length?`${photos.length} photo${photos.length===1?'':'s'}`:'Read the story'}</small></button>`;
    }).join('');
    $('#album-dialog').showModal(); prepareProgressiveImages($('#album-days'));
  }
  function renderIntroduction() {
    const intro=$('#trip-intro');
    if(isDemoPage || location.hash || new URLSearchParams(location.search).has('day') || new URLSearchParams(location.search).has('photo')) { intro.hidden=true; return; }
    const {photo,position}=window.JOURNEY_ATLAS_UTILS.resolveCover(journey,journey.photos);
    intro.innerHTML=`<div class="intro-photo" style="--cover-position:${position}">${photo?photoImageMarkup(photo,{eager:true,sizes:'(max-width: 900px) 100vw, 60vw'}):'<div class="intro-text-art">A journey taking shape</div>'}</div><div class="intro-copy"><span>${escapeHtml(journey.dates)} · ${journey.days.length} days</span><h1>${escapeHtml(journey.title)}</h1><p>${escapeHtml(journey.subtitle)}</p><div><button id="intro-relive" type="button">Relive the trip</button><button id="intro-map" type="button">Explore the map</button></div></div>`;
    intro.hidden=false; document.body.classList.add('intro-open'); $('.atlas-shell').inert=true; $('.mobile-nav').inert=true;
    prepareProgressiveImages(intro);
    $('#intro-map').onclick=()=>{dismissIntroduction();setMobileTab('map');fitRoute();};
    $('#intro-relive').onclick=()=>{dismissIntroduction();openReplay();if(!prefersReducedMotion()) startReplay();};
  }
  function dismissIntroduction() { document.body.classList.remove('intro-open'); $('#trip-intro').hidden=true; $('.atlas-shell').inert=false; $('.mobile-nav').inert=false; }
  function handleDeepLink() {
    const params=new URLSearchParams(location.hash.replace(/^#/,'')); const search=new URLSearchParams(location.search);
    const photo=params.get('photo')||search.get('photo'), day=params.get('day')||search.get('day');
    if(photoById(photo)) {if(replayDialog.open)replayDialog.close(); $('#album-dialog').close(); dismissIntroduction();openPhoto(photo);}
    else if(dayById(day)) {if(replayDialog.open)replayDialog.close(); photoDialog.close(); $('#album-dialog').close(); dismissIntroduction();setActiveDay(day,true);showJournal(true);}
  }
  window.addEventListener('hashchange',handleDeepLink);
  $('#close-album').addEventListener('click',()=>$('#album-dialog').close());
  $('#album-days').addEventListener('click', event => {
    const button = event.target.closest('[data-album-day]');
    if (button) { $('#album-dialog').close(); openDayViewer(button.dataset.albumDay); }
  });
  $('#album-continue').addEventListener('click',()=>{const id=$('#album-continue').dataset.day;if(id)openDayViewer(id);else {photoDialog.close();showJournal();}});
  $('#return-to-journal').addEventListener('click',()=>showJournal());

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
    if (button) { setActiveDay(button.dataset.dayId, true); showJournal(true); }
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
    if (card) {
      inspectSegment(card.dataset.routeSegment, true);
      if (window.matchMedia("(max-width: 900px)").matches) {
        setMobileTab("map"); pendingMapAction = null;
        window.setTimeout(() => { if(mainMapReady) { mainMap.resize(); mainMap.fitBounds(boundsFromCoordinates(segmentCoordinates(segmentById(card.dataset.routeSegment))), {padding:mapPadding(100),maxZoom:13,duration:prefersReducedMotion()?0:500}); } },100);
      }
    }
    const step=event.target.closest('[data-journal-step]'); if(step) { moveActiveDay(Number(step.dataset.journalStep)); showJournal(true); }
    if(event.target.closest('#resume-replay')) openReplay();
  });

  [storyMedia, photoStrip].forEach((container) => container.addEventListener("click", (event) => {
    const button = event.target.closest("[data-open-photo]");
    if (button) openPhoto(button.dataset.openPhoto);
  }));

  $("#fit-route").addEventListener("click", fitRoute);
  $("#focus-day").addEventListener("click", () => focusDay(activeDay()));
  $("#open-replay").addEventListener("click", openReplay);
  $("#previous-day").addEventListener("click", () => moveActiveDay(-1));
  $("#next-day").addEventListener("click", () => moveActiveDay(1));
  $("#story-view-photos").addEventListener("click", () => openDayViewer());
  $("#show-all-photos").addEventListener("click", () => {
    openAlbum();
  });
  $("#open-notes").addEventListener("click", () => $("#notes-dialog").showModal());
  $("#close-route-inspector").addEventListener("click", () => clearSegmentInspection(true));
  $(".photo-close").addEventListener("click", () => photoDialog.close());
  photoDialog.addEventListener("close", () => { viewerTransition?.cancel(); viewerCameraPhoto = null; });
  $(".photo-prev").addEventListener("click", () => moveViewer(-1));
  $(".photo-next").addEventListener("click", () => moveViewer(1));
  $("#viewer-previous-day").addEventListener("click", () => moveViewerDay(-1));
  $("#viewer-next-day").addEventListener("click", () => moveViewerDay(1));
  $(".replay-close").addEventListener("click", () => replayDialog.close());
  $("#replay-toggle").addEventListener("click", toggleReplay);
  $("#replay-previous-day").addEventListener("click", () => stepReplayDay(-1));
  $("#replay-next-day").addEventListener("click", () => stepReplayDay(1));
  $("#replay-speed").addEventListener("change", (event) => {
    replaySpeed = Number(event.target.value) || 2;
    updateReplayControls(replayMomentDay());
  });
  $("#replay-timeline").addEventListener("input", (event) => jumpReplayToMoment(Number(event.target.value)));
  $("#replay-explore-day").addEventListener("click", exploreReplayDay);
  $("#replay-again").addEventListener("click", startReplay);
  $("#replay-explore-journey").addEventListener("click", exploreReplayJourney);
  replayDialog.addEventListener("close", ()=>{ pauseReplay(); replayPhotoToken++; const img=$('#replay-photo'); img.onload=null;img.onerror=null; if(replayMap) replayMap.stop(); });
  document.addEventListener('visibilitychange',()=>{if(document.hidden) { pauseReplay(); viewerTransition?.cancel(); }});
  $('#replay-retry-photo').addEventListener('click',()=>renderReplayPhoto(replayLeadPhoto(replayMomentDay(),currentReplayMoment())));
  $('#replay-retry-map').addEventListener('click',()=>{if(replayMap)replayMap.remove();replayMap=null;replayMapReady=false;replayDecorations={layerIds:[],sourceIds:[],markers:[],hitLayerIds:[]};initReplayMap();});
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
    if (replayDialog.open) {
      const tag = event.target.tagName;
      if (event.key === " " && !["BUTTON", "INPUT", "SELECT"].includes(tag)) {
        event.preventDefault();
        toggleReplay();
      } else if (event.key === "ArrowLeft" && !["INPUT", "SELECT"].includes(tag)) {
        event.preventDefault();
        stepReplayDay(-1);
      } else if (event.key === "ArrowRight" && !["INPUT", "SELECT"].includes(tag)) {
        event.preventDefault();
        stepReplayDay(1);
      } else if (event.key === "Home" && !["INPUT", "SELECT"].includes(tag)) {
        event.preventDefault();
        jumpReplayToDay(0);
      } else if (event.key === "End" && !["INPUT", "SELECT"].includes(tag)) {
        event.preventDefault();
        jumpReplayToMoment(replayTimeline.length - 1);
      }
      return;
    }
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
    if (replayMap && replayDialog.open) { replayMap.resize(); fitReplayMoment(currentReplayMoment()); }
    renderDayNavigator();
  });

  renderAll({ fit: false });
  initMainMap();
  setMobileTab('map');
  handleDeepLink();
  renderIntroduction();
})();
