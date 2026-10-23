import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RIGGING_LIMITS, isBoneId, validateSkeleton, validateBonePose, validateSkinBinding,
  computeBoneMatrices, getBoneTransform, skinVertices, createSkinDeformer,
} from '../src/core/rigging.js';
import type { Skeleton, SkinBinding, BonePose } from '../src/core/rigging.js';
import { identity, multiply } from '../src/core/math.js';

function close(actual: ArrayLike<number>, expected: ArrayLike<number>, tolerance = 1e-5): void {
  assert.equal(actual.length, expected.length);
  for (let i = 0; i < actual.length; i++) assert.ok(Math.abs(actual[i]! - expected[i]!) <= tolerance, `coordinate ${i}: ${actual[i]} != ${expected[i]}`);
}
const skeleton = (): Skeleton => ({ bones: [{ id: 'root' }, { id: 'tip', parent: 'root', position: [1, 0, 0] }] });
function binding(count = 1, source = skeleton()): SkinBinding {
  const joints = new Uint8Array(count * 4), weights = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) weights[i * 4] = 1;
  return { skeleton: source, joints, weights };
}
const vertex = () => new Float32Array([2, 0, 0, 1, 0, 0]);

test('skeleton validation clones every mutable field and preserves arbitrary authored bone order', () => {
  const source: Skeleton = { bones: [{ id: 'tip', parent: 'root', position: [1, 0, 0] }, { id: 'root', rotation: [0, 0, .2] }] };
  const original = structuredClone(source), result = validateSkeleton(source);
  assert.deepEqual(result, original); assert.deepEqual(structuredClone(result), result);
  result.bones[0]!.position![0] = 3; result.bones[1]!.rotation![0] = 4; result.bones.push({ id: 'extra' });
  assert.deepEqual(source, original);
  const matrices = computeBoneMatrices(source);
  close(matrices.world[0]!.slice(12, 15), [Math.cos(.2), Math.sin(.2), 0]);
});

test('hierarchy evaluation applies parent motion and returns local or skeleton-world transforms', () => {
  const source = skeleton(), pose: BonePose = { root: { rotation: [0, 0, Math.PI / 2], position: [0, 1, 0] } };
  close(getBoneTransform(source, 'tip', pose).slice(12, 15), [0, 2, 0]);
  close(getBoneTransform(source, 'tip', pose, 'local').slice(12, 15), [1, 0, 0]);
  close(getBoneTransform(source, 'tip').slice(12, 15), [1, 0, 0]);
  assert.throws(() => getBoneTransform(source, 'missing'), /Unknown bone/);
  assert.throws(() => getBoneTransform(source, 'tip', {}, 'camera' as 'world'), /space/);
});

test('pose deltas append after bind-local transforms rather than replacing the bind', () => {
  const source: Skeleton = { bones: [{ id: 'root', position: [1, 2, 0], rotation: [0, 0, Math.PI / 2] }] };
  close(getBoneTransform(source, 'root', { root: { position: [1, 0, 0] } }).slice(12, 15), [1, 3, 0]);
  const matrices = computeBoneMatrices(source, { root: { rotation: [0, 0, Math.PI / 2] } });
  close(matrices.world[0]!.slice(0, 3), [-1, 0, 0]);
});

test('inverse-bind matrices remove nontrivial hierarchy binds and neutral deformation is exact identity', () => {
  const source: Skeleton = { bones: [
    { id: 'root', position: [2, 3, 1], rotation: [.31, -.27, .89] },
    { id: 'tip', parent: 'root', position: [1, -.5, .3], rotation: [-.7, .2, .4] },
  ] };
  const matrices = computeBoneMatrices(source);
  for (let i = 0; i < source.bones.length; i++) {
    assert.deepEqual(matrices.deformation[i], identity());
    close(multiply(matrices.bindWorld[i]!, matrices.inverseBind[i]!), identity());
  }
  matrices.bindWorld[0]![12] = 99;
  assert.equal(getBoneTransform(source, 'root')[12], 2, 'Callers cannot corrupt future matrix evaluations.');
});

test('multiple roots are independent and parent indices never replace authored joint indices', () => {
  const source: Skeleton = { bones: [{ id: 'child', parent: 'lateRoot', position: [1, 0, 0] }, { id: 'other' }, { id: 'lateRoot' }] };
  const input = binding(1, source);
  close(skinVertices(vertex(), input, { lateRoot: { position: [0, 2, 0] }, other: { position: [0, 0, 3] } }), [2, 2, 0, 1, 0, 0]);
});

test('neutral skinning preserves every float32 bit, including nonexact bind rotations and signed zero', () => {
  const input = new Float32Array([2, -0, .123456789, .6, .8, -0]);
  const skin = binding(1, { bones: [{ id: 'root', position: [1, 2, 3], rotation: [.3, .2, .1] }] });
  for (const pose of [{}, { root: {} }, { root: { position: [0, 0, 0], rotation: [0, -0, 0] } }] as BonePose[]) {
    const result = skinVertices(input, skin, pose);
    assert.notEqual(result, input); assert.deepEqual(new Uint8Array(result.buffer), new Uint8Array(input.buffer));
  }
});

test('a weighted bone rotates positions around its bind pivot and rotates normals without translation', () => {
  const skin = binding(); skin.joints[0] = 1;
  close(skinVertices(vertex(), skin, { tip: { rotation: [0, 0, Math.PI / 2] } }), [1, 1, 0, 0, 1, 0]);
  close(skinVertices(vertex(), skin, { tip: { position: [2, 3, 4] } }), [4, 3, 4, 1, 0, 0]);
});

test('four influences blend positions, tolerate float32 weight sums, and renormalize normals', () => {
  const skin: SkinBinding = {
    skeleton: { bones: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }] },
    joints: new Uint8Array([0, 1, 2, 3]), weights: new Float32Array([.1, .2, .3, .4]),
  };
  const pose: BonePose = { a: { position: [0, 1, 0] }, b: { position: [0, 2, 0] }, c: { position: [0, 3, 0] }, d: { position: [0, 4, 0] } };
  close(skinVertices(vertex(), skin, pose), [2, 3, 0, 1, 0, 0]);
  const mixed = binding(); mixed.joints[1] = 1; mixed.weights.set([.5, .5, 0, 0]);
  const result = skinVertices(vertex(), mixed, { tip: { rotation: [0, 0, Math.PI / 2] } });
  close(result, [1.5, .5, 0, Math.SQRT1_2, Math.SQRT1_2, 0]);
  assert.ok(Math.abs(Math.hypot(...result.slice(3)) - 1) < 1e-7);
});

test('opposing normal influences use a deterministic finite strongest-influence fallback', () => {
  const skin = binding(); skin.joints[1] = 1; skin.weights.set([.5, .5, 0, 0]);
  const result = skinVertices(vertex(), skin, { tip: { rotation: [0, 0, Math.PI] } });
  close(result.slice(3), [1, 0, 0]);
});

test('reusable deformer owns neutral data, reuses output, and never accumulates previous poses', () => {
  const input = vertex(), skin = binding(), original = structuredClone(skin), deformer = createSkinDeformer(input, skin);
  input[0] = 15; skin.weights[0] = 0; skin.joints[0] = 31; skin.skeleton.bones[0]!.position = [9, 9, 9];
  const first = deformer.deform({ root: { position: [0, 1, 0] } }); close(first, [2, 1, 0, 1, 0, 0]);
  const second = deformer.deform({ root: { position: [0, 2, 0] } }); assert.equal(second, first); close(second, [2, 2, 0, 1, 0, 0]);
  const out = new Float32Array(6); assert.equal(deformer.deform({}, out), out); close(out, vertex());
  assert.equal(skinVertices(input, original, {}, input), input, 'Explicit in-place output is safe after snapshotting.');
  close(input, [15, 0, 0, 1, 0, 0]);
});

test('skin binding and pose validation clone all nested mutable fields', () => {
  const input = binding(), result = validateSkinBinding(input, 1);
  assert.deepEqual(result, input); assert.notEqual(result.joints.buffer, input.joints.buffer); assert.notEqual(result.weights.buffer, input.weights.buffer);
  result.skeleton.bones[1]!.position![0] = 9; assert.equal(input.skeleton.bones[1]!.position![0], 1);
  const pose: BonePose = { root: { position: [1, 2, 3], rotation: [.1, .2, .3] } }, copy = validateBonePose(pose, input.skeleton);
  assert.deepEqual(copy, pose); copy.root!.position![0] = 9; assert.equal(pose.root!.position![0], 1);
});

test('skeleton bounds, duplicate identities, unknown parents, and every cycle are rejected', () => {
  for (const value of [
    null, [], { bones: [] }, { bones: new Array(2) }, { bones: Array.from({ length: 33 }, (_, i) => ({ id: `b${i}` })) },
    { bones: [{ id: 'same' }, { id: 'same' }] }, { bones: [{ id: 'root', parent: 'missing' }] },
    { bones: [{ id: 'root', parent: 'root' }] }, { bones: [{ id: 'a', parent: 'b' }, { id: 'b', parent: 'a' }] },
    { bones: [{ id: 'a', parent: 'b' }, { id: 'b', parent: 'c' }, { id: 'c', parent: 'a' }] },
    { bones: [{ id: 'root', scale: [1, 1, 1] }] }, { bones: [{ id: 'root', matrix: new Float32Array(16) }] },
    { bones: [{ id: 'root', position: [NaN, 0, 0] }] }, { bones: [{ id: 'root', position: [17, 0, 0] }] },
    { bones: [{ id: 'root', rotation: [0, Infinity, 0] }] }, { bones: [{ id: 'root', rotation: [0, 0, 17 * Math.PI] }] },
    { bones: [{ id: 'root', position: [0, 0] }] }, { bones: [{ id: 'root', rotation: new Float32Array(3) }] },
  ]) assert.throws(() => validateSkeleton(value));
  const maximum = { bones: Array.from({ length: 32 }, (_, index) => ({ id: `b${index}`, ...(index ? { parent: `b${index - 1}` } : {}) })) };
  assert.equal(validateSkeleton(maximum).bones.length, 32);
});

test('bone identities reject reserved prototype names, path-like code, and oversized strings', () => {
  for (const id of ['', '__proto__', 'prototype', 'constructor', 'toString', 'valueOf', 'hasOwnProperty', 'x'.repeat(129), 'a b', '<script>', 1, null]) {
    assert.equal(isBoneId(id), false); assert.throws(() => validateSkeleton({ bones: [{ id }] }));
  }
  for (const id of ['root', '1', 'hand.left', 'rig/hand:right', 'bone_1', 'a'.repeat(128)]) assert.equal(isBoneId(id), true);
});

test('poses reject unknown bones, scale, malformed vectors, and unsupported fields', () => {
  for (const pose of [null, [], { unknown: {} }, { root: null }, { root: { scale: [1, 1, 1] } }, { root: { matrix: [] } }, { root: { position: [1, 2, Infinity] } }, { root: { rotation: [0, 0, 1000] } }, JSON.parse('{"__proto__":{}}')]) assert.throws(() => validateBonePose(pose, skeleton()));
  assert.deepEqual(validateBonePose(Object.create(null), skeleton()), {});
});

test('plain-data validation rejects getters without executing them, including vector and bone array entries', () => {
  let reads = 0;
  const accessor = (key: string, base: object = {}) => Object.defineProperty(base, key, { enumerable: true, get() { reads++; throw new Error('Getter executed'); } });
  const arrayWithGetter = [0, 0, 0]; accessor('1', arrayWithGetter);
  const bonesWithGetter = [{ id: 'root' }]; accessor('0', bonesWithGetter);
  for (const value of [accessor('bones'), { bones: [accessor('id')] }, { bones: [{ id: 'root', position: arrayWithGetter }] }, { bones: bonesWithGetter }]) assert.throws(() => validateSkeleton(value), /accessor|data/);
  assert.throws(() => validateBonePose(accessor('root'), skeleton()), /accessor/);
  assert.throws(() => validateBonePose({ root: accessor('position') }, skeleton()), /accessor/);
  assert.throws(() => validateSkinBinding(accessor('skeleton', binding()), 1), /accessor/);
  assert.equal(reads, 0);
});

test('custom prototypes, nonenumerable properties, symbols, sparse vectors, and extra array fields are rejected', () => {
  class CustomSkeleton { bones = [{ id: 'root' }]; }
  const extra = [0, 0, 0]; Object.defineProperty(extra, 'extra', { value: 1 });
  const symbolic = [0, 0, 0]; Object.defineProperty(symbolic, Symbol('extra'), { value: 1 });
  const nonEnumerable = Object.defineProperty({ bones: [{ id: 'root' }] }, 'extra', { value: 1 });
  const hiddenPosition = Object.defineProperty({ id: 'root' }, 'position', { value: [0, 0, 0] });
  for (const value of [new CustomSkeleton(), nonEnumerable, { bones: [hiddenPosition] }, { bones: [{ id: 'root', position: new Array(3) }] }, { bones: [{ id: 'root', position: extra }] }, { bones: [{ id: 'root', position: symbolic }] }, { bones: [{ id: 'root', position: [0, 0, 0], [Symbol('key')]: 1 }] }]) assert.throws(() => validateSkeleton(value));
});

test('joint and weight validation rejects wrong types, shared buffers, invalid entries and invalid counts', () => {
  for (const count of [0, -1, 1.5, NaN, Infinity, RIGGING_LIMITS.maxVertices + 1]) assert.throws(() => validateSkinBinding(binding(), count), /vertex count/);
  for (const changed of [
    { joints: [0, 0, 0, 0] }, { joints: new Uint16Array(4) }, { joints: new Uint8Array(3) }, { joints: new Uint8Array([0, 0, 0, 2]) },
    { weights: [1, 0, 0, 0] }, { weights: new Float64Array([1, 0, 0, 0]) }, { weights: new Float32Array(3) },
    ...[[0, 0, 0, 0], [.3, .3, 0, 0], [1, 1, 0, 0], [1, -.1, .1, 0], [NaN, 0, 0, 0], [Infinity, 0, 0, 0]].map(values => ({ weights: new Float32Array(values) })),
  ]) assert.throws(() => validateSkinBinding({ ...binding(), ...changed }, 1));
  if (typeof SharedArrayBuffer !== 'undefined') {
    assert.throws(() => validateSkinBinding({ ...binding(), joints: new Uint8Array(new SharedArrayBuffer(4)) }, 1), /non-shared/);
    assert.throws(() => validateSkinBinding({ ...binding(), weights: new Float32Array(new SharedArrayBuffer(16)) }, 1), /non-shared/);
  }
});

test('typed-array accessors and subclasses cannot execute code at the skin validation boundary', () => {
  let reads = 0;
  const malicious = binding(); Object.defineProperty(malicious.joints, 'buffer', { get() { reads++; throw new Error('executed'); } });
  assert.throws(() => validateSkinBinding(malicious, 1), /extra fields/);
  const lengthGetter = vertex(); Object.defineProperty(lengthGetter, 'length', { get() { reads++; throw new Error('executed'); } });
  assert.throws(() => skinVertices(lengthGetter, binding()), /extra fields/);
  class FloatSubclass extends Float32Array {}
  assert.throws(() => skinVertices(new FloatSubclass(vertex()), binding()), /plain Float32Array/);
  assert.equal(reads, 0);
});

test('skinning rejects malformed geometry and output before writing into destination', () => {
  for (const input of [new Float32Array(0), new Float32Array(5), new Float32Array([NaN, 0, 0, 1, 0, 0]), new Float32Array([17, 0, 0, 1, 0, 0]), new Float32Array([0, 0, 0, 0, 0, 0]), new Float32Array([0, 0, 0, Infinity, 0, 0])]) assert.throws(() => skinVertices(input, binding()));
  const out = new Float32Array(6).fill(9), deformer = createSkinDeformer(vertex(), binding());
  assert.throws(() => deformer.deform({ missing: {} }, out)); assert.deepEqual(out, new Float32Array(6).fill(9));
  assert.throws(() => deformer.deform({}, new Float32Array(5)), /length/);
  if (typeof SharedArrayBuffer !== 'undefined') assert.throws(() => deformer.deform({}, new Float32Array(new SharedArrayBuffer(24))), /non-shared/);
});
