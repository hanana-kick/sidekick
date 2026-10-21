// Application bundler example: install both runtime and SDK from the same release.
import { AccessoryPluginRegistry } from '@hanana-kick/sidekick/core';
import { defineSidekick } from '@hanana-kick/sidekick/register';
defineSidekick();

export async function equipEager(bot) {
  const { default: badge, badgeAnimation } = await import('./badge.js');
  const registry = new AccessoryPluginRegistry();
  registry.register(badge);
  const result = await bot.equipPluginAccessory(registry, badge.id, { slot: 'mouth', id: 'starter-badge', color: '#df579b' });
  if (result.finished) bot.setPartAnimation(badgeAnimation);
  return registry; // Application owns registry lifetime; share it across avatars.
}

export async function equipLazy(bot) {
  const registry = new AccessoryPluginRegistry();
  let loaded;
  registry.registerLazy('starter/badge', async () => { loaded = await import('./generated/badge.js'); return loaded; });
  const result = await bot.equipPluginAccessory(registry, 'starter/badge', { slot: 'mouth', id: 'starter-badge', color: '#df579b' });
  if (result.finished) bot.setPartAnimation(loaded.badgeAnimation);
  return registry;
}
// bot.pausePartAnimation(); bot.seekPartAnimation(.75); bot.playPartAnimation();
// bot.clearPartAnimation(); bot.removePluginAccessory('mouth');
