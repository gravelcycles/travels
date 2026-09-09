# Journey Atlas — private photo access handoff

Date: 9 September 2026

Status: approved planning workstream, tracked by `TODO.md` W01. This document
defines the implementation and security boundary; it does not mean the current
public photo hosting is protected.

## Outcome and scope

The atlas shell, routes, journal copy, captions, dates, map locations, and tiny
blurred placeholders remain public. Every sharp photo derivative is removed
from public hosting and served from one private Cloudflare R2 bucket through a
Worker. Unlocking once grants that browser access to every protected image in
every journey; there is no per-trip or per-photo authorization. Several shared
passwords may be active at once so one can be revoked or rotated without
changing the others.

The public photo manifest keeps the existing embedded, metadata-stripped 32 px
blur, or a reviewed stronger/generic placeholder, plus display metadata and
protected object paths. It must not contain passwords, session tokens, secrets,
or a public storage URL. Because blurred pixels and photo metadata are still a
disclosure, review whether each blur, caption, timestamp, and exact map location
is safe to publish. Use a generic locked tile or the existing hidden-photo flow
when it is not. This work protects sharp image bytes, not the otherwise-public
trip narrative or metadata.

The existing `trip-photos-v1` GitHub Release is public. Moving the derivatives
to R2 and deleting the Release will close that public access path, but files
that were already downloaded, cached, mirrored, or archived cannot be made
secret retroactively.

## Deployment topology

Use a first-party deployment. The current
`https://gravelcycles.github.io/travels/` origin cannot reliably use an
HttpOnly cookie issued by an unrelated Cloudflare hostname because browsers may
treat it as a third-party cookie.

Keep GitHub Pages as the static origin, put the public atlas on a
Cloudflare-managed custom hostname, and route `/private-photos/*` on that same
hostname to the Worker. Keep both auth and asset requests under this one prefix
so the session cookie can be scoped to it and is never sent to the GitHub Pages
origin. Do not ship a cross-site-cookie implementation on the `github.io` URL.
Record the chosen hostname and DNS/Worker route setup without committing account
IDs.

The resulting request flow is:

```text
Browser on the public atlas hostname
  ├── ordinary site request ───────────────► GitHub Pages
  ├── /private-photos/auth/* ──────────────► Cloudflare Worker
  └── /private-photos/assets/* ────────────► Cloudflare Worker
                                                │
                                                ├── validate session first
                                                └── private R2 binding
```

## Worker contract

- `POST /private-photos/auth/login` accepts one password, applies a login-only
  rate limit, and returns the same generic failure for every invalid attempt.
- `GET /private-photos/auth/status` reports locked/unlocked without exposing
  cookie or credential details; `POST /private-photos/auth/logout` expires the
  cookie.
- `GET` and `HEAD /private-photos/assets/<journey-id>/<filename>` authenticate
  before any cache or R2 lookup. Anonymous, malformed, expired, tampered, and
  revoked sessions never receive image bytes or an object-existence oracle.
- A successful login sets a host-only
  `__Secure-travel_photo_session` cookie with `Secure`, `HttpOnly`,
  `Path=/private-photos/`, `SameSite=Strict`, no `Domain`, and a finite lifetime
  of initially 30 days.
- The signed, stateless session contains a version, issued/expiry times, the
  accepted credential ID, and a cryptographically random nonce so every browser
  receives a distinct cookie. It contains no password.
- A single encrypted Worker secret contains a versioned array of active
  credential IDs and salted password verifiers; a separate secret signs
  sessions. Use Workers Web Crypto for password verification, HMAC signing, and
  constant-time verification.
- Removing a credential ID immediately invalidates sessions created with that
  password. Rotating the signing secret invalidates every session.
- Never put plaintext passwords, verifiers, session tokens, or signing secrets
  in Git, Wrangler vars, Pages assets, URLs, browser storage, or logs.
- Keep the R2 bucket private: do not enable `r2.dev`, an R2 public custom
  domain, directory listing, or an unauthenticated fallback route.
- Normalize and allowlist object paths before `R2.get`; return only expected
  WebP content and safe headers.
- Login/status/logout and every denial response use `Cache-Control: no-store`.
  A successful image response may use a private browser cache and an internal
  Cloudflare cache only if the Worker validates the session before every cache
  read. A shared cached image must never bypass authentication.
- Document that logout and revocation prevent future authorized requests but
  cannot erase photo bytes already stored in a visitor's browser cache.

## Visitor experience

On page load, check `/private-photos/auth/status` without issuing any sharp
photo requests. While locked, every story lead, strip item, viewer frame,
neighbor preload, and Trip Replay frame stays on its actual low-resolution blur.
Present an accessible password dialog when the visitor enters the site.

Login uses a generic inline error and busy state and never stores the password
or token in JavaScript-accessible storage. After success, hydrate current and
future sharp images across every real journey. Provide logout, relock on
401/expiry/revocation, focus management, keyboard and screen-reader behavior,
reduced motion, responsive layouts, and cross-tab state refresh. Fictional
local demo assets do not need authentication.

## Delivery plan

### A1 — Establish the first-party deployment and security contract

Choose the Cloudflare-managed custom hostname; configure or document its GitHub
Pages origin and narrow `/private-photos/*` Worker route; define the exact auth
JSON, cookie, object-key, cache, status/error, origin-check, and 30-day expiry
contracts. Add a short threat model covering guessed URLs, copied cookies,
password guessing, XSS, shared/browser caches, public blur/metadata, and the
already-public Release.

Acceptance: the normal site, auth endpoints, and protected image endpoints are
same-origin, the path-scoped cookie is not forwarded to the Pages origin, and
the raw R2 bucket has no public access path.

### A2 — Build and test the photo-auth Worker

Add a small Worker project with private R2, required-secret, and
login-rate-limit bindings. Implement login/status/logout, multiple salted
password verifiers, unique signed stateless sessions, credential-level and
global revocation, strict method and path handling, generic failures, security
headers, and authenticated GET/HEAD streaming from R2.

Tests cover every route, at least two valid passwords, unique cookies for repeat
logins, expiry, tampering, removed credential IDs, signing-key rotation, path
traversal/encoding, rate limiting, cache order, missing objects, and R2 failures.
Secrets and password bodies never appear in logs or snapshots.

### A3 — Replace GitHub Release URLs with private R2 object keys

Refactor `scripts/photo-import-config.mjs`, `scripts/build-photo-assets.mjs`, the
journey `photoImport` schema, and tests so successful builds generate
deterministic keys such as `<journey-id>/<photo-id>/w<width>.webp`, protected
same-origin URLs, and the public-safe blur/metadata manifest.

Add an idempotent, checksummed R2 upload/sync-and-verify command. It uploads only
reviewed visible WebP derivatives—never originals, build reports, hidden photos,
EXIF, or secrets—and refuses to delete remote objects unless an explicit
reviewed prune mode is used. Preserve an agent-owned local-preview path.

### A4 — Add the global locked/unlocked photo experience

Add one reusable auth controller to the generated journey template and
`dist/assets/app.js`. Ensure no sharp URL is hydrated or preloaded before the
session is confirmed. Implement the visitor experience and accessibility
requirements above across story leads, strips, the full-screen viewer, and Trip
Replay.

### A5 — Prove the privacy boundary before cutover

In local Worker tests and a non-public preview environment, verify direct
guessed URLs, valid keys, invalid keys, GET, HEAD, cache-hit,
expired/tampered/revoked cookies, private browsing, and two independent
browsers. Inspect network traffic to prove no sharp request occurs before unlock
and no response/cache path returns sharp bytes anonymously.

Also verify responsive loading, lightbox neighbor preload, Replay, slow/error
states, mobile/desktop UX, and that every public blur is acceptably
non-sensitive. Add automated regression tests for the frontend hydration gate
and generated manifest.

### A6 — Migrate, deploy, and retire the public copies

Upload and checksum all reviewed derivatives in private R2, deploy the Worker
and first-party routes, publish the new Pages manifest/frontend, and verify
production from a cache-fresh signed-out browser before changing storage.

After successful cutover, delete the public `trip-photos-v1` GitHub
Release/assets and verify representative old URLs no longer return image bytes.
Keep private originals and a recoverable local derivative backup until the
protected deployment and restore procedure are proven.

### A7 — Make password and photo operations repeatable

Add documented, agent-owned commands for creating a salted verifier,
adding/revoking one password, rotating the session-signing key,
uploading/verifying photos, deploying, rolling back, and checking logs/alerts
without exposing secrets.

Update `README.md`, `PHOTO_WORKFLOW.md`, `PROJECT_STATE.md`, and
`AGENT_HANDOFF.md`. Update CI to test/build the Worker and site without
production secrets, with a separately approved deploy path. Document recovery
for a leaked password/key and a lost or compromised Cloudflare account, plus
periodic checks that `r2.dev` and public bucket access remain disabled.

## Completion criteria

- Either configured password unlocks all real-journey image sizes in a fresh
  browser, and repeat logins receive different cookies.
- Revoking one credential blocks only sessions created with that password;
  signing-key rotation blocks all prior sessions.
- No anonymous request, including a warm-cache request for a known object key,
  returns sharp image bytes.
- Browser network inspection shows no sharp request before authentication.
- Public bundles contain only reviewed blur/metadata and protected paths, with
  no public photo-host URL or secret material.
- Direct R2 public access remains disabled.
- The old GitHub Release asset URLs no longer serve the photos after cutover.
- Local preview, responsive images, the viewer, Replay, and demo journeys keep
  their intended behavior.

## Implementation references

- [R2 bindings from Workers](https://developers.cloudflare.com/r2/api/workers/workers-api-usage/)
- [Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Workers Web Crypto](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/)
- [Workers Rate Limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
