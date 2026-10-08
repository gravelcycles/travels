# Family-trip content publication

Publication: 8 October 2026, explicitly requested by the owner after the local
workstream review. The original checkpoint remains on `codex/family-content-wip`
at `bb7164c`; only its five content-source changes were applied to current main.
Other prototype and recovery branches remain local.

## Published content

- `content/day-overrides.json`: Day 1/2 titles and dates, Day 5 rain-day story,
  Day 6 story/title/tagline, and three additional Day 8 album-order entries.
  The saved Day 2 story `hello` is preserved verbatim; no editorial rewrite was
  requested. It can be replaced in a subsequent Studio edit.
- `content/journeys/switzerland-italy-family-2026.json`: cover changes from
  `family-img-2880` to `family-img-1469`, focal point `[64, 48]`.
- `content/photo-overrides.json`: revised airport pin/zoom; composed map bounds
  for `family-img-1434`, `family-img-5032`, `family-img-2793`, and
  `family-img-1463`; three saved Trash selections. The shared map-frame
  implementation was already live; these are editorial settings.
- `content/route-overrides.json`: `family-airport-luzern` endpoint edit with
  18 control points and 221 geometry vertices, manual train routing and no
  smoothing. All other route overrides are unchanged. Publication preserves
  the saved route; it does not claim a new geographic verification.
- Upload manifest: the new Day 2 `IMG_1471.heic` record,
  `switzerland-italy-family-2026-upload-720e515e95e64fea8985`, is now marked
  `assetStatus: "published"` after its three protected WebP derivatives were
  uploaded and verified through the existing private-photo workflow.
- Public bundles and pages were rebuilt against current shared code, retaining
  the newer Heading East journey, rail markers, branding and cycling copy.
  The family viewer now includes 103 photos, with six on Day 2.

## Asset delivery and validation

`npm run photos:publish -- --journey switzerland-italy-family-2026 --publish`
uploaded the one pending photo's 480, 1280 and 2400 pixel derivatives
(3,399,954 bytes total) to the existing private R2 bucket. All three objects
passed checksum verification. The uploader confirmed the bucket's public
endpoints remain disabled. Originals and private derivatives remain outside
Git; existing journey authorization remains in force.

`npm test` passed all 369 tests, `npm run build` succeeded for eight published
journeys and no drafts, and `git diff --check` passed. Browser review confirmed
the new cover, saved story/title changes, six-photo Day 2 album and new photo
viewer. Reference/demo/fresh-draft regressions remain part of the shared suite.
Normal delivery requires fetching current main immediately before pushing and
checking the Pages deployment plus fresh public output.

## Recovery

`codex/archive/worktree-20261008` preserves the exact original dirty working
tree before the workstreams were split, including its older generated output.
The September snapshots and stashes are indexed in main's `WIP.md`. Do not
merge those whole snapshots over newer application code.

Ignored Studio drafts, revision history, originals, private derivatives and
route inputs remain on the owner's machine. The original local checkpoint is
retained as a historical snapshot, not as a second unpublished content queue.
