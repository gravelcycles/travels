# Shared feature inventory

Inventory reconciled: 8 October 2026, including the 20 September release.
Applies to Switzerland–Italy, every sample,
and every new journey. “Available” means the common implementation exists;
actual content, reviewed geometry and photographs must be supplied per trip.

Local branch prototype: [Arrival → city](ARRIVAL_CITY_DEMO.md) traces the incoming
route and icon together at display cadence, with linear 2.5-second overhead
progression and a 0.25-second arrival pause before the destination zoom. Unlocated
photos keep the local city view.
It reuses the shared page, gallery and route geometry. It is **not published**;
the owner is reviewing this interaction before any production rollout.

[WIP.md](../WIP.md) distinguishes delivered features from preserved prototypes,
unpublished editorial work and remaining service/intake projects. In particular,
Live Photos playback is still an investigation. Private-video intake and live
photo comments now have shared implementations; media publication and community
service rollout follow their documented workflows.

Heading East exercises the shared city-stay contract with eleven stops through
Venice, 23 October 2026, and fourteen researched route legs. Extensions remain
content-only; see [its intake and route evidence](HEADING_EAST.md).

| Capability | What carries over | Trip input / empty behavior | Main owner |
| --- | --- | --- | --- |
| Catalog and stable URL | Real-trip catalog, cover rows, stable detail page; desktop headers omit sample links, trip badges and About | `kind`, `published`, `slug`; drafts and demos stay out of the real catalog | build-site, catalog.js |
| Site identity and link previews | Shared blue/white globe pin with orange tip in headers, SVG/PNG browser icons, Apple touch icon and 1200 × 630 Open Graph/Twitter share image; public titles/descriptions follow the page | No trip input; empty drafts inherit the icons without claiming a public URL; share artwork contains no trip photos | content/branding, content/site.json, build-site; [brand workflow](BRANDING.md) |
| Opening | Cover image/focal point, title, dates, Relive/Explore actions | Optional `coverPhoto`; first visible photo or text scene fallback | journey.html, app.js, atlas-utils |
| City-based events | One city stay per event, with arrival–departure ranges, incoming legs, one album/story, map selection, stop navigation and Replay; Studio creation, range editing and adding stops | Optional `eventMode: "city"`; `days` retains stable IDs and gains `calendarEndDate`. Absent mode remains a full daily calendar. Capture dates match stays; transfer dates default to the arriving city with manual reassignment available | atlas-utils, app, mobile-ux, planner, photo intake, Studio |
| Calendar and journal | Every day, ordered travel legs, optional editable italic tagline and full day story (preserving paragraphs), previous/next, return to journal; selecting a day scrolls its row into view in the left list, preserving visible rows and respecting reduced motion; Days without recorded travel omit the automatic transport summary; Travel details starts as one compact expandable row; expanded desktop legs are non-clickable: hover or keyboard focus highlights only that leg and greys all other routes, without a popup or camera movement; leaving/blur/Escape restores the map. Mobile legs retain tap-to-map behavior | `days`, `calendarDate`, optional destinations; no fake place for unknown plans | app.js, journey-content |
| Route overview and focus | Whole-trip/day bounds, optional wider geographic context for the overview, quiet context, compact charcoal city/town/village names with opaque warm-white halos above routes; road labels and highway shields below routes, route inspection and named stops; map credits start collapsed behind a working info button in every map; day maps show quiet intermediate rail stops with small orange centers and broad white rims spanning the blue line and overlapping its casing; larger 12 px start/end dots at both ends of every train leg appear in full and day views. Stop dots appear only once their train lines render, with pending reveals cancelled on day/scope changes. Small upright numbered signposts identify single-day destinations; repeated/nearby stops use quiet dots with explicit day choices. Pins cluster on zoom, keep numbered boards above the route on short vertical stems, and protect complete tap targets from controls. Stems at orange endpoints meet the top of the outer ring, with no teal foot or repeat dot covering the orange center. Posts never rotate or flip; other feet mark actual locations, with a dot fallback when space is tight. Hover/focus links pins, complete day routes and day rows, with one compact place card and no camera movement. Single-day click/tap opens the day; phone targets are 44 px, and accessible labels expose place/day information | Places, ordered `segmentIds`, segments/geometry; optional `overviewBounds` expands whole-trip framing, otherwise route/place bounds apply; map actions disable when no coordinates exist | app.js, location-labels.js |
| Curated places, food and group reviews | Searchable photo tiles and map pins with clustering; preserved category/day filters; Overview/Reviews/Photos; group star distribution; full-screen credited gallery; expandable phone sheet and Back/Forward. Preview adds rating-only/written review editing, per-place drafts and delete/Undo | Optional validated `pointsOfInterest`; absent data shows an inviting empty state. Prompt-authored public content, separate from itinerary route nodes | places-panel.js/css, places-comments.js, places-content.mjs, journey.html |
| Photo conversations | Remembered signed visitor identity, optional name at photo unlock, name changes, per-photo local draft recovery, shared reads/writes, pagination, own edit/delete with five-minute Undo, retry-safe posting and separate owner moderation/export | Real published photos use the existing photo-password access boundary and D1. Demo preview remains browser-only with password `demo`; empty drafts have no comment target until publication. See [operations](COMMUNITY_OPERATIONS.md) for required provisioning and rollout | photo-comments.js/css, community-client.js, places-comments.js, Worker community.mjs, journey.html |
| Travelers and separate routes | Roster, group filter, validated meetup, shared legs/media; Day details list every group's travelers, route, transport and overnight with route-selection actions; map/journal/media/Replay follow the selection | Optional `travelers`, `routeGroups`, leg/media `groupIds`, day `groupPlaces`, `meetup`; absent fields preserve single-party behavior; editable in Studio Trip plan & media or JSON/planner API | group-travel, journey-extras, app.js, Studio |
| Videos in the photo viewer | Mixed day previews, albums and filmstrips; opening-frame thumbnails with play/duration badges; large player with native play/pause/seek/volume/fullscreen and inline phone playback; retry, pause on grid/background and release on media change/close | Optional public HTTPS MP4/WebM or private hashed H.264/AAC derivatives; protected posters, native authenticated byte ranges, supplied transcript/timed captions for public clips; local clips excluded until verified publication | media-utils, journey-extras, journey.html, app.js, mobile-ux.js |
| Transport modes | Train, ferry (`boat`), bus, gondola, walk, car, bike; redundant color/line patterns and matching legend | `segment.mode`; a new mode requires a shared schema/style/routing change | viewer, Studio, validators |
| Day photo preview and albums | First photo follows album order, View photos, all-day album overview, empty-day story | Photo manifest, `photoOrder`; legacy `leadPhotoId` is preserved but has no active editor control | app.js |
| Photos + Places | Sparse day-map thumbnails coexist with place pins; selected groups preserve membership/order/current photo while zooming; Locate, About place, Comments and explicit Full screen; linked photos are separate from nearby suggestions and credited venue imagery | Optional ordered `point.photoIds`, validated within the journey; no-coordinate photos stay in the album, protected photos use existing unlock; public output filters local/trashed links while sources retain them | photo-places, photo-bubbles, places-panel, app |
| Owner Places editing | Add/edit/remove curated place details, day assignments, known coordinates, credited venue images, group reviews and ordered photo links; Undo removal and ordinary draft recovery/review/discard/conflict reconciliation | Studio Places for real/sample/new drafts; incomplete records retain recovery but need valid coordinates and sources before Save; no visitor edit role | Studio place-editor, journey-planner, places-content |
| Full photo viewer | Desktop normal browsing keeps days left and photos right; explicit Full screen opens the large viewer. Per-day photo arrows, day changes synced to the journal/map, keyboard navigation, retry/unlock, filmstrip; clean full-photo edges with loading-only placeholders and phone-only swipe neighbors; next-day action has no pulsing halo | Visible photos with usable derivatives; no small-photo substitute for fullscreen | app.js, photo-auth, mobile-ux.js, styles.css, mobile.css |
| Photo map and camera | Independent photo pins and saved map bounds, stationary navigation when both pins fit, direct nearby moves, smooth longer camera transitions and reduced motion | Optional photo coordinates/zoom and validated `mapFrame.bounds`; absent frames use the pin and zoom, unlocated photos keep day context | atlas-utils, app.js, Studio |
| Photo loading/access | Responsive thumbnails, full-size viewer readiness and a 350 ms blur-to-clear reveal, desktop blur-to-focus reveals on every appearance (including cached photos and video posters), continuous preview-to-photo handoff through the full viewer reveal, reduced-motion support, bounded preloads, shared password access and remembered login | Publish reviewed derivatives into a journey-specific private namespace; no new login implementation per trip | photo-auth.js, Worker, photo scripts |
| Automatic Replay | Map-only route travel and day stories, distance-based pacing, play/pause, speed, stepping, timeline, completion | Works without authored `replayMoments`; rest days remain present; no image loading or photo pauses | replay-utils, app.js |
| Curated Replay | Edited map chapters, captions, timing and reviewed camera targets; same player | Optional `replayMoments`; existing photo choices are ignored by Replay; curate the new trip’s content, never copy family chapter IDs | planner, replay-utils, app.js |
| Mobile day experience | Map-led day screen with a persistent compact header and direct Replay button, compact summary, Day details/photos and bottom day navigation; day picker contains other journey-wide actions, details contain the route key; All days returns directly from a focused day to the whole map; the single bottom day picker names the current day and lists every day; desktop uses its persistent left day list without a separate picker; mobile route taps select the day without a tooltip, while desktop inspection remains available | Same shared template with mobile styles; empty routes/photos have explicit states | journey.html, app.js, mobile-ux.js, mobile.css |
| Mobile photo gestures | Day Photos opens that day’s grid; sideways drag, pinch zoom, animated double-tap zoom around the tapped point, bounded pan, location map opened by pulling up on the photo or its button/handle, and next-day handoff. Sideways swipes and grid changes keep a closed location closed; vertical drags pan a zoomed photo. Day button returns to the day map; browser Back/Forward restores the presenting album when applicable; photo/grid headers omit duplicate close and zoom icons | Same day/photo data and private-photo loader; immediate, interruptible swipes; reduced motion and album boundaries respected | mobile-ux.js, mobile.css |
| Mobile Replay | Large route map, anchored timeline and playback controls, compact day story and Explore day action; landscape places the story beside the map | Shared automatic/curated moments; no Photos tab, images or photo preloads; day albums remain the place to browse photographs | journey.html, app.js, mobile-ux.js, mobile.css |
| Direct entry and accessibility | Day/photo deep links, a slim slate keyboard-focus indicator without orange or persistent rings after mouse/touch input, reduced-motion support | Shared browser behavior; phone day links open the day map; dialog/history focus restoration remains available | app.js, mobile-ux.js, input-mode.js |
| TBD itinerary | Planned/unconfirmed days or city stays, optional undated tail, inherited leg status, dotted routes and badges; Show TBD stops filters maps, navigation, albums and Replay | Optional day `planningStatus`; absent/confirmed retains existing behavior; Studio authors and validates it; dated range excludes the undated tail | atlas-utils, app, journey-content, planner, Studio |
| New-trip planning | Title/dates/time zone, daily calendar or city stays, places, ordered legs, date changes, stable IDs, preview | Studio + New trip or `journey:new`; ignored local draft until promoted | create-journey, planner, Studio |
| Group and video authoring | Add/edit/remove travelers and groups, exclusive membership, per-leg and photo/video audiences, group overnight places and meetup; hosted-video forms with day/title/link/poster/caption/credit/visibility/order, native preview and duration detection | Studio **Trip plan & media** validates the full plan on Save; checking changes first is optional; source revisions and backups protect edits; removal of referenced groups is blocked until reassigned; hosted public MP4/WebM and bounded private MOV/MP4/WebM intake with preserved originals, metadata stripping and local-only status | Studio plan-extras, journey-planner, studio-plan-sources |
| Photo authoring | Multi-upload, capture-date assignment, unmatched-day review, album order and cover selection, pins/copy, independently composed photo map frames, all non-trashed photos visible (no Hide control), recoverable trash | Private originals and trip time zone/calendar; blank captions are valid | Studio, studio-photo-service |
| Batch photo editing | Searchable day-filtered contact sheet, multi-selection and visible select-all, explicit outside-filter counts, batch day/stop assignment, move selected to each album’s start, Trash/Restore and guarded last-batch Undo | Photos → Select multiple; existing draft autosave, review, save and conflict handling. Source manifests and legacy hidden flags are preserved. Undo lasts until reload/journey change and refuses later changes to affected fields | Studio photo-batch model/UI; [photo workflow](../PHOTO_WORKFLOW.md) |
| Route authoring | Endpoint/control-point editing, undo/redo, routing readiness with actionable setup messages, point cleanup and mode-aware replacement proposals, reviewed geometry preservation until acceptance, GPX import | Per-journey network extracts/manifest or private GPX; missing inputs disable generation with a visible next step; preserve applies to unattended builds and permits explicit Studio previews | Studio, routing scripts |
| Editorial safety | Automatic unpublished drafts (immediate browser copy and local disk autosave), reload recovery, grouped saved/draft review with photo thumbnails, readable names and word highlights, discard with recovery archive, draft download, one-click Save without Preview, always-visible status, local backups, automatic merging of independent disk edits and field-by-field choices for actual conflicts | Stable namespaced IDs; originals and local draft assets remain ignored | journey-content, Studio server |
| Ready to share | Read-only review of the current Studio draft and trip plan against saved sources; real local-asset blockers, optional editorial choices, links to the affected editor, revision-bound acknowledgements and a copyable publishing handoff | Works for real trips, samples and empty drafts. Blank captions/stories and photo-only days are valid. Local draft promotion and protected-asset publication remain agent-operated. Public deployment is explicitly unverified until the agent checks it | Studio ready-to-share, studio-readiness; [workflow](../JOURNEY_WORKFLOW.md#ready-to-share-review) |
| Reproducible delivery | Validated generation, cache-busted assets, Pages CI, bounded orphan-deployment recovery/retry and public verification | Reviewed published sources; no private originals/network fetch needed for site build; GitHub service failures remain visible | build-site, Pages workflow, recover-pages |

## Features versus editorial content

The family trip’s chosen photos, composed cover, fourteen Replay chapters and
reviewed Swiss/Italian routes are content instances. New trips start with empty
photos/routes and automatic Replay. The agent adds the equivalent inputs as
facts arrive; no feature porting is required.

Nine to Como demonstrates nine travelers, three group routes, a validated Como
meetup, and a public MDN test video. Its lines are provisional endpoint guides.
Alpine Crossing demonstrates an explicit cover and curated Replay. The other
samples demonstrate automatic Replay and different transport combinations.
Their sparse illustrative media is intentional. They are not source templates
to duplicate and they do not certify route or photo-location accuracy.

## Authoring and publishing references

- [JOURNEY_WORKFLOW.md](../JOURNEY_WORKFLOW.md): intake through reviewed promotion.
- [PHOTO_WORKFLOW.md](../PHOTO_WORKFLOW.md): originals, derivatives, review and publishing.
- [PHOTO_AUTH_HANDOFF.md](../PHOTO_AUTH_HANDOFF.md): shared photo service operations.
- [ROUTE_GEOMETRY_WORKFLOW.md](../ROUTE_GEOMETRY_WORKFLOW.md): detailed multimodal routes, provider import, provenance and review.
- [TRAIN_ROUTE_WORKFLOW.md](../TRAIN_ROUTE_WORKFLOW.md): local railway network research and generation.
- [FRAMEWORK.md](FRAMEWORK.md): source ownership, exceptions and remaining migration.

When changing a feature, update its row and the applicable workflow. A dated
changelog entry alone does not update this contract. Record supported optional
fields and their defaults with the feature; do not silently add a per-trip flag.


## Reliability and review scope — 12 September 2026

- Snapshot-aware, serialized ordinary Studio saves preserve newer unsaved edits;
  failure feedback and Preview remain available on phone/tablet layouts.
- Photo day filters keep the editing target in the result set. Complete upload
  forms scroll. Route acceptance, smoothing and reset support full-geometry Undo.
- Unused new places can be removed; optional Replay sentences may be blank.
- Back/Forward covers Album, Replay, About and photos. Empty album days open the
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
publish or verify a live deployment. Explicit sharing and named Replay stops
remain design proposals. Replay playback and its slider are already shipped.


Florence–Genoa is a cycling-only planning instance: nine travelers and six
bicycle days from 10–15 May 2026. Its six legs retain detailed, preserved
bicycle-network geometry with explicit reconstruction provenance. Arrival
travel and its group filters were removed at the owner’s request;
see [FLORENCE_GENOA.md](FLORENCE_GENOA.md). No trip-specific runtime code.
Its public day descriptions contain only campsite names; the existing optional
taglines are omitted, with detailed planning evidence retained in route sources.
