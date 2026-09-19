# Building detailed routes for any journey

Read this after [JOURNEY_WORKFLOW.md](JOURNEY_WORKFLOW.md), before publishing a
new itinerary. The Switzerland–Italy experience is the quality reference:
reviewed coordinates follow the transport network at close zoom. Adding
intermediate town pins or smoothing an endpoint line is not route construction.
This workflow applies to real journeys, demos and drafts through shared code.

## Choose evidence before drawing

1. Open the supplied route and try its supported GPX export. Preserve the
   original track and split it at the actual daily boundaries. Studio's GPX
   import supports review before saving; see the journey workflow.
2. If a track is unavailable, reconstruct a **candidate corridor** on the
   appropriate network. Record that it is inferred. Never describe it as the
   traveler's exact route or infer a booked service from the shape.
3. Use tickets, operator information and the user's known intermediate places
   to distinguish competing corridors. A scenic railway and a base tunnel,
   or coastal and inland cycling alternatives, can share endpoints.
4. Keep temporary endpoint guides explicitly provisional, but do not consider
   them a finished route deliverable. If source access fails, report it and
   continue the authorized reconstruction with its uncertainty visible.

| Mode | Geometry source | Required checks |
| --- | --- | --- |
| Train | OSM railway graph; or an OSM rail routing service | Stations, junctions, tunnels, reversals, conventional/high-speed choice |
| Bicycle / walk | GPX first; otherwise a bicycle/walking router such as BRouter | Profile, road access, surface, climbs, busy roads, campsite entrances |
| Bus / car | OSM road router such as OSRM | Road corridor, mountain crossing, terminal uncertainty; car routing does not verify a coach itinerary |
| Ferry | Verified sailing track or reviewed water corridor | Ports, navigable water and route evidence; never use a road route |

## Establish endpoints and meaningful anchors

Keep stable day, place and segment IDs. Use station coordinates for rail
endpoints. Keep a campsite separate from its nearby destination town until
the overnight and entrance are settled. Never invent a connection to hide a
gap. Unknown traveler origins stay undrawn.

Places and object-form `stops`/`via` use named `lat` and `lng` properties.
Geometry uses **`[longitude, latitude]`**. Keep known passenger stops separate
from shaping anchors. `stops` takes precedence over `via` in the local builder;
even an empty stops array masks via. Do not create fictitious stops to steer
the route or enlarge distances to match an estimate.

## Obtain full network geometry

For local railway extracts, follow [TRAIN_ROUTE_WORKFLOW.md](TRAIN_ROUTE_WORKFLOW.md).
It describes Overpass queries, complete ways/nodes, manifests, snapping, strict
generation, and Studio proposals. Small reviewed corridor extracts are preferable
to repeatedly retrying an oversized request. Respect service limits and failed
access; an unavailable Overpass export can be replaced by a documented router
response. Do not turn an HTML error page into a geometry input.

For public routers, retain the exact URL, profile, ordered request coordinates,
retrieval date, provider and any available dataset date in the journey manifest.
Save raw JSON under ignored `build/route-inputs/<journey-id>/`. Typical requests:

```text
BRouter:
https://brouter.de/brouter?lonlats=LON,LAT|LON,LAT&profile=trekking&alternativeidx=0&format=geojson

OSRM road:
https://routing.openstreetmap.de/routed-car/route/v1/driving/LON,LAT;LON,LAT?overview=full&geometries=geojson&steps=false

OpenRailRouting:
https://routing.openrailrouting.org/route?point=LAT,LON&point=LAT,LON&profile=non_tgv&points_encoded=false&instructions=false&details=railway_class&details=road_environment&way_point_max_distance=0
```

These are templates, not executable coordinates. URL-encode parameter values
and use `curl --fail-with-body --show-error --location --max-time 60` with an
output file. OpenRailRouting's `/info` lists current profiles and data dates;
check them rather than relying on obsolete examples. Its September 2026
profiles include `non_tgv` and `tgv_all`. Profile names alone do not establish
the actual corridor or train service. Constrain and inspect the path.
Sources: [BRouter](https://github.com/abrensch/brouter),
[OSRM API](https://project-osrm.org/docs/v5.24.0/api/),
[OpenRailRouting](https://github.com/geofabrik/OpenRailRouting).

## Normalize, measure and preserve

Reject provider errors and non-LineString results. Extract the single chosen
route from `features[0].geometry.coordinates` (BRouter),
`routes[0].geometry.coordinates` (OSRM), or
`paths[0].points.coordinates` (OpenRailRouting). Inspect alternatives before
choosing one; never concatenate alternatives. BRouter may include elevation
as a third coordinate: retain `[lon, lat]` only in atlas geometry. Validate
finite values, longitude/latitude bounds, and at least two distinct vertices.
Remove consecutive duplicates, not meaningful reversals.

Use `simplify` and `haversine` from `scripts/route-geometry-lib.mjs` rather than
inventing a smoothing algorithm. A starting simplification tolerance of
`0.00003` is approximately 3 m; reduce it if close curves lose their shape.
Round to five decimal places and deduplicate again. Keep the provider's snapped
endpoints: do not pull them to an off-network city-centre pin. Check endpoint
offsets explicitly (start with a 250 m review threshold).

Measure the raw and simplified lines. Compare their lengths, largest consecutive
vertex gaps, endpoint offsets and waypoint order. A long straight tunnel section
can be legitimate; verify its railway/tunnel metadata rather than inserting
fake points. Many points alone do not demonstrate accuracy. Keep planned
distances in the story separately from measured reconstruction distances.

Save the result as a segment-ID-to-coordinate-array object in
`content/route-geometry/<id>.json` (drafts use
`build/draft-assets/<id>/routes.json`). For imported reviewed router output,
add each segment to the routing manifest with `strategy: "preserve"` and
`provenance` recording the exact request, profile, simplification tolerance,
raw/output counts, measured length and review limitations. The
[Florence–Genoa manifest](content/route-sources/florence-genoa.json) is a worked
bicycle example. Its [earlier multimodal version](https://github.com/gravelcycles/travels/blob/5e3cf48afe57c530109f7c5dcfef6136a33480c1/content/route-sources/florence-genoa.json)
also demonstrates rail and road responses; those arrival legs were removed from
the itinerary at the owner’s request on 20 September 2026.

Preserve entries protect static geometry during unattended generation. They
do not provide a local routing network: Studio needs a separately prepared
mode network before it can offer a new network proposal. Deliberate proposals
are allowed when that input exists. Saved static routes work offline from the
router and require no external API requests in the viewer.

## Review the published representation

1. Check precedence: saved route override, inline segment geometry, generated
   geometry, then the provisional fallback. Review the layer actually shown.
2. Build and open the shared journey page locally with `?photoSource=local`.
   Inspect every day and arrival group, overview and close zoom, on desktop
   and phone. Check stations, tunnel entrances, sharp bends and overnight gaps.
3. Confirm normal route inspection and Replay use the same coordinates. Check
   that different travelers' arrival routes remain separate and shared legs
   stay shared. Compare the Switzerland reference without copying its data.
4. Only clear `geometryStatus: "provisional"` after geometric review. Explain
   inferred alignment and unsettled bookings separately in source/day copy;
   reviewed geometry is not a verified ticket or safe-navigation guarantee.
5. Reconcile displayed distance fields. Do not let a measured route silently
   inherit an unrelated itinerary estimate. Add a concise mismatch note where
   endpoints, campsites or the original route still need clarification.
6. Run `npm run routes:build -- --journey <id> --strict`, `npm test`, and
   `npm run build`. Inspect all warnings and the diff. Add content regression
   checks when they protect against losing the reviewed geometry.
7. Update trip source notes, this workflow if the process changes, and the
   feature inventory. Include generated output, follow the owner's deployment
   preference, verify Pages and fetch a fresh public page and geometry bundle.

Do not silently replace a failed reconstruction with a straight line. Preserve
reviewed work and say precisely which alignment questions remain.
