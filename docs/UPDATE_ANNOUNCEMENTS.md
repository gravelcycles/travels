# Checkpoints and manual trip updates

Owner direction: [O19](OWNER_DECISIONS.md#outbound-trip-updates--16-october-2026).
The 16 October 2026 follow-up authorizes checkpointing and a useful diff message,
with WhatsApp broadcast the likely manual channel. This first version is an
agent-operated command workflow, with no Studio UI, recipient list, provider,
scheduled job, WhatsApp integration or outbound send. The earlier email/SMS/API
comparison remains exploratory; automated delivery is outside this release.
The owner's later 16 October clarification makes updates trip-specific because
different trips usually have different recipients. One shared ledger retains
independent acknowledgment for each trip; combined updates are optional.

## Owner flow

The agent starts the checkpoint from the live site once. After new trips/photos
are published, the owner can ask “prepare a WhatsApp update for Heading East.”
The agent selects that trip, fetches the current public metadata and returns a
copyable message such as:

> Heading East — 24 new photos across 3 locations
> Vienna: 10 · Prague: 8 · Budapest: 6
> [trip link]

This is illustrative, not an actual update count. The generated message groups
each trip's additions by authored destination/city, labels a new trip and first
photos in a location, and includes atlas links. It contains factual counts and
existing titles rather than invented captions or travel prose. The owner sends
it in WhatsApp. Only after the owner says it was shared does the agent mark that
specific prepared update shared. Other trips and later additions remain pending.
Copying, preparing, saving or deploying never acknowledges it. No WhatsApp
account access or new monthly service is required.

## Commands and durable state

Run from the working repository; the agent operates these for the owner:

```sh
npm run updates -- checkpoint
npm run updates -- diff --trip TRIP_ID
npm run updates -- prepare --trip TRIP_ID
npm run updates -- mark-shared PREPARED_UPDATE_ID
npm run updates -- status
npm run updates -- status --trip TRIP_ID
```

`checkpoint` is first setup only, refusing to replace existing history. It
treats the current live archive as already known without claiming it was sent.
The existing baseline remains intact when enabling trip selection; schema 1
history stays readable without migration. Existing drafts retain their original
frozen contents.

`diff` is read-only. For `diff` and `prepare`, choose `--trip TRIP_ID` when more
than one real published trip exists. A single trip may be selected automatically.
Use `--all` deliberately to produce a combined update. `status` lists trip titles,
IDs, known photo counts and last-shared times; `--trip` filters that history.
Draft history and last-shared times refer only to trips mentioned in the prepared
message; unchanged trips in a combined snapshot remain unannounced.

`prepare` filters the inventory to the selected trip before saving its exact
inventory, message and update ID. Repeating it without changes reuses the pending
draft. The `.txt` file is a
copyable export; the JSON draft remains the authoritative frozen content.
`mark-shared` takes that exact ID and is idempotent. It acknowledges the union
of known IDs only for the included trip, never a net count or whatever happens
to be live at that later moment. A draft generated before a subsequent publication
cannot consume it, and acknowledging trip A leaves trip B's additions pending.
An explicit `--all` draft acknowledges all trips in its frozen snapshot.

State defaults to ignored `build/update-announcements/whatsapp/ledger.json`.
Each change uses an exclusive operation lock, an atomic file replacement and
a retained backup under `backups/`. Do not erase `build/` or archive a worktree
holding the only copy. Keep this directory backed up with local authoring data.
Use `--state-dir /absolute/path` to share the same checkpoint across release
checkouts. A new/temporary checkout must not silently start a replacement
baseline. `--site-url` supports another atlas with a separate state directory;
different sites cannot share one ledger. `--json` returns structured output.

Malformed/unsupported history fails closed and remains on disk. An interrupted
operation can leave `.lock`; inspect whether its process is still running,
preserve the ledger/backups and remove only the stale empty lock before retrying.
Never recover by silently discarding history. Different trips can serve different
audiences in this ledger because acknowledgment is keyed by trip. Multiple
independent audiences for the same trip need separate state directories. No
contact data, passwords or private photo bytes are stored in these checkpoints.

## What is new

- Identify photos by `(journey ID, photo ID)`. A newly published photo counts
  even if captured years ago. Caption/pin/frame/order/derivative changes and
  moving an already known photo between albums do not count.
- Count eligible additions, not changes to totals: ten additions and five
  removals means ten new photos. Keep known IDs through Trash/restore and trip
  removal/reappearance. Remove currently unavailable photos from pending diffs.
- Only real, published journeys and production-visible still photos count.
  Exclude demos, drafts, local-only assets and Trash; legacy `hidden` flags do
  not hide photos. Videos are not labeled photos. New empty trips are identified
  separately and do not invent populated locations.
- Apply the effective saved photo day assignment, then use the day's authored
  `destinationId` or `placeId`. Repeated destinations in one trip group together.
  A day without a destination uses its authored day title rather than a guessed
  GPS place or venue. Counts describe album destinations, not exact viewpoints.
- “New location” means first photos relative to acknowledged populated locations
  in that trip. The same city in two trips stays in its respective trip group.

## Public verification and boundaries

`update-public-snapshot.mjs` reads the configured HTTPS site's catalog and a
real trip page. It resolves the generated journeys, photos and overrides bundles
from that page, parses only their JSON assignments (never executes remote JS),
checks the build's content hashes and rechecks the pages/assets for consistency.
Missing, malformed, changed, redirected or failed responses abort capture.
Checkpoints retain capture time, source URLs and SHA-256 hashes as evidence of
the public metadata actually read; local sources and Git commits cannot claim
to be live. No protected photograph is downloaded or newly exposed. These checks
verify metadata consistency, not authenticated image availability or an entire
Pages deployment. Normal publishing/media verification still applies.

`update-inventory.mjs` owns normalization, known-ID union, diffs and text;
`update-announcements.mjs` owns the local ledger and commands. The viewer and
Studio save flows are unchanged. Focused tests cover real/daily/city inputs,
demo/draft exclusion, identity and grouping, invalid captures, publication races,
history preservation, repeated commands, trip selection and frozen acknowledgments
that leave other trips and later additions pending.

Later optional work: a Studio composer, selectable update items or email/API
delivery. Revisit provider pricing and authorization then; do not interpret this
checkpoint feature as approval for those additions.
