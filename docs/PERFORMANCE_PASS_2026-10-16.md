# Travels measured performance pass · 16 October 2026

Implemented the interaction and loading priorities against frozen source `9dc7827`.
The concurrent AVIF migration is evaluated separately. Release and validation status
are recorded in WIP; this document reports controlled measurements, not a universal
page-load or physical-iPhone speed claim.

## Before / after for each fix

| Fix and matched action | Before | After |
| --- | ---: | ---: |
| Phone Location warm open: layout count | 16 | 3 |
| Phone Location warm close: layout count | 15 | 4 |
| Same-photo location reopen: map calls | 2 | 0 |
| Location drag: style updates for 20 pointer moves within one frame | 18 | 1 |
| Draft persistence: 3 photo changes with Comments never opened | 3 storage writes | 0 |
| Draft adapter: 3 missing-draft deletes / 3 unchanged saves | 3 writes each | 0 each |
| Comments first open, 50 rows: row constructions | 150 | 50 |
| Comments cached reopen, 50 rows: row constructions | 150 | 0 |
| One changed comment: row constructions | 100 | 1 |
| Phone Comments warm-open handler (4× CPU), median | 42.00 ms | 27.90 ms |
| Desktop Comments warm-open handler, median | 8.15 ms | 4.45 ms |
| Cached media ordering/lookups, Heading East benchmark action | 0.727 ms | 0.163 ms |
| Filmstrip reuse, same action after ordering cache | 0.163 ms | 0.024 ms |
| Filmstrip metadata serialized per repeated benchmark action | 51,820 B | 0 B |
| Journey scripts/styles without an exact content hash | 5 | 0 |
| Catalog cover files, matched desktop 1× / phone 2× crops | 899,586 B | 123,960 B |

Warm Location open layout time fell from **6.62 to 1.45 ms**;
close from **7.79 to 1.81 ms**.
Total main-thread task time in the 500 ms observation windows was
**229.13 → 51.46 ms** for open and
**91.76 → 57.96 ms** for close.
Style-recalculation time was **14.72 → 25.18 ms** open and
**12.75 → 25.79 ms** close; not every submetric improves.
Median maximum warm frame gap was **16.8 → 16.8 ms** on open.
The reviewed 220 ms sheet motion and 350 ms full-photo reveal remain unchanged;
these results do not establish an FPS increase. First-open maximum frame gap was
83.3 → 83.4 ms, so cold WebGL setup did not improve in this comparison.

Phone Comments click-to-next-animation-frame callback was
**43.60 → 29.55 ms**.
This is a callback measurement, not proof of painted pixels. Layout count stayed
at 3 per opening. All 50 rows and draft text survived; node retention changed
from 0/50 to 50/50, and unchanged draft writes from 1 to 0 in the browser fixture.

## Page payloads

Same content, exact local bytes compressed with gzip level 9. Data-only columns
isolate bundle splitting; total script/style bytes include the runtime changes.

| Page | Data before | Data after | Reduction | All initial JS/CSS before → after |
| --- | ---: | ---: | ---: | ---: |
| index.html | 250,805 B | 2,176 B | 99.1% | 283,201 → 35,233 B |
| switzerland-italy.html | 542,573 B | 72,136 B | 86.7% | 1,006,402 → 539,152 B |
| backpacking-europe-heading-east.html | 542,573 B | 441,121 B | 18.7% | 1,006,402 → 908,137 B |
| florence-genoa.html | 542,573 B | 22,724 B | 95.8% | 1,006,402 → 489,740 B |
| demo.html | 542,573 B | 8,337 B | 98.5% | 1,006,402 → 475,353 B |

Journey script/style requests fall from 41 to 38; catalog from 9 to 7.
The family data reduction alone saves 470,437 compressed bytes: about 2.35 seconds
of transfer capacity at 1.6 Mbps, excluding latency, contention and execution.
That is bandwidth arithmetic, not a measured page-load improvement.
Heading East retains its own large route geometry and sees a smaller reduction.

Catalog sizing uses the actual crop box, image aspect ratio and DPR. The two
matched covers select 480 px instead of 1280 px in fixed fixture crop boxes:
desktop 176×104 at DPR 1 and phone 112×168 at DPR 2,
reducing existing WebP file bytes by 86.2%. At phone 3× the landscape cover keeps
1280 px when its crop requires 672 px. These are local file sizes, not observed
network bytes or AVIF savings. Fullscreen still requests the full derivative.

Exact hashes now cover the three previously constant-version notification assets
and the two already version-pinned MapLibre files. Missing template assets fail
the build. This is cache correctness; no independent latency percentage is claimed.

## Method and behavior checks

- Location: sequential matched before/after local Chrome production demo, 390×844
  at 4× CPU slowdown; six open/close pairs, first pair excluded from warm medians.
  Also 844×390 landscape and 1360×900 desktop control. Same local decoded WebP and
  blank map; external networking blocked. CDP counters and animation-frame samples
  measure rendering work without private-image or tile-network noise.
- Comments: same production demo, 50 synthetic already-read comments and a local
  retained draft, six warm opens after warmup; phone 4× CPU and desktop 1×.
  No live comments were posted. Zero page exceptions; layout, script/task counters,
  node identity and draft recovery were checked.
- Comment counters also use the real production controller/store in a deterministic
  fixture. Failed saves/clears retry; row changes/reordering/deletion, ownership,
  editors, lock cleanup, loading/retry and visibility-based read tracking are tested.
- Media: fixed pre-change content, production functions in Node VM, 20 warmups then
  11 batches of 100 ordering/lookup/filmstrip operations. Ordering-only stage keeps
  the original filmstrip. Synthetic DOM counters and CPU timings exclude layout,
  image download/decode and paint; they are not full photo-switch latency.
- Shared tests cover the family reference, demo and an independently populated fresh
  draft, group/planning projections, videos, source-grid retention and collection
  order. New media records and replaced arrays invalidate caches; old-helper
  compatibility keeps cached-HTML deployment transitions usable.
- The location timing pair precedes integration of the concurrent zoom-chrome fix
  and a narrow release-before-queued-frame guard. Those paths are covered by
  regressions and the final browser smoke; the warm-click timing path is unchanged.
- Location checks include rapid reversals, canceled header drags, same-photo manual
  camera retention, interrupted automatic camera movement, grid/close/resize cleanup
  and reduced motion. Layers are promoted only while moving.
- Scoped bundles preserve whole image records, including future format/fallback
  fields. Legacy data and old/new publication-snapshot verification remain available
  for Studio and administrative workflows without loading all trips for visitors.

## Desktop integration correction

The combined browser pass also reproduced a preexisting desktop reset defect in
`9dc7827`: a settled 2.5× photo stayed at 2.5× after Close and same-photo reopen.
The controller now records its transform after browser CSSOM normalization, so
it can safely release its own transform without erasing a mobile takeover.
The corrected browser sequence is **2.5× → Close → 1× fitted reopen**, with a
regression that fails on the original code. This is a correctness fix, not a
measured animation-speed improvement.

## Remaining AVIF comparison

The AVIF rollout was still uploading/verifying assets during this pass; its
compatible service update was live. The existing follow-up will compare the same
photo IDs and final dimensions after deployment, with cold, HTTP-revalidated and
same-page reuse states. It will measure actual bytes, queue/header/body/decode,
fallback and immediate-neighbor readiness before deciding whether thumbnail
starvation warrants the authorized bounded preload-scheduling change. No image
conversion, original asset, private authorization or preload policy was changed
by this batch. Other profile-first ideas (large blur layers, hidden map redraws)
remain unclaimed. Physical iPhone/Safari performance is not certified by Chrome
viewport emulation. The pre-existing long-notes/short-landscape map-height issue
remains tracked separately in TODO.

## Validation and release

Merged [PR #1](https://github.com/gravelcycles/travels/pull/1) as `6fefc36` and deployed successfully through [Pages run 38945230961](https://github.com/gravelcycles/travels/actions/runs/38945230961). All 781 tests pass; the production build reproduces checked-in output. Five fresh public HTML pages and 43 unique script/style assets match the tested release byte-for-byte, including their content hashes.

Fresh live browser checks at phone 390×844, landscape 844×390 and desktop 1360×900 verified demo Location and Comments flows, navigation and fitted desktop reopen after 2.5× zoom. Heading East additionally verified existing signed-in full-size photo access, live empty-thread loading, mobile Location, next-photo navigation and grid selection retention. No console errors were captured and no live comments were posted. The 50-row reuse figures remain controlled local-fixture results. The known long-notes/short-landscape map-height issue remains tracked separately. Canonical owner, framework, photo and conversation guidance was updated with the implementation. AVIF comparison remains an active follow-up.
