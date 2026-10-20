import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { RenderEngine } from '../src/runtime/render-engine.ts';
import { LocalRenderBridge, WorkerRenderBridge } from '../src/runtime/render-bridge.ts';
import { PROTOCOL_VERSION } from '../src/runtime/protocol.ts';
import { createDesign } from '../src/core/design.ts';
import { initialPose } from '../src/core/motion.ts';

const state = () => ({ design: createDesign(), pose: initialPose(), zoom: 1, bodyOrientation: { yaw: 0, pitch: 0, roll: 0 }, activity: 'still', paused: true, reduced: false, active: true, time: 12.5, gaze: [0, 0], trackingMode: 'off', width: 100, height: 100, dpr: 1 });

test('context loss sends the last pose and phase before a classified Canvas2D recovery error', () => {
  const canvas = new EventTarget(), events = [];
  canvas.width = 100; canvas.height = 100;
  const renderer = { canvas, graphics: 'webgl2', stats: { drawCalls: 1, buffers: 2 }, resize() {}, render() {}, readPixels: () => new Uint8Array(40000), dispose() {} };
  const initial = state(); initial.pose.rotation[1] = .45;
  const engine = new RenderEngine(canvas, initial, event => events.push(event), { request: () => 1, cancel() {} }, renderer);
  const event = new Event('webglcontextlost', { cancelable: true }); canvas.dispatchEvent(event);
  assert.equal(event.defaultPrevented, true);
  assert.equal(events.at(-2).kind, 'frame');
  assert.equal(events.at(-2).snapshot.time, 12.5);
  assert.equal(events.at(-2).snapshot.pose.rotation[1], .45);
  assert.equal(events.at(-2).snapshot.graphics, 'webgl2');
  assert.deepEqual(events.at(-1), { kind: 'error', message: 'WebGL context lost', rendererFallback: true });
  engine.dispose();
});

test('worker error classification crosses the bridge without probing or importing a main renderer', () => {
  class Worker extends EventTarget { postMessage() {} terminate() { this.terminated = true; } }
  const worker = new Worker(), failures = [];
  const bridge = new WorkerRenderBridge({ transferControlToOffscreen: () => ({}) }, 7, { ready() {}, event() {}, failed: (...args) => failures.push(args) }, () => worker);
  bridge.start(state());
  worker.dispatchEvent(new MessageEvent('message', { data: { version: PROTOCOL_VERSION, generation: 7, sequence: 0, kind: 'error', message: 'Shader failed', rendererFallback: true } }));
  assert.equal(failures.length, 1); assert.equal(failures[0][0].message, 'Shader failed'); assert.equal(failures[0][1], true); assert.equal(worker.terminated, true);
  bridge.dispose();
});

test('a shader initialization failure is classified without rebinding its locked canvas to 2D', async () => {
  const modes = [];
  const canvas = { getContext(mode) { modes.push(mode); if (mode === 'webgl2') return { createShader: () => null }; throw new Error('Cannot change context mode'); } };
  let ready = false;
  const result = new Promise(resolve => {
    const bridge = new LocalRenderBridge(canvas, 1, { ready() { ready = true; }, event() {}, failed(error, rendererFallback) { bridge.dispose(); resolve({ error, rendererFallback }); } });
    bridge.start(state());
  });
  const failure = await result;
  assert.equal(ready, false); assert.equal(failure.error.name, 'RendererInitializationError');
  assert.equal(failure.rendererFallback, true); assert.deepEqual(modes, ['webgl2']);
});

test('classified local WebGL failure replaces the locked canvas once, preserves state, and stops on Canvas2D failure', async t => {
  const dom = new JSDOM('<!doctype html><body></body>');
  const keys = ['window', 'document', 'HTMLElement', 'customElements', 'CustomEvent', 'Worker', 'OffscreenCanvas', 'ImageData', 'ResizeObserver', 'IntersectionObserver', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame'];
  const originals = keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  for (const key of keys) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: dom.window[key] });
  try {
    const { SidekickAvatar } = await import('../src/element/avatar.ts');
    customElements.define('recovery-test-avatar', SidekickAvatar);
    const avatar = dom.window.document.createElement('recovery-test-avatar');
    avatar.connected = true; avatar.generation = 3; avatar.elapsed = 8.75; avatar.currentPose.rotation[1] = .4;
    avatar.canvas = dom.window.document.createElement('canvas'); avatar.fallback = dom.window.document.createElement('span');
    const oldCanvas = avatar.canvas, errors = [], starts = [];
    avatar.cancelInput = avatar.detachMouseTracking = avatar.clearDrag = avatar.attachCanvasListeners = () => {};
    avatar.disposeBridge = () => { avatar.bridge = undefined; };
    avatar.resetEyes = () => {};
    avatar.emit = (name, detail) => errors.push([name, detail]);
    avatar.initializeRenderer = forceMain => starts.push({ forceMain, renderer: avatar.rendererPreference, time: avatar.elapsed, pose: avatar.pose });
    avatar.runtimeFailure(new Error('Shader failed'), 3, false, true);
    assert.notEqual(avatar.canvas, oldCanvas); assert.equal(starts.length, 1);
    assert.equal(starts[0].forceMain, true); assert.equal(starts[0].renderer, 'canvas2d');
    assert.equal(starts[0].time, 8.75); assert.equal(starts[0].pose.rotation[1], .4); assert.equal(errors[0][1].recoverable, true);
    const recoveryCanvas = avatar.canvas;
    avatar.runtimeFailure(new Error('Canvas2D unavailable'), 3, false, true);
    assert.equal(avatar.canvas, recoveryCanvas); assert.equal(starts.length, 1);
    assert.equal(errors[1][1].recoverable, false); assert.equal(avatar.fallback.hidden, false); assert.equal(avatar.fallback.textContent, 'Canvas2D unavailable');
    avatar.connected = false;
    await t.test('production local bridge owns loss, cancellation, CPU presentation and retired-surface cleanup', async () => {
      const { countingCanvas } = await import('./performance-fixture.mjs');
      const gpu = countingCanvas(128, 128), modes = [], frames = new Map(), encodings = [];
      let nextFrame = 0;
      Object.defineProperty(document, 'hidden', { configurable: true, value: false });
      Object.assign(globalThis, {
        Worker: undefined, OffscreenCanvas: undefined,
        ImageData: class { constructor(data, width, height) { Object.assign(this, { data, width, height }); } },
        ResizeObserver: class { observe() {} disconnect() {} },
        IntersectionObserver: class { observe() {} disconnect() {} },
        matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
        requestAnimationFrame: callback => { frames.set(++nextFrame, callback); return nextFrame; },
        cancelAnimationFrame: id => frames.delete(id),
      });
      const contexts = new WeakMap();
      dom.window.HTMLCanvasElement.prototype.getContext = function (kind) {
        modes.push(kind);
        const old = contexts.get(this);
        if (old) return old.kind === kind ? old.context : null;
        const context = kind === 'webgl2' ? gpu.gl : {
          createImageData: (width, height) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }),
          putImageData() {},
        };
        contexts.set(this, { kind, context }); return context;
      };
      dom.window.HTMLCanvasElement.prototype.toBlob = function (callback) { encodings.push(callback); };
      const a = document.createElement('recovery-test-avatar'), events = [], errors = [];
      a.getBoundingClientRect = () => ({ width: 128, height: 128, left: 0, top: 0 });
      a.setActivity('still'); a.trackingMode = 'off'; a.paused = true; a.seek(12.5);
      await a.motion.to({ body: { rotation: [0, .4, 0] }, eyes: { left: { weights: { smile: .35 } } } });
      const ready = () => new Promise(resolve => a.addEventListener('sidekick-ready', resolve, { once: true }));
      const initialReady = ready(); document.body.append(a); await initialReady;
      try {
        assert.equal(a.diagnostics.graphics, 'webgl2'); assert.equal(a.diagnostics.buffers, 8);
        const oldCanvas = a.shadowRoot.querySelector('canvas'), generation = a.diagnostics.generation;
        a.addEventListener('sidekick-error', event => errors.push({ ...event.detail, ready: a.ready, pose: a.pose, time: a.diagnostics.time }));
        a.addEventListener('sidekick-ready', () => events.push({ graphics: a.diagnostics.graphics, visible: !a.canvas.hidden }));
        a.paused = false;
        const motion = a.motion.to({ body: { rotation: [0, 1, 0] } }, { duration: 60000 });
        const shape = a.setShape('puffy', { duration: 60000 });
        await a.capturePixelsAsync();
        const beforeLoss = { pose: a.pose, time: a.diagnostics.time };
        const snapshot = a.snapshot(), rejectedSnapshot = assert.rejects(snapshot, /context lost/);
        assert.equal(encodings.length, 1); assert.ok(frames.size > 0);
        const recovered = ready(), lost = new dom.window.Event('webglcontextlost', { cancelable: true });
        oldCanvas.dispatchEvent(lost);
        assert.equal(lost.defaultPrevented, true); assert.equal(a.ready, false); assert.equal(a.canvas.hidden, true);
        assert.notEqual(a.canvas, oldCanvas); assert.equal(a.diagnostics.generation, generation + 1);
        // The retired renderer must not resurrect while the CPU bridge loads.
        oldCanvas.dispatchEvent(new dom.window.Event('webglcontextrestored'));
        await recovered; await rejectedSnapshot;
        assert.deepEqual(await motion, { finished: false }); assert.deepEqual(await shape, { finished: false });
        assert.equal(a.design.body.shape, 'puffy');
        assert.deepEqual(a.pose, beforeLoss.pose); assert.equal(a.diagnostics.time, beforeLoss.time);
        assert.equal(a.diagnostics.graphics, 'canvas2d'); assert.equal(a.diagnostics.backend, 'main');
        assert.equal(a.diagnostics.buffers, 0); assert.equal(a.diagnostics.running, false);
        assert.equal(errors.length, 1); assert.equal(errors[0].ready, false); assert.equal(errors[0].recoverable, true);
        assert.equal(a.diagnostics.time, errors[0].time); assert.deepEqual(a.pose, errors[0].pose);
        assert.deepEqual(events, [{ graphics: 'canvas2d', visible: true }]);
        for (const key of ['liveBuffers', 'liveVAOs', 'livePrograms', 'liveShaders']) assert.equal(gpu.snapshot()[key], 0, key);
        const image = await a.capturePixelsAsync();
        assert.ok(image.pixels.some((value, i) => i % 4 === 3 && value)); assert.equal(image.pixels[3], 0);
        assert.deepEqual(modes, ['webgl2', '2d', '2d'], 'Only snapshot encoding and recovery request 2D; no second WebGL attempt');
        const stable = a.diagnostics;
        encodings[0](new Blob(['late snapshot'], { type: 'image/png' }));
        oldCanvas.dispatchEvent(new dom.window.Event('webglcontextlost', { cancelable: true }));
        oldCanvas.dispatchEvent(new dom.window.Event('webglcontextrestored'));
        await Promise.resolve(); await Promise.resolve();
        assert.deepEqual(a.diagnostics, stable); assert.equal(errors.length, 1); assert.equal(events.length, 1);
        a.remove(); assert.equal(a.diagnostics.backend, 'none'); assert.equal(a.diagnostics.buffers, 0); assert.equal(frames.size, 0);
      } finally { a.remove(); }
    });
  } finally {
    dom.window.close(); for (const [key, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
  }
});

test('WebGL allocation failure during the configured initial draw also requests fresh Canvas2D recovery', async () => {
  const { countingCanvas } = await import('./performance-fixture.mjs');
  const fixture = countingCanvas(); fixture.canvas.addEventListener = () => {}; fixture.canvas.removeEventListener = () => {};
  const original = fixture.gl.bufferData; let calls = 0;
  fixture.gl.bufferData = (...args) => { if (++calls === 9) throw new Error('Initial body upload failed'); return original(...args); };
  assert.throws(() => new RenderEngine(fixture.canvas, state(), () => {}), { name: 'RendererInitializationError', message: 'Initial body upload failed' });
  for (const key of ['liveBuffers','liveVAOs','livePrograms','liveShaders']) assert.equal(fixture.snapshot()[key],0,key);
});
