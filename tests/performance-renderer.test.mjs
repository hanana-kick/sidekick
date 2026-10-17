import test from 'node:test';
import assert from 'node:assert/strict';
import { countingCanvas } from './performance-fixture.mjs';
const source = process.env.SIDEKICK_SOURCE === '1', root = source ? '../src' : '../dist/src', extension = source ? 'ts' : 'js';
const [{ AvatarRenderer }, { createDesign, createAccessory, MATERIAL_SHAPE_NAMES }, { initialPose }, { ShapeTimeline }] = await Promise.all(['renderer/webgl', 'core/design', 'core/motion', 'core/shape-motion'].map(path => import(`${root}/${path}.${extension}`)));
const equipment = () => ['beret', 'glasses', 'moustache', 'scarf'].map(preset => createAccessory(preset)).concat(createAccessory('earring', { slot: 'leftEar', id: 'left-earring' }), createAccessory('starEarring', { slot: 'rightEar', id: 'right-earring' }));
const state = shape => ({ pose: initialPose(), time: 0, delta: 0, activity: 'still', reduced: true, style: 'flat', ...new ShapeTimeline(shape).snapshot });

test('all 35 unchanged equipped endpoints issue no redundant geometry uploads', () => {
  for (const shape of MATERIAL_SHAPE_NAMES) {
    const fixture = countingCanvas(), renderer = new AvatarRenderer(fixture.canvas), design = createDesign({ body: { shape }, accessories: equipment() }), frame = state(shape);
    renderer.render(design, frame); const before = fixture.snapshot();
    for (let i = 0; i < 12; i++) renderer.render(design, frame);
    const after = fixture.snapshot();
    assert.equal(after.uploadedBytes, before.uploadedBytes, shape); assert.equal(after.bufferData, before.bufferData, shape); assert.equal(after.bufferSubData, before.bufferSubData, shape);
    assert.equal(after.liveBuffers, before.liveBuffers); assert.equal(after.liveVAOs, before.liveVAOs);
    renderer.dispose(); const disposed = fixture.snapshot();
    for (const key of ['liveBuffers', 'liveVAOs', 'livePrograms', 'liveShaders', 'retainedGPUBytes']) assert.equal(disposed[key], 0, `${shape}/${key}`);
  }
});

test('tracking, camera and color-only changes reuse exact existing meshes', () => {
  const fixture = countingCanvas(), renderer = new AvatarRenderer(fixture.canvas), design = createDesign({ body: { shape: 'softBoom' }, accessories: equipment() }), frame = state('softBoom');
  renderer.render(design, frame); const before = fixture.snapshot();
  for (let i = 0; i < 20; i++) { frame.camera = { yaw: i * 5, pitch: i - 10, roll: i }; frame.pose.gaze = [Math.sin(i) * .3, Math.cos(i) * .3]; frame.pose.rotation = [i * .001, i * .002, 0]; renderer.render(design, frame); }
  const recolored = structuredClone(design); recolored.body.color = '#ff0000'; recolored.eyes.color = '#ffffff'; recolored.accessories.forEach(accessory => accessory.color = '#abcdef'); renderer.render(recolored, frame);
  assert.equal(fixture.snapshot().uploadedBytes, before.uploadedBytes); renderer.dispose();
});

test('catalog changes reuse a bounded number of GPU resources and removal/disposal releases them', () => {
  const fixture = countingCanvas(), renderer = new AvatarRenderer(fixture.canvas), resources = [];
  for (const shape of MATERIAL_SHAPE_NAMES) { renderer.render(createDesign({ body: { shape }, accessories: equipment() }), state(shape)); resources.push(fixture.snapshot()); }
  assert.ok(resources.every(value => value.liveBuffers <= 24 && value.liveVAOs <= 8));
  assert.equal(new Set(resources.map(value => value.liveBuffers)).size, 1); assert.equal(new Set(resources.map(value => value.liveVAOs)).size, 1);
  const before = fixture.snapshot(); renderer.render(createDesign({ body: { shape: 'puffy' }, accessories: [] }), state('puffy'));
  const removed = fixture.snapshot(); assert.equal(removed.liveBuffers, before.liveBuffers - 8); assert.equal(removed.liveVAOs, before.liveVAOs - 4);
  renderer.dispose(); renderer.dispose(); const disposed = fixture.snapshot();
  assert.equal(disposed.liveBuffers, 0); assert.equal(disposed.liveVAOs, 0); assert.equal(disposed.livePrograms, 0); assert.equal(disposed.retainedGPUBytes, 0);
});

test('backing size caps use one common scale and preserve wide/tall display aspect', () => {
  const fixture = countingCanvas(), renderer = new AvatarRenderer(fixture.canvas);
  let projection; fixture.gl.uniformMatrix4fv = (location, _, matrix) => { if (location.name === 'projection') projection = matrix; };
  const design = createDesign({ body: { shape: 'circle' } }), frame = state('circle');
  const sizes = [[2400, 600, 1, 2048, 512], [2400, 600, 2, 2048, 512], [600, 2400, 1, 512, 2048], [600, 2400, 2, 512, 2048], [1023, 600, 2, 2046, 1200], [1025, 600, 2, 2048, 1199], [2047, 600, 1, 2047, 600], [2049, 600, 1, 2048, 600], [600, 600, 2, 1200, 1200]];
  for (const [width, height, dpr, w, h] of sizes) { renderer.resize(width, height, dpr); assert.deepEqual([fixture.canvas.width, fixture.canvas.height], [w, h], `${width}x${height}@${dpr}`); renderer.render(design, frame); assert.ok(Math.abs(width * projection[0] / (height * projection[5]) - 1) < 1e-6, 'Projection uses CSS aspect even when backing dimensions round'); }
  renderer.dispose();
});

test('startup does not prebuild an unused square or upload body vertices twice', () => {
  const fixture = countingCanvas(), uploads = [], original = fixture.gl.bufferData;
  fixture.gl.bufferData = (target, data, usage) => { uploads.push(data.byteLength); original(target, data, usage); };
  const renderer = new AvatarRenderer(fixture.canvas);
  assert.deepEqual(uploads.slice(0, 2), [0, 0], 'Body vertex/index buffers stay empty until the first real design');
  const before = fixture.snapshot(); renderer.render(createDesign({ body: { shape: 'softBoom' } }), state('softBoom'));
  const after = fixture.snapshot(); assert.equal(after.bufferData - before.bufferData, 2, 'One final body vertex upload and one index upload'); assert.equal(after.bufferSubData - before.bufferSubData, 0, 'No immediate second body deformation upload');
  renderer.dispose();
});

test('constructor failures roll back every shader, program and partial mesh allocation', () => {
  const scenarios = [
    ['createShader', 1, null], ['createShader', 2, null], ['getShaderParameter', 1, false], ['getShaderParameter', 2, false],
    ['createProgram', 1, null], ['getProgramParameter', 1, false],
    ...[1, 5, 11].map(n => ['getUniformLocation', n, null]),
    ...[1, 2, 3, 4].map(n => ['createVertexArray', n, null]),
    ...Array.from({ length: 8 }, (_, i) => ['createBuffer', i + 1, null]),
    ...Array.from({ length: 8 }, (_, i) => ['bufferData', i + 1, 'throw']),
    ['shaderSource', 2, 'throw'], ['linkProgram', 1, 'throw'], ['vertexAttribPointer', 6, 'throw'],
  ];
  for (const [method, nth, result] of scenarios) {
    const fixture = countingCanvas(), original = fixture.gl[method]; let calls = 0;
    fixture.gl[method] = (...args) => { if (++calls === nth) { if (result === 'throw') throw new Error('Injected allocation failure'); return result; } return original(...args); };
    assert.throws(() => new AvatarRenderer(fixture.canvas), undefined, `${method}/${nth}`);
    const resources = fixture.snapshot();
    for (const key of ['liveBuffers', 'liveVAOs', 'livePrograms', 'liveShaders', 'retainedGPUBytes']) assert.equal(resources[key], 0, `${method}/${nth}/${key}`);
  }
});

test('a late accessory allocation failure releases its partial mesh without leaking the existing scene', () => {
  const fixture = countingCanvas(), renderer = new AvatarRenderer(fixture.canvas), frame = state('circle');
  renderer.render(createDesign({ body: { shape: 'circle' } }), frame); const before = fixture.snapshot();
  const original = fixture.gl.createBuffer; let calls = 0;
  fixture.gl.createBuffer = () => ++calls === 2 ? null : original();
  assert.throws(() => renderer.render(createDesign({ body: { shape: 'circle' }, accessories: [createAccessory('moustache')] }), frame));
  const failed = fixture.snapshot(); assert.equal(failed.liveBuffers, before.liveBuffers); assert.equal(failed.liveVAOs, before.liveVAOs); assert.equal(failed.livePrograms, before.livePrograms);
  renderer.dispose(); const disposed = fixture.snapshot(); assert.equal(disposed.liveBuffers, 0); assert.equal(disposed.liveVAOs, 0); assert.equal(disposed.livePrograms, 0);
});

test('centered zoom changes only projection, preserves aspect and never uploads existing geometry', () => {
  for (const [width, height] of [[600, 200], [200, 600], [4096, 512], [512, 4096]]) {
    const fixture = countingCanvas(), renderer = new AvatarRenderer(fixture.canvas), design = createDesign(), frame = state('circle');
    let projection, models = [];
    fixture.gl.uniformMatrix4fv = (location, _transpose, value) => { if (location.name === 'projection') projection = [...value]; else if (location.name === 'model') models.push([...value]); };
    renderer.resize(width, height, 2); frame.camera = { yaw: 20, pitch: -5, roll: 9, zoom: 1 }; renderer.render(design, frame);
    const original = projection, originalModels = models, before = fixture.snapshot(); models = [];
    frame.camera.zoom = 2; renderer.render(design, frame);
    assert.equal(projection[0], original[0] * 2); assert.equal(projection[5], original[5] * 2);
    assert.ok(Math.abs(projection[5] / projection[0] - width / height) < 1e-5);
    assert.equal(projection[12], original[12] * 2); assert.equal(projection[13], original[13] * 2);
    assert.equal(projection[13] / projection[5], original[13] / original[5], 'the original world-space viewing center is unchanged');
    assert.equal(projection[14], original[14]); assert.deepEqual(models, originalModels);
    assert.equal(fixture.snapshot().uploadedBytes, before.uploadedBytes);
    renderer.dispose();
  }
});
