// Host application example. External author assets import the SDK only.
import { AccessoryPluginRegistry, createDesign, createAccessory } from '@hanana-kick/sidekick/core';
import halo from './halo.js';
import glasses from './glasses.js';
import moustache from './moustache.js';
import bowTie from './bow-tie.js';
import { leftEarring, rightEarring } from './earring.js';
export const allSlotDefinitions = [
  { plugin: halo, preset: 'halo', slot: 'head', id: 'plugin-halo' },
  { plugin: glasses, preset: 'glasses', slot: 'eyes', id: 'plugin-glasses' },
  { plugin: moustache, preset: 'moustache', slot: 'mouth', id: 'plugin-moustache' },
  { plugin: bowTie, preset: 'bowTie', slot: 'neck', id: 'plugin-bow-tie' },
  { plugin: leftEarring, preset: 'earring', slot: 'leftEar', id: 'plugin-earring-left' },
  { plugin: rightEarring, preset: 'earring', slot: 'rightEar', id: 'plugin-earring-right' },
];
export function createAllSlotsEagerRegistry() {
  const registry = new AccessoryPluginRegistry();
  for (const entry of allSlotDefinitions) registry.register(entry.plugin);
  return registry;
}
export async function equipAllSlots(bot, registry) {
  return Promise.all(allSlotDefinitions.map(entry => bot.equipPluginAccessory(registry, entry.plugin.id, {
    slot: entry.slot, id: entry.id, color: createAccessory(entry.preset, { slot: entry.slot }).color,
  })));
}
export async function compareAllSlots(reference, external, registry = createAllSlotsEagerRegistry()) {
  await reference.setDesign(createDesign({ accessories: allSlotDefinitions.map(entry => createAccessory(entry.preset, { slot: entry.slot, id: entry.id.replace('plugin-', 'reference-') })) }));
  await external.setDesign(createDesign({ accessories: [] }));
  await equipAllSlots(external, registry);
  return registry;
}
