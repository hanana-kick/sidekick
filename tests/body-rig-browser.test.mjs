/** Real renderer parity regression; run in the authorized browser/CI workflow. */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { createAppServer } from '../scripts/serve.mjs';
let browser, server, origin;
before(async () => {
  server = createAppServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
});
after(async () => { await browser?.close(); if (server) await new Promise(resolve => server.close(resolve)); });
for (const mode of ['webgl2', 'canvas2d']) test(`${mode}: skinning retains eye ink, restores neutral pixels, and animates plugin bones`, async t => {
  const page = await browser.newPage(); t.after(() => page.close());
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route(`${origin}/body-rig-test.html`, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><canvas id="scene" width="192" height="192"></canvas>' }));
  await page.goto(`${origin}/body-rig-test.html`);
  const result = await page.evaluate(async mode => {
    const { AvatarRenderer } = await import('/src/renderer/webgl.js');
    const { createDesign } = await import('/src/core/design.js');
    const { initialPose } = await import('/src/core/motion.js');
    const renderer = new AvatarRenderer(document.getElementById('scene'), mode === 'canvas2d' ? { renderer: mode } : {});
    const design = createDesign({ body: { shape: 'circle', color: '#ffffff' }, eyes: { color: '#000000' } });
    const frame = { pose: initialPose(), activity: 'still', time: 0, delta: 0, reduced: true, style: 'flat' };
    const skeleton = { bones: [{ id: 'root', position: [0, .4, 0] }] }, rig = { skeleton, influences: [] };
    const draw = extra => { renderer.render(design, { ...frame, ...extra }); return renderer.readPixels(); };
    const equal = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
    const ink = pixels => { let x = 0, count = 0; for (let i = 0; i < pixels.length; i += 4) if (pixels[i + 3] > 240 && pixels[i] < 15) { x += i / 4 % 192; count++; } return { x: x / count, count }; };
    const baseline = draw({}), neutral = draw({ rig }), moved = draw({ rig, bonePose: { root: { position: [.3, 0, 0] } } });
    const reversed = draw({ rig, bonePose: { root: { rotation: [0, Math.PI, 0] } } }), restored = draw({});
    const pluginAccessories = [{ id: 'badge', slot: 'eyes', color: '#ff00ff', asset: { pluginId: 'test/skin', slots: ['eyes'], geometry: {
      vertices: new Float32Array([-.16, -.12, .03, 0, 0, 1, .16, -.12, .03, 0, 0, 1, 0, .2, .03, 0, 0, 1]), indices: new Uint16Array([0, 1, 2]),
      skin: { skeleton, joints: new Uint8Array(12), weights: new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]) },
    } } }];
    const pluginNeutral = draw({ pluginAccessories });
    const pluginPosed = draw({ pluginAccessories, accessoryBonePoses: { badge: { root: { position: [.15, .1, 0] } } } });
    const pluginRestore = draw({ pluginAccessories });
    const result = { graphics: renderer.graphics, neutralEqual: equal(baseline, neutral), restored: equal(baseline, restored), baselineInk: ink(baseline), movedInk: ink(moved), reversedInk: ink(reversed).count, pluginChanged: !equal(pluginNeutral, pluginPosed), pluginRestored: equal(pluginNeutral, pluginRestore), glError: renderer.gl?.getError() ?? 0 };
    renderer.dispose(); return result;
  }, mode);
  assert.equal(result.graphics, mode); assert.equal(result.neutralEqual, true); assert.equal(result.restored, true);
  assert.ok(result.baselineInk.count > 20); assert.ok(result.movedInk.count > 20); assert.ok(result.movedInk.x - result.baselineInk.x > 10);
  assert.equal(result.reversedInk, 0); assert.equal(result.pluginChanged, true); assert.equal(result.pluginRestored, true);
  assert.equal(result.glError, 0); assert.deepEqual(errors, []);
});

// Public element acceptance: no private renderer/bridge access can satisfy this
// path. Commands and skin buffers must cross the real worker boundary when used.
for (const backend of ['worker', 'main']) for (const graphics of ['webgl2', 'canvas2d']) {
  test(`public ${backend}/${graphics}: body mounts, plugin bones, clip seek/pause and reconnect`, async t => {
    const page = await browser.newPage({ viewport: { width: 800, height: 600 }, reducedMotion: 'no-preference' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    // Install the existing cross-realm denial helper only for an explicit Canvas
    // case. A WebGL case must fail, never skip or accept a Canvas fallback.
    const { forceCanvasForPage, closePageAfterCanvasRoutes } = await import('./helpers/force-no-webgl.mjs');
    t.after(() => closePageAfterCanvasRoutes(page));
    const canvasAudit = graphics === 'canvas2d' ? await forceCanvasForPage(page) : undefined;
    await page.addInitScript(backend => {
      window.boneWorkerAudit = { created: 0, terminated: 0, transfers: 0, errors: [] };
      const NativeWorker = window.Worker;
      if (backend === 'main') Object.defineProperty(window, 'Worker', { value: undefined });
      else window.Worker = class extends NativeWorker {
        constructor(...args) { super(...args); boneWorkerAudit.created++; }
        terminate() { boneWorkerAudit.terminated++; super.terminate(); }
      };
      const transfer = HTMLCanvasElement.prototype.transferControlToOffscreen;
      HTMLCanvasElement.prototype.transferControlToOffscreen = function (...args) { boneWorkerAudit.transfers++; return transfer.apply(this, args); };
      document.addEventListener('sidekick-error', event => boneWorkerAudit.errors.push(event.detail?.message ?? String(event.detail)));
    }, backend);
    await page.route(`${origin}/public-bone-test.html`, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><style>body{margin:0}sidekick-avatar{display:block;width:320px;height:320px}</style><sidekick-avatar id="bot" paused activity="still" tracking-mode="off" shape="circle" body-color="#ffffff" eye-color="#000000"></sidekick-avatar><script type="module" src="/src/auto.js"></script>' }));
    await page.goto(`${origin}/public-bone-test.html`);
    await page.waitForFunction(() => document.getElementById('bot')?.ready, null, { timeout: 20000 });
    const initial = await page.evaluate(() => ({ diagnostics: document.getElementById('bot').diagnostics, audit: { ...boneWorkerAudit } }));
    assert.equal(initial.diagnostics.backend, backend); assert.equal(initial.diagnostics.graphics, graphics);
    assert.equal(initial.audit.created, backend === 'worker' ? 1 : 0); assert.equal(initial.audit.transfers, backend === 'worker' ? 1 : 0);
    assert.equal(page.workers().filter(worker => /\/runtime\/render-worker\.js(?:\?|$)/.test(worker.url())).length, backend === 'worker' ? 1 : 0, 'a genuine dedicated render worker owns worker-mode rendering');
    if (canvasAudit) await canvasAudit.assertDenied({ worker: backend === 'worker' });

    const sampled = await page.evaluate(async () => {
      const { AccessoryPluginRegistry } = await import('/src/auto.js');
      const bot = document.getElementById('bot');
      const equal = (a, b) => a.width === b.width && a.height === b.height && a.pixels.every((value, index) => value === b.pixels[index]);
      const center = (image, kind) => {
        let sum = 0, count = 0;
        for (let i = 0; i < image.pixels.length; i += 4) {
          const p = image.pixels;
          if (p[i + 3] <= 240) continue;
          // Separate opaque white body samples from both black eyes and the
          // small magenta badge, rather than treating all coverage as body.
          if (kind === 'body' && !(p[i] > 240 && p[i + 1] > 240 && p[i + 2] > 240)) continue;
          if (kind === 'badge' && !(p[i] > 240 && p[i + 1] < 15 && p[i + 2] > 240)) continue;
          if (kind === 'ink' && !(p[i] < 15 && p[i + 1] < 15 && p[i + 2] < 15)) continue;
          sum += i / 4 % image.width; count++;
        }
        return { x: sum / count, count };
      };
      const modes = [];
      const capture = async () => {
        const image = await bot.capturePixelsAsync();
        const { backend, graphics } = bot.diagnostics; modes.push({ backend, graphics });
        return image;
      };
      const bare = await capture();
      bot.setBodyRig({ skeleton: { bones: [{ id: 'root', position: [0, .4, 0] }] }, influences: [], attachments: { eyes: 'root' } });
      const bound = await capture();
      // Measure body and eye translation without an occluding accessory. A
      // color centroid of the remaining white pixels is not a body transform.
      bot.setBonePose({ root: { position: [.25, 0, 0] } });
      const bareMoved = await capture();
      const bodyShift = center(bareMoved, 'body').x - center(bound, 'body').x;
      const eyeShift = center(bareMoved, 'ink').x - center(bound, 'ink').x;
      bot.clearBonePose();
      const registry = new AccessoryPluginRegistry();
      registry.register({ apiVersion: 1, id: 'test/public-bone-badge', slots: ['eyes'], createMesh: () => ({
        vertices: new Float32Array([-.14, -.1, .04, 0, 0, 1, .14, -.1, .04, 0, 0, 1, 0, .15, .04, 0, 0, 1]), indices: new Uint16Array([0, 1, 2]),
        skin: { skeleton: { bones: [{ id: 'tip' }] }, joints: new Uint8Array(12), weights: new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]) },
      }) });
      await bot.equipPluginAccessory(registry, 'test/public-bone-badge', { slot: 'eyes', id: 'badge', color: '#ff00ff' });
      const neutral = await capture();
      bot.setBonePose({ root: { position: [.25, 0, 0] } }); const moved = await capture();
      const badgeShift = center(moved, 'badge').x - center(neutral, 'badge').x;
      bot.setBonePose({ tip: { position: [.12, 0, 0] } }, { accessory: 'badge' });
      const pluginMoved = await capture();
      const pluginShift = center(pluginMoved, 'badge').x - center(moved, 'badge').x;
      // The badge stays strictly inside the body. Compare every alpha sample,
      // not a white-color centroid distorted by the badge moving over it.
      const sameSilhouette = (a, b) => a.width === b.width && a.height === b.height && a.pixels.every((v, i) => i % 4 !== 3 || v === b.pixels[i]);
      const mountedSilhouette = sameSilhouette(bareMoved, moved);
      const pluginSilhouette = sameSilhouette(bareMoved, pluginMoved);
      const png = image => {
        const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
        const rgba = new Uint8ClampedArray(image.pixels.length);
        for (let y = 0; y < image.height; y++) rgba.set(image.pixels.subarray(y * image.width * 4, (y + 1) * image.width * 4), (image.height - 1 - y) * image.width * 4);
        // Runtime captures are premultiplied; ImageData expects straight RGB.
        for (let i = 0; i < rgba.length; i += 4) if (rgba[i + 3] > 0) for (let c = 0; c < 3; c++) rgba[i + c] = Math.round(rgba[i + c] * 255 / rgba[i + 3]);
        canvas.getContext('2d').putImageData(new ImageData(rgba, image.width, image.height), 0, 0);
        return canvas.toDataURL('image/png').split(',')[1];
      };
      const evidence = Object.fromEntries(Object.entries({ bound, bareMoved, neutral, moved, pluginMoved }).map(([name, image]) => [name, png(image)]));
      const manualPoses = { body: bot.getBonePose(), plugin: bot.getBonePose({ accessory: 'badge' }) };
      bot.clearBonePose(); bot.clearBonePose({ accessory: 'badge' }); bot.seek(0);
      const reset = await capture();
      bot.setPartAnimation({ duration: 2, tracks: [
        { target: { bone: 'root' }, channel: 'position', keyframes: [{ time: 0, value: [0, 0, 0] }, { time: 2, value: [.3, 0, 0] }] },
        { target: { accessory: 'badge', bone: 'tip' }, channel: 'position', keyframes: [{ time: 0, value: [0, 0, 0] }, { time: 2, value: [-.12, .08, 0] }] },
      ] });
      bot.seekPartAnimation(.5); const first = await capture();
      bot.seekPartAnimation(1.5); const later = await capture();
      bot.seekPartAnimation(.5); const replay = await capture();
      bot.pausePartAnimation(); const paused = await capture();
      bot.seek(9); const pausedAfterGlobalSeek = await capture();
      const pausedClock = bot.partAnimation;
      bot.playPartAnimation(); bot.seek(9.5); const resumed = await capture();
      const resumedClock = bot.partAnimation;
      bot.seek(9); const globalReplay = await capture();
      // Store only test-owned pixel snapshots/helpers. All element operations
      // below remain public methods and acknowledged capture/diagnostic reads.
      bot.seekPartAnimation(.25); const autoplay = await capture();
      window.publicBoneTest = { equal, capture, modes, autoplay };
      bot.paused = false; bot.playPartAnimation();
      return {
        neutralRig: equal(bare, bound), reset: equal(neutral, reset),
        bodyPixels: center(bound, 'body').count, badgePixels: center(neutral, 'badge').count, eyePixels: center(bound, 'ink').count,
        bodyShift, badgeShift, eyeShift, pluginShift, mountedSilhouette, pluginSilhouette, manualPoses, evidence,
        seekChanged: !equal(first, later), seekReplayed: equal(first, replay),
        pausedStable: equal(paused, pausedAfterGlobalSeek), pausedClock, resumedClock,
        resumeChanged: !equal(paused, resumed), globalSeekReplayed: equal(paused, globalReplay),
        frames: bot.diagnostics.frames, modes,
      };
    });
    const artifactDirectory = `artifacts/body-rig-${backend}-${graphics}`;
    await mkdir(artifactDirectory, { recursive: true });
    for (const [name, png] of Object.entries(sampled.evidence)) await writeFile(`${artifactDirectory}/${name}.png`, Buffer.from(png, 'base64'));
    const { evidence, ...metrics } = sampled;
    await writeFile(`${artifactDirectory}/metrics.json`, JSON.stringify(metrics, null, 2));
    t.diagnostic(JSON.stringify(metrics));
    assert.equal(sampled.neutralRig, true); assert.equal(sampled.reset, true);
    assert.ok(sampled.bodyPixels > 1000); assert.ok(sampled.badgePixels > 10); assert.ok(sampled.eyePixels > 20);
    assert.equal(sampled.mountedSilhouette, true, 'mounted badge remains inside the independently captured body silhouette');
    assert.ok(sampled.bodyShift > 10); assert.ok(Math.abs(sampled.badgeShift - sampled.bodyShift) < 1.5, 'mounted badge follows its body bone');
    assert.ok(Math.abs(sampled.eyeShift - sampled.bodyShift) < 1.5, 'eye ink follows the deformed body chart');
    assert.ok(sampled.pluginShift > 5); assert.equal(sampled.pluginSilhouette, true, 'plugin-local bone leaves every body silhouette alpha sample unchanged');
    assert.deepEqual(sampled.manualPoses, { body: { root: { position: [.25, 0, 0] } }, plugin: { tip: { position: [.12, 0, 0] } } });
    assert.equal(sampled.seekChanged, true); assert.equal(sampled.seekReplayed, true); assert.equal(sampled.pausedStable, true);
    assert.equal(sampled.pausedClock.playing, false); assert.equal(sampled.pausedClock.time, .5);
    assert.equal(sampled.resumedClock.playing, true); assert.equal(sampled.resumedClock.time, 1);
    assert.equal(sampled.resumeChanged, true); assert.equal(sampled.globalSeekReplayed, true);
    for (const mode of sampled.modes) assert.deepEqual(mode, { backend, graphics });
    await page.waitForFunction(frames => {
      const bot = document.getElementById('bot');
      return bot.diagnostics.frames > frames + 2 && bot.partAnimation.time > .4;
    }, sampled.frames, { timeout: 10000 });

    const stopped = await page.evaluate(async () => {
      const bot = document.getElementById('bot'), fixture = window.publicBoneTest;
      bot.pausePartAnimation(); const pixels = await fixture.capture();
      const before = { ...bot.diagnostics }, clock = bot.partAnimation.time;
      await new Promise(resolve => setTimeout(resolve, 180));
      const after = { ...bot.diagnostics }, laterClock = bot.partAnimation.time;
      const stable = fixture.equal(pixels, await fixture.capture());
      bot.paused = true; await fixture.capture();
      return { before, after, clock, laterClock, stable, animatedChanged: !fixture.equal(fixture.autoplay, pixels), playing: bot.partAnimation.playing };
    });
    assert.equal(stopped.playing, false); assert.equal(stopped.before.running, false); assert.equal(stopped.after.running, false);
    assert.equal(stopped.after.frames, stopped.before.frames, 'pausing the only moving tracks leaves no idle render loop');
    assert.equal(stopped.laterClock, stopped.clock); assert.equal(stopped.stable, true); assert.equal(stopped.animatedChanged, true, 'the running clock advances rendered bone pixels, not only metadata');

    const reconnected = await page.evaluate(async () => {
      const bot = document.getElementById('bot'), fixture = window.publicBoneTest;
      const before = await fixture.capture(), canvas = bot.shadowRoot.querySelector('canvas');
      const generation = bot.diagnostics.generation, clip = bot.partAnimation;
      bot.remove(); document.body.append(bot);
      // Public capture is ordered behind worker generation initialization.
      const after = await fixture.capture();
      return { exact: fixture.equal(before, after), canvasReplaced: canvas !== bot.shadowRoot.querySelector('canvas'), generation, diagnostics: bot.diagnostics, clip, restoredClip: bot.partAnimation, modes: fixture.modes, audit: { ...boneWorkerAudit } };
    });
    assert.equal(reconnected.exact, true); assert.equal(reconnected.canvasReplaced, backend === 'worker', 'only transferred worker canvases require replacement');
    assert.ok(reconnected.diagnostics.generation > reconnected.generation); assert.equal(reconnected.diagnostics.backend, backend); assert.equal(reconnected.diagnostics.graphics, graphics);
    assert.equal(reconnected.restoredClip.playing, false); assert.equal(reconnected.restoredClip.time, reconnected.clip.time);
    assert.equal(reconnected.audit.created, backend === 'worker' ? 2 : 0); assert.equal(reconnected.audit.transfers, backend === 'worker' ? 2 : 0); assert.equal(reconnected.audit.terminated, backend === 'worker' ? 1 : 0);
    assert.deepEqual(reconnected.audit.errors, []); assert.deepEqual(errors, []);
    for (const mode of reconnected.modes) assert.deepEqual(mode, { backend, graphics });
    if (canvasAudit) await canvasAudit.assertDenied({ worker: backend === 'worker', minWorkerResponses: backend === 'worker' ? 2 : 1 });
  });
}
