import type { Primitive3D } from '../../types.js';

export interface Mesh {
  position: Float32Array;
  normal: Float32Array;
  index: Uint16Array;
}

export type MeshKind = Primitive3D['kind'];

/**
 * Unit-sized meshes (radius/half-extent 1). The model matrix supplies scale,
 * which is why "capsule" is simply a sphere stretched on Y.
 */
function superellipsoid(segments: number, exponent: number): Mesh {
  const n = Math.max(2, exponent);
  const rings = Math.max(6, Math.round(segments / 2));
  const sides = Math.max(10, segments);
  const position: number[] = [];
  const normal: number[] = [];
  const index: number[] = [];
  for (let i = 0; i <= rings; i += 1) {
    const phi = (i / rings) * Math.PI - Math.PI / 2;
    const sp = Math.sin(phi);
    const cp = Math.cos(phi);
    for (let j = 0; j <= sides; j += 1) {
      const theta = (j / sides) * Math.PI * 2;
      const st = Math.sin(theta);
      const ct = Math.cos(theta);
      const x = Math.sign(ct) * Math.abs(ct) ** (2 / n) * cp;
      const y = Math.sign(sp) * Math.abs(sp) ** (2 / n);
      const z = Math.sign(st) * Math.abs(st) ** (2 / n) * cp;
      position.push(x, y, z);
      const len = Math.hypot(x, y, z) || 1;
      normal.push(x / len, y / len, z / len);
    }
  }
  const stride = sides + 1;
  for (let i = 0; i < rings; i += 1) {
    for (let j = 0; j < sides; j += 1) {
      const a = i * stride + j;
      const b = a + stride;
      index.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  return {
    position: new Float32Array(position),
    normal: new Float32Array(normal),
    index: new Uint16Array(index),
  };
}

function tube(segments: number, topRatio: number, bottomRatio: number, halfHeight: number): Mesh {
  const sides = Math.max(12, segments);
  const position: number[] = [];
  const normal: number[] = [];
  const index: number[] = [];
  const slope = (bottomRatio - topRatio) / (halfHeight * 2 || 1);
  for (const ring of [
    { y: -halfHeight, r: bottomRatio },
    { y: halfHeight, r: topRatio },
  ]) {
    for (let j = 0; j <= sides; j += 1) {
      const a = (j / sides) * Math.PI * 2;
      const x = Math.cos(a) * ring.r;
      const z = Math.sin(a) * ring.r;
      position.push(x, ring.y, z);
      const len = Math.hypot(x, slope, z) || 1;
      normal.push(x / len, slope / len, z / len);
    }
  }
  const stride = sides + 1;
  for (let j = 0; j < sides; j += 1) {
    const a = j;
    const b = j + stride;
    index.push(a, b, a + 1, b, b + 1, a + 1);
  }

  const capAt = (y: number, r: number, up: boolean) => {
    if (r <= 0.001) return;
    const base = position.length / 3;
    position.push(0, y, 0);
    normal.push(0, up ? 1 : -1, 0);
    for (let j = 0; j <= sides; j += 1) {
      const a = (j / sides) * Math.PI * 2;
      position.push(Math.cos(a) * r, y, Math.sin(a) * r);
      normal.push(0, up ? 1 : -1, 0);
    }
    for (let j = 0; j < sides; j += 1) {
      if (up) index.push(base, base + 1 + j, base + 2 + j);
      else index.push(base, base + 2 + j, base + 1 + j);
    }
  };
  capAt(halfHeight, topRatio, true);
  capAt(-halfHeight, bottomRatio, false);

  return {
    position: new Float32Array(position),
    normal: new Float32Array(normal),
    index: new Uint16Array(index),
  };
}

function torus(segments: number): Mesh {
  const sides = Math.max(14, segments);
  const tubeSeg = Math.max(8, Math.round(segments * 0.7));
  const R = 0.78;
  const r = 0.22;
  const position: number[] = [];
  const normal: number[] = [];
  const index: number[] = [];
  for (let i = 0; i <= sides; i += 1) {
    const u = (i / sides) * Math.PI * 2;
    for (let j = 0; j <= tubeSeg; j += 1) {
      const v = (j / tubeSeg) * Math.PI * 2;
      const cu = Math.cos(u);
      const su = Math.sin(u);
      const nx = cu * Math.cos(v);
      const ny = Math.sin(v);
      const nz = su * Math.cos(v);
      position.push(cu * R + nx * r, ny * r, su * R + nz * r);
      normal.push(nx, ny, nz);
    }
  }
  const stride = tubeSeg + 1;
  for (let i = 0; i < sides; i += 1) {
    for (let j = 0; j < tubeSeg; j += 1) {
      const a = i * stride + j;
      const b = a + stride;
      index.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  return {
    position: new Float32Array(position),
    normal: new Float32Array(normal),
    index: new Uint16Array(index),
  };
}

const cache = new Map<string, Mesh>();

export function getMesh(kind: MeshKind, segments = 16): Mesh {
  const resolved: MeshKind = kind === 'capsule' ? 'sphere' : kind;
  const key = `${resolved}:${segments}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const mesh = build(resolved, segments);
  cache.set(key, mesh);
  return mesh;
}

function build(kind: MeshKind, segments: number): Mesh {
  switch (kind) {
    case 'box':
      return superellipsoid(segments, 7);
    case 'cylinder':
      return tube(Math.max(14, segments), 1, 1, 1);
    case 'cone':
      return tube(Math.max(14, segments), 0.02, 1, 1);
    case 'torus':
      return torus(segments);
    case 'disc':
      return tube(Math.max(18, segments), 1, 1, 0.12);
    default:
      return superellipsoid(segments, 2);
  }
}

export function __clearMeshCache(): void {
  cache.clear();
}
