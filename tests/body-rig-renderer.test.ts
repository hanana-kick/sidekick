import test from 'node:test';
import assert from 'node:assert/strict';
import { createBodySkinBinding, validateBodyRig } from '../src/core/body-rig.js';
import type { BodyRig } from '../src/core/body-rig.js';
import { createDesign, createAccessory, MATERIAL_SHAPE_NAMES } from '../src/core/design.js';
import { initialPose, activityFrame } from '../src/core/motion.js';
import { computeBoneMatrices, skinVertices } from '../src/core/rigging.js';
import { getAccessoryAttachmentFrame } from '../src/core/accessory-attachments.js';
import { multiply, transform } from '../src/core/math.js';
import type { Mat4 } from '../src/core/math.js';
import { AvatarRenderer } from '../src/renderer/webgl.js';
import type { RenderState } from '../src/renderer/webgl.js';
import type { Mesh, RenderBackend } from '../src/renderer/render-backend.js';
import type { PluginAccessoryInstance } from '../src/element/plugin-equipment.js';
// @ts-expect-error Existing JavaScript mock GL intentionally has no declaration.
import { countingCanvas } from './performance-fixture.mjs';

const skeleton = { bones: [{ id: 'root', position: [0, .4, 0] as [number, number, number] }] };
const rig: BodyRig = { skeleton, influences: [] };
const state = (): RenderState => ({ pose: initialPose(), activity: 'still', time: 0, delta: 0, reduced: true, style: 'flat' });
function surface(size = 160) {
  let pixels = new Uint8ClampedArray();
  const canvas = { width: size, height: size, getContext: (kind: string) => kind === 'webgl2' ? null : {
    createImageData: (width: number, height: number) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }),
    putImageData: (image: { data: Uint8ClampedArray }) => { pixels = image.data.slice(); },
  } } as unknown as HTMLCanvasElement;
  return { canvas, get pixels() { return pixels; } };
}
function centroid(pixels: Uint8ClampedArray, size: number, ink = false): [number, number, number] {
  let x = 0, y = 0, count = 0;
  for (let at = 0; at < pixels.length; at += 4) if (pixels[at + 3]! > 240 && (!ink || pixels[at]! < 15)) {
    x += (at / 4) % size; y += Math.floor(at / 4 / size); count++;
  }
  return [x / count, y / count, count];
}
function privateRenderer(renderer: AvatarRenderer): { backend: RenderBackend; meshes: { body: Mesh } } { return renderer as unknown as { backend: RenderBackend; meshes: { body: Mesh } }; }

const triangle = new Float32Array([-.16, -.12, .03, 0, 0, 1, .16, -.12, .03, 0, 0, 1, 0, .2, .03, 0, 0, 1]);
function plugin(): PluginAccessoryInstance {
  return { id: 'badge', slot: 'eyes', color: '#ff00ff', asset: { pluginId: 'test/skinned', slots: ['eyes'], geometry: {
    vertices: triangle, indices: new Uint16Array([0, 1, 2]), skin: { skeleton, joints: new Uint8Array(12), weights: new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]) },
  } } };
}

test('spatial body weights retain the strongest four, normalize, and fall back outside fields', () => {
  const input: BodyRig = { skeleton: { bones: Array.from({ length: 6 }, (_, i) => ({ id: `bone${i}` })) }, influences: Array.from({ length: 6 }, (_, i) => ({ bone: `bone${i}`, center: [0, 0, 0], radius: i + 2 })), fallbackBone: 'bone2' };
  const vertices = new Float32Array([1, 0, 0, 0, 0, 1, 15, 0, 0, 0, 0, 1]);
  const binding = createBodySkinBinding(vertices, input);
  assert.deepEqual([...binding.joints.slice(0, 4)], [5, 4, 3, 2]);
  assert.ok(Math.abs(binding.weights.slice(0, 4).reduce((a, b) => a + b) - 1) < 1e-6);
  assert.deepEqual([...binding.joints.slice(4)], [2, 0, 0, 0]); assert.deepEqual([...binding.weights.slice(4)], [1, 0, 0, 0]);
  input.skeleton.bones[0]!.id = 'edited'; assert.equal(binding.skeleton.bones[0]!.id, 'bone0');
});

test('body rig validation owns vectors and rejects malformed or executable data without invoking getters', () => {
  const input: BodyRig = { ...rig, influences: [{ bone: 'root', center: [0, 0, 0], radius: 1 }], attachments: { head: 'root' } };
  const owned = validateBodyRig(input); input.influences[0]!.center[0] = 2; assert.equal(owned.influences[0]!.center[0], 0);
  for (const value of [
    { ...rig, influences: new Array(1) },
    { ...rig, influences: [{ bone: 'missing', center: [0, 0, 0], radius: 1 }] },
    { ...rig, influences: [{ bone: 'root', center: [0, , 0], radius: 1 }] },
    { ...rig, influences: [{ bone: 'root', center: [0, 0, 0], radius: 0 }] },
    { ...rig, attachments: { head: 'missing' } },
    { ...rig, attachments: { body: 'root' } },
    { ...rig, [Symbol('hidden')]: 1 },
    Object.defineProperty({ ...rig }, 'hidden', { value: 1 }),
    { ...rig, influences: Object.assign([], { extra: 1 }) },
  ]) assert.throws(() => validateBodyRig(value));
  let calls = 0;
  const accessor = Object.defineProperty({ ...rig }, 'influences', { enumerable: true, get() { calls++; return []; } });
  assert.throws(() => validateBodyRig(accessor));
  const center = [0, 0, 0]; Object.defineProperty(center, '1', { enumerable: true, get() { calls++; return 0; } });
  assert.throws(() => validateBodyRig({ ...rig, influences: [{ bone: 'root', center, radius: 1 }] }));
  const vertices = triangle.slice(); Object.defineProperty(vertices, 'length', { get() { calls++; return 18; } });
  assert.throws(() => createBodySkinBinding(vertices, rig)); assert.equal(calls, 0);
});

test('body skin moves the eye chart with the surface and neutral/removal restores exact pixels', () => {
  const f = surface(), renderer = new AvatarRenderer(f.canvas), design = createDesign({ body: { shape: 'circle', color: '#ffffff' }, eyes: { color: '#000000' } });
  renderer.render(design, state()); const neutral = f.pixels, baseline = centroid(neutral, 160), eyes = centroid(neutral, 160, true);
  renderer.render(design, { ...state(), rig }); assert.deepEqual(f.pixels, neutral);
  renderer.render(design, { ...state(), rig, bonePose: { root: { position: [.25, .1, 0] } } });
  const bodyShift = centroid(f.pixels, 160), eyeShift = centroid(f.pixels, 160, true);
  assert.ok(eyeShift[2] > 20); assert.ok(bodyShift[0] - baseline[0] > 6);
  assert.ok(Math.abs((bodyShift[0] - baseline[0]) - (eyeShift[0] - eyes[0])) < 1);
  assert.ok(Math.abs((bodyShift[1] - baseline[1]) - (eyeShift[1] - eyes[1])) < 1);
  renderer.render(design, { ...state(), rig, bonePose: { root: { rotation: [0, Math.PI, 0] } } });
  assert.equal(centroid(f.pixels, 160, true)[2], 0, 'rotated back sheet never receives front-sheet eye ink');
  renderer.render(design, state()); assert.deepEqual(f.pixels, neutral); renderer.dispose();
});

test('body pose channel overlays, new contour topology and depth are deterministic', () => {
  const f = surface(), renderer = new AvatarRenderer(f.canvas), design = createDesign();
  const direct = { root: { position: [.1, 0, 0] as [number, number, number], rotation: [0, 0, .2] as [number, number, number] } };
  renderer.render(design, { ...state(), rig, bonePose: direct }); const expected = f.pixels;
  renderer.render(design, { ...state(), rig, bonePose: { root: { position: [.1, 0, 0] } }, partAnimation: { accessories: {}, bones: { root: { rotation: [0, 0, .2] } } } });
  assert.deepEqual(f.pixels, expected);
  for (const shape of MATERIAL_SHAPE_NAMES) {
    renderer.render(createDesign({ body: { shape } }), { ...state(), rig, bonePose: direct });
    const mesh = privateRenderer(renderer).meshes.body;
    assert.equal(mesh.data.vertices.length, mesh.data.faceVertices!.length);
    assert.ok(mesh.data.vertices.every(Number.isFinite));
  }
  renderer.render(design, { ...state(), rig, bonePose: direct }); assert.deepEqual(f.pixels, expected); renderer.dispose();
});

test('rigged body and local plugin skin upload only changed pose, retain charts, and dispose all buffers', () => {
  const f = countingCanvas(), renderer = new AvatarRenderer(f.canvas), item = plugin(), design = createDesign();
  const frame = { ...state(), rig, pluginAccessories: [item] };
  renderer.render(design, frame); const baseline = f.snapshot();
  assert.equal(renderer.stats.buffers, baseline.liveBuffers);
  for (let i = 0; i < 10; i++) renderer.render(design, { ...frame, rig: structuredClone(rig), bodyOrientation: { yaw: i }, time: i, activity: 'speaking', reduced: false });
  assert.equal(f.snapshot().uploadedBytes, baseline.uploadedBytes);
  renderer.render(design, { ...frame, bonePose: { root: { rotation: [0, 0, .2] } } }); const bodyPose = f.snapshot();
  assert.equal(bodyPose.bufferData, baseline.bufferData); assert.equal(bodyPose.bufferSubData, baseline.bufferSubData + 1);
  renderer.render(design, { ...frame, bonePose: { root: { rotation: [0, 0, .2] } } }); assert.equal(f.snapshot().uploadedBytes, bodyPose.uploadedBytes);
  renderer.render(design, { ...frame, bonePose: { root: { rotation: [0, 0, .2] } }, accessoryBonePoses: { badge: { root: { position: [.1, 0, 0] } } } });
  assert.equal(f.snapshot().bufferSubData, bodyPose.bufferSubData + 1);
  renderer.render(design, state()); assert.equal(f.snapshot().liveBuffers, baseline.liveBuffers - 3);
  renderer.dispose(); assert.equal(f.snapshot().liveBuffers, 0); assert.equal(f.snapshot().liveVAOs, 0);
});

test('plugin bones deform attachment-local mesh before body-bone seating transforms', () => {
  const f = surface(), renderer = new AvatarRenderer(f.canvas), design = createDesign(), item = plugin();
  const calls: { mesh: Mesh; model: Mat4; color: string }[] = [];
  const backend = privateRenderer(renderer).backend, draw = backend.draw.bind(backend);
  backend.draw = (mesh, model, color, count, offset) => { calls.push({ mesh, model, color }); draw(mesh, model, color, count, offset); };
  const activity = { ...activityFrame('still', 0, true), squash: .8 };
  const pose = { root: { rotation: [0, 0, .3] as [number, number, number] } }, accessoryPose = { root: { position: [.1, 0, 0] as [number, number, number] } };
  renderer.render(design, { ...state(), activityFrame: activity, rig: { ...rig, attachments: { eyes: 'root' } }, bonePose: pose, pluginAccessories: [item], accessoryBonePoses: { badge: accessoryPose } });
  const actual = calls.find(call => call.color === '#ff00ff')!;
  assert.deepEqual(actual.mesh.data.vertices, skinVertices(triangle, item.asset.geometry.skin!, accessoryPose));
  const scale: [number, number, number] = [1 / Math.sqrt(activity.squash), activity.squash, 1 / Math.sqrt(activity.squash)];
  const inverse: [number, number, number] = [1 / scale[0], 1 / scale[1], 1 / scale[2]];
  const expected = multiply(multiply(multiply(transform([0, 0, 0], [0, 0, 0], scale), computeBoneMatrices(skeleton, pose).deformation[0]!), transform([0, 0, 0], [0, 0, 0], inverse)), getAccessoryAttachmentFrame(design.body, 'eyes', { squash: activity.squash }).matrix);
  for (let i = 0; i < 16; i++) assert.ok(Math.abs(actual.model[i]! - expected[i]!) < 1e-6, `matrix ${i}`);
  assert.deepEqual(item.asset.geometry.vertices, triangle); renderer.dispose();
});

test('catalog body mounts follow deformation without adding the bind joint position twice', () => {
  const f = surface(), renderer = new AvatarRenderer(f.canvas), design = createDesign({ accessories: [createAccessory('beret')] });
  renderer.render(design, state()); const neutral = f.pixels;
  renderer.render(design, { ...state(), rig: { ...rig, attachments: { head: 'root' } } }); assert.deepEqual(f.pixels, neutral);
  renderer.render(design, { ...state(), rig: { ...rig, attachments: { head: 'root' } }, bonePose: { root: { position: [.2, 0, 0] } } });
  assert.notDeepEqual(f.pixels, neutral); renderer.dispose();
});

test('direct rig snapshots are owned until replaced and unsupported plugin skin combinations reject', () => {
  const f = surface(), renderer = new AvatarRenderer(f.canvas), design = createDesign();
  const snapshot = structuredClone(rig), pose = { root: { rotation: [0, 0, .2] as [number, number, number] } };
  renderer.render(design, { ...state(), rig: snapshot, bonePose: pose }); const expected = f.pixels;
  snapshot.skeleton.bones[0]!.position![0] = .4;
  renderer.render(design, { ...state(), rig: snapshot, bonePose: pose }); assert.deepEqual(f.pixels, expected);
  renderer.render(design, { ...state(), rig: structuredClone(snapshot), bonePose: pose }); assert.notDeepEqual(f.pixels, expected);
  for (const field of ['deformation', 'surfaceConnectors'] as const) {
    const item = plugin(); Object.assign(item.asset.geometry, { [field]: {} });
    assert.throws(() => renderer.render(design, { ...state(), pluginAccessories: [item] }), /Skinned plugin geometry/);
  }
  renderer.dispose();
});
