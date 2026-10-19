import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { createAppServer } from '../scripts/serve.mjs';

let browser, server, origin;
before(async () => {
  server = createAppServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), headless: process.env.SIDEKICK_HEADED !== '1', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
});
after(async () => { await browser?.close(); if (server) await new Promise(resolve => server.close(resolve)); });

// Non-preserved WebGL buffers are cleared after presentation. Read actual GPU
// pixels synchronously after drawing, without changing production context flags.
function installMainReadback() {
  window.mainDrawSamples = new WeakMap();
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function(kind, ...args) {
    const gl = getContext.call(this, kind, ...args);
    if (kind === 'webgl2' && gl && !gl.__firstFrameAudit) {
      gl.__firstFrameAudit = true;
      const draw = gl.drawElements.bind(gl), canvas = this;
      gl.drawElements = (...values) => {
        const result = draw(...values);
        const rgba = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
        gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
        let hash = 2166136261, opaque = 0;
        for (let i = 3; i < rgba.length; i += 4) { const alpha = rgba[i] > 127 ? 1 : 0; hash = Math.imul(hash ^ alpha, 16777619); opaque += alpha; }
        window.mainDrawSamples.set(canvas, { hash, opaque });
        return result;
      };
    }
    return gl;
  };
}
async function saveEvidence(page, name, frames) {
  if (!process.env.SIDEKICK_SCREENSHOTS) return;
  await mkdir(process.env.SIDEKICK_SCREENSHOTS, { recursive: true });
  await writeFile(`${process.env.SIDEKICK_SCREENSHOTS}/${name}.json`, JSON.stringify(frames, null, 2));
  await page.screenshot({ path: `${process.env.SIDEKICK_SCREENSHOTS}/${name}.png` });
}
async function visibleScreenshotPixels(page, selector) {
  const image = await page.locator(selector).screenshot();
  return page.evaluate(async bytes => {
    const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/png' }));
    const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
    const context = canvas.getContext('2d'); context.drawImage(bitmap, 0, 0); bitmap.close();
    const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let ink = 0;
    for (let i = 0; i < rgba.length; i += 4) if (rgba[i] < 230 || rgba[i + 1] < 230 || rgba[i + 2] < 230) ink++;
    return ink;
  }, [...image]);
}

for (const backend of ['worker', 'main']) for (const entry of ['html', 'preupgrade', 'react', 'late']) {
  test(`first visible GPU frame is configured: ${backend} / ${entry}`, async t => {
    const page = await browser.newPage({ viewport: { width: 500, height: 400 }, reducedMotion: 'no-preference' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    t.after(async () => { await page.close(); assert.deepEqual(errors, []); });
    await page.route('**/peers/*.js', async route => {
      const name = new URL(route.request().url()).pathname.split('/').at(-1);
      await route.fulfill({ contentType: 'text/javascript', body: await readFile(`cdn/react-19.3.1/${name}`, 'utf8') });
    });
    // Real module startup is delayed; configuration changes can arrive while loading.
    await page.route('**/src/runtime/render-engine.js', async route => {
      await new Promise(resolve => setTimeout(resolve, 250));
      await route.continue();
    });
    await page.addInitScript(installMainReadback);
    await page.addInitScript(({ backend }) => {
      if (backend === 'main') window.Worker = undefined;
      window.firstFrames = [];
      const output = document.createElement('canvas'), context = output.getContext('2d', { willReadFrequently: true });
      const sample = () => {
        const avatar = document.getElementById('subject'), canvas = avatar?.shadowRoot?.querySelector('canvas');
        if (canvas && !canvas.hidden && getComputedStyle(canvas).display !== 'none') {
          output.width = canvas.width; output.height = canvas.height;
          context.clearRect(0, 0, output.width, output.height);
          context.drawImage(canvas, 0, 0);
          const rgba = context.getImageData(0, 0, output.width, output.height).data;
          let hash = 2166136261, opaque = 0;
          // Body silhouette is independent of automatic blinking and eye expression.
          for (let i = 3; i < rgba.length; i += 4) { const alpha = rgba[i] > 127 ? 1 : 0; hash = Math.imul(hash ^ alpha, 16777619); opaque += alpha; }
          const gpu = window.mainDrawSamples?.get(canvas);
          window.firstFrames.push({ hash: gpu?.hash ?? hash, opaque: gpu?.opaque ?? opaque, readback: gpu ? 'synchronous-webgl' : 'offscreen-presentation', ready: avatar.ready, shape: avatar.design.body.shape, revision: avatar.diagnostics.acknowledgedRevision });
        }
        if (window.firstFrames.length < 12) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    }, { backend });
    const shape = entry === 'html' ? 'heart' : entry === 'preupgrade' ? 'flower' : entry === 'react' ? 'ghostish' : 'triangle';
    const markup = entry === 'react' ? '<div id="root"></div>' : `<sidekick-avatar id="subject" activity="still" tracking-mode="off" ${entry === 'html' ? `shape="${shape}" expression="smile"` : ''}></sidekick-avatar>`;
    const script = entry === 'react' ? `
      import '/src/auto.js';
      import React from 'react';
      import { createRoot } from 'react-dom/client';
      import { SidekickAvatar } from '/src/react.js';
      createRoot(document.getElementById('root')).render(React.createElement(SidekickAvatar, { id:'subject',shape:'${shape}',expression:'smile',activity:'still',trackingMode:'off' }));
    ` : `
      const avatar = document.getElementById('subject');
      ${entry === 'preupgrade' ? `const { createDesign } = await import('/src/core/design.js'); avatar.design = createDesign({body:{shape:'${shape}'}});` : ''}
      await import('/src/auto.js');
      ${entry === 'late' ? `avatar.setAttribute('shape','heart'); await new Promise(resolve=>setTimeout(resolve,60)); avatar.setAttribute('shape','${shape}'); avatar.setAttribute('expression','smile');` : ''}
    `;
    await page.route(`${origin}/first-frame.html`, route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><style>body{margin:0;background:white}sidekick-avatar{width:300px;height:300px}</style><script type="importmap">{"imports":{"react":"/peers/react.js","react-dom/client":"/peers/react-dom-client.js"}}</script></head><body>${markup}<script type="module">${script}</script></body></html>` }));
    await page.goto(`${origin}/first-frame.html`);
    await page.waitForFunction(() => window.firstFrames.length >= 12, null, { timeout: 20000 });
    const frames = await page.evaluate(() => window.firstFrames);
    await saveEvidence(page, `first-frame-${backend}-${entry}`, frames);
    assert.ok(await visibleScreenshotPixels(page, '#subject') > 500, 'Composited avatar is visibly rendered');
    assert.ok(frames.every(frame => frame.ready), 'No pre-ready canvas is ever visible');
    assert.ok(frames.every(frame => frame.shape === shape), 'All visible frames use the authored shape');
    assert.ok(frames.every(frame => frame.opaque > 500), 'First visible frame contains actual rendered pixels');
    assert.equal(new Set(frames.map(frame => frame.hash)).size, 1, 'No default-square silhouette or initial morph is presented');
    assert.equal(await page.locator('#subject').evaluate(avatar => avatar.diagnostics.backend), backend);
    // A subsequent author update still animates; startup gating is not permanent.
    const morph = await page.locator('#subject').evaluate(async avatar => {
      const hash = image => { let value = 2166136261; for (let i=3;i<image.pixels.length;i+=4) value=Math.imul(value^(image.pixels[i]>127?1:0),16777619); return value; };
      const before = hash(await avatar.capturePixelsAsync());
      const motion = avatar.setShape('square', { duration: 1200, easing: 'linear' });
      await new Promise(resolve => setTimeout(resolve, 300));
      const during = hash(await avatar.capturePixelsAsync());
      await motion;
      const after = hash(await avatar.capturePixelsAsync());
      return { before, during, after, ready: avatar.ready, visible: !avatar.shadowRoot.querySelector('canvas').hidden };
    });
    assert.notEqual(morph.during, morph.before, 'Subsequent shape transition advances beyond its start');
    assert.notEqual(morph.during, morph.after, 'Subsequent shape transition has an actual intermediate silhouette');
    assert.equal(morph.ready && morph.visible, true);
  });
}

for (const [name, route, selector] of [
  ['studio', '/', '#flat'],
  ['guide', '/guide.html?lang=en#loading', '#demo-bot'],
  ['state-element', '/guide.html?lang=en&framework=element#state-appearance', '#reference-bot'],
  ['state-react', '/guide.html?lang=en&framework=react#state-appearance', '#reference-bot'],
]) test(`saved Studio design is present in the first visible ${name} frame`, async t => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'no-preference' });
  t.after(() => page.close());
  await page.goto(origin);
  const scene = await page.evaluate(async () => {
    const { createScene } = await import('/src/core/scene.js');
    const { createDesign } = await import('/src/core/design.js');
    return createScene({ design: createDesign({ body: { shape: 'heart', color: '#123456' }, accessories: [] }), zoom: 1.4, bodyOrientation: { yaw: 0, pitch: 0, roll: 0 }, activity: 'still', paused: true, trackingMode: 'off' });
  });
  await page.addInitScript(installMainReadback);
  await page.addInitScript(({ scene, selector }) => {
    localStorage.setItem('sidekick.studio.scene.v3', JSON.stringify(scene));
    window.startupSamples = [];
    const sample = () => {
      const avatar = document.querySelector(selector), canvas = avatar?.shadowRoot?.querySelector('canvas');
      if (canvas && !canvas.hidden && getComputedStyle(canvas).display !== 'none') {
        const output = document.createElement('canvas'); output.width = canvas.width; output.height = canvas.height;
        const ctx = output.getContext('2d'); ctx.drawImage(canvas, 0, 0);
        const rgba = ctx.getImageData(0, 0, output.width, output.height).data;
        let pixels = 0; for (let i = 3; i < rgba.length; i += 4) if (rgba[i] > 127) pixels++;
        pixels = window.mainDrawSamples?.get(canvas)?.opaque ?? pixels;
        window.startupSamples.push({ ready: avatar.ready, shape: avatar.design.body.shape, color: avatar.design.body.color, pixels });
      }
      if (window.startupSamples.length < 6) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }, { scene, selector });
  await page.goto(origin + route);
  let target = page;
  if (name.startsWith('state')) {
    await page.waitForSelector('.state-lab iframe');
    await page.locator('.state-lab iframe').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector('[data-state-reference]')?.hasAttribute('data-configured'));
    target = page.frames().find(frame => frame.url().includes('/state-preview.html'));
    assert.ok(target);
  }
  await target.waitForFunction(() => window.startupSamples.length >= 6, null, { timeout: 20000 });
  const frames = await target.evaluate(() => window.startupSamples);
  await saveEvidence(page, `first-frame-saved-${name}`, frames);
  assert.ok(frames.every(frame => frame.ready && frame.shape === 'heart' && frame.color === '#123456'), JSON.stringify(frames));
  assert.ok(frames.every(frame => frame.pixels > 100), 'The first visible scene contains actual GPU pixels');

});
