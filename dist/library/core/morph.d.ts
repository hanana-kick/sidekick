import type { ShapeInput } from './shapes.js';
import type { ShapeContour } from './contours.js';
/** A direct, aligned boundary interpolation. Endpoints are the exact input snapshots. */
export interface ContourMorph {
    readonly from: ShapeContour;
    readonly to: ShapeContour;
    sample(progress: number): ShapeContour;
}
/** Keep repeated interrupted transitions bounded without visible approximation. */
export declare const MAX_MORPH_POINTS = 8192;
export declare const MORPH_SNAPSHOT_TOLERANCE = 0.000001;
/**
 * Match whole oriented perimeters, then merge BOTH sets of boundary breakpoints.
 * Every original corner remains present. Points move directly to their matches;
 * there is no intermediate shape, implicit ellipse, rotation, or radius blending.
 * A displayed snapshot can be used as the source of any later transition.
 */
export declare function buildMorph(fromShape: ShapeInput | ShapeContour, toShape: ShapeInput | ShapeContour, roundness?: number): ContourMorph;
