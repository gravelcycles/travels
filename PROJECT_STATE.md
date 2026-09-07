# Project state

Updated 7 September 2026.

- Repo: <https://github.com/gravelcycles/travels>
- Site: <https://gravelcycles.github.io/travels/>
- Static MapLibre/OpenFreeMap site; GitHub Actions publishes `dist/` from `main`.
- The published site remains static and has no backend, database, or API keys.
  Local scripts generate route and photo assets before publication.
- The real Switzerland–Italy trip has 14 days, 29 ordered segments, and train,
  boat, bus, gondola, bicycle, and walking legs.
- A local import matched 104 trip photos to 11 of the 14 days and generated 356
  metadata-stripped WebP derivatives. They are published in the public
  [`trip-photos-v1` GitHub Release](https://github.com/gravelcycles/travels/releases/tag/trip-photos-v1).
  See `PHOTO_WORKFLOW.md`.

## Current behavior

- `/travels/` shows the one real trip with no journey dropdown.
- `/travels/demo.html` shows only demo journeys with a sample selector.
- Day 1 is the single Zürich Flughafen → Luzern arrival leg, with a 68 km day
  summary and a close-up bounded to that direction of travel.
- Days support multiple modes and close-up map bounds.
- Destination labels use `destinationId`, so Luzern-based day trips are labeled
  by the place visited.
- Train stops are named and shown as points in day close-ups.
- Train and ferry lines follow static OpenStreetMap network geometry; the
  Bellagio–Como bus follows the shoreline road instead of cutting across the
  lake.
- Day 10 follows the timetable-matched SR110 Como–Varenna service and direct
  Dervio–Bellagio run 809. Its five-leg close-up totals 95 km; ferry timing,
  stop, geometry, and limitation details are recorded in `ROUTE_SOURCES.md`.
- Main, photo-viewer, and Studio maps use OpenFreeMap's Liberty vector style
  with stronger water, woodland, park, shaded-relief, and major-road treatment.
  Roads are no longer hidden, while POIs remain suppressed to limit clutter.
  OpenTopoMap was evaluated but not selected because its raster tiles combine
  labels and terrain, preventing the atlas from keeping place labels above its
  route layers. Liberty preserves that layer control, Italy coverage, and the
  existing no-key static deployment.
- Journey routes use a saturated blue with a wide near-white casing; selected
  routes use a brighter orange and a still-wider casing. The slightly softened
  terrain treatment keeps routes visually dominant without losing map detail.
- Selected routes are drawn above other routes.
- Basemap labels are drawn above route lines, preserving city-name context.
- Day focus keeps other routes visible in quiet grey.
- Day close-ups show previous/next arrows and `Day N of 14` inside the map.
- Fresh load draws the routes immediately, then fits the journey over 2.5s.
- Left and right panels have independent, visible scrollbars.
- Transport modes use a static legend with distinct line patterns.
- Emoji markers are removed.
- Route research and accuracy limits are in `ROUTE_SOURCES.md`.
- The photo UI supports embedded blurred previews, responsive `srcset`, lazy
  hydration with a generous look-ahead margin, and preloading of neighboring
  full-screen photos.
- The full-screen photo viewer is day-based: arrows step through photos within
  the selected day, separate arrows move between days, and the main story/map
  follow the viewer day. Days without photos show an intentional empty state.
- Located photos move the side map to their exact coordinate and stored zoom
  while highlighted, and the viewer can show both a short caption and longer
  scene description.
- `npm run studio` starts a loopback-only Atlas Studio for placing photos and
  editing their text, or redrawing a route with draggable control points,
  smoothing, undo, and redo. Saves write JSON sources plus the generated public
  override asset.
- Clicking a photo location—or finishing a pin drag—in Studio now records the
  map's current zoom with the coordinates. The saved 2–20 zoom range is honored
  by the public photo viewer instead of being forced back into 12–18.

## Known issues

- Removing a public photo requires deleting its Release assets and removing it
  from the manifest; replacing a file under the same tag may remain cached, so
  use a new asset filename for edited replacements.
- The 104 photo captions and day-only matches are automatic first passes. None
  of the supplied stills contained GPS coordinates; the new Studio is ready,
  but its photo-location and prose overrides are currently empty. Days 9, 11,
  and 14 have no family photos.
- Bus, bicycle, walking, and gondola routes other than Bellagio–Como still use
  reviewed shaping points rather than full network geometry. Studio smoothing
  is geometric, not transport-network-aware, so enough control points must be
  used to keep a line on the intended road, rail, or water.
- Day dots are DOM markers above the basemap and can still obscure place names,
  even though route line layers are correctly below basemap labels.
- The current root page is one trip. The approved information architecture is
  a real-journey atlas at `/travels/` and this trip at
  `/travels/rushton-switzerland.html`.

## Approved future direction

- Route hover plus tap/focus should explain the day, mode, endpoints, and what
  happened on that part of the journey.
- Increase transport-mode differentiation beyond the current subtle dash
  patterns, while retaining a non-color cue for every mode.
- Add mode-aware route regeneration through preserved Studio control points and
  support GPX import for bicycle days.
- Keep all build, server, Git, and deployment work agent-driven; the user should
  not be asked to run npm commands.
- Build Trip Replay after the underlying route and photo-location data is
  trustworthy.

## Main lesson

Stops and route geometry are different data. Keep named `stops` for meaning and
markers, but add separate detailed GeoJSON-order `geometry` (`[lng, lat]`) for
the drawn line. Current `via` and stop-to-stop lines are only approximations.
