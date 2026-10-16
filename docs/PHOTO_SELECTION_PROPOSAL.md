# Photo selection tray — review proposal, 16 October 2026

The owner dislikes the “group of photos in this location spot” screen and asked
to explore simplifying/removing it. [O17's follow-up](OWNER_DECISIONS.md#comment-notifications--11-october-2026)
records the request separately from the approved notification-comment correction.
This proposal does not change the published card or O03's photo-entry boundary.

The current phone `#map-photo-card` sits above `.mobile-day-summary`. Its small
image competes with previous/count/next, Share, Locate, Comments, linked-place
context and Photo details. The event card below repeats context. Desktop uses
the same component inside its established right sidebar and should retain that
structure and its large, uncropped selected image.

Recommended phone direction: one selected-photo tray within the existing event
card. Keep the date/title once, make the selected photograph the dominant target,
and use two quiet neighboring event thumbnails for selection. Image activation
opens fullscreen; small thumbnails select without opening it. Keep the event
grid reachable, use ordinary journey browsing for arrows, and put Share, Locate
and photo details under More. Comments remain available in fullscreen. Clearing
selection returns to the event's resting card rather than adding a new screen.

Map clusters remain geographic groups. The proposal must not trap browsing
inside them. Desktop arrows already browse the visible journey; extending that
behavior to phone card arrows would be part of an approved implementation.
Explicit Places collections keep their scope, and About place still requires
an owner-saved link. Preserve arrival controls, Places, blank/authored copy,
photo access and same-event map camera return.

## Desktop and phone behavior — review clarification

The owner's later 16 October response was that the demo did not explain how
this works on desktop and mobile. The first mockup isolated a phone card and
omitted the surrounding map, desktop sidebar and return path. The revised
walkthrough must show where selection lives before asking for a design choice.

| Action | Desktop | Phone |
| --- | --- | --- |
| Select a map photo bubble | Update the existing right sidebar; days and map remain visible. | Replace the contents of the existing bottom event card with the photo tray, keeping the map visible. |
| Select a small thumbnail | Change the selected sidebar photo. | Change the selected tray photo. |
| Activate the large photo | Open the existing fullscreen viewer. | Open the existing fullscreen viewer. |
| Back from direct fullscreen entry | Return to the same sidebar selection and map context. | Return to the same bottom tray and map camera. |
| Enter fullscreen from a photo grid | Back returns to that presenting grid first. | Back returns to that presenting grid first. |
| Clear map-photo selection | Restore the existing day's sidebar lead/context. | Restore the resting event card with its Photos action. |

This is a proposal clarification, not approval to implement the tray. Desktop
keeps its three-column structure and large stable uncropped frame; the main
phone simplification is removing the second stacked card. The selection →
fullscreen boundary remains. A responsive comparison uses existing public demo
photos and simplified screen regions to demonstrate selection/open/Back and
grid return; it does not claim to be a functioning geographic map.

The conversation's interactive review compares Photo tray and Current card
using existing Alpine demo content. It demonstrates selection, ordinary arrows,
event grid, fullscreen/Back and clearing selection. It is a design mockup, not
a second viewer implementation or a publication request. Before implementation,
settle this direction with the owner, then verify real map bubbles, portrait/
landscape photos, long titles, 320/390px and landscape, reference/demo/fresh city
draft, protected-image loading and browser history in the shared components.
