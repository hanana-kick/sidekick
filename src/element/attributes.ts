import type { PresenceResult } from './presence.js';
import { ACTIVITIES, createAccessory, createDesign, equipAccessory, finite, parseDesign } from '../core/design.js';
import type { AccessoryPreset, AccessorySlot, Activity, AvatarDesign, Vec2 } from '../core/design.js';
import { bodyOrientationPreset, createBodyOrientation } from '../core/body-orientation.js';
import { ZOOM_RANGE } from '../core/zoom.js';
import type { BodyOrientation, BodyOrientationPreset } from '../core/body-orientation.js';
import { eyeExpressionWeights } from '../core/expressions.js';
import type { EyeExpression } from '../core/expressions.js';
import { MotionTimeline, validateMotionOptions } from '../core/motion.js';
import type { MotionOptions, MotionResult, MotionTarget } from '../core/motion.js';
import { validateShapeMotionOptions } from '../core/shape-motion.js';
import { parseTrackingMode } from '../core/tracking.js';
import type { TrackingMode } from '../core/tracking.js';
import type { AvatarPlacement, AvatarPosition, MovementBounds, MoveResult, MoveOptions, MovementState } from './movement.js';
import type { MaterialShapeName } from '../core/shapes.js';

/** HTML strings are strict: unlike native booleans, the literal "false" disables. */
export type BooleanAttribute = boolean | '' | 'true' | 'false' | '1' | '0';
export type NumericAttribute = number | `${number}`;
export interface SidekickAttributes {
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
export const ACCESSORY_ATTRIBUTE_SLOTS = Object.freeze({ head: 'head', eyes: 'eyes', mouth: 'mouth', neck: 'neck', 'left-ear': 'leftEar', 'right-ear': 'rightEar' } as const);
export const SIDEKICK_ATTRIBUTES = Object.freeze([
  'placement', 'position-x', 'position-y', 'movement-bounds', 'move-duration', 'move-easing', 'move-travel', 'move-max-speed', 'move-acceleration', 'move-deceleration',
  'design', 'shape', 'body-color', 'eye-color', 'expression', 'left-expression', 'right-expression',
  'smile', 'blink', 'left-smile', 'right-smile', 'left-blink', 'right-blink', 'accessories',
  'head-accessory', 'head-color', 'eyes-accessory', 'eyes-color', 'mouth-accessory', 'mouth-color',
  'neck-accessory', 'neck-color', 'left-ear-accessory', 'left-ear-color', 'right-ear-accessory', 'right-ear-color',
  'body-orientation', 'body-yaw', 'body-pitch', 'body-roll', 'zoom', 'gaze-x', 'gaze-y', 'activity', 'paused',
  'interaction', 'mouse-tracking', 'tracking-mode', 'render-style', 'shape-duration', 'shape-easing', 'motion-duration', 'motion-easing', 'motion', 'time',
] as const satisfies readonly SidekickAttributeName[]);

export const REMOVED_ORIENTATION_ATTRIBUTES = Object.freeze({
  camera: 'body-orientation', 'camera-yaw': 'body-yaw', 'camera-pitch': 'body-pitch', 'camera-roll': 'body-roll', 'camera-zoom': 'zoom',
  view: 'body-orientation', 'view-yaw': 'body-yaw', 'view-pitch': 'body-pitch', 'view-roll': 'body-roll', 'view-zoom': 'zoom',
});

export interface SidekickErrorDetail { message: string; attribute?: string; value?: string | null; recoverable?: boolean }
export interface SidekickDesignChangeDetail { design: AvatarDesign }
export interface SidekickBodyOrientationChangeDetail { bodyOrientation: BodyOrientation }
export interface SidekickZoomChangeDetail { zoom: number }
export interface SidekickEventMap {
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
export class SidekickAttributeError extends TypeError {
  constructor(readonly attribute: string, readonly value: string | null, cause: unknown) {
    super(`${attribute}: ${cause instanceof Error ? cause.message : String(cause)}`, { cause });
    this.name = 'SidekickAttributeError';
  }
}
export function parseBooleanAttribute(value: string | null): boolean {
  if (value === null || value === 'false' || value === '0') return false;
  if (value === '' || value === 'true' || value === '1') return true;
  throw new TypeError('expected an empty value, true, false, 1, or 0');
}
function number(value: string, min: number, max: number, name: string): number {
  // Reject empty text, hexadecimal, units, Infinity and NaN rather than coercing them.
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())) throw new TypeError('expected a decimal number');
  return finite(Number(value), min, max, name);
}
function json(value: string): unknown {
  if (value.length > 65536) throw new RangeError('JSON must be at most 64 KiB');
  return JSON.parse(value);
}
function color(value: string): string {
  if (!/^#[0-9a-f]{6}$/i.test(value)) throw new TypeError('expected #RRGGBB');
  return value.toLowerCase();
}
function choice<T extends string>(value: string, choices: readonly T[]): T {
  if (!choices.includes(value as T)) throw new TypeError(`expected ${choices.join(', ')}`);
  return value as T;
}
/** Resolve declarative precedence without mutating an element, live timelines or caller data. */
export function resolveSidekickAttributes(attributes: AttributeValues): ResolvedAttributes {
  for (const [name, replacement] of Object.entries(REMOVED_ORIENTATION_ATTRIBUTES)) {
    if (attributes.has(name)) throw new SidekickAttributeError(name, attributes.get(name)!, new TypeError(`removed attribute; use ${replacement} instead`));
  }
  const read = <T>(name: string, parse: (value: string) => T, fallback: T): T => {
    const value = attributes.get(name);
    if (value === undefined) return fallback;
    try { return parse(value); } catch (cause) { throw new SidekickAttributeError(name, value, cause); }
  };
  let design = read('design', value => parseDesign(value), createDesign());
  design.body.shape = read('shape', value => parseDesign({ ...design, body: { ...design.body, shape: value } }).body.shape, design.body.shape);
  design.body.color = read('body-color', color, design.body.color);
  design.eyes.color = read('eye-color', color, design.eyes.color);
  const expression = read('expression', value => eyeExpressionWeights(value as EyeExpression), undefined);
  for (const side of ['left', 'right'] as const) {
    if (expression) design.eyes[side].weights = { ...expression };
    design.eyes[side].weights = read(`${side}-expression`, value => eyeExpressionWeights(value as EyeExpression), design.eyes[side].weights);
    for (const weight of ['smile', 'blink'] as const) {
      const common = read(weight, value => number(value, 0, 1, weight), design.eyes[side].weights[weight]);
      design.eyes[side].weights[weight] = read(`${side}-${weight}`, value => number(value, 0, 1, `${side}-${weight}`), common);
    }
  }
  design.accessories = read('accessories', value => parseDesign({ ...design, accessories: json(value) }).accessories, design.accessories);
  for (const [prefix, slot] of Object.entries(ACCESSORY_ATTRIBUTE_SLOTS)) {
    const selected = read(`${prefix}-accessory`, value => {
      if (value === 'none') return 'none';
      return createAccessory(value as AccessoryPreset, { slot: slot as AccessorySlot });
    }, undefined);
    if (selected === 'none') design.accessories = design.accessories.filter(item => item.slot !== slot);
    else if (selected) {
      // Validate duplicate IDs at the originating attribute, before any live changes.
      design = read(`${prefix}-accessory`, () => equipAccessory(design, selected), design);
    }
    const tint = read(`${prefix}-color`, color, undefined);
    if (tint !== undefined) {
      const accessory = design.accessories.find(item => item.slot === slot);
      if (accessory) accessory.color = tint;
    }
  }
  let bodyOrientation = read('body-orientation', value => createBodyOrientation(bodyOrientationPreset(value as BodyOrientationPreset)), createBodyOrientation());
  for (const axis of ['yaw', 'pitch', 'roll'] as const) {
    const limit = axis === 'yaw' ? 360 : axis === 'pitch' ? 90 : 180;
    bodyOrientation = { ...bodyOrientation, [axis]: read(`body-${axis}`, value => number(value, -limit, limit, `body-${axis}`), bodyOrientation[axis]) };
  }
  const zoom = read('zoom', value => number(value, ZOOM_RANGE.min, ZOOM_RANGE.max, 'zoom'), 1);
  const options = (prefix: 'shape' | 'motion'): Required<MotionOptions> => {
    const duration = read(`${prefix}-duration`, value => number(value, 0, 60000, 'duration'), prefix === 'shape' ? 450 : 400);
    const easing = read(`${prefix}-easing`, value => choice(value, ['linear', 'smooth'] as const), 'smooth' as const);
    return prefix === 'shape' ? validateShapeMotionOptions({ duration, easing }) : validateMotionOptions({ duration, easing });
  };
  const shapeOptions = options('shape'), motionOptions = options('motion');
  const motion = read('motion', value => {
    const target = json(value) as MotionTarget;
    // A throwaway timeline reuses the authoritative full target validator.
    void new MotionTimeline({ left: design.eyes.left, right: design.eyes.right }).to(target, { duration: 0 });
    return target;
  }, undefined);
  const legacyTracking = read('mouse-tracking', parseBooleanAttribute, undefined);
  const trackingMode = read('tracking-mode', parseTrackingMode, legacyTracking === undefined ? 'eyes-and-body' : legacyTracking ? 'eyes' : 'off');
  read('render-style', value => choice(value, ['flat', '3d']), 'flat');
  return {
    placement: read('placement', value => choice(value, ['inline', 'viewport']), 'inline'),
    position: { x: read('position-x', value => number(value, -1e7, 1e7, 'position-x'), 0), y: read('position-y', value => number(value, -1e7, 1e7, 'position-y'), 0) },
    movementBounds: read('movement-bounds', value => choice(value, ['viewport', 'none']), 'viewport'),
    moveOptions: { maxSpeed: read('move-max-speed', value => number(value, 1, 100000, 'move-max-speed'), undefined), acceleration: read('move-acceleration', value => number(value, 1, 100000, 'move-acceleration'), 1800), deceleration: read('move-deceleration', value => number(value, 1, 100000, 'move-deceleration'), 2200), travel: read('move-travel', value => choice(value, ['natural', 'none'] as const), 'natural'), duration: read('move-duration', value => number(value, 0, 60000, 'move-duration'), 0), easing: read('move-easing', value => choice(value, ['linear', 'smooth'] as const), 'smooth') },
    design: parseDesign(design), bodyOrientation, zoom,
    gaze: [read('gaze-x', value => number(value, -1, 1, 'gaze-x'), 0), read('gaze-y', value => number(value, -1, 1, 'gaze-y'), 0)],
    activity: read('activity', value => choice(value, ACTIVITIES), 'idle'),
    paused: read('paused', parseBooleanAttribute, false),
    interaction: read('interaction', value => choice(value, ['none', 'box']), 'none'),
    mouseTracking: trackingMode !== 'off', trackingMode,
    shapeOptions, motionOptions, motion,
    time: read('time', value => number(value, 0, 86400, 'time'), 0),
  };
}
