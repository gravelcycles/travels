# Changelog

Keep this file current whenever a user-visible feature, content correction, or
workflow change lands. Add the newest entry first and include the matching
commit after it is known.

## 7 September 2026

### Unmistakable transport modes

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
