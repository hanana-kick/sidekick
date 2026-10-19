import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAccessory, createDesign } from '../src/core/design.js';
import { initialPose } from '../src/core/motion.js';
import { RenderEngine } from '../src/runtime/render-engine.js';
import { AvatarRenderer } from '../src/renderer/webgl.js';
import type { RuntimeState } from '../src/runtime/protocol.js';
// @ts-ignore Shared JavaScript WebGL fixture.
import { countingCanvas } from './performance-fixture.mjs';

test('removing and restoring a rotated accessory retains its displayed model during fade reversal', () => {
  const fixture = countingCanvas(), renderer = new AvatarRenderer(fixture.canvas);
  const accessory = createAccessory('halo'), pose = initialPose();
  pose.accessories[accessory.id] = [.3, .2, .4];
  let models: number[][] = [];
  fixture.gl.uniformMatrix4fv = (location: { name: string }, _transpose: boolean, value: number[]) => { if (location.name === 'model') models.push([...value]); };
  const state: RuntimeState = { design: createDesign({ accessories: [accessory] }), pose, bodyOrientation: { yaw: 0, pitch: 0, roll: 0 }, zoom: 1, activity: 'still', paused: false, reduced: false, active: true, time: 0, gaze: [0, 0], trackingMode: 'off', width: 100, height: 100, dpr: 1 };
  let scheduled: ((time: number) => void) | undefined, now = 10;
  const engine = new RenderEngine(fixture.canvas, state, () => {}, { request: callback => { scheduled = callback; return 1; }, cancel() { scheduled = undefined; } }, renderer);
  const step = () => { now += 16; const callback = scheduled; scheduled = undefined; callback?.(now); };
  const before = models.at(-1); models = [];
  engine.command({ kind: 'design', design: createDesign() }); engine.capture();
  assert.equal(models.length, 2, 'outgoing halo remains visible alongside body');
  assert.deepEqual(models.at(-1), before, 'outgoing mesh must not lose its authored rotation on the removal frame');
  models = [];
  engine.command({ kind: 'design', design: state.design }); engine.capture();
  assert.deepEqual(models.at(-1), before, 'reversing removal must not reset the still-visible outgoing rotation');
  step(); step(); step();
  const intermediate = models.at(-1);
  assert.notDeepEqual(intermediate, before, 'takeover advances toward the new authored baseline');
  engine.command({ kind: 'design', design: createDesign() }); engine.capture();
  assert.deepEqual(models.at(-1), intermediate, 'second removal retains the intermediate takeover pose');
  engine.command({ kind: 'design', design: state.design }); engine.capture();
  assert.deepEqual(models.at(-1), intermediate, 'second re-add begins at that same intermediate pose');
  for (let i = 0; i < 60; i++) step();
  assert.equal(renderer.animating, false, 'repeated interruption eventually settles without residual work');
  engine.dispose();
});
