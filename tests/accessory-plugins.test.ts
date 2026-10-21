import test from 'node:test';
import assert from 'node:assert/strict';
import { AccessoryPluginRegistry, validateAccessoryPluginGeometry, ACCESSORY_PLUGIN_LIMITS } from '../src/core/accessory-plugins.js';
import type { AccessoryPlugin, AccessoryPluginGeometry } from '../src/core/accessory-plugins.js';
function mesh(): AccessoryPluginGeometry { return { vertices: new Float32Array([0,0,0,0,0,1, 1,0,0,0,0,1, 0,1,0,0,0,1]), indices: new Uint16Array([0,1,2]) }; }
function plugin(id = 'example/hat'): AccessoryPlugin { return { apiVersion: 1, id, slots: ['head'], createMesh: mesh }; }

test('eager registration is explicit preload; factory runs once and each caller owns arrays', async () => {
  const registry = new AccessoryPluginRegistry(), source = mesh(); let calls = 0;
  const p = plugin(); p.createMesh = () => { calls++; return source; };
  registry.register(p); assert.equal(calls, 0); assert.equal(registry.has(p.id), true);
  p.slots = ['eyes']; p.createMesh = () => { throw Error('changed'); };
  const [a,b] = await Promise.all([registry.load(p.id), registry.load(p.id)]);
  assert.equal(calls, 1); assert.deepEqual(a.slots, ['head']); assert.notEqual(a.geometry.vertices, b.geometry.vertices);
  a.geometry.vertices[0] = 9; a.slots[0] = 'neck'; source.vertices[0] = 8;
  const c = await registry.load(p.id); assert.equal(c.geometry.vertices[0], 0); assert.deepEqual(c.slots, ['head']);
  assert.deepEqual(structuredClone(c), c);
});
test('lazy module and async factory are deduplicated including preload/equip concurrency', async () => {
  const registry = new AccessoryPluginRegistry(); let loads = 0, builds = 0;
  registry.registerLazy('example/hat', async () => { loads++; return { default: { ...plugin(), async createMesh() { builds++; await Promise.resolve(); return mesh(); } } }; });
  assert.equal(loads, 0);
  await Promise.all(Array.from({ length: 20 }, () => registry.load('example/hat')));
  assert.equal(loads, 1); assert.equal(builds, 1);
  await registry.retry('example/hat'); assert.equal(loads, 1);
});
test('failures remain cached until explicit retry; concurrent retries invoke loader once', async () => {
  const registry = new AccessoryPluginRegistry(); let loads = 0;
  registry.registerLazy('example/hat', () => { if (++loads === 1) throw Error('network'); return plugin(); });
  await assert.rejects(registry.load('example/hat'), /network/);
  await assert.rejects(registry.load('example/hat'), /network/); assert.equal(loads, 1);
  await Promise.all([registry.retry('example/hat'), registry.retry('example/hat')]); assert.equal(loads, 2);
});
test('rejects duplicates, invalid metadata, missing IDs and lazy id mismatch', async () => {
  const registry = new AccessoryPluginRegistry(); registry.register(plugin());
  assert.throws(() => registry.register(plugin()), /already registered/);
  assert.throws(() => registry.registerLazy('example/hat', () => plugin()), /already registered/);
  assert.throws(() => registry.register({ ...plugin('bad id') }), /id must/);
  assert.throws(() => registry.register({ ...plugin('other'), apiVersion: 2 } as unknown as AccessoryPlugin), /apiVersion/);
  assert.throws(() => registry.register({ ...plugin('other'), slots: [] }), /slots/);
  assert.throws(() => registry.register({ ...plugin('other'), slots: ['head', 'head'] }), /slots/);
  await assert.rejects(registry.load('missing'), /not registered/);
  registry.registerLazy('other', () => plugin()); await assert.rejects(registry.load('other'), /mismatch/);
});
test('validates finite positions, unit normals, index range and bounded mesh sizes', () => {
  const invalid = (change: (g: AccessoryPluginGeometry) => void, pattern: RegExp) => { const g = mesh(); change(g); assert.throws(() => validateAccessoryPluginGeometry(g), pattern); };
  invalid(g => { g.vertices[0] = NaN; }, /positions/);
  invalid(g => { g.vertices[0] = 17; }, /positions/);
  invalid(g => { g.vertices[5] = 0; }, /normals/);
  invalid(g => { g.vertices[5] = Infinity; }, /normals/);
  invalid(g => { g.indices[2] = 3; }, /index/);
  invalid(g => { g.indices = new Uint16Array([0,1]); }, /triangle/);
  invalid(g => { g.vertices = new Float32Array(17); }, /vertex/);
  invalid(g => { g.vertices = new Float32Array((ACCESSORY_PLUGIN_LIMITS.maxVertices + 1) * 6); }, /vertex/);
  invalid(g => { g.indices = new Uint16Array((ACCESSORY_PLUGIN_LIMITS.maxTriangles + 1) * 3); }, /triangle/);
  assert.throws(() => validateAccessoryPluginGeometry({ vertices: [], indices: [] }), /Float32Array/);
  if (typeof SharedArrayBuffer !== 'undefined') invalid(g => { g.vertices = new Float32Array(new SharedArrayBuffer(72)); }, /non-shared/);
});
test('dispose invalidates pending imports without running their factory', async () => {
  const registry = new AccessoryPluginRegistry(); let complete!: (value: AccessoryPlugin) => void, builds = 0;
  registry.registerLazy('example/hat', () => new Promise(resolve => { complete = resolve; }));
  const pending = registry.load('example/hat'); await Promise.resolve();
  registry.dispose(); complete({ ...plugin(), createMesh() { builds++; return mesh(); } });
  await assert.rejects(pending, /disposed/); assert.equal(builds, 0); assert.equal(registry.has('example/hat'), false);
  assert.throws(() => registry.register(plugin()), /disposed/); await assert.rejects(registry.load('example/hat'), /disposed/);
});
test('dispose invalidates asynchronous mesh completion and is idempotent', async () => {
  const registry = new AccessoryPluginRegistry(); let complete!: (value: AccessoryPluginGeometry) => void;
  registry.register({ ...plugin(), createMesh: () => new Promise(resolve => { complete = resolve; }) });
  const pending = registry.load('example/hat');
  while (!complete) await Promise.resolve();
  registry.dispose(); registry.dispose(); complete(mesh());
  await assert.rejects(pending, /disposed/);
});
