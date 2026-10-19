import test from 'node:test';
import assert from 'node:assert/strict';
import { AccessoryTransition } from '../src/core/accessory-transition.js';
import { createAccessory, createDesign, equipAccessory } from '../src/core/design.js';
import { AvatarRenderer } from '../src/renderer/webgl.js';
import { initialPose } from '../src/core/motion.js';
// @ts-ignore Existing GL resource counter is deliberately JavaScript.
import { countingCanvas } from './performance-fixture.mjs';

test('equipment starts visible and replacement keeps the old frame until its zero-opacity swap', () => {
  const t = new AccessoryTransition(), old = createAccessory('beret'), next = createAccessory('crown');
  assert.deepEqual(t.sample([old], 0), [{ accessory: old, opacity: 1 }]);
  assert.deepEqual(t.sample([next], 0.016), [{ accessory: old, opacity: 1 }]);
  assert.equal(t.active, true);
  assert.deepEqual(t.sample([next], .05), [{ accessory: old, opacity: .5 }]);
  assert.deepEqual(t.sample([next], .05), [{ accessory: next, opacity: 0 }]);
  assert.deepEqual(t.sample([next], .05), [{ accessory: next, opacity: .5 }]);
  assert.deepEqual(t.sample([next], .05), [{ accessory: next, opacity: 1 }]);
  assert.equal(t.active, false);
});

test('interrupting removal or replacement continues from current coverage, never showing two meshes', () => {
  const t = new AccessoryTransition(), a = createAccessory('beret'), b = createAccessory('crown'), c = createAccessory('halo');
  t.sample([a], 0); t.sample([b], 0); t.sample([b], .025);
  assert.equal(t.sample([c], .016)[0]?.opacity, .84375);
  assert.deepEqual(t.sample([c], .075), [{ accessory: c, opacity: 0 }]);
  t.sample([c], .04);
  assert.ok(Math.abs(t.sample([], .016)[0]!.opacity - .352) < 1e-9);
  assert.deepEqual(t.sample([], .1), []);
  assert.equal(t.active, false);
  assert.deepEqual(t.sample([b], 0), [{ accessory: b, opacity: 0 }]);
  assert.equal(t.sample([b], .1)[0]?.opacity, 1);
  t.sample([a], 0); t.sample([a], .04);
  assert.ok(Math.abs(t.sample([b], 0)[0]!.opacity - .648) < 1e-9, 'reversing a pending replacement retains its outgoing opacity');
  assert.equal(t.sample([b], .1)[0]?.opacity, 1);
});

test('delta is bounded and invalid clocks cannot corrupt coverage; instant snaps all slots', () => {
  const t = new AccessoryTransition(), a = createAccessory('beret');
  t.sample([], 0); t.sample([a], 0);
  for (const delta of [NaN, Infinity, -1]) assert.equal(t.sample([a], delta)[0]?.opacity, 0);
  assert.equal(t.sample([a], 100)[0]?.opacity, 1);
  t.sample([], 0); assert.deepEqual(t.sample([], 0, true), []); assert.equal(t.active, false);
});

test('framing envelope retains old and new mounts until the old mount is invisible', () => {
  const t = new AccessoryTransition(), a = createAccessory('halo'), b = createAccessory('beret');
  t.sample([a], 0); t.sample([b], 0);
  assert.ok(t.envelope.includes(a)); assert.ok(t.envelope.includes(b));
  t.sample([b], .1); assert.ok(!t.envelope.includes(a));
});

test('renderer preserves old accessory draw on retarget, fades equipment only, and keeps framing continuous', () => {
  const fixture = countingCanvas(), r = new AvatarRenderer(fixture.canvas);
  const a = createDesign({ accessories: [createAccessory('beret')] }), b = equipAccessory(a, createAccessory('halo'));
  const frame = { pose: initialPose(), activity: 'still' as const, time: 0, delta: 0, reduced: false, style: 'flat' as const };
  let alpha = 1, eye = 0, projection: number[] = [], draws: { alpha: number; eye: number }[] = [];
  fixture.gl.uniform1f = (location: { name: string }, value: number) => { if (location.name === 'opacity') alpha = value; };
  fixture.gl.uniform1i = (location: { name: string }, value: number) => { if (location.name === 'eyesOn') eye = value; };
  fixture.gl.uniformMatrix4fv = (location: { name: string }, _transpose: boolean, value: number[]) => { if (location.name === 'projection') projection = [...value]; };
  fixture.gl.drawElements = () => draws.push({ alpha, eye });
  r.render(a, frame); const before = draws.slice(), previousProjection = projection.slice(); draws = [];
  r.render(b, frame); assert.deepEqual(draws, before); assert.deepEqual(projection, previousProjection); assert.equal(r.animating, true);
  draws = []; frame.delta = .05; r.render(b, frame);
  assert.deepEqual(draws[0], { alpha: 1, eye: 1 }); assert.ok(draws.slice(1).every(d => d.alpha === .5 && d.eye === 0));
  assert.ok(projection[0]! > 0); assert.ok(Math.abs(projection[0]! - previousProjection[0]!) < .1);
  r.render(b, { ...frame, instant: true }); assert.equal(r.animating, false);
  assert.equal(a.accessories[0]?.preset, 'beret'); assert.equal(b.accessories[0]?.preset, 'halo');
  r.dispose();
});

test('reduced and whole-canvas swaps snap without queuing a second equipment fade', () => {
  for (const mode of [{ reduced: true }, { equipmentImmediate: true }]) {
    const fixture = countingCanvas(), r = new AvatarRenderer(fixture.canvas);
    const frame = { pose: initialPose(), activity: 'still' as const, time: 0, delta: 0, reduced: false, style: 'flat' as const };
    r.render(createDesign({ accessories: [createAccessory('beret')] }), frame);
    r.render(createDesign({ accessories: [createAccessory('halo')] }), { ...frame, ...mode });
    assert.equal(r.animating, false); assert.equal(r.stats.drawCalls, 2, 'only body and new halo are drawn');
    r.render(createDesign(), { ...frame, ...mode });
    assert.equal(r.animating, false); assert.equal(r.stats.drawCalls, 1); r.dispose();
  }
});

test('same equipment identity refreshes resolved mount geometry without fading', () => {
  const t = new AccessoryTransition(), a = { ...createAccessory('beret'), scale: 1, rotation: [0, 0, 0], follow: .5, anchor: { offset: .035 } };
  t.sample([a], 0);
  const updated = { ...a, scale: 1.2, rotation: [.1, 0, 0], follow: .2, anchor: { offset: .05 } };
  assert.deepEqual(t.sample([updated], 0), [{ accessory: updated, opacity: 1 }]);
  assert.equal(t.active, false); assert.ok(t.envelope.every(item => item === updated));
});

test('same-ID preset replacement preserves outgoing pose and releases it for the incoming mesh', () => {
  const fixture = countingCanvas(), r = new AvatarRenderer(fixture.canvas), pose = initialPose();
  const old = createAccessory('halo', 'hat'), next = createAccessory('beret', 'hat');
  pose.accessories.hat = [.3, .2, .4];
  const frame = { pose, activity: 'still' as const, time: 0, delta: 0, reduced: false, style: 'flat' as const };
  let models: number[][] = [];
  fixture.gl.uniformMatrix4fv = (location: { name: string }, _transpose: boolean, value: number[]) => { if (location.name === 'model') models.push([...value]); };
  r.render(createDesign({ accessories: [old] }), frame); const before = models.at(-1); models = [];
  delete pose.accessories.hat;
  r.render(createDesign({ accessories: [next] }), frame);
  assert.deepEqual(models.at(-1), before, 'replacement with reused ID retains the outgoing preset offset');
  models = []; r.render(createDesign({ accessories: [next] }), { ...frame, delta: .05 });
  assert.deepEqual(models.at(-1), before, 'outgoing pose persists for the fade');
  r.render(createDesign({ accessories: [next] }), { ...frame, delta: .15 });
  assert.equal(r.stats.drawCalls, 3, 'the incoming beret now owns the slot');
  r.dispose();
});

test('cubic opacity preserves its derivative on reversal and rests at both endpoints', () => {
  const t = new AccessoryTransition(), a = createAccessory('halo'), b = createAccessory('beret'), h = 1e-7;
  t.sample([a], 0); t.sample([b], 0);
  const start = t.sample([b], h)[0]!.opacity;
  assert.ok(Math.abs((start - 1) / h) < .001, 'fade starts at rest');
  const before = t.sample([b], .035 - 2 * h)[0]!.opacity;
  const at = t.sample([b], h)[0]!.opacity;
  const leftVelocity = (at - before) / h;
  assert.equal(t.sample([a], 0)[0]!.opacity, at);
  const after = t.sample([a], h)[0]!.opacity;
  const rightVelocity = (after - at) / h;
  assert.ok(Math.abs(leftVelocity - rightVelocity) < .001, `${leftVelocity} vs ${rightVelocity}`);
  assert.ok(after < at, 'reversal initially preserves outgoing velocity rather than snapping direction');
  t.sample([a], .1); assert.equal(t.sample([a], h)[0]!.opacity, 1); assert.equal(t.active, false);

  t.sample([b], 0);
  const nearZero = t.sample([b], .1 - h)[0]!.opacity;
  assert.ok(nearZero / h < .001, 'outgoing mesh reaches zero at rest');
  assert.equal(t.sample([b], h)[0]!.opacity, 0);
  assert.ok(t.sample([b], h)[0]!.opacity / h < .001, 'incoming mesh starts at rest');
  const nearOne = t.sample([b], .1 - 2 * h)[0]!.opacity;
  assert.ok((1 - nearOne) / h < .001, 'incoming mesh reaches full opacity at rest');
  assert.equal(t.sample([b], h)[0]!.opacity, 1);
});

test('rapid retargets keep cubic coverage finite and bounded, including zero-alpha removal', () => {
  const t = new AccessoryTransition(), a = createAccessory('halo'), b = createAccessory('beret'), c = createAccessory('crown');
  t.sample([], 0); t.sample([a], 0); assert.deepEqual(t.sample([], 0), []); assert.equal(t.active, false);
  let seed = 3;
  for (let i = 0; i < 2000; i++) {
    seed = (1664525 * seed + 1013904223) >>> 0;
    const target = [[], [a], [b], [c]][seed % 4]!;
    t.sample(target, 0);
    const frame = t.sample(target, ((seed >>> 8) % 100) / 10000);
    assert.ok(frame.length <= 1);
    for (const { opacity } of frame) assert.ok(Number.isFinite(opacity) && opacity >= 0 && opacity <= 1, String(opacity));
  }
  t.sample([c], 0); t.sample([c], .25); assert.equal(t.active, false);
});

test('restoring a fading accessory eases retained rotation back to the authored baseline', () => {
  const fixture = countingCanvas(), r = new AvatarRenderer(fixture.canvas), pose = initialPose();
  const design = createDesign({ accessories: [createAccessory('halo')] });
  const frame = { pose, activity: 'still' as const, time: 0, delta: 0, reduced: false, style: 'flat' as const };
  let lastModel: number[] = [];
  fixture.gl.uniformMatrix4fv = (location: { name: string }, _transpose: boolean, value: number[]) => { if (location.name === 'model') lastModel = [...value]; };
  r.render(design, frame); const baseline = lastModel.slice();
  pose.accessories.halo = [.3, .2, .4]; r.render(design, frame); const rotated = lastModel.slice();
  delete pose.accessories.halo;
  r.render(createDesign(), frame); r.render(design, frame);
  assert.deepEqual(lastModel, rotated); assert.equal(r.animating, true);
  r.render(design, { ...frame, delta: .075 });
  assert.notDeepEqual(lastModel, rotated); assert.notDeepEqual(lastModel, baseline);
  r.render(design, { ...frame, delta: .075 });
  assert.deepEqual(lastModel, baseline); assert.equal(r.animating, false);
  assert.deepEqual(pose.accessories, {}, 'renderer never recreates removed authored tracks');
  r.dispose();
});
