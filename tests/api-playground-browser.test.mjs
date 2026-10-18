import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { createAppServer } from '../scripts/serve.mjs';

let browser, server, base;
before(async () => {
  server = createAppServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
});
after(async () => { await browser?.close(); if (server) await new Promise(resolve => server.close(resolve)); });
async function pageFor(t, options = {}) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'no-preference', ...options });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  t.after(async () => { await page.close(); assert.deepEqual(errors, []); });
  await page.goto(`${base}/api-playground.html`);
  await page.waitForFunction(() => document.getElementById('bot')?.ready && document.getElementById('invocation').textContent.includes('moveTo'));
  return page;
}
async function position(page) { return page.locator('#bot').evaluate(bot => bot.position); }
async function settle(page) { await page.waitForFunction(() => document.getElementById('bot').movementState.phase === 'idle'); }
async function recordMoves(page) {
  await page.evaluate(() => {
    const bot = document.getElementById('bot');
    window.moveCalls = [];
    for (const method of ['moveTo', 'moveBy']) {
      const original = bot[method].bind(bot);
      bot[method] = (point, options) => { window.moveCalls.push({ method, point, options }); return original(point, options); };
    }
  });
}

test('stage targets the avatar center, bounds edge taps and shows copyable exact API options', async t => {
  const page = await pageFor(t, { reducedMotion: 'reduce' });
  await recordMoves(page);
  await page.locator('#duration').fill('850');
  await page.locator('#easing').selectOption('linear');
  await page.locator('#travel').selectOption('none');
  const stage = await page.locator('#movement-stage').boundingBox();
  const target = { x: stage.x + stage.width * .7, y: stage.y + stage.height * .35 };
  await page.mouse.click(target.x, target.y);
  const move = await page.evaluate(() => window.moveCalls.at(-1));
  assert.equal(move.method, 'moveTo');
  assert.deepEqual(move.options, { duration: 850, easing: 'linear', travel: 'none' });
  const actual = await position(page);
  assert.ok(Math.abs(actual.x + 90 - target.x) < 1);
  assert.ok(Math.abs(actual.y + 90 - target.y) < 1);
  const code = await page.locator('#invocation').textContent();
  assert.ok(code.includes(`avatar.moveTo({ x: ${move.point.x}, y: ${move.point.y} }, { duration: 850, easing: 'linear', travel: 'none' })`));
  await page.evaluate(() => { window.copiedCode = ''; Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async value => { window.copiedCode = value; } } }); });
  await page.locator('#copy').click();
  assert.equal(await page.evaluate(() => window.copiedCode), code);
  await page.mouse.click(stage.x + 2, stage.y + 2);
  const edge = await position(page);
  assert.ok(Math.abs(edge.x - stage.x) < 1 && Math.abs(edge.y - stage.y) < 1);
  assert.match(await page.locator('#result-log').textContent(), /moveTo result/);
});

test('movement telemetry follows phases; stop movement and stop activity remain independent', async t => {
  const page = await pageFor(t);
  await page.locator('#duration').fill('1600');
  await page.evaluate(() => {
    window.phases = [];
    document.getElementById('bot').addEventListener('sidekick-move-progress', event => window.phases.push(event.detail.phase));
  });
  // Keep the activity running long enough to make independence observable.
  await page.locator('#bot').evaluate(bot => { void bot.play('speaking', { duration: 10000 }); });
  await page.locator('[data-dx="120"]').click();
  await page.waitForFunction(() => document.getElementById('phase').textContent === 'flight');
  assert.equal(await page.locator('#activity-state').textContent(), 'speaking');
  const live = await page.locator('#bot').evaluate(bot => ({ position: bot.position, rect: { x: bot.getBoundingClientRect().x, y: bot.getBoundingClientRect().y }, movement: bot.movementState }));
  assert.ok(Math.abs(live.position.x - live.rect.x) < .1 && Math.abs(live.position.y - live.rect.y) < .1);
  assert.ok(live.movement.progress > 0 && live.movement.progress < 1);
  await page.locator('#cancel').click();
  await settle(page);
  assert.equal(await page.locator('#bot').evaluate(bot => bot.activity), 'speaking');
  assert.match(await page.locator('#result-log').textContent(), /"finished": false/);
  assert.match(await page.locator('#invocation').textContent(), /avatar.cancelMove\(\)/);
  assert.ok((await page.evaluate(() => window.phases)).includes('settling'));
  await page.locator('[data-dx="-120"]').click();
  await page.waitForFunction(() => document.getElementById('phase').textContent === 'flight');
  await page.locator('#stop').click();
  assert.equal(await page.locator('#bot').evaluate(bot => bot.activity), 'idle');
  assert.notEqual(await page.locator('#bot').evaluate(bot => bot.movementState.phase), 'idle');
  await settle(page);
  assert.equal(await page.locator('#phase').textContent(), 'idle');
  assert.ok((await page.evaluate(() => window.phases)).includes('landing'));
});

test('new stage target retargets from the live position and keeps the newest invocation', async t => {
  const page = await pageFor(t);
  await recordMoves(page);
  await page.locator('#duration').fill('1400');
  const stage = await page.locator('#movement-stage').boundingBox();
  await page.mouse.click(stage.x + stage.width - 100, stage.y + 110);
  await page.waitForFunction(() => document.getElementById('phase').textContent === 'flight');
  const before = await position(page);
  await page.mouse.click(stage.x + 110, stage.y + stage.height - 100);
  const after = await position(page);
  assert.ok(Math.hypot(after.x - before.x, after.y - before.y) < 35);
  await settle(page);
  const last = await page.evaluate(() => window.moveCalls.at(-1));
  assert.deepEqual(await position(page), last.point);
  assert.ok((await page.locator('#invocation').textContent()).includes(`x: ${last.point.x}, y: ${last.point.y}`));
  assert.match(await page.locator('#result-log').textContent(), /"finished": false/);
  assert.match(await page.locator('#result-log').textContent(), /"finished": true/);
});

test('mobile touch taps move, swipes do not, controls scroll without moving the fixed preview', async t => {
  const page = await pageFor(t, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  await recordMoves(page);
  const stage = await page.locator('#movement-stage').boundingBox();
  await page.touchscreen.tap(stage.x + stage.width - 25, stage.y + stage.height / 2);
  const tapped = await position(page);
  assert.ok(tapped.x >= stage.x && tapped.x + 180 <= stage.x + stage.width + .1);
  const calls = await page.evaluate(() => window.moveCalls.length);
  await page.locator('#movement-stage').evaluate(stage => {
    const rect = stage.getBoundingClientRect();
    const pointer = { bubbles: true, pointerId: 18, isPrimary: true, pointerType: 'touch', button: 0, clientX: rect.x + 60, clientY: rect.y + 60 };
    stage.dispatchEvent(new PointerEvent('pointerdown', pointer));
    stage.dispatchEvent(new PointerEvent('pointermove', { ...pointer, clientY: pointer.clientY + 50 }));
    stage.dispatchEvent(new PointerEvent('pointerup', { ...pointer, clientY: pointer.clientY + 50 }));
  });
  assert.equal(await page.evaluate(() => window.moveCalls.length), calls);
  await page.locator('.controls-panel').evaluate(panel => { panel.scrollTop = panel.scrollHeight; });
  assert.deepEqual(await page.locator('#movement-stage').boundingBox(), stage);
  assert.deepEqual(await position(page), tapped);
  const stop = page.locator('#cancel-preview'), stopBox = await stop.boundingBox();
  assert.ok(stopBox && stopBox.y >= 0 && stopBox.y + stopBox.height <= 844, 'Fixed preview stop remains on screen after controls scroll');
  assert.equal(await stop.evaluate(button => { const rect = button.getBoundingClientRect(); return document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2) === button; }), true, 'Fixed preview stop remains directly clickable');
  await page.locator('#bot').evaluate(bot => { const original = bot.cancelMove.bind(bot); window.cancelCalls = 0; bot.cancelMove = () => { window.cancelCalls++; original(); }; });
  await stop.click();
  assert.equal(await page.evaluate(() => window.cancelCalls), 1);
  assert.match(await page.locator('#invocation').textContent(), /avatar.cancelMove\(\)/);
  const geometry = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, panel: document.querySelector('.controls-panel').getBoundingClientRect().bottom, nav: [...document.querySelectorAll('.product-nav a')].map(a => ({ text: a.textContent, width: a.getBoundingClientRect().width })) }));
  assert.equal(geometry.scrollWidth, geometry.width);
  assert.ok(geometry.panel <= 844);
  assert.ok(geometry.nav.every(link => link.width > 0));
  if (process.env.SIDEKICK_SCREENSHOTS) { await mkdir(process.env.SIDEKICK_SCREENSHOTS, { recursive: true }); await page.screenshot({ path: `${process.env.SIDEKICK_SCREENSHOTS}/api-playground-mobile.png` }); }
});

test('keyboard targets, bounded moveBy and Studio navigation work at desktop and mobile sizes', async t => {
  const page = await pageFor(t, { reducedMotion: 'reduce' });
  await page.locator('#movement-stage').focus();
  const before = await position(page);
  await page.keyboard.press('ArrowLeft');
  const after = await position(page);
  assert.equal(after.x, before.x - 40);
  assert.match(await page.locator('#invocation').textContent(), /avatar.moveBy\(\{ x: -40, y: 0 \}/);
  await page.locator('#target-x').fill('100000');
  await page.locator('#target-y').fill('100000');
  await page.locator('#move').click();
  const stage = await page.locator('#movement-stage').boundingBox(), edge = await position(page);
  assert.ok(Math.abs(edge.x + 180 - stage.x - stage.width) < 1);
  assert.ok(Math.abs(edge.y + 180 - stage.y - stage.height) < 1);
  await page.getByRole('link', { name: 'Studio', exact: true }).click();
  await page.waitForSelector('#api-playground-link');
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    assert.equal(await page.locator('.app-header .product-nav [aria-current="page"]').textContent(), 'Studio');
    const link = await page.locator('#api-playground-link').boundingBox();
    assert.ok(link.x >= 0 && link.x + link.width <= viewport.width && link.height > 0);
  }
  await page.locator('#api-playground-link').click();
  await page.waitForSelector('#movement-stage');
  assert.equal(new URL(page.url()).pathname, '/api-playground.html');
  assert.equal(await page.locator('.product-nav [aria-current="page"]').textContent(), 'API playground');
});


test('short portrait and landscape viewports retain a complete canvas and scrollable controls', async t => {
  const page = await pageFor(t, { reducedMotion: 'reduce' });
  for (const [width, height] of [[320, 480], [390, 500], [568, 320], [667, 375], [800, 700]]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const result = await page.evaluate(() => {
      const stage = document.getElementById('movement-stage').getBoundingClientRect(), avatar = document.getElementById('bot').getBoundingClientRect(), panel = document.querySelector('.controls-panel');
      return { stage: { left: stage.left, right: stage.right, top: stage.top, bottom: stage.bottom }, avatar: { left: avatar.left, right: avatar.right, top: avatar.top, bottom: avatar.bottom }, controlHeight: panel.clientHeight, overflow: panel.scrollHeight > panel.clientHeight, pageWidth: document.documentElement.scrollWidth };
    });
    assert.ok(result.avatar.left >= result.stage.left - 1 && result.avatar.right <= result.stage.right + 1 && result.avatar.top >= result.stage.top - 1 && result.avatar.bottom <= result.stage.bottom + 1, `${width}×${height}: canvas stays in stage`);
    assert.ok(result.stage.bottom <= height && result.pageWidth <= width && result.controlHeight >= 90 && result.overflow, `${width}×${height}: controls and stage fit`);
  }
});

test('natural controls drive physical telemetry and keep a trace through controlled braking', async t => {
  const page = await pageFor(t);
  await recordMoves(page);
  await page.locator('#max-speed').fill('240'); await page.locator('#acceleration').fill('600'); await page.locator('#deceleration').fill('900');
  await page.evaluate(() => {
    window.physicalTrace = [];
    document.getElementById('bot').addEventListener('sidekick-move-progress', event => physicalTrace.push({ time: performance.now(), ...event.detail }));
  });
  const stage = await page.locator('#movement-stage').boundingBox();
  await page.mouse.click(stage.x + stage.width - 100, stage.y + 100);
  await page.waitForFunction(() => document.getElementById('bot').movementState.speed >= 150);
  const live = await page.evaluate(() => ({
    state: document.getElementById('bot').movementState,
    speed: document.getElementById('speed').textContent,
    velocity: document.getElementById('velocity').textContent,
    acceleration: document.getElementById('acceleration-vector').textContent,
    speedPlot: document.getElementById('speed-plot').getAttribute('points'),
    accelerationPlot: document.getElementById('acceleration-plot').getAttribute('points'),
    call: moveCalls.at(-1), code: document.getElementById('invocation').textContent,
  }));
  assert.deepEqual({ maxSpeed: live.call.options.maxSpeed, acceleration: live.call.options.acceleration, deceleration: live.call.options.deceleration }, { maxSpeed: 240, acceleration: 600, deceleration: 900 });
  assert.equal(live.call.options.travel, 'natural'); assert.match(live.code, /maxSpeed: 240, acceleration: 600, deceleration: 900/);
  assert.ok(live.state.speed <= 240 + 1e-6); assert.ok(Math.abs(parseFloat(live.speed) - live.state.speed) < .02);
  assert.match(live.velocity, /x .+ · y /); assert.match(live.acceleration, /x .+ · y /);
  for (const points of [live.speedPlot, live.accelerationPlot]) { assert.ok(points.split(' ').length >= 2); assert.doesNotMatch(points, /NaN|Infinity/); }
  await page.locator('#cancel').click(); await settle(page);
  const trace = await page.evaluate(() => physicalTrace);
  assert.ok(trace.some(s => s.phase === 'braking')); assert.ok(trace.some(s => s.phase === 'settling'));
  assert.equal(trace.at(-1).speed, 0); assert.deepEqual(trace.at(-1).acceleration, { x: 0, y: 0 });
  assert.match(await page.locator('#result-log').textContent(), /"finished": false/);
  if (process.env.SIDEKICK_SCREENSHOTS) {
    const { writeFile } = await import('node:fs/promises'); await mkdir(process.env.SIDEKICK_SCREENSHOTS, { recursive: true });
    await page.locator('#motion-graph').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${process.env.SIDEKICK_SCREENSHOTS}/api-inertial-telemetry.png` });
    await writeFile(`${process.env.SIDEKICK_SCREENSHOTS}/api-inertial-telemetry-trace.json`, JSON.stringify(trace, null, 2));
  }
});

test('shared custom-element brand stays identical across pages and compact viewports', async t => {
  const page = await pageFor(t);
  const directory = process.env.SIDEKICK_SCREENSHOTS;
  if (directory) await mkdir(directory, { recursive: true });
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 480 }]) {
    await page.setViewportSize(viewport);
    let reference;
    for (const route of ['api-playground.html', '']) {
      await page.goto(`${base}/${route}`);
      await page.waitForFunction(() => document.querySelector('.brand-avatar')?.ready);
      await page.evaluate(() => document.fonts.ready);
      // A no-op resize may advance the command revision without emitting a frame.
      // Capture explicitly synchronizes the renderer; then count actual draws.
      await page.locator('.brand-avatar').evaluate(a => a.capturePixelsAsync());
      await page.waitForFunction(() => document.querySelector('.brand-avatar').diagnostics.frames > 0);
      const frames = await page.locator('.brand-avatar').evaluate(a => a.diagnostics.frames);
      await page.waitForTimeout(200);
      assert.equal(await page.locator('.brand-avatar').evaluate(a => a.diagnostics.frames), frames, 'Paused header does not keep drawing');
      const brand = await page.locator('.brand').evaluate(link => {
        const avatar = link.querySelector('sidekick-avatar');
        const text = getComputedStyle(link), box = link.getBoundingClientRect();
        return { font: text.fontFamily, size: text.fontSize, weight: text.fontWeight, text: link.textContent,
          width: box.width, height: box.height, paused: avatar.paused, tracking: avatar.trackingMode,
          canvasWidth: avatar.getBoundingClientRect().width, shape: avatar.design.body.shape };
      });
      assert.ok(brand.paused); assert.equal(brand.tracking, 'off'); assert.equal(brand.shape, 'ghostish');
      assert.ok(brand.canvasWidth <= 44);
      if (reference) assert.deepEqual(brand, reference); else reference = brand;
      const layout = await page.evaluate(() => {
        const header = document.querySelector('.app-header').getBoundingClientRect();
        const preview = document.querySelector('.preview-panel, .previews').getBoundingClientRect();
        return { overflow: document.documentElement.scrollWidth > innerWidth,
          headerBottom: header.bottom, previewTop: preview.top, previewHeight: preview.height,
          links: [...document.querySelectorAll('.app-header a')].map(a => { const r = a.getBoundingClientRect(); return [r.left, r.right, r.width, r.height]; }) };
      });
      assert.equal(layout.overflow, false);
      assert.ok(layout.previewTop >= layout.headerBottom - 1);
      assert.ok(layout.previewHeight > 60, JSON.stringify(layout));
      for (const [left, right, width, height] of layout.links) assert.ok(left >= 0 && right <= viewport.width + 1 && width > 0 && height > 0);
      if (directory) await page.screenshot({ path: `${directory}/shared-header-${route ? 'api' : 'studio'}-${viewport.width}x${viewport.height}.png` });
    }
  }
});
