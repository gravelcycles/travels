# Site icon and sharing artwork

The shared mark is a white globe in a map pin with an orange tip, on route blue.
The palette is blue `#006f92`, white `#ffffff`, and orange `#d4512c`. It has no
destination dot. The same mark appears in catalog/journey headers, browser tabs,
Apple touch icons and the public link-preview card.

Edit `content/branding/icon.svg` and the matching embedded mark in `share.svg`.
The share illustration includes the Journey Atlas name and existing tagline.
Run `npm run branding:build` to render the 16/32 px PNG icons, 180 px touch icon,
and 1200 × 630 share PNG. Inspect actual small sizes and both light/dark tab
backgrounds. Review the share PNG after rendering; its Georgia/Arial text uses
the local font renderer. Commit these reviewed source rasters as well as SVGs.

`npm run build` copies the reviewed assets to `dist/assets/brand/` verbatim,
so ordinary builds and CI do not depend on installed fonts. The shared build
inserts icon links and metadata through `{{siteHead}}` in both templates and
hashes asset URLs. The site's public URL and generic copy live in
`content/site.json`; all browser asset paths remain relative for subpath hosting.
Open Graph/Twitter image URLs are absolute. Journey metadata uses the source
title/subtitle and stable public slug; the sample uses `demo.html`. Local draft
previews inherit the assets and omit the public page URL.

New journeys need no icon setup. The share artwork is public branding and uses
no protected photographs. Existing low-discovery robots directives stay intact.
Third-party link previews may retain cached artwork; the site supplies metadata,
while each sharing client decides when and how to display it.

After changes, run `npm test` and `npm run build`, include generated public
output, follow [DEPLOYMENT.md](DEPLOYMENT.md), and verify fresh public pages and
image URLs. The framework regression checks cover the catalog, Switzerland–Italy,
a demo and a fresh draft, plus image dimensions and escaped metadata.

Metadata follows the [Open Graph protocol](https://ogp.me/) and browser
[icon link conventions](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/rel#icon).
