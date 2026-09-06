# Travels — Journey Atlas

A static, GitHub Pages-friendly atlas for David and Michelle's family journey
through Switzerland and Italy. The main page is intentionally a single,
standalone trip; fictional viewer examples live separately at `demo.html`.

## Preview locally

Serve `dist/` with any static web server. For example:

```sh
python3 -m http.server 8000 --directory dist
```

Then open `http://localhost:8000/`.

- `/` shows only the real family journey.
- `/demo.html` shows only the sample journeys and includes a sample selector.

## Add trip photos

Start with `TRIP_CONTENT.md`. Journey data lives in
`dist/assets/journeys.js`; photographs belong in `dist/assets/photos/` as
optimized WebP or AVIF files, or can use public HTTPS URLs.

Use `PHOTO_WORKFLOW.md` when transferring iPhone images so capture time and GPS
survive the import. Route research and its limitations are recorded in
`ROUTE_SOURCES.md`; open work is tracked in `TODO.md`.

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
