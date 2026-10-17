import test from 'node:test';
import assert from 'node:assert/strict';
import { createDesign, createAccessory, parseDesign, patchDesign, serializeDesign, ACCESSORY_PRESETS } from '../dist/src/core/design.js';
import { bodyPoint, bodyNormal, sampleSurface } from '../dist/src/core/surface.js';
import { dot, cross, normalize, spring, transform, multiply, identity } from '../dist/src/core/math.js';
import { MotionTimeline, activityFrame } from '../dist/src/core/motion.js';
import { sphere, torus } from '../dist/src/renderer/geometry.js';
const near = (a, b, epsilon = 1e-7) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);

test('default designs are isolated and support lossless JSON round trips', () => {
  const a = createDesign(), b = createDesign(); a.body.shape = 'heart';
  assert.equal(b.body.shape, 'square');
  assert.deepEqual(parseDesign(serializeDesign(b)), b);
});
test('partial patches preserve the rest of the design and do not alias arrays', () => {
  const before = createDesign({ accessories: [createAccessory('beret')] });
  const after = patchDesign(before, { eyes: { left: { weights: { smile: 0.2 } } } });
  assert.equal(after.eyes.left.weights.smile, 0.2); assert.deepEqual(after.body, before.body);
  after.accessories[0].color = '#ffffff'; assert.equal(before.accessories[0].color, '#b84742');
});
for (const [name, mutate] of [
  ['version', d => { d.version = 99; }], ['unknown shape', d => { d.body.shape = 'unknown'; }],
  ['removed size', d => { d.body.size = [1, 1, 1]; }], ['custom recipe', d => { d.body.shape = {kind:'ellipse'}; }],
  ['unknown key', d => { d.body.typo = 2; }], ['color', d => { d.body.color = 'red'; }],
  ['bad eye region', d => { d.eyes.anchor = { region: 'crown', uv: [0,0], offset: 0 }; }], ['unsafe id', d => { d.accessories = [{ ...createAccessory('beret'), id: '__proto__' }]; }],
  ['duplicate ids', d => { d.accessories = [createAccessory('beret', 'same'), createAccessory('halo', 'same')]; }],
  ['too many parts', d => { d.accessories = Array.from({ length: 9 }, (_, i) => createAccessory('beret', `hat-${i}`)); }],
]) test(`untrusted design rejects ${name}`, () => { const d = createDesign(); mutate(d); assert.throws(() => parseDesign(d)); });
test('malformed and oversized JSON, unknown patch keys, and prototype payloads are rejected', () => {
  assert.throws(() => parseDesign('{')); assert.throws(() => parseDesign(' '.repeat(65537)));
  assert.throws(() => patchDesign(createDesign(), { typo: 1 }));
  assert.throws(() => parseDesign(JSON.parse('{"__proto__":{"polluted":true}}')));
  assert.equal({}.polluted, undefined);
});
test('all built-in accessories provide valid, independent mount recipes', () => {
  for (const preset of ACCESSORY_PRESETS) {
    const accessory = preset === 'earring' || preset === 'starEarring' ? createAccessory(preset, { slot: 'leftEar' }) : createAccessory(preset);
    assert.equal(parseDesign(createDesign({ accessories: [accessory] })).accessories[0].preset, preset);
  }
});
for (const shape of ['circle','square','oval']) test(`${shape}: shared deformed surface has finite positions and outward unit normals`, () => {
  const body = createDesign({ body: { shape } }).body;
  for (let a = 0; a < 24; a++) for (let b = 0; b < 12; b++) {
    const direction = normalize([Math.cos(a), Math.sin(b), Math.sin(a)]);
    const p = bodyPoint(body, direction, 0.93), n = bodyNormal(body, direction, 0.93);
    assert.ok([...p, ...n].every(Number.isFinite)); near(Math.hypot(...n), 1);
    assert.ok(dot(p, n) > 0);
  }
});
test('surface anchors use exactly the same deformation as mesh positions, with a normal offset', () => {
  const body = createDesign({ body: { shape:'square' } }).body;
  for (const squash of [0.9, 1, 1.1]) {
    const anchor = { region: 'face', uv: [0.27, -0.21], offset: 0.037 };
    const [u, v] = anchor.uv;
    const direction = [Math.sin(u * 1.05) * Math.cos(v * 0.9), Math.sin(v * 0.9), Math.cos(u * 1.05) * Math.cos(v * 0.9)];
    const frame = sampleSurface(body, anchor, squash), point = bodyPoint(body, direction, squash);
    frame.position.forEach((p, i) => near(p, point[i] + frame.normal[i] * anchor.offset));
    near(dot(frame.tangent, frame.normal), 0); near(dot(frame.bitangent, frame.normal), 0);
    near(dot(cross(frame.tangent, frame.bitangent), frame.normal), 1);
  }
});
test('semantic regions have correct outward-facing coordinate frames', () => {
  const body = createDesign({ body: { shape: 'circle' } }).body;
  for (const [region, expected] of [['face', [0, 0, 1]], ['crown', [0, 1, 0]], ['left', [-1, 0, 0]], ['right', [1, 0, 0]]]) {
    const f = sampleSurface(body, { region, uv: [0, 0], offset: 0 }); near(dot(f.normal, expected), 1, 0.001);
  }
});
test('transforms preserve identity and apply translation in column-major convention', () => {
  const m = transform([2, 3, 4], [0.2, 0.5, -0.4], [1, 2, 3]);
  assert.deepEqual(multiply(identity(), m), m); assert.deepEqual(multiply(m, identity()), m);
  assert.deepEqual(Array.from(m.slice(12, 15)), [2, 3, 4]);
});
test('critical spring is stable and frame-rate independent for a fixed target', () => {
  const result = fps => { let state = [0, 0]; for (let i = 0; i < fps; i++) state = spring(...state, 1, 1 / fps); return state; };
  const a = result(30), b = result(60), exact = spring(0, 0, 1, 1);
  near(a[0], b[0], 1e-12); near(b[0], exact[0], 1e-12); assert.ok(a[0] > 0.99 && a[0] <= 1);
});
test('motion interpolates all channels and resolves after the actual final tick', async () => {
  const timeline = new MotionTimeline();
  const pending = timeline.to({ face: { uv: [0.4, -0.2] }, body: { rotation: [0, 1, 0] }, eyes: { openness: 0 }, accessories: { hat: { rotation: [0, 0, 0.6] } } }, { duration: 1000, easing: 'linear' });
  timeline.advance(500); near(timeline.pose.face[0], 0.2); near(timeline.pose.openness, 0.5); near(timeline.pose.accessories.hat[2], 0.3);
  assert.equal(timeline.active, true); timeline.advance(500); assert.deepEqual(await pending, { finished: true }); assert.equal(timeline.active, false);
});
test('interrupted and cancelled motions settle their promises without jumping', async () => {
  const timeline = new MotionTimeline(), first = timeline.to({ face: { uv: [0.4, 0] } });
  timeline.advance(100); const current = timeline.pose.face[0];
  const second = timeline.to({ face: { uv: [-0.2, 0] } });
  assert.deepEqual(await first, { finished: false }); near(timeline.pose.face[0], current);
  timeline.cancel(); assert.deepEqual(await second, { finished: false });
});
test('invalid motion is atomic; zero-duration motion completes synchronously', async () => {
  const timeline = new MotionTimeline(); const first = timeline.to({ face: { uv: [0.3, 0] } });
  assert.throws(() => timeline.to({ eyes: { openness: NaN } })); assert.equal(timeline.active, true);
  assert.throws(() => timeline.advance(-1));
  const immediate = timeline.to({ eyes: { openness: 0.2 } }, { duration: 0 });
  assert.deepEqual(await immediate, { finished: true }); near(timeline.pose.openness, 0.2);
  assert.equal(timeline.active, true); timeline.advance(400); assert.deepEqual(await first, { finished: true });
});
test('reduced motion and still activity produce an invariant resting pose', () => {
  assert.deepEqual(activityFrame('speaking', 10, true), activityFrame('idle', 0, true));
  assert.deepEqual(activityFrame('still', 150), activityFrame('still', 0));
  assert.notDeepEqual(activityFrame('celebrating', 0.2), activityFrame('idle', 0.2));
});
test('geometry index buffers are valid and nondegenerate faces point outwards', () => {
  for (const geometry of [sphere(), sphere(24, 20, true), torus(), torus(0.23, Math.PI)]) {
    assert.ok(geometry.indices.every(i => i < geometry.vertices.length / 6));
    assert.ok(geometry.vertices.every(Number.isFinite));
    for (let i = 0; i < geometry.indices.length; i += 3) {
      const get = index => Array.from(geometry.vertices.slice(index * 6, index * 6 + 3));
      const a = get(geometry.indices[i]), b = get(geometry.indices[i + 1]), c = get(geometry.indices[i + 2]);
      const normal = cross(b.map((v, j) => v - a[j]), c.map((v, j) => v - a[j]));
      const supplied = Array.from(geometry.vertices.slice(geometry.indices[i] * 6 + 3, geometry.indices[i] * 6 + 6));
      if (Math.hypot(...normal) > 1e-8) assert.ok(dot(normal, supplied) > 0, 'inward triangle');
    }
  }
});
test('entry point can be imported on a server without DOM globals', async () => {
  const module = await import('../dist/src/index.js'); assert.equal(typeof module.createDesign, 'function'); module.defineSidekick();
});
