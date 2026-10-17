import type { Vec3 } from './design.js';
import { contourSignedDistance } from './contours.js';
import type { ShapeContour } from './contours.js';

/** Internal, fixed inflation law. The public profile controls only total depth. */
export const VOLUME_CURVATURE = 0.65;
/**
 * A topology-independent, continuously rounded solid over the current XY outline.
 * Its equator is the exact renderer boundary; its center reaches unit half-depth.
 * Unlike a bevel, height varies everywhere inside the shape. Signed distance
 * keeps concave lobes attached without choosing a radial boundary intersection.
 */
export function contourVolumeHeight(contour: ShapeContour, x: number, y: number): number {
  const d = contourSignedDistance(contour, x, y);
  if (d <= 1e-12) return 0;
  return Math.sqrt(d / (d + VOLUME_CURVATURE * (x * x + y * y)));
}
/** The implicit field's outward normal, stable even at its vertical equator. */
export function contourVolumeNormal(contour: ShapeContour, x: number, y: number, front = true): Vec3 {
  const d = Math.max(0, contourSignedDistance(contour, x, y)), h = contourVolumeHeight(contour, x, y);
  const step = 1e-4;
  const dx = (contourSignedDistance(contour, x + step, y) - contourSignedDistance(contour, x - step, y)) / (2 * step);
  const dy = (contourSignedDistance(contour, x, y + step) - contourSignedDistance(contour, x, y - step)) / (2 * step);
  const square = h * h, nx = 2 * VOLUME_CURVATURE * x * square - dx * (1 - square);
  const ny = 2 * VOLUME_CURVATURE * y * square - dy * (1 - square);
  const nz = 2 * h * (d + VOLUME_CURVATURE * (x * x + y * y)) * (front ? 1 : -1);
  const length = Math.hypot(nx, ny, nz);
  return length > 1e-12 ? [nx / length, ny / length, nz / length] : [0, 0, front ? 1 : -1];
}
