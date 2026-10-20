import { validateMoveOptions, validatePosition } from './movement.js';
import type { AvatarPosition, MoveOptions, MoveResult } from './movement.js';

export type PresenceEdge = 'left' | 'right' | 'top' | 'bottom';
export type PresenceState = 'visible' | 'hidden' | 'entering' | 'exiting';
export interface EnterOptions extends MoveOptions { from?: PresenceEdge }
export interface ExitOptions extends MoveOptions { to?: PresenceEdge }
export interface PresenceResult extends MoveResult { presence: PresenceState }
export interface PresenceGeometry { width: number; height: number; viewportWidth: number; viewportHeight: number; offsetX: number; offsetY: number }
export interface PresenceHost {
  assertViewport(): void;
  position(): AvatarPosition;
  geometry(): PresenceGeometry;
  constrain(point: AvatarPosition): AvatarPosition;
  move(point: AvatarPosition, options: MoveOptions): Promise<MoveResult>;
  stage(point: AvatarPosition): void;
  visibility(hidden: boolean): void;
  complete(kind: 'enter' | 'exit', result: PresenceResult): void;
}
interface Operation { kind: 'enter' | 'exit'; edge: PresenceEdge; point: AvatarPosition; options: MoveOptions; segment: number; resolve(result: PresenceResult): void }
const edges: readonly string[] = ['left', 'right', 'top', 'bottom'];
export function validatePresenceOptions(value: EnterOptions | ExitOptions, key: 'from' | 'to'): { edge: PresenceEdge; motion: MoveOptions } {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new TypeError('presence options must be a plain object');
  const motion: Record<string, unknown> = {};
  let edge: unknown = key === 'from' ? 'left' : 'right';
  for (const name of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, name)!;
    if (typeof name !== 'string' || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) throw new TypeError('presence options require ordinary data properties');
    if (name === key) edge = descriptor.value ?? edge;
    else motion[name] = descriptor.value;
  }
  if (!edges.includes(edge as string)) throw new TypeError(`${key} must be left, right, top or bottom`);
  validateMoveOptions(motion);
  return { edge: edge as PresenceEdge, motion };
}
/** Coordinates are layout-viewport CSS pixels, just like viewport moveTo. */
export function outsidePosition(edge: PresenceEdge, point: AvatarPosition, box: PresenceGeometry): AvatarPosition {
  const margin = 8;
  switch (edge) {
    case 'left': return { x: -box.width - box.offsetX - margin, y: point.y };
    case 'right': return { x: box.viewportWidth - box.offsetX + margin, y: point.y };
    case 'top': return { x: point.x, y: -box.height - box.offsetY - margin };
    case 'bottom': return { x: point.x, y: box.viewportHeight - box.offsetY + margin };
  }
}
/** Owns presence, not appearance/activity settings. Physical integration stays in AvatarMovement. */
export class AvatarPresence {
  private revision = 0;
  private recovery = false;
  private state: PresenceState = 'visible';
  private operation?: Operation;
  get current(): PresenceState { return this.state; }
  get destination(): AvatarPosition | undefined { return this.operation?.kind === 'enter' ? { ...this.operation.point } : undefined; }
  /** Visibility-only declarations retain their layout position. */
  setVisible(visible: boolean): void {
    const revision = ++this.revision; this.cancel();
    if (revision !== this.revision) return;
    this.state = visible ? 'visible' : 'hidden'; this.host.visibility(!visible);
  }
  get bypassBounds(): boolean { return !!this.operation || this.recovery || this.state === 'hidden'; }
  constructor(private readonly host: PresenceHost) {}
  enter(point: AvatarPosition, input: EnterOptions = {}, start?: AvatarPosition, continueFlight = false): Promise<PresenceResult> {
    const target = validatePosition(point), parsed = validatePresenceOptions(input, 'from'); this.host.assertViewport();
    const revision = ++this.revision;
    const interrupted = !!this.operation || continueFlight;
    this.cancel();
    if (revision !== this.revision) return Promise.resolve({ finished: false, position: this.host.position(), presence: this.state });
    const destination = this.host.constrain(target);
    return new Promise(resolve => {
      const operation: Operation = { kind: 'enter', edge: parsed.edge, point: destination, options: parsed.motion, segment: 0, resolve };
      this.operation = operation; this.state = 'entering';
      // A fresh appearance starts outside. Retargeting an active presence flight keeps its inertia.
      if (!interrupted) {
        this.host.visibility(true);
        this.host.stage(start ?? outsidePosition(parsed.edge, destination, this.host.geometry()));
        if (this.operation !== operation) return;
      }
      this.host.visibility(false);
      if (this.operation === operation) this.run(operation);
    });
  }
  exit(input: ExitOptions = {}): Promise<PresenceResult> {
    const parsed = validatePresenceOptions(input, 'to'); this.host.assertViewport();
    if (this.state === 'hidden') { const result: PresenceResult = { finished: true, position: this.host.position(), presence: 'hidden' }; this.host.complete('exit', result); return Promise.resolve(result); }
    const revision = ++this.revision; this.cancel();
    if (revision !== this.revision) return Promise.resolve({ finished: false, position: this.host.position(), presence: this.state });
    return new Promise(resolve => {
      const operation: Operation = { kind: 'exit', edge: parsed.edge, point: this.host.position(), options: parsed.motion, segment: 0, resolve };
      this.operation = operation; this.state = 'exiting'; this.run(operation);
    });
  }
  /** Superseding normal moves reveal the bot without restarting its activity or resetting momentum. */
  reveal(): number { const revision = ++this.revision; this.cancel(); if (revision === this.revision) { this.recovery = this.recovery || this.state === 'hidden'; this.state = 'visible'; this.host.visibility(false); } return revision; }
  owns(revision: number): boolean { return revision === this.revision; }
  recovered(revision: number): void { if (this.owns(revision)) this.recovery = false; }
  interrupt(): number { const revision = ++this.revision; this.cancel(); return revision; }
  cancel(): void {
    const operation = this.operation;
    if (!operation) return;
    this.operation = undefined; this.recovery = true; this.state = 'visible';
    this.host.visibility(false);
    this.finish(operation, false);
  }
  retarget(point: AvatarPosition): void {
    const operation = this.operation;
    if (!operation || operation.kind !== 'enter' || (Math.abs(operation.point.x - point.x) < .01 && Math.abs(operation.point.y - point.y) < .01)) return;
    operation.point = point; this.run(operation);
  }
  resize(): void {
    const operation = this.operation;
    if (!operation) return;
    if (operation.kind === 'enter') operation.point = this.host.constrain(operation.point);
    this.run(operation);
  }
  private run(operation: Operation): void {
    const segment = ++operation.segment;
    const target = operation.kind === 'exit' ? outsidePosition(operation.edge, this.host.position(), this.host.geometry()) : operation.point;
    void this.host.move(target, operation.options).then(result => {
      if (this.operation !== operation || segment !== operation.segment) return;
      this.operation = undefined; this.recovery = !result.finished;
      this.state = result.finished && operation.kind === 'exit' ? 'hidden' : 'visible';
      this.host.visibility(this.state === 'hidden');
      this.finish(operation, result.finished);
    });
  }
  private finish(operation: Operation, finished: boolean): void {
    const result = { finished, position: this.host.position(), presence: this.state };
    operation.resolve(result); this.host.complete(operation.kind, result);
  }
}
