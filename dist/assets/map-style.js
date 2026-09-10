(function (root) {
  "use strict";

  // Liberty's settlement layers are the only basemap labels above journey routes.
  // Keep country/region names, road names and highway shields in the basemap.
  const settlementSizes = {
    label_village: ["interpolate", ["exponential", 1.2], ["zoom"], 7, 10, 11, 11.5],
    label_town: ["interpolate", ["exponential", 1.2], ["zoom"], 7, 11.5, 11, 13],
    label_city: ["interpolate", ["exponential", 1.2], ["zoom"], 4, 11, 7, 12.5, 11, 15],
    label_city_capital: ["interpolate", ["exponential", 1.2], ["zoom"], 4, 11, 7, 12.5, 11, 15]
  };

  function isSettlementLabel(layer) {
    return layer.type === "symbol" && layer["source-layer"] === "place" &&
      Object.hasOwn(settlementSizes, layer.id) && Boolean(layer.layout?.["text-field"]);
  }

  function routeInsertionLayer(map) {
    return (map.getStyle().layers || []).find(isSettlementLabel)?.id;
  }

  function applyBasemapTreatment(map) {
    const layers = map.getStyle().layers || [];
    layers.forEach((layer) => {
      if (/poi/i.test(layer.id || "")) map.setLayoutProperty(layer.id, "visibility", "none");
      if (!isSettlementLabel(layer)) return;
      // Contrast comes from a compact, opaque halo rather than bigger/bolder text.
      map.setLayoutProperty(layer.id, "text-font", ["Noto Sans Regular"]);
      map.setLayoutProperty(layer.id, "text-size", settlementSizes[layer.id]);
      // Lift the baseline slightly clear of station dots near the place anchor.
      map.setLayoutProperty(layer.id, "text-offset", [0, -0.6]);
      map.setPaintProperty(layer.id, "text-color", "#25343a");
      map.setPaintProperty(layer.id, "text-halo-color", "#fffef8");
      map.setPaintProperty(layer.id, "text-halo-width", 2);
      map.setPaintProperty(layer.id, "text-halo-blur", 0.25);
      map.moveLayer(layer.id);
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

  root.JOURNEY_ATLAS_MAP_STYLE = { applyBasemapTreatment, routeInsertionLayer, isSettlementLabel };
})(typeof globalThis === "undefined" ? this : globalThis);
