# Map Lab comparison — 17 November 2026

Five concepts for the map, built as one local demo on real data
([README](README.md)). This is a proposal for the owner's choice under O15;
nothing is adopted yet. Updated after the owner's first correction
([O23](../../docs/OWNER_DECISIONS.md#map-concepts-real-maps-light-by-default--17-november-2026)):
every concept is on a real map and opens light; Globe and Follow-cam keep an
optional dark mode.

## At a glance

| | 1 · Globe | 2 · Transit map | 3 · Ink atlas | 4 · Space-time | 5 · Follow-cam |
| --- | --- | --- | --- | --- | --- |
| **Concept** | The trip crossing a real globe; legs are comets | Metro-map clarity drawn on the real map | A printed travel journal drawn by a pen | Time as a dimension: scrubber plus 3D time cube | Each leg as a short film behind the vehicle |
| **Projection** | MapLibre globe, pitched follow camera | Flat Mercator with an SVG transit layer, still camera | Flat Mercator, still camera | Pitched 3D cube (deck.gl) ⇄ flat map | Pitched 3D terrain with chase camera |
| **Visual world** | Warm light map with soft halos; optional night mode with glow | Swiss white data display on a quiet light map | Warm paper, ink, serif and hand lettering | Light instrument, monospace readouts | Natural terrain on a light map, split-flap board, letterbox in travel; optional night drive |
| **Animation** | Comet with fading tail; fly-in from space | Lines build station by station; vehicle token | Pen nib drawing symbol strokes; stamp “thunk” | Playhead sweep; cube collapses onto the map | Split-flap board, chase camera, letterbox |
| **Photos** | Dots that bloom into blurred circles as the comet passes | Counts on stations at trip scale; counts at their true groups in a city | Pinned polaroids and stacks with handwritten counts | Points at capture time and place; histogram on the scrubber | Cards pop up at capture points as you pass |
| **Places** | Small stars | Interchange badges | Hand-lettered names with an ink cross | Gold rings at the stop's time | Pins that rise on arrival |
| **Mode without colour** | Halo keeps each mode's dash pattern | Dash patterns plus a mode bullet on every line (also TBD) | Cartographic symbols (cross-ties, stitches, cable-and-cabins, dots, dashes); TBD pencilled with “bus?” notes | Dash patterns on legs and on the scrubber | Current patterns with casing; the board names the mode |
| **Keeps** | Real light map (O23), patterns, unselected opening, TBD dotted without casing, direct links, interruption, reduced motion | Same, plus a still camera while the token runs | The most: still camera, current arrival timings (850 ms / 1.5 s / 0.25 s / 900 ms), 3-second framed trace, warm paper (O06/O09/O22) | Same as 1; capture time is the only photo text | Current colours/patterns, real-data-only board |
| **Breaks (deliberately)** | Moving camera during opening and legs (O06/O09); dark map only as a choice | Stations instead of signposts (O07); 1.4–3.6 s token run per stop | Ink tones replace the palette; stamps replace signposts (O07) | Non-linear story time; tilted camera; extra panel above the picker; new 1.6 MB dependency | Moving/rotating camera; 2.4–7.5 s per leg; leg not always fully in view (O09) |
| **Measured (390 px, CPU ×4, software WebGL)** | 10 fps opening, 10.5 fps leg; light script | 56 fps opening; leg 24 fps (token smooth, eases cost) | 57 fps opening; leg 20 fps (trace smooth, eases cost) | 6 fps opening, 9 fps leg | 1 fps; main thread 99–100 % |
| **Phone fit** | Good; follow shots crop long legs | Very good: bold lines, 44 px stations; dense clusters need a pinch | Very good: still camera, stamps beside the city | Good in Map view; cube labels thin out | Strong upright, but heaviest work |
| **Effort into the shared framework** | M — globe and sky are in MapLibre 5.24; comet reuses the arrival canvas pattern; dark mode is extra | S–M — stations, bullets, counts and token on the existing map (SVG overlay or MapLibre layers); no layout solver | S–M — basemap paint, canvas symbol strokes (or MapLibre patterns), stamp and polaroid markers; timing already matches | L for the cube (dependency or custom WebGL); S–M for the scrubber alone | M — terrain source, camera choreography, board; needs a durable free DEM host |
| **Risk** | Medium: camera motion during legs; the globe adds little on a one-region trip | Low–medium: overlay redraw during camera moves; label density at trip scale | Low–medium: symbol legibility at trip scale; self-host fonts | Medium–high: comprehension, second GL canvas on phones | High: phone performance, motion comfort, blank terrain while tiles load |

## Measured performance

Playwright, headless Chromium, 390 × 844, **4× CPU throttling**, Heading East.
Frame intervals are `requestAnimationFrame` gaps while the option reports an
animation; *script* is each option's own work per animation frame; *main
thread* is Chromium's busy share over the sequence (`TaskDuration`).

| Option | Opening (whole trip): fps · p50 / p95 frame | Long leg Düsseldorf → Berlin (543 km), from landed Düsseldorf: fps · p50 / p95 | Own script per frame p50 / p95 (opening · leg) | Main thread (opening · leg) |
| --- | --- | --- | --- | --- |
| 1 · Globe (light) | 10 fps · 67 / 250 ms | 10.5 fps · 83 / 200 ms (8.2 s) | 4.0 / 10.9 · 5.4 / 15.8 ms | 42 % · 51 % |
| 2 · Transit map | **56 fps · 16.7 / 16.8 ms** | 24 fps · 16.7 / 100 ms (4.6 s; the still-camera token runs at 16.7 ms, the two camera eases cost the rest) | 3.8 / 8.3 · 8.2 / 24 ms | 68 % · 74 % |
| 3 · Ink atlas | **57 fps · 16.7 / 16.8 ms** | 20 fps · 33 / 150 ms (4.3 s; the still-camera trace runs at 16.7 ms, the two camera eases cost the rest) | 1.5 / 3.9 · 1.7 / 12.7 ms | 39 % · 40 % |
| 4 · Space-time | 6 fps · 33 / 900 ms | 9 fps · 50 / 317 ms (4.6 s) | 6.1 / 11.5 · 6.2 / 11.2 ms | 39 % · 35 % |
| 5 · Follow-cam | 1 fps · 483 / 2,300 ms | 1 fps · 717 / 4,916 ms (18.6 s) | 6.3 / 8.4 · 9.7 / 20.5 ms | 99 % · 100 % |

How to read this honestly:

- This machine has **no GPU**; WebGL runs in software (SwiftShader). Any frame
  that redraws the basemap costs roughly 30–300 ms here, which a phone GPU
  does in a few. So these numbers rank the concepts by *how much they redraw*,
  not by what a phone will show. They are not a phone certification.
- Overlay-only animation is smooth even here: the transit map's line build
  and token (SVG over a still map) and the ink pen trace (canvas over a still
  map) hold ~56–58 fps under 4× throttling. Camera eases cost both of them
  frames; options that move the camera every frame (globe follow, cube,
  chase) are bound by basemap redraws. Before the correction the transit
  concept had no basemap and measured 58 fps on the leg too.
- Globe and Transit map were re-measured after the correction with the same
  fixture, viewport and throttling; the other three are unchanged in what
  they draw (Follow-cam only changed chrome colours).
- Each option's own JavaScript stays at or below ~6 ms p50 per frame on the
  animated phases, so the concept code is not the limit for options 1–4; the
  transit map's SVG reprojection during camera eases (8 ms p50, 24 ms p95) is
  the one overlay cost worth trimming (cull off-screen legs, or move the lines
  into MapLibre layers). **Follow-cam is genuinely
  heavy**: terrain keeps the main thread at 99–100 % and its per-frame camera
  costs 10–20 ms of script even after hiding cluster markers during the chase.
  It is the one concept likely to stutter on a mid-range phone with a GPU.
- Flying in from trip scale to a city (rather than from the previous stop)
  adds tile loading; the first run measured that path and every map-based
  option dropped further (Ink 2 fps, Space-time 3 fps, Follow-cam 1 fps).
- A same-fixture baseline of the current viewer was not possible: real-trip
  pages redirect to the access service, which rejects a local origin.

## Recommendation (the choice is the owner's)

**Take Ink atlas as the base direction, and borrow two parts from the others.**

- *Ink atlas* keeps the most standing decisions (still camera, current arrival
  timings, the framed 3-second opening, warm paper and serif character), is
  plainly different at rest on desktop and phone (O22's side-by-side test),
  measured smooth wherever only the overlay animates, and maps onto the
  shared framework with the least new machinery: basemap paint, symbol strokes
  in the existing arrival canvas, and stamp/polaroid markers in place of
  signposts and circle bubbles.
- From *Transit map*: the **mode bullet** (a small mode icon on a line),
  which fixes the one gap every concept shares — a dotted TBD leg otherwise
  loses its mode cue. If a crisp, modern look appeals more than paper and
  ink, the whole *Transit map* is the closest alternative base: now that it
  sits on the real map it is almost as cheap to adopt.
- From *Space-time*: the **story-time scrubber** as an optional timeline control
  (without the cube or deck.gl).

Not recommended as defaults: *Follow-cam* (phone performance, motion comfort and
the largest O09 departure) and *Globe* (its moving camera, and a globe adds
little on a trip within one region). The globe's fly-in could survive as a
one-off opening if the owner likes it. Dark mode, where wanted, belongs to
O22's later pass and stays a choice, never the default (O23).

## Second round — 18 November 2026

Asked to “think a bit deeper and prioritize your next best 3”, the agent
scored the remaining ideas against the standing decisions: real, light map
(O23), still camera and no full-trip Replay (O09), map-first unselected
opening (O06), photographs lead (O22), no invented copy or locations
(O01/O02), and the owner's ranking of UX flow over polish (O20).

| Rank | Concept | The problem it solves | Why it ranked here |
| --- | --- | --- | --- |
| 1 | **6 · City lens** | Every concept, and the live site, trades the route for the city on arrival: you see one or the other. | Fixes a core flow with no new camera motion; keeps the journey and the city on screen together (the “continuous geographic context” in the Apple-like definition). Additive to the current map. |
| 2 | **7 · Photo roll** | Photos and map are separate places: the album lives apart from the route. | Makes photographs lead (O22) and gives the album a geography; follows O05's camera rule. Conflicts most with the established sidebar/phone card (O03/O08), so it ranks below the lens. |
| 3 | **8 · Now** | The first question a follower asks of an ongoing trip — where are they now? — needs reading the whole list. | Cheap, honest (dates and photos only) and reuses the Past / Locked in / TBD split already approved for Heading East; adds a card to the overview, which O06 keeps sparse. |

Considered and left out: an elevation ribbon (valuable on Alpine legs only),
a heat trail weighted by photos/nights (fights the transport colours and
patterns), postcards (overlaps O21's photo row and Ink's polaroids), a
calendar strip (subsumed by the Space-time scrubber and Now), and a story
mode (too close to the disabled full-trip Replay, O09).

| | 6 · City lens | 7 · Photo roll | 8 · Now |
| --- | --- | --- | --- |
| **Concept** | Main map keeps the incoming route; a round street-scale lens beside the city | The photo roll drives the map; scroll to travel | Time-aware map: past solid, plan lighter, TBD dotted, honest status |
| **Photos** | Blurred circles with counts inside the lens; counts elsewhere | Filmstrip in album order; current pin at its capture point; dots elsewhere | Latest photo marked with its own date; counts in the card |
| **Places** | Labelled pins inside the lens | Unchanged (card in the stop list) | Count in the stop card |
| **Keeps** | Still camera, 850 ms / 1.5 s / 0.25 s timing, viewer's arrival canvas, 3-second opening, current styles | Same, plus O05's photo-camera rule and album order | Same, plus the Heading East planning filters and no invented location |
| **Breaks (deliberately)** | No zoom into the city on arrival; a second map on screen | Persistent strip over the picker; scrolling changes the stop without arrival | Overview card and “last confirmed” marker; future legs lighter; opening traces the past only |
| **Phone fit** | Lens docks bottom-right (190 px) with a leader | Very good: one swipe through the trip | Good: card shrinks to the status line |
| **Effort into the shared framework** | S–M: a second small map and a callout; trace and camera already exist | M: a strip component bound to existing photo order and camera rules | S: planning paint, a status card from existing helpers |
| **Risk** | Low–medium: two maps on low-end phones; lens placement near edges | Medium: overlaps the existing photo surfaces | Low: copy must stay strictly factual |

Measured the same way (390 × 844, CPU ×4, software WebGL, Heading East),
on the restarted container, with Ink atlas re-run as a control in the same
session:

| Option | Opening: fps · p50 / p95 | Long leg from landed Düsseldorf: fps · p50 / p95 (wall) | Own script per frame p50 / p95 | Main thread (opening · leg) |
| --- | --- | --- | --- | --- |
| 3 · Ink atlas (control) | 57.7 fps · 16.7 / 16.8 ms | 37 fps · 16.7 / 66.6 ms (6.5 s) | — | 41 % · 33 % |
| 6 · City lens | 45 fps · 16.7 / 50 ms | 40.5 fps · 16.7 / 66.6 ms (3.2 s) | 0.2 / 1.0 ms | 44 % · 55 % |
| 7 · Photo roll | 57 fps · 16.7 / 16.8 ms | 41 fps · 16.7 / 50 ms (3.9 s) | 0.1 / 0.9 ms | 23 % · 62 % |
| 8 · Now | 54 fps · 16.7 / 16.8 ms | 38 fps · 16.7 / 50 ms (4.1 s) | 0.1 / 0.6 ms | 26 % · 40 % |

The control shows this container renders camera moves faster than the first
one (Ink's leg went from 20 to 37 fps), so compare the new three with the
control row, not with the earlier table. On that basis they match Ink atlas;
their own script is near zero because the trace is the viewer's shared canvas.
City lens pays for its second map in the opening (45 fps, p95 50 ms).

**Recommendation update.** City lens is the strongest single addition and
combines with any base: Ink atlas or Transit map with a City lens arrival is
the agent's suggested direction. Photo roll and Now work best as later,
separate features rather than as the base. The choice remains the owner's.
