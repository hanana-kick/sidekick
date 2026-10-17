import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { createAppServer } from '../scripts/serve.mjs';
import { loadOfflineFixture } from './fixture.mjs';
import { legacyStudioDesign } from './legacy-studio-fixture.mjs';
let browser, server, baseURL;
const offline = process.env.SIDEKICK_OFFLINE_BROWSER === '1';
const screenshots = process.env.SIDEKICK_SCREENSHOTS;
before(async () => {
  server = createAppServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  baseURL = 'http://127.0.0.1:' + server.address().port;
  const executablePath = process.env.CHROMIUM_PATH ?? (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
  browser = await chromium.launch({ executablePath, headless: process.env.SIDEKICK_HEADED !== '1', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
  if (screenshots) await mkdir(screenshots, { recursive: true });
});
after(async () => { await browser?.close(); if (server) await new Promise(resolve => server.close(resolve)); });
async function pageFor(t, options = {}, beforeLoad) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1040 }, reducedMotion: 'reduce', ...options });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  t.after(async () => { await page.close(); assert.deepEqual(errors, [], 'Browser console/page errors'); });
  if (beforeLoad) await beforeLoad(page);
  if (offline) await loadOfflineFixture(page); else await page.goto(baseURL);
  await page.waitForFunction(() => document.getElementById('flat')?.ready === true);
  await page.evaluate(async () => { window.fixtureAPI = await import('/src/index.js'); });
  return page;
}
const shapeButton = (page, name) => page.locator('#material-shape button[data-shape="' + name + '"]');
const selectedShape = page => page.locator('#material-shape button[aria-pressed="true"]').getAttribute('data-shape');
const tab = (page, name) => page.getByRole('tab', { name, exact: true }).click();
const designOf = page => page.locator('#flat').evaluate(a => a.design);
const setColor = (page, id, color) => page.locator('#' + id).evaluate((input, value) => { input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); }, color);
const rangeValue = async (page, id) => Number(await page.locator('#' + id).getAttribute('aria-valuenow'));
async function setRange(page, id, value) {
  const control = page.locator('#' + id), current = await rangeValue(page, id);
  const step = id.endsWith('-weight') ? .01 : id === 'shape-duration' ? 50 : 1;
  let steps = Math.round((value - current) / step);
  await control.focus();
  const pageKey = steps >= 0 ? 'PageUp' : 'PageDown', key = steps >= 0 ? 'ArrowRight' : 'ArrowLeft';
  steps = Math.abs(steps);
  for (let i = 0; i < Math.floor(steps / 10); i++) await control.press(pageKey);
  for (let i = 0; i < steps % 10; i++) await control.press(key);
  assert.ok(Math.abs(await rangeValue(page, id) - value) < step / 2, id + ' keyboard value');
}
async function choose(page, id, value) {
  const names = { neutral: '기본', smile: '웃음', blink: '감기', smooth: '부드럽게', linear: '일정하게' };
  await page.locator('#' + id).click();
  await page.getByRole('option', { name: names[value], exact: true }).click();
}
const equipment = (page, slot, preset) => page.locator('[data-equipment="' + slot + '"][data-accessory="' + preset + '"]');
async function equip(page, slot, preset, enabled = true) {
  const control = equipment(page, slot, preset);
  if ((await control.getAttribute('data-state') === 'on') !== enabled) await control.click();
}
async function importJSON(page, value) {
  await tab(page, 'JSON');
  await page.locator('#design-json').fill(typeof value === 'string' ? value : JSON.stringify(value));
  await page.locator('#import-json').click();
}

test('HTTP build serves real assets, rejects traversal, and has explicit MIME types', async () => {
  const root = await fetch(baseURL); assert.equal(root.status, 200); assert.match(await root.text(), /Sidekick Studio/);
  const script = await fetch(`${baseURL}/src/index.js`); assert.equal(script.status, 200); assert.match(script.headers.get('content-type'), /javascript/);
  assert.equal((await fetch(`${baseURL}/%2e%2e%2fpackage.json`)).status, 403);
  assert.equal((await fetch(`${baseURL}/missing`)).status, 404);
  assert.equal((await fetch(baseURL, { method: 'POST' })).status, 405);
});

test('Flat body is unlit and transparent; legacy 3d style normalizes without changing pixels', async t => {
  const page = await pageFor(t);
  const result = await page.locator('#flat').evaluate(a => {
    a.paused = true; a.setActivity('still'); a.seek(0);
    a.design = window.fixtureAPI.createDesign({ body: { color: '#e9b64d' }, accessories: [] });
    const before = a.capturePixels();
    a.setAttribute('render-style', '3d');
    const after = a.capturePixels(); let changed = 0, bodyPixels = 0, inkPixels = 0, unexpected = 0;
    for (let i = 0; i < before.pixels.length; i += 4) {
      if (before.pixels[i] !== after.pixels[i] || before.pixels[i + 1] !== after.pixels[i + 1] || before.pixels[i + 2] !== after.pixels[i + 2] || before.pixels[i + 3] !== after.pixels[i + 3]) changed++;
      if (before.pixels[i + 3] !== 255) continue;
      const r = before.pixels[i], g = before.pixels[i + 1], b = before.pixels[i + 2];
      if (r === 233 && g === 182 && b === 77) bodyPixels++;
      else if (r === 36 && g === 36 && b === 44) inkPixels++;
      else unexpected++; // Only antialiased eye edges may blend the two flat colors.
    }
    const attribute = a.getAttribute('render-style'); a.renderStyle = '3d';
    return { changed, bodyPixels, inkPixels, unexpected, corner: before.pixels[3], attribute, property: a.renderStyle, propertyAttribute: a.getAttribute('render-style') };
  });
  assert.equal(result.changed, 0); assert.equal(result.corner, 0);
  assert.ok(result.bodyPixels > 10000); assert.ok(result.inkPixels > 200);
  assert.ok(result.unexpected < result.bodyPixels * 0.02);
  assert.equal(result.attribute, 'flat'); assert.equal(result.property, 'flat'); assert.equal(result.propertyAttribute, 'flat');
});

test('rotating 180 degrees hides body-surface eye ink', async t => {
  const page = await pageFor(t);
  const result = await page.evaluate(() => {
    const a = document.getElementById('flat'); a.paused = true; a.setActivity('still');
    a.design = window.fixtureAPI.createDesign();
    const ink = () => { const { pixels } = a.capturePixels(); let n = 0; for (let i = 0; i < pixels.length; i += 4) if (pixels[i] === 36 && pixels[i + 1] === 36 && pixels[i + 2] === 44 && pixels[i + 3] === 255) n++; return n; };
    a.setView(0); const front = ink(); a.setView(Math.PI); return { front, back: ink() };
  });
  assert.ok(result.front > 200); assert.equal(result.back, 0);
});

test('shape transitions keep eye/accessory edits, reject invalid targets, and finish immediately when paused', async t => {
  const page = await pageFor(t, { reducedMotion: 'no-preference' });
  const result = await page.locator('#flat').evaluate(async a => {
    const { createAccessory } = window.fixtureAPI; a.setActivity('still');
    const transition = a.setShape('heart', { duration: 1500 });
    const edited = a.design; edited.body.color = '#a4b8c9'; edited.eyes.color = '#121212'; edited.accessories = [createAccessory('glasses', 'frames')]; a.design = edited;
    let invalid = 0;
    for (const shape of ['orb', { kind: 'material', name: 'circle' }, { kind: 'rounded-polygon', sides: 4, rounding: 0.3, rotation: 0 }]) {
      try { await a.setShape(shape, { duration: 200 }); } catch { invalid++; }
    }
    const targetAfterInvalid = a.design.body.shape;
    a.paused = true;
    const completed = await transition, atPause = a.capturePixels().pixels;
    const target = a.design; a.design = { ...target, body: { ...target.body, shape: 'circle' } }; a.design = target; const targetPixels = a.capturePixels().pixels;
    let difference = 0; for (let i = 3; i < atPause.length; i += 4) if (atPause[i] !== targetPixels[i]) difference++;
    const pausedChange = await a.setShape('puffy', { duration: 1500 });
    return { invalid, targetAfterInvalid, completed, difference, pausedChange, design: a.design, running: a.diagnostics.running };
  });
  assert.equal(result.invalid, 3); assert.deepEqual(result.targetAfterInvalid, 'heart');
  assert.equal(result.completed.finished, true); assert.equal(result.difference, 0); assert.equal(result.pausedChange.finished, true); assert.equal(result.running, false);
  assert.equal(result.design.body.color, '#a4b8c9'); assert.equal(result.design.eyes.color, '#121212'); assert.equal(result.design.accessories[0].id, 'frames');
  assert.deepEqual(result.design.body.shape, 'puffy');
});


test('reduced motion applies catalog targets immediately without keeping an animation recipe', async t => {
  const page = await pageFor(t);
  await shapeButton(page, 'puffy').click();
  const result = await page.locator('#flat').evaluate(async a => {
    a.setActivity('still'); a.seek(0);
    const immediate = await a.setShape('pixelTriangle', { duration: 1500 });
    return { immediate, body: a.design.body, running: a.diagnostics.running };
  });
  assert.equal(result.immediate.finished, true); assert.equal(result.body.shape, 'pixelTriangle');
  assert.deepEqual(Object.keys(result.body).sort(), ['color', 'shape']); assert.equal(result.running, false);
});


test('switching reduced motion during a shape transition completes its persisted target', async t => {
  const page = await pageFor(t, { reducedMotion: 'no-preference' });
  await page.locator('#flat').evaluate(a => {
    a.setActivity('still'); window.pendingShape = a.setShape('pixelTriangle', { duration: 10000 });
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const result = await page.locator('#flat').evaluate(async a => ({ result: await window.pendingShape, shape: a.design.body.shape, running: a.diagnostics.running }));
  assert.equal(result.result.finished, true); assert.deepEqual(result.shape, 'pixelTriangle'); assert.equal(result.running, false);
});


test('detach during shape transition cancels the old promise and reconnects at the saved target', async t => {
  const page = await pageFor(t, { reducedMotion: 'no-preference' });
  const result = await page.locator('#flat').evaluate(async a => {
    a.setActivity('still');
    const parent = a.parentElement, target = 'puffy';
    const transition = a.setShape(target, { duration: 5000 }); a.remove();
    const cancelled = await transition; parent.append(a);
    const restored = a.capturePixels().pixels, saved = a.design; a.design = { ...saved, body: { ...saved.body, shape: 'circle' } }; a.design = saved; const endpoint = a.capturePixels().pixels;
    let difference = 0; for (let i = 3; i < restored.length; i += 4) if (restored[i] !== endpoint[i]) difference++;
    return { cancelled, difference, shape: a.design.body.shape, ready: a.ready };
  });
  assert.equal(result.cancelled.finished, false); assert.equal(result.difference, 0); assert.deepEqual(result.shape, 'puffy'); assert.equal(result.ready, true);
});


test('surface eye capsules follow body roll and stay in the body pass across catalog shapes', async t => {
  const page = await pageFor(t);
  const checks = await page.locator('#flat').evaluate(async a => {
    const { createDesign } = window.fixtureAPI;
    a.style.width = '400px'; a.style.height = '400px'; a.paused = true; a.setActivity('still'); a.seek(0);
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    // At a front view, body-local XY preserves the glyph and its roll.
    // Oblique views use the real curved surface, so projected aspect is not fixed.
    function components() {
      const { pixels, width, height } = a.capturePixels(), mask = new Uint8Array(width * height), groups = [];
      for (let i = 0; i < mask.length; i++) mask[i] = pixels[i * 4] > 220 && pixels[i * 4 + 1] < 45 && pixels[i * 4 + 2] > 220 && pixels[i * 4 + 3] === 255 ? 1 : 0;
      for (let start = 0; start < mask.length; start++) {
        if (!mask[start]) continue;
        const stack = [start], points = []; mask[start] = 0;
        while (stack.length) {
          const index = stack.pop(), x = index % width, y = Math.floor(index / width); points.push([x, y]);
          for (const next of [x > 0 ? index - 1 : -1, x + 1 < width ? index + 1 : -1, y > 0 ? index - width : -1, y + 1 < height ? index + width : -1]) {
            if (next >= 0 && mask[next]) { mask[next] = 0; stack.push(next); }
          }
        }
        if (points.length < 12) continue;
        const meanX = points.reduce((n, p) => n + p[0], 0) / points.length, meanY = points.reduce((n, p) => n + p[1], 0) / points.length;
        let xx = 0, yy = 0, xy = 0;
        for (const [x, y] of points) { xx += (x - meanX) ** 2; yy += (y - meanY) ** 2; xy += (x - meanX) * (y - meanY); }
        const spread = Math.hypot(xx - yy, 2 * xy);
        groups.push({ pixels: points.length, aspect: Math.sqrt((xx + yy + spread) / (xx + yy - spread)), angle: 0.5 * Math.atan2(2 * xy, xx - yy) });
      }
      return groups.sort((left, right) => right.pixels - left.pixels);
    }
    const cases = ['square', 'circle', 'triangle', 'verySunny', 'puffy', 'pixelTriangle'];
    const checks = [];
    for (const shape of cases) {
      a.design = createDesign({ body: { shape, color: '#c0b080' }, eyes: { color: '#ff00ff' } });
      for (const [yaw, pitch, roll] of [[0, 0, 0], [0, 0, 0.45], [0, 0, -0.6], [0.35, 0.18, 0.45], [-0.35, -0.15, -0.6]]) {
        a.setView(yaw, pitch); await a.motion.to({ body: { rotation: [0, 0, roll] } }, { duration: 0 });
        checks.push({ shape, yaw, pitch, roll, groups: components(), drawCalls: a.diagnostics.drawCalls });
      }
    }
    return checks;
  });
  for (const check of checks) {
    assert.equal(check.drawCalls, 1, JSON.stringify(check));
    assert.equal(check.groups.length, 2, `Both front-surface eyes remain distinguishable: ${JSON.stringify(check)}`);
    for (const glyph of check.groups) {
      if (check.yaw === 0 && check.pitch === 0) {
        assert.ok(glyph.aspect > 1.5 && glyph.aspect < 3.8, `Front-view capsule keeps its local proportions: ${JSON.stringify(check)}`);
        assert.ok(Math.abs(Math.sin(glyph.angle - (Math.PI / 2 + check.roll))) < 0.12, `Eye's principal axis follows body roll: ${JSON.stringify(check)}`);
      }
    }
  }
});

test('curated eyes and independent expressions cannot protrude beyond the body silhouette', async t => {
  const page = await pageFor(t);
  const checks = await page.locator('#flat').evaluate(async a => {
    const { createDesign } = window.fixtureAPI;
    a.paused = true; a.setActivity('still'); a.seek(0);
    const checks = [];
    for (const shape of ['square', 'triangle', 'puffy', 'pixelTriangle', 'verySunny', 'clover4Leaf', 'burst', 'cookie9Sided']) {
      for (const yaw of [0, Math.PI / 2, -Math.PI / 2, Math.PI]) {
        a.design = createDesign({ body: { shape } }); a.setView(yaw);
        const base = a.capturePixels();
        for (const [left, right] of [['smile', 'neutral'], ['blink', 'smile'], ['blink', 'blink']]) {
          a.design = createDesign({ body: { shape }, eyes: { left: { weights: window.fixtureAPI.eyeExpressionWeights(left) }, right: { weights: window.fixtureAPI.eyeExpressionWeights(right) } } });
          const next = a.capturePixels(); let alphaDiff = 0, coloredDiff = 0, backInk = 0;
          for (let i = 0; i < base.pixels.length; i += 4) {
            if (base.pixels[i + 3] !== next.pixels[i + 3]) alphaDiff++;
            if (base.pixels[i] !== next.pixels[i] || base.pixels[i + 1] !== next.pixels[i + 1] || base.pixels[i + 2] !== next.pixels[i + 2]) coloredDiff++;
            if (next.pixels[i] === 36 && next.pixels[i + 1] === 36 && next.pixels[i + 2] === 44 && next.pixels[i + 3] === 255) backInk++;
          }
          checks.push({ yaw, left, right, alphaDiff, coloredDiff, backInk, drawCalls: a.diagnostics.drawCalls });
        }
      }
    }
    return checks;
  });
  assert.ok(checks.every(c => c.alphaDiff === 0 && c.drawCalls === 1), JSON.stringify(checks));
  assert.ok(checks.filter(c => c.yaw === 0).every(c => c.coloredDiff > 50), 'Expressions visibly change only surface color');
  assert.ok(checks.filter(c => c.yaw === Math.PI).every(c => c.backInk === 0), 'Eye ink never appears on the back');
});

test('independent expression transitions persist and rapid edits finish both eyes', async t => {
  const page = await pageFor(t, { reducedMotion: 'no-preference' });
  const result = await page.locator('#flat').evaluate(async a => {
    a.setActivity('still'); a.style.width = '256px'; a.style.height = '256px';
    a.design = window.fixtureAPI.createDesign({ eyes: { left: { weights: { blink: 0.3 } }, right: { weights: { blink: 0.1 } } } });
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const left = a.setExpression('left', 'smile', { duration: 800 });
    const initial = a.pose.eyes;
    // Observe an actual rendered animation step; wall-clock sleeps can expire before
    // the first software-GPU frame is delivered on a busy CI runner.
    await new Promise((resolve, reject) => {
      const deadline = performance.now() + 5000;
      const sample = () => {
        if (a.pose.eyes.left.smile > 0) resolve();
        else if (performance.now() > deadline) reject(new Error('Eye animation did not advance on RAF'));
        else requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    const midway = a.pose.eyes;
    const right = a.setExpression('right', 'blink', { duration: 180 });
    const savedImmediately = a.design.eyes;
    const changed = a.design; changed.body.color = '#a4b8c9'; a.design = changed;
    const leftResult = await left, rightResult = await right, finished = a.pose.eyes;
    await a.setExpression('both', 'neutral', { duration: 0 });
    return { initial, midway, savedImmediately, leftResult, rightResult, finished, reopened: a.pose.eyes };
  });
  assert.equal(result.initial.left.smile, 0); assert.equal(result.initial.right.smile, 0);
  assert.ok(result.midway.left.smile > 0 && result.midway.left.smile < 1, JSON.stringify(result.midway));
  assert.equal(result.midway.right.openness, 0.9);
  assert.deepEqual(result.savedImmediately.left.weights, { smile: 1, blink: 0 }); assert.deepEqual(result.savedImmediately.right.weights, { smile: 0, blink: 1 });
  assert.equal(result.leftResult.finished, true); assert.equal(result.rightResult.finished, true);
  assert.equal(result.finished.left.smile, 1); assert.equal(result.finished.left.openness, 1); assert.equal(result.finished.right.openness, 0);
  assert.deepEqual(result.reopened, { left: { openness: 1, smile: 0 }, right: { openness: 1, smile: 0 } });
});

test('transparent PNG export contains an actual PNG image', async t => {
  const page = await pageFor(t), pending = page.waitForEvent('download');
  await page.locator('#export-png').click(); const download = await pending, data = await readFile(await download.path());
  assert.equal(download.suggestedFilename(), 'sidekick.png'); assert.equal(data.subarray(1, 4).toString(), 'PNG'); assert.ok(data.length > 1500);
});

test('interaction none passes clicks to underlying content, box supports keyboard activation', async t => {
  const page = await pageFor(t);
  await page.evaluate(() => {
    const a = document.getElementById('flat'); a.interaction = 'none';
    const wrapper = document.createElement('div'); wrapper.style.cssText = 'position:fixed;left:20px;top:80px;width:180px;height:180px;z-index:1000';
    const button = document.createElement('button'); button.id = 'under'; button.textContent = 'underlying'; button.style.cssText = 'position:absolute;inset:0';
    window.underClicks = 0; window.activations = 0; button.onclick = () => window.underClicks++;
    wrapper.append(button); document.body.append(wrapper); wrapper.append(a); a.style.cssText = 'position:absolute;inset:0;width:180px;height:180px';
    a.addEventListener('sidekick-activate', () => window.activations++);
  });
  await page.mouse.click(110, 170); assert.equal(await page.evaluate(() => window.underClicks), 1);
  await page.locator('#flat').evaluate(a => { a.interaction = 'box'; a.focus(); }); await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => window.activations), 1);
});

test('motion settles, superseded motion cancels, and pause freezes rendering', async t => {
  const page = await pageFor(t, { reducedMotion: 'no-preference' });
  const result = await page.locator('#flat').evaluate(async a => {
    a.setActivity('still');
    const first = a.motion.to({ face: { uv: [0.3, 0.1] } }, { duration: 600 });
    const second = a.motion.to({ face: { uv: [-0.2, 0.15] }, accessories: { hat: { rotation: [0, 0.2, 0] } } }, { duration: 160 });
    return { first: await first, second: await second, pose: a.pose };
  });
  assert.equal(result.first.finished, false); assert.equal(result.second.finished, true); assert.deepEqual(result.pose.face, [-0.2, 0.15]);
  await page.locator('#flat').evaluate(a => { a.paused = true; }); const frames = await page.locator('#flat').evaluate(a => a.diagnostics.frames);
  await page.waitForTimeout(100); assert.equal(await page.locator('#flat').evaluate(a => a.diagnostics.frames), frames);
});

test('reduced motion stays static; gaze is bounded and surface motion remains controllable', async t => {
  const page = await pageFor(t); const frames = await page.locator('#flat').evaluate(a => a.diagnostics.frames);
  await page.waitForTimeout(100); assert.equal(await page.locator('#flat').evaluate(a => a.diagnostics.frames), frames);
  const result = await page.locator('#flat').evaluate(async a => {
    a.lookAt({ space: 'view', x: 0.6, y: 0.2 }); const done = await a.motion.to({ face: { uv: [0.1, 0.2] } });
    let invalid = false; try { a.lookAt({ space: 'view', x: 2, y: 0 }); } catch { invalid = true; }
    return { pose: a.pose, done, invalid };
  });
  assert.deepEqual(result.pose.gaze, [0.6, 0.2]); assert.equal(result.done.finished, true); assert.equal(result.invalid, true);
});

test('offscreen avatars suspend RAF and resume when visible', async t => {
  const page = await pageFor(t, { reducedMotion: 'no-preference' });
  await page.locator('#flat').evaluate(a => { a.style.position = 'fixed'; a.style.top = '-2000px'; });
  await page.waitForFunction(() => !document.getElementById('flat').diagnostics.running);
  await page.locator('#flat').evaluate(a => { a.style.position = ''; a.style.top = ''; });
  await page.waitForFunction(() => document.getElementById('flat').diagnostics.running);
});

test('detach/reconnect cancels motion and releases then recreates GPU resources', async t => {
  const page = await pageFor(t, { reducedMotion: 'no-preference' });
  const result = await page.locator('#flat').evaluate(async a => {
    const parent = a.parentElement; const motion = a.motion.to({ face: { uv: [0.2, 0] } }, { duration: 3000 });
    a.remove(); const detached = a.diagnostics, cancelled = await motion;
    for (let i = 0; i < 3; i++) { parent.append(a); a.remove(); }
    parent.append(a); return { detached, cancelled, reconnected: a.diagnostics, canvases: a.shadowRoot.querySelectorAll('canvas').length };
  });
  assert.equal(result.detached.buffers, 0); assert.equal(result.detached.running, false); assert.equal(result.cancelled.finished, false);
  assert.equal(result.reconnected.buffers, 9); assert.equal(result.reconnected.ready, true); assert.equal(result.canvases, 1);
});

test('context loss is surfaced and restoration rebuilds the renderer', async t => {
  const page = await pageFor(t);
  const supported = await page.locator('#flat').evaluate(a => { const gl = a.shadowRoot.querySelector('canvas').getContext('webgl2'); window.lossExtension = gl.getExtension('WEBGL_lose_context'); window.lossExtension?.loseContext(); return !!window.lossExtension; });
  assert.equal(supported, true); await page.waitForFunction(() => !document.getElementById('flat').ready);
  await page.waitForTimeout(100); await page.evaluate(() => window.lossExtension.restoreContext());
  await page.waitForFunction(() => document.getElementById('flat').ready);
  assert.equal(await page.locator('#flat').evaluate(a => a.diagnostics.buffers), 9);
});

test('representative catalog shapes and curated accessories remain transparent at canvas borders', async t => {
  const page = await pageFor(t);
  const result = await page.locator('#flat').evaluate(a => {
    const { createDesign, createAccessory, ACCESSORY_PRESETS } = window.fixtureAPI;
    a.paused = true; a.setActivity('still'); const checks = [];
    for (const shape of ['circle', 'square', 'verySunny', 'puffy', 'pixelTriangle']) for (const preset of ACCESSORY_PRESETS) {
      const accessory = preset === 'earring' ? createAccessory(preset, { slot: 'leftEar' }) : createAccessory(preset);
      a.design = createDesign({ body: { shape }, accessories: [accessory] });
      for (const yaw of [0, Math.PI / 2, Math.PI]) {
        a.setView(yaw); const { pixels, width, height } = a.capturePixels(); let border = 0, visible = 0;
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { const alpha = pixels[(y * width + x) * 4 + 3]; if (alpha) { visible++; if (x === 0 || y === 0 || x === width - 1 || y === height - 1) border++; } }
        checks.push({ shape, preset, yaw, border, visible });
      }
    }
    return checks;
  });
  assert.ok(result.every(r => r.border === 0 && r.visible > 100), JSON.stringify(result.filter(r => r.border !== 0 || r.visible <= 100)));
});

test('WebGL unavailable produces a visible fallback, not a false ready state', async t => {
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } }); t.after(() => page.close());
  const disableWebGL = () => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) { return type === 'webgl2' ? null : original.call(this, type, ...args); };
  };
  await page.addInitScript(disableWebGL);
  if (offline) await loadOfflineFixture(page); else await page.goto(baseURL);
  await page.waitForSelector('#flat');
  const result = await page.locator('#flat').evaluate(a => ({ ready: a.ready, running: a.diagnostics.running, text: a.shadowRoot.querySelector('[part="fallback"]').textContent, hidden: a.shadowRoot.querySelector('[part="fallback"]').hidden }));
  assert.equal(result.ready, false); assert.equal(result.running, false); assert.equal(result.hidden, false); assert.match(result.text, /WebGL2/);
});


test('surface eye ink follows rounded geometry, can remain at true side view, and never reaches the back', async t => {
  const page = await pageFor(t);
  const cases = await page.locator('#flat').evaluate(async a => {
    a.style.width = '420px'; a.style.height = '420px'; a.paused = true; a.setActivity('still'); a.seek(0);
    a.design = window.fixtureAPI.createDesign({ body: { shape: 'square', color: '#c0b080' }, eyes: { color: '#ff00ff' }, accessories: [] });
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    function measure() {
      const { pixels, width, height } = a.capturePixels(), mask = new Uint8Array(width * height), groups = [];
      for (let i = 0; i < mask.length; i++) mask[i] = pixels[i * 4] > 220 && pixels[i * 4 + 1] < 45 && pixels[i * 4 + 2] > 220 && pixels[i * 4 + 3] === 255 ? 1 : 0;
      for (let start = 0; start < mask.length; start++) {
        if (!mask[start]) continue;
        const stack = [start], points = []; mask[start] = 0;
        while (stack.length) {
          const index = stack.pop(), x = index % width, y = Math.floor(index / width); points.push([x, y]);
          for (const next of [x > 0 ? index - 1 : -1, x + 1 < width ? index + 1 : -1, y > 0 ? index - width : -1, y + 1 < height ? index + width : -1]) {
            if (next >= 0 && mask[next]) { mask[next] = 0; stack.push(next); }
          }
        }
        if (points.length < 4) continue;
        const xs = points.map(point => point[0]), ys = points.map(point => point[1]);
        groups.push({ area: points.length, width: Math.max(...xs) - Math.min(...xs) + 1, height: Math.max(...ys) - Math.min(...ys) + 1 });
      }
      return { groups, area: groups.reduce((sum, group) => sum + group.area, 0) };
    }
    return [[0, 0], [60, 0], [75, 0], [0, 60], [90, 0], [-90, 0], [180, 0]].map(([yaw, pitch]) => { a.setCamera({ yaw, pitch, roll: 0 }); return { yaw, pitch, ...measure() }; });
  });
  const front = cases[0]; assert.equal(front.groups.length, 2); assert.ok(front.area > 100);
  for (const sample of cases.slice(1, 4)) {
    assert.ok(sample.groups.length >= 1 && sample.groups.length <= 2, JSON.stringify(sample));
    assert.ok(sample.area > 0 && sample.area < front.area * 0.95, `The curved eye surface foreshortens: ${JSON.stringify(sample)}`);
  }
  // A rounded front sheet turns toward the camera near its rim. Its near-side
  // ink remains visible at exactly 90°, unlike a flat front-plane stamp.
  for (const sample of cases.slice(4, 6)) {
    assert.equal(sample.groups.length, 1, `Only the near-side eye remains: ${JSON.stringify(sample)}`);
    assert.ok(sample.area > 4 && sample.area < front.area * 0.35, JSON.stringify(sample));
  }
  assert.ok(Math.abs(cases[4].area - cases[5].area) < Math.max(8, cases[4].area * 0.15), 'The two side views have symmetric ink coverage');
  assert.equal(cases[6].area, 0, 'The back sheet has no eye ink');
});


test('setEyeWeights preserves other weights, color edits and independent running eye channels', async t => {
  const page = await pageFor(t, { reducedMotion: 'no-preference' });
  const result = await page.locator('#flat').evaluate(async a => {
    a.setActivity('still'); a.seek(0); a.style.width = '256px'; a.style.height = '256px';
    a.design = window.fixtureAPI.createDesign();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const left = a.setEyeWeights('left', { smile: 0.8 }, { duration: 800 });
    // Observe an actual rendered animation step; wall-clock sleeps can expire before
    // the first software-GPU frame is delivered on a busy CI runner.
    await new Promise((resolve, reject) => {
      const deadline = performance.now() + 5000;
      const sample = () => {
        if (a.pose.eyes.left.smile > 0) resolve();
        else if (performance.now() > deadline) reject(new Error('Eye animation did not advance on RAF'));
        else requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    const midway = a.pose.eyes;
    const right = a.setEyeWeights('right', { blink: 0.65 }, { duration: 120 });
    await a.updateDesign({ eyes: { color: '#121212' } });
    const immediately = a.design;
    const leftResult = await left, rightResult = await right;
    const endpoint = a.pose.eyes;
    await a.setEyeWeights('left', { blink: 0.3 }, { duration: 0 });
    const partial = { design: a.design, pose: a.pose.eyes };
    await a.setEyeWeights('both', { smile: 0.25 }, { duration: 0 });
    return { midway, immediately, leftResult, rightResult, endpoint, partial, both: a.design.eyes };
  });
  assert.ok(result.midway.left.smile > 0 && result.midway.left.smile < 0.8, JSON.stringify(result.midway));
  assert.deepEqual(result.midway.right, { openness: 1, smile: 0 });
  assert.deepEqual(result.immediately.eyes.left.weights, { smile: 0.8, blink: 0 });
  assert.deepEqual(result.immediately.eyes.right.weights, { smile: 0, blink: 0.65 });
  assert.equal(result.immediately.eyes.color, '#121212');
  assert.equal(result.leftResult.finished, true); assert.equal(result.rightResult.finished, true);
  assert.equal(result.endpoint.left.smile, 0.8); assert.ok(Math.abs(result.endpoint.right.openness - 0.35) < 1e-10);
  assert.deepEqual(result.partial.design.eyes.left.weights, { smile: 0.8, blink: 0.3 });
  assert.deepEqual(result.partial.design.eyes.right.weights, result.immediately.eyes.right.weights);
  assert.deepEqual(result.partial.pose.right, result.endpoint.right);
  assert.deepEqual(result.both.left.weights, { smile: 0.25, blink: 0.3 });
  assert.deepEqual(result.both.right.weights, { smile: 0.25, blink: 0.65 });
});


test('curated smile is visibly wider than neutral and changes surface ink only', async t => {
  const page = await pageFor(t);
  const result = await page.locator('#flat').evaluate(async a => {
    a.style.width = '420px'; a.style.height = '420px'; a.paused = true; a.setActivity('still'); a.seek(0); a.resetCamera();
    a.design = window.fixtureAPI.createDesign({ body: { shape: 'square' }, eyes: { color: '#ff00ff' }, accessories: [] });
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    function measure() {
      const { pixels, width, height } = a.capturePixels();
      const groups = [[], []];
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        if (pixels[i] > 220 && pixels[i + 1] < 45 && pixels[i + 2] > 220 && pixels[i + 3] === 255) groups[x < width / 2 ? 0 : 1].push(x);
      }
      return { pixels, widths: groups.map(xs => xs.length ? Math.max(...xs) - Math.min(...xs) + 1 : 0) };
    }
    const neutral = measure();
    await a.setExpression('both', 'smile', { duration: 0 }); const smile = measure();
    let alphaChanges = 0;
    for (let i = 3; i < neutral.pixels.length; i += 4) if (neutral.pixels[i] !== smile.pixels[i]) alphaChanges++;
    return { neutral: neutral.widths, smile: smile.widths, alphaChanges };
  });
  assert.ok(result.neutral.every(width => width > 4));
  assert.ok(result.smile.every((width, side) => width > result.neutral[side] * 1.4), JSON.stringify(result));
  assert.equal(result.alphaChanges, 0);
});


test('curated smile keeps uniform normal-direction thickness and round caps', async t => {
  const page = await pageFor(t, { viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 2 });
  const cases = await page.locator('#flat').evaluate(async a => {
    a.style.width = '640px'; a.style.height = '640px'; a.paused = true; a.setActivity('still'); a.seek(0); a.resetCamera();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const cases = [];
    for (const target of [{ radius: 0.75, thickness: 0.22 }]) {
      // Curated geometry stays identical when only animation weights change.
      a.design = window.fixtureAPI.createDesign({ body: { shape: 'square', color: '#000000' }, eyes: { color: '#ff00ff' }, accessories: [] });
      const neutral = a.capturePixels(), bounds = [null, null];
      for (let y = 0; y < neutral.height; y++) for (let x = 0; x < neutral.width; x++) {
        const i = (y * neutral.width + x) * 4;
        if (neutral.pixels[i] <= 127 || neutral.pixels[i + 3] !== 255) continue;
        const side = x < neutral.width / 2 ? 0 : 1;
        const b = bounds[side] ??= { minX: x, maxX: x, minY: y, maxY: y };
        b.minX = Math.min(b.minX, x); b.maxX = Math.max(b.maxX, x); b.minY = Math.min(b.minY, y); b.maxY = Math.max(b.maxY, y);
      }
      await a.setExpression('both', 'smile', { duration: 0 });
      const smile = a.capturePixels();
      // Bilinear readback measures the 50% ink boundary without counting AA as
      // extra thickness. Pixel coordinates refer to readPixels' bottom-up rows.
      function ink(x, y) {
        const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
        const value = (px, py) => px < 0 || py < 0 || px >= smile.width || py >= smile.height ? 0 : smile.pixels[(py * smile.width + px) * 4] / 255;
        return value(ix, iy) * (1 - fx) * (1 - fy) + value(ix + 1, iy) * fx * (1 - fy) + value(ix, iy + 1) * (1 - fx) * fy + value(ix + 1, iy + 1) * fx * fy;
      }
      function extent(x, y, dx, dy, radius) {
        if (ink(x, y) < 0.5) return -1;
        let previous = 0;
        for (let distance = 0.1; distance <= radius * 2 + 2; distance += 0.1) {
          if (ink(x + dx * distance, y + dy * distance) < 0.5) return (previous + distance) / 2;
          previous = distance;
        }
        return -1;
      }
      const eyes = bounds.map(b => {
        if (!b) return null;
        const unit = b.maxX - b.minX + 1, centerX = (b.minX + b.maxX) / 2, centerY = (b.minY + b.maxY) / 2;
        const thickness = unit * target.thickness, radius = thickness / 2;
        const centerlineRadius = unit * target.radius;
        const sections = [0.15, 0.55, Math.PI / 2, Math.PI - 0.55, Math.PI - 0.15].map(angle => {
          const nx = Math.cos(angle), ny = Math.sin(angle);
          const x = centerX + centerlineRadius * nx, y = centerY + centerlineRadius * ny;
          const outward = extent(x, y, nx, ny, radius), inward = extent(x, y, -nx, -ny, radius);
          return { angle, outward, inward, thickness: outward + inward };
        });
        const capRadii = [-1, 1].flatMap(sign => {
          const x = centerX + sign * centerlineRadius, y = centerY;
          return [-Math.PI / 3, 0, Math.PI / 3].map(angle => extent(x, y, Math.sin(angle), -Math.cos(angle), radius));
        });
        return { thickness, radius, sections, capRadii };
      });
      let alphaChanges = 0;
      for (let i = 3; i < neutral.pixels.length; i += 4) if (neutral.pixels[i] !== smile.pixels[i]) alphaChanges++;
      cases.push({ target, eyes, alphaChanges, drawCalls: a.diagnostics.drawCalls });
    }
    return cases;
  });
  for (const sample of cases) {
    assert.equal(sample.alphaChanges, 0); assert.equal(sample.drawCalls, 1);
    for (const eye of sample.eyes) {
      assert.ok(eye, `Both neutral capsules provide a pixel calibration: ${JSON.stringify(sample)}`);
      for (const section of eye.sections) {
        assert.ok(section.outward > 0 && section.inward > 0, JSON.stringify(sample));
        assert.ok(Math.abs(section.thickness - eye.thickness) < 2.5, `Normal-direction stroke thickness is constant: ${JSON.stringify(sample)}`);
      }
      const thicknesses = eye.sections.map(section => section.thickness);
      assert.ok(Math.max(...thicknesses) - Math.min(...thicknesses) < 2.5, 'Steep smile sides are not thinner than the apex');
      assert.ok(eye.capRadii.every(radius => Math.abs(radius - eye.radius) < 2.5), `The outer half of each endpoint is a round cap: ${JSON.stringify(sample)}`);
    }
  }
});


test('curated rounded volume tapers continuously toward its silhouette', async t => {
  const page = await pageFor(t);
  const cases = await page.locator('#flat').evaluate(async a => {
    a.style.width = '500px'; a.style.height = '500px'; a.paused = true; a.setActivity('still'); a.seek(0);
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    function silhouette() {
      const capture = a.capturePixels(), rows = [];
      for (let y = 0; y < capture.height; y++) {
        let min = capture.width, max = -1;
        for (let x = 0; x < capture.width; x++) if (capture.pixels[(y * capture.width + x) * 4 + 3] > 127) { min = Math.min(min, x); max = x; }
        if (max >= min) rows.push({ y, width: max - min + 1 });
      }
      const sample = fraction => rows[Math.round((rows.length - 1) * fraction)].width;
      return { pixels: capture.pixels, width: Math.max(...rows.map(row => row.width)), height: rows.length, samples: [0.1, 0.25, 0.5, 0.75, 0.9].map(sample) };
    }
    const cases = [];
    for (const shape of ['square', 'circle']) {
      a.design = window.fixtureAPI.createDesign({ body: { shape, color: '#c0b080' }, eyes: { color: '#c0b080' }, accessories: [] });
      a.resetCamera(); const front = silhouette(); a.setCameraPreset('side'); const side = silhouette();
      cases.push({ shape, front: { width: front.width, height: front.height }, side: { width: side.width, height: side.height, samples: side.samples }, drawCalls: a.diagnostics.drawCalls });
    }
    return cases;
  });
  for (const sample of cases) {
    assert.equal(sample.drawCalls, 1); assert.ok(sample.front.width > 80 && sample.side.width > 40);
    const [lowerEdge, lowerShoulder, center, upperShoulder, upperEdge] = sample.side.samples;
    assert.ok(lowerEdge < center * 0.85 && upperEdge < center * 0.85, `Rounded ends narrow toward the silhouette: ${JSON.stringify(sample)}`);
    assert.ok(lowerShoulder > lowerEdge + 3 && upperShoulder > upperEdge + 3, `The shoulder is continuous: ${JSON.stringify(sample)}`);
  }
});


test('shadcn Studio keeps one transparent preview, real silhouette buttons and color-only appearance', async t => {
  const page = await pageFor(t);
  assert.equal(await page.locator('sidekick-avatar').count(), 1);
  assert.equal(await selectedShape(page), 'square');
  assert.equal((await designOf(page)).version, 7);
  assert.equal(await page.locator('#material-shape button[data-shape]').count(), 35);
  assert.equal(await page.locator('#material-shape button svg path').count(), 35);
  assert.equal(await page.locator('#appearance-panel input[type=range], #appearance-panel [role=slider]').count(), 0);
  assert.equal(await page.locator('#shape-duration').getAttribute('role'), 'slider');
  assert.equal(await page.locator('#export-json').getAttribute('data-slot'), 'button');
  assert.equal(await page.locator('#export-json').evaluate(el => getComputedStyle(el).cursor), 'pointer');
  const expected = await page.locator('#flat').evaluate(a => { window.originalAvatar = a; window.originalShapeTile = document.querySelector('[data-shape=heart]'); return a.design; });
  assert.deepEqual(expected.accessories.map(item => item.preset), ['beret']);
  await page.locator('#shape-search').fill('heart');
  assert.equal(await page.locator('#material-shape button:visible').count(), 1);
  await shapeButton(page, 'heart').click(); assert.equal(await selectedShape(page), 'heart');
  await page.locator('#shape-search').fill('no such shape'); assert.equal(await page.locator('#material-shape button:visible').count(), 0);
  await page.locator('#shape-search').fill('');
  await shapeButton(page, 'heart').focus(); await shapeButton(page, 'heart').press('Home');
  assert.equal(await page.locator('#material-shape button:focus').getAttribute('data-shape'), 'circle');
  for (const name of ['애니메이션', '카메라', 'JSON', '외형']) await tab(page, name);
  assert.equal(await page.evaluate(() => document.getElementById('flat') === window.originalAvatar && document.querySelector('[data-shape=heart]') === window.originalShapeTile), true);
  if (screenshots) await page.screenshot({ path: screenshots + '/studio-desktop.png' });
});

test('Studio rapid shape selections continue from the visible contour and retain duration/easing', async t => {
  const page = await pageFor(t, { reducedMotion: 'no-preference' });
  await tab(page, '애니메이션'); await setRange(page, 'shape-duration', 800); await choose(page, 'shape-easing', 'linear');
  await tab(page, '외형');
  await page.locator('#flat').evaluate(a => {
    a.setActivity('still'); const original = a.setShape.bind(a); window.shapeCalls = []; window.shapePromises = [];
    a.setShape = (shape, options) => { window.shapeCalls.push({ shape, options }); const result = original(shape, options); window.shapePromises.push(result); return result; };
  });
  await shapeButton(page, 'verySunny').click(); await page.waitForTimeout(130);
  const difference = await page.locator('#flat').evaluate(a => {
    const before = a.capturePixels().pixels; document.querySelector('[data-shape=clover4Leaf]').click(); const after = a.capturePixels().pixels;
    let changed = 0; for (let i = 3; i < before.length; i += 4) if (before[i] !== after[i]) changed++; return changed;
  });
  assert.equal(difference, 0, 'Retarget starts at the exact current outline');
  const results = await page.evaluate(async () => ({ results: await Promise.all(window.shapePromises), calls: window.shapeCalls }));
  assert.deepEqual(results.results.map(item => item.finished), [false, true]);
  assert.deepEqual(results.calls.map(item => item.options), [{ duration: 800, easing: 'linear' }, { duration: 800, easing: 'linear' }]);
  assert.equal((await designOf(page)).body.shape, 'clover4Leaf');
});

test('Studio color and equipment edits preserve an active shape transition and independent eye states', async t => {
  const page = await pageFor(t, { reducedMotion: 'no-preference' });
  await tab(page, '애니메이션'); await setRange(page, 'shape-duration', 1500);
  await setRange(page, 'left-smile-weight', .6); await setRange(page, 'right-blink-weight', .3);
  await tab(page, '외형');
  await page.locator('#flat').evaluate(a => { a.setActivity('still'); const original = a.setShape.bind(a); a.setShape = (...args) => (window.activeShape = original(...args)); });
  await shapeButton(page, 'heart').click(); await setColor(page, 'body-color', '#a4b8c9'); await equip(page, 'eyes', 'glasses');
  const result = await page.evaluate(async () => ({ finished: (await window.activeShape).finished, design: document.getElementById('flat').design }));
  assert.equal(result.finished, true); assert.equal(result.design.body.shape, 'heart'); assert.equal(result.design.body.color, '#a4b8c9');
  assert.equal(result.design.eyes.left.weights.smile, .6); assert.equal(result.design.eyes.right.weights.blink, .3);
  assert.equal(result.design.accessories.some(item => item.preset === 'glasses'), true);
});

test('Studio six equipment slots coexist, replace within slots and keep independent ear colors', async t => {
  const page = await pageFor(t);
  for (const [slot, preset] of [['eyes', 'glasses'], ['mouth', 'moustache'], ['neck', 'bowTie'], ['leftEar', 'earring'], ['rightEar', 'earring']]) await equip(page, slot, preset);
  let design = await designOf(page); assert.equal(design.accessories.length, 6); assert.equal(new Set(design.accessories.map(item => item.slot)).size, 6);
  await setColor(page, 'accessory-color-leftEar', '#7788aa'); await setColor(page, 'accessory-color-rightEar', '#bb8855');
  await equip(page, 'neck', 'scarf'); await equip(page, 'head', 'halo');
  design = await designOf(page); assert.equal(design.accessories.length, 6);
  assert.equal(design.accessories.some(item => item.preset === 'bowTie' || item.preset === 'beret'), false);
  assert.equal(design.accessories.find(item => item.slot === 'leftEar').color, '#7788aa');
  assert.equal(design.accessories.find(item => item.slot === 'rightEar').color, '#bb8855');
  await equip(page, 'leftEar', 'earring', false);
  design = await designOf(page); assert.equal(design.accessories.length, 5); assert.ok(design.accessories.some(item => item.slot === 'rightEar'));
  assert.equal(await page.locator('#leftEar-slot-status').textContent(), '비어 있음');
});

test('Studio expression presets and continuous weights use one independent canonical state', async t => {
  const page = await pageFor(t); await tab(page, '애니메이션');
  await choose(page, 'left-expression', 'smile'); await choose(page, 'right-expression', 'blink');
  assert.deepEqual((await designOf(page)).eyes.left.weights, { smile: 1, blink: 0 });
  assert.deepEqual((await designOf(page)).eyes.right.weights, { smile: 0, blink: 1 });
  await setRange(page, 'left-smile-weight', .65); await setRange(page, 'left-blink-weight', .25);
  assert.match(await page.locator('#left-expression').textContent(), /직접 혼합/);
  assert.deepEqual((await designOf(page)).eyes.left.weights, { smile: .65, blink: .25 });
  assert.deepEqual((await designOf(page)).eyes.right.weights, { smile: 0, blink: 1 });
  await choose(page, 'left-expression', 'neutral');
  assert.equal(await rangeValue(page, 'left-smile-weight'), 0); assert.equal(await rangeValue(page, 'left-blink-weight'), 0);
  await page.locator('#pause').click(); assert.equal(await page.locator('#flat').evaluate(a => a.paused), true);
  await page.locator('#pause').click(); assert.equal(await page.locator('#flat').evaluate(a => a.paused), false);
});

test('Studio current-schema imports reject missing slots, conflicts and removed geometry atomically', async t => {
  const page = await pageFor(t), original = await designOf(page);
  const invalid = [
    { ...original, body: { ...original.body, thickness: .8 } },
    { ...original, eyes: { ...original.eyes, width: .2 } },
    { ...original, accessories: [{ ...original.accessories[0], rotation: [0, 0, 0] }] },
    { ...original, accessories: [{ ...original.accessories[0], slot: undefined }] },
    { ...original, accessories: [...original.accessories, { ...original.accessories[0], id: 'second-hat' }] },
    { ...original, accessories: [{ id: 'ear', preset: 'earring', slot: 'mouth', color: '#aabbcc' }] },
  ];
  for (const value of invalid) { await importJSON(page, value); assert.deepEqual(await designOf(page), original); assert.ok((await page.locator('#json-error').textContent()).length > 0); }
  const valid = { ...original, accessories: [{ id: 'hat', preset: 'glasses', slot: 'eyes', color: '#445566' }] };
  await importJSON(page, valid); await tab(page, '외형'); await equip(page, 'head', 'beret');
  const design = await designOf(page); assert.deepEqual(design.accessories.map(item => item.id).sort(), ['hat', 'hat-2']);
});

test('Studio v1–v6 imports migrate deterministically, disclose discarded geometry and preserve colors', async t => {
  const page = await pageFor(t), current = await designOf(page);
  current.body.shape = 'heart'; current.body.color = '#abcdee'; current.eyes.color = '#122334';
  current.eyes.left.weights = { smile: 1, blink: .2 };
  current.accessories = [{ id: 'old-glasses', preset: 'glasses', slot: 'eyes', color: '#556677' }];
  for (let version = 1; version <= 6; version++) {
    const old = version === 6 ? { ...current, version, accessories: current.accessories.map(item => ({ ...item, slot: 'face' })) } : legacyStudioDesign(current, version);
    if (version < 6) old.accessories = old.accessories.map(item => ({ ...item, slot: 'face' }));
    await importJSON(page, old); const design = await designOf(page);
    assert.equal(design.version, 7); assert.equal(design.body.shape, 'heart'); assert.equal(design.body.color, '#abcdee');
    assert.equal(design.eyes.color, '#122334'); assert.equal(design.accessories[0].id, 'old-glasses'); assert.equal(design.accessories[0].slot, 'eyes');
    assert.ok((await page.locator('#migration-warning').textContent()).length > 0);
    if (version >= 4) assert.deepEqual(design.eyes.left.weights, { smile: 1, blink: .2 });
  }
});

test('Studio import and reset settle interrupted shapes and reset camera/expression controls', async t => {
  const page = await pageFor(t, { reducedMotion: 'no-preference' });
  await tab(page, '애니메이션'); await setRange(page, 'shape-duration', 1500); await choose(page, 'left-expression', 'smile');
  await tab(page, '외형'); await shapeButton(page, 'boom').click();
  const imported = await designOf(page); imported.body.shape = 'heart'; imported.body.color = '#aabbcc';
  await importJSON(page, imported); assert.equal((await designOf(page)).body.shape, 'heart');
  await tab(page, '카메라'); await page.locator('[data-camera-preset=side]').click();
  await page.locator('#reset').click();
  const reset = await designOf(page); assert.equal(reset.body.shape, 'square'); assert.deepEqual(reset.eyes.left.weights, { smile: 0, blink: 0 });
  assert.deepEqual(await page.locator('#flat').evaluate(a => a.camera), { yaw: 0, pitch: 0, roll: 0 });
  await tab(page, '애니메이션'); assert.equal(await rangeValue(page, 'shape-duration'), 450); assert.match(await page.locator('#shape-easing').textContent(), /부드럽게/);
});

test('Studio JSON export uses applied design rather than an invalid unsaved draft', async t => {
  const page = await pageFor(t); await setColor(page, 'body-color', '#a4b8c9'); await tab(page, 'JSON');
  await page.locator('#design-json').fill('{invalid'); await page.locator('#import-json').click();
  const pending = page.waitForEvent('download'); await page.locator('#export-json').click(); const download = await pending;
  const exported = JSON.parse(await readFile(await download.path(), 'utf8'));
  assert.equal(download.suggestedFilename(), 'sidekick.scene.json'); assert.equal(exported.sceneVersion, 1); assert.equal(exported.design.version, 7); assert.equal(exported.design.body.color, '#a4b8c9');
  assert.equal(await page.locator('#design-json').inputValue(), '{invalid');
});

test('Studio fixed preview stays visible while settings scroll at desktop, phone and short landscape sizes', async t => {
  const page = await pageFor(t);
  for (const [width, height] of [[1440, 1040], [390, 844], [320, 480], [390, 500], [667, 375], [568, 320]]) {
    await page.setViewportSize({ width, height }); await tab(page, '외형');
    await page.locator('.settings-scroll').evaluate(el => { el.scrollTop = 0; });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    if (screenshots) await page.screenshot({ path: screenshots + '/studio-layout-' + width + 'x' + height + '.png' });
    const before = await page.locator('.stage').boundingBox();
    assert.ok(before.x >= -1 && before.y >= -1 && before.x + before.width <= width + 1 && before.y + before.height <= height + 1, `${width}×${height} preview visible: ${JSON.stringify(before)}`);
    const metrics = await page.evaluate(() => { const s = document.querySelector('.settings-scroll'); return { pageWidth: document.documentElement.scrollWidth, pageHeight: document.documentElement.scrollHeight, client: s.clientHeight, scroll: s.scrollHeight }; });
    assert.ok(metrics.pageWidth <= width + 1 && metrics.pageHeight <= height + 1, `${width}×${height} no page overflow`);
    assert.ok(metrics.client >= 50 && metrics.scroll > metrics.client, `${width}×${height} usable independent settings scroll`);
    const visibleBounds = await page.evaluate(() => {
      const inside = (child, parent) => { const a = child.getBoundingClientRect(), b = parent.getBoundingClientRect(); return a.width > 0 && a.height > 0 && a.left >= b.left - 1 && a.right <= b.right + 1 && a.top >= b.top - 1 && a.bottom <= b.bottom + 1; };
      const stage = document.querySelector('.stage'), preview = document.querySelector('.previews'), avatar = document.getElementById('flat');
      const header = document.querySelector('.app-header'), nav = document.querySelector('.settings-nav');
      return { height: avatar.getBoundingClientRect().height, preview: inside(preview, stage), avatar: inside(avatar, preview),
        header: [...header.querySelectorAll('a,button')].every(el => inside(el, header)), tabs: [...nav.querySelectorAll('[role=tab]')].every(el => inside(el, nav)) };
    });
    assert.ok(visibleBounds.height >= 48 && visibleBounds.preview && visibleBounds.avatar && visibleBounds.header && visibleBounds.tabs, `${width}×${height} unclipped usable preview and controls: ${JSON.stringify(visibleBounds)}`);
    await page.locator('.settings-scroll').evaluate(el => { el.scrollTop = el.scrollHeight; });
    assert.deepEqual(await page.locator('.stage').boundingBox(), before);
    assert.ok(await page.locator('.settings-scroll').evaluate(el => el.scrollTop > 0));
    await equip(page, 'rightEar', 'earring'); await equip(page, 'rightEar', 'earring', false);
    assert.deepEqual(await page.locator('.stage').boundingBox(), before);
    if (screenshots && width === 390 && height === 844) await page.screenshot({ path: screenshots + '/studio-mobile.png' });
  }
});

test('Studio keyboard tabs, named slider thumbs and Select Escape retain accessible focus', async t => {
  const page = await pageFor(t);
  await page.locator('#appearance-tab').focus(); await page.locator('#appearance-tab').press('ArrowRight');
  // Radix roving focus activates a tab on its deferred focus task.
  await page.waitForFunction(() => document.getElementById('animation-tab').getAttribute('aria-selected') === 'true');
  assert.equal(await page.locator('#animation-tab').getAttribute('aria-selected'), 'true');
  assert.equal(await page.locator('#animation-panel').getAttribute('aria-labelledby'), 'animation-tab');
  assert.equal(await page.locator('#animation-tab').getAttribute('aria-controls'), 'animation-panel');
  assert.equal(await page.locator('#appearance-panel').isVisible(), false);
  assert.ok(await page.locator('#shape-duration').getAttribute('aria-labelledby'));
  await page.locator('#shape-duration').focus(); await page.locator('#shape-duration').press('ArrowRight'); assert.equal(await rangeValue(page, 'shape-duration'), 500);
  await page.locator('#shape-easing').focus(); await page.locator('#shape-easing').press('ArrowDown');
  await page.getByRole('listbox').waitFor(); await page.keyboard.press('Escape');
  await page.getByRole('listbox').waitFor({ state: 'hidden' });
  // FocusScope restores the trigger in its deferred unmount-autofocus task.
  await page.waitForFunction(() => document.activeElement === document.getElementById('shape-easing'));
  assert.equal(await page.locator('#shape-easing').evaluate(el => document.activeElement === el), true);
});

test('Studio camera degree controls, presets, API and orbit stay synchronized without changing body pose', async t => {
  const page = await pageFor(t); await page.locator('#flat').evaluate(a => { a.paused = true; a.setActivity('still'); });
  const initial = await page.locator('#flat').evaluate(a => ({ pose: a.pose, design: a.design }));
  await tab(page, '카메라'); await setRange(page, 'view-yaw', 52); await setRange(page, 'view-pitch', -23); await setRange(page, 'view-roll', 17);
  assert.deepEqual(await page.locator('#flat').evaluate(a => a.camera), { yaw: 52, pitch: -23, roll: 17 });
  assert.deepEqual(await page.locator('#flat').evaluate(a => a.pose), initial.pose); assert.deepEqual(await designOf(page), initial.design);
  await page.locator('[data-camera-preset=side]').click(); assert.equal(await rangeValue(page, 'view-yaw'), 90);
  await page.locator('#flat').evaluate(a => a.setCamera({ yaw: 21, pitch: 12, roll: 9 }));
  await page.waitForFunction(() => document.getElementById('view-yaw').getAttribute('aria-valuenow') === '21');
  const box = await page.locator('#flat').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 55, box.y + box.height / 2 + 25, { steps: 5 }); await page.mouse.up();
  const camera = await page.locator('#flat').evaluate(a => a.camera);
  assert.notEqual(camera.yaw, 21); assert.equal(camera.roll, 9); assert.ok(Math.abs(await rangeValue(page, 'view-yaw') - camera.yaw) < .001);
  assert.deepEqual(await page.locator('#flat').evaluate(a => a.pose), initial.pose);
  await page.locator('#reset-camera').click(); assert.deepEqual(await page.locator('#flat').evaluate(a => a.camera), { yaw: 0, pitch: 0, roll: 0 });
});

test('Studio saved v7 design restores all equipment, colors and independent weights on reload', async t => {
  const page = await pageFor(t); await shapeButton(page, 'puffy').click(); await setColor(page, 'body-color', '#aabbcc'); await setColor(page, 'eye-color', '#112233');
  await equip(page, 'mouth', 'moustache'); await equip(page, 'rightEar', 'earring');
  await tab(page, '애니메이션'); await setRange(page, 'left-smile-weight', .7); await setRange(page, 'right-blink-weight', .4);
  const expected = await designOf(page); await page.reload(); await page.waitForFunction(() => document.getElementById('flat')?.ready === true);
  assert.deepEqual(await designOf(page), expected); assert.equal(await selectedShape(page), 'puffy');
});

test('Studio v6 storage migrates without deleting its original and displays a migration warning', async t => {
  const old = { version: 6, body: { shape: 'heart', color: '#e5aabb' }, eyes: { color: '#223344', left: { weights: { smile: 1, blink: 0 } }, right: { weights: { smile: 0, blink: .3 } } }, accessories: [{ id: 'old-frames', preset: 'glasses', slot: 'face', color: '#334455' }] };
  const raw = JSON.stringify(old);
  const page = await pageFor(t, {}, page => page.addInitScript(raw => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('sidekick.design.v6', raw); sessionStorage.setItem('seeded', '1'); } }, raw));
  const design = await designOf(page); assert.equal(design.version, 7); assert.equal(design.accessories[0].slot, 'eyes');
  assert.deepEqual(design.eyes, old.eyes); assert.ok(await page.locator('#migration-warning').textContent());
  const saved = await page.evaluate(() => ({ old: localStorage.getItem('sidekick.design.v6'), current: JSON.parse(localStorage.getItem('sidekick.design.v7')) }));
  assert.equal(saved.old, raw); assert.deepEqual(saved.current, design);
});

test('Studio invalid stored JSON keeps raw recovery data and backs it up before first edit', async t => {
  const raw = '{ "version": 7, "broken": true }';
  const page = await pageFor(t, {}, page => page.addInitScript(raw => { localStorage.clear(); localStorage.setItem('sidekick.design.v7', raw); }, raw));
  assert.equal(await page.locator('#design-json').inputValue(), raw); assert.equal(await page.locator('#saved-design-warning').isVisible(), true);
  assert.equal(await page.evaluate(() => localStorage.getItem('sidekick.design.v7')), raw);
  const pending = page.waitForEvent('download'); await page.locator('#export-recovery-json').click(); const download = await pending;
  assert.equal(await readFile(await download.path(), 'utf8'), raw);
  await tab(page, '외형'); await setColor(page, 'body-color', '#bbccdd');
  const saved = await page.evaluate(() => ({ backup: localStorage.getItem('sidekick.design.v7.recovery'), current: JSON.parse(localStorage.getItem('sidekick.design.v7')) }));
  assert.equal(saved.backup, raw); assert.equal(saved.current.body.color, '#bbccdd');
  await tab(page, 'JSON'); assert.equal(await page.locator('#saved-design-warning').count(), 0);
});

test('Studio failed recovery backup protects the original while allowing an exportable in-memory edit', async t => {
  const raw = 'invalid original';
  const page = await pageFor(t, {}, page => page.addInitScript(raw => {
    localStorage.clear(); localStorage.setItem('sidekick.design.v7', raw);
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) { if (key.endsWith('.recovery')) throw new DOMException('Storage full', 'QuotaExceededError'); return original.call(this, key, value); };
  }, raw));
  await tab(page, '외형'); await setColor(page, 'body-color', '#bbccdd');
  assert.equal((await designOf(page)).body.color, '#bbccdd'); assert.equal(await page.evaluate(() => localStorage.getItem('sidekick.design.v7')), raw);
  assert.equal(await page.locator('#status').getAttribute('data-error'), 'true');
});
