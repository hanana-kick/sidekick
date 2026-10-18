import { coplanarOverlap } from './coplanar.mjs';

export const sub = (a, b) => a.map((v, i) => v - b[i]);
export const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

export function triangles(mesh, scale = [1, 1, 1]) {
  const vertices = mesh.vertices;
  return Array.from({ length: mesh.indices.length / 3 }, (_, id) => {
    const ids = Array.from(mesh.indices.slice(id * 3, id * 3 + 3));
    const p = ids.map(j => [vertices[j * 6] * scale[0], vertices[j * 6 + 1] * scale[1], vertices[j * 6 + 2] * scale[2]]);
    return { id, ids, p, lo: [0, 1, 2].map(k => Math.min(...p.map(q => q[k]))), hi: [0, 1, 2].map(k => Math.max(...p.map(q => q[k]))) };
  });
}

function segmentTriangle(a, b, triangle, epsilon) {
  const direction = sub(b, a), e1 = sub(triangle[1], triangle[0]), e2 = sub(triangle[2], triangle[0]);
  const h = cross(direction, e2), determinant = dot(e1, h);
  if (Math.abs(determinant) < 1e-13) return null;
  const s = sub(a, triangle[0]), u = dot(s, h) / determinant, q = cross(s, e1);
  const v = dot(direction, q) / determinant, fraction = dot(e2, q) / determinant;
  // Exclude strict seam/vertex contact, not every pair that shares a vertex.
  if (u > epsilon && v > epsilon && u + v < 1 - epsilon && fraction > epsilon && fraction < 1 - epsilon) {
    return a.map((value, k) => value + fraction * direction[k]);
  }
  return null;
}

/** Independent triangle tests, including positive-area coplanar overlap. */
export function intersections(A, B = A, options = {}) {
  let count = 0;
  const samples = [], kinds = {}, ringPairs = {}, seenSamples = new Set(), self = A === B;
  const sorted = [...B].sort((a, b) => a.lo[0] - b.lo[0]);
  const classify = options.classify ?? (() => 'surface'), ringOf = options.ringOf ?? (() => 'surface');
  for (const a of A) for (const b of sorted) {
    if (b.lo[0] > a.hi[0]) break;
    if (b.hi[0] < a.lo[0] || self && b.id <= a.id) continue;
    if ([1, 2].some(k => a.lo[k] > b.hi[k] || b.lo[k] > a.hi[k])) continue;
    let p = null, method = 'transverse';
    for (let k = 0; k < 3 && !p; k++) p = segmentTriangle(a.p[k], a.p[(k + 1) % 3], b.p, 1e-6);
    for (let k = 0; k < 3 && !p; k++) p = segmentTriangle(b.p[k], b.p[(k + 1) % 3], a.p, 1e-6);
    if (!p) {
      if (coplanarOverlap(a.p, b.p) <= 1e-10) continue;
      p = a.p[0]; method = 'coplanar-overlap';
    }
    count++;
    const kind = self ? [classify(a), classify(b)].sort().join(':') : 'surface:body';
    kinds[kind] = (kinds[kind] ?? 0) + 1;
    const ringPair = self ? [ringOf(a), ringOf(b)].sort().join(':') : ringOf(a);
    ringPairs[ringPair] = (ringPairs[ringPair] ?? 0) + 1;
    if (samples.length < (options.maxSamples ?? 12)) {
      const key = p.map(v => Math.round(v * 1e6)).join(':') + ':' + kind;
      if (!options.unique || !seenSamples.has(key)) {
        seenSamples.add(key);
        samples.push({ a: a.id, b: b.id, verticesA: a.ids, verticesB: b.ids, p, kind, method });
      }
    }
  }
  return { count, kinds, ringPairs, samples };
}
