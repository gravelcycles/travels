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

The conversation's interactive review compares Photo tray and Current card
using existing Alpine demo content. It demonstrates selection, ordinary arrows,
event grid, fullscreen/Back and clearing selection. It is a design mockup, not
a second viewer implementation or a publication request. Before implementation,
settle this direction with the owner, then verify real map bubbles, portrait/
landscape photos, long titles, 320/390px and landscape, reference/demo/fresh city
draft, protected-image loading and browser history in the shared components.
