# Family-trip content publication

## Neighboring upload-folder video audit — 2 November 2026

Owner direction: check the upload folders next to `photos/venice-vienna ish/`
and add missed videos. The follow-up explicitly excludes `IMG_4688.MOV`
(camera date 7 June) and `IMG_4879.MOV` (21 July): “ignore those then”. This
supersedes the original six-family-MOV hold for the four in-trip clips below;
the two excluded originals remain private and unimported.

The recursive audit of all seven `photos/` directories found ten unique
original videos: the four already published Heading East clips and six in
`photos/rushton-trip/`. The other upload folders contain only stills. The four
copies in `studio-video-uploads` are exact source-hash duplicates, not new clips.

| Accepted original | Camera-local capture time | Existing event |
| --- | --- | --- |
| `IMG_5066.MOV` | 16 August 2026 · 17:37:19 +02:00 | Day 4 · Lake Luzern & Kehrsiten |
| `IMG_2884.MOV` | 18 August 2026 · 14:57:33 +02:00 | Day 6 · Brienz, Interlaken & Mürren |
| `A001_08221432_C069.MOV` | 22 August 2026 · 14:32:12 +02:00 | Day 10 · Varenna, Fiumelatte, Dervio & Bellagio |
| `A001_08221432_C070.MOV` | 22 August 2026 · 14:32:30 +02:00 | Day 10 · Varenna, Fiumelatte, Dervio & Bellagio |

Use QuickTime's original creation date, corroborated by Blackmagic's recorded
date where present, rather than filesystem/export time. Titles contain only
the capture date/time; captions and unknown locations stay blank. Interleave
the clips through the shared `takenAt` contract without changing existing
stills, notes, album orders, pins, Trash, cover or itinerary. Preserve untouched
originals/full probe metadata locally and publish only bounded, upright,
metadata-stripped MP4/WebP derivatives through the existing private R2 pipeline.
Legacy family still labels omit the year; the shared ordering helper resolves
them against their actual event calendar without rewriting those labels. The
new clips occupy Day 4 position 8 of 12, Day 6 position 13 of 21 and Day 10
positions 4/5 of 11, preserving every still's relative position. `IMG_2884.MOV`
also exposed full-range camera samples; the converter now converts their range
before strict H.264 validation, preserving contrast and upright orientation.

All eight private derivatives (32,225,204 bytes) are uploaded and downloaded
for SHA-256, length and serving-MIME verification; originals were not uploaded.
The family viewer has 103 stills plus four clips. Local browser review confirms
upright landscape/portrait playback with readyState 4/no media errors, timestamp
positions and the phone grid. All 916 tests and the production build pass;
77 ordering/framework checks pass after the final legacy-date refinement.
Reference/demo/fresh-draft synthetic imports cover rotated full-range footage,
and their independently populated media models cover both timestamp formats.
Primary Studio has the matching descriptors, sixteen private derivative/original
records and converter/order corrections; its targeted tests and build pass.
Existing source photos/overrides, Heading East, route data and family editorial
fields are unchanged. Shared viewer controls and phone implementation are retained.
Pages delivery and fresh protected playback verification are pending; see
[WIP](../../WIP.md#neighboring-upload-folder-videos--2-november-2026).

## Earlier still-photo publication — 8 October 2026

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
