/**
 * sidekick — embeddable bot avatar web components.
 *
 * Importing this module has no side effects: call {@link defineElements} once,
 * or import `sidekick/elements` (auto-registering) instead.
 */

export { defineElements, TAGS } from './elements/define.js';
export { SkkAvatar } from './elements/skk-avatar.js';
export { SkkBot } from './elements/skk-bot.js';
export { SkkBubble, type BubbleTail, type BubbleVariant } from './elements/skk-bubble.js';

export {
  BOT_STATES,
  BotStateMachine,
  STABLE_STATES,
  TRANSIENT_DURATIONS,
  isBotState,
  isLocked,
  isTransient,
  type StateRequestOptions,
  type StateRequestResult,
} from './core/state.js';
export type {
  Alignment,
  AnchorKeyword,
  BotState,
  Insets,
  Mood,
  Offset,
  Overflow,
  Placement,
  PlacementInput,
  PlacementMode,
  PlacementResult,
  Point,
  Rect,
  SavedPosition,
  Shape,
  Side,
  Size,
} from './core/types.js';

export {
  anchorRect,
  clamp,
  clampRect,
  computePlacement,
  finite,
  flipSide,
  nearestEdge,
  normalizeInsets,
  overflowOf,
  parseAnchorKeyword,
  placeAgainstAnchor,
  resolvePlacement,
  snap,
} from './core/geometry.js';
export { createLocalStore, createMemoryStore, noopStore, type PositionStore } from './core/persistence.js';
export { nextFrame, observeLayout, setFrameScheduler, type LayoutHandle } from './core/scheduler.js';

export * from './avatar.js';
export * from './theme.js';
