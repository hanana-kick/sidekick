import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAccessory, createDesign } from '../src/core/design.js';
import { initialPose } from '../src/core/motion.js';
import { RenderEngine } from '../src/runtime/render-engine.js';
import { AvatarRenderer } from '../src/renderer/webgl.js';
import type { RuntimeState } from '../src/runtime/protocol.js';
// @ts-ignore Shared JavaScript WebGL fixture.
import { countingCanvas } from './performance-fixture.mjs';

test('removing a rotated accessory retains its last displayed model while fading out', () => {
  const fixture = countingCanvas(), renderer = new AvatarRenderer(fixture.canvas);
  const accessory = createAccessory('halo'), pose = initialPose();
  pose.accessories[accessory.id] = [.3, .2, .4];
  let models: number[][] = [];
  fixture.gl.uniformMatrix4fv = (location: { name: string }, _transpose: boolean, value: number[]) => { if (location.name === 'model') models.push([...value]); };
  const state: RuntimeState = { design: createDesign({ accessories: [accessory] }), pose, bodyOrientation: { yaw: 0, pitch: 0, roll: 0 }, zoom: 1, activity: 'still', paused: false, reduced: false, active: true, time: 0, gaze: [0, 0], trackingMode: 'off', width: 100, height: 100, dpr: 1 };
  const engine = new RenderEngine(fixture.canvas, state, () => {}, { request: () => 1, cancel() {} }, renderer);
  const before = models.at(-1); models = [];
  engine.command({ kind: 'design', design: createDesign() }); engine.capture();
  assert.equal(models.length, 2, 'outgoing halo remains visible alongside body');
  assert.deepEqual(models.at(-1), before, 'outgoing mesh must not lose its authored rotation on the removal frame');
  engine.dispose();
});
