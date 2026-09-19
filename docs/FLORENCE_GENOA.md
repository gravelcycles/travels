# Florence to Genoa — initial itinerary

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

The six riding days total **364–374 km**. Existing numeric distance fields hold
Friday’s lower estimate, 62 km, so atlas summaries show 364 km. The subtitle,
trip note and Friday story explain that this excludes unmeasured arrivals.
Do not replace the range with a purported measured distance.

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

Every leg has `geometryStatus: provisional` and a source note. Lines are the
existing shared viewer’s straight endpoint guides between approximate town
centres. They do **not** follow road/rail networks and must be replaced with
reviewed geometry before use as route evidence. No invented via points, GPX,
elevation, travel time, photo, or private location pin has been added.
The empty per-journey routing manifest keeps Studio’s missing-input explanation
honest. No family-trip routing assets or photo manifests are reused.

Arrival towns use approximate central coordinates for orientation; terminals
and boarding stations are unknown. Cycling destinations are distinct from
campsite planning pins. Fucecchio centre uses the approximate location in
[this geographical reference](https://www.tuttitalia.it/toscana/65-fucecchio/);
Mattarana uses the approximate village location in
[this OSM-derived reference](https://www.freecountrymaps.com/map/towns/italy/290416234/).

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

All 322 tests and `npm run build` pass. Adding the first real group itinerary
exposed tests that selected the first grouped journey when they intended the
group/video demo; those fixture lookups now explicitly select a demo.
Additional intake checks verify seven consecutive dates beginning on Saturday,
nine travelers, all-train Lucerne/Kawan arrivals, a Florence endpoint for every
arrival group, and all six shared cycling stages in every filtered view.
Desktop and 390 px browser checks cover the catalog entry, Kawan filter,
Wednesday story, provisional route labels and empty-photo behavior. No browser
errors were recorded in the checked journey flow.
