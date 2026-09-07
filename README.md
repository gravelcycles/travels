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

## Annotate photos and redraw routes

The agent launches the local-only Atlas Studio instead of asking the user to
hand-edit generated JavaScript or run the server:

```sh
npm run studio
```

The agent then opens `http://127.0.0.1:4173/studio/`. In **Photo locations**, select a
day and photo, click the map (or drag its pin) to set the exact location, and
add the precise place, caption, scene description, alt text, and preferred map
zoom. In **Route drawing**, select a day and travel leg, click the orange line
to add control points, drag them to the intended road/rail/water path, and use
the optional smooth preview. Undo, redo, reset, and intermediate-point deletion
are available.

**Save locally** writes reviewable source data to
`content/photo-overrides.json` and `content/route-overrides.json`, then rebuilds
`dist/assets/content-overrides.js`. Each save also creates an ignored backup in
`build/studio-backups/`. The Studio binds only to the loopback interface and is
not part of the published site.

## Add trip photos

Start with `TRIP_CONTENT.md`. Journey data lives in
`dist/assets/journeys.js`. Private originals go in ignored `photos/`; the
checked-in manifest references optimized WebPs hosted as GitHub Release assets.

The agent installs the generator dependencies and builds the current trip with:

```sh
npm install
npm run photos:build
```

This creates responsive 480/1280/2560/3200 px variants under ignored `build/`
and updates `dist/assets/trip-photos.js`. See `PHOTO_WORKFLOW.md` for review,
privacy, and Release publishing steps. Never commit the originals or generated
photo binaries.

Use `PHOTO_WORKFLOW.md` when transferring iPhone images so capture time and GPS
survive the import. Route research and its limitations are recorded in
`ROUTE_SOURCES.md`; the reusable build flow is in `JOURNEY_WORKFLOW.md`; open
work is tracked in `TODO.md`.

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
  description, alt text, day reassignment, or a hidden flag

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

The map uses MapLibre with OpenFreeMap's Positron vector style. Keep the
OpenFreeMap, OpenMapTiles, and OpenStreetMap attribution if the map layout or
implementation changes.
