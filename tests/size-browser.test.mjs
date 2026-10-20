import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { createAppServer } from '../scripts/serve.mjs';
let browser, server, origin;
const forceCanvas = process.env.SIDEKICK_FORCE_CANVAS2D === '1';
before(async () => {
  server = createAppServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', ...(forceCanvas ? ['--disable-webgl'] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])] });
});
after(async () => { await browser?.close(); if (server) await new Promise(resolve => server.close(resolve)); });
for (const backend of ['main', 'worker']) for (const dpr of [1, 2]) test(`size controls real host/canvas at DPR ${dpr} (${backend}), then restores live CSS`, async t => {
  const page = await browser.newPage({ deviceScaleFactor: dpr, reducedMotion: 'reduce' }); t.after(() => page.close());
  if (backend === 'main') await page.addInitScript(() => { window.Worker = undefined; });
  await page.route('**/size-fixture.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><body></body>' }));
  await page.goto(`${origin}/size-fixture.html`);
  await page.evaluate(async () => {
    document.body.innerHTML = '<style>sidekick-avatar {width:300px!important;height:180px!important;min-width:250px;max-height:80px}</style><sidekick-avatar id="sized" size="120" tracking-mode="off" activity="still"></sidekick-avatar>';
    await import('/browser/sidekick.js');
  });
  await page.waitForFunction(() => document.querySelector('#sized')?.ready);
  const result = await page.evaluate(async () => {
    const bot = document.querySelector('#sized');
    const read = async () => {
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const rect = bot.getBoundingClientRect(), bitmap = await createImageBitmap(await bot.snapshot({ crop: false }));
      const value = { size: bot.size, width: rect.width, height: rect.height, backing: [bitmap.width, bitmap.height], zoom: bot.zoom, backend: bot.diagnostics.backend, graphics: bot.diagnostics.graphics }; bitmap.close(); return value;
    };
    const initial = await read(); bot.zoom = 1.5; bot.size = 160.5; const updated = await read();
    bot.style.setProperty('width', '340px', 'important'); bot.style.setProperty('height', '190px', 'important');
    bot.style.minWidth = '0px'; bot.style.maxHeight = 'none'; const whileOwned = await read();
    bot.removeAttribute('size'); const released = await read();
    bot.size = 96; const reowned = await read(); bot.remove(); document.body.append(bot); while (!bot.ready) await new Promise(resolve => requestAnimationFrame(resolve));
    return { initial, updated, whileOwned, released, reowned, reconnected: await read(), style: [bot.style.width, bot.style.height] };
  });
  assert.equal(result.initial.backend, backend);
  assert.equal(result.initial.graphics, forceCanvas ? 'canvas2d' : 'webgl2', 'size coverage must exercise the explicitly selected graphics renderer');
  for (const [key, size] of [['initial',120],['updated',160.5],['whileOwned',160.5],['reowned',96],['reconnected',96]]) {
    assert.equal(result[key].width, size, key); assert.equal(result[key].height, size, key);
    assert.deepEqual(result[key].backing, [Math.round(size*dpr),Math.round(size*dpr)], key);
  }
  assert.equal(result.updated.zoom, 1.5); assert.equal(result.released.zoom, 1.5);
  assert.deepEqual([result.released.width,result.released.height], [340,190]);
  assert.deepEqual(result.style, ['340px','190px']);
});
