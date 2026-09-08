# Project TODO

Each unchecked top-level item is intended to be a separate agent task. Read
`PROJECT_STATE.md`, `PRINCIPLES.md`, and `AGENT_HANDOFF.md`, then load only the
references named by that task. All commands, servers, QA, commits, pushes, and
deployment checks are agent-owned; never ask the user to run npm or terminal
commands.

## P0 · Content corrections

- [x] **T01 — Correct Day 1 legs and story.** In `family-d1`, keep only
      `family-airport-luzern` (Zürich Flughafen → Luzern). Remove the reverse
      pickup leg from the day and reconcile title, `destinationId`, prose,
      distance/summary, route layering, and bounds. Verify desktop/mobile and
      the deployed trip page.
- [x] **T02 — Repair Day 10 ferry geometry.** Research the actual Como → Varenna
      and Dervio → Bellagio services, correct `family-como-varenna-boat` and
      `family-dervio-bellagio-boat` so every point remains on the intended water
      route, record sources/limitations in `ROUTE_SOURCES.md`, and verify all
      five Day 10 legs together at close zoom.

## P1 · Atlas structure and map clarity

- [x] **T03 — Split atlas index from trip detail.** Make `/travels/` a polished
      catalog containing every real journey and move the current trip to
      `/travels/switzerland-italy.html`. Establish a reusable trip-page
      selection mechanism rather than cloning application logic. Keep fictional
      demos separate, preserve low-discovery metadata, update links, and verify
      direct/deep navigation on GitHub Pages.
- [x] **T04 — Make transport modes unmistakable.** Redesign route styling and
      legend so train, ferry, bus, gondola, walk, bike, and car are quickly
      distinguishable at overview and close-up scales. Use redundant color plus
      dash/width/casing/symbol cues, retain selected-route emphasis, place lines
      below labels, and test color-vision/low-contrast conditions.
- [x] **T05 — Stop day dots covering labels.** Treat day markers and basemap
      place labels as a collision problem. Test smaller/offset/leader-line or
      zoom-dependent markers and avoid pinning DOM markers directly over named
      places. Acceptance: Zürich, Luzern, Como, Lugano, Bellagio, and other key
      labels remain readable in journey and day views on desktop/mobile.
- [x] **T06 — Evaluate a terrain-readable basemap.** Prototype OpenTopoMap first,
      then compare a restrained vector/topographic option if necessary. Water,
      land, forest, and mountain terrain should be visually legible with better
      contrast, while routes, labels, photos, performance, attribution, Italy
      coverage, and no-key deployment remain acceptable. Document the decision;
      do not commit to a paid/keyed service without user approval.
- [x] **T07 — Add route story hover/tap.** Give route layers generous invisible
      hit targets. Hover or keyboard focus should show day, mode, endpoints, and
      a concise “what we did here” summary; tap should provide the equivalent on
      touch. Highlight the corresponding leg/day without blocking map pan/zoom
      or covering the route with a large tooltip.

## P1 · Reusable route pipeline

- [x] **T08 — Generalize network geometry for multiple journeys.** Refactor
      `scripts/build-route-geometry.mjs` to select a journey ID and consume a
      per-journey source manifest. Preserve ordered stops, provenance, warnings,
      static deterministic output, and existing reviewed geometry. Follow
      `JOURNEY_WORKFLOW.md` and add fixture-based tests for disconnected or
      ambiguous networks.
- [x] **T09 — Make Studio route edits mode-aware.** Preserve user
      `controlPoints` as via anchors, then snap/re-route between them using the
      selected mode's rail, ferry, road, walking, or bicycle network. Never
      overwrite anchors on regeneration; surface failed/unsafe snaps and retain
      the last reviewed geometry. Show original, proposed, and saved lines for
      comparison.
- [ ] **T10 — Add GPX import for bike/walk days.** Let an agent or Atlas Studio
      attach a GPX track to a segment, validate ordering/gaps, calculate distance,
      simplify without losing meaningful turns, and save `[lng, lat]` geometry.
      Keep source GPX private by default and record provenance. Add fixtures and
      visual QA for a bicycle day.
- [x] **T11 — Make new-journey creation repeatable.** Implement the source-file
      and generation structure described in `JOURNEY_WORKFLOW.md`, including
      stable slugs, catalog metadata, per-trip pages, journey-specific route and
      photo outputs, validations for duplicate/broken IDs, and one agent command
      that builds all public assets. Completed with Studio New trip, private local
      drafts, complete ISO-date calendars, reusable page generation, separate
      journey photo/route sources, and `npm run build`.

## P2 · Studio and editorial workflow

- [ ] **T12 — Review all 104 current photos in Studio.** Confirm date-inferred
      days, exact locations, captions, descriptions, alt text, visibility, and
      privacy. The supplied stills contained no GPS coordinates. Do not publish
      sensitive precise locations without review.
- [ ] **T13 — Add lead-photo ordering to Studio.** Provide keyboard-accessible
      ordering within each day, make ordering explicit in source overrides, and
      use it consistently in the story lead, strip, and day viewer.
- [x] **T14 — Clarify the unfinished editor request.** The user confirmed that
      Studio should edit route start/end points, select among multiple routes,
      and edit day titles and descriptions. The accessibility-description field
      can be removed from Studio. Implementation is tracked below as T18.
- [ ] **T15 — Decide whether to support the six held MOV files.** If approved,
      design a separate metadata-stripping, poster, encoding, responsive loading,
      accessibility, and Release publishing pipeline.
- [ ] **T16 — Decide how to handle days 9, 11, and 14 without family photos.**
      Prefer intentional empty states. If the user wants fallback media, use only
      reviewed reusable/licensed sources and record creator, URL, license, and
      useful alt text; clearly label illustrative images.

## P3 · Fun feature

- [ ] **T17 — Build Trip Replay after route/photo review.** Animate ordered legs
      day by day, distinguish transport modes, pause or zoom at located photos,
      and provide play/pause, speed, reduced-motion, keyboard, and timeline
      controls. Do not build it on top of known-wrong geometry.

## P2 · Confirmed Studio expansion

- [x] **T18 — Edit route endpoints and day copy in Studio.** Let editors select
      any journey, day, and route; edit a leg's start/end point; and edit day
      titles and descriptions. Preserve stable IDs, validate references, keep
      all generated overrides deterministic, and remove the photo accessibility-
      description field from the Studio UI.

## P1 · Future-trip planning follow-up

- [ ] **T19 — Grow the draft planner beyond day copy.** Add Studio controls for
      trip title/date-range changes, named places, and ordered travel legs.
      Preserve existing IDs, notes, and overrides when inserting/reordering days;
      preview additions before removing dated content. New trip creation now
      needs only a name and dates, but these later structural edits are still
      agent-owned source edits. Prioritize this next for future journeys.

## Bugs found during the new-trip pass

- [x] **T20 — Remove default-trip assumptions from photos and previews.** Studio
      preview always opened Switzerland–Italy; imported photos were assigned to
      the default journey and the importer hard-coded 2026/Europe-Zurich/family
      IDs. Use journey-keyed photo manifests, explicit importer selection, ISO
      day dates, a journey time zone, and the selected trip's local preview.
- [x] **T21 — Clear stale editors when changing trips or selecting empty days.**
      Photo-free trips retained the previous photo form; route-free days retained
      the previous editable route. Switching trips before map load also left old
      day fields visible, and map load could clear unsaved status. Editor state
      now updates independently of the map; empty route/photo editors are inert.
- [x] **T22 — Validate override ownership and exclude draft edits.** Unknown IDs
      and cross-trip photo-day assignments could be saved. Validate before any
      save/build; keep draft notes and assets in ignored local files and exclude
      them from every public bundle. Pages now validates/builds in CI.
- [ ] **T23 — Make Clear photo location remove inherited GPS.** If a base photo
      already contains GPS, deleting only its override location lets base
      coordinates reappear on reload. Add an explicit location-cleared value,
      honor it in Studio and the viewer, and test clearing/restoring a GPS photo.
- [ ] **T24 — Discard outdated route proposals after anchor edits.** An in-flight
      network proposal checks journey/segment identity but not whether anchors
      changed while it ran. Compare request anchors or a revision token before
      displaying/accepting the result; test same-segment edits during a request.
- [ ] **T25 — Resolve photo timestamps without an explicit UTC offset.** The
      importer now supports each journey's calendar and time zone, but naive
      EXIF dates can be interpreted in the host's zone before conversion. Add
      offset-aware fixtures and a documented camera-local-time rule before
      relying on automatic day matching for trips across time zones.

## Completed foundation

- [x] Import 104 in-range iPhone stills and generate responsive,
      metadata-stripped WebP derivatives with blurred placeholders.
- [x] Publish 356 approved derivatives in the public `trip-photos-v1` GitHub
      Release and verify representative responsive asset URLs.
- [x] Build a local Atlas Studio for photo metadata, exact map positions, and
      manual route control-point editing with smoothing and undo/redo.
- [x] Build a day-scoped full-screen photo viewer synchronized with the main
      map/story, including exact located-photo zoom and empty days.
