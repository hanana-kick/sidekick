import type { Vec2, Vec3 } from './design.js';
import type { Pose } from './motion.js';
import { clamp, spring } from './math.js';

/** Pointer behavior, independent of appearance, body orientation and authored motion. */
export const TRACKING_MODES = Object.freeze(['off', 'eyes', 'eyes-and-body'] as const);
export type TrackingMode = typeof TRACKING_MODES[number];
export function parseTrackingMode(value: unknown): TrackingMode {
  if (!TRACKING_MODES.includes(value as TrackingMode)) throw new TypeError('trackingMode must be off, eyes, or eyes-and-body');
  return value as TrackingMode;
}

// Internal presentation layer. Never write its values into the motion timeline.
const LIMITS: Vec3 = [0.14, 0.22, 0.035];
export class TrackingBodyLayer {
  private offset: Vec3 = [0, 0, 0];
  private velocity: Vec3 = [0, 0, 0];
  private target: Vec3 = [0, 0, 0];
  follow(gaze: Vec2 | undefined): void {
    this.target = gaze ? [-gaze[1] * LIMITS[0], gaze[0] * LIMITS[1], -gaze[0] * LIMITS[2]] : [0, 0, 0];
  }
  get active(): boolean { return this.target.some((target, i) => Math.abs(target - this.offset[i]!) > 0.00001 || Math.abs(this.velocity[i]!) > 0.00001); }
  get settling(): boolean { return this.target.every(value => value === 0) && this.active; }
  reset(): void { this.offset = [0, 0, 0]; this.velocity = [0, 0, 0]; this.target = [0, 0, 0]; }
  advance(delta: number): void {
    for (const i of [0, 1, 2] as const) {
      const [offset, velocity] = spring(this.offset[i], this.velocity[i], this.target[i], clamp(delta, 0, .05), 12);
      this.offset[i] = clamp(offset, -LIMITS[i], LIMITS[i]);
      this.velocity[i] = this.offset[i] === offset ? velocity : 0;
      if (Math.abs(this.target[i] - this.offset[i]) < .00001 && Math.abs(this.velocity[i]) < .00001) { this.offset[i] = this.target[i]; this.velocity[i] = 0; }
    }
  }
  compose(pose: Pose): Pose {
    return { ...pose, rotation: pose.rotation.map((value, i) => value + this.offset[i]!) as Vec3 };
  }
}
