# Private photo access — implementation handoff

Updated 9 September 2026. **Cutover is not complete.** The local implementation
and private R2 upload are ready; the live GitHub Pages site and both historical
public photo Releases still expose the old photographs. Do not mark TODO W01
complete until the production acceptance and public-copy retirement below pass.

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
- Worker code is deployed; the atlas frontend is not committed/pushed yet.
  The service fails closed without configured secrets.

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
without relying on cross-site cookie access. On later page loads, click Unlock
photos; the brief login-page visit returns without asking for the password.

The return carries a two-minute, single-use authorization code bound to a PKCE
verifier and the allowed atlas origin. A SQLite Durable Object consumes each
code once and deletes expired grants. Session storage holds only the temporary
verifier/state, never a password or access token. The atlas removes the return
fragment and redeems the code for a one-hour signed bearer token held in memory.

Every image GET/HEAD checks token signature, audience, lifetime and active
credential before touching R2. Requests use Authorization headers, credentials
omitted, and no-store responses. The browser displays fetched WebP blobs through
object URLs. No public image fallback or signed image URLs. Production CORS
allows only https://gravelcycles.github.io; scripts across that origin share
its security boundary. Return navigation is restricted to /travels/.

Lock photos clears memory, aborts requests, revokes object URLs, tells other
atlas tabs to lock, and clears the remembered cookie through the first-party
page. Removing a credential or rotating the signing key invalidates associated
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

## Acceptance and remaining cutover

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

Before changing Pages:

1. Owner enters at least one chosen shared password in the local setup page;
   deploy secrets and explicitly activate the Worker without echoing values.
   Never deploy source-code test passwords to a Worker serving real photographs.
2. Confirm owner production login, remembered access, authenticated GET/HEAD,
   logout and anonymous denial on Workers Free. Use the in-app browser as requested.
3. Run `npm test`, `npm run build`, `npm run auth:runtime-test`, and diff/secret
   checks. Commit/push the reviewed frontend/manifests, wait for Pages, then
   verify fresh anonymous and authorized visits including viewer and Replay.
4. Retire BOTH `trip-photos-v1` and
   `switzerland-italy-family-2026-uploads-v1` public GitHub Releases after private
   verification. Check representative historical asset URLs no longer deliver
   images. Preserve private originals/derivatives. Old caches or copies outside
   the origin may persist; no claim of retroactive secrecy.
5. Record the Pages commit/run, Worker version, counts and negative URL checks
   in PROJECT_STATE/AGENT_HANDOFF, then complete W01.

Do not restore public hosting as a failure fallback. Keep the atlas locked while
repairing auth. Existing public Releases must remain on the cutover checklist
until explicitly verified removed.
