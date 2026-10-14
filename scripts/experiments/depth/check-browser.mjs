// Standalone preview browser QA; no production viewer or private media is used.
// npm install --no-save playwright (or set DEPTH_PLAYWRIGHT_MODULE to its module).
// Set CHROME_EXECUTABLE when using an existing Chrome instead of Playwright Chromium.
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
          if (depthQA.colors > 3) return;
          const colors = new Set(), pixel = new Uint8Array(4);
          for (const x of [.2, .5, .8]) for (const y of [.2, .5, .8]) {
            this.readPixels(Math.floor(this.drawingBufferWidth * x), Math.floor(this.drawingBufferHeight * y), 1, 1, this.RGBA, this.UNSIGNED_BYTE, pixel);
            colors.add([...pixel].join(','));
          }
          depthQA.colors = Math.max(depthQA.colors, colors.size);
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
  await page.locator('#back').click();
  await page.waitForFunction(() => !document.querySelector('#viewer').open);
  await page.goForward();
  await page.waitForFunction(() => document.querySelector('#viewer').open && !document.querySelector('#depth-toggle').disabled);
  assert.equal(await page.locator('#photo-count').textContent(), '2 / 2');
  assert.equal(await page.locator('#depth-toggle').getAttribute('aria-checked'), 'false');
  await turnOn(page);
  await page.locator('#back').click();
  await page.waitForFunction(() => !document.querySelector('#viewer').open);
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
  await mobile.page.locator('#pointer-mode').click();
  await mobile.page.evaluate(() => { for (const name of ['pointermove', 'pointercancel', 'pointerup']) document.querySelector('#image-frame').addEventListener(name, event => depthQA.touchEvents.push(event.type)); });
  const bounds = await mobile.page.locator('#image-frame').boundingBox();
  const cdp = await mobile.context.newCDPSession(mobile.page);
  const x = bounds.x + bounds.width / 2, y = bounds.y + bounds.height / 2;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let delta = 10; delta <= 60; delta += 10) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + delta }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const touchEvents = await mobile.page.evaluate(() => depthQA.touchEvents);
  assert.ok(touchEvents.includes('pointerup') && !touchEvents.includes('pointercancel'), 'Vertical Follow you drag must finish without browser pan cancellation.');
  assert.deepEqual(mobile.errors, []);

  const reduced = await makePage({ reducedMotion: 'reduce' });
  await openSample(reduced.page);
  assert.equal(await reduced.page.locator('#pointer-mode').getAttribute('aria-pressed'), 'true');
  await turnOn(reduced.page);
  await reduced.page.waitForTimeout(100);
  const settled = await reduced.page.evaluate(() => depthQA.draws);
  await reduced.page.waitForTimeout(100);
  assert.equal(await reduced.page.evaluate(() => depthQA.draws), settled, 'Reduced motion must not start continuous drift.');
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
  console.log('Depth preview browser checks passed: lazy depth, rendered pixels, pause/resume, compare, off/close, navigation, history, native fullscreen, vertical touch, reduced motion, download retry, stale response, WebGL fallback.');
} finally {
  for (const context of contexts) await context.close();
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
