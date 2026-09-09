# Project state

## Full-size-only viewer and Replay — 9 September 2026

The user requested the full photo or no photo, rather than a low-resolution
placeholder. Viewer, Retry and Replay now request the largest derivative with
fullOnly mode. Cached thumbnails/previews are not displayed in these slots,
which stay hidden until the full-size blob has decoded. There is no blur
transition. Failures stay blank with Retry; neighbor/Replay preloads request
the full-size variant. Filmstrip/day-card thumbnails remain appropriately small.

All 115 tests and the build pass. A stalled localhost server verified loading
and failure both stay hidden; Retry revealed a sharp 3200×2400 photo. A decode
completing after lock cannot reveal the photo. The browser-cache release
`bf11464` already deployed successfully in run `34388263770`: five images
reused browser bytes on a real reload via authenticated 304 responses. An
anonymous conditional request still returned 401/no-store without an ETag.


## Browser photo reuse — 9 September 2026

Worker version: `d3b798dd-4c07-433c-8a62-063d366a86ee`.

The user requested long-lived reuse of already downloaded photos. Successful
photo GET/HEAD responses now use `Cache-Control: private, no-cache` and an ETag
derived from the immutable content hash. The browser stores photo bytes across
reloads and sends a conditional request before HTTP reuse. After the normal
origin/token checks, the gateway checks the inner photo service with HEAD and
returns a bodyless 304 for a matching ETag. Invalid/revoked/expired credentials
and errors remain no-store; status and login endpoints remain no-store.

This supersedes earlier notes saying all visitor image responses are no-store.
Photos may remain in the device's private browser cache; lock clears the app's
blobs and tokens but does not promise to erase the browser disk cache. Network
reuse still requires valid authorization. Browser eviction is possible, and
480/1280/full-size variants are separate files. Cloudflare's one-year internal
cache and the existing free plan are unchanged. The loader uses cache:no-cache
and reports revalidated reuse through data-photo-browser-cache diagnostics.
All 113 tests, build, and workerd runtime checks pass, including bodyless 304,
unknown keys, mismatched ETags, and denied conditional requests.


## Edge caching and small thumbnails — 9 September 2026

Production verification: frontend `fbbed8a`, successful Pages run
`34387210417`; the full CI suite has 112 passing tests. The live 21-photo
album navigated without errors. Warm cache fetches took 6–17 ms inside Cloudflare;
observed browser transfers were 241–761 ms for fresh-page cached images and
512 ms for the first full viewer image. One new full-size cache miss took
1495 ms (211 ms inside Cloudflare). These are session samples, not latency
guarantees. Anonymous GET and HEAD for a warmed photo still returned 401 and
no-store, without consulting the inner cache. Visible photos now use high
browser network priority; only speculative preloads use low priority.

The owner approved implementation and deployment conditional on staying free.
The existing Workers Free/R2 setup is retained; no domain, subscription or paid
plan was added. Worker version `4a6edd8b-d588-4460-a514-67c749442134`
uses Workers Cache on an internal PhotoCache entrypoint. The public gateway has
caching explicitly disabled and validates origin/token on every GET/HEAD before
calling that entrypoint with a clean request. Immutable successful WebP bytes
are cacheable for one year internally; visitor responses and errors stay no-store.
X-Photo-Cache and Server-Timing expose cache behavior without exposing credentials.
Cached internal fetches count against Workers request allowances as well as the
gateway request; do not describe these as unlimited free requests.

The visible album has 99 new 480px thumbnails (4,517,224 bytes total) alongside
the existing 1280px previews and large photos. Filmstrips and album cards request
480px. The viewer immediately reuses a loaded thumbnail or preview while upgrading,
with the tested bounded queue, timeouts and retries. All 111 tests and the Worker
runtime pass; the local 21-photo album passes navigation without stalls. New imports and
the private publisher support thumbnail/preview/full-size variants.


## Photo loading recovery and request priority — 9 September 2026

The earlier cache change did not address hung downloads or request competition.
The shared private-photo loader now limits downloads to four, with at most two
background requests so a selected photo has capacity. It shows the available
1280px image before fetching a larger viewer image, preloads only small neighbors,
cancels abandoned requests, and avoids eagerly hydrating every tracked image at
unlock. Private images use only the auth loader's visibility observer.

Each download attempt has a ten-second timeout covering both headers and body,
with one retry for transient failures. The viewer shows loading/error/locked
states with Retry photo or Unlock photos actions. Failed large-image upgrades
retain the smaller photo; old request failures cannot affect a new selection.

Build and all 108 tests pass, including stalled headers/body, transient recovery,
foreground priority, abandoned loads, preview retention, and expired access.
The 21-photo album passes browser navigation. A localhost fault server reproduced
a hung download, the eventual Retry button, and successful recovery on retry.
No Worker or authentication-policy change is required for this frontend fix.


## Performance and Replay improvements — 9 September 2026

Photo memory caching, responsive viewer requests, coalesced status checks,
CORS preflight caching, two-second Replay autoplay, cached-photo readiness, and
Replay zoom/close spacing are implemented. See the newest CHANGELOG entry
and CLOUDFLARE_SETUP caching section. Build, 101 tests, and Worker runtime pass.
The user explicitly approved production deployment. The preflight-cache Worker
is deployed as version `946e0e05-267c-420e-95c7-40629afcfbf4`. The matching Pages
changes publish through the main-branch workflow; verify its successful run and
a fresh public load when checking this release.


## Quiet access UI and additional shared passwords · 9 September 2026

Authenticated pages have no photo-access control or status in the header.
The remaining unauthenticated entry says View photos. Restoration emits no
loading/status copy. One-hour access tokens now survive reload in this tab's
session storage and are checked with Cloudflare before images load; passwords,
password proofs and the 30-day HttpOnly cookie never enter tab storage. First-
party renewal stays visually empty unless a password or error needs attention.
The three newly requested credentials are added, preserving the initial test
credential. Password plaintext is not saved in the repository.

## Stable photo viewer and automatic access restoration · 9 September 2026

Viewer selection now preserves the filmstrip DOM and background day photos;
only the active thumbnail, main image and photo map change within the same day.
Cached private photos display synchronously without a blur reset or duplicate
fetch. New full-size photos and bounded neighbor preloads still need downloads.
Reloads and page navigation now automatically check the first-party Cloudflare
remembered session, using the existing single-use PKCE return. A valid 30-day
cookie restores photos without an Unlock click or password prompt. Missing
sessions return to the normal atlas unlock prompt; cancel/logout never loops
back into automatic login. Credentials remain server-enforced and tokens stay
in memory. All 91 tests, build and workerd checks pass.

## Large album loading fix · 9 September 2026

The private image cache treated pending display requests as unused and canceled
some when an album exceeded 12 cached images. A 21-photo regression reproduced
nine canceled requests. Cache pruning now protects both pending display requests
and displayed blobs, and retains at most 12 additional unused entries. All 82
tests and the build pass, including large-album loading, bounded cache eviction,
and logout cleanup. Authenticated HEAD checks returned 200 for all 198 private
files. Authentication and private storage are unchanged.

## Private photo access live · 9 September 2026

Published as `55eeb2b` in successful Pages run `34377620269`.
Worker version: `125d91b6-75cf-4ff1-b5f8-17e27428b14d` on Workers Free.
The owner-selected `initial-test` credential is active; its plaintext is not
stored in the repository. Cloudflare serves 99 visible photographs as 198
private WebP objects (135,849,682 bytes), with small and large sizes and public
32 px blur placeholders. The GitHub Pages address remains unchanged.

Production acceptance passed in the in-app browser: initial password login,
remembered access without re-entering the password on the journey, 1280 px
previews/Replay, 3200 px viewer, and logout requiring the password again.
All 80 tests, build, actual workerd checks and secret/diff checks passed.
Both old public photo Releases were deleted after confirming local backups
of all 404 assets (199,772,706 bytes). All 404 historical image URLs and both
Release endpoints return 404; all 198 private image URLs return 401 without
authentication. Existing third-party caches or downloaded copies cannot be
recalled. The tiny embedded blurs, captions, locations and routes remain public.

See [PHOTO_AUTH_HANDOFF.md](PHOTO_AUTH_HANDOFF.md) for password maintenance,
private publishing, free-plan limits and recovery. Keep originals and the local
migration backups. Do not follow older public Release upload instructions below.

## Day previews start at photo 1 · 9 September 2026

Published as `6bc0561` in successful Pages run `34367258218`. Fresh public
verification confirmed Day 3’s preview opens photo 1 of 13, with no browser
errors. The demo starts at photo 1 too. All 64 tests and the build pass.

The day story's large photo and each All photos day card now use the first
visible photo in the saved album order. Clicking the day image therefore opens
photo 1, matching View photos and day-album navigation. Direct photo selections
still open the selected image. Replay's curated photo choices remain available.

## Compact catalog, trip title and photo selection · 9 September 2026

Published as `bcdca9b` in successful Pages run `34366124964`. A fresh public
load confirmed the new landing copy, compact 106 px desktop card, renamed
journey introduction, and orange photo selection with no Selected badge.
The catalog still contains only the one real trip. No browser errors.

The catalog now uses compact horizontal cover-and-text rows and a short
introduction: “We wander but aren't lost...yet” / “The routes we took and the photos we brought
home, one trip at a time.” It has one real journey; no placeholder journeys
were published. Covers use image sizes matching their displayed widths and
later entries load lazily. On phones, cards prioritize title, dates and facts.

The family journey title is now “Switzerland & Italy · Family trip” throughout
the catalog, introduction, map heading, Replay and page title. Selected viewer
thumbnails retain an orange outline and aria-pressed state; both the visible
Selected badge and redundant selected wording in their accessible names are gone.

Validation: all 64 tests and the build pass. A five-entry local fixture fits
four complete journeys at 1280×720, five at 1440×900, three at 390×844 and two
at 375×667. iPhone and larger Mac sizes were verified with fixed-size browser
frames because the browser-wide viewport override did not change page size.
Phone rows have no horizontal overflow. The viewer outline follows navigation.

## Published photos and simpler day panels · 9 September 2026

Published as `a3112e3` in successful Pages run `34363408065`. Fresh public
checks confirmed 99 photos, an uploaded Day 8 image loading in the viewer,
blank day/Relive descriptions, the album button below the lead image, and
always-visible travel legs. Replay still defaults to 2×. No browser errors.

The traveler explicitly approved publishing the 13 new photos and saved
location/visibility edits to the public site and GitHub Release. All 48 WebP
derivatives (22,921,326 bytes) were uploaded and their URLs verified; all 13
manifest entries are published. Originals remain private. The saved visibility
change and 13 uploads bring the family album to 99 visible photos.

Cleared all 14 family day descriptions in both source and overrides, plus the
14 shortened Relive captions. Empty descriptions render no placeholder prose;
Replay caption validation now accepts blank text. Studio labels this copy
optional. Trip introduction, day titles, route data and personal photo notes
remain available.

The photo-count button sits directly below the lead photo and opens that day's
album. Removed “See this day on the map” and its handler. Travel legs render as
an always-visible section with a single heading and no collapse control, shared
by real and demo journeys. Rest-day and 2× Replay pacing remain unchanged.

Validation: 64 tests pass, including blank Replay caption validation with route
and duration preservation. Studio has been restarted for the updated validator.

## Relive defaults to 2× · 9 September 2026

Published as `47b635d` in successful Pages run `34362670497`. A fresh public
Relive launch showed speed 2× and “Playing at 2×” with no browser errors. This
deployment uses previously published trip data; local edits/uploads await approval.

Relive/Trip Replay starts at 2×, with the speed selector matching playback in
both the real journey template and demo. At 2×, days without route segments get
50% longer holds: a 2.4-second rest moment lasts 1.8 seconds instead of 1.2.
The 1× and 0.5× timings and travel-day timing are unchanged. Upload test fixtures
also remove overrides belonging to excluded local intake manifests.

The initial upload was blocked by automatic approval review; the traveler
subsequently approved the public destination explicitly. The completed upload
and saved-data publication are recorded above.

Validation: all 63 tests and the build pass. Local Relive shows the 2× selector
and “Playing at 2×” with no browser errors.

## Map photo landmarks removed · 9 September 2026

Published as `147229b` in successful Pages run `34362027798`. Fresh public
verification confirmed no map photo thumbnails or legend entry, working day
album/next-photo navigation, and no browser errors. Pending local uploads were
preserved and excluded from this cleanup commit.

The journey map no longer displays photo thumbnails, groups, count badges, or
photo leader lines. The renderer, geographic clustering, collision placement,
group chooser, map legend cue, event handlers and associated styles/tests have
been removed. Day-marker placement now considers only other day markers and
map labels. Earlier landmark experiments remain recorded in the changelog.

Photos are accessed from day stories and **All photos**. The viewer retains its
saved-location map and approximately two-second transition between photos.
Studio batch uploads still assign each photo by capture date in the journey
time zone, with individual day selection for unmatched dates. Existing local
uploads and traveler edits are preserved. Upload tests isolate their manifests
from local intake so pending traveler assets are never used as test fixtures.

Validation: all 62 remaining tests and the production build pass. Local browser
checks confirmed zero map images in the family and demo day views, working day
albums and next-photo navigation, Fit route, and no browser errors.

## Studio counts, uploads, and Replay camera · 9 September 2026

Studio **Photos from** counts match the current grid, including hidden photos
or the selected Trash view. Counts refresh after trash/restore. Replay travel
frames its current route leg; a chapter photo does not override that camera.
Explicit photo-only moments retain their saved zoom.

Multi-file uploads default to automatic date assignment. Missing, invalid or
out-of-trip dates retain each file for individual day selection and retry.
An explicit batch-day override is available; batches spanning days open All days.
Processing, private originals, blank copy and asset publishing are described in
`PHOTO_WORKFLOW.md`.

## Studio photo library and traveler-only copy · 9 September 2026

Published as `32cf654` in successful Pages run `34356358778`. Fresh public
checks confirmed blank generated copy, retained personal notes, and the saved
trash removals (85 visible photos at deployment). Viewer and demo checks passed
without browser errors. Studio remains running locally on port 4173.

Studio **Photos → Upload photos** accepts multiple stills up to 50 MB each,
processes sizes/previews/metadata locally, and appends separate upload manifests.
Pending assets remain outside production until `photos:publish -- --journey <id>
--publish` uploads and verifies their Release files. Originals and GPS candidates
stay private. No LLM is needed, and no captions/descriptions are generated.
Recoverable Trash/Restore uses the `trashed` override; public builds and local
previews exclude trashed images while preserving references for restoration.
Revision-checked saves prevent stale tabs from overwriting newer disk edits.
See `PHOTO_WORKFLOW.md` for the complete workflow, retry behavior, and distinction
between album deletion and permanent removal of hosted Release assets.

Removed 95 unchanged AI captions and 89 AI descriptions using original review
commit `4801801`; preserved the traveler's three captions and three descriptions.
All recent saved photo pins and route edits are retained. Existing accessibility
alt text remains separate. Do not generate visible photo prose in future.

Validation includes 60 tests, real Sharp resize/metadata checks, mixed upload
failure handling, duplicate detection, publishing retries (mock GitHub), public
exclusion/restoration, and isolated local HTTP upload/save-conflict checks.
Browser verification covers blank copy, Trash/Restore, and local upload status.
CI now installs locked image dependencies before its tests and build.

## Photo viewer camera

Located photos in the viewer use their saved coordinate and zoom. Moving
between two photos frames both locations, then settles on the next in about
1.95 seconds. New selections, closing the viewer, manual camera movement and
hidden tabs cancel pending movement; reduced motion is immediate. Returning
to the mobile map refreshes day controls and frames the selected day.

## Studio editing and saved traveler edits · 9 September 2026

Published as `d1ca46e` in successful Pages run `34351239971`. Public overrides
match the built asset exactly; a fresh journey load passed without browser errors.

Endpoint drags and typed coordinates now preserve the rest of the detailed
route, with complete geometry undo/redo. Same-day photo selections keep the
working camera; **Switch to current point’s zoom** restores a saved photo view.
Saved photo pins/zooms and copy, and the Varenna–Fiumelatte route override are
included in this release. Blank descriptions are deliberate editorial values;
the review test permits them and verifies exact public override preservation.
All 42 tests and the production build pass. `TRAIN_ROUTE_WORKFLOW.md` and
`PHOTO_AUTH_HANDOFF.md` are included; the latter is a plan, not implemented auth.


Updated 9 September 2026.

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

## Non-auth backlog completion · 9 September

W02 and T19/T23/T24/T25 are complete. The remaining unchecked TODO is W01,
private photo access; this pass does not change authentication or media hosting.
Studio's Trip plan & cover edits calendars, titles, time zones, places, ordered
legs, journey covers, and curated Replay moments with preview and validation.
Day IDs, notes, overrides, and page slugs survive structural edits; nonempty
calendar days cannot be silently removed. New legs are marked provisional.

The catalog/opening share the reviewed Lake Brienz family photo. The compact
journal places story before expandable travel details and uses one scroll
surface. Mobile day selections open Journal, route taps reveal Map, and the
95-photo album groups by day with clear boundary/empty-day continuation.
Replay now has 14 editable chapters, about 218 seconds of distance-based pacing, every
ordered leg, loading/retry states, hidden-tab pause, and manual reduced-motion
navigation. Original automatic Replay remains available for demo journeys.

Rest days take 2.4 seconds; Mürren's nine legs take approximately 50 seconds.
Each leg gets a brief camera transition, a distance-based travel interval, and
gentle acceleration/deceleration. Photo selection has a strong border and
Selected label. Last-photo continuation sits in a dedicated sidebar row with
a rounded button and a brief pulse that respects reduced motion.

Day 4 now ends the coastal bicycle route at the Kehrsiten-Bürgenstock landing,
and its ferry goes directly to Luzern Bahnhofquai without intermediate calls.
Both routes have reviewed OSM geometry and preserved source entries; the
previous local bicycle override was backed up before the requested correction.

GPS clearing uses an explicit null value, proposals reject stale anchor
revisions, and EXIF day matching is host-zone-independent. See
`JOURNEY_WORKFLOW.md`, `PHOTO_WORKFLOW.md`, and the reconciliation at the top of
`UX_HANDOFF.md`. The pre-existing local route override remains user work and is
excluded from generated release output.

Published in commits `ff0587e` and `d822a39`; Pages run `34331092072` succeeded.
Fresh public catalog, mobile Replay/journal/album, and demo checks passed.

## New-trip foundation (8 September)

T11 is implemented. Studio **+ New trip** creates a local draft from name/dates,
generates a complete ISO-date calendar, and opens Day copy. Local previews work
without known places/routes/photos. Draft sources, notes, and generated assets
are ignored by Git and excluded from all public bundles. Sources now live in
`content/journeys/`, with journey-specific photo and route JSON; `npm run build`
generates pages and public assets with validation and content-hashed URLs.
Pages CI runs tests/build without needing private media or network extracts.

Photo/route editors clear on empty selections, preview follows the selected
journey, and day editing no longer depends on map load. Photo import explicitly
selects a journey and uses its ISO calendar/time zone, unique IDs, and Release
output. Failed/empty imports retain reviewed output; GPS stays in a private
candidate report until review. T19 is the next future-planning priority;
T23–T25 record additional confirmed bugs/limitations found in this pass.

T15–T17 are complete. The six MOV files remain private and held because no
reviewed story need currently justifies a video publishing pipeline. Days 9,
11, and 14 retain intentional no-photo states with no illustrative fallback
media (Day 8 is also empty after its only source image was hidden in review).
Trip Replay now follows ordered legs with mode-specific route styling, a moving
map position, day/segment story context, and reviewed lead photos. Located
photos become map-zoom pauses when future reviewed coordinates are available.
The player includes play/pause, three speeds, day stepping, a scrubber,
keyboard controls, reduced-motion behavior, and replay/explore completion
actions; it uses the same data-driven viewer on real and demo pages.

## Current behavior

- `/travels/` is the catalog of real journeys.
- `/travels/switzerland-italy.html` is the stable detail page for the current
  family trip. Trip detail selection is data-driven and shares the viewer code
  with other trip pages.
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
- Journey routes keep their transport colors with a wide near-white casing;
  selected routes use thicker lines and a still-wider casing. The map key
  follows the focused day's modes, with grey context for other days. The slightly softened
  terrain treatment keeps routes visually dominant without losing map detail.
- Selected routes are drawn above other routes.
- Routes have generous invisible hit lines. Hover and tap reveal a compact card
  with day, mode, endpoints, and day context; tapping selects the corresponding
  day. The journal's route-leg buttons provide the same highlighted interaction
  for keyboard users.
- Basemap labels are drawn above route lines, preserving city-name context.
- Day focus keeps other routes visible in quiet grey.
- Day close-ups show previous/next arrows and `Day N of 14` inside the map.
- Fresh load draws the routes immediately, then fits the journey over 2.5s.
- Left and right panels have independent, visible scrollbars.
- Transport modes use a color-vision-conscious palette plus distinct widths and
  solid, dashed, dotted, dash-dot, or diamond cues in both map and legend.
- Emoji markers are removed.
- Route research and accuracy limits are in `ROUTE_SOURCES.md`.
- Network geometry builds select a journey ID and consume its committed
  `content/route-sources/` manifest. Ordered stops remain waypoints; ambiguous
  or disconnected networks produce warnings and retain the last reviewed
  geometry. Output ordering is deterministic, and fixture tests cover those
  failure modes.
- The photo UI supports embedded blurred previews, responsive `srcset`, lazy
  hydration with a generous look-ahead margin, and preloading of neighboring
  full-screen photos.
- The full-screen photo viewer is day-based: arrows step through photos within
  the selected day, separate arrows move between days, and the main story/map
  follow the viewer day. Days without photos show an intentional empty state.
- Located photos move the side map to their exact coordinate and stored zoom
  while highlighted, and the viewer can show both a short caption and longer
  scene description.
- Trip Replay opens only on request and draws every leg in day order while
  completed lines accumulate in their transport-mode color and pattern. The
  current position follows the route geometry; reviewed located photos receive
  their own pause and exact map zoom. The player is usable by keyboard, supports
  speed and day timeline controls, and removes line/camera animation under the
  reduced-motion preference.
- `npm run studio` starts a loopback-only Atlas Studio for placing photos and
  editing their text, or redrawing a route with draggable control points,
  smoothing, undo, and redo. Saves write JSON sources plus the generated public
  override asset.
- Studio can switch among every real or demo journey, select any day and any of
  its route legs, drag or type exact route endpoints, and edit day date labels,
  titles, and descriptions. Day copy is stored in `content/day-overrides.json`.
  The photo accessibility-description field is intentionally not part of the
  Studio UI.
- Studio route mode keeps human control points as durable anchors and requests
  proposals from journey-manifested local rail, ferry, road, walking, or bicycle
  network extracts. Original, saved, anchor-guide, and proposed lines remain
  visually separate until the editor explicitly accepts a proposal or manual
  fallback. Missing, distant, disconnected, and ambiguous networks leave the
  last reviewed geometry intact and show an actionable error.
- Bicycle and walking legs accept a private GPX file in Studio. The loopback
  importer preserves recorded order, rejects reversed/unsafe/gapped tracks,
  calculates unsimplified distance, simplifies meaningful turns, and saves only
  accepted `[lng, lat]` geometry plus non-identifying provenance.
- All 104 family-trip photos have reviewed day, copy, alt text, visibility, and
  privacy metadata. No exact viewpoints were invented for the GPS-free files.
  Ninety-five photos remain visible; eight redundant/low-quality frames and one
  private-residence exterior are excluded from generated public photo data.
- Every photographed day has explicit album order and a deliberate lead photo.
  Studio exposes keyboard buttons to move the selected image earlier/later and
  choose the lead independently; story, strip, and viewer resolve the same
  ordering, and a lead opens at its real album position.
- Clicking a photo location—or finishing a pin drag—in Studio now records the
  map's current zoom with the coordinates. The saved 2–20 zoom range is honored
  by the public photo viewer instead of being forced back into 12–18.

## Known issues

- Removing a public photo requires deleting its Release assets and removing it
  from the manifest; replacing a file under the same tag may remain cached, so
  use a new asset filename for edited replacements.
- The supplied stills contained no GPS coordinates, so their exact viewpoints
  remain unlocated after review. Days 8, 9, 11, and 14 now have no visible
  family photos after the private-residence exterior was hidden.
- Bus, bicycle, walking, and gondola routes other than Bellagio–Como still use
  reviewed shaping points rather than full network geometry. Mode-aware Studio
  proposals require the corresponding ignored local extract under
  `build/route-inputs/`; those road, walking, and bicycle extracts have not yet
  been prepared for this journey. Gondola routes remain reviewed/manual.
- Day badges choose a label-free offset, avoid one another and map edges, and
  use a leader line back to the exact place. Grouped overview badges are compact
  and placement is recalculated after map movement.

## Approved future direction

- Route hover plus tap/focus should explain the day, mode, endpoints, and what
  happened on that part of the journey.
- Increase transport-mode differentiation beyond the current subtle dash
  patterns, while retaining a non-color cue for every mode.
- Keep all build, server, Git, and deployment work agent-driven; the user should
  not be asked to run npm commands.
- Build Trip Replay after the underlying route and photo-location data is
  trustworthy.

## Main lesson

Stops and route geometry are different data. Keep named `stops` for meaning and
markers, but add separate detailed GeoJSON-order `geometry` (`[lng, lat]`) for
the drawn line. Current `via` and stop-to-stop lines are only approximations.
