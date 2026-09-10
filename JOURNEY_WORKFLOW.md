# Building a journey atlas

Start with [the framework contract](docs/FRAMEWORK.md) and
[feature inventory](docs/FEATURES.md). Use [the new-trip prompt](docs/AGENT_PROMPTS.md)
for a fresh agent. Create a data instance with Studio or `journey:new`; never
copy Switzerland–Italy's page, itinerary, scripts, or photo manifests. The same
template, runtime, and Studio provide every trip's available features.

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
stable IDs, day IDs, ordered segment IDs, captions, durations in seconds, and
optional reviewed camera targets. Replay is map-only: existing optional photo
IDs remain compatible with saved sources but are ignored by the player. Travel
scenes enforce a distance-based minimum per leg, including a brief
camera-settling pause; longer editorial durations slow the travel proportionally.
Changing geometry point density does not change the pacing. The family journey
uses 2.4-second rest-day scenes and approximately 50 seconds for the nine-leg
Mürren day. Replay frames each active leg and preserves reduced-motion controls.
Invalid editorial references fail validation. Reviewed camera targets can frame
rest-day locations. Empty moment lists retain automatic route/day Replay for
other journeys. Save the plan after preview; the editor checks the source
revision to avoid overwriting a trip changed in another session.

Source/output structure:

- `content/atlas.json`: default journey and existing catalog order.
- `content/journeys/<id>.json`: reviewed journeys; IDs and page slugs stay stable.
- `content/drafts/<id>.json`: ignored local drafts (`published: false`).
- `content/templates/journey.html`: shared detail-page template.
- `content/templates/catalog.html`: catalog template. Both the catalog and
  demo HTML are generated; no public HTML is an alternate journey template.
- `content/route-geometry/<id>.json`: reviewed generated network geometry.
- `content/photo-manifests/<id>.json`: reviewed derivative metadata per journey.
- `build/draft-assets/<id>/`: ignored draft routes, photos, and route sources.
- `build/studio-draft-overrides.json`: ignored draft day/photo/route edits.
- `content/*-overrides.json`: published-journey editorial overrides.

`npm run build` validates IDs, route/day/photo ownership, geometry coordinates,
calendar ranges, and overrides before generating public pages and bundles.
Published photos are keyed by journey ID in `JOURNEY_ATLAS_PHOTOS`; changing the
default journey cannot transfer an album. Builds are deterministic and asset
URLs use content hashes. Pages CI runs `npm test` and `npm run build`, then
rejects uncommitted changes to generated `dist/` output.

To publish a reviewed draft, the agent first inventories its source, assets,
overrides and outstanding route/photo review. Promotion is currently an
agent-operated source migration, not a Studio Publish button:

| Local source | Reviewed source destination |
| --- | --- |
| `content/drafts/<id>.json` | `content/journeys/<id>.json`, retaining IDs/slug and setting `published: true` |
| `build/draft-assets/<id>/routes.json` | `content/route-geometry/<id>.json` |
| `build/draft-assets/<id>/route-sources.json` | `content/route-sources/<id>.json` |
| `build/draft-assets/<id>/photos.json` | `content/photo-manifests/<id>.json` |
| `build/draft-assets/<id>/uploads.json` | `content/photo-manifests/<id>-uploads.json` |
| This trip's entries in `build/studio-draft-overrides.json` | Merge into the corresponding `content/day-overrides.json`, `photo-overrides.json`, `route-overrides.json` |

Only move files that exist; preserve other trips' overrides and drafts. Keep a
local backup, remove the promoted draft source so there is only one record for
its ID, and add its ID to `content/atlas.json` if an explicit catalog position
is wanted. Do not change the default trip just to publish another journey.

Run the private photo publisher from [PHOTO_WORKFLOW.md](PHOTO_WORKFLOW.md) for
pending derivatives and verify protected asset availability before the Pages
delivery. A local-only photo must not be treated as published; the site build
omits it. Never revive the retired public photo Releases for a new trip.
Run the build/tests, include generated pages/bundles in the commit, and follow
normal deployment checks. Merely creating or editing a draft never publishes it.
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

Map credits start collapsed behind the info button in every shared map,
including photo, Replay, day preview and Studio maps. During desktop/phone QA,
check that credits stay closed after tiles load and can still be opened and
closed with the info button; route framing needs no extra attribution margin.

The map has no day-number bubbles or connector lines; select days through the
journal and day navigation. Check rail stops at desktop and phone sizes after
changing routes. Intermediate rail stops have 4 px orange centers and white rims
spanning the selected rail line's 7.2 px width. Both endpoints of every train
leg use larger 10 px dots, including transfer stations and turnaround points.
Shared endpoints combine at the same location and stay large if another leg
also lists that station as an intermediate stop. Intermediate display dots snap
to that leg's line without changing source stop coordinates or reviewed
geometry. Stop names and endpoint roles remain available on hover.
Stop dots remain hidden until the selected train lines have rendered, including
in the photo map. Switch days quickly during review: an abandoned day's pending
markers must never appear over the next day's routes. Slow basemap tiles do not
delay stops once their train lines are visible.

### Train routes

For the complete recipe, query and manifest templates, coordinate conventions,
and troubleshooting, read [TRAIN_ROUTE_WORKFLOW.md](TRAIN_ROUTE_WORKFLOW.md).

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

## Mobile review

The shared day map keeps a persistent compact header with the Journey Atlas
link and a labeled Replay button. Replay opens directly from the map, day
picker or details header. Below the map are the compact date/title, Day details
and Photos, plus the bottom Day N of M picker and previous/next arrows. The
picker lists all days and the other journey-wide actions
(whole map, all photos, unlock and about). Its Day button also returns to the current map. Transport
and stop keys live in Day details; pinch/drag operate the uncluttered map.
Tap **All days** at the top of a focused day map to show the whole journey again.
Tap **Day N of M** at the bottom to return to the all-days list. Mobile route
taps select the day without opening a tooltip; mobile travel cards also omit
tooltips. Desktop mouse hover, clicks and keyboard focus previews remain available.
Desktop headers omit Sample journeys, the trip badge and About this atlas.

Photo and grid headers use the Day N button to return to the day map. The
photo header keeps its count and grid button. Double-tap smoothly zooms around
the tapped point and back out; pinch and drag remain immediate and interrupt
an in-progress zoom. Reduced motion uses immediate double-tap zoom. Pull up
on an unzoomed photo, tap Photo location, or drag its handle to reveal the map.
Pull down on the photo or panel heading to dismiss it. When zoomed, dragging
the photo pans it instead. Sideways swipes and grid round trips must not reopen
a closed location; a new deliberate upward drag must reopen it.
Location and grid changes update one viewer history entry synchronously;
browser Back returns to the day map, while Escape dismisses a nested layer.
Check these flows on the reference trip, a demo and a fresh empty draft.

## Editing and regeneration

The local Atlas Studio is the review surface. The agent runs `npm run studio`,
opens `http://127.0.0.1:4173/studio/` for the user, and stops the server after
the editing session. The user should never need to run the command.

Studio writes durable `controlPoints` and the last explicitly accepted
`geometry` to `content/route-overrides.json`; the public site loads the generated
`dist/assets/content-overrides.js`. Moving an anchor does not replace the saved
geometry, except for endpoint edits: dragging the first/last marker or applying
endpoint coordinates updates only the corresponding terminal vertex of the
current detailed geometry. The adjoining line section changes; every other
coordinate stays exact. **Save locally** persists that edit without accepting a
network proposal or simplified manual guide. Undo/redo restores both anchors
and the complete geometry, including pre-existing overrides.
**Generate route** sends the anchors only to the loopback
Studio service, which uses the journey manifest's local mode network. Original,
saved, anchor-guide, and proposed lines stay separate until the editor accepts
the network result or deliberately chooses the manual guide as a fallback.
Missing, distant, disconnected, or ambiguous networks retain the reviewed
geometry. These overrides take precedence over base route geometry and survive
regeneration of `dist/assets/route-geometry.js`.

### Clean up an inferred route

1. Choose the leg in **Route drawing**. Studio checks its local routing data before enabling **Generate [mode] route**.
2. Select an unwanted numbered intermediate point and use **Delete point N**, or drag it to the intended road or stop. Keep meaningful destinations and turns, not every bend in the old inferred line.
3. Generate again and inspect the green proposal. Generation uses the current points; it does not save or publish a replacement.
4. Choose **Use proposed route**, then **Save locally**. Point edits invalidate earlier proposals, so an outdated result cannot be accepted.

`strategy: "preserve"` protects base geometry during unattended route builds;
it does not prohibit a deliberate Studio proposal from a configured network.
Existing geometry is retained until explicit acceptance. **Restore original
route** removes all local edits for the selected leg (including endpoints); it
is not the point-cleanup workflow. **Smooth anchor guide** only rounds manual
lines and does not follow roads.

If routing data is missing, Studio disables generation and explains what the
agent must prepare. The agent retrieves or reuses a mode-appropriate local
extract, records its provenance and bounds, maps it in the journey manifest,
and verifies a proposal from the current points. Reselect the leg to refresh
readiness. New trips and demos use this same process; no per-trip code change
or copied family route is needed. The current service reconstructs historical
routes on an undirected local graph; it is not a live navigation service.

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

## Travelers taking different routes

Use optional `travelers: [{ id, name }]` and `routeGroups: [{ id, label,
travelerIds }]` in the journey source. A traveler belongs to one named group;
there is no nine-person limit. Assign a leg to one or more groups with
`segment.groupIds`; omit the field for a leg everyone shares. Keep each day's
`segmentIds` in each group's travel order, including shared legs only once.
The validator checks connected, ordered legs within each group. This supports
stable groups that split and rejoin; changing a person's group during a trip
is not modeled yet.

A day may use `groupPlaces: { "group-id": "place-id" }` for different overnight
places, including rest days. A `meetup: { dayId, placeId, label }` announces the
shared arrival; each group's last leg on that day (or overnight place on a
rest day) must end there. Omit all of these fields for a single-party trip.
No existing trip needs migration or a feature flag.

The group selector shows the roster and meetup and projects the map, ordered
legs, photos, day videos and Replay from the original data. Shared legs/media
remain visible in every group. Unfiltered distance totals mean all routes
combined, not distance traveled by each person. Transport colors still indicate
transport mode; cards and Replay identify the route group in text.

The agent currently authors rosters, group assignments and meetup data in JSON
or through the validated planner API. Studio preserves these fields while
editing ordinary trip details, but does not yet offer roster/assignment forms.
Run the normal build/tests and inspect every group's arrival before publishing.
`demo.html?journey=nine-to-como#day=nine-to-como-d1` opens the fictional
nine-person example. `journey` selects a sample; optional `group` preserves a
route selection in a shared link. No per-trip page or application is copied.

## Day videos

An optional journey `videos` list adds videos to the shared journal and exposes
a direct Videos action in the day view on phones. Each item has stable `id`,
`dayId`, `title`, `caption`, an HTTPS `src`, `mimeType` (`video/mp4` or
`video/webm`), positive `durationSeconds`, and explicit `visibility: "public"`.
Optional `poster` and `creditUrl` use HTTPS; `credit` supplies attribution text.
Optional `groupIds` use the same audience rule as legs/photos. `hidden: true`
and `assetStatus: "local"` entries are omitted from public bundles. Omitted
videos yield no empty cards or disabled player buttons.

Use a reviewed MP4 (H.264/AAC is the intended intake format), a poster, and a
useful caption/transcript where needed. Playback uses native controls,
`playsinline` and `preload="none"`; video bytes are requested on play, not while
browsing the journal. Closing releases the source, backgrounding pauses it,
and failures offer retry. Replay remains the route-only player.

This first sample supports public hosted clips, not private video intake or
upload. Never add private original URLs to public journey JSON. Private video
publishing needs a separate authenticated, range-aware media delivery path,
reviewed derivatives/posters, and timed caption support before personal clips
are added. See the remaining work in `docs/FRAMEWORK.md` and `TODO.md`.
