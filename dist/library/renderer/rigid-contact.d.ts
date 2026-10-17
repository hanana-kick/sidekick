import type { Vec3 } from '../core/design.js';
import type { ShapeContour } from '../core/contours.js';
/** One translation for a rigid mesh, never per-vertex projection or deformation. */
export declare function rigidFrontLift(points: readonly Vec3[], indices: readonly number[], contour: ShapeContour, scales: Vec3, clearance: number): number;
/**
 * Cloth-only clearance. Each back triangle gets its exact local correction,
 * shared by both sheets at matching XY vertices. Raising all three corners by
 * at least the original triangle's maximum penetration is conservative over
 * every body/cloth intersection; max-sharing cannot reopen a neighboring seam.
 * Rigid accessories must continue using rigidFrontLift instead of this helper.
 */
export declare function drapedFrontLifts(points: readonly Vec3[], indices: readonly number[], contour: ShapeContour, scales: Vec3): Float64Array;
