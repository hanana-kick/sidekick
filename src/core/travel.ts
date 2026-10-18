import type { Vec2 } from './design.js';
import type { Pose, ActivityFrame } from './motion.js';
import { multiply, transform } from './math.js';
import type { Mat4 } from './math.js';

/** Transient view-space presentation; never persisted into design or authored pose. */
export interface TravelPresentation { direction: Vec2; strength: number; lift: number; bank: number }
export function travelMatrix(base: Mat4, travel?: TravelPresentation): Mat4 {
  if (!travel || travel.strength === 0 && travel.lift === 0 && travel.bank === 0) return base;
  // Screen y points down. Pre-multiplication keeps direction correct at any body orientation yaw/roll.
  return multiply(transform([0, travel.lift, 0], [travel.direction[1] * .24 * travel.strength, travel.direction[0] * .45 * travel.strength, travel.bank]), base);
}
export function travelPose(pose: Pose, travel?: TravelPresentation): Pose {
  if (!travel || !travel.strength) return pose;
  const w = travel.strength;
  return { ...pose, gaze: [pose.gaze[0] * (1 - w) + travel.direction[0] * .75 * w, pose.gaze[1] * (1 - w) - travel.direction[1] * .75 * w] };
}
export function travelActivity(activity: ActivityFrame, travel?: TravelPresentation): ActivityFrame {
  if (!travel || !travel.strength) return activity;
  const weight = 1 - travel.strength;
  // Keep eyes/blinks and geometry squash. Only replace competing presentation transforms.
  return { ...activity, bob: activity.bob * weight, roll: activity.roll * weight, gaze: [activity.gaze[0] * weight, activity.gaze[1] * weight] };
}
