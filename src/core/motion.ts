import type { Activity, Vec2, Vec3 } from './design.js';
import { finite } from './design.js';
export interface Pose { rotation: Vec3; face: Vec2; gaze: Vec2; openness: number; accessories: Record<string, Vec3> }
export interface MotionTarget {
  body?: { rotation: Vec3 };
  face?: { uv: Vec2 };
  eyes?: { openness: number };
  accessories?: Record<string, { rotation: Vec3 }>;
}
export interface MotionOptions { duration?: number; easing?: 'linear' | 'smooth' }
export interface MotionResult { finished: boolean }
export const initialPose = (): Pose => ({ rotation: [0, 0, 0], face: [0, 0], gaze: [0, 0], openness: 1, accessories: {} });
function vec(value: number[], length: number, min: number, max: number): number[] {
  if (!Array.isArray(value) || value.length !== length) throw new TypeError('잘못된 모션 벡터입니다.');
  return value.map(v => finite(v, min, max, 'motion'));
}
export class MotionTimeline {
  pose = initialPose();
  private transition?: { from: Pose; to: Pose; elapsed: number; duration: number; smooth: boolean; resolve: (result: MotionResult) => void };
  get active(): boolean { return !!this.transition; }
  to(target: MotionTarget, options: MotionOptions = {}): Promise<MotionResult> {
    const duration = finite(options.duration ?? 400, 0, 60000, 'duration');
    if (options.easing !== undefined && options.easing !== 'linear' && options.easing !== 'smooth') throw new TypeError('지원하지 않는 easing입니다.');
    const next = structuredClone(this.pose);
    if (target.body) next.rotation = vec(target.body.rotation, 3, -Math.PI * 2, Math.PI * 2) as Vec3;
    if (target.face) next.face = vec(target.face.uv, 2, -0.5, 0.5) as Vec2;
    if (target.eyes) next.openness = finite(target.eyes.openness, 0, 1, 'openness');
    for (const [id, value] of Object.entries(target.accessories ?? {})) {
      if (!/^[a-z][a-z0-9-]{0,39}$/.test(id)) throw new TypeError('잘못된 액세서리 id입니다.');
      next.accessories[id] = vec(value.rotation, 3, -Math.PI, Math.PI) as Vec3;
    }
    this.cancel();
    if (duration === 0) { this.pose = next; return Promise.resolve({ finished: true }); }
    return new Promise(resolve => { this.transition = { from: structuredClone(this.pose), to: next, elapsed: 0, duration, smooth: options.easing !== 'linear', resolve }; });
  }
  advance(ms: number): void {
    finite(ms, 0, 60000, 'delta');
    const t = this.transition;
    if (!t) return;
    t.elapsed = Math.min(t.duration, t.elapsed + ms);
    const ratio = t.elapsed / t.duration, eased = t.smooth ? ratio * ratio * (3 - 2 * ratio) : ratio;
    const lerp = (a: number, b: number): number => a + (b - a) * eased;
    const array = (a: number[], b: number[]): number[] => b.map((v, i) => lerp(a[i] ?? 0, v));
    this.pose.rotation = array(t.from.rotation, t.to.rotation) as Vec3;
    this.pose.face = array(t.from.face, t.to.face) as Vec2;
    this.pose.openness = lerp(t.from.openness, t.to.openness);
    for (const [id, rotation] of Object.entries(t.to.accessories)) this.pose.accessories[id] = array(t.from.accessories[id] ?? [0, 0, 0], rotation) as Vec3;
    if (ratio === 1) { this.transition = undefined; t.resolve({ finished: true }); }
  }
  cancel(): void { const t = this.transition; this.transition = undefined; t?.resolve({ finished: false }); }
}
export interface ActivityFrame { bob: number; roll: number; squash: number; gaze: Vec2; blink: number }
export function activityFrame(activity: Activity, time: number, reduced = false): ActivityFrame {
  if (reduced || activity === 'still') return { bob: 0, roll: 0, squash: 1, gaze: [0, 0], blink: 1 };
  const breathe = Math.sin(time * 2.2);
  const frame: ActivityFrame = { bob: breathe * 0.018, roll: Math.sin(time * 1.1) * 0.025, squash: 1 + breathe * 0.016, gaze: [0, 0], blink: 1 };
  const blinkPhase = time % 4.6;
  if (blinkPhase > 4.35) frame.blink = Math.max(0.06, Math.abs((blinkPhase - 4.475) / 0.125));
  if (activity === 'thinking') { frame.roll += 0.12; frame.gaze = [0.3, 0.35]; }
  if (activity === 'listening') { frame.roll += Math.sin(time * 3) * 0.05; frame.squash += Math.sin(time * 3) * 0.014; }
  if (activity === 'speaking') { frame.squash += Math.sin(time * 12) * 0.035; frame.bob += Math.sin(time * 6) * 0.016; }
  if (activity === 'celebrating') { frame.bob += Math.abs(Math.sin(time * 5)) * 0.14; frame.roll += Math.sin(time * 5) * 0.12; frame.squash += Math.sin(time * 10) * 0.055; }
  return frame;
}
