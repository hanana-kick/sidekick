import test from 'node:test';
import assert from 'node:assert/strict';
import { ShapeTimeline } from '../dist/src/core/shape-motion.js';
import { shapeContour } from '../dist/src/core/contours.js';
import { buildMorph } from '../dist/src/core/morph.js';
import { MATERIAL_SHAPE_NAMES } from '../dist/src/core/shapes.js';
import { createDesign, patchDesign } from '../dist/src/core/design.js';
import { SidekickAvatar } from '../dist/src/element/avatar.js';

const catalogContour = name => shapeContour({ kind: 'material', name });
const snapshot = timeline => structuredClone(timeline.contour);
const exactTarget = (timeline, shape) => assert.deepEqual(timeline.contour, catalogContour(shape));

function avatarForTest(connected = false) {
  const avatar = new SidekickAvatar(), attributes = new Map(), events = [];
  avatar.isConnected = connected;
  avatar.hasAttribute = name => attributes.has(name);
  avatar.getAttribute = name => attributes.get(name) ?? null;
  avatar.setAttribute = (name, value) => {
    const old = attributes.get(name) ?? null; attributes.set(name, String(value));
    if (SidekickAvatar.observedAttributes.includes(name)) avatar.attributeChangedCallback(name, old, String(value));
  };
  avatar.toggleAttribute = (name, value) => {
    const old = attributes.get(name) ?? null;
    if (value) attributes.set(name, ''); else attributes.delete(name);
    avatar.attributeChangedCallback(name, old, value ? '' : null);
  };
  avatar.dispatchEvent = event => { events.push(event); return true; };
  avatar.removeEventListener = () => {};
  return { avatar, attributes, events };
}

function withFrameEnvironment(work) {
  const previous = { document: globalThis.document, requestAnimationFrame: globalThis.requestAnimationFrame, cancelAnimationFrame: globalThis.cancelAnimationFrame };
  const queue = new Map(); let next = 1;
  globalThis.document = { hidden: false, removeEventListener() {} };
  globalThis.requestAnimationFrame = callback => { const id = next++; queue.set(id, callback); return id; };
  globalThis.cancelAnimationFrame = id => { queue.delete(id); };
  const frame = time => { const pending = [...queue.values()]; queue.clear(); for (const callback of pending) callback(time); };
  return Promise.resolve().then(() => work({ queue, frame })).finally(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
  });
}

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
  const { avatar, events } = avatarForTest();
  avatar.design = createDesign({ body: { color: '#abcdef' }, eyes: { left: { expression: 'smile' } } });
  const before = avatar.design;
  assert.deepEqual(await avatar.setShape('heart'), { finished: true });
  assert.equal(avatar.design.version, 7); assert.deepEqual(Object.keys(avatar.design.body).sort(), ['color', 'shape']);
  assert.deepEqual(avatar.design, patchDesign(before, { body: { shape: 'heart' } }));
  assert.equal(avatar.shapeTimeline.active, false); exactTarget(avatar.shapeTimeline, 'heart');
  assert.ok(events.some(event => event.type === 'sidekick-shape-end' && event.detail.finished));
  const after = avatar.design;
  for (const shape of [undefined, null, {}, 'orb', 'rounded-box', 'droplet', { kind: 'material', name: 'heart' }, { kind: 'ellipse' }, { kind: 'rounded-polygon', sides: 5, rounding: 0.2, rotation: 0 }]) assert.throws(() => avatar.setShape(shape));
  assert.throws(() => avatar.setShape('puffy', { duration: NaN }));
  assert.throws(() => avatar.setShape('puffy', { easing: 'invalid' })); assert.deepEqual(avatar.design, after);
});

test('unrelated design and eye animation edits do not restart or cancel a shape transition', async () => {
  const { avatar } = avatarForTest(true);
  const pending = avatar.setShape('puffy', { duration: 1000, easing: 'linear' });
  avatar.shapeTimeline.advance(230); const visible = snapshot(avatar.shapeTimeline);
  assert.deepEqual(avatar.design.body.shape, 'puffy');
  avatar.design = patchDesign(avatar.design, { body: { color: '#112233' }, eyes: { right: { expression: 'smile' } } });
  assert.equal(avatar.shapeTimeline.active, true); assert.deepEqual(avatar.shapeTimeline.contour, visible);
  const expression = avatar.setExpression('left', 'blink', { duration: 100 });
  assert.deepEqual(avatar.shapeTimeline.contour, visible); assert.equal(avatar.shapeTimeline.active, true);
  avatar.timeline.advance(100); assert.deepEqual(await expression, { finished: true });
  avatar.shapeTimeline.advance(770); assert.deepEqual(await pending, { finished: true });
  exactTarget(avatar.shapeTimeline, 'puffy');
});

test('explicit design shape replacement is immediate and invalid replacement is atomic', async () => {
  const { avatar } = avatarForTest(true);
  const pending = avatar.setShape('flower', { duration: 1000 }); avatar.shapeTimeline.advance(200);
  const before = snapshot(avatar.shapeTimeline), design = avatar.design;
  assert.throws(() => { avatar.design = { ...design, body: { ...design.body, shape: {} } }; });
  assert.deepEqual(avatar.shapeTimeline.contour, before); assert.equal(avatar.shapeTimeline.active, true);
  await avatar.setDesign(patchDesign(avatar.design, { body: { shape: 'square' } }));
  assert.deepEqual(await pending, { finished: false }); exactTarget(avatar.shapeTimeline, 'square');
  assert.equal(avatar.shapeTimeline.active, false);
});

test('paused and reduced-motion changes finish shape targets and validate immediate requests', async () => {
  for (const reason of ['paused', 'reduced']) {
    const { avatar } = avatarForTest(true);
    const pending = avatar.setShape('heart'); avatar.shapeTimeline.advance(100);
    if (reason === 'paused') avatar.paused = true;
    else { avatar.media = { matches: true }; avatar.onMotionPreference(); }
    assert.deepEqual(await pending, { finished: true }); exactTarget(avatar.shapeTimeline, 'heart');
    assert.deepEqual(await avatar.setShape('puffy', { duration: 60000 }), { finished: true });
    assert.equal(avatar.shapeTimeline.active, false); exactTarget(avatar.shapeTimeline, 'puffy');
    const before = avatar.design;
    assert.throws(() => avatar.setShape('circle', { duration: -1 })); assert.deepEqual(avatar.design, before);
  }
});

test('shape frames run in still mode, preserve visibility suspension, then release RAF on completion', async () => {
  await withFrameEnvironment(async ({ queue, frame }) => {
    const { avatar } = avatarForTest(true); const rendered = [];
    avatar.readyState = true; avatar.currentActivity = 'still';
    avatar.renderer = { render: (_, state) => rendered.push(state.contour) };
    const done = avatar.setShape('heart', { duration: 100, easing: 'linear' });
    assert.equal(queue.size, 1); frame(10); frame(60); const visible = snapshot(avatar.shapeTimeline);
    assert.equal(avatar.shapeTimeline.active, true); assert.ok(rendered.length > 1);
    document.hidden = true; avatar.onVisibility(); assert.equal(queue.size, 0);
    assert.deepEqual(avatar.shapeTimeline.contour, visible);
    document.hidden = false; avatar.onVisibility(); frame(5000);
    assert.deepEqual(avatar.shapeTimeline.contour, visible); frame(5050);
    assert.deepEqual(await done, { finished: true }); assert.equal(queue.size, 0); assert.equal(avatar.raf, 0);
    exactTarget(avatar.shapeTimeline, 'heart');
  });
});

test('a delayed active frame honors shape duration without changing spring timing', async () => {
  await withFrameEnvironment(async ({ queue, frame }) => {
    const { avatar } = avatarForTest(true);
    avatar.readyState = true; avatar.currentActivity = 'still'; avatar.renderer = { render() {} };
    const done = avatar.setShape('flower', { duration: 450 });
    frame(20); frame(520);
    assert.deepEqual(await done, { finished: true }); assert.equal(queue.size, 0);
    exactTarget(avatar.shapeTimeline, 'flower');
    assert.equal(avatar.elapsed, 0.05);
  });
});

test('shape requests complete immediately while a connected renderer is unavailable', async () => {
  const { avatar } = avatarForTest(true); avatar.canvas = {}; avatar.readyState = false;
  assert.deepEqual(await avatar.setShape('heart'), { finished: true });
  assert.equal(avatar.shapeTimeline.active, false); exactTarget(avatar.shapeTimeline, 'heart');
  const before = avatar.design;
  assert.throws(() => avatar.setShape('circle', { duration: NaN })); assert.deepEqual(avatar.design, before);
});

test('detach and context loss cancel shape requests and restore the persisted target baseline', async () => {
  await withFrameEnvironment(async () => {
    for (const reason of ['disconnect', 'context']) {
      const { avatar } = avatarForTest(true);
      const pending = avatar.setShape('puffy'); avatar.shapeTimeline.advance(120);
      avatar.fallback = { textContent: '', hidden: true };
      let disposed = false;
      avatar.renderer = { dispose() { disposed = true; } };
      if (reason === 'disconnect') { avatar.isConnected = false; avatar.disconnectedCallback(); }
      else avatar.onContextLost(new Event('webglcontextlost', { cancelable: true }));
      assert.deepEqual(await pending, { finished: false }); assert.equal(disposed, true);
      assert.equal(avatar.ready, false); assert.equal(avatar.shapeTimeline.active, false);
      exactTarget(avatar.shapeTimeline, 'puffy');
      avatar.isConnected = true;
      const restored = avatar.setShape('heart', { duration: 100 });
      assert.deepEqual(avatar.shapeTimeline.contour, catalogContour('puffy'));
      avatar.shapeTimeline.finish(); assert.deepEqual(await restored, { finished: true });
      exactTarget(avatar.shapeTimeline, 'heart');
    }
  });
});

test('legacy 3d input normalizes to flat without altering design or shape motion', async () => {
  const { avatar } = avatarForTest(true);
  const pending = avatar.setShape('heart'); avatar.shapeTimeline.advance(90);
  const visible = snapshot(avatar.shapeTimeline), design = avatar.design;
  avatar.setAttribute('render-style', '3d'); assert.equal(avatar.renderStyle, 'flat'); assert.equal(avatar.getAttribute('render-style'), 'flat');
  avatar.renderStyle = '3d'; assert.equal(avatar.renderStyle, 'flat'); assert.equal(avatar.getAttribute('render-style'), 'flat');
  assert.deepEqual(avatar.design, design); assert.deepEqual(avatar.shapeTimeline.contour, visible); assert.equal(avatar.shapeTimeline.active, true);
  assert.throws(() => { avatar.renderStyle = 'wireframe'; });
  avatar.shapeTimeline.finish(); await pending;
});
