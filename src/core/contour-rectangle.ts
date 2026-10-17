import { contourDistanceOutline, contourSignedDistance } from './contours.js';
import type { ShapeContour } from './contours.js';

// Share the same simplified boundary as the renderer's signed-distance field.
// Snapshots are immutable, so their small, allocation-free edge cache is safe.
const STRIDE = 11;
const edgeCache = new WeakMap<ShapeContour, Float64Array>();
function rectangleEdges(contour: ShapeContour): Float64Array {
  let edges = edgeCache.get(contour);
  if (edges) return edges;
  const points = contourDistanceOutline(contour);
  edges = new Float64Array(points.length * STRIDE);
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!, b = points[(i + 1) % points.length]!, dx = b[0] - a[0], dy = b[1] - a[1];
    const lengthSquared = dx * dx + dy * dy;
    edges.set([a[0], a[1], b[0], b[1], dx, dy, lengthSquared ? 1 / lengthSquared : 0,
      Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])], i * STRIDE);
  }
  edgeCache.set(contour, edges);
  return edges;
}

function pointBoxDistanceSquared(x: number, y: number, minX: number, minY: number, maxX: number, maxY: number): number {
  const dx = x < minX ? minX - x : x > maxX ? x - maxX : 0;
  const dy = y < minY ? minY - y : y > maxY ? y - maxY : 0;
  return dx * dx + dy * dy;
}
function pointSegmentDistanceSquared(x: number, y: number, ax: number, ay: number, dx: number, dy: number, inverseLengthSquared: number): number {
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) * inverseLengthSquared));
  const ex = x - ax - t * dx, ey = y - ay - t * dy;
  return ex * ex + ey * ey;
}

/** Whether a segment reaches the closed box (or its open interior at zero margin). */
function segmentIntersectsBox(ax: number, ay: number, dx: number, dy: number, minX: number, minY: number, maxX: number, maxY: number, open: boolean): boolean {
  let low = 0, high = 1;
  if (dx === 0) {
    if (open ? ax <= minX || ax >= maxX : ax < minX || ax > maxX) return false;
  } else {
    const first = (minX - ax) / dx, last = (maxX - ax) / dx;
    low = Math.max(low, Math.min(first, last)); high = Math.min(high, Math.max(first, last));
  }
  if (dy === 0) {
    if (open ? ay <= minY || ay >= maxY : ay < minY || ay > maxY) return false;
  } else {
    const first = (minY - ay) / dy, last = (maxY - ay) / dy;
    low = Math.max(low, Math.min(first, last)); high = Math.min(high, Math.max(first, last));
  }
  return open ? low < high : low <= high;
}

// Only the zero-area, zero-margin case needs interval classification: a line
// may touch/retrace the boundary while all of its remaining points stay inside.
function containsDegenerateRectangle(contour: ShapeContour, edges: Float64Array, minX: number, minY: number, maxX: number, maxY: number): boolean {
  const horizontal = minX !== maxX, start = horizontal ? minX : minY, end = horizontal ? maxX : maxY;
  if (start === end) return contourSignedDistance(contour, minX, minY) >= 0;
  const fixed = horizontal ? minY : minX, cuts = [start, end];
  for (let i = 0; i < edges.length; i += STRIDE) {
    const a = edges[i + (horizontal ? 1 : 0)]!, delta = edges[i + (horizontal ? 5 : 4)]!;
    const variable = edges[i + (horizontal ? 0 : 1)]!, variableDelta = edges[i + (horizontal ? 4 : 5)]!;
    if (delta === 0) {
      if (a === fixed) {
        cuts.push(Math.max(start, Math.min(end, variable)), Math.max(start, Math.min(end, variable + variableDelta)));
      }
    } else {
      const t = (fixed - a) / delta;
      if (t >= 0 && t <= 1) {
        const crossing = variable + t * variableDelta;
        if (crossing > start && crossing < end) cuts.push(crossing);
      }
    }
  }
  cuts.sort((a, b) => a - b);
  for (let i = 1; i < cuts.length; i++) {
    if (cuts[i] === cuts[i - 1]) continue;
    const middle = (cuts[i - 1]! + cuts[i]!) / 2;
    if (contourSignedDistance(contour, horizontal ? middle : fixed, horizontal ? fixed : middle) < 0) return false;
  }
  return contourSignedDistance(contour, minX, minY) >= 0 && contourSignedDistance(contour, maxX, maxY) >= 0;
}

/**
 * Whether a closed, axis-aligned rectangle is inside the current simplified
 * contour and at least `margin` from every boundary segment, in Euclidean XY.
 * `bottom` and `top` are offsets from `centerY`; all dimensions and the margin
 * are in the same normalized coordinates as contourDistanceOutline. Boundary
 * contact is allowed at zero margin. Invalid/non-finite bounds return false.
 *
 * Unlike perimeter sampling, this catches long crossing edges, narrow concave
 * notches, and minima between samples. One inside query plus segment/box tests
 * is sufficient: a connected rectangle cannot leave the interior without
 * crossing its boundary. No extra approximation or fitting tolerance is used.
 */
export function containsRectangleWithMargin(contour: ShapeContour, centerX: number, centerY: number, halfWidth: number, bottom: number, top: number, margin: number): boolean {
  if (!Number.isFinite(centerX) || !Number.isFinite(centerY) || !Number.isFinite(halfWidth) ||
      !Number.isFinite(bottom) || !Number.isFinite(top) || !Number.isFinite(margin) || halfWidth < 0 || bottom > top || margin < 0) return false;
  const minX = centerX - halfWidth, maxX = centerX + halfWidth, minY = centerY + bottom, maxY = centerY + top;
  if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minY) || !Number.isFinite(maxY)) return false;
  const middleY = minY / 2 + maxY / 2;
  if (!(contourSignedDistance(contour, centerX, middleY) >= margin)) return false;
  const edges = rectangleEdges(contour);
  if (margin === 0 && (minX === maxX || minY === maxY)) return containsDegenerateRectangle(contour, edges, minX, minY, maxX, maxY);
  const outerMinX = minX - margin, outerMaxX = maxX + margin, outerMinY = minY - margin, outerMaxY = maxY + margin;
  const marginSquared = margin * margin;
  for (let i = 0; i < edges.length; i += STRIDE) {
    const ax = edges[i]!, ay = edges[i + 1]!, bx = edges[i + 2]!, by = edges[i + 3]!;
    // Bounds belong to the complete segment, never just its endpoints: a long
    // edge can cross the rectangle with both endpoints outside the expanded box.
    if (edges[i + 7]! > outerMaxX || edges[i + 8]! > outerMaxY || edges[i + 9]! < outerMinX || edges[i + 10]! < outerMinY) continue;
    const dx = edges[i + 4]!, dy = edges[i + 5]!;
    if (segmentIntersectsBox(ax, ay, dx, dy, minX, minY, maxX, maxY, margin === 0)) return false;
    if (margin === 0) continue;
    if (pointBoxDistanceSquared(ax, ay, minX, minY, maxX, maxY) < marginSquared ||
        pointBoxDistanceSquared(bx, by, minX, minY, maxX, maxY) < marginSquared) return false;
    // For disjoint segments and a rectangle the nearest pair includes a segment
    // endpoint or a rectangle corner (parallel sides are covered by endpoints).
    const inverseLengthSquared = edges[i + 6]!;
    if (pointSegmentDistanceSquared(minX, minY, ax, ay, dx, dy, inverseLengthSquared) < marginSquared ||
        pointSegmentDistanceSquared(minX, maxY, ax, ay, dx, dy, inverseLengthSquared) < marginSquared ||
        pointSegmentDistanceSquared(maxX, minY, ax, ay, dx, dy, inverseLengthSquared) < marginSquared ||
        pointSegmentDistanceSquared(maxX, maxY, ax, ay, dx, dy, inverseLengthSquared) < marginSquared) return false;
  }
  return true;
}
