import type { Vec2 } from './design.js';
import type { Pose, ActivityFrame } from './motion.js';
import type { Mat4 } from './math.js';
/** Transient view-space presentation; never persisted into design or authored pose. */
export interface TravelPresentation {
    direction: Vec2;
    strength: number;
    lift: number;
    bank: number;
}
export declare function travelMatrix(base: Mat4, travel?: TravelPresentation): Mat4;
export declare function travelPose(pose: Pose, travel?: TravelPresentation): Pose;
export declare function travelActivity(activity: ActivityFrame, travel?: TravelPresentation): ActivityFrame;
