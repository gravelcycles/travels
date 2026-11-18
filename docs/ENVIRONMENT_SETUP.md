# Start in a headless environment

Owner request, 18 November 2026: prepare everything needed for a new headless
or cloud container, apart from the Cloudflare authentication token. This guide
uses the existing backend. The agent operates setup and verification. Read
[AGENTS.md](../AGENTS.md) and the current owner decisions before project work.

## Runtime and source

Use Node.js 22 or newer and npm; the Pages workflow uses Node 22. Install with
`npm ci` from the checked-in lockfile. Git, Python 3 and CA certificates support
the existing tests, local preview and repository operations. Video intake also
needs FFmpeg/ffprobe; ExifTool supports media inspection. GitHub CLI is useful
for publishing and checking Pages. Network access must reach GitHub, the npm
registry, Cloudflare's API and the existing media service.

Clone `https://github.com/gravelcycles/travels.git`. A prepared starter may
instead include a clean shallow Git checkout of a recorded commit; its origin
must point to GitHub, not the source Mac. Do not transfer `node_modules`, the
Mac's Wrangler config/keychain, SSH keys or authentication tokens. Install
platform-appropriate dependencies in the target environment.

Run `npm test` and `npm run build`, then check that checked-in public output
has no unexpected diff. The static build needs neither private originals nor
Cloudflare authentication. Follow [deployment](DEPLOYMENT.md) for publishing.

## Existing Cloudflare backend

Set the non-secret account selector `CLOUDFLARE_ACCOUNT_ID` from the prepared
environment file. Resource names and the D1 ID already live in
[`workers/photo-auth/wrangler.jsonc`](../workers/photo-auth/wrangler.jsonc);
the media origin lives in [`content/photo-service.json`](../content/photo-service.json).
Keep these existing bindings and the private bucket's access policy.

Supply `CLOUDFLARE_API_TOKEN` separately through the target environment's secret
store. A copied OAuth access token is temporary and does not bring the saved
login's refresh credentials. For unattended use, provision an API token with
the permissions required by the intended Workers/R2/D1 operations. Read-only
preflight should confirm access to the existing Worker settings, bucket and
database without changing them. See [Cloudflare's CI setup](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/).

A D1 preflight rejection is an authentication/permission issue to resolve before
database operations, not a reason to replace the existing database. Its metadata
endpoint accepts D1 Read or D1 Write; migration work needs write permission.
See [D1 API permissions](https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/get/).

The media publishers currently require `wrangler whoami --json` to report
exactly one account. An account selector does not override that validation;
check the authentication identity before a publishing task.

Existing deployed Worker secrets remain in Cloudflare when updating that
Worker. Their values are not needed for code, builds, ordinary asset publishing
or a normal Worker deployment. Photo-password maintenance and comment moderation
are separate privileged tasks: use the private stores described by
[Cloudflare setup](../CLOUDFLARE_SETUP.md) and
[community operations](COMMUNITY_OPERATIONS.md). Keep those values out of the
starter archive, Markdown, command history and Git. GitHub publishing also needs
separate GitHub write authentication; access on the source Mac does not transfer.

## Private working files

A fresh clone omits originals, optimized private media, local routing inputs,
Studio drafts/revisions/backups and the outbound-update ledger. A private
working-files archive can preserve the existing `photos/`,
`build/private-photo-assets/`, `build/private-video-assets/`,
`build/route-inputs/`, `build/draft-assets/`, `content/drafts/`,
`build/studio-draft-overrides.json`, `build/studio-drafts/`,
`build/studio-revisions/`, `build/studio-backups/` and
`build/update-announcements/` paths. Keep this archive outside Git and public
hosting. Record a file inventory, checksums, source commit and verification
state. Restore into a fresh checkout; do not overwrite another environment's
newer local work. Review dirty recovery records against current sources in
Studio rather than automatically saving or publishing them.

Historical QA workspaces, dependency caches and credentials are not startup
requirements. Missing raw route extracts must stay explicit: checked-in reviewed
geometry still builds, but an absent network cannot support a new route proposal.
See [route workflow](../ROUTE_GEOMETRY_WORKFLOW.md).

The current HEIC/DNG importer uses macOS ImageIO/Quick Look. A Linux container
can build, publish existing prepared derivatives, crop existing managed
derivatives and import supported ordinary images/videos. Fresh HEIC/DNG decoding
still needs the Mac or an explicitly reviewed portability change. Preserve
reviewed photo sources when transferring work.

## Preview and delivery

Studio listens on `127.0.0.1:4173`. Use an authenticated tunnel or a platform
port-forward that reaches container loopback. Merely publishing a Docker port
does not change that bind address. For a static container preview, the agent
may serve the repo with Python and expose only that preview's intended port.

The prepared bundle is a local handoff, not evidence that a target container
was started. Report source/build checks separately from container-image,
authentication and target-environment checks. Keep a dated preparation receipt
in [WIP](../WIP.md); keep the archives and account-specific inventory ignored.
