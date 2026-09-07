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

Also completed on 7 September: T01 corrected Day 1 to the single 68 km Zürich
Flughafen → Luzern arrival leg. The obsolete reverse pickup segment and its
generated geometry were removed; title, destination, story, trip summary,
layering, and close-up bounds now agree. Desktop, 390 px mobile, and demo smoke
checks passed locally without browser warnings or errors. Commit `a72b21b`
deployed successfully in Pages run `34089946949`; a cache-fresh public check at
`https://gravelcycles.github.io/travels/?v=a72b21b` confirmed the corrected
summary, route, and prose without browser errors.

T02 is also complete locally. Day 10 now uses the timetable-matched SR110
Como–Varenna service (12:15–13:15, six intermediate calls) and direct run 809
Dervio–Bellagio (17:17–17:50). The first ferry follows OSM relation `18734598`;
the second uses the direct open-water path between the exact ferry terminals
because OSM has no route relation for run 809. The five-leg close-up is 95 km
and passed desktop, 390 px mobile, and demo smoke checks without browser
warnings or errors. Commit `f5bb7ff` deployed successfully in Pages run
`34091683711`; a cache-fresh public check at
`https://gravelcycles.github.io/travels/?v=f5bb7ff` confirmed both corrected
ferry legs, all five Day 10 route entries, close-up framing, and a clean browser
console.

Also completed locally on 7 September: Studio photo placement now captures the
map's current zoom whenever a location is clicked or a pin drag finishes, and
the public viewer honors the saved 2–20 range. The main atlas, photo viewer,
and Studio now use OpenFreeMap Liberty with stronger water, forest, park,
shaded-relief, and road treatment. OpenTopoMap was evaluated but not selected:
its raster tiles would prevent place labels from remaining independently above
the atlas route layers. Desktop overview/Day 10, 390 px Day 10, Studio, viewer,
and demo checks passed locally with no browser warnings or errors. Commit
`af65787` deployed successfully in Pages run `34094449848`; a cache-fresh
public overview check at `https://gravelcycles.github.io/travels/?v=af65787`
confirmed the new terrain treatment, attribution, route layering, and a clean
browser console.

The follow-up route-contrast adjustment is complete locally: terrain and
land-cover colors are slightly softer, unselected journey lines are brighter
blue and wider, selected lines are brighter orange, and both receive stronger
near-white casings. The same treatment is used in Atlas Studio. Desktop
overview/Day 10, 390 px Day 10, Studio route mode, and demo checks passed with
no browser warnings or errors. Commit `e33a6dc` deployed successfully in Pages
run `34095170234`; a cache-fresh public overview check at
`https://gravelcycles.github.io/travels/?v=e33a6dc` confirmed the stronger route
hierarchy and a clean browser console.

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

No remaining P0 content corrections are recorded.

## Next

T03 is the next unfinished item: split the real-journey catalog from the current
trip detail page. Continue with the independent, acceptance-scoped work items
in `TODO.md`, one item per new agent/task. Update the Markdown handoff when an
item lands.

## Basemap decision

Keep the checked-in OpenFreeMap Liberty treatment unless later testing finds a
specific readability or service problem. Its vector layers let route lines sit
below place labels while water, woodland, roads, and low-zoom relief remain
distinct. OpenTopoMap's terrain is strong but its raster labels cannot be
separated from the terrain tile; MapTiler would add an account/key requirement,
and swisstopo cannot cover the Italian part of the trip alone.

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
