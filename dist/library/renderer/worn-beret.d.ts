import type { MaterialShapeName, Vec2, Vec3 } from '../core/design.js';
import { type ShapeContour } from '../core/contours.js';
import type { BeretGeometry } from './beret-geometry.js';
export declare function wornBeret(contour: ShapeContour, scales: Vec3, shape: MaterialShapeName, rotation?: Vec3, tilt?: number, center?: Vec2, room?: number, drapeStrength?: number, fitTransition?: number, drapeLimit?: number, fitSize?: number, opening?: number, wrapStrength?: number, apertureX?: number, apertureZ?: number): BeretGeometry;
