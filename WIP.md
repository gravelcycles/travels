# Current workstreams

## Forni–Vienna via Carnia/Tarvisio — 20 October 2026

Owner follow-up replaces the proposed Udine backtrack with buses 110/150/200/203
via Tolmezzo, Carnia station and Tarvisio autostazione to Boscoverde, then rail
to Vienna. Their pasted 12:25–22:07 reference is for today; they report the same
route on 29 October. Exact 29 October times remain unverified, and Vienna dates
stay TBD. Preserve the other itinerary/metadata. Current evidence and acceptance
live in [the trip record](docs/HEADING_EAST.md#vienna-access-correction--20-october-follow-up).
Implemented three detailed bus legs on the valley roads and clipped the existing
railway at Boscoverde, preserving subsequent track vertices. The map has 47
legs and 31 stays; Vienna has four bus legs then one train leg, about 514 km.
Cella boarding and the unknown lodging/station walks are documented separately
from the retained city/rail anchors. Strict routing preserves 47 legs with no
warnings; all 907 tests pass after integrating current published `8305a2f`,
with a reproducible production build. Desktop/390 px checks
show the correct five travel rows and TBD dates, with no captured script errors.
Published as `7ace011` through successful
[Pages run 39389821508](https://github.com/gravelcycles/travels/actions/runs/39389821508).
Eleven fresh public files match the tested release byte-for-byte, including the
scoped trip, legacy geometry/data, catalog and integrated runtime. Implementation,
current trip notes and publication are complete. This verifies the published
route, not an independently confirmed 29 October timetable. No media upload,
Worker change or private-photo access was needed.

## Photo crop and rotation — 20 October 2026

Authorized basic crop and arbitrary-degree rotation in the shared Studio photo
editor, extending O11/O14. Implemented on `codex/photo-crop-rotation` in
`/Users/dg/Documents/Codex/2026-10-20/what/work/travels`; integrated remote main
through `fcb8d9d`, preserving concurrent route/rendering and initial-entry work. Includes recovered
unfinished recipes, matching private derivatives, atomic conflict handling,
original reset and verified publication with the last published crop retained.
Share thumbnails resolve the same published composition. See
[the current contract](PHOTO_WORKFLOW.md#crop-and-rotation-in-studio).

All **907 integrated tests** and the production build pass. Browser checks cover
an actual reference-photo crop → Apply → Save locally → reload; sample draft
recovery and Save blocking/reopening unfinished work; an independently populated
city draft with exact 12.3° rotation and 4:5 crop; and the real editor at 390 px
with scrollable controls and reachable Apply. Original bytes, metadata stripping,
publication failure/races, independent copy and reset are covered by the focused
image/publisher/recovery tests. No real photo changes were committed or uploaded. The owner explicitly approved
production publication on 20 October after automatic review requested approval.

The scoped implementation/current guidance is installed in the primary checkout;
all **37 focused checks** also pass there. Its photo data and unrelated pending
work are intact. A new server at `http://127.0.0.1:4195/studio/` serves the updated
editor without refreshing existing tabs. Published as `e9b75e7` through successful
[Pages run 39388574944](https://github.com/gravelcycles/travels/actions/runs/39388574944).
Five fresh public pages plus both crop-related shared assets match the tested
release byte-for-byte. Crop & rotate is open in the new local Studio tab with
its real source loaded; existing tabs and unfinished drafts remain untouched.
Current owner/workflow/framework/feature guidance is updated. Implementation and
publication are complete. Studio stays local; future photo edits still use
Apply → Save locally → verified asset/Worker/Pages publication.

## Initial URL flashes — 20 October 2026

Owner requested no flashes on every initial page, explicitly including shared
and intermediate URLs, plus durable UX policy. O04 and PRINCIPLES now carry the
sitewide rule. Isolated `codex/no-entry-flashes` starts from `48f73fe` and leaves
the primary checkout's unrelated changes intact.

Implemented: head-level view/access coordination for catalog and all generated
journeys; quiet share redirects; common neutral background/progress for automatic
login checks; bounded startup recovery and cached-document Back handling.
All **895 tests**, production build and Worker runtime checks pass. Desktop and
390 px browser fixtures cover reference-photo, city-grid, demo, independently
populated draft, delayed status/redemption, guest, failure, catalog and signed
share entry. Frame observations record zero early chrome/unlock frames; the
first visible destination has both access and view resolved. A 10-second status
check shows only neutral progress. Fixture images are synthetic; these are
browser viewport checks, not physical-iPhone certification. Integrated the current
route and rendering releases from `4d14bd4`; all **901 integrated tests** and the
regenerated build pass, and phone/reference plus desktop/catalog entry were
rechecked with zero early frames or script errors. The owner explicitly approved
live site and existing Worker deployment on 20 October after automatic review
required production approval. Published as `fcb8d9d` through successful
[Pages run 39388305607](https://github.com/gravelcycles/travels/actions/runs/39388305607),
with Worker version `03da29ac-a2b7-47c0-badf-4756f4f16101`. All five fresh public
pages and 45 referenced scripts/styles match the tested release byte-for-byte.
Live public-sample share navigation opens the exact photo on desktop and 390 px
phone viewports, with no unlock prompt or captured script errors. Live Worker
checks confirm hidden share/restore content, matching background, nonce-protected
styles and unchanged anonymous 401/no-store protection. Implementation and
publication are complete. No private-media access or remembered credential policy
changes.

## First zoom into each photo — 20 October 2026

Owner retest after `8c16376`: the viewer “looks great,” with a lag on the first
zoom into each photo and smooth subsequent zooms of that photo. Asked for cause
and cost/benefit assessment. Code inspection confirms the fitted prepared canvas
is replaced by the original native image when scale exceeds one; the loader
already uses decode readiness. Cold first native paint/resampling/GPU preparation
is consistent with the per-photo pattern, but no new phone trace identifies the
browser-internal stage. Assessment only: no zoom runtime change is delivered.

Recommended next experiment: prepare only the selected photo after motion
settles, compare first and repeat zoom on the physical iPhone, and retain only
a measured benefit without extra opening/swipe latency, quality loss or excessive
memory. Hidden-image prepainting may be skipped by the browser; decode readiness
alone is insufficient proof. Avoid prewarming every full-resolution neighbor.
Preserve the deployed browsing improvement, access cleanup and native fallback.
Current owner decisions, incident evidence and TODO carry this follow-up.

## Heading East route adjustment — 20 October 2026

Current source and acceptance: [trip record](docs/HEADING_EAST.md#route-adjustment--20-october-2026).
Forni is locked in for 23–29 October via Udine/Tolmezzo; Slovenia now follows
Zagreb; Bratislava follows Kraków. The owner's follow-up keeps the existing
Wrocław → Warsaw → Kraków order. All later dates remain TBD. Work is isolated
from the original checkout's ongoing photo changes; remote `8c16376` is now
integrated, retaining its current rendering improvements and guidance.

Source, network geometry, provenance and generated public output are updated.
Seven new network legs and three derived legs preserve the unaffected arrays.
Strict route build preserves all 45 legs with zero warnings. Calendar/photo
assignment, the exact stop order, chained travel and visibility regressions are
updated. All 894 integrated tests pass. Desktop and 390 px browser checks verify Forni’s
dates/three legs, Bratislava after Kraków, Ljubljana after Zagreb, and twelve
retained stays when TBD is hidden. Published as `20ff638` through successful
[Pages run 39387171368](https://github.com/gravelcycles/travels/actions/runs/39387171368).
Eleven fresh public files match the tested release byte-for-byte: catalog/trip
HTML, scoped/legacy journey data, geometry, photo/override data and the integrated
mobile runtime. A live browser load was automatically blocked when it attempted
to load the private-photo Worker; no access was bypassed. Public bytes and the
local desktop/phone viewer were verified independently. Implementation and public
publication are complete; no private-photo observation is needed for this change.
No protected-media upload or Worker deployment is needed: eligibility is unchanged.

## Residual fullscreen rendering lag — 20 October 2026

The owner still notices lag versus native Photos in drag, release, rapid browsing
and zoom, especially mid-swipe. Implemented fitted physical-pixel canvas storage,
bitmap adoption outside horizontal motion, and frame-paced pinch/pan with final
sample flushing and queued-input cleanup. Preserve immediate first native display,
full-source zoom, focal bounds, existing surfaces/history and private fallback.
No new phone trace exists; this reduces demonstrated work without claiming the
remaining physical issue resolved or native parity.

Matched Heading East loopback checks at 390×844/DPR1 reduce retained bitmap pixels
987,480 → 609,960 (38.2%), controlled mid-drag bitmap adoptions 3 → 0, pinch
transforms 144 → 12 and pan transforms 109 → 10, with identical final transforms.
All six new regressions fail on the previous runtime. All 894 tests pass and
repeated builds preserve all 79 public files byte-for-byte. Browser checks pass
reference 22/22, Alpine demo 21/21 and independent populated draft 21/21, including
fitted geometry after Location, native zoom, grids/history, map return and pixel
cleanup. The actual first Heading East photo passes 5/5 startup checks at both
50 ms and 1,500 ms worker-result delays, displaying native pixels before any
prepared surface is ready. No captured script errors. Current owner decisions,
photo workflow, framework/features, TODO and incident evidence are updated.
Published as `8c16376` through successful
[Pages run 39386812996](https://github.com/gravelcycles/travels/actions/runs/39386812996).
All five fresh public pages and 44 referenced scripts/styles match the tested
build byte-for-byte. Live ordinary-URL sample checks confirm fitted 390×292.5 px
geometry, three ready surfaces, forward/reverse browsing, full native zoom,
desktop pixel release, mobile reuse of three slots and final close cleanup,
with no captured script errors. Implementation and publication are complete.
Retain a fresh physical-phone comparison/trace as follow-up; no new phone
frame-time measurement or complete residual-lag resolution is claimed.

## Prepared mobile photos by default — 17 October 2026

The owner explicitly requests default rollout, superseding the opt-in gate and
prior graduation condition. Integrated remote main `cf1c5a6`, including the dark
All photos chooser. Ordinary mobile URLs now use the corrected renderer on
supported browsers; former comparison URLs remain usable. Desktop startup
creates no mobile canvases/workers, and resizing an open desktop viewer to phone
width initializes the same three slots once. Preserve immediate first-photo
display, full-source zoom/access, bounded memory, preview/stall recovery and
native fallback. No renderer preference or per-trip flag is added.

All 888 tests pass, including normal/legacy URLs, native capability fallback and
reference/demo/populated fresh-draft mobile/desktop breakpoint initialization.
Repeated builds preserve all 79 public files byte-for-byte. Ordinary-URL browser
checks pass reference 22/22, Alpine sample 21/21 and independent populated draft
21/21, without captured script errors. The actual first Heading East photo
passes all five startup checks with worker results held for 1,500 ms: its native
reveal starts while zero surfaces are ready. Published as `cab8223` through
successful [Pages run 39024399185](https://github.com/gravelcycles/travels/actions/runs/39024399185).
All five fresh public pages and 44 referenced scripts/styles match the tested
build byte-for-byte. Live ordinary-URL checks verify zero canvases at desktop
startup, three ready surfaces on a fresh phone load, forward/reverse swipes,
and desktop/phone transitions that release pixels and reuse the same three
slots. No captured script errors. Implementation, guidance and default rollout
are complete. This rollout authorization
does not itself confirm the latest startup fix on a physical iPhone; retain that
measurement/retest follow-up without claiming a numeric speedup. Current owner,
workflow, framework/features, incident and TODO guidance are updated.

## Dark All photos chooser — 17 October 2026

Authorized: match the day/stop chooser to the day photo roll's black styling.
Shared CSS now uses the same near-black canvas, square covers, compact type,
sticky heading and solid Close control; phones use a full-viewport two-column
grid. Existing selection/history/loading code is unchanged. Work is isolated in
`codex/dark-photo-day-picker` from main `25a28bd`, preserving the primary
checkout's unrelated edits. Current owner guidance, photo workflow and feature
inventory are updated. After integrating concurrent main `a1edad5`, all
**887 tests** and the production build pass with reproducible public output. Browser
checks cover the Alpine demo and an independently created populated city draft:
desktop, 390/320 px phones, long titles, no horizontal overflow, sticky Close,
day-grid entry/Back and empty-stop story entry. Reference inheritance passes in
the shared-framework suite. The owner explicitly requested internal-browser
private-photo access after the initial automatic review rejection. The existing
remembered internal session now loads all seven real Heading East album covers
at 480 px. No personal-browser access or auth changes were needed.

Published as `9ce525e` through successful
[Pages run 39023159023](https://github.com/gravelcycles/travels/actions/runs/39023159023).
All five fresh public pages and the shared stylesheet match the tested build
byte-for-byte. Live internal-browser checks verify the near-black chooser on
Heading East (101 photos, all seven protected covers loaded) at desktop and
390 px, Berlin's 24-photo grid entry and Back, and the reference's 14-day chooser
(103 photos). No horizontal overflow; the background exactly matches the day
roll (`#091113`). Phone/desktop screenshots are saved in the task's outputs.
Implementation, guidance and publication are complete.

## Physical iPhone incoming-image paint — 17 October 2026

Owner supplied two traces, the second without screenshots, after the previous
release still jumped. iPhone 12 Pro, Safari/Brave also affected; returning within
roughly two recent photos feels smoother. The screenshot-free trace contains
8/12 swipes with a >50 ms paint during drag (max 191.8 ms), while pointermove
callbacks stay <=0.69 ms. [The incident record](docs/PERFORMANCE_IPHONE_2026-10-17.md)
distinguishes encoded bytes, three retained image elements and native display
work. Raw recordings/private pixels remain outside Git.

Initial comparison on `codex/iphone-swipe-surfaces`: `?swipeRenderer=prepared` prepares
three physical-resolution display canvases serially from current authorized
full-photo Blobs. At that comparison checkpoint native sources retained
zoom/access and normal URLs allocated no worker/canvas. Preserve cold reveal, reject stale work, clear on lock/close/grid/
resize, and fall back for unavailable APIs, errors or oversized surfaces.
All 881 tests pass, plus the final eight renderer checks; repeated builds preserve
all 79 public files byte-for-byte. Browser affected-flow checks pass reference
21/21, Alpine sample 20/20 and independently populated fresh draft 20/20, with
no captured script errors. Heading East retains incoming/outgoing images in all
four forward/reverse handoffs, with three prepared surfaces ready afterward.
Published as `02b6cab` through successful
[Pages run 39020730614](https://github.com/gravelcycles/travels/actions/runs/39020730614).
All five fresh public pages and 44 referenced scripts/styles match the tested
build byte-for-byte. Live sample rightward/leftward gestures retain three ready
surfaces, native full-source ownership and the selected accessibility label,
with no captured script errors. A fresh ordinary sample URL allocates zero
canvases and retains its native image/reveal. Current owner decisions, photo
workflow, framework/features, TODO and incident evidence are updated.
**Later 17 October owner retest:** prepared browsing is “much better”; apart
from a jump on the first swipe of the first photo it looks good. Physical-phone
benefit is now qualitatively confirmed. No after-change timing trace exists;
first-entry continuity remained unresolved, so the renderer stayed opt-in at
that checkpoint; the later default-rollout request is tracked above.
Owner clarification: only an immediate first swipe jumps; waiting three seconds
avoids it. Explicit requirement: preserve first-photo display speed. The startup
correction leaves the native opening reveal independent of worker readiness,
prepares adjacent slots before duplicate selected work, keeps pending neighbors
on embedded previews with full-photo fit, and prevents a first native handoff
during horizontal motion. Lock/source/close clear both preview and bitmap;
worker failures fall back. Four new regressions fail before and pass after;
worker-start failure, bounded stall fallback and resize/reduced-motion handling
are also covered.
The delayed-worker browser fixture passes all five startup checks at 1,500 ms
and 50 ms result delays, with first native display before any bitmap is ready.
All 887 tests pass, including 14 renderer checks. Repeated builds preserve all
79 public files byte-for-byte. Shared browser checks pass reference 21/21,
Alpine sample 20/20 and independent populated fresh draft 20/20 with no captured
script errors. The previous candidate fails the pending-neighbor check at
1,500 ms (4/5) and also switches native surfaces during drag at 50 ms (3/5);
the correction passes 5/5 in both cases. Published as `a8dcbac` through successful
[Pages run 39022045255](https://github.com/gravelcycles/travels/actions/runs/39022045255).
All five fresh public pages and 44 referenced scripts/styles match the tested
build byte-for-byte. Live sample forward/reverse gestures retain three ready
surfaces with no pending previews or script errors afterward; a fresh ordinary
URL retains its native reveal and allocates zero canvases. Current owner,
workflow, framework/features, TODO and incident guidance include the immediate-
swipe clarification and the no-added-initial-display-wait constraint.
Required next: physical-iPhone immediate-swipe retest, preserving the confirmed
steady browsing improvement. The later owner request authorizes default rollout
above; physical startup measurements remain a separate follow-up.

## Loaded-next-photo jump correction — 16 October 2026

**17 October owner retest: the jump still occurs after this release.** The
deployed ordering/positioning correction is verified, but it did not resolve
the reported iPhone behavior. Root-cause investigation remains open. The owner
has since supplied the physical-device traces; the incoming-image paint
investigation and controlled candidate are tracked above.

Owner clarified that the next full image is already loaded and sharp when the
jump occurs, and reproduction may require an iPhone. The isolated checkout
starts at published `eefc647`; unrelated shared working changes remain intact.
The app's backdrop geometry read starts `photo-resolve` after a prepared node
receives the selected ID but before the loader sets its instant reveal policy.
Set that policy before the ID and retain absolute positioning for both roles.
The new ordering regression fails before the fix and passes afterward; all
870 tests pass, including the loader, gestures, history and shared-framework
checks. The matched four-handoff browser comparison observes unintended reveal
creation 2→0 and position-model changes 4→0, retaining the incoming node/source
4/4. Reference/demo affected flows pass 16/16 each and the freshly generated
independently populated draft passes 15/15. Two builds preserve all 78 public
files byte-for-byte. Published as `4c37c55` on 17 October through successful
[Pages run 39015083364](https://github.com/gravelcycles/travels/actions/runs/39015083364).
All five fresh public pages and 43 referenced scripts/styles match the tested
build exactly. Live mobile sample forward/reverse swipes preserve the ready,
instant-reveal image and absolute positioning. Current owner/workflow guidance
is updated. Physical-iPhone smoothness remains unverified; do not equate removal
of this observed transient animation with eliminating every device frame stall.

## First fullscreen photo readiness follow-up — 16 October 2026

Owner reports that the first swipe to the next fullscreen photo still pauses,
as if it is not rendered yet, and movement remains laggy after `a940395`.
Mobile Chrome is known; phone OS/model is being clarified. Investigation is
isolated on `codex/fullscreen-photo-readiness`, based on `f3dd926`, with earlier
measurement artifacts retained. The candidate retains prepared incoming/outgoing
elements in three carousel slots (handoff source assignments 5→2, incoming 2→0),
defers covered label/bubble layouts (one each→zero), and lets actual horizontal
swipe/pinch intent finish a ready photo's reveal (0–0.1 ms switch in three trials).
Idle reveal duration, full-size media, fallback, authorization, camera/history,
Comments and drafts are preserved. The explicit async-decoding hint was tested
and rejected. [The measurements](docs/PERFORMANCE_READINESS_2026-10-16.md) retain
every comparison's limits: first-swipe long frames remain, and physical-phone
performance is unverified. Reference/demo browser flows pass 16/16 each; the
current-template independently populated draft passes 15/15. All 869 tests pass,
two builds preserve all 78 public files and independent review is clean.
Published through [PR #4](https://github.com/gravelcycles/travels/pull/4) as
`eefc647`. Its recorded first-swipe limits remain; the later loaded-image
correction is tracked above. Remaining device profiling is
tracked in TODO; the completed AVIF follow-up automation stays paused.

## Later saved Heading East Studio edits — 16 October 2026

Owner requested publication after another saved Studio review. The isolated
`codex/studio-edits-20261016` checkout starts from main `38b31a1`, preserving
concurrent viewer and photo-share improvements. Scope: 19 new recoverable Trash
choices and two exact traveler notes in `content/photo-overrides.json`; no route,
day order, media upload or other journey change. The source snapshot is retained
outside Git. [Heading East](docs/HEADING_EAST.md#later-studio-photo-selections-and-notes--16-october-2026)
records the new 101-photo membership and preservation requirements.
All **837 tests** and the production build pass. The actual Worker runtime
passes authentication, WebP/AVIF, signed thumbnail sharing, video and D1 checks.
Exact-source comparison verifies all 19 exclusions and both notes; surviving
photo records/AVIF fallbacks, journey, routes and album order are unchanged.
The generated comment and share indexes match all 101 visible IDs. Rollback
Worker: `2187bc98-1bdb-48a8-9991-9473158ed84a`.
Published as `75f4e04` after integrating main `6860c88`, through successful
[Pages run 38955013712](https://github.com/gravelcycles/travels/actions/runs/38955013712).
Worker `2229eb8d-8d54-47f6-b3b6-46e6a4593910` was activated before Pages.
Live authenticated checks reject all 19 removed discussions and share targets;
retained comments and WebP/AVIF respond successfully, with anonymous access denied.
Nine fresh public files (all five pages and the four changed data bundles)
match the tested release byte-for-byte. Both notes match the saved text exactly;
the live browser shows 101 total photos, Köln 8 and Prague 26. The source still
matches the Studio snapshot. Trip guidance and delivery are complete; unrelated
shared-checkout edits and private originals remain intact.

## Photo share thumbnails — 16 October 2026

Owner requested low-resolution thumbnails of the actual shared photo in message
previews. O18 and PHOTO_WORKFLOW record the accepted behavior and limited preview
access. Implementation is isolated on `codex/photo-share-thumbnails`, starting
at remote main `504bd26`, preserving the shared checkout's unrelated edits.
The client captures the clicked photo, requests its thumbnail-only share link,
and preserves normal history, full-photo unlock and share/copy fallbacks.
All **837 tests**, the production build and Cloudflare runtime checks pass.
Apple's native macOS LinkPresentation reads the actual Worker HTML and decodes
its 480px WebP without executing the recipient redirect. Slow native-share
activation retains the prepared link for a fresh tap. All 223 real published
photos and 12 sample stills have explicit small thumbnails; samples retain their
full originals for fullscreen viewing. The shared reference/demo/fresh-draft
checks pass. Worker `2187bc98-1bdb-48a8-9991-9473158ed84a` is deployed;
rollback version is `33b135c6-21d7-4c6a-b366-2e217e6ab7b3`.
Published as `38b31a1` through successful
[Pages run 38954219578](https://github.com/gravelcycles/travels/actions/runs/38954219578).
All 59 checked public files, including five pages, referenced assets and seven
sample thumbnails, match the tested release byte-for-byte. Both real trips pass
live signed HTML, anonymous thumbnail GET/HEAD, exact thumbnail checksum and
480px dimensions; full WebP/AVIF still reject anonymous access and accept valid
access. Native macOS LinkPresentation fetched the live family share, read
“Arrival in Luzern” and decoded its 480×360 WebP. This verifies Apple's preview
framework, not an actual iMessage send or physical iPhone cache behavior.
All five public demo journeys also pass live share-page and 480px thumbnail
GET/HEAD checks. Implementation, deployment and current documentation are complete.

## Measured performance pass — 16 October 2026

Owner authorized executing the phone/desktop interaction and loading priorities,
with numeric before/after evaluation for every fix. Work is isolated on
`codex/performance-pass`; the frozen comparison is `9dc7827`. Implemented scoped
page data and catalog covers, complete asset hashing, comment row/draft reuse,
cached reader media ordering/filmstrip identity, and compositor movement for the
phone Location sheet. [Matched measurements and limitations](docs/PERFORMANCE_PASS_2026-10-16.md)
show phone Location open layouts 16→3, same-photo map calls 2→0, Comments
warm-open handler 42.0→27.9 ms at 4× CPU, family data 542,573→72,136 gzip bytes
and catalog data 250,805→2,176 bytes. Frame gaps are unchanged; phone style
recalculation increased despite lower total task work. Preserve those limits.

Integrated current main `78334da`, including visible-control zoom, in `7b44e29`.
All **781 tests pass** after the final browser-discovered desktop correction:
CSSOM-normalized transform ownership restores fitted same-photo reopen (2.5×→1×).
The build passes; phone 390×844, landscape 844×390 and desktop 1360×900 browser
checks pass with no page exceptions, including Location reversal/cancel, zoom
controls, close/reopen and grid return. The owner explicitly approved merging,
deploying and verifying [PR #1](https://github.com/gravelcycles/travels/pull/1).
Published as `6fefc36` through successful
[Pages run 38945230961](https://github.com/gravelcycles/travels/actions/runs/38945230961).
Five fresh public pages and 43 unique script/style assets match the tested release
byte-for-byte. Fresh demo checks at phone, short landscape and desktop verify
Location/Comments, photo navigation and fitted reopen after 2.5× zoom; Heading East
also verifies existing signed-in full-size image access, empty-thread loading,
mobile Location and retained grid selection. No console errors or live comment
writes. The known long-notes/short-landscape map-height issue remains in TODO.
This implementation batch is delivered. The AVIF migration and measured
follow-up below are also delivered. Their byte, decode and neighbor-readiness
results remain separate from this first performance batch; WebP fallback and
originals are preserved.

Post-migration follow-up was developed on `codex/avif-performance-followup`, based on
`504bd26` (deployed application `62d8c69`). Independently verified all 223 pairs:
AVIF adds 57.60% pixels and 4.28% full-photo bytes; existing WebP metadata is
unchanged. Matched local browser runs compare fresh/304/application-Blob reuse
and decode at phone/desktop frame sizes, with physical-device limits recorded.
The bounded nearest-neighbor sharing candidate passes 87 loader/plan tests and
independent review. In a deterministic recurring-thumbnail workload it reduces
neighbor attempts 7→1, discarded bytes 784,000→0 and bytes-ready time 14.00→9.26 s,
with the last thumbnail 0.24 s later; this is not an observed browser speedup.
The owner's later clarification identifies full-screen swiping on mobile Chrome
as still laggy. Eight real-app cached interruptions reproduce 52–53 px jumps
before the correction and 0 px after, with zero photo requests/decodes. Fitted
zoom resets reduce geometry reads 34→18 per cached swipe; the small handler-time
differences do not establish an overall latency/FPS gain. Integrated current
main `75f4e04`, retaining thumbnail sharing and all saved Heading East selections
and notes. The merged loader is the exact union of the scheduler and sharing API;
comment/share eligibility indexes match incoming main byte-for-byte.
All **848 tests pass**; two builds are identical across 78 public files. Family, Heading East, the Alpine
demo and an independently generated populated draft each pass all 14 browser
gesture/zoom/Location/grid/history/event-boundary checks at 390×844, without page
errors. Landscape has an identical pre-existing partially clipped thumbnail
scroll adjustment (20→8 px before entry) on baseline and candidate; recorded in
TODO. Physical phone performance and the baseline long-frame outliers remain
explicit limits. [Methods and results](docs/PERFORMANCE_FOLLOWUP_2026-10-16.md).
Merged browser verification also passes: eight final interruptions have 0 px
jumps and the updated 101-photo Heading East gallery passes 14/14 checks. The
later docs-only publication receipt `0854113` is integrated. Published through
[PR #3](https://github.com/gravelcycles/travels/pull/3) as `a940395`, following
successful [Pages run 38956100537](https://github.com/gravelcycles/travels/actions/runs/38956100537).
Five fresh public pages and 43 referenced script/style assets match the tested
release byte-for-byte. Live 390×844 checks pass forward/reverse full-screen
swipes, Location open/close, empty Comments loading and gallery selection/history.
At 1360×900, desktop navigation resets 2.5× zoom and reveals the ready native
AVIF immediately. No console errors or comment writes. The existing Worker and
all concurrent content remain intact. The post-AVIF follow-up automation is paused;
this release is complete, with physical-device and existing landscape limits
retained in the report/TODO.

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

## Original-resolution AVIF migration — 16 October 2026

Authorized: migrate photo quality with no downtime or regressions, retaining full
WebP fallbacks and all source/editorial data. See
[owner direction](docs/OWNER_DECISIONS.md#photo-quality-migration--16-october-2026).
Implementation is isolated on `codex/photo-avif-20261016` in this chat's
`work/travels-avif` checkout. Current main `1c2ced4`, including the performance
release and visible-control zoom correction, is integrated. The shared checkout's
ongoing edits are intact. Native decoding preserves the established RAW appearance
through verified full-resolution Quick Look; HEIC uses ImageIO.

All **825 integrated tests pass**. Two final builds are identical across 72
outputs. The scoped public bundles retain all 223 AVIF descriptors and exclude
unpublished upgrades without changing fallback metadata. Original hashes, native
sizes, stripped metadata, derivative hashes and all 254 source rows' existing
fields/order pass the final audit. Earlier focused checks include 34 decoder/import
tests, 69 loader tests and actual Cloudflare runtime tests.

Compatible Worker `33b135c6-21d7-4c6a-b366-2e217e6ab7b3` is deployed; pre/post
live WebP and uploaded AVIF checks pass authenticated GET/HEAD, anonymous 401,
SHA-256/MIME and 304 revalidation. Prior Worker
`680b93ec-0a1c-4116-a54e-5f37dbd766d3` is retained as the rollback target.
All 223 visible protected photos (103 family, 120 Heading East) are uploaded and
downloaded for exact SHA-256, size and MIME verification, with zero failures:
234,970,250 AVIF bytes versus 225,321,190 full WebP bytes (+4.28%) for 57.60%
more pixels. The additive rollout retains every WebP object and URL.

After the performance integration, all 16 rendered model/viewport combinations
and four first-swipe/grid retention checks pass across family, Heading East city
mode, a demo and an independently populated draft using scoped page data. Both
real authenticated candidate galleries pass native AVIF decoding, portrait/landscape,
mobile swipe, desktop/mobile focal zoom, lock clearing and forced AVIF 404 recovery
to real WebP, with zero page errors; Heading East includes two RAW derivatives.
Earlier browser checks also cover unsupported AVIF, wrong MIME and corrupt images.
Published as `62d8c69` through successful
[Pages run 38946882288](https://github.com/gravelcycles/travels/actions/runs/38946882288).
Five fresh public pages, all 43 referenced script/style assets, three legacy data
bundles and the scoped-data inventory match the tested release byte-for-byte
(52 files total). Both actual public galleries pass all the real-photo checks
above, including six distinct native-resolution samples, two RAW derivatives and
one forced AVIF failure recovering full WebP per gallery. No page errors or
service interruption were observed. Physical iPhone/Safari behavior is not
certified by Chrome viewport emulation.

The guarded local Studio sync applied 32 scoped files, copied 223 verified AVIFs
and merged only their descriptors into four manifests, with backups and an
incremental journal. All 668 tests and the local build pass in the owner's shared
checkout. After rebuilding six intended public outputs, 288 unrelated files,
including 38 tracked dirty files and all three override files, remain byte-identical.
All 244 local photo records retain their existing fields and order. The shared
checkout remains uncommitted on its original branch and HEAD; the migration does
not publish its unrelated edits. Future photo imports now prepare AVIF upgrades
through the shared encoder; existing WebP delivery remains available.

## Saved Heading East photo data — 16 October 2026

Authorized: publish the owner's saved local photo data/metadata. The release is
isolated in `/Users/dg/Documents/Codex/2026-10-16/i-m/work/travels-release`
from remote main `22a88b6`; primary-checkout feature work remains untouched.
The [trip record](docs/HEADING_EAST.md#saved-photo-and-metadata-publication--16-october-2026)
documents four visible Berlin additions, two new trashed uploads, three existing
photos moved to Trash, and the owner's saved pins, notes and order. Preserve the
four additions' actual capture timestamps and explicit Berlin placement.

All 11 private derivatives (4,643,194 bytes) were uploaded/reused and downloaded
for SHA-256 verification. All **740 tests**, the production build and actual
Worker runtime checks pass. Two build-test fixtures now preserve unrelated saved
photo assignments instead of erasing them. Generated public metadata/order
matches the saved sources exactly; the gallery and comments index contain the
same 120 visible IDs, with all trashed IDs excluded. Integrated the concurrent
solid-controls release through `1f9a8bf`; all 740 tests and the build still pass.

Published as `0cef1bb` through successful
[Pages run 38939110454](https://github.com/gravelcycles/travels/actions/runs/38939110454).
Worker version `680b93ec-0a1c-4116-a54e-5f37dbd766d3` activated the matching index
before Pages. Fresh public catalog/Heading East HTML and all three metadata
bundles match the release byte-for-byte. Anonymous photo/comment reads return
401. A fresh authenticated browser load shows 120 total photos, Berlin's 24-photo
album and the newly added river photo at its saved second position, with the
actual July timestamp and saved map pin. Studio's four verified uploads are now
marked published locally and its generated output is refreshed. The primary
checkout's unrelated work is preserved. Delivery is complete. Preserve the
outbound-update ledger and history; no message was sent or marked shared.

## Photo intermediate screens — 16 October 2026

Later owner clarification: make the **whole header** on Comments and Photo
location easy to drag closed, including title, blank space and the Close control;
preserve ordinary taps, native scrolling/map input and photo/draft/history.
The follow-up extends O17/O08 and is implemented in the same isolated checkout,
including second-finger cancellation outside the header. All **750 tests** and
the reproducible build pass. Header checks pass for all four models at 320/390px,
landscape and desktop. Seven final integration cases and an ordinary-motion
phone case pass native Close taps, every header region, sideways starts,
short/cancelled pulls, second-finger body cancellation, independent content
scrolling/map panning and photo/draft/history retention, without browser errors.
Current main's saved photo metadata, solid controls, right-aligned actions and
experiment retirement are preserved. Evidence is in ignored
`build/header-drag-qa/`; these are Chrome viewport checks, not physical-device
certification. Released as `5667d26` through successful
[Pages run 38940462823](https://github.com/gravelcycles/travels/actions/runs/38940462823).
All four fresh public journey/demo pages and six runtime/style assets match the
tested build. Public demo checks at 390px, short landscape and desktop verify
whole-header and Close-origin dragging, native taps, short-pull return,
secondary-touch cancellation, retained photo/draft/history and keyboard Close,
with no browser errors or real comment writes. This follow-up is complete.

Separate existing layout gap found during verification: long photo notes can
consume the entire location panel at 844 × 390, leaving its map zero-height.
Reproduced with the prior `27a88eb` stylesheet. Header dismissal and note scrolling
work; landscape map-pan verification uses a short note. Track the layout repair
in TODO; it is not part of the whole-header gesture correction.

Authorized correction: notification rows open the fullscreen photograph with
comments above it, simplify repeated photo information in that sheet, and allow
dragging it closed. [O17](docs/OWNER_DECISIONS.md#comment-notifications--11-october-2026)
and [the conversation contract](docs/PLACES_AND_COMMENTS.md#comment-notifications)
own the requirements. Implemented on `codex/photo-intermediate-cleanup` in
`build/photo-intermediate-cleanup`, integrating current main through `4c5f44c`
and preserving the fullscreen focal-zoom, map-opening and swipe/Places corrections.
The primary checkout's unrelated edits remain untouched. All **740 tests** and
the production build pass. Browser checks pass all 16 reference/demo/populated
fresh draft/Heading East × desktop/320/390px/landscape cases, plus ordinary-motion
phone checks. They cover direct entry, compact layout, target comments beyond
page one, draft preservation, independent scrolling, drag cancellation and
Close/Back/Forward. Seven delta checks pass after the later swipe integration,
including swiping after sheet dismissal. QA uses synthetic comments/images,
not real visitor writes; it is Chrome viewport coverage, not physical-device
certification.

Released as `27a88eb` through successful
[Pages run 38937773058](https://github.com/gravelcycles/travels/actions/runs/38937773058).
All four fresh public journey/demo pages and six runtime/style files match the
tested build byte-for-byte. Fresh public demo checks at 390px and desktop verify
notification → correct fullscreen photograph + compact comments, drag-close to
the photograph, preserved drafts and Back/Forward, with no browser errors or
live comment writes. The comment correction is complete.

The location-group card is a separate design-review request. The
[selected-photo tray proposal](docs/PHOTO_SELECTION_PROPOSAL.md) reduces duplicate
information and actions. Later owner feedback asks how it works on desktop and
mobile: the first isolated phone card did not explain its placement or return
path. The proposal now maps both flows explicitly and has a comparison of the
existing desktop sidebar and phone bottom card, including fullscreen/Back and
grid return. The revised comparison passes 1024px/320px browser checks for both
device flows, state retention and overflow; all 781 tests and the build pass
after integrating current main. This clarification does not approve implementation. The original
interactive review was checked at 320/390px and
desktop with selection, image opening, event grid and dismissal. It remains a
proposal, not a production change;
preserve O03's map selection boundary and continuous journey browsing. Do not
publish a replacement for that card until the owner chooses the direction.

## Mobile photo swipes and Places dragging — 16 October 2026

Owner correction: make the first fullscreen phone photo swipe continuous and
later swipes slightly smoother; after Show map, allow direct Places-sheet
dragging across a large part of its top bar. Current requirements are in
[O04/O08](docs/OWNER_DECISIONS.md#mobile-swipe-continuity--16-october-2026)
and the [Places correction](docs/OWNER_DECISIONS.md#mobile-places-visibility--12-october-2026).
Implemented in `codex/mobile-swipe-places`, integrating concurrent overview and
fullscreen-controls/focal-zoom changes through `34b72b2` and the map release
receipt `b6df1ec`. The primary checkout's unrelated work remains intact.
All **723 tests** and the
production build pass, including Places stylesheet cache invalidation. Rendered
checks pass **16 Places and 14 fullscreen cases** across reference, Heading East,
Alpine demo and an independently populated fresh draft at 320/390px, landscape
and desktop. They use synthetic public/protected-local images and a blank
MapLibre basemap; no real private pixels or comments were accessed. Additional
checks cover reduced motion, delayed neighbors, pinch, retained grid nodes and
list scrolling. An immediate map pan 50 ms after Show map now cancels delayed
recentering and retains its exact camera. QA scripts/results are in
`/private/tmp/mobile-swipe-places-browser-qa/` and adjacent task `.mjs` files.
The combined fullscreen-controls/focal-zoom release also passes first/cached
swipes, hidden-chrome swipes and restoration, full-viewport geometry, grid Back
and Places dragging/map panning on Heading East and Alpine.

Released as `1b5ab7e` through successful
[Pages run 38937337942](https://github.com/gravelcycles/travels/actions/runs/38937337942).
Fresh public catalog/reference/Heading East/Florence/demo HTML and nine shared
assets match the tested build byte-for-byte. A fresh public Alpine phone check
at 390 × 844 passes with live map tiles and public sample photos: first and
cached/hidden-chrome swipes, control restoration, grid Back, Show map, broad
header dragging and exposed-map panning. No page errors or private-media
requests occurred. Screenshots and results are in
`/private/tmp/mobile-swipe-places-public-qa/`. Implementation and delivery are
complete. Physical-device Safari was not used.

## Fullscreen photo controls and focal zoom — 16 October 2026

**Visible-control zoom follow-up — deployed and verified.** The
owner wants zoom to fill the black background even with controls shown. Mobile
zoom now removes continuous header/footer backgrounds, keeps every button and
label opaque, and lets image input pass through gaps. Fitted photos retain solid
bars; right alignment and Share/Comments order stay intact. This supersedes the
intermediate requirement for opaque bars during zoom; current guidance is in
O03/O08 and the photo workflow. All **751 tests**, the production build and
**16 browser fixtures** pass across reference, Heading East, Alpine demo and an
independently populated city draft at 320/390 px, landscape and desktop. Pixel
checks confirm photo coverage at top/bottom edges with visible chrome; computed
styles confirm opaque buttons, including disabled controls. Native input checks
cover gap panning, focal pinch, hiding/restoration, zoom-out and active-pinch
access reset. Bright/dark screenshots were inspected; close/resize/breakpoint
reset regressions pass. Independent review passes; no physical-device claim.
Released as `fa27585` through successful
[Pages run 38941740860](https://github.com/gravelcycles/travels/actions/runs/38941740860).
All four fresh public journey/demo pages and both changed shared assets match
the tested build. A fresh public demo at 390px and short landscape confirms
full-screen photo coverage behind opaque controls, tap hiding/restoration and
solid bars returning on zoom-out, with no browser errors. Delivery is complete.

**Alignment follow-up — deployed and verified.** The owner
clarified that the next-city and Comments buttons must be right-aligned. Keep
Share immediately left of Comments, replacing the mistaken left-aligned action
group. Give city/day navigation its own full-width row in portrait and landscape;
reserve Close’s space only in the top row. Current rules live in O08/O18 and the
photo workflow. All **740 tests**, the build and **16 rendered browser cases**
pass across reference, Heading East, Alpine demo and an independently populated
city draft at 320/390 px, short landscape and desktop. Geometry checks verify
the city buttons’ opposite safe edges, centered label, Close clearance and
Comments-right/Share adjacency, alongside solid styling, hiding and focal zoom.
Phone and landscape screenshots were inspected. Independent review found no
cascade issue; an extra browser case passes hidden event-nav/Comments layouts.
No physical-device claim. Released as `8a8efe8` after integrating the latest
receipts. [Pages run 38939958806](https://github.com/gravelcycles/travels/actions/runs/38939958806)
succeeded. Fresh public CSS and all four journey/demo pages match the build.
The live Alpine photo in portrait and short landscape confirms previous/next
buttons 10 px from the edges, Comments 12 px from the right and Share 8 px to its
left. Screenshots and measured geometry pass; no comment writes were made.
Delivery is complete.

**Button-style follow-up — deployed and verified.** The
owner rejected the translucent buttons as a regression after the release below.
Restore the original solid mobile header/footer and opaque Close/Share/Comments
surfaces, retaining layout, tap-to-hide and focal zoom. Direction is recorded
in O03/O08/O18 and the photo workflow. All **740 tests** and the production build
pass. All **16 browser fixture combinations** (reference, Heading East, Alpine
demo and an independently populated draft at 320/390 px, landscape and desktop)
pass solid-surface/no-blur assertions, tap recovery, full-viewport geometry and
focal zoom; phone and landscape screenshots were inspected. Independent review
found no cascade or scope issues. Physical-device testing is not claimed.
Released as `1f9a8bf`; [Pages run 38938835608](https://github.com/gravelcycles/travels/actions/runs/38938835608)
succeeded. Fresh public mobile CSS and all four journey/demo pages match the
tested build. A fresh public Alpine photo at 390 × 844 confirms opaque surfaces,
no backdrop blur, the full-viewport stage and tap-to-hide/restore. Delivery is
complete; the primary checkout remains untouched.

**Initial release completed; later alignment is corrected above.** The owner requested mobile fullscreen
Share beside Comments, top-right Close, one tap to hide all buttons
for just the photo, and zoom that uses fullscreen. The follow-up adds pinch
focus that follows the fingers on mobile and desktop. Current requirements and
supersessions live in
[O03/O08/O18](docs/OWNER_DECISIONS.md#fullscreen-photo-controls-and-focal-zoom--16-october-2026)
and the [photo workflow](PHOTO_WORKFLOW.md#fullscreen-controls-and-focal-zoom).
Back/pull/grid continuity, location gestures, sharing semantics, photo loading,
private access are retained.

Work is isolated in `/Users/dg/.codex/worktrees/photo-fullscreen-gestures/travels`
on `codex/photo-fullscreen-gestures`. The shared template/mobile layout now
places Share beside Comments and Close top-right, overlays controls on the
full-viewport stage and toggles chrome on single tap. `photo-zoom.js` provides
shared focal math and the desktop Ctrl+wheel/trackpad, Safari gesture-event,
two-pointer pinch, double-click and pan controller. Mobile uses the same focal
math; desktop zoom keeps its existing stage and context sidebar.

Integrated remote main through `8d5a117`, preserving the concurrent map-overview,
manual-update releases. **All 707 tests and the production
build pass**, with reproducible public output. Synthetic-fixture browser checks
pass all **16 combinations** of Switzerland–Italy, Heading East, Alpine demo and
an independently populated city draft at **320 × 568, 390 × 844, 844 × 390 and
1360 × 900**. These include full-viewport geometry, native moving-pinch input,
portrait/landscape zoom, city controls, Share/Comments adjacency and top-right
Close. Screenshots were visually inspected. The post-integration Alpine phone
check also verifies keyboard restoration after hiding controls. Regressions
cover cancelled taps, remaining-finger pinch release, grid return and private
access lifecycle. Physical iPhone or Safari-device testing is not claimed.

Released as `34b72b2` after integrating main through `8d5a117`.
[Pages run 38936841288](https://github.com/gravelcycles/travels/actions/runs/38936841288)
succeeded. Fresh public reference/Heading East/demo HTML and all six changed
viewer assets match the tested build byte-for-byte. The fresh public Alpine
photo loaded and passed 390 × 844 full-viewport, Share/Close, tap-to-hide,
double-tap zoom, Tab recovery and Close-to-map checks in the in-app browser.
Direct Node HTTP timed out; the system HTTP client and live browser checks
succeeded. No implementation or delivery work remains. The primary checkout's
unrelated edits remain untouched.

## Unselected map opening — 16 October 2026

Owner correction: first map opening must not show Stop 1 already selected,
on phone or desktop. [O06](docs/OWNER_DECISIONS.md) and the
[opening workflow](JOURNEY_WORKFLOW.md#opening-route-trace) own the shared rule.
The isolated `codex/map-entry-overview` checkout gates row/route/signpost and
journal selection on map scope, uses neutral phone overview labels, and starts
next-event navigation at the first event. Explicit day/photo links retain entry.
Implemented and locally verified: shared navigation/trace/history regressions,
production build, and eight headless Chrome cases at 1440 × 1000 and 390 × 844
across Switzerland–Italy, Heading East, Alpine demo and an independently created
populated draft. Checks cover neutral opening, first/second-event selection,
All days/stops, direct entry and zero JavaScript errors. Public demo photo-card
selection clears on overview on both sizes. Heading East's phone Places count
and list follow overview 20 → Stop 1's 2 → overview 20; no event filter is
selected in overview. These are Chrome viewport checks, not physical-device QA.
Integrated remote main through `3fb52f2`; all **682 tests** and the production
build pass with reproducible checked-in output. Released as `8d5a117` through
successful [Pages run 38936565821](https://github.com/gravelcycles/travels/actions/runs/38936565821).
Fresh public reference/Heading East/Florence/demo HTML and both changed runtime
assets match the tested release byte-for-byte. A fresh 390 × 844 guest Chrome
load of Heading East shows zero selected rows/markers, All stops, the whole
journey card and Places · 20, with no JavaScript errors or protected-media
requests. Implementation and delivery are complete. The subsequent fullscreen
release has integrated this correction; its verification belongs to that
workstream above. The primary checkout's unrelated pending changes remain untouched.

## Outbound trip update checkpoints — 16 October 2026

Authorized: start checkpointing and calculate useful messages, likely for manual
WhatsApp broadcasts. [O19](docs/OWNER_DECISIONS.md#outbound-trip-updates--16-october-2026)
and the [workflow](docs/UPDATE_ANNOUNCEMENTS.md) supersede the proposal-only state
for this bounded work. No outbound provider, recipient list or sending is
authorized. Implementation is isolated in the managed `update-checkpoints`
worktree from `d3a7af1`, preserving the primary checkout's pending photo edits.

Implemented public-metadata snapshots, stable-ID diffs/messages and a recoverable
local ledger. Prepare does not acknowledge; mark-shared acknowledges only a frozen
draft after owner confirmation. All **678 tests** and the production build pass;
generated public output and the Worker index are unchanged. Independent review
identified malformed shared timestamps; validation now rejects them, with a
regression covering the previously misleading pending/acknowledged state.

The initial live baseline was captured **16 October 2026, 18:54 Vienna time**:
**3 real trips, 222 visible photos**. Its durable local file is
`/Users/dg/code/travels/build/update-announcements/whatsapp/ledger.json`, outside
the disposable release worktree. A second fresh public read returns no new trips
or photos. No draft is marked shared, and no message was sent. Preserve this
ignored directory and its backups; do not recreate the baseline in a new worktree.
Released as `d451b58` after integrating current main through `d3a7af1`.
[Pages run 38935849640](https://github.com/gravelcycles/travels/actions/runs/38935849640)
succeeded. A fresh public catalog, reference page and all three metadata bundles
match the release byte-for-byte and still produce an empty diff. The same tooling
is installed in the primary checkout; all 38 focused checks pass there with its
unrelated changes preserved. This completed the initial checkpoint release.

**Later 16 October correction — trip-specific updates:** the owner normally
notifies different people for each trip and will ask for an update per trip.
O19 and the workflow now require selection before freezing a prepared inventory;
sharing A must leave B and subsequent additions pending. With multiple published
trips, `diff`/`prepare` require `--trip ID` or deliberate `--all`; `status` reports
trip IDs/titles, known photo counts and last-shared times. Preserve the baseline
above and existing schema 1 history without reset or migration. Multiple audiences
within the same trip still need separate state directories.

Implemented in the same managed worktree after integrating main through
`1b5ab7e`. All **730 tests** and the production build pass, including cross-trip
isolation, later additions, legacy history and selection errors. Generated
public output and the Worker index remain unchanged. Independent review caught
combined snapshots attributing a share to unchanged trips omitted from the
message; status now uses only the actual announced trip list, with malformed
lists rejected without modifying history. Released as `9614681` through successful
[Pages run 38937572609](https://github.com/gravelcycles/travels/actions/runs/38937572609).
A fresh public catalog, reference page and all metadata bundles match the release;
each of the three trip-specific diffs is empty. The original ledger checksum is
unchanged, with no prepared or shared messages. The primary checkout has the
same tooling and scoped guidance; all **45 focused checks** pass with unrelated
edits preserved. This correction is complete. Studio UI and automated sending
remain optional future work.

## Depth experiment retirement — 16 October 2026

The owner rejected and requested removal of the experiment; the current rule is
[the retirement decision](docs/OWNER_DECISIONS.md#depth-motion-experiment-rejected--16-october-2026).
Source and seven private depth maps are archived locally under ignored
`build/archives/depth-demo-20261016/`, with its inference tools. The standalone
code/assets, build hook and detailed demo docs are removed; both experiment
branches are deleted. Original trip photographs and concurrent site work remain
intact. All 740 tests and the build pass. Removal release `0542c09` passed
[Pages run 38939247380](https://github.com/gravelcycles/travels/actions/runs/38939247380):
all ten former demo/asset URLs return 404 and three normal atlas pages return 200.
All seven unreferenced private depth objects were removed and verified absent;
their archived checksums match. This experiment is closed, with no integration
or further implementation pending.

## Mobile Places visibility — 12 October 2026

Owner request: opening Places must expose places on iPhone 12 and larger phones.
O08's [mobile Places correction](docs/OWNER_DECISIONS.md#mobile-places-visibility--12-october-2026)
and the Places contract own the accepted behavior. Work is isolated in
`/private/tmp/travels-mobile-places` on `codex/mobile-places`, based on main
`45cdef1`; the primary checkout's concurrent edits remain untouched.
Implemented list-first opening, explicit map/list control and progressive category
filters, plus a landscape side sheet with unobstructed event navigation. All
640 tests and the production build pass. Headless Chrome checks passed 32
trip/viewport cases: Heading East, Alpine demo, an independently created city
draft and the empty reference at 320/375/390/414/430 px, a shortened 390 px
viewport, 844 × 390 landscape and 1360 px desktop. Checks cover visible complete
cards, map/list switching, filters/empty escape, details/gallery, Back/Forward,
scroll retention and no horizontal overflow. Integrated main through `1b35343`,
preserving the newly published chronological city albums. Release `6a195a6`
passed [Pages run 38265530459](https://github.com/gravelcycles/travels/actions/runs/38265530459).
Fresh public reference/Heading East/Florence/demo pages and Places JS/CSS match
the tested build byte-for-byte. A fresh public 390 × 844 browser load shows both
Luzern cards immediately, with a 507 px result viewport. Implementation and
public delivery are complete; physical-device Safari was not used for these
Chrome viewport checks.

## Heading East photo chronology — 12 October 2026

Owner request: order photos chronologically within each city. The existing day
`photoOrder` overrides now interleave both batches by capture time, preserving
city membership, cover, photo edits and Trash. The scoped rule and superseded
append-only intake choice are recorded in [the trip record](docs/HEADING_EAST.md#chronological-city-albums--12-october-2026).
Work is isolated on `codex/heading-east-photo-chronology` in
`/private/tmp/travels-heading-east-photo-chronology`; unrelated primary-checkout
edits remain intact. All 637 tests and the production build pass. Actual desktop/
phone viewer functions verify all 119 visible photos in seven chronological
city albums, unchanged membership/cover and exact source/generated order parity.
Released as `42dc9d9` after integrating main through `45cdef1`.
[Pages run 38264639120](https://github.com/gravelcycles/travels/actions/runs/38264639120)
succeeded; fresh public Heading East HTML and three data bundles match the
release byte-for-byte, and all seven live city albums are chronological. The
primary checkout has the same order with its pending content/Trash edits
preserved. No image upload or Worker deployment was needed. Work is complete.

## State persistence audit — 12 October 2026

Owner request: verify other features retain state after the fullscreen fixes.
Completed the audit and repaired album/dialog scroll resets, album tile rebuilds,
Places detail resets on photo return/reopening, and lost detail/tab scroll on
Forward. Current owner/photo/Places guidance and
[the evidence matrix](docs/PERSISTENCE_AUDIT_2026-10-12.md) record scope and limits.
Work is isolated in `/private/tmp/travels-mobile-dismiss` on
`codex/persistence-audit`; source `ddfcc52`, integration `53890f5` includes remote
main through `c0661a7`; final integration `9ecd943` also includes the Studio
field/frame corrections in `4654fe0` without changing generated public output. All **637 tests** and the production build pass; phone
checks cover reference, Heading East, demo and independent content. Desktop demo
checks cover comment drafts, nested identity, reload, review drafts and retained
place disclosures. Integrated album/Places history smoke passes. No production
comments or real trip edits changed. Deployed as `b4e4b9a` through successful
[Pages run 38219260545](https://github.com/gravelcycles/travels/actions/runs/38219260545).
Fresh public reference/Heading East/Florence/demo pages and the three changed
runtime assets match the build byte-for-byte. The live demo album passes the
scrolled grid Back/Forward check. No implementation or delivery work remains.

## Mobile opening-trace interruption — 12 October 2026

Owner follow-up: “the trace starts and then flashes to show the full map.”
This reopens the mobile acceptance of the initial trace release below. Reproduced
with actual MapLibre: an automatic resize at 455 ms ended playback at 15%.
Shared opening code now ignores internal movestart events, refits immediately on
resize, and hides rebuilt native routes without cancelling or restarting the
clock. Deliberate input/navigation still interrupts. O06 and the opening-route
contract own the correction. Work remains in `build/opening-route-trace` on
`codex/opening-route-trace-20261012`, initially based on main `d74d489`.
Integrated main through `f1584cb`; all **615 tests** and the production build pass, including resize/redraw checks
on reference, city atlas, demo and an independent draft. Actual MapLibre phone
checks now complete at 100% after approximately 3,000 ms through the same resize.
Browser coverage includes reference, Heading East, Alpine demo and an independent
populated draft at 320/390px, desktop and 844px landscape. Playback reaches 100%
through resize; navigation cancels both pending entry and an active trace.
Private photo loads were excluded from map QA. Deployed as `f360382` through
successful [Pages run 38217199004](https://github.com/gravelcycles/travels/actions/runs/38217199004).
Fresh public reference/Heading East/Florence/demo pages and opening runtime
assets match the tested build byte-for-byte. The public demo retains its active
trace through a phone viewport resize. No implementation or delivery work remains.

## Photo and view sharing — 12 October 2026

Fullscreen-desktop follow-up: Share now belongs in the right sidebar beside
the photo count, below the day controls (O18). Shared markup/styles updated in
`codex/photo-sharing-20261012` after integrating main `07d1896`; the phone
header placement from this release is superseded by the
[16 October correction](#fullscreen-photo-controls-and-focal-zoom--16-october-2026). All **637 tests** and the production build pass. Browser checks
cover sidebar containment and share/copy at 1360/1024/901px, plus existing phone,
link and Back/Forward flows on the reference, Heading East, Alpine demo and an
independently populated draft. Deployed as `2797e75` through successful
[Pages run 38219940450](https://github.com/gravelcycles/travels/actions/runs/38219940450).
Fresh public pages and viewer assets match the tested build; a fresh desktop
load confirms Share in the right sidebar and the exact copied photo URL. Public
phone unlock/guest entry and Back/Forward also pass without private media reads.
No implementation or delivery work remains for this placement correction.

Authorized under O18: current day/photo/view URLs, Share with device sheet and
copy fallback, private access preserved, no history entry per photo swipe.
Implemented in `/private/tmp/travels-photo-sharing` on
`codex/photo-sharing-20261012`, starting at remote main `9143387`; primary-checkout
concurrent edits remain untouched. Integrated main through `7e3df65`; all
**616 tests** and the production build pass. Headless Chrome checks with labelled synthetic media cover reference,
Heading East, Alpine demo and an independently populated draft: selected/fullscreen
fresh links and reload, native-share payload/cancellation, copy and denied-clipboard
fallback, 320/390px phone and landscape, grid Back/Forward, manual hash changes,
cross-event links, deleted IDs, bare entry and empty albums. A separate locked
photo check retained the target URL and made zero private-media requests; auth
regressions verify the target hash survives remembered/locked login returns.
A simulated browser login round trip also checks prompt stacking and the exact
selected/fullscreen target before and after Continue without photos.
Deployed as `32e7cdf` through successful
[Pages run 38217922200](https://github.com/gravelcycles/travels/actions/runs/38217922200).
Fresh public catalog/reference/Heading East/Florence/demo pages and all five
changed viewer assets match the tested build byte-for-byte. A fresh public
phone session passed the real remembered-access check, visible unlock prompt,
Continue without photos, exact Share URL and Back/Forward; no protected-media
requests were made while locked. No implementation or delivery work remains.
Exact map framing and automatic saved visitor resume remain excluded.

## Mobile photo grid continuity — 12 October 2026

Owner follow-up: returning from fullscreen flashes when the “N photos” grid was
open and makes the previous screen feel impermanent. O08 and PHOTO_WORKFLOW now
require the presenting grid to remain behind the photo throughout the gesture.
Implemented in `/private/tmp/travels-mobile-dismiss` on
`codex/mobile-photo-dismiss`, based on main `c3c1083`. Shared code retains the
actual grid nodes, source collection, selection and scroll while its foreground
photo changes. Its photo background fades over that grid, preserving protected
image bindings. Integrated main through `b96c448`; all **604 tests** and the
production build pass. Browser checks on Heading East, Switzerland–Italy,
Alpine demo and an independently populated
draft cover 320/390px portrait, 844px landscape, scrolled source grids, cross-day
browsing, nested grid/photo Back/Forward, cancellation and direct story return.
Fixtures use labelled synthetic photos; the integrated browser smoke check also
passes. Deployed as `e4a7596` through successful
[Pages run 38216313781](https://github.com/gravelcycles/travels/actions/runs/38216313781).
Fresh public Heading East/reference/Florence/demo pages and all three changed
viewer assets match the tested build byte-for-byte. No implementation or delivery
work remains.

## Studio photo navigation and save feedback — 12 October 2026

Data-safety follow-up authorized: “ensure there's no data loss paths here.”
Implemented on `codex/studio-photo-data-safety` in the isolated release checkout:
raw photo input recovery/validation, stable selection while typing, guarded save/
restore/discard responses, detached autosave snapshots, duplicate-tab stream
ownership and exact disk acknowledgements. Only changed photo fields enter
overrides; merged fields refresh without moving the typing caret. Composed frames
survive intermediate coordinate keystrokes, and unlocated photos retain zoom. Real-handler tests cover unfinished
numbers, switching/reload, in-flight input and delayed recovery; real API tests
cover independent photo fields, conflict choices, lost-response retries, corrupt
draft reads and build rollback. Integrated main through `b4e4b9a`; all **637 tests**
and the production build pass, with unchanged generated output.
Browser checks cover the reference, Alpine demo and a populated independent city
draft, including reload before blur, search edits, offline save/restart/retry,
and discard/archive/restore of unfinished input. The task patch is applied to
the primary checkout without changing real photo sources; the updated local
server is running and serves the tested safety modules byte-for-byte. Release
`4654fe0` passed [Pages run 38219591303](https://github.com/gravelcycles/travels/actions/runs/38219591303);
a fresh public reference page matches the build. Implementation and deployment
are complete. Remaining activation: inspect/preserve pending input and refresh
the user's existing Studio tabs after browser-access confirmation. Automatic
approval review blocked tab access with a temporary rate-limit error; the tabs
remain untouched. Do not refresh them blindly or infer that pending input is saved.

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
family-publication checkpoints below. Explicit day/photo sharing is now authorized under O18. Remaining design work includes
the delight mockup; named Replay seeking was implemented on 11 October. Framework W04–W06
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
| Explicit day/photo/moment sharing | Day/photo/view sharing authorized 12 October under O18; see current workstream above. Moment/Replay sharing and saved visitor resume remain excluded. |
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
