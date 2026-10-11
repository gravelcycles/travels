# Owner decisions that every atlas inherits

Reconciled 11 October 2026 against available project conversations, committed
corrections and current shared behavior. Read this before creating a trip,
importing content, changing UX or resuming a workstream. These are product and
editorial requirements, not optional polish. [AGENTS.md](../AGENTS.md) defines
the reading order and update process; [the audit](ATLAS_CONTINUITY_AUDIT_2026-10-11.md)
records the evidence and gaps. Technical contracts remain in the linked workflows.

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
| O03 · Desktop photos | Keep days left, map center, and the existing journal/photo sidebar right. Give the selected image useful space, compact controls, adjacent thumbnails and expandable details. Its uncropped frame has a stable height while browsing; clicking or keyboard-activating the image opens full screen. | Switch portrait/landscape, map bubble/album/Places entry and day; controls must not jump, unrelated bubbles must keep their own images, and the old day's selection must clear. Stationary map refreshes must not remove bubbles or restart their image loads. |
| O04 · Loading and conversations | Preserve the same-size blurred preview until the full image is ready; no black/sizing/loading/auth flash. Fullscreen gets the full derivative, not a sharp thumbnail substitute. Keep the reviewed 350 ms fullscreen reveal and desktop cached-image reveals without refetching. Comments/reviews float with a soft shadow and visible sidebar context; open immediately, with inline loading/retry and preserved text. | Test a cold load, cached revisit, rapid selection, slow/failing request and remembered/anonymous access. Reuse bounded caches/preloads; never solve speed by exposing private media. Respect reduced motion. [Photo workflow](../PHOTO_WORKFLOW.md), [conversation UX](PLACES_AND_COMMENTS.md). |
| O05 · Photo camera | Keep the exact pin separate from its saved map frame. Do not move the photo map when successive pins already fit. Nearby moves are direct; longer moves preserve geographic context. Studio keeps the same-day working frame until deliberately changed. | Browse nearby/distant/unlocated photos; pan manually; check a saved off-center frame on desktop and phone. Unknown locations use event/city context, not a fabricated viewpoint. |
| O06 · Map hierarchy | The map is the main experience. Keep terrain legible but routes dominant; preserve transport colors/patterns during selection and match the key. Settlement labels stay readable above routes; road labels/shields stay below. Credits start collapsed but remain accessible. | Inspect intersections, overview and close zoom; desktop travel-row hover/focus highlights only that leg without a click action, popup or camera jump. Phone route taps select without desktop tooltips. [Journey workflow](../JOURNEY_WORKFLOW.md#map-location-labels). |
| O07 · Map markers | Use the reviewed upright signposts, quiet grouped/repeat dots and compact linked hover/focus previews. No sideways/upside-down balloons or large leader-line clutter. Intermediate rail dots are small; each train leg's endpoints are larger. Overview shows endpoints, not intermediate stations. Signpost stems meet the orange endpoint ring's top. | Check route/label/control collisions and fast event changes; dots appear after their route lines and stale pending markers cannot leak into another view. [Location labels](LOCATION_LABELS.md). |
| O08 · Phone navigation | Keep the map-led day/stop screen, persistent header/Replay access and one bottom event picker. Photos opens that event's grid; the Day/Stop control returns to its map. Large photos, responsive swipe/pinch, animated double-tap and deliberate pull-up location follow the established phone flow. | Closing location stays closed through swipes/grid round trips; zoomed drags pan the photo. Check All days, Back/Forward, Escape, 320/390 px and landscape. Desktop retains its left list, without a second day picker. No stray orange pointer-focus rings; keyboard focus stays visible. |
| O09 · Replay and arrival | Replay is map-only: routes, stories and controls, with no photographs, photo pauses or preloads. Keep its two-second autoplay delay, default 2× and readable rest-day holds. Arrival → city is a separate reviewed flow: contextual pullback, combined pan/zoom, 1.5-second trace, plain orange circle, 0.25-second arrival hold, then city framing. | Check a rest event and a complex multi-leg event. Manual navigation/movement cancels stale animation; reduced motion works. City framing includes nearby photos and assigned marked places using the documented boundary/radius rules. [Arrival contract](ARRIVAL_CITY_DEMO.md). |
| O10 · Editorial restraint | Blank stories/taglines are valid. No generated “stayed here” or “In one place” filler. Optional authored taglines are italic; story paragraphs survive saving. First album photo is the event preview; journey cover is a separate choice. Keep technical/prototype explanations out of the story. | Preview deliberately blank and authored fields after save/rebuild; opening a day's lead starts at photo 1. Do not revive the retired independent daily lead picker. Keep research/uncertainty in provenance with only useful factual context in public copy. |
| O11 · Creator safety | Save locally works without a required Preview/Check step. Unpublished drafts autosave and recover after reload; saved/draft differences are readable, discard is recoverable, and real conflicts require field choices. Do not lose edits to background updates. All non-trashed photos show; there is no Hide feature. | Test reload recovery, save, preview, independent/concurrent edits and failed save. Trash stays deleted until an explicit restore; never interpret removal of Hide as restoring Trash. New editable features use this same recovery/save flow. |
| O12 · Route quality | Follow the mode's physical network, using GPX when available and reviewed reconstruction otherwise. Straight lines are temporary guides, not completed route work. Exact network alignment does not prove a booked service. Preserve reviewed overrides and durable anchors; endpoint-only edits preserve the rest of the line. | Inspect every supplied leg at close zoom, regenerate without losing edits, and prepare local mode data for Studio proposals. Missing sources stay explicit; do authorized research instead of returning a finished-looking endpoint sketch. [Route workflow](../ROUTE_GEOMETRY_WORKFLOW.md). |
| O13 · Trip structure and empty data | Calendar days and city stays are supported by the same viewer. Preserve confirmed dates and stable IDs; TBD is itinerary uncertainty, separate from route accuracy. Videos belong in the existing gallery/player; group travel belongs in the existing day details and Studio. | Choose the event model from the request; test actual city-stay/transfer/TBD inputs when relevant. Hide viewer Places actions only when the whole trip has no curated places; Studio still adds the first one. Do not hide capabilities merely because a trip is new. |
| O14 · Media and access | Originals stay private; publish optimized, metadata-stripped derivatives through the existing private Cloudflare pipeline. Photo passwords are shared across the site with remembered access, not per-trip accounts/SSO. Keep services free unless the owner changes that constraint. | Count all supplied stills, including bulk DNG imports; review GPS/date matching, checksum-verify uploads, use resumable single-file transfers on poor Wi-Fi. Show non-trashed photos while preserving deletions. Never recreate retired public photo Releases. [Photo workflow](../PHOTO_WORKFLOW.md), [service operations](COMMUNITY_OPERATIONS.md). |
| O15 · Delivery and proposals | The agent operates tools, Studio, assets, tests, Git and deployment. Completed authorized work deploys by default after integrating current main and verifying Pages/public content. A request for ideas or a local demo remains that scope until implementation/publication is authorized. | Retain existing authorization; do not ask the owner to run commands or approve already approved work again. Preserve other work, local prototypes and unpublished media. A commit/build alone is not a deployment receipt. [Deployment](DEPLOYMENT.md), [WIP](../WIP.md). |

“Apple-like” means these observable qualities: stable layout, clear hierarchy,
large useful imagery, restrained copy, continuous geographic context, responsive
interruptible motion, obvious navigation and reliable recovery. It does not mean
adding decorative animation, labels, another panel or another confirmation step.

## Reversals that must not be undone accidentally

| Earlier direction | Latest applicable decision | Evidence |
| --- | --- | --- |
| Generated photo captions/descriptions and later metadata-derived labels | Blank traveler-only copy; dates remain separate | 9 September, repeated 11 October; `32cf654`, `de72fad` |
| Photo landmarks removed on 9 September | Sparse Photos + Places bubbles authorized on 8 October; existing sidebar restored and refined 11 October | `147229b` → `1c7dabe` → `ed7f106`, `7f962ff`, `b80ed36`, `8b6fbc9` |
| Nearby-photo suggestions in the Photos + Places prototype/release | Explicit links only; remove geographic venue guesses | 11 October; `3d88dd7` |
| Photos inside Replay | Map-only Replay across desktop/phone | 10 September; `bcfc91f` |
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
  boundaries, saved venues and unresolved five photo pins remain in
  [its intake record](HEADING_EAST.md). A request for light factual venue
  descriptions does not authorize personal photo captions or invented visits.
- Shared branding follows [BRANDING.md](BRANDING.md); an old logo option or
  demo screenshot is not authority to replace the reviewed artwork.

## Record the next correction before closing the task

1. Identify the decision above, or add one if the correction is new. Record its
   date, scope, intended behavior and the older choice it replaces. For a trip
   fact, update that trip's source/provenance instead of creating a global rule.
2. Fix the source behavior/data when that is the task. Update the applicable
   workflow and [feature inventory](FEATURES.md) in the same change. Search
   README, prompts, WIP and handoff entry points for contrary instructions;
   replace current guidance and mark historical alternatives as superseded.
3. Add a behavior regression when implementation changes warrant one, and
   compare the affected flow with the reference, a demo and a fresh draft
   populated with independent fixtures. Include the actual target trip/data
   shape. Template/asset equality alone cannot verify UX or content quality.
4. Record the checks and unresolved work. Update WIP/TODO only where status
   changes; append a dated changelog entry. Do not append a second “current”
   rule to an old handoff and leave the operative workflow contradictory.
