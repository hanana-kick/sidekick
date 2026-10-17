/** Isolated CPU comparison. Run after geometry freezes and CPU-heavy QA stops. */
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { distribution } from '../tests/performance-fixture.mjs';
import { transpileProfileSource } from './profile-source-build.mjs';
const exec = promisify(execFile), repository = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(process.argv[2] ?? 'artifacts/performance-cpu');
const afterRoot = join(output, 'source-after'), beforeRoot = join(output, 'source-before');
await mkdir(output, { recursive: true }); await cp(join(repository, 'src'), afterRoot, { recursive: true }); await cp(afterRoot, beforeRoot, { recursive: true });
const rendererPath = 'renderer/webgl.ts', current = await readFile(join(afterRoot, rendererPath), 'utf8');
let baseline = current;
function once(from, to) { if (!baseline.includes(from) || baseline.indexOf(from) !== baseline.lastIndexOf(from)) throw new Error('Counterfactual renderer marker changed: ' + from.slice(0, 80)); baseline = baseline.replace(from, to); }
// Restore only the previous body upload/startup path. Keep final geometry,
// mutation-safe design caching, resize correctness and allocation rollback.
once('interface Mesh { vao:', 'interface Mesh { directionBuffer?: WebGLBuffer; vao:');
once('layout(location=1) in vec3 normal;', 'layout(location=1) in vec3 normal;\nlayout(location=2) in vec3 surfaceDirection;');
once('const upload = (data: Geometry): Mesh => { const mesh = this.upload(data);', 'const upload = (data: Geometry, surface = false): Mesh => { const mesh = this.upload(data, surface);');
once('// The first render uploads the requested body; prebuilding a square here\n      // would duplicate both CPU triangulation and GPU uploads on every startup.', '// Counterfactual baseline: eagerly build/upload a square before the requested design.');
once('this.meshes = { body: upload({ vertices: new Float32Array(0), indices: new Uint16Array(0) }),', "this.meshes = { body: upload(bodyGeometry({ kind: 'material', name: 'square' }), true),");
once('this.bodyDirections = new Float32Array(0);', 'this.bodyDirections = this.meshes.body.data.vertices.slice();');
once('private upload(data: Geometry): Mesh', 'private upload(data: Geometry, surface = false): Mesh');
once('let vao: WebGLVertexArrayObject | null = null, buffer: WebGLBuffer | null = null, index: WebGLBuffer | null = null;', 'let vao: WebGLVertexArrayObject | null = null, buffer: WebGLBuffer | null = null, index: WebGLBuffer | null = null, directionBuffer: WebGLBuffer | null = null;');
once('gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data.indices, gl.STATIC_DRAW);', `gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data.indices, gl.STATIC_DRAW);
      if (surface) {
        directionBuffer = gl.createBuffer(); if (!directionBuffer) throw new Error('GPU direction buffer allocation failed');
        gl.bindBuffer(gl.ARRAY_BUFFER, directionBuffer); gl.bufferData(gl.ARRAY_BUFFER, data.vertices, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 24, 0);
      } else gl.vertexAttrib3f(2, 0, 0, 1);`);
once('return { vao, buffer, index, count: data.indices.length, data };', 'return { directionBuffer: directionBuffer ?? undefined, vao, buffer, index, count: data.indices.length, data };');
once('if (buffer) gl.deleteBuffer(buffer);', 'if (directionBuffer) gl.deleteBuffer(directionBuffer);\n      if (buffer) gl.deleteBuffer(buffer);');
once(`      // Upload the final positions once; the old path uploaded canonical positions
      // then immediately replaced them and also uploaded an unused direction attribute.
      for (let i = 0; i < this.bodyDirections.length; i += 6) {
        const d: Vec3 = [this.bodyDirections[i]!, this.bodyDirections[i + 1]!, this.bodyDirections[i + 2]!];
        body.data.vertices.set(deformBodyPoint(design.body, d, 1, profile), i);
      }
`, '');
once('gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, body.index); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data.indices, gl.DYNAMIC_DRAW);', 'gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, body.index); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data.indices, gl.DYNAMIC_DRAW);\n      gl.bindBuffer(gl.ARRAY_BUFFER, body.directionBuffer!); gl.bufferData(gl.ARRAY_BUFFER, data.vertices, gl.DYNAMIC_DRAW);');
once("this.bodyContour = contour; this.bodyDeformation = String(profile.depth);", "this.bodyContour = contour; this.bodyDeformation = '';");
once('.reduce(count => count + 2, 0)', '.reduce((count, mesh) => count + 2 + (mesh.directionBuffer ? 1 : 0), 0)');
once('private deleteMesh(mesh: Mesh): void {\n', 'private deleteMesh(mesh: Mesh): void {\n    if (mesh.directionBuffer) this.gl.deleteBuffer(mesh.directionBuffer);\n');
await writeFile(join(beforeRoot, rendererPath), baseline);
const metadata = { method: 'Two frozen source trees with identical final geometry. Baseline restores only old eager-square initialization, unused direction attribute and triple body vertex upload; final design caching, aspect projection and transactional failure cleanup remain in both. Sequential ABBA process order limits chronological load/JIT bias. No-op GL measures CPU and exact resource/upload accounting, not hardware GPU or browser FPS.', order: ['before', 'after', 'after', 'before'], afterRendererSHA256: createHash('sha256').update(current).digest('hex'), beforeRendererSHA256: createHash('sha256').update(baseline).digest('hex') };
await writeFile(join(output, 'comparison-manifest.json'), JSON.stringify(metadata, null, 2));
if (process.env.SIDEKICK_PREPARE_ONLY === '1') { console.log(JSON.stringify({ output, ...metadata }, null, 2)); process.exit(0); }
for (const variant of ['before', 'after']) await transpileProfileSource(join(output, `source-${variant}`), join(output, `js-${variant}`));
const runs = [];
for (const [index, variant] of metadata.order.entries()) {
  const file = join(output, `cpu-${index + 1}-${variant}.json`);
  const { stdout, stderr } = await exec(process.execPath, ['--expose-gc', 'scripts/profile-renderer.mjs', file], { cwd: repository, env: { ...process.env, SIDEKICK_PROFILE_SOURCE_ROOT: variant === 'before' ? beforeRoot : afterRoot, SIDEKICK_PROFILE_COMPILED_ROOT: join(output, `js-${variant}`), SIDEKICK_PROFILE_MODE: 'full' }, maxBuffer: 20 * 1024 * 1024 });
  await writeFile(join(output, `cpu-${index + 1}-${variant}.log`), stdout + stderr); runs.push({ variant, file, report: JSON.parse(await readFile(file, 'utf8')) });
}
const summarize = group => {
  const length = runs[0].report[group].length;
  return Array.from({ length }, (_, index) => {
    const item = runs[0].report[group][index], result = { name: item.name, shape: item.shape, mode: item.mode, from: item.from, to: item.to, equipped: item.equipped, interrupted: item.interrupted };
    for (const variant of ['before', 'after']) {
      const values = runs.filter(run => run.variant === variant).map(run => run.report[group][index]);
      result[variant] = { ...distribution(values.flatMap(value => value.samplesMs)), constructorMs: values.map(value => value.constructorMs), uploadedBytesPerRun: values.map(value => value.uploads.uploadedBytes), liveBuffers: values.map(value => value.resources.liveBuffers), retainedGPUBytes: values.map(value => value.resources.retainedGPUBytes) };
    }
    return result;
  });
};
const report = { metadata, runs: runs.map(({ variant, file, report }) => ({ variant, file, startup: report.startup, memory: report.memory })), endpoints: summarize('endpoints'), representative: summarize('representative'), morphs: summarize('morphs'), accessoryBreakdown: summarize('accessoryBreakdown') };
await writeFile(join(output, 'cpu-comparison.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ output, morphs: report.morphs, representative: report.representative }, null, 2));
