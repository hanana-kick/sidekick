import type { Vec3 } from '../core/design.js';
import type { ShapeContour } from '../core/contours.js';
interface ClothMesh {
    points: Vec3[];
    indices: number[];
    mainIndexCount: number;
}
/**
 * One cloth loop actually encircles the lower body, including both sides and
 * rear. Its convex support envelope bridges concave notches like tensioned
 * fabric. Two free tails retain their authored gravity drape and volume;
 * their clearance is one shared rigid translation, never vertex body-hugging.
 */
export declare function drapedScarf(center: Vec3, size: number, contour: ShapeContour, scales: Vec3, rotation?: Vec3): ClothMesh;
export {};
