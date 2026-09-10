# Location labels — design decision, 10 September 2026

Use a compact destination chip: **Day 3 · Bern**. A small day identifier and a
stronger place name connect geography with the journal. This is shared viewer
behavior, driven entirely by the selected journey's data.

| Approach considered | Benefit | Tradeoff / decision |
| --- | --- | --- |
| Number-only circles | Smallest footprint; familiar previous behavior | Requires remembering places or hovering; retained only as a compact text fallback |
| Place name + day chip | Geography and navigation are visible together | Needs measured collision placement; chosen |
| Basemap-style text with a halo | Quiet, map-native appearance | Weak button affordance and small touch targets; built-in symbol collision does not provide the DOM control/day chooser behavior needed here |

## Palette and interaction

Warm ivory `#fbfaf6`, dark teal `#153238`, secondary teal `#39575c`, and a slate
border `#587579` fit the existing atlas. Main text contrast is **13.01:1**;
secondary day text is **7.47:1** against ivory. Selection reverses ivory/teal
and exposes `aria-current`; transport colors retain their existing meaning.
No orange focus ring or animated halo is added.

Desktop targets are 32 px high; phone/coarse-pointer targets are 44 px, with
a 44 px minimum width. One-day labels open that day and its map in one action.
Repeat locations open a labelled, scrollable day chooser instead of silently
cycling visits. Escape/Close dismiss it; Escape returns focus to the trigger.
Day selection moves focus to the new selected label once the camera settles.
Full names/dates and the action are available to assistive technology and in
native desktop title tooltips. There is no hover-only action or required
first-tap tooltip on phones.

## Placement and density

Measure the actual rendered full and compact chip sizes. Try alternate sides
of the reviewed arrival coordinate, testing complete route segments plus their
visible stroke/halo, existing label boxes, controls, and viewport bounds. Rank
legal candidates by distance, name visibility and a softer basemap-text cost.
Place the selected destination first. Prefer nearby compact labels over long
name callouts; when no position fits, omit that label until zoom provides space.
The complete day list remains available. Offscreen places are not pulled onto
the viewport. Fine, neutral association lines connect displaced labels to their
actual points; they are not transport lines and do not intercept clicks.

While panning/zooming, labels hide and reappear at settled placements. This
avoids oscillating callouts during animation without running expensive DOM
measurement/basemap queries on every frame. Day focus shows only the selected
day's destinations. Rest days work; empty drafts invent neither labels nor
locations. Group filtering uses the same projected journey and excludes other
groups' destinations.

Basemap text collision is a best-effort penalty, not a guarantee: MapLibre's
rendered-feature queries do not expose exact individual glyph rectangles to
these DOM controls. Route/control/label collision is a hard constraint. Dense
phone overviews may omit some optional labels; zoom or the day picker exposes
them. At very tight/edge views even the selected label may be omitted rather
than cover the route. The navigator remains available.

## Research

- [MapLibre symbol layout](https://maplibre.org/maplibre-style-spec/layers/#text-variable-anchor) documents alternative anchors, text padding and priority. These informed the candidate-placement policy; the implementation uses measured HTML controls to preserve native button semantics and touch sizing.
- [Mapbox collision design](https://github.com/mapbox/mapbox-gl-native/wiki/Collision-Detection) describes prioritization, stability and choosing a subset when all labels cannot fit. This is design background, not a new dependency.
- [W3C target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) specifies a 24 px minimum with exceptions; we use the more generous 44 px phone target.
- [W3C text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) informs the palette's measured contrast.
- [W3C hover/focus content](https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html) informed the choice to keep essential names/actions in the control and avoid a custom hover popup.

## Validation

Automated checks cover the reference trip and every demo at desktop, 390 px and
320 px map sizes, sparse/zero-length line clipping, repeated stays, reviewed
arrival anchors, offscreen/culling behavior, and an empty then populated fresh
draft with the shared, hashed script asset. UI checks use a local map-only
preview with photos/auth removed after automatic browser approval review
blocked the private photo origin; production photo access is unchanged.
