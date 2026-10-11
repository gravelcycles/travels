# Photo comments service operations

Implementation: 8 October 2026. Provisioning and public verification are separate
from the local implementation checks. The existing private-photo Worker owns
all visitor access; curated Places and group reviews remain public Git content.
Do not infer traveler/editor permission from a shared password or display name.

## Provisioning record — 8 October 2026

`travels-community` is provisioned and migration `0001_community.sql` is applied.
The real database ID is in Wrangler configuration. Worker version
`c7adbb5d-6643-43ce-a30a-ec920ef2f4ef` includes the community and video helpers.
Existing photo credentials/signing secret were preserved; a separate random
moderation key is installed. Its owner-readable local copy is ignored at
`build/private-auth/community-admin.json` in the primary Travels checkout.
Never commit or copy this value into an issue, chat, URL or browser bundle.

Actual Miniflare checks cover shared writes, ownership and Undo; browser fixture
checks cover the UI. Production read-only checks passed for signed visitor reads,
admin export, photo delivery and anonymous/foreign-origin rejection. No invented
comments were inserted into real memories. No billing/plan upgrade was performed.

## Provision once

Keep the owner's Free-plan constraint: do not upgrade the Worker or activate a
paid service. Confirm current usage before provisioning. D1 Free limits requests
rather than charging overages; operations here use indexed, bounded pages.
See [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/).

1. Create one D1 database named `travels-community` in the existing account:
   `npx wrangler d1 create travels-community --config workers/photo-auth/wrangler.jsonc`.
2. Add the returned database ID to `workers/photo-auth/wrangler.jsonc`:

   ```json
   "d1_databases": [{
     "binding": "COMMUNITY_DB",
     "database_name": "travels-community",
     "database_id": "THE_RETURNED_ID",
     "migrations_dir": "migrations"
   }]
   ```

3. Apply the reviewed migrations remotely with
   `npx wrangler d1 migrations apply travels-community --remote --config workers/photo-auth/wrangler.jsonc`.
   The schema is `workers/photo-auth/migrations/0001_community.sql`. It creates
   profiles and comments; `0002_comment_notifications.sql` adds the live trip
   cursor index. Neither migration seeds visitor names or comments.
4. Generate a separate random 32-byte administrator secret, retain it in an
   approved private credential store, and install it as `COMMUNITY_ADMIN_KEY`
   using Wrangler's secret-input channel. Never put it in content, browser
   configuration, command history, Git, logs, or a URL. This secret is unrelated
   to photo passwords and is accepted only by `/community/admin/*`.
5. Preserve all existing bindings and secrets. `COMMUNITY_LIMITER` is already
   declared at 20 writes per minute for each visitor and IP. Cloudflare's limiter
   is a per-location protective bound, not a globally exact quota.

Missing D1/limiter configuration fails with a 503 for comments while photos keep
working. The admin endpoints fail closed until their separate secret exists.
No unauthenticated comment-read or write endpoint is provided.

## Build and deploy in order

Run `npm test`, `npm run build`, and `npm run auth:runtime-test`. The last command
uses the actual Worker runtime and D1 SQLite with disposable local fixture data.
Apply every pending reviewed D1 migration before deploying a Worker that uses
it. The notification endpoints require `0002_comment_notifications.sql`; its
additive partial index leaves existing comments and identities intact.

Every build regenerates `workers/photo-auth/community-index.mjs` from published
real journeys. It contains only journey/photo IDs, excluding trashed or
unpublished local photos. CI checks it alongside `dist/`. Fictional demos stay
out of the live index. New drafts inherit the UI shells without having an
eligible public target.

**For every publication changing photos, deploy the Worker/index before Pages.**
This includes removals/trash and restorations, not only new uploads. Deploy the
same validated commit's Worker with `npm run auth:deploy`; then publish its
Pages output. Otherwise a new photo's comments fail closed, or a removed photo's
old discussion remains eligible until the Worker catches up. The index check in
CI guarantees reproducibility, not that the Worker has been deployed.

Verify anonymously that community reads/writes reject access; then use an
existing authorized photo session to check read, name entry/change, posting,
reload, own edit/delete and Undo, plus a second visitor's inability to modify
the first visitor's comment. Verify sample preview writes stay in that browser.
Do not leave fabricated test memories in a real trip's public discussion; use a
clearly marked test record and recoverably delete it after the check.

## Identity and moderation

The shared credential's `id` is never the author. A random signed `visitorId`
is retained in the existing HttpOnly remembered cookie, one-use grant and
short-lived access token. Earlier cookies upgrade on restoration. Display names
are optional during photo unlock and required before posting. A D1 profile
supplies future attribution; earlier comments keep their original name.

A new device, clearing the remembered service cookie, credential revocation or
signing-key rotation can prevent recovering the previous author identity.
There is no account-recovery/SSO mechanism and names are unverified/non-unique.
Changing a name cannot transfer ownership or grant moderator permissions.

Visitor APIs require an allowed Origin and valid current photo token on every
request. Admin CLI calls may omit Origin, but still need the separate secret.
All API responses are `no-store`; foreign visitor IDs are omitted from ordinary
comment responses. There is no comments data in the public JavaScript bundle.

Use `COMMUNITY_ADMIN_KEY` supplied privately in the command environment:

```text
npm run community:admin -- export /private/tmp/private-comments-export.json
npm run community:admin -- hide COMMENT_ID
npm run community:admin -- unhide COMMENT_ID
```

Exports page through all comments in groups of 100, including original request
text, edits, removed/hidden state and stable ownership references. The CLI writes
with exclusive creation and file mode 0600; keep exports outside public/source
directories. Moderator hiding is reversible. An author cannot undo moderation,
and unhide does not undo an author's deletion. Secret rotation uses the same
secret name and does not change visitor photo credentials.

## Storage, validation and failure behavior

Plain-text names are 1–40 characters and comments 1–1,000. Request bodies are
bounded to 8 KiB for Unicode text. Rendering escapes content. Signed identity
and server time supply author/timestamps; client author/role fields are ignored.
A unique visitor/request-ID constraint makes uncertain/concurrent retries safe.
The browser retains that identifier with its draft until a confirmed response.

Photo discussions page forward by `(created_at, id)` with 50 records per request. No polling,
realtime socket, automatic external lookup or Maps API is introduced. Removing a
photo from the deployed eligibility index hides all its comments and blocks
writes; restoring the same photo ID makes them accessible again.

Author deletion is soft, with a five-minute Undo window. Hidden/deleted rows and
the original submission remain in storage/export until an explicit owner
retention/purge operation; this release does not silently destroy discussions.
Backups and retention policy are owner operations. Unfinished drafts remain
local to the visitor's browser. A database/network/rate-limit error preserves
the draft and displays a retryable error; private media authentication remains
independent of comment availability.


## Conversation presentation and read latency — 11 October 2026

Photo comments open immediately in a floating card, with the photo and its
sidebar still visible behind it. Place reviews use the same card treatment and
retain the underlying place detail, filters and scroll position; their content
is bundled with the journey and requires no review fetch. Phones use inset,
rounded sheets with keyboard-aware bounds. Close, outside click, Escape and
Back/Forward return to the underlying view. Existing review authoring permissions
remain unchanged.

Authorized photo profile and comment reads start together. Concurrent matching
reads share one request; a successful profile is reused for five minutes and a
comment page for thirty seconds in memory. Reopening a stale conversation shows
its cached comments while refreshing. These records are never persisted to disk;
locking photo access clears them and late responses cannot repopulate them.
Mutations protect newer local results against older in-flight reads. Pagination
retains already loaded pages while fresh. Names are required to post, not to
read; unfinished text stays available while the profile loads.

Community requests have an eight-second deadline and an explicit retry action.
Network errors stay in the conversation, retaining cached comments and the draft;
they do not launch an unrelated photo-unlock prompt. Comment thumbnails reuse the
current image until the photo/access changes and request a small derivative.
No background polling, service-plan change or new public endpoint is introduced.

## Trip notifications and local read receipts — 11 October 2026

The owner's notification request adds red unread counts on photo Comments
buttons and a top-right trip feed of most recent comments. Read membership is
local to the browser. It uses explicit comment IDs so opening a discussion's
first page cannot accidentally mark its unloaded comments as read. The server
does not accept, persist or infer visitor read state.

Two authenticated GET routes share the existing access, allowed-Origin and
`no-store` boundary:

| Route | Response and order |
| --- | --- |
| `/community/journeys/:journeyId/comments/summary?after=cursor` | Up to 500 `{id, photoId, createdAt}` entries, oldest first; `next` is the next page cursor or `null`. No body, author or ownership fields. |
| `/community/journeys/:journeyId/comments?before=cursor` | Up to 30 ordinary comment views, newest first; `next` is the next page cursor or `null`. Views include `journeyId` for precise mutation invalidation. |

Both cursors encode the exclusive `(created_at, id)` boundary. The ID tie-breaker
keeps paging stable when comments share a timestamp. Each page uses one D1 query
through the partial `comments_journey_order(journey_id, created_at, id, photo_id)`
index. Eligibility is a single JSON bind filtered in SQL before `LIMIT`, avoiding
both D1's per-statement parameter ceiling and a request per photo. Hidden,
deleted and removed-photo comments never enter either response, including their
IDs. Fictional demos and unpublished drafts have no live trip endpoint.

The client fetches all compact summary pages into a temporary result and swaps
them into memory only after successful completion. This yields per-photo totals
and exact unread membership against the locally stored read IDs, including
discussions longer than 50 comments. It deduplicates concurrent loads, reuses the
result for 30 seconds, refreshes on relevant access/visibility/user actions and
invalidates after mutations. No interval polling or per-photo badge requests
are needed. A mutation/access generation guard prevents older reads from
overwriting newer local results or repopulating locked access. The recent feed
loads independently in bounded pages, so showing it never fetches every body.

A complete initial load or stale summary refresh is O(visible comment metadata),
not O(number of photos) requests. This is an intentional tradeoff for exact local
read membership and correct partial-discussion behavior. Metadata pages are
bounded, but the assembled metadata and local receipt set grow with comments;
a much larger service should review this before adding timers or downloading
whole discussions. There is no cross-request database snapshot: other visitors'
changes can become visible on the next refresh. Count freshness follows the
same short cache window as conversations. Read receipts remain local IDs;
live comment bodies and display names stay in authorized memory and clear on lock.

`test/community.test.mjs` exercises real SQLite with more than one metadata
page, timestamp ties, eligibility before page limits, removed/hidden/deleted
rows, target/auth/privacy checks and query plans with no full comment scan or
temporary ordering sort. The Worker runtime check applies all migrations and
checks both new routes against disposable D1 data. Apply the migration, deploy
the Worker, then publish Pages; verify signed reads and anonymous/foreign-origin
denial without inserting fabricated memories into production.
