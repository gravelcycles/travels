# Current workstreams

Status checkpoint: **8 October 2026**. Start here before resuming work.
This reconciles Git branches, stashes, ignored local prototypes, project docs,
and the relevant Travels tasks. It records unfinished work without promoting it
to the public site. [TODO.md](TODO.md) remains the backlog;
[docs/FEATURES.md](docs/FEATURES.md) describes implemented capabilities;
[docs/FRAMEWORK.md](docs/FRAMEWORK.md) defines the shared-code contract.

## Baseline and repository state

- The public baseline is `272086e344ea0f41a0093a5188e186a748aabded`, the
  20 September Places/comments UX release. Its original Pages deployment was
  [successful](https://github.com/gravelcycles/travels/actions/runs/35521475825).
- Local `main` was 55 commits behind that release. It has been fast-forwarded;
  this cleanup adds documentation on top. The website's production code and
  published trip content are unchanged by the cleanup.
- Five focused workstream branches below preserve saved content, prototypes,
  and investigation notes. They start from the same public baseline and can be
  resumed independently. Their commits are checkpoints, not release approval.
  At the owner's explicit request on 8 October, workstream and recovery branches
  stay local; only the main Markdown documentation is published remotely.
  Remote backup of those branches is outside this cleanup's scope.
  Branch/path references below identify files on those local branches.
- The exact original dirty working tree, both September safety snapshots, and
  all eight stashes are preserved on recovery branches. Original stashes and
  ignored private/local files are retained. Recovery branches are not candidates
  for wholesale merging over newer code.
- 32 fully merged local branch names and 28 registrations for missing temporary
  worktrees were retired. Their exact tips are listed at the end of this file.
  The primary checkout is left clean on `main` for the next task.

## Preserved work ready to resume

| Workstream | Branch / checkpoint | Status and next step |
| --- | --- | --- |
| Saved family-trip content | `codex/family-content-wip` · `bb7164c` | Content checkpoint; review stories, photo choices/framing, pending upload and rail edit before publishing. |
| Photo bubbles, day navigation and gentler Replay | `codex/day-experience-review` · `3a7da82` | Working local comparison prototype; select the behavior to integrate into shared source. |
| Six proposed feature demos | `codex/ux-feature-previews` · `a9ae0b2` | Interactive design artifact; five proposals remain open, while Studio recovery subsequently shipped. |
| Delight / creator experience | `codex/delight-preview` · `78ec3a5` | Separate interactive design artifact; choose a concrete improvement and reconcile it with current production. |
| Live Photos intake | `codex/live-photo-intake` · `db36e92` | Investigation notes only; waiting for an actual still/movie pair. No feature code exists. |

### Saved Switzerland–Italy editorial work

Branch handoff: `codex/family-content-wip:docs/workstreams/family-content.md`.
Five source files contain all the original saved Studio edits:

- `content/day-overrides.json`: Day 1/2 titles and dates; Day 5 rain-day story;
  Day 6 story/title/tagline; three additional Day 8 album-order entries.
- `content/journeys/switzerland-italy-family-2026.json`: cover changes to
  `family-img-1469` with focal point `[64, 48]`.
- `content/photo-overrides.json`: airport photo pin/zoom, four Luzern photo-map
  compositions, and three saved Trash choices. The shared map-frame capability
  already shipped in `e8d7f81`; these are editorial values for it.
- `content/route-overrides.json`: `family-airport-luzern` has an endpoint edit
  with 18 control points and 221 vertices, manual train routing, no smoothing.
- `content/photo-manifests/switzerland-italy-family-2026-uploads.json`: one new
  Day 2 `IMG_1471.heic` record remains `assetStatus: "local"`. The original and
  three private derivative files are not part of Git or automatically uploaded.

Generated bundles and four public HTML files were rebuilt against current main.
The pending upload remains excluded from public photo output. All five source
files preserve the original saved edits; no story was rewritten during cleanup.

**Review points:** Day 2 currently says `hello` (apparently a save-test value);
review that explicitly rather than silently deleting it. Check prose/tagline,
cover, album order, Trash choices and composed frames in Studio. Compare the
manual airport rail line with reviewed geometry. Review/publish the pending
photo through the existing private-photo workflow when ready. These checks are
editorial/geographic/asset decisions, not failures in the automated suite.

Validation: **361 tests pass**, `npm run build` succeeds, and diff checks pass.
No new private-media delivery or visual/geographic verification is claimed.

### Day-experience review prototype

Branch instructions: `codex/day-experience-review:experiments/day-experience/README.md`.
Recovered nine authored files from ignored `build/ux-review/` into
`experiments/day-experience/`. Original local files remain intact.

The latest reviewed direction from **Improve map photo display** is:

- Even small map bubbles show thumbnails; selection enlarges the active bubble.
  The open group retains its photo, count and swipe order through map zoom/pan;
  closing releases it to regroup. The card fits the full photo.
- Regional Replay holds adjacent short legs together, adds gentler framing and
  cuts between regions. Other comparison options retain a still day/chapter
  frame and the original camera. Keep Replay map-only.
- Destination-labelled previous/next-day buttons, optional date strip/swipe,
  and one emoji per distinct transport mode in **All days** are review options.
  The emoji placement is the owner's clarified direction.
- Earlier camera groups and nearby-place photo discovery remain comparisons,
  not multiple permanent feature modes to ship.

Agent resume commands, on the branch:

```sh
node experiments/day-experience/prepare.mjs
node --test experiments/day-experience/review.test.mjs
node experiments/day-experience/server.mjs
```

The read-only server binds `127.0.0.1:4175`. It composes a disposable shared
viewer under ignored `build/day-experience-review/`, including a fresh empty
draft. It may read existing local private derivatives; a fresh clone does not
contain those assets. Nothing in the comparison UI edits production content.

Cleanup fixed a stale five-journey assertion and made preparation replace its
generated snapshot. **10 prototype tests pass**, the launcher and eight preview
journeys respond successfully, and production build output remains unchanged.
Prior task messages report desktop/phone interaction review; this checkpoint
adds automated/HTTP verification, not a new visual acceptance pass.

Before adoption, choose defaults, integrate selected behavior once into shared
runtime/template code, remove comparison controls, extend reference/demo/draft
regressions, update inventory/workflows, test/build and deploy normally. Do not
publish the experimental snapshot as another journey implementation.

### Feature proposals and delight demos

The six-feature demo (`codex/ux-feature-previews`,
`experiments/feature-previews/README.md`) and delight demo
(`codex/delight-preview`, `experiments/delight-preview/README.md`)
are now versioned outside `dist/`. Each has a self-contained `index.html` and
handoff. They were copied byte-for-byte from the two pinned Travels task
visualizations, and their inline JavaScript passes syntax checks. Their simulated
state is not connected to real Studio saves, publication or backend services.

The 12 September audit's **20 authorized fixes shipped** in `f6790e4`.
Automatic visitor reload/resume, audit **V1, remains excluded**. The owner asked
for demos before putting the proposed new features on the live site.

| Proposal | Current status |
| --- | --- |
| Studio recovery, readable draft comparison, save-conflict review | Subsequently authorized and shipped on 14–15 September (`06f5d63`, `94f5f27`, `df5740d`). Do not reimplement the older mockup. |
| Explicit day/photo/moment sharing | Demo only. Preserve group/photo access context; do not infer permission for automatic visitor resume. |
| Batch photo editing / larger contact sheet | Demo only. Existing single-photo edits and album ordering are already delivered. |
| Publishing readiness / agent handoff | Demo only. Keep local/saved/live distinctions explicit; publishing remains agent-operated. |
| Private video intake | Demo only; see W07 below. Hosted public video playback already works. |
| Labeled Replay seeking/timeline | Demo only. Shared Replay remains map-only. |

The delight review additionally proposes personal memory entry points, direct
media browsing, in-context day editing, visual authoring and group storytelling.
Its reported caption/empty-day/responsive-control bugs have since been fixed.
Use [the review](docs/DELIGHT_REVIEW_2026-09-12.md) for intent and the current
feature inventory for actual behavior. Choose one concrete scope before
implementation; preservation of the mockup is not blanket feature approval.

## Delivered foundations with remaining work

### W08 — Places and photo conversations

The shared Places UI and local comments/reviews UX, including the 20 September
polish, **are already on main**. Search, filters, credited photos, galleries,
clusters, draft preservation, edit/delete/Undo, names and coordinated Back/Forward
are implemented. The old branch names were merged, not unfinished code.

- [Places demo](https://gravelcycles.github.io/travels/demo.html?journey=alpine-crossing&experience=places)
- [Comments demo](https://gravelcycles.github.io/travels/demo.html?journey=alpine-crossing&experience=comments)
  uses the sample password `demo`; it does not unlock real private photos.
- Preview writes stay in browser storage. Live identities and database writes
  have **not** been implemented. This distinction is confirmed by the final
  **Design places and photo comments** task handoff.

Next implementation: extend the existing photo Worker with signed visitor IDs
distinct from password IDs, D1 schema/migrations, eligible-photo validation,
authenticated reads/writes, pagination/idempotency, limits, own-comment removal,
moderation/export, expiry/revocation/CORS checks and a tested rollout. Keep group
reviews prompt-authored until server-authorized group editing is explicitly
defined. No SSO or Google Maps API. Further image-intake automation is optional;
current credited image sourcing remains agent-operated.

Start from current main. Read [architecture/API/data contracts](docs/PLACES_AND_COMMENTS.md)
and [UX evidence and its limits](docs/PLACES_UX_REVIEW_2026-09-20.md).
No new backend branch or database was created during this cleanup.

### Florence–Genoa trip intake

The six cycling days, **10–15 May 2026**, are live in `edac805` and current main.
The owner explicitly removed the arrival day and train/bus routes. Retain the
nine-person roster, day IDs `florence-genoa-d2` through `-d7`, and cycling-only
presentation numbered 1–6. Do not reintroduce the earlier arrival groups.

All six cycling routes have detailed network reconstructions and provenance;
they are not the original GPS track. Await a working cycle.travel share/GPX,
resolve Mattarana versus Oasi and Thursday's 62 km discrepancy, review campsite
approach pins/final overnights and the Genoa route, then intake actual photos.
The year remains inferred from the original intake.

Read [trip-specific open facts](docs/FLORENCE_GENOA.md) and
[the route workflow](ROUTE_GEOMETRY_WORKFLOW.md). Implementation is merged;
remaining work is content intake and verification, with no pending code branch.

### W07 and W09 — Private video and Live Photos

W07's group rosters, route/media assignment forms, meetup/overnight editing,
hosted public video and mixed gallery playback are delivered. Still needed:
private video/poster derivatives, authenticated byte ranges under the existing
photo policy, timed captions/transcripts and Studio file intake. Per-day group
membership changes remain a future data need. The six originally held MOV files
remain private; the old decision not to publish them is not undone by a demo.

W09's Live Photos investigation (`codex/live-photo-intake`,
`docs/workstreams/live-photo-intake.md`) reported stills with Live Photo metadata but missing companion motion files;
none of the six held MOVs matched. The task awaits an unmodified paired export
from Photos/iCloud. A small LIVE play/return-to-still control was proposed, not
implemented. Verify real pairing before designing the optional shared contract;
reuse W07's private-media pipeline. Cleanup did not rescan or export the library.

### W04–W06 — Framework and authoring infrastructure

These are documented backlog projects, not hidden uncommitted implementations:

| Item | Next bounded change | Required outcome |
| --- | --- | --- |
| W04 — Runtime modules | Extract an existing day/photo selector, transport, map/camera, album or Replay boundary when related work needs it. | One shared behavior, stable URLs/content, behavioral tests; no wholesale rewrite. |
| W05 — Source/output and schema | Move authored JS/CSS out of `dist/` in a dedicated migration; then consolidate schema/defaults and reviewed draft promotion. | Clean builds reproduce public output; Studio imports/tests move together; drafts/private assets remain excluded. |
| W06 — Routing preparation | Guided per-journey extracts/provenance and access/direction-aware local profiles. | Clear readiness, bounded inputs, preserved reviewed geometry and genuine mode-specific routes. |

Read the remaining migration plan in [FRAMEWORK.md](docs/FRAMEWORK.md). All shared
behavior must serve the reference trip, demos and fresh drafts. Hand-authored
assets still live under `dist/assets`; never delete `dist` as disposable output.

### New trip naming — conversation only

**Brainstorm a name for the trip** is exploring a history-themed title for the
Germany → Austria → Czech Republic → Balkans → Poland → Venice → Slovenia →
possibly Greece travels. No final name, dated itinerary, journey JSON, draft or
implementation was found. Keep it as intake context; do not create a trip or
treat suggested names as chosen. This task can continue independently.

## Task context reviewed

Task titles below are the app's actual titles. IDs allow agents to read the
source context without relying on old branch names or mutable sidebar order.

| Task | ID | Context retained |
| --- | --- | --- |
| Improve map photo display | `01a09f08-83f4-75c2-a6f0-ee16bca56935` | Latest bubble behavior and softer regional Replay were local-only refinements. |
| Design places and photo comments | `01a0bb43-66df-7cd1-a544-a9b86f2e575a` | Polished shared UX delivered; backend deliberately deferred. |
| Build Florence cycling trip | `01a0bb44-49b3-7083-b60e-83c5434dbd8c` | Detailed reconstructions; final direction removes arrival travel. |
| Start localhost Studio | `01a0a08a-f2ce-7331-9b02-30184043d94a` | Day taglines italicized and automatic “In one place” removed; deployed. |
| Add Live Photos support | `01a0a0cf-3350-7043-841f-d1769a5ff23f` | Missing paired motion files; no implementation. |
| Extract location from iPhone HEIC | `01a0a02f-d936-7ee2-9e82-a3f4b1be1ca9` | Successful isolated metadata check; no new atlas importer or pending code. |
| Audit site UX and bugs | `01a095b3-a9d7-7993-a1c6-850de3b1debe` | 20 fixes shipped, visitor reload excluded, new features require demos. |
| Improve site delight | `01a095b3-9fea-7673-a1ec-ef87a48460de` | Review and separate interactive design artifact. |
| Brainstorm a name for the trip | `01a11c3e-0902-7081-ab19-5c40b1638a50` | Naming discussion only; no chosen trip identity. |

The project task index was also checked to distinguish earlier merged map,
mobile, auth, routing and deployment work from the active items above. Unrelated
conversations sharing this folder are not project workstreams. No task was
resumed, renamed or archived by this cleanup.

## Local-only material and recovery

These remain on this machine and are not part of a fresh clone:

- `photos/`, `build/private-photo-assets/`, upload derivatives and raw route
  inputs: original/private media and reproducible/local inputs, still ignored.
- `build/studio-drafts/`: six saved session records, all reporting `dirty: false`
  at inspection; revision/backups also remain. These are recovery records,
  not six unfinished journeys. `content/drafts/` is empty and
  `build/studio-draft-overrides.json` has empty photo/route/day maps.
- `build/ux-review/`: original day-review prototype and old generated workspace.
  Use the tracked replacement branch for future edits.
- `build/commit-prep/`, `build/studio-save-investigation-20260914/`, performance,
  photo-fault/reveal and Florence intake/delivery folders: historical QA/backups.
  Their “staged/not pushed” statements describe September, not today's status.
- `build/workstream-cleanup-20261008/`: exact starting patch/hash inventory,
  branch/stash/task inventory and validation logs from this cleanup.
- Original Codex visualization files: left intact; both relevant design HTML
  artifacts are now independently recoverable from their branches.

No private originals, credentials, local draft stores or generated experimental
workspace were added to Git. The following recovery refs preserve tracked Git
states, not those ignored local assets.

| Recovery branch | Tip | What it preserves |
| --- | --- | --- |
| `codex/archive/worktree-20261008` | `fa03375` | Exact original 12-file dirty working tree; source for the family checkpoint. |
| `codex/local-backup-20260915` | `666c82c` | Original accumulated-code/content safety snapshot. |
| `codex/reconciled-local-backup-20260915` | `73a28c5` | Reconciled September snapshot; includes older code plus saved trip edits. |
| `codex/archive/stash-157b7c2` | `157b7c2` | 20 Sep: generated family/Studio output before cycling-only trip integration. |
| `codex/archive/stash-39c5ad8` | `39c5ad8` | 19 Sep: generated output before Florence route delivery. |
| `codex/archive/stash-d31afec` | `d31afec` | 19 Sep: generated output before Florence intake integration. |
| `codex/archive/stash-b569149` | `b569149` | 10 Sep: photo-frame/Studio changes plus route-override edits. |
| `codex/archive/stash-c9fa9a6` | `c9fa9a6` | 10 Sep: photo-frame/Studio changes plus route-readiness/proposal work. |
| `codex/archive/stash-6e39f8d` | `6e39f8d` | 10 Sep: overlapping photo-frame/Studio autostash. |
| `codex/archive/stash-bcec35e` | `bcec35e` | 9 Sep: overlapping photo-frame/Studio autostash. |
| `codex/archive/stash-e2a9835` | `e2a9835` | 9 Sep: photo-frame/Studio autostash and viewer/style changes. |

The eight original `stash@{…}` entries were retained. Use the SHA/branch names
above, because stash numbers can change. Early autostashes contain overlapping
photo-frame/Studio changes and, in some cases, routing edits; later stashes only
preserve generated Studio output. Inspect differences before extracting a file;
do not apply an old stash wholesale. Restore generated bundles by rebuilding
from the selected source state.

## Completed local branch archive

Each tip below was verified to be an ancestor of `272086e` before its local ref
was removed. These are completed/merged branches, not additional pending work.
Their commits remain reachable through main. To recover a historical name, an
agent can run `git branch <name> <recorded-tip>` without changing the checkout.

| Retired local branch | Merged tip |
| --- | --- |
| `codex/button-focus-outlines` | `c07d32328496` |
| `codex/city-label-contrast` | `26bb55c91c3c` |
| `codex/collapsed-map-attribution` | `06c6fcafb55f` |
| `codex/day-scroll-photo-timing` | `e937dade3a4d` |
| `codex/deploy-recovery` | `65e04001dd5b` |
| `codex/desktop-leg-hover` | `5b14d12a98da` |
| `codex/fix-journey-entry-flash` | `523a65830e41` |
| `codex/florence-genoa` | `edac80583050` |
| `codex/full-trip-map-framing` | `626b9e0c3155` |
| `codex/group-routes-video` | `538a8e63761b` |
| `codex/integrated-media-viewer` | `aacb9f91b371` |
| `codex/location-labels` | `249fcac4b4ea` |
| `codex/map-marker-spacing` | `121dc4645910` |
| `codex/mobile-cleanup` | `06c6fcafb55f` |
| `codex/mobile-photo-gestures` | `908b85adc0d3` |
| `codex/mobile-ux` | `ebc974011918` |
| `codex/mobile-viewer-fix` | `80d3d01711d6` |
| `codex/photo-loading-recovery` | `5ee19a68da7e` |
| `codex/photo-map-frames` | `edac80583050` |
| `codex/photo-viewer-outlines` | `80d3d01711d6` |
| `codex/places-comments-demo` | `edac80583050` |
| `codex/places-ux-polish` | `272086e344ea` |
| `codex/prepare-local-changes` | `94f5f2772632` |
| `codex/publish-bike-point-edits` | `fb50e8773c88` |
| `codex/quiet-photo-auth` | `d309985f2244` |
| `codex/rail-stop-rim` | `1ce1007341f6` |
| `codex/route-proposal-cleanup` | `4e05d9ee6f82` |
| `codex/shared-trip-framework` | `e84e2b7fca50` |
| `codex/studio-day-copy-save-fix` | `7e26085b6a03` |
| `codex/studio-groups-and-videos` | `9896375fc54f` |
| `codex/studio-save-recovery` | `94f5f2772632` |
| `codex/ux-audit-fixes` | `f6790e411f76` |

## Resume and delivery checklist

1. Read this snapshot, the selected branch's handoff, current framework and
   relevant workflow. Inspect `git status` before any checkout or merge.
2. Fetch origin and integrate current main into the selected workstream.
   Checkpoint branches share the baseline but are not an implicit integration
   stack. Resolve generated-output conflicts by rebuilding, not selecting a
   stale bundle. Do not merge recovery snapshots.
3. Keep prototypes out of Pages until their selected behavior is implemented
   and reviewed in shared code. Keep unfinished family content out of main
   until its review points and pending media are resolved.
4. Run appropriate targeted checks, `npm test`, `npm run build`, and
   `git diff --check`; include generated public output. The existing suite
   includes reference/demo/fresh-draft contracts. Local server tests need
   localhost access in sandboxed environments.
5. Before deployment, fetch/integrate latest remote main, push without force,
   verify the successful Pages run and a fresh public page. Update this file's
   status/tip/evidence when a workstream advances or completes.

Cleanup validation: main **361/361**, family checkpoint **361/361**, prototype
**10/10**; both standalone demo scripts parse. Main builds without any `dist/`
changes. Exact original-file hashes, all five checkpoint content sources, eight
stash refs, all 32 merged tips, commit references and local doc links were checked.
The documentation release's Pages verification accompanies the cleanup delivery.
No new prototype behavior or unpublished family edits are deployed by this
documentation release.
