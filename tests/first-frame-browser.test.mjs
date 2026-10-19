import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile, mkdir } from 'node:fs/promises';
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
          window.firstFrames.push({ hash, opaque, ready: avatar.ready, shape: avatar.design.body.shape, revision: avatar.diagnostics.acknowledgedRevision });
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
    assert.ok(frames.every(frame => frame.ready), 'No pre-ready canvas is ever visible');
    assert.ok(frames.every(frame => frame.shape === shape), 'All visible frames use the authored shape');
    assert.ok(frames.every(frame => frame.opaque > 500), 'First visible frame contains actual rendered pixels');
    assert.equal(new Set(frames.map(frame => frame.hash)).size, 1, 'No default-square silhouette or initial morph is presented');
    assert.equal(await page.locator('#subject').evaluate(avatar => avatar.diagnostics.backend), backend);
    if (process.env.SIDEKICK_SCREENSHOTS) {
      await mkdir(process.env.SIDEKICK_SCREENSHOTS, { recursive: true });
      await page.screenshot({ path: `${process.env.SIDEKICK_SCREENSHOTS}/first-frame-${backend}-${entry}.png` });
    }
    // A subsequent author update still animates; startup gating is not permanent.
    await page.locator('#subject').evaluate(avatar => avatar.setAttribute('shape', 'square'));
    await page.waitForTimeout(700);
    assert.equal(await page.locator('#subject').evaluate(avatar => avatar.ready && !avatar.shadowRoot.querySelector('canvas').hidden), true);
  });
}
