import type { Activity, AvatarDesign, Vec2 } from '../core/design.js';
import type { CameraAngles, CameraPreset } from '../core/camera.js';
import type { EyeExpression } from '../core/expressions.js';
import type { MotionOptions, MotionResult, MotionTarget } from '../core/motion.js';
import type { MaterialShapeName } from '../core/shapes.js';
/** HTML strings are strict: unlike native booleans, the literal "false" disables. */
export type BooleanAttribute = boolean | '' | 'true' | 'false' | '1' | '0';
export type NumericAttribute = number | `${number}`;
export interface SidekickAttributes {
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
    camera?: CameraPreset;
    'camera-yaw'?: NumericAttribute;
    'camera-pitch'?: NumericAttribute;
    'camera-roll'?: NumericAttribute;
    'gaze-x'?: NumericAttribute;
    'gaze-y'?: NumericAttribute;
    activity?: Activity;
    paused?: BooleanAttribute;
    interaction?: 'none' | 'box';
    'mouse-tracking'?: BooleanAttribute;
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
export declare const SIDEKICK_ATTRIBUTES: readonly ["design", "shape", "body-color", "eye-color", "expression", "left-expression", "right-expression", "smile", "blink", "left-smile", "right-smile", "left-blink", "right-blink", "accessories", "head-accessory", "head-color", "eyes-accessory", "eyes-color", "mouth-accessory", "mouth-color", "neck-accessory", "neck-color", "left-ear-accessory", "left-ear-color", "right-ear-accessory", "right-ear-color", "camera", "camera-yaw", "camera-pitch", "camera-roll", "gaze-x", "gaze-y", "activity", "paused", "interaction", "mouse-tracking", "render-style", "shape-duration", "shape-easing", "motion-duration", "motion-easing", "motion", "time"];
export interface SidekickErrorDetail {
    message: string;
    attribute?: string;
    value?: string | null;
    recoverable?: boolean;
}
export interface SidekickDesignChangeDetail {
    design: AvatarDesign;
}
export interface SidekickCameraChangeDetail {
    camera: CameraAngles;
}
export interface SidekickEventMap {
    'sidekick-ready': CustomEvent<Record<string, never>>;
    'sidekick-design-change': CustomEvent<SidekickDesignChangeDetail>;
    'sidekick-camera-change': CustomEvent<SidekickCameraChangeDetail>;
    'sidekick-motion-end': CustomEvent<MotionResult>;
    'sidekick-shape-end': CustomEvent<MotionResult>;
    'sidekick-activate': CustomEvent<Record<string, never>>;
    'sidekick-error': CustomEvent<SidekickErrorDetail>;
}
export type AttributeValues = ReadonlyMap<string, string>;
export interface ResolvedAttributes {
    design: AvatarDesign;
    camera: CameraAngles;
    gaze: Vec2;
    activity: Activity;
    paused: boolean;
    interaction: 'none' | 'box';
    mouseTracking: boolean;
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
