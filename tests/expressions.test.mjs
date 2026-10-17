import test from 'node:test';
import assert from 'node:assert/strict';
import { createEyeState, expressionPose, expressionDuration, automaticBlink, composeEyePose, EyeBlinkGate } from '../dist/src/core/expressions.js';
import { MotionTimeline, initialPose, activityFrame } from '../dist/src/core/motion.js';
import { createDesign, patchDesign } from '../dist/src/core/design.js';
import { SidekickAvatar } from '../dist/src/element/avatar.js';

const near = (a, b, epsilon = 1e-10) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);
const eyes = (left = {}, right = {}) => ({ left: createEyeState(left), right: createEyeState(right) });
// The component's non-rendering API also works before it is connected to a browser.
function avatarForTest(connected = false) {
  const avatar = new SidekickAvatar();
  const events = [];
  const attributes = new Map();
  avatar.hasAttribute = name => attributes.has(name);
  avatar.setAttribute = (name, value) => { const old = attributes.get(name) ?? null; attributes.set(name, String(value)); avatar.attributeChangedCallback(name, old, String(value)); };
  avatar.toggleAttribute = (name, enabled) => { const old = attributes.get(name) ?? null; if (enabled) attributes.set(name, ''); else attributes.delete(name); avatar.attributeChangedCallback(name, old, enabled ? '' : null); };
  avatar.isConnected = connected;
  avatar.dispatchEvent = event => { events.push(event); return true; };
  return { avatar, events };
}

test('expression recipes map semantic states to bounded numeric channels', () => {
  assert.deepEqual(expressionPose({ expression: 'neutral', openness: 0.65 }), { openness: 0.65, smile: 0 });
  assert.deepEqual(expressionPose({ expression: 'smile', openness: 0.65 }), { openness: 0.65, smile: 1 });
  assert.deepEqual(expressionPose({ expression: 'blink', openness: 0.65 }), { openness: 0, smile: 0 });
  for (const state of [null, [], {}, { expression: 'wink', openness: 1 }, { expression: 'neutral', openness: NaN }, { expression: 'blink', openness: 2 }, { expression: 'smile', openness: -0.1 }]) assert.throws(() => expressionPose(state));
});

test('initial eye poses and baseline states are isolated', () => {
  const a = initialPose(), b = initialPose(); a.eyes.left.openness = 0;
  assert.equal(a.eyes.right.openness, 1); assert.equal(b.eyes.left.openness, 1);
  const baseline = eyes({ expression: 'smile', openness: 0.7 }, { expression: 'neutral', openness: 0.4 });
  const timeline = new MotionTimeline(baseline); baseline.left.weights.blink = 1;
  assert.deepEqual(timeline.pose.eyes, { left: { openness: 0.7, smile: 1 }, right: { openness: 0.4, smile: 0 } });
});

test('left and right expression channels interpolate independently with legacy openness', async () => {
  const timeline = new MotionTimeline();
  const complete = timeline.to({ eyes: { left: { expression: 'smile', openness: 0.8 }, right: { expression: 'blink' }, openness: 0.6 } }, { duration: 1000, easing: 'linear' });
  timeline.advance(250);
  near(timeline.pose.eyes.left.smile, 0.25); near(timeline.pose.eyes.left.openness, 0.95);
  near(timeline.pose.eyes.right.smile, 0); near(timeline.pose.eyes.right.openness, 0.75); near(timeline.pose.openness, 0.9);
  timeline.advance(750); assert.deepEqual(await complete, { finished: true });
  assert.deepEqual(timeline.pose.eyes, { left: { openness: 0.8, smile: 1 }, right: { openness: 0, smile: 0 } });
  near(timeline.pose.openness, 0.6);
});

test('default smooth easing interpolates expression geometry continuously', async () => {
  const timeline = new MotionTimeline();
  const done = timeline.to({ eyes: { left: { expression: 'smile' } } }, { duration: 1000 });
  timeline.advance(250); near(timeline.pose.eyes.left.smile, 0.15625);
  assert.deepEqual(timeline.pose.eyes.right, { openness: 1, smile: 0 });
  timeline.advance(750); await done;
});

test('legacy motion inputs translate to weights without hidden openness state', async () => {
  const timeline = new MotionTimeline(eyes({ expression: 'neutral', openness: 0.45 }));
  await timeline.to({ eyes: { left: { expression: 'blink' } } }, { duration: 0 });
  assert.equal(timeline.pose.eyes.left.openness, 0);
  await timeline.to({ eyes: { left: { openness: 0.3 } } }, { duration: 0 });
  near(timeline.pose.eyes.left.openness, 0.3);
  await timeline.to({ eyes: { left: { expression: 'neutral' } } }, { duration: 0 });
  near(timeline.pose.eyes.left.openness, 1);
  assert.deepEqual(timeline.pose.eyes.right, { openness: 1, smile: 0 });
});

test('replacing an expression starts at the visible pose without a jump', async () => {
  const timeline = new MotionTimeline();
  const old = timeline.to({ eyes: { left: { expression: 'smile' } } }, { duration: 1000, easing: 'linear' });
  timeline.advance(400); const before = structuredClone(timeline.pose.eyes);
  const next = timeline.to({ eyes: { left: { expression: 'blink' } } }, { duration: 1000, easing: 'linear' });
  assert.deepEqual(await old, { finished: false }); assert.deepEqual(timeline.pose.eyes, before);
  timeline.advance(500); near(timeline.pose.eyes.left.smile, 0.2); near(timeline.pose.eyes.left.openness, 0.5);
  timeline.advance(500); assert.deepEqual(await next, { finished: true });
  assert.deepEqual(timeline.pose.eyes.left, { openness: 0, smile: 0 });
});

test('a right-eye request preserves the left eye clock and both completion promises', async () => {
  const timeline = new MotionTimeline();
  const left = timeline.to({ eyes: { left: { expression: 'smile' } } }, { duration: 1000, easing: 'linear' });
  timeline.advance(200); const before = structuredClone(timeline.pose.eyes);
  let leftResult; left.then(result => { leftResult = result; });
  const right = timeline.to({ eyes: { right: { expression: 'blink' } } }, { duration: 300, easing: 'linear' });
  assert.deepEqual(timeline.pose.eyes, before); await Promise.resolve(); assert.equal(leftResult, undefined);
  timeline.advance(300); assert.deepEqual(await right, { finished: true });
  near(timeline.pose.eyes.left.smile, 0.5); near(timeline.pose.eyes.right.openness, 0);
  assert.deepEqual(timeline.eyeMotion, { left: true, right: false });
  timeline.advance(499); await Promise.resolve(); assert.equal(leftResult, undefined); near(timeline.pose.eyes.left.smile, 0.999);
  timeline.advance(1); assert.deepEqual(await left, { finished: true });
  assert.equal(timeline.active, false);
});

test('invalid expression changes leave poses, recipes, and the running transition intact', async () => {
  const timeline = new MotionTimeline();
  const done = timeline.to({ eyes: { left: { expression: 'smile' } } }, { duration: 1000, easing: 'linear' });
  timeline.advance(250); const before = structuredClone(timeline.pose);
  const invalid = [
    { eyes: { left: { expression: 'blink' }, right: { expression: 'unknown' } } },
    { eyes: { left: { openness: NaN } } }, { eyes: { left: { openness: -1 } } },
    { eyes: { left: { expression: 'blink', typo: true } } }, { eyes: { left: null } },
    { eyes: { left: { expression: 'blink' } }, accessories: { hat: { rotation: [0, 100, 0] } } },
    { eyes: { left: { expression: 'blink' } }, face: { uv: [0, Infinity] } },
    { eyes: null }, null,
  ];
  for (const target of invalid) {
    assert.throws(() => timeline.to(target)); assert.equal(timeline.active, true); assert.deepEqual(timeline.pose, before);
  }
  assert.throws(() => timeline.to({ eyes: { left: { expression: 'blink' } } }, { easing: 'invalid' }));
  assert.throws(() => timeline.to({ eyes: { left: { expression: 'blink' } } }, { duration: -1 }));
  assert.throws(() => timeline.setEyes(eyes({ expression: 'blink', openness: 0.2 }, { expression: 'unknown', openness: 1 })));
  timeline.advance(750); assert.deepEqual(await done, { finished: true });
  await timeline.to({ eyes: { left: { openness: 0.8 } } }, { duration: 0 });
  assert.deepEqual(timeline.pose.eyes.left, { openness: 0.8, smile: 1 });
});

test('cancellation freezes expressions; a new baseline clears stale overrides', async () => {
  const timeline = new MotionTimeline();
  const pending = timeline.to({ eyes: { left: { expression: 'smile' }, openness: 0.4 } }, { duration: 1000 });
  timeline.advance(250); timeline.cancel(); const frozen = structuredClone(timeline.pose);
  assert.deepEqual(await pending, { finished: false }); timeline.advance(500); assert.deepEqual(timeline.pose, frozen);
  const next = timeline.to({ eyes: { left: { expression: 'blink' } } });
  timeline.setEyes(eyes({ expression: 'neutral', openness: 0.6 }, { expression: 'smile', openness: 0.9 }));
  assert.deepEqual(await next, { finished: false }); assert.equal(timeline.active, false); assert.equal(timeline.pose.openness, 1);
  assert.deepEqual(timeline.pose.eyes, { left: { openness: 0.6, smile: 0 }, right: { openness: 0.9, smile: 1 } });
  timeline.advance(1000); assert.equal(timeline.pose.eyes.left.openness, 0.6);
});

test('activity blink and reduced motion remain separate from expression state', async () => {
  const timeline = new MotionTimeline();
  await timeline.to({ eyes: { left: { expression: 'blink' }, right: { expression: 'smile' } } }, { duration: 0 });
  const before = structuredClone(timeline.pose.eyes);
  assert.equal(activityFrame('idle', 4.475, true).blink, 1);
  assert.ok(activityFrame('idle', 4.475).blink < 1);
  assert.deepEqual(timeline.pose.eyes, before);
});

test('setExpression persists independently and resolves immediately while disconnected', async () => {
  const { avatar, events } = avatarForTest();
  avatar.design = createDesign({ eyes: { left: { openness: 0.6 }, right: { openness: 0.8 } } });
  assert.deepEqual(await avatar.setExpression('left', 'blink'), { finished: true });
  assert.deepEqual(avatar.design.eyes.left.weights, { smile: 0, blink: 1 }); near(avatar.design.eyes.right.weights.blink, 0.2); assert.equal(avatar.design.eyes.right.weights.smile, 0);
  assert.equal(avatar.pose.eyes.left.openness, 0); near(avatar.pose.eyes.right.openness, 0.8);
  await avatar.setExpression('left', 'neutral'); near(avatar.pose.eyes.left.openness, 1);
  await avatar.setExpression('both', 'smile');
  assert.deepEqual(avatar.design.eyes.left.weights, { smile: 1, blink: 0 }); assert.deepEqual(avatar.design.eyes.right.weights, { smile: 1, blink: 0 });
  assert.ok(events.some(event => event.type === 'sidekick-design-change'));
  assert.ok(events.some(event => event.type === 'sidekick-motion-end'));
  const before = avatar.design;
  assert.throws(() => avatar.setExpression('middle', 'blink'));
  assert.throws(() => avatar.setExpression('left', 'unknown'));
  assert.throws(() => avatar.setExpression('left', 'blink', { duration: NaN }));
  assert.deepEqual(avatar.design, before);
});

test('unrelated design edits preserve animation, changed expressions replace stale targets', async () => {
  const { avatar } = avatarForTest(true);
  const moving = avatar.setExpression('left', 'smile', { duration: 1000, easing: 'linear' });
  avatar.timeline.advance(250); near(avatar.pose.eyes.left.smile, 0.25);
  avatar.design = patchDesign(avatar.design, { body: { color: '#abcdef' } });
  assert.equal(avatar.timeline.active, true); near(avatar.pose.eyes.left.smile, 0.25);
  avatar.timeline.advance(750); assert.deepEqual(await moving, { finished: true });
  const pending = avatar.setExpression('right', 'blink', { duration: 1000 });
  avatar.timeline.advance(200);
  avatar.design = patchDesign(avatar.design, { eyes: { right: { expression: 'neutral', openness: 0.7 } } });
  assert.deepEqual(await pending, { finished: false }); assert.equal(avatar.timeline.active, false);
  assert.deepEqual(avatar.pose.eyes.right, { openness: 0.7, smile: 0 });
  avatar.timeline.advance(1000); assert.deepEqual(avatar.pose.eyes.right, { openness: 0.7, smile: 0 });
});

test('reduced-motion preference change completes both eye targets and settles the promise', async () => {
  const { avatar } = avatarForTest(true);
  const moving = avatar.setExpression('both', 'blink', { duration: 1000 });
  avatar.timeline.advance(200); avatar.media = { matches: true }; avatar.onMotionPreference();
  assert.deepEqual(await moving, { finished: true }); assert.equal(avatar.timeline.active, false);
  assert.deepEqual(avatar.pose.eyes, { left: { openness: 0, smile: 0 }, right: { openness: 0, smile: 0 } });
  assert.deepEqual(await avatar.setExpression('both', 'smile', { duration: 1000 }), { finished: true });
  assert.deepEqual(avatar.pose.eyes, { left: { openness: 1, smile: 1 }, right: { openness: 1, smile: 1 } });
});

test('setExpression applies exact presets after a transient motion override', async () => {
  const { avatar } = avatarForTest();
  avatar.design = createDesign({ eyes: { left: { openness: 0.65 } } });
  await avatar.motion.to({ eyes: { left: { openness: 0.2, expression: 'blink' } } });
  near(avatar.design.eyes.left.weights.blink, 0.35); assert.equal(avatar.design.eyes.left.weights.smile, 0);
  await avatar.setExpression('left', 'neutral'); near(avatar.pose.eyes.left.openness, 1);
  const snapshot = avatar.pose; snapshot.eyes.left.openness = 0;
  near(avatar.pose.eyes.left.openness, 1);
});

test('paused expression updates are immediate and still reject invalid timing atomically', async () => {
  const { avatar } = avatarForTest(true);
  avatar.paused = true;
  assert.deepEqual(await avatar.setExpression('both', 'smile', { duration: 60000 }), { finished: true });
  assert.equal(avatar.timeline.active, false); assert.equal(avatar.pose.eyes.left.smile, 1);
  const before = avatar.design;
  assert.throws(() => avatar.setExpression('left', 'blink', { duration: -5 }));
  assert.throws(() => avatar.setExpression('right', 'blink', { easing: 'instant' }));
  assert.deepEqual(avatar.design, before);
});

test('one-eye design edits preserve the shared openness clock and invalid designs preserve all motion', async () => {
  const { avatar } = avatarForTest(true);
  const pending = avatar.motion.to({ eyes: { left: { expression: 'smile' }, openness: 0 } }, { duration: 1000 });
  avatar.timeline.advance(300); const before = avatar.pose;
  const bad = avatar.design; bad.eyes.right.weights.blink = NaN;
  assert.throws(() => { avatar.design = bad; });
  assert.deepEqual(avatar.pose, before); assert.equal(avatar.timeline.active, true);
  avatar.design = patchDesign(avatar.design, { eyes: { right: { expression: 'smile' } } });
  near(avatar.pose.openness, before.openness);
  assert.deepEqual(avatar.pose.eyes, { left: before.eyes.left, right: { openness: 1, smile: 1 } });
  assert.equal(avatar.timeline.active, true); avatar.timeline.advance(700);
  assert.deepEqual(await pending, { finished: true }); near(avatar.pose.openness, 0);
  assert.deepEqual(avatar.pose.eyes.left, { openness: 1, smile: 1 }); assert.equal(avatar.timeline.active, false);
  avatar.design = patchDesign(avatar.design, { eyes: { left: { expression: 'blink' }, right: { expression: 'blink' } } });
  near(avatar.pose.openness, 1); assert.deepEqual(avatar.pose.eyes, { left: { openness: 0, smile: 0 }, right: { openness: 0, smile: 0 } });
});

test('eye commands preserve body, face, global openness, and accessory clocks', async () => {
  const timeline = new MotionTimeline();
  const movement = timeline.to({ body: { rotation: [0, 1, 0] }, face: { uv: [0.4, 0] }, eyes: { openness: 0.5 }, accessories: { hat: { rotation: [0, 0, 1] } } }, { duration: 1000, easing: 'linear' });
  timeline.advance(200);
  const blink = timeline.to({ eyes: { right: { expression: 'blink' } } }, { duration: 90 });
  timeline.advance(90); assert.deepEqual(await blink, { finished: true });
  near(timeline.pose.rotation[1], 0.29); near(timeline.pose.face[0], 0.116);
  near(timeline.pose.openness, 0.855); near(timeline.pose.accessories.hat[2], 0.29);
  timeline.advance(710); assert.deepEqual(await movement, { finished: true });
  near(timeline.pose.rotation[1], 1); near(timeline.pose.face[0], 0.4);
});

test('replacing one owned channel cancels its request without stranding its sibling', async () => {
  const timeline = new MotionTimeline();
  const both = timeline.to({ eyes: { left: { expression: 'smile' }, right: { expression: 'smile' } } }, { duration: 1000, easing: 'linear' });
  timeline.advance(200);
  const wink = timeline.to({ eyes: { left: { expression: 'blink' } } }, { duration: 90 });
  assert.deepEqual(await both, { finished: false });
  timeline.advance(90); assert.deepEqual(await wink, { finished: true });
  near(timeline.pose.eyes.right.smile, 0.29); near(timeline.pose.eyes.left.openness, 0);
  timeline.advance(710); near(timeline.pose.eyes.right.smile, 1); assert.equal(timeline.active, false);
});

test('smooth continuing retargets preserve velocity and stay bounded', async () => {
  const timeline = new MotionTimeline();
  const old = timeline.to({ eyes: { left: { openness: 0.5 } } }, { duration: 1000 });
  timeline.advance(300); const before = timeline.pose.eyes.left.openness;
  const next = timeline.to({ eyes: { left: { openness: 0 } } }, { duration: 500 });
  assert.deepEqual(await old, { finished: false }); near(timeline.pose.eyes.left.openness, before);
  timeline.advance(0.01);
  const velocity = (timeline.pose.eyes.left.openness - before) / 0.01;
  near(velocity, -0.5 * 6 * 0.3 * 0.7 / 1000, 1e-7);
  let previous = timeline.pose.eyes.left.openness;
  for (let i = 0; i < 50; i++) { timeline.advance(10); const current = timeline.pose.eyes.left.openness; assert.ok(current >= 0 && current <= previous); previous = current; }
  assert.deepEqual(await next, { finished: true }); near(previous, 0);
});

test('rapid reversing retargets remain continuous, bounded and finish at the latest eye target', async () => {
  const timeline = new MotionTimeline(); const motions = [];
  for (let i = 0; i < 30; i++) {
    const before = structuredClone(timeline.pose.eyes);
    motions.push(timeline.to({ eyes: { left: { expression: i % 2 ? 'smile' : 'blink' } } }, { duration: 280 }));
    assert.deepEqual(timeline.pose.eyes, before); timeline.advance(25);
    for (const value of Object.values(timeline.pose.eyes.left)) assert.ok(value >= 0 && value <= 1);
    assert.deepEqual(timeline.pose.eyes.right, { openness: 1, smile: 0 });
  }
  timeline.advance(280); const results = await Promise.all(motions);
  assert.ok(results.slice(0, -1).every(result => !result.finished)); assert.equal(results.at(-1).finished, true);
  assert.deepEqual(timeline.pose.eyes.left, { openness: 1, smile: 1 });
});

test('editing one persisted eye leaves the other eye and body clocks untouched', async () => {
  const { avatar } = avatarForTest(true);
  const left = avatar.setExpression('left', 'smile', { duration: 1000, easing: 'linear' });
  const body = avatar.motion.to({ body: { rotation: [0, 1, 0] } }, { duration: 1200, easing: 'linear' });
  avatar.timeline.advance(300);
  avatar.design = patchDesign(avatar.design, { eyes: { right: { expression: 'blink' } } });
  near(avatar.pose.eyes.left.smile, 0.3); near(avatar.pose.rotation[1], 0.25); near(avatar.pose.eyes.right.openness, 0);
  avatar.timeline.advance(700); assert.deepEqual(await left, { finished: true }); near(avatar.pose.rotation[1], 1000 / 1200);
  avatar.timeline.advance(200); assert.deepEqual(await body, { finished: true });
});

test('expression defaults give quick closure and gentler opening, and pause settles all tracks', async () => {
  assert.equal(expressionDuration('blink'), 90); assert.equal(expressionDuration('neutral'), 180); assert.equal(expressionDuration('smile'), 280);
  const { avatar } = avatarForTest(true);
  const close = avatar.setExpression('left', 'blink'); avatar.timeline.advance(89); assert.equal(avatar.timeline.active, true);
  avatar.timeline.advance(1); assert.deepEqual(await close, { finished: true });
  const open = avatar.setExpression('left', 'neutral'); avatar.timeline.advance(179); assert.equal(avatar.timeline.active, true);
  avatar.timeline.advance(1); assert.deepEqual(await open, { finished: true });
  const smile = avatar.setExpression('both', 'smile'); avatar.timeline.advance(100);
  avatar.paused = true;
  assert.deepEqual(await smile, { finished: true }); assert.equal(avatar.timeline.active, false);
});

test('automatic blink closes once, holds briefly, and opens more slowly with smooth boundaries', () => {
  near(automaticBlink(4.35), 1); near(automaticBlink(4.425), 0); near(automaticBlink(4.44), 0); near(automaticBlink(4.46), 0); near(automaticBlink(4.6), 1);
  near(automaticBlink(4.3875), 0.5); near(automaticBlink(4.53), 0.5);
  let previous = 1;
  for (let i = 0; i <= 75; i++) { const value = automaticBlink(4.35 + i / 1000); assert.ok(value <= previous + 1e-12); previous = value; }
  previous = 0;
  for (let i = 0; i <= 140; i++) { const value = automaticBlink(4.46 + i / 1000); assert.ok(value >= previous - 1e-12); previous = value; }
  for (const boundary of [4.35, 4.425, 4.46, 4.6]) {
    assert.ok(Math.abs(automaticBlink(boundary + 1e-5) - automaticBlink(boundary - 1e-5)) < 1e-6);
    near(automaticBlink(boundary + 4.6), automaticBlink(boundary), 1e-8);
  }
});

test('manual and automatic lid closure use one bounded lid, with independent smile state', () => {
  assert.deepEqual(composeEyePose({ openness: 0.5, smile: 0.6 }, 0.8, 0.5), { openness: 0.4, smile: 0.6 });
  assert.deepEqual(composeEyePose({ openness: 0, smile: 1 }, 1, 0.5), { openness: 0, smile: 1 });
  assert.deepEqual(composeEyePose({ openness: 1, smile: 0 }, 1, 0), { openness: 0, smile: 0 });
});

test('a new idle blink is suppressed only on the explicitly moving eye for the whole cycle', () => {
  const gate = new EyeBlinkGate();
  gate.sample(1, { left: true, right: false }, 4.34);
  assert.deepEqual(gate.sample(0.8, { left: true, right: false }, 4.37), { left: 1, right: 0.8 });
  assert.deepEqual(gate.sample(0, { left: false, right: false }, 4.44), { left: 1, right: 0 });
  assert.deepEqual(gate.sample(0.5, undefined, 4.53), { left: 1, right: 0.5 });
  assert.deepEqual(gate.sample(1, undefined, 4.6), { left: 1, right: 1 });
  assert.deepEqual(gate.sample(0.5, undefined, 8.99), { left: 0.5, right: 0.5 });
});

test('starting an expression during an idle blink never pops either eye open', () => {
  const gate = new EyeBlinkGate();
  gate.sample(1, undefined, 4.34); gate.sample(0.3, undefined, 4.4);
  const before = gate.sample(0.3, undefined, 4.4);
  assert.deepEqual(gate.sample(0.3, { left: true, right: false }, 4.4), before);
  assert.deepEqual(gate.sample(0, { left: true, right: false }, 4.44), { left: 0, right: 0 });
  assert.deepEqual(gate.sample(0.5, { left: true, right: false }, 4.53), { left: 0.5, right: 0.5 });
  gate.sample(1, { left: true, right: false }, 4.6);
  assert.deepEqual(gate.sample(0.5, { left: true, right: false }, 8.99), { left: 1, right: 0.5 });
});

test('blink gate resets on rewind, skipped cycles, still or reduced motion, and explicit reset', () => {
  const gate = new EyeBlinkGate(), moving = { left: true, right: true };
  const suppress = time => assert.deepEqual(gate.sample(0.3, moving, time), { left: 1, right: 1 });
  suppress(4.4); assert.deepEqual(gate.sample(0.3, moving, 4.4), { left: 1, right: 1 });
  assert.deepEqual(gate.sample(0.4, undefined, 4.39), { left: 0.4, right: 0.4 });
  gate.reset(); suppress(4.4); assert.deepEqual(gate.sample(0.3, undefined, 9), { left: 0.3, right: 0.3 });
  gate.reset(); suppress(9.01); gate.sample(1, undefined, 9.02);
  assert.deepEqual(gate.sample(0.3, undefined, 9.03), { left: 0.3, right: 0.3 });
  gate.reset(); suppress(9.04); gate.reset();
  assert.deepEqual(gate.sample(0.3, undefined, 9.04), { left: 0.3, right: 0.3 });
});


test('accessory removal cancels only its channel and never resurrects removed pose state', async () => {
  const timeline = new MotionTimeline();
  const combined = timeline.to({ body: { rotation: [0, 1, 0] }, eyes: { left: { expression: 'smile' } }, accessories: { hat: { rotation: [0, 0, 1] }, glasses: { rotation: [0, 0.5, 0] } } }, { duration: 1000, easing: 'linear' });
  timeline.advance(200); timeline.removeAccessories(['hat']);
  assert.deepEqual(await combined, { finished: false }); assert.equal(timeline.pose.accessories.hat, undefined);
  timeline.advance(300); assert.equal(timeline.pose.accessories.hat, undefined);
  near(timeline.pose.rotation[1], 0.5); near(timeline.pose.eyes.left.smile, 0.5); near(timeline.pose.accessories.glasses[1], 0.25);
  timeline.advance(500); assert.equal(timeline.active, false); assert.equal(timeline.pose.accessories.hat, undefined);
});

async function withFrameGlobals(work) {
  const previous = { document: globalThis.document, requestAnimationFrame: globalThis.requestAnimationFrame, cancelAnimationFrame: globalThis.cancelAnimationFrame };
  globalThis.document = { hidden: false, removeEventListener() {} };
  globalThis.requestAnimationFrame = () => 1; globalThis.cancelAnimationFrame = () => {};
  try { await work(); }
  finally { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; } }
}

test('detach and context loss cancel expression promises and restore persisted eye recipes', async () => {
  await withFrameGlobals(async () => {
    for (const reason of ['disconnect', 'context']) {
      const { avatar } = avatarForTest(true);
      avatar.removeEventListener = () => {};
      avatar.design = createDesign({ eyes: { left: { openness: 0.6 }, right: { openness: 0.8 } } });
      const persisted = avatar.setExpression('left', 'smile', { duration: 1000 });
      const transient = avatar.motion.to({ eyes: { right: { expression: 'blink' }, openness: 0.5 } }, { duration: 1000 });
      avatar.timeline.advance(300); assert.ok(avatar.pose.eyes.left.smile > 0 && avatar.pose.eyes.left.smile < 1);
      avatar.fallback = { textContent: '', hidden: true };
      let disposed = false; avatar.renderer = { dispose() { disposed = true; } };
      if (reason === 'disconnect') { avatar.isConnected = false; avatar.disconnectedCallback(); }
      else { const event = new Event('webglcontextlost', { cancelable: true }); avatar.onContextLost(event); assert.equal(event.defaultPrevented, true); }
      assert.deepEqual(await persisted, { finished: false }); assert.deepEqual(await transient, { finished: false });
      assert.equal(disposed, true); assert.equal(avatar.timeline.active, false); assert.equal(avatar.ready, false);
      assert.deepEqual(avatar.pose.eyes, { left: { openness: 1, smile: 1 }, right: { openness: 0.8, smile: 0 } }); near(avatar.pose.openness, 1);
      let rendered; avatar.readyState = true; avatar.isConnected = true;
      avatar.renderer = { render(_design, state) { rendered = structuredClone(state.pose); } };
      avatar.draw(); assert.deepEqual(rendered.eyes, avatar.pose.eyes);
    }
  });
});

test('a connected unavailable renderer finishes expression requests immediately and validates first', async () => {
  const { avatar } = avatarForTest(true); avatar.canvas = {}; avatar.readyState = false;
  assert.deepEqual(await avatar.setExpression('left', 'smile', { duration: 1000 }), { finished: true });
  assert.deepEqual(await avatar.motion.to({ eyes: { right: { expression: 'blink' } } }, { duration: 1000 }), { finished: true });
  assert.equal(avatar.timeline.active, false); assert.equal(avatar.pose.eyes.left.smile, 1); assert.equal(avatar.pose.eyes.right.openness, 0);
  const before = avatar.design;
  assert.throws(() => avatar.setExpression('left', 'neutral', { duration: NaN }));
  assert.throws(() => avatar.setExpression('left', 'neutral', { easing: 'instant' }));
  assert.throws(() => avatar.setExpression('left', 'invalid'));
  assert.deepEqual(avatar.design, before);
});

test('delayed active frames honor expression durations without unbounding spring timing', async () => {
  await withFrameGlobals(async () => {
    const { avatar } = avatarForTest(true); avatar.readyState = true; avatar.currentActivity = 'still'; avatar.renderer = { render() {} };
    const done = avatar.setExpression('both', 'smile', { duration: 280 });
    avatar.tick(20); avatar.tick(520);
    assert.deepEqual(await done, { finished: true }); assert.equal(avatar.timeline.active, false);
    assert.equal(avatar.pose.eyes.left.smile, 1); assert.equal(avatar.pose.eyes.right.smile, 1); near(avatar.elapsed, 0.05);
  });
});
