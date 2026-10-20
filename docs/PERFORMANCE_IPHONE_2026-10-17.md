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

## Default mobile renderer

The owner explicitly requested default rollout on 17 October after the positive
iPhone comparison and the immediate-swipe correction. Supported mobile viewers
now use `photo-swipe-raster.js` through the shared template without a query
parameter. Former `?swipeRenderer=prepared` comparison URLs continue to work;
the obsolete parameter is ignored, with no renderer preference/flag system.
Desktop startup creates no mobile canvases/workers. The controller initializes
the three slots once at phone width, including a desktop-to-phone resize of an
open viewer. Unsupported APIs and preparation failures retain native display.

A single worker serially decodes the already authorized full-photo Blob,
fits it at physical-pixel resolution, and transfers the bitmap
to one of three canvases that follow the same image elements through rotation.
Pending work coalesces per slot. Full sources, network priorities and the
three-image lifecycle stay owned by the normal loader. Original images remain
attached and become visible for zoom; cold entry keeps its normal reveal.
Public sample sources are restricted to the same origin. Protected preparation
requires the current authorized full-image binding; the worker gets its existing
Blob, never a token, new lease or private network fetch.

Since the 20 October follow-up each surface stores only the fitted photograph's
physical pixels; CSS centers it within the original frame. The viewport ×
devicePixelRatio guard remains capped at four million pixels;
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

The owner then confirms that only an immediate first swipe jumps; waiting about
three seconds avoids it. Explicit constraint: do not slow the initial-photo
display pathway. No preparation gate or extra opening delay is acceptable.

### Immediate-swipe startup correction

The first candidate had two observable gaps: a loaded neighbor still painted
its native full source until worker completion, and a late first selected
surface could replace native pixels during the initial drag. Waiting naturally
hides both gaps. This identifies application paths consistent with the report;
the exact physical-iPhone contribution of each still needs owner confirmation.

A loaded neighbor now retains its embedded lightweight
preview on the same canvas while its full display surface is pending. Preview
fit uses the full photo's aspect ratio and inherits the exact transform; full
bitmap completion clears only the preview, retaining geometry and original
source. A promoted pending neighbor keeps that preview until ready. Missing
previews and worker/decode/transfer failures retain native fallback. Lock, source
changes and close clear background pixels as well as bitmap storage.

The first selected photo remains native through its normal opening reveal;
its duplicate worker preparation waits until reveal completion or direct
manipulation. Adjacent slots precede the selected slot in batch preparation.
This never waits on a worker before showing the first photo. A first selected
surface cannot replace native pixels mid-swipe; it becomes eligible after
settling. Already presented surfaces keep the successful steady swipe behavior.
Completed reveal state survives canvas resize; reduced motion does not wait for
an animationend event. Full images remain attached for zoom.

Four startup regressions fail against the published first candidate and pass
with the correction: pending neighbor presentation, immediate native handoff,
placeholder failure cleanup and reduced-motion entry. A fifth worker-start/
message failure check prevents a permanent preview when preparation is blocked.
A three-second preparation deadline restores native display and terminates a
stalled worker for the current view, without an automatic retry loop. This is
a fallback deadline for pending surfaces, never a hold on first-photo display.
The existing reveal test now also verifies zero worker work for the first
selected photo during opening and preserved reveal completion across resize.

A matched loopback fixture uses the actual first Heading East photo (including
saved album order), local full derivatives, 390×844 viewport/DPR1, normal loader
and a controlled delay of worker results. With results delayed 1,500 ms, the
original first photo enters its normal reveal while zero surfaces are ready;
the pending-neighbor full-image exposure changes from present to absent. The
new path passes all five startup checks, retaining the incoming full source,
node, transform and fitted bounds through preparation completion. A 50 ms delay
also checks completion during the immediate drag (before 3/5 checks, after 5/5;
at 1,500 ms, before 4/5 and after 5/5). Individual open-to-ready
samples are browser measurements with normal variation, not a phone latency
claim or a statistical speed comparison. WIP records the final checks/release.

The owner's later explicit request promotes this corrected renderer to the
mobile default. The previously confirmed steady browsing benefit and immediate
first-photo pathway must be preserved. The rollout request does not add a new
physical-device trace: immediate first-swipe smoothness after the startup fix
and numeric after-change paint durations remain unverified.

The engineering principle is to keep expensive preparation outside direct
manipulation, retain a bounded working set and animate transforms. See the
[animation performance guide](https://web.dev/articles/animations-guide) and
[worker/OffscreenCanvas guidance](https://web.dev/articles/offscreen-canvas).
The specific worker/canvas path is justified here by the measured paint stalls
and owner comparison; its memory, lifecycle and fallback costs remain part of
the acceptance check, rather than a universal requirement for every gallery.

## Remaining lag — 20 October 2026

The owner still notices lag versus the native photo library, including movement
under the finger, release, rapid browsing and pinch/zoom. This is new qualitative
evidence that the default rollout did not completely resolve the issue. There
is no new physical-device timing trace. Do not reuse the pre-renderer trace to
claim the remaining stalls have the same cause.

Three bounded changes reduce avoidable work:

- Allocate the fitted photo's physical pixels rather than transparent viewport
  letterboxing. CSS retains exactly the same fitted bounds and center. Full
  native sources remain attached for zoom; there is no lower-resolution fetch
  or derivative change.
- Hold completed bitmaps until horizontal dragging and settling end, avoiding
  canvas resize/adoption during motion. Existing pixels or embedded previews
  remain. Each slot owns at most one displayed or unpresented surface; lock,
  source replacement, resize, grid and close release unpresented bitmaps too.
- Coalesce pinch and zoomed pan to one render per animation frame. Pointer
  callbacks record current positions; release flushes the last sample before
  removing a finger. Reset cancels queued work. Reuse geometry reads inside a
  zoom update and avoid redundant `data-zoomed` writes.

Matched loopback comparison: deployed `48f73fe` runtime versus these changes,
Heading East Berlin photo `img-3456`, identical local full derivatives and
normal loaders, 390×844/DPR1, no CPU/network throttle, no-store fixture responses.
Worker results are deliberately delayed 400 ms to exercise arrival during a
75-frame horizontal drag. Pinch then sends 144 samples in 12 frame batches;
zoomed pan sends 144 samples in 12 batches (its direction threshold excludes
the initial samples). This stresses coalescing; it is not an iPhone event-rate
measurement. Both runs report no script errors.

| Deterministic browser work | Before | After |
| --- | ---: | ---: |
| Total retained bitmap pixels, three portrait photos | 987,480 | 609,960 |
| Bitmap adoptions during the controlled drag | 3 | 0 |
| Pinch transform updates | 144 | 12 |
| Zoomed-pan transform updates | 109 | 10 |
| Final pinch transform | translate(3.6, 25.2), scale(1.72) | identical |
| Final pan transform | translate(39.6, 25.2), scale(1.72) | identical |

This is 38.2% less pixel storage for this fixture, excluding native decodes,
browser/GPU copies and worker source decoding. It is not a measured FPS or
touch-to-display improvement. Landscape savings vary with aspect ratio. At
DPR3 the unit fixture preserves at least every physical fitted pixel for both
orientations without allocating empty viewport pixels. First native display
remains independent of worker readiness; individual open-to-ready samples vary
and are not a statistical latency comparison.

All six new regressions fail against the previous runtime and pass after the
changes. Existing focal/gesture tests now observe the animation-frame boundary.
WIP records full-suite, shared-flow, startup and publication verification.

Native and web share the display's refresh ceiling, but reaching it consistently
depends on input scheduling, image preparation and rendering work. At 60 Hz a
frame spans about 16.7 ms; this is not an acceptable continuous-gesture latency
target by itself. Google's [rendering guide](https://web.dev/articles/rendering-performance)
explains the frame budget and compositor path. Apple's
[image preparation guidance](https://developer.apple.com/documentation/uikit/uiimage/preparingfordisplay())
also addresses decode-induced hitches, with serial preparation away from the
main thread. Chrome's [current iOS web layer](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/ios/web/README.md)
uses WebKit/WKWebView rather than desktop Chrome's Blink. These sources do not
establish a universal native-versus-web percentage or certify native Photos
parity for this viewer. A fresh phone comparison/trace remains the next evidence
needed if lag persists after this release.
