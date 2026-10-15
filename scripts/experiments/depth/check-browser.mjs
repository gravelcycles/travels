// Standalone preview browser QA; production viewers and live private services are untouched.
// npm install --no-save playwright (or set DEPTH_PLAYWRIGHT_MODULE to its module).
// Set CHROME_EXECUTABLE when using an existing Chrome instead of Playwright Chromium.
// Optional DEPTH_SCREENSHOT_DIR writes gentle desktop/phone/landscape previews.
// Optional DEPTH_PRIVATE_ASSET_DIR enables all nine samples using local protected
// derivatives through intercepted, authenticated requests; private files are not served by HTTP.
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const publicRoot = path.join(root, 'dist');
const assetRoot = path.join(publicRoot, 'experiments/depth/assets');
const manifest = JSON.parse(await fs.readFile(path.join(assetRoot, 'manifest.json'), 'utf8'));
assert.equal(manifest.samples.length, 9, 'The original two samples and seven additional website photographs are required.');
const publicSamples = manifest.samples.filter(sample => !sample.protected);
const privateSamples = manifest.samples.filter(sample => sample.protected);
const privateAssetDir = process.env.DEPTH_PRIVATE_ASSET_DIR;
assert.equal(publicSamples.length, 2, 'The existing public samples stay separate from the protected trip photographs.');
assert.equal(privateSamples.length, 7, 'Seven website photographs must retain their private access boundary.');
for (const sample of publicSamples) for (const file of [sample.image, sample.depth]) await fs.access(path.join(assetRoot, file));
for (const sample of privateSamples) for (const file of [sample.image, sample.thumbnail, sample.depth]) {
  assert.match(file, /^\/private-photos\/assets\/v1\/[a-f0-9]{64}\.webp$/, 'Protected derivatives must use the existing private-photo namespace.');
  if (privateAssetDir) await fs.access(path.join(privateAssetDir, path.basename(file)));
}
if (privateAssetDir) {
  const protectedFiles = [...new Set(privateSamples.flatMap(sample => [sample.image, sample.thumbnail, sample.depth]))];
  const protectedBytes = await Promise.all(protectedFiles.map(file => fs.readFile(path.join(privateAssetDir, path.basename(file)))));
  const protectedHashes = new Set(protectedBytes.map(bytes => createHash('sha256').update(bytes).digest('hex')));
  const protectedEncoded = protectedBytes.map(bytes => bytes.toString('base64'));
  async function checkPublicFiles(directory) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) { await checkPublicFiles(filename); continue; }
      if (!entry.isFile()) continue;
      const bytes = await fs.readFile(filename);
      assert.ok(!protectedHashes.has(createHash('sha256').update(bytes).digest('hex')), 'Protected source, thumbnail, or depth bytes must never enter public output.');
      if (/\.(?:html|json|js|css|svg)$/.test(entry.name)) {
        const text = bytes.toString('utf8');
        assert.ok(protectedEncoded.every(encoded => !text.includes(encoded)), 'Public output must not embed protected pixel bytes as base64.');
      }
    }
  }
  await checkPublicFiles(publicRoot);
}
const gentleLimits = [.0234, .0117];
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
  async function makePage(options = {}, noWebGL = false, privateAccess = false, hash = '', authFlow = 'guest', returnHash = '') {
    const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, ...options });
    contexts.push(context);
    const page = await context.newPage();
    const errors = [];
    const depthRequests = [];
    const privateRequests = [];
    const authWindows = [];
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    const fixtureToken = 'depth-browser-fixture-token';
    page.on('pageerror', error => errors.push(String(error)));
    page.on('request', request => { if (request.method() !== 'OPTIONS' && manifest.samples.some(sample => new URL(request.url()).pathname === new URL(sample.depth, `${url}assets/`).pathname)) depthRequests.push(request.url()); });
    await page.route('**/private-photos/**', async route => {
      const request = route.request(), pathname = new URL(request.url()).pathname;
      const headers = { 'access-control-allow-origin': new URL(url).origin, 'access-control-allow-headers': 'Authorization, Content-Type' };
      if (request.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers }); return; }
      if (pathname === '/private-photos/auth/status') {
        await route.fulfill({ status: privateAccess ? 200 : 401, headers, json: { unlocked: privateAccess, expiresAt } }); return;
      }
      if (pathname === '/private-photos/auth/redeem' && authFlow === 'return') {
        assert.deepEqual(request.postDataJSON(), { code: 'fixture-code', verifier: 'fixture-verifier' });
        await route.fulfill({ status: 200, headers, json: { token: fixtureToken, expiresAt } }); return;
      }
      if (pathname === '/private-photos/auth/window' && authFlow === 'missing') {
        const params = new URL(request.url()).searchParams;
        authWindows.push({ action: params.get('action'), returnTo: params.get('returnTo') });
        assert.equal(new URL(params.get('returnTo')).origin, new URL(url).origin);
        const location = `${params.get('returnTo')}#photoAuthMissing=1&state=${encodeURIComponent(params.get('state'))}`;
        await route.fulfill({ status: 302, headers: { location } }); return;
      }
      if (/^\/private-photos\/assets\/v1\/[a-f0-9]{64}\.webp$/.test(pathname)) {
        privateRequests.push({ pathname, authorized: request.headers().authorization === `Bearer ${fixtureToken}` });
        if (!privateAccess || !privateAssetDir || request.headers().authorization !== `Bearer ${fixtureToken}`) { await route.fulfill({ status: 401, headers }); return; }
        await route.fulfill({ status: 200, headers, contentType: 'image/webp', body: await fs.readFile(path.join(privateAssetDir, path.basename(pathname))) }); return;
      }
      await route.abort();
    });
    await page.addInitScript(({ privateAccess, expiresAt, fixtureToken, authFlow, returnHash }) => {
      if (authFlow === 'return') sessionStorage.setItem('atlas-photo-login', JSON.stringify({ state: 'fixture-state', verifier: 'fixture-verifier', hash: returnHash, created: Date.now() }));
      else if (privateAccess) sessionStorage.setItem('atlas-photo-access', JSON.stringify({ token: fixtureToken, expiresAt }));
      else if (authFlow === 'guest') sessionStorage.setItem('atlas-photo-guest', '1');
    }, { privateAccess, expiresAt, fixtureToken, authFlow, returnHash });
    await page.addInitScript(({ noWebGL }) => {
      window.depthQA = { draws: 0, colors: 0, touchEvents: [], maxOffset: [0, 0], maxLevel: 0, deletedTextures: 0, deletedPrograms: 0, blobs: [], revoked: [] };
      const createObjectURL = URL.createObjectURL, revokeObjectURL = URL.revokeObjectURL;
      URL.createObjectURL = function (object) { const result = createObjectURL.call(this, object); depthQA.blobs.push(result); return result; };
      URL.revokeObjectURL = function (value) { depthQA.revoked.push(value); return revokeObjectURL.call(this, value); };
      document.addEventListener('pointerdown', event => { if (event.target.closest?.('#image-frame')) depthQA.pointerId = event.pointerId; });
      if (noWebGL) {
        const getContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (type, ...rest) { return /webgl/.test(type) ? null : getContext.call(this, type, ...rest); };
      } else {
        for (const [method, counter] of [['deleteTexture', 'deletedTextures'], ['deleteProgram', 'deletedPrograms']]) {
          const original = WebGLRenderingContext.prototype[method];
          WebGLRenderingContext.prototype[method] = function (...args) { if (this.canvas.id === 'depth-canvas') depthQA[counter]++; return original.apply(this, args); };
        }
        const drawArrays = WebGLRenderingContext.prototype.drawArrays;
        WebGLRenderingContext.prototype.drawArrays = function (...args) {
          drawArrays.apply(this, args);
          if (this.canvas.id !== 'depth-canvas') return;
          depthQA.draws++;
          const program = this.getParameter(this.CURRENT_PROGRAM);
          depthQA.amount = this.getUniform(program, this.getUniformLocation(program, 'amount'));
          depthQA.offset = [...this.getUniform(program, this.getUniformLocation(program, 'offset'))];
          depthQA.level = this.getUniform(program, this.getUniformLocation(program, 'depthLevel'));
          depthQA.maxOffset = depthQA.offset.map((value, axis) => Math.max(Math.abs(value), depthQA.maxOffset[axis]));
          depthQA.maxLevel = Math.max(depthQA.maxLevel, depthQA.level);
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
    await page.goto(`${url}${hash}`);
    await page.locator('.sample').first().waitFor();
    return { page, context, errors, depthRequests, privateRequests, expiresAt, authWindows };
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
  async function assertGentleFrames(page) {
    const { maxOffset, maxLevel } = await page.evaluate(() => depthQA);
    maxOffset.forEach((value, axis) => assert.ok(value <= gentleLimits[axis] + .000001, `Every rendered frame must stay in the original gentle range on axis ${axis}: ${value}`));
    assert.ok(maxLevel <= 1, 'No rendered frame may amplify the original gentle movement.');
  }
  const privateSnapshot = page => page.evaluate(() => ({
    enabled: document.querySelector('#depth-toggle').getAttribute('aria-checked'),
    active: document.querySelector('#image-frame').classList.contains('is-active'),
    blobImages: [...document.images].filter(image => image.src.startsWith('blob:')).length,
    remainingBlobs: depthQA.blobs.filter(value => !depthQA.revoked.includes(value)).length,
    deletedTextures: depthQA.deletedTextures,
    deletedPrograms: depthQA.deletedPrograms,
    draws: depthQA.draws,
  }));
  function assertPrivateCleared(snapshot, previous, label) {
    assert.equal(snapshot.enabled, 'false', `${label}: motion returns off`);
    assert.equal(snapshot.active, false, `${label}: protected canvas is hidden`);
    assert.equal(snapshot.blobImages, 0, `${label}: no private image pixels remain mounted`);
    assert.equal(snapshot.remainingBlobs, 0, `${label}: protected blob cache is revoked`);
    assert.ok(snapshot.deletedTextures >= previous.deletedTextures + 2 && snapshot.deletedPrograms > previous.deletedPrograms, `${label}: private GPU textures and renderer are released`);
  }
  const { page, errors, depthRequests } = await makePage();
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
  assert.equal(await page.locator('#strength').getAttribute('min'), '0');
  assert.equal(await page.locator('#strength').getAttribute('max'), '100');
  assert.equal(await page.locator('[data-depth], #depth-note').count(), 0, 'Dramatic presets and their warning are removed.');
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
  await page.locator('#pointer-mode').click();
  await page.mouse.move(rect.x + rect.width * .8, rect.y + rect.height * .8);
  await settle(page);
  const pointerView = await view(page);
  assert.ok(pointerView.offset.every(axis => Math.abs(axis) > .001), 'Explicit Mouse move mode follows hover in both axes.');
  assert.notDeepEqual(pointerView.pixels, dragged.pixels, 'Mouse move changes rendered pixels.');
  await page.mouse.move(5, 80);
  await settle(page);
  for (const axis of (await view(page)).offset) near(axis, 0, 'Leaving Mouse move returns to center');
  await drag(page);
  await settle(page);
  assert.equal(await page.locator('#drag-mode').getAttribute('aria-pressed'), 'true', 'Dragging takes over from Mouse move.');
  const pointerTakeover = await view(page);
  await page.mouse.move(rect.x + 20, rect.y + 20);
  await page.waitForTimeout(100);
  assert.deepEqual((await view(page)).offset, pointerTakeover.offset, 'Drag takeover restores held viewpoint rather than hover tracking.');
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
  for (const level of [.25, .5, 1]) await setStrength(page, level);
  await drag(page, .9, .9);
  await settle(page);
  const bounded = await view(page);
  bounded.offset.forEach((value, axis) => assert.ok(Math.abs(value) <= gentleLimits[axis] + .000001, 'Large captured drags stay within the original gentle range.'));
  await assertLayout(page, 'desktop-gentle-100');
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
  assert.deepEqual((await view(page)).pixels, flatDragged.pixels, '0% movement must render the identical uncropped original at any viewpoint.');
  await setStrength(page, .5);
  await drag(page);
  await settle(page);
  const halfMovement = await view(page);
  await setStrength(page, 1);
  const fullMovement = await view(page);
  assert.deepEqual(fullMovement.offset, halfMovement.offset, 'Movement level preserves the chosen viewpoint.');
  assert.notDeepEqual(fullMovement.pixels, halfMovement.pixels, 'Movement from 50% to 100% must change the same viewpoint.');
  near(fullMovement.level, 2 * halfMovement.level, '100% is twice 50%, capped at the original gentle setting');
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
  await assertGentleFrames(page);
  assert.deepEqual(errors, []);

  const direct = await makePage({}, false, false, '#photo-1');
  await direct.page.waitForFunction(() => document.querySelector('#viewer').open && !document.querySelector('#depth-toggle').disabled);
  assert.equal(await direct.page.locator('#depth-toggle').getAttribute('aria-checked'), 'false');
  await direct.page.locator('#back').click();
  await direct.page.waitForFunction(() => !document.querySelector('#viewer').open, null, { timeout: 5000 });
  assert.equal(new URL(direct.page.url()).pathname, '/experiments/depth/', 'Direct photo Back stays inside the demo.');
  await direct.page.goForward();
  await direct.page.waitForFunction(() => document.querySelector('#viewer').open && !document.querySelector('#depth-toggle').disabled);
  assert.equal(await direct.page.locator('#depth-toggle').getAttribute('aria-checked'), 'false');
  assert.deepEqual(direct.errors, []);

  const missingAccess = await makePage({}, false, false, '', 'missing');
  await missingAccess.page.waitForFunction(() => sessionStorage.getItem('atlas-photo-guest') === '1');
  await missingAccess.page.locator('.photo-unlock-dialog[open]').waitFor();
  assert.equal(missingAccess.authWindows.length, 1, 'A fresh tab checks remembered access once.');
  assert.equal(missingAccess.authWindows[0].action, 'restore');
  assert.equal(missingAccess.privateRequests.length, 0, 'Missing remembered access never fetches protected pixels.');
  await missingAccess.page.locator('.photo-unlock-dialog [data-dismiss]').click();
  await missingAccess.page.reload();
  await missingAccess.page.locator('.sample').first().waitFor();
  await missingAccess.page.waitForTimeout(100);
  assert.equal(missingAccess.authWindows.length, 1, 'The normal guest return does not create a restore loop.');
  await openSample(missingAccess.page);
  assert.deepEqual(missingAccess.errors, []);

  const mobile = await makePage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await openSample(mobile.page);
  await turnOn(mobile.page);
  await setStrength(mobile.page, 1);
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
  await assertLayout(mobile.page, 'phone-390-gentle-100');
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
  await setStrength(mobile.page, 1);
  await drag(mobile.page, .5, .5);
  await settle(mobile.page);
  await assertLayout(mobile.page, 'phone-390-portrait-gentle-100');
  await assertGentleFrames(mobile.page);
  assert.deepEqual(mobile.errors, []);

  for (const [width, height] of [[320, 568], [844, 390]]) {
    const compact = await makePage({ viewport: { width, height }, hasTouch: true });
    await openSample(compact.page, width === 320 ? 1 : 0);
    await turnOn(compact.page);
    await setStrength(compact.page, 1);
    await drag(compact.page, .5, .5);
    await settle(compact.page);
    await assertLayout(compact.page, `viewport-${width}x${height}-gentle-100`);
    await assertGentleFrames(compact.page);
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
  await assertGentleFrames(reduced.page);
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

  const remoteContext = await browser.newContext();
  contexts.push(remoteContext);
  const remotePage = await remoteContext.newPage();
  const remoteErrors = [];
  const remoteAuthRequests = [];
  remotePage.on('pageerror', error => remoteErrors.push(String(error)));
  remotePage.on('request', request => { if (request.url().includes('photo-auth.js') || request.url().includes('/private-photos/')) remoteAuthRequests.push(request.url()); });
  await remotePage.addInitScript(() => sessionStorage.setItem('atlas-photo-guest', '1'));
  let remotePublished = false;
  await remotePage.route('**/private-photos/**', route => route.abort());
  await remotePage.route('http://depth-preview.invalid/**', async route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith('/assets/manifest.json')) {
      await route.fulfill({ json: { ...manifest, samples: manifest.samples.map(sample => sample.protected ? { ...sample, assetStatus: remotePublished ? 'published' : 'local' } : sample) } }); return;
    }
    const filename = path.resolve(publicRoot, `.${pathname.endsWith('/') ? `${pathname}index.html` : pathname}`);
    assert.ok(filename.startsWith(`${publicRoot}${path.sep}`));
    try { await route.fulfill({ contentType: types[path.extname(filename)] || 'application/octet-stream', body: await fs.readFile(filename) }); }
    catch { await route.fulfill({ status: 404 }); }
  });
  await remotePage.goto('http://depth-preview.invalid/experiments/depth/#photo-9');
  await remotePage.locator('.sample').first().waitFor();
  assert.equal(await remotePage.locator('.sample').count(), publicSamples.length, 'A remote host cannot advertise private samples before verified publication.');
  assert.notEqual(await remotePage.locator('#private-preview-note').getAttribute('hidden'), null);
  assert.deepEqual(remoteAuthRequests, [], 'A public-only remote preview loads no photo-auth helper and makes no authentication request.');
  assert.equal(await remotePage.locator('#viewer').evaluate(element => element.open), false, 'An unpublished private deep link does not open an unavailable viewer.');
  remotePublished = true;
  await remotePage.goto('http://depth-preview.invalid/experiments/depth/');
  await remotePage.locator('.sample').first().waitFor();
  assert.equal(await remotePage.locator('.sample').count(), manifest.samples.length, 'A remote host includes the verified published private samples.');
  assert.equal(await remotePage.locator('#private-preview-note').getAttribute('hidden'), null);
  await remotePage.route('**/assets/photo-auth.js*', route => route.abort());
  await remotePage.reload();
  await remotePage.locator('.sample').first().waitFor();
  assert.equal(await remotePage.locator('.sample').count(), publicSamples.length, 'A failed photo-auth helper retains working public examples.');
  assert.match(await remotePage.locator('#intro-note').textContent(), /Trip photo access could not load/);
  await openSample(remotePage);
  assert.ok(await remotePage.locator('#still').evaluate(element => element.naturalWidth > 0), 'Public still photos remain available after auth helper failure.');
  assert.deepEqual(remoteErrors, []);
  await remoteContext.close();

  const privateIndex = manifest.samples.findIndex(sample => sample.protected);
  const locked = await makePage();
  await locked.page.locator('.sample').nth(privateIndex).click();
  await locked.page.waitForTimeout(100);
  assert.equal(await locked.page.evaluate(() => JOURNEY_ATLAS_AUTH.unlocked), false);
  assert.equal(locked.privateRequests.length, 0, 'A locked private sample must not download photos, thumbnails, or depth.');
  assert.equal((await privateSnapshot(locked.page)).blobImages, 0, 'A locked sample must not expose private photo pixels.');
  assert.equal((await privateSnapshot(locked.page)).active, false);
  assert.equal(await locked.page.locator('#depth-toggle').isDisabled(), true, 'Locked photographs cannot enable their depth map.');
  if (screenshotDir) await locked.page.screenshot({ path: path.join(screenshotDir, 'private-locked.png') });
  assert.deepEqual(locked.errors, []);

  if (privateAssetDir) {
    const loginReturn = await makePage({ reducedMotion: 'reduce' }, false, true, '#photoAuthCode=fixture-code&state=fixture-state', 'return', `#photo-${privateIndex + 1}`);
    await loginReturn.page.waitForFunction(() => JOURNEY_ATLAS_AUTH.unlocked && document.querySelector('#viewer').open && !document.querySelector('#depth-toggle').disabled);
    assert.equal(new URL(loginReturn.page.url()).hash, `#photo-${privateIndex + 1}`, 'The real login callback restores the selected photo URL without its one-use code.');
    assert.equal(await loginReturn.page.locator('#depth-toggle').getAttribute('aria-checked'), 'false');
    await loginReturn.page.locator('#back').click();
    await loginReturn.page.waitForFunction(() => !document.querySelector('#viewer').open, null, { timeout: 5000 });
    assert.equal(new URL(loginReturn.page.url()).pathname, '/experiments/depth/', 'Back after real login return stays on the sample grid.');
    await loginReturn.page.goForward();
    await loginReturn.page.waitForFunction(() => document.querySelector('#viewer').open && !document.querySelector('#depth-toggle').disabled);
    assert.equal(await loginReturn.page.locator('#photo-count').textContent(), `${privateIndex + 1} / ${manifest.samples.length}`);
    assert.equal(await loginReturn.page.locator('#depth-toggle').getAttribute('aria-checked'), 'false');
    assert.deepEqual(loginReturn.errors, []);
    const privateFailure = await makePage({ reducedMotion: 'reduce' }, false, true);
    let failedPrivateDepth = false;
    await privateFailure.page.route(`**${manifest.samples[privateIndex].depth}`, async route => {
      if (route.request().method() === 'OPTIONS' || failedPrivateDepth) { await route.fallback(); return; }
      failedPrivateDepth = true;
      await route.fulfill({ status: 404, headers: { 'access-control-allow-origin': new URL(url).origin } });
    });
    await openSample(privateFailure.page, privateIndex);
    await privateFailure.page.locator('#depth-toggle').click();
    await privateFailure.page.waitForFunction(() => document.querySelector('#status').textContent.includes('could not load'));
    assert.equal(await privateFailure.page.locator('#depth-toggle').getAttribute('aria-checked'), 'false');
    assert.ok(await privateFailure.page.locator('#still').evaluate(element => element.naturalWidth > 0), 'A missing protected map retains its authorized original photo.');
    await turnOn(privateFailure.page);
    await privateFailure.page.waitForFunction(() => depthQA.colors > 3);
    assert.deepEqual(privateFailure.errors, []);
    const allSamples = await makePage({ reducedMotion: 'reduce' }, false, true);
    await allSamples.page.waitForFunction(() => JOURNEY_ATLAS_AUTH.unlocked);
    for (let index = 0; index < manifest.samples.length; index++) {
      if (index === 0) await openSample(allSamples.page);
      else {
        await allSamples.page.locator('#filmstrip button').nth(index).click();
        await allSamples.page.waitForFunction(() => !document.querySelector('#depth-toggle').disabled);
      }
      assert.equal(await allSamples.page.locator('#depth-toggle').getAttribute('aria-checked'), 'false', `Sample ${index + 1} opens still.`);
      assert.equal(allSamples.depthRequests.length, index, `Sample ${index + 1} does not fetch depth before activation.`);
      await allSamples.page.evaluate(() => { depthQA.colors = 0; });
      await turnOn(allSamples.page);
      await allSamples.page.waitForFunction(() => depthQA.colors > 3);
      await settle(allSamples.page);
      assert.equal(allSamples.depthRequests.length, index + 1, `Only sample ${index + 1}'s depth is fetched.`);
      const beforeDrag = await view(allSamples.page);
      await drag(allSamples.page);
      await settle(allSamples.page);
      assert.notDeepEqual((await view(allSamples.page)).pixels, beforeDrag.pixels, `Sample ${index + 1} renders a live depth movement.`);
      await assertLayout(allSamples.page, `sample-${index + 1}-gentle`);
    }
    assert.ok(allSamples.privateRequests.length > 0 && allSamples.privateRequests.every(request => request.authorized), 'Every protected request goes through the existing authenticated helper.');
    await assertGentleFrames(allSamples.page);
    const beforeLock = await privateSnapshot(allSamples.page);
    await allSamples.page.evaluate(() => JOURNEY_ATLAS_AUTH.lock());
    await allSamples.page.waitForTimeout(100);
    const afterLock = await privateSnapshot(allSamples.page);
    assertPrivateCleared(afterLock, beforeLock, 'Shared lock');
    await allSamples.page.waitForTimeout(100);
    assert.equal((await privateSnapshot(allSamples.page)).draws, afterLock.draws, 'Lock stops private rendering.');
    assert.deepEqual(allSamples.errors, []);

    const stalePrivate = await makePage({ reducedMotion: 'reduce' }, false, true);
    await stalePrivate.page.waitForFunction(() => JOURNEY_ATLAS_AUTH.unlocked);
    const pendingSample = manifest.samples[privateIndex];
    let releasePrivateDepth, signalPrivateDepth, finishPrivateDepth;
    const holdPrivateDepth = new Promise(resolve => { releasePrivateDepth = resolve; });
    const privateDepthStarted = new Promise(resolve => { signalPrivateDepth = resolve; });
    const privateDepthFinished = new Promise(resolve => { finishPrivateDepth = resolve; });
    await stalePrivate.page.route(`**${pendingSample.depth}`, async route => {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: { 'access-control-allow-origin': new URL(url).origin, 'access-control-allow-headers': 'Authorization, Content-Type' } }); return;
      }
      assert.equal(route.request().headers().authorization, 'Bearer depth-browser-fixture-token');
      signalPrivateDepth();
      await holdPrivateDepth;
      try {
        await route.fulfill({ status: 200, contentType: 'image/webp', headers: { 'access-control-allow-origin': new URL(url).origin }, body: await fs.readFile(path.join(privateAssetDir, path.basename(pendingSample.depth))) });
      } catch { /* Lock deliberately aborts the in-flight authenticated fetch. */ }
      finally { finishPrivateDepth(); }
    });
    await openSample(stalePrivate.page, privateIndex);
    await stalePrivate.page.locator('#depth-toggle').click();
    await privateDepthStarted;
    await stalePrivate.page.evaluate(() => JOURNEY_ATLAS_AUTH.lock());
    releasePrivateDepth();
    await privateDepthFinished;
    await stalePrivate.page.waitForTimeout(100);
    const afterStaleLock = await privateSnapshot(stalePrivate.page);
    assert.equal(afterStaleLock.active, false, 'Late private depth must not reactivate the viewer after lock.');
    assert.equal(afterStaleLock.enabled, 'false');
    assert.equal(afterStaleLock.blobImages, 0);
    assert.equal(afterStaleLock.remainingBlobs, 0, 'Late private data must not repopulate the cleared blob cache.');
    assert.equal(afterStaleLock.draws, 0);
    assert.deepEqual(stalePrivate.errors, []);

    const expiry = await makePage({ reducedMotion: 'reduce' }, false, true);
    await expiry.page.waitForFunction(() => JOURNEY_ATLAS_AUTH.unlocked);
    await openSample(expiry.page, privateIndex);
    await turnOn(expiry.page);
    await settle(expiry.page);
    const beforeExpiry = await privateSnapshot(expiry.page);
    let reportExpiry;
    const expiredSnapshot = new Promise(resolve => { reportExpiry = resolve; });
    await expiry.page.exposeFunction('reportDepthExpiry', snapshot => reportExpiry(snapshot));
    await expiry.page.evaluate(expiresAt => {
      addEventListener('atlas-photos-locked', () => queueMicrotask(() => window.reportDepthExpiry({
        enabled: document.querySelector('#depth-toggle').getAttribute('aria-checked'),
        active: document.querySelector('#image-frame').classList.contains('is-active'),
        blobImages: [...document.images].filter(image => image.src.startsWith('blob:')).length,
        remainingBlobs: depthQA.blobs.filter(value => !depthQA.revoked.includes(value)).length,
        deletedTextures: depthQA.deletedTextures,
        deletedPrograms: depthQA.deletedPrograms,
      })), { once: true });
      Date.now = () => expiresAt * 1000 + 1;
      dispatchEvent(new Event('focus'));
    }, expiry.expiresAt);
    let expiryTimer;
    try {
      const snapshot = await Promise.race([expiredSnapshot, new Promise((_, reject) => { expiryTimer = setTimeout(() => reject(new Error('Private expiry did not clear the viewer.')), 5000); })]);
      assertPrivateCleared(snapshot, beforeExpiry, 'Shared access expiry');
    } finally { clearTimeout(expiryTimer); }
    console.log('Protected fixture checks passed: all nine samples, lazy depth, authenticated requests, real shared lock/expiry, stale private load cancellation, revoked image cache and released GPU textures.');
  } else console.log('Protected rendering/expiry cases skipped: set DEPTH_PRIVATE_ASSET_DIR to the ignored local derivative directory. Locked-state privacy checks passed.');
  console.log('Depth preview browser checks passed: lazy depth, rendered pixels, drag/hold, explicit Mouse move, reset/keyboard, 0–100% gentle movement, bounds, pointer/drift takeover, pause/resume, capture cleanup, compare, off/close, navigation/history, native fullscreen, vertical touch, responsive layouts, reduced motion, download retry, stale response, WebGL fallback.');
} finally {
  for (const context of contexts) await context.close();
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
