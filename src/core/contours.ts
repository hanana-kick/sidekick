import type { ShapeInput, RoundedPolygonShape } from './shapes.js';
import { materialOutline } from './material-shapes.js';
import { buildMorph } from './morph.js';

export type ContourPoint = readonly [number, number];
/** An immutable, counter-clockwise, centered Y-up boundary. Closing point is implicit. */
export interface ShapeContour { readonly kind: 'contour'; readonly points: readonly ContourPoint[] }
const TAU = Math.PI * 2;
const EPSILON = 1e-12;
const distance = (a: ContourPoint, b: ContourPoint): number => Math.hypot(a[0] - b[0], a[1] - b[1]);
const cache = new Map<string, ShapeContour>();

/** Internal snapshot constructor. Coordinates are copied and deeply frozen. */
export function contourSnapshot(points: readonly ContourPoint[]): ShapeContour {
  if (points.length < 3 || points.some(p => p.length !== 2 || !p.every(Number.isFinite))) throw new TypeError('A contour needs at least three finite points.');
  const copy = points.filter((p, i) => !i || distance(p, points[i - 1]!) > EPSILON).map(p => [p[0], p[1]] as [number, number]);
  if (copy.length > 1 && distance(copy[0]!, copy[copy.length - 1]!) <= EPSILON) copy.pop();
  if (copy.length < 3) throw new RangeError('A contour must enclose an area.');
  const area = copy.reduce((sum, p, i) => { const q = copy[(i + 1) % copy.length]!; return sum + p[0] * q[1] - p[1] * q[0]; }, 0);
  if (Math.abs(area) < EPSILON) throw new RangeError('A contour must enclose an area.');
  if (area < 0) copy.reverse();
  return Object.freeze({ kind: 'contour', points: Object.freeze(copy.map(p => Object.freeze(p))) });
}

/** Exact intersection with (1-rounding) * regular polygon + rounding * unit disk. */
export function polygonRadius(shape: RoundedPolygonShape, angle: number): number {
  const half = Math.PI / shape.sides, sector = half * 2;
  const delta = Math.abs(((angle - shape.rotation + half) % sector + sector) % sector - half);
  const radius = shape.rounding, center = 1 - radius;
  const cornerLimit = Math.atan2(radius * Math.sin(half), center + radius * Math.cos(half));
  if (delta <= cornerLimit) return center * Math.cos(delta) + Math.sqrt(Math.max(0, radius * radius - (center * Math.sin(delta)) ** 2));
  return (center * Math.cos(half) + radius) / Math.cos(half - delta);
}
function primitiveMap(shape: Exclude<ShapeInput, { kind: 'material' } | { kind: 'morph' }>, roundness: number): (x: number, y: number) => ContourPoint {
  if (typeof shape !== 'string' && shape.kind === 'ellipse') return (x, y) => [x, y];
  if (typeof shape !== 'string' && shape.kind === 'rounded-polygon') return (x, y) => { const r = polygonRadius(shape, Math.atan2(y, x)); return [x * r, y * r]; };
  const name = typeof shape === 'string' ? shape : shape.name;
  return (x, y) => {
    const r = Math.hypot(x, y); if (r < EPSILON) return [0, 0];
    const nx = x / r, ny = y / r, exponent = name === 'rounded-box' ? 2 + (1 - roundness) * 6 : 2;
    const extent = (Math.abs(nx) ** exponent + Math.abs(ny) ** exponent) ** (-1 / exponent);
    return [x * extent * (name === 'droplet' ? 0.9 - 0.32 * ny : 1), y * extent];
  };
}

/** Evaluate a serializable recipe into an immutable outline, including manual morphs. */
export function shapeContour(shape: ShapeInput, roundness = 0.5): ShapeContour {
  const key = `${roundness}:${JSON.stringify(shape)}`;
  const previous = cache.get(key); if (previous) return previous;
  let result: ShapeContour;
  if (typeof shape !== 'string' && shape.kind === 'morph') result = buildMorph(shape.from, shape.to, roundness).sample(shape.progress);
  else if (typeof shape !== 'string' && shape.kind === 'material') result = contourSnapshot(materialOutline(shape.name));
  else {
    const map = primitiveMap(shape, roundness), angles = Array.from({ length: 720 }, (_, i) => i / 720 * TAU);
    if (typeof shape !== 'string' && shape.kind === 'rounded-polygon') for (let i = 0; i < shape.sides; i++) angles.push(((shape.rotation + i * TAU / shape.sides) % TAU + TAU) % TAU);
    angles.sort((a, b) => a - b);
    result = contourSnapshot(angles.map(a => map(Math.cos(a), Math.sin(a))));
  }
  if (cache.size >= 128) cache.delete(cache.keys().next().value!);
  cache.set(key, result); return result;
}

/** Bounded visual tessellation error; immutable snapshots retain full source fidelity. */
export const CONTOUR_MAPPING_TOLERANCE = 0.00075;
export function simplifyContourPoints(points: readonly ContourPoint[], tolerance = CONTOUR_MAPPING_TOLERANCE): ContourPoint[] {
  const count = points.length;
  const earlier = (a: number, b: number): boolean => points[a]![0] < points[b]![0] || (points[a]![0] === points[b]![0] && points[a]![1] < points[b]![1]);
  // Geometry, not array indexing, fixes the two arcs. Otherwise cyclically
  // reindexing a contour changes its distance field and rounded cap height.
  // Collinear subdivisions cannot introduce a new extreme/farthest point.
  let first = 0, opposite = 0, farthest = -1;
  for (let i = 1; i < count; i++) if (earlier(i, first)) first = i;
  for (let i = 0; i < count; i++) {
    const d = (points[i]![0] - points[first]![0]) ** 2 + (points[i]![1] - points[first]![1]) ** 2;
    if (d > farthest || (d === farthest && earlier(i, opposite))) { farthest = d; opposite = i; }
  }
  const last = opposite > first ? opposite : opposite + count, selected = new Set([first, opposite]);
  function visit(first: number, last: number): void {
    const a = points[first % count]!, b = points[last % count]!, dx = b[0] - a[0], dy = b[1] - a[1], length = dx * dx + dy * dy;
    let best = tolerance ** 2, chosen = -1;
    for (let i = first + 1; i < last; i++) {
      const p = points[i % count]!, t = length ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length)) : 0;
      const error = (p[0] - a[0] - dx * t) ** 2 + (p[1] - a[1] - dy * t) ** 2;
      if (error > best) { best = error; chosen = i; }
    }
    if (chosen >= 0) { selected.add(chosen % count); visit(first, chosen); visit(chosen, last); }
  }
  visit(first, last); visit(last, first + count);
  return [...selected].sort((a, b) => a - b).map(i => points[i]!);
}
const distanceOutlines = new WeakMap<ShapeContour, readonly ContourPoint[]>();

/** Current planar outline, simplified below 0.1 pixel at a 256px display width. */
export function contourDistanceOutline(contour: ShapeContour): readonly ContourPoint[] {
  let points = distanceOutlines.get(contour);
  if (!points) { points = Object.freeze(simplifyContourPoints(contour.points).map(p => Object.freeze([p[0], p[1]] as const))); distanceOutlines.set(contour, points); }
  return points;
}
interface DistanceNode {
  minX: number; minY: number; maxX: number; maxY: number;
  left?: DistanceNode; right?: DistanceNode; segments?: readonly number[];
}
interface DistanceIndex { nearest: number; edges: Float64Array; root: DistanceNode; buckets: readonly number[][]; minY: number; maxY: number; yScale: number }
const DISTANCE_STRIDE = 10, WINDING_BUCKETS = 64;
const distanceIndexes = new WeakMap<ShapeContour, DistanceIndex>();
const exactDistanceIndexes = new WeakMap<ShapeContour, DistanceIndex>();
function makeDistanceIndex(contour: ShapeContour, exact = false): DistanceIndex {
  const points = exact ? contour.points : contourDistanceOutline(contour), edges = new Float64Array(points.length * DISTANCE_STRIDE);
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!, b = points[(i + 1) % points.length]!, dx = b[0] - a[0], dy = b[1] - a[1];
    edges.set([a[0], a[1], dx, dy, 1 / (dx * dx + dy * dy), b[1], Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])], i * DISTANCE_STRIDE);
  }
  const build = (segments: number[]): DistanceNode => {
    const node: DistanceNode = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    for (const offset of segments) { node.minX = Math.min(node.minX, edges[offset + 6]!); node.minY = Math.min(node.minY, edges[offset + 7]!); node.maxX = Math.max(node.maxX, edges[offset + 8]!); node.maxY = Math.max(node.maxY, edges[offset + 9]!); }
    if (segments.length <= 6) node.segments = segments;
    else {
      const axis = node.maxX - node.minX >= node.maxY - node.minY ? 6 : 7;
      segments.sort((a, b) => edges[a + axis]! + edges[a + axis + 2]! - edges[b + axis]! - edges[b + axis + 2]!);
      const middle = segments.length >>> 1; node.left = build(segments.slice(0, middle)); node.right = build(segments.slice(middle));
    }
    return node;
  };
  const root = build(points.map((_, i) => i * DISTANCE_STRIDE)), minY = root.minY, maxY = root.maxY, yScale = WINDING_BUCKETS / (maxY - minY);
  const buckets: number[][] = Array.from({ length: WINDING_BUCKETS }, () => []);
  for (let offset = 0; offset < edges.length; offset += DISTANCE_STRIDE) {
    if (edges[offset + 3] === 0) continue;
    const first = Math.max(0, Math.min(WINDING_BUCKETS - 1, Math.floor((edges[offset + 7]! - minY) * yScale)));
    const last = Math.max(0, Math.min(WINDING_BUCKETS - 1, Math.floor((edges[offset + 9]! - minY) * yScale)));
    for (let b = first; b <= last; b++) buckets[b]!.push(offset);
  }
  const index = { nearest: 0, edges, root, buckets, minY, maxY, yScale }; (exact ? exactDistanceIndexes : distanceIndexes).set(contour, index); return index;
}
function boxDistance(node: DistanceNode, x: number, y: number): number {
  const dx = x < node.minX ? node.minX - x : x > node.maxX ? x - node.maxX : 0;
  const dy = y < node.minY ? node.minY - y : y > node.maxY ? y - node.maxY : 0;
  return dx * dx + dy * dy;
}
/** Allocation-free nearest-edge query over the current outline's cached AABB tree. */
function nearestDistance(node: DistanceNode, index: DistanceIndex, x: number, y: number, best: number): number {
  const edges = index.edges;
  if (node.segments) {
    for (const i of node.segments) {
      const ax = edges[i]!, ay = edges[i + 1]!, dx = edges[i + 2]!, dy = edges[i + 3]!;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) * edges[i + 4]!));
      const ex = x - ax - t * dx, ey = y - ay - t * dy; const distance = ex * ex + ey * ey;
      if (distance < best) { best = distance; index.nearest = i; }
    }
    return best;
  }
  const left = node.left!, right = node.right!, dl = boxDistance(left, x, y), dr = boxDistance(right, x, y);
  if (dl <= dr) { if (dl < best) best = nearestDistance(left, index, x, y, best); if (dr < best) best = nearestDistance(right, index, x, y, best); }
  else { if (dr < best) best = nearestDistance(right, index, x, y, best); if (dl < best) best = nearestDistance(left, index, x, y, best); }
  return best;
}
/** Positive inside, negative outside, zero on the current renderer silhouette. */
function signedDistance(index: DistanceIndex, x: number, y: number): number {
  const { edges } = index;
  // Nearby cloth/normal samples usually share a nearest edge. Its exact
  // distance is a valid upper bound even after an unrelated query: the AABB
  // traversal still visits every node that could improve it, without quantizing.
  const offset = index.nearest, ax = edges[offset]!, ay = edges[offset + 1]!, dx = edges[offset + 2]!, dy = edges[offset + 3]!;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) * edges[offset + 4]!));
  const ex = x - ax - t * dx, ey = y - ay - t * dy;
  const minimum = nearestDistance(index.root, index, x, y, ex * ex + ey * ey);
  let contained = false;
  if (y >= index.minY && y <= index.maxY) {
    const bucket = Math.max(0, Math.min(WINDING_BUCKETS - 1, Math.floor((y - index.minY) * index.yScale)));
    for (const i of index.buckets[bucket]!) {
      const ay = edges[i + 1]!, by = edges[i + 5]!;
      if ((ay > y) !== (by > y) && x < edges[i + 2]! * (y - ay) / edges[i + 3]! + edges[i]!) contained = !contained;
    }
  }
  return Math.sqrt(minimum) * (contained ? 1 : -1);
}

/** Current renderer field, retaining its bounded outline simplification. */
export function contourSignedDistance(contour: ShapeContour, x: number, y: number): number {
  return signedDistance(distanceIndexes.get(contour) ?? makeDistanceIndex(contour), x, y);
}
/** Internal continuous-fit field over the full current contour, without simplification switches. */
export function contourSignedDistanceExact(contour: ShapeContour, x: number, y: number): number {
  return signedDistance(exactDistanceIndexes.get(contour) ?? makeDistanceIndex(contour, true), x, y);
}

/** Renderer boundary, shared with the continuous target-XY distance field. */
export function contourBoundaryPoints(contour: ShapeContour): readonly ContourPoint[] { return contourDistanceOutline(contour); }
