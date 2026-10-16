# iPhone photo workflow

Read [AGENTS.md](AGENTS.md), [OWNER_DECISIONS.md](docs/OWNER_DECISIONS.md) and
[PRINCIPLES.md](PRINCIPLES.md) before any photo intake or editing. The same
blank-copy, preserved-edit, reviewed-location and private-publication rules
apply to bulk imports, Studio uploads, manual manifests and every new atlas.
The [inheritance checklist](JOURNEY_WORKFLOW.md#new-atlas-inheritance-checklist)
includes visible-copy and sidebar checks after content is populated.

The atlas can use an iPhone photo's capture time and GPS position to associate
it with a day and show its location in the photo viewer. Day maps show sparse thumbnail bubbles alongside curated Places pins. Selecting
a bubble keeps its photo group and current photo stable while panning or zooming.
Stationary refreshes retain the bubble and its thumbnail load. A group can anchor
to another visible member if its first photo is offscreen or crowded by a place
pin, without reordering the album. Groups fully outside the view or without room
remain available in the album. Preserve the original metadata during
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
thumbnail (up to 480 px wide), preview (up to 1280 px wide) and full (up to 3200 px longest-edge) WebPs without enlarging small images, and creates
a tiny blurred preview. It strips EXIF/XMP from derivatives. Untouched originals,
camera timestamps, and candidate GPS stay under ignored
`photos/studio-uploads/<journey-id>/`. GPS is never turned into a public pin
without a manual location edit. HEIC uses macOS Quick Look; other still formats
use Sharp. Video and animated/multipage images are rejected.

**Your caption** and **Your notes** start blank. They are optional and contain
only the traveler's words. Place labels are optional traveler-written text too;
do not generate photo names, scene descriptions, city/GPS labels, or substitute
alt text or filenames into visible copy. Blank captions remain blank in both the
selected-photo card and full viewer. An unlabeled card uses the capture date/time
as its heading unless it has an owner-saved Place link. Keep capture timestamps,
reviewed pins and source filenames for identification in Studio. Resizing,
metadata extraction, asset upload, and manifest
updates are deterministic code tasks; no LLM or API key is needed. Accessibility
alt text is a separate field; new uploads use a neutral day-based label.

**Photos from** counts exactly the photos shown in the current Studio grid:
all non-trashed photos are included. The separate Hide from atlas feature was
removed at the owner's request on 14 September 2026; legacy `hidden` photo flags
are ignored throughout Studio, publication and the atlas. Deleted photos remain
in Trash and appear in Studio only with **Show trash** enabled.

Select a photo and choose **Move photo to trash**, then **Save locally**. It is
removed from the local preview, and from the live atlas after deployment. Use
**Show trash → Restore photo from trash → Save locally** to recover it. Trashing
preserves day order, pins, captions, and other metadata, and the cover
photo falls back to another visible photo. There is no separate Hide checkbox.
Trash is recoverable album deletion: originals and already-hosted private R2
objects remain. Permanent erasure requires checking every journey reference,
removing the exact unreferenced objects, and verifying their authenticated URLs.
The historical public Releases were retired during cutover;
see [PHOTO_AUTH_HANDOFF.md](PHOTO_AUTH_HANDOFF.md).

Uploads are saved immediately in an append-only intake manifest separate from
bulk imports: `content/photo-manifests/<journey-id>-uploads.json` for published
trips, or ignored `build/draft-assets/<journey-id>/uploads.json` for drafts.
Do not run a full camera reimport to add or delete a photo. Pending uploads have
`assetStatus: "local"`: Studio can review them, but production builds exclude
them until asset publishing succeeds. This prevents broken live photo links.

For another camera-folder batch, compare original SHA-256 hashes against both
the base and upload manifests before calling the incremental importer. An exact
repeat keeps its existing photo ID, day, edits and location. Record every supplied
file as imported, already present, or held for a stated reason. Give the owner
a filename/date list of new photos without GPS; leave their pins unset. Dates
outside the itinerary require an owner-selected album while retaining the real
capture date. No full reimport is needed.

Respect trip-specific ordering corrections when merging batches. Heading East
uses [chronological city albums](docs/HEADING_EAST.md#chronological-city-albums--12-october-2026)
across both manifests, saved through day `photoOrder` overrides. Preserve its
reviewed city assignments and use actual capture times; other trips retain
their existing editorial order.

For manual announcements after publishing, [update checkpoints](docs/UPDATE_ANNOUNCEMENTS.md)
count stable newly visible photo IDs by their saved city/day destination. Photo
edits, moves, reordering and restoring an already acknowledged photo do not
count as additions. Preparing or copying a message never advances the checkpoint.

## Batch editing in Studio

Choose **Media → Photos → Select multiple** for a contact sheet. Search filenames,
capture dates, captions, notes or locations, and use **Photos from** or
**Show trash** to narrow the view. **Select all shown** changes only the visible
selection. Changing filters keeps already-selected photos; the selection count
explicitly reports photos outside the current filter, with **Show selected** to inspect them. The contact sheet comes first; batch actions stay in the bottom action bar. **Clear selection** starts
over. Batch actions apply to every selected photo, including those outside the
filter. **Done selecting** returns to individual photo and map editing.

- **Assign to a day / stop** appends moved photos after the destination album's
  existing photos. It retains each source album's order, regardless of click
  order. Photos already assigned to that destination keep their place.
- **Move to start of each album** puts selected photos first within each of their
  current albums, preserving the relative order of selected and unselected photos.
  Restore trashed photos before reordering them.
- **Move to trash / Restore from trash** is the same recoverable deletion as the
  individual editor. It keeps original files, captions, map pins and album order.
  Legacy `hidden` flags stay untouched and ignored; batch editing does not restore
  the retired Hide feature.

Each operation validates the complete selection before changing any draft field.
**Undo batch** reverses the latest batch in this tab while preserving unrelated
later edits. If an affected field changed again, Undo refuses the whole reversal
and points to **Review / discard draft**. Undo is available until reload or a
journey switch; it is not a separate saved history. Reload still recovers batch
changes through Studio's normal browser/disk draft autosave, and saved edits use
the existing revision/conflict review. Switching journeys clears the selection.

Use **Save locally** to apply the edited draft to the sources, then preview and
publish through the normal agent workflow. Batch edits change overrides only;
intake manifests, originals and publication status remain intact.

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

On phones, Photos and View photos open the selected event’s grid. Selecting a
thumbnail opens that photograph in the journey camera roll, preserving event and
album order. Image swipes and clear previous/next photo arrows continue across
city/day boundaries; the distinct event bar supports city/day jumps, skipping
events without media. Its sideways swipe jumps events without competing with
image swipe/pinch. Explicitly selected Places collections retain their own scope.
The grid shows the current event (or that explicit collection). The top-left
photo and grid control says **Back**, with no destination name. Back and
pull-to-dismiss return one screen: a photo opened from a grid returns to that
grid with its scroll/selection, then Back returns to the grid’s presenting
screen. Keep that source grid mounted behind the fullscreen photo, with the
same thumbnail nodes, selection and scroll, even while foreground browsing
crosses days. Fade the photo background over this grid; never reveal the map or
a blank frame before the grid appears. Reuse the existing protected-image
bindings instead of cloning image pixels. Direct photo entry returns to its
presenting map/story/Places surface.
The All photos overview also retains its existing event tiles and scroll when
returning from a day grid or through browser history. Rebuild tiles only when
their content changes; restore dialog scroll after native focus on reopening.
Grid/photo transitions have distinct history entries, so browser Back/Forward
matches these controls; location reveal stays within its photo entry. Rapid Back
requests coalesce while a traversal is pending. Save the departing layer before
media refreshes can replace it. On return to a map, preserve its exact center,
zoom, bearing, pitch and scope for the same event; direct cross-event browsing
keeps the current event on the presenting surface. Capture the original map before photo/grid
entry can settle or refit it. This supersedes the map-only exit from the initial
12 October gesture release, following the owner’s same-day return-screen report.
Check grid → photo → pull/Back → grid → Back, direct map/story entry, album and
explicit Places entry, browser Back/Forward, Escape, grid scroll and explored map
cameras. Use the actual app callbacks, including synchronous media refresh.
Controls stay visible when the photo is tapped. Double-tap or pinch to zoom, and
drag upward or tap Photo location to reveal its map. Hide location collapses it without leaving the
photo. Pull an unzoomed still photo downward to dismiss fullscreen: the photo
follows the finger, shrinks slightly and fades the backdrop. A deliberate
pull or quick downward flick returns to the preceding screen through history;
a short, reversed or cancelled pull snaps back without changing the photo.
An open location panel collapses first; upward pulls reveal location, horizontal
swipes browse, zoomed drags pan, and a second finger cancels dismissal for pinch.
The gesture stays off grids, buttons and native videos. Reduced motion omits
shrink/settling animation. New input, photo changes, close and resize cancel a
pending dismissal so it cannot close a later viewer. Keep the visible Back
control and check same-event camera return, cross-event return, Back/Forward,
short/cancelled pulls, portrait/landscape photos and 320/390px plus landscape.
This implements the owner's 12 October “pull the photo away” request in O08.
Verify a quick hide-then-swipe keeps location closed. Full-trip Replay is disabled under O09; arrival/city playback remains on the
main map. Browse photographs through the event albums.
Keep selected-thumbnail scrolling inside the grid: grid selection and city
changes must leave fullscreen headers and footers at the viewport edges.
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
its manifest published. It skips trash, refuses draft publication, and
never uploads originals, overwrites mismatched objects, commits or pushes.
Retries reuse matching objects. Use `--all` for a complete reviewed migration;
the default selects pending local photos. Both bulk imports and Studio share
this publisher and three-size pipeline. Credentials never enter the atlas page.

On a slow or unreliable connection, append `--concurrency 1` to upload and
verify one derivative at a time, with progress after every verified file. The
default remains four parallel files; allowed values are 1–4. A retry checks and
reuses existing matching objects before uploading missing ones.
Each file gets up to three attempts after a network failure or timeout. An
uncertain upload is re-read and checksum-verified before any further upload;
authentication, HTTP failures and checksum mismatches still stop publication.

Studio retains draft recovery and saved baselines. Independent disk/draft edits
merge; conflicting fields require a saved/draft choice checked against the
current revision. Reload restores the unpublished draft, not permission to
overwrite newer work. Failed saves retain edits. See
[editing and regeneration](JOURNEY_WORKFLOW.md#editing-and-regeneration).

## Removal of generated copy · 9 September 2026

Compared saved photo copy with the original editorial review in commit
`4801801`: cleared 95 unchanged generated captions and 89 generated descriptions.
Three traveler-edited captions and three personal descriptions were preserved,
along with existing blank fields, all pins, visibility, and ordering. Accessibility
alt text remains separate. A private pre-migration snapshot is in
`build/studio-backups/before-generated-copy-removal.json`. Do not regenerate the
removed prose. Future imports leave both visible text fields blank.

## Historical public Studio upload · 9 September 2026

Historical record only: the public Releases described here were subsequently
retired during the private-media cutover. Use the private publisher above.

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
but unlocated rather than receiving an inferred viewpoint. The original review hid nine images. The owner removed the Hide feature on
14 September 2026: previously hidden photos now appear in the atlas unless they
were also moved to Trash. Deleted photos remain deleted.

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

Bulk intake also accepts DNG stills through macOS Quick Look, preserving the
untouched RAW originals privately. Capture labels retain the actual ISO date
and local time, including within multi-day city albums. Undated TBD stops are
skipped during date matching, so a planned onward itinerary does not block
imports into its dated portion. On transfer dates, review camera GPS and move
departure-city photos back to that city's album when needed. GPS pins require
review; missing GPS stays unlocated until the owner places it in Studio.
Both intake paths read the raw GPS coordinate/reference tags before converting
them to signed coordinates; GPS candidates stay in the private report until
reviewed location overrides are saved.

The importer treats naive EXIF timestamps as journey-local camera time; the
computer host time zone never participates. Review camera-clock mistakes manually.

## Video and fallback-media decisions

The six held family MOV files remain private and are not part of the public
atlas. Private-video intake and protected delivery were implemented on
8 October; use the documented Studio video workflow when a clip is authorized.
Do not redesign a pipeline that already exists or pass MOV files through the
still-photo importer. Existing held footage still needs clip-specific review
and publication authorization.

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
3. Optionally supply your own place label. Pan and zoom, then choose **Use current map frame**
   to save the visible area independently of the photo’s pin. **Show saved frame**
   restores it; **Reset frame to pin** uses the saved 2–20 zoom around the pin.
   Existing photos infer their frame automatically from their pin and zoom.
4. Optionally write your own caption or notes. Leave them blank when unwanted;
   generated prose must not be added.
5. Move unwanted photos to Trash. All other photos remain in the atlas.
6. Use **Move earlier** and **Move later** to establish the daily album order.
   The first visible photo is the day preview; choose the journey cover separately.
7. Choose **Save locally**. Review the JSON diff before committing.

Saves write `content/photo-overrides.json` and rebuild the static
`dist/assets/content-overrides.js` consumed by the atlas. They do not modify the
originals or hosted R2 objects. A custom frame is stored as `mapFrame.bounds`,
two `[longitude, latitude]` corners (southwest and northeast), separate from
`location` and `zoom`. The viewer fits this area to its screen; existing photos
without bounds retain their pin and zoom. When both pins are already visible,
photo navigation keeps the map still. Longer moves use a quadratic zoom arc
with a 40 ms apex pause. Replay continues to frame its routes and days.

## Generated image sizes and private publishing

The shared pipeline makes up to three sizes: 480 px thumbnails, 1280 px previews
and full photos capped at a 3200 px longest edge, without upscaling. Unloaded
photos use embedded 32 px blur placeholders. See
[PHOTO_AUTH_HANDOFF.md](PHOTO_AUTH_HANDOFF.md) for authenticated loading and
password maintenance. Derivatives use content hashes and identical bytes reuse one object.
The shared loader prioritizes visible media and bounded full-screen neighbors,
then warms event previews/thumbnails within its cache/request limits after
authentication. Replay performs no photo preloading.

The old public GitHub Release publisher is retired. Do not create or repopulate
`trip-photos-v1` or `<journey-id>-uploads-v1`. Both historical Releases were
removed during the verified privacy cutover. The historical import figures above
record earlier work; they are not instructions for future publishing.

Keep originals private. Review day/location assignments, strip derivative
metadata, upload through the private publisher, then deploy the matching manifest.
Trashing alone is not permanent media erasure; the old Hide feature is retired.

## Depth-motion review boundary — 14 October 2026

The [standalone fullscreen preview](docs/DEPTH_FULLSCREEN_DEMO.md) uses
precomputed depth with live browser rendering and starts off. The 15 October
owner correction returns motion to the original gentle range while keeping
drag/held viewpoint/reset and mouse interaction; it supersedes the stronger
0–3× experiment. Exact controls and limits belong in the demo record.

The owner also authorized seven existing website photographs alongside the two
public samples. Prepare depth only for those selected photographs, preserving
their source pixels, metadata choices and traveler-written/blank copy. Keep
source derivatives and new depth maps in private R2 behind the existing photo
gateway and normal shared unlock; do not copy protected image/depth pixels into
the public demo, its manifest or encoded previews. Verify authenticated hashes,
anonymous rejection and expiry cleanup. The exact selection and preparation
record belong in [DEPTH_DEMO_ASSETS.md](docs/DEPTH_DEMO_ASSETS.md).

The remote demo remains a bounded review artifact. This authorization does not
extend to bulk depth processing, new public photo publication or integration
into trip viewers. Any later approved integration must retain the photograph's
private access, review, loading and expiry rules, still-image fallback and the
existing gallery gestures/state.

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

The ordinary photo importer still rejects videos. Use **Media → Videos → Add a private video** for local clips. Private delivery now shares the
existing photo password policy and R2 bucket, using a separate range-aware video
route; public MDN playback is unchanged. **Photo route groups** continues to edit
existing photo assignments without changing their files.

## Private video intake and publishing — 8 October 2026

Install FFmpeg/ffprobe (`brew install ffmpeg` on macOS; `apt-get install ffmpeg`
on Linux). `ATLAS_FFMPEG` and `ATLAS_FFPROBE` may specify executable paths. The
build itself never transcodes existing assets. Tests use generated color/motion
and sine-wave footage, not family originals; CI ensures FFmpeg is available.

Studio requires a file, title and journey day. It accepts MOV/MP4/M4V/WebM up to
250 MiB and five minutes. FFmpeg prepares one fast-start H.264/AAC MP4, at most
1280 pixels on either edge, 30 fps, with bounded video/audio rates. It drops
metadata, chapters, subtitles/data tracks and prepares a metadata-stripped WebP
opening-frame poster. Original bytes and full probe metadata stay under ignored
`photos/studio-video-uploads/<journey>/`; derivatives stay under ignored
`build/private-video-assets/v1/` and `build/private-photo-assets/v1/`.
Private speech transcripts and timed captions are rejected until protected text
delivery is available. Titles and brief editorial notes remain public journey
text, like existing photo captions. Public videos may use supplied transcripts
and timed captions. Repeated imports preserve existing days and edits. A failed conversion leaves
journey sources unchanged. Source revisions, local draft recovery and backups
preserve editorial work during later saves.

The upload reports measured transfer progress, then an indeterminate preparing
stage while FFmpeg runs. Cancel is available during transfer only; it cannot
promise to stop a conversion already accepted by the server. A persistent status
and View in Media action retain access across workspaces. Journey switching is
blocked during the import, and reload/close uses an unload guard. Connection
failure explains how to retry; checksum deduplication prevents duplicate clips.

Preview locally before publishing. Six previously held family MOVs remain held:
implementing this pipeline does not authorize publishing those clips. For a
specific reviewed clip, run a dry run and then the explicitly authorized upload:

```sh
npm run videos:publish -- --journey <id> --video <video-id>
npm run videos:publish -- --journey <id> --video <video-id> --publish
```

Dry run checks local hashes, sizes, metadata and encoding with no network writes.
Publish first verifies public bucket access is disabled and reads account-wide
R2 metrics. It stops if usage is unavailable or projected payload/metadata usage
would exceed a conservative 9 GB ceiling. This leaves headroom below Standard's
10 GB-month allowance, but is not an account-wide billing cap; concurrent usage,
monthly operations and analytics lag still require review. No paid plan or media
service is introduced. The R2 [account metrics endpoint](https://developers.cloudflare.com/api/resources/r2/)
is the preflight source.

Upload writes only missing immutable objects, checks every remote byte against
SHA-256, and never replaces an existing object on mismatch. Only then does the
exact verified video/poster pair become `assetStatus: "published"`; failures keep
local status so reruns are safe. The public build excludes local/hidden clips.
Commit the reviewed source/generated output and deploy the shared Worker/site
normally. MP4 objects use `video/v1/<hash>.mp4` in the existing private bucket;
posters use `v1/<hash>.webp`. Nothing uploads original footage.

Native playback requests a scoped grant using the current photo bearer in a POST
header. Its URL contains a separate grant for one immutable MP4, one allowed
origin, and at most ten minutes or the remaining photo session, whichever is
shorter. Every range/HEAD request checks signature, expiry, active credential and
signing key before touching R2. Signing-key rotation or credential removal revokes
it. Grants cannot authorize other videos or photos. The Worker streams ranges
without buffering clips, returns 206/416 correctly, and sends no-store/no-referrer
headers. Client locking stops playback; a paused clip whose grant expires can be
retried to obtain fresh access. The gateway and R2 remain on the existing plan;
video reads perform one HEAD plus a bounded GET and count against usage limits.

## Editing reliability — 12 September 2026

Owner follow-up, 12 October 2026: **← / →** and the Previous/Next photo buttons
browse the current day/search/Trash filter in album order, stopping at its ends.
Arrow keys remain ordinary cursor/control keys while typing, using the map,
inside a dialog or selecting a batch. Clicking a thumbnail after editing switches
on the first click; blur/change must not replace its pointer target.

Each selected photo shows a check with **Saved locally**, or a labeled unsaved,
saving or failed-save state. This compares its copy, pin/frame, day, Trash and
album order with the acknowledged local source snapshot. Other photos' changes
do not make an unchanged photo look unsaved. Typing during an outstanding save
stays unsaved until a later acknowledgement includes it. Draft recovery autosave
does not earn the saved check; use **Save locally** to apply changes. Publishing
remains separate. Check reference, demo and an independently populated draft.

Data-safety follow-up, 12 October 2026: capture every photo input immediately,
including raw latitude/longitude/zoom before blur. Unfinished or invalid numbers
remain in the browser/disk recovery draft and its review/download; they keep
the previous valid pin and block Save with a focused correction. They must never
silently clear a pin or discard coordinate precision. Preserve authored text
exactly. Save only changed fields: blank defaults must not overwrite independent
edits merged from disk. Refresh merged fields without moving the typing caret.
Keep a custom map frame through intermediate coordinate keystrokes; validate the
final pin/frame pair on blur or Save. A chosen zoom survives even before a pin
is placed. Switching photos, journeys or modes retains unfinished fields. Editing
away from a search/day match keeps the selected photo until deliberate navigation
or a filter change. The editor stays disabled until sources and recovery load.

Save acknowledges only the sent snapshot; later input stays dirty. Restore and
discard cannot replace newer typing or race an active Save. Discard requires an
acknowledged recovery archive. Each tab owns its recovery stream, including
Duplicate Tab; old draft streams remain recoverable during migration. Browser
storage failures keep a close warning until disk autosave succeeds, and failed
recovery reads never clear an unread draft. Test these failure/race paths, lost
responses and source rollback as behavior, not just successful Save clicks.

Changing **Photos from** selects a photo in that day or clears the editor when
there are no matches. The complete upload form scrolls within its panel on a
phone. Save status and **Preview atlas** remain visible at tablet widths.
If you keep editing during a save, the acknowledged snapshot is saved and the
newer edits remain visibly unsaved. Save again to persist them. Failed saves
retain the edits and the warning on leaving the page.

Phone photo captions appear in **Details & location**. Grids defer full photos
until selection; swipe neighbors use the full-photo cache without promoting
speculative work to a foreground download. Public-photo Retry uses the public
loader and never asks for private-photo access.


## Sharing a photo or view

Owner-approved under [O18](docs/OWNER_DECISIONS.md#photo-and-view-sharing--12-october-2026),
12 October 2026. The address bar follows day/city selection, a selected sidebar
or map-card photo, and fullscreen/grid entry. The shared hash uses stable `day`
and optional `photo` IDs, `view=map|story|photo|grid`, and `scope=journey` for an
overview. Existing `#photo=…`, `?photo=…` and day links remain supported. Explicit
view links survive reload; bare journey URLs keep the usual introduction.

Share photo sits beside the lead/selected photo. In desktop fullscreen it sits
in the right sidebar beside the photo count, below the day controls; phone
fullscreen uses its header Share control. It shares the atlas page through the
native device sheet where available. Otherwise it copies the link with a brief “Link copied” status; denied clipboard access opens a
selectable link. Cancelling the share sheet does nothing. Shared links carry only
journey/group context and the view hash, never media URLs, access credentials or
local preview switches. Local previews still yield local links; they do not
claim a draft is published. Private media retains the normal unlock flow and
returns to the requested view. Restoring a link writes its final URL synchronously
before authentication can capture the return hash; a pending unlock prompt stays
above the restored photo viewer. Ordinary navigation updates
wait until the surface event settles. Removed/unknown photos fall back to a valid day.

Photo browsing uses `replaceState`, preserving the existing surface history.
Opening/closing photos, grids and conversations still follows O03/O08; Back does
not walk through every swipe. URL synchronization runs after a selection settles,
and history traversal is restored by the existing surface controllers. Exact
map camera coordinates and collection membership are not serialized; recipients
start the ordinary photo roll, while existing in-tab Places collections remain
unchanged. No new visitor-resume storage is introduced.

Check reference, city-stay atlas, demo and independently populated draft:
selected photo versus fullscreen fresh links, day/overview, cross-event browsing,
reload, grid → photo → Back, browser Back/Forward, locked/unlocked photo entry,
invalid/deleted IDs, native share cancellation and clipboard denial. Verify a
320px phone header, landscape and desktop controls without overlaps.

## Comment counts and read state

Photo Comments actions inherit the shared notification contract: a red numbered
badge for unread comments and a plain total otherwise. Read IDs stay locally
scoped to the trip; the top-right bell opens its most recent conversations.
Preserve the presenting collection and unfinished text when opening a comment.
See [the complete contract](docs/PLACES_AND_COMMENTS.md#comment-notifications)
and [owner decision O17](docs/OWNER_DECISIONS.md#comment-notifications--11-october-2026).


## Link photos to Places

Open **Studio → Places**, choose a place, then use **Trip photo links**. Link
existing photos, unlink them, or move them earlier/later in the place's selection.
Use **Edit photo** for the ordinary caption, day, location, map frame and Trash
controls. These remain the same photos and keep their original privacy policy.
A link never assigns GPS. Unlocated linked photos remain browseable; Locate is
disabled until a known photo location exists. Trashed photos retain their saved
links and return when restored, but never appear in the public selection.

Only explicitly saved links associate photos with Places. GPS proximity never
creates a photo label, an About button or a nearby-photo suggestion, even when a
photo and venue share coordinates. Venue/landmark imagery has its own public
credits and source links, separate from the trip album. Place membership and
order remain owner-controlled.

Desktop days stay on the left, the map in the center and the journal/photo
sidebar on the right. Under the owner's later 11 October clarification, clicking
or keyboard-activating a map circle bubble (including a cluster) or a thumbnail
in the right-hand reel selects the photo in that existing sidebar, without
opening fullscreen. The large top-right selected/lead image opens fullscreen
directly in one activation. Selection must not add another photo panel. Existing
album/grid and explicitly linked Places viewer entry retain their flow. Ordinary
desktop sidebar arrows browse every visible trip photo in event/album
order, even after entry through a small map cluster; the adjacent reel still
shows the current city/day. Ordinary fullscreen on both desktop and phone uses
the continuous journey camera roll. Its filmstrip/grid shows the current event,
while arrows continue across event boundaries and event jumps skip empty albums.
Desktop Comments preserve this same trip order and the selected photo on return.
Explicitly selected Places collections alone keep their own order/count through
comments, fullscreen and grids. The owner's later 11 October desktop follow-up
(O03) supersedes the previous desktop entry-day/map-group restriction.
Keep a clicked map group's geographic members separate from browsing membership:
continuing to another photo must not merge the entire city's map bubbles.

The existing sidebar frame remains uncropped and stable across portrait and
landscape photos, with adjacent thumbnails and expandable day details. Hovering
the large photo must retain its blue background without a white flash; its image
button stays transparent instead of inheriting the toolbar's pale hover fill.
Check pointer entry/exit with both photo orientations and retain keyboard focus.
Only traveler-supplied captions appear. An About-place action requires an explicit
saved link. Phone map screens have one date/title block and Photos action,
contextual Places and secondary arrival controls, plus one bottom event picker.
Phone map bubbles select the existing compact photo card; its large image opens
fullscreen. Event grids lead into the continuous phone camera roll (O08).

Map bubbles retain their representative image at its actual location. Album and
Places browsing do not regroup map bubbles; only a clicked map group retains its
membership while zooming. Cross-day selections draw only that day's members.
Before any displayed day/stop change, close the old map popups and hover previews
and cancel pending opens so they cannot clutter or reappear over the new map.
Changing days, including through fullscreen photo navigation, clears the previous
day's map selection. Auth expiry
clears protected photo pixels from bubbles and the card; unlock uses the existing
photo service.
