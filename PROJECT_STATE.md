# Project state

Updated 7 September 2026.

- Repo: <https://github.com/gravelcycles/travels>
- Site: <https://gravelcycles.github.io/travels/>
- Static MapLibre/OpenFreeMap site; GitHub Actions publishes `dist/` from `main`.
- The published site remains static and has no backend, database, or API keys.
  Local scripts generate route and photo assets before publication.
- The real Switzerland–Italy trip has 14 days, 30 ordered segments, and train,
  boat, bus, gondola, bicycle, and walking legs.
- A local import matched 104 trip photos to 11 of the 14 days and generated 356
  metadata-stripped WebP derivatives. They are published in the public
  [`trip-photos-v1` GitHub Release](https://github.com/gravelcycles/travels/releases/tag/trip-photos-v1).
  See `PHOTO_WORKFLOW.md`.

## Current behavior

- `/travels/` shows the one real trip with no journey dropdown.
- `/travels/demo.html` shows only demo journeys with a sample selector.
- Days support multiple modes and close-up map bounds.
- Destination labels use `destinationId`, so Luzern-based day trips are labeled
  by the place visited.
- Train stops are named and shown as points in day close-ups.
- Train and ferry lines follow static OpenStreetMap network geometry; the
  Bellagio–Como bus follows the shoreline road instead of cutting across the
  lake.
- Selected routes are orange and drawn above other routes.
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

## Known issues

- Removing a public photo requires deleting its Release assets and removing it
  from the manifest; replacing a file under the same tag may remain cached, so
  use a new asset filename for edited replacements.
- The 104 photo captions and day-only matches are automatic first passes. None
  of the supplied stills contained GPS coordinates, and days 9, 11, and 14 have
  no family photos.
- Bus, bicycle, walking, and gondola routes other than Bellagio–Como still use
  reviewed shaping points rather than full network geometry.

## Main lesson

Stops and route geometry are different data. Keep named `stops` for meaning and
markers, but add separate detailed GeoJSON-order `geometry` (`[lng, lat]`) for
the drawn line. Current `via` and stop-to-stop lines are only approximations.
