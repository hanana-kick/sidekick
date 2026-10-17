import { SkkAvatar } from './skk-avatar.js';
import { SkkBot } from './skk-bot.js';
import { SkkBubble } from './skk-bubble.js';

export const TAGS = {
  avatar: 'skk-avatar',
  bot: 'skk-bot',
  bubble: 'skk-bubble',
} as const;

/**
 * Registers the custom elements. Idempotent and safe to call on every import;
 * it is a no-op outside a browser (SSR) and when already defined.
 */
export function defineElements(): void {
  if (typeof window === 'undefined' || !('customElements' in window)) return;
  const registry: Record<string, CustomElementConstructor> = {
    [TAGS.avatar]: SkkAvatar,
    [TAGS.bot]: SkkBot,
    [TAGS.bubble]: SkkBubble,
  };
  for (const [tag, ctor] of Object.entries(registry)) {
    if (!customElements.get(tag)) customElements.define(tag, ctor);
  }
}
