import { clamp, spring } from '../core/math.js';
import { MotionTimeline } from '../core/motion.js';
import { ShapeTimeline } from '../core/shape-motion.js';
import { TrackingBodyLayer } from '../core/tracking.js';
import { cropPixels } from '../core/pixels.js';
import { automaticBlink } from '../core/expressions.js';
import { AvatarRenderer } from '../renderer/webgl.js';
const IDLE_DRAW_INTERVAL = 1 / 30;
export function frameScheduler(scope = globalThis) {
    let next = 0;
    const pending = new Map();
    return {
        request(callback) {
            const id = ++next;
            const run = (now) => { pending.delete(id); callback(now); };
            // Worker RAF can exist but throw when its owner has no supported Window.
            if (typeof scope.requestAnimationFrame === 'function') {
                try {
                    const handle = scope.requestAnimationFrame(run);
                    pending.set(id, { kind: 'raf', handle });
                    return id;
                }
                catch { /* Timers remain usable. */ }
            }
            const handle = scope.setTimeout(() => run(scope.performance.now()), 16);
            pending.set(id, { kind: 'timer', handle });
            return id;
        },
        cancel(id) {
            const task = pending.get(id);
            if (!task)
                return;
            pending.delete(id);
            if (task.kind === 'raf')
                scope.cancelAnimationFrame(task.handle);
            else
                scope.clearTimeout(task.handle);
        },
    };
}
/** All animated state and geometry live here, on the dedicated worker by default. */
export class RenderEngine {
    emit;
    scheduler;
    state;
    timeline;
    shape;
    tracking = new TrackingBodyLayer();
    velocity = [0, 0];
    scheduled = 0;
    lastTick = 0;
    idleDrawElapsed = 0;
    rendererDelta = 0;
    dirty = true;
    disposed = false;
    frames = 0;
    revision = 0;
    batchDepth = 0;
    renderCpu = { lastMs: 0, totalMs: 0, maxMs: 0 };
    renderedRotation = [0, 0, 0];
    contextLost = (event) => {
        event.preventDefault();
        this.stop();
        this.notify({ kind: 'error', message: 'WebGL context lost' });
    };
    renderer;
    constructor(canvas, initial, emit, scheduler = frameScheduler(), renderer) {
        this.emit = emit;
        this.scheduler = scheduler;
        this.state = structuredClone(initial);
        this.timeline = new MotionTimeline({ left: initial.design.eyes.left, right: initial.design.eyes.right });
        this.timeline.pose = structuredClone(initial.pose);
        if (initial.paused || initial.reduced)
            this.timeline.pose.gaze = [...initial.gaze];
        this.shape = new ShapeTimeline(initial.design.body.shape);
        this.renderer = renderer ?? new AvatarRenderer(canvas);
        try {
            canvas.addEventListener('webglcontextlost', this.contextLost);
            this.renderer.resize(initial.width, initial.height, initial.dpr);
            this.updateTracking();
            this.render(true);
            this.wake();
        }
        catch (error) {
            // The bridge cannot own this instance until construction succeeds. Release
            // the acquired renderer, listener and any frame before propagating failure.
            this.dispose();
            throw error;
        }
    }
    get snapshot() {
        return { renderCpu: { ...this.renderCpu }, pose: structuredClone(this.timeline.pose), time: this.state.time, renderedRotation: [...this.renderedRotation], frames: this.frames, running: this.scheduled !== 0, ...this.renderer.stats, width: this.renderer.canvas.width, height: this.renderer.canvas.height };
    }
    notify(event, revision = this.revision) {
        if (this.batchDepth && event.kind === 'frame')
            return;
        this.emit(event, revision);
    }
    complete(request, result) {
        void result.then(value => {
            if (this.disposed || request === undefined)
                return;
            if (this.dirty && this.state.active)
                this.render(true);
            if (!this.animated())
                this.stop();
            this.notify({ kind: 'complete', request, result: value, snapshot: this.snapshot }, this.revision);
        }).catch(error => { if (!this.disposed) {
            this.stop();
            this.notify({ kind: 'error', message: error instanceof Error ? error.message : String(error) });
        } });
    }
    command(command, revision = this.revision + 1) {
        if (this.disposed)
            return;
        this.revision = revision;
        switch (command.kind) {
            case 'batch': {
                this.batchDepth++;
                try {
                    for (const part of command.commands)
                        this.command(part, revision);
                }
                finally {
                    this.batchDepth--;
                }
                this.notify({ kind: 'frame', snapshot: this.snapshot }, revision);
                return;
            }
            case 'design': {
                const next = command.design, previous = this.state.design;
                if (next.body.shape !== previous.body.shape) {
                    if (command.transition)
                        this.complete(command.shapeRequest, this.shape.to(next.body.shape, command.transition.shape));
                    else
                        this.shape.set(next.body.shape);
                }
                else if (command.shapeRequest !== undefined)
                    this.complete(command.shapeRequest, Promise.resolve({ finished: true }));
                const sides = ['left', 'right'].filter(side => command.transition?.eyeSides?.includes(side) || next.eyes[side].weights.smile !== previous.eyes[side].weights.smile || next.eyes[side].weights.blink !== previous.eyes[side].weights.blink);
                if (sides.length) {
                    if (command.transition)
                        this.complete(command.eyeRequest, this.timeline.to({ eyes: Object.fromEntries(sides.map(side => [side, { weights: next.eyes[side].weights }])) }, command.transition.eyes));
                    else
                        this.timeline.setEyes({ left: next.eyes.left, right: next.eyes.right }, sides);
                }
                else if (command.eyeRequest !== undefined)
                    this.complete(command.eyeRequest, Promise.resolve({ finished: true }));
                this.timeline.removeAccessories(previous.accessories.filter(item => !next.accessories.some(part => part.id === item.id)).map(item => item.id));
                this.state.design = next;
                break;
            }
            case 'motion':
                this.complete(command.request, this.timeline.to(command.target, command.options));
                break;
            case 'shape':
                this.complete(command.request, this.shape.to(command.shape, command.options));
                this.state.design = { ...this.state.design, body: { ...this.state.design.body, shape: command.shape } };
                break;
            case 'persist-design':
                this.state.design = command.design;
                break;
            case 'cancel':
                this.timeline.cancel();
                break;
            case 'state': {
                const changed = Object.entries(command.state).some(([key, value]) => {
                    const previous = this.state[key];
                    if (Array.isArray(value) && Array.isArray(previous))
                        return value.length !== previous.length || value.some((part, index) => part !== previous[index]);
                    if (key === 'camera' && value && typeof value === 'object') {
                        const camera = value;
                        return camera.yaw !== this.state.camera.yaw || camera.pitch !== this.state.camera.pitch || camera.roll !== this.state.camera.roll || camera.zoom !== this.state.camera.zoom;
                    }
                    return value !== previous;
                });
                if (!changed) {
                    this.notify({ kind: 'frame', snapshot: this.snapshot }, this.revision);
                    return;
                }
                const wasActive = this.state.active;
                if ((command.state.activity !== undefined && command.state.activity !== this.state.activity)
                    || (command.state.paused !== undefined && command.state.paused !== this.state.paused)
                    || (command.state.reduced !== undefined && command.state.reduced !== this.state.reduced)
                    || (command.state.time !== undefined && command.state.time !== this.state.time))
                    this.resetPacing();
                Object.assign(this.state, command.state);
                if (!this.state.active || wasActive !== this.state.active)
                    this.stop();
                if (this.state.paused || this.state.reduced) {
                    this.timeline.advance(60000);
                    this.shape.finish();
                    this.timeline.pose.gaze = [...this.state.gaze];
                    this.velocity = [0, 0];
                }
                this.updateTracking();
                break;
            }
            case 'resize': {
                const { width, height, dpr } = command;
                if (width === this.state.width && height === this.state.height && dpr === this.state.dpr) {
                    this.notify({ kind: 'frame', snapshot: this.snapshot }, this.revision);
                    return;
                }
                Object.assign(this.state, { width, height, dpr });
                this.renderer.resize(width, height, dpr);
                break;
            }
            case 'reset-tracking':
                this.tracking.reset();
                this.velocity = [0, 0];
                this.timeline.pose.gaze = [...this.state.gaze];
                break;
            case 'capture':
                this.notify({ kind: 'pixels', request: command.request, image: this.capture(), snapshot: this.snapshot });
                return;
            case 'snapshot': {
                const image = this.capture(), snapshot = this.snapshot, revision = this.revision;
                void encodeSnapshot(image, command.options, this.renderer.canvas).then(blob => {
                    if (!this.disposed)
                        this.notify({ kind: 'snapshot', request: command.request, blob, snapshot }, revision);
                }, error => { if (!this.disposed)
                    this.notify({ kind: 'request-error', request: command.request, message: error instanceof Error ? error.message : String(error) }, revision); });
                return;
            }
            case 'dispose':
                this.dispose();
                return;
        }
        this.dirty = true;
        this.wake();
        // Immediate commands acknowledge their pose even when the surface is hidden.
        this.notify({ kind: 'frame', snapshot: this.snapshot });
    }
    capture() {
        this.render(true);
        if (!this.animated())
            this.stop();
        return { width: this.renderer.canvas.width, height: this.renderer.canvas.height, pixels: this.renderer.readPixels() };
    }
    updateTracking() { this.tracking.follow(this.state.trackingMode === 'eyes-and-body' && !this.state.reduced ? this.state.trackedGaze : undefined); }
    gazeMoving() { return this.state.gaze.some((target, i) => Math.abs(target - this.timeline.pose.gaze[i]) > .0001 || Math.abs(this.velocity[i]) > .0001); }
    animated() {
        if (this.state.paused)
            return this.tracking.settling;
        return this.timeline.active || this.shape.active || this.gazeMoving() || this.tracking.active || (!this.state.reduced && this.state.activity !== 'still');
    }
    paceIdle() {
        return !this.dirty && this.state.activity === 'idle' && !this.state.paused && !this.state.reduced && !this.timeline.active && !this.shape.active && !this.gazeMoving() && !this.tracking.active;
    }
    resetPacing() { this.idleDrawElapsed = 0; this.rendererDelta = 0; }
    wake() {
        if (this.disposed || this.scheduled || !this.state.active || (!this.dirty && !this.animated()))
            return;
        this.scheduled = this.scheduler.request(this.tick);
    }
    stop() { if (this.scheduled)
        this.scheduler.cancel(this.scheduled); this.scheduled = 0; this.lastTick = 0; this.resetPacing(); }
    tick = (now) => {
        try {
            this.tickFrame(now);
        }
        catch (error) {
            this.stop();
            this.notify({ kind: 'error', message: error instanceof Error ? error.message : String(error) });
        }
    };
    tickFrame(now) {
        this.scheduled = 0;
        if (this.disposed || !this.state.active)
            return;
        const elapsed = this.lastTick ? clamp(now - this.lastTick, 0, 60000) : 0;
        const delta = Math.min(elapsed / 1000, .05);
        this.lastTick = now;
        // Preserve pre-advance activity so a track's exact endpoint is never skipped.
        const idle = this.paceIdle();
        this.idleDrawElapsed += delta;
        this.rendererDelta += delta;
        if (!this.state.paused) {
            this.state.time += delta;
            this.timeline.advance(elapsed);
            this.shape.advance(elapsed);
            for (const i of [0, 1]) {
                const [position, velocity] = spring(this.timeline.pose.gaze[i], this.velocity[i], this.state.gaze[i], delta, 16);
                this.timeline.pose.gaze[i] = position;
                this.velocity[i] = velocity;
                if (Math.abs(this.state.gaze[i] - position) < .0001 && Math.abs(velocity) < .0001) {
                    this.timeline.pose.gaze[i] = this.state.gaze[i];
                    this.velocity[i] = 0;
                }
            }
        }
        if (!this.state.paused || this.tracking.settling)
            this.tracking.advance(delta);
        // Keep the entire blink, its final reopen and one incoming frame at RAF rate.
        const blink = idle && (automaticBlink(this.state.time) < 1 || automaticBlink(this.state.time + (delta || 1 / 60)) < 1 || automaticBlink(this.state.time - delta) < 1);
        const draw = !idle || !this.paceIdle() || blink || this.idleDrawElapsed + 1e-9 >= IDLE_DRAW_INTERVAL;
        if (draw) {
            // Carry cadence remainder to avoid 60 Hz floating-point drift into 20 Hz.
            const carry = idle && !blink ? Math.max(0, this.idleDrawElapsed - IDLE_DRAW_INTERVAL) % IDLE_DRAW_INTERVAL : 0;
            this.render(true);
            this.idleDrawElapsed = carry;
        }
        this.wake();
        if (!this.scheduled)
            this.lastTick = 0;
        if (draw)
            this.notify({ kind: 'frame', snapshot: this.snapshot });
    }
    render(force = false) {
        if (this.disposed || (!force && !this.dirty && !this.animated()))
            return;
        const shape = this.shape.snapshot;
        const pose = this.tracking.compose(this.timeline.pose);
        this.renderedRotation = [...pose.rotation];
        const started = performance.now();
        this.renderer.render(this.state.design, { pose, eyeMotion: this.timeline.eyeMotion, contour: shape.contour, profile: shape.profile, activity: this.state.activity, time: this.state.time, delta: this.rendererDelta, reduced: this.state.reduced, style: 'flat', camera: this.state.camera });
        const duration = performance.now() - started;
        this.renderCpu.lastMs = duration;
        this.renderCpu.totalMs += duration;
        this.renderCpu.maxMs = Math.max(this.renderCpu.maxMs, duration);
        this.dirty = false;
        this.frames++;
        this.resetPacing();
    }
    dispose() {
        if (this.disposed)
            return;
        this.disposed = true;
        this.stop();
        this.timeline.cancel();
        this.shape.cancel();
        this.tracking.reset();
        this.renderer.canvas.removeEventListener('webglcontextlost', this.contextLost);
        this.renderer.dispose();
    }
}
/** GPU bytes are bottom-up; flip after cropping so PNGs retain their orientation. */
export async function encodeSnapshot(image, options, source) {
    const cropped = cropPixels(image, options), { width, height } = cropped;
    const pixels = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++)
        pixels.set(cropped.pixels.subarray(y * width * 4, (y + 1) * width * 4), (height - y - 1) * width * 4);
    // WebGL's antialiased framebuffer is premultiplied; ImageData expects straight RGBA.
    for (let i = 0; i < pixels.length; i += 4) {
        const alpha = pixels[i + 3];
        if (alpha > 0 && alpha < 255)
            for (let channel = 0; channel < 3; channel++)
                pixels[i + channel] = Math.min(255, Math.round(pixels[i + channel] * 255 / alpha));
    }
    const canvas = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(width, height) : source.ownerDocument.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context)
        throw new Error('PNG 내보내기용 canvas를 만들지 못했습니다.');
    context.putImageData(new ImageData(pixels, width, height), 0, 0);
    if ('convertToBlob' in canvas)
        return canvas.convertToBlob({ type: 'image/png' });
    return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG 내보내기 실패')), 'image/png'));
}
