# Shared framework (owner direction, 10 September 2026)

- Read `docs/FRAMEWORK.md` before feature work and `JOURNEY_WORKFLOW.md`
  before creating a trip. `docs/FEATURES.md` is the current feature inventory;
  `docs/AGENT_PROMPTS.md` contains reusable task prompts.
- Build features once in shared code. Every trip is an instance described by
  journey JSON and its route/photo/editorial assets. The target is 99% shared
  behavior; never copy a trip's HTML, JavaScript, or CSS to start another trip.
- Switzerland–Italy is the reference experience and regression fixture, not
  an alternate implementation. Demos and empty new drafts must inherit the
  same features. Content-dependent controls may be empty/disabled until data
  exists; do not disable features merely because a trip is new or a demo.
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
  Current contracts take precedence over dated handoff/changelog entries.
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
