import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { AccessoryPluginRegistry, accessoryPluginGeometryCounts, assertAccessoryPluginEquipmentBudget } from '../src/core/accessory-plugins.js';
import type { AccessoryPlugin } from '../src/core/accessory-plugins.js';
import { AccessoryPluginFitter } from '../src/core/plugin-mount.js';
import type { AccessoryPluginFit } from '../src/core/plugin-mount.js';
import { createDesign } from '../src/core/design.js';
import { initialPose } from '../src/core/motion.js';
import { ShapeTimeline } from '../src/core/shape-motion.js';
import { AvatarRenderer } from '../src/renderer/webgl.js';
import type { RenderState } from '../src/renderer/webgl.js';
registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(specifier === '@hanana-kick/sidekick-plugin-sdk' ? new URL('../src/plugin-sdk.ts', import.meta.url).href : specifier, context);
} });
const modules = await Promise.all(['halo', 'glasses', 'moustache', 'bow-tie', 'earring'].map(name => import(`../examples/plugin-sdk/catalog/${name}.js`)));
const definitions: AccessoryPlugin[] = [...modules.slice(0, 4).map(module => module.default), modules[4]!.leftEarring, modules[4]!.rightEarring];
test('six slots cache unchanged fits, update only derived vertices, and leave no-plugin fitting at zero', async () => {
  const { countingCanvas } = await import('./performance-fixture.mjs');
  let factoryCalls = 0;
  const registry = new AccessoryPluginRegistry();
  definitions.forEach(plugin => registry.register({ ...plugin, createMesh() { factoryCalls++; return plugin.createMesh(); } }));
  const assets = await Promise.all(definitions.map(plugin => registry.load(plugin.id)));
  const pluginAccessories = assets.map((asset, index) => ({ id: `cache-${index}`, slot: asset.slots[0]!, color: '#e2a343', asset }));
  assert.doesNotThrow(() => assertAccessoryPluginEquipmentBudget(pluginAccessories));
  assert.equal(new Set(pluginAccessories.map(item => item.slot)).size, 6);
  const counts = assets.map(asset => accessoryPluginGeometryCounts(asset.geometry));
  assert.ok(counts.reduce((sum, count) => sum + count.vertices, 0) <= 4096);
  assert.ok(counts.reduce((sum, count) => sum + count.triangles, 0) <= 8192);
  const originalSample = AccessoryPluginFitter.prototype.sample;
  const last = new WeakMap<AccessoryPluginFitter, AccessoryPluginFit>();
  let sampleCalls = 0, recalculations = 0;
  AccessoryPluginFitter.prototype.sample = function(body, options) {
    sampleCalls++; const result = originalSample.call(this, body, options);
    if (last.get(this) !== result) recalculations++;
    last.set(this, result); return result;
  };
  const fixture = countingCanvas(), renderer = new AvatarRenderer(fixture.canvas), design = createDesign();
  const state: RenderState = { pose: initialPose(), activity: 'still', time: 0, delta: 0, reduced: true, style: 'flat' };
  try {
    renderer.render(design, state); const empty = fixture.snapshot();
    for (let i = 0; i < 20; i++) renderer.render(design, { ...state, bodyOrientation: { yaw: i } });
    assert.equal(sampleCalls, 0, 'No fitted mesh sampling when unequipped');
    assert.equal(fixture.snapshot().uploadedBytes, empty.uploadedBytes);
    const equipped = { ...state, pluginAccessories };
    renderer.render(design, equipped);
    assert.equal(recalculations, 6); assert.equal(factoryCalls, 6);
    const installed = fixture.snapshot(), cached = recalculations;
    for (let i = 0; i < 20; i++) renderer.render(design, equipped);
    assert.equal(recalculations, cached, 'Unchanged frames return the same six fit results');
    assert.equal(fixture.snapshot().uploadedBytes, installed.uploadedBytes);
    assert.equal(renderer.animating, false, 'Equipment alone does not schedule idle frames');
    for (let i = 0; i < 20; i++) renderer.render(design, { ...equipped,
      bodyOrientation: { yaw: i },
      activityFrame: { bob: 0, roll: 0, squash: 1, gaze: [i / 40, -i / 50], blink: i / 20 },
      partAnimation: { accessories: Object.fromEntries(pluginAccessories.map(item => [item.id, { position: [.01, -.01, 0], scale: [1.02, .98, 1], opacity: .8 }])) },
    });
    assert.equal(recalculations, cached, 'Camera, gaze, blink and post-fit TRS do not invalidate fitting');
    assert.equal(fixture.snapshot().uploadedBytes, installed.uploadedBytes);
    renderer.render(design, { ...equipped, pose: { ...state.pose, face: [.02, -.01] } });
    assert.equal(recalculations, cached + 1, 'Only eye-plane follows changed face position');
    assert.equal(fixture.snapshot().bufferSubData - installed.bufferSubData, 1);
    renderer.render(design, equipped);
    const beforeRotation = fixture.snapshot(), fitsBeforeRotation = recalculations;
    renderer.render(design, { ...equipped, partAnimation: { accessories: Object.fromEntries(pluginAccessories.map(item => [item.id, { rotation: [.08, -.06, .12] }])) } });
    const afterRotation = fixture.snapshot();
    assert.equal(recalculations - fitsBeforeRotation, 6);
    assert.equal(afterRotation.bufferData, beforeRotation.bufferData, 'No vertex reallocations or index uploads');
    assert.equal(afterRotation.bufferSubData - beforeRotation.bufferSubData, 3, 'Only glasses and two connector meshes update vertices');
    const derivedBytes = assets.reduce((sum, asset) => sum + (asset.geometry.deformation || asset.geometry.surfaceConnectors ? accessoryPluginGeometryCounts(asset.geometry).vertices * 6 * 4 : 0), 0);
    assert.equal(afterRotation.uploadedBytes - beforeRotation.uploadedBytes, derivedBytes);
    const timeline = new ShapeTimeline('heart'); void timeline.to('boom', { duration: 1000 }); timeline.advance(350);
    void timeline.to('square', { duration: 1000 }); timeline.advance(270);
    const snapshot = timeline.snapshot;
    const morphState = { ...equipped, contour: snapshot.contour, profile: snapshot.profile, shapeWeights: snapshot.shapeWeights };
    renderer.render(design, morphState); const morphed = fixture.snapshot(), morphFits = recalculations;
    renderer.render(design, morphState);
    assert.equal(recalculations, morphFits, 'Unchanged interrupted-morph snapshot is cached');
    assert.equal(fixture.snapshot().uploadedBytes, morphed.uploadedBytes);
    renderer.render(design, state); const removed = fixture.snapshot(), callsAfterRemoval = sampleCalls;
    assert.equal(removed.liveBuffers, empty.liveBuffers);
    renderer.render(design, state); assert.equal(sampleCalls, callsAfterRemoval);
    assert.equal(factoryCalls, 6, 'Factories never run during fitting or rendering');
  } finally { AccessoryPluginFitter.prototype.sample = originalSample; renderer.dispose(); registry.dispose(); }
  assert.equal(fixture.snapshot().liveBuffers, 0);
});
