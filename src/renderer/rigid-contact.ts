import type { Vec3 } from '../core/design.js';
import type { ShapeContour } from '../core/contours.js';
import { bodyGeometry } from './body-geometry.js';

/** Exact rigid front clearance against the cached rendered triangles. */
interface Triangle { a: Vec3; b: Vec3; c: Vec3; minX: number; maxX: number; minY: number; maxY: number; minZ: number; zx: number; zy: number; z0: number; area: number }
function makeTriangle(a: Vec3, b: Vec3, c: Vec3): Triangle | undefined {
  const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  if (Math.abs(area) < 1e-12) return undefined;
  const zx = ((b[2] - a[2]) * (c[1] - a[1]) - (c[2] - a[2]) * (b[1] - a[1])) / area;
  const zy = ((b[0] - a[0]) * (c[2] - a[2]) - (c[0] - a[0]) * (b[2] - a[2])) / area;
  return { a, b, c, minX: Math.min(a[0], b[0], c[0]), maxX: Math.max(a[0], b[0], c[0]), minY: Math.min(a[1], b[1], c[1]), maxY: Math.max(a[1], b[1], c[1]), minZ: Math.min(a[2], b[2], c[2]), zx, zy, z0: a[2] - zx * a[0] - zy * a[1], area };
}
function contains(t: Triangle, p: Vec3): boolean {
  const a = t.a, b = t.b, c = t.c, sign = Math.sign(t.area);
  return ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) * sign >= -1e-10
    && ((c[0] - b[0]) * (p[1] - b[1]) - (c[1] - b[1]) * (p[0] - b[0])) * sign >= -1e-10
    && ((a[0] - c[0]) * (p[1] - c[1]) - (a[1] - c[1]) * (p[0] - c[0])) * sign >= -1e-10;
}
/** Maximum of two linear height fields over their exact triangle intersection. */
function separation(body: Triangle, hat: Triangle, current: number): number {
  const evaluate = (x: number, y: number): void => { current = Math.max(current, (body.zx - hat.zx) * x + (body.zy - hat.zy) * y + body.z0 - hat.z0); };
  if (contains(hat, body.a)) evaluate(body.a[0], body.a[1]);
  if (contains(hat, body.b)) evaluate(body.b[0], body.b[1]);
  if (contains(hat, body.c)) evaluate(body.c[0], body.c[1]);
  if (contains(body, hat.a)) evaluate(hat.a[0], hat.a[1]);
  if (contains(body, hat.b)) evaluate(hat.b[0], hat.b[1]);
  if (contains(body, hat.c)) evaluate(hat.c[0], hat.c[1]);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    const a = i === 0 ? body.a : i === 1 ? body.b : body.c, b = i === 0 ? body.b : i === 1 ? body.c : body.a;
    const c = j === 0 ? hat.a : j === 1 ? hat.b : hat.c, d = j === 0 ? hat.b : j === 1 ? hat.c : hat.a;
    const ux = b[0] - a[0], uy = b[1] - a[1], vx = d[0] - c[0], vy = d[1] - c[1], determinant = ux * vy - uy * vx;
    if (Math.abs(determinant) < 1e-12) continue;
    const dx = c[0] - a[0], dy = c[1] - a[1], t = (dx * vy - dy * vx) / determinant, u = (dx * uy - dy * ux) / determinant;
    if (t >= -1e-9 && t <= 1 + 1e-9 && u >= -1e-9 && u <= 1 + 1e-9) evaluate(a[0] + t * ux, a[1] + t * uy);
  }
  return current;
}

interface FrontGrid { triangles: Triangle[]; cells: Map<string, number[]> }
const cache = new WeakMap<ShapeContour, FrontGrid>();
const CELL = 20;
function frontGrid(contour: ShapeContour): FrontGrid {
  const cached = cache.get(contour); if (cached) return cached;
  const { vertices, indices } = bodyGeometry(contour), triangles: Triangle[] = [], cells = new Map<string, number[]>();
  const point = (index: number): Vec3 => [vertices[index * 6]!, vertices[index * 6 + 1]!, vertices[index * 6 + 2]!];
  for (let i = 0; i < indices.length; i += 3) {
    const triangle = makeTriangle(point(indices[i]!), point(indices[i + 1]!), point(indices[i + 2]!));
    if (!triangle || triangle.area <= 0) continue;
    const index = triangles.push(triangle) - 1;
    for (let x = Math.floor(triangle.minX * CELL); x <= Math.floor(triangle.maxX * CELL); x++) for (let y = Math.floor(triangle.minY * CELL); y <= Math.floor(triangle.maxY * CELL); y++) {
      const key = `${x},${y}`, list = cells.get(key) ?? []; list.push(index); cells.set(key, list);
    }
  }
  const result = { triangles, cells }; cache.set(contour, result); return result;
}
/** One translation for a rigid mesh, never per-vertex projection or deformation. */
export function rigidFrontLift(points: readonly Vec3[], indices: readonly number[], contour: ShapeContour, scales: Vec3, clearance: number): number {
  const grid = frontGrid(contour), local = points.map(p => [p[0] / scales[0], p[1] / scales[1], p[2] / scales[2]] as Vec3);
  let lift = 0;
  const seen = new Int32Array(grid.triangles.length); let serial = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const triangle = makeTriangle(local[indices[i]!]!, local[indices[i + 1]!]!, local[indices[i + 2]!]!);
    if (!triangle || triangle.area >= 0) continue;
    serial++;
    for (let x = Math.floor(triangle.minX * CELL); x <= Math.floor(triangle.maxX * CELL); x++) for (let y = Math.floor(triangle.minY * CELL); y <= Math.floor(triangle.maxY * CELL); y++) {
      for (const index of grid.cells.get(`${x},${y}`) ?? []) {
        if (seen[index] === serial) continue; seen[index] = serial;
        const body = grid.triangles[index]!;
        if (Math.max(body.a[2], body.b[2], body.c[2]) - triangle.minZ <= lift || triangle.maxX < body.minX || triangle.minX > body.maxX || triangle.maxY < body.minY || triangle.minY > body.maxY) continue;
        lift = separation(body, triangle, lift);
      }
    }
  }
  return Math.max(0, lift * scales[2]) + clearance;
}

/**
 * Cloth-only clearance. Each back triangle gets its exact local correction,
 * shared by both sheets at matching XY vertices. Raising all three corners by
 * at least the original triangle's maximum penetration is conservative over
 * every body/cloth intersection; max-sharing cannot reopen a neighboring seam.
 * Rigid accessories must continue using rigidFrontLift instead of this helper.
 */
export function drapedFrontLifts(points: readonly Vec3[], indices: readonly number[], contour: ShapeContour, scales: Vec3): Float64Array {
  const grid = frontGrid(contour), local = points.map(p => [p[0] / scales[0], p[1] / scales[1], p[2] / scales[2]] as Vec3);
  const lifts = new Float64Array(points.length), seen = new Int32Array(grid.triangles.length); let serial = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i]!, b = indices[i + 1]!, c = indices[i + 2]!, triangle = makeTriangle(local[a]!, local[b]!, local[c]!);
    if (!triangle || triangle.area >= 0) continue;
    serial++; let lift = 0;
    for (let x = Math.floor(triangle.minX * CELL); x <= Math.floor(triangle.maxX * CELL); x++) for (let y = Math.floor(triangle.minY * CELL); y <= Math.floor(triangle.maxY * CELL); y++) {
      for (const index of grid.cells.get(`${x},${y}`) ?? []) {
        if (seen[index] === serial) continue; seen[index] = serial;
        const body = grid.triangles[index]!;
        if (Math.max(body.a[2], body.b[2], body.c[2]) - triangle.minZ <= lift || triangle.maxX < body.minX || triangle.minX > body.maxX || triangle.maxY < body.minY || triangle.minY > body.maxY) continue;
        lift = separation(body, triangle, lift);
      }
    }
    for (const index of [a, b, c]) lifts[index] = Math.max(lifts[index]!, lift * scales[2]);
  }
  const columns = new Map<string, number>();
  points.forEach((point, i) => { const key = `${point[0]},${point[1]}`; columns.set(key, Math.max(columns.get(key) ?? 0, lifts[i]!)); });
  points.forEach((point, i) => { lifts[i] = columns.get(`${point[0]},${point[1]}`)!; });
  return lifts;
}
