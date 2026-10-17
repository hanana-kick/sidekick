import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACCESSORY_PRESETS, ACCESSORY_SLOTS, ACCESSORY_SLOT_BY_PRESET, ACCESSORY_SLOTS_BY_PRESET,
  createAccessory, createDesign, equipAccessory, removeAccessory, migrateDesign, parseDesign, patchDesign, serializeDesign,
} from '../dist/src/core/design.js';
import { resolveDesign } from '../dist/src/core/resolved-design.js';
import { SidekickAvatar } from '../dist/src/element/avatar.js';
import { RenderEngine } from '../dist/src/runtime/render-engine.js';
import { bareAvatarFixture } from './helpers/render-runtime.mjs';
import { legacyDesign, legacyAccessory } from './legacy-fixtures.mjs';

const fixedPresets = ['beret', 'halo', 'crown', 'glasses', 'sunglasses', 'moustache', 'goatee', 'bowTie', 'scarf', 'necklace'];
const make = (preset, id, slot = preset === 'earring' || preset === 'starEarring' ? 'leftEar' : ACCESSORY_SLOT_BY_PRESET[preset]) => createAccessory(preset, { slot, ...(id === undefined ? {} : { id }) });
const complete = () => ['beret', 'glasses', 'moustache', 'bowTie'].map(preset => createAccessory(preset)).concat([
  createAccessory('earring', { slot: 'leftEar' }), createAccessory('earring', { slot: 'rightEar' }),
]);
const withoutSlot = accessory => { const copy = structuredClone(accessory); delete copy.slot; return copy; };
function savedDesign(version, accessories = [legacyAccessory('beret', 'hat'), legacyAccessory('glasses', 'specs')]) {
  const design = legacyDesign(version);
  design.accessories = accessories.map(accessory => version === 6
    ? Object.fromEntries(Object.entries(accessory).filter(([key]) => ['id', 'preset', 'slot', 'color'].includes(key)))
    : structuredClone(accessory));
  return design;
}
const avatarForTest = () => bareAvatarFixture(SidekickAvatar, RenderEngine, true);

test('v7 slots and all preset mappings are complete, immutable and side-aware', () => {
  assert.equal(createDesign().version, 7);
  assert.deepEqual(ACCESSORY_PRESETS, [...fixedPresets, 'earring', 'starEarring']);
  assert.deepEqual(ACCESSORY_SLOTS, ['head', 'eyes', 'mouth', 'neck', 'leftEar', 'rightEar']);
  assert.deepEqual(ACCESSORY_SLOT_BY_PRESET, { beret: 'head', halo: 'head', crown: 'head', glasses: 'eyes', sunglasses: 'eyes', moustache: 'mouth', goatee: 'mouth', bowTie: 'neck', scarf: 'neck', necklace: 'neck' });
  assert.deepEqual(ACCESSORY_SLOTS_BY_PRESET.earring, ['leftEar', 'rightEar']);
  for (const value of [ACCESSORY_PRESETS, ACCESSORY_SLOTS, ACCESSORY_SLOT_BY_PRESET, ACCESSORY_SLOTS_BY_PRESET, ...Object.values(ACCESSORY_SLOTS_BY_PRESET)]) assert.equal(Object.isFrozen(value), true);
  for (const preset of fixedPresets) assert.equal(createAccessory(preset).slot, ACCESSORY_SLOT_BY_PRESET[preset]);
  assert.throws(() => { ACCESSORY_SLOT_BY_PRESET.halo = 'eyes'; }, TypeError);
  assert.throws(() => ACCESSORY_SLOTS.push('other'), TypeError);
  assert.throws(() => ACCESSORY_SLOTS_BY_PRESET.earring.push('head'), TypeError);
  assert.throws(() => createAccessory('unknown'));
});

test('six independent instances coexist, including two earrings, and round-trip losslessly', () => {
  const design = createDesign({ body: { shape: 'heart' }, eyes: { left: { weights: { smile: .7, blink: .2 } }, right: { weights: { smile: .1, blink: .6 } } }, accessories: complete() });
  assert.deepEqual(design.accessories.map(accessory => accessory.slot), ACCESSORY_SLOTS);
  assert.equal(new Set(design.accessories.map(accessory => accessory.id)).size, 6);
  assert.equal(design.accessories.filter(accessory => accessory.preset === 'earring').length, 2);
  assert.equal(createAccessory('bowTie').id, 'bow-tie');
  assert.deepEqual(parseDesign(serializeDesign(design)), design);
  assert.deepEqual(migrateDesign(design), { design, warnings: [] });
  for (const accessory of design.accessories) assert.deepEqual(Object.keys(accessory).sort(), ['color', 'id', 'preset', 'slot']);
});

test('earrings require explicit sides, create one instance, and use independent default IDs', () => {
  for (const options of [undefined, 'a', {}, { id: 'a' }, { slot: undefined }, { slot: 'both' }, { slot: 'head' }, { slot: 'left' }, { slot: 'left-ear' }, { slot: 'right-ear' }]) assert.throws(() => createAccessory('earring', options), /slot/);
  const left = createAccessory('earring', { slot: 'leftEar' }), right = createAccessory('earring', { slot: 'rightEar' });
  assert.deepEqual([left.id, right.id], ['earring-left', 'earring-right']);
  assert.equal(createDesign({ accessories: [left] }).accessories.length, 1);
  assert.deepEqual(createAccessory('earring', { slot: 'rightEar', id: 'one-custom' }), { ...right, id: 'one-custom' });
});

test('all explicit preset/slot mismatches reject without repairing caller data', () => {
  for (const preset of ACCESSORY_PRESETS) for (const slot of ACCESSORY_SLOTS) {
    if (ACCESSORY_SLOTS_BY_PRESET[preset].includes(slot)) continue;
    assert.throws(() => createAccessory(preset, { slot }), /accessory\.slot/);
    const accessory = { ...make(preset), slot };
    assert.throws(() => createDesign({ accessories: [accessory] }), /accessory\.slot/);
  }
  for (const slot of ['face', 'crown', 'eyewear', '', null, undefined, 1, [], {}]) assert.throws(() => createDesign({ accessories: [{ ...createAccessory('glasses'), slot }] }), /accessory\.slot/);
});

test('strict create, patch, parse and serialization reject all duplicate-slot conflicts atomically', () => {
  for (const [first, second] of [
    [make('beret'), make('halo')], [make('bowTie'), make('scarf')],
    ...ACCESSORY_PRESETS.map(preset => [make(preset, 'first'), make(preset, 'second')]),
    [make('earring', 'first', 'rightEar'), make('earring', 'second', 'rightEar')],
  ]) {
    const before = createDesign({ accessories: [make('glasses')] }), snapshot = structuredClone(before);
    const accessories = [first, second], raw = { ...before, accessories }, rawSnapshot = structuredClone(raw);
    for (const apply of [() => createDesign({ accessories }), () => patchDesign(before, { accessories }), () => parseDesign(raw), () => parseDesign(JSON.stringify(raw)), () => serializeDesign(raw)]) assert.throws(apply, new RegExp(`accessory\\.slot: ${first.slot}`));
    assert.deepEqual(before, snapshot); assert.deepEqual(raw, rawSnapshot);
  }
});

test('IDs remain globally unique across different slots, including opposite earrings', () => {
  for (const accessories of [
    [make('beret', 'same'), make('glasses', 'same')],
    [make('earring', 'same', 'leftEar'), make('earring', 'same', 'rightEar')],
  ]) assert.throws(() => createDesign({ accessories }), /id/);
});

test('v7 and v6 never admit persisted calibration or unknown helper options', () => {
  for (const [key, value] of Object.entries({ anchor: { region: 'left', uv: [0, 0], offset: 0 }, scale: 1, rotation: [0, 0, 0], follow: .5, width: 1, pair: true, side: 'left' })) {
    assert.throws(() => createDesign({ accessories: [{ ...make('earring'), [key]: value }] }), new RegExp(`accessory\\.${key}`));
    const v6 = savedDesign(6); v6.accessories[0][key] = value;
    assert.throws(() => parseDesign(v6), new RegExp(`accessory\\.${key}`));
    assert.throws(() => createAccessory('beret', { [key]: value }), /accessory\.options/);
  }
  let called = false;
  assert.throws(() => createAccessory('earring', { get slot() { called = true; return 'leftEar'; } }));
  assert.equal(called, false);
  for (const options of [null, [], new Date(), { [Symbol('slot')]: 'head' }, Object.create({ slot: 'head' })]) assert.throws(() => createAccessory('beret', options));
});

for (const version of [1, 2, 3, 4, 5, 6]) {
  test(`saved v${version} migrates face to eyes deterministically and retains IDs, colors and weights`, () => {
    const raw = savedDesign(version); raw.accessories[1].color = '#ABCDEF';
    if (version >= 4) { raw.eyes.left.weights = { smile: .8, blink: .3 }; raw.eyes.right.weights = { smile: .2, blink: .6 }; }
    const snapshot = structuredClone(raw), { design, warnings } = migrateDesign(raw);
    assert.equal(design.version, 7); assert.deepEqual(design.accessories.map(accessory => accessory.slot), ['head', 'eyes']);
    assert.deepEqual(design.accessories.map(accessory => accessory.id), ['hat', 'specs']); assert.equal(design.accessories[1].color, '#abcdef');
    if (version >= 4) { assert.deepEqual(design.eyes.left.weights, raw.eyes.left.weights); assert.deepEqual(design.eyes.right.weights, raw.eyes.right.weights); }
    assert.equal(warnings.length, 1); assert.match(warnings[0], new RegExp(`v${version}.*v7`)); assert.match(warnings[0], /face.*eyes/);
    assert.deepEqual(parseDesign(JSON.stringify(raw)), design); assert.deepEqual(parseDesign(serializeDesign(design)), design); assert.deepEqual(raw, snapshot);
    design.accessories[0].color = '#ffffff'; assert.deepEqual(raw, snapshot);
  });

  test(`saved v${version} rejects duplicate slots, new slots, unknown presets and mismatches`, () => {
    assert.throws(() => parseDesign(savedDesign(version, [legacyAccessory('beret'), legacyAccessory('halo')])), /accessory\.slot: head/);
    assert.throws(() => parseDesign(savedDesign(version, [legacyAccessory('glasses', 'first'), legacyAccessory('glasses', 'second')])), /accessory\.slot: eyes/);
    for (const slot of ['eyes', 'mouth', 'neck', 'leftEar', 'rightEar', null, undefined]) {
      const raw = savedDesign(version); raw.accessories[1].slot = slot;
      assert.throws(() => parseDesign(raw), /accessory\.slot/);
    }
    const mismatch = savedDesign(version); mismatch.accessories[0].slot = 'face'; assert.throws(() => parseDesign(mismatch), /accessory\.slot/);
    for (const preset of ['moustache', 'bowTie', 'scarf', 'earring']) {
      const raw = savedDesign(version); raw.accessories[0].preset = preset;
      assert.throws(() => parseDesign(raw), /accessory\.preset/);
    }
  });

  if (version < 6) test(`saved v${version} may infer missing old slots but never silently resolves conflicts`, () => {
    const raw = savedDesign(version, [withoutSlot(legacyAccessory('beret')), withoutSlot(legacyAccessory('glasses'))]);
    assert.deepEqual(parseDesign(raw).accessories.map(accessory => accessory.slot), ['head', 'eyes']);
    const mixed = savedDesign(version, [withoutSlot(legacyAccessory('halo')), legacyAccessory('glasses')]);
    assert.deepEqual(parseDesign(mixed).accessories.map(accessory => accessory.slot), ['head', 'eyes']);
    assert.throws(() => parseDesign(savedDesign(version, [withoutSlot(legacyAccessory('beret')), withoutSlot(legacyAccessory('halo'))])), /accessory\.slot: head/);
  });
}

test('v6 requires its saved slot fields and migrates with no geometry-loss warning', () => {
  const raw = savedDesign(6); delete raw.accessories[0].slot; assert.throws(() => parseDesign(raw), /accessory\.slot/);
  const { design, warnings } = migrateDesign(savedDesign(6)); assert.equal(design.version, 7); assert.doesNotMatch(warnings[0], /Discarded/);
});

test('equipping replaces exactly one slot in place and never mutates any input', () => {
  const before = createDesign({ accessories: complete() }), beforeSnapshot = structuredClone(before);
  for (const replacement of [make('halo', 'new-hat'), make('scarf', 'new-neck'), make('earring', 'new-left', 'leftEar'), make('earring', 'new-right', 'rightEar')]) {
    const accessorySnapshot = structuredClone(replacement), result = equipAccessory(before, replacement);
    assert.deepEqual(result.accessories, before.accessories.map(accessory => accessory.slot === replacement.slot ? replacement : accessory));
    assert.deepEqual(result.body, before.body); assert.deepEqual(result.eyes, before.eyes);
    result.accessories.forEach(accessory => { accessory.color = '#abcdef'; }); result.eyes.left.weights.smile = 1;
    assert.deepEqual(before, beforeSnapshot); assert.deepEqual(replacement, accessorySnapshot);
  }
});

test('equipping vacant slots appends and repeated equip is idempotent', () => {
  const empty = createDesign(), left = make('earring', 'left', 'leftEar'), right = make('earring', 'right', 'rightEar');
  const one = equipAccessory(empty, left), both = equipAccessory(one, right);
  assert.deepEqual(empty.accessories, []); assert.deepEqual(one.accessories, [left]); assert.deepEqual(both.accessories, [left, right]);
  assert.deepEqual(equipAccessory(both, right), both);
  assert.deepEqual(equipAccessory(both, { ...left, color: '#ffffff' }).accessories, [{ ...left, color: '#ffffff' }, right]);
});

test('equip and remove validate atomically, reject cross-slot ID theft, and remove only the selected ID', () => {
  const before = createDesign({ accessories: complete() }), snapshot = structuredClone(before);
  for (const invalid of [make('halo', 'glasses'), { ...make('halo'), slot: 'eyes' }, { ...make('scarf'), scale: NaN }, make('earring', 'earring-right', 'leftEar')]) assert.throws(() => equipAccessory(before, invalid));
  for (const id of ['missing', '__proto__', null, undefined]) assert.throws(() => removeAccessory(before, id));
  const removed = removeAccessory(before, 'earring-left');
  assert.deepEqual(removed.accessories, before.accessories.filter(accessory => accessory.id !== 'earring-left'));
  assert.ok(removed.accessories.some(accessory => accessory.id === 'earring-right'));
  assert.deepEqual(before, snapshot);
  const invalid = { ...before, accessories: [make('bowTie'), make('scarf')] };
  assert.throws(() => equipAccessory(invalid, make('scarf')), /accessory\.slot: neck/);
  assert.throws(() => removeAccessory(invalid, 'scarf'), /accessory\.slot: neck/);
});

test('resolved geometry is internal, side-specific and isolated from canonical equipment', () => {
  const design = createDesign({ accessories: complete() }), snapshot = structuredClone(design);
  const resolved = resolveDesign(design), other = resolveDesign(design);
  assert.equal(resolved.version, 7);
  for (const [slot, region] of [['mouth', 'face'], ['neck', 'face'], ['leftEar', 'left'], ['rightEar', 'right']]) {
    const accessory = resolved.accessories.find(accessory => accessory.slot === slot);
    assert.equal(accessory.anchor.region, region); assert.deepEqual(accessory.rotation, [0, 0, 0]); assert.equal(accessory.scale, 1);
    accessory.anchor.uv[1] = .5;
    assert.notEqual(other.accessories.find(item => item.slot === slot).anchor.uv[1], .5);
  }
  assert.deepEqual(design, snapshot);
});

test('avatar equip/remove preserve unrelated shape, eye and opposite-ear animation clocks', async () => {
  const { avatar, runtime } = avatarForTest(); avatar.design = createDesign({ accessories: complete() });
  const shape = avatar.setShape('heart', { duration: 1000, easing: 'linear' });
  const eyes = avatar.setEyeWeights('both', { smile: .8 }, { duration: 1000, easing: 'linear' });
  const body = avatar.motion.to({ body: { rotation: [0, 1, 0] } }, { duration: 1000, easing: 'linear' });
  const left = avatar.motion.to({ accessories: { 'earring-left': { rotation: [0, 0, 1] } } }, { duration: 1000, easing: 'linear' });
  const right = avatar.motion.to({ accessories: { 'earring-right': { rotation: [0, 0, -1] } } }, { duration: 1000, easing: 'linear' });
  runtime.advanceMotion(300); runtime.advanceShape(300);
  const pose = avatar.pose, contour = structuredClone(runtime.shape.contour);
  await avatar.equipAccessory(make('scarf', 'scarf'));
  assert.deepEqual(avatar.pose, pose); assert.deepEqual(runtime.shape.contour, contour);
  await avatar.removeAccessory('earring-left'); assert.deepEqual(await left, { finished: false });
  assert.equal(avatar.pose.accessories['earring-left'], undefined); assert.deepEqual(avatar.pose.accessories['earring-right'], pose.accessories['earring-right']);
  assert.deepEqual(avatar.pose.eyes, pose.eyes); assert.deepEqual(avatar.pose.rotation, pose.rotation); assert.deepEqual(runtime.shape.contour, contour);
  const before = avatar.design, beforePose = avatar.pose;
  await assert.rejects(avatar.equipAccessory({ ...make('moustache'), slot: 'neck' })); await assert.rejects(avatar.removeAccessory('missing'));
  assert.deepEqual(avatar.design, before); assert.deepEqual(avatar.pose, beforePose);
  runtime.advanceMotion(700); runtime.advanceShape(700);
  for (const pending of [shape, eyes, body, right]) assert.deepEqual(await pending, { finished: true });
  assert.equal(avatar.pose.accessories['earring-left'], undefined); assert.deepEqual(avatar.pose.accessories['earring-right'], [0, 0, -1]);
});


test('every expanded preset replaces only its exclusive slot, and both star earrings require a side', () => {
  for (const preset of ACCESSORY_PRESETS) {
    const sides = preset === 'earring' || preset === 'starEarring' ? ['leftEar', 'rightEar'] : [ACCESSORY_SLOT_BY_PRESET[preset]];
    if (sides.length === 2) assert.throws(() => createAccessory(preset), /leftEar/);
    for (const slot of sides) {
      const before = createDesign({ accessories: complete() }), added = createAccessory(preset, { slot, id: 'new-piece' });
      const after = equipAccessory(before, added);
      assert.equal(after.accessories.length, 6);
      assert.deepEqual(after.accessories.filter(a => a.slot !== slot), before.accessories.filter(a => a.slot !== slot));
      assert.deepEqual(after.accessories.find(a => a.slot === slot), added);
      assert.deepEqual(parseDesign(serializeDesign(after)), after);
      assert.deepEqual(Object.keys(added), ['id', 'preset', 'slot', 'color']);
    }
  }
  assert.equal(createAccessory('starEarring', { slot: 'leftEar' }).id, 'star-earring-left');
  assert.throws(() => createAccessory('starEarring', { slot: 'head' }));
});
