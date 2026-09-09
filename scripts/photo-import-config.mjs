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

// Read EXIF with reviveValues:false. A naive camera clock is already local to
// the journey: never pass it through the host's Date parser or guess DST.
export function captureDateParts(metadata, timeZone) {
  const original = Boolean(metadata.DateTimeOriginal);
  const raw = original ? metadata.DateTimeOriginal : metadata.CreateDate;
  if (typeof raw !== "string") throw new Error("Missing raw camera capture date");
  const match = raw.trim().match(/^(\d{4})[:-](\d{2})[:-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?\s*(Z|[+-]\d{2}:?\d{2})?$/);
  if (!match) throw new Error("Invalid camera capture date");
  const [, year, month, day, hour, minute, second, embeddedOffset] = match;
  const date = `${year}-${month}-${day}`;
  calendarDate(date);
  if (+hour > 23 || +minute > 59 || +second > 59) throw new Error("Invalid camera capture time");
  const offset = embeddedOffset || (original ? metadata.OffsetTimeOriginal : metadata.OffsetTimeDigitized);
  if (!offset) return { date, time: `${hour}:${minute}`, rule: "camera-local" };
  if (typeof offset !== "string" || !/^(Z|[+-](?:0\d|1[0-4]):?[0-5]\d)$/.test(offset.trim())) throw new Error("Invalid camera UTC offset");
  const normalized = offset.trim().replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  const instant = new Date(`${date}T${hour}:${minute}:${second}${normalized}`);
  if (!Number.isFinite(+instant)) throw new Error("Invalid offset-aware capture date");
  return { ...localDateParts(instant, timeZone), rule: "explicit-offset" };
}
