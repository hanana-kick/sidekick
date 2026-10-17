import type { Vec3 } from '../core/design.js';
export interface Geometry { vertices: Float32Array; indices: Uint16Array }
export function sphere(longitudes = 32, latitudes = 22, capsule = false): Geometry {
  const vertices: number[] = [], indices: number[] = [];
  for (let y = 0; y <= latitudes; y++) for (let x = 0; x <= longitudes; x++) {
    const theta = y / latitudes * Math.PI, phi = x / longitudes * Math.PI * 2;
    const p: Vec3 = [Math.sin(theta) * Math.cos(phi), Math.cos(theta), Math.sin(theta) * Math.sin(phi)];
    vertices.push(p[0], p[1] + (capsule ? Math.sign(p[1]) * 0.75 : 0), p[2], ...p);
  }
  for (let y = 0; y < latitudes; y++) for (let x = 0; x < longitudes; x++) {
    const a = y * (longitudes + 1) + x, b = a + longitudes + 1;
    if (y !== 0) indices.push(a, a + 1, b);
    if (y !== latitudes - 1) indices.push(b, a + 1, b + 1);
  }
  return { vertices: new Float32Array(vertices), indices: new Uint16Array(indices) };
}
export function torus(tube = 0.1, arc = Math.PI * 2): Geometry {
  const vertices: number[] = [], indices: number[] = [], segments = 48, sides = 10;
  for (let i = 0; i <= segments; i++) for (let j = 0; j <= sides; j++) {
    const a = i / segments * arc, b = j / sides * Math.PI * 2;
    const n: Vec3 = [Math.cos(a) * Math.cos(b), Math.sin(a) * Math.cos(b), Math.sin(b)];
    vertices.push(Math.cos(a) + tube * n[0], Math.sin(a) + tube * n[1], tube * n[2], ...n);
  }
  for (let i = 0; i < segments; i++) for (let j = 0; j < sides; j++) {
    const a = i * (sides + 1) + j, b = a + sides + 1;
    indices.push(a, b, a + 1, b, b + 1, a + 1);
  }
  return { vertices: new Float32Array(vertices), indices: new Uint16Array(indices) };
}
