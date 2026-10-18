import { RenderEngine } from '../dist/src/runtime/render-engine.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { TRACKING_MODES, SidekickAvatar, createScene, parseScene, serializeScene } from '../dist/src/index.js';
import { TrackingBodyLayer } from '../dist/src/core/tracking.js';
import { initialPose } from '../dist/src/core/motion.js';
import { resolveSidekickAttributes } from '../dist/src/element/attributes.js';
import { bareAvatarFixture } from './helpers/render-runtime.mjs';

const near = (a, b, tolerance = 1e-5) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
const fixture = () => bareAvatarFixture(SidekickAvatar, RenderEngine);

test('canonical tracking modes, legacy aliases and declarative precedence are strict', async () => {
  assert.deepEqual(TRACKING_MODES, ['off', 'eyes', 'eyes-and-body']); assert.ok(Object.isFrozen(TRACKING_MODES));
  const resolve = values => resolveSidekickAttributes(new Map(Object.entries(values)));
  assert.equal(resolve({}).trackingMode, 'eyes-and-body');
  for (const legacy of ['', 'true', '1']) assert.equal(resolve({ 'mouse-tracking': legacy }).trackingMode, 'eyes');
  for (const legacy of ['false', '0']) assert.equal(resolve({ 'mouse-tracking': legacy }).trackingMode, 'off');
  for (const mode of TRACKING_MODES) for (const legacy of ['true', 'false']) {
    const resolved = resolve({ 'mouse-tracking': legacy, 'tracking-mode': mode });
    assert.equal(resolved.trackingMode, mode); assert.equal(resolved.mouseTracking, mode !== 'off');
  }
  for (const mode of ['', 'true', 'body', 'EYES', 'eyes-body']) assert.throws(() => resolve({ 'tracking-mode': mode }));
  assert.throws(() => resolve({ 'tracking-mode': 'eyes', 'mouse-tracking': 'yes' }));
  const { avatar } = fixture();
  assert.equal(avatar.trackingMode, 'eyes-and-body'); assert.equal(avatar.mouseTracking, true);
  avatar.mouseTracking = true; assert.equal(avatar.trackingMode, 'eyes');
  avatar.trackingMode = 'eyes-and-body'; avatar.mouseTracking = false;
  assert.equal(avatar.trackingMode, 'eyes-and-body'); assert.equal(avatar.mouseTracking, true);
  assert.equal(avatar.getAttribute('mouse-tracking'), 'false');
  avatar.removeAttribute('tracking-mode'); await Promise.resolve(); assert.equal(avatar.trackingMode, 'off');
  assert.throws(() => { avatar.trackingMode = 'body'; }); assert.equal(avatar.trackingMode, 'off');
  avatar.setAttribute('tracking-mode', 'eyes-and-body'); avatar.setAttribute('camera-yaw', 'bad'); await Promise.resolve();
  assert.equal(avatar.trackingMode, 'off');
  avatar.setAttribute('camera-yaw', '10'); await Promise.resolve(); assert.equal(avatar.trackingMode, 'eyes-and-body');
  avatar.removeAttribute('tracking-mode'); avatar.removeAttribute('mouse-tracking'); await Promise.resolve();
  assert.equal(avatar.trackingMode, 'eyes-and-body'); assert.equal(avatar.mouseTracking, true);
});

test('scene v2 defaults to eyes-and-body and preserves explicit and legacy tracking choices', () => {
  assert.equal(createScene().trackingMode, 'eyes-and-body');
  for (const mode of TRACKING_MODES) {
    const scene = createScene({ trackingMode: mode, mouseTracking: mode === 'off' });
    assert.equal(scene.sceneVersion, 2); assert.equal(scene.trackingMode, mode); assert.equal('mouseTracking' in scene, false);
    assert.deepEqual(parseScene(serializeScene(scene)), scene);
  }
  for (const enabled of [false, true]) {
    const scene = createScene({ mouseTracking: enabled });
    const { trackingMode, ...legacy } = scene;
    assert.equal(trackingMode, enabled ? 'eyes' : 'off');
    assert.deepEqual(parseScene({ ...legacy, sceneVersion: 1, mouseTracking: enabled }), scene);
  }
  assert.throws(() => createScene({ trackingMode: 'body' }));
  assert.throws(() => createScene({ trackingMode: 'eyes', mouseTracking: 'false' }));
  assert.throws(() => parseScene({ ...createScene(), mouseTracking: true }));
  assert.throws(() => parseScene({ ...createScene(), sceneVersion: 1 }));
});

test('a fresh element follows the pointer with both eyes and body without tracking configuration', () => {
  const { avatar, connect, move } = fixture(); const runtime = connect();
  assert.equal(avatar.trackingMode, 'eyes-and-body');
  assert.equal(avatar.hasAttribute('tracking-mode'), false); assert.equal(avatar.hasAttribute('mouse-tracking'), false);
  move(900, -900);
  for (let n = 0; n < 200; n++) runtime.advanceTracking(.016);
  assert.deepEqual(avatar.gazeTarget, [1, 1]);
  const rendered = runtime.tracking.compose(avatar.pose);
  assert.ok(rendered.rotation[1] > .2); assert.ok(Math.abs(rendered.rotation[0]) > .1);
  assert.deepEqual(avatar.pose.rotation, [0, 0, 0]);
});

test('body tracking is bounded, continuous through retargeting and never changes authored pose', () => {
  const layer = new TrackingBodyLayer(), pose = initialPose(); pose.rotation = [.3, -.4, .5];
  const baseline = structuredClone(pose); assert.deepEqual(layer.compose(pose), baseline);
  layer.follow([1, 1]); assert.deepEqual(layer.compose(pose), baseline);
  for (let n = 0; n < 200; n++) { layer.advance(.016); const r = layer.compose(pose).rotation; near(Math.max(0, Math.abs(r[0] - pose.rotation[0]) - .14), 0); near(Math.max(0, Math.abs(r[1] - pose.rotation[1]) - .22), 0); }
  const before = layer.compose(pose); layer.follow([-1, -1]); assert.deepEqual(layer.compose(pose), before);
  layer.advance(.016); assert.ok(Math.abs(layer.compose(pose).rotation[1] - before.rotation[1]) < .02);
  layer.follow(undefined); const current = layer.compose(pose); layer.advance(0); assert.deepEqual(layer.compose(pose), current);
  for (let n = 0; n < 200; n++) layer.advance(.016);
  assert.deepEqual(layer.compose(pose), baseline); assert.equal(layer.active, false); assert.deepEqual(pose, baseline);
});

test('element tracking preserves camera and independent body timeline, mode switches settle without snaps', async () => {
  const { avatar, connect, move, document } = fixture(); const runtime = connect();
  avatar.lookAt({ space: 'view', x: .2, y: -.3 }); avatar.setCamera({ yaw: 35, pitch: 12, roll: -7 });
  const pending = avatar.motion.to({ body: { rotation: [.2, .3, .4] } }, { duration: 1000, easing: 'linear' });
  runtime.advanceMotion(250); const base = avatar.pose.rotation, camera = avatar.camera;
  avatar.trackingMode = 'eyes'; move(10000, -10000);
  for (let n = 0; n < 100; n++) runtime.advanceTracking(.016);
  assert.deepEqual(runtime.tracking.compose(avatar.pose).rotation, base); assert.deepEqual(avatar.gazeTarget, [1, 1]);
  avatar.trackingMode = 'eyes-and-body'; const before = runtime.tracking.compose(avatar.pose).rotation;
  assert.deepEqual(before, base);
  for (let n = 0; n < 100; n++) runtime.advanceTracking(.016);
  assert.notDeepEqual(runtime.tracking.compose(avatar.pose).rotation, base); assert.deepEqual(avatar.pose.rotation, base);
  assert.deepEqual(avatar.camera, camera); assert.equal(runtime.timeline.active, true);
  const tracked = runtime.tracking.compose(avatar.pose).rotation;
  avatar.trackingMode = 'eyes'; assert.deepEqual(runtime.tracking.compose(avatar.pose).rotation, tracked);
  avatar.trackingMode = 'off'; assert.deepEqual(avatar.gazeTarget, [.2, -.3]);
  assert.deepEqual(runtime.tracking.compose(avatar.pose).rotation, tracked);
  for (let n = 0; n < 200; n++) runtime.advanceTracking(.016);
  assert.deepEqual(runtime.tracking.compose(avatar.pose).rotation, base);
  move(-10000, 10000); assert.deepEqual(avatar.gazeTarget, [.2, -.3]);
  runtime.advanceMotion(750); assert.deepEqual(await pending, { finished: true }); assert.deepEqual(avatar.pose.rotation, [.2, .3, .4]);
  avatar.trackingMode = 'eyes-and-body'; move(10000, -10000); document.dispatchEvent(new Event('pointerleave'));
  assert.deepEqual(avatar.gazeTarget, [.2, -.3]);
});

test('reduced motion suppresses body following; hidden/disconnect/blur restore manual gaze without listener leaks', () => {
  const { avatar, connect, document, move } = fixture(); let adds = 0, removes = 0;
  const add = document.addEventListener.bind(document), remove = document.removeEventListener.bind(document);
  document.addEventListener = (type, ...args) => { if (type === 'pointermove') adds++; add(type, ...args); };
  document.removeEventListener = (type, ...args) => { if (type === 'pointermove') removes++; remove(type, ...args); };
  const runtime = connect(); avatar.lookAt({ space: 'view', x: -.2, y: .4 }); avatar.trackingMode = 'eyes-and-body';
  avatar.updateMouseTracking(); assert.equal(adds, 1);
  move(900, 900, 'touch'); assert.deepEqual(avatar.gazeTarget, [-.2, .4]);
  move(900, 900); for (let n = 0; n < 30; n++) runtime.advanceTracking(.016);
  const before = runtime.tracking.compose(avatar.pose).rotation;
  avatar.media = { matches: true }; avatar.onMotionPreference();
  assert.deepEqual(runtime.tracking.compose(avatar.pose).rotation, before);
  for (let n = 0; n < 200; n++) runtime.advanceTracking(.016);
  assert.deepEqual(runtime.tracking.compose(avatar.pose).rotation, [0, 0, 0]);
  move(-900, -900); assert.deepEqual(avatar.pose.gaze, [-1, 1]);
  for (let n = 0; n < 50; n++) runtime.advanceTracking(.016);
  assert.deepEqual(runtime.tracking.compose(avatar.pose).rotation, [0, 0, 0]);
  document.defaultView.dispatchEvent(new Event('blur')); assert.deepEqual(avatar.pose.gaze, [-.2, .4]);
  for (let n = 0; n < 3; n++) {
    avatar.visible = false; avatar.updateMouseTracking(); assert.equal(avatar.trackingDocument, undefined);
    const previous = avatar.pose; move(900, 900); assert.deepEqual(avatar.pose, previous);
    avatar.visible = true; avatar.updateMouseTracking(); avatar.updateMouseTracking();
  }
  avatar.isConnected = false; avatar.detachMouseTracking();
  assert.equal(adds, 4); assert.equal(removes, 4); assert.deepEqual(avatar.pose.gaze, [-.2, .4]);
});


test('paused mode changes settle only the body layer and disconnect clears invisible tracking state', t => {
  const { avatar, document, connect, move } = fixture(); const runtime = connect();
  const globals = Object.fromEntries(['document', 'requestAnimationFrame', 'cancelAnimationFrame'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.assign(globalThis, { document, requestAnimationFrame: () => 1, cancelAnimationFrame() {} });
  t.after(() => { for (const [key, descriptor] of Object.entries(globals)) if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; });
  avatar.trackingMode = 'eyes-and-body'; move(900, -900);
  for (let n = 0; n < 100; n++) runtime.advanceTracking(.016);
  avatar.paused = true;
  const before = runtime.tracking.compose(avatar.pose).rotation, elapsed = avatar.elapsed, base = avatar.pose;
  assert.ok(before[1] > .2); avatar.trackingMode = 'off';
  assert.deepEqual(runtime.tracking.compose(avatar.pose).rotation, before); assert.equal(runtime.engine.animated(), true);
  for (let n = 1; n <= 200; n++) runtime.frame(n * 16);
  assert.deepEqual(runtime.tracking.compose(avatar.pose).rotation, [0, 0, 0]);
  assert.deepEqual(avatar.pose, { ...base, gaze: [0, 0] }); assert.equal(avatar.elapsed, elapsed); assert.equal(runtime.engine.animated(), false);
  avatar.paused = false; avatar.trackingMode = 'eyes-and-body'; move(900, -900);
  for (let n = 0; n < 100; n++) runtime.advanceTracking(.016);
  avatar.removeEventListener = () => {}; avatar.isConnected = false; avatar.disconnectedCallback();
  assert.deepEqual(runtime.tracking.compose(avatar.pose).rotation, [0, 0, 0]); assert.equal(runtime.tracking.active, false);
  const restored = connect(); assert.deepEqual(restored.tracking.compose(avatar.pose).rotation, [0, 0, 0]); assert.equal(restored.tracking.active, false);
});
