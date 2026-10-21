import test from 'node:test';
import assert from 'node:assert/strict';
import { AvatarMovement, validateMoveOptions } from '../dist/src/element/movement.js';

function fixture(hooks = {}) {
  let now = 0, frame = 0;
  const callbacks = new Map(), events = [], points = [], states = [], presentations = [];
  const state = { immediate: false, min: 0, max: 1000 };
  const controller = new AvatarMovement({
    now: () => now, immediate: () => state.immediate,
    constrain: p => ({ x: Math.max(state.min, Math.min(state.max, p.x)), y: Math.max(state.min, Math.min(state.max, p.y)) }),
    render: p => { points.push(p); hooks.render?.(p); }, complete: r => { events.push(r); return hooks.complete?.(r); },
    refreshTarget: () => hooks.refreshTarget?.(), progress: s => { states.push(s); hooks.progress?.(s); }, presentation: p => { presentations.push(p); hooks.presentation?.(p); },
    requestFrame: callback => { callbacks.set(++frame, callback); return frame; }, cancelFrame: id => callbacks.delete(id),
  });
  return {
    controller, state, events, points, callbacks, states, presentations,
    get now() { return now; },
    at(time) { now = time; for (const [id, callback] of [...callbacks]) { callbacks.delete(id); callback(now); } },
    clock(time) { now = time; },
  };
}
const plain = { duration: 100, easing: 'linear', travel: 'none' };
const physics = { maxSpeed: 300, acceleration: 600, deceleration: 800 };
const neutral = { direction: [0, 0], strength: 0, lift: 0, bank: 0 };
const close = (actual, expected, tolerance = 1e-9, message = '') => assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} ≠ ${expected} (±${tolerance})`);
function advance(f, time, hz = 60) {
  const start = f.now, count = Math.ceil((time - start) / (1000 / hz));
  for (let i = 1; i <= count; i++) f.at(Math.min(time, start + i * 1000 / hz));
}
function finish(f, { hz = 60, timeout = 20000 } = {}) {
  const start = f.now;
  while (f.callbacks.size && f.now - start < timeout) f.at(f.now + 1000 / hz);
  assert.equal(f.callbacks.size, 0, `movement did not settle within ${timeout} ms; ${JSON.stringify(f.controller.state)}`);
}
function boundedPresentation(p) {
  assert.ok(p.strength >= 0 && p.strength <= 1);
  assert.ok(p.lift >= 0 && p.lift <= 0.06);
  assert.ok(Math.abs(p.bank) <= 0.12 + 1e-12);
  if (p.strength > 0) close(Math.hypot(...p.direction), 1, 1e-9);
}
function finiteState(state) {
  for (const value of [state.progress, state.speed, ...Object.values(state.position), ...Object.values(state.velocity), ...Object.values(state.acceleration)]) assert.ok(Number.isFinite(value), JSON.stringify(state));
  close(state.speed, Math.hypot(state.velocity.x, state.velocity.y));
  assert.ok(state.progress >= 0 && state.progress <= 1);
}

test('plain travel preserves exact duration, interpolation and CSS velocity', async () => {
  const f = fixture(), result = f.controller.to({ x: 100, y: 200 }, plain);
  f.at(25); assert.deepEqual(f.controller.position, { x: 25, y: 50 }); assert.equal(f.events.length, 0);
  assert.deepEqual(f.controller.state.velocity, { x: 1000, y: 2000 }); assert.deepEqual(f.presentations.at(-1), neutral);
  f.at(100); assert.deepEqual(await result, { finished: true, position: { x: 100, y: 200 } }); assert.equal(f.events.length, 1); assert.equal(f.callbacks.size, 0);
});
test('plain smooth easing retains the legacy cubic trajectory', async () => {
  const f = fixture(), result = f.controller.to({ x: 100, y: 0 }, { ...plain, easing: 'smooth' });
  f.at(25); close(f.controller.position.x, 15.625); close(f.controller.state.velocity.x, 1125);
  f.at(50); close(f.controller.position.x, 50); close(f.controller.state.velocity.x, 1500);
  f.at(100); assert.equal((await result).finished, true);
});
test('plain retarget samples displayed trajectory and cancels the prior promise once', async () => {
  const f = fixture(), old = f.controller.to({ x: 100, y: 0 }, plain);
  f.clock(50); const next = f.controller.to({ x: 200, y: 0 }, plain);
  assert.deepEqual(await old, { finished: false, position: { x: 50, y: 0 } });
  f.at(100); assert.equal(f.controller.position.x, 125); f.at(150); assert.equal((await next).finished, true); assert.equal(f.events.length, 2);
});
test('plain cancel samples the current point and immediately stops scheduling', async () => {
  const f = fixture(), result = f.controller.to({ x: 100, y: 0 }, plain);
  f.clock(40); f.controller.cancel(); f.controller.cancel();
  assert.equal((await result).finished, false); assert.equal(f.controller.position.x, 40); assert.equal(f.callbacks.size, 0); assert.equal(f.events.length, 1);
});
test('relative movement uses the sampled in-flight position', async () => {
  const f = fixture(), old = f.controller.to({ x: 100, y: 0 }, plain);
  f.clock(40); const next = f.controller.by({ x: 20, y: 10 }, { duration: 0 });
  assert.equal((await old).finished, false); assert.deepEqual((await next).position, { x: 60, y: 10 });
});
test('plain resize clamps current point and target while retaining the deadline', async () => {
  const f = fixture(), result = f.controller.to({ x: 100, y: 200 }, plain);
  f.at(50); f.state.max = 30; f.controller.resize(); assert.deepEqual(f.controller.position, { x: 30, y: 30 });
  f.at(100); assert.deepEqual(await result, { finished: true, position: { x: 30, y: 30 } });
});
test('zero duration, reduced motion and zero distance complete synchronously without residual motion', async () => {
  for (const mode of ['duration', 'reduced', 'same-point']) {
    const f = fixture(); if (mode === 'reduced') f.state.immediate = true;
    const target = mode === 'same-point' ? { x: 0, y: 0 } : { x: 400, y: 200 };
    const result = f.controller.to(target, mode === 'duration' ? { duration: 0 } : {});
    assert.deepEqual(f.controller.position, target); assert.equal(f.callbacks.size, 0);
    assert.deepEqual(await result, { finished: true, position: target });
    assert.equal(f.controller.state.speed, 0); assert.deepEqual(f.controller.state.acceleration, { x: 0, y: 0 }); assert.deepEqual(f.presentations.at(-1), neutral);
  }
});

test('natural is the default and accelerates from rest rather than waiting through a timed takeoff', async () => {
  const f = fixture(), result = f.controller.to({ x: 1000, y: 0 }, physics);
  assert.equal(f.controller.state.phase, 'takeoff'); assert.equal(f.controller.state.speed, 0);
  advance(f, 100); assert.ok(f.controller.position.x > 0); assert.ok(f.controller.state.speed > 0);
  assert.ok(f.controller.state.speed <= physics.maxSpeed); finiteState(f.controller.state);
  finish(f); assert.deepEqual(await result, { finished: true, position: { x: 1000, y: 0 } });
  assert.equal(f.controller.state.phase, 'idle'); assert.equal(f.controller.state.progress, 1); assert.deepEqual(f.presentations.at(-1), neutral);
});
test('exponential acceleration response integrates actual velocity and position before cruise and braking', async () => {
  const f = fixture(), result = f.controller.to({ x: 1000, y: 0 }, physics);
  for (const time of [100, 200, 300, 400]) {
    advance(f, time, 120);
    close(f.controller.state.velocity.x, physics.acceleration * (time / 1000 - .06 * (1 - Math.exp(-time / 1000 / .06))), 1e-6, `velocity at ${time} ms`);
    close(f.controller.position.x, physics.acceleration * ((time / 1000) ** 2 / 2 - .06 * time / 1000 + .06 ** 2 * (1 - Math.exp(-time / 1000 / .06))), 1e-6, `position at ${time} ms`);
    close(f.controller.state.acceleration.x, physics.acceleration * (1 - Math.exp(-time / 1000 / .06)), 1e-6);
    close(f.controller.state.velocity.y, 0); close(f.controller.state.acceleration.y, 0);
  }
  advance(f, 1500, 120); close(f.controller.state.speed, physics.maxSpeed, 1e-4); close(f.controller.state.acceleration.x, 0, 1e-4);
  finish(f, { hz: 120 }); await result;
  assert.ok(f.states.some(s => s.velocity.x > 0 && s.acceleration.x < -1), 'arrival has a real deceleration interval');
  assert.ok(f.states.every(s => s.speed <= physics.maxSpeed + 1e-6));
  assert.ok(f.points.every(p => p.x >= 0 && p.x <= 1000 && p.y === 0));
  assert.deepEqual(f.controller.state.velocity, { x: 0, y: 0 }); assert.deepEqual(f.controller.state.acceleration, { x: 0, y: 0 });
});
test('fixed integration produces matching traces at 30, 60 and 120 Hz', async () => {
  const traces = [];
  for (const hz of [30, 60, 120]) {
    const f = fixture(), result = f.controller.to({ x: 900, y: 400 }, physics), trace = [];
    for (let time = 100; time <= 3000; time += 100) {
      advance(f, time, hz); trace.push(f.controller.state); finiteState(f.controller.state);
    }
    finish(f, { hz }); assert.equal((await result).finished, true); traces.push(trace);
  }
  for (let i = 0; i < traces[0].length; i++) for (const trace of traces.slice(1)) {
    for (const field of ['position', 'velocity', 'acceleration']) for (const axis of ['x', 'y']) close(trace[i][field][axis], traces[0][i][field][axis], 1e-6, `${field}.${axis} at sample ${i}`);
  }
});
test('positive natural duration never changes the fixed speed ceiling or physical trace', async () => {
  const traces = [];
  for (const duration of [10, 60000]) {
    const f = fixture(), result = f.controller.to({ x: 700, y: 0 }, { ...physics, duration });
    advance(f, 1000); traces.push(f.controller.state); assert.notEqual(f.controller.state.phase, 'idle');
    finish(f); await result;
  }
  assert.deepEqual(traces[0], traces[1]);
  const fast = fixture(), slow = fixture();
  const fastResult = fast.controller.to({ x: 700, y: 0 }, { duration: 400 });
  const slowResult = slow.controller.to({ x: 700, y: 0 }, { duration: 4000 });
  advance(fast, 400); advance(slow, 400); assert.deepEqual(fast.controller.state, slow.controller.state);
  finish(fast); finish(slow); await Promise.all([fastResult, slowResult]);
});
test('natural easing cannot reintroduce a timed velocity reset', async () => {
  const traces = [];
  for (const easing of ['linear', 'smooth']) {
    const f = fixture(), result = f.controller.to({ x: 900, y: 0 }, { ...physics, easing });
    advance(f, 400); traces.push(f.controller.state); finish(f); await result;
  }
  assert.deepEqual(traces[0], traces[1]);
});
test('all cardinal and diagonal headings reflect actual screen-space velocity', async () => {
  for (const [dx, dy] of [[300, 0], [-300, 0], [0, 300], [0, -300], [300, 300], [-300, -300]]) {
    const f = fixture(); await f.controller.to({ x: 500, y: 500 }, { duration: 0 });
    const result = f.controller.by({ x: dx, y: dy }, physics); advance(f, 300);
    const p = f.presentations.at(-1), length = Math.hypot(dx, dy);
    close(p.direction[0], dx / length, 1e-6); close(p.direction[1], dy / length, 1e-6); boundedPresentation(p);
    assert.ok(f.controller.state.velocity.x * dx >= 0); assert.ok(f.controller.state.velocity.y * dy >= 0);
    finish(f); assert.equal((await result).finished, true);
  }
});
test('retarget preserves instantaneous position, velocity and presentation before reversing smoothly', async () => {
  const f = fixture(); await f.controller.to({ x: 100, y: 100 }, { duration: 0 });
  const old = f.controller.to({ x: 900, y: 100 }, physics); advance(f, 700);
  const before = f.controller.state, pose = structuredClone(f.presentations.at(-1));
  const next = f.controller.to({ x: 0, y: 100 }, physics);
  assert.deepEqual(await old, { finished: false, position: before.position });
  assert.deepEqual(f.controller.position, before.position); assert.deepEqual(f.controller.state.velocity, before.velocity);
  assert.deepEqual(f.presentations.at(-1), pose); assert.equal(f.callbacks.size, 1);
  advance(f, 750); assert.ok(f.controller.position.x > before.position.x, 'momentum continues right while decelerating'); assert.ok(f.controller.state.velocity.x > 0);
  let previous = f.controller.state;
  while (f.controller.state.velocity.x >= 0 && f.now < 2000) {
    f.at(f.now + 1000 / 120); const current = f.controller.state;
    assert.ok(Math.hypot(current.velocity.x - previous.velocity.x, current.velocity.y - previous.velocity.y) <= Math.max(physics.acceleration, physics.deceleration) / 120 + 1e-6);
    previous = current;
  }
  assert.ok(f.controller.state.velocity.x < 0, 'reversal eventually acquires velocity toward the new target');
  finish(f); assert.deepEqual(await next, { finished: true, position: { x: 0, y: 100 } }); assert.equal(f.events.length, 3);
});
test('natural cancel coasts through a controlled stop and settles before resolving once', async () => {
  const f = fixture(); let resolved = false;
  const result = f.controller.to({ x: 1000, y: 0 }, physics).then(value => { resolved = true; return value; });
  advance(f, 800); const before = f.controller.state; f.controller.cancel();
  assert.equal(f.controller.state.phase, 'braking'); assert.deepEqual(f.controller.state.velocity, before.velocity);
  const interruptedProgress = f.controller.state.progress;
  await Promise.resolve(); assert.equal(resolved, false); assert.equal(f.events.length, 0);
  let previousSpeed = before.speed;
  while (f.controller.state.phase === 'braking' && f.now < 2000) {
    f.at(f.now + 1000 / 120); const current = f.controller.state;
    assert.ok(current.speed <= previousSpeed + 1e-9); previousSpeed = current.speed; f.controller.cancel();
  }
  assert.equal(f.controller.state.phase, 'settling'); assert.equal(f.controller.state.speed, 0);
  const stopped = f.controller.position, settlingStarted = f.now;
  assert.ok(stopped.x > before.position.x, 'cancel must not freeze a moving avatar');
  close(stopped.x - before.position.x, before.speed ** 2 / (2 * physics.deceleration) + .06 * before.speed, 2, 'stopping distance');
  advance(f, settlingStarted + 150); assert.deepEqual(f.controller.position, stopped); await Promise.resolve(); assert.equal(resolved, false);
  finish(f); assert.ok(f.now - settlingStarted >= 175);
  assert.deepEqual(await result, { finished: false, position: stopped }); assert.ok(f.controller.state.progress >= interruptedProgress && f.controller.state.progress < 1);
  assert.equal(f.events.length, 1); assert.equal(f.controller.state.phase, 'idle'); assert.deepEqual(f.presentations.at(-1), neutral);
});
test('retarget during braking carries remaining velocity and settles the old promise immediately', async () => {
  const f = fixture(), old = f.controller.to({ x: 900, y: 0 }, physics); advance(f, 600); f.controller.cancel(); advance(f, 700);
  const before = f.controller.state, pose = structuredClone(f.presentations.at(-1));
  const next = f.controller.to({ x: 500, y: 400 }, physics);
  assert.equal((await old).finished, false); assert.deepEqual(f.controller.state.velocity, before.velocity); assert.deepEqual(f.controller.position, before.position); assert.deepEqual(f.presentations.at(-1), pose);
  finish(f); assert.deepEqual(await next, { finished: true, position: { x: 500, y: 400 } }); assert.equal(f.events.length, 2);
});
test('disconnect, immediate cancellation and reduced-motion cancellation reset without coasting', async () => {
  for (const mode of ['disconnect', 'immediate', 'reduced']) {
    const f = fixture(), result = f.controller.to({ x: 900, y: 0 }, physics); advance(f, 600); const before = f.controller.position;
    if (mode === 'reduced') f.state.immediate = true;
    if (mode === 'disconnect') f.controller.disconnect(); else f.controller.cancel(mode === 'immediate');
    assert.deepEqual(await result, { finished: false, position: before }); assert.equal(f.callbacks.size, 0); assert.equal(f.controller.state.phase, 'idle'); assert.equal(f.controller.state.speed, 0); assert.deepEqual(f.presentations.at(-1), neutral);
  }
});
test('finish snaps active travel, but a cancelled request remains cancelled', async () => {
  for (const cancelled of [false, true]) {
    const f = fixture(), result = f.controller.to({ x: 900, y: 0 }, physics); advance(f, 600);
    if (cancelled) f.controller.cancel(); const before = f.controller.position; f.controller.finish();
    assert.deepEqual(await result, { finished: !cancelled, position: cancelled ? before : { x: 900, y: 0 } }); assert.equal(f.callbacks.size, 0); assert.deepEqual(f.presentations.at(-1), neutral);
  }
});
test('reduced motion changed during flight completes at the target on the next frame', async () => {
  const f = fixture(), result = f.controller.to({ x: 700, y: 0 }, physics); advance(f, 500); f.state.immediate = true; f.at(510);
  assert.deepEqual(await result, { finished: true, position: { x: 700, y: 0 } }); assert.equal(f.callbacks.size, 0); assert.deepEqual(f.presentations.at(-1), neutral);
});
test('natural resize preserves momentum on free axes and clamps target and position', async () => {
  const f = fixture(), result = f.controller.to({ x: 900, y: 700 }, physics); advance(f, 500); const before = f.controller.state;
  f.state.max = 500; f.controller.resize(); assert.deepEqual(f.controller.position, before.position); assert.deepEqual(f.controller.state.velocity, before.velocity);
  finish(f); assert.deepEqual(await result, { finished: true, position: { x: 500, y: 500 } });
  assert.ok(f.points.every(p => p.x >= 0 && p.x <= 500 && p.y >= 0 && p.y <= 500));
});
test('bounds prevent outward velocity and runaway position after shrink or retarget', async () => {
  const f = fixture(), old = f.controller.to({ x: 1000, y: 1000 }, physics); advance(f, 1500); f.state.max = 50; f.controller.resize();
  assert.deepEqual(f.controller.position, { x: 50, y: 50 }); assert.equal(f.controller.state.speed, 0);
  finish(f); assert.equal((await old).finished, true);
  const next = f.controller.to({ x: -10000, y: -10000 }, physics); finish(f); assert.deepEqual((await next).position, { x: 0, y: 0 });
  assert.ok(f.states.every(s => Number.isFinite(s.speed)));
});
test('suspended frames cap catch-up at 100 ms instead of teleporting to the endpoint', async () => {
  const f = fixture(), result = f.controller.to({ x: 1000, y: 0 }, physics); advance(f, 300); const before = f.controller.state;
  f.at(10000); const after = f.controller.state;
  assert.ok(after.position.x > before.position.x); assert.ok(after.position.x - before.position.x <= physics.maxSpeed * 0.1 + 1e-6);
  assert.ok(after.speed - before.speed <= physics.acceleration * 0.1 + 1e-6); assert.notEqual(after.phase, 'idle'); assert.equal(f.events.length, 0);
  finish(f); assert.equal((await result).finished, true);
});
test('natural-to-plain transition preserves plain timing and gently removes the flight pose', async () => {
  const f = fixture(), old = f.controller.to({ x: 900, y: 0 }, physics); advance(f, 500); const start = f.controller.position.x, pose = structuredClone(f.presentations.at(-1));
  const next = f.controller.to({ x: 500, y: 0 }, { ...plain, duration: 400 }); assert.equal((await old).finished, false);
  f.at(590); close(f.controller.position.x, start + (500 - start) * 0.225); close(f.presentations.at(-1).strength, pose.strength * 0.5); close(f.presentations.at(-1).lift, pose.lift * 0.5);
  f.at(680); assert.equal(f.presentations.at(-1).strength, 0); f.at(900); assert.equal((await next).finished, true);
});
test('invalid options and points fail before sampling or cancelling valid work', async () => {
  const f = fixture(), result = f.controller.to({ x: 900, y: 0 }, physics); advance(f, 500); const before = f.controller.state;
  const invalid = [null, [], 10, { travel: 'hover' }, { easing: 'ease' }, { duration: Infinity }, { duration: -1 }, { duration: 60001 }, { extra: true }, { [Symbol('extra')]: 1 }, Object.create({ duration: 100 }), Object.defineProperty({}, 'travel', { value: 'natural' }), { get travel() { throw new Error('must not invoke getters'); } }];
  for (const key of ['maxSpeed', 'acceleration', 'deceleration']) for (const value of [0, 0.5, -1, 100001, NaN, Infinity, -Infinity, '300', null]) invalid.push({ [key]: value });
  for (const options of invalid) {
    assert.throws(() => f.controller.to({ x: 20, y: 30 }, options)); assert.throws(() => f.controller.by({ x: 20, y: 30 }, options));
    assert.deepEqual(f.controller.state, before); assert.equal(f.callbacks.size, 1);
  }
  for (const target of [{ x: NaN, y: 0 }, { x: 1e9, y: 0 }, { x: 0 }, { x: 0, y: 0, z: 1 }]) assert.throws(() => f.controller.to(target));
  const defaults = validateMoveOptions(); assert.equal(defaults.duration, 400); assert.equal(defaults.easing, 'smooth'); assert.equal(defaults.travel, 'natural');
  assert.equal(validateMoveOptions(Object.assign(Object.create(null), { travel: 'none' })).travel, 'none');
  finish(f); assert.equal((await result).finished, true);
});
test('state, acceleration, velocity and callback snapshots cannot mutate the controller', async () => {
  const f = fixture(), result = f.controller.to({ x: 900, y: 400 }, physics); advance(f, 300); const before = f.controller.state;
  const state = f.controller.state; state.position.x = -100; state.velocity.y = -100; state.acceleration.x = -999; state.speed = 999; state.phase = 'idle';
  f.states.at(-1).position.y = -100; f.states.at(-1).acceleration.y = -999; f.presentations.at(-1).direction[0] = 999; f.presentations.at(-1).strength = 99;
  assert.deepEqual(f.controller.state, before); advance(f, 400); boundedPresentation(f.presentations.at(-1)); finiteState(f.controller.state);
  finish(f); await result;
});
test('short, diagonal and extreme accepted moves remain finite and settle exactly at their targets', async () => {
  for (const [distance, options] of [[0.001, physics], [1, physics], [10, physics], [40, physics], [1000, { maxSpeed: 10000, acceleration: 100000, deceleration: 100000 }]]) {
    const f = fixture(), result = f.controller.to({ x: distance, y: distance / 2 }, options);
    finish(f, { hz: 120 }); assert.deepEqual(await result, { finished: true, position: { x: distance, y: distance / 2 } });
    f.states.forEach(finiteState); f.presentations.forEach(boundedPresentation); assert.equal(f.events.length, 1);
  }
});
test('rapid retargets own one frame and settle each replaced promise exactly once', async () => {
  const f = fixture(), promises = [];
  for (let i = 0; i < 20; i++) {
    advance(f, i * 20); promises.push(f.controller.to({ x: i % 2 ? 200 : 800, y: 300 }, physics)); assert.equal(f.callbacks.size, 1);
  }
  finish(f); const results = await Promise.all(promises);
  assert.equal(results.filter(r => r.finished).length, 1); assert.equal(f.events.length, 20); assert.deepEqual(f.presentations.at(-1), neutral);
});

test('a natural progress listener can retarget without recursive samples or velocity reset', async () => {
  let next, sampled;
  const f = fixture({ progress(state) { if (state.speed >= 100 && !next) { sampled = state; next = f.controller.to({ x: 100, y: 100 }, physics); } } });
  const old = f.controller.to({ x: 900, y: 0 }, physics); advance(f, 300);
  assert.equal((await old).finished, false); assert.ok(sampled); assert.equal(f.callbacks.size, 1); assert.ok(f.controller.state.speed > 0);
  finish(f); assert.deepEqual(await next, { finished: true, position: { x: 100, y: 100 } }); assert.equal(f.events.length, 2);
});
test('a progress listener can cancel repeatedly without restarting braking or settling', async () => {
  const f = fixture({ progress(state) { if (state.speed >= 100 || state.phase === 'braking' || state.phase === 'settling') f.controller.cancel(); } });
  const result = f.controller.to({ x: 900, y: 0 }, physics); advance(f, 300); assert.equal(f.controller.state.phase, 'braking');
  finish(f); assert.equal((await result).finished, false); assert.equal(f.events.length, 1);
});
test('a newer request from sampled progress wins over outer retarget and relative requests', async () => {
  for (const method of ['to', 'by']) {
    let next;
    const f = fixture({ progress(state) { if (state.phase === 'flight' && state.progress === 0.5 && !next) next = f.controller.to({ x: 300, y: 100 }, plain); } });
    const old = f.controller.to({ x: 700, y: 0 }, plain); f.clock(50);
    const superseded = f.controller[method]({ x: 200, y: 50 }, plain);
    assert.equal((await old).finished, false); assert.equal((await superseded).finished, false); assert.equal(f.callbacks.size, 1);
    f.at(150); assert.deepEqual(await next, { finished: true, position: { x: 300, y: 100 } }); assert.equal(f.events.length, 3);
  }
});
test('completion listeners can start a new natural move without old cleanup removing it', async () => {
  for (const callback of ['progress', 'presentation']) {
    let next, started = false;
    const f = fixture({ [callback](value) {
      const ended = callback === 'progress' ? value.phase === 'idle' && value.progress === 1 : value.strength === 0 && f.controller.state.phase === 'idle';
      if (started && ended && !next) next = f.controller.to({ x: 300, y: 100 }, physics);
    } });
    const old = f.controller.to({ x: 700, y: 0 }, physics); started = true;
    finish(f); assert.equal((await old).finished, true); assert.deepEqual(await next, { finished: true, position: { x: 300, y: 100 } }); assert.equal(f.events.length, 2);
  }
});
test('presentation listeners can retarget without old samples overwriting new motion', async () => {
  let next;
  const f = fixture({ presentation(value) { if (value.strength > 0.5 && !next) next = f.controller.to({ x: 350, y: 400 }, physics); } });
  const old = f.controller.to({ x: 900, y: 0 }, physics); advance(f, 400);
  assert.equal((await old).finished, false); assert.equal(f.callbacks.size, 1);
  finish(f); assert.deepEqual(await next, { finished: true, position: { x: 350, y: 400 } }); assert.equal(f.events.length, 2);
});
test('a progress listener can resize without recursive dispatch or lost frames', async () => {
  const f = fixture({ progress(state) { if (state.phase === 'flight') f.controller.resize(); } });
  const result = f.controller.to({ x: 700, y: 0 }, physics); advance(f, 500); assert.equal(f.callbacks.size, 1);
  finish(f); assert.equal((await result).finished, true);
});
test('movement completion waits for a host render acknowledgement, including immediate moves', async () => {
  for (const duration of [0, 100]) {
    let acknowledge, resolved = false;
    const flushed = new Promise(resolve => { acknowledge = resolve; }); const f = fixture({ complete: () => flushed });
    const result = f.controller.to({ x: 700, y: 0 }, { ...plain, duration }).then(value => { resolved = true; return value; });
    if (duration) f.at(duration); await Promise.resolve(); assert.equal(resolved, false); assert.equal(f.events.length, 1); assert.equal(f.callbacks.size, 0);
    acknowledge(); assert.deepEqual(await result, { finished: true, position: { x: 700, y: 0 } });
  }
});
test('host completion failures do not strand promises or frames', async () => {
  for (const complete of [() => { throw new Error('host unavailable'); }, () => Promise.reject(new Error('render unavailable'))]) {
    const f = fixture({ complete }), result = f.controller.to({ x: 100, y: 0 }, plain); f.at(100);
    assert.equal((await result).finished, true); assert.equal(f.callbacks.size, 0);
  }
});

test('finishing or enabling reduced motion during successful settling keeps the successful result', async () => {
  for (const mode of ['finish', 'reduced']) {
    const f = fixture(), result = f.controller.to({ x: 100, y: 0 }, physics);
    while (f.controller.state.phase !== 'settling' && f.now < 10000) f.at(f.now + 1000 / 120);
    assert.equal(f.controller.state.phase, 'settling'); assert.deepEqual(f.controller.position, { x: 100, y: 0 });
    if (mode === 'finish') f.controller.finish(); else { f.state.immediate = true; f.at(f.now + 1000 / 120); }
    assert.deepEqual(await result, { finished: true, position: { x: 100, y: 0 } }); assert.equal(f.callbacks.size, 0);
  }
});

test('lowering the speed cap on retarget decelerates without clamping away existing momentum', async () => {
  const f = fixture(), old = f.controller.to({ x: 1000, y: 0 }, physics); advance(f, 800);
  const before = f.controller.state;
  const next = f.controller.to({ x: 900, y: 0 }, { ...physics, maxSpeed: 80 });
  assert.equal((await old).finished, false); assert.deepEqual(f.controller.state.velocity, before.velocity);
  advance(f, 850); assert.ok(f.controller.state.speed < before.speed); assert.ok(f.controller.state.speed > 80);
  assert.ok(Math.hypot(f.controller.state.acceleration.x, f.controller.state.acceleration.y) <= physics.deceleration + 1e-6);
  finish(f); assert.deepEqual(await next, { finished: true, position: { x: 900, y: 0 } });
});
test('minimum physical limits are accepted and approach short targets without jitter', async () => {
  const f = fixture(), result = f.controller.to({ x: 1, y: 0 }, { maxSpeed: 1, acceleration: 1, deceleration: 1 });
  finish(f, { hz: 120 }); assert.deepEqual(await result, { finished: true, position: { x: 1, y: 0 } });
  assert.ok(f.states.every(s => Math.hypot(s.acceleration.x, s.acceleration.y) <= 1 + 1e-6));
});
test('cancelling successful arrival during settling still resolves the active request as cancelled', async () => {
  const f = fixture(), result = f.controller.to({ x: 100, y: 0 }, physics);
  while (f.controller.state.phase !== 'settling' && f.now < 10000) f.at(f.now + 1000 / 120);
  assert.equal(f.controller.state.phase, 'settling'); f.controller.cancel(); f.controller.cancel(); finish(f);
  assert.deepEqual(await result, { finished: false, position: { x: 100, y: 0 } }); assert.equal(f.events.length, 1);
});

test('extreme asymmetric reversal preserves acceleration and releases braking force smoothly', async () => {
  const f = fixture(), old = f.controller.to({ x: 1000, y: 0 }, physics);
  advance(f, 1000, 240); const before = f.controller.state;
  const next = f.controller.to({ x: 100, y: 0 }, { maxSpeed: 300, acceleration: 1, deceleration: 100000 });
  assert.equal((await old).finished, false);
  assert.deepEqual(f.controller.state.acceleration, before.acceleration);
  f.at(f.now + 1000 / 240);
  assert.ok(f.controller.state.velocity.x > 0, 'smoothing preserves real forward momentum during virtual braking');
  assert.ok(f.controller.state.velocity.x < before.velocity.x);
  advance(f, 3000, 240);
  assert.ok(f.controller.state.velocity.x < 0, 'reverse acceleration eventually follows the force release');
  assert.ok(f.controller.state.speed < 3, 'braking impulse cannot create unbounded reverse speed');
  close(f.controller.state.acceleration.x, -1, 1e-6);
  finish(f, { timeout: 60000 }); assert.deepEqual(await next, { finished: true, position: { x: 100, y: 0 } });
});

test('asymmetric perpendicular turn retains real momentum and converges without a force or position clip', async () => {
  const f = fixture(), old = f.controller.to({ x: 1000, y: 0 }, physics);
  advance(f, 1000, 240); const before = f.controller.state;
  const target = { x: before.position.x, y: 300 };
  const next = f.controller.to(target, { maxSpeed: 300, acceleration: 60, deceleration: 100000 });
  assert.equal((await old).finished, false);
  assert.deepEqual(f.controller.state.acceleration, before.acceleration);
  f.at(f.now + 1000 / 240);
  assert.ok(f.controller.state.velocity.x > 150, 'physical direction cannot jump with the virtual steering impulse');
  assert.ok(f.controller.state.velocity.y > 0 && f.controller.state.velocity.y < 150);
  const first = f.controller.position;
  advance(f, f.now + 100, 240);
  assert.ok(f.controller.position.y > first.y + 1, 'turn keeps advancing');
  finish(f, { hz: 240 }); assert.deepEqual(await next, { finished: true, position: target });
  f.states.forEach(finiteState);
  assert.ok(f.states.every(s => s.speed <= 300 + 1e-6));
});

test('early oblique retargets converge across display rates without perpendicular orbiting', async () => {
  const options = { maxSpeed: 320, acceleration: 900, deceleration: 1200 };
  for (const hz of [30, 60, 120, 240]) for (let delay = 10; delay <= 200; delay += 10) {
    const f = fixture(); f.state.max = 2000;
    await f.controller.to({ x: 751, y: 400 }, { duration: 0 });
    const old = f.controller.to({ x: 1065, y: 220 }, options);
    advance(f, delay, hz);
    const next = f.controller.to({ x: 449, y: 660 }, options);
    assert.equal((await old).finished, false, `replaced move at ${hz} Hz / ${delay} ms`);
    finish(f, { hz, timeout: 10000 });
    assert.deepEqual(await next, { finished: true, position: { x: 449, y: 660 } }, `${hz} Hz / ${delay} ms`);
    assert.equal(f.events.length, 3);
    f.states.forEach(finiteState);
  }
});

test('fixed natural ceiling allows short moves to brake before cruising and long moves to reach the same cap', async () => {
  const rows = [];
  for (const distance of [50, 200, 800, 2000]) {
    const f = fixture(); f.state.max = 10000;
    const result = f.controller.to({ x: distance, y: 0 }, { duration: 1000 });
    advance(f, 25, 120); close(f.controller.state.speed, 1800 * (.025 - .06 * (1 - Math.exp(-.025 / .06))), 1e-6); close(f.controller.state.acceleration.x, 1800 * (1 - Math.exp(-.025 / .06)), 1e-6);
    finish(f, { hz: 120 }); assert.equal((await result).finished, true);
    rows.push({ distance, duration: f.now, peak: Math.max(...f.states.map(s => s.speed)) });
    assert.ok(f.states.every(s => s.acceleration.x <= 1800 + 1e-6 && s.acceleration.x >= -2200 - 1e-6));
  }
  for (let i = 1; i < rows.length; i++) {
    assert.ok(rows[i].duration > rows[i - 1].duration, 'farther travel must still take longer');
    assert.ok(rows[i].peak > rows[i - 1].peak, 'farther travel reaches a higher peak speed');
  }
  assert.ok(rows[3].peak > 900, 'old arbitrary900px/s ceiling must not constrain long flight');
});

test('shorter retarget brakes for its nearer destination while preserving velocity and acceleration', async () => {
  const f = fixture(); f.state.max = 10000;
  const first = f.controller.to({ x: 2000, y: 0 }, { duration: 1000 }); advance(f, 500, 120);
  const before = f.controller.state;
  const next = f.controller.to({ x: before.position.x + 50, y: 0 }, { duration: 1000 });
  assert.equal((await first).finished, false); close(f.controller.state.speed, before.speed);
  advance(f, 525, 120); assert.ok(f.controller.state.speed > before.speed, 'inherited positive acceleration must unwind smoothly');
  assert.ok(f.controller.state.acceleration.x < before.acceleration.x);
  advance(f, 650, 120); assert.ok(f.controller.state.speed > 120); assert.ok(f.controller.state.speed < before.speed);
  finish(f); assert.equal((await next).finished, true);
});

test('physical attitude smoothing bounds frame-to-frame bank without altering the acceleration trace', async () => {
  const f = fixture(), result = f.controller.to({ x: 800, y: 0 }, { duration: 1000 });
  let previous = neutral;
  while (f.callbacks.size && f.now < 4000) {
    f.at(f.now + 1000 / 120); const p = f.presentations.at(-1) ?? neutral;
    assert.ok(Math.abs(p.bank - previous.bank) < .023, 'instant acceleration switch must not cause a body-bank snap');
    assert.ok(Math.abs(p.strength - previous.strength) < .11);
    boundedPresentation(p); previous = p;
  }
  assert.equal((await result).finished, true);
});

test('default speed ceiling is 1350 independent of distance and positive duration; explicit maxSpeed remains exact', async () => {
  for (const [distance, duration, expected] of [[20, 1000, 1350], [200, 1000, 1350], [800, 1000, 1350], [1e7, 100, 1350], [800, 60000, 1350]]) {
    const f = fixture(); f.state.max = 1e7;
    const result = f.controller.to({ x: distance, y: 0 }, { duration });
    assert.equal(f.controller.track.maxSpeed, expected);
    f.controller.finish(); await result;
  }
  const f = fixture(), result = f.controller.to({ x: 800, y: 0 }, { maxSpeed: 217 });
  assert.equal(f.controller.track.maxSpeed, 217);
  finish(f); await result; assert.ok(f.states.every(s => s.speed <= 217 + 1e-6));
});

test('reported instantaneous acceleration integrates to velocity and position through exponential force ramps', async () => {
  const f = fixture(), result = f.controller.to({ x: 900, y: 300 }, physics);
  const dt = 1 / 240, tau = .06, decay = Math.exp(-dt / tau), integral = tau * (1 - decay);
  let previous = f.controller.state;
  for (let i = 1; i <= 80; i++) {
    f.at(i * 1000 / 240); const current = f.controller.state;
    for (const axis of ['x', 'y']) {
      const a0 = previous.acceleration[axis], a1 = current.acceleration[axis];
      const u = (a1 - a0 * decay) / (1 - decay);
      close(current.velocity[axis] - previous.velocity[axis], u * dt + (a0 - u) * integral, 1e-9);
      close(current.position[axis] - previous.position[axis], previous.velocity[axis] * dt + u * dt * dt / 2 + (a0 - u) * tau * (dt - integral), 1e-9);
    }
    previous = current;
  }
  finish(f); await result;
});

test('stop during takeoff, cruise and arrival retains a continuous force and never reverses or rebounds', async () => {
  for (const cancelAt of [50, 200, 800, 3000]) {
    const f = fixture(), result = f.controller.to({ x: 1000, y: 0 }, physics);
    advance(f, cancelAt, 240); const before = f.controller.state;
    f.controller.cancel(); assert.deepEqual(f.controller.state.acceleration, before.acceleration);
    let last = before;
    while (f.callbacks.size && f.now < cancelAt + 5000) {
      f.at(f.now + 1000 / 240); const state = f.controller.state;
      assert.ok(state.position.x >= last.position.x - 1e-9, 'braking position must never move backwards');
      assert.ok(state.velocity.x >= -1e-9, 'stop cannot acquire reverse velocity');
      if (last.acceleration.x < 0) assert.ok(state.speed <= last.speed + 1e-8, 'after deceleration begins speed must stay monotonic');
      last = state;
    }
    assert.equal(f.callbacks.size, 0); assert.equal((await result).finished, false);
  }
});

test('retarget preserves acceleration state as well as momentum at every display rate', async () => {
  for (const hz of [30, 60, 120]) {
    const f = fixture(); f.state.min = -1000;
    const old = f.controller.to({ x: 900, y: 200 }, physics); advance(f, 200, hz);
    const before = f.controller.state;
    const next = f.controller.to({ x: -200, y: 500 }, physics);
    assert.deepEqual(f.controller.state.acceleration, before.acceleration);
    assert.deepEqual(f.controller.state.velocity, before.velocity);
    assert.equal((await old).finished, false);
    finish(f, { hz }); assert.equal((await next).finished, true);
  }
});

test('same-position retarget with tiny speed still preserves residual acceleration', async () => {
  const f = fixture(), old = f.controller.to({ x: 900, y: 0 }, { acceleration: 1, deceleration: 1 });
  f.at(1000 / 240); const before = f.controller.state;
  assert.ok(before.speed < .01 && before.acceleration.x > .01);
  const next = f.controller.to(before.position, { acceleration: 1, deceleration: 1 });
  assert.deepEqual(f.controller.state.acceleration, before.acceleration);
  assert.deepEqual(f.controller.state.velocity, before.velocity);
  assert.equal((await old).finished, false);
  finish(f); assert.equal((await next).finished, true);
});

test('short and long default flights share launch traces; braking is set by remaining distance', async () => {
  const rows = [];
  for (const distance of [50, 200, 2000, 5000]) {
    const f = fixture(); f.state.max = 10000;
    const result = f.controller.to({ x: distance, y: 0 });
    const launch = [];
    for (const time of [25, 50, 75]) { advance(f, time, 240); launch.push({ velocity: f.controller.state.velocity, acceleration: f.controller.state.acceleration }); }
    let previous = f.controller.state, cruiseSamples = 0, firstBraking;
    while (f.callbacks.size && f.now < 15000) {
      f.at(f.now + 1000 / 240); const state = f.controller.state;
      assert.ok(state.position.x >= previous.position.x - 1e-8, 'uninterrupted arrival cannot reverse');
      assert.ok(state.position.x <= distance + 1e-8, 'uninterrupted arrival cannot overshoot');
      assert.ok(state.speed <= 1350 + 1e-6);
      if (state.speed > 1349) cruiseSamples++;
      if (!firstBraking && state.acceleration.x < -1) firstBraking = state;
      previous = state;
    }
    assert.equal(f.callbacks.size, 0); assert.equal((await result).finished, true);
    assert.ok(firstBraking && firstBraking.position.x < distance, 'braking starts before the destination');
    const peak = Math.max(...f.states.map(s => s.speed));
    if (distance <= 200) { assert.ok(peak < 1350); assert.equal(cruiseSamples, 0); }
    else { assert.ok(peak > 1349); assert.ok(cruiseSamples > 20); }
    rows.push({ launch, peak });
  }
  for (const row of rows.slice(1)) assert.deepEqual(row.launch, rows[0].launch);
  close(rows[2].peak, rows[3].peak, .01);
});

test('bound destination updates retain flight promise, inertia and completion count', async () => {
 const f=fixture();const pending=f.controller.to({x:700,y:200},physics);
 advance(f,200);const before=f.controller.state;
 f.controller.followTarget({x:900,y:300});
 assert.deepEqual(f.controller.state.velocity,before.velocity);
 assert.deepEqual(f.controller.state.acceleration,before.acceleration);
 finish(f);const result=await pending;
 assert.equal(result.finished,true);assert.deepEqual(result.position,{x:900,y:300});assert.equal(f.events.length,1);
 const arrival=f.controller.position;
 f.controller.followTarget({x:500,y:400});assert.deepEqual(f.controller.position,arrival);
 assert.equal(f.events.length,1);assert.equal(f.callbacks.size,1);
 advance(f,f.now+100);assert.ok(f.controller.position.x < arrival.x && f.controller.position.x > 500);
 finish(f);await Promise.resolve();assert.equal(f.events.length,1);assert.deepEqual(f.controller.position,{x:500,y:400});
 const count=f.points.length;f.controller.followTarget({x:500,y:400});assert.equal(f.points.length,count);
});


test('anchor pursuit pauses without losing inertia or integrating hidden elapsed time', async () => {
 const f=fixture();const pending=f.controller.to({x:900,y:300},physics);
 advance(f,200);const before=f.controller.state;
 f.controller.suspend(true);assert.equal(f.callbacks.size,0);
 f.at(20000);f.controller.followTarget({x:700,y:300});assert.deepEqual(f.controller.state,before);
 f.controller.suspend(false);assert.equal(f.callbacks.size,1);f.at(20000);
 assert.deepEqual(f.controller.position,before.position);
 f.at(20000+1000/60);assert.ok(Math.hypot(f.controller.position.x-before.position.x,f.controller.position.y-before.position.y)<10);
 finish(f);assert.equal((await pending).finished,true);assert.equal(f.events.length,1);
});
test('continuous follow retains velocity and acceleration and does not repeat arrival events', async () => {
 const f=fixture();const initial=f.controller.to({x:100,y:100},physics);finish(f);await initial;
 for(let i=0;i<180;i++) {
  const before=f.controller.state;
  f.controller.followTarget({x:200+i*2,y:100});
  assert.deepEqual(f.controller.state.velocity,before.velocity);assert.deepEqual(f.controller.state.acceleration,before.acceleration);
  f.at(f.now+1000/60);
 }
 finish(f);await Promise.resolve();assert.equal(f.events.length,1);assert.deepEqual(f.controller.position,{x:558,y:100});
 const point=f.controller.position;f.controller.followTarget({x:point.x+0.2,y:point.y});assert.equal(f.callbacks.size,0);
});
test('detaching silent pursuit brakes rather than snapping and emits no extra completion', async () => {
 const f=fixture();const initial=f.controller.to({x:100,y:100},physics);finish(f);await initial;
 f.controller.followTarget({x:900,y:100});advance(f,f.now+300);const before=f.controller.position;
 f.controller.stopFollowing();assert.ok(f.controller.position.x>=before.x);finish(f);await Promise.resolve();assert.equal(f.events.length,1);assert.ok(f.controller.position.x<900);
});

test('plain anchored pursuit preserves derivatives and waits for the live destination', async () => {
 const f=fixture();const promise=f.controller.to({x:600,y:200},{duration:100,travel:'none',...physics});
 advance(f,80);const before=f.controller.state;
 f.controller.followTarget({x:100,y:700});
 assert.deepEqual(f.controller.state,before,'retarget does not teleport or reset derivatives');
 advance(f,120);await Promise.resolve();assert.equal(f.events.length,0,'old duration is not an arrival deadline');
 assert.ok(f.controller.state.speed>0);finish(f);assert.deepEqual((await promise).position,{x:100,y:700});
 assert.ok(f.presentations.every(p=>p.lift===0&&p.bank===0&&p.strength===0),'plain pursuit keeps presentation neutral');
});
test('a retargeted legacy plain tween becomes continuous pursuit instead of jumping', async()=>{
 const f=fixture();const promise=f.controller.to({x:600,y:200},{duration:600,travel:'none'});advance(f,200);
 const before=f.controller.state;f.controller.followTarget({x:50,y:700});assert.deepEqual(f.controller.state,before);
 f.at(f.now+1000/60);assert.ok(Math.hypot(f.controller.position.x-before.position.x,f.controller.position.y-before.position.y)<30);
 finish(f);assert.deepEqual((await promise).position,{x:50,y:700});assert.equal(f.events.length,1);
});
test('live pursuit follows repeated reversals without resolving at an abandoned point', async()=>{
 const f=fixture();const promise=f.controller.to({x:800,y:200},{duration:1000,travel:'none',...physics});
 for(let i=0;i<12;i++){advance(f,f.now+60);const before=f.controller.state;f.controller.followTarget({x:i%2?800:100,y:300+i*10});assert.deepEqual(f.controller.state,before);}
 assert.equal(f.events.length,0);f.controller.followTarget({x:500,y:500});finish(f);assert.deepEqual((await promise).position,{x:500,y:500});
});

test('target changing on the exact old deadline is refreshed before success',async()=>{
 let goal={x:600,y:200},reads=0;const f=fixture({refreshTarget(){reads++;f.controller.followTarget(goal);}});
 const promise=f.controller.to(goal,{duration:600,travel:'none'});advance(f,580);
 const before=f.controller.state;goal={x:100,y:700};f.at(600);
 assert.deepEqual(f.controller.state,before,'deadline refresh preserves derivatives and position');assert.equal(f.events.length,0);assert.equal(reads,1);
 finish(f);assert.deepEqual((await promise).position,goal);assert.equal(f.events.length,1);
});
test('settle-boundary target change keeps the same initial promise until latest arrival',async()=>{
 let goal={x:100,y:100},reads=0;const f=fixture({refreshTarget(){reads++;f.controller.followTarget(goal);}});
 const promise=f.controller.to(goal);while(f.controller.state.phase!=='settling')f.at(f.now+16);
 goal={x:800,y:700};advance(f,f.now+200);await Promise.resolve();assert.equal(f.events.length,0);assert.ok(reads>0);
 finish(f);assert.deepEqual((await promise).position,goal);assert.equal(f.events.length,1);
});
test('arrival-boundary target loss resolves cancelled and respects a newer move',async()=>{
 let lose=false;const f=fixture({refreshTarget(){if(lose)f.controller.cancel(true);}});
 const pending=f.controller.to({x:300,y:100},{duration:100,travel:'none'});advance(f,80);lose=true;f.at(100);
 assert.equal((await pending).finished,false);assert.equal(f.events.length,1);assert.equal(f.callbacks.size,0);
});
test('retargeting a plain interruption preserves its existing flight-attitude fade',async()=>{
 const f=fixture();const old=f.controller.to({x:900,y:100});advance(f,300);
 const plainMove=f.controller.to({x:200,y:200},{duration:600,travel:'none'});assert.equal((await old).finished,false);advance(f,340);
 const p=f.presentations.at(-1);assert.ok(p.lift>0);f.controller.followTarget({x:100,y:600});f.at(341);
 const next=f.presentations.at(-1);assert.ok(next.lift>0&&next.lift<=p.lift,'no one-frame neutral pop');advance(f,500);assert.equal(f.presentations.at(-1).lift,0,'original 180ms fade deadline is preserved');finish(f);assert.equal((await plainMove).finished,true);
});
