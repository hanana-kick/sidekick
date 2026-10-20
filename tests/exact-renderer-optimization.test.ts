import test from 'node:test';
import assert from 'node:assert/strict';
import { shapeContour, contourDistanceOutline, contourSignedDistance, contourSignedDistanceExact } from '../src/core/contours.js';
import { createDesign, createAccessory, MATERIAL_SHAPE_NAMES } from '../src/core/design.js';
import { resolveDesign } from '../src/core/resolved-design.js';
import { beretGeometry } from '../src/renderer/beret-geometry.js';
import { AvatarRenderer } from '../src/renderer/webgl.js';
import { initialPose } from '../src/core/motion.js';
// @ts-expect-error Existing JavaScript fixture intentionally supplies a mock GL.
import { countingCanvas } from './performance-fixture.mjs';

function referenceDistance(points: readonly (readonly [number, number])[], x: number, y: number): number {
  let squared = Infinity, inside = false;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!, b = points[(i + 1) % points.length]!;
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) * (1 / (dx * dx + dy * dy))));
    const ex = x - a[0] - t * dx, ey = y - a[1] - t * dy;
    squared = Math.min(squared, ex * ex + ey * ey);
    if ((a[1] > y) !== (b[1] > y) && x < dx * (y - a[1]) / dy + a[0]) inside = !inside;
  }
  return Math.sqrt(squared) * (inside ? 1 : -1);
}
test('nearest-edge hint preserves exact exhaustive distances across all shapes and unrelated query order', () => {
  let seed = 314159;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  for (const shape of MATERIAL_SHAPE_NAMES) {
    const contour = shapeContour({ kind: 'material', name: shape });
    for (const exact of [false, true]) {
      const points = exact ? contour.points : contourDistanceOutline(contour);
      const distance = exact ? contourSignedDistanceExact : contourSignedDistance;
      for (let i = 0; i < 120; i++) {
        const x = random() * 4 - 2, y = random() * 4 - 2;
        assert.equal(distance(contour, x, y), referenceDistance(points, x, y), `${shape}/${exact}/${i}`);
        // Revisiting after a far-away query must not make the cache approximate.
        distance(contour, -x * 100, y * 100);
        assert.equal(distance(contour, x, y), referenceDistance(points, x, y));
      }
    }
  }
});

test('neutral beret plus diagonal squash preserves all35 shaped fitted vertices', () => {
  for (const shape of MATERIAL_SHAPE_NAMES) {
    const design = resolveDesign(createDesign({ body: { shape }, accessories: [createAccessory('beret')] }));
    const neutral = beretGeometry(design.body, design.accessories[0]!, 1);
    for (const squash of [.88, .96, 1.08]) {
      const animated = beretGeometry(design.body, design.accessories[0]!, squash), scale = [1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash)];
      assert.deepEqual(animated.indices, neutral.indices);
      for (let i = 0; i < neutral.vertices.length; i += 6) for (let k = 0; k < 3; k++) {
        assert.ok(Math.abs(animated.vertices[i + k]! - neutral.vertices[i + k]! * scale[k]!) < 1e-7, `${shape}/${squash}/${i + k}`);
      }
    }
  }
});

test('animated beret keeps its fitted mesh without uploads; authored rotation still invalidates it', () => {
  const fixture = countingCanvas(), renderer = new AvatarRenderer(fixture.canvas);
  const design = createDesign({ body: { shape: 'puffy' }, accessories: [createAccessory('beret')] });
  const frame = { pose: initialPose(), activity: 'speaking' as const, time: 0, delta: 1 / 60, reduced: false, style: 'flat' as const };
  renderer.render(design, frame); const before = fixture.snapshot();
  for (let i = 1; i <= 120; i++) { frame.time = i / 60; renderer.render(design, frame); }
  assert.equal(fixture.snapshot().uploadedBytes, before.uploadedBytes);
  frame.pose.accessories[design.accessories[0]!.id] = [.1, .2, .3]; renderer.render(design, frame);
  assert.ok(fixture.snapshot().uploadedBytes > before.uploadedBytes);
  renderer.dispose();
});
