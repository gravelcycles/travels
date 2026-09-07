# Next-agent handoff

Read `PROJECT_STATE.md` and `PRINCIPLES.md` first.

- Repo: `/Users/dg/code/travels`
- GitHub: <https://github.com/gravelcycles/travels>
- Site: <https://gravelcycles.github.io/travels/>
- Deploy `dist/` from `main` with the existing Pages workflow.
- The user wants results on GitHub or the published site, not a localhost link.

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

The user explicitly approved public photo hosting. The public GitHub Release
`trip-photos-v1` now contains all 356 WebP derivatives (176,851,380 bytes), and
representative 480, 1280, and 2560 px direct URLs were verified before the site
push. The manifest uses the immutable tag rather than a mutable `/latest/` URL.

Next:

1. Review the 104 automatic day matches, generic captions, and lead-photo order.
2. Decide whether the six MOV files should get a separate video pipeline.
3. Find reviewed fallback images only if days 9, 11, and 14 need media.
4. Use Atlas Studio to replace remaining road/walk/gondola shaping points only
   where a close-up reveals a visible error.
5. Consider transport-network-aware snapping as a later enhancement; the
   current smooth preview deliberately remains predictable and editable.

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
- `/travels/` contains real content; `/travels/demo.html` contains demos.
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
