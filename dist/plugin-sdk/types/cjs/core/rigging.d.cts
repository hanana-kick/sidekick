import type { Vec3 } from './design.cjs';
import type { Mat4 } from './math.cjs';
/** CPU skinning is intentionally bounded and data-only; scale is not supported. */
export declare const RIGGING_LIMITS: Readonly<{
    maxBones: 32;
    maxVertices: 16384;
    maxCoordinate: 16;
    maxRotation: number;
    influences: 4;
    weightTolerance: 0.00001;
}>;
export interface RigBone {
    id: string;
    parent?: string;
    position?: Vec3;
    rotation?: Vec3;
}
export interface Skeleton {
    bones: RigBone[];
}
export interface BonePoseTransform {
    position?: Vec3;
    rotation?: Vec3;
}
/** Each transform is a local delta, appended AFTER the bone's local bind transform. */
export type BonePose = Record<string, BonePoseTransform>;
export interface SkinBinding {
    skeleton: Skeleton;
    joints: Uint8Array;
    weights: Float32Array;
}
export interface BoneMatrices {
    local: Mat4[];
    world: Mat4[];
    bindWorld: Mat4[];
    inverseBind: Mat4[];
    deformation: Mat4[];
}
export interface SkinDeformer {
    /** The default output buffer is reused. Copy it if the result must survive the next call. */
    deform(pose?: BonePose, out?: Float32Array): Float32Array;
}
/** Shared by animation track validation; never allow prototype keys as bone identities. */
export declare function isBoneId(value: unknown): value is string;
/** Validate and clone. Input order is retained, including when parents follow children. */
export declare function validateSkeleton(value: unknown): Skeleton;
/** Unknown bones, scale, executable properties, and unbounded values are rejected. */
export declare function validateBonePose(value: unknown, skeleton: Skeleton): BonePose;
/** Own all rig data before registration, worker transport, or repeated evaluation. */
export declare function validateSkinBinding(value: unknown, count: number): SkinBinding;
/** All arrays retain the authored bone order. Matrices are column-major, matching math.ts. */
export declare function computeBoneMatrices(skeleton: Skeleton, pose?: BonePose): BoneMatrices;
/** World means skeleton/model-local space, before the accessory or avatar model matrix. */
export declare function getBoneTransform(skeleton: Skeleton, id: string, pose?: BonePose, space?: 'world' | 'local'): Mat4;
/** Validate once and cache the owned neutral mesh, binding, inverse bind, and output buffer. */
export declare function createSkinDeformer(vertices: Float32Array, binding: SkinBinding): SkinDeformer;
/** One-shot safe skinning; use createSkinDeformer for repeated animation frames. */
export declare function skinVertices(vertices: Float32Array, binding: SkinBinding, pose?: BonePose, out?: Float32Array): Float32Array;
