import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as sdk from '../src/plugin-sdk.js';
import type { AccessoryPlugin, AccessoryPluginGeometry, PartAnimationClip } from '../src/plugin-sdk.js';
import {
  AccessoryPluginRegistry,
  validateAccessoryPluginGeometry as runtimeGeometryValidator,
} from '../src/core/accessory-plugins.js';
import {
  validatePartAnimation as runtimeAnimationValidator,
  samplePartAnimation as runtimeAnimationSampler,
} from '../src/core/part-animation.js';
import {
  getAccessoryAttachmentFrame as runtimeAttachmentFrame,
  getAccessoryAttachmentFrames as runtimeAttachmentFrames,
  attachmentPointToBody as runtimeAttachmentPoint,
} from '../src/core/accessory-attachments.js';

function mesh(): AccessoryPluginGeometry {
  return {
    vertices: new Float32Array([0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1]),
    indices: new Uint16Array([0, 1, 2]),
  };
}
function clip(): PartAnimationClip {
  return {
    duration: 2,
    tracks: [{
      target: { accessory: 'badge' },
      channel: 'position',
      keyframes: [{ time: 0, value: [0, 0, 0] }, { time: 2, value: [1, 0, 0] }],
    }],
  };
}

function sameValidationFailure(actual: () => unknown, expected: () => unknown): void {
  let expectedError: unknown;
  try { expected(); } catch (error) { expectedError = error; }
  assert.ok(expectedError instanceof Error, 'Runtime validation must reject the fixture');
  assert.throws(actual, { name: expectedError.name, message: expectedError.message });
}

test('plugin definitions preserve identity, custom fields and factories without executing or mutating them', async () => {
  let calls = 0;
  const source = Object.freeze({
    apiVersion: 1 as const,
    id: 'example/badge',
    slots: Object.freeze(['head', 'neck'] as const),
    author: 'Example',
    async createMesh() { calls++; assert.equal(this, source); return mesh(); },
  });
  const definition = sdk.defineAccessoryPlugin(source);
  assert.equal(definition, source);
  assert.equal(definition.slots, source.slots);
  assert.equal(definition.createMesh, source.createMesh);
  assert.equal(definition.author, 'Example');
  assert.equal(calls, 0);
  const result = definition.createMesh();
  assert.ok(result instanceof Promise);
  await result;
  assert.equal(calls, 1);
});

test('definition helper leaves runtime metadata validation to registration', () => {
  const invalid = { apiVersion: 2, id: 'example/badge', slots: ['head'], createMesh: mesh } as unknown as AccessoryPlugin;
  assert.equal(sdk.defineAccessoryPlugin(invalid), invalid);
  const registry = new AccessoryPluginRegistry();
  assert.throws(() => registry.register(invalid), /apiVersion/);
  registry.dispose();
});

test('geometry helper returns an owned snapshot using the existing runtime contract', () => {
  assert.equal(sdk.validateAccessoryPluginGeometry, runtimeGeometryValidator);
  const source = Object.freeze(mesh());
  const before = structuredClone(source);
  const geometry = sdk.defineAccessoryGeometry(source);
  assert.deepEqual(source, before);
  assert.deepEqual(geometry, runtimeGeometryValidator(source));
  assert.notEqual(geometry, source);
  assert.notEqual(geometry.vertices.buffer, source.vertices.buffer);
  assert.notEqual(geometry.indices.buffer, source.indices.buffer);
  source.vertices[0] = 2;
  source.indices[0] = 2;
  assert.equal(geometry.vertices[0], 0);
  assert.equal(geometry.indices[0], 0);
  geometry.vertices[1] = 3;
  assert.equal(source.vertices[1], 0);
});

test('geometry helper rejects malformed, out-of-range and shared buffers exactly as the runtime does', () => {
  const invalid: unknown[] = [null, { vertices: [], indices: [] }];
  for (const change of [
    (value: AccessoryPluginGeometry) => { value.vertices[0] = NaN; },
    (value: AccessoryPluginGeometry) => { value.vertices[0] = sdk.ACCESSORY_PLUGIN_LIMITS.maxCoordinate + 1; },
    (value: AccessoryPluginGeometry) => { value.vertices[5] = 0; },
    (value: AccessoryPluginGeometry) => { value.indices[2] = 3; },
    (value: AccessoryPluginGeometry) => { value.indices = new Uint16Array([0, 1]); },
  ]) {
    const value = mesh(); change(value); invalid.push(value);
  }
  if (typeof SharedArrayBuffer !== 'undefined') {
    invalid.push({ ...mesh(), vertices: new Float32Array(new SharedArrayBuffer(72)) });
  }
  for (const value of invalid) sameValidationFailure(
    () => sdk.defineAccessoryGeometry(value as AccessoryPluginGeometry),
    () => runtimeGeometryValidator(value),
  );
});

test('animation helper validates and copies clips without sharing mutable author data', () => {
  assert.equal(sdk.validatePartAnimation, runtimeAnimationValidator);
  assert.equal(sdk.samplePartAnimation, runtimeAnimationSampler);
  const source = clip(), before = structuredClone(source);
  const defined = sdk.definePartAnimation(source);
  assert.deepEqual(source, before);
  assert.deepEqual(defined, runtimeAnimationValidator(source));
  assert.notEqual(defined, source);
  assert.notEqual(defined.tracks, source.tracks);
  assert.notEqual(defined.tracks[0]!.target, source.tracks[0]!.target);
  assert.notEqual(defined.tracks[0]!.keyframes[0]!.value, source.tracks[0]!.keyframes[0]!.value);
  source.duration = 9;
  source.tracks[0]!.keyframes[1]!.time = 9;
  (source.tracks[0]!.target as { accessory: string }).accessory = 'changed';
  assert.equal(defined.duration, 2);
  assert.deepEqual(sdk.samplePartAnimation(defined, 1).accessories.badge?.position, [0.5, 0, 0]);
  const sample = sdk.samplePartAnimation(defined, 1);
  sample.accessories.badge!.position![0] = 12;
  assert.deepEqual(sdk.samplePartAnimation(defined, 1).accessories.badge?.position, [0.5, 0, 0]);
  assert.deepEqual(structuredClone(defined), defined);
});

test('animation helper retains strict runtime validation and does not evaluate accessor data', () => {
  let getterCalls = 0;
  const accessor = Object.defineProperty({ tracks: [] }, 'duration', {
    enumerable: true,
    get() { getterCalls++; return 1; },
  });
  const invalid = [
    { ...clip(), duration: 0 },
    { ...clip(), tracks: [] },
    { ...clip(), loop: 'yes' },
    { ...clip(), tracks: [clip().tracks[0], clip().tracks[0]] },
    { ...clip(), tracks: [{ target: 'body', channel: 'position', keyframes: [{ time: 0, value: [0, 0, 0] }] }] },
    accessor,
  ];
  for (const value of invalid) sameValidationFailure(
    () => sdk.definePartAnimation(value as PartAnimationClip),
    () => runtimeAnimationValidator(value),
  );
  assert.equal(getterCalls, 0);
});

test('SDK definitions work unchanged with eager and lazy runtime registries', async () => {
  let builds = 0, loads = 0;
  const definition = sdk.defineAccessoryPlugin({
    apiVersion: 1,
    id: 'example/badge',
    slots: ['head', 'neck'],
    createMesh() { builds++; return sdk.defineAccessoryGeometry(mesh()); },
  });
  const eager = new AccessoryPluginRegistry(), lazy = new AccessoryPluginRegistry();
  eager.register(definition);
  lazy.registerLazy(definition.id, async () => { loads++; return { default: definition }; });
  assert.equal(builds, 0);
  assert.equal(loads, 0);
  const [a, b, c] = await Promise.all([eager.load(definition.id), lazy.load(definition.id), lazy.load(definition.id)]);
  assert.equal(builds, 2);
  assert.equal(loads, 1);
  assert.deepEqual(a, b);
  assert.deepEqual(b, c);
  assert.deepEqual(a.slots, ['head', 'neck']);
  assert.notEqual(b.geometry.vertices.buffer, c.geometry.vertices.buffer);
  assert.deepEqual(structuredClone(a), a);
  eager.dispose(); lazy.dispose();
});

test('attachment exports share the runtime frame calculation and leave author inputs unchanged', () => {
  assert.equal(sdk.getAccessoryAttachmentFrame, runtimeAttachmentFrame);
  assert.equal(sdk.getAccessoryAttachmentFrames, runtimeAttachmentFrames);
  assert.equal(sdk.attachmentPointToBody, runtimeAttachmentPoint);
  const body = Object.freeze({ shape: 'heart' as const, color: '#ffcc37' });
  const points = Object.freeze(['leftEye', 'rightEye', 'head'] as const);
  const options = Object.freeze({ squash: 0.9 });
  const frames = sdk.getAccessoryAttachmentFrames(body, points, options);
  assert.deepEqual(frames, points.map(point => runtimeAttachmentFrame(body, point, options)));
  for (const frame of frames) {
    const before = structuredClone(frame);
    assert.deepEqual(sdk.attachmentPointToBody(frame, [0, 0, 0]), frame.position);
    assert.deepEqual(frame, before);
    assert.equal(frame.scale, 1);
    assert.ok([...frame.position, ...frame.normal, ...frame.tangent, ...frame.bitangent].every(Number.isFinite));
  }
  assert.deepEqual(body, { shape: 'heart', color: '#ffcc37' });
  assert.deepEqual(points, ['leftEye', 'rightEye', 'head']);
  assert.deepEqual(options, { squash: 0.9 });
  assert.throws(() => sdk.getAccessoryAttachmentFrame(body, 'head', { squash: 0 }), /squash/);
});

test('SDK imports and helpers run without DOM, renderer, worker or registry initialization', () => {
  const entry = new URL('../src/plugin-sdk.ts', import.meta.url).href;
  const output = execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', String.raw`
    import assert from 'node:assert/strict';
    import { registerHooks } from 'node:module';
    const loaded = new Set();
    registerHooks({ resolve(specifier, context, nextResolve) {
      const result = nextResolve(specifier, context);
      loaded.add(result.url);
      return result;
    } });
    for (const name of ['window', 'document', 'HTMLElement', 'customElements', 'navigator', 'Worker', 'OffscreenCanvas', 'requestAnimationFrame']) {
      Object.defineProperty(globalThis, name, { configurable: true, get() { throw new Error('Unexpected browser access: ' + name); } });
    }
    const sdk = await import(${JSON.stringify(entry)});
    assert.equal(sdk.AccessoryPluginRegistry, undefined);
    assert.equal(sdk.defineSidekick, undefined);
    assert.equal(sdk.SidekickAvatar, undefined);
    const definition = sdk.defineAccessoryPlugin({ apiVersion: 1, id: 'example/server', slots: ['head'], createMesh() { throw new Error('Factory must stay lazy'); } });
    assert.equal(definition.id, 'example/server');
    const clip = sdk.definePartAnimation({ duration: 1, tracks: [{ target: 'body', channel: 'rotation', keyframes: [{ time: 0, value: [0, 0, 0] }] }] });
    assert.deepEqual(sdk.samplePartAnimation(clip, 0).bodyRotation, [0, 0, 0]);
    assert.ok(sdk.getAccessoryAttachmentFrame({ shape: 'square', color: '#ffcc37' }, 'head').position.every(Number.isFinite));
    assert.ok([...loaded].some(url => url.endsWith('/src/plugin-sdk.ts')));
    for (const url of loaded) assert.doesNotMatch(url, /\/src\/(?:element|render|renderer|react|worker)(?:\/|\.)|\/playground\//);
    console.log('SDK is DOM-free');
  `], { cwd: fileURLToPath(new URL('..', import.meta.url)), encoding: 'utf8' });
  assert.match(output, /SDK is DOM-free/);
});

test('author types retain literal IDs, slots, custom fields and synchronous/asynchronous return types', t => {
  const directory = mkdtempSync(join(tmpdir(), 'sidekick-plugin-sdk-types-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const fixture = join(directory, 'consumer.mts');
  const entry = fileURLToPath(new URL('../src/plugin-sdk.js', import.meta.url));
  writeFileSync(fixture, `
    import {
      defineAccessoryPlugin, defineAccessoryGeometry, definePartAnimation,
      getAccessoryAttachmentFrame, attachmentPointToBody,
      type AccessoryPlugin, type AccessoryPluginGeometry, type AccessoryPluginLoader,
      type AccessorySlot, type BodyDesign, type PartAnimationClip, type Vec3,
    } from ${JSON.stringify(entry)};
    const mesh = () => defineAccessoryGeometry({ vertices: new Float32Array(18), indices: new Uint16Array([0, 1, 2]) });
    const plugin = defineAccessoryPlugin({ apiVersion: 1, id: 'example/badge', slots: ['head', 'neck'], custom: { author: 'Example' }, createMesh: mesh });
    const id: 'example/badge' = plugin.id;
    const slots: readonly ['head', 'neck'] = plugin.slots;
    const author: 'Example' = plugin.custom.author;
    const geometry: AccessoryPluginGeometry = plugin.createMesh();
    const runtimePlugin: AccessoryPlugin = plugin;
    const asynchronous = defineAccessoryPlugin({ apiVersion: 1, id: 'example/async', slots: ['eyes'], async createMesh() { return mesh(); } });
    const promise: Promise<AccessoryPluginGeometry> = asynchronous.createMesh();
    const loader: AccessoryPluginLoader = async () => ({ default: asynchronous });
    const animation: PartAnimationClip = definePartAnimation({ duration: 1, tracks: [{ target: 'body', channel: 'rotation', keyframes: [{ time: 0, value: [0, 0, 0] }] }] });
    const body: BodyDesign = { shape: 'square', color: '#ffcc37' };
    const slot: AccessorySlot = plugin.slots[0];
    const position: Vec3 = attachmentPointToBody(getAccessoryAttachmentFrame(body, slot), [0, 0, 0]);
    // @ts-expect-error unsupported API version
    defineAccessoryPlugin({ apiVersion: 2, id: 'example/bad', slots: ['head'], createMesh: mesh });
    // @ts-expect-error nonexistent slot
    defineAccessoryPlugin({ apiVersion: 1, id: 'example/bad', slots: ['tail'], createMesh: mesh });
    // @ts-expect-error vertices must use Float32Array
    defineAccessoryGeometry({ vertices: [0, 0, 0], indices: new Uint16Array([0, 1, 2]) });
    // @ts-expect-error unsupported body channel
    definePartAnimation({ duration: 1, tracks: [{ target: 'body', channel: 'opacity', keyframes: [{ time: 0, value: 1 }] }] });
    void [id, slots, author, geometry, runtimePlugin, promise, loader, animation, position];
  `);
  const compiler = fileURLToPath(new URL('../node_modules/typescript/bin/tsc', import.meta.url));
  execFileSync(process.execPath, [compiler, '--noEmit', '--strict', '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--lib', 'ES2022', '--skipLibCheck', fixture], {
    cwd: directory,
    encoding: 'utf8',
    stdio: 'pipe',
  });
});
