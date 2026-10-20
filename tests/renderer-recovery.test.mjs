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

test('classified local WebGL failure replaces the locked canvas once, preserves state, and stops on Canvas2D failure', async () => {
  const dom = new JSDOM('<!doctype html>'), keys = ['HTMLElement', 'customElements'], originals = keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  for (const key of keys) Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key] });
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
