# Journey Atlas — UX and Trip Replay handoff

Date: 8 September 2026

Audience: family and friends. Aim for an inviting, personal travel story with a detailed atlas available throughout.

Status: retained as a repository source brief and tracked by `TODO.md` W02.
Some lead-photo, no-photo, and Trip Replay work landed after portions of this
brief were drafted. W02 begins by reconciling every requirement against the
current implementation; this document is not a claim that all listed work is
still outstanding.

## Delivery reconciliation · 9 September 2026

W02 is implemented. T13's independent daily leads and T16's intentional empty
days were retained. The former automatic T17 player now also supports editable
curated moments: this trip has 14 chapters totaling about 218 seconds (after the pacing follow-up), covering all
29 legs and ten selected photographs, including arrival and departure.

The catalog and compact trip introduction share a Studio-selected existing
family photograph (`family-img-2880`, the group on Lake Brienz). Its focal point
keeps the leftmost traveler in frame. Cover resolution follows visibility edits.
Deep links to a day/photo open the requested context directly.

`studio/story-review.html` retains the two real-content visual alternatives,
covering Day 6 and photo-free Day 9 at desktop and 390 px column widths. The
compact treatment was selected after comparison: it reaches the narrative and
photo action sooner, particularly on the nine-leg day. The spacious alternative
adds substantial vertical travel without improving the agreed hierarchy.

The journal has one scroll surface and expandable travel details. Mobile day,
route, map, journal, and album navigation stay synchronized. All photos opens a
day-grouped overview using the 95 visible photographs; day albums continue
naturally to the next day, and empty albums show the existing story. Timestamp
and travel-summary duplication, mapped-point counts, attribution duplication,
and clipped day/date labels are removed.

Replay includes moment seeking/stepping, mode symbols, pause/resume exploration,
manual reduced-motion defaults, tab-hidden pause, bounded upcoming preloads,
photo loading/error/retry states, and map-failure fallback/retry. Studio exposes
moment day/photo/leg selection, order, caption, and duration editing. Existing
geometry and photo metadata remain the shared source of truth.

## Scope and decisions

This spec interprets the user's numbered approvals as referring to the original UX review: (1) opening experience, (2) day stories, (3) Trip Replay, (4) mobile navigation, plus every concrete fix. The later quiz/souvenir ideas are not included.

“Homepage” means the existing journey catalog at `/travels/` (`dist/index.html`); the user's reference to `routes/` does not require a URL change. The trip stays at `/travels/switzerland-italy.html`.

This handoff specifies work; it does not implement or deploy it. The day-story hierarchy is agreed, but its visual treatment remains exploratory. Sharing/postcards, voice recordings, quizzes, souvenirs, and other new features are outside this pass.

Read `PRINCIPLES.md`, `PROJECT_STATE.md`, and `AGENT_HANDOFF.md` before implementation. Preserve existing work, including uncommitted route edits. Keep shared viewer changes compatible with `demo.html`.

## 1. A welcoming opening and customizable cover

### Visitor experience

- Replace the real journey's current homepage card image with a photograph already published in that journey. Select a strong existing image and show it in the visual review; no new photo upload is necessary.
- Add a photo-led introduction on the trip page: one prominent title, travel dates, a short introduction explaining who traveled, and two clear actions: **Relive the trip** and **Explore the map**.
- Relive the trip opens Replay when available. While building the opening before Replay, use a truthful **Start the story** action that opens Day 1.
- Keep the introduction compact enough that a phone visitor sees a photograph and a clear next step immediately. Avoid repeating the large trip title in the header and content.
- Keep direct navigation to days/photos from bypassing into an unrelated introduction. Access to the atlas should remain immediate.

### Customization

- Add a cover-photo picker to the existing local Atlas Studio. Offer visible photos from the selected journey, with thumbnail previews.
- Store a stable photo ID and adjustable crop/focal point in readable source data. Provide desktop and phone previews so people and important subjects are not cropped out.
- Use this cover for the catalog card and trip introduction by default. Choose one image once rather than requiring separate edits for both surfaces.
- Save through the normal source/build workflow. Do not require editing generated JavaScript or manually pasting a photo URL.
- Resolve the cover after photo manifests and overrides have been applied. The catalog currently only loads `journeys.js` and uses `journey.cover`; extend its data loading accordingly.
- A hidden, removed, or invalid cover must fall back to another visible journey photo, then an intentional text treatment if there are none. Never expose a hidden image through the cover.
- Reuse responsive image derivatives and placeholders. Load the prominent cover promptly without loading the entire album.

**Acceptance:** changing the cover in Studio survives rebuilding and appears on both public surfaces after publishing. It looks intentional at phone and desktop widths, and the catalog link still opens the same trip URL.

## 2. Put the day story first

### Agreed hierarchy

1. Deliberately selected lead photo.
2. Day/date, memorable title, and place.
3. Short story describing what happened.
4. Easy access to that day's photographs.
5. A compact travel summary and expandable **Travel details** containing the ordered route legs.

- The story must appear before the detailed itinerary. Day 6 should not require scrolling through nine legs to find its narrative.
- Preserve every route leg, route interaction, transport cue, and meaningful stop detail inside the expandable section.
- Add a per-day lead-photo choice in Studio. Default to the first visible photo when no choice exists. Changing a cover must not silently change the chronological album order; opening it should open that actual photo at its album position.
- Reuse existing day-copy editing for distinctive titles and concise stories. Suggest copy grounded in existing facts; do not invent recollections. Keep date/place visible even when the title becomes more personal.
- Remove repeated trip-wide explanatory copy from every day's body when the opening already supplies it.

### Visual exploration required

The user has approved this hierarchy, not a specific new layout. Produce two lightweight visual alternatives using real content before finalizing the treatment: a compact story card and a more spacious journal layout. Compare Day 6 and a no-photo day on phone and desktop. Keep the existing paper, typography, and atlas character.

**Acceptance:** readers can find the narrative immediately; all route details remain reachable; the selected lead photo is consistent wherever the day is represented. No full redesign is required to establish this hierarchy.

## 3. Trip Replay — signature feature spec

### Experience

**Relive the trip** launches an approximately two-minute, editorially paced tour. A route draws across the map, a small transport symbol changes with the leg's mode, and selected moments interrupt the journey with a photograph and one short sentence. Aim for 12–18 curated moments, not an automatic slideshow of all 104 photographs.

Represent the trip from arrival to departure. A day without a selected photograph can appear as a brief route or text chapter. Stationary days do not need artificial travel animation.

### Controls and navigation

- Start only after the visitor activates the replay action. No automatic audio or motion on page arrival.
- Provide play/pause, previous/next moment, a seekable timeline, current day/moment, speed selection, and exit.
- Selecting a chapter or seeking must update the displayed photo, text, day, and route together, including backward seeks.
- **Explore this day** pauses Replay and opens the corresponding journal/day context. Offer a clear return to the paused Replay during the same visit.
- At the end, show a simple completion state with **Replay** and **Explore the journey**.
- On phones, keep the current photo or map scene large and controls accessible without nested scrolling. Do not shrink the existing three-column atlas into the player.

### Content and source data

- Store the ordered replay moments as editable source data associated with the journey. A moment needs a stable ID, day ID, optional ordered segment IDs, optional photo ID, short caption, and display duration. Support an optional reviewed camera target.
- Expose basic moment selection, ordering, caption, and duration editing in Studio; use the existing save/build convention. The first release can use a simple ordered list editor.
- Reuse existing photos, reviewed route geometry, mode styling, and overrides. Do not create an independent copy of the trip data.
- Validate referenced days, segments, photos, positive durations, and camera coordinates. Hidden/removed photos must be omitted safely; report invalid editorial references during the build.

### Animation and geographic honesty

- Follow each segment's existing polyline and its travel order, including outbound and return legs. Do not draw straight shortcuts between distant endpoints.
- Use restrained, recognizable transport symbols with text labels and existing non-color mode cues. Smooth camera transitions should prioritize orientation over constant zooming.
- Only place a photo pin or zoom to an exact photo location when that location has been reviewed. Otherwise keep day-level map context. Never infer precise photo locations from the destination alone.
- Replay timing is cinematic pacing, not a claim about historical travel speed or capture time. Do not invent a real-time trip clock.
- Review the geometry and chosen photo metadata used by Replay before release. Full annotation of all 104 photos is not a prerequisite for a curated selection.

### Reliability and accessibility

- Pause while the browser tab is hidden; require an explicit play action to resume on return.
- Use bounded preloading for upcoming photos. If a photo is slow or fails, show an intentional loading/retry state and keep its caption readable rather than consuming its entire viewing time unseen.
- A map failure must leave a usable sequence of photos/text with a retry option.
- Reduced-motion mode presents the same chapters as still scenes with manual navigation by default, without camera flights or animated route drawing.
- All controls must work by keyboard, have clear names/focus states, and announce chapter changes without announcing every animation frame.
- On exit, cancel playback and pending animation work. Reopening must not create duplicate timers, maps, or event handlers.

**Acceptance:** verify arrival, a mixed-mode Day 6 sequence, a stationary/no-photo day, and departure. Pause/seek/exit must remain synchronized and predictable on phone and desktop, with reduced motion, slow photos, and an unavailable map.

## 4. Make mobile navigation immediate

- Tapping a day in **Days** opens that day's **Journal** immediately, positioned at its heading. Preserve the day-list scroll position when returning.
- Add a clear **See this day on the map** action that switches to Map and fits the selected day's route.
- Keep the active day synchronized between Days, Journal, Map, and the photo viewer. Expose the selected mobile view accessibly, not just through its color.
- Give the phone journal one natural vertical scroll surface. The photo lead, story, gallery access, and travel details should not compete for a tiny independently scrolling middle area.
- Provide clear previous/next day controls in Journal, with correct beginning/end states.
- A draggable map/story sheet is a possible later exploration, not required for this pass.

**Acceptance:** a new phone visitor can tap Day 6, read its story, see its route, and continue to Day 7 without hunting for the updated content in another tab.

## 5. Concrete fixes and polish

### A. Route taps must produce visible feedback

On mobile, activating a journal route-leg button switches to Map, highlights/fits that leg, and shows the route inspector. Provide a way back to the same journal context. Hover/focus alone must not unexpectedly switch views. Desktop can retain its simultaneous map-and-journal interaction.

### B. Make photo entry points honest

Replace **Photo days 104** with **All photos · 104**, opening an album overview grouped by day. Give each day its own **View N photos** action. Calculate counts from visible photographs after overrides. The trip-wide action must not silently open only the currently selected day.

### C. Continue naturally at album boundaries

Keep photo browsing scoped to a calendar day, but show **Continue to Day N** after its last photo. Include the next day's title. Handle the final day with **Back to journey** rather than a dead-end arrow. Keep previous/next day controls available and synchronize map/story context when crossing days.

### D. Turn no-photo days into story moments

Replace the repeated “No photographs” messages and editor-facing “ready for photos whenever you add them” copy with the day's existing narrative, date, and place. Add **Next day with photos** when one exists and **Back to journey** otherwise. Retain ordinary day navigation so no-photo days remain part of the trip. No stock or generated replacement photograph is required.

### E. Clean up metadata and travel summaries

- Display a photo timestamp once. Keep caption text separate from capture date/time, and handle existing automatically generated captions without damaging custom prose.
- Remove implementation details such as “48 mapped points” from visitor-facing route cards. Preserve meaningful endpoints, modes, distances, and actual stop counts.
- Replace concatenated duration strings with a readable travel-time summary. Prefer structured duration minutes/ranges and preserve qualifiers such as “with stops.” Do not naively add free-text values or imply that summed transit time equals the entire day's length. For incomplete data, use an honest partial summary or omit the total.
- Remove duplicate attribution while retaining every attribution required by the map's providers, legible and reachable on all layouts.
- Prevent critical dates/titles from being unusably truncated at normal desktop and phone widths.

### F. Support deliberate daily covers

Covered by section 2: select a representative lead image instead of relying on capture order. Review the mountain-day cover for Day 6 as a concrete example. Album chronology stays intact.

## Suggested delivery order and verification

1. Customizable journey/day covers and the concrete fixes.
2. Opening experience, visual alternatives for day stories, and mobile navigation.
3. Curated replay content, then the Replay player and Studio controls.

Use separate, reviewable changes and update existing TODO entries rather than duplicating T13 (lead photos), T16 (no-photo days), and T17 (Replay). Record completed behavior in the changelog and project handoff.

Verify the catalog, real trip, and demo at 390 × 844 and 1280 × 720, plus a narrow phone and short desktop window. Include keyboard use, reduced motion, long Day 6 content, a one-photo day, a no-photo day, hidden/deleted cover fallback, and slow/failed assets. Add focused data/state tests for the new behavior and run existing relevant checks. When implementation is published, verify the deployed pages with a fresh load.
