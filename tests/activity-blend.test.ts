import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ActivityBlend } from '../src/core/activity-blend.js';
import { activityFrame, initialPose } from '../src/core/motion.js';
import { createDesign } from '../src/core/design.js';
import type { Activity } from '../src/core/design.js';
import type { ActivityFrame } from '../src/core/motion.js';
import { RenderEngine } from '../src/runtime/render-engine.js';
import type { FrameScheduler, RuntimeRenderer } from '../src/runtime/render-engine.js';
import type { RenderState } from '../src/renderer/webgl.js';
import type { RuntimeState } from '../src/runtime/protocol.js';

test('startup activity remains identical; a switch begins at the exact displayed frame', () => {
  const blend = new ActivityBlend('celebrating', .7);
  assert.deepEqual(blend.sample(.7), activityFrame('celebrating', .7));
  const before = blend.sample(.8);
  blend.set('thinking');
  assert.deepEqual(blend.sample(.8), before);
  blend.advance(200);
  assert.deepEqual(blend.sample(1), activityFrame('thinking', 1));
  assert.equal(blend.active, false);
});

test('interruption starts at current blend with no jump in any activity channel', () => {
  const blend = new ActivityBlend('celebrating', .7);
  blend.set('thinking'); blend.advance(80);
  const current = blend.sample(.78);
  blend.set('idle'); assert.deepEqual(blend.sample(.78), current);
  blend.advance(100);
  const midpoint = blend.sample(.88);
  assert.notDeepEqual(midpoint, current);
  assert.ok(channels(midpoint).every(Number.isFinite));
  blend.advance(100); assert.deepEqual(blend.sample(.98), activityFrame('idle', .98));
});

test('reduced motion and explicit finish settle the blend immediately', () => {
  const blend = new ActivityBlend('thinking', 1);
  blend.set('celebrating'); blend.advance(30);
  assert.deepEqual(blend.sample(1.03, true), activityFrame('celebrating', 1.03, true));
  assert.equal(blend.active, false);
  blend.set('listening'); blend.finish();
  assert.deepEqual(blend.sample(1.03), activityFrame('listening', 1.03));
});

const activities: Activity[] = ['still', 'idle', 'thinking', 'listening', 'speaking', 'celebrating'];
const channels = (value: ActivityFrame): number[] => [value.bob, value.roll, value.squash, value.blink, ...value.gaze];
const derivative = (from: ActivityFrame, to: ActivityFrame, seconds: number): number[] => channels(to).map((value, index) => (value - channels(from)[index]!) / seconds);
function closeVelocities(before: number[], after: number[], label: string): void {
  for (let index = 0; index < before.length; index++) assert.ok(Math.abs(before[index]! - after[index]!) < .003, `${label}, channel ${index}: ${before[index]} -> ${after[index]}`);
}

test('every activity switch preserves incoming velocity and joins the live target velocity', () => {
  const time = .37, step = .000001;
  for (const from of activities) for (const to of activities) {
    if (from === to) continue;
    const blend = new ActivityBlend(from, time - step);
    const before = blend.sample(time - step), start = blend.sample(time);
    blend.set(to);
    assert.deepEqual(blend.sample(time), start);
    blend.advance(step * 1000);
    closeVelocities(derivative(before, start, step), derivative(start, blend.sample(time + step), step), `${from} -> ${to} start`);
    blend.advance(200 - 2 * step * 1000);
    const nearEnd = blend.sample(time + .2 - step);
    blend.advance(step * 1000);
    const end = blend.sample(time + .2);
    closeVelocities(derivative(nearEnd, end, step), derivative(end, activityFrame(to, time + .2 + step), step), `${from} -> ${to} end`);
    assert.deepEqual(end, activityFrame(to, time + .2));
  }
});

test('rapid reversal preserves current blended velocity instead of stopping or restarting phase', () => {
  const step = .000001;
  for (const to of activities) {
    const blend = new ActivityBlend('thinking', .37);
    blend.set('celebrating'); blend.advance(80 - step * 1000);
    const before = blend.sample(.45 - step);
    blend.advance(step * 1000);
    const start = blend.sample(.45);
    blend.set(to);
    assert.deepEqual(blend.sample(.45), start);
    blend.advance(step * 1000);
    closeVelocities(derivative(before, start, step), derivative(start, blend.sample(.45 + step), step), `interrupted -> ${to}`);
  }
});

test('sustained rapid changes remain finite and blink stays bounded at real frame intervals', () => {
  const blend = new ActivityBlend('idle');
  for (let index = 0; index < 1500; index++) {
    if (index % 3 === 0) blend.set(activities[(index / 3) % activities.length]!);
    blend.advance(16);
    const value = blend.sample((index + 1) * .016);
    assert.ok(channels(value).every(Number.isFinite));
    assert.ok(value.blink >= 0 && value.blink <= 1);
    assert.ok(Math.abs(value.bob) < .5 && Math.abs(value.roll) < .5);
    assert.ok(value.squash > .5 && value.squash < 1.5);
  }
  blend.set('still'); blend.advance(200);
  assert.deepEqual(blend.sample(24.2), activityFrame('still', 24.2));
  assert.equal(blend.active, false);
});

test('zero duration is immediate and malformed timing cannot poison frames', () => {
  const blend = new ActivityBlend('thinking', 1, false, 0);
  blend.set('still');
  assert.equal(blend.active, false);
  assert.deepEqual(blend.sample(1), activityFrame('still', 1));
  assert.throws(() => new ActivityBlend('idle', 0, false, NaN), RangeError);
  assert.throws(() => blend.advance(Infinity), RangeError);
});

function fixture(patch: Partial<RuntimeState> = {}) {
  const frames: RenderState[] = [], pending = new Map<number, (now: number) => void>();
  let id = 0, now = 10;
  const canvas = Object.assign(new EventTarget(), { width: 200, height: 200 }) as HTMLCanvasElement;
  const scheduler: FrameScheduler = { request: callback => { pending.set(++id, callback); return id; }, cancel: key => { pending.delete(key); } };
  const renderer: RuntimeRenderer = { canvas, stats: { drawCalls: 0, buffers: 0 }, resize() {}, render(_design, state) { frames.push(structuredClone(state)); }, readPixels: () => new Uint8Array(200 * 200 * 4), dispose() {} };
  const initial: RuntimeState = { design: createDesign(), pose: initialPose(), bodyOrientation: { yaw: 0, pitch: 0, roll: 0 }, zoom: 1, activity: 'thinking', paused: false, reduced: false, active: true, time: 1, gaze: [0, 0], trackingMode: 'off', width: 200, height: 200, dpr: 1, ...patch };
  const engine = new RenderEngine(canvas, initial, () => {}, scheduler, renderer);
  return { engine, frames, pending, step(ms = 16) { now += ms; const work = [...pending.values()]; pending.clear(); for (const callback of work) callback(now); } };
}

test('engine keeps rendering transition to still then stops at its exact static endpoint', () => {
  const f = fixture();
  const original = f.frames.at(-1)!.activityFrame;
  f.engine.command({ kind: 'state', state: { activity: 'still' } });
  f.step(); assert.deepEqual(f.frames.at(-1)!.activityFrame, original);
  f.step(100); assert.equal(f.pending.size, 1);
  assert.notDeepEqual(f.frames.at(-1)!.activityFrame, activityFrame('still', 1));
  f.step(100); assert.deepEqual(f.frames.at(-1)!.activityFrame, activityFrame('still', 1));
  assert.equal(f.pending.size, 0); f.engine.dispose();
});

test('engine pause/reduced motion snaps a pending blend and leaves no scheduled work', () => {
  for (const flag of ['paused', 'reduced'] as const) {
    const f = fixture();
    f.engine.command({ kind: 'state', state: { activity: 'celebrating' } });
    f.step(); f.step(30);
    f.engine.command({ kind: 'state', state: { [flag]: true } }); f.step();
    const state = f.frames.at(-1)!;
    assert.deepEqual(state.activityFrame, activityFrame('celebrating', state.time, flag === 'reduced'));
    assert.equal(f.pending.size, 0); f.engine.dispose();
  }
});
