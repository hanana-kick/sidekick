import type { Vec2, Vec3 } from './design.cjs';
import type { AccessoryPluginMaterial } from './accessory-plugins.cjs';
/** Small, data-only operations. No expression interpreter or catalog selector. */
export declare const ACCESSORY_PLUGIN_DEFORMATION_LIMITS: Readonly<{
    maxVertices: 2048;
    maxTriangles: 4096;
    maxChannels: 8;
    maxConnectors: 4;
    maxRings: 32;
    maxSides: 32;
    maxCoefficient: 16;
}>;
/** Neutral fitted body-local landmarks, independent of camera, gaze and blink. */
export interface AccessoryPluginEyeMeasurements {
    left: Vec2;
    right: Vec2;
    size: Vec2;
}
export interface PairedAffineChannel {
    measurement: 'eye-size';
    combine: 'min' | 'max';
    factors: Vec2;
    /** Three coefficients per vertex, in the authored front-plane axes. */
    coefficients: Float64Array;
}
export interface PairedAffineDeformation {
    kind: 'paired-affine';
    /** Per-vertex interpolation between the supplied left and right landmarks. */
    eyeBlend: Float64Array;
    basePositions: Float64Array;
    channels: PairedAffineChannel[];
}
/** A capped, circular tube appended AFTER the author's rigid mesh is seated. */
export interface AccessoryPluginSurfaceConnector {
    kind: 'surface-tube';
    /** Endpoint in the authored rigid mesh's local coordinate system. */
    to: Vec3;
    radius: number;
    rings: number;
    sides: number;
    clearance?: number;
    material?: AccessoryPluginMaterial;
}
export interface PairedAffineAuthorChannel {
    combine: 'min' | 'max';
    factors: Readonly<Vec2>;
}
export interface PairedAffineAuthorVertex {
    eyeBlend: number;
    basePosition?: Readonly<Vec3>;
    coefficients?: Readonly<Record<string, Readonly<Vec3>>>;
}
export interface PairedAffineAuthoring {
    channels: Readonly<Record<string, PairedAffineAuthorChannel>>;
    vertices: readonly PairedAffineAuthorVertex[];
}
/** Exact public landmark contract; malformed arrays must never produce a NaN frame. */
export declare function validateAccessoryPluginEyeMeasurements(value: unknown): AccessoryPluginEyeMeasurements;
/** Validate once at the registry/worker boundary and own every coefficient buffer. */
export declare function validateAccessoryPluginDeformation(value: unknown, vertexCount: number): PairedAffineDeformation;
/** Named coefficients keep authoring readable; names do not enter the runtime recipe. */
export declare function createPairedAffineDeformation(value: PairedAffineAuthoring): PairedAffineDeformation;
/** Validate complete composed sizes BEFORE runtime allocates any derived geometry. */
export declare function validateAccessoryPluginSurfaceConnectors(value: unknown, baseVertexCount: number, baseIndexCount: number): AccessoryPluginSurfaceConnector[];
/** Evaluate a validated recipe. Only landmark position and supplied dimensions vary. */
export declare function evaluatePairedAffineDeformation(recipe: PairedAffineDeformation, eyes: AccessoryPluginEyeMeasurements, mountScale?: number): Vec3[];
/** Outward-wound capped tube topology, with two cap-center vertices at the end. */
export declare function createSurfaceTubeTopology(rings: number, sides: number): Uint16Array;
/** Generic finite-difference circular sweep; contact and path authoring stay separate. */
export declare function sweepSurfaceTube(path: readonly Vec3[], radius: number, sides: number): Vec3[];
/** Smooth indexed normals. Precision selects the source of triangle differences, not shading. */
export declare function geometryFromPluginPoints(points: readonly Vec3[], indices: readonly number[] | Uint16Array, normalPrecision?: 'float32' | 'float64'): Float32Array;
