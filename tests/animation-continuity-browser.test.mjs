import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { createAppServer } from '../scripts/serve.mjs';

for (const fallback of [false, true]) for (const mobile of [false, true]) test(`continuous expression, state and emotion frames ${fallback ? 'fallback' : 'worker'} ${mobile ? 'mobile' : 'desktop'}`, async () => {
  const directory = process.env.SIDEKICK_SCREENSHOTS ?? 'artifacts'; await mkdir(directory, { recursive: true });
  const name = `smooth-${fallback ? 'fallback' : 'worker'}-${mobile ? 'mobile' : 'desktop'}`;
  const server = createAppServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), headless: process.env.SIDEKICK_HEADED !== '1', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
  const viewport = mobile ? { width: 390, height: 700 } : { width: 1000, height: 700 };
  const context = await browser.newContext({ viewport, deviceScaleFactor: mobile ? 2 : 1, recordVideo: { dir: directory, size: viewport } });
  const page = await context.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
  try {
    if (fallback) await page.addInitScript(() => Object.defineProperty(HTMLCanvasElement.prototype, 'transferControlToOffscreen', { value: undefined, configurable: true }));
    await page.route('**/smooth-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#fff;font:16px system-ui"><h2 style="text-align:center">Expression · state · emotion</h2><div id="caption" style="text-align:center">Starting</div><sidekick-avatar id="bot" shape="ghostish" body-color="#FFCC37" activity="still" tracking-mode="off" zoom="1.5" style="display:block;width:320px;height:320px;margin:20px auto"></sidekick-avatar></body></html>' }));
    await page.goto(`http://127.0.0.1:${server.address().port}/smooth-test.html`);
    await page.evaluate(async () => { window.api = await import('./browser/sidekick.js'); window.bot = document.querySelector('#bot'); await new Promise(r => bot.ready ? r() : bot.addEventListener('sidekick-ready', r, { once: true })); });
    assert.equal(await page.evaluate(() => bot.diagnostics.backend), fallback ? 'main' : 'worker');
    const trace = await page.evaluate(async () => {
      const wait = ms => new Promise(r => setTimeout(r, ms)), frames = [];
      const sample = async (label, action, duration = 650) => {
        document.querySelector('#caption').textContent = label; action(); const start = performance.now();
        while (performance.now() - start < duration) { await new Promise(requestAnimationFrame); frames.push({ label, t: performance.now(), pose: bot.pose, emotion: bot.emotionState, diagnostics: bot.diagnostics }); }
      };
      await sample('Neutral → smile', () => void bot.setExpression('both', 'smile'));
      await sample('Smile → neutral', () => void bot.setExpression('both', 'neutral'));
      await sample('Design update → smile', () => void bot.updateDesign({ eyes: { left: { weights: { smile: 1 } }, right: { weights: { smile: 1 } } } }));
      await sample('Thinking → celebrating', () => bot.setActivity('thinking'));
      await sample('Celebrating', () => bot.setActivity('celebrating'));
      await sample('Mid-flight expression reversal', () => { void bot.setExpression('both', 'neutral', { duration: 400 }); setTimeout(() => void bot.setExpression('both', 'smile', { duration: 400 }), 110); });
      await sample('Rapid state changes', () => { bot.setActivity('thinking'); setTimeout(() => bot.setActivity('speaking'), 70); setTimeout(() => bot.setActivity('listening'), 140); });
      await sample('Happy', () => bot.setEmotion('happy'));
      await sample('Surprised → concerned → happy baseline', () => { void bot.reactTo('surprised', { duration: 260 }); setTimeout(() => void bot.reactTo('concerned', { duration: 350 }), 130); }, 900);
      await sample('Sad', () => bot.setEmotion('sad'));
      await sample('Curious', () => bot.setEmotion('curious'));
      await sample('Excited', () => bot.setEmotion('excited'));
      await sample('Equip beret', () => void bot.equipAccessory(api.createAccessory('beret')));
      await sample('Swap crown', () => void bot.equipAccessory(api.createAccessory('crown')));
      await sample('Remove crown', () => void bot.removeAccessory(bot.design.accessories[0].id));
      await sample('Explicit equipment transition', () => void bot.transitionTo({ accessories: [api.createAccessory('beret')] }, { duration: 400 }));
      await sample('Return to authored baseline', () => { bot.setEmotion('neutral'); bot.setActivity('still'); });
      await wait(800); return frames;
    });
    assert.ok(trace.length > 150);
    for (const frame of trace) for (const eye of Object.values(frame.pose.eyes)) { assert.ok(Number.isFinite(eye.smile) && eye.smile >= -1e-8 && eye.smile <= 1 + 1e-8); assert.ok(eye.openness >= -1e-8 && eye.openness <= 1 + 1e-8); }
    const begin = trace.filter(f => f.label === 'Design update → smile'); assert.ok(begin.some(f => f.pose.eyes.left.smile > .05 && f.pose.eyes.left.smile < .95), 'direct design must expose real intermediate frames');
    assert.equal(await page.evaluate(() => bot.diagnostics.running), false, 'neutral+still settles to idle');
    await writeFile(`${directory}/${name}-trace.json`, JSON.stringify(trace));
    // A real GPU-rendered contact sheet with 60ms samples, captured on the same timeline.
    const images = await page.evaluate(async () => {
      bot.setEmotion('neutral'); bot.setActivity('still'); await bot.setExpression('both', 'neutral', { duration: 0 });
      const images = [], start = performance.now(); void bot.setExpression('both', 'smile', { duration: 480 });
      for (let i = 0; i < 9; i++) { const p = await bot.capturePixelsAsync(); const canvas = document.createElement('canvas'); canvas.width = p.width; canvas.height = p.height; const bytes = new Uint8ClampedArray(p.pixels.length); for (let y = 0; y < p.height; y++) bytes.set(p.pixels.subarray(y * p.width * 4, (y + 1) * p.width * 4), (p.height - y - 1) * p.width * 4); canvas.getContext('2d').putImageData(new ImageData(bytes, p.width, p.height), 0, 0); images.push({ src: canvas.toDataURL(), milliseconds: Math.round(performance.now() - start) }); await new Promise(r => setTimeout(r, 60)); }
      return images;
    });
    await page.evaluate(images => { document.body.innerHTML = '<h2>Actual rendered neutral → smile sequence</h2><div style="display:grid;grid-template-columns:repeat(3,1fr)">' + images.map(({src, milliseconds}) => `<div><img style="width:100%" src="${src}"><span>${milliseconds}ms</span></div>`).join('') + '</div>'; }, images);
    await page.screenshot({ path: `${directory}/${name}-contact.png`, fullPage: true }); assert.deepEqual(errors, []);
  } finally { await context.close(); if (page.video()) await page.video().saveAs(`${directory}/${name}.webm`); await browser.close(); await new Promise(r => server.close(r)); }
});
