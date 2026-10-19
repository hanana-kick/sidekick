import { RenderEngine } from '../dist/src/runtime/render-engine.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createDesign, patchDesign } from '../dist/src/core/design.js';
import { createEyeState, EyeBlinkGate } from '../dist/src/core/expressions.js';
import { MotionTimeline } from '../dist/src/core/motion.js';
import { SidekickAvatar } from '../dist/src/element/avatar.js';
import { bareAvatarFixture } from './helpers/render-runtime.mjs';

const near = (a, b, epsilon = 1e-10) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);
const avatarForTest = (connected = false) => bareAvatarFixture(SidekickAvatar, RenderEngine, connected);

// Neutral dimensions and target geometries never participate in these numeric tracks.
test('shape-key weights blend independently within each eye and between both eyes', async () => {
  const timeline = new MotionTimeline();
  const both = timeline.to({ eyes: { left: { weights: { smile: 0.8, blink: 0.6 } }, right: { weights: { smile: 0.2, blink: 1 } } } }, { duration: 1000, easing: 'linear' });
  timeline.advance(250);
  assert.deepEqual(timeline.pose.eyes, { left: { openness: 0.85, smile: 0.2 }, right: { openness: 0.75, smile: 0.05 } });
  assert.deepEqual(timeline.eyeMotion, { left: true, right: true });
  timeline.advance(750);
  assert.deepEqual(await both, { finished: true });
  assert.deepEqual(timeline.pose.eyes, { left: { openness: 0.4, smile: 0.8 }, right: { openness: 0, smile: 0.2 } });
  assert.deepEqual(timeline.eyeMotion, { left: false, right: false });
});

test('partial transient weights retain the other target weight and never mutate caller inputs', async () => {
  const source = { left: createEyeState({ weights: { smile: 0.7, blink: 0.3 } }), right: createEyeState() };
  const timeline = new MotionTimeline(source), before = structuredClone(source);
  const weights = { blink: 0.8 };
  await timeline.to({ eyes: { left: { weights } } }, { duration: 0 });
  weights.blink = 0;
  near(timeline.pose.eyes.left.openness, 0.2); near(timeline.pose.eyes.left.smile, 0.7);
  assert.deepEqual(source, before);
  await timeline.to({ eyes: { left: { weights: { smile: 0.25 } } } }, { duration: 0 });
  near(timeline.pose.eyes.left.openness, 0.2); near(timeline.pose.eyes.left.smile, 0.25);
});

test('weight retargeting starts at the exact interpolated pose and preserves disjoint clocks', async () => {
  const timeline = new MotionTimeline();
  const body = timeline.to({ body: { rotation: [0, 1, 0] }, face: { uv: [0.4, 0.2] }, accessories: { hat: { rotation: [0, 0, 1] } } }, { duration: 1000, easing: 'linear' });
  const left = timeline.to({ eyes: { left: { weights: { smile: 1, blink: 0.7 } } } }, { duration: 800, easing: 'linear' });
  const right = timeline.to({ eyes: { right: { weights: { smile: 0.5, blink: 0.2 } } } }, { duration: 600, easing: 'linear' });
  timeline.advance(200); const before = structuredClone(timeline.pose);
  const replaced = timeline.to({ eyes: { left: { weights: { smile: 0.1, blink: 0.3 } } } }, { duration: 300, easing: 'linear' });
  assert.deepEqual(timeline.pose, before); assert.deepEqual(await left, { finished: false });
  timeline.advance(300); assert.deepEqual(await replaced, { finished: true });
  near(timeline.pose.rotation[1], 0.5); near(timeline.pose.face[0], 0.2); near(timeline.pose.accessories.hat[2], 0.5);
  near(timeline.pose.eyes.left.smile, 0.1); near(timeline.pose.eyes.right.smile, 0.5 * 5 / 6);
  timeline.advance(100); assert.deepEqual(await right, { finished: true });
  timeline.advance(400); assert.deepEqual(await body, { finished: true });
});

test('canonical weight requests reject target geometry, mixed schemas and invalid values atomically', async () => {
  const timeline = new MotionTimeline();
  const running = timeline.to({ eyes: { left: { weights: { smile: 1 } } } }, { duration: 1000 });
  timeline.advance(200); const before = structuredClone(timeline.pose);
  const invalid = [
    { weights: { smile: NaN } }, { weights: { blink: Infinity } }, { weights: { smile: -0.1 } }, { weights: { blink: 1.01 } },
    { weights: { smile: '0.5' } }, { weights: { smile: undefined } }, { weights: { unknown: 1 } }, { weights: null }, { weights: [] },
    { weights: { smile: 0.5 }, expression: 'smile' }, { weights: { blink: 0.2 }, openness: 0.8 },
    { targets: { smile: { radius: 0.5 } } }, { weights: { smile: 0.5 }, targets: { blink: { thickness: 0.2 } } },
  ];
  for (const right of invalid) {
    assert.throws(() => timeline.to({ eyes: { left: { weights: { blink: 1 } }, right } }));
    assert.deepEqual(timeline.pose, before); assert.equal(timeline.active, true);
  }
  for (const options of [null, [], new Date(), { duration: null }, { easing: 'instant' }, { [Symbol('unexpected')]: 1 }]) {
    assert.throws(() => timeline.to({ eyes: { left: { weights: { blink: 1 } } } }, options));
    assert.deepEqual(timeline.pose, before);
  }
  timeline.advance(800); assert.deepEqual(await running, { finished: true });
});

test('setEyeWeights persists partial per-eye weights and preserves the appearance color', async () => {
  const { avatar, events } = avatarForTest();
  avatar.design = createDesign({ eyes: { left: { weights: { smile: 0.2, blink: 0.4 } }, right: { weights: { smile: 0.8, blink: 0.6 } } } });
  const previous = avatar.design;
  assert.deepEqual(await avatar.setEyeWeights('both', { smile: 0.5 }), { finished: true });
  assert.deepEqual(avatar.design.eyes.left.weights, { smile: 0.5, blink: 0.4 });
  assert.deepEqual(avatar.design.eyes.right.weights, { smile: 0.5, blink: 0.6 });
  assert.equal(avatar.design.eyes.color, previous.eyes.color);
  assert.equal('targets' in avatar.design.eyes.left, false);
  assert.deepEqual(avatar.pose.eyes, { left: { openness: 0.6, smile: 0.5 }, right: { openness: 0.4, smile: 0.5 } });
  assert.ok(events.some(event => event.type === 'sidekick-design-change'));
  assert.ok(events.some(event => event.type === 'sidekick-motion-end'));
  assert.equal('expression' in avatar.design.eyes.left, false); assert.equal('openness' in avatar.design.eyes.left, false);
});

test('transient weights never leak into persisted partial updates or snapshots', async () => {
  const { avatar } = avatarForTest();
  avatar.design = createDesign({ eyes: { left: { weights: { smile: 0.2, blink: 0.3 } } } });
  const baseline = avatar.design;
  await avatar.motion.to({ eyes: { left: { weights: { smile: 0.8, blink: 1 } } } });
  assert.deepEqual(avatar.design, baseline);
  await avatar.setEyeWeights('left', { smile: 0.6 });
  assert.deepEqual(avatar.design.eyes.left.weights, { smile: 0.6, blink: 0.3 });
  near(avatar.pose.eyes.left.openness, 0.7);
  const snapshot = avatar.design; snapshot.eyes.left.weights.smile = 0; snapshot.eyes.color = '#ffffff';
  assert.equal(avatar.design.eyes.left.weights.smile, 0.6); assert.equal(avatar.design.eyes.color, '#24242c');
});

test('setExpression selects exact presets regardless of previous blended weights', async () => {
  const { avatar } = avatarForTest();
  avatar.design = createDesign({ eyes: { color: '#abcdef' } });
  for (const [expression, weights] of [['neutral', { smile: 0, blink: 0 }], ['smile', { smile: 1, blink: 0 }], ['blink', { smile: 0, blink: 1 }]]) {
    await avatar.setEyeWeights('left', { smile: 0.35, blink: 0.65 });
    await avatar.setExpression('left', expression);
    assert.deepEqual(avatar.design.eyes.left.weights, weights);
    assert.equal(avatar.design.eyes.color, '#abcdef');
    assert.deepEqual(avatar.pose.eyes.left, { openness: 1 - weights.blink, smile: weights.smile });
  }
});

test('color-only design changes do not cancel, reset or retime weight tracks', async () => {
  const { avatar, runtime } = avatarForTest(true);
  const pending = avatar.setEyeWeights('left', { smile: 0.8, blink: 0.6 }, { duration: 1000, easing: 'linear' });
  runtime.advanceMotion(250); const pose = avatar.pose;
  avatar.design = patchDesign(avatar.design, { eyes: { color: '#abcdef' } });
  assert.deepEqual(avatar.pose, pose); assert.equal(runtime.timeline.active, true);
  runtime.advanceMotion(750); assert.deepEqual(await pending, { finished: true });
  assert.deepEqual(avatar.pose.eyes.left, { openness: 0.4, smile: 0.8 });
  assert.equal(avatar.design.eyes.color, '#abcdef');
});

test('a one-eye weight baseline edit affects only that eye, preserving global and other clocks', async () => {
  const { avatar, runtime } = avatarForTest(true);
  const pending = avatar.motion.to({ eyes: { left: { weights: { smile: 1 } }, right: { weights: { blink: 1 } }, openness: 0.5 }, body: { rotation: [0, 1, 0] } }, { duration: 1000, easing: 'linear' });
  runtime.advanceMotion(200); const before = avatar.pose;
  avatar.design = patchDesign(avatar.design, { eyes: { right: { weights: { smile: 0.3, blink: 0.4 } } } });
  assert.deepEqual(await pending, { finished: false });
  assert.deepEqual(avatar.pose.eyes.left, before.eyes.left); near(avatar.pose.openness, before.openness);
  assert.deepEqual(avatar.pose.eyes.right, before.eyes.right);
  runtime.advanceMotion(400); assert.deepEqual(avatar.pose.eyes.right, { openness: 0.6, smile: 0.3 });
  runtime.advanceMotion(400); near(avatar.pose.eyes.left.smile, 1); near(avatar.pose.rotation[1], 1); near(avatar.pose.openness, 0.5);
});

test('weight API validation is atomic even for paused, disconnected and reduced avatars', async () => {
  for (const mode of ['disconnected', 'paused', 'reduced', 'renderer-unavailable']) {
    const { avatar, runtime } = avatarForTest(mode === 'paused' || mode === 'reduced');
    if (mode === 'paused') avatar.paused = true;
    if (mode === 'reduced') avatar.reduced = true;
    if (mode === 'renderer-unavailable') avatar.isConnected = true;
    await avatar.setEyeWeights('both', { smile: 0.6, blink: 0.4 }, { duration: 1000 });
    const before = avatar.design, pose = avatar.pose;
    for (const weights of [null, [], { smile: NaN }, { blink: 2 }, { unknown: 1 }]) assert.throws(() => avatar.setEyeWeights('left', weights));
    for (const options of [null, [], new Date(), { duration: NaN }, { duration: null }, { duration: -1 }, { easing: 'instant' }, { [Symbol('bad')]: true }]) assert.throws(() => avatar.setEyeWeights('both', { smile: 0 }, options));
    assert.throws(() => avatar.setEyeWeights('middle', { smile: 0 }));
    assert.deepEqual(avatar.design, before); assert.deepEqual(avatar.pose, pose); assert.equal(avatar.requests.size, 0);
    if (runtime) assert.equal(runtime.timeline.active, false);
    else { assert.equal(avatar.bridge, undefined); assert.equal(avatar.ready, false); assert.equal(avatar.diagnostics.running, false); }
  }
});

test('shape-key motion flags suppress only new automatic blinks, without changing weights', async () => {
  const timeline = new MotionTimeline(), gate = new EyeBlinkGate();
  const motion = timeline.to({ eyes: { left: { weights: { smile: 0.7, blink: 0.4 } } } }, { duration: 1000 });
  timeline.advance(200); const before = structuredClone(timeline.pose);
  assert.deepEqual(gate.sample(0.5, timeline.eyeMotion, 4.4), { left: 1, right: 0.5 });
  timeline.advance(800); assert.deepEqual(await motion, { finished: true });
  assert.deepEqual(gate.sample(0.5, timeline.eyeMotion, 4.5), { left: 1, right: 0.5 });
  near(before.eyes.left.smile, 0.7 * 0.104); assert.equal(timeline.pose.eyes.left.smile, 0.7);
});

test('eye weight transitions do not modify bodyOrientation angles or shape transition timing', async () => {
  const { avatar, runtime } = avatarForTest(true);
  avatar.setBodyOrientation({ yaw: 35, pitch: -12, roll: 8 }); const bodyOrientation = avatar.bodyOrientation;
  const shape = avatar.setShape('circle', { duration: 900, easing: 'linear' });
  runtime.advanceShape(200); const contour = runtime.shape.contour;
  const weights = avatar.setEyeWeights('both', { smile: 0.4, blink: 0.3 }, { duration: 300 });
  assert.equal(runtime.shape.contour, contour); assert.deepEqual(avatar.bodyOrientation, bodyOrientation);
  runtime.advanceMotion(300); await weights; runtime.advanceShape(700);
  assert.deepEqual(await shape, { finished: true }); assert.deepEqual(avatar.bodyOrientation, bodyOrientation);
});

test('updateDesign applies eye color immediately and rejects invalid patches atomically', async () => {
  const { avatar, runtime } = avatarForTest(true);
  const pending = avatar.setEyeWeights('left', { smile: 0.6, blink: 0.2 }, { duration: 500, easing: 'linear' });
  runtime.advanceMotion(100); const pose = avatar.pose;
  await avatar.updateDesign({ eyes: { color: '#abcdef' } });
  assert.equal(avatar.design.eyes.color, '#abcdef'); assert.deepEqual(avatar.pose, pose);
  const design = avatar.design;
  await assert.rejects(avatar.updateDesign({ eyes: { right: { weights: { blink: 2 } } } }));
  assert.deepEqual(avatar.design, design); assert.deepEqual(avatar.pose, pose);
  runtime.advanceMotion(400); assert.deepEqual(await pending, { finished: true });
});

test('removed geometry edits reject without changing a running shape or eye transition', async () => {
  const { avatar, runtime } = avatarForTest(true);
  const pending = avatar.setShape('circle', { duration: 1000, easing: 'linear' });
  const eye = avatar.setEyeWeights('left', { smile: 1 }, { duration: 1000 });
  runtime.advanceShape(300); runtime.advanceMotion(300);
  const visible = runtime.shape.snapshot, pose = avatar.pose, design = avatar.design;
  for (const patch of [{body:{profiles:{}}}, {eyes:{width:.2}}, {eyes:{left:{targets:{smile:{radius:.8}}}}}]) {
    await assert.rejects(avatar.updateDesign(patch));
    assert.equal(runtime.shape.snapshot, visible); assert.deepEqual(avatar.pose, pose); assert.deepEqual(avatar.design, design);
  }
  assert.equal(runtime.shape.remainingDuration, 700);
  runtime.advanceShape(700); runtime.advanceMotion(700);
  assert.deepEqual(await pending, {finished:true}); assert.deepEqual(await eye, {finished:true});
});

test('color edits preserve shape clocks and draw passes one coherent runtime snapshot', async () => {
  const { avatar, runtime } = avatarForTest(true);
  const pending = avatar.setShape('circle', { duration: 1000, easing: 'linear' });
  runtime.advanceShape(250); const snapshot = runtime.shape.snapshot;
  await avatar.updateDesign({ body: { color: '#abcdef' }, eyes: { color: '#ffffff' } });
  assert.equal(runtime.shape.snapshot, snapshot); assert.equal(runtime.shape.remainingDuration, 750);
  const rendered = runtime.render(); assert.equal(rendered.contour, snapshot.contour); assert.equal(rendered.profile, snapshot.profile);
  runtime.advanceShape(750); assert.deepEqual(await pending, { finished: true });
});

test('renderer failure settles advanced weights and restores persisted mixed baselines', async () => {
  const { avatar, runtime } = avatarForTest(true);
  avatar.design = createDesign({ eyes: { right: { weights: { smile: 0.2, blink: 0.3 } } } });
  const saved = avatar.setEyeWeights('left', { smile: 0.7, blink: 0.4 }, { duration: 1000 });
  const transient = avatar.motion.to({ eyes: { right: { weights: { smile: 1, blink: 1 } }, openness: 0 } }, { duration: 1000 });
  runtime.advanceMotion(200);
  assert.notEqual(avatar.pose.eyes.left.smile, .7); assert.notEqual(avatar.pose.openness, 1);
  avatar.runtimeFailure(new Error('Test renderer unavailable'), runtime.bridge.generation, false);
  assert.deepEqual(await saved, { finished: false }); assert.deepEqual(await transient, { finished: false });
  assert.equal(runtime.timeline.active, false); assert.equal(avatar.ready, false); assert.equal(avatar.pose.openness, 1);
  assert.deepEqual(avatar.pose.eyes, { left: { openness: 0.6, smile: 0.7 }, right: { openness: 0.7, smile: 0.2 } });
  assert.equal(avatar.fallback.hidden, false); assert.match(avatar.fallback.textContent, /Test renderer unavailable/);
  assert.equal(runtime.renderer.disposals, 1); assert.equal(runtime.callbacks.size, 0);
});

test('renderer initialization failure settles queued weights and restores persisted mixed baselines', async () => {
  const { avatar } = avatarForTest();
  avatar.design = createDesign({ eyes: { right: { weights: { smile: 0.2, blink: 0.3 } } } });
  avatar.isConnected = true; avatar.connected = true;
  avatar.canvas = Object.assign(new EventTarget(), { getContext() { throw new Error('Test renderer unavailable'); } });
  avatar.fallback = {};
  avatar.initializeRenderer(true);
  const saved = avatar.setEyeWeights('left', { smile: 0.7, blink: 0.4 }, { duration: 1000 });
  const transient = avatar.motion.to({ eyes: { right: { weights: { smile: 1, blink: 1 } }, openness: 0 } }, { duration: 1000 });
  assert.deepEqual(await saved, { finished: false }); assert.deepEqual(await transient, { finished: false });
  assert.equal(avatar.ready, false); assert.equal(avatar.pose.openness, 1);
  assert.deepEqual(avatar.pose.eyes, { left: { openness: 0.6, smile: 0.7 }, right: { openness: 0.7, smile: 0.2 } });
  assert.equal(avatar.fallback.hidden, false); assert.match(avatar.fallback.textContent, /Test renderer unavailable/);
});

test('smooth reversed expression preserves incoming velocity and stays within valid weights', () => {
  const timeline = new MotionTimeline();
  void timeline.to({ eyes: { left: { weights: { smile: 1 } } } }, { duration: 400 });
  timeline.advance(119.99); const before = timeline.pose.eyes.left.smile;
  timeline.advance(.01); const at = timeline.pose.eyes.left.smile, velocity = (at - before) / .01;
  void timeline.to({ eyes: { left: { weights: { smile: 0 } } } }, { duration: 400 });
  near(timeline.pose.eyes.left.smile, at);
  timeline.advance(.01); const afterVelocity = (timeline.pose.eyes.left.smile - at) / .01;
  assert.ok(Math.abs(afterVelocity - velocity) < .00001);
  for (let i = 0; i < 500; i++) { timeline.advance(1); assert.ok(timeline.pose.eyes.left.smile >= -1e-10 && timeline.pose.eyes.left.smile <= 1 + 1e-10); }
  near(timeline.pose.eyes.left.smile, 0);
});
