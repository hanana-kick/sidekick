import { describe, expect, it } from 'vitest';
import { AvatarAnimator } from '../src/avatar/rig/animator.js';
import { createAvatar } from '../src/avatar/generator.js';
import { REST_CHANNELS, CHANNEL_NAMES } from '../src/avatar/types.js';

const STEP = 16;

function run(
  animator: AvatarAnimator,
  seconds: number,
  onFrame?: (c: ReturnType<AvatarAnimator['update']>) => void,
) {
  const frames = Math.round((seconds * 1000) / STEP);
  let last = animator.channels;
  for (let i = 0; i < frames; i += 1) {
    last = animator.update(STEP);
    onFrame?.(last);
  }
  return last;
}

describe('AvatarAnimator', () => {
  it('breathes and bobs while idle', () => {
    const animator = new AvatarAnimator(createAvatar({ seed: 'breathe' }));
    let maxBreath = 0;
    let maxBob = 0;
    run(animator, 6, (c) => {
      maxBreath = Math.max(maxBreath, Math.abs(c.breath));
      maxBob = Math.max(maxBob, Math.abs(c.bob));
    });
    expect(maxBreath).toBeGreaterThan(0.005);
    expect(maxBob).toBeGreaterThan(0.01);
  });

  it('blinks periodically with a full close', () => {
    const animator = new AvatarAnimator(createAvatar({ seed: 'blinker' }));
    let maxLid = 0;
    run(animator, 12, (c) => {
      maxLid = Math.max(maxLid, c.lid);
    });
    expect(maxLid).toBeGreaterThan(0.85);
  });

  it('opens the mouth while speaking', () => {
    const animator = new AvatarAnimator(createAvatar({ seed: 'talker' }));
    animator.setState('speaking');
    let maxOpen = 0;
    run(animator, 3, (c) => {
      maxOpen = Math.max(maxOpen, c.mouthOpen);
    });
    expect(maxOpen).toBeGreaterThan(0.05);
  });

  it('keeps the eyes shut while sleeping', () => {
    const animator = new AvatarAnimator(createAvatar({ seed: 'sleeper' }));
    animator.setState('sleeping');
    const channels = run(animator, 4);
    expect(channels.lid).toBeGreaterThan(0.9);
  });

  it('follows the pointer with the pupils', () => {
    const animator = new AvatarAnimator(createAvatar({ seed: 'gaze' }));
    animator.setPointer(1, -1);
    const channels = run(animator, 2);
    expect(channels.pupilX).toBeGreaterThan(0.3);
    expect(channels.pupilY).toBeLessThan(-0.2);
  });

  it('springs converge instead of oscillating forever', () => {
    const animator = new AvatarAnimator(createAvatar({ seed: 'spring' }));
    animator.setState('thinking');
    run(animator, 8);
    const before = animator.channels;
    run(animator, 0.5);
    const after = animator.channels;
    // After settling, per-frame movement stays small.
    for (const name of CHANNEL_NAMES) {
      expect(Math.abs(after[name] - before[name])).toBeLessThan(0.2);
    }
  });

  it('is deterministic: same item, same clock, same channels', () => {
    const item = createAvatar({ seed: 'deterministic' });
    const a = run(new AvatarAnimator(item), 5);
    const b = run(new AvatarAnimator(item), 5);
    expect(a).toEqual(b);
  });

  it('freezes motion under reduced motion', () => {
    const animator = new AvatarAnimator(createAvatar({ seed: 'calm' }), { reducedMotion: true });
    const channels = run(animator, 6);
    for (const name of CHANNEL_NAMES) {
      expect(Math.abs(channels[name] - REST_CHANNELS[name])).toBeLessThan(0.35);
    }
    expect(channels.lid).toBe(0);
  });

  it('settle() snaps straight to the pose', () => {
    const animator = new AvatarAnimator(createAvatar({ seed: 'snap' }));
    animator.setState('success');
    animator.settle();
    const first = animator.channels;
    animator.settle();
    expect(animator.channels).toEqual(first);
  });

  it('never produces NaN for absurd timesteps', () => {
    const animator = new AvatarAnimator(createAvatar({ seed: 'robust' }));
    animator.update(Number.NaN);
    animator.update(-1000);
    animator.update(10_000);
    for (const name of CHANNEL_NAMES) {
      expect(Number.isFinite(animator.channels[name])).toBe(true);
    }
  });

  it('timeScale speeds the simulation up', () => {
    const item = createAvatar({ seed: 'fast' });
    const slow = new AvatarAnimator(item);
    const fast = new AvatarAnimator(item, { timeScale: 4 });
    run(slow, 2);
    run(fast, 2);
    expect(fast.time).toBeGreaterThan(slow.time * 3);
  });
});
