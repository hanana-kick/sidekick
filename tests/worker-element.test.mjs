import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { PROTOCOL_VERSION } from '../dist/src/runtime/protocol.js';

let dom, Avatar, workers = [], frames = new Map(), nextFrame = 0, originalGlobals = new Map(), throwWorker = false;
const globalKeys = ['window', 'document', 'HTMLElement', 'customElements', 'CustomEvent', 'Worker', 'OffscreenCanvas', 'ResizeObserver', 'IntersectionObserver', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame'];
class MockWorker extends EventTarget {
  messages = []; terminated = 0; state; generation = 0; sequence = 0; frame = 1;
  constructor() { super(); if (throwWorker) throw new Error('CSP worker denied'); workers.push(this); }
  snapshot() { return { pose: structuredClone(this.state.pose), renderedRotation: [...this.state.pose.rotation], time: this.state.time, renderCpu: { lastMs: 0, totalMs: 0, maxMs: 0 }, frames: this.frame, running: false, drawCalls: 1, buffers: 3, width: 200, height: 200 }; }
  reply(kind, data = {}, sequence = this.sequence) { this.dispatchEvent(new MessageEvent('message', { data: { version: PROTOCOL_VERSION, generation: this.generation, sequence, kind, ...data } })); }
  postMessage(message) {
    this.messages.push(message); this.sequence = message.sequence;
    if (message.kind === 'init') {
      this.generation = message.generation; this.state = structuredClone(message.state);
      queueMicrotask(() => { if (!this.terminated) this.reply('ready', { snapshot: this.snapshot() }, 0); }); return;
    }
    const command = message.command;
    if (command.kind === 'state') { Object.assign(this.state, command.state); if (this.state.paused || this.state.reduced) this.state.pose.gaze = [...this.state.gaze]; }
    if (command.kind === 'present') { this.frame++; queueMicrotask(() => this.reply('complete', { request: command.request, result: { finished: true }, snapshot: this.snapshot() }, message.sequence)); }
    else if (command.kind === 'capture') { this.frame++; const snapshot = this.snapshot(); queueMicrotask(() => this.reply('pixels', { request: command.request, image: { width: 1, height: 1, pixels: new Uint8Array([0, 0, 0, 255]) }, snapshot }, message.sequence)); }
    else if (command.kind === 'snapshot') { /* Tests choose when its async encoder returns. */ }
    else queueMicrotask(() => this.reply('frame', { snapshot: this.snapshot() }, message.sequence));
  }
  terminate() { this.terminated++; }
}
before(async () => {
  dom = new JSDOM('<!doctype html><body></body>', { url: 'https://sidekick.test/' });
  for (const key of globalKeys) originalGlobals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
  for (const key of ['window', 'document', 'HTMLElement', 'customElements', 'CustomEvent']) Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true, writable: true });
  Object.defineProperty(document, 'hidden', { value: false, configurable: true });
  Object.assign(globalThis, {
    Worker: MockWorker, OffscreenCanvas: class {},
    ResizeObserver: class { constructor(callback) { this.callback = callback; } observe() {} disconnect() {} },
    IntersectionObserver: class { constructor(callback) { this.callback = callback; } observe() {} disconnect() {} },
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    requestAnimationFrame: callback => { frames.set(++nextFrame, callback); return nextFrame; }, cancelAnimationFrame: id => frames.delete(id),
  });
  dom.window.HTMLCanvasElement.prototype.transferControlToOffscreen = function () { assert.equal(this.transferred, undefined); this.transferred = true; return { width: 200, height: 200 }; };
  // Reaching this is a test failure for successful worker startup; fallback intentionally throws.
  dom.window.HTMLCanvasElement.prototype.getContext = function () { throw new Error('Main WebGL probe'); };
  ({ SidekickAvatar: Avatar } = await import('../dist/src/element/avatar.js'));
  customElements.define('worker-test-avatar', Avatar);
});
after(() => {
  for (const avatar of [...document.querySelectorAll('worker-test-avatar')]) avatar.remove();
  dom.window.close(); for (const [key, descriptor] of originalGlobals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
});
async function createAvatar() {
  const avatar = document.createElement('worker-test-avatar'); avatar.setActivity('still');
  avatar.getBoundingClientRect = () => ({ width: 200, height: 200, left: 0, top: 0 });
  document.body.append(avatar); await new Promise(resolve => avatar.addEventListener('sidekick-ready', resolve, { once: true })); assert.equal(avatar.ready, true); return avatar;
}

test('successful worker startup transfers the canvas without probing WebGL on main', async () => {
  const avatar = await createAvatar(), worker = workers.at(-1);
  assert.equal(avatar.diagnostics.backend, 'worker'); assert.equal(avatar.shadowRoot.querySelector('canvas').transferred, true);
  assert.equal(worker.messages[0].kind, 'init'); assert.equal(worker.messages[0].state.design.body.color, '#ffcc37');
  avatar.remove(); assert.equal(worker.terminated, 1); assert.equal(avatar.diagnostics.backend, 'none'); assert.equal(avatar.diagnostics.buffers, 0);
});

test('capture during connection startup queues behind initialization and disconnection rejects pending captures', async () => {
  const avatar = document.createElement('worker-test-avatar'); avatar.setActivity('still'); document.body.append(avatar);
  const result = await avatar.capturePixelsAsync(); assert.equal(result.pixels[3], 255); if (!avatar.ready) await new Promise(resolve => avatar.addEventListener('sidekick-ready', resolve, { once: true })); assert.equal(avatar.ready, true);
  const pending = avatar.snapshot(); avatar.remove(); await assert.rejects(pending, /disconnected/);
});

test('reconnection owns a new surface and generation, with no stale callbacks or lost phase', async () => {
  const avatar = await createAvatar(), previous = workers.at(-1), canvas = avatar.shadowRoot.querySelector('canvas');
  previous.state.time = 12.5; previous.frame = 40; previous.reply('frame', { snapshot: previous.snapshot() });
  const motion = avatar.motion.to({ body: { rotation: [0, .3, 0] } }, { duration: 1000 });
  avatar.remove(); assert.deepEqual(await motion, { finished: false });
  document.body.append(avatar); const image = await avatar.capturePixelsAsync(); const current = workers.at(-1);
  assert.notEqual(avatar.shadowRoot.querySelector('canvas'), canvas); assert.ok(current.generation > previous.generation); assert.equal(current.state.time, 12.5); assert.equal(image.pixels[3], 255);
  const state = avatar.diagnostics; previous.reply('frame', { snapshot: { ...previous.snapshot(), frames: 999 } }); assert.deepEqual(avatar.diagnostics, state); avatar.remove();
});

test('stale async PNG metadata never rolls back a later frame at the same revision', async () => {
  const avatar = await createAvatar(), worker = workers.at(-1);
  const snapshot = avatar.snapshot(); const request = worker.messages.at(-1).command.request, revision = worker.sequence, old = worker.snapshot();
  worker.frame = 50; worker.state.time = 20; worker.reply('frame', { snapshot: worker.snapshot() }, revision);
  worker.reply('snapshot', { request, blob: new Blob(['png']), snapshot: old }, revision);
  await snapshot; assert.equal(avatar.diagnostics.frames, 50); assert.equal(avatar.diagnostics.time, 20); avatar.remove();
});

test('rapid pointer events are coalesced and a fresh capture flushes the latest target', async () => {
  const avatar = await createAvatar(), worker = workers.at(-1); avatar.paused = true; avatar.trackingMode = 'eyes-and-body';
  await Promise.resolve(); const start = worker.messages.length;
  for (let i = 0; i < 200; i++) avatar.onTrackedPointerMove({ pointerType: 'mouse', clientX: 110 + i, clientY: -100 });
  assert.equal(worker.messages.length, start);
  await avatar.capturePixelsAsync();
  const updates = worker.messages.slice(start).filter(message => message.command?.kind === 'state');
  assert.equal(updates.length, 1); assert.deepEqual(updates[0].command.state.gaze, [1, 1]); avatar.remove();
});

test('worker runtime loss replaces the transferred surface before attempting local fallback', async () => {
  const avatar = await createAvatar(), worker = workers.at(-1), canvas = avatar.shadowRoot.querySelector('canvas');
  const errors = []; avatar.addEventListener('sidekick-error', event => errors.push(event.detail));
  worker.reply('error', { message: 'WebGL context lost' });
  assert.equal(worker.terminated, 1); assert.notEqual(avatar.shadowRoot.querySelector('canvas'), canvas);
  assert.equal(avatar.diagnostics.backend, 'main'); assert.equal(errors[0].recoverable, true);
  // The intentional mock WebGL failure is reported after lazy fallback loads.
  await new Promise(resolve => setTimeout(resolve, 30)); assert.equal(avatar.ready, false); avatar.remove();
});

test('error listeners may disconnect or reconnect without the failed generation replacing their canvas', async () => {
  for (const reconnect of [false, true]) {
    const avatar = await createAvatar(), worker = workers.at(-1), originalCanvas = avatar.shadowRoot.querySelector('canvas');
    const originalGeneration = avatar.diagnostics.generation, workerCount = workers.length;
    let attached = 0, errors = 0, reconnectedCanvas;
    const attach = avatar.attachCanvasListeners;
    avatar.attachCanvasListeners = function () { attached++; attach.call(this); };
    avatar.addEventListener('sidekick-error', () => {
      errors++; avatar.remove();
      if (reconnect) { document.body.append(avatar); reconnectedCanvas = avatar.shadowRoot.querySelector('canvas'); }
    }, { once: true });
    worker.reply('error', { message: 'WebGL context lost' });
    assert.equal(worker.terminated, 1); assert.equal(errors, 1);
    assert.equal(attached, reconnect ? 1 : 0);
    assert.equal(workers.length, workerCount + (reconnect ? 1 : 0));
    if (reconnect) {
      const current = workers.at(-1);
      assert.notEqual(reconnectedCanvas, originalCanvas);
      assert.equal(avatar.shadowRoot.querySelector('canvas'), reconnectedCanvas);
      assert.equal(avatar.diagnostics.generation, originalGeneration + 1);
      assert.equal(avatar.diagnostics.backend, 'worker'); assert.equal(current.terminated, 0);
      const image = await avatar.capturePixelsAsync(); assert.equal(image.pixels[3], 255); if (!avatar.ready) await new Promise(resolve => avatar.addEventListener('sidekick-ready', resolve, { once: true })); assert.equal(avatar.ready, true);
      worker.reply('error', { message: 'stale generation failure' });
      assert.equal(avatar.shadowRoot.querySelector('canvas'), reconnectedCanvas); assert.equal(current.terminated, 0);
    } else {
      assert.equal(avatar.isConnected, false); assert.equal(avatar.ready, false);
      assert.equal(avatar.shadowRoot.querySelector('canvas'), originalCanvas);
      assert.equal(avatar.diagnostics.backend, 'none');
    }
    avatar.remove();
  }
});

test('synchronously denied Worker constructor enters the main fallback path', async () => {
  throwWorker = true;
  const avatar = document.createElement('worker-test-avatar'), errors = [];
  avatar.addEventListener('sidekick-error', event => errors.push(event.detail)); document.body.append(avatar);
  assert.equal(avatar.diagnostics.backend, 'main'); assert.equal(errors[0].message, 'CSP worker denied'); assert.equal(errors[0].recoverable, true);
  throwWorker = false; await new Promise(resolve => setTimeout(resolve, 20)); avatar.remove();
});


test('attribute transactions use one worker packet and fresh capture flushes queued DOM writes', async () => {
  const avatar = await createAvatar(), worker = workers.at(-1), start = worker.messages.length;
  avatar.setAttribute('shape', 'heart'); avatar.setAttribute('body-yaw', '33'); avatar.setAttribute('body-color', '#123456');
  const image = await avatar.capturePixelsAsync();
  const sent = worker.messages.slice(start).map(message => message.command);
  assert.equal(sent[0].kind, 'batch'); assert.equal(sent.filter(command => command.kind === 'batch').length, 1);
  assert.equal(sent[0].commands.find(command => command.kind === 'design').design.body.shape, 'heart');
  assert.equal(sent[0].commands.find(command => command.kind === 'state' && command.state.bodyOrientation).state.bodyOrientation.yaw, 33);
  assert.equal(sent.at(-1).kind, 'capture'); assert.equal(image.pixels[3], 255); avatar.remove();
});

test('canvas wheel input is nonpassive, frame-coalesced and excluded from disabled preview/settings', async () => {
  const avatar = await createAvatar(), worker = workers.at(-1), canvas = avatar.shadowRoot.querySelector('canvas');
  avatar.interaction = 'box'; const start = worker.messages.length;
  for (let i = 0; i < 100; i++) {
    const event = new dom.window.WheelEvent('wheel', { deltaY: -1, cancelable: true, bubbles: true });
    canvas.dispatchEvent(event); assert.equal(event.defaultPrevented, true);
  }
  assert.equal(worker.messages.slice(start).filter(message => message.command?.state?.zoom).length, 0);
  await avatar.capturePixelsAsync();
  const updates = worker.messages.slice(start).filter(message => message.command?.state?.zoom);
  assert.equal(updates.length, 1); assert.ok(Math.abs(updates[0].command.state.zoom - Math.exp(.2)) < 1e-10);
  const settings = document.createElement('section'); document.body.append(settings);
  const scroll = new dom.window.WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true }); settings.dispatchEvent(scroll); assert.equal(scroll.defaultPrevented, false);
  avatar.interaction = 'none'; const disabled = new dom.window.WheelEvent('wheel', { deltaY: -100, cancelable: true }); canvas.dispatchEvent(disabled); assert.equal(disabled.defaultPrevented, false);
  assert.equal(avatar.style.getPropertyValue('--sidekick-touch-action'), 'auto');
  settings.remove(); avatar.remove();
});

test('disconnect drops uncommitted pinch motion, releases both captures and reconnects with accepted zoom', async () => {
  const avatar = await createAvatar(), old = workers.at(-1), canvas = avatar.shadowRoot.querySelector('canvas'), captures = new Set();
  canvas.setPointerCapture = id => captures.add(id); canvas.hasPointerCapture = id => captures.has(id); canvas.releasePointerCapture = id => captures.delete(id);
  avatar.interaction = 'box';
  const down = (id, x) => avatar.onPointerDown({ pointerId: id, pointerType: 'touch', button: 0, clientX: x, clientY: 100 });
  down(1, 50); down(2, 150);
  avatar.onPointerMove({ pointerId: 2, clientX: 200, clientY: 100 }); await avatar.capturePixelsAsync();
  assert.equal(avatar.zoom, 1.5);
  avatar.onPointerMove({ pointerId: 2, clientX: 250, clientY: 100 }); avatar.remove();
  assert.equal(captures.size, 0); assert.equal(avatar.pointers.size, 0); assert.equal(avatar.zoom, 1.5);
  document.body.append(avatar); await avatar.capturePixelsAsync();
  const worker = workers.at(-1); assert.notEqual(worker, old); assert.equal(worker.messages[0].state.zoom, 1.5);
  assert.equal(avatar.shadowRoot.querySelector('canvas').hasPointerCapture?.(1) ?? false, false);
  avatar.remove();
});

test('camera listeners disconnecting or reconnecting during pointer-down flush cannot capture stale pointers', async () => {
  for (const reconnect of [false, true]) {
    const avatar = await createAvatar(), canvas = avatar.shadowRoot.querySelector('canvas'), captures = new Set();
    canvas.setPointerCapture = id => captures.add(id); canvas.hasPointerCapture = id => captures.has(id); canvas.releasePointerCapture = id => captures.delete(id);
    avatar.interaction = 'box';
    avatar.onPointerDown({ pointerId: 1, pointerType: 'touch', button: 0, clientX: 50, clientY: 100 });
    avatar.onPointerMove({ pointerId: 1, clientX: 70, clientY: 100 });
    avatar.addEventListener('sidekick-body-orientation-change', () => { avatar.remove(); if (reconnect) document.body.append(avatar); }, { once: true });
    avatar.onPointerDown({ pointerId: 2, pointerType: 'touch', button: 0, clientX: 150, clientY: 100 });
    assert.equal(captures.size, 0); assert.equal(avatar.pointers.size, 0);
    if (reconnect) await avatar.capturePixelsAsync(); avatar.remove();
  }
});

test('startup canvas stays hidden until a latest-revision draw barrier, including late authored attributes', async () => {
  const avatar = document.createElement('worker-test-avatar');
  avatar.setActivity('still');
  document.body.append(avatar);
  const canvas = avatar.shadowRoot.querySelector('canvas'), worker = workers.at(-1);
  assert.equal(canvas.hidden, true);
  avatar.setAttribute('shape', 'heart');
  avatar.setAttribute('expression', 'smile');
  await new Promise(resolve => avatar.addEventListener('sidekick-ready', resolve, { once: true }));
  assert.equal(canvas.hidden, false);
  assert.equal(avatar.design.body.shape, 'heart');
  const present = worker.messages.find(message => message.command?.kind === 'present');
  assert.ok(present);
  assert.ok(worker.messages.some(message => message.sequence < present.sequence && message.command?.kind === 'batch'));
  assert.equal(avatar.diagnostics.acknowledgedRevision >= present.sequence, true);
  avatar.remove();
});

test('an obsolete startup draw acknowledgement cannot reveal a newer authored configuration', async () => {
  const avatar = document.createElement('worker-test-avatar');
  avatar.setActivity('still'); document.body.append(avatar);
  const worker = workers.at(-1), canvas = avatar.shadowRoot.querySelector('canvas');
  const reply = worker.reply.bind(worker);
  let superseded = false;
  worker.reply = (kind, data, sequence) => {
    if (kind === 'complete' && !superseded) {
      superseded = true;
      avatar.setAttribute('shape', 'flower');
      assert.equal(canvas.hidden, true);
    }
    return reply(kind, data, sequence);
  };
  await new Promise(resolve => avatar.addEventListener('sidekick-ready', resolve, { once: true }));
  assert.equal(avatar.design.body.shape, 'flower');
  assert.equal(worker.messages.filter(message => message.command?.kind === 'present').length, 2);
  assert.equal(canvas.hidden, false);
  avatar.remove();
});
