/** Isolated ABBA comparison for exact body changes in two frozen source graphs. */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { distribution } from '../tests/performance-fixture.mjs';

if (process.argv.length < 5) throw new Error('Usage: node scripts/profile-body-comparison.mjs before-source after-source output-directory');
const before = resolve(process.argv[2]), after = resolve(process.argv[3]), output = resolve(process.argv[4]);
const samples = process.env.SIDEKICK_BODY_SAMPLES ?? '41';
await mkdir(output, { recursive: true });
async function hashes(root, relative = '', result = {}) {
  for (const entry of await readdir(join(root, relative), { withFileTypes: true })) {
    const path = join(relative, entry.name);
    if (entry.isDirectory()) await hashes(root, path, result);
    else result[path] = createHash('sha256').update(await readFile(join(root, path))).digest('hex');
  }
  return result;
}
const beforeHashes = await hashes(before), afterHashes = await hashes(after);
assert.deepEqual(Object.keys(beforeHashes).sort(), Object.keys(afterHashes).sort(), 'source graphs must contain identical files');
const changed = Object.keys(beforeHashes).filter(key => beforeHashes[key] !== afterHashes[key]);
assert.ok(changed.length && changed.every(key => ['renderer/body-geometry.ts', 'renderer/volume-triangulation.ts'].includes(key)), 'only the two owned body modules may differ');
const compile = fileURLToPath(new URL('./profile-source-build.mjs', import.meta.url));
for (const [variant, source] of [['before', before], ['after', after]]) execFileSync(process.execPath, [compile, source, join(output, variant + '-js')]);
await writeFile(join(output, 'manifest.json'), JSON.stringify({ before, after, changed, beforeHashes, afterHashes, samples, order: ['before', 'after', 'after', 'before'] }, null, 2));
if (process.env.SIDEKICK_PREPARE_ONLY === '1') process.exit(0);
const runs = [];
for (const [index, variant] of ['before', 'after', 'after', 'before'].entries()) {
  const name = `${index + 1}-${variant}`, reportPath = join(output, name + '.json');
  const log = execFileSync(process.execPath, ['--expose-gc', fileURLToPath(new URL('./profile-body-geometry.mjs', import.meta.url)), variant === 'before' ? before : after, reportPath], { encoding: 'utf8', env: { ...process.env, SIDEKICK_PROFILE_COMPILED_ROOT: join(output, variant + '-js'), SIDEKICK_BODY_CPU_PROFILE: '0', SIDEKICK_BODY_SAMPLES: samples } });
  await writeFile(join(output, name + '.log'), log);
  runs.push({ variant, name, report: JSON.parse(await readFile(reportPath, 'utf8')) });
}
for (const run of runs) assert.equal(run.report.combinedGeometryHash, runs[0].report.combinedGeometryHash, `${run.name}: geometry byte parity`);
const groups = {};
for (const group of Object.keys(runs[0].report.groups)) {
  const values = variant => runs.filter(run => run.variant === variant).flatMap(run => run.report.rows.filter(row => row.group === group).map(row => row.bodyMs));
  const a = distribution(values('before')), b = distribution(values('after'));
  groups[group] = { before: a, after: b, totalTimeRatio: b.totalMs / a.totalMs };
}
const aggregate = variant => distribution(runs.filter(run => run.variant === variant).flatMap(run => run.report.rows.map(row => row.bodyMs)));
const summary = { createdAt: new Date().toISOString(), methodology: 'Two production-JS processes per variant in ABBA order. Identical frozen dependency graphs except the two body modules; compilation occurs before all measured processes. Fresh immutable contours force body generation, six warmup meshes per process, identical case order and bytes. CPU-only geometry cost excludes browser/GPU/accessories. Requires an agreed quiet window. Report the sample set and repeat count; this is not a universal frame-rate claim.', samplesPerTrajectory: Number(samples), casesPerRun: runs[0].report.rows.length, runs: runs.map(({ name, variant }) => ({ name, variant })), combinedGeometryHash: runs[0].report.combinedGeometryHash, aggregate: { before: aggregate('before'), after: aggregate('after') }, groups };
await writeFile(join(output, 'comparison.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
