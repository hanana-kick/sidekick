import assert from 'node:assert/strict';
import { validateAccessoryPluginGeometry, validateAccessoryPluginAttachment, validatePartAnimation } from '@hanana-kick/sidekick-plugin-sdk';
import halo from './halo.js';
import glasses from './glasses.js';
import moustache from './moustache.js';
import bowTie from './bow-tie.js';
import { leftEarring, rightEarring } from './earring.js';
import { allSlotsAnimation } from './all-slots-animation.js';
const slots = new Set();
for (const plugin of [halo, glasses, moustache, bowTie, leftEarring, rightEarring]) {
  assert.equal(plugin.apiVersion, 1);
  const attachment = validateAccessoryPluginAttachment(plugin.attachment);
  const geometry = validateAccessoryPluginGeometry(await plugin.createMesh());
  for (const slot of plugin.slots) { assert.ok(!slots.has(slot)); slots.add(slot); }
  console.log(`${plugin.id}: ${geometry.vertices.length / 6} authored vertices, ${geometry.indices.length / 3} authored triangles, ${attachment.mode}`);
}
assert.equal(slots.size, 6);
validatePartAnimation(allSlotsAnimation);
console.log('All six catalog slots and independent animation validated. Runtime fitting and rendered comparisons are separate integration checks.');
