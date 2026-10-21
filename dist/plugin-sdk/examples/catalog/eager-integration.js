// Application bundler entry: load the author modules eagerly, build geometry only
// on first use, and share the one registry across all avatars in this session.
import { AccessoryPluginRegistry } from '@hanana-kick/sidekick/core';
import moustache from './moustache.js';
import bowTie from './bow-tie.js';

export function createEagerCatalogRegistry() {
  const registry = new AccessoryPluginRegistry();
  registry.register(moustache);
  registry.register(bowTie);
  return registry;
}
