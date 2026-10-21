import { AccessoryPluginRegistry } from '@hanana-kick/sidekick/core';
// No author asset module is imported until its first registry load/equip.
export function createAllSlotsLazyRegistry() {
  const registry = new AccessoryPluginRegistry();
  registry.registerLazy('catalog/halo', () => import('./halo.js'));
  registry.registerLazy('catalog/glasses', () => import('./glasses.js'));
  registry.registerLazy('catalog/moustache', () => import('./moustache.js'));
  registry.registerLazy('catalog/bow-tie', () => import('./bow-tie.js'));
  registry.registerLazy('catalog/earring-left', async () => (await import('./earring.js')).leftEarring);
  registry.registerLazy('catalog/earring-right', async () => (await import('./earring.js')).rightEarring);
  return registry;
}
