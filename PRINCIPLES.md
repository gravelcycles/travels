# Project principles

- A trip is a standalone story; real and demo content use separate pages.
- The root is an atlas of real journeys; each real journey has a stable,
  shareable detail URL.
- The calendar day is the main unit and may contain any number of ordered modes.
- For a base-based trip, label the meaningful destination rather than the base.
- Keep map, segment order, title, prose, stops, and photos consistent.
- Stops describe meaning; detailed geometry describes the line's actual shape.
- Store new geometry in GeoJSON order: `[longitude, latitude]`.
- Do not invent precision; mark representative schedules and routes honestly.
- On day focus, keep trip context grey and put the selected day's routes on top
  in their transport colors, with greater width and full opacity. Keep those
  colors during route inspection so the map key remains consistent.
- Line patterns should remain distinguishable without relying only on color.
- Every shared feature change must also work on the demo page.
- Preserve private photo originals; publish reviewed, optimized derivatives.
- Keep human-edited photo and route overrides as readable JSON sources; treat
  the browser-loaded override JavaScript as generated output.
- A highlighted located photo should move the map to its exact coordinate and
  intentional local zoom, while its caption and description explain the scene.
- Full-screen photo browsing remains anchored to a calendar day; changing days
  also changes the atlas map/story context.
- Give photos a tiny embedded preview, responsive sizes, lazy off-screen loads,
  and bounded neighbor preloads so the atlas stays quick without feeling empty.
- Route smoothing must never imply network accuracy. Keep enough editable
  control points to hold trains on rails, ferries on water, and roads on land.
- Prefer mode-aware network routing through preserved human control points;
  accept traveler GPX as the strongest source for a recorded bike/walk route.
- Route interactions must work with hover, keyboard focus, and touch.
- Day markers should orient the reader without obscuring essential place names.
- Operational work is agent-owned: run tools, builds, local servers, publishing,
  and verification for the user.
- Verify changes on the deployed GitHub Pages site, including a fresh load.
- `noindex` discourages discovery but does not make a public Pages site private.
