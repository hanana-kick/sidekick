import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { createDesign, createAccessory, MATERIAL_SHAPE_NAMES } from '../src/core/design.js';
import type { Vec3 } from '../src/core/design.js';
import { resolveDesign } from '../src/core/resolved-design.js';
import { AccessoryPluginRegistry } from '../src/core/accessory-plugins.js';
import { fitAccessoryPlugin, AccessoryPluginFitter } from '../src/core/plugin-mount.js';
import { resolveShapeProfile } from '../src/core/shape-profiles.js';
import { ShapeTimeline } from '../src/core/shape-motion.js';
import { getAccessoryPluginEyeMeasurements } from '../src/core/plugin-eye-measurements.js';
import { initialPose } from '../src/core/motion.js';
import { transform } from '../src/core/math.js';
import { projectEyes } from '../src/renderer/eye-projection.js';
import { glassesGeometry } from '../src/renderer/glasses-geometry.js';
import { AvatarRenderer } from '../src/renderer/webgl.js';
import type { RenderState } from '../src/renderer/webgl.js';
registerHooks({ resolve(specifier, context, next) {
  return next(specifier === '@hanana-kick/sidekick-plugin-sdk' ? new URL('../src/plugin-sdk.ts', import.meta.url).href : specifier, context);
} });
const { default: plugin } = await import('../examples/plugin-sdk/catalog/glasses.js');
async function asset() { const registry = new AccessoryPluginRegistry(); registry.register(plugin); const value = await registry.load(plugin.id); registry.dispose(); return value; }
function near(a: ArrayLike<number>, b: ArrayLike<number>, label: string) {
  assert.equal(a.length, b.length, label);
  let positionError = 0, normalError = 0;
  for (let i = 0; i < a.length; i++) {
    assert.ok(Number.isFinite(a[i]!), label);
    const delta = Math.abs(a[i]! - b[i]!);
    if (i % 6 < 3) positionError = Math.max(positionError, delta);
    else normalError = Math.max(normalError, delta);
  }
  for (let i = 0; i < a.length; i += 6) {
    assert.ok(Math.abs(Math.hypot(a[i + 3]!, a[i + 4]!, a[i + 5]!) - 1) <= 1e-6, `${label}: unit normal at vertex ${i / 6}`);
  }
  // Equivalent affine bridge evaluation can round one Float32 position ULP
  // differently after rotation; short triangles amplify that in their normals.
  // Raster output remains subject to the separate exact-pixel comparison below.
  assert.ok(positionError <= 1e-7, `${label}: position error ${positionError}`);
  assert.ok(normalError <= 1e-5, `${label}: normal error ${normalError}`);
}
function fixture() {
  let pixels = new Uint8ClampedArray();
  const canvas = { width: 240, height: 240, getContext: (kind: string) => kind === 'webgl2' ? null : {
    createImageData: (width: number, height: number) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }),
    putImageData: (image: { data: Uint8ClampedArray }) => { pixels = image.data.slice(); },
  } } as unknown as HTMLCanvasElement;
  const renderer = new AvatarRenderer(canvas); renderer.resize(240, 240, 1);
  return { renderer, get pixels() { return pixels; } };
}
const state = (): RenderState => ({ pose: initialPose(), activity: 'still', time: 0, delta: 0, reduced: true, style: 'flat', instant: true });

test('public SDK glasses preserve authored topology, every mount and shared eager/lazy ownership', async () => {
  const value = await asset(); assert.equal(value.geometry.vertices.length / 6, 1395); assert.equal(value.geometry.indices.length / 3, 2432);
  for (const shape of MATERIAL_SHAPE_NAMES) {
    const mount = resolveShapeProfile(shape).accessories.glasses;
    assert.deepEqual(plugin.attachment.mounts[shape], { uv: mount.anchor.uv, offset: mount.anchor.offset, rotation: mount.rotation, scale: mount.scale });
  }
  let calls = 0; const registry = new AccessoryPluginRegistry();
  registry.registerLazy(plugin.id, async () => { calls++; return plugin; });
  const [a, b] = await Promise.all([registry.load(plugin.id), registry.load(plugin.id)]);
  assert.equal(calls, 1); assert.notEqual(a.geometry.vertices, b.geometry.vertices); assert.notEqual(a.geometry.deformation, b.geometry.deformation);
  assert.deepEqual(structuredClone(a), a); registry.dispose();
});

test('eye measurements drive the original rigid front through shape, face, squash and rotation', async () => {
  const value = await asset();
  for (const shape of MATERIAL_SHAPE_NAMES) for (const squash of [.88, 1, 1.12]) for (const rotation of [[0, 0, 0], [.1, -.12, .16]] as Vec3[]) {
    const design = resolveDesign(createDesign({ body: { shape }, accessories: [createAccessory('glasses')] }));
    const face: [number, number] = [.02, -.01]; const eyes = projectEyes(design, transform([0, 0, 0], [0, 0, 0]), face, [0, 0], squash);
    const reference = glassesGeometry(design, design.accessories[0]!, eyes, squash, undefined, undefined, rotation);
    const result = fitAccessoryPlugin(value, design.body, { squash, rotation, eyes: getAccessoryPluginEyeMeasurements(createDesign({ body: { shape } }), { face, squash }) });
    assert.ok(result.geometry); near(result.geometry!.vertices, reference.vertices, `${shape}/${squash}/${rotation}`); assert.deepEqual(result.geometry!.indices, reference.indices);
  }
});

test('interrupted morph keeps paired geometry continuous and identical to original', async () => {
  const value = await asset(), timeline = new ShapeTimeline('heart'), fitter = new AccessoryPluginFitter(value);
  void timeline.to('boom', { duration: 1000 }); timeline.advance(350);
  const sample = () => {
    const snapshot = timeline.snapshot, design = resolveDesign(createDesign({ body: { shape: 'circle' }, accessories: [createAccessory('glasses')] }));
    const eyes = projectEyes(design, transform([0, 0, 0], [0, 0, 0]), [0, 0], [0, 0], 1, snapshot.contour, snapshot.profile);
    const result = fitter.sample(design.body, { contour: snapshot.contour, depth: snapshot.profile.depth, shapeWeights: snapshot.shapeWeights, eyes: getAccessoryPluginEyeMeasurements(createDesign({ body: { shape: 'circle' } }), { contour: snapshot.contour, profile: snapshot.profile }) });
    const reference = glassesGeometry(design, design.accessories[0]!, eyes, 1, snapshot.contour, snapshot.profile);
    near(result.geometry!.vertices, reference.vertices, 'morph geometry'); return result.geometry!.vertices.slice();
  };
  const before = sample(); void timeline.to('pixelTriangle', { duration: 1000 }); assert.deepEqual(sample(), before);
  timeline.advance(250); sample(); timeline.advance(750); sample();
});

test('external glasses match Canvas pixels with face following and explicit independent transforms', async () => {
  const value = await asset(), builtin = fixture(), external = fixture();
  try {
    for (const shape of ['circle', 'square', 'heart', 'pixelTriangle'] as const) for (const yaw of [0, 29]) {
      const base = createDesign({ body: { shape }, accessories: [] });
      const reference = createDesign({ body: { shape }, accessories: [{ ...createAccessory('glasses', { id: 'reference' }), color: '#5830b7' }] });
      const render = state(); render.pose.face = [.02, -.01]; render.bodyOrientation = { yaw, pitch: 0, roll: 0 };
      const part = { rotation: [.04, -.06, .09] as Vec3, position: [.01, -.02, .01] as Vec3, scale: [1.04, .96, 1.02] as Vec3, opacity: .8 };
      builtin.renderer.render(reference, { ...render, partAnimation: { accessories: { reference: part } } });
      external.renderer.render(base, { ...render, pluginAccessories: [{ id: 'plugin-glasses', slot: 'eyes', color: '#5830b7', asset: value }], partAnimation: { accessories: { 'plugin-glasses': part } } });
      assert.deepEqual(external.pixels, builtin.pixels, `${shape}/${yaw}`);
    }
  } finally { builtin.renderer.dispose(); external.renderer.dispose(); }
});
