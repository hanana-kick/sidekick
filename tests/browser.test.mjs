import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { createAppServer } from '../scripts/serve.mjs';
import { loadOfflineFixture } from './fixture.mjs';
let browser, server, baseURL;
const offline = process.env.SIDEKICK_OFFLINE_BROWSER === '1';
const screenshots = process.env.SIDEKICK_SCREENSHOTS;
before(async () => {
  server = createAppServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  baseURL = `http://127.0.0.1:${server.address().port}`;
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
  if (offline) await loadOfflineFixture(page);
  else { await page.goto(baseURL); await page.evaluate(async () => { window.fixtureAPI = await import('/src/index.js'); }); }
  await page.waitForFunction(() => [...document.querySelectorAll('sidekick-avatar')].every(a => a.ready));
  return page;
}
const setRange = (page, id, value) => page.locator(`#${id}`).evaluate((element, value) => { element.value = String(value); element.dispatchEvent(new Event('input', { bubbles: true })); }, value);

test('HTTP build serves real assets, rejects traversal, and has explicit MIME types', async () => {
  const root = await fetch(baseURL); assert.equal(root.status, 200); assert.match(await root.text(), /Sidekick Studio/);
  const script = await fetch(`${baseURL}/src/index.js`); assert.equal(script.status, 200); assert.match(script.headers.get('content-type'), /javascript/);
  assert.equal((await fetch(`${baseURL}/%2e%2e%2fpackage.json`)).status, 403);
  assert.equal((await fetch(`${baseURL}/missing`)).status, 404);
  assert.equal((await fetch(baseURL, { method: 'POST' })).status, 405);
});
test('Studio renders real WebGL avatars without browser errors; desktop screenshot', async t => {
  const page = await pageFor(t);
  assert.match(await page.title(), /Sidekick Studio/);
  assert.equal(await page.locator('h1').innerText(), '나만의 작은 동료.');
  const diagnostics = await page.evaluate(() => [...document.querySelectorAll('sidekick-avatar')].map(a => a.diagnostics));
  assert.ok(diagnostics.every(d => d.ready && d.drawCalls >= 5 && d.buffers === 12));
  if (screenshots) await page.screenshot({ path: `${screenshots}/sidekick-desktop.png`, fullPage: true });
});
test('Flat/3D share exact geometry, coverage and pose while shading differs', async t => {
  const page = await pageFor(t);
  const result = await page.evaluate(() => {
    const avatars = [...document.querySelectorAll('sidekick-avatar')];
    avatars.forEach(a => { a.style.width = '360px'; a.style.height = '360px'; a.paused = true; a.setActivity('still'); a.seek(0); });
    return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => {
      const [a, b] = avatars.map(a => a.capturePixels()); let alphaDiff = 0, shadedDiff = 0, opaque = 0;
      for (let i = 0; i < a.pixels.length; i += 4) {
        if (a.pixels[i + 3] !== b.pixels[i + 3]) alphaDiff++;
        if (a.pixels[i + 3] === 255) { opaque++; if (a.pixels[i] !== b.pixels[i]) shadedDiff++; }
      }
      resolve({ alphaDiff, shadedDiff, opaque, sameSize: a.width === b.width && a.height === b.height, corner: a.pixels[3] });
    })));
  });
  assert.equal(result.sameSize, true); assert.equal(result.alphaDiff, 0); assert.equal(result.corner, 0);
  assert.ok(result.opaque > 10000); assert.ok(result.shadedDiff > 5000);
});
test('rotating 180 degrees occludes real 3D eyes rather than billboard overlays', async t => {
  const page = await pageFor(t);
  const result = await page.evaluate(() => {
    const a = document.getElementById('flat'); a.paused = true; a.setActivity('still');
    a.design = window.fixtureAPI.createDesign();
    const ink = () => { const { pixels } = a.capturePixels(); let n = 0; for (let i = 0; i < pixels.length; i += 4) if (pixels[i] === 36 && pixels[i + 1] === 36 && pixels[i + 2] === 44 && pixels[i + 3] === 255) n++; return n; };
    a.setView(0); const front = ink(); a.setView(Math.PI); return { front, back: ink() };
  });
  assert.ok(result.front > 200); assert.equal(result.back, 0);
});
test('body, eye, accessory and background controls update both live components', async t => {
  const page = await pageFor(t);
  await page.locator('[data-shape="droplet"]').click(); await setRange(page, 'bend', 0.2);
  await page.getByRole('tab', { name: '눈', exact: true }).click(); await page.locator('[data-eyes="round"]').click(); await setRange(page, 'eye-spacing', 0.8);
  await page.getByRole('tab', { name: '액세서리', exact: true }).click(); await page.locator('[data-accessory="halo"]').check();
  await setRange(page, 'accessory-offset', 0.3); await page.locator('button[data-background="dark"]').click();
  const designs = await page.evaluate(() => [...document.querySelectorAll('sidekick-avatar')].map(a => a.design));
  assert.deepEqual(designs[0], designs[1]); assert.equal(designs[0].body.shape, 'droplet'); assert.equal(designs[0].body.bend, 0.2);
  assert.equal(designs[0].eyes.preset, 'round'); assert.equal(designs[0].accessories.find(a => a.preset === 'halo').anchor.offset, 0.3);
  assert.equal(await page.locator('.previews').getAttribute('data-background'), 'dark');
  if (screenshots) await page.screenshot({ path: `${screenshots}/sidekick-customized.png`, fullPage: true });
});
test('JSON import validates, rolls back invalid input and exports the actual design', async t => {
  const page = await pageFor(t); await page.locator('#code-panel summary').click();
  const design = await page.locator('#flat').evaluate(a => a.design); design.body.color = '#a4b8c9';
  await page.locator('#design-json').fill(JSON.stringify(design)); await page.locator('#import-json').click();
  assert.equal(await page.locator('#solid').evaluate(a => a.design.body.color), '#a4b8c9');
  await page.locator('#design-json').fill('{"version":999}'); await page.locator('#import-json').click();
  assert.ok((await page.locator('#json-error').innerText()).length > 0); assert.equal(await page.locator('#solid').evaluate(a => a.design.body.color), '#a4b8c9');
  const downloadPromise = page.waitForEvent('download'); await page.locator('#export-json').click(); const download = await downloadPromise;
  const exported = JSON.parse(await readFile(await download.path(), 'utf8')); assert.equal(exported.body.color, '#a4b8c9');
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
  assert.equal(result.reconnected.buffers, 12); assert.equal(result.reconnected.ready, true); assert.equal(result.canvases, 1);
});
test('context loss is surfaced and restoration rebuilds the renderer', async t => {
  const page = await pageFor(t);
  const supported = await page.locator('#flat').evaluate(a => { const gl = a.shadowRoot.querySelector('canvas').getContext('webgl2'); window.lossExtension = gl.getExtension('WEBGL_lose_context'); window.lossExtension?.loseContext(); return !!window.lossExtension; });
  assert.equal(supported, true); await page.waitForFunction(() => !document.getElementById('flat').ready);
  await page.waitForTimeout(100); await page.evaluate(() => window.lossExtension.restoreContext());
  await page.waitForFunction(() => document.getElementById('flat').ready);
  assert.equal(await page.locator('#flat').evaluate(a => a.diagnostics.buffers), 12);
});
test('all recipes and extreme supported accessories remain transparent at canvas borders', async t => {
  const page = await pageFor(t);
  const result = await page.locator('#flat').evaluate(a => {
    const { createDesign, createAccessory, BODY_SHAPES, ACCESSORY_PRESETS } = window.fixtureAPI;
    a.paused = true; a.setActivity('still'); const checks = [];
    for (const shape of BODY_SHAPES) for (const preset of ACCESSORY_PRESETS) {
      const accessory = createAccessory(preset); accessory.scale = 2; accessory.anchor.offset = 0.5;
      a.design = createDesign({ body: { shape, size: [0.4, 0.4, 0.4] }, accessories: [accessory] });
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
test('mobile layout has no horizontal overflow and tabs are keyboard accessible', async t => {
  const page = await pageFor(t, { viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 2 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.locator('#body-tab').focus(); await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('#eyes-tab').getAttribute('aria-selected'), 'true');
  await page.locator('[data-eyes="arc"]').click(); assert.equal(await page.locator('#solid').evaluate(a => a.design.eyes.preset), 'arc');
  if (screenshots) { await page.evaluate(() => scrollTo(0, 0)); await page.screenshot({ path: `${screenshots}/sidekick-mobile.png`, fullPage: true }); }
});
test('design persists across real-origin reloads', { skip: offline ? 'Opaque offline fixture has no localStorage origin; this case runs in HTTP mode.' : false }, async t => {
  const page = await pageFor(t); await page.locator('[data-shape="droplet"]').click(); await page.reload();
  await page.waitForFunction(() => document.getElementById('flat').ready); assert.equal(await page.locator('#flat').evaluate(a => a.design.body.shape), 'droplet');
});

test('WebGL unavailable produces a visible fallback, not a false ready state', async t => {
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } }); t.after(() => page.close());
  const disableWebGL = () => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) { return type === 'webgl2' ? null : original.call(this, type, ...args); };
  };
  if (offline) { await page.evaluate(disableWebGL); await loadOfflineFixture(page); }
  else { await page.addInitScript(disableWebGL); await page.goto(baseURL); }
  const result = await page.locator('#flat').evaluate(a => ({ ready: a.ready, running: a.diagnostics.running, text: a.shadowRoot.querySelector('[part="fallback"]').textContent, hidden: a.shadowRoot.querySelector('[part="fallback"]').hidden }));
  assert.equal(result.ready, false); assert.equal(result.running, false); assert.equal(result.hidden, false); assert.match(result.text, /WebGL2/);
});
