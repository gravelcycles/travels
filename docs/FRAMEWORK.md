# One framework, many trips

Architecture audit: 10 September 2026; continuity guidance reconciled
11 October 2026. Read [OWNER_DECISIONS.md](OWNER_DECISIONS.md) and
[PRINCIPLES.md](../PRINCIPLES.md) before implementation or content intake.
Sharing a renderer does not ensure that an importer preserves blank copy or a
new panel preserves an established flow. The
[continuity audit](ATLAS_CONTINUITY_AUDIT_2026-10-11.md) explains the gaps and
the [journey checklist](../JOURNEY_WORKFLOW.md#new-atlas-inheritance-checklist)
defines acceptance for populated atlases.

The owner’s guiding principle is
99% shared behavior. That is a design target, not a measured percentage of lines
of code. Switzerland–Italy is the reference experience; each trip is content
rendered by the same application.

## What the September architecture audit found

We were already close in architecture, but had weak protection against drift.
There were five journey data records (one real, four fictional), one shared
viewer, one shared stylesheet, one Studio, and shared photo/Replay libraries.
No concrete journey-ID or trip-URL conditionals were found in those shared
browser implementations. A new trip already used the same viewer as the family
trip; no application rewrite or feature-copy exercise is needed tomorrow.

| Area | Before this change | Current contract |
| --- | --- | --- |
| Real trips and local draft previews | One `journey.html` template | Retained as the single journey page template |
| Sample page | Separately maintained 215-line HTML document | Generated from the same template as real trips |
| Cover introduction | Explicitly skipped for demos in `app.js` | Same introduction and single whole-trip-map entry for demos, real trips, and drafts; the template separates scrollable content from the persistent action row; unmapped drafts enter the day/stop list |
| Catalog | Build read and rewrote the existing output HTML | Generated from `content/templates/catalog.html` |
| Demo calendars | All four lacked machine dates/time zones; the rail example skipped calendar days | Complete dated calendars and time zones usable by Studio and photo intake |
| Editorial examples | No explicit cover configuration or curated Replay example | All demos have cover choices; saved chapters remain compatible, but full-trip Replay is disabled (O09) |
| Feature inheritance | Mostly true, but no dedicated page-parity contract | Regression suite compares controls/assets and exercises a fresh data-only trip |
| Agent guidance | Scattered workflows and historical notes; AGENTS only covered delivery | Standing shared-first rules, feature inventory, task prompts, and this migration plan |

Most visible differences were content maturity: the family trip has many more
photos, reviewed routes, custom cover framing, and edited Replay chapters.
A new trip gets the *capability* to use these features, not the family’s dates,
places, pictures, locations, text, or editorial choices. Features that need
photos or routes become useful when those inputs exist. Empty states are part
of the shared experience.

Demo dates are explicitly fictional. The rail example keeps its original dated
entries and IDs, inserting blank days between them. The road and bicycle
examples use representative September 2026 calendars; these are not travel
records. Sample photos and route geometry remain illustrative, not newly
verified geographic evidence.

Route construction for new instances follows
[ROUTE_GEOMETRY_WORKFLOW.md](../ROUTE_GEOMETRY_WORKFLOW.md): GPX or mode-appropriate
network geometry, explicit provenance, geometric review and static preservation.
An unresolved original track can have a clearly labeled reconstruction; the
shared endpoint fallback is not a substitute for completing authorized route work.

## Full-trip Replay disablement — 11 October 2026

[O09](OWNER_DECISIONS.md) supersedes the Replay availability described in the
September audit and earlier UX notes. Every generated viewer removes the
full-trip entry/resume controls. Its retained dialog is hidden and inert;
opening, playback and map initialization reject the inert player, and overlay
history cannot reopen it. Studio hides the chapter editor without changing
source serialization. Existing `replayMoments`, compatibility tests and dormant
player code remain. `replay-utils.js` still supplies route interpolation to the
separate arrival/city view, which remains available with its reviewed timing.
No per-trip switch or new data field is introduced.

## The model

```text
Trip facts + routes + photos + editorial overrides
                      |
               validated loader
                      |
     +----------------+----------------+
     |                |                |
 real trip page    sample selector   local draft preview
     +----------------+----------------+
                      |
       journey.html + shared JS/CSS
                      |
          map / arrival / journal / albums
```

Studio checks local routing readiness for every selected leg. Reviewed-preserve
policies guard unattended builds; explicit, read-only replacement proposals
remain available when local mode data exists and require acceptance before saving.

Studio edits the same sources; it is an authoring application, not a separate
trip implementation. The catalog is a separate view of the same real-journey
records. Photo protection is a shared service and namespace, not a per-page
password system.

## Where changes belong

| Source | Owns |
| --- | --- |
| `content/templates/journey.html` | All journey DOM, dialogs, control IDs, scripts and styles; real, demo, preview |
| `content/templates/catalog.html` | Public catalog shell |
| `dist/assets/photo-places.js`, `photo-bubbles.js`, `photo-bubbles.css` | Shared Photos + Places associations, stable geographic map groups separate from desktop journey browsing, protected thumbnails and selection through the existing desktop sidebar/phone compact card; map bubbles and right-hand reel thumbnails select, the large selected/lead image opens fullscreen (ordinary desktop/phone entry uses the journey roll under O03/O08; explicit Places collections retain scope); close old map popups before day changes and keep location thumbnails independent of album browsing |
| `studio/place-editor.js` | Owner Places, credited images, curated reviews and ordered trip-photo links through the existing plan/save/recovery flow |
| `dist/assets/view-sharing.js`, `view-sharing.css` | Shared view URL parsing/serialization, coalesced URL replacement and native share/copy fallback; surface controllers retain history ownership; no saved resume storage |
| `dist/assets/app.js` | Shared viewer, journal, map interaction, album, introduction; dormant full-trip Replay UI |
| `dist/assets/opening-route.js` | Shared three-second initial overview trace; reuses arrival geometry/clock/canvas, owns temporary route visibility and cleanup, survives automatic map resize/refitting and resynchronizes rebuilt native layers without restarting, preserves separate legs and disabled Replay |
| `dist/assets/location-labels.js` | Shared destination grouping, screen-space clusters, upright signposts, compact previews and accessible day selection |
| `dist/assets/map-feedback.js`, `map-feedback.css` | Shared map loading, recovery, Retry and no-location feedback; used in Studio too |
| `dist/assets/vendor/maplibre-5.24.0/` | Pinned MapLibre browser JS/CSS and license, served from the site |
| `dist/assets/map-style.js` | Shared basemap palette, restrained settlement typography, and route/label stacking for every viewer map and Studio |
| `dist/assets/atlas-utils.js` | Shared photo resolution, cover choice, camera helpers, preloading, desktop image reveals and other helpers |
| `dist/assets/group-travel.js`, `group-travel.css`, `scripts/journey-extras.mjs` | Shared group projection, roster/day route details, group/media presentation and optional data validation |
| `dist/assets/media-utils.js` | Mixed gallery items, opening-frame thumbnail extraction/cache, native video playback and cleanup inside the shared photo viewer |
| `dist/assets/replay-utils.js` | Automatic/curated timeline, route progress, pacing |
| `dist/assets/photo-auth.js`, `workers/photo-auth/` | Shared protected-photo access, loading and caching |
| `dist/assets/catalog.js`, `dist/assets/styles.css` | Catalog behavior and shared visual styles |
| `dist/assets/mobile-ux.js`, `dist/assets/mobile.css` | Shared mobile day navigation, continuous journey photo gestures including downward still-photo dismissal with cancellation/pinch arbitration, separate event jumps, event grids retained beneath fullscreen photos with one-level grid/photo history and scroll restoration, location panel, exact map-camera restoration on same-event Back/close and retained cross-event sidebar selection when dismissing Comments |
| `dist/assets/community-client.js`, `photo-comments.js` / `.css`, `places-comments.css`, `places-panel.js` | Shared floating photo conversations and place reviews; immediate presentation, authorized memory caches and retry behavior |
| `dist/assets/comment-notifications.js`, `trip-notifications.js` / `.css` | Shared journey-scoped local read IDs, exact photo/trip counts, cached trip metadata and recent-feed presentation; no per-photo count requests or public comment text |
| `dist/assets/input-mode.js` | Shared pointer/keyboard focus presentation for catalog, journeys and draft previews |
| `studio/` | Local authoring UI for any selected journey |
| `studio/plan-extras.js`, `scripts/studio-plan-sources.mjs` | Studio roster/group/overnight/meetup and hosted-video forms; source-preserving persistence of photo group assignments |
| `studio/ready-to-share.js`, `scripts/studio-readiness.mjs` | Shared read-only draft/source readiness assessment, revision-bound editorial choices and agent publishing handoff; never infer a verified public version from local or Git state |
| `scripts/journey-content.mjs`, `journey-planner.mjs`, `create-journey.mjs` | Loading, validation, planner rules, fresh-trip creation |
| `scripts/build-site.mjs` | Public builds and local preview page/data generation |
| `content/branding/`, `content/site.json`, `scripts/build-branding.mjs` | Shared globe-pin identity, reviewed icon/share rasters, public site URL and brand asset generation; see [BRANDING.md](BRANDING.md) |
| `content/journeys/<id>.json` | Reviewed trip identity, calendar, places, legs, cover and Replay choices |
| `content/route-geometry/`, `route-sources/`, `photo-manifests/` | Journey-specific reviewed assets and provenance |
| `content/*-overrides.json` | Human edits, keyed by stable day/segment/photo IDs |
| `content/drafts/`, `build/draft-assets/`, `build/studio-draft-overrides.json` | Ignored local drafts and edits |

**Source/output exception:** hand-authored JS/CSS currently lives under `dist`.
Do not delete that directory or treat all its files as generated. Generated
files are public HTML, `generated-pages.json`, and these data bundles:
`journeys.js`, `route-geometry.js`, `trip-photos.js`, `content-overrides.js`, and
`photo-service.js`. `dist/assets/brand/` is also generated: exact copies of the
reviewed assets in `content/branding/`. Edit their `content/` sources and rebuild. The build assigns
content hashes to public asset URLs; template authors do not maintain version
strings. Studio serves live assets with no-store caching.

## Explicit remote experiment — 14 October 2026

`prototypes/depth/index.html` builds to `dist/experiments/depth/index.html` for
the owner-requested [fullscreen depth-motion review](DEPTH_FULLSCREEN_DEMO.md).
Its demo JS/CSS and two public sample pairs live only below that experiment
directory and are not loaded by the catalog, journey template or Studio. The
15 October revision also references seven existing protected website photographs;
their depth derivatives stay in private R2 and use the existing authenticated
photo gateway, never the public experiment directory. Reuse the normal photo
access and expiry lifecycle; no separate demo password or public pixel fallback.
This bounded review artifact
is not a second journey implementation. Integration remains undecided; if
approved, use the shared viewer and protected derivative pipeline rather than
copying this demo shell into a trip. Its drag, Mouse move, Slow drift and gentle
0–100% Movement controls remain experiment-only. The 15 October owner correction
supersedes the former 0–3× range/presets. The build versions the demo modules/style and sample manifest together, including
the lazy shader import and manifest request, to keep subsequent remote revisions consistent.
No speculative journey flag/schema added.

## Rules for adding features

1. Classify the request: trip content, a generally useful capability, or a true
   exception. Put content changes in that trip’s JSON/overrides.
2. Add generally useful behavior to shared code/template. Default it on for all
   applicable data; a sample or new trip must not need a special enablement step.
3. Prefer existing data customization: `coverPhoto`, photo/day
   overrides and routing manifests already provide per-trip editorial choices.
4. If one trip really needs new behavior, add the smallest named optional data
   field and a shared renderer/helper. Validate its type and references, define
   an absent-value fallback, and document why it exists and who uses it. Test
   both present and absent cases. Add a schema migration if old data needs one.
5. Never write `if (journey.id === 'some-trip')`, trip-specific CSS selectors,
   cloned HTML, or copied application bundles. Do not invent a general plugin
   framework or a set of feature flags before a concrete feature requires it.
6. Update [FEATURES.md](FEATURES.md), the relevant workflow and tests in the same
   change. Capture reusable owner corrections and superseded choices in
   [OWNER_DECISIONS.md](OWNER_DECISIONS.md); reconcile contrary current guidance.
   Its [live update procedure](OWNER_DECISIONS.md#record-the-next-correction-before-closing-the-task)
   applies during the task and before delivery, including short follow-ups.
   Use [AGENT_PROMPTS.md](AGENT_PROMPTS.md) to brief the next agent with links
   to current guidance and any unfinished work, not a frozen copy of the rules.

Saved fourteen-chapter Replay metadata remains trip data. Full-trip playback
and its controls are disabled globally; arrival/city animation remains shared behavior.
The same distinction applies
to a chosen cover versus the introduction component, and a drawn ferry route
versus map rendering.

## How inheritance is verified

`npm test` includes `test/shared-framework.test.mjs`. It checks:

- Matching control IDs and browser asset lists for the family page, all sample
  previews, the public sample page, and a freshly generated empty draft.
- Propagation of a synthetic future template edit to real/demo/preview pages;
  editing generated HTML cannot create an independent implementation.
- Each demo’s calendar and photo-import configuration use the normal planner.
- A newly created trip can add ordered mixed-mode legs, photo ordering, cover
  choices and preserved chapter data, then build a public page.
- Full-trip Replay stays inaccessible without interrupting normal arrival playback,
  including stale overlay history on desktop and phone.
- Shared introduction behavior with/without photos and direct day/photo entry.
- No literal known trip IDs/URLs in shared browser code or page templates.

The concurrent mobile release was integrated before delivery; its controls and
assets are inherited through this same template, with mobile gesture/page
contract tests included in the release checks.

Location-label checks also exercise complete route strokes at desktop/phone sizes, repeated destinations, compact/culling behavior, source-derived anchors, and an empty then populated fresh draft. Browser map QA can omit photos/private auth while retaining the identical shared map code and route data.

Existing tests cover routing/GPX, planner preservation, photo auth/load/cache,
viewer camera, Replay camera/timing, mobile day navigation and Studio editing.
These are focused automated checks, not proof that every browser interaction
is pixel-identical or every intake path preserves editorial decisions. For UI
changes, check the affected flow on the family trip, a demo and a fresh draft
both empty and populated with independent fixtures, plus the actual target
trip/event model, at desktop/phone sizes as appropriate. Use owner-decision
acceptance checks for observable behavior, not just matching controls. A map/photo
service outage must not be confused with a template mismatch.

Pages CI runs the suite and build, then rejects uncommitted output differences
with `git diff --exit-code -- dist/`. Commit regenerated outputs with source
changes. Preserve concurrent work, fetch/integrate remote main before each
push, verify the Pages run, and check fresh public content before completion.

## Manual update checkpoints

The agent-operated `updates` command reads hash-verified public journey/photo/
override bundles into a compact inventory. `update-inventory.mjs` owns stable-ID
membership, authored destination grouping, diffs and plain text;
`update-public-snapshot.mjs` owns consistent public reads;
`update-announcements.mjs` owns a private ignored local ledger, retained backups
and frozen drafts. This is shared tooling for every real trip, separate from
viewer comment notifications and Studio's unverified-public review state.
It does not modify source content, fetch protected media or send notifications.
The [workflow](UPDATE_ANNOUNCEMENTS.md) defines initialization, prepare/copy versus
acknowledgment, recovery and public-metadata verification limits. Studio UI and
provider delivery remain optional future work, not part of this implementation.

## Comment notification architecture

The shared comment store owns authenticated photo threads and trip notification
reads. `comment-notifications.js` owns local read membership and count helpers;
`community-client.js` owns authenticated metadata/feed caches; `trip-notifications.js` owns the header bell and recent-comments dialog.
The coordinator connects the same model to photo/sidebar badges and conversation
visibility. Trip scope is independent of the selected event or route group.
No journey-specific template or backend instance is introduced.
Notification selection opens the shared fullscreen viewer before the conversation;
the comment component derives its compact presentation from that open viewer.
Header dragging uses the existing history-aware overlay dismissal, preserving
the underlying photo and draft. It introduces no separate notification viewer.

The Worker serves 500-row compact metadata pages and a separate newest-first
30-comment feed. Both use the partial trip-order D1 index and filter eligible
photos before pagination. A summary refresh is O(visible comment metadata),
coalesced and cached for thirty seconds; it avoids N photo requests and fetching
every comment body. Explicit local read IDs preserve exact unread counts through
partial scrolling, pagination and deletion/restoration. For substantially larger
trips, reconsider conditional/incremental metadata snapshots based on measured
traffic; there is no new streaming/polling service or pending infrastructure
requirement. The current contract and privacy/lifecycle details live in
[Places and comments](PLACES_AND_COMMENTS.md#comment-notifications).


## Remaining migration plan

The basic shared-instance requirement is now in place. These stages improve
maintainability without delaying creation of the next trip.

| Stage | Scope and dependency | Acceptance |
| --- | --- | --- |
| 1 — Prevent drift (delivered here) | One journey template; generated catalog; demo parity; full demo calendars; inventory, prompts, AGENTS and CI checks | A fresh data-only trip inherits the shared controls and capabilities; sample HTML cannot drift independently |
| 2 — Extract focused modules (W04) | Start from existing helper boundaries; extract shared day/photo selection, transport definitions, map/camera, albums and Replay one at a time | Family, demo and draft use the same implementations; function-level tests replace brittle source-snippet tests as each boundary moves; URLs and content unchanged |
| 3 — Separate source and output (W05) | Move authored JS/CSS to an explicit source directory and teach the build to copy/bundle it; update Studio imports and tests together | A clean checkout reproduces `dist` without reading authored code from its output directory; generated assets and photo privacy remain intact |
| 4 — Consolidate schema and promotion (W05) | Centralize schema/default documentation and validation; add reviewed migrations when shape changes; automate the documented draft promotion with dry-run review | One command can report/promote a reviewed draft, its routes/photos/overrides and catalog entry without leaking local-only assets or losing IDs |

At audit time the viewer was about 1,859 lines and Studio 1,402 lines. Both are
shared, but their size makes isolated changes harder. Photo ordering/override
resolution and transport definitions also appear in more than one application
surface. Extract those with focused behavior tests as the next related work
arrives; a framework rewrite is not a prerequisite. No time estimate is a
commitment: each stage should be a separate reviewable change with its own
checks and deployment.

HTML map pins do not participate in basemap glyph collision. Small footprints and short vertical stems reduce coverage; signpost feet/dots intentionally mark route locations. Numbered boards always stay upright above their points, using a dot fallback in tight space. Hard checks protect map controls and other pin hit targets. Dense views cluster nearby places, with edge/control culling and complete day navigation retained (T05, `docs/LOCATION_LABELS.md`).

Per-journey public bundle splitting and larger collection performance remain
future scale decisions. Today all published journey data is loaded together;
that is separate from whether feature code is shared. Existing documents on
performance/auth are historical evidence or focused operational references;
this file and the feature inventory define the present framework contract.

Routing-data intake remains agent-operated: empty journeys show an actionable
setup state until their own mode network has been prepared. A guided retrieval
flow with access/direction-aware routing is future work (W06); the present local
graph reconstructs historical routes and is not turn-by-turn navigation.

## Remaining continuity work

The documentation audit closes the missing reading order, decision/supersession
record and new-atlas acceptance gaps. It does not provide automated visual or
end-to-end proof of every decision. Existing helper/controller and template
tests should remain; add focused browser coverage when the next related runtime
change warrants it, covering bulk and Studio intake through blank-copy rendering,
daily/city albums, sidebar/fullscreen/day changes and save/reload recovery.
Assertions must verify user-visible outcomes and preserved edits, not merely
source snippets. Tracked as W10 in [TODO.md](../TODO.md). Do not gate the present
documentation delivery on a speculative test-framework rewrite.

## Group routes and video follow-up — 10 September 2026

The shared optional group/video contract is documented in JOURNEY_WORKFLOW.md.
Nine to Como adds a sixth journey data instance and demonstrates nine invented
travelers taking three routes to one meetup. Filtering derives a view without
mutating the source; empty drafts and existing trips retain absent defaults.
Regression checks cover scoped/shared legs and media, overnight places, meetup
references, mixed photo/video selection, first-frame caching and cleanup,
native mobile gesture ownership, hidden/local video exclusion, planner
preservation and template inheritance. Day details derive each group's roster,
route and overnight from the source itinerary, even while a group is selected.
Videos now use the existing photo viewer and all album/grid entry points.

Private video intake was implemented on 8 October: bounded local FFmpeg
derivatives/posters, source-preserving Studio intake, authenticated native byte
ranges under the existing photo policy, public-clip transcripts/timed captions, and
checksum-verified publication. No family footage was uploaded as part of the
implementation. The Worker streams from the same private R2 bucket. See
`PHOTO_WORKFLOW.md` for asset status, grant scope and the storage ceiling.
Studio now edits rosters, membership, leg/photo/video assignments, group
overnights, meetup and hosted public video entries through the validated
planner. Photo assignments retain their canonical manifest layout; checks are
read-only and saves use source/state revisions and backups. Per-day changes to
individual group membership are still future work; groups have stable
membership. See W07 in TODO.md.


## UX review follow-up — 12 September 2026

The audit's 20 authorized findings are addressed in shared code. Visitor
URL/reload persistence (V1) is explicitly excluded. Studio recovery and conflict
review were subsequently authorized and delivered (see the follow-up below).
Explicit sharing, publication readiness and labeled Replay seeking were proposed
in that review. Batch photo editing and private video intake were subsequently
authorized on 8 October. Batch uses one shared Studio transaction model and
contact sheet for real trips, demos and fresh drafts through existing
save/recovery. Private video uses the same protected media service as photos.
This review gate does not block delivery of authorized changes.

Ready to share was authorized on 8 October and now uses the shared Studio
validator against the current in-memory plan and overrides. It reports source
and derivative blockers, deliberate editorial choices and a revision-bound
agent handoff. It never writes sources or claims a local/Git state is live.
Live deployment verification remains an agent-operated delivery check; adding
a verifiable deployment receipt is a possible later integration, not a claimed
capability of this panel.

The [8 October workstream checkpoint](../WIP.md) records the local day-experience
prototype and two design demos on separate branches. They are review artifacts,
not alternate production implementations. W04–W06 remain the migration backlog;
W07 remains the private-media service follow-up; W08 has a community implementation and a separate provisioning/rollout checklist. The newly recorded
Live Photos investigation (W09) needs paired input and must reuse W07 rather
than introducing a separate media/auth service. No new capability is introduced
by this documentation checkpoint.

## Studio persistence follow-up — 15 September 2026

The owner subsequently requested reload recovery, readable draft review, and usable Save conflict handling. Those are now shared capabilities: local revision snapshots support three-way saves, independent changes combine, and conflicting fields require an explicit saved/draft choice. No force overwrite is inferred from a reload. Editable day taglines, preserved story paragraphs and compact expandable travel details use the existing shared templates and editorial overrides for real trips, demos and fresh drafts.

The 12 October photo data-safety follow-up adds raw `photoFields` to private
schema-1 recovery snapshots; invalid numbers stay out of source overrides and
block explicit Save. Input snapshots are detached before debounce. Recovery
streams use document-lifetime Web Locks and a versioned session key; duplicate
tabs fork the copied draft into a new stream. Without Web Locks, each document
uses a new stream while recovering its predecessor. Old streams remain available
for recovery. Persist a new session pointer only after browser/disk capture.
Disk acknowledgements must match the sent sequence; the server refuses reused
sequences containing different edits. Corrupt draft reads return an error and
preserve the file. Loading, save acknowledgement, restore and discard each guard
against replacing newer edits. See [the editing contract](../PHOTO_WORKFLOW.md#editing-reliability--12-september-2026)
and the recovery, photo-editing, real-handler and real-API regressions.


## Places and conversations — updated 20 September 2026

`pointsOfInterest` is a validated optional annotation collection, independent of
itinerary `places`. `scripts/places-content.mjs` owns validation. Shared template
shells mount `places-panel.js` / `.css` and `photo-comments.js` / `.css`; the
`places-comments.js` coordinator supplies the local UX persistence adapter.
`journeys.js` carries curated records through the generated bundle. Ordinary
Studio saves preserve them. Data is authored in the shared Studio Places editor or through chat; approved image intake remains agent-operated;
there are no concrete journey branches or Maps API calls in shared code.

All journeys inherit the layer, search/filter/empty states, galleries and
Map-style list/detail organization refined for the atlas. Alpine Crossing has
real places and credited venue/Commons photos, with explicitly fictional group
reviews. Drafts preserve unfinished local review/comment text through navigation;
removals are recoverable through Undo. A local visitor ID outlives the display
name and tab session. Comments/unlock join the existing shared overlay history;
parent photo dismissal unwinds nested layers. Places/gallery history preserves
other atlas state. Pins cluster by rendered distance.

The `experience=places|comments` query now exposes the local UX simulation only
on fictional demos. Published real journeys show Comments without that query,
using the existing photo access token, a server-signed visitor ID and D1. Curated
place reviews remain prompt-authored public content: a visitor password does
not confer traveler/editor permission. Empty drafts have the same shells but no
eligible public target until promotion.

`community-client.js` is the asynchronous live adapter; `photo-comments.js`
retains the shared presentation, draft recovery and overlay history. The Worker
community helper enforces access on reads and writes, target eligibility, own
edits/deletion, five-minute Undo, idempotent posts, cursor pagination and write
limits. A separate administrator secret authorizes reversible moderation and
private export. No database content is bundled into GitHub Pages.

Builds deterministically regenerate `workers/photo-auth/community-index.mjs`
from published real photos, excluding local and trashed items. CI checks its
freshness. Deploy this index with the Worker before each Pages publication that
changes photo eligibility. D1 provisioning and public rollout remain explicit
operations in [COMMUNITY_OPERATIONS.md](COMMUNITY_OPERATIONS.md), alongside
Free-plan limits and identity/retention behavior. Further image-intake automation
remains separate backlog work. Curated group reviews now have owner-only local Studio editing; visitor write authorization has not changed.

## City events — 8 October 2026

The shared event contract now supports `eventMode: "city"` and per-event
`calendarEndDate`, with the existing `days`/`dayId` storage and URL IDs retained.
Daily calendars remain the absent default. Creation, validation, planner edits,
photo capture-date assignment, catalog, journal, location labels, mobile controls,
albums inherit it; saved Replay metadata remains compatible. Heading East is a data instance with eleven city
stops and fourteen reconstructed legs through Venice, not another page implementation.

Remaining route evidence: personal departures and historical diversions are
unconfirmed; the DB Monday notice establishes the probable replacement-bus
endpoints but not the actual coach streets. See `docs/HEADING_EAST.md`. No new
framework migration is required for additional cities or later photo intake.

Private video follow-ups: protected speech transcript/timed-caption delivery is pending; private clips reject those fields. Public-clip timed caption editing currently uses content/agent operations; Studio provides plain transcript editing. Per-day group membership and paired Live Photos remain separate follow-ups. Original held MOVs require clip-specific review/publication authorization.


Photos + Places production follow-up (8 October): `point.photoIds` is the one
optional association field, with an absent empty default and journey-local
reference validation. Explicit order persists in journey JSON. Only owner-saved
links associate photos with places; GPS proximity does not generate labels, About
buttons or nearby-photo suggestions. All pages load the same modules. Family, Alpine sample and a fresh blank draft have parity regressions;
behavior tests cover source persistence, conflicts, eligibility, selected-group
stability, cross-day navigation and auth image cleanup. No-coordinate places are
not yet supported: unfinished Studio points require a known coordinate before
Save, with recovery retaining the unfinished draft. Image-file intake/permission
research remains agent-operated; the editor manages approved image references.

## TBD itineraries — 8 October 2026

Optional day `planningStatus` (`confirmed`/`tbd`, absent = existing behavior)
provides shared confidence styling and a non-mutating visibility projection.
All incoming legs inherit their event's status; geometry quality stays separate.
An undated TBD tail is validated without extending the known calendar. The viewer,
Studio, photo assignment and calendar moves retain the shared contracts. Heading
East supplies the content instance; family/demo/fresh-draft tests cover inheritance.
No separate trip implementation or framework migration is introduced.
The 11 October Heading East filter request extends this projection through shared
`journeyToday`, `planningCategory`, `planningCounts` and `projectPlanning` helpers:
three synchronized visibility groups, source-preserving map/media scoping,
and complete incoming legs. The boolean `projectPlanning` API remains compatible.
The [journey workflow](../JOURNEY_WORKFLOW.md#tbd-stops-and-legs) owns grouping,
empty-state, numbering and navigation semantics.

## Arrival/city playback — approved 10 October 2026

The reviewed `codex/arrival-stay-demo` work adds shared arrival playback and destination-focused
stay/photo framing without new journey fields or trip-specific branches.
`arrival-chapter.js` isolates the clock and cancellation from map rendering.
It caches an overhead timing outline and projected canvas paths once per arrival,
then paints the route and a plain orange tracking circle at display cadence
without GeoJSON worker updates. The circle contains no arrow or symbol.
The 11 October owner correction replaces the old separate pullback/re-zoom
with one cancellable direct route ease. Bounds padding is applied once after
resizing for the arrival card; endpoint labels and the circle clear controls on
desktop and phone. Named endpoints and the route title retain geographic context.
Playback waits for camera completion and keeps that view stationary. Late route
redraws preserve the canvas trace and quiet guide, guarding missing layers. All routed events play linearly for 1.5 seconds (40%
shorter than the previous 2.5 seconds), hold for 250 ms, then
start the city zoom; empty/reduced-motion stays skip playback and the hold.
The overlay is transient shared rendering, with regular map layers restored on
completion/cancellation and projection refreshed on resize.
The local review generator renders the shared template with explicitly synthetic
media; original content and private services remain outside the fixture.
The owner approved deployment on 10 October 2026, including timing and
photo/place-aware city framing. See [ARRIVAL_CITY_DEMO.md](ARRIVAL_CITY_DEMO.md).
The follow-up city fit uses shared geometry helpers in `atlas-utils.js` to include
photos inside or within five miles of optional sourced `places[].cityBoundary`
geometry, plus marked places. Without boundaries, proximity uses the destination
coordinate. No network calls or trip ID branches are needed at playback time.


## UX flow corrections — 11 October 2026

The owner authorized the complete sixteen-item [UX review](UX_REVIEW_2026-10-11.md)
and direct one-click photo opening. A later same-day clarification supersedes
the first all-photo-fullscreen interpretation: map circle bubbles and right-hand
reel thumbnails select in the existing sidebar/card; the large top-right
selected/lead image opens fullscreen. Phone grid/swipe and existing album/linked
Places entry are retained. Close old map popups and pending hover previews before
switching days/stops. These boundaries live in O03/O07. Shared changes consolidate the phone event
card, quiet desktop chrome, scope Places, preserve exact photo/comment collections,
use current event labels and deliberate empty states. Named map-only Replay
seeking was added here, then superseded by full-trip disablement (O09). Studio task navigation, visual media choices, batch contact sheets,
truthful video progress and a grouped sharing review retain existing persistence
and access services. Approved arrival and image reveal timing is unchanged.

Behavior regressions cover photo selection versus large-image fullscreen,
map-popup cleanup on day changes, collection/history boundaries,
deep-link responsive Back, reference/demo/independently populated fresh-draft
inheritance, sharing choices, batch edits, visual metadata and upload interruption.
W10 remains the broader browser/accessibility continuity backlog; this release
does not claim device, screen-reader or every service-failure certification.
