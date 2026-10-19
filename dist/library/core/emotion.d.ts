import type { Vec2 } from './design.js';
/** Explicit application-authored feelings; no inference about a human user's emotions. */
export declare const EMOTIONS: readonly ["neutral", "happy", "sad", "curious", "surprised", "concerned", "excited"];
export type Emotion = typeof EMOTIONS[number];
export interface EmotionValue {
    emotion: Emotion;
    intensity: number;
}
export interface EmotionOptions {
    intensity?: number;
}
export interface ReactionOptions extends EmotionOptions {
    duration?: number;
}
export interface EmotionState extends EmotionValue {
    baseline: EmotionValue;
    reacting: boolean;
}
export interface EmotionResult {
    finished: boolean;
    emotion: Emotion;
    reason: 'completed' | 'replaced' | 'cancelled' | 'disconnected';
}
export declare function parseEmotion(value: unknown): Emotion;
export declare function validateEmotionOptions(value?: unknown, reaction?: boolean): Required<ReactionOptions>;
/** Layer offsets. Body angles are radians; squash is a multiplier. */
export interface EmotionFrame {
    smile: number;
    blink: number;
    eyeWeight: number;
    bob: number;
    roll: number;
    pitch: number;
    gaze: Vec2;
    squash: number;
}
export declare function resolveEmotionFrame(value: EmotionValue, time?: number, reduced?: boolean): EmotionFrame;
export declare function emotionHasMotion(value: EmotionValue): boolean;
