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

async function pageFor(t, { entry = 'native', csp = '', failWorker = '', contextLoss = false, touch = false, auditGpu = false } = {}) {
  const page = await browser.newPage({ locale: 'ko-KR', viewport: { width: 1000, height: 800 }, reducedMotion: 'no-preference', hasTouch: touch }), errors = [];
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
  if (auditGpu) await page.route('**/src/runtime/render-worker.js', async route => {
    const response = await route.fetch(), code = await response.text();
    const prefix = `globalThis.gpuAudit = { contexts: 0, raf: 0, draws: 0, uploads: 0, uploadBytes: 0, clears: 0 };
const originalRAF = globalThis.requestAnimationFrame.bind(globalThis);
globalThis.requestAnimationFrame = callback => originalRAF(now => { gpuAudit.raf++; callback(now); });
const originalContext = OffscreenCanvas.prototype.getContext;
OffscreenCanvas.prototype.getContext = function(kind, ...args) {
  const gl = originalContext.call(this, kind, ...args);
  if(kind === 'webgl2' && gl) {
    gpuAudit.contexts++; globalThis.gpuCanvas = this;
    for(const [method, counter] of [['drawElements','draws'],['bufferData','uploads'],['bufferSubData','uploads'],['clear','clears']]) {
      const original = gl[method].bind(gl);
      gl[method] = (...args) => { gpuAudit[counter]++; if(counter === 'uploads') { const source = args[method === 'bufferData' ? 1 : 2]; gpuAudit.uploadBytes += typeof source === 'number' ? source : source?.byteLength ?? 0; } return original(...args); };
    }
  }
  return gl;
};\n`;
    await route.fulfill({ response, body: prefix + code });
  });
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

test('fresh readback flushes immediate CSS size/design/bodyOrientation changes and exports exact alpha bounds', async t => {
  const page = await pageFor(t);
  const result = await page.evaluate(async () => {
    const avatar = document.getElementById('avatar'); avatar.paused = true;
    avatar.style.width = '511px'; avatar.style.height = '233px'; avatar.setBodyOrientation({ yaw: 33, pitch: 9, roll: -8 }); await avatar.updateDesign({ body: { color: '#3366aa' } });
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
    return { edgeSamples, maxEdgeError, size: [image.width, image.height], expected: [Math.round(511 * Math.min(devicePixelRatio, 2)), Math.round(233 * Math.min(devicePixelRatio, 2))], png: [canvas.width, canvas.height], bounds: [maxX - minX + 1 + 14, maxY - minY + 1 + 14], alphaSum, exportedAlpha, type: blob.type, bodyOrientation: avatar.bodyOrientation, zoom: avatar.zoom, color: avatar.design.body.color };
  });
  assert.deepEqual(result.size, result.expected); assert.deepEqual(result.png, result.bounds); assert.equal(result.type, 'image/png'); assert.equal(result.exportedAlpha, result.alphaSum); assert.ok(result.edgeSamples > 0); assert.ok(result.maxEdgeError <= 2, `PNG edge color drift ${result.maxEdgeError}`);
  assert.deepEqual(result.bodyOrientation, { yaw: 33, pitch: 9, roll: -8 }); assert.equal(result.color, '#3366aa');
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
  await page.waitForFunction(() => document.getElementById('avatar').zoom > 1);
  const first = await page.locator('#avatar').evaluate(avatar => avatar.zoom);
  assert.ok(Math.abs(first - Math.exp(.2)) < .001);
  await page.keyboard.down('Control'); await page.mouse.wheel(0, -40); await page.keyboard.up('Control');
  await page.waitForFunction(previous => document.getElementById('avatar').zoom > previous, first);
  assert.equal(await page.evaluate(() => visualViewport.scale), 1);
  const before = await page.locator('#avatar').evaluate(avatar => { avatar.interaction = 'none'; return { ...avatar.bodyOrientation, zoom: avatar.zoom }; });
  await page.mouse.wheel(0, -200);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.deepEqual(await page.locator('#avatar').evaluate(avatar => ({ ...avatar.bodyOrientation, zoom: avatar.zoom })), before);
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
      avatar.style.width = `${width}px`; avatar.style.height = `${height}px`; avatar.resetBodyOrientation(); avatar.zoom = 1;
      const normal = bounds(await avatar.capturePixelsAsync()); avatar.zoom = 1.5; const zoomed = bounds(await avatar.capturePixelsAsync());
      cases.push({ width, height, normal, zoomed });
    }
    avatar.style.width = '240px'; avatar.style.height = '240px'; avatar.zoom = 3;
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
  // pageFor owns page cleanup, which also closes its attached CDP session.
  await page.locator('#avatar').evaluate(avatar => {
    avatar.interaction = 'box'; avatar.paused = true; window.activations = 0; avatar.addEventListener('sidekick-activate', () => activations++);
    window.touchPointers = new Map(); window.touchEvents = [];
    const canvas = avatar.shadowRoot.querySelector('canvas');
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) canvas.addEventListener(type, event => {
      if (event.pointerType !== 'touch') return;
      touchEvents.push({ type, id: event.pointerId, x: event.clientX, y: event.clientY, button: event.button });
      if (type === 'pointerup' || type === 'pointercancel') touchPointers.delete(event.pointerId);
      else touchPointers.set(event.pointerId, [event.clientX, event.clientY]);
    });
  });
  const touch = async (type, points, expectedActive = points) => {
    await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([id, x, y]) => ({ id, x, y, radiusX: 4, radiusY: 4, force: 1 })) });
    // CDP acknowledges injection before Chromium necessarily dispatches every
    // compositor-coalesced pointer event. Wait for the actual DOM coordinates,
    // independently of bodyOrientation state, before asking the renderer for a barrier.
    await page.waitForFunction(expected => {
      const actual = [...touchPointers.values()];
      return actual.length === expected.length && expected.every(([, x, y]) => actual.some(([ax, ay]) => Math.abs(ax - x) < .01 && Math.abs(ay - y) < .01));
    }, expectedActive);
  };
  const bodyOrientation = () => page.locator('#avatar').evaluate(async avatar => { await avatar.capturePixelsAsync(); return { ...avatar.bodyOrientation, zoom: avatar.zoom }; });
  await touch('touchStart', [[1, 100, 100]]); await touch('touchMove', [[1, 120, 100]]); const orbit = await bodyOrientation(); assert.ok(orbit.yaw > 0);
  await touch('touchStart', [[2, 220, 100]], [[1, 120, 100], [2, 220, 100]]);
  await touch('touchMove', [[1, 100, 100], [2, 240, 100]]); const pinch = await bodyOrientation();
  t.diagnostic('Touch input and bodyOrientation: ' + JSON.stringify(await page.evaluate(() => ({ events: touchEvents, bodyOrientation: document.getElementById('avatar').bodyOrientation }))));
  assert.ok(Math.abs(pinch.zoom - 1.4) < .01, `Expected 1.4× pinch, received ${pinch.zoom}`); assert.equal(pinch.yaw, orbit.yaw); assert.equal(pinch.pitch, orbit.pitch);
  await touch('touchMove', [[1, 120, 130], [2, 260, 130]]); const translated = await bodyOrientation();
  assert.ok(Math.abs(translated.zoom - pinch.zoom) < .01); assert.equal(translated.yaw, pinch.yaw); assert.equal(translated.pitch, pinch.pitch);
  // Chromium's default CDP path releases the supplied touch IDs; omitted IDs remain active.
  await touch('touchEnd', [[2, 260, 130]], [[1, 120, 130]]); const released = await bodyOrientation(); assert.deepEqual(released, translated);
  await touch('touchMove', [[1, 130, 130]]); const resumed = await bodyOrientation();
  assert.ok(Math.abs(resumed.yaw - released.yaw - .1 * 180 / Math.PI) < .01); assert.equal(resumed.zoom, released.zoom);
  await touch('touchEnd', []); assert.equal(await page.evaluate(() => activations), 0);
  await touch('touchStart', [[1, 100, 100], [2, 200, 100]]); await touch('touchMove', [[1, 90, 100], [2, 210, 100]]);
  const accepted = await bodyOrientation(); await touch('touchCancel', []); assert.deepEqual(await bodyOrientation(), accepted);
  const reconnected = await page.locator('#avatar').evaluate(async avatar => { avatar.remove(); document.body.append(avatar); await avatar.capturePixelsAsync(); return { ...avatar.bodyOrientation, zoom: avatar.zoom }; });
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
  const before = await page.locator('#avatar').evaluate(avatar => ({ pose: avatar.pose, bodyOrientation: avatar.bodyOrientation, zoom: avatar.zoom }));
  await page.mouse.move(160, 140); await page.mouse.wheel(0, -100);
  await page.waitForFunction(() => document.getElementById('avatar').zoom > 1);
  const result = await page.evaluate(async () => {
    const completions = await motionResults, avatar = document.getElementById('avatar'); await avatar.capturePixelsAsync();
    return { completions, pose: avatar.pose, shape: avatar.design.body.shape, bodyOrientation: avatar.bodyOrientation, zoom: avatar.zoom };
  });
  assert.ok(before.pose.eyes.left.smile > 0 && before.pose.eyes.left.smile < 1);
  assert.deepEqual(result.completions, [{ finished: true }, { finished: true }, { finished: true }]);
  assert.equal(result.shape, 'heart'); assert.equal(result.pose.eyes.left.smile, 1); assert.deepEqual(result.pose.rotation, [.2, .3, .4]);
  assert.equal(result.bodyOrientation.yaw, before.bodyOrientation.yaw); assert.equal(result.bodyOrientation.pitch, before.bodyOrientation.pitch); assert.equal(result.bodyOrientation.roll, before.bodyOrientation.roll); assert.ok(result.zoom > 1);
});

for (const failWorker of ['', 'constructor']) test(`${failWorker || 'worker'}: far pointer preserves paired eye motion on concave heart`, async t => {
 const page=await pageFor(t,{failWorker});
 const result=await page.evaluate(async()=>{
  const avatar=document.getElementById('avatar'); avatar.paused=true;
  await avatar.updateDesign({body:{shape:'heart',color:'#ffcc37'},eyes:{color:'#111111'},accessories:[]});
  const samples=[];
  function centers(image) {
   // Two connected ink components, independent of row orientation/readback origin.
   const {pixels,width,height}=image, ink=new Uint8Array(width*height),groups=[];
   for(let i=0;i<ink.length;i++)ink[i]=pixels[i*4+3]>200&&pixels[i*4]<50&&pixels[i*4+1]<50&&pixels[i*4+2]<50?1:0;
   for(let start=0;start<ink.length;start++)if(ink[start]) {
    const queue=[start];ink[start]=0;let x=0,y=0;
    for(let k=0;k<queue.length;k++){const p=queue[k];x+=p%width;y+=Math.floor(p/width);for(const q of[p-1,p+1,p-width,p+width])if(q>=0&&q<ink.length&&ink[q]&&Math.abs(q%width-p%width)<=1){ink[q]=0;queue.push(q);}}
    if(queue.length>8)groups.push({x:x/queue.length,y:y/queue.length,count:queue.length});
   }
   return groups.sort((a,b)=>a.x-b.x);
  }
  for(const mode of ['eyes','eyes-and-body']) {
   avatar.trackingMode=mode;
   for(const [dx,dy] of [[0,0],[-100000,0],[100000,0],[0,-100000],[0,100000],[-100000,-100000],[100000,100000],[-100000,100000],[100000,-100000],[0,0]]) {
    const rect=avatar.getBoundingClientRect();
    document.dispatchEvent(new PointerEvent('pointermove',{clientX:rect.x+rect.width/2+dx,clientY:rect.y+rect.height/2+dy,pointerType:'mouse',bubbles:true}));
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const image=await avatar.capturePixelsAsync();
    samples.push({mode,dx,dy,eyes:centers(image),gaze:avatar.pose.gaze});
   }
  }
  return {backend:avatar.diagnostics.backend,samples};
 });
 assert.equal(result.backend,failWorker?'main':'worker');
 for(const sample of result.samples){
  assert.equal(sample.eyes.length,2,JSON.stringify(sample));
  assert.equal(sample.gaze[0],Math.sign(sample.dx));
  assert.equal(sample.gaze[1],sample.dy===0?0:-Math.sign(sample.dy));
 }
 for(const mode of ['eyes','eyes-and-body']) {
  const samples=result.samples.filter(sample=>sample.mode===mode),neutral=samples[0],restored=samples.at(-1);
  const spacing=s=>Math.hypot(s.eyes[1].x-s.eyes[0].x,s.eyes[1].y-s.eyes[0].y);
  for(const sample of samples.slice(1,-1)) {
   // Body rotation naturally compresses the projected pair and changes depth;
   // it must not collapse the pair into the one-eye-stationary configuration.
   const ratio=spacing(sample)/spacing(neutral);
   assert.ok(ratio>.8&&ratio<1.2,`${mode}: extreme gaze collapsed projected eye spacing`);
   if(mode==='eyes') assert.ok(Math.abs(spacing(sample)-spacing(neutral))<1.5,'eyes-only spacing stays rigid');
   for(let eye=0;eye<2;eye++) {
    if(sample.dx) assert.ok((sample.eyes[eye].x-neutral.eyes[eye].x)*Math.sign(sample.dx)>.5,`${mode}: both eyes follow horizontal gaze`);
    // Readback's vertical origin is backend-specific; compare the two eyes'
    // direction rather than assuming top-down pixels.
    if(sample.dy) assert.ok(Math.abs(sample.eyes[eye].y-neutral.eyes[eye].y)>.5,`${mode}: both eyes follow vertical gaze`);
   }
   if(sample.dy) assert.ok((sample.eyes[0].y-neutral.eyes[0].y)*(sample.eyes[1].y-neutral.eyes[1].y)>0,`${mode}: vertical gaze is conjugate`);
  }
  if(mode==='eyes') for(let eye=0;eye<2;eye++)assert.ok(Math.abs(restored.eyes[eye].x-neutral.eyes[eye].x)<1,'return to neutral');
 }
});

for (const failWorker of ['', 'constructor']) test(`${failWorker ? 'fallback' : 'worker'}: authored body facing rotates real pixels with unchanged animation and separate zoom events`, async t => {
  const page = await pageFor(t, { failWorker });
  const result = await page.locator('#avatar').evaluate(async avatar => {
    avatar.paused = true; avatar.trackingMode = 'off'; avatar.setActivity('still');
    await avatar.updateDesign({ body: { shape: 'square', color: '#ffffff' }, eyes: { color: '#000000' } });
    await avatar.motion.to({ body: { rotation: [0, 0, 0] } }, { duration: 0 });
    const events = [];
    for (const type of ['sidekick-body-orientation-change', 'sidekick-zoom-change', 'sidekick-camera-change']) avatar.addEventListener(type, event => events.push({ type, detail: event.detail }));
    const sample = async orientation => {
      avatar.setBodyOrientation(orientation);
      const { width, height, pixels } = await avatar.capturePixelsAsync();
      let eyeX = 0, eyeY = 0, count = 0, alpha = 0;
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        if (pixels[i + 3] > 200) {
          alpha++;
          if (pixels[i] < 32 && pixels[i + 1] < 32 && pixels[i + 2] < 32) { eyeX += x; eyeY += y; count++; }
        }
      }
      return { x: eyeX / count - width / 2, y: eyeY / count - height / 2, count, alpha, pose: avatar.pose.rotation };
    };
    const front = await sample({ yaw: 0, pitch: 0, roll: 0 });
    const right = await sample({ yaw: 35, pitch: 0, roll: 0 });
    const left = await sample({ yaw: -35, pitch: 0, roll: 0 });
    const tilt = await sample({ yaw: 0, pitch: 30, roll: 0 });
    const untilt = await sample({ yaw: 0, pitch: -30, roll: 0 });
    const roll = await sample({ yaw: 0, pitch: 0, roll: 45 });
    const unroll = await sample({ yaw: 0, pitch: 0, roll: -45 });
    const eventStart = events.length;
    avatar.zoom = 1.25;
    const zoomed = { orientation: avatar.bodyOrientation, zoom: avatar.zoom };
    avatar.resetBodyOrientation();
    const reset = { orientation: avatar.bodyOrientation, zoom: avatar.zoom };
    return { front, right, left, tilt, untilt, roll, unroll, zoomed, reset, events: events.slice(eventStart),
      oldAPI: ['camera', 'setCamera', 'resetCamera', 'setCameraPreset'].filter(key => key in avatar) };
  });
  for (const name of ['front', 'right', 'left', 'tilt', 'untilt', 'roll', 'unroll']) {
    assert.ok(result[name].count > 10, `${name} contains visible eyes`);
    assert.deepEqual(result[name].pose, [0, 0, 0], `${name} preserves authored animation pose`);
  }
  assert.ok(result.right.x > result.front.x + 5 && result.left.x < result.front.x - 5, 'Positive yaw faces screen right');
  assert.ok(result.tilt.y < result.untilt.y - 5, 'Positive pitch tilts the upper body toward the viewer (GL y is upward)');
  assert.ok(result.roll.x < result.unroll.x - 5, 'Positive roll rotates the upper face counterclockwise');
  assert.deepEqual(result.zoomed, { orientation: { yaw: 0, pitch: 0, roll: -45 }, zoom: 1.25 });
  assert.deepEqual(result.reset, { orientation: { yaw: 0, pitch: 0, roll: 0 }, zoom: 1.25 });
  assert.deepEqual(result.events, [
    { type: 'sidekick-zoom-change', detail: { zoom: 1.25 } },
    { type: 'sidekick-body-orientation-change', detail: { bodyOrientation: { yaw: 0, pitch: 0, roll: 0 } } },
  ]);
  assert.deepEqual(result.oldAPI, [], 'Removed camera API is not retained as aliases');
});

test('worker WebGL performs zero RAF/draw/upload work fully outside and resumes from partial visibility', async t => {
  const page = await pageFor(t, { auditGpu: true });
  const worker = page.workers()[0];
  const gpu = () => worker.evaluate(() => ({ ...gpuAudit }));
  await page.locator('#avatar').evaluate(avatar => { avatar.style.position = 'fixed'; avatar.style.left = '0px'; avatar.setActivity('idle'); });
  await page.waitForFunction(() => document.getElementById('avatar').diagnostics.running);
  const initial = await gpu(); await page.waitForTimeout(250); const active = await gpu();
  assert.equal(active.contexts, 1); assert.ok(active.raf > initial.raf && active.draws > initial.draws);
  assert.equal(await page.evaluate(() => workerAudit.mainContexts), 0);

  // Exactly touching the viewport edge has no visible area, despite
  // IntersectionObserver's isIntersecting potentially being true there.
  await page.locator('#avatar').evaluate(avatar => { avatar.style.left = `${innerWidth}px`; });
  await page.waitForFunction(() => !document.getElementById('avatar').diagnostics.running);
  await page.waitForTimeout(100);
  const outside = await gpu(); await page.waitForTimeout(300);
  assert.deepEqual(await gpu(), outside, 'Fully unseen: zero worker RAF callbacks, GL draws, clears and uploads');
  const oldSize = await worker.evaluate(() => [gpuCanvas.width, gpuCanvas.height]);
  for (const width of [350, 370, 390]) {
    await page.locator('#avatar').evaluate((avatar, width) => { avatar.style.width = `${width}px`; }, width);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  }
  assert.deepEqual(await gpu(), outside, 'Hidden layout changes do not draw or upload');
  assert.deepEqual(await worker.evaluate(() => [gpuCanvas.width, gpuCanvas.height]), oldSize, 'Hidden resize keeps old framebuffer until needed');

  // One pixel is enough to become visible. The pending latest size applies once.
  await page.locator('#avatar').evaluate(avatar => { avatar.style.left = `${innerWidth - 1}px`; });
  await page.waitForFunction(() => document.getElementById('avatar').diagnostics.running);
  const expectedWidth = await page.evaluate(() => Math.round(390 * Math.min(devicePixelRatio, 2)));
  const resizeDeadline = Date.now() + 10000;
  while (await worker.evaluate(() => gpuCanvas.width) !== expectedWidth) {
    assert.ok(Date.now() < resizeDeadline, 'Worker framebuffer applies pending visible resize');
    await page.waitForTimeout(25);
  }
  const resumed = await gpu(); assert.ok(resumed.draws > outside.draws);
  await page.locator('#avatar').evaluate(avatar => { avatar.paused = true; });
  await page.waitForFunction(() => !document.getElementById('avatar').diagnostics.running);
  const paused = await gpu(); await page.waitForTimeout(200); assert.deepEqual(await gpu(), paused, 'Explicit pause remains demand-only');
  await page.locator('#avatar').evaluate(avatar => { avatar.style.left = `${innerWidth + 50}px`; });
  await page.waitForTimeout(100);
  await page.locator('#avatar').evaluate(avatar => { avatar.style.left = '0px'; });
  await page.waitForTimeout(150);
  assert.equal(await page.locator('#avatar').evaluate(avatar => avatar.paused), true);
  assert.equal(await page.locator('#avatar').evaluate(avatar => avatar.diagnostics.running), false, 'Visibility return must not clear explicit pause');
  t.diagnostic(JSON.stringify({ initial, active, outside, resumed, paused, methodology: 'Actual dedicated-worker RAF and WebGL2 calls; polling evaluations are test instrumentation, not renderer scheduling.' }));
});
