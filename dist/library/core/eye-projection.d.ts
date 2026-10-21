import type { Vec2, Vec3 } from './design.js';
import type { ResolvedAvatarDesign } from './resolved-design.js';
import type { Mat4 } from './math.js';
import type { ShapeContour } from './contours.js';
import type { ShapeProfile } from './shape-profiles.js';
export interface ProjectedEye {
    center: Vec3;
    localCenter: Vec3;
    direction: Vec3;
    visible: boolean;
}
type EyeBasis = [number, number, number, number];
export interface ProjectedEyes {
    left: ProjectedEye;
    right: ProjectedEye;
    /** Capsule dimensions in the body's front plane, before view foreshortening. */
    size: Vec2;
    /** Projected body-right and body-up columns: [right.x, right.y, up.x, up.y]. */
    basis: EyeBasis;
    /** Rows of the inverse basis, mapping view-space deltas back into the front plane. */
    inverseBasis: EyeBasis;
    depthRange: number;
}
/** Orthographic camera coordinates; +Z points toward the camera. */
export declare function viewPoint(matrix: Mat4, point: Vec3, vector?: boolean): Vec3;
/**
 * Orthographic projection of the stable body front-plane frame. Keep both raw
 * columns: normalizing them or making them perpendicular would billboard the
 * glyph, erasing yaw/pitch foreshortening and combined-rotation shear.
 * `root` includes the animated pose and authored body rotations, but not local body squash.
 */
export declare function eyeBasis(root: Mat4): EyeBasis;
/** Centers follow the rounded surface; the renderer evaluates glyphs in local XY. */
export declare function projectEyes(design: ResolvedAvatarDesign, root: Mat4, face?: Vec2, gaze?: Vec2, squash?: number, contour?: ShapeContour, profile?: ShapeProfile): ProjectedEyes;
/**
 * Diagnostic: reject a projected center hidden by another part of the body.
 * The renderer intentionally does not use this binary center visibility test;
 * body-local fragment ownership and the depth buffer clip partial eyes instead.
 * Uses the rendered mesh itself, so a star lobe cannot receive a hidden eye.
 * A tiny tolerance covers the exact analytic anchor versus tessellated surface.
 */
export declare function clipOccludedEyes(eyes: ProjectedEyes, root: Mat4, vertices: Float32Array, indices: Uint16Array): void;
export {};
