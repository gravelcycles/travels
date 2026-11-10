# Load and interaction pass · 10 November 2026

Measured against published source `af4e7b7`. Owner priority for this pass:
"true 'correctness' matters, but ux matters more (perf, user flows, ease of
finding/clicking buttons)". Decisions and scope are in
[OWNER_DECISIONS](OWNER_DECISIONS.md#load-interaction-and-flow-fixes--10-november-2026);
release status is in [WIP](../WIP.md). Each row uses the same fixture and harness
on both sides. These are work and byte reductions on one desktop machine, not a
phone frame-rate or end-to-end page-load claim.

## Before / after

| Fix and matched measurement | Before | After |
| --- | ---: | ---: |
| Heading East trip data script, raw / gzip -9 | 1,603,477 / 495,805 B | 733,162 / 284,671 B |
| Heading East page, all 40 JS/CSS files, raw / gzip -9 | 3,452,069 / 976,419 B | 2,600,550 / 771,497 B |
| Florence–Genoa trip data script, raw / gzip -9 | 77,941 / 22,724 B | 20,283 / 11,133 B |
| Switzerland–Italy trip data script, raw / gzip -9 | 268,830 / 78,531 B | 216,793 / 69,803 B |
| City framing, Heading East, 30 stops × (211 media + 27 places), Node harness: median / max per stop | 648 ms / 2,040 ms | 0.76 ms / 1.9 ms |
| City frames changed by that work (30 stops, 251 frame points) | — | 0 |
| City-boundary ring points shipped | 12,957 | 4,424 |
| Label route strokes, whole-trip camera (z 4.6), Node harness with 30 pins | 102.7 ms, 42,263 strokes | 13.4 ms, 5,212 strokes |
| Label route strokes, city camera (z 11) | 99.3 ms, 42,263 strokes | 1.2 ms, 214 strokes |
| `map.project` calls per label refresh, Heading East | 42,311 | ≤ 4 |
| Eight stop clicks 1.2 s apart, desktop browser: long tasks | 8 (52–192 ms) | 0 |
| Same run: slowest click handler | 169 ms | 19 ms |
| Route sources / layers created per stop change | 48 / 144 | 0 / 0 |
| History writes for 60 `resize` events, desktop browser | 60 | 0 |

## Method

- **Bytes:** `gzip -9` of the published files from each tree. Routes are
  delta-encoded without loss; `test/public-geometry.test.mjs` decodes every
  published route and compares it with the legacy verification bundle.
- **City framing:** `cityFrameCoordinates` called once per Heading East stop with
  the same inputs the page passes (every visible journey photo and video, every
  saved place). The before run used `af4e7b7` data and code; frames were compared
  as sorted coordinate lists. The gain comes from rejecting far-away points by
  the boundary's padded bounding box; simplified boundaries alone change no frame.
- **Label strokes:** `routeStrokesFor` plus the pin-body crossing tests for 30
  pins, 20 runs, on a flat Web Mercator test camera at 1100 × 760.
- **Stop clicks:** local static server over each tree with `?photoSource=local`,
  1440 × 900, clicking stop rows 7–13 then 6. Long tasks from
  `PerformanceObserver`; the Browser pane was not frontmost, so animation timing
  is not reported.
- **History writes:** counted by wrapping `history.replaceState` and dispatching
  60 `resize` events on a selected stop.

## Not measured, and still open

- No phone was measured. Desktop numbers do not certify a physical iPhone.
- Per-photo request cost (an authorization preflight per image, three thumbnails
  at a time) is unchanged; it needs an unlocked session to measure.
- The fullscreen location map still redraws every route when the viewer crosses
  into another event, and nothing is bundled or minified.
- Safari's 100-writes-per-30-seconds history limit was not reproduced; the write
  is now skipped when unchanged and guarded when it throws.
