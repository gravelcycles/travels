# Prompts for future agents

These prompts are copyable task briefs. Repository `AGENTS.md` applies even
when a prompt omits a detail. The user supplies facts and editorial choices;
the agent operates Studio, commands, QA and publishing.

## Start a new trip

> Read AGENTS.md, docs/FRAMEWORK.md, docs/FEATURES.md and JOURNEY_WORKFLOW.md.
> Create a new trip named [title], from [start date] through [end date], using
> time zone [IANA zone] and stable URL name [slug]. Use Studio’s + New trip or
> journey:new to create an ignored local draft. If the identity/calendar is
> incomplete, ask only for the missing essentials and continue organizing the
> supplied facts. Do not clone a trip page or copy the family itinerary.
>
> Treat the trip as data for the existing shared framework. It must inherit
> the Switzerland–Italy experience: opening, calendar/journal, ordered transport
> legs, map focus/inspection, albums, photo viewer, protected photo loading,
> Replay, mobile/direct entry and Studio editing. Add actual places, routes,
> photos and editorial choices as provided; do not invent precision or prose.
> Use automatic Replay until there are reviewed reasons to curate chapters.
>
> Preview this draft through Studio’s normal shared page. Check blank-day,
> no-route and no-photo states, then the supplied content. For a missing
> capability, implement it once in shared code, following the framework rules,
> and verify the existing family trip and a sample too. Keep IDs and the slug
> stable. Record what is ready and what inputs remain. Keep the draft local
> until its reviewed sources are promoted under the documented workflow;
> deliver completed authorized shared changes using the standing deployment
> rules. Do not publish invented content or private originals.

The tomorrow intake can start with just a name and date range. Set the photo
time zone from confirmed trip facts before importing images. The CLI's UTC
fallback is not evidence about where the traveler was.

## Add or change a feature

> Read AGENTS.md and the framework/feature guides. Implement [requested
> behavior] in the shared template or runtime so existing journeys, samples,
> and newly created trips inherit it. First locate the common implementation
> and describe what is trip data versus reusable behavior. Do not branch on a
> concrete trip ID or fork HTML/JS/CSS. Use existing editorial fields where
> possible; any necessary new optional field needs validation, an absent-value
> default, a documented use case and both present/absent checks.
>
> Preserve concurrent edits and the Switzerland–Italy experience. Verify the
> affected behavior on that trip, a sample and a fresh data-only draft. Add a
> meaningful regression for the behavior or contract, update docs/FEATURES.md
> and the relevant workflow, run tests/build and commit regenerated outputs.
> Fetch/integrate latest main, deploy, verify Pages and inspect fresh public
> content. Report the delivered behavior and any material limitation.

## Correct one trip’s content

> Apply [correction] to [journey ID] in its journey/route/photo sources or
> editorial overrides. Preserve stable IDs and reviewed unrelated content.
> Use the shared authoring/build flow; no trip-specific code path. If the
> correction reveals a framework bug, fix the reusable behavior and cover a
> second trip. Rebuild, validate ownership/references, update provenance where
> needed, and deliver under AGENTS.md.

## Continue the framework cleanup

> Read the audit and staged plan in docs/FRAMEWORK.md and W04/W05 in TODO.md.
> Take only [named stage/module] as the current task. Preserve public URLs,
> journey schemas, private assets and behavior. Reuse existing module
> boundaries; do not replace the working app just to adopt a framework.
> Use family/demo/new-draft regression coverage before and after extraction,
> update source ownership documentation, and deploy only the completed,
> checked migration. Leave later stages explicitly tracked.
