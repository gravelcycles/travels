import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {renderJourneyPage} from '../scripts/build-site.mjs';
import {loadContent} from '../scripts/journey-content.mjs';
import {createJourney} from '../scripts/create-journey.mjs';

const repo = path.resolve(import.meta.dirname, '..');
const read = file => fs.readFileSync(path.join(repo, file), 'utf8');
const sheets = fs.readdirSync(path.join(repo, 'dist/assets')).filter(name => name.endsWith('.css'));
const stripComments = css => css.replace(/\/\*[\s\S]*?\*\//g, '');

test('the feel stylesheet is inherited by the catalog, real trips, the demo and a fresh draft', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-feel-contract-'));
  t.after(() => fs.rmSync(root, {recursive:true, force:true}));
  fs.cpSync(path.join(repo, 'content'), path.join(root, 'content'), {recursive:true});
  const draft = createJourney(root, {title:'Empty feel trip', slug:'feel-test', startDate:'2028-03-01', endDate:'2028-03-03', timeZone:'Europe/Berlin'});
  const {data} = loadContent(root, {includeDrafts:true});
  assert.ok(data.journeys.some(journey => journey.id === draft.id));
  for (const journey of data.journeys) {
    const html = renderJourneyPage(root, journey, {preview:true});
    const links = [...html.matchAll(/<link rel="stylesheet"\s+href="([^"]+)"/g)].map(match => match[1]);
    assert.match(links.at(-1), /assets\/feel\.css/, `${journey.id}: feel.css is the last stylesheet, so its shared rules apply`);
    assert.doesNotMatch(html, />[←→×‹›]<\/button>/, `${journey.id}: controls use line icons, not text glyphs`);
  }
  for (const page of ['dist/index.html', 'dist/demo.html', 'dist/switzerland-italy.html']) {
    assert.match(read(page), /assets\/feel\.css\?v=/, `${page} loads the versioned feel stylesheet`);
  }
});

test('interface motion uses the shared tokens; gesture settles and photo reveals keep their own timings', () => {
  const base = read('dist/assets/styles.css');
  for (const token of ['--motion-fast', '--motion-base', '--motion-slow', '--ease-out', '--ease-in-out', '--press-scale', '--radius-pill', '--font-ui']) {
    assert.match(base, new RegExp(`${token}\\s*:`), `${token} is defined with the base tokens`);
  }
  assert.doesNotMatch(base + read('dist/assets/places-panel.css'), /\bInter\b/, 'no stylesheet names a typeface the site does not ship');
  const literal = [];
  for (const name of sheets) {
    for (const match of stripComments(read(`dist/assets/${name}`)).matchAll(/transition:([^;}]+)/g)) {
      if (/none|var\(--motion/.test(match[1])) continue;
      literal.push(`${name}: ${match[1].trim()}`);
    }
  }
  // Paired with script timers (swipe 220 ms, pull-to-dismiss 180 ms, location
  // 220 ms) or owner-reviewed reveals; anything new should use a token.
  assert.equal(literal.length, 8, `only the known gesture and reveal transitions are literal:\n${literal.join('\n')}`);
  assert.ok(literal.every(entry => /^(mobile|styles)\.css/.test(entry)));
  const mobile = read('dist/assets/mobile-ux.js');
  assert.match(mobile, /swipeTimer = setTimeout\([\s\S]{0,120}, 220\)/);
  assert.match(mobile, /dismissTimer = setTimeout\(finish, 180\)/);
});

test('hover styling is limited to devices that hover, and every control has press feedback', () => {
  for (const name of sheets) {
    const css = stripComments(read(`dist/assets/${name}`));
    let depth = 0, guarded = [], prelude = '';
    for (let index = 0; index < css.length; index++) {
      const char = css[index];
      if (char === '{') {
        const text = prelude.trim();
        if (text.startsWith('@')) guarded.push({depth, hover:/hover\s*:\s*hover/.test(text)});
        else if (text.includes(':hover')) assert.ok(guarded.some(group => group.hover), `${name}: "${text.slice(0, 80)}" is inside @media (hover:hover)`);
        depth++; prelude = '';
      } else if (char === '}') {
        depth--; prelude = '';
        if (guarded.length && guarded.at(-1).depth === depth) guarded.pop();
      } else if (char === ';') prelude = '';
      else prelude += char;
    }
  }
  const feel = read('dist/assets/feel.css');
  assert.match(feel, /:where\(button[^)]*\):active:not\(:disabled[^)]*\)\s*\{\s*scale:\s*var\(--press-scale\)/, 'buttons scale slightly while pressed');
  assert.match(feel, /prefers-reduced-motion: reduce[\s\S]{0,200}:active[\s\S]{0,80}filter/, 'reduced motion keeps press feedback without movement');
  assert.match(read('dist/assets/input-mode.js'), /touchstart/, 'touch browsers get a listener so :active paints');
});

test('screen motion is armed only by a forward move the visitor made', () => {
  const app = read('dist/assets/app.js');
  assert.match(app, /dataset\.tabMotionArmed = 'true'/);
  assert.match(app, /shell\.dataset\.tabMotion = shell\.dataset\.tabMotionArmed === 'true' && shell\.dataset\.mobileTab !== tab && !window\.JOURNEY_ATLAS_MOBILE_UI\?\.restoring\?\.\(\) \? 'on' : 'off'/);
  const feel = read('dist/assets/feel.css');
  for (const tab of ['route', 'story']) assert.match(feel, new RegExp(`\\[data-tab-motion="on"\\]\\[data-mobile-tab="${tab}"\\]`));
  assert.match(feel, /@media \(max-width: 900px\) and \(prefers-reduced-motion: no-preference\)/);
  // The screen being left stays displayed only while data-tab-from names it,
  // and the listener clears that as soon as its animation ends or is cancelled.
  assert.match(app, /if \(shell\.dataset\.tabMotion === 'on'\) shell\.dataset\.tabFrom = shell\.dataset\.mobileTab; else delete shell\.dataset\.tabFrom;/);
  // Only the panel named as left behind clears the state, so a cancelled
  // animation from the previous move cannot end the next one early.
  assert.match(app, /\['animationend', 'animationcancel'\][\s\S]{0,460}feel-\(hold\|recede\|pop-out\|sheet-down\)[\s\S]{0,120}classList\?\.contains\(`\$\{shell\.dataset\.tabFrom\}-panel`\)\) delete shell\.dataset\.tabFrom/);
  for (const name of ['feel-hold', 'feel-recede', 'feel-pop-out', 'feel-sheet-down']) assert.match(feel, new RegExp(`@keyframes ${name} `));
  assert.match(feel, /\[data-tab-from="story"\]\[data-mobile-tab="map"\] \.story-panel \{[^}]*pointer-events: none/, 'a leaving screen cannot be tapped');
  assert.match(app, /dataset\.storyKey !== feelKey[\s\S]{0,160}dataset\.daySwap = /, 'a stop change, not a re-render, restarts the settle');
});

test('a grid photo grows from its thumbnail and returns to it without delaying the photo', () => {
  const app = read('dist/assets/app.js'), mobile = read('dist/assets/mobile-ux.js');
  assert.match(app, /const origin = button\.getBoundingClientRect\(\);[\s\S]{0,160}gridSelected\(origin\)/, 'the tapped tile is measured before the viewer updates');
  assert.match(mobile, /gridSelected:origin=>\{if\(!grid\)return;setGrid\(false\);if\(origin&&!reduced\.matches&&enabled\(\)\)morph\(origin\);\}/, 'the photo is selected first; the motion is added after and skipped for reduced motion');
  assert.match(mobile, /function leave\(\)[\s\S]{0,700}if \(!animation\) \{ back\(\); return; \}/, 'Back and Close fall back to an immediate return');
  assert.match(mobile, /if \(morphLeaving\) return;\s*cancelMorph\(\);/, 'a touch on the photograph ends the opening motion');
  for (const owner of ['function setGrid(value, record = true) {\n      cancelTap(); cancelMorph();', 'function closed() {\n      cancelMorph();', 'backPending = false; cancelMorph(); resetDismiss();']) {
    assert.ok(mobile.includes(owner), `motion is cleared when the layer changes: ${owner.slice(0, 40)}`);
  }
});
