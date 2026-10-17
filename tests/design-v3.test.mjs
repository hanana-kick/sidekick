import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BODY_SHAPES, MATERIAL_SHAPE_NAMES, createAccessory, createDesign,
  migrateDesign, parseDesign, patchDesign, serializeDesign,
} from '../dist/src/core/design.js';
import { legacyDesign } from './legacy-fixtures.mjs';
import { MATERIAL_SHAPE_NAMES as INTERNAL_NAMES, shapes } from '../dist/src/core/shapes.js';

const legacy = (shape, bodyPatch = {}) => ({
  ...legacyDesign(2),
  eyes: { ...legacyDesign(2).eyes, left: { expression: 'neutral', openness: 1 }, right: { expression: 'neutral', openness: 1 } },
  body: { shape, size: [1.12, 1.18, 0.9], roundness: 0.68, taper: 0, bulge: 0.05, bend: 0, color: '#e9b64d', ...bodyPatch },
});

test('v7 default is one square catalog selection and flat color', () => {
  const a = createDesign(), b = createDesign();
  assert.equal(a.version, 7);
  assert.deepEqual(a.body, { shape: 'square', color: '#ffcc37' });
  assert.deepEqual(Object.keys(a.eyes).sort(), ['color','left','right']);
  a.body.shape = 'heart'; a.eyes.left.weights.smile = 1;
  assert.equal(b.body.shape, 'square');
  assert.equal(a.eyes.right.weights.smile, 0);
  assert.equal(b.eyes.left.weights.smile, 0);
});

test('the only body choices are all 35 immutable Material catalog names', () => {
  assert.equal(MATERIAL_SHAPE_NAMES.length, 35);
  assert.equal(new Set(MATERIAL_SHAPE_NAMES).size, 35);
  assert.equal(MATERIAL_SHAPE_NAMES, INTERNAL_NAMES);
  assert.equal(BODY_SHAPES, MATERIAL_SHAPE_NAMES);
  assert.equal(Object.isFrozen(MATERIAL_SHAPE_NAMES), true);
  assert.throws(() => MATERIAL_SHAPE_NAMES.push('custom'));
  for (const shape of MATERIAL_SHAPE_NAMES) {
    const design = createDesign({ body: { shape, color: '#AABBCC' } });
    assert.equal(design.version, 7);
    assert.deepEqual(design.body, { shape, color: '#aabbcc' });
    assert.deepEqual(parseDesign(design), design);
    assert.deepEqual(parseDesign(serializeDesign(design)), design);
    assert.deepEqual(patchDesign(createDesign(), { body: { shape, color: '#AABBCC' } }), design);
    assert.deepEqual(migrateDesign(design), { design, warnings: [] });
  }
});

test('v7 parse, create, and patch reject legacy names, recipes, and custom outlines', () => {
  const invalid = [
    'orb', 'rounded-box', 'droplet', 'Circle', '', 'unknown', null, undefined, 0, [],
    shapes.material('square'), shapes.ellipse(), shapes.roundedPolygon(5),
    shapes.morph(shapes.material('circle'), shapes.material('heart'), 0.5),
    { kind: 'path', d: 'M0,0L1,0L0,1Z' }, { name: 'heart' },
  ];
  for (const shape of invalid) {
    const original = createDesign(), snapshot = structuredClone(original);
    assert.throws(() => createDesign({ body: { shape } }), /body\.shape/);
    assert.throws(() => patchDesign(original, { body: { shape } }), /body\.shape/);
    assert.throws(() => parseDesign({ ...original, body: { ...original.body, shape } }), /body\.shape/);
    assert.deepEqual(original, snapshot);
  }
});

test('v7 rejects every removed body parameter and unknown keys instead of ignoring them', () => {
  for (const [key, value] of Object.entries({ size: [1, 1, 1], roundness: 0.5, taper: 0, bulge: 0, bend: 0, rotation: 0, custom: {} })) {
    const body = { shape: 'square', color: '#aabbcc', [key]: value };
    assert.throws(() => parseDesign({ ...createDesign(), body }), new RegExp(`body\\.${key}`));
    assert.throws(() => createDesign({ body }), new RegExp(`body\\.${key}`));
    assert.throws(() => patchDesign(createDesign(), { body: { [key]: value } }), new RegExp(`body\\.${key}`));
  }
  for (const body of [null, [], 'square', Object.assign(Object.create({ unexpected: true }), { shape: 'square', color: '#aabbcc' })]) {
    assert.throws(() => parseDesign({ ...createDesign(), body }));
    assert.throws(() => createDesign({ body }));
  }
  const body = { shape: 'square', color: '#aabbcc', [Symbol('custom')]: true };
  assert.throws(() => parseDesign({ ...createDesign(), body }));
  assert.throws(() => createDesign({ body }));
  assert.throws(() => createDesign({ version: 2 }));
});

test('all saved legacy Material selections retain their catalog names with legacy defaults', () => {
  for (const name of MATERIAL_SHAPE_NAMES) for (const bulge of [0, 0.05]) {
    const input = legacy(shapes.material(name), { bulge });
    const snapshot = structuredClone(input), parsed = parseDesign(input);
    assert.deepEqual(parsed.body, { shape: name, color: '#e9b64d' });
    assert.deepEqual(parseDesign(JSON.stringify(input)), parsed);
    assert.deepEqual(input, snapshot);
  }
});

test('equally scaled legacy catalog recipes match themselves through the outline comparator', () => {
  for (const name of MATERIAL_SHAPE_NAMES) {
    const parsed = parseDesign(legacy(shapes.material(name), { size: [1.4, 1.4, 0.8], bulge: 0 }));
    assert.equal(parsed.body.shape, name);
  }
});

test('JSON roundtrip isolates body, eye, and accessory data without resurrecting removed fields', () => {
  const original = createDesign({
    body: { shape: 'flower', color: '#ABCDEF' },
    eyes: { left: { expression: 'smile', openness: 0.75 }, right: { expression: 'blink' } },
    accessories: [createAccessory('beret'), createAccessory('glasses')],
  });
  const snapshot = structuredClone(original), roundtrip = parseDesign(serializeDesign(original));
  assert.deepEqual(roundtrip, original);
  roundtrip.body.shape = 'heart'; roundtrip.eyes.left.weights.blink = 0;
  roundtrip.eyes.color = '#ffffff'; roundtrip.accessories[0].color = '#abcdef';
  assert.deepEqual(original, snapshot);
  assert.deepEqual(Object.keys(JSON.parse(serializeDesign(original)).body).sort(), ['color', 'shape']);
});

test('body and per-eye patches preserve independent nested properties', () => {
  const source = createDesign({ eyes: { left: { openness: 0.6 }, right: { expression: 'smile' } } });
  const changed = patchDesign(source, { body: { shape: 'heart' }, eyes: { left: { expression: 'blink' } } });
  assert.equal(changed.body.shape, 'heart'); assert.equal(changed.body.color, source.body.color);
  assert.deepEqual(changed.eyes.left.weights, { smile: 0, blink: 1 });
  assert.deepEqual(changed.eyes.right, source.eyes.right);
  changed.eyes.right.weights.blink = 0.1; assert.equal(source.eyes.right.weights.blink, 0);
});

test('v7 retains strict surface-eye and document validation', () => {
  for (const change of [
    d => d.eyes.anchor = { region: 'face', uv: [0,0], offset: .01 }, d => d.eyes.shape = 'round',
    d => d.eyes.left.weights.smile = 2, d => d.eyes.right.weights.blink = NaN,
    d => d.eyes.width = 0, d => d.eyes.height = 2, d => d.eyes.left.typo = 1,
    d => d.version = 8, d => d.extra = 1, d => delete d.body.color,
  ]) { const design = createDesign(); change(design); assert.throws(() => parseDesign(design)); }
  assert.throws(() => parseDesign(' '.repeat(65537)), /64 KiB/);
  assert.throws(() => parseDesign('{invalid JSON}'));
});
