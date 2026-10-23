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
        if (typeof key !== 'string' || !['duration', 'easing', 'travel', 'maxSpeed', 'acceleration', 'deceleration'].includes(key))
            throw new TypeError(`unsupported movement option: ${String(key)}`);
        const descriptor = Object.getOwnPropertyDescriptor(options, key);
        if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value'))
            throw new TypeError(`movement option ${key} must be an ordinary data property`);
    }
    const timing = validateMotionOptions({ duration: options.duration, easing: options.easing });
    if (options.travel !== undefined && options.travel !== 'natural' && options.travel !== 'none')
        throw new TypeError('unsupported travel mode');
    for (const key of ['maxSpeed', 'acceleration', 'deceleration']) {
        if (options[key] !== undefined && (typeof options[key] !== 'number' || !Number.isFinite(options[key]) || options[key] < 1 || options[key] > 100000))
            throw new RangeError(key + ' must be between 1 and 100000');
    }
    return { ...timing, travel: options.travel ?? 'natural', maxSpeed: options.maxSpeed ?? 1350, acceleration: options.acceleration ?? 1800, deceleration: options.deceleration ?? 2200 };
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
    acceleration = { x: 0, y: 0 };
    phase = 'idle';
    progress = 0;
    presentation = neutral();
    frame = 0;
    revision = 0;
    sampling = false;
    reporting = false;
    track;
    suspended = false;
    suspendedAt = 0;
    followTiming = validateMoveOptions();
    constructor(host) {
        this.host = host;
    }
    get position() { return { ...this.point }; }
    get state() { return { phase: this.phase, progress: this.progress, position: this.position, velocity: { ...this.velocity }, acceleration: { ...this.acceleration }, speed: Math.hypot(this.velocity.x, this.velocity.y) }; }
    to(point, options = {}) {
        const target = validatePosition(point), timing = validateMoveOptions(options);
        this.followTiming = timing;
        const revision = ++this.revision, now = this.host.now();
        this.sample(now);
        if (revision !== this.revision)
            return this.result(false);
        const previous = copyPresentation(this.presentation), pending = this.track;
        // Superseding transfers presentation ownership to the new request instead of starting a separate landing.
        if (this.track)
            this.complete(this.track, false, false);
        const to = this.host.constrain(target), duration = this.host.immediate() ? 0 : timing.duration;
        // Repeating a destination transfers request ownership, not the motion clock.
        // In particular, restarting a tween here would make frequent updates stall.
        const sameTarget = pending && ('to' in pending ? pending.to.x === to.x && pending.to.y === to.y : pending.finished && this.point.x === to.x && this.point.y === to.y);
        if (duration && sameTarget && ((pending.kind === 'travel' && timing.travel === 'none' && pending.duration === duration && pending.smooth === (timing.easing === 'smooth')) || pending.kind === 'settling')) {
            return new Promise(resolve => { this.track = { ...pending, resolve, silent: false }; this.schedule(); });
        }
        if (!duration || (to.x === this.point.x && to.y === this.point.y && Math.hypot(this.velocity.x, this.velocity.y) < 0.01 && (timing.travel !== 'natural' || Math.hypot(this.acceleration.x, this.acceleration.y) < 0.01))) {
            this.write(to);
            if (revision !== this.revision)
                return this.result(false);
            this.progress = 1;
            const result = { finished: true, position: this.position };
            this.reset();
            this.report();
            return new Promise(resolve => this.notify(result, resolve));
        }
        if (timing.travel === 'natural') {
            return new Promise(resolve => {
                const distance = Math.hypot(to.x - this.point.x, to.y - this.point.y);
                // Carry fractional integration time across commands, even if commands arrive
                // faster than the 240 Hz physics tick. State continuity includes its clock.
                const ongoing = pending?.kind === 'physical' ? pending : undefined;
                this.track = { kind: 'physical', to, start: ongoing?.start ?? now, last: ongoing?.last ?? now, accumulator: ongoing?.accumulator ?? 0,
                    maxSpeed: timing.maxSpeed,
                    acceleration: timing.acceleration, deceleration: timing.deceleration, initialDistance: sameTarget && ongoing ? ongoing.initialDistance : Math.max(distance, 1), stopping: false, natural: timing.travel === 'natural', resolve };
                if (!sameTarget || !ongoing)
                    this.progress = 0;
                if (!ongoing || ongoing.stopping)
                    this.phase = Math.hypot(this.velocity.x, this.velocity.y) > 0.1 ? 'flight' : 'takeoff';
                this.report();
                this.schedule();
            });
        }
        return new Promise(resolve => {
            const heading = direction(to.x - this.point.x, to.y - this.point.y);
            this.track = {
                kind: 'travel', from: this.position, to, start: now, duration, smooth: timing.easing === 'smooth', natural: timing.travel === 'natural', intensity: Math.min(1, Math.hypot(to.x - this.point.x, to.y - this.point.y) / 100), fromTravel: 0,
                presentation: previous, headingFrom: previous.direction, heading, headingStart: now, turnDuration: Math.min(180, duration * 0.15), resolve,
            };
            this.progress = 0;
            this.velocity = { x: 0, y: 0 };
            this.acceleration = { x: 0, y: 0 };
            this.phase = this.track.natural ? 'takeoff' : 'flight';
            this.report();
            this.schedule();
        });
    }
    by(delta, options = {}, constrainTarget = point => point) {
        const offset = validatePosition(delta);
        validateMoveOptions(options);
        const revision = ++this.revision;
        this.sample(this.host.now());
        if (revision !== this.revision)
            return this.result(false);
        return this.to(constrainTarget({ x: this.point.x + offset.x, y: this.point.y + offset.y }), options);
    }
    /** Brake natural travel with inertia, then settle. Plain tweens freeze; lifecycle teardown resets immediately. */
    cancel(immediate = false) {
        const revision = ++this.revision;
        const pending = this.track;
        if (!pending)
            return;
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
        if (track.kind === 'settling') {
            track.finished = false;
            return;
        }
        if (track.kind === 'physical') {
            track.stopping = true;
            this.phase = 'braking';
            this.report();
            this.schedule();
            return;
        }
        if (!this.presentation.strength && !this.presentation.lift && !this.presentation.bank) {
            this.complete(track, false);
            return;
        }
        this.stopFrame();
        this.track = { kind: 'settling', start: this.host.now(), duration: 180, presentation: copyPresentation(this.presentation), resolve: track.resolve, silent: track.silent };
        this.velocity = { x: 0, y: 0 };
        this.phase = 'settling';
        this.report();
        this.schedule();
    }
    /** Internal presence staging: hidden relocation, no synthetic successful movement event. */
    relocate(point) {
        const target = validatePosition(point);
        const revision = ++this.revision;
        if (this.track)
            this.complete(this.track, false);
        if (revision !== this.revision)
            return;
        this.write(target);
        if (revision !== this.revision)
            return;
        this.reset();
    }
    /** Retarget the existing request; subsequent follow journeys are silent and inertial. */
    followTarget(point) {
        const to = this.host.constrain(validatePosition(point)), track = this.track;
        if (track?.kind === 'physical' && !track.stopping) {
            track.to = to;
            return;
        }
        if (track?.kind === 'travel') {
            if (Math.hypot(to.x - track.to.x, to.y - track.to.y) <= 0.01)
                return;
            // A moving endpoint is a pursuit, not a new interpolation from the old
            // origin. Preserve the current derivatives and the original promise.
            const now = this.host.now();
            this.track = { kind: 'physical', to, start: now, last: now, accumulator: 0,
                maxSpeed: this.followTiming.maxSpeed, acceleration: this.followTiming.acceleration,
                deceleration: this.followTiming.deceleration, initialDistance: Math.max(1, Math.hypot(to.x - this.point.x, to.y - this.point.y)),
                stopping: false, natural: track.natural, fade: track.natural ? undefined : { start: track.start, duration: Math.min(180, track.duration), presentation: track.presentation }, resolve: track.resolve, silent: track.silent };
            this.schedule();
            return;
        }
        if (track && !(track.kind === 'settling' && track.finished))
            return;
        const distance = Math.hypot(to.x - this.point.x, to.y - this.point.y);
        // Ignore subpixel layout noise at rest; active pursuit still converges accurately.
        if (distance <= 0.5)
            return;
        if (this.host.immediate()) {
            if (!this.suspended)
                this.write(to);
            return;
        }
        const now = this.host.now();
        this.track = { kind: 'physical', to, start: now, last: now, accumulator: 0,
            maxSpeed: this.followTiming.maxSpeed, acceleration: this.followTiming.acceleration,
            deceleration: this.followTiming.deceleration, initialDistance: Math.max(distance, 1),
            stopping: false, natural: this.followTiming.travel === 'natural', resolve: track?.resolve ?? (() => { }), silent: track?.silent ?? !track };
        this.progress = 0;
        this.phase = 'takeoff';
        this.schedule();
    }
    /** Freeze clocks while out of view; retain momentum without wall-clock catch-up. */
    suspend(value) {
        if (this.suspended === value)
            return;
        const now = this.host.now();
        this.suspended = value;
        if (value) {
            this.suspendedAt = now;
            this.stopFrame();
            return;
        }
        if (this.track?.kind === 'physical') {
            this.track.last = now;
            this.track.accumulator = 0;
        }
        else if (this.track)
            this.track.start += Math.max(0, now - Math.max(this.suspendedAt, this.track.start));
        this.schedule();
    }
    /** Detaching keeps the initial request, but brakes any later silent pursuit. */
    stopFollowing() { if (this.track?.silent)
        this.cancel(); }
    /** Disconnect must not leave a detached element scheduling a presentation-only landing. */
    disconnect() { this.cancel(true); }
    /** Clamp both current point and remaining target after viewport/element resizing, without restarting the clock. */
    resize() {
        const revision = ++this.revision, now = this.suspended ? Math.max(this.suspendedAt, this.track?.start ?? this.suspendedAt) : this.host.now();
        this.sample(now);
        if (revision !== this.revision)
            return;
        const beforeClamp = this.position;
        this.write(this.host.constrain(this.point));
        if (revision !== this.revision)
            return;
        if (this.point.x !== beforeClamp.x) {
            this.velocity.x = 0;
            this.acceleration.x = 0;
        }
        if (this.point.y !== beforeClamp.y) {
            this.velocity.y = 0;
            this.acceleration.y = 0;
        }
        if (revision !== this.revision)
            return;
        const track = this.track;
        if (track?.kind === 'physical') {
            track.to = this.host.constrain(track.to);
            this.report();
            return;
        }
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
        if (track?.kind === 'physical' && !track.stopping) {
            this.write(this.host.constrain(track.to));
            this.progress = 1;
            this.complete(track, true);
        }
        else if (track?.kind === 'travel') {
            this.write(this.host.constrain(track.to));
            this.progress = 1;
            this.complete(track, true);
        }
        else if (track)
            this.complete(track, track.kind === 'settling' ? track.finished ?? false : false);
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
    reset() { this.phase = 'idle'; this.velocity = { x: 0, y: 0 }; this.acceleration = { x: 0, y: 0 }; this.present(neutral()); }
    stopFrame() { if (this.frame)
        this.host.cancelFrame(this.frame); this.frame = 0; }
    schedule() { if (this.track && !this.frame && !this.suspended)
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
        if (track.silent)
            track.resolve(result);
        else
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
        if (this.sampling || this.suspended)
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
        // The geometry scheduler is deliberately independent and may run after this
        // RAF. Sample once at the deadline/settle boundary so callback ordering cannot
        // resolve a request at a target that moved in this very frame.
        if ((track.kind === 'travel' || (track.kind === 'settling' && track.finished)) && now >= track.start + track.duration) {
            this.host.refreshTarget?.();
            if (this.track !== track || this.suspended)
                return;
        }
        if (this.host.immediate()) {
            this.finishCurrent();
            return;
        }
        if (track.kind === 'physical') {
            this.samplePhysical(track, now);
            return;
        }
        const raw = clamp((now - track.start) / track.duration);
        if (track.kind === 'settling') {
            const strength = 1 - smooth(raw);
            this.present({ direction: [...track.presentation.direction], strength: track.presentation.strength * strength, lift: track.presentation.lift * strength, bank: track.presentation.bank * strength });
            if (this.track !== track)
                return;
            if (raw === 1)
                this.complete(track, track.finished ?? false);
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
        const secondDerivative = track.smooth && inFlight && raw < 1 && remaining > 1e-9 ? 6 * (1 - 2 * travelTime) / ((track.duration / 1000) ** 2 * remaining) : 0;
        this.acceleration = { x: point.x === unconstrained.x ? (track.to.x - track.from.x) * secondDerivative : 0, y: point.y === unconstrained.y ? (track.to.y - track.from.y) * secondDerivative : 0 };
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
    samplePhysical(track, now) {
        // Fixed integration ticks make the path independent of the display refresh rate.
        // A suspended tab advances at most 100 ms instead of teleporting on restoration.
        const elapsed = Math.max(0, Math.min(0.1, (now - track.last) / 1000));
        track.accumulator += elapsed;
        track.last = now;
        const dt = 1 / 240;
        let arrived = false;
        while (track.accumulator + 1e-10 >= dt) {
            track.accumulator = Math.max(0, track.accumulator - dt);
            const response = 0.06;
            const realDistance = Math.hypot(track.to.x - this.point.x, track.to.y - this.point.y);
            const realSpeed = Math.hypot(this.velocity.x, this.velocity.y);
            const residualAcceleration = Math.hypot(this.acceleration.x, this.acceleration.y);
            const restSpeed = Math.min(0.1, track.deceleration * dt);
            const restAcceleration = Math.min(1, track.acceleration * 0.01, track.deceleration * 0.01);
            if ((track.stopping || realDistance < 0.08) && realSpeed < restSpeed && residualAcceleration < restAcceleration) {
                if (!track.stopping)
                    this.point = { ...track.to };
                this.velocity = { x: 0, y: 0 };
                this.acceleration = { x: 0, y: 0 };
                arrived = true;
                break;
            }
            // For da/dt=(u-a)/tau, q=x+tau*v and w=v+tau*a obey q'=w, w'=u.
            // Plan in this look-ahead state to reserve the force ramp's stopping distance.
            // Physical position, velocity and acceleration retain continuity on retarget.
            const dx = track.to.x - (this.point.x + response * this.velocity.x);
            const dy = track.to.y - (this.point.y + response * this.velocity.y);
            const distance = Math.hypot(dx, dy);
            const virtualVX = this.velocity.x + response * this.acceleration.x;
            const virtualVY = this.velocity.y + response * this.acceleration.y;
            const speed = Math.hypot(virtualVX, virtualVY);
            // Arrival steering uses stopping distance v²/(2b), with a small safety margin.
            const desiredSpeed = track.stopping ? 0 : Math.min(track.maxSpeed, Math.sqrt(2 * track.deceleration * distance) * 0.9, distance / (2 * dt));
            const desiredX = distance > 1e-9 ? dx / distance * desiredSpeed : 0;
            const desiredY = distance > 1e-9 ? dy / distance * desiredSpeed : 0;
            const dvx = desiredX - virtualVX, dvy = desiredY - virtualVY, dv = Math.hypot(dvx, dvy);
            const projection = dvx * virtualVX + dvy * virtualVY;
            const braking = track.stopping || projection < -1e-8;
            const oldX = virtualVX, oldY = virtualVY;
            // Split at minimum speed: braking may remove momentum, but cannot buy
            // reverse acceleration. Consume the remaining time under acceleration,
            // otherwise a changing perpendicular target could stall every tick.
            const brakeFraction = braking && dv > 0 ? Math.min(1, Math.max(0, -projection / (dv * dv))) : 0;
            const brakeTime = braking ? Math.min(dt, dv * brakeFraction / track.deceleration) : 0;
            const brakeAmount = dv > 0 ? track.deceleration * brakeTime / dv : 0;
            const midX = oldX + dvx * brakeAmount, midY = oldY + dvy * brakeAmount;
            const remainingTime = dt - brakeTime;
            const remainingX = desiredX - midX, remainingY = desiredY - midY;
            const remainingDelta = Math.hypot(remainingX, remainingY);
            const accelerateAmount = remainingDelta > 0 ? Math.min(1, track.acceleration * remainingTime / remainingDelta) : 0;
            const endX = midX + remainingX * accelerateAmount;
            const endY = midY + remainingY * accelerateAmount;
            const integrate = (seconds, ux, uy) => {
                if (seconds <= 0)
                    return;
                const decay = Math.exp(-seconds / response), integral = response * (1 - decay);
                const ax = this.acceleration.x, ay = this.acceleration.y;
                this.point.x += this.velocity.x * seconds + ux * seconds ** 2 / 2 + (ax - ux) * response * (seconds - integral);
                this.point.y += this.velocity.y * seconds + uy * seconds ** 2 / 2 + (ay - uy) * response * (seconds - integral);
                this.velocity.x += ux * seconds + (ax - ux) * integral;
                this.velocity.y += uy * seconds + (ay - uy) * integral;
                this.acceleration.x = ux + (ax - ux) * decay;
                this.acceleration.y = uy + (ay - uy) * decay;
            };
            if (brakeTime > 0)
                integrate(brakeTime, (midX - oldX) / brakeTime, (midY - oldY) / brakeTime);
            if (remainingTime > 0)
                integrate(remainingTime, (endX - midX) / remainingTime, (endY - midY) / remainingTime);
            const proposed = { ...this.point };
            const constrained = this.host.constrain(proposed);
            // Bounds are inelastic walls: discard only the outward velocity component.
            if (constrained.x !== proposed.x) {
                this.velocity.x = 0;
                this.acceleration.x = 0;
            }
            if (constrained.y !== proposed.y) {
                this.velocity.y = 0;
                this.acceleration.y = 0;
            }
            this.point = constrained;
            this.phase = track.stopping ? 'braking' : braking ? 'landing' : speed < 30 ? 'takeoff' : 'flight';
        }
        this.host.render(this.position);
        if (this.track !== track)
            return;
        const speed = Math.hypot(this.velocity.x, this.velocity.y);
        this.progress = Math.max(this.progress, Math.min(0.999, 1 - Math.hypot(track.to.x - this.point.x, track.to.y - this.point.y) / track.initialDistance));
        const targetHeading = speed > 1 || (!Math.hypot(...this.presentation.direction) && speed > 1e-7) ? direction(this.velocity.x, this.velocity.y) : this.presentation.direction;
        const heading = turn(this.presentation.direction, targetHeading, 1 - Math.exp(-24 * elapsed));
        // Attitude is a damped presentation layer, not a force on the trajectory.
        // A speed/acceleration step must not turn into a one-frame head nod.
        const attitudeBlend = 1 - Math.exp(-12 * elapsed);
        const targetStrength = smooth(Math.min(1, speed / 160));
        const strength = this.presentation.strength + (targetStrength - this.presentation.strength) * attitudeBlend;
        // Banking changes sign under braking; it is derived from physical acceleration.
        const bank = Math.max(-0.12, Math.min(0.12, -this.acceleration.x / Math.max(track.acceleration, track.deceleration) * 0.12));
        if (!arrived) {
            if (track.natural)
                this.present({ direction: heading, strength, lift: 0.06 * strength, bank: this.presentation.bank + (bank - this.presentation.bank) * attitudeBlend });
            else if (track.fade) {
                const decay = 1 - smooth(clamp((now - track.fade.start) / track.fade.duration)), p = track.fade.presentation;
                this.present({ direction: [...p.direction], strength: p.strength * decay, lift: p.lift * decay, bank: p.bank * decay });
            }
            else
                this.present(neutral());
        }
        if (this.track !== track)
            return;
        if (arrived) {
            if (!track.stopping)
                this.progress = 1;
            // Keep cancellation completion ordered after presentation settles, as before.
            this.track = { kind: 'settling', start: now, duration: 180, presentation: copyPresentation(this.presentation), finished: !track.stopping, resolve: track.resolve, silent: track.silent };
            this.phase = 'settling';
            this.report();
        }
        else
            this.report();
    }
    tick = (now) => { this.frame = 0; this.sample(now); this.schedule(); };
}
