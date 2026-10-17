import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateDesign, parseDesign, serializeDesign } from '../dist/src/core/design.js';
import { legacyDesign, legacyAccessory } from './legacy-fixtures.mjs';
import { shapes } from '../dist/src/core/shapes.js';

const legacyBody = (shape = 'rounded-box', patch = {}) => ({
  shape, size: [1.12, 1.18, 0.9], roundness: 0.68, taper: 0, bulge: 0.05, bend: 0,
  color: '#e9b64d', ...patch,
});
const legacy = (version = 2, shape = 'rounded-box', patch = {}) => {
  const design = { ...legacyDesign(version), body: legacyBody(shape, patch) };
  design.eyes.left = { expression: 'neutral', openness: 1 };
  design.eyes.right = { expression: 'neutral', openness: 1 };
  if (version === 1) design.eyes = {
    preset: 'capsule', anchor: { region: 'face', uv: [0, 0.1], offset: 0.026 },
    spacing: 0.64, scale: 1, color: '#24242c',
  };
  return design;
};

test('saved v1 eye presets migrate to independent capsule states with zero offset', () => {
  for (const preset of ['capsule', 'round', 'arc']) {
    const raw = legacy(1); raw.eyes.preset = preset;
    const snapshot = structuredClone(raw), migrated = parseDesign(raw);
    assert.equal(migrated.version, 7);
    assert.deepEqual(migrated.body, { shape: 'square', color: '#e9b64d' });
    assert.deepEqual(Object.keys(migrated.eyes).sort(), ['color','left','right']);
    assert.deepEqual(migrated.eyes.left.weights, { smile: preset === 'arc' ? 1 : 0, blink: 0 });
    assert.deepEqual(migrated.eyes.right.weights, migrated.eyes.left.weights);
    assert.notEqual(migrated.eyes.left, migrated.eyes.right);
    assert.ok(!('preset' in migrated.eyes));
    assert.deepEqual(parseDesign(serializeDesign(migrated)), migrated);
    migrated.eyes.left.weights.blink = 0.25;
    assert.equal(migrated.eyes.right.weights.blink, 0);
    assert.deepEqual(raw, snapshot);
  }
});

test('saved v2 weights and color survive while eye geometry is discarded', () => {
  const raw = legacy();
  Object.assign(raw.eyes, { width: 0.12, height: 0.3, color: '#AABBCC', left: { expression: 'blink', openness: 0.4 }, right: { expression: 'smile', openness: 0.8 } });
  raw.eyes.anchor.uv = [0.1, -0.1];
  const parsed = parseDesign(raw);
  assert.deepEqual(parsed.eyes.left.weights, { smile: 0, blink: 1 });
  assert.equal(parsed.eyes.right.weights.smile, 1);
  assert.ok(Math.abs(parsed.eyes.right.weights.blink - 0.2) < 1e-10);
  assert.deepEqual(Object.keys(parsed.eyes).sort(), ['color','left','right']);
  assert.equal(parsed.eyes.color, '#aabbcc');
  assert.notEqual(parsed.eyes.left, raw.eyes.left);
  assert.deepEqual(parsed.body, { shape: 'square', color: '#e9b64d' });
});

test('legacy preset and descriptor outlines have deterministic catalog approximations', () => {
  const cases = [
    ['orb', 'circle'], ['rounded-box', 'square'], ['droplet', 'gem'],
    [shapes.ellipse(), 'circle'],
    [shapes.roundedPolygon(3, { rounding: 0.1 }), 'triangle'],
    [shapes.roundedPolygon(5, { rounding: 0.3 }), 'pentagon'],
    [shapes.morph(shapes.ellipse(), shapes.roundedPolygon(5, { rounding: 0.3 }), 0.4), 'circle'],
  ];
  for (const version of [1, 2]) for (const [shape, expected] of cases) {
    const raw = legacy(version, shape), before = structuredClone(raw);
    const first = parseDesign(raw);
    assert.equal(first.body.shape, expected, JSON.stringify(shape));
    assert.deepEqual(Object.keys(first.body).sort(), ['color', 'shape']);
    assert.deepEqual(parseDesign(JSON.stringify(raw)), first);
    assert.deepEqual(parseDesign(raw), first);
    assert.deepEqual(parseDesign(serializeDesign(first)), first);
    assert.deepEqual(raw, before);
  }
});

test('legacy roundness and XY size influence selection; depth is dropped', () => {
  assert.equal(parseDesign(legacy(2, 'rounded-box', { roundness: 0.15, bulge: 0 })).body.shape, 'square');
  assert.equal(parseDesign(legacy(2, 'rounded-box', { roundness: 1, bulge: 0 })).body.shape, 'circle');
  const wide = parseDesign(legacy(2, 'rounded-box', { size: [1.8, 0.8, 0.9], bulge: 0 }));
  const tall = parseDesign(legacy(2, 'rounded-box', { size: [0.8, 1.8, 0.9], bulge: 0 }));
  assert.notEqual(wide.body.shape, tall.body.shape);
  assert.deepEqual(parseDesign(legacy(2, 'rounded-box', { size: [1.8, 0.8, 1.6], bulge: 0 })), wide);
});

test('legacy custom deformation is consumed by approximation and never stored in v7', () => {
  const raw = legacy(2, 'rounded-box', { taper: 0.45, bulge: 0.4, bend: 0.35 });
  const { design, warnings } = migrateDesign(raw);
  assert.equal(design.body.shape, 'semiCircle');
  assert.deepEqual(Object.keys(design.body).sort(), ['color', 'shape']);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /v2.*semiCircle/);
  for (const field of ['size', 'roundness', 'taper', 'bulge', 'bend']) assert.ok(warnings[0].includes(field));
  assert.deepEqual(migrateDesign(design).warnings, []);
});

test('legacy malformed body parameters, unsupported recipes, and invalid eye states reject', () => {
  for (const version of [1, 2]) for (const change of [
    d => d.body.shape = 'unknown', d => d.body.shape = { kind: 'svg', path: 'M0,0' },
    d => d.body.roundness = NaN, d => d.body.taper = 0.46, d => d.body.bulge = Infinity,
    d => d.body.bend = -0.36, d => d.body.size = [1, 1], d => d.body.size[2] = 0,
    d => d.body.unrecognized = true,
  ]) {
    const raw = legacy(version); change(raw); assert.throws(() => parseDesign(raw));
  }
  const v1 = legacy(1); v1.eyes.preset = 'unsupported'; assert.throws(() => parseDesign(v1));
  const v2 = legacy(); v2.eyes.anchor.offset = 0.01; assert.throws(() => parseDesign(v2));
  const cyclic = shapes.morph(shapes.ellipse(), shapes.ellipse(), 0.5);
  cyclic.from = cyclic;
  assert.throws(() => parseDesign(legacy(2, cyclic)), /deep|large|nested|cyclic/);
});

test('legacy slot inference preserves equipment and never resolves occupancy conflicts silently', () => {
  for (const version of [1, 2]) {
    const raw = legacy(version);
    raw.accessories = [legacyAccessory('beret'), legacyAccessory('glasses')];
    raw.accessories.forEach(a => delete a.slot);
    const parsed = parseDesign(raw);
    assert.deepEqual(parsed.accessories.map(a => a.slot), ['head', 'eyes']);
    assert.deepEqual(parsed.accessories.map(a => a.preset), ['beret', 'glasses']);
    const original = structuredClone(raw);
    parsed.accessories[0].color = '#abcdef';
    assert.deepEqual(raw, original);
    raw.accessories = [legacyAccessory('beret'), legacyAccessory('halo')];
    raw.accessories.forEach(a => delete a.slot);
    assert.throws(() => parseDesign(raw), /accessory\.slot: head/);
    raw.accessories = [{ ...legacyAccessory('halo'), slot: 'face' }];
    assert.throws(() => parseDesign(raw), /accessory\.slot/);
  }
});
