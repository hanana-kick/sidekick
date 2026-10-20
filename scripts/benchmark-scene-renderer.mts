/** CPU scene preparation/upload accounting only; mock GL excludes driver/GPU.
 * node --import tsx scripts/benchmark-scene-renderer.mts [--reference=/absolute/baseline/repo]
 * Paired alternating rounds reduce JIT/order noise. Do not report this as browser FPS.
 */
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { cpus } from 'node:os';
import { AvatarRenderer } from '../src/renderer/webgl.js';
import { createDesign, createAccessory } from '../src/core/design.js';
import type { AccessoryPreset } from '../src/core/design.js';
import { initialPose } from '../src/core/motion.js';
// @ts-expect-error JavaScript test fixture intentionally models only used GL calls.
import { countingCanvas } from '../tests/performance-fixture.mjs';
const reference = process.argv.find(arg => arg.startsWith('--reference='))?.slice('--reference='.length);
const implementations = [{ name: 'current', Renderer: AvatarRenderer }];
if (reference) implementations.push({ name: 'reference', Renderer: (await import(pathToFileURL(resolve(reference, 'src/renderer/webgl.ts')).href)).AvatarRenderer });
const measurements: { round: number; implementation: string; preset: string; wallMs: number; processCpuMs: number; uploadedBytesPerFrame: number }[] = [];
for (let round = 0; round < 3; round++) for (const preset of ['none', 'beret', 'glasses', 'scarf', 'earring', 'all']) {
  for (const { name, Renderer } of round % 2 ? [...implementations].reverse() : implementations) {
    const f = countingCanvas(), r = new Renderer(f.canvas);
    const equipment = (preset === 'none' ? [] : preset === 'all' ? ['beret', 'glasses', 'moustache', 'scarf', 'earring'] : [preset]) as AccessoryPreset[];
    const design = createDesign({ body: { shape: 'puffy' }, accessories: equipment.map(preset => createAccessory(preset, preset === 'earring' ? { slot: 'leftEar' } : {})) });
    const state = { pose: initialPose(), activity: 'speaking' as const, time: 0, delta: 1 / 60, reduced: false, style: 'flat' as const };
    for (let i = 0; i < 120; i++) { state.time = i / 60; r.render(design, state); }
    const start = performance.now(), cpuStart = process.cpuUsage(), before = f.snapshot();
    for (let i = 0; i < 360; i++) { state.time = (i + 120) / 60; r.render(design, state); }
    const wallMs = (performance.now() - start) / 360, cpu = process.cpuUsage(cpuStart), processCpuMs = (cpu.user + cpu.system) / 1000 / 360, after = f.snapshot();
    measurements.push({ round, implementation: name, preset, wallMs, processCpuMs, uploadedBytesPerFrame: (after.uploadedBytes - before.uploadedBytes) / 360 }); r.dispose();
  }
}
console.log(JSON.stringify({ node: process.version, platform: process.platform, cpu: cpus()[0]?.model ?? 'not exposed', framesPerRound: 360, warmupPerRound: 120, rounds: 3, shape: 'puffy', activity: 'speaking', excludesDriverGPUAndBrowser: true, measurements }, null, 2));
