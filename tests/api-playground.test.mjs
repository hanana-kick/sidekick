import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

const html = await readFile(new URL('../api-playground.html', import.meta.url), 'utf8');
const script = (await readFile(new URL('../playground/api-playground.js', import.meta.url), 'utf8')).replace(/^import[^\n]+\n/gm, '');
const flush = () => new Promise(resolve => setImmediate(resolve));
function fixture(t) {
  const dom = new JSDOM(html, { url: 'https://sidekick.test/api-playground.html', runScripts: 'outside-only', pretendToBeVisual: true });
  t.after(() => dom.window.close());
  const w = dom.window, $ = id => w.document.getElementById(id);
  Object.defineProperties(w, { innerWidth: { value: 1280, writable: true }, innerHeight: { value: 900, writable: true } });
  w.matchMedia = () => ({ matches: false, addEventListener() {} });
  w.ResizeObserver = class { observe() {} };
  w.mountSiteHeader = () => {};
  w.createAccessory = preset => ({ preset });
  const bounds = { x: 428, y: 146, left: 428, top: 146, right: 1256, bottom: 786, width: 828, height: 640 };
  $('movement-stage').getBoundingClientRect = () => bounds;
  class MockAvatar extends w.HTMLElement {
    ready = true;
    point = { x: 0, y: 0 };
    activity = 'idle';
    paused = false;
    interaction = 'none';
    calls = [];
    diagnostics = { backend: 'mock' };
    movementState = { phase: 'idle', progress: 0, position: this.point, velocity: { x: 0, y: 0 } };
    get offsetWidth() { return 180; }
    get offsetHeight() { return 180; }
    get position() { return { ...this.point }; }
    getBoundingClientRect() { return { x: this.point.x, y: this.point.y, width: 180, height: 180 }; }
    emit(name, detail) { this.dispatchEvent(new w.CustomEvent(`sidekick-${name}`, { detail })); }
    moveTo(point, options) {
      this.calls.push({ method: 'moveTo', point, options }); this.point = { ...point };
      this.movementState = { ...this.movementState, phase: 'idle', progress: 1, position: this.position };
      this.emit('move-progress', this.movementState);
      const result = { finished: true, position: this.position }; this.emit('move-end', result); return Promise.resolve(result);
    }
    moveBy(delta, options) {
      this.calls.push({ method: 'moveBy', point: delta, options });
      this.point = { x: this.point.x + delta.x, y: this.point.y + delta.y };
      const result = { finished: true, position: this.position }; this.emit('move-end', result); return Promise.resolve(result);
    }
    cancelMove() { this.calls.push({ method: 'cancelMove' }); }
    play(activity, options) { this.calls.push({ method: 'play', activity, options }); this.activity = activity; return Promise.resolve({ finished: true }); }
    stop() { this.calls.push({ method: 'stop' }); this.activity = 'idle'; }
    transitionTo(patch, options) { this.calls.push({ method: 'transitionTo', patch, options }); return Promise.resolve({ finished: true }); }
    cancelTransition() { this.calls.push({ method: 'cancelTransition' }); }
  }
  w.customElements.define('sidekick-avatar', MockAvatar);
  w.eval(script);
  const bot = $('bot'); bot.calls.length = 0;
  function input(id, value) { $(id).value = String(value); $(id).dispatchEvent(new w.Event('input', { bubbles: true })); }
  function pointer(name, x, y, extras = {}) {
    const event = new w.Event(name, { bubbles: true });
    Object.assign(event, { clientX: x, clientY: y, pointerId: 1, isPrimary: true, button: 0, ...extras });
    $('movement-stage').dispatchEvent(event);
  }
  return { w, $, bot, input, pointer, bounds };
}

test('playground moveTo and moveBy use bounded values matching the generated invocation', async t => {
  const f = fixture(t);
  f.input('duration', 850); f.input('easing', 'linear'); f.input('travel', 'none');
  f.input('target-x', 10000); f.input('target-y', -1000); f.$('move').click();
  await flush();
  const first = f.bot.calls.at(-1);
  assert.deepEqual(JSON.parse(JSON.stringify(first)), { method: 'moveTo', point: { x: 1076, y: 146 }, options: { duration: 850, easing: 'linear', travel: 'none' } });
  assert.match(f.$('invocation').textContent, /avatar.moveTo\(\{ x: 1076, y: 146 \}, \{ duration: 850, easing: 'linear', travel: 'none' \}\)/);
  f.input('move-method', 'moveBy'); f.input('target-x', -40); f.input('target-y', 60); f.$('move').click();
  await flush();
  assert.equal(f.bot.position.x, 1036); assert.equal(f.bot.position.y, 206);
  assert.match(f.$('invocation').textContent, /avatar.moveBy\(\{ x: -40, y: 60 \}/);
  assert.equal(f.$('x-label').textContent, 'ΔX · CSS px');
  assert.match(f.$('result-log').textContent, /moveBy result/);
});

test('stage taps center the avatar; drags, scrolls, long presses and secondary pointers do not move', async t => {
  const f = fixture(t);
  f.pointer('pointerdown', 800, 500); f.pointer('pointerup', 800, 500);
  assert.equal(f.bot.position.x, 710); assert.equal(f.bot.position.y, 410);
  const count = f.bot.calls.length;
  f.pointer('pointerdown', 800, 500); f.pointer('pointermove', 800, 530); f.pointer('pointerup', 800, 530);
  f.pointer('pointerdown', 800, 500); f.w.scrollY = 20; f.pointer('pointerup', 800, 500);
  f.pointer('pointerdown', 800, 500); f.pointer('pointercancel', 800, 500); f.pointer('pointerup', 800, 500);
  f.pointer('pointerdown', 800, 500); f.pointer('pointerdown', 810, 500, { pointerId: 2, isPrimary: false }); f.pointer('pointerup', 800, 500);
  const actualNow = f.w.performance.now.bind(f.w.performance); let time = 0;
  f.w.performance.now = () => time;
  f.pointer('pointerdown', 800, 500); time = 700; f.pointer('pointerup', 800, 500);
  f.w.performance.now = actualNow;
  assert.equal(f.bot.calls.length, count);
  f.pointer('pointerdown', 430, 148); f.pointer('pointerup', 430, 148);
  assert.equal(f.bot.position.x, 428); assert.equal(f.bot.position.y, 146);
  await flush();
});

test('keyboard targets and independent stop controls call only their respective APIs', async t => {
  const f = fixture(t), before = f.bot.position;
  f.$('movement-stage').dispatchEvent(new f.w.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
  assert.equal(f.bot.position.x, before.x - 40);
  assert.equal(f.bot.calls.at(-1).method, 'moveBy');
  f.$('cancel').click();
  assert.equal(f.bot.calls.at(-1).method, 'cancelMove');
  assert.match(f.$('invocation').textContent, /avatar.cancelMove\(\)/);
  f.$('cancel-preview').click();
  assert.equal(f.bot.calls.at(-1).method, 'cancelMove');
  assert.equal(f.bot.calls.filter(call => call.method === 'cancelMove').length, 2);
  f.$('play').click(); await flush();
  assert.equal(f.bot.calls.at(-1).method, 'play');
  assert.equal(f.$('activity-state').textContent, 'celebrating');
  f.$('stop').click(); await flush();
  assert.equal(f.bot.calls.at(-1).method, 'stop');
  assert.equal(f.$('activity-state').textContent, 'idle');
});

test('progress events update live state without replacing the invocation or flooding the log', async t => {
  const f = fixture(t), source = f.$('invocation').textContent, logCount = f.$('result-log').children.length;
  f.bot.point = { x: 600.123, y: 300.456 };
  f.bot.movementState = { phase: 'flight', progress: .42, position: f.bot.position, velocity: { x: 20, y: 30 } };
  f.bot.emit('move-progress', f.bot.movementState);
  assert.equal(f.$('phase').textContent, 'flight');
  assert.equal(f.$('progress').value, .42);
  assert.equal(f.$('progress-value').textContent, '42%');
  assert.equal(f.$('position').textContent, 'x 600.12 · y 300.46');
  assert.equal(f.$('invocation').textContent, source);
  assert.equal(f.$('result-log').children.length, logCount);
  f.input('duration', -5); const count = f.bot.calls.length; f.$('move').click();
  assert.equal(f.bot.calls.length, count);
  assert.match(f.$('status').textContent, /0–10000ms/);
  await flush();
});

test('copy, asset transition, options and result log controls stay wired', async t => {
  const f = fixture(t); let copied;
  Object.defineProperty(f.w.navigator, 'clipboard', { value: { writeText: async value => { copied = value; } } });
  f.$('copy').click(); await flush();
  assert.equal(copied, f.$('invocation').textContent);
  f.$('transition').click(); await flush();
  assert.equal(f.bot.calls.at(-1).patch.shape, 'heart');
  assert.match(f.$('invocation').textContent, /import \{ createAccessory \}/);
  assert.match(f.$('invocation').textContent, /createAccessory\('halo'\)/);
  f.$('interactive').checked = true; f.$('interactive').dispatchEvent(new f.w.Event('change'));
  assert.equal(f.bot.interaction, 'box');
  f.$('reduce').checked = true; f.$('reduce').dispatchEvent(new f.w.Event('change'));
  assert.equal(f.bot.paused, true);
  f.$('clear-log').click(); assert.equal(f.$('result-log').children.length, 0);
});

test('natural playground controls generate physical options and validate their full ranges', async t => {
  const f = fixture(t);
  f.$('auto-speed').checked = false; f.$('auto-speed').dispatchEvent(new f.w.Event('input'));
  f.input('travel', 'natural'); f.input('duration', 1500); f.input('max-speed', 240); f.input('acceleration', 700); f.input('deceleration', 1100);
  f.$('move').click(); await flush();
  assert.deepEqual(JSON.parse(JSON.stringify(f.bot.calls.at(-1).options)), { duration: 1500, travel: 'natural', maxSpeed: 240, acceleration: 700, deceleration: 1100 });
  assert.match(f.$('invocation').textContent, /maxSpeed: 240, acceleration: 700, deceleration: 1100/); assert.equal(f.$('physical-options').hidden, false);
  f.$('auto-speed').checked = true; f.$('auto-speed').dispatchEvent(new f.w.Event('input')); f.$('move').click(); await flush();
  assert.equal(Object.hasOwn(f.bot.calls.at(-1).options, 'maxSpeed'), false); assert.equal(f.bot.calls.at(-1).options.duration, 1500);
  f.$('auto-speed').checked = false; f.$('auto-speed').dispatchEvent(new f.w.Event('input'));
  for (const id of ['max-speed', 'acceleration', 'deceleration']) {
    for (const value of [0, 100001]) {
      const count = f.bot.calls.length; f.input(id, value); f.$('move').click(); await flush();
      assert.equal(f.bot.calls.length, count); assert.match(f.$('status').textContent, /1–100000/);
    }
    f.input(id, 100);
  }
  f.input('travel', 'none'); assert.equal(f.$('physical-options').hidden, true); f.input('max-speed', -1); f.$('move').click(); await flush();
  assert.deepEqual(JSON.parse(JSON.stringify(f.bot.calls.at(-1).options)), { duration: 1500, easing: 'smooth', travel: 'none' });
});

test('physical telemetry displays signed vectors, magnitudes and state-backed traces', async t => {
  const f = fixture(t);
  f.bot.movementState = { phase: 'braking', progress: .6, position: f.bot.position, velocity: { x: -30, y: 40 }, acceleration: { x: 120, y: -160 }, speed: 50 };
  f.bot.emit('move-progress', f.bot.movementState);
  assert.equal(f.$('speed').textContent, '50 px/s'); assert.equal(f.$('velocity').textContent, 'x -30 · y 40');
  assert.equal(f.$('acceleration-value').textContent, '200 px/s²'); assert.equal(f.$('acceleration-vector').textContent, 'x 120 · y -160');
  assert.equal(f.$('motion-graph').dataset.phase, 'braking');
  for (const id of ['speed-plot', 'acceleration-plot']) {
    const points = f.$(id).getAttribute('points'); assert.ok(points.length); assert.doesNotMatch(points, /NaN|Infinity/);
  }
  await flush();
});


test('automatic speed defaults omit only the speed cap and retain fixed acceleration values', async t => {
  const f = fixture(t);
  assert.equal(f.$('auto-speed').checked, true); assert.equal(f.$('max-speed').disabled, true);
  f.input('duration', 1200); f.input('max-speed', -1); f.$('move').click(); await flush();
  assert.deepEqual(JSON.parse(JSON.stringify(f.bot.calls.at(-1).options)), { duration: 1200, travel: 'natural', acceleration: 1800, deceleration: 2200 });
  assert.doesNotMatch(f.$('invocation').textContent, /maxSpeed/);
  assert.match(f.$('timing-help').textContent, /먼 곳은 더 오래/);
});

test('both pages share a paused native avatar brand and accessible navigation', async t => {
  const { mountSiteHeader } = await import('../playground/shared-header.js');
  const { resolveSidekickAttributes } = await import('../dist/library/element/attributes.js');
  const dom = new JSDOM('<div id="header"></div>', { url: 'https://sidekick.test/nested/' });
  t.after(() => dom.window.close());
  const host = dom.window.document.getElementById('header');
  for (const page of ['studio', 'api']) {
    const cleanup = mountSiteHeader(host, page, '/nested/');
    const avatar = host.querySelector('sidekick-avatar');
    const resolved = resolveSidekickAttributes(new Map([...avatar.attributes].map(a => [a.name, a.value])));
    assert.equal(resolved.design.body.shape, 'ghostish');
    assert.equal(resolved.paused, true);
    assert.equal(resolved.camera.zoom, 2);
    assert.equal(resolved.trackingMode, 'off');
    assert.equal(resolved.interaction, 'none');
    assert.deepEqual(resolved.design.accessories.map(a => a.preset).sort(), ['beret', 'bowTie', 'glasses']);
    assert.equal(resolved.design.eyes.left.weights.smile, 1);
    assert.equal(resolved.design.eyes.right.weights.smile, 1);
    assert.equal(avatar.getAttribute('shape'), 'ghostish');
    assert.equal(avatar.getAttribute('body-color'), '#FFCC37');
    assert.equal(avatar.getAttribute('head-accessory'), 'beret');
    assert.equal(avatar.getAttribute('eyes-accessory'), 'glasses');
    assert.equal(avatar.getAttribute('neck-accessory'), 'bowTie');
    assert.equal(avatar.getAttribute('expression'), 'smile');
    assert.equal(avatar.getAttribute('aria-hidden'), 'true');
    assert.ok(avatar.hasAttribute('paused'));
    assert.equal(avatar.getAttribute('interaction'), 'none');
    assert.equal(avatar.getAttribute('tracking-mode'), 'off');
    assert.equal(host.querySelectorAll('[aria-current="page"]').length, 1);
    assert.equal(host.querySelector('[aria-current="page"]').textContent, page === 'api' ? 'API playground' : 'Studio');
    assert.equal(host.querySelector('.brand').href, 'https://sidekick.test/nested/');
    assert.equal(host.querySelector('#api-playground-link').href, 'https://sidekick.test/nested/api-playground.html');
    cleanup(); assert.equal(host.childElementCount, 0);
  }
});
