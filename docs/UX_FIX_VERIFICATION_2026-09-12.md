# UX fixes — verification record

Scope: audit findings B1/B2, V2–V7, C1–C7 and Q1–Q5. **V1 is excluded by the
owner.** The six feature proposals are held for local demonstration and review;
no new feature is part of this deployment.

Implementation is based on remote main `e937dade`, in an isolated worktree so
existing work in the owner's checkout is preserved. All behavior stays shared
across journey instances. No published trip content or private media changed.

## Automated checks

`npm test`: **286 tests pass**. `npm run build`: succeeds, regenerated public
HTML included. New behavior tests cover delayed/duplicate/failed Studio saves,
full-geometry route Undo, filter selection, unused place references, blank Replay
sentences, round-trip labels, public image Retry, map failure/recovery, overlay
Back/Forward on phone and desktop, deferred grid images and cached neighbors.
Template checks cover the family trip, sample and a freshly generated draft;
secondary text contrast is checked against the panel and tinted panel colors.

## Browser checks

Isolated Studio and visitor previews on localhost, using 390 × 844,
834 × 1112 and 1280 × 800 layouts:

- Family album loads its protected full photograph through the local asset path;
  photo map and its controls work. No browser errors were recorded.
- Group/video sample's empty Day 3 opens its actual story instead of a grid.
- Album → grid → photo → browser Back restores the album; Forward restores the
  photo/location state. Replay also dismisses/restores through Back/Forward.
- Grid entry leaves the full-image source and both neighbor sources empty.
- Phone Details & location displays the authored caption.
- Desktop Close and photo-map Zoom in have **zero hitbox overlap** (Zoom in
  begins at y=75; Close ends at y=56 at 1280 × 800).
- A normally entered journey still displays its introduction after reload.
- Studio changes the photo editor from Day 1 to Day 2 with the day filter.
- Phone upload action is reachable inside the scroll panel; clicking it with no
  selected file returns the visible "Choose one or more photos first" message.
- Tablet Preview and save status are visible, and mode selection is exposed.
- An unused new place in the disposable draft can be removed; Check changes and
  Save trip plan locally succeed afterwards.
- Fresh empty-draft main and Replay maps show a no-location message. Adding a
  same-place walking loop without a day destination renders "Test trailhead ·
  day trip" and leaves the second unknown day as "Destination to plan".

Failure sequences (save races, public-image Retry and recovered maps) use
controlled automated tests. Native touch hardware, screen-reader speech and a
physical offline network were not simulated by these browser checks.

## Deployment

The deployment commit and successful GitHub Pages run are reported with the
user delivery. No proposed feature demo is included in `dist`.
