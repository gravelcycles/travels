import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { viewerFixture } from './mobile-viewer-harness.mjs';

function counted(f) {
  const writes = { replace: 0, push: 0 }, replace = f.history.replaceState.bind(f.history), push = f.history.pushState.bind(f.history);
  f.history.replaceState = state => { writes.replace++; replace(state); };
  f.history.pushState = state => { writes.push++; push(state); };
  return writes;
}

test('repeated renders of an unchanged view write history once, on phone and desktop', () => {
  for (const mobile of [true, false]) {
    const f = viewerFixture({ mobile }), writes = counted(f);
    for (let i = 0; i < 150; i++) f.controller.renderDay();
    assert.ok(writes.replace <= 1, `${writes.replace} writes for 150 identical renders`);
    assert.equal(writes.push, 0);
    assert.equal(f.history.state.mobileAtlas.dayId, 'one', 'the entry still describes the view');
  }
});

test('a real change of view is still recorded, and Back still restores it', () => {
  const f = viewerFixture(), writes = counted(f);
  f.controller.renderDay(); const before = writes.replace;
  f.api.selectDay('two'); f.controller.renderDay();
  assert.equal(writes.replace, before + 1); assert.equal(f.history.state.mobileAtlas.dayId, 'two');
  f.api.openDay('two'); f.api.move(1);
  assert.equal(f.history.state.mobileAtlas.index, 1, 'photo steps keep updating the current entry');
  assert.equal(f.history.state.mobileAtlas.viewer, true);
});

test('a rejected history write never interrupts the view change that asked for it', () => {
  const f = viewerFixture();
  f.controller.renderDay();
  f.history.replaceState = () => { throw new DOMException('Attempt to use history.replaceState() more than 100 times per 30 seconds', 'SecurityError'); };
  f.api.selectDay('two');
  assert.doesNotThrow(() => f.controller.renderDay());
  assert.equal(f.api.day().id, 'two');
});

test('photo arrow keys are ignored while the Share dialog is open', () => {
  const source = fs.readFileSync(new URL('../dist/assets/app.js', import.meta.url), 'utf8');
  const guard = source.match(/if \(!photoDialog\.open \|\| document\.querySelector\('([^']+)'\)/);
  assert.ok(guard, 'the viewer arrow-key guard exists');
  for (const dialog of ['#comments-dialog[open]', '#experience-unlock[open]', '#trip-notifications-dialog[open]', '#share-link-dialog[open]']) assert.ok(guard[1].split(', ').includes(dialog), dialog);
  assert.match(fs.readFileSync(new URL('../content/templates/journey.html', import.meta.url), 'utf8'), /<dialog id="share-link-dialog"/);
});
