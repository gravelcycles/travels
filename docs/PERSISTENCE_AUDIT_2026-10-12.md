# State persistence audit — 12 October 2026

Requested after the mobile fullscreen/grid continuity fixes. This audits existing
state contracts; it is not a guarantee that every possible browser/device
sequence is defect-free. Current rules remain in OWNER_DECISIONS, PHOTO_WORKFLOW
and PLACES_AND_COMMENTS.

## Confirmed losses repaired

- **All photos:** opening a day and returning recreated every album tile; native
  dialog focus also reset its scroll to the top. Unchanged tiles now stay mounted,
  and restored dialog scroll is applied after opening. About uses that same
  history restoration.
- **Places/photo return:** reopening the remembered detail reset its scroll and
  rebuilt its contents. The current detail now keeps its nodes, image bindings,
  expanded sources and scroll unless content or photo access actually changes.
- **Places Forward:** Back to the list discarded detail tab scroll positions.
  Each Places history entry now retains those positions for Forward. Scroll
  tracking stays in memory rather than writing history on every scroll frame.

## Evidence matrix

| Area | Verification | Result |
| --- | --- | --- |
| Album, About and fullscreen | New album DOM-retention and native-dialog scroll regressions; mobile nested history; shared reference/demo/populated-draft contract | Pass |
| Places | New photo-return, remembered-detail, content-refresh and per-tab Back/Forward regressions; existing scope, search, cluster/list, gallery/review and map-camera tests | Pass |
| Photo/Comments navigation | Existing sidebar/fullscreen collection order, selection, cross-event return, retained source grid, cancellation and camera tests | Pass |
| Comments and reviews | Existing per-photo/place drafts, storage failures, late requests, identity changes, edit/delete/Undo and draft preservation tests; local demo browser draft checks | Pass |
| Notifications | Existing explicit read-ID persistence, cross-tab merge, unavailable-storage fallback, viewport marking and history/target navigation tests | Pass |
| Maps, day/route/planning selection | Existing same-event camera return, cross-event stale-state cleanup, planning filters, route groups and selection inheritance tests | Pass |
| Sharing and login return | Integrated current-main regressions for exact selected/fullscreen URL reload, history, protected login return and share cancellation/failure; integrated mobile album/Places browser smoke | Pass |
| Studio | Existing actual save-handler tests for newer in-flight edits, failed-save/retry, conflict recovery, local draft reload, duplicated-tab recovery isolation, raw photo input, stale acknowledgements, photo navigation and batch/Undo; no authoring source changed in this audit | Pass |

Browser checks use the actual Heading East and Switzerland–Italy event models,
the Alpine demo and an independently populated draft. Synthetic photos and a
clearly labelled local-only place exercise private-media and empty-content
boundaries without exposing protected assets or publishing invented trip data.
320/390px phones verify Places photo return and list/detail history; the 390px
album retains its scrolled day across grid Back/Forward. Desktop demo checks
confirm comment drafts survive photo switching, a nested name dialog and reload;
review drafts survive closing/reopening; expanded place sources survive closing
and reopening the detail. No comments or reviews were posted to a live service.

## Limits and intentional resets

- Browser checks use desktop-browser viewport emulation, not a physical iPhone.
- Saved visitor auto-resume remains excluded. O18 now restores an explicit
  day/photo/view URL on reload; local draft/read persistence is separate.
- Deliberately selecting a different day clears stale photo selection/popups;
  closing/backgrounding media pauses playback. These are existing requirements.
- Studio and service failure/concurrency coverage is automated here; this audit
  did not create production comments, alter real trip edits or test every external
  service outage in a browser.

## Delivery

Integrated remote main through `c0661a7`, including photo/view sharing, login
return, mobile route-trace and Studio data-safety corrections. All **635 tests**
and the production build pass. Integrated browser checks retain album scroll
through grid Back/Forward and Places tab/scroll through photo and list returns.
Deployed as `b4e4b9a` through successful [Pages run 38219260545](https://github.com/gravelcycles/travels/actions/runs/38219260545).
Fresh public Heading East/reference/Florence/demo pages and all three changed
runtime assets match the tested build byte-for-byte. The live demo also retains
its scrolled album through a day grid and browser Back/Forward. No required
implementation or delivery work remains.

Final integration `9ecd943` also includes the subsequent Studio field/frame
preservation corrections from `4654fe0`: **637 tests** and build pass, with no
changes to generated public output. The verified public assets remain identical.
