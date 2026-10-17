import { ACTIVITIES, createAccessory, createDesign, equipAccessory, finite, parseDesign, patchDesign, removeAccessory } from '../core/design.js';
import { parseTrackingMode } from '../core/tracking.js';
import { clamp } from '../core/math.js';
import { MotionTimeline, validateMotionOptions } from '../core/motion.js';
import { validateShapeMotionOptions } from '../core/shape-motion.js';
import { expressionDuration, eyeExpressionWeights, patchEyeState } from '../core/expressions.js';
import { cameraPreset, createCamera, patchCamera } from '../core/camera.js';
import { validateSnapshotOptions } from '../core/pixels.js';
import { LocalRenderBridge, WorkerRenderBridge, supportsRenderWorker } from '../runtime/render-bridge.js';
import { ACCESSORY_ATTRIBUTE_SLOTS, SIDEKICK_ATTRIBUTES, SidekickAttributeError, resolveSidekickAttributes } from './attributes.js';
const HTMLElementBase = (typeof HTMLElement === 'undefined' ? class {
} : HTMLElement);
export class SidekickAvatar extends HTMLElementBase {
    static observedAttributes = [...SIDEKICK_ATTRIBUTES];
    addEventListener(type, listener, options) { if (listener)
        super.addEventListener(type, listener, options); }
    removeEventListener(type, listener, options) { if (listener)
        super.removeEventListener(type, listener, options); }
    configuration = createDesign();
    // This zero-duration reducer validates commands synchronously. It never runs animation.
    validator = new MotionTimeline({ left: this.configuration.eyes.left, right: this.configuration.eyes.right });
    currentPose = structuredClone(this.validator.pose);
    bridge;
    generation = 0;
    acknowledgedRevision = 0;
    poseRevision = 0;
    timeRevision = 0;
    snapshotState;
    nextRequest = 0;
    commandBatch;
    requests = new Map();
    inputFrame = 0;
    pendingResize = false;
    pendingPointer;
    pendingDrag;
    connected = false;
    transferred = false;
    captureCanvas;
    canvas;
    fallback;
    sizeObserver;
    visibilityObserver;
    media;
    visible = true;
    reduced = false;
    elapsed = 0;
    readyState = false;
    currentActivity = 'idle';
    cameraAngles = createCamera();
    gazeTarget = [0, 0];
    manualGaze = [0, 0];
    pausedState = false;
    interactionState = 'none';
    trackingModeState = 'off';
    trackedGaze;
    trackingDocument;
    acceptedAttributes = new Map();
    pendingAttributes = new Map();
    attributesQueued = false;
    propertiesUpgraded = false;
    drag;
    motion = {
        to: (target, options = {}) => {
            const timing = validateMotionOptions(options);
            // Probe without mutating even the validation reducer until ownership checks pass.
            void new MotionTimeline({ left: this.configuration.eyes.left, right: this.configuration.eyes.right }).to(target, { ...timing, duration: 0 });
            for (const id of Object.keys(target.accessories ?? {}))
                if (!this.configuration.accessories.some(a => a.id === id))
                    throw new RangeError(`액세서리 ${id}가 없습니다.`);
            this.validator.pose = structuredClone(this.currentPose);
            void this.validator.to(target, { ...timing, duration: 0 });
            const duration = this.immediateMotion() ? 0 : timing.duration;
            if (!duration)
                this.currentPose = structuredClone(this.validator.pose);
            const pending = this.request('motion');
            this.send({ kind: 'motion', target: structuredClone(target), options: { ...timing, duration }, request: pending.id });
            this.poseRevision = this.bridge?.revision ?? 0;
            if (!this.bridge)
                this.resolveRequest(pending.id, { finished: true });
            return pending.promise;
        },
        cancel: () => { this.send({ kind: 'cancel' }); },
    };
    get design() { return parseDesign(this.configuration); }
    set design(value) { this.applyDesign(value); }
    async setDesign(value) { this.applyDesign(value); }
    /** Apply selections/colors or expression weights without disturbing unrelated animation. */
    async updateDesign(patch) { this.applyDesign(patchDesign(this.configuration, patch)); }
    /** Replace only the selected equipment slot, preserving unrelated animation clocks. */
    async equipAccessory(accessory) { this.applyDesign(equipAccessory(this.configuration, accessory)); }
    /** Remove one instance by ID; the opposite earring and its motion remain independent. */
    async removeAccessory(id) { this.applyDesign(removeAccessory(this.configuration, id)); }
    applyDesign(value, transition) {
        const next = parseDesign(value), previous = this.configuration;
        const shapeChanged = next.body.shape !== previous.body.shape;
        const changedEyes = ['left', 'right'].filter(side => transition?.eyeSides?.includes(side) || next.eyes[side].weights.smile !== previous.eyes[side].weights.smile || next.eyes[side].weights.blink !== previous.eyes[side].weights.blink);
        const immediate = this.immediateMotion();
        const timing = transition ? { ...transition, shape: { ...transition.shape, duration: immediate ? 0 : transition.shape.duration }, eyes: { ...transition.eyes, duration: immediate ? 0 : transition.eyes.duration } } : undefined;
        let shapeRequest, eyeRequest;
        if (shapeChanged && timing)
            shapeRequest = this.request('shape').id;
        if (changedEyes.length) {
            this.validator.pose = structuredClone(this.currentPose);
            this.validator.setEyes({ left: next.eyes.left, right: next.eyes.right }, changedEyes);
            if (!timing || immediate || timing.eyes.duration === 0) {
                for (const side of changedEyes)
                    this.currentPose.eyes[side] = { ...this.validator.pose.eyes[side] };
                if (changedEyes.length === 2 && !timing)
                    this.currentPose.openness = 1;
            }
            if (timing)
                eyeRequest = this.request('motion').id;
        }
        const removed = previous.accessories.filter(a => !next.accessories.some(part => part.id === a.id)).map(a => a.id);
        if (removed.length) {
            this.validator.removeAccessories(removed);
            for (const id of removed)
                delete this.currentPose.accessories[id];
        }
        this.configuration = next;
        this.send({ kind: 'design', design: next, transition: timing, shapeRequest, eyeRequest });
        this.poseRevision = this.bridge?.revision ?? 0;
        if (!this.bridge) {
            if (shapeRequest !== undefined)
                this.resolveRequest(shapeRequest, { finished: true });
            if (eyeRequest !== undefined)
                this.resolveRequest(eyeRequest, { finished: true });
        }
        this.emit('sidekick-design-change', { design: this.design });
    }
    /** Persist a shape target now, while moving directly from the currently visible outline. */
    setShape(shape, options = {}) {
        const timing = validateShapeMotionOptions(options);
        const next = parseDesign({ ...this.configuration, body: { ...this.configuration.body, shape } });
        const pending = this.request('shape');
        this.configuration = next;
        this.send({ kind: 'shape', shape, options: { ...timing, duration: this.immediateMotion() ? 0 : timing.duration }, request: pending.id });
        if (!this.bridge)
            this.resolveRequest(pending.id, { finished: true });
        this.emit('sidekick-design-change', { design: this.design });
        return pending.promise;
    }
    /** Persist partial shape-key weights and transition from the currently displayed pose. */
    setEyeWeights(side, weights, options = {}) {
        if (side !== 'left' && side !== 'right' && side !== 'both')
            throw new TypeError('눈 방향은 left, right, both 중 하나여야 합니다.');
        const next = this.design;
        const eyes = {};
        for (const eye of ['left', 'right'])
            if (side === 'both' || side === eye) {
                next.eyes[eye] = patchEyeState(next.eyes[eye], { weights });
                eyes[eye] = { weights: next.eyes[eye].weights };
            }
        const result = this.motion.to({ eyes }, options);
        // The whole command is validated before changing the persisted design.
        this.configuration = next;
        this.send({ kind: 'persist-design', design: next });
        this.emit('sidekick-design-change', { design: this.design });
        return result;
    }
    /** Named expressions are convenient exact weight presets, never separate state. */
    setExpression(side, expression, options = {}) {
        const timing = validateMotionOptions(options);
        return this.setEyeWeights(side, eyeExpressionWeights(expression), { ...timing, duration: options.duration === undefined ? expressionDuration(expression) : timing.duration });
    }
    get renderStyle() { return 'flat'; }
    set renderStyle(value) {
        // Legacy JavaScript integrations may still send "3d"; normalize that input.
        if (value !== 'flat' && value !== '3d')
            throw new TypeError('renderStyle은 flat입니다.');
        this.reflectAttribute('render-style', 'flat');
    }
    get activity() { return this.currentActivity; }
    setActivity(value) {
        if (!ACTIVITIES.includes(value))
            throw new TypeError('지원하지 않는 activity입니다.');
        this.reflectAttribute('activity', value);
    }
    get paused() { return this.pausedState; }
    set paused(value) {
        if (typeof value !== 'boolean')
            throw new TypeError('paused must be a boolean');
        this.reflectAttribute('paused', value ? '' : null);
    }
    /** Legacy enabled flag. An explicit tracking-mode always takes precedence. */
    get mouseTracking() { return this.trackingModeState !== 'off'; }
    set mouseTracking(value) {
        if (typeof value !== 'boolean')
            throw new TypeError('mouseTracking must be a boolean');
        this.reflectAttribute('mouse-tracking', value ? '' : null);
    }
    get trackingMode() { return this.trackingModeState; }
    set trackingMode(value) { this.reflectAttribute('tracking-mode', parseTrackingMode(value)); }
    /** Clear transient cursor reaction immediately, for explicit scene resets/imports. */
    resetTracking() {
        this.pendingPointer = undefined;
        this.trackedGaze = undefined;
        this.gazeTarget = [...this.manualGaze];
        this.currentPose.gaze = [...this.manualGaze];
        this.syncState();
        this.send({ kind: 'reset-tracking' });
        this.poseRevision = this.bridge?.revision ?? 0;
    }
    get interaction() { return this.interactionState; }
    set interaction(value) {
        if (value !== 'none' && value !== 'box')
            throw new TypeError('interaction은 none 또는 box입니다.');
        this.reflectAttribute('interaction', value);
    }
    get ready() { return this.readyState; }
    /** Last acknowledged worker pose; configuration and camera getters are immediate. */
    get pose() { return structuredClone(this.currentPose); }
    get diagnostics() {
        return { ready: this.ready, running: this.ready && (this.snapshotState?.running ?? false), frames: this.snapshotState?.frames ?? 0, drawCalls: this.snapshotState?.drawCalls ?? 0, buffers: this.ready ? this.snapshotState?.buffers ?? 0 : 0, backend: this.bridge?.backend ?? 'none', generation: this.generation, revision: this.bridge?.revision ?? 0, acknowledgedRevision: this.acknowledgedRevision, time: this.snapshotState?.time ?? this.elapsed, renderCpu: { ...(this.snapshotState?.renderCpu ?? { lastMs: 0, totalMs: 0, maxMs: 0 }) }, renderedRotation: [...(this.snapshotState?.renderedRotation ?? [0, 0, 0])] };
    }
    /** Camera viewing angles in degrees. Reads return an independent snapshot. */
    get camera() { return { ...this.cameraAngles }; }
    set camera(value) { this.setCamera(value); }
    setCamera(angles) {
        const next = patchCamera(this.cameraAngles, angles);
        if (next.yaw === this.cameraAngles.yaw && next.pitch === this.cameraAngles.pitch && next.roll === this.cameraAngles.roll)
            return;
        this.cameraAngles = next;
        this.send({ kind: 'state', state: { camera: this.camera } });
        this.emit('sidekick-camera-change', { camera: this.camera });
    }
    setCameraPreset(preset) { this.setCamera(cameraPreset(preset)); }
    resetCamera() { this.setCameraPreset('front'); }
    /** Legacy radians API; yaw/pitch update the camera while preserving its roll. */
    setView(yaw, pitch = 0) {
        const nextYaw = finite(yaw, -Math.PI * 2, Math.PI * 2, 'yaw'), nextPitch = finite(pitch, -Math.PI / 2, Math.PI / 2, 'pitch');
        this.setCamera({ yaw: nextYaw * 180 / Math.PI, pitch: nextPitch * 180 / Math.PI });
    }
    lookAt(target) {
        if (target.space !== 'view')
            throw new TypeError('시선 좌표계는 view입니다.');
        this.manualGaze = [finite(target.x, -1, 1, 'gaze.x'), finite(target.y, -1, 1, 'gaze.y')];
        this.setGazeTarget(this.manualGaze);
    }
    seek(seconds) { this.elapsed = finite(seconds, 0, 86400, 'time'); this.send({ kind: 'state', state: { time: this.elapsed } }); this.timeRevision = this.bridge?.revision ?? 0; }
    /**
     * Worker mode reads the latest browser-presented bitmap without flushing commands.
     * Use capturePixelsAsync() when fresh ordered GPU output is required. Rows are bottom-up.
     */
    capturePixels() {
        if (!this.bridge || !this.canvas || !this.ready)
            throw new Error('아바타가 렌더링 준비 상태가 아닙니다.');
        if (this.bridge.capture) {
            this.pendingResize = true;
            this.flushInput();
            return this.bridge.capture();
        }
        const source = this.canvas, output = this.captureCanvas ??= this.ownerDocument.createElement('canvas');
        const width = this.snapshotState?.width ?? source.width, height = this.snapshotState?.height ?? source.height;
        if (output.width !== width)
            output.width = width;
        if (output.height !== height)
            output.height = height;
        const context = output.getContext('2d', { willReadFrequently: true });
        if (!context)
            throw new Error('Canvas readback is unavailable');
        context.clearRect(0, 0, output.width, output.height);
        context.drawImage(source, 0, 0, width, height);
        const rgba = context.getImageData(0, 0, output.width, output.height).data, pixels = new Uint8Array(rgba.length), stride = output.width * 4;
        for (let y = 0; y < output.height; y++)
            pixels.set(rgba.subarray(y * stride, (y + 1) * stride), (output.height - 1 - y) * stride);
        // Match raw WebGL readback's premultiplied RGBA convention.
        for (let i = 0; i < pixels.length; i += 4)
            if (pixels[i + 3] < 255)
                for (let channel = 0; channel < 3; channel++)
                    pixels[i + channel] = Math.round(pixels[i + channel] * pixels[i + 3] / 255);
        return { width: output.width, height: output.height, pixels };
    }
    /** Render and read a fresh frame after every preceding command and pending input. */
    async capturePixelsAsync() {
        this.flushAttributes();
        if (!this.bridge || !this.connected)
            throw new Error('아바타가 렌더링 준비 상태가 아닙니다.');
        this.pendingResize = true;
        this.flushInput();
        const pending = this.request('capture');
        this.send({ kind: 'capture', request: pending.id });
        return pending.promise;
    }
    async snapshot(options = {}) {
        const validated = validateSnapshotOptions(options);
        this.flushAttributes();
        if (!this.bridge || !this.connected)
            throw new Error('아바타가 렌더링 준비 상태가 아닙니다.');
        this.pendingResize = true;
        this.flushInput();
        const pending = this.request('snapshot');
        this.send({ kind: 'snapshot', request: pending.id, options: validated });
        return pending.promise;
    }
    connectedCallback() {
        if (this.connected)
            return;
        this.connected = true;
        this.flushAttributes();
        this.upgradeProperties();
        if (!this.connected || !this.isConnected)
            return;
        if (!this.shadowRoot) {
            const shadow = this.attachShadow({ mode: 'open' });
            shadow.innerHTML = `<style>
        :host{display:inline-block;position:relative;width:200px;height:200px;contain:layout style;pointer-events:none;vertical-align:middle}
        :host{pointer-events:var(--sidekick-pointer-events,none);cursor:var(--sidekick-cursor,auto);touch-action:pan-y}
        :host(:focus-visible){outline:2px solid currentColor;outline-offset:3px;border-radius:12px}
        canvas{display:block;width:100%;height:100%;object-fit:contain;background:transparent}
        span{position:absolute;inset:0;display:grid;place-items:center;padding:16px;text-align:center;font:13px/1.5 system-ui;color:currentColor}
        [hidden]{display:none!important}
      </style><canvas part="canvas" aria-hidden="true"></canvas><span part="fallback" hidden></span>`;
            this.canvas = shadow.querySelector('canvas');
            this.fallback = shadow.querySelector('span');
        }
        if (this.transferred)
            this.replaceCanvas();
        this.updateInteraction();
        if (!this.hasAttribute('aria-label'))
            this.setAttribute('aria-label', 'Sidekick 아바타');
        this.media = matchMedia('(prefers-reduced-motion: reduce)');
        this.reduced = this.media.matches;
        this.media.addEventListener('change', this.onMotionPreference);
        this.ownerDocument.addEventListener('visibilitychange', this.onVisibility);
        this.addEventListener('keydown', this.onKey);
        this.attachCanvasListeners();
        this.sizeObserver = new ResizeObserver(this.resize);
        this.sizeObserver.observe(this);
        this.visibilityObserver = new IntersectionObserver(entries => {
            this.visible = entries[0]?.isIntersecting ?? false;
            this.updateMouseTracking();
            this.syncState();
        });
        this.visibilityObserver.observe(this);
        this.initializeRenderer();
    }
    disconnectedCallback() {
        this.connected = false;
        this.readyState = false;
        this.cancelInput();
        this.detachMouseTracking();
        this.clearDrag();
        this.disposeBridge(new Error('Avatar disconnected'));
        this.resetEyes();
        this.snapshotState = undefined;
        this.sizeObserver?.disconnect();
        this.visibilityObserver?.disconnect();
        this.sizeObserver = undefined;
        this.visibilityObserver = undefined;
        this.media?.removeEventListener('change', this.onMotionPreference);
        this.media = undefined;
        this.ownerDocument.removeEventListener('visibilitychange', this.onVisibility);
        this.removeEventListener('keydown', this.onKey);
        this.detachCanvasListeners();
        this.captureCanvas = undefined;
    }
    attributeChangedCallback(name, old, value) {
        if (old === value)
            return;
        if (name === 'render-style' && value === '3d') {
            this.setAttribute('render-style', 'flat');
            return;
        }
        this.pendingAttributes.set(name, value);
        if (!this.attributesQueued) {
            this.attributesQueued = true;
            queueMicrotask(() => { this.attributesQueued = false; this.flushAttributes(); });
        }
    }
    /** Imperative setters commit independently of an unrelated rejected HTML batch. */
    reflectAttribute(name, value) {
        const deferred = this.pendingAttributes;
        this.pendingAttributes = new Map();
        if (value === null)
            this.toggleAttribute(name, false);
        else
            this.setAttribute(name, value);
        // Reflection may repeat the existing raw value after a rejected transaction.
        this.pendingAttributes.set(name, value);
        this.flushAttributes();
        deferred.delete(name);
        for (const [key, text] of deferred)
            if (!this.pendingAttributes.has(key))
                this.pendingAttributes.set(key, text);
    }
    /** A synchronous group of DOM writes is one validated transaction. */
    flushAttributes() {
        if (!this.pendingAttributes.size)
            return;
        const pending = this.pendingAttributes;
        this.pendingAttributes = new Map();
        const candidate = new Map(this.acceptedAttributes);
        for (const [name, value] of pending) {
            if (value === null)
                candidate.delete(name);
            else
                candidate.set(name, value);
        }
        try {
            const resolved = resolveSidekickAttributes(candidate);
            const touched = (...names) => names.some(name => pending.has(name));
            const allDesign = touched('design');
            const next = this.design;
            if (allDesign || touched('shape'))
                next.body.shape = resolved.design.body.shape;
            if (allDesign || touched('body-color'))
                next.body.color = resolved.design.body.color;
            if (allDesign || touched('eye-color'))
                next.eyes.color = resolved.design.eyes.color;
            for (const side of ['left', 'right']) {
                if (allDesign || touched('expression', `${side}-expression`))
                    next.eyes[side] = resolved.design.eyes[side];
                for (const weight of ['smile', 'blink']) {
                    if (allDesign || touched('expression', `${side}-expression`, weight, `${side}-${weight}`))
                        next.eyes[side].weights[weight] = resolved.design.eyes[side].weights[weight];
                }
            }
            if (allDesign || touched('accessories'))
                next.accessories = resolved.design.accessories;
            else
                for (const [prefix, slot] of Object.entries(ACCESSORY_ATTRIBUTE_SLOTS)) {
                    if (!touched(`${prefix}-accessory`, `${prefix}-color`))
                        continue;
                    const selected = resolved.design.accessories.find(item => item.slot === slot);
                    const index = next.accessories.findIndex(item => item.slot === slot);
                    if (touched(`${prefix}-accessory`)) {
                        if (selected) {
                            if (index === -1)
                                next.accessories.push(selected);
                            else
                                next.accessories[index] = selected;
                        }
                        else if (index !== -1)
                            next.accessories.splice(index, 1);
                    }
                    else if (index !== -1) {
                        const current = next.accessories[index];
                        current.color = candidate.get(`${prefix}-color`)?.toLowerCase() ?? selected?.color ?? createAccessory(current.preset, { slot: current.slot }).color;
                    }
                }
            const validated = parseDesign(next);
            let target;
            if (touched('motion')) {
                target = resolved.motion ?? {
                    body: { rotation: [0, 0, 0] }, face: { uv: [0, 0] },
                    eyes: { openness: 1, left: { weights: validated.eyes.left.weights }, right: { weights: validated.eyes.right.weights } },
                    accessories: Object.fromEntries(validated.accessories.map(item => [item.id, { rotation: [0, 0, 0] }])),
                };
                for (const id of Object.keys(target.accessories ?? {}))
                    if (!validated.accessories.some(item => item.id === id))
                        throw new SidekickAttributeError('motion', candidate.get('motion') ?? null, `unknown accessory: ${id}`);
                void new MotionTimeline({ left: validated.eyes.left, right: validated.eyes.right }).to(target, { duration: 0 });
            }
            // Validation is complete before any live state, request or listener changes.
            this.batch(() => {
                this.acceptedAttributes = candidate;
                if (touched('paused'))
                    this.pausedState = resolved.paused;
                if (touched('activity'))
                    this.currentActivity = resolved.activity;
                if (touched('interaction')) {
                    this.interactionState = resolved.interaction;
                    this.clearDrag();
                    if (this.isConnected)
                        this.updateInteraction();
                }
                const eyeSides = ['left', 'right'].filter(side => allDesign || touched('expression', `${side}-expression`, 'smile', 'blink', `${side}-smile`, `${side}-blink`));
                if (eyeSides.length || JSON.stringify(validated) !== JSON.stringify(this.configuration))
                    this.applyDesign(validated, { shape: resolved.shapeOptions, eyes: resolved.motionOptions, eyeSides });
                if (touched('camera'))
                    this.setCamera(resolved.camera);
                else {
                    const camera = {};
                    for (const axis of ['yaw', 'pitch', 'roll'])
                        if (touched(`camera-${axis}`))
                            camera[axis] = resolved.camera[axis];
                    if (Object.keys(camera).length)
                        this.setCamera(camera);
                }
                if (touched('gaze-x', 'gaze-y'))
                    this.lookAt({ space: 'view', x: touched('gaze-x') ? resolved.gaze[0] : this.manualGaze[0], y: touched('gaze-y') ? resolved.gaze[1] : this.manualGaze[1] });
                if (touched('mouse-tracking', 'tracking-mode')) {
                    this.trackingModeState = resolved.trackingMode;
                    this.updateTrackingBody();
                    this.updateMouseTracking();
                }
                if (touched('time'))
                    this.seek(resolved.time);
                if (target)
                    void this.motion.to(target, resolved.motionOptions);
                this.syncState();
            });
        }
        catch (error) {
            // Keep rejected writes together: repairing one field retries the original batch.
            for (const [name, value] of pending)
                if (!this.pendingAttributes.has(name))
                    this.pendingAttributes.set(name, value);
            this.emit('sidekick-error', { message: error instanceof Error ? error.message : String(error), ...(error instanceof SidekickAttributeError ? { attribute: error.attribute, value: error.value } : {}) });
        }
    }
    upgradeProperties() {
        if (this.propertiesUpgraded)
            return;
        this.propertiesUpgraded = true;
        for (const name of ['design', 'camera', 'renderStyle', 'paused', 'interaction', 'mouseTracking', 'trackingMode']) {
            if (!Object.prototype.hasOwnProperty.call(this, name))
                continue;
            const value = this[name];
            Reflect.deleteProperty(this, name);
            try {
                Reflect.set(this, name, value);
            }
            catch (error) {
                this.emit('sidekick-error', { message: error instanceof Error ? error.message : String(error) });
            }
        }
    }
    immediateMotion() { return this.paused || this.reduced || !this.isConnected || !this.ready; }
    initializeRenderer(forceMain = false) {
        if (!this.connected || !this.canvas)
            return;
        const generation = ++this.generation;
        this.readyState = false;
        this.snapshotState = undefined;
        this.acknowledgedRevision = 0;
        this.poseRevision = 0;
        this.timeRevision = 0;
        const callbacks = {
            ready: (snapshot, revision) => {
                if (!this.connected || generation !== this.generation)
                    return;
                this.acceptSnapshot(snapshot, revision);
                this.readyState = true;
                this.canvas.hidden = false;
                this.fallback.hidden = true;
                this.updateMouseTracking();
                this.emit('sidekick-ready', {});
            },
            event: (event, revision) => {
                if (!this.connected || generation !== this.generation)
                    return;
                if ('snapshot' in event)
                    this.acceptSnapshot(event.snapshot, revision);
                if (event.kind === 'complete')
                    this.resolveRequest(event.request, event.result);
                else if (event.kind === 'pixels')
                    this.resolveRequest(event.request, event.image);
                else if (event.kind === 'snapshot')
                    this.resolveRequest(event.request, event.blob);
                else if (event.kind === 'request-error') {
                    const pending = this.requests.get(event.request);
                    this.requests.delete(event.request);
                    pending?.reject(new Error(event.message));
                }
                else if (event.kind === 'error')
                    this.runtimeFailure(new Error(event.message), generation);
            },
            failed: (error) => this.runtimeFailure(error, generation),
        };
        const attemptWorker = !forceMain && supportsRenderWorker(this.canvas);
        try {
            this.bridge = attemptWorker ? new WorkerRenderBridge(this.canvas, generation, callbacks) : new LocalRenderBridge(this.canvas, generation, callbacks);
            this.bridge.start(this.runtimeState());
            this.transferred ||= this.bridge?.transferred ?? false;
        }
        catch (error) {
            this.runtimeFailure(error instanceof Error ? error : new Error(String(error)), generation, attemptWorker);
        }
    }
    runtimeFailure(error, generation, wasWorker = this.bridge?.backend === 'worker') {
        if (!this.connected || generation !== this.generation)
            return;
        this.readyState = false;
        this.cancelInput();
        this.detachMouseTracking();
        this.clearDrag();
        this.disposeBridge(error);
        this.resetEyes();
        this.emit('sidekick-error', { message: error.message, recoverable: wasWorker });
        // An error listener may synchronously disconnect or reconnect this element.
        if (!this.connected || generation !== this.generation)
            return;
        if (wasWorker) {
            this.replaceCanvas();
            this.attachCanvasListeners();
            this.initializeRenderer(true);
        }
        else {
            this.canvas.hidden = true;
            this.fallback.hidden = false;
            this.fallback.textContent = error.message;
        }
    }
    acceptSnapshot(snapshot, revision) {
        if (revision < this.acknowledgedRevision || (revision === this.acknowledgedRevision && snapshot.frames < (this.snapshotState?.frames ?? 0)))
            return;
        this.snapshotState = snapshot;
        this.acknowledgedRevision = revision;
        if (revision >= this.timeRevision)
            this.elapsed = snapshot.time;
        if (revision >= this.poseRevision)
            this.currentPose = structuredClone(snapshot.pose);
    }
    disposeBridge(reason) {
        const bridge = this.bridge;
        this.bridge = undefined;
        this.transferred ||= bridge?.transferred ?? false;
        bridge?.dispose();
        for (const [id, pending] of this.requests) {
            if (pending.kind === 'motion' || pending.kind === 'shape')
                this.resolveRequest(id, { finished: false });
            else {
                this.requests.delete(id);
                pending.reject(reason);
            }
        }
    }
    request(kind) {
        const id = ++this.nextRequest;
        const promise = new Promise((resolve, reject) => this.requests.set(id, { kind, resolve: value => resolve(value), reject }));
        if (kind === 'motion' || kind === 'shape')
            void promise.then(detail => this.emit(kind === 'motion' ? 'sidekick-motion-end' : 'sidekick-shape-end', detail));
        return { id, promise };
    }
    resolveRequest(id, result) { const pending = this.requests.get(id); this.requests.delete(id); pending?.resolve(result); }
    send(command) { if (this.commandBatch)
        this.commandBatch.push(command);
    else
        this.bridge?.send(command); }
    batch(action) {
        const outer = this.commandBatch;
        this.commandBatch = [];
        try {
            action();
        }
        finally {
            const commands = this.commandBatch;
            this.commandBatch = outer;
            if (commands.length)
                this.send({ kind: 'batch', commands });
            this.poseRevision = this.bridge?.revision ?? 0;
            this.timeRevision = this.bridge?.revision ?? 0;
        }
    }
    runtimeState() {
        const rect = this.getBoundingClientRect();
        return { design: this.design, camera: this.camera, pose: this.pose, activity: this.activity, paused: this.paused, reduced: this.reduced, active: this.connected && this.visible && !this.ownerDocument.hidden, time: this.elapsed, gaze: [...this.gazeTarget], trackingMode: this.trackingMode, trackedGaze: this.drag ? undefined : this.trackedGaze, width: rect.width, height: rect.height, dpr: this.ownerDocument.defaultView?.devicePixelRatio ?? 1 };
    }
    syncState() {
        this.send({ kind: 'state', state: { activity: this.activity, paused: this.paused, reduced: this.reduced, active: this.connected && this.visible && !this.ownerDocument.hidden, gaze: [...this.gazeTarget], trackingMode: this.trackingMode, trackedGaze: this.drag ? undefined : this.trackedGaze } });
        if (this.paused || this.reduced) {
            this.currentPose.gaze = [...this.gazeTarget];
            this.poseRevision = this.bridge?.revision ?? 0;
        }
    }
    attachCanvasListeners() {
        this.canvas.addEventListener('pointerdown', this.onPointerDown);
        this.canvas.addEventListener('pointermove', this.onPointerMove);
        this.canvas.addEventListener('pointerup', this.onPointerUp);
        this.canvas.addEventListener('pointercancel', this.onPointerCancel);
        this.canvas.addEventListener('webglcontextrestored', this.onContextRestored);
    }
    detachCanvasListeners() {
        this.canvas?.removeEventListener('pointerdown', this.onPointerDown);
        this.canvas?.removeEventListener('pointermove', this.onPointerMove);
        this.canvas?.removeEventListener('pointerup', this.onPointerUp);
        this.canvas?.removeEventListener('pointercancel', this.onPointerCancel);
        this.canvas?.removeEventListener('webglcontextrestored', this.onContextRestored);
    }
    replaceCanvas() {
        this.detachCanvasListeners();
        const canvas = this.ownerDocument.createElement('canvas');
        canvas.setAttribute('part', 'canvas');
        canvas.setAttribute('aria-hidden', 'true');
        this.canvas?.replaceWith(canvas);
        this.canvas = canvas;
        this.transferred = false;
        this.captureCanvas = undefined;
    }
    updateInteraction() {
        this.setAttribute('role', this.interaction === 'box' ? 'button' : 'img');
        this.tabIndex = this.interaction === 'box' ? 0 : -1;
        this.style.setProperty('--sidekick-pointer-events', this.interaction === 'box' ? 'auto' : 'none');
        this.style.setProperty('--sidekick-cursor', this.interaction === 'box' ? 'grab' : 'auto');
    }
    resize = () => { this.pendingResize = true; this.queueInput(); };
    queueInput() { if (!this.inputFrame && this.connected)
        this.inputFrame = requestAnimationFrame(this.flushInput); }
    cancelInput() { if (this.inputFrame)
        cancelAnimationFrame(this.inputFrame); this.inputFrame = 0; this.pendingResize = false; this.pendingPointer = undefined; this.pendingDrag = undefined; }
    flushInput = () => {
        if (this.inputFrame)
            cancelAnimationFrame(this.inputFrame);
        this.inputFrame = 0;
        if (!this.connected)
            return;
        const dragged = this.pendingDrag;
        this.pendingDrag = undefined;
        if (dragged && this.drag)
            this.setCamera({ yaw: clamp(this.drag.camera.yaw + (dragged.x - this.drag.x) * .01 * 180 / Math.PI, -360, 360), pitch: clamp(this.drag.camera.pitch + (dragged.y - this.drag.y) * .007 * 180 / Math.PI, -90, 90) });
        const pointer = this.pendingPointer;
        this.pendingPointer = undefined;
        if (this.pendingResize || pointer) {
            const rect = this.getBoundingClientRect();
            if (this.pendingResize) {
                this.pendingResize = false;
                this.send({ kind: 'resize', width: rect.width, height: rect.height, dpr: this.ownerDocument.defaultView?.devicePixelRatio ?? 1 });
            }
            if (pointer && this.trackingDocument && !this.drag && rect.width > 0 && rect.height > 0) {
                this.trackedGaze = [clamp((pointer.x - rect.left - rect.width / 2) / (rect.width / 2), -1, 1), clamp((rect.top + rect.height / 2 - pointer.y) / (rect.height / 2), -1, 1)];
                this.setGazeTarget(this.trackedGaze);
            }
        }
    };
    emit(name, detail) { this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true })); }
    resetEyes() { this.validator.pose = structuredClone(this.currentPose); this.validator.setEyes({ left: this.configuration.eyes.left, right: this.configuration.eyes.right }); this.currentPose = structuredClone(this.validator.pose); }
    onMotionPreference = () => { this.reduced = this.media?.matches ?? false; this.syncState(); };
    onVisibility = () => { this.updateMouseTracking(); this.syncState(); };
    setGazeTarget(target) { this.gazeTarget = [...target]; this.syncState(); }
    updateMouseTracking() {
        const enabled = this.mouseTracking && this.isConnected && this.ready && this.visible && !this.ownerDocument.hidden;
        if (!enabled) {
            this.detachMouseTracking();
            return;
        }
        if (this.trackingDocument === this.ownerDocument)
            return;
        this.detachMouseTracking();
        this.trackingDocument = this.ownerDocument;
        this.trackingDocument.addEventListener('pointermove', this.onTrackedPointerMove, { passive: true });
        this.trackingDocument.addEventListener('pointerleave', this.onTrackingLeave);
        this.trackingDocument.addEventListener('pointerout', this.onTrackingOut);
        this.trackingDocument.defaultView?.addEventListener('blur', this.onTrackingBlur);
    }
    detachMouseTracking() {
        this.trackingDocument?.removeEventListener('pointermove', this.onTrackedPointerMove);
        this.trackingDocument?.removeEventListener('pointerleave', this.onTrackingLeave);
        this.trackingDocument?.removeEventListener('pointerout', this.onTrackingOut);
        this.trackingDocument?.defaultView?.removeEventListener('blur', this.onTrackingBlur);
        this.trackingDocument = undefined;
        this.restoreManualTracking();
    }
    updateTrackingBody() { this.syncState(); }
    restoreManualTracking() { this.pendingPointer = undefined; this.trackedGaze = undefined; this.setGazeTarget(this.manualGaze); }
    onTrackingBlur = () => { this.clearDrag(); this.restoreManualTracking(); };
    onTrackingLeave = (event) => { if (event.pointerType && event.pointerType !== 'mouse')
        return; this.restoreManualTracking(); };
    onTrackingOut = (event) => { if (event.relatedTarget === null)
        this.onTrackingLeave(event); };
    onTrackedPointerMove = (event) => {
        if (!this.trackingDocument || !this.mouseTracking || this.drag || (event.pointerType && event.pointerType !== 'mouse'))
            return;
        this.pendingPointer = { x: event.clientX, y: event.clientY };
        this.queueInput();
    };
    clearDrag() {
        this.pendingDrag = undefined;
        if (this.drag && this.canvas?.hasPointerCapture(this.drag.id))
            this.canvas.releasePointerCapture(this.drag.id);
        this.drag = undefined;
    }
    onKey = (event) => {
        if (this.interaction === 'box' && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            this.emit('sidekick-activate', {});
        }
    };
    onPointerDown = (event) => {
        if (this.interaction !== 'box' || event.button !== 0)
            return;
        this.drag = { id: event.pointerId, x: event.clientX, y: event.clientY, camera: this.camera, moved: false };
        this.trackedGaze = undefined;
        this.updateTrackingBody();
        this.canvas.setPointerCapture(event.pointerId);
    };
    onPointerMove = (event) => {
        if (!this.drag || this.drag.id !== event.pointerId)
            return;
        const dx = event.clientX - this.drag.x, dy = event.clientY - this.drag.y;
        if (Math.hypot(dx, dy) > 4)
            this.drag.moved = true;
        this.pendingDrag = { x: event.clientX, y: event.clientY };
        this.queueInput();
    };
    onPointerUp = (event) => {
        if (this.drag?.id !== event.pointerId)
            return;
        this.flushInput();
        if (!this.drag.moved)
            this.emit('sidekick-activate', {});
        if (this.canvas?.hasPointerCapture(event.pointerId))
            this.canvas.releasePointerCapture(event.pointerId);
        this.drag = undefined;
    };
    onPointerCancel = () => { this.clearDrag(); };
    onContextRestored = () => { if (this.connected && !this.ready && this.bridge?.backend !== 'worker') {
        this.disposeBridge(new Error('Graphics context restored'));
        this.initializeRenderer(true);
    } };
}
export function defineSidekick(tagName = 'sidekick-avatar') {
    if (typeof customElements === 'undefined')
        return;
    if (!customElements.get(tagName))
        customElements.define(tagName, tagName === 'sidekick-avatar' ? SidekickAvatar : class extends SidekickAvatar {
        });
}
