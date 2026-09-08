import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadJourneys, validateJourneys, calendarDate, validId, writeJson } from "./journey-content.mjs";

export function createJourney(root, { title, slug, startDate, endDate, timeZone = "UTC" }) {
  if (typeof title !== "string" || !title.trim() || title.length > 160) throw new Error("Give the trip a name (up to 160 characters)");
  const base = slug || title.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!validId(base) || base.length > 90 || ["index", "demo", "404"].includes(base)) throw new Error("Choose a URL name using letters, numbers, and hyphens");
  new Intl.DateTimeFormat("en", { timeZone });
  const start = calendarDate(startDate), end = calendarDate(endDate);
  const count = (end - start) / 86400000 + 1;
  if (count < 1 || count > 366) throw new Error("End date must be on or after the start, with at most 366 days");
  const data = loadJourneys(root, { includeDrafts: true });
  const id = base;
  if (data.journeys.some(j => j.id === id || j.slug === `${base}.html`)) throw new Error("A trip already uses this URL name; choose a different name");
  const days = Array.from({ length: count }, (_, i) => {
    const date = new Date(+start + i * 86400000);
    return { id: `${id}-d${i + 1}`, number: i + 1, calendarDate: date.toISOString().slice(0, 10), date: new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(date), title: "Day to plan", text: "", segmentIds: [] };
  });
  const journey = { id, kind: "real", published: false, slug: `${base}.html`, status: "planned", badge: "PLANNING", label: title.trim(), title: title.trim(), subtitle: "A new journey taking shape, one day at a time.", kicker: "UPCOMING JOURNEY", dates: `${startDate} – ${endDate}`, startDate, endDate, timeZone, note: "Plans are provisional. Add places, routes, and notes as they become known.", cover: "", places: [], segments: [], days, photos: [] };
  validateJourneys({ ...data, journeys: [...data.journeys, journey] });
  const filename = path.join(root, `content/drafts/${id}.json`);
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, `${JSON.stringify(journey, null, 2)}\n`, { flag: "wx" });
  writeJson(path.join(root, `build/draft-assets/${id}/route-sources.json`), { schemaVersion: 1, journeyId: id, networks: {}, modeNetworks: {}, segments: {} });
  return journey;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = {};
    const args = process.argv.slice(2);
    for (let i = 0; i < args.length; i += 2) {
      const names = { "--title": "title", "--slug": "slug", "--start": "startDate", "--end": "endDate", "--timezone": "timeZone" };
      if (!names[args[i]] || !args[i + 1]) throw new Error('Usage: npm run journey:new -- --title "Trip name" --start YYYY-MM-DD --end YYYY-MM-DD [--slug stable-url] [--timezone Europe/Berlin]');
      options[names[args[i]]] = args[i + 1];
    }
    const journey = createJourney(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), options);
    console.log(`Created local draft ${journey.id} with ${journey.days.length} calendar days. Open Atlas Studio to start planning.`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
