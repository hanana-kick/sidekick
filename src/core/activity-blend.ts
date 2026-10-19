import type { Activity } from './design.js';
import { activityFrame } from './motion.js';
import type { ActivityFrame } from './motion.js';

const values = (frame: ActivityFrame): number[] => [frame.bob, frame.roll, frame.squash, frame.blink, ...frame.gaze];
const frame = (value: number[]): ActivityFrame => ({ bob: value[0]!, roll: value[1]!, squash: value[2]!, blink: value[3]!, gaze: [value[4]!, value[5]!] });
const copy = (value: ActivityFrame): ActivityFrame => ({ ...value, gaze: [...value.gaze] });
/** Derivatives use seconds, matching the activity oscillator clock. */
function velocity(activity: Activity, time: number, reduced: boolean): number[] {
  const step = 0.00001;
  const before = values(activityFrame(activity, time - step, reduced));
  return values(activityFrame(activity, time + step, reduced)).map((value, index) => (value - before[index]!) / (2 * step));
}

/** Fade a pose/velocity correction to the running activity, preserving its phase. */
export class ActivityBlend {
  private source?: ActivityFrame;
  private offset: number[] = [];
  private slope: number[] = [];
  private elapsed = 0;
  private current: ActivityFrame;
  private currentVelocity: number[];
  private reduced: boolean;
  constructor(private activity: Activity, private time = 0, reduced = false, private readonly duration = 200) {
    if (!Number.isFinite(duration) || duration < 0) throw new RangeError('Activity blend duration must be finite and nonnegative.');
    this.reduced = reduced;
    this.current = activityFrame(activity, time, reduced);
    this.currentVelocity = velocity(activity, time, reduced);
  }
  get active(): boolean { return this.source !== undefined; }
  set(activity: Activity, immediate = false): void {
    if (activity === this.activity) { if (immediate) this.finish(); return; }
    // Use the displayed pose AND its derivative, including an interrupted blend.
    // A frozen source would stop the outgoing motion abruptly even with smoothstep.
    this.source = immediate || this.duration === 0 ? undefined : copy(this.current);
    this.activity = activity; this.elapsed = 0;
    if (this.source) {
      const target = values(activityFrame(activity, this.time, this.reduced));
      const targetVelocity = velocity(activity, this.time, this.reduced);
      this.offset = values(this.source).map((value, index) => value - target[index]!);
      this.slope = this.currentVelocity.map((value, index) => (value - targetVelocity[index]!) * this.duration / 1000);
    }
  }
  advance(milliseconds: number): void {
    if (!Number.isFinite(milliseconds)) throw new RangeError('Activity blend delta must be finite.');
    if (!this.source) return;
    this.elapsed += Math.max(0, milliseconds);
    if (this.elapsed >= this.duration) this.finish();
  }
  finish(): void { this.source = undefined; this.elapsed = 0; }
  sample(time: number, reduced = false): ActivityFrame {
    const target = activityFrame(this.activity, time, reduced);
    const targetVelocity = velocity(this.activity, time, reduced);
    this.time = time; this.reduced = reduced;
    if (reduced) this.finish();
    if (!this.source) { this.current = target; this.currentVelocity = targetVelocity; }
    else {
      const progress = Math.min(1, this.elapsed / this.duration);
      // Cubic Hermite correction: initial position/velocity error -> zero/zero.
      const positionWeight = (1 + 2 * progress) * (1 - progress) ** 2;
      const velocityWeight = progress * (1 - progress) ** 2;
      const positionDerivative = 6 * progress * (progress - 1);
      const velocityDerivative = (1 - progress) * (1 - 3 * progress);
      const next = values(target).map((value, index) => value + this.offset[index]! * positionWeight + this.slope[index]! * velocityWeight);
      this.currentVelocity = targetVelocity.map((value, index) => value + (this.offset[index]! * positionDerivative + this.slope[index]! * velocityDerivative) * 1000 / this.duration);
      // Blink is a bounded openness multiplier; inertial overshoot must not invert it.
      if (next[3]! < 0 || next[3]! > 1) { next[3] = Math.max(0, Math.min(1, next[3]!)); this.currentVelocity[3] = 0; }
      this.current = progress === 0 ? copy(this.source) : frame(next);
    }
    return copy(this.current);
  }
}
