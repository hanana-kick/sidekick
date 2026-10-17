import test from 'node:test';
import assert from 'node:assert/strict';
import { CAMERA_PRESETS, cameraPreset, cameraViewMatrix, createAccessory, createCamera, createDesign, patchCamera, SidekickAvatar, patchDesign } from '../dist/src/index.js';
import { multiply, transform } from '../dist/src/core/math.js';
import { RenderEngine } from '../dist/src/runtime/render-engine.js';
import { bareAvatarFixture } from './helpers/render-runtime.mjs';

const avatarForTest = (connected = false) => bareAvatarFixture(SidekickAvatar, RenderEngine, connected);
const close = (actual, expected, tolerance = 1e-6) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);

test('camera exposes independent degree settings, immutable presets, and partial updates', () => {
  const initial = createCamera(); assert.deepEqual(initial, { yaw: 0, pitch: 0, roll: 0, zoom: 1 });
  const next = patchCamera(initial, { yaw: 45, pitch: -20 });
  assert.deepEqual(next, { yaw: 45, pitch: -20, roll: 0, zoom: 1 }); assert.deepEqual(initial, createCamera());
  next.yaw = 70; assert.deepEqual(cameraPreset('three-quarter'), { yaw: 45, pitch: 0, roll: 0 });
  assert.deepEqual(cameraPreset('side'), { yaw: 90, pitch: 0, roll: 0 });
  assert.ok(Object.isFrozen(CAMERA_PRESETS)); assert.ok(Object.isFrozen(CAMERA_PRESETS.front));
  const preset = cameraPreset('front'); preset.pitch = 20; assert.equal(cameraPreset('front').pitch, 0);
  assert.deepEqual(createCamera({ yaw: -360, pitch: 90, roll: -180, zoom: 1 }), { yaw: -360, pitch: 90, roll: -180, zoom: 1 });
  assert.deepEqual(createCamera({ yaw: 360, pitch: -90, roll: 180, zoom: 1 }), { yaw: 360, pitch: -90, roll: 180, zoom: 1 });
});

test('camera rejects invalid objects, axes, values and presets atomically', () => {
  const baseline = createCamera({ yaw: 25, pitch: 15, roll: 5 });
  for (const patch of [null, [], new Date(), 1, 'front', { yaw: undefined }, { yaw: null }, { yaw: '25' }, { yaw: NaN }, { yaw: Infinity }, { yaw: 361 }, { yaw: -361 }, { pitch: 91 }, { pitch: -91 }, { roll: 181 }, { roll: -181 }, { zoom: 0 }, { zoom: 3.1 }, { zoom: undefined }, { yaw: 0, pitch: Infinity }, { [Symbol()]: 1 }]) {
    assert.throws(() => patchCamera(baseline, patch));
    assert.deepEqual(baseline, { yaw: 25, pitch: 15, roll: 5, zoom: 1 });
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
  assert.deepEqual(avatar.camera, { yaw: 35, pitch: -18, roll: 12, zoom: 1 });
  const snapshot = avatar.camera; snapshot.yaw = 300; assert.equal(avatar.camera.yaw, 35);
  const last = events.at(-1); assert.equal(last.type, 'sidekick-camera-change');
  assert.deepEqual(last.detail.camera, avatar.camera); last.detail.camera.pitch = 80; assert.equal(avatar.camera.pitch, -18);
  const count = events.length; avatar.setCamera({}); avatar.setCamera(avatar.camera); assert.equal(events.length, count);
  assert.throws(() => avatar.setCamera({ yaw: 80, pitch: 120 })); assert.deepEqual(avatar.camera, { yaw: 35, pitch: -18, roll: 12, zoom: 1 }); assert.equal(events.length, count);
  avatar.camera = { yaw: -30, pitch: 10, roll: -5, zoom: 1 }; assert.deepEqual(avatar.camera, { yaw: -30, pitch: 10, roll: -5, zoom: 1 });
  avatar.setCameraPreset('three-quarter'); assert.deepEqual(avatar.camera, createCamera(cameraPreset('three-quarter')));
  avatar.setCameraPreset('side'); assert.deepEqual(avatar.camera, createCamera(cameraPreset('side')));
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
  avatar.setView(0); assert.deepEqual(avatar.camera, { yaw: 0, pitch: 0, roll: 20, zoom: 1 });
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
  avatar.design = patchDesign(avatar.design, { body: { color: '#abcdef' } }); assert.deepEqual(avatar.camera, { yaw: 65, pitch: 20, roll: -10, zoom: 1 });
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
  avatar.onPointerMove({ pointerId: 7, clientX: 10000, clientY: -10000 }); avatar.flushInput(); assert.deepEqual(avatar.camera, { yaw: 360, pitch: -90, roll: 25, zoom: 1 });
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
  assert.deepEqual(avatar.camera, { yaw: 30, pitch: 15, roll: -10, zoom: 1 });
});

test('zoom is bounded, independent of angles, presets preserve it and reset restores 1', () => {
  const { avatar } = avatarForTest();
  avatar.setCamera({ yaw: 21, pitch: -9, roll: 6, zoom: 2.5 });
  avatar.setCameraPreset('side'); assert.deepEqual(avatar.camera, { yaw: 90, pitch: 0, roll: 0, zoom: 2.5 });
  avatar.setView(.2, .1); assert.equal(avatar.camera.zoom, 2.5);
  for (const zoom of [0, .49, 3.01, NaN, Infinity, '2', null, undefined]) {
    const before = avatar.camera; assert.throws(() => avatar.setCamera({ yaw: 0, zoom })); assert.deepEqual(avatar.camera, before);
  }
  avatar.setCamera({ zoom: .5 }); assert.equal(avatar.camera.zoom, .5);
  avatar.setCamera({ zoom: 3 }); assert.equal(avatar.camera.zoom, 3);
  avatar.resetCamera(); assert.deepEqual(avatar.camera, createCamera());
});

test('wheel units normalize to equal multiplicative zoom and limits reverse immediately', async () => {
  const { wheelZoom, pinchZoom } = await import('../dist/src/core/camera.js');
  close(wheelZoom(1, -160, 0), wheelZoom(1, -10, 1));
  close(wheelZoom(1, -160, 0), wheelZoom(1, -1, 2, 160));
  close(wheelZoom(wheelZoom(1, -20), -20), wheelZoom(1, -40));
  assert.equal(wheelZoom(1, -1e9), 3); assert.equal(wheelZoom(1, 1e9), .5);
  assert.ok(wheelZoom(3, 10) < 3); assert.ok(wheelZoom(.5, -10) > .5);
  close(pinchZoom(1, 100, 150), 1.5); assert.equal(pinchZoom(1, 0, 100), 1);
  assert.equal(pinchZoom(1, 100, 0), 1); assert.equal(pinchZoom(2, 100, 400), 3);
  assert.equal(pinchZoom(1, 100, 1), .5);
});

function gestures() {
  const f = avatarForTest(true), captured = new Set();
  f.avatar.interaction = 'box';
  f.avatar.canvas = { setPointerCapture(id) { captured.add(id); }, hasPointerCapture(id) { return captured.has(id); }, releasePointerCapture(id) { captured.delete(id); } };
  const pointer = (id, x, y, type = 'touch') => ({ button: 0, pointerId: id, clientX: x, clientY: y, pointerType: type });
  return { ...f, captured, down: (id, x, y) => f.avatar.onPointerDown(pointer(id, x, y)), move: (id, x, y) => f.avatar.onPointerMove(pointer(id, x, y)), up: id => f.avatar.onPointerUp(pointer(id, 0, 0)) };
}

test('one → two → one pointers rebase without rotation jumps, centroid pan or activation', () => {
  const f = gestures(), a = f.avatar;
  a.setCamera({ yaw: 12, pitch: 3, roll: 9 });
  f.down(1, 100, 100); f.move(1, 120, 100);
  f.down(2, 220, 100); const orbit = a.camera; assert.ok(orbit.yaw > 12, 'transition flushes pending orbit');
  f.move(1, 100, 100); f.move(2, 240, 100); a.flushInput();
  close(a.camera.zoom, 1.4); assert.deepEqual({ ...a.camera, zoom: 1 }, orbit);
  // Equal two-finger translation changes neither viewing angles nor final scale.
  f.move(1, 130, 120); f.move(2, 270, 120); a.flushInput();
  close(a.camera.zoom, 1.4); assert.deepEqual({ ...a.camera, zoom: 1 }, orbit);
  const pinched = a.camera; f.up(2); f.move(1, 130, 120); a.flushInput(); assert.deepEqual(a.camera, pinched);
  f.move(1, 140, 120); a.flushInput(); close(a.camera.yaw, pinched.yaw + .1 * 180 / Math.PI);
  close(a.camera.zoom, 1.4); f.up(1); assert.equal(f.captured.size, 0);
  assert.ok(f.events.every(event => event.type !== 'sidekick-activate'));
});

test('cancellation releases every capture, drops queued deltas and preserves accepted zoom', () => {
  const f = gestures(), a = f.avatar;
  f.down(1, 100, 100); f.down(2, 200, 100); f.move(2, 250, 100); a.flushInput();
  const accepted = a.camera; f.move(2, 300, 100); a.onPointerCancel(); a.flushInput();
  assert.deepEqual(a.camera, accepted); assert.equal(f.captured.size, 0); assert.equal(a.pointers.size, 0);
  f.down(1, 100, 100); f.move(1, 110, 100); a.flushInput(); assert.equal(a.camera.zoom, accepted.zoom);
  a.resetCamera(); a.flushInput(); assert.deepEqual(a.camera, createCamera()); assert.equal(f.captured.size, 0);
});

test('wheel and pinch leave body/eye/shape clocks running while neutralizing tracking', async t => {
  const f = gestures(), a = f.avatar, runtime = f.runtime;
  t.after(() => a.clearDrag());
  a.trackingMode = 'eyes-and-body'; a.lookAt({ space: 'view', x: .2, y: -.3 });
  f.move = (id, x, y) => a.onPointerMove({ pointerId: id, clientX: x, clientY: y, pointerType: 'touch' });
  a.onTrackedPointerMove({ pointerType: 'mouse', clientX: 900, clientY: -900 }); a.flushInput(); runtime.advanceTracking(1);
  const body = a.motion.to({ body: { rotation: [.2, .3, .4] } }, { duration: 1000 });
  const eye = a.setEyeWeights('left', { smile: 1 }, { duration: 1000 });
  const shape = a.setShape('heart', { duration: 1000 }); runtime.advanceMotion(250); runtime.advanceShape(250);
  const before = a.pose, contour = runtime.shape.contour, remaining = runtime.shape.remainingDuration;
  let prevented = 0; a.onWheel({ deltaY: -200, deltaMode: 0, preventDefault() { prevented++; } });
  for (let n = 0; n < 20; n++) a.onWheel({ deltaY: -1, deltaMode: 0, preventDefault() { prevented++; } });
  a.flushInput(); assert.equal(prevented, 21); assert.ok(a.camera.zoom > 1);
  assert.deepEqual(a.pose.rotation, before.rotation); assert.deepEqual(a.pose.eyes, before.eyes);
  assert.strictEqual(runtime.shape.contour, contour); assert.equal(runtime.shape.remainingDuration, remaining);
  assert.deepEqual(runtime.tracking.compose(a.pose).rotation, a.pose.rotation);
  assert.deepEqual(a.gazeTarget, [.2, -.3]);
  a.onTrackedPointerMove({ pointerType: 'mouse', clientX: -900, clientY: 900 }); a.flushInput(); assert.deepEqual(a.gazeTarget, [.2, -.3]);
  a.clearDrag(); assert.equal(a.trackedGaze, undefined);
  a.onTrackedPointerMove({ pointerType: 'mouse', clientX: -900, clientY: 900 }); a.flushInput(); assert.deepEqual(a.gazeTarget, [-1, -1]);
  f.down(1, 50, 100); f.down(2, 150, 100); f.move(2, 170, 100); a.flushInput();
  assert.deepEqual(a.pose.rotation, before.rotation); assert.deepEqual(a.pose.eyes, before.eyes);
  assert.strictEqual(runtime.shape.contour, contour); assert.equal(runtime.shape.remainingDuration, remaining); a.onPointerCancel();
  runtime.advanceMotion(750); runtime.advanceShape(750);
  assert.deepEqual(await body, { finished: true }); assert.deepEqual(await eye, { finished: true }); assert.deepEqual(await shape, { finished: true });
  a.interactionState = 'none'; const zoom = a.camera.zoom;
  a.onWheel({ deltaY: -500, preventDefault() { throw new Error('Disabled preview must not block page scrolling'); } });
  f.down(1, 10, 10); a.flushInput(); assert.equal(a.camera.zoom, zoom); assert.equal(f.captured.size, 0);
});

test('pinch centroid translation at either zoom bound clamps once per frame', () => {
  for (const [zoom, delta] of [[3, -20], [.5, 20]]) {
    const f = gestures(), a = f.avatar; a.setCamera({ zoom });
    f.down(1, 100, 100); f.down(2, 200, 100);
    f.move(1, 100 + delta, 120); f.move(2, 200 + delta, 120); a.flushInput();
    assert.equal(a.camera.zoom, zoom); assert.equal(a.camera.yaw, 0); assert.equal(a.camera.pitch, 0);
    f.move(2, 200 + delta + (zoom === 3 ? -10 : 10), 120); a.flushInput();
    assert.ok(zoom === 3 ? a.camera.zoom < 3 : a.camera.zoom > .5, 'bound reversal is immediate after the committed baseline');
    a.clearDrag();
  }
});
