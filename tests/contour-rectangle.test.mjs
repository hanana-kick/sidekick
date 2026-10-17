import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { containsRectangleWithMargin } from '../dist/src/core/contour-rectangle.js';
import { contourSnapshot, contourDistanceOutline, contourSignedDistance, shapeContour } from '../dist/src/core/contours.js';
import { createDesign, MATERIAL_SHAPE_NAMES } from '../dist/src/core/design.js';

const square = contourSnapshot([[-1, -1], [1, -1], [1, 1], [-1, 1]]);
const diamond = contourSnapshot([[0, -1], [1, 0], [0, 1], [-1, 0]]);
const contains = (contour, x = 0, y = 0, halfWidth = .25, bottom = -.25, top = .25, margin = .125) =>
  containsRectangleWithMargin(contour, x, y, halfWidth, bottom, top, margin);

function perimeterPoints(halfWidth, bottom, top, count) {
  const points = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1), x = -halfWidth + 2 * halfWidth * t, y = bottom + (top - bottom) * t;
    points.push([x, bottom], [x, top], [-halfWidth, y], [halfWidth, y]);
  }
  return points;
}
const sampledContains = (contour, x, y, points, margin) => points.every(([dx, dy]) => contourSignedDistance(contour, x + dx, y + dy) >= margin);

// The opening is between all 24 old top-edge samples; its tip is inside the box.
const notched = contourSnapshot([[-1, -1], [1, -1], [1, 1], [.021, 1], [.021, .1], [.019, .1], [.019, 1], [-1, 1]]);

test('rectangle containment preserves inclusive margins and zero-margin boundary contact', () => {
  assert.equal(contains(square, 0, 0, .5, -.5, .5, .5), true);
  assert.equal(contains(square, 0, 0, .5, -.5, .5, .50000001), false);
  assert.equal(contains(square, 0, 0, 1, -1, 1, 0), true);
  assert.equal(contains(square, 0, 0, 1, -1, 1, 1e-8), false);
  assert.equal(contains(square, 0, 0, 1.00000001, -1, 1, 0), false);
  assert.equal(contains(square, 1.5, 0, .1, -.1, .1, 0), false);
  // The anchor itself is outside; the complete offset rectangle is inside.
  assert.equal(contains(square, 0, -2, .25, 1.75, 2.25, .125), true);
});

test('long crossing segments and narrow concave notches cannot pass the rectangle test', () => {
  const triangle = contourSnapshot([[-2, -2], [2, -2], [-2, 2]]);
  assert.ok(contourSignedDistance(triangle, -.2, -.2) > 0);
  assert.equal(contains(triangle, -.2, -.2, .4, -.4, .4, .01), false);
  assert.equal(contains(triangle, -.2, -.2, .4, -.4, .4, 0), false);
  assert.ok(contourSignedDistance(notched, 0, 0) > 0);
  assert.equal(sampledContains(notched, 0, 0, perimeterPoints(.3, -.3, .3, 24), 0), true, 'old perimeter samples miss the narrow notch');
  assert.equal(contains(notched, 0, 0, .3, -.3, .3, 0), false);
  assert.equal(contains(notched, 0, 0, .3, -.3, .3, .001), false);
});

test('Euclidean clearance is exact at diagonal edges and symmetric under reflection', () => {
  const distance = .5 / Math.sqrt(2);
  assert.equal(contains(diamond, 0, 0, .25, -.25, .25, distance - 1e-10), true);
  assert.equal(contains(diamond, 0, 0, .25, -.25, .25, distance + 1e-10), false);
  for (const x of [0, .1, .3, .6]) for (const y of [0, .1, .3, .6]) for (const margin of [0, .05, .2]) {
    const result = contains(diamond, x, y, .125, -.25, .25, margin);
    assert.equal(contains(diamond, -x, y, .125, -.25, .25, margin), result);
    assert.equal(contains(diamond, x, -y, .125, -.25, .25, margin), result);
  }
});

test('zero-area rectangles preserve points, boundary lines, and concave crossing classification', () => {
  assert.equal(contains(square, 1, 0, 0, 0, 0, 0), true);
  assert.equal(contains(square, 1.01, 0, 0, 0, 0, 0), false);
  assert.equal(contains(square, 0, 1, 1, 0, 0, 0), true);
  assert.equal(contains(square, 1, 0, 0, -1, 1, 0), true);
  assert.equal(contains(square, 0, 0, 0, -.25, .25, .75), true);
  assert.equal(contains(square, 0, 0, .25, 0, 0, .75), true);
  assert.equal(contains(notched, 0, .2, .3, 0, 0, 0), false);
  assert.equal(contains(notched, .02, 0, 0, -.2, .2, 0), false);
  assert.equal(contains(notched, 0, .1, .3, 0, 0, 0), true, 'line touches the notch tip but does not leave the polygon');
});

test('non-finite inputs and invalid rectangle dimensions are rejected', () => {
  const valid = [0, 0, .25, -.25, .25, .125];
  for (let i = 0; i < valid.length; i++) for (const invalid of [NaN, Infinity, -Infinity]) {
    const values = [...valid]; values[i] = invalid;
    assert.equal(containsRectangleWithMargin(square, ...values), false);
  }
  assert.equal(contains(square, 0, 0, -.1), false);
  assert.equal(contains(square, 0, 0, .1, .2, -.2), false);
  assert.equal(contains(square, 0, 0, .1, -.1, .1, -.01), false);
});

test('all catalog contours agree with a dense signed-distance reference away from its bounded sampling uncertainty', () => {
  let seed = 0x12345678, compared = 0;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  for (const name of MATERIAL_SHAPE_NAMES) {
    const contour = shapeContour({ kind: 'material', name });
    for (let i = 0; i < 18; i++) {
      const x = (random() - .5) * 1.6, y = (random() - .5) * 1.6, halfWidth = .025 + random() * .25;
      const bottom = -.025 - random() * .3, top = .025 + random() * .3, margin = random() * .2;
      const points = perimeterPoints(halfWidth, bottom, top, 129);
      const minimum = Math.min(...points.map(([dx, dy]) => contourSignedDistance(contour, x + dx, y + dy)));
      // Signed distance is 1-Lipschitz: an unsampled point lies at most half a
      // sample interval from the reference. Only this uncertainty band is skipped.
      const error = Math.max(2 * halfWidth, top - bottom) / 256;
      const result = contains(contour, x, y, halfWidth, bottom, top, margin);
      if (result) assert.ok(minimum >= margin - 1e-12, `${name}: exact containment must satisfy every reference sample`);
      if (minimum < margin - 1e-12 || minimum > margin + error) {
        assert.equal(result, minimum >= margin, `${name} x=${x} y=${y} reference=${minimum} margin=${margin}`);
        compared++;
      }
    }
  }
  assert.ok(compared >= MATERIAL_SHAPE_NAMES.length * 17);
});

test('benchmark warm default SoftBoom/Bun envelopes against the previous 96-point fit', { skip: !process.env.SIDEKICK_BENCHMARK }, t => {
  const design = createDesign(), eye = design.eyes;
  const halfWidth = .14, bottom = -.17, top = .17, margin = .175;
  const points = perimeterPoints(halfWidth, bottom, top, 24);
  const scenarios = [];
  for (const name of ['softBoom', 'bun']) {
    const contour = shapeContour({ kind: 'material', name });
    for (const side of [-1, 1]) {
      const alpha = (eye.anchor.uv[0] + side * eye.spacing / 2) * 1.05, beta = eye.anchor.uv[1] * .9;
      for (let i = 0; i <= 40; i++) {
        const amount = i / 40;
        scenarios.push({ name, contour, x: Math.tan(alpha) * amount, y: Math.tan(beta) / Math.cos(alpha) * amount });
      }
    }
  }
  const old = item => sampledContains(item.contour, item.x, item.y, points, margin);
  const exact = item => contains(item.contour, item.x, item.y, halfWidth, bottom, top, margin);
  const time = (fn, items, rounds) => {
    let accepted = 0;
    const start = performance.now();
    for (let round = 0; round < rounds; round++) for (const item of items) accepted += Number(fn(item));
    return { elapsed: performance.now() - start, accepted };
  };
  for (const name of ['softBoom', 'bun']) {
    const items = scenarios.filter(item => item.name === name);
    time(old, items, 100); time(exact, items, 100);
    const a = time(old, items, 500), b = time(exact, items, 500);
    assert.equal(b.accepted, a.accepted, 'default sampled fit decisions match at all 41 amounts');
    t.diagnostic(`${name}: ${items.length * 500} rectangle queries; old96=${a.elapsed.toFixed(1)}ms exact=${b.elapsed.toFixed(1)}ms speedup=${(a.elapsed / b.elapsed).toFixed(2)}x; ${contourDistanceOutline(items[0].contour).length} outline segments`);
  }
});
