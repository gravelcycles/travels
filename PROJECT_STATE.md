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
- Demo journeys remain in `dist/assets/journeys.js` but have no separate page.
- Days support multiple modes and close-up map bounds.
- Destination labels use `destinationId`, so Luzern-based day trips are labeled
  by the place visited.
- Train stops are named and shown as points in day close-ups.
- Selected routes are orange and drawn above other routes.
- Emoji markers are removed.
- Route research and accuracy limits are in `ROUTE_SOURCES.md`.

## Known issues

- Fresh load shows too much of Europe instead of animating into the trip.
- Day selection currently removes other routes; they should remain, greyed out.
- The bottom of some day close-ups is cut off.
- Left and right panels need visible scrollbars when content does not fit.
- Remove the `All modes` filter but keep a clearer static legend.
- Transport line patterns are too similar.
- Route lines can cross map place names.
- Sparse points make some train lines cross water and ferry lines cross land.
- Desired pages: `/travels/` for real trips and `/travels/demo.html` for demos.

## Main lesson

Stops and route geometry are different data. Keep named `stops` for meaning and
markers, but add separate detailed GeoJSON-order `geometry` (`[lng, lat]`) for
the drawn line. Current `via` and stop-to-stop lines are only approximations.
