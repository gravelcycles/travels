# Places and photo conversations — UX review

Review date: 20 September 2026. Scope: the shared places, group-review and
photo-comment experience, before live writes. This record distinguishes source
inspection, automated checks and observed browser behavior. An acceptance target
is not evidence that it passed.

## Design intent

The owner asked for a complete, polished experience before backend work. The
existing project brief gives “Apple-like” a concrete meaning: reliable state,
predictable navigation, useful feedback, and graceful incomplete content
([12 September audit](UX_AUDIT_2026-09-12.md)). The atlas should still feel like a
personal travel book: paper-like surfaces, restrained color, serif editorial
headings, large media and a relaxed voice ([delight review](DELIGHT_REVIEW_2026-09-12.md)).
Familiar map-place tiles and tabs can fit that identity without importing a
second app’s visual language.

For this feature set the priorities are:

1. A place reads as a remembered meal or discovery. Group opinions, factual
   descriptions and image credits are visually distinct. Saved places never
   imply a visit or a rating.
2. The photo remains the subject while its conversation is open. Name and
   password entry should lead back to the intended photo without detours.
3. Every contribution feels safe. Navigation preserves drafts; successful
   writes are explicit; failures preserve text; destructive actions are
   recoverable or clearly confirmed.
4. Each layer has a predictable way back. Back dismisses the presented layer;
   Close returns to its launch context; focus and scroll follow that context.
5. The interface explains outcomes in ordinary language. Demo persistence is
   disclosed once near the relevant action, without filling the experience
   with backend or implementation terminology.
6. Controls remain comfortable on a narrow phone, with a keyboard visible, in
   landscape, and with reduced motion. One main reading scroll surface is
   preferable to several competing tiny panes.

The [framework](FRAMEWORK.md), [principles](../PRINCIPLES.md), and
[UX handoff](../UX_HANDOFF.md) require shared behavior for Switzerland–Italy, a
sample and a fresh draft. Place creation remains agent-operated, as requested:
prompt-authored data and reviewed imagery, with no Google Maps API. This pass
does not create a database, change protected-photo authorization, invent real
travel memories, or implement unrelated whole-site proposals.

## Starting findings

These are source findings in the 19 September implementation, not claims of
browser reproduction. The implementation team received them before its edits.

| ID | Existing gap | Consequence | Required improvement |
| --- | --- | --- | --- |
| P01 | `update()` calls `renderPlaces()` during map/day redraws; rebuilding the detail form loses unsent edits. | An unrelated interaction can discard a review. | Retain drafts by journey/place, including close, Back, filters and interrupted edits. |
| P02 | Place Back recreates the list at scroll zero and focuses Close. | The visitor loses their position. | Restore the originating tile and list scroll. |
| P03 | Empty filter results use the same copy as a trip with no authored places. | A populated journey appears empty, with no direct recovery. | Explain the active filter and offer to clear it. |
| P04 | Place styles hard-code Google-like blue/white/Arial while comments use atlas tokens. | The new features look like separate products. | Retain familiar structure with one atlas visual system and clear hierarchy. |
| P05 | Close controls are 38 px and filters 36 px; essential type is often 10–13 px. | Interaction/readability is less comfortable than the rest of the intended experience. | Check actual hit areas and readable type at narrow/short sizes. |
| P06 | Missing/broken pictures have weak recovery; empty hero uses substantial blank height. | Sparse content and image failures feel unfinished. | Intentional compact empty state, clear failure fallback, reachable retry where useful. |
| C01 | Photo changes clear comment text. | Browsing away can discard a memory. | Retain drafts by journey/photo without leaking them between photos. |
| C02 | Visitor ownership ID lasts only for sessionStorage while comments last in localStorage. | A later session cannot manage its own retained comments. | Preserve local author identity separately from preview access. |
| C03 | Change name asks for the password again and cancellation leaves comments closed. | A small edit becomes an authentication detour. | Rename without re-unlock; preserve the previous name and return context on cancel. |
| C04 | Comment deletion and whole-demo reset are immediate. | A mistaken action loses the contribution. | Recoverable deletion and explicit reset scope/confirmation. |
| C05 | Posting refreshes the list without ensuring the new comment is visible. | Success is harder to verify. | Reveal the saved contribution and announce success. |
| I01 | New place/comments/unlock layers are not in existing overlay history. | Back may affect the underlying photo or journey instead of the current layer. | Coordinate layer ownership with the shared history model; check Back and Forward. |
| I02 | Fixed 70dvh comments sheet and composer can compete at short heights. | Keyboard/landscape may leave too little readable or actionable space. | Verify actual keyboard-aware and short-screen layouts, not just CSS sizes. |

## Acceptance matrix

Status vocabulary: **pending** = not yet checked in the revised implementation;
**source** = inspected code only; **automated** = executed assertion; **browser**
= observed interaction at the stated viewport. Evidence must include the
specific check; no blanket “all devices” or screen-reader certification is implied.

| ID | Scenario | Acceptance | Evidence |
| --- | --- | --- | --- |
| A01 | Open Places, select tile/pin, return to list, close. | The selection and map agree; list scroll and launch focus return; normal journey panels remain usable. | Browser: desktop/phone details; cold-start Close restores route; opening Places after Day 4 comments frames Lucerne. Automated: remembered-detail close/reopen and Back-to-list. |
| A02 | Search/category/day filters produce zero results, then clear. | The scope is explained; one action restores results; an actually empty journey has different copy. | Browser: search recovery and 834 × 1112 current-day empty results → Show all places. Automated: category/day/accent-insensitive search. |
| A03 | Visited vs saved place, absent image/reviews/address/day links. | No invented visit/rating, empty tabs are intentional, absent optional facts do not leave broken UI. | Browser: saved Musegg Reviews at 320 × 568, with no fabricated rating. Source: optional-data fallbacks. |
| A04 | Photo gallery open, next/previous, close; failed image. | Count/credit matches image; navigation bounds are clear; failure is readable and recoverable; detail context returns. | Browser: Chapel Bridge gallery image 2 of 2, credits and Back/Forward. Automated: detail restoration. Image-failure/retry path inspected in source only. |
| A05 | Write a rating/review; switch tabs/place/day, close/reopen, refresh. | Draft stays attached to the intended place; valid save updates the own review and aggregate once. | Browser: review draft survives tabs and reload; rating-only posting. Automated: draft persistence/scoping and reset. |
| A06 | Edit/delete own review; Undo; storage failure. | Update does not duplicate; deletion is recoverable; failed save retains draft and does not claim success. | Browser: rating-only save, delete and Undo. Automated: update/removal/restore aggregate and failed-write preservation. |
| A07 | Unlock with name + demo password; wrong password; cancel. | Field errors are useful; name/text survives retry; cancellation restores intended photo/context. Real photo access is not granted by demo credentials. | Browser: combined welcome/name flow. Automated: name/session validation and cancel context; source: wrong-password handling and private-photo gate. |
| A08 | Return with existing preview identity; change name and cancel. | Name/ownership are consistent; rename does not require password again; cancel preserves former name and discussion. | Browser: name change. Automated: persistent identity/migration, rename cancellation and overlay context. |
| A09 | Comment on two photos and switch journeys. | Drafts, counts and saved comments are correctly scoped and never appear under another photo/trip. | Browser: per-photo drafts; Switzerland shows zero comments without Alpine entries. Automated: journey/photo isolation. |
| A10 | Submit, edit, delete and Undo a comment. | Saved item is visible; own actions are clear; no duplicate on update; Undo restores the correct item. | Browser: post, edit, delete and Undo. Automated: attribution, ownership, retries and restoration. |
| A11 | Denied/quota-limited storage and malformed local records. | The page remains usable; unavailable persistence is explained; unsaved text remains; no false saved state. | Automated only: unavailable/corrupt identity and comment storage, failed edit/delete/draft preservation. |
| A12 | Back/Forward through places list/detail/gallery, photo/comments and unlock. | The foremost layer closes/restores first; underlying day/photo remains correct; no extra jump or stuck overlay. | Browser: comments/gallery Back/Forward/Close; nearby-list detail Back returns to its tile. Automated: queued history, reopened details, nearby subsets, independent map state and camera restoration. |
| A13 | Keyboard through tiles/tabs/rating/forms/dialogs. | Visible focus, correct tab semantics, usable arrow/Home/End behavior, Escape closes appropriate layer, focus returns predictably. | Browser: ArrowRight/Home on place tabs at 320 × 568. Source/automated: other key/focus paths; no screen-reader certification. |
| A14 | Desktop 1280 × 720; tablet 834 × 1112. | Readable hierarchy; no control collisions or offscreen actions; map attribution remains reachable. | Browser: Places/comments at 1280 × 800 and 1280 × 720; Places and filter recovery at 834 × 1112. |
| A15 | Phone 390 × 844 and narrow 320 × 568. | Comfortable targets, reachable forms/actions, expandable sheet, no horizontal overflow or accidental map gestures. | Browser: Places/comments at 390 × 844; Musegg Reviews auto-expands at 320 × 568; 90dvh comments sheet keeps list/composer readable. Final 320 px cluster tap opens the visible expanded nearby list; Show all results clears it. |
| A16 | Landscape 844 × 390 and reduced viewport height while typing. | Current text, submit and dismissal remain reachable; scrolling is natural. Physical keyboard behavior requires a device check. | Browser: 844 × 390 conversation leaves photo visible, no horizontal overflow; Post is 44 px high with bottom at 373 px. Device keyboard behavior is source/viewport logic only. |
| A17 | Reduced motion; repeated rapid open/close/select. | Motion is optional; transitions do not strand an old selection, focus or body class. | Source: reduced-motion paths. Automated: queued close/replacement/navigation settles. No physical reduced-motion session claimed. |
| A18 | Switzerland–Italy, Alpine Crossing and newly generated empty draft. | Shared controls/assets behave consistently; real trip receives no fabricated sample content; empty draft is intentional. | Browser: Alpine, Switzerland empty Places/zero comments, and CLI-created `places-polish-check` empty Places/no-photo comments message. Both non-demo checks used `photoSource=local`; private bytes were unavailable in this checkout. |
| A19 | Exit/reset preview. | Scope of reset is clear; changes do not reach live data; normal journey remains useful. | Browser at 320 px: scoped reset confirmation; Keep my edits cancels without mutation. Automated: reset clears rendered review and in-memory draft. Source: exit URL. |
| A20 | Build, full regression suite, deployed fresh page. | Generated output is reproducible, checks pass and published interactions match the reviewed source. | Local release checks: 361/361 tests pass; `npm run build` and `git diff --check` pass. Post-commit deployment/fresh-public verification will be reported with delivery. |

## Verification record

Initial review: source inspection of the shared template, `places-comments.js`,
`places-comments.css`, `app.js`, `mobile-ux.js`, existing focused tests and the
project documents cited above. No revised-browser acceptance was claimed at
this stage. Add dated results here as checks complete, and keep any remaining
limitations explicit.

20 September, automated lifecycle review: `node --test
test/places-history.test.mjs` passes thirteen checks with asynchronous dialog-close
events and history traversals. The first run exposed a parent-photo close
resurrecting the photo while comments were open. Shared overlay-depth tracking
fixed that case. The final check also covers nested rename and an earlier
unrelated history entry, so an accidental extra Back cannot be hidden by the
start of the history stack. Other assertions cover comments Back/Forward on
phone and desktop, rename cancellation, unlock replacement, and stale queued
close events. Place checks cover remembered-detail reopening, Back to the list,
gallery traversal, preserving unrelated map state, and clearing rendered/local
draft state after a reset. The remembered-detail review found another concrete
bug: deriving history depth from selected content could consume an earlier page
on the second Close. Depth now tracks entries actually pushed.

The four focused suites (`places-history`, `places-comments`, `places-panel`,
and `photo-comments-ux`) cover interaction state, identity, persistence, filtering
and map geometry. The final full-suite result belongs in A20; these assertions
are not visual or physical-device evidence.

The coordinating reviewer exercised Places and comments locally at 1280 × 800,
1280 × 720, 834 × 1112, 390 × 844, 320 × 568 and 844 × 390, with the per-surface
coverage recorded above. Checks included search/day-filter recovery, saved-place
empty reviews, rating-only posting, review drafts across tabs/reload, gallery
credits/navigation, comment drafts, rename, edit/delete/Undo, and Back/Forward.
The fresh CLI-generated `places-polish-check` and Switzerland confirmed empty
states and isolation from Alpine sample comments. Their local photo mode did
not provide access to private photo bytes.

The second source review also caught and resolved cancelled edit drafts
reappearing, empty edit drafts restoring the previous text, a mismatched edited
timestamp field, incomplete preview-reset rerendering, stale protected photo
thumbnails during selection, and undersized primary conversation controls.
The narrow-phone map-toolbar camera clearance was corrected. The final 320 px
check then found a map cluster chooser hidden behind the bottom sheet. The
corrected flow uses the existing expanded sheet: tapping the three-place cluster
shows its list, selecting Taube opens details, browser Back returns to the nearby
list and focuses that tile, and Show all results clears the subset. The
coordinating reviewer verified this sequence; a lifecycle test also verifies
the subset's history and restoration of the original list scroll. No unresolved
critical UX finding remains. Final full-suite/build/deployment evidence remains
with the coordinator: local tests are 361/361, build and diff checks pass;
post-commit public verification will be reported with delivery. Source-only failure and device cases above are evidence
limits, not deferred backend work.

The final camera review caught a cold-start edge: opening Places before the
journey map was framed could save the neutral world camera as its return view.
Camera restoration now requires an established, settled journey view; otherwise
Close asks the shared viewer to frame the current journey/day. Two additional
tests verify this distinction and retain the newly selected day when it changes
while Places is open. Browser verification confirmed cold-start Close restores
the route, and opening Places after Day 4 photo comments frames Lucerne after
fixing the competing camera update.

An independent browser handoff was attempted but this reviewer's CUA context
exposed no browser surfaces, including the in-app browser. No direct browser
pass was claimed from that attempt. The coordinating reviewer's browser checks
remain the visual evidence; physical-device keyboard and screen-reader behavior
are not certified by these source, simulated lifecycle, or desktop-browser checks.
