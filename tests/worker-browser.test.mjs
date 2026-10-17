/** Real dedicated-worker regressions. Run only in the authorized Chromium/CI workflow. */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { createAppServer } from '../scripts/serve.mjs';

let browser, server, origin;
before(async () => {
  server = createAppServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  const executablePath = process.env.CHROMIUM_PATH ?? (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
  browser = await chromium.launch({ executablePath, headless: process.env.SIDEKICK_HEADED !== '1', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
});
after(async () => { await browser?.close(); if (server) await new Promise(resolve => server.close(resolve)); });

async function pageFor(t, { entry = 'native', csp = '', failWorker = '', contextLoss = false, touch = false } = {}) {
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 }, reducedMotion: 'no-preference', hasTouch: touch }), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  t.after(async () => { await page.close(); assert.deepEqual(errors, [], 'No uncaught page exceptions'); });
  await page.addInitScript(({ failWorker }) => {
    const audit = window.workerAudit = { workers: [], created: 0, terminated: 0, transfers: 0, mainContexts: 0, errors: [] };
    const NativeWorker = Worker, transfer = HTMLCanvasElement.prototype.transferControlToOffscreen, getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.transferControlToOffscreen = function (...args) { audit.transfers++; return transfer.apply(this, args); };
    HTMLCanvasElement.prototype.getContext = function (kind, ...args) { if (kind === 'webgl2') audit.mainContexts++; return getContext.call(this, kind, ...args); };
    window.Worker = class extends NativeWorker {
      constructor(url, options) { if (failWorker === 'constructor') throw new DOMException('Test worker denied', 'SecurityError'); super(failWorker === 'network' ? '/missing-render-worker.js' : url, options); audit.created++; audit.workers.push(this); }
      terminate() { audit.terminated++; return super.terminate(); }
    };
    document.addEventListener('sidekick-error', event => audit.errors.push(event.detail));
  }, { failWorker });
  if (contextLoss) await page.route('**/src/runtime/render-worker.js', async route => {
    const response = await route.fetch(), code = await response.text();
    // Test-only worker instrumentation exercises the real OffscreenCanvas WebGL context.
    const prefix = `let testContext; const originalContext = OffscreenCanvas.prototype.getContext; OffscreenCanvas.prototype.getContext = function(kind,...args){const result=originalContext.call(this,kind,...args);if(kind==='webgl2')testContext=result;return result;}; self.addEventListener('message',event=>{if(event.data?.testLoseContext)testContext?.getExtension('WEBGL_lose_context')?.loseContext();});\n`;
    await route.fulfill({ response, body: prefix + code });
  });
  const script = entry === 'classic' ? '<script src="/browser/sidekick.iife.js"></script>' : `<script type="module" src="${entry === 'native' ? '/src/auto.js' : '/browser/sidekick.js'}"></script>`;
  await page.route(`${origin}/worker-test.html`, route => route.fulfill({ contentType: 'text/html', headers: csp ? { 'Content-Security-Policy': csp } : {}, body: `<!doctype html><html><head><meta charset="utf-8"><title>Worker rendering fixture</title><style>body{margin:0}sidekick-avatar{width:320px;height:280px;display:block}</style></head><body><sidekick-avatar id="avatar" activity="still" tracking-mode="off"></sidekick-avatar>${script}</body></html>` }));
  await page.goto(`${origin}/worker-test.html`);
  await page.waitForFunction(() => document.getElementById('avatar')?.ready, null, { timeout: 20000 });
  return page;
}

for (const entry of ['native', 'esm', 'classic']) test(`${entry}: default rendering owns a real transferred worker surface`, async t => {
  const page = await pageFor(t, { entry });
  const state = await page.evaluate(async () => {
    const avatar = document.getElementById('avatar'), image = await avatar.capturePixelsAsync();
    return { backend: avatar.diagnostics.backend, width: image.width, height: image.height, alpha: image.pixels.some((value, index) => index % 4 === 3 && value), audit: { created: workerAudit.created, transfers: workerAudit.transfers, mainContexts: workerAudit.mainContexts }, diagnostics: avatar.diagnostics };
  });
  assert.equal(state.backend, 'worker'); assert.equal(state.alpha, true); assert.deepEqual(state.audit, { created: 1, transfers: 1, mainContexts: 0 });
  assert.equal(state.diagnostics.revision, state.diagnostics.acknowledgedRevision); assert.ok(state.diagnostics.renderCpu.totalMs >= 0);
  assert.ok(page.workers().length >= 1);
});

test('fresh readback flushes immediate CSS size/design/camera changes and exports exact alpha bounds', async t => {
  const page = await pageFor(t);
  const result = await page.evaluate(async () => {
    const avatar = document.getElementById('avatar'); avatar.paused = true;
    avatar.style.width = '511px'; avatar.style.height = '233px'; avatar.setCamera({ yaw: 33, pitch: 9, roll: -8 }); await avatar.updateDesign({ body: { color: '#3366aa' } });
    const image = await avatar.capturePixelsAsync();
    let minX = image.width, minY = image.height, maxX = -1, maxY = -1, alphaSum = 0;
    for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) { const alpha = image.pixels[(y * image.width + x) * 4 + 3]; alphaSum += alpha; if (alpha) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); } }
    const blob = await avatar.snapshot({ padding: 7 }), bitmap = await createImageBitmap(blob), canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
    const context = canvas.getContext('2d'); context.drawImage(bitmap, 0, 0); bitmap.close();
    const png = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let exportedAlpha = 0, edgeSamples = 0, maxEdgeError = 0; for (let i = 3; i < png.length; i += 4) exportedAlpha += png[i];
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const source = (y * image.width + x) * 4, alpha = image.pixels[source + 3];
      if (alpha < 32 || alpha >= 255) continue;
      const target = ((maxY - y + 7) * canvas.width + x - minX + 7) * 4; edgeSamples++;
      for (let channel = 0; channel < 3; channel++) maxEdgeError = Math.max(maxEdgeError, Math.abs(png[target + channel] - Math.min(255, Math.round(image.pixels[source + channel] * 255 / alpha))));
    }
    return { edgeSamples, maxEdgeError, size: [image.width, image.height], expected: [Math.round(511 * Math.min(devicePixelRatio, 2)), Math.round(233 * Math.min(devicePixelRatio, 2))], png: [canvas.width, canvas.height], bounds: [maxX - minX + 1 + 14, maxY - minY + 1 + 14], alphaSum, exportedAlpha, type: blob.type, camera: avatar.camera, color: avatar.design.body.color };
  });
  assert.deepEqual(result.size, result.expected); assert.deepEqual(result.png, result.bounds); assert.equal(result.type, 'image/png'); assert.equal(result.exportedAlpha, result.alphaSum); assert.ok(result.edgeSamples > 0); assert.ok(result.maxEdgeError <= 2, `PNG edge color drift ${result.maxEdgeError}`);
  assert.deepEqual(result.camera, { yaw: 33, pitch: 9, roll: -8, zoom: 1 }); assert.equal(result.color, '#3366aa');
});

test('independent worker motion requests survive color edits and settle cancellation on disconnect', async t => {
  const page = await pageFor(t);
  const result = await page.evaluate(async () => {
    const avatar = document.getElementById('avatar');
    const eye = avatar.setEyeWeights('left', { smile: 1 }, { duration: 3000, easing: 'linear' });
    const body = avatar.motion.to({ body: { rotation: [.2, .3, 0] } }, { duration: 60000, easing: 'linear' });
    const progress = async threshold => {
      const deadline = performance.now() + 10000;
      while (performance.now() < deadline) { await avatar.capturePixelsAsync(); const pose = avatar.pose; if (pose.eyes.left.smile >= threshold) return pose; await new Promise(resolve => setTimeout(resolve, 16)); }
      throw new Error('Worker motion did not acknowledge progress');
    };
    const before = await progress(.1);
    await avatar.updateDesign({ body: { color: '#417a9c' } }); const after = await progress(before.eyes.left.smile + .05);
    const eyeResult = await eye; avatar.remove(); const bodyResult = await body;
    return { before, after, eyeResult, bodyResult, diagnostics: avatar.diagnostics, terminated: workerAudit.terminated };
  });
  assert.ok(result.before.eyes.left.smile > 0 && result.before.eyes.left.smile < 1); assert.ok(result.after.eyes.left.smile > result.before.eyes.left.smile && result.after.eyes.left.smile < 1);
  assert.deepEqual(result.eyeResult, { finished: true }); assert.deepEqual(result.bodyResult, { finished: false }); assert.equal(result.diagnostics.buffers, 0); assert.equal(result.terminated, 1);
});

test('worker WebGL context loss terminates its generation and replaces the canvas for local recovery', async t => {
  const page = await pageFor(t, { contextLoss: true });
  await page.evaluate(() => { const avatar = document.getElementById('avatar'); window.oldCanvas = avatar.shadowRoot.querySelector('canvas'); window.oldGeneration = avatar.diagnostics.generation; workerAudit.workers[0].postMessage({ testLoseContext: true }); });
  await page.waitForFunction(() => { const avatar = document.getElementById('avatar'); return avatar.ready && avatar.diagnostics.backend === 'main'; }, null, { timeout: 20000 });
  const result = await page.evaluate(async () => { const avatar = document.getElementById('avatar'), image = await avatar.capturePixelsAsync(); return { changed: oldCanvas !== avatar.shadowRoot.querySelector('canvas'), generation: avatar.diagnostics.generation, previous: oldGeneration, terminated: workerAudit.terminated, mainContexts: workerAudit.mainContexts, recoverable: workerAudit.errors.some(error => error.recoverable && /context lost/i.test(error.message)), alpha: image.pixels.some((value, i) => i % 4 === 3 && value) }; });
  assert.equal(result.changed, true); assert.ok(result.generation > result.previous); assert.equal(result.terminated, 1); assert.equal(result.mainContexts, 1); assert.equal(result.recoverable, true); assert.equal(result.alpha, true);
});

for (const failWorker of ['constructor', 'network']) test(`${failWorker} worker startup failure recovers with a fresh main surface`, async t => {
  const page = await pageFor(t, { failWorker });
  const result = await page.evaluate(async () => { const avatar = document.getElementById('avatar'), image = await avatar.capturePixelsAsync(); return { backend: avatar.diagnostics.backend, mainContexts: workerAudit.mainContexts, transfers: workerAudit.transfers, terminated: workerAudit.terminated, alpha: image.pixels.some((value, i) => i % 4 === 3 && value) }; });
  assert.equal(result.backend, 'main'); assert.equal(result.mainContexts, 1); assert.equal(result.alpha, true);
  assert.equal(result.transfers, failWorker === 'network' ? 1 : 0); assert.equal(result.terminated, failWorker === 'network' ? 1 : 0);
});

test('CSP worker-src none uses the supported fallback without relaxing policy', async t => {
  const page = await pageFor(t, { csp: "default-src 'self'; script-src 'self'; style-src 'unsafe-inline'; worker-src 'none'" });
  assert.equal(await page.locator('#avatar').evaluate(avatar => avatar.diagnostics.backend), 'main');
  assert.equal(await page.evaluate(() => workerAudit.mainContexts), 1);
});

test('disconnected worker surfaces are never reused and the next capture waits for its new generation', async t => {
  const page = await pageFor(t);
  const result = await page.evaluate(async () => {
    const avatar = document.getElementById('avatar'), old = avatar.shadowRoot.querySelector('canvas'), generation = avatar.diagnostics.generation;
    avatar.seek(13.5); await avatar.capturePixelsAsync(); avatar.remove(); document.body.append(avatar);
    const image = await avatar.capturePixelsAsync();
    return { replaced: old !== avatar.shadowRoot.querySelector('canvas'), generation: avatar.diagnostics.generation, previous: generation, time: avatar.diagnostics.time, backend: avatar.diagnostics.backend, created: workerAudit.created, terminated: workerAudit.terminated, alpha: image.pixels.some((value, i) => i % 4 === 3 && value) };
  });
  assert.equal(result.replaced, true); assert.ok(result.generation > result.previous); assert.equal(result.time, 13.5); assert.equal(result.backend, 'worker'); assert.equal(result.created, 2); assert.equal(result.terminated, 1); assert.equal(result.alpha, true);
});


test('demand-only synchronous capture uses acknowledged worker dimensions after presentation', async t => {
  const page = await pageFor(t);
  const result = await page.evaluate(async () => {
    const avatar = document.getElementById('avatar'); avatar.paused = true; avatar.style.width = '480px'; avatar.style.height = '240px';
    const fresh = await avatar.capturePixelsAsync();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const frames = avatar.diagnostics.frames, presented = avatar.capturePixels();
    const bounds = image => { let left = image.width, right = -1, bottom = image.height, top = -1; for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) if (image.pixels[(y * image.width + x) * 4 + 3] > 16) { left = Math.min(left, x); right = Math.max(right, x); bottom = Math.min(bottom, y); top = Math.max(top, y); } return [right - left + 1, top - bottom + 1]; };
    return { freshSize: [fresh.width, fresh.height], presentedSize: [presented.width, presented.height], freshBounds: bounds(fresh), presentedBounds: bounds(presented), unchanged: frames === avatar.diagnostics.frames };
  });
  assert.deepEqual(result.presentedSize, result.freshSize); assert.equal(result.unchanged, true);
  assert.ok(result.presentedBounds[0] > 0 && result.presentedBounds[1] > 0);
  for (let i = 0; i < 2; i++) assert.ok(Math.abs(result.presentedBounds[i] - result.freshBounds[i]) <= 1);
});

for (const failWorker of ['', 'constructor']) test(`${failWorker ? 'fallback' : 'worker'}: real wheel and Ctrl+wheel zoom only the preview`, async t => {
  const page = await pageFor(t, { failWorker });
  await page.locator('#avatar').evaluate(avatar => { avatar.interaction = 'box'; avatar.paused = true; });
  await page.mouse.move(160, 140); await page.mouse.wheel(0, -100);
  await page.waitForFunction(() => document.getElementById('avatar').camera.zoom > 1);
  const first = await page.locator('#avatar').evaluate(avatar => avatar.camera.zoom);
  assert.ok(Math.abs(first - Math.exp(.2)) < .001);
  await page.keyboard.down('Control'); await page.mouse.wheel(0, -40); await page.keyboard.up('Control');
  await page.waitForFunction(previous => document.getElementById('avatar').camera.zoom > previous, first);
  assert.equal(await page.evaluate(() => visualViewport.scale), 1);
  const before = await page.locator('#avatar').evaluate(avatar => { avatar.interaction = 'none'; return avatar.camera; });
  await page.mouse.wheel(0, -200);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.deepEqual(await page.locator('#avatar').evaluate(avatar => avatar.camera), before);
});

for (const failWorker of ['', 'constructor']) test(`${failWorker ? 'fallback' : 'worker'}: centered zoom preserves wide/tall aspect and PNG exports visible clipped pixels`, async t => {
  const page = await pageFor(t, { failWorker });
  const result = await page.evaluate(async () => {
    const avatar = document.getElementById('avatar'); avatar.paused = true; await avatar.updateDesign({ body: { shape: 'circle' } });
    const bounds = image => {
      let left = image.width, right = -1, bottom = image.height, top = -1, alpha = 0;
      for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) { const value = image.pixels[(y * image.width + x) * 4 + 3]; alpha += value; if (value) { left = Math.min(left, x); right = Math.max(right, x); bottom = Math.min(bottom, y); top = Math.max(top, y); } }
      return { width: right - left + 1, height: top - bottom + 1, center: [(right + left + 1) / 2, (top + bottom + 1) / 2], alpha };
    };
    const cases = [];
    for (const [width, height] of [[480, 240], [240, 480]]) {
      avatar.style.width = `${width}px`; avatar.style.height = `${height}px`; avatar.resetCamera();
      const normal = bounds(await avatar.capturePixelsAsync()); avatar.setCamera({ zoom: 1.5 }); const zoomed = bounds(await avatar.capturePixelsAsync());
      cases.push({ width, height, normal, zoomed });
    }
    avatar.style.width = '240px'; avatar.style.height = '240px'; avatar.setCamera({ zoom: 3 });
    const clipped = bounds(await avatar.capturePixelsAsync()), blob = await avatar.snapshot({ padding: 0 }), bitmap = await createImageBitmap(blob), output = document.createElement('canvas');
    output.width = bitmap.width; output.height = bitmap.height; const context = output.getContext('2d'); context.drawImage(bitmap, 0, 0); bitmap.close();
    const pixels = context.getImageData(0, 0, output.width, output.height).data; let alpha = 0; for (let i = 3; i < pixels.length; i += 4) alpha += pixels[i];
    return { cases, clipped, png: { width: output.width, height: output.height, alpha } };
  });
  for (const { width, height, normal, zoomed } of result.cases) {
    assert.ok(Math.abs(normal.width / normal.height - 1) < .02); assert.ok(Math.abs(zoomed.width / zoomed.height - 1) < .02);
    assert.ok(Math.abs(zoomed.width / normal.width - 1.5) < .04);
    assert.ok(Math.abs((zoomed.center[0] - width / 2) - 1.5 * (normal.center[0] - width / 2)) <= 1);
    assert.ok(Math.abs((zoomed.center[1] - height / 2) - 1.5 * (normal.center[1] - height / 2)) <= 1);
  }
  assert.equal(result.png.width, result.clipped.width); assert.equal(result.png.height, result.clipped.height); assert.equal(result.png.alpha, result.clipped.alpha);
  assert.equal(result.clipped.width, 240, 'high zoom intentionally clips at canvas edge');
});

test('real two-finger touch transitions orbit → pinch → orbit without jumps, pan or activation', async t => {
  const page = await pageFor(t, { touch: true }), cdp = await page.context().newCDPSession(page);
  t.after(() => cdp.detach());
  await page.locator('#avatar').evaluate(avatar => { avatar.interaction = 'box'; avatar.paused = true; window.activations = 0; avatar.addEventListener('sidekick-activate', () => activations++); });
  const touch = async (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([id, x, y]) => ({ id, x, y, radiusX: 4, radiusY: 4, force: 1 })) });
  const camera = () => page.locator('#avatar').evaluate(async avatar => { await avatar.capturePixelsAsync(); return avatar.camera; });
  await touch('touchStart', [[1, 100, 100]]); await touch('touchMove', [[1, 120, 100]]); const orbit = await camera(); assert.ok(orbit.yaw > 0);
  await touch('touchStart', [[1, 120, 100], [2, 220, 100]]);
  await touch('touchMove', [[1, 100, 100], [2, 240, 100]]); const pinch = await camera();
  assert.ok(Math.abs(pinch.zoom - 1.4) < .01); assert.equal(pinch.yaw, orbit.yaw); assert.equal(pinch.pitch, orbit.pitch);
  await touch('touchMove', [[1, 120, 130], [2, 260, 130]]); const translated = await camera();
  assert.ok(Math.abs(translated.zoom - pinch.zoom) < .01); assert.equal(translated.yaw, pinch.yaw); assert.equal(translated.pitch, pinch.pitch);
  await touch('touchEnd', [[1, 120, 130]]); const released = await camera(); assert.deepEqual(released, translated);
  await touch('touchMove', [[1, 130, 130]]); const resumed = await camera();
  assert.ok(Math.abs(resumed.yaw - released.yaw - .1 * 180 / Math.PI) < .01); assert.equal(resumed.zoom, released.zoom);
  await touch('touchEnd', []); assert.equal(await page.evaluate(() => activations), 0);
  await touch('touchStart', [[1, 100, 100], [2, 200, 100]]); await touch('touchMove', [[1, 90, 100], [2, 210, 100]]);
  const accepted = await camera(); await touch('touchCancel', []); assert.deepEqual(await camera(), accepted);
  const reconnected = await page.locator('#avatar').evaluate(async avatar => { avatar.remove(); document.body.append(avatar); await avatar.capturePixelsAsync(); return avatar.camera; });
  assert.deepEqual(reconnected, accepted);
});

test('real wheel zoom during concurrent shape, eye and body motion preserves every completion', async t => {
  const page = await pageFor(t);
  await page.locator('#avatar').evaluate(avatar => {
    avatar.interaction = 'box'; avatar.trackingMode = 'eyes-and-body';
    window.motionResults = Promise.all([
      avatar.setShape('heart', { duration: 1600, easing: 'linear' }),
      avatar.setEyeWeights('left', { smile: 1 }, { duration: 1600, easing: 'linear' }),
      avatar.motion.to({ body: { rotation: [.2, .3, .4] } }, { duration: 1600, easing: 'linear' }),
    ]);
  });
  await page.waitForFunction(() => { const value = document.getElementById('avatar').pose.eyes.left.smile; return value > .1 && value < .8; });
  const before = await page.locator('#avatar').evaluate(avatar => ({ pose: avatar.pose, camera: avatar.camera }));
  await page.mouse.move(160, 140); await page.mouse.wheel(0, -100);
  await page.waitForFunction(() => document.getElementById('avatar').camera.zoom > 1);
  const result = await page.evaluate(async () => {
    const completions = await motionResults, avatar = document.getElementById('avatar'); await avatar.capturePixelsAsync();
    return { completions, pose: avatar.pose, shape: avatar.design.body.shape, camera: avatar.camera };
  });
  assert.ok(before.pose.eyes.left.smile > 0 && before.pose.eyes.left.smile < 1);
  assert.deepEqual(result.completions, [{ finished: true }, { finished: true }, { finished: true }]);
  assert.equal(result.shape, 'heart'); assert.equal(result.pose.eyes.left.smile, 1); assert.deepEqual(result.pose.rotation, [.2, .3, .4]);
  assert.equal(result.camera.yaw, before.camera.yaw); assert.equal(result.camera.pitch, before.camera.pitch); assert.equal(result.camera.roll, before.camera.roll); assert.ok(result.camera.zoom > 1);
});
