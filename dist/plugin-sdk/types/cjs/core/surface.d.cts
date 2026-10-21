import type { AccessorySlot, BodyDesign, Vec3 } from './design.cjs';
import type { Anchor, ResolvedAccessoryDesign } from './resolved-design.cjs';
import type { ShapeContour } from './contours.cjs';
import type { Mat4 } from './math.cjs';
import type { ShapeProfile } from './shape-profiles.cjs';
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
export declare function deformBodyPoint(body: BodyDesign, point: Vec3, squash?: number, profileOverride?: Pick<ShapeProfile, 'depth'>): Vec3;
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
/** Generic contained front chart with an independently authored rigid plane. */
export declare function sampleContainedFrontSurface(body: BodyDesign, mount: {
    uv: readonly [number, number];
    offset: number;
    rotation: Vec3;
}, squash?: number, contourOverride?: ShapeContour, profileOverride?: Pick<ShapeProfile, 'depth'>): SurfaceFrame;
/** Generic calibrated chart; contains no catalog accessory selection or geometry. */
export declare function sampleCalibratedSurface(body: BodyDesign, mount: {
    uv: readonly [number, number];
    offset: number;
    rotation: Vec3;
}, chart: 'central-front' | 'crown-envelope' | 'perimeter-front', options?: {
    region?: 'left' | 'right';
    perimeterInset?: number;
    containmentClearance?: number;
}, squash?: number, contourOverride?: ShapeContour, profileOverride?: Pick<ShapeProfile, 'depth'>): SurfaceFrame;
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
