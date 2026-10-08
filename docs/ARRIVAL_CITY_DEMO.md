# Arrival → city demo

Local review only, requested 8 October 2026. Branch `codex/arrival-stay-demo` is
isolated from main. The owner explicitly requested **no publication**.

Selecting a new stop frames its incoming route, draws each leg in order, then
flies into the destination. The normal story remains alongside the map. At the
destination, the railway becomes quiet context and **View photos** opens the
existing gallery. **Replay arrival** repeats the sequence; **Skip to city** ends
it early. Dragging/zooming during arrival cancels the automatic camera and offers
**Back to city**. Reduced motion and route-free stops go straight to the stay.

The route trail and moving icon share a lightweight canvas and update together
on every display frame, with no 30 Hz limit. Route projection and path prefixes
are cached; playback does not rebuild GeoJSON or send work to the map's route
workers. The overlay respects train/bus/TBD styling and display pixel density,
reprojects on resize, and restores the regular map layers when it ends.

Selecting a stop pulls back around the current place to a wider geographic scale,
then pans and zooms onto the next route in one continuous move.
The pullback takes 450–950 ms depending on zoom change, followed by a combined
750 ms pan and zoom; redundant stages are omitted. Named start/arrival pins and
the route's **From → To** title preserve orientation. A distinct previous city
is labelled during the camera move when navigating from a close city view.

Playback waits for all camera stages to finish, then plays for **1.5 seconds**
(40% shorter than 2.5 seconds), holds the completed route and icon for **0.25
seconds**, and starts the city zoom. Framing time does not consume travel time.
Travel itself remains linear.
Replay uses the same preparation; reduced motion skips it. Changing stops,
skipping, or dragging during preparation cancels the pending playback too.

The timing follows a simplified overhead outline in Mercator space, retaining
bends greater than 2.5% of the leg's bounding-box diagonal. Progress projected
along each outline span is linear with time: small switchbacks move faster than
straight track. True backtracking gets 4% of that span's time to remain continuous
rather than teleport. The original track is still drawn and the icon stays on it;
the simplified outline is only a cached clock. Disconnected legs stay separate.

The clock belongs to the selected event: navigation, whole-trip overview, hidden
tabs, photos and map retry cannot leave an old arrival callback in control.
Returning from the mobile story does not replay the arrival. Unlocated photos
use the destination at city scale and retain that view between pictures; existing
geotagged-photo camera behavior is retained. Unknown destinations fall back to
the final available route endpoint, or the existing empty-map state.

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

441 tests pass, including camera-stage order/completion/cancellation, previous-view
context, overhead pacing,
switchbacks/backtracking, the exact
1.5-second travel plus 250 ms hold, synchronized canvas painting and cleanup,
sequence/cancellation/reduced-motion checks, city-camera
fallback and shared template parity for Switzerland–Italy, Alpine Crossing and a
fresh draft. The site build passes. Desktop and 390 px phone checks exercised
Venice arrival, skip/replay, the destination view, and gallery navigation.

Before any proposed production rollout, review the pacing and city framing with
the owner. This demo uses station/destination coordinates at zoom 12.5 rather
than authored city boundaries. No photographs or personal stories are fabricated.
