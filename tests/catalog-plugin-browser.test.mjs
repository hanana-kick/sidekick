/** Real browser coverage for public-SDK catalog assets; requires WebGL, never skips it. */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { createAppServer } from '../scripts/serve.mjs';
let browser, server, origin;
before(async () => {
  server = createAppServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
});
after(async () => { await browser?.close(); if (server) await new Promise(resolve => server.close(resolve)); });
for (const local of [false, true]) for (const canvas of [false, true]) test(`SDK catalog assets: local=${local}, canvas=${canvas}`, async t => {
  const page = await browser.newPage(); t.after(() => page.close());
  await page.addInitScript(({ local, canvas }) => {
    if (local) Object.defineProperty(window, 'Worker', { value: undefined });
    if (canvas) for (const ctor of [HTMLCanvasElement, globalThis.OffscreenCanvas].filter(Boolean)) {
      const get = ctor.prototype.getContext;
      ctor.prototype.getContext = function (kind, ...args) { return kind === 'webgl2' ? null : get.call(this, kind, ...args); };
    }
  }, { local, canvas });
  if (canvas) await page.route('**/src/runtime/render-worker.js', async route => {
    const response = await route.fetch(); await route.fulfill({ response, body: `const get=OffscreenCanvas.prototype.getContext;OffscreenCanvas.prototype.getContext=function(k,...a){return k==='webgl2'?null:get.call(this,k,...a)};\n${await response.text()}` });
  });
  await page.route(`${origin}/catalog-plugin-check.html`, route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><meta charset="utf-8"><style>body{display:flex;background:#ddd;font:16px sans-serif}sidekick-avatar{display:block;width:240px;height:240px}</style><script type="importmap">{"imports":{"@hanana-kick/sidekick-plugin-sdk":"/plugin-sdk/index.js"}}</script><section>Built-in<sidekick-avatar id="builtin" activity="still" tracking-mode="off"></sidekick-avatar></section><section>External SDK plugins<sidekick-avatar id="external" activity="still" tracking-mode="off"></sidekick-avatar></section><script type="module" src="/src/auto.js"></script>` }));
  await page.goto(`${origin}/catalog-plugin-check.html`); await page.waitForFunction(() => [...document.querySelectorAll('sidekick-avatar')].every(bot => bot.ready));
  const results = await page.evaluate(async () => {
    const api = await import('/src/auto.js');
    const moustache = (await import('/plugin-sdk/examples/catalog/moustache.js')).default;
    const bowTie = (await import('/plugin-sdk/examples/catalog/bow-tie.js')).default;
    const builtin = document.querySelector('#builtin'), external = document.querySelector('#external');
    builtin.paused = external.paused = true;
    let lazyLoads = 0;
    const registry = new api.AccessoryPluginRegistry(); registry.register(moustache);
    registry.registerLazy(bowTie.id, async () => { lazyLoads++; return bowTie; });
    await Promise.all([external.equipPluginAccessory(registry, moustache.id, { slot: 'mouth', id: 'plugin-moustache', color: '#ff00ff' }), external.equipPluginAccessory(registry, bowTie.id, { slot: 'neck', id: 'plugin-bow-tie', color: '#00ffff' })]);
    const colors = async bot => {
      const image = await bot.capturePixelsAsync(); const counts = [0, 0, 0];
      for (let i = 0; i < image.pixels.length; i += 4) {
        const [r, g, b] = image.pixels.subarray(i, i + 3);
        if (r === 255 && g === 0 && b === 255) counts[0]++;
        if (r === 0 && g === 255 && b === 255) counts[1]++;
        if (r === 0 && g === 199 && b === 199) counts[2]++;
      }
      return counts;
    };
    const shapes = [];
    for (const shape of ['circle', 'square', 'heart']) {
      await builtin.setDesign(api.createDesign({ body: { shape }, accessories: [{ ...api.createAccessory('moustache', { id: 'reference-moustache' }), color: '#ff00ff' }, { ...api.createAccessory('bowTie', { id: 'reference-bow-tie' }), color: '#00ffff' }] }));
      await external.setDesign(api.createDesign({ body: { shape }, accessories: [] }));
      shapes.push({ shape, builtin: await colors(builtin), external: await colors(external) });
    }
    const { catalogAccessoryAnimation } = await import('/plugin-sdk/examples/catalog/animation.js');
    external.setPartAnimation(catalogAccessoryAnimation); external.pausePartAnimation(); external.seekPartAnimation(.75);
    const first = Array.from((await external.capturePixelsAsync()).pixels);
    external.seekPartAnimation(1.25); await external.capturePixelsAsync(); external.seekPartAnimation(.75);
    const second = Array.from((await external.capturePixelsAsync()).pixels);
    const deterministic = first.every((value, i) => value === second[i]);
    external.clearPartAnimation(); external.removePluginAccessory('neck'); await external.equipPluginAccessory(registry, bowTie.id, { slot: 'neck', id: 'plugin-bow-tie', color: '#00ffff' });
    external.remove(); document.body.append(external);
    await new Promise((resolve, reject) => { let tries = 0; const poll = () => external.ready ? resolve() : ++tries > 100 ? reject(new Error('Reconnect timeout')) : setTimeout(poll, 20); poll(); });
    await external.capturePixelsAsync();
    return { shapes, deterministic, lazyLoads, equipment: external.pluginAccessories.length, builtinCount: external.design.accessories.length, backend: external.diagnostics.backend, graphics: external.diagnostics.graphics };
  });
  for (const sample of results.shapes) {
    for (const [index, label] of ['moustache', 'bow tie', 'knot'].entries()) {
      assert.ok(sample.builtin[index] > 0, `${sample.shape} built-in ${label} visible`);
      assert.ok(sample.external[index] > 0, `${sample.shape} external ${label} visible`);
    }
  }
  assert.equal(results.builtinCount, 0); assert.equal(results.equipment, 2); assert.equal(results.lazyLoads, 1); assert.equal(results.deterministic, true);
  assert.equal(results.backend, local ? 'main' : 'worker'); assert.equal(results.graphics, canvas ? 'canvas2d' : 'webgl2');
  const output = process.env.SIDEKICK_SCREENSHOTS ?? 'artifacts/catalog-plugins'; mkdirSync(output, { recursive: true });
  await page.screenshot({ path: join(output, `catalog-plugins-${local ? 'main' : 'worker'}-${canvas ? 'canvas' : 'webgl'}.png`) });
});
