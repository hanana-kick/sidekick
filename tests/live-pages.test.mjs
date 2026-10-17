import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

// Run only as an explicit post-deployment check, never in the offline test suite.
// A redirect to an old custom domain must not satisfy the user's GitHub URL.
const target = 'https://hanana-kick.github.io/sidekick/';

test('the published GitHub Pages URL renders and serves every Studio asset', { timeout: 120000 }, async t => {
  assert.equal(process.env.SIDEKICK_LIVE_URL ?? target, target, 'The live smoke is restricted to the approved public GitHub Pages URL');
  const screenshots = process.env.SIDEKICK_SCREENSHOTS;
  if (screenshots) await mkdir(screenshots, { recursive: true });
  const executablePath = process.env.CHROMIUM_PATH ?? (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
  const browser = await chromium.launch({ executablePath, headless: process.env.SIDEKICK_HEADED !== '1', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1440, height: 1040 }, reducedMotion: 'reduce' });
  const errors = [], failures = [], requests = [], responses = [];
  page.on('pageerror', error => errors.push(error.stack ?? error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => requests.push({ url: request.url(), type: request.resourceType() }));
  page.on('requestfailed', request => failures.push({ url: request.url(), error: request.failure()?.errorText }));
  page.on('response', response => {
    responses.push({ url: response.url(), status: response.status(), type: response.request().resourceType(), contentType: response.headers()['content-type'] ?? '' });
    if (response.status() >= 400) failures.push({ url: response.url(), status: response.status() });
  });
  try {
    const response = await page.goto(target, { waitUntil: 'load', timeout: 30000 });
    assert.equal(response?.status(), 200); assert.equal(page.url(), target, 'The requested GitHub URL must not redirect to the old custom domain');
    assert.match(await page.title(), /Sidekick Studio/);
    await page.waitForFunction(() => document.getElementById('flat')?.ready === true, undefined, { timeout: 20000 });
    assert.ok((await page.locator('body').innerText()).trim().length > 100, 'Studio is not blank');
    await page.locator('[data-shape="puffy"]').click();
    await page.locator('[data-equipment="eyes"][data-accessory="glasses"]').click();
    await page.waitForFunction(() => {
      const avatar = document.getElementById('flat');
      return avatar?.ready === true && avatar.design.body.shape === 'puffy' && avatar.design.accessories.some(item => item.preset === 'glasses');
    });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const rendered = await page.locator('#flat').evaluate(element => {
      const { pixels } = element.capturePixels();
      return { ready: element.ready, shape: element.design.body.shape, glasses: element.design.accessories.some(item => item.preset === 'glasses'),
        visible: pixels.some((value, index) => index % 4 === 3 && value === 255), transparent: pixels[3] === 0 };
    });
    assert.deepEqual(rendered, { ready: true, shape: 'puffy', glasses: true, visible: true, transparent: true });
    const assets = await page.evaluate(async () => {
      const tiles = [...document.querySelectorAll('[data-equipment][data-accessory]')];
      const images = tiles.map(tile => tile.querySelector('img'));
      if (images.some(image => !image)) throw new Error('Equipment preview is missing');
      for (const image of images) image.loading = 'eager';
      await Promise.all(images.map(image => image.decode()));
      await document.fonts.load('16px "Geist Variable"'); await document.fonts.ready;
      const icon = document.querySelector('link[rel~="icon"]');
      if (!icon) throw new Error('An explicit favicon is required');
      const iconImage = new Image(); iconImage.src = icon.href; await iconImage.decode();
      const modules = [...document.querySelectorAll('script[type="module"][src]')].map(script => script.src);
      const styles = [...document.querySelectorAll('link[rel="stylesheet"]')].map(link => ({ url: link.href, rules: link.sheet?.cssRules.length ?? 0 }));
      const urls = [...modules, ...styles.map(style => style.url), icon.href];
      // Explicit GETs also verify the favicon on browsers that do not expose its
      // automatic request and ensure entry assets are real 200 responses.
      const statuses = await Promise.all(urls.map(async url => ({ url, status: (await fetch(url)).status })));
      return { modules, styles, statuses, favicon: { url: icon.href, width: iconImage.naturalWidth },
        images: tiles.map((tile, index) => ({ preset: tile.dataset.accessory, url: images[index].src, width: images[index].naturalWidth })),
        fonts: [...document.fonts].filter(font => font.status === 'loaded').map(font => font.family), home: document.querySelector('.brand').href };
    });
    assert.ok(assets.modules.length > 0); assert.ok(assets.styles.length > 0 && assets.styles.every(style => style.rules > 0));
    assert.ok(assets.fonts.some(font => font.includes('Geist')), 'The bundled Geist font loaded');
    assert.ok(assets.favicon.width > 0); assert.equal(assets.favicon.url, new URL('favicon.svg', target).href); assert.equal(assets.home, target);
    const expected = ['beret', 'halo', 'crown', 'glasses', 'sunglasses', 'moustache', 'goatee', 'bowTie', 'scarf', 'necklace', 'earring', 'starEarring'];
    assert.deepEqual([...new Set(assets.images.map(image => image.preset))].sort(), expected.sort());
    for (const image of assets.images) { assert.ok(image.width >= 72); assert.equal(image.url, new URL(`accessory-previews/${image.preset}.png`, target).href); }
    for (const asset of assets.statuses) assert.equal(asset.status, 200, asset.url);
    await page.waitForLoadState('networkidle');
    assert.deepEqual(errors, [], 'No browser or console errors'); assert.deepEqual(failures, [], 'No failed resources');
    for (const request of requests.filter(request => !/^(?:data|blob):/.test(request.url))) {
      const url = new URL(request.url); assert.equal(url.origin, new URL(target).origin, request.url);
      assert.ok(url.pathname.startsWith('/sidekick/'), `Resource escaped the project URL: ${request.url}`);
    }
    assert.ok(responses.some(response => response.type === 'font' && response.status === 200 && /font\/woff2|application\/octet-stream/.test(response.contentType)), 'A bundled font received HTTP 200');
    for (const image of assets.images) assert.ok(responses.some(response => response.url === image.url && response.status === 200), `Preview did not receive HTTP 200: ${image.url}`);
    t.diagnostic(`Verified ${page.url()} with ${assets.images.length} decoded preview tiles and ${responses.length} successful resource responses.`);
    if (screenshots) await page.screenshot({ path: `${screenshots}/live-pages-success.png` });
  } catch (error) {
    t.diagnostic(JSON.stringify({ url: page.url(), errors, failures, requests, responses }, null, 2));
    if (screenshots) await page.screenshot({ path: `${screenshots}/live-pages-failure.png`, timeout: 5000 }).catch(() => {});
    throw error;
  }
});
