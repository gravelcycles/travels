# Next-agent handoff

Read `PROJECT_STATE.md` and `PRINCIPLES.md` first.

- Repo: `/Users/dg/code/travels`
- GitHub: <https://github.com/gravelcycles/travels>
- Site: <https://gravelcycles.github.io/travels/>
- Deploy `dist/` from `main` with the existing Pages workflow.
- The user wants results on GitHub or the published site, not a localhost link.
- Assume every operational flow is agent-driven. Do not ask the user to run npm,
  terminal, build, server, Git, GitHub CLI, or deployment commands. Run them,
  open any local UI the user needs, stop temporary servers, and verify the
  deployed result. The user supplies facts, files, corrections, and judgments.
- Read `JOURNEY_WORKFLOW.md` before adding a journey or changing route tooling.

## Current pass

Locally completed on 7 September: a day-scoped full-screen photo viewer and a
loopback-only Atlas Studio for exact photo positions/text and manual route
redrawing. The viewer keeps the main story and side map synchronized as its day
changes and zooms to stored photo coordinates. The Studio provides draggable
photo pins; caption, description, alt, exact-place, day, zoom, and visibility
fields; plus route control points, smoothing, undo/redo, reset, and deletion.

Run `npm run studio` and open `http://127.0.0.1:4173/studio/`. Saves update
`content/photo-overrides.json`, `content/route-overrides.json`, and generated
`dist/assets/content-overrides.js`; backups under `build/studio-backups/` are
ignored. Both source JSON files intentionally start empty. Do not publish the
Studio itself as a server—the public site consumes only the static generated
asset.

Current Studio route edits are manual geometry overrides. They survive base
route regeneration, but smoothing is not mode-aware. The desired editor should
preserve user control points as anchors and recompute the detailed line on the
appropriate rail/ferry/road/bicycle network. GPX import is desired for recorded
bicycle days.

The user explicitly approved public photo hosting. The public GitHub Release
`trip-photos-v1` now contains all 356 WebP derivatives (176,851,380 bytes), and
representative 480, 1280, and 2560 px direct URLs were verified before the site
push. The manifest uses the immutable tag rather than a mutable `/latest/` URL.

## Confirmed product direction

- `/travels/` becomes an atlas/catalog of every real journey.
- `/travels/rushton-switzerland.html` becomes the dedicated page for the
  current family trip. Demo journeys remain separate from the real atlas.
- Hovering a route segment should reveal what happened there: day, mode, leg,
  and concise story context. Provide an equivalent tap/focus interaction.
- Test a more topographic, higher-contrast basemap that clearly distinguishes
  water, land, forest, and mountain terrain without overwhelming the story.
- Make every transit mode substantially easier to distinguish with redundant
  color, dash, width, or casing—not color alone.
- Day dots still cover place names. Fix marker placement/collision/visibility;
  putting line layers below basemap labels did not solve DOM markers.
- Trip Replay remains the preferred future “fun” feature: animate legs by day
  and pause at located photos.
- The user's unfinished note “maybe we should also be able to edit …” needs a
  follow-up. Do not guess which additional fields they meant.

## Known content corrections

- Day 1 should contain only Zürich Flughafen → Luzern. Remove
  `family-luzern-airport-pickup` from `family-d1`; then reconcile the day title,
  destination label, narrative, distance, and close-up bounds.
- Day 10's ferry geometry is visibly wrong. Inspect and correct both
  `family-como-varenna-boat` and `family-dervio-bellagio-boat` against the actual
  services and water path; verify the complete five-leg close-up afterward.

## Next

Use the independent, acceptance-scoped work items in `TODO.md`; assign one item
per new agent/task so each starts with only the relevant context. Update the
Markdown handoff when an item lands.

## Topographic basemap direction

First test [OpenTopoMap](https://wiki.opentopomap.org/about): it covers both
countries and needs no API key. It may be visually busy, so mute/desaturate it
and retain a light casing beneath route lines for contrast.

If stronger styling control and service guarantees are worth adding an account,
test MapTiler Outdoor with a key restricted to `gravelcycles.github.io`.
swisstopo is excellent for Switzerland but cannot be the only basemap because
the trip continues into Italy.

## Acceptance checks

- Fresh public load finishes framed on the complete trip after 2.5 seconds.
- Day 4 and Day 10 close-ups fit completely, including the bottom edge.
- Other routes remain grey during day focus; orange lines stay on top.
- Both side panels visibly scroll at short desktop heights and on mobile.
- Until T03, `/travels/` contains the current real trip. After T03 it contains
  the real-journey catalog, `/travels/rushton-switzerland.html` contains this
  trip, and `/travels/demo.html` contains only demos.
- Line patterns are easy to distinguish and match the legend.
- City labels remain legible above route lines.
- Day focus shows working previous/next controls at desktop and phone widths.
- Only nearby images hydrate; a large-screen viewer selects the 2560 px source.
- The full-screen viewer stays within one day for photo arrows, while day arrows
  change both its photo set and the main map/story selection.
- Atlas Studio changes survive reload after **Save locally**, and route
  undo/redo remains usable after adding, dragging, or deleting a control point.
- Test the deployed URLs with a cache-fresh query after the Pages workflow
  succeeds. Bump the current static asset version token when assets change.
