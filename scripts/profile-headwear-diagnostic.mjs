/** Short, explicitly provisional CPU check; no GPU/browser or isolated-speedup claim. */
import { performance } from 'node:perf_hooks';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { cpus, tmpdir } from 'node:os';
import { distribution } from '../tests/performance-fixture.mjs';
import { transpileProfileSource } from './profile-source-build.mjs';

const sourceRoot = pathToFileURL(resolve(process.argv[2] ?? 'src') + '/');
const temporary = process.env.SIDEKICK_PROFILE_COMPILED_ROOT ? undefined : await mkdtemp(join(tmpdir(), 'sidekick-headwear-js-'));
if (temporary) await transpileProfileSource(fileURLToPath(sourceRoot), temporary);
const importRoot = pathToFileURL(resolve(process.env.SIDEKICK_PROFILE_COMPILED_ROOT ?? temporary) + '/');
const load = path => import(new URL(path + '.js', importRoot).href);
const [{ createDesign, createAccessory }, { resolveDesign }, { beretGeometry }] = await Promise.all(['core/design', 'core/resolved-design', 'renderer/beret-geometry'].map(load));
const samples = Number(process.env.SIDEKICK_HEADWEAR_SAMPLES ?? 12), rows = [];
for (const shape of ['circle', 'boom', 'softBoom']) for (const preset of ['beret', 'crown']) {
  const design = resolveDesign(createDesign({ body: { shape }, accessories: [createAccessory(preset)] })), accessory = design.accessories[0];
  const coldStart = performance.now(); beretGeometry(design.body, accessory, 1); const coldMs = performance.now() - coldStart;
  for (let i = 0; i < 3; i++) beretGeometry(design.body, accessory, 1 + Math.sin(i + .1) * .016);
  const samplesMs = [], squashes = []; let outputBytes = 0;
  for (let i = 0; i < samples; i++) {
    const squash = 1 + Math.sin((i + 1) / 13 * 2.2) * .016, started = performance.now();
    const geometry = beretGeometry(design.body, accessory, squash);
    samplesMs.push(performance.now() - started); squashes.push(squash); outputBytes = geometry.vertices.byteLength + geometry.indices.byteLength;
  }
  const row = { shape, preset, coldMs, ...distribution(samplesMs), samplesMs, squashes, outputBytes }; rows.push(row); console.log(JSON.stringify(row));
}
const renderer = await readFile(new URL('renderer/beret-geometry.ts', sourceRoot), 'utf8');
const report = { createdAt: new Date().toISOString(), sourceRoot: sourceRoot.href, importRoot: importRoot.href, execution: 'Production-style TypeScript ES2022 output without tsx instrumentation', beretSHA256: createHash('sha256').update(renderer).digest('hex'), cpu: cpus()[0]?.model, node: process.version, methodology: 'Diagnostic-only prewarmed headwear geometry with changing exact squash, 12 samples per shape/preset by default. Other QA may contend. No GPU, renderer, scheduler or browser time; coarse cost magnitude only, not an isolated benchmark or before/after optimization claim.', rows };
if (process.argv[3]) { await mkdir(dirname(process.argv[3]), { recursive: true }); await writeFile(process.argv[3], JSON.stringify(report, null, 2)); }
if (temporary) await rm(temporary, { recursive: true, force: true });
