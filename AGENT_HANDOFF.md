# Next-agent handoff

Read `PROJECT_STATE.md` and `PRINCIPLES.md` first.

- Repo: `/Users/dg/code/travels`
- GitHub: <https://github.com/gravelcycles/travels>
- Site: <https://gravelcycles.github.io/travels/>
- Deploy `dist/` from `main` with the existing Pages workflow.
- The user wants results on GitHub or the published site, not a localhost link.

## Next pass

1. **Split the pages.** Keep real journeys at `/travels/` and put sample
   journeys at `/travels/demo.html`. Share viewer code; never mix real and demo
   journeys in one selector. There is only one real journey for now.
2. **Fix initial framing.** Start broad, then animate to the full trip bounds
   over 2.5 seconds. Routes and markers must appear without pressing a button.
3. **Improve day focus.** Fit the selected day, keep other routes visible in a
   quiet grey, and draw the selected orange route last. Fix the close-up being
   cut off at the bottom.
4. **Fix panel overflow.** Add clearly visible, independent scrollbars to the
   left day list and right journal when content is taller than the viewport.
5. **Simplify controls.** Remove the `All modes` filter. Keep a static legend
   with clearly different patterns: solid train, circular/dotted boat,
   long-dash bus, short-dash bicycle, fine-dot walk, and chevron gondola.
6. **Improve route fidelity.** Add separate detailed `geometry` to segments;
   keep `stops` only for stop markers and counts. Prefer reviewed static
   GeoJSON from operator/open-transport data or OpenStreetMap-derived routing.
   Trains should follow rails, boats should stay on water, and buses/bikes
   should follow plausible roads. Record sources in `ROUTE_SOURCES.md`.
7. **Reduce label collisions.** Investigate route casings, lower route opacity,
   label halos, or hiding selected basemap labels under active routes. Do not
   remove useful place context globally.
8. **Update the demo** for every shared behavior or data-model change.

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
- Test the deployed URLs with a cache-fresh query after the Pages workflow
  succeeds. Bump the current static asset version token when assets change.
