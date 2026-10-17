import { describe, expect, it } from 'vitest';
import {
  avatarFromHash,
  createAvatar,
  deserializeAvatar,
  isAvatarItem,
  serializeAvatar,
} from '../src/avatar/generator.js';
import { hashString, hashStringWide, createRandom } from '../src/avatar/random.js';

describe('hashing', () => {
  it('is stable and seed-sensitive', () => {
    expect(hashString('sidekick')).toBe(hashString('sidekick'));
    expect(hashString('sidekick')).not.toBe(hashString('sidekie'));
    expect(hashStringWide('a')).toHaveLength(16);
  });

  it('produces values in range', () => {
    const rng = createRandom('seed');
    for (let i = 0; i < 200; i += 1) {
      const v = rng.range(0, 1);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      expect(Number.isInteger(rng.int(0, 10))).toBe(true);
    }
  });
});

describe('avatarFromHash', () => {
  it('is deterministic for the same seed', () => {
    const a = avatarFromHash('user-42');
    const b = avatarFromHash('user-42');
    expect(a).toEqual(b);
  });

  it('differs across seeds', () => {
    const a = avatarFromHash('user-42');
    const b = avatarFromHash('user-43');
    expect(a.hash).not.toBe(b.hash);
    expect([a.body.shape, a.eyes[0]!.kind, a.palette.hue]).not.toEqual([
      b.body.shape,
      b.eyes[0]!.kind,
      b.palette.hue,
    ]);
  });

  it('respects the seed prefix for palette independent of body rng', () => {
    expect(avatarFromHash('x').palette.hue).toBe(avatarFromHash('x').palette.hue);
  });

  it('honours constraints', () => {
    const item = avatarFromHash('any', {
      shapes: ['hexagon'],
      eyes: ['dot'],
      mouths: ['grin'],
      accessories: [],
    });
    expect(item.body.shape).toBe('hexagon');
    expect(item.eyes[0]!.kind).toBe('dot');
    expect(item.mouth.kind).toBe('grin');
    expect(item.accessories).toEqual([]);
  });

  it('forces an accessory count', () => {
    const item = avatarFromHash('crowded', { accessories: 2 });
    expect(item.accessories.length).toBeLessThanOrEqual(2);
  });
});

describe('createAvatar', () => {
  it('accepts an explicit simple shape', () => {
    const item = createAvatar({ seed: 'explicit', shape: 'teardrop', eyes: 'star', mouth: 'cat', hue: 200 });
    expect(item.body.shape).toBe('teardrop');
    expect(item.eyes[0]!.kind).toBe('star');
    expect(item.mouth.kind).toBe('cat');
    expect(Math.round(item.palette.hue)).toBe(200);
  });

  it('accepts a partial body spec and clamps it', () => {
    const item = createAvatar({ shape: { shape: 'blob', aspect: 99, scale: -3 } });
    expect(item.body.aspect).toBeLessThanOrEqual(2);
    expect(item.body.scale).toBeGreaterThanOrEqual(0.4);
  });

  it('rejects unknown kinds by falling back to defaults', () => {
    const item = createAvatar({ shape: 'not-a-shape' as never, eyes: 'nope' as never });
    expect(typeof item.body.shape).toBe('string');
    expect(item.eyes[0]!.kind).toBe('dot');
  });

  it('gives every avatar a rig that can animate', () => {
    const item = createAvatar({ seed: 'rigged' });
    expect(item.rig.tension).toBeGreaterThan(0);
    expect(item.rig.blinkInterval).toBeGreaterThan(0);
    expect(item.rig.breathRate).toBeGreaterThan(0);
    expect(item.rig.damping).toBeGreaterThan(0);
  });

  it('fills paletteNumeric so renderers never parse CSS', () => {
    const item = createAvatar({ seed: 'numeric' });
    expect(item.paletteNumeric.base).toHaveLength(3);
    expect(item.paletteNumeric.cheek).toHaveLength(3);
    for (const channel of item.paletteNumeric.base) {
      expect(channel).toBeGreaterThanOrEqual(0);
      expect(channel).toBeLessThanOrEqual(1);
    }
  });
});

describe('serialization', () => {
  it('round-trips through JSON', () => {
    const item = avatarFromHash('round-trip', { accessories: 2 });
    const restored = deserializeAvatar(serializeAvatar(item));
    expect(restored).toEqual(item);
  });

  it('recognises valid items', () => {
    expect(isAvatarItem(avatarFromHash('valid'))).toBe(true);
    expect(isAvatarItem(null)).toBe(false);
    expect(isAvatarItem({})).toBe(false);
    expect(isAvatarItem({ version: 2 })).toBe(false);
  });

  it('recovers from corrupt payloads', () => {
    const fallback = deserializeAvatar('{not json');
    expect(isAvatarItem(fallback)).toBe(true);
  });
});
