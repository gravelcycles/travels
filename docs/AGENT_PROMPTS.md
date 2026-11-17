# Prompts for future agents

These prompts are copyable task briefs. Repository `AGENTS.md` applies even
when a prompt omits a detail. Read [OWNER_DECISIONS.md](OWNER_DECISIONS.md) and
[PRINCIPLES.md](../PRINCIPLES.md) first; no prompt resets prior corrections.
The user supplies facts and editorial choices;
the agent operates Studio, commands, QA and publishing.

Every brief also includes maintaining the docs as a live artifact. Follow the
[correction update procedure](OWNER_DECISIONS.md#record-the-next-correction-before-closing-the-task):
capture follow-up direction during the task, update its shared or trip-specific
home, reconcile superseded instructions and complete the documentation check
before delivery. A copied prompt is an entry point into current guidance, not
a frozen version of it. Include this obligation when writing any new brief.

## Start a new trip

> Follow the current AGENTS.md's reading order and live-documentation completion
> rule, including docs/OWNER_DECISIONS.md,
> PRINCIPLES.md, the framework/feature guides and JOURNEY_WORKFLOW.md.
> Create a new trip named [title], from [start date] through [end date], using
> time zone [IANA zone] and stable URL name [slug]. Use Studio’s + New trip or
> journey:new to create an ignored local draft. If the identity/calendar is
> incomplete, ask only for the missing essentials and continue organizing the
> supplied facts. Do not clone a trip page or copy the family itinerary.
>
> Treat the trip as data for the existing shared framework. It must inherit
> the Switzerland–Italy experience: opening, calendar/journal, ordered transport
> legs, map focus/inspection, albums, photo viewer, protected photo loading,
> arrival/city playback, mobile/direct entry and Studio editing. Add actual places, routes,
> photos and editorial choices as provided; do not invent precision or prose.
> Choose calendar days or city stays from the request. Read PHOTO_WORKFLOW.md
> before either bulk or Studio intake and ROUTE_GEOMETRY_WORKFLOW.md before
> route construction. Keep captions/notes/labels blank unless supplied; do not
> associate photos with venues by proximity. Complete authorized route research
> and network geometry with honest provenance, rather than stopping at guides.
> Keep full-trip Replay disabled (O09); preserve any existing saved chapters.
>
> Preview this draft through Studio’s normal shared page. Complete the workflow's
> inheritance checklist for blank states and the supplied content, including the
> actual event model. Compare the established photo/sidebar/map/mobile behavior
> with the reference; shared code alone is not sufficient acceptance. For a missing
> capability, implement it once in shared code, following the framework rules,
> and verify the existing family trip and a sample too. Keep IDs and the slug
> stable. Record what is ready and what inputs remain. Keep the draft local
> until its reviewed sources are promoted under the documented workflow;
> deliver completed authorized shared changes using the standing deployment
> rules. Do not publish invented content or private originals.

New-trip intake can start with just a name and date range. Set the photo
time zone from confirmed trip facts before importing images. The CLI's UTC
fallback is not evidence about where the traveler was.

## Add or change a feature

> Follow the current AGENTS.md's reading order and live-documentation completion
> rule. Identify the OWNER_DECISIONS requirements
> that this change must preserve. Implement [requested
> behavior] in the shared template or runtime so existing journeys, samples,
> and newly created trips inherit it. First locate the common implementation
> and describe what is trip data versus reusable behavior. Do not branch on a
> concrete trip ID or fork HTML/JS/CSS. Use existing editorial fields where
> possible; any necessary new optional field needs validation, an absent-value
> default, a documented use case and both present/absent checks.
>
> Preserve concurrent edits and the Switzerland–Italy experience. Verify the
> affected behavior on that trip, a sample and a fresh data-only draft. Add a
> meaningful regression for the behavior or contract, update docs/FEATURES.md,
> the relevant workflow and any changed owner decision. Reconcile contradictory
> quickstarts/handoffs, run tests/build and commit regenerated outputs.
> Fetch/integrate latest main, deploy, verify Pages and inspect fresh public
> content. Report the delivered behavior and any material limitation.

## Prototype map and transit animation options (local demo)

> **Map Lab: five ways to draw the journey.** Build a lightweight, standalone
> local demo that compares **five very different concepts** for the Journey
> Atlas map experience. Use real data borrowed from the app. This is a
> proposal/demo task under [O15](https://github.com/gravelcycles/travels/blob/main/docs/OWNER_DECISIONS.md#standing-decisions-and-acceptance-checks):
> do not change the shared viewer, do not deploy, and do not merge to `main`
> until the owner picks a direction.
>
> **Read first** (current guidance on `origin/main`):
> - [AGENTS.md](https://github.com/gravelcycles/travels/blob/main/AGENTS.md)
>   for reading order and the live-docs rule.
> - [OWNER_DECISIONS.md](https://github.com/gravelcycles/travels/blob/main/docs/OWNER_DECISIONS.md)
>   (especially O05–O07, O09, O14, O01/O02, O20–O22 and the Apple-like
>   definition), and [PRINCIPLES.md](https://github.com/gravelcycles/travels/blob/main/PRINCIPLES.md).
> - [PLACES_AND_COMMENTS.md](https://github.com/gravelcycles/travels/blob/main/docs/PLACES_AND_COMMENTS.md#photos--places--current-contract)
>   for how photos and curated places appear on the map today.
> - How it works today:
>   - [ARRIVAL_CITY_DEMO.md](https://github.com/gravelcycles/travels/blob/main/docs/ARRIVAL_CITY_DEMO.md)
>     and [arrival-chapter.js](https://github.com/gravelcycles/travels/blob/main/dist/assets/arrival-chapter.js)
>     (leg animation)
>   - [opening-route.js](https://github.com/gravelcycles/travels/blob/main/dist/assets/opening-route.js)
>     (3 s whole-trip trace)
>   - [LOCATION_LABELS.md](https://github.com/gravelcycles/travels/blob/main/docs/LOCATION_LABELS.md)
>     and [location-labels.js](https://github.com/gravelcycles/travels/blob/main/dist/assets/location-labels.js)
>     (signposts/pins)
>   - [photo-bubbles.js](https://github.com/gravelcycles/travels/blob/main/dist/assets/photo-bubbles.js)
>     and [photo-places.js](https://github.com/gravelcycles/travels/blob/main/dist/assets/photo-places.js)
>     (photos on the map)
>   - [places-panel.js](https://github.com/gravelcycles/travels/blob/main/dist/assets/places-panel.js)
>     (curated place pins)
>   - [map-style.js](https://github.com/gravelcycles/travels/blob/main/dist/assets/map-style.js)
>     and `modeStyles` near the top of [app.js](https://github.com/gravelcycles/travels/blob/main/dist/assets/app.js)
>     (basemap and mode styles)
>   - `decodeRoute` in [atlas-utils.js](https://github.com/gravelcycles/travels/blob/main/dist/assets/atlas-utils.js)
>     (encoded route polylines → `[lng,lat]`).
>
> **Scope.** In: the map, a minimal day/stop chooser, the whole-trip overview
> and its opening animation, train/transit animation between places for each
> leg, curated places, and photos displayed on the map. Out: the full-screen
> photo viewer, albums, comments, unlock and Studio.
>
> **Real data.** Load the generated public bundles directly; do not copy or
> fork them. Each bundle defines `JOURNEY_ATLAS_DATA`, `JOURNEY_ATLAS_PHOTOS`,
> `JOURNEY_ATLAS_ROUTE_GEOMETRY` and `JOURNEY_ATLAS_CONTENT_OVERRIDES`. They
> live in [dist/assets/journey-data/](https://github.com/gravelcycles/travels/tree/main/dist/assets/journey-data):
> - **Backpacking Europe: Heading East** (`trip-backpacking-europe-heading-east.js`):
>   city mode, 31 stops, 50 train and bus legs, a TBD
>   tail with undated stops, city boundaries, 27 curated food places and over
>   200 located photos. This is the main fixture.
> - **Switzerland–Italy** (`trip-switzerland-italy-family-2026.js`): day mode,
>   the reference trip. Train, ferry, bus, gondola, bike and walk,
>   with intermediate rail stops.
> - **Demos** (`demos.js`): *Nine to Como* has three route groups and a meetup;
>   *Alpine Crossing* has public photos and sample places.
> - Optionally *Florence–Genoa* (`trip-florence-genoa.js`): bike only, no
>   photos. Use it for the empty-photo state.
>
> Apply `CONTENT_OVERRIDES.days[id].photoOrder` and the photo overrides
> (location, `mapFrame`) the way the viewer does. Skip trashed photos.
>
> **Transport vocabulary** (current; patterns matter more than colours):
> train `#0072b2` solid · ferry (`boat`) `#007f8b` short dash · bus `#a85c00`
> long dash · gondola `#7b4ba3` spaced dots · walk `#3d4a4d` fine dots · car
> `#a43a2f` dash-dot · bike `#24804f` medium dash. TBD legs are dotted with no
> casing. Brand blue is `#006f92` and selection orange is `#d4512c`.
> Coordinates are `[lng, lat]`.
>
> **Photo privacy (O14, hard rule).** Real trips' photos are `protected`. The
> photo service only accepts the public site's origin, so a local demo cannot
> load them.
> - Show real-trip photos with their public embedded `blur` previews, as
>   blurred circles, tiles or polaroids at their true coordinates. Use the
>   public demo photos in `dist/assets/photos/` where sharp images matter.
> - Never copy, download, re-encode or commit private derivatives or
>   originals.
> - Never write a password into code, docs or commits.
> - Only owner-linked `point.photoIds` associate photos with places. No
>   proximity guesses, no generated captions (O01/O02).
>
> **Build.**
> - Put everything in a self-contained folder, `prototypes/map-lab/`. It is not
>   under `dist/`, not in the build, not linked from the catalog, and no shared
>   runtime/template/CSS/test or journey source may change.
> - One `index.html` shell:
>   - an option switcher (1–5) and a trip switcher;
>   - a compact day/stop picker plus previous/next and "whole trip";
>   - a Replay/Skip control and a reduced-motion toggle;
>   - the state in the URL (`?option=3&trip=…&event=…`) so the owner can share
>     a specific view.
> - Each option is its own module (`options/01-…js`) behind a small common
>   interface: `mount(container, data)`, `showOverview()`, `selectEvent(id)`,
>   `playLeg(id)`, `setReducedMotion(bool)`, `destroy()`.
> - Shared data loading and decoding go in one `data.js`.
> - Libraries:
>   - Prefer the vendored MapLibre 5.24.0 in `dist/assets/vendor/`.
>   - You may add modern libraries for the demo only (for example deck.gl,
>     three.js, a MapLibre globe or terrain setup, or Canvas/WebGL shaders).
>     Load them from a pinned-version CDN or vendor them inside the prototype
>     folder.
>   - Basemap: OpenFreeMap (`tiles.openfreemap.org`) is reachable. If another
>     tile, terrain or CDN host is blocked by the environment's network policy,
>     request it rather than faking the result.
> - Serve it from the repository root with a static server, e.g.
>   `python3 -m http.server 4180`, then open `/prototypes/map-lab/`. Report the
>   preview port so the owner can open it from the app.
>
> **The five options.** Make them as different from each other as possible,
> and super modern. Vary the projection (flat, globe, schematic, 3D or
> space-time), the visual world (light paper, dark night, print, data
> display), the animation metaphor and how photos and places appear. The
> seeds below are starting points; replace any with a better idea, keeping
> five distinct concepts:
> 1. **Night globe.** A MapLibre globe in a dark style with glowing route
>    trails. Each leg animates as a comet with a fading tail, and the camera
>    follows the bearing in a slight 3D tilt. Photos are glowing dots that
>    bloom into blurred thumbnails as you pass them.
> 2. **Transit diagram.** A metro-map schematic of the whole trip:
>    octilinear lines per mode, stops as stations, TBD stops as dashed
>    stations. A vehicle token runs along each leg. The view can morph between
>    true geography and the schematic. Photos are counts on stations; places
>    are interchange icons.
> 3. **Ink atlas.** A warm paper print. Routes draw themselves like a pen,
>    with a different stroke per mode (dashes, stitches for ferries, dotted
>    walks). Stops are passport stamps, photos are scattered polaroids pinned
>    at their locations, and places are hand-lettered labels.
> 4. **Space-time.** A timeline scrubber linked to the map, with dragging as
>    the main interaction. Optionally a deck.gl or three.js "time cube" where
>    height is the date, so stays become vertical columns and legs diagonals.
>    Photos are points in space and time.
> 5. **Cinematic follow-cam.** Terrain or 3D buildings with a camera chasing
>    a mode-specific vehicle icon. A split-flap departure board announces each
>    leg ("Train · Köln → Düsseldorf · 40 km"). Photos pop up as cards at
>    their capture points during the journey.
>
> **Every option must:**
> - show the whole-trip overview with an opening animation, and keep the
>   route dominant;
> - select a day/stop, play its incoming legs between places, and land in the
>   city;
> - keep transport modes distinguishable without colour (O06), and show TBD
>   legs as unconfirmed;
> - show curated places and located photos on the map at sensible density
>   (grouping or clustering), with unlocated photos never placed at invented
>   coordinates;
> - handle multi-leg, multimodal and route-group events and the empty-photo
>   trip;
> - let input interrupt animation; offer Replay and Skip; respect reduced
>   motion; have no first-paint flash;
> - work at 390×844 and 320 px phone widths as well as desktop, with 44 px
>   touch targets and text of at least 12 px (O20);
> - aim for smooth 60 fps on a mid-range phone. Measure frame times with
>   Playwright, using CPU throttling, on the Heading East overview and one
>   long leg.
>
> Deliberate departures from current owner decisions are welcome in a demo,
> for example a moving camera during the trace, which O09 currently forbids,
> or a dark map. Call each one out explicitly so the owner can choose.
>
> **Deliver.**
> - Work on a new branch and push it; do not open a PR or deploy unless the
>   owner asks.
> - Send the owner:
>   - the preview port;
>   - for each option, desktop and phone screenshots at a 2× scale factor plus
>     a short screen recording of the overview and one leg (Heading East
>     Köln → Düsseldorf → Berlin, and a Switzerland–Italy ferry or gondola
>     day);
>   - a comparison table: concept, what is new, which owner decisions it keeps
>     or breaks, measured performance, phone fit, and the effort and risk of
>     bringing it into the shared framework.
>   - Recommend a direction, but leave the choice to the owner.
> - Live docs: add a WIP entry for the Map Lab with the branch, the preview
>   command, what was checked and what was not. Record the owner's reactions
>   and choice in OWNER_DECISIONS as they arrive, per the
>   [correction update procedure](https://github.com/gravelcycles/travels/blob/main/docs/OWNER_DECISIONS.md#record-the-next-correction-before-closing-the-task).
>   No FEATURES or CHANGELOG entry until something is adopted.

## Correct one trip’s content

> Follow the current AGENTS.md's reading order and live-documentation completion
> rule. Apply [correction] to [journey ID] in its journey/route/photo sources or
> editorial overrides. Preserve stable IDs and reviewed unrelated content.
> Use the shared authoring/build flow; no trip-specific code path. If the
> correction reveals a framework bug, fix the reusable behavior and cover a
> reference trip, demo and fresh draft as appropriate. Capture a reusable
> preference in docs/OWNER_DECISIONS.md; keep a specific fact in this trip's provenance.
> Record superseded choices and reconcile conflicting instructions; do not just
> append another handoff entry. Rebuild, validate ownership/references, update
> provenance where needed, and deliver under AGENTS.md.

## Continue the framework cleanup

> Follow the current AGENTS.md's reading order and live-documentation completion
> rule. Read the audit and staged plan in docs/FRAMEWORK.md and W04/W05 in TODO.md.
> Take only [named stage/module] as the current task. Preserve public URLs,
> journey schemas, private assets and behavior. Reuse existing module
> boundaries; do not replace the working app just to adopt a framework.
> Use family/demo/new-draft regression coverage before and after extraction,
> update source ownership documentation, and deploy only the completed,
> checked migration. Leave later stages explicitly tracked.

## Import photos or curated places

> Follow the current AGENTS.md's reading order and live-documentation completion
> rule, docs/OWNER_DECISIONS.md and the photo/Places workflows before
> touching [journey]'s content. Inventory supplied files/links and preserve saved
> edits. Use reviewed private derivatives, actual capture times and reviewed pins;
> leave missing GPS unset and photo copy blank unless the traveler supplied it.
> Venue research may add sourced factual descriptions when requested, never
> invented visits, ratings or automatic photo links. Compare every affected
> entry point with the standing decisions, including blank-copy rendering and
> explicit-link-only behavior. Update trip provenance and the applicable current
> guides, then complete authorized publishing and public verification.
