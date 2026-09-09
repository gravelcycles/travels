import assert from "node:assert/strict";
import test from "node:test";

await import("../dist/assets/replay-utils.js");
const { createTimeline, firstMomentIndexForDay, initialMomentProgress, partialLine } = globalThis.JOURNEY_ATLAS_REPLAY;

test("partialLine follows the full geometry instead of cutting to the endpoint", () => {
  const route = [[0, 0], [0, 1], [1, 1]];
  const halfway = partialLine(route, 0.5);
  assert.equal(halfway.length, 2);
  assert.deepEqual(halfway[0], [0, 0]);
  assert.ok(Math.abs(halfway[1][0]) < 0.01);
  assert.ok(halfway[1][1] > 0.99);
  assert.deepEqual(partialLine(route, 1), route);
});

test("createTimeline preserves day and leg order and adds only located photo pauses", () => {
  const journey = {
    days: [
      { id: "d1", segmentIds: ["s2", "s1"], photoOrder: ["p2", "p1"] },
      { id: "d2", segmentIds: [] },
      { id: "d3", segmentIds: ["missing"] }
    ],
    segments: [{ id: "s1" }, { id: "s2" }],
    photos: [
      { id: "p1", dayId: "d1", lng: 8, lat: 46 },
      { id: "p2", dayId: "d1" },
      { id: "p3", dayId: "d2", lng: 9, lat: 47, hidden: true }
    ]
  };
  const timeline = createTimeline(journey);
  assert.deepEqual(timeline.map((moment) => moment.id), [
    "d1:segment:s2",
    "d1:segment:s1",
    "d1:photo:p1",
    "d2:day",
    "d3:day"
  ]);
  assert.equal(firstMomentIndexForDay(timeline, "d2"), 3);
});

test("partialLine always returns valid two-point geometry at the start", () => {
  assert.deepEqual(partialLine([[8, 46], [9, 47]], 0), [[8, 46], [8, 46]]);
  assert.deepEqual(partialLine([], 0.5), []);
});

test("reduced motion renders route moments at their completed position", () => {
  assert.equal(initialMomentProgress({ type: "segment" }, false), 0);
  assert.equal(initialMomentProgress({ type: "segment" }, true), 1);
  assert.equal(initialMomentProgress({ type: "photo" }, false), 1);
});

test('curated chapters preserve ordered legs and drop hidden photos safely', () => {
  const {createTimeline,routePhase}=globalThis.JOURNEY_ATLAS_REPLAY;
  const j={days:[{id:'day',segmentIds:['out','return']}],photos:[{id:'hidden',dayId:'day',hidden:true}],replayMoments:[{id:'moment',dayId:'day',segmentIds:['out','return'],photoId:'hidden',caption:'A return trip',duration:8}]};
  const timeline=createTimeline(j); assert.equal(timeline.length,1);assert.equal(timeline[0].photoId,undefined);
  assert.equal(routePhase(timeline[0],0).segmentId,'out');assert.equal(routePhase(timeline[0],.6).segmentId,'return');
  assert.equal(routePhase(timeline[0],1).progress,1);assert.equal(routePhase(timeline[0],.1).completed.length,0);
});

test('Replay budgets time for distance, camera settling, and every connection', () => {
  const { createTimeline, routePhase } = globalThis.JOURNEY_ATLAS_REPLAY;
  const journey = {
    days: [{ id: 'travel', segmentIds: ['long', 'short'] }, { id: 'rest', segmentIds: [] }],
    segments: [{ id: 'long', distanceKm: 195 }, { id: 'short', distanceKm: 1.5 }],
    replayMoments: [
      { id: 'travel', dayId: 'travel', segmentIds: ['long', 'short'], duration: 8 },
      { id: 'rest', dayId: 'rest', segmentIds: [], duration: 2.4 }
    ]
  };
  const [travel, rest] = createTimeline(journey);
  assert.equal(rest.duration, 2.4);
  assert.ok(travel.legTiming[0].travel >= 16);
  assert.ok(travel.legTiming[1].travel >= 2.4);
  assert.ok(travel.legTiming[0].travel > travel.legTiming[1].travel * 4);
  assert.equal(routePhase(travel, 0.5 / travel.duration).progress, 0);
  const first = travel.legTiming[0];
  const connection = first.settle + first.travel + first.arrival;
  const phase = routePhase(travel, (connection + 0.1) / travel.duration);
  assert.equal(phase.segmentId, 'short');
  assert.deepEqual(phase.completed, ['long']);
  assert.equal(phase.progress, 0);
  assert.equal(routePhase(travel, 1).progress, 1);
  assert.deepEqual(routePhase(travel, 0).completed, []);
});

test('Replay timing does not depend on geometry point density', () => {
  const make = geometry => createTimeline({ days: [{ id: 'd', segmentIds: ['s'] }], segments: [{ id: 's', geometry }] })[0];
  const sparse = make([[8, 47], [9, 47]]);
  const dense = make(Array.from({length:101}, (_,i) => [8 + i / 100, 47]));
  assert.ok(Math.abs(sparse.duration - dense.duration) < 0.01);
});
