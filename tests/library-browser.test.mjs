import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { createLibraryBrowserFixture } from './library-browser-fixture.mjs';
import { createAppServer } from '../scripts/serve.mjs';

let browser, fixture, studioServer, studioURL;
const screenshots = process.env.SIDEKICK_SCREENSHOTS;
const startupByPage = new WeakMap();
before(async () => {
  fixture = await createLibraryBrowserFixture();
  studioServer = createAppServer(); await new Promise(resolve => studioServer.listen(0, '127.0.0.1', resolve));
  studioURL = 'http://127.0.0.1:' + studioServer.address().port;
  const executablePath = process.env.CHROMIUM_PATH ?? (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
  browser = await chromium.launch({ executablePath, headless: process.env.SIDEKICK_HEADED !== '1', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
  if (screenshots) await mkdir(screenshots, { recursive: true });
  // One early smoke protects this suite from repeated startup timeouts. The
  // remaining independent entry paths retain their own full behavioral tests.
  const smoke = await browser.newPage({ reducedMotion: 'reduce' });
  const diagnostics = observeStartup(smoke);
  try { await smoke.goto(entryURL('vanilla')); await assertAvatarReady(smoke, 'vanilla', diagnostics); }
  finally { await smoke.close(); }
});
after(async () => { await browser?.close(); await fixture?.cleanup(); if (studioServer) await new Promise(resolve => studioServer.close(resolve)); });

const entryURL = entry => entry === 'studio' ? studioURL : entry === 'pages' ? fixture.pagesDeployments[1].url : `${fixture.baseURL}/${entry}.html`;
const avatarID = entry => entry === 'studio' || entry === 'pages' ? 'flat' : entry === 'vanilla' ? 'bare' : ['react', 'prebuilt-react'].includes(entry) ? 'react-avatar' : entry === 'hydration' ? 'hydrated-avatar' : entry.startsWith('prebuilt-') ? 'prebuilt-avatar' : 'cdn-avatar';
function observeStartup(page) {
  const errors = [], requests = [], resources = [], responses = [];
  page.on('request', request => resources.push({ url: request.url(), type: request.resourceType() }));
  page.on('pageerror', error => errors.push(error.stack ?? error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('requestfailed', request => requests.push({ url: request.url(), failure: request.failure()?.errorText }));
  page.on('response', response => {
    responses.push({ url: response.url(), status: response.status(), type: response.request().resourceType(), contentType: response.headers()['content-type'] ?? '' });
    if (response.status() >= 400) requests.push({ url: response.url(), status: response.status() });
  });
  const diagnostics = { errors, requests, resources, responses };
  startupByPage.set(page, diagnostics);
  return diagnostics;
}
async function assertAvatarReady(page, entry, diagnostics) {
  const id = avatarID(entry);
  let onError, onConsole;
  const fatal = new Promise((_, reject) => {
    onError = error => reject(error);
    onConsole = message => { if (message.type() === 'error') reject(new Error(message.text())); };
    page.on('pageerror', onError); page.on('console', onConsole);
  });
  try {
    await Promise.race([fatal, (async () => {
      if (diagnostics.errors.length) throw new Error('Browser errors during initial module execution');
      // React intentionally loads registration in its client effect. Every other
      // fixture uses a static auto entry that must execute before the load event.
      if (!['react', 'hydration', 'prebuilt-react'].includes(entry) && !await page.evaluate(() => !!customElements.get('sidekick-avatar'))) throw new Error('sidekick-avatar was not registered by the entry module');
      await page.waitForFunction(id => {
        const avatar = document.getElementById(id);
        return avatar?.ready === true || avatar?.shadowRoot?.querySelector('[part="fallback"]')?.hidden === false;
      }, id, { timeout: 10000 });
      if (!await page.locator('#' + id).evaluate(avatar => avatar.ready === true)) throw new Error('The avatar displayed its renderer fallback instead of becoming ready');
      if (diagnostics.errors.length) throw new Error('Browser errors while the renderer initialized');
    })()]);
  } catch (cause) {
    const state = await page.evaluate(id => {
      const avatar = document.getElementById(id), canvas = avatar?.shadowRoot?.querySelector('canvas');
      return { url: location.href, documentReadyState: document.readyState, registered: !!customElements.get('sidekick-avatar'),
        hostPresent: !!avatar, hostConstructor: avatar?.constructor.name ?? null, ready: avatar?.ready ?? null,
        fallback: avatar?.shadowRoot?.querySelector('[part="fallback"]')?.textContent ?? null,
        canvas: canvas ? { width: canvas.width, height: canvas.height, hidden: canvas.hidden } : null,
        scripts: [...document.scripts].map(script => ({ src: script.src, type: script.type })),
        consumerEvents: window.consumer?.events ?? null,
        hydrationEvents: window.hydration?.events ?? null, hydrationErrors: window.hydration?.errors ?? null,
        prebuiltEvents: window.prebuilt?.events ?? null,
      };
    }, id).catch(error => ({ diagnosticError: error.message }));
    if (screenshots) await page.screenshot({ path: `${screenshots}/startup-library-${entry}-failure.png`, timeout: 2000 }).catch(() => {});
    throw new Error(`${entry} consumer startup failed: ${cause.message}\n${JSON.stringify({ ...state, ...diagnostics }, null, 2)}`, { cause });
  } finally { page.off('pageerror', onError); page.off('console', onConsole); }
}
async function pageFor(t, entry = 'vanilla', options = {}, url = entryURL(entry)) {
  const { forceMain = false, denyWorker = false, ...pageOptions } = options;
  const page = await browser.newPage({ viewport: { width: 1080, height: 800 }, reducedMotion: 'reduce', ...pageOptions });
  const diagnostics = observeStartup(page);
  t.after(async () => { await page.close(); assert.deepEqual(diagnostics.errors, [], 'No consumer browser errors or React hydration warnings'); });
  await page.addInitScript(() => {
    // Observe the real listener lifecycle without wrapping or changing any callbacks.
    const active = [];
    const add = EventTarget.prototype.addEventListener, remove = EventTarget.prototype.removeEventListener;
    const capture = options => typeof options === 'boolean' ? options : !!options?.capture;
    EventTarget.prototype.addEventListener = function (type, listener, options) {
      const result = add.call(this, type, listener, options);
      if (listener && !active.some(item => item.target === this && item.type === type && item.listener === listener && item.capture === capture(options))) active.push({ target: this, type, listener, capture: capture(options) });
      return result;
    };
    EventTarget.prototype.removeEventListener = function (type, listener, options) {
      const result = remove.call(this, type, listener, options);
      const index = active.findIndex(item => item.target === this && item.type === type && item.listener === listener && item.capture === capture(options));
      if (index !== -1) active.splice(index, 1);
      return result;
    };
    window.listenerAudit = element => ({
      globalTrackingExit: active.filter(item => (item.target === document || item.target === window) && ['pointerleave', 'pointerout'].includes(item.type)).length,
      globalPointer: active.filter(item => (item.target === document || item.target === window) && item.type === 'pointermove').length,
      elementEvents: active.filter(item => item.target === element && item.type.startsWith('sidekick-')).length,
    });
  });
  if (forceMain) await page.addInitScript(() => { window.Worker = undefined; });
  if (denyWorker) await page.addInitScript(() => {
    window.Worker = class { constructor() { throw new DOMException('Test worker constructor denied', 'SecurityError'); } };
  });
  await page.goto(url);
  await assertAvatarReady(page, entry, diagnostics);
  if (entry === 'studio') await page.evaluate(async () => { window.libraryAPI = await import('/src/index.js'); });
  await settle(page);
  return page;
}
async function settle(page) { await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); }
async function stateOf(page, selector = '#bare') {
  return page.locator(selector).evaluate(element => ({ design: element.design, camera: element.camera, gaze: element.pose.gaze, activity: element.activity, paused: element.paused, interaction: element.interaction, mouseTracking: element.mouseTracking }));
}

async function compareReactPixelsToNative(t, page, screenshotName) {
  // Save evidence before any pixel assertion so a renderer regression cannot
  // prevent CI from showing the actual consumer that failed.
  if (screenshots) await page.screenshot({ path: `${screenshots}/${screenshotName}.png` });
  const result = await page.evaluate(async () => {
    const element = window.consumer.element;
    const summarize = ({ width, height, pixels }) => {
      let opaque = 0, visible = 0, body = 0, eyes = 0, border = 0;
      let minX = width, minY = height, maxX = -1, maxY = -1;
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4, alpha = pixels[i + 3];
        if (!alpha) continue;
        visible++; if (alpha === 255) opaque++;
        minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
        if (x === 0 || y === 0 || x === width - 1 || y === height - 1) border++;
        if (alpha === 255 && pixels[i] === 139 && pixels[i + 1] === 186 && pixels[i + 2] === 156) body++;
        if (alpha === 255 && pixels[i] === 39 && pixels[i + 1] === 55 && pixels[i + 2] === 47) eyes++;
      }
      return { width, height, opaque, visible, transparent: width * height - visible, body, eyes, border,
        alphaBounds: maxX < 0 ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 },
      };
    };
    const actual = (await element.capturePixelsAsync()), rect = element.getBoundingClientRect();
    // This reference does not copy React's attributes, design, pose, or ref
    // state. It independently applies the fixture's expected values through
    // the native imperative API, exercising a separate configuration path.
    const native = document.createElement('sidekick-avatar');
    native.style.cssText = 'position:fixed;left:0;top:0;width:280px;height:280px;pointer-events:none';
    native.paused = true; native.setActivity('still'); native.seek(0);
    native.design = { version: 7, body: { shape: 'puffy', color: '#8bba9c' }, eyes: { color: '#27372f', left: { weights: { smile: 0.25, blink: 0 } }, right: { weights: { smile: 0, blink: 0.15 } } }, accessories: [] };
    native.setCamera({ yaw: 12, pitch: 5, roll: -4 }); native.lookAt({ space: 'view', x: 0.2, y: -0.1 });
    try {
      document.body.append(native);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const expected = (await native.capturePixelsAsync());
      let differingBytes = 0;
      for (let i = 0; i < Math.max(actual.pixels.length, expected.pixels.length); i++) if (actual.pixels[i] !== expected.pixels[i]) differingBytes++;
      return { actual: summarize(actual), native: summarize(expected), differingBytes, nativeReady: native.ready,
        cssSize: [rect.width, rect.height], devicePixelRatio, actualPose: element.pose, nativePose: native.pose,
      };
    } finally { native.remove(); }
  });
  t.diagnostic(`React/native pixel comparison: ${JSON.stringify(result)}`);
  assert.deepEqual(result.cssSize, [280, 280], 'React forwards the requested host dimensions');
  const pixelSize = Math.round(280 * Math.min(2, Math.max(1, result.devicePixelRatio)));
  assert.deepEqual([result.actual.width, result.actual.height], [pixelSize, pixelSize]);
  assert.equal(result.nativeReady, true); assert.equal(result.differingBytes, 0, 'React must render every RGBA byte identically to the independently configured native element');
  assert.deepEqual(result.actual, result.native); assert.deepEqual(result.actualPose, result.nativePose);
  assert.ok(result.actual.opaque > 0 && result.actual.body > result.actual.eyes && result.actual.eyes > 0, 'The expected opaque body and eye colors are both visible');
  assert.ok(result.actual.transparent > 0); assert.equal(result.actual.border, 0);
  assert.ok(result.actual.alphaBounds?.width > 1 && result.actual.alphaBounds.height > 1, 'A real two-dimensional silhouette is present');
}

test('packed root import registers a bare element with real default pixels and no Studio dependency', async t => {
  const page = await pageFor(t);
  const result = await page.locator('#bare').evaluate(async element => {
    const capture = (await element.capturePixelsAsync());
    let opaque = 0, body = 0, eyes = 0;
    for (let i = 0; i < capture.pixels.length; i += 4) {
      if (capture.pixels[i + 3] === 255) opaque++;
      if (capture.pixels[i] === 255 && capture.pixels[i + 1] === 204 && capture.pixels[i + 2] === 55 && capture.pixels[i + 3] === 255) body++;
      if (capture.pixels[i] === 36 && capture.pixels[i + 1] === 36 && capture.pixels[i + 2] === 44 && capture.pixels[i + 3] === 255) eyes++;
    }
    window.libraryAPI.defineSidekick(); window.libraryAPI.defineSidekick();
    window.libraryAPI.defineSidekick('test-sidekick');
    const alias = document.createElement('test-sidekick'); document.getElementById('sandbox').append(alias);
    await alias.capturePixelsAsync(); const aliasReady = alias.ready; alias.remove();
    return { registered: customElements.get('sidekick-avatar') === window.libraryAPI.SidekickAvatar,
      design: element.design, defaults: window.libraryAPI.createDesign(), width: capture.width, height: capture.height,
      corner: capture.pixels[3], opaque, body, eyes, role: element.getAttribute('role'), tabindex: element.tabIndex,
      tracking: element.mouseTracking, listeners: window.listenerAudit(element).globalPointer, aliasReady,
    };
  });
  assert.equal(result.registered, true); assert.deepEqual(result.design, result.defaults);
  assert.ok(result.width >= 200 && result.height >= 200); assert.equal(result.corner, 0);
  assert.ok(result.opaque > 10000); assert.ok(result.body > 10000); assert.ok(result.eyes > 100);
  assert.equal(result.role, 'img'); assert.equal(result.tabindex, -1); assert.equal(result.tracking, false);
  assert.equal(result.listeners, 0); assert.equal(result.aliasReady, true);
  if (screenshots) await page.screenshot({ path: `${screenshots}/library-vanilla-consumer.png` });
});

test('packed auto entry runs as a direct script tag without React, source files, or a bundler', async t => {
  const page = await pageFor(t, 'cdn');
  const result = await page.locator('#cdn-avatar').evaluate(async element => {
    const { pixels } = (await element.capturePixelsAsync());
    return { ready: element.ready, shape: element.design.body.shape, visible: pixels.some((value, index) => index % 4 === 3 && value === 255), transparent: pixels[3] === 0 };
  });
  assert.deepEqual(result, { ready: true, shape: 'square', visible: true, transparent: true });
});

for (const [format, filename] of [['esm', 'sidekick.js'], ['classic', 'sidekick.iife.js']]) {
  test(`prebuilt ${format} release renders unchanged bytes with live config, tracking, events and the full core API`, async t => {
    const page = await pageFor(t, `prebuilt-${format}`);
    assert.deepEqual(await readFile(`${fixture.output}/prebuilt/${filename}`), await readFile(`${fixture.packagePath}/dist/browser/${filename}`), 'The browser receives the released file without a consumer transform');
    const initial = await page.evaluate(async () => {
      const element = document.getElementById('prebuilt-avatar'), api = window.libraryAPI;
      const capture = (await element.capturePixelsAsync());
      const apiTypes = Object.fromEntries(['SidekickAvatar', 'defineSidekick', 'createDesign', 'createAccessory', 'parseDesign', 'serializeDesign', 'createScene', 'parseScene', 'serializeScene', 'MotionTimeline', 'alphaBounds', 'cropPixels'].map(name => [name, typeof api[name]]));
      api.defineSidekick(); api.defineSidekick();
      return { apiTypes, classMatches: api.SidekickAvatar === customElements.get('sidekick-avatar'), globalMatches: window.Sidekick === api,
        design: element.design, defaults: api.createDesign(), readyEvents: window.prebuilt.events.filter(event => event.type === 'sidekick-ready'),
        visible: capture.pixels.filter((value, index) => index % 4 === 3 && value === 255).length, corner: capture.pixels[3],
        moduleScripts: document.querySelectorAll('script[type="module"],script[type="importmap"],link[rel="modulepreload"]').length,
      };
    });
    assert.ok(Object.values(initial.apiTypes).every(type => type === 'function'), JSON.stringify(initial.apiTypes));
    assert.equal(initial.classMatches, true); assert.equal(initial.globalMatches, format === 'classic');
    assert.deepEqual(initial.design, initial.defaults); assert.equal(initial.readyEvents.length, 1); assert.equal(initial.readyEvents[0].native, true);
    assert.ok(initial.visible > 10000); assert.equal(initial.corner, 0);
    if (format === 'classic') assert.equal(initial.moduleScripts, 0, 'The classic consumer contains no ES module or import map');

    const result = await page.locator('#prebuilt-avatar').evaluate(async element => {
      const api = window.libraryAPI;
      const design = api.createDesign({ body: { shape: 'heart', color: '#83aa91' }, accessories: [api.createAccessory('crown'), api.createAccessory('starEarring', { slot: 'rightEar' })] });
      const scene = api.createScene({ design, paused: true, activity: 'still', camera: { yaw: 15 } });
      element.design = api.parseDesign(api.serializeDesign(design));
      const roundTrip = api.parseScene(api.serializeScene(scene));
      for (const [name, value] of Object.entries({ shape: 'circle', 'body-color': '#b7a5ce', 'eye-color': '#27372f', 'left-smile': '0.65', 'camera-yaw': '23', paused: 'true', activity: 'still', interaction: 'box' })) element.setAttribute(name, value);
      await Promise.resolve();
      const configured = { design: element.design, camera: element.camera, paused: element.paused, activity: element.activity };
      await element.capturePixelsAsync();
      const beforeInvalid = JSON.stringify({ design: element.design, camera: element.camera, pose: element.pose });
      element.setAttribute('shape', 'puffy'); element.setAttribute('body-color', 'invalid'); await Promise.resolve();
      const invalidUnchanged = beforeInvalid === JSON.stringify({ design: element.design, camera: element.camera, pose: element.pose });
      const reportedError = window.prebuilt.events.filter(event => event.type === 'sidekick-error').at(-1);
      element.setAttribute('body-color', '#83aa91'); await Promise.resolve();
      const recovered = { shape: element.design.body.shape, color: element.design.body.color };
      element.lookAt({ space: 'view', x: 0.2, y: -0.3 });
      element.setAttribute('mouse-tracking', 'true'); await Promise.resolve();
      document.dispatchEvent(new PointerEvent('pointermove', { clientX: 10000, clientY: -10000, pointerType: 'mouse' }));
      await element.capturePixelsAsync();
      const tracked = element.pose.gaze, activeListeners = window.listenerAudit(element).globalPointer;
      element.setAttribute('mouse-tracking', 'false'); await Promise.resolve();
      await element.capturePixelsAsync();
      const restored = element.pose.gaze;
      await element.motion.to({ face: { uv: [0.15, -0.1] } }, { duration: 0 });
      await element.setShape('heart', { duration: 0 });
      return { scene, roundTrip, configured, invalidUnchanged, reportedError, recovered, tracked, restored, activeListeners,
        disabledListeners: window.listenerAudit(element).globalPointer, face: element.pose.face, finalShape: element.design.body.shape,
      };
    });
    assert.deepEqual(result.roundTrip, result.scene); assert.equal(result.configured.design.body.shape, 'circle');
    assert.equal(result.configured.design.body.color, '#b7a5ce'); assert.equal(result.configured.design.eyes.color, '#27372f');
    assert.equal(result.configured.design.eyes.left.weights.smile, 0.65); assert.equal(result.configured.camera.yaw, 23);
    assert.deepEqual(result.configured.design.accessories.map(accessory => [accessory.preset, accessory.slot]), [['crown', 'head'], ['starEarring', 'rightEar']]);
    assert.equal(result.configured.paused, true); assert.equal(result.configured.activity, 'still'); assert.equal(result.invalidUnchanged, true);
    assert.equal(result.reportedError.detail.attribute, 'body-color'); assert.equal(result.reportedError.native, true);
    assert.deepEqual(result.recovered, { shape: 'puffy', color: '#83aa91' }); assert.deepEqual(result.tracked, [1, 1]); assert.deepEqual(result.restored, [0.2, -0.3]);
    assert.equal(result.activeListeners, 1); assert.equal(result.disabledListeners, 0); assert.deepEqual(result.face, [0.15, -0.1]); assert.equal(result.finalShape, 'heart');
    await page.locator('#prebuilt-avatar').focus(); await page.keyboard.press('Enter');
    const events = await page.evaluate(() => window.prebuilt.events);
    for (const type of ['sidekick-ready', 'sidekick-design-change', 'sidekick-camera-change', 'sidekick-motion-end', 'sidekick-shape-end', 'sidekick-activate']) assert.ok(events.some(event => event.type === type && event.native), type);
    assert.ok(events.some(event => event.type === 'sidekick-motion-end' && event.detail.finished));
    assert.ok(events.some(event => event.type === 'sidekick-shape-end' && event.detail.finished));
    assert.equal(events.filter(event => event.type === 'sidekick-error').length, 1, 'Only the intentionally invalid attribute emits an error');
    const diagnostics = startupByPage.get(page), origin = new URL(fixture.baseURL).origin;
    assert.deepEqual(diagnostics.requests, [], 'No failed asset requests');
    const allowedScripts = new Set([`/prebuilt/${filename}`, '/prebuilt/sidekick.worker.js']);
    assert.ok(diagnostics.resources.filter(resource => resource.type === 'script').every(resource => allowedScripts.has(new URL(resource.url).pathname)), 'Only the unchanged entry and its dedicated worker are loaded');
    assert.equal(diagnostics.resources.filter(resource => new URL(resource.url).pathname === `/prebuilt/${filename}`).length, 1);
    assert.equal(await page.locator('#prebuilt-avatar').evaluate(element => element.diagnostics.backend), 'worker');
    assert.ok(page.workers().some(worker => new URL(worker.url()).pathname === '/prebuilt/sidekick.worker.js'));
    assert.ok(diagnostics.resources.every(resource => new URL(resource.url).origin === origin && [`/prebuilt-${format}.html`, `/prebuilt/${filename}`, '/prebuilt/sidekick.worker.js', '/favicon.ico'].includes(new URL(resource.url).pathname)), JSON.stringify(diagnostics.resources));
    if (screenshots) await page.screenshot({ path: `${screenshots}/library-prebuilt-${format}.png` });
  });
}

test('prebuilt React release runs directly through an import map, lazily registers, renders and cleans up its native ref', async t => {
  const page = await pageFor(t, 'prebuilt-react');
  await compareReactPixelsToNative(t, page, 'library-prebuilt-react');
  assert.equal(await page.locator('#react-avatar').evaluate(element => element.diagnostics.backend), 'worker');
  assert.ok(page.workers().some(worker => worker.url().endsWith('/prebuilt/sidekick.worker.js')));
  for (const filename of ['sidekick-react.js', 'sidekick-element.js']) assert.deepEqual(await readFile(`${fixture.output}/prebuilt/${filename}`), await readFile(`${fixture.packagePath}/dist/browser/${filename}`));
  const initial = await page.evaluate(() => {
    const element = window.consumer.element;
    return { refMatches: element === document.getElementById('react-avatar'), ready: element.ready, design: element.design, camera: element.camera,
      events: window.consumer.events,
    };
  });
  assert.equal(initial.refMatches, true); assert.equal(initial.ready, true); assert.equal(initial.design.body.shape, 'puffy');
  assert.deepEqual(initial.camera, { yaw: 12, pitch: 5, roll: -4, zoom: 1 });
  const readyEvents = initial.events.filter(event => event.name === 'Ready');
  assert.ok(readyEvents.length > 0);
  for (const event of readyEvents) assert.deepEqual(event.configured, { shape: 'puffy', camera: { yaw: 12, pitch: 5, roll: -4, zoom: 1 }, left: { smile: 0.25, blink: 0 }, right: { smile: 0, blink: 0.15 } });
  assert.deepEqual(initial.events.filter(event => event.name === 'Error'), []);
  await page.evaluate(() => { window.prebuiltReactHost = window.consumer.element; window.renderConsumer({ shape: 'heart', bodyColor: '#b7a5ce', mouseTracking: false }); });
  await page.waitForFunction(() => window.consumer.element.design.body.shape === 'heart'); await settle(page);
  assert.equal(await page.evaluate(() => window.prebuiltReactHost === window.consumer.element), true);
  assert.equal((await stateOf(page, '#react-avatar')).design.body.color, '#b7a5ce');
  await page.locator('#react-avatar').focus(); await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => window.consumer.events.filter(event => event.name === 'Activate').length), 1);
  const diagnostics = startupByPage.get(page), resources = diagnostics.resources.map(resource => new URL(resource.url));
  assert.deepEqual(diagnostics.requests, []);
  assert.ok(resources.every(url => url.origin === new URL(fixture.baseURL).origin && (url.pathname.startsWith('/vendor/') || ['/prebuilt-react.html', '/prebuilt-react.mjs', '/prebuilt/sidekick-react.js', '/prebuilt/sidekick-element.js', '/prebuilt/sidekick.worker.js', '/favicon.ico'].includes(url.pathname))), JSON.stringify(diagnostics.resources));
  for (const filename of ['sidekick-react.js', 'sidekick-element.js']) assert.equal(resources.filter(url => url.pathname === `/prebuilt/${filename}`).length, 1);
  if (screenshots) await page.screenshot({ path: `${screenshots}/library-prebuilt-react-updated.png` });
  await page.evaluate(() => window.unmountConsumer()); await page.waitForFunction(() => window.consumer.element === null);
  const cleanup = await page.evaluate(() => ({ ready: window.prebuiltReactHost.ready, buffers: window.prebuiltReactHost.diagnostics.buffers, ...window.listenerAudit(window.prebuiltReactHost) }));
  assert.deepEqual(cleanup, { ready: false, buffers: 0, globalPointer: 0, globalTrackingExit: 0, elementEvents: 0 });
});

test('prebuilt React loads its adjacent lazy fallback when worker creation is denied', async t => {
  const page = await pageFor(t, 'prebuilt-react', { denyWorker: true });
  const result = await page.evaluate(async () => {
    const element = window.consumer.element, image = await element.capturePixelsAsync();
    window.fallbackReactHost = element;
    return { backend: element.diagnostics.backend, ready: element.ready, refMatches: element === document.getElementById('react-avatar'),
      color: element.design.body.color, shape: element.design.body.shape, width: image.width, height: image.height,
      alpha: image.pixels.some((value, i) => i % 4 === 3 && value > 0), events: window.consumer.events };
  });
  assert.equal(result.backend, 'main'); assert.equal(result.ready, true); assert.equal(result.refMatches, true);
  assert.equal(result.shape, 'puffy'); assert.ok(result.width > 0 && result.height > 0); assert.equal(result.alpha, true);
  assert.equal(result.events.filter(event => event.name === 'Error').length, 1, 'The recoverable worker error reaches the React handler once');
  assert.ok(result.events.some(event => event.name === 'Ready'));
  assert.deepEqual(await readFile(`${fixture.output}/prebuilt/sidekick-fallback.js`), await readFile(`${fixture.packagePath}/dist/browser/sidekick-fallback.js`));
  const diagnostics = startupByPage.get(page), resources = diagnostics.resources.map(resource => new URL(resource.url));
  assert.deepEqual(diagnostics.requests, []);
  assert.equal(resources.filter(url => url.pathname === '/prebuilt/sidekick-fallback.js').length, 1);
  assert.equal(resources.filter(url => url.pathname === '/prebuilt/sidekick.worker.js').length, 0);
  assert.equal(page.workers().length, 0);
  await page.evaluate(() => window.renderConsumer({ shape: 'heart', bodyColor: '#336699', mouseTracking: false }));
  await page.waitForFunction(() => window.consumer.element.design.body.shape === 'heart');
  assert.deepEqual(await page.evaluate(async () => {
    const element = window.consumer.element; await element.capturePixelsAsync();
    return { same: element === window.fallbackReactHost, backend: element.diagnostics.backend, color: element.design.body.color };
  }), { same: true, backend: 'main', color: '#336699' });
  if (screenshots) await page.screenshot({ path: `${screenshots}/library-prebuilt-react-fallback.png` });
  await page.evaluate(() => window.unmountConsumer()); await page.waitForFunction(() => window.consumer.element === null);
  assert.deepEqual(await page.evaluate(() => ({ buffers: window.fallbackReactHost.diagnostics.buffers, ...window.listenerAudit(window.fallbackReactHost) })),
    { buffers: 0, globalPointer: 0, globalTrackingExit: 0, elementEvents: 0 });
});

test('complete declarative config has order-independent JSON, scalar, expression, slot, camera and motion precedence', async t => {
  const page = await pageFor(t);
  const result = await page.evaluate(async () => {
    const api = window.libraryAPI;
    const design = api.createDesign({ body: { shape: 'circle', color: '#112233' }, eyes: { color: '#223344', left: { weights: { smile: 0.11, blink: 0.12 } }, right: { weights: { smile: 0.13, blink: 0.14 } } }, accessories: [api.createAccessory('halo', 'json-halo')] });
    const attrs = {
      design: JSON.stringify(design), shape: 'heart', 'body-color': '#A4B8C9', 'eye-color': '#121212',
      expression: 'smile', 'left-expression': 'blink', 'right-expression': 'neutral', smile: '0.4', blink: '0.3', 'left-smile': '0.2', 'right-blink': '0.7',
      accessories: JSON.stringify([api.createAccessory('beret', 'json-hat')]),
      'head-accessory': 'halo', 'head-color': '#102030', 'eyes-accessory': 'glasses', 'eyes-color': '#203040',
      'mouth-accessory': 'moustache', 'mouth-color': '#304050', 'neck-accessory': 'scarf', 'neck-color': '#405060',
      'left-ear-accessory': 'earring', 'left-ear-color': '#506070', 'right-ear-accessory': 'earring', 'right-ear-color': '#607080',
      camera: 'three-quarter', 'camera-yaw': '27', 'camera-pitch': '-13', 'camera-roll': '17', 'gaze-x': '0.25', 'gaze-y': '-0.35',
      activity: 'still', paused: 'true', interaction: 'box', 'mouse-tracking': 'false',
      'shape-duration': '125', 'shape-easing': 'linear', 'motion-duration': '150', 'motion-easing': 'smooth',
      motion: JSON.stringify({ body: { rotation: [0.1, 0.2, 0.3] }, face: { uv: [0.1, -0.2] } }), time: '2.5',
    };
    const make = entries => { const element = document.createElement('sidekick-avatar'); for (const [key, value] of entries) element.setAttribute(key, value); document.getElementById('sandbox').append(element); return element; };
    const a = make(Object.entries(attrs)), b = make(Object.entries(attrs).reverse());
    await Promise.all([a.capturePixelsAsync(), b.capturePixelsAsync()]);
    const snapshot = element => ({ design: element.design, camera: element.camera, pose: element.pose, paused: element.paused, activity: element.activity, interaction: element.interaction, tracking: element.mouseTracking, ready: element.ready });
    const result = { first: snapshot(a), reversed: snapshot(b) }; a.remove(); b.remove(); return result;
  });
  assert.deepEqual(result.first, result.reversed);
  const state = result.first;
  assert.deepEqual(state.design.body, { shape: 'heart', color: '#a4b8c9' }); assert.equal(state.design.eyes.color, '#121212');
  assert.deepEqual(state.design.eyes.left.weights, { smile: 0.2, blink: 0.3 }); assert.deepEqual(state.design.eyes.right.weights, { smile: 0.4, blink: 0.7 });
  assert.deepEqual(state.design.accessories.map(a => [a.slot, a.preset, a.color]), [
    ['head', 'halo', '#102030'], ['eyes', 'glasses', '#203040'], ['mouth', 'moustache', '#304050'], ['neck', 'scarf', '#405060'], ['leftEar', 'earring', '#506070'], ['rightEar', 'earring', '#607080'],
  ]);
  assert.deepEqual(state.camera, { yaw: 27, pitch: -13, roll: 17, zoom: 1 }); assert.deepEqual(state.pose.gaze, [0.25, -0.35]);
  assert.deepEqual(state.pose.rotation, [0.1, 0.2, 0.3]); assert.deepEqual(state.pose.face, [0.1, -0.2]);
  assert.equal(state.paused, true); assert.equal(state.activity, 'still'); assert.equal(state.interaction, 'box'); assert.equal(state.tracking, false); assert.equal(state.ready, true);
});

test('invalid live attribute batches leave design, camera and pose unchanged, report the offending field, and recover atomically', async t => {
  const page = await pageFor(t);
  const results = await page.locator('#bare').evaluate(async element => {
    element.setAttribute('paused', 'true'); element.setAttribute('activity', 'still'); await Promise.resolve();
    const snapshot = () => JSON.stringify({ design: element.design, camera: element.camera, pose: element.pose, paused: element.paused, activity: element.activity, interaction: element.interaction, tracking: element.mouseTracking });
    const invalid = [
      ['body-color', 'red'], ['eye-color', '#123'], ['design', '{'], ['accessories', '[{}]'],
      ['left-smile', '1.2'], ['right-blink', 'NaN'], ['left-expression', 'angry'], ['camera-pitch', '91'],
      ['gaze-x', '2'], ['head-accessory', 'glasses'], ['left-ear-color', 'transparent'], ['paused', 'yes'],
      ['mouse-tracking', 'yes'], ['interaction', 'orbit'], ['activity', 'unknown'], ['motion', '{"body":{"rotation":[0,0,"bad"]}}'],
      ['shape-duration', '-1'], ['motion-easing', 'ease'], ['time', 'Infinity'],
    ];
    const errors = []; element.addEventListener('sidekick-error', event => errors.push(event.detail));
    const results = [];
    for (const [attribute, value] of invalid) {
      const before = snapshot(), previous = element.getAttribute(attribute), target = element.design.body.shape === 'heart' ? 'puffy' : 'heart';
      element.setAttribute('shape', target); element.setAttribute('camera-yaw', '19'); element.setAttribute(attribute, value);
      await Promise.resolve();
      results.push({ attribute, unchanged: before === snapshot(), rawPreserved: element.getAttribute(attribute) === value, error: errors.at(-1) });
      if (previous === null) element.removeAttribute(attribute); else element.setAttribute(attribute, previous);
      await Promise.resolve();
      results.at(-1).recovered = element.design.body.shape === target && element.camera.yaw === 19;
    }
    return results;
  });
  for (const result of results) {
    assert.equal(result.unchanged, true, JSON.stringify(result)); assert.equal(result.rawPreserved, true, result.attribute);
    assert.equal(result.error.attribute, result.attribute, JSON.stringify(result)); assert.equal(typeof result.error.message, 'string');
    assert.equal(result.recovered, true, JSON.stringify(result));
  }
});

test('removing scalar and slot overrides reveals JSON and defaults without losing unrelated imperative camera or motion', async t => {
  const page = await pageFor(t);
  const result = await page.locator('#bare').evaluate(async element => {
    const api = window.libraryAPI;
    const design = api.createDesign({ body: { shape: 'circle', color: '#123456' }, eyes: { left: { weights: { smile: 0.35, blink: 0.45 } } }, accessories: [api.createAccessory('beret', 'saved-hat')] });
    for (const [key, value] of Object.entries({ design: JSON.stringify(design), shape: 'heart', 'body-color': '#abcdef', 'left-smile': '0.8', 'head-accessory': 'halo', 'head-color': '#102030', paused: 'true', activity: 'still' })) element.setAttribute(key, value);
    await Promise.resolve();
    element.setCamera({ yaw: 31, pitch: 7, roll: -12 }); await element.motion.to({ face: { uv: [0.15, -0.1] } }, { duration: 0 });
    for (const key of ['shape', 'body-color', 'left-smile', 'head-accessory', 'head-color']) element.removeAttribute(key);
    await Promise.resolve(); const revealed = element.design;
    element.setAttribute('head-accessory', 'none'); await Promise.resolve(); const removed = element.design.accessories;
    element.removeAttribute('head-accessory'); await Promise.resolve(); const restored = element.design.accessories;
    element.removeAttribute('design'); await Promise.resolve();
    return { revealed, expected: design, removed, restored, defaults: element.design, expectedDefaults: api.createDesign(), camera: element.camera, face: element.pose.face };
  });
  assert.deepEqual(result.revealed, result.expected); assert.deepEqual(result.removed, []); assert.deepEqual(result.restored, result.expected.accessories);
  assert.deepEqual(result.defaults, result.expectedDefaults); assert.deepEqual(result.camera, { yaw: 31, pitch: 7, roll: -12, zoom: 1 }); assert.deepEqual(result.face, [0.15, -0.1]);
});

test('paused and mouse-tracking support explicit false/zero/removal and live declarative animations emit completion events', async t => {
  const page = await pageFor(t, 'vanilla', { reducedMotion: 'no-preference' });
  const states = await page.locator('#bare').evaluate(async element => {
    const results = [];
    for (const value of ['', 'true', '1', 'false', '0', null]) {
      for (const name of ['paused', 'mouse-tracking']) { if (value === null) element.removeAttribute(name); else element.setAttribute(name, value); }
      await Promise.resolve(); results.push({ value, paused: element.paused, tracking: element.mouseTracking });
    }
    element.setAttribute('activity', 'still'); element.setAttribute('shape-duration', '80'); element.setAttribute('motion-duration', '80');
    window.declarativeEnds = [];
    for (const type of ['sidekick-shape-end', 'sidekick-motion-end']) element.addEventListener(type, event => window.declarativeEnds.push({ type, detail: event.detail }));
    element.setAttribute('shape', 'heart'); element.setAttribute('expression', 'smile');
    return results;
  });
  for (const item of states) assert.deepEqual([item.paused, item.tracking], ['', 'true', '1'].includes(item.value) ? [true, true] : [false, false]);
  await page.waitForFunction(() => window.declarativeEnds.some(event => event.type === 'sidekick-shape-end' && event.detail.finished) && window.declarativeEnds.some(event => event.type === 'sidekick-motion-end' && event.detail.finished));
  const completed = await stateOf(page); assert.equal(completed.design.body.shape, 'heart'); assert.deepEqual(completed.design.eyes.left.weights, { smile: 1, blink: 0 });
});

test('mouse tracking is opt-in, bounded, ignores touch, preserves camera, and returns to explicit gaze when disabled', async t => {
  const page = await pageFor(t);
  const result = await page.locator('#bare').evaluate(async element => {
    const move = (x, y, pointerType = 'mouse') => document.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, pointerType, bubbles: true }));
    element.lookAt({ space: 'view', x: 0.2, y: -0.3 }); element.setCamera({ yaw: 25, pitch: 4, roll: -5 });
    // Pointer events are coalesced until the next frame. A fresh capture orders
    // each input (or ignored input) before inspecting the acknowledged pose.
    move(10000, -10000); await element.capturePixelsAsync(); const disabled = element.pose.gaze;
    element.mouseTracking = true; await Promise.resolve(); const enabledListeners = window.listenerAudit(element).globalPointer;
    move(10000, -10000); await element.capturePixelsAsync(); const rightTop = element.pose.gaze;
    move(-10000, 10000, 'touch'); await element.capturePixelsAsync(); const touch = element.pose.gaze;
    move(-10000, 10000); await element.capturePixelsAsync(); const leftBottom = element.pose.gaze;
    element.mouseTracking = false; await element.capturePixelsAsync(); const restored = element.pose.gaze;
    move(10000, -10000); await element.capturePixelsAsync();
    return { disabled, enabledListeners, rightTop, touch, leftBottom, restored, afterDisabledMove: element.pose.gaze, listeners: window.listenerAudit(element).globalPointer, camera: element.camera };
  });
  assert.deepEqual(result.disabled, [0.2, -0.3]); assert.equal(result.enabledListeners, 1);
  assert.deepEqual(result.rightTop, [1, 1]); assert.deepEqual(result.touch, result.rightTop); assert.deepEqual(result.leftBottom, [-1, -1]);
  assert.deepEqual(result.restored, [0.2, -0.3]); assert.deepEqual(result.afterDisabledMove, result.restored); assert.equal(result.listeners, 0);
  assert.deepEqual(result.camera, { yaw: 25, pitch: 4, roll: -5, zoom: 1 });
});

test('tracking listeners release on disconnect, reconnect once, and stop responding while detached', async t => {
  const page = await pageFor(t);
  const result = await page.locator('#bare').evaluate(async element => {
    element.mouseTracking = true; await Promise.resolve();
    const parent = element.parentElement, rounds = [];
    for (let i = 0; i < 3; i++) {
      const attachedListeners = window.listenerAudit(element).globalPointer;
      element.remove(); const gaze = element.pose.gaze;
      document.dispatchEvent(new PointerEvent('pointermove', { clientX: 9000, clientY: 9000, pointerType: 'mouse' }));
      rounds.push({ attachedListeners, detachedListeners: window.listenerAudit(element).globalPointer, unchanged: JSON.stringify(gaze) === JSON.stringify(element.pose.gaze), ready: element.ready, buffers: element.diagnostics.buffers });
      parent.append(element); await element.capturePixelsAsync();
    }
    return { rounds, finalListeners: window.listenerAudit(element).globalPointer, ready: element.ready, canvases: element.shadowRoot.querySelectorAll('canvas').length };
  });
  for (const round of result.rounds) assert.deepEqual(round, { attachedListeners: 1, detachedListeners: 0, unchanged: true, ready: false, buffers: 0 });
  assert.equal(result.finalListeners, 1); assert.equal(result.ready, true); assert.equal(result.canvases, 1);
});

test('main fallback tracking releases global listeners while offscreen or WebGL is lost, then resumes once on recovery', async t => {
  const page = await pageFor(t, 'vanilla', { forceMain: true });
  await page.locator('#bare').evaluate(element => { element.mouseTracking = true; element.style.position = 'fixed'; element.style.top = '-2000px'; });
  await page.waitForFunction(() => window.listenerAudit(document.getElementById('bare')).globalPointer === 0);
  await page.locator('#bare').evaluate(element => { element.style.position = ''; element.style.top = ''; });
  await page.waitForFunction(() => window.listenerAudit(document.getElementById('bare')).globalPointer === 1);
  const supported = await page.locator('#bare').evaluate(element => {
    window.trackingContext = element.shadowRoot.querySelector('canvas').getContext('webgl2').getExtension('WEBGL_lose_context');
    window.trackingContext?.loseContext(); return !!window.trackingContext;
  });
  assert.equal(supported, true);
  await page.waitForFunction(() => !document.getElementById('bare').ready && window.listenerAudit(document.getElementById('bare')).globalPointer === 0);
  await page.waitForTimeout(100); await page.evaluate(() => window.trackingContext.restoreContext());
  await page.waitForFunction(() => document.getElementById('bare').ready && window.listenerAudit(document.getElementById('bare')).globalPointer === 1);
});

test('orbit drag controls camera without competing with tracking, which resumes after pointer release', async t => {
  const page = await pageFor(t);
  await page.locator('#bare').evaluate(element => { element.interaction = 'box'; element.mouseTracking = true; });
  await settle(page);
  const bounds = await page.locator('#bare').boundingBox();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  const before = await stateOf(page);
  await page.mouse.down(); await page.mouse.move(bounds.x + bounds.width / 2 + 65, bounds.y + bounds.height / 2 + 30, { steps: 5 });
  const dragged = await stateOf(page); await page.mouse.up();
  assert.notEqual(dragged.camera.yaw, before.camera.yaw); assert.notEqual(dragged.camera.pitch, before.camera.pitch); assert.deepEqual(dragged.gaze, before.gaze);
  await page.mouse.move(1040, 60); const resumed = await stateOf(page);
  assert.notDeepEqual(resumed.gaze, dragged.gaze); assert.deepEqual(resumed.camera, dragged.camera);
});

test('PNG snapshots crop to the real alpha bounds, preserve every rendered alpha pixel, and support transparent padding or full canvas', async t => {
  const page = await pageFor(t);
  const checks = await page.locator('#bare').evaluate(async element => {
    element.paused = true; element.setActivity('still');
    const inspect = async blob => {
      const bitmap = await createImageBitmap(blob), canvas = document.createElement('canvas');
      canvas.width = bitmap.width; canvas.height = bitmap.height;
      const context = canvas.getContext('2d'); context.drawImage(bitmap, 0, 0); bitmap.close();
      return { width: canvas.width, height: canvas.height, pixels: context.getImageData(0, 0, canvas.width, canvas.height).data, type: blob.type };
    };
    const checks = [];
    for (const shape of ['square', 'puffy', 'heart']) {
      element.design = window.libraryAPI.createDesign({ body: { shape }, accessories: [window.libraryAPI.createAccessory('beret'), window.libraryAPI.createAccessory('scarf'), window.libraryAPI.createAccessory('earring', { slot: 'leftEar' })] });
      element.setCamera({ yaw: 15, pitch: -5, roll: 12 });
      const source = (await element.capturePixelsAsync());
      let minX = source.width, minY = source.height, maxX = -1, maxY = -1, sourceVisible = 0;
      for (let y = 0; y < source.height; y++) for (let x = 0; x < source.width; x++) {
        if (!source.pixels[(y * source.width + x) * 4 + 3]) continue;
        sourceVisible++; minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      }
      const cropped = await inspect(await element.snapshot()), padded = await inspect(await element.snapshot({ padding: 12 })), full = await inspect(await element.snapshot({ crop: false }));
      let alphaDifferences = 0, paddingVisible = 0, croppedVisible = 0;
      for (let y = 0; y < cropped.height; y++) for (let x = 0; x < cropped.width; x++) {
        const alpha = cropped.pixels[(y * cropped.width + x) * 4 + 3];
        if (alpha) croppedVisible++;
        if (alpha !== source.pixels[((maxY - y) * source.width + minX + x) * 4 + 3]) alphaDifferences++;
      }
      for (let y = 0; y < padded.height; y++) for (let x = 0; x < padded.width; x++) {
        if ((x < 12 || y < 12 || x >= padded.width - 12 || y >= padded.height - 12) && padded.pixels[(y * padded.width + x) * 4 + 3]) paddingVisible++;
      }
      checks.push({ shape, expected: [maxX - minX + 1, maxY - minY + 1], cropped: [cropped.width, cropped.height], padded: [padded.width, padded.height], full: [full.width, full.height], source: [source.width, source.height], sourceVisible, croppedVisible, alphaDifferences, paddingVisible, type: cropped.type });
    }
    return checks;
  });
  for (const check of checks) {
    assert.deepEqual(check.cropped, check.expected, check.shape); assert.deepEqual(check.padded, check.expected.map(value => value + 24));
    assert.deepEqual(check.full, check.source); assert.ok(check.cropped[0] < check.full[0] && check.cropped[1] < check.full[1]);
    assert.equal(check.alphaDifferences, 0, JSON.stringify(check)); assert.equal(check.croppedVisible, check.sourceVisible); assert.ok(check.sourceVisible > 1000);
    assert.equal(check.paddingVisible, 0); assert.equal(check.type, 'image/png');
  }
});

test('typed React entry renders real pixels, forwards the element ref and callbacks, and applies updated and removed props', async t => {
  const page = await pageFor(t, 'react');
  await compareReactPixelsToNative(t, page, 'library-react-consumer');
  assert.equal(await page.locator('#react-avatar').evaluate(element => element.diagnostics.backend), 'worker');
  assert.ok(page.workers().length > 0);
  const initial = await page.evaluate(() => {
    const element = window.consumer.element;
    return { same: element === document.getElementById('react-avatar'), tag: element.localName, design: element.design, camera: element.camera, gaze: element.pose.gaze, tracking: element.mouseTracking, paused: element.paused,
      aria: element.getAttribute('aria-label'), consumer: element.dataset.consumer, className: element.className,
      events: window.consumer.events };
  });
  assert.equal(initial.same, true); assert.equal(initial.tag, 'sidekick-avatar'); assert.equal(initial.design.body.shape, 'puffy'); assert.equal(initial.design.body.color, '#8bba9c');
  assert.equal(initial.design.eyes.left.weights.smile, 0.25); assert.equal(initial.design.eyes.right.weights.blink, 0.15);
  assert.deepEqual(initial.camera, { yaw: 12, pitch: 5, roll: -4, zoom: 1 }); assert.deepEqual(initial.gaze, [0.2, -0.1]);
  assert.equal(initial.tracking, true); assert.equal(initial.paused, true); assert.equal(initial.aria, 'React companion'); assert.equal(initial.consumer, 'react'); assert.equal(initial.className, 'consumer-avatar');
  assert.ok(initial.events.some(event => event.name === 'Ready')); assert.ok(initial.events.every(event => event.native));
  for (const event of initial.events.filter(event => event.name === 'Ready')) assert.deepEqual(event.configured, { shape: 'puffy', camera: { yaw: 12, pitch: 5, roll: -4, zoom: 1 }, left: { smile: 0.25, blink: 0 }, right: { smile: 0, blink: 0.15 } }, 'onReady observes applied props through the published ref');
  await page.evaluate(() => { window.originalReactElement = window.consumer.element; window.renderConsumer({ shape: 'heart', bodyColor: '#b7a5ce', leftSmile: 0.8, rightBlink: undefined, paused: false, mouseTracking: false, camera: { yaw: -25, pitch: 3, roll: 8 } }); });
  await page.waitForFunction(() => window.consumer.element?.design.body.shape === 'heart'); await settle(page);
  const next = await stateOf(page, '#react-avatar');
  assert.equal(await page.evaluate(() => window.originalReactElement === window.consumer.element), true);
  assert.equal(next.design.body.color, '#b7a5ce'); assert.equal(next.design.eyes.left.weights.smile, 0.8); assert.equal(next.design.eyes.right.weights.blink, 0);
  assert.deepEqual(next.camera, { yaw: -25, pitch: 3, roll: 8, zoom: 1 }); assert.equal(next.paused, false); assert.equal(next.mouseTracking, false);
  assert.equal(await page.locator('#react-avatar').getAttribute('right-blink'), null);
});

test('React StrictMode rerenders keep native callbacks single and unmount releases refs, event handlers, tracking and GPU resources', async t => {
  const page = await pageFor(t, 'react');
  for (let i = 0; i < 3; i++) { await page.evaluate(() => window.renderConsumer({})); await settle(page); }
  await page.locator('#react-avatar').focus(); await page.keyboard.press('Enter');
  let activations = await page.evaluate(() => window.consumer.events.filter(event => event.name === 'Activate'));
  assert.equal(activations.length, 1); assert.equal(activations[0].type, 'sidekick-activate'); assert.equal(activations[0].native, true);
  const eventResult = await page.evaluate(async () => {
    const element = window.consumer.element;
    const before = window.consumer.events.filter(event => event.name === 'MotionEnd').length;
    await element.motion.to({ face: { uv: [0.2, 0.1] } }, { duration: 0 });
    return { added: window.consumer.events.filter(event => event.name === 'MotionEnd').length - before, face: element.pose.face };
  });
  assert.equal(eventResult.added, 1); assert.deepEqual(eventResult.face, [0.2, 0.1]);
  await page.evaluate(() => { window.unmountedElement = window.consumer.element; window.unmountConsumer(); });
  await page.waitForFunction(() => window.consumer.element === null);
  const unmounted = await page.evaluate(() => ({ connected: window.unmountedElement.isConnected, ready: window.unmountedElement.ready, buffers: window.unmountedElement.diagnostics.buffers, running: window.unmountedElement.diagnostics.running, ...window.listenerAudit(window.unmountedElement) }));
  assert.deepEqual(unmounted, { connected: false, ready: false, buffers: 0, running: false, globalPointer: 0, globalTrackingExit: 0, elementEvents: 0 });
  await page.evaluate(() => window.mountConsumer()); await page.waitForFunction(() => window.consumer.element?.ready); await settle(page);
  await page.locator('#react-avatar').focus(); await page.keyboard.press('Enter');
  activations = await page.evaluate(() => window.consumer.events.filter(event => event.name === 'Activate')); assert.equal(activations.length, 2);
  assert.equal(await page.evaluate(() => window.listenerAudit(window.consumer.element).globalPointer), 1);
  const readySnapshots = await page.evaluate(() => window.consumer.events.filter(event => event.name === 'Ready').map(event => event.configured));
  assert.ok(readySnapshots.length >= 2, 'A newly mounted host receives ready even after registration');
  for (const snapshot of readySnapshots) assert.deepEqual(snapshot, { shape: 'puffy', camera: { yaw: 12, pitch: 5, roll: -4, zoom: 1 }, left: { smile: 0.25, blink: 0 }, right: { smile: 0, blink: 0.15 } });
});

test('React SSR hydration preserves the server host and repeated renders retain canvas, imperative camera and motion state', async t => {
  const page = await pageFor(t, 'hydration');
  await page.waitForFunction(() => window.hydration.ref?.ready);
  const first = await page.evaluate(async () => {
    const element = window.hydration.ref;
    element.setCamera({ yaw: 33, pitch: 6, roll: 11 });
    await element.motion.to({ face: { uv: [0.18, -0.11] }, body: { rotation: [0, 0, 0.2] } }, { duration: 0 });
    window.hydration.canvas = element.shadowRoot.querySelector('canvas');
    return { hostPreserved: element === window.hydration.before, design: element.design, camera: element.camera, pose: element.pose, errors: window.hydration.errors };
  });
  assert.equal(first.hostPreserved, true); assert.equal(first.design.body.shape, 'heart'); assert.equal(first.design.body.color, '#b7a5ce'); assert.deepEqual(first.errors, []);
  const readyEvents = await page.evaluate(() => window.hydration.events);
  assert.ok(readyEvents.length > 0); assert.ok(readyEvents.every(event => event.configured?.shape === 'heart' && event.configured.color === '#b7a5ce'));
  for (let i = 0; i < 3; i++) { await page.evaluate(() => window.rerenderHydration()); await settle(page); }
  const after = await page.evaluate(() => {
    const element = window.hydration.ref;
    return { hostPreserved: element === window.hydration.before, canvasPreserved: element.shadowRoot.querySelector('canvas') === window.hydration.canvas, camera: element.camera, pose: element.pose, errors: window.hydration.errors, ready: element.ready };
  });
  assert.equal(after.hostPreserved, true); assert.equal(after.canvasPreserved, true); assert.equal(after.ready, true);
  assert.deepEqual(after.camera, first.camera); assert.deepEqual(after.pose, first.pose); assert.deepEqual(after.errors, []);
});

test('Studio generated HTML and React snippets match live controls, copy the displayed code, and HTML renders in the packed consumer', async t => {
  const page = await pageFor(t, 'studio', { viewport: { width: 1440, height: 1040 } });
  await page.locator('[data-shape="heart"]').click();
  await page.locator('#body-color').evaluate(input => { input.value = '#92a8cf'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.locator('[data-equipment="eyes"][data-accessory="glasses"]').click();
  await page.getByRole('tab', { name: '애니메이션', exact: true }).click();
  await page.locator('#pause').click(); await page.locator('#mouse-tracking').click(); await page.locator('#look-right').click();
  await page.locator('#left-expression').click(); await page.getByRole('option', { name: '웃음', exact: true }).click();
  await page.getByRole('tab', { name: '카메라', exact: true }).click(); await page.locator('[data-camera-preset="three-quarter"]').click();
  await page.getByRole('tab', { name: 'JSON', exact: true }).click();
  const snippets = await page.evaluate(() => {
    const html = document.getElementById('api-example').textContent, react = document.getElementById('react-example').textContent;
    const host = new DOMParser().parseFromString(html, 'text/html').querySelector('sidekick-avatar');
    const attrs = Object.fromEntries([...host.attributes].map(attribute => [attribute.name, attribute.value]));
    const props = {};
    for (const match of react.matchAll(/^\s+([A-Za-z]+)=\{(.+)\}$/gm)) { if (match[1] !== 'style') props[match[1]] = JSON.parse(match[2]); }
    return { html, react, attrs, props, scene: JSON.parse(document.getElementById('design-json').value), design: document.getElementById('flat').design };
  });
  assert.match(snippets.html, /@hanana-kick\/sidekick\/auto/); assert.match(snippets.react, /@hanana-kick\/sidekick\/react/);
  assert.deepEqual(JSON.parse(snippets.attrs.design), snippets.design); assert.deepEqual(snippets.props.design, snippets.design);
  assert.equal(snippets.design.body.shape, 'heart'); assert.equal(snippets.design.body.color, '#92a8cf'); assert.equal(snippets.design.eyes.left.weights.smile, 1);
  assert.ok(snippets.design.accessories.some(accessory => accessory.preset === 'glasses'));
  for (const [attribute, prop, expected] of [
    ['camera-yaw', 'cameraYaw', 45], ['camera-pitch', 'cameraPitch', 0], ['camera-roll', 'cameraRoll', 0],
    ['tracking-mode', 'trackingMode', 'eyes'], ['paused', 'paused', true], ['gaze-x', 'gazeX', 0.9], ['gaze-y', 'gazeY', 0],
    ['activity', 'activity', 'idle'], ['interaction', 'interaction', 'box'], ['shape-duration', 'shapeDuration', 450], ['motion-duration', 'motionDuration', 400],
  ]) { assert.equal(snippets.attrs[attribute], String(expected), attribute); assert.equal(snippets.props[prop], expected, prop); }
  assert.deepEqual(JSON.parse(snippets.attrs.motion), snippets.scene.motion); assert.deepEqual(snippets.props.motion, snippets.scene.motion);
  await page.evaluate(() => { window.copiedSnippets = []; Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.copiedSnippets.push(text); } } }); });
  await page.locator('#copy-html').click();
  await page.locator('.usage-example summary').filter({ hasText: 'React · JSX' }).click(); await page.locator('#copy-react').click();
  assert.deepEqual(await page.evaluate(() => window.copiedSnippets), [snippets.html, snippets.react]);
  if (screenshots) await page.screenshot({ path: `${screenshots}/library-studio-snippets.png` });
  const consumer = await pageFor(t);
  const rendered = await consumer.evaluate(async html => {
    const template = document.createElement('template'); template.innerHTML = html;
    template.content.querySelectorAll('script').forEach(script => script.remove());
    const host = template.content.querySelector('sidekick-avatar'); document.getElementById('sandbox').append(host);
    await host.capturePixelsAsync();
    const result = { ready: host.ready, design: host.design, camera: host.camera, paused: host.paused, tracking: host.mouseTracking, gaze: host.pose.gaze, interaction: host.interaction };
    host.remove(); return result;
  }, snippets.html);
  assert.equal(rendered.ready, true); assert.deepEqual(rendered.design, snippets.scene.design); assert.deepEqual(rendered.camera, snippets.scene.camera);
  assert.equal(rendered.paused, true); assert.equal(rendered.tracking, true); assert.deepEqual(rendered.gaze, [0.9, 0]); assert.equal(rendered.interaction, 'box');
});

test('Studio equipment palette serves a real decodable preview for every catalog accessory and slot', async t => {
  const page = await pageFor(t, 'studio', { viewport: { width: 1440, height: 1040 } });
  const result = await page.evaluate(async () => {
    const tiles = [...document.querySelectorAll('[data-equipment][data-accessory]')];
    const previews = new Map(tiles.map(tile => [tile.dataset.accessory, tile.querySelector('img')?.src]));
    const decoded = [];
    for (const [preset, url] of previews) {
      if (!url) throw new Error('Missing preview image: ' + preset);
      const response = await fetch(url); if (!response.ok) throw new Error('Missing preview asset: ' + url);
      const bitmap = await createImageBitmap(await response.blob()); decoded.push({ preset, width: bitmap.width, height: bitmap.height }); bitmap.close();
    }
    return { decoded, expected: [...window.libraryAPI.ACCESSORY_PRESETS], slots: [...new Set(tiles.map(tile => tile.dataset.equipment))] };
  });
  assert.deepEqual(result.decoded.map(preview => preview.preset).sort(), result.expected.sort());
  assert.deepEqual(result.slots.sort(), ['head', 'eyes', 'mouth', 'neck', 'leftEar', 'rightEar'].sort());
  assert.ok(result.decoded.every(preview => preview.width >= 72 && preview.height >= 72));
  await page.locator('[data-equipment="head"][data-accessory="halo"]').scrollIntoViewIfNeeded();
  if (screenshots) await page.screenshot({ path: `${screenshots}/library-accessory-catalog.png` });
});

function assertDeploymentResources(page, deployment) {
  const diagnostics = startupByPage.get(page), origin = new URL(deployment.url).origin;
  assert.deepEqual(diagnostics.errors, [], 'No console or page errors');
  assert.deepEqual(diagnostics.requests, [], 'No failed network requests, including favicon and lazy images');
  const resources = diagnostics.resources.filter(resource => !/^(?:data|blob):/.test(resource.url));
  assert.ok(resources.length > 1, 'Real browser requests were observed');
  for (const resource of resources) {
    const url = new URL(resource.url);
    assert.equal(url.origin, origin, `Unexpected external resource: ${resource.url}`);
    assert.ok(url.pathname.startsWith(deployment.basePath), `Resource escaped the deployment mount: ${resource.url}`);
  }
  for (const response of diagnostics.responses) assert.ok(response.status >= 200 && response.status < 300, JSON.stringify(response));
  return diagnostics;
}

for (const name of ['root', 'project']) for (const route of ['', 'playground/', 'playground/index.html']) {
  test(`one relative Pages artifact renders with complete assets at ${name}:${route || '/'}`, async t => {
    const deployment = fixture.pagesDeployments.find(item => item.name === name);
    assert.equal(deployment.output, fixture.pagesOutput, 'Every route serves the same build directory');
    const page = await pageFor(t, 'pages', { viewport: { width: 1440, height: 1040 } }, new URL(route, deployment.url).href);
    await page.locator('[data-shape="puffy"]').click();
    await page.locator('[data-equipment="eyes"][data-accessory="glasses"]').click();
    await page.getByRole('tab', { name: '카메라', exact: true }).click();
    await page.locator('[data-camera-preset="three-quarter"]').click();
    await page.waitForFunction(() => {
      const avatar = document.getElementById('flat');
      return avatar?.ready === true && avatar.design.body.shape === 'puffy' && avatar.camera.yaw === 45 && avatar.design.accessories.some(item => item.preset === 'glasses');
    });
    await settle(page);
    const live = await page.locator('#flat').evaluate(async element => {
      const capture = (await element.capturePixelsAsync());
      return { ready: element.ready, backend: element.diagnostics.backend, shape: element.design.body.shape, accessories: element.design.accessories.map(item => item.preset),
        yaw: element.camera.yaw, visible: capture.pixels.some((value, index) => index % 4 === 3 && value === 255), transparent: capture.pixels[3] === 0 };
    });
    assert.equal(live.ready, true); assert.equal(live.backend, 'worker'); assert.ok(page.workers().length > 0); assert.equal(live.shape, 'puffy'); assert.ok(live.accessories.includes('glasses'));
    assert.equal(live.yaw, 45); assert.equal(live.visible, true); assert.equal(live.transparent, true);
    const result = await page.evaluate(async () => {
      const tiles = [...document.querySelectorAll('[data-equipment][data-accessory]')];
      const images = tiles.map(tile => tile.querySelector('img'));
      if (images.some(image => !image)) throw new Error('An equipment tile has no preview image');
      for (const image of images) image.loading = 'eager';
      await Promise.all(images.map(image => image.decode()));
      await document.fonts.load('16px "Geist Variable"'); await document.fonts.ready;
      const icon = document.querySelector('link[rel~="icon"]');
      if (!icon) throw new Error('Studio must declare a deployment-relative favicon');
      const iconResponse = await fetch(icon.href);
      if (!iconResponse.ok) throw new Error('Favicon failed: ' + icon.href);
      const iconImage = new Image(); iconImage.src = icon.href; await iconImage.decode();
      return {
        images: tiles.map((tile, index) => ({ preset: tile.dataset.accessory, slot: tile.dataset.equipment, src: images[index].src, width: images[index].naturalWidth })),
        modules: [...document.querySelectorAll('script[type="module"][src]')].map(script => script.src),
        stylesheets: [...document.querySelectorAll('link[rel="stylesheet"]')].map(link => ({ href: link.href, rules: link.sheet?.cssRules.length ?? 0 })),
        fonts: [...document.fonts].filter(font => font.status === 'loaded').map(font => font.family),
        fontFamily: getComputedStyle(document.body).fontFamily,
        favicon: { href: icon.href, status: iconResponse.status, width: iconImage.naturalWidth },
        home: document.querySelector('.brand').href,
      };
    });
    const manifest = JSON.parse(await readFile(`${fixture.pagesOutput}/accessory-previews/manifest.json`, 'utf8'));
    assert.deepEqual([...new Set(result.images.map(image => image.preset))].sort(), manifest.items.map(item => item.preset).sort(), 'Every catalog preview is decoded');
    assert.deepEqual([...new Set(result.images.map(image => image.slot))].sort(), ['head', 'eyes', 'mouth', 'neck', 'leftEar', 'rightEar'].sort());
    assert.ok(result.images.every(image => image.width >= 72 && new URL(image.src).pathname === `${deployment.basePath}accessory-previews/${image.preset}.png`));
    assert.ok(result.modules.length > 0); assert.ok(result.stylesheets.length > 0);
    assert.ok(result.stylesheets.every(sheet => sheet.rules > 0), 'Built CSS was loaded and parsed');
    assert.ok(result.fonts.some(family => family.includes('Geist')), 'The actual bundled font loaded');
    assert.match(result.fontFamily, /Geist/);
    assert.equal(new URL(result.favicon.href).pathname, `${deployment.basePath}favicon.svg`); assert.equal(result.favicon.status, 200); assert.ok(result.favicon.width > 0);
    assert.equal(result.home, deployment.url, 'Home works from both the directory and explicit nested index entry');
    await page.waitForLoadState('networkidle');
    const diagnostics = assertDeploymentResources(page, deployment), successful = new Set(diagnostics.responses.map(response => response.url));
    for (const url of [...result.modules, ...result.stylesheets.map(sheet => sheet.href), ...result.images.map(image => image.src), result.favicon.href]) assert.ok(successful.has(url), `No successful response for ${url}`);
    assert.ok(diagnostics.responses.some(response => response.type === 'font' && /font\/woff2/.test(response.contentType)), 'Chromium requested a real WOFF2 asset');
    for (const url of [...result.modules, ...result.stylesheets.map(sheet => sheet.href)]) assert.ok(new URL(url).pathname.startsWith(`${deployment.basePath}assets/`), url);
    if (screenshots) await page.screenshot({ path: `${screenshots}/library-pages-${name}-${route.replaceAll('/', '-').replaceAll('.', '-') || 'index'}.png` });
  });
}

for (const name of ['root', 'project']) for (const route of ['production-react.html', 'playground/production-react.html']) {
  test(`one production React artifact resolves its lazy renderer at ${name}:${route}`, async t => {
    const deployment = fixture.productionReactDeployments.find(item => item.name === name);
    assert.equal(deployment.output, fixture.productionReactOutput);
    const page = await pageFor(t, 'react', {}, new URL(route, deployment.url).href);
    assert.equal(await page.evaluate(() => window.consumer.registeredBeforeMount), false, 'The renderer was not statically registered before the React mount');
    await compareReactPixelsToNative(t, page, `library-production-react-${name}-${route.startsWith('playground/') ? 'nested' : 'root'}`);
    await page.evaluate(() => window.renderConsumer({ shape: 'heart', bodyColor: '#b7a5ce', mouseTracking: false }));
    await page.waitForFunction(() => window.consumer.element?.design.body.shape === 'heart');
    assert.equal((await stateOf(page, '#react-avatar')).design.body.color, '#b7a5ce');
    await page.locator('#react-avatar').focus(); await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => window.consumer.events.filter(event => event.name === 'Activate').length), 1);
    await page.waitForLoadState('networkidle');
    const diagnostics = assertDeploymentResources(page, deployment);
    const manifest = fixture.productionReactManifest;
    const elementKey = Object.keys(manifest).find(key => key.endsWith('/element/avatar.js'));
    const fallbackKey = Object.keys(manifest).find(key => key.endsWith('/runtime/render-engine.js'));
    assert.ok(elementKey && fallbackKey, 'The production graph retains separate element and fallback boundaries');
    const elementChunk = manifest[elementKey], fallbackChunk = manifest[fallbackKey];
    assert.equal(elementChunk.isDynamicEntry, true); assert.equal(fallbackChunk.isDynamicEntry, true);
    assert.ok(elementChunk.dynamicImports.includes(fallbackKey));
    const elementURL = new URL(elementChunk.file, deployment.url).href;
    const fallbackURL = new URL(fallbackChunk.file, deployment.url).href;
    assert.ok(diagnostics.responses.some(response => response.url === elementURL && response.type === 'script'), 'React loaded its actual lazy custom-element chunk');
    assert.ok(!diagnostics.resources.some(resource => resource.url === fallbackURL), 'Healthy worker startup must not load the main-thread fallback engine');
    assert.equal(await page.locator('#react-avatar').evaluate(element => element.diagnostics.backend), 'worker');
    const workerURLs = (elementChunk.assets ?? []).filter(file => /render-worker.*\.js$/.test(file)).map(file => new URL(file, deployment.url).href);
    assert.equal(workerURLs.length, 1, 'The built element points to one emitted render worker');
    assert.ok(page.workers().some(worker => worker.url() === workerURLs[0]), 'The actual emitted worker runs at the deployment-relative URL');
  });
}

for (const name of ['root', 'project']) {
  test(`production React lazy fallback resolves at ${name}:playground/production-react.html`, async t => {
    const deployment = fixture.productionReactDeployments.find(item => item.name === name);
    const page = await pageFor(t, 'react', { forceMain: true }, new URL('playground/production-react.html', deployment.url).href);
    await compareReactPixelsToNative(t, page, `library-production-react-${name}-fallback`);
    assert.equal(await page.locator('#react-avatar').evaluate(element => element.diagnostics.backend), 'main');
    assert.equal(page.workers().length, 0);
    await page.waitForLoadState('networkidle');
    const diagnostics = assertDeploymentResources(page, deployment);
    const key = Object.keys(fixture.productionReactManifest).find(key => key.endsWith('/runtime/render-engine.js'));
    const chunk = fixture.productionReactManifest[key]; assert.equal(chunk?.isDynamicEntry, true);
    const url = new URL(chunk.file, deployment.url).href;
    assert.ok(diagnostics.responses.some(response => response.url === url && response.type === 'script'), 'The fallback chunk loads when worker rendering is unavailable');
  });
}

test('Studio JSON file import applies a complete scene and export round-trips it; rejected files preserve live state and storage', async t => {
  const page = await pageFor(t, 'studio', { viewport: { width: 1440, height: 1040 } });
  await page.getByRole('tab', { name: 'JSON', exact: true }).click();
  const scene = await page.evaluate(() => window.libraryAPI.createScene({
    design: window.libraryAPI.createDesign({ body: { shape: 'heart', color: '#b7a5ce' }, eyes: { left: { weights: { smile: 0.7, blink: 0.2 } } }, accessories: [window.libraryAPI.createAccessory('glasses', 'frames')] }),
    camera: { yaw: 32, pitch: -8, roll: 7 }, activity: 'thinking', paused: true, mouseTracking: false, interaction: 'box',
    gaze: { x: -0.4, y: 0.3 }, time: 1.5, shapeDuration: 250, shapeEasing: 'linear', motionDuration: 160, motionEasing: 'linear',
    motion: { body: { rotation: [0, 0.1, 0.3] }, face: { uv: [0.2, -0.1] }, accessories: { frames: { rotation: [0, 0.1, 0] } } },
  }));
  const input = page.locator('#import-scene-file');
  const file = value => ({ name: 'scene.json', mimeType: 'application/json', buffer: Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)) });
  await input.setInputFiles(file(scene));
  await page.waitForFunction(() => document.getElementById('flat').design.body.color === '#b7a5ce');
  const loaded = await stateOf(page, '#flat');
  assert.deepEqual(loaded.design, scene.design); assert.deepEqual(loaded.camera, scene.camera); assert.deepEqual(loaded.gaze, [-0.4, 0.3]);
  assert.equal(loaded.activity, scene.activity); assert.equal(loaded.paused, true); assert.equal(loaded.mouseTracking, false);
  assert.deepEqual(JSON.parse(await page.locator('#design-json').inputValue()), scene);
  assert.deepEqual(await page.locator('#flat').evaluate(element => [element.pose.rotation, element.pose.face, element.pose.accessories.frames]), [[0, 0.1, 0.3], [0.2, -0.1], [0, 0.1, 0]]);
  const downloadEvent = page.waitForEvent('download'); await page.locator('#export-json').click(); const download = await downloadEvent;
  assert.equal(download.suggestedFilename(), 'sidekick.scene.json'); assert.deepEqual(JSON.parse(await readFile(await download.path(), 'utf8')), scene);
  const snapshot = () => page.locator('#flat').evaluate(element => ({ design: element.design, camera: element.camera, pose: element.pose, paused: element.paused, tracking: element.mouseTracking, activity: element.activity, storage: Object.fromEntries(Object.entries(localStorage)), json: document.getElementById('design-json').value }));
  const before = await snapshot();
  for (const [bad, message] of [
    ['{', /./], [{ ...scene, camera: { ...scene.camera, pitch: 91 } }, /camera\.pitch/],
    [{ ...scene, motion: { accessories: { 'missing-accessory': { rotation: [0, 0, 0] } } } }, /missing-accessory/],
    [{ ...scene, unexpected: true }, /unexpected/], [' '.repeat(65537), /64 KiB/],
  ]) {
    await input.setInputFiles(file(bad));
    await page.waitForFunction(source => new RegExp(source).test(document.getElementById('json-error').textContent), message.source);
    assert.deepEqual(await snapshot(), before, `Invalid file ${message} must be atomic`);
    assert.equal(await input.inputValue(), '', 'The same filename can be selected again');
  }
  // Repair using exactly the same filename, then accept the supported legacy design-only shape.
  await input.setInputFiles(file(scene)); await page.waitForFunction(() => document.getElementById('json-error').textContent === '');
  const legacy = { ...scene.design, body: { shape: 'puffy', color: '#81b5a1' } };
  await input.setInputFiles(file(legacy)); await page.waitForFunction(() => document.getElementById('flat').design.body.shape === 'puffy');
  const migrated = await stateOf(page, '#flat'); assert.deepEqual(migrated.design, legacy); assert.deepEqual(migrated.camera, { yaw: 0, pitch: 0, roll: 0, zoom: 1 });
  assert.equal(migrated.mouseTracking, false); assert.equal(migrated.paused, false); assert.equal(migrated.activity, 'idle');
});

test('Studio PNG download contains the tightly cropped transparent image at its actual alpha dimensions', async t => {
  const page = await pageFor(t, 'studio');
  const expected = await page.locator('#flat').evaluate(async element => {
    const { width, height, pixels } = (await element.capturePixelsAsync());
    let minX = width, minY = height, maxX = -1, maxY = -1, visible = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (pixels[(y * width + x) * 4 + 3]) {
      visible++; minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
    return { width: maxX - minX + 1, height: maxY - minY + 1, sourceWidth: width, sourceHeight: height, visible };
  });
  const downloadEvent = page.waitForEvent('download'); await page.locator('#export-png').click(); const download = await downloadEvent;
  const data = await readFile(await download.path());
  assert.equal(download.suggestedFilename(), 'sidekick.png'); assert.equal(data.subarray(1, 4).toString(), 'PNG');
  assert.equal(data.readUInt32BE(16), expected.width); assert.equal(data.readUInt32BE(20), expected.height);
  assert.ok(expected.width < expected.sourceWidth && expected.height < expected.sourceHeight);
  const image = await page.evaluate(async bytes => {
    const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/png' })), canvas = document.createElement('canvas');
    canvas.width = bitmap.width; canvas.height = bitmap.height; const context = canvas.getContext('2d'); context.drawImage(bitmap, 0, 0); bitmap.close();
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data; let visible = 0, transparent = 0;
    for (let i = 3; i < pixels.length; i += 4) { if (pixels[i]) visible++; else transparent++; }
    return { visible, transparent };
  }, [...data]);
  assert.equal(image.visible, expected.visible); assert.ok(image.transparent > 100, 'PNG retains transparent space outside the curved silhouette');
});


test('tracking modes render eye-only and additive body behavior while preserving the real motion timeline', async t => {
  const page = await pageFor(t, 'vanilla', { reducedMotion: 'no-preference' });
  await page.locator('#bare').evaluate(async element => {
    element.setActivity('still'); element.trackingMode = 'eyes';
    window.trackingFrames = { at: () => element.diagnostics.renderedRotation };
    window.baselineAlpha = (await element.capturePixelsAsync()).pixels.filter((_, i) => i % 4 === 3);
    document.dispatchEvent(new PointerEvent('pointermove', { clientX: 10000, clientY: -10000, pointerType: 'mouse' }));
  });
  await page.waitForFunction(() => document.getElementById('bare').pose.gaze[0] > .99);
  const eyes = await page.locator('#bare').evaluate(async element => ({
    base: element.pose.rotation, rendered: window.trackingFrames.at(-1), camera: element.camera,
    sameBody: (await element.capturePixelsAsync()).pixels.filter((_, i) => i % 4 === 3).every((alpha, i) => alpha === window.baselineAlpha[i]),
  }));
  assert.deepEqual(eyes.base, [0, 0, 0]); assert.deepEqual(eyes.rendered, eyes.base); assert.equal(eyes.sameBody, true);
  const start = await page.locator('#bare').evaluate(element => {
    window.bodyMotionFinished = false;
    element.motion.to({ body: { rotation: [.2, .3, .1] } }, { duration: 800, easing: 'linear' }).then(result => { window.bodyMotionFinished = result.finished; });
    const before = window.trackingFrames.at(-1); element.trackingMode = 'eyes-and-body';
    return { before, after: window.trackingFrames.at(-1) };
  });
  assert.deepEqual(start.after, start.before, 'Changing modes must not snap the rendered body');
  await page.waitForFunction(() => window.bodyMotionFinished && window.trackingFrames.at(-1)[1] > .5);
  const body = await page.locator('#bare').evaluate(element => ({ base: element.pose.rotation, rendered: window.trackingFrames.at(-1), camera: element.camera }));
  assert.deepEqual(body.base, [.2, .3, .1]); assert.deepEqual(body.camera, eyes.camera);
  for (const [i, limit] of [[0, .14], [1, .22], [2, .035]]) assert.ok(Math.abs(body.rendered[i] - body.base[i]) <= limit + .000001);
  const off = await page.locator('#bare').evaluate(element => {
    const before = window.trackingFrames.at(-1); element.trackingMode = 'off';
    return { before, after: window.trackingFrames.at(-1), listeners: window.listenerAudit(element) };
  });
  assert.deepEqual(off.after, off.before); assert.equal(off.listeners.globalPointer, 0); assert.equal(off.listeners.globalTrackingExit, 0);
  await page.waitForFunction(() => window.trackingFrames.at(-1).every((value, i) => Math.abs(value - document.getElementById('bare').pose.rotation[i]) < .00001));
});

test('named tracking precedence, viewport leave, reduced-motion changes and reconnect remain safe in a browser', async t => {
  const page = await pageFor(t, 'vanilla', { reducedMotion: 'no-preference' });
  await page.locator('#bare').evaluate(element => {
    element.setActivity('still'); element.lookAt({ space: 'view', x: .2, y: -.3 });
    element.mouseTracking = false; element.trackingMode = 'eyes-and-body';
    Object.defineProperty(window, 'trackingRotation', { configurable: true, get: () => element.diagnostics.renderedRotation });
    document.dispatchEvent(new PointerEvent('pointermove', { clientX: 9000, clientY: -9000, pointerType: 'mouse' }));
  });
  await page.waitForFunction(() => window.trackingRotation?.[1] > .2);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // The neutral spring keeps running until both displacement and velocity settle.
  // Require its exact stopped endpoint before comparing an exact neutral pose.
  await page.waitForFunction(() => !document.getElementById('bare').diagnostics.running && window.trackingRotation.every(value => value === 0));
  const reduced = await page.locator('#bare').evaluate(async element => {
    document.dispatchEvent(new PointerEvent('pointermove', { clientX: -9000, clientY: 9000, pointerType: 'mouse' }));
    await element.capturePixelsAsync();
    const active = { mode: element.trackingMode, enabled: element.mouseTracking, gaze: element.pose.gaze, rotation: window.trackingRotation };
    document.dispatchEvent(new PointerEvent('pointerout', { pointerType: 'mouse', relatedTarget: null }));
    await element.capturePixelsAsync();
    return { active, restored: element.pose.gaze };
  });
  assert.equal(reduced.active.mode, 'eyes-and-body'); assert.equal(reduced.active.enabled, true);
  assert.deepEqual(reduced.active.gaze, [-1, -1]); assert.deepEqual(reduced.active.rotation, [0, 0, 0]); assert.deepEqual(reduced.restored, [.2, -.3]);
  const rounds = await page.locator('#bare').evaluate(async element => {
    const parent = element.parentElement, rounds = [];
    for (let i = 0; i < 3; i++) {
      element.remove(); const detached = window.listenerAudit(element);
      parent.append(element); await element.capturePixelsAsync();
      rounds.push({ detached, connected: window.listenerAudit(element), mode: element.trackingMode });
    }
    element.removeAttribute('tracking-mode'); await Promise.resolve();
    return { rounds, mode: element.trackingMode, enabled: element.mouseTracking, listeners: window.listenerAudit(element) };
  });
  for (const round of rounds.rounds) {
    assert.equal(round.detached.globalPointer, 0); assert.equal(round.detached.globalTrackingExit, 0);
    assert.equal(round.connected.globalPointer, 1); assert.equal(round.connected.globalTrackingExit, 2); assert.equal(round.mode, 'eyes-and-body');
  }
  assert.equal(rounds.mode, 'off'); assert.equal(rounds.enabled, false); assert.equal(rounds.listeners.globalPointer, 0); assert.equal(rounds.listeners.globalTrackingExit, 0);
});

test('React named tracking mode and Studio body choice export the same canonical behavior', async t => {
  const page = await pageFor(t, 'react');
  await page.evaluate(() => window.renderConsumer({ trackingMode: 'eyes-and-body', mouseTracking: false }));
  let state = await page.locator('#react-avatar').evaluate(element => ({ mode: element.trackingMode, enabled: element.mouseTracking }));
  assert.deepEqual(state, { mode: 'eyes-and-body', enabled: true });
  await page.evaluate(() => window.renderConsumer({ trackingMode: 'off', mouseTracking: true }));
  state = await page.locator('#react-avatar').evaluate(element => ({ mode: element.trackingMode, enabled: element.mouseTracking }));
  assert.deepEqual(state, { mode: 'off', enabled: false });
  const studio = await pageFor(t, 'studio');
  await studio.locator('#animation-tab').click(); await studio.locator('#tracking-eyes-and-body').click();
  assert.equal(await studio.locator('#flat').evaluate(element => element.trackingMode), 'eyes-and-body');
  await studio.locator('#json-tab').click();
  const scene = JSON.parse(await studio.locator('#design-json').inputValue());
  assert.equal(scene.sceneVersion, 2); assert.equal(scene.trackingMode, 'eyes-and-body'); assert.equal('mouseTracking' in scene, false);
  assert.match(await studio.locator('#api-example').textContent(), /tracking-mode="eyes-and-body"/);
  assert.match(await studio.locator('#react-example').textContent(), /trackingMode=\{"eyes-and-body"\}/);
});


test('paused tracking settles to neutral and Studio imports do not retain an old rendered body offset', async t => {
  const page = await pageFor(t, 'studio', { reducedMotion: 'no-preference' });
  await page.locator('#flat').evaluate(element => {
    element.setActivity('still'); element.trackingMode = 'eyes-and-body';
    Object.defineProperty(window, 'trackingRotation', { configurable: true, get: () => element.diagnostics.renderedRotation });
    document.dispatchEvent(new PointerEvent('pointermove', { clientX: 10000, clientY: -10000, pointerType: 'mouse' }));
  });
  await page.waitForFunction(() => window.trackingRotation?.[1] > .2);
  const change = await page.locator('#flat').evaluate(async element => {
    element.paused = true; await element.capturePixelsAsync(); const before = window.trackingRotation;
    element.trackingMode = 'off'; return { before, after: window.trackingRotation, time: element.diagnostics.time };
  });
  assert.deepEqual(change.after, change.before);
  await page.waitForFunction(() => window.trackingRotation.every(value => Math.abs(value) < .00001));
  assert.equal(await page.locator('#flat').evaluate(element => element.diagnostics.time), change.time);
  await page.locator('#flat').evaluate(element => {
    element.paused = false; element.trackingMode = 'eyes-and-body';
    document.dispatchEvent(new PointerEvent('pointermove', { clientX: 10000, clientY: -10000, pointerType: 'mouse' }));
  });
  await page.waitForFunction(() => window.trackingRotation[1] > .2);
  const scene = await page.evaluate(() => window.libraryAPI.createScene({
    design: document.getElementById('flat').design, paused: true, trackingMode: 'eyes-and-body', activity: 'still',
    motion: { body: { rotation: [.1, -.2, .3] } },
  }));
  await page.locator('#import-scene-file').setInputFiles({ name: 'tracking-scene.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(scene)) });
  await page.waitForFunction(() => document.getElementById('flat').pose.rotation[1] === -.2);
  const imported = await page.locator('#flat').evaluate(async element => { await element.capturePixelsAsync(); return { rendered: window.trackingRotation, base: element.pose.rotation, mode: element.trackingMode }; });
  assert.deepEqual(imported.rendered, [.1, -.2, .3]); assert.deepEqual(imported.base, imported.rendered); assert.equal(imported.mode, 'eyes-and-body');
});
