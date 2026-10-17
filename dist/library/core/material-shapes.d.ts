import type { MaterialShapeName } from './shapes.js';
type Point = readonly [number, number];
export type MaterialCubic = readonly [number, number, number, number, number, number, number, number];
/** Official normalized Y-down cubics; exposed internally for contour-fidelity tests. */
export declare const MATERIAL_SHAPE_CUBICS: Readonly<Record<MaterialShapeName, readonly MaterialCubic[]>>;
/** Maximum cubic-to-polyline deviation, in centered body coordinates. */
export declare const MATERIAL_CONTOUR_TOLERANCE = 0.00005;
/** Internal QA access: a fresh centered Y-up outline, preserving source aspect ratio. */
export declare function materialOutline(name: MaterialShapeName): readonly Point[];
/** Internal QA access: exact affine determinants for the two non-star disk maps. */
export declare function materialMappingJacobians(name: MaterialShapeName): number[];
/** Map a unit disk into the complete official silhouette, without filling its notches. */
export declare function materialPlanarPoint(name: MaterialShapeName, x: number, y: number): Point;
/** Internal renderer access: source-disk parameters aligned with every outline vertex. */
export declare function materialBoundaryAngles(name: MaterialShapeName): readonly number[];
export {};
