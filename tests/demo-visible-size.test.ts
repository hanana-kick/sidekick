import test from 'node:test';
import assert from 'node:assert/strict';
import { AvatarRenderer } from '../src/renderer/webgl.js';
import { createDesign, createAccessory } from '../src/core/design.js';
import { initialPose } from '../src/core/motion.js';
import { alphaBounds } from '../src/core/pixels.js';

// Production geometry/projection, with a CPU presentation surface. Never infer
// visible dimensions from host size; include all nonzero-alpha accessory pixels.
function fixture(size: number, dpr: number) {
  let pixels: Uint8ClampedArray;
  const canvas = { width: size, height: size,
    getContext() { return { createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }), putImageData(image: { data: Uint8ClampedArray }) { pixels = image.data; } }; },
    addEventListener() {}, removeEventListener() {},
  } as unknown as HTMLCanvasElement;
  const renderer = new AvatarRenderer(canvas, { renderer: 'canvas2d' }); renderer.resize(size, size, dpr);
  return { renderer, measure(shape: 'square' | 'heart', time = 0, idle = false) {
    renderer.render(createDesign({ body: { shape }, accessories: [createAccessory('beret', 'hat')] }), {
      pose: initialPose(), time, delta: 0, activity: idle ? 'idle' : 'still', reduced: !idle, style: 'flat', instant: true, zoom: 1,
    });
    const bounds = alphaBounds({ width: canvas.width, height: canvas.height, pixels: pixels! }); assert.ok(bounds);
    assert.ok(bounds.x > 0 && bounds.y > 0 && bounds.x + bounds.width < canvas.width && bounds.y + bounds.height < canvas.height, 'no cropped ink');
    return { width: bounds.width * size / canvas.width, height: bounds.height * size / canvas.height };
  }};
}
for (const dpr of [1, 2]) {
  test(`115px demo footprint fits default beret design into a visible64px box at DPR${dpr}`, t => {
    const f = fixture(115, dpr);
    try {
      const original = f.measure('square'), heart = f.measure('heart');
      assert.ok(original.width >= 55 && original.width <= 57); assert.equal(original.height, 64);
      assert.ok(heart.width >= 55 && heart.width <= 57 && heart.height >= 54 && heart.height <= 56, 'heart retains its own proportions and shared scale');
      const idleEdges: number[] = [];
      for (const shape of ['square', 'heart'] as const) for (let time = 0; time <= 8; time += .5) {
        const moving = f.measure(shape, time, true);
        idleEdges.push(Math.max(moving.width, moving.height));
        assert.ok(Math.max(moving.width, moving.height) <= 68, `${shape} idle t=${time}: ${JSON.stringify(moving)}`);
      }
      t.diagnostic(JSON.stringify({ dpr, original, heart, idleEdge: { min: Math.min(...idleEdges), max: Math.max(...idleEdges) } }));
    } finally { f.renderer.dispose(); }
  });
}
