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

Journey sources live in `content/journeys/<journey-id>.json`. The root catalog
and stable trip-detail URLs are generated from each journey's `kind`, `published`,
and `slug`. `dist/assets/journeys.js` is generated; do not edit it by hand.

## Start small, as a local draft

Studio's **+ New trip** needs only a title and start/end dates. It creates every
calendar day (including year crossings and leap days), opens Day copy, and
supports a local preview before places or routes are known. Use `calendarDate`
(`YYYY-MM-DD`) for machine date matching; `date` is only the editable display
label. Set an IANA `timeZone` for photo intake. Never use a fake coordinate for
an unknown destination.

The agent can do the same with `npm run journey:new -- --title "Trip name"
--slug stable-url --start YYYY-MM-DD --end YYYY-MM-DD --timezone Area/City`.
Studio **Trip plan & cover** now handles later title/date/time-zone changes,
named places, day insertion/reordering, and ordered leg creation. Choose whether
a date change keeps content on its calendar date or shifts the full itinerary.
Preview shows added/removed dates before saving; a shortened range cannot
silently discard notes, overrides, photos, or legs. IDs and the page slug remain
stable. Default day date labels follow moves; custom date labels and photo
capture timestamps remain editorial data. Existing reviewed geometry is retained;
new legs start as explicitly provisional endpoint guides and need route review.

The same editor stores `coverPhoto: { photoId, focal: [xPercent, yPercent] }` and
an ordered `replayMoments` list in the journey source. Cover choices apply to the
catalog and opening, with visible-photo/text fallback. Replay moments contain
stable IDs, day IDs, ordered segment IDs, optional photo IDs, captions, durations
in seconds, and optional reviewed camera targets. Hidden photos are omitted;
invalid editorial references fail validation. Only reviewed exact coordinates
support photo-location zooms. Empty moment lists retain automatic Replay for
other journeys. Save the plan after preview; the editor checks the source
revision to avoid overwriting a trip changed in another session.

Source/output structure:

- `content/atlas.json`: default journey and existing catalog order.
- `content/journeys/<id>.json`: reviewed journeys; IDs and page slugs stay stable.
- `content/drafts/<id>.json`: ignored local drafts (`published: false`).
- `content/templates/journey.html`: shared detail-page template.
- `content/route-geometry/<id>.json`: reviewed generated network geometry.
- `content/photo-manifests/<id>.json`: reviewed derivative metadata per journey.
- `build/draft-assets/<id>/`: ignored draft routes, photos, and route sources.
- `build/studio-draft-overrides.json`: ignored draft day/photo/route edits.
- `content/*-overrides.json`: published-journey editorial overrides.

`npm run build` validates IDs, route/day/photo ownership, geometry coordinates,
calendar ranges, and overrides before generating public pages and bundles.
Published photos are keyed by journey ID in `JOURNEY_ATLAS_PHOTOS`; changing the
default journey cannot transfer an album. Builds are deterministic and asset
URLs use content hashes. Pages CI runs `npm test` and `npm run build`.

To publish a reviewed draft, the agent moves its source to `content/journeys/`
and sets `published: true`. Move any `build/draft-assets/<id>/routes.json`,
`photos.json`, and `route-sources.json` into the matching public source folders;
move that journey's overrides from the ignored draft file to the public override
JSON sources. Review photo Release availability, then run the build/tests and
normal publish checks. Merely creating or editing a draft never publishes it.
Drafts are local files, so they need a private backup if they must survive loss
of the workspace.

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

Each journey with generated network routes has a committed manifest at
`content/route-sources/<journey-id>.json`. It maps segment IDs to named network
inputs and records provider, retrieval date, query/filter, bounds, snapping,
gap-welding, simplification, and reviewed-preserve exceptions. Build exactly
one journey with:

```sh
npm run routes:build -- --journey switzerland-italy-family-2026
```

The builder routes through the segment's endpoints and ordered `stops`/`via`
points, updates only IDs named by that journey's manifest, writes journey-specific geometry and builds shared
static output deterministically, and warns about disconnected or near-tied
network components. If an input is unavailable or routing fails, the last
reviewed geometry is retained. `--strict` treats any warning as a failed build
and leaves the output unchanged. Raw network exports remain in ignored
`build/route-inputs/`; commit the manifest, provenance, and reviewed result.

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

When the traveler has a GPX file, prefer it for bicycle/walking geometry. Atlas
Studio's **Traveler GPX track** importer now:

- read tracks and route points in their recorded order;
- convert them to `[lng, lat]` GeoJSON coordinates;
- remove invalid and immediately duplicated points;
- retain endpoints and meaningful turns while simplifying for the browser;
- report distance and any large gaps instead of joining them silently;
- keep the original GPX private unless the user explicitly approves it; and
- write reviewed static geometry plus source/provenance notes.

The loopback service rejects reversed tracks, endpoints that do not align
safely with the selected leg, and gaps above the review threshold. It reports
recorded distance from unsimplified points, simplifies each recorded section in
meters, and requires explicit acceptance before the saved route changes. Only
the reviewed `[lng, lat]` line and non-identifying private-source provenance are
saved; the uploaded filename and original GPX are not persisted.

GPX elevation can be retained for a future elevation profile, but it should not
be mixed into the two-dimensional map coordinate array.

## Editing and regeneration

The local Atlas Studio is the review surface. The agent runs `npm run studio`,
opens `http://127.0.0.1:4173/studio/` for the user, and stops the server after
the editing session. The user should never need to run the command.

Studio writes durable `controlPoints` and the last explicitly accepted
`geometry` to `content/route-overrides.json`; the public site loads the generated
`dist/assets/content-overrides.js`. Moving an anchor does not replace the saved
geometry. **Propose network route** sends the anchors only to the loopback
Studio service, which uses the journey manifest's local mode network. Original,
saved, anchor-guide, and proposed lines stay separate until the editor accepts
the network result or deliberately chooses the manual guide as a fallback.
Missing, distant, disconnected, or ambiguous networks retain the reviewed
geometry. These overrides take precedence over base route geometry and survive
regeneration of `dist/assets/route-geometry.js`.

Studio day-copy edits live in `content/day-overrides.json`. Studio can switch
between journey IDs, while override keys remain stable day, route, and photo IDs.

The local proposal service supports rail, ferry, road, walking, and bicycle
network extracts declared through `modeNetworks`; it does not send precise
anchors to an external routing service. Gondolas remain manual. A route rebuild
must never overwrite user anchors.

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
