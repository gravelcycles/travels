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
