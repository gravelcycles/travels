# Project principles

- Build each feature once in the shared framework; trips are data instances.
  The guiding target is 99% shared behavior. Switzerland–Italy, samples, and
  fresh drafts use the same page template and runtime. See
  [the framework contract](docs/FRAMEWORK.md) for extension rules.
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
- A located photo keeps its exact pin separate from its composed map frame.
  Keep the camera still while successive photo pins are already in view;
  travel to the saved frame only when needed to show the next location.
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

## Interaction quality

The owner's direction for new places/reviews/photo conversations is Apple-like
care, while retaining the atlas's personal character. This means:

- Preserve unfinished text, selection, scroll position and the surrounding trip
  when moving between views. A background update must never replace a draft.
- Give each screen a clear primary action; reveal secondary actions where they
  are needed. Keep implementation and prototype explanations out of the story.
- Make Back go one level up, Close dismiss the current surface, and Undo recover
  a recent removal. Browser history must agree with those visible controls.
- Keep the map and photograph as context. A panel must make the next action
  obvious without covering the content that explains it.
- Use warm paper, restrained color, clear type, generous touch targets and
  short interruptible transitions. Respect reduced motion and keyboard use.
- Design incomplete, empty, loading and failed states as carefully as success.
  Report saving honestly and retain the text when a write fails.
- Keep a self-chosen display name separate from ownership. A name change is
  a small edit, not a new account or another password ceremony.

See [the UX acceptance record](docs/PLACES_UX_REVIEW_2026-09-20.md) for this
feature's review matrix and [the earlier UX audit](docs/UX_AUDIT_2026-09-12.md)
for the established reliability and visual principles.
