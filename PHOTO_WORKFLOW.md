# iPhone photo workflow

The atlas can use an iPhone photo's capture time and GPS position to associate
it with a day and place it on the map. Preserve the original metadata during
transfer, then publish a separate web-sized copy.

## Best transfer from iPhone

1. In Photos, select the images and open the Share sheet.
2. Tap **Options**.
3. Leave **Location** enabled and turn on **All Photos Data**.
4. AirDrop the selection to the Mac, or create an iCloud link and download the
   originals before that link expires.
5. Put the untouched originals in a private folder or archive—not in this
   public repository.

If the images are already in Photos on the Mac, select them and use
**File → Export → Export Unmodified Original**. Avoid screenshots and social or
messaging-app downloads; they may omit or rewrite EXIF metadata.

## What to send for atlas import

- Prefer the original HEIC/JPEG files in a ZIP archive.
- Do not resize, convert, or strip location before sending.
- If Photos shows no location for an image, add or correct it there first, or
  provide the intended day/place alongside the filename.
- Include only images you are comfortable using for the project.

## Safe publishing pipeline

For each selected original:

1. Read capture time, GPS latitude/longitude, orientation, and caption.
2. Suggest its matching journey day and map position for review.
3. Create a 1600–2000 px WebP/AVIF derivative for the website.
4. Store coordinates in `dist/assets/journeys.js`.
5. Strip sensitive EXIF metadata from the public derivative unless explicitly
   needed in the downloadable file.
6. Commit only the derivative; retain the original privately.

This keeps location-aware behavior in the atlas without publishing the full
original photo metadata.

## Apple references

- [Share photos and videos on iPhone](https://support.apple.com/guide/iphone/iphf28f17237/ios)
- [Export unmodified originals from Photos on Mac](https://support.apple.com/guide/photos/pht6e157c5f/mac)
- [Review or adjust photo information on iPhone](https://support.apple.com/guide/iphone/iph0edb9c18f/ios)
