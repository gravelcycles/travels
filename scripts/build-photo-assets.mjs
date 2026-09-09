#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import exifr from "exifr";
import sharp from "sharp";

import { fileURLToPath } from "node:url";
import { loadJourneys, writeJson } from "./journey-content.mjs";
import { photoImportConfig, captureDateParts } from "./photo-import-config.mjs";
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const options = {};
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i += 2) {
  if (!["--journey", "--source", "--release", "--timezone"].includes(args[i]) || !args[i + 1]) throw new Error("Usage: npm run photos:build -- --journey <id> [--source private-folder] [--release immutable-tag] [--timezone Area/City]");
  options[args[i].slice(2)] = args[i + 1];
}
const { journey, releaseTag, idPrefix, timeZone, daysByDate, sourceDirectory, outputDirectory, manifestPath } = photoImportConfig(repoRoot, loadJourneys(repoRoot, { includeDrafts: true }), options);
const releaseBase = `https://github.com/gravelcycles/travels/releases/download/${releaseTag}`;
const widths = [480, 1280, 2560, 3200];
fs.mkdirSync(path.join(repoRoot, "build"), { recursive: true });
const stagingDirectory = fs.mkdtempSync(path.join(repoRoot, "build", "photo-staging-"));

function slugFor(filename) {
  return path.basename(filename, path.extname(filename)).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function publicUrl(filename) {
  return `${releaseBase}/${encodeURIComponent(filename)}`;
}

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "travels-photos-"));
const files = fs.readdirSync(sourceDirectory)
  .filter((filename) => /\.(heic|heif|jpe?g|png)$/i.test(filename))
  .sort((a, b) => a.localeCompare(b));
const videos = fs.readdirSync(sourceDirectory).filter((filename) => /\.mov$/i.test(filename)).sort();
const photos = [];
const excluded = [];
const errors = [];
const candidateLocations = [];
const photoIds = new Set();

try {
  for (let index = 0; index < files.length; index += 1) {
    const filename = files[index];
    const sourcePath = path.join(sourceDirectory, filename);
    try {
      const metadata = await exifr.parse(sourcePath, {
        reviveValues: false,
        pick: ["DateTimeOriginal", "CreateDate", "OffsetTimeOriginal", "OffsetTimeDigitized", "latitude", "longitude", "Orientation"]
      }) || {};
      const local = captureDateParts(metadata, timeZone);
      const day = daysByDate.get(local.date);
      if (!day) {
        excluded.push({ filename, capturedAt: `${local.date} ${local.time}`, reason: "Outside the journey calendar dates" });
        continue;
      }

      const slug = slugFor(filename);
      if (photoIds.has(slug)) throw new Error(`Duplicate photo filename slug: ${slug}`);
      photoIds.add(slug);
      const temporaryImage = path.join(temporaryDirectory, `${filename}.png`);
      if (/\.(heic|heif)$/i.test(filename)) execFileSync("/usr/bin/qlmanage", ["-t", "-s", "3200", "-o", temporaryDirectory, sourcePath], { stdio: "ignore" });
      else await sharp(sourcePath).rotate().png().toFile(temporaryImage);
      const decoded = await sharp(temporaryImage).metadata();
      const displayWidth = decoded.autoOrient?.width || decoded.width;
      const displayHeight = decoded.autoOrient?.height || decoded.height;
      if (!displayWidth || !displayHeight) throw new Error("Decoded image has no dimensions");
      const statistics = await sharp(temporaryImage).stats();
      if (statistics.entropy < 0.05) throw new Error("Decoded image is effectively blank");

      const outputWidths = [...new Set(widths.map((width) => Math.min(width, displayWidth)).filter((width) => width >= 320))].sort((a, b) => a - b);
      const variants = [];
      for (const width of outputWidths) {
        const outputFilename = `${slug}-w${width}.webp`;
        const outputPath = path.join(stagingDirectory, outputFilename);
        const result = await sharp(temporaryImage)
          .resize({ width, withoutEnlargement: true })
          .webp({ quality: width <= 480 ? 78 : 84, effort: 5, smartSubsample: true })
          .toFile(outputPath);
        variants.push({ src: publicUrl(outputFilename), width: result.width, height: result.height, bytes: result.size });
      }

      const blurBuffer = await sharp(temporaryImage)
        .resize({ width: 32 })
        .blur(1.1)
        .webp({ quality: 28, effort: 4 })
        .toBuffer();
      const largest = variants[variants.length - 1];
      const destination = journey.places.find((place) => place.id === (day.destinationId || day.placeId));
      const photo = {
        id: `${idPrefix}-${slug}`,
        dayId: day.id,
        src: largest.src,
        srcset: variants.map(({ src, width }) => ({ src, width })),
        blur: `data:image/webp;base64,${blurBuffer.toString("base64")}`,
        width: largest.width,
        height: largest.height,
        alt: `Trip photograph from ${destination?.name || day.title}`,
        caption: "",
        description: "",
        captionSource: "camera-import",
        takenAt: `${day.date} · ${local.time}`,
        sourceFilename: filename
      };
      if (Number.isFinite(metadata.latitude) && Number.isFinite(metadata.longitude)) {
        candidateLocations.push({ id: photo.id, lat: metadata.latitude, lng: metadata.longitude });
      }
      photos.push(photo);
      fs.rmSync(temporaryImage, { force: true });
      const totalBytes = variants.reduce((sum, item) => sum + item.bytes, 0);
      console.log(`[${index + 1}/${files.length}] ${filename} → day ${day.number}, ${variants.length} sizes, ${(totalBytes / 1024 / 1024).toFixed(1)} MB`);
    } catch (error) {
      errors.push({ filename, reason: error.message });
      console.warn(`[${index + 1}/${files.length}] ${filename} skipped: ${error.message}`);
    }
  }
} finally {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}

photos.sort((a, b) => journey.days.findIndex((day) => day.id === a.dayId) - journey.days.findIndex((day) => day.id === b.dayId) || a.takenAt.localeCompare(b.takenAt));

const report = {
  generatedAt: new Date().toISOString(),
  releaseTag,
  sourceDirectory,
  outputDirectory,
  stillsFound: files.length,
  photosBuilt: photos.length,
  excluded,
  errors,
  candidateLocations,
  videosNotProcessed: videos
};
fs.writeFileSync(path.join(stagingDirectory, "build-report.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(`Built ${photos.length} photos; excluded ${excluded.length}; errors ${errors.length}; videos held ${videos.length}.`);
console.log(`Manifest: ${manifestPath}`);
console.log(`Release assets: ${outputDirectory}`);
if (errors.length || !photos.length) {
  console.error(`Existing derivatives and manifest retained. Review ${stagingDirectory}/build-report.json`);
  process.exitCode = 1;
} else {
  // Keep the previous successful build available for recovery.
  if (fs.existsSync(outputDirectory)) fs.renameSync(outputDirectory, `${outputDirectory}-backup-${Date.now()}`);
  fs.renameSync(stagingDirectory, outputDirectory);
  writeJson(manifestPath, photos);
  console.log("Review the manifest and derivative assets, then run npm run build. GPS candidates remain in the private build report.");
}
