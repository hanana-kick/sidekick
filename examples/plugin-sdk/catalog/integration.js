// This is application code. Asset author modules depend ONLY on the public SDK.
import { createDesign, createAccessory } from '@hanana-kick/sidekick/core';
import { catalogAccessoryAnimation } from './animation.js';

export async function equipCatalogPlugins(bot, registry) {
  return Promise.all([
    bot.equipPluginAccessory(registry, 'catalog/moustache', { slot: 'mouth', id: 'plugin-moustache', color: '#31323d' }),
    bot.equipPluginAccessory(registry, 'catalog/bow-tie', { slot: 'neck', id: 'plugin-bow-tie', color: '#b84742' }),
  ]);
}

export async function compareCatalogPlugins(referenceBot, pluginBots, registry) {
  // Keep a separate, unmodified built-in reference. Do not register aliases for
  // built-in IDs or replace the runtime's own catalog definitions.
  await referenceBot.setDesign(createDesign({ body: { shape: 'circle' }, accessories: [
    createAccessory('moustache', { id: 'reference-moustache' }),
    createAccessory('bowTie', { id: 'reference-bow-tie' }),
  ] }));
  await Promise.all(pluginBots.map(async bot => {
    await bot.setDesign(createDesign({ body: { shape: 'circle' }, accessories: [] }));
    await equipCatalogPlugins(bot, registry);
  }));
  return registry; // Keep it alive while avatars use it; dispose when finished.
}

export function playCatalogAnimation(bot) {
  bot.setPartAnimation(catalogAccessoryAnimation);
  // bot.pausePartAnimation(); bot.seekPartAnimation(.75); bot.playPartAnimation();
  // bot.clearPartAnimation(); removes this clip, not the equipped accessories.
}
