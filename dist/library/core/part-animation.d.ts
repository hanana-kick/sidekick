import type { Vec2, Vec3 } from './design.js';
export interface PartKeyframe<T> {
    time: number;
    value: T;
}
interface Track<T> {
    keyframes: PartKeyframe<T>[];
    interpolation?: 'linear' | 'smooth';
}
/** Rotations are XYZ Euler radians, interpolated component-wise, not shortest-path quaternion rotations. */
export type PartAnimationTrack = (Track<Vec3> & {
    target: 'body';
    channel: 'rotation';
}) | (Track<Vec2> & {
    target: 'face';
    channel: 'uv';
})
/** Eye weights are [smile, blink], each in [0, 1]. */
 | (Track<Vec2> & {
    target: 'leftEye' | 'rightEye';
    channel: 'weights';
}) | (Track<Vec3> & {
    target: {
        accessory: string;
    };
    channel: 'rotation' | 'position' | 'scale';
}) | (Track<number> & {
    target: {
        accessory: string;
    };
    channel: 'opacity';
});
/** Times and duration are seconds. A looping clip samples time === duration at time zero. */
export interface PartAnimationClip {
    duration: number;
    loop?: boolean;
    tracks: PartAnimationTrack[];
}
export interface PartAccessorySample {
    rotation?: Vec3;
    position?: Vec3;
    scale?: Vec3;
    opacity?: number;
}
export interface PartAnimationSample {
    bodyRotation?: Vec3;
    face?: Vec2;
    eyes?: {
        left?: {
            smile: number;
            openness: number;
        };
        right?: {
            smile: number;
            openness: number;
        };
    };
    accessories: Record<string, PartAccessorySample>;
}
export declare const PART_ANIMATION_LIMITS: Readonly<{
    maxTracks: 128;
    maxKeyframes: 4096;
    maxDuration: 86400;
}>;
/** Strict validation and defensive copy. Call once when accepting a clip, not on every frame. */
export declare function validatePartAnimation(value: unknown): PartAnimationClip;
/** Sample a validated clip deterministically; endpoint values hold outside each track's key range. */
export declare function samplePartAnimation(clip: PartAnimationClip, time: number): PartAnimationSample;
export {};
