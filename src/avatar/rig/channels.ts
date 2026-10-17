import type { Channels } from '../types.js';
import type { BotState, Mood } from '../../core/types.js';

/** Per-state driving parameters. Gains multiply the item's rig amplitudes. */
export interface Pose {
  targets: Partial<Channels>;
  breathGain: number;
  bobGain: number;
  swayGain: number;
  yawGain: number;
  swingGain: number;
  /** Amount of pseudo-random mouth flapping (speech). */
  chatter: number;
  /** Blink frequency multiplier. */
  blinkGain: number;
}

export const POSES: Record<BotState, Pose> = {
  idle: {
    targets: { smile: 0.35, brow: 0.05, lid: 0, mouthOpen: 0, glow: 0, tilt: 0 },
    breathGain: 1,
    bobGain: 1,
    swayGain: 1,
    yawGain: 0.7,
    swingGain: 0.5,
    chatter: 0,
    blinkGain: 1,
  },
  listening: {
    targets: { smile: 0.25, brow: 0.35, lid: 0, mouthOpen: 0, tilt: 0.1, pupilY: -0.15, glow: 0.15 },
    breathGain: 0.8,
    bobGain: 1.4,
    swayGain: 0.5,
    yawGain: 0.9,
    swingGain: 0.8,
    chatter: 0,
    blinkGain: 1.2,
  },
  thinking: {
    targets: {
      smile: 0.05,
      brow: 0.6,
      lid: 0.12,
      mouthOpen: 0,
      pupilX: -0.5,
      pupilY: -0.55,
      tilt: -0.06,
      glow: 0,
    },
    breathGain: 0.7,
    bobGain: 0.5,
    swayGain: 1.2,
    yawGain: 1.5,
    swingGain: 1.1,
    chatter: 0,
    blinkGain: 0.6,
  },
  speaking: {
    targets: { smile: 0.55, brow: 0.2, mouthOpen: 0.3, pupilY: 0, tilt: 0.04, glow: 0.1 },
    breathGain: 1.2,
    bobGain: 1.4,
    swayGain: 1.1,
    yawGain: 0.8,
    swingGain: 0.7,
    chatter: 1,
    blinkGain: 1.3,
  },
  success: {
    targets: { smile: 1, brow: 0.5, lid: 0, mouthOpen: 0.35, glow: 1, tilt: -0.05, pupilY: -0.1 },
    breathGain: 1.6,
    bobGain: 2.4,
    swayGain: 0.7,
    yawGain: 0.5,
    swingGain: 1.4,
    chatter: 0.2,
    blinkGain: 1.4,
  },
  error: {
    targets: { smile: -0.5, brow: 0.95, lid: 0.25, mouthOpen: 0.12, tilt: -0.16, glow: 0.35, pupilY: 0.15 },
    breathGain: 0.6,
    bobGain: 0.8,
    swayGain: 3.2,
    yawGain: 0.3,
    swingGain: 0.3,
    chatter: 0,
    blinkGain: 0.5,
  },
  sleeping: {
    targets: { smile: 0.12, brow: 0, lid: 1, mouthOpen: 0, pupilX: 0, pupilY: 0.2, tilt: 0.08, glow: 0 },
    breathGain: 0.55,
    bobGain: 0.25,
    swayGain: 0.3,
    yawGain: 0.2,
    swingGain: 0.15,
    chatter: 0,
    blinkGain: 0,
  },
};

const MOOD_ADJUST: Partial<Record<Mood, Partial<Channels>>> = {
  neutral: {},
  happy: { smile: 0.3, brow: 0.12 },
  alert: { brow: 0.45, smile: -0.15, tilt: -0.05 },
};

export function moodAdjust(mood: Mood): Partial<Channels> {
  return MOOD_ADJUST[mood] ?? {};
}

export function poseFor(state: BotState): Pose {
  return POSES[state] ?? POSES.idle;
}
