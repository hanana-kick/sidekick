import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PlaybackController } from '../src/element/playback.js';
import type { PlaybackHost } from '../src/element/playback.js';
import { createAccessory, createDesign, patchDesign } from '../src/core/design.js';
import type { MotionResult } from '../src/core/motion.js';

function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
function fixture() {
  const calls: string[] = [], shapes: ReturnType<typeof deferred<MotionResult>>[] = [];
  let design = createDesign(), immediate = false, connected = true;
  const animations: { resolve: () => void; cancelled: boolean }[] = [];
  const host: PlaybackHost = {
    setActivity: activity => { calls.push(activity); },
    setShape: (shape, options) => { calls.push(`shape:${shape}:${options.duration}`); const task = deferred<MotionResult>(); shapes.push(task); design = patchDesign(design, { body: { shape } }); return task.promise; },
    setExpression: () => Promise.resolve({ finished: true }),
    updateDesign: async patch => { calls.push('equipment'); design = patchDesign(design, patch); },
    getDesign: () => design,
    getCanvas: () => ({ animate: () => { const task = deferred<void>(); const record = { resolve: () => task.resolve(), cancelled: false }; animations.push(record); return { finished: task.promise, cancel: () => { record.cancelled = true; task.resolve(); }, finish: () => task.resolve() }; } }) as unknown as HTMLCanvasElement,
    immediateMotion: () => immediate,
    isConnected: () => connected,
    cancelAssetMotion: channels => { calls.push(`cancel:${channels.shape}:${channels.expression}`); },
  };
  return { controller: new PlaybackController(host), calls, shapes, animations, design: () => design, immediate: () => { immediate = true; }, disconnect: () => { connected = false; } };
}
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

test('finite playback ends at its interval and loops settle false on stop/replacement', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture();
  const loop = f.controller.play('thinking');
  const finite = f.controller.play('speaking', { duration: 100 });
  assert.deepEqual(await loop, { finished: false });
  t.mock.timers.tick(99);
  assert.deepEqual(f.calls, ['thinking', 'speaking']);
  t.mock.timers.tick(1);
  assert.deepEqual(await finite, { finished: true });
  assert.equal(f.calls.at(-1), 'idle');
  const next = f.controller.play('listening'); f.controller.stop();
  assert.deepEqual(await next, { finished: false });
});

test('shape completion follows worker acknowledgement rather than elapsed time', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture(); let settled = false;
  const promise = f.controller.transitionTo({ shape: 'circle' }, { duration: 100 }).then(result => { settled = true; return result; });
  t.mock.timers.tick(1000); await flush(); assert.equal(settled, false);
  f.shapes[0]!.resolve({ finished: true });
  assert.deepEqual(await promise, { finished: true });
});

test('equipment fades on canvas and changes only at midpoint; cancellation cannot restore stale targets', async () => {
  const f = fixture(); const first = f.controller.transitionTo({ accessories: [createAccessory('beret')] }, { duration: 100 });
  assert.equal(f.design().accessories.length, 0);
  f.animations[0]!.resolve(); await flush();
  assert.equal(f.design().accessories[0]!.preset, 'beret');
  assert.equal(f.animations.length, 2);
  const replacement = f.controller.transitionTo({ shape: 'circle' }, { duration: 100 });
  assert.deepEqual(await first, { finished: false });
  assert.equal(f.animations.every(animation => animation.cancelled), true);
  await flush(); assert.equal(f.design().body.shape, 'circle');
  f.shapes[0]!.resolve({ finished: true }); assert.deepEqual(await replacement, { finished: true });
});

test('validation is atomic including duplicate equipment slots', async () => {
  const f = fixture(); const active = f.controller.transitionTo({ shape: 'circle' });
  assert.throws(() => f.controller.transitionTo({ shape: 'square', accessories: [createAccessory('beret'), createAccessory('crown')] }));
  assert.deepEqual(f.calls, ['shape:circle:400']);
  f.shapes[0]!.resolve({ finished: true }); assert.deepEqual(await active, { finished: true });
});

test('reduced motion snaps equipment and shape duration but preserves playback interval', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture(); f.immediate();
  const transition = f.controller.transitionTo({ shape: 'circle', accessories: [createAccessory('beret')] });
  await flush(); assert.equal(f.animations.length, 0); assert.equal(f.calls[0], 'shape:circle:0');
  f.shapes[0]!.resolve({ finished: true }); await transition;
  const playing = f.controller.play('speaking', { duration: 50 }); t.mock.timers.tick(50);
  assert.deepEqual(await playing, { finished: true });
});

test('disconnect settles both controllers, clearing fades and playback timers', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture();
  const play = f.controller.play('speaking', { duration: 100 });
  const transition = f.controller.transitionTo({ shape: 'circle', accessories: [createAccessory('beret')] });
  f.disconnect(); f.controller.disconnect();
  assert.deepEqual(await play, { finished: false }); assert.deepEqual(await transition, { finished: false });
  t.mock.timers.tick(200); await flush(); assert.equal(f.calls.includes('idle'), false); assert.equal(f.calls.includes('equipment'), false);
});

test('policy changes finish a pending fade and skip remaining motion', async () => {
  const f = fixture();
  const transition = f.controller.transitionTo({ accessories: [createAccessory('beret')] });
  f.immediate(); f.controller.policyChanged();
  assert.deepEqual(await transition, { finished: true });
  assert.equal(f.animations.length, 1);
  assert.equal(f.animations[0]!.cancelled, true);
  assert.equal(f.design().accessories[0]!.preset, 'beret');
});

test('cancel before fade midpoint prevents any equipment mutation', async () => {
  const f = fixture();
  const transition = f.controller.transitionTo({ accessories: [createAccessory('beret')] });
  f.controller.cancelTransition();
  assert.deepEqual(await transition, { finished: false });
  await flush(); assert.equal(f.design().accessories.length, 0);
});

test('invalid options leave current playback untouched and detached playback cancels', async () => {
  const f = fixture(); const playing = f.controller.play('thinking');
  assert.throws(() => f.controller.play('speaking', { duration: Number.NaN }));
  assert.deepEqual(f.calls, ['thinking']);
  f.controller.stop(); assert.deepEqual(await playing, { finished: false });
  f.disconnect(); assert.deepEqual(await f.controller.play('speaking'), { finished: false });
});
