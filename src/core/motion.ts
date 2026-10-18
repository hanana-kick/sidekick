import type { Activity, Vec2, Vec3 } from './design.js';
import { finite } from './design.js';
import { automaticBlink, createEyeState, expressionPose, parseEyeState, patchEyeState } from './expressions.js';
import type { EyeExpressionPose, EyeShapeWeights, EyeState, EyeStateInputPatch, LegacyEyeStatePatch } from './expressions.js';
export type EyeSide = 'left' | 'right';
export type EyeStates = Record<EyeSide, EyeState>;
/** Curated geometry stays internal; eye motion changes only the two shape-key weights. */
export type EyeMotionTarget = { weights?: Partial<EyeShapeWeights>; expression?: never; openness?: never } | (LegacyEyeStatePatch & { weights?: never });
export interface Pose {
  rotation: Vec3; face: Vec2; gaze: Vec2;
  /** Legacy global multiplier, composed with each eye's expression and activity blink. */
  openness: number;
  eyes: Record<EyeSide, EyeExpressionPose>;
  accessories: Record<string, Vec3>;
}
export interface MotionTarget {
  body?: { rotation: Vec3 };
  face?: { uv: Vec2 };
  eyes?: { openness?: number; left?: EyeMotionTarget; right?: EyeMotionTarget };
  accessories?: Record<string, { rotation: Vec3 }>;
}
export interface MotionOptions { duration?: number; easing?: 'linear' | 'smooth' }
export interface MotionResult { finished: boolean }
const eyeSides: EyeSide[] = ['left', 'right'];
const initialEyes = (): EyeStates => ({ left: createEyeState(), right: createEyeState() });
export const initialPose = (): Pose => ({ rotation: [0, 0, 0], face: [0, 0], gaze: [0, 0], openness: 1, eyes: { left: { openness: 1, smile: 0 }, right: { openness: 1, smile: 0 } }, accessories: {} });
function object(value: unknown, path: string, keys?: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${path}: 객체가 필요합니다.`);
  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new TypeError(`${path}: 일반 객체가 필요합니다.`);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || (keys && !keys.includes(key))) throw new TypeError(`${path}.${String(key)}: 지원하지 않는 항목입니다.`);
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) throw new TypeError(`${path}.${key}: 일반 데이터 항목이 필요합니다.`);
  }
  return value as Record<string, unknown>;
}
/** Validate caller options before lifecycle/accessibility overrides are applied. */
export function validateMotionOptions(options: MotionOptions = {}): Required<MotionOptions> {
  object(options, 'options', ['duration', 'easing']);
  const duration = finite(options.duration === undefined ? 400 : options.duration, 0, 60000, 'duration');
  if (options.easing !== undefined && options.easing !== 'linear' && options.easing !== 'smooth') throw new TypeError('지원하지 않는 easing입니다.');
  return { duration, easing: options.easing ?? 'smooth' };
}
function vec(value: unknown, length: number, min: number, max: number): number[] {
  if (!Array.isArray(value) || value.length !== length) throw new TypeError('잘못된 모션 벡터입니다.');
  return value.map(v => finite(v, min, max, 'motion'));
}
function eyeTarget(value: unknown, previous: EyeState): EyeState {
  const patch = object(value, 'eyes', ['weights', 'expression', 'openness']);
  return patchEyeState(previous, patch as EyeStateInputPatch);
}
type MotionChannel = 'rotation' | 'face' | 'openness' | EyeSide | `accessory:${string}`;
interface MotionRequest { remaining: number; settled: boolean; resolve: (result: MotionResult) => void }
interface MotionTrack {
  from: number[]; to: number[]; slope: number[]; elapsed: number; duration: number; smooth: boolean; request: MotionRequest;
}

/** Disjoint channels keep their own clocks; only a replaced channel is interrupted. */
export class MotionTimeline {
  pose = initialPose();
  private eyeStates = initialEyes();
  private tracks = new Map<MotionChannel, MotionTrack>();
  constructor(eyes?: EyeStates) { if (eyes) this.setEyes(eyes); }
  get active(): boolean { return this.tracks.size > 0; }
  get eyeMotion(): Record<EyeSide, boolean> {
    return { left: this.tracks.has('left') || this.tracks.has('openness'), right: this.tracks.has('right') || this.tracks.has('openness') };
  }
  private values(channel: MotionChannel, pose = this.pose): number[] {
    if (channel === 'rotation') return [...pose.rotation];
    if (channel === 'face') return [...pose.face];
    if (channel === 'openness') return [pose.openness];
    if (channel === 'left' || channel === 'right') return [pose.eyes[channel].openness, pose.eyes[channel].smile];
    return [...(pose.accessories[channel.slice(10)] ?? [0, 0, 0])];
  }
  private write(channel: MotionChannel, values: number[]): void {
    if (channel === 'rotation') this.pose.rotation = values as Vec3;
    else if (channel === 'face') this.pose.face = values as Vec2;
    else if (channel === 'openness') this.pose.openness = values[0]!;
    else if (channel === 'left' || channel === 'right') this.pose.eyes[channel] = { openness: values[0]!, smile: values[1]! };
    else this.pose.accessories[channel.slice(10)] = values as Vec3;
  }
  private settle(request: MotionRequest, finished: boolean): void {
    if (!request.settled) { request.settled = true; request.resolve({ finished }); }
  }
  private stopChannel(channel: MotionChannel): void {
    const previous = this.tracks.get(channel);
    if (previous) { this.tracks.delete(channel); this.settle(previous.request, false); }
  }
  /** Replace only edited design baselines; unrelated movement keeps its original timing. */
  setEyes(states: EyeStates, sides: EyeSide[] = eyeSides): void {
    const value = object(states, 'eyes', ['left', 'right']);
    const next: EyeStates = { left: parseEyeState(value.left, 'eyes.left'), right: parseEyeState(value.right, 'eyes.right') };
    if (!Array.isArray(sides) || sides.some(side => !eyeSides.includes(side))) throw new TypeError('잘못된 눈 방향입니다.');
    for (const side of sides) {
      this.stopChannel(side); this.eyeStates[side] = next[side]; this.pose.eyes[side] = expressionPose(next[side]);
    }
    if (new Set(sides).size === 2) { this.stopChannel('openness'); this.pose.openness = 1; }
  }
  /** Removed design parts must not be resurrected by an unfinished motion track. */
  removeAccessories(ids: string[]): void {
    if (!Array.isArray(ids) || ids.some(id => typeof id !== 'string' || !/^[a-z][a-z0-9-]{0,39}$/.test(id))) throw new TypeError('잘못된 액세서리 id입니다.');
    for (const id of ids) { this.stopChannel(`accessory:${id}`); delete this.pose.accessories[id]; }
  }
  to(target: MotionTarget, options: MotionOptions = {}): Promise<MotionResult> {
    const value = object(target, 'motion', ['body', 'face', 'eyes', 'accessories']);
    const { duration, easing } = validateMotionOptions(options);
    const next = structuredClone(this.pose), nextEyes = structuredClone(this.eyeStates);
    const channels: MotionChannel[] = [];
    if (value.body !== undefined) {
      const body = object(value.body, 'body', ['rotation']);
      next.rotation = vec(body.rotation, 3, -Math.PI * 2, Math.PI * 2) as Vec3; channels.push('rotation');
    }
    if (value.face !== undefined) {
      const face = object(value.face, 'face', ['uv']);
      next.face = vec(face.uv, 2, -0.5, 0.5) as Vec2; channels.push('face');
    }
    if (value.eyes !== undefined) {
      const eyes = object(value.eyes, 'eyes', ['openness', 'left', 'right']);
      if (eyes.openness !== undefined) { next.openness = finite(eyes.openness, 0, 1, 'openness'); channels.push('openness'); }
      for (const side of eyeSides) if (eyes[side] !== undefined) {
        nextEyes[side] = eyeTarget(eyes[side], nextEyes[side]);
        next.eyes[side] = expressionPose(nextEyes[side]); channels.push(side);
      }
    }
    const accessories = value.accessories === undefined ? {} : object(value.accessories, 'accessories');
    for (const [id, entry] of Object.entries(accessories)) {
      if (!/^[a-z][a-z0-9-]{0,39}$/.test(id)) throw new TypeError('잘못된 액세서리 id입니다.');
      const accessory = object(entry, `accessories.${id}`, ['rotation']);
      next.accessories[id] = vec(accessory.rotation, 3, -Math.PI, Math.PI) as Vec3; channels.push(`accessory:${id}`);
    }
    // No validation below this point: invalid replacements leave every running track intact.
    this.eyeStates = nextEyes;
    if (!channels.length) return Promise.resolve({ finished: true });
    return new Promise(resolve => {
      const request: MotionRequest = { remaining: channels.length, settled: false, resolve };
      for (const channel of channels) {
        const previous = this.tracks.get(channel), from = this.values(channel), to = this.values(channel, next);
        const slope = to.map((end, index) => {
          if (!previous || duration === 0 || end === from[index]) return 0;
          const ratio = previous.elapsed / previous.duration;
          const derivative = previous.smooth ? 6 * ratio * (1 - ratio) + (3 * ratio * ratio - 4 * ratio + 1) * previous.slope[index]! : 1;
          const velocity = (previous.to[index]! - previous.from[index]!) * derivative / previous.duration;
          // Preserve continuing velocity without overshoot; reversing starts at rest.
          return Math.max(0, Math.min(3, velocity * duration / (end - from[index]!)));
        });
        this.stopChannel(channel);
        if (duration === 0) { this.write(channel, to); request.remaining--; }
        else this.tracks.set(channel, { from, to, slope, elapsed: 0, duration, smooth: easing === 'smooth', request });
      }
      if (request.remaining === 0) this.settle(request, true);
    });
  }
  advance(ms: number): void {
    finite(ms, 0, 60000, 'delta');
    for (const [channel, track] of this.tracks) {
      track.elapsed = Math.min(track.duration, track.elapsed + ms);
      const ratio = track.elapsed / track.duration;
      this.write(channel, track.to.map((end, index) => {
        const eased = track.smooth ? ratio * ratio * (3 - 2 * ratio) + ratio * (1 - ratio) * (1 - ratio) * track.slope[index]! : ratio;
        return track.from[index]! + (end - track.from[index]!) * eased;
      }));
      if (ratio === 1) {
        this.tracks.delete(channel); track.request.remaining--;
        if (track.request.remaining === 0) this.settle(track.request, true);
      }
    }
  }
  cancelEyes(): void { for (const channel of ['left', 'right', 'openness'] as const) this.stopChannel(channel); }
  cancel(): void { for (const channel of this.tracks.keys()) this.stopChannel(channel); }
}
export interface ActivityFrame { bob: number; roll: number; squash: number; gaze: Vec2; blink: number }
export function activityFrame(activity: Activity, time: number, reduced = false): ActivityFrame {
  if (reduced || activity === 'still') return { bob: 0, roll: 0, squash: 1, gaze: [0, 0], blink: 1 };
  const breathe = Math.sin(time * 2.2);
  const frame: ActivityFrame = { bob: breathe * 0.018, roll: Math.sin(time * 1.1) * 0.025, squash: 1 + breathe * 0.016, gaze: [0, 0], blink: 1 };
  frame.blink = automaticBlink(time);
  if (activity === 'thinking') { frame.roll += 0.12; frame.gaze = [0.3, 0.35]; }
  if (activity === 'listening') { frame.roll += Math.sin(time * 3) * 0.05; frame.squash += Math.sin(time * 3) * 0.014; }
  if (activity === 'speaking') { frame.squash += Math.sin(time * 12) * 0.035; frame.bob += Math.sin(time * 6) * 0.016; }
  if (activity === 'celebrating') { frame.bob += Math.abs(Math.sin(time * 5)) * 0.14; frame.roll += Math.sin(time * 5) * 0.12; frame.squash += Math.sin(time * 10) * 0.055; }
  return frame;
}
