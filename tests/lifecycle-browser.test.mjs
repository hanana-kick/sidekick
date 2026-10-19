import nodeTest, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import ts from 'typescript';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { createAppServer } from '../scripts/serve.mjs';

const test = (name, run) => nodeTest(name, { timeout: 45000 }, run);
let browser, server, base;
before(async () => {
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

// This fixture consumes the unchanged distributable browser entry. The app only
// declares presence, task, and home; it does not manually sequence movement,
// reaction promises or return-home timers.
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Declarative lifecycle regression</title>
<style>
  *{box-sizing:border-box}body{margin:0;background:#f4f3ee;color:#273d36;font:16px/1.5 system-ui,sans-serif}
  header{padding:42px 48px}small{font-weight:650;letter-spacing:.14em;color:#6a8175}h1{font-size:36px;line-height:1.2;letter-spacing:-1.2px;margin:12px 0}p{color:#64766e;margin:8px 0}
  .card{position:absolute;background:#fff;border:1px solid #d5ded3;border-radius:22px;padding:22px;box-shadow:0 8px 30px #24382c08}
  #home-anchor{left:72px;top:620px;width:230px;height:110px;background:#e5ecdf}
  #work-anchor{left:740px;top:250px;width:310px;height:190px}.tag{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#718267}
  h2{font-size:22px;margin:8px 0}.progress{height:6px;background:#dce6d5;border-radius:9px;margin-top:26px}.progress::before{content:'';display:block;width:64%;height:100%;background:#8aaa76;border-radius:9px}
  #stage{position:absolute;left:48px;top:190px;font:13px/1.7 ui-monospace,monospace;color:#5e756a;white-space:pre-line}
  #caption{position:absolute;left:440px;top:675px;width:600px;font-size:14px;color:#748277}
  sidekick-avatar{width:130px;height:130px}
</style></head><body><header><small>SIDEKICK · LIFECYCLE</small><h1>One companion, one application task.</h1><p>Home → waiting at work → reaction → natural return → rest</p></header>
<div id="stage">Preparing companion</div>
<section class="card" id="home-anchor"><div class="tag">Home</div><h2>Ready when you are</h2></section>
<section class="card" id="work-anchor"><div class="tag">Application task</div><h2>Prepare the report</h2><p>The app owns completion.</p><div class="progress"></div></section>
<p id="caption">The same canvas and renderer remain mounted throughout the entire lifecycle.</p>
<sidekick-avatar id="bot" placement="viewport" tracking-mode="off" body-color="#9ab58e" eye-color="#263d32"></sidekick-avatar>
<script type="module">
  import '/browser/sidekick.js';
  const bot = document.getElementById('bot');
  window.lifecycleFixture = { changes: [], reactions: [], errors: [], bot, home: document.getElementById('home-anchor'), work: document.getElementById('work-anchor') };
  bot.addEventListener('sidekick-lifecycle-change', event => {
    window.lifecycleFixture.changes.push({ ...event.detail, time: performance.now(), position: bot.position });
    document.getElementById('stage').textContent = 'phase  ' + event.detail.phase + '\\ntask   ' + (event.detail.taskId ?? 'none') + '\\nstatus ' + (event.detail.taskStatus ?? 'none');
  });
  bot.addEventListener('sidekick-reaction-end', event => window.lifecycleFixture.reactions.push({ ...event.detail, time: performance.now() }));
  bot.addEventListener('sidekick-error', event => window.lifecycleFixture.errors.push(event.detail));
  window.setHome = (returnOn) => { bot.home = { positioning: { target: window.lifecycleFixture.home, placement: 'top-center', gap: 18 }, rest: { behavior: { type: 'idle' }, emotion: 'curious', emotionIntensity: .45, trackingMode: 'eyes' }, ...(returnOn ? { returnOn } : {}) }; };
  window.setTask = (id, status = 'pending', reaction) => { bot.task = { id, status, behavior: { type: 'wait', target: window.lifecycleFixture.work, side: 'left', gap: 28 }, ...(reaction ? { reaction } : {}) }; };
</script></body></html>`;

async function pageFor(t, { backend = 'worker', reducedMotion = 'reduce' } = {}) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, reducedMotion });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  if (backend === 'main') await page.addInitScript(() => { window.Worker = undefined; });
  await page.route('**/lifecycle-fixture.html', route => route.fulfill({ contentType: 'text/html', body: html }));
  t.after(async () => {
    if (process.env.SIDEKICK_SCREENSHOTS && !page.isClosed()) await evidence(page, `lifecycle-${backend}-${t.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-last-state`);
    await page.close();
    assert.deepEqual(errors, [], 'lifecycle fixture must not produce browser exceptions');
  });
  await page.goto(`${base}/lifecycle-fixture.html`);
  await page.waitForFunction(() => window.lifecycleFixture?.bot.ready);
  assert.equal(await page.evaluate(() => window.lifecycleFixture.bot.diagnostics.backend), backend);
  return page;
}
const phase = (page, value) => page.waitForFunction(value => window.lifecycleFixture.bot.lifecycleState.phase === value, value);
const acting = page => page.waitForFunction(() => window.lifecycleFixture.bot.behaviorState.status === 'acting' && window.lifecycleFixture.bot.task?.status === 'pending');
async function setupWork(page, id = 'report-1') {
  await page.evaluate(() => window.setHome()); await phase(page, 'resting');
  await page.evaluate(id => window.setTask(id), id); await acting(page);
}
async function evidence(page, name) {
  if (!process.env.SIDEKICK_SCREENSHOTS) return;
  const directory = process.env.SIDEKICK_SCREENSHOTS;
  await mkdir(directory, { recursive: true });
  const state = await page.evaluate(async () => {
    const { bot, changes, reactions, errors } = window.lifecycleFixture;
    let opaquePixels = null;
    if (bot.ready && bot.isConnected && bot.presenceState !== 'hidden') {
      const image = await bot.capturePixelsAsync();
      opaquePixels = 0;
      for (let i = 3; i < image.pixels.length; i += 4) if (image.pixels[i] > 127) opaquePixels++;
      if (!opaquePixels) throw new Error('Visible lifecycle phase rendered no opaque pixels');
    }
    return { opaquePixels, lifecycle: bot.lifecycleState, presence: bot.presenceState, movement: bot.movementState, emotion: bot.emotionState, diagnostics: bot.diagnostics, changes, reactions, errors };
  });
  await writeFile(join(directory, `${name}.json`), JSON.stringify(state, null, 2));
  await page.screenshot({ path: join(directory, `${name}.png`) });
}

for (const backend of ['worker', 'main']) test(`declarative lifecycle renders home, work, success, inertial return and rest (${backend})`, async t => {
  const page = await pageFor(t, { backend, reducedMotion: 'no-preference' });
  await page.evaluate(() => {
    const { bot } = window.lifecycleFixture;
    window.initialCanvas = bot.shadowRoot.querySelector('canvas');
    window.initialGeneration = bot.diagnostics.generation;
    window.setHome();
  });
  await phase(page, 'resting');
  await evidence(page, `lifecycle-${backend}-01-home`);
  await page.evaluate(() => window.setTask('report-1'));
  await acting(page);
  await evidence(page, `lifecycle-${backend}-02-work`);
  const work = await page.evaluate(() => {
    const { bot, work } = window.lifecycleFixture, a = bot.getBoundingClientRect(), b = work.getBoundingClientRect();
    return { position: bot.position, gap: b.left - a.right, cross: (a.top + a.height / 2) - (b.top + b.height / 2), phase: bot.lifecycleState.phase };
  });
  assert.ok(Math.abs(work.gap - 28) < 1 && Math.abs(work.cross) < 1, JSON.stringify(work));
  await page.waitForTimeout(250);
  assert.equal(await page.evaluate(() => window.lifecycleFixture.bot.task.status), 'pending');
  await page.evaluate(() => { window.successAt = performance.now(); window.setTask('report-1', 'success'); });
  await phase(page, 'reacting');
  assert.equal(await page.evaluate(() => window.lifecycleFixture.bot.emotionState.emotion), 'happy');
  await evidence(page, `lifecycle-${backend}-03-reaction`);
  await phase(page, 'returning');
  await page.waitForFunction(() => window.lifecycleFixture.bot.movementState.speed > 20);
  await evidence(page, `lifecycle-${backend}-04-return`);
  const returning = await page.evaluate(() => ({ position: window.lifecycleFixture.bot.position, movement: window.lifecycleFixture.bot.movementState }));
  assert.notDeepEqual(returning.position, work.position);
  assert.ok(returning.movement.speed > 0);
  await phase(page, 'resting');
  await evidence(page, `lifecycle-${backend}-05-rest`);
  const result = await page.evaluate(() => {
    const { bot, home, reactions, errors, changes } = window.lifecycleFixture;
    const a = bot.getBoundingClientRect(), b = home.getBoundingClientRect();
    return { gap: b.top - a.bottom, cross: a.left + a.width / 2 - b.left - b.width / 2,
      reactionDuration: reactions[0].time - window.successAt, reactions, errors, phases: changes.map(change => change.phase),
      sameCanvas: window.initialCanvas === bot.shadowRoot.querySelector('canvas'), sameGeneration: window.initialGeneration === bot.diagnostics.generation,
      emotion: bot.emotion, intensity: bot.emotionIntensity, tracking: bot.trackingMode, taskStatus: bot.task.status };
  });
  assert.ok(Math.abs(result.gap - 18) < 1 && Math.abs(result.cross) < 1, JSON.stringify(result));
  assert.ok(result.reactionDuration >= 950, 'default happy reaction must not be cut short');
  assert.equal(result.reactions.length, 1); assert.equal(result.reactions[0].finished, true);
  assert.equal(result.sameCanvas, true); assert.equal(result.sameGeneration, true);
  assert.equal(result.emotion, 'curious'); assert.equal(result.intensity, .45); assert.equal(result.tracking, 'eyes');
  assert.equal(result.taskStatus, 'success'); assert.deepEqual(result.errors, []);
});

test('new work retargets an in-flight return continuously and equal declarations do not replay', async t => {
  const page = await pageFor(t, { reducedMotion: 'no-preference' }); await setupWork(page);
  await page.evaluate(() => window.setTask('report-1', 'cancelled'));
  await phase(page, 'returning');
  await page.waitForFunction(() => window.lifecycleFixture.bot.movementState.speed > 100);
  const result = await page.evaluate(async () => {
    const { bot } = window.lifecycleFixture;
    const before = bot.movementState;
    window.setTask('report-2');
    for (let i = 0; i < 20; i++) await Promise.resolve();
    const after = bot.movementState;
    const id = bot.behaviorState.id, count = window.lifecycleFixture.changes.length;
    window.setTask('report-2'); window.setHome();
    for (let i = 0; i < 20; i++) await Promise.resolve();
    return { before, after, id, nextId: bot.behaviorState.id, count, nextCount: window.lifecycleFixture.changes.length };
  });
  assert.ok(Math.hypot(result.after.position.x - result.before.position.x, result.after.position.y - result.before.position.y) < 5);
  assert.ok(Math.hypot(result.after.velocity.x - result.before.velocity.x, result.after.velocity.y - result.before.velocity.y) < 35);
  assert.equal(result.nextId, result.id); assert.equal(result.nextCount, result.count);
  await acting(page);
  assert.equal(await page.evaluate(() => window.lifecycleFixture.bot.lifecycleState.taskId), 'report-2');
  await evidence(page, 'lifecycle-interrupted-return');
});

test('error remains at work by default, and configured error return uses the requested reaction', async t => {
  const page = await pageFor(t); await setupWork(page);
  const point = await page.evaluate(() => window.lifecycleFixture.bot.position);
  await page.evaluate(() => window.setTask('report-1', 'error'));
  await phase(page, 'reacting');
  assert.equal(await page.evaluate(() => window.lifecycleFixture.bot.emotionState.emotion), 'sad');
  await phase(page, 'settled');
  assert.deepEqual(await page.evaluate(() => window.lifecycleFixture.bot.position), point);
  await evidence(page, 'lifecycle-error-stays');
  await page.evaluate(() => { window.setHome(['success', 'error', 'cancelled']); window.setTask('retry-2'); });
  await acting(page);
  await page.evaluate(() => window.setTask('retry-2', 'error', { emotion: 'concerned', duration: 60, intensity: .7 }));
  await phase(page, 'resting');
  assert.equal(await page.evaluate(() => window.lifecycleFixture.bot.task.status), 'error');
  assert.deepEqual(await page.evaluate(() => window.lifecycleFixture.reactions.map(result => result.emotion)), ['sad', 'concerned']);
});

test('hidden declarations suppress new work and suspend rendering until visibility is restored', async t => {
  const page = await pageFor(t); await setupWork(page);
  await page.evaluate(() => { window.lifecycleFixture.bot.presence = { visible: false, exit: { to: 'right' } }; });
  await phase(page, 'hidden');
  await page.waitForTimeout(100);
  const before = await page.evaluate(() => window.lifecycleFixture.bot.diagnostics.frames);
  await page.evaluate(() => window.setTask('hidden-request'));
  await page.waitForTimeout(160);
  const result = await page.evaluate(() => { const { bot } = window.lifecycleFixture; return { phase: bot.lifecycleState.phase, visibility: getComputedStyle(bot).visibility, frames: bot.diagnostics.frames, running: bot.diagnostics.running }; });
  assert.equal(result.phase, 'hidden'); assert.equal(result.visibility, 'hidden');
  assert.equal(result.frames, before); assert.equal(result.running, false);
  await evidence(page, 'lifecycle-hidden');
  await page.evaluate(() => { window.lifecycleFixture.bot.presence = { visible: true, entrance: { source: 'viewport', edge: 'left' } }; });
  await acting(page);
  assert.equal(await page.evaluate(() => window.lifecycleFixture.bot.lifecycleState.taskId), 'hidden-request');
  assert.equal(await page.evaluate(() => getComputedStyle(window.lifecycleFixture.bot).visibility), 'visible');
});

test('rest follows layout changes; removing its target reports a safe single failure', async t => {
  const page = await pageFor(t);
  await page.evaluate(() => window.setHome()); await phase(page, 'resting');
  await page.evaluate(() => { window.lifecycleFixture.home.style.left = '180px'; window.dispatchEvent(new Event('resize')); });
  await page.waitForFunction(() => Math.abs(window.lifecycleFixture.bot.position.x - 230) < .5);
  const safe = await page.evaluate(() => window.lifecycleFixture.bot.position);
  await page.evaluate(() => window.lifecycleFixture.home.remove());
  await page.waitForFunction(() => window.lifecycleFixture.errors.length === 1);
  await page.waitForTimeout(400);
  const result = await page.evaluate(() => ({ errors: window.lifecycleFixture.errors, position: window.lifecycleFixture.bot.position, phase: window.lifecycleFixture.bot.lifecycleState.phase }));
  assert.equal(result.errors.length, 1); assert.deepEqual(result.position, safe); assert.equal(result.phase, 'error');
  assert.match(result.errors[0].message, /target|disconnect|removed/i);
  await evidence(page, 'lifecycle-home-target-removed');
});

test('reentrant lifecycle listeners and disconnect cannot revive an obsolete terminal reaction', async t => {
  const page = await pageFor(t); await setupWork(page);
  await page.evaluate(() => {
    const { bot } = window.lifecycleFixture;
    let replaced = false;
    bot.addEventListener('sidekick-lifecycle-change', event => {
      if (event.detail.phase === 'returning' && !replaced) { replaced = true; window.setTask('listener-task'); }
    });
    window.setTask('report-1', 'cancelled');
  });
  await page.waitForFunction(() => window.lifecycleFixture.bot.lifecycleState.taskId === 'listener-task' && window.lifecycleFixture.bot.behaviorState.status === 'acting');
  await page.evaluate(() => window.setTask('listener-task', 'success'));
  await phase(page, 'reacting');
  const result = await page.evaluate(async () => {
    const { bot, reactions, changes } = window.lifecycleFixture;
    bot.remove();
    const position = bot.position, count = changes.length;
    await new Promise(resolve => setTimeout(resolve, 1300));
    return { position, after: bot.position, count, afterCount: changes.length, state: bot.lifecycleState, reacting: bot.emotionState.reacting, reactions, backend: bot.diagnostics.backend };
  });
  assert.deepEqual(result.after, result.position); assert.equal(result.afterCount, result.count);
  assert.equal(result.state.phase, 'suspended'); assert.equal(result.reacting, false); assert.equal(result.backend, 'none');
  assert.equal(result.reactions.length, 1); assert.equal(result.reactions[0].finished, false);
});

test('losing the work target reports an error while the application task stays pending', async t => {
  const page = await pageFor(t); await setupWork(page);
  const safe = await page.evaluate(() => window.lifecycleFixture.bot.position);
  await page.evaluate(() => window.lifecycleFixture.work.remove());
  await phase(page, 'error');
  await page.waitForTimeout(350);
  const result = await page.evaluate(() => { const { bot, errors } = window.lifecycleFixture; return { position: bot.position, task: bot.task.status, errors, anchored: bot.elementAnchor !== null }; });
  assert.deepEqual(result.position, safe); assert.equal(result.task, 'pending'); assert.equal(result.anchored, false);
  assert.equal(result.errors.length, 1); assert.match(result.errors[0].message, /target.*removed/i);
  await evidence(page, 'lifecycle-work-target-removed');
});

test('finite rest behavior retains target gaze and home follow without taking over locomotion', async t => {
  const page = await pageFor(t);
  await page.evaluate(() => {
    const { bot, home, work } = window.lifecycleFixture;
    bot.home = { positioning: { target: home, placement: 'top-center', gap: 18 }, rest: { behavior: { type: 'celebrate', duration: 350 }, gaze: { target: work }, emotion: 'happy' } };
    bot.addEventListener('sidekick-behavior-end', event => {
      if (event.detail.status === 'completed') window.restEnd = { yaw: bot.bodyOrientation.yaw, tracking: bot.trackingMode, position: bot.position };
    });
  });
  await phase(page, 'resting');
  await page.waitForFunction(() => window.restEnd);
  const before = await page.evaluate(() => window.restEnd);
  assert.ok(before.yaw > 0, 'completing the rest animation cannot restore stale gaze');
  assert.equal(before.tracking, 'off');
  await page.evaluate(() => { window.lifecycleFixture.home.style.left = '180px'; window.dispatchEvent(new Event('resize')); });
  await page.waitForFunction(() => Math.abs(window.lifecycleFixture.bot.position.x - 230) < .5);
  await evidence(page, 'lifecycle-rest-gaze');
});

async function guidePage(t, framework) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  t.after(async () => { await page.close(); assert.deepEqual(errors, [], 'built guide must not produce browser errors'); });
  await page.goto(`${base}/guide.html?lang=en&framework=${framework}#state-lifecycle`);
  await page.waitForSelector('[data-state-reference][data-configured]');
  await page.locator('.state-lab iframe').scrollIntoViewIfNeeded();
  const frame = page.frames().find(frame => frame.url().includes('/state-preview.html'));
  assert.ok(frame, 'the built guide exposes its real preview');
  await frame.waitForFunction(() => document.getElementById('reference-bot')?.ready);
  await frame.waitForFunction(() => document.getElementById('reference-bot').lifecycleState.phase === 'resting');
  return { page, frame };
}
for (const framework of ['element', 'react']) test(`copied lifecycle ${framework} example runs the same pending/success/return flow`, async t => {
  const { page } = await guidePage(t, framework);
  const source = await page.locator('[data-state-source]').textContent();
  assert.match(source, /installLifecycleExample/);
  assert.doesNotMatch(source, /bot\.(?:moveTo|moveToElement|enter|exit|reactTo)\(/, 'the copied app must only declare lifecycle intent');
  const replay = await browser.newPage({ viewport: { width: 500, height: 700 }, reducedMotion: 'reduce' });
  const errors = [];
  replay.on('pageerror', error => errors.push(error.message));
  t.after(async () => { await replay.close(); assert.deepEqual(errors, [], 'copied source must run without browser errors'); });
  // Point only the installation URL at this build; run the actual copied app unchanged.
  let html = source;
  if (framework === 'element') {
    html = source.replace(/import ['"](?:@hanana-kick\/sidekick\/auto|https:\/\/cdn\.jsdelivr\.net\/gh\/hanana-kick\/sidekick@v[^/'"]+\/dist\/browser\/sidekick\.js)['"];?/, "import '/browser/sidekick.js';");
    assert.notEqual(html, source, 'the copied HTML has a recognized installation URL');
  }
  if (framework === 'react') {
    const output = ts.transpileModule(`import React from 'react';\nimport { createRoot } from 'react-dom/client';\n${source}\ncreateRoot(document.getElementById('root')).render(<React.StrictMode><LifecycleExample /></React.StrictMode>);`, {
      compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const imports = { react: '/lifecycle-peers/react.js', 'react-dom/client': '/lifecycle-peers/react-dom-client.js', '@hanana-kick/sidekick/react': '/browser/sidekick-react.js' };
    for (const name of ['react', 'react-dom-client']) await replay.route(`${base}/lifecycle-peers/${name}.js`, async route => route.fulfill({
      contentType: 'text/javascript', body: await readFile(new URL(`../cdn/react-19.3.1/${name}.js`, import.meta.url), 'utf8'),
    }));
    html = `<!doctype html><div id="root"></div><script type="importmap">${JSON.stringify({ imports })}</script><script type="module">${output}</script>`;
  }
  await replay.route(`${base}/lifecycle-copy.html`, route => route.fulfill({ contentType: 'text/html', body: html }));
  await replay.goto(`${base}/lifecycle-copy.html`);
  await replay.waitForFunction(() => document.getElementById('reference-bot')?.ready && document.getElementById('reference-bot').lifecycleState.phase === 'resting');
  await replay.locator('[data-lifecycle-action="wait"]').click();
  await replay.waitForFunction(() => { const bot = document.getElementById('reference-bot'); return bot.task?.status === 'pending' && bot.behaviorState.status === 'acting'; });
  assert.equal(await replay.locator('#lifecycle-app-status').textContent(), 'Pending');
  await replay.locator('[data-lifecycle-action="success"]').click();
  await replay.waitForFunction(() => document.getElementById('reference-bot').lifecycleState.phase === 'resting' && document.getElementById('reference-bot').task.status === 'success');
  assert.equal(await replay.locator('#lifecycle-app-status').textContent(), 'Succeeded');
  if (process.env.SIDEKICK_SCREENSHOTS) {
    await mkdir(process.env.SIDEKICK_SCREENSHOTS, { recursive: true });
    await replay.screenshot({ path: join(process.env.SIDEKICK_SCREENSHOTS, `lifecycle-copy-${framework}.png`) });
  }
});
