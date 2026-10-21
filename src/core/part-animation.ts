import { isAccessoryInstanceId } from './accessory-id.js';
import type { Vec2, Vec3 } from './design.js';

export interface PartKeyframe<T> { time: number; value: T }
interface Track<T> { keyframes: PartKeyframe<T>[]; interpolation?: 'linear' | 'smooth' }
/** Rotations are XYZ Euler radians, interpolated component-wise, not shortest-path quaternion rotations. */
export type PartAnimationTrack =
  | (Track<Vec3> & { target: 'body'; channel: 'rotation' })
  | (Track<Vec2> & { target: 'face'; channel: 'uv' })
  /** Eye weights are [smile, blink], each in [0, 1]. */
  | (Track<Vec2> & { target: 'leftEye' | 'rightEye'; channel: 'weights' })
  | (Track<Vec3> & { target: { accessory: string }; channel: 'rotation' | 'position' | 'scale' })
  | (Track<number> & { target: { accessory: string }; channel: 'opacity' });
/** Times and duration are seconds. A looping clip samples time === duration at time zero. */
export interface PartAnimationClip { duration: number; loop?: boolean; tracks: PartAnimationTrack[] }
export interface PartAccessorySample { rotation?: Vec3; position?: Vec3; scale?: Vec3; opacity?: number }
export interface PartAnimationSample {
  bodyRotation?: Vec3;
  face?: Vec2;
  eyes?: { left?: { smile: number; openness: number }; right?: { smile: number; openness: number } };
  accessories: Record<string, PartAccessorySample>;
}
export const PART_ANIMATION_LIMITS = Object.freeze({ maxTracks: 128, maxKeyframes: 4096, maxDuration: 86400 });
function object(value: unknown, keys: readonly string[], path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new TypeError(`${path} must be a plain data object.`);
  for (const key of Reflect.ownKeys(value)) {
    const field = Object.getOwnPropertyDescriptor(value, key)!;
    if (typeof key !== 'string' || !keys.includes(key) || !field.enumerable || !Object.hasOwn(field, 'value')) throw new TypeError(`${path} contains unsupported or accessor data.`);
  }
  return value as Record<string, unknown>;
}
function array(value: unknown, maximum: number, path: string): unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > maximum || Reflect.ownKeys(value).length !== value.length + 1) throw new TypeError(`${path} must be a bounded dense plain array.`);
  for (let i = 0; i < value.length; i++) {
    const field = Object.getOwnPropertyDescriptor(value, String(i));
    if (!field?.enumerable || !Object.hasOwn(field, 'value')) throw new TypeError(`${path} must not contain holes or accessors.`);
  }
  return value;
}
function number(value: unknown, low: number, high: number, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < low || value > high) throw new RangeError(`${path} must be finite and within ${low}..${high}.`);
  return value;
}
function vector(value: unknown, length: 2 | 3, low: number, high: number): Vec2 | Vec3 {
  const input = array(value, length, 'keyframe value');
  if (input.length !== length) throw new TypeError(`Keyframe value requires ${length} components.`);
  return input.map(item => number(item, low, high, 'keyframe component')) as Vec2 | Vec3;
}
function id(value: unknown): string {
  if (!isAccessoryInstanceId(value)) throw new TypeError('Invalid accessory animation id.');
  return value;
}
/** Strict validation and defensive copy. Call once when accepting a clip, not on every frame. */
export function validatePartAnimation(value: unknown): PartAnimationClip {
  const input = object(value, ['duration', 'loop', 'tracks'], 'clip');
  const duration = number(input.duration, Number.MIN_VALUE, PART_ANIMATION_LIMITS.maxDuration, 'duration');
  if (Object.hasOwn(input, 'loop') && typeof input.loop !== 'boolean') throw new TypeError('loop must be boolean.');
  const inputs = array(input.tracks, PART_ANIMATION_LIMITS.maxTracks, 'tracks'), channels = new Set<string>(); let total = 0;
  if (!inputs.length) throw new RangeError('A part animation requires at least one track.');
  const tracks = inputs.map(raw => {
    const track = object(raw, ['target', 'channel', 'keyframes', 'interpolation'], 'track');
    if (Object.hasOwn(track, 'interpolation') && track.interpolation !== 'linear' && track.interpolation !== 'smooth') throw new TypeError('interpolation must be linear or smooth.');
    let target: PartAnimationTrack['target'], length: 0 | 2 | 3, low: number, high: number;
    if (typeof track.target === 'string') {
      target = track.target as PartAnimationTrack['target'];
      if (target === 'body' && track.channel === 'rotation') { length = 3; low = -Math.PI * 2; high = Math.PI * 2; }
      else if (target === 'face' && track.channel === 'uv') { length = 2; low = -.5; high = .5; }
      else if ((target === 'leftEye' || target === 'rightEye') && track.channel === 'weights') { length = 2; low = 0; high = 1; }
      else throw new TypeError('Unsupported part target/channel combination.');
    } else {
      const accessory = object(track.target, ['accessory'], 'target'); target = { accessory: id(accessory.accessory) };
      if (track.channel === 'opacity') { length = 0; low = 0; high = 1; }
      else if (track.channel === 'scale') { length = 3; low = .01; high = 16; }
      else if (track.channel === 'position') { length = 3; low = -16; high = 16; }
      else if (track.channel === 'rotation') { length = 3; low = -Math.PI * 2; high = Math.PI * 2; }
      else throw new TypeError('Unsupported accessory animation channel.');
    }
    const channelKey = `${typeof target === 'string' ? target : `accessory:${target.accessory}`}:${String(track.channel)}`;
    if (channels.has(channelKey)) throw new TypeError('Each animation target/channel must be unique.'); channels.add(channelKey);
    const frames = array(track.keyframes, PART_ANIMATION_LIMITS.maxKeyframes, 'keyframes'); total += frames.length;
    if (!frames.length || total > PART_ANIMATION_LIMITS.maxKeyframes) throw new RangeError('Animation requires 1..4096 total keyframes.');
    let previous = -1;
    const keyframes = frames.map(rawFrame => {
      const frame = object(rawFrame, ['time', 'value'], 'keyframe'), time = number(frame.time, 0, duration, 'keyframe time');
      if (time <= previous) throw new RangeError('Keyframe times must be strictly increasing.'); previous = time;
      return { time, value: length === 0 ? number(frame.value, low, high, 'keyframe value') : vector(frame.value, length, low, high) };
    });
    return { target, channel: track.channel, keyframes, ...(track.interpolation === undefined ? {} : { interpolation: track.interpolation }) } as PartAnimationTrack;
  });
  return { duration, ...(input.loop === undefined ? {} : { loop: input.loop as boolean }), tracks };
}
function sampleTrack(track: PartAnimationTrack, time: number): number | Vec2 | Vec3 {
  const frames = track.keyframes;
  const first = frames[0]!, last = frames[frames.length - 1]!;
  const copy = (value: number | Vec2 | Vec3): number | Vec2 | Vec3 => typeof value === 'number' ? value : [...value] as Vec2 | Vec3;
  if (time <= first.time) return copy(first.value);
  if (time >= last.time) return copy(last.value);
  let low = 0, high = frames.length - 1;
  while (high - low > 1) { const middle = (low + high) >>> 1; if (frames[middle]!.time <= time) low = middle; else high = middle; }
  const a = frames[low]!, b = frames[high]!;
  if (time === a.time) return copy(a.value);
  let t = (time - a.time) / (b.time - a.time);
  if (track.interpolation === 'smooth') t = t * t * (3 - 2 * t);
  if (typeof a.value === 'number') return a.value + ((b.value as number) - a.value) * t;
  return a.value.map((value, index) => value + ((b.value as Vec2 | Vec3)[index]! - value) * t) as Vec2 | Vec3;
}
/** Sample a validated clip deterministically; endpoint values hold outside each track's key range. */
export function samplePartAnimation(clip: PartAnimationClip, time: number): PartAnimationSample {
  if (!Number.isFinite(time)) throw new RangeError('Animation time must be finite.');
  const remainder = time % clip.duration;
  const local = clip.loop ? (remainder < 0 ? remainder + clip.duration : remainder) : Math.max(0, Math.min(clip.duration, time));
  const result: PartAnimationSample = { accessories: Object.create(null) as Record<string, PartAccessorySample> };
  for (const track of clip.tracks) {
    const value = sampleTrack(track, local);
    if (track.target === 'body') result.bodyRotation = value as Vec3;
    else if (track.target === 'face') result.face = value as Vec2;
    else if (track.target === 'leftEye' || track.target === 'rightEye') {
      const [smile, blink] = value as Vec2;
      (result.eyes ??= {})[track.target === 'leftEye' ? 'left' : 'right'] = { smile, openness: 1 - blink };
    } else {
      const target = track.target as { accessory: string };
      const sample = result.accessories[target.accessory] ??= {};
      if (track.channel === 'opacity') sample.opacity = value as number;
      else sample[track.channel as 'rotation' | 'position' | 'scale'] = value as Vec3;
    }
  }
  return result;
}
