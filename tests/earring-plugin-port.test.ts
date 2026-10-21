import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { AccessoryPluginRegistry } from '../src/core/accessory-plugins.js';
import type { AccessoryPlugin, PluginAccessoryAsset } from '../src/core/accessory-plugins.js';
import { createDesign, createAccessory, MATERIAL_SHAPE_NAMES } from '../src/core/design.js';
import type { MaterialShapeName, Vec3 } from '../src/core/design.js';
import { resolveDesign } from '../src/core/resolved-design.js';
import { resolveShapeProfile } from '../src/core/shape-profiles.js';
import { fitAccessoryPlugin, resolveAccessoryPluginMount } from '../src/core/plugin-mount.js';
import { ShapeTimeline } from '../src/core/shape-motion.js';
import { initialPose } from '../src/core/motion.js';
import { samplePartAnimation } from '../src/core/part-animation.js';
import { PluginEquipmentController } from '../src/element/plugin-equipment.js';
import type { PluginAccessoryInstance } from '../src/element/plugin-equipment.js';
import { catalogAccessoryGeometry } from '../src/renderer/catalog-accessory-geometry.js';
import { AvatarRenderer } from '../src/renderer/webgl.js';
import type { RenderState } from '../src/renderer/webgl.js';

// Public SDK resolution is isolated to this test process, without touching an
// installed package or generated build. Release tests cover real installations.
registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(specifier === '@hanana-kick/sidekick-plugin-sdk' ? new URL('../src/plugin-sdk.ts', import.meta.url).href : specifier, context);
} });
const { leftEarring, rightEarring, earringAnimation } = await import('../examples/plugin-sdk/catalog/earring.js');
const definitions: readonly { plugin: AccessoryPlugin; slot: 'leftEar' | 'rightEar'; key: 'leftEarring' | 'rightEarring'; instance: string; side: -1 | 1 }[] = [
  { plugin: leftEarring, slot: 'leftEar', key: 'leftEarring', instance: 'plugin-earring-left', side: -1 },
  { plugin: rightEarring, slot: 'rightEar', key: 'rightEarring', instance: 'plugin-earring-right', side: 1 },
];
async function loadAssets(): Promise<PluginAccessoryAsset[]> {
  const registry = new AccessoryPluginRegistry();
  definitions.forEach(({ plugin }) => registry.register(plugin));
  try { return await Promise.all(definitions.map(({ plugin }) => registry.load(plugin.id))); }
  finally { registry.dispose(); }
}
function instances(assets: PluginAccessoryAsset[]): PluginAccessoryInstance[] {
  return definitions.map(({ slot, instance }, i) => ({ id: instance, slot, color: '#f7cc5b', asset: assets[i]! }));
}
function canvasFixture(size = 300) {
  let pixels = new Uint8ClampedArray();
  const canvas = { width: size, height: size, getContext: (type: string) => type === 'webgl2' ? null : {
    createImageData: (width: number, height: number) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }),
    putImageData: (image: { data: Uint8ClampedArray }) => { pixels = image.data.slice(); },
  } } as unknown as HTMLCanvasElement;
  const renderer = new AvatarRenderer(canvas); renderer.resize(size, size, 1);
  return { renderer, get pixels() { return pixels; } };
}
const state = (): RenderState => ({ pose: initialPose(), activity: 'still', time: 0, delta: 0, reduced: true, style: 'flat', instant: true });
function assertNear(actual: ArrayLike<number>, expected: ArrayLike<number>, label: string, tolerance = 1e-6) {
  assert.equal(actual.length, expected.length, `${label}: component count`);
  let error = 0;
  for (let i = 0; i < actual.length; i++) {
    assert.ok(Number.isFinite(actual[i]!), `${label}: finite component ${i}`);
    error = Math.max(error, Math.abs(actual[i]! - expected[i]!));
  }
  assert.ok(error <= tolerance, `${label}: maximum error ${error}, tolerance ${tolerance}`);
}
function reference(shape: MaterialShapeName, slot: 'leftEar' | 'rightEar', options: Parameters<typeof fitAccessoryPlugin>[2] = {}, profile = resolveShapeProfile(shape)) {
  const design = createDesign({ body: { shape }, accessories: [createAccessory('earring', { slot })] });
  return catalogAccessoryGeometry(design.body, resolveDesign(design).accessories[0]!, options?.squash, options?.contour, profile, options?.rotation);
}
function compareFit(asset: PluginAccessoryAsset, shape: MaterialShapeName, slot: 'leftEar' | 'rightEar', options: Parameters<typeof fitAccessoryPlugin>[2] = {}, profile = resolveShapeProfile(shape)) {
  const fit = fitAccessoryPlugin(asset, createDesign({ body: { shape } }).body, options), original = reference(shape, slot, options, profile);
  assert.ok(fit.geometry, 'Surface connector produces a complete fitted body-local mesh');
  assert.deepEqual(fit.geometry.indices, original.indices, `${shape}/${slot}: exact rigid+wire topology`);
  const rigidVertices = asset.geometry.vertices.length;
  for (const [name, offset, end] of [['rigid', 0, rigidVertices], ['connector', rigidVertices, fit.geometry.vertices.length]] as const) {
    const actualPositions: number[] = [], expectedPositions: number[] = [], actualNormals: number[] = [], expectedNormals: number[] = [];
    for (let i = offset; i < end; i += 6) {
      actualPositions.push(...fit.geometry.vertices.subarray(i, i + 3));
      expectedPositions.push(...original.vertices.subarray(i, i + 3));
      actualNormals.push(...fit.geometry.vertices.subarray(i + 3, i + 6));
      expectedNormals.push(...original.vertices.subarray(i + 3, i + 6));
    }
    assertNear(actualPositions, expectedPositions, `${shape}/${slot}/${name}: positions`);
    assertNear(actualNormals, expectedNormals, `${shape}/${slot}/${name}: normals`);
  }
  assertNear(fit.frame.position, original.attachment, `${shape}/${slot}: attachment`, 1e-12);
  assertNear([fit.seating], [original.seating], `${shape}/${slot}: seating`, 1e-7);
  return fit.geometry.vertices;
}

test('earring author modules use the public SDK, own all 35 mirrored calibrations, and retain original rigid topology', async () => {
  for (const name of ['earring.js', 'earring-geometry.js']) {
    const source = readFileSync(new URL(`../examples/plugin-sdk/catalog/${name}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /(?:src\/|dist\/|catalogAccessoryGeometry|resolveShapeProfile|sampleAccessorySurface)/);
    for (const match of source.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)) assert.ok(match[1] === '@hanana-kick/sidekick-plugin-sdk' || /^\.\/earring-geometry\.js$/.test(match[1]!));
    assert.match(source, /Sidekick Library and Character License 1\.0/);
  }
  const assets = await loadAssets();
  for (const [{ plugin, slot, key, side }, i] of definitions.map((definition, i) => [definition, i] as const)) {
    const attachment = plugin.attachment!;
    assert.deepEqual(plugin.slots, [slot]);
    assert.equal(attachment.mode, 'perimeter-front');
    assert.equal(attachment.region, side < 0 ? 'left' : 'right');
    assert.equal(attachment.perimeterInset, .96);
    assert.equal(attachment.containmentClearance, .006);
    assert.equal(attachment.follow, .35);
    assert.deepEqual(Object.keys(attachment.mounts).sort(), [...MATERIAL_SHAPE_NAMES].sort());
    assert.deepEqual(JSON.parse(JSON.stringify(attachment)), attachment);
    for (const shape of MATERIAL_SHAPE_NAMES) {
      const original = resolveShapeProfile(shape).accessories[key];
      assert.deepEqual(attachment.mounts[shape], { uv: original.anchor.uv, offset: original.anchor.offset, rotation: original.rotation, scale: original.scale }, `${shape}/${slot}`);
    }
    const geometry = assets[i]!.geometry;
    assert.equal(geometry.vertices.length / 6, 296);
    assert.equal(geometry.indices.length / 3, 588);
    assert.deepEqual(geometry.indices, reference('circle', slot).indices.subarray(0, geometry.indices.length));
    assert.deepEqual(geometry.surfaceConnectors, [{ kind: 'surface-tube', to: [side * .044, -.006, .012], radius: .0085, rings: 8, sides: 8, clearance: .002 }]);
    assert.deepEqual(structuredClone(assets[i]), assets[i]);
  }
});

test('original hoop, drop and body-following connector match on every catalog shape and both ear slots', async () => {
  const assets = await loadAssets();
  for (const shape of MATERIAL_SHAPE_NAMES) for (let i = 0; i < definitions.length; i++) {
    const vertices = compareFit(assets[i]!, shape, definitions[i]!.slot);
    assert.equal(vertices.length / 6, 362, `${shape}: original rigid and appended connector vertices`);
  }
});

test('earring fitting preserves original squash and local rotation geometry on representative bodies', async () => {
  const assets = await loadAssets();
  for (const shape of ['circle', 'square', 'heart'] as const) for (const squash of [.88, 1.12]) for (let i = 0; i < definitions.length; i++) {
    compareFit(assets[i]!, shape, definitions[i]!.slot, { squash, rotation: [.08, -.06, .12] });
  }
});

test('interrupted earring morphs preserve both exact visible fits and independently authored shape provenance', async () => {
  const assets = await loadAssets(), timeline = new ShapeTimeline('circle');
  const compare = () => definitions.map(({ slot, key }, i) => {
    const current = timeline.snapshot, options = { contour: current.contour, depth: current.profile.depth, shapeWeights: current.shapeWeights };
    const mount = resolveAccessoryPluginMount(assets[i]!.attachment!, timeline.target, current.shapeWeights);
    const original = current.profile.accessories[key];
    assertNear(mount.uv, original.anchor.uv, `${slot}: interpolated UV`, 1e-12);
    assertNear(mount.rotation, original.rotation, `${slot}: interpolated rotation`, 1e-12);
    assertNear([mount.scale], [original.scale], `${slot}: interpolated scale`, 1e-12);
    return compareFit(assets[i]!, timeline.target, slot, options, current.profile);
  });
  const first = timeline.to('square', { duration: 1000, easing: 'linear' }); timeline.advance(377);
  const visible = timeline.snapshot, before = compare();
  const second = timeline.to('heart', { duration: 600, easing: 'smooth' });
  assert.deepEqual(await first, { finished: false }); assert.strictEqual(timeline.snapshot, visible); assert.deepEqual(compare(), before);
  timeline.advance(.001);
  compare().forEach((vertices, i) => assertNear(vertices, before[i]!, 'No interrupted connector jump', 1e-5));
  timeline.advance(249.999); compare();
  timeline.finish(); assert.deepEqual(await second, { finished: true }); compare();
});

test('mirrored earrings share eager/lazy loads across avatars but clone their connectors and calibration', async () => {
  for (const lazy of [false, true]) {
    const registry = new AccessoryPluginRegistry(), builds = [0, 0], loads = [0, 0];
    for (const [{ plugin }, i] of definitions.map((definition, i) => [definition, i] as const)) {
      const definition = { ...plugin, createMesh() { builds[i]!++; return plugin.createMesh(); } };
      if (lazy) registry.registerLazy(plugin.id, async () => { loads[i]!++; return { default: definition }; });
      else registry.register(definition);
    }
    const avatars = [new PluginEquipmentController(() => {}), new PluginEquipmentController(() => {})];
    try {
      assert.deepEqual(builds, [0, 0]);
      await Promise.all(avatars.flatMap(avatar => definitions.map(({ plugin, slot, instance }) => avatar.equip(registry, plugin.id, { slot, id: instance, color: '#f7cc5b' }))));
      assert.deepEqual(builds, [1, 1]); assert.deepEqual(loads, lazy ? [1, 1] : [0, 0]);
      const first = avatars[0]!.instances(), second = avatars[1]!.instances();
      assert.deepEqual(first, second);
      assert.notEqual(first[0]!.asset.geometry.vertices.buffer, second[0]!.asset.geometry.vertices.buffer);
      first[0]!.asset.geometry.surfaceConnectors![0]!.to[0] = 1;
      first[1]!.asset.attachment!.mounts.circle.scale = 5;
      assert.equal(second[0]!.asset.geometry.surfaceConnectors![0]!.to[0], -.044);
      assert.equal(second[1]!.asset.attachment!.mounts.circle.scale, 1);
      assert.equal((await registry.load(leftEarring.id)).geometry.surfaceConnectors![0]!.to[0], -.044);
    } finally { registry.dispose(); }
  }
});

test('real mirrored earrings render original pixels through clone transport and independent seekable animation', async () => {
  const pluginAccessories = instances(await loadAssets()), port = canvasFixture(), reference = canvasFixture(), independent = canvasFixture();
  try {
    for (const shape of ['circle', 'square', 'heart'] as const) {
      const design = createDesign({ body: { shape } });
      const original = createDesign({ body: { shape }, accessories: definitions.map(({ slot, instance }) => createAccessory('earring', { slot, id: instance })) });
      const neutral = { ...state(), pluginAccessories };
      port.renderer.render(design, neutral); reference.renderer.render(original, state()); independent.renderer.render(design, structuredClone(neutral));
      assert.deepEqual(port.pixels, reference.pixels, `${shape}: exact original earring pixels`);
      assert.deepEqual(independent.pixels, port.pixels, `${shape}: cloned geometry/connector transport`);
      const unaffected = independent.pixels;
      for (const time of [.25, 1.25]) {
        const partAnimation = samplePartAnimation(earringAnimation, time);
        port.renderer.render(design, { ...neutral, partAnimation }); reference.renderer.render(original, { ...state(), partAnimation });
        assert.deepEqual(port.pixels, reference.pixels, `${shape}/${time}: original animated connector pixels`);
      }
      const later = port.pixels;
      port.renderer.render(design, { ...neutral, partAnimation: samplePartAnimation(earringAnimation, .25) }); const earlier = port.pixels;
      assert.notDeepEqual(earlier, later, `${shape}: animation visibly moves both earrings`);
      port.renderer.render(design, { ...neutral, partAnimation: samplePartAnimation(earringAnimation, 1.25) }); assert.deepEqual(port.pixels, later);
      assert.deepEqual(independent.pixels, unaffected);
      port.renderer.render(design, state()); independent.renderer.render(design, state()); assert.deepEqual(port.pixels, independent.pixels);
    }
  } finally { port.renderer.dispose(); reference.renderer.dispose(); independent.renderer.dispose(); }
});

test('combined nonzero TRS and opacity preserve original public-slot post-seating behavior for both ears', async () => {
  const pluginAccessories = instances(await loadAssets()), port = canvasFixture(), reference = canvasFixture();
  const partAnimation = { accessories: {
    'plugin-earring-left': { position: [.012, .008, .014] as Vec3, rotation: [.05, -.03, .10] as Vec3, scale: [1.04, .96, 1.02] as Vec3, opacity: .75 },
    'plugin-earring-right': { position: [-.010, .012, .018] as Vec3, rotation: [-.04, .02, -.13] as Vec3, scale: [.96, 1.03, 1.02] as Vec3, opacity: .85 },
  } };
  try {
    for (const shape of ['circle', 'square', 'heart'] as const) for (const yaw of [0, 29]) {
      const design = createDesign({ body: { shape } });
      const original = createDesign({ body: { shape }, accessories: definitions.map(({ slot, instance }) => createAccessory('earring', { slot, id: instance })) });
      const shared = { ...state(), bodyOrientation: { yaw }, partAnimation };
      port.renderer.render(design, { ...shared, pluginAccessories }); reference.renderer.render(original, shared);
      assert.deepEqual(port.pixels, reference.pixels, `${shape}/${yaw}: exact original earring TRS pixels`);
    }
  } finally { port.renderer.dispose(); reference.renderer.dispose(); }
});

test('surface-connector caches reuse unchanged geometry and release buffers when the two ear slots are removed', async () => {
  const { countingCanvas } = await import('./performance-fixture.mjs');
  const fixture = countingCanvas(), renderer = new AvatarRenderer(fixture.canvas), assets = await loadAssets(), beforeAssets = structuredClone(assets);
  const design = createDesign(), pluginAccessories = instances(assets), initial = { ...state(), pluginAccessories };
  try {
    renderer.render(design, initial); const before = fixture.snapshot();
    for (let i = 0; i < 6; i++) renderer.render(design, { ...initial, bodyOrientation: { yaw: i * 5 } });
    assert.equal(fixture.snapshot().uploadedBytes, before.uploadedBytes, 'Whole-body orientation does not rebuild body-local wire geometry');
    assert.equal(fixture.snapshot().liveBuffers, before.liveBuffers);
    renderer.render(design, { ...initial, partAnimation: samplePartAnimation(earringAnimation, .25) });
    assert.ok(fixture.snapshot().uploadedBytes > before.uploadedBytes, 'Local rotation updates the fitted wire');
    assert.equal(fixture.snapshot().liveBuffers, before.liveBuffers, 'Wire updates reuse buffers');
    assert.deepEqual(assets, beforeAssets, 'Renderer never mutates registry payloads');
    renderer.render(design, state());
    assert.equal(fixture.snapshot().liveBuffers, before.liveBuffers - 4, 'Removing two slots releases both vertex/index pairs');
  } finally { renderer.dispose(); }
  assert.equal(fixture.snapshot().liveBuffers, 0);
});
