import path from "node:path";
import { calendarDate, validId } from "./journey-content.mjs";

export function photoImportConfig(root, data, options = {}) {
  if (!options.journey) throw new Error("Select a journey with --journey <journey-id>");
  const journey = data.journeys.find(j => j.id === options.journey);
  if (!journey) throw new Error(`Unknown journey: ${options.journey}`);
  const config = journey.photoImport || {};
  const releaseTag = options.release || config.releaseTag || `${journey.id}-photos-v1`;
  if (!validId(releaseTag)) throw new Error("Release tag must use letters, numbers, and hyphens");
  for (const other of data.journeys) if (other.id !== journey.id && other.photoImport?.releaseTag === releaseTag) throw new Error(`Release tag already belongs to ${other.id}; use a journey-specific tag`);
  const idPrefix = config.idPrefix || journey.id;
  if (!validId(idPrefix)) throw new Error("Invalid photo ID prefix");
  const timeZone = options.timezone || journey.timeZone;
  if (!timeZone) throw new Error("Set the journey timeZone before importing photos");
  new Intl.DateTimeFormat("en", { timeZone });
  const daysByDate = new Map();
  for (const day of journey.days) {
    calendarDate(day.calendarDate);
    if (daysByDate.has(day.calendarDate)) throw new Error("Duplicate photo calendar date");
    daysByDate.set(day.calendarDate, day);
  }
  return { journey, releaseTag, idPrefix, timeZone, daysByDate,
    sourceDirectory: path.resolve(root, options.source || config.sourceDirectory || `photos/${journey.id}`),
    outputDirectory: path.join(root, "build", releaseTag),
    manifestPath: path.join(root, journey.published ? `content/photo-manifests/${journey.id}.json` : `build/draft-assets/${journey.id}/photos.json`) };
}
export function localDateParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}
