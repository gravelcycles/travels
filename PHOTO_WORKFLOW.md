# iPhone photo workflow

The atlas can use an iPhone photo's capture time and GPS position to associate
it with a day and show its location in the photo viewer. The journey map has
no photo thumbnails. Preserve the original metadata during
transfer, then publish a separate web-sized copy.

## Upload and delete in Studio

Open **Photos → Upload photos**, leave **Automatically match capture dates**
selected, and choose multiple JPEG, PNG, WebP or HEIC files in one batch. Choose
**Add photos locally**. Each photo is assigned to its own journey day using its
capture date and the journey time zone, following the camera clock rule below.
The file picker shows the selected count and names. A batch spanning days opens
the **All days** grid so every successful import is available.

Photos with missing, invalid, or out-of-trip dates stay in an individual day
review list. Choose a day beside each file and click **Add this photo**; the
file stays available in the tab without selecting it again. Finish these choices
before closing the tab. You can also choose an explicit day for an entire batch
when camera dates are wrong; a message explains any date mismatch.

Each file can be up to 50 MB. Processing happens one photo at a time with per-file
results; a failed file does not undo successful imports. Repeating identical
uploaded bytes returns the existing photo and preserves its day and edits.

The importer automatically rotates the image, makes the source-supported
small (up to 1280 px wide) and big (up to 3200 px longest-edge) WebPs without enlarging small images, and creates
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
Trash is recoverable album deletion: originals and already-hosted private R2
objects remain. Permanent erasure requires checking every journey reference,
removing the exact unreferenced objects, and verifying their authenticated URLs.
Historical public Releases also require explicit retirement during cutover;
see [PHOTO_AUTH_HANDOFF.md](PHOTO_AUTH_HANDOFF.md).

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

On phones, Photos and View photos open the selected day’s grid. Selecting a
thumbnail opens the full photograph; both Back and Close return to that day’s
map. Controls stay visible when the photo is tapped. Swipe sideways for the
next/previous photo, double-tap or pinch to zoom, and drag upward or tap Photo
location to reveal its map. Hide location collapses it without leaving the
photo. Verify a quick hide-then-swipe keeps location closed. Replay shows the
route map and day story with fixed playback controls. It has no photo viewer,
image preloads or photo pauses; browse photographs through the day albums.
Check the affected flow on a demo and a fresh draft as well as the real trip.
Full-screen photos use a 350 ms blur-to-clear reveal on desktop and phones.
Desktop covers, journal images and thumbnails (including video posters) retain
their 650 ms reveal. Desktop reveals run on every appearance, including cached
revisits, and wait for readiness and visibility without re-fetching bytes.
Rapid selections cancel the previous animation, and reduced-motion preferences
disable the reveal. Cached phone revisits retain their immediate presentation.
The full viewer keeps its blurred preview underneath the desktop reveal until
the actual animation finishes, avoiding a dark flash when a new photo becomes
ready. Completion, cancellation and reduced motion clear this temporary backdrop;
loaded full-screen photos must have clean edges after the reveal.
Mobile swipe-neighbor images stay hidden on desktop, before initialization and
after closing; also check resizing an open viewer from phone to desktop width.
Check taps/clicks through the grid, location panel and Back without lingering
focus rings; Tab/Shift-Tab must still visibly identify the focused control with
the shared slim slate outline, including in dialogs. Focus indicators are never
orange; that color remains reserved for journey/album selections.
The next-day button has no pulsing halo at the end of an album.
The selected thumbnail keeps its separate album-selection border.

`--publish` uses Wrangler's owner authorization to upload to private R2. It
refuses public bucket settings, checks WebP metadata and content hashes, uploads
missing objects, then downloads and verifies every selected object before marking
its manifest published. It skips hidden/trash, refuses draft publication, and
never uploads originals, overwrites mismatched objects, commits or pushes.
Retries reuse matching objects. Use `--all` for a complete reviewed migration;
the default selects pending local photos. Both bulk imports and Studio share
this publisher and two-size pipeline. Credentials never enter the atlas page.

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

## Historical public Studio upload · 9 September 2026

The traveler approved 13 new photos and saved location/visibility edits for
public publication. Their 48 optimized WebP derivatives are in the
`switzerland-italy-family-2026-uploads-v1` Release; originals remain private.
Together with the saved visibility change, the family album now has 99 visible
photos, including photos on Days 8, 9, 11 and 14. The family day descriptions
and shortened Replay prose have been cleared; personal photo notes remain.

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

## Historical initial Switzerland–Italy import (before private migration)

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

Days without a visible family photograph use an intentional empty state, with
no stock or third-party fallback images. Day headings, routes and navigation
remain available. The Studio uploads above have now added photographs to all
14 family journey days.

## Local annotation with Atlas Studio

Run `npm run studio`, then open `http://127.0.0.1:4173/studio/`. The Studio uses
the ignored local WebPs in `build/private-photo-assets/v1/`, so reviewing
photos does not require Cloudflare login or repeated remote downloads.

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
originals or hosted R2 objects. When a located photo is highlighted in the
full-screen day viewer, the map moves to this exact coordinate and zoom.

## Generated image sizes and private publishing

See [PHOTO_AUTH_HANDOFF.md](PHOTO_AUTH_HANDOFF.md) for the implemented two-size
policy, authenticated loading, password maintenance and remaining cutover.
Unloaded photos use embedded 32 px blur placeholders; no third hosted image is
needed. Derivatives use content hashes and identical bytes reuse one object.
Only immediate full-screen neighbors preload, after authentication.

The old public GitHub Release publisher is retired. Do not create or repopulate
`trip-photos-v1` or `<journey-id>-uploads-v1`. Those historical Releases still need
removal during the verified privacy cutover. The historical import figures above
record earlier work; they are not instructions for future publishing.

Keep originals private. Review day/location assignments, strip derivative
metadata, upload through the private publisher, then deploy the matching manifest.
Hiding or trashing alone is not permanent media erasure.

## Apple references

- [Share photos and videos on iPhone](https://support.apple.com/guide/iphone/iphf28f17237/ios)
- [Export unmodified originals from Photos on Mac](https://support.apple.com/guide/photos/pht6e157c5f/mac)
- [Review or adjust photo information on iPhone](https://support.apple.com/guide/iphone/iph0edb9c18f/ios)

## Video sample boundary — 10 September 2026

Day-linked public MP4/WebM clips from a journey's optional `videos` list now
share the photo viewer, journal previews, album overview and phone grid. Tiles
show an opening-frame poster and play/duration badge. Supply a reviewed HTTPS
poster to avoid thumbnail video requests; absent posters are extracted once
per cached source in the browser when the host permits CORS. Opening a video
does not autoplay; switching media or closing releases it, and opening the
phone grid/backgrounding pauses it. See `JOURNEY_WORKFLOW.md` for the contract. The fictional
Nine to Como example uses the public [MDN video test](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/video),
with attribution and explicit test labeling; it is not actual trip footage.
No video binary or new photo binary is committed or republished.

The photo importer, private image derivative builder, image cache and photo
auth Worker remain image-specific. Do not upload videos through the photo
intake, or place a private video URL into a public manifest. Video transcoding,
private byte-range delivery under the existing access policy, captions and
Studio file-based video intake remain follow-up work before using private trip
clips. Hosted public video links are now editable in **Trip plan & media →
Videos**, including preview, duration, day/group assignment, title/caption,
poster, credit and publication controls. **Photo route groups** edits existing
photos' group assignments in their original manifests without changing image
files, other metadata, order or visibility. See `JOURNEY_WORKFLOW.md`.
