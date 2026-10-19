import test from 'node:test';
import assert from 'node:assert/strict';
import { BODY_ORIENTATION_PRESETS, bodyOrientationPreset, bodyOrientationMatrix, createAccessory, createBodyOrientation, createDesign, patchBodyOrientation, SidekickAvatar, patchDesign } from '../dist/src/index.js';
import { multiply, transform } from '../dist/src/core/math.js';
import { RenderEngine } from '../dist/src/runtime/render-engine.js';
import { bareAvatarFixture } from './helpers/render-runtime.mjs';

const avatarForTest = (connected = false) => bareAvatarFixture(SidekickAvatar, RenderEngine, connected);
const close = (actual, expected, tolerance = 1e-6) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);

test('bodyOrientation exposes independent degree settings, immutable presets, and partial updates', () => {
  const initial = createBodyOrientation(); assert.deepEqual(initial, { yaw: 0, pitch: 0, roll: 0 });
  const next = patchBodyOrientation(initial, { yaw: 45, pitch: -20 });
  assert.deepEqual(next, { yaw: 45, pitch: -20, roll: 0 }); assert.deepEqual(initial, createBodyOrientation());
  next.yaw = 70; assert.deepEqual(bodyOrientationPreset('three-quarter'), { yaw: 45, pitch: 0, roll: 0 });
  assert.deepEqual(bodyOrientationPreset('side'), { yaw: 90, pitch: 0, roll: 0 });
  assert.ok(Object.isFrozen(BODY_ORIENTATION_PRESETS)); assert.ok(Object.isFrozen(BODY_ORIENTATION_PRESETS.front));
  const preset = bodyOrientationPreset('front'); preset.pitch = 20; assert.equal(bodyOrientationPreset('front').pitch, 0);
  assert.deepEqual(createBodyOrientation({ yaw: -360, pitch: 90, roll: -180 }), { yaw: -360, pitch: 90, roll: -180 });
  assert.deepEqual(createBodyOrientation({ yaw: 360, pitch: -90, roll: 180 }), { yaw: 360, pitch: -90, roll: 180 });
});

test('bodyOrientation rejects invalid objects, axes, values and presets atomically', () => {
  const baseline = createBodyOrientation({ yaw: 25, pitch: 15, roll: 5 });
  for (const patch of [null, [], new Date(), 1, 'front', { yaw: undefined }, { yaw: null }, { yaw: '25' }, { yaw: NaN }, { yaw: Infinity }, { yaw: 361 }, { yaw: -361 }, { pitch: 91 }, { pitch: -91 }, { roll: 181 }, { roll: -181 }, { zoom: 0 }, { zoom: 3.1 }, { zoom: undefined }, { yaw: 0, pitch: Infinity }, { [Symbol()]: 1 }]) {
    assert.throws(() => patchBodyOrientation(baseline, patch));
    assert.deepEqual(baseline, { yaw: 25, pitch: 15, roll: 5 });
  }
  for (const preset of ['', 'back', 'constructor', '__proto__', undefined, null, {}]) assert.throws(() => bodyOrientationPreset(preset));
});

test('view rotation composes independently with body pose, including mixed angles and translation', () => {
  const bodyOrientation = { yaw: 40, pitch: -25, roll: 15 }, radians = Math.PI / 180;
  const view = bodyOrientationMatrix(bodyOrientation), bodyRotation = [0.12, -0.3, 0.55];
  const model = transform([0, 0.2, 0], bodyRotation), composed = multiply(view, model);
  const incorrect = transform([0, 0.2, 0], [bodyRotation[0] + bodyOrientation.pitch * radians, bodyRotation[1] + bodyOrientation.yaw * radians, bodyRotation[2] + bodyOrientation.roll * radians]);
  assert.deepEqual(view, transform([0, 0, 0], [-25 * radians, 40 * radians, 15 * radians]));
  assert.ok(composed.some((value, index) => Math.abs(value - incorrect[index]) > 0.1), 'View and body rotations must not be summed');
  close(composed[12], view[4] * 0.2); close(composed[13], view[5] * 0.2); close(composed[14], view[6] * 0.2);
  const yaw = bodyOrientationMatrix(createBodyOrientation({ yaw: 90 })); close(yaw[8], 1);
  const pitch = bodyOrientationMatrix(createBodyOrientation({ pitch: 90 })); close(pitch[6], 1);
  const roll = bodyOrientationMatrix(createBodyOrientation({ roll: 90 })); close(roll[1], 1);
});

test('avatar bodyOrientation snapshots, setters, events, presets and reset leave design and pose untouched', () => {
  const { avatar, events } = avatarForTest();
  const design = avatar.design, pose = avatar.pose;
  avatar.setBodyOrientation({ yaw: 35 }); avatar.setBodyOrientation({ pitch: -18, roll: 12 });
  assert.deepEqual(avatar.bodyOrientation, { yaw: 35, pitch: -18, roll: 12 });
  const snapshot = avatar.bodyOrientation; snapshot.yaw = 300; assert.equal(avatar.bodyOrientation.yaw, 35);
  const last = events.at(-1); assert.equal(last.type, 'sidekick-body-orientation-change');
  assert.deepEqual(last.detail.bodyOrientation, avatar.bodyOrientation); last.detail.bodyOrientation.pitch = 80; assert.equal(avatar.bodyOrientation.pitch, -18);
  const count = events.length; avatar.setBodyOrientation({}); avatar.setBodyOrientation(avatar.bodyOrientation); assert.equal(events.length, count);
  assert.throws(() => avatar.setBodyOrientation({ yaw: 80, pitch: 120 })); assert.deepEqual(avatar.bodyOrientation, { yaw: 35, pitch: -18, roll: 12 }); assert.equal(events.length, count);
  avatar.bodyOrientation = { yaw: -30, pitch: 10, roll: -5 }; assert.deepEqual(avatar.bodyOrientation, { yaw: -30, pitch: 10, roll: -5 });
  avatar.setBodyOrientationPreset('three-quarter'); assert.deepEqual(avatar.bodyOrientation, createBodyOrientation(bodyOrientationPreset('three-quarter')));
  avatar.setBodyOrientationPreset('side'); assert.deepEqual(avatar.bodyOrientation, createBodyOrientation(bodyOrientationPreset('side')));
  avatar.resetBodyOrientation(); assert.deepEqual(avatar.bodyOrientation, createBodyOrientation());
  assert.deepEqual(avatar.design, design); assert.deepEqual(avatar.pose, pose);
  assert.ok(events.every(event => event.type === 'sidekick-body-orientation-change'));
});

test('removed camera and view APIs are absent', () => {
 const {avatar}=avatarForTest();
 for (const key of ['camera','setCamera','setCameraPreset','resetCamera','setView','view']) assert.equal(key in avatar,false,key);
});

test('bodyOrientation changes preserve in-flight body and shape animation and render separately from pose', async () => {
  const { avatar, runtime } = avatarForTest(true);
  const body = avatar.motion.to({ body: { rotation: [0.2, 0.3, 0.7] } }, { duration: 1000 });
  const shape = avatar.setShape('heart', { duration: 1000 });
  runtime.advanceMotion(200); runtime.advanceShape(200);
  const pose = avatar.pose, contour = runtime.shape.contour, design = avatar.design;
  avatar.setBodyOrientation({ yaw: 65, pitch: 20, roll: -10 });
  assert.equal(runtime.timeline.active, true); assert.equal(runtime.shape.active, true);
  assert.deepEqual(avatar.pose, pose); assert.deepEqual(avatar.design, design); assert.strictEqual(runtime.shape.contour, contour);
  const frame = runtime.render();
  assert.deepEqual(frame.bodyOrientation, { yaw: 0, pitch: 0, roll: 0 }); assert.deepEqual(frame.pose, pose); assert.equal(frame.view, undefined);
  avatar.design = patchDesign(avatar.design, { body: { color: '#abcdef' } }); assert.deepEqual(avatar.bodyOrientation, { yaw: 65, pitch: 20, roll: -10 });
  runtime.advanceMotion(800); runtime.advanceShape(800);
  assert.deepEqual(await body, { finished: true }); assert.deepEqual(await shape, { finished: true });
  runtime.frame(10); runtime.frame(26); assert.ok(runtime.render().bodyOrientation.yaw > 0 && runtime.render().bodyOrientation.yaw < 65);
  for (let i = 2; i < 110; i++) runtime.frame(10 + i * 16);
  assert.deepEqual(runtime.render().bodyOrientation, avatar.bodyOrientation);
});

test('pointer orbit updates the same degree bodyOrientation, preserves roll, clamps axes and emits no activation after drag', () => {
  const { avatar, events } = avatarForTest(); avatar.interaction = 'box'; avatar.connected = true;
  let captured = false;
  avatar.canvas = { setPointerCapture() { captured = true; }, hasPointerCapture() { return captured; }, releasePointerCapture() { captured = false; } };
  avatar.setBodyOrientation({ yaw: 10, pitch: 15, roll: 25 }); const pose = avatar.pose;
  avatar.onPointerDown({ button: 0, pointerId: 7, clientX: 100, clientY: 100 });
  avatar.onPointerMove({ pointerId: 8, clientX: 500, clientY: 500 }); assert.equal(avatar.bodyOrientation.yaw, 10);
  avatar.onPointerMove({ pointerId: 7, clientX: 150, clientY: 120 });
  assert.equal(avatar.bodyOrientation.yaw, 10, 'Pointer commands wait for the coalesced input flush'); avatar.flushInput();
  close(avatar.bodyOrientation.yaw, 10 + 0.5 * 180 / Math.PI); close(avatar.bodyOrientation.pitch, 15 + 0.14 * 180 / Math.PI); assert.equal(avatar.bodyOrientation.roll, 25);
  assert.deepEqual(events.at(-1).detail.bodyOrientation, avatar.bodyOrientation); assert.deepEqual(avatar.pose, pose);
  avatar.onPointerMove({ pointerId: 7, clientX: 10000, clientY: -10000 }); avatar.flushInput(); assert.deepEqual(avatar.bodyOrientation, { yaw: 360, pitch: -90, roll: 25 });
  avatar.onPointerUp({ pointerId: 7 }); assert.equal(captured, false); assert.ok(events.every(event => event.type !== 'sidekick-activate'));
  const before = avatar.bodyOrientation; avatar.onPointerMove({ pointerId: 7, clientX: 0, clientY: 0 }); assert.deepEqual(avatar.bodyOrientation, before);
  avatar.onPointerDown({ button: 0, pointerId: 9, clientX: 0, clientY: 0 }); avatar.onPointerCancel(); avatar.onPointerMove({ pointerId: 9, clientX: 50, clientY: 50 }); assert.deepEqual(avatar.bodyOrientation, before);
});

test('simultaneous eye edit and accessory removal preserve bodyOrientation, body motion and the untouched eye track', async () => {
  const { avatar, runtime } = avatarForTest(true);
  avatar.design = createDesign({ accessories: [createAccessory('beret', 'hat'), createAccessory('glasses', 'frames')] });
  avatar.setBodyOrientation({ yaw: 30, pitch: 15, roll: -10 });
  const body = avatar.motion.to({ body: { rotation: [0.2, 0.3, 0.5] } }, { duration: 1000 });
  const right = avatar.setExpression('right', 'smile', { duration: 1000 });
  const hat = avatar.motion.to({ accessories: { hat: { rotation: [0.2, 0.3, 0.4] } } }, { duration: 1000 });
  runtime.advanceMotion(200); const before = avatar.pose;
  avatar.design = patchDesign(avatar.design, { eyes: { left: { expression: 'blink' } }, accessories: avatar.design.accessories.filter(part => part.id !== 'hat') });
  assert.deepEqual(await hat, { finished: false });
  assert.deepEqual(avatar.pose.rotation, before.rotation); assert.deepEqual(avatar.pose.eyes.right, before.eyes.right);
  assert.equal(avatar.pose.eyes.left.openness, before.eyes.left.openness); assert.equal(avatar.pose.accessories.hat, undefined);
  runtime.advanceMotion(800); assert.equal(avatar.pose.eyes.left.openness, 0);
  assert.deepEqual(await body, { finished: true }); assert.deepEqual(await right, { finished: true });
  assert.deepEqual(avatar.pose.rotation, [0.2, 0.3, 0.5]); assert.equal(avatar.pose.eyes.right.smile, 1);
  assert.equal(avatar.pose.accessories.hat, undefined, 'Removed accessory tracks cannot recreate a stale pose entry');
  assert.deepEqual(avatar.bodyOrientation, { yaw: 30, pitch: 15, roll: -10 });
});

test('zoom is bounded and independent of orientation and presets', () => {
 const {avatar,events}=avatarForTest(); avatar.zoom=2.5; avatar.setBodyOrientation({yaw:21,pitch:-9,roll:6});
 avatar.setBodyOrientationPreset('side'); assert.deepEqual(avatar.bodyOrientation,{yaw:90,pitch:0,roll:0});assert.equal(avatar.zoom,2.5);
 for(const zoom of [0,.49,3.01,NaN,Infinity,'2',null,undefined]) { assert.throws(()=>{avatar.zoom=zoom;});assert.equal(avatar.zoom,2.5); }
 avatar.zoom=.5;assert.equal(avatar.zoom,.5);avatar.zoom=3;assert.equal(avatar.zoom,3);
 avatar.resetBodyOrientation();assert.deepEqual(avatar.bodyOrientation,createBodyOrientation());assert.equal(avatar.zoom,3);
 assert.ok(events.some(event=>event.type==='sidekick-zoom-change'&&event.detail.zoom===3));
});

test('wheel units normalize to equal multiplicative zoom and limits reverse immediately', async () => {
  const { wheelZoom, pinchZoom } = await import('../dist/src/core/zoom.js');
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
  a.setBodyOrientation({ yaw: 12, pitch: 3, roll: 9 });
  f.down(1, 100, 100); f.move(1, 120, 100);
  f.down(2, 220, 100); const orbit = a.bodyOrientation; assert.ok(orbit.yaw > 12, 'transition flushes pending orbit');
  f.move(1, 100, 100); f.move(2, 240, 100); a.flushInput();
  close(a.zoom, 1.4); assert.deepEqual(a.bodyOrientation, orbit);
  // Equal two-finger translation changes neither viewing angles nor final scale.
  f.move(1, 130, 120); f.move(2, 270, 120); a.flushInput();
  close(a.zoom, 1.4); assert.deepEqual(a.bodyOrientation, orbit);
  const pinched = a.bodyOrientation; f.up(2); f.move(1, 130, 120); a.flushInput(); assert.deepEqual(a.bodyOrientation, pinched);
  f.move(1, 140, 120); a.flushInput(); close(a.bodyOrientation.yaw, pinched.yaw + .1 * 180 / Math.PI);
  close(a.zoom, 1.4); f.up(1); assert.equal(f.captured.size, 0);
  assert.ok(f.events.every(event => event.type !== 'sidekick-activate'));
});

test('cancellation releases every capture, drops queued deltas and preserves accepted zoom', () => {
  const f = gestures(), a = f.avatar;
  f.down(1, 100, 100); f.down(2, 200, 100); f.move(2, 250, 100); a.flushInput();
  const accepted = a.bodyOrientation, acceptedZoom = a.zoom; f.move(2, 300, 100); a.onPointerCancel(); a.flushInput();
  assert.deepEqual(a.bodyOrientation, accepted); assert.equal(f.captured.size, 0); assert.equal(a.pointers.size, 0);
  f.down(1, 100, 100); f.move(1, 110, 100); a.flushInput(); assert.equal(a.zoom, acceptedZoom);
  a.resetBodyOrientation(); a.flushInput(); assert.deepEqual(a.bodyOrientation, createBodyOrientation()); assert.equal(f.captured.size, 0);
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
  a.flushInput(); assert.equal(prevented, 21); assert.ok(a.zoom > 1);
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
  a.interactionState = 'none'; const zoom = a.zoom;
  a.onWheel({ deltaY: -500, preventDefault() { throw new Error('Disabled preview must not block page scrolling'); } });
  f.down(1, 10, 10); a.flushInput(); assert.equal(a.zoom, zoom); assert.equal(f.captured.size, 0);
});

test('pinch centroid translation at either zoom bound clamps once per frame', () => {
  for (const [zoom, delta] of [[3, -20], [.5, 20]]) {
    const f = gestures(), a = f.avatar; a.zoom = zoom;
    f.down(1, 100, 100); f.down(2, 200, 100);
    f.move(1, 100 + delta, 120); f.move(2, 200 + delta, 120); a.flushInput();
    assert.equal(a.zoom, zoom); assert.equal(a.bodyOrientation.yaw, 0); assert.equal(a.bodyOrientation.pitch, 0);
    f.move(2, 200 + delta + (zoom === 3 ? -10 : 10), 120); a.flushInput();
    assert.ok(zoom === 3 ? a.zoom < 3 : a.zoom > .5, 'bound reversal is immediate after the committed baseline');
    a.clearDrag();
  }
});
