# Map Lab — five ways to draw the journey

A standalone **local demo** that compares five very different concepts for the
Journey Atlas map, using the real public journey bundles. It is a proposal
under [O15](../../docs/OWNER_DECISIONS.md#standing-decisions-and-acceptance-checks):
it does not change the shared viewer, is not part of the build, is not linked
from the catalog and is not deployed. Nothing here is adopted until the owner
picks a direction. Status and checks: [WIP](../../WIP.md#map-lab--17-november-2026).

**Owner correction, 17 November 2026 ([O23](../../docs/OWNER_DECISIONS.md#map-concepts-real-maps-light-by-default--17-november-2026)):**
every concept is drawn on a real map and opens light. The transit concept
lost its schematic-only view and is now a transit map on true geography; the
globe and Follow-cam open light and keep a night appearance behind the
**Dark map** switch (`&mode=dark`), which only those two offer.

## Run it

From the repository root:

```bash
python3 -m http.server 4180
```

Then open <http://127.0.0.1:4180/prototypes/map-lab/>.

The view is kept in the URL, so a specific state can be shared:
`?option=3&trip=backpacking-europe-heading-east&event=backpacking-europe-heading-east-berlin-stay&motion=reduced`
(add `&mode=dark` for the optional dark appearance of options 1 and 5).
Keys: 1–5 switch concepts, ←/→ previous/next stop, Home shows the whole trip.

## What it reads

- `dist/assets/journey-data/*.js` — loaded directly with `fetch` and evaluated
  against a private object (no copies). `data.js` applies
  `CONTENT_OVERRIDES` as the viewer does: day `photoOrder`, photo location /
  `mapFrame` overrides and Trash (through the shared `resolvePhoto`), route
  geometry overrides, compact routes through the shared `decodeRoute`, album
  order through the shared `orderForDay`, and city framing through the shared
  `cityFrameCoordinates`.
- `dist/assets/atlas-utils.js`, `media-utils.js` and the vendored MapLibre
  5.24.0 are loaded read-only. No shared runtime, template, CSS, test or
  journey source is modified.
- **Photo privacy (O14).** Protected trip photos expose only their embedded
  public `blur` preview; `data.js` never passes their private `src`/`srcset`
  to an option, so no private image is requested, copied or stored. Public demo
  photos use their thumbnails in `dist/assets/photos/`. Photos without
  coordinates are never drawn on a map. Only owner-saved `point.photoIds` link
  photos to places; nothing is inferred from distance and no caption is
  generated (O01/O02).

External hosts used by the demo only: `tiles.openfreemap.org` (all basemaps),
`s3.amazonaws.com/elevation-tiles-prod` (terrain, option 5),
`cdn.jsdelivr.net` (deck.gl 9.1.14, option 4) and Google Fonts (Fraunces,
Caveat, JetBrains Mono).

## Files

| File | Role |
| --- | --- |
| `index.html`, `shell.css`, `shell.js` | Option and trip switchers, stop picker (previous/next, whole trip, list), Replay/Skip, reduced-motion toggle, optional Dark map switch, map key, “about this concept”, URL state. |
| `data.js` | Bundle loading, override resolution, leg/event/chain model, geometry helpers, clustering, icons. |
| `options/common.js` | MapLibre helpers shared by options 1, 3, 4, 5 (map creation without first-paint flash, camera fitting, input interruption, clustered HTML markers). |
| `options/01-globe.js` … `05-follow-cam.js` | One module per concept with the same interface: `mount(container, data, ctx)`, `showOverview()`, `selectEvent(id)`, `playLeg(id)`, `setReducedMotion(bool)`, `destroy()`, plus `skip()` and key swatches. |

## The five concepts

1. **Globe** — MapLibre globe over a warm, light basemap with atmosphere
   (night restyle with a starfield behind Dark map). The opening flies in
   from space while a comet traces the trip; each leg runs as a comet with a
   fading tail while the camera tilts and follows its heading. Photos are dots
   that bloom into blurred thumbnails as the comet passes; places are small
   stars.
2. **Transit map** — metro-map styling on the real map: bold cased lines in
   true geography with return legs side by side, stations for stops, dashed
   stations for TBD, mode bullets on lines, a vehicle token per leg while the
   camera holds still, photo counts on stations at trip scale and at their
   true groups in a city, places as interchange badges, a station card on
   arrival.
3. **Ink atlas** — a warm printed map. The pen draws each leg in a
   cartographic symbol (railway cross-ties, ferry stitches, gondola cable and
   cabins, dotted walks, dashed buses, pencilled TBD), arrivals are passport
   stamps that collect as you browse, photos are pinned polaroids and places
   are hand-lettered. Camera stays still with the current arrival timings.
4. **Space-time** — a story-time scrubber is the main control; a deck.gl
   space-time cube puts time on the vertical axis (stays rise as columns, legs
   climb as diagonals, photos float at their capture time and place). Choosing
   a stop collapses the cube onto the map and lands in the city.
5. **Follow-cam** — terrain, hillshade and 3D buildings on a light map (a
   night drive behind Dark map); a chase camera behind a vehicle icon for each
   mode, a split-flap departure board per leg, a letterbox during travel, and
   photo cards popping up at their capture points.

Each concept lists what it keeps and what it deliberately breaks under
**About this concept** (ⓘ) in the demo.

## Comparison

See [the comparison](COMPARISON.md) for the table, measured frame times and the
recommendation.
