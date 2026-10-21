/**
 * Original Sidekick catalog silhouettes, ported to an external plugin author.
 * Copyright (c) 2026 the respective Sidekick authors and rights holders.
 * Distributed under the Sidekick Library and Character License 1.0. See LICENSE.
 * No runtime geometry, preset dispatch, or private runtime imports are used.
 */
import { defineAccessoryGeometry } from '@hanana-kick/sidekick-plugin-sdk';

/** @typedef {import('@hanana-kick/sidekick-plugin-sdk').Vec2} Vec2 */
/** @typedef {import('@hanana-kick/sidekick-plugin-sdk').Vec3} Vec3 */
/** @typedef {{points: Vec3[], indices: number[], mainIndexCount: number}} Pattern */

/** Ear clipping preserves the deliberately concave, curled moustache outline. */
function triangulate(points) {
  const remaining = points.map((_, i) => i), triangles = [];
  const area = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  while (remaining.length > 3) {
    let clipped = false;
    for (let i = 0; i < remaining.length; i++) {
      const a = remaining[(i + remaining.length - 1) % remaining.length], b = remaining[i], c = remaining[(i + 1) % remaining.length];
      if (area(points[a], points[b], points[c]) <= 1e-12) continue;
      if (remaining.some(index => index !== a && index !== b && index !== c && area(points[a], points[b], points[index]) >= -1e-12 && area(points[b], points[c], points[index]) >= -1e-12 && area(points[c], points[a], points[index]) >= -1e-12)) continue;
      triangles.push(a, b, c); remaining.splice(i, 1); clipped = true; break;
    }
    if (!clipped) throw new Error('Accessory pattern must be a simple polygon.');
  }
  triangles.push(...remaining); return triangles;
}

/** @returns {Pattern} */
const empty = () => ({ points: [], indices: [], mainIndexCount: 0 });
function prism(mesh, pattern, back, front) {
  let polygon = [...pattern];
  const signed = polygon.reduce((sum, p, i) => { const q = polygon[(i + 1) % polygon.length]; return sum + p[0] * q[1] - q[0] * p[1]; }, 0);
  if (signed < 0) polygon = polygon.reverse();
  const start = mesh.points.length, count = polygon.length, faces = triangulate(polygon);
  for (const z of [back, front]) for (const [x, y] of polygon) mesh.points.push([x, y, z]);
  for (let i = 0; i < faces.length; i += 3) {
    const a = faces[i], b = faces[i + 1], c = faces[i + 2];
    mesh.indices.push(start + a, start + c, start + b, start + count + a, start + count + b, start + count + c);
  }
  for (let i = 0; i < count; i++) {
    const a = start + i, b = start + (i + 1) % count;
    mesh.indices.push(a, b, a + count, b, b + count, a + count);
  }
}
function cubic(a, b, c, d, steps = 6) {
  return Array.from({ length: steps }, (_, i) => {
    const t = (i + 1) / steps, s = 1 - t;
    return [s ** 3 * a[0] + 3 * s * s * t * b[0] + 3 * s * t * t * c[0] + t ** 3 * d[0], s ** 3 * a[1] + 3 * s * s * t * b[1] + 3 * s * t * t * c[1] + t ** 3 * d[1]];
  });
}

/** @param {Pattern} mesh */
function geometry(mesh) {
  const vertices = new Float32Array(mesh.points.length * 6);
  mesh.points.forEach((p, i) => vertices.set(p, i * 6));
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const a = mesh.indices[i], b = mesh.indices[i + 1], c = mesh.indices[i + 2];
    const u = mesh.points[b].map((v, k) => v - mesh.points[a][k]);
    const v = mesh.points[c].map((v, k) => v - mesh.points[a][k]);
    const normal = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    for (const index of [a, b, c]) for (let k = 0; k < 3; k++) vertices[index * 6 + 3 + k] += normal[k];
  }
  for (let i = 0; i < vertices.length; i += 6) {
    const length = Math.hypot(vertices[i + 3], vertices[i + 4], vertices[i + 5]);
    vertices.set(length > 1e-12 ? [vertices[i + 3] / length, vertices[i + 4] / length, vertices[i + 5] / length] : [0, 0, 1], i + 3);
  }
  const parts = [{ indexStart: 0, indexCount: mesh.mainIndexCount }];
  if (mesh.mainIndexCount < mesh.indices.length) {
    // A flat material, not lighting: preserve the catalog's dark knot exactly.
    parts.push({ indexStart: mesh.mainIndexCount, indexCount: mesh.indices.length - mesh.mainIndexCount, material: { multiplier: .78 } });
  }
  return defineAccessoryGeometry({ vertices, indices: new Uint16Array(mesh.indices), parts });
}

export function createMoustacheGeometry() {
  const mesh = empty(), top = [0, .018], bottom = [0, -.014];
  const right = [top,
    ...cubic(top, [.027, .056], [.061, .056], [.091, .021]),
    ...cubic([.091, .021], [.126, -.009], [.160, .003], [.190, .047]),
    ...cubic([.190, .047], [.180, -.023], [.126, -.067], [.079, -.052]),
    ...cubic([.079, -.052], [.038, -.040], [.015, -.015], bottom),
  ];
  // One continuous two-lobe prism, including the lifted tips and center cleft.
  prism(mesh, [...right, ...right.slice(1, -1).reverse().map(([x, y]) => [-x, y])], 0, .034);
  mesh.mainIndexCount = mesh.indices.length;
  return geometry(mesh);
}

export function createBowTieGeometry() {
  const mesh = empty();
  const loop = [[.026, .028], [.145, .083], [.171, .073], [.181, .045], [.181, -.045], [.163, -.075], [.140, -.080], [.026, -.028]];
  prism(mesh, loop, 0, .040);
  prism(mesh, loop.map(([x, y]) => [-x, y]), 0, .040);
  mesh.mainIndexCount = mesh.indices.length;
  prism(mesh, [[-.031, -.034], [-.022, -.044], [.022, -.044], [.031, -.034], [.031, .034], [.022, .044], [-.022, .044], [-.031, .034]], .004, .058);
  return geometry(mesh);
}
