import type { Vec3 } from '../core/design.js';
type Point = readonly [number, number, number];
/** Flat buffers contain XYZ, or XYZ plus three other values with stride: 6. */
export type ClothPositions = readonly Point[] | Float32Array | Float64Array;
type Indices = ArrayLike<number>;
interface PositionOptions {
    stride?: 3 | 6;
}
export interface ClothClearanceOptions extends PositionOptions {
    /** Trajectory-distance backoff before contact, capped at 2% of displacement. */
    clearance?: number;
    /** Physical tolerance for an initially touching point; defaults to 1e-7. */
    epsilon?: number;
}
export interface ClothIntersectionOptions extends PositionOptions {
    /** Physical contact tolerance. Touching within this distance counts; default 1e-8. */
    epsilon?: number;
}
export interface ClothSegmentHit {
    fraction: number;
    /** Absolute movement along the hit face's unit normal over the whole segment. */
    normalSpeed: number;
    triangleIndex: number;
}
/**
 * Immutable snapshot of body triangles, accelerated with a spatial BVH whose
 * median fallback bounds split imbalance for degenerate point distributions.
 * Reuse this object for all cloth queries while body positions stay unchanged;
 * rebuild after changing body geometry/transforms. Input arrays are never changed.
 * Degenerate triangles are omitted. Outward winding is required to distinguish
 * leaving versus entering a face when a trajectory begins within epsilon of it.
 */
export declare class BodyTriangleBVH {
    private readonly triangles;
    private readonly nodes;
    private readonly stack;
    readonly triangleCount: number;
    constructor(points: ClothPositions, indices: Indices, options?: PositionOptions);
    private build;
    /**
     * Static surface intersection, including coplanar overlap and face/edge/vertex
     * touching within epsilon. Tests complete triangles, not sampled trajectories.
     * Degenerate triangles are ignored. This does not detect complete containment
     * without a surface intersection, self-intersections, or collision during motion.
     * Returns on the first intersecting triangle pair; does not modify either mesh.
     */
    intersectsMesh(points: ClothPositions, indices: Indices, options?: ClothIntersectionOptions): boolean;
    /**
     * Earliest surface contact over a rigid translation along direction, normalized
     * internally. maxDistance and the result are physical model-space distances.
     * Solves continuous SAT intervals for complete triangle pairs, including
     * coplanar sliding and zero axis velocities; no discrete motion samples.
     * Initial intersection/touching returns 0. A zero direction tests only the
     * initial mesh. Epsilon expands projection intervals in physical units.
     *
     * Valid only for one constant translation: no rotation, scaling, deformation,
     * or moving body. Degenerate faces and containment without surface contact
     * are excluded, as in intersectsMesh. Does not modify either input mesh.
     */
    firstMeshHit(points: ClothPositions, indices: Indices, direction: Point, maxDistance: number, options?: ClothIntersectionOptions): number | undefined;
    /** minZ excludes whole triangles below that height; it does not clip triangles. */
    closestPoint(p: Point, options?: {
        minZ?: number;
    }): Vec3 | undefined;
    /**
     * Area-weighted drape guidance from triangles within blendRadius (default
     * .003) of the closest distance. Cubic weights vanish smoothly at the band
     * edge. Area weighting reduces, but cannot eliminate, tessellation bias.
     * The average can lie between disconnected surfaces; NEVER use it as an
     * actual surface point, penetration correction, or clearance certificate.
     *
     * With minZ, eligible triangles fade through a smooth distance penalty over
     * the band [minZ - blendRadius, minZ] instead of switching off at minZ.
     * Continuity is conditional on retaining at least one eligible triangle and
     * continuous geometry; this does not smooth discrete topology changes.
     * A zero radius delegates to the unchanged exact closestPoint query.
     */
    blendedClosestPoint(p: Point, options?: {
        blendRadius?: number;
        minZ?: number;
    }): Vec3 | undefined;
    /** Two-sided crossing test; initially touching outward/tangent paths are allowed. */
    firstHit(start: Point, end: Point, epsilon?: number): ClothSegmentHit | undefined;
}
/**
 * Return one scalar for start + scalar * (end - start), preserving the shared
 * deformation field. Tests every vertex, unique edge midpoint, and triangle
 * centroid trajectory against the fixed body. No random samples or per-vertex
 * corrections. Pass immutable indices to reuse the cached sampling topology.
 *
 * This is a sampled displacement limiter, NOT continuous triangle/triangle
 * collision detection: unsampled face/edge crossings, existing intersections,
 * self-intersections, and coplanar sliding are not resolved. Start must already
 * be a valid, clear garment. It guarantees no sampled transverse crossing up to
 * the returned fraction within numerical tolerances, not a global separation
 * distance. Clearance backs away along each trajectory, capped at 2% of its
 * displacement so a near-tangent hit cannot impose unbounded normal-distance
 * backoff on the whole garment. This does not guarantee a normal clearance gap
 * or temporal continuity when which trajectory hits changes, and cannot create
 * clearance where the starting garment has none.
 */
export declare function clothDisplacementFactor(body: BodyTriangleBVH, start: ClothPositions, end: ClothPositions, indices: Indices, options?: ClothClearanceOptions): number;
export {};
