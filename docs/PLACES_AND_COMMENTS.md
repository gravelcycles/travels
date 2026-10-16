# Places and photo conversations

Architecture and implementation, reconciled 11 October 2026. Read
[OWNER_DECISIONS.md](OWNER_DECISIONS.md) before intake or UX changes, especially
O01–O04 on copy, explicit links and sidebar continuity. Provisioning and
production verification follow [COMMUNITY_OPERATIONS.md](COMMUNITY_OPERATIONS.md).

The smallest useful extension is **curated place data in Git + live photo
comments in the existing Cloudflare service**. Keep the shared map and viewer.
No Google Maps API, API key, live place lookup, scraping service, SSO, or account
registration is needed. Add or edit a place in Studio, or ask the agent to research its facts and imagery.

## Try the demos

- [Places, food and group reviews](https://gravelcycles.github.io/travels/demo.html?journey=alpine-crossing&experience=places)
- [Display name, unlock and photo comments](https://gravelcycles.github.io/travels/demo.html?journey=alpine-crossing&experience=comments)

Use any display name and the sample password **demo**. The password is a UX
simulation and does not authorize private photos. Existing private-photo
protection is unchanged. A protected photo still needs real photo access before
the comment preview can be opened.

Places supports food/sight filters, this-day filtering, map pins, source links,
image credits, a photo gallery, group averages and individual reviews. A saved
but unvisited place has no reviews. The viewer hides Places controls when the
whole trip has no curated places; Studio still supports adding the first one.
An empty filtered day/search result does not hide those viewer controls.

The `experience=places|comments` query opens a temporary review toolbar, a local
group-review editor and a comments/unlock simulation in the existing shared
template. It is a review entry point within the shared sample template, not a separate application. The simulation is restricted to fictional demo journeys. Published real journeys
show Comments directly and use the authenticated live service; they never write
to the demo store. Local drafts remain ineligible until publication.

Preview comments, reviews and unfinished drafts save in localStorage, scoped by
journey and then place/photo ID. The local visitor ID survives closing a tab;
demo access lasts for the tab session. Changing a display name preserves
ownership, and earlier comments retain their original attribution. This is not
verified identity. Clearing browser data can lose local ownership. Reset preview
edits requires confirmation and clears only the active journey's preview data.
No preview write reaches the Worker, repository, other visitors or a database.
Failed writes retain text and report failure; unavailable storage preserves the
current-page draft with an honest notice. Treat preview text as disposable.

Real Lucerne locations demonstrate the editorial shape. Their addresses and
descriptions link to tourism/venue sources; positions remain explicitly
approximate. All group reviews and visit memories are invented and marked sample.
Place cards now use actual photographs: restaurant media authorized for
noncommercial use and Wikimedia Commons images with credited reuse licenses.
Author, source and license links appear in galleries; derivative details are in
[the asset credits](../dist/assets/places/ATTRIBUTION.md). Switzerland's real trip
has no fabricated restaurant visits or ratings.

## Maps-style place cards

The shared places view retains the familiar list → place →
Overview/Reviews/Photos flow, with the atlas's warm surfaces and restrained type.
Search, category and day filters preserve their state when returning from a
place. Empty filtered results offer a direct way back to all places. Ratings
belong explicitly to our group; saved unvisited places have no invented score.

The UX preview supports rating-only or written reviews, editing, deletion with
Undo, and per-place draft recovery. Photos open an accessible full-screen gallery
with previous/next navigation, complete images and attribution. Map pins use
screen-space clustering with accessible place choices. On phones Places opens expanded with results visible immediately. Show map /
Show list explicitly switches space between the map and results; automatic
pin fitting never collapses the list. Search and event scope stay directly
available; Filters reveals the category choices, with an active-filter count.
The handle and broad non-control areas of the list heading and detail top bar
also drag the sheet directly, including after Show map (owner follow-up,
16 October 2026). The sheet follows the finger, then settles into the map or
reading position; a cancelled gesture restores its starting position. Header
buttons remain taps, result content remains scrollable, and exposed map space
remains pannable. A map pan/zoom immediately after Show map cancels its queued
recenter; finishing the sheet animation must not undo the traveler's movement.
Show map / Show list remains the keyboard/tap alternative.
The compact map sheet keeps result cards and hides browse controls. Short
landscape uses a side sheet so the map and readable results remain reachable. Tabs support arrow keys, Home and End.
Browser Back and Forward follow place details and galleries. A return from
linked trip photos or a temporary close keeps the same detail nodes, images,
expanded disclosures, selected tab and scroll. Back to the list and Forward to
the detail restore that history entry's tab and independent tab scroll positions.
Refresh changed content and auth state; do not rebuild an unchanged detail just
because its surface becomes visible again.

Photo conversations use a contextual panel with per-photo drafts, previous/next
photo navigation, edit/delete-own and Undo. Password plus display name is one
small welcome form; changing a name later does not ask for the password again.
The composer gives clear saved/error feedback and supports Command/Ctrl+Enter.
Back, Close and Escape dismiss the foreground surface before its photograph.
Short screens, reduced motion and keyboard focus have dedicated treatments.

The code is shared across real journeys, samples and empty drafts. The
`places-comments.js` coordinator owns the local persistence adapter;
`places-panel.js` and `photo-comments.js` own focused interfaces, with matching
stylesheets. Real photo authentication now also signs a separate remembered visitor identity.
The Worker/D1 implementation is ready for the provisioning and deployment steps
in the operations guide; backend availability is reported honestly in the UI.

These are our own components and curated records. There is no Google logo,
copied review feed, Maps API call or automatic opening-hours feed. The Google
Maps action opens an ordinary link. The first-party layout reference was
[Wirtshaus Taube on Google Maps](https://www.google.com/maps/search/?api=1&query=Wirtshaus+Taube+Luzern),
inspected 19 September 2026. The project-specific quality criteria and evidence
are in [the UX acceptance record](PLACES_UX_REVIEW_2026-09-20.md).

## What lives where

| Information | Owner and persistence | How it changes |
| --- | --- | --- |
| Name, category, coordinates, day links, factual description | Journey JSON | Studio Places or agent; review, validate and deploy |
| Our visit notes and individual group ratings | Journey JSON | Owner editing in Studio Places, or supply actual words/ratings to the agent |
| Venue/landmark pictures | Reviewed local derivatives or approved HTTPS assets, with credit/source/permission basis | Agent researches candidates and imports approved assets |
| Visitor comments on a trip photo | D1 database behind the existing photo Worker | Password-authorized browser requests; no site rebuild |
| Visitor display name and hidden visitor ID | Signed remembered session | Enter name when unlocking; no account provider |

GitHub Pages serves static HTML/JS/assets; it cannot itself persist visitor
writes. The current photo Worker already checks credentials, signs short-lived
access tokens, remembers access on its own origin, and returns through a
one-time authorization-code flow. Extend that existing boundary.
[GitHub Pages documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)

Cloudflare D1 can be bound directly to that Worker, with prepared SQL statements.
This recommendation adds one database binding and a migration, while preserving
the present hosting and authentication. A custom SQLite-backed Durable Object
per trip is an alternative, but requires a new stateful service class, migrations
and cross-trip moderation/export design. The existing short-lived login-code
objects are not comment storage. A third-party commenting platform adds identity,
privacy and UI integration work without helping prompt-authored places.
[D1 Worker binding API](https://developers.cloudflare.com/d1/worker-api/)

## Live unlock flow

1. **Unlock photos** leads to the existing secure first-party login window.
   Offer optional **Display name** beside the shared password. Collect names there so
   credentials still stay on the Worker origin. No email, SSO or registration.
2. After checking the password, create/reuse a random visitor ID distinct from
   the password credential ID. The current token `id` identifies a shared
   credential, so it cannot identify a comment author.
3. Carry the visitor ID and display name through the remembered cookie,
   single-use grant and signed access token. Existing remembered users can view
   photos as before; ask them for a name on their first comment. Names can be
   changed for future comments without rewriting earlier attribution.
4. The atlas returns to the selected photo/day. Photos remain the focus; a
   **Comments** button opens a side panel on desktop or a sheet on phones.
5. Anyone with valid photo access may read/post comments, including people who
   did not travel with the group. They may delete their own comments; the owner
   can hide/delete any comment. A new device is a new visitor unless a later
   account-free recovery mechanism is intentionally added.

Display names are self-chosen and non-unique. A hidden signed ID establishes
ownership; a name such as “Alex” is not an identity or moderation role. Sharing a
password grants the ability to comment, not the ability to impersonate an
authenticated traveler. Requiring a name for every reader is optional; this
demo shows the user's proposed combined unlock form.

## Minimal write API and storage

Implemented endpoints on the photo service's origin:

```text
GET    /community/journeys/:journeyId/photos/:photoId/comments?after=cursor
GET    /community/journeys/:journeyId/comments/summary?after=cursor
GET    /community/journeys/:journeyId/comments?before=cursor
POST   /community/journeys/:journeyId/photos/:photoId/comments
PATCH  /community/comments/:commentId
DELETE /community/comments/:commentId
POST   /community/comments/:commentId/restore
GET/PATCH /community/profile
GET    /community/admin/export
PATCH  /community/admin/comments/:commentId
```

Visitor endpoints require a valid access token and allowed Origin. Comments inherit the
photo's access boundary, including reads; private photo comments never enter
public JavaScript bundles. Preserve CORS preflight, no-store responses, credential
revocation and existing auth-restoration behavior. Do not trust an `unlocked`
browser variable, visitor ID, display name or `groupId` in a request body.

Start with one `comments` table: `id`, `journey_id`, `photo_id`, `visitor_id`,
`display_name_snapshot`, `body`, `created_at`, `deleted_at`, `client_request_id`.
Index `(journey_id, photo_id, created_at, id)` for stable cursor pagination. A
unique `(visitor_id, client_request_id)` makes retries idempotent. The signed
session supplies the author fields; the server generates timestamps and IDs.
Separate admin credentials authorize moderation; a display name never does.

Publish a small server-side index of eligible journey/photo IDs alongside the
Worker so callers cannot invent a photo target or comment on a trashed item.
Derive it from the same reviewed build inputs; do not copy the whole private
photo manifest into D1. Define how photo removal hides associated comments and
how exports retain stable photo references. Restoring a photo should not change
its ID. Deploy the eligibility index before exposing new commentable photos.

Validate plain text (name 1–40, comment 1–1,000 characters), bound request bodies,
rate-limit posts by visitor and IP, and escape all rendered content. Add
pagination, moderation and export before inviting a group. Show sending/saved/
failed states; retry with the same client request ID and retain the draft.
Refresh comment bodies on opening the panel and after posting; trip notification
metadata also refreshes on authorized entry and visibility/focus returns, subject
to its cache lifetime. Sockets, timers and realtime subscriptions are unnecessary.

The demo is intentionally not a security implementation. Live delivery needs
Worker integration tests for expired/revoked tokens, CORS, target eligibility,
cross-author deletion, admin scope, rate limits, concurrent/idempotent writes,
pagination and errors, plus runtime and public checks. Check current account
usage/allowances before provisioning; this proposal makes no price guarantee.

## Comment notifications

Owner direction, 11 October 2026, is recorded in
[O17](OWNER_DECISIONS.md#comment-notifications--11-october-2026).
The photo Comments action, both in the sidebar/card and fullscreen, shows its
unread number in a red circular badge. Once all comments are read it shows the
plain total. A count is unknown until authorized metadata has loaded; a failed
request must not imply that there are no comments.

The top-right bell opens **Most recent comments**, newest first across the whole
current trip, irrespective of day or route-group filters. Each row identifies
the author, comment, time and photo context. One activation opens that photograph
fullscreen with its conversation already layered above it; there is no sidebar
or compact-card detour (owner correction, 16 October 2026).
If its event is hidden, enable only that event's Past / Future locked in /
Future TBD category through the shared filter controls. Preserve the other
category choices and the current route group; reveal all routes only if the
target photo is still excluded by that group.
Only traveler photo copy or actual capture-time/event context supplies a label;
no venue guesses or generated captions. The clicked comment remains visible even
when it falls beyond the oldest conversation page. Close/Back preserves the
underlying photo/map flow and unfinished drafts. Over fullscreen, the conversation
uses a compact Comments/count heading, thread and composer without repeating the
thumbnail, photo title, position or photo navigation. Contextual sidebar comments
retain their photo context. A deliberate downward drag from anywhere in the
sheet header (handle, title, blank space or Close control) dismisses just the
conversation through the same history path as Close. The owner's later
16 October clarification requires the whole header: tolerate initial sideways
wobble, prevent text selection and retain ordinary button taps/keyboard actions.
Suppress the click after any moved header drag, including one starting on Close; short,
horizontal or cancelled drags leave it open. Scrolling the thread and editing
text do not drag the sheet. Keep Close, Escape, Back and reduced-motion behavior.
Load more belongs inside the thread scroller; short screens use a compact inline
composer so the target comment remains readable. On portrait phones the existing
full image and matching blurred preview align above the sheet without changing
their source, dimensions or zoom transform; dismissal restores their alignment.

Read state is an explicit set of comment IDs in local browser storage, scoped by
journey. Mark only displayed rows, including those brought into the scroll viewport;
opening a thread or loading a page does not clear offscreen/unloaded comments.
Posting one's own comment marks it read. Reading in another tab updates the
badges. Clearing browser storage resets read status; unavailable storage retains
current-page state. Names, bodies and credentials are not stored with read IDs.
Deleted/moderated/ineligible comments do not count; restoring an already-read ID
does not make it unread again.

Conversation rendering retains unchanged rows by comment ID and rendered state;
cached reopen, count refresh and loading updates do not rebuild the thread.
Changed/reordered/deleted comments still reconcile, ownership controls refresh,
and a live editor retains text/selection. Locking access clears retained rows.
Draft persistence skips only confirmed unchanged saves; empty composers remove
existing drafts instead of creating empty records. Failed writes/clears remain
retryable and current-page text survives. Preserve the explicit visibility
refresh on reopen so row reuse does not suppress unread tracking.

The shared model uses one paginated trip metadata summary (`id`, `photoId`,
`createdAt`, 500 rows/page), deriving exact per-photo and trip totals against
local read IDs. Summary pages replace the prior snapshot atomically. The recent
feed separately loads 30 full comments per page, newest first by `(created_at,id)`.
Both endpoints apply eligibility before pagination and use the additive partial
`comments_journey_order` index. No per-photo count requests, public comment data,
server read receipts, background polling or new service are needed. Initial and
stale summary reads transfer O(visible comment count) compact metadata; this is
the deliberate cost of exact counts for arbitrarily partially-read threads.

Authorized data uses a thirty-second memory cache and coalesces matching in-flight
reads. Mutations invalidate/update the shared snapshot and feed; auth lock clears
private caches and DOM, with late responses discarded. Read IDs survive a lock.
Live access remains the existing photo password. Demos use local preview comments;
unpublished drafts keep an honest unavailable-until-publication state. Empty,
loading and failed feeds have inline guidance and retry. See
[operations](COMMUNITY_OPERATIONS.md) for migration and Worker-before-Pages rollout.

## Prompt-authored places and imagery

`pointsOfInterest` is an optional journey array. Absent means no annotations.
Keep it separate from the existing itinerary `places`: restaurant pins must not
silently become route endpoints, change distance totals or create Replay legs.
These annotations and their reviews are shared across route-group filters.
`dayIds` provides the explicit day filter; `[]` is valid for a journey-wide idea.

Each entry has a stable ID, `name`, `category` (`food`/`sight`), `[lng, lat]`
`coordinates`, `locationAccuracy` (`approximate`/`verified`), `status`
(`visited`/`saved`), `dayIds`, `summary`, and labeled HTTPS `sources`. Optional
`note`, `address`, `mapsUrl`, `images`, `reviews`, `photoIds` and `sample` supply content.
Images need `src`, `alt`, `credit`, `sourceUrl`, optional HTTPS `licenseUrl`, and `permission` (`owned`,
`permission`, `licensed`, `illustration`, `linked`). `linked` is an owner-requested
external reference: it requires an HTTPS image URL and cannot carry a local
asset or a `licenseUrl`; it does not assert reuse rights. Reviews need `authorId`, `authorName`,
an integer `rating` 1–5, and `text` (empty for a rating-only review); one entry per author per place. The UI derives
the mean. A single joint review also works: one stable group author with one score.
Saved/unvisited places cannot have ratings. Sources and private originals should
be reviewed before publication; the supported place content is public.

For every new point, ask the agent to verify the location and assemble a small
reviewable content patch. A Google Maps link is useful input and an outbound
reference, not an ingestion API or permission to republish an image. Prefer our
own photos, owner-provided venue images, or licensed images whose attribution and
reuse basis can be recorded. The owner may explicitly request a curated,
source-hosted image reference using `permission: "linked"`; keep its contributor
credit and source link, without asserting a license or publishing a local copy.
Otherwise retain the source link and leave the image slot empty when reuse is unclear. There is no automatic
Google photo pull in the viewer or build. Permission-backed imported images
become local optimized derivatives; linked references load from their original
image host. Neither path needs a live place lookup.

Example prompt:

> Add [place name / Google Maps link] to [journey] on [day]. It is a
> [restaurant / point of interest] that we [visited / saved for later]. Research
> the place using official sources; give it a stable ID and reviewed coordinates,
> a short factual description, source links and credited image candidates.
> Do not use the Google Maps API. Our actual ratings and notes are: [names,
> scores, comments]. Keep facts separate from our opinions; do not invent a
> visit or review. Add approved images, validate the journey, preview and deploy.

## Review and next release

Use the two demos to decide whether individual ratings or one joint group review
reads better, whether comments should open as a panel, and whether readers must
enter a name immediately or only when posting. This release uses individual
ratings plus an average as the working assumption.

Deploy and verify live comments through the existing Worker/D1 boundary using the operations guide. Group reviews can be edited by the owner in local Studio and published through
the ordinary source-review workflow. If visitor browsers ever write them live, add server-assigned traveler/editor authorization;
the shared visitor password alone cannot distinguish the traveling group from
friends visiting the site. Do not bolt unverified group membership onto the
display-name form. Image intake remains agent-operated. Live service delivery and group authorization
remain separate follow-up work; the local UX does not simulate trusted permissions.

## Implemented service boundary — 8 October 2026

The service uses a signed `visitorId` distinct from the shared credential `id`.
Older remembered sessions upgrade automatically; access tokens without a visitor
identity ask for a secure restoration before commenting. Names are optional at
photo unlock and required when posting. A D1 profile holds future attribution;
existing comments keep their original display-name snapshot. Names are not
verified identities and cannot grant moderation or traveler permissions.

Real comments are loaded on opening/navigation and after mutations. Requests
fail closed without storage/configuration and preserve unfinished text. Posting
reuses its client request ID after a timeout or reload. Reads page in groups of
50, exports in groups of 100. Writes are limited per visitor and IP; photo
removal immediately hides its discussion after the eligibility index deploys.
Author deletion has a five-minute Undo window; moderator-hidden comments cannot
be restored by their author. Retention/export/security details and exact
provisioning commands are in [COMMUNITY_OPERATIONS.md](COMMUNITY_OPERATIONS.md).


## Photos + Places — current contract

Reconciled 11 October 2026, including the later photo-entry/map-popup
clarification; supersedes the 8 October proximity prototype/release and the
earlier all-photo-fullscreen interpretation of the October UX request.

The production layer uses `photo-places.js` for explicit saved associations
and stable screen-space grouping, with `photo-bubbles.js` for map/card lifecycle.
No scene query or per-trip implementation is needed. A selected bubble retains
its members, order and current photo during zoom/pan. Pins stay on actual photo
coordinates. No-coordinate photos remain in albums and explicit place selections.
Place pins coexist with bubbles on day maps. Route-group projection and
local/trashed eligibility apply before displaying a selection. Legacy photo
`hidden` flags remain ignored; do not revive Hide through Places.

Optional `point.photoIds` is an ordered list of unique photo IDs from that journey.
Absent or `[]` means no links. GPS proximity creates no suggestions, venue
labels or About-place action. Do not fill these fields based on distance.
A photo may be linked to more than one place. Sources retain IDs through Trash
and local-only asset states; the public build filters ineligible IDs from its
public bundle without modifying the source. Old records require no migration.
Links do not imply GPS, a visit or a rating. Keep those facts independently sourced.

**Studio → Places** edits records through the shared trip plan, autosave recovery,
readable Review/Discard and three-way save reconciliation. Venue image fields
include source, alt, photographer credit, source link, license and permission
basis; the editor does not fetch or approve an image automatically. Public venue
imagery must not reuse protected family derivatives. Curated group reviews are
owner data in Git; visitor photo access still grants no editing permission.

Desktop keeps days continuously on the left, map in the center and the existing
journal/photo sidebar on the right. A map circle bubble (single or clustered)
or right-hand reel thumbnail selects a photo in that existing sidebar without
opening fullscreen. The large top-right selected/lead image opens fullscreen in
one activation. Album/grid and explicitly linked Places viewer entry retain
their existing flow. The sidebar image stays uncropped with a stable-height
frame; no second photo panel is inserted. Album navigation does not regroup map
bubbles or replace their own thumbnails. Stationary refreshes retain bubble
nodes/image loads. Before switching days/stops, close old map popups and hover
previews, cancel pending opens and clear the old photo selection. Phones use one
bottom event picker and a consolidated current-event card with contextual Places.
Phone map bubbles select the compact photo card and its large image opens
fullscreen; the existing grid/swipe flow stays intact. Back/Forward and comments
use shared overlay history.
Ordinary desktop sidebar and fullscreen Comments follow the visible trip order,
including navigation beyond a clicked map cluster. Filmstrips/grids retain the
current event; arrows cross events and update the map/story. Explicit Places
collections keep their deliberate order/count through Comments and fullscreen.
A return from Comments/fullscreen retains the selected photo, including across
cities. Geographic map groups remain independent of browsing membership (O03).

Places initially uses the selected day/stop (all places from a whole-trip view).
The whole-trip overview supplies no selected event: its phone Places count and
entry cover the whole journey, and the event-only filter is disabled until an
event is selected. This follows [O06’s unselected opening](OWNER_DECISIONS.md#unselected-map-opening--16-october-2026).
Deliberate search, category and scope changes persist while browsing and reopening;
an empty local result offers All places. Overview and Photos remain actual tabs;
populated group reviews float from an explicit Group reviews action. Empty saved
places have a quiet inline review state, with no empty review-modal detour.
Recenter is a small map action, venue credit stays separate, and empty linked-photo
boilerplate is omitted. Day/Stop wording and edited titles follow the journey.

Alpine Crossing includes four clearly labeled sample album placements using its
already approved, credited venue imagery. Three have illustrative coordinates;
one deliberately has no location. These are fictional sample content and do
not add visits, ratings, coordinates or photographs to a real journey.
