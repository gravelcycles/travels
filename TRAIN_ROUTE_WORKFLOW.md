# Reproducing rail-aligned train routes

Use this guide when adding train legs to a new trip. It documents the current
implementation, checked on 9 September 2026. Read [JOURNEY_WORKFLOW.md](JOURNEY_WORKFLOW.md)
for trip creation and publishing, and [ROUTE_SOURCES.md](ROUTE_SOURCES.md) for
the existing trip's evidence. Commands here are for agents to run.

## Why the lines follow the rails

The detailed line comes from **OpenStreetMap railway ways**, routed through the
trip's ordered stations. Station-to-station straight lines and cosmetic curve
smoothing cannot reproduce this. The browser displays reviewed, static
coordinates over MapLibre's OpenFreeMap Liberty basemap; it does not ask a live
train router for directions.

The pipeline is: establish the service and stations → download the railway
network → find paths through the stations → simplify and visually review →
save journey geometry → build the static site.

This reconstructs the physical corridor. It does not prove which departure,
platform, parallel track, or historical diversion the traveler used. The family
trip uses representative stop lists where exact departures are unknown. Keep
that distinction in the provenance; visual alignment cannot confirm a service.

## 1. Establish the itinerary and coordinates

Create stable places and train segment IDs in
`content/journeys/<journey-id>.json` (or `content/drafts/<journey-id>.json` for
an unpublished draft). Set `mode: "train"`, connect `from` and `to` place IDs,
and put each segment in its day's ordered `segmentIds`.

Research tickets, operator timetables, or representative service stop lists.
Record source URLs, travel date, stop order, service identity when known,
and uncertainty in `ROUTE_SOURCES.md` or a journey-specific note linked from it.
The existing Swiss research used transport.opendata.ch; see the source notes
for operator references. Do not infer a corridor solely from endpoint cities:
scenic lines and base tunnels can serve the same cities.

Use station coordinates for rail endpoints, rather than city centers. Store
intermediate named stations as objects with `name`, `lat`, and `lng` properties.
Keep meaningful passenger stops separate from the dense track geometry.

| Field | Coordinate convention |
| --- | --- |
| Places and object-form `stops`/`via` | Explicit `lat` and `lng` properties |
| Legacy array-form `stops`/`via` | **`[lat, lng]`**, reversed by the builder |
| Generated `geometry` and Studio `controlPoints` | **`[lng, lat]`** |

The CLI takes endpoints plus **`segment.stops || segment.via || []`**. It does
not combine both lists; even an empty `stops: []` masks `via`. Prefer object-form
points and one deliberate waypoint list. For shaping anchors that are not
passenger stops, use Studio control points and accept its network proposal,
or a reviewed `via` list on a segment without `stops`. Do not invent named
stops merely to steer a line.

## 2. Retrieve the railway geometry

Save the exact Overpass query, endpoint, retrieval date, tag filter, and numeric
bounds in the manifest/source notes. Keep raw payloads in ignored
`build/route-inputs/<journey-id>/`. The builder reads local exports; it does
not fetch them automatically.

This is a starting query template for ordinary rail. Replace the bounds with
numbers in **south, west, north, east** order, covering the whole corridor,
including intermediate stops and detours:

```overpass
[out:json][timeout:180];
way["railway"="rail"](SOUTH,WEST,NORTH,EAST);
out body;
>;
out skel qt;
```

Adapt the tag filter to the actual system. Inspect mountain/narrow-gauge lines
and underground or tunnel sections rather than assuming one tag covers every
needed way. The graph needs `way.nodes` IDs and corresponding `node.lon` and
`node.lat` records. Station nodes alone, relation metadata alone, or way
geometry without child-node records are insufficient.

After creating the input directory and saving the substituted query there as
`rail-query.overpass`, download it with:

```sh
curl --fail-with-body --show-error \
  --data-urlencode 'data@build/route-inputs/my-trip/rail-query.overpass' \
  https://overpass-api.de/api/interpreter \
  --output build/route-inputs/my-trip/rail-overpass.json
```

Check for valid JSON with an `elements` array containing ways and nodes, and
inspect any `remark` for timeout/incomplete-export errors. Expand the corridor
or use separate reviewed extracts if necessary. If merging extracts, deduplicate
by element type and ID and retain all query provenance.

**The graph includes every way in the input and makes edges bidirectional.**
It does not filter railway tags or enforce gauge, service patterns, direction,
or relation membership. Prepare a suitable rail-only export. Where alternate
branches remain possible, constrain the route using evidence and anchors.
A shortest path is not automatically the intended train route.

## 3. Add the journey manifest

Published journeys use `content/route-sources/<journey-id>.json`; drafts use
`build/draft-assets/<journey-id>/route-sources.json`. This illustrative manifest
shows the structure; replace IDs and provenance placeholders before using it:

```json
{
  "schemaVersion": 1,
  "journeyId": "my-trip",
  "modeNetworks": { "train": "rail" },
  "networks": {
    "rail": {
      "input": "build/route-inputs/my-trip/rail-overpass.json",
      "weldGapsKm": 0,
      "maxSnapKm": 0.25,
      "ambiguityKm": 0.05,
      "simplifyTolerance": 0.00008,
      "provenance": {
        "provider": "OpenStreetMap via Overpass API",
        "retrievedAt": "YYYY-MM-DD",
        "query": "PASTE THE EXACT EXECUTED QUERY HERE",
        "bounds": "SOUTH,WEST,NORTH,EAST",
        "notes": "Record service evidence, endpoint URL, and corrections."
      }
    }
  },
  "segments": {
    "my-trip-station-a-station-b": { "network": "rail" }
  }
}
```

List **every train segment to generate** in `segments`. `modeNetworks` supplies
Studio's mode lookup; it does not make the CLI process unlisted segments.
The CLI allows per-segment `maxSnapKm`, `ambiguityKm`, and `simplifyTolerance`.

- The existing family rail manifest uses `weldGapsKm: 0.065` (65 m),
  `maxSnapKm: 4`, `ambiguityKm: 0.05`, and `simplifyTolerance: 0.00008`.
  These are historical settings, not evidence that a 4 km snap is acceptable.
- The example starts with no welding and a tighter 250 m maximum snap. Adjust
  after inspecting station coordinates and the network. Large snaps can select
  the wrong railway and create visible endpoint diagonals.
- Gap welding connects nearby degree-one graph endpoints. Enable a small,
  documented allowance only for inspected mapping gaps; proximity can also join
  unrelated tracks. Do not increase it until routing happens to succeed.
- Simplification uses latitude-scaled angular distance, not meters;
  `0.00008` is roughly 9 m. Output is rounded to five decimal places. Lower
  the tolerance if close-zoom curves lose too much shape.

See the [family manifest](content/route-sources/switzerland-italy-family-2026.json)
for a working reference. Its original September 6 rail query and exact bounds
were **not retained**. Do not claim that original download is fully reproducible.
For new trips, retain the exact query inline even though raw inputs are ignored.
A later OSM download may differ, so preserve reviewed static output too.

## 4. Generate and inspect diagnostics

From the repository root, replacing `my-trip`:

```sh
npm run routes:build -- --journey my-trip --strict
```

The builder snaps each consecutive waypoint pair to a shared connected
component, computes a shortest path using distance-weighted A*, concatenates
the legs, simplifies, and rounds coordinates. It replaces the first and last
coordinates with the original place endpoints, so inaccurate endpoint places
can pull the line away from the railway.

It logs raw node count, output point count, and maximum snap distance per segment.
Missing sources or failed routing retain existing geometry. Near-tied alternative
components produce warnings. **Without `--strict`, an ambiguous candidate can
still be written.** With `--strict`, any warning prevents the route output write
and subsequent site build. Inspect all warnings and snap distances. Ambiguity
detection does not identify every wrong branch within a connected component.

Default outputs:

| Journey | Geometry JSON | Manifest JSON |
| --- | --- | --- |
| Published | `content/route-geometry/<id>.json` | `content/route-sources/<id>.json` |
| Draft | `build/draft-assets/<id>/routes.json` | `build/draft-assets/<id>/route-sources.json` |

Geometry files map segment IDs directly to arrays of `[lng, lat]` pairs. Only
manifest-listed IDs are processed; existing other entries remain. Normal route
builds also invoke the site build, producing `dist/assets/route-geometry.js`
for published routes. Draft geometry is available through Studio preview and
stays out of public assets.

For an isolated candidate, first copy the current journey geometry JSON to an
ignored candidate file, then add
`--output build/route-inputs/my-trip/candidate.json` to the command. An explicit
output skips the site build. Seeding that file preserves existing geometry for
preserve entries or failed legs. Review and copy the approved JSON to the normal
journey geometry path before running `npm run build`.

## 5. Review the line the browser actually uses

Run `npm run studio`, open `http://127.0.0.1:4173/studio/`, select the trip, and
use its preview. Check every train leg at close zoom, especially station
approaches, junctions, tunnels, mountain curves, reversals, and return legs.
Confirm stop order and compare the corridor with service evidence. Do not
replace a legitimate tunnel route with the visible surface railway.

Viewer precedence is:

1. Saved route override `geometry`, applied to the segment at load time.
2. Inline `segment.geometry` in the journey source.
3. Generated geometry for the segment ID.
4. Endpoint/intermediate-point fallback, which is only an approximate guide.

If regenerating seems to change nothing, check the first two layers and rebuild
the bundles before changing the algorithm. Preserve human edits. Published
overrides live in `content/route-overrides.json`; draft overrides live in
`build/studio-draft-overrides.json`.

Studio's **Propose network route** routes through durable `[lng, lat]` control
points using the local manifest network. Accept the reviewed proposal and save
it; moving anchors alone does not replace saved geometry. The CLI does not
consume Studio control points.

If a route must remain a reviewed exception, store its geometry in the journey
geometry JSON and use `strategy: "preserve"` for that segment in the manifest,
with a `provenance` object explaining the reason and evidence. Preserve without
existing geometry warns; Studio also refuses network proposals for preserve
entries. Never hide a failed reconstruction behind an unlabelled straight line.

Before handing off a new route:

- Check overview, day close-up, route inspection, and Replay on desktop/mobile.
- Confirm every intended train leg has reviewed detailed geometry, and that
  the selected override/base line is the one reviewed. Resolve provisional
  status after review; generation alone does not clear it.
- Check displayed distance/duration separately: the CLI does not update those
  journey fields from the generated line.
- Run `npm run routes:test` and `npm run build`, then inspect the diff for
  unintended changes to other routes or human overrides.
- Retain evidence, exact queries and parameters, review notes, manifests,
  reviewed JSON, and generated assets required by the normal build flow.
  Keep raw exports ignored. Follow the journey workflow for publication and
  stop temporary local servers after review.

## Code references

- [scripts/build-route-geometry.mjs](scripts/build-route-geometry.mjs): manifest,
  waypoint precedence, output paths, preservation, and strict mode.
- [scripts/route-geometry-lib.mjs](scripts/route-geometry-lib.mjs): graph, gap
  welding, snapping, A* search, simplification, and rounding.
- [scripts/studio-route-service.mjs](scripts/studio-route-service.mjs): proposals
  through control points and rejection of unsafe/ambiguous results.
- [dist/assets/app.js](dist/assets/app.js): override application and
  `segmentCoordinates()` rendering precedence.
- [test/route-geometry.test.mjs](test/route-geometry.test.mjs): disconnected,
  ambiguous, ordered-stop, and missing-input fixtures.
