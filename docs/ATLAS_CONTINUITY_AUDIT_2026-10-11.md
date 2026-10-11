# Atlas continuity audit — 11 October 2026

The gap was larger than feature inheritance. Shared code was largely in place,
but editorial decisions, interaction quality and reversals were not consistently
part of the required new-trip process. A generic shared renderer could therefore
repeat a rejected choice on every trip, or a content import could bypass a rule
that the existing Studio importer already followed.

## Evidence reviewed

Reviewed the 61 locally indexed Travels tasks available at the audit snapshot,
including archived tasks, and their 277 available user messages from 6 September
through 11 October. Excluded the unrelated cribbage conversation from product
lessons. Reviewed repository Markdown entry points, current directives/workflows,
relevant historical handoffs/audits, correction commits and current regression
coverage. The live sidebar task was also checked through the task reader.
This is a local-history audit; older context unavailable here is represented only
by committed records. Raw transcripts, credentials and private attachments are
not copied into the repository.

The original 10 September framework request explicitly required future trips to
inherit the first trip's experience, including mobile. The implementation in
`6799e11` addressed shared templates and feature parity. The subsequent requests
below show where the working process still failed.

| Gap | Concrete evidence before this patch | Repair |
| --- | --- | --- |
| Required reading missed owner preferences | AGENTS required FRAMEWORK before feature work and JOURNEY_WORKFLOW before creation, but not PRINCIPLES or prior corrections before content/photo intake. | One startup order for every task; mandatory owner decisions and area workflows before imports as well as feature work. |
| Shared code was treated as sufficient inheritance | Existing parity checks cover templates/assets and many helpers, but the 19 September cycling intake still needed a correction from straight lines to network routes. | New-atlas acceptance includes content quality and real interaction paths, with the actual event model and newly populated data. |
| A known caption correction was repeated | Generated photo copy was removed on 9 September (`32cf654`); Heading East needed generated names/descriptions cleared again on 11 October (`de72fad`). The blank-caption rule existed in PHOTO_WORKFLOW but was not a universal intake gate. | O01 applies to bulk intake, Studio uploads, manual content authoring and every renderer; blank fields and traveler-authored fields get separate review. |
| Proximity was mistaken for meaning | Photos + Places introduced nearby venue suggestions (`1c7dabe`); the owner rejected the unrelated Origin Coffee label/button (`3d88dd7`). WIP and PLACES_AND_COMMENTS still described the 150 m rule as production behavior. | Explicit links only; remove contradictory current instructions and label the old prototype superseded. |
| Shared additions displaced established UX | The Photos + Places card replaced the familiar sidebar, then needed restoration, larger clickable photos, fixed frame height and stable bubbles (`ed7f106`, `7f962ff`, `b80ed36`, `8b6fbc9`). | Record the actual layout and behavior to preserve, including portrait/landscape, cross-day, map/album/Places entry and stationary refresh checks. |
| “Apple-like” was too vague at task boundaries | Repeated corrections concerned image reveal flashes, map disorientation, mobile clutter, persistent focus rings, lost drafts and slow conversations—not merely color or rounded corners. | Observable acceptance checks O03–O11, linked to existing workflows and behavior tests. |
| Current quickstarts contradicted later decisions | README said no map photos, Replay photo pauses, always-expanded details, a separate daily lead picker and hidden-photo flags. JOURNEY_WORKFLOW's Photos section still prescribed GitHub Releases, and its completion list required calendar days even for city stays. | Reconcile README and the creation/photo workflow with current map bubbles, map-only Replay, compact details, album order, Trash, private R2 and daily/city event models. |
| Historical documents masqueraded as instructions | TODO and the implementation flow directed agents to PROJECT_STATE/AGENT_HANDOFF first. Those files mix old “Current behavior”/“Next” sections with obsolete public-media and Replay instructions. | Current reading order replaces that route; prominent archive banners point to operative docs, preserving evidence without treating it as a specification. |
| Corrections lacked an update lifecycle | Documentation updates were required, but no rule required recording scope, supersession or searching for conflicting instructions. Appending another handoff entry left both versions discoverable. | Mandatory correction capture in OWNER_DECISIONS or trip provenance, area workflow, feature inventory and conflicting entry points. |
| Proposals and authorizations drifted | Old workstreams described Replay as unfinished and continued to mention a prototype's behavior after shipping changed it. The owner separately excluded visitor reload restoration and later authorized Studio autosave. | Explicit supersession table and scope rules. WIP tracks release/prototype state; a demo request is not deployment authorization, and completed authorized work still deploys by default. |

## Decisions consolidated

[OWNER_DECISIONS.md](OWNER_DECISIONS.md) covers every reusable correction found
in the reviewed history: blank copy; album order and independent covers; photo
placement/frame preservation; loading/caching/auth; map contrast, mode colors,
labels and rail markers; phone gestures/navigation; Replay/arrival timing and
camera; compact stories/taglines; safe Studio save/recovery; Trash versus Hide;
detailed network routing; city/TBD/group/video contracts; explicit venue links;
sidebar size/stability; floating conversations; agent operation, free services,
prototype scope and verified delivery. It distinguishes later reversals from
still-binding choices and trip facts from shared requirements.

Trip-specific corrections stay in route sources, content overrides and intake
docs: the Swiss itinerary fixes, Florence–Genoa's removed arrival day and
campsite-only copy, and Heading East's corrected dates/order and remaining GPS
review. They are evidence for the process, not data to clone into new journeys.

## Verification and remaining limits

This change edits documentation only. It does not redesign the current site,
regenerate captions, move photo pins, change routes or publish pending media.
Current runtime fixes through `a69515f` were used as the implementation baseline.
Validation: **473/473 tests passed**, `npm run build` passed, generated `dist/`
and community-index output stayed unchanged, and changed Markdown paths/anchors
and `git diff --check` passed. The test fixtures require local loopback servers;
the suite passed with that permission after the sandbox blocked those fixtures.
Delivery follows the standing Pages workflow, including remote-main integration
and fresh public verification.

Existing shared-framework/photo/Places/Studio tests already protect many of these
behaviors. They do not enforce that an agent reads instructions, nor do matching
DOM IDs prove a usable photo layout or accurate route. No documentation-only
test is added as a substitute. The new journey checklist requires observed
results and named limits; [FRAMEWORK.md](FRAMEWORK.md#remaining-continuity-work)
and [TODO.md](../TODO.md) retain the remaining browser-coverage work. This patch
makes the decisions discoverable and reviewable; execution still needs the
specified checks on each future change.
