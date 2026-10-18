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
    progress: s => { states.push(s); hooks.progress?.(s); }, presentation: p => { presentations.push(p); hooks.presentation?.(p); },
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
test('constant acceleration gives a linear velocity ramp, capped cruise and physical braking', async () => {
  const f = fixture(), result = f.controller.to({ x: 1000, y: 0 }, physics);
  for (const time of [100, 200, 300, 400]) {
    advance(f, time, 120);
    close(f.controller.state.velocity.x, physics.acceleration * time / 1000, 3, `velocity at ${time} ms`);
    close(f.controller.position.x, 0.5 * physics.acceleration * (time / 1000) ** 2, 1, `position at ${time} ms`);
    close(f.controller.state.acceleration.x, physics.acceleration, 1e-6);
    close(f.controller.state.velocity.y, 0); close(f.controller.state.acceleration.y, 0);
  }
  advance(f, 1000, 120); close(f.controller.state.speed, physics.maxSpeed, 1e-6); close(f.controller.state.acceleration.x, 0, 1e-6);
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
test('natural duration is a speed hint; an explicit maximum speed overrides that hint', async () => {
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
  advance(fast, 400); advance(slow, 400); assert.ok(fast.controller.state.speed > slow.controller.state.speed);
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
  close(stopped.x - before.position.x, before.speed ** 2 / (2 * physics.deceleration), 2, 'stopping distance');
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
  const old = f.controller.to({ x: 900, y: 0 }, physics); advance(f, 200);
  assert.equal((await old).finished, false); assert.ok(sampled); assert.equal(f.callbacks.size, 1); assert.ok(f.controller.state.speed > 0);
  finish(f); assert.deepEqual(await next, { finished: true, position: { x: 100, y: 100 } }); assert.equal(f.events.length, 2);
});
test('a progress listener can cancel repeatedly without restarting braking or settling', async () => {
  const f = fixture({ progress(state) { if (state.speed >= 100 || state.phase === 'braking' || state.phase === 'settling') f.controller.cancel(); } });
  const result = f.controller.to({ x: 900, y: 0 }, physics); advance(f, 200); assert.equal(f.controller.state.phase, 'braking');
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
