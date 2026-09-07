# Changelog

Keep this file current whenever a user-visible feature, content correction, or
workflow change lands. Add the newest entry first and include the matching
commit after it is known.

## 7 September 2026

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
