import { validateMotionOptions } from '../core/motion.js';
import type { MotionOptions } from '../core/motion.js';

export type AvatarPlacement = 'inline' | 'viewport';
export type MovementBounds = 'viewport' | 'none';
export interface AvatarPosition { x: number; y: number }
export interface MoveOptions extends MotionOptions { travel?: 'natural' | 'none'; maxSpeed?: number; acceleration?: number; deceleration?: number }
export interface MoveResult { finished: boolean; position: AvatarPosition }
export interface MovementState {
  phase: 'idle' | 'takeoff' | 'flight' | 'landing' | 'braking' | 'settling';
  /** Monotonic distance progress in natural mode; elapsed duration fraction for plain tweens. */
  progress: number;
  position: AvatarPosition;
  /** Velocity of the constrained CSS position, in CSS pixels per second. */
  velocity: AvatarPosition;
  /** Actual integrated CSS-pixel acceleration, per second squared. */
  acceleration: AvatarPosition;
  speed: number;
}
export interface MovementPresentation {
  /** Unit screen-space heading (positive y is down), or [0, 0] while idle. */
  direction: [number, number];
  strength: number;
  /** Renderer-space lift, bounded to 0.06. */
  lift: number;
  /** Signed renderer bank, bounded to ±0.12 radians; negative leans right. */
  bank: number;
}
export interface MovementHost {
  now(): number;
  immediate(): boolean;
  constrain(point: AvatarPosition): AvatarPosition;
  render(point: AvatarPosition): void;
  complete(result: MoveResult): void | Promise<void>;
  progress?(state: MovementState): void;
  presentation?(presentation: MovementPresentation): void;
  requestFrame(callback: FrameRequestCallback): number;
  cancelFrame(id: number): void;
}
export function validatePosition(point: AvatarPosition): AvatarPosition {
  if (!point || typeof point !== 'object' || Array.isArray(point) || Object.keys(point).some(key => key !== 'x' && key !== 'y')) throw new TypeError('position requires x and y in CSS pixels');
  for (const value of [point.x, point.y]) if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 1e7) throw new RangeError('position must be finite CSS pixels within ±10000000');
  return { x: point.x, y: point.y };
}
/** Keep movement options as strict as pose-motion options, without passing travel to that validator. */
export function validateMoveOptions(options: MoveOptions = {}): Required<MoveOptions> {
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('options must be a plain object');
  const prototype: unknown = Object.getPrototypeOf(options);
  if (prototype !== Object.prototype && prototype !== null) throw new TypeError('options must be a plain object');
  for (const key of Reflect.ownKeys(options)) {
    if (typeof key !== 'string' || !['duration', 'easing', 'travel', 'maxSpeed', 'acceleration', 'deceleration'].includes(key)) throw new TypeError(`unsupported movement option: ${String(key)}`);
    const descriptor = Object.getOwnPropertyDescriptor(options, key)!;
    if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) throw new TypeError(`movement option ${key} must be an ordinary data property`);
  }
  const timing = validateMotionOptions({ duration: options.duration, easing: options.easing });
  if (options.travel !== undefined && options.travel !== 'natural' && options.travel !== 'none') throw new TypeError('unsupported travel mode');
  for (const key of ['maxSpeed', 'acceleration', 'deceleration'] as const) {
    if (options[key] !== undefined && (typeof options[key] !== 'number' || !Number.isFinite(options[key]) || options[key]! < 1 || options[key]! > 100000)) throw new RangeError(key + ' must be between 1 and 100000');
  }
  return { ...timing, travel: options.travel ?? 'natural', maxSpeed: options.maxSpeed ?? 0, acceleration: options.acceleration ?? 1800, deceleration: options.deceleration ?? 2200 };
}

const clamp = (value: number): number => Math.max(0, Math.min(1, value));
const smooth = (value: number): number => value * value * (3 - 2 * value);
const neutral = (): MovementPresentation => ({ direction: [0, 0], strength: 0, lift: 0, bank: 0 });
const copyPresentation = (value: MovementPresentation): MovementPresentation => ({ ...value, direction: [...value.direction] });
function direction(x: number, y: number): [number, number] {
  const length = Math.hypot(x, y);
  return length > 1e-9 ? [x / length, y / length] : [0, 0];
}
/** Interpolate angles instead of vectors so a reversal never collapses through a zero heading. */
function turn(from: [number, number], to: [number, number], progress: number): [number, number] {
  if (!Math.hypot(...to)) return [...from];
  if (!Math.hypot(...from)) return [...to];
  if (progress === 0) return [...from];
  if (progress === 1) return [...to];
  const start = Math.atan2(from[1], from[0]);
  const difference = Math.atan2(from[0] * to[1] - from[1] * to[0], from[0] * to[0] + from[1] * to[1]);
  const angle = start + difference * progress;
  return [Math.cos(angle), Math.sin(angle)];
}
interface TravelTrack {
  kind: 'travel'; from: AvatarPosition; to: AvatarPosition; start: number; duration: number;
  smooth: boolean; natural: boolean; intensity: number; fromTravel: number; presentation: MovementPresentation;
  headingFrom: [number, number]; heading: [number, number]; headingStart: number; turnDuration: number;
  resolve: (result: MoveResult) => void;
}
interface SettleTrack {
  kind: 'settling'; start: number; duration: number; presentation: MovementPresentation; finished?: boolean;
  resolve: (result: MoveResult) => void;
}
interface PhysicalTrack {
  kind: 'physical'; to: AvatarPosition; start: number; last: number; accumulator: number;
  maxSpeed: number; acceleration: number; deceleration: number; initialDistance: number;
  stopping: boolean; resolve: (result: MoveResult) => void;
}
type Track = TravelTrack | SettleTrack | PhysicalTrack;

/** DOM translation has a separate clock from the renderer and never resizes its surface. */
export class AvatarMovement {
  private point: AvatarPosition = { x: 0, y: 0 };
  private velocity: AvatarPosition = { x: 0, y: 0 };
  private acceleration: AvatarPosition = { x: 0, y: 0 };
  private phase: MovementState['phase'] = 'idle';
  private progress = 0;
  private presentation = neutral();
  private frame = 0;
  private revision = 0;
  private sampling = false;
  private reporting = false;
  private track?: Track;
  constructor(private readonly host: MovementHost) {}
  get position(): AvatarPosition { return { ...this.point }; }
  get state(): MovementState { return { phase: this.phase, progress: this.progress, position: this.position, velocity: { ...this.velocity }, acceleration: { ...this.acceleration }, speed: Math.hypot(this.velocity.x, this.velocity.y) }; }
  to(point: AvatarPosition, options: MoveOptions = {}): Promise<MoveResult> {
    const target = validatePosition(point), timing = validateMoveOptions(options);
    const revision = ++this.revision, now = this.host.now();
    this.sample(now);
    if (revision !== this.revision) return this.result(false);
    const previous = copyPresentation(this.presentation);
    // Superseding transfers presentation ownership to the new request instead of starting a separate landing.
    if (this.track) this.complete(this.track, false, false);
    const to = this.host.constrain(target), duration = this.host.immediate() ? 0 : timing.duration;
    if (!duration || (to.x === this.point.x && to.y === this.point.y && Math.hypot(this.velocity.x, this.velocity.y) < 0.01)) {
      this.write(to);
      if (revision !== this.revision) return this.result(false);
      this.progress = 1;
      const result = { finished: true, position: this.position };
      this.reset(); this.report();
      return new Promise(resolve => this.notify(result, resolve));
    }
    if (timing.travel === 'natural') {
      return new Promise(resolve => {
        const distance = Math.hypot(to.x - this.point.x, to.y - this.point.y);
        this.track = { kind: 'physical', to, start: now, last: now, accumulator: 0,
          maxSpeed: timing.maxSpeed || Math.max(80, Math.min(900, distance / Math.max(0.1, duration / 1000))),
          acceleration: timing.acceleration, deceleration: timing.deceleration, initialDistance: Math.max(distance, 1), stopping: false, resolve };
        this.progress = 0; this.phase = Math.hypot(this.velocity.x, this.velocity.y) > 0.1 ? 'flight' : 'takeoff';
        this.report(); this.schedule();
      });
    }
    return new Promise(resolve => {
      const heading = direction(to.x - this.point.x, to.y - this.point.y);
      this.track = {
        kind: 'travel', from: this.position, to, start: now, duration, smooth: timing.easing === 'smooth', natural: timing.travel === 'natural', intensity: Math.min(1, Math.hypot(to.x - this.point.x, to.y - this.point.y) / 100), fromTravel: 0,
        presentation: previous, headingFrom: previous.direction, heading, headingStart: now, turnDuration: Math.min(180, duration * 0.15), resolve,
      };
      this.progress = 0; this.velocity = { x: 0, y: 0 }; this.acceleration = { x: 0, y: 0 }; this.phase = this.track.natural ? 'takeoff' : 'flight';
      this.report(); this.schedule();
    });
  }
  by(delta: AvatarPosition, options: MoveOptions = {}): Promise<MoveResult> {
    const offset = validatePosition(delta); validateMoveOptions(options);
    const revision = ++this.revision;
    this.sample(this.host.now());
    if (revision !== this.revision) return this.result(false);
    return this.to({ x: this.point.x + offset.x, y: this.point.y + offset.y }, options);
  }
  /** Brake natural travel with inertia, then settle. Plain tweens freeze; lifecycle teardown resets immediately. */
  cancel(immediate = false): void {
    const pending = this.track; if (!pending) return;
    const revision = ++this.revision;
    if (immediate || this.host.immediate()) { this.complete(pending, false); return; }
    this.sample(this.host.now());
    if (revision !== this.revision) return;
    const track = this.track; if (!track) return;
    if (track.kind === 'settling') { track.finished = false; return; }
    if (track.kind === 'physical') { track.stopping = true; this.phase = 'braking'; this.report(); this.schedule(); return; }
    if (!this.presentation.strength && !this.presentation.lift && !this.presentation.bank) { this.complete(track, false); return; }
    this.stopFrame();
    this.track = { kind: 'settling', start: this.host.now(), duration: 180, presentation: copyPresentation(this.presentation), resolve: track.resolve };
    this.velocity = { x: 0, y: 0 }; this.phase = 'settling'; this.report(); this.schedule();
  }
  /** Disconnect must not leave a detached element scheduling a presentation-only landing. */
  disconnect(): void { this.cancel(true); }
  /** Clamp both current point and remaining target after viewport/element resizing, without restarting the clock. */
  resize(): void {
    const revision = ++this.revision, now = this.host.now(); this.sample(now);
    if (revision !== this.revision) return;
    const beforeClamp = this.position;
    this.write(this.host.constrain(this.point));
    if (revision !== this.revision) return;
    if (this.point.x !== beforeClamp.x) { this.velocity.x = 0; this.acceleration.x = 0; }
    if (this.point.y !== beforeClamp.y) { this.velocity.y = 0; this.acceleration.y = 0; }
    if (revision !== this.revision) return;
    const track = this.track;
    if (track?.kind === 'physical') { track.to = this.host.constrain(track.to); this.report(); return; }
    if (track?.kind === 'travel') {
      track.fromTravel = this.travelFraction(track, clamp((now - track.start) / track.duration));
      track.from = this.position; track.to = this.host.constrain(track.to);
      track.headingFrom = [...this.presentation.direction]; track.heading = direction(track.to.x - track.from.x, track.to.y - track.from.y);
      track.headingStart = now; track.turnDuration = Math.min(120, Math.max(0, track.start + track.duration - now));
    }
    this.velocity = { x: 0, y: 0 }; this.report();
  }
  /** Reduced motion snaps to the target; an already cancelled request remains cancelled. */
  finish(): void { this.revision++; this.finishCurrent(); }
  private finishCurrent(): void {
    const track = this.track;
    if (track?.kind === 'physical' && !track.stopping) { this.write(this.host.constrain(track.to)); this.progress = 1; this.complete(track, true); }
    else if (track?.kind === 'travel') { this.write(this.host.constrain(track.to)); this.progress = 1; this.complete(track, true); }
    else if (track) this.complete(track, track.kind === 'settling' ? track.finished ?? false : false);
    else { this.reset(); this.report(); }
  }
  private write(point: AvatarPosition): void { this.point = { ...point }; this.host.render(this.position); }
  private report(): void {
    if (this.reporting) return;
    this.reporting = true;
    try { this.host.progress?.(this.state); } finally { this.reporting = false; }
  }
  private present(value: MovementPresentation): void { this.presentation = copyPresentation(value); this.host.presentation?.(copyPresentation(value)); }
  private reset(): void { this.phase = 'idle'; this.velocity = { x: 0, y: 0 }; this.acceleration = { x: 0, y: 0 }; this.present(neutral()); }
  private stopFrame(): void { if (this.frame) this.host.cancelFrame(this.frame); this.frame = 0; }
  private schedule(): void { if (this.track && !this.frame) this.frame = this.host.requestFrame(this.tick); }
  private complete(track: Track, finished: boolean, reset = true): void {
    if (this.track !== track) return;
    this.track = undefined; this.stopFrame();
    const result = { finished, position: this.position };
    if (reset) { this.reset(); this.report(); }
    this.notify(result, track.resolve);
  }
  private result(finished: boolean): Promise<MoveResult> {
    const result = { finished, position: this.position };
    return new Promise(resolve => this.notify(result, resolve));
  }
  /** A host may acknowledge an ordered worker render before completion becomes observable. */
  private notify(result: MoveResult, resolve: (result: MoveResult) => void): void {
    queueMicrotask(() => {
      try {
        const completion = this.host.complete(result);
        if (completion) void Promise.resolve(completion).then(() => resolve(result), () => resolve(result));
        else resolve(result);
      } catch { resolve(result); }
    });
  }
  private travelFraction(track: TravelTrack, progress: number): number {
    const time = track.natural ? progress <= 0.15 ? 0 : progress >= 0.85 ? 1 : (progress - 0.15) / 0.7 : progress;
    return track.smooth ? smooth(time) : time;
  }
  private sample(now: number): void {
    // Public progress callbacks may synchronously retarget, cancel, or resize the movement.
    if (this.sampling) return;
    this.sampling = true;
    try { this.sampleTrack(now); } finally { this.sampling = false; }
  }
  private sampleTrack(now: number): void {
    const track = this.track; if (!track) return;
    if (this.host.immediate()) { this.finishCurrent(); return; }
    if (track.kind === 'physical') { this.samplePhysical(track, now); return; }
    const raw = clamp((now - track.start) / track.duration);
    if (track.kind === 'settling') {
      const strength = 1 - smooth(raw);
      this.present({ direction: [...track.presentation.direction], strength: track.presentation.strength * strength, lift: track.presentation.lift * strength, bank: track.presentation.bank * strength });
      if (this.track !== track) return;
      if (raw === 1) this.complete(track, track.finished ?? false); else this.report();
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
    if (this.track !== track) return;
    if (raw === 1) { this.complete(track, true); return; }
    if (track.natural) {
      const turnProgress = track.turnDuration ? smooth(clamp((now - track.headingStart) / track.turnDuration)) : 1;
      const heading = turn(track.headingFrom, track.heading, turnProgress);
      const takeoff = smooth(clamp(raw / 0.15)), landing = 1 - smooth(clamp((raw - 0.85) / 0.15));
      const strength = (track.presentation.strength + (track.intensity - track.presentation.strength) * takeoff) * landing;
      const lift = (track.presentation.lift + (0.06 * track.intensity - track.presentation.lift) * takeoff) * landing;
      const bank = (track.presentation.bank + (-heading[0] * 0.12 * track.intensity - track.presentation.bank) * takeoff) * landing;
      this.present({ direction: heading, strength, lift, bank });
    } else {
      // An explicit plain move can interrupt flight without popping a previous airborne pose away.
      const decay = 1 - smooth(clamp((now - track.start) / Math.min(180, track.duration)));
      this.present({ direction: [...track.presentation.direction], strength: track.presentation.strength * decay, lift: track.presentation.lift * decay, bank: track.presentation.bank * decay });
    }
    if (this.track === track) this.report();
  }
  private samplePhysical(track: PhysicalTrack, now: number): void {
    // Fixed integration ticks make the path independent of the display refresh rate.
    // A suspended tab advances at most 100 ms instead of teleporting on restoration.
    const elapsed = Math.max(0, Math.min(0.1, (now - track.last) / 1000));
    track.accumulator += elapsed; track.last = now;
    const dt = 1 / 240;
    let arrived = false;
    while (track.accumulator + 1e-10 >= dt) {
      track.accumulator = Math.max(0, track.accumulator - dt);
      const dx = track.to.x - this.point.x, dy = track.to.y - this.point.y;
      const distance = Math.hypot(dx, dy), speed = Math.hypot(this.velocity.x, this.velocity.y);
      if ((!track.stopping && distance < 0.08 && speed < Math.min(4, track.deceleration * dt)) || (track.stopping && speed < 1e-7)) {
        if (!track.stopping) this.point = { ...track.to };
        this.velocity = { x: 0, y: 0 }; this.acceleration = { x: 0, y: 0 }; arrived = true; break;
      }
      // Arrival steering uses stopping distance v²/(2b), with a small safety margin.
      const desiredSpeed = track.stopping ? 0 : Math.min(track.maxSpeed, Math.sqrt(2 * track.deceleration * distance) * 0.9, distance / (2 * dt));
      const desiredX = distance > 1e-9 ? dx / distance * desiredSpeed : 0;
      const desiredY = distance > 1e-9 ? dy / distance * desiredSpeed : 0;
      const dvx = desiredX - this.velocity.x, dvy = desiredY - this.velocity.y, dv = Math.hypot(dvx, dvy);
      const projection = dvx * this.velocity.x + dvy * this.velocity.y;
      const braking = track.stopping || projection < -1e-8;
      const oldX = this.velocity.x, oldY = this.velocity.y;
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
      this.velocity.x = midX + remainingX * accelerateAmount;
      this.velocity.y = midY + remainingY * accelerateAmount;
      this.acceleration.x = (this.velocity.x - oldX) / dt; this.acceleration.y = (this.velocity.y - oldY) / dt;
      const proposed = {
        x: this.point.x + (oldX + midX) * brakeTime / 2 + (midX + this.velocity.x) * remainingTime / 2,
        y: this.point.y + (oldY + midY) * brakeTime / 2 + (midY + this.velocity.y) * remainingTime / 2,
      };
      const constrained = this.host.constrain(proposed);
      // Bounds are inelastic walls: discard only the outward velocity component.
      if (constrained.x !== proposed.x) { this.velocity.x = 0; this.acceleration.x = 0; }
      if (constrained.y !== proposed.y) { this.velocity.y = 0; this.acceleration.y = 0; }
      this.point = constrained;
      this.phase = track.stopping ? 'braking' : braking ? 'landing' : speed < 30 ? 'takeoff' : 'flight';
    }
    this.host.render(this.position);
    if (this.track !== track) return;
    const speed = Math.hypot(this.velocity.x, this.velocity.y);
    this.progress = Math.max(this.progress, Math.min(0.999, 1 - Math.hypot(track.to.x - this.point.x, track.to.y - this.point.y) / track.initialDistance));
    const targetHeading = speed > 1 ? direction(this.velocity.x, this.velocity.y) : this.presentation.direction;
    const heading = turn(this.presentation.direction, targetHeading, 1 - Math.exp(-24 * elapsed));
    const strength = Math.min(1, speed / 100);
    // Banking changes sign under braking; it is derived from physical acceleration.
    const bank = Math.max(-0.12, Math.min(0.12, -this.acceleration.x / Math.max(track.acceleration, track.deceleration) * 0.12));
    if (!arrived) this.present({ direction: heading, strength, lift: 0.06 * strength, bank });
    if (this.track !== track) return;
    if (arrived) {
      if (!track.stopping) this.progress = 1;
      // Keep cancellation completion ordered after presentation settles, as before.
      this.track = { kind: 'settling', start: now, duration: 180, presentation: copyPresentation(this.presentation), finished: !track.stopping, resolve: track.resolve };
      this.phase = 'settling'; this.report();
    } else this.report();
  }
  private tick = (now: number): void => { this.frame = 0; this.sample(now); this.schedule(); };
}
