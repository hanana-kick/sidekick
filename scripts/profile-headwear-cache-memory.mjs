/** Retained chart allocation diagnostic in isolated JS; no public API is changed. */
import { mkdtemp, readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { transpileProfileSource } from './profile-source-build.mjs';

if (!global.gc) throw new Error('Run with node --expose-gc for retained-memory accounting.');
const source = resolve(process.argv[2] ?? 'src'), temporary = await mkdtemp(join(tmpdir(), 'sidekick-chart-memory-'));
try {
  await transpileProfileSource(source, temporary);
  const path = join(temporary, 'renderer/beret-geometry.js');
  await writeFile(path, await readFile(path, 'utf8') + `
// Private diagnostic hooks exist only in this disposable measurement copy.
export function __profileChart(contour) { const chart = supportChart(contour); return { points: chart.points.length, triangles: chart.indices.length / 3, indexBytes: chart.indices.byteLength, residentEntries: supportCharts.size }; }
export function __profileClear(contours) { for (const contour of contours) supportCharts.delete(contour); }
`);
  const load = name => import(pathToFileURL(join(temporary, name + '.js')).href);
  const [{ MATERIAL_SHAPE_NAMES }, { shapeContour, contourSignedDistanceExact }, { accessoryChartDiagnostics }, { __profileChart, __profileClear }] = await Promise.all(['core/design', 'core/contours', 'core/surface', 'renderer/beret-geometry'].map(load));
  const contours = MATERIAL_SHAPE_NAMES.map(shape => shapeContour({ kind: 'material', name: shape }));
  // Separate heavy chart retention from already-retained catalog contours,
  // raw-distance indexes and continuous mount-chart data.
  for (const contour of contours) { contourSignedDistanceExact(contour, 0, 0); accessoryChartDiagnostics(contour); }
  const memory = () => { global.gc(); global.gc(); return process.memoryUsage(); };
  const before = memory(), checkpoints = [], charts = [];
  for (let i = 0; i < contours.length; i++) {
    charts.push({ shape: MATERIAL_SHAPE_NAMES[i], ...__profileChart(contours[i]) });
    if ([1, 4, 35].includes(i + 1)) checkpoints.push({ visited: i + 1, residentEntries: charts[i].residentEntries ?? i + 1, memory: memory() });
  }
  __profileClear(contours); const afterClear = memory();
  const report = { createdAt: new Date().toISOString(), source, sourceSHA256: createHash('sha256').update(await readFile(join(source, 'renderer/beret-geometry.ts'))).digest('hex'), methodology: 'Node process retained-memory diagnostic, explicit GC, private hooks only in disposable compiled JS. Catalog contours, exact distance indexes and mount charts are warmed before baseline. The cache is filled across all 35 catalog contours, then explicitly cleared. Heap differences include V8 allocation noise and are not browser/GPU or per-thread native-memory measurements.', before, checkpoints, afterClear, charts };
  for (const point of checkpoints) point.delta = Object.fromEntries(Object.keys(before).map(key => [key, point.memory[key] - before[key]]));
  if (process.argv[3]) { await mkdir(dirname(process.argv[3]), { recursive: true }); await writeFile(process.argv[3], JSON.stringify(report, null, 2)); }
  console.log(JSON.stringify({ source, checkpoints, afterClear, chartPoints: [Math.min(...charts.map(x => x.points)), Math.max(...charts.map(x => x.points))], chartIndexBytes: [Math.min(...charts.map(x => x.indexBytes)), Math.max(...charts.map(x => x.indexBytes))] }, null, 2));
} finally { await rm(temporary, { recursive: true, force: true }); }
