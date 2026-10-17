import type { Vec3 } from './design.js';
import type { ShapeContour } from './contours.js';
/** Internal, fixed inflation law. The public profile controls only total depth. */
export declare const VOLUME_CURVATURE = 0.65;
/**
 * A topology-independent, continuously rounded solid over the current XY outline.
 * Its equator is the exact renderer boundary; its center reaches unit half-depth.
 * Unlike a bevel, height varies everywhere inside the shape. Signed distance
 * keeps concave lobes attached without choosing a radial boundary intersection.
 */
export declare function contourVolumeHeight(contour: ShapeContour, x: number, y: number): number;
/** The implicit field's outward normal, stable even at its vertical equator. */
export declare function contourVolumeNormal(contour: ShapeContour, x: number, y: number, front?: boolean): Vec3;
