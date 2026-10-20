import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import ts from 'typescript';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { createAppServer } from '../scripts/serve.mjs';

// Run with SIDEKICK_HEADED=1 under xvfb. No golden images: numerical continuity
// assertions accompany sequential rendered frames and a reviewable contact sheet.
const output = process.env.SIDEKICK_SCREENSHOTS;
let browser, server, base;
before(async () => {
  if (output) await mkdir(output, { recursive: true });
  server = createAppServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
    headless: process.env.SIDEKICK_HEADED !== '1',
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
  });
});
after(async () => { await browser?.close(); if (server?.listening) await new Promise(resolve => server.close(resolve)); });
const slug = name => name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
// These fixtures use default natural travel (1350 CSS px/s), never a tween or
// a custom higher speed. A snapshot can precede this frame's movement callback,
// so its position may still represent the previous rAF. Include that frame and
// the 1/240s integrator remainder, not the time between delayed sampler calls.
// Endpoint speed is not a bound: it can peak between snapshots or reset on arrival.
const frameTravelAllowance = (a, b) =>
  1350 * (Math.max(0, b.time - a.previousFrameTime) / 1000 + 1 / 240) + .1;
const hidden = scope => scope.waitForFunction(() => window.qaBot.presenceState === 'hidden');
const visible = scope => scope.waitForFunction(() => window.qaBot.presenceState === 'visible' && window.qaBot.movementState.phase === 'idle' && Number(getComputedStyle(window.qaBot.shadowRoot.querySelector('canvas')).opacity) === 1);

async function newPage(t, options = {}) {
  const name = slug(t.name), errors = [];
  const context = await browser.newContext({ viewport: { width: 960, height: 720 }, reducedMotion: 'no-preference',
    ...(output ? { recordVideo: { dir: join(output, 'video'), size: { width: 960, height: 720 } } } : {}), ...options });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  t.after(async () => {
    if (output && !page.isClosed()) {
      await page.screenshot({ path: join(output, `${name}-last.png`) });
      // Preserve evidence even when an assertion or a wait fails mid-sequence.
      for (const [index, frame] of page.frames().entries()) {
        const samples = await frame.evaluate(() => window.qaSamples ?? null).catch(() => null);
        if (samples) await writeFile(join(output, `${name}-frame-${index}-all-samples.json`), JSON.stringify(samples, null, 2));
      }
    }
    const video = page.video(); await context.close();
    if (output && video) await video.saveAs(join(output, `${name}.webm`));
    assert.deepEqual(errors, [], 'no browser exceptions');
  });
  return page;
}

async function installSampler(scope, selector) {
  await scope.evaluate(selector => {
    window.qaBot = document.querySelector(selector);
    window.qaOriginalCanvas = window.qaBot.shadowRoot.querySelector('canvas');
    window.qaGeneration = window.qaBot.diagnostics.generation;
    window.qaSamples = []; window.qaSegment = 'baseline';
    window.qaSnapshot = () => {
      const bot = window.qaBot, canvas = bot.shadowRoot.querySelector('canvas');
      const botRect = bot.getBoundingClientRect(), card = document.querySelector('#card')?.getBoundingClientRect();
      const clip = canvas.style.clipPath;
      // The even-odd hole must erase the WHOLE canvas, not merely overlap it.
      // A fully masked staging point can be relocated between rendered frames.
      const coordinates = clip.match(/-?[\d.]+(?=px)/g)?.map(Number) ?? [];
      const w = canvas.clientWidth, h = canvas.clientHeight;
      const fullCutout = [0, 0, w, 0, w, h, 0, h, 0, 0, 0, 0, w, 0, w, h, 0, h, 0, 0, 0, 0];
      const fullyOccluded = !!card && clip.startsWith('polygon(evenodd,') &&
        coordinates.length === fullCutout.length && coordinates.every((value, i) => Math.abs(value - fullCutout[i]) < .001) &&
        botRect.left >= card.left - .01 && botRect.top >= card.top - .01 &&
        botRect.right <= card.right + .01 && botRect.bottom <= card.bottom + .01;
      return { time: performance.now(), segment: window.qaSegment, position: bot.position,
        movement: bot.movementState, presence: bot.presenceState, lifecycle: bot.lifecycleState,
        opacity: Number(getComputedStyle(canvas).opacity), visibility: getComputedStyle(bot).visibility,
        clip, fullyOccluded, outsideViewport: botRect.right <= 0 || botRect.bottom <= 0 || botRect.left >= innerWidth || botRect.top >= innerHeight, cardRect: card?.toJSON() ?? null, design: JSON.stringify(bot.design),
        sameCanvas: canvas === window.qaOriginalCanvas, generation: bot.diagnostics.generation,
        frames: bot.diagnostics.frames, running: bot.diagnostics.running,
        scroll: { x: scrollX, y: scrollY },
        previewScroll: document.querySelector('#preview-demo')?.scrollTop ?? null,
        homeRect: document.querySelector('#reference-home')?.getBoundingClientRect().toJSON() ?? null,
        botRect: botRect.toJSON() };
    };
    window.qaSampling = true;
    let previousFrameTime;
    const sample = frameTime => {
      if (!window.qaSampling) return;
      window.qaSamples.push({ ...window.qaSnapshot(), frameTime, previousFrameTime });
      previousFrameTime = frameTime;
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }, selector);
}

async function fixture(t, backend = 'worker', options) {
  const page = await newPage(t, options);
  if (backend === 'main') await page.addInitScript(() => { window.Worker = undefined; });
  await page.route('**/presence-continuity-fixture', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><style>
    body{margin:0;background:#f5f2eb;color:#34443c;font:18px system-ui}h1{margin:28px;font-size:26px}p{margin:28px;color:#607167}
    #card{position:absolute;left:320px;top:220px;width:300px;height:280px;background:#294a40;border-radius:16px}
    sidekick-avatar{width:120px;height:120px}
    </style><h1>Presence continuity</h1><p>Heart · sage body · same canvas throughout</p><div id="card"></div>
    <sidekick-avatar id="bot" placement="viewport" shape="heart" body-color="#9ab58e" eye-color="#263d32" tracking-mode="off"></sidekick-avatar>
    <script type="module" src="/browser/sidekick.js"></script></html>` }));
  await page.goto(`${base}/presence-continuity-fixture`);
  await page.waitForFunction(() => document.querySelector('#bot')?.ready);
  await page.evaluate(async () => { const bot = document.querySelector('#bot'); await bot.moveTo({ x: 160, y: 300 }, { duration: 0 }); bot.presence = { visible: true }; });
  await installSampler(page, '#bot'); await visible(page);
  assert.equal(await page.evaluate(() => window.qaBot.diagnostics.backend), backend);
  return page;
}

// Screenshots are deliberately serial, preserving their real capture order.
// rAF trajectories continue independently, including frames between screenshots.
async function sequence(page, scope, name, action, duration = 380) {
  await scope.evaluate(name => { window.qaSegment = name; }, name);
  const frames = [], start = Date.now();
  await action();
  do {
    if (output) {
      const png = await page.screenshot();
      const state = await scope.evaluate(() => window.qaSnapshot());
      const file = `${slug(name)}-${String(frames.length).padStart(3, '0')}.png`;
      await writeFile(join(output, file), png);
      frames.push({ file, png: png.toString('base64'), state });
    }
    await page.waitForTimeout(35);
  } while (Date.now() - start < duration);
  if (output) {
    await writeFile(join(output, `${slug(name)}-screenshots.json`), JSON.stringify(frames.map(({ png, ...frame }) => frame), null, 2));
    // Dedicated page avoids disturbing the application or its animation clock.
    const sheet = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    await sheet.setContent(`<style>body{margin:12px;background:#e8e8e8;font:13px monospace}main{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}img{width:100%}figure{margin:0;background:white}figcaption{padding:7px}</style><h2>${slug(name)}</h2><main>${frames.map(({ png, state }, i) => `<figure><img src="data:image/png;base64,${png}"><figcaption>${i} · ${Math.round(state.time)}ms · ${state.presence} · opacity ${state.opacity.toFixed(2)}<br>x ${state.position.x.toFixed(1)} y ${state.position.y.toFixed(1)}</figcaption></figure>`).join('')}</main>`);
    await sheet.screenshot({ path: join(output, `${slug(name)}-contact-sheet.png`), fullPage: true }); await sheet.close();
  }
}
async function finish(scope, name) {
  const result = await scope.evaluate(async () => {
    const bot = window.qaBot;
    // Never retain a state snapshot across asynchronous GPU capture.
    const image = await bot.capturePixelsAsync();
    let opaquePixels = 0;
    for (let i = 3; i < image.pixels.length; i += 4) if (image.pixels[i] > 127) opaquePixels++;
    const state = window.qaSnapshot(); window.qaSampling = false;
    return { opaquePixels, state, samples: window.qaSamples, originalGeneration: window.qaGeneration };
  });
  if (output) await writeFile(join(output, `${slug(name)}-trajectory.json`), JSON.stringify(result, null, 2));
  assert.ok(result.opaquePixels > 100, 'final configured companion has rendered pixels');
  assert.ok(result.samples.every(s => s.sameCanvas && s.generation === result.originalGeneration), 'renderer and canvas persist');
  assert.ok(result.samples.every(s => s.design === result.samples[0].design), 'no default appearance flash');
  for (let i = 1; i < result.samples.length; i++) {
    const a = result.samples[i - 1], b = result.samples[i];
    if (a.presence === 'hidden' || b.presence === 'hidden' || a.opacity === 0 || b.opacity === 0 || a.fullyOccluded || b.fullyOccluded || a.outsideViewport || b.outsideViewport) continue;
    if (a.previousFrameTime === undefined) continue;
    const allowance = frameTravelAllowance(a, b);
    assert.ok(distance(a.position, b.position) <= allowance, `no visible frame jump at ${b.time.toFixed(1)}ms: ${distance(a.position, b.position).toFixed(1)}px > ${allowance.toFixed(1)}px`);
  }
  return result;
}

test('continuity oracle uses represented frame time, not delayed callback spacing', () => {
  // CI sampled callbacks 2.7ms apart, although movement integrated a full frame.
  const a = { time: 1319.7, previousFrameTime: 1283.3 };
  const b = { time: 1322.4 };
  const allowance = frameTravelAllowance(a, b);
  assert.ok(18.44 <= allowance, 'normal 16.67ms motion survives sampler jitter');
  assert.ok(260 > allowance, 'a viewport staging teleport is still rejected');
  assert.ok(frameTravelAllowance({ previousFrameTime: 1000 }, { time: 1000 }) < 6,
    'no unexplained fixed 12px jump allowance');
});

async function captureReversal(scope, declaration, name) {
  const reversal = await scope.evaluate(async declaration => {
    const bot = window.qaBot, reports = [];
    const report = event => reports.push({ time: performance.now(), ...event.detail });
    bot.addEventListener('sidekick-move-progress', report);
    const before = window.qaSnapshot();
    try {
      bot.presence = declaration;
      for (let i = 0; i < 20; i++) await Promise.resolve();
      return { before, after: window.qaSnapshot(), reports };
    } finally { bot.removeEventListener('sidekick-move-progress', report); }
  }, declaration);
  // Save before any assertion so failures retain the exact synchronous boundary.
  if (output) await writeFile(join(output, `${slug(name)}-reversal.json`), JSON.stringify(reversal, null, 2));
  return reversal;
}
function assertReversal(reversal) {
  // Reading movementState returns the previous render tick. to() first samples
  // the OLD trajectory at performance.now(), then reports the new track at
  // progress=0. Compare those adjacent reports at the same physical instant,
  // rather than incorrectly demanding no motion since the previous rAF.
  const index = reversal.reports.findIndex((report, i) => i > 0 && report.progress === 0 && reversal.reports[i - 1].progress > 0);
  assert.ok(index > 0, 'observe old-flight catch-up followed by new-track report');
  const before = reversal.reports[index - 1], after = reversal.reports[index];
  assert.ok(distance(before.position, after.position) < 1, 'retarget does not teleport at the sampled boundary');
  assert.ok(distance(before.velocity, after.velocity) < 1, 'retarget preserves instantaneous velocity at the sampled boundary');
  assert.ok(distance(after.position, reversal.after.position) < 1, 'no subsequent synchronous relocation');
  assert.ok(distance(after.velocity, reversal.after.movement.velocity) < 1, 'no subsequent synchronous velocity reset');
}

for (const backend of ['worker', 'main']) {
  test(`plain presence fades in place over 180ms and stops hidden rendering ${backend}`, { timeout: 60000 }, async t => {
    const page = await fixture(t, backend), origin = await page.evaluate(() => window.qaBot.position);
    await sequence(page, page, `${backend}-plain-hide`, () => page.evaluate(() => { window.qaBot.presence = { visible: false }; }));
    await hidden(page); await page.waitForTimeout(100);
    const frames = await page.evaluate(() => window.qaBot.diagnostics.frames);
    await page.waitForTimeout(180);
    assert.deepEqual(await page.evaluate(() => ({ frames: window.qaBot.diagnostics.frames, running: window.qaBot.diagnostics.running })), { frames, running: false });
    await sequence(page, page, `${backend}-plain-show`, () => page.evaluate(() => { window.qaBot.presence = { visible: true }; }));
    await visible(page);
    const result = await finish(page, t.name);
    assert.ok(result.samples.every(s => distance(s.position, origin) < .1), 'plain visibility cannot travel');
    for (const part of ['hide', 'show']) {
      const samples = result.samples.filter(s => s.segment === `${backend}-plain-${part}`);
      assert.ok(samples.some(s => s.opacity > .05 && s.opacity < .95), `${part} must have intermediate opacity`);
      const first = samples.find(s => part === 'hide' ? s.opacity < 1 : s.opacity > 0);
      const last = samples.find(s => part === 'hide' ? s.presence === 'hidden' : s.opacity === 1);
      assert.ok(last && first && last.time - first.time >= 100 && last.time - first.time < 500, `${part} is approximately 180ms (rAF tolerance)`);
    }
  });
  for (const edge of ['left', 'right', 'top', 'bottom']) test(`explicit ${edge} exit reentry and reversal ${backend}`, { timeout: 60000 }, async t => {
    const page = await fixture(t, backend);
    await sequence(page, page, `${backend}-${edge}-full-exit`, () => page.evaluate(edge => { window.qaBot.presence = { visible: false, exit: { to: edge } }; }, edge), 1200);
    await hidden(page);
    await sequence(page, page, `${backend}-${edge}-full-entry`, () => page.evaluate(edge => { window.qaBot.presence = { visible: true, entrance: { source: 'viewport', edge, inset: 110 } }; }, edge), 1200);
    await visible(page);
    await page.evaluate(edge => { window.qaBot.presence = { visible: false, exit: { to: edge } }; }, edge);
    await page.waitForFunction(() => window.qaBot.movementState.speed > 100);
    let reversal;
    await sequence(page, page, `${backend}-${edge}-reverse`, async () => {
      reversal = await captureReversal(page, { visible: true, entrance: { source: 'viewport', edge, inset: 110 } }, t.name);
    }, 1200);
    assertReversal(reversal);
    await visible(page); const result = await finish(page, t.name);
    assert.ok(result.samples.some(s => s.presence === 'exiting' && s.movement.speed > 20));
    assert.ok(result.samples.some(s => s.presence === 'entering' && s.movement.speed > 20));
  });
}

for (const edge of ['left', 'right', 'top', 'bottom']) test(`element ${edge} mask survives reversing entrance to exit`, { timeout: 60000 }, async t => {
  const page = await fixture(t);
  await page.evaluate(() => { window.qaBot.presence = { visible: false }; }); await hidden(page);
  await page.evaluate(edge => { window.qaBot.presence = { visible: true, entrance: { source: 'element', target: '#card', direction: edge } }; }, edge);
  await page.waitForFunction(() => window.qaBot.movementState.speed > 80 && window.qaBot.shadowRoot.querySelector('canvas').style.clipPath.startsWith('polygon'));
  const reversal = await captureReversal(page, { visible: false, exit: { to: edge } }, t.name);
  assertReversal(reversal);
  assert.ok(reversal.after.clip.startsWith('polygon'), 'interrupted reveal keeps its occlusion mask');
  await sequence(page, page, `element-${edge}-reversal`, async () => {}, 1200); await hidden(page);
  await sequence(page, page, `element-${edge}-reenter`, () => page.evaluate(edge => { window.qaBot.presence = { visible: true, entrance: { source: 'element', target: '#card', direction: edge } }; }, edge), 1200);
  await visible(page); assert.equal(await page.evaluate(() => window.qaBot.shadowRoot.querySelector('canvas').style.clipPath), '');
  await finish(page, t.name);
});

for (const mode of ['reduced', 'paused', 'rapid']) test(`${mode} visibility reaches latest intent`, { timeout: 45000 }, async t => {
  const page = await fixture(t, 'worker', mode === 'reduced' ? { reducedMotion: 'reduce' } : {});
  if (mode === 'paused') await page.evaluate(() => { window.qaBot.paused = true; });
  await sequence(page, page, `${mode}-visibility`, async () => {
    await page.evaluate(async mode => {
      const bot = window.qaBot;
      for (let i = 0; i < (mode === 'rapid' ? 9 : 1); i++) {
        bot.presence = { visible: i % 2 !== 0 };
        await new Promise(resolve => setTimeout(resolve, mode === 'rapid' ? 30 : 0));
      }
    }, mode);
  });
  await hidden(page);
  await page.evaluate(() => { window.qaBot.presence = { visible: true }; }); await visible(page);
  await finish(page, t.name);
});

for (const framework of ['element', 'react']) test(`Guide lifecycle ${framework} visibility controls fade without displacement`, { timeout: 60000 }, async t => {
  const page = await newPage(t, { viewport: { width: 1280, height: 1000 } });
  await page.goto(`${base}/guide.html?lang=en&framework=${framework}#state-lifecycle`);
  await page.waitForSelector('[data-state-reference="state-lifecycle"][data-configured]');
  await page.locator('.state-lab iframe').scrollIntoViewIfNeeded();
  const frame = page.frames().find(frame => frame.url().includes('/state-preview.html')); assert.ok(frame);
  await frame.waitForFunction(() => document.querySelector('#reference-bot')?.ready && document.querySelector('#reference-bot').lifecycleState.phase === 'resting');
  await installSampler(frame, '#reference-bot');
  const origin = await frame.evaluate(() => window.qaBot.position);
  for (const action of ['hide', 'show']) {
    await sequence(page, frame, `guide-${framework}-${action}`, () => frame.locator('[data-lifecycle-action="visible"]').click());
    if (action === 'hide') await hidden(frame); else await visible(frame);
  }
  const result = await finish(frame, t.name);
  assert.ok(result.samples.every(s => distance(s.position, origin) < 1), 'real Guide visibility toggle remains at home');
});

test('API playground lifecycle visibility toggle stays in place', { timeout: 60000 }, async t => {
  const page = await newPage(t, { viewport: { width: 1280, height: 1000 } });
  await page.goto(`${base}/api-playground.html?lang=en&lesson=declarative-lifecycle`);
  await page.waitForFunction(() => !document.querySelector('#execute')?.disabled);
  await page.locator('#execute').click(); await page.locator('#bot-tools-close').click();
  await page.waitForFunction(() => document.querySelector('#bot')?.lifecycleState.phase === 'resting');
  // The demo now has its own scroller as well as document scrolling. A plain
  // scrollIntoViewIfNeeded can leave this button near an overlay and the real
  // click then centers it again, legitimately moving home AFTER the baseline.
  // Complete the exact click actionability/scroll preparation before sampling.
  const toggle = page.locator('[data-lifecycle-action="visible"]');
  await toggle.evaluate(el => el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }));
  await toggle.click({ trial: true });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.waitForFunction(() => {
    const bot = document.querySelector('#bot'), home = document.querySelector('#reference-home').getBoundingClientRect(), rect = bot.getBoundingClientRect();
    return bot.lifecycleState.phase === 'resting' && bot.movementState.phase === 'idle' &&
      Math.abs(rect.left - home.right - 8) < 1 && Math.abs(rect.top + rect.height / 2 - home.top - home.height / 2) < 1;
  });
  await installSampler(page, '#bot');
  const baseline = await page.evaluate(() => ({ position: window.qaBot.position,
    home: document.querySelector('#reference-home').getBoundingClientRect().toJSON(),
    scroll: { x: scrollX, y: scrollY }, previewScroll: document.querySelector('#preview-demo').scrollTop }));
  for (const action of ['hide', 'show']) {
    await sequence(page, page, `api-${action}`, () => page.locator('[data-lifecycle-action="visible"]').click());
    if (action === 'hide') await hidden(page); else await visible(page);
  }
  const result = await finish(page, t.name);
  assert.ok(result.samples.length > 0);
  for (const sample of result.samples) {
    assert.deepEqual(sample.scroll, baseline.scroll, 'Visibility clicks must not scroll the document after the baseline');
    assert.equal(sample.previewScroll, baseline.previewScroll, 'Visibility clicks must not scroll the nested demo after the baseline');
    assert.ok(distance(sample.homeRect, baseline.home) < .1, 'Home must remain fixed throughout the visibility-only test');
    assert.ok(distance(sample.position, baseline.position) < 1, 'Plain hide/show must preserve the exact resting position');
  }
});

for (const framework of ['element', 'react']) test(`copied ${framework} lifecycle runtime preserves plain visibility`, { timeout: 60000 }, async t => {
  const sourcePage = await browser.newPage();
  let source;
  try {
    await sourcePage.goto(`${base}/guide.html?lang=en&framework=${framework}#state-lifecycle`);
    await sourcePage.waitForSelector('[data-state-reference="state-lifecycle"][data-configured]');
    source = await sourcePage.locator('[data-state-source]').textContent();
  } finally { await sourcePage.close(); }
  const page = await newPage(t);
  let html = source;
  if (framework === 'element') {
    html = source.replace(/import ['"](?:@hanana-kick\/sidekick\/auto|https:\/\/cdn\.jsdelivr\.net\/gh\/hanana-kick\/sidekick@v[^/'"]+\/dist\/browser\/sidekick\.js)['"];?/, "import '/browser/sidekick.js';");
    assert.notEqual(html, source, 'copy uses recognized browser installation URL');
  } else {
    const output = ts.transpileModule(`import React from 'react';\nimport { createRoot } from 'react-dom/client';\n${source}\ncreateRoot(document.getElementById('root')).render(<React.StrictMode><LifecycleExample /></React.StrictMode>);`, {
      compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    for (const peer of ['react', 'react-dom-client']) await page.route(`${base}/presence-peers/${peer}.js`, async route => route.fulfill({
      contentType: 'text/javascript', body: await readFile(new URL(`../cdn/react-19.3.1/${peer}.js`, import.meta.url), 'utf8'),
    }));
    const imports = { react: '/presence-peers/react.js', 'react-dom/client': '/presence-peers/react-dom-client.js', '@hanana-kick/sidekick/react': '/browser/sidekick-react.js' };
    html = `<!doctype html><div id="root"></div><script type="importmap">${JSON.stringify({ imports })}</script><script type="module">${output}</script>`;
  }
  await page.route(`${base}/presence-copy.html`, route => route.fulfill({ contentType: 'text/html', body: html }));
  await page.goto(`${base}/presence-copy.html`);
  await page.waitForFunction(() => document.querySelector('#reference-bot')?.ready && document.querySelector('#reference-bot').lifecycleState.phase === 'resting');
  await installSampler(page, '#reference-bot'); const origin = await page.evaluate(() => window.qaBot.position);
  for (const action of ['hide', 'show']) {
    await sequence(page, page, `copied-${framework}-${action}`, () => page.locator('[data-lifecycle-action="visible"]').click());
    if (action === 'hide') await hidden(page); else await visible(page);
  }
  const result = await finish(page, t.name);
  assert.ok(result.samples.every(s => distance(s.position, origin) < 1));
  assert.ok(result.samples.some(s => s.opacity > .05 && s.opacity < .95), 'copied application actually animates visibility');
});
