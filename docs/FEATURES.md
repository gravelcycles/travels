# Shared feature inventory

Current contract: 10 September 2026. Applies to Switzerland–Italy, every sample,
and every new journey. “Available” means the common implementation exists;
actual content, reviewed geometry and photographs must be supplied per trip.

| Capability | What carries over | Trip input / empty behavior | Main owner |
| --- | --- | --- | --- |
| Catalog and stable URL | Real-trip catalog, cover rows, stable detail page | `kind`, `published`, `slug`; drafts and demos stay out of the real catalog | build-site, catalog.js |
| Opening | Cover image/focal point, title, dates, Relive/Explore actions | Optional `coverPhoto`; first visible photo or text scene fallback | journey.html, app.js, atlas-utils |
| Calendar and journal | Every day, ordered travel legs, optional prose, previous/next, return to journal | `days`, `calendarDate`, optional destinations; no fake place for unknown plans | app.js, journey-content |
| Route overview and focus | Whole-trip/day bounds, quiet context, day bubbles clear transit strokes with leaders reaching mapped arrival points; small orange rail stops with white rims spanning the line, larger day start/end dots; route inspection and named stops | Places, ordered `segmentIds`, segments/geometry; map actions disable when no coordinates exist | app.js |
| Transport modes | Train, ferry (`boat`), bus, gondola, walk, car, bike; redundant color/line patterns and matching legend | `segment.mode`; a new mode requires a shared schema/style/routing change | viewer, Studio, validators |
| Day photo preview and albums | First photo follows album order, View photos, all-day album overview, empty-day story | Photo manifest, `photoOrder`; independent `leadPhotoId` for editorial uses | app.js |
| Full photo viewer | Per-day photo arrows, day changes synced to the journal/map, keyboard navigation, retry/unlock, filmstrip | Visible photos with usable derivatives; no small-photo substitute for fullscreen | app.js, photo-auth |
| Photo map and camera | Shared pin/zoom handling, camera transitions and reduced motion; frame-aware behavior is inherited when added to the shared helper | Optional photo coordinates/zoom and supported frame overrides; unlocated photos keep day context | atlas-utils, app.js, Studio |
| Photo loading/access | Responsive thumbnails, full-size viewer/Replay readiness, bounded preloads, shared password access and remembered login | Publish reviewed derivatives into a journey-specific private namespace; no new login implementation per trip | photo-auth.js, Worker, photo scripts |
| Automatic Replay | Ordered route travel, photo/day moments, distance-based pacing, play/pause, speed, stepping, timeline, completion | Works without authored `replayMoments`; rest days remain present | replay-utils, app.js |
| Curated Replay | Edited chapters, captions, photo choices, timing, reviewed camera targets; same player | Optional `replayMoments`; curate the new trip’s content, never copy family chapter IDs | planner, replay-utils, app.js |
| Mobile day experience | Map-led day screen, summary, Day details, day picker, previous/next, journey menu and route preview | Same shared template with mobile styles; empty routes/photos have explicit states | journey.html, app.js, mobile-ux.js, mobile.css |
| Mobile photo gestures | Sideways drag, pinch/double-tap zoom, bounded pan, photo grid, pull-up location map, next-day handoff and browser Back | Uses the same day/photo data and private-photo loader; reduced motion and album boundaries remain respected | mobile-ux.js, mobile.css |
| Direct entry and accessibility | Day/photo deep links, keyboard/focus behavior, reduced-motion support | Shared browser behavior; phone day links open the day map | app.js, mobile-ux.js |
| New-trip planning | Title/dates/time zone, complete draft calendar, places, ordered legs, date changes, stable IDs, preview | Studio + New trip or `journey:new`; ignored local draft until promoted | create-journey, planner, Studio |
| Photo authoring | Multi-upload, capture-date assignment, unmatched-day review, order/lead/cover selection, pins/copy, recoverable trash | Private originals and trip time zone/calendar; blank captions are valid | Studio, studio-photo-service |
| Route authoring | Endpoint/control-point editing, undo/redo, mode-aware network proposals, reviewed geometry preservation, GPX import | Per-journey network extracts/manifest or private GPX; missing inputs keep the reviewed line | Studio, routing scripts |
| Editorial safety | Readable overrides, ownership/reference validation, local backups and revision checks | Stable namespaced IDs; originals and local draft assets remain ignored | journey-content, Studio server |
| Reproducible delivery | Validated generation, cache-busted assets, Pages CI and public verification | Reviewed published sources; no private originals/network fetch needed for site build | build-site, Pages workflow |

## Features versus editorial content

The family trip’s chosen photos, composed cover, fourteen Replay chapters and
reviewed Swiss/Italian routes are content instances. New trips start with empty
photos/routes and automatic Replay. The agent adds the equivalent inputs as
facts arrive; no feature porting is required.

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
