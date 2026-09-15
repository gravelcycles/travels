# Making Journey Atlas more delightful

Review date: 12 September 2026. Assessment and recommendations; no site behavior changed.

The strongest opportunity is to make the atlas feel more personal to explore and more rewarding to create. Its distinctive asset is the connection between a memory, a place, and the people who were there. Preserve the serif typography, paper-like surfaces, restrained map styling, large media, precise routes, and relaxed personal voice. Build the next improvements around that existing identity.

For a visitor, the desired feeling is **“I know where to start, this feels personal, and I can return to the moment I care about.”** For a creator, it is **“One small contribution makes this feel like my trip, I can see the result immediately, and I know it is safe.”**

## What was reviewed

- Live catalog, family trip introduction, desktop map and day journal, album entry, full photo viewer, and Replay opening.
- Current public “Nine to Como” sample at a 390 px phone viewport: introduction, day picker, group routes and their URL state, day/media navigation, video presentation, Replay through completion, and return to exploration.
- Local Studio: Photos, day filtering, Route drawing, Trip plan & cover, Curated Replay moments, Day copy, and new-trip intake. Save/preview visibility was also checked at 800 px.
- Shared templates, current published browser assets/data, all sample data, new-draft defaults, authoring/publishing workflow, and framework contracts. Blank draft behavior was inspected in source; no new trip was created. Imports, destructive actions, and publication were not exercised.

The local checkout is based on `fb50e87` with substantial existing working changes. The public deployment is newer: it includes group travel and video, and Replay is now a route-and-story experience. Remote Studio was also inspected at `e937dade3a4de0284d69d1759a558b66d7c4253f`. It already has “Check changes,” better dirty-state handling, a “Trip plan & media” tab, group/meetup editing, and video preview. Recommendations account for these improvements. Local custom photo-frame controls were reviewed as working changes, not assumed to be shipped.

The initial browser session displayed family photographs. A later fresh mobile family-trip visit was blocked by automatic approval review because its protected photo service may expose non-public content. That additional check was left pending specific permission. Phone interaction findings therefore use the public sample and current source; cold-login behavior is a source finding, not a completed signed-out usability test.

## What already creates delight

- **The welcome has a voice.** “We wander but aren't lost...yet” and the family cover feel owned and personal.
- **Place makes a photograph richer.** The large photo viewer and accompanying location are more distinctive than a conventional album. Careful map framing supports this well.
- **Small navigation details preserve the experience.** Day context, next-day album handoff, keyboard support, reduced motion, route patterns, and a clear Replay ending already exist.
- **The newest sample has a human premise.** “Three routes. Nine friends. One dinner by the lake,” followed by “Nine people, one table,” gives people a reason to care about the geography. Group selection already scopes the experience and persists in the URL.
- **Studio respects the creator's work.** Minimal new-trip intake, date-based photo assignment, recoverable trash, backups, and explicit acceptance of route proposals are good foundations.

## Opportunities across the experience

| Surface | Observed experience | Proposed improvement and emotional payoff | Priority |
| --- | --- | --- | --- |
| Catalog | The one real trip occupies a compact row; most of the page is empty. The tone is inviting, but the browseable content is chiefly title, dates, distance, and summary. | Keep the compact catalog direction. Give each trip a strong, short editorial invitation; when useful, feature one owner-chosen memory below the current trip. “More pages to come” can remain quiet. Avoid collection filters until the collection warrants them. The payoff is curiosity. | Later |
| Trip introduction | Visitors choose between Relive the trip and Explore the map. There is no direct album entry or indication of Replay's duration. | Add a quiet **Browse photos & videos** entry and label Replay's actual promise and approximate runtime. Let a visitor pick how they want to spend their time. Derive runtime from the same pacing as the player. | First |
| First-time access | Current source can restore photo access through another origin before offering unlock; protected covers use blurred previews. | Make the locked welcome intentional: keep the title and story readable, use a designed text/route scene, and explain the optional photo unlock in place. Verify this with a fresh guest session before choosing an implementation. The payoff is a welcoming arrival even without access. | First validation |
| Day exploration | The family trip has 14 days and 99 visible photos, but no day story text and no authored Replay captions. Blank writing is supported intentionally. | Offer **three moments worth keeping**, selected by the owner, with optional short memories. Surface those existing contributions where appropriate in the opening and day journey. Prompts such as “What do you still talk about from this day?” should be skippable. The payoff is personality without an obligation to write a diary. | First |
| Photos and videos | Large media and place context work well. Current phone CSS hides photo captions; longer descriptions sit inside the location panel. Video titles have a footer treatment. | Give both media types a consistent, unobtrusive **About this moment** treatment. Keep the creator's words accessible independently of the location drawer. Preserve immersion and allow blank captions. The payoff is understanding why this moment mattered. | First |
| Return and sharing | Incoming day/media links work. Ordinary day/media browsing has no explicit copy/share action; group selection already persists its URL state. | Add **Copy link to this moment** and **Share this day**, preserving group, day, and media context through unlock. Offer a small journey-scoped **Continue where you left off** action. The payoff is being able to say “Remember this?” without explaining how to find it. | First |
| Replay | The current public player animates routes and presents story text. Family Replay is about 112 seconds at default 2×, excluding loading waits. The new group sample is about 12 seconds at 2×. | Clarify runtime and purpose before starting. Add readable chapter previews, and pace group transitions so people understand who went where. Use an authored arrival beat at the meetup and a more personal final line when supplied. Retain the route-and-story direction of the current player. The payoff is anticipation and a satisfying arrival. | Next |
| Group trips | Different routes and a shared meetup already exist. The selector exposes named travelers clearly. | Make the shared arrival an editorial focal point and allow easy comparison of the branches. A creator should preview each group's perspective and the reunion. Use existing group/meetup data, with no new social graph. The payoff is the feeling of people coming together. | Next |
| Samples | “Nine to Como” has a coherent story premise, but its video is an unrelated bee/flower playback fixture. Other samples are intentionally sparse. | Give the flagship sample a small coherent set of illustrative media, including a relevant short clip. Keep sample labeling clear and put technical fixture explanation outside the story flow. The payoff is demonstrating the experience someone would want to make. | Next |
| Quiet days and drafts | Quiet calendar days are retained. New drafts can still invite visitors to “Relive the trip” before there is a memory to relive. A no-photo album action labeled “Read the story” opens the viewer. | Use existing planned status for **Preview the journey / Explore the plan**. Send “Read the story” to the journal. Distinguish an intentionally quiet day from a day awaiting input, while preserving shared capabilities. The payoff is an inviting beginning and respectful treatment of slower days. | Next |

The family text counts are an opportunity, not a content-quality score. Existing playful captions already show the desired voice. Do not invent recollections or automatically turn image descriptions into the owner's memories.

## Creator experience: make the result visible while creating

The largest creator improvement is a **day workspace with the actual resulting day beside it**. Today writing, photos, map precision, cover, and Replay live in separate modes. A creator should be able to choose a day, see its media and story together, change one thing, and immediately see the shared viewer's rendering at desktop or phone size.

| Creator task | Proposed experience | Why it matters |
| --- | --- | --- |
| Start a trip | Keep name-and-dates intake. After creation, offer three starting actions: add favorite photos, remember one day, or outline the route. Show the first attractive fragment as soon as data permits. | A complete blank calendar is useful infrastructure; one recognizable memory is the first reward. |
| Review photos | Give the contact sheet the main workspace. Group by day, show thumbnails for unmatched uploads, support bulk reassignment and ordering with keyboard alternatives, and reveal map precision when needed. | Selecting memories is visual work. The map should take priority when locating a photo, not during every photo task. |
| Choose cover and day pictures | Keep album order, day lead, and trip cover independent. Show a small example of where each choice appears; retain the current desktop/phone cover previews. | Independence is valuable once its result is visible. It should not require remembering internal terminology. |
| Write a memory | Show the chosen photo, day title, and optional sentence in the real journal layout as the creator edits. Offer one skippable memory prompt. | This turns a blank text field into a visible act of authorship. |
| Shape Replay | Present route/story chapters visually, with a preview of the selected beat, calculated total runtime, and a clear way to start from automatic Replay. Current public Replay is route/story only; do not base a new editor on the older local photo-moment UI. | Creators should judge rhythm and meaning by watching, rather than estimating from a long form of duration fields. |
| Compose a split journey | Add a visual day-by-group board showing who travels where, where each group stays, and when they meet. Preview each group's view using the existing shared viewer. | Current group and meetup forms provide the facts; the board would make their relationships visible and satisfying to arrange. |
| Include a short clip | Bring video into the media review workspace and let the agent prepare its hosted assets. Preserve the current video preview and duration capture. | Remote Studio now supports video, but URL/format/poster fields make the creator think about media delivery before the remembered moment. |
| Add places and routes | Let the creator describe the place or leg, then review the agent's proposed interpretation on the map. Retain exact coordinates, provenance, anchors, and explicit route acceptance as advanced tools. | The user contributes memory and judgment; the established agent workflow handles geographic preparation. |
| Save and preview | Use plain, persistent states: edits waiting to save, saved locally, changes awaiting publication, live. Clearly distinguish checking a date change from viewing the atlas. Make save-and-preview predictable. | Confidence encourages experimentation. “Saved” should answer where the work exists. |
| Finish | Give the creator a compact review of the cover, changed days, media awaiting publication, and unresolved facts. The agent publishes and returns the verified live page. | Completion should feel like a finished travel book, with the operational work handled for the creator. |

Implement preview through the shared journey renderer/template. The existing `studio/story-review.html` is a static design comparison, not a reusable preview implementation. Avoid creating another journey-page implementation for this work.

## Concrete defects to resolve before adding polish

Local reproductions were checked against current remote Studio source. No trip content was edited or saved:

1. **The selected photo can disagree with the selected day.** Switching “Photos from” from Day 1 to Day 2 changed the thumbnail grid, but the editor still showed Day 1's `IMG_1425.HEIC` and its Day 1 controls. The same handler remains in [current remote Studio](https://github.com/gravelcycles/travels/blob/e937dade3a4de0284d69d1759a558b66d7c4253f/studio/studio.js#L1292). Select a valid item in the new filter or explicitly clear the editor.
2. **Studio offers a Replay photograph choice that playback ignores.** Current remote Studio still presents a [Photograph selector](https://github.com/gravelcycles/travels/blob/e937dade3a4de0284d69d1759a558b66d7c4253f/studio/studio.js#L1144), while the current player [removes photoId from chapters](https://github.com/gravelcycles/travels/blob/e937dade3a4de0284d69d1759a558b66d7c4253f/dist/assets/replay-utils.js#L75). Align the editor with route/story playback so it promises only what the viewer renders. Caption-only photo choices also have blank labels, reproduced locally and present remotely; any retained media selectors need a useful fallback.
3. **Tablet layout hides save status and Preview atlas.** Both disappeared at 800 px locally. The same [601–980 px rule](https://github.com/gravelcycles/travels/blob/e937dade3a4de0284d69d1759a558b66d7c4253f/studio/studio.css#L135) remains remotely, while the ≤600 px rule restores them. Save locally itself remains available. Preserve preview access and status through the full width range.

The phone-caption and no-photo “Read the story” issues are supported by current public source. They should receive focused interaction checks when implemented. Source inspection alone is not a full accessibility or performance certification.

## Recommended delivery order

**First: personal moments and creator confidence.** Resolve applicable selection/status defects; expose existing captions on phones; add direct media entry and exact-moment links; establish a shared in-context day preview. Invite the owner to try it with just three chosen memories. Test guest arrival before committing to its treatment.

**Next: make authoring visual.** Expand photo review into a useful contact sheet, provide a route/story Replay storyboard, improve the new-trip first step, and make publication status legible.

**Then: strengthen the signature experience.** Refine group convergence and Replay pacing, give the sample coherent media, and improve catalog discovery as more real trips arrive.

Every behavior change should carry to the reference trip, samples, and a fresh draft through shared code and validated data. Preserve deliberate blank content, private-photo access, the compact catalog direction, current route-focused Replay, and concurrent work. Feature implementation requires the normal regression checks, inventory/workflow updates, build, and verified deployment. This review leaves the current feature contract intact.

## How to tell whether it worked

Use a few short observed sessions before adding analytics:

- A first-time visitor can choose photos, map exploration, or Replay and explain what will happen before opening it.
- A visitor can find a chosen memory, read its personal context on a phone, and return to the same day without losing their place.
- A copied moment link lands another allowed viewer on the same media/day/group, including after normal unlock.
- A creator can start a draft, add one meaningful contribution, and see its real presentation without guessing what was saved.
- A creator can correctly explain “saved locally” versus “live,” and can recover from a mistaken selection without losing work.
- A viewer of the group sample can say who traveled separately and when everyone met after watching Replay once.

These are acceptance goals for future work, not claims of measured improvement. Time to the first meaningful preview, wrong-item edits, navigation backtracking, and accurate saved/live understanding are more useful early signals than engagement scores.

## References

- [Public atlas](https://gravelcycles.github.io/travels/) and [current sample](https://gravelcycles.github.io/travels/demo.html).
- Published assets inspected: [application](https://gravelcycles.github.io/travels/assets/app.js?v=9e1a241284b7), [mobile styles](https://gravelcycles.github.io/travels/assets/mobile.css?v=388afd1ddf0f), [Replay](https://gravelcycles.github.io/travels/assets/replay-utils.js?v=3affec64ef97), and [group travel](https://gravelcycles.github.io/travels/assets/group-travel.js?v=55518f719e29). These are asset-version URLs observed during the review, not immutable Git commit links.
- Local contracts: [framework](FRAMEWORK.md), [feature inventory](FEATURES.md), and [journey workflow](../JOURNEY_WORKFLOW.md).
