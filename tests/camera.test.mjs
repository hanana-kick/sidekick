import test from 'node:test';
import assert from 'node:assert/strict';
import { CAMERA_PRESETS, cameraPreset, cameraViewMatrix, createAccessory, createCamera, createDesign, patchCamera, SidekickAvatar, patchDesign } from '../dist/src/index.js';
import { multiply, transform } from '../dist/src/core/math.js';
import { RenderEngine } from '../dist/src/runtime/render-engine.js';
import { bareAvatarFixture } from './helpers/render-runtime.mjs';

const avatarForTest = (connected = false) => bareAvatarFixture(SidekickAvatar, RenderEngine, connected);
const close = (actual, expected, tolerance = 1e-6) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);

test('camera exposes independent degree settings, immutable presets, and partial updates', () => {
  const initial = createCamera(); assert.deepEqual(initial, { yaw: 0, pitch: 0, roll: 0 });
  const next = patchCamera(initial, { yaw: 45, pitch: -20 });
  assert.deepEqual(next, { yaw: 45, pitch: -20, roll: 0 }); assert.deepEqual(initial, createCamera());
  next.yaw = 70; assert.deepEqual(cameraPreset('three-quarter'), { yaw: 45, pitch: 0, roll: 0 });
  assert.deepEqual(cameraPreset('side'), { yaw: 90, pitch: 0, roll: 0 });
  assert.ok(Object.isFrozen(CAMERA_PRESETS)); assert.ok(Object.isFrozen(CAMERA_PRESETS.front));
  const preset = cameraPreset('front'); preset.pitch = 20; assert.equal(cameraPreset('front').pitch, 0);
  assert.deepEqual(createCamera({ yaw: -360, pitch: 90, roll: -180 }), { yaw: -360, pitch: 90, roll: -180 });
  assert.deepEqual(createCamera({ yaw: 360, pitch: -90, roll: 180 }), { yaw: 360, pitch: -90, roll: 180 });
});

test('camera rejects invalid objects, axes, values and presets atomically', () => {
  const baseline = createCamera({ yaw: 25, pitch: 15, roll: 5 });
  for (const patch of [null, [], new Date(), 1, 'front', { yaw: undefined }, { yaw: null }, { yaw: '25' }, { yaw: NaN }, { yaw: Infinity }, { yaw: 361 }, { yaw: -361 }, { pitch: 91 }, { pitch: -91 }, { roll: 181 }, { roll: -181 }, { zoom: 2 }, { yaw: 0, pitch: Infinity }, { [Symbol()]: 1 }]) {
    assert.throws(() => patchCamera(baseline, patch));
    assert.deepEqual(baseline, { yaw: 25, pitch: 15, roll: 5 });
  }
  for (const preset of ['', 'back', 'constructor', '__proto__', undefined, null, {}]) assert.throws(() => cameraPreset(preset));
});

test('view rotation composes independently with body pose, including mixed angles and translation', () => {
  const camera = { yaw: 40, pitch: -25, roll: 15 }, radians = Math.PI / 180;
  const view = cameraViewMatrix(camera), bodyRotation = [0.12, -0.3, 0.55];
  const model = transform([0, 0.2, 0], bodyRotation), composed = multiply(view, model);
  const incorrect = transform([0, 0.2, 0], [bodyRotation[0] + camera.pitch * radians, bodyRotation[1] + camera.yaw * radians, bodyRotation[2] + camera.roll * radians]);
  assert.deepEqual(view, transform([0, 0, 0], [-25 * radians, 40 * radians, 15 * radians]));
  assert.ok(composed.some((value, index) => Math.abs(value - incorrect[index]) > 0.1), 'View and body rotations must not be summed');
  close(composed[12], view[4] * 0.2); close(composed[13], view[5] * 0.2); close(composed[14], view[6] * 0.2);
  const yaw = cameraViewMatrix(createCamera({ yaw: 90 })); close(yaw[8], 1);
  const pitch = cameraViewMatrix(createCamera({ pitch: 90 })); close(pitch[6], 1);
  const roll = cameraViewMatrix(createCamera({ roll: 90 })); close(roll[1], 1);
});

test('avatar camera snapshots, setters, events, presets and reset leave design and pose untouched', () => {
  const { avatar, events } = avatarForTest();
  const design = avatar.design, pose = avatar.pose;
  avatar.setCamera({ yaw: 35 }); avatar.setCamera({ pitch: -18, roll: 12 });
  assert.deepEqual(avatar.camera, { yaw: 35, pitch: -18, roll: 12 });
  const snapshot = avatar.camera; snapshot.yaw = 300; assert.equal(avatar.camera.yaw, 35);
  const last = events.at(-1); assert.equal(last.type, 'sidekick-camera-change');
  assert.deepEqual(last.detail.camera, avatar.camera); last.detail.camera.pitch = 80; assert.equal(avatar.camera.pitch, -18);
  const count = events.length; avatar.setCamera({}); avatar.setCamera(avatar.camera); assert.equal(events.length, count);
  assert.throws(() => avatar.setCamera({ yaw: 80, pitch: 120 })); assert.deepEqual(avatar.camera, { yaw: 35, pitch: -18, roll: 12 }); assert.equal(events.length, count);
  avatar.camera = { yaw: -30, pitch: 10, roll: -5 }; assert.deepEqual(avatar.camera, { yaw: -30, pitch: 10, roll: -5 });
  avatar.setCameraPreset('three-quarter'); assert.deepEqual(avatar.camera, cameraPreset('three-quarter'));
  avatar.setCameraPreset('side'); assert.deepEqual(avatar.camera, cameraPreset('side'));
  avatar.resetCamera(); assert.deepEqual(avatar.camera, createCamera());
  assert.deepEqual(avatar.design, design); assert.deepEqual(avatar.pose, pose);
  assert.ok(events.every(event => event.type === 'sidekick-camera-change'));
});

test('legacy radians setView forwards into the same camera and validates both axes before changing it', () => {
  const { avatar } = avatarForTest(); avatar.setCamera({ roll: 20 });
  avatar.setView(Math.PI / 3, -Math.PI / 6); close(avatar.camera.yaw, 60); close(avatar.camera.pitch, -30); assert.equal(avatar.camera.roll, 20);
  const before = avatar.camera;
  for (const [yaw, pitch] of [[NaN, 0], [0, Infinity], [7, 0], [0, 2], [0, null]]) assert.throws(() => avatar.setView(yaw, pitch));
  assert.deepEqual(avatar.camera, before);
  avatar.setView(2 * Math.PI, Math.PI / 2); close(avatar.camera.yaw, 360); close(avatar.camera.pitch, 90);
  avatar.setView(0); assert.deepEqual(avatar.camera, { yaw: 0, pitch: 0, roll: 20 });
});

test('camera changes preserve in-flight body and shape animation and render separately from pose', async () => {
  const { avatar, runtime } = avatarForTest(true);
  const body = avatar.motion.to({ body: { rotation: [0.2, 0.3, 0.7] } }, { duration: 1000 });
  const shape = avatar.setShape('heart', { duration: 1000 });
  runtime.advanceMotion(200); runtime.advanceShape(200);
  const pose = avatar.pose, contour = runtime.shape.contour, design = avatar.design;
  avatar.setCamera({ yaw: 65, pitch: 20, roll: -10 });
  assert.equal(runtime.timeline.active, true); assert.equal(runtime.shape.active, true);
  assert.deepEqual(avatar.pose, pose); assert.deepEqual(avatar.design, design); assert.strictEqual(runtime.shape.contour, contour);
  const frame = runtime.render();
  assert.deepEqual(frame.camera, avatar.camera); assert.deepEqual(frame.pose, pose); assert.equal(frame.view, undefined);
  avatar.design = patchDesign(avatar.design, { body: { color: '#abcdef' } }); assert.deepEqual(avatar.camera, { yaw: 65, pitch: 20, roll: -10 });
  runtime.advanceMotion(800); runtime.advanceShape(800);
  assert.deepEqual(await body, { finished: true }); assert.deepEqual(await shape, { finished: true });
});

test('pointer orbit updates the same degree camera, preserves roll, clamps axes and emits no activation after drag', () => {
  const { avatar, events } = avatarForTest(); avatar.interaction = 'box'; avatar.connected = true;
  let captured = false;
  avatar.canvas = { setPointerCapture() { captured = true; }, hasPointerCapture() { return captured; }, releasePointerCapture() { captured = false; } };
  avatar.setCamera({ yaw: 10, pitch: 15, roll: 25 }); const pose = avatar.pose;
  avatar.onPointerDown({ button: 0, pointerId: 7, clientX: 100, clientY: 100 });
  avatar.onPointerMove({ pointerId: 8, clientX: 500, clientY: 500 }); assert.equal(avatar.camera.yaw, 10);
  avatar.onPointerMove({ pointerId: 7, clientX: 150, clientY: 120 });
  assert.equal(avatar.camera.yaw, 10, 'Pointer commands wait for the coalesced input flush'); avatar.flushInput();
  close(avatar.camera.yaw, 10 + 0.5 * 180 / Math.PI); close(avatar.camera.pitch, 15 + 0.14 * 180 / Math.PI); assert.equal(avatar.camera.roll, 25);
  assert.deepEqual(events.at(-1).detail.camera, avatar.camera); assert.deepEqual(avatar.pose, pose);
  avatar.onPointerMove({ pointerId: 7, clientX: 10000, clientY: -10000 }); avatar.flushInput(); assert.deepEqual(avatar.camera, { yaw: 360, pitch: -90, roll: 25 });
  avatar.onPointerUp({ pointerId: 7 }); assert.equal(captured, false); assert.ok(events.every(event => event.type !== 'sidekick-activate'));
  const before = avatar.camera; avatar.onPointerMove({ pointerId: 7, clientX: 0, clientY: 0 }); assert.deepEqual(avatar.camera, before);
  avatar.onPointerDown({ button: 0, pointerId: 9, clientX: 0, clientY: 0 }); avatar.onPointerCancel(); avatar.onPointerMove({ pointerId: 9, clientX: 50, clientY: 50 }); assert.deepEqual(avatar.camera, before);
});

test('simultaneous eye edit and accessory removal preserve camera, body motion and the untouched eye track', async () => {
  const { avatar, runtime } = avatarForTest(true);
  avatar.design = createDesign({ accessories: [createAccessory('beret', 'hat'), createAccessory('glasses', 'frames')] });
  avatar.setCamera({ yaw: 30, pitch: 15, roll: -10 });
  const body = avatar.motion.to({ body: { rotation: [0.2, 0.3, 0.5] } }, { duration: 1000 });
  const right = avatar.setExpression('right', 'smile', { duration: 1000 });
  const hat = avatar.motion.to({ accessories: { hat: { rotation: [0.2, 0.3, 0.4] } } }, { duration: 1000 });
  runtime.advanceMotion(200); const before = avatar.pose;
  avatar.design = patchDesign(avatar.design, { eyes: { left: { expression: 'blink' } }, accessories: avatar.design.accessories.filter(part => part.id !== 'hat') });
  assert.deepEqual(await hat, { finished: false });
  assert.deepEqual(avatar.pose.rotation, before.rotation); assert.deepEqual(avatar.pose.eyes.right, before.eyes.right);
  assert.equal(avatar.pose.eyes.left.openness, 0); assert.equal(avatar.pose.accessories.hat, undefined);
  runtime.advanceMotion(800);
  assert.deepEqual(await body, { finished: true }); assert.deepEqual(await right, { finished: true });
  assert.deepEqual(avatar.pose.rotation, [0.2, 0.3, 0.5]); assert.equal(avatar.pose.eyes.right.smile, 1);
  assert.equal(avatar.pose.accessories.hat, undefined, 'Removed accessory tracks cannot recreate a stale pose entry');
  assert.deepEqual(avatar.camera, { yaw: 30, pitch: 15, roll: -10 });
});
