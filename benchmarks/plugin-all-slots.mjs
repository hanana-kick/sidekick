// Run: node --import tsx benchmarks/plugin-all-slots.mjs
// Production CPU geometry with counting GL, not browser or GPU time.
import { registerHooks } from 'node:module';
import { performance } from 'node:perf_hooks';
import { AccessoryPluginRegistry, accessoryPluginGeometryCounts } from '../src/core/accessory-plugins.ts';
import { createDesign, createAccessory } from '../src/core/design.ts';
import { ShapeTimeline } from '../src/core/shape-motion.ts';
import { initialPose } from '../src/core/motion.ts';
import { AvatarRenderer } from '../src/renderer/webgl.ts';
import { AccessoryPluginFitter } from '../src/core/plugin-mount.ts';
import { bodyGeometry } from '../src/renderer/body-geometry.ts';
import { countingCanvas, distribution } from '../tests/performance-fixture.mjs';
registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(specifier === '@hanana-kick/sidekick-plugin-sdk' ? new URL('../src/plugin-sdk.ts', import.meta.url).href : specifier, context);
} });
const modules = await Promise.all(['halo', 'glasses', 'moustache', 'bow-tie', 'earring'].map(name => import(`../examples/plugin-sdk/catalog/${name}.js`)));
const definitions = [...modules.slice(0, 4).map(module => module.default), modules[4].leftEarring, modules[4].rightEarring];
const registry = new AccessoryPluginRegistry(); let factoryCalls = 0;
definitions.forEach(plugin => registry.register({ ...plugin, createMesh() { factoryCalls++; return plugin.createMesh(); } }));
const assets = await Promise.all(definitions.map(plugin => registry.load(plugin.id)));
const equipped = assets.map((asset, i) => ({ id: `bench-${i}`, slot: asset.slots[0], color: '#c19939', asset }));
const count = 64, warmup = 12;
const base = { pose: initialPose(), activity: 'still', time: 0, delta: 0, reduced: true, style: 'flat' };
const timeline = new ShapeTimeline('heart'), morphs = [];
void timeline.to('boom', { duration: 1000 }); timeline.advance(350);
void timeline.to('square', { duration: 1000 });
for (let i = 0; i < count; i++) {
  timeline.advance(1000 / (count + 1)); const snapshot = timeline.snapshot;
  bodyGeometry(snapshot.contour); // Warm shared topology equally for every scenario.
  morphs.push({ contour: snapshot.contour, profile: snapshot.profile, shapeWeights: snapshot.shapeWeights });
}
const originals = ['halo', 'glasses', 'moustache', 'bowTie', 'earring', 'earring'];
const result = { note: 'Warm CPU-only counting-GL diagnostic, 64 samples after 12 warm-up frames. No GPU/frame-rate claim. Same topology cache and inputs for unequipped, catalog and six external assets. Morph interrupts heart→boom with square.', node: process.version,
  assets: assets.map(asset => ({ id: asset.pluginId, ...accessoryPluginGeometryCounts(asset.geometry) })),
  fullComposed: assets.reduce((sum, asset) => { const c = accessoryPluginGeometryCounts(asset.geometry); return { vertices: sum.vertices + c.vertices, triangles: sum.triangles + c.triangles }; }, { vertices: 0, triangles: 0 }),
};
const last = new WeakMap(); let calls = 0, misses = 0;
const sample = AccessoryPluginFitter.prototype.sample;
AccessoryPluginFitter.prototype.sample = function(...args) { calls++; const fit = sample.apply(this, args); if (last.get(this) !== fit) misses++; last.set(this, fit); return fit; };
function workload(name, i) {
  const t = i % count, rotation = [.12 * Math.sin(t * .31), .08 * Math.cos(t * .23), .1 * Math.sin(t * .17)];
  if (name === 'unchanged') return {};
  if (name === 'presentationOnly') return { bodyOrientation: { yaw: t }, activityFrame: { bob: 0, roll: 0, squash: 1, gaze: [.3 * Math.sin(t), .2 * Math.cos(t)], blink: t / count } };
  return { ...(name === 'interruptedMorphRotation' ? morphs[t] : {}), bodyOrientation: { yaw: t },
    activityFrame: { bob: 0, roll: 0, squash: .9 + .2 * t / (count - 1), gaze: [0, 0], blink: 0 },
    partAnimation: { accessories: Object.fromEntries(equipped.map(item => [item.id, { rotation }])) },
  };
}
function benchmark(mode, name) {
  const fixture = countingCanvas(), renderer = new AvatarRenderer(fixture.canvas);
  const design = createDesign({ accessories: mode === 'catalog' ? equipped.map((item, i) => ({ ...createAccessory(originals[i], { slot: item.slot, id: item.id }), color: item.color })) : [] });
  const state = { ...base, ...(mode === 'external' ? { pluginAccessories: equipped } : {}) };
  renderer.render(design, state);
  for (let i = 0; i < warmup; i++) renderer.render(design, { ...state, ...workload(name, i) });
  const before = fixture.snapshot(), startCalls = calls, startMisses = misses, durations = [];
  for (let i = 0; i < count; i++) { const frame = { ...state, ...workload(name, i) }, start = performance.now(); renderer.render(design, frame); durations.push(performance.now() - start); }
  const after = fixture.snapshot(); renderer.dispose();
  return { ...distribution(durations), fitCalls: calls - startCalls, recomputedFits: misses - startMisses,
    uploadedBytes: after.uploadedBytes - before.uploadedBytes, bufferReallocationsOrIndexUploads: after.bufferData - before.bufferData, vertexBufferUpdates: after.bufferSubData - before.bufferSubData, liveBuffersAfterDispose: fixture.snapshot().liveBuffers };
}
try {
  for (const name of ['unchanged', 'presentationOnly', 'rotationSquash', 'interruptedMorphRotation']) {
    result[name] = {};
    for (const mode of ['none', 'catalog', 'external']) result[name][mode] = benchmark(mode, name);
  }
  result.factoryCalls = factoryCalls;
} finally { AccessoryPluginFitter.prototype.sample = sample; registry.dispose(); }
console.log(JSON.stringify(result, null, 2));
