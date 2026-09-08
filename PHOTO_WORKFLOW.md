# iPhone photo workflow

The atlas can use an iPhone photo's capture time and GPS position to associate
it with a day and place it on the map. Preserve the original metadata during
transfer, then publish a separate web-sized copy.

## Best transfer from iPhone

1. In Photos, select the images and open the Share sheet.
2. Tap **Options**.
3. Leave **Location** enabled and turn on **All Photos Data**.
4. AirDrop the selection to the Mac, or create an iCloud link and download the
   originals before that link expires.
5. Put the untouched originals in a private folder or archive—not in this
   public repository.

If the images are already in Photos on the Mac, select them and use
**File → Export → Export Unmodified Original**. Avoid screenshots and social or
messaging-app downloads; they may omit or rewrite EXIF metadata.

## What to send for atlas import

- Prefer the original HEIC/JPEG files in a ZIP archive.
- Do not resize, convert, or strip location before sending.
- If Photos shows no location for an image, add or correct it there first, or
  provide the intended day/place alongside the filename.
- Include only images you are comfortable using for the project.

## Current Switzerland–Italy trip import

`npm run photos:build -- --journey switzerland-italy-family-2026` reads `photos/switzerland-italy-trip/` and writes public-ready
derivatives to the ignored `build/trip-photos-v1/` directory. The current run:

- matched 104 stills to journey days from local capture dates;
- found no GPS coordinates, so photos are day-linked but not map-pinned;
- held six MOV files for a future video-specific pipeline;
- excluded four stills captured outside 13–26 August 2026;
- generated 356 WebP files totaling about 169 MB; and
- generated `dist/assets/trip-photos.js`, including embedded 32 px blurred
  previews and pinned GitHub Release URLs.

All 104 photographs received an editorial review on 8 September 2026. Their
date-inferred day assignments were retained, and each now has a concise caption,
plain-language description, alt text, visibility decision, and review status.
Because none contains GPS, every photo remains explicitly marked as reviewed
but unlocated rather than receiving an inferred viewpoint. Ninety-five photos
remain visible; eight near-duplicate or low-quality frames and one private-
residence exterior are hidden from generated public photo data.

## Other journeys

Always pass `--journey <id>`; the importer never guesses from the default trip.
Each journey has ISO `calendarDate` values and an IANA `timeZone`. Optional
`photoImport` configuration holds `sourceDirectory`, `releaseTag`, and a legacy
`idPrefix`; new trips default to their journey ID for unique photo names.
`--source`, `--release`, and `--timezone` can override the intake configuration.

The importer writes `content/photo-manifests/<id>.json` for published trips or
ignored `build/draft-assets/<id>/photos.json` for drafts. GPS candidates remain
in the private build report for review; no automatic precise map pin is exposed.
Failed/empty imports retain the previous manifest and derivative directory;
successful replacements keep a local backup. Review results, then run
`npm run build` to generate the public bundle. Original HEIC decoding still
uses macOS Quick Look; JPEG/PNG imports use Sharp directly.

Naive EXIF timestamps without a UTC offset still need review when camera and
host time zones differ; T25 tracks the offset-aware parsing follow-up.

## Local annotation with Atlas Studio

Run `npm run studio`, then open `http://127.0.0.1:4173/studio/`. The Studio uses
the ignored local 480/1280/2560/3200 WebPs when available, so reviewing many
photos does not repeatedly download the public Release assets.

For each photo:

1. Confirm or change its journey day.
2. Click the map at the actual viewpoint, then drag the pin if needed.
3. Name the exact place within the city or landscape and adjust the 12–18 map
   zoom; 16 is a useful street-level default.
4. Write a short caption and a separate plain-language account of what is
   happening. Add useful accessibility alt text.
5. Hide any photo that should not appear publicly.
6. Use **Move earlier**, **Move later**, and **Use as lead photo** to establish
   an explicit daily album order and a separate representative lead.
7. Choose **Save locally**. Review the JSON diff before committing.

Saves write `content/photo-overrides.json` and rebuild the static
`dist/assets/content-overrides.js` consumed by the atlas. They do not modify the
originals or Release files. When a located photo is highlighted in the
full-screen day viewer, the map moves to this exact coordinate and zoom.

## Generated image sizes and loading

Each still gets the source-supported subset of 480, 1280, 2560, and 3200 px
wide WebP variants. The 480 px version covers thumbnails and most phones; 1280
px covers panels and ordinary displays; 2560 and 3200 px retain detail for
large and high-density full-screen viewing without shipping originals.

The browser initially paints an embedded blurred preview. Images close to the
viewport hydrate through responsive `srcset`; images farther away stay tiny.
The full-screen viewer also preloads two neighbors in each direction. This is a
bounded load-ahead strategy rather than preloading all 104 photographs.

The generator uses macOS Quick Look for reliable HEIC decoding, then Sharp for
resizing and WebP encoding. It validates that decodes contain real pixel
variation and strips source EXIF metadata from every derivative.

## GitHub Release publishing

Keep originals under ignored `photos/`; never upload them. Publish only the
WebPs from `build/trip-photos-v1/` in a public Release tagged exactly
`trip-photos-v1`. The manifest deliberately uses immutable URLs such as:

```text
https://github.com/gravelcycles/travels/releases/download/trip-photos-v1/img-1425-w1280.webp
```

[GitHub documents](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases)
a limit of 1,000 assets per Release and 2 GiB per asset, so the 356-file build
fits comfortably. It also documents
[direct links to assets under a named release tag](https://docs.github.com/en/repositories/releasing-projects-on-github/linking-to-releases).
Do not use `/latest/`, because a later unrelated Release would silently change
those URLs.

The user approved public hosting on 7 September 2026. The initial Release was
published and verified with:

```sh
gh release create trip-photos-v1 build/trip-photos-v1/*.webp \
  --repo gravelcycles/travels \
  --title "Trip photos v1" \
  --notes "Optimized, metadata-stripped derivatives for the journey atlas."
```

Verify several 480, 1280, and 2560/3200 direct asset URLs before committing and
pushing `dist/assets/trip-photos.js`. Release assets are public even though the
Pages documents use `noindex`; treat confirmation as a privacy decision.

## Safe publishing rules

1. Read capture time, GPS latitude/longitude, orientation, and caption.
2. Suggest day and map matches for review; do not invent missing GPS.
3. Keep source files and generated build output out of Git.
4. Strip sensitive metadata from public derivatives.
5. Publish the Release assets and matching manifest together.
6. Retain originals privately.

## Apple references

- [Share photos and videos on iPhone](https://support.apple.com/guide/iphone/iphf28f17237/ios)
- [Export unmodified originals from Photos on Mac](https://support.apple.com/guide/photos/pht6e157c5f/mac)
- [Review or adjust photo information on iPhone](https://support.apple.com/guide/iphone/iph0edb9c18f/ios)
