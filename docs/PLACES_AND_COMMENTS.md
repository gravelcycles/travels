# Places and photo conversations

Architecture and working UX demos, 19 September 2026.

The smallest useful extension is **curated place data in Git + live photo
comments in the existing Cloudflare service**. Keep the shared map and viewer.
No Google Maps API, API key, live place lookup, scraping service, SSO, or account
registration is needed. Adding a place remains a conversation with the agent.

## Try the demos

- [Places, food and group reviews](https://gravelcycles.github.io/travels/demo.html?journey=alpine-crossing&experience=places)
- [Display name, unlock and photo comments](https://gravelcycles.github.io/travels/demo.html?journey=alpine-crossing&experience=comments)

Use any display name and the sample password **demo**. The password is a UX
simulation and does not authorize private photos. Existing private-photo
protection is unchanged. A protected photo still needs real photo access before
the comment preview can be opened.

Places supports food/sight filters, this-day filtering, map pins, source links,
image credits, a photo gallery, group averages and individual reviews. A saved
but unvisited place has no reviews. The normal shared Places control is available
on every journey, with an empty state when no places have been authored.

The `experience=places|comments` query opens a temporary review toolbar, a local
group-review editor and a comments/unlock simulation in the existing shared
template. It works on a real trip, sample or Studio draft; it is not a journey
feature flag or separate application. Without it there are no comment/write
controls. Remove this review entry point when the live flow replaces it.

The demo reviews/comments save in localStorage, scoped by journey and then
place/photo ID. Demo visitor identity lasts for this browser tab's session and
survives reload when sessionStorage is available. It is not verified identity.
Closing the tab or clearing the demo session can lose deletion ownership;
**Reset this demo** clears that journey's local entries. These demo writes never
reach the Worker, repository, other visitors or a database. A failed storage
write keeps the form text and reports failure. Treat demo text as disposable.

Real Lucerne locations demonstrate the editorial shape. Their addresses and
descriptions link to tourism/venue sources; positions are explicitly approximate.
All reviews and visit memories are invented and marked sample. Existing atlas
illustrations are labeled as illustrations, not venue photographs. Switzerland's
real trip has no fabricated restaurant visits or ratings.

## Maps-style place cards

The owner asked for a closer Google Maps experience after reviewing the first
prototype. The shared places view now uses a left sidebar on desktop, compact
photo list tiles, a large photo header, name/rating/category, round quick actions,
Overview/Reviews/Photos tabs, a five-to-one-star distribution and individual
review rows. Phones use a bottom sheet with a tappable/draggable expansion
handle. Tab changes preserve an unfinished review; arrow keys, Home and End
navigate the tabs. Closing places restores the normal journey panels.

This is our own shared component using our curated data, not an embedded Google
card. Ratings say **Our group**. There is no Google logo, copied review feed,
Maps API request, automatic opening-hours feed or new backend dependency. A
Google Maps action opens the existing source link. The current first-party
reference was [Wirtshaus Taube on Google Maps](https://www.google.com/maps/search/?api=1&query=Wirtshaus+Taube+Luzern),
inspected 19 September 2026; the general review flow is documented in
[Google Maps Help](https://support.google.com/maps/answer/6230175?hl=en).

## What lives where

| Information | Owner and persistence | How it changes |
| --- | --- | --- |
| Name, category, coordinates, day links, factual description | Journey JSON | Prompt the agent; review, validate and deploy |
| Our visit notes and individual group ratings | Journey JSON initially | Supply the group's actual words/ratings to the agent |
| Venue/landmark pictures | Reviewed local derivatives or approved HTTPS assets, with credit/source/permission basis | Agent researches candidates and imports approved assets |
| Visitor comments on a trip photo | Proposed D1 database behind the existing photo Worker | Password-authorized browser requests; no site rebuild |
| Visitor display name and hidden visitor ID | Proposed signed remembered session | Enter name when unlocking; no account provider |

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

## Proposed live unlock flow

1. **Unlock photos** leads to the existing secure first-party login window.
   Add **Display name** beside the shared password. Collect names there so
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

Suggested endpoints on the photo service's origin:

```text
GET    /community/journeys/:journeyId/photos/:photoId/comments?after=cursor
POST   /community/journeys/:journeyId/photos/:photoId/comments
DELETE /community/comments/:commentId
```

All three require a valid access token and allowed Origin. Comments inherit the
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
Refreshing comments on opening the panel and after posting is sufficient for
the first release; sockets and realtime subscriptions are unnecessary.

The demo is intentionally not a security implementation. Live delivery needs
Worker integration tests for expired/revoked tokens, CORS, target eligibility,
cross-author deletion, admin scope, rate limits, concurrent/idempotent writes,
pagination and errors, plus runtime and public checks. Check current account
usage/allowances before provisioning; this proposal makes no price guarantee.

## Prompt-authored places and imagery

`pointsOfInterest` is an optional journey array. Absent means no annotations.
Keep it separate from the existing itinerary `places`: restaurant pins must not
silently become route endpoints, change distance totals or create Replay legs.
These annotations and their reviews are shared across route-group filters.
`dayIds` provides the explicit day filter; `[]` is valid for a journey-wide idea.

Each entry has a stable ID, `name`, `category` (`food`/`sight`), `[lng, lat]`
`coordinates`, `locationAccuracy` (`approximate`/`verified`), `status`
(`visited`/`saved`), `dayIds`, `summary`, and labeled HTTPS `sources`. Optional
`note`, `address`, `mapsUrl`, `images`, `reviews` and `sample` supply content.
Images need `src`, `alt`, `credit`, `sourceUrl` and `permission` (`owned`,
`permission`, `licensed`, `illustration`). Reviews need `authorId`, `authorName`,
an integer `rating` 1–5, and `text`; one entry per author per place. The UI derives
the mean. A single joint review also works: one stable group author with one score.
Saved/unvisited places cannot have ratings. Sources and private originals should
be reviewed before publication; the supported place content is public.

For every new point, ask the agent to verify the location and assemble a small
reviewable content patch. A Google Maps link is useful input and an outbound
reference, not an ingestion API or permission to republish an image. Prefer our
own photos, owner-provided venue images, or licensed images whose attribution and
reuse basis can be recorded. If an image candidate's permission is unclear,
retain the source link and leave the image slot empty. There is no automatic
Google photo pull in this design. Imported approved images become local optimized
derivatives so the deployed page need not query a place service.

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

Then implement live comments through the existing Worker/D1 boundary. Keep group
reviews prompt-authored until there is a specific need for in-browser editing.
If those become live writes, add server-assigned traveler/editor authorization;
the shared visitor password alone cannot distinguish the traveling group from
friends visiting the site. Do not bolt unverified group membership onto the
display-name form. Dense POI clustering/collision handling, image intake tools
and deeper mobile Back/Forward integration remain follow-up work after UX review.
