# Physical iPhone loaded-photo stalls — 17 October 2026

## Evidence

The owner reports the same sharp-next-photo jump after `4c37c55`, in Safari,
Brave and Chrome on an iPhone 12 Pro. Rightward swipes are more conspicuous;
both directions lag. The later observation is that returning within roughly
two recent photos is smoother than moving beyond them. The issue remains open.

Two owner-supplied Web Inspector recordings locate the expensive work in image
painting as the incoming image first crosses the viewport edge, before release.
The second recording excludes screenshots, so screenshot capture cannot explain
its long paint spans. Its frozen local source SHA-256 is
`6bd816c0fd21b652a408e487b23baf1cf39c78796263d5cdc3b68049c169dad3`.
Raw recordings, request headers and private photographs stay outside Git.

| Observation | First recording | Without screenshots |
| --- | ---: | ---: |
| Duration | 23.174 s | 18.799 s |
| Composite screenshots | 176 | 0 |
| Released swipes | 13 | 12 |
| Swipes with a paint longer than 50 ms during drag | 10 | 8 |
| Largest observed image paint | 174.7 ms | 191.8 ms |
| Largest pointermove callback | 0.32 ms | 0.69 ms |
| Largest pointerup callback | 18.1 ms | 21.3 ms |

In the screenshot-free trace, several long paints start with an incoming image
at x=384–389 on a 390 CSS-pixel viewport; a reverse example occupies x=-389…1.
The painted quad height is 666 CSS pixels. The request User-Agent identifies
iOS 18.7.3 and Chrome 155.0.8059.37. The export cannot distinguish native decode,
resampling, texture transfer or compositing within those image paint spans.
Do not add overlapping paint/composite intervals or infer FPS from rendering
frame spans. Photo numbers and paint-free swipe directions are not recoverable
from the second export; the earlier screenshot sequence must not label it.

The three mounted full-image elements retain current/previous/next sources.
The encoded byte cache is larger. A photo leaving those three actual elements
can require new native display work when rebound even if its bytes are cached.
That lifecycle is consistent with the owner's recent-photo observation; the
recording does not establish the browser's internal surface eviction policy.

## Controlled candidate

`?swipeRenderer=prepared` temporarily opts into `photo-swipe-raster.js` through
the shared template. Ordinary links retain the image renderer and allocate no
worker/canvas. This is one incident-specific comparison, not a new product
preference or general feature-flag system. Remove or graduate it after the
physical-device result, rather than accumulating renderer choices.

A single worker serially decodes the already authorized full-photo Blob,
contains it within a physical-pixel viewport surface, and transfers the bitmap
to one of three canvases that follow the same image elements through rotation.
Pending work coalesces per slot. Full sources, network priorities and the
three-image lifecycle stay owned by the normal loader. Original images remain
attached and become visible for zoom; cold entry keeps its normal reveal.
Public sample sources are restricted to the same origin. Protected preparation
requires the current authorized full-image binding; the worker gets its existing
Blob, never a token, new lease or private network fetch.

Each surface is viewport size × devicePixelRatio, capped at four million pixels;
larger viewports retain native images instead of reducing physical display
detail. Three RGBA surfaces use at most 48 MB of pixel storage, **excluding**
browser/GPU copies, the native image elements and one full worker decode. This
is not a process memory bound. Failure/unsupported APIs retain the original;
replaced jobs reject/close stale bitmaps. Lock, close, grid and resize release
prepared pixels and terminate outstanding work. Location resize re-prepares
at its actual fitted size. No private derivative or public photo copy is added.

## Acceptance and limits

Unit coverage checks normal-route exclusion, physical dimensions, three-surface
bounds, authorized Blob reuse, source changes, lock/expiry, stale results,
orientation, oversized surfaces, reveal preservation, contain fitting and error
fallback. Shared template inheritance covers reference, demo and populated
fresh draft. Browser checks cover rotation, native zoom, Location, grid/history,
Comments and same-event camera return. Results and release receipt live in WIP.

The later 17 October owner retest confirms a substantial perceived improvement:
“much better,” with good browsing apart from a jump on the first swipe of the
first photo. This is physical-device feedback, not a numeric frame-time result;
the original 191.8 ms measurements describe the previous image renderer.

First-entry continuity is still unresolved. Distinguish a swipe immediately
after opening from one after waiting for preparation. Inspect first selected/
neighbor surface readiness and the native opening-reveal-to-canvas handoff.
The current serial preparation visits the selected slot before its neighbors;
selected canvas visibility also waits for instant reveal or animation completion.
Those are code observations and hypotheses to test, not proof of the remaining
phone cause. Keep the successful steady browsing and native full-image zoom.
A short candidate trace can quantify remaining paints before promotion to the
default; another broad recording is not needed to restate the known bottleneck.

The engineering principle is to keep expensive preparation outside direct
manipulation, retain a bounded working set and animate transforms. See the
[animation performance guide](https://web.dev/articles/animations-guide) and
[worker/OffscreenCanvas guidance](https://web.dev/articles/offscreen-canvas).
The specific worker/canvas path is justified here by the measured paint stalls
and owner comparison; its memory, lifecycle and fallback costs remain part of
the acceptance check, rather than a universal requirement for every gallery.
