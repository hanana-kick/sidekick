import type { MaterialShapeName, Vec3 } from '../core/design.js';
import { type ShapeContour } from '../core/contours.js';
import type { BeretGeometry } from './beret-geometry.js';
export declare function wornBeret(contour: ShapeContour, scales: Vec3, shape: MaterialShapeName, rotation?: Vec3): BeretGeometry;
