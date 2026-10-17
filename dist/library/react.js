'use client';
import { createElement, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
const tagName = 'sidekick-avatar';
const attributeProps = {
    shape: 'shape', bodyColor: 'body-color', eyeColor: 'eye-color',
    expression: 'expression', leftExpression: 'left-expression', rightExpression: 'right-expression',
    smile: 'smile', blink: 'blink', leftSmile: 'left-smile', rightSmile: 'right-smile', leftBlink: 'left-blink', rightBlink: 'right-blink',
    headAccessory: 'head-accessory', headColor: 'head-color', eyesAccessory: 'eyes-accessory', eyesColor: 'eyes-color',
    mouthAccessory: 'mouth-accessory', mouthColor: 'mouth-color', neckAccessory: 'neck-accessory', neckColor: 'neck-color',
    leftEarAccessory: 'left-ear-accessory', leftEarColor: 'left-ear-color', rightEarAccessory: 'right-ear-accessory', rightEarColor: 'right-ear-color',
    cameraYaw: 'camera-yaw', cameraPitch: 'camera-pitch', cameraRoll: 'camera-roll', cameraZoom: 'camera-zoom', gazeX: 'gaze-x', gazeY: 'gaze-y',
    activity: 'activity', paused: 'paused', interaction: 'interaction', mouseTracking: 'mouse-tracking', trackingMode: 'tracking-mode', renderStyle: 'render-style',
    shapeDuration: 'shape-duration', shapeEasing: 'shape-easing', motionDuration: 'motion-duration', motionEasing: 'motion-easing', time: 'time',
};
const eventProps = {
    onReady: 'sidekick-ready', onDesignChange: 'sidekick-design-change', onMotionEnd: 'sidekick-motion-end',
    onShapeEnd: 'sidekick-shape-end', onCameraChange: 'sidekick-camera-change', onActivate: 'sidekick-activate', onError: 'sidekick-error',
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
/** A stable SSR host; configuration and renderer registration happen only on the client. */
export function SidekickAvatar(props) {
    const { ref, design, accessories, camera, motion, ...html } = props;
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
    const published = useRef(null);
    const attributes = {};
    if (design !== undefined)
        attributes.design = serialize(design);
    if (accessories !== undefined)
        attributes.accessories = serialize(accessories);
    if (motion !== undefined)
        attributes.motion = serialize(motion);
    if (typeof camera === 'string')
        attributes.camera = camera;
    else if (camera)
        for (const axis of ['yaw', 'pitch', 'roll', 'zoom']) {
            if (camera[axis] !== undefined)
                attributes[`camera-${axis}`] = String(camera[axis]);
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
            if (typeof node.setDesign === 'function')
                publish(node);
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
