# Next-agent handoff

## Compact catalog, trip title and photo selection · 9 September 2026

Published as `bcdca9b` in successful Pages run `34366124964`. A fresh public
load confirmed the new landing copy, compact 106 px desktop card, renamed
journey introduction, and orange photo selection with no Selected badge.
The catalog still contains only the one real trip. No browser errors.

The catalog now uses compact horizontal cover-and-text rows and a short
introduction: “Where we went.” / “The routes we took and the photos we brought
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


Read `PROJECT_STATE.md` and `PRINCIPLES.md` first.

Update `CHANGELOG.md` with every user-visible feature, content correction, or
workflow change before committing. Keep the newest entry first.

- Repo: `/Users/dg/code/travels`
- GitHub: <https://github.com/gravelcycles/travels>
- Site: <https://gravelcycles.github.io/travels/>
- Deploy `dist/` from `main` with the existing Pages workflow.
- The user wants results on GitHub or the published site, not a localhost link.
- Assume every operational flow is agent-driven. Do not ask the user to run npm,
  terminal, build, server, Git, GitHub CLI, or deployment commands. Run them,
  open any local UI the user needs, stop temporary servers, and verify the
  deployed result. The user supplies facts, files, corrections, and judgments.
- Read `JOURNEY_WORKFLOW.md` before adding a journey or changing route tooling.

## Non-auth backlog completion · 9 September 2026

Latest follow-up: the photo viewer has explicit selected-thumbnail styling and
a rounded last-photo continuation button in a fixed sidebar row. Its short
pulse is disabled for reduced motion. Replay now has distance-based leg timing
and individual leg framing, with 2.4-second rest days, about 50 seconds for
Mürren, and about 218 seconds total. Day 4's corrected bicycle/ferry geometry
uses the actual Kehrsiten landing; see the updated `ROUTE_SOURCES.md`.

Latest map correction: selected and inspected routes retain their transport
colors, using line width for emphasis. Day focus keeps other routes grey, and
the key follows the day's modes. This supersedes the historical orange-route
notes below. Commit `6754575` deployed in successful Pages run `34348023018`;
fresh public Day 6 verification passed.

W02, T19, and T23–T25 are complete. Only W01 remains unchecked in TODO. Auth
sources and the existing local route edit were preserved separately. Read the
new top section of `PROJECT_STATE.md` and the W02 reconciliation in
`UX_HANDOFF.md` for current behavior; older “Next” notes below are historical.

Planner sources live in the existing journey JSON, with durable cover IDs/focal
points and ordered Replay moments. The planner has a preview/save boundary,
checks source revisions, preserves IDs and notes through calendar changes, and
refuses to trim content-bearing dates. New legs remain provisional until route
review. Clearing inherited photo GPS uses `location: null`. EXIF dates without
a UTC offset follow the documented camera-local rule.

Validation includes 33 tests and isolated Studio save/reload, places/legs/day
reordering, cover focal-point persistence, inherited GPS clear/restore, mobile
Day 6 navigation, no-photo continuation, reduced motion, slow/failed photos,
and unavailable Replay maps. The compact and spacious story alternatives are
retained at `studio/story-review.html` (served by local Studio).

Commits `ff0587e` and `d822a39` deployed successfully in Pages run `34331092072`
after user approval. Fresh public checks verified the catalog cover, mobile
Replay, Day 6 exploration, the 95-photo grouped album, four demo choices, and
no trip console errors. Temporary QA drafts remained outside the repository.

## Replay and media decisions · 8 September 2026

T15–T17 are complete locally. The media decision is to keep the six held MOV
files private unless a specific clip later earns a fully reviewed video
pipeline; Days 9, 11, and 14 keep deliberate empty states without third-party
filler (Day 8 is also publicly empty after privacy review). Trip Replay is now
shared by real and demo pages and animates the stored leg order with the
existing mode grammar, accumulated routes, a moving marker, reviewed lead
photos, and location/zoom pauses for any future map-pinned photo. Controls cover
play/pause, 0.5×/1×/2× speed, day stepping/scrubbing, keyboard operation,
reduced motion, day exploration, and replay completion. Focused route slicing
and timeline tests bring the suite to 21 passing tests. Commits `edd1cc5` and
`280b6de` contain the implementation and verification record; both deployed
successfully in GitHub Pages run `34282041394`. Fresh public checks confirmed
the real replay animation, the demo's exact located-photo pause, the journey
catalog, and a clean browser console.

## New-trip pass · 8 September 2026

Commit `06f3745`; deployed successfully in Pages run `34271727907` after
explicit user approval. Fresh public checks confirmed the catalog, 14 days,
104 photos, five Day 10 legs, four demo choices, and three Alpine demo photos,
with no browser warnings or errors.

T11 now provides a source/build pipeline and Studio **+ New trip**. Read the new
source structure and draft promotion instructions in `JOURNEY_WORKFLOW.md`.
Never hand-edit generated journey/photo/geometry bundles. Run `npm run build`
and `npm test`; Pages CI also does this. Local-only draft creation/save/preview
was checked with a four-day 2027–2028 fixture; it is removed after QA.

Prioritize T19 (trip/date/place/leg editing) next for the user's future-trip goal.
T10 is now complete. T20–T22 record related fixes; T23–T25 track inherited GPS
clearing, stale asynchronous proposals, and naive EXIF timestamp handling.
Validation: 12 tests passed in the working tree and a separate release copy that
uses the committed route overrides. Studio create/edit/save/reload, draft preview,
empty routes, and 390 px new-trip/day-edit views passed. The existing 14-day,
104-photo trip, five-leg Day 10, catalog, and four demo choices (including three
Alpine demo photos) passed browser checks without console errors. A semantic
comparison confirmed all five original stories/places/legs were preserved.

The pre-existing route override is user work and must be preserved separately.
`UX_HANDOFF.md` appeared during this pass from other work; it is not part of this
implementation or commit.

## Photo/GPX pass · 8 September 2026

T10, T12, and T13 are complete in commit `4801801`, deployed successfully in
Pages run `34277130090` after explicit user approval. Fresh public checks
confirmed the catalog, 95 visible photos, Day 3's independent lead at
`PHOTO 14 OF 14`, Day 8's no-photo state, and clean catalog/trip browser
consoles. Studio can review a private GPX for a bicycle/walking leg without
retaining the upload, validates direction, endpoints, gaps, and distance,
simplifies in meters, and saves only explicitly accepted `[lng, lat]` geometry
with non-identifying provenance. A bicycle GPX fixture covers duplicates,
multiple sections, simplification, reversed order, large gaps, and
private-source handling.

All 104 family photos now have reviewed day assignments, captions,
descriptions, alt text, visibility, privacy, and an explicit no-GPS location
status. Ninety-five remain visible; eight redundant/low-quality frames and one
private-residence exterior are excluded from generated public photo data. The
source manifest and review records still account for all 104.

Daily photo order is explicit in day overrides, with ten deliberate leads.
Studio exposes keyboard-accessible earlier/later/lead buttons. A lead is
independent of chronological album order: local QA confirmed Day 3's last
visible photo as the story lead and `PHOTO 14 OF 14` when opened. Desktop and
390 px Studio/preview checks passed without browser warnings or errors. The
pre-existing `family-luzern-kehrsiten-bike` route override remains user work and
must not be included in this pass's commit or deployment.

## Current pass

T03 is complete locally: `/travels/` is now the real-journey catalog and the
current family trip has the neutral detail URL
`/travels/switzerland-italy.html`. Journey `kind`, `slug`, and page data select
content while keeping one shared viewer implementation. The demo remains at
`/travels/demo.html`. The user explicitly does not want their surname used in
URLs, paths, or copy. Commit `0db2121` deployed successfully in Pages run
`34112686435`; cache-fresh checks confirmed the catalog, the stable 14-day trip
page with 104 photos, low-discovery metadata, and a clean browser console.

T04 is complete locally: all seven modes now have their own high-contrast color,
width, and solid/dash/dot/diamond cue. The map and HTML legend share the same
visual grammar; selected routes remain orange and use the mode's pattern and
width over a stronger near-white casing. Commit `63e6d2c` deployed successfully
in Pages run `34113344360`; a cache-fresh Day 10 check confirmed all five mixed
legs, the updated legend, and a clean browser console.

T05 is complete locally: day badges now score several offset positions against
rendered basemap text, other badges, and map edges; a leader line preserves the
exact place. Placement refreshes after map movement, badges shrink at overview
zoom, and nonconsecutive groups use compact labels such as `01 +3`. Commit
`2db5eb5` deployed successfully in Pages run `34141635678`; a cache-fresh
public check confirmed all ten leader-linked badge groups and a clean console.

T07 is complete locally: every main-map route has a 22 px or wider invisible hit
line. Hover and tap show a compact day/mode/endpoints/story card, with a gold
feature-state highlight and matching day-row cue. Tap still selects the day;
keyboard focus on semantic route-leg buttons provides the same information and
highlight, and Escape or the close button dismisses a pinned card. Commit
`ef3841d` deployed successfully in Pages run `34142868328`; a cache-fresh public
keyboard check confirmed the route card, map, linked day cue, and clean console.

T18 is complete locally: Studio has a journey selector for all real/demo trips,
a dedicated Day copy mode for date labels, titles, and descriptions, and route
endpoint editing by draggable first/last pins or exact coordinate fields. The
existing per-day route list handles every leg (Day 10 exposes all five), endpoint
changes use route undo/redo, and the photo accessibility-description field was
removed. Day overrides live in `content/day-overrides.json` and the generated
asset applies day/photo/route overrides to real and demo journeys. Commit
`14a344e` deployed successfully in Pages run `34144643931`; cache-fresh checks
confirmed the 14-day/104-photo real trip, the demo selector, and clean browser
consoles.

T08 is complete locally: `scripts/build-route-geometry.mjs` now selects a
journey ID and reads `content/route-sources/<journey-id>.json`. It updates only
manifested segments, preserves reviewed geometry on missing/disconnected input,
warns on near-tied network components, retains ordered stops as waypoints, and
writes deterministically sorted static output. Four route fixtures cover
disconnection, ambiguity/determinism, ordered stops, and fallback preservation.
Commit `8d85fb8` deployed successfully in Pages run `34145829874`; a
cache-fresh check confirmed the full 14-day/104-photo trip and Day 10 content
with a clean browser console.

T09 is complete locally: Studio treats control points as durable anchors and
offers local-network proposals for train/ferry/road/walk/bicycle modes. It draws
original, saved, anchor-guide, and proposed lines separately and requires an
explicit accept before changing the reviewed geometry. Missing, distant,
disconnected, or ambiguous networks keep that geometry and surface the reason.
Seven route tests now cover the base pipeline plus successful, unsafe, and
unavailable Studio proposals. Local Studio/API and 390 px checks passed with no
browser errors; no external router receives precise journey coordinates. Commit
`772d051` deployed successfully in Pages run `34195603573`; a cache-fresh public
check confirmed the 14-day/104-photo trip and route interactions with a clean
browser console.

Locally completed on 7 September: a day-scoped full-screen photo viewer and a
loopback-only Atlas Studio for exact photo positions/text and manual route
redrawing. The viewer keeps the main story and side map synchronized as its day
changes and zooms to stored photo coordinates. The Studio provides draggable
photo pins; caption, description, exact-place, day, zoom, and visibility fields;
plus route control points, smoothing, undo/redo, reset, and deletion.

Also completed on 7 September: T01 corrected Day 1 to the single 68 km Zürich
Flughafen → Luzern arrival leg. The obsolete reverse pickup segment and its
generated geometry were removed; title, destination, story, trip summary,
layering, and close-up bounds now agree. Desktop, 390 px mobile, and demo smoke
checks passed locally without browser warnings or errors. Commit `a72b21b`
deployed successfully in Pages run `34089946949`; a cache-fresh public check at
`https://gravelcycles.github.io/travels/?v=a72b21b` confirmed the corrected
summary, route, and prose without browser errors.

T02 is also complete locally. Day 10 now uses the timetable-matched SR110
Como–Varenna service (12:15–13:15, six intermediate calls) and direct run 809
Dervio–Bellagio (17:17–17:50). The first ferry follows OSM relation `18734598`;
the second uses the direct open-water path between the exact ferry terminals
because OSM has no route relation for run 809. The five-leg close-up is 95 km
and passed desktop, 390 px mobile, and demo smoke checks without browser
warnings or errors. Commit `f5bb7ff` deployed successfully in Pages run
`34091683711`; a cache-fresh public check at
`https://gravelcycles.github.io/travels/?v=f5bb7ff` confirmed both corrected
ferry legs, all five Day 10 route entries, close-up framing, and a clean browser
console.

Also completed locally on 7 September: Studio photo placement now captures the
map's current zoom whenever a location is clicked or a pin drag finishes, and
the public viewer honors the saved 2–20 range. The main atlas, photo viewer,
and Studio now use OpenFreeMap Liberty with stronger water, forest, park,
shaded-relief, and road treatment. OpenTopoMap was evaluated but not selected:
its raster tiles would prevent place labels from remaining independently above
the atlas route layers. Desktop overview/Day 10, 390 px Day 10, Studio, viewer,
and demo checks passed locally with no browser warnings or errors. Commit
`af65787` deployed successfully in Pages run `34094449848`; a cache-fresh
public overview check at `https://gravelcycles.github.io/travels/?v=af65787`
confirmed the new terrain treatment, attribution, route layering, and a clean
browser console.

The follow-up route-contrast adjustment is complete locally: terrain and
land-cover colors are slightly softer, unselected journey lines are brighter
blue and wider, selected lines are brighter orange, and both receive stronger
near-white casings. The same treatment is used in Atlas Studio. Desktop
overview/Day 10, 390 px Day 10, Studio route mode, and demo checks passed with
no browser warnings or errors. Commit `e33a6dc` deployed successfully in Pages
run `34095170234`; a cache-fresh public overview check at
`https://gravelcycles.github.io/travels/?v=e33a6dc` confirmed the stronger route
hierarchy and a clean browser console.

Run `npm run studio` and open `http://127.0.0.1:4173/studio/`. Saves update
`content/photo-overrides.json`, `content/route-overrides.json`,
`content/day-overrides.json`, and generated `dist/assets/content-overrides.js`;
backups under `build/studio-backups/` are ignored. Photo and day sources start
empty; the route source may contain reviewed local edits. Do not publish the
Studio itself as a server—the public site consumes only the static generated
asset.

Current Studio route edits preserve control-point anchors separately from the
accepted geometry. Network proposals use ignored local extracts configured by
the journey manifest; absent/unsafe inputs retain the reviewed line. Road,
walking, and bicycle extracts for the current trip are not installed, and
gondolas remain manual. GPX import is still desired for recorded bicycle and
walking days.

The user explicitly approved public photo hosting. The public GitHub Release
`trip-photos-v1` now contains all 356 WebP derivatives (176,851,380 bytes), and
representative 480, 1280, and 2560 px direct URLs were verified before the site
push. The manifest uses the immutable tag rather than a mutable `/latest/` URL.

## Confirmed product direction

- `/travels/` is an atlas/catalog of every real journey.
- `/travels/switzerland-italy.html` is the dedicated page for the
  current family trip. Demo journeys remain separate from the real atlas.
- Hovering a route segment should reveal what happened there: day, mode, leg,
  and concise story context. Provide an equivalent tap/focus interaction.
- Test a more topographic, higher-contrast basemap that clearly distinguishes
  water, land, forest, and mountain terrain without overwhelming the story.
- Make every transit mode substantially easier to distinguish with redundant
  color, dash, width, or casing—not color alone.
- Day dots still cover place names. Fix marker placement/collision/visibility;
  putting line layers below basemap labels did not solve DOM markers.
- Trip Replay remains the preferred future “fun” feature: animate legs by day
  and pause at located photos.
- Studio's confirmed expansion—journey/route selection, editable endpoints and
  day copy, and removal of its accessibility-description field—is implemented
  as T18. Continue to preserve stable IDs and reviewed overrides.

## Known content corrections

No remaining P0 content corrections are recorded.

## Next

T19 is the next priority for future-trip planning. T23–T25 remain the next
confirmed Studio/photo-import bugs after that.
Continue with the independent, acceptance-scoped work items in `TODO.md` and
update the handoff and changelog whenever an item lands.

## Basemap decision

Keep the checked-in OpenFreeMap Liberty treatment unless later testing finds a
specific readability or service problem. Its vector layers let route lines sit
below place labels while water, woodland, roads, and low-zoom relief remain
distinct. OpenTopoMap's terrain is strong but its raster labels cannot be
separated from the terrain tile; MapTiler would add an account/key requirement,
and swisstopo cannot cover the Italian part of the trip alone.

## Acceptance checks

- Fresh public load finishes framed on the complete trip after 2.5 seconds.
- Day 4 and Day 10 close-ups fit completely, including the bottom edge.
- Other routes remain grey during day focus; orange lines stay on top.
- Both side panels visibly scroll at short desktop heights and on mobile.
- `/travels/` contains the real-journey catalog,
  `/travels/switzerland-italy.html` contains this
  trip, and `/travels/demo.html` contains only demos.
- Line patterns are easy to distinguish and match the legend.
- City labels remain legible above route lines.
- Day focus shows working previous/next controls at desktop and phone widths.
- Only nearby images hydrate; a large-screen viewer selects the 2560 px source.
- The full-screen viewer stays within one day for photo arrows, while day arrows
  change both its photo set and the main map/story selection.
- Atlas Studio changes survive reload after **Save locally**, and route
  undo/redo remains usable after adding, dragging, or deleting a control point.
- Test the deployed URLs with a cache-fresh query after the Pages workflow
  succeeds. Bump the current static asset version token when assets change.
