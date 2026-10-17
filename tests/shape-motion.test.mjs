import { RenderEngine } from '../dist/src/runtime/render-engine.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { ShapeTimeline } from '../dist/src/core/shape-motion.js';
import { shapeContour } from '../dist/src/core/contours.js';
import { buildMorph } from '../dist/src/core/morph.js';
import { MATERIAL_SHAPE_NAMES } from '../dist/src/core/shapes.js';
import { createDesign, patchDesign } from '../dist/src/core/design.js';
import { SidekickAvatar } from '../dist/src/element/avatar.js';
import { bareAvatarFixture } from './helpers/render-runtime.mjs';

const catalogContour = name => shapeContour({ kind: 'material', name });
const snapshot = timeline => structuredClone(timeline.contour);
const exactTarget = (timeline, shape) => assert.deepEqual(timeline.contour, catalogContour(shape));

const avatarForTest = (connected = false) => bareAvatarFixture(SidekickAvatar, RenderEngine, connected);

test('shape timeline exposes a catalog name and immutable contour', () => {
  const timeline = new ShapeTimeline('pentagon');
  assert.equal(timeline.target, 'pentagon'); exactTarget(timeline, 'pentagon');
  assert.ok(Object.isFrozen(timeline.contour)); assert.ok(Object.isFrozen(timeline.contour.points));
  assert.ok(timeline.contour.points.every(point => Object.isFrozen(point)));
  for (const value of [{}, 'orb', 'rounded-box', 'droplet', { kind: 'material', name: 'heart' }, { kind: 'rounded-polygon', sides: 5, rounding: 0.3, rotation: 0 }]) assert.throws(() => new ShapeTimeline(value));
});

test('linear and smooth shape motion sample the matched direct contour', async () => {
  for (const easing of ['linear', 'smooth']) {
    const from = 'puffy', to = 'pixelTriangle';
    const timeline = new ShapeTimeline(from), initial = timeline.contour;
    const morph = buildMorph(initial, catalogContour(to));
    const done = timeline.to(to, { duration: 1000, easing });
    assert.strictEqual(timeline.contour, initial); assert.equal(timeline.active, true);
    timeline.advance(250);
    assert.deepEqual(timeline.contour, morph.sample(easing === 'linear' ? 0.25 : 0.15625));
    timeline.advance(750); assert.deepEqual(await done, { finished: true });
    exactTarget(timeline, to); assert.equal(timeline.active, false);
  }
});

test('interruptions preserve the exact visible contour and settle the old request', async () => {
  const timeline = new ShapeTimeline('puffy');
  const first = timeline.to('pixelTriangle', { duration: 1000, easing: 'linear' });
  timeline.advance(370); const visible = timeline.contour;
  const second = timeline.to('heart', { duration: 1000, easing: 'linear' });
  assert.deepEqual(await first, { finished: false }); assert.strictEqual(timeline.contour, visible);
  timeline.advance(0); assert.deepEqual(timeline.contour, visible);
  const expected = buildMorph(visible, catalogContour('heart'));
  timeline.advance(250); assert.deepEqual(timeline.contour, expected.sample(0.25));
  timeline.advance(750); assert.deepEqual(await second, { finished: true }); exactTarget(timeline, 'heart');
});

test('rapid repeated retargets retain visible geometry without nesting recipes', async () => {
  const timeline = new ShapeTimeline('circle'); const pending = [];
  const names = ['puffy', 'pixelTriangle', 'heart', 'flower', 'boom', 'arch', 'clover8Leaf'];
  for (let index = 0; index < 30; index++) {
    const before = snapshot(timeline), target = names[index % names.length];
    pending.push(timeline.to(target, { duration: 450 }));
    assert.deepEqual(timeline.contour, before); assert.deepEqual(timeline.target, target);
    timeline.advance(7);
  }
  timeline.finish();
  const results = await Promise.all(pending);
  assert.ok(results.slice(0, -1).every(result => result.finished === false));
  assert.deepEqual(results.at(-1), { finished: true }); assert.equal(timeline.active, false);
});

test('invalid shapes, options, baseline changes and deltas are atomic', async () => {
  const timeline = new ShapeTimeline('square');
  const done = timeline.to('heart', { duration: 1000 }); timeline.advance(250);
  const before = snapshot(timeline), target = timeline.target;
  const invalidShapes = [undefined, null, {}, '', 'orb', 'rounded-box', 'droplet', { kind: 'material', name: 'unknown' }, { kind: 'ellipse', typo: true }, { kind: 'material', name: 'heart' }, { kind: 'morph', from: { kind: 'material', name: 'circle' }, to: { kind: 'material', name: 'heart' }, progress: 0.5 }];
  for (const shape of invalidShapes) assert.throws(() => timeline.to(shape));
  for (const options of [null, [], new Date(), { duration: NaN }, { duration: Infinity }, { duration: null }, { duration: -1 }, { duration: 60001 }, { easing: 'elastic' }, { extra: true }, { [Symbol()]: 1 }]) assert.throws(() => timeline.to('circle', options));
  assert.throws(() => timeline.set('orb')); assert.throws(() => timeline.set({}));
  for (const delta of [-1, NaN, Infinity, 60001]) assert.throws(() => timeline.advance(delta));
  assert.equal(timeline.active, true); assert.deepEqual(timeline.contour, before); assert.deepEqual(timeline.target, target);
  timeline.advance(750); assert.deepEqual(await done, { finished: true });
});

test('zero duration, no-op, cancellation and resetting settle deterministically', async () => {
  const timeline = new ShapeTimeline('circle');
  assert.deepEqual(await timeline.to('circle'), { finished: true }); assert.equal(timeline.active, false);
  assert.throws(() => timeline.to('circle', { duration: -1 }));
  const first = timeline.to('puffy'); timeline.advance(90); const frozen = snapshot(timeline);
  timeline.cancel(); timeline.cancel(); timeline.advance(1000);
  assert.deepEqual(await first, { finished: false }); assert.deepEqual(timeline.contour, frozen);
  // A canceled target is not mistaken for an already-visible no-op.
  const retry = timeline.to('puffy'); assert.equal(timeline.active, true);
  const immediate = timeline.to('heart', { duration: 0 });
  assert.deepEqual(await retry, { finished: false }); assert.deepEqual(await immediate, { finished: true });
  exactTarget(timeline, 'heart'); assert.equal(timeline.active, false);
  const reset = timeline.to('flower'); timeline.set('square');
  assert.deepEqual(await reset, { finished: false }); exactTarget(timeline, 'square');
  timeline.finish(); timeline.advance(0); assert.equal(timeline.active, false);
});

test('selecting the same in-flight target retargets from its visible contour', async () => {
  const timeline = new ShapeTimeline('circle');
  const first = timeline.to('puffy'); timeline.advance(180); const visible = timeline.contour;
  const repeated = timeline.to('puffy', { duration: 250 });
  assert.strictEqual(timeline.contour, visible); assert.deepEqual(await first, { finished: false });
  assert.equal(timeline.active, true); timeline.advance(250);
  assert.deepEqual(await repeated, { finished: true }); exactTarget(timeline, 'puffy');
  const finished = timeline.contour;
  assert.deepEqual(await timeline.to('puffy'), { finished: true });
  assert.strictEqual(timeline.contour, finished); assert.equal(timeline.active, false);
});

test('all 35 Material catalog names are accepted and outline recipes are rejected', async () => {
  const timeline = new ShapeTimeline();
  for (const name of MATERIAL_SHAPE_NAMES) {
    assert.deepEqual(await timeline.to(name, { duration: 0 }), { finished: true }); exactTarget(timeline, name);
  }
  for (const shape of ['orb', 'rounded-box', 'droplet', { kind: 'ellipse' }, { kind: 'material', name: 'heart' }, { kind: 'rounded-polygon', sides: 7, rounding: 0.23, rotation: -0.8 }, { kind: 'morph', from: { kind: 'material', name: 'circle' }, to: { kind: 'material', name: 'heart' }, progress: 0.6 }]) assert.throws(() => timeline.to(shape));
});

test('setShape persists only the target shape immediately, while disconnected requests finish', async () => {
  const { avatar, events, connect } = avatarForTest();
  avatar.design = createDesign({ body: { color: '#abcdef' }, eyes: { left: { expression: 'smile' } } });
  const before = avatar.design;
  assert.deepEqual(await avatar.setShape('heart'), { finished: true });
  assert.equal(avatar.design.version, 7); assert.deepEqual(Object.keys(avatar.design.body).sort(), ['color', 'shape']);
  assert.deepEqual(avatar.design, patchDesign(before, { body: { shape: 'heart' } }));
  assert.equal(avatar.ready, false); assert.equal(avatar.requests.size, 0);
  assert.ok(events.some(event => event.type === 'sidekick-shape-end' && event.detail.finished));
  const after = avatar.design;
  for (const shape of [undefined, null, {}, 'orb', 'rounded-box', 'droplet', { kind: 'material', name: 'heart' }, { kind: 'ellipse' }, { kind: 'rounded-polygon', sides: 5, rounding: 0.2, rotation: 0 }]) assert.throws(() => avatar.setShape(shape));
  assert.throws(() => avatar.setShape('puffy', { duration: NaN }));
  assert.throws(() => avatar.setShape('puffy', { easing: 'invalid' })); assert.deepEqual(avatar.design, after);
  const runtime = connect();
  assert.equal(runtime.shape.active, false); exactTarget(runtime.shape, 'heart');
});

test('unrelated design and eye animation edits do not restart or cancel a shape transition', async () => {
  const { avatar, runtime } = avatarForTest(true);
  const pending = avatar.setShape('puffy', { duration: 1000, easing: 'linear' });
  runtime.advanceShape(230); const visible = snapshot(runtime.shape);
  assert.deepEqual(avatar.design.body.shape, 'puffy');
  avatar.design = patchDesign(avatar.design, { body: { color: '#112233' }, eyes: { right: { expression: 'smile' } } });
  assert.equal(runtime.shape.active, true); assert.deepEqual(runtime.shape.contour, visible);
  const expression = avatar.setExpression('left', 'blink', { duration: 100 });
  assert.deepEqual(runtime.shape.contour, visible); assert.equal(runtime.shape.active, true);
  runtime.advanceMotion(100); assert.deepEqual(await expression, { finished: true });
  runtime.advanceShape(770); assert.deepEqual(await pending, { finished: true });
  exactTarget(runtime.shape, 'puffy');
});

test('explicit design shape replacement is immediate and invalid replacement is atomic', async () => {
  const { avatar, runtime } = avatarForTest(true);
  const pending = avatar.setShape('flower', { duration: 1000 }); runtime.advanceShape(200);
  const before = snapshot(runtime.shape), design = avatar.design;
  assert.throws(() => { avatar.design = { ...design, body: { ...design.body, shape: {} } }; });
  assert.deepEqual(runtime.shape.contour, before); assert.equal(runtime.shape.active, true);
  await avatar.setDesign(patchDesign(avatar.design, { body: { shape: 'square' } }));
  assert.deepEqual(await pending, { finished: false }); exactTarget(runtime.shape, 'square');
  assert.equal(runtime.shape.active, false);
});

test('paused and reduced-motion changes finish shape targets and validate immediate requests', async () => {
  for (const reason of ['paused', 'reduced']) {
    const { avatar, runtime } = avatarForTest(true);
    const pending = avatar.setShape('heart'); runtime.advanceShape(100);
    if (reason === 'paused') avatar.paused = true;
    else { avatar.media = { matches: true }; avatar.onMotionPreference(); }
    assert.deepEqual(await pending, { finished: true }); exactTarget(runtime.shape, 'heart');
    assert.deepEqual(await avatar.setShape('puffy', { duration: 60000 }), { finished: true });
    assert.equal(runtime.shape.active, false); exactTarget(runtime.shape, 'puffy');
    const before = avatar.design;
    assert.throws(() => avatar.setShape('circle', { duration: -1 })); assert.deepEqual(avatar.design, before);
  }
});

test('shape frames run in still mode, preserve visibility suspension, then release RAF on completion', async () => {
  const { avatar, runtime, document } = avatarForTest(true);
  const done = avatar.setShape('heart', { duration: 100, easing: 'linear' });
  assert.equal(runtime.callbacks.size, 1); runtime.frame(10); runtime.frame(60); const visible = snapshot(runtime.shape);
  assert.equal(runtime.shape.active, true); assert.ok(runtime.draws.length > 1);
  document.hidden = true; avatar.onVisibility(); assert.equal(runtime.callbacks.size, 0);
  assert.deepEqual(runtime.shape.contour, visible);
  document.hidden = false; avatar.onVisibility(); runtime.frame(5000);
  assert.deepEqual(runtime.shape.contour, visible); runtime.frame(5050);
  assert.deepEqual(await done, { finished: true }); assert.equal(runtime.callbacks.size, 0); assert.equal(avatar.diagnostics.running, false);
  exactTarget(runtime.shape, 'heart');
});

test('a delayed active frame honors shape duration without changing spring timing', async () => {
  const { avatar, runtime } = avatarForTest(true);
  const done = avatar.setShape('flower', { duration: 450 });
  runtime.frame(20); runtime.frame(520);
  assert.deepEqual(await done, { finished: true }); assert.equal(runtime.callbacks.size, 0);
  exactTarget(runtime.shape, 'flower');
  assert.equal(avatar.diagnostics.time, 0.05);
});

test('shape requests complete immediately while a connected renderer is unavailable', async () => {
  const { avatar, connect } = avatarForTest(); avatar.isConnected = true; avatar.readyState = false;
  assert.deepEqual(await avatar.setShape('heart'), { finished: true });
  assert.equal(avatar.ready, false); assert.equal(avatar.requests.size, 0);
  const before = avatar.design;
  assert.throws(() => avatar.setShape('circle', { duration: NaN })); assert.deepEqual(avatar.design, before);
  const runtime = connect();
  assert.equal(runtime.shape.active, false); exactTarget(runtime.shape, 'heart');
});

test('detach and context loss cancel shape requests and restore the persisted target baseline', async () => {
  for (const reason of ['disconnect', 'context']) {
    const { avatar, runtime, connect } = avatarForTest(true);
    const pending = avatar.setShape('puffy'); runtime.advanceShape(120);
    assert.notDeepEqual(runtime.shape.contour, catalogContour('puffy'));
    if (reason === 'disconnect') { avatar.isConnected = false; avatar.disconnectedCallback(); }
    else runtime.renderer.canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    assert.deepEqual(await pending, { finished: false }); assert.equal(runtime.renderer.disposals, 1);
    assert.equal(avatar.ready, false); assert.equal(runtime.shape.active, false); assert.equal(runtime.callbacks.size, 0);
    assert.equal(avatar.design.body.shape, 'puffy');
    const restoredRuntime = connect();
    exactTarget(restoredRuntime.shape, 'puffy');
    const restored = avatar.setShape('heart', { duration: 100, easing: 'linear' });
    assert.deepEqual(restoredRuntime.shape.contour, catalogContour('puffy'));
    restoredRuntime.advanceShape(50);
    assert.deepEqual(restoredRuntime.shape.contour, buildMorph(catalogContour('puffy'), catalogContour('heart')).sample(.5));
    restoredRuntime.advanceShape(50); assert.deepEqual(await restored, { finished: true });
    exactTarget(restoredRuntime.shape, 'heart');
  }
});

test('legacy 3d input normalizes to flat without altering design or shape motion', async () => {
  const { avatar, runtime } = avatarForTest(true);
  const pending = avatar.setShape('heart'); runtime.advanceShape(90);
  const visible = snapshot(runtime.shape), design = avatar.design;
  avatar.setAttribute('render-style', '3d'); assert.equal(avatar.renderStyle, 'flat'); assert.equal(avatar.getAttribute('render-style'), 'flat');
  avatar.renderStyle = '3d'; assert.equal(avatar.renderStyle, 'flat'); assert.equal(avatar.getAttribute('render-style'), 'flat');
  assert.deepEqual(avatar.design, design); assert.deepEqual(runtime.shape.contour, visible); assert.equal(runtime.shape.active, true);
  assert.throws(() => { avatar.renderStyle = 'wireframe'; });
  runtime.finishShape(); await pending;
});
