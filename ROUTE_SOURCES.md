# Route research notes

Checked 9 September 2026. The traveler supplied the order of each day's legs,
but not the exact departures. Rail points therefore use the complete stop list
from a representative direct service for the stated route and day. They should
be checked against tickets or photo timestamps when those become available.

## Switzerland

- Swiss station sequences and coordinates: [transport.opendata.ch](https://transport.opendata.ch/), using timetable queries for the trip dates.
- Luzern–Engelberg and Luzern–Interlaken routing: [Zentralbahn](https://www.zentralbahn.ch/en/experience/leisure/luzern-interlaken-express).
- Lauterbrunnen–Grütschalp–Winteregg–Mürren: [Jungfrau Railways operating information](https://www.jungfrau.ch/en-gb/live/operating-info/).
- Pilatus circuit and the request-only Ämsigen cogwheel stop: [Pilatus 2026 timetable](https://cdn.pilatus.ch/content-media/documents/Pilatus_Fahrplan_2026.pdf).
- Day 4 was corrected on 9 September from traveler instructions: the bike route
  follows the shoreline through Horw, Hergiswil, Stansstad and Kehrsitenstrasse,
  ending at the [Kehrsiten-Bürgenstock landing](https://www.openstreetmap.org/node/415411498)
  (47.0030759, 8.3824029), without climbing to the resort. Existing traveler
  anchors were retained except for the incorrect final inland point; the old
  local override was backed up before correction. Bicycle-accessible OSM roads
  were routed through those anchors (maximum snap 30 m, no ambiguous snaps),
  simplified to 345 points, and reviewed over the basemap. This is a reviewed
  route reconstruction, not a recorded GPX. Distance is approximately 23.1 km.
- The same day's ferry goes directly across the lake to Luzern Bahnhofquai,
  with no intermediate calls. OSM ways
  [1355365321](https://www.openstreetmap.org/way/1355365321) and
  [117531916](https://www.openstreetmap.org/way/117531916), plus their connected
  approach to pier 3, provide the 33-point, approximately 7.9 km water route.
  [SGV's direct-service description](https://www.lakelucerne.ch/en/information/our-fleet/motor-vessel-buergenstock/)
  supports an approximate 30-minute crossing; this is not a confirmed ticket time.
  Both corrected legs use preserve entries in the journey route manifest so
  later network rebuilds cannot restore the inland endpoint or indirect ferry.

The Day 4 OSM export was retrieved from `https://overpass-api.de/api/interpreter`
on 9 September 2026. Query: `[out:json][timeout:60];(way[highway](46.973,8.298,47.055,8.389);nwr[amenity=ferry_terminal](46.98,8.30,47.06,8.40);way[route=ferry](46.98,8.30,47.06,8.40););out body;>;out skel qt;`.
Raw input is ignored in `build/route-inputs/luzern-shore-overpass.json`. The bike
filtered input is `build/route-inputs/luzern-bicycle-filtered.json`, now mapped
to the manifest’s bicycle network for explicit Studio replacement proposals.
The reviewed base route remains preserved during unattended builds. The bike
graph excludes motorways, steps, bicycle bans and private/no-access ways without
explicit bicycle permission; footways and pedestrian ways require bicycle
permission. This undirected reconstruction is for the historical map, not turn-by-turn navigation.

On 10 September 2026, the traveler revised five bike control points in Studio.
The local bicycle network was used to regenerate and accept the route through
all 29 current points. The reviewed override is 21.6 km (maximum snap 35 m),
with the Luzern start and Kehrsiten-Bürgenstock landing retained. The route
source and updated displayed distance were published together.

## Italy

- Fiumelatte–Varenna-Esino–Bellano Tartavalle Terme–Dervio station order: [Trenord R13 line](https://www.trenord.it/linee-e-orari/circolazione/le-nostre-linee/lecco-colico-sondrio/?code=R13).
- Day 10 (Saturday 22 August) ferry times and stopping patterns:
  [Navigazione Laghi's summer 2026 timetable](https://www.navigazionelaghi.it/wp-content/uploads/2026/06/Orari_Web-E26.pdf),
  valid 1 July–4 October. The photo timeline is consistent with fast service
  SR110, Como 12:15–Varenna 13:15, calling at Argegno, Lezzeno, Lenno,
  Tremezzo, Bellagio, and Menaggio; and direct run 809, Dervio
  17:17–Bellagio 17:50. These are the best timetable matches, not
  ticket-confirmed departures.
- Bellagio–Como bus corridor: [ASF Autolinee C30 timetable](https://www.asfautolinee.it/wp-content/uploads/pdf/estivo/C30.pdf).
- Bellagio–Como road geometry: a static route generated with the public
  [OSRM demo server](https://router.project-osrm.org/) on 6 September 2026 and
  simplified before being checked in. It follows the C30 shoreline corridor.

The map is a trip narrative, not a live journey planner. Timetables and stopping
patterns can change, and the selected train may have differed from the
representative service.

## Drawn geometry

Detailed train and ferry lines were generated from OpenStreetMap ways queried
through the Overpass API on 6 September 2026. Named stops remain separate and
are used for meaning and markers; the new geometry follows the connected rail
or ferry network between those stops. The checked-in output is static and can
be regenerated with `scripts/build-route-geometry.mjs` from reviewed Overpass
exports. Road, bicycle, walking, and gondola legs retain their existing reviewed
shaping points until equivalent source geometry is added, except for the
detailed Bellagio–Como shoreline bus geometry described above.

Day 10 received a separate ferry review on 7 September 2026. The Como–Varenna
line follows OpenStreetMap ferry relation
[`18734598`](https://www.openstreetmap.org/relation/18734598), whose member ways
encode the SR110/SR216 route through the six scheduled intermediate ports. It
was retrieved with an Overpass `route=ferry` query over bounding box
`45.75,8.95,46.15,9.40`. OpenStreetMap does not currently contain a route
relation for direct run 809, so Dervio–Bellagio deliberately uses the shortest
water path between the exact Navigazione Laghi terminals (OSM nodes
`854993236` and `271593582`) instead of borrowing unrelated ferry routes via
Bellano, Varenna, or Menaggio. The displayed distances are the reviewed
geometry lengths rounded to whole kilometres.

## Reproducibility requirements for future routes

For every generated route, record the mode, source/provider, profile or OSM tag
filter, retrieval date, bounding box, ordered waypoints, and any manual
correction in this file (or a journey-specific source note linked here). Keep
temporary Overpass/router payloads under ignored `build/route-inputs/`; commit
the query/provenance and reviewed static result.

`scripts/build-route-geometry.mjs` selects one journey with `--journey` and
reads its committed manifest from `content/route-sources/`. The current family
manifest records the retained rail/ferry provenance and the reviewed manual
exception for direct Dervio–Bellagio run 809. Network inputs remain ignored in
`build/route-inputs/`. The builder routes through ordered `stops` or `via`
points, warns on disconnected and near-tied components, keeps existing reviewed
geometry when a source is absent or unsafe, and writes a deterministically
ordered shared static asset. Its rail manifest retains the 65 m gap-weld limit.

Atlas Studio's `controlPoints` are durable human intent and its saved `geometry`
overrides the generated base line. Studio's loopback proposal service routes
through those anchors using only the local network extract mapped to the
segment's mode. It rejects ambiguous or overly distant snaps, retains the last
reviewed geometry on failure, and does not send precise journey coordinates to
an external router. See `JOURNEY_WORKFLOW.md` for the full train, ferry, road,
bicycle, GPX, review, and publishing flow.
