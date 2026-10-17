import { clamp, spring } from './math.js';
/** Pointer behavior, independent of appearance, camera and authored body motion. */
export const TRACKING_MODES = Object.freeze(['off', 'eyes', 'eyes-and-body']);
export function parseTrackingMode(value) {
    if (!TRACKING_MODES.includes(value))
        throw new TypeError('trackingMode must be off, eyes, or eyes-and-body');
    return value;
}
// Internal presentation layer. Never write its values into the motion timeline.
const LIMITS = [0.14, 0.22, 0.035];
export class TrackingBodyLayer {
    offset = [0, 0, 0];
    velocity = [0, 0, 0];
    target = [0, 0, 0];
    follow(gaze) {
        this.target = gaze ? [-gaze[1] * LIMITS[0], gaze[0] * LIMITS[1], -gaze[0] * LIMITS[2]] : [0, 0, 0];
    }
    get active() { return this.target.some((target, i) => Math.abs(target - this.offset[i]) > 0.00001 || Math.abs(this.velocity[i]) > 0.00001); }
    get settling() { return this.target.every(value => value === 0) && this.active; }
    reset() { this.offset = [0, 0, 0]; this.velocity = [0, 0, 0]; this.target = [0, 0, 0]; }
    advance(delta) {
        for (const i of [0, 1, 2]) {
            const [offset, velocity] = spring(this.offset[i], this.velocity[i], this.target[i], clamp(delta, 0, .05), 12);
            this.offset[i] = clamp(offset, -LIMITS[i], LIMITS[i]);
            this.velocity[i] = this.offset[i] === offset ? velocity : 0;
            if (Math.abs(this.target[i] - this.offset[i]) < .00001 && Math.abs(this.velocity[i]) < .00001) {
                this.offset[i] = this.target[i];
                this.velocity[i] = 0;
            }
        }
    }
    compose(pose) {
        return { ...pose, rotation: pose.rotation.map((value, i) => value + this.offset[i]) };
    }
}
