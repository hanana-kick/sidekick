/** Explicit registration entry. Importing this module does not define an element. */
export * from './core.js';
export { SidekickAvatar, defineSidekick } from './element/avatar.js';
export * from './element/attributes.js';
export type { AvatarPlacement, AvatarPosition, MovementBounds, MoveResult, MoveOptions, MovementState } from './element/movement.js';
export type { PlayOptions, AssetTransitionTarget } from './element/playback.js';
export type { PresenceEdge, PresenceState, PresenceResult, EnterOptions, ExitOptions } from './element/presence.js';
export type { MoveToElementOptions, HorizontalAlignment, VerticalAlignment } from './element/element-target.js';
export type { ElementAnchorState } from './element/element-anchor.js';
export type { BotBehavior, BehaviorTarget, BehaviorSide, BehaviorPhase, BehaviorState, BehaviorResult, PerformOptions } from './element/behavior.js';
