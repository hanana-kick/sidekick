import { finite } from './design.js';
import type { Vec2 } from './design.js';

/** Explicit application-authored feelings; no inference about a human user's emotions. */
export const EMOTIONS = Object.freeze(['neutral', 'happy', 'sad', 'curious', 'surprised', 'concerned', 'excited'] as const);
export type Emotion = typeof EMOTIONS[number];
export interface EmotionValue { emotion: Emotion; intensity: number }
export interface EmotionOptions { intensity?: number }
export interface ReactionOptions extends EmotionOptions { /** Dwell in milliseconds, including the incoming blend. */ duration?: number }
export interface EmotionState extends EmotionValue { baseline: EmotionValue; reacting: boolean }
export interface EmotionResult { finished: boolean; emotion: Emotion; reason: 'completed' | 'replaced' | 'cancelled' | 'disconnected' }

export function parseEmotion(value: unknown): Emotion {
  if (typeof value !== 'string' || !(EMOTIONS as readonly string[]).includes(value)) throw new TypeError(`emotion must be one of ${EMOTIONS.join(', ')}`);
  return value as Emotion;
}
export function validateEmotionOptions(value: unknown = {}, reaction = false): Required<ReactionOptions> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new TypeError('emotion options must be a plain object');
  const allowed = reaction ? ['intensity', 'duration'] : ['intensity'];
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (typeof key !== 'string' || !allowed.includes(key) || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) throw new TypeError(`unsupported emotion option: ${String(key)}`);
  }
  const options = value as ReactionOptions;
  return { intensity: finite(options.intensity === undefined ? 1 : options.intensity, 0, 1, 'emotion intensity'), duration: finite(options.duration === undefined ? 1200 : options.duration, 0, 60000, 'reaction duration') };
}

/** Layer offsets. Body angles are radians; squash is a multiplier. */
export interface EmotionFrame { smile: number; blink: number; eyeWeight: number; bob: number; roll: number; pitch: number; gaze: Vec2; squash: number }
export function resolveEmotionFrame(value: EmotionValue, time = 0, reduced = false): EmotionFrame {
  const intensity = finite(value.intensity, 0, 1, 'emotion intensity');
  const emotion = parseEmotion(value.emotion);
  const wave = reduced ? 0 : Math.sin(time * (emotion === 'excited' ? 9 : 3));
  let smile = 0, blink = 0, bob = 0, roll = 0, pitch = 0, squash = 0;
  let gaze: Vec2 = [0, 0];
  switch (emotion) {
    case 'happy': smile = .85; bob = .018 * wave; roll = .035; break;
    case 'sad': blink = .38; pitch = .10; roll = -.055; gaze = [0, -.28]; squash = -.025; break;
    case 'curious': blink = .06; roll = -.16; pitch = -.035; gaze = [.16, .10]; break;
    case 'surprised': pitch = -.11; bob = .025; squash = .045; gaze = [0, .20]; break;
    case 'concerned': blink = .22; roll = .10; pitch = .045; gaze = [-.12, -.08]; break;
    case 'excited': smile = 1; bob = .035 * wave; roll = .065 * wave; squash = .018 * wave; break;
  }
  return { smile, blink, eyeWeight: emotion === 'neutral' ? 0 : intensity, bob: bob * intensity, roll: roll * intensity, pitch: pitch * intensity, gaze: [gaze[0] * intensity, gaze[1] * intensity], squash: 1 + squash * intensity };
}
export function emotionHasMotion(value: EmotionValue): boolean { return value.intensity > 0 && (value.emotion === 'happy' || value.emotion === 'excited'); }
