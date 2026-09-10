# One framework, many trips

Current contract and audit: 10 September 2026. The owner’s guiding principle is
99% shared behavior. That is a design target, not a measured percentage of lines
of code. Switzerland–Italy is the reference experience; each trip is content
rendered by the same application.

## What the audit found

We were already close in architecture, but had weak protection against drift.
There were five journey data records (one real, four fictional), one shared
viewer, one shared stylesheet, one Studio, and shared photo/Replay libraries.
No concrete journey-ID or trip-URL conditionals were found in those shared
browser implementations. A new trip already used the same viewer as the family
trip; no application rewrite or feature-copy exercise is needed tomorrow.

| Area | Before this change | Current contract |
| --- | --- | --- |
| Real trips and local draft previews | One `journey.html` template | Retained as the single journey page template |
| Sample page | Separately maintained 215-line HTML document | Generated from the same template as real trips |
| Cover introduction | Explicitly skipped for demos in `app.js` | Same introduction and entry actions for demos, real trips, and drafts |
| Catalog | Build read and rewrote the existing output HTML | Generated from `content/templates/catalog.html` |
| Demo calendars | All four lacked machine dates/time zones; the rail example skipped calendar days | Complete dated calendars and time zones usable by Studio and photo intake |
| Editorial examples | No explicit cover configuration or curated Replay example | All demos have cover choices; Alpine Crossing demonstrates curated chapters; other demos demonstrate automatic Replay |
| Feature inheritance | Mostly true, but no dedicated page-parity contract | Regression suite compares controls/assets and exercises a fresh data-only trip |
| Agent guidance | Scattered workflows and historical notes; AGENTS only covered delivery | Standing shared-first rules, feature inventory, task prompts, and this migration plan |

Most visible differences were content maturity: the family trip has many more
photos, reviewed routes, custom cover framing, and edited Replay chapters.
A new trip gets the *capability* to use these features, not the family’s dates,
places, pictures, locations, text, or editorial choices. Features that need
photos or routes become useful when those inputs exist. Empty states are part
of the shared experience.

Demo dates are explicitly fictional. The rail example keeps its original dated
entries and IDs, inserting blank days between them. The road and bicycle
examples use representative September 2026 calendars; these are not travel
records. Sample photos and route geometry remain illustrative, not newly
verified geographic evidence.

## The model

```text
Trip facts + routes + photos + editorial overrides
                      |
               validated loader
                      |
     +----------------+----------------+
     |                |                |
 real trip page    sample selector   local draft preview
     +----------------+----------------+
                      |
       journey.html + shared JS/CSS
                      |
          map / journal / albums / Replay
```

Studio checks local routing readiness for every selected leg. Reviewed-preserve
policies guard unattended builds; explicit, read-only replacement proposals
remain available when local mode data exists and require acceptance before saving.

Studio edits the same sources; it is an authoring application, not a separate
trip implementation. The catalog is a separate view of the same real-journey
records. Photo protection is a shared service and namespace, not a per-page
password system.

## Where changes belong

| Source | Owns |
| --- | --- |
| `content/templates/journey.html` | All journey DOM, dialogs, control IDs, scripts and styles; real, demo, preview |
| `content/templates/catalog.html` | Public catalog shell |
| `dist/assets/app.js` | Shared viewer, journal, map interaction, album, introduction, Replay UI |
| `dist/assets/atlas-utils.js` | Shared photo resolution, cover choice, camera helpers, preloading and other pure helpers |
| `dist/assets/group-travel.js`, `group-travel.css`, `scripts/journey-extras.mjs` | Shared group projection, roster/video UI, media cleanup and optional data validation |
| `dist/assets/replay-utils.js` | Automatic/curated timeline, route progress, pacing |
| `dist/assets/photo-auth.js`, `workers/photo-auth/` | Shared protected-photo access, loading and caching |
| `dist/assets/catalog.js`, `dist/assets/styles.css` | Catalog behavior and shared visual styles |
| `dist/assets/mobile-ux.js`, `dist/assets/mobile.css` | Shared mobile day navigation, immersive photo gestures, location panel, grid and Back behavior |
| `dist/assets/input-mode.js` | Shared pointer/keyboard focus presentation for catalog, journeys and draft previews |
| `studio/` | Local authoring UI for any selected journey |
| `scripts/journey-content.mjs`, `journey-planner.mjs`, `create-journey.mjs` | Loading, validation, planner rules, fresh-trip creation |
| `scripts/build-site.mjs` | Public builds and local preview page/data generation |
| `content/journeys/<id>.json` | Reviewed trip identity, calendar, places, legs, cover and Replay choices |
| `content/route-geometry/`, `route-sources/`, `photo-manifests/` | Journey-specific reviewed assets and provenance |
| `content/*-overrides.json` | Human edits, keyed by stable day/segment/photo IDs |
| `content/drafts/`, `build/draft-assets/`, `build/studio-draft-overrides.json` | Ignored local drafts and edits |

**Source/output exception:** hand-authored JS/CSS currently lives under `dist`.
Do not delete that directory or treat all its files as generated. Generated
files are public HTML, `generated-pages.json`, and these data bundles:
`journeys.js`, `route-geometry.js`, `trip-photos.js`, `content-overrides.js`, and
`photo-service.js`. Edit their `content/` sources and rebuild. The build assigns
content hashes to public asset URLs; template authors do not maintain version
strings. Studio serves live assets with no-store caching.

## Rules for adding features

1. Classify the request: trip content, a generally useful capability, or a true
   exception. Put content changes in that trip’s JSON/overrides.
2. Add generally useful behavior to shared code/template. Default it on for all
   applicable data; a sample or new trip must not need a special enablement step.
3. Prefer existing data customization: `coverPhoto`, `replayMoments`, photo/day
   overrides and routing manifests already provide per-trip editorial choices.
4. If one trip really needs new behavior, add the smallest named optional data
   field and a shared renderer/helper. Validate its type and references, define
   an absent-value fallback, and document why it exists and who uses it. Test
   both present and absent cases. Add a schema migration if old data needs one.
5. Never write `if (journey.id === 'some-trip')`, trip-specific CSS selectors,
   cloned HTML, or copied application bundles. Do not invent a general plugin
   framework or a set of feature flags before a concrete feature requires it.
6. Update [FEATURES.md](FEATURES.md), the relevant workflow and tests in the same
   change. Use [AGENT_PROMPTS.md](AGENT_PROMPTS.md) to brief the next agent.

A custom fourteen-chapter Replay is trip data. Replay playback, camera movement
and controls are shared behavior; Replay presents maps and stories without photos.
The same distinction applies
to a chosen cover versus the introduction component, and a drawn ferry route
versus map rendering.

## How inheritance is verified

`npm test` includes `test/shared-framework.test.mjs`. It checks:

- Matching control IDs and browser asset lists for the family page, all sample
  previews, the public sample page, and a freshly generated empty draft.
- Propagation of a synthetic future template edit to real/demo/preview pages;
  editing generated HTML cannot create an independent implementation.
- Each demo’s calendar and photo-import configuration use the normal planner.
- A newly created trip can add ordered mixed-mode legs, photo ordering, cover
  choices and automatic/curated Replay through data, then build a public page.
- Shared introduction behavior with/without photos and direct day/photo entry.
- No literal known trip IDs/URLs in shared browser code or page templates.

The concurrent mobile release was integrated before delivery; its controls and
assets are inherited through this same template, with mobile gesture/page
contract tests included in the release checks.

Existing tests cover routing/GPX, planner preservation, photo auth/load/cache,
viewer camera, Replay camera/timing, mobile day navigation and Studio editing.
These are focused automated checks, not proof that every browser interaction
is pixel-identical. For UI changes, check the affected flow on the family trip,
a demo and a new draft, at desktop/phone sizes as appropriate. A map/photo
service outage must not be confused with a template mismatch.

Pages CI runs the suite and build, then rejects uncommitted output differences
with `git diff --exit-code -- dist/`. Commit regenerated outputs with source
changes. Preserve concurrent work, fetch/integrate remote main before each
push, verify the Pages run, and check fresh public content before completion.

## Remaining migration plan

The basic shared-instance requirement is now in place. These stages improve
maintainability without delaying creation of the next trip.

| Stage | Scope and dependency | Acceptance |
| --- | --- | --- |
| 1 — Prevent drift (delivered here) | One journey template; generated catalog; demo parity; full demo calendars; inventory, prompts, AGENTS and CI checks | A fresh data-only trip inherits the shared controls and capabilities; sample HTML cannot drift independently |
| 2 — Extract focused modules (W04) | Start from existing helper boundaries; extract shared day/photo selection, transport definitions, map/camera, albums and Replay one at a time | Family, demo and draft use the same implementations; function-level tests replace brittle source-snippet tests as each boundary moves; URLs and content unchanged |
| 3 — Separate source and output (W05) | Move authored JS/CSS to an explicit source directory and teach the build to copy/bundle it; update Studio imports and tests together | A clean checkout reproduces `dist` without reading authored code from its output directory; generated assets and photo privacy remain intact |
| 4 — Consolidate schema and promotion (W05) | Centralize schema/default documentation and validation; add reviewed migrations when shape changes; automate the documented draft promotion with dry-run review | One command can report/promote a reviewed draft, its routes/photos/overrides and catalog entry without leaking local-only assets or losing IDs |

At audit time the viewer was about 1,859 lines and Studio 1,402 lines. Both are
shared, but their size makes isolated changes harder. Photo ordering/override
resolution and transport definitions also appear in more than one application
surface. Extract those with focused behavior tests as the next related work
arrives; a framework rewrite is not a prerequisite. No time estimate is a
commitment: each stage should be a separate reviewable change with its own
checks and deployment.

Per-journey public bundle splitting and larger collection performance remain
future scale decisions. Today all published journey data is loaded together;
that is separate from whether feature code is shared. Existing documents on
performance/auth are historical evidence or focused operational references;
this file and the feature inventory define the present framework contract.

Routing-data intake remains agent-operated: empty journeys show an actionable
setup state until their own mode network has been prepared. A guided retrieval
flow with access/direction-aware routing is future work (W06); the present local
graph reconstructs historical routes and is not turn-by-turn navigation.

## Group routes and video follow-up — 10 September 2026

The shared optional group/video contract is documented in JOURNEY_WORKFLOW.md.
Nine to Como adds a sixth journey data instance and demonstrates nine invented
travelers taking three routes to one meetup. Filtering derives a view without
mutating the source; empty drafts and existing trips retain absent defaults.
Regression checks cover scoped/shared legs and media, overnight places, meetup
references, native player cleanup, hidden/local video exclusion, planner
preservation and template inheritance.

Remaining work before private trip video intake: transcode reviewed derivatives
and posters, deliver authenticated byte ranges under the existing photo access
policy, add timed captions/transcripts and Studio video intake. Public sample
playback does not make the current image-only Worker a private video service.
Roster/assignment forms and per-day changes to individual group membership are
also future work; the present groups have stable membership and are authored
by the agent through content JSON/the planner API. See W07 in TODO.md.
