import type { PartAnimationClip } from './part-animation.cjs';
export type PartAnimationPresetName = 'nod' | 'shake' | 'wiggle' | 'blink';
export interface PartAnimationPresetOptions {
    /** Duration in seconds, from 0.05 through 60. Defaults depend on the preset. */
    duration?: number;
    /** Motion amplitude or blink amount, from 0 (neutral) through 1 (full). Defaults to 1. */
    intensity?: number;
    /** Repeat through the ordinary part-animation player. Defaults to false. */
    loop?: boolean;
}
export declare const PART_ANIMATION_PRESET_LIMITS: Readonly<{
    minDuration: 0.05;
    maxDuration: 60;
    maxIntensity: 1;
}>;
/** Create an ordinary, validated clip with neutral endpoints. No rig or separate player is required. */
export declare function createPartAnimationPreset(name: PartAnimationPresetName, options?: PartAnimationPresetOptions): PartAnimationClip;
