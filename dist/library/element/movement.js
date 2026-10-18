import { validateMotionOptions } from '../core/motion.js';
export function validatePosition(point) {
    if (!point || typeof point !== 'object' || Array.isArray(point) || Object.keys(point).some(key => key !== 'x' && key !== 'y'))
        throw new TypeError('position requires x and y in CSS pixels');
    for (const value of [point.x, point.y])
        if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 1e7)
            throw new RangeError('position must be finite CSS pixels within ±10000000');
    return { x: point.x, y: point.y };
}
/** Keep movement options as strict as pose-motion options, without passing travel to that validator. */
export function validateMoveOptions(options = {}) {
    if (!options || typeof options !== 'object' || Array.isArray(options))
        throw new TypeError('options must be a plain object');
    const prototype = Object.getPrototypeOf(options);
    if (prototype !== Object.prototype && prototype !== null)
        throw new TypeError('options must be a plain object');
    for (const key of Reflect.ownKeys(options)) {
        if (typeof key !== 'string' || !['duration', 'easing', 'travel'].includes(key))
            throw new TypeError(`unsupported movement option: ${String(key)}`);
        const descriptor = Object.getOwnPropertyDescriptor(options, key);
        if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value'))
            throw new TypeError(`movement option ${key} must be an ordinary data property`);
    }
    const timing = validateMotionOptions({ duration: options.duration, easing: options.easing });
    if (options.travel !== undefined && options.travel !== 'natural' && options.travel !== 'none')
        throw new TypeError('unsupported travel mode');
    return { ...timing, travel: options.travel ?? 'natural' };
}
const clamp = (value) => Math.max(0, Math.min(1, value));
const smooth = (value) => value * value * (3 - 2 * value);
const neutral = () => ({ direction: [0, 0], strength: 0, lift: 0, bank: 0 });
const copyPresentation = (value) => ({ ...value, direction: [...value.direction] });
function direction(x, y) {
    const length = Math.hypot(x, y);
    return length > 1e-9 ? [x / length, y / length] : [0, 0];
}
/** Interpolate angles instead of vectors so a reversal never collapses through a zero heading. */
function turn(from, to, progress) {
    if (!Math.hypot(...to))
        return [...from];
    if (!Math.hypot(...from))
        return [...to];
    if (progress === 0)
        return [...from];
    if (progress === 1)
        return [...to];
    const start = Math.atan2(from[1], from[0]);
    const difference = Math.atan2(from[0] * to[1] - from[1] * to[0], from[0] * to[0] + from[1] * to[1]);
    const angle = start + difference * progress;
    return [Math.cos(angle), Math.sin(angle)];
}
/** DOM translation has a separate clock from the renderer and never resizes its surface. */
export class AvatarMovement {
    host;
    point = { x: 0, y: 0 };
    velocity = { x: 0, y: 0 };
    phase = 'idle';
    progress = 0;
    presentation = neutral();
    frame = 0;
    revision = 0;
    sampling = false;
    reporting = false;
    track;
    constructor(host) {
        this.host = host;
    }
    get position() { return { ...this.point }; }
    get state() { return { phase: this.phase, progress: this.progress, position: this.position, velocity: { ...this.velocity } }; }
    to(point, options = {}) {
        const target = validatePosition(point), timing = validateMoveOptions(options);
        const revision = ++this.revision, now = this.host.now();
        this.sample(now);
        if (revision !== this.revision)
            return this.result(false);
        const previous = copyPresentation(this.presentation);
        // Superseding transfers presentation ownership to the new request instead of starting a separate landing.
        if (this.track)
            this.complete(this.track, false, false);
        const to = this.host.constrain(target), duration = this.host.immediate() ? 0 : timing.duration;
        if (!duration || (to.x === this.point.x && to.y === this.point.y)) {
            this.write(to);
            if (revision !== this.revision)
                return this.result(false);
            this.progress = 1;
            const result = { finished: true, position: this.position };
            this.reset();
            this.report();
            return new Promise(resolve => this.notify(result, resolve));
        }
        return new Promise(resolve => {
            const heading = direction(to.x - this.point.x, to.y - this.point.y);
            this.track = {
                kind: 'travel', from: this.position, to, start: now, duration, smooth: timing.easing === 'smooth', natural: timing.travel === 'natural', intensity: Math.min(1, Math.hypot(to.x - this.point.x, to.y - this.point.y) / 100), fromTravel: 0,
                presentation: previous, headingFrom: previous.direction, heading, headingStart: now, turnDuration: Math.min(180, duration * 0.15), resolve,
            };
            this.progress = 0;
            this.velocity = { x: 0, y: 0 };
            this.phase = this.track.natural ? 'takeoff' : 'flight';
            this.report();
            this.schedule();
        });
    }
    by(delta, options = {}) {
        const offset = validatePosition(delta);
        validateMoveOptions(options);
        const revision = ++this.revision;
        this.sample(this.host.now());
        if (revision !== this.revision)
            return this.result(false);
        return this.to({ x: this.point.x + offset.x, y: this.point.y + offset.y }, options);
    }
    /** Freeze travel, then lower the presentation gently. Lifecycle callers may request an immediate reset. */
    cancel(immediate = false) {
        const pending = this.track;
        if (!pending)
            return;
        const revision = ++this.revision;
        if (immediate || this.host.immediate()) {
            this.complete(pending, false);
            return;
        }
        this.sample(this.host.now());
        if (revision !== this.revision)
            return;
        const track = this.track;
        if (!track)
            return;
        if (track.kind === 'settling')
            return;
        if (!this.presentation.strength && !this.presentation.lift && !this.presentation.bank) {
            this.complete(track, false);
            return;
        }
        this.stopFrame();
        this.track = { kind: 'settling', start: this.host.now(), duration: 180, presentation: copyPresentation(this.presentation), resolve: track.resolve };
        this.velocity = { x: 0, y: 0 };
        this.phase = 'settling';
        this.report();
        this.schedule();
    }
    /** Disconnect must not leave a detached element scheduling a presentation-only landing. */
    disconnect() { this.cancel(true); }
    /** Clamp both current point and remaining target after viewport/element resizing, without restarting the clock. */
    resize() {
        const revision = ++this.revision, now = this.host.now();
        this.sample(now);
        if (revision !== this.revision)
            return;
        this.write(this.host.constrain(this.point));
        if (revision !== this.revision)
            return;
        const track = this.track;
        if (track?.kind === 'travel') {
            track.fromTravel = this.travelFraction(track, clamp((now - track.start) / track.duration));
            track.from = this.position;
            track.to = this.host.constrain(track.to);
            track.headingFrom = [...this.presentation.direction];
            track.heading = direction(track.to.x - track.from.x, track.to.y - track.from.y);
            track.headingStart = now;
            track.turnDuration = Math.min(120, Math.max(0, track.start + track.duration - now));
        }
        this.velocity = { x: 0, y: 0 };
        this.report();
    }
    /** Reduced motion snaps to the target; an already cancelled request remains cancelled. */
    finish() { this.revision++; this.finishCurrent(); }
    finishCurrent() {
        const track = this.track;
        if (track?.kind === 'travel') {
            this.write(this.host.constrain(track.to));
            this.progress = 1;
            this.complete(track, true);
        }
        else if (track)
            this.complete(track, false);
        else {
            this.reset();
            this.report();
        }
    }
    write(point) { this.point = { ...point }; this.host.render(this.position); }
    report() {
        if (this.reporting)
            return;
        this.reporting = true;
        try {
            this.host.progress?.(this.state);
        }
        finally {
            this.reporting = false;
        }
    }
    present(value) { this.presentation = copyPresentation(value); this.host.presentation?.(copyPresentation(value)); }
    reset() { this.phase = 'idle'; this.velocity = { x: 0, y: 0 }; this.present(neutral()); }
    stopFrame() { if (this.frame)
        this.host.cancelFrame(this.frame); this.frame = 0; }
    schedule() { if (this.track && !this.frame)
        this.frame = this.host.requestFrame(this.tick); }
    complete(track, finished, reset = true) {
        if (this.track !== track)
            return;
        this.track = undefined;
        this.stopFrame();
        const result = { finished, position: this.position };
        if (reset) {
            this.reset();
            this.report();
        }
        this.notify(result, track.resolve);
    }
    result(finished) {
        const result = { finished, position: this.position };
        return new Promise(resolve => this.notify(result, resolve));
    }
    /** A host may acknowledge an ordered worker render before completion becomes observable. */
    notify(result, resolve) {
        queueMicrotask(() => {
            try {
                const completion = this.host.complete(result);
                if (completion)
                    void Promise.resolve(completion).then(() => resolve(result), () => resolve(result));
                else
                    resolve(result);
            }
            catch {
                resolve(result);
            }
        });
    }
    travelFraction(track, progress) {
        const time = track.natural ? progress <= 0.15 ? 0 : progress >= 0.85 ? 1 : (progress - 0.15) / 0.7 : progress;
        return track.smooth ? smooth(time) : time;
    }
    sample(now) {
        // Public progress callbacks may synchronously retarget, cancel, or resize the movement.
        if (this.sampling)
            return;
        this.sampling = true;
        try {
            this.sampleTrack(now);
        }
        finally {
            this.sampling = false;
        }
    }
    sampleTrack(now) {
        const track = this.track;
        if (!track)
            return;
        if (this.host.immediate()) {
            this.finishCurrent();
            return;
        }
        const raw = clamp((now - track.start) / track.duration);
        if (track.kind === 'settling') {
            const strength = 1 - smooth(raw);
            this.present({ direction: [...track.presentation.direction], strength: track.presentation.strength * strength, lift: track.presentation.lift * strength, bank: track.presentation.bank * strength });
            if (this.track !== track)
                return;
            if (raw === 1)
                this.complete(track, false);
            else
                this.report();
            return;
        }
        const travel = this.travelFraction(track, raw), remaining = 1 - track.fromTravel;
        const fraction = remaining > 1e-9 ? clamp((travel - track.fromTravel) / remaining) : 1;
        const unconstrained = { x: track.from.x + (track.to.x - track.from.x) * fraction, y: track.from.y + (track.to.y - track.from.y) * fraction };
        const point = this.host.constrain(unconstrained);
        const travelTime = track.natural ? clamp((raw - 0.15) / 0.7) : raw;
        const inFlight = !track.natural || (raw >= 0.15 && raw < 0.85);
        const derivative = inFlight && raw < 1 && remaining > 1e-9 ? (track.smooth ? 6 * travelTime * (1 - travelTime) : 1) / (track.duration * (track.natural ? 0.7 : 1) * remaining) * 1000 : 0;
        this.velocity = {
            x: point.x === unconstrained.x ? (track.to.x - track.from.x) * derivative : 0,
            y: point.y === unconstrained.y ? (track.to.y - track.from.y) * derivative : 0,
        };
        this.progress = raw;
        this.phase = track.natural ? raw < 0.15 ? 'takeoff' : raw < 0.85 ? 'flight' : 'landing' : 'flight';
        this.write(point);
        if (this.track !== track)
            return;
        if (raw === 1) {
            this.complete(track, true);
            return;
        }
        if (track.natural) {
            const turnProgress = track.turnDuration ? smooth(clamp((now - track.headingStart) / track.turnDuration)) : 1;
            const heading = turn(track.headingFrom, track.heading, turnProgress);
            const takeoff = smooth(clamp(raw / 0.15)), landing = 1 - smooth(clamp((raw - 0.85) / 0.15));
            const strength = (track.presentation.strength + (track.intensity - track.presentation.strength) * takeoff) * landing;
            const lift = (track.presentation.lift + (0.06 * track.intensity - track.presentation.lift) * takeoff) * landing;
            const bank = (track.presentation.bank + (-heading[0] * 0.12 * track.intensity - track.presentation.bank) * takeoff) * landing;
            this.present({ direction: heading, strength, lift, bank });
        }
        else {
            // An explicit plain move can interrupt flight without popping a previous airborne pose away.
            const decay = 1 - smooth(clamp((now - track.start) / Math.min(180, track.duration)));
            this.present({ direction: [...track.presentation.direction], strength: track.presentation.strength * decay, lift: track.presentation.lift * decay, bank: track.presentation.bank * decay });
        }
        if (this.track === track)
            this.report();
    }
    tick = (now) => { this.frame = 0; this.sample(now); this.schedule(); };
}
