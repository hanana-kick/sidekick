// Separate application entry: neither asset module loads before its first use.
// Reuse the registry across avatars to deduplicate both imports and factories.
import { AccessoryPluginRegistry } from '@hanana-kick/sidekick/core';

export function createLazyCatalogRegistry() {
  const registry = new AccessoryPluginRegistry();
  registry.registerLazy('catalog/moustache', () => import('./moustache.js'));
  registry.registerLazy('catalog/bow-tie', () => import('./bow-tie.js'));
  return registry;
}
