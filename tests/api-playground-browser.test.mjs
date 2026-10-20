import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { accessSync, constants } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { createAppServer } from '../scripts/serve.mjs';
import { forceCanvasForPage } from './helpers/force-no-webgl.mjs';

const forceCanvas = process.env.SIDEKICK_FORCE_CANVAS2D === '1';
const canvasAudits = new WeakMap();
let browser, launcher, server, base;
before(async () => {
  server = createAppServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  launcher = await chromium.launchServer({ executablePath: [process.env.CHROMIUM_PATH, '/opt/google/chrome/chrome', '/usr/bin/chromium'].find(path => {
      if (!path) return false;
      try { accessSync(path, constants.X_OK); return true; } catch { return false; }
    }), host: '127.0.0.1', headless: true, chromiumSandbox: true, ignoreDefaultArgs: true, args: ['--headless', '--remote-debugging-pipe', '--no-startup-window'] });
  browser = await chromium.connect(launcher.wsEndpoint());
});
after(async () => { await browser?.close(); await launcher?.close(); if (server) await new Promise(resolve => server.close(resolve)); });
const demo = page => page.frames().find(frame => frame.url().includes('/api-demo.html'));
const avatar = page => page.frameLocator('#site-preview-frame').locator('#bot');
async function pageFor(t, options = {}) {
  const page = await browser.newPage({ locale: 'ko-KR', viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce', ...options });
  // One entry point serves every API test, later navigation and fresh avatars.
  // The real site renderer uses a Vite-hashed worker, not the package worker URL.
  const canvasAudit = forceCanvas ? await forceCanvasForPage(page) : null;
  if (canvasAudit) canvasAudits.set(page, canvasAudit);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  t.after(async () => { await page.close(); assert.deepEqual(errors, []); });
  await page.goto(`${base}/api-playground.html`);
  await page.waitForFunction(() => document.querySelector('#site-preview-frame')?.contentDocument?.querySelector('#bot[data-configured]')?.ready && document.getElementById('invocation').textContent.includes('moveTo'));
  if (canvasAudit) {
    const diagnostics = await avatar(page).evaluate(bot => bot.diagnostics);
    assert.equal(diagnostics.backend, 'worker', 'Forced Canvas API coverage must keep the real dedicated worker');
    assert.equal(diagnostics.graphics, 'canvas2d', 'The production renderer must discover missing WebGL itself');
    await canvasAudit.assertDenied({ worker: true, minWorkerResponses: 1 });
  }
  await demo(page).evaluate(() => {
    const bot = document.getElementById('bot');
    window.apiCalls = [];
    for (const method of ['moveTo', 'moveBy', 'cancelMove', 'play', 'setActivity', 'stop', 'setExpression', 'setBodyOrientation', 'transitionTo', 'cancelTransition', 'enter', 'exit']) {
      const original = bot[method].bind(bot);
      bot[method] = (...args) => { window.apiCalls.push({ method, args: structuredClone(args) }); return original(...args); };
    }
  });
  assert.equal(await page.locator('#bot-tools').isVisible(), false);
  await page.locator('#bot-tools-launcher').click();
  return page;
}
async function openTools(page) { if (!await page.locator('#bot-tools').isVisible()) await page.locator('#bot-tools-launcher').click(); }
async function reveal(page, id) { await openTools(page); await page.locator(`#${id}`).evaluate(element => { for (let parent = element.parentElement; parent; parent = parent.parentElement) if (parent.tagName === 'DETAILS') parent.open = true; }); }
async function fill(page, id, value) { await reveal(page, id); await page.locator(`#${id}`).fill(String(value)); }
async function select(page, id, value) { await reveal(page, id); await page.locator(`#${id}`).selectOption(value); }
async function calls(page) { return demo(page).evaluate(() => window.apiCalls); }
async function lastCall(page) { return demo(page).evaluate(() => window.apiCalls.at(-1)); }
async function codeCalls(page, codeId = 'invocation') {
  return page.evaluate(async codeId => {
    const { createAccessory } = await import('/browser/sidekick.js');
    const source = document.getElementById(codeId).textContent.replace(/^import\s.*?;\s*$/gm, '');
    const records = [];
    const avatar = new Proxy({}, {
      get: (_, method) => (...args) => { records.push({ method, args }); return Promise.resolve({ finished: true }); },
      set: (_, property, value) => { records.push({ property, value }); return true; },
    });
    const fakeDocument = { querySelector: () => avatar, getElementById: () => avatar };
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    await new AsyncFunction('document', 'createAccessory', source)(fakeDocument, createAccessory);
    return records;
  }, codeId);
}
async function executeAndCompare(page) {
  const expected = await codeCalls(page);
  const before = (await calls(page)).length;
  await page.locator('#execute').click();
  assert.deepEqual((await calls(page))[before], expected.find(call => call.method));
  return expected[0];
}
async function blankPoint(page) {
  if (await page.locator('#bot-tools').isVisible()) await page.locator('#bot-tools-close').click();
  await page.frameLocator('#site-preview-frame').locator('#free-space').scrollIntoViewIfNeeded();
  return page.evaluate(() => {
    const frame = document.querySelector('#site-preview-frame'), child = frame.contentWindow;
    const outer = frame.getBoundingClientRect(), free = child.document.querySelector('#free-space').getBoundingClientRect();
    for (let localY = Math.max(4, free.top + 4); localY < Math.min(child.innerHeight - 4, free.bottom - 4); localY += 12) {
      for (let localX = free.left + 8; localX < free.right - 8; localX += 16) {
        const x = outer.x + localX, y = outer.y + localY;
        if (document.elementFromPoint(x, y) === frame && child.document.elementFromPoint(localX, localY)?.closest('#free-space'))
          return { x, y, localX, localY, width: child.innerWidth, height: child.innerHeight };
      }
    }
    throw new Error('No unobstructed demo click surface');
  });
}

test('inputs immediately generate executable movement code; execution uses exactly those options', async t => {
  const page = await pageFor(t);
  assert.equal(await page.locator('#movement-stage, .preview-panel').count(), 0);
  await fill(page, 'target-x', 800); await fill(page, 'target-y', 430);
  await fill(page, 'duration', 850); await select(page, 'travel', 'none'); await select(page, 'easing', 'linear');
  assert.equal((await calls(page)).length, 0, 'editing inputs does not execute');
  let call = await executeAndCompare(page);
  assert.deepEqual(call, { method: 'moveTo', args: [{ x: 800, y: 430 }, { duration: 850, easing: 'linear', travel: 'none' }] });
  await select(page, 'move-method', 'moveBy'); await fill(page, 'target-x', -40); await fill(page, 'target-y', 60);
  call = await executeAndCompare(page); assert.equal(call.method, 'moveBy'); assert.deepEqual(call.args[0], { x: -40, y: 60 });
  await select(page, 'travel', 'natural'); await page.locator('#auto-speed').uncheck();
  await fill(page, 'max-speed', 240); await fill(page, 'acceleration', 700); await fill(page, 'deceleration', 1100);
  call = await executeAndCompare(page);
  assert.deepEqual(call.args[1], { duration: 850, travel: 'natural', maxSpeed: 240, acceleration: 700, deceleration: 1100 });
  await page.locator('#auto-speed').check();
  assert.doesNotMatch(await page.locator('#invocation').textContent(), /maxSpeed/);
});

test('activity, expressions, tracking, orientation and assets use public APIs matching copied code', async t => {
  const page = await pageFor(t);
  await select(page, 'action-kind', 'activity'); await select(page, 'activity', 'thinking');
  await select(page, 'activity-operation', 'setActivity');
  assert.equal((await executeAndCompare(page)).method, 'setActivity');
  assert.equal(await avatar(page).evaluate(bot => bot.activity), 'thinking');
  await select(page, 'activity-operation', 'play'); await fill(page, 'activity-duration', 700);
  assert.equal((await executeAndCompare(page)).method, 'play');
  await select(page, 'activity-operation', 'stop'); assert.equal((await executeAndCompare(page)).method, 'stop');
  assert.equal(await avatar(page).evaluate(bot => bot.activity), 'idle');
  await select(page, 'action-kind', 'expression'); await select(page, 'eye-side', 'left'); await select(page, 'expression', 'smile'); await fill(page, 'expression-duration', 0);
  assert.deepEqual(await executeAndCompare(page), { method: 'setExpression', args: ['left', 'smile', { duration: 0 }] });
  await select(page, 'action-kind', 'tracking'); await select(page, 'tracking-mode', 'off');
  assert.deepEqual(await codeCalls(page), [{ property: 'trackingMode', value: 'off' }]);
  await page.locator('#execute').click(); assert.equal(await avatar(page).evaluate(bot => bot.trackingMode), 'off');
  await select(page, 'action-kind', 'orientation');
  await fill(page, 'zoom', 1.5); await fill(page, 'body-yaw', 15); await fill(page, 'body-pitch', -8); await fill(page, 'body-roll', 5);
  assert.deepEqual(await executeAndCompare(page), { method: 'setBodyOrientation', args: [{ yaw: 15, pitch: -8, roll: 5 }] });
  assert.equal(await avatar(page).evaluate(bot => bot.zoom), 1.5);
  await select(page, 'action-kind', 'assets'); await select(page, 'shape', 'heart'); await select(page, 'head-accessory', 'halo'); await select(page, 'eyes-accessory', 'glasses'); await select(page, 'neck-accessory', 'bowTie'); await fill(page, 'transition-duration', 0);
  const transition = await executeAndCompare(page);
  assert.equal(transition.method, 'transitionTo'); assert.equal(transition.args[0].shape, 'heart');
  assert.deepEqual(transition.args[0].accessories.map(a => a.preset), ['halo', 'glasses', 'bowTie']);
  assert.equal(await avatar(page).evaluate(bot => bot.design.body.shape), 'heart');
});

test('blank page taps center and clamp the bot; control taps, selections and swipes do not move it', async t => {
  const page = await pageFor(t);
  const point = await blankPoint(page);
  await page.mouse.click(point.x, point.y);
  const first = await lastCall(page);
  const dimensions = await avatar(page).evaluate(bot => ({ width: bot.offsetWidth, height: bot.offsetHeight }));
  assert.equal(first.method, 'moveTo');
  assert.deepEqual(first.args[0], { x: Math.min(point.width - dimensions.width, Math.max(0, point.localX - dimensions.width / 2)), y: Math.min(point.height - dimensions.height, Math.max(0, point.localY - dimensions.height / 2)) });
  const count = (await calls(page)).length;
  await openTools(page);
  await page.locator('#target-x').click(); await page.locator('#copy').click();
  await page.mouse.move(point.x, point.y); await page.mouse.down(); await page.mouse.move(point.x - 60, point.y - 60); await page.mouse.up();
  await demo(page).evaluate(() => {
    const code = document.querySelector('h1'); const range = document.createRange(); range.selectNodeContents(code);
    const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
  });
  await demo(page).evaluate(point => {
    const target = document.getElementById('free-space');
    for (const type of ['pointerdown', 'pointerup']) target.dispatchEvent(new PointerEvent(type, { bubbles: true, isPrimary: true, button: 0, pointerId: 7, clientX: point.localX, clientY: point.localY }));
  }, point);
  assert.equal((await calls(page)).length, count);
});

test('cancel controls preserve configured code and show the actual invocation separately', async t => {
  const page = await pageFor(t);
  for (const [id, method] of [['cancel', 'cancelMove'], ['cancel-preview', 'cancelMove'], ['cancel-transition', 'cancelTransition']]) {
    if (id === 'cancel-transition') await select(page, 'action-kind', 'assets');
    const draft = await page.locator('#invocation').textContent();
    const kind = await page.locator('#action-kind').inputValue();
    await page.locator(`#${id}`).click();
    assert.equal(await page.locator('#action-kind').inputValue(), kind);
    assert.equal(await page.locator('#invocation').textContent(), draft);
    assert.deepEqual(await lastCall(page), { method, args: [] });
    assert.deepEqual(await codeCalls(page, 'last-invocation'), [{ method, args: [] }]);
  }
});

test('JavaScript and React copy stays synchronized and mobile controls stay inside the viewport', async t => {
  const page = await pageFor(t, { viewport: { width: 320, height: 480 }, isMobile: true, hasTouch: true });
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async value => { window.copiedCode = value; } } }));
  for (const format of ['javascript', 'react']) {
    await select(page, 'site-framework', format === 'react' ? 'react' : 'element');
    const code = await page.locator('#invocation').textContent();
    if (format === 'react') assert.match(code, /SidekickAvatar/);
    await page.locator('#copy').click();
    assert.equal(await page.evaluate(() => window.copiedCode), code);
    assert.ok((await page.locator('#copy-status').textContent()).trim());
  }
  for (const kind of ['movement', 'activity', 'expression', 'tracking', 'orientation', 'assets', 'presence']) {
    await select(page, 'action-kind', kind);
    const bounds = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
      controls: [...document.querySelectorAll('button, input, select')].filter(e => e.getClientRects().length).map(e => { const r = e.getBoundingClientRect(); return { id: e.id, left: r.left, right: r.right }; }) }));
    assert.equal(bounds.scrollWidth, bounds.width, kind);
    for (const control of bounds.controls) assert.ok(control.left >= -1 && control.right <= 321, `${kind}: ${control.id} fits horizontally`);
    await page.locator('#execute').scrollIntoViewIfNeeded(); assert.equal(await page.locator('#execute').isVisible(), true);
  }
  await page.locator('#cancel-preview').click();
  assert.equal((await lastCall(page)).method, 'cancelMove');
  if (process.env.SIDEKICK_SCREENSHOTS) { await mkdir(process.env.SIDEKICK_SCREENSHOTS, { recursive: true }); await page.screenshot({ path: `${process.env.SIDEKICK_SCREENSHOTS}/api-playground-mobile.png` }); }
});

test('mobile taps and swipe gestures use page coordinates without control-scroll movement', async t => {
  const page = await pageFor(t, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await page.frameLocator('#site-preview-frame').locator('#free-space').scrollIntoViewIfNeeded();
  const point = await blankPoint(page);
  await page.touchscreen.tap(point.x, point.y);
  assert.equal((await lastCall(page)).method, 'moveTo');
  const count = (await calls(page)).length;
  await demo(page).evaluate(point => {
    const target = document.elementFromPoint(point.localX, point.localY);
    const common = { bubbles: true, pointerId: 20, pointerType: 'touch', isPrimary: true, button: 0, clientX: point.localX, clientY: point.localY };
    target.dispatchEvent(new PointerEvent('pointerdown', common));
    target.dispatchEvent(new PointerEvent('pointermove', { ...common, clientY: point.localY - 50 }));
    target.dispatchEvent(new PointerEvent('pointerup', { ...common, clientY: point.localY - 50 }));
  }, point);
  await openTools(page);
  await page.locator('#copy').scrollIntoViewIfNeeded();
  assert.equal((await calls(page)).length, count);
  const toolbar = await page.locator('#cancel-preview').boundingBox();
  assert.ok(toolbar.y >= 0 && toolbar.y + toolbar.height <= 844, 'global stop stays visible while the page scrolls');
});

test('both pages preserve accessible shared branding and navigation at narrow sizes', async t => {
  const page = await pageFor(t);
  for (const viewport of [{ width: 1280, height: 900 }, { width: 320, height: 480 }]) {
    await page.setViewportSize(viewport);
    for (const route of ['api-playground.html', '']) {
      await page.goto(`${base}/${route}`);
      if (route) {
        await page.locator('.brand-avatar').waitFor();
        assert.equal(await page.locator('sidekick-avatar').count(), 0, 'API shell branding must not allocate another renderer');
      } else {
        await page.waitForFunction(() => document.querySelector('.brand-avatar')?.ready);
        const brand = await page.locator('.brand-avatar').evaluate(avatar => ({ paused: avatar.paused, tracking: avatar.trackingMode, zoom: avatar.zoom, shape: avatar.design.body.shape, accessories: avatar.design.accessories.map(a => a.preset).sort() }));
        assert.deepEqual(brand, { paused: true, tracking: 'off', zoom: 1.2846936688304844, shape: 'ghostish', accessories: ['beret', 'bowTie', 'glasses'] });
      }
      assert.equal(await page.locator('.product-nav [aria-current="page"]').textContent(), route ? 'API 체험' : '스튜디오');
      for (const link of await page.locator('.app-header a').all()) {
        const box = await link.boundingBox(); assert.ok(box && box.x >= 0 && box.x + box.width <= viewport.width + 1);
      }
    }
  }
});

test('invalid movement inputs cannot execute and valid values restore executable code', async t => {
  const page = await pageFor(t);
  await fill(page, 'duration', -1);
  assert.equal(await page.locator('#execute').isDisabled(), true);
  assert.equal((await calls(page)).length, 0);
  assert.ok((await page.locator('#status').textContent()).trim());
  await fill(page, 'duration', 1200); await page.locator('#auto-speed').uncheck();
  for (const id of ['max-speed', 'acceleration', 'deceleration']) {
    for (const value of [0, 100001]) {
      await fill(page, id, value); assert.equal(await page.locator('#execute').isDisabled(), true);
      assert.equal((await calls(page)).length, 0, `${id} rejects ${value}`);
    }
    await fill(page, id, 100);
  }
  const call = await executeAndCompare(page);
  assert.deepEqual(call.args[1], { duration: 1200, travel: 'natural', maxSpeed: 100, acceleration: 100, deceleration: 100 });
});

test('presence controls produce executable entry and exit APIs and restore a hidden companion', async t => {
  const page = await pageFor(t);
  await select(page, 'action-kind', 'presence'); await select(page, 'presence-operation', 'exit'); await select(page, 'presence-edge', 'right');
  assert.deepEqual(await executeAndCompare(page), { method: 'exit', args: [{ to: 'right' }] });
  await demo(page).waitForFunction(() => document.getElementById('bot').presenceState === 'hidden');
  await select(page, 'presence-operation', 'enter'); await select(page, 'presence-edge', 'left'); await fill(page, 'entrance-x', 350); await fill(page, 'entrance-y', 220);
  assert.deepEqual(await executeAndCompare(page), { method: 'enter', args: [{ x: 350, y: 220 }, { from: 'left' }] });
  await demo(page).waitForFunction(() => document.getElementById('bot').presenceState === 'visible');
  assert.deepEqual(await avatar(page).evaluate(bot => bot.position), { x: 350, y: 220 });
});

test('generated JavaScript reproduces preview state on a fresh real avatar', async t => {
  const page = await pageFor(t);
  await demo(page).evaluate(async () => {
    const preview = document.getElementById('bot');
    const fresh = document.createElement('sidekick-avatar');
    fresh.id = 'fresh-code-avatar'; fresh.setAttribute('placement', 'viewport');
    fresh.style.cssText = 'width:180px;height:180px;pointer-events:none';
    const ready = new Promise(resolve => fresh.addEventListener('sidekick-ready', resolve, { once: true }));
    document.body.append(fresh); if (!fresh.ready) await ready;
    fresh.design = preview.design; fresh.setActivity(preview.activity); fresh.bodyOrientation = preview.bodyOrientation;
    fresh.zoom = preview.zoom; fresh.trackingMode = preview.trackingMode; fresh.paused = preview.paused;
    await fresh.moveTo(preview.position, { duration: 0, travel: 'none' });
  });
  for (const [kind, fields] of [
    ['movement', [['target-x', 280], ['target-y', 180], ['duration', 0], ['travel', 'none']]],
    ['expression', [['eye-side', 'both'], ['expression', 'smile'], ['expression-duration', 0]]],
    ['orientation', [['body-yaw', 15], ['body-pitch', -8], ['body-roll', 5], ['zoom', 1.5]]],
    ['tracking', [['tracking-mode', 'off']]],
    ['assets', [['shape', 'heart'], ['head-accessory', 'halo'], ['eyes-accessory', 'glasses'], ['neck-accessory', 'bowTie'], ['transition-duration', 0]]],
  ]) {
    await select(page, 'action-kind', kind);
    for (const [id, value] of fields) {
      if (await page.locator(`#${id}`).evaluate(element => element.tagName === 'SELECT')) await select(page, id, value);
      else await fill(page, id, value);
    }
    const source = await page.locator('#invocation').textContent();
    await page.locator('#execute').click();
    await demo(page).evaluate(async source => {
      const { createAccessory } = await import('/browser/sidekick.js');
      const fresh = document.getElementById('fresh-code-avatar');
      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
      await new AsyncFunction('document', 'createAccessory', source.replace(/^import\s.*?;\s*$/gm, ''))({ querySelector: () => fresh, getElementById: () => fresh }, createAccessory);
    }, source);
    const states = await demo(page).evaluate(() => {
      const snapshot = avatar => ({ position: avatar.position, design: avatar.design, bodyOrientation: avatar.bodyOrientation, zoom: avatar.zoom, trackingMode: avatar.trackingMode, activity: avatar.activity });
      return { preview: snapshot(document.getElementById('bot')), fresh: snapshot(document.getElementById('fresh-code-avatar')) };
    });
    assert.deepEqual(states.fresh, states.preview, `${kind}: copied code reproduces the complete public state`);
  }
});

test('background clicks preserve selected task, all fields and copied code on desktop and touch', async t => {
  for (const mobile of [false, true]) {
    const page = await pageFor(t, mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : {});
    await fill(page, 'target-x', -37); await fill(page, 'target-y', 81); await select(page, 'move-method', 'moveBy');
    await select(page, 'action-kind', 'expression'); await select(page, 'expression', 'smile'); await fill(page, 'expression-duration', 720);
    const snapshot = () => page.locator('#action-panel input,#action-panel select').evaluateAll(elements => elements.map(e => [e.id, e.value, e.checked]));
    const before = await snapshot(), draft = await page.locator('#invocation').textContent();
    await page.frameLocator('#site-preview-frame').locator('#free-space').scrollIntoViewIfNeeded(); const point = await blankPoint(page);
    if (mobile) await page.touchscreen.tap(point.x, point.y); else await page.mouse.click(point.x, point.y);
    assert.deepEqual(await snapshot(), before); assert.equal(await page.locator('#invocation').textContent(), draft);
    const actual = await lastCall(page); assert.equal(actual.method, 'moveTo');
    assert.deepEqual(await codeCalls(page, 'last-invocation'), [actual]);
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async value => { window.copiedCode = value; } } }));
    await reveal(page, 'copy-last'); await page.locator('#copy-last').click();
    assert.equal(await page.evaluate(() => window.copiedCode), await page.locator('#last-invocation').textContent());
    await page.locator('#copy').click(); assert.equal(await page.evaluate(() => window.copiedCode), draft);
    await page.locator('#execute').focus(); await page.keyboard.press('Enter');
    assert.equal((await lastCall(page)).method, 'setExpression'); assert.deepEqual(await snapshot(), before);
    await select(page, 'action-kind', 'movement'); assert.equal(await page.locator('#move-method').inputValue(), 'moveBy'); assert.equal(await page.locator('#target-x').inputValue(), '-37');
    await select(page, 'action-kind', 'expression'); assert.equal(await page.locator('#expression-duration').inputValue(), '720');
  }
});

test('element-relative action displays executable matching code without losing its draft',async t=>{
 const page=await pageFor(t);
 await select(page,'move-method','moveToElement');await fill(page,'target-selector','#preview-target');
 await select(page,'align-x','center');await select(page,'align-y','bottom');await fill(page,'target-x',12);await fill(page,'target-y',-16);
 const before=await page.locator('#invocation').textContent();assert.match(before,/moveToElement\(document.querySelector\('#preview-target'\)/);assert.match(before,/alignX: 'center'/);
 await page.locator('#execute').click();await page.waitForFunction(()=>document.getElementById('status').textContent==='적용되었습니다.');
 assert.equal(await page.locator('#invocation').textContent(),before);
 const result=await demo(page).evaluate(()=>{
  const bot=document.getElementById('bot'),target=document.getElementById('preview-target').getBoundingClientRect();
  return {position:bot.position,expected:{x:Math.max(0,Math.min(innerWidth-bot.offsetWidth,target.left+(target.width-bot.offsetWidth)/2+12)),y:Math.max(0,Math.min(innerHeight-bot.offsetHeight,target.bottom-bot.offsetHeight-16))}};
 });
 assert.ok(Math.abs(result.position.x-result.expected.x)<.1);assert.ok(Math.abs(result.position.y-result.expected.y)<.1);
 await fill(page,'target-selector','#missing-element');assert.equal(await page.locator('#execute').isDisabled(),true);
 assert.match(await page.locator('#invocation').textContent(),/엘리먼트가 없습니다/);
});

test('element anchor option and copied code bind scrolling targets; detach preserves the configured draft', async t => {
  const page = await pageFor(t);
  await demo(page).evaluate(() => {
    const target = document.createElement('div'); target.id = 'anchor-test-target';
    target.style.cssText = 'position:absolute;left:30px;top:400px;width:240px;height:160px;pointer-events:none';
    document.body.append(target); document.getElementById('bot').movementBounds = 'none';
  });
  await select(page, 'move-method', 'moveToElement'); await fill(page, 'target-selector', '#anchor-test-target');
  await fill(page, 'target-x', 12); await fill(page, 'target-y', 16); await fill(page, 'duration', 0);
  assert.equal(await page.locator('#element-anchor').isChecked(), false);
  await page.locator('#execute').click();
  assert.equal(await avatar(page).evaluate(bot => bot.elementAnchor), null);
  await page.locator('#element-anchor').check();
  const draft = await page.locator('#invocation').textContent(); assert.match(draft, /anchor: true/);
  await page.locator('#execute').click();
  await demo(page).waitForFunction(() => document.getElementById('bot').elementAnchor?.target.id === 'anchor-test-target');
  // Exercise the displayed command itself on the live element, not a recorder.
  await demo(page).evaluate(async source => {
    document.getElementById('bot').detachAnchor();
    await new (Object.getPrototypeOf(async function () {}).constructor)('document', source)(document);
  }, draft);
  await demo(page).evaluate(() => { window.scrollTo(0, 180); });
  await demo(page).waitForFunction(() => {
    const bot = document.getElementById('bot'), rect = document.getElementById('anchor-test-target').getBoundingClientRect();
    return Math.abs(bot.position.x - rect.left - 12) < .5 && Math.abs(bot.position.y - rect.top - 16) < .5;
  });
  const before = await page.locator('#action-panel input,#action-panel select').evaluateAll(elements => elements.map(e => [e.id,e.value,e.checked]));
  await page.locator('#detach-anchor').click();
  assert.equal(await avatar(page).evaluate(bot => bot.elementAnchor), null);
  assert.equal(await page.locator('#invocation').textContent(), draft);
  assert.deepEqual(await page.locator('#action-panel input,#action-panel select').evaluateAll(elements => elements.map(e => [e.id,e.value,e.checked])), before);
  assert.match(await page.locator('#last-invocation').textContent(), /avatar.detachAnchor\(\);/);
  const detached = await avatar(page).evaluate(bot => bot.position);
  await demo(page).evaluate(() => { document.getElementById('anchor-test-target').style.top = '600px'; });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.deepEqual(await avatar(page).evaluate(bot => bot.position), detached);
  await select(page, 'action-kind', 'anchor');
  assert.match(await page.locator('#invocation').textContent(), /avatar.detachAnchor\(\);/);
});

test('playground eye action visibly overrides an active emotion without resetting the action form', async t => {
  const page=await pageFor(t);
  await avatar(page).evaluate(bot=>{bot.paused=true;bot.trackingMode='off';});
  const pixels=()=>avatar(page).evaluate(async bot=>Array.from((await bot.capturePixelsAsync()).pixels));
  await select(page,'action-kind','emotion');await select(page,'emotion-operation','setEmotion');await select(page,'emotion-name','happy');await fill(page,'emotion-intensity',1);await page.locator('#execute').click();
  const happy=await pixels();
  await select(page,'action-kind','expression');await select(page,'eye-side','both');await select(page,'expression','blink');await fill(page,'expression-duration',0);await page.locator('#execute').click();
  const closed=await pixels();assert.notDeepEqual(closed,happy,'GPU eye bitmap must change, not only authored pose');
  assert.equal(await page.locator('#action-kind').inputValue(),'expression');assert.equal(await avatar(page).evaluate(bot=>bot.emotion),'happy');
  await select(page,'expression','neutral');await page.locator('#execute').click();const neutral=await pixels();assert.notDeepEqual(neutral,closed);assert.notDeepEqual(neutral,happy);
});

for (const width of [320, 1280]) test(`preview shell ${width}px: closed panel, keyboard focus, pointer passthrough and preserved draft`, async t => {
  const page = await pageFor(t, { viewport: { width, height: 800 } });
  await fill(page, 'target-x', 123);
  const draft = await page.locator('#invocation').textContent();
  await page.locator('#bot-tools-close').click();
  assert.equal(await page.locator('#bot-tools').isVisible(), false);
  assert.equal(await page.locator('#bot-tools-launcher').getAttribute('aria-expanded'), 'false');
  assert.equal(await page.locator('#site-preview-frame').count(), 1);
  assert.equal(await page.locator('#bot-tools-launcher').evaluate(el => el === document.activeElement), true);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true);
  await page.frameLocator('#site-preview-frame').locator('#free-space').click();
  assert.equal((await lastCall(page)).method, 'moveTo');
  await page.locator('#bot-tools-launcher').focus(); await page.keyboard.press('Enter');
  assert.equal(await page.locator('#bot-tools-close').evaluate(el => el === document.activeElement), true);
  assert.equal(await page.locator('#invocation').textContent(), draft);
  const rect = await page.locator('#bot-tools').boundingBox();
  assert.ok(rect.x >= 0 && rect.x + rect.width <= width && rect.y >= 0, JSON.stringify({ width, rect }));
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#bot-tools').isVisible(), false);
});

test('built-in iframe choices use only authored routes and retain a real local target', async t => {
  const page = await pageFor(t);
  await page.locator('#bot-tools-close').click();
  assert.equal(await page.locator('#preview-url, #preview-click-layer').count(), 0);
  for (const site of ['company', 'shop', 'community']) {
    await page.locator('#preview-site').selectOption(site);
    await page.waitForFunction(site => {
      const frame = document.querySelector('#site-preview-frame');
      return new URL(frame.src).searchParams.get('site') === site && frame.contentDocument.querySelector('#bot[data-configured]')?.ready;
    }, site);
    assert.equal(await page.locator('#site-preview-frame').getAttribute('sandbox'), 'allow-scripts allow-same-origin');
    assert.equal(await page.locator('#site-preview-frame').getAttribute('referrerpolicy'), 'no-referrer');
    assert.equal(new URL(await page.locator('#site-preview-frame').getAttribute('src')).origin, base);
    assert.equal(await demo(page).locator('#preview-target').count(), 1);
    assert.equal(await page.locator('sidekick-avatar').count(), 0);
  }
});

// This page renders one native avatar; the shared framework switch selects generated
// Element/React code, not a second runtime renderer. Runtime React resize lives in
// state-reference-browser.test.mjs. Run this file again with SIDEKICK_FORCE_CANVAS2D=1.
for (const framework of ['element', 'react']) test(`live viewport resize preserves ${framework} drafts, drawer access and iframe geometry (${forceCanvas ? 'canvas2d' : 'webgl2'})`, { timeout: 60000 }, async t => {
  const page = await pageFor(t);
  await select(page, 'site-framework', framework);
  await fill(page, 'target-x', 237); await fill(page, 'target-y', 119);
  await fill(page, 'duration', 850); await select(page, 'travel', 'none');
  const snapshot = () => page.evaluate(() => ({
    fields: [...document.querySelectorAll('#action-panel input, #action-panel select, #action-panel textarea')].map(el => [el.id, el.value, el.checked ?? null]),
    code: document.getElementById('invocation').textContent,
    framework: document.getElementById('site-framework').value,
  }));
  const draft = await snapshot();
  assert.match(draft.code, framework === 'react' ? /SidekickAvatar/ : /avatar\.moveTo/);
  await demo(page).waitForFunction(() => !!document.getElementById('bot')?.diagnostics?.graphics);
  assert.equal(await avatar(page).evaluate(bot => bot.diagnostics.graphics), forceCanvas ? 'canvas2d' : 'webgl2', 'Fallback must not silently mask a WebGL test');
  await avatar(page).evaluate(async bot => {
    bot.trackingMode = 'off';
    await bot.moveTo({ x: innerWidth - bot.offsetWidth, y: innerHeight - bot.offsetHeight }, { duration: 0, travel: 'none' });
  });
  await page.locator('#bot-tools-close').click();
  const frame = page.locator('#site-preview-frame');
  const previewURL = await frame.getAttribute('src');
  assert.equal(await frame.getAttribute('sandbox'), 'allow-scripts allow-same-origin');
  // Track identity so resize cannot pass by silently replacing the preview or bot.
  await page.evaluate(() => { window.resizeFrame = document.getElementById('site-preview-frame'); window.resizeBot = window.resizeFrame.contentDocument.getElementById('bot'); });
  const invocationCount = (await calls(page)).length;
  const viewports = [
    { width: 320, height: 640 }, // shrink across the mobile breakpoint
    { width: 320, height: 420 }, // height-only reduction with wrapped header
    { width: 960, height: 420 }, // grow width while height remains constrained
    { width: 1440, height: 1000 }, // grow both dimensions
    { width: 390, height: 844 }, // shrink again without reloading
  ];
  for (const open of [false, true]) {
    if (open) await page.locator('#bot-tools-launcher').click();
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.evaluate(() => window.scrollTo(0, 0));
      // Observe settled geometry rather than sleeping through an assumed resize delay.
      await page.waitForFunction(open => {
        const panel = document.getElementById('bot-tools'), header = document.querySelector('.app-header');
        const p = panel.getBoundingClientRect(), h = header.getBoundingClientRect();
        const child = document.querySelector('#site-preview-frame').contentWindow;
        const bot = child.document.getElementById('bot').getBoundingClientRect();
        return panel.hidden === !open && (!open || (p.left >= -1 && p.right <= innerWidth + 1 && p.top >= h.bottom - 1 && p.bottom <= innerHeight + 1)) &&
          bot.left >= -1 && bot.top >= -1 && bot.right <= child.innerWidth + 1 && bot.bottom <= child.innerHeight + 1;
      }, open).catch(async error => {
        const state = await page.evaluate(() => {
          const child = document.querySelector('#site-preview-frame').contentWindow;
          return { parent: [innerWidth, innerHeight], child: [child.innerWidth, child.innerHeight],
            panel: document.querySelector('#bot-tools').getBoundingClientRect().toJSON(),
            header: document.querySelector('.app-header').getBoundingClientRect().toJSON(),
            bot: child.document.querySelector('#bot').getBoundingClientRect().toJSON(),
            position: child.document.querySelector('#bot').position };
        });
        throw new Error(`${error.message}: ${JSON.stringify({ open, viewport, state })}`, { cause: error });
      });
      const layout = await page.evaluate(() => {
        const surface = document.getElementById('preview-surface'), frame = document.getElementById('site-preview-frame'), r = frame.getBoundingClientRect();
        const reachable = id => {
          const el = document.getElementById(id), b = el.getBoundingClientRect();
          const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
          return b.left >= 0 && b.right <= innerWidth + 1 && b.top >= 0 && b.bottom <= innerHeight + 1 && (hit === el || el.contains(hit));
        };
        return {
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          frameWidth: r.width, frameHeight: r.height, surfaceWidth: surface.clientWidth, surfaceHeight: surface.clientHeight,
          sameFrame: frame === window.resizeFrame, sameBot: frame.contentDocument.getElementById('bot') === window.resizeBot,
          languageReachable: reachable('site-language'), frameworkReachable: reachable('site-framework'), launcherReachable: reachable('bot-tools-launcher'),
          noCaptureLayer: document.getElementById('preview-click-layer') === null,
        };
      });
      assert.equal(layout.overflow, false, JSON.stringify({ open, viewport, layout }));
      assert.ok(Math.abs(layout.frameWidth - layout.surfaceWidth) <= 1);
      assert.ok(Math.abs(layout.frameHeight - layout.surfaceHeight) <= 1);
      for (const key of ['sameFrame', 'sameBot', 'languageReachable', 'frameworkReachable', 'launcherReachable', 'noCaptureLayer']) assert.equal(layout[key], true, `${key}: ${JSON.stringify({ open, viewport })}`);
      assert.deepEqual(await snapshot(), draft, 'Live resize must not rewrite the draft');
      assert.equal((await calls(page)).length, invocationCount, 'Resize and drawer controls must not execute a bot command');
      assert.equal(await frame.getAttribute('src'), previewURL);
      assert.equal(await page.locator('#bot-tools-launcher').getAttribute('aria-expanded'), String(open));
    }
  }
  if (forceCanvas) {
    const diagnostics = await avatar(page).evaluate(bot => bot.diagnostics);
    assert.equal(diagnostics.backend, 'worker');
    assert.equal(diagnostics.graphics, 'canvas2d', 'Resize must retain the selected graphics backend');
    await canvasAudits.get(page).assertDenied({ worker: true, minWorkerResponses: 1 });
  }
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#bot-tools').isVisible(), false);
  assert.equal(await page.locator('#bot-tools-launcher').evaluate(el => el === document.activeElement), true);
  assert.equal(await frame.count(), 1);
  assert.deepEqual(await snapshot(), draft);
});
