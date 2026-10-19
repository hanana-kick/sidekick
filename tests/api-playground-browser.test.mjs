import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { createAppServer } from '../scripts/serve.mjs';

let browser, server, base;
before(async () => {
  server = createAppServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
});
after(async () => { await browser?.close(); if (server) await new Promise(resolve => server.close(resolve)); });
async function pageFor(t, options = {}) {
  const page = await browser.newPage({ locale: 'ko-KR', viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce', ...options });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  t.after(async () => { await page.close(); assert.deepEqual(errors, []); });
  await page.goto(`${base}/api-playground.html`);
  await page.waitForFunction(() => document.getElementById('bot')?.ready && document.getElementById('invocation').textContent.includes('moveTo') && document.getElementById('status').textContent.includes('준비'));
  await page.evaluate(() => {
    const bot = document.getElementById('bot');
    window.apiCalls = [];
    for (const method of ['moveTo', 'moveBy', 'cancelMove', 'play', 'setActivity', 'stop', 'setExpression', 'setBodyOrientation', 'transitionTo', 'cancelTransition', 'enter', 'exit']) {
      const original = bot[method].bind(bot);
      bot[method] = (...args) => { window.apiCalls.push({ method, args: structuredClone(args) }); return original(...args); };
    }
  });
  return page;
}
async function reveal(page, id) { await page.locator(`#${id}`).evaluate(element => { for (let parent = element.parentElement; parent; parent = parent.parentElement) if (parent.tagName === 'DETAILS') parent.open = true; }); }
async function fill(page, id, value) { await reveal(page, id); await page.locator(`#${id}`).fill(String(value)); }
async function select(page, id, value) { await reveal(page, id); await page.locator(`#${id}`).selectOption(value); }
async function calls(page) { return page.evaluate(() => window.apiCalls); }
async function lastCall(page) { return page.evaluate(() => window.apiCalls.at(-1)); }
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
  return page.evaluate(() => {
    for (let y = innerHeight - 15; y > 90; y -= 30) for (const x of [3, innerWidth - 3, ...Array.from({ length: Math.floor(innerWidth / 30) }, (_, i) => innerWidth - 15 - i * 30)]) {
      const element = document.elementFromPoint(x, y);
      if (element?.id === 'free-space' || element === document.body || element === document.documentElement || (element?.tagName === 'MAIN' && !element.closest('.controls-panel'))) return { x, y };
    }
    throw new Error('No blank page coordinate is reachable');
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
  assert.equal(await page.locator('#bot').evaluate(bot => bot.activity), 'thinking');
  await select(page, 'activity-operation', 'play'); await fill(page, 'activity-duration', 700);
  assert.equal((await executeAndCompare(page)).method, 'play');
  await select(page, 'activity-operation', 'stop'); assert.equal((await executeAndCompare(page)).method, 'stop');
  assert.equal(await page.locator('#bot').evaluate(bot => bot.activity), 'idle');
  await select(page, 'action-kind', 'expression'); await select(page, 'eye-side', 'left'); await select(page, 'expression', 'smile'); await fill(page, 'expression-duration', 0);
  assert.deepEqual(await executeAndCompare(page), { method: 'setExpression', args: ['left', 'smile', { duration: 0 }] });
  await select(page, 'action-kind', 'tracking'); await select(page, 'tracking-mode', 'off');
  assert.deepEqual(await codeCalls(page), [{ property: 'trackingMode', value: 'off' }]);
  await page.locator('#execute').click(); assert.equal(await page.locator('#bot').evaluate(bot => bot.trackingMode), 'off');
  await select(page, 'action-kind', 'orientation');
  await fill(page, 'zoom', 1.5); await fill(page, 'body-yaw', 15); await fill(page, 'body-pitch', -8); await fill(page, 'body-roll', 5);
  assert.deepEqual(await executeAndCompare(page), { method: 'setBodyOrientation', args: [{ yaw: 15, pitch: -8, roll: 5 }] });
  assert.equal(await page.locator('#bot').evaluate(bot => bot.zoom), 1.5);
  await select(page, 'action-kind', 'assets'); await select(page, 'shape', 'heart'); await select(page, 'head-accessory', 'halo'); await select(page, 'eyes-accessory', 'glasses'); await select(page, 'neck-accessory', 'bowTie'); await fill(page, 'transition-duration', 0);
  const transition = await executeAndCompare(page);
  assert.equal(transition.method, 'transitionTo'); assert.equal(transition.args[0].shape, 'heart');
  assert.deepEqual(transition.args[0].accessories.map(a => a.preset), ['halo', 'glasses', 'bowTie']);
  assert.equal(await page.locator('#bot').evaluate(bot => bot.design.body.shape), 'heart');
});

test('blank page taps center and clamp the bot; control taps, selections and swipes do not move it', async t => {
  const page = await pageFor(t);
  const point = await blankPoint(page);
  await page.mouse.click(point.x, point.y);
  const first = await lastCall(page);
  const dimensions = await page.locator('#bot').evaluate(bot => ({ width: bot.offsetWidth, height: bot.offsetHeight }));
  assert.equal(first.method, 'moveTo');
  assert.deepEqual(first.args[0], { x: Math.min(1280 - dimensions.width, Math.max(0, point.x - dimensions.width / 2)), y: Math.min(900 - dimensions.height, Math.max(0, point.y - dimensions.height / 2)) });
  const count = (await calls(page)).length;
  await page.locator('#target-x').click(); await page.locator('#copy').click();
  await page.mouse.move(point.x, point.y); await page.mouse.down(); await page.mouse.move(point.x - 60, point.y - 60); await page.mouse.up();
  await page.evaluate(() => {
    const code = document.getElementById('invocation'); const range = document.createRange(); range.selectNodeContents(code);
    const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
  });
  await page.evaluate(point => {
    const target = document.elementFromPoint(point.x, point.y);
    for (const type of ['pointerdown', 'pointerup']) target.dispatchEvent(new PointerEvent(type, { bubbles: true, isPrimary: true, button: 0, pointerId: 7, clientX: point.x, clientY: point.y }));
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
    await select(page, 'code-format', format);
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
  await page.locator('#free-space').scrollIntoViewIfNeeded();
  const point = await blankPoint(page);
  await page.touchscreen.tap(point.x, point.y);
  assert.equal((await lastCall(page)).method, 'moveTo');
  const count = (await calls(page)).length;
  await page.evaluate(point => {
    const target = document.elementFromPoint(point.x, point.y);
    const common = { bubbles: true, pointerId: 20, pointerType: 'touch', isPrimary: true, button: 0, clientX: point.x, clientY: point.y };
    target.dispatchEvent(new PointerEvent('pointerdown', common));
    target.dispatchEvent(new PointerEvent('pointermove', { ...common, clientY: point.y - 50 }));
    target.dispatchEvent(new PointerEvent('pointerup', { ...common, clientY: point.y - 50 }));
  }, point);
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
      await page.waitForFunction(() => document.querySelector('.brand-avatar')?.ready);
      const brand = await page.locator('.brand-avatar').evaluate(avatar => ({ paused: avatar.paused, tracking: avatar.trackingMode, zoom: avatar.zoom, shape: avatar.design.body.shape, accessories: avatar.design.accessories.map(a => a.preset).sort() }));
      assert.deepEqual(brand, { paused: true, tracking: 'off', zoom: 2, shape: 'ghostish', accessories: ['beret', 'bowTie', 'glasses'] });
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
  await page.waitForFunction(() => document.getElementById('bot').presenceState === 'hidden');
  await select(page, 'presence-operation', 'enter'); await select(page, 'presence-edge', 'left'); await fill(page, 'entrance-x', 350); await fill(page, 'entrance-y', 220);
  assert.deepEqual(await executeAndCompare(page), { method: 'enter', args: [{ x: 350, y: 220 }, { from: 'left' }] });
  await page.waitForFunction(() => document.getElementById('bot').presenceState === 'visible');
  assert.deepEqual(await page.locator('#bot').evaluate(bot => bot.position), { x: 350, y: 220 });
});

test('generated JavaScript reproduces preview state on a fresh real avatar', async t => {
  const page = await pageFor(t);
  await page.evaluate(async () => {
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
    await page.evaluate(async source => {
      const { createAccessory } = await import('/browser/sidekick.js');
      const fresh = document.getElementById('fresh-code-avatar');
      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
      await new AsyncFunction('document', 'createAccessory', source.replace(/^import\s.*?;\s*$/gm, ''))({ querySelector: () => fresh, getElementById: () => fresh }, createAccessory);
    }, source);
    const states = await page.evaluate(() => {
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
    await page.locator('#free-space').scrollIntoViewIfNeeded(); const point = await blankPoint(page);
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
 await select(page,'move-method','moveToElement');await fill(page,'target-selector','#action-panel');
 await select(page,'align-x','center');await select(page,'align-y','bottom');await fill(page,'target-x',12);await fill(page,'target-y',-16);
 const before=await page.locator('#invocation').textContent();assert.match(before,/moveToElement\(document.querySelector\('#action-panel'\)/);assert.match(before,/alignX: 'center'/);
 await page.locator('#execute').click();await page.waitForFunction(()=>document.getElementById('status').textContent==='적용되었습니다.');
 assert.equal(await page.locator('#invocation').textContent(),before);
 const result=await page.evaluate(()=>{
  const bot=document.getElementById('bot'),target=document.getElementById('action-panel').getBoundingClientRect();
  return {position:bot.position,expected:{x:Math.max(0,Math.min(innerWidth-bot.offsetWidth,target.left+(target.width-bot.offsetWidth)/2+12)),y:Math.max(0,Math.min(innerHeight-bot.offsetHeight,target.bottom-bot.offsetHeight-16))}};
 });
 assert.ok(Math.abs(result.position.x-result.expected.x)<.1);assert.ok(Math.abs(result.position.y-result.expected.y)<.1);
 await fill(page,'target-selector','#missing-element');assert.equal(await page.locator('#execute').isDisabled(),true);
 assert.match(await page.locator('#invocation').textContent(),/엘리먼트가 없습니다/);
});

test('element anchor option and copied code bind scrolling targets; detach preserves the configured draft', async t => {
  const page = await pageFor(t);
  await page.evaluate(() => {
    const target = document.createElement('div'); target.id = 'anchor-test-target';
    target.style.cssText = 'position:absolute;left:30px;top:400px;width:240px;height:160px;pointer-events:none';
    document.body.append(target); document.getElementById('bot').movementBounds = 'none';
  });
  await select(page, 'move-method', 'moveToElement'); await fill(page, 'target-selector', '#anchor-test-target');
  await fill(page, 'target-x', 12); await fill(page, 'target-y', 16); await fill(page, 'duration', 0);
  assert.equal(await page.locator('#element-anchor').isChecked(), false);
  await page.locator('#execute').click();
  assert.equal(await page.locator('#bot').evaluate(bot => bot.elementAnchor), null);
  await page.locator('#element-anchor').check();
  const draft = await page.locator('#invocation').textContent(); assert.match(draft, /anchor: true/);
  await page.locator('#execute').click();
  await page.waitForFunction(() => document.getElementById('bot').elementAnchor?.target.id === 'anchor-test-target');
  // Exercise the displayed command itself on the live element, not a recorder.
  await page.evaluate(async source => {
    document.getElementById('bot').detachAnchor();
    await new (Object.getPrototypeOf(async function () {}).constructor)('document', source)(document);
  }, draft);
  await page.evaluate(() => { window.scrollTo(0, 180); });
  await page.waitForFunction(() => {
    const bot = document.getElementById('bot'), rect = document.getElementById('anchor-test-target').getBoundingClientRect();
    return Math.abs(bot.position.x - rect.left - 12) < .5 && Math.abs(bot.position.y - rect.top - 16) < .5;
  });
  const before = await page.locator('#action-panel input,#action-panel select').evaluateAll(elements => elements.map(e => [e.id,e.value,e.checked]));
  await page.locator('#detach-anchor').click();
  assert.equal(await page.locator('#bot').evaluate(bot => bot.elementAnchor), null);
  assert.equal(await page.locator('#invocation').textContent(), draft);
  assert.deepEqual(await page.locator('#action-panel input,#action-panel select').evaluateAll(elements => elements.map(e => [e.id,e.value,e.checked])), before);
  assert.match(await page.locator('#last-invocation').textContent(), /avatar.detachAnchor\(\);/);
  const detached = await page.locator('#bot').evaluate(bot => bot.position);
  await page.evaluate(() => { document.getElementById('anchor-test-target').style.top = '600px'; });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.deepEqual(await page.locator('#bot').evaluate(bot => bot.position), detached);
  await select(page, 'action-kind', 'anchor');
  assert.match(await page.locator('#invocation').textContent(), /avatar.detachAnchor\(\);/);
});

test('playground eye action visibly overrides an active emotion without resetting the action form', async t => {
  const page=await pageFor(t);
  await page.locator('#bot').evaluate(bot=>{bot.paused=true;bot.trackingMode='off';});
  const pixels=()=>page.locator('#bot').evaluate(async bot=>Array.from((await bot.capturePixelsAsync()).pixels));
  await select(page,'action-kind','emotion');await select(page,'emotion-operation','setEmotion');await select(page,'emotion-name','happy');await fill(page,'emotion-intensity',1);await page.locator('#execute').click();
  const happy=await pixels();
  await select(page,'action-kind','expression');await select(page,'eye-side','both');await select(page,'expression','blink');await fill(page,'expression-duration',0);await page.locator('#execute').click();
  const closed=await pixels();assert.notDeepEqual(closed,happy,'GPU eye bitmap must change, not only authored pose');
  assert.equal(await page.locator('#action-kind').inputValue(),'expression');assert.equal(await page.locator('#bot').evaluate(bot=>bot.emotion),'happy');
  await select(page,'expression','neutral');await page.locator('#execute').click();const neutral=await pixels();assert.notDeepEqual(neutral,closed);assert.notDeepEqual(neutral,happy);
});
