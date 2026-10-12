# Current workstreams

Status checkpoint reconciled: **11 October 2026**. Start with
[AGENTS.md](AGENTS.md) and [OWNER_DECISIONS.md](docs/OWNER_DECISIONS.md), then
read the relevant workstream here before resuming it.
This reconciles Git branches, stashes, ignored local prototypes, project docs,
and the relevant Travels tasks. It records unfinished work without promoting it
to the public site. [TODO.md](TODO.md) remains the backlog;
[docs/FEATURES.md](docs/FEATURES.md) describes implemented capabilities;
[docs/FRAMEWORK.md](docs/FRAMEWORK.md) defines the shared-code contract.

Maintain this checkpoint when work or authorization changes. Follow the
[live-documentation procedure](docs/OWNER_DECISIONS.md#record-the-next-correction-before-closing-the-task):
capture accepted corrections in their canonical home during the task; if work
is unfinished, record the exact next action, source/branch state and missing
checks here. A completed audit does not end this duty. New or resumed tasks
must read current files and reconcile any later corrections before continuing.

## Studio photo navigation and save feedback — 12 October 2026

Data-safety follow-up authorized: “ensure there's no data loss paths here.”
Implemented on `codex/studio-photo-data-safety` in the isolated release checkout:
raw photo input recovery/validation, stable selection while typing, guarded save/
restore/discard responses, detached autosave snapshots, duplicate-tab stream
ownership and exact disk acknowledgements. Real-handler tests cover unfinished
numbers, switching/reload, in-flight input and delayed recovery; real API tests
cover independent photo fields, conflict choices, lost-response retries, corrupt
draft reads and build rollback. All **613 tests** and the production build pass.
Browser checks cover the reference, Alpine demo and a populated independent city
draft, including reload before blur, search edits, offline save/restart/retry,
and discard/archive/restore of unfinished input. The task patch is applied to
the primary checkout without changing real photo sources. Next: integrate latest
main, rerun required checks, deploy and verify Pages. Existing user tabs await
safe refresh; automatic browser approval temporarily failed with a rate-limit
error, and permission to inspect/preserve/reload them is pending.

Implemented under O11's Studio follow-up: filtered left/right browsing, labeled
per-photo local-save status, and stable thumbnail targets for first-click
switching after editing. The primary local editor is updated and running.
Reference and Alpine demo browser checks cover caption/coordinate edits,
single-click switching, keyboard boundaries and cursor keys inside fields; an
independently populated city draft covers notes, switching, reload recovery and
saving. Save failure/retry and newer in-flight edits use the actual save handler
in automated regressions. All **600 tests** pass against current main; the
production build produces no public-output changes. Only Studio, focused tests
and current guidance belong to `codex/studio-photo-editing` in
`/private/tmp/travels-studio-photo-editing-release`. Real photo edits and the
primary checkout's other work remain separate. Source release `260aa04` passed
[Pages run 38215755921](https://github.com/gravelcycles/travels/actions/runs/38215755921).
A fresh public reference page matches the build byte-for-byte; localhost serves
the tested editing helper. Studio remains local-only. That initial delivery is
complete; the data-safety follow-up above is the active work.


## Opening route trace — 12 October 2026

Authorized: a three-second full-route trace on initial desktop/phone entry.
O06 and [the journey contract](JOURNEY_WORKFLOW.md#opening-route-trace) own the
behavior. Implementation is isolated in `build/opening-route-trace` on
`codex/opening-route-trace-20261012`, based on current main `0cd2d3b`.
The shared opening action requests the trace when the map is ready; separate
legs retain itinerary order and mode styling. Existing input/navigation cancels;
reduced motion and route-less drafts retain the immediate overview. No content
changes or full-trip Replay activation. Integrated main through `c3c1083`;
all **592 tests** and the production build pass. Browser checks cover reference, Heading East, Alpine demo and an
independent draft, desktop, 320/390px phones and 844px landscape, completion
and day-navigation interruption. Private images were excluded from map QA.
Deployed as `33cac36` through successful [Pages run 38215200078](https://github.com/gravelcycles/travels/actions/runs/38215200078).
Fresh public reference/Heading East/Florence/demo pages and the three changed
runtime assets match the tested build byte-for-byte; the live demo’s phone
trace also passed browser verification. No implementation or delivery work
remains. The primary checkout’s concurrent edits are untouched.

## Mobile photo return-screen correction — 12 October 2026

Owner follow-up: pulling away does not return to the last screen; change the
fullscreen top-left label to “Back”. This supersedes the first gesture release’s
unconditional map exit. O08 owns one-level return (including the presenting grid)
and matching browser history. Implemented in `/private/tmp/travels-mobile-dismiss`
on `codex/mobile-photo-dismiss`, based on main `0cd2d3b`: distinct grid/photo
entries preserve the source screen, collection, selection and grid scroll;
pending Back requests cannot skip a screen. Both shared labels now say Back.
All **587 tests** and the production build pass. Browser checks on Heading East,
Switzerland–Italy, Alpine demo and an independently populated draft verify
320/390px portrait and 844px landscape, photo → source grid → map, grid scroll,
Back/Forward and direct photo → story. Fixtures use labelled synthetic photos.
Integrated latest main and deployed as `9143387` through successful
[Pages run 38214863703](https://github.com/gravelcycles/travels/actions/runs/38214863703).
Fresh public Heading East/reference/Florence/demo pages and mobile viewer assets
match the tested build byte-for-byte. No implementation or delivery work remains.

## Mobile photo pull-to-dismiss — 12 October 2026

Authorized: let a mobile user “pull the photo away” to exit fullscreen, like
iPhone Photos. O08 and PHOTO_WORKFLOW own the shared behavior. Implementation
uses a downward pull on an unzoomed still photo, short/cancelled snap-back,
location-first collapse and the existing map/history exit. Work is isolated in
`/private/tmp/travels-mobile-dismiss` on `codex/mobile-photo-dismiss`, based on
current remote main `b934c07`; the primary checkout's other edits are untouched.
Implemented in shared mobile code/CSS. All **584 tests** and the production
build pass, including cancellation, pinch takeover, native-video/grid exclusions,
reduced motion, pending-animation interruption, exact same-event camera return
and cross-event/Forward history. Browser checks on Heading East, Switzerland–Italy,
Alpine demo and an independently populated draft verify 320/390px portrait,
844px landscape, portrait/landscape images, short-pull snap-back, dismissal,
location collapse, zoomed pan, cross-event return and retained desktop behavior.
Browser fixtures used labelled synthetic photos; no content/media was changed.
Integrated latest main and deployed as `7df08e8` through successful
[Pages run 38212316035](https://github.com/gravelcycles/travels/actions/runs/38212316035).
Fresh public Heading East/reference/Florence/demo HTML and both changed runtime
assets match the tested build byte-for-byte. No implementation or delivery work
remained at that checkpoint. The later return-screen correction above supersedes
its map-only exit behavior.

## Desktop photo navigation — 11 October 2026

Authorized follow-up: desktop users get stuck inside map clusters and cannot
reach the city's other photographs or full trip. O03 and PHOTO_WORKFLOW own the
correction. Implemented ordinary sidebar/fullscreen trip browsing while keeping
map groups geographical, local event reels, explicit Places scope and the
existing photo-entry boundary. Comments dismissal also retains the current city
and selected image. Isolated branch `codex/desktop-photo-navigation`.

Validation: all **577 tests** and the production build pass. Browser checks cover
Heading East's real six-photo Berlin cluster → other city photos → Prague,
fullscreen/Back with the current image, Switzerland–Italy's day boundary,
a mixed photo/video demo and its cross-day Comments return, and an independent
populated city draft with an empty middle event. The draft retains selection
through desktop/phone resizing; empty and explicit-collection behavior also have
regression coverage. Integrated current main and deployed as `d09bc72` via
[Pages run 38166550947](https://github.com/gravelcycles/travels/actions/runs/38166550947).
The run succeeded; fresh public HTML for all four trip/demo pages and the three
changed runtime assets match the tested build byte-for-byte. No desktop photo
implementation or delivery work remains. No trip content or media changed.

## Trip comment notifications — 11 October 2026

Implemented: photo Comments actions show red numbered unread badges, then plain
totals; journey-scoped local read IDs; top-right newest-comments feed across the
whole trip. O17 and [the conversation contract](docs/PLACES_AND_COMMENTS.md#comment-notifications)
own the behavior. Shared indexed metadata/feed endpoints, bounded pagination,
30-second caches and request coalescing avoid per-photo count requests. Read
membership follows visible rows and survives reload/delete/restore; auth clears
private memory/DOM and ignores late responses.

SQLite, client and UI regressions cover pagination, storage, privacy, cache races,
notification history ordering and filtered-photo entry. Browser fixtures verify
reference, demo, independent city draft and Heading East event models on desktop
and phone: a comment beyond the first 50, 320/390px layout, reload persistence,
red unread → plain total, and revealing a hidden target stop. Integrated current
main's mobile, filters, arrival, intro and copy changes; all **570 tests**, the
production build and actual Worker runtime pass. Migration 0002 is applied;
Worker version `1ac1be5b-9646-4290-be40-1c3f8a331e75` serves both endpoints. Signed
read-only summary/feed checks passed for every published trip, including
anonymous/foreign-origin rejection. Pages release `177317e` succeeded in
[run 38152000837](https://github.com/gravelcycles/travels/actions/runs/38152000837);
fresh public trip/demo HTML and notification assets match the tested build.
No notification implementation or deployment work remains. The release checkout
is `build/comment-notifications-release`; the primary checkout's concurrent
working edits remain intact and must be reconciled from current main before reuse.

## Mobile map return and camera roll — 11 October 2026

Authorized by the owner's mobile issue report: keep the previous map zoom when
closing a photo, browse all photos like a camera roll, clearer left/right arrows,
and city swiping. O08 and PHOTO_WORKFLOW own the current contract; ordinary phone
browsing crosses event albums, while explicit Places collections retain scope.
Implemented in shared app/mobile code and the journey template: exact same-event
map-camera return, continuous photo order, clearer arrows, event jumps and a
swipeable city/day bar. Explicit collections keep their scope. Grid scrolling is
confined to the grid so fullscreen headers/footers stay at the viewport edges.

Validation: all 539 tests and the production build pass. Browser checks cover
Heading East, Switzerland–Italy, the Alpine demo, an empty fresh city draft and
an independently populated city draft. Verified cross-event arrows/photo swipes,
city-bar swipes, empty-event skipping, unchanged marker positions after manual
map movement and photo dismissal, event grid selection, Back/Forward, location
staying closed, 320/390 px portrait and landscape, and retained desktop selection.
Integrated current sanitized main, preserving full-trip Replay disablement and
the newer opening/day filters. Deployed as `497cd0b` via successful
[Pages run 38151034258](https://github.com/gravelcycles/travels/actions/runs/38151034258).
Fresh public HTML for all four journey/demo pages and `app.js`, `mobile-ux.js`
and `mobile.css` matched the tested release byte-for-byte. No mobile
implementation or delivery work remains; no media/content changed in this fix.

## Opening action stays visible — 11 October 2026

The owner approved a persistent opening action after reporting that long copy
hid it on first load. [O06](docs/OWNER_DECISIONS.md) and the
[journey workflow](JOURNEY_WORKFLOW.md#start-small-as-a-local-draft) own the
shared contract. Implementation in `codex/visible-opening-action` separates the
full scrollable introduction from the bottom action row; phones scroll the
photo with the text, while desktop retains its full-height cover. Traveler
content and map/list entry behavior remain intact.

Validation: all 570 tests and the production build pass. Browser checks cover
Heading East, Switzerland–Italy, the Nine to Como demo and an empty then
independently populated city draft. The button remains visible at 320/390px,
short desktop and landscape sizes, including a 9,389-character introduction
and 200% root text. Keyboard and pointer scrolling reach the final line without
covering it; Tab reaches the action. Map entry still shows the whole journey,
and the empty draft enters its stop list. Local photo mode used existing blur
previews because protected derivatives are outside this isolated checkout.
The shared deep-link bypass regression passes. Integrated current main and
deployed as `a88dddc` via successful
[Pages run 38158941309](https://github.com/gravelcycles/travels/actions/runs/38158941309).
Fresh public Heading East/reference/demo HTML and `app.js`, `styles.css` and
`mobile.css` match the tested build byte-for-byte. An additional live browser
check was blocked by automatic approval review when the page tried to access
the private-photo Worker; the local layout checks and public asset verification
are complete. No implementation or deployment work remains.

## Opening screen and Heading East description — 11 October 2026

Authorized: one Explore the journey button opening the whole-trip map; remove
the secondary map action. Replace Heading East's subtitle with the owner's exact
paragraph beginning “After a summer in Switzerland”. Current guidance is O06
and [the trip record](docs/HEADING_EAST.md). Implemented in `f488be8` and deployed as `841bc0f`; concurrent edits remain
in the original checkout.
Implementation and shared introduction regressions pass all **524 tests** and
the production build. Heading East desktop/390px checks confirm the exact copy,
one button and whole-trip map entry; reference/demo/populated-draft checks
cover inheritance. [Pages run 38150354580](https://github.com/gravelcycles/travels/actions/runs/38150354580)
succeeded. Fresh public Heading East HTML and the opening runtime match the
tested release byte-for-byte. No implementation or delivery work remains.

## Heading East day visibility — 11 October 2026

Authorized: synchronized Past / Future locked in / Future TBD toggles in the
Days section and full-trip view; [scope and acceptance](docs/HEADING_EAST.md#day-visibility-filters--11-october-2026).
Implemented in isolated `codex/day-status-filters`, preserving unrelated mobile
and service work. All 523 integration tests and build pass. Browser checks cover the real
Heading East groups, reference/demo defaults, and independently populated city
draft; synchronized desktop/390px controls, 320px and landscape, filtered
navigation and complete incoming routes. Private images were omitted in local
map QA. Current main, including Replay disablement and anonymous credential
documentation, is integrated. The merged browser check confirms both filters
and absent full-trip Replay. Deployed as `e58f939` via successful
[Pages run 38149951215](https://github.com/gravelcycles/travels/actions/runs/38149951215).
Fresh public Heading East HTML and all five changed browser assets match the
release byte-for-byte. Later owner follow-up requires a compact horizontal row
in both locations. Layout and current guidance updated on the same branch.
Desktop and 320/390px browser checks confirm one row and synchronized controls;
all 524 tests and the production build pass. Integrated current main and deployed
as `6073b0c` via successful
[Pages run 38150899171](https://github.com/gravelcycles/travels/actions/runs/38150899171).
Fresh public Heading East HTML and shared CSS match the tested release
byte-for-byte. No implementation or delivery work remains.

## Full-trip Replay disabled — 11 October 2026

Authorized: disable the redundant full-trip animation across the shared viewer;
preserve arrival/city playback and chapter source data. [O09](docs/OWNER_DECISIONS.md)
supersedes earlier Replay availability/seeking and prototype adoption guidance.
Completed in `edb415f`, integrated and deployed as `b450cde`:
entry/resume actions removed, player/history guarded and Studio editor hidden.
Validation: all **520 tests** and the production build pass, including
reference/demo/independently populated city-draft arrival preservation and stale
history checks. Browser checks confirmed the Alpine multi-leg arrival on desktop
and the reference phone map/arrival controls at 390 px; the reference used the
documented local photo mode (private media was not copied into this checkout).
The independently populated city draft also passed browser entry/arrival checks.
[Pages run 38149118451](https://github.com/gravelcycles/travels/actions/runs/38149118451)
succeeded. Fresh public HTML for all three real journeys and the demo, plus
`app.js` and `mobile-ux.js`, match the tested release byte-for-byte. No Replay
implementation or delivery work remains. Concurrent checkout edits were preserved.

## Café August outside-only correction — 11 October 2026

Content correction complete: Café August’s gallery contains three visually
verified outdoor photographs, including the credited replacement terrace image.
The other 19 places and personal photo content are unchanged. All 518 tests,
the production build and local gallery checks pass; no content work remains.
The scoped rule and validation live in [Heading East's image record](docs/HEADING_EAST.md#place-image-refresh--11-october-2026).

## Heading East second photo batch — 11 October 2026

Authorized: process `photos/euro-eastbound-2/`, add new photos to Heading East,
and report filenames without GPS. The owner assigned the nine 28–30 August
photos to Luzern and all six 30 September photos to Köln while retaining their
actual timestamps. Intake has 78 files, two exact repeats, 76 new photos and
75 new photos without GPS. See
[the intake record](docs/HEADING_EAST.md#second-photo-batch--11-october-2026)
and [location checklist](docs/HEADING_EAST_PHOTO_LOCATIONS_BATCH_2.md).

Completed and deployed from `codex/eastbound-batch-two`: all 228 WebP derivatives
(117,715,732 bytes) were uploaded sequentially and downloaded for checksum
verification. The owner explicitly approved this batch's private Cloudflare
upload and trip publication on 11 October. All 518 tests and the production
build pass; the private service and Pages are deployed, and a fresh public page
shows 120 photos and loads new protected images. The import is integrated into
the main checkout with all pre-existing pin and documentation edits preserved
and left uncommitted. No shared runtime changed.

Later on 11 October the owner completed Studio location review and requested
publication. All 119 visible photos now have valid pins; `IMG_3388.HEIC` is in
recoverable Trash. This resolves all 75 second-batch and five first-batch missing
locations. The saved pin/label/frame edits and generated comments eligibility
index are published in `f30c96f`. All 518 tests, the production build and
Worker runtime checks passed. Pages succeeded; fresh public assets match the
release and contain all 119 located photos. The updated private Worker was
deployed before Pages and still rejects anonymous access. See the [current photo review](docs/HEADING_EAST.md#owner-reviewed-photo-locations--11-october-2026).

## UX flow review implementation — 11 October 2026

Later hover correction: the owner reported the selected sidebar photo's blue
background flashing white on hover. The image button now overrides the general
toolbar hover fill, retaining the blue frame. All 520 tests and the production
build pass. Browser checks cover Heading East, the reference, Alpine demo and an
independently populated city draft (portrait/landscape, pointer entry/exit, visible
keyboard focus and fullscreen). The correction follows the normal Pages delivery
and fresh-public-page checks. See O03 and the photo workflow.

The owner authorized all U01–U16 findings and direct one-click fullscreen, then
clarified the boundary later on 11 October: map circle bubbles and right-hand
reel thumbnails select in the existing sidebar/card; the large top-right
selected/lead image opens fullscreen. Old map popups close before switching
days/stops. Existing phone grid/swipe and album/linked Places entry remain.
Three parallel workstreams cover viewer/navigation, Places/conversations and
Studio; the integration also simplifies sharing readiness. Existing floated
populated conversations, exact image reveal/arrival timing, sidebar structure,
private media and recovery remain intact. The later clarification supersedes
the initial all-photo-fullscreen interpretation, not ordinary selection in the
existing sidebar. See O03/O07 for the operative boundary.
Initial UX implementation validation (before this later clarification): **500 tests passed**, production build successful; desktop/phone and
independently populated city-draft browser checks completed. See [the audit and delivery record](docs/UX_REVIEW_2026-10-11.md).

Later photo-boundary and popup correction validation: **518 tests passed** and
production build succeeded. Desktop browser checks covered reel/map selection,
large-image fullscreen and dismissing an open Places cluster on day change.
Phone checks covered compact-card selection, fullscreen navigation and returning
to the current photo. Regression coverage includes the reference, a demo and an
independently populated fresh draft, pending hover/keyboard focus, rapid Places
camera work and Comments/Back collection retention.

## Atlas continuity and October corrections — 11 October 2026

The [continuity audit](docs/ATLAS_CONTINUITY_AUDIT_2026-10-11.md) reconciles
available owner corrections with the current docs. Mandatory startup guidance,
the owner-decision/supersession record and a populated-new-atlas acceptance
checklist replace reliance on historical handoffs. Current quickstarts now agree
on blank photo copy, explicit photo/place links, the existing photo sidebar,
map-only Replay, compact travel details, Trash and private media publication.

The owner's later 11 October clarification makes ongoing documentation upkeep
a standing priority (O16). AGENTS and every reusable prompt require the same
read/update/check loop. The journey and deployment workflows now place current
doc updates before publication. The latest photo-entry correction remains in
O03/O07; Heading East's exact venue images and bakery-counter follow-up remain
in its scoped [image record](docs/HEADING_EAST.md#place-image-refresh--11-october-2026).

Already delivered runtime corrections through `a69515f`: restored and enlarged
clickable sidebar photos with a stable-height frame; stable location-based map
bubbles; blank photo labels; removal of automatic nearby-place associations;
and floating photo comments/place reviews with immediate opening and cached reads.
These later decisions supersede incompatible behavior in the preserved prototypes
below. The documentation audit itself changes no trip content or runtime.

## Day/stop travel camera correction — 11 October 2026

Accepted: replace awkward zooming between days/stops and keep the moving train
position visible, especially on north–south routes. Scope is ordinary stop
navigation; full-trip Replay remains disabled. See O09 and the arrival workflow.
Implemented on `codex/place-zoom-20261011` in
`/private/tmp/travels-place-zoom-release`, integrated onto sanitized main:
one route ease, single-applied padding, resize-before-fit, measured card/label
clearance, unobstructed north–south endpoint labels, temporarily hidden
signposts and guarded late route redraws. Full-trip Replay remains disabled.
All **544 tests** and the production build pass. Browser comparisons cover the
same north–south leg on desktop and 390/320 px phones, landscape, the wide Alpine
demo route, reference multi-leg routes and an independent populated city draft.
Skip/rapid navigation and ordinary timed playback were checked; the final phone
arrival shows the departing circle clear of labels without false map errors.
Deployed as `ad55da8`, including the latest opening, day filters, mobile
camera roll and city stories. [Pages run 38151311374](https://github.com/gravelcycles/travels/actions/runs/38151311374)
succeeded. Fresh public target/reference/demo HTML and all three changed runtime
assets match the tested build byte-for-byte. Desktop/phone visual checks used
the local production build; automatic approval review blocked the live browser
auth redirect, so public verification used HTTP without private-photo access.
No implementation or deployment work remains; synthetic fixtures stay local.

## Arrival → city release — 10 October 2026

The owner approved the locally reviewed arrival experience for deployment.
The original two-stage camera preparation is superseded by the 11 October
correction above. Playback traces the route over 1.5 seconds with a plain orange
tracking circle, pauses for 250 ms and settles on the destination. City framing fits nearby
photos (city limits plus five miles) and marked places. Existing trip content
and saved places are retained. Synthetic photo fixtures remain ignored/local.
See [arrival behavior and checks](docs/ARRIVAL_CITY_DEMO.md).

## Four implemented workstreams — 8 October 2026

The owner requested four parallel implementation agents after reviewing the demos.
All four are now combined in this release. Original branches remain local.

| Workstream | Local branch / checkpoint | Delivered behavior |
| --- | --- | --- |
| Places and photo conversations | `codex/places-community-20261008` · `f26ba19` | The shipped Places UI retains curated facts/group reviews. Photo conversations now use signed remembered visitor identities, shared D1 storage, own editing/deletion/Undo, retry-safe posting, pagination and separate owner moderation/export. |
| Batch photo editing | `codex/batch-editing-20261008` · `f5d3019` | Studio Photos → Select multiple opens a contact sheet with search/day/trash filters, outside-filter selection counts, day assignment, album-start ordering, Trash/Restore and guarded Undo. Existing draft/save/recovery is reused. |
| Private video | `codex/private-video-20261008` · `2074837`, `97d1198` | Studio imports bounded MOV/MP4/WebM clips, creates stripped MP4/poster derivatives, previews locally, and supports authenticated native seeking. Explicit publishing verifies hashes and checks a conservative storage ceiling. Original held family clips remain unpublished. Private speech transcripts/captions remain deferred. |
| Ready to share | `codex/ready-to-share-20261008` · `7cf6ee9` | Studio checks the actual draft against saved sources, identifies asset/validation blockers, links to editors and produces a revision-bound publishing handoff. Blank captions/stories are valid. The panel reports the public version as unverified until external deployment checks. |

Integration: `codex/workstreams-integration-20261008`, based on family release
`b86bc45`. Validation: **403/403 tests**, build and clean generated-output checks;
actual Worker runtime verifies login/remembered access, D1 persistence and Undo,
and protected R2 video ranges/HEAD. Browser checks covered batch Trash/Undo,
readiness navigation/draft states, synthetic video playback and comment editing.
The integration also fixes serving Studio's batch assets and checks every
script/style referenced by Studio through its real HTTP server.

The comments database and migration are provisioned in the existing account.
Worker version `c7adbb5d-6643-43ce-a30a-ec920ef2f4ef` was deployed before Pages;
read-only production checks passed for anonymous/foreign-origin denial,
authenticated profile/comment reads, separate admin access and protected photos.
No fabricated comments or held family footage were published. Service operations,
identity limitations, moderation and retention are in
[COMMUNITY_OPERATIONS.md](docs/COMMUNITY_OPERATIONS.md).

The existing no-paid-services constraint remains in force. No plan was upgraded;
private video reuses the existing R2 bucket and authentication. Group place
reviews are owner-curated through Studio or an agent; a photo password grants
no traveler/editor role.

## Photos + Places production release and Replay clarification

The owner approved the combined demo for production, including the full owner
editing experience and separate phone/desktop navigation. Implementation lives
on local branch `codex/photos-places-production-20261008` and uses the shared
journey template and browser modules for real trips, demos and new drafts.

- Map photo bubbles expand when selected and keep their selected photo, group
  and order through zooming. Ordinary selection preserves the map framing.
- Desktop keeps the days on the left, the map in the middle and place or photo
  details on the right. Full screen is an explicit photo action; there is no
  desktop day picker. Phone keeps one compact day picker with the current title.
- Places use ordered, explicitly linked trip photos. On 11 October the owner
  rejected proximity suggestions and automatic venue labels; `3d88dd7` removed
  them. Trip-photo access and filters remain in force; venue imagery stays separate.
- Studio **Places** edits names, descriptions, memories, category/status, days,
  coordinates, sources, credited venue images, curated group reviews and ordered
  photo links. Linked photos open the normal photo editor. Save, draft recovery,
  review/discard, conflict handling and Ready to share use the existing pipeline.
- Photo links survive Trash and local-only assets in source, while public output
  omits ineligible links. Calendar changes reject removing a day still assigned
  to a place until the owner updates its assignment.
- The Alpine demo includes credited, explicitly illustrative photo placements.
  No new family memories, associations or private media were invented/published.

Browser checks cover 1440/1024 px desktop and 393 px phone layouts, the phone
chooser, stable selection through zoom, day switching, photo/place navigation,
Full screen/Back, and isolated Studio create/recover/save/reorder/photo-edit
flows. The disposable QA draft and its edits remain outside the release tree.
Implementation commit: `1c7dabe`. **416/416 tests pass**; the production build is
reproducible with no generated-output differences. The real-photo eligibility
index and Worker code are unchanged, so this release needs only Pages deployment.
Open [the public Alpine example](https://gravelcycles.github.io/travels/demo.html?journey=alpine-crossing&day=alps-d1&view=map)
or the local [Studio Places editor](http://127.0.0.1:4186/studio/).

**Full-trip Replay is disabled by the later 11 October owner request (O09).**
The earlier playback/seeking implementation and camera prototypes remain historical;
do not reactivate them. Arrival/city playback remains available in the main map.

The superseded combined **Photos + Places** prototype is preserved locally at
`codex/day-experience-review` · `37a8b0a`. Open
[the local demo](http://127.0.0.1:4175/?scene=places): photo bubbles sit alongside
place pins, photos link to a nearby place, and places offer nearby trip photos.
Phone/desktop views, a stable selected group through zooming, an empty nearby
state and an unlocated album photo are included. All sample album placements are
explicitly illustrative and retain image credits. The 150 m proximity rule saves
no geographic association, but was still rejected for the current product on
11 October. Do not restore it or the old separate photo card from this prototype.
The shared production implementation and OWNER_DECISIONS supersede this
prototype; its demo-only injection code is not shipped.

The prototype passed **369 repository + 11 prototype tests** and a build. Its
source and run instructions are at
`experiments/day-experience/README.md` on that local branch. The combined Studio
preview runs at [port 4185](http://127.0.0.1:4185/studio/). These loopback links
work only while the corresponding local servers are running.

This section supersedes pending-status claims in the historical cleanup and
family-publication checkpoints below. Remaining design work includes explicit
sharing and the delight mockup; named Replay seeking was implemented on 11 October. Framework W04–W06
and paired Live Photos W09 remain open.

## Publication update — 8 October 2026

After the cleanup below, the owner explicitly requested publication of the saved
family-trip edits and demonstrations of the other workstreams. The family
content is now included in this release on main; other prototype and recovery
branches remain local. See [the publication record](docs/workstreams/family-content.md).

- Published saved stories, cover/focal point, photo map frames and Trash choices,
  Day 8 album order, and the airport–Luzern route edit without rewriting them.
- Published the pending Day 2 photo through the existing protected media
  service: all three derivatives uploaded and checksum-verified, with bucket
  public endpoints still disabled. Its manifest status is now `published`.
- Kept the saved Day 2 `hello` text. Replacing it is a future editorial edit.
- Integrated with main through `7ea3c23`, preserving the newer Heading East
  journey, globe branding, rail markers and cycling campsite copy. Validation:
  **369/369 tests**, successful build, and clean diff checks.
- Refreshed the local map/Replay comparison against current shared code;
  **10/10 prototype checks** pass. The standalone feature and delight mockups
  remain simulations. Places/comments previews remain available on the live
  site; visitor identities, shared storage and moderation were still pending at that checkpoint
  and are delivered by the current release above.

The rest of this file retains the cleanup inventory as a historical checkpoint;
its baseline, local checkout and test counts describe that earlier operation.
The publication update above takes precedence for the family workstream.

## Baseline and repository state (cleanup checkpoint)

- The public baseline is `272086e344ea0f41a0093a5188e186a748aabded`, the
  20 September Places/comments UX release. Its original Pages deployment was
  [successful](https://github.com/gravelcycles/travels/actions/runs/35521475825).
- Local `main` was 55 commits behind that release. It has been fast-forwarded;
  this cleanup adds documentation on top. The website's production code and
  published trip content are unchanged by the cleanup.
- Five focused workstream branches below preserve saved content, prototypes,
  and investigation notes. They start from the same public baseline and can be
  resumed independently. Their commits are checkpoints, not release approval.
  At the owner's explicit request on 8 October, workstream and recovery branches
  stay local; only the main Markdown documentation is published remotely.
  Remote backup of those branches is outside this cleanup's scope.
  Branch/path references below identify files on those local branches.
- The exact original dirty working tree, both September safety snapshots, and
  all eight stashes are preserved on recovery branches. Original stashes and
  ignored private/local files are retained. Recovery branches are not candidates
  for wholesale merging over newer code.
- 32 fully merged local branch names and 28 registrations for missing temporary
  worktrees were retired. Their exact tips are listed at the end of this file.
  The primary checkout is left clean on `main` for the next task.

## Preserved work ready to resume

| Workstream | Branch / checkpoint | Status and next step |
| --- | --- | --- |
| Saved family-trip content | `codex/family-content-wip` · `bb7164c` | Published on main at the owner’s request on 8 October; original local checkpoint retained for recovery. |
| Photo bubbles, day navigation and gentler Replay | `codex/day-experience-review` · `3a7da82` | Working local comparison prototype; select the behavior to integrate into shared source. |
| Six proposed feature demos | `codex/ux-feature-previews` · `a9ae0b2` | Interactive design artifact; five proposals remain open, while Studio recovery subsequently shipped. |
| Delight / creator experience | `codex/delight-preview` · `78ec3a5` | Separate interactive design artifact; choose a concrete improvement and reconcile it with current production. |
| Live Photos intake | `codex/live-photo-intake` · `db36e92` | Investigation notes only; waiting for an actual still/movie pair. No feature code exists. |

### Saved Switzerland–Italy editorial work

Branch handoff: `codex/family-content-wip:docs/workstreams/family-content.md`.
Five source files contain all the original saved Studio edits:

- `content/day-overrides.json`: Day 1/2 titles and dates; Day 5 rain-day story;
  Day 6 story/title/tagline; three additional Day 8 album-order entries.
- `content/journeys/switzerland-italy-family-2026.json`: cover changes to
  `family-img-1469` with focal point `[64, 48]`.
- `content/photo-overrides.json`: airport photo pin/zoom, four Luzern photo-map
  compositions, and three saved Trash choices. The shared map-frame capability
  already shipped in `e8d7f81`; these are editorial values for it.
- `content/route-overrides.json`: `family-airport-luzern` has an endpoint edit
  with 18 control points and 221 vertices, manual train routing, no smoothing.
- `content/photo-manifests/switzerland-italy-family-2026-uploads.json`: one new
  Day 2 `IMG_1471.heic` record remains `assetStatus: "local"`. The original and
  three private derivative files are not part of Git or automatically uploaded.

At cleanup, the new upload was still local and excluded from public photo output.
The owner subsequently requested publication: all five content-source edits and
the protected upload are now delivered as described in the publication update
and [handoff](docs/workstreams/family-content.md). The source list above records
the original checkpoint; the current upload manifest says `published`.

The saved Day 2 text `hello` remains unchanged. The publication preserves the
saved editorial and geographic decisions, without claiming a new route survey.

### Day-experience review prototype

Branch instructions: `codex/day-experience-review:experiments/day-experience/README.md`.
Recovered nine authored files from ignored `build/ux-review/` into
`experiments/day-experience/`. Original local files remain intact.

The latest reviewed direction from **Improve map photo display** is:

- Even small map bubbles show thumbnails; selection enlarges the active bubble.
  The open group retains its photo, count and swipe order through map zoom/pan;
  closing releases it to regroup. The card fits the full photo.
- Regional Replay holds adjacent short legs together, adds gentler framing and
  cuts between regions. Other comparison options retain a still day/chapter
  frame and the original camera. Keep Replay map-only.
- Destination-labelled previous/next-day buttons, optional date strip/swipe,
  and one emoji per distinct transport mode in **All days** are review options.
  The emoji placement is the owner's clarified direction.
- Earlier camera groups and nearby-place photo discovery remain comparisons,
  not multiple permanent feature modes to ship.

Agent resume commands, on the branch:

```sh
node experiments/day-experience/prepare.mjs
node --test experiments/day-experience/review.test.mjs
node experiments/day-experience/server.mjs
```

The read-only server binds `127.0.0.1:4175`. It composes a disposable shared
viewer under ignored `build/day-experience-review/`, including a fresh empty
draft. It may read existing local private derivatives; a fresh clone does not
contain those assets. Nothing in the comparison UI edits production content.

Cleanup fixed a stale five-journey assertion and made preparation replace its
generated snapshot. **10 prototype tests pass**, the launcher and eight preview
journeys respond successfully, and production build output remains unchanged.
Prior task messages report desktop/phone interaction review; this checkpoint
adds automated/HTTP verification, not a new visual acceptance pass.

Before adoption, choose defaults, integrate selected behavior once into shared
runtime/template code, remove comparison controls, extend reference/demo/draft
regressions, update inventory/workflows, test/build and deploy normally. Do not
publish the experimental snapshot as another journey implementation.

### Feature proposals and delight demos

The six-feature demo (`codex/ux-feature-previews`,
`experiments/feature-previews/README.md`) and delight demo
(`codex/delight-preview`, `experiments/delight-preview/README.md`)
are now versioned outside `dist/`. Each has a self-contained `index.html` and
handoff. They were copied byte-for-byte from the two pinned Travels task
visualizations, and their inline JavaScript passes syntax checks. Their simulated
state is not connected to real Studio saves, publication or backend services.

The 12 September audit's **20 authorized fixes shipped** in `f6790e4`.
Automatic visitor reload/resume, audit **V1, remains excluded**. The owner asked
for demos before putting the proposed new features on the live site.

| Proposal | Current status |
| --- | --- |
| Studio recovery, readable draft comparison, save-conflict review | Subsequently authorized and shipped on 14–15 September (`06f5d63`, `94f5f27`, `df5740d`). Do not reimplement the older mockup. |
| Explicit day/photo/moment sharing | Demo only. Preserve group/photo access context; do not infer permission for automatic visitor resume. |
| Batch photo editing / larger contact sheet | Demo only. Existing single-photo edits and album ordering are already delivered. |
| Publishing readiness / agent handoff | Demo only. Keep local/saved/live distinctions explicit; publishing remains agent-operated. |
| Private video intake | Demo only; see W07 below. Hosted public video playback already works. |
| Labeled Replay seeking/timeline | Superseded: full-trip Replay disabled on 11 October (O09). |

The delight review additionally proposes personal memory entry points, direct
media browsing, in-context day editing, visual authoring and group storytelling.
Its reported caption/empty-day/responsive-control bugs have since been fixed.
Use [the review](docs/DELIGHT_REVIEW_2026-09-12.md) for intent and the current
feature inventory for actual behavior. Choose one concrete scope before
implementation; preservation of the mockup is not blanket feature approval.

## Delivered foundations with remaining work

### W08 — Places and photo conversations

The shared Places UI and local comments/reviews UX, including the 20 September
polish, **are already on main**. Search, filters, credited photos, galleries,
clusters, draft preservation, edit/delete/Undo, names and coordinated Back/Forward
are implemented. The old branch names were merged, not unfinished code.

- [Places demo](https://gravelcycles.github.io/travels/demo.html?journey=alpine-crossing&experience=places)
- [Comments demo](https://gravelcycles.github.io/travels/demo.html?journey=alpine-crossing&experience=comments)
  uses the sample password `demo`; it does not unlock real private photos.
- Preview writes stay in browser storage. Live identities and database writes
  have **not** been implemented. This distinction is confirmed by the final
  **Design places and photo comments** task handoff.

Next implementation: extend the existing photo Worker with signed visitor IDs
distinct from password IDs, D1 schema/migrations, eligible-photo validation,
authenticated reads/writes, pagination/idempotency, limits, own-comment removal,
moderation/export, expiry/revocation/CORS checks and a tested rollout. Keep group
reviews prompt-authored until server-authorized group editing is explicitly
defined. No SSO or Google Maps API. Further image-intake automation is optional;
current credited image sourcing remains agent-operated.

Start from current main. Read [architecture/API/data contracts](docs/PLACES_AND_COMMENTS.md)
and [UX evidence and its limits](docs/PLACES_UX_REVIEW_2026-09-20.md).
No new backend branch or database was created during this cleanup.

### Florence–Genoa trip intake

The six cycling days, **10–15 May 2026**, are live in `edac805` and current main.
The owner explicitly removed the arrival day and train/bus routes. Retain the
nine-person roster, day IDs `florence-genoa-d2` through `-d7`, and cycling-only
presentation numbered 1–6. Do not reintroduce the earlier arrival groups.

All six cycling routes have detailed network reconstructions and provenance;
they are not the original GPS track. Await a working cycle.travel share/GPX,
resolve Mattarana versus Oasi and Thursday's 62 km discrepancy, review campsite
approach pins/final overnights and the Genoa route, then intake actual photos.
The year remains inferred from the original intake.

Read [trip-specific open facts](docs/FLORENCE_GENOA.md) and
[the route workflow](ROUTE_GEOMETRY_WORKFLOW.md). Implementation is merged;
remaining work is content intake and verification, with no pending code branch.

### W07 and W09 — Private video and Live Photos

W07's group rosters, route/media assignment forms, meetup/overnight editing,
hosted public video and mixed gallery playback are delivered. Still needed:
private video/poster derivatives, authenticated byte ranges under the existing
photo policy, timed captions/transcripts and Studio file intake. Per-day group
membership changes remain a future data need. The six originally held MOV files
remain private; the old decision not to publish them is not undone by a demo.

W09's Live Photos investigation (`codex/live-photo-intake`,
`docs/workstreams/live-photo-intake.md`) reported stills with Live Photo metadata but missing companion motion files;
none of the six held MOVs matched. The task awaits an unmodified paired export
from Photos/iCloud. A small LIVE play/return-to-still control was proposed, not
implemented. Verify real pairing before designing the optional shared contract;
reuse W07's private-media pipeline. Cleanup did not rescan or export the library.

### W04–W06 — Framework and authoring infrastructure

These are documented backlog projects, not hidden uncommitted implementations:

| Item | Next bounded change | Required outcome |
| --- | --- | --- |
| W04 — Runtime modules | Extract an existing day/photo selector, transport, map/camera, album or Replay boundary when related work needs it. | One shared behavior, stable URLs/content, behavioral tests; no wholesale rewrite. |
| W05 — Source/output and schema | Move authored JS/CSS out of `dist/` in a dedicated migration; then consolidate schema/defaults and reviewed draft promotion. | Clean builds reproduce public output; Studio imports/tests move together; drafts/private assets remain excluded. |
| W06 — Routing preparation | Guided per-journey extracts/provenance and access/direction-aware local profiles. | Clear readiness, bounded inputs, preserved reviewed geometry and genuine mode-specific routes. |

Read the remaining migration plan in [FRAMEWORK.md](docs/FRAMEWORK.md). All shared
behavior must serve the reference trip, demos and fresh drafts. Hand-authored
assets still live under `dist/assets`; never delete `dist` as disposable output.

### New trip naming — conversation only

**Brainstorm a name for the trip** is exploring a history-themed title for the
Germany → Austria → Czech Republic → Balkans → Poland → Venice → Slovenia →
possibly Greece travels. No final name, dated itinerary, journey JSON, draft or
implementation was found. Keep it as intake context; do not create a trip or
treat suggested names as chosen. This task can continue independently.

## Task context reviewed

Task titles below are the app's actual titles. IDs allow agents to read the
source context without relying on old branch names or mutable sidebar order.

| Task | ID | Context retained |
| --- | --- | --- |
| Improve map photo display | `01a09f08-83f4-75c2-a6f0-ee16bca56935` | Latest bubble behavior and softer regional Replay were local-only refinements. |
| Design places and photo comments | `01a0bb43-66df-7cd1-a544-a9b86f2e575a` | Polished shared UX delivered; backend deliberately deferred. |
| Build Florence cycling trip | `01a0bb44-49b3-7083-b60e-83c5434dbd8c` | Detailed reconstructions; final direction removes arrival travel. |
| Start localhost Studio | `01a0a08a-f2ce-7331-9b02-30184043d94a` | Day taglines italicized and automatic “In one place” removed; deployed. |
| Add Live Photos support | `01a0a0cf-3350-7043-841f-d1769a5ff23f` | Missing paired motion files; no implementation. |
| Extract location from iPhone HEIC | `01a0a02f-d936-7ee2-9e82-a3f4b1be1ca9` | Successful isolated metadata check; no new atlas importer or pending code. |
| Audit site UX and bugs | `01a095b3-a9d7-7993-a1c6-850de3b1debe` | 20 fixes shipped, visitor reload excluded, new features require demos. |
| Improve site delight | `01a095b3-9fea-7673-a1ec-ef87a48460de` | Review and separate interactive design artifact. |
| Brainstorm a name for the trip | `01a11c3e-0902-7081-ab19-5c40b1638a50` | Naming discussion only; no chosen trip identity. |

The project task index was also checked to distinguish earlier merged map,
mobile, auth, routing and deployment work from the active items above. Unrelated
conversations sharing this folder are not project workstreams. No task was
resumed, renamed or archived by this cleanup.

## Local-only material and recovery

These remain on this machine and are not part of a fresh clone:

- `photos/`, `build/private-photo-assets/`, upload derivatives and raw route
  inputs: original/private media and reproducible/local inputs, still ignored.
- `build/studio-drafts/`: six saved session records, all reporting `dirty: false`
  at inspection; revision/backups also remain. These are recovery records,
  not six unfinished journeys. `content/drafts/` is empty and
  `build/studio-draft-overrides.json` has empty photo/route/day maps.
- `build/ux-review/`: original day-review prototype and old generated workspace.
  Use the tracked replacement branch for future edits.
- `build/commit-prep/`, `build/studio-save-investigation-20260914/`, performance,
  photo-fault/reveal and Florence intake/delivery folders: historical QA/backups.
  Their “staged/not pushed” statements describe September, not today's status.
- `build/workstream-cleanup-20261008/`: exact starting patch/hash inventory,
  branch/stash/task inventory and validation logs from this cleanup.
- Original Codex visualization files: left intact; both relevant design HTML
  artifacts are now independently recoverable from their branches.

No private originals, credentials, local draft stores or generated experimental
workspace were added to Git. The following recovery refs preserve tracked Git
states, not those ignored local assets.

| Recovery branch | Tip | What it preserves |
| --- | --- | --- |
| `codex/archive/worktree-20261008` | `fa03375` | Exact original 12-file dirty working tree; source for the family checkpoint. |
| `codex/local-backup-20260915` | `666c82c` | Original accumulated-code/content safety snapshot. |
| `codex/reconciled-local-backup-20260915` | `73a28c5` | Reconciled September snapshot; includes older code plus saved trip edits. |
| `codex/archive/stash-157b7c2` | `157b7c2` | 20 Sep: generated family/Studio output before cycling-only trip integration. |
| `codex/archive/stash-39c5ad8` | `39c5ad8` | 19 Sep: generated output before Florence route delivery. |
| `codex/archive/stash-d31afec` | `d31afec` | 19 Sep: generated output before Florence intake integration. |
| `codex/archive/stash-b569149` | `b569149` | 10 Sep: photo-frame/Studio changes plus route-override edits. |
| `codex/archive/stash-c9fa9a6` | `c9fa9a6` | 10 Sep: photo-frame/Studio changes plus route-readiness/proposal work. |
| `codex/archive/stash-6e39f8d` | `6e39f8d` | 10 Sep: overlapping photo-frame/Studio autostash. |
| `codex/archive/stash-bcec35e` | `bcec35e` | 9 Sep: overlapping photo-frame/Studio autostash. |
| `codex/archive/stash-e2a9835` | `e2a9835` | 9 Sep: photo-frame/Studio autostash and viewer/style changes. |

The eight original `stash@{…}` entries were retained. Use the SHA/branch names
above, because stash numbers can change. Early autostashes contain overlapping
photo-frame/Studio changes and, in some cases, routing edits; later stashes only
preserve generated Studio output. Inspect differences before extracting a file;
do not apply an old stash wholesale. Restore generated bundles by rebuilding
from the selected source state.

## Completed local branch archive

Each tip below was verified to be an ancestor of `272086e` before its local ref
was removed. These are completed/merged branches, not additional pending work.
Their commits remain reachable through main. To recover a historical name, an
agent can run `git branch <name> <recorded-tip>` without changing the checkout.

| Retired local branch | Merged tip |
| --- | --- |
| `codex/button-focus-outlines` | `c07d32328496` |
| `codex/city-label-contrast` | `26bb55c91c3c` |
| `codex/collapsed-map-attribution` | `06c6fcafb55f` |
| `codex/day-scroll-photo-timing` | `e937dade3a4d` |
| `codex/deploy-recovery` | `65e04001dd5b` |
| `codex/desktop-leg-hover` | `5b14d12a98da` |
| `codex/fix-journey-entry-flash` | `523a65830e41` |
| `codex/florence-genoa` | `edac80583050` |
| `codex/full-trip-map-framing` | `626b9e0c3155` |
| `codex/group-routes-video` | `538a8e63761b` |
| `codex/integrated-media-viewer` | `aacb9f91b371` |
| `codex/location-labels` | `249fcac4b4ea` |
| `codex/map-marker-spacing` | `121dc4645910` |
| `codex/mobile-cleanup` | `06c6fcafb55f` |
| `codex/mobile-photo-gestures` | `908b85adc0d3` |
| `codex/mobile-ux` | `ebc974011918` |
| `codex/mobile-viewer-fix` | `80d3d01711d6` |
| `codex/photo-loading-recovery` | `5ee19a68da7e` |
| `codex/photo-map-frames` | `edac80583050` |
| `codex/photo-viewer-outlines` | `80d3d01711d6` |
| `codex/places-comments-demo` | `edac80583050` |
| `codex/places-ux-polish` | `272086e344ea` |
| `codex/prepare-local-changes` | `94f5f2772632` |
| `codex/publish-bike-point-edits` | `fb50e8773c88` |
| `codex/quiet-photo-auth` | `d309985f2244` |
| `codex/rail-stop-rim` | `1ce1007341f6` |
| `codex/route-proposal-cleanup` | `4e05d9ee6f82` |
| `codex/shared-trip-framework` | `e84e2b7fca50` |
| `codex/studio-day-copy-save-fix` | `7e26085b6a03` |
| `codex/studio-groups-and-videos` | `9896375fc54f` |
| `codex/studio-save-recovery` | `94f5f2772632` |
| `codex/ux-audit-fixes` | `f6790e411f76` |

## Resume and delivery checklist

1. Read this snapshot, the selected branch's handoff, current framework and
   relevant workflow. Inspect `git status` before any checkout or merge.
2. Fetch origin and integrate current main into the selected workstream.
   Checkpoint branches share the baseline but are not an implicit integration
   stack. Resolve generated-output conflicts by rebuilding, not selecting a
   stale bundle. Do not merge recovery snapshots.
3. Keep prototypes out of Pages until their selected behavior is implemented
   and reviewed in shared code. The family checkpoint has now been published;
   retain its historical branch without reapplying it over later content edits.
4. Run appropriate targeted checks, `npm test`, `npm run build`, and
   `git diff --check`; include generated public output. The existing suite
   includes reference/demo/fresh-draft contracts. Local server tests need
   localhost access in sandboxed environments.
5. Before deployment, fetch/integrate latest remote main, push without force,
   verify the successful Pages run and a fresh public page. Update this file's
   status/tip/evidence when a workstream advances or completes.

Cleanup validation: main **361/361**, family checkpoint **361/361**, prototype
**10/10**; both standalone demo scripts parse. Main builds without any `dist/`
changes. Exact original-file hashes, all five checkpoint content sources, eight
stash refs, all 32 merged tips, commit references and local doc links were checked.
The documentation release's Pages verification accompanies the cleanup delivery.
No new prototype behavior or unpublished family edits are deployed by this
documentation release.

## Credential documentation privacy — 11 October 2026

The owner required removing identifying credential labels and password hints
from both Markdown and Git history. Current guidance follows O14. The affected
remote branch/tag history and local branches, worktree indexes, recovery refs
and reflogs were sanitized; all eight stash entries and concurrent work were
preserved. The old offending local commit object was pruned. Historical scans
found no identifying labels, and the sanitized release passed all 518 tests,
the production build and Pages deployment.

At the owner's request, the obsolete Actions run was deleted and its API now
returns 404. Its separate Pages deployment record and obsolete commit remain
accessible. Removing the run does not prove erasure, and GitHub documents no
automatic expiry deadline. A Support purge request remains unsubmitted and
subject to GitHub's eligibility rules. The prepared request is private and ignored at
`build/password-update-20261011/github-support-request.txt` in the primary
checkout. Next action: obtain explicit authorization to submit it to GitHub
Support, then verify the obsolete cached content is unavailable. Do not merge
pre-cleanup histories or restore their Markdown. All other tasks are unblocked;
this follow-up creates no shared checkout or deployment hold. The ignored local commit map
is `build/password-update-20261011/history-commit-map.txt`.
