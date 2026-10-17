/** Reproducible CPU/mesh diagnostic: npm run build && node tests/body-geometry.bench.mjs */
import { performance } from 'node:perf_hooks';
import { shapeContour, contourSnapshot } from '../dist/src/core/contours.js';
import { buildMorph } from '../dist/src/core/morph.js';
import { contourVolumeHeight } from '../dist/src/core/body-volume.js';
import { bodyGeometry, BODY_HEIGHT_TOLERANCE, BODY_SURFACE_TOLERANCE, BODY_VOLUME_MAX_POINTS } from '../dist/src/renderer/body-geometry.js';

const shape = name => shapeContour({ kind: 'material', name });
const fresh = name => contourSnapshot(shape(name).points);
const summarize = values => {
  const sorted = [...values].sort((a, b) => a - b);
  return { medianMs: sorted[Math.floor(sorted.length / 2)], p95Ms: sorted[Math.floor((sorted.length - 1) * .95)], maxMs: sorted.at(-1) };
};
function sampledErrors(contour, geometry) {
  let maxPlaneDistance = 0, maxCentralHeight = 0;
  const weights = [[1 / 3, 1 / 3], [.5, 0], [0, .5], [.5, .5], [.5, .25], [.25, .5], [.25, .25]];
  // Front/back triangles are interleaved. These are diagnostic sample maxima,
  // not proofs of global error or distance to the closest finite mesh triangle.
  for (let i = 0; i < geometry.indices.length; i += 6) {
    const points = [0, 1, 2].map(k => {
      const start = geometry.indices[i + k] * 6;
      return geometry.vertices.subarray(start, start + 3);
    });
    const [a, b, c] = points;
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nz = (ux * vy - uy * vx) / Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
    for (const [u, v] of weights) {
      const x = a[0] * u + b[0] * v + c[0] * (1 - u - v);
      const y = a[1] * u + b[1] * v + c[1] * (1 - u - v);
      const z = a[2] * u + b[2] * v + c[2] * (1 - u - v);
      const error = Math.abs(contourVolumeHeight(contour, x, y) - z);
      maxPlaneDistance = Math.max(maxPlaneDistance, error * nz);
      if (x * x + y * y < .09) maxCentralHeight = Math.max(maxCentralHeight, error);
    }
  }
  return { maxPlaneDistance, maxCentralHeight };
}
for (let i = 0; i < 8; i++) bodyGeometry(fresh('softBoom'));
const report = {
  targets: { sampledSurfaceDistance: BODY_SURFACE_TOLERANCE, sampledCentralHeight: BODY_HEIGHT_TOLERANCE, maxHalfMeshPoints: BODY_VOLUME_MAX_POINTS },
  static: [], transitions: [],
};
for (const name of ['circle', 'heart', 'pixelTriangle', 'softBoom', 'puffy']) {
  const times = []; let mesh;
  for (let i = 0; i < 9; i++) {
    const contour = fresh(name), start = performance.now(); mesh = bodyGeometry(contour); times.push(performance.now() - start);
  }
  report.static.push({ name, ...summarize(times), vertices: mesh.vertices.length / 6, triangles: mesh.indices.length / 3 });
}
for (const [from, to] of [['softBoom', 'pixelTriangle'], ['puffy', 'heart']]) {
  const direct = buildMorph(shape(from), shape(to)), interrupted = buildMorph(direct.sample(.413), shape('boom'));
  const times = []; let maxVertices = 0, maxPlaneDistance = 0, maxCentralHeight = 0;
  for (const morph of [direct, interrupted]) for (let i = 1; i <= 25; i++) {
    const contour = morph.sample(i / 26), start = performance.now(), mesh = bodyGeometry(contour);
    times.push(performance.now() - start); maxVertices = Math.max(maxVertices, mesh.vertices.length / 6);
    if (i % 5 === 0) {
      const errors = sampledErrors(contour, mesh);
      maxPlaneDistance = Math.max(maxPlaneDistance, errors.maxPlaneDistance);
      maxCentralHeight = Math.max(maxCentralHeight, errors.maxCentralHeight);
    }
  }
  report.transitions.push({ from, to, interruptedTarget: 'boom', frames: times.length, ...summarize(times), maxVertices, maxPlaneDistance, maxCentralHeight });
}
console.log(JSON.stringify(report, null, 2));
