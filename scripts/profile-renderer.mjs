/** Production-style JS CPU diagnostic, no shared build/browser: node --expose-gc scripts/profile-renderer.mjs [report.json] */
import { performance } from 'node:perf_hooks';
import { writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import { cpus, platform, arch, tmpdir } from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { transpileProfileSource } from './profile-source-build.mjs';
const sourceRoot = process.env.SIDEKICK_PROFILE_SOURCE_ROOT ? pathToFileURL(process.env.SIDEKICK_PROFILE_SOURCE_ROOT.replace(/\/?$/, '/')) : new URL('../src/', import.meta.url);
const temporary = process.env.SIDEKICK_PROFILE_COMPILED_ROOT ? undefined : await mkdtemp(join(tmpdir(), 'sidekick-profile-js-'));
if (temporary) await transpileProfileSource(fileURLToPath(sourceRoot), temporary);
const compiledRoot = pathToFileURL((process.env.SIDEKICK_PROFILE_COMPILED_ROOT ?? temporary).replace(/\/?$/, '/'));
const loadSource = name => import(new URL(name + '.js', compiledRoot).href);
const [{ createDesign, createAccessory, MATERIAL_SHAPE_NAMES }, { ShapeTimeline }, { initialPose }, { AvatarRenderer }] = await Promise.all(['core/design', 'core/shape-motion', 'core/motion', 'renderer/webgl'].map(loadSource));
import { countingCanvas, distribution, numericDelta } from '../tests/performance-fixture.mjs';

const frameCount = Number(process.env.SIDEKICK_PROFILE_FRAMES ?? 48);
const accessories = () => ['beret', 'glasses', 'moustache', 'scarf'].map(preset => createAccessory(preset)).concat(createAccessory('earring', { slot: 'leftEar', id: 'left-earring' }), createAccessory('starEarring', { slot: 'rightEar', id: 'right-earring' }));
const designFor = (shape, equipped) => createDesign({ body: { shape }, accessories: equipped === true ? accessories() : Array.isArray(equipped) ? accessories().filter(accessory => equipped.includes(accessory.preset)) : [] });
const stateFor = timeline => ({ pose: initialPose(), activity: 'still', time: 0, delta: 1 / 60, reduced: true, style: 'flat', ...timeline.snapshot });
const measure = callback => { const start = performance.now(); callback(); return performance.now() - start; };
function runScenario(name, shape, equipped, mode = 'static') {
  const counter = countingCanvas(), constructionStart = performance.now(), renderer = new AvatarRenderer(counter.canvas), constructorMs = performance.now() - constructionStart, design = designFor(shape, equipped), timeline = new ShapeTimeline(shape), state = stateFor(timeline);
  const coldMs = measure(() => renderer.render(design, state));
  for (let i = 0; i < 5; i++) renderer.render(design, state);
  const before = counter.snapshot(), samples = [];
  for (let i = 0; i < frameCount; i++) {
    if (mode === 'idle') { state.activity = 'idle'; state.reduced = false; state.time = (i + 1) / 60; }
    if (mode === 'tracking') { state.bodyOrientation = { yaw: Math.sin(i / 10) * 30, pitch: Math.cos(i / 10) * 20, roll: 0 }; state.pose.rotation = [.1 * Math.sin(i / 8), .2 * Math.cos(i / 8), 0]; state.pose.gaze = [Math.sin(i / 7) * .3, Math.cos(i / 7) * .3]; }
    samples.push(measure(() => renderer.render(design, state)));
  }
  const resources = counter.snapshot(), result = { name, shape, equipped, mode, constructorMs, coldMs, samplesMs: samples, ...distribution(samples), uploads: numericDelta(resources, before), resources };
  renderer.dispose(); result.disposed = counter.snapshot(); return result;
}
function morphScenario(from, to, equipped, interrupted = false) {
  const counter = countingCanvas(), constructionStart = performance.now(), renderer = new AvatarRenderer(counter.canvas), constructorMs = performance.now() - constructionStart, design = designFor(from, equipped), timeline = new ShapeTimeline(from), state = stateFor(timeline);
  renderer.render(design, state);
  const setupMs = measure(() => { void timeline.to(to, { duration: 1000, easing: 'smooth' }); });
  let interruptionSetupMs = 0;
  const samples = [], advance = [], before = counter.snapshot();
  for (let i = 1; i <= frameCount; i++) {
    if (interrupted && i === Math.floor(frameCount * .413)) interruptionSetupMs = measure(() => { void timeline.to('boom', { duration: 1000, easing: 'smooth' }); });
    advance.push(measure(() => timeline.advance(1000 / (frameCount + 1))));
    Object.assign(state, timeline.snapshot); state.time = i / 60;
    samples.push(measure(() => renderer.render(design, state)));
  }
  const resources = counter.snapshot(); renderer.dispose();
  return { from, to, equipped, interrupted, constructorMs, setupMs, interruptionSetupMs, samplesMs: samples, ...distribution(samples), timelineCPU: distribution(advance), uploads: numericDelta(resources, before), resources, disposed: counter.snapshot() };
}
// Warm generic JIT paths without priming every endpoint's immutable geometry.
const startup = runScenario('startup', 'softBoom', true);
global.gc?.(); const memoryBefore = process.memoryUsage();
const report = { metadata: { createdAt: new Date().toISOString(), node: process.version, platform: platform(), arch: arch(), cpu: cpus()[0]?.model, frameCount, mode: process.env.SIDEKICK_PROFILE_MODE ?? 'full', sourceRoot: sourceRoot.href, compiledRoot: compiledRoot.href, methodology: 'Production-style TypeScript ES2022 output (no tsx keep-name instrumentation), actual geometry and renderer with counting no-op GL. No GPU timing, browser frame-rate claim, or hardware-device emulation. Cold endpoint runs may reuse catalog caches warmed by earlier scenarios.', sources: ['https://chromedevtools.github.io/devtools-protocol/tot/Emulation/#method-setCPUThrottlingRate', 'https://developer.mozilla.org/en-US/docs/Web/API/DedicatedWorkerGlobalScope/requestAnimationFrame'] }, startup, endpoints: [], representative: [], morphs: [], accessoryBreakdown: [] };
if (process.env.SIDEKICK_PROFILE_MODE !== 'accessories') for (const shape of MATERIAL_SHAPE_NAMES) report.endpoints.push(runScenario('catalog-equipped-static', shape, true));
if (process.env.SIDEKICK_PROFILE_MODE !== 'accessories') for (const shape of ['circle', 'heart', 'softBoom', 'pixelTriangle', 'puffy']) for (const mode of ['static', 'idle', 'tracking']) report.representative.push(runScenario(`equipped-${mode}`, shape, true, mode));
if (process.env.SIDEKICK_PROFILE_MODE !== 'accessories') for (const [from, to] of [['softBoom', 'pixelTriangle'], ['puffy', 'heart']]) for (const equipped of [false, true]) for (const interrupted of [false, true]) report.morphs.push(morphScenario(from, to, equipped, interrupted));
for (const shape of ['softBoom', 'puffy']) for (const presets of [[], ['beret'], ['glasses'], ['moustache'], ['scarf'], ['earring', 'starEarring']]) report.accessoryBreakdown.push(runScenario('accessory-idle', shape, presets, 'idle'));
global.gc?.(); report.memory = { before: memoryBefore, afterGC: process.memoryUsage(), explicitGC: typeof global.gc === 'function', note: 'Process-level observation including cached endpoints, JIT and report data; not a browser-worker memory measurement.' };
const summary = { startup: { constructorMs: startup.constructorMs, firstRenderMs: startup.coldMs, retainedGPUBytes: startup.resources.retainedGPUBytes }, endpoints: report.endpoints.length, staticP95Max: Math.max(...report.endpoints.map(x => x.p95Ms)), mostExpensiveCold: [...report.endpoints].sort((a, b) => b.coldMs - a.coldMs).slice(0, 5).map(({shape,coldMs}) => ({shape,coldMs})), representative: report.representative.map(({shape,mode,medianMs,p95Ms,uploads}) => ({shape,mode,medianMs,p95Ms,uploadedBytes:uploads.uploadedBytes})), accessoryBreakdown: report.accessoryBreakdown.map(({shape,equipped,medianMs,p95Ms,uploads}) => ({shape,equipped,medianMs,p95Ms,uploadedBytes: uploads.uploadedBytes})), morphs: report.morphs.map(({from,to,equipped,interrupted,medianMs,p95Ms,maxMs}) => ({from,to,equipped,interrupted,medianMs,p95Ms,maxMs})) };
if (process.argv[2]) { await mkdir(dirname(process.argv[2]), { recursive: true }); await writeFile(process.argv[2], JSON.stringify(report, null, 2)); }
console.log(JSON.stringify(summary, null, 2));
if (temporary) await rm(temporary, { recursive: true, force: true });
