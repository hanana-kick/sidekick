import type { AvatarItem, ChannelName, Channels } from '../types.js';
import { REST_CHANNELS, CHANNEL_NAMES } from '../types.js';
import type { BotState, Mood } from '../../core/types.js';
import { moodAdjust, poseFor } from './channels.js';
import { createRandom, smoothNoise } from '../random.js';
import { clamp } from '../../core/geometry.js';

const TAU = Math.PI * 2;

/** Channels that must react faster than the body (eyes, mouth). */
const RESPONSIVENESS: Partial<Record<ChannelName, number>> = {
  mouthOpen: 2.6,
  lid: 3.2,
  pupilX: 1.7,
  pupilY: 1.7,
  brow: 1.9,
  glow: 1.1,
  sway: 1.3,
  smile: 1.2,
};

export interface AnimatorOptions {
  reducedMotion?: boolean;
  timeScale?: number;
}

/**
 * Turns `(item, state, mood, time)` into animation channels.
 *
 * Motion is a critically-damped spring chasing pose targets, layered with
 * low-frequency oscillators and deterministic noise, which is what keeps the
 * avatar feeling alive instead of looping on a fixed keyframe cycle.
 */
export class AvatarAnimator {
  #item: AvatarItem;
  #state: BotState = 'idle';
  #mood: Mood = 'neutral';
  #values: Channels = { ...REST_CHANNELS };
  #velocities: Partial<Record<ChannelName, number>> = {};
  #time = 0;
  #nextBlink: number;
  #blinkStart: number | null = null;
  #rng;
  #seed: number;
  #pointer = { x: 0, y: 0 };

  reducedMotion: boolean;
  timeScale: number;

  constructor(item: AvatarItem, options: AnimatorOptions = {}) {
    this.#item = item;
    this.#seed = parseInt(item.hash.slice(0, 6), 16) || 1;
    this.#rng = createRandom(`${item.hash}:blink`);
    this.reducedMotion = options.reducedMotion ?? false;
    this.timeScale = options.timeScale ?? 1;
    this.#nextBlink = this.#rng.range(0.6, item.rig.blinkInterval);
  }

  get state(): BotState {
    return this.#state;
  }

  get mood(): Mood {
    return this.#mood;
  }

  get time(): number {
    return this.#time;
  }

  get channels(): Channels {
    return { ...this.#values };
  }

  setItem(item: AvatarItem): void {
    this.#item = item;
    this.#seed = parseInt(item.hash.slice(0, 6), 16) || 1;
    this.#rng = createRandom(`${item.hash}:blink`);
    this.#nextBlink = this.#time + this.#rng.range(0.4, item.rig.blinkInterval);
  }

  setState(state: BotState): void {
    this.#state = state;
    if (state !== 'sleeping' && this.#values.lid > 0.9) this.#blinkStart = null;
  }

  setMood(mood: Mood): void {
    this.#mood = mood;
  }

  /** Normalised gaze target in [-1, 1]; usually driven by the pointer. */
  setPointer(x: number, y: number): void {
    this.#pointer.x = clamp(x, -1, 1);
    this.#pointer.y = clamp(y, -1, 1);
  }

  seek(time: number): void {
    this.#time = Math.max(0, time);
    this.#blinkStart = null;
  }

  /** Snaps every channel to the current pose (used for reduced motion / first paint). */
  settle(): void {
    const targets = this.#targets(0);
    for (const name of CHANNEL_NAMES) {
      this.#values[name] = targets[name] ?? REST_CHANNELS[name];
      this.#velocities[name] = 0;
    }
  }

  #targets(dt: number): Partial<Channels> {
    const pose = poseFor(this.#state);
    const base: Partial<Channels> = { ...REST_CHANNELS, ...pose.targets, ...moodAdjust(this.#mood) };
    if (this.reducedMotion || dt === 0) return this.#applyPointer(base);

    const rig = this.#item.rig;
    const t = this.#time;
    const seed = this.#seed;

    base.breath = Math.sin(TAU * rig.breathRate * t) * rig.breathDepth * pose.breathGain;
    base.bob =
      (Math.sin(TAU * rig.bobRate * t) * 0.72 + smoothNoise(t * 1.3, seed) * 0.28) *
      rig.bobDepth *
      pose.bobGain;
    base.sway =
      smoothNoise(t * 1.9, seed + 7) * rig.swayDepth * pose.swayGain +
      (this.#state === 'error' ? Math.sin(t * 34) * 0.055 : 0);
    base.yaw = Math.sin(TAU * 0.085 * t + seed * 0.001) * rig.yawDrift * pose.yawGain;
    base.swing = smoothNoise(t * 1.1, seed + 3) * 0.4 * pose.swingGain;
    base.roll = Math.sin(TAU * 0.11 * t + seed * 0.002) * rig.roll * pose.swayGain;

    const chatter = pose.chatter * Math.max(0, smoothNoise(t * 8.5, seed + 11));
    base.mouthOpen = (base.mouthOpen ?? 0) + chatter * 0.7;

    return this.#applyPointer(base);
  }

  /** Gaze follows the pointer; applied on every path, including reduced motion and static frames. */
  #applyPointer(base: Partial<Channels>): Partial<Channels> {
    if (this.#pointer.x === 0 && this.#pointer.y === 0) return base;
    base.pupilX = (base.pupilX ?? 0) + this.#pointer.x * 0.7;
    base.pupilY = (base.pupilY ?? 0) + this.#pointer.y * 0.6;
    base.yaw = (base.yaw ?? 0) + this.#pointer.x * 0.25;
    return base;
  }

  #stepBlink(): number {
    if (this.reducedMotion) return 0;
    const pose = poseFor(this.#state);
    if (pose.blinkGain <= 0) return 0;

    const duration = Math.max(0.05, this.#item.rig.blinkDuration);
    if (this.#blinkStart === null) {
      if (this.#time < this.#nextBlink) return 0;
      this.#blinkStart = this.#time;
      const interval = (this.#item.rig.blinkInterval / pose.blinkGain) * this.#rng.range(0.55, 1.6);
      // Quarter of blinks come in pairs, which reads much more natural.
      const double = this.#rng.chance(0.25);
      this.#nextBlink = this.#time + (double ? duration + 0.1 : interval);
    }

    const progress = (this.#time - this.#blinkStart) / duration;
    if (progress >= 1) {
      this.#blinkStart = null;
      return 0;
    }
    return Math.sin(Math.PI * progress);
  }

  /** Advances the simulation and returns the new channel values. */
  update(dtMs: number): Channels {
    const raw = Number.isFinite(dtMs) ? dtMs / 1000 : 0;
    const dt = clamp(raw * this.timeScale, 0, 0.05);
    this.#time += dt;

    const rig = this.#item.rig;
    const targets = this.#targets(dt);

    for (const name of CHANNEL_NAMES) {
      const target = targets[name] ?? REST_CHANNELS[name];
      if (dt === 0) {
        this.#values[name] = target;
        continue;
      }
      const speed = RESPONSIVENESS[name] ?? 1;
      const tension = this.reducedMotion ? rig.tension * 6 : rig.tension * speed;
      const damping = this.reducedMotion ? 2 * Math.sqrt(tension) : rig.damping * Math.sqrt(speed);
      let velocity = this.#velocities[name] ?? 0;
      const position = this.#values[name];
      velocity += ((target - position) * tension - velocity * damping) * dt;
      this.#values[name] = position + velocity * dt;
      this.#velocities[name] = velocity;
    }

    // Eyelids are driven by an explicit envelope on top of the pose target.
    const blink = this.#stepBlink();
    if (blink > this.#values.lid) {
      this.#values.lid = blink;
      this.#velocities.lid = 0;
    }

    return this.channels;
  }
}
