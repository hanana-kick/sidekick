import test from 'node:test';
import assert from 'node:assert/strict';
import { AccessoryPluginRegistry, validateAccessoryPluginAttachment, validateAccessoryPluginGeometry } from '../src/core/accessory-plugins.js';
import type { AccessoryPluginAttachment, AccessoryPluginGeometry, PluginAccessoryAsset } from '../src/core/accessory-plugins.js';
import { AccessoryPluginFitter, accessoryPluginMaterialColor, resolveAccessoryPluginMount } from '../src/core/plugin-mount.js';
import { ShapeTimeline } from '../src/core/shape-motion.js';
import { createDesign, MATERIAL_SHAPE_NAMES } from '../src/core/design.js';
import { AvatarRenderer } from '../src/renderer/webgl.js';
import { initialPose } from '../src/core/motion.js';
import { getAccessoryPluginAttachmentFrame } from '../src/plugin-sdk.js';

function geometry(): AccessoryPluginGeometry {
  return { vertices: new Float32Array([-.1, -.05, 0, 0, 0, 1, .1, -.05, 0, 0, 0, 1, 0, .05, 0, 0, 0, 1]), indices: new Uint16Array([0, 1, 2, 0, 2, 1]), parts: [{ indexStart: 0, indexCount: 3 }, { indexStart: 3, indexCount: 3, material: { multiplier: .78 } }] };
}
function attachment(): AccessoryPluginAttachment {
  return { mode: 'contained-front', mounts: Object.fromEntries(MATERIAL_SHAPE_NAMES.map((name, i) => [name, { uv: [0, -.2 - i / 1000], offset: 0, rotation: [i / 100, 0, 0], scale: 1 - i / 100 }])) as AccessoryPluginAttachment['mounts'], clearance: .002, follow: .15 };
}
function asset(): PluginAccessoryAsset { return { pluginId: 'test/front', slots: ['neck'], geometry: geometry(), attachment: attachment() }; }

test('fitting metadata and multipart materials are bounded and independently owned', async () => {
  const recipe = attachment(), original = geometry(), registry = new AccessoryPluginRegistry();
  registry.register({ apiVersion: 1, id: 'test/front', slots: ['neck'], attachment: recipe, createMesh: () => original });
  recipe.mounts.circle.scale = 7;
  const first = await registry.load('test/front');
  assert.equal(first.attachment!.mounts.circle.scale, 1);
  first.attachment!.mounts.circle.scale = 5; first.geometry.parts![1]!.material!.multiplier = 2;
  assert.equal((await registry.load('test/front')).attachment!.mounts.circle.scale, 1);
  assert.equal((await registry.load('test/front')).geometry.parts![1]!.material!.multiplier, .78);
  assert.deepEqual(structuredClone(first), first);
  const invalid = attachment(); delete (invalid.mounts as Partial<typeof invalid.mounts>).heart;
  assert.throws(() => validateAccessoryPluginAttachment(invalid), /every material shape/);
  for (const value of [NaN, Infinity, -1, 9]) { const valueRecipe = attachment(); valueRecipe.mounts.circle.scale = value; assert.throws(() => validateAccessoryPluginAttachment(valueRecipe)); }
  for (const mutate of [
    (g: AccessoryPluginGeometry) => { g.parts![0]!.indexStart = 3; },
    (g: AccessoryPluginGeometry) => { g.parts![0]!.indexCount = 2; },
    (g: AccessoryPluginGeometry) => { g.parts!.pop(); },
    (g: AccessoryPluginGeometry) => { g.parts![1]!.material!.multiplier = NaN; },
    (g: AccessoryPluginGeometry) => { g.parts![1]!.material!.color = 'red'; },
  ]) { const g = geometry(); mutate(g); assert.throws(() => validateAccessoryPluginGeometry(g)); }
  assert.equal(accessoryPluginMaterialColor('#ffffff', { multiplier: .78 }), '#c7c7c7');
  assert.equal(accessoryPluginMaterialColor('#123456', { color: '#ffffff', multiplier: 4 }), '#ffffff');
});

test('shape provenance rebases exact visible weights through interrupted morphs', async () => {
  const timeline = new ShapeTimeline('heart'), recipe = attachment();
  const first = timeline.to('boom', { duration: 1000, easing: 'linear' }); timeline.advance(400);
  const visible = timeline.snapshot, mount = resolveAccessoryPluginMount(recipe, 'boom', visible.shapeWeights);
  assert.deepEqual(visible.shapeWeights, { boom: .4, heart: .6 });
  const second = timeline.to('puffy', { duration: 1000, easing: 'linear' });
  assert.deepEqual(await first, { finished: false }); assert.strictEqual(timeline.snapshot, visible);
  assert.deepEqual(resolveAccessoryPluginMount(recipe, 'puffy', timeline.snapshot.shapeWeights), mount);
  timeline.advance(500);
  assert.deepEqual(timeline.snapshot.shapeWeights, { boom: .2, puffy: .5, heart: .3 });
  assert.ok(Object.isFrozen(timeline.snapshot.shapeWeights));
  timeline.finish(); assert.deepEqual(await second, { finished: true }); assert.deepEqual(timeline.snapshot.shapeWeights, { puffy: 1 });
  timeline.set('circle'); assert.deepEqual(timeline.snapshot.shapeWeights, { circle: 1 });
  assert.throws(() => resolveAccessoryPluginMount(recipe, 'circle', { circle: .5 }), /sum to one/);
  assert.throws(() => resolveAccessoryPluginMount(recipe, 'circle', { circle: NaN }), /finite/);
});

test('generic fit cache retains binary geometry and reuses unchanged body-local results', () => {
  const data = asset(), fitter = new AccessoryPluginFitter(data), body = createDesign().body;
  const original = structuredClone(data), first = fitter.sample(body);
  assert.strictEqual(fitter.sample(body), first);
  assert.ok(first.matrix.every(Number.isFinite)); assert.ok(first.seating >= .002);
  assert.notStrictEqual(fitter.sample(body, { rotation: [.2, 0, 0] }), first);
  assert.deepEqual(data, original);
  const timeline = new ShapeTimeline('square'); void timeline.to('heart', { duration: 1000 }); timeline.advance(400);
  const current = timeline.snapshot;
  const options = { contour: current.contour, depth: current.profile.depth, shapeWeights: current.shapeWeights };
  const fit = fitter.sample(body, options); assert.strictEqual(fitter.sample(body, options), fit);
  const frame = getAccessoryPluginAttachmentFrame(body, data.attachment!, options);
  assert.deepEqual(frame.matrix, fit.frame.matrix); assert.equal(frame.scale, fit.mount.scale);
  assert.ok(fit.matrix[14]! >= frame.matrix[14]!);
});

test('fit-specific complexity limits reject before scratch allocation without reducing static geometry limits', async () => {
  const large = geometry(); large.parts = undefined; large.indices = new Uint16Array(4097 * 3);
  for (let i = 0; i < large.indices.length; i++) large.indices[i] = i % 3;
  assert.doesNotThrow(() => validateAccessoryPluginGeometry(large));
  const registry = new AccessoryPluginRegistry();
  registry.register({ apiVersion: 1, id: 'test/static', slots: ['neck'], createMesh: () => large });
  registry.register({ apiVersion: 1, id: 'test/fitted', slots: ['neck'], attachment: attachment(), createMesh: () => large });
  assert.equal((await registry.load('test/static')).geometry.indices.length, large.indices.length);
  await assert.rejects(registry.load('test/fitted'), { name: 'RangeError', message: /contact limits/ });
  assert.throws(() => new AccessoryPluginFitter({ ...asset(), geometry: large }), { name: 'RangeError' });
  const manyVertices = geometry(); manyVertices.parts = undefined; manyVertices.vertices = new Float32Array(2049 * 6);
  for (let i = 0; i < 2049; i++) manyVertices.vertices[i * 6 + 5] = 1;
  assert.doesNotThrow(() => validateAccessoryPluginGeometry(manyVertices));
  assert.throws(() => new AccessoryPluginFitter({ ...asset(), geometry: manyVertices }), { name: 'RangeError' });
});

test('multipart fitted equipment uploads once across pose and squash and frees its buffers', async () => {
  const { countingCanvas } = await import('./performance-fixture.mjs');
  const f = countingCanvas(), renderer = new AvatarRenderer(f.canvas), design = createDesign();
  const data = asset(), vertices = data.geometry.vertices, indices = data.geometry.indices;
  const state = { pose: initialPose(), activity: 'still' as const, time: 0, delta: 0, reduced: true, style: 'flat' as const, pluginAccessories: [{ id: 'front', slot: 'neck' as const, color: '#ff0044', asset: data }] };
  renderer.render(design, state); const before = f.snapshot();
  for (let i = 0; i < 5; i++) renderer.render(design, { ...state, bodyOrientation: { yaw: i * 8 }, activityFrame: { bob: 0, roll: 0, squash: .9 + i * .04, gaze: [0, 0], blink: 0 }, partAnimation: { accessories: { front: { rotation: [.03 * i, 0, 0] as [number, number, number] } } } });
  assert.equal(f.snapshot().uploadedBytes, before.uploadedBytes);
  assert.strictEqual(data.geometry.vertices, vertices); assert.strictEqual(data.geometry.indices, indices);
  assert.equal(renderer.stats.drawCalls, 3, 'Body plus two indexed materials');
  renderer.render(design, { ...state, pluginAccessories: [] }); assert.equal(f.snapshot().liveBuffers, before.liveBuffers - 2);
  renderer.dispose(); assert.equal(f.snapshot().liveBuffers, 0);
});


test('attachment discriminants reject missing or mode-inapplicable metadata', () => {
  const mounts = attachment().mounts;
  for (const value of [
    { mode: 'perimeter-front', mounts },
    { mode: 'contained-front', mounts, region: 'left' },
    { mode: 'crown-envelope', mounts, perimeterInset: .9 },
    { mode: 'perimeter-front', mounts, region: 'left', referenceUv: [0, .1] },
    { mode: 'eye-plane', mounts, containmentClearance: .01 },
    { mode: 'eye-plane', mounts, surprise: () => {} },
  ]) assert.throws(() => validateAccessoryPluginAttachment(value), TypeError);
  for (const value of [{ mode: 'contained-front', mounts }, { mode: 'crown-envelope', mounts }, { mode: 'eye-plane', mounts, referenceUv: [0, .1] }, { mode: 'perimeter-front', mounts, region: 'right' }]) assert.doesNotThrow(() => validateAccessoryPluginAttachment(value));
});

test('eye-plane public frames reject malformed landmarks before producing or caching any NaN', () => {
  const data = asset(); data.attachment = { mode: 'eye-plane', mounts: attachment().mounts };
  const body = createDesign().body, fitter = new AccessoryPluginFitter(data);
  for (const eyes of [{ left: [], right: [], size: [.1, .1] }, { left: [0, 0], right: [0, 0], size: [0, .1] }, { left: [NaN, 0], right: [0, 0], size: [.1, .1] }]) {
    assert.throws(() => getAccessoryPluginAttachmentFrame(body, data.attachment!, { eyes: eyes as never }));
    assert.throws(() => fitter.sample(body, { eyes: eyes as never }));
  }
  const fit = fitter.sample(body, { eyes: { left: [-.1, 0], right: [.1, 0], size: [.1, .1] } });
  assert.ok(fit.matrix.every(Number.isFinite));
});
