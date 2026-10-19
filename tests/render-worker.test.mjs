import test from 'node:test';
import assert from 'node:assert/strict';
import { RenderEngine, frameScheduler } from '../dist/src/runtime/render-engine.js';
import { WorkerRenderBridge, supportsRenderWorker } from '../dist/src/runtime/render-bridge.js';
import { createDesign } from '../dist/src/core/design.js';
import { initialPose } from '../dist/src/core/motion.js';
import { automaticBlink } from '../dist/src/core/expressions.js';
import { PROTOCOL_VERSION } from '../dist/src/runtime/protocol.js';

function initialRuntimeState(patch = {}) {
  return { design: createDesign(), pose: initialPose(), zoom: 1, bodyOrientation: { yaw: 0, pitch: 0, roll: 0 }, activity: 'still', paused: false, reduced: false, active: true, time: 0, gaze: [0, 0], trackingMode: 'off', width: 200, height: 200, dpr: 1, ...patch };
}
function fixture(patch = {}) {
  let now = 10, next = 0;
  const callbacks = new Map(), events = [], draws = [], canvas = new EventTarget();
  canvas.width = 200; canvas.height = 200;
  const scheduler = { request: callback => { callbacks.set(++next, callback); return next; }, cancel: id => callbacks.delete(id) };
  const renderer = {
    canvas, stats: { drawCalls: 1, buffers: 3 }, disposals: 0, resizes: 0,
    resize(width, height, dpr) { this.resizes++; canvas.width = Math.max(1, Math.round(width * dpr)); canvas.height = Math.max(1, Math.round(height * dpr)); },
    render(design, state) { draws.push({ design: structuredClone(design), pose: structuredClone(state.pose), bodyOrientation: { ...state.bodyOrientation }, zoom: state.zoom, time: state.time, delta: state.delta, contour: state.contour, travel: structuredClone(state.travel), activity: state.activity, activityFrame: structuredClone(state.activityFrame) }); },
    readPixels() { const result = new Uint8Array(canvas.width * canvas.height * 4); result[3] = 255; return result; },
    dispose() { this.disposals++; },
  };
  const state = initialRuntimeState(patch);
  const engine = new RenderEngine(canvas, state, (event, revision) => events.push({ ...event, revision }), scheduler, renderer);
  return { engine, state, renderer, events, draws, callbacks, step(ms = 16) { now += ms; const current = [...callbacks.values()]; callbacks.clear(); for (const callback of current) callback(now); } };
}
const near = (value, expected, epsilon = 1e-7) => assert.ok(Math.abs(value - expected) < epsilon, `${value} != ${expected}`);

test('static worker engine initializes once, coalesces changes, and ignores identical updates', () => {
  const f = fixture();
  assert.equal(f.draws.length, 1); assert.equal(f.callbacks.size, 0);
  for (let i = 1; i <= 100; i++) f.engine.command({ kind: 'state', state: { bodyOrientation: { yaw: i, pitch: 0, roll: 0 } } });
  assert.equal(f.callbacks.size, 1); assert.equal(f.draws.length, 1);
  f.step(); assert.equal(f.draws.length, 2); assert.equal(f.draws.at(-1).bodyOrientation.yaw, 0);
  f.step(16); assert.ok(f.draws.at(-1).bodyOrientation.yaw > 0 && f.draws.at(-1).bodyOrientation.yaw < 100);
  for (let i = 0; i < 100; i++) f.step(16);
  assert.equal(f.draws.at(-1).bodyOrientation.yaw, 100); assert.equal(f.callbacks.size, 0);
  f.engine.command({ kind: 'state', state: { bodyOrientation: { yaw: 100, pitch: 0, roll: 0 }, gaze: [0, 0], active: true } });
  f.engine.command({ kind: 'resize', width: 200, height: 200, dpr: 1 });
  assert.equal(f.callbacks.size, 0); assert.equal(f.renderer.resizes, 1); f.engine.dispose();
});

test('eye persistence and unrelated design edits preserve independent worker tracks', async () => {
  const f = fixture();
  f.engine.command({ kind: 'motion', target: { eyes: { left: { weights: { smile: 1 } } } }, options: { duration: 1000, easing: 'linear' }, request: 1 });
  const target = createDesign({ eyes: { left: { weights: { smile: 1 } } } });
  f.engine.command({ kind: 'persist-design', design: target });
  f.engine.command({ kind: 'motion', target: { body: { rotation: [0, .8, 0] } }, options: { duration: 2000, easing: 'linear' }, request: 2 });
  f.step(); f.step(400); near(f.engine.snapshot.pose.eyes.left.smile, .4); near(f.engine.snapshot.pose.rotation[1], .16);
  f.engine.command({ kind: 'design', design: { ...target, body: { ...target.body, color: '#123456' } } });
  f.step(200); near(f.engine.snapshot.pose.eyes.left.smile, .6); near(f.engine.snapshot.pose.rotation[1], .24);
  await Promise.resolve(); assert.equal(f.events.filter(event => event.kind === 'complete').length, 0);
  f.step(400); await Promise.resolve(); assert.deepEqual(f.events.find(event => event.kind === 'complete' && event.request === 1).result, { finished: true });
  assert.equal(f.events.some(event => event.kind === 'complete' && event.request === 2), false); f.engine.dispose();
});

test('superseding one motion channel settles only that request and preserves the others', async () => {
  const f = fixture();
  f.engine.command({ kind: 'motion', target: { body: { rotation: [.5, 0, 0] } }, options: { duration: 1000 }, request: 1 });
  f.engine.command({ kind: 'motion', target: { face: { uv: [.3, 0] } }, options: { duration: 1000 }, request: 2 });
  f.step(); f.step(200);
  const face = f.engine.snapshot.pose.face[0];
  f.engine.command({ kind: 'motion', target: { body: { rotation: [-.5, 0, 0] } }, options: { duration: 500 }, request: 3 });
  await Promise.resolve(); assert.deepEqual(f.events.find(event => event.kind === 'complete' && event.request === 1).result, { finished: false });
  f.step(200); assert.ok(f.engine.snapshot.pose.face[0] > face);
  assert.equal(f.events.some(event => event.kind === 'complete' && event.request === 2), false); f.engine.dispose();
});

test('hidden engine stops all scheduled work and resumes without hidden-time catch-up', () => {
  const f = fixture({ activity: 'idle' }); f.step(); f.step(20);
  const before = f.engine.snapshot.time, frames = f.draws.length;
  f.engine.command({ kind: 'state', state: { active: false } });
  f.engine.command({ kind: 'state', state: { bodyOrientation: { yaw: 45, pitch: 0, roll: 0 } } });
  assert.equal(f.callbacks.size, 0); f.step(20000); assert.equal(f.draws.length, frames);
  f.engine.command({ kind: 'state', state: { active: true } }); f.step(); near(f.engine.snapshot.time, before);
  f.step(20); near(f.engine.snapshot.time, before + .02); f.engine.dispose();
});

test('paused motion completion renders its final frame once and remains idle', async () => {
  const f = fixture();
  f.engine.command({ kind: 'motion', target: { body: { rotation: [0, 1, 0] } }, options: { duration: 1000 }, request: 1 });
  f.step(); f.step(100);
  f.engine.command({ kind: 'state', state: { paused: true } });
  await Promise.resolve();
  assert.deepEqual(f.engine.snapshot.pose.rotation, [0, 1, 0]);
  assert.deepEqual(f.draws.at(-1).pose.rotation, [0, 1, 0]); assert.equal(f.callbacks.size, 0);
  assert.deepEqual(f.events.find(event => event.kind === 'complete').result, { finished: true }); f.engine.dispose();
});

test('capture is an ordered fresh-frame barrier without advancing animation time', () => {
  const f = fixture();
  f.engine.command({ kind: 'state', state: { bodyOrientation: { yaw: 33, pitch: 2, roll: -4 }, time: 7 } }, 1);
  f.engine.command({ kind: 'resize', width: 250, height: 180, dpr: 2 }, 2);
  f.engine.command({ kind: 'capture', request: 1 }, 3);
  const result = f.events.at(-1);
  assert.equal(result.kind, 'pixels'); assert.equal(result.image.width, 500); assert.equal(result.image.height, 360);
  assert.deepEqual(f.draws.at(-1).bodyOrientation, { yaw: 0, pitch: 0, roll: 0 }); assert.equal(result.snapshot.time, 7); f.engine.dispose();
});

test('PNG completion keeps the capture snapshot and revision while encoding asynchronously', async () => {
  const oldCanvas = globalThis.OffscreenCanvas, oldImageData = globalThis.ImageData;
  let encode;
  globalThis.ImageData = class { constructor(data, width, height) { Object.assign(this, { data, width, height }); } };
  globalThis.OffscreenCanvas = class { constructor(width, height) { Object.assign(this, { width, height }); } getContext() { return { putImageData() {} }; } convertToBlob() { return new Promise(resolve => { encode = resolve; }); } };
  const f = fixture();
  try {
    f.engine.command({ kind: 'state', state: { time: 4 } }, 1);
    f.engine.command({ kind: 'snapshot', request: 10, options: { crop: true } }, 2);
    f.engine.command({ kind: 'state', state: { time: 9 } }, 3);
    encode(new Blob(['png'], { type: 'image/png' })); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    const event = f.events.find(event => event.kind === 'snapshot'); assert.equal(event.revision, 2); assert.equal(event.snapshot.time, 4);
  } finally { f.engine.dispose(); globalThis.OffscreenCanvas = oldCanvas; globalThis.ImageData = oldImageData; }
});

test('context loss and disposal stop schedules and remove graphics event listeners', () => {
  const f = fixture({ activity: 'idle' });
  f.renderer.canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
  assert.equal(f.events.at(-1).kind, 'error'); assert.equal(f.callbacks.size, 0);
  f.engine.dispose(); f.engine.dispose(); const count = f.events.length;
  f.renderer.canvas.dispatchEvent(new Event('webglcontextlost')); assert.equal(f.events.length, count); assert.equal(f.renderer.disposals, 1);
});

test('failed engine construction rolls back the renderer, listener and scheduled frame', () => {
  const originalWake = RenderEngine.prototype.wake;
  for (const fault of ['resize', 'first-render', 'after-schedule']) {
    const failure = new Error(`injected ${fault}`), callbacks = new Map(), events = [], cancelled = [];
    const canvas = new EventTarget(); canvas.width = 200; canvas.height = 200;
    let listeners = 0, requests = 0, failedEngine;
    const add = canvas.addEventListener.bind(canvas), remove = canvas.removeEventListener.bind(canvas);
    canvas.addEventListener = (...args) => { listeners++; add(...args); };
    canvas.removeEventListener = (...args) => { listeners--; remove(...args); };
    const renderer = {
      canvas, stats: { drawCalls: 1, buffers: 3 }, disposals: 0,
      resize() { if (fault === 'resize') throw failure; },
      render() { if (fault === 'first-render') throw failure; },
      readPixels() { return new Uint8Array(0); },
      dispose() { this.disposals++; },
    };
    const scheduler = {
      request(callback) { callbacks.set(++requests, callback); return requests; },
      cancel(id) { cancelled.push(id); callbacks.delete(id); },
    };
    try {
      // Inject after the real scheduler has returned ownership of its handle.
      RenderEngine.prototype.wake = function () {
        failedEngine = this; originalWake.call(this);
        if (fault === 'after-schedule') throw failure;
      };
      assert.throws(() => new RenderEngine(canvas, initialRuntimeState({ activity: 'idle' }), event => events.push(event), scheduler, renderer), error => error === failure);
      assert.equal(renderer.disposals, 1, fault);
      assert.equal(listeners, 0, fault); assert.equal(callbacks.size, 0, fault);
      assert.equal(requests, fault === 'after-schedule' ? 1 : 0, fault);
      assert.deepEqual(cancelled, fault === 'after-schedule' ? [1] : [], fault);
      canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
      assert.equal(events.length, 0, fault);
      failedEngine?.dispose(); assert.equal(renderer.disposals, 1, fault);
    } finally { RenderEngine.prototype.wake = originalWake; }
  }
});

class FakeWorker extends EventTarget {
  messages = []; terminations = 0; listeners = 0;
  postMessage(message, transfer = []) { this.messages.push({ message, transfer }); }
  terminate() { this.terminations++; }
  addEventListener(...args) { this.listeners++; super.addEventListener(...args); }
  removeEventListener(...args) { this.listeners--; super.removeEventListener(...args); }
  respond(data) { this.dispatchEvent(new MessageEvent('message', { data })); }
}
function bridgeFixture() {
  const worker = new FakeWorker(), canvas = { transfers: 0, transferControlToOffscreen() { this.transfers++; return { surface: true }; } }, received = [], failures = [];
  const bridge = new WorkerRenderBridge(canvas, 7, { ready: (snapshot, revision) => received.push({ ready: snapshot, revision }), event: (event, revision) => received.push({ event, revision }), failed: error => failures.push(error) }, () => worker);
  return { bridge, worker, canvas, received, failures };
}
test('worker bridge transfers only once, sequences commands, and ignores stale generations', () => {
  const f = bridgeFixture(); f.bridge.start({});
  f.bridge.send({ kind: 'cancel' }); f.bridge.send({ kind: 'capture', request: 3 });
  assert.equal(f.canvas.transfers, 1); assert.equal(f.worker.messages[0].transfer.length, 1);
  assert.deepEqual(f.worker.messages.map(item => item.message.sequence), [0, 1, 2]);
  f.worker.respond({ version: PROTOCOL_VERSION, generation: 6, sequence: 1, kind: 'ready', snapshot: {} });
  f.worker.respond({ version: PROTOCOL_VERSION, generation: 7, sequence: 20, kind: 'ready', snapshot: {} });
  assert.equal(f.received.length, 0);
  f.worker.respond({ version: PROTOCOL_VERSION, generation: 7, sequence: 0, kind: 'ready', snapshot: {} }); assert.equal(f.received.length, 1);
  f.bridge.dispose(); f.bridge.dispose(); assert.equal(f.worker.terminations, 1); assert.equal(f.worker.listeners, 0);
  f.worker.respond({ version: PROTOCOL_VERSION, generation: 7, sequence: 2, kind: 'complete', request: 3, result: {} }); assert.equal(f.received.length, 1);
});

test('worker bridge handles post-transfer failures once and removes every worker listener', () => {
  const f = bridgeFixture(); f.bridge.start({});
  f.worker.respond({ version: PROTOCOL_VERSION, generation: 7, sequence: 0, kind: 'error', message: 'WebGL context lost' });
  assert.equal(f.bridge.transferred, true); assert.equal(f.worker.terminations, 1); assert.equal(f.failures.length, 1); assert.equal(f.worker.listeners, 0);
  f.bridge.send({ kind: 'capture', request: 1 }); assert.equal(f.worker.messages.length, 1);
});

test('worker capability detection never acquires the HTML canvas context', () => {
  const oldWorker = globalThis.Worker, oldCanvas = globalThis.OffscreenCanvas;
  try {
    globalThis.Worker = FakeWorker; globalThis.OffscreenCanvas = class {};
    assert.equal(supportsRenderWorker({ transferControlToOffscreen() {}, getContext() { throw new Error('must not probe'); } }), true);
  } finally { globalThis.Worker = oldWorker; globalThis.OffscreenCanvas = oldCanvas; }
});


test('scheduler cancels only the API that owns a handle, even when timer and RAF IDs collide', () => {
  const cancelled = [], timers = [], scope = { requestAnimationFrame: () => 4, cancelAnimationFrame: id => cancelled.push(id), setTimeout: () => 4, clearTimeout: id => timers.push(id), performance: { now: () => 0 } };
  const scheduler = frameScheduler(scope); scheduler.cancel(scheduler.request(() => {}));
  assert.deepEqual(cancelled, [4]); assert.deepEqual(timers, []);
  scope.requestAnimationFrame = () => { throw new Error('RAF unsupported'); };
  scheduler.cancel(scheduler.request(() => {})); assert.deepEqual(timers, [4]); assert.deepEqual(cancelled, [4]);
});


test('validated declarative batches commit one revision without exposing intermediate snapshots', () => {
  const f = fixture(); const start = f.events.length;
  f.engine.command({ kind: 'batch', commands: [
    { kind: 'design', design: createDesign({ body: { shape: 'heart', color: '#123456' } }) },
    { kind: 'state', state: { bodyOrientation: { yaw: 33, pitch: 0, roll: 0 }, paused: true } },
    { kind: 'motion', target: { face: { uv: [.2, -.1] } }, options: { duration: 0 }, request: 5 },
  ] }, 12);
  const events = f.events.slice(start); assert.equal(events.length, 1); assert.equal(events[0].revision, 12); assert.deepEqual(events[0].snapshot.pose.face, [.2, -.1]);
  f.engine.capture(); assert.equal(f.draws.at(-1).design.body.shape, 'heart'); assert.equal(f.draws.at(-1).bodyOrientation.yaw, 33); f.engine.dispose();
});

test('accepted no-op state and resize commands acknowledge without rendering or scheduling', () => {
  const f = fixture(); f.engine.command({ kind: 'state', state: { paused: false, gaze: [0, 0] } }, 7);
  assert.equal(f.events.at(-1).revision, 7);
  f.engine.command({ kind: 'resize', width: 200, height: 200, dpr: 1 }, 8); assert.equal(f.events.at(-1).revision, 8);
  assert.equal(f.draws.length, 1); assert.equal(f.callbacks.size, 0); f.engine.dispose();
});


test('pausing freezes a nonzero tracking target even with a pending frame; neutral return may settle', () => {
  const f = fixture({ trackingMode: 'eyes-and-body', trackedGaze: [1, 1], gaze: [1, 1] });
  f.step(); f.step(20); const before = f.engine.snapshot.renderedRotation, time = f.engine.snapshot.time;
  f.engine.command({ kind: 'state', state: { paused: true } }); f.step(20);
  assert.deepEqual(f.engine.snapshot.renderedRotation, before); assert.equal(f.engine.snapshot.time, time); assert.equal(f.callbacks.size, 0);
  f.engine.command({ kind: 'state', state: { trackingMode: 'off', trackedGaze: undefined } });
  for (let i = 0; i < 500 && f.callbacks.size; i++) f.step(16);
  assert.deepEqual(f.engine.snapshot.renderedRotation, [0, 0, 0]); assert.equal(f.engine.snapshot.time, time); assert.equal(f.callbacks.size, 0); f.engine.dispose();
});

test('clean idle draws at 30 Hz while RAF clocks advance and accessory delta is retained', () => {
  for (const rate of [60, 120, 144]) {
    const f = fixture({ activity: 'idle' }); f.step();
    for (let i = 0; i < rate; i++) f.step(1000 / rate);
    assert.equal(f.draws.length, 31, `${rate} Hz input`);
    assert.equal(f.events.filter(event => event.kind === 'frame').length, 30);
    near(f.engine.snapshot.time, 1); near(f.draws.reduce((sum, frame) => sum + frame.delta, 0), 1);
    assert.equal(f.callbacks.size, 1); f.engine.dispose();
  }
});

test('dirty and capture frames bypass idle pacing and consume accumulated renderer delta once', () => {
  const f = fixture({ activity: 'idle' }); f.step(); f.step(10);
  assert.equal(f.draws.length, 1);
  f.engine.command({ kind: 'state', state: { zoom: 1.1 } });
  f.step(10); assert.equal(f.draws.length, 2); near(f.draws.at(-1).delta, .02);
  f.step(10); assert.equal(f.draws.length, 2);
  f.engine.command({ kind: 'capture', request: 1 });
  assert.equal(f.draws.length, 3); near(f.draws.at(-1).delta, .01); near(f.engine.snapshot.time, .03);
  f.step(10); assert.equal(f.draws.length, 3);
  f.engine.command({ kind: 'resize', width: 250, height: 150, dpr: 2 }); f.step(10);
  assert.equal(f.draws.length, 4); near(f.draws.at(-1).delta, .02);
  f.engine.command({ kind: 'capture', request: 2 }); near(f.draws.at(-1).delta, 0);
  near(f.draws.reduce((sum, frame) => sum + frame.delta, 0), .05); f.engine.dispose();
});

test('idle motion and shape tracks render every RAF through their exact completion frame', async () => {
  for (const kind of ['motion', 'shape']) {
    const f = fixture({ activity: 'idle' }); f.step();
    const options = { duration: 100, easing: 'linear' };
    f.engine.command(kind === 'motion' ? { kind, target: { body: { rotation: [0, 1, 0] } }, options, request: 1 } : { kind, shape: 'heart', options, request: 1 });
    for (let i = 1; i <= 5; i++) {
      const frames = f.draws.length; f.step(20);
      assert.equal(f.draws.length, frames + 1, `${kind} tick ${i}`);
      near(f.engine.snapshot.time, i * .02);
      if (kind === 'motion') near(f.draws.at(-1).pose.rotation[1], i / 5);
      await Promise.resolve();
      assert.equal(f.events.some(event => event.kind === 'complete'), i === 5);
    }
    const complete = f.events.find(event => event.kind === 'complete');
    assert.deepEqual(complete.result, { finished: true }); assert.equal(complete.snapshot.frames, f.draws.length);
    const frames = f.draws.length; f.step(10); assert.equal(f.draws.length, frames); f.engine.dispose();
  }
});

test('active gaze and body tracking and non-idle activity keep full RAF rendering', () => {
  for (const patch of [{ gaze: [1, 1] }, { trackingMode: 'eyes-and-body', trackedGaze: [1, 1] }, { activity: 'thinking' }]) {
    const f = fixture({ activity: 'idle', ...patch });
    for (let i = 0; i < 10; i++) { const frames = f.draws.length; f.step(10); assert.equal(f.draws.length, frames + 1); }
    f.engine.dispose();
  }
  for (const patch of [{ paused: true }, { reduced: true }]) {
    const f = fixture({ activity: 'idle', ...patch }); assert.equal(f.callbacks.size, 0); f.step(1000); assert.equal(f.draws.length, 1); f.engine.dispose();
  }
});

test('idle blink, incoming lookahead and final reopening retain every RAF sample', () => {
  const f = fixture({ activity: 'idle', time: 4.3 }), delta = 1 / 60; f.step();
  let fullRateSamples = 0, lookaheadSamples = 0, reopenSamples = 0, closedSamples = 0;
  for (let i = 0; i < 30; i++) {
    const previous = f.engine.snapshot.time, current = previous + delta, frames = f.draws.length;
    const blink = automaticBlink(current) < 1, lookahead = automaticBlink(current + delta) < 1, reopening = automaticBlink(previous) < 1 && !blink;
    f.step(delta * 1000);
    if (blink || lookahead || reopening) { assert.equal(f.draws.length, frames + 1, `blink sample at ${current}`); fullRateSamples++; }
    if (!blink && lookahead) lookaheadSamples++;
    if (reopening) reopenSamples++;
    if (automaticBlink(current) === 0) closedSamples++;
  }
  assert.ok(fullRateSamples >= 15); assert.ok(lookaheadSamples >= 1); assert.equal(reopenSamples, 1); assert.ok(closedSamples >= 1);
  f.engine.dispose();
});

test('idle pacing resets across activity, visibility and recreated engine lifecycles', () => {
  const f = fixture({ activity: 'idle' }); f.step(); f.step(20);
  f.engine.command({ kind: 'state', state: { activity: 'thinking' } }); f.step(10); near(f.draws.at(-1).delta, .01);
  f.engine.command({ kind: 'state', state: { activity: 'idle' } }); f.step(10); near(f.draws.at(-1).delta, .01);
  // Activity switches now crossfade at RAF rate; test idle pacing after settling.
  f.step(200);
  f.step(20); const time = f.engine.snapshot.time, frames = f.draws.length;
  f.engine.command({ kind: 'state', state: { active: false } }); f.step(10000);
  assert.equal(f.callbacks.size, 0); assert.equal(f.draws.length, frames); near(f.engine.snapshot.time, time);
  f.engine.command({ kind: 'state', state: { active: true } }); f.step(); near(f.draws.at(-1).delta, 0); near(f.engine.snapshot.time, time);
  f.step(20); assert.equal(f.draws.length, frames + 1);
  const resumedTime = f.engine.snapshot.time; f.engine.dispose(); assert.equal(f.callbacks.size, 0);
  const next = fixture({ activity: 'idle', time: resumedTime }); next.step(10000); next.step(20);
  assert.equal(next.draws.length, 1); next.step(20); near(next.draws.at(-1).delta, .04); near(next.engine.snapshot.time, resumedTime + .04); next.engine.dispose();
});

test('zoom-only worker state redraws once without restarting demand-only frames', () => {
  const f = fixture({ bodyOrientation: { yaw: 0, pitch: 0, roll: 0 }, zoom: 1 });
  for (let i = 1; i <= 100; i++) f.engine.command({ kind: 'state', state: { bodyOrientation: { yaw: 0, pitch: 0, roll: 0 }, zoom: 1 + i / 100 } });
  assert.equal(f.callbacks.size, 1); assert.equal(f.draws.length, 1);
  f.step(); assert.equal(f.draws.length, 2); assert.equal(f.draws.at(-1).zoom, 2); assert.equal(f.callbacks.size, 0);
  f.engine.command({ kind: 'state', state: { bodyOrientation: { yaw: 0, pitch: 0, roll: 0 }, zoom: 2 } });
  assert.equal(f.callbacks.size, 0); assert.equal(f.draws.length, 2); f.engine.dispose();
});

 test('travel presentation overlays worker gaze and yields to live activity without mutating authored state', () => {
 const f=fixture({activity:'thinking'}); const before=structuredClone(f.engine.snapshot.pose);
 f.engine.command({kind:'state',state:{travel:{direction:[1,0],strength:1,lift:.06,bank:-.12}}});f.step();
 assert.deepEqual(f.draws.at(-1).pose.gaze,[.75,0]);assert.deepEqual(f.engine.snapshot.pose.gaze,before.gaze);
 assert.equal(f.draws.at(-1).activityFrame.roll,0);assert.equal(f.renderer.resizes,1);
 f.engine.command({kind:'state',state:{activity:'idle'}});f.step(200);
 f.engine.command({kind:'state',state:{travel:{direction:[0,0],strength:0,lift:0,bank:0}}});f.step();
 assert.equal(f.draws.at(-1).activity,'idle'); assert.deepEqual(f.draws.at(-1).pose.gaze,before.gaze);f.engine.dispose();
 });

test('inactive resize bursts defer framebuffer work and resume at the final dimensions', () => {
  const f = fixture({ activity: 'idle' });
  f.engine.command({ kind: 'state', state: { active: false } });
  const before = f.draws.length, resizes = f.renderer.resizes;
  for (let width = 210; width <= 410; width += 10) f.engine.command({ kind: 'resize', width, height: 123, dpr: 2 });
  f.step(30000);
  assert.equal(f.callbacks.size, 0); assert.equal(f.draws.length, before);
  assert.equal(f.renderer.resizes, resizes, 'No offscreen framebuffer reallocations');
  assert.equal(f.engine.snapshot.width, 200, 'Diagnostics report actual backing size, not unrendered target');
  f.engine.command({ kind: 'state', state: { active: true } }); f.step();
  assert.equal(f.renderer.resizes, resizes + 1);
  assert.equal(f.engine.snapshot.width, 820); assert.equal(f.engine.snapshot.height, 246);
  f.engine.dispose();
});

test('explicit hidden capture applies a pending resize without waking animation', () => {
  const f = fixture({ activity: 'idle' });
  f.engine.command({ kind: 'state', state: { active: false } });
  f.engine.command({ kind: 'resize', width: 321, height: 213, dpr: 1 });
  const frames = f.draws.length, resizes = f.renderer.resizes;
  f.engine.command({ kind: 'capture', request: 99 });
  const captured = f.events.at(-1);
  assert.equal(captured.kind, 'pixels');
  assert.deepEqual([captured.image.width, captured.image.height], [321, 213]);
  assert.equal(f.draws.length, frames + 1); assert.equal(f.renderer.resizes, resizes + 1);
  assert.equal(f.callbacks.size, 0); f.engine.dispose();
});

test('unannotated design updates interpolate eyes and preserve current pose on interruption', () => {
  const f = fixture();
  f.engine.command({ kind: 'design', design: createDesign({ eyes: { left: { weights: { smile: 1 } } } }) });
  assert.equal(f.engine.snapshot.pose.eyes.left.smile, 0);
  f.step(); f.step(100);
  const current = f.engine.snapshot.pose.eyes.left.smile;
  assert.ok(current > 0 && current < 1);
  f.engine.command({ kind: 'design', design: createDesign() });
  assert.equal(f.engine.snapshot.pose.eyes.left.smile, current);
  f.step(1); assert.ok(Math.abs(f.engine.snapshot.pose.eyes.left.smile - current) < .02);
  for (let i = 0; i < 30; i++) f.step(16);
  near(f.engine.snapshot.pose.eyes.left.smile, 0); f.engine.dispose();
});

test('emotion overlays interpolate eyes and body without changing authored motion and settle neutral to idle', () => {
  const f = fixture();
  f.engine.command({ kind: 'state', state: { emotion: { emotion: 'happy', intensity: 1 } } });
  f.step(); near(f.draws.at(-1).pose.eyes.left.smile, 0);
  for (let i = 0; i < 20; i++) f.step(16);
  assert.ok(f.draws.at(-1).pose.eyes.left.smile > .7);
  assert.equal(f.engine.snapshot.pose.eyes.left.smile, 0, 'emotion must never mutate baseline eyes');
  const last = structuredClone(f.draws.at(-1));
  f.engine.command({ kind: 'state', state: { emotion: { emotion: 'sad', intensity: 1 } } });
  f.engine.capture(); assert.deepEqual(f.draws.at(-1).pose, last.pose);
  f.step(1); assert.ok(Math.abs(f.draws.at(-1).pose.eyes.left.smile - last.pose.eyes.left.smile) < .02);
  f.engine.command({ kind: 'state', state: { emotion: { emotion: 'neutral', intensity: 1 } } });
  for (let i = 0; i < 130; i++) f.step(16);
  near(f.draws.at(-1).pose.eyes.left.smile, 0);
  assert.equal(f.callbacks.size, 0, 'neutral still must stop scheduling'); f.engine.dispose();
});

test('orientation and attention restore smoothly while reduced motion settles immediately', () => {
  const f = fixture({ activity: 'thinking' });
  const gaze = f.draws.at(-1).activityFrame.gaze[0];
  f.engine.command({ kind: 'state', state: { attention: true, bodyOrientation: { yaw: 60, pitch: 15, roll: -10 } } });
  f.engine.capture(); near(f.draws.at(-1).activityFrame.gaze[0], gaze); near(f.draws.at(-1).bodyOrientation.yaw, 0);
  f.step(); f.step(16); assert.ok(f.draws.at(-1).bodyOrientation.yaw > 0 && f.draws.at(-1).bodyOrientation.yaw < 60);
  assert.ok(f.draws.at(-1).activityFrame.gaze[0] > 0);
  f.engine.command({ kind: 'state', state: { reduced: true, emotion: { emotion: 'sad', intensity: 1 } } });
  f.engine.capture(); near(f.draws.at(-1).bodyOrientation.yaw, 60); near(f.draws.at(-1).pose.eyes.left.openness, .62);
  f.engine.dispose();
});

test('startup presentation fence draws the latest authored shape and eyes before acknowledging readiness', () => {
  const f = fixture();
  const design = createDesign({ body: { shape: 'heart' }, eyes: { left: { weights: { smile: 1 } }, right: { weights: { smile: 1 } } } });
  f.engine.command({ kind: 'design', design });
  f.engine.command({ kind: 'state', state: { bodyOrientation: { yaw: 24, pitch: 8, roll: 0 }, activity: 'thinking' } });
  const frames = f.draws.length;
  f.engine.command({ kind: 'present', request: 999 }, 3);
  const draw = f.draws.at(-1);
  assert.equal(f.draws.length, frames + 1);
  assert.equal(draw.design.body.shape, 'heart');
  assert.equal(draw.pose.eyes.left.smile, 1);
  assert.equal(draw.pose.eyes.right.smile, 1);
  assert.equal(draw.bodyOrientation.yaw, 24);
  const completed = f.events.find(event => event.kind === 'complete' && event.request === 999);
  assert.equal(completed.revision, 3);
  assert.equal(completed.snapshot.frames, f.draws.length);
  // Subsequent authored changes retain the existing smooth animation contract.
  f.engine.command({ kind: 'design', design: createDesign({ body: { shape: 'flower' } }) });
  f.step(); f.step(20);
  assert.ok(f.engine.snapshot.pose.eyes.left.smile > 0 && f.engine.snapshot.pose.eyes.left.smile < 1);
  f.engine.dispose();
});
