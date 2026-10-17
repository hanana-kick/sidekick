import type { Vec2, Vec3 } from '../core/design.js';
import type { ResolvedAccessoryDesign, ResolvedAvatarDesign } from '../core/resolved-design.js';
import type { ShapeContour } from '../core/contours.js';
import type { ShapeProfile } from '../core/shape-profiles.js';
import type { ProjectedEyes } from './eye-projection.js';
import type { Geometry } from './geometry.js';
/** Deliberate rigid-object clearance, including the body tessellation tolerance. */
export declare const GLASSES_CLEARANCE = 0.009;
/** Retained for diagnostics; a rigid rim is allowed to overhang the face outline. */
export declare const GLASSES_SHOULDER = 0;
/** 30% more substantial than the previous 0.065 eye-relative tube radius. */
export declare const GLASSES_TUBE_SCALE: number;
export interface RigidLens {
    center: Vec3;
    tangent: Vec3;
    bitangent: Vec3;
    normal: Vec3;
    radius: number;
    tubeRadius: number;
    vertexStart: number;
    vertexCount: number;
    indexStart: number;
    indexCount: number;
}
export interface GlassesGeometry extends Geometry {
    /** Body-local XY centers follow fitted eyes before whole-accessory rotation. */
    centers: [Vec2, Vec2];
    /** Equal intrinsic radii. Camera foreshortening is never baked into the mesh. */
    radii: Vec2;
    tubeRadius: number;
    /** Uniform radius multiplier from the internal shape/accessory recipe. */
    fit: number;
    lenses: [RigidLens, RigidLens];
    bridge: {
        vertexStart: number;
        vertexCount: number;
        indexStart: number;
        indexCount: number;
    };
    /** Opaque, rigid lens inserts follow the same single front plane. */
    frameIndexCount: number;
    fillIndexCount: number;
}
/**
 * One rigid, planar front assembly: two circular rims and a straight bridge.
 * Neutral eye size sets one uniform radius; spacing only separates the rims.
 * The complete front starts in the body's XY plane and receives one optional
 * mount/pose rotation about its midpoint, then ONE exact clearance translation
 * against the rendered body. Surface curvature never changes a lens normal,
 * bends the bridge, or projects individual vertices onto the face.
 */
export declare function glassesGeometry(design: ResolvedAvatarDesign, accessory: ResolvedAccessoryDesign, eyes: ProjectedEyes, squash?: number, contourOverride?: ShapeContour, profileOverride?: ShapeProfile, rotation?: Vec3): GlassesGeometry;
