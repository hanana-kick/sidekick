import { RenderEngine } from '../dist/src/runtime/render-engine.js';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createAccessory, createDesign } from '../dist/src/core/design.js';
import { parseBooleanAttribute, resolveSidekickAttributes, SIDEKICK_ATTRIBUTES } from '../dist/src/element/attributes.js';
import { installRuntime } from './helpers/render-runtime.mjs';
const runtimes = new WeakMap();

const resolve = values => resolveSidekickAttributes(new Map(Object.entries(values)));
let dom, SidekickAvatar;
before(async () => {
  dom = new JSDOM('<!doctype html><body></body>', { pretendToBeVisual: true });
  for (const name of ['window', 'document', 'HTMLElement', 'CustomEvent', 'customElements']) globalThis[name] = dom.window[name];
  globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  globalThis.ResizeObserver = class { observe() {} disconnect() {} };
  globalThis.IntersectionObserver = class { observe() {} disconnect() {} };
  globalThis.devicePixelRatio = 1;
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = () => {};
  ({ SidekickAvatar } = await import('../dist/src/element/avatar.js'));
  SidekickAvatar.prototype.initializeRenderer = function () {
    runtimes.set(this, installRuntime(this, RenderEngine));
    this.emit('sidekick-ready', {});
  };
  customElements.define('sidekick-avatar', SidekickAvatar);
});
after(() => { dom.window.close(); });
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
function avatar(t, connected = true) {
  const a = document.createElement('sidekick-avatar');
  a.getBoundingClientRect = () => ({ left: 10, top: 20, width: 200, height: 100 });
  if (connected) document.body.append(a);
  t.after(() => a.remove());
  return a;
}
function pointer(x, y, pointerType = 'mouse') {
  const event = new dom.window.MouseEvent('pointermove', { clientX: x, clientY: y, bubbles: true });
  Object.defineProperty(event, 'pointerType', { value: pointerType });
  document.dispatchEvent(event);
  for (const a of document.querySelectorAll('sidekick-avatar')) a.flushInput();
}

test('the boolean contract accepts explicit false and rejects ambiguous spellings', () => {
  for (const text of ['', 'true', '1']) assert.equal(parseBooleanAttribute(text), true);
  for (const text of [null, 'false', '0']) assert.equal(parseBooleanAttribute(text), false);
  for (const text of ['yes', 'off', 'FALSE', ' ', 'null']) assert.throws(() => parseBooleanAttribute(text));
  assert.equal(resolve({}).mouseTracking, false);
  assert.equal(new Set(SIDEKICK_ATTRIBUTES).size, SIDEKICK_ATTRIBUTES.length);
});

test('all design sources resolve independently of attribute order and without caller mutation', () => {
  const design = createDesign({ body: { shape: 'circle', color: '#112233' }, eyes: { left: { weights: { smile: .1, blink: .2 } } }, accessories: [createAccessory('halo')] });
  const attributes = { design: JSON.stringify(design), shape: 'heart', 'body-color': '#ABCDEF', expression: 'smile', 'left-expression': 'blink', smile: '.4', 'left-blink': '.6', accessories: JSON.stringify([createAccessory('glasses')]), 'head-accessory': 'beret', 'head-color': '#123456', camera: 'side', 'camera-yaw': '20' };
  const a = resolve(attributes), b = resolve(Object.fromEntries(Object.entries(attributes).reverse()));
  assert.deepEqual(a, b);
  assert.deepEqual(a.design.body, { shape: 'heart', color: '#abcdef' });
  assert.deepEqual(a.design.eyes.left.weights, { smile: .4, blink: .6 });
  assert.deepEqual(a.design.eyes.right.weights, { smile: .4, blink: 0 });
  assert.deepEqual(a.design.accessories.map(x => [x.slot, x.preset, x.color]), [['eyes', 'glasses', '#31323d'], ['head', 'beret', '#123456']]);
  assert.deepEqual(a.camera, { yaw: 20, pitch: 0, roll: 0, zoom: 1 });
  assert.equal(design.body.shape, 'circle');
});

test('attribute parsing rejects malformed numbers, colors, JSON, slots, expressions and timing', () => {
  for (const attrs of [
    { shape: 'orb' }, { 'body-color': 'red' }, { 'eye-color': '#fff' }, { 'left-smile': '1.1' },
    { 'camera-yaw': '' }, { 'camera-pitch': '91' }, { 'gaze-x': 'NaN' }, { time: '0x10' },
    { 'shape-duration': '20ms' }, { 'motion-duration': '-1' }, { 'shape-easing': 'ease' },
    { 'head-accessory': 'earring' }, { accessories: '{}' }, { design: '{' }, { motion: '{"body":{"rotation":[0,0,99]}}' },
    { 'head-color': '#ff' }, { expression: 'happy' }, { paused: 'yes' }, { interaction: 'orbit' }, { activity: 'dance' },
  ]) assert.throws(() => resolve(attrs), Object.keys(attrs)[0]);
});

test('raw attribute updates are a single atomic transaction and repairing it retries every field', async t => {
  const a = avatar(t), errors = []; a.addEventListener('sidekick-error', e => errors.push(e.detail));
  const before = a.design;
  a.setAttribute('shape', 'heart'); a.setAttribute('body-color', 'invalid'); a.setAttribute('camera-yaw', '30');
  await flush(); assert.deepEqual(a.design, before); assert.equal(a.camera.yaw, 0); assert.equal(errors.length, 1); assert.equal(errors[0].attribute, 'body-color');
  assert.equal(a.getAttribute('shape'), 'heart');
  a.setAttribute('body-color', '#123456'); await flush();
  assert.equal(a.design.body.shape, 'heart'); assert.equal(a.design.body.color, '#123456'); assert.equal(a.camera.yaw, 30);
});

test('removing scalar overrides reveals JSON/default while preserving unrelated imperative state', async t => {
  const a = avatar(t); a.paused = true;
  a.setAttribute('design', JSON.stringify(createDesign({ body: { shape: 'circle', color: '#123456' } })));
  a.setAttribute('shape', 'heart'); await flush(); assert.equal(a.design.body.shape, 'heart');
  a.removeAttribute('shape'); await flush(); assert.equal(a.design.body.shape, 'circle');
  await a.updateDesign({ eyes: { color: '#654321' } }); a.setCamera({ roll: 10 });
  a.setAttribute('body-color', '#abcdef'); await flush(); assert.equal(a.design.eyes.color, '#654321'); assert.equal(a.camera.roll, 10);
  a.removeAttribute('body-color'); await flush(); assert.equal(a.design.body.color, '#123456');
  a.removeAttribute('design'); await flush(); assert.deepEqual(a.design, createDesign());
});

test('slot color changes affect imperative equipment without removing it or replacing other slots', async t => {
  const a = avatar(t); a.design = createDesign({ accessories: [createAccessory('beret'), createAccessory('glasses')] });
  a.setAttribute('head-color', '#abcdef'); await flush();
  assert.equal(a.design.accessories.length, 2); assert.equal(a.design.accessories[0].color, '#abcdef');
  a.removeAttribute('head-color'); await flush(); assert.equal(a.design.accessories[0].color, createAccessory('beret').color);
  a.setAttribute('head-accessory', 'none'); await flush(); assert.deepEqual(a.design.accessories.map(x => x.preset), ['glasses']);
});

test('paused, activity, interaction and tracking properties remain synchronous', t => {
  const a = avatar(t); a.paused = true; assert.equal(a.paused, true);
  a.paused = false; assert.equal(a.paused, false);
  a.setActivity('still'); assert.equal(a.activity, 'still');
  a.interaction = 'box'; assert.equal(a.interaction, 'box'); assert.equal(a.getAttribute('role'), 'button');
  a.mouseTracking = true; assert.equal(a.mouseTracking, true); a.mouseTracking = false; assert.equal(a.mouseTracking, false);
  assert.throws(() => { a.mouseTracking = 'false'; });
});

test('false and removal disable booleans; invalid text leaves prior runtime state', async t => {
  const a = avatar(t); a.setAttribute('paused', 'false'); a.setAttribute('mouse-tracking', '0'); await flush();
  assert.equal(a.paused, false); assert.equal(a.mouseTracking, false);
  a.setAttribute('paused', ''); a.setAttribute('mouse-tracking', 'true'); await flush(); assert.equal(a.paused, true); assert.equal(a.mouseTracking, true);
  a.setAttribute('paused', 'maybe'); a.setAttribute('mouse-tracking', 'false'); await flush(); assert.equal(a.paused, true); assert.equal(a.mouseTracking, true);
  a.removeAttribute('paused'); await flush(); assert.equal(a.paused, false); assert.equal(a.mouseTracking, false);
});

test('shape timing changes affect the next target and unrelated edits keep running clocks', async t => {
  const a = avatar(t); a.setActivity('still');
  a.setAttribute('shape-duration', '1000'); a.setAttribute('shape-easing', 'linear'); a.setAttribute('shape', 'heart'); await flush();
  assert.equal(runtimes.get(a).shape.remainingDuration, 1000); assert.equal(runtimes.get(a).shape.easing, 'linear');
  runtimes.get(a).advanceShape(250); const contour = runtimes.get(a).shape.contour;
  const motion = a.motion.to({ body: { rotation: [0, 0, .8] } }, { duration: 1000 }); runtimes.get(a).advanceMotion(250);
  const pose = a.pose;
  a.setAttribute('eye-color', '#abcdef'); a.setAttribute('shape-duration', '50'); await flush();
  assert.strictEqual(runtimes.get(a).shape.contour, contour); assert.equal(runtimes.get(a).shape.remainingDuration, 750); assert.deepEqual(a.pose, pose);
  a.setAttribute('shape', 'circle'); await flush(); assert.equal(runtimes.get(a).shape.remainingDuration, 50);
  runtimes.get(a).advanceMotion(750); assert.deepEqual(await motion, { finished: true });
});

test('motion JSON validates new equipment IDs before changing design or motion tracks', async t => {
  const a = avatar(t); a.paused = true; const before = a.design;
  a.setAttribute('shape', 'heart'); a.setAttribute('motion', JSON.stringify({ accessories: { missing: { rotation: [0, 0, .3] } } })); await flush();
  assert.deepEqual(a.design, before);
  a.setAttribute('accessories', JSON.stringify([createAccessory('beret', 'missing')])); await flush();
  assert.equal(a.design.body.shape, 'heart'); assert.deepEqual(a.pose.accessories.missing, [0, 0, .3]);
  a.removeAttribute('motion'); await flush(); assert.deepEqual(a.pose.accessories.missing, [0, 0, 0]);
});

test('global mouse tracking ignores touch/drag and restores manual gaze without canceling motion', async t => {
  const a = avatar(t); a.paused = true; a.lookAt({ space: 'view', x: .2, y: -.3 }); a.mouseTracking = true;
  pointer(210, 20); assert.deepEqual(a.pose.gaze, [1, 1]); assert.equal(a.interaction, 'none');
  pointer(10, 120, 'touch'); assert.deepEqual(a.pose.gaze, [1, 1]);
  a.pointers.set(7, { x: 0, y: 0, type: 'mouse' }); pointer(10, 120); assert.deepEqual(a.pose.gaze, [1, 1]); a.pointers.clear();
  a.mouseTracking = false; assert.deepEqual(a.pose.gaze, [.2, -.3]); pointer(10, 120); assert.deepEqual(a.pose.gaze, [.2, -.3]);
  a.paused = false; const motion = a.motion.to({ body: { rotation: [0, 0, 1] } }, { duration: 1000 }); runtimes.get(a).advanceMotion(250); const rotation = a.pose.rotation;
  a.mouseTracking = true; pointer(210, 20); a.mouseTracking = false;
  assert.deepEqual(a.pose.rotation, rotation); runtimes.get(a).advanceMotion(750); assert.deepEqual(await motion, { finished: true });
});

test('tracking listeners detach exactly once across disabled, hidden and reconnect cycles', t => {
  const a = avatar(t); a.paused = true;
  const added = new Set(), originalAdd = document.addEventListener.bind(document), originalRemove = document.removeEventListener.bind(document);
  document.addEventListener = (name, listener, ...rest) => { if (name === 'pointermove') { assert.equal(added.has(listener), false); added.add(listener); } return originalAdd(name, listener, ...rest); };
  document.removeEventListener = (name, listener, ...rest) => { if (name === 'pointermove') added.delete(listener); return originalRemove(name, listener, ...rest); };
  t.after(() => { a.remove(); document.addEventListener = originalAdd; document.removeEventListener = originalRemove; });
  a.mouseTracking = true; assert.equal(added.size, 1); a.mouseTracking = true; assert.equal(added.size, 1);
  a.visible = false; a.updateMouseTracking(); assert.equal(added.size, 0);
  a.visible = true; a.updateMouseTracking(); assert.equal(added.size, 1);
  a.remove(); assert.equal(added.size, 0); document.body.append(a); assert.equal(added.size, 1);
  a.mouseTracking = false; assert.equal(added.size, 0);
});

test('pre-registration own properties replay through setters and do not shadow future updates', t => {
  const a = document.createElement('pending-sidekick');
  a.design = createDesign({ body: { shape: 'heart' } }); a.mouseTracking = true; a.paused = true;
  document.body.append(a); t.after(() => a.remove());
  customElements.define('pending-sidekick', class extends SidekickAvatar {});
  assert.equal(a.design.body.shape, 'heart'); assert.equal(a.mouseTracking, true); assert.equal(a.paused, true);
  assert.equal(Object.hasOwn(a, 'design'), false); assert.equal(Object.hasOwn(a, 'mouseTracking'), false);
  a.mouseTracking = false; assert.equal(a.mouseTracking, false);
});

test('explicit neutral weights retarget a transient eye without canceling the opposite eye', async t => {
  const a = avatar(t); a.setActivity('still');
  const left = a.motion.to({ eyes: { left: { weights: { smile: 1 } } } }, { duration: 1000 });
  const right = a.motion.to({ eyes: { right: { weights: { smile: 1 } } } }, { duration: 1000 });
  runtimes.get(a).advanceMotion(200); const rightPose = a.pose.eyes.right;
  a.setAttribute('motion-duration', '0'); a.setAttribute('left-smile', '0'); await flush();
  assert.deepEqual(await left, { finished: false }); assert.equal(a.pose.eyes.left.smile, 0); assert.deepEqual(a.pose.eyes.right, rightPose);
  runtimes.get(a).advanceMotion(800); assert.deepEqual(await right, { finished: true });
});

test('imperative setters remain reliable while an unrelated invalid HTML batch is pending', async t => {
  const a = avatar(t); a.setAttribute('design', '{'); a.setAttribute('shape', 'heart'); await flush();
  a.paused = true; assert.equal(a.paused, true);
  a.mouseTracking = true; assert.equal(a.mouseTracking, true);
  a.interaction = 'box'; assert.equal(a.interaction, 'box');
  a.setActivity('still'); assert.equal(a.activity, 'still');
  await flush(); assert.equal(a.paused, true); assert.equal(a.design.body.shape, 'square');
  a.removeAttribute('design'); await flush(); assert.equal(a.design.body.shape, 'heart'); assert.equal(a.paused, true);
});

test('camera zoom precedence, removal, range validation and rejected batches are atomic', async t => {
  const a = avatar(t);
  a.setAttribute('camera', 'side'); a.setAttribute('camera-zoom', '1.7'); await flush();
  assert.deepEqual(a.camera, { yaw: 90, pitch: 0, roll: 0, zoom: 1.7 });
  a.setCamera({ yaw: 22 }); a.removeAttribute('camera-zoom'); await flush();
  assert.deepEqual(a.camera, { yaw: 22, pitch: 0, roll: 0, zoom: 1 });
  const before = a.camera, design = a.design;
  a.setAttribute('camera-zoom', '4'); a.setAttribute('camera-yaw', '13'); a.setAttribute('body-color', '#abcdef'); await flush();
  assert.deepEqual(a.camera, before); assert.deepEqual(a.design, design);
  a.setAttribute('camera-zoom', '2'); await flush();
  assert.equal(a.camera.zoom, 2); assert.equal(a.camera.yaw, 13); assert.equal(a.design.body.color, '#abcdef');
  a.removeAttribute('camera'); a.removeAttribute('camera-zoom'); a.removeAttribute('camera-yaw'); await flush();
  assert.deepEqual(a.camera, { yaw: 0, pitch: 0, roll: 0, zoom: 1 });
});

test('movement attributes are transactional and independent of renderer pose', async t => {
  const a = avatar(t), before = a.camera;
  a.setAttribute('placement', 'viewport'); a.setAttribute('position-x', '25'); a.setAttribute('position-y', '35');
  await flush();
  assert.equal(a.placement, 'viewport'); assert.deepEqual(a.position, { x: 25, y: 35 }); assert.deepEqual(a.camera, before);
  assert.equal(a.style.getPropertyValue('--sidekick-position'), 'fixed');
  a.setAttribute('position-x', 'bad'); a.setAttribute('position-y', '60'); await flush();
  assert.deepEqual(a.position, { x: 25, y: 35 });
  a.setAttribute('position-x', '50'); await flush(); assert.deepEqual(a.position, { x: 50, y: 60 });
  a.placement = 'inline'; await a.moveTo({ x: -40, y: 2000 }, { duration: 0 }); assert.deepEqual(a.position, { x: -40, y: 2000 });
});

test('viewport movement clamps the full element box without changing canvas resolution', async t => {
  const a = avatar(t); Object.defineProperty(a, 'offsetWidth', { value: 200 }); Object.defineProperty(a, 'offsetHeight', { value: 200 });
  a.placement = 'viewport'; const canvas = a.shadowRoot.querySelector('canvas'); const size = [canvas.width, canvas.height];
  const result = await a.moveTo({ x: 2000, y: 2000 }, { duration: 0 });
  assert.deepEqual(result.position, { x: window.innerWidth - 200, y: window.innerHeight - 200 });
  assert.deepEqual([canvas.width, canvas.height], size);
  a.movementBounds = 'none'; await a.moveTo({ x: -10, y: -30 }, { duration: 0 }); assert.deepEqual(a.position, { x: -10, y: -30 });
});

test('default body color remains FFCC37 across core attributes and fresh elements', t => {
  assert.equal(createDesign().body.color, '#ffcc37'); assert.equal(resolve({}).design.body.color, '#ffcc37');
  const a = avatar(t); assert.equal(a.design.body.color, '#ffcc37');
  a.setAttribute('body-color', '#123456'); a.flushAttributes(); assert.equal(a.design.body.color, '#123456');
  a.removeAttribute('body-color'); a.flushAttributes(); assert.equal(a.design.body.color, '#ffcc37');
});

test('play and transition methods settle on disconnect without changing camera', async t => {
  const a = avatar(t), camera = a.camera;
  const playing = a.play('speaking'); assert.equal(a.activity, 'speaking');
  a.stop(); assert.deepEqual(await playing, { finished: false }); assert.equal(a.activity, 'idle');
  const transition = a.transitionTo({ shape: 'heart', expression: 'smile' }, { duration: 200 });
  a.remove(); assert.deepEqual(await transition, { finished: false }); assert.deepEqual(a.camera, camera);
});

test('disconnect marks the host inactive before cancellation listeners can restart playback', async t => {
  const a = avatar(t), playing = a.play('speaking'); let restarted;
  a.addEventListener('sidekick-play-end', () => { restarted = a.play('celebrating'); }, { once: true });
  a.remove();
  assert.deepEqual(await playing, { finished: false }); assert.deepEqual(await restarted, { finished: false });
});

test('moving the host recalculates gaze toward a stationary mouse without changing camera', async t => {
  const a = avatar(t); a.mouseTracking = true;
  a.getBoundingClientRect = () => ({ left: a.position.x, top: 0, width: 200, height: 200 });
  pointer(100, 100); assert.deepEqual(a.gazeTarget, [0, 0]); const camera = a.camera;
  await a.moveTo({ x: 100, y: 0 }, { duration: 0 }); a.flushInput();
  assert.deepEqual(a.gazeTarget, [-1, 0]); assert.deepEqual(a.camera, camera);
  a.resetTracking(); await a.moveTo({ x: 0, y: 0 }, { duration: 0 }); a.flushInput(); assert.deepEqual(a.gazeTarget, [0, 0]);
});

test('movement bounds reuse resize-cached box dimensions instead of per-frame layout reads', async t => {
  const a = avatar(t); let reads = 0;
  Object.defineProperty(a, 'offsetWidth', { get() { reads++; return 200; } });
  Object.defineProperty(a, 'offsetHeight', { get() { reads++; return 200; } });
  a.placement = 'viewport'; reads = 0;
  await a.moveTo({ x: 10, y: 20 }, { duration: 0 });
  await a.moveTo({ x: 30, y: 40 }, { duration: 0 });
  assert.equal(reads, 0);
});

test('physical movement HTML attributes resolve strictly and preserve omitted maximum-speed hints', () => {
  const options = resolve({ 'move-duration': '1200', 'move-travel': 'natural', 'move-max-speed': '320', 'move-acceleration': '900', 'move-deceleration': '1200' }).moveOptions;
  assert.deepEqual(options, { duration: 1200, easing: 'smooth', travel: 'natural', maxSpeed: 320, acceleration: 900, deceleration: 1200 });
  assert.equal(resolve({}).moveOptions.maxSpeed, undefined);
  for (const attribute of ['move-max-speed', 'move-acceleration', 'move-deceleration']) {
    assert.ok(SIDEKICK_ATTRIBUTES.includes(attribute));
    for (const value of ['', 'NaN', 'Infinity', '0', '0.5', '-1', '100001', '10px']) assert.throws(() => resolve({ [attribute]: value }), `${attribute}=${value}`);
    for (const value of ['1', '100000']) assert.equal(resolve({ [attribute]: value }).moveOptions[{ 'move-max-speed': 'maxSpeed', 'move-acceleration': 'acceleration', 'move-deceleration': 'deceleration' }[attribute]], Number(value));
  }
});

test('invalid physical attributes keep a batched position change atomic until repaired', async t => {
  const a = avatar(t); const errors = []; a.addEventListener('sidekick-error', e => errors.push(e.detail));
  await a.moveTo({ x: 20, y: 30 }, { duration: 0 });
  a.setAttribute('position-x', '100'); a.setAttribute('move-acceleration', '-1'); await flush();
  assert.deepEqual(a.position, { x: 20, y: 30 }); assert.equal(errors.length, 1);
  a.setAttribute('move-acceleration', '900'); await flush(); assert.deepEqual(a.position, { x: 100, y: 30 });
});
