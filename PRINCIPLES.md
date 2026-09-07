# Project principles

- A trip is a standalone story; real and demo content use separate pages.
- The calendar day is the main unit and may contain any number of ordered modes.
- For a base-based trip, label the meaningful destination rather than the base.
- Keep map, segment order, title, prose, stops, and photos consistent.
- Stops describe meaning; detailed geometry describes the line's actual shape.
- Store new geometry in GeoJSON order: `[longitude, latitude]`.
- Do not invent precision; mark representative schedules and routes honestly.
- On day focus, keep trip context grey and put the orange route on top.
- Line patterns should remain distinguishable without relying only on color.
- Every shared feature change must also work on the demo page.
- Preserve private photo originals; publish reviewed, optimized derivatives.
- Give photos a tiny embedded preview, responsive sizes, lazy off-screen loads,
  and bounded neighbor preloads so the atlas stays quick without feeling empty.
- Verify changes on the deployed GitHub Pages site, including a fresh load.
- `noindex` discourages discovery but does not make a public Pages site private.
