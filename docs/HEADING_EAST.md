# Backpacking Europe: Heading East

Intake and research: 8 October 2026. The owner confirmed 2026 and corrected the
Rhine stops to Köln on 29–30 September, then Düsseldorf on 30 September–1 October.
Each city is one event. Photos, taglines and stories are deliberately empty.

| City event | Arrival–departure / last known date | Incoming travel |
| --- | --- | --- |
| Luzern | 1 September departure | Origin; no earlier stay dates supplied |
| Freiburg | 1–17 September | Luzern → Basel SBB → Freiburg Hbf |
| Hamburg | 17–29 September | Freiburg → Karlsruhe → Mannheim → Frankfurt → Fulda → Kassel-Wilhelmshöhe → Göttingen → Hannover → Hamburg |
| Köln | 29–30 September | Hamburg → Bremen → Osnabrück → Münster → Dortmund → Essen → Duisburg → Düsseldorf → Köln |
| Düsseldorf | 30 September–1 October | Köln → Düsseldorf |
| Berlin | 1–5 October | Düsseldorf → Duisburg → Essen → Dortmund → Hamm → Bielefeld → Hannover → Wolfsburg → Berlin-Spandau → Berlin Hbf |
| Prague | 5–11 October | Berlin → Dresden by train; Dresden → Ústí nad Labem by replacement bus; Ústí → Prague by train |
| Salzburg | From 11 October | Prague → Tábor → České Budějovice → Summerau → Linz; Linz → Wels → Attnang-Puchheim → Salzburg |

Salzburg's departure is unknown. The machine range ends on the last supplied
date, 11 October, and can be extended. Dresden, Basel, Ústí and Linz are transit
places, not additional city stays. Incoming legs belong to the arriving city;
passing through Düsseldorf en route to Köln does not create an earlier stay.

## Evidence and confidence

These are researched **candidate corridors**, not verified personal service
records. City endpoints, order, dates, train travel and one replacement bus are
owner-supplied facts. Tickets/departure times were unavailable. Do not infer train
numbers, platforms, precise travel durations, passenger calls at every shaping
anchor, or the particular track used from network geometry.

- [SBB IR27](https://network.sbb.ch/de/linie/IR27) and
  [Luzern–Olten connections](https://network.sbb.ch/de/bahnhof/LZ/ziel/OL)
  support the Luzern–Olten–Liestal–Basel corridor. Basel Bad Bf constrains the
  onward Rhine railway to Freiburg. The particular Swiss/DB trains are unknown.
- [DB ICE network](https://cms.static-bahn.de/wmedia/redaktion/aushaenge/streckenkarte/Liniennetz%20ICE%20IC%202025.pdf)
  provides the corridor structure. [DB's ICE Sprinter overview](https://www.bahn.de/service/ueber-uns/zugtypen/ice-sprinter)
  corroborates Hamburg/Hannover–Frankfurt and Hamburg–Ruhr–Köln services.
  Freiburg–Hamburg is reconstructed through Frankfurt and the north–south
  high-speed route; the Rhine/Ruhr services use representative corridors.
  The network map is an older topology reference, not proof of a 2026 departure
  or construction diversion. Hamburg–Köln can also run via Wuppertal/Hagen;
  the Essen/Duisburg corridor shown here remains unconfirmed.
- [DB's Monday replacement-bus timetable](https://assets-ri.extranet.deutschebahn.com/db_fernverkehr/2026-05-11/884f1b2b-6ba2-4217-8be6-626bdbc8ca04%25C3%259Cbersicht%2BSEV%2BDresden%2BHbf%2B-%2BUsti%2Bnad%2BLabem.pdf)
  explicitly covers Mondays from 1 June through 7 December 2026, including
  5 October. It names Dresden Hbf **Strehlener Straße** and Ústí nad Labem hl. n.,
  with onward trains to Prague. This strongly supports the bus endpoints; it
  does not identify which departure the traveler used. The detailed road line
  follows B170 → A17 → D8 → road 613 into Ústí. Station forecourt approaches are
  approximate; OSRM driving geometry is not an operator's recorded coach track.
- [European Sleeper's disruption notice](https://europeansleeper.eu/de/disruptions)
  describes direct Dresden–Prague replacement buses on 1, 3 and 6 October.
  Those are different dates and a different service; that notice was not used
  to draw a direct Dresden–Prague bus for 5 October.
- [ČD's Austria connections](https://www.cd.cz/scripts/detail.php?pgid=2797)
  describe the Prague–Tábor–České Budějovice–Linz EuroCity corridor.
  [ČD's Tábor station page](https://www.cd.cz/en/stanice/5473622/?lang=en&nazev=5473622)
  supplies the corrected station anchor (49.4146, 14.67646).
  [ÖBB timetable images](https://www.oebb.at/en/fahrplan/fahrplanbilder), table
  101, establish Linz–Wels–Attnang-Puchheim–Salzburg. The 11 October departure
  and any date-specific alteration remain unconfirmed; no additional bus has
  been invented for this planned leg.

## Geometry and preservation

All eleven legs have detailed static network geometry: ten rail legs and one
road leg. Rail requests use OpenRailRouting's `tgv_all` profile with explicit
station constraints; `/info` reported OSM data dated 8 October 2026, 04:00 UTC.
Road geometry uses OSRM's driving profile. `via` entries are shaping anchors,
not asserted passenger stops. No endpoint-only guide remains.

The committed `content/route-sources/backpacking-europe-heading-east.json`
records exact request URLs, provider/profile, raw hashes, counts, measured
lengths, endpoint and intermediate-anchor offsets, largest raw gaps, and
simplification settings. Raw responses and request inventory remain ignored
under `build/route-inputs/backpacking-europe-heading-east/`. Reviewed geometry
is preserved against unattended regeneration. Distances measure the mapped
reconstruction, not ticket mileage; road-router durations are not bus schedules.

QA: all endpoints are within 24 m of station anchors; intermediate anchors
are within 250 m. Simplification uses 0.00003 tolerance with five-decimal output,
under 1% length change, and no artificial densification. Long straight rail
vertices can span tunnels or straight tracks; they are retained from the
network, not converted into guessed road segments. Geometry is approximately
2,797 km across the eleven legs. Service-level uncertainty remains visible in
each leg's Travel details as “Reconstructed corridor · service unconfirmed”.

Validation: the full test suite passes (366 tests), including daily-reference,
demo and freshly generated city-draft contracts, transfer-date photo assignment,
planner shifts and invalid ranges. Desktop and 390 px phone reviews covered the
new city journey, Switzerland–Italy and Alpine Crossing using photo-free QA
fixtures with the identical map/runtime. City navigation, Prague travel details
and map-only Replay were checked. Studio showed all eight stop ranges and the
new city authoring controls. Temporary QA pages are excluded from publication.
