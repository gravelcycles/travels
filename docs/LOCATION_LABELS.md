# Map pins — design decision, 10 September 2026

Use small, anchored balloon pins with a day number, and quiet unnumbered dots
for repeated stays or nearby places. Reveal names and visits in one compact
card on hover, keyboard focus or an explicit repeat-stop tap. The landscape,
route and basemap names remain the main view. This replaces the destination
chips and their connector lines in shared viewer code; no trip-specific data
or offsets are required.

| Approach considered | Benefit | Decision |
| --- | --- | --- |
| Numbered balloons + repeat-stop dots | Familiar map shape, small footprint, direct day navigation | Chosen; names appear on demand |
| Dots everywhere | Quietest overview | Loses useful day orientation; used for repeats, clusters and tight placement |
| Permanent place/day chips | Names are always available | Too much visual weight and overlap for this landscape |

## Palette and connected interaction

Pins use muted slate teal `#426b73`, a white rim and white day number. The
selected stop is dark teal `#153238`; preview uses brighter teal `#167e97`.
Small shadows separate pins from terrain without an animated pulse. Existing
transport colors and line patterns retain their meaning.

Hovering a pin, route or day row previews the same day across all three:
matching routes strengthen, unrelated routes/pins recede, and matching day
rows gain a slim teal edge. Rest days highlight their stop and row even with
no travel line. Route sources promote their textual segment IDs so MapLibre
can apply the preview to rendered features. Preview does not select a day or
move the camera. A pin's
card opens after 140 ms; brief close delays allow pointer handoff into the
card. Only one place card appears at a time. It contains the place, day/date
and an Explore day action, or explicit visit choices for a repeat/cluster.
Card placement also prefers space away from the previewed route and controls.
The older route inspector appears only for explicit route inspection and is
also compact. Preview color changes are subtle; reduced motion disables pin
transitions.

Desktop pin targets are 32 px; phone/coarse-pointer targets are 44 px while
the visual shape stays small. Single-day click/tap opens that day directly.
Repeat/nearby-place taps open a scrollable, labelled day picker. Close,
Escape, map movement or clicking outside dismiss the card; Escape returns
focus without immediately reopening it. Native buttons have descriptive
accessible names and selected/expanded states. Keyboard focus also previews;
phones require no hover or preliminary tooltip tap. Day selection restores
focus to the selected pin after the camera settles, if that pin is visible.

## Placement and density

Pin tips and dots use reviewed arrival coordinates (departure/place fallback
for other days). Try four balloon orientations while keeping the tip on its
coordinate and the number upright. Prefer a clear round body away from route
strokes; the tip or dot intentionally touches the actual route location.
Use a dot when no balloon fits. Protect viewport edges, controls and other
pin hit targets. Offscreen places are not pulled into the viewport.

Nearby screen positions share one quiet dot and retain all member places and
days in its picker. The selected place anchors a cluster when present. Zoom
separates clusters naturally. Pins remain attached during camera movement;
clustering and orientation settle on move end or resize. Nearby journey stops
remain available in day focus, with the selected stop distinguished. Group
filtering uses the current projected journey. Unknown places and empty drafts
invent no markers. Whole-trip framing leaves room above the legend.

Dense or edge views can still omit pins when a legal hit target does not fit;
all days remain reachable through navigation. Basemap glyph collision is not
exact: these HTML pins do not participate in the provider's symbol collision
index. Small footprints limit coverage, and route-body avoidance is a
preference rather than an impossible guarantee at busy junctions.

## Research

- [Apple map annotations](https://developer.apple.com/library/archive/documentation/UserExperience/Conceptual/LocationAwarenessPG/AnnotatingMaps/AnnotatingMaps.html) separates small geographic annotations from callouts that reveal details. This informed the quiet resting state and details on demand.
- [MapKit annotations](https://developer.apple.com/documentation/mapkit/mapkit-annotations) includes clustering overlapping annotations. The implementation uses screen-space clusters without adding a map dependency.
- [Google advanced marker reference](https://developers.google.com/maps/documentation/javascript/reference/advanced-markers) describes balloon shapes and glyphs, informing the small numbered silhouette.
- [Google accessible markers](https://developers.google.com/maps/documentation/javascript/advanced-markers/accessible-markers) informed descriptive button names, keyboard activation, focus return and generous hit targets.
- [W3C hover/focus content](https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html) informed dismissible, hoverable previews and pointer handoff.

- [MapLibre source IDs](https://maplibre.org/maplibre-style-spec/sources/#promoteid) documents the property used to identify rendered features for state-driven highlighting.

## Validation

Automated checks cover the reference trip and every demo at desktop, 390 px
and 320 px map sizes; reviewed anchors, clustering/day conservation,
route/control placement, preview ownership and actual mouse/keyboard/touch
controller behavior; and an empty then populated fresh draft using the shared
hashed script. Browser review uses a local map-only preview with private
photo/auth delivery omitted, plus reference/demo/fresh-draft checks on desktop
and phone. Public HTML and script freshness are checked after deployment.
