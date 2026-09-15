# Photo performance audit — 9 September 2026

The slowdown is reproducible on the production site. A full photograph took
8.0 seconds to download on first use and 0.24 seconds after a reload using the
browser cache. The migration introduced an authenticated JavaScript download
path, and subsequent changes force the largest image in the viewer and Replay.
Slow transfers interact badly with its timeout, preloading and recovery logic.

Cloudflare caching is working in the observed requests. These measurements do
not establish whether the slow body transfer originates in R2 streaming, the
Cloudflare-to-browser connection, competing requests, or browser scheduling.
There is no evidence here that moving providers or buying a paid plan would
resolve the problem.

Scope: production revision `7b9a830e4680bb3bd01c6fedba09362c9c0e76d3` at
[the live journey](https://gravelcycles.github.io/travels/switzerland-italy.html).
The downloaded production loader exactly matched that revision. Its Pages run
succeeded. Other uncommitted UI changes appeared during the audit; this report
and the reproductions use a saved production snapshot and do not modify those
changes. No application fixes or deployments were made by this audit.

## What was measured

| Request | Image bytes | Browser download time | Inner photo fetch to headers | Cache result |
| --- | ---: | ---: | ---: | --- |
| Day 6, photo 1, first use | 1.21 MB | 8,009 ms | 98 ms | MISS, full download |
| Day 6, photo 2, neighbor preload | 1.02 MB | 7,731 ms | 245 ms | MISS, full download |
| Day 6, photo 3, first use | 1.27 MB | 5,890 ms | 148 ms | MISS, full download |
| Day 6, photo 21, first use | 0.75 MB | 976 ms | 155 ms | MISS, full download |
| Day 6, photo 1, after reload | Same photo | 240 ms | 16 ms | HIT, browser bytes revalidated |

The prefetched second photo was ready about 282 ms after selection, including
tool overhead, despite its earlier slow download. Returning to photo 1 within
the original page also showed it ready immediately in the post-click check.
Five initial cached images took 238–460 ms, with 9–15 ms inner timings. No
browser console errors were captured in this sample, and the sampled live
images ultimately loaded. Permanent failures below were reproduced through
controlled fixtures, not claimed as observed production failures.

Separate HTTP probes fetched the page in 176 ms and the loader in 219 ms.
The page is still on GitHub Pages; Cloudflare hosts photographs and login.

**Timing limits:** the loader records the successful fetch attempt through
`response.blob()`, excluding queue wait, earlier retries and image decoding.
The Worker timing ends when the inner response headers arrive; it excludes
full body streaming and is not a measurement of total Cloudflare processing.
These are individual desktop-session samples, not latency percentiles.

## Findings, in fix order

### 1. High: slow but progressing downloads are aborted and restarted

The loader gives each attempt ten seconds, including the entire response
body, then retries once from the beginning. The timer does not reset when bytes
arrive. The full image stays hidden until the blob is downloaded and ready.
The observed 8-second transfer is already close to this cutoff. A transfer
needing eleven seconds can lose all its progress twice and show an error after
roughly twenty seconds, plus queue time.

Production reference: [download timeout and retry](/Users/dg/code/travels/build/performance-audit/photo-auth.production.js:77).
The fixture confirms that receiving another chunk immediately before the
deadline still leads to cancellation and a new request.

Fix: distinguish stalled headers/body from ongoing progress, retain an overall
upper bound, and use a suitable transfer budget for full images. Record queue,
headers, body, attempt count and decoding separately. Keep the chosen full-size
presentation; faster recovery does not require showing a lower-quality image.

### 2. High: session restoration can leave photos gated or the entire page blank

Startup awaits `/auth/status` before permitting any private photos. That fetch
and its JSON body have no application timeout. The authorization-code exchange
and periodic status check are also unbounded. A stalled startup status request
leaves all photographs unavailable, with no prompt and no restoration attempt.
A stalled periodic check leaves `checkPending` set and suppresses later checks.

The first-party login page is more severe: its entire `<main>` is hidden until
the session request either succeeds or fails. That request also has no timeout.
Since restoration navigates away from the atlas, a stalled request there can
present as a completely blank, stuck site. This is a concrete potential cause
of the reported whole-site lag, although that blank-page condition was not
observed live during this audit.

Production references: [startup status](/Users/dg/code/travels/build/performance-audit/photo-auth.production.js:216),
[code exchange](/Users/dg/code/travels/build/performance-audit/photo-auth.production.js:199),
[hidden login page and unbounded request](/Users/dg/code/travels/build/performance-audit/window.production.mjs:4).
The fixture confirms the indefinitely gated startup state with no timeout.

Fix: bounded auth requests including body parsing, visible restoration progress,
and an accessible retry/return action even while restoring. A network outage
must not be treated as evidence that remembered access is invalid.

### 3. Medium: a server-side expiry rejection bypasses automatic recovery

The local expiry timer calls the remembered-session restoration flow. However,
an image request receiving HTTP 401 calls `lock()` directly, clears every
loaded photo and the tab token, and does not try restoration. A periodic status
401 takes the same path. This matters when a request crosses the expiry
boundary or the client's clock is behind the server. Revoked credentials must
still fail closed, but an expired access token can have a valid remembered
session available to restore.

Production references: [image 401](/Users/dg/code/travels/build/performance-audit/photo-auth.production.js:86),
[periodic status 401](/Users/dg/code/travels/build/performance-audit/photo-auth.production.js:236).
The fixture confirms that a 401 locks access without navigation or a prompt.

Fix: one bounded remembered-session restoration attempt for this rejection
path, with loop prevention and a clear locked state if restoration is denied.
Continue requiring server authorization before displaying fetched photos.

### 4. Medium: stale full-size preloads delay visible thumbnails

Both speculative preloads and ordinary visible thumbnail loads share a maximum
of two background download slots. Selected viewer photos have a higher
priority, but visible thumbnails cannot interrupt two already running preloads.
Neighbor preloads do not have an album/selection owner or cancellation handle;
moving elsewhere or closing the viewer does not cancel irrelevant speculative
work. There can be a backlog even though active request concurrency is bounded.

Production references: [shared queue](/Users/dg/code/travels/build/performance-audit/photo-auth.production.js:69),
[preload API](/Users/dg/code/travels/build/performance-audit/photo-auth.production.js:247),
[full-size neighbors](/Users/dg/code/travels/build/performance-audit/app.production.js:1009).
The fixture queues twelve speculative loads, then a visible thumbnail: the
thumbnail does not start while the two speculative slots are occupied.

Fix: cancel obsolete speculative work, bound the pending queue, give visible
thumbnails capacity ahead of speculative transfers, and suspend preloading
while the selected photo is struggling. Retain completed cached bytes.

### 5. Medium: Retry can reuse a failed image indefinitely

When downloaded bytes produce an image error, the loader marks the image as
failed but retains the blob cache entry. Retry calls `setImage()`, which chooses
that same cached blob. It issues no new request. This differs from ordinary
HTTP/network failures, which do remove the failed cache entry and retry.

Production references: [image error handling](/Users/dg/code/travels/build/performance-audit/photo-auth.production.js:114),
[cached image selection](/Users/dg/code/travels/build/performance-audit/photo-auth.production.js:152).
The fixture confirms that Retry retains the failed blob URL and request count.

Fix: invalidate failed decoded entries and provide a deliberate fresh-fetch
retry while preserving generation guards against old callbacks. A decode
interruption that later produces a valid load should still succeed.

## Costs added or amplified by the migration

The earlier viewer used browser `srcset` selection. The current viewer, Replay
and neighbor preloads request the largest derivative (`Infinity`). Replay does
this even for its approximately 355 CSS-pixel desktop slot. This preserves the
recorded preference for full photographs, but has a measurable transfer cost:

| Variant | Median file | All 99 photos | Day 6's 21 photos |
| --- | ---: | ---: | ---: |
| 480px thumbnail | 36.6 KB | 4.52 MB | 0.82 MB |
| 1280px preview | 289.5 KB | 34.45 MB | 6.57 MB |
| Full size | 1.02 MB | 101.40 MB | 19.65 MB |

The largest file is 2.03 MB. A typical 3200 × 2400 image also represents about
30.7 MB of uncompressed RGBA pixels; actual browser/GPU memory was not measured.
The loader's 64 MiB unused-cache budget counts compressed blobs, not decoded
pixels. Do not infer a measured memory leak from that difference.

Cross-origin `Authorization` adds CORS preflight work for uncached permissions.
Preflight caching matches the individual URL, so one photo's cached permission
does not eliminate the next photo's first preflight. The configured 86,400-second
maximum is also capped to 7,200 seconds in current Chromium. These are normal
platform costs, not evidence of a broken CDN. See the
[Fetch preflight cache specification](https://fetch.spec.whatwg.org/#cors-preflight-cache)
and [browser maximum ages](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Access-Control-Max-Age).

Private browser caching is enabled, but `private, no-cache` intentionally
requires authorization revalidation before HTTP reuse. Warm images therefore
still incur a network request after reload; within-page blob reuse avoids it.
The observed 8,009 → 240 ms improvement confirms reuse is functioning.

The internal Cloudflare cache currently uses default version-specific keys.
Worker deployments start a cold cache even though the image paths are immutable
and advertise a one-year lifetime. Consider sharing only the internal immutable
photo cache across Worker versions, with a purge/deletion policy; leave the
public authentication gateway uncached. This is a tuning opportunity, not proof
that deployments caused the particular slow samples. See
[Cloudflare's cache version behavior](https://developers.cloudflare.com/workers/cache/cache-keys/#invalidating-cache-across-deployments).

## Whole-site interaction work still worth profiling

`syncViewerMap()` removes and recreates all 29 journey route segments on every
photo selection, even within the same day. It also changes markers and animates
the camera. That behavior predates the Cloudflare migration, so it should not
be presented as a newly introduced Cloudflare regression. It can nevertheless
compete with full-image decoding and tile transfers. Keep route sources/layers
stable across same-day photo changes and profile the affected device before
claiming this explains its interaction lag.

Reference: [viewer map reconstruction](/Users/dg/code/travels/build/performance-audit/app.production.js:1092).
No browser CPU trace, mobile profile, or historical Cloudflare error/quota
analytics was captured. Those remain the limits of attribution, rather than
reasons to dismiss the measured delays.

## Verification and artifacts

All 119 existing tests passed. Five additional reproduction tests confirm the
failure behaviors above against the saved production loader. Their assertions
intentionally describe today's defects; passing means reproduced, not fixed.

- [Reproduction fixtures](/Users/dg/code/travels/build/performance-audit/reproduce.test.mjs)
- [Reproduction output](/Users/dg/code/travels/build/performance-audit/reproductions.txt)
- [Live measurement record](/Users/dg/code/travels/build/performance-audit/live-measurements.json)
- [Image size inventory](/Users/dg/code/travels/build/performance-audit/image-sizes.json)
- [Existing test output](/Users/dg/code/travels/build/performance-audit/existing-tests.txt)

Fix the timeout, session recovery, speculative queue and failed-blob retry
first, keeping the full-size preference and current access controls. Then repeat
cold/warm navigation with queue, headers, body and decode timings, including
slow-but-progressing transfers, rapid album changes and expiry during a fetch.
That will distinguish remaining delivery latency from application delays.
