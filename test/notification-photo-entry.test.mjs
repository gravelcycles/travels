import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { viewerFunction } from './viewer-flow-harness.mjs';
import '../dist/assets/atlas-utils.js';
import '../dist/assets/group-travel.js';

const utils = globalThis.JOURNEY_ATLAS_UTILS, groupTravel = globalThis.JOURNEY_ATLAS_GROUPS;
const today = new Date('2027-01-01T12:00:00Z');
const projection = (journey, visibility) => utils.projectPlanning(journey, visibility, today);
function fixture({ hidden = 'past', otherGroup = false, visibility } = {}) {
  const days = [
    { id: 'past', calendarDate: '2026-12-31', segmentIds: [] },
    { id: 'locked', calendarDate: '2027-01-02', segmentIds: [] },
    { id: 'tbd', planningStatus: 'tbd', segmentIds: [] }
  ];
  const source = { id: 'independent-trip', timeZone: 'UTC', days, places: [], segments: [],
    routeGroups: [{ id: 'a' }, { id: 'b' }],
    photos: days.map(day => ({ id: `photo-${day.id}`, dayId: day.id, groupIds: [otherGroup && day.id === hidden ? 'b' : 'a'] }))
  };
  const selected = visibility || Object.fromEntries(days.map((day, i) => [day.id, day.id !== hidden && i === days.findIndex(item => item.id !== hidden)]));
  const calls = [], renderCalls = [], noOp = () => {};
  const context = vm.createContext({
    sourceJourney: source, activeGroupId: 'a', planningVisibility: { ...selected },
    journey: projection(groupTravel.projectJourney(source, 'a'), selected), groupTravel,
    activeDayId: days.find(day => selected[day.id]).id, viewerDayId: null, mapScope: 'journey',
    URL, location: { href: 'https://example.test/trip?group=a' }, history: { state: {}, replaceState: noOp },
    window: { JOURNEY_ATLAS_UTILS: { ...utils, projectPlanning: projection, planningCategory: (day, journey) => utils.planningCategory(day, journey, '2027-01-01') } },
    $: selector => selector === '#travel-party' ? { querySelectorAll: () => [] } : { offsetParent: null },
    cancelArrival: noOp, clearSegmentInspection: noOp, clearDayPreview: noOp, pauseReplay: noOp,
    locationLabels: { closePreview: noOp }, placesUI: { dayChanged: noOp },
    photoBubbles: { clearMap: noOp, close: noOp }, videoPlayer: { stop: noOp }, photoDialog: { open: false },
    renderPlanningFilters: noOp, renderAll: () => renderCalls.push('render'),
    focusDay: noOp, fitJourneyBounds: noOp, openPhoto: id => calls.push(['fullscreen', id]),
    openCommentPhoto: () => assert.fail('Notifications must not stop at sidebar selection'),
    dayById: id => context.journey.days.find(day => day.id === id),
    activeDay: () => context.journey.days.find(day => day.id === context.activeDayId),
    photoById: id => context.journey.photos.find(photo => photo.id === id)
  });
  vm.runInContext(['selectRouteGroup', 'selectPlanningCategory', 'openNotificationPhoto'].map(viewerFunction).join('\n'), context);
  for (const [name, label] of [['selectRouteGroup', 'group'], ['selectPlanningCategory', 'category']]) {
    const actual = context[name]; context[name] = (...args) => { calls.push([label, ...args]); return actual(...args); };
  }
  return { context, calls, renderCalls, source, original: structuredClone(source), selected };
}

for (const category of ['past', 'locked', 'tbd']) test(`notification reveals only hidden ${category} events and preserves the route group`, () => {
  const f = fixture({ hidden: category });
  assert.equal(f.context.openNotificationPhoto(`photo-${category}`), true);
  assert.deepEqual(f.calls, [['category', category, true], ['fullscreen', `photo-${category}`]]);
  assert.equal(f.context.activeGroupId, 'a');
  assert.deepEqual({ ...f.context.planningVisibility }, { ...f.selected, [category]: true });
  assert.ok(f.context.photoById(`photo-${category}`));
  assert.deepEqual(f.source, f.original, 'Navigation never rewrites itinerary/photo sources');
});

test('notification reveals a photo excluded by both event category and route group through existing setters', () => {
  const f = fixture({ hidden: 'tbd', otherGroup: true });
  assert.equal(f.context.openNotificationPhoto('photo-tbd'), true);
  assert.deepEqual(f.calls, [['category', 'tbd', true], ['group', ''], ['fullscreen', 'photo-tbd']]);
  assert.equal(f.context.activeGroupId, '');
  assert.deepEqual({ ...f.context.planningVisibility }, { ...f.selected, tbd: true });
  assert.ok(f.context.photoById('photo-tbd'));
});

test('notification excluded only by route group leaves all planning category choices intact', () => {
  const f = fixture({ hidden: 'past', otherGroup: true, visibility: { past: true, locked: false, tbd: false } });
  assert.equal(f.context.openNotificationPhoto('photo-past'), true);
  assert.deepEqual(f.calls, [['group', ''], ['fullscreen', 'photo-past']]);
  assert.deepEqual({ ...f.context.planningVisibility }, f.selected);
  assert.ok(f.context.photoById('photo-past'));
});

test('visible notifications preserve every filter, while missing photos make no changes', () => {
  const f = fixture({ visibility: { past: true, locked: false, tbd: false } });
  assert.equal(f.context.openNotificationPhoto('photo-past'), true);
  assert.equal(f.context.openNotificationPhoto('missing'), false);
  assert.deepEqual(f.calls, [['fullscreen', 'photo-past']]); assert.deepEqual(f.renderCalls, []);
  assert.deepEqual({ ...f.context.planningVisibility }, f.selected); assert.equal(f.context.activeGroupId, 'a');
});
