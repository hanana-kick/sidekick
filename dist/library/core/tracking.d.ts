import type { Vec2 } from './design.js';
import type { Pose } from './motion.js';
/** Pointer behavior, independent of appearance, body orientation and authored motion. */
export declare const TRACKING_MODES: readonly ["off", "eyes", "eyes-and-body"];
export type TrackingMode = typeof TRACKING_MODES[number];
export declare function parseTrackingMode(value: unknown): TrackingMode;
export declare class TrackingBodyLayer {
    private offset;
    private velocity;
    private target;
    follow(gaze: Vec2 | undefined): void;
    get active(): boolean;
    get settling(): boolean;
    reset(): void;
    advance(delta: number): void;
    compose(pose: Pose): Pose;
}
