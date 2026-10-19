/** Real Chromium evidence. Run only through the authorized browser/CI workflow. */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { createAppServer } from '../scripts/serve.mjs';
import { distribution } from './performance-fixture.mjs';

let browser, server, origin;
const reportDirectory = process.env.SIDEKICK_PERFORMANCE ?? process.env.SIDEKICK_SCREENSHOTS ?? 'artifacts';
const reports = [];
before(async () => {
  server = createAppServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  const executablePath = process.env.CHROMIUM_PATH ?? (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
  browser = await chromium.launch({ executablePath, headless: process.env.SIDEKICK_HEADED !== '1', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
  await mkdir(reportDirectory, { recursive: true });
});
after(async () => {
  await mkdir(reportDirectory, { recursive: true });
  await writeFile(join(reportDirectory, 'performance-browser.json'), JSON.stringify({ browser: browser?.version(), createdAt: new Date().toISOString(), methodology: 'Real Chromium using SwiftShader and page CDP CPU throttling. Worker calibration is reported separately because page throttling is not assumed to throttle every worker equally. A CI responsiveness proxy, not physical low-end device FPS or hardware-GPU performance.', reports }, null, 2));
  await browser?.close(); if (server) await new Promise(resolve => server.close(resolve));
});

async function pageFor(t, backend = 'worker', instances = 1, options = {}) {
  const page = await browser.newPage({ locale: 'ko-KR', viewport: { width: 1280, height: 900 }, reducedMotion: 'no-preference', ...options });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  t.after(async () => { await page.close(); assert.deepEqual(errors, [], 'No uncaught browser exceptions'); });
  await page.addInitScript(({ backend }) => {
    const audit = window.performanceAudit = { constructed: 0, terminated: 0, transfers: 0, htmlWebGLContexts: 0, posted: 0, commands: {}, workerFrames: 0, latestWorkerFrames: {}, received: 0 };
    const NativeWorker = window.Worker, originalTransfer = HTMLCanvasElement.prototype.transferControlToOffscreen, originalContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...args) { if (kind === 'webgl' || kind === 'webgl2') audit.htmlWebGLContexts++; return originalContext.call(this, kind, ...args); };
    if (backend === 'main') Object.defineProperty(HTMLCanvasElement.prototype, 'transferControlToOffscreen', { configurable: true, value: undefined });
    else HTMLCanvasElement.prototype.transferControlToOffscreen = function (...args) { audit.transfers++; return originalTransfer.apply(this, args); };
    window.Worker = class extends NativeWorker {
      constructor(...args) { super(...args); const id = ++audit.constructed; this.addEventListener('message', event => { audit.received++; if (event.data?.snapshot) { audit.workerFrames++; audit.latestWorkerFrames[id] = event.data.snapshot.frames; } }); }
      postMessage(message, ...args) { audit.posted++; if (message?.kind === 'command') { const kind = message.command?.kind; audit.commands[kind] = (audit.commands[kind] ?? 0) + 1; } return super.postMessage(message, ...args); }
      terminate() { audit.terminated++; return super.terminate(); }
    };
  }, { backend });
  await page.route(`${origin}/performance.html`, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><meta charset="utf-8"><title>Sidekick production performance</title><style>body{margin:0}#stage{display:flex;flex-wrap:wrap}sidekick-avatar{flex:none;display:block;width:280px;height:280px}#probe{position:fixed;right:0;bottom:0}</style></head><body><div id="stage"></div><button id="probe">Probe</button><script type="module">import * as api from "/browser/sidekick.js";window.api=api;window.fixtureReady=true;</script></body></html>' }));
  await page.goto(`${origin}/performance.html`);
  await page.waitForFunction(() => window.fixtureReady === true);
  await page.evaluate(count => {
    window.avatars = Array.from({ length: count }, (_, index) => {
      const element = document.createElement('sidekick-avatar'); element.id = `avatar-${index}`; element.setActivity('still');
      // Static/performance probes explicitly opt out; individual input tests
      // enable only their subject, not every companion in this fixture.
      element.trackingMode = 'off';
      const accessories = ['beret', 'glasses', 'moustache', 'scarf'].map(preset => window.api.createAccessory(preset));
      accessories.push(window.api.createAccessory('earring', { slot: 'leftEar', id: 'left-earring' }), window.api.createAccessory('starEarring', { slot: 'rightEar', id: 'right-earring' }));
      element.design = window.api.createDesign({ body: { shape: 'softBoom' }, accessories });
      document.getElementById('stage').append(element); return element;
    });
  }, instances);
  await page.waitForFunction(() => window.avatars.every(element => element.ready && !element.diagnostics.running), null, { timeout: 30000 });
  assert.deepEqual(await page.evaluate(() => window.avatars.map(element => element.diagnostics.backend)), Array(instances).fill(backend));
  // Let the initial observers report, then order a real worker barrier before
  // establishing a still-scene baseline. Startup's ready snapshot alone can
  // precede the first observer state command.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.evaluate(() => Promise.all(window.avatars.map(element => element.capturePixelsAsync())).then(() => undefined));
  await quiescent(page);
  return page;
}
async function quiescent(page) { await page.waitForFunction(() => window.avatars.every(element => !element.diagnostics.running), null, { timeout: 15000 }); }
async function snapshot(page) { return page.evaluate(() => ({ diagnostics: window.avatars.map(element => element.diagnostics), audit: structuredClone(window.performanceAudit) })); }
const busyCalibration = () => { let value = 1; const start = performance.now(); for (let i = 0; i < 3000000; i++) value = (Math.imul(value ^ i, 1664525) + 1013904223) | 0; return { durationMs: performance.now() - start, value }; };

// Attach read-only CDP sessions to the real worker targets, rather than treating
// the page's performance.memory as combined worker/context memory.
async function workerHeapUsage() {
  const root = await browser.newBrowserCDPSession(); let next = 0;
  const pending = new Map();
  root.on('Target.receivedMessageFromTarget', event => { const message = JSON.parse(event.message); if (!message.id) return; const item = pending.get(`${event.sessionId}:${message.id}`); if (!item) return; pending.delete(`${event.sessionId}:${message.id}`); clearTimeout(item.timer); message.error ? item.reject(new Error(message.error.message)) : item.resolve(message.result); });
  const send = (sessionId, method, params = {}) => new Promise((resolve, reject) => { const id = ++next, key = `${sessionId}:${id}`; const timer = setTimeout(() => { pending.delete(key); reject(new Error(`CDP worker ${method} timed out`)); }, 10000); pending.set(key, { resolve, reject, timer }); root.send('Target.sendMessageToTarget', { sessionId, message: JSON.stringify({ id, method, params }) }).catch(reject); });
  try {
    const { targetInfos } = await root.send('Target.getTargets');
    const workers = targetInfos.filter(target => target.type === 'worker' && target.url.includes('sidekick.worker.js'));
    const heaps = [];
    for (const target of workers) {
      const { sessionId } = await root.send('Target.attachToTarget', { targetId: target.targetId, flatten: false });
      try { await send(sessionId, 'HeapProfiler.collectGarbage'); heaps.push({ url: target.url, ...(await send(sessionId, 'Runtime.getHeapUsage')) }); }
      finally { await root.send('Target.detachFromTarget', { sessionId }); }
    }
    return { workers: workers.length, heaps, usedSize: heaps.reduce((sum, heap) => sum + heap.usedSize, 0), embedderHeapUsedSize: heaps.reduce((sum, heap) => sum + (heap.embedderHeapUsedSize ?? 0), 0), backingStorageSize: heaps.reduce((sum, heap) => sum + (heap.backingStorageSize ?? 0), 0), caveat: 'V8 heap/backing-store accounting excludes native thread stacks and opaque driver/GPU allocations.' };
  } finally { for (const item of pending.values()) clearTimeout(item.timer); await root.detach(); }
}

test('real worker has one transferred surface per instance, coalesces input, stops unseen, and releases resources', { timeout: 120000 }, async t => {
  const page = await pageFor(t, 'worker', 4);
  const initial = await snapshot(page), heap = await workerHeapUsage();
  assert.equal(initial.audit.constructed, 4); assert.equal(initial.audit.transfers, 4); assert.equal(initial.audit.htmlWebGLContexts, 0);
  assert.ok(initial.diagnostics.every(value => value.buffers > 0)); assert.equal(heap.workers, 4);
  await page.waitForTimeout(180); assert.deepEqual((await snapshot(page)).diagnostics.map(x => x.frames), initial.diagnostics.map(x => x.frames), 'A clean still scene does not draw');
  const burst = await page.evaluate(async () => {
    const avatar = window.avatars[0]; avatar.mouseTracking = true; avatar.trackingMode = 'eyes-and-body';
    await Promise.resolve();
    const before = structuredClone(window.performanceAudit);
    for (let i = 0; i < 2000; i++) document.dispatchEvent(new PointerEvent('pointermove', { clientX: 20 + i % 250, clientY: 120, pointerType: 'mouse' }));
    const synchronousPosts = window.performanceAudit.posted - before.posted;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const after = structuredClone(window.performanceAudit); const capture = await avatar.capturePixelsAsync();
    return { synchronousPosts, stateMessages: (after.commands.state ?? 0) - (before.commands.state ?? 0), capture: { width: capture.width, height: capture.height, nontransparent: capture.pixels.some((value, index) => index % 4 === 3 && value !== 0) } };
  });
  assert.equal(burst.synchronousPosts, 0, 'Pointer events are coalesced before worker dispatch'); assert.ok(burst.stateMessages >= 1 && burst.stateMessages <= 2, `Expected one frame-coalesced state update, received ${burst.stateMessages}`); assert.equal(burst.capture.nontransparent, true);
  await page.evaluate(() => { window.avatars.forEach(element => { element.trackingMode = 'off'; element.setActivity('idle'); }); document.getElementById('stage').style.transform = 'translateY(2000px)'; });
  await page.waitForTimeout(150); await quiescent(page); const offscreen = await snapshot(page); await page.waitForTimeout(180); assert.deepEqual((await snapshot(page)).diagnostics.map(x => x.frames), offscreen.diagnostics.map(x => x.frames), 'IntersectionObserver suspension stops worker frames');
  await page.evaluate(() => { document.getElementById('stage').style.transform = ''; });
  await page.waitForFunction(() => window.avatars.every(element => element.diagnostics.running));
  // Controlled visibility input tests the production visibility handler without
  // claiming the browser's own background-tab policy was emulated.
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(150); await quiescent(page); const hidden = await snapshot(page); await page.waitForTimeout(180); assert.deepEqual((await snapshot(page)).diagnostics.map(x => x.frames), hidden.diagnostics.map(x => x.frames));
  await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); window.avatars.forEach(element => element.setActivity('still')); });
  await quiescent(page); const beforeRemove = await snapshot(page);
  const removed = await page.evaluate(() => { window.avatars.forEach(element => element.remove()); return { diagnostics: window.avatars.map(element => element.diagnostics), audit: structuredClone(window.performanceAudit) }; });
  assert.equal(removed.audit.terminated, 4); assert.ok(removed.diagnostics.every(value => !value.ready && !value.running && value.buffers === 0 && value.backend === 'none'));
  await page.evaluate(() => window.avatars.forEach(element => document.getElementById('stage').append(element)));
  await page.waitForFunction(() => window.avatars.every(element => element.ready && !element.diagnostics.running));
  const reconnected = await snapshot(page); assert.equal(reconnected.audit.constructed, 8); assert.equal(reconnected.audit.transfers, 8); assert.equal(reconnected.audit.terminated, 4);
  assert.ok(reconnected.diagnostics.every((value, i) => value.generation > beforeRemove.diagnostics[i].generation));
  await page.evaluate(() => window.avatars.forEach(element => element.remove()));
  const targets = await browser.newBrowserCDPSession();
  try {
    const deadline = Date.now() + 10000;
    while ((await targets.send('Target.getTargets')).targetInfos.some(target => target.type === 'worker' && target.url.includes('sidekick.worker.js'))) {
      assert.ok(Date.now() < deadline, 'Disposed worker targets terminate promptly'); await page.waitForTimeout(100);
    }
  } finally { await targets.detach(); }
  const finalHeap = await workerHeapUsage(); assert.equal(finalHeap.workers, 0);
  const report = { name: 'worker-lifecycle', initial, heap, burst, offscreen, hidden, beforeRemove, removed, reconnected, finalHeap }; reports.push(report); t.diagnostic(JSON.stringify(report));
});

async function responsiveness(page, backend, rate) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  const calibration = { main: await page.evaluate(busyCalibration), worker: page.workers()[0] ? await page.workers()[0].evaluate(busyCalibration) : null };
  const result = await page.evaluate(async () => {
    const avatar = window.avatars[0], probe = document.getElementById('probe'), rafTimes = [], timerDelays = [], eventTimes = [], longTasks = [], renderSamples = [], before = avatar.diagnostics;
    const observer = new PerformanceObserver(list => longTasks.push(...list.getEntries().map(entry => ({ startTime: entry.startTime, duration: entry.duration }))));
    if (PerformanceObserver.supportedEntryTypes.includes('longtask')) observer.observe({ type: 'longtask', buffered: false });
    let active = true, previousRAF = 0, previousTimer = performance.now(), callbacks = 0, observedFrame = before.frames;
    const frame = now => { if (!active) return; if (previousRAF) rafTimes.push(now - previousRAF); previousRAF = now; callbacks++; const diagnostic = avatar.diagnostics; if (diagnostic.frames > observedFrame) { renderSamples.push(diagnostic.renderCpu.lastMs); observedFrame = diagnostic.frames; } requestAnimationFrame(frame); };
    requestAnimationFrame(frame);
    const timer = setInterval(() => { const now = performance.now(); timerDelays.push(Math.max(0, now - previousTimer - 16)); previousTimer = now; }, 16);
    const handler = event => eventTimes.push(Math.max(0, performance.now() - event.timeStamp)); probe.addEventListener('pointerdown', handler);
    const start = performance.now(), initialPose = avatar.pose;
    // A throttled main renderer can delay timers past a short morph's endpoint.
    // Retarget only after acknowledged animation progress, with the first morph
    // deliberately long enough to remain pending in both backends.
    let firstSettled = false;
    const first = avatar.setShape('pixelTriangle', { duration: 60000, easing: 'smooth' });
    void first.then(() => { firstSettled = true; });
    const interruption = await new Promise((resolve, reject) => {
      const check = () => {
        const state = avatar.diagnostics, elapsedMs = performance.now() - start;
        if (firstSettled) { reject(new Error('First morph completed before the interruption milestone')); return; }
        if (state.time - before.time >= .1 && state.frames > before.frames) {
          resolve({ elapsedMs, animationTime: state.time - before.time, frames: state.frames - before.frames, firstPending: true }); return;
        }
        if (elapsedMs > 30000) { reject(new Error('Morph did not acknowledge animation progress')); return; }
        requestAnimationFrame(check);
      };
      check();
    });
    const second = avatar.setShape('boom', { duration: 1200, easing: 'smooth' });
    const results = await Promise.all([first, second]);
    await new Promise(resolve => setTimeout(resolve, 100));
    active = false; clearInterval(timer); observer.disconnect(); probe.removeEventListener('pointerdown', handler);
    const elapsedMs = performance.now() - start, after = avatar.diagnostics;
    // Readback validates the exact finished target outside the timed window.
    const image = await avatar.capturePixelsAsync();
    const final = { shape: avatar.design.body.shape, pose: avatar.pose, diagnostics: avatar.diagnostics, nontransparent: image.pixels.some((value, index) => index % 4 === 3 && value > 0) };
    return { elapsedMs, callbacks, rafTimes, timerDelays, eventTimes, longTasks, renderSamples, results, interruption, initialPose, final, before, after, audit: structuredClone(window.performanceAudit) };
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 }); await cdp.detach();
  return { backend, throttleRate: rate, calibration, ...result, rafIntervals: distribution(result.rafTimes), timerDelay: distribution(result.timerDelays), inputDelay: distribution(result.eventTimes), longTaskCount: result.longTasks.length, longTaskTotalMs: result.longTasks.reduce((sum, entry) => sum + entry.duration, 0), renderedFrames: result.after.frames - result.before.frames, renderCpu: { totalMs: result.after.renderCpu.totalMs - result.before.renderCpu.totalMs, maxSinceInitMs: result.after.renderCpu.maxMs, observedFrameDurations: distribution(result.renderSamples), observation: 'Latest actual render CPU duration sampled once per main RAF when acknowledged frame number changes; sample count may be lower than rendered frame count.' } };
}

test('shipped worker and safe fallback report throttled main-thread responsiveness during interrupted equipped morphs', { timeout: 180000 }, async t => {
  for (const rate of [1, 6]) for (const backend of ['worker', 'main']) {
    const page = await pageFor(t, backend);
    // Inject trusted input through Chromium while animation work runs. A slow
    // renderer may delay these events; retain samples instead of asserting FPS.
    let clicking = true;
    const input = (async () => { while (clicking && !page.isClosed()) { await page.mouse.click(1240, 880).catch(() => {}); await new Promise(resolve => setTimeout(resolve, 35)); } })();
    let result;
    try { result = await responsiveness(page, backend, rate); }
    finally { clicking = false; await input; }
    assert.equal(result.after.backend, backend); assert.ok(result.renderedFrames > 0); assert.ok(result.callbacks > 0); assert.deepEqual(result.results, [{ finished: false }, { finished: true }]);
    assert.equal(result.interruption.firstPending, true); assert.ok(result.interruption.animationTime >= .1); assert.ok(result.interruption.frames > 0);
    assert.equal(result.final.shape, 'boom'); assert.deepEqual(result.final.pose, result.initialPose);
    assert.equal(result.final.diagnostics.backend, backend); assert.equal(result.final.diagnostics.running, false); assert.equal(result.final.nontransparent, true);
    assert.ok(result.rafIntervals.count > 0 && result.timerDelay.count > 0, 'Real main-thread probes collected samples');
    if (backend === 'worker') { assert.equal(result.audit.htmlWebGLContexts, 0); assert.equal(result.audit.transfers, 1); assert.ok(result.audit.workerFrames > 0); }
    else { assert.equal(result.audit.constructed, 0); assert.equal(result.audit.transfers, 0); assert.ok(result.audit.htmlWebGLContexts >= 1); }
    reports.push({ name: 'responsiveness', ...result }); t.diagnostic(JSON.stringify({ ...result, rafTimes: undefined, timerDelays: undefined, eventTimes: undefined, longTasks: undefined }));
    await page.close();
  }
});

test('equipped idle reports actual scheduled draw work separately from per-frame geometry cost', { timeout: 120000 }, async t => {
  for (const rate of [1, 6]) for (const backend of ['worker', 'main']) {
    const page = await pageFor(t, backend), cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate });
    const calibration = { main: await page.evaluate(busyCalibration), worker: page.workers()[0] ? await page.workers()[0].evaluate(busyCalibration) : null };
    for (const phase of [{ name: 'steady-breathing', time: 0, duration: 2000 }, { name: 'automatic-blink-window', time: 4.2, duration: 600 }]) {
      const result = await page.evaluate(async phase => {
        const avatar = window.avatars[0]; avatar.trackingMode = 'off'; avatar.setActivity('idle'); avatar.seek(phase.time);
        // Readback is outside the timed window. It orders the seek/activity
        // update and warms the first exact fitted mesh without weakening export.
        await avatar.capturePixelsAsync();
        const before = avatar.diagnostics, start = performance.now(), rafTimes = [], renderSamples = [], longTasks = [];
        let active = true, previous = 0, observedFrame = before.frames;
        const observer = new PerformanceObserver(list => longTasks.push(...list.getEntries().map(entry => ({ duration: entry.duration }))));
        if (PerformanceObserver.supportedEntryTypes.includes('longtask')) observer.observe({ type: 'longtask', buffered: false });
        const frame = now => {
          if (!active) return;
          if (previous) rafTimes.push(now - previous); previous = now;
          const diagnostic = avatar.diagnostics;
          if (diagnostic.frames > observedFrame) { renderSamples.push(diagnostic.renderCpu.lastMs); observedFrame = diagnostic.frames; }
          requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
        await new Promise(resolve => setTimeout(resolve, phase.duration));
        active = false; observer.disconnect();
        return { before, after: avatar.diagnostics, elapsedMs: performance.now() - start, rafTimes, renderSamples, longTasks };
      }, phase);
      const renderedFrames = result.after.frames - result.before.frames, renderCpuMs = result.after.renderCpu.totalMs - result.before.renderCpu.totalMs;
      assert.equal(result.after.backend, backend); assert.ok(renderedFrames > 0, 'Visible idle makes real rendering progress');
      const report = { name: 'equipped-idle', phase: phase.name, requestedTime: phase.time, backend, throttleRate: rate, calibration, ...result, renderedFrames, observedDrawsPerSecond: renderedFrames * 1000 / result.elapsedMs, renderCpuMs, renderCpuMsPerElapsedSecond: renderCpuMs * 1000 / result.elapsedMs, rafIntervals: distribution(result.rafTimes), observedRenderDurations: distribution(result.renderSamples), longTaskCount: result.longTasks.length, longTaskTotalMs: result.longTasks.reduce((sum, item) => sum + item.duration, 0), caveat: 'Production idle cadence with exact geometry at each sampled time. Draw count is observed, not a hardware FPS guarantee or an uncapped before/after comparison. The requested blink window may advance more slowly under sustained overload.' };
      reports.push(report); t.diagnostic(JSON.stringify({ ...report, rafTimes: undefined, renderSamples: undefined, longTasks: undefined }));
    }
    await page.evaluate(() => window.avatars[0].setActivity('still')); await quiescent(page);
    const stopped = await snapshot(page); await page.waitForTimeout(120);
    assert.equal((await snapshot(page)).diagnostics[0].frames, stopped.diagnostics[0].frames, 'Switching idle to still stops scheduling');
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 }); await cdp.detach(); await page.close();
  }
});

test('one, two, and four dedicated workers report isolated heap and bounded per-instance resources', { timeout: 120000 }, async t => {
  for (const count of [1, 2, 4]) {
    const page = await pageFor(t, 'worker', count), cdp = await page.context().newCDPSession(page);
    await cdp.send('HeapProfiler.collectGarbage');
    const mainHeap = await cdp.send('Runtime.getHeapUsage'), workerHeap = await workerHeapUsage(), state = await snapshot(page);
    assert.equal(workerHeap.workers, count); assert.equal(state.audit.constructed - state.audit.terminated, count);
    assert.ok(state.diagnostics.every(value => value.buffers > 0 && value.buffers <= 24));
    reports.push({ name: 'multi-instance-memory', count, mainHeap, workerHeap, state });
    t.diagnostic(JSON.stringify({ count, mainHeap, workerHeap, gpuBuffers: state.diagnostics.map(x => x.buffers) }));
    await cdp.detach(); await page.close();
  }
});

test('wide and tall capped surfaces preserve a circle in display pixels at DPR 1/2 and through rapid worker resizes', { timeout: 180000 }, async t => {
  for (const backend of ['worker', 'main']) for (const dpr of [1, 2]) {
    const page = await pageFor(t, backend, 1, { deviceScaleFactor: dpr }), cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
    const measurements = await page.evaluate(async () => {
      const avatar = window.avatars[0];
      // Measure settled circle geometry, not an in-flight design/equipment fade.
      avatar.paused = true; avatar.design = window.api.createDesign({ body: { shape: 'circle' } });
      await avatar.capturePixelsAsync(); avatar.paused = false;
      const sizes = [[600, 600], [2400, 600], [600, 2400], [1023, 600], [1025, 600], [2047, 600], [2049, 600]], measurements = [];
      for (const [width, height] of sizes) {
        avatar.style.width = `${width}px`; avatar.style.height = `${height}px`;
        // Deliberately capture before waiting for ResizeObserver. The async
        // barrier must use the new CSS size, not the previous worker surface.
        const start = performance.now(), image = await avatar.capturePixelsAsync(), rect = avatar.getBoundingClientRect();
        let minX = image.width, minY = image.height, maxX = -1, maxY = -1;
        for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) if (image.pixels[(y * image.width + x) * 4 + 3] >= 128) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
        const displayWidth = (maxX - minX + 1) * rect.width / image.width, displayHeight = (maxY - minY + 1) * rect.height / image.height;
        measurements.push({ css: [rect.width, rect.height], backing: [image.width, image.height], alphaBounds: [minX, minY, maxX, maxY], displayWidth, displayHeight, displayRatio: displayWidth / displayHeight, captureMs: performance.now() - start });
      }
      const shape = avatar.setShape('heart', { duration: 900 }), eyes = avatar.setEyeWeights('left', { blink: 1 }, { duration: 900 });
      for (const [width, height] of [[2400, 600], [600, 2400], [600, 600]]) { avatar.style.width = `${width}px`; avatar.style.height = `${height}px`; await avatar.capturePixelsAsync(); }
      const results = await Promise.all([shape, eyes]); await avatar.capturePixelsAsync();
      return { measurements, results, final: { shape: avatar.design.body.shape, pose: avatar.pose, diagnostics: avatar.diagnostics }, dpr: devicePixelRatio };
    });
    assert.equal(measurements.dpr, dpr);
    for (const item of measurements.measurements) {
      assert.ok(item.backing.every(value => value <= 2048 && value > 0));
      assert.ok(Math.abs(item.displayRatio - 1) < .015, `${backend}/DPR${dpr}/${item.css.join('x')}: circle display ratio ${item.displayRatio}`);
      assert.ok(item.alphaBounds[0] > 0 && item.alphaBounds[1] > 0, 'Full circle retains a transparent margin');
      assert.ok(item.alphaBounds[2] < item.backing[0] - 1 && item.alphaBounds[3] < item.backing[1] - 1);
    }
    assert.deepEqual(measurements.results, [{ finished: true }, { finished: true }]); assert.equal(measurements.final.shape, 'heart'); assert.equal(measurements.final.pose.eyes.left.openness, 0); assert.equal(measurements.final.diagnostics.backend, backend);
    reports.push({ name: 'display-aspect', backend, throttleRate: 6, ...measurements }); t.diagnostic(JSON.stringify({ backend, dpr, ...measurements }));
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 }); await cdp.detach(); await page.close();
  }
});

for (const backend of ['worker', 'main']) test(`multiple default body-and-eye trackers coalesce input independently (${backend})`, { timeout: 60000 }, async t => {
  const count = 4, page = await pageFor(t, backend, count);
  const burst = await page.evaluate(async () => {
    for (const avatar of window.avatars) avatar.removeAttribute('tracking-mode');
    await Promise.resolve();
    await Promise.all(window.avatars.map(avatar => avatar.capturePixelsAsync()));
    const before = structuredClone(window.performanceAudit);
    for (let i = 0; i < 2000; i++) document.dispatchEvent(new PointerEvent('pointermove', { clientX: 1240, clientY: 80, pointerType: 'mouse' }));
    const synchronousPosts = window.performanceAudit.posted - before.posted;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return { synchronousPosts, stateMessages: (window.performanceAudit.commands.state ?? 0) - (before.commands.state ?? 0) };
  });
  assert.equal(burst.synchronousPosts, 0, 'default trackers must coalesce synchronous pointer bursts');
  if (backend === 'worker') assert.ok(burst.stateMessages >= count && burst.stateMessages <= count * 2, `Expected at most two coalesced messages per avatar, received ${burst.stateMessages}`);
  await page.waitForFunction(() => window.avatars.every(avatar => avatar.diagnostics.renderedRotation[1] > .1));
  const states = await page.evaluate(async () => {
    await Promise.all(window.avatars.map(avatar => avatar.capturePixelsAsync()));
    return window.avatars.map(avatar => ({ mode: avatar.trackingMode, gaze: avatar.pose.gaze, rotation: avatar.diagnostics.renderedRotation, backend: avatar.diagnostics.backend }));
  });
  for (const state of states) {
    assert.equal(state.mode, 'eyes-and-body'); assert.equal(state.backend, backend);
    assert.ok(state.gaze[0] > .5); assert.ok(state.rotation[1] > .1 && state.rotation[1] <= .22);
  }
});
