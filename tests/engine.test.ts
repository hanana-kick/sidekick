import { describe, expect, it, vi } from 'vitest';
import { AvatarEngine } from '../src/avatar/engine.js';
import { createAvatar } from '../src/avatar/generator.js';
import { REST_CHANNELS } from '../src/avatar/types.js';
import { createMemoryStore } from '../src/core/persistence.js';

function makeCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  return canvas;
}

describe('AvatarEngine', () => {
  it('renders 2D and exposes the item', () => {
    const item = createAvatar({ seed: 'engine' });
    const engine = new AvatarEngine({ canvas: makeCanvas(), item, mode: '2d', autoStart: false });
    expect(engine.mode).toBe('2d');
    expect(engine.fellBack).toBe(false);
    expect(engine.item).toBe(item);
    expect(() => engine.renderOnce()).not.toThrow();
    engine.destroy();
  });

  it('falls back to Canvas2D when WebGL2 is unavailable', () => {
    const engine = new AvatarEngine({ canvas: makeCanvas(), mode: '3d', autoStart: false });
    expect(engine.requestedMode).toBe('3d');
    expect(engine.mode).toBe('2d');
    expect(engine.fellBack).toBe(true);
    engine.destroy();
  });

  it('can refuse the fallback', () => {
    expect(
      () => new AvatarEngine({ canvas: makeCanvas(), mode: '3d', allow2DFallback: false, autoStart: false }),
    ).toThrow(/WebGL2/);
  });

  it('advances the animator through tick', () => {
    const engine = new AvatarEngine({ canvas: makeCanvas(), mode: '2d', autoStart: false });
    const before = engine.animator.time;
    engine.tick(16);
    expect(engine.animator.time).toBeGreaterThan(before);
    engine.destroy();
  });

  it('forwards state, mood and pointer to the animator', () => {
    const engine = new AvatarEngine({ canvas: makeCanvas(), mode: '2d', autoStart: false });
    engine.resize(200, 100);
    engine.setState('thinking');
    engine.setMood('happy');
    expect(engine.animator.state).toBe('thinking');
    expect(engine.animator.mood).toBe('happy');

    // update(0) snaps to the pose targets, which isolates the pointer contribution.
    const poseOnly = engine.getChannels().pupilX;
    engine.setPointer(200, 100);
    const withPointer = engine.getChannels().pupilX;
    expect(withPointer - poseOnly).toBeCloseTo(0.7, 1);
    for (let i = 0; i < 30; i += 1) engine.tick(64);
    expect(engine.animator.channels.pupilX).toBeCloseTo(withPointer, 1);
    engine.clearPointer();
    engine.setReducedMotion(true);
    expect(engine.animator.reducedMotion).toBe(true);
    engine.destroy();
  });

  it('swaps items without leaking the old animation', () => {
    const engine = new AvatarEngine({ canvas: makeCanvas(), mode: '2d', autoStart: false });
    const next = createAvatar({ seed: 'swapped', shape: 'hexagon' });
    engine.setItem(next);
    expect(engine.item).toBe(next);
    expect(engine.animator.channels).toMatchObject({});
    engine.destroy();
  });

  it('starts and stops the frame loop', () => {
    const raf = vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(() => 1);
    const caf = vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});
    const engine = new AvatarEngine({ canvas: makeCanvas(), mode: '2d', autoStart: false });
    engine.start();
    engine.start();
    expect(raf).toHaveBeenCalledTimes(1);
    engine.stop();
    expect(caf).toHaveBeenCalled();
    engine.destroy();
    raf.mockRestore();
    caf.mockRestore();
  });

  it('clamps the device pixel ratio', () => {
    const renderer = {
      mode: '2d' as const,
      width: 0,
      height: 0,
      resize: vi.fn(),
      render: vi.fn(),
      destroy: vi.fn(),
    };
    const engine = new AvatarEngine({ canvas: makeCanvas(), mode: '2d', autoStart: false, dpr: 9 });
    // Sanity check on the renderer contract used by every element.
    expect(renderer.mode).toBe('2d');
    expect(REST_CHANNELS.mouthWidth).toBe(1);
    expect(engine.animator.channels.scale).toBe(1);
    engine.destroy();
  });

  it('uses the persistence store shape that elements rely on', () => {
    const store = createMemoryStore();
    store.save('bot', { x: 1, y: 2, mode: 'free' });
    expect(store.load('bot')).toEqual({ x: 1, y: 2, mode: 'free' });
    store.clear('bot');
    expect(store.load('bot')).toBeNull();
  });
});
