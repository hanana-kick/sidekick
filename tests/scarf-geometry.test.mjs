import test from 'node:test';
import assert from 'node:assert/strict';
import { createDesign, createAccessory, MATERIAL_SHAPE_NAMES } from '../dist/src/core/design.js';
import { resolveDesign } from '../dist/src/core/resolved-design.js';
import { resolveShapeProfile, accessoryMountProfile } from '../dist/src/core/shape-profiles.js';
import { shapeContour } from '../dist/src/core/contours.js';
import { ShapeTimeline } from '../dist/src/core/shape-motion.js';
import { bodyGeometry } from '../dist/src/renderer/body-geometry.js';
import { catalogAccessoryGeometry } from '../dist/src/renderer/catalog-accessory-geometry.js';
import { transform } from '../dist/src/core/math.js';
import { viewPoint } from '../dist/src/renderer/eye-projection.js';

const accessory = resolveDesign(createDesign({ accessories: [createAccessory('scarf')] })).accessories[0];
const point = (mesh, i) => Array.from(mesh.vertices.subarray(i * 6, i * 6 + 3));
const near = (a, b, tolerance = 1e-6) => assert.ok(Math.abs(a - b) <= tolerance, `${a} vs ${b}`);
const center = (mesh, start, ring) => [0, 1, 2].map(k => Array.from({ length: 8 }, (_, j) => mesh.vertices[(start + ring * 8 + j) * 6 + k]).reduce((a, b) => a + b, 0) / 8);
// Closed-component ray containment checks positive volumetric overlap at each
// sewn junction. Screen-space overlap or nearest-vertex distance is insufficient.
function contains(mesh, point, from, to) {
  const subtract = (a, b) => a.map((value, k) => value - b[k]);
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a.reduce((sum, value, k) => sum + value * b[k], 0);
  return [[1, .173, .389], [-.217, 1, .431], [.293, -.311, 1]].every(direction => {
    let hits = 0;
    for (let i = 0; i < mesh.indices.length; i += 3) {
      if (mesh.indices[i] < from || mesh.indices[i] >= to) continue;
      const [a, b, c] = [0, 1, 2].map(j => Array.from(mesh.vertices.subarray(mesh.indices[i + j] * 6, mesh.indices[i + j] * 6 + 3)));
      const ab = subtract(b, a), ac = subtract(c, a), h = cross(direction, ac), determinant = dot(ab, h);
      if (Math.abs(determinant) < 1e-12) continue;
      const offset = subtract(point, a), u = dot(offset, h) / determinant;
      if (u < 0 || u > 1) continue;
      const q = cross(offset, ab), v = dot(direction, q) / determinant;
      if (v < 0 || u + v > 1) continue;
      if (dot(ac, q) / determinant > 1e-10) hits++;
    }
    return hits % 2 === 1;
  });
}
function assertJoined(mesh, size, label) {
  const collarProbe = center(mesh, 0, 20); collarProbe[2] += .006 * size;
  assert.ok(contains(mesh, collarProbe, 0, 266), `${label}: collar overlap probe outside cloth`);
  assert.ok(contains(mesh, collarProbe, 478, 536), `${label}: collar and knot are separated`);
  for (const start of [266, 372]) {
    const tailProbe = center(mesh, start, 1);
    assert.ok(contains(mesh, tailProbe, start, start + 106), `${label}: tail overlap probe outside cloth`);
    assert.ok(contains(mesh, tailProbe, 478, 536), `${label}: knot and tail ${start} are separated`);
  }
}
const envelopes = new WeakMap();
function envelope(contour) {
  if (envelopes.has(contour)) return envelopes.get(contour);
  const { vertices: v, indices } = bodyGeometry(contour), cells = new Map(), cell = 22;
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = [indices[i], indices[i + 1], indices[i + 2]].map(index => index * 6);
    const det = (v[b] - v[a]) * (v[c + 1] - v[a + 1]) - (v[b + 1] - v[a + 1]) * (v[c] - v[a]);
    if (det <= 1e-12) continue;
    const t = [a, b, c, det];
    for (let x = Math.floor(Math.min(v[a], v[b], v[c]) * cell); x <= Math.floor(Math.max(v[a], v[b], v[c]) * cell); x++) for (let y = Math.floor(Math.min(v[a + 1], v[b + 1], v[c + 1]) * cell); y <= Math.floor(Math.max(v[a + 1], v[b + 1], v[c + 1]) * cell); y++) {
      const key = `${x},${y}`, list = cells.get(key) ?? []; list.push(t); cells.set(key, list);
    }
  }
  const sample = (x, y) => {
    let h = -Infinity;
    for (const [a, b, c, det] of cells.get(`${Math.floor(x * cell)},${Math.floor(y * cell)}`) ?? []) {
      const u = ((x - v[a]) * (v[c + 1] - v[a + 1]) - (y - v[a + 1]) * (v[c] - v[a])) / det;
      const w = ((v[b] - v[a]) * (y - v[a + 1]) - (v[b + 1] - v[a + 1]) * (x - v[a])) / det;
      if (u >= -1e-7 && w >= -1e-7 && u + w <= 1 + 1e-7) h = Math.max(h, v[a + 2] * (1 - u - w) + v[b + 2] * u + v[c + 2] * w);
    }
    return h;
  };
  envelopes.set(contour, sample); return sample;
}
function assertClear(mesh, contour, profile, squash, label) {
  const front = envelope(contour), stretch = 1 / Math.sqrt(squash), sx = .59 * stretch, sy = .59 * squash, sz = profile.depth * .5 * stretch;
  let minimum = Infinity;
  const check = p => { minimum = Math.min(minimum, p[2] - front(p[0] / sx, p[1] / sy) * sz); };
  for (let i = 0; i < mesh.vertices.length / 6; i++) check(point(mesh, i));
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const p = [mesh.indices[i], mesh.indices[i + 1], mesh.indices[i + 2]].map(index => point(mesh, index));
    for (const weights of [[1 / 3, 1 / 3, 1 / 3], [.5, .5, 0], [0, .5, .5], [.5, 0, .5]]) check([0, 1, 2].map(k => p.reduce((sum, v, j) => sum + weights[j] * v[k], 0)));
  }
  assert.ok(minimum > -2e-6, `${label}: penetration ${-minimum}`);
}


test('all 35 scarves have joined cloth, two supported contacts and genuinely free hanging ends', () => {
  for (const shape of MATERIAL_SHAPE_NAMES) for (const squash of [.88, 1, 1.12]) {
    const body = createDesign({ body: { shape } }).body, contour = shapeContour({ kind: 'material', name: shape }), profile = resolveShapeProfile(shape);
    const mesh = catalogAccessoryGeometry(body, accessory, squash), size = accessoryMountProfile(accessory, profile).scale;
    assert.equal(mesh.vertices.length / 6, 536, 'bounded fixed topology');
    assert.ok(center(mesh, 0, 28)[0] - center(mesh, 0, 4)[0] > .25 * size, `${shape}/${squash}: collar collapses into the knot`);
    assertClear(mesh, contour, profile, squash, `${shape}/${squash}`);
    assertJoined(mesh, size, `${shape}/${squash}`);
    const front = envelope(contour), stretch = 1 / Math.sqrt(squash);
    const gap = i => { const [x, y, z] = point(mesh, i); return z - front(x / (.59 * stretch), y / (.59 * squash)) * profile.depth * .5 * stretch; };
    for (const contact of [0, 256]) {
      const separation = Math.min(...Array.from({ length: 8 }, (_, j) => gap(contact + j)));
      assert.ok(separation >= .0019, `${shape}/${squash}: supported fold penetrates`);
      assert.ok(separation < .030 * size, `${shape}/${squash}: unsupported collar end ${separation}`);
    }
    for (const start of [266, 372]) {
      const free = Array.from({ length: 11 * 8 }, (_, j) => gap(start + 2 * 8 + j)).filter(Number.isFinite);
      if (free.length) assert.ok(Math.min(...free) > .025 * size, `${shape}/${squash}: tail lies against body`);
      for (let ring = 1; ring < 13; ring++) assert.ok(center(mesh, start, ring)[1] < center(mesh, start, ring - 1)[1], `${shape}: tail does not fall with gravity`);
    }
  }
});

test('free collar and tail folds preserve authored volume instead of projecting each vertex onto the body', () => {
  for (const shape of MATERIAL_SHAPE_NAMES) {
    const profile = resolveShapeProfile(shape), size = accessoryMountProfile(accessory, profile).scale;
    const mesh = catalogAccessoryGeometry(createDesign({ body: { shape } }).body, accessory);
    // Every core collar section lies on the same loose quartic drape in Z.
    for (let ring = 4; ring <= 28; ring++) {
      const t = (ring - 4) / 12 - 1;
      near(center(mesh, 0, ring)[2] - center(mesh, 0, 16)[2], -.115 * size * t ** 4);
    }
    for (const start of [266, 372]) for (let ring = 0; ring < 13; ring++) {
      const a = point(mesh, start + ring * 8 + 2), b = point(mesh, start + ring * 8 + 6);
      near(a[2] - b[2], .020 * size, 1e-7);
      if (ring) {
        const v = ring / 12, before = (ring - 1) / 12;
        near(center(mesh, start, ring)[2] - center(mesh, start, ring - 1)[2], size * (.030 / 12 + .014 * (Math.sin(Math.PI * v) - Math.sin(Math.PI * before))));
      }
    }
  }
});

test('scarf geometry is deterministic, view-independent and preserves interrupted morph snapshots on every shape', async () => {
  for (let i = 0; i < MATERIAL_SHAPE_NAMES.length; i++) {
    const from = MATERIAL_SHAPE_NAMES[i], to = MATERIAL_SHAPE_NAMES[(i + 13) % MATERIAL_SHAPE_NAMES.length], next = MATERIAL_SHAPE_NAMES[(i + 23) % MATERIAL_SHAPE_NAMES.length];
    const body = createDesign({ body: { shape: to } }).body, timeline = new ShapeTimeline(from);
    const active = timeline.to(to, { duration: 1000, easing: 'linear' }); timeline.advance(377);
    const sample = () => catalogAccessoryGeometry(body, accessory, 1, timeline.contour, timeline.profile);
    const before = sample(), snapshot = timeline.snapshot, interrupted = timeline.to(next, { duration: 600, easing: 'smooth' });
    assertJoined(before, accessoryMountProfile(accessory, timeline.profile).scale, `${from}->${to}`);
    assert.deepEqual(await active, { finished: false }); assert.strictEqual(timeline.snapshot, snapshot); assert.deepEqual(sample(), before);
    // Every sampled view sees the same non-collapsed 3D cloth; there is no view refit.
    for (const yaw of [-90, -45, 0, 45, 90, 180]) for (const pitch of [-25, 0, 25]) {
      const matrix = transform([0, 0, 0], [pitch * Math.PI / 180, yaw * Math.PI / 180, 0]);
      const back = viewPoint(matrix, point(before, 266 + 12 * 8 + 6)), front = viewPoint(matrix, point(before, 266 + 12 * 8 + 2));
      near(Math.hypot(...front.map((value, k) => value - back[k])), .020 * accessoryMountProfile(accessory, timeline.profile).scale);
    }
    timeline.advance(.001); const after = sample();
    assertJoined(after, accessoryMountProfile(accessory, timeline.profile).scale, `${from}->${to}->${next}`);
    assertClear(after, timeline.contour, timeline.profile, 1, `${from}->${to}->${next}`);
    for (let j = 0; j < after.vertices.length; j += 6) assert.ok(Math.hypot(...[0, 1, 2].map(k => after.vertices[j + k] - before.vertices[j + k])) < .003, `${from}: epsilon jump`);
    timeline.finish(); assert.deepEqual(await interrupted, { finished: true });
  }
});
