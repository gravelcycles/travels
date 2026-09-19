# Florence to Genoa — itinerary and route reconstruction

Intake and source checks: 19 September 2026. Journey ID `florence-genoa`, public
page `florence-genoa.html`. This is a planning record, not a verified navigation
route or a statement that accommodation is booked. Built with the normal
new-journey creator and shared template; no application code was copied.

## Cycling-only calendar

On 20 September 2026 the owner removed the arrival day and all train/bus legs.
The public journey now contains only the six riding days, Sunday 10 May through
Friday 15 May 2026, displayed as Days 1–6. Existing riding IDs `florence-genoa-d2`
through `florence-genoa-d7` remain stable; dates and bicycle geometry are unchanged.
The year remains inferred from the original Saturday 9 May intake.

Arrival-only places, route-group filters and the Saturday meetup are removed.
The nine travelers remain in the source roster. The earlier arrival research
and geometry remain available in Git history; do not reintroduce them into the
public journey unless the owner asks.

## Revised cycling itinerary

The second table in the user’s message takes precedence over the first.
Distances are the supplied plan, not measurements of rendered geometry.

| Date | Destination | Planned distance | Proposed overnight |
| --- | --- | --- | --- |
| Sun 10 May | Fucecchio | 66 km; 11 km offroad | Toscana Village Srl |
| Mon 11 May | Lucca | 46 km | Agricampeggio La Valle |
| Tue 12 May | Massa coast | 54 km | Camping Lilly Pineta |
| Wed 13 May | Mattarana | 74 km | Camping Oasi; location mismatch unresolved |
| Thu 14 May | Sestri Levante | 62 km | Camping Mare Monti |
| Fri 15 May | Genoa | 62–72 km | Airbnb; private address retained locally |

The original six riding days total **364–374 km**. Keep this range in the
stories and planning tags. Numeric segment distances now measure the network
reconstruction of the six cycling stages. The summary shows **300 km**; the
reconstructed cycling total is **300.0 km**, excluding campsite approaches and
other detours.
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

All six cycling lines follow OpenStreetMap road and path geometry.
The procedure is [ROUTE_GEOMETRY_WORKFLOW.md](../ROUTE_GEOMETRY_WORKFLOW.md).
The [manifest](../content/route-sources/florence-genoa.json) retains exact request
URLs, profiles, retrieval date, raw response SHA-256, counts, length and endpoint
checks. Reviewed static output is in
[the journey geometry](../content/route-geometry/florence-genoa.json); each entry
uses `strategy: preserve`. No local network extract is claimed, so Studio needs
one before it can create a replacement network proposal. Normal builds and the
viewer do not call any routing service.

| Segment | Provider/profile | Reconstructed km | Retained vertices |
| --- | --- | ---: | ---: |
| Florence → Fucecchio | BRouter / trekking | 48.2 | 502 |
| Fucecchio → Lucca | BRouter / trekking | 34.6 | 310 |
| Lucca → Marina di Massa | BRouter / trekking | 48.8 | 492 |
| Marina di Massa → Mattarana | BRouter / trekking | 60.8 | 611 |
| Mattarana → Sestri Levante | BRouter / trekking | 25.8 | 461 |
| Sestri Levante → Genoa | BRouter / trekking | 81.8 | 1,293 |

Sources and corridor choices:

- [BRouter trekking](https://github.com/abrensch/brouter) supplies the six
  town-to-town bicycle candidates. Friday runs inland via the Lavagna valley,
  Cicagna and the hills east of Genoa. Thursday's 25.8 km and Friday's 81.8 km
  differ materially from the plan; the stories say so. They have not been
  extended or shortened artificially to reproduce the supplied estimates.
  The returned road metadata contains cycleways, residential roads, paths and
  primary/secondary roads. No motorway/trunk sections were found; that does
  not verify surfaces, bike access, offroad totals or riding suitability.

The Florence starting pin retains its existing SMN-area coordinates. Router
endpoints stay snapped to the network; the largest place-to-route offset for
the six bicycle legs is 31 m. These stages connect destination towns, not
unresolved campsites. No campsite approach or private Airbnb location has been
invented. Northern arrival pins and the arrival-night Florence campsite are
excluded from the public map.

Simplification uses the shared library at `0.00003` (about 3 m), then rounds to
five decimal places and removes consecutive duplicates. All simplified lines
retain more than 99.5% of raw measured length. Raw responses are kept in ignored
`build/route-inputs/florence-genoa/`.

These are **reviewed geometric reconstructions**, not the original GPX. Clearing
provisional endpoint status means the map now has network geometry; uncertainty
remains explicit in source and story copy.

## Campsite sources and conflicting pins

The owner’s coordinates are preserved in the day stories, in latitude/longitude
order. JSON place coordinates are explicitly named `lat` and `lng`.
These suggested overnights and the river/forest alternatives have no confirmed
booking, permission, availability or suitability status.

| Place | Supplied planning pin (latitude, longitude) | Review |
| --- | --- | --- |
| Toscana Village | 43.678487, 10.767459 | Owner’s linked Maps pin is 43.676046, 10.752759. [Official directions](https://www.toscanavillage.com/about/where-we-are/) locate the site in Montopoli and warn that GPS approaches can be wrong; resolve before routing |
| La Valle | 43.829140, 10.425546 | Retained as supplied; [official website](https://www.agricampeggiolavalle.it/) |
| Lilly Pineta | 44.028501, 10.077718 | Owner’s linked Maps pin is 44.025105, 10.077470; [official website](https://www.lillypineta.com/) places it in Marina di Massa |
| Oasi | 44.264809, 9.505556 | [Official coordinates](https://www.campeggiooasi.it/en/dove-siamo) are 44.258050, 9.493494 at Passo delle Campane, Castiglione Chiavarese; this is not Mattarana. Wednesday remains anchored to Mattarana until resolved |
| Mare Monti | 44.263141, 9.442277 | Close to the [official map coordinates](https://campingmaremonti.com/it/map/); retain supplied pin as provisional |

The private Airbnb street address is not a public marker. Campsite research
supports identity/location only, not suitability, a booking or route accuracy.

## Next intake

1. A working route share link or GPX; split the reviewed track into the six
   stage IDs without replacing the traveler's alignment with a guessed router.
2. Resolve Mattarana versus Oasi, then verify the Thursday 62 km stage and all
   campsite access pins.
3. Confirm final overnights and the Genoa route choice; then add actual photos
   through the normal private-photo workflow.

## Validation

Strict route generation preserves all six cycling routes with zero warnings.
Content regression checks protect complete geometry, endpoints, measured lengths,
stable riding IDs/dates and the absence of arrival routes/groups. The full test
suite and deterministic public build run before deployment. The initial route
review covered all cycling stages and phone layout; the cycling-only revision
checks the six-day overview, Sunday Day 1, 300 km summary and bicycle-only Replay.
No shared viewer code or other journey geometry changes.
