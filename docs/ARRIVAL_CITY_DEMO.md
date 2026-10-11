# Arrival → city experience

Reviewed locally on 8 October 2026 and approved for deployment by the owner on
10 October 2026. The shared experience applies to real journeys, samples and
drafts. The synthetic review fixtures below remain local only.

Selecting a new stop frames its incoming route, draws each leg in order, then
settles into the destination. The normal story remains alongside the map. At the
destination, the railway becomes quiet context and **View photos** opens the
existing gallery. **Replay arrival** repeats the sequence; **Skip to city** ends
it early. Dragging/zooming during arrival cancels the automatic camera and offers
**Back to city**. Reduced motion and route-free stops go straight to the stay.

On phones, arrival is a state of the existing event card: route and Skip during
travel, then one date/title and Photos action with secondary Replay arrival.
Contextual Places appears only when this event has places. There is no second
resting arrival card repeating the same city.

The route trail and a plain orange tracking circle share a lightweight canvas
and update on every display frame, with no 30 Hz limit. The circle has a white
rim and no arrow or symbol inside. Route projection and path prefixes
are cached; playback does not rebuild GeoJSON or send work to the map's route
workers. The overlay respects train/bus/TBD styling and display pixel density,
reprojects on resize, and restores the regular map layers when it ends.

Selecting a stop pans and zooms directly to the complete incoming route in one
850 ms ease, with no separate pullback/re-zoom or flight arc. An already-fitted
view stays still. This implements the owner's 11 October correction to awkward
day/stop zooming and poor north–south visibility, superseding the earlier
450–950 ms old-place pullback plus 750 ms second move. Full-trip Replay remains disabled. Named endpoints and **From → To** preserve orientation.

Fit the actual map area after rendering/resizing the arrival card. Keep clearance
for the orange circle, endpoint labels and the desktop overlay;
the phone's card is outside the map and must not reduce the route area twice.
`cameraForBounds` already offsets the fitted center for its padding: applying
that padding again in `easeTo` clips the northern end of tall routes. Pass the
computed camera without a second padding value, both here and for city framing.
North–south endpoint labels sit outside the line (above the northern end and
below the southern end), so the departing circle does not pass behind its start
label. Stationary signposts are hidden during framing/travel, then return when
arrival ends or is interrupted; named arrival endpoints remain. The untravelled guide remains visible at 35% opacity. Late route redraws
reapply the guide and hide only layers that actually exist; they must not reveal
the full active stroke or emit a false map error over the moving marker.
The camera stays stationary throughout route tracing and the arrival hold, then
uses a direct 900 ms ease into the photo/place-aware city view.

Playback waits for the camera move to finish, then plays for **1.5 seconds**
(40% shorter than 2.5 seconds), holds the completed route and circle for **0.25
seconds**, and starts the city zoom. Framing time does not consume travel time.
Travel itself remains linear.
Replay arrival uses the same preparation; reduced motion skips it. Changing stops,
skipping, or dragging during preparation cancels the pending playback too.

The timing follows a simplified overhead outline in Mercator space, retaining
bends greater than 2.5% of the leg's bounding-box diagonal. Progress projected
along each outline span is linear with time: small switchbacks move faster than
straight track. True backtracking gets 4% of that span's time to remain continuous
rather than teleport. The original track is still drawn and the circle stays on it;
the simplified outline is only a cached clock. Disconnected legs stay separate.

The clock belongs to the selected event: navigation, whole-trip overview, hidden
tabs, photos and map retry cannot leave an old arrival callback in control.
Returning from the mobile story does not replay the arrival. Unlocated photos
use the destination at city scale and retain that view between pictures; existing
geotagged-photo camera behavior is retained. Unknown destinations fall back to
the final available route endpoint, or the existing empty-map state.

The destination camera fits all geotagged photos in the city boundary or within
five miles (8.04672 km) of it, plus all marked places assigned to the stop and
nearby marked places. Hidden/trashed or unlocated photos and distant travel shots
do not expand the city view. Without a saved boundary it uses five miles from
the destination. The camera has room for controls and a maximum zoom of 12.5;
the city outline and buffer themselves do not force a wider view. Empty city
albums retain the destination view. The same fit is used for unlocated-photo
fallback and returning to the city.

## Run locally

From this worktree:

```sh
npm run build
node scripts/create-arrival-preview.mjs backpacking-europe-heading-east
ATLAS_STUDIO_PORT=4174 npm run studio
```

Open `http://localhost:4174/dist/qa-arrival-backpacking-europe-heading-east.html?day=backpacking-europe-heading-east-venice-stay`.

The generator accepts any journey or draft ID and renders the shared template.
Its ignored `dist/qa-arrival-*.html` fixture replaces all media with labelled SVG
placeholders, clears overrides and curated places, marks the fixture unpublished,
and omits private photo-service/auth scripts. It does not edit journey sources,
private media, or publication settings. It is not an alternate viewer.

Shared implementation: `arrival-chapter.js` owns route phases and cancellation;
`app.js` owns map/gallery integration; the controls and styles are shared by real
journeys, samples and drafts. No journey ID check or new content flag is used.

## Review

Regression checks cover one-move framing, single application of bounds padding,
phone/desktop overlay clearance, resize-before-fit, completion/cancellation, overhead pacing,
switchbacks/backtracking, the exact
1.5-second travel plus 250 ms hold, synchronized canvas painting and cleanup,
sequence/cancellation/reduced-motion checks, city-camera
fallback and shared template parity for Switzerland–Italy, Alpine Crossing and a
fresh draft. The site build passes. Desktop and 390 px phone checks exercised
Venice arrival, skip/replay, the destination view, and gallery navigation.

The owner approved the pacing, camera sequence and plain orange tracking circle
for deployment on 10 October 2026, then requested photo/place-aware city framing.
Optional city boundaries are stored with source attribution in journey data;
the browser never sends photo locations to a geocoding service. The local fixtures
contain labelled placeholders; production continues to use each journey's own
photos and stories.


For the 11 October correction, compare the **same leg and progress** at desktop,
390 px, 320 px and phone landscape sizes. Check both long north–south and wide
routes: the whole geometry and circle must remain visible, and endpoint labels
must clear the card. Use Switzerland–Italy, Alpine Crossing, Heading East's
city stops and an independently populated draft. Check rapid stop changes,
Skip/Replay arrival, manual interruption and reduced motion. Preserve the shared
stroke width, circle diameter and display-pixel-density rendering on phones.

The 11 October release passes 544 tests and the production build. Browser
comparison used Innsbruck → Bolzano (north–south), the Alpine demo's Disentis →
St. Moritz (wide), the reference multi-leg route and an independent synthetic
city draft. Desktop, 390/320 px portrait and 844 × 390 landscape retained the
full line and marker; ordinary playback, skip and rapid navigation were checked.
The discovered missing-layer error and delayed full-stroke redraw have focused
regressions. Synthetic fixtures and diagnostics remain unpublished.
