import test from 'node:test';
import assert from 'node:assert/strict';
import { shapes, MATERIAL_SHAPE_NAMES } from '../dist/src/core/shapes.js';
import { shapeContour, contourSignedDistance } from '../dist/src/core/contours.js';
import { buildMorph, MAX_MORPH_POINTS } from '../dist/src/core/morph.js';
import { contourSurfacePoint, bodyPoint, sampleSurface, BODY_SIZE } from '../dist/src/core/surface.js';
import { createDesign } from '../dist/src/core/design.js';
import { resolveShapeProfile, interpolateShapeProfile } from '../dist/src/core/shape-profiles.js';

const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
function checkContour(contour, label) {
  const points = contour.points;
  assert.ok(points.flat().every(Number.isFinite), `${label}: finite`);
  const area = points.reduce((sum, p, i) => { const q = points[(i + 1) % points.length]; return sum + p[0] * q[1] - p[1] * q[0]; }, 0) * 0.5;
  assert.ok(area > 0.25, `${label}: positive area without collapse`);
  let contained = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j];
    if ((a[1] > 0) !== (b[1] > 0) && 0 < (b[0] - a[0]) * -a[1] / (b[1] - a[1]) + a[0]) contained = !contained;
  }
  assert.ok(contained, `${label}: body origin remains inside`);
  const segments = points.map((a, i) => { const b = points[(i + 1) % points.length]; return { a, b, i, xmin: Math.min(a[0], b[0]), xmax: Math.max(a[0], b[0]), ymin: Math.min(a[1], b[1]), ymax: Math.max(a[1], b[1]) }; }).sort((a, b) => a.xmin - b.xmin);
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    for (let j = i + 1; j < segments.length && segments[j].xmin <= s.xmax; j++) {
      const t = segments[j];
      if (Math.abs(s.i - t.i) === 1 || Math.abs(s.i - t.i) === points.length - 1 || s.ymax < t.ymin || s.ymin > t.ymax) continue;
      assert.ok(!(cross(s.a, s.b, t.a) * cross(s.a, s.b, t.b) < -1e-20 && cross(t.a, t.b, s.a) * cross(t.a, t.b, s.b) < -1e-20), `${label}: crossed edges ${s.i}/${t.i}`);
    }
  }
}
const pointNear = (a, b, tolerance = 1e-8) => a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < tolerance, `${a} vs ${b}`));

test('contour plans preserve exact immutable endpoints, identity, and validation', () => {
  for (const name of MATERIAL_SHAPE_NAMES) {
    const from = shapeContour(shapes.material(name)), to = shapeContour(shapes.material('heart')), morph = buildMorph(from, to);
    assert.equal(morph.sample(0), from); assert.equal(morph.sample(1), to);
    assert.ok(Object.isFrozen(from) && Object.isFrozen(from.points) && from.points.every(Object.isFrozen));
    assert.throws(() => { from.points[0][0] = 20; }, TypeError);
    for (const t of [0, 0.17, 0.5, 1]) assert.equal(buildMorph(from, from).sample(t), from);
    for (const t of [-1, NaN, Infinity, 1.01]) assert.throws(() => morph.sample(t), RangeError);
  }
});

test('all 35 × 35 ordered catalog morphs preserve simple winding, area, and origin through the transition', () => {
  const contours = MATERIAL_SHAPE_NAMES.map(name => shapeContour(shapes.material(name)));
  for (let a = 0; a < contours.length; a++) for (let b = 0; b < contours.length; b++) {
    const plan = buildMorph(contours[a], contours[b]);
    for (const t of [0.01, 0.1, 0.25, 0.4, 0.5, 0.6, 0.75, 0.9, 0.99]) checkContour(plan.sample(t), `${MATERIAL_SHAPE_NAMES[a]}→${MATERIAL_SHAPE_NAMES[b]} @ ${t}`);
  }
});

test('aligned coordinates interpolate directly with no ellipse waypoint, spin, or midpoint pause', () => {
  for (const [a, b] of [['puffy', 'pixelTriangle'], ['pixelTriangle', 'heart'], ['boom', 'square'], ['softBoom', 'clover8Leaf']]) {
    const plan = buildMorph(shapes.material(a), shapes.material(b)), before = plan.sample(0.25), middle = plan.sample(0.5), after = plan.sample(0.75);
    assert.equal(before.points.length, after.points.length);
    middle.points.forEach((p, i) => pointNear(p, before.points[i].map((v, j) => (v + after.points[i][j]) / 2)));
    assert.ok(middle.points.some(p => Math.abs(Math.hypot(...p) - 1) > 0.1), `${a}→${b}: must not bridge through circle`);
    const almost = plan.sample(0.50001);
    assert.ok(almost.points.some((p, i) => Math.hypot(p[0] - middle.points[i][0], p[1] - middle.points[i][1]) > 1e-7), 'no eased pause at midpoint');
    const reverse = buildMorph(shapes.material(b), shapes.material(a));
    assert.deepEqual(reverse.sample(0.25), plan.sample(0.75));
  }
});

test('hundreds of interruption snapshots stay bounded, simple, and exact at retarget time', () => {
  let visible = shapeContour(shapes.material('softBoom'));
  const names = ['pixelTriangle', 'puffy', 'boom', 'heart', 'flower', 'square'];
  for (let i = 0; i < 150; i++) {
    const plan = buildMorph(visible, shapes.material(names[i % names.length]));
    assert.equal(plan.sample(0), visible, `retarget ${i} snaps`);
    const next = plan.sample(0.37);
    assert.ok(next.points.length <= MAX_MORPH_POINTS, `unbounded interruption ${i}: ${next.points.length}`);
    if (i % 15 === 0 || i === 149) checkContour(next, `interruption ${i}`);
    visible = next;
  }
});

test('recipe morphs and runtime transitions evaluate the same outline, including nested recipes', () => {
  const from = shapes.morph(shapes.material('puffy'), shapes.material('boom'), 0.37), to = shapes.roundedPolygon(7, { rounding: 0.21 });
  const recipe = shapes.morph(from, to, 0.62);
  assert.deepEqual(shapeContour(recipe), buildMorph(shapeContour(from), shapeContour(to)).sample(0.62));
  checkContour(shapeContour(recipe), 'nested recipe');
});

test('rounded profile depth is shared by body rays and anchors throughout morphs', () => {
  const body = createDesign({ body: { shape: 'puffy' } }).body;
  const plan = buildMorph(shapes.material('puffy'), shapes.material('pixelTriangle'));
  for (const t of [0, 0.2, 0.4999, 0.5, 0.5001, 0.8, 1]) {
    const contour = plan.sample(t), profile = interpolateShapeProfile(resolveShapeProfile('puffy'), resolveShapeProfile('pixelTriangle'), t);
    const size = [BODY_SIZE[0], BODY_SIZE[1], profile.depth];
    for (const direction of [[0, 0, 1], [0.2, 0.1, 1], [-0.3, 0.2, 0.8], [0.2, -0.8, 0.5]]) {
      const p = bodyPoint(body, direction, 1, contour, profile).map((v, i) => v / (size[i] / 2));
      assert.ok(p[2]>=0&&p[2]<=1+1e-10);
      pointNear(p, contourSurfacePoint(contour,p[0],p[1],true),1e-7);
      assert.ok(contourSignedDistance(contour, p[0], p[1]) >= -1e-6);
    }
    const frame = sampleSurface(body, { region: 'face', uv: [0.2, 0.1], offset: 0.02 }, 1, contour, profile);
    assert.ok([...frame.position, ...frame.normal].every(Number.isFinite));
  }
  const a = plan.sample(0.5), b = plan.sample(0.50001);
  for (const p of [[0, 0], [0.1, 0.2], [-0.3, -0.2]]) pointNear(contourSurfacePoint(a, ...p), contourSurfacePoint(b, ...p), 0.0001);
});
