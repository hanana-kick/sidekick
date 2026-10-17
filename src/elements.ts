/**
 * Element-only entry: import this when you want the custom elements without
 * pulling the avatar engine's public API into the same chunk.
 *
 * Registers nothing on import (tree-shaking friendly); call `defineElements()`,
 * or import `sidekick/elements/auto` for the self-registering build.
 */
import { defineElements, TAGS } from './elements/define.js';

export { SkkAvatar } from './elements/skk-avatar.js';
export { SkkBot } from './elements/skk-bot.js';
export { SkkBubble } from './elements/skk-bubble.js';
export { defineElements, TAGS };
export type TagMap = typeof TAGS;
