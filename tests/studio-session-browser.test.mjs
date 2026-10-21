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
test('Studio transfers only edited design to Playground while retaining its own complete preview', async t => {
  const page = await open(t);
  await page.locator('#json-tab').click();
  const scene = JSON.parse(await page.locator('#design-json').inputValue());
  scene.design.body.shape = 'heart'; scene.design.body.color = '#123456'; scene.design.eyes.color = '#234567';
  scene.design.eyes.left.weights = { smile: .8, blink: .1 }; scene.design.eyes.right.weights = { smile: .2, blink: .3 };
  scene.design.accessories[0].color = '#345678';
  scene.bodyOrientation = { yaw: 31, pitch: 12, roll: -8 }; scene.zoom = 3; scene.activity = 'thinking'; scene.trackingMode = 'off'; scene.paused = true;
  await page.locator('#design-json').fill(JSON.stringify(scene)); await page.locator('#import-json').click();
  await page.locator('#appearance-tab').click();
  await page.locator('#body-color').evaluate(input => { input.value = '#abcdef'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  const stored = await page.evaluate(key => localStorage.getItem(key), key);
  assert.equal(JSON.parse(stored).design.body.color, '#abcdef');
  await page.locator('#api-playground-link').click();
  await apiDemoFrame(page);
  await page.waitForFunction(() => document.getElementById('status').textContent.includes('준비되었습니다'));
  const actual = await page.frameLocator('#site-preview-frame').locator('#bot').evaluate(bot => ({ design: bot.design, size: bot.size, width: bot.getBoundingClientRect().width, height: bot.getBoundingClientRect().height, bodyOrientation: bot.bodyOrientation, zoom: bot.zoom, activity: bot.activity, trackingMode: bot.trackingMode, paused: bot.paused }));
  const expected = JSON.parse(stored);
  assert.deepEqual(actual.design, expected.design); assert.deepEqual(actual.bodyOrientation, { yaw: 0, pitch: 0, roll: 0 });
  assert.equal(actual.size, 115); assert.equal(actual.width, 115); assert.equal(actual.height, 115); assert.equal(actual.activity, 'idle'); assert.equal(actual.zoom, 1); assert.equal(actual.trackingMode, 'eyes-and-body'); assert.equal(actual.paused, false);
  await page.locator('#bot-tools-launcher').click();
  await page.locator('#action-kind').selectOption('expression'); await page.locator('#execute').click();
  assert.equal(await page.evaluate(key => localStorage.getItem(key), key), stored);
  await page.reload(); await apiDemoFrame(page); await page.waitForFunction(() => document.getElementById('status').textContent.includes('준비되었습니다'));
  assert.deepEqual(await page.frameLocator('#site-preview-frame').locator('#bot').evaluate(bot => bot.design), expected.design);
  await page.locator('.product-nav a').first().click(); await page.waitForFunction(() => document.getElementById('flat')?.ready);
  assert.deepEqual(await page.locator('#flat').evaluate(bot => bot.bodyOrientation), expected.bodyOrientation);
  assert.equal(await page.locator('#flat').evaluate(bot => bot.zoom), 3);
  assert.equal(await page.locator('#flat').evaluate(bot => bot.paused), true);
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


test('Guide defaults and explicit context stay independent of Studio preview, across reload and locale changes', async t => {
  const page = await open(t);
  async function guideSnapshot(query = '?lang=en') {
    await page.goto(`${base}/guide.html${query}#state-facing`);
    await page.waitForSelector('[data-state-reference][data-configured]');
    const frame = page.frames().find(frame => frame.url().includes('/state-preview.html'));
    assert.ok(frame);
    return frame.locator('#reference-bot').evaluate(bot => ({ design: bot.design, size: bot.size, zoom: bot.zoom, bodyOrientation: bot.bodyOrientation, activity: bot.activity, paused: bot.paused, trackingMode: bot.trackingMode }));
  }
  const baseline = await guideSnapshot();
  await page.goto(base); await page.waitForFunction(() => document.getElementById('flat')?.ready);
  await page.locator('#json-tab').click();
  const scene = JSON.parse(await page.locator('#design-json').inputValue());
  scene.design.body.shape = 'heart'; scene.design.body.color = '#123456';
  scene.zoom = 3; scene.bodyOrientation = { yaw: 170, pitch: 80, roll: 120 };
  scene.activity = 'thinking'; scene.trackingMode = 'off'; scene.paused = true;
  scene.gaze = { x: 1, y: -1 }; scene.time = 43200; scene.motion = { face: { uv: [.4, -.4] } };
  await page.locator('#design-json').fill(JSON.stringify(scene)); await page.locator('#import-json').click();
  const stored = await page.evaluate(key => localStorage.getItem(key), key);
  for (const query of ['?lang=en', '?lang=ko', '?lang=en']) {
    const actual = await guideSnapshot(query);
    assert.deepEqual(actual, { ...baseline, design: scene.design });
    assert.equal(await page.evaluate(key => localStorage.getItem(key), key), stored);
  }
  const state = encodeURIComponent(JSON.stringify({ id: 'state-facing', values: { size: 160, zoom: .75, 'body-yaw': 22, 'tracking-mode': 'eyes' } }));
  const own = await guideSnapshot(`?lang=en&state=${state}`);
  assert.equal(own.size, 160); assert.equal(own.zoom, .75); assert.equal(own.bodyOrientation.yaw, 22); assert.equal(own.trackingMode, 'eyes');
  assert.deepEqual(own.design, scene.design);
  assert.deepEqual(await guideSnapshot(`?lang=ko&state=${state}`), own);
  assert.equal(await page.evaluate(key => localStorage.getItem(key), key), stored);
});
