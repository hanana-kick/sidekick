import type { ShapeInput } from '../core/shapes.js';
import type { ShapeContour } from '../core/contours.js';
import type { Geometry } from './geometry.js';
/** Interior height refinement target. This is sampled, not an analytic bound. */
export declare const BODY_HEIGHT_TOLERANCE = 0.006;
/** Sampled edge/triangle-plane distance refinement target in canonical space. */
export declare const BODY_SURFACE_TOLERANCE = 0.01;
/** Strict budget, including the mirrored half, stays below WebGL Uint16 limits. */
export declare const BODY_VOLUME_MAX_POINTS = 12000;
/** Geometry follows the actual current contour, not only its endpoint recipes. */
export declare function bodyGeometryKey(shape: ShapeInput): string;
/**
 * Rounded, watertight double-height surface. Constrained Delaunay triangles
 * preserve every boundary segment; interior samples need no radial/star-shape
 * assumption. Shared-edge midpoint subdivision concentrates samples where the
 * continuous dome bends, with bounded passes/work. No intermediate planar caps.
 */
export declare function bodyGeometry(input: ShapeInput | ShapeContour, roundness?: number): Geometry;
