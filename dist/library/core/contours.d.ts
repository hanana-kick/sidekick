import type { ShapeInput, RoundedPolygonShape } from './shapes.js';
export type ContourPoint = readonly [number, number];
/** An immutable, counter-clockwise, centered Y-up boundary. Closing point is implicit. */
export interface ShapeContour {
    readonly kind: 'contour';
    readonly points: readonly ContourPoint[];
}
/** Internal snapshot constructor. Coordinates are copied and deeply frozen. */
export declare function contourSnapshot(points: readonly ContourPoint[]): ShapeContour;
/** Exact intersection with (1-rounding) * regular polygon + rounding * unit disk. */
export declare function polygonRadius(shape: RoundedPolygonShape, angle: number): number;
/** Evaluate a serializable recipe into an immutable outline, including manual morphs. */
export declare function shapeContour(shape: ShapeInput, roundness?: number): ShapeContour;
/** Bounded visual tessellation error; immutable snapshots retain full source fidelity. */
export declare const CONTOUR_MAPPING_TOLERANCE = 0.00075;
export declare function simplifyContourPoints(points: readonly ContourPoint[], tolerance?: number): ContourPoint[];
/** Current planar outline, simplified below 0.1 pixel at a 256px display width. */
export declare function contourDistanceOutline(contour: ShapeContour): readonly ContourPoint[];
/** Positive inside, negative outside, zero on the current renderer silhouette. */
export declare function contourSignedDistance(contour: ShapeContour, x: number, y: number): number;
/** Renderer boundary, shared with the continuous target-XY distance field. */
export declare function contourBoundaryPoints(contour: ShapeContour): readonly ContourPoint[];
