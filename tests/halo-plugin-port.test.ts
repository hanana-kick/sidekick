import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { AccessoryPluginRegistry } from '../src/core/accessory-plugins.js';
import type { AccessoryPlugin, PluginAccessoryAsset } from '../src/core/accessory-plugins.js';
import { createAccessory, createDesign, MATERIAL_SHAPE_NAMES } from '../src/core/design.js';
import type { MaterialShapeName } from '../src/core/design.js';
import { initialPose } from '../src/core/motion.js';
import { multiply, transform } from '../src/core/math.js';
import { resolveDesign } from '../src/core/resolved-design.js';
import { resolveShapeProfile } from '../src/core/shape-profiles.js';
import { sampleAccessorySurface } from '../src/core/surface.js';
import { fitAccessoryPlugin } from '../src/core/plugin-mount.js';
import { getAccessoryPluginAttachmentFrame } from '../src/core/plugin-attachment.js';
import { ShapeTimeline } from '../src/core/shape-motion.js';
import { samplePartAnimation, validatePartAnimation } from '../src/core/part-animation.js';
import { PluginEquipmentController } from '../src/element/plugin-equipment.js';
import { torus } from '../src/renderer/geometry.js';
import { AvatarRenderer } from '../src/renderer/webgl.js';
import type { RenderState } from '../src/renderer/webgl.js';

// Exercise the external author's public package import without changing a build
// or installing a private source alias into node_modules.
registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(specifier === '@hanana-kick/sidekick-plugin-sdk'
    ? new URL('../src/plugin-sdk.ts', import.meta.url).href : specifier, context);
} });
const { default: halo, createHaloGeometry, haloAttachment } = await import('../examples/plugin-sdk/catalog/halo.js');

const instanceId = 'plugin-halo';
const state = (): RenderState => ({ pose: initialPose(), activity: 'still', time: 0, delta: 0, reduced: true, style: 'flat', instant: true });
const builtinAccessory = () => resolveDesign(createDesign({ accessories: [createAccessory('halo', { id: instanceId })] })).accessories[0]!;
async function loadHalo(): Promise<PluginAccessoryAsset> {
  const registry = new AccessoryPluginRegistry();
  registry.register(halo);
  try { return await registry.load(halo.id); } finally { registry.dispose(); }
}
function equipment(asset: PluginAccessoryAsset) {
  return [{ id: instanceId, slot: 'head' as const, color: createAccessory('halo').color, asset }];
}
function canvasFixture(size = 180) {
  let pixels = new Uint8ClampedArray();
  const canvas = { width: size, height: size, getContext: (kind: string) => kind === 'webgl2' ? null : {
    createImageData: (width: number, height: number) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }),
    putImageData: (image: { data: Uint8ClampedArray }) => { pixels = image.data.slice(); },
  } } as unknown as HTMLCanvasElement;
  const renderer = new AvatarRenderer(canvas);
  renderer.resize(size, size, 1);
  return { renderer, get pixels() { return pixels; } };
}

test('external halo owns its public-SDK torus, original topology and all 35 calibrations', () => {
  const source = readFileSync(new URL('../examples/plugin-sdk/catalog/halo.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /(?:src\/|dist\/|catalogAccessoryGeometry|resolveShapeProfile|sampleAccessorySurface|accessoryMountProfile)/);
  const imports = [...source.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)].map(match => match[1]);
  assert.deepEqual(imports, ['@hanana-kick/sidekick-plugin-sdk']);
  assert.deepEqual(halo.slots, ['head']);
  assert.equal(halo.id, 'catalog/halo');
  const geometry = createHaloGeometry(), original = torus(.055);
  assert.equal(geometry.vertices.length / 6, 539);
  assert.equal(geometry.indices.length / 3, 960);
  assert.deepEqual(geometry.vertices, original.vertices, 'exact original unscaled Float32 vertices and normals');
  assert.deepEqual(geometry.indices, original.indices, 'exact original triangle winding');
  assert.equal(haloAttachment.mode, 'crown-envelope');
  assert.equal(haloAttachment.geometryScale, .34);
  assert.equal(haloAttachment.follow, .5);
  assert.equal(haloAttachment.followAxis, 'y');
  assert.equal(haloAttachment.followSign, -1);
  assert.deepEqual(Object.keys(haloAttachment.mounts).sort(), [...MATERIAL_SHAPE_NAMES].sort());
  assert.deepEqual(JSON.parse(JSON.stringify(haloAttachment)), haloAttachment);
  for (const shape of MATERIAL_SHAPE_NAMES) {
    const mount = resolveShapeProfile(shape).accessories.halo;
    assert.deepEqual(haloAttachment.mounts[shape], { uv: mount.anchor.uv, offset: mount.anchor.offset, rotation: mount.rotation, scale: mount.scale }, shape);
  }
});

test('eager/lazy halo factories deduplicate concurrent avatars and return owned transport data', async () => {
  for (const lazy of [false, true]) {
    const registry = new AccessoryPluginRegistry();
    let builds = 0, loads = 0;
    const counted: AccessoryPlugin = { ...halo, createMesh() { builds++; return halo.createMesh(); } };
    if (lazy) registry.registerLazy(halo.id, async () => { loads++; return { default: counted }; });
    else registry.register(counted);
    assert.equal(builds, 0);
    const avatars = [new PluginEquipmentController(() => {}), new PluginEquipmentController(() => {})];
    try {
      await Promise.all(avatars.map(avatar => avatar.equip(registry, halo.id, { slot: 'head', id: instanceId, color: '#f7cc5b' })));
      assert.equal(builds, 1);
      assert.equal(loads, lazy ? 1 : 0);
      const a = avatars[0]!.instances()[0]!.asset, b = avatars[1]!.instances()[0]!.asset;
      assert.deepEqual(a, b);
      assert.deepEqual(structuredClone(a), a);
      assert.equal('createMesh' in a, false);
      assert.notEqual(a.geometry.vertices.buffer, b.geometry.vertices.buffer);
      a.geometry.vertices[0] = 3;
      a.attachment!.mounts.circle.offset = .1;
      assert.equal(b.geometry.vertices[0], torus(.055).vertices[0]);
      assert.equal(b.attachment!.mounts.circle.offset, .22);
      assert.deepEqual(await registry.load(halo.id), b);
    } finally { registry.dispose(); }
  }
});

function transformedVertices(vertices: Float32Array, matrix: Float32Array) {
  const output = new Float32Array(vertices.length / 2);
  for (let i = 0; i < vertices.length; i += 6) for (let axis = 0; axis < 3; axis++) {
    output[i / 2 + axis] = matrix[axis]! * vertices[i]! + matrix[4 + axis]! * vertices[i + 1]! + matrix[8 + axis]! * vertices[i + 2]! + matrix[12 + axis]!;
  }
  return output;
}
function compareFit(asset: PluginAccessoryAsset, shape: MaterialShapeName, options: Parameters<typeof fitAccessoryPlugin>[2] = {}, profile = resolveShapeProfile(shape)) {
  const body = createDesign({ body: { shape } }).body, original = builtinAccessory();
  const frame = sampleAccessorySurface(body, original, options.squash, options.contour, profile);
  const mount = profile.accessories.halo, rotation = options.rotation ?? [0, 0, 0];
  const expected = multiply(multiply(multiply(frame.matrix, transform([0, 0, 0], rotation)), transform([0, 0, 0], [0, 0, 0], [mount.scale, mount.scale, mount.scale])), transform([0, 0, 0], [0, 0, 0], [.34, .34, .34]));
  const fit = fitAccessoryPlugin(asset, body, options);
  for (const key of ['position', 'normal', 'tangent', 'bitangent', 'matrix'] as const) {
    assert.deepEqual(fit.frame[key], frame[key], `${shape}: exact crown envelope ${key}`);
  }
  assert.deepEqual(fit.matrix, expected, `${shape}: exact draw matrix and postscale`);
  const actual = transformedVertices(asset.geometry.vertices, fit.matrix);
  assert.deepEqual(actual, transformedVertices(torus(.055).vertices, expected), `${shape}: exact CPU transformed vertices`);
  assert.equal(fit.seating, 0, 'floating geometry does not run the front contact solver');
  const publicFrame = getAccessoryPluginAttachmentFrame(body, asset.attachment!, options);
  assert.deepEqual(publicFrame.position, frame.position);
  assert.deepEqual(publicFrame.matrix, frame.matrix);
  assert.equal(publicFrame.scale, mount.scale * .34);
  return actual;
}

test('halo crown-envelope fits retain exact CPU vertices through all shapes, squash and authored rotation', async () => {
  const asset = await loadHalo();
  for (const shape of MATERIAL_SHAPE_NAMES) compareFit(asset, shape);
  for (const shape of ['circle', 'square', 'heart', 'boom'] as const) for (const squash of [.88, 1, 1.12]) {
    compareFit(asset, shape, { squash, rotation: [.10, -.13, .17] });
  }
});

test('halo interrupted morph follows the exact visible top envelope and blended clearance', async () => {
  const asset = await loadHalo(), timeline = new ShapeTimeline('circle');
  const compare = () => {
    const snapshot = timeline.snapshot;
    return compareFit(asset, timeline.target, { contour: snapshot.contour, depth: snapshot.profile.depth, shapeWeights: snapshot.shapeWeights, squash: .94, rotation: [.1, -.06, .12] }, snapshot.profile);
  };
  const first = timeline.to('boom', { duration: 1000, easing: 'linear' });
  timeline.advance(377);
  const before = compare(), snapshot = timeline.snapshot;
  const second = timeline.to('heart', { duration: 600, easing: 'smooth' });
  assert.deepEqual(await first, { finished: false });
  assert.equal(timeline.snapshot, snapshot);
  assert.deepEqual(compare(), before, 'retargeting retains the exact visible mesh');
  timeline.advance(.001);
  const resumed = compare();
  assert.ok(resumed.every((value, i) => Math.abs(value - before[i]!) < .000001), 'first resumed frame is continuous');
  timeline.advance(249.999);
  compare();
  timeline.finish();
  assert.deepEqual(await second, { finished: true });
  compare();
});

test('halo matches original Canvas pixels under shapes, squash, body orientation and cloned transport', async () => {
  const asset = await loadHalo(), port = canvasFixture(), reference = canvasFixture(), clone = canvasFixture();
  try {
    for (const shape of ['circle', 'square', 'heart', 'boom'] as const) for (const squash of [.88, 1, 1.12]) {
      const base = createDesign({ body: { shape } });
      const original = createDesign({ body: { shape }, accessories: [createAccessory('halo', { id: instanceId })] });
      const shared = { ...state(), bodyOrientation: { yaw: 29, pitch: -8 }, activityFrame: { bob: 0, roll: 0, squash, gaze: [0, 0] as [number, number], blink: 1 } };
      const pluginState = { ...shared, pluginAccessories: equipment(asset) };
      port.renderer.render(base, pluginState);
      reference.renderer.render(original, shared);
      clone.renderer.render(base, structuredClone(pluginState));
      assert.deepEqual(port.pixels, reference.pixels, `${shape}/${squash}: exact original pixels`);
      assert.deepEqual(port.pixels, clone.pixels, `${shape}/${squash}: structured clone`);
      assert.ok(port.pixels.some((value, i) => i % 4 === 0 && value === 247 && port.pixels[i + 1] === 204 && port.pixels[i + 2] === 91), 'original gold halo is visible');
    }
  } finally { port.renderer.dispose(); reference.renderer.dispose(); clone.renderer.dispose(); }
});

test('halo preserves exact Canvas animation, seeking and interrupted-morph pixels', async () => {
  const asset = await loadHalo(), port = canvasFixture(), reference = canvasFixture();
  const clip = validatePartAnimation({ duration: 2, tracks: [
    { target: { accessory: instanceId }, channel: 'position', keyframes: [{ time: 0, value: [0, 0, 0] }, { time: 2, value: [.08, .03, -.02] }] },
    { target: { accessory: instanceId }, channel: 'rotation', keyframes: [{ time: 0, value: [0, 0, -.08] }, { time: 2, value: [.18, -.14, .16] }] },
    { target: { accessory: instanceId }, channel: 'scale', keyframes: [{ time: 0, value: [1, 1, 1] }, { time: 2, value: [.85, 1.12, .96] }] },
    { target: { accessory: instanceId }, channel: 'opacity', keyframes: [{ time: 0, value: 1 }, { time: 2, value: .65 }] },
  ] });
  const render = (shape: MaterialShapeName, shared: RenderState) => {
    port.renderer.render(createDesign({ body: { shape } }), { ...shared, pluginAccessories: equipment(asset) });
    reference.renderer.render(createDesign({ body: { shape }, accessories: [createAccessory('halo', { id: instanceId })] }), shared);
    assert.deepEqual(port.pixels, reference.pixels, `${shape}: exact animated pixels`);
    return port.pixels;
  };
  try {
    for (const shape of ['circle', 'square', 'heart'] as const) {
      const at = (time: number) => render(shape, { ...state(), bodyOrientation: { yaw: 23 }, partAnimation: samplePartAnimation(clip, time) });
      const before = at(.25);
      assert.notDeepEqual(at(1.5), before, 'independent halo motion changes its pixels');
      assert.deepEqual(at(.25), before, 'seeking restores exact pixels');
    }
    const timeline = new ShapeTimeline('circle');
    void timeline.to('boom', { duration: 1000, easing: 'linear' });
    timeline.advance(377);
    const current = () => render(timeline.target, { ...state(), contour: timeline.contour, profile: timeline.profile, shapeWeights: timeline.snapshot.shapeWeights, bodyOrientation: { yaw: 23 }, partAnimation: samplePartAnimation(clip, .75) });
    const before = current();
    void timeline.to('heart', { duration: 600 });
    assert.deepEqual(current(), before, 'interruption preserves visible pixels');
    timeline.advance(250); current(); timeline.finish(); current();
  } finally { port.renderer.dispose(); reference.renderer.dispose(); }
});

test('halo inertial following rotates around negative local Y just like the original', async () => {
  const asset = await loadHalo(), port = canvasFixture(), reference = canvasFixture();
  try {
    const original = createDesign({ body: { shape: 'heart' }, accessories: [createAccessory('halo', { id: instanceId })] });
    for (const roll of [0, .35, .35, -.25, -.25, .18]) {
      const shared = state();
      shared.reduced = false; shared.delta = 1 / 60; shared.pose.rotation = [.07, -.13, roll];
      shared.pose.accessories[instanceId] = [.05, .03, -.04];
      port.renderer.render(createDesign({ body: { shape: 'heart' } }), { ...shared, pluginAccessories: equipment(asset) });
      reference.renderer.render(original, shared);
      assert.deepEqual(port.pixels, reference.pixels, `roll ${roll}: exact inertial follow pixels`);
    }
  } finally { port.renderer.dispose(); reference.renderer.dispose(); }
});

test('halo uploads once, animates without mesh uploads and releases its buffers on removal', async () => {
  const { countingCanvas } = await import('./performance-fixture.mjs');
  const asset = await loadHalo(), fixture = countingCanvas(), renderer = new AvatarRenderer(fixture.canvas);
  const shared = { ...state(), pluginAccessories: equipment(asset) };
  try {
    renderer.render(createDesign(), shared);
    const before = fixture.snapshot();
    for (let i = 0; i < 12; i++) renderer.render(createDesign(), { ...shared, bodyOrientation: { yaw: i * 3 }, partAnimation: { accessories: { [instanceId]: { rotation: [i * .01, -.1, .03], position: [.01, .02, .03] } } } });
    const after = fixture.snapshot();
    assert.equal(after.uploadedBytes, before.uploadedBytes);
    assert.equal(after.liveBuffers, before.liveBuffers);
    renderer.render(createDesign(), state());
    assert.equal(fixture.snapshot().liveBuffers, after.liveBuffers - 2);
  } finally { renderer.dispose(); }
  assert.equal(fixture.snapshot().liveBuffers, 0);
});
