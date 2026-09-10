# Shared feature inventory

Current contract: 10 September 2026. Applies to Switzerland–Italy, every sample,
and every new journey. “Available” means the common implementation exists;
actual content, reviewed geometry and photographs must be supplied per trip.

| Capability | What carries over | Trip input / empty behavior | Main owner |
| --- | --- | --- | --- |
| Catalog and stable URL | Real-trip catalog, cover rows, stable detail page; desktop headers omit sample links, trip badges and About | `kind`, `published`, `slug`; drafts and demos stay out of the real catalog | build-site, catalog.js |
| Opening | Cover image/focal point, title, dates, Relive/Explore actions | Optional `coverPhoto`; first visible photo or text scene fallback | journey.html, app.js, atlas-utils |
| Calendar and journal | Every day, ordered travel legs, optional prose, previous/next, return to journal | `days`, `calendarDate`, optional destinations; no fake place for unknown plans | app.js, journey-content |
| Route overview and focus | Whole-trip/day bounds, quiet context, route inspection and named stops; map credits start collapsed behind a working info button in every map; small orange intermediate rail stops with white rims spanning the line, larger dots at both ends of every train leg. Stop dots appear only once their train lines render, with pending reveals cancelled on day changes. Destination labels show place names and day numbers, ivory/teal selection, measured route/control collision avoidance, compact/culling fallback and subtle connectors. Click a single-day label to focus its day; repeat stays offer a day chooser. Phone labels have 44 px targets; full names/dates remain in accessible labels and native desktop tooltips | Places, ordered `segmentIds`, segments/geometry; map actions disable when no coordinates exist | app.js, location-labels.js |
| Travelers and separate routes | Roster, group filter, validated meetup, shared legs/media; Day details list every group's travelers, route, transport and overnight with route-selection actions; map/journal/media/Replay follow the selection | Optional `travelers`, `routeGroups`, leg/media `groupIds`, day `groupPlaces`, `meetup`; absent fields preserve single-party behavior; editable in Studio Trip plan & media or JSON/planner API | group-travel, journey-extras, app.js, Studio |
| Videos in the photo viewer | Mixed day previews, albums and filmstrips; opening-frame thumbnails with play/duration badges; large player with native play/pause/seek/volume/fullscreen and inline phone playback; retry, pause on grid/background and release on media change/close | Optional `videos` with explicit public HTTPS MP4/WebM sources; optional HTTPS poster, otherwise cached browser frame extraction for CORS-compatible clips; private upload/delivery is pending | media-utils, journey-extras, journey.html, app.js, mobile-ux.js |
| Transport modes | Train, ferry (`boat`), bus, gondola, walk, car, bike; redundant color/line patterns and matching legend | `segment.mode`; a new mode requires a shared schema/style/routing change | viewer, Studio, validators |
| Day photo preview and albums | First photo follows album order, View photos, all-day album overview, empty-day story | Photo manifest, `photoOrder`; independent `leadPhotoId` for editorial uses | app.js |
| Full photo viewer | Per-day photo arrows, day changes synced to the journal/map, keyboard navigation, retry/unlock, filmstrip; clean full-photo edges with loading-only placeholders and phone-only swipe neighbors; next-day action has no pulsing halo | Visible photos with usable derivatives; no small-photo substitute for fullscreen | app.js, photo-auth, mobile-ux.js, styles.css, mobile.css |
| Photo map and camera | Shared pin/zoom handling, camera transitions and reduced motion; frame-aware behavior is inherited when added to the shared helper | Optional photo coordinates/zoom and supported frame overrides; unlocated photos keep day context | atlas-utils, app.js, Studio |
| Photo loading/access | Responsive thumbnails, full-size viewer readiness, bounded preloads, shared password access and remembered login | Publish reviewed derivatives into a journey-specific private namespace; no new login implementation per trip | photo-auth.js, Worker, photo scripts |
| Automatic Replay | Map-only route travel and day stories, distance-based pacing, play/pause, speed, stepping, timeline, completion | Works without authored `replayMoments`; rest days remain present; no image loading or photo pauses | replay-utils, app.js |
| Curated Replay | Edited map chapters, captions, timing and reviewed camera targets; same player | Optional `replayMoments`; existing photo choices are ignored by Replay; curate the new trip’s content, never copy family chapter IDs | planner, replay-utils, app.js |
| Mobile day experience | Map-led day screen with a persistent compact header and direct Replay button, compact summary, Day details/photos and bottom day navigation; day picker contains other journey-wide actions, details contain the route key; All days returns directly from a focused day to the whole map; the bottom day picker lists every day; mobile route taps select the day without a tooltip, while desktop inspection remains available | Same shared template with mobile styles; empty routes/photos have explicit states | journey.html, app.js, mobile-ux.js, mobile.css |
| Mobile photo gestures | Day Photos opens that day’s grid; sideways drag, pinch zoom, animated double-tap zoom around the tapped point, bounded pan, location map opened by pulling up on the photo or its button/handle, and next-day handoff. Sideways swipes and grid changes keep a closed location closed; vertical drags pan a zoomed photo. Day button and browser Back return to the day map; photo/grid headers omit duplicate close and zoom icons | Same day/photo data and private-photo loader; immediate, interruptible swipes; reduced motion and album boundaries respected | mobile-ux.js, mobile.css |
| Mobile Replay | Large route map, anchored timeline and playback controls, compact day story and Explore day action; landscape places the story beside the map | Shared automatic/curated moments; no Photos tab, images or photo preloads; day albums remain the place to browse photographs | journey.html, app.js, mobile-ux.js, mobile.css |
| Direct entry and accessibility | Day/photo deep links, a slim slate keyboard-focus indicator without orange or persistent rings after mouse/touch input, reduced-motion support | Shared browser behavior; phone day links open the day map; dialog/history focus restoration remains available | app.js, mobile-ux.js, input-mode.js |
| New-trip planning | Title/dates/time zone, complete draft calendar, places, ordered legs, date changes, stable IDs, preview | Studio + New trip or `journey:new`; ignored local draft until promoted | create-journey, planner, Studio |
| Group and video authoring | Add/edit/remove travelers and groups, exclusive membership, per-leg and photo/video audiences, group overnight places and meetup; hosted-video forms with day/title/link/poster/caption/credit/visibility/order, native preview and duration detection | Studio **Trip plan & media** checks the full plan before saving; source revisions and backups protect edits; removal of referenced groups is blocked until reassigned; hosted public MP4/WebM only | Studio plan-extras, journey-planner, studio-plan-sources |
| Photo authoring | Multi-upload, capture-date assignment, unmatched-day review, order/lead/cover selection, pins/copy, recoverable trash | Private originals and trip time zone/calendar; blank captions are valid | Studio, studio-photo-service |
| Route authoring | Endpoint/control-point editing, undo/redo, routing readiness with actionable setup messages, point cleanup and mode-aware replacement proposals, reviewed geometry preservation until acceptance, GPX import | Per-journey network extracts/manifest or private GPX; missing inputs disable generation with a visible next step; preserve applies to unattended builds and permits explicit Studio previews | Studio, routing scripts |
| Editorial safety | Readable overrides, ownership/reference validation, local backups and revision checks | Stable namespaced IDs; originals and local draft assets remain ignored | journey-content, Studio server |
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
- [TRAIN_ROUTE_WORKFLOW.md](../TRAIN_ROUTE_WORKFLOW.md): route research and generation.
- [FRAMEWORK.md](FRAMEWORK.md): source ownership, exceptions and remaining migration.

When changing a feature, update its row and the applicable workflow. A dated
changelog entry alone does not update this contract. Record supported optional
fields and their defaults with the feature; do not silently add a per-trip flag.
