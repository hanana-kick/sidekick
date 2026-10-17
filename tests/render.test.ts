import { describe, expect, it } from 'vitest';
import {
  defineAccessory,
  defineBodyShape,
  defineEye,
  getAccessoryDef,
  getBodyShape,
  listAccessories,
  listBodyShapes,
} from '../src/avatar/catalog.js';
import { createAvatar, avatarFromHash } from '../src/avatar/generator.js';
import { buildParts } from '../src/avatar/render/webgl/parts.js';
import { Canvas2DRenderer } from '../src/avatar/render/canvas2d.js';
import { CHANNEL_NAMES, REST_CHANNELS } from '../src/avatar/types.js';

function makeCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  return canvas;
}

describe('catalog', () => {
  it('ships the documented built-ins', () => {
    expect(listBodyShapes().length).toBeGreaterThanOrEqual(6);
    expect(listAccessories().length).toBeGreaterThanOrEqual(10);
    expect(getBodyShape('blob')?.mesh3d).toBeDefined();
  });

  it('rejects unknown kinds', () => {
    expect(getBodyShape('nope' as never)).toBeUndefined();
    expect(getAccessoryDef('nope' as never)).toBeUndefined();
  });

  it('lets a consumer register a custom shape, eye and accessory', () => {
    defineBodyShape({ kind: 'custom-gem', weight: 1, mesh3d: 'box' }, () => {});
    defineEye({ kind: 'custom-star', weight: 1, count: 2, defaultSize: 0.16, blinkable: true }, () => {});
    defineAccessory(
      { kind: 'custom-antenna', slots: ['top'], weight: 1 },
      {
        build3d: () => [
          {
            kind: 'cylinder',
            position: [0, 1.2, 0],
            rotation: [0, 0, 0],
            scale: [0.05, 0.4, 0.05],
            color: [1, 0, 0],
          },
        ],
      },
    );

    expect(getBodyShape('custom-gem' as never)).toBeDefined();
    expect(listBodyShapes()).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'custom-gem' })]),
    );

    const item = createAvatar({
      seed: 'custom',
      shape: 'custom-gem' as never,
      eyes: 'custom-star' as never,
      accessories: ['custom-antenna' as never],
    });
    expect(item.body.shape).toBe('custom-gem');
    expect(item.eyes[0]!.kind).toBe('custom-star');

    const parts = buildParts(item, { ...REST_CHANNELS });
    expect(parts.some((p) => p.kind === 'cylinder')).toBe(true);
  });

  it('keeps custom registrations inside the generator pool', () => {
    defineBodyShape({ kind: 'custom-pool', weight: 100, mesh3d: 'sphere' });
    const items = Array.from({ length: 40 }, (_, i) => avatarFromHash(`pool-${i}`));
    expect(items.some((item) => item.body.shape === ('custom-pool' as never))).toBe(true);
  });
});

describe('Canvas2DRenderer', () => {
  it('draws every body shape without throwing', () => {
    const renderer = new Canvas2DRenderer(makeCanvas());
    for (const def of listBodyShapes()) {
      const item = createAvatar({ seed: `shape-${def.kind}`, shape: def.kind });
      expect(() => renderer.render(item, { ...REST_CHANNELS }, 0)).not.toThrow();
    }
    renderer.destroy();
  });

  it('draws every accessory and mouth', () => {
    const renderer = new Canvas2DRenderer(makeCanvas());
    for (const accessory of listAccessories()) {
      const item = createAvatar({ seed: `acc-${accessory.kind}`, accessories: [accessory.kind] });
      expect(() => renderer.render(item, { ...REST_CHANNELS }, 0)).not.toThrow();
    }
    renderer.destroy();
  });

  it('applies channels to the drawing pass', () => {
    const renderer = new Canvas2DRenderer(makeCanvas());
    const item = createAvatar({ seed: 'channels', accessories: ['cap'] });
    const animated = { ...REST_CHANNELS, lid: 1, mouthOpen: 0.8, smile: 1, glow: 1, bob: 0.2, roll: 0.1 };
    expect(() => renderer.render(item, animated, 1.5)).not.toThrow();
    renderer.destroy();
  });

  it('reports the size it was resized to', () => {
    const renderer = new Canvas2DRenderer(makeCanvas());
    renderer.resize(200, 120, 2);
    expect(renderer.width).toBe(200);
    expect(renderer.height).toBe(120);
    renderer.destroy();
  });
});

describe('buildParts', () => {
  it('produces finite transforms for every channel extreme', () => {
    const item = createAvatar({ seed: 'parts', accessories: ['cap', 'glasses'] });
    for (const name of CHANNEL_NAMES) {
      const channels = { ...REST_CHANNELS, [name]: 1 };
      const parts = buildParts(item, channels);
      expect(parts.length).toBeGreaterThan(0);
      for (const part of parts) {
        for (const tuple of [part.position, part.rotation, part.scale, part.color]) {
          for (const value of tuple) expect(Number.isFinite(value)).toBe(true);
        }
      }
    }
  });

  it('closes the eyes as the lid channel rises', () => {
    const item = createAvatar({ seed: 'lid-parts' });
    const open = buildParts(item, { ...REST_CHANNELS, lid: 0 });
    const shut = buildParts(item, { ...REST_CHANNELS, lid: 1 });
    const openScale = open.filter((p) => p.kind === 'sphere').map((p) => p.scale[1]);
    const shutScale = shut.filter((p) => p.kind === 'sphere').map((p) => p.scale[1]);
    expect(Math.min(...shutScale)).toBeLessThan(Math.min(...openScale));
  });
});
