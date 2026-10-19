'use client';
import { createElement, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
function sameEntrance(a, b) {
    if (!a || !b)
        return a === b;
    const left = a, right = b;
    return Object.keys(left).length === Object.keys(right).length && Object.keys(left).every(key => left[key] === right[key]);
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
};
const eventProps = {
    onEmotionChange: 'sidekick-emotion-change', onReactionEnd: 'sidekick-reaction-end',
    onEnterEnd: 'sidekick-enter-end', onExitEnd: 'sidekick-exit-end',
    onMoveEnd: 'sidekick-move-end', onMoveProgress: 'sidekick-move-progress', onPlayEnd: 'sidekick-play-end', onAssetTransitionEnd: 'sidekick-transition-end',
    onBehaviorChange: 'sidekick-behavior-change', onBehaviorEnd: 'sidekick-behavior-end',
    onReady: 'sidekick-ready', onDesignChange: 'sidekick-design-change', onMotionEnd: 'sidekick-motion-end',
    onShapeEnd: 'sidekick-shape-end', onBodyOrientationChange: 'sidekick-body-orientation-change', onZoomChange: 'sidekick-zoom-change', onActivate: 'sidekick-activate', onError: 'sidekick-error',
};
// Sorting object keys avoids restarting motions for semantically identical inline props.
function serialize(value) {
    return JSON.stringify(value, (_key, item) => {
        if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
            return Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)));
        }
        return item;
    });
}
// Behavior data is shallow, except for review's ordered Element array. Keep DOM
// targets by identity; JSON serialization would collapse every Element to {}.
// No DOM globals or eager controller imports are needed in this SSR-safe entry.
function sameBehavior(previous, next) {
    if (previous === null || next === null)
        return previous === next;
    if (typeof previous !== 'object' || typeof next !== 'object')
        return Object.is(previous, next);
    const keys = Reflect.ownKeys(previous);
    if (keys.length !== Reflect.ownKeys(next).length || Object.getPrototypeOf(previous) !== Object.getPrototypeOf(next))
        return false;
    return keys.every(key => {
        const before = Object.getOwnPropertyDescriptor(previous, key);
        const after = Object.getOwnPropertyDescriptor(next, key);
        if (!before || !after || !Object.hasOwn(before, 'value') || !Object.hasOwn(after, 'value') || before.enumerable !== after.enumerable)
            return false;
        const a = before.value, b = after.value;
        return Array.isArray(a) && Array.isArray(b) ? a.length === b.length && a.every((item, index) => Object.is(item, b[index])) : Object.is(a, b);
    });
}
function copyBehavior(value) {
    if (value === null || typeof value !== 'object')
        return value;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    for (const descriptor of Object.values(descriptors)) {
        if (Object.hasOwn(descriptor, 'value') && Array.isArray(descriptor.value))
            descriptor.value = [...descriptor.value];
    }
    return Object.create(Object.getPrototypeOf(value), descriptors);
}
// Keep validation local: eager core imports create additional shared browser chunks
// and pull renderer dependencies into the SSR-safe React entry point.
function validateBodyOrientation(value) {
    if (typeof value === 'string') {
        if (!['front', 'three-quarter', 'side'].includes(value))
            throw new TypeError('bodyOrientation must be front, three-quarter, or side');
        return;
    }
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new TypeError('bodyOrientation must be a plain object or preset');
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null)
        throw new TypeError('bodyOrientation must be a plain object');
    for (const key of Reflect.ownKeys(value)) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if ((key !== 'yaw' && key !== 'pitch' && key !== 'roll') || !Object.hasOwn(descriptor, 'value') || !descriptor.enumerable) {
            throw new TypeError('bodyOrientation accepts only yaw, pitch, and roll; use the separate zoom prop');
        }
        const limit = key === 'yaw' ? 360 : key === 'pitch' ? 90 : 180;
        const angle = descriptor.value;
        if (typeof angle !== 'number' || !Number.isFinite(angle) || angle < -limit || angle > limit)
            throw new RangeError(`bodyOrientation.${key} must be a finite number between ${-limit} and ${limit}`);
    }
}
/** A stable SSR host; configuration and renderer registration happen only on the client. */
export function SidekickAvatar(props) {
    for (const name of ['camera', 'cameraYaw', 'cameraPitch', 'cameraRoll', 'cameraZoom', 'view', 'viewYaw', 'viewPitch', 'viewRoll', 'viewZoom', 'onCameraChange', 'onViewChange', 'camera-yaw', 'camera-pitch', 'camera-roll', 'camera-zoom', 'view-yaw', 'view-pitch', 'view-roll', 'view-zoom']) {
        if (Object.prototype.hasOwnProperty.call(props, name))
            throw new TypeError(`${name} has been removed; use bodyOrientation, bodyYaw/bodyPitch/bodyRoll, zoom, onBodyOrientationChange or onZoomChange instead`);
    }
    const { ref, design, accessories, bodyOrientation, motion, behavior: _behavior, entrance: _entrance, positioning: _positioning, ...html } = props;
    const element = useRef(null);
    const readyNotified = useRef(false);
    const deliveredReadyEvent = useRef(null);
    const callbacks = useRef(props);
    const notifyReady = useRef(null);
    const pendingErrors = useRef([]);
    const seenErrors = useRef(new WeakSet());
    const drainErrors = useRef(null);
    const useClientEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;
    const ownedAttributes = useRef(new Set());
    const appliedPositioning = useRef(null);
    const appliedEntrance = useRef(null);
    const appliedBehavior = useRef(null);
    const published = useRef(null);
    const attributes = {};
    if (design !== undefined)
        attributes.design = serialize(design);
    if (accessories !== undefined)
        attributes.accessories = serialize(accessories);
    if (motion !== undefined)
        attributes.motion = serialize(motion);
    if (bodyOrientation !== undefined)
        validateBodyOrientation(bodyOrientation);
    if (typeof bodyOrientation === 'string') {
        attributes['body-orientation'] = bodyOrientation;
    }
    else if (bodyOrientation !== undefined) {
        for (const axis of ['yaw', 'pitch', 'roll']) {
            if (bodyOrientation[axis] !== undefined)
                attributes[`body-${axis}`] = String(bodyOrientation[axis]);
        }
    }
    for (const key of Object.keys(attributeProps)) {
        const value = props[key];
        if (value !== undefined)
            attributes[attributeProps[key]] = String(value);
        delete html[key];
    }
    const publish = useCallback((node) => {
        if (published.current?.node === node && published.current.ref === ref)
            return;
        const previous = published.current;
        published.current = null;
        if (previous?.cleanup)
            previous.cleanup();
        else if (typeof previous?.ref === 'function')
            previous.ref(null);
        else if (previous?.ref)
            previous.ref.current = null;
        if (!node)
            return;
        const cleanup = typeof ref === 'function' ? ref(node) : undefined;
        if (ref && typeof ref !== 'function')
            ref.current = node;
        published.current = { node, ref, ...(typeof cleanup === 'function' ? { cleanup } : {}) };
    }, [ref]);
    // A defined element may fail synchronously on insertion, before layout effects
    // can subscribe. React 19 installs this native listener before inserting it.
    // Queue until the committed callbacks and requested attributes are installed.
    const captureError = useCallback((event) => {
        if (seenErrors.current.has(event))
            return;
        seenErrors.current.add(event);
        pendingErrors.current.push(event);
        // Before the first layout effect, let setup schedule the drain after the
        // element's attribute microtask. An insertion-time microtask would be early.
        if (drainErrors.current)
            queueMicrotask(drainErrors.current);
    }, []);
    const capture = useCallback((node) => {
        element.current = node;
        if (!node)
            publish(null);
    }, [publish]);
    for (const key of Object.keys(eventProps))
        delete html[key];
    // React must not assign these names as properties (e.g. getter-only activity).
    // Configure before paint and before registration. The element coalesces its
    // attribute work in a microtask; ready is delivered after that flush.
    useClientEffect(() => {
        callbacks.current = props;
        const node = element.current;
        if (!node)
            return;
        for (const name of ownedAttributes.current)
            if (!(name in attributes))
                node.removeAttribute(name);
        for (const [name, value] of Object.entries(attributes))
            if (node.getAttribute(name) !== value)
                node.setAttribute(name, value);
        ownedAttributes.current = new Set(Object.keys(attributes));
        queueMicrotask(() => notifyReady.current?.());
    });
    useClientEffect(() => {
        const node = element.current;
        if (!node)
            return;
        let active = true;
        let readyEvent;
        const notify = () => {
            if (!active || element.current !== node)
                return;
            if (typeof node.setDesign === 'function') {
                const positioning = callbacks.current.positioning;
                const previousPositioning = appliedPositioning.current;
                if (positioning !== undefined || previousPositioning?.node === node) {
                    const value = positioning ?? null;
                    if (previousPositioning?.node !== node || !samePositioning(previousPositioning.value, value)) {
                        appliedPositioning.current = { node, value: copyPositioning(value) };
                        try {
                            node.positioning = value;
                        }
                        catch (error) {
                            node.dispatchEvent(new CustomEvent('sidekick-error', { detail: { message: String(error), attribute: 'positioning' }, bubbles: true, composed: true }));
                        }
                    }
                }
                const entrance = callbacks.current.entrance;
                const previousEntrance = appliedEntrance.current;
                if (entrance !== undefined || previousEntrance?.node === node) {
                    const value = entrance ?? null;
                    if (previousEntrance?.node !== node || !sameEntrance(previousEntrance.value, value)) {
                        appliedEntrance.current = { node, value: value ? { ...value } : null };
                        try {
                            node.entrance = value;
                        }
                        catch (error) {
                            node.dispatchEvent(new CustomEvent('sidekick-error', { detail: { message: String(error), attribute: 'entrance' }, bubbles: true, composed: true }));
                        }
                    }
                }
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
                    }
                    catch (error) {
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
            if (!active || element.current !== node)
                return;
            const events = pendingErrors.current.splice(0);
            for (const event of events) {
                if (!active)
                    break;
                if (event.target === node)
                    callbacks.current.onError?.(event);
            }
        };
        drainErrors.current = drain;
        const listeners = Object.entries(eventProps).map(([prop, name]) => {
            const listener = (event) => {
                if (!active)
                    return;
                if (name === 'sidekick-ready') {
                    readyEvent = event;
                    queueMicrotask(notify);
                }
                else if (name === 'sidekick-error') {
                    captureError(event);
                }
                else {
                    const callback = callbacks.current[prop];
                    callback?.(event);
                }
            };
            node.addEventListener(name, listener);
            return [name, listener];
        });
        // The direct listener also works for hydration. Remove React's insertion
        // capture immediately after subscribing, including StrictMode replays.
        node.removeEventListener('sidekick-error', captureError);
        queueMicrotask(drain);
        if (node.ownerDocument.defaultView?.customElements.get(tagName))
            queueMicrotask(notify);
        else {
            // Never evaluate the HTMLElement subclass during SSR, including SSR followed
            // by hydration in the same Node process. The native module stays client-only.
            // Import the implementation, not the public barrel: mixing a barrel's
            // namespace with an auto-register entry can create circular Vite chunks.
            void import('./element/avatar.js').then(({ defineSidekick }) => {
                if (!active || element.current !== node)
                    return;
                defineSidekick();
                queueMicrotask(notify);
            }).catch((error) => {
                if (!active || element.current !== node)
                    return;
                node.dispatchEvent(new CustomEvent('sidekick-error', {
                    detail: { message: error instanceof Error ? error.message : String(error) }, bubbles: true, composed: true,
                }));
            });
        }
        return () => {
            active = false;
            if (notifyReady.current === notify)
                notifyReady.current = null;
            if (drainErrors.current === drain)
                drainErrors.current = null;
            node.removeEventListener('sidekick-error', captureError);
            for (const [name, listener] of listeners)
                node.removeEventListener(name, listener);
            publish(null);
        };
    }, [publish, captureError]);
    return createElement(tagName, { ...html, 'onsidekick-error': captureError, ref: capture });
}
function samePositioning(a, b) {
    return a === b || !!a && !!b && a.target === b.target && (a.placement ?? 'bottom-right') === (b.placement ?? 'bottom-right') && (a.gap ?? 16) === (b.gap ?? 16) && (a.follow ?? true) === (b.follow ?? true) && (a.offset?.x ?? 0) === (b.offset?.x ?? 0) && (a.offset?.y ?? 0) === (b.offset?.y ?? 0);
}
function copyPositioning(value) { return value ? { ...value, ...(value.offset ? { offset: { ...value.offset } } : {}) } : null; }
