import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { createJourney } from "../scripts/create-journey.mjs";
import { loadContent, validateJourneys, validateOverrides, writeJson } from "../scripts/journey-content.mjs";
import { buildSite, renderJourneyPage } from "../scripts/build-site.mjs";
import { photoImportConfig, localDateParts } from "../scripts/photo-import-config.mjs";
const repo = path.resolve(import.meta.dirname, "..");
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "atlas-build-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.cpSync(path.join(repo, "content"), path.join(root, "content"), { recursive: true, filter: source => !source.includes(`${path.sep}drafts`) });
  fs.cpSync(path.join(repo, "dist"), path.join(root, "dist"), { recursive: true });
  return root;
}
const input = { title: "Future trip", startDate: "2027-12-30", endDate: "2028-01-02", timeZone: "Asia/Tokyo" };
function generated(root, file, key) {
  const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync(path.join(root, `dist/assets/${file}.js`), "utf8"), ctx);
  return JSON.parse(JSON.stringify(ctx.window[key]));
}
test("creates complete year-crossing and leap-day drafts with stable IDs and no invented places", t => {
  const root = fixture(t), j = createJourney(root, input);
  assert.deepEqual(j.days.map(d => d.calendarDate), ["2027-12-30", "2027-12-31", "2028-01-01", "2028-01-02"]);
  assert.equal(j.published, false); assert.equal(j.places.length, 0); assert.equal(j.segments.length, 0);
  const leap = createJourney(root, { ...input, title: "Leap trip", startDate: "2028-02-28", endDate: "2028-03-01" });
  assert.equal(leap.days[1].calendarDate, "2028-02-29");
  assert.throws(() => createJourney(root, input), /already uses/);
  assert.throws(() => createJourney(root, { ...input, startDate: "2027-02-29" }), /Invalid calendar/);
  assert.throws(() => createJourney(root, { ...input, endDate: "2027-12-29" }), /End date/);
  assert.throws(() => createJourney(root, { ...input, slug: "../escape" }), /URL name/);
});
test("build keeps drafts and draft edits out of all public data; repeat builds are byte-identical", t => {
  const root = fixture(t), j = createJourney(root, input);
  writeJson(path.join(root, "build/studio-draft-overrides.json"), { days: { [j.days[0].id]: { title: "Private draft title" } }, routes: {}, photos: {} });
  const result = buildSite(root);
  assert.equal(result.drafts, 1);
  assert.match(fs.readFileSync(path.join(root, "dist/demo.html"), "utf8"), /assets\/trip-photos\.js/);
  assert.equal(generated(root, "trip-photos", "JOURNEY_ATLAS_PHOTOS")["alpine-crossing"].length, 3);
  const names = [...fs.readdirSync(path.join(root, "dist/assets")).filter(f => f.endsWith(".js")).map(f => `assets/${f}`), ...result.pages, "index.html", "demo.html"];
  const first = names.map(f => fs.readFileSync(path.join(root, "dist", f), "utf8"));
  for (const text of first) { assert.ok(!text.includes(j.id)); assert.ok(!text.includes("Private draft title")); }
  buildSite(root);
  assert.deepEqual(names.map(f => fs.readFileSync(path.join(root, "dist", f), "utf8")), first);
  const preview = renderJourneyPage(root, j, { preview: true });
  assert.match(preview, /\/api\/preview-assets\/journeys.js/);
  assert.match(preview, /noindex, nofollow/);
});
test("publishes a reviewed second journey with independent photos, escaped page metadata, and stable URL", t => {
  const root = fixture(t), j = createJourney(root, { ...input, title: 'Future <trip> & "friends"' });
  fs.unlinkSync(path.join(root, `content/drafts/${j.id}.json`));
  j.published = true;
  writeJson(path.join(root, `content/journeys/${j.id}.json`), j);
  writeJson(path.join(root, `content/photo-manifests/${j.id}.json`), [{ id: `${j.id}-photo`, dayId: j.days[0].id, src: "https://example.com/photo.webp" }]);
  buildSite(root);
  const photos = generated(root, "trip-photos", "JOURNEY_ATLAS_PHOTOS");
  assert.equal(photos[j.id].length, 1); assert.equal(photos["switzerland-italy-family-2026"].length, 95);
  assert.match(fs.readFileSync(path.join(root, "dist", j.slug), "utf8"), /Future &lt;trip&gt; &amp; &quot;friends&quot;/);
  assert.ok(generated(root, "journeys", "JOURNEY_ATLAS_DATA").journeys.some(x => x.slug === j.slug));
});
test("invalid IDs, references, and foreign overrides fail before changing public output", t => {
  const root = fixture(t), { data } = loadContent(root);
  const j = data.journeys[0];
  const duplicate = structuredClone(data); duplicate.journeys[1].days[0].id = j.days[0].id;
  assert.throws(() => validateJourneys(duplicate), /duplicate days ID/);
  const broken = structuredClone(data); broken.journeys[0].days[0].segmentIds.push("missing");
  assert.throws(() => validateJourneys(broken), /unknown or multiply/);
  const state = { photos: { [j.photos[0].id]: { dayId: data.journeys[1].days[0].id } }, routes: {}, days: {} };
  assert.throws(() => validateOverrides(state, data), /another journey/);
  assert.throws(() => validateOverrides({ ...state, photos: {}, days: { unknown: { title: "bad" } } }, data), /Unknown days/);
  const before = fs.readFileSync(path.join(root, "dist/assets/journeys.js"), "utf8");
  writeJson(path.join(root, "content/day-overrides.json"), { unknown: { title: "bad" } });
  assert.throws(() => buildSite(root), /Unknown days/);
  assert.equal(fs.readFileSync(path.join(root, "dist/assets/journeys.js"), "utf8"), before);
});
test("photo intake uses the chosen journey's calendar, time zone, IDs, and isolated outputs", t => {
  const root = fixture(t), j = createJourney(root, input);
  const { data } = loadContent(root, { includeDrafts: true });
  const config = photoImportConfig(root, data, { journey: j.id });
  assert.equal(config.daysByDate.get("2028-01-01").id, `${j.id}-d3`);
  assert.equal(config.idPrefix, j.id); assert.match(config.manifestPath, /build\/draft-assets\/future-trip\/photos.json$/);
  assert.equal(localDateParts(new Date("2027-12-31T16:00:00Z"), config.timeZone).date, "2028-01-01");
  assert.throws(() => photoImportConfig(root, data), /Select a journey/);
});
test("validates daily photo order and lead-photo ownership", () => {
  const { data } = loadContent(repo);
  const journey = data.journeys.find(item => item.id === "switzerland-italy-family-2026");
  const day = journey.days.find(item => item.id === "family-d1");
  const photos = journey.photos.filter(photo => photo.dayId === day.id).map(photo => photo.id);
  assert.doesNotThrow(() => validateOverrides({ photos: {}, routes: {}, days: { [day.id]: { photoOrder: photos, leadPhotoId: photos[1] } } }, data));
  assert.throws(() => validateOverrides({ photos: {}, routes: {}, days: { [day.id]: { photoOrder: [photos[0], photos[0]] } } }, data), /unique photo IDs/);
  assert.throws(() => validateOverrides({ photos: {}, routes: {}, days: { [day.id]: { leadPhotoId: journey.photos.find(photo => photo.dayId !== day.id).id } } }, data), /another day/);
});
test("the family photo review covers every source photo and excludes hidden media from the public build", t => {
  const root = fixture(t);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "content/photo-manifests/switzerland-italy-family-2026.json"), "utf8"));
  const reviews = JSON.parse(fs.readFileSync(path.join(root, "content/photo-overrides.json"), "utf8"));
  const dayOverrides = JSON.parse(fs.readFileSync(path.join(root, "content/day-overrides.json"), "utf8"));
  assert.equal(manifest.length, 104);
  assert.deepEqual(new Set(Object.keys(reviews)), new Set(manifest.map(photo => photo.id)));
  for (const review of Object.values(reviews)) {
    assert.equal(review.reviewed, true);
    assert.equal(review.locationStatus, "unlocated-no-gps");
    for (const field of ["alt", "privacyStatus"]) assert.ok(review[field]);
    // Captions and descriptions are optional editorial copy; Studio may clear them.
    assert.equal(typeof review.caption, "string");
    assert.equal(typeof review.description, "string");
  }
  const ordered = Object.values(dayOverrides).flatMap(day => day.photoOrder || []);
  assert.equal(ordered.length, 104);
  assert.equal(new Set(ordered).size, 104);
  for (const day of Object.values(dayOverrides)) if (day.leadPhotoId) assert.equal(reviews[day.leadPhotoId].hidden, false);
  buildSite(root);
  const publicPhotos = generated(root, "trip-photos", "JOURNEY_ATLAS_PHOTOS")["switzerland-italy-family-2026"];
  assert.equal(publicPhotos.length, 95);
  assert.ok(!publicPhotos.some(photo => reviews[photo.id].hidden));
  const publicOverrides = generated(root, "content-overrides", "JOURNEY_ATLAS_CONTENT_OVERRIDES");
  for (const photo of publicPhotos) {
    // Preserve the saved edits exactly, including blank copy, pins, and zooms.
    assert.deepEqual(publicOverrides.photos[photo.id], reviews[photo.id]);
  }
});
