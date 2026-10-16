# Post-AVIF loading and mobile swipe measurements — 16 October 2026

This follow-up is separate from the [first performance release](PERFORMANCE_PASS_2026-10-16.md)
(`6fefc36`). Baseline source is `504bd26627c14c4ae86597cd140a852eb3dd566d`,
whose deployed application is `62d8c69531289cd34c8a3b248d35401794babdc7`
([Pages run](https://github.com/gravelcycles/travels/actions/runs/38946882288)).
The owner requires numeric before/after evaluation and later clarified that
full-screen swiping on mobile Chrome still feels laggy, likely from rendering.
Publication and combined verification status are tracked in WIP.

## Resolution and loading comparison

Independently verified 891 unique derivative files by hash and header. All 223
published protected photos retain their exact WebP paths, variants and dimensions.
Full WebP totals **225,321,190 B**; native-resolution AVIF totals **234,970,250 B**:
**+4.28% bytes for +57.60% pixels**. AVIF is smaller in 82 pairs, larger in 141.
Only three pairs keep identical dimensions; their aggregate 26.42% saving is
not representative of the collection. Thumbnails/previews remain WebP. No media
was re-encoded, replaced or removed by this performance follow-up.

The actual desktop Chromium 155 browser tested six existing matched photo IDs,
including two RAW-derived pairs, at fixed 390×844 and 1360×900 contained frames.
All six WebPs are 7.68 MP and AVIFs 12.19 MP: same rendered size does not mean
same downloaded resolution. Fresh-Blob decode used nine alternating repetitions
per format and excluded fetching. At the actual 390×844/DPR 1 viewport, medians
were **49.0–159.7 ms WebP** and **67.9–184.4 ms AVIF**; same-Blob/image reuse was
approximately **0–0.1 ms** for both. These are Image.decode completion wall times,
not isolated CPU, raster/paint or physical-phone measurements. A separate native
Sharp/libvips RGBA probe was considerably slower and is not a browser proxy.

Controlled loopback HTTP used actual files, 1.6 Mbps pacing and an 80 ms header
delay, one repetition per pair/format/state at each frame size. Server logs
verified 12 full 200 bodies and 12 conditional 304 responses with zero body
bytes per run. All 12 same-page Blob reuse checks made zero image requests.
For the phone-frame run, full-response totals ranged **2.053–9.719 s WebP** and
**2.534–10.432 s AVIF**, with 304 validation **84.3–91.8 ms**. This models bytes
and revalidation, not mobile radio, TLS, Cloudflare or authorization latency.

Read-only live checks using the existing authorized session selected native AVIF.
One matched Prague photo showed first-observed headers/body/readiness of
**1,538/5,287/4 ms**, then **603/4/2 ms** after reload with HIT/revalidated
diagnostics. Same-page revisit retained the same Blob with instant reveal and
0 ms readiness. Berlin's preloaded next photo was also instant when selected.
Historical download fields remain on cache entries and are not revisit latency.
These observations were not interleaved with pre-migration results; no causal
AVIF speedup follows from them. Missing Timing-Allow-Origin also prevents using
zero cross-origin ResourceTiming sizes as proof of cache hits.

## Bounded immediate-neighbor scheduling

After the selected image is ready, one explicitly marked nearest full neighbor
may share the fourth request slot with up to three visible thumbnails. Farther
warming remains idle-only. Selected-photo work preempts an unrelated neighbor,
or reuses that same in-flight request. Hidden/data-saving/2G, auth, cancellation,
decode, full-WebP fallback and bounded-cache behavior remain guarded.

The before/after model executes the real production loader with a deterministic
streaming transport: 1.6 Mbps shared equally, 80 ms RTT, 20 ms ticks, instantaneous
decode. Inputs are verified population medians: 992,103 B AVIF, 973,974 B full
WebP and 46,100 B thumbnail. Results are bytes-ready times, not browser latency.

| Workload | Neighbor ready before → after | Last thumbnail before → after |
| --- | ---: | ---: |
| Cached selected, 6 thumbnails | 6.56 → 6.44 s | 1.52 → 2.00 s |
| Cached selected, 24 thumbnails | 11.12 → 10.68 s | 6.08 → 8.00 s |
| Cached selected, 60 thumbnails | 20.24 → 17.02 s | 15.20 → 19.28 s |
| Cold selected, 60 thumbnails | 24.32 → 24.14 s | 19.28 → 19.98 s |
| Six bursts of three thumbnails | 14.00 → 9.26 s | 8.96 → 9.20 s |
| 24 thumbnails, 20 Mbps/30 ms | 1.06 → 0.90 s | 0.64 → 0.80 s |
| 24 thumbnails, neighbor capped at 20 KB/s | 55.76 → 49.68 s | 6.08 → 8.00 s |

Recurring bursts previously caused seven neighbor attempts and discarded
784,000 B; the candidate uses one attempt and discards 0 B. Cold selected-photo
start remains 0 ms, readiness with 60 thumbnails remains 17.02 s, and the total
request cap remains four. The bandwidth cost to thumbnails is explicit. Holding
new thumbnails until the neighbor completes was rejected because a slow neighbor
could delay them for 55 s; 1/2-second head-start timers added cost and complexity.

All 87 focused loader/plan tests pass and independent review found no actionable
correctness issue. The model does not implement transport priority; a promoted
in-flight request retains its original low browser fetch hint. It proves bounded
admission and cancellation behavior, not a guaranteed real bandwidth share.

## Cached mobile rendering

The real-app local fixture uses production code, verified native AVIF derivatives,
a blank map and a 390×844/DPR 1 desktop Chromium viewport. Preloads are frozen
after warmup and decoded images retained, isolating cached gesture/render work.
An 80 ms interruption of the 220 ms settling animation reproduced a **52.24–53.18 px
jump to zero** at pointer-down across eight repetitions, with **zero photo
requests and decode calls**. Capturing the visible translation before canceling
the transition reduces that immediate jump to **0 px in all eight matched
repetitions**, without changing the 220 ms duration. The next drag starts from
that position; cancellation settles it, and pinch takes over its visible offset.
The independent fitted-reset fast path skips pan-bound calculations whose
result is always zero at scale 1. Eight ordinary swipes each made **34 geometry
reads before, 34 with the interruption fix alone, and 18 with the fitted-reset
change** (47.1% fewer). Zero photo requests/decodes were recorded throughout.
Median pointer-up handler time was 6.25 → 6.10 → 5.85 ms across those variants;
these small, separately timed differences do not establish a material latency
gain. Two baseline long-frame outliers remain
unexplained; geometry reads are not layout counts and main-thread handler time
does not isolate GPU/raster work. Removing the proven position jump does not
establish an overall FPS improvement or explain every long-frame outlier.

Physical mobile Chrome, including device/OS-specific GPU and memory pressure,
and physical iPhone/Safari are not certified by desktop viewport tests.

The initial complete **836-test suite passed** after updating older test DOM fixtures
to implement the browser's classList.contains behavior. The final build is
reproducible across 71 public files. Focused review covers current-photo
preemption/fallback and mobile interruption, pinch, cancellation and zoom reset.

## Concurrent release integration

Before publication, integrated `75f4e04` (Pages run 38955013712): explicit signed
thumbnail sharing plus 19 saved Heading East exclusions and two traveler notes.
The merged loader preserves the scheduler byte-for-byte and adds the incoming
sharing function/export; sharing is still invoked only by the explicit action.
The comment and thumbnail-share indexes match incoming main exactly. The final
**848 tests pass**, including the new sharing tests, and **78 public files** are
identical across two builds.

The migration measurement above remains the historical 223-photo corpus at
`62d8c69`. Current membership is 204 (103 family, 101 Heading East); all surviving
WebP/AVIF descriptors match those measured files. That subset is 206,085,132 B
WebP → 215,115,067 B AVIF (+4.38%) for +57.78% pixels. These membership changes
come from the concurrent saved selections, not this performance patch.

All four portrait fixture models pass 14/14 affected-flow checks. The landscape
fresh draft passes 13/14 identically before/after: selecting a partially clipped
first thumbnail scrolls 20→8 px before saving the presenting grid, so Back returns
to 8 px. Grid dimensions are unchanged. This pre-existing active-thumbnail reveal
is recorded separately in TODO; it is not caused by the swipe correction.
