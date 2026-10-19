import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDesign } from '../src/core/design.js';
import { initialPose, MotionTimeline } from '../src/core/motion.js';
import { RenderEngine } from '../src/runtime/render-engine.js';
import type { RuntimeRenderer } from '../src/runtime/render-engine.js';
import type { RuntimeState } from '../src/runtime/protocol.js';

const near = (actual: number, expected: number): void => assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} != ${expected}`);

test('seeding a pose retains unedited transient eye weights in later partial commands', async () => {
  const timeline = new MotionTimeline();
  const pose = initialPose();
  pose.eyes = { left: { openness: .2, smile: .3 }, right: { openness: .6, smile: .7 } };
  pose.openness = .4; pose.rotation = [.1, .2, .3];
  timeline.seedPose(pose);
  pose.eyes.left.openness = 1;
  await timeline.to({ eyes: { left: { weights: { smile: 1 } }, right: { weights: { blink: .1 } } } }, { duration: 0 });
  near(timeline.pose.eyes.left.openness, .2); near(timeline.pose.eyes.left.smile, 1);
  near(timeline.pose.eyes.right.openness, .9); near(timeline.pose.eyes.right.smile, .7);
  assert.equal(timeline.pose.openness, .4); assert.deepEqual(timeline.pose.rotation, [.1, .2, .3]);
});

test('renderer startup seeds transient eye targets from initial pose rather than saved design', () => {
  const canvas = Object.assign(new EventTarget(), { width: 100, height: 100 }) as HTMLCanvasElement;
  const renderer: RuntimeRenderer = { canvas, stats: { drawCalls: 0, buffers: 0 }, resize() {}, render() {}, readPixels: () => new Uint8Array(40000), dispose() {} };
  const pose = initialPose();
  pose.eyes = { left: { openness: .2, smile: .3 }, right: { openness: .6, smile: .7 } };
  pose.openness = .4;
  const state: RuntimeState = { design: createDesign(), pose, bodyOrientation: { yaw: 0, pitch: 0, roll: 0 }, zoom: 1,
    activity: 'still', paused: false, reduced: false, active: true, time: 0, gaze: [0, 0], trackingMode: 'off', width: 100, height: 100, dpr: 1 };
  const engine = new RenderEngine(canvas, state, () => {}, { request: () => 1, cancel() {} }, renderer);
  try {
    engine.command({ kind: 'motion', target: { eyes: { left: { weights: { smile: 1 } }, right: { weights: { blink: .1 } } } }, options: { duration: 0 }, request: 1 });
    const actual = engine.snapshot.pose;
    near(actual.eyes.left.openness, .2); near(actual.eyes.left.smile, 1);
    near(actual.eyes.right.openness, .9); near(actual.eyes.right.smile, .7);
    assert.equal(actual.openness, .4);
    assert.deepEqual(state.design.eyes.left.weights, { smile: 0, blink: 0 });
  } finally { engine.dispose(); }
});
