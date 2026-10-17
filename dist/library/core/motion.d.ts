import type { Activity, Vec2, Vec3 } from './design.js';
import type { EyeExpressionPose, EyeShapeWeights, EyeState, LegacyEyeStatePatch } from './expressions.js';
export type EyeSide = 'left' | 'right';
export type EyeStates = Record<EyeSide, EyeState>;
/** Curated geometry stays internal; eye motion changes only the two shape-key weights. */
export type EyeMotionTarget = {
    weights?: Partial<EyeShapeWeights>;
    expression?: never;
    openness?: never;
} | (LegacyEyeStatePatch & {
    weights?: never;
});
export interface Pose {
    rotation: Vec3;
    face: Vec2;
    gaze: Vec2;
    /** Legacy global multiplier, composed with each eye's expression and activity blink. */
    openness: number;
    eyes: Record<EyeSide, EyeExpressionPose>;
    accessories: Record<string, Vec3>;
}
export interface MotionTarget {
    body?: {
        rotation: Vec3;
    };
    face?: {
        uv: Vec2;
    };
    eyes?: {
        openness?: number;
        left?: EyeMotionTarget;
        right?: EyeMotionTarget;
    };
    accessories?: Record<string, {
        rotation: Vec3;
    }>;
}
export interface MotionOptions {
    duration?: number;
    easing?: 'linear' | 'smooth';
}
export interface MotionResult {
    finished: boolean;
}
export declare const initialPose: () => Pose;
/** Validate caller options before lifecycle/accessibility overrides are applied. */
export declare function validateMotionOptions(options?: MotionOptions): Required<MotionOptions>;
/** Disjoint channels keep their own clocks; only a replaced channel is interrupted. */
export declare class MotionTimeline {
    pose: Pose;
    private eyeStates;
    private tracks;
    constructor(eyes?: EyeStates);
    get active(): boolean;
    get eyeMotion(): Record<EyeSide, boolean>;
    private values;
    private write;
    private settle;
    private stopChannel;
    /** Replace only edited design baselines; unrelated movement keeps its original timing. */
    setEyes(states: EyeStates, sides?: EyeSide[]): void;
    /** Removed design parts must not be resurrected by an unfinished motion track. */
    removeAccessories(ids: string[]): void;
    to(target: MotionTarget, options?: MotionOptions): Promise<MotionResult>;
    advance(ms: number): void;
    cancel(): void;
}
export interface ActivityFrame {
    bob: number;
    roll: number;
    squash: number;
    gaze: Vec2;
    blink: number;
}
export declare function activityFrame(activity: Activity, time: number, reduced?: boolean): ActivityFrame;
