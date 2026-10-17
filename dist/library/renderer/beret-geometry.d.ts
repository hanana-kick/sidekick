import type { BodyDesign, Vec3 } from '../core/design.js';
import type { ResolvedAccessoryDesign } from '../core/resolved-design.js';
import type { ShapeContour } from '../core/contours.js';
import type { ShapeProfile } from '../core/shape-profiles.js';
import type { Geometry } from './geometry.js';
/** Historical v5 stand-off, retained only for legacy import/regression diagnostics. */
export declare const BERET_SEATING_OFFSET = 0.035;
/** A small clearance for the rendered triangles, rather than a visible hover gap. */
export declare const BERET_CLEARANCE = 0.001;
export interface BeretGeometry extends Geometry {
    /** Contiguous index ranges share one VAO and two GPU buffers. */
    bandIndexCount: number;
    crownIndexCount: number;
    /** Minimal rigid seating displacement along the curated band frame's outward normal. */
    seating: number;
}
/**
 * Fit the immutable shell to the already-cached body triangles. A parallel-axis
 * height comparison across triangle intersections gives the smallest rigid
 * seating translation, including intervening peaks on concave outlines. The
 * fit axis is always the curated band frame's outward normal, so even a 180-degree
 * cap rotation stays on the chosen side of the body. The requested rotation is
 * preserved; there is no angular fallback threshold or previous-frame state.
 * Internal clearance is added after the neutral fit once. The curated model
 * frame is already independent from its chosen lobe's perimeter location.
 */
export declare function beretGeometry(body: BodyDesign, accessory: ResolvedAccessoryDesign, squash?: number, contourOverride?: ShapeContour, profileOverride?: ShapeProfile, rotation?: Vec3): BeretGeometry;
/** A structural band, not a directional lighting model; every region is flat. */
export declare function beretBandColor(color: string): string;
