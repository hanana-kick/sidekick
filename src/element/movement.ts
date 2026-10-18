import { validateMotionOptions } from '../core/motion.js';
import type { MotionOptions } from '../core/motion.js';

export type AvatarPlacement = 'inline' | 'viewport';
export type MovementBounds = 'viewport' | 'none';
export interface AvatarPosition { x: number; y: number }
export interface MoveResult { finished: boolean; position: AvatarPosition }
export interface MovementHost {
  now(): number;
  immediate(): boolean;
  constrain(point: AvatarPosition): AvatarPosition;
  render(point: AvatarPosition): void;
  complete(result: MoveResult): void;
  requestFrame(callback: FrameRequestCallback): number;
  cancelFrame(id: number): void;
}
export function validatePosition(point: AvatarPosition): AvatarPosition {
  if (!point || typeof point !== 'object' || Array.isArray(point) || Object.keys(point).some(key => key !== 'x' && key !== 'y')) throw new TypeError('position requires x and y in CSS pixels');
  for (const value of [point.x, point.y]) if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 1e7) throw new RangeError('position must be finite CSS pixels within ±10000000');
  return { x: point.x, y: point.y };
}
/** DOM translation has a separate clock from the renderer and never resizes its surface. */
export class AvatarMovement {
  private point: AvatarPosition = { x: 0, y: 0 };
  private frame = 0;
  private track?: { from: AvatarPosition; to: AvatarPosition; start: number; duration: number; smooth: boolean; resolve: (result: MoveResult) => void };
  constructor(private readonly host: MovementHost) {}
  get position(): AvatarPosition { return { ...this.point }; }
  to(point: AvatarPosition, options: MotionOptions = {}): Promise<MoveResult> {
    const target = validatePosition(point), timing = validateMotionOptions(options);
    this.cancel();
    const to = this.host.constrain(target);
    const duration = this.host.immediate() ? 0 : timing.duration;
    if (!duration || (to.x === this.point.x && to.y === this.point.y)) {
      this.write(to);
      const result = { finished: true, position: this.position };
      queueMicrotask(() => this.host.complete(result)); return Promise.resolve(result);
    }
    return new Promise(resolve => {
      this.track = { from: this.position, to, start: this.host.now(), duration, smooth: timing.easing === 'smooth', resolve };
      this.frame = this.host.requestFrame(this.tick);
    });
  }
  by(delta: AvatarPosition, options: MotionOptions = {}): Promise<MoveResult> {
    const offset = validatePosition(delta); validateMotionOptions(options);
    this.sample(this.host.now());
    return this.to({ x: this.point.x + offset.x, y: this.point.y + offset.y }, options);
  }
  cancel(): void {
    if (!this.track) return;
    this.sample(this.host.now());
    if (!this.track) return;
    this.settle(false);
  }
  /** Clamp both current point and remaining target after viewport/element resizing. */
  resize(): void {
    this.sample(this.host.now());
    this.write(this.host.constrain(this.point));
    if (this.track) {
      const now = this.host.now();
      this.track.duration = Math.max(0, this.track.duration - (now - this.track.start));
      this.track.start = now; this.track.from = this.position; this.track.to = this.host.constrain(this.track.to);
      if (!this.track.duration) { this.write(this.track.to); this.settle(true); }
    }
  }
  finish(): void { if (this.track) { this.write(this.host.constrain(this.track.to)); this.settle(true); } }
  private write(point: AvatarPosition): void { this.point = { ...point }; this.host.render(this.position); }
  private settle(finished: boolean): void {
    const track = this.track; if (!track) return;
    this.track = undefined; this.host.cancelFrame(this.frame); this.frame = 0;
    const result = { finished, position: this.position }; queueMicrotask(() => this.host.complete(result)); track.resolve(result);
  }
  private sample(now: number): void {
    const track = this.track; if (!track) return;
    const raw = Math.max(0, Math.min(1, (now - track.start) / track.duration));
    const t = track.smooth ? raw * raw * (3 - 2 * raw) : raw;
    this.write(this.host.constrain({ x: track.from.x + (track.to.x - track.from.x) * t, y: track.from.y + (track.to.y - track.from.y) * t }));
    if (raw === 1) this.settle(true);
  }
  private tick = (now: number): void => { this.frame = 0; this.sample(now); if (this.track) this.frame = this.host.requestFrame(this.tick); };
}
