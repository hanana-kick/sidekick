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
for (const local of [false, true]) for (const canvas of [false, true]) test(`six SDK slots: local=${local}, canvas=${canvas}`, async t => {
  const page = await browser.newPage(); t.after(() => page.close());
  await page.addInitScript(({ local, canvas }) => {
    if (local) Object.defineProperty(window, 'Worker', { value: undefined });
    if (canvas) for (const ctor of [HTMLCanvasElement, globalThis.OffscreenCanvas].filter(Boolean)) {
      const get = ctor.prototype.getContext; ctor.prototype.getContext = function (kind, ...args) { return kind === 'webgl2' ? null : get.call(this, kind, ...args); };
    }
  }, { local, canvas });
  if (canvas) await page.route('**/src/runtime/render-worker.js', async route => {
    const response = await route.fetch(); await route.fulfill({ response, body: `const get=OffscreenCanvas.prototype.getContext;OffscreenCanvas.prototype.getContext=function(k,...a){return k==='webgl2'?null:get.call(this,k,...a)};\n${await response.text()}` });
  });
  await page.route(`${origin}/all-slots-check.html`, route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><meta charset="utf-8"><style>body{display:flex;background:#ddd;font:16px sans-serif}sidekick-avatar{display:block;width:240px;height:240px}</style><script type="importmap">{"imports":{"@hanana-kick/sidekick-plugin-sdk":"/plugin-sdk/index.js"}}</script><section>Built-in<sidekick-avatar id="builtin" activity="still" tracking-mode="off"></sidekick-avatar></section><section>External SDK plugins<sidekick-avatar id="external" activity="still" tracking-mode="off"></sidekick-avatar></section><script type="module" src="/src/auto.js"></script>` }));
  const errors = []; page.on('pageerror', error => errors.push(String(error)));
  await page.goto(`${origin}/all-slots-check.html`); await page.waitForFunction(() => [...document.querySelectorAll('sidekick-avatar')].every(bot => bot.ready));
  const result = await page.evaluate(async () => {
    const api = await import('/src/auto.js'), builtin = document.querySelector('#builtin'), external = document.querySelector('#external');
    const specs = [
      ['head','halo','catalog/halo','halo.js','default','plugin-halo'],
      ['eyes','glasses','catalog/glasses','glasses.js','default','plugin-glasses'],
      ['mouth','moustache','catalog/moustache','moustache.js','default','plugin-moustache'],
      ['neck','bowTie','catalog/bow-tie','bow-tie.js','default','plugin-bow-tie'],
      ['leftEar','earring','catalog/earring-left','earring.js','leftEarring','plugin-earring-left'],
      ['rightEar','earring','catalog/earring-right','earring.js','rightEarring','plugin-earring-right'],
    ];
    const registry = new api.AccessoryPluginRegistry(), loads = {};
    for (const [slot,preset,id,file,name] of specs) registry.registerLazy(id, async () => { loads[id] = (loads[id] ?? 0) + 1; return (await import('/plugin-sdk/examples/catalog/' + file))[name]; });
    builtin.paused = external.paused = true;
    const visible = async bot => { const frame = await bot.capturePixelsAsync(); let count = 0; for(let i=0;i<frame.pixels.length;i+=4)if(frame.pixels[i]===160&&frame.pixels[i+1]===32&&frame.pixels[i+2]===240)count++; return count; };
    const comparisons = [];
    for (const shape of ['circle','heart','pixelTriangle']) for (const [slot,preset,id,file,name,instance] of specs) {
      for (const [previous] of specs) external.removePluginAccessory(previous);
      await builtin.setDesign(api.createDesign({ body:{shape}, accessories:[{...api.createAccessory(preset,{slot,id:'reference'}),color:'#a020f0'}] }));
      await external.setDesign(api.createDesign({ body:{shape}, accessories:[] }));
      await external.equipPluginAccessory(registry,id,{slot,id:instance,color:'#a020f0'});
      comparisons.push({shape,slot,builtin:await visible(builtin),external:await visible(external)});
    }
    await builtin.setDesign(api.createDesign({body:{shape:'circle'},accessories:specs.map(([slot,preset,,,,instance])=>api.createAccessory(preset,{slot,id:instance.replace('plugin-','reference-')}))}));
    await external.setDesign(api.createDesign({body:{shape:'circle'},accessories:[]}));
    for (const [slot,preset,id,,,instance] of specs) await external.equipPluginAccessory(registry,id,{slot,id:instance,color:api.createAccessory(preset,{slot}).color});
    builtin.paused = external.paused = false;
    const first = Promise.all([builtin.setShape('heart',{duration:180}),external.setShape('heart',{duration:180})]);
    await new Promise(resolve=>setTimeout(resolve,60));
    await Promise.all([builtin.setShape('boom',{duration:180}),external.setShape('boom',{duration:180})]); await first;
    await Promise.all([builtin.setShape('circle',{duration:180}),external.setShape('circle',{duration:180})]);
    builtin.paused = external.paused = true;
    const {allSlotsAnimation}=await import('/plugin-sdk/examples/catalog/all-slots-animation.js');
    external.setPartAnimation(allSlotsAnimation); external.pausePartAnimation(); external.seekPartAnimation(.75);
    const a=Array.from((await external.capturePixelsAsync()).pixels); external.seekPartAnimation(1.25);await external.capturePixelsAsync();external.seekPartAnimation(.75); const b=Array.from((await external.capturePixelsAsync()).pixels);
    external.clearPartAnimation();
    external.remove();document.body.append(external);
    await new Promise((resolve,reject)=>{let tries=0;const poll=()=>external.ready?resolve():++tries>100?reject(new Error('Reconnect timeout')):setTimeout(poll,20);poll()});
    await external.capturePixelsAsync();
    return {comparisons,loads,deterministic:a.every((v,i)=>v===b[i]),equipment:external.pluginAccessories.length,designAccessories:external.design.accessories.length,backend:external.diagnostics.backend,graphics:external.diagnostics.graphics};
  });
  assert.deepEqual(errors, []);
  for(const comparison of result.comparisons){assert.ok(comparison.builtin>0,JSON.stringify(comparison));assert.ok(comparison.external>0,JSON.stringify(comparison));}
  assert.deepEqual(Object.values(result.loads),[1,1,1,1,1,1]);assert.equal(result.equipment,6);assert.equal(result.designAccessories,0);assert.equal(result.deterministic,true);
  assert.equal(result.backend,local?'main':'worker');assert.equal(result.graphics,canvas?'canvas2d':'webgl2');
  const output=process.env.SIDEKICK_SCREENSHOTS??'artifacts/catalog-plugins';mkdirSync(output,{recursive:true});
  await page.screenshot({path:join(output,`six-slots-${local?'main':'worker'}-${canvas?'canvas':'webgl'}.png`)});
});
