import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { createAppServer } from '../scripts/serve.mjs';
let browser, server, base;
before(async () => {
  server = createAppServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), headless: process.env.SIDEKICK_HEADED !== '1', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
});
after(async () => { await browser?.close(); if (server) await new Promise(resolve => server.close(resolve)); });
async function pageFor(t, options = {}) {
  const page = await browser.newPage({ viewport: { width: 900, height: 800 }, ...options });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  t.after(async () => { await page.close(); assert.deepEqual(errors, []); });
  await page.goto(`${base}/api-playground.html`); await page.waitForFunction(() => document.getElementById('bot')?.ready);
  if (process.env.SIDEKICK_SCREENSHOTS) { await mkdir(process.env.SIDEKICK_SCREENSHOTS, { recursive: true }); await page.screenshot({ path: `${process.env.SIDEKICK_SCREENSHOTS}/movement-playground.png` }); }
  return page;
}
for (const reducedMotion of ['no-preference', 'reduce']) test(`bounded canvas movement and interrupt semantics (${reducedMotion})`, async t => {
  const page = await pageFor(t, { reducedMotion });
  const result = await page.evaluate(async reduced => {
    const bot = document.getElementById('bot'), canvas = bot.shadowRoot.querySelector('canvas');
    const initial = await bot.capturePixelsAsync(); const generation = bot.diagnostics.generation;
    const events = []; bot.addEventListener('sidekick-move-end', event => events.push(event.detail));
    const first = bot.moveTo({ x: 500, y: 400 }, { duration: 500 });
    await new Promise(resolve => setTimeout(resolve, 70));
    const current = bot.position;
    const second = bot.moveTo({ x: 200, y: 300 }, { duration: 100 });
    const firstResult = await first, secondResult = await second;
    const final = await bot.capturePixelsAsync(); const rect = bot.getBoundingClientRect();
    return { firstResult, secondResult, current, events, rect: { x: rect.x, y: rect.y }, size: [initial.width, initial.height, final.width, final.height], generation: [generation, bot.diagnostics.generation], sameCanvas: canvas === bot.shadowRoot.querySelector('canvas'), bodyOrientation: bot.bodyOrientation, zoom: bot.zoom, color: bot.design.body.color, reduced };
  }, reducedMotion === 'reduce');
  assert.equal(result.firstResult.finished, reducedMotion === 'reduce'); assert.equal(result.secondResult.finished, true);
  assert.deepEqual(result.rect, { x: 200, y: 300 }); assert.deepEqual(result.size.slice(0, 2), result.size.slice(2)); assert.equal(result.sameCanvas, true); assert.equal(result.generation[0], result.generation[1]);
  assert.equal(result.events.length, 2); assert.equal(result.color, '#ffcc37');
});

test('viewport resize clamps, scrolling keeps fixed coordinates, pointer passes through', async t => {
  const page = await pageFor(t, { reducedMotion: 'reduce' });
  await page.evaluate(async () => { const bot = document.getElementById('bot'); await bot.moveTo({ x: 10000, y: 10000 }); });
  await page.setViewportSize({ width: 390, height: 700 });
  await page.waitForFunction(() => document.getElementById('bot').position.x <= 210);
  const result = await page.evaluate(async () => {
    const bot = document.getElementById('bot'); await bot.moveTo({ x: 10, y: 100 }); window.scrollTo(0, 200);
    const rect = bot.getBoundingClientRect(), target = document.elementFromPoint(30, 120);
    bot.interaction = 'box'; const interactiveTarget = document.elementFromPoint(30, 120);
    return { rect: { x: rect.x, y: rect.y }, passThrough: target !== bot, boxTarget: interactiveTarget === bot, width: bot.offsetWidth };
  });
  assert.deepEqual(result.rect, { x: 10, y: 100 }); assert.equal(result.passThrough, true); assert.equal(result.boxTarget, true); assert.equal(result.width, 180);
});

test('actual worker asset swap, pause, play/stop and disconnection settle commands', async t => {
  const page = await pageFor(t);
  const result = await page.evaluate(async () => {
    const bot = document.getElementById('bot');
    const { createAccessory } = await import('./browser/sidekick.js');
    const transition = await bot.transitionTo({ shape: 'heart', expression: 'smile', accessories: [createAccessory('halo')] }, { duration: 120 });
    const design = bot.design; const pixels = await bot.capturePixelsAsync();
    const loop = bot.play('speaking'); bot.stop(); const cancelledLoop = await loop;
    bot.paused = true; const immediate = await bot.moveTo({ x: 40, y: 50 }, { duration: 5000 }); bot.paused = false;
    const move = bot.moveBy({ x: 200, y: 0 }, { duration: 5000 });
    const transitioning = bot.transitionTo({ shape: 'circle', accessories: [createAccessory('beret')] }, { duration: 5000 });
    bot.remove(); const disconnected = await Promise.all([move, transitioning]);
    return { transition, design, pixels: [pixels.width, pixels.height], cancelledLoop, immediate, disconnected, animations: bot.shadowRoot.querySelector('canvas').getAnimations().length };
  });
  assert.equal(result.transition.finished, true); assert.equal(result.design.body.shape, 'heart'); assert.equal(result.design.eyes.left.weights.smile, 1); assert.equal(result.design.accessories[0].preset, 'halo');
  assert.equal(result.cancelledLoop.finished, false); assert.deepEqual(result.immediate.position, { x: 40, y: 50 }); assert.ok(result.disconnected.every(value => value.finished === false)); assert.equal(result.animations, 0);
});
