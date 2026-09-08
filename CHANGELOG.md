# Changelog

Keep this file current whenever a user-visible feature, content correction, or
workflow change lands. Add the newest entry first and include the matching
commit after it is known.

## 8 September 2026

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
