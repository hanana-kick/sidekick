import { validateMotionOptions } from '../core/motion.js';
import type { MotionOptions } from '../core/motion.js';

export type AvatarPlacement = 'inline' | 'viewport';
export type MovementBounds = 'viewport' | 'none';
export interface AvatarPosition { x: number; y: number }
export interface MoveOptions extends MotionOptions { travel?: 'natural' | 'none' }
export interface MoveResult { finished: boolean; position: AvatarPosition }
export interface MovementState {
  phase: 'idle' | 'takeoff' | 'flight' | 'landing' | 'settling';
  /** Elapsed fraction of the requested duration; held at the interruption point while settling. */
  progress: number;
  position: AvatarPosition;
  /** Velocity of the constrained CSS position, in CSS pixels per second. */
  velocity: AvatarPosition;
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
    if (typeof key !== 'string' || !['duration', 'easing', 'travel'].includes(key)) throw new TypeError(`unsupported movement option: ${String(key)}`);
    const descriptor = Object.getOwnPropertyDescriptor(options, key)!;
    if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) throw new TypeError(`movement option ${key} must be an ordinary data property`);
  }
  const timing = validateMotionOptions({ duration: options.duration, easing: options.easing });
  if (options.travel !== undefined && options.travel !== 'natural' && options.travel !== 'none') throw new TypeError('unsupported travel mode');
  return { ...timing, travel: options.travel ?? 'natural' };
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
  kind: 'settling'; start: number; duration: number; presentation: MovementPresentation;
  resolve: (result: MoveResult) => void;
}
type Track = TravelTrack | SettleTrack;

/** DOM translation has a separate clock from the renderer and never resizes its surface. */
export class AvatarMovement {
  private point: AvatarPosition = { x: 0, y: 0 };
  private velocity: AvatarPosition = { x: 0, y: 0 };
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
  get state(): MovementState { return { phase: this.phase, progress: this.progress, position: this.position, velocity: { ...this.velocity } }; }
  to(point: AvatarPosition, options: MoveOptions = {}): Promise<MoveResult> {
    const target = validatePosition(point), timing = validateMoveOptions(options);
    const revision = ++this.revision, now = this.host.now();
    this.sample(now);
    if (revision !== this.revision) return this.result(false);
    const previous = copyPresentation(this.presentation);
    // Superseding transfers presentation ownership to the new request instead of starting a separate landing.
    if (this.track) this.complete(this.track, false, false);
    const to = this.host.constrain(target), duration = this.host.immediate() ? 0 : timing.duration;
    if (!duration || (to.x === this.point.x && to.y === this.point.y)) {
      this.write(to);
      if (revision !== this.revision) return this.result(false);
      this.progress = 1;
      const result = { finished: true, position: this.position };
      this.reset(); this.report();
      return new Promise(resolve => this.notify(result, resolve));
    }
    return new Promise(resolve => {
      const heading = direction(to.x - this.point.x, to.y - this.point.y);
      this.track = {
        kind: 'travel', from: this.position, to, start: now, duration, smooth: timing.easing === 'smooth', natural: timing.travel === 'natural', intensity: Math.min(1, Math.hypot(to.x - this.point.x, to.y - this.point.y) / 100), fromTravel: 0,
        presentation: previous, headingFrom: previous.direction, heading, headingStart: now, turnDuration: Math.min(180, duration * 0.15), resolve,
      };
      this.progress = 0; this.velocity = { x: 0, y: 0 }; this.phase = this.track.natural ? 'takeoff' : 'flight';
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
  /** Freeze travel, then lower the presentation gently. Lifecycle callers may request an immediate reset. */
  cancel(immediate = false): void {
    const pending = this.track; if (!pending) return;
    const revision = ++this.revision;
    if (immediate || this.host.immediate()) { this.complete(pending, false); return; }
    this.sample(this.host.now());
    if (revision !== this.revision) return;
    const track = this.track; if (!track) return;
    if (track.kind === 'settling') return;
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
    this.write(this.host.constrain(this.point));
    if (revision !== this.revision) return;
    const track = this.track;
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
    if (track?.kind === 'travel') { this.write(this.host.constrain(track.to)); this.progress = 1; this.complete(track, true); }
    else if (track) this.complete(track, false);
    else { this.reset(); this.report(); }
  }
  private write(point: AvatarPosition): void { this.point = { ...point }; this.host.render(this.position); }
  private report(): void {
    if (this.reporting) return;
    this.reporting = true;
    try { this.host.progress?.(this.state); } finally { this.reporting = false; }
  }
  private present(value: MovementPresentation): void { this.presentation = copyPresentation(value); this.host.presentation?.(copyPresentation(value)); }
  private reset(): void { this.phase = 'idle'; this.velocity = { x: 0, y: 0 }; this.present(neutral()); }
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
    const raw = clamp((now - track.start) / track.duration);
    if (track.kind === 'settling') {
      const strength = 1 - smooth(raw);
      this.present({ direction: [...track.presentation.direction], strength: track.presentation.strength * strength, lift: track.presentation.lift * strength, bank: track.presentation.bank * strength });
      if (this.track !== track) return;
      if (raw === 1) this.complete(track, false); else this.report();
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
  private tick = (now: number): void => { this.frame = 0; this.sample(now); this.schedule(); };
}
