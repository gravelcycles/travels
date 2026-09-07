# Building a journey atlas

This is the reusable handoff for adding another real trip. The user supplies
the trip facts, photos, corrections, and visual judgment. The agent owns the
terminal, local servers, asset generation, research, implementation, QA,
commits, pushes, and deployment checks. Shell commands below are operational
notes for agents; do not ask the user to run them.

## Inputs to request

Start with the smallest useful intake and fill gaps incrementally:

- trip name and URL slug;
- date range and one row per calendar day;
- each day's ordered legs: mode, from, to, known intermediate stops, and any
  service/route name;
- day title and a few factual notes;
- private photo folder, plus any photos to exclude;
- optional GPX files for bicycle, walking, or other recorded routes; and
- corrections that override inferred schedules or geography.

Never invent a stop, exact timetable, photo coordinate, or route. Record what
is approximate. Exact dates, personal references, and precise photo locations
need a privacy review before broader sharing.

## Stable data model

Use stable, slug-like IDs for journeys, days, places, route segments, and
photos. A day owns an ordered `segmentIds` array; this is the source of truth
for which legs appear and in what order. A segment owns its transport `mode`,
`from`, `to`, distance/duration when known, and optional named `stops`.

Keep these concepts separate:

- `stops`: meaningful, named places displayed to the reader;
- `controlPoints`: human-chosen anchors used to influence a route;
- `geometry`: the detailed rendered line in GeoJSON order, `[lng, lat]`;
- photo `location`: the exact viewpoint, also stored as longitude/latitude;
- day `placeId`: the overnight/base place;
- day `destinationId`: the meaningful destination used in the story label.

The current source data lives in `dist/assets/journeys.js`. Before adding many
real journeys, complete the catalog/detail-page refactor in `TODO.md` so each
trip has a stable page and the root is an atlas of all real trips.

## Route geometry priority

Use the highest-quality available source for every leg:

1. A traveler-supplied GPX recording.
2. A mode-appropriate network route constrained by known stops and user
   control points.
3. Reviewed manual control points.
4. A straight endpoint line only as a clearly temporary fallback.

The rendered result must be checked at close zoom. Trains stay on rails,
ferries stay on navigable water, and roads/trails stay on land. More points are
not automatically more accurate; the important thing is using the correct
network and enough meaningful anchors to disambiguate it.

### Train routes

Research the actual or representative service's ordered stops first and cite
the source in `ROUTE_SOURCES.md`. Obtain an OpenStreetMap rail-network extract
covering the full corridor and all alternatives. The current builder accepts
an Overpass JSON export containing ways and child nodes, builds a connected
rail graph, snaps the endpoints/stops to a common component, finds the shortest
network path through them, and simplifies the result:

```sh
npm run routes:build -- build/route-inputs/rail-overpass.json \
  build/route-inputs/ferry-overpass.json
```

`scripts/build-route-geometry.mjs` currently targets the default journey and
handles `train` and `boat` segments. Generalizing it to a journey ID and
per-journey source manifest is a prerequisite for a scalable multi-trip flow.
Record the Overpass query, bounding box, retrieval date, and any gap welding or
manual disambiguation in `ROUTE_SOURCES.md`. Raw network exports may remain in
ignored `build/route-inputs/`; the query/provenance and resulting static
geometry must be committed.

### Ferry routes

Use OpenStreetMap `route=ferry` ways/relations when they represent the actual
service. Confirm the ordered ports and inspect the full line over the basemap;
an endpoint-only chord can cross land even when both ports are correct. If the
network extract is disconnected or contains the wrong service, add reviewed
water control points and record the exception instead of silently accepting a
bad shortest path.

### Road, walking, and bicycle routes

Use a router with the matching profile: road/transit corridor for buses and
cars, pedestrian for walks, and bicycle for bike days. Record the service,
profile, retrieval date, waypoints, and any manual correction. Do not route a
bus using the generic straight-line fallback.

When the traveler has a GPX file, prefer it for bicycle/walking geometry. A GPX
importer should:

- read tracks and route points in their recorded order;
- convert them to `[lng, lat]` GeoJSON coordinates;
- remove invalid and immediately duplicated points;
- retain endpoints and meaningful turns while simplifying for the browser;
- report distance and any large gaps instead of joining them silently;
- keep the original GPX private unless the user explicitly approves it; and
- write reviewed static geometry plus source/provenance notes.

GPX elevation can be retained for a future elevation profile, but it should not
be mixed into the two-dimensional map coordinate array.

## Editing and regeneration

The local Atlas Studio is the review surface. The agent runs `npm run studio`,
opens `http://127.0.0.1:4173/studio/` for the user, and stops the server after
the editing session. The user should never need to run the command.

Current Studio route edits write both `controlPoints` and the resulting manual
`geometry` to `content/route-overrides.json`; the public site loads the
generated `dist/assets/content-overrides.js`. These overrides take precedence
over base route geometry and therefore survive regeneration of
`dist/assets/route-geometry.js`.

Studio day-copy edits live in `content/day-overrides.json`. Studio can switch
between journey IDs, while override keys remain stable day, route, and photo IDs.

The planned network-aware editor should preserve the same control points as
human intent, then route through them on the selected mode's network. A route
rebuild must never overwrite user anchors. If a point cannot snap safely, keep
the last reviewed geometry and surface the failure for review.

## Photos

Keep original photos and generated binaries out of Git. Follow
`PHOTO_WORKFLOW.md` for metadata-preserving intake, derivative generation,
privacy review, GitHub Release publishing, and Studio annotation. Use a unique
immutable Release tag or asset filename when replacing published media.

## Agent-owned implementation flow

For each new journey, the agent should:

1. Read `PROJECT_STATE.md`, `PRINCIPLES.md`, `AGENT_HANDOFF.md`, this file, and
   `PHOTO_WORKFLOW.md`.
2. Turn the intake into stable places, ordered segments, and calendar days.
3. Research and cite routes; generate or import mode-correct geometry.
4. Launch Atlas Studio for any user review that benefits from the map or photo
   interface, then save the resulting overrides.
5. Build all generated assets and keep source data separate from outputs.
6. Test the atlas index and every affected trip page on desktop and 390 px
   mobile, including day close-ups, labels, route hover/touch behavior, photo
   loading, empty days, and exact photo zoom.
7. Review the Git diff for private originals, sensitive metadata, generated
   binaries, or unintended changes.
8. Commit, push, wait for GitHub Pages, and verify a cache-fresh public URL.
9. Update `PROJECT_STATE.md`, `AGENT_HANDOFF.md`, `TODO.md`, and route/photo
   provenance so the next agent does not need chat history.

## Definition of done for a new trip

- The root atlas links to a stable trip-detail URL.
- Every calendar day exists, including rest days.
- Legs are ordered correctly and use visually distinct mode styling.
- Detailed lines follow the intended physical network at close zoom.
- Day markers and routes do not obscure essential place labels.
- Supplied GPX tracks or manual anchors survive regeneration.
- Photos are responsive, progressively loaded, day-linked, and privacy-reviewed.
- Desktop/mobile and deployed-page checks pass without browser errors.
- All sources, limitations, and remaining review items are in Markdown.
