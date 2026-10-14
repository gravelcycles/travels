// Standalone preview browser QA; no production viewer or private media is used.
// npm install --no-save playwright (or set DEPTH_PLAYWRIGHT_MODULE to its module).
// Set CHROME_EXECUTABLE when using an existing Chrome instead of Playwright Chromium.
// Optional DEPTH_SCREENSHOT_DIR writes max-depth desktop/phone/landscape previews.
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const publicRoot = path.join(root, 'dist');
const assetRoot = path.join(publicRoot, 'experiments/depth/assets');
const manifest = JSON.parse(await fs.readFile(path.join(assetRoot, 'manifest.json'), 'utf8'));
assert.ok(manifest.samples.length >= 2, 'Two prepared samples are required.');
for (const sample of manifest.samples) await fs.access(path.join(assetRoot, sample.depth));
const moduleName = process.env.DEPTH_PLAYWRIGHT_MODULE;
const { chromium } = await import(moduleName ? pathToFileURL(path.resolve(moduleName)).href : 'playwright');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const server = http.createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const filename = path.resolve(publicRoot, `.${pathname.endsWith('/') ? `${pathname}index.html` : pathname}`);
    if (!filename.startsWith(`${publicRoot}${path.sep}`)) throw new Error('Outside public output');
    response.setHeader('Content-Type', types[path.extname(filename)] || 'application/octet-stream');
    response.end(await fs.readFile(filename));
  } catch { response.writeHead(404); response.end('Not found'); }
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
const url = `http://127.0.0.1:${server.address().port}/experiments/depth/`;
let browser;
const contexts = [];
const screenshotDir = process.env.DEPTH_SCREENSHOT_DIR;
if (screenshotDir) await fs.mkdir(screenshotDir, { recursive: true });
try {
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE || undefined, args: ['--enable-unsafe-swiftshader'] });
  async function makePage(options = {}, noWebGL = false) {
    const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, ...options });
    contexts.push(context);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    await page.addInitScript(({ noWebGL }) => {
      window.depthQA = { draws: 0, colors: 0, touchEvents: [] };
      document.addEventListener('pointerdown', event => { if (event.target.closest?.('#image-frame')) depthQA.pointerId = event.pointerId; });
      if (noWebGL) {
        const getContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (type, ...rest) { return /webgl/.test(type) ? null : getContext.call(this, type, ...rest); };
      } else {
        const drawArrays = WebGLRenderingContext.prototype.drawArrays;
        WebGLRenderingContext.prototype.drawArrays = function (...args) {
          drawArrays.apply(this, args);
          if (this.canvas.id !== 'depth-canvas') return;
          depthQA.draws++;
          const program = this.getParameter(this.CURRENT_PROGRAM);
          depthQA.amount = this.getUniform(program, this.getUniformLocation(program, 'amount'));
          depthQA.offset = [...this.getUniform(program, this.getUniformLocation(program, 'offset'))];
          depthQA.level = this.getUniform(program, this.getUniformLocation(program, 'depthLevel'));
          const colors = new Set(), pixel = new Uint8Array(4), pixels = [];
          for (const x of [.1, .3, .5, .7, .9]) for (const y of [.1, .3, .5, .7, .9]) {
            this.readPixels(Math.floor(this.drawingBufferWidth * x), Math.floor(this.drawingBufferHeight * y), 1, 1, this.RGBA, this.UNSIGNED_BYTE, pixel);
            colors.add([...pixel].join(','));
            pixels.push(...pixel);
          }
          depthQA.colors = Math.max(depthQA.colors, colors.size);
          depthQA.pixels = pixels;
        };
      }
    }, { noWebGL });
    await page.goto(url);
    await page.locator('.sample').first().waitFor();
    return { page, context, errors };
  }
  async function openSample(page, sample = 0) {
    await page.locator('.sample').nth(sample).click();
    await page.waitForFunction(() => !document.querySelector('#depth-toggle').disabled);
    assert.equal(await page.locator('#depth-toggle').getAttribute('aria-checked'), 'false');
  }
  async function turnOn(page) {
    await page.locator('#depth-toggle').click();
    await page.waitForFunction(() => document.querySelector('#image-frame').classList.contains('is-active'));
  }
  async function settle(page) {
    await page.evaluate(() => { depthQA.stableDraws = -1; depthQA.stableAt = performance.now(); });
    await page.waitForFunction(() => {
      if (depthQA.stableDraws !== depthQA.draws) { depthQA.stableDraws = depthQA.draws; depthQA.stableAt = performance.now(); }
      return performance.now() - depthQA.stableAt > 150;
    }, null, { timeout: 8000 });
  }
  const view = page => page.evaluate(() => ({ offset: depthQA.offset, level: depthQA.level, pixels: depthQA.pixels, draws: depthQA.draws }));
  const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < .0001, `${message}: ${actual} vs ${expected}`);
  async function drag(page, dx = .28, dy = .2, release = true) {
    const rect = await page.locator('#image-frame').boundingBox();
    const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + rect.width * dx, y + rect.height * dy, { steps: 7 });
    if (release) await page.mouse.up();
  }
  async function setStrength(page, level) {
    await page.locator('#strength').evaluate((element, value) => { element.value = String(value); element.dispatchEvent(new Event('input', { bubbles: true })); }, level * 100);
    await settle(page);
    near((await view(page)).level, level, 'Slider must update the shader depth level');
  }
  async function assertLayout(page, label) {
    const layout = await page.evaluate(() => {
      const frame = document.querySelector('#image-frame').getBoundingClientRect();
      const stage = document.querySelector('#stage').getBoundingClientRect();
      return { viewport: innerWidth, width: document.documentElement.scrollWidth, frame: { left: frame.left, right: frame.right, top: frame.top, bottom: frame.bottom, width: frame.width, height: frame.height }, stage: { left: stage.left, right: stage.right, top: stage.top, bottom: stage.bottom }, ready: document.querySelector('#still').naturalWidth > 0 };
    });
    assert.ok(layout.width <= layout.viewport, `${label}: no horizontal page overflow`);
    assert.ok(layout.ready && layout.frame.width > 50 && layout.frame.height > 50, `${label}: full photograph remains ready`);
    assert.ok(layout.frame.left >= layout.stage.left && layout.frame.right <= layout.stage.right + 1 && layout.frame.top >= layout.stage.top && layout.frame.bottom <= layout.stage.bottom + 1, `${label}: photograph fits its stage`);
    if (screenshotDir) await page.screenshot({ path: path.join(screenshotDir, `${label}.png`) });
  }
  const { page, errors } = await makePage();
  const depthRequests = [];
  page.on('request', request => { if (manifest.samples.some(sample => request.url().endsWith(`/${sample.depth}`))) depthRequests.push(request.url()); });
  await openSample(page);
  assert.deepEqual(depthRequests, [], 'Opening a still must not download depth.');
  assert.equal(await page.evaluate(() => depthQA.draws), 0);
  await turnOn(page);
  await page.waitForFunction(() => depthQA.colors > 3);
  assert.equal(depthRequests.length, 1, 'Only the selected photo depth is requested.');
  await page.waitForFunction(() => depthQA.amount >= 1);
  await settle(page);
  assert.equal(await page.locator('#drag-mode').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('#strength').inputValue(), '100');
  assert.ok(!await page.locator('#pause').isVisible() || await page.locator('#pause').isDisabled(), 'Pause belongs only to automatic drift.');
  const centered = await view(page);
  const rect = await page.locator('#image-frame').boundingBox();
  await page.mouse.move(rect.x + 20, rect.y + 20);
  await page.mouse.move(rect.x + rect.width - 20, rect.y + rect.height - 20, { steps: 5 });
  await page.waitForTimeout(100);
  assert.deepEqual((await view(page)).offset, centered.offset, 'Hover alone must not move the photograph.');
  await drag(page);
  await settle(page);
  const dragged = await view(page);
  assert.ok(Math.abs(dragged.offset[0]) > .002 && Math.abs(dragged.offset[1]) > .002, 'Dragging must change both actual shader viewpoint axes.');
  assert.notDeepEqual(dragged.pixels, centered.pixels, 'Dragging must change rendered photograph pixels.');
  await page.mouse.move(rect.x + 10, rect.y + 10);
  await page.waitForTimeout(100);
  assert.deepEqual((await view(page)).offset, dragged.offset, 'Release and subsequent hover retain the chosen viewpoint.');
  assert.equal((await view(page)).draws, dragged.draws, 'A settled drag view must stop rendering.');
  await page.locator('#reset-view').click();
  await settle(page);
  for (const axis of (await view(page)).offset) near(axis, 0, 'Reset view returns to center');
  await page.locator('#image-frame').focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await settle(page);
  assert.equal(await page.locator('#photo-count').textContent(), `1 / ${manifest.samples.length}`, 'Focused photograph arrows adjust viewpoint, not photo selection.');
  assert.ok((await view(page)).offset.every(axis => Math.abs(axis) > .001), `Rapid directional keys retain both axes: ${JSON.stringify((await view(page)).offset)}`);
  await page.keyboard.press('Home');
  await settle(page);
  for (const axis of (await view(page)).offset) near(axis, 0, 'Home returns to center');
  for (const preset of [60, 150, 300]) {
    await page.locator(`[data-depth="${preset}"]`).click();
    await settle(page);
    assert.equal(await page.locator('#strength').inputValue(), String(preset));
    near((await view(page)).level, preset / 100, 'Depth preset must update actual rendering');
  }
  await drag(page, .9, .9);
  await settle(page);
  const bounded = await view(page);
  assert.ok(Math.abs(bounded.offset[0]) <= .04001 && Math.abs(bounded.offset[1]) <= .03001, 'Large captured drags stay bounded.');
  await assertLayout(page, 'desktop-max-depth');
  await drag(page, .1, .1, false);
  await page.setViewportSize({ width: 1200, height: 820 });
  await page.waitForFunction(() => !document.querySelector('#image-frame').hasPointerCapture(depthQA.pointerId));
  await page.mouse.up();
  await settle(page);
  const resized = await view(page);
  await page.mouse.move(30, 30);
  await page.waitForTimeout(100);
  assert.deepEqual((await view(page)).offset, resized.offset, 'Resize cancels capture without retaining a stale drag.');
  await page.setViewportSize({ width: 1360, height: 900 });
  await settle(page);
  await setStrength(page, 0);
  const flatDragged = await view(page);
  await page.locator('#reset-view').click();
  await settle(page);
  assert.deepEqual((await view(page)).pixels, flatDragged.pixels, '0× depth must render the identical uncropped original at any viewpoint.');
  await setStrength(page, 1);
  await drag(page);
  await settle(page);
  const normalDepth = await view(page);
  await setStrength(page, 3);
  const strongDepth = await view(page);
  assert.deepEqual(strongDepth.offset, normalDepth.offset, 'Strength adjusts depth while preserving the viewpoint.');
  assert.notDeepEqual(strongDepth.pixels, normalDepth.pixels, '3× depth must visibly change the same viewpoint.');
  near(strongDepth.level, 3 * normalDepth.level, 'Maximum depth triples the shader displacement scale');
  await page.locator('#drift-mode').click();
  await drag(page);
  await settle(page);
  assert.equal(await page.locator('#drag-mode').getAttribute('aria-pressed'), 'true', 'Dragging during drift takes over direct control.');
  await drag(page, .1, .1, false);
  await page.locator('#drift-mode').focus();
  await page.keyboard.press('Space');
  assert.ok(!await page.locator('#image-frame').evaluate(element => element.hasPointerCapture(depthQA.pointerId)), 'Changing mode releases an in-progress drag.');
  await page.mouse.up();
  await page.locator('#pause').click();
  await page.waitForTimeout(50);
  const paused = await page.evaluate(() => depthQA.draws);
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => depthQA.draws), paused, 'Pause must stop rendering once the reveal is settled.');
  await page.locator('#pause').click();
  await page.waitForFunction(draws => depthQA.draws > draws, paused);
  await page.locator('#compare').focus();
  await page.keyboard.down('Space');
  assert.ok(await page.locator('#image-frame').evaluate(element => element.classList.contains('is-comparing')));
  await page.keyboard.up('Space');
  assert.ok(!await page.locator('#image-frame').evaluate(element => element.classList.contains('is-comparing')));
  await page.locator('#depth-toggle').click();
  const stopped = await page.evaluate(() => depthQA.draws);
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => depthQA.draws), stopped, 'Off must stop rendering.');
  await turnOn(page);
  await page.locator('#next').click();
  await page.waitForFunction(() => !document.querySelector('#depth-toggle').disabled);
  assert.equal(await page.locator('#depth-toggle').getAttribute('aria-checked'), 'false');
  assert.ok((await page.locator('#still').getAttribute('src')).endsWith(manifest.samples[1].image));
  assert.equal(new URL(page.url()).hash, '#photo-2');
  assert.equal(await page.locator('#credit a').last().getAttribute('href'), manifest.samples[1].licenseUrl);
  await page.locator('#back').focus();
  await page.keyboard.press('ArrowLeft');
  await page.waitForFunction(() => !document.querySelector('#depth-toggle').disabled);
  assert.equal(await page.locator('#photo-count').textContent(), `1 / ${manifest.samples.length}`, 'Arrows outside the focused photograph still browse photos.');
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => !document.querySelector('#depth-toggle').disabled);
  await page.locator('#back').click();
  await page.waitForFunction(() => !document.querySelector('#viewer').open);
  await page.goForward();
  await page.waitForFunction(() => document.querySelector('#viewer').open && !document.querySelector('#depth-toggle').disabled);
  assert.equal(await page.locator('#photo-count').textContent(), `2 / ${manifest.samples.length}`);
  assert.equal(await page.locator('#depth-toggle').getAttribute('aria-checked'), 'false');
  await turnOn(page);
  await drag(page, .1, .1, false);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('#viewer').open);
  await page.mouse.up();
  assert.ok(!await page.locator('#image-frame').evaluate(element => element.hasPointerCapture(depthQA.pointerId)), 'Closing releases an in-progress drag.');
  const closed = await page.evaluate(() => depthQA.draws);
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => depthQA.draws), closed, 'Closing must stop rendering.');
  await page.goForward();
  await page.waitForFunction(() => document.querySelector('#viewer').open && !document.querySelector('#depth-toggle').disabled);
  assert.equal(await page.locator('#depth-toggle').getAttribute('aria-checked'), 'false');
  await page.locator('#expand').click();
  await page.waitForFunction(() => document.fullscreenElement === document.documentElement);
  await page.locator('#expand').click();
  await page.waitForFunction(() => !document.fullscreenElement);
  assert.deepEqual(errors, []);

  const mobile = await makePage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await openSample(mobile.page);
  await turnOn(mobile.page);
  await setStrength(mobile.page, 3);
  await mobile.page.evaluate(() => { for (const name of ['pointermove', 'pointercancel', 'pointerup']) document.querySelector('#image-frame').addEventListener(name, event => depthQA.touchEvents.push(event.type)); });
  const bounds = await mobile.page.locator('#image-frame').boundingBox();
  const cdp = await mobile.context.newCDPSession(mobile.page);
  const x = bounds.x + bounds.width / 2, y = bounds.y + bounds.height / 2;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let delta = 10; delta <= 60; delta += 10) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + delta }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await settle(mobile.page);
  const touchEvents = await mobile.page.evaluate(() => depthQA.touchEvents);
  assert.ok(touchEvents.includes('pointerup') && !touchEvents.includes('pointercancel'), 'Vertical drag must finish without browser pan cancellation.');
  assert.ok(Math.abs((await view(mobile.page)).offset[1]) > .002, 'Touch drag changes the actual vertical viewpoint.');
  await assertLayout(mobile.page, 'phone-390-max-depth');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 40, y }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await settle(mobile.page);
  assert.ok(!await mobile.page.locator('#image-frame').evaluate(element => element.hasPointerCapture(depthQA.pointerId)), 'Cancelled touch releases its drag capture.');
  const cancelled = await view(mobile.page);
  await mobile.page.mouse.move(x + 90, y + 70);
  await mobile.page.waitForTimeout(100);
  assert.deepEqual((await view(mobile.page)).offset, cancelled.offset, 'A cancelled drag must not keep following a pointer.');
  await mobile.page.locator('#next').click();
  await mobile.page.waitForFunction(() => !document.querySelector('#depth-toggle').disabled);
  await turnOn(mobile.page);
  await setStrength(mobile.page, 3);
  await drag(mobile.page, .5, .5);
  await settle(mobile.page);
  await assertLayout(mobile.page, 'phone-390-portrait-max-depth');
  assert.deepEqual(mobile.errors, []);

  for (const [width, height] of [[320, 568], [844, 390]]) {
    const compact = await makePage({ viewport: { width, height }, hasTouch: true });
    await openSample(compact.page, width === 320 ? 1 : 0);
    await turnOn(compact.page);
    await setStrength(compact.page, 3);
    await drag(compact.page, .5, .5);
    await settle(compact.page);
    await assertLayout(compact.page, `viewport-${width}x${height}-max-depth`);
    assert.deepEqual(compact.errors, []);
    await compact.context.close();
  }

  const reduced = await makePage({ reducedMotion: 'reduce' });
  await openSample(reduced.page);
  assert.equal(await reduced.page.locator('#drag-mode').getAttribute('aria-pressed'), 'true');
  await turnOn(reduced.page);
  await reduced.page.waitForTimeout(100);
  const settled = await reduced.page.evaluate(() => depthQA.draws);
  await reduced.page.waitForTimeout(100);
  assert.equal(await reduced.page.evaluate(() => depthQA.draws), settled, 'Reduced motion must not start continuous drift.');
  await reduced.page.emulateMedia({ reducedMotion: 'no-preference' });
  await drag(reduced.page, .1, .1, false);
  await reduced.page.emulateMedia({ reducedMotion: 'reduce' });
  await reduced.page.waitForFunction(() => !document.querySelector('#image-frame').hasPointerCapture(depthQA.pointerId));
  await reduced.page.mouse.up();
  await settle(reduced.page);
  const reducedCancelled = await view(reduced.page);
  await reduced.page.mouse.move(30, 30);
  await reduced.page.waitForTimeout(100);
  assert.deepEqual((await view(reduced.page)).offset, reducedCancelled.offset, 'Changing reduced motion cancels an in-progress drag.');
  assert.deepEqual(reduced.errors, []);

  const failure = await makePage();
  const depthRoute = `**/${manifest.samples[0].depth}`;
  await failure.page.route(depthRoute, route => route.abort());
  await openSample(failure.page);
  await failure.page.locator('#depth-toggle').click();
  await failure.page.waitForFunction(() => document.querySelector('#status').textContent.includes('could not load'));
  assert.equal(await failure.page.locator('#depth-toggle').getAttribute('aria-checked'), 'false');
  assert.ok(await failure.page.locator('#still').evaluate(element => element.naturalWidth > 0));
  await failure.page.unroute(depthRoute);
  await turnOn(failure.page);
  assert.deepEqual(failure.errors, []);

  const stale = await makePage();
  let releaseDepth;
  const heldDepth = new Promise(resolve => { releaseDepth = resolve; });
  await stale.page.route(depthRoute, async route => { await heldDepth; await route.continue(); });
  await openSample(stale.page);
  await stale.page.locator('#depth-toggle').click();
  await stale.page.waitForFunction(() => document.querySelector('#toggle-label').textContent === 'Preparing…');
  await stale.page.locator('#next').click();
  await stale.page.waitForFunction(() => !document.querySelector('#depth-toggle').disabled);
  const staleResponse = stale.page.waitForResponse(response => response.url().endsWith(`/${manifest.samples[0].depth}`));
  releaseDepth();
  await staleResponse;
  await stale.page.waitForTimeout(50);
  assert.equal(await stale.page.locator('#depth-toggle').getAttribute('aria-checked'), 'false');
  assert.equal(await stale.page.evaluate(() => depthQA.draws), 0, 'A late depth response must not activate the next photograph.');
  assert.deepEqual(stale.errors, []);

  const unsupported = await makePage({}, true);
  await openSample(unsupported.page);
  await unsupported.page.locator('#depth-toggle').click();
  await unsupported.page.waitForFunction(() => document.querySelector('#status').textContent.includes('unavailable in this browser'));
  assert.equal(await unsupported.page.locator('#depth-toggle').getAttribute('aria-checked'), 'false');
  assert.ok(await unsupported.page.locator('#still').evaluate(element => element.naturalWidth > 0));
  assert.deepEqual(unsupported.errors, []);
  console.log('Depth preview browser checks passed: lazy depth, rendered pixels, drag/hold/hover, reset/keyboard, 0–3× depth/presets, bounds, drift takeover, pause/resume, capture cleanup, compare, off/close, navigation/history, native fullscreen, vertical touch, responsive layouts, reduced motion, download retry, stale response, WebGL fallback.');
} finally {
  for (const context of contexts) await context.close();
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
