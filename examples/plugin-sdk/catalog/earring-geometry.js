/**
 * Original Sidekick hoop/drop geometry, independently authored as an SDK plugin.
 * Copyright (c) 2026 the respective Sidekick authors and rights holders.
 * Sidekick Library and Character License 1.0. See LICENSE in this directory.
 */
import { defineAccessoryGeometry } from '@hanana-kick/sidekick-plugin-sdk';

const subtract = (a, b) => a.map((value, i) => value - b[i]);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function normalize(vector) {
  const length = Math.hypot(...vector);
  return length > 1e-12 ? vector.map(value => value / length) : [0, 0, 1];
}
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
    if (!clipped) throw new Error('Earring pattern must be a simple polygon.');
  }
  triangles.push(...remaining); return triangles;
}
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
// Closed circular-section hoop. No seam, caps, approximation or runtime preset.
function closedTube(mesh, path, radius, sides = 8) {
  const start = mesh.points.length, count = path.length;
  for (let i = 0; i < count; i++) {
    const previous = path[(i + count - 1) % count], next = path[(i + 1) % count];
    const tangent = normalize(subtract(next, previous)), helper = Math.abs(tangent[2]) < .95 ? [0, 0, 1] : [0, 1, 0];
    const a = normalize(cross(tangent, helper)), b = cross(tangent, a);
    for (let j = 0; j < sides; j++) {
      const angle = j / sides * Math.PI * 2, c = Math.cos(angle), s = Math.sin(angle), p = path[i];
      mesh.points.push([p[0] + radius * (a[0] * c + b[0] * s), p[1] + radius * (a[1] * c + b[1] * s), p[2] + radius * (a[2] * c + b[2] * s)]);
    }
  }
  for (let i = 0; i < count; i++) for (let j = 0; j < sides; j++) {
    const a = start + i * sides + j, b = start + (i + 1) % count * sides + j, c = start + i * sides + (j + 1) % sides, d = start + (i + 1) % count * sides + (j + 1) % sides;
    mesh.indices.push(a, c, b, c, d, b);
  }
}

export function createEarringGeometry(side) {
  if (side !== -1 && side !== 1) throw new TypeError('Earring side must be -1 or 1.');
  const mesh = { points: [], indices: [] }, centerX = side * .044;
  closedTube(mesh, Array.from({ length: 36 }, (_, i) => {
    const a = i / 36 * Math.PI * 2;
    return [centerX + .044 * Math.cos(a), -.050 + .044 * Math.sin(a), .012];
  }), .0085);
  // The tapered drop meets the bottom of the full original 36-ring hoop.
  prism(mesh, [[centerX, -.089], [centerX + .018, -.116], [centerX, -.145], [centerX - .018, -.116]], .004, .021);
  const vertices = new Float32Array(mesh.points.length * 6);
  mesh.points.forEach((point, i) => vertices.set(point, i * 6));
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const a = mesh.indices[i], b = mesh.indices[i + 1], c = mesh.indices[i + 2];
    const normal = cross(subtract(mesh.points[b], mesh.points[a]), subtract(mesh.points[c], mesh.points[a]));
    for (const index of [a, b, c]) for (let k = 0; k < 3; k++) vertices[index * 6 + 3 + k] += normal[k];
  }
  for (let i = 0; i < vertices.length; i += 6) vertices.set(normalize([...vertices.subarray(i + 3, i + 6)]), i + 3);
  return defineAccessoryGeometry({
    vertices, indices: new Uint16Array(mesh.indices),
    // Generic append-only surface wire. Its endpoint follows the rigid hoop,
    // while its beginning stays at the body contact. No callback crosses workers.
    surfaceConnectors: [{ kind: 'surface-tube', to: [side * .044, -.006, .012], radius: .0085, rings: 8, sides: 8, clearance: .002 }],
  });
}
