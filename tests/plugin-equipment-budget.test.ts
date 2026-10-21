import test from 'node:test';
import assert from 'node:assert/strict';
import { PluginEquipmentController } from '../src/element/plugin-equipment.js';
import { assertAccessoryPluginEquipmentBudget, accessoryPluginGeometryCounts } from '../src/core/accessory-plugins.js';
import type { AccessoryPluginAttachment, AccessoryPluginRegistry, PluginAccessoryAsset } from '../src/core/accessory-plugins.js';
import { ACCESSORY_SLOTS, MATERIAL_SHAPE_NAMES, createDesign } from '../src/core/design.js';
import { AvatarRenderer } from '../src/renderer/webgl.js';
import { initialPose } from '../src/core/motion.js';

function asset(id: string, vertices = 3, triangles = 2): PluginAccessoryAsset {
  const buffer = new Float32Array(vertices * 6); for (let i = 0; i < vertices; i++) buffer[i * 6 + 5] = 1;
  const indices = new Uint16Array(triangles * 3); for (let i = 0; i < indices.length; i++) indices[i] = i % 3;
  return { pluginId: id, slots: [...ACCESSORY_SLOTS], geometry: { vertices: buffer, indices }, attachment: { mode: 'contained-front', mounts: Object.fromEntries(MATERIAL_SHAPE_NAMES.map(name => [name, { uv: [0, -.2], offset: 0, rotation: [0, 0, 0], scale: 1 }])) as AccessoryPluginAttachment['mounts'] } };
}
const registry = (load: (id: string) => Promise<PluginAccessoryAsset>) => ({ load }) as AccessoryPluginRegistry;

test('aggregate fitted vertex and triangle budgets include all committed slots and complete connectors', () => {
  const slots = ['head', 'mouth', 'neck'] as const;
  assert.throws(() => assertAccessoryPluginEquipmentBudget(slots.map(slot => ({ slot, asset: asset(slot, 1600, 2) }))), /combined 4096 vertex/);
  assert.throws(() => assertAccessoryPluginEquipmentBudget(slots.map(slot => ({ slot, asset: asset(slot, 3, 3000) }))), /8192 triangle budget/);
  const connected = asset('connected', 1900, 3800);
  connected.geometry.surfaceConnectors = [{ kind: 'surface-tube', to: [0, -.1, .01], radius: .01, rings: 8, sides: 8 }];
  assert.deepEqual(accessoryPluginGeometryCounts(connected.geometry), { vertices: 1966, triangles: 3928 });
  assert.doesNotThrow(() => assertAccessoryPluginEquipmentBudget([{ slot: 'leftEar', asset: connected }, { slot: 'rightEar', asset: connected }]));
  assert.throws(() => assertAccessoryPluginEquipmentBudget([{ slot: 'leftEar', asset: connected }, { slot: 'rightEar', asset: connected }, { slot: 'neck', asset: asset('extra', 300, 400) }]), /combined/);
  const staticAsset = asset('static', 9000, 10000); delete staticAsset.attachment;
  assert.doesNotThrow(() => assertAccessoryPluginEquipmentBudget([{ slot: 'head', asset: staticAsset }]));
});

test('over-budget replacement rejects atomically, retains valid equipment, and can retry after removal', async () => {
  let updates = 0;
  const controller = new PluginEquipmentController(() => { updates++; });
  const r = registry(async id => asset(id, id === 'small' ? 3 : 1600, id === 'small' ? 2 : 3000));
  await controller.equip(r, 'head', { slot: 'head' }); await controller.equip(r, 'mouth', { slot: 'mouth' }); await controller.equip(r, 'small', { slot: 'neck' });
  const before = controller.references(), notified = updates;
  await assert.rejects(controller.equip(r, 'large', { slot: 'neck' }), { name: 'RangeError', message: /combined/ });
  assert.deepEqual(controller.references(), before); assert.equal(updates, notified);
  controller.remove('head'); await controller.equip(r, 'large', { slot: 'neck' });
  assert.equal(controller.references().find(item => item.slot === 'neck')!.pluginId, 'large');
});

test('a superseded over-budget request cannot undo the latest valid equipment', async () => {
  let finish!: (value: PluginAccessoryAsset) => void;
  const pendingAsset = new Promise<PluginAccessoryAsset>(resolve => { finish = resolve; });
  const controller = new PluginEquipmentController(() => {}), r = registry(id => id === 'slow' ? pendingAsset : Promise.resolve(asset(id, id === 'small' ? 3 : 1600, 2)));
  await controller.equip(r, 'head', { slot: 'head' }); await controller.equip(r, 'mouth', { slot: 'mouth' });
  const old = controller.equip(r, 'slow', { slot: 'neck' }); await Promise.resolve();
  const newest = controller.equip(r, 'small', { slot: 'neck' }); finish(asset('slow', 1600, 2));
  assert.deepEqual(await old, { finished: false }); assert.deepEqual(await newest, { finished: true });
  assert.equal(controller.references().find(item => item.slot === 'neck')!.pluginId, 'small');
});

test('direct renderer rejects over-budget payloads before changing GPU resources', async () => {
  const { countingCanvas } = await import('./performance-fixture.mjs');
  const fixture = countingCanvas(), renderer = new AvatarRenderer(fixture.canvas), design = createDesign();
  const state = { pose: initialPose(), activity: 'still' as const, time: 0, delta: 0, reduced: true, style: 'flat' as const };
  renderer.render(design, state); const before = fixture.snapshot();
  const pluginAccessories = (['head', 'mouth', 'neck'] as const).map(slot => ({ id: slot, slot, color: '#ff0000', asset: asset(slot, 1600, 2) }));
  assert.throws(() => renderer.render(design, { ...state, pluginAccessories }), { name: 'RangeError', message: /combined/ });
  assert.deepEqual(fixture.snapshot(), before);
  renderer.render(design, state); renderer.dispose(); assert.equal(fixture.snapshot().liveBuffers, 0);
});
