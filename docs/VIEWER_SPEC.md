# Journey Atlas viewer specification

**Purpose.** This is a complete, skin-independent description of the public
Journey Atlas viewer: its screens, controls, states, interactions and the
backend interface it consumes. It is written so that a designer or agent can
build a new **skin** (a new visual appearance, or a new front end) from this
document alone, without reading the code.

**Written:** 17 November 2026, from the shared templates and runtime
(`content/templates/*.html`, `dist/assets/*.js|css`) and the photo Worker
(`workers/photo-auth/`), at commit `7566aa4`.

**Scope**
- **In scope:** the public catalog page, journey pages (real trips, demos and
  fresh drafts) on desktop and phone, the photo/video viewer, Places, photo
  comments and notifications, photo unlock, sharing, and the hosted sign-in
  page as visitors experience it.
- **Out of scope:** Atlas Studio and every other localhost editing tool, owner
  moderation/export, and update announcements. Full-trip Replay is disabled
  (O09) and is described only as a dormant feature.
- **API section:** describes the interface the front end needs, not how the
  backend is built.

## How to use this document

- **What a skin may change:** layout proportions, colour, type, iconography,
  surface treatment, motion style and illustration.
- **What a skin must preserve:** the *information*, *controls*, *states*,
  *flows* and *interaction guarantees* described here. §17 lists exactly what
  is skinnable and what is invariant.
- **Owner decisions outrank this document.** These are product requirements,
  not current-implementation trivia. Each one carries an ID (O03, O21 and so
  on) that links to [OWNER_DECISIONS.md](OWNER_DECISIONS.md), where the reason
  and acceptance check live. If the two ever disagree, the decision wins and
  this spec must be corrected.
- **Must and should:** "Must" marks a guarantee a skin has to keep. "Should"
  marks the current default, which a skin may restyle.
- **Quoted copy:** strings in quotes are the current visitor-facing text. A
  skin may restyle them but should keep their meaning. Labels that name an
  action (O21) are requirements.

Contents:
1. [Concepts](#1-concepts)
2. [Pages, layouts and breakpoints](#2-pages-layouts-and-breakpoints)
3. [Global behavior](#3-global-behavior)
4. [Catalog page](#4-catalog-page)
5. [Journey opening](#5-journey-opening)
6. [Desktop atlas](#6-desktop-atlas)
7. [The map](#7-the-map)
8. [Phone atlas](#8-phone-atlas)
9. [Photos: album, grid and full-screen viewer](#9-photos-album-grid-and-full-screen-viewer)
10. [Map photo bubbles and the selected-photo card](#10-map-photo-bubbles-and-the-selected-photo-card)
11. [Places](#11-places)
12. [Photo comments and notifications](#12-photo-comments-and-notifications)
13. [Private photo access](#13-private-photo-access)
14. [Sharing](#14-sharing)
15. [How-to guide](#15-how-to-guide)
16. [Interaction quality requirements](#16-interaction-quality-requirements)
17. [Skin contract](#17-skin-contract)
18. [Backend API](#18-backend-api)
19. [Data model](#19-data-model)
20. [Keeping this spec current](#20-keeping-this-spec-current)

---

## 1. Concepts

- **Atlas / catalog:** the site root, listing published real journeys.
- **Journey (trip):** one story with its own stable URL (`<slug>.html`).
  - Kinds: **real** (in the catalog) and **demo** (fictional samples, all on
    `demo.html` with a journey picker).
  - Unpublished drafts render with the same viewer locally and never appear
    publicly.
- **Event:** the unit of the itinerary. There are two event modes, chosen per
  journey:
  - **Day mode** (default): one event per calendar day. The UI says "Day",
    "days" and "Day 3".
  - **City mode** (`eventMode: "city"`): one event per city stay, with an
    arrival–departure date range. The UI says "Stop", "stops" and "Stop 3".
    Photo-viewer jumps name the city itself; see §3.5.
- **Leg (segment):** one ordered piece of travel inside an event.
  - Transport modes: train, ferry, bus, gondola, walk, car, bike.
  - A leg can belong to one or more **route groups**.
- **Place:** an itinerary node such as a city or town. It may have a city
  boundary polygon.
- **Point of interest (curated "Places"):** owner-curated food or sight
  records with images, sources and optional group reviews. These are separate
  from itinerary places.
- **Photo / video (media):** each item is assigned to one event, ordered
  within that event's album, and optionally located.
  - Media may be **protected**, which means it needs the shared photo password.
  - Album order defines the event's first ("lead") photo.
- **Travelers and route groups:** an optional roster split into groups that
  take different routes, with an optional meetup.
  - The visitor can view "Everyone" or follow a single group.
- **Planning status:** an event is confirmed by default, or **TBD**
  (unconfirmed).
  - Undated TBD events form a tail at the end.
  - Visitors filter events by **Past**, **Locked in** (future, confirmed) and
    **TBD**. Past includes today and ongoing stays, in the trip's time zone.
- **Scope:** the atlas is either in **journey scope** (the whole-trip map with
  no event selected) or in **event scope** (one event selected).
- **Access state:** this is per browser, and has three values:
  - **unlocked:** a valid token is held.
  - **locked:** the page has private media and there is no access.
  - **not applicable:** demos, and trips with no private media.

## 2. Pages, layouts and breakpoints

| Page | URL | Notes |
| --- | --- | --- |
| Catalog | `/` (`index.html`) | Real published journeys |
| Journey | `/<slug>.html` | One per real journey |
| Demos | `/demo.html?journey=<id>` | Fictional samples. A picker switches between them. `?experience=places\|comments` opens a review preview (§11.8, §12.6) |
| Share preview | `{service}/share/<journey>/<photo>/<sig>` | Server page that redirects to the journey view (§14) |
| Hosted sign-in | `{service}/private-photos/auth/window?...` | First-party password page on the photo service origin (§13) |

**Breakpoints** (current values; a skin may move them but must keep two
distinct experiences):

| Width | Layout |
| --- | --- |
| ≥ 901 px | **Desktop**: header, then three columns: events list (left), map (centre), journal/photo sidebar (right). Column widths currently `minmax(286px,20vw) / 1fr / minmax(330px,26vw)`, narrowing at ≤1220 and ≤1050 px |
| ≤ 900 px | **Phone**: header, one full-height screen at a time (map, story or event list), and a bottom event navigator |
| ≤ 900 × ≤ 500 landscape | Short landscape: compact chrome; Places becomes a side sheet |

Supported widths go down to 320 px. Safe-area insets (`viewport-fit=cover`)
must be respected.

**Desktop column contract (O03).**
- Events stay on the left, the map in the centre, and the journal and photos
  on the right.
- A new feature extends these surfaces. It must not add a second photo panel
  or replace the sidebar.

**Phone screen contract (O08).**
- The phone layout is map-led: a persistent compact header, one resting event
  card over the map, and one bottom event picker.
- There is no extra "more" menu (O21).

## 3. Global behavior

### 3.1 Header

**Desktop header** (dark band):
- Brand: the mark plus the "Journey Atlas" wordmark. It links to the catalog
  (aria "Back to Journey Atlas catalog").
- "All journeys" text link.
- **Unlock photos** button with a lock icon. Shown only while locked, on a
  page with private media (§13).
- **Notifications bell** (§12.5): title "Most recent comments", aria
  "Notifications[, N unread comment(s)]", with a red unread badge.

**Phone header:**
- Left: a **Back** button whose label tells you where it goes (§8.1).
- Centre: the brand mark plus "Journey Atlas". It is the home link (aria "All
  journeys · Journey Atlas home") (O21).
- Right: the bell.

**Catalog header:** brand ("TRAVEL STORIES" eyebrow, "Journey Atlas"), a
"TRAVEL JOURNAL" badge, and the Unlock photos control.

### 3.2 Page entry (no-flash rule, O04)

Every initial URL first resolves two things: the requested **view** (catalog,
introduction, or a deep-linked day/photo/grid) and the **access state**. Only
then does the page reveal its chrome.

- Until both are resolved, nothing is shown except the page background colour.
  That means no default map, no introduction that will be replaced, no
  password prompt and no lock icon.
- After **500 ms**, a neutral status appears: "Opening Journey Atlas…".
- After **20 s**, or at once if a script fails to load: "Journey Atlas could
  not finish opening. Please try again." with a **Try again** button that
  reloads the page.
- Readiness never waits for photos, map tiles or neighbour preloading.
- A returning browser that unlocked before restores access silently (§13.3).
  A skin must not insert a visible step there.

### 3.3 URL and history

The address bar always mirrors the current view (O18).

- **Hash** fields:
  - `day=<eventId>`
  - `photo=<photoId>`
  - `view=map|story|photo|grid`
  - `scope=journey` (the overview)
- **Query** fields:
  - `group=<routeGroupId>`: the followed route group.
  - `journey=<id>`: demos only.
  - `experience=places|comments`: demo preview only.
- Legacy `#photo=` / `?photo=` / `?day=` links still work.
- Defaults: a photo with no view means `view=photo`; a day with no view means
  `view=map`.
- Unknown or removed IDs fall back to a valid event.
- A bare journey URL shows the normal introduction. There is no saved
  "resume where I was" behaviour; that was explicitly excluded.

History rules:
- **Push** a new entry when moving to a new *layer*:
  - phone screen changes (header Back, the picker, Expand map, the overview);
  - opening any overlay: album, guide, comments, unlock, notifications, share
    dialog, Places panel, Places detail, venue gallery, group reviews, map
    photo card;
  - entering the full-screen viewer (one entry);
  - photo → grid.
- **Replace** the entry for steps within a layer: swiping or browsing photos,
  toggling location, re-renders.
- An unchanged view writes no history at all (O20).
- **Back always goes up one level.** Close dismisses the current surface.
  Escape behaves like Close on the topmost layer.

Escape order:
1. Route inspector
2. Map place card
3. Photo location sheet
4. Viewer

Inside the viewer, comments and other dialogs close before the photo.

### 3.4 Formats

| Thing | Format |
| --- | --- |
| Capture time | Stored `YYYY-MM-DD · HH:MM` is **displayed** as `1 Oct 2026 · 20:44` (O21). Any other stored text is shown as written. A raw ISO stamp is never shown |
| Media count | "N photo(s)", "N video(s)", joined by " · ". Empty: "No photos or videos". Trip-wide counts include videos everywhere, so every surface agrees (O21) |
| Distance | "1,234 km". Qualifiers: "Distance pending", "Route to plan", "+ distance pending", "· includes TBD", "planned" |
| Travel time | "2 h 15 min–3 h travel", with "(2 of 3 legs timed)" and qualifiers such as "· with stops" when relevant |
| Meta text | Sentence case for dates, transport and counts. Small-caps eyebrows (e.g. "THE DAYS") keep capitals (O22) |
| Event number | Zero-padded in rows and eyebrows ("01", "DAY 03"), plain in labels ("Day 3") |

### 3.5 Day/stop wording

Every label that names an event switches with event mode:

| Day mode | City mode |
| --- | --- |
| Day / day / days / DAY / DAYS | Stop / stop / stops / STOP / STOPS |

Examples: "Day map" / "Stop map", "Choose a day" / "Choose a stop", "THE
DAYS" / "THE STOPS", "Zoom to day" / "Zoom to stop", "Day details" / "Stop
details", "Filter days" / "Filter stops".

Exception: the photo viewer's event jumps say **city** in city mode. Their
visible label is the city name, and their accessible names are "Next city
with photos · Vienna" and "Browse photo cities". A skin must apply this
switch to all event wording.

### 3.6 Text and touch minimums (O20)

- Visitor text is at least **12 px**.
- Every finger target is at least **44 px**. A small visual control may keep
  its visual size inside a larger hit area.

## 4. Catalog page

Order, top to bottom:

1. **Header** (§3.1).
2. **Hero:** h1 "We wander but aren't lost...yet", then "The routes we took
   and the photos we brought home, one trip at a time."
3. **Journey list** (section "The journeys"). One card per published real
   journey, in the configured order. Each card links to the journey page.
   - **Cover image.** The cover photo with its focal point; otherwise the
     first photo.
     - The resolution is chosen to fit the rendered box and pixel density.
     - The first five covers load eagerly.
     - Desktop: a large cover column (currently 280 px).
     - Phone: a 16:9 cover stacked above the copy (O22).
     - **Protected covers** show a blurred preview until unlocked and stay
       blurred if the visitor never unlocks.
     - **No cover at all:** text art reading "A JOURNEY TAKING SHAPE" /
       "Places to go. Memories to make your own."
   - **Kicker** (eyebrow), **title** (display serif), **subtitle** (two lines).
   - **Meta line:** dates · "{N} days|stops" · distance label (§3.4).
   - There are no photo or comment counts on cards.
4. **Empty state** (no published journeys): "The next mapped journey will
   appear here."
5. **Footer:** "More places, more pages to come." and a link "Try a sample
   journey" to `demo.html`.

## 5. Journey opening

### 5.1 Introduction (O06)

Shown on a bare journey URL. It is skipped when the URL carries a day, photo,
view or `experience` parameter: direct links bypass the introduction.

- **Cover photo** with its focal point.
  - Desktop: the left half.
  - Phone: on top.
  - No photo: text art "A journey taking shape".
- **Copy:** "{dates} · {N} days|stops", then the title (h1), then the
  traveler's introduction (the subtitle).
  - A journey with no content shows "Your journey is taking shape."
  - The whole introduction scrolls, however long it is.
- **One action**, in a separate bottom action row that is always visible
  (full width on phones): **Explore the journey**.
  - It opens the whole-trip map in journey scope with nothing selected.
  - There is no second "Whole trip map" button.
  - An **unmapped** draft (no coordinates anywhere) offers a single "View
    days" / "View stops" instead, which opens the event list.
- While the introduction is open, the atlas underneath is inert.

### 5.2 Opening route trace

On the first reveal of the whole-trip map:
- The full visible itinerary is traced from start to end over **3 s**, in
  event and leg order.
- The camera is stationary on the whole-trip framing, and a small orange
  tracking circle leads the line.
- Lines use their transport colours and patterns. Normal routes and markers
  are restored afterwards.
- Any deliberate input cancels the trace and shows the finished overview:
  pointer down, a key, wheel, or a user map move.
- It is skipped for reduced motion, a trip with no routes, and direct links.
- Automatic resizes and late route loading must not restart it or cause a
  flash (O06).
- Separate group legs are traced separately. No connecting lines are invented.

## 6. Desktop atlas

### 6.1 Left panel: the journey and its events

1. **Panel intro:**
   - Eyebrow "THE JOURNEY", then the journey name (serif).
   - Summary cells:

     | Value | Label |
     | --- | --- |
     | Dates | "TRAVEL DATES" |
     | Distance or "Distance pending" / "To plan" | "ALL ROUTES COMBINED", "ROUTE LENGTH · INCLUDES TBD" or "ROUTE LENGTH" |
     | Event count | "DAYS" / "STOPS" |

   - **Demos only:** a "Sample journey" select. Switching journeys clears the
     day, photo and group and fits the whole trip.
2. **Travel party.** Shown only when the journey has travelers.
   - Heading: "{N} travelers · {M} routes".
   - Meetup line: "Meet in {place}" / "Day 2 · {meetup label}".
   - Toggle buttons (`aria-pressed`): **Everyone · all routes**, then one per
     group showing its label, traveler count and names.
   - Status line: "Viewing {group|everyone} · map & journal".
   - Choosing a group re-projects the map, journal and media to that group
     and updates `?group=`.
3. **Section heading:** "THE DAYS" / "THE STOPS" with a count ("12 days").
4. **Planning filter.** Only shown when at least two categories have events.
   - Compact horizontal checkboxes: **Past**, **Locked in**, **TBD**, each
     with a count.
   - A category with zero events is hidden.
   - The last checked box cannot be unchecked ("Keep at least one group
     visible").
   - Changing a filter returns to journey scope and keeps a visible selection.
   - This filter is synchronised with the map's filter menu (§7.6).
5. **Event rows.** One button per visible event; the active row has
   `aria-current`. Row contents:
   - **Number badge** ("01"). Orange ring when selected.
   - **Date line:** the date · a line sample beside the transport words
     ("Train + Ferry"), or "To plan".
     - A TBD event drops a leading "TBD ·" from its date, because the badge
       already says TBD (O21).
   - **Title** (serif), with a **TBD** badge when unconfirmed.
   - Optional **tagline** (italic).
   - **First-photo thumbnail** with the media count on one line underneath
     ("12 photos · 1 video").
     - The thumbnail is loaded once and kept across event changes, with no
       reload and no second reveal.
     - An event with no photos has no thumbnail.

   Row interactions:
   - **Click** selects the event: arrival playback (§7.8), then the journal.
   - **Hover or keyboard focus** previews that event's routes and pin on the
     map, linked both ways with map pins (§7.3). There is no camera move. The
     preview clears 240 ms after leaving.
   - Selecting an event scrolls its row into view.

### 6.2 Map column

- **Title card** (top-left): kicker, journey title (large serif), subtitle.
- **Map actions** (pill buttons):

  | Button | When | Action |
  | --- | --- | --- |
  | **Zoom to {destination}** ("Zoom to day" and disabled in journey scope) | Event has coordinates | Frame the selected event |
  | **Show whole trip** | Any coordinates | Journey scope + whole-trip framing |
  | **All photos · N** / **Photos & videos · N** | N > 0 | Open the album (§9.1) |
  | **Places · N** | The trip has curated places | Open Places (§11) |

- The **map** itself, with its overlays, is described in §7.
- **Event navigator** (bottom-centre, event scope only): previous arrow,
  "Day 3 · {title}", next arrow.
  - The arrows are disabled at the ends.
  - The label opens the event chooser.

### 6.3 Right sidebar: journal and photos

The heading row is "Journey details" in journey scope, or "Day details ·
{title}" in event scope.

**Journey scope:**
- Media area: "The whole journey", the title and the dates.
- Body: the traveler's introduction, then "Choose a day to explore its route
  and photos."
- No photo strip and no share button.

**Event scope**, in order:
1. **Lead photo frame.** A large, **uncropped** photo in a stable-height frame
   on a steady blue backdrop. Hover must not flash the frame (O03).
   - Overlay: "DAY 03 · 12 PHOTOS", plus the caption in italic serif.
   - **One activation opens the full-screen viewer** at this photo.
   - No photos: "DAY 03" / destination / "{date} · A page from the journey".
2. **View {N photos · M videos}.** Opens the viewer.
3. **Share photo** (icon + text). Shares the lead photo (§14).
4. **Selected-photo card.** Replaces the lead area while a photo is selected
   from the map or reel (§10).
5. **Day details disclosure:**
   - Eyebrow "DAY 03 · {date}". TBD events add "TBD · Planned · not confirmed".
   - **Title** (large serif), optional **tagline** (italic), and the **story**
     with its paragraphs preserved. A blank story is valid and shows no filler
     (O10).
   - **Travel summary:** "{km} · {modes} · {duration}". Omitted when the event
     has no travel.
   - **Travel details:** a compact expandable row reading "Travel details
     {N} legs". Each leg card shows:
     - the mode's line sample and name;
     - the audience ("Mountain rail + Lake route" or "Everyone together") when
       groups exist;
     - a TBD badge;
     - "From → To";
     - "{km}" or "Distance not added" · duration · "N stops" · "Provisional
       route" / "Reconstructed corridor · service unconfirmed".
     - Leg cards are **not clickable** on desktop. Hover or keyboard focus
       highlights only that leg and greys the others, with no popup or camera
       move. Leaving, blur or Escape restores the map.
   - **Who went which way** (when groups exist):
     - "Everyone meets in X".
     - Per group: label, traveler count and names, "From → To", "Train + Bus ·
       2 legs" or "No travel legs · staying here", and "Overnight: X".
     - A **Show this route** / **Showing this route** toggle.
   - **Journal navigation:** "Previous day", "Day 3 of 12", "Next day".
6. **Photo reel** ("THIS DAY · Browse photos and videos"). Thumbnails in
   album order.
   - **Clicking a thumbnail selects it in the sidebar card (§10). It does not
     open full screen (O03).**
   - A video thumbnail opens the viewer and carries a play badge with its
     duration ("▶ 1:05").
   - The selected tile is centred and marked.

## 7. The map

### 7.1 Basemap and framing

- The basemap is a muted, warm vector style. Terrain stays legible, but
  **routes dominate**.
  - Settlement labels are compact charcoal on opaque warm-white halos, drawn
    **above** routes.
  - Road labels and shields sit **below** routes.
  - Points of interest from the basemap are hidden.
- Zoom buttons sit top-right on desktop and are hidden on phones. There is no
  compass.
- **Credits** start collapsed behind an info button in every map.
- Framing:
  - **Journey scope:** fit all routes and places, or the journey's optional
    wider `overviewBounds`.
  - **Event scope:** fit the event's routes.
  - **City framing** (after arrival, city mode) fits the photo locations
    inside the city boundary or within 5 miles of it, plus the event's marked
    places. With no boundary, it uses a 5-mile radius.

### 7.2 Routes

- Every leg is drawn in its **transport colour and line pattern** (§17.3)
  over a light casing.
  - Patterns keep modes distinguishable without colour.
  - **TBD** legs are dotted with no casing.
- **Overview:** all legs at normal width.
  - Coincident confirmed lines stay continuous.
  - TBD gaps must not paint over another route.
- **Event scope:**
  - The selected event's legs are on top, in full colour, wider and fully
    opaque.
  - All other events are muted grey (about 32% opacity).
  - This persists after arrival playback, Skip, reduced motion, and returning
    from photos (O09).
- **Route hover** (desktop, pointer only): highlights the leg and previews its
  event.
- **Route click** (desktop) selects that event and pins the **route
  inspector** card:
  - meta "Day 3 · Train" (+ " · TBD — unconfirmed");
  - title "From → To";
  - the first sentence of the story (≤175 characters);
  - a close ×;
  - **Back to Journal**.
  - Empty-map click or Escape clears it.
- **Phone:** tapping a route selects its event. There is no tooltip and no
  inspector.

### 7.3 Destination markers (O07)

- **Signpost:** an upright numbered board on a short stem, for a destination
  that belongs to one event.
  - It never rotates or flips.
  - The stem meets the top of the orange endpoint ring.
  - Click selects the event (aria "{name} · Day 3 · Open day").
- **Quiet dot:** used for repeated or nearby destinations ("Days 3–5" or
  "Day 3 +2"). Click opens a **place card** (aria "… · Choose a day").
- **Clustering:** pins cluster on zoom, and complete tap targets (44 px on
  phone) stay clear of controls. A pin with no space is dropped rather than
  overlapping UI.
- **Linked hover:** hover or focus links pins, the event's complete routes
  and the event row. One compact place card shows, with no camera move.
- **Place card:**
  - Title: the place name, or "Nearby places".
  - Meta: "Day 3 · {date}", or "{N} days · Choose a visit".
  - Close ×.
  - Visit buttons: "Explore day", or one per visit ("Day N" plus its date).
  - Timing: opens 140 ms after hover and closes 150 ms after leaving. When
    pinned, Escape closes it. Any map move closes it.
  - **Before the displayed event changes, every popup and hover preview
    closes and pending opens are cancelled** (O07).
- **Rail markers** (train legs only):
  - Larger 12 px start/end dots on every train leg ("Start: X", "End: X").
  - Day maps add small intermediate stop dots ("Rail stop: X"): orange
    centre, broad white rim spanning the blue line.
  - Dots appear only after their lines render.
  - The overview shows endpoints only.

### 7.4 Legend

- **Event scope:** heading "Day 3 routes", then one entry per mode used (line
  sample + name, e.g. "Train, solid line"). "Other days" and "Rail stop" are
  added when relevant.
- **Journey scope:** every mode present.
- "TBD · unconfirmed" appears whenever any visible leg is TBD.
- Phone: the legend lives in the story screen (§8.4).

### 7.5 Map states

- Loading: "Loading map…".
- Nothing to frame: "No location added yet."
- Error, or a 15 s timeout: "Map unavailable. Please try again." with a
  **Retry map** button.
- Map-dependent actions disable when the trip has no coordinates.

### 7.6 Filter menu

A collapsible control on the map, shown in journey scope when the trip has at
least two planning categories.

- Summary: "Filter days · All", the single category's name ("Future TBD"), or
  "2 groups".
- It contains the same three checkboxes as §6.1, kept in sync.

### 7.7 Photo bubbles and place pins

Event-scope maps also show sparse round photo bubbles (§10) and curated place
pins (§11.4). All three layers coexist.

### 7.8 Arrival → city playback

Selecting an event plays its incoming route.

**Sequence:**
1. One direct camera move to frame the route (850 ms).
2. The camera holds still while a plain **orange circle** traces the route
   (1.5 s linear), then holds for 0.25 s.
3. The camera eases into the destination (900 ms).

Start/Arrive labels sit outside the path.

**Arrival bar.** On desktop it sits at the bottom of the map; on phone it is
inside the event card.
- **Eyebrow:** "Getting here · Train + Bus" while travelling, then the date
  (+ " · TBD").
- **Title:**
  - travelling: "X → Y", "X · day trip" or "{N} group routes · A / B";
  - after arrival: "In {city}" or "Explore {city}";
  - otherwise "Destination to plan".
- **Buttons:**
  - **Replay arrival.** Hidden while travelling and on events with no legs.
  - A contextual button: "Skip to city" while travelling. After arrival it
    becomes **Photos · N** / **Photos & videos · N** (opens the photos),
    "Read story", "View day", or "Back to city".
  - On phone, a settled arrival collapses to a single round Replay icon
    beside the title (O21).
- A **progress bar** fills during the trace.

**Ending and interruption:**
- A map drag ends the playback early.
- Reduced motion shows the final state.
- The selected routes stay coloured and wide afterwards (O09).

## 8. Phone atlas

### 8.1 Screens and header

There are three screens, one shown at a time over the same box:

| Screen | Content | Header Back label |
| --- | --- | --- |
| **Map** | Map + event card | "All days" (event scope; returns to the overview). Hidden in journey scope |
| **Story** ("Details") | Event journal | "Day map" / "Whole journey map" |
| **Event list** | Left-panel content as a sheet | "Day map" / "Whole journey map" |

**Screen motion (O22):**
- Story **pushes in** from the right over the map and **pops out** on return.
- The event list **rises as a sheet** and falls back.
- The screen being left cannot be tapped and is hidden when the motion ends.
- First paint, restored views and browser Back are instant, with no animation.

### 8.2 Bottom event navigator

- Previous arrow, **picker button**, next arrow.
  - Arrows are disabled at the ends.
  - **From the overview, Next selects the first event**, even on a
    single-event trip.
- Picker label: "All days" / "All stops" in journey scope, or "Day 3 ·
  {title}" in event scope. Its accessible names are "Choose a day, current
  Day 3", "Return to whole journey map" and so on.
- The picker opens the event list sheet, which shows the travel party,
  filters and event rows exactly as §6.1.
  - In the overview no row is active.
  - After the last event, the list ends with **at most three entries** (O21):
    1. **Places we found** (when the trip has places);
    2. **Unlock photos** (only while locked);
    3. **How to use this atlas**.
  - Choosing a row returns to the map with that event selected.

### 8.3 Event card on the map

A rounded sheet resting over the bottom of the map.

**Event scope:**
1. **Routes · {group|Everyone}.** Only when the trip has route groups. Opens
   the event list at the travel party.
2. Date, **title** (serif), optional tagline, and meta "{km} · {modes} ·
   {duration}".
3. **Photo row:** up to four of the event's first photos.
   - Tapping a tile opens that photo full screen.
   - When more exist, the fourth tile reads "+N" and opens the grid.
   - The row is absent while travelling, while a photo is selected, and on
     events with no photos.
4. **Buttons** (one line, wrapping as whole buttons):
   - **Photos · N**: filled, larger and leading. Opens the event grid.
     - Locked trips show a small lock on it.
     - With nothing to show it reads "No photos yet" and is disabled.
   - **Details**: outlined. Opens the story screen.
   - **Places · N**: outlined. Only when the event has curated places.
5. The **arrival bar** (§7.8) is integrated here.

**Journey scope:**
- "The whole journey", the title, and "{N} days · Choose a day to explore its
  route".
- Buttons: **All photos** (opens the album) and Places.
- "Choose a day" appears only when there is no Photos or Places action (O21).

While a photo is selected (§10), the card shrinks to its title.

### 8.4 Story screen ("Day details"), in order (O21)

1. Date, title, tagline and meta.
2. The traveler's **story**.
3. **Travel details** (tapping a leg goes to the map and fits that leg) and
   group details.
4. **Route key** (the legend), then the event's **map**: a non-interactive
   preview with an **Expand map ↗** button that opens the map screen.
5. **Photo row**, led by a full-width first photo, with **Share** as an icon.

## 9. Photos: album, grid and full-screen viewer

### 9.1 Album ("All photos")

A full-screen dialog on a **near-black canvas** with compact sans-serif type
([album appearance, 17 Oct](OWNER_DECISIONS.md#photo-album-appearance--17-october-2026)).

- **Sticky heading:** "All photos · N" / "Photos & videos · N", and a solid
  **Close**.
- One tile per event:
  - a square first-photo cover, or text art "From the journal" / "View day";
  - "Day 3 · {title}";
  - "{date} · {media count|Read the story|View day}";
  - a video badge on its own event's cover.
- Phone: full viewport, two columns.
- **Opening an event:**
  - Phone opens that event's **grid**; desktop opens the **viewer**.
  - An event with no media closes the album and opens its story.
- Scroll position and tiles survive returning from a photo, and Back/Forward.

### 9.2 Phone event grid

- **Heading:** **Back** plus "{title} · 12 photos · 1 video".
- **Locked banner** (above the tiles, only once access has resolved as
  locked): lock icon, "Photos are private", and an **Unlock** button (O21).
- Square tiles on the dark canvas. Videos carry a play badge with duration.
- **Tapping a tile grows it into the full-screen photo.** Back or Close
  shrinks it back to its tile; the return is immediate if the tile is off
  screen.
- **The grid stays mounted underneath the photo.** There is no flash, reload
  or scroll loss on return (O08).

### 9.3 Browsing order

- **Ordinary browsing is a continuous camera roll** across every visible
  event album, in journey order, on desktop and phone (O03/O08).
  - Arrows and swipes cross event boundaries.
  - An event change updates the map and story behind the viewer.
  - Empty albums are skipped.
  - Browsing stops at the journey ends.
- **A map cluster never limits browsing** to its members.
- **Explicit collections** keep their own order and bounds: a Places "Our
  photos" set (§11.5), or a phone map group. Inside a collection, event jumps
  are hidden and counts say "Photo i of N".

### 9.4 Desktop full-screen viewer

It opens out of the page (O22). Layout: the **photo stage** on the left and
the **context sidebar** on the right.

**Photo stage:**
- The complete photo, fitted and undistorted, with previous/next arrows.
  Arrows are disabled at the journey ends.
- Caption overlay (italic serif) when a caption exists.

**Context sidebar**, in order:
1. **Photo location map:** follows the photo with a current pin and a fading
   previous pin (§9.7).
2. **Event jumps:** previous / "Day 3 · {date}" / next, jumping to the
   previous or next event that has photos.
   - Accessible names: "Next day with photos · {title}", or "city" in city
     mode.
   - Hidden inside collections.
3. **Counter + Share:**
   - Counter: "TRIP PHOTO 4 OF 120" or "TRIP VIDEO …"; inside a collection,
     "PHOTO 2 OF 6".
   - **Share** sits beside the counter (O18).
4. Event title, route line, "⌖ {location label}", photo title (videos),
   description, video credit link.
5. **Filmstrip** of the current event. Clicking a thumbnail shows it.

**Other parts of the viewer:**
- A **Comments · N** button (§12.1) appears when comments are available.
- At the end of an event, a continuation button offers "Next day →" / "Day 4 ·
  {title}", "Next day with photos or videos →" or "Back to journey →". It has
  no pulsing halo.
- **Close** (×), top-right. Clicking the backdrop also closes.

**Keyboard and zoom:**
- ←/→ move between photos. Shift+←/→ jump between events. Escape closes.
- Arrows do nothing while a dialog is open over the viewer, or while typing
  (O20).
- **Zoom** (O03, focal zoom):
  - Inputs: Ctrl+wheel or trackpad pinch, Safari gestures, two-pointer pinch,
    double-click (to ×2.5).
  - The zoom anchors at the pointer or pinch midpoint.
  - Drag or wheel pans within the image bounds.
  - Zoom resets on photo change, resize and close.

### 9.5 Phone full-screen viewer

**Chrome:**
- **Top row:** **Back** (labelled exactly "Back"), the count "4 of 12" in the
  current album, the **grid** button, and **Close** (top-right).
- **Event bar:** its own full-width row. Previous/next jump buttons sit at
  the safe left and right edges, with "Day 3 · {title}" centred.
  - Jump labels name their destination: the city name, or "Day 4". Long names
    truncate.
  - Swiping sideways on the bar also jumps.
- **Actions row:** **Comments · N** aligned to the right edge, with **Share**
  (icon) immediately to its left. With no comments, Share sits at the right
  edge (O03/O08/O18).
- **Footer:** the capture time ("1 Oct 2026 · 20:44") or the video title;
  previous/next arrows (48 px, light, emphasised); and the location toggle
  ("Photo location", "Details & location", "Video location", or "Hide
  location").

**Chrome treatment ([16 Oct correction](OWNER_DECISIONS.md#fullscreen-photo-controls-and-focal-zoom--16-october-2026)):**
- Controls are **solid, never translucent or blurred**: one charcoal family,
  with the light photo arrows as the emphasised pair.
- At rest, resting bars frame the photo, and the **complete photo fits
  between the visible controls**, including in landscape.
- While zoomed, the continuous bar backgrounds disappear and the photo fills
  the screen behind still-opaque buttons. Exposed photo between buttons still
  accepts gestures.

**Gestures:**

| Gesture | Effect |
| --- | --- |
| Single tap | Hide or restore **all** chrome. It must not fire after a double-tap, swipe, pinch or cancelled gesture |
| Horizontal swipe | Previous/next across the whole trip. The photo follows the finger. Commits past ~22% of width (≤90 px) or on a fast flick. Resists at the ends. 220 ms settle |
| Pull down (unzoomed, location closed) | The photo follows the finger, shrinks to ~0.82 and the backdrop fades. Commits past ~22% of height (64–120 px) or on a fast flick. **Returns one screen**: photo → presenting grid, or photo → the map/story/Places it came from. Short pulls snap back (180 ms) |
| Pull up | Opens the location sheet |
| Pinch | Focal zoom: the photo point stays under the moving midpoint. Max ×4 or more |
| Double-tap | Animated zoom to the tapped point (300 ms), or back |
| Drag while zoomed | Pan. It never dismisses or browses |

**Location sheet:**
- Title: the location label or "Photo location".
- Subtitle: "Day 3 · {title}", "No exact photo location · showing {city}", or
  "No saved photo location".
- A chevron closes it. Dragging the **whole heading** down also closes it.
- An open sheet collapses first on Back, Escape or pull-down.
- A closed sheet stays closed through swipes and grid round trips.

**Leaving the viewer:**
- Back and Close return to the presenting screen.
- A map returns with its previous camera and scope for the same event (O08).
- Browser Back and Forward follow the same layers.

### 9.6 Image loading (O04)

- Every image first shows a same-size **blurred embedded preview**. It is
  never black, never a sizing jump, and never a loading flash.
- The full image then reveals with a short blur-to-clear transition: 350 ms
  in the viewer, 650 ms elsewhere. On desktop the reveal also plays for cached
  images.
- **Full screen always uses the full derivative.** It never substitutes a
  thumbnail.
- Neighbouring photos preload within bounds, so the first swipe is as smooth
  as later ones.
- Failure: "This photo could not load. Try again." with **Retry photo**.
- Locked: "Unlock photos to see this photograph." with **Unlock photos**.
- Reduced motion removes the reveal motion.

### 9.7 Photo map behaviour (O05)

- Each photo keeps its exact pin separate from its saved map frame.
- If successive pins already fit the view, the camera stays still.
- Nearby moves are direct. Longer moves keep geographic context.
- Unlocated photos keep the event/city context, never an invented viewpoint.

### 9.8 Videos

- Videos appear in albums, grids and filmstrips with a poster and a "▶ 1:05"
  badge.
- **Play** is an opaque circular play icon (≥ 44 px, accessible name "Play
  video"). It disappears while playing.
- Native controls keep their own play, seek, volume and fullscreen actions.
  Drags on the picture still browse, tap toggles chrome, and pull-down and
  pull-up work as for photos.
- Status messages:
  - "Loading video…"
  - "Preparing private video…"
  - "This video could not load." with **Retry video**
  - "Unlock photos to watch this video."
- Public clips may offer a **Transcript** disclosure, timed captions and a
  credit link ("Video source").
- Playback pauses when the grid opens or the page goes to the background.

## 10. Map photo bubbles and the selected-photo card

**Bubbles** (event-scope maps only):
- Round photo thumbnails for located photos, grouped by screen distance (a
  count badge for groups).
- At most 6 groups on desktop and 4 on phone.
- Each bubble is offset from its true point by a short leader.
- The selected bubble is larger and the others dim.
- Bubbles stay tied to their own locations. Album browsing does not regroup
  them.
- Accessible names: "Select photo" or "Browse N photos".

**Clicking a bubble selects the photo in the card. It never opens full screen
(O03).**

**Selected-photo card** ("Selected trip photos"). On desktop it sits in the
sidebar's lead area; on phone it sits above the shrunken event card.

1. **Large photo:** the way into full screen ("Full screen ↗"). A locked photo
   shows **Unlock photos** instead.
2. **Close** (44 px, on the card, not on the photo).
3. **Navigation:** previous / count / next.
   - Count: the photo's place in the whole trip, or "i of N here" for a map
     group.
   - Desktop browsing continues through the whole trip; a phone map group
     browses that group.
4. **Actions, labelled on phone and desktop** (O21):
   - **Comments** with badge (when available);
   - **Share**;
   - **Show on map**: drops an exact pin and eases there. Disabled when the
     photo has no location.
5. **Caption** (traveler-written only).
6. **About {place} →.** Only when the owner explicitly linked this photo to a
   curated place (O02). It opens that place.
7. **Photo details** disclosure:
   - title ("At {place}", the location, the time, or "Photo");
   - "Day n · title";
   - "No saved photo location. It remains in the album." (only when there is
     no location);
   - the description.
   - On phone it is shown only when it adds something.

**Input:**
- A sideways swipe on the photo browses; a tap opens full screen.
- ←/→ browse.
- **Close, Back, Escape and a downward pull** dismiss the card (O21).
- Changing event clears the selection.

## 11. Places

Places is shown only when the trip has curated places. A trip with none hides
every viewer Places button (O13).

### 11.1 Entry points

- **Desktop:** the map action **Places · N**.
- **Phone:** **Places · N** in the event card (opens scoped to the current
  event), and **Places we found** at the end of the event list.
- Each entry updates `aria-expanded`.

### 11.2 Layouts

- **Desktop:** a sidebar beside the map. The map stays interactive.
- **Phone:** a bottom sheet that **opens expanded with results visible**
  ([mobile Places visibility, 12 Oct](OWNER_DECISIONS.md#mobile-places-visibility--12-october-2026)), with two heights:
  - **reading:** nearly full height;
  - **map:** about 40% height, showing compact result cards.
  - Movement:
    - **Show map** / **Show list** switches between the two heights.
    - Dragging the handle, the list heading or the detail top bar moves the
      sheet with the finger and settles into the nearest height. A cancelled
      drag restores the start.
    - Buttons inside the header stay tappable, content scrolls, and the
      exposed map stays pannable.
- **Short landscape:** a side sheet.

### 11.3 List view, in order

1. **Header:**
   - Eyebrow "ALONG THE WAY" (desktop), then the title: "Places", or "Saved
     places" if every place is unvisited.
   - **Close**.
   - Phone: a handle with **Show map** / **Show list**.
2. **Search:** "Find a place", with a clear ×. Matching ignores accents and
   case and covers name, summary, address and note.
3. **Category chips:** **All types**, **Food & drink**, **Sights**.
   - On phone they sit behind a **Filters** toggle ("Filters · 1" when one is
     active).
4. **Scope:**
   - **{event title}** + count. Disabled in journey scope.
   - **All places** + count.
   - Initial scope:
     - the selected event's places;
     - in journey scope, all places;
     - a deliberate search, category or scope persists while browsing and
       reopening.
5. **Show results on map** (desktop). Fits the pins.
6. **Meta line:** "N places", plus " nearby" or " of {total}". It also shows
   "Saved for the journey" / "Sample places", or **Show all results** in
   nearby mode.
7. **Result cards:**
   - kind ("Food & drink" / "Sight");
   - a "Saved for later" chip;
   - name;
   - rating row (average, stars, "N group reviews"), only when reviewed;
   - summary;
   - thumbnail, or a category icon.
   - A venue image its host refuses simply collapses (O20).
8. **Empty filtered result:** "No places found", "No matches for “{q}”. Try a
   different search or filter." and **See all places** (resets everything).
9. **No places at all:** "Good places stay with us." and **Back to the
   journey**.

Map pins:
- Category icons, clustered by screen distance.
- The name shows on hover, focus or selection.
- **Desktop cluster:** a small popup listing its places.
- **Phone cluster:** switches the list to "nearby" mode.

### 11.4 Place detail

- **Top bar:** **Back** (to "Places" or "{event} places"), the place name, and
  **Close**.
- **Identity:**
  - kind line ("Food & drink" / "Place of interest") + **Visited** / **Saved
    for later**;
  - name;
  - rating button (score, stars, "N group reviews"), which opens the group
    reviews;
  - "Sample place · fictional group memories" (samples only);
  - a venue thumbnail that opens the gallery.
- **Tabs:** **Overview** and **Photos (N)**. Arrow keys, Home and End move
  between them.

**Overview tab:**
- Summary.
- A quote labelled "Our memory" (visited) or "Saved note".
- **Google Maps** (an ordinary external link) and **Recenter map**.
- Address (+ "Approximate map position").
- Visit lines: "Day n · title" plus the date.
- "No reviews yet." when unreviewed. There is no empty review modal (O04).
- Disclosure **About this place & sources**, with source links.

**Photos tab:**
- **Our photos:** trip photos the owner linked to the place.
  - Opening one starts an explicit collection labelled with the place name.
  - Locked photos show "Open photo" tiles.
- **Venue photos:** each with its credit, a **Source** link and an optional
  **License** link. Illustrations are labelled "Illustration".
- Empty: "No venue photos added yet."

### 11.5 Group reviews (floating card)

Opened from the rating. It is a floating conversation card, and the Places
sidebar stays visible behind it.

- Header: "Place reviews" + the name, and Close.
- "Our group’s reviews", with the note "Personal impressions from the people
  on this trip." (or the sample note).
- Average, stars, "N reviews", and a 5★→1★ distribution with a bar each.
- Rows: avatar initial, name, stars, text.
- Reviews are owner-curated data. Visitors cannot write them on real trips.

### 11.6 Venue gallery

A full-screen dialog:
- Place name and "i of N".
- Previous/next, arrow keys and swipe.
- Complete images, with credit, "Photo source" and "License".
- Failure: "This photo couldn’t load." with **Try again**.

### 11.7 History and state

- Panel, detail, gallery and reviews each push a history entry.
- Back and Forward restore the tab and the per-tab scroll, without rebuilding
  unchanged content (persistence audit, 12 Oct).
- Escape: from a detail it goes back to the list; from the list it closes.
- Closing restores the map camera saved when the panel opened, if the event
  is unchanged.
- Changing event closes Places.

### 11.8 Demo review preview (`?experience=places`)

On demo trips only, a preview bar ("UX preview", **Places** / **Comments**
toggles, an options menu with "Reset preview edits…" and "Exit preview")
enables a browser-local review editor:
- star radios with the words "Not for us", "Could be better", "Good", "Really
  good" and "Loved it";
- a name field and an optional text (1,000 characters);
- "Draft saved in this browser";
- **Post review** / **Save changes**;
- edit, and delete with **Undo**.

This is not part of the production experience. A skin only needs it to
render demos faithfully.

## 12. Photo comments and notifications

Comments exist for published real trips (on the live service, behind photo
access) and in the demo preview (browser-local, password `demo`). Unpublished
drafts show no comment controls.

### 12.1 Comments button and badge (O17)

- Shown on the selected-photo card ("Comments") and in the full-screen viewer
  ("Comments · N").
- Badge:
  - a **red circle with the unread count** when anything is unread;
  - otherwise the **plain total**;
  - nothing until counts have loaded. A failed load never implies zero.
- Accessible name: "Comments, 5 comments, 2 unread".

### 12.2 Conversation surface

A floating rounded card with a soft shadow. Desktop keeps the photo and
sidebar visible; phone uses an inset bottom sheet. It opens immediately, and
the thread loads inside it.

**Two presentations:**

- **Contextual** (from the sidebar card):
  - Title "Photo comments".
  - A photo row: thumbnail (aria "Return to photograph"), the photo title
    (caption or capture time), and "Photo 4 of 120[ · {collection}]".
  - Previous/next photograph buttons.
  - Meta: "N comments" · "Shared with people who have photo access".
- **Over full screen** (from the viewer or a notification):
  - A compact "Comments" heading with a muted count.
  - **No** repeated photo thumbnail, title or navigation, because the photo
    is right behind it (O17).
  - Desktop: floats top-right. Phone: about 64% of the screen height.

**Header:** a handle, the title and **Close**.
- Dragging down from **anywhere on the header**, including Close, dismisses
  it. A slight sideways start is tolerated. Short or cancelled drags snap back.
- Close, Escape and Back also dismiss it.
- **Only the conversation closes.** The photo and any draft stay.

**Thread:**
- Rows: avatar initial, name, a "you" tag on your own comments, a short date
  (full time in a tooltip, " · edited"), then the body.
- **Your own comments** get a "⋯" menu with **Edit comment** and **Delete
  comment**.
  - Edit is inline, with Cancel and Save (⌘/Ctrl+Enter saves, Escape cancels).
  - Delete shows the bar "Comment deleted." with **Undo** for **5 minutes**.
- **Load more comments** sits inside the scroller.

States:

| State | Copy |
| --- | --- |
| Empty | "No comments yet" / "Share a memory or start the conversation." (no second "write first comment" control, O21) |
| Loading | "Loading comments…" / "You can start writing while we fetch the conversation." |
| Refreshing | "Updating…" |
| Failed | "Comments unavailable" / "Try again when your connection is ready.", or "Couldn’t update. Showing saved comments." + **Try again** |
| Identity expired | "Unlock photos again to use comments." + **Unlock photos** |

**Composer:**
- Byline: "Commenting as **{name}**" with **Change name** (or **Add your
  name**).
- Textarea: "Add a comment…", up to 1,000 characters. A counter appears from
  750.
- **Post** ("Posting…" while sending). ⌘/Ctrl+Enter posts.
- Draft status: "Draft saved". If storage fails, "Draft kept on this page".
- Success: "Comment added."
- Failure keeps the text: "Your comment could not be saved. Your draft is
  still here; try again.", or the server's message (e.g. "Please wait a
  minute before making more changes.").
- On a short phone with the keyboard open, the photo context hides and the
  composer becomes a single row.

### 12.3 Identity

- There are no accounts. A visitor gets a hidden signed visitor ID at unlock
  and a **self-chosen, non-unique display name**: optional on the sign-in
  page, required before the first post.
- **Change name** is a small form ("What should we call you?", "Choose the
  name beside your next comments.", "Your earlier comments keep their
  original name."). It never asks for the password again.

### 12.4 Read state

- Read comment IDs are stored **locally per journey**.
- A comment becomes read when it is actually visible in the thread (about
  80 px of it, or all of it).
- Opening a thread does not mark unloaded or offscreen comments read.
- Posting marks your own comment read.
- Read state syncs across tabs.

### 12.5 Notifications ("Most recent comments")

- **Bell** in both headers, with a red unread badge (unread count only, never
  a total).
- **Dialog:** "Most recent comments", the journey title, and Close. Dragging
  the header down closes it too.
- Newest first across the **whole trip**, regardless of the selected event or
  group filter.
- Row:
  - photo thumbnail;
  - author and short date;
  - comment body;
  - the photo's caption, or "{stop title} · {dates}", then " →";
  - a red dot when unread.
- **Load more comments.**

States:

| State | Copy |
| --- | --- |
| Locked | "Join the conversation" / "Unlock photos to see comments from this journey." + **Unlock photos** |
| Loading | "Loading comments…" / "Gathering the latest conversations from this journey." |
| Empty | "No comments yet" / "Comments on any photo in this journey will appear here." |
| Unpublished | "Comments will appear here when this journey is published." |
| Error | "Comments unavailable" + **Try again** |

**Activating a row** closes the dialog, then opens **that photo full screen
with its conversation already on top**, scrolled to and focusing the comment,
in one activation (O17).
- If the photo's event is hidden by a filter, only that category is
  re-enabled.
- Closing the conversation leaves the visitor on the photograph.

### 12.6 Demo preview (`?experience=comments`)

On demo trips, a welcome dialog ("Come on in.") asks for a display name and
the shared password `demo`. Comments then live in browser storage, with the
same UI as live comments.

## 13. Private photo access

### 13.1 Where unlock is offered (O20/O21)

Unlock controls appear **only** once access has resolved as **locked**, on a
page that actually has protected media. Never on demos, never on a trip with
nothing private, and never as a flash before resolution.

- **Header:** **Unlock photos** with a lock icon. It goes straight to the
  hosted sign-in.
- **Phone event list:** **Unlock photos**.
- **Phone grid banner:** "Photos are private" + **Unlock**.
- **Phone Photos button:** a small lock glyph.
- **Selected-photo card:** an **Unlock photos** overlay on a locked photo.
- **Viewer:** "Unlock photos to see this photograph." / "Unlock photos to
  watch this video."
- **First-visit prompt** (automatic, when this browser has never unlocked):
  - "Private photographs" / "The journey is here to explore. Unlock the photos
    with a shared password."
  - **Unlock photos** (the only filled button).
  - "You’ll visit a secure login page, then return here. Access is remembered
    for 30 days."
  - **Continue without photos** (outlined). It marks this tab as a guest.

While locked:
- Thumbnails show their blurred previews.
- Comment thumbnails are hidden.
- Places trip-photo tiles show "Open photo".
- The journey itself (map, story, routes and Places) remains fully
  explorable.

### 13.2 Hosted sign-in page

The page is served by the photo service (first-party, so the password never
touches the atlas origin).

- It is blank for the first 500 ms, so a fast automatic check shows nothing.
- Login form:
  - "Private photographs" / "Enter a shared password to view the trip photos.
    This browser will remember access for 30 days."
  - Fields **in this order**: **Your display name (optional)** (≤ 40
    characters), then **Photo password**.
  - **Unlock photos** (the only filled button; "Unlocking…" while working).
  - **Continue without photos** (outlined).
  - Errors: "That password did not work. Please try again.", "Too many
    attempts. Try again in a minute.", "Photo access is taking too long.
    Please try again."
- A failed automatic restore returns silently. It never shows a password form.
- Other failures show the message with **Try restoring again** (outlined).
- On success the visitor returns to the **exact view** they came from.

### 13.3 Remembered access

- Unlocking is remembered for **30 days** on this browser. Returning visits
  restore it automatically before the page reveals itself (§3.2).
- Short-lived access tokens renew silently, about hourly. No password is
  retyped.
- There is no visitor logout control. Access expiring in another tab locks
  this tab too.

## 14. Sharing

**Share buttons:**
- the lead photo ("Share photo");
- the selected-photo card (**Share**);
- the desktop viewer sidebar (**Share**, beside the counter);
- the phone viewer (icon, left of Comments);
- phone story details (icon).

**Flow:**
1. The link is the current view URL (§3.3). It carries only IDs and view
   state, never tokens, passwords or photo bytes.
2. For a published still photo, the service first mints a **photo share link**
   whose messaging preview shows that photo's **low-resolution thumbnail**
   (O18). If this fails, the status reads "Photo preview unavailable; sharing
   the link" and the ordinary link is shared.
3. The **native share sheet** opens where available. Cancelling does nothing.
4. Otherwise the link is copied, with a brief "Link copied" status (3 s).
5. If copying is denied, a **Copy link** dialog appears: "Select and copy this
   link to share the current view.", a read-only selected URL field, and
   **Done**.
6. If preparing the link took too long for the browser to allow the share
   sheet, a **Share photo** dialog ("Share this photo, or copy its link.")
   offers a fresh **Share photo** tap.

**Recipients:**
- They land on the shared day, photo and view.
- Locked recipients see the normal unlock flow, then return to that view.
- Removed photos fall back to their day.

## 15. How-to guide

Opened from **How to use this atlas** at the end of the phone event list. It
is a dialog: a sheet on phone, closable by dragging its heading down, and
centred on desktop.

1. Eyebrow "HOW TO USE THIS ATLAS", the journey title, and Close.
2. Four steps:
   - **1 · Pick a day**: "Choose a day from the list, or tap its numbered
     marker on the map. The arrows step to the next day."
   - **2 · See the photos**: "Photos opens that day's album. Tap a photo to
     fill the screen, swipe to keep going through the whole trip, and pull the
     photo down to come back."
   - **3 · Photos on the map**: "Round photo markers show where pictures were
     taken. Tap one to preview it, then tap the preview to open it."
   - **4 · Comments and places**: "Leave a comment on any photo; the bell
     shows the latest ones. Places lists the spots saved along the way, when a
     trip has them."
3. **About this trip:** the traveler's own note, only when written.
4. **Privacy:** "the public site asks search engines not to index or archive
   it, but anyone with the URL can still open it. Private photos stay locked
   until someone enters the shared password."
5. **Back to the atlas.**

This is help copy, never trip story (O10).

## 16. Interaction quality requirements

These are the owner's "Apple-like" acceptance qualities (O22, PRINCIPLES).
Every skin must meet them.

- **Stable layout:** nothing jumps when data, images or counts arrive.
  - Image frames keep their size.
  - Controls do not move when labels change.
- **Every control answers a press.** The current default is a clear dip
  (scale ≈ 0.955) with a springy release.
  - Hover styling applies only to devices that actually hover.
  - A tapped control must not stay highlighted on a phone.
- **Motion** is short, consistent and interruptible: three shared durations
  (120/200/320 ms) and two curves.
  - Fixed exceptions that must not change: the gesture settles (swipe 220 ms,
    pull 180 ms, location 220 ms) and the photo reveals (350/650 ms).
  - Event changes settle the new title and words. A re-render of the same
    event does not.
  - There is no decorative animation, and nothing delays a photograph.
- **First paint, restored views and browser Back are never animated** (O04).
- **Reduced motion** removes all interface movement, the opening trace and
  arrival playback motion, and shows final states.
- **Keyboard:**
  - Everything is reachable.
  - A slim slate focus ring appears for keyboard use only, never orange and
    never persistent after mouse or touch.
  - Dialogs trap and restore focus.
- **Part-screen sheets close by a downward pull** on their heading, as well as
  Close, Back and Escape (O21). This applies to conversations, recent
  comments, the guide, the phone photo card and the photo location sheet. The
  Places sheet instead resizes.
- **Preserve state across moves:**
  - unfinished text;
  - selection and scroll;
  - the presenting grid or album;
  - the map camera for the same event.
  - A background refresh never replaces a draft.
- **Design incomplete, empty, loading and failed states** as carefully as
  success.
  - Report saving honestly, and keep text when a write fails.
  - Use inline Retry rather than modal errors.
- **Editorial restraint (O01/O02/O10):**
  - Show only traveler-written captions, stories and taglines.
  - Blank is valid. Never generate filler, captions, venue guesses or "stayed
    here" text.
  - Filenames and alt text are never visible captions.
  - The capture time may identify an unlabelled photo.
- **Locked states explain themselves beside what they lock** (O21).

## 17. Skin contract

### 17.1 A skin may change

- Colour palette, typography, iconography, radii, shadows, surface materials
  and illustration.
- Column proportions, spacing, and the exact breakpoint values, as long as
  desktop and phone remain distinct experiences.
- The basemap style, provided routes stay dominant, settlement labels stay
  above routes, and road labels stay below.
- Wording polish, keeping the meaning, the day/stop switching and O21's
  action names.
- Motion character, within §16.

### 17.2 A skin must preserve

- **Desktop:** three columns (events · map · journal/photos), one sidebar for
  photos, and map/reel selection **not** going full screen while the large
  photo does (O03).
- **Phone:** the map-led screen, the one bottom event picker and the event
  card. There is no extra menu (O08/O21).
- **Opening:** one action, always visible (O06).
- **Navigation:** every control listed in §§4–15, with its availability
  conditions, empty, loading and error states, and history behaviour.
- **Photo viewer:** a solid (non-translucent) full-screen chrome with the
  phone control placement in §9.5, a continuous camera roll, focal zoom, and
  one-level Back/Close/pull.
- **Images:** the progressive image loading of §9.6 and the access boundary
  of §13.
- **Map:** transport colours *and* distinguishable patterns, matched in the
  legend.

### 17.3 Current tokens (reference values)

| Token | Value | Role |
| --- | --- | --- |
| `--paper` | `#f4f1ea` | Page background (also the pre-reveal colour) |
| `--panel` | `#fffdf9` | Panels and cards |
| `--panel-cool` / `--tint` | `#f6f3ec` / `#f1ece1` | Secondary surfaces |
| `--line` | `#e4dfd5` | Hairlines |
| `--ink` / `--ink-soft` / `--muted` | `#122b30` / `#3a5358` / `#5c6d6e` | Text |
| `--route` | `#006f92` | Brand blue, links, primary |
| `--selected` | `#d4512c` | Selection orange (rings, tracking circle) |
| `--focus-ring` | `#587579` | Keyboard focus |
| Unread badge | `#d82c35` | Notification red |
| TBD badge | `#5f4776` on `#f2edf6` | Unconfirmed |
| Album / viewer canvas | near-black | Dark photo surfaces |
| Fonts | Georgia (display titles, captions); system UI stack (everything else) | |
| Radii | 8 / 12 / 20 / pill | |
| Motion | 120 / 200 / 320 ms; `cubic-bezier(.22,.68,.25,1)` and `(.45,0,.25,1)` | |

Brand mark: a white globe in a map pin with an orange tip, on route blue
(`#006f92`, `#ffffff`, `#d4512c`). See [BRANDING.md](BRANDING.md). A skin must
not replace the reviewed mark without the owner.

**Transport vocabulary** (colour and pattern; patterns are required):

| Mode | Label | Colour | Pattern |
| --- | --- | --- | --- |
| train | Train | `#0072b2` | solid |
| boat | Ferry | `#007f8b` | short dash |
| bus | Bus | `#a85c00` | long dash |
| gondola | Gondola | `#7b4ba3` | spaced dots (◆ in legend) |
| walk | Walk | `#3d4a4d` | fine dots |
| car | Car | `#a43a2f` | dash-dot |
| bike | Bike | `#24804f` | medium dash |
| TBD (any mode) | "TBD · unconfirmed" | mode colour | dotted, no casing |
| Other events (event scope) | "Other days" | `#71878a` at ~32% | muted |

## 18. Backend API

The front end needs four kinds of backend capability. Today they are
implemented as **static data bundles** generated at build time, plus **one
HTTPS service** (the photo Worker, `{service}`). A new front end can treat
the static bundles as read-only `GET` endpoints with the shapes in §19.

**Conventions** (all calls to `{service}`):
- CORS is restricted to the atlas origin. Requests use `credentials: omit`.
- Authentication is `Authorization: Bearer <access token>`. Cookies are never
  used cross-origin.
- JSON responses are `no-store`.
- Errors are `{error: string, code?: string}`, with a meaningful HTTP status.
  The front end shows `error` verbatim where this spec quotes server messages.
- Timeouts: 15 s for auth and media, 8 s for comments, 4 s for share.

### 18.1 Content (read-only, public)

| Logical endpoint | Current form | Returns |
| --- | --- | --- |
| `GET /catalog` | `assets/catalog-data.js` → `JOURNEY_ATLAS_CATALOG` | `{defaultJourneyId, journeys: CatalogEntry[]}` (§19.1) |
| `GET /journeys/{id}` | `assets/journey-data/trip-<id>.js` (demos share `demos.js`) | `{journey: Journey, photos: Photo[], routes: {segmentId: Route}, overrides}`. The current bundle defines `JOURNEY_ATLAS_DATA`, `JOURNEY_ATLAS_PHOTOS`, `JOURNEY_ATLAS_ROUTE_GEOMETRY` and `JOURNEY_ATLAS_CONTENT_OVERRIDES`. A clean API should return overrides already merged |
| `GET /site` | `content/site.json` + brand assets | `{name, url, description}`, icons, 1200×630 share image |
| Basemap | OpenFreeMap "liberty" style + tiles | Vector style, glyphs, sprites |

Content never contains comment text, credentials or private image bytes.
Unpublished, trashed and local-only media are already filtered out.

### 18.2 Access (private photos)

| Method | Path | Request | Success | Errors |
| --- | --- | --- | --- | --- |
| *navigate* | `/private-photos/auth/window?origin&state&challenge&returnTo&action=login\|restore\|logout` | PKCE: `state` and a `challenge` (SHA-256 of a random verifier) | Returns to `returnTo#state=…&photoAuthCode=<code>`, or `photoAuthMissing=1` / `photoAuthCancel=1` / `photoAuthLogout=1` | `400` "Open this page from the atlas." |
| POST | `/private-photos/auth/redeem` | `{code, verifier}` | `{token, expiresAt}` (unix seconds; currently ≤ 1 h) | `401` "Login expired. Please unlock again." |
| GET | `/private-photos/auth/status` | Bearer | `{unlocked: true, expiresAt}` | `401 {unlocked:false}` |

Client behaviour:
- Store the token per tab and remember "has unlocked" per browser.
- Check status every 60 s and on focus.
- On expiry or any `401`, run `restore` again. It is silent through the
  30-day first-party cookie.
- There is no refresh endpoint.

The login, session and logout POSTs are internal to the hosted page.

### 18.3 Media

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/private-photos/assets/v1/<sha256>.webp\|avif` | Bearer. Paths come from `Photo.src`, `srcset[]` and `fullAvif.src`. `ETag`/304. `401` locks the client; `404` means missing |
| POST | `/private-photos/video-access` | Bearer, `{src}`. Returns `{grant, expiresAt}` (≤ 10 min) |
| GET | `/private-videos/assets/v1/<sha256>.mp4?grant=…` | Native `<video>`. Supports byte ranges (`206`, `416`) |
| GET | `/place-images/assets/v1/<sha256>.webp` | Public, immutable venue images |

Client behaviour:
- Choose the smallest derivative at least as wide as needed: about 480 for
  thumbnails, 1280 for previews and covers, and the full size for the viewer.
- Prefer AVIF in the viewer when the browser decodes it; fall back to the
  full WebP.
- Public demo media use ordinary relative URLs.

### 18.4 Comments (`/community`, Bearer)

Every call requires an access token that carries a visitor identity.

Common errors:
- `401` "Unlock photos to read or leave comments."
- `409 code=identity_required` "Unlock photos again to create your remembered
  comment identity."
- `429` "Please wait a minute before making more changes." (writes)
- `503` "Comments are being prepared…"

| Method | Path | Request | Response |
| --- | --- | --- | --- |
| GET | `/community/profile` | – | `{name, identity}` |
| PATCH | `/community/profile` | `{name}` (1–40 chars) | `{name, identity}` |
| GET | `/community/journeys/{j}/photos/{p}/comments?after=<cursor>` | – | `{comments: Comment[] (≤50, oldest first), next}` |
| GET | `/community/journeys/{j}/comments/summary?after=<cursor>` | – | `{comments: [{id, photoId, createdAt}] (≤500), next}`. Used for exact per-photo and trip counts against local read IDs |
| GET | `/community/journeys/{j}/comments?before=<cursor>` | – | `{comments: Comment[] (≤30, newest first), next}`. The recent feed |
| POST | `/community/journeys/{j}/photos/{p}/comments` | `{body (1–1000), clientRequestId}` | `{comment}`. Idempotent per `clientRequestId` |
| PATCH | `/community/comments/{id}` | `{body}` | `{comment}`. `409` "The comment changed. Refresh and try again." |
| DELETE | `/community/comments/{id}` | – | `{deleted: true, comment, undoSeconds: 300}` |
| POST | `/community/comments/{id}/restore` | `{}` | `{comment}`. `409` "The five-minute Undo period has ended." |

Notes:
- `Comment` = `{id, journeyId, photoId, displayName, body, createdAt (ms),
  editedAt (ms|null), own (bool)}`.
- Cursors are opaque strings.
- Read state is **never** sent to the server.
- There is no polling or realtime connection. Data is refreshed on open,
  focus and visibility, with a 30 s cache.

### 18.5 Sharing

| Method | Path | Request | Response |
| --- | --- | --- | --- |
| POST | `/private-photos/share` | `{journeyId, photoId, view: map\|story\|photo, scope: day\|journey, group}`. Bearer only for protected photos | `{url}` = `{service}/share/{j}/{p}/{sig}?view…` |
| GET | `/share/{j}/{p}/{sig}` | Recipients and crawlers | HTML with Open Graph/Twitter metadata that redirects to `<journey page>#day=…&photo=…&view=…` |
| GET | `/share/{j}/{p}/{sig}/thumbnail.webp` | – | ≤ 480 px thumbnail only |

### 18.6 Demo mode

Demo journeys use no service:
- Photos are public.
- Comments, reviews, identity and read state live in browser storage.
- The preview password `demo` is checked only in the browser.

A new front end may mock §18.4 locally for demos the same way.

## 19. Data model

Coordinates are GeoJSON `[lng, lat]`, except flat `lat`/`lng` on places,
photos and rail stops.

### 19.1 CatalogEntry

`{id, slug, kicker?, title, subtitle?, dates (display), eventCount,
eventLabel: "days"|"stops", distanceLabel (display), cover: {photo?: Photo,
position: "X% Y%"}}`

### 19.2 Journey

| Field | Type | Notes |
| --- | --- | --- |
| `id`, `slug`, `kind` (`real`\|`demo`), `published` | | |
| `title`, `label`, `kicker?`, `subtitle?` (introduction), `dates` (display), `note?` (guide "About this trip") | string | |
| `status?` | `ongoing`\|`planned` | Affects distance wording |
| `eventMode?` | `day`\|`city` | Default `day` |
| `startDate?`, `endDate?` | `YYYY-MM-DD` | |
| `coverPhoto?` | `{photoId, focal: [x%, y%]}` | Default: the first photo, centred |
| `overviewBounds?` | `[[w,s],[e,n]]` | Wider whole-trip framing |
| `places` | Place[] | Itinerary nodes |
| `days` | Event[] | Ordered |
| `segments` | Leg[] | |
| `pointsOfInterest?` | Poi[] | Curated Places (empty or absent means Places is hidden) |
| `videos?` | Video[] | |
| `travelers?` | `[{id, name}]` | |
| `routeGroups?` | `[{id, label, travelerIds[]}]` | |
| `meetup?` | `{dayId, placeId, label}` | |
| `replayMoments?` | | Retained for the disabled Replay. Ignore |

### 19.3 Event (day or stop)

`{id, number, title, date (display), calendarDate?, calendarEndDate? (city
mode), tagline?, text? (story; paragraphs separated by blank lines), placeId?,
destinationId?, segmentIds[] (ordered), planningStatus?: "confirmed"|"tbd",
groupPlaces?: {groupId: placeId}, photoOrder?: photoId[]}`

- An undated TBD event has no `calendarDate` and shows "TBD · Dates to
  decide".

### 19.4 Place

`{id, name, lat, lng, country?, cityBoundary?: GeoJSON Polygon|MultiPolygon}`

### 19.5 Leg

`{id, from, to, mode, distanceKm?, duration? (display), durationMinutes?,
durationMaxMinutes?, durationQualifier?, geometryStatus?:
"reconstructed"|"provisional", stops?: [{name, lat, lng}], groupIds?}`

- The route line is `routes[id]`: encoded polyline → `[[lng,lat],…]`.
- A leg inherits its planning status from its event.

### 19.6 Photo

| Field | Notes |
| --- | --- |
| `id`, `dayId` | Event assignment; album order comes from `Event.photoOrder` |
| `src`, `srcset: [{src, width, height?}]`, `width`, `height` | Thumbnail (≈480) / preview (≈1280) / full (≤3200) WebP |
| `fullAvif?: {src, width, height}` | Original-resolution viewer image |
| `blur` | Tiny embedded `data:` preview |
| `protected?` | Requires access (§18.3) |
| `caption`, `description` | Traveler-written; often empty |
| `alt` | Accessibility only, never shown as a caption |
| `takenAt?` | `YYYY-MM-DD · HH:MM[:SS]` camera-local wall time |
| `lat?`, `lng?`, `zoom?`, `mapFrame?: {bounds}` | Exact pin and separately composed frame |
| `locationLabel?` | Traveler-written |
| `groupIds?` | Audience |

### 19.7 Video

`{id, dayId, title, caption, src, poster?, durationSeconds, width?, height?,
mimeType, visibility: "private"|"public", protected?, takenAt?, credit?,
creditUrl?, transcript?, captions?: [{start, end, text}], captionLanguage?,
groupIds?}`

### 19.8 Point of interest (curated Place)

`{id, name, category: "food"|"sight", coordinates, locationAccuracy:
"approximate"|"verified", status: "visited"|"saved", dayIds[], summary, note?,
address?, mapsUrl?, sources: [{label, url}], images?: [{src, alt, credit,
sourceUrl, permission, licenseUrl?}], reviews?: [{authorId, authorName,
rating 1–5, text}], photoIds?: photoId[] (explicit links only), sample?}`

- The average rating and the distribution are computed by the front end.

## 20. Keeping this spec current

This document describes current shared behaviour. Any change to visitor-facing
UX, copy, controls, states or the front-end API updates the affected section
here in the same change, alongside [FEATURES.md](FEATURES.md) and the owning
decision or workflow. The ownership map is in
[OWNER_DECISIONS.md](OWNER_DECISIONS.md#record-the-next-correction-before-closing-the-task).
Owner decisions remain the authority. When they change, revise this spec to
match; do not treat this spec as a competing source.
