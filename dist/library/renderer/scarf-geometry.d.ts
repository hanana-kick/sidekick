import type { Vec3 } from '../core/design.js';
import type { ShapeContour } from '../core/contours.js';
interface ClothMesh {
    points: Vec3[];
    indices: number[];
    mainIndexCount: number;
}
/**
 * A loose scarf is supported only at its two shoulder folds. The collar and
 * both hanging tails are authored in space, then receive ONE rigid clearance
 * offset. Only the short shoulder folds adapt locally to make real contact.
 * In particular neither the collar nor the free ends sample the body height
 * at their vertices. Gravity is body-local, so camera movement cannot refit it.
 */
export declare function drapedScarf(center: Vec3, size: number, contour: ShapeContour, scales: Vec3, height: (x: number, y: number) => number): ClothMesh;
export {};
