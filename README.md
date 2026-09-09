# Travels — Journey Atlas

A static, GitHub Pages-friendly atlas. The root is an index of real journeys;
David and Michelle's Switzerland–Italy family journey has its own stable page
at `switzerland-italy.html`. Fictional viewer examples live separately at
`demo.html`.

## How we work

The workflow is agent-driven. The user provides trip facts, files, corrections,
and visual/editorial decisions; the agent runs local commands and servers,
generates assets, opens review tools, tests, commits, pushes, deploys, and
verifies the public result. Instructions containing shell commands are for
agents and documentation—do not ask the user to operate npm or the terminal.

For a repeatable new-trip process, read [JOURNEY_WORKFLOW.md](JOURNEY_WORKFLOW.md).
It covers the journey schema, exact rail/ferry routing, manual edits, GPX bike
imports, photos, QA, publishing, and what must be recorded for the next agent.

For the rail-aligned map lines specifically, follow
[TRAIN_ROUTE_WORKFLOW.md](TRAIN_ROUTE_WORKFLOW.md): service research, Overpass
exports, manifest setup, generation, overrides, and close-zoom review.

## Start a future trip

The agent opens Atlas Studio. Choose **+ New trip**, give it a name and start/end
dates, and choose **Create trip**. Every calendar day is ready immediately in
**Day copy**; places, routes, and photos can follow later. **Preview atlas** opens
that selected trip, including a draft with no destinations yet. On phones, the
day editor comes before the map and the preview/save status remain available.

Drafts and their edits stay in ignored local files. They do not enter the public
catalog, generated bundles, or Git until the agent explicitly promotes reviewed
sources. A public URL is stable even if the display title changes.

Agent equivalent:

```sh
npm run journey:new -- --title "Autumn in Japan" --slug japan-autumn-2027 --start 2027-10-01 --end 2027-10-14 --timezone Asia/Tokyo
npm run build
npm test
```

`npm run build` validates sources and generates every public journey page,
catalog data, route/photo bundle, and override bundle. It uses reviewed static
assets, needs no private originals/network extracts, and runs in Pages CI.

## Preview locally

Serve the repository root so the production page and ignored local photo build
can be tested together. For example:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000/dist/`. Add `?photoSource=local` to use the
ignored local derivatives instead of GitHub Release URLs.

- `/dist/` lists all real journeys.
- `/dist/switzerland-italy.html` opens the real family journey.
- `/dist/demo.html` shows only the sample journeys and includes a selector.

## Replay a trip

Open a journey and choose **Trip replay**. Replay follows every day's travel
legs in their stored order, retaining each mode's map color and line pattern as
the route accumulates. It includes play/pause, half/normal/double speed, day
step buttons, a day timeline, keyboard controls, and a completion state.

The player displays each day's reviewed lead photo when available. A photo with
reviewed coordinates becomes its own replay pause and moves the map to that
saved location and zoom; unlocated photos are shown without inventing a map
position. With reduced motion enabled at the operating-system level, legs and
camera changes update without animation while timing and manual controls remain
available.

## Annotate photos and redraw routes

The agent launches the local-only Atlas Studio instead of asking the user to
hand-edit generated JavaScript or run the server:

```sh
npm run studio
```

The agent then opens `http://127.0.0.1:4173/studio/`. Choose any journey first.
In **Photo locations**, select a day and photo, click the map (or drag its pin)
to set the exact location, and add the precise place, caption, scene description,
and preferred map zoom. Selecting another photo in the same day keeps the map's
current position and zoom. **Switch to current point’s zoom** restores the
selected photo's saved view; placing its pin records the current zoom for Replay.
In **Route drawing**, select a day and any of its travel
legs, click the orange line to add control points, drag any point—including the
start and end—or type exact endpoint coordinates. Moving an endpoint updates
only that end of the detailed route; choose **Save locally** directly, without
accepting the simplified anchor guide. Undo, redo, reset, and
intermediate-point deletion are available. A mode-aware proposal routes through
those durable anchors using the journey's local rail, ferry, road, walking, or
bicycle network. Original, saved, anchor-guide, and proposed lines stay separate
until a proposal or manual fallback is accepted; unsafe or unavailable routing
keeps the reviewed line. For a bicycle or walking leg, **Traveler GPX track**
checks a private local file for travel order, endpoint alignment, large gaps,
distance, and meaningful turns before offering a simplified line for explicit
acceptance. The source GPX is never copied into the repository. In **Photo
locations**, keyboard-accessible controls set the album order and a separate
lead photo for each day. In **Day copy**, edit date labels, titles, and
descriptions.

**Save locally** writes reviewable source data to
`content/photo-overrides.json`, `content/route-overrides.json`, and
`content/day-overrides.json`, then rebuilds `dist/assets/content-overrides.js`.
Each save also creates ignored backups in `build/studio-backups/`. The Studio
binds only to the loopback interface and is not part of the published site.

## Add trip photos

Start with `TRIP_CONTENT.md`. Journey source data lives in
`content/journeys/<journey-id>.json`. Private originals go in ignored `photos/`; the
checked-in manifest references optimized WebPs hosted as GitHub Release assets.

The agent installs the generator dependencies and builds the current trip with:

```sh
npm install
npm run photos:build -- --journey switzerland-italy-family-2026
```

This creates responsive 480/1280/2560/3200 px variants under ignored `build/`
and updates `dist/assets/trip-photos.js`. See `PHOTO_WORKFLOW.md` for review,
privacy, and Release publishing steps. Never commit the originals or generated
photo binaries.

Use `PHOTO_WORKFLOW.md` when transferring iPhone images so capture time and GPS
survive the import. Route research and its limitations are recorded in
`ROUTE_SOURCES.md`; the reusable build flow is in `JOURNEY_WORKFLOW.md`; open
work is tracked in `TODO.md`.

Network route inputs are declared per journey in
`content/route-sources/<journey-id>.json`. The agent regenerates one journey's
routes with `npm run routes:build -- --journey <journey-id>` and runs the
disconnected/ambiguous-network fixtures with `npm run routes:test`. Missing or
unsafe network input produces a warning and retains the last reviewed static
geometry; `--strict` fails without changing the output.

Each journey contains:

- places with stable IDs and latitude/longitude
- route segments connecting place IDs
- several ordered transport legs within the same day
- optional detailed `geometry` in GeoJSON `[longitude, latitude]` order
- optional legacy `via` coordinates that approximate a leg when geometry has
  not been reviewed yet
- named `stops` that draw and mark each scheduled rail stop in a close-up
- a `destinationId` so base-based day trips are labeled by destination
- calendar days, including non-travel days
- optional photographs linked to days
- optional photo overrides with exact coordinates, street-level zoom, caption,
  description, review state, day reassignment, or a hidden flag
- optional day overrides for date labels, titles, descriptions, explicit photo
  order, and a separate lead-photo ID

The first real trip combines train, boat, bus, gondola, bicycle, and walking
segments. Sample data remains in the shared content file but is only exposed by
the separate demo page.

## Publish with GitHub Pages

The workflow in `.github/workflows/journey-atlas-pages.yml` deploys `dist/`
whenever `main` changes. In GitHub, set **Settings → Pages → Build and
deployment → Source** to **GitHub Actions**.

The project uses only relative browser paths, so its expected URL is:

`https://gravelcycles.github.io/travels/`

## Low-discovery setup

The site deliberately includes both a restrictive `robots.txt` and a
`noindex, nofollow` page directive. Do not link it from the main
`gravelcycles.github.io` site, `mr-designs`, social profiles, or public
sitemaps.

These measures discourage ordinary search discovery; they are not access
control. Anyone who knows or receives the URL can visit a publicly published
Pages site. Keep sensitive trip data and original photos out of this repository.

## Map and attribution

The map uses MapLibre with OpenFreeMap's Liberty vector style. Keep the
OpenFreeMap, OpenMapTiles, and OpenStreetMap attribution if the map layout or
implementation changes.
