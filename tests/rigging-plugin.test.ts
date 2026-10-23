import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AccessoryPluginRegistry, validateAccessoryPluginGeometry,
  assertAccessoryPluginFitGeometry, assertAccessoryPluginEquipmentBudget, ACCESSORY_PLUGIN_LIMITS,
} from '../src/core/accessory-plugins.js';
import type { AccessoryPlugin, AccessoryPluginGeometry, AccessoryPluginAttachment, PluginAccessoryAsset } from '../src/core/accessory-plugins.js';
import { MATERIAL_SHAPE_NAMES, ACCESSORY_SLOTS } from '../src/core/design.js';
import { skinVertices } from '../src/core/rigging.js';
import { PluginEquipmentController } from '../src/element/plugin-equipment.js';

function mesh(count = 3): AccessoryPluginGeometry {
  const vertices = new Float32Array(count * 6), weights = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) { vertices[i * 6] = i % 2; vertices[i * 6 + 1] = i % 3 === 2 ? 1 : 0; vertices[i * 6 + 5] = 1; weights[i * 4] = 1; }
  return { vertices, indices: new Uint16Array([0, 1, 2]), skin: {
    skeleton: { bones: [{ id: 'root' }, { id: 'tip', parent: 'root', position: [0, .5, 0] }] },
    joints: new Uint8Array(count * 4), weights,
  } };
}
function plugin(id = 'test/skinned', geometry = mesh()): AccessoryPlugin {
  return { apiVersion: 1, id, slots: [...ACCESSORY_SLOTS], createMesh: () => geometry };
}
function attachment(): AccessoryPluginAttachment {
  return { mode: 'contained-front', mounts: Object.fromEntries(MATERIAL_SHAPE_NAMES.map(name => [name, { uv: [0, 0], offset: 0, rotation: [0, 0, 0], scale: 1 }])) as AccessoryPluginAttachment['mounts'] };
}
function asset(id: string, count = 3): PluginAccessoryAsset { return { pluginId: id, slots: [...ACCESSORY_SLOTS], geometry: mesh(count) }; }

test('plugin geometry owns complete skin buffers and hierarchy independently of caller mutation', () => {
  const input = mesh(), original = structuredClone(input), output = validateAccessoryPluginGeometry(input);
  assert.deepEqual(output, original); assert.deepEqual(structuredClone(output), output);
  assert.notEqual(output.skin!.joints.buffer, input.skin!.joints.buffer);
  assert.notEqual(output.skin!.weights.buffer, input.skin!.weights.buffer);
  output.vertices[0] = 5; output.skin!.joints[0] = 1; output.skin!.weights[0] = .5;
  output.skin!.skeleton.bones[1]!.position![1] = 4;
  assert.deepEqual(input, original);
  const owned = validateAccessoryPluginGeometry(input);
  assert.deepEqual(skinVertices(owned.vertices, owned.skin!), input.vertices, 'Binding remains in the same local coordinates as its mesh.');
});

test('skin validation remains strict through the geometry boundary', () => {
  const invalid = (mutate: (geometry: AccessoryPluginGeometry) => void) => {
    const value = mesh(); mutate(value); assert.throws(() => validateAccessoryPluginGeometry(value));
  };
  invalid(value => { value.skin!.weights = new Float32Array(8); });
  invalid(value => { value.skin!.weights[0] = .9; });
  invalid(value => { value.skin!.weights[4] = NaN; });
  invalid(value => { value.skin!.joints[3] = 2; });
  invalid(value => { value.skin!.skeleton.bones[1]!.parent = 'missing'; });
  invalid(value => { value.skin!.skeleton.bones[0]!.id = '__proto__'; });
  for (const skin of [null, false, {}, { skeleton: { bones: [] } }]) assert.throws(() => validateAccessoryPluginGeometry({ ...mesh(), skin }));
});

test('skin cannot be combined with paired-affine fitting or procedural surface connectors', () => {
  for (const extra of [{ deformation: {} }, { surfaceConnectors: [] }, { surfaceConnectors: [{ kind: 'surface-tube', to: [0, .1, 0], radius: .01, rings: 4, sides: 4 }] }]) {
    assert.throws(() => validateAccessoryPluginGeometry({ ...mesh(), ...extra }), /Skinning cannot be combined/);
  }
});

test('fitted recipes reject skinned geometry both directly and through lazy registry load', async () => {
  assert.throws(() => assertAccessoryPluginFitGeometry(mesh()), /Skinned geometry/);
  const registry = new AccessoryPluginRegistry(); let calls = 0;
  registry.registerLazy('test/skinned', () => { calls++; return { ...plugin(), attachment: attachment() }; });
  await assert.rejects(registry.load('test/skinned'), /Skinned geometry/);
  await assert.rejects(registry.load('test/skinned'), /Skinned geometry/);
  assert.equal(calls, 1, 'A rejected fitted skin remains failed until explicit retry.');
  await assert.rejects(registry.retry('test/skinned'), /Skinned geometry/); assert.equal(calls, 2);
});

test('lazy skin loading deduplicates factories while each load returns an owned cloneable payload', async () => {
  const registry = new AccessoryPluginRegistry(), source = mesh(); let loads = 0, factories = 0;
  registry.registerLazy('test/skinned', async () => { loads++; return { default: { ...plugin(), async createMesh() { factories++; return source; } } }; });
  const [a, b] = await Promise.all([registry.load('test/skinned'), registry.load('test/skinned')]);
  assert.equal(loads, 1); assert.equal(factories, 1); assert.deepEqual(structuredClone(a), a);
  a.geometry.skin!.skeleton.bones[1]!.position![0] = 7;
  a.geometry.skin!.joints[0] = 1; a.geometry.skin!.weights[0] = 0;
  source.skin!.weights[0] = .1; source.skin!.skeleton.bones[0]!.id = 'changed';
  const c = await registry.load('test/skinned');
  assert.deepEqual(c, b); assert.notEqual(c.geometry.skin!.joints.buffer, b.geometry.skin!.joints.buffer);
  assert.notEqual(c.geometry.skin!.skeleton.bones, b.geometry.skin!.skeleton.bones);
  assert.equal('createMesh' in c, false);
});

test('equipment snapshots and callback payloads cannot mutate a committed skin', async () => {
  const registry = new AccessoryPluginRegistry(); registry.register(plugin());
  const changed: ReturnType<PluginEquipmentController['instances']>[] = [];
  const controller = new PluginEquipmentController(items => { changed.push(items); });
  await controller.equip(registry, 'test/skinned', { id: 'hat', slot: 'head' });
  const snapshot = controller.instances(); snapshot[0]!.asset.geometry.skin!.weights[0] = 0;
  changed[0]![0]!.asset.geometry.skin!.skeleton.bones[0]!.id = 'changed';
  const retained = controller.instances()[0]!.asset.geometry.skin!;
  assert.equal(retained.weights[0], 1); assert.equal(retained.skeleton.bones[0]!.id, 'root');
  assert.deepEqual(structuredClone(controller.instances()), controller.instances());
});

test('skin geometry remains bounded by per-mesh vertices and the six unique equipment slots', () => {
  assert.doesNotThrow(() => validateAccessoryPluginGeometry(mesh(ACCESSORY_PLUGIN_LIMITS.maxVertices)));
  assert.throws(() => validateAccessoryPluginGeometry(mesh(ACCESSORY_PLUGIN_LIMITS.maxVertices + 1)), /vertex count/);
  const items = ACCESSORY_SLOTS.map(slot => ({ slot, asset: asset(slot) }));
  assert.doesNotThrow(() => assertAccessoryPluginEquipmentBudget(items));
  assert.throws(() => assertAccessoryPluginEquipmentBudget([...items, items[0]!]));
  assert.throws(() => assertAccessoryPluginEquipmentBudget([items[0]!, items[0]!]));
});

test('geometry skin accessors are rejected without executing them', () => {
  let reads = 0; const source = mesh();
  Object.defineProperty(source, 'skin', { enumerable: true, get() { reads++; return mesh().skin; } });
  assert.throws(() => validateAccessoryPluginGeometry(source), /data|accessor/);
  assert.equal(reads, 0);
});

test('skin getters cannot hide a rig from fitted-recipe rejection', async () => {
  let reads = 0; const source = mesh(), original = source.skin;
  Object.defineProperty(source, 'skin', { enumerable: true, get() { return ++reads === 1 ? undefined : original; } });
  const registry = new AccessoryPluginRegistry(); registry.register({ ...plugin('test/skinned', source), attachment: attachment() });
  await assert.rejects(registry.load('test/skinned'), /data|accessor|Skinned geometry/);
  assert.equal(reads, 0, 'Untrusted descriptor code must not execute before validation.');
});

test('aggregate CPU-skin budgets include every occupied slot but not rigid meshes', () => {
  const half = ACCESSORY_PLUGIN_LIMITS.maxEquippedSkinnedVertices / 2;
  const a = { slot: 'head' as const, asset: asset('a', half) }, b = { slot: 'mouth' as const, asset: asset('b', half) };
  assert.doesNotThrow(() => assertAccessoryPluginEquipmentBudget([a, b]));
  assert.throws(() => assertAccessoryPluginEquipmentBudget([a, b, { slot: 'neck', asset: asset('extra') }]), /[Ss]kinned|[Ss]kin/);
  const rigid = asset('rigid', half); delete rigid.geometry.skin;
  assert.doesNotThrow(() => assertAccessoryPluginEquipmentBudget([a, b, { slot: 'neck', asset: rigid }]));
  const left = asset('left'), right = asset('right');
  left.geometry.indices = new Uint16Array(ACCESSORY_PLUGIN_LIMITS.maxEquippedSkinnedTriangles / 2 * 3);
  right.geometry.indices = new Uint16Array(ACCESSORY_PLUGIN_LIMITS.maxEquippedSkinnedTriangles / 2 * 3);
  const triangles = [{ slot: 'leftEar' as const, asset: left }, { slot: 'rightEar' as const, asset: right }];
  assert.doesNotThrow(() => assertAccessoryPluginEquipmentBudget(triangles));
  assert.throws(() => assertAccessoryPluginEquipmentBudget([...triangles, { slot: 'head', asset: asset('extra') }]), /[Ss]kinned|[Ss]kin/);
});

test('over-budget skin replacement rejects atomically and succeeds after space is freed', async () => {
  const half = ACCESSORY_PLUGIN_LIMITS.maxEquippedSkinnedVertices / 2;
  const registry = new AccessoryPluginRegistry();
  registry.register(plugin('test/large', mesh(half)));
  registry.register(plugin('test/small', mesh(half - 3)));
  registry.register(plugin('test/tiny'));
  let updates = 0; const controller = new PluginEquipmentController(() => { updates++; });
  await controller.equip(registry, 'test/large', { slot: 'head' });
  await controller.equip(registry, 'test/small', { slot: 'mouth' });
  await controller.equip(registry, 'test/tiny', { slot: 'neck' });
  const previous = controller.references(), notified = updates;
  await assert.rejects(controller.equip(registry, 'test/large', { slot: 'mouth' }), /[Ss]kinned|[Ss]kin/);
  assert.deepEqual(controller.references(), previous); assert.equal(updates, notified);
  controller.remove('neck');
  assert.deepEqual(await controller.equip(registry, 'test/large', { slot: 'mouth' }), { finished: true });
});

test('direct body and accessory poses clone input and take only their target bone tracks', async () => {
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM('<!doctype html><body></body>', { pretendToBeVisual: true, url: 'https://rigging-plugin.test/' });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [name, value] of Object.entries({ HTMLElement: dom.window.HTMLElement, CustomEvent: dom.window.CustomEvent, requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window), cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window) })) {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  }
  try {
    const { SidekickAvatar } = await import('../src/element/avatar.js');
    dom.window.customElements.define('rigging-plugin-avatar', SidekickAvatar);
    const bot = dom.window.document.createElement('rigging-plugin-avatar') as unknown as InstanceType<typeof SidekickAvatar>;
    const input = { skeleton: mesh().skin!.skeleton, influences: [], fallbackBone: 'root' };
    bot.setBodyRig(input); input.skeleton.bones[0]!.id = 'changed';
    assert.equal(bot.bodyRig!.skeleton.bones[0]!.id, 'root');
    const rigCopy = bot.bodyRig!; rigCopy.skeleton.bones[0]!.id = 'alsoChanged';
    assert.equal(bot.bodyRig!.skeleton.bones[0]!.id, 'root');
    const registry = new AccessoryPluginRegistry(); registry.register(plugin());
    await bot.equipPluginAccessory(registry, 'test/skinned', { slot: 'head', id: 'hat' });
    const clip = { duration: 1, tracks: [
      { target: { bone: 'tip' }, channel: 'rotation' as const, keyframes: [{ time: 0, value: [0, 0, .1] as [number, number, number] }] },
      { target: { accessory: 'hat', bone: 'tip' }, channel: 'position' as const, keyframes: [{ time: 0, value: [0, .1, 0] as [number, number, number] }] },
      { target: { accessory: 'hat' }, channel: 'rotation' as const, keyframes: [{ time: 0, value: [0, 0, .2] as [number, number, number] }] },
    ] };
    bot.setPartAnimation(clip);
    const pose = { tip: { rotation: [0, 0, .3] as [number, number, number] } };
    bot.setBonePose(pose); pose.tip.rotation[2] = 8;
    assert.equal(bot.getBonePose().tip!.rotation![2], .3);
    assert.equal(bot.partAnimation!.clip.tracks.length, 2);
    assert.ok(bot.partAnimation!.clip.tracks.every(track => typeof track.target === 'object' && track.target.accessory === 'hat'));
    bot.setBonePose({ tip: { position: [1, 0, 0] } }, { accessory: 'hat' });
    assert.equal(bot.partAnimation!.clip.tracks.length, 1);
    assert.deepEqual(bot.partAnimation!.clip.tracks[0]!.target, { accessory: 'hat' });
    const copy = bot.getBonePose({ accessory: 'hat' }); copy.tip!.position![0] = 9;
    assert.equal(bot.getBonePose({ accessory: 'hat' }).tip!.position![0], 1);
    bot.setPartAnimation(clip);
    const before = bot.partAnimation;
    assert.throws(() => bot.setBonePose({ missing: {} }, { accessory: 'hat' }));
    assert.deepEqual(bot.partAnimation, before);
    bot.setBodyRig(null);
    assert.equal(bot.partAnimation!.clip.tracks.length, 2);
    assert.equal(bot.getBonePose({ accessory: 'hat' }).tip!.position![0], 1);
    assert.throws(() => bot.getBonePose());
    bot.disconnectedCallback();
  } finally {
    dom.window.close();
    for (const [name, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else Reflect.deleteProperty(globalThis, name); }
  }
});
