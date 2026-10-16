# First fullscreen swipe readiness — 16 October 2026

## Later correction: already loaded next photograph

The owner clarified that the jump occurs with an already loaded, immediately
sharp next photo, and may require a physical iPhone. Inspection found a separate
presentation error after `eefc647`: `preparePhoto` assigns `modal-photo` while
the ready neighbor has no instant-reveal marker. `updateViewer` then calls
`sizeViewerBackdrop`, flushing styles before `setImage` installs that marker.
This starts `photo-resolve` and immediately cancels it on sharp existing pixels.
The node also switches absolute → relative positioning and reverses that change
when demoted. Both are unnecessary rendering changes at swipe release.

Set the instant marker before the ID and retain absolute positioning for the
mobile selected image. A regression intercepts the role assignment itself; it
fails on the previous implementation and passes on the correction. The same
image/source, three-node limit, private loader, full derivatives and normal cold
reveal remain in use.

Matched loopback Chromium checks at 390×844/DPR 2 use normal production preloads,
local verified full derivatives, no CPU/network throttling, an already ready
neighbor and a 1,000 ms initial wait. Four handoffs cover two first promotions
and two returns. At the existing backdrop layout read, unintended running
`photo-resolve` animations fall **2 → 0**; role changes between absolute/relative
positioning fall **4 → 0**. Incoming elements and sources remain unchanged in
**4/4** handoffs on both sides. The initial pilot's incoming-identity selector
matched the wrong neighbor; those identity results are excluded and the matched
comparison uses signed computed translation instead. No frame-rate improvement
is claimed from this instrumentation, whose per-frame snapshots force layout.

The shared reference and sample each pass 16/16 affected browser-flow checks;
the newly rendered, independently populated draft passes 15/15, all at 390×844.
These cover swipes/reversal, pinch/reset, Location, read-only Comments where
available, grid/Back, event boundaries, map resumption and camera preservation.
All 870 automated tests pass. Physical-iPhone presentation remains unverified;
this removes a demonstrated transient animation/layout change, rather than
establishing that every previously recorded native-render stall is resolved.

## Earlier readiness investigation

The owner still observed a first-swipe pause and laggy movement after `a940395`.
This follow-up starts at `f3dd926857cea0db35174efe1246d420a0007958`, the documentation
receipt for that release. The earlier [runtime pass](PERFORMANCE_PASS_2026-10-16.md)
and [AVIF/scheduler/interruption measurements](PERFORMANCE_FOLLOWUP_2026-10-16.md)
remain separate. No media, photo membership, idle reveal duration, network policy
or Worker deployment changes are included here. An intentional photo gesture
now finishes the current opening reveal as described below.

## Prepared image continuity

The previous carousel replaced the selected image's source when a swipe ended,
then rebound the incoming neighbor that had just been displayed. The new path
promotes that actual ready neighbor element, retains the old selected element
for reversal and recycles only the far slot. All three stay mounted. If the
neighbor is unavailable, the existing full-photo loader handles selection.
Authorization, full-WebP fallback, cached-only/foreground priority, retry, zoom
and Comments ownership move with the roles.

Three fresh trials per variant each navigate forward, return, then forward
again: nine handoffs on the same two Berlin photographs. Both are native
3024×4032 AVIF at a 390×844/DPR 1 desktop Chromium viewport.

| Operation across nine handoffs | Baseline | Prepared-element rotation |
| --- | ---: | ---: |
| Preserve incoming element | 0/9 | 9/9 |
| Preserve outgoing element/source for reversal | 0/9 | 9/9 |
| Incoming source assignments | 18 | 0 |
| Outgoing source assignments | 9 | 0 |
| Total synchronous source assignments | 45 | 18 |
| Mounted carousel image elements | 3 | 3 |

This is a 60% reduction in handoff source assignments, with no reassignment of
the incoming image. A deterministic production-loader fixture separately makes
three selected/neighbor role round trips: source assignments 3→0, explicit
decode calls 0→0 and HTTP requests 0→0. Lock/unlock restores the selected role;
rejected AVIF restores the full WebP. The old loader's failure under this new
role-changing lifecycle was corrected before delivery; it is not claimed as an
existing unlock defect in the previously released viewer.

## First entry and natural repeats

The loopback fixture uses verified local derivatives, normal production preloads
and source bindings, a blank local map style and no external subresources. There
is no hidden image buffer, frozen preload plan or forced manual decode warmup.
It opens Berlin after the native AVIF capability probe, then starts at current
photo readiness. A three-second arm lets browser inspection finish before the
trial; there are no browser tool calls during measurement. Earlier unarmed
pilots and one run overlapping the test suite are excluded from timing.

| Largest frame gap per trial, median [range], ms | Baseline | Rotation only | Rotation + async hint |
| --- | ---: | ---: | ---: |
| First swipe, n=3 | 233.3 [183.3–267.5] | 167.4 [117.3–200.0] | 200.1 [200.0–283.2] |
| Natural return/repeat, n=6 | 17.7 [17.6–117.7] | 17.7 [17.6–100.0] | 25.25 [17.7–83.4] |

These are medians of each trial's largest fully-contained requestAnimationFrame
gap, not FPS or frame-time distributions. The small samples and unexplained
native-render gaps do not establish a general smoothness gain. The explicit
`decoding="async"` experiment showed no consistent benefit and was removed.

## Covered map decorations

The first-swipe traces also expose one label layout and one photo-bubble layout
behind the fullscreen viewer. In the rotation-only trials, label callbacks cost
15.9–55.2 ms and bubbles 2.3–6.9 ms; 35–42 main-map render events occur. Natural
return/repeat phases contain none of this map work.

The bounded correction suspends queued label/bubble geometry and bubble-owned
resize work before fullscreen entry, retains current model/selection state and
coalesces pending layout after final close. Late map initialization inherits the
covered state. Protected thumbnails clear immediately on lock. The separate
Photo location map, main-map camera and arrival/history behavior are preserved.
This does not pause MapLibre or eliminate all hidden map work.

All three decoration-candidate first swipes execute **zero label layouts and
zero bubble layouts**, versus one of each in every matched rotation control.
A separate instrumented baseline records 19.7 ms labels + 4.5 ms bubbles;
the candidate skips those bodies. Callback attempts and actual layout bodies
are counted separately. The reference browser close executes one bubble layout
and one label layout with the viewer closed. A combined-controller regression
also confirms four rounds of covered requests coalesce to one resize and one
label layout on resume.

This eliminates that work but does not establish a first-frame speedup. The
decoration-only first-swipe maximum-gap median is **299.7 ms [216.3–500.6]**;
natural return/repeat remains about **17.7 ms**. Main-map rendering still occurs.
Under the separate shared 1.6 Mbps/80 ms local transport, first selection has no
prepared neighbor in either variant, so both correctly use the ordinary loader:
ready after release is 3246.5→3226.8 ms in the single matched pair. There is no
claimed cold-transfer gain. Natural subsequent handoffs retain the prepared
nodes. Large frames also occur without main-map rendering in that slow pair.

## Gesture takeover of the opening reveal

A fixture-only experiment removed just the full-photo reveal filter while
retaining its 350 ms opacity animation. First-swipe maximum-gap median fell from
299.7 to 166.7 ms in three sequential trials per variant, but 100–167 ms gaps
remained. The experiment is not shipped and does not isolate decoding from
raster/compositor work.

The shipped change is narrower: a recognized horizontal photo swipe or a
photo-stage pinch finishes the current **ready** image's reveal. Idle entry
retains 350 ms; taps, vertical Location gestures, loading images, videos, grids,
desktop and reduced motion are excluded. A newly selected cold source resets
its reveal policy. A pinch that begins during loading does not retroactively
finish a reveal that starts later during that pinch.

Across three fresh first-swipe trials, the reveal changes from soft to instant
**0–0.1 ms after recognized horizontal intent**. Two native animation-cancel
events arrive 6.0/14.8 ms later, at elapsed animation times 33.3/16.8 ms; the third
does not start a native reveal animation. No reveal animation remains at the
drag midpoint. All nine handoffs retain the prepared incoming element, with
zero incoming source assignments and zero covered decoration layouts.

The final first-swipe maximum-gap median is **200.0 ms [183.4–232.3]**, versus
299.7 ms for the preceding decoration-only candidate and 233.3 ms for the original
baseline. These small sequential cohorts do not prove an overall speedup.
The large gaps occur after intent and remain unresolved. Six natural return/
repeat phases have median maximum gap **17.75 ms [17.3–17.8]**, with none over
25 ms. This demonstrates prompt gesture takeover, not a physical-phone cure.

## Regression and release checks

The reference and public demo each pass **16/16** browser affected-flow checks
on the decoration candidate: forward/reverse, bounded nodes, pinch/reset,
Location, read-only Comments, grid/Back/history, event-boundary selection,
decoration resume and saved map camera. The independently populated fresh draft
passes **15/15** applicable checks with the final gesture change. Its initial
failed run used an old generated fixture page with missing controls; regenerating
from the current canonical template fixed that fixture without production edits.
Unpublished Comments remain unavailable by the existing product contract.

The final **869 tests pass** with no failures, cancellations or skips. Two
successive builds leave all **78 public files byte-identical**, and diff checks
are clean. Final source hashes: app `4f6cfceef1a725db46d46d58cec16abdff0f4dca27ba29fb4516014827e780e7`,
mobile `df1de7e04ee6c58b0b1e8f32952824f46a7d62d6d8e2a7b6d3142e561ebf6ee0`,
auth `f1a5fb48417f3be6d9977c15cb33ee85c980652c91f6f55c14a663b40796f15b`.
Independent reviews cover source/auth ownership, privacy while suspended,
coalesced resume order and gesture exclusions. Publication and live checks are
pending at this source checkpoint.

## Limits

Cache bytes, load events, natural dimensions and explicit decode completion do
not prove compositor paint or GPU residency. The ready-node guard prevents an
avoidable rebind; it cannot eliminate a genuinely cold download/decode. Local
transfer timing is not production network latency. Desktop Chromium at phone
dimensions does not certify physical mobile Chrome or iPhone/Safari. Phone
OS/model and device-specific memory/rendering remain unverified. The completed
AVIF follow-up automation stays paused.
