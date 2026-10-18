import test from 'node:test';
import assert from 'node:assert/strict';
import { AvatarMovement, validateMoveOptions } from '../dist/src/element/movement.js';
function fixture(hooks = {}) {
  let now = 0, frame = 0;
  const callbacks = new Map(), events = [], points = [], states = [], presentations = [];
  const state = { immediate: false, max: 1000 };
  const controller = new AvatarMovement({
    now: () => now, immediate: () => state.immediate,
    constrain: p => ({ x: Math.max(0, Math.min(state.max, p.x)), y: Math.max(0, Math.min(state.max, p.y)) }),
    render: p => { points.push(p); hooks.render?.(p); }, complete: r => { events.push(r); return hooks.complete?.(r); },
    progress: s => { states.push(s); hooks.progress?.(s); }, presentation: p => { presentations.push(p); hooks.presentation?.(p); },
    requestFrame: callback => { callbacks.set(++frame, callback); return frame; }, cancelFrame: id => callbacks.delete(id),
  });
  return { controller, state, events, points, callbacks, states, presentations, at(time) { now = time; for (const [id, callback] of [...callbacks]) { callbacks.delete(id); callback(now); } }, clock(time) { now = time; } };
}
const plain = { duration: 100, easing: 'linear', travel: 'none' };
const neutral = { direction: [0, 0], strength: 0, lift: 0, bank: 0 };
const close = (actual, expected, message = '') => assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: ${actual} ≠ ${expected}`);

test('plain travel interpolates CSS pixel positions and resolves once at its real endpoint', async () => {
  const f = fixture(), result = f.controller.to({ x: 100, y: 200 }, plain);
  f.at(25); assert.deepEqual(f.controller.position, { x: 25, y: 50 }); assert.equal(f.events.length, 0);
  assert.deepEqual(f.controller.state.velocity, { x: 1000, y: 2000 }); assert.deepEqual(f.presentations.at(-1), neutral);
  f.at(100); assert.deepEqual(await result, { finished: true, position: { x: 100, y: 200 } }); assert.equal(f.events.length, 1); assert.equal(f.callbacks.size, 0);
});
test('plain retarget samples the displayed trajectory and cancels prior promise once', async () => {
  const f = fixture(), old = f.controller.to({ x: 100, y: 0 }, plain);
  f.clock(50); const next = f.controller.to({ x: 200, y: 0 }, plain);
  assert.deepEqual(await old, { finished: false, position: { x: 50, y: 0 } });
  f.at(100); assert.equal(f.controller.position.x, 125); f.at(150); assert.equal((await next).finished, true); assert.equal(f.events.length, 2);
});
test('plain cancel leaves the current position and no scheduled callback', async () => {
  const f = fixture(), result = f.controller.to({ x: 100, y: 0 }, plain);
  f.clock(40); f.controller.cancel(); f.controller.cancel();
  assert.equal((await result).finished, false); assert.equal(f.controller.position.x, 40); assert.equal(f.callbacks.size, 0); assert.equal(f.events.length, 1);
});
test('relative movement uses in-flight current position', async () => {
  const f = fixture(), old = f.controller.to({ x: 100, y: 0 }, plain);
  f.clock(40); const next = f.controller.by({ x: 20, y: 10 }, { duration: 0 });
  assert.equal((await old).finished, false); assert.deepEqual((await next).position, { x: 60, y: 10 });
});
test('resize clamps current position and target while retaining remaining time', async () => {
  const f = fixture(), result = f.controller.to({ x: 100, y: 200 }, plain);
  f.at(50); f.state.max = 30; f.controller.resize(); assert.deepEqual(f.controller.position, { x: 30, y: 30 });
  f.at(100); assert.deepEqual(await result, { finished: true, position: { x: 30, y: 30 } });
});
test('reduced motion and lifecycle policy can snap active motion', async () => {
  const f = fixture(), old = f.controller.to({ x: 100, y: 0 }); f.at(200); f.controller.finish();
  assert.equal((await old).finished, true); assert.deepEqual(f.presentations.at(-1), neutral); f.state.immediate = true;
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

test('natural is the default and the requested duration includes takeoff, travel and landing', async () => {
  const f = fixture(), result = f.controller.to({ x: 700, y: 350 }, { duration: 1000, easing: 'linear' });
  assert.deepEqual(f.controller.state, { phase: 'takeoff', progress: 0, position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 } });
  f.at(75); assert.deepEqual(f.controller.position, { x: 0, y: 0 }); assert.equal(f.controller.state.phase, 'takeoff');
  close(f.presentations.at(-1).strength, 0.5); close(f.presentations.at(-1).lift, 0.03);
  f.at(150); assert.equal(f.controller.state.phase, 'flight'); assert.equal(f.controller.position.x, 0);
  f.at(500); close(f.controller.position.x, 350); close(f.controller.position.y, 175); close(f.controller.state.velocity.x, 1000); close(f.controller.state.velocity.y, 500);
  f.at(850); assert.equal(f.controller.state.phase, 'landing'); assert.deepEqual(f.controller.position, { x: 700, y: 350 }); assert.deepEqual(f.controller.state.velocity, { x: 0, y: 0 });
  assert.equal(f.events.length, 0); f.at(925); close(f.presentations.at(-1).strength, 0.5); close(f.presentations.at(-1).lift, 0.03);
  f.at(1000); assert.deepEqual(await result, { finished: true, position: { x: 700, y: 350 } });
  assert.equal(f.controller.state.phase, 'idle'); assert.equal(f.controller.state.progress, 1); assert.deepEqual(f.presentations.at(-1), neutral); assert.equal(f.callbacks.size, 0);
});
test('smooth easing applies within the travel interval and reports its CSS velocity', async () => {
  const f = fixture(), result = f.controller.to({ x: 700, y: 0 }, { duration: 1000 });
  f.at(325); close(f.controller.position.x, 700 * 0.15625); close(f.controller.state.velocity.x, 1125);
  f.at(500); close(f.controller.position.x, 350); close(f.controller.state.velocity.x, 1500);
  f.at(850); assert.deepEqual(f.controller.state.velocity, { x: 0, y: 0 }); f.at(1000); await result;
});
test('all cardinal and diagonal headings follow the constrained screen-space path', async () => {
  for (const [dx, dy] of [[100, 0], [-100, 0], [0, 100], [0, -100], [100, 100], [-100, -100]]) {
    const f = fixture(); await f.controller.to({ x: 500, y: 500 }, { duration: 0 });
    const result = f.controller.by({ x: dx, y: dy }, { duration: 1000 }); f.at(500);
    const p = f.presentations.at(-1), length = Math.hypot(dx, dy);
    close(p.direction[0], dx / length); close(p.direction[1], dy / length); close(p.bank, -dx / length * 0.12);
    close(p.strength, 1); close(p.lift, 0.06); close(Math.hypot(...p.direction), 1);
    f.at(1000); await result;
  }
  const f = fixture(); f.state.max = 100;
  const result = f.controller.to({ x: 500, y: 50 }, { duration: 1000 }); f.at(500);
  close(f.presentations.at(-1).direction[0], 100 / Math.hypot(100, 50)); close(f.presentations.at(-1).direction[1], 50 / Math.hypot(100, 50));
  assert.ok(f.points.every(p => p.x >= 0 && p.x <= 100 && p.y >= 0 && p.y <= 100)); f.at(1000); await result;
});
test('natural retarget preserves the current position and presentation while smoothly reversing direction', async () => {
  const f = fixture(), old = f.controller.to({ x: 700, y: 0 }, { duration: 1000 }); f.at(500);
  const before = structuredClone(f.presentations.at(-1));
  const next = f.controller.to({ x: 0, y: 0 }, { duration: 1000 });
  assert.deepEqual(await old, { finished: false, position: { x: 350, y: 0 } }); assert.deepEqual(f.presentations.at(-1), before); assert.equal(f.callbacks.size, 1);
  f.at(500); assert.deepEqual(f.presentations.at(-1), before); assert.deepEqual(f.controller.position, { x: 350, y: 0 });
  f.at(575); const turning = f.presentations.at(-1); close(Math.hypot(...turning.direction), 1); close(turning.direction[0], 0); assert.ok(Math.abs(turning.direction[1]) > 0.99);
  f.at(650); assert.deepEqual(f.presentations.at(-1).direction, [-1, 0]); close(f.presentations.at(-1).bank, 0.12);
  f.at(1500); assert.equal((await next).finished, true); assert.equal(f.events.length, 2); assert.deepEqual(f.presentations.at(-1), neutral);
});
test('natural cancel freezes position and settles before resolving exactly once', async () => {
  const f = fixture(); let resolved = false;
  const result = f.controller.to({ x: 700, y: 0 }, { duration: 1000 }).then(value => { resolved = true; return value; });
  f.at(500); f.controller.cancel(); assert.equal(f.controller.state.phase, 'settling'); assert.deepEqual(f.controller.state.velocity, { x: 0, y: 0 });
  assert.equal(f.controller.state.progress, 0.5); await Promise.resolve(); assert.equal(resolved, false); assert.equal(f.events.length, 0);
  f.at(590); close(f.presentations.at(-1).strength, 0.5); close(f.presentations.at(-1).lift, 0.03); f.controller.cancel();
  assert.deepEqual(f.controller.position, { x: 350, y: 0 }); assert.equal(f.callbacks.size, 1);
  f.at(680); assert.deepEqual(await result, { finished: false, position: { x: 350, y: 0 } });
  assert.equal(f.controller.state.phase, 'idle'); assert.equal(f.controller.state.progress, 0.5); assert.deepEqual(f.presentations.at(-1), neutral); assert.equal(f.callbacks.size, 0); assert.equal(f.events.length, 1);
});
test('retarget during cancellation transfers the settling pose and cancels the old request immediately', async () => {
  const f = fixture(), old = f.controller.to({ x: 700, y: 0 }, { duration: 1000 }); f.at(500); f.controller.cancel(); f.at(590);
  const before = structuredClone(f.presentations.at(-1)), next = f.controller.to({ x: 350, y: 300 }, { duration: 1000 });
  assert.equal((await old).finished, false); assert.deepEqual(f.presentations.at(-1), before); assert.equal(f.callbacks.size, 1);
  f.at(590); assert.deepEqual(f.presentations.at(-1), before); f.at(1590); assert.equal((await next).finished, true); assert.equal(f.events.length, 2);
});
test('disconnect and immediate cancel reset presentation and stop scheduling without landing', async () => {
  for (const method of ['disconnect', 'cancel']) {
    const f = fixture(), result = f.controller.to({ x: 700, y: 0 }, { duration: 1000 }); f.at(500); f.state.immediate = true;
    if (method === 'cancel') f.controller.cancel(true); else f.controller.disconnect();
    assert.deepEqual(await result, { finished: false, position: { x: 350, y: 0 } }); assert.equal(f.callbacks.size, 0); assert.equal(f.controller.state.phase, 'idle'); assert.deepEqual(f.presentations.at(-1), neutral);
  }
});
test('finish snaps travel but does not turn a pending cancellation into success', async () => {
  const f = fixture(), result = f.controller.to({ x: 700, y: 0 }, { duration: 1000 }); f.at(500); f.controller.cancel(); f.controller.finish();
  assert.deepEqual(await result, { finished: false, position: { x: 350, y: 0 } }); assert.equal(f.callbacks.size, 0); assert.deepEqual(f.presentations.at(-1), neutral);
});
test('a reduced-motion change during natural flight completes at the target on the next frame', async () => {
  const f = fixture(), result = f.controller.to({ x: 700, y: 0 }, { duration: 1000 }); f.at(500); f.state.immediate = true; f.at(510);
  assert.deepEqual(await result, { finished: true, position: { x: 700, y: 0 } }); assert.equal(f.callbacks.size, 0); assert.deepEqual(f.presentations.at(-1), neutral);
});
test('natural resize preserves elapsed phase and original completion deadline', async () => {
  const f = fixture(), result = f.controller.to({ x: 700, y: 350 }, { duration: 1000 }); f.at(500);
  f.state.max = 500; f.controller.resize(); assert.equal(f.controller.state.phase, 'flight'); assert.equal(f.controller.state.progress, 0.5);
  assert.deepEqual(f.controller.position, { x: 350, y: 175 });
  f.at(750); assert.ok(f.controller.position.x > 350 && f.controller.position.x <= 500);
  f.at(850); assert.deepEqual(f.controller.position, { x: 500, y: 350 }); assert.equal(f.controller.state.phase, 'landing');
  f.at(1000); assert.deepEqual(await result, { finished: true, position: { x: 500, y: 350 } });
});
test('plain travel after natural flight decays presentation without delaying plain interpolation', async () => {
  const f = fixture(), old = f.controller.to({ x: 700, y: 0 }, { duration: 1000 }); f.at(500);
  const next = f.controller.to({ x: 500, y: 0 }, { duration: 400, easing: 'linear', travel: 'none' }); assert.equal((await old).finished, false);
  f.at(590); close(f.controller.position.x, 383.75); close(f.presentations.at(-1).strength, 0.5); close(f.presentations.at(-1).lift, 0.03);
  f.at(680); assert.equal(f.presentations.at(-1).strength, 0); f.at(900); assert.equal((await next).finished, true);
});
test('movement validation rejects unknown and unusual properties before touching active movement', async () => {
  const f = fixture(), result = f.controller.to({ x: 700, y: 0 }, { duration: 1000 }); f.at(500);
  const invalid = [null, [], 10, { travel: 'hover' }, { easing: 'ease' }, { duration: Infinity }, { duration: -1 }, { duration: 60001 }, { extra: true }, { [Symbol('extra')]: 1 }, Object.create({ duration: 100 }), Object.defineProperty({}, 'travel', { value: 'natural' }), { get travel() { throw new Error('must not invoke getters'); } }];
  for (const options of invalid) {
    assert.throws(() => f.controller.to({ x: 20, y: 30 }, options));
    assert.throws(() => f.controller.by({ x: 20, y: 30 }, options));
    assert.equal(f.controller.state.phase, 'flight'); assert.deepEqual(f.controller.position, { x: 350, y: 0 }); assert.equal(f.callbacks.size, 1);
  }
  assert.deepEqual(validateMoveOptions(), { duration: 400, easing: 'smooth', travel: 'natural' });
  assert.deepEqual(validateMoveOptions(Object.assign(Object.create(null), { travel: 'none' })), { duration: 400, easing: 'smooth', travel: 'none' });
  f.at(1000); assert.equal((await result).finished, true);
});
test('state and callback snapshots cannot mutate the controller or later presentation', async () => {
  const f = fixture(), result = f.controller.to({ x: 700, y: 350 }, { duration: 1000 }); f.at(500);
  const state = f.controller.state; state.position.x = -100; state.velocity.y = -100; state.phase = 'idle';
  f.states.at(-1).position.y = -100; f.presentations.at(-1).direction[0] = 999; f.presentations.at(-1).strength = 99;
  assert.deepEqual(f.controller.position, { x: 350, y: 175 }); assert.equal(f.controller.state.phase, 'flight');
  f.controller.cancel(); f.at(590); close(f.presentations.at(-1).strength, 0.5); close(f.presentations.at(-1).direction[0], 700 / Math.hypot(700, 350));
  f.at(680); await result;
});
test('every reported state uses actual constrained CSS coordinates and a bounded presentation', async () => {
  const f = fixture(); f.state.max = 100;
  const result = f.controller.to({ x: 900, y: 900 }, { duration: 1000 });
  for (let time = 0; time <= 1000; time += 10) {
    f.at(time); assert.deepEqual(f.states.at(-1).position, f.controller.position);
    const p = f.presentations.at(-1); assert.ok(p.strength >= 0 && p.strength <= 1); assert.ok(p.lift >= 0 && p.lift <= 0.06); assert.ok(Math.abs(p.bank) <= 0.12);
    if (p.strength > 0) close(Math.hypot(...p.direction), 1);
  }
  await result; assert.equal(f.events.length, 1);
});
test('rapid retargets keep one animation frame and settle each replaced promise exactly once', async () => {
  const f = fixture(), promises = [];
  for (let i = 0; i < 20; i++) {
    f.at(i * 20); promises.push(f.controller.to({ x: i % 2 ? 200 : 800, y: 300 }, { duration: 400 })); assert.equal(f.callbacks.size, 1);
  }
  f.at(780); const results = await Promise.all(promises);
  assert.equal(results.filter(r => r.finished).length, 1); assert.equal(f.events.length, 20); assert.equal(f.callbacks.size, 0); assert.deepEqual(f.presentations.at(-1), neutral);
});

test('a progress listener can retarget without recursive sampling or extra animation frames', async () => {
  let next;
  const f = fixture({ progress(state) { if (state.phase === 'flight' && state.progress === 0.5 && !next) next = f.controller.to({ x: 100, y: 100 }, { duration: 1000 }); } });
  const old = f.controller.to({ x: 700, y: 0 }, { duration: 1000 }); f.at(500);
  assert.equal((await old).finished, false); assert.equal(f.callbacks.size, 1); assert.equal(f.controller.state.phase, 'takeoff');
  f.at(1500); assert.deepEqual(await next, { finished: true, position: { x: 100, y: 100 } }); assert.equal(f.callbacks.size, 0); assert.equal(f.events.length, 2);
});
test('a progress listener can cancel once and let presentation settle normally', async () => {
  const f = fixture({ progress(state) { if (state.phase === 'flight' && state.progress >= 0.5) f.controller.cancel(); } });
  const result = f.controller.to({ x: 700, y: 0 }, { duration: 1000 }); f.at(500);
  assert.equal(f.controller.state.phase, 'settling'); assert.equal(f.callbacks.size, 1);
  f.at(680); assert.deepEqual(await result, { finished: false, position: { x: 350, y: 0 } }); assert.equal(f.events.length, 1);
});
test('a newer request from sampled progress wins over the outer retarget or relative move', async () => {
  for (const method of ['to', 'by']) {
    let next;
    const f = fixture({ progress(state) { if (state.phase === 'flight' && state.progress === 0.5 && !next) next = f.controller.to({ x: 300, y: 100 }, { duration: 1000 }); } });
    const old = f.controller.to({ x: 700, y: 0 }, { duration: 1000 }); f.clock(500);
    const superseded = f.controller[method]({ x: 200, y: 50 }, { duration: 1000 });
    assert.equal((await old).finished, false); assert.equal((await superseded).finished, false); assert.equal(f.callbacks.size, 1);
    f.at(1500); assert.deepEqual(await next, { finished: true, position: { x: 300, y: 100 } }); assert.equal(f.events.length, 3);
  }
});
test('completion progress and presentation listeners can start a new move that remains active', async () => {
  for (const callback of ['progress', 'presentation']) {
    let next, started = false;
    const f = fixture({ [callback](value) {
      const ended = callback === 'progress' ? value.phase === 'idle' && value.progress === 1 : value.strength === 0;
      if (started && ended && !next) next = f.controller.to({ x: 300, y: 100 }, { duration: 1000 });
    } });
    const old = f.controller.to({ x: 700, y: 0 }, { duration: 1000 }); started = true; f.at(1000);
    assert.equal((await old).finished, true); assert.equal(f.controller.state.phase, 'takeoff'); assert.equal(f.callbacks.size, 1);
    f.at(2000); assert.deepEqual(await next, { finished: true, position: { x: 300, y: 100 } }); assert.equal(f.events.length, 2);
  }
});
test('presentation listeners may retarget without old samples overwriting the new request', async () => {
  let next;
  const f = fixture({ presentation(value) { if (value.strength === 1 && !next) next = f.controller.to({ x: 350, y: 400 }, { duration: 1000 }); } });
  const old = f.controller.to({ x: 700, y: 0 }, { duration: 1000 }); f.at(500);
  assert.equal((await old).finished, false); assert.equal(f.controller.state.phase, 'takeoff'); assert.equal(f.callbacks.size, 1);
  f.at(1500); assert.deepEqual(await next, { finished: true, position: { x: 350, y: 400 } }); assert.equal(f.events.length, 2);
});
test('a progress listener may resize without recursive progress dispatch', async () => {
  const f = fixture({ progress(state) { if (state.phase === 'flight') f.controller.resize(); } });
  const result = f.controller.to({ x: 700, y: 0 }, { duration: 1000 }); f.at(500);
  assert.equal(f.controller.state.phase, 'flight'); assert.equal(f.callbacks.size, 1);
  f.at(1000); assert.equal((await result).finished, true);
});
test('movement completion waits for a host render acknowledgement, including immediate moves', async () => {
  for (const duration of [0, 1000]) {
    let acknowledge, resolved = false;
    const flushed = new Promise(resolve => { acknowledge = resolve; });
    const f = fixture({ complete: () => flushed });
    const result = f.controller.to({ x: 700, y: 0 }, { duration }).then(value => { resolved = true; return value; });
    if (duration) f.at(1000);
    await Promise.resolve(); assert.equal(resolved, false); assert.equal(f.events.length, 1); assert.equal(f.callbacks.size, 0);
    acknowledge(); assert.deepEqual(await result, { finished: true, position: { x: 700, y: 0 } }); assert.equal(resolved, true);
  }
});
test('host completion failures do not strand move promises or animation frames', async () => {
  for (const complete of [() => { throw new Error('host unavailable'); }, () => Promise.reject(new Error('render unavailable'))]) {
    const f = fixture({ complete }); const result = f.controller.to({ x: 100, y: 0 }, { duration: 100 }); f.at(100);
    assert.equal((await result).finished, true); assert.equal(f.callbacks.size, 0);
  }
});

test('short nudges use a gentler presentation proportional to their constrained distance', async () => {
  for (const distance of [1, 10, 40, 100, 500]) {
    const f = fixture(), result = f.controller.to({ x: distance, y: 0 }, { duration: 1000 }); f.at(500);
    const intensity = Math.min(1, distance / 100), p = f.presentations.at(-1);
    close(p.strength, intensity); close(p.lift, 0.06 * intensity); close(p.bank, -0.12 * intensity);
    f.at(1000); assert.equal((await result).finished, true);
  }
});
test('retargeting full flight to a short nudge preserves the pose before easing to a milder envelope', async () => {
  const f = fixture(), old = f.controller.to({ x: 700, y: 0 }, { duration: 1000 }); f.at(500);
  const previous = structuredClone(f.presentations.at(-1)), next = f.controller.by({ x: 10, y: 0 }, { duration: 1000 });
  assert.equal((await old).finished, false); assert.deepEqual(f.presentations.at(-1), previous);
  f.at(500); assert.deepEqual(f.presentations.at(-1), previous); f.at(650); close(f.presentations.at(-1).strength, 0.1); close(f.presentations.at(-1).lift, 0.006);
  f.at(1500); assert.equal((await next).finished, true);
});
