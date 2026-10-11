# Start every task here

- Read `docs/OWNER_DECISIONS.md` and `PRINCIPLES.md` before any content intake,
  trip creation, feature work or UX change. Prior corrections and style choices
  carry forward to every atlas, not only to the trip where they were discovered.
- Then read `docs/FRAMEWORK.md` and `docs/FEATURES.md` for current architecture
  and behavior, and the relevant `WIP.md` entry for unfinished work/authorization.
  Before creating a trip, read `JOURNEY_WORKFLOW.md`; before photo work, read
  `PHOTO_WORKFLOW.md`; before route work, read `ROUTE_GEOMETRY_WORKFLOW.md`
  (and `TRAIN_ROUTE_WORKFLOW.md` for rail); before Places/comments work, read
  `docs/PLACES_AND_COMMENTS.md`. Load the target trip's intake/provenance too.
- Latest explicit owner direction governs its scope. Current decision/contract
  docs take precedence over dated handoffs, audits, changelog entries and demos.
  `PROJECT_STATE.md`, `AGENT_HANDOFF.md` and `UX_HANDOFF.md` are historical
  records, not startup specifications. Resolve contradictions from evidence;
  do not treat an older "Current" or "Next" heading as new authorization.

# Carry corrections forward

- A new atlas inherits editorial defaults and interaction quality as well as
  shared code. Do not invent photo copy, venue associations, viewpoints, visits
  or filler stories. Blank optional text is intentional. Preserve traveler edits.
- Preserve the established desktop sidebar, phone navigation, map hierarchy,
  image loading and creator recovery flows when extending them. Use the concrete
  acceptance checks in `docs/OWNER_DECISIONS.md`, not a new interpretation of
  "Apple-like" on each task.
- For each correction, classify it as a shared requirement or a trip fact.
  Update `docs/OWNER_DECISIONS.md` for reusable decisions (date, scope, behavior,
  superseded choice); keep trip-specific facts in that trip's sources/provenance.
  Update the applicable workflow and feature inventory in the same change.
  Search README, prompts, WIP and historical entry points for contrary advice;
  replace current instructions and explicitly mark superseded history.
- Before completing a new trip or content import, run the inheritance checklist
  in `JOURNEY_WORKFLOW.md`. An empty draft or identical control IDs cannot prove
  the populated experience is correct. Include the actual target trip/event
  model and check the affected flow against the reference, a demo and an
  independently populated fresh draft when shared behavior changes.
- Proposals/local demos remain within their requested review scope. Existing
  authorization persists; do not request approval again for approved work.
  Historical experiments do not override later owner corrections.

# Shared framework (owner direction, 10 September 2026)

- `docs/AGENT_PROMPTS.md` contains reusable task prompts. Prompts supplement
  this file and the standing owner decisions; they never reset them.
- Build features once in shared code. Every trip is an instance described by
  journey JSON and its route/photo/editorial assets. The target is 99% shared
  behavior; never copy a trip's HTML, JavaScript, or CSS to start another trip.
- Switzerland–Italy is the reference experience and regression fixture, not
  an alternate implementation. Demos and empty new drafts must inherit the
  same features. Content-dependent controls follow documented empty states
  (including hidden viewer Places buttons for a trip with no places); do not
  disable features merely because a trip is new or a demo.
- Edit `content/templates/journey.html` for all journey page markup, including
  demos and Studio previews. Edit `content/templates/catalog.html` for the
  catalog. `dist/*.html` is generated. Shared browser JS/CSS under `dist/assets`
  is currently hand-authored EXCEPT generated data bundles listed in
  `docs/FRAMEWORK.md`; do not assume the entire dist directory is disposable.
- Keep trip IDs, dates, coordinates, photo choices, and Replay chapters in
  content sources. Do not branch shared code on a concrete journey ID or URL.
  A true one-trip feature must use a narrowly scoped, validated optional data
  field with a safe absent default, an example/test, and a documented reason.
  Do not introduce a parallel page or a speculative plugin/flag system.
- For shared behavior changes, cover Switzerland–Italy, at least one demo,
  and a freshly generated draft in appropriate regression checks. Extend
  `test/shared-framework.test.mjs` when changing shared page or data contracts.
  Do not satisfy parity by copying the family itinerary into a new trip.
- Update the feature inventory and applicable workflow in the same change.
  Record unresolved framework work in `docs/FRAMEWORK.md` and `TODO.md`.
  Update `WIP.md` when workstream status changes and append a dated
  `CHANGELOG.md` entry for features, corrections and workflow changes.
- Run `npm test` and `npm run build`; include regenerated public output in the
  delivery. CI rejects a build that changes checked-in `dist/` files.
- Operate commands, Studio, asset generation, and publishing for the user.
  Preserve unrelated working changes; commit only the task's own changes.

# Delivery

- Deploy completed user-requested changes by default after the appropriate
  checks pass. The owner explicitly requested this standing preference on
  9 September 2026; a local preview alone does not complete delivery.
- Before each deployment, fetch and integrate the latest remote `main`.
  Preserve concurrent work and never force-push the shared branch.
- Verify the GitHub Pages deployment succeeds and check a fresh public page
  before reporting completion.
