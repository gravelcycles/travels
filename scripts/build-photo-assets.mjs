#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import exifr from "exifr";
import sharp from "sharp";

const sourceDirectory = path.resolve(process.argv[2] || "photos/switzerland-italy-trip");
const outputDirectory = path.resolve(process.argv[3] || "build/trip-photos-v1");
const manifestPath = path.resolve(process.argv[4] || "dist/assets/trip-photos.js");
const releaseTag = process.env.TRIP_PHOTO_RELEASE_TAG || "trip-photos-v1";
const releaseBase = `https://github.com/gravelcycles/travels/releases/download/${releaseTag}`;
const widths = [480, 1280, 2560, 3200];
const buildRoot = path.resolve("build");
if (!outputDirectory.startsWith(`${buildRoot}${path.sep}`)) {
  throw new Error(`Photo output must stay inside ${buildRoot}`);
}
const context = { window: {} };
vm.runInNewContext(fs.readFileSync("dist/assets/journeys.js", "utf8"), context);
const data = context.window.JOURNEY_ATLAS_DATA;
const journey = data.journeys.find((item) => item.id === data.defaultJourneyId);
const monthNumber = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };
const daysByDate = new Map(journey.days.map((day) => {
  const [dayNumber, month] = day.date.split(" ");
  return [`2026-${monthNumber[month]}-${dayNumber.padStart(2, "0")}`, day];
}));

function localDateParts(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

function slugFor(filename) {
  return path.basename(filename, path.extname(filename)).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function publicUrl(filename) {
  return `${releaseBase}/${encodeURIComponent(filename)}`;
}

fs.rmSync(outputDirectory, { recursive: true, force: true });
fs.mkdirSync(outputDirectory, { recursive: true });
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "travels-photos-"));
const files = fs.readdirSync(sourceDirectory)
  .filter((filename) => /\.(heic|heif|jpe?g|png)$/i.test(filename))
  .sort((a, b) => a.localeCompare(b));
const videos = fs.readdirSync(sourceDirectory).filter((filename) => /\.mov$/i.test(filename)).sort();
const photos = [];
const excluded = [];
const errors = [];

try {
  for (let index = 0; index < files.length; index += 1) {
    const filename = files[index];
    const sourcePath = path.join(sourceDirectory, filename);
    try {
      const metadata = await exifr.parse(sourcePath, {
        pick: ["DateTimeOriginal", "CreateDate", "latitude", "longitude", "Orientation"]
      }) || {};
      const capturedAt = metadata.DateTimeOriginal || metadata.CreateDate;
      if (!(capturedAt instanceof Date) || Number.isNaN(capturedAt.valueOf())) {
        excluded.push({ filename, reason: "No capture date" });
        continue;
      }
      const local = localDateParts(capturedAt);
      const day = daysByDate.get(local.date);
      if (!day) {
        excluded.push({ filename, capturedAt: `${local.date} ${local.time}`, reason: "Outside the 13–26 August trip" });
        continue;
      }

      const slug = slugFor(filename);
      execFileSync("/usr/bin/qlmanage", ["-t", "-s", "3200", "-o", temporaryDirectory, sourcePath], { stdio: "ignore" });
      const temporaryImage = path.join(temporaryDirectory, `${filename}.png`);
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
        const outputPath = path.join(outputDirectory, outputFilename);
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
        id: `family-${slug}`,
        dayId: day.id,
        src: largest.src,
        srcset: variants.map(({ src, width }) => ({ src, width })),
        blur: `data:image/webp;base64,${blurBuffer.toString("base64")}`,
        width: largest.width,
        height: largest.height,
        alt: `Family trip photograph from ${destination?.name || day.title}`,
        caption: `${day.title} · ${local.time}`,
        takenAt: `${day.date} · ${local.time}`,
        sourceFilename: filename
      };
      if (Number.isFinite(metadata.latitude) && Number.isFinite(metadata.longitude)) {
        photo.lat = Number(metadata.latitude.toFixed(6));
        photo.lng = Number(metadata.longitude.toFixed(6));
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
const manifest = `/* Generated by scripts/build-photo-assets.mjs; originals remain private and ignored. */\nwindow.JOURNEY_ATLAS_TRIP_PHOTOS = ${JSON.stringify(photos)};\n`;
fs.writeFileSync(manifestPath, manifest);
const report = {
  generatedAt: new Date().toISOString(),
  releaseTag,
  sourceDirectory,
  outputDirectory,
  stillsFound: files.length,
  photosBuilt: photos.length,
  excluded,
  errors,
  videosNotProcessed: videos
};
fs.writeFileSync(path.join(outputDirectory, "build-report.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(`Built ${photos.length} photos; excluded ${excluded.length}; errors ${errors.length}; videos held ${videos.length}.`);
console.log(`Manifest: ${manifestPath}`);
console.log(`Release assets: ${outputDirectory}`);
if (errors.length) process.exitCode = 1;
