# Arrival → city demo

Local review only, requested 8 October 2026. Branch `codex/arrival-stay-demo` is
isolated from main. The owner explicitly requested **no publication**.

Selecting a new stop frames its incoming route, draws each leg in order, then
flies into the destination. The normal story remains alongside the map. At the
destination, the railway becomes quiet context and **View photos** opens the
existing gallery. **Replay arrival** repeats the sequence; **Skip to city** ends
it early. Dragging/zooming during arrival cancels the automatic camera and offers
**Back to city**. Reduced motion and route-free stops go straight to the stay.

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

427 tests pass, including sequence/cancellation/reduced-motion checks, city-camera
fallback and shared template parity for Switzerland–Italy, Alpine Crossing and a
fresh draft. The site build passes. Desktop and 390 px phone checks exercised
Venice arrival, skip/replay, the destination view, and gallery navigation.

Before any proposed production rollout, review the pacing and city framing with
the owner. This demo uses station/destination coordinates at zoom 12.5 rather
than authored city boundaries. No photographs or personal stories are fabricated.
