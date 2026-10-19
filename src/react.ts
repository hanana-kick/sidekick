'use client';

import { createElement, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import type { HTMLAttributes, ReactElement, Ref } from 'react';
import type { AccessoryDesign, Activity, AvatarDesign, RenderStyle } from './core/design.js';
import type { BodyOrientation, BodyOrientationPreset } from './core/body-orientation.js';
import type { EyeExpression } from './core/expressions.js';
import type { MotionOptions, MotionTarget } from './core/motion.js';
import type { TrackingMode } from './core/tracking.js';
import type { MaterialShapeName } from './core/shapes.js';
import type { SidekickAvatar as SidekickElement } from './element/avatar.js';
import type { SidekickAttributes, SidekickEventMap } from './element/attributes.js';
import type { Emotion } from './core/emotion.js';
import type { BotBehavior } from './element/behavior.js';

export type SidekickAvatarRef = SidekickElement;
export type SidekickEventHandler<K extends keyof SidekickEventMap> = (event: SidekickEventMap[K]) => void;

/** React 19 wrapper. The ref is published after the custom element has upgraded. */
export interface SidekickAvatarProps extends Omit<HTMLAttributes<SidekickElement>, 'onError' | 'children' | 'dangerouslySetInnerHTML'> {
  ref?: Ref<SidekickElement>;
  placement?: SidekickAttributes['placement'];
  positionX?: number;
  positionY?: number;
  movementBounds?: SidekickAttributes['movement-bounds'];
  moveDuration?: number;
  moveMaxSpeed?: number;
  moveAcceleration?: number;
  moveDeceleration?: number;
  moveEasing?: MotionOptions['easing'];
  moveTravel?: SidekickAttributes['move-travel'];
  onEnterEnd?: SidekickEventHandler<'sidekick-enter-end'>;
  onExitEnd?: SidekickEventHandler<'sidekick-exit-end'>;
  onMoveProgress?: SidekickEventHandler<'sidekick-move-progress'>;
  onMoveEnd?: SidekickEventHandler<'sidekick-move-end'>;
  onPlayEnd?: SidekickEventHandler<'sidekick-play-end'>;
  onAssetTransitionEnd?: SidekickEventHandler<'sidekick-transition-end'>;
  /** Declarative intent, assigned as a property after the native element upgrades. */
  behavior?: BotBehavior | null;
  emotion?: Emotion;
  emotionIntensity?: number;
  onEmotionChange?: SidekickEventHandler<'sidekick-emotion-change'>;
  onReactionEnd?: SidekickEventHandler<'sidekick-reaction-end'>;
  onBehaviorChange?: SidekickEventHandler<'sidekick-behavior-change'>;
  onBehaviorEnd?: SidekickEventHandler<'sidekick-behavior-end'>;
  design?: AvatarDesign;
  shape?: MaterialShapeName;
  bodyColor?: string;
  eyeColor?: string;
  expression?: EyeExpression;
  leftExpression?: EyeExpression;
  rightExpression?: EyeExpression;
  smile?: number;
  blink?: number;
  leftSmile?: number;
  rightSmile?: number;
  leftBlink?: number;
  rightBlink?: number;
  accessories?: readonly AccessoryDesign[];
  headAccessory?: SidekickAttributes['head-accessory'];
  headColor?: string;
  eyesAccessory?: SidekickAttributes['eyes-accessory'];
  eyesColor?: string;
  mouthAccessory?: SidekickAttributes['mouth-accessory'];
  mouthColor?: string;
  neckAccessory?: SidekickAttributes['neck-accessory'];
  neckColor?: string;
  leftEarAccessory?: SidekickAttributes['left-ear-accessory'];
  leftEarColor?: string;
  rightEarAccessory?: SidekickAttributes['right-ear-accessory'];
  rightEarColor?: string;
  bodyOrientation?: BodyOrientationPreset | Partial<BodyOrientation>;
  bodyYaw?: number;
  bodyPitch?: number;
  bodyRoll?: number;
  zoom?: number;
  gazeX?: number;
  gazeY?: number;
  activity?: Activity;
  paused?: boolean;
  interaction?: 'none' | 'box';
  /** Legacy eyes-only alias; trackingMode takes precedence when supplied. */
  mouseTracking?: boolean;
  /** Defaults to eyes-and-body when neither tracking prop is supplied. */
  trackingMode?: TrackingMode;
  renderStyle?: RenderStyle;
  shapeDuration?: number;
  shapeEasing?: MotionOptions['easing'];
  motionDuration?: number;
  motionEasing?: MotionOptions['easing'];
  motion?: MotionTarget;
  time?: number;
  onReady?: SidekickEventHandler<'sidekick-ready'>;
  onDesignChange?: SidekickEventHandler<'sidekick-design-change'>;
  onMotionEnd?: SidekickEventHandler<'sidekick-motion-end'>;
  onShapeEnd?: SidekickEventHandler<'sidekick-shape-end'>;
  onBodyOrientationChange?: SidekickEventHandler<'sidekick-body-orientation-change'>;
  onZoomChange?: SidekickEventHandler<'sidekick-zoom-change'>;
  onActivate?: SidekickEventHandler<'sidekick-activate'>;
  onError?: SidekickEventHandler<'sidekick-error'>;
}

const tagName = 'sidekick-avatar';
const attributeProps = {
  emotion: 'emotion', emotionIntensity: 'emotion-intensity',
  placement: 'placement', positionX: 'position-x', positionY: 'position-y', movementBounds: 'movement-bounds', moveDuration: 'move-duration', moveEasing: 'move-easing', moveTravel: 'move-travel', moveMaxSpeed: 'move-max-speed', moveAcceleration: 'move-acceleration', moveDeceleration: 'move-deceleration',
  shape: 'shape', bodyColor: 'body-color', eyeColor: 'eye-color',
  expression: 'expression', leftExpression: 'left-expression', rightExpression: 'right-expression',
  smile: 'smile', blink: 'blink', leftSmile: 'left-smile', rightSmile: 'right-smile', leftBlink: 'left-blink', rightBlink: 'right-blink',
  headAccessory: 'head-accessory', headColor: 'head-color', eyesAccessory: 'eyes-accessory', eyesColor: 'eyes-color',
  mouthAccessory: 'mouth-accessory', mouthColor: 'mouth-color', neckAccessory: 'neck-accessory', neckColor: 'neck-color',
  leftEarAccessory: 'left-ear-accessory', leftEarColor: 'left-ear-color', rightEarAccessory: 'right-ear-accessory', rightEarColor: 'right-ear-color',
  bodyYaw: 'body-yaw', bodyPitch: 'body-pitch', bodyRoll: 'body-roll', zoom: 'zoom', gazeX: 'gaze-x', gazeY: 'gaze-y',
  activity: 'activity', paused: 'paused', interaction: 'interaction', mouseTracking: 'mouse-tracking', trackingMode: 'tracking-mode', renderStyle: 'render-style',
  shapeDuration: 'shape-duration', shapeEasing: 'shape-easing', motionDuration: 'motion-duration', motionEasing: 'motion-easing', time: 'time',
} as const satisfies Partial<Record<keyof SidekickAvatarProps, string>>;
const eventProps = {
  onEmotionChange: 'sidekick-emotion-change', onReactionEnd: 'sidekick-reaction-end',
  onEnterEnd: 'sidekick-enter-end', onExitEnd: 'sidekick-exit-end',
  onMoveEnd: 'sidekick-move-end', onMoveProgress: 'sidekick-move-progress', onPlayEnd: 'sidekick-play-end', onAssetTransitionEnd: 'sidekick-transition-end',
  onBehaviorChange: 'sidekick-behavior-change', onBehaviorEnd: 'sidekick-behavior-end',
  onReady: 'sidekick-ready', onDesignChange: 'sidekick-design-change', onMotionEnd: 'sidekick-motion-end',
  onShapeEnd: 'sidekick-shape-end', onBodyOrientationChange: 'sidekick-body-orientation-change', onZoomChange: 'sidekick-zoom-change', onActivate: 'sidekick-activate', onError: 'sidekick-error',
} as const;

// Sorting object keys avoids restarting motions for semantically identical inline props.
function serialize(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) => {
    if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
      return Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)));
    }
    return item;
  });
}

// Behavior data is shallow, except for review's ordered Element array. Keep DOM
// targets by identity; JSON serialization would collapse every Element to {}.
// No DOM globals or eager controller imports are needed in this SSR-safe entry.
function sameBehavior(previous: BotBehavior | null, next: BotBehavior | null): boolean {
  if (previous === null || next === null) return previous === next;
  if (typeof previous !== 'object' || typeof next !== 'object') return Object.is(previous, next);
  const keys = Reflect.ownKeys(previous);
  if (keys.length !== Reflect.ownKeys(next).length || Object.getPrototypeOf(previous) !== Object.getPrototypeOf(next)) return false;
  return keys.every(key => {
    const before = Object.getOwnPropertyDescriptor(previous, key);
    const after = Object.getOwnPropertyDescriptor(next, key);
    if (!before || !after || !Object.hasOwn(before, 'value') || !Object.hasOwn(after, 'value') || before.enumerable !== after.enumerable) return false;
    const a: unknown = before.value, b: unknown = after.value;
    return Array.isArray(a) && Array.isArray(b) ? a.length === b.length && a.every((item, index) => Object.is(item, b[index])) : Object.is(a, b);
  });
}

function copyBehavior(value: BotBehavior | null): BotBehavior | null {
  if (value === null || typeof value !== 'object') return value;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  for (const descriptor of Object.values(descriptors)) {
    if (Object.hasOwn(descriptor, 'value') && Array.isArray(descriptor.value)) descriptor.value = [...descriptor.value];
  }
  return Object.create(Object.getPrototypeOf(value), descriptors) as BotBehavior;
}

// Keep validation local: eager core imports create additional shared browser chunks
// and pull renderer dependencies into the SSR-safe React entry point.
function validateBodyOrientation(value: unknown): void {
  if (typeof value === 'string') {
    if (!['front', 'three-quarter', 'side'].includes(value)) throw new TypeError('bodyOrientation must be front, three-quarter, or side');
    return;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('bodyOrientation must be a plain object or preset');
  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new TypeError('bodyOrientation must be a plain object');
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if ((key !== 'yaw' && key !== 'pitch' && key !== 'roll') || !Object.hasOwn(descriptor, 'value') || !descriptor.enumerable) {
      throw new TypeError('bodyOrientation accepts only yaw, pitch, and roll; use the separate zoom prop');
    }
    const limit = key === 'yaw' ? 360 : key === 'pitch' ? 90 : 180;
    const angle: unknown = descriptor.value;
    if (typeof angle !== 'number' || !Number.isFinite(angle) || angle < -limit || angle > limit) throw new RangeError(`bodyOrientation.${key} must be a finite number between ${-limit} and ${limit}`);
  }
}

/** A stable SSR host; configuration and renderer registration happen only on the client. */
export function SidekickAvatar(props: SidekickAvatarProps): ReactElement {
  for (const name of ['camera', 'cameraYaw', 'cameraPitch', 'cameraRoll', 'cameraZoom', 'view', 'viewYaw', 'viewPitch', 'viewRoll', 'viewZoom', 'onCameraChange', 'onViewChange', 'camera-yaw', 'camera-pitch', 'camera-roll', 'camera-zoom', 'view-yaw', 'view-pitch', 'view-roll', 'view-zoom']) {
    if (Object.prototype.hasOwnProperty.call(props, name)) throw new TypeError(`${name} has been removed; use bodyOrientation, bodyYaw/bodyPitch/bodyRoll, zoom, onBodyOrientationChange or onZoomChange instead`);
  }
  const { ref, design, accessories, bodyOrientation, motion, behavior: _behavior, ...html } = props;
  const element = useRef<SidekickElement | null>(null);
  const readyNotified = useRef(false);
  const deliveredReadyEvent = useRef<Event | null>(null);
  const callbacks = useRef(props);
  const notifyReady = useRef<(() => void) | null>(null);
  const pendingErrors = useRef<SidekickEventMap['sidekick-error'][]>([]);
  const seenErrors = useRef(new WeakSet<Event>());
  const drainErrors = useRef<(() => void) | null>(null);
  const useClientEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;
  const ownedAttributes = useRef(new Set<string>());
  const appliedBehavior = useRef<{ node: SidekickElement; value: BotBehavior | null } | null>(null);
  const published = useRef<{ node: SidekickElement; ref: Ref<SidekickElement> | undefined; cleanup?: () => void } | null>(null);
  const attributes: Record<string, string> = {};
  if (design !== undefined) attributes.design = serialize(design);
  if (accessories !== undefined) attributes.accessories = serialize(accessories);
  if (motion !== undefined) attributes.motion = serialize(motion);
  if (bodyOrientation !== undefined) validateBodyOrientation(bodyOrientation);
  if (typeof bodyOrientation === 'string') {
    attributes['body-orientation'] = bodyOrientation;
  } else if (bodyOrientation !== undefined) {
    for (const axis of ['yaw', 'pitch', 'roll'] as const) {
      if (bodyOrientation[axis] !== undefined) attributes[`body-${axis}`] = String(bodyOrientation[axis]);
    }
  }
  for (const key of Object.keys(attributeProps) as (keyof typeof attributeProps)[]) {
    const value = props[key];
    if (value !== undefined) attributes[attributeProps[key]] = String(value);
    delete html[key];
  }

  const publish = useCallback((node: SidekickElement | null) => {
    if (published.current?.node === node && published.current.ref === ref) return;
    const previous = published.current;
    published.current = null;
    if (previous?.cleanup) previous.cleanup();
    else if (typeof previous?.ref === 'function') previous.ref(null);
    else if (previous?.ref) previous.ref.current = null;
    if (!node) return;
    const cleanup = typeof ref === 'function' ? ref(node) : undefined;
    if (ref && typeof ref !== 'function') ref.current = node;
    published.current = { node, ref, ...(typeof cleanup === 'function' ? { cleanup } : {}) };
  }, [ref]);

  // A defined element may fail synchronously on insertion, before layout effects
  // can subscribe. React 19 installs this native listener before inserting it.
  // Queue until the committed callbacks and requested attributes are installed.
  const captureError = useCallback((event: Event) => {
    if (seenErrors.current.has(event)) return;
    seenErrors.current.add(event);
    pendingErrors.current.push(event as SidekickEventMap['sidekick-error']);
    // Before the first layout effect, let setup schedule the drain after the
    // element's attribute microtask. An insertion-time microtask would be early.
    if (drainErrors.current) queueMicrotask(drainErrors.current);
  }, []);

  const capture = useCallback((node: SidekickElement | null) => {
    element.current = node;
    if (!node) publish(null);
  }, [publish]);
  for (const key of Object.keys(eventProps) as (keyof typeof eventProps)[]) delete html[key];

  // React must not assign these names as properties (e.g. getter-only activity).
  // Configure before paint and before registration. The element coalesces its
  // attribute work in a microtask; ready is delivered after that flush.
  useClientEffect(() => {
    callbacks.current = props;
    const node = element.current;
    if (!node) return;
    for (const name of ownedAttributes.current) if (!(name in attributes)) node.removeAttribute(name);
    for (const [name, value] of Object.entries(attributes)) if (node.getAttribute(name) !== value) node.setAttribute(name, value);
    ownedAttributes.current = new Set(Object.keys(attributes));
    queueMicrotask(() => notifyReady.current?.());
  });

  useClientEffect(() => {
    const node = element.current;
    if (!node) return;
    let active = true;
    let readyEvent: SidekickEventMap['sidekick-ready'] | undefined;
    const notify = () => {
      if (!active || element.current !== node) return;
      if (typeof node.setDesign === 'function') {
        const requested = callbacks.current.behavior;
        const previous = appliedBehavior.current;
        // Omission does not claim ownership on first mount. Once supplied,
        // removing the prop is an explicit cancellation, just like null.
        if (requested !== undefined || previous?.node === node) {
          const value = requested ?? null;
          try {
            if (previous?.node !== node || !sameBehavior(previous.value, value)) {
              // Remember this attempt before synchronous native events can cause
              // another render. Invalid unchanged props also report only once.
              appliedBehavior.current = { node, value: copyBehavior(value) };
              node.behavior = value;
            }
          } catch (error: unknown) {
            node.dispatchEvent(new CustomEvent('sidekick-error', {
              detail: { message: error instanceof Error ? error.message : String(error), attribute: 'behavior' }, bubbles: true, composed: true,
            }));
          }
        }
        publish(node);
      }
      if ((readyEvent && deliveredReadyEvent.current !== readyEvent) || (!readyNotified.current && node.ready)) {
        readyNotified.current = true;
        deliveredReadyEvent.current = readyEvent ?? null;
        // A previously upgraded SSR host may already be ready. Replay only this
        // callback, never dispatch a duplicate event to other native listeners.
        callbacks.current.onReady?.(readyEvent ?? new CustomEvent('sidekick-ready', { detail: {} }));
      }
    };
    notifyReady.current = notify;
    const drain = () => {
      if (!active || element.current !== node) return;
      const events = pendingErrors.current.splice(0);
      for (const event of events) {
        if (!active) break;
        if (event.target === node) callbacks.current.onError?.(event);
      }
    };
    drainErrors.current = drain;
    const listeners = Object.entries(eventProps).map(([prop, name]) => {
      const listener = (event: Event) => {
        if (!active) return;
        if (name === 'sidekick-ready') {
          readyEvent = event as SidekickEventMap['sidekick-ready'];
          queueMicrotask(notify);
        } else if (name === 'sidekick-error') {
          captureError(event);
        } else {
          const callback = callbacks.current[prop as keyof typeof eventProps] as ((event: Event) => void) | undefined;
          callback?.(event);
        }
      };
      node.addEventListener(name, listener);
      return [name, listener] as const;
    });
    // The direct listener also works for hydration. Remove React's insertion
    // capture immediately after subscribing, including StrictMode replays.
    node.removeEventListener('sidekick-error', captureError);
    queueMicrotask(drain);
    if (node.ownerDocument.defaultView?.customElements.get(tagName)) queueMicrotask(notify);
    else {
      // Never evaluate the HTMLElement subclass during SSR, including SSR followed
      // by hydration in the same Node process. The native module stays client-only.
      // Import the implementation, not the public barrel: mixing a barrel's
      // namespace with an auto-register entry can create circular Vite chunks.
      void import('./element/avatar.js').then(({ defineSidekick }) => {
        if (!active || element.current !== node) return;
        defineSidekick();
        queueMicrotask(notify);
      }).catch((error: unknown) => {
        if (!active || element.current !== node) return;
        node.dispatchEvent(new CustomEvent('sidekick-error', {
          detail: { message: error instanceof Error ? error.message : String(error) }, bubbles: true, composed: true,
        }));
      });
    }
    return () => {
      active = false;
      if (notifyReady.current === notify) notifyReady.current = null;
      if (drainErrors.current === drain) drainErrors.current = null;
      node.removeEventListener('sidekick-error', captureError);
      for (const [name, listener] of listeners) node.removeEventListener(name, listener);
      publish(null);
    };
  }, [publish, captureError]);

  return createElement(tagName, { ...html, 'onsidekick-error': captureError, ref: capture });
}

export type { MoveToElementOptions, HorizontalAlignment, VerticalAlignment } from './element/element-target.js';

export type { ElementAnchorState } from './element/element-anchor.js';

export type { BotBehavior, BehaviorTarget, BehaviorSide, BehaviorPhase, BehaviorState, BehaviorResult, PerformOptions } from './element/behavior.js';
