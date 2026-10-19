import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { createAppServer } from '../scripts/serve.mjs';
let browser, server, base;
before(async () => {
  server = createAppServer(); await new Promise(r => server.listen(0, '127.0.0.1', r)); base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), headless: process.env.SIDEKICK_HEADED !== '1', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
});
after(async () => { await browser?.close(); if (server) await new Promise(r => server.close(r)); });
async function fixture(t, options = {}) {
  const directory = process.env.SIDEKICK_SCREENSHOTS;
  if (directory) await mkdir(directory, { recursive: true });
  const context = await browser.newContext({ locale: 'ko-KR', viewport: { width: 900, height: 650 }, ...(directory ? { recordVideo: { dir: directory, size: { width: 900, height: 650 } } } : {}), ...options });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message)); t.after(async () => { await context.close(); if (directory && page.video()) await page.video().saveAs(`${directory}/${t.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.webm`); assert.deepEqual(errors, []); });
  await page.route('**/flight-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body style="margin:0;background:#f8fafc"></body></html>' }));
  await page.goto(base + '/flight-test.html');
  await page.evaluate(async () => {
    await import('./browser/sidekick.js');
    document.body.innerHTML = '<sidekick-avatar id="flight-bot" placement="viewport" shape="ghostish" head-accessory="beret" eyes-accessory="glasses" neck-accessory="bowTie" activity="still" style="width:200px;height:200px"></sidekick-avatar>';
    window.bot = document.getElementById('flight-bot'); await new Promise(r => bot.ready ? r() : bot.addEventListener('sidekick-ready', r, { once: true })); await bot.moveTo({ x: 50, y: 250 }, { duration: 0 });
    window.trace = [];
    bot.addEventListener('sidekick-move-progress', e => trace.push({ time: performance.now(), ...e.detail }));
  });
  return page;
}
async function saveTrace(page, name) {
  if (process.env.SIDEKICK_SCREENSHOTS) await writeFile(`${process.env.SIDEKICK_SCREENSHOTS}/${name}-trace.json`, JSON.stringify(await page.evaluate(() => trace), null, 2));
}
for (const fallback of [false, true]) test(`inertial flight, velocity-continuous retarget and baseline (${fallback ? 'fallback' : 'worker'})`, async t => {
  const page = await fixture(t);
  if (fallback) {
    await page.evaluate(() => { bot.remove(); Object.defineProperty(HTMLCanvasElement.prototype, 'transferControlToOffscreen', { value: undefined, configurable: true }); document.body.append(bot); });
    await page.waitForFunction(() => bot.ready);
  }
  const initial = await page.evaluate(async () => {
    window.events = []; bot.addEventListener('sidekick-move-end', e => events.push(e.detail)); const p = await bot.capturePixelsAsync();
    window.flight = bot.moveTo({ x: 600, y: 150 }, { maxSpeed: 300, acceleration: 600, deceleration: 800 });
    return { width: p.width, height: p.height, design: bot.design, bodyOrientation: bot.bodyOrientation, zoom: bot.zoom, generation: bot.diagnostics.generation };
  });
  await page.waitForFunction(() => bot.movementState.phase === 'flight' && bot.movementState.speed >= 290);
  const flying = await page.evaluate(async () => { await bot.capturePixelsAsync(); return { state: bot.movementState, diagnostics: bot.diagnostics, activity: bot.activity }; });
  assert.ok(flying.state.velocity.x > 0); assert.ok(flying.state.velocity.y < 0); assert.equal(flying.activity, 'still');
  assert.ok(flying.diagnostics.travel.strength > 0); assert.ok(flying.diagnostics.travel.direction[0] > .5); assert.ok(Math.abs(flying.diagnostics.travel.bank) <= .12);
  assert.ok(Number.isFinite(flying.state.acceleration.x)); assert.ok(flying.state.speed <= 300 + 1e-6);
  if (process.env.SIDEKICK_SCREENSHOTS) await page.screenshot({ path: `${process.env.SIDEKICK_SCREENSHOTS}/flight-${fallback ? 'fallback' : 'worker'}-right.png` });
  const retarget = await page.evaluate(() => {
    const before = bot.movementState;
    window.second = bot.moveTo({ x: 80, y: 380 }, { maxSpeed: 300, acceleration: 600, deceleration: 800 });
    return { before, after: bot.movementState };
  });
  assert.ok(retarget.after.velocity.x > 0, 'retarget keeps rightward momentum before reversing');
  assert.ok(Math.abs(retarget.after.speed - retarget.before.speed) < 20, 'no velocity reset at retarget');
  assert.equal(await page.evaluate(async () => (await flight).finished), false);
  await page.waitForFunction(() => bot.movementState.velocity.x < -100);
  if (process.env.SIDEKICK_SCREENSHOTS) await page.screenshot({ path: `${process.env.SIDEKICK_SCREENSHOTS}/flight-${fallback ? 'fallback' : 'worker'}-left.png` });
  const final = await page.evaluate(async () => {
    const result = await second, pixels = await bot.capturePixelsAsync();
    return { result, state: bot.movementState, design: bot.design, bodyOrientation: bot.bodyOrientation, zoom: bot.zoom, width: pixels.width, height: pixels.height, events, travel: bot.diagnostics.travel, generation: bot.diagnostics.generation };
  });
  assert.deepEqual(final.result, { finished: true, position: { x: 80, y: 380 } }); assert.equal(final.state.phase, 'idle'); assert.equal(final.state.speed, 0);
  assert.deepEqual(final.state.acceleration, { x: 0, y: 0 }); assert.equal(final.travel.strength, 0);
  assert.deepEqual(final.design, initial.design); assert.deepEqual(final.bodyOrientation, initial.bodyOrientation); assert.equal(final.zoom, initial.zoom); assert.deepEqual([final.width, final.height], [initial.width, initial.height]); assert.equal(final.events.length, 2); assert.equal(final.generation, initial.generation);
  await saveTrace(page, `flight-${fallback ? 'fallback' : 'worker'}`);
});
test('cancelMove brakes to rest, settles and does not restore an expired activity', async t => {
  const page = await fixture(t);
  await page.evaluate(() => {
    window.playing = bot.play('thinking', { duration: 150 });
    window.moving = bot.moveTo({ x: 600, y: 200 }, { maxSpeed: 300, acceleration: 600, deceleration: 800 });
  });
  await page.waitForFunction(() => bot.movementState.speed >= 290);
  const before = await page.evaluate(() => { const before = bot.movementState; bot.cancelMove(); return { before, after: bot.movementState }; });
  assert.equal(before.after.phase, 'braking'); assert.ok(before.after.speed > 0);
  await page.waitForFunction(() => bot.movementState.phase === 'braking' && bot.movementState.speed < 200);
  const during = await page.evaluate(() => bot.movementState);
  assert.ok(during.position.x > before.before.position.x, 'movement continues while braking'); assert.ok(during.speed < before.after.speed);
  if (process.env.SIDEKICK_SCREENSHOTS) await page.screenshot({ path: `${process.env.SIDEKICK_SCREENSHOTS}/flight-controlled-stop.png` });
  const final = await page.evaluate(async () => { const result = await moving; await playing; await bot.capturePixelsAsync(); return { result, state: bot.movementState, activity: bot.activity, travel: bot.diagnostics.travel }; });
  assert.equal(final.result.finished, false); assert.equal(final.state.phase, 'idle'); assert.equal(final.state.speed, 0); assert.equal(final.activity, 'idle'); assert.equal(final.travel.strength, 0);
  assert.ok(final.state.position.x > before.before.position.x); assert.ok(final.state.position.x < 600);
  const phases = await page.evaluate(() => trace.map(s => s.phase)); assert.ok(phases.includes('braking')); assert.ok(phases.includes('settling'));
  await saveTrace(page, 'flight-controlled-stop');
});
test('reduced motion completes without travel pose or residual velocity', async t => {
  const page = await fixture(t, { reducedMotion: 'reduce' });
  const result = await page.evaluate(async () => ({ result: await bot.moveTo({ x: 400, y: 200 }, { maxSpeed: 100, acceleration: 100, deceleration: 100 }), state: bot.movementState }));
  assert.equal(result.result.finished, true); assert.equal(result.state.phase, 'idle'); assert.equal(result.state.speed, 0); assert.deepEqual(result.state.acceleration, { x: 0, y: 0 }); assert.deepEqual(result.result.position, { x: 400, y: 200 });
});
test('flight preserves a persistent activity and current expression', async t => {
  const page = await fixture(t);
  const result = await page.evaluate(async () => { const playing = bot.play('thinking'); await bot.setExpression('both', 'smile', { duration: 0 }); const before = bot.design.eyes; await bot.moveTo({ x: 400, y: 200 }, { duration: 350 }); const activity = bot.activity, after = bot.design.eyes; bot.stop(); await playing; return { activity, before, after }; });
  assert.equal(result.activity, 'thinking'); assert.deepEqual(result.after, result.before);
});

for (const fallback of [false, true]) test(`fixed-ceiling stopping-distance flight and smooth stop (${fallback ? 'fallback' : 'worker'})`, async t => {
  const page = await fixture(t);
  await page.setViewportSize({ width: 1200, height: 650 });
  if (fallback) {
    await page.evaluate(() => { bot.remove(); Object.defineProperty(HTMLCanvasElement.prototype, 'transferControlToOffscreen', { value: undefined, configurable: true }); document.body.append(bot); });
    await page.waitForFunction(() => bot.ready);
  }
  const results = await page.evaluate(async () => {
    const results = [];
    for (const distance of [50, 200, 800]) {
      await bot.moveTo({ x: 50, y: 250 }, { duration: 0 });
      const samples = [];
      const observe = e => samples.push({ time: performance.now(), ...e.detail });
      bot.addEventListener('sidekick-move-progress', observe);
      const start = performance.now(), result = await bot.moveBy({ x: distance, y: 0 }, { duration: 1000 });
      const elapsed = performance.now() - start;
      bot.removeEventListener('sidekick-move-progress', observe);
      await bot.capturePixelsAsync();
      results.push({ distance, elapsed, result, samples, peak: Math.max(...samples.map(s => s.speed)), travel: bot.diagnostics.travel });
    }
    await bot.moveTo({ x: 50, y: 250 }, { duration: 0 });
    window.adaptiveStop = bot.moveTo({ x: 850, y: 250 }, { duration: 1000 });
    return results;
  });
  for (const result of results) {
    assert.equal(result.result.finished, true);
    assert.ok(result.elapsed >= 700 && result.elapsed < 2600, `elapsed ${result.elapsed}`);
    const cap = 1350;
    assert.ok(result.peak > 100 && result.peak < cap, 'short flight brakes before the fixed ceiling');
    assert.equal(result.travel.strength, 0);
    assert.deepEqual(result.result.position, { x: 50 + result.distance, y: 250 });
  }
  assert.ok(results[2].peak > results[1].peak && results[1].peak > results[0].peak);
  assert.ok(results[2].elapsed > results[1].elapsed && results[1].elapsed > results[0].elapsed, 'farther takes longer under the same speed ceiling');
  for (const result of results) assert.ok(result.samples.every(s => Math.abs(s.acceleration.x) <= 2200.001));
  await page.waitForFunction(() => bot.movementState.progress > 0.3 && bot.movementState.phase !== 'idle');
  const stop = await page.evaluate(async () => {
    const before = bot.movementState; bot.cancelMove(); const immediate = bot.movementState;
    const result = await adaptiveStop; await bot.capturePixelsAsync();
    return { before, immediate, result, final: bot.movementState, travel: bot.diagnostics.travel };
  });
  assert.ok(stop.immediate.speed > 0); assert.equal(stop.result.finished, false);
  assert.ok(stop.final.position.x > stop.before.position.x); assert.equal(stop.final.speed, 0); assert.equal(stop.travel.strength, 0);
  if (process.env.SIDEKICK_SCREENSHOTS) await writeFile(`${process.env.SIDEKICK_SCREENSHOTS}/adaptive-${fallback ? 'fallback' : 'worker'}-distances.json`, JSON.stringify({ results, stop }, null, 2));
  await saveTrace(page, `adaptive-${fallback ? 'fallback' : 'worker'}`);
});
