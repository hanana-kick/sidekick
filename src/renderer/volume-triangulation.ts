import type { ContourPoint } from '../core/contours.js';

export const orient = (a: ContourPoint, b: ContourPoint, c: ContourPoint): number => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
interface Triangle { ids: [number, number, number]; neighbors: [number, number, number]; live: boolean }
function inCircle(a: ContourPoint, b: ContourPoint, c: ContourPoint, p: ContourPoint): number {
  const ax = a[0] - p[0], ay = a[1] - p[1], bx = b[0] - p[0], by = b[1] - p[1], cx = c[0] - p[0], cy = c[1] - p[1];
  return (ax * ax + ay * ay) * (bx * cy - by * cx) - (bx * bx + by * by) * (ax * cy - ay * cx) + (cx * cx + cy * cy) * (ax * by - ay * bx);
}
function earClip(points: readonly ContourPoint[]): [number, number, number][] {
  const count = points.length, previous = new Int32Array(count), next = new Int32Array(count);
  const reflex = new Set<number>(), result: [number, number, number][] = [];
  for (let i = 0; i < count; i++) { previous[i] = (i + count - 1) % count; next[i] = (i + 1) % count; }
  const classify = (i: number): void => {
    if (orient(points[previous[i]!]!, points[i]!, points[next[i]!]!) <= 1e-14) reflex.add(i);
    else reflex.delete(i);
  };
  for (let i = 0; i < count; i++) classify(i);
  let remaining = count, cursor = 0, misses = 0;
  while (remaining > 3) {
    const a = previous[cursor]!, b = cursor, c = next[cursor]!;
    const pa = points[a]!, pb = points[b]!, pc = points[c]!;
    let ear = !reflex.has(b);
    if (ear) {
      const minX = Math.min(pa[0], pb[0], pc[0]), maxX = Math.max(pa[0], pb[0], pc[0]);
      const minY = Math.min(pa[1], pb[1], pc[1]), maxY = Math.max(pa[1], pb[1], pc[1]);
      // Only reflex/collinear vertices can invalidate a convex ear in a simple
      // polygon. Bounding-box rejection keeps detailed concave catalogs cheap.
      for (const index of reflex) {
        if (index === a || index === c) continue;
        const p = points[index]!;
        if (p[0] < minX - 1e-14 || p[0] > maxX + 1e-14 || p[1] < minY - 1e-14 || p[1] > maxY + 1e-14) continue;
        if (orient(pa, pb, p) >= -1e-14 && orient(pb, pc, p) >= -1e-14 && orient(pc, pa, p) >= -1e-14) { ear = false; break; }
      }
    }
    if (ear) {
      result.push([a, b, c]); next[a] = c; previous[c] = a; reflex.delete(b);
      classify(a); classify(c); remaining--; cursor = c; misses = 0;
    } else { cursor = next[cursor]!; if (++misses > remaining * 2) throw new Error('Cannot triangulate a non-simple body contour.'); }
  }
  const a = previous[cursor]!, c = next[cursor]!;
  if (orient(points[a]!, points[cursor]!, points[c]!) > 1e-14) result.push([a, cursor, c]);
  return result;
}

/**
 * Constrained Delaunay refinement. Only interior edges can flip or enter an
 * insertion cavity, so every outline segment survives and concavities stay
 * empty. Local adjacency walks/cavities avoid rescanning the growing mesh.
 */
export class VolumeTriangulation {
  readonly points: ContourPoint[];
  readonly triangles: Triangle[] = [];
  private readonly edges = new Map<number, number>();
  private readonly free: number[] = [];
  // Scratch belongs to this one triangulation, never a global contour history.
  // It is reused across insertions and released with the per-frame mesh builder.
  private readonly cavity = new Set<number>();
  private readonly pending: number[] = [];
  private readonly cavityBoundary: number[] = [];
  private cursor = 0;
  constructor(boundary: readonly ContourPoint[]) {
    if (boundary.length >= 32768) throw new RangeError('Volume triangulation exceeds its directed-edge index budget.');
    this.points = [...boundary];
    for (const ids of earClip(boundary)) this.add(ids);
    const queue: number[] = [];
    for (let i = 0; i < this.triangles.length; i++) queue.push(i * 3, i * 3 + 1, i * 3 + 2);
    // Lawson flips terminate at a constrained Delaunay triangulation. A hard
    // operation cap is defensive; a valid unflipped triangulation remains.
    const limit = Math.max(1000, boundary.length * boundary.length * 4);
    for (let steps = 0; queue.length && steps < limit; steps++) {
      const half = queue.pop()!, index = Math.floor(half / 3), edge = half % 3, triangle = this.triangles[index]!;
      if (!triangle.live) continue;
      const neighborIndex = triangle.neighbors[edge]!;
      if (neighborIndex < 0) continue;
      const neighbor = this.triangles[neighborIndex]!;
      const a = triangle.ids[edge]!, b = triangle.ids[(edge + 1) % 3]!, c = triangle.ids[(edge + 2) % 3]!;
      let opposite: number | undefined;
      for (const id of neighbor.ids) if (id !== a && id !== b) { opposite = id; break; }
      const d = opposite!;
      if (orient(this.points[c]!, this.points[d]!, this.points[b]!) <= 1e-14 || orient(this.points[d]!, this.points[c]!, this.points[a]!) <= 1e-14) continue;
      if (inCircle(this.points[a]!, this.points[b]!, this.points[c]!, this.points[d]!) <= 1e-14) continue;
      this.remove(index); this.remove(neighborIndex);
      const first = this.add([c, d, b]), second = this.add([d, c, a]);
      queue.push(first * 3, first * 3 + 1, first * 3 + 2, second * 3, second * 3 + 1, second * 3 + 2);
    }
  }
  private key(a: number, b: number): number { return a * 32768 + b; }
  private add(ids: [number, number, number]): number {
    const index = this.free.pop() ?? this.triangles.length;
    const triangle: Triangle = { ids, neighbors: [-1, -1, -1], live: true };
    this.triangles[index] = triangle;
    for (let e = 0; e < 3; e++) {
      const a = ids[e]!, b = ids[(e + 1) % 3]!, other = this.edges.get(this.key(b, a));
      if (other !== undefined) {
        const neighbor = Math.floor(other / 3), slot = other % 3;
        triangle.neighbors[e] = neighbor; this.triangles[neighbor]!.neighbors[slot] = index;
      }
      this.edges.set(this.key(a, b), index * 3 + e);
    }
    return index;
  }
  private remove(index: number): void {
    const triangle = this.triangles[index]!; triangle.live = false;
    for (let e = 0; e < 3; e++) {
      const a = triangle.ids[e]!, b = triangle.ids[(e + 1) % 3]!;
      const other = this.edges.get(this.key(b, a));
      if (other !== undefined) this.triangles[Math.floor(other / 3)]!.neighbors[other % 3] = -1;
      this.edges.delete(this.key(a, b));
    }
    this.free.push(index);
  }
  private locate(point: ContourPoint): number {
    let index = this.cursor;
    for (let steps = 0; steps < this.triangles.length; steps++) {
      const t = this.triangles[index]!;
      let exit = -1, minimum = -1e-13;
      for (let e = 0; e < 3; e++) {
        const value = orient(this.points[t.ids[e]!]!, this.points[t.ids[(e + 1) % 3]!]!, point);
        if (value < minimum) { minimum = value; exit = e; }
      }
      if (exit === -1) return index;
      index = t.neighbors[exit]!;
      if (index < 0) break;
    }
    // Concavities can make a straight walk leave the polygon. The bounded
    // fallback searches existing triangles, without crossing a constraint.
    for (let i = 0; i < this.triangles.length; i++) {
      const t = this.triangles[i]!;
      if (!t.live) continue;
      const [a, b, c] = t.ids;
      if (orient(this.points[a]!, this.points[b]!, point) >= -1e-13 && orient(this.points[b]!, this.points[c]!, point) >= -1e-13 && orient(this.points[c]!, this.points[a]!, point) >= -1e-13) return i;
    }
    return -1;
  }
  insert(point: ContourPoint): boolean {
    if (this.points.length >= 32768) throw new RangeError('Volume triangulation exceeds its directed-edge index budget.');
    const initial = this.locate(point);
    if (initial < 0) return false;
    const first = this.triangles[initial]!;
    for (const id of first.ids) if (Math.hypot(this.points[id]![0] - point[0], this.points[id]![1] - point[1]) < 1e-8) return false;
    const cavity = this.cavity, queue = this.pending;
    cavity.clear(); cavity.add(initial); queue.length = 0; queue.push(initial);
    for (let i = 0; i < queue.length; i++) {
      const t = this.triangles[queue[i]!]!;
      for (let edge = 0; edge < 3; edge++) {
        const neighborIndex = t.neighbors[edge]!;
        if (neighborIndex < 0 || cavity.has(neighborIndex)) continue;
        const other = this.triangles[neighborIndex]!, [a, b, c] = other.ids;
        if (inCircle(this.points[a]!, this.points[b]!, this.points[c]!, point) > 1e-16 || Math.abs(orient(this.points[t.ids[edge]!]!, this.points[t.ids[(edge + 1) % 3]!]!, point)) < 1e-13) {
          cavity.add(neighborIndex); queue.push(neighborIndex);
        }
      }
    }
    const boundary = this.cavityBoundary; boundary.length = 0;
    for (const index of queue) {
      const t = this.triangles[index]!;
      for (let edge = 0; edge < 3; edge++) if (!cavity.has(t.neighbors[edge]!)) boundary.push(t.ids[edge]!, t.ids[(edge + 1) % 3]!);
    }
    // A constrained cavity is star-shaped. Reject roundoff-scale degeneracies
    // instead of punching an unpaired edge into the manifold.
    for (let i = 0; i < boundary.length; i += 2) if (orient(this.points[boundary[i]!]!, this.points[boundary[i + 1]!]!, point) <= 1e-15) return false;
    for (const index of queue) this.remove(index);
    const id = this.points.length; this.points.push(point);
    for (let i = 0; i < boundary.length; i += 2) this.cursor = this.add([boundary[i]!, boundary[i + 1]!, id]);
    return true;
  }
}
