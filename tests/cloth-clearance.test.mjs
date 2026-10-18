import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { BodyTriangleBVH, clothDisplacementFactor } from '../dist/src/renderer/cloth-clearance.js';
import { intersections, triangles } from './helpers/geometry/intersections.mjs';

const near = (actual, expected, tolerance = 1e-10) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);
const nearPoint = (actual, expected) => expected.forEach((value, axis) => near(actual[axis], value));
const plane = (z = 0) => new BodyTriangleBVH([[-4, -4, z], [4, -4, z], [0, 4, z]], [0, 1, 2]);
const cubePoints = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]];
// Outward winding, including the back and all side faces.
const cubeIndices = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7];
const cube = () => new BodyTriangleBVH(cubePoints, new Uint16Array(cubeIndices));
const packed = (points, stride = 3) => new Float32Array(points.flatMap(point => stride === 3 ? point : [...point, 0, 0, 1]));

test('cloth displacement returns exactly one for no hit, zero motion, and an empty body', () => {
  const body = cube(), start = [[0, 0, 2], [3, 0, 0]], end = [[0, 0, 3], [4, 0, 0]];
  assert.equal(clothDisplacementFactor(body, start, end, []), 1);
  assert.equal(clothDisplacementFactor(body, start, start, []), 1);
  assert.equal(clothDisplacementFactor(new BodyTriangleBVH([], []), start, end, []), 1);
  assert.equal(new BodyTriangleBVH([], []).closestPoint([0, 0, 0]), undefined);
});

test('swept vertex detects entering and leaving a cube even when both endpoints are outside', () => {
  const body = cube(), start = [[0.1, 0.2, 2]], end = [[0.1, 0.2, -2]];
  near(body.firstHit(start[0], end[0]).fraction, .25);
  near(clothDisplacementFactor(body, start, end, [], { clearance: .02 }), .245);
  const factor = clothDisplacementFactor(body, start, end, [], { clearance: .02 });
  near(start[0][2] + factor * (end[0][2] - start[0][2]), 1.02);
  near(body.firstHit(end[0], start[0]).fraction, .25, 1e-9);
});

test('all garment trajectories receive the same earliest factor without modifying inputs', () => {
  const body = plane(), start = [[0, 0, 1], [.5, 0, 2], [0, .5, 3]], end = start.map(([x, y, z]) => [x, y, z - 4]);
  const copyStart = structuredClone(start), copyEnd = structuredClone(end);
  near(clothDisplacementFactor(body, start, end, [0, 1, 2], { clearance: 0 }), .25);
  assert.deepEqual(start, copyStart); assert.deepEqual(end, copyEnd);
  const limited = start.map((p, i) => p.map((v, axis) => v + .25 * (end[i][axis] - v)));
  near(limited[1][2] - limited[0][2], start[1][2] - start[0][2]);
});

test('edge midpoint sweep detects a crossing missed by every garment vertex and centroid', () => {
  const body = new BodyTriangleBVH([[-.1, -.1, 0], [.1, -.1, 0], [0, .1, 0]], [0, 1, 2]);
  const start = [[-1, 0, 1], [1, 0, 1], [0, 3, 1]], end = start.map(([x, y]) => [x, y, -1]);
  assert.equal(clothDisplacementFactor(body, start, end, [], { clearance: 0 }), 1);
  assert.equal(body.firstHit([0, 1, 1], [0, 1, -1]), undefined);
  near(clothDisplacementFactor(body, start, end, [0, 1, 2], { clearance: 0 }), .5);
});

test('centroid sweep detects a crossing missed by every vertex and edge midpoint', () => {
  const body = new BodyTriangleBVH([[-.1, -.1, 0], [.1, -.1, 0], [0, .1, 0]], [0, 1, 2]);
  const start = [[-3, -2, 1], [3, -2, 1], [0, 4, 1]], end = start.map(([x, y]) => [x, y, -1]);
  assert.equal(clothDisplacementFactor(body, start, end, [], { clearance: 0 }), 1);
  for (let i = 0; i < 3; i++) {
    const a = start[i], b = start[(i + 1) % 3], mid = a.map((v, k) => (v + b[k]) / 2);
    assert.equal(body.firstHit(mid, [mid[0], mid[1], -1]), undefined);
  }
  near(clothDisplacementFactor(body, start, end, [0, 1, 2], { clearance: .02 }), .49);
});

test('initial contact permits tangent and outward motion but stops inward motion', () => {
  const body = plane(), start = [[0, 0, 0]];
  assert.equal(clothDisplacementFactor(body, start, [[.1, .1, 0]], []), 1);
  assert.equal(clothDisplacementFactor(body, start, [[.1, .1, 1]], []), 1);
  assert.equal(clothDisplacementFactor(body, start, [[.1, .1, -1]], []), 0);
  assert.equal(clothDisplacementFactor(body, [[0, 0, -5e-8]], [[.1, .1, 1]], []), 1);
  assert.equal(clothDisplacementFactor(body, [[0, 0, 5e-8]], [[.1, .1, -1]], []), 0);
  assert.equal(clothDisplacementFactor(body, [[0, 0, 5e-8]], [[.1, .1, -5e-8]], []), 1);
});

test('clearance uses trajectory distance with a bounded fractional backoff', () => {
  const body = plane();
  near(clothDisplacementFactor(body, [[-2, 0, .1]], [[2, 0, -.1]], [], { clearance: .01 }), .5 - .01 / Math.hypot(4, .2));
  // Even a larger requested gap cannot remove more than 2% beyond the hit.
  near(clothDisplacementFactor(body, [[0, 0, .001]], [[0, 0, -.001]], [], { clearance: .01 }), .48);
});

test('successive near-grazing edge hits do not amplify a late contact into a large global snap', () => {
  const body = new BodyTriangleBVH([[.9, -.1, 0], [1.1, -.1, 0], [1, .1, 0]], [0, 1, 2]);
  for (const [fraction, normalSpeed] of [[.9817402, .00335435], [.989688, .00146656]]) {
    const edgeY = .1 - 2 * (1 - fraction);
    const factors = [edgeY + 1e-5, edgeY - 1e-5, edgeY + 1e-5].map(y => {
      const start = [[0, y, fraction * normalSpeed]], end = [[1, y, (fraction - 1) * normalSpeed]];
      return clothDisplacementFactor(body, start, end, [], { clearance: .001 });
    });
    assert.equal(factors[0], 1); assert.equal(factors[2], 1);
    near(factors[1], fraction - .001 / Math.hypot(1, normalSpeed));
    assert.ok(Math.abs(factors[1] - factors[0]) < .025, `late grazing contact caused excessive attenuation: ${factors}`);
  }
});

test('flat XYZ and six-stride mesh buffers match Vec3 array queries', () => {
  const start = [[0, 0, 2], [.1, 0, 2], [0, .1, 2]], end = start.map(([x, y]) => [x, y, -2]);
  for (const stride of [3, 6]) {
    const body = new BodyTriangleBVH(packed(cubePoints, stride), new Uint16Array(cubeIndices), { stride });
    near(clothDisplacementFactor(body, packed(start, stride), packed(end, stride), new Uint16Array([0, 1, 2]), { stride, clearance: .02 }), .245);
    nearPoint(body.closestPoint([.1, .2, 2]), [.1, .2, 1]);
  }
});

test('BVH closest point handles face, edge, corner, optional height filter, and snapshot reuse', () => {
  const points = structuredClone(cubePoints), body = new BodyTriangleBVH(points, cubeIndices);
  nearPoint(body.closestPoint([.2, .3, 4]), [.2, .3, 1]);
  nearPoint(body.closestPoint([3, .2, 2]), [1, .2, 1]);
  nearPoint(body.closestPoint([3, 4, 5]), [1, 1, 1]);
  assert.equal(body.closestPoint([0, 0, 0], { minZ: 2 }), undefined);
  const levels = new BodyTriangleBVH([[-4, -4, 0], [4, -4, 0], [0, 4, 0], [-4, -4, 3], [4, -4, 3], [0, 4, 3]], [0, 1, 2, 3, 4, 5]);
  nearPoint(levels.closestPoint([0, 0, .1], { minZ: 1 }), [0, 0, 3]);
  points[4][2] = 900;
  nearPoint(body.closestPoint([.2, .3, 4]), [.2, .3, 1]);
});

test('nearest segment hit remains deterministic through the BVH and includes triangle seams', () => {
  const points = [], indices = [];
  for (let z = -40; z <= 40; z++) {
    const base = points.length;
    points.push([-2, -2, z], [2, -2, z], [0, 2, z]); indices.push(base, base + 1, base + 2);
  }
  const body = new BodyTriangleBVH(points, indices);
  for (let i = 0; i < 4; i++) {
    const hit = body.firstHit([0, 0, 50], [0, 0, -50]);
    near(hit.fraction, .1); assert.equal(hit.triangleIndex, 80);
    nearPoint(body.closestPoint([0, 0, 39.8]), [0, 0, 40]);
  }
  near(cube().firstHit([0, 0, 2], [0, 0, -2]).fraction, .25);
});

test('BVH partition terminates for coincident decimal centers with exact self-comparison', () => {
  // A reassociated comparator such as min + max - min - max can be nonzero
  // even against itself. Isolate this regression so a broken partition fails
  // with a bounded timeout rather than hanging the entire geometry suite.
  const module = new URL('../dist/src/renderer/cloth-clearance.js', import.meta.url).href;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { BodyTriangleBVH } from ${JSON.stringify(module)};
    const points = [], indices = [];
    for (let i = 0; i < 37; i++) {
      const base = points.length;
      points.push([.1, 0, 0], [.2, 0, 0], [.15, .01, 0]);
      indices.push(base, base + 1, base + 2);
    }
    const body = new BodyTriangleBVH(points, indices);
    assert.equal(body.triangleCount, 37);
    const hit = body.firstHit([.15, .002, 1], [.15, .002, -1]);
    assert.equal(hit.fraction, .5);
    assert.equal(hit.triangleIndex, 0);
  `], { encoding: 'utf8', timeout: 3000 });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr);
});

test('degenerate triangles are omitted and malformed geometry is rejected', () => {
  const body = new BodyTriangleBVH([[0, 0, 0], [1, 0, 0], [2, 0, 0]], [0, 1, 2]);
  assert.equal(body.triangleCount, 0);
  assert.equal(body.firstHit([0, 0, 1], [0, 0, -1]), undefined);
  assert.throws(() => new BodyTriangleBVH(new Float32Array(4), []), RangeError);
  assert.throws(() => new BodyTriangleBVH([[0, 0, 0]], [0, 1, 2]), RangeError);
  assert.throws(() => new BodyTriangleBVH([[NaN, 0, 0]], [0, 0, 0]), RangeError);
  assert.throws(() => clothDisplacementFactor(cube(), [[0, 0, 0]], [], []), RangeError);
  assert.throws(() => clothDisplacementFactor(cube(), [[0, 0, 0]], [[0, 0, 1]], [2, 2, 2]), RangeError);
  assert.throws(() => clothDisplacementFactor(cube(), [], [], [], { clearance: -1 }), RangeError);
});

test('static intersection catches an edge through a face with all endpoints outside', () => {
  const body = new BodyTriangleBVH([[-.2, -.2, 0], [.2, -.2, 0], [0, .2, 0]], [0, 1, 2]);
  const cloth = [[-2, 0, -1], [2, 0, 1], [2, 1, 1]], saved = structuredClone(cloth);
  assert.equal(body.intersectsMesh(cloth, [0, 1, 2]), true);
  assert.deepEqual(cloth, saved);
  assert.equal(body.intersectsMesh(cloth.map(p => [p[0], p[1] + 2, p[2]]), [0, 1, 2]), false);
  // Reverse the meshes: the same intersection must be found in either direction.
  assert.equal(new BodyTriangleBVH(cloth, [0, 1, 2]).intersectsMesh([[-.2, -.2, 0], [.2, -.2, 0], [0, .2, 0]], [0, 1, 2]), true);
});

test('static coplanar tests include overlap and reject overlapping AABBs with separated triangles', () => {
  const body = new BodyTriangleBVH([[0, 0, 0], [2, 0, 0], [0, 2, 0]], [0, 1, 2]);
  assert.equal(body.intersectsMesh([[.2, .2, 0], [.8, .2, 0], [.2, .8, 0]], [0, 1, 2]), true);
  assert.equal(body.intersectsMesh([[1.2, 1.2, 0], [2, 1.2, 0], [1.2, 2, 0]], [0, 1, 2]), false);
  assert.equal(body.intersectsMesh([[.2, .2, .001], [.8, .2, .001], [.2, .8, .001]], [0, 1, 2]), false);
});

test('static contact policy counts shared vertices, shared edges, and epsilon-near faces', () => {
  const body = new BodyTriangleBVH([[0, 0, 0], [1, 0, 0], [0, 1, 0]], [0, 1, 2]);
  assert.equal(body.intersectsMesh([[1, 0, 0], [2, 0, 0], [1, -1, 0]], [0, 1, 2]), true);
  assert.equal(body.intersectsMesh([[0, 0, 0], [1, 0, 0], [0, -1, 0]], [0, 1, 2]), true);
  assert.equal(body.intersectsMesh([[.2, .2, 5e-9], [.5, .2, 5e-9], [.2, .5, 5e-9]], [0, 1, 2]), true);
  assert.equal(body.intersectsMesh([[.2, .2, 5e-9], [.5, .2, 5e-9], [.2, .5, 5e-9]], [0, 1, 2], { epsilon: 0 }), false);
  assert.equal(body.intersectsMesh([[.2, .2, 2e-8], [.5, .2, 2e-8], [.2, .5, 2e-8]], [0, 1, 2]), false);
});

test('static intersection retains thin nondegenerate triangles and ignores zero-area faces', () => {
  const body = new BodyTriangleBVH([[0, 0, 0], [1, 0, 0], [0, 1e-9, 0]], [0, 1, 2]);
  assert.equal(body.intersectsMesh([[.2, 2e-10, -1], [.2, 2e-10, 1], [.3, 2e-10, 0]], [0, 1, 2], { epsilon: 0 }), true);
  assert.equal(body.intersectsMesh([[.2, 4e-10, 0], [.3, 4e-10, 0], [.2, 5e-10, 0]], [0, 1, 2], { epsilon: 0 }), true);
  assert.equal(body.intersectsMesh([[.2, 2e-9, -1], [.2, 2e-9, 1], [.3, 2e-9, 0]], [0, 1, 2], { epsilon: 0 }), false);
  assert.equal(body.intersectsMesh([[0, 0, 0], [0, 0, 0], [0, 0, 0]], [0, 1, 2]), false);
});

test('static mesh query supports strides and documents surface-only containment behavior', () => {
  const body = cube(), intersecting = [[0, 0, 0], [2, 0, 0], [0, 2, 0]], interior = [[0, 0, 0], [.2, 0, 0], [0, .2, 0]];
  for (const stride of [3, 6]) assert.equal(body.intersectsMesh(packed(intersecting, stride), new Uint16Array([0, 1, 2]), { stride }), true);
  assert.equal(body.intersectsMesh(interior, [0, 1, 2]), false);
  assert.equal(new BodyTriangleBVH([], []).intersectsMesh(intersecting, [0, 1, 2]), false);
  assert.throws(() => body.intersectsMesh(intersecting, [0, 1]), RangeError);
  assert.throws(() => body.intersectsMesh(intersecting, [0, 1, 99]), RangeError);
  assert.throws(() => body.intersectsMesh([[NaN, 0, 0], [0, 1, 0], [0, 0, 1]], [0, 1, 2]), RangeError);
  assert.throws(() => body.intersectsMesh(interior, [0, 1, 2], { epsilon: -1 }), RangeError);
});

test('static triangle query agrees with the independent segment/clipping auditor', () => {
  const mesh = points => ({ vertices: packed(points, 6), indices: new Uint16Array([0, 1, 2]) });
  for (let sample = 0; sample < 200; sample++) {
    const a = Array.from({ length: 3 }, (_, i) => [Math.sin(sample * 1.83 + i * 1.64), Math.cos(sample * 2.14 + i * .95), sample % 7 ? Math.sin(sample * .59 + i * 2.33) : 0]);
    const b = Array.from({ length: 3 }, (_, i) => [Math.sin(sample * 2.49 + i * 1.17), Math.cos(sample * 1.15 + i * 1.85), sample % 7 ? Math.cos(sample * .71 + i * 1.43) : 0]);
    const A = mesh(a), B = mesh(b), expected = intersections(triangles(A), triangles(B)).count > 0;
    assert.equal(new BodyTriangleBVH(A.vertices, A.indices, { stride: 6 }).intersectsMesh(B.vertices, B.indices, { stride: 6 }), expected, `auditor disagreement for sample ${sample}`);
  }
});

test('static guard catches the narrow real garment/body crossing missed by trajectory samples', () => {
  // Captured from the independent entrance-taper snapshot: interrupted
  // heart -> boom -> pixelTriangle, frame 36, cloth face 1343/body face 4626.
  const cloth = [
    [.5011038184165955, .2526625096797943, -.0007461141212843359],
    [.502223551273346, .25014591217041016, -.000746167846955359],
    [.5006559491157532, .2512229084968567, .020847009494900703],
  ];
  const body = [
    [.48134704530239103, .2509422460198402, 0],
    [.5039076346158982, .24848606020212172, .0232612860745026],
    [.5467628443241119, .2485886240005493, 0],
  ];
  assert.equal(new BodyTriangleBVH(body, [0, 1, 2]).intersectsMesh(cloth, [0, 1, 2]), true);
  assert.equal(new BodyTriangleBVH(cloth, [0, 1, 2]).intersectsMesh(body, [0, 1, 2]), true);
});

const separatedSupports = () => new BodyTriangleBVH([
  [-.009, -.1, -.1], [-.009, .1, -.1], [-.009, 0, .1],
  [.009, -.1, -.1], [.009, .1, -.1], [.009, 0, .1],
], [0, 1, 2, 3, 4, 5]);

test('blended closest support is continuous across equidistant disconnected facets', () => {
  const body = separatedSupports(), a = [-1e-7, 0, 0], b = [1e-7, 0, 0];
  near(Math.abs(body.closestPoint(a)[0] - body.closestPoint(b)[0]), .018);
  const blendedA = body.blendedClosestPoint(a), blendedB = body.blendedClosestPoint(b);
  assert.ok(Math.abs(blendedA[0] - blendedB[0]) < 1e-8);
  nearPoint(body.blendedClosestPoint([0, 0, 0]), [0, 0, 0]);
  assert.deepEqual(body.blendedClosestPoint(a, { blendRadius: 0 }), body.closestPoint(a));
});

test('unique support recovers outside the blend band and candidate entry has no jump', () => {
  const body = separatedSupports();
  nearPoint(body.blendedClosestPoint([.002, 0, 0], { blendRadius: .003 }), [.009, 0, 0]);
  const before = body.blendedClosestPoint([.0015 - 1e-7, 0, 0]), after = body.blendedClosestPoint([.0015 + 1e-7, 0, 0]);
  assert.ok(Math.hypot(...before.map((v, i) => v - after[i])) < 1e-8);
});

test('support blend uses area weights and preserves weights when an equal-projection facet is split', () => {
  const points = [
    [-.009, -.1, -.1], [-.009, .1, -.1], [-.009, 0, .1],
    [.009, -.2, -.2], [.009, .2, -.2], [.009, 0, .2], [-.009, 0, -.1],
  ];
  const original = new BodyTriangleBVH(points, [0, 1, 2, 3, 4, 5]);
  const split = new BodyTriangleBVH(points, [0, 6, 2, 6, 1, 2, 3, 4, 5]);
  nearPoint(original.blendedClosestPoint([0, 0, 0]), [.009 * 3 / 5, 0, 0]);
  nearPoint(split.blendedClosestPoint([0, 0, 0]), original.blendedClosestPoint([0, 0, 0]));
});

test('support height cutoff is softened continuously while exact minZ filtering is unchanged', () => {
  const body = new BodyTriangleBVH([
    [-.009, -.1, -.1], [-.009, .1, -.1], [-.009, 0, .02],
    [.009, -.1, -.1], [.009, .1, -.1], [.009, 0, .03],
  ], [0, 1, 2, 3, 4, 5]);
  const a = body.blendedClosestPoint([0, 0, 0], { minZ: .02 - 1e-7 }), b = body.blendedClosestPoint([0, 0, 0], { minZ: .02 + 1e-7 });
  assert.ok(Math.hypot(...a.map((v, i) => v - b[i])) < 1e-8);
  nearPoint(body.blendedClosestPoint([0, 0, 0], { minZ: .024 }), [.009, 0, 0]);
  nearPoint(body.closestPoint([0, 0, 0], { minZ: .020001 }), [.009, 0, 0]);
  assert.equal(body.blendedClosestPoint([0, 0, 0], { minZ: .04 }), undefined);
});

test('support blend validates its inputs and handles an empty body', () => {
  assert.equal(new BodyTriangleBVH([], []).blendedClosestPoint([0, 0, 0]), undefined);
  assert.throws(() => separatedSupports().blendedClosestPoint([0, 0, 0], { blendRadius: -1 }), RangeError);
  assert.throws(() => separatedSupports().blendedClosestPoint([NaN, 0, 0]), RangeError);
});
