# Cloudflare setup for private atlas photos

Updated 9 September 2026. Account, R2 subscription, and Wrangler authorization
are complete. The private bucket and Worker are deployed. The owner-selected initial test credential is configured and verified.
The protected Pages site is live and both old public photo Releases are removed.
Implementation state: [PHOTO_AUTH_HANDOFF.md](PHOTO_AUTH_HANDOFF.md).

## Password maintenance

**No Workers Paid upgrade is needed.** The chosen-password implementation now
passes production checks on Workers Free. Expensive password derivation runs in
the visitor's browser; Cloudflare performs the final lightweight verification.

To add another credential, enter the shared password(s) in the local in-app browser form. Use a label such
as `family`, enter your chosen password twice, and choose **Add password**.
The password must have at least 12 characters; a memorable passphrase works.
These are separate from your Cloudflare account password. The agent deploys
verifiers when passwords are added or removed and verifies access. Visitors retain access for 30 days.

## Completed account setup (reference)

1. Create a [Cloudflare account](https://dash.cloudflare.com/sign-up), verify
   the email, and enable two-factor authentication. Save recovery codes privately.
   This account is for the owner; visitors just enter a shared atlas password.
2. Open **Storage & databases → R2 → Overview** and complete the R2 subscription
   checkout, supplying payment details if requested. The agent will create a
   Standard-storage bucket. R2 includes free usage but can incur usage charges.
   See [R2 onboarding](https://developers.cloudflare.com/r2/get-started/).
3. Use the included workers.dev address for the photo/auth service. No domain purchase or DNS
   changes are needed. Under **Workers & Pages**, the account subdomain determines
   the eventual address, for example `https://travels.<subdomain>.workers.dev/`
   (example only; availability unchecked). The site stays on GitHub Pages.
   See [workers.dev setup](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/).
4. At deployment time, complete the browser authorization opened by the agent
   for Wrangler. The agent runs tools and deployments; do not paste account
   passwords or tokens into chat. Wrangler supports browser OAuth and OS-keychain
   storage. See [Wrangler login](https://developers.cloudflare.com/workers/wrangler/commands/general/#login).

There is no need to buy Cloudflare Images, register visitor accounts, or set up
an email-login service. The Worker supports multiple shared passwords. Private local password entry
and add/revoke operations are implemented.

## Completed implementation

- Private R2 bucket, photo/auth Worker, rate limiting, CORS, and secrets.
- Multiple-password login, authenticated image loading, two sizes, and local originals.
- Browser and runtime verification of login, revocation, direct URLs, and caches.
- Updating the Pages photo manifest/frontend and retiring both public photo
  Releases after verification. Pages and the source repository stay in place.
- Repeatable publishing, password management, and recovery documentation.

## Expected cost

R2 Standard includes 10 GB-month storage, 1 million Class A operations and
10 million Class B operations monthly, with free egress. The current
99-photo set is about 136 MB, within the storage allowance. Actual charges
include all account usage. See [R2 pricing](https://developers.cloudflare.com/r2/pricing/).

Workers Free includes 100,000 requests/day but only 10 ms CPU per invocation.
Every protected photo request runs authentication. The revised production login passes on Free, including eight active passwords.
Keep Workers Free. The browser performs the 600,000-iteration derivation and
Cloudflare enforces the password check before serving private photos.
See [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/).

## What can start before account setup

Local Worker development/security tests, the two-size image pipeline, and
frontend preparation need no Cloudflare account or payment information. Account
activation and browser authorization are needed only for remote upload and
deployment. This account setup and the private-photo cutover are complete.

## Photo loading and free caching (9 September review)

The user approved publication. The preflight-cache Worker is deployed as
`946e0e05-267c-420e-95c7-40629afcfbf4`; the matching frontend publishes through
the GitHub Pages workflow.

- The browser retains up to 96 unused image variants / 64 MiB of compressed
  blobs, plus images still displayed or actively loading. Leaving the page or
  locking access clears this memory. No photo disk cache is introduced.
- Phone viewers request the size needed for viewport width and pixel density;
  neighbor preloads request the same size. Large retina displays still select
  the full-size derivative. A thumbnail and a large viewer photo are different
  assets, so the first full-size load is expected.
- Access status requests now coalesce focus, visibility and polling triggers,
  allowing at most one in-flight request and one new check per minute per tab
  after validated access. Fresh-page restoration still validates its saved token.
- OPTIONS responses advertise `Access-Control-Max-Age: 86400`. Browsers can reuse
  the CORS preflight permission subject to their own caps; every actual photo
  GET/HEAD still validates access. Auth and image responses retain `no-store`.

Cloudflare's Free plan includes ten Cache Rules, but these require a domain
proxied through Cloudflare. The current site is on GitHub Pages and the photo
Worker uses workers.dev. Cloudflare's R2 Cache API example says that edge caching
requires a custom domain or Worker route; workers.dev deployments have no effect.
An existing domain on Cloudflare could support this without a paid plan, with
Worker authentication before every cache lookup and private/no-store responses
to visitors. Do not put a shared cache in front of authentication or expose R2
publicly. No domain or paid plan was added in this review.

Sources checked 9 September 2026:
- https://developers.cloudflare.com/r2/examples/cache-api/
- https://developers.cloudflare.com/cache/how-to/cache-rules/
