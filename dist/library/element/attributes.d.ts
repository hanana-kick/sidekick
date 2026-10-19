import type { Emotion, EmotionValue, EmotionState, EmotionResult } from '../core/emotion.js';
import type { BehaviorState, BehaviorResult } from './behavior.js';
import type { PresenceResult } from './presence.js';
import type { SidekickLifecycleState } from './lifecycle.js';
import type { Activity, AvatarDesign, Vec2 } from '../core/design.js';
import type { BodyOrientation, BodyOrientationPreset } from '../core/body-orientation.js';
import type { EyeExpression } from '../core/expressions.js';
import type { MotionOptions, MotionResult, MotionTarget } from '../core/motion.js';
import type { TrackingMode } from '../core/tracking.js';
import type { AvatarPlacement, AvatarPosition, MovementBounds, MoveResult, MoveOptions, MovementState } from './movement.js';
import type { MaterialShapeName } from '../core/shapes.js';
/** HTML strings are strict: unlike native booleans, the literal "false" disables. */
export type BooleanAttribute = boolean | '' | 'true' | 'false' | '1' | '0';
export type NumericAttribute = number | `${number}`;
export interface SidekickAttributes {
    emotion?: Emotion;
    'emotion-intensity'?: NumericAttribute;
    behavior?: string;
    entrance?: string;
    positioning?: string;
    presence?: string;
    task?: string;
    home?: string;
    placement?: AvatarPlacement;
    'position-x'?: NumericAttribute;
    'position-y'?: NumericAttribute;
    'movement-bounds'?: MovementBounds;
    'move-duration'?: NumericAttribute;
    'move-easing'?: 'linear' | 'smooth';
    'move-travel'?: 'natural' | 'none';
    'move-max-speed'?: number | string;
    'move-acceleration'?: number | string;
    'move-deceleration'?: number | string;
    design?: string;
    shape?: MaterialShapeName;
    'body-color'?: string;
    'eye-color'?: string;
    expression?: EyeExpression;
    'left-expression'?: EyeExpression;
    'right-expression'?: EyeExpression;
    smile?: NumericAttribute;
    blink?: NumericAttribute;
    'left-smile'?: NumericAttribute;
    'right-smile'?: NumericAttribute;
    'left-blink'?: NumericAttribute;
    'right-blink'?: NumericAttribute;
    accessories?: string;
    'head-accessory'?: 'beret' | 'halo' | 'crown' | 'none';
    'head-color'?: string;
    'eyes-accessory'?: 'glasses' | 'sunglasses' | 'none';
    'eyes-color'?: string;
    'mouth-accessory'?: 'moustache' | 'goatee' | 'none';
    'mouth-color'?: string;
    'neck-accessory'?: 'bowTie' | 'scarf' | 'necklace' | 'none';
    'neck-color'?: string;
    'left-ear-accessory'?: 'earring' | 'starEarring' | 'none';
    'left-ear-color'?: string;
    'right-ear-accessory'?: 'earring' | 'starEarring' | 'none';
    'right-ear-color'?: string;
    'body-orientation'?: BodyOrientationPreset;
    'body-yaw'?: NumericAttribute;
    'body-pitch'?: NumericAttribute;
    'body-roll'?: NumericAttribute;
    'zoom'?: NumericAttribute;
    'gaze-x'?: NumericAttribute;
    'gaze-y'?: NumericAttribute;
    activity?: Activity;
    paused?: BooleanAttribute;
    interaction?: 'none' | 'box';
    'mouse-tracking'?: BooleanAttribute;
    'tracking-mode'?: TrackingMode;
    'render-style'?: 'flat' | '3d';
    'shape-duration'?: NumericAttribute;
    'shape-easing'?: 'linear' | 'smooth';
    'motion-duration'?: NumericAttribute;
    'motion-easing'?: 'linear' | 'smooth';
    motion?: string;
    time?: NumericAttribute;
}
export type SidekickAttributeName = keyof SidekickAttributes;
export declare const ACCESSORY_ATTRIBUTE_SLOTS: Readonly<{
    readonly head: "head";
    readonly eyes: "eyes";
    readonly mouth: "mouth";
    readonly neck: "neck";
    readonly 'left-ear': "leftEar";
    readonly 'right-ear': "rightEar";
}>;
export declare const SIDEKICK_ATTRIBUTES: readonly ["emotion", "emotion-intensity", "behavior", "entrance", "positioning", "presence", "task", "home", "placement", "position-x", "position-y", "movement-bounds", "move-duration", "move-easing", "move-travel", "move-max-speed", "move-acceleration", "move-deceleration", "design", "shape", "body-color", "eye-color", "expression", "left-expression", "right-expression", "smile", "blink", "left-smile", "right-smile", "left-blink", "right-blink", "accessories", "head-accessory", "head-color", "eyes-accessory", "eyes-color", "mouth-accessory", "mouth-color", "neck-accessory", "neck-color", "left-ear-accessory", "left-ear-color", "right-ear-accessory", "right-ear-color", "body-orientation", "body-yaw", "body-pitch", "body-roll", "zoom", "gaze-x", "gaze-y", "activity", "paused", "interaction", "mouse-tracking", "tracking-mode", "render-style", "shape-duration", "shape-easing", "motion-duration", "motion-easing", "motion", "time"];
export declare const REMOVED_ORIENTATION_ATTRIBUTES: Readonly<{
    camera: "body-orientation";
    'camera-yaw': "body-yaw";
    'camera-pitch': "body-pitch";
    'camera-roll': "body-roll";
    'camera-zoom': "zoom";
    view: "body-orientation";
    'view-yaw': "body-yaw";
    'view-pitch': "body-pitch";
    'view-roll': "body-roll";
    'view-zoom': "zoom";
}>;
export interface SidekickErrorDetail {
    message: string;
    attribute?: string;
    value?: string | null;
    recoverable?: boolean;
}
export interface SidekickDesignChangeDetail {
    design: AvatarDesign;
}
export interface SidekickBodyOrientationChangeDetail {
    bodyOrientation: BodyOrientation;
}
export interface SidekickZoomChangeDetail {
    zoom: number;
}
export interface SidekickEventMap {
    'sidekick-emotion-change': CustomEvent<EmotionState>;
    'sidekick-reaction-end': CustomEvent<EmotionResult>;
    'sidekick-behavior-change': CustomEvent<BehaviorState>;
    'sidekick-behavior-end': CustomEvent<BehaviorResult>;
    'sidekick-lifecycle-change': CustomEvent<SidekickLifecycleState>;
    'sidekick-enter-end': CustomEvent<PresenceResult>;
    'sidekick-exit-end': CustomEvent<PresenceResult>;
    'sidekick-move-end': CustomEvent<MoveResult>;
    'sidekick-move-progress': CustomEvent<MovementState>;
    'sidekick-play-end': CustomEvent<MotionResult>;
    'sidekick-transition-end': CustomEvent<MotionResult>;
    'sidekick-ready': CustomEvent<Record<string, never>>;
    'sidekick-design-change': CustomEvent<SidekickDesignChangeDetail>;
    'sidekick-body-orientation-change': CustomEvent<SidekickBodyOrientationChangeDetail>;
    'sidekick-zoom-change': CustomEvent<SidekickZoomChangeDetail>;
    'sidekick-motion-end': CustomEvent<MotionResult>;
    'sidekick-shape-end': CustomEvent<MotionResult>;
    'sidekick-activate': CustomEvent<Record<string, never>>;
    'sidekick-error': CustomEvent<SidekickErrorDetail>;
}
export type AttributeValues = ReadonlyMap<string, string>;
export interface ResolvedAttributes {
    emotion: EmotionValue;
    placement: AvatarPlacement;
    position: AvatarPosition;
    movementBounds: MovementBounds;
    moveOptions: MoveOptions;
    design: AvatarDesign;
    bodyOrientation: BodyOrientation;
    zoom: number;
    gaze: Vec2;
    activity: Activity;
    paused: boolean;
    interaction: 'none' | 'box';
    mouseTracking: boolean;
    trackingMode: TrackingMode;
    shapeOptions: Required<MotionOptions>;
    motionOptions: Required<MotionOptions>;
    motion?: MotionTarget;
    time: number;
}
export declare class SidekickAttributeError extends TypeError {
    readonly attribute: string;
    readonly value: string | null;
    constructor(attribute: string, value: string | null, cause: unknown);
}
export declare function parseBooleanAttribute(value: string | null): boolean;
/** Resolve declarative precedence without mutating an element, live timelines or caller data. */
export declare function resolveSidekickAttributes(attributes: AttributeValues): ResolvedAttributes;
