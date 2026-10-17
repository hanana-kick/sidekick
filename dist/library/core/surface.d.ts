import type { AccessorySlot, BodyDesign, Vec3 } from './design.js';
import type { Anchor, ResolvedAccessoryDesign } from './resolved-design.js';
import type { ShapeContour } from './contours.js';
import type { Mat4 } from './math.js';
import type { ShapeProfile } from './shape-profiles.js';
/** Fixed catalog XY size plus the nominal square depth; actual Z comes from its profile. */
export declare const BODY_SIZE: Readonly<Vec3>;
export interface SurfaceFrame {
    position: Vec3;
    normal: Vec3;
    tangent: Vec3;
    bitangent: Vec3;
    matrix: Mat4;
}
/** Current rounded height field, independent of mesh topology and frame history. */
export declare function contourSurfacePoint(contour: ShapeContour, x: number, y: number, front?: boolean): Vec3;
/** Body deformations are shared by the renderer and attachment/point APIs. */
export declare function deformBodyPoint(body: BodyDesign, point: Vec3, squash?: number, profileOverride?: ShapeProfile): Vec3;
/** Physical ray intersection, with the same rounded field used by mesh vertices. */
export declare function bodyPoint(body: BodyDesign, direction: Vec3, squash?: number, contourOverride?: ShapeContour, profileOverride?: ShapeProfile): Vec3;
export declare function bodyNormal(body: BodyDesign, direction: Vec3, squash?: number, contourOverride?: ShapeContour, profileOverride?: ShapeProfile): Vec3;
/** Inverse-transpose counterpart of deformBodyPoint. */
export declare function deformBodyNormal(body: BodyDesign, normal: Vec3, squash?: number, profileOverride?: ShapeProfile): Vec3;
/**
 * Direct XY surface query for rigid front-plane ink and calibrated cap mounts.
 * Unlike a physical ray this preserves XY spacing as the body inflates. Callers
 * choose contained XY coordinates; exterior coordinates land on the z=0 plane.
 */
export declare function sampleSurfaceAtXY(body: BodyDesign, x: number, y: number, squash?: number, contourOverride?: ShapeContour, profileOverride?: ShapeProfile, front?: boolean): SurfaceFrame;
export declare function sampleSurface(body: BodyDesign, anchor: Anchor, squash?: number, contourOverride?: ShapeContour, profileOverride?: ShapeProfile): SurfaceFrame;
/** Diagnostics for the continuous, nonzero phase invariant used by mount charts. */
export declare function accessoryChartDiagnostics(contour: ShapeContour): Readonly<{
    phase: number;
    magnitude: number;
}>;
/**
 * A curated junction, independent of the angular ray used to choose its location.
 * The position follows the current contour's phase-locked perimeter continuously;
 * the fixed regional frame is rotated by the shape/accessory's chosen band plane.
 * A heart's right lobe therefore does not inherit the radial tilt from the notch.
 * Halo height uses the current top envelope and stays centered even on split crowns.
 * Neither orientation nor placement selects a nearest vertex or carries frame history.
 */
export declare function sampleAccessorySurface(body: BodyDesign, accessory: Pick<ResolvedAccessoryDesign, 'preset'> & {
    slot?: AccessorySlot;
}, squash?: number, contourOverride?: ShapeContour, profileOverride?: ShapeProfile): SurfaceFrame;
