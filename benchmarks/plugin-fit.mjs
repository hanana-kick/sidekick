// Run: node --import tsx benchmarks/plugin-fit.mjs
// CPU-only diagnostic with counting GL, not a browser/GPU throughput claim.
import { registerHooks } from 'node:module';
import { performance } from 'node:perf_hooks';
import { AccessoryPluginRegistry } from '../src/core/accessory-plugins.ts';
import { AccessoryPluginFitter } from '../src/core/plugin-mount.ts';
import { createDesign } from '../src/core/design.ts';
import { ShapeTimeline } from '../src/core/shape-motion.ts';
import { initialPose } from '../src/core/motion.ts';
import { AvatarRenderer } from '../src/renderer/webgl.ts';
import { bodyGeometry } from '../src/renderer/body-geometry.ts';
import { sphere } from '../src/renderer/geometry.ts';
import { countingCanvas } from '../tests/performance-fixture.mjs';

registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(specifier === '@hanana-kick/sidekick-plugin-sdk' ? new URL('../src/plugin-sdk.ts', import.meta.url).href : specifier, context);
} });
const definitions = await Promise.all(['moustache', 'bow-tie'].map(async name => (await import(`../examples/plugin-sdk/catalog/${name}.js`)).default));
const registry = new AccessoryPluginRegistry(); definitions.forEach(plugin => registry.register(plugin));
const assets = await Promise.all(definitions.map(plugin => registry.load(plugin.id)));
const fitters = assets.map(asset => new AccessoryPluginFitter(asset)), body = createDesign().body;
const frames = Array.from({ length: 32 }, (_, i) => ({ squash: .9 + .2 * i / 31, rotation: [.15 * Math.sin(i), .08 * Math.cos(i), .1 * i / 31] }));
function measure(fn, count = 32) {
  for (let i = 0; i < 8; i++) fn(i);
  const durations = [];
  for (let i = 0; i < count; i++) { const start = performance.now(); fn(i); durations.push(performance.now() - start); }
  durations.sort((a, b) => a - b);
  return { samples: count, medianMs: durations[Math.floor(count / 2)], p95Ms: durations[Math.ceil(count * .95) - 1], maxMs: durations.at(-1) };
}
const result = { note: 'Warm CPU-only synthetic WebGL; no GPU timing; two real external assets; per-shape body geometry caches shared.', assets: assets.map(a => ({ id: a.pluginId, vertices: a.geometry.vertices.length / 6, triangles: a.geometry.indices.length / 3 })) };
result.unchangedTwoFits = measure(() => fitters.forEach(f => f.sample(body)), 1000);
result.rotationSquashTwoFits = measure(i => fitters.forEach(f => f.sample(body, frames[i % frames.length])));
const timeline = new ShapeTimeline('heart'), morphs = [];
void timeline.to('boom', { duration: 1000, easing: 'linear' });
for (let i = 0; i < 32; i++) { timeline.advance(1000 / 32); const snapshot = timeline.snapshot; bodyGeometry(snapshot.contour); morphs.push({ contour: snapshot.contour, depth: snapshot.profile.depth, shapeWeights: snapshot.shapeWeights }); }
result.morphTwoFits = measure(i => fitters.forEach(f => f.sample(body, morphs[i % morphs.length])));
// Closed, consistently wound sphere near the fitted-only complexity ceiling.
const dense = { ...assets[0], geometry: sphere(16, 16) }, denseFitter = new AccessoryPluginFitter(dense);
result.nearLimitMesh = { vertices: dense.geometry.vertices.length / 6, triangles: dense.geometry.indices.length / 3, ...measure(i => denseFitter.sample(body, frames[i % frames.length]), 16) };
function renderBenchmark(equipped) {
  const fixture = countingCanvas(), renderer = new AvatarRenderer(fixture.canvas), design = createDesign();
  const state = { pose: initialPose(), activity: 'still', time: 0, delta: 0, reduced: true, style: 'flat', pluginAccessories: equipped ? assets.map((asset, i) => ({ id: `bench-${i}`, slot: i ? 'neck' : 'mouth', color: '#b84742', asset })) : undefined };
  renderer.render(design, state); const before = fixture.snapshot();
  const timing = measure(i => renderer.render(design, { ...state, bodyOrientation: { yaw: i }, activityFrame: { bob: 0, roll: 0, squash: frames[i % frames.length].squash, gaze: [0, 0], blink: 0 }, partAnimation: { accessories: { 'bench-0': { rotation: frames[i % frames.length].rotation }, 'bench-1': { rotation: frames[i % frames.length].rotation } } } }));
  const uploadedBytes = fixture.snapshot().uploadedBytes - before.uploadedBytes;
  renderer.dispose(); return { ...timing, uploadedBytesDuringAnimation: uploadedBytes, buffersAfterDispose: fixture.snapshot().liveBuffers };
}
result.rendererWithoutPlugins = renderBenchmark(false);
result.rendererWithTwoPlugins = renderBenchmark(true);
console.log(JSON.stringify(result, null, 2));
