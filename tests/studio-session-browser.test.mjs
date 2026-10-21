import { apiDemoFrame } from './helpers/api-demo-frame.mjs';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { createAppServer } from '../scripts/serve.mjs';
let browser, server, base;
before(async () => {
  server = createAppServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
});
after(async () => { await browser?.close(); if (server) await new Promise(resolve => server.close(resolve)); });
async function open(t) {
  const page = await browser.newPage({ locale: 'ko-KR', viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  t.after(async () => { await page.close(); assert.deepEqual(errors, []); });
  await page.goto(base); await page.waitForFunction(() => document.getElementById('flat')?.ready);
  return page;
}
const key = 'sidekick.studio.scene.v3';
test('Studio JSON and subsequent edit reach Playground with complete scene; temporary commands do not write back', async t => {
  const page = await open(t);
  await page.locator('#json-tab').click();
  const scene = JSON.parse(await page.locator('#design-json').inputValue());
  scene.design.body.shape = 'heart'; scene.design.body.color = '#123456'; scene.design.eyes.color = '#234567';
  scene.design.eyes.left.weights = { smile: .8, blink: .1 }; scene.design.eyes.right.weights = { smile: .2, blink: .3 };
  scene.design.accessories[0].color = '#345678';
  scene.bodyOrientation = { yaw: 31, pitch: 12, roll: -8 }; scene.zoom = 1.7; scene.activity = 'thinking'; scene.trackingMode = 'off'; scene.paused = true;
  await page.locator('#design-json').fill(JSON.stringify(scene)); await page.locator('#import-json').click();
  await page.locator('#appearance-tab').click();
  await page.locator('#body-color').evaluate(input => { input.value = '#abcdef'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  const stored = await page.evaluate(key => localStorage.getItem(key), key);
  assert.equal(JSON.parse(stored).design.body.color, '#abcdef');
  await page.locator('#api-playground-link').click();
  await apiDemoFrame(page);
  await page.waitForFunction(() => document.getElementById('status').textContent.includes('준비되었습니다'));
  const actual = await page.frameLocator('#site-preview-frame').locator('#bot').evaluate(bot => ({ design: bot.design, bodyOrientation: bot.bodyOrientation, zoom: bot.zoom, activity: bot.activity, trackingMode: bot.trackingMode, paused: bot.paused }));
  const expected = JSON.parse(stored);
  assert.deepEqual(actual.design, expected.design); assert.deepEqual(actual.bodyOrientation, expected.bodyOrientation);
  assert.equal(actual.activity, expected.activity); assert.equal(actual.zoom, expected.zoom); assert.equal(actual.trackingMode, expected.trackingMode); assert.equal(actual.paused, expected.paused);
  await page.locator('#bot-tools-launcher').click();
  await page.locator('#action-kind').selectOption('expression'); await page.locator('#execute').click();
  assert.equal(await page.evaluate(key => localStorage.getItem(key), key), stored);
  await page.reload(); await apiDemoFrame(page); await page.waitForFunction(() => document.getElementById('status').textContent.includes('준비되었습니다'));
  assert.deepEqual(await page.frameLocator('#site-preview-frame').locator('#bot').evaluate(bot => bot.design), expected.design);
  await page.locator('.product-nav a').first().click(); await page.waitForFunction(() => document.getElementById('flat')?.ready);
  assert.deepEqual(await page.locator('#flat').evaluate(bot => bot.bodyOrientation), expected.bodyOrientation);
});

test('shared original avatar, header dimensions and menu typography match at desktop and mobile sizes', async t => {
  const page = await open(t);
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 480 }]) {
    await page.setViewportSize(viewport);
    const snapshots = [];
    for (const route of ['', '/api-playground.html']) {
      await page.goto(base + route);
      if (route) await apiDemoFrame(page);
      await page.waitForFunction(() => document.querySelector('.brand-avatar')?.ready);
      assert.equal(await page.locator('.brand-avatar').evaluate(brand => brand.tagName), 'SIDEKICK-AVATAR');
      await page.evaluate(() => document.fonts.ready);
      snapshots.push(await page.evaluate(() => ['.app-header', '.brand', '.brand-avatar', '.product-nav', '.product-nav a', '.product-nav a:last-child'].map(selector => {
        const el = document.querySelector(selector), rect = el.getBoundingClientRect(), style = getComputedStyle(el);
        if (selector === '.brand-avatar') return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, font: style.fontFamily, fontSize: style.fontSize, lineHeight: style.lineHeight, weight: style.fontWeight, padding: style.padding, gap: style.gap };
      })));
    }
    assert.deepEqual(snapshots[0], snapshots[1], `${viewport.width}px identical shared menu`);
  }
});

test('invalid Studio scene is preserved and explained in Playground', async t => {
  const page = await open(t), raw = '{"sceneVersion":2,"camera":{"yaw":45}}';
  await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), { key, raw });
  await page.goto(`${base}/api-playground.html`); await apiDemoFrame(page);
  assert.match(await page.locator('#studio-session-status').textContent(), /원본은 보존/);
  assert.equal(await page.evaluate(key => localStorage.getItem(key), key), raw);
});
