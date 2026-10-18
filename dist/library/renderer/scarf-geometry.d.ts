import type { Vec3 } from '../core/design.js';
import type { ScarfSupportFit } from '../core/shape-profiles.js';
import type { ShapeContour } from '../core/contours.js';
interface ClothMesh {
    points: Vec3[];
    indices: number[];
    mainIndexCount: number;
}
/** A consistent visual cloth width and finite hanging surplus, with bounded
 * local wrap adaptation. Camera and frame history never affect placement. */
export declare function drapedScarf(_center: Vec3, scale: number, contour: ShapeContour, scales: Vec3, rotation?: Vec3, fit?: ScarfSupportFit): ClothMesh;
export {};
