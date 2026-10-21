import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPairedAffineDeformation,
  validateAccessoryPluginDeformation,
  validateAccessoryPluginSurfaceConnectors,
  validateAccessoryPluginEyeMeasurements,
  evaluatePairedAffineDeformation,
  createSurfaceTubeTopology,
  sweepSurfaceTube,
  geometryFromPluginPoints,
} from '../src/core/plugin-deformation.js';
import type { PairedAffineDeformation, PairedAffineAuthoring, AccessoryPluginSurfaceConnector } from '../src/core/plugin-deformation.js';
import type { Vec3 } from '../src/core/design.js';

function recipe(): PairedAffineDeformation {
  return createPairedAffineDeformation({
    channels: { radius: { combine: 'max', factors: [1.28, .64] }, tube: { combine: 'min', factors: [.0845, .0845] } },
    vertices: [
      { eyeBlend: 0, coefficients: { radius: [1, 0, 0], tube: [1, 0, 0] } },
      { eyeBlend: 1, coefficients: { radius: [-1, 0, 0], tube: [0, 1, 0] } },
      { eyeBlend: .5, basePosition: [0, 0, .01], coefficients: { tube: [0, 0, 1] } },
    ],
  });
}
const tube = (): AccessoryPluginSurfaceConnector => ({ kind: 'surface-tube', to: [.044, -.006, .012], radius: .0085, rings: 8, sides: 8, clearance: .002 });

test('named channels compile to deterministic, independently owned serializable coefficients', () => {
  const input: PairedAffineAuthoring = { channels: { width: { combine: 'max', factors: [1, 2] } }, vertices: [{ eyeBlend: .25, basePosition: [1, 2, 3], coefficients: { width: [4, 5, 6] } }, { eyeBlend: 1 }] };
  const before = structuredClone(input), result = createPairedAffineDeformation(input);
  assert.deepEqual(input, before);
  assert.deepEqual(result.eyeBlend, new Float64Array([.25, 1]));
  assert.deepEqual(result.basePositions, new Float64Array([1, 2, 3, 0, 0, 0]));
  assert.deepEqual(result.channels[0]!.coefficients, new Float64Array([4, 5, 6, 0, 0, 0]));
  assert.equal(result.channels[0]!.measurement, 'eye-size');
  assert.deepEqual(structuredClone(result), result);
  result.channels[0]!.factors[0] = 7;
  assert.deepEqual(input, before);
});

test('affine geometry uses neutral landmarks, independent measured dimensions, and one mount scale', () => {
  const source = recipe(), before = structuredClone(source), eyes = { left: [-.2, .1] as [number, number], right: [.2, .1] as [number, number], size: [.1, .2] as [number, number] };
  const points = evaluatePairedAffineDeformation(source, eyes, 2), radius = Math.max(.1 * 1.28, .2 * .64), thickness = Math.min(.1 * .0845, .2 * .0845);
  assert.deepEqual(points, [[-.2 + 2 * (radius + thickness), .1, 0], [.2 - 2 * radius, .1 + 2 * thickness, 0], [0, .1, 2 * (.01 + thickness)]]);
  assert.deepEqual(source, before);
  const moved = evaluatePairedAffineDeformation(source, { ...eyes, left: [-.1, .3], right: [.3, .3] }, 2);
  points.forEach((point, i) => { assert.ok(Math.abs(moved[i]![0] - point[0] - .1) < 1e-14); assert.ok(Math.abs(moved[i]![1] - point[1] - .2) < 1e-14); assert.equal(moved[i]![2], point[2]); });
});

test('deformation validation copies every mutable field and rejects executable or unsupported variants', () => {
  const input = recipe(), result = validateAccessoryPluginDeformation(input, 3);
  assert.deepEqual(result, input);
  assert.notEqual(result.eyeBlend.buffer, input.eyeBlend.buffer);
  assert.notEqual(result.basePositions.buffer, input.basePositions.buffer);
  assert.notEqual(result.channels[0]!.coefficients.buffer, input.channels[0]!.coefficients.buffer);
  assert.notEqual(result.channels[0]!.factors, input.channels[0]!.factors);
  input.channels[0]!.coefficients[0] = 9;
  assert.equal(result.channels[0]!.coefficients[0], 1);
  for (const value of [null, { ...recipe(), kind: 'glasses' }, { ...recipe(), evaluate: () => 0 }, { ...recipe(), channels: [] }, { ...recipe(), eyeBlend: new Float32Array(3) }]) assert.throws(() => validateAccessoryPluginDeformation(value, 3));
  for (const mutate of [
    (r: PairedAffineDeformation) => { r.eyeBlend[0] = -1; },
    (r: PairedAffineDeformation) => { r.basePositions[0] = NaN; },
    (r: PairedAffineDeformation) => { r.channels[0]!.coefficients[0] = 17; },
    (r: PairedAffineDeformation) => { r.channels[0]!.factors[0] = Infinity; },
    (r: PairedAffineDeformation) => { r.channels[0]!.coefficients = new Float64Array(8); },
  ]) { const value = recipe(); mutate(value); assert.throws(() => validateAccessoryPluginDeformation(value, 3)); }
  assert.throws(() => validateAccessoryPluginDeformation(recipe(), 4), /length/);
  assert.throws(() => validateAccessoryPluginDeformation(recipe(), 2049), /vertex count/);
  if (typeof SharedArrayBuffer !== 'undefined') assert.throws(() => validateAccessoryPluginDeformation({ ...recipe(), eyeBlend: new Float64Array(new SharedArrayBuffer(24)) }, 3), /non-shared/);
});

test('author helper rejects misspelled channels, expressions, invalid reductions and unbounded coefficients', () => {
  const valid: PairedAffineAuthoring = { channels: { width: { combine: 'max', factors: [1, 1] } }, vertices: [{ eyeBlend: 0, coefficients: { width: [1, 0, 0] } }] };
  for (const value of [
    { ...valid, vertices: [{ eyeBlend: 0, coefficients: { typo: [1, 0, 0] } }] },
    { ...valid, channels: { width: { combine: 'sum', factors: [1, 1] } } },
    { ...valid, channels: { width: { combine: 'max', factors: [1, 1], expression: 'size.x' } } },
    { ...valid, vertices: [{ eyeBlend: 0, coefficients: { width: [Infinity, 0, 0] } }] },
    { ...valid, vertices: new Array(2049).fill({ eyeBlend: 0 }) },
    { ...valid, vertices: new Array(3) },
  ]) assert.throws(() => createPairedAffineDeformation(value as PairedAffineAuthoring));
});

test('neutral landmark validation owns exact two-coordinate measurements and rejects malformed frames', () => {
  const source = { left: [-.1, .2], right: [.1, .2], size: [.1, .2] }, result = validateAccessoryPluginEyeMeasurements(source);
  assert.deepEqual(result, source); assert.notEqual(result.left, source.left); assert.notEqual(result.right, source.right); assert.notEqual(result.size, source.size);
  source.left[0] = 10; assert.equal(result.left[0], -.1);
  for (const value of [null, { ...source, left: [] }, { ...source, right: [0, 0, 0] }, { ...source, size: [-.1, .2] }, { ...source, size: [.1, NaN] }, { ...source, left: [17, 0] }, { ...source, gaze: [0, 0] }]) assert.throws(() => validateAccessoryPluginEyeMeasurements(value));
});

test('effective scale and radius bounds include every valid product of authored dimensions', () => {
  const r = createPairedAffineDeformation({ channels: { width: { combine: 'max', factors: [.001, .001] } }, vertices: [{ eyeBlend: 0, coefficients: { width: [1, 0, 0] } }] });
  const eyes = { left: [0, 0] as [number, number], right: [.1, 0] as [number, number], size: [.1, .2] as [number, number] };
  assert.doesNotThrow(() => evaluatePairedAffineDeformation(r, eyes, .000001));
  assert.doesNotThrow(() => evaluatePairedAffineDeformation(r, eyes, 64));
  assert.throws(() => evaluatePairedAffineDeformation(r, eyes, .0000009), /mount scale/);
  assert.throws(() => evaluatePairedAffineDeformation(r, eyes, 64.1), /mount scale/);
  assert.doesNotThrow(() => sweepSurfaceTube([[0, 0, 0], [0, .1, 0]], 1e-12, 8));
  assert.doesNotThrow(() => sweepSurfaceTube([[0, 0, 0], [0, .1, 0]], 16, 8));
  assert.throws(() => sweepSurfaceTube([[0, 0, 0], [0, .1, 0]], 1e-13, 8), /Tube radius/);
  assert.throws(() => sweepSurfaceTube([[0, 0, 0], [0, .1, 0]], 64.1, 8), /Tube radius/);
  assert.throws(() => sweepSurfaceTube([[0, 0, 0], [0, .1, 0]], 64, 8), /Derived tube position/, 'Accepted parameter bounds must not bypass derived coordinate bounds');
});

test('append-only surface connector descriptors own data and reserve complete composed budgets', () => {
  const input = [{ ...tube(), material: { color: '#AABBCC', multiplier: .78 } }], result = validateAccessoryPluginSurfaceConnectors(input, 296, 588 * 3);
  assert.deepEqual(result[0], { ...tube(), material: { color: '#aabbcc', multiplier: .78 } });
  input[0]!.to[0] = 3; input[0]!.material.multiplier = 3;
  assert.equal(result[0]!.to[0], .044); assert.equal(result[0]!.material!.multiplier, .78);
  assert.deepEqual(structuredClone(result), result);
  assert.equal(296 + result[0]!.rings * result[0]!.sides + 2, 362);
  assert.equal(588 + result[0]!.rings * result[0]!.sides * 2, 716);
  assert.throws(() => validateAccessoryPluginSurfaceConnectors([tube()], 2048, 3), /Composed/);
  assert.throws(() => validateAccessoryPluginSurfaceConnectors([tube()], 3, 4000 * 3), /Composed/);
  assert.throws(() => validateAccessoryPluginSurfaceConnectors(Array.from({ length: 5 }, tube), 3, 3), /between 1 and 4/);
  for (const value of [{ ...tube(), kind: 'earring' }, { ...tube(), vertexStart: 0 }, { ...tube(), rings: 1 }, { ...tube(), sides: 2 }, { ...tube(), radius: NaN }, { ...tube(), to: [0, 0, Infinity] }, { ...tube(), material: { color: 'red' } }]) assert.throws(() => validateAccessoryPluginSurfaceConnectors([value], 3, 3));
  assert.throws(() => validateAccessoryPluginSurfaceConnectors([tube()], 3, 4), /complete triangles/);
});

test('generic capped sweeps retain circular cross-sections and exact catalog topology ordering', () => {
  const path = Array.from({ length: 8 }, (_, i): Vec3 => [i * .002, i * .01, i * .001]), before = structuredClone(path), points = sweepSurfaceTube(path, .0085, 8), indices = createSurfaceTubeTopology(8, 8);
  assert.equal(points.length, 66); assert.equal(indices.length, 384);
  assert.deepEqual(Array.from(indices.slice(0, 6)), [0, 1, 8, 1, 9, 8]);
  assert.deepEqual(Array.from(indices.slice(-6)), [64, 0, 7, 65, 63, 56]);
  assert.deepEqual(points[64], path[0]); assert.deepEqual(points[65], path[7]);
  for (let ring = 0; ring < 8; ring++) for (let side = 0; side < 8; side++) assert.ok(Math.abs(Math.hypot(...points[ring * 8 + side]!.map((value, axis) => value - path[ring]![axis]!)) - .0085) < 1e-14);
  assert.deepEqual(path, before);
  const vertices = geometryFromPluginPoints(points, indices);
  for (let i = 0; i < vertices.length; i += 6) assert.ok(Math.abs(Math.hypot(vertices[i + 3]!, vertices[i + 4]!, vertices[i + 5]!) - 1) < 1e-6);
});

test('derived point and topology validation rejects invalid outputs before a GPU upload', () => {
  const r = recipe(); r.channels[0]!.coefficients[0] = 16;
  assert.throws(() => evaluatePairedAffineDeformation(r, { left: [0, 0], right: [0, 0], size: [16, 16] }, 8), /Derived accessory position/);
  assert.throws(() => evaluatePairedAffineDeformation(recipe(), { left: [0, 0], right: [0, 0], size: [0, .2] }), /Neutral eye size/);
  assert.throws(() => sweepSurfaceTube([[16, 0, 0], [16, 1, 0]], .1, 8), /Derived tube position/);
  assert.throws(() => createSurfaceTubeTopology(33, 8), /Tube rings/);
  assert.throws(() => geometryFromPluginPoints([[0, 0, 0]], [0, 0, 1]), /triangle index/);
  assert.throws(() => geometryFromPluginPoints([[NaN, 0, 0]], [0, 0, 0]), /Derived accessory position/);
  assert.throws(() => geometryFromPluginPoints([[0, 0, 0]], [0, 0]), /index count/);
});

test('normal accumulation can match authored full precision or Float32 position differences', () => {
  const points: Vec3[] = [[1, 0, 0], [1 + 1e-8, 1, 0], [1 + 2e-8, 0, 1]], indices = new Uint16Array([0, 1, 2]);
  const f64 = geometryFromPluginPoints(points, indices), f32 = geometryFromPluginPoints(points, indices, 'float32');
  assert.notDeepEqual(f64, f32);
  assert.deepEqual(Array.from(f32.slice(3, 6)), [1, 0, 0]);
  assert.ok(f64[4]! < 0 && f64[5]! < 0);
  assert.throws(() => geometryFromPluginPoints(points, indices, 'arbitrary' as 'float32'), /normal precision/);
});

test('named affine channels treat omitted prototype-named coefficients as zero', () => {
  for (const name of ['constructor', 'toString', 'valueOf', 'hasOwnProperty']) {
    const result = createPairedAffineDeformation({ channels: { [name]: { combine: 'max', factors: [1, 1] } }, vertices: [{ eyeBlend: 0, coefficients: {} }] });
    assert.deepEqual(Array.from(result.channels[0]!.coefficients), [0, 0, 0]);
    const explicit = createPairedAffineDeformation({ channels: { [name]: { combine: 'max', factors: [1, 1] } }, vertices: [{ eyeBlend: 0, coefficients: { [name]: [1, 2, 3] } }] });
    assert.deepEqual(Array.from(explicit.channels[0]!.coefficients), [1, 2, 3]);
  }
});
