import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { registerHooks } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
import { AccessoryPluginRegistry } from '../src/core/accessory-plugins.js';
import type { AccessoryPlugin, PluginAccessoryAsset } from '../src/core/accessory-plugins.js';
import { createDesign, createAccessory, MATERIAL_SHAPE_NAMES } from '../src/core/design.js';
import type { MaterialShapeName, Vec3 } from '../src/core/design.js';
import { resolveDesign } from '../src/core/resolved-design.js';
import { resolveShapeProfile } from '../src/core/shape-profiles.js';
import { fitAccessoryPlugin, resolveAccessoryPluginMount, accessoryPluginMaterialColor } from '../src/core/plugin-mount.js';
import { ShapeTimeline } from '../src/core/shape-motion.js';
import { initialPose } from '../src/core/motion.js';
import { samplePartAnimation } from '../src/core/part-animation.js';
import { PluginEquipmentController } from '../src/element/plugin-equipment.js';
import type { PluginAccessoryInstance } from '../src/element/plugin-equipment.js';
import { catalogAccessoryGeometry, accessoryDetailColor } from '../src/renderer/catalog-accessory-geometry.js';
import { AvatarRenderer } from '../src/renderer/webgl.js';
import type { RenderState } from '../src/renderer/webgl.js';

// Resolve the *public* author package to its source entry in this isolated test
// process. The shipped-package install test separately validates release exports.
// No node_modules link or generated distribution is changed by this suite.
const publicEntries = {
  '@hanana-kick/sidekick-plugin-sdk': new URL('../src/plugin-sdk.ts', import.meta.url).href,
  '@hanana-kick/sidekick/core': new URL('../src/core.ts', import.meta.url).href,
};
registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(publicEntries[specifier as keyof typeof publicEntries] ?? specifier, context);
} });
const { default: moustache } = await import('../examples/plugin-sdk/catalog/moustache.js');
const { default: bowTie } = await import('../examples/plugin-sdk/catalog/bow-tie.js');
const { catalogAccessoryAnimation } = await import('../examples/plugin-sdk/catalog/animation.js');
const integration = await import('../examples/plugin-sdk/catalog/integration.js');
const { createEagerCatalogRegistry } = await import('../examples/plugin-sdk/catalog/eager-integration.js');
const { createLazyCatalogRegistry } = await import('../examples/plugin-sdk/catalog/lazy-integration.js');
const definitions: readonly { plugin: AccessoryPlugin; preset: 'moustache' | 'bowTie'; instance: string }[] = [
  { plugin: moustache, preset: 'moustache', instance: 'plugin-moustache' },
  { plugin: bowTie, preset: 'bowTie', instance: 'plugin-bow-tie' },
];

function canvasFixture(size = 240) {
  let pixels = new Uint8ClampedArray();
  const canvas = {
    width: size, height: size,
    getContext: (type: string) => type === 'webgl2' ? null : {
      createImageData: (width: number, height: number) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }),
      putImageData: (image: { data: Uint8ClampedArray }) => { pixels = image.data.slice(); },
    },
  } as unknown as HTMLCanvasElement;
  const renderer = new AvatarRenderer(canvas);
  renderer.resize(size, size, 1);
  return { renderer, get pixels() { return pixels; } };
}
const state = (): RenderState => ({ pose: initialPose(), activity: 'still', time: 0, delta: 0, reduced: true, style: 'flat', instant: true });
async function loadAssets(): Promise<PluginAccessoryAsset[]> {
  const registry = createEagerCatalogRegistry();
  try { return await Promise.all(definitions.map(({ plugin }) => registry.load(plugin.id))); }
  finally { registry.dispose(); }
}
function instances(assets: PluginAccessoryAsset[]): PluginAccessoryInstance[] {
  return definitions.map(({ plugin, preset, instance }, i) => ({ id: instance, slot: plugin.slots[0]!, color: createAccessory(preset).color, asset: assets[i]! }));
}

function assertNear(actual: ArrayLike<number>, expected: ArrayLike<number>, label: string, tolerance = 1e-6) {
  assert.equal(actual.length, expected.length, `${label}: component count`);
  let largest = 0;
  for (let i = 0; i < actual.length; i++) {
    assert.ok(Number.isFinite(actual[i]!), `${label}: finite component ${i}`);
    largest = Math.max(largest, Math.abs(actual[i]! - expected[i]!));
  }
  assert.ok(largest <= tolerance, `${label}: maximum component error ${largest}, limit ${tolerance}`);
}

test('external author modules import only the public SDK and local author files, retaining the original license', () => {
  const root = new URL('../examples/plugin-sdk/catalog/', import.meta.url);
  for (const name of readdirSync(root).filter(name => name.endsWith('.js') && !name.endsWith('integration.js'))) {
    const source = readFileSync(new URL(name, root), 'utf8');
    assert.doesNotMatch(source, /(?:src\/|dist\/|catalogAccessoryGeometry|resolveShapeProfile|sampleAccessorySurface|accessoryMountProfile)/, name);
    for (const match of source.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)) {
      assert.ok(match[1] === '@hanana-kick/sidekick-plugin-sdk' || /^\.\/[^/]+\.js$/.test(match[1]!), `${name}: nonpublic import ${match[1]}`);
    }
  }
  assert.equal(readFileSync(new URL('LICENSE', root), 'utf8'), readFileSync(new URL('../LICENSE', import.meta.url), 'utf8'));
  assert.deepEqual(definitions.map(({ plugin }) => plugin.slots), [['mouth'], ['neck']]);
});

test('all 35 plugin-owned calibrations exactly preserve catalog anchors, orientations, size and following', () => {
  assert.equal(MATERIAL_SHAPE_NAMES.length, 35);
  for (const { plugin, preset } of definitions) {
    assert.equal(plugin.attachment?.mode, 'contained-front');
    assert.equal(plugin.attachment!.clearance, .002);
    assert.equal(plugin.attachment!.follow, preset === 'bowTie' ? .15 : 0);
    assert.deepEqual(Object.keys(plugin.attachment!.mounts).sort(), [...MATERIAL_SHAPE_NAMES].sort());
    assert.deepEqual(structuredClone(plugin.attachment), plugin.attachment);
    assert.deepEqual(JSON.parse(JSON.stringify(plugin.attachment)), plugin.attachment);
    for (const shape of MATERIAL_SHAPE_NAMES) {
      const original = resolveShapeProfile(shape).accessories[preset];
      assert.deepEqual(plugin.attachment!.mounts[shape], {
        uv: original.anchor.uv, offset: original.anchor.offset, rotation: original.rotation, scale: original.scale,
      }, `${preset}/${shape}`);
    }
  }
});

test('real authored prism geometry has original topology, bounded normals and a distinct flat knot material', async () => {
  const [moustacheAsset, bowTieAsset] = await loadAssets();
  assert.equal(moustacheAsset!.geometry.vertices.length / 6, 96);
  assert.equal(moustacheAsset!.geometry.indices.length, 564);
  assert.equal(bowTieAsset!.geometry.vertices.length / 6, 48);
  assert.equal(bowTieAsset!.geometry.indices.length, 252);
  for (const [i, asset] of [moustacheAsset!, bowTieAsset!].entries()) {
    const original = catalogAccessoryGeometry(createDesign().body, resolveDesign(createDesign({ accessories: [createAccessory(definitions[i]!.preset)] })).accessories[0]!);
    assert.deepEqual(asset.geometry.indices, original.indices);
    assert.equal(asset.geometry.parts![0]!.indexCount, original.mainIndexCount);
    for (let v = 0; v < asset.geometry.vertices.length; v += 6) {
      const length = Math.hypot(...asset.geometry.vertices.subarray(v + 3, v + 6));
      assert.ok(Math.abs(length - 1) < 1e-6, `normal ${v / 6}`);
    }
    assert.deepEqual(structuredClone(asset), asset);
    assert.equal('createMesh' in asset, false);
  }
  assert.deepEqual(bowTieAsset!.geometry.parts, [
    { indexStart: 0, indexCount: 168 },
    { indexStart: 168, indexCount: 84, material: { multiplier: .78 } },
  ]);
  assert.equal(accessoryDetailColor('#b84742'), '#903733');
});

test('eager and lazy shared registries run each real author factory once for concurrent avatars', async () => {
  for (const lazy of [false, true]) {
    const registry = new AccessoryPluginRegistry(), builds = [0, 0], loads = [0, 0];
    for (const [{ plugin }, i] of definitions.map((definition, i) => [definition, i] as const)) {
      const counted: AccessoryPlugin = { ...plugin, createMesh() { builds[i]!++; return plugin.createMesh(); } };
      if (lazy) registry.registerLazy(plugin.id, async () => { loads[i]!++; return { default: counted }; });
      else registry.register(counted);
    }
    assert.deepEqual(builds, [0, 0]);
    const avatars = [new PluginEquipmentController(() => {}), new PluginEquipmentController(() => {})];
    try {
      await Promise.all(avatars.flatMap(avatar => definitions.map(({ plugin, instance, preset }) => avatar.equip(registry, plugin.id, { slot: plugin.slots[0]!, id: instance, color: createAccessory(preset).color }))));
      assert.deepEqual(builds, [1, 1]);
      assert.deepEqual(loads, lazy ? [1, 1] : [0, 0]);
      const a = avatars[0]!.instances(), b = avatars[1]!.instances();
      assert.deepEqual(a, b);
      assert.notEqual(a[0]!.asset.geometry.vertices.buffer, b[0]!.asset.geometry.vertices.buffer);
      a[0]!.asset.attachment!.mounts.circle.scale = 5;
      a[1]!.asset.geometry.parts![1]!.material!.multiplier = 0;
      assert.equal(b[0]!.asset.attachment!.mounts.circle.scale, 1);
      assert.equal(b[1]!.asset.geometry.parts![1]!.material!.multiplier, .78);
      assert.equal((await registry.load(moustache.id)).attachment!.mounts.circle.scale, 1);
    } finally { registry.dispose(); }
  }
});

test('application eager/lazy demos retain a separate built-in reference and share the registry across plugin avatars', async () => {
  function bot() {
    const equipment = new PluginEquipmentController(() => {});
    return { design: createDesign(), animation: undefined as unknown,
      async setDesign(value: ReturnType<typeof createDesign>) { this.design = value; },
      equipPluginAccessory: equipment.equip.bind(equipment),
      setPartAnimation(value: unknown) { this.animation = value; },
      get instances() { return equipment.instances(); },
    };
  }
  for (const createRegistry of [createEagerCatalogRegistry, createLazyCatalogRegistry]) {
    const registry = createRegistry(), reference = bot(), first = bot(), second = bot();
    try {
      assert.equal(await integration.compareCatalogPlugins(reference, [first, second], registry), registry);
      assert.deepEqual(reference.design.accessories.map(accessory => accessory.preset), ['moustache', 'bowTie']);
      assert.deepEqual(reference.instances, []);
      assert.deepEqual(first.design.accessories, []);
      assert.deepEqual(second.design.accessories, []);
      assert.equal(first.instances.length, 2);
      assert.deepEqual(first.instances, second.instances);
      integration.playCatalogAnimation(first);
      assert.equal(first.animation, catalogAccessoryAnimation);
      assert.equal(second.animation, undefined);
      assert.equal(reference.animation, undefined);
    } finally { registry.dispose(); }
  }
});

function bodyGeometryForPlugin(asset: PluginAccessoryAsset, shape: MaterialShapeName, options: Parameters<typeof fitAccessoryPlugin>[2] = {}) {
  const fit = fitAccessoryPlugin(asset, createDesign({ body: { shape } }).body, options), matrix = fit.matrix;
  const vertices = new Float32Array(asset.geometry.vertices.length);
  for (let i = 0; i < vertices.length; i += 6) {
    const source = asset.geometry.vertices;
    for (let axis = 0; axis < 3; axis++) {
      vertices[i + axis] = matrix[axis]! * source[i]! + matrix[4 + axis]! * source[i + 1]! + matrix[8 + axis]! * source[i + 2]! + matrix[12 + axis]!;
      vertices[i + 3 + axis] = matrix[axis]! * source[i + 3]! + matrix[4 + axis]! * source[i + 4]! + matrix[8 + axis]! * source[i + 5]!;
    }
    const length = Math.hypot(...vertices.subarray(i + 3, i + 6));
    for (let axis = 0; axis < 3; axis++) vertices[i + 3 + axis]! /= length;
  }
  return { vertices, fit };
}

test('circle, square and heart preserve original geometry, attachment and material through squash and authored rotations', async () => {
  const assets = await loadAssets();
  for (const shape of ['circle', 'square', 'heart'] as const) for (const squash of [.88, 1, 1.12]) for (const rotation of [[0, 0, 0], [.10, -.13, .17]] as Vec3[]) {
    for (const [{ plugin, preset }, i] of definitions.map((definition, i) => [definition, i] as const)) {
      const body = createDesign({ body: { shape } }).body, asset = assets[i]!;
      const original = catalogAccessoryGeometry(body, resolveDesign(createDesign({ accessories: [createAccessory(preset)] })).accessories[0]!, squash, undefined, undefined, rotation);
      const port = bodyGeometryForPlugin(asset, shape, { squash, rotation });
      assertNear(port.vertices, original.vertices, `${preset}/${shape}/${squash}/${rotation}`);
      assertNear(port.fit.frame.position, original.attachment, `${preset}/${shape}: attachment`, 1e-12);
      assertNear([port.fit.seating], [original.seating], `${preset}/${shape}: front clearance`, 1e-7);
      assert.equal(asset.geometry.parts![0]!.indexCount, original.mainIndexCount);
      if (preset === 'bowTie') for (const color of ['#b84742', '#00ff80', '#ffffff', '#000000']) {
        assert.equal(accessoryPluginMaterialColor(color, asset.geometry.parts![1]!.material), accessoryDetailColor(color));
      }
      assert.equal(asset.pluginId, plugin.id);
    }
  }
});

test('interrupted morphs retain exact visible plugin fits and match built-in geometry without preset dispatch', async () => {
  const assets = await loadAssets(), timeline = new ShapeTimeline('circle');
  const compare = (label: string) => definitions.map(({ preset }, i) => {
    const snapshot = timeline.snapshot;
    const body = createDesign({ body: { shape: timeline.target } }).body;
    const original = catalogAccessoryGeometry(body, resolveDesign(createDesign({ accessories: [createAccessory(preset)] })).accessories[0]!, 1, snapshot.contour, snapshot.profile);
    const { vertices, fit } = bodyGeometryForPlugin(assets[i]!, timeline.target, { contour: snapshot.contour, depth: snapshot.profile.depth, shapeWeights: snapshot.shapeWeights });
    assertNear(vertices, original.vertices, `${label}/${preset}`);
    assertNear(fit.frame.position, original.attachment, `${label}/${preset}: attachment`, 1e-12);
    const mount = resolveAccessoryPluginMount(assets[i]!.attachment!, timeline.target, snapshot.shapeWeights);
    const originalMount = snapshot.profile.accessories[preset];
    assertNear(mount.uv, originalMount.anchor.uv, `${label}/${preset}: UV`, 1e-12);
    assertNear(mount.rotation, originalMount.rotation, `${label}/${preset}: tilt`, 1e-12);
    assertNear([mount.scale], [originalMount.scale], `${label}/${preset}: scale`, 1e-12);
    return vertices;
  });
  const first = timeline.to('square', { duration: 1000, easing: 'linear' });
  timeline.advance(377);
  const before = compare('circle->square at 37.7%'), snapshot = timeline.snapshot;
  const second = timeline.to('heart', { duration: 600, easing: 'smooth' });
  assert.deepEqual(await first, { finished: false });
  assert.equal(timeline.snapshot, snapshot);
  assert.deepEqual(compare('interrupted'), before);
  timeline.advance(.001);
  compare('first resumed frame').forEach((vertices, i) => assertNear(vertices, before[i]!, 'no interruption jump', .00001));
  timeline.advance(249.999);
  compare('circle/square->heart');
  timeline.finish();
  assert.deepEqual(await second, { finished: true });
  compare('settled heart');
});

test('actual plugins render both original materials, independently animate, seek exactly and survive cloned transport', async () => {
  const assets = await loadAssets(), pluginAccessories = instances(assets), first = canvasFixture(), second = canvasFixture(), reference = canvasFixture();
  try {
    for (const shape of ['circle', 'square', 'heart'] as const) {
      const design = createDesign({ body: { shape } });
      const builtinDesign = createDesign({ body: { shape }, accessories: [createAccessory('moustache'), createAccessory('bowTie')] });
      const renderState = { ...state(), pluginAccessories };
      first.renderer.render(design, renderState);
      second.renderer.render(design, structuredClone(renderState));
      reference.renderer.render(builtinDesign, state());
      assert.deepEqual(first.pixels, second.pixels, `${shape}: structured-clone transport`);
      // Source normals/positions are quantized before the matrix transform in a
      // plugin, versus after transformation in the built-in reference. CPU
      // geometry equality is asserted above at 1e-6, not hidden by image tolerance.
      let changedPixels = 0;
      for (let i = 0; i < first.pixels.length; i += 4) if (first.pixels[i] !== reference.pixels[i] || first.pixels[i + 1] !== reference.pixels[i + 1] || first.pixels[i + 2] !== reference.pixels[i + 2] || first.pixels[i + 3] !== reference.pixels[i + 3]) changedPixels++;
      assert.equal(changedPixels, 0, `${shape}: exact original raster coverage and materials`);
      const hasColor = (color: string) => {
        const rgb = [1, 3, 5].map(offset => parseInt(color.slice(offset, offset + 2), 16));
        for (let i = 0; i < first.pixels.length; i += 4) if (first.pixels[i] === rgb[0] && first.pixels[i + 1] === rgb[1] && first.pixels[i + 2] === rgb[2] && first.pixels[i + 3] === 255) return true;
        return false;
      };
      assert.ok(hasColor('#31323d'), `${shape}: moustache is visible`);
      assert.ok(hasColor('#b84742'), `${shape}: bow loops are visible`);
      assert.ok(hasColor('#903733'), `${shape}: dark knot is visible`);
      const sample = samplePartAnimation(catalogAccessoryAnimation, .25);
      assert.equal(sample.bodyRotation, undefined);
      assert.equal(sample.face, undefined);
      assert.equal(sample.eyes, undefined);
      assert.deepEqual(Object.keys(sample.accessories).sort(), ['plugin-bow-tie', 'plugin-moustache']);
      first.renderer.render(design, { ...renderState, partAnimation: sample });
      const paused = first.pixels, unaffected = second.pixels;
      first.renderer.render(design, { ...renderState, partAnimation: samplePartAnimation(catalogAccessoryAnimation, 1.25) });
      assert.notDeepEqual(first.pixels, paused, `${shape}: independent animation moves real geometry`);
      first.renderer.render(design, { ...renderState, partAnimation: samplePartAnimation(catalogAccessoryAnimation, .25) });
      assert.deepEqual(first.pixels, paused, `${shape}: seeking restores exact pixels`);
      assert.deepEqual(second.pixels, unaffected, `${shape}: another avatar is unchanged`);
      first.renderer.render(design, state());
      second.renderer.render(design, state());
      assert.deepEqual(first.pixels, second.pixels, `${shape}: both plugins remove cleanly`);
    }
  } finally { first.renderer.dispose(); second.renderer.dispose(); reference.renderer.dispose(); }
});

test('lazy application entry really defers both author-module imports until requested', () => {
  const lazyEntry = new URL('../examples/plugin-sdk/catalog/lazy-integration.js', import.meta.url).href;
  const output = execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { registerHooks } from 'node:module';
    const resolved = [], entries = ${JSON.stringify(publicEntries)};
    registerHooks({ resolve(specifier, context, nextResolve) {
      const result = nextResolve(entries[specifier] ?? specifier, context);
      resolved.push(result.url);
      return result;
    } });
    const { createLazyCatalogRegistry } = await import(${JSON.stringify(lazyEntry)});
    const registry = createLazyCatalogRegistry();
    const assetModule = url => /\\/catalog\\/(?:moustache|bow-tie)\\.js$/.test(url);
    assert.deepEqual(resolved.filter(assetModule), []);
    await Promise.all([registry.load('catalog/moustache'), registry.load('catalog/moustache')]);
    assert.equal(resolved.filter(url => url.endsWith('/catalog/moustache.js')).length, 1);
    assert.equal(resolved.filter(url => url.endsWith('/catalog/bow-tie.js')).length, 0);
    await registry.load('catalog/bow-tie');
    assert.equal(resolved.filter(url => url.endsWith('/catalog/bow-tie.js')).length, 1);
    registry.dispose();
    console.log('Author modules remain lazy');
  `], { encoding: 'utf8' });
  assert.match(output, /Author modules remain lazy/);
});

test('combined nonzero translation, rotation, scale and opacity preserve original catalog animation semantics', async () => {
  const assets = await loadAssets(), pluginAccessories = instances(assets), port = canvasFixture(), reference = canvasFixture();
  const partAnimation = { accessories: {
    'plugin-moustache': { position: [.012, .008, .014] as Vec3, rotation: [.05, -.03, .10] as Vec3, scale: [1.04, .96, 1.02] as Vec3, opacity: .75 },
    'plugin-bow-tie': { position: [-.010, .012, .018] as Vec3, rotation: [-.04, .02, -.13] as Vec3, scale: [.96, 1.03, 1.02] as Vec3, opacity: .85 },
  } };
  try {
    for (const shape of ['circle', 'square', 'heart'] as const) for (const yaw of [0, 29]) {
      const design = createDesign({ body: { shape } });
      const original = createDesign({ body: { shape }, accessories: definitions.map(({ preset, instance }) => createAccessory(preset, { id: instance })) });
      const shared = { ...state(), bodyOrientation: { yaw }, partAnimation };
      port.renderer.render(design, { ...shared, pluginAccessories });
      reference.renderer.render(original, shared);
      assert.deepEqual(port.pixels, reference.pixels, `${shape}/${yaw}: nonzero TRS and material opacity`);
    }
  } finally { port.renderer.dispose(); reference.renderer.dispose(); }
});

test('all six external slots compose with original materials and deterministic independent tracks', async () => {
  const { allSlotDefinitions, createAllSlotsEagerRegistry } = await import('../examples/plugin-sdk/catalog/all-slots-integration.js');
  const { createAllSlotsLazyRegistry } = await import('../examples/plugin-sdk/catalog/all-slots-lazy-integration.js');
  const { allSlotsAnimation } = await import('../examples/plugin-sdk/catalog/all-slots-animation.js');
  const eager = createAllSlotsEagerRegistry(), lazy = createAllSlotsLazyRegistry();
  const builtin = canvasFixture(), external = canvasFixture();
  try {
    const assets = await Promise.all(allSlotDefinitions.map(entry => eager.load(entry.plugin.id)));
    const lazyAssets = await Promise.all(allSlotDefinitions.map(entry => lazy.load(entry.plugin.id)));
    assert.deepEqual(lazyAssets, assets);
    const equipment = allSlotDefinitions.map((entry, index) => ({ id: entry.id, slot: entry.slot, color: createAccessory(entry.preset, { slot: entry.slot }).color, asset: assets[index]! }));
    for (const shape of ['circle', 'heart', 'pixelTriangle'] as const) for (const time of [0, .75, 1.25, .75]) {
      const sample = samplePartAnimation(allSlotsAnimation, time);
      const reference = createDesign({ body: { shape }, accessories: allSlotDefinitions.map(entry => createAccessory(entry.preset, { slot: entry.slot, id: entry.id })) });
      const base = createDesign({ body: { shape }, accessories: [] });
      const render = { ...state(), partAnimation: sample, bodyOrientation: { yaw: 17, pitch: 0, roll: 0 } };
      builtin.renderer.render(reference, render);
      external.renderer.render(base, { ...render, pluginAccessories: structuredClone(equipment) });
      assert.deepEqual(external.pixels, builtin.pixels, `${shape}/${time}: six-slot composition`);
    }
  } finally { builtin.renderer.dispose(); external.renderer.dispose(); eager.dispose(); lazy.dispose(); }
});
