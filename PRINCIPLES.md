# Project principles

Read these with [the standing owner decisions](docs/OWNER_DECISIONS.md).
They apply to new atlases and content intake as well as shared implementation.
Specific current decisions and their supersessions are recorded there.

- Keep the docs as a live artifact for future agents. Capturing each new owner
  correction and reconciling superseded guidance is part of the same task, even
  for a small follow-up. Follow [the ongoing update procedure](docs/OWNER_DECISIONS.md#record-the-next-correction-before-closing-the-task).
- Build each feature once in the shared framework; trips are data instances.
  The guiding target is 99% shared behavior. Switzerland–Italy, samples, and
  fresh drafts use the same page template and runtime. See
  [the framework contract](docs/FRAMEWORK.md) for extension rules.
- A trip is a standalone story; real and demo content use separate pages.
- The root is an atlas of real journeys; each real journey has a stable,
  shareable detail URL.
- An event is a calendar day by default or a city stay when requested. Either
  may contain any number of ordered modes; keep the shared data/viewer contract.
- For a base-based trip, label the meaningful destination rather than the base.
- Keep map, segment order, title, prose, stops, and photos consistent.
- Leave optional photo copy and stories blank unless supplied by the traveler.
  Do not turn alt text, filenames, GPS or a nearby venue into personal meaning.
  Research requested venue facts separately from traveler memories and reviews.
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
- Full-screen photo browsing keeps the current calendar day or city context.
  Ordinary desktop and phone browsing continues across event albums in journey order; an
  event change also updates the atlas map/story. Dismissing photos in the same
  event preserves the map camera the traveler chose.
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
  a recent removal according to the documented surface-specific flow. The phone
  photo control says Back and returns to its presenting screen, including the
  photo grid. Pull-to-dismiss and browser history agree with that one-level
  return and retain the presenting grid/album and explored map camera.
- Keep the map and photograph as context. A panel must make the next action
  obvious without covering the content that explains it.
- Keep desktop photo browsing in the existing right sidebar with a large,
  uncropped, stable-height frame, adjacent thumbnails and compact details.
  Conversations float above it while retaining context. A new feature extends
  these established surfaces instead of silently replacing them.
- Use warm paper, restrained color, clear type, generous touch targets and
  short interruptible transitions. Respect reduced motion and keyboard use.
- Design incomplete, empty, loading and failed states as carefully as success.
  Report saving honestly and retain the text when a write fails.
- Every initial URL must reveal its resolved destination and access state in
  one presentation: catalog, journey, shared/deep links and intermediate login
  or redirect pages. Never flash a password request, default view or error that
  an automatic check will immediately replace. Slow checks use neutral progress
  and bounded recovery. See [O04's entry checks](docs/OWNER_DECISIONS.md#initial-page-presentation--20-october-2026).
- Keep a self-chosen display name separate from ownership. A name change is
  a small edit, not a new account or another password ceremony.

Use [the owner-decision checks](docs/OWNER_DECISIONS.md) for current acceptance.
The [Places UX record](docs/PLACES_UX_REVIEW_2026-09-20.md) and
[earlier UX audit](docs/UX_AUDIT_2026-09-12.md) provide historical evidence;
later explicit corrections take precedence over their proposals.
