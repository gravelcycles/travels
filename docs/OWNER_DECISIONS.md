# Owner decisions that every atlas inherits

This is the live owner-decision record. Initially reconciled 11 October 2026
against available project conversations and committed corrections; maintained
with every subsequent correction, including the later photo-entry, map-popup
and documentation-lifecycle clarifications. Read this before creating a trip,
importing content, changing UX or resuming a workstream. These are product and
editorial requirements, not optional polish. [AGENTS.md](../AGENTS.md) defines
the reading order and update process; [the audit](ATLAS_CONTINUITY_AUDIT_2026-10-11.md)
records the evidence and gaps at that audit's checkpoint. Technical contracts
remain in the linked workflows. The update procedure below is ongoing; the
completed audit does not freeze these decisions or finish their maintenance.

## What carries forward

Every atlas inherits the owner's interaction standards, editorial defaults and
rejected-behavior boundaries as well as shared code. Switzerland–Italy is the
reference for quality, not a source of another trip's text, photos or coordinates.
Heading East exercises city stays; Florence–Genoa exercises cycling content.
A new atlas is not permission to redesign established flows or fill empty fields.

The latest explicit owner instruction governs its stated scope. General UX,
intake and workflow corrections apply across journeys unless explicitly scoped.
Itinerary facts, a particular cover/frame and a request to clear one trip's prose
stay with that trip. Preserve traveler-written content; a blank default is not
permission to erase it. An agent suggestion, passing test or prototype is not an
owner decision. Resolve apparent conflicts from dated evidence and record which
choice supersedes which; ask only if a consequential ambiguity remains.

## Standing decisions and acceptance checks

| ID | Current decision | Check when touching this area |
| --- | --- | --- |
| O01 · Photo copy | Captions, notes and place labels start blank and contain only traveler-supplied words. Do not generate photo names, scene descriptions or city/GPS labels. Filenames and accessibility alt text are not visible-caption fallbacks. Actual capture dates/times may identify an unlabeled photo. | Check bulk import **and** Studio upload, then card/fullscreen/phone renderers with blank fields and a separate authored example. Preserve existing copy, order, pins and frames on incremental intake. [Photo workflow](../PHOTO_WORKFLOW.md). |
| O02 · Photo/place meaning | Only explicit owner-saved `point.photoIds` associate a photo with a venue. Nearby coordinates do not justify “Near …”, an About-place button, a visit or a review. Venue imagery and trip photos remain distinct. | An unlinked photo beside a venue has no venue association; a saved link works and preserves its order. Missing GPS remains unset. [Places contract](PLACES_AND_COMMENTS.md#photos--places--current-contract). |
| O03 · Desktop photos | Keep days left, map center, and the existing journal/photo sidebar right. Clicking or keyboard-activating a map circle bubble (single or clustered) or a thumbnail in the right-hand reel selects the photo in that existing sidebar; it does not open fullscreen. The large top-right selected/lead photo opens fullscreen in one activation, preserving its collection. Its uncropped frame stays a stable height with compact controls and expandable details. Do not insert a second photo panel. Existing album/grid and linked Places viewer entry remain available. | Check map bubble → sidebar selection, reel thumbnail → sidebar selection, then large selected/lead image → fullscreen, including keyboard activation and portrait/landscape images. Controls must not jump; unrelated bubbles keep their own images. Change day: old selection and map popups clear before the new day appears. Stationary refreshes must not remove bubbles or restart image loads. Phone bubbles select the compact card; its large image opens fullscreen, retaining the existing grid/swipe flow. |
| O04 · Loading and conversations | Preserve the same-size blurred preview until the full image is ready; no black/sizing/loading/auth flash. Fullscreen gets the full derivative, not a sharp thumbnail substitute. Keep the reviewed 350 ms fullscreen reveal and desktop cached-image reveals without refetching. Comments/reviews float with a soft shadow and visible sidebar context; open immediately, with inline loading/retry and preserved text. Comments keep the presenting collection, order and index. Empty saved-place reviews do not open an empty modal. | Test a cold load, cached revisit, rapid selection, slow/failing request and remembered/anonymous access. Reuse bounded caches/preloads; never solve speed by exposing private media. Respect reduced motion. [Photo workflow](../PHOTO_WORKFLOW.md), [conversation UX](PLACES_AND_COMMENTS.md). |
| O05 · Photo camera | Keep the exact pin separate from its saved map frame. Do not move the photo map when successive pins already fit. Nearby moves are direct; longer moves preserve geographic context. Studio keeps the same-day working frame until deliberately changed. | Browse nearby/distant/unlocated photos; pan manually; check a saved off-center frame on desktop and phone. Unknown locations use event/city context, not a fabricated viewpoint. |
| O06 · Map hierarchy | The map is the main experience. Keep terrain legible but routes dominant; preserve transport colors/patterns during selection and match the key. Settlement labels stay readable above routes; road labels/shields stay below. Credits start collapsed but remain accessible. | Inspect intersections, overview and close zoom; desktop travel-row hover/focus highlights only that leg without a click action, popup or camera jump. Phone route taps select without desktop tooltips. [Journey workflow](../JOURNEY_WORKFLOW.md#map-location-labels). |
| O07 · Map markers | Use the reviewed upright signposts, quiet grouped/repeat dots and compact linked hover/focus previews. Before switching the displayed day/stop, close its map popups and hover previews and cancel pending opens; an old popup must not remain over the next map. No sideways/upside-down balloons or large leader-line clutter. Intermediate rail dots are small; each train leg's endpoints are larger. Overview shows endpoints, not intermediate stations. Signpost stems meet the orange endpoint ring's top. | Open a map popup, switch day/stop through the day list, previous/next and photo navigation, and check that it closes before the new map appears. Rapid transitions must not reopen stale previews. Check route/label/control collisions; dots appear after their route lines and stale pending markers cannot leak into another view. [Location labels](LOCATION_LABELS.md). |
| O08 · Phone navigation | Keep the map-led day/stop screen, persistent header access and one bottom event picker. Use one resting date/title card with one Photos action and contextual Places; arrival controls belong in that card. Photos opens that event's grid; the Day/Stop control returns to its map. Large photos, responsive swipe/pinch, animated double-tap and deliberate pull-up location follow the established phone flow. | Closing location stays closed through swipes/grid round trips; zoomed drags pan the photo. Check All days, Back/Forward, Escape, 320/390 px and landscape. Desktop retains its left list, without a second day picker. No stray orange pointer-focus rings; keyboard focus stays visible. |
| O09 · Replay and arrival | Full-trip Replay is disabled across every atlas, demo and draft, on desktop and phone (owner, 11 October 2026). Remove its entry/resume actions and keep the player and Studio chapter editor inaccessible; retain existing chapter data. Arrival → city remains the normal map flow: contextual pullback, combined pan/zoom, 1.5-second trace, plain orange circle, 0.25-second arrival hold, then city framing. | No full-trip Replay action or playback through navigation/history, and no Replay map/autoplay initialization. Day/stop navigation and Replay arrival still work for a rest event and a multi-leg event, with cancellation and reduced motion. City framing includes nearby photos and assigned marked places using the documented boundary/radius rules. [Arrival contract](ARRIVAL_CITY_DEMO.md). |
| O10 · Editorial restraint | Blank stories/taglines are valid. No generated “stayed here” or “In one place” filler. Optional authored taglines are italic; story paragraphs survive saving. First album photo is the event preview; journey cover is a separate choice. Keep technical/prototype explanations out of the story. | Preview deliberately blank and authored fields after save/rebuild; opening a day's lead starts at photo 1. Do not revive the retired independent daily lead picker. Keep research/uncertainty in provenance with only useful factual context in public copy. |
| O11 · Creator safety | Save locally works without a required Preview/Check step. Unpublished drafts autosave and recover after reload; saved/draft differences are readable, discard is recoverable, and real conflicts require field choices. Do not lose edits to background updates. All non-trashed photos show; there is no Hide feature. | Test reload recovery, save, preview, independent/concurrent edits and failed save. Trash stays deleted until an explicit restore; never interpret removal of Hide as restoring Trash. New editable features use this same recovery/save flow. |
| O12 · Route quality | Follow the mode's physical network, using GPX when available and reviewed reconstruction otherwise. Straight lines are temporary guides, not completed route work. Exact network alignment does not prove a booked service. Preserve reviewed overrides and durable anchors; endpoint-only edits preserve the rest of the line. | Inspect every supplied leg at close zoom, regenerate without losing edits, and prepare local mode data for Studio proposals. Missing sources stay explicit; do authorized research instead of returning a finished-looking endpoint sketch. [Route workflow](../ROUTE_GEOMETRY_WORKFLOW.md). |
| O13 · Trip structure and empty data | Calendar days and city stays are supported by the same viewer. Preserve confirmed dates and stable IDs; TBD is itinerary uncertainty, separate from route accuracy. Videos belong in the existing gallery/player; group travel belongs in the existing day details and Studio. | Choose the event model from the request; test actual city-stay/transfer/TBD inputs when relevant. Hide viewer Places actions only when the whole trip has no curated places; Studio still adds the first one. Do not hide capabilities merely because a trip is new. |
| O14 · Media and access | Originals stay private; publish optimized, metadata-stripped derivatives through the existing private Cloudflare pipeline. Photo passwords are shared across the site with remembered access, not per-trip accounts/SSO. Keep Markdown and commit messages free of real credential names/labels, recipient names, password fragments and identifying hints; maintenance receipts stay generic (owner correction, 11 October 2026). Keep services free unless the owner changes that constraint. | Count all supplied stills, including bulk DNG imports; review GPS/date matching, checksum-verify uploads, use resumable single-file transfers on poor Wi-Fi. Show non-trashed photos while preserving deletions. Never recreate retired public photo Releases. [Photo workflow](../PHOTO_WORKFLOW.md), [service operations](COMMUNITY_OPERATIONS.md). |
| O15 · Delivery and proposals | The agent operates tools, Studio, assets, tests, Git and deployment. Completed authorized work deploys by default after integrating current main and verifying Pages/public content. A request for ideas or a local demo remains that scope until implementation/publication is authorized. | Retain existing authorization; do not ask the owner to run commands or approve already approved work again. Preserve other work, local prototypes and unpublished media. A commit/build alone is not a deployment receipt. [Deployment](DEPLOYMENT.md), [WIP](../WIP.md). |
| O16 · Living documentation | Every agent reads and maintains the current docs as part of the task. New corrections, preferences and follow-up clarifications become durable guidance in the same change, without another owner request. This is a standing owner priority, explicitly reaffirmed 11 October 2026. | Before delivery or handoff, reconcile all new owner direction with the correct shared decision or trip record, replace superseded current guidance, and record any implementation still pending. A fresh task must be able to continue from the repository without the previous chat. Follow the [update procedure](#record-the-next-correction-before-closing-the-task). |

“Apple-like” means these observable qualities: stable layout, clear hierarchy,
large useful imagery, restrained copy, continuous geographic context, responsive
interruptible motion, obvious navigation and reliable recovery. It does not mean
adding decorative animation, labels, another panel or another confirmation step.

## UX corrections — 11 October 2026

The owner authorized all sixteen findings in [the UX review](UX_REVIEW_2026-10-11.md)
and requested one screen → full-screen photo in a single activation. The first
implementation interpreted that as direct fullscreen from every photo surface.
**That interpretation is superseded by the later clarification below:** map
bubbles and the right-hand reel select in the existing sidebar; the large
selected/lead image opens fullscreen. The desktop day/map/journal structure
and its stable, uncropped selected-photo frame remain. Reviewed image
reveals, floating populated conversations and arrival timing remain in force.
Named Replay seeking was authorized here, then superseded by the full-trip
Replay disablement below. Visitor reload persistence and explicit sharing
remain outside this change.

Studio uses Trip / Media / Places / Routes with Photos and Videos under Media,
one Save locally action, a contact sheet before batch controls, visual cover and
linked-photo choices, and a concise Review for sharing. Review choices remain
revision-bound; the public version remains unverified until deployment checks.
Video transfer reports measured progress; preparation is indeterminate, with
clear interruption behavior. These changes apply to every trip and fresh draft.

## Later photo-entry clarification — 11 October 2026

The owner explicitly narrowed the fullscreen boundary in the same task:

> if i click a photo on the map (the circle bubble), don't go fullscreen. if i click a photo in the reel on the right, don't go fullscreen. if i click a photo in the top right of the photo section, then go fullscreen

The owner also reported popups persisting after a day change and directed:
“popups should close first.” These corrections govern O03 and O07 and supersede
the earlier all-photo-fullscreen implementation and its verification claims.
Map/reel selection uses the existing sidebar, not another intermediate panel.
The large selected/lead image remains one activation from fullscreen. On phones,
map bubbles select the existing compact card and its large image opens fullscreen;
the established album grid, swipe and Back flow stays intact. Album/grid and
explicitly linked Places viewer entry are not redefined by this clarification.

## Full-trip Replay disabled — 11 October 2026

The owner requested: “let's disable the full trip replay animation”, explaining
that its features now exist in the other view and it is redundant. This applies
to the shared viewer, including all journeys, demos, drafts and phone layouts.
It supersedes full-trip Replay availability, autoplay and named chapter seeking,
including the earlier same-day UX approval. The separate arrival animation and
normal map/day/photo experience remain. Saved `replayMoments` are retained;
disablement does not authorize deleting traveler editorial data. O09 owns the
acceptance checks. The dormant player shell and helpers are retained because
arrival uses shared route interpolation; the Studio chapter editor stays hidden.

## Reversals that must not be undone accidentally

| Earlier direction | Latest applicable decision | Evidence |
| --- | --- | --- |
| Generated photo captions/descriptions and later metadata-derived labels | Blank traveler-only copy; dates remain separate | 9 September, repeated 11 October; `32cf654`, `de72fad` |
| Photo landmarks removed on 9 September | Sparse Photos + Places bubbles authorized on 8 October; existing sidebar restored and refined 11 October | `147229b` → `1c7dabe` → `ed7f106`, `7f962ff`, `b80ed36`, `8b6fbc9` |
| All-photo fullscreen interpretation in the initial 11 October UX implementation | Map circles and right reel thumbnails select in the existing sidebar/card; only the large selected/lead image opens fullscreen within that map/sidebar flow. Close old map popups before switching days. | Later owner clarification, 11 October; quoted above; O03/O07 |
| Nearby-photo suggestions in the Photos + Places prototype/release | Explicit links only; remove geographic venue guesses | 11 October; `3d88dd7` |
| Photos inside Replay, followed by map-only playback and named seeking | Full-trip Replay disabled; arrival playback in the normal map remains | 11 October owner request below; O09 |
| Always-expanded travel details, generated stay labels | Compact expandable details, authored optional taglines, no stay filler | 15 September; `df5740d`, `7e26085` |
| Separate daily lead-photo selection | Album order determines first photo; journey cover remains independent | 9–12 September; `6bc0561`, `f6790e4` |
| Hide-from-atlas and restore-all ambiguity | Show non-trashed photos; preserve deletions | Owner clarification 14 September; `06f5d63` |
| Removed day markers, then rotated map balloons | Upright signposts and quiet repeat dots; overview endpoints restored later | 10–11 September and 8 October; `249fcac`, `d8b5def` |
| Pulsing next-day button and orange focus rings | No continuation halo; orange selection border, slim slate keyboard focus | 10 September; `c07d323` |
| Public Release photo hosting, two-size derivatives | Private R2; current three-size optimized pipeline plus embedded blur | 9 September onward; [current photo workflow](../PHOTO_WORKFLOW.md#generated-image-sizes-and-private-publishing) |
| Visitor “Reload loses your place” audit fix | Explicitly excluded; do not silently reopen it. Studio draft recovery was separately requested and delivered | 12–15 September; [audit authorization](UX_AUDIT_2026-09-12.md#authorized-follow-up) |

## Keep trip facts scoped

- Switzerland–Italy's title, overview bounds showing Switzerland, corrected
  Day 1/Day 10/Kehrsiten legs, cover, photo edits and cleared descriptions are
  that trip's content. Do not copy them to another atlas. Its old surname-based
  public branding was removed; do not revive it from legacy paths or prose.
- Florence–Genoa keeps six cycling days and campsite-only descriptions at the
  owner's request. This does not strip other journeys' stories or group support.
- Heading East's city dates/order, replacement bus, onward TBD stays, city
  boundaries, saved venues and owner-reviewed photo pins remain in
  [its intake record](HEADING_EAST.md). The 11 October Studio review resolves
  the missing locations across both photo batches and preserves one trashed photo. A request for light factual venue
  descriptions does not authorize personal photo captions or invented visits.
  Its [11 October image selection](HEADING_EAST.md#place-image-refresh--11-october-2026)
  preserves the exact Barbès/Abi’s photos and the food/atmosphere mix with bakery
  counters for the remaining places, with the later outside-only correction for
  Café August. The requested counts and replacements are
  scoped to that selection, not a new global three-image requirement.
- Shared branding follows [BRANDING.md](BRANDING.md); an old logo option or
  demo screenshot is not authority to replace the reviewed artwork.

## Record the next correction before closing the task

Owner direction, 11 October 2026: “any new corrections are also carried forward”
and new chats must know how to keep the docs “as a live artifact for future
agents.” Apply this to every task, not just documentation audits or new atlases.

### During the task

1. Read the current checkout's guidance in [AGENTS.md](../AGENTS.md) order.
   Identify the applicable decision IDs and trip record. On resumption or after
   integrating another task's changes, reread relevant changed guidance; a saved
   prompt or chat summary may predate the latest correction.
2. Capture durable owner direction when it arrives, before moving on to dependent
   work. Small follow-ups count: a bakery-counter refinement and a later change
   to the fullscreen boundary both need recording. Do not wait for another
   audit, another atlas or an instruction to “update the docs.” If interrupted,
   leave the accepted direction and remaining action in WIP before handing off.
3. Update the existing decision or trip record in place. Include the date,
   source (a short faithful owner quote or dated task/commit reference), scope,
   requested outcome, what it supersedes and an observable acceptance check.
   Add a decision ID only for a genuinely new shared requirement; preserve
   stable existing IDs. Keep proposed/inferred choices separate from accepted
   direction. A request scoped to one trip does not silently become universal.
4. Use the ownership map below. Keep the full rule in its owning document and
   link from entry points. Search the affected terms and earlier behavior with
   `rg` across current Markdown, prompts and historical entry points. Replace
   conflicting current instructions; retain useful history with an explicit
   supersession and link. Keep raw transcripts and private attachments out of
   the repository.

| What changed | Durable home | Other updates when affected |
| --- | --- | --- |
| Shared UX, editorial or operating preference | The existing decision here, or a new stable decision ID | Relevant workflow; FEATURES for implemented behavior; PRINCIPLES only if a general principle changed |
| Trip fact, selected image, itinerary or scoped editorial choice | Trip source/overrides and its intake/provenance record | Attribution and trip status as needed; no global rule for a one-trip choice |
| Technical contract or authoring/delivery process | FRAMEWORK or the applicable workflow | FEATURES when capability changes; AGENTS/AGENT_PROMPTS/README when entry instructions change |
| Accepted work still unfinished or a task handoff | WIP: accepted direction, canonical links, exact next action, source/branch state and checks still needed | TODO for remaining work; label required behavior separately from implemented behavior |
| Completed change and evidence | Dated CHANGELOG entry and relevant delivery/provenance notes | Link to the current rule; historical records never become a second current specification |

### Before delivery or handoff

- Revisit all owner messages since the last documentation checkpoint, including
  follow-ups after a prior final response. Every durable change must have a
  current home above. If no rule changed, retain the existing rule; do not
  manufacture an entry or rewrite unaffected docs for a status reply.
- Read the resulting guidance as a future agent without this chat: it must say
  what to preserve/change, why, where the source lives, how to check it and what
  remains unfinished. An accepted requirement is not proof of implementation;
  record observed checks and limitations honestly.
- Fix the authorized behavior/data, and add meaningful behavior regressions when
  warranted. For shared behavior changes, check the reference, a demo and an
  independently populated fresh draft, including the actual target event model.
  Markdown string tests cannot prove agents followed the rule or UX is correct.
- Complete the documentation edits before the implementation commit and
  publication, not as a later cleanup task. Include source, relevant current
  guidance and generated output together. After integrating remote main,
  reconcile concurrent corrections as well as code; then follow the existing
  test/build/deployment checks. A docs-only task needs no unrelated runtime edits.
- Briefly identify the updated decision/workflow or trip record in the final
  response. For unfinished work, leave a usable WIP checkpoint and report the
  limitation rather than declaring the correction complete. Routine maintenance
  within the authorized task does not require separate permission.
