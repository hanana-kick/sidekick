import type { AccessorySlot, Vec3 } from './design.cjs';
import type { Skeleton, SkinBinding } from './rigging.cjs';
/** A compact radial weight field in neutral body-local coordinates (before activity squash). */
export interface BodyBoneInfluence {
    bone: string;
    center: Vec3;
    radius: number;
}
/** Topology-independent binding: a changed body contour regenerates weights from these fields. */
export interface BodyRig {
    skeleton: Skeleton;
    influences: readonly BodyBoneInfluence[];
    /** Vertices outside every influence follow this bone, or the first bone when omitted. */
    fallbackBone?: string;
    /** Optional rigid mounts, applied after normal accessory seating. */
    attachments?: Partial<Record<AccessorySlot, string>>;
}
/** Validate and own all mutable input, suitable for worker messages and later author edits. */
export declare function validateBodyRig(value: unknown): BodyRig;
/** Select the four strongest compact quadratic fields, normalize, and use a rigid fallback outside. */
export declare function createBodySkinBinding(vertices: Float32Array, input: BodyRig): SkinBinding;
