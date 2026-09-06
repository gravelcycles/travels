# Travels — Journey Atlas

A static, GitHub Pages-friendly atlas for photo-rich journeys by train, bus,
car, bike, or a combination of modes. This repository currently publishes the
complete demo and is ready for a first real journey through Switzerland and
Italy by train.

## Preview locally

Serve `dist/` with any static web server. For example:

```sh
python3 -m http.server 8000 --directory dist
```

Then open `http://localhost:8000/`.

## Add the Switzerland–Italy trip

Start with `TRIP_CONTENT.md`. Journey data lives in
`dist/assets/journeys.js`; photographs belong in `dist/assets/photos/` as
optimized WebP or AVIF files, or can use public HTTPS URLs.

Each journey contains:

- places with stable IDs and latitude/longitude
- route segments connecting place IDs
- calendar days, including non-travel days
- optional photographs linked to days

The first real trip will use only `train` route segments. The demo remains in
place until the real itinerary and journal content are supplied.

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
