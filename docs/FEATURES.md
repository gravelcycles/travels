# Shared feature inventory

Inventory reconciled: 11 October 2026, including the later photo-entry and
map-popup and Replay corrections in [O03/O07/O09](OWNER_DECISIONS.md).
Applies to Switzerland–Italy, every sample,
and every new journey. “Available” means the common implementation exists;
actual content, reviewed geometry and photographs must be supplied per trip.

Feature availability is only part of inheritance. Read
[OWNER_DECISIONS.md](OWNER_DECISIONS.md) for editorial defaults, interaction
requirements and rejected/superseded choices. Complete the
[new-atlas checks](../JOURNEY_WORKFLOW.md#new-atlas-inheritance-checklist) for
content quality as well as shared controls. See the
[continuity audit](ATLAS_CONTINUITY_AUDIT_2026-10-11.md) for the documentation gaps.
This inventory is maintained with each relevant change. O16 requires agents to
capture new corrections during the task and reconcile current docs before
delivery; use the [live update procedure](OWNER_DECISIONS.md#record-the-next-correction-before-closing-the-task).
Accepted work still pending belongs in WIP, not among delivered capabilities.

The 16 October performance pass adds scoped real-trip/demo data and a compact
catalog, crop/DPR-sized catalog covers, complete local template asset hashes,
cached reader media order/lookups and retained filmstrip selection, plus unchanged
comment-row/draft reuse. Numeric before/after comparisons are required by the
owner; validation and publication status are tracked in WIP. AVIF migration
results and any subsequent preload-priority change are evaluated separately.
The post-AVIF loader allows one explicitly marked fullscreen neighbor to share
spare request capacity with thumbnails after the selected image is ready;
farther warming stays idle-only and current-photo selection retains priority.
This reduces neighbor cancellation/starvation at a measured thumbnail-bandwidth
cost. Mobile image swipes preserve the visible position when a new touch
interrupts their settle, including reversal, cancellation and pinch takeover.
Cached rendering measurements and physical-device limits are recorded in
[the follow-up](PERFORMANCE_FOLLOWUP_2026-10-16.md) and WIP.
Phone Location uses transform motion with frame-paced dragging and deferred map
setup; settled same-photo reopen retains the map camera and decoded photo state.

The later first-swipe follow-up retains the prepared full-photo element through
selection and the previous image for reversal, using the existing three-node
carousel. Hidden main-map label/bubble layout waits until final viewer close;
the photo Location map and return-camera behavior remain available.
The loaded-neighbor correction sets its instant reveal before changing roles
and retains absolute positioning, avoiding a transient cold reveal and layout
model change while an already sharp photo becomes selected.
An intentional horizontal photo swipe or photo-stage pinch finishes the current
ready image's opening reveal; idle entry keeps the normal 350 ms animation. Numeric
results and physical-device limits are recorded in
[the readiness measurements](PERFORMANCE_READINESS_2026-10-16.md).

The remaining iPhone loaded-photo jump has physical trace evidence and a
controlled `?swipeRenderer=prepared` comparison using worker-prepared fitted
surfaces. Ordinary viewer behavior stays the default. Full sources remain
attached for zoom; prepared pixels obey existing access cleanup. See
[the incident record](PERFORMANCE_IPHONE_2026-10-17.md) and WIP for verification
and the pending physical-phone result.

The [16 October fullscreen photo correction](OWNER_DECISIONS.md#fullscreen-photo-controls-and-focal-zoom--16-october-2026)
is implemented in shared code: mobile right-aligned Comments with Share immediately to its left,
top-right Close, single-tap hiding/restoring of photo chrome and full-viewport
mobile zoom. Phone and desktop zoom follow the pinch or pointer focus; desktop
retains its context sidebar. Mobile controls stay solid; during zoom the continuous
bar backgrounds disappear so the image fills the screen behind them. Fitted photos
retain resting bars. Verification and deployment status are in
[WIP](../WIP.md#fullscreen-photo-controls-and-focal-zoom--16-october-2026).

Shared [Arrival → city](ARRIVAL_CITY_DEMO.md) playback traces the incoming
route with a plain orange tracking circle at display cadence after one direct
850 ms pan/zoom. The camera stays still for the linear 1.5-second trace and
0.25-second arrival hold, then eases into the destination over 900 ms. Full-route
framing applies bounds padding once and clears endpoint labels and the desktop
overlay; the external phone card does not consume map space a second time.
The same stroke and marker sizes preserve mobile/desktop clarity, including
north–south routes (owner correction, 11 October 2026). Endpoint labels sit
outside vertical travel paths; late route loading preserves the quiet guide and
canvas trace without false map errors. Unlocated
photos keep the local city view. City zoom fits photo locations inside or within
five miles of the city boundary, plus the stop's marked places. Missing boundary
data uses a five-mile radius from the destination; all marked excursions remain
included. Optional sourced Polygon/MultiPolygon data lives on journey places.
It reuses the shared page, gallery and route geometry. The owner approved
deployment on 10 October 2026 after reviewing the local demo.

[WIP.md](../WIP.md) distinguishes delivered features from preserved prototypes,
unpublished editorial work and remaining service/intake projects. In particular,
Live Photos playback is still an investigation. Private-video intake and live
photo comments now have shared implementations; media publication and community
service rollout follow their documented workflows.

Heading East exercises the shared city-stay contract with eleven stops through
Venice, 23 October 2026, and fourteen researched route legs. Extensions remain
content-only; see [its intake and route evidence](HEADING_EAST.md).
Its [chronological city photo order](HEADING_EAST.md#chronological-city-albums--12-october-2026)
uses the existing album-order overrides, with no shared renderer change.

| Capability | What carries over | Trip input / empty behavior | Main owner |
| --- | --- | --- | --- |
| Catalog and stable URL | Real-trip catalog, cover rows, stable detail page; planned/TBD/partial distance qualifiers; desktop headers omit sample links, trip badges and About | `kind`, `published`, `slug`; drafts and demos stay out of the real catalog | build-site, catalog.js |
| Site identity and link previews | Shared blue/white globe pin, browser/touch icons and generic 1200 × 630 share artwork; explicit photo shares use the selected photo's low-resolution thumbnail with server-readable metadata | Published stills use signed thumbnail-only links; full photos keep existing access. Drafts, videos and unavailable previews retain ordinary links | content/branding, content/site.json, view-sharing, Worker photo-sharing; [photo sharing](../PHOTO_WORKFLOW.md#sharing-a-photo-or-view), [brand workflow](BRANDING.md) |
| Opening | Cover image/focal point, title, dates and complete scrollable introduction above an always-visible bottom Explore the journey action opening the whole-trip map with no selected day/stop, neutral map markers/routes/list and a journey-level sidebar; no secondary Whole trip map button. Unmapped drafts retain one day/stop-list fallback; direct day/photo entry bypasses the opening | Optional `coverPhoto`; first visible photo or text scene fallback | journey.html, app.js, atlas-utils, styles/mobile CSS |
| City-based events | One city stay per event, with arrival–departure ranges, incoming legs, one album/story, map selection, stop navigation; Studio creation, range editing and adding stops | Optional `eventMode: "city"`; `days` retains stable IDs and gains `calendarEndDate`. Absent mode remains a full daily calendar. Capture dates match stays; transfer dates default to the arriving city with manual reassignment available | atlas-utils, app, mobile-ux, planner, photo intake, Studio |
| Calendar and journal | Every day, ordered travel legs, optional editable italic tagline and full day story (preserving paragraphs), previous/next, return to journal; selecting a day scrolls its row into view in the left list, preserving visible rows and respecting reduced motion; Days without recorded travel omit the automatic transport summary; Travel details starts as one compact expandable row; expanded desktop legs are non-clickable: hover or keyboard focus highlights only that leg and greys all other routes, without a popup or camera movement; leaving/blur/Escape restores the map. Mobile legs retain tap-to-map behavior | `days`, `calendarDate`, optional destinations; no fake place for unknown plans | app.js, journey-content |
| Route overview and focus | Whole-trip/day bounds, optional wider geographic context for the overview, quiet context, compact charcoal city/town/village names with opaque warm-white halos above routes; road labels and highway shields below routes, route inspection and named stops; map credits start collapsed behind a working info button in every map; day maps show quiet intermediate rail stops with small orange centers and broad white rims spanning the blue line and overlapping its casing; larger 12 px start/end dots at both ends of every train leg appear in full and day views. Stop dots appear only once their train lines render, with pending reveals cancelled on day/scope changes. Small upright numbered signposts identify single-day destinations; repeated/nearby stops use quiet dots with explicit day choices. Pins cluster on zoom, keep numbered boards above the route on short vertical stems, and protect complete tap targets from controls. Stems at orange endpoints meet the top of the outer ring, with no teal foot or repeat dot covering the orange center. Posts never rotate or flip; other feet mark actual locations, with a dot fallback when space is tight. Hover/focus links pins, complete day routes and day rows, with one compact place card and no camera movement. Single-day click/tap opens the day; phone targets are 44 px, and accessible labels expose place/day information | Places, ordered `segmentIds`, segments/geometry; optional `overviewBounds` expands whole-trip framing, otherwise route/place bounds apply; map actions disable when no coordinates exist | app.js, location-labels.js |
| Curated places, food and group reviews | Searchable photo tiles and map pins with clustering; selected-event default scope, deliberate category/event/search persistence and All places escape; Overview/Photos tabs and an explicit populated Group reviews action opening a floating card with the place sidebar visible; group star distribution; full-screen credited gallery; phone sheet opens with visible results, explicit Show map/Show list and on-demand category filters; direct dragging from its handle or broad list/detail header follows the finger and settles between map and reading views; Back/Forward preserving detail/tab scroll; unchanged detail nodes survive linked-photo returns and temporary close. Preview adds rating-only/written review editing, per-place drafts and delete/Undo | Optional validated `pointsOfInterest`; desktop and phone Places buttons are hidden when the trip has no curated places. Studio remains available to add the first place. Owner-authored public content, separate from itinerary route nodes | places-panel.js/css, places-comments.js, places-content.mjs, journey.html |
| Photo conversations | Floating rounded conversation cards with soft shadows, visible photo/sidebar context and an inset phone sheet; immediate opening, parallel profile/comment reads, deduplicated requests, short-lived memory caching, inline retry and preserved drafts; remembered signed visitor identity, optional name at photo unlock, name changes, per-photo local draft recovery, shared reads/writes, pagination, own edit/delete with five-minute Undo, retry-safe posting and separate owner moderation/export | Real published photos use the existing photo-password access boundary and D1. Demo preview remains browser-only with password `demo`; empty drafts have no comment target until publication. See [operations](COMMUNITY_OPERATIONS.md) for required provisioning and rollout | photo-comments.js/css, community-client.js, places-comments.js, Worker community.mjs, journey.html |
| Travelers and separate routes | Roster, group filter, validated meetup, shared legs/media; Day details list every group's travelers, route, transport and overnight with route-selection actions; map/journal/media follow the selection | Optional `travelers`, `routeGroups`, leg/media `groupIds`, day `groupPlaces`, `meetup`; absent fields preserve single-party behavior; editable in Studio Trip / Media or JSON/planner API | group-travel, journey-extras, app.js, Studio |
| Videos in the photo viewer | Mixed day previews, albums and filmstrips; opening-frame thumbnails with play/duration badges; large player with native play/pause/seek/volume/fullscreen and inline phone playback; retry, pause on grid/background and release on media change/close | Optional public HTTPS MP4/WebM or private hashed H.264/AAC derivatives; protected posters, native authenticated byte ranges, supplied transcript/timed captions for public clips; local clips excluded until verified publication | media-utils, journey-extras, journey.html, app.js, mobile-ux.js |
| Transport modes | Train, ferry (`boat`), bus, gondola, walk, car, bike; redundant color/line patterns and matching legend | `segment.mode`; a new mode requires a shared schema/style/routing change | viewer, Studio, validators |
| Day photo preview and albums | First photo follows album order, View photos, all-day album overview, empty-day story | Photo manifest, `photoOrder`; legacy `leadPhotoId` is preserved but has no active editor control | app.js |
| Photos + Places | Sparse day-map thumbnails coexist with place pins; stationary refreshes retain bubble elements and image loads; selected groups preserve membership/order/current photo while zooming and use another visible member when their first anchor is offscreen or crowded; map circle bubbles (single or clustered) and right-hand reel thumbnails select in the existing sidebar without fullscreen; the large top-right selected/lead image opens fullscreen in one activation; existing album/grid and linked Places entry remain; desktop retains the existing right sidebar with an uncropped stable-height frame whose blue background stays steady on photo hover, compact controls, adjacent thumbnails and expandable day details; map thumbnails stay tied to their own locations, album browsing does not regroup them, and day changes close old map popups/hover previews before displaying the next day and clear the old selection; phone bubbles select the compact photo card, whose large image opens fullscreen; Locate, About place, Comments and explicit Full screen; only owner-saved links associate photos with places; no GPS-based suggestions or automatic venue labels; credited venue imagery stays separate | Optional ordered `point.photoIds`, validated within the journey; no-coordinate photos stay in the album, protected photos use existing unlock; public output filters local/trashed links while sources retain them | photo-places, photo-bubbles, places-panel, app |
| Owner Places editing | Add/edit/remove curated place details, day assignments, known coordinates, credited venue images, group reviews and ordered photo links; Undo removal and ordinary draft recovery/review/discard/conflict reconciliation | Studio Places for real/sample/new drafts; incomplete records retain recovery but need valid coordinates and sources before Save; no visitor edit role | Studio place-editor, journey-planner, places-content |
| Full photo viewer | One-click entry from the large selected/lead image, plus existing album/grid and explicitly linked Places entry, retaining explicit collection order/index in fullscreen, grids and comments; ordinary desktop and phone entry uses the continuous journey camera roll with the current event’s filmstrip/grid. Map bubbles and right-hand reel thumbnails select in the sidebar/card instead of opening fullscreen. Desktop context keeps days left and photos right. Desktop sidebar/fullscreen arrows and phone arrows/swipes continue across all visible event albums, with separate city/day jumps and event changes synced to the journal/map, keyboard navigation, retry/unlock, filmstrip; clean full-photo edges with loading-only placeholders and phone-only swipe neighbors; next-day action has no pulsing halo. Shared focal math keeps zoom anchored to the moving pinch midpoint or cursor; desktop supports Ctrl+wheel/trackpad pinch, Safari gesture events, double-click zoom and bounded pan across the existing photo stage while retaining the sidebar | Visible photos with usable derivatives; no small-photo substitute for fullscreen | app.js, photo-zoom.js, photo-auth, mobile-ux.js, styles.css, mobile.css |
| Photo map and camera | Independent photo pins and saved map bounds, stationary navigation when both pins fit, direct nearby moves, smooth longer camera transitions and reduced motion | Optional photo coordinates/zoom and validated `mapFrame.bounds`; absent frames use the pin and zoom, unlocated photos keep day context | atlas-utils, app.js, Studio |
| Photo loading/access | Responsive WebP thumbnails/previews, optional original-resolution AVIF in the full viewer with decoded-support detection and full-WebP fallback, full-size viewer readiness and a 350 ms blur-to-clear reveal, desktop blur-to-focus reveals on every appearance (including cached photos and video posters), continuous preview-to-photo handoff through the full viewer reveal, reduced-motion support, bounded preloads, shared password access and remembered login; resumable publishing supports one-file-at-a-time uploads for slow connections | Publish reviewed derivatives into a journey-specific private namespace; no new login implementation per trip | photo-auth.js, Worker, photo scripts |
| Opening route trace | Initial Explore the journey map reveal traces the full visible itinerary in three seconds with a stationary overview and existing transport colors/patterns, then restores normal routes/markers; automatic resize/refitting and delayed native-route redraws preserve the same clock; deliberate input cancels, direct links bypass, reduced motion and empty routes skip | Every real/demo/draft instance; resolved geometry in event/leg order, separate legs without fabricated connectors; no extra control or Replay activation | opening-route, arrival-chapter, app; [contract](../JOURNEY_WORKFLOW.md#opening-route-trace) |
| Full-trip Replay (disabled) | No desktop/phone entry or resume action; dormant player cannot open from history or start playback. Studio chapter editor stays hidden. Arrival → city in the main map remains available | Existing `replayMoments` and route helpers are retained without exposing playback, including for demos and new drafts; see O09 | journey.html, app.js, mobile-ux.js, Studio |
| Mobile day experience | Map-led day screen with a persistent compact header, one date/title card with Photos, contextual Places and integrated secondary arrival controls, plus bottom day navigation; day picker contains other journey-wide actions, details contain the route key; All days returns directly from a focused day to the whole map; the single bottom day picker says All days/stops in overview, names an explicitly selected event and lists every event; overview has no active event row, and its next arrow starts at the first event; desktop uses its persistent left day list without a separate picker; mobile route taps select the day without a tooltip, while desktop inspection remains available | Same shared template with mobile styles; empty routes/photos have explicit states | journey.html, app.js, mobile-ux.js, mobile.css |
| Mobile photo gestures | Day Photos opens that event’s grid; selecting a photo enters the journey camera roll. Clear 48 px photo arrows and image swipes cross city/day boundaries; adjacent full-photo cache readiness prepares the first swipe, with frame-paced drag updates and a short smooth release; a distinct event bar has 44 px city/day jump controls and sideways swiping, skipping empty albums. Pulling an unzoomed still photo downward follows the finger, shrinks/fades and returns one screen through history (photo → presenting grid, or direct photo → presenting map/story/Places surface); short/cancelled pulls snap back. The presenting grid remains mounted beneath the photo with its thumbnail nodes and scroll intact, without a map or reload flash. Open location details collapse first; pinch takeover, zoomed pan, grids and native videos cannot accidentally dismiss. Pinch zoom follows the moving midpoint, animated double-tap focuses on the tapped point, and bounded pan uses the full viewport behind overlaid controls. Deliberate pull-up location remains. Sideways swipes and grid changes keep a closed location closed; vertical drags pan a zoomed photo. The photo/grid top-left label is Back. Grid/photo transitions retain separate history entries and grid scroll/selection; Back/Forward matches visible controls. Return to a map preserves its camera/scope when the event is unchanged; direct cross-event browsing keeps the current event on the presenting surface. Forward restores the viewer. Comments aligns right with Share immediately to its left; city/day buttons span their own full-width row; Close sits top-right and follows the same one-screen return as Back. Single tap hides/restores all photo chrome, with double-tap/drag/pinch arbitration and keyboard recovery. Grid headers keep their existing Back flow | Same day/photo data and private-photo loader; immediate, interruptible swipes; reduced motion, journey endpoints and explicit Places collection boundaries respected | mobile-ux.js, mobile.css |
| Direct entry and accessibility | Current day/photo/view URLs, native Share with copy/selectable-link fallback (desktop fullscreen: right sidebar beside the photo count; mobile fullscreen: immediately left of right-aligned Comments), backward-compatible day/photo deep links, a slim slate keyboard-focus indicator without orange or persistent rings after mouse/touch input, reduced-motion support | Shared browser behavior; phone day links open the day map; dialog/history focus restoration remains available; restored All photos and About dialogs retain scroll, and unchanged album tiles stay mounted | view-sharing.js/css, app.js, mobile-ux.js, input-mode.js |
| TBD itinerary | Planned/unconfirmed days or city stays, optional undated tail, inherited leg status, dotted routes and badges; synchronized Past / Future locked in / Future TBD toggles in a compact horizontal row in the Days/Stops section and full-trip map filter maps, navigation, Places and albums; counts use the trip time zone, with today/ongoing stays under Past and at least one group visible | Optional day `planningStatus`; absent/confirmed retains existing behavior; Studio authors and validates it; dated range excludes the undated tail | atlas-utils, app, journey-content, planner, Studio |
| New-trip planning | Title/dates/time zone, daily calendar or city stays, places, ordered legs, date changes, stable IDs, preview | Studio + New trip or `journey:new`; ignored local draft until promoted | create-journey, planner, Studio |
| Group and video authoring | Add/edit/remove travelers and groups, exclusive membership, per-leg and photo/video audiences, group overnight places and meetup; hosted-video forms with day/title/link/poster/caption/credit/visibility/order, native preview and duration detection | Studio **Trip** and **Media → Videos** validate the full plan on Save; checking changes first is optional; source revisions and backups protect edits; removal of referenced groups is blocked until reassigned; hosted public MP4/WebM and bounded private MOV/MP4/WebM intake with preserved originals, metadata stripping and local-only status; measured transfer progress, cancellable transfer, indeterminate preparation, persistent status and reload protection | Studio plan-extras, journey-planner, studio-plan-sources |
| Photo authoring | Multi-upload, capture-date assignment, unmatched-day review, album order, searchable visual cover selection and direct focal cropping, pins/copy, independently composed photo map frames, all non-trashed photos visible (no Hide control), recoverable trash; agent bulk intake includes DNG on macOS and skips undated TBD stops | Private originals and trip time zone/calendar; actual capture dates retained within city albums; captions, notes and place labels start blank and contain only traveler-supplied text; accessibility alt text never substitutes for a visible caption; unlabeled photo cards show the capture timestamp when no owner-saved Place link exists | Studio, studio-photo-service, build-photo-assets, photo-bubbles |
| Photo navigation and save feedback | Left/right arrows and Previous/Next browse the current filter with bounded ends; text fields, map keys, dialogs and batch mode retain their own behavior. Stable thumbnail targets switch on the first click after editing; typing past a search/day match retains the selected photo. A labeled per-photo check distinguishes saved locally, unsaved, saving and failed saves | Immediate input capture and recoverable unfinished coordinates; invalid numbers block Save without clearing pins. Uses acknowledged source snapshots, preserving newer in-flight edits; recovery autosave and publication remain separate | Studio photo-editing and photo-batch UI; [photo workflow](../PHOTO_WORKFLOW.md#editing-reliability--12-september-2026) |
| Batch photo editing | Contact sheet first with sticky batch actions, searchable day/stop filtering, multi-selection and visible select-all, explicit outside-filter counts and Show selected, batch day/stop assignment, move selected to each album’s start, Trash/Restore and guarded last-batch Undo | Media → Photos → Select multiple; existing draft autosave, review, save and conflict handling. Source manifests and legacy hidden flags are preserved. Undo lasts until reload/journey change and refuses later changes to affected fields | Studio photo-batch model/UI; [photo workflow](../PHOTO_WORKFLOW.md) |
| Route authoring | Endpoint/control-point editing, undo/redo, routing readiness with actionable setup messages, point cleanup and mode-aware replacement proposals, reviewed geometry preservation until acceptance, GPX import | Per-journey network extracts/manifest or private GPX; missing inputs disable generation with a visible next step; preserve applies to unattended builds and permits explicit Studio previews | Studio, routing scripts |
| Editorial safety | Automatic unpublished drafts (detached immediate browser copy and acknowledged local disk autosave), separate streams even for duplicated tabs, reload recovery, grouped saved/draft review including unfinished photo fields, discard with confirmed recovery archive, draft download, one-click Save without Preview, local backups, automatic merging of independent disk edits and field choices for actual conflicts | Editing waits for successful recovery; delayed restore/discard cannot replace new edits. Storage failures retain close protection; unreadable drafts are preserved. Stable namespaced IDs; originals and local draft assets remain ignored | journey-content, Studio recovery/server |
| Review for sharing | Concise summary with required fixes first, grouped editorial choices and expandable source details; read-only review of the current Studio draft and trip plan against saved sources; real local-asset blockers, optional editorial choices, links to the affected editor, revision-bound acknowledgements and a copyable publishing handoff | Works for real trips, samples and empty drafts. Blank captions/stories and photo-only days are valid. Local draft promotion and protected-asset publication remain agent-operated. Public deployment is explicitly unverified until the agent checks it | Studio ready-to-share, studio-readiness; [workflow](../JOURNEY_WORKFLOW.md#ready-to-share-review) |
| Update checkpoints and message drafts | Agent-operated live-site baseline, stable-ID new-trip/photo counts by city/stop, compact manual WhatsApp text, trip-specific frozen drafts and acknowledgments, per-trip status and recoverable local history | Select a trip when multiple are published; combined `--all` is explicit. Sharing one trip leaves others pending and preserves the original baseline. Demos/drafts/local-only/trashed photos excluded. Prepare/copy never acknowledges or sends. No Studio UI or provider integration | update-inventory, update-public-snapshot, update-announcements; [workflow](UPDATE_ANNOUNCEMENTS.md) |
| Reproducible delivery | Validated generation, cache-busted assets, Pages CI, bounded orphan-deployment recovery/retry and public verification | Reviewed published sources; no private originals/network fetch needed for site build; GitHub service failures remain visible | build-site, Pages workflow, recover-pages |

Comment notifications extend photo conversations with red unread-number badges
on photo Comments buttons and plain total counts once read. The top-right bell
shows **Most recent comments** across the trip and opens the selected photo
fullscreen with a compact conversation sheet above it. The fullscreen sheet
omits repeated photo details and supports dragging anywhere across its header,
including Close, to dismiss; Photo location uses the same whole-header affordance.
Normal button taps, thread scrolling and map interaction remain independent.
Close/Back retains the photograph and draft. Local read IDs, indexed compact metadata pages, a bounded recent
feed and shared request caches keep counts exact without per-photo requests.
See the [notification contract](PLACES_AND_COMMENTS.md#comment-notifications).

## Features versus editorial content

Heading East's second camera batch uses the existing incremental photo importer
and private publisher. Its per-file location review list is in
[the second-batch report](HEADING_EAST_PHOTO_LOCATIONS_BATCH_2.md); original
checksums identify exact repeats without replacing reviewed photos.

The family trip’s chosen photos, composed cover, fourteen Replay chapters and
reviewed Swiss/Italian routes are content instances. New trips start with empty
photos/routes; full-trip Replay is disabled. The agent adds the equivalent inputs as
facts arrive; no feature porting is required.

Heading East includes 20 saved food/drink places matched from a shared Google
Maps list to seven existing city stays. Addresses, approximate venue pins,
branch-specific Maps links and factual sources use the existing Places contract;
no visit or group rating is inferred. The 11 October image refresh includes the
owner's exact Barbès and Abi’s photos and three images for each of the other 18
places: food or drinks and atmosphere, including bakery counters. Café August’s
three images are outside-only per the owner’s follow-up. The 56 images
load from their original hosts with source credits and links; verified Maps
contributor names are retained, with source-only credits where unavailable.
Shared image provenance supports externally hosted references (`linked`)
without labelling them owned or licensed. The [intake record](HEADING_EAST.md#saved-places--10-october-2026)
documents the city-only selection and excluded detours.

Nine to Como demonstrates nine travelers, three group routes, a validated Como
meetup, and a public MDN test video. Its lines are provisional endpoint guides.
Alpine Crossing retains an explicit cover and saved chapter data. The samples
demonstrate different transport combinations; full-trip Replay is disabled.
Their sparse illustrative media is intentional. They are not source templates
to duplicate and they do not certify route or photo-location accuracy.

## Authoring and publishing references

- [JOURNEY_WORKFLOW.md](../JOURNEY_WORKFLOW.md): intake through reviewed promotion.
- [PHOTO_WORKFLOW.md](../PHOTO_WORKFLOW.md): originals, derivatives, review and publishing.
- [PHOTO_AUTH_HANDOFF.md](../PHOTO_AUTH_HANDOFF.md): shared photo service operations.
- [ROUTE_GEOMETRY_WORKFLOW.md](../ROUTE_GEOMETRY_WORKFLOW.md): detailed multimodal routes, provider import, provenance and review.
- [TRAIN_ROUTE_WORKFLOW.md](../TRAIN_ROUTE_WORKFLOW.md): local railway network research and generation.
- [FRAMEWORK.md](FRAMEWORK.md): source ownership, exceptions and remaining migration.

When changing a feature, update its row and the applicable workflow. Record
reusable owner corrections and supersession in OWNER_DECISIONS.md and reconcile
conflicting entry points. A dated changelog entry alone does not update this
contract. Record supported optional
fields and their defaults with the feature; do not silently add a per-trip flag.


## Reliability and review scope — 12 September 2026

- Snapshot-aware, serialized ordinary Studio saves preserve newer unsaved edits;
  failure feedback and Preview remain available on phone/tablet layouts.
- Photo day filters keep the editing target in the result set. Complete upload
  forms scroll. Route acceptance, smoothing and reset support full-geometry Undo.
- Unused new places can be removed; retained chapter sentences may be blank.
- Back/Forward covers Album, About and photos; disabled Replay cannot reopen. Empty album days open the
  story, phone captions remain discoverable, and photo-map controls avoid Close.
- Maps have shared loading/error/Retry recovery and explicit no-location states.
  MapLibre is pinned and bundled. Secondary text uses the darker shared token;
  About is named and Studio modes expose selection to assistive technology.
- Public-photo Retry stays public. Mobile grids defer full-photo loading and
  adjacent images reuse the cache while the guarded speculative queue warms it.

The owner requested automatic unpublished draft recovery, review and discard on
14 September 2026; these are now delivered Studio features. Explicit sharing,
batch editing, publication readiness, private video and a labeled Replay timeline
were proposals. Batch editing, private video and Studio readiness were authorized
and implemented on 8 October. Readiness prepares an agent handoff; it does not
publish or verify a live deployment. Named Replay seeking was authorized with
the 11 October UX fixes, then superseded by disabling full-trip Replay later
that day (O09). Explicit
sharing was authorized on 12 October under O18 and now tracks the current day/photo/view;
saved visitor resume remains excluded.


Florence–Genoa is a cycling-only planning instance: nine travelers and six
bicycle days from 10–15 May 2026. Its six legs retain detailed, preserved
bicycle-network geometry with explicit reconstruction provenance. Arrival
travel and its group filters were removed at the owner’s request;
see [FLORENCE_GENOA.md](FLORENCE_GENOA.md). No trip-specific runtime code.
Its public day descriptions contain only campsite names; the existing optional
taglines are omitted, with detailed planning evidence retained in route sources.
