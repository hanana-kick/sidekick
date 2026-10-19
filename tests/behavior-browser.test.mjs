import nodeTest, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { createAppServer } from '../scripts/serve.mjs';

let browser, server, base;
const test = (name, run) => nodeTest(name, { timeout: 30000 }, run);
before(async () => {
  server = createAppServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
    headless: process.env.SIDEKICK_HEADED !== '1',
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
  });
});
after(async () => {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
});

async function pageFor(t, options = {}) {
  const { fallback = false, ...pageOptions } = options;
  const page = await browser.newPage({ viewport: { width: 1000, height: 760 }, reducedMotion: 'reduce', ...pageOptions });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  t.after(async () => { await page.close(); assert.deepEqual(errors, [], 'The behavior must not produce browser errors'); });
  if (fallback) await page.addInitScript(() => { window.Worker = undefined; });
  await page.route('**/behavior-fixture.html', route => route.fulfill({
    contentType: 'text/html',
    body: `<!doctype html><meta charset="utf-8"><style>
      body { margin: 0; min-height: 1500px; }
      sidekick-avatar { width: 120px; height: 120px; }
      .item { position: absolute; left: 400px; width: 180px; height: 80px; }
      #one { top: 150px; } #two { top: 300px; } #three { top: 450px; }
    </style><div id="one" class="item">One</div><div id="two" class="item">Two</div><div id="three" class="item">Three</div>
    <sidekick-avatar id="bot" placement="viewport" movement-bounds="none" tracking-mode="off"></sidekick-avatar>
    <script type="module">import '/browser/sidekick.js';</script>`,
  }));
  await page.goto(`${base}/behavior-fixture.html`);
  await page.waitForFunction(() => document.getElementById('bot')?.ready === true);
  return page;
}

for (const fallback of [false, true]) test(`persistent behavior composes movement, gaze, and activity then restores authored state (${fallback ? 'main' : 'worker'})`, async t => {
  const page = await pageFor(t, { fallback });
  const result = await page.evaluate(async () => {
    const bot = document.getElementById('bot'), target = document.getElementById('one');
    const frames = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    bot.setActivity('still'); bot.trackingMode = 'eyes-and-body'; bot.bodyOrientation = { yaw: 13, pitch: 8, roll: -7 };
    bot.lookAt({ space: 'view', x: 0.2, y: -0.3 });
    await bot.setExpression('both', 'smile', { duration: 0 });
    const before = { activity: bot.activity, tracking: bot.trackingMode, orientation: bot.bodyOrientation, design: bot.design };
    const canvas = bot.shadowRoot.querySelector('canvas'), generation = bot.diagnostics.generation;
    const ends = []; bot.addEventListener('sidekick-behavior-end', event => ends.push(event.detail));
    const pending = bot.perform({ type: 'wait', target, side: 'left', gap: 24 });
    while (bot.behaviorState.status !== 'acting') await frames();
    await frames();
    const active = { state: bot.behaviorState, activity: bot.activity, tracking: bot.trackingMode, orientation: bot.bodyOrientation, anchored: bot.elementAnchor?.target === target };
    target.style.left = '470px'; await frames();
    const b = bot.getBoundingClientRect(), r = target.getBoundingClientRect();
    const alignment = Math.max(Math.abs(r.left - b.right - 24), Math.abs(b.top + b.height / 2 - r.top - r.height / 2));
    bot.stopBehavior(); const settled = await pending; await frames();
    const stoppedPosition = bot.position;
    target.style.left = '600px'; await frames();
    return { before, active, alignment, settled, ends,
      after: { activity: bot.activity, tracking: bot.trackingMode, orientation: bot.bodyOrientation, design: bot.design },
      detached: bot.elementAnchor === null, noResidualMovement: JSON.stringify(stoppedPosition) === JSON.stringify(bot.position),
      sameCanvas: canvas === bot.shadowRoot.querySelector('canvas'), generationUnchanged: generation === bot.diagnostics.generation,
      backend: bot.diagnostics.backend,
    };
  });
  assert.equal(result.active.state.status, 'acting'); assert.equal(result.active.activity, 'thinking');
  assert.equal(result.active.tracking, 'off'); assert.equal(result.active.anchored, true);
  assert.ok(result.active.orientation.yaw > 0, JSON.stringify(result.active));
  assert.ok(result.alignment < 0.5, JSON.stringify(result));
  assert.equal(result.settled.status, 'cancelled'); assert.equal(result.settled.reason, 'stopped');
  assert.equal(result.ends.length, 1); assert.deepEqual(result.after, result.before);
  assert.equal(result.detached, true); assert.equal(result.noResidualMovement, true);
  assert.equal(result.sameCanvas, true); assert.equal(result.generationUnchanged, true);
  assert.equal(result.backend, fallback ? 'main' : 'worker');
});

test('all four declared sides use the actual border box and a CSS-pixel gap', async t => {
  const page = await pageFor(t);
  const result = await page.evaluate(async () => {
    const bot = document.getElementById('bot'), target = document.getElementById('two'), cases = [];
    for (const side of ['left', 'right', 'above', 'below']) {
      const result = await bot.perform({ type: 'guide', target, side, gap: 19, duration: 0 });
      const b = bot.getBoundingClientRect(), r = target.getBoundingClientRect();
      const gap = side === 'left' ? r.left - b.right : side === 'right' ? b.left - r.right : side === 'above' ? r.top - b.bottom : b.top - r.bottom;
      const cross = side === 'left' || side === 'right' ? b.top + b.height / 2 - r.top - r.height / 2 : b.left + b.width / 2 - r.left - r.width / 2;
      cases.push({ side, result, gap, cross });
    }
    return cases;
  });
  for (const item of result) {
    assert.equal(item.result.status, 'completed'); assert.equal(item.result.completedItems, 1);
    assert.ok(Math.abs(item.gap - 19) < 0.5 && Math.abs(item.cross) < 0.5, JSON.stringify(item));
  }
});

test('review keeps its original target order and skips removed items despite live DOM reordering', async t => {
  const page = await pageFor(t);
  const result = await page.evaluate(async () => {
    const bot = document.getElementById('bot'), visited = [], ends = [];
    bot.addEventListener('sidekick-behavior-end', event => ends.push(event.detail));
    bot.addEventListener('sidekick-behavior-change', event => {
      const state = event.detail;
      if (state.status !== 'moving') return;
      visited.push({ index: state.itemIndex, count: state.itemCount });
      if (state.itemIndex === 0) {
        document.body.prepend(document.getElementById('three'));
        document.getElementById('two').remove();
        const extra = document.createElement('div'); extra.id = 'four'; extra.className = 'item'; document.body.append(extra);
      }
    });
    const result = await bot.perform({ type: 'review', targets: '.item', side: 'right', dwell: 20 });
    const b = bot.getBoundingClientRect(), r = document.getElementById('three').getBoundingClientRect();
    return { result, visited, ends, gap: b.left - r.right, anchor: bot.elementAnchor, declaration: bot.behavior };
  });
  assert.deepEqual(result.visited, [{ index: 0, count: 3 }, { index: 2, count: 3 }]);
  assert.equal(result.result.status, 'completed'); assert.equal(result.result.completedItems, 2);
  assert.equal(result.ends.length, 1); assert.ok(Math.abs(result.gap - 16) < 0.5);
  assert.equal(result.anchor, null); assert.equal(result.declaration, null);
});

test('a target removed while waiting ends once, and a lost review item does not count as reviewed', async t => {
  const page = await pageFor(t);
  const result = await page.evaluate(async () => {
    const bot = document.getElementById('bot'), ends = [];
    bot.addEventListener('sidekick-behavior-end', event => ends.push(event.detail));
    const wait = bot.perform({ type: 'wait', target: '#one' });
    while (bot.behaviorState.status !== 'acting') await new Promise(resolve => requestAnimationFrame(resolve));
    document.getElementById('one').remove();
    const lost = await wait;
    const review = bot.perform({ type: 'review', targets: '.item', dwell: 80 });
    while (bot.behaviorState.status !== 'acting') await new Promise(resolve => requestAnimationFrame(resolve));
    document.getElementById('two').remove();
    const reviewed = await review;
    return { lost, reviewed, ends, detached: bot.elementAnchor === null };
  });
  assert.equal(result.lost.status, 'error'); assert.match(result.lost.reason, /removed/i);
  assert.equal(result.reviewed.status, 'completed'); assert.equal(result.reviewed.completedItems, 1);
  assert.equal(result.ends.length, 2); assert.equal(result.detached, true);
});

test('late selectors resolve, timeout is bounded, and abort prevents a stale late-target restart', async t => {
  const page = await pageFor(t);
  const result = await page.evaluate(async () => {
    const bot = document.getElementById('bot'), ends = [];
    bot.addEventListener('sidekick-behavior-end', event => ends.push(event.detail));
    const late = bot.perform({ type: 'guide', target: '#late', duration: 0, timeout: 1000 });
    const resolving = bot.behaviorState.status;
    const target = document.createElement('div'); target.id = 'late'; target.style.cssText = 'position:absolute;left:300px;top:300px;width:90px;height:70px';
    setTimeout(() => document.body.append(target), 20);
    const found = await late;
    const before = performance.now();
    const timeout = await bot.perform({ type: 'wait', target: '#missing', timeout: 30 });
    const elapsed = performance.now() - before;
    const abort = new AbortController();
    const pending = bot.perform({ type: 'follow', target: '#aborted', timeout: 1000 }, { signal: abort.signal });
    abort.abort(); const aborted = await pending;
    const position = bot.position;
    target.id = 'aborted'; target.style.left = '700px';
    await new Promise(resolve => setTimeout(resolve, 70));
    return { resolving, found, timeout, elapsed, aborted, ends, positionUnchanged: JSON.stringify(position) === JSON.stringify(bot.position), state: bot.behaviorState, detached: bot.elementAnchor === null };
  });
  assert.equal(result.resolving, 'resolving'); assert.equal(result.found.status, 'completed');
  assert.equal(result.timeout.status, 'error'); assert.match(result.timeout.reason, /timeout/i);
  assert.ok(result.elapsed >= 20 && result.elapsed < 1500, JSON.stringify(result));
  assert.equal(result.aborted.reason, 'aborted'); assert.equal(result.ends.length, 3);
  assert.equal(result.positionUnchanged, true); assert.equal(result.detached, true); assert.equal(result.state.status, 'cancelled');
});

test('invalid declarations and invalid low-level commands leave a live behavior in place; valid overrides cancel it', async t => {
  const page = await pageFor(t);
  const result = await page.evaluate(async () => {
    const bot = document.getElementById('bot');
    const pending = bot.perform({ type: 'follow', target: '#one' });
    while (bot.behaviorState.status !== 'acting') await new Promise(resolve => requestAnimationFrame(resolve));
    const id = bot.behaviorState.id;
    let rejected = 0;
    for (const invoke of [
      () => bot.perform({ type: 'follow', target: '#one', gap: -1 }),
      () => bot.moveTo({ x: NaN, y: 0 }),
      () => bot.setActivity('unknown'),
      () => bot.setBodyOrientation({ yaw: Infinity }),
    ]) { try { invoke(); } catch { rejected++; } }
    const unchanged = bot.behaviorState.id === id && bot.behaviorState.status === 'acting' && bot.elementAnchor !== null;
    await bot.moveTo({ x: 33, y: 55 }, { duration: 0 });
    const interrupted = await pending;
    const replacement = bot.perform({ type: 'wait', target: '#two' });
    while (bot.behaviorState.status !== 'acting') await new Promise(resolve => requestAnimationFrame(resolve));
    await bot.setExpression('both', 'blink', { duration: 0 });
    const expression = await replacement;
    return { rejected, unchanged, interrupted, expression, position: bot.position, weights: bot.design.eyes.left.weights, detached: bot.elementAnchor === null };
  });
  assert.equal(result.rejected, 4); assert.equal(result.unchanged, true);
  assert.equal(result.interrupted.reason, 'manual-command'); assert.equal(result.expression.reason, 'manual-command');
  assert.equal(result.weights.blink, 1); assert.equal(result.detached, true);
});

test('the property and JSON attribute share validation and a malformed attribute batch is atomic', async t => {
  const page = await pageFor(t);
  const result = await page.evaluate(async () => {
    const bot = document.getElementById('bot'), errors = [], ends = [];
    bot.addEventListener('sidekick-error', event => errors.push(event.detail));
    bot.addEventListener('sidekick-behavior-end', event => ends.push(event.detail));
    bot.behavior = { type: 'idle' };
    const propertyId = bot.behaviorState.id;
    bot.setAttribute('behavior', JSON.stringify({ type: 'wait', target: '#one', side: 'below' }));
    await Promise.resolve();
    while (bot.behaviorState.status !== 'acting') await new Promise(resolve => requestAnimationFrame(resolve));
    const attribute = bot.behavior, attributeId = bot.behaviorState.id, shape = bot.design.body.shape;
    bot.setAttribute('shape', 'heart'); bot.setAttribute('behavior', '{invalid'); await Promise.resolve();
    const atomic = bot.behaviorState.id === attributeId && bot.behaviorState.status === 'acting' && bot.design.body.shape === shape;
    bot.behavior = null;
    return { propertyId, attributeId, attribute, atomic, errors, ends, stopped: bot.behavior === null && bot.behaviorState.status === 'cancelled' };
  });
  assert.ok(result.attributeId > result.propertyId); assert.equal(result.attribute.type, 'wait'); assert.equal(result.attribute.side, 'below');
  assert.equal(result.atomic, true); assert.equal(result.errors.length, 1); assert.equal(result.ends.length, 2); assert.equal(result.stopped, true);
});

test('disconnect settles in-flight movement and leaves no behavior anchor after reconnect', async t => {
  const page = await pageFor(t, { reducedMotion: 'no-preference' });
  const result = await page.evaluate(async () => {
    const bot = document.getElementById('bot'), ends = [];
    bot.addEventListener('sidekick-behavior-end', event => ends.push(event.detail));
    const pending = bot.perform({ type: 'review', targets: '.item', dwell: 20 });
    await new Promise(resolve => setTimeout(resolve, 70));
    const moving = bot.behaviorState.status;
    bot.remove(); const result = await pending;
    document.body.append(bot);
    await new Promise(resolve => setTimeout(resolve, 100));
    return { moving, result, ends, state: bot.behaviorState, declaration: bot.behavior, anchor: bot.elementAnchor };
  });
  assert.equal(result.moving, 'moving'); assert.equal(result.result.status, 'cancelled'); assert.equal(result.result.reason, 'disconnected');
  assert.equal(result.ends.length, 1); assert.equal(result.state.status, 'cancelled'); assert.equal(result.declaration, null); assert.equal(result.anchor, null);
});

test('playback cancellation listeners cannot let an older behavior overwrite a newer intent', async t => {
  const page = await pageFor(t);
  const result = await page.evaluate(async () => {
    const bot = document.getElementById('bot');
    const play = bot.play('thinking');
    let nested;
    bot.addEventListener('sidekick-play-end', () => { nested = bot.perform({ type: 'celebrate', duration: 10000 }); }, { once: true });
    const outer = bot.perform({ type: 'error', duration: 10000 });
    const outerResult = await outer;
    const active = { state: bot.behaviorState, declaration: bot.behavior, activity: bot.activity };
    bot.stopBehavior();
    return { outerResult, active, nested: await nested, play: await play };
  });
  assert.equal(result.outerResult.status, 'cancelled'); assert.equal(result.active.declaration.type, 'celebrate');
  assert.equal(result.active.state.type, 'celebrate'); assert.equal(result.active.state.status, 'acting');
  assert.equal(result.active.activity, 'celebrating'); assert.equal(result.nested.status, 'cancelled'); assert.equal(result.play.finished, false);
});

test('declarations assigned before connection start once on append for both properties and HTML', async t => {
  const page = await pageFor(t);
  const result = await page.evaluate(async () => {
    const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
    const property = document.createElement('sidekick-avatar');
    property.placement = 'viewport'; property.movementBounds = 'none';
    const declaration = { type: 'wait', target: '#one', side: 'above' };
    const propertyEnds = []; property.addEventListener('sidekick-behavior-end', event => propertyEnds.push(event.detail));
    property.behavior = declaration;
    declaration.target = '#missing';
    const pendingCopy = property.behavior;
    try { pendingCopy.side = 'below'; } catch { /* Frozen independent snapshots are also valid. */ }
    const before = { declaration: property.behavior, status: property.behaviorState.status, ends: propertyEnds.length };
    document.body.append(property);
    while (property.behaviorState.status !== 'acting') await frame();
    const activeProperty = { declaration: property.behavior, target: property.elementAnchor?.target.id, state: property.behaviorState };
    property.stopBehavior(); property.remove();
    const holder = document.createElement('div');
    holder.innerHTML = `<sidekick-avatar placement="viewport" movement-bounds="none" behavior='{"type":"guide","target":"#two","side":"below"}'></sidekick-avatar>`;
    const html = holder.firstElementChild, htmlEnds = [];
    html.addEventListener('sidekick-behavior-end', event => htmlEnds.push(event.detail));
    await Promise.resolve();
    document.body.append(html);
    while (html.behaviorState.status !== 'acting') await frame();
    const activeHtml = { declaration: html.behavior, target: html.elementAnchor?.target.id, state: html.behaviorState };
    html.stopBehavior(); html.remove();
    return { before, activeProperty, activeHtml, propertyEnds, htmlEnds };
  });
  assert.equal(result.before.ends, 0); assert.equal(result.before.declaration.target, '#one'); assert.equal(result.before.declaration.side, 'above');
  assert.equal(result.activeProperty.target, 'one'); assert.equal(result.activeProperty.state.status, 'acting');
  assert.equal(result.activeHtml.target, 'two'); assert.equal(result.activeHtml.declaration.side, 'below');
  assert.equal(result.propertyEnds.length, 1); assert.equal(result.htmlEnds.length, 1);
  assert.equal(result.propertyEnds[0].reason, 'stopped'); assert.equal(result.htmlEnds[0].reason, 'stopped');
});
