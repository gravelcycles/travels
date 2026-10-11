# Travels — Journey Atlas

A static, GitHub Pages-friendly atlas. The root is an index of real journeys;
David and Michelle's Switzerland–Italy family journey has its own stable page
at `switzerland-italy.html`. Fictional viewer examples live separately at
`demo.html`.

## Project guide

Read [WIP.md](WIP.md) for current workstreams, checkpoint branches, review
decisions, task context and recovery references before starting new work.

Trips are instances of one shared framework. New features belong in its shared
template or runtime and carry into existing trips, samples, and new drafts.
Switzerland–Italy is the reference experience; starting another trip adds data,
not another copy of the application.

- [Framework, audit, and remaining work](docs/FRAMEWORK.md)
- [Design and interaction principles](PRINCIPLES.md)
- [Feature inventory and required trip data](docs/FEATURES.md)
- [New-trip and shared-feature prompts for agents](docs/AGENT_PROMPTS.md)
- [Step-by-step trip creation and publishing](JOURNEY_WORKFLOW.md)
- [Standing agent rules](AGENTS.md)

These guides describe current contracts. Dated handoffs, audits, and changelog
entries record history and may describe behavior that has since changed.

The catalog uses compact photo rows under **We wander but aren't lost...yet**, sized to show
roughly 4–5 journeys on a laptop and 2–3 on a phone. Only published real trips
appear; demo journeys remain separate. The family trip is titled
**Switzerland & Italy · Family trip**.

## Private photographs

The photo-only Cloudflare implementation supports multiple shared passwords and
30-day remembered access. Private WebP thumbnails, previews and full photos replace originals; tiny
embedded blurs remain public. The site address stays on GitHub Pages.
**Password protection is live, and both historical public photo Releases have
been removed.** See [PHOTO_AUTH_HANDOFF.md](PHOTO_AUTH_HANDOFF.md)
for the current deployment state and password maintenance.

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
ignored local derivatives instead of authenticated Cloudflare requests.

- `/dist/` lists all real journeys.
- `/dist/switzerland-italy.html` opens the real family journey.
- `/dist/demo.html` shows only the sample journeys and includes a selector.

## Manage photos in Studio

In **Photos**, expand **Upload photos**, select multiple files, and click
**Add photos locally**. Capture dates automatically assign each photo to its
journey day; unmatched dates get an individual day picker. You can also choose
a destination day explicitly. Resizing and metadata processing are automatic. New
captions and notes are blank. **Move photo to trash** and **Show trash** provide
recoverable deletion and restore; save those changes locally.

Photo publishing is automated through `npm run photos:publish -- --journey <id>
--publish`, followed by the usual site deployment. Pending assets stay out of
production until uploaded and verified. See [PHOTO_WORKFLOW.md](PHOTO_WORKFLOW.md)
for the full agent-operated flow and what Trash does to existing hosted assets.

## Browse photos

Open a day's album with **View photos** directly below its first photo, or use
**All photos** to choose a day. Day previews use the first visible photo in
the saved album order, so clicking them opens photo 1. Travel legs are always expanded below the day
heading. Daily descriptions can be left blank; no placeholder prose is shown.
Photo thumbnails and groups are no longer displayed on the journey map.
Saved photo locations remain available in Studio and the photo viewer. The
current viewer thumbnail has an orange outline, with no Selected text badge.

When both photo pins are already in view, the viewer map stays still. Nearby
moves go directly to the next view; longer moves use a parabolic zoom arc with
a brief 40 ms pause at the widest view. Saved map frames preserve the composed
area on different screen sizes. Older photos automatically use their saved pin
and zoom. Reduced motion skips animation; unlocated photos use the day’s context.

## Replay a trip

Open a journey and choose **Trip replay** or **Relive the trip**. Playback starts
automatically after two seconds; Pause cancels the countdown. Closing, changing
moments, or hiding the tab also cancels pending autoplay. Replay follows every day's travel
legs in their stored order, retaining each mode's map color and line pattern as
the route accumulates. Playback starts at **2×** by default, with 50% longer holds for rest days
at that speed. The 1× timing is unchanged. It includes
play/pause, half/normal/double speed, day
step buttons, a day timeline, keyboard controls, and a completion state.

During travel, Replay frames each active route leg even when a chapter displays
a photograph. The accompanying photo's zoom cannot override route framing.
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
to set the exact location and preferred map zoom. Captions, notes and place labels
are optional traveler-written text; leave them blank unless the traveler supplies
them. Pan and zoom to compose the surrounding area, then choose
**Use current map frame** to save its bounds separately from the pin. The dashed
outline shows the saved frame; existing photos infer one from their pin and zoom.
Selecting another photo in the same day keeps the working view, so nearby pins
can share a frame. **Show saved frame** restores it; **Reset frame to pin** returns
to automatic framing. Moving a pin inside a custom frame preserves that frame;
moving it outside resets to automatic framing. The photo viewer uses the saved
frame; Replay retains its route/day camera.
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
checked-in manifest references protected WebPs in private Cloudflare R2.

Use the Switzerland–Italy photo workflow as the reference: **no generated photo
names, captions, descriptions or location labels**. Visible copy stays blank
unless the traveler writes or supplies it. Never display accessibility `alt` text
or original filenames as substitute captions. Keep source filenames as editor
identifiers, and retain actual capture dates/times and reviewed map coordinates.
Do not infer photo–place links from GPS proximity. Place labels and “About”
buttons require an explicit link saved by the traveler in Studio.

For an initial folder import, select the journey and source explicitly:

```sh
npm run photos:build -- --journey <journey-id> --source photos/<folder>
```

1. Preserve untouched originals, including HEIC and DNG. On macOS, the bulk
   importer decodes HEIC/DNG through Quick Look and creates metadata-stripped
   WebPs: up to 480 px wide, 1280 px wide and 3200 px on the longest edge, without
   upscaling, plus a tiny embedded blur. Upload these derivatives, never RAW files.
2. Check the import report against the source count. Review capture-date matching
   in the journey time zone, especially transfer days and multi-day city albums.
   Keep the actual photo date/time, not the album's start date. Review GPS before
   saving exact pins; missing GPS stays unset until the traveler places it. Do
   not guess a viewpoint or add labels such as “city · camera GPS.”
3. Preview through Studio using local derivatives. Preserve existing day/order,
   pins, frames, cover and traveler-written edits. Bulk import replaces the
   journey manifest; use Studio's incremental upload for later additions, and
   edit overrides directly for text-only cleanup. Do not rebuild or re-upload
   image files just to change captions.
4. Dry-run the private publisher, then upload and verify the reviewed assets:

   ```sh
   npm run photos:publish -- --journey <journey-id>
   npm run photos:publish -- --journey <journey-id> --publish --concurrency 1
   ```

   One file at a time is suitable for poor Wi-Fi. Retries verify and reuse
   matching uploaded objects. Originals and derivatives remain ignored locally;
   only the manifest and editorial metadata belong in Git.
5. Run `npm test` and `npm run build`, review and commit the source changes and
   generated output, integrate remote `main`, then deploy. Verify Pages succeeds
   and a fresh public page shows the expected count and text. Update the private
   service's asset index when adding/removing eligible photo IDs; text-only edits
   need only the site deployment.

The importer writes `content/photo-manifests/<journey-id>.json`; the site build
generates `dist/assets/trip-photos.js`. See [PHOTO_WORKFLOW.md](PHOTO_WORKFLOW.md)
for the complete review and private publishing flow.

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

The workflow serializes releases without interrupting an active deployment.
If Pages fails, it checks this workflow's latest 100 runs for older failed
attempts and checks the current failed attempt. It cancels orphaned Pages jobs,
waits for cancellation and a 30-second lock-release delay, then retries once
using the same validated artifact. Successful and other live releases are
preserved. Permission/content errors remain failures; a failed retry is cleaned
up and the workflow stays red. See [the recovery runbook](docs/DEPLOYMENT.md).

The project uses relative browser asset paths. Link-preview metadata uses the
absolute public URL in `content/site.json`; the expected site URL is:

`https://gravelcycles.github.io/travels/`

The globe-pin icon and share card are common to every page. For source artwork,
icon generation and preview checks, see [the brand workflow](docs/BRANDING.md).

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
