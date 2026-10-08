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

3. Apply the reviewed migration remotely with
   `npx wrangler d1 migrations apply travels-community --remote --config workers/photo-auth/wrangler.jsonc`.
   The schema is `workers/photo-auth/migrations/0001_community.sql`. It creates
   profiles and comments; it does not seed real visitor names or comments.
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

Lists page forward by `(created_at, id)` with 50 records per request. No polling,
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
