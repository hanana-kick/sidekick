import test from 'node:test';
import assert from 'node:assert/strict';
import { AvatarMovement } from '../dist/src/element/movement.js';
function fixture() {
  let now = 0, frame = 0;
  const callbacks = new Map(), events = [], points = [];
  const state = { immediate: false, max: 1000 };
  const controller = new AvatarMovement({
    now: () => now, immediate: () => state.immediate,
    constrain: p => ({ x: Math.max(0, Math.min(state.max, p.x)), y: Math.max(0, Math.min(state.max, p.y)) }),
    render: p => points.push(p), complete: r => events.push(r),
    requestFrame: callback => { callbacks.set(++frame, callback); return frame; }, cancelFrame: id => callbacks.delete(id),
  });
  return { controller, state, events, points, callbacks, at(time) { now = time; for (const [id, callback] of [...callbacks]) { callbacks.delete(id); callback(now); } }, clock(time) { now = time; } };
}
test('move interpolates CSS pixel positions and resolves once at its real endpoint', async () => {
  const f = fixture(), result = f.controller.to({ x: 100, y: 200 }, { duration: 100, easing: 'linear' });
  f.at(25); assert.deepEqual(f.controller.position, { x: 25, y: 50 }); assert.equal(f.events.length, 0);
  f.at(100); assert.deepEqual(await result, { finished: true, position: { x: 100, y: 200 } }); assert.equal(f.events.length, 1); assert.equal(f.callbacks.size, 0);
});
test('retarget samples the displayed trajectory and cancels prior promise once', async () => {
  const f = fixture(), old = f.controller.to({ x: 100, y: 0 }, { duration: 100, easing: 'linear' });
  f.clock(50); const next = f.controller.to({ x: 200, y: 0 }, { duration: 100, easing: 'linear' });
  assert.deepEqual(await old, { finished: false, position: { x: 50, y: 0 } });
  f.at(100); assert.equal(f.controller.position.x, 125); f.at(150); assert.equal((await next).finished, true); assert.equal(f.events.length, 2);
});
test('cancel leaves the current position and no scheduled callback', async () => {
  const f = fixture(), result = f.controller.to({ x: 100, y: 0 }, { duration: 100, easing: 'linear' });
  f.clock(40); f.controller.cancel(); f.controller.cancel();
  assert.equal((await result).finished, false); assert.equal(f.controller.position.x, 40); assert.equal(f.callbacks.size, 0); assert.equal(f.events.length, 1);
});
test('relative movement uses in-flight current position', async () => {
  const f = fixture(), old = f.controller.to({ x: 100, y: 0 }, { duration: 100, easing: 'linear' });
  f.clock(40); const next = f.controller.by({ x: 20, y: 10 }, { duration: 0 });
  assert.equal((await old).finished, false); assert.deepEqual((await next).position, { x: 60, y: 10 });
});
test('resize clamps current position and target while retaining remaining time', async () => {
  const f = fixture(), result = f.controller.to({ x: 100, y: 200 }, { duration: 100, easing: 'linear' });
  f.at(50); f.state.max = 30; f.controller.resize(); assert.deepEqual(f.controller.position, { x: 30, y: 30 });
  f.at(100); assert.deepEqual(await result, { finished: true, position: { x: 30, y: 30 } });
});
test('reduced motion and lifecycle policy can snap active motion', async () => {
  const f = fixture(), old = f.controller.to({ x: 100, y: 0 }); f.controller.finish();
  assert.equal((await old).finished, true); f.state.immediate = true;
  assert.deepEqual(await f.controller.to({ x: 400, y: 0 }), { finished: true, position: { x: 400, y: 0 } }); assert.equal(f.callbacks.size, 0);
});
test('invalid position or timing does not cancel valid work', async () => {
  const f = fixture(), old = f.controller.to({ x: 100, y: 0 }, { duration: 100 });
  for (const target of [{ x: NaN, y: 0 }, { x: 1e9, y: 0 }, { x: 0 }, { x: 0, y: 0, z: 1 }]) assert.throws(() => f.controller.to(target));
  assert.throws(() => f.controller.by({ x: 0, y: 0 }, { duration: -1 }));
  f.at(100); assert.equal((await old).finished, true);
});
test('returned positions cannot mutate controller state; zero-distance completes synchronously', async () => {
  const f = fixture(), position = f.controller.position; position.x = 10;
  assert.equal(f.controller.position.x, 0); assert.equal((await f.controller.to({ x: 0, y: 0 })).finished, true); assert.equal(f.callbacks.size, 0);
});
