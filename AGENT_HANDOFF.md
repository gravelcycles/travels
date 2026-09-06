# Journey Atlas — GitHub Pages handoff

This bundle contains the complete static Journey Atlas site. It does not need
Node, npm, a build command, a database, or API keys.

## Task for the receiving agent

Integrate this bundle into the user's chosen GitHub repository and publish it
with GitHub Pages.

1. Inspect the target repository before writing. Preserve unrelated files,
   existing workflows, branch rules, and the repository's current structure.
2. Copy the bundle's `dist/` directory into the repository. The deployed
   artifact must have `dist/index.html` and `dist/assets/` intact.
3. Add `.github/workflows/journey-atlas-pages.yml`. If the repository already
   has a Pages workflow, merge the `path: ./dist` behavior into it instead of
   creating competing deployments.
4. If the default branch is not `main`, change the workflow trigger to the
   actual default branch.
5. In GitHub, set **Settings → Pages → Build and deployment → Source** to
   **GitHub Actions** if it is not already configured that way.
6. Commit and push the exact integrated files. Confirm that the Pages workflow
   succeeds and return the resulting `github.io` URL to the user.

Do not copy ChatGPT Sites metadata, credentials, or `.openai/hosting.json` into
the GitHub repository. None are needed by this static site.

## Important behavior to preserve

- All browser paths are relative, so the site works at
  `https://USERNAME.github.io/REPOSITORY/` as well as at a custom domain.
- The map uses MapLibre and OpenFreeMap Positron from public HTTPS endpoints.
- The client removes road/highway and POI layers from the basemap.
- Journey content is day-based and lives in `dist/assets/journeys.js`.
- Photos live in `dist/assets/photos/` or can use public HTTPS URLs.
- The fullscreen chronological photo viewer makes the map follow each photo's
  GPS position and corresponding day.

## Editing trips later

Edit `dist/assets/journeys.js` to add journeys, days, places, route segments,
text, and photo metadata. Put optimized WebP or AVIF copies in
`dist/assets/photos/`. Keep original full-resolution photos somewhere else.

After any push to the configured default branch, the included workflow uploads
the contents of `dist/` and republishes the Pages site automatically.

## Privacy warning

GitHub Pages websites are public on the internet, even when a plan permits the
source repository itself to be private. Remove private photographs, addresses,
EXIF details, or other sensitive travel information before publishing.
