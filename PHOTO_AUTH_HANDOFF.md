# Private photo access — implementation handoff

Updated 9 September 2026. **Private-photo cutover is complete.** The protected
site is live, the owner-selected initial test credential is active, and both
historical public photo Releases are deleted. All 404 historical asset URLs
return 404; all 198 private image URLs reject anonymous requests with 401.

## Budget and chosen passwords — confirmed implementation

The owner requires no paid services and wants to choose shared passwords, with
redeployment whenever one is added or removed. The revised implementation has
passed production login on **Workers Free with all eight credential slots**.
Do not request Workers Paid or replace chosen passwords with generated codes.

The browser performs PBKDF2-SHA256 (600,000 iterations per independent salt).
Cloudflare validates a separate SHA-256 verifier using native constant-time HMAC
comparison. It never runs the password KDF. The stored verifier cannot itself
be submitted as the login proof. Only public salts, IDs and fixed KDF parameters
appear on the login page. Passwords, derived proofs and verifiers must not enter
Git, logs, URLs or browser storage. The derived proof is a password-equivalent
credential and is sent only in a same-origin HTTPS POST to the Worker.

R2 still has metered overages; current storage (136 MB) is within its 10 GB-month
allowance. Workers Free caps requests at 100,000/day, and each authenticated
photo request performs at most one R2 read. That puts this Worker's maximum
photo-read path below R2's 10 million monthly free reads. Other account usage,
future stored photos and owner upload/list operations must also stay within the
account allowances. Do not promise unlimited free storage or account-wide caps.

## Approved scope

The atlas stays at https://gravelcycles.github.io/travels/. Cloudflare hosts only
private photos and authentication. No domain purchase, visitor accounts, email
service, or repository visibility change. Up to eight named shared passwords
unlock every photo. The traveler selected remembered access for 30 days.
Routes, text, captions, locations, and tiny embedded blur placeholders stay public.

## Deployed resources and local state

- Worker: https://travels-private-photos.travels-journey-atlas.workers.dev
- Current deployed code uses browser password derivation and lightweight server
  proof verification. Temporary production probe credentials were removed and
  the Worker was explicitly redeployed. The owner-selected `initial-test`
  credential is now active; production login and photo checks passed.
  Worker version: `125d91b6-75cf-4ff1-b5f8-17e27428b14d`.
- Private Standard R2 bucket: `travels-private-photos`; managed public access is
  disabled and no public custom domains are attached.
- 99 visible photographs: 198 objects, 135,849,682 bytes. Every uploaded object
  was downloaded through the authenticated Cloudflare API and SHA-256 checked.
- All 117 source photo records (including hidden/trash) use protected paths
  locally. Only visible photos were uploaded. Originals and migration backups
  remain in ignored local folders.
- Owner Cloudflare account/R2 setup and Wrangler OAuth are complete. OAuth uses
  the OS keychain. The initial owner credential is configured. Future credentials use the local
  password setup page; never ask for passwords or account tokens in chat.
- Pages implementation commit `55eeb2b`, successful run `34377620269`.
  The service fails closed without configured secrets.
- Both legacy Releases are deleted. All 404 assets have size/checksum-verified
  local backups; their historical download URLs return 404.

## Authentication

The atlas navigates to a first-party login page on the Worker. Credential schema
version 2 stores `{id, salt, iterations:600000, hash}`. Local owner setup derives
`proof = PBKDF2-SHA256(password, salt, 600000, 32 bytes)` and saves only
`SHA256(UTF8("atlas-photo-verifier-v2:" + id + ":") || salt || proof)`.
The visitor's browser repeats PBKDF2 for each active salt; the Worker applies the
separate verifier hash and checks every configured credential through native
HMAC verification. Knowledge of a stored verifier alone cannot authenticate.

All password verification remains server-enforced. A browser cannot claim it
passed a check or obtain images merely by changing client code. A leaked proof
is password-equivalent; protect it like a password. Salt disclosure permits
computing candidate proofs but exposes no value against which to test them
offline. A stolen verifier still requires the full KDF per password guess.
PBKDF2 is not a substitute for a sufficiently strong chosen passphrase.

Only verifiers and a separate signing key are deployed as Worker secrets. Login
attempts remain limited to 10 per minute per IP. The earlier server-side KDF and
portable-library fallback have been removed; no paid plan is needed for login.

A Secure, HttpOnly, host-only, SameSite=Strict cookie on the Worker remembers
access for 30 days. A same-origin POST from its login page restores that cookie
without relying on cross-site cookie access. Page loads automatically visit the
first-party restoration page and return through PKCE. A valid remembered cookie
restores photos without showing the atlas unlock dialog or password form. A
missing session returns once to the atlas prompt; cancellation and logout do
not trigger another automatic restoration on that return.

The return carries a two-minute, single-use authorization code bound to a PKCE
verifier and the allowed atlas origin. A SQLite Durable Object consumes each
code once and deletes expired grants. Session storage holds the temporary PKCE
verifier/state and the one-hour access token, never a password, password proof,
or 30-day remember token. The atlas removes the return fragment immediately.
Reloads reuse the tab-scoped access token only after Cloudflare validates it;
this avoids leaving the site during normal reloads and same-tab navigation.
The long-lived remembered cookie remains HttpOnly on Cloudflare. Tab storage is
JavaScript-readable, so same-origin script security remains part of the trust
boundary. Expired/revoked cached tokens never authorize images.

Every image GET/HEAD checks token signature, audience, lifetime and active
credential before touching R2. Requests use Authorization headers, credentials
omitted, and no-store responses. The browser displays fetched WebP blobs through
object URLs. No public image fallback or signed image URLs. Production CORS
allows only https://gravelcycles.github.io; scripts across that origin share
its security boundary. Return navigation is restricted to /travels/.

The viewer no longer exposes a Lock photos button or header status. Internal
locking clears memory and tab storage, aborts requests, revokes object URLs, tells other
atlas tabs to lock, and clears the remembered cookie through the first-party
page when explicit logout is invoked. Removing a credential or rotating the signing key invalidates associated
sessions and outstanding codes after secret deployment. A copied bearer token
is not individually revoked by ordinary logout; it expires within an hour.
Previously saved or screenshotted photographs cannot be recalled.

## Image sizes and deduplication

`photo-variants.mjs` is shared by Studio and bulk imports. At most two WebPs:
small up to 1280 pixels wide; big up to 3200 pixels on the longest edge. No
upscaling; identical sizes collapse. Metadata is stripped. Existing photos
retain their 1280 and largest derivatives without another lossy recompression.

Names are SHA-256 hashes of derivative bytes under `v1/<hash>.webp`. Identical
outputs reuse one object even across journeys. Studio also detects repeated
source uploads. Visually similar but different photos still require editorial
review; no perceptual duplicate deletion is automated. Embedded 32-pixel blur
is an unloaded state, with no third hosted file. Compared with 344 visible
legacy derivatives, this uses 42% fewer files and 21% fewer bytes.

Small serves covers, day photos and Replay. Big serves the full-screen viewer
and its immediate neighbors. The loader deduplicates fetches and bounds unused
blob cache entries. Local Studio can read ignored derivatives; the local-only
`?photoSource=local` preview bypass never works on GitHub Pages.

## Agent-operated maintenance

The user uses browser forms; these commands are for agents:

```sh
npm run auth:manage
npm run auth:credentials -- list
npm run auth:credentials -- revoke family
npm run auth:credentials -- rotate-sessions
npm run auth:credentials -- deploy
npm run auth:deploy
npm run photos:publish -- --journey switzerland-italy-family-2026
npm run photos:publish -- --journey switzerland-italy-family-2026 --all --publish
```

The credential editor binds only to loopback, requires an unguessable capability
URL, and writes owner-readable `build/private-auth/secrets.json` containing only
verifiers/signing material. Never print it or commit it. Keep an encrypted private
backup; losing the signing key requires everyone to unlock again. Revoked labels
must not be reused. Adding a replacement password uses a new label. Revoke and
rotation save locally; `auth:credentials -- deploy` uploads them and explicitly activates a new Worker
deployment; do not treat the saved secret binding alone as activation.
Revoking the last password intentionally leaves the service unavailable/locked.

The publisher refuses public R2 settings, uploads only reviewed visible WebPs,
verifies object hashes, resumes matching uploads, and marks manifests published
only after successful verification. It never uploads originals or commits or
pushes. Trash removes an album entry, not the private object; authenticated
holders of an old key may still fetch it. Erasure requires reviewing all journey
references, deleting the exact unreferenced objects, and checking their URLs.
There is no automatic destructive prune command.

## Acceptance and deployment receipts

Local verification: **80 tests pass**, build succeeds, and actual workerd tests
cover login proofs, single-use PKCE exchange, remembered cookies and private R2.
Tests also compare browser derivation against Node's independent PBKDF2 result,
reject lowered KDF costs, prevent stored-verifier login, reject duplicate proofs,
and fail if the server calls a password KDF while authenticating.

Production verification on Workers Free passed with eight temporary random test
credentials: login 200, remembered session 200, single-use code replay rejected,
authenticated image checksum matched, anonymous GET/HEAD rejected, wrong password
rejected, and logout expired its cookie. Test secrets were deleted and cleanup
was explicitly deployed. The owner-selected initial test credential was then
deployed and verified: login/remembered session 200, authenticated GET/HEAD 200,
photo checksum matched, anonymous GET/HEAD 401, incorrect password 401.
All 404 historical Release assets have matching local backups (199,772,706 bytes).

Production owner-credential acceptance also passed in the in-app browser:

- Anonymous catalog shows only a 32 px blur; login displays a 1280 px blob image.
- Journey unlock restores the 30-day remembered cookie without another password.
- Photo viewer loads a 3200 px image; Trip Replay loads the small 1280 px image.
- Lock photos clears sharp images and remembered access; the next unlock asks
  for the password again.

Pages commit `55eeb2b` deployed successfully in run `34377620269`. Active Worker
version: `125d91b6-75cf-4ff1-b5f8-17e27428b14d`.

Both `trip-photos-v1` (356 assets) and
`switzerland-italy-family-2026-uploads-v1` (48 assets) public GitHub Releases were
deleted after private verification. All 404 historical download URLs and both
Release API endpoints return 404. All 198 private asset URLs return 401 to
anonymous HEAD requests; representative anonymous GET and authenticated GET/HEAD
checks also passed. The ignored `build/private-auth/cutover-url-checks.json`
contains the complete timestamped URL receipt. Local backup inventories and
originals remain private. Old caches or copies outside the origin may persist;
this does not provide retroactive secrecy.

Do not restore public hosting as a failure fallback. Keep the atlas locked while
repairing auth. Future passwords should use the local setup form (12-character
minimum); the initial shorter test credential was explicitly chosen by the
owner. Replace that test credential with a strong passphrase before broader use.
