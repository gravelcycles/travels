# Florence to Genoa — itinerary and route reconstruction

Intake and source checks: 19 September 2026. Journey ID `florence-genoa`, public
page `florence-genoa.html`. This is a planning record, not a verified navigation
route or a statement that accommodation is booked. Built with the normal
new-journey creator and shared template; no application code was copied.

## Calendar and arrivals

The owner supplied Saturday 9 May; the year is inferred as 2026, when 9 May is
a Saturday, consistent with the May 2026 links in the intake. Seven days run
through Friday 15 May. Preserve day IDs when correcting dates.

| Arrival party | Supplied sequence | Mode |
| --- | --- | --- |
| Marc, Anna | Berlin → Florence | FlixBus |
| Mo, Paula | Hamburg → Freiburg im Breisgau → Milan → Florence | Train, bus, train |
| Qen, Jonas, David, Michelle | Lucerne → Milan → Florence | Train throughout, explicitly clarified by owner |
| Kawan | Origin unknown → Lucerne, then with the Lucerne group | Train throughout, explicitly clarified by owner |

Four route groups share the normal roster/filter implementation. Lucerne–Milan
is one leg shared by the Lucerne party and Kawan. Milan–Florence is one shared
leg for seven people, described as non-Frecciarossa. No exact service, transfer
station, timetable or category such as Regionale/Intercity has been invented.
Kawan’s unknown origin means the preceding train leg is prose only for now.
All arrivals are attached to Saturday; actual departure days may be earlier.
The Florence meetup is at city level until a meeting point/time is supplied.

## Revised cycling itinerary

The second table in the user’s message takes precedence over the first.
Distances are the supplied plan, not measurements of rendered geometry.

| Date | Destination | Planned distance | Proposed overnight |
| --- | --- | --- | --- |
| Sat 9 May | Florence | Arrival travel unmeasured | Camping Village Internazionale Firenze |
| Sun 10 May | Fucecchio | 66 km; 11 km offroad | Toscana Village Srl |
| Mon 11 May | Lucca | 46 km | Agricampeggio La Valle |
| Tue 12 May | Massa coast | 54 km | Camping Lilly Pineta |
| Wed 13 May | Mattarana | 74 km | Camping Oasi; location mismatch unresolved |
| Thu 14 May | Sestri Levante | 62 km | Camping Mare Monti |
| Fri 15 May | Genoa | 62–72 km | Airbnb; private address retained locally |

The original six riding days total **364–374 km**. Keep this range in the
stories and planning tags. Numeric segment distances now measure the network
reconstruction, including arrival legs; the shared summary labels the sum as
“all routes combined” and recalculates for the selected party. The reconstructed
cycling total is **300.0 km**, excluding campsite approaches and other detours.
This is a different, explicitly inferred alignment, not a correction of the
traveler’s track or evidence that the original distances were wrong.

Original estimates were 51.7 / 50.3 / 49.3 / 49.5 / 49.3 / 49.4 km, ending
Tuesday in Marina di Carrara and Thursday in Pian dei Manzi. These were
superseded; retain them here to explain the source discrepancy. The old claim
of a Genoa rest day immediately after Wednesday also conflicts with the revised
plan; no unrequested rest day has been added. The Thursday Komoot suggestion
may belong to the earlier Pian dei Manzi route, so its unpaved-road note remains
explicitly unverified for the new stage.

## Geometry and source access

- [cycle.travel journey 973616](https://cycle.travel/map/journey/973616):
  both the web reader and an ordinary browser were tried. Browser showed
  “Page not found”.
- [Komoot tour 2945248838](https://www.komoot.com/tour/2945248838): the full
  owner-supplied share link was also tried in an ordinary browser and showed
  a 404 page. The full token-bearing link is kept only in local intake notes.
- [Earlier Thursday suggestion](https://www.komoot.com/smarttour/28477474):
  recorded as a source reference, not imported or verified.
- [Camping discovery reference](https://www.greatlittlecampsites.co.uk/italy/tuscany/):
  supplied by the owner; no new campsite recommendation inferred.

All eleven lines now follow mode-appropriate OpenStreetMap network geometry.
The procedure is [ROUTE_GEOMETRY_WORKFLOW.md](../ROUTE_GEOMETRY_WORKFLOW.md),
with the existing [train guide](../TRAIN_ROUTE_WORKFLOW.md) for local extracts.
The [manifest](../content/route-sources/florence-genoa.json) retains exact request
URLs, profiles, retrieval date, raw response SHA-256, counts, length and endpoint
checks. Reviewed static output is in
[the journey geometry](../content/route-geometry/florence-genoa.json); each entry
uses `strategy: preserve`. No local network extract is claimed, so Studio needs
one before it can create a replacement network proposal. Normal builds and the
viewer do not call any routing service.

| Segment | Provider/profile | Reconstructed km | Retained vertices |
| --- | --- | ---: | ---: |
| Berlin → Florence | OSRM / driving | 1,218.6 | 4,561 |
| Hamburg → Freiburg | OpenRailRouting / tgv_all | 785.8 | 1,669 |
| Freiburg → Milan | OSRM / driving | 430.3 | 2,369 |
| Lucerne → Milan | OpenRailRouting / non_tgv | 236.6 | 835 |
| Milan → Florence | OpenRailRouting / non_tgv | 314.9 | 626 |
| Florence → Fucecchio | BRouter / trekking | 48.2 | 502 |
| Fucecchio → Lucca | BRouter / trekking | 34.6 | 310 |
| Lucca → Marina di Massa | BRouter / trekking | 48.8 | 492 |
| Marina di Massa → Mattarana | BRouter / trekking | 60.8 | 611 |
| Mattarana → Sestri Levante | BRouter / trekking | 25.8 | 461 |
| Sestri Levante → Genoa | BRouter / trekking | 81.8 | 1,293 |

Sources and corridor choices:

- [OpenRailRouting](https://github.com/geofabrik/OpenRailRouting) returns railway
  geometry, including tunnels. The service's `/info` reports OSM data dated
  10 September 2026 and engine version 11.0. All returned railway classes are
  `rail`. Hamburg–Freiburg is constrained through Hannover, Kassel-Wilhelmshöhe,
  Frankfurt Hbf, Mannheim and Karlsruhe. These are representative geometric
  anchors, not a confirmed list of passenger stops.
- Lucerne–Milan is constrained through Arth-Goldau, Bellinzona, Lugano and
  Chiasso. It uses the Gotthard and Ceneri base corridors; long underground
  edges have tunnel metadata. This is consistent with the
  [SBB corridor description](https://mailing.sbb.ch/images1/Press/Dokumente/200826_Faktenblatt_Region%20Mitte.pdf),
  not proof of the party's departure or exact track/platform.
- Milan–Florence goes through Piacenza, Parma, Bologna and Prato on the
  representative conventional corridor. The Prato approach preserves the
  non-Frecciarossa planning intent. Compare
  [Trenitalia's Intercity corridor](https://www.trenitalia.com/it/intercity/collegamenti/raggiungi-la-sicilia-in-treno.html).
  Florence SMN is the map anchor; exact services may use Rifredi or require a
  local connection. No direct train or particular service has been asserted.
- [OSRM road routing](https://project-osrm.org/docs/v5.24.0/api/) supplies the
  illustrative coach corridors: Berlin via Munich/Innsbruck/Brenner to Florence,
  and Freiburg via Basel/Gotthard to Milan. A driving profile cannot establish
  a coach's exact path, permitted terminal approach or stops. Station-area
  endpoints are map anchors; terminals and transfers remain open.
- [BRouter trekking](https://github.com/abrensch/brouter) supplies the six
  town-to-town bicycle candidates. Friday runs inland via the Lavagna valley,
  Cicagna and the hills east of Genoa. Thursday's 25.8 km and Friday's 81.8 km
  differ materially from the plan; the stories say so. They have not been
  extended or shortened artificially to reproduce the supplied estimates.
  The returned road metadata contains cycleways, residential roads, paths and
  primary/secondary roads. No motorway/trunk sections were found; that does
  not verify surfaces, bike access, offroad totals or riding suitability.

Hamburg, Freiburg, Lucerne, Milan and Florence place pins now use main-station
coordinates. Router endpoints remain snapped to their network; the largest
place-to-route offset is 74 m. The cycling stages connect destination towns,
not unresolved campsites. Fucecchio and Mattarana retain their intake positions.
The map does not add fictitious campsite links or a route from Kawan's unknown
origin. The private Airbnb address remains excluded.

Simplification uses the shared library at `0.00003` (about 3 m), then rounds to
five decimal places and removes consecutive duplicates. All simplified lines
retain more than 99.5% of raw measured length. Long sparse rail sections were
checked against tunnel metadata: the largest Swiss edge is 14.68 km underground;
the largest Bologna–Prato edge is 9.53 km underground. The raw responses are kept
in ignored `build/route-inputs/florence-genoa/`. Overpass requests failed, so the
successful rail router responses are the evidence actually used.

These are **reviewed geometric reconstructions**, not the original GPX or
verified travel services. Clearing provisional endpoint status means the map
now has network geometry; uncertainty remains explicit in source and story copy.

## Campsite sources and conflicting pins

The owner’s coordinates are preserved in the day stories, in latitude/longitude
order. JSON place coordinates are explicitly named `lat` and `lng`.
These suggested overnights and the river/forest alternatives have no confirmed
booking, permission, availability or suitability status.

| Place | Supplied planning pin (latitude, longitude) | Review |
| --- | --- | --- |
| Internazionale Firenze | None | Approximate pin 43.724715, 11.218994 from [Pleinair](https://www.pleinair.it/dove-sostare/campeggi/camping-internazionale-firenze-1000009391/); the [original website](https://www.campinginternazionalefirenze.com/) now redirects to [hu Firenze Certosa](https://firenzecertosa.huopenair.com/) |
| Toscana Village | 43.678487, 10.767459 | Owner’s linked Maps pin is 43.676046, 10.752759. [Official directions](https://www.toscanavillage.com/about/where-we-are/) locate the site in Montopoli and warn that GPS approaches can be wrong; resolve before routing |
| La Valle | 43.829140, 10.425546 | Retained as supplied; [official website](https://www.agricampeggiolavalle.it/) |
| Lilly Pineta | 44.028501, 10.077718 | Owner’s linked Maps pin is 44.025105, 10.077470; [official website](https://www.lillypineta.com/) places it in Marina di Massa |
| Oasi | 44.264809, 9.505556 | [Official coordinates](https://www.campeggiooasi.it/en/dove-siamo) are 44.258050, 9.493494 at Passo delle Campane, Castiglione Chiavarese; this is not Mattarana. Day 5 remains anchored to Mattarana until resolved |
| Mare Monti | 44.263141, 9.442277 | Close to the [official map coordinates](https://campingmaremonti.com/it/map/); retain supplied pin as provisional |

The private Airbnb street address is not a public marker. Campsite research
supports identity/location only, not suitability, a booking or route accuracy.

## Next intake

1. A working route share link or GPX; split the reviewed track into the six
   stage IDs without replacing the traveler’s alignment with a guessed router.
2. Kawan’s origin and any previous-day arrival travel; exact trains/buses and
   station/terminal choices where known.
3. Resolve Mattarana versus Oasi, then verify the Thursday 62 km stage and all
   campsite access pins. Confirm whether the suggested non-Frecciarossa train
   requires transfers.
4. Confirm final overnights and the Genoa route choice; then add actual photos
   through the normal private-photo workflow.

## Validation

Strict route generation preserves all eleven routes with zero warnings.
Content regression checks protect complete geometry, station endpoints,
measured lengths, representative rail anchors and the six shared cycling legs.
The full test suite and deterministic public build are run before deployment.
Browser review covers all six cycling days, all five arrival legs, close road
bends, rail corridors, tunnel metadata, group filtering and phone layout. No shared
viewer code or other journey geometry is changed.
