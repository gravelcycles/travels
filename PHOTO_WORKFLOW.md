# iPhone photo workflow

The atlas can use an iPhone photo's capture time and GPS position to associate
it with a day and place it on the map. Preserve the original metadata during
transfer, then publish a separate web-sized copy.

## Upload and delete in Studio

Open **Photos → Upload photos**, choose the destination day and one or more
JPEG, PNG, WebP or HEIC files, then choose **Add photos locally**. Each file can
be up to 50 MB. Processing happens one photo at a time with per-file results;
a failed file does not undo successful imports. The chosen day wins over the
camera date, with a message if they differ. Repeating the same uploaded bytes
returns the existing photo and preserves its day and edits.

The importer automatically rotates the image, makes the source-supported
480/1280/2560/3200 px WebP variants without enlarging small images, and creates
a tiny blurred preview. It strips EXIF/XMP from derivatives. Untouched originals,
camera timestamps, and candidate GPS stay under ignored
`photos/studio-uploads/<journey-id>/`. GPS is never turned into a public pin
without a manual location edit. HEIC uses macOS Quick Look; other still formats
use Sharp. Video and animated/multipage images are rejected.

**Your caption** and **Your notes** start blank. They are optional and contain
only the traveler's words. Do not generate descriptive prose or substitute alt
text into these fields. Resizing, metadata extraction, asset upload, and manifest
updates are deterministic code tasks; no LLM or API key is needed. Accessibility
alt text is a separate field; new uploads use a neutral day-based label.

**Photos from** counts exactly the photos shown in the current Studio grid:
hidden photos are included and labelled **HIDDEN**, while trashed photos appear
only with **Show trash** enabled. The public atlas excludes hidden photos, so its
count can be lower than the editor's count.

Select a photo and choose **Move photo to trash**, then **Save locally**. It is
removed from the local preview, and from the live atlas after deployment. Use
**Show trash → Restore photo from trash → Save locally** to recover it. Trashing
preserves day order, pins, captions, and original visibility, and the cover/lead
photo falls back to another visible photo. It is different from the existing
**Hide from the public atlas** checkbox, which keeps the photo in the editor.
Trash is a recoverable album deletion: originals and already-hosted Release
assets remain. A request to erase an image from public hosting also requires
removing its exact Release assets and checking direct URLs; Trash alone does not
revoke those URLs or erase Git history.

Uploads are saved immediately in an append-only intake manifest separate from
bulk imports: `content/photo-manifests/<journey-id>-uploads.json` for published
trips, or ignored `build/draft-assets/<journey-id>/uploads.json` for drafts.
Do not run a full camera reimport to add or delete a photo. Pending uploads have
`assetStatus: "local"`: Studio can review them, but production builds exclude
them until asset publishing succeeds. This prevents broken live photo links.

## Automated publishing after review

The agent owns these commands; the user does not need a terminal. After the
traveler reviews the selected photos and saves any day, location, visibility,
or caption changes in Studio:

1. Preview the pending assets:
   `npm run photos:publish -- --journey <journey-id>`.
2. Publish the reviewed visible uploads:
   `npm run photos:publish -- --journey <journey-id> --publish`.
3. Run `npm test` and `npm run build`, inspect the source/generated diff, commit
   the changes, and push through the existing Pages workflow.
4. Wait for Pages, then open a fresh public journey and verify day assignment,
   photo viewer, and any deleted-photo absence. Record the deployment receipt.

`--publish` uses the agent host's existing GitHub CLI login. It creates or reuses
the journey-specific `<journey-id>-uploads-v1` Release, uploads only derivative
WebPs, and verifies every new asset's public URL before marking the manifest
`assetStatus: "published"` and rebuilding. It skips hidden/trashed uploads and
refuses to publish a draft journey. It never commits, pushes, uploads originals,
or overwrites existing Release assets. Size/digest mismatches fail for review.
If interrupted, repeat the command: existing matching assets are reused and the
manifest remains local until all checks succeed. A partially completed upload
may already have public assets even while its album entry remains local.

The public site is static. Studio's upload/delete UI is local only, and GitHub
credentials never enter the page. A successful local import is not a deployment.
Bulk import assets still use their original release workflow below.

Studio protects saves with a revision of the saved overrides. If another tab or
an agent changes the files, a stale save fails while retaining the current form.
Keep any unsaved notes before reloading that tab to get the current album.

## Removal of generated copy · 9 September 2026

Compared saved photo copy with the original editorial review in commit
`4801801`: cleared 95 unchanged generated captions and 89 generated descriptions.
Three traveler-edited captions and three personal descriptions were preserved,
along with existing blank fields, all pins, visibility, and ordering. Accessibility
alt text remains separate. A private pre-migration snapshot is in
`build/studio-backups/before-generated-copy-removal.json`. Do not regenerate the
removed prose. Future imports leave both visible text fields blank.

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

## Camera clock and time-zone rule

The importer reads raw EXIF timestamps (`reviveValues: false`). An explicit
`OffsetTimeOriginal`, `OffsetTimeDigitized`, or embedded UTC offset defines an
instant, converted to the selected journey's IANA time zone before day matching.
Without an offset, the camera's date and clock are treated as already local to
the journey; the importing computer's time zone never participates. This also
avoids guessing between repeated DST clock times. If a camera stayed on its
home time zone while traveling, correct its timestamps before import or review
and reassign the inferred days in Studio. Invalid raw dates/offsets stop a
successful import from replacing reviewed output.

**Clear location** writes `location: null`, which explicitly suppresses inherited
GPS in Studio and the viewer. Entering reviewed coordinates restores a pin;
deleting the override entirely restores the base metadata. Original media is
never changed by either action.

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
date-inferred day assignments were retained, with alt text, visibility decisions,
and review status. The generated captions and descriptions from that review were
removed on 9 September; only traveler-written visible copy remains.
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

The importer treats naive EXIF timestamps as journey-local camera time; the
computer host time zone never participates. Review camera-clock mistakes manually.

## Video and fallback-media decisions

The six held MOV files remain private and are not part of the public atlas.
There is no reviewed story moment that currently warrants the privacy,
transcoding, poster-frame, responsive-loading, captioning, and Release
publishing surface of a separate video pipeline. If a specific clip is approved
later, design and review that pipeline before generating or publishing any
derivative; do not pass a MOV through the still-photo workflow.

Days without a visible family photograph use the atlas's intentional empty
state. No stock or third-party fallback images are used for Days 9, 11, and 14;
Day 8 also remains visually empty because its only source image is hidden after
privacy review. The day copy, route, and previous/next navigation remain
available, so the absence reads as part of the record rather than missing UI.

## Local annotation with Atlas Studio

Run `npm run studio`, then open `http://127.0.0.1:4173/studio/`. The Studio uses
the ignored local 480/1280/2560/3200 WebPs when available, so reviewing many
photos does not repeatedly download the public Release assets.

For each photo:

1. Confirm or change its journey day.
2. Click the map at the actual viewpoint, then drag the pin if needed.
3. Name the exact place within the city or landscape and adjust the 12–18 map
   zoom; 16 is a useful street-level default.
4. Optionally write your own caption or notes. Leave them blank when unwanted;
   generated prose must not be added.
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
