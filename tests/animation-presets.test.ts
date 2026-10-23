import test from 'node:test';
import assert from 'node:assert/strict';
import { createPartAnimationPreset, PART_ANIMATION_PRESET_LIMITS } from '../src/core/animation-presets.js';
import type { PartAnimationPresetName, PartAnimationPresetOptions } from '../src/core/animation-presets.js';
import { samplePartAnimation, validatePartAnimation } from '../src/core/part-animation.js';

const names: PartAnimationPresetName[] = ['nod', 'shake', 'wiggle', 'blink'];

test('all presets are ordinary bounded validated clips with neutral endpoints', () => {
  for (const name of names) {
    const clip = createPartAnimationPreset(name);
    assert.deepEqual(validatePartAnimation(clip), clip);
    assert.equal(clip.loop, false);
    assert.ok(clip.duration >= PART_ANIMATION_PRESET_LIMITS.minDuration);
    assert.ok(clip.duration <= PART_ANIMATION_PRESET_LIMITS.maxDuration);
    for (const track of clip.tracks) {
      const first = track.keyframes[0]!, last = track.keyframes.at(-1)!;
      assert.equal(first.time, 0); assert.equal(last.time, clip.duration);
      assert.deepEqual(first.value, name === 'blink' ? [0, 0] : [0, 0, 0]);
      assert.deepEqual(last.value, first.value);
      assert.equal(track.interpolation, 'smooth');
      assert.ok(track.keyframes.some(frame => (frame.value as number[]).some(value => value !== 0)));
    }
    assert.deepEqual(samplePartAnimation(clip, 0), samplePartAnimation(clip, clip.duration));
  }
});

test('motion presets act on distinct body rotation axes without requiring a skeleton', () => {
  for (const [name, axis] of [['nod', 0], ['shake', 1], ['wiggle', 2]] as const) {
    const clip = createPartAnimationPreset(name);
    assert.equal(clip.tracks.length, 1);
    assert.equal(clip.tracks[0]!.target, 'body');
    assert.equal(clip.tracks[0]!.channel, 'rotation');
    const sample = samplePartAnimation(clip, clip.tracks[0]!.keyframes[1]!.time);
    assert.ok(sample.bodyRotation![axis] > 0);
    assert.ok(sample.bodyRotation!.every((value, index) => index === axis || value === 0));
    assert.equal(Object.keys(sample.bones).length, 0);
  }
});

test('blink uses both eye-weight tracks and opens fully again', () => {
  const clip = createPartAnimationPreset('blink', { duration: 1, intensity: .75 });
  assert.deepEqual(clip.tracks.map(track => track.target), ['leftEye', 'rightEye']);
  assert.deepEqual(samplePartAnimation(clip, .45).eyes, {
    left: { smile: 0, openness: .25 }, right: { smile: 0, openness: .25 },
  });
  assert.deepEqual(samplePartAnimation(clip, 1).eyes, {
    left: { smile: 0, openness: 1 }, right: { smile: 0, openness: 1 },
  });
});

test('options scale duration and intensity while ordinary loop timing remains seamless', () => {
  for (const name of names) {
    const original = createPartAnimationPreset(name);
    const custom = createPartAnimationPreset(name, { duration: 2, intensity: .5, loop: true });
    assert.equal(custom.duration, 2); assert.equal(custom.loop, true);
    for (let i = 0; i < custom.tracks.length; i++) {
      const a = original.tracks[i]!, b = custom.tracks[i]!;
      for (let j = 0; j < b.keyframes.length; j++) {
        assert.ok(Math.abs(b.keyframes[j]!.time / 2 - a.keyframes[j]!.time / original.duration) < 1e-12);
        assert.deepEqual(b.keyframes[j]!.value, (a.keyframes[j]!.value as number[]).map(value => value * .5));
      }
    }
    assert.deepEqual(samplePartAnimation(custom, 0), samplePartAnimation(custom, 2));
    assert.deepEqual(samplePartAnimation(custom, .5), samplePartAnimation(custom, 2.5));
  }
});

test('zero intensity remains exactly neutral and each preset call returns fresh data', () => {
  for (const name of names) {
    const clip = createPartAnimationPreset(name, { intensity: 0 });
    for (const track of clip.tracks) for (const frame of track.keyframes) {
      assert.deepEqual(frame.value, name === 'blink' ? [0, 0] : [0, 0, 0]);
    }
  }
  const first = createPartAnimationPreset('nod');
  (first.tracks[0]!.keyframes[1]!.value as number[])[0] = 5;
  assert.notEqual((createPartAnimationPreset('nod').tracks[0]!.keyframes[1]!.value as number[])[0], 5);
});

test('preset options enforce explicit finite bounds rather than silently coercing', () => {
  for (const duration of [0, -.1, .049, 61, Infinity, NaN, '1', undefined]) {
    assert.throws(() => createPartAnimationPreset('nod', { duration } as PartAnimationPresetOptions), /duration/);
  }
  for (const intensity of [-.1, 1.01, Infinity, NaN, '1', undefined]) {
    assert.throws(() => createPartAnimationPreset('nod', { intensity } as PartAnimationPresetOptions), /intensity/);
  }
  for (const loop of [0, 'true', undefined]) {
    assert.throws(() => createPartAnimationPreset('nod', { loop } as PartAnimationPresetOptions), /boolean/);
  }
  for (const duration of [.05, 60]) assert.doesNotThrow(() => createPartAnimationPreset('nod', { duration }));
  for (const name of ['unknown', '__proto__', 'toString', '', null]) {
    assert.throws(() => createPartAnimationPreset(name as PartAnimationPresetName), /preset/);
  }
});

test('preset options reject unsafe objects without invoking accessors', () => {
  let calls = 0;
  for (const key of ['duration', 'intensity', 'loop']) {
    const options = Object.defineProperty({}, key, { enumerable: true, get() { calls++; return 1; } });
    assert.throws(() => createPartAnimationPreset('nod', options), /accessor/);
  }
  assert.equal(calls, 0);
  for (const options of [null, [], { extra: true }, Object.create({ duration: 1 }), { [Symbol('duration')]: 1 }, Object.defineProperty({}, 'duration', { value: 1 })]) {
    assert.throws(() => createPartAnimationPreset('nod', options as PartAnimationPresetOptions));
  }
  assert.doesNotThrow(() => createPartAnimationPreset('nod', Object.create(null)));
});
