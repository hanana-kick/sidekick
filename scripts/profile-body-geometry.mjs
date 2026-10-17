/** Fresh-contour body CPU and exact geometry digest gate; no browser/GPU claims. */
import { performance } from 'node:perf_hooks';
import { Session } from 'node:inspector';
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { resolve, join, dirname, basename } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { tmpdir, cpus } from 'node:os';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { distribution } from '../tests/performance-fixture.mjs';

const source = resolve(process.argv[2] ?? 'src'), output = process.argv[3];
const compiled = process.env.SIDEKICK_PROFILE_COMPILED_ROOT;
const temporary = compiled ? undefined : await mkdtemp(join(tmpdir(), 'sidekick-body-js-'));
const root = compiled ? resolve(compiled) : temporary;
const samples = Number(process.env.SIDEKICK_BODY_SAMPLES ?? 13);
if (!Number.isInteger(samples) || samples < 2 || samples > 1001) throw new RangeError('SIDEKICK_BODY_SAMPLES must be an integer from 2 through 1001.');
let session;
const post = (method, params = {}) => new Promise((resolve, reject) => session.post(method, params, (error, result) => error ? reject(error) : resolve(result)));
try {
  if (!compiled) execFileSync(process.execPath, [fileURLToPath(new URL('./profile-source-build.mjs', import.meta.url)), source, root]);
  const load = name => import(pathToFileURL(join(root, name + '.js')).href);
  const [{ bodyGeometry }, { shapeContour, contourSnapshot }, { buildMorph }, { MATERIAL_SHAPE_NAMES }] = await Promise.all(['renderer/body-geometry', 'core/contours', 'core/morph', 'core/shapes'].map(load));
  const catalog = name => shapeContour({ kind: 'material', name });
  const direct = [['softBoom', 'pixelTriangle'], ['puffy', 'heart'], ['boom', 'circle'], ['pixelTriangle', 'square'], ['circle', 'clover8Leaf']];
  const interrupted = [['softBoom', 'pixelTriangle', 'boom'], ['puffy', 'heart', 'circle']];
  const plans = direct.map(([from, to]) => ({ group: `direct:${from}:${to}`, plan: buildMorph(catalog(from), catalog(to)) }));
  for (const [from, to, final] of interrupted) plans.push({ group: `interrupted:${from}:${to}:${final}`, plan: buildMorph(buildMorph(catalog(from), catalog(to)).sample(.413), catalog(final)) });
  for (let i = 0; i < 6; i++) bodyGeometry(contourSnapshot(plans[0].plan.sample((i + 1) / 8).points));
  globalThis.gc?.();
  const memoryBefore = process.memoryUsage(), rows = [];
  if (process.env.SIDEKICK_BODY_CPU_PROFILE === '1') {
    session = new Session(); session.connect();
    await post('Profiler.enable'); await post('Profiler.setSamplingInterval', { interval: 500 }); await post('Profiler.start');
  }
  const measure = (name, group, original) => {
    // Force an uncached contour for every case, including repeated endpoints.
    // Sampling/copying/hashing are intentionally outside the body timing.
    const contour = contourSnapshot(original.points), start = performance.now();
    const geometry = bodyGeometry(contour), bodyMs = performance.now() - start;
    const bytes = createHash('sha256').update(new Uint8Array(geometry.vertices.buffer, geometry.vertices.byteOffset, geometry.vertices.byteLength)).update(new Uint8Array(geometry.indices.buffer, geometry.indices.byteOffset, geometry.indices.byteLength)).digest('hex');
    rows.push({ name, group, bodyMs, contourPoints: contour.points.length, vertices: geometry.vertices.length / 6, indices: geometry.indices.length, bytes });
  };
  for (const name of MATERIAL_SHAPE_NAMES) measure(`static:${name}`, 'static', catalog(name));
  for (const { group, plan } of plans) for (let i = 0; i < samples; i++) measure(`${group}:${i}/${samples - 1}`, group, plan.sample(i / (samples - 1)));
  let profile, profileSummary;
  if (session) {
    ({ profile } = await post('Profiler.stop')); session.disconnect(); session = undefined;
    const nodes = new Map(profile.nodes.map(node => [node.id, node])), parents = new Map();
    for (const node of profile.nodes) for (const child of node.children ?? []) parents.set(child, node.id);
    const sums = new Map();
    const keyOf = node => `${basename(node.callFrame.url)}:${node.callFrame.lineNumber + 1}:${node.callFrame.functionName || '(anonymous)'}`;
    const entry = key => { if (!sums.has(key)) sums.set(key, { frame: key, selfMs: 0, inclusiveMs: 0 }); return sums.get(key); };
    for (let i = 0; i < profile.samples.length; i++) {
      let id = profile.samples[i]; const ms = profile.timeDeltas[i] / 1000, seen = new Set();
      entry(keyOf(nodes.get(id))).selfMs += ms;
      while (id !== undefined) { const key = keyOf(nodes.get(id)); if (!seen.has(key)) { entry(key).inclusiveMs += ms; seen.add(key); } id = parents.get(id); }
    }
    profileSummary = [...sums.values()].sort((a, b) => b.inclusiveMs - a.inclusiveMs).slice(0, 80);
  }
  globalThis.gc?.();
  const hashes = Object.fromEntries(await Promise.all(['renderer/body-geometry.ts', 'renderer/volume-triangulation.ts', 'core/contours.ts', 'core/morph.ts', 'core/body-volume.ts'].map(async path => [path, createHash('sha256').update(await readFile(join(source, path))).digest('hex')])));
  const groups = Object.fromEntries([...new Set(rows.map(row => row.group))].map(group => [group, distribution(rows.filter(row => row.group === group).map(row => row.bodyMs))]));
  const report = { createdAt: new Date().toISOString(), source, hashes, samples, node: process.version, cpu: cpus()[0]?.model,
    methodology: 'Production-style ES2022 JavaScript. Compilation completes in a separate process before measurements. Six warmup geometries, then fresh immutable contours for all measured meshes. Body timings exclude morph setup, sampling, digest and browser/GPU work. Optional V8 profile includes surrounding sampling/digest work and is for stage attribution, not final latency comparison. Run latency comparisons only in a coordinated quiet window.',
    rows, groups, combinedGeometryHash: createHash('sha256').update(rows.map(row => `${row.name}:${row.bytes}`).join('\n')).digest('hex'), memoryBefore, memoryAfter: process.memoryUsage(), ...(profileSummary ? { profileSummary } : {}) };
  if (output) { await mkdir(dirname(output), { recursive: true }); await writeFile(output, JSON.stringify(report, null, 2)); if (profile) await writeFile(output.replace(/\.json$/, '') + '.cpuprofile', JSON.stringify(profile)); }
  console.log(JSON.stringify({ output, groups, combinedGeometryHash: report.combinedGeometryHash, ...(profileSummary ? { profileSummary: profileSummary.slice(0, 20) } : {}) }, null, 2));
} finally { session?.disconnect(); if (temporary) await rm(temporary, { recursive: true, force: true }); }
