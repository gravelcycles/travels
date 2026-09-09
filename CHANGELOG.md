# Changelog

Keep this file current whenever a user-visible feature, content correction, or
workflow change lands. Add the newest entry first and include the matching
commit after it is known.

## 9 September 2026

### Cache private photos after authentication and restore small thumbnails

- Enable internal Workers Cache on workers.dev while keeping the public gateway
  uncached and checking access on every request. No paid plan or domain added.
- Restore 480px filmstrip/day-card images: 99 visible thumbnails total 4.52 MB,
  compared with 34.45 MB for the previous smallest variants.
- Reuse loaded thumbnails immediately in the viewer and keep larger upgrades
  behind foreground requests. Include the stalled-download recovery fix below.
- Add cache-status/timing diagnostics and regression checks for warm-cache auth,
  stripped internal request headers, uncached errors, and thumbnail reuse.

### Recover stalled photo loads and prioritize the selected photograph

- Limit private downloads to four and background downloads to two. Selected
  photos bypass queued thumbnails/preloads; abandoned loads are canceled.
- Display a cached or quickly fetched 1280px photo while its larger viewer image
  loads. Keep that preview if the large-image request fails. Neighbor preloads
  use 1280px; unlocking respects lazy image loading and avoids duplicate observers.
- Time out stalled response headers/bodies after ten seconds and retry transient
  failures once. Offer Retry photo on failure and Unlock photos for locked access.
- All 108 tests pass. Browser QA covers the 21-photo album and a deliberately
  hung local server: the viewer surfaces Retry and recovers when service resumes.


### Photo request efficiency, delayed Replay, and site QA

- Retain up to 96 unused private image variants within 64 MiB instead of only
  twelve; keep active images alive and clear all blobs on lock. Phone viewers
  and their neighbor preloads now select an appropriate responsive size.
- Coalesce overlapping photo-access checks and throttle them to one per minute
  per tab; ignore responses from an older access session. Cache CORS preflight
  permissions for up to a day while keeping actual photos and auth uncached.
- Start Replay two seconds after either entry button or returning to Replay.
  Pause, close, day/moment selection and hiding the tab cancel the countdown.
- Fix Replay waiting forever on an already displayed cached image, and prevent
  blur placeholders from marking a private Replay photo ready too early.
- Move Replay map zoom controls below the close button, which overlapped them.
- QA: all 14 real days and 99 photo positions clicked locally; filmstrip jumps,
  day boundaries, album chooser, route inspection, notes, desktop and 390px
  layouts checked. All 22 days across four demo journeys clicked. No browser
  warnings/errors in these checks. Build, 101 tests, and Worker runtime pass.
- The user explicitly approved production publication. Worker version
  `946e0e05-267c-420e-95c7-40629afcfbf4` contains the preflight-cache change;
  the matching frontend publishes through the main-branch Pages workflow.


### Start each day album at its first photo

Published as `6bc0561` in successful Pages run `34367258218`. Fresh public
verification confirmed Day 3’s preview opens photo 1 of 13, with no browser
errors. The demo starts at photo 1 too. All 64 tests and the build pass.

- Use the first visible photo in saved album order for the large day image and
  All photos day cards, so clicking a day preview begins at photo 1.

### Use the traveler's landing-page headline

Published as `0352e29` in successful Pages run `34366574353`; the exact
headline was verified on a fresh public load. All 64 tests pass.

- Replace the catalog headline with “We wander but aren't lost...yet”.
  Keep the supporting sentence and compact journey layout.

### Compact the catalog and improve its copy

Published as `bcdca9b` in successful Pages run `34366124964`. A fresh public
load confirmed the new landing copy, compact 106 px desktop card, renamed
journey introduction, and orange photo selection with no Selected badge.
The catalog still contains only the one real trip. No browser errors.

- Replace the oversized hero/cards with “Where we went.” and a compact journey
  list: 4–5 entries at checked Mac dimensions and 2–3 at checked iPhone sizes.
  A local five-entry fixture verifies capacity; the public catalog has one trip.
- Use “Switzerland & Italy · Family trip” as the family journey's title.
- Remove the photo viewer's Selected badge and redundant accessible wording;
  preserve the orange outline and pressed state. All 64 tests and build pass.

### Publish saved photos and simplify day panels

Published as `a3112e3` in successful Pages run `34363408065`. Fresh public
checks confirmed 99 photos, an uploaded Day 8 image loading in the viewer,
blank day/Relive descriptions, the album button below the lead image, and
always-visible travel legs. Replay still defaults to 2×. No browser errors.

- Publish 13 approved uploads as 48 verified WebP derivatives and include saved
  location/visibility edits, bringing the family album to 99 visible photos.
- Clear all 14 family day descriptions and shortened Relive captions; allow
  intentionally blank Replay copy without placeholder descriptions.
- Move View photos directly below the lead image, remove See this day on the
  map, and show travel legs permanently expanded with one section heading.
- All 64 tests pass; Studio supports optional Replay copy.

### Start Relive at 2× with longer rest-day holds

Published as `47b635d` in successful Pages run `34362670497`. A fresh public
Relive launch showed speed 2× and “Playing at 2×” with no browser errors. This
deployment uses previously published trip data; local edits/uploads await approval.

- Set the initial playback speed and selector to 2× in real journeys and demos.
- Give rest days 50% more screen time at 2×; preserve 1×, half speed, and travel
  pacing. Filter local-upload overrides alongside upload manifests in tests.
- Local photo/data publishing is prepared but awaiting public-upload approval.

### Remove map photo landmarks

Published as `147229b` in successful Pages run `34362027798`. Fresh public
verification confirmed no map photo thumbnails or legend entry, working day
album/next-photo navigation, and no browser errors. Pending local uploads were
preserved and excluded from this cleanup commit.

- Retire the map thumbnail feature, including grouping, distance calculations,
  collision placement, leader lines, group chooser, map legend and movement
  handlers. Simplify day-marker placement and remove the retired feature tests.
- Keep day albums, the photo viewer and its location transitions, Studio photo
  editing, automatic batch uploads and route-led Replay cameras.
- Update current documentation; the landmark entries below are historical and
  describe a feature that is now removed. Isolate upload tests from local intake.
- All 62 remaining tests and the production build pass. Family/demo browser
  checks confirm clear maps, working photo browsing and no console errors.

### Keep photo thumbnails off routes and automatically sort batch uploads

Published as `f350a06` in successful Pages run `34359916696`. A fresh public
load verified Day 1 thumbnails clear the Zürich–Luzern route and the four-photo
chooser opens correctly, with no browser errors. Studio remains available on
port 4173. The isolated upload test server has been stopped.

- Check entire route segments when placing photo thumbnails and count badges;
  use clear positions with leader lines, reflow after camera movement, and omit
  crowded landmarks when no clear position exists. Albums retain every photo.
- Default multi-file Studio uploads to each photo's capture date in the journey
  time zone. Retain unmatched files for individual day selection and retry;
  preserve an explicit batch-day override and show all assigned days afterward.
- Document the automatic intake and exception flow. All 70 tests pass; isolated
  HTTP tests verify dated and undated uploads without changing traveler albums.

### Day-only 500 metre photo groups and route-led Replay cameras

Published as `aca28dc` in successful Pages run `34358287577`. Fresh public
checks verified Day 1’s geographic groups, zero photo landmarks after Fit route,
and Replay framing the Zürich–Luzern leg. No browser errors were reported.

- Show photo landmarks only in day view; remove them from initial overview and
  **Fit route**. Group photos only when every pair is within 500 m, independent
  of zoom. Counted thumbnails open a photo chooser.
- Make Studio **Photos from** counts match the current grid, including hidden
  photos or the selected Trash view; update counts after trash/restore.
- Frame Replay travel using the current route leg, even if its chapter contains
  a photo with a saved close-up zoom. Photo-only moments retain photo zooms.
- Preserve the latest saved traveler photo/route edits. All 65 tests pass;
  browser checks cover Day 8 counts, grouped selection, overview clearing, and
  animated travel at route scale.

### Upload and trash photos; remove generated photo prose

Published as `32cf654` in successful Pages run `34356358778`. Fresh public
checks confirmed blank generated copy, retained personal notes, and the saved
trash removals (85 visible photos at deployment). Viewer and demo checks passed
without browser errors. Studio remains running locally on port 4173.

- Add local Studio multi-file photo upload with day selection, automatic WebP
  sizes/blur previews, private originals/GPS, blank copy, duplicate detection,
  per-file errors, and separate append-only upload manifests.
- Add recoverable Trash/Restore; exclude trashed images from preview/public data.
  Automate reviewed Release asset publishing with a preview command, retries,
  immutable files and URL checks. Keep pending photos outside production.
- Clear 95 generated captions and 89 generated descriptions while preserving
  the traveler's edited copy. Label optional fields **Your caption** and **Your
  notes**. Retain the latest saved photo pins and route edits.
- Protect saves against stale Studio tabs. Document local editing, processing,
  publishing, restore, and permanent asset-removal boundaries in PHOTO_WORKFLOW.
- Validate with 60 tests and an isolated HTTP/browser upload/trash/restore check;
  install locked image-processing dependencies in Pages CI.

### Show only the selected day's photos, with individual map fans

Published as `013dacd` in successful Pages run `34354476031`. A fresh public
Day 2 load showed exactly its five landmarks; individual viewer opening passed
with no browser errors.

- Selecting a day immediately removes other days' photo landmarks, even while
  route layers load or the phone map is hidden. Viewer day navigation also
  updates the atlas, and returning to Map frames the selected day correctly.
- Nearby photos spread apart with thin lines to their exact saved locations.
  Each thumbnail opens its photo directly; placement avoids other thumbnails
  and the map key. **Fit route** restores photos from all days.
- Preserve the latest saved Studio photo pins and cleared captions. Accessible
  landmark labels fall back to photo alt text when a caption is empty.
- Validation: 55 tests and production build pass; phone day filtering, fan
  spacing, individual viewer opening, and viewer day navigation checked.

### Photo landmarks and calmer viewer transitions

Commit `f77cfb7` deployed successfully in Pages run `34352663568`. A fresh
public check verified landmarks, viewer opening, and previous/current pins during
navigation with no browser errors. Public app/helper assets match the tested build.

- Saved photo locations appear as compact thumbnail landmarks. Nearby pins share
  a counted stack that opens a photo chooser; individual photos open the viewer.
  Day focus limits landmarks to that day, and day labels avoid the thumbnails.
  Map fitting includes located photos, including pins away from the travel line.
- Moving between located photos frames both pins for 850 ms, pauses for 150 ms,
  then settles at the next photo's saved zoom over 950 ms. The previous pin is
  muted during the transition and removed on arrival. Rapid navigation, closing
  the viewer, and manual map movement cancel pending camera moves.
- Reduced motion skips animation; unlocated and coincident photos avoid an
  unnecessary two-stage move. Hidden photos never become landmarks.
- Validation: 48 tests and production build pass; desktop/mobile landmark
  selection, stacked photo chooser, viewer transition, and rapid navigation
  were checked in the browser.


### Publish saved Studio edits and editing improvements

Commit `d1ca46e` deployed successfully in Pages run `34351239971`.
The public override bundle matches the local build byte-for-byte, and a fresh
journey load passed with no browser errors.

- Include the traveler's saved photo captions, descriptions, map locations and
  Replay zooms, plus the Varenna–Fiumelatte walking-route override.
- Include the endpoint-preserving route editor, steady same-day photo map,
  explicit saved-view button, and the train-route and photo-auth handoff docs.
- Allow deliberately blank photo descriptions in the review test while checking
  that published overrides preserve every saved edit and still exclude hidden
  media. All 42 tests and the production build pass.


### Keep the photo-editing map steady within a day

- Selecting another photo in the same day preserves the current map position
  and zoom, including unlocated photos. Clearing a pin also keeps the view.
- **Switch to current point’s zoom** explicitly restores the selected photo's
  saved location and zoom; it is disabled until a location is available.
- Placing or dragging a pin still records the working map zoom for Replay.
  Switching days retains the existing automatic framing behavior.
- Validation: three photo-view regression tests and browser checks pass,
  including retained framing, explicit saved-view navigation, and pin zoom.


### Preserve detailed routes when moving an endpoint

- Studio endpoint dragging and coordinate entry now change only the selected
  terminal vertex and its adjoining line section. All other detailed coordinates
  remain exact, including existing overrides. Save locally applies directly.
- Undo/redo restores the full route edit, including geometry and smoothing;
  intermediate anchors still require an accepted proposal or manual fallback.
- Validation: endpoint regression tests and browser coordinate/undo checks pass.
  The photo-review test now allows intentionally cleared descriptions.

### Document how to reproduce rail-aligned routes

- Added `TRAIN_ROUTE_WORKFLOW.md` with the current OSM rail-geometry pipeline,
  query and manifest templates, coordinate conventions, review steps, override
  precedence, and reproducibility limitations. Linked it from the README and
  journey workflow; no route data or application behavior changed.

### Clearer photo selection, calmer Replay, and corrected Lake Luzern routes

Commit `eb11be1` deployed successfully in Pages run `34349939474`.
Fresh public checks confirmed the corrected lake loop and the last-photo
sidebar selection/continuation controls, plus live progression through Mürren's
connections with no browser errors.

- Photo thumbnails show a strong selection border, a visible Selected label,
  and pressed state. The rounded last-photo Next day button stays in its own
  sidebar row and gives three gentle pulses; reduced motion disables the pulse.
- Replay allocates travel time by distance, pauses briefly for each camera
  transition, and frames the active leg. Rest days last 2.4 seconds, Mürren's
  nine legs receive about 50 seconds, and the full trip lasts about 3m 38s at 1×.
- Day 4 now follows shoreline bicycle roads to the Kehrsiten landing and a
  direct ferry to Luzern without intermediate stops. Reviewed OSM geometry,
  preserved anchors, approximate distances, and provenance were updated.
- Validation: all 35 release-build tests pass, including distance-weighted
  Replay pacing and point-density independence. Desktop/390 px browser checks
  cover selected thumbnails, last-photo continuation, Mürren's mountain legs,
  the brief rest-day transition, and the corrected lake loop. Unrelated Studio
  photo edits remain local and are excluded from this release.

### Keep the map key in sync with highlighted routes

Commit `6754575` deployed successfully in Pages run `34348023018`. A fresh
public Day 6 check confirmed transport colors match the key, with no console errors.

- Selected days keep each transport mode's color, with thicker lines and full
  opacity against muted trip context. Inspection increases width without
  replacing the mode color. The key follows the focused day's modes and marks
  other days in grey; rail stops appear only when the map shows them.
- Validation: 33 tests pass; browser checks cover mixed-mode Day 6, inspected
  routes, stationary Day 7, the overview, and the Alpine demo's cycling day.

### Complete the non-auth backlog: planning, story, and editorial reliability

Implementation commit: `ff0587e`.
Published with short-screen fix `d822a39` in successful Pages run `34331092072`.
Fresh public checks confirmed the loaded catalog cover, mobile Replay and Day 6
exploration, the 95-photo grouped album, four demo choices, and no trip console errors.

- Completed T19: Studio edits trip titles, dates, time zones, named places, and
  ordered travel legs; previews calendar changes; preserves IDs, notes, photo
  associations, and overrides; and refuses destructive date trims. Local draft
  output remains excluded from publication. Source revision checks protect plans
  changed elsewhere, and saves keep backups.
- Fixed T23–T25: explicit GPS clearing survives reload; stale network/GPX results
  cannot replace proposals after anchor changes; raw EXIF clock matching follows
  a documented camera-local rule with explicit-offset conversion.
- Completed W02: a shared editable journey cover and photo introduction,
  story-first journal with expandable legs, immediate mobile day/map navigation,
  a grouped album, story-based empty days, album continuation, readable travel
  summaries, and clean photo timestamps/attribution.
- Added 14 editable Replay chapters (116 seconds) using the existing reviewed
  photos and ordered geometry. Replay has moment seeking, transport symbols,
  paused return from exploration, hidden-tab pause, manual reduced motion, and
  usable loading/failure/retry behavior.
- Retained both story-layout alternatives in `studio/story-review.html`; selected
  the compact card after comparing Day 6 and photo-free Day 9.
- Kept Replay photos visible on short desktop screens; verified at 1280 × 600.
- Validation: 33 tests pass. Browser QA covers desktop/phone navigation, the
  nine-leg day, empty albums, an isolated leap-day draft save/reload, cover crop
  persistence, inherited GPS clearing/restoring, slow/failed photos, unavailable
  maps, and reduced-motion chapter navigation. Auth work and the pre-existing
  local route override are excluded from this release.

## 8 September 2026

### Trip Replay and intentional media choices

Commits `edd1cc5` and `280b6de` deployed successfully in GitHub Pages run
`34282041394`. Local QA passed on the real and demo journeys at 1280 × 720 and
390 × 844. Fresh production checks confirmed the real replay animation, the
demo's exact located-photo pause, the journey catalog, and a clean browser
console.

- Added a full-screen Trip Replay that follows stored day/leg order, preserves
  transport-mode styling, accumulates completed routes, and moves a live map
  marker along reviewed geometry.
- Added reviewed lead-photo context plus exact location/zoom pauses for any
  map-pinned photo, without inventing locations for the current GPS-free set.
- Added play/pause, three speeds, previous/next day, a day scrubber, keyboard
  controls, reduced-motion behavior, explore actions, and a completion state on
  both real and demo journey pages.
- Kept the six MOV originals private until a specific clip justifies a reviewed
  video pipeline, and retained intentional no-photo states without stock media.
- Added focused replay timeline, route-slicing, and reduced-motion tests; all
  21 tests pass.

### Reviewed photos, deliberate daily leads, and private GPX intake

Commit `4801801`; deployed successfully in Pages run `34277130090` after
explicit user approval. Fresh public checks confirmed the catalog, 95 visible
photos, Day 3's independent lead at `PHOTO 14 OF 14`, Day 8's no-photo state,
and clean catalog/trip browser consoles.

- Reviewed all 104 family-trip photographs for day, copy, alt text, visibility,
  privacy, and available location evidence without inventing GPS precision.
- Kept 95 photos visible and removed eight redundant/low-quality frames plus a
  private-residence exterior from generated public photo data.
- Added explicit daily album order and independent lead-photo choices, with
  accessible Studio controls and consistent story/strip/viewer behavior.
- Added private, loopback-only GPX review for bicycle and walking legs with
  order, endpoint, gap, distance, simplification, and provenance checks.
- Added GPX and content-validation fixtures and passed desktop/390 px Studio and
  trip-preview QA without browser console errors.

### Start future trips in Studio

Commit `06f3745`; deployed successfully in Pages run `34271727907` after
explicit user approval. Fresh public checks confirmed the catalog, 14 days,
104 photos, five Day 10 legs, four demo choices, and three Alpine demo photos,
with no browser warnings or errors.

- Added **+ New trip** with name/date intake, complete calendars, stable URLs,
  local drafts, editable day plans, and selected-trip previews.
- Moved journey content into reusable source JSON with independent photo and
  route outputs, a shared page template, one deterministic build, validation,
  automatic asset cache hashes, and CI tests/builds before Pages publication.
- Kept draft content and edits out of Git/public bundles; photo import now selects
  a journey, preserves successful output on failure, and holds GPS for review.
- Fixed stale route/photo editors, wrong-trip previews and day fields, and map
  loading clearing unsaved status. Added no-destination/no-cover states and
  placed mobile day editing before the map with preview/save feedback available.
- Added regression coverage for year/leap-day boundaries, draft exclusion,
  independent photo albums, broken IDs/ownership, and deterministic generation.

### Safe mode-aware route proposals in Studio

Commit `772d051`; deployed successfully in Pages run `34195603573`.

- Added local-network route proposals for rail, ferry, road, walking, and
  bicycle modes while keeping human control points as immutable routing anchors.
- Separated original, last-saved, manual anchor-guide, and proposed lines so an
  editor can compare them before explicitly accepting a result.
- Kept the last reviewed geometry when network data is missing, too distant,
  disconnected, or ambiguous, with the failure surfaced inside Studio.
- Added successful, ambiguous, and unavailable-network service tests without
  sending journey coordinates to an external routing provider.

## 7 September 2026

### Journey-specific route geometry pipeline

Commit `8d85fb8`; deployed successfully in Pages run `34145829874`.

- Replaced the default-trip/two-file route command with journey selection and
  committed per-journey source manifests.
- Preserved ordered stops and existing reviewed geometry while surfacing
  missing, disconnected, and near-tied network inputs as explicit warnings.
- Made shared route output deterministic and added fixture tests for ordered
  stops, disconnected networks, ambiguous networks, and fallback preservation.

### Multi-journey Studio and editable day copy

Commit `14a344e`; deployed successfully in Pages run `34144643931`.

- Added a Studio journey selector covering every real and demo journey, while
  retaining per-day selection of every route leg.
- Made route start and end pins draggable and added exact endpoint coordinate
  fields that participate in route undo/redo.
- Added a Day copy mode for editing date labels, titles, and descriptions, with
  readable source overrides in `content/day-overrides.json`.
- Removed the photo accessibility-description field from Studio.

### Route stories on hover, tap, and focus

Commit `ef3841d`; deployed successfully in Pages run `34142868328`.

- Added wide invisible route hit targets without changing their visible weight.
- Added a compact route card with day, transport mode, endpoints, and concise
  story context plus a temporary gold line/day highlight.
- Kept tap-to-select behavior and made each journal route leg a focusable button
  with the equivalent keyboard interaction.

### Collision-aware day badges

Commit `2db5eb5`; deployed successfully in Pages run `34141635678`.

- Moved day badges away from their named places and added leader lines back to
  the exact map points.
- Added placement scoring against rendered basemap labels, other day badges,
  and map edges, recalculated after map movement.
- Made overview badges smaller and shortened multi-day labels so place names
  remain readable on desktop and mobile.

### Unmistakable transport modes

Commit `63e6d2c`; deployed successfully in Pages run `34113344360`.

- Gave train, ferry, bus, gondola, walk, car, and bicycle routes distinct
  color-vision-conscious colors, widths, and line patterns.
- Matched the map legend to the rendered route grammar, including a diamond cue
  for gondolas and dash-dot cue for cars.
- Preserved orange selected-route emphasis and near-white casings while keeping
  each mode's width and pattern visible.

### Atlas catalog and stable trip page

Commit `0db2121`; deployed successfully in Pages run `34112686435`.

- Changed `/travels/` into a catalog of real journeys.
- Moved *Lakes, Rails & Rain* to the neutral, shareable
  `/travels/switzerland-italy.html` URL.
- Added data-driven journey kinds and slugs so trip pages share the same viewer
  rather than cloning application logic.
- Kept fictional sample journeys isolated at `/travels/demo.html` and retained
  the site's low-discovery metadata.
