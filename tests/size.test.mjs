import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { SIZE_RANGE, validateSize } from '../src/core/size.ts';
import { resolveSidekickAttributes } from '../src/element/attributes.ts';
import { countingCanvas } from './performance-fixture.mjs';
import { AvatarRenderer } from '../src/renderer/webgl.ts';
import { createDesign, createAccessory } from '../src/core/design.ts';
import { initialPose } from '../src/core/motion.ts';
import { ShapeTimeline } from '../src/core/shape-motion.ts';
let dom, SidekickAvatar, queries = [];
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
before(async () => {
  dom = new JSDOM('<!doctype html><body></body>', { pretendToBeVisual: true });
  for (const name of ['window', 'document', 'HTMLElement', 'CustomEvent', 'customElements']) globalThis[name] = dom.window[name];
  globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  dom.window.matchMedia = query => { const listeners = new Set(); const media = { query, listeners, addEventListener: (_, cb) => listeners.add(cb), removeEventListener: (_, cb) => listeners.delete(cb) }; queries.push(media); return media; };
  globalThis.ResizeObserver = class { observe() {} disconnect() {} };
  globalThis.IntersectionObserver = class { observe() {} disconnect() {} };
  globalThis.requestAnimationFrame = () => 1; globalThis.cancelAnimationFrame = () => {};
  ({ SidekickAvatar } = await import('../src/element/avatar.ts'));
  SidekickAvatar.prototype.initializeRenderer = function () {};
  customElements.define('size-test-avatar', SidekickAvatar);
});
after(() => dom.window.close());
function avatar(t) { const a = document.createElement('size-test-avatar'); document.body.append(a); t.after(() => a.remove()); return a; }

test('size validates the same finite CSS-pixel limits in numeric API and HTML', () => {
  assert.deepEqual(SIZE_RANGE, { min: 1, max: 2048, default: 200 });
  for (const size of [1, 1.5, 120, 160.5, 200, 2048]) {
    assert.equal(validateSize(size), size);
    assert.equal(resolveSidekickAttributes(new Map([['size', String(size)]])).size, size);
  }
  for (const value of [NaN, Infinity, -Infinity, 0, -1, .99, 2048.01, '120', undefined, null, {}, true]) assert.throws(() => validateSize(value));
  for (const value of ['', ' ', '120px', '0x80', 'NaN', 'Infinity', '0', '-1', '2049']) assert.throws(() => resolveSidekickAttributes(new Map([['size', value]])), { attribute: 'size' });
  assert.equal(resolveSidekickAttributes(new Map()).size, null);
});

test('property reflects synchronously, owns scoped dimensions without editing consumer CSS, and resets', async t => {
  const a = avatar(t); a.style.cssText = 'width:300px;height:180px;min-width:40px;';
  assert.equal(a.size, 200); a.zoom = 1.5; a.size = 120;
  assert.equal(a.size, 120); assert.equal(a.getAttribute('size'), '120'); assert.equal(a.zoom, 1.5);
  assert.equal(a.style.width, '300px'); assert.equal(a.style.height, '180px'); assert.equal(a.style.minWidth, '40px');
  assert.match(a.sizeStyle.textContent, /width:120px!important;height:120px!important/);
  assert.match(a.sizeStyle.textContent, /min-width:120px!important;max-width:120px!important/);
  a.style.width = '340px'; a.style.height = '190px'; a.size = 160.5;
  assert.equal(a.size, 160.5); assert.equal(a.style.width, '340px');
  a.size = null; assert.equal(a.hasAttribute('size'), false); assert.equal(a.size, 200); assert.equal(a.sizeStyle.textContent, '');
  assert.equal(a.style.width, '340px'); assert.equal(a.style.height, '190px');
  a.setAttribute('size', '96'); await flush(); assert.equal(a.size, 96);
  a.removeAttribute('size'); await flush(); assert.equal(a.size, 200); assert.equal(a.sizeStyle.textContent, '');
});

test('invalid imperative and atomic HTML writes preserve last accepted size', async t => {
  const a = avatar(t), errors = []; a.addEventListener('sidekick-error', e => errors.push(e.detail)); a.size = 120;
  for (const value of [0, Infinity, NaN, '80', undefined, -100, 2049]) { assert.throws(() => { a.size = value; }); assert.equal(a.size, 120); assert.equal(a.getAttribute('size'), '120'); }
  a.setAttribute('size', '0'); a.setAttribute('body-color', '#123456'); await flush();
  assert.equal(a.size, 120); assert.notEqual(a.design.body.color, '#123456'); assert.equal(errors.at(-1).attribute, 'size');
  a.setAttribute('size', '88'); await flush(); assert.equal(a.size, 88); assert.equal(a.design.body.color, '#123456');
  a.setAttribute('size', 'bad'); await flush(); a.size = 100; await flush(); assert.equal(a.size, 100);
});

test('initial attributes, pre-upgrade property precedence and reconnect retain size', async t => {
  const a = document.createElement('late-size-avatar'); a.setAttribute('size', '80'); a.size = 140.5; document.body.append(a); t.after(() => a.remove());
  class LateAvatar extends SidekickAvatar {} customElements.define('late-size-avatar', LateAvatar); await flush();
  assert.equal(a.size, 140.5); assert.equal(a.getAttribute('size'), '140.5'); assert.equal(Object.hasOwn(a, 'size'), false);
  const style = a.sizeStyle; a.remove(); a.size = 96; document.body.append(a); await flush();
  assert.equal(a.size, 96); assert.equal(a.sizeStyle, style); assert.match(style.textContent, /width:96px/);
});

test('size, ResizeObserver and DPR-only changes send derived logical size and latest DPR', t => {
  const a = avatar(t), commands = []; a.send = command => commands.push(command);
  // Geometry is stubbed here; actual CSS cascade is covered by size-browser.test.mjs.
  a.getBoundingClientRect = () => ({ left: 0, top: 0, width: a.size, height: a.size });
  a.size = 120; a.flushInput(); assert.deepEqual(commands.at(-1), { kind: 'resize', width: 120, height: 120, dpr: 1 });
  const media = queries.at(-1); Object.defineProperty(dom.window, 'devicePixelRatio', { value: 2, configurable: true });
  for (const callback of [...media.listeners]) callback(); a.flushInput();
  assert.deepEqual(commands.at(-1), { kind: 'resize', width: 120, height: 120, dpr: 2 });
  assert.equal(media.listeners.size, 0); assert.equal(queries.at(-1).query, '(resolution: 2dppx)');
  const current = queries.at(-1); a.remove(); assert.equal(current.listeners.size, 0);
  Object.defineProperty(dom.window, 'devicePixelRatio', { value: 1, configurable: true });
});

test('backing resolution follows logical size and DPR without accessory-dependent body framing', () => {
  const fixture = countingCanvas(), renderer = new AvatarRenderer(fixture.canvas); let projection;
  fixture.gl.uniformMatrix4fv = (location, _, matrix) => { if (location.name === 'projection') projection = [...matrix]; };
  const frame = { pose: initialPose(), time: 0, delta: 0, activity: 'still', reduced: true, style: 'flat', zoom: 1, ...new ShapeTimeline('circle').snapshot };
  let reference;
  for (const size of [1, 120, 160.5, 200, 2048]) for (const dpr of [1, 1.5, 2, 3]) {
    renderer.resize(size, size, dpr);
    const backing = Math.min(2048, Math.max(1, Math.round(size * Math.min(2, dpr))));
    assert.deepEqual([fixture.canvas.width, fixture.canvas.height], [backing, backing]);
    for (const accessories of [[], [createAccessory('glasses')], [createAccessory('crown'), createAccessory('scarf')]]) {
      renderer.render(createDesign({ body: { shape: 'circle' }, accessories }), frame);
      reference ??= projection; assert.deepEqual(projection, reference);
    }
  }
  renderer.dispose();
});

test('initial HTML applies before renderer startup without touching width/height styles', async t => {
  const a = document.createElement('size-test-avatar'); a.setAttribute('size', '120'); a.style.width = '300px';
  document.body.append(a); t.after(() => a.remove());
  assert.equal(a.size, 120); assert.match(a.sizeStyle.textContent, /width:120px!important/); assert.equal(a.style.width, '300px');
  await flush(); assert.equal(a.size, 120);
});

test('no-WebGL browser fixture denies both realm context APIs without faking Canvas or diagnostics', async () => {
  const { installNoWebGL } = await import('./helpers/force-no-webgl.mjs');
  const { runInNewContext } = await import('node:vm');
  for (const worker of [false, true]) {
    const calls = [], canvasContext = {};
    class Surface { getContext(...args) { calls.push({ receiver: this, args }); return canvasContext; } }
    const realm = worker ? { OffscreenCanvas: Surface } : { HTMLCanvasElement: Surface };
    runInNewContext(`(${installNoWebGL.toString()})();`, realm);
    const canvas = new Surface();
    for (const kind of ['webgl', 'webgl2', 'experimental-webgl']) assert.equal(canvas.getContext(kind), null);
    assert.equal(realm.__sidekickNoWebGL.denied, 3); assert.equal(calls.length, 0);
    const options = { alpha: true }; assert.equal(canvas.getContext('2d', options), canvasContext);
    assert.equal(calls[0].receiver, canvas); assert.deepEqual(calls[0].args, ['2d', options]);
    assert.equal(realm.graphics, undefined, 'fixture cannot forge backend diagnostics');
  }
});

test('forced Canvas worker URL inventory covers all emitted distributions without unrelated scripts', async () => {
  const { isSidekickWorkerURL } = await import('./helpers/force-no-webgl.mjs');
  for (const path of ['/src/runtime/render-worker.js', '/library/runtime/render-worker.js', '/runtime/render-worker.js', '/browser/sidekick.worker.js', '/prebuilt/browser/sidekick.worker.js', '/sidekick.worker.js', '/assets/render-worker-a_B-123.js', '/deploy/subpath/assets/render-worker-hash.js']) {
    for (const suffix of ['', '?v=123', '?worker_file&type=module']) assert.equal(isSidekickWorkerURL(`https://fixture.test${path}${suffix}`), true, path + suffix);
  }
  for (const path of ['/src/auto.js', '/browser/sidekick.js', '/assets/index-123.js', '/assets/other-worker-123.js', '/runtime/render-worker.js.map', '/assets/render-worker-123.js.map']) assert.equal(isSidekickWorkerURL(`https://fixture.test${path}`), false, path);
});

test('shared forced Canvas setup instruments before navigation and audits real active realms', async () => {
  const { forceCanvasForPage, isSidekickWorkerURL, installNoWebGL } = await import('./helpers/force-no-webgl.mjs');
  let init, matcher, handler, responseCount = 0, denied = 0, workerDenied = 0;
  const worker = { url: () => 'https://fixture.test/assets/render-worker-123.js', evaluate: async () => workerDenied };
  const page = {
    addInitScript: async fn => { init = fn; },
    context: () => ({ route: async (match, fn) => { matcher = match; handler = fn; } }),
    frames: () => [{ evaluate: async () => denied }], workers: () => [worker],
  };
  const audit = await forceCanvasForPage(page);
  assert.equal(init, installNoWebGL); assert.equal(matcher, isSidekickWorkerURL);
  await assert.rejects(audit.assertDenied(), /No Window/);
  await assert.rejects(audit.assertDenied({ worker: true }), /instrumented worker/);
  for (let i = 0; i < 2; i++) {
    const response = { text: async () => '/* actual production worker unchanged */' };
    await handler({ fetch: async () => response, fulfill: async value => {
      responseCount++; assert.equal(value.response, response);
      assert.equal(value.body, `(${installNoWebGL.toString()})();\n/* actual production worker unchanged */`);
    } });
  }
  await assert.rejects(audit.assertDenied({ worker: true }), /No active Sidekick worker/);
  denied = 1; workerDenied = 1;
  await audit.assertDenied(); await audit.assertDenied({ worker: true, minWorkerResponses: 2 });
  assert.equal((await audit.read()).workerResponses, responseCount);
  await assert.rejects(audit.assertDenied({ worker: true, minWorkerResponses: 3 }), /instrumented worker/);
});

test('forced Canvas entrypoint inventory routes every state reference page including copied examples', async () => {
  const { readFile, readdir } = await import('node:fs/promises');
  const files = ['state-reference', 'size', 'canvas-fallback', 'api-playground'];
  const discovered = [];
  for (const file of await readdir(new URL('.', import.meta.url))) {
    if (!file.endsWith('-browser.test.mjs')) continue;
    const source = await readFile(new URL(file, import.meta.url), 'utf8');
    if (/SIDEKICK_FORCE_CANVAS2D|--disable-webgl/.test(source)) discovered.push(file.replace('-browser.test.mjs', ''));
  }
  assert.deepEqual(discovered.sort(), [...files].sort(), 'new forced Canvas entrypoints must join the shared setup inventory');
  for (const name of files) {
    const text = await readFile(new URL(`./${name}-browser.test.mjs`, import.meta.url), 'utf8');
    assert.match(text, /forceCanvasForPage/, `${name} uses the shared fixture, not browser flags alone`);
    // All entrypoints create their pages in one setup wrapper (or one test loop)
    // so adding an uninstrumented replay/new tab fails this source inventory.
    assert.equal((text.match(/browser\.newPage\(/g) ?? []).length, 1, `${name}: all pages share one setup path`);
    assert.doesNotMatch(text, /addInitScript\(installNoWebGL\)/, `${name}: no drifting private fixture`);
  }
  const reference = await readFile(new URL('./state-reference-browser.test.mjs', import.meta.url), 'utf8');
  assert.equal((reference.match(/await assertGraphics\(replay\)/g) ?? []).length, 3, 'all three copied-source replay families verify graphics and denial after readiness');
});
