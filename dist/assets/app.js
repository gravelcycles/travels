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
  const requestedJourneyId = new URLSearchParams(location.search).get("journey") || document.body.dataset.journeyId;
  const isDemoPage = pageScope === "demo";
  const availableJourneys = isDemoPage
    ? data.journeys.filter((item) => item.kind === "demo")
    : data.journeys.filter((item) => item.kind === "real");
  let journey = availableJourneys.find((item) => item.id === requestedJourneyId)
    || availableJourneys.find((item) => item.id === data.defaultJourneyId)
    || availableJourneys[0]
    || data.journeys[0];
  const groupTravel = window.JOURNEY_ATLAS_GROUPS;
  let sourceJourney = journey;
  let activeGroupId = new URLSearchParams(location.search).get('group') || '';
  if (!sourceJourney.routeGroups?.some(group => group.id === activeGroupId)) activeGroupId = '';
  journey = groupTravel.projectJourney(sourceJourney, activeGroupId);
  let activeDayId = journey.days[0].id;
  let mapScope = "journey";
  let mainMap;
  let viewerMap;
  let replayMap;
  let mainMapReady = false;
  let viewerMapReady = false;
  let replayMapReady = false;
  let mainDecorations = { layerIds: [], sourceIds: [], markers: [], hitLayerIds: [] };
  let viewerCameraPhoto = null;
  let viewerRouteKey = null, viewerPhotoMarkers = [];
  let preloadSelection = null, preloadDirection = 1;
  let viewerTransition = null;
  let viewerDecorations = { layerIds: [], sourceIds: [], markers: [], hitLayerIds: [] };
  let replayDecorations = { layerIds: [], sourceIds: [], markers: [], hitLayerIds: [] };
  let replayTimeline = [];
  let replayJourneyId = null;
  let replayMomentIndex = 0;
  let replayPlaying = false;
  let replayCompleted = false;
  let replayFrame = null;
  let replayAutoplayTimer = null;
  let replayLastTimestamp = null;
  let replayElapsed = 0;
  let replayProgress = 0;
  let replaySpeed = 2;
  let replayActiveSourceId = null;
  let replayPositionMarker = null;
  let replayDrawnSegmentId = null;
  let replayLabeledSegmentId = null;
  const modeSymbols = {train:"🚆",boat:"⛴",bus:"🚌",gondola:"🚠",walk:"🚶",car:"🚗",bike:"🚲"};
  let inspectedSegmentId = null;
  let routeInspectionPinned = false;
  let viewerDayId = activeDayId;
  let viewerPhotoIndex = 0;
  let swipeStartX = null;
  let storyMap, storyMapReady = false;
  let storyMapDay = null;
  const storyDecorations = { layerIds: [], sourceIds: [], markers: [], hitLayerIds: [] };
  let hasPlayedOpeningMove = false;
  let pendingMapAction = null;
  const preloadedPhotoUrls = new Set();
  const decodedPhotoUrls = new Set();
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
    if (window.JOURNEY_ATLAS_AUTH?.isProtected(photo)) return window.JOURNEY_ATLAS_AUTH.markup(photo, options);
    const alt = options.alt ?? photo.alt ?? "";
    if (!photo.blur || !photo.srcset?.length) {
      return `<img src="${escapeHtml(photo.src)}" alt="${escapeHtml(alt)}" loading="${options.eager ? "eager" : "lazy"}" decoding="async" />`;
    }
    return `<img class="progressive-image" src="${escapeHtml(photo.blur)}" data-src="${escapeHtml(photoAssetUrl(photo.src))}" data-srcset="${escapeHtml(photoSrcset(photo))}" sizes="${escapeHtml(options.sizes || "100vw")}" alt="${escapeHtml(alt)}" width="${photo.width}" height="${photo.height}" loading="${options.eager ? "eager" : "lazy"}" decoding="async"${options.eager ? ' data-eager="true"' : ""} />`;
  }

  function hydrateImage(image) {
    if (image?.dataset.privateSrc) return window.JOURNEY_ATLAS_AUTH.hydrate(image);
    if (!image?.dataset.src) return;
    const markLoaded = () => {
      if (!image.complete || !image.naturalWidth || image.currentSrc?.startsWith('data:')) return;
      image.removeEventListener('load', markLoaded);
      image.classList.add("is-loaded");
    };
    image.addEventListener("load", markLoaded);
    if (image.dataset.srcset) image.srcset = image.dataset.srcset;
    image.src = image.dataset.src;
    image.removeAttribute("data-src");
    image.removeAttribute("data-srcset");
    if (image.complete) markLoaded();
  }

  function setPublicFullImage(image, photo) {
    window.JOURNEY_ATLAS_AUTH?.clearImage(image);
    const src = new URL(preferredPhotoUrl(photo, Infinity), document.baseURI).href;
    const state = value => { image.dataset.photoState = value; image.dispatchEvent(new Event('atlas-photo-state')); };
    const ready = () => {
      if (image.onload !== loaded || image.src !== src || image.dataset.photoState === 'ready') return;
      decodedPhotoUrls.add(src);
      image.classList.add('is-loaded');
      state('ready');
    };
    const loaded = () => {
      if (image.complete && image.naturalWidth && (!image.currentSrc || image.currentSrc === src)) ready();
    };
    image.onload = loaded;
    image.onerror = () => { if (image.src === src) state('error'); };
    image.dataset.photoReveal = decodedPhotoUrls.has(src) ? 'instant' : 'soft';
    image.srcset = '';
    state('loading');
    image.src = src;
    if (image.complete && image.naturalWidth) loaded();
    else if (image.decode) image.decode().then(ready, loaded);
  }

  function prepareProgressiveImages(container) {
    window.JOURNEY_ATLAS_AUTH?.prepare(container);
    container.querySelectorAll("img.progressive-image:not([data-private-src])").forEach((image) => {
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
    if (window.JOURNEY_ATLAS_AUTH?.isProtected(photo)) return window.JOURNEY_ATLAS_AUTH.preload(photo, targetWidth);
    if (!photo) return;
    const url = preferredPhotoUrl(photo, targetWidth);
    if (!url || preloadedPhotoUrls.has(url)) return;
    preloadedPhotoUrls.add(url);
    const image = new Image();
    image.decoding = "async";
    image.src = url;
  }

  function applyPreloads(requests) {
    window.JOURNEY_ATLAS_AUTH?.setPreloads(requests);
    // Demo photos keep their existing public-image path.
    for (const {photo, width} of requests) if (!window.JOURNEY_ATLAS_AUTH?.isProtected(photo)) preloadPhoto(photo, width);
  }

  function refreshPreloads() {
    if (replayDialog.open) { applyPreloads([]);return; }
    const days = journey.days.map(day => ({id:day.id, photos:photosForDay(day.id)}));
    if (photoDialog.open) {
      const photo = photosForDay(viewerDay().id)[viewerPhotoIndex];
      if (!photo) { applyPreloads([]);return; }
      const all = orderedPhotos(), previous = all.findIndex(item => item.id === preloadSelection), current = all.findIndex(item => item.id === photo.id);
      if (previous >= 0 && previous !== current) preloadDirection = current > previous ? 1 : -1;
      preloadSelection = photo.id;
      applyPreloads([
        ...window.JOURNEY_ATLAS_UTILS.photoPreloadPlan(days, photo.id, preloadDirection),
        ...window.JOURNEY_ATLAS_UTILS.dayPreloadPlan(days, viewerDay().id, preloadDirection)
      ]);
      return;
    }
    const current = photosForDay(activeDayId)[0];
    applyPreloads([...(current ? [{photo:current, width:Infinity}] : []), ...window.JOURNEY_ATLAS_UTILS.dayPreloadPlan(days, activeDayId)]);
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
                  ${journey.routeGroups?.length ? `<span class="leg-audience">${escapeHtml(groupTravel.audience(journey, segment))}</span>` : ""}
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
    if (!activeGroupId && journey.routeGroups?.length > 1 && segments.some(segment => segment.groupIds?.length)) {
      const destinations = [...new Set(segments.map(segment => placeById(segment.to).name))];
      return `${journey.routeGroups.length} group routes · ${destinations.join(' / ')}`;
    }
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

  function routeHoverEnabled() {
    return !window.matchMedia('(max-width: 900px)').matches && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
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

  function createMap(container) {
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
    window.JOURNEY_ATLAS_UTILS.addMapAttribution(map, maplibregl);
    return map;
  }

  function initMainMap() {
    if (!window.maplibregl) {
      mapStatus.hidden = false;
      mapStatus.textContent = "The live map could not load. The day journal and photos still work.";
      return;
    }
    try { mainMap = createMap("map"); }
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
      // Revealing the map beneath a day-list tap can emit compatibility mouse
      // events. Mobile route details require an intentional route tap.
      if (!routeHoverEnabled()) return;
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
    decorations.cancelStopReveal?.();
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
    decorations.routeLayers = [];
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
    (decorations.routeLayers ||= []).push({ segmentId: segment.id, sourceId, lineId });
  }

  function railStopCoordinate(map, stop, coordinates) {
    const point = map.project([stop.lng, stop.lat]);
    let nearest = null, distance = Infinity;
    for (let index = 1; index < coordinates.length; index++) {
      const start = map.project(coordinates[index - 1]), end = map.project(coordinates[index]);
      const dx = end.x - start.x, dy = end.y - start.y;
      const lengthSquared = dx * dx + dy * dy;
      const fraction = lengthSquared ? Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared)) : 0;
      const candidate = [start.x + fraction * dx, start.y + fraction * dy];
      const candidateDistance = (point.x - candidate[0]) ** 2 + (point.y - candidate[1]) ** 2;
      if (candidateDistance < distance) { nearest = candidate; distance = candidateDistance; }
    }
    return nearest ? map.unproject(nearest).toArray() : [stop.lng, stop.lat];
  }

  function dayMapStops(map, day) {
    const segments = segmentsForDay(day);
    const byLocation = new Map();
    const keyFor = coordinate => coordinate.map(value => value.toFixed(7)).join(',');
    segments.filter((segment) => segment.mode === "train").forEach((segment) => {
      const from = placeById(segment.from);
      const to = placeById(segment.to);
      const coordinates = segmentCoordinates(segment);
      const stops = [
        { name: from.name, coordinate: coordinates[0], endpoint: "Start" },
        ...(segment.stops || []).map(stop => ({ ...stop, coordinate: railStopCoordinate(map, stop, coordinates) })),
        { name: to.name, coordinate: coordinates.at(-1), endpoint: "End" }
      ];
      stops.forEach((stop) => {
        const key = keyFor(stop.coordinate), previous = byLocation.get(key);
        // Every train leg gets large endpoints. Shared transfer/return points
        // stay large even if another leg also lists them as an intermediate stop.
        const endpoint = previous?.endpoint && stop.endpoint && previous.endpoint !== stop.endpoint
          ? "Start and end" : previous?.endpoint || stop.endpoint;
        byLocation.set(key, { ...stop, endpoint });
      });
    });
    return [...byLocation.values()];
  }

  function revealStopsWithRoutes(map, decorations, day, elements, isCurrent = () => true) {
    decorations.cancelStopReveal?.();
    if (!elements.length) return;
    const trainIds = new Set(segmentsForDay(day).filter(segment => segment.mode === "train").map(segment => segment.id));
    const routes = (decorations.routeLayers || []).filter(route => trainIds.has(route.segmentId))
      .map(route => ({ ...route, source: map.getSource(route.sourceId) }));
    if (!routes.length) return;
    let cancelled = false;
    const cancel = () => {
      cancelled = true;
      map.off("render", reveal);
      map.off("remove", cancel);
      if (decorations.cancelStopReveal === cancel) decorations.cancelStopReveal = null;
    };
    const reveal = () => {
      if (cancelled) return;
      if (!isCurrent(day)) { cancel(); return; }
      if (!routes.every(route => route.source && map.getSource(route.sourceId) === route.source
        && map.getLayer(route.lineId) && map.isSourceLoaded(route.sourceId))) return;
      // Source readiness alone is too early: wait for a frame containing the
      // train lines. Offscreen routes wait until the camera brings them into view.
      if (!map.queryRenderedFeatures({ layers: routes.map(route => route.lineId) }).length) return;
      elements.forEach(element => { element.style.visibility = ""; });
      cancel();
    };
    decorations.cancelStopReveal = cancel;
    map.on("render", reveal);
    map.on("remove", cancel);
    map.triggerRepaint();
  }

  function addDayStopMarkers(map, decorations, day, isCurrent) {
    const elements = [];
    dayMapStops(map, day).forEach(stop => {
      const element = document.createElement("div");
      element.style.visibility = "hidden";
      element.className = `rail-stop-marker${stop.endpoint ? " route-endpoint-marker" : ""}`;
      const label = `${stop.endpoint || "Rail stop"}: ${stop.name}`;
      element.title = label;
      element.setAttribute("role", "img");
      element.setAttribute("aria-label", label);
      const marker = new maplibregl.Marker({ element, anchor: "center" })
        .setLngLat(stop.coordinate)
        .addTo(map);
      decorations.markers.push(marker);
      elements.push(element);
    });
    revealStopsWithRoutes(map, decorations, day, elements, isCurrent);
  }

  function drawMainMap(fit, attempt = 0) {
    renderLegend();
    if (!mainMapReady) return;
    if (!mapIsReady(mainMap)) {
      if (attempt < 24) window.setTimeout(() => drawMainMap(fit, attempt + 1), 500);
      return;
    }
    clearDecorations(mainMap, mainDecorations);
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
    if (mapScope === "day") addDayStopMarkers(mainMap, mainDecorations, activeDay(), day => mapScope === "day" && activeDayId === day.id);
    if (inspectedSegmentId) setInspectedFeatureState(inspectedSegmentId, true);
    renderDayNavigator();
    if (fit) fitJourneyBounds();
  }

  function renderDayNavigator() {
    const navigator = $("#day-navigator");
    const dayIndex = journey.days.findIndex((day) => day.id === activeDayId);
    window.JOURNEY_ATLAS_MOBILE_UI?.renderDay();
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
    $("#notes-journey-title").textContent = journey.title;
    $("#notes-journey-note").textContent = journey.note || "";
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
      <div><strong>${journey.status === "planned" && !journey.segments.length ? "To plan" : (journey.segments.some(segment => Number.isFinite(segment.distanceKm)) ? formatDistance(totalDistance()) : "Distance pending")}</strong><span>${!activeGroupId && journey.routeGroups?.length > 1 ? "ALL ROUTES COMBINED" : "ROUTE LENGTH"}</span></div>
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
    const firstPhoto = photos[0];
    if (firstPhoto) {
      storyMedia.innerHTML = `
        <button type="button" data-open-photo="${escapeHtml(firstPhoto.id)}" aria-label="Open ${escapeHtml(firstPhoto.caption || firstPhoto.alt || 'photo')} full screen">
          ${photoImageMarkup(firstPhoto, { alt: firstPhoto.alt, sizes: "(max-width: 900px) 100vw, 26vw", eager: true })}
          <span>DAY ${String(day.number).padStart(2, "0")} · ${photos.length} PHOTO${photos.length === 1 ? "" : "S"}</span>
          <small>${escapeHtml(firstPhoto.caption)}</small>
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

    const videos = (journey.videos || []).filter(video => video.dayId === day.id && !video.hidden);
    for (const id of ['story-view-videos', 'mobile-day-videos']) {
      $(`#${id}`).hidden = !videos.length;
      $(`#${id}`).textContent = `Video${videos.length === 1 ? '' : 's'} · ${videos.length}`;
    }
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
      ${groupTravel.videoCards(journey, day.id)}
      <nav class="journal-day-nav" aria-label="Journal days"><button type="button" data-journal-step="-1" ${day.number===1?'disabled':''}>← Previous day</button><span>Day ${day.number} of ${journey.days.length}</span><button type="button" data-journal-step="1" ${day.number===journey.days.length?'disabled':''}>Next day →</button></nav>
      <button id="resume-replay" type="button" ${replayJourneyId===journey.id?'':'hidden'}>Return to paused Replay</button>
    `;

    photoStrip.innerHTML = photos.length
      ? photos.map((photo, index) => `
          <button type="button" data-open-photo="${escapeHtml(photo.id)}" aria-label="Open ${escapeHtml(photo.caption || photo.alt || 'photo')} full screen">
            ${photoImageMarkup(photo, { alt: "", sizes: "180px", targetWidth: 480 })}
            <span>${String(index + 1).padStart(2, "0")}</span>
            <small>${escapeHtml(photo.caption)}</small>
          </button>
        `).join("")
      : "";
    $(".photo-section").hidden = !photos.length;
    prepareProgressiveImages(storyMedia);
    prepareProgressiveImages(photoStrip);
    syncInspectionClasses();
    window.JOURNEY_ATLAS_MOBILE_UI?.renderDay();
    if (!photoDialog.open && !replayDialog.open) refreshPreloads();

  }

  function renderParty() {
    const panel = $('#travel-party'), groups = sourceJourney.routeGroups || [];
    panel.hidden = !sourceJourney.travelers?.length;
    $('#mobile-routes-action').hidden = !groups.length;
    if (panel.hidden) return;
    const selected = groups.find(group => group.id === activeGroupId);
    $('#mobile-routes-action').textContent = `Routes · ${selected?.label || 'Everyone'}`;
    const meetup = sourceJourney.meetup;
    const destination = sourceJourney.places.find(place => place.id === meetup?.placeId);
    const day = sourceJourney.days.find(day => day.id === meetup?.dayId);
    panel.innerHTML = `<h3>${sourceJourney.travelers.length} travelers${groups.length ? ` · ${groups.length} routes` : ''}</h3>
      ${meetup ? `<p class="party-meetup"><strong>Meet in ${escapeHtml(destination.name)}</strong><span>Day ${day.number} · ${escapeHtml(meetup.label)}</span></p>` : ''}
      ${groups.length ? `<button type="button" class="party-all" data-route-group="" aria-pressed="${!activeGroupId}">Everyone · all routes</button>` : ''}
      <div class="party-groups">${groups.map(group => `<button type="button" data-route-group="${escapeHtml(group.id)}" aria-pressed="${activeGroupId === group.id}"><strong>${escapeHtml(group.label)} <span>${group.travelerIds.length}</span></strong><small>${group.travelerIds.map(id => escapeHtml(sourceJourney.travelers.find(person => person.id === id).name)).join(' · ')}</small></button>`).join('')}</div>
      ${groups.length ? `<p class="party-view" role="status">Viewing ${escapeHtml(selected?.label || 'everyone')} · map, journal & Replay</p>` : `<p>${sourceJourney.travelers.map(person => escapeHtml(person.name)).join(' · ')}</p>`}`;
  }

  function selectRouteGroup(id) {
    if (id && !sourceJourney.routeGroups?.some(group => group.id === id)) return;
    clearSegmentInspection(true); pauseReplay(); replayJourneyId = null;
    videoPlayer.stop(); $('#video-dialog').close();
    activeGroupId = id;
    journey = groupTravel.projectJourney(sourceJourney, id);
    storyMapDay = null; viewerRouteKey = null;
    const url = new URL(location.href);
    if (id) url.searchParams.set('group', id); else url.searchParams.delete('group');
    history.replaceState(history.state, '', url);
    renderAll({ fit: false });
    if ($('.map-panel').offsetParent === null) pendingMapAction = mapScope === 'day' ? 'focus' : 'fit';
    else if (mapScope === 'day') focusDay(activeDay()); else fitJourneyBounds();
    const button = Array.from($('#travel-party').querySelectorAll('[data-route-group]')).find(button => button.dataset.routeGroup === id);
    button?.focus({ preventScroll: true });
  }

  function renderAll(options) {
    renderParty();
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
    clearSegmentInspection(true);
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
    window.JOURNEY_ATLAS_MOBILE_UI?.tabChanged();
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

  function renderStoryMap() {
    if (!window.maplibregl || !window.matchMedia('(max-width: 900px)').matches || $('.atlas-shell').dataset.mobileTab !== 'story') return;
    if (!storyMap) {
      storyMap = new maplibregl.Map({container:'story-map-preview',style:OPENFREEMAP_STYLE,center:[9.2,47.4],zoom:4,interactive:false,attributionControl:false});
      window.JOURNEY_ATLAS_UTILS.addMapAttribution(storyMap, maplibregl);
      storyMap.on('load',()=>{storyMapReady=true;renderStoryMap();});
      return;
    }
    if (!storyMapReady) return;
    storyMap.resize();
    const day = activeDay();
    if (storyMapDay !== day.id) {
      clearDecorations(storyMap, storyDecorations);
      day.segmentIds.map(segmentById).filter(Boolean).forEach(segment => addSegmentLayer(storyMap,storyDecorations,segment,{prefix:'story',selected:true,opacity:1}));
      storyMapDay = day.id;
    }
    const coordinates = dayCoordinates(day);
    if (coordinates.length > 1) storyMap.fitBounds(boundsFromCoordinates(coordinates),{padding:{top:40,right:25,bottom:25,left:25},maxZoom:11,duration:0});
    else if (coordinates.length) storyMap.jumpTo({center:coordinates[0],zoom:10});
  }

  function initViewerMap() {
    if (viewerMap || !window.maplibregl) {
      if (viewerMap) {
        viewerMap.resize();
        syncViewerMap();
      }
      return;
    }
    viewerMap = createMap("photo-map");
    viewerTransition = window.JOURNEY_ATLAS_UTILS.photoMapTransition(viewerMap);
    const stopPhotoTransition = event => { if (event.originalEvent) viewerTransition.cancel({ stopMap: false }); };
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
    const strip = $("#viewer-filmstrip");
    const album = JSON.stringify(photos);
    if (strip.dataset.album !== album) {
      strip.dataset.album = album;
      strip.innerHTML = photos.length
      ? photos.map((photo, index) => `
          <button type="button" data-viewer-index="${index}" class="${index === viewerPhotoIndex ? "active" : ""}" aria-pressed="${index === viewerPhotoIndex}" aria-label="Show photo ${index + 1} of ${photos.length}">
            ${photoImageMarkup(photo, { alt: "", sizes: "180px", targetWidth: 480 })}
            <span>${String(index + 1).padStart(2, "0")}</span>
          </button>
        `).join("")
      : "";
      prepareProgressiveImages(strip);
    }
    for (const button of strip.querySelectorAll('[data-viewer-index]')) {
      const selected = Number(button.dataset.viewerIndex) === viewerPhotoIndex;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', String(selected));
    }
    const activeThumb = $("#viewer-filmstrip .active");
    if (activeThumb) activeThumb.scrollIntoView({ block: "nearest", inline: "center" });
  }

  function viewerDay() {
    return dayById(viewerDayId) || activeDay();
  }

  function sizeViewerBackdrop() {
    const frame = $('#viewer-photo-frame'), image = $('#modal-photo');
    const ratio = Number(image.getAttribute('width')) / Number(image.getAttribute('height'));
    const width = Number.isFinite(ratio) && ratio > 0 ? Math.min(frame.clientWidth, frame.clientHeight * ratio) : 0;
    frame.style.setProperty('--photo-backdrop-width', `${width}px`);
    frame.style.setProperty('--photo-backdrop-height', `${width ? width / ratio : 0}px`);
  }

  function updateViewer() {
    const day = viewerDay();
    const dayChanged = activeDayId !== day.id;
    const scopeChanged = mapScope !== "day";
    const photos = photosForDay(day.id);
    viewerPhotoIndex = Math.max(0, Math.min(photos.length - 1, viewerPhotoIndex));
    const photo = photos[viewerPhotoIndex];
    activeDayId = day.id;
    mapScope = "day";
    const modalPhoto = $("#modal-photo");
    const photoStage = modalPhoto.closest('.photo-stage');
    // The embedded blur is decoration only; the foreground still waits for the full photo.
    const backdrop = photo?.blur;
    photoStage.style.setProperty('--photo-backdrop', /^data:image\/(webp|png|jpeg);base64,/.test(backdrop || '') ? `url("${backdrop}")` : 'none');
    photoStage.classList.remove('is-photo-loading');
    const emptyStage = $("#viewer-empty");
    modalPhoto.hidden = !photo;
    emptyStage.hidden = Boolean(photo);
    $('#viewer-photo-feedback').hidden=true;
    if (photo) {
      modalPhoto.onload = null;
      modalPhoto.onerror = null;
      modalPhoto.className = photo.blur ? "progressive-image" : "";
      modalPhoto.srcset = "";
      modalPhoto.alt = photo.alt;
      modalPhoto.sizes = "(max-width: 900px) 100vw, 75vw";
      if (photo.width) modalPhoto.width = photo.width;
      if (photo.height) modalPhoto.height = photo.height;
      sizeViewerBackdrop();
      if (window.JOURNEY_ATLAS_AUTH?.isProtected(photo)) {
        window.JOURNEY_ATLAS_AUTH.setImage(modalPhoto, photo, Infinity, {fullOnly:true});
      } else {
        setPublicFullImage(modalPhoto, photo);
      }
      $("#modal-caption").textContent = window.JOURNEY_ATLAS_UTILS.photoCaption(photo, day);
      $("#modal-time").textContent = photo.takenAt || day.date;
      $("#modal-location").textContent = photo.locationLabel ? `⌖ ${photo.locationLabel}` : "";
      $("#modal-description").textContent = photo.description || "";
    } else {
      window.JOURNEY_ATLAS_AUTH?.clearImage(modalPhoto);
      modalPhoto.onload = null;
      modalPhoto.onerror = null;
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
    renderViewerFilmstrip(photos);
    window.JOURNEY_ATLAS_MOBILE_UI?.update({day, photos, index: viewerPhotoIndex});
    if (dayChanged) setActiveDay(day.id, true);
    else if (scopeChanged) drawMainMap(false);
    if (viewerMapReady) syncViewerMap();
    refreshPreloads();
  }

  function syncViewerMap(attempt = 0) {
    if (!viewerMapReady || !photoDialog.open) return;
    const mobile = window.JOURNEY_ATLAS_MOBILE_UI;
    if (mobile?.enabled() && !mobile.locationVisible()) return;
    if (!mapIsReady(viewerMap)) {
      if (attempt < 24) window.setTimeout(() => syncViewerMap(attempt + 1), 500);
      return;
    }
    const day = viewerDay();
    const photo = photosForDay(day.id)[viewerPhotoIndex];
    const previous = viewerCameraPhoto;
    const photoChanged = previous?.id !== photo?.id;
    if (photoChanged) viewerTransition?.cancel();
    viewerCameraPhoto = photo || null;
    viewerPhotoMarkers.forEach(marker => marker.remove());viewerPhotoMarkers = [];
    const routeKey = `${journey.id}:${day.id}`;
    if (viewerRouteKey !== routeKey) {
      clearDecorations(viewerMap, viewerDecorations);
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
      addDayStopMarkers(viewerMap, viewerDecorations, day, candidate => {
        if (viewerDay().id === candidate.id) return true;
        // A cancelled reveal must be rebuilt even if navigation returns to this
        // cached day before the next route redraw. Closing alone keeps it valid.
        viewerRouteKey = null;
        return false;
      });
      viewerRouteKey = routeKey;
    }
    if (photo && Number.isFinite(photo.lng) && Number.isFinite(photo.lat)) {
      const element = document.createElement("div");
      element.className = "photo-location-marker";
      element.setAttribute("aria-label", "Current photo location");
      const marker = new maplibregl.Marker({ element, anchor: "center" }).setLngLat([photo.lng, photo.lat]).addTo(viewerMap);
      viewerPhotoMarkers.push(marker);
      if (photoChanged) {
        let previousMarker;
        if (window.JOURNEY_ATLAS_UTILS.locatedPhoto(previous) && !prefersReducedMotion()) {
          const oldPoint = document.createElement("div");
          oldPoint.className = "photo-location-marker photo-location-previous";
          oldPoint.setAttribute("aria-label", "Previous photo location");
          previousMarker = new maplibregl.Marker({ element: oldPoint, anchor: "center" }).setLngLat([previous.lng, previous.lat]).addTo(viewerMap);
          viewerPhotoMarkers.push(previousMarker);
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
    window.JOURNEY_ATLAS_MOBILE_UI?.open();
    if (!photoDialog.open) photoDialog.showModal();
    updateViewer();
    if (!window.JOURNEY_ATLAS_MOBILE_UI?.enabled()) window.requestAnimationFrame(initViewerMap);
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
    window.JOURNEY_ATLAS_MOBILE_UI?.open();
    if (!photoDialog.open) photoDialog.showModal();
    updateViewer();
    if (!window.JOURNEY_ATLAS_MOBILE_UI?.enabled()) window.requestAnimationFrame(initViewerMap);
  }

  function openDayPhotos(dayId = activeDayId) {
    if (window.JOURNEY_ATLAS_MOBILE_UI?.enabled()) window.JOURNEY_ATLAS_MOBILE_UI.openGrid(dayId);
    else openDayViewer(dayId);
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
    const duration = prefersReducedMotion() ? 0 : 700;
    const segment = replaySegment(moment);
    // Active travel legs take precedence over a chapter's saved camera.
    if (segment) {
      const coordinates = segmentCoordinates(segment);
      if (coordinates.length > 1) replayMap.fitBounds(boundsFromCoordinates(coordinates), { padding: replayMapPadding(), maxZoom: 13, duration });
      else if (coordinates.length === 1) replayMap.easeTo({ center: coordinates[0], zoom: 10.5, duration });
      return;
    }
    if (moment.camera?.reviewed) { replayMap.easeTo({center:moment.camera.center,zoom:moment.camera.zoom,duration}); return; }
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

  function updateReplayControls(day) {
    const dayIndex = journey.days.findIndex((item) => item.id === day.id);
    const timeline = $("#replay-timeline");
    timeline.max = Math.max(0, replayTimeline.length - 1);
    timeline.value = replayMomentIndex;
    timeline.setAttribute("aria-valuetext", `Moment ${replayMomentIndex+1} of ${replayTimeline.length}, Day ${day.number}: ${day.title}`);
    $("#replay-day-label").textContent = `${replayMomentIndex+1} / ${replayTimeline.length} · Day ${day.number}`;
    $("#replay-previous-day").disabled = replayMomentIndex <= 0;
    $("#replay-next-day").disabled = replayMomentIndex >= replayTimeline.length - 1;
    $("#replay-toggle").textContent = (replayPlaying || replayAutoplayTimer !== null) ? "Pause" : (replayCompleted ? "Replay" : "Play");
    $("#replay-toggle").setAttribute("aria-label", (replayPlaying || replayAutoplayTimer !== null) ? "Pause Trip Replay" : "Play Trip Replay");
    $("#replay-status").textContent = replayPlaying
      ? `Playing at ${replaySpeed}×${prefersReducedMotion() ? " with reduced motion" : ""}`
      : replayAutoplayTimer !== null ? "Starting in 2 seconds…" : `Paused${prefersReducedMotion() ? " · reduced motion" : ""}`;
    window.JOURNEY_ATLAS_MOBILE_UI?.replayControlsChanged({playing:replayPlaying || replayAutoplayTimer !== null,completed:replayCompleted,day});
  }

  function renderReplayMoment({ fit = true } = {}) {
    const moment = currentReplayMoment();
    if (!moment) return;
    const day = replayMomentDay(moment);
    $("#replay-complete").hidden = true;
    $("#replay-eyebrow").textContent = `DAY ${String(day.number).padStart(2, "0")} · ${day.date}`;
    $("#replay-title").textContent = day.title;
    $("#replay-copy").textContent = moment.caption || (activeGroupId ? `${sourceJourney.routeGroups.find(group => group.id === activeGroupId).label} · ${routeLabel(day)}` : conciseDayStory(day));
    renderReplayRouteLabel(moment);
    updateReplayControls(day);
    drawReplayMomentMap(moment, replayProgress, fit);
  }

  function renderReplayRouteLabel(moment) {
    const day=replayMomentDay(moment), segment=replaySegment(moment);
    replayLabeledSegmentId=segment?.id || null;
    if (segment) {
      const from = placeById(segment.from);
      const to = placeById(segment.to);
      $("#replay-mode").innerHTML = `${lineSwatch(segment.mode)}${escapeHtml(labels[segment.mode] || segment.mode)} · leg ${day.segmentIds.indexOf(segment.id) + 1} of ${day.segmentIds.length}`;
      $("#replay-route").textContent = `${from.name} → ${to.name}${journey.routeGroups?.length ? ` · ${groupTravel.audience(journey, segment)}` : ""}`;
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

  function cancelReplayAutoplay() {
    if (replayAutoplayTimer !== null) window.clearTimeout(replayAutoplayTimer);
    replayAutoplayTimer = null;
  }

  function scheduleReplayAutoplay() {
    cancelReplayAutoplay();
    replayAutoplayTimer = window.setTimeout(() => {
      replayAutoplayTimer = null;
      if (replayDialog.open && !document.hidden) startReplay();
    }, 2000);
    updateReplayControls(replayMomentDay());
  }

  function pauseReplay() {
    cancelReplayAutoplay();
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
    replayElapsed += elapsed * replaySpeed;
    const moment = currentReplayMoment();
    const duration = replayMomentDuration(moment);
    if ((moment.type === "segment" || moment.segmentIds?.length) && !prefersReducedMotion()) setReplayProgress(replayElapsed / duration);
    else if (replayProgress < 1) setReplayProgress(1);
    if (replayElapsed >= duration && !advanceReplayMoment()) return;
    replayFrame = window.requestAnimationFrame(replayTick);
  }

  function startReplay() {
    cancelReplayAutoplay();
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
    if (replayPlaying || replayAutoplayTimer !== null) pauseReplay();
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
    try { replayMap = createMap("replay-map"); }
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
    pauseReplay();
    if (replayJourneyId !== journey.id) {
      replayJourneyId = journey.id;
      replayTimeline = replayUtils.createTimeline(journey);
      replayMomentIndex = 0;
      replayCompleted = false;
      replayElapsed = 0;
      replayProgress = replayMomentProgress(currentReplayMoment());
    }
    if (!replayDialog.open) replayDialog.showModal();
    refreshPreloads();
    renderReplayMoment({ fit: false });
    scheduleReplayAutoplay();
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
      const photos=photosForDay(day.id); const first=photos[0];
      return `<button class="album-day" data-album-day="${escapeHtml(day.id)}">${first?photoImageMarkup(first,{sizes:'280px',targetWidth:480}):'<span class="album-text-scene">A page from the journey</span>'}<strong>Day ${day.number} · ${escapeHtml(day.title)}</strong><small>${escapeHtml(day.date)} · ${photos.length?`${photos.length} photo${photos.length===1?'':'s'}`:'Read the story'}</small></button>`;
    }).join('');
    $('#album-dialog').showModal(); prepareProgressiveImages($('#album-days'));
  }
  function renderIntroduction() {
    const intro=$('#trip-intro');
    if(location.hash || new URLSearchParams(location.search).has('day') || new URLSearchParams(location.search).has('photo')) { intro.hidden=true; return; }
    const {photo,position}=window.JOURNEY_ATLAS_UTILS.resolveCover(journey,journey.photos);
    intro.innerHTML=`<div class="intro-photo" style="--cover-position:${position}">${photo?photoImageMarkup(photo,{eager:true,sizes:'(max-width: 900px) 100vw, 60vw'}):'<div class="intro-text-art">A journey taking shape</div>'}</div><div class="intro-copy"><span>${escapeHtml(journey.dates)} · ${journey.days.length} days</span><h1>${escapeHtml(journey.title)}</h1><p>${escapeHtml(journey.subtitle)}</p><div><button id="intro-relive" type="button">Relive the trip</button><button id="intro-map" type="button">Explore the map</button></div></div>`;
    intro.hidden=false; document.body.classList.add('intro-open'); $('.atlas-shell').inert=true; $('.mobile-nav').inert=true;
    prepareProgressiveImages(intro);
    $('#intro-map').onclick=()=>{dismissIntroduction();setMobileTab('map');fitRoute();};
    $('#intro-relive').onclick=()=>{dismissIntroduction();openReplay();};
  }
  function dismissIntroduction() { document.body.classList.remove('intro-open'); $('#trip-intro').hidden=true; $('.atlas-shell').inert=false; $('.mobile-nav').inert=false; }
  function handleDeepLink() {
    const params=new URLSearchParams(location.hash.replace(/^#/,'')); const search=new URLSearchParams(location.search);
    const photo=params.get('photo')||search.get('photo'), day=params.get('day')||search.get('day');
    if(photoById(photo)) {if(replayDialog.open)replayDialog.close(); $('#album-dialog').close(); dismissIntroduction();openPhoto(photo);}
    else if(dayById(day)) {if(replayDialog.open)replayDialog.close(); photoDialog.close(); $('#album-dialog').close(); dismissIntroduction();setActiveDay(day,true);if(window.JOURNEY_ATLAS_MOBILE_UI?.enabled())setMobileTab('map');else showJournal(true);}
  }
  window.addEventListener('hashchange',handleDeepLink);
  window.addEventListener('atlas-photos-unlocked',refreshPreloads);
  window.addEventListener('atlas-photos-renewing',()=>{
    const photo=photoDialog.open?photosForDay(viewerDay().id)[viewerPhotoIndex]:null;
    const params=new URLSearchParams(photo?{photo:photo.id}:{day:activeDayId});
    history.replaceState(history.state,'',location.pathname+location.search+'#'+params);
  });
  $('#close-album').addEventListener('click',()=>$('#album-dialog').close());
  $('#album-days').addEventListener('click', event => {
    const button = event.target.closest('[data-album-day]');
    if (button) { window.JOURNEY_ATLAS_MOBILE_UI?.fromAlbum(); $('#album-dialog').close(); openDayPhotos(button.dataset.albumDay); }
  });
  $('#album-continue').addEventListener('click',()=>{const id=$('#album-continue').dataset.day;if(id)openDayViewer(id);else {photoDialog.close();showJournal();}});
  $('#return-to-journal').addEventListener('click',()=>showJournal());

  const videoPlayer = groupTravel.createVideoPlayer({ dialog: $('#video-dialog'), video: $('#journey-video'), title: $('#video-title'), caption: $('#video-caption'), status: $('#video-status'), retry: $('#retry-video'), close: $('#close-video'), sourceLink: $('#video-credit') });
  document.addEventListener('click', event => {
    const group = event.target.closest('[data-route-group]');
    if (group) selectRouteGroup(group.dataset.routeGroup);
    const button = event.target.closest('[data-open-video]');
    if (button) {
      const item = journey.videos?.find(video => video.id === button.dataset.openVideo && !video.hidden);
      if (item) { pauseReplay(); videoPlayer.open(item); }
    }
  });
  $('#mobile-routes-action').addEventListener('click', () => { setMobileTab('route'); $('#travel-party button')?.focus(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) $('#journey-video').pause(); });

  for (const id of ['story-view-videos', 'mobile-day-videos']) $(`#${id}`).addEventListener('click', () => {
    showJournal();
    const section = detailPanel.querySelector('.day-videos');
    section?.scrollIntoView({ block: 'start' });
    section?.querySelector('button')?.focus({ preventScroll: true });
  });

  $("#journey-select").addEventListener("change", (event) => {
    const nextJourney = availableJourneys.find((item) => item.id === event.target.value);
    if (!nextJourney) return;
    clearSegmentInspection(true);
    pauseReplay(); replayJourneyId = null; storyMapDay = null; viewerRouteKey = null;
    videoPlayer.stop(); $('#video-dialog').close();
    sourceJourney = nextJourney; activeGroupId = '';
    journey = nextJourney;
    const url = new URL(location.href);
    url.searchParams.set('journey', journey.id); url.searchParams.delete('group');
    url.searchParams.delete('day'); url.searchParams.delete('photo'); url.hash = '';
    history.replaceState(history.state, '', url);
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
    if (button) { setActiveDay(button.dataset.dayId, true); if(window.JOURNEY_ATLAS_MOBILE_UI?.enabled())window.JOURNEY_ATLAS_MOBILE_UI.selectedDay();else showJournal(true); }
  });

  detailPanel.addEventListener("mouseover", (event) => {
    if (!routeHoverEnabled()) return;
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
  $("#story-view-photos").addEventListener("click", () => openDayPhotos());
  $("#show-all-photos").addEventListener("click", () => {
    openAlbum();
  });
  $("#open-notes").addEventListener("click", () => $("#notes-dialog").showModal());
  $("#close-route-inspector").addEventListener("click", () => clearSegmentInspection(true));
  const viewerImage = $('#modal-photo');
  new ResizeObserver(sizeViewerBackdrop).observe($('#viewer-photo-frame'));
  viewerImage.addEventListener('atlas-photo-state', () => {
    const state=viewerImage.dataset.photoState, feedback=$('#viewer-photo-feedback');
    viewerImage.closest('.photo-stage').classList.toggle('is-photo-loading', state === 'loading');
    feedback.hidden=!['error','locked'].includes(state);
    $('#viewer-photo-message').textContent=state==='error'?'This photo could not load. Try again.':state==='locked'?'Unlock photos to see this photograph.':'';
    $('#viewer-photo-retry').hidden=state==='loading';
    $('#viewer-photo-retry').textContent=state==='locked'?'Unlock photos':'Retry photo';
  });
  $('#viewer-photo-retry').addEventListener('click', () => {
    if(!window.JOURNEY_ATLAS_AUTH?.unlocked)window.JOURNEY_ATLAS_AUTH?.showPrompt();
    else {const photo=photosForDay(viewerDay().id)[viewerPhotoIndex];if(photo)window.JOURNEY_ATLAS_AUTH.setImage(viewerImage,photo,Infinity,{fullOnly:true});}
  });
  $(".photo-close").addEventListener("click", () => photoDialog.close());
  photoDialog.addEventListener("close", () => {
    window.JOURNEY_ATLAS_MOBILE_UI?.closed();
    viewerTransition?.cancel();viewerCameraPhoto = null;preloadSelection = null;preloadDirection = 1;
    window.JOURNEY_ATLAS_AUTH?.clearImage(viewerImage);viewerImage.removeAttribute('src');
    refreshPreloads();
  });
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
  replayDialog.addEventListener("close", ()=>{ pauseReplay(); if(replayMap) replayMap.stop();refreshPreloads(); });
  document.addEventListener('visibilitychange',()=>{if(document.hidden) { pauseReplay(); viewerTransition?.cancel(); }});
  $('#replay-retry-map').addEventListener('click',()=>{if(replayMap)replayMap.remove();replayMap=null;replayMapReady=false;replayDecorations={layerIds:[],sourceIds:[],markers:[],hitLayerIds:[]};initReplayMap();});
  $("#viewer-filmstrip").addEventListener("click", (event) => {
    const button = event.target.closest("[data-viewer-index]");
    if (!button) return;
    viewerPhotoIndex = Number(button.dataset.viewerIndex);
    updateViewer();
    window.JOURNEY_ATLAS_MOBILE_UI?.gridSelected();
  });
  photoDialog.addEventListener("click", (event) => {
    if (event.target === photoDialog) photoDialog.close();
  });
  $(".photo-stage").addEventListener("pointerdown", (event) => { if (!window.JOURNEY_ATLAS_MOBILE_UI?.enabled()) swipeStartX = event.clientX; });
  $(".photo-stage").addEventListener("pointerup", (event) => {
    if (swipeStartX === null) return;
    const distance = event.clientX - swipeStartX;
    if (Math.abs(distance) > 60) moveViewer(distance < 0 ? 1 : -1);
    swipeStartX = null;
  });
  document.addEventListener("keydown", (event) => {
    if ($("#video-dialog").open) return;
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
    if (!photoDialog.open || window.JOURNEY_ATLAS_MOBILE_UI?.keyTarget(event) || ['INPUT','SELECT','TEXTAREA'].includes(event.target.tagName)) return;
    if (event.key === "ArrowLeft" && event.shiftKey) moveViewerDay(-1);
    else if (event.key === "ArrowRight" && event.shiftKey) moveViewerDay(1);
    else if (event.key === "ArrowLeft") moveViewer(-1);
    else if (event.key === "ArrowRight") moveViewer(1);
  });
  window.JOURNEY_ATLAS_MOBILE_UI = window.JOURNEY_ATLAS_MOBILE.create({
    day:activeDay, days:()=>journey.days, scope:()=>mapScope, title:()=>journey.title,
    dayInfo:day=>({route:routeLabel(day),meta:[dayDistance(day)?formatDistance(dayDistance(day)):'',modeLabel(day),dayDuration(day)].filter(Boolean).join(' · '),count:photosForDay(day.id).length}),
    selectDay:id=>setActiveDay(id,true), stepDay:moveActiveDay, tab:setMobileTab, preview:renderStoryMap,
    openDay:openDayViewer, move:moveViewer, selectPhoto:index=>{viewerPhotoIndex=index;updateViewer();},
    overview:fitRoute, album:openAlbum, replay:openReplay,
    location:()=>{viewerCameraPhoto=null;initViewerMap();},
    pauseLocation:()=>viewerTransition?.cancel(),
    replayMap:()=>{if(replayMapReady && replayDialog.open){replayMap.resize();drawReplayMomentMap(currentReplayMoment(),replayProgress,true);}},
    clearImage:node=>window.JOURNEY_ATLAS_AUTH?.clearImage(node),
    loadImage:(node,photo)=>{if(window.JOURNEY_ATLAS_AUTH?.isProtected(photo))window.JOURNEY_ATLAS_AUTH.setImage(node,photo,Infinity,{fullOnly:true});else setPublicFullImage(node,photo);}
  });
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
  document.documentElement.classList.remove('journey-starting');
})();
