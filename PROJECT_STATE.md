# Project state

Updated 6 September 2026.

- Repo: <https://github.com/gravelcycles/travels>
- Site: <https://gravelcycles.github.io/travels/>
- Static MapLibre/OpenFreeMap site; GitHub Actions publishes `dist/` from `main`.
- No build step, backend, database, or API keys.
- The real Switzerland–Italy trip has 14 days, 30 ordered segments, and train,
  boat, bus, gondola, bicycle, and walking legs.
- Trip photos have not been added yet. See `PHOTO_WORKFLOW.md`.

## Current behavior

- `/travels/` shows the one real trip with no journey dropdown.
- `/travels/demo.html` shows only demo journeys with a sample selector.
- Days support multiple modes and close-up map bounds.
- Destination labels use `destinationId`, so Luzern-based day trips are labeled
  by the place visited.
- Train stops are named and shown as points in day close-ups.
- Selected routes are orange and drawn above other routes.
- Day focus keeps other routes visible in quiet grey.
- Fresh load draws the routes immediately, then fits the journey over 2.5s.
- Left and right panels have independent, visible scrollbars.
- Transport modes use a static legend with distinct line patterns.
- Emoji markers are removed.
- Route research and accuracy limits are in `ROUTE_SOURCES.md`.

## Known issues

- Route lines can cross map place names.
- Sparse points make some train lines cross water and ferry lines cross land.
- Most segments still need reviewed, detailed `geometry`; the viewer now
  supports it and falls back to `via` or `stops` for older data.

## Main lesson

Stops and route geometry are different data. Keep named `stops` for meaning and
markers, but add separate detailed GeoJSON-order `geometry` (`[lng, lat]`) for
the drawn line. Current `via` and stop-to-stop lines are only approximations.
