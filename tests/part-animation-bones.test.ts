import test from 'node:test';
import assert from 'node:assert/strict';
import { samplePartAnimation, validatePartAnimation } from '../src/core/part-animation.js';

const bone = (target: unknown = { bone: 'root' }, channel = 'rotation', value: unknown = [1, 2, 3]) => ({
  target, channel, keyframes: [{ time: 0, value: [0, 0, 0] }, { time: 2, value }],
});
const clip = (tracks: unknown[]) => ({ duration: 2, tracks });

test('body and accessory bone tracks sample local rotation and position independently', () => {
  const validated = validatePartAnimation(clip([
    bone(), bone({ bone: 'root' }, 'position', [2, 4, 6]),
    bone({ bone: 'root', accessory: 'plugin/hat:first' }, 'rotation', [2, 3, 4]),
    bone({ bone: 'root', accessory: 'plugin/hat:first' }, 'position', [4, 5, 6]),
    bone({ bone: 'root', accessory: 'plugin/hat:second' }, 'rotation', [3, 4, 5]),
    bone({ accessory: 'root' }, 'rotation', [3, 3, 3]),
    bone('body', 'rotation', [4, 4, 4]),
  ]));
  const sample = samplePartAnimation(validated, 1);
  assert.deepEqual(sample.bones.root, { rotation: [.5, 1, 1.5], position: [1, 2, 3] });
  assert.deepEqual(sample.accessoryBones['plugin/hat:first']?.root, { rotation: [1, 1.5, 2], position: [2, 2.5, 3] });
  assert.deepEqual(sample.accessoryBones['plugin/hat:second']?.root, { rotation: [1.5, 2, 2.5] });
  assert.deepEqual(sample.accessories.root, { rotation: [1.5, 1.5, 1.5] });
  assert.deepEqual(sample.bodyRotation, [2, 2, 2]);
});

test('bone channels use smooth interpolation, exact keys, held endpoints and ordinary loop timing', () => {
  const raw = { ...bone(), interpolation: 'smooth' };
  const validated = validatePartAnimation(clip([raw]));
  assert.deepEqual(samplePartAnimation(validated, .5).bones.root?.rotation, [.15625, .3125, .46875]);
  assert.deepEqual(samplePartAnimation(validated, -1).bones.root?.rotation, [0, 0, 0]);
  assert.deepEqual(samplePartAnimation(validated, 3).bones.root?.rotation, [1, 2, 3]);
  const looping = validatePartAnimation({ ...clip([raw]), loop: true });
  assert.deepEqual(samplePartAnimation(looping, 2).bones.root?.rotation, [0, 0, 0]);
  assert.deepEqual(samplePartAnimation(looping, -1).bones.root?.rotation, [.5, 1, 1.5]);
});

test('path segments cannot collide even when identifiers include punctuation', () => {
  const validated = validatePartAnimation(clip([
    bone({ bone: 'a:b:c' }),
    bone({ accessory: 'a', bone: 'b:c' }),
    bone({ accessory: 'a:b', bone: 'c' }),
    bone({ accessory: 'a:b:c' }),
  ]));
  assert.equal(validated.tracks.length, 4);
  for (const target of [{ bone: 'a' }, { accessory: 'hat', bone: 'a' }]) {
    assert.throws(() => validatePartAnimation(clip([bone(target), bone(target)])), /unique/);
  }
});

test('bone and accessory sample dictionaries have no inherited entries', () => {
  const validated = validatePartAnimation(clip([bone({ bone: 'root', accessory: 'toString' })]));
  const sample = samplePartAnimation(validated, 0);
  assert.equal(Object.getPrototypeOf(sample.bones), null);
  assert.equal(Object.getPrototypeOf(sample.accessoryBones), null);
  assert.equal(Object.getPrototypeOf(sample.accessoryBones.toString), null);
  assert.deepEqual(sample.accessoryBones.toString?.root, { rotation: [0, 0, 0] });
  assert.equal(Object.hasOwn(sample.bones, 'toString'), false);
});

test('bone target and values are defensively copied at validation and sampling boundaries', () => {
  const target = { bone: 'root', accessory: 'hat' };
  const value = [1, 2, 3];
  const validated = validatePartAnimation(clip([bone(target, 'rotation', value)]));
  target.bone = 'other'; target.accessory = 'other'; value[0] = 6;
  const sample = samplePartAnimation(validated, 2);
  sample.accessoryBones.hat!.root!.rotation![0] = 5;
  assert.deepEqual(samplePartAnimation(validated, 2).accessoryBones.hat?.root, { rotation: [1, 2, 3] });
});

test('bone identifiers reject unsafe, unbounded and reserved names', () => {
  for (const id of ['', '_root', '-root', 'space name', 'é', 'a'.repeat(129), '__proto__', 'prototype', ...Object.getOwnPropertyNames(Object.prototype)]) {
    assert.throws(() => validatePartAnimation(clip([bone({ bone: id })])), /bone.*id/);
  }
  for (const id of ['root', 'Root-01', 'chain/joint:a.b', 'a'.repeat(128)]) {
    assert.doesNotThrow(() => validatePartAnimation(clip([bone({ bone: id })])));
  }
});

test('bone target object validation rejects accessors without invoking them', () => {
  let calls = 0;
  for (const key of ['bone', 'accessory']) {
    const target = Object.defineProperty({ bone: 'root' }, key, { enumerable: true, get() { calls++; return 'root'; } });
    assert.throws(() => validatePartAnimation(clip([bone(target)])), /accessor/);
  }
  assert.equal(calls, 0);
  for (const target of [null, [], { bone: undefined }, { bone: 'root', accessory: undefined }, { bone: 'root', accessory: 'constructor' }, { bone: 'root', extra: 1 }, Object.create({ bone: 'root' })]) {
    assert.throws(() => validatePartAnimation(clip([bone(target)])));
  }
});

test('bone tracks support only finite bounded position and rotation vectors, never scale or opacity', () => {
  for (const channel of ['scale', 'opacity', 'weights', 'uv']) {
    assert.throws(() => validatePartAnimation(clip([bone({ bone: 'root' }, channel)])), /bone animation channel/);
  }
  for (const value of [[17, 0, 0], [NaN, 0, 0], [Infinity, 0, 0], [0, 0], [0, 0, 0, 0], 1]) {
    assert.throws(() => validatePartAnimation(clip([bone({ bone: 'root' }, 'position', value)])));
  }
  assert.throws(() => validatePartAnimation(clip([bone({ bone: 'root' }, 'rotation', [7, 0, 0])])), /within/);
});

test('TypeScript distinguishes bone channels from accessory-only scale and opacity', async () => {
  const ts = await import('typescript');
  const { fileURLToPath } = await import('node:url');
  const fixture = fileURLToPath(new URL('./fixtures/part-animation-bone-types.ts', import.meta.url));
  const program = ts.createProgram([fixture], {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext,
    strict: true, noEmit: true, skipLibCheck: true, types: [],
  });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  assert.deepEqual(diagnostics.map(item => ts.flattenDiagnosticMessageText(item.messageText, '\n')), []);
});
