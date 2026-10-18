import test from 'node:test';
import assert from 'node:assert/strict';
import { BodyTriangleBVH } from '../dist/src/renderer/cloth-clearance.js';
import { intersections, triangles } from './helpers/geometry/intersections.mjs';

const near = (a, b, tolerance = 1e-9) => assert.ok(Math.abs(a - b) <= tolerance, `${a} differs from ${b}`);
const plane = () => new BodyTriangleBVH([[-4, -4, 0], [4, -4, 0], [0, 4, 0]], [0, 1, 2]);
const translate = (points, direction, distance) => points.map(p => p.map((v, k) => v + direction[k] * distance));
const packed = (points, stride = 3) => new Float64Array(points.flatMap(p => stride === 6 ? [...p, 0, 0, 1] : p));
const mesh = points => ({ vertices: packed(points, 6), indices: new Uint16Array([0, 1, 2]) });

test('analytic normal translation returns physical distance and includes the maximum endpoint', () => {
  const cloth = [[-.2, -.2, 2], [.2, -.2, 2], [0, .2, 2]], body = plane();
  near(body.firstMeshHit(cloth, [0, 1, 2], [0, 0, -3], 3, { epsilon: 0 }), 2);
  near(body.firstMeshHit(cloth, [0, 1, 2], [0, 0, -1], 2, { epsilon: 0 }), 2);
  assert.equal(body.firstMeshHit(cloth, [0, 1, 2], [0, 0, -1], 1.999, { epsilon: 0 }), undefined);
  assert.equal(body.firstMeshHit(cloth, [0, 1, 2], [0, 0, 1], 5, { epsilon: 0 }), undefined);
  near(body.firstMeshHit(cloth, [0, 1, 2], [0, 0, -1], 3, { epsilon: .001 }), 1.999);
});

test('continuous face contact is found even when endpoints and all garment vertex paths are clear', () => {
  const body = new BodyTriangleBVH([[-.1, -.1, 0], [.1, -.1, 0], [0, .1, 0]], [0, 1, 2]);
  const cloth = [[-3, -2, 1], [3, -2, 1], [0, 4, 1]], end = translate(cloth, [0, 0, -1], 2);
  assert.equal(body.intersectsMesh(cloth, [0, 1, 2]), false);
  assert.equal(body.intersectsMesh(end, [0, 1, 2]), false);
  for (let i = 0; i < 3; i++) assert.equal(body.firstHit(cloth[i], end[i]), undefined);
  near(body.firstMeshHit(cloth, [0, 1, 2], [0, 0, -1], 2, { epsilon: 0 }), 1);
});

test('aperture occupancy alone does not collide with the surrounding garment surface', () => {
  const body = new BodyTriangleBVH([[-.2, -.2, 0], [.2, -.2, 0], [0, .2, 0]], [0, 1, 2]);
  const outer = [[-2, -2, 1], [2, -2, 1], [2, 2, 1], [-2, 2, 1]];
  const inner = [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]], points = [...outer, ...inner], indices = [];
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; indices.push(i, j, i + 4, j, j + 4, i + 4); }
  assert.equal(body.firstMeshHit(points, indices, [0, 0, -1], 2, { epsilon: 0 }), undefined);
  near(body.firstMeshHit(points, [...indices, 4, 5, 6, 4, 6, 7], [0, 0, -1], 2, { epsilon: 0 }), 1);
});

test('coplanar sliding, grazing contact, and separated parallel motion are handled', () => {
  const body = new BodyTriangleBVH([[0, 0, 0], [1, 0, 0], [0, 1, 0]], [0, 1, 2]);
  near(body.firstMeshHit([[-2, 0, 0], [-1, 0, 0], [-2, 1, 0]], [0, 1, 2], [1, 0, 0], 4, { epsilon: 0 }), 1);
  near(body.firstMeshHit([[-2, 1, 0], [-1, 1, 0], [-2, 2, 0]], [0, 1, 2], [1, 0, 0], 4, { epsilon: 0 }), 1);
  assert.equal(body.firstMeshHit([[-2, 0, .01], [-1, 0, .01], [-2, 1, .01]], [0, 1, 2], [1, 0, 0], 4, { epsilon: 0 }), undefined);
});

test('initial contacts, zero direction, zero distance, and invalid inputs are explicit', () => {
  const body = plane(), touch = [[-.1, -.1, 0], [.1, -.1, 0], [0, .1, 0]], clear = translate(touch, [0, 0, 1], 1);
  assert.equal(body.firstMeshHit(touch, [0, 1, 2], [0, 0, 1], 2), 0);
  assert.equal(body.firstMeshHit(touch, [0, 1, 2], [0, 0, 0], 2), 0);
  assert.equal(body.firstMeshHit(clear, [0, 1, 2], [0, 0, 0], 2), undefined);
  assert.equal(body.firstMeshHit(touch, [0, 1, 2], [0, 0, -1], 0), 0);
  assert.equal(body.firstMeshHit(clear, [0, 1, 2], [0, 0, -1], 0), undefined);
  assert.throws(() => body.firstMeshHit(clear, [0, 1, 2], [NaN, 0, 0], 1), RangeError);
  assert.throws(() => body.firstMeshHit(clear, [0, 1, 2], [0, 0, -1], -1), RangeError);
  assert.throws(() => body.firstMeshHit(clear, [0, 1, 3], [0, 0, -1], 2), RangeError);
});

test('thin faces, six-stride input, and earliest among multiple body surfaces are retained', () => {
  const body = new BodyTriangleBVH([[0, 0, 0], [1, 0, 0], [0, 1e-9, 0]], [0, 1, 2]);
  const cloth = [[.2, 2e-10, 1], [.3, 2e-10, 1], [.2, 4e-10, 1]];
  for (const stride of [3, 6]) near(body.firstMeshHit(packed(cloth, stride), new Uint16Array([0, 1, 2]), [0, 0, -1], 2, { stride, epsilon: 0 }), 1);
  const points = [], indices = [];
  for (let z = -10; z <= 10; z++) { const n = points.length; points.push([-2, -2, z], [2, -2, z], [0, 2, z]); indices.push(n, n + 1, n + 2); }
  const layered = new BodyTriangleBVH(points, indices);
  near(layered.firstMeshHit([[-.1, -.1, 12], [.1, -.1, 12], [0, .1, 12]], [0, 1, 2], [0, 0, -1], 24, { epsilon: 0 }), 2);
});

test('wearing-frame and world-frame sweeps agree when direction is transformed with the meshes', () => {
  const fixed = [[-4, -4, 0], [4, -4, 0], [0, 4, 0]], moving = [[-.2, -.2, 2], [.2, -.2, 2], [0, .2, 2]];
  const angle = .71, co = Math.cos(angle), si = Math.sin(angle);
  const rotate = ([x, y, z]) => [co * x - si * z, y, si * x + co * z];
  const origin = [7.1, -3.2, .4], world = p => rotate(p).map((v, k) => v + origin[k]);
  const local = new BodyTriangleBVH(fixed, [0, 1, 2]), transformed = new BodyTriangleBVH(fixed.map(world), [0, 1, 2]);
  const localHit = local.firstMeshHit(moving, [0, 1, 2], [0, 0, -1], 3);
  const worldHit = transformed.firstMeshHit(moving.map(world), [0, 1, 2], rotate([0, 0, -1]), 3);
  near(worldHit, localHit, 1e-9);
  // A diagonal direction also reports physical travel, not its Z component.
  near(local.firstMeshHit(moving, [0, 1, 2], [1, 0, -1], 4, { epsilon: 0 }), 2 * Math.SQRT2);
});

test('earliest contact is minimized over every moving triangle without changing inputs', () => {
  const body = plane(), points = [[-.2, -.2, 3], [.2, -.2, 3], [0, .2, 3], [-.2, -.2, 1], [.2, -.2, 1], [0, .2, 1]];
  const saved = structuredClone(points);
  near(body.firstMeshHit(points, [0, 1, 2, 3, 4, 5], [0, 0, -1], 4, { epsilon: 0 }), 1);
  assert.deepEqual(points, saved);
});

test('continuous predictions agree with densely sampled independent triangle intersections', () => {
  let detected = 0;
  const steps = 600, maximum = 5, step = maximum / steps;
  for (let sample = 0; sample < 36; sample++) {
    const fixed = Array.from({ length: 3 }, (_, i) => [Math.sin(sample * 1.83 + i * 1.64), Math.cos(sample * 2.14 + i * .95), sample % 6 ? Math.sin(sample * .59 + i * 2.33) : 0]);
    const moving = Array.from({ length: 3 }, (_, i) => [2.5 + Math.sin(sample * 2.49 + i * 1.17), Math.cos(sample * 1.15 + i * 1.85), sample % 6 ? Math.cos(sample * .71 + i * 1.43) : 0]);
    const body = new BodyTriangleBVH(fixed, [0, 1, 2]), hit = body.firstMeshHit(moving, [0, 1, 2], [-1, 0, 0], maximum, { epsilon: 0 });
    const fixedTriangles = triangles(mesh(fixed));
    let first;
    for (let i = 0; i <= steps; i++) {
      const distance = i * step;
      if (intersections(triangles(mesh(translate(moving, [-1, 0, 0], distance))), fixedTriangles).count) { first = distance; break; }
    }
    if (first !== undefined) {
      detected++;
      assert.notEqual(hit, undefined, `missed sweep ${sample}`);
      assert.ok(hit <= first + 1e-8 && hit >= first - step - 1e-7, `sweep ${sample}: ${hit} vs dense ${first}`);
    } else if (hit !== undefined) {
      // Dense samples can miss a very brief contact; verify the predicted onset
      // directly with the independent segment/coplanar clipping implementation.
      assert.ok(intersections(triangles(mesh(translate(moving, [-1, 0, 0], hit + 1e-5))), fixedTriangles).count > 0, `unverified contact ${sample}: ${hit}`);
    }
  }
  assert.ok(detected > 10, 'comparison includes enough actual sweeps');
});
