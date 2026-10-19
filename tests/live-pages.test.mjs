import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

// Run only as an explicit post-deployment check, never in the offline test suite.
// Both entry points must settle at the user's approved custom-domain root.
const customHTTP = 'http://sidekick.hananakick.cc/';
const customHTTPS = 'https://sidekick.hananakick.cc/';
const githubEntry = 'https://hanana-kick.github.io/sidekick/';
const target = process.env.SIDEKICK_LIVE_URL ?? customHTTP;

for (const [name, entry] of [['custom-http', customHTTP], ['custom-https', customHTTPS], ['github-project', githubEntry]]) {
  test(`the published ${name} entry renders at the approved custom domain with every Studio asset`, { timeout: 120000 }, async t => {
    assert.ok([customHTTP, customHTTPS].includes(target), 'SIDEKICK_LIVE_URL must be an approved custom-domain root');
    const screenshots = process.env.SIDEKICK_SCREENSHOTS;
    if (screenshots) await mkdir(screenshots, { recursive: true });
    const executablePath = process.env.CHROMIUM_PATH ?? (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
    const browser = await chromium.launch({ executablePath, headless: process.env.SIDEKICK_HEADED !== '1', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
    t.after(() => browser.close());
    const page = await browser.newPage({ locale: 'ko-KR', viewport: { width: 1440, height: 1040 }, reducedMotion: 'reduce' });
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
      const response = await page.goto(entry, { waitUntil: 'load', timeout: 30000 });
      assert.equal(response?.status(), 200);
      const canonical = page.url();
      assert.ok([customHTTP, customHTTPS].includes(canonical), `Unexpected final origin or path: ${canonical}`);
      if (entry === customHTTPS) assert.equal(canonical, customHTTPS, 'The HTTPS entry must not downgrade to HTTP');
      assert.equal(await page.title(), 'Sidekick · 스튜디오');
      assert.equal(await page.locator('html').getAttribute('lang'), 'ko');
      await page.waitForFunction(() => document.getElementById('flat')?.ready === true, undefined, { timeout: 20000 });
      assert.ok((await page.locator('body').innerText()).trim().length > 100, 'Studio is not blank');
      await page.locator('[data-shape="puffy"]').click();
      await page.locator('[data-equipment="eyes"][data-accessory="glasses"]').click();
      await page.waitForFunction(() => {
        const avatar = document.getElementById('flat');
        return avatar?.ready === true && avatar.design.body.shape === 'puffy' && avatar.design.accessories.some(item => item.preset === 'glasses');
      });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const rendered = await page.locator('#flat').evaluate(async element => {
        const { pixels } = (await element.capturePixelsAsync());
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
      assert.ok(assets.favicon.width > 0); assert.equal(assets.favicon.url, new URL('favicon.svg', canonical).href); assert.equal(assets.home, `${canonical}?lang=ko&framework=element`);
      const expected = ['beret', 'halo', 'crown', 'glasses', 'sunglasses', 'moustache', 'goatee', 'bowTie', 'scarf', 'necklace', 'earring', 'starEarring'];
      assert.deepEqual([...new Set(assets.images.map(image => image.preset))].sort(), expected.sort());
      for (const image of assets.images) { assert.ok(image.width >= 72); assert.equal(image.url, new URL(`accessory-previews/${image.preset}.png`, canonical).href); }
      for (const asset of assets.statuses) assert.equal(asset.status, 200, asset.url);
      // Social crawlers must receive static metadata and an actual full-size PNG.
      const social = await page.evaluate(async () => {
        const content = selector => document.querySelector(selector)?.getAttribute('content');
        const imageURL = content('meta[property="og:image"]');
        if (!imageURL) throw new Error('Missing static OG image metadata');
        const image = new Image(); image.src = imageURL; await image.decode();
        const response = await fetch(imageURL);
        return { url: content('meta[property="og:url"]'), title: content('meta[property="og:title"]'),
          imageURL, width: image.naturalWidth, height: image.naturalHeight, status: response.status,
          type: response.headers.get('content-type'), declaredWidth: content('meta[property="og:image:width"]'),
          declaredHeight: content('meta[property="og:image:height"]'), twitter: content('meta[name="twitter:card"]'),
          twitterImage: content('meta[name="twitter:image"]') };
      });
      assert.equal(social.url, customHTTPS); assert.match(social.title ?? '', /Sidekick/);
      assert.equal(social.imageURL, new URL('og-sidekick.png?v=d9188df94ec2', customHTTPS).href);
      assert.equal(social.twitterImage, social.imageURL); assert.equal(social.twitter, 'summary_large_image');
      assert.equal(social.status, 200); assert.match(social.type ?? '', /image\/png/);
      assert.equal(social.width, 1200); assert.equal(social.height, 630);
      assert.equal(social.declaredWidth, '1200'); assert.equal(social.declaredHeight, '630');
      // Lightweight scene smoke test on every entry, without allocating export renderers.
      await page.locator('#scene-tab').click();
      assert.equal(await page.locator('#scene-panel').isVisible(), true);
      assert.equal(await page.locator('#scene-og-preset').isVisible(), true);
      assert.equal(await page.locator('#scene-text').inputValue(), 'Sidekick');
      assert.equal(await page.locator('#scene-width').inputValue(), '1200');
      assert.equal(await page.locator('#scene-height').inputValue(), '630');
      assert.equal(await page.locator('#export-composition-png').isVisible(), true);
      await page.waitForFunction(() => {
        const canvas = document.querySelector('.composition-preview canvas');
        return canvas?.width === 1200 && canvas?.height === 630 && document.querySelector('.composition-status')?.textContent.includes('정지 프레임');
      }, undefined, { timeout: 20000 });
      assert.equal(await page.locator('sidekick-avatar:not(.brand-avatar)').count(), 1, 'Scene preview reuses the mounted renderer');
      await page.waitForLoadState('networkidle');
      assert.deepEqual(errors, [], 'No browser or console errors'); assert.deepEqual(failures, [], 'No failed resources');
      for (const request of requests.filter(request => !/^(?:data|blob):/.test(request.url))) {
        if (request.type === 'document') {
          const allowed = entry === customHTTPS ? [customHTTPS] : [entry, customHTTP, customHTTPS];
          assert.ok(allowed.includes(request.url), `Unexpected navigation redirect or HTTPS downgrade: ${request.url}`);
        } else {
          const url = new URL(request.url);
          assert.equal(url.origin, new URL(canonical).origin, `Resource escaped the verified canonical origin: ${request.url}`);
          assert.ok(!url.pathname.startsWith('/sidekick/'), `Project-prefixed asset on the custom domain: ${request.url}`);
        }
      }
      for (const url of [...assets.modules, ...assets.styles.map(style => style.url)]) assert.ok(url.startsWith(new URL('assets/', canonical).href), `Entry asset escaped the canonical asset directory: ${url}`);
      assert.ok(responses.some(response => response.type === 'font' && response.status === 200 && /font\/woff2|application\/octet-stream/.test(response.contentType)), 'A bundled font received HTTP 200');
      for (const image of assets.images) assert.ok(responses.some(response => response.url === image.url && response.status === 200), `Preview did not receive HTTP 200: ${image.url}`);
      t.diagnostic(`Verified ${entry} → ${page.url()} with ${assets.images.length} decoded preview tiles, 1200×630 OG image, scene editor and ${responses.length} successful resource responses.`);
      if (screenshots) await page.screenshot({ path: `${screenshots}/live-pages-${name}-success.png` });
      // Follow the actual visible navigation and verify the newly published runtime.
      await page.locator('#api-playground-link').click();
      assert.equal(page.url(), new URL('api-playground.html?lang=ko&framework=element', canonical).href);
      // Renderer readiness precedes asynchronous Studio session restoration.
      // Wait until the page has applied its initial position before testing flight.
      await page.waitForFunction(() => document.getElementById('bot')?.ready === true && document.getElementById('bot').hasAttribute('data-configured'));
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      const flight = await page.evaluate(async () => {
        const bot = document.getElementById('bot');
        const before = bot.position;
        const result = await bot.moveBy({x: -30, y: 20}, {duration: 400, travel: 'natural'});
        return {before, result, state: bot.movementState, travel: bot.diagnostics.travel};
      });
      assert.equal(flight.result.finished, true);
      assert.equal(flight.state.phase, 'idle');
      assert.equal(flight.travel.strength, 0);
      assert.equal(await page.locator('#cancel-preview').isVisible(), true);
      assert.deepEqual(errors, [], 'Published API playground has no browser errors');
      assert.deepEqual(failures, [], 'Published API playground loads all resources');
      if (screenshots) await page.screenshot({ path: `${screenshots}/live-api-${name}-success.png` });

    } catch (error) {
      t.diagnostic(JSON.stringify({ url: page.url(), errors, failures, requests, responses }, null, 2));
      if (screenshots) await page.screenshot({ path: `${screenshots}/live-pages-${name}-failure.png`, timeout: 5000 }).catch(() => {});
      throw error;
    }
  });
}
