import { ACTIVITIES, finite } from '../core/design.js';
import type { Activity } from '../core/design.js';
import { bodyOrientationPreset, createBodyOrientation } from '../core/body-orientation.js';
import type { BodyOrientation, BodyOrientationPreset } from '../core/body-orientation.js';
import { parseEmotion, validateEmotionOptions } from '../core/emotion.js';
import type { Emotion, EmotionResult } from '../core/emotion.js';
import { parseTrackingMode } from '../core/tracking.js';
import type { TrackingMode } from '../core/tracking.js';
import { validateBehavior } from './behavior.js';
import type { BotBehavior, BehaviorResult } from './behavior.js';
import { validateEntrance } from './entrance.js';
import type { Entrance } from './entrance.js';
import { validatePositioning } from './positioning.js';
import type { Positioning } from './positioning.js';
import { validatePresenceOptions } from './presence.js';
import type { ExitOptions } from './presence.js';
import { validateMoveOptions } from './movement.js';
import type { MoveResult } from './movement.js';

export interface SidekickPresence { visible: boolean; entrance?: Entrance; exit?: ExitOptions }
export type SidekickTaskStatus = 'pending' | 'success' | 'error' | 'cancelled';
export type SidekickTerminalStatus = Exclude<SidekickTaskStatus, 'pending'>;
export interface SidekickReaction { emotion: Emotion; duration?: number; intensity?: number }
/** The application owns status. Completion of a behavior never changes it. */
export interface SidekickTask { id: string | number; status: SidekickTaskStatus; behavior?: BotBehavior; reaction?: SidekickReaction }
export interface SidekickRest {
  activity?: Activity;
  trackingMode?: TrackingMode;
  gaze?: { x: number; y: number } | { target: Element | string };
  bodyOrientation?: BodyOrientationPreset | Partial<BodyOrientation>;
  emotion?: Emotion;
  emotionIntensity?: number;
  /** Rest behaviors cannot acquire an element target or take ownership of home positioning. */
  behavior?: Extract<BotBehavior, { type: 'idle' | 'celebrate' | 'error' }>;
}
export interface SidekickHome { positioning: Positioning; rest?: SidekickRest; returnOn?: readonly SidekickTerminalStatus[] }
export interface SidekickLifecycleDeclaration { presence?: SidekickPresence | null; task?: SidekickTask | null; home?: SidekickHome | null }
export type SidekickLifecyclePhase = 'idle' | 'hidden' | 'entering' | 'working' | 'pending' | 'reacting' | 'returning' | 'resting' | 'settled' | 'suspended' | 'error';
export interface SidekickLifecycleState {
  readonly phase: SidekickLifecyclePhase;
  readonly taskId: string | number | null;
  readonly taskStatus: SidekickTaskStatus | null;
  readonly reason?: string;
}
export interface SidekickLifecycleError { phase: SidekickLifecyclePhase; taskId: string | number | null; message: string }
export interface LifecycleHost {
  document: Document;
  connected(): boolean;
  /** Cancel only owned operations; restore the latest authored baseline. Check current after callbacks. */
  cancel(reason: string, current: () => boolean): void;
  presence(value: SidekickPresence, current: () => boolean): void | Promise<unknown>;
  perform(value: BotBehavior, current: () => boolean): Promise<BehaviorResult>;
  reactTo(value: SidekickReaction, current: () => boolean): Promise<EmotionResult>;
  position(value: Positioning, current: () => boolean): void | Promise<MoveResult | void>;
  /** Apply a temporary layer. Its non-targeted behavior must retain home positioning. */
  rest(value: SidekickRest | null, current: () => boolean): void;
  change(state: SidekickLifecycleState): void;
  error(error: SidekickLifecycleError): void;
}
const statuses = ['pending', 'success', 'error', 'cancelled'] as const;
const terminalStatuses = ['success', 'error', 'cancelled'] as const;
const defaultReturns: readonly SidekickTerminalStatus[] = ['success', 'cancelled'];

function ordinary(value: unknown, keys: readonly string[], label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new TypeError(`${label} must be a plain object`);
  for (const key of Reflect.ownKeys(value)) {
    const field = Object.getOwnPropertyDescriptor(value, key)!;
    if (typeof key !== 'string' || !keys.includes(key) || !field.enumerable || !Object.hasOwn(field, 'value')) throw new TypeError(`Unsupported ${label} field: ${String(key)}`);
  }
  return value as Record<string, unknown>;
}
/** Only validated records/arrays are recursively copied; DOM Elements retain their identity. */
function copy<T>(value: T, freeze = false): T {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) { const result = value.map(item => copy(item, freeze)); return (freeze ? Object.freeze(result) : result) as T; }
  if (![Object.prototype, null].includes(Object.getPrototypeOf(value))) return value;
  const result = Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copy(item, freeze)]));
  return (freeze ? Object.freeze(result) : result) as T;
}
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((item, index) => same(item, b[index]));
  if (![Object.prototype, null].includes(Object.getPrototypeOf(a)) || ![Object.prototype, null].includes(Object.getPrototypeOf(b))) return false;
  const ak = Object.keys(a), bk = Object.keys(b);
  return ak.length === bk.length && ak.every(key => Object.hasOwn(b, key) && same((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
}
function elementTarget(value: unknown, document: Document, label: string): void {
  if (typeof value === 'string') { if (!value.trim()) throw new TypeError(`${label} requires a nonempty selector`); document.querySelector(value); }
  else if (!document.defaultView || !(value instanceof document.defaultView.Element) || value.ownerDocument !== document) throw new TypeError(`${label} must be an Element in the same document`);
}
function normalizeBehavior(value: unknown, document: Document): BotBehavior {
  const behavior = validateBehavior(value, document);
  if (behavior.type === 'review') return { ...behavior, side: behavior.side ?? 'right', gap: behavior.gap ?? 16, timeout: behavior.timeout ?? 5000, dwell: behavior.dwell ?? 1000 };
  if ('target' in behavior) return { ...behavior, side: behavior.side ?? 'right', gap: behavior.gap ?? 16, timeout: behavior.timeout ?? 5000 };
  if (behavior.type === 'celebrate' || behavior.type === 'error') return { ...behavior, duration: behavior.duration ?? (behavior.type === 'celebrate' ? 1600 : 1800) };
  return behavior;
}
export function validateSidekickPresence(value: unknown, document: Document): SidekickPresence {
  const input = ordinary(value, ['visible', 'entrance', 'exit'], 'presence');
  if (typeof input.visible !== 'boolean') throw new TypeError('presence.visible must be boolean');
  const result: SidekickPresence = { visible: input.visible };
  if (input.entrance !== undefined) {
    const entrance = ordinary(input.entrance, ['source', 'edge', 'at', 'inset', 'target', 'direction', 'gap'], 'entrance');
    if (entrance.source === 'element') elementTarget(entrance.target, document, 'entrance target');
    result.entrance = validateEntrance(entrance);
  }
  if (input.exit !== undefined) {
    const parsed = validatePresenceOptions(input.exit as ExitOptions, 'to');
    result.exit = { to: parsed.edge, ...validateMoveOptions(parsed.motion) };
  }
  return copy(result, true);
}
export function validateSidekickTask(value: unknown, document: Document): SidekickTask {
  const input = ordinary(value, ['id', 'status', 'behavior', 'reaction'], 'task');
  if (!(typeof input.id === 'string' && input.id.trim()) && !(typeof input.id === 'number' && Number.isFinite(input.id))) throw new TypeError('task.id must be a nonempty string or finite number');
  if (!statuses.includes(input.status as SidekickTaskStatus)) throw new TypeError('task.status must be pending, success, error, or cancelled');
  const result: SidekickTask = { id: input.id as string | number, status: input.status as SidekickTaskStatus };
  if (input.behavior !== undefined) result.behavior = normalizeBehavior(input.behavior, document);
  if (input.reaction !== undefined) {
    const reaction = ordinary(input.reaction, ['emotion', 'duration', 'intensity'], 'task reaction');
    const options = validateEmotionOptions({ duration: reaction.duration === undefined ? 1000 : reaction.duration, intensity: reaction.intensity }, true);
    result.reaction = { emotion: parseEmotion(reaction.emotion), ...options };
  }
  return copy(result, true);
}
export function validateSidekickHome(value: unknown, document: Document): SidekickHome {
  const input = ordinary(value, ['positioning', 'rest', 'returnOn'], 'home');
  const result: SidekickHome = { positioning: validatePositioning(input.positioning, document) };
  if (input.rest !== undefined) {
    const rest = ordinary(input.rest, ['activity', 'trackingMode', 'gaze', 'bodyOrientation', 'emotion', 'emotionIntensity', 'behavior'], 'home rest');
    const validated: SidekickRest = {};
    if (rest.activity !== undefined) { if (!ACTIVITIES.includes(rest.activity as Activity)) throw new TypeError('Invalid home rest activity'); validated.activity = rest.activity as Activity; }
    if (rest.trackingMode !== undefined) validated.trackingMode = parseTrackingMode(rest.trackingMode);
    if (rest.gaze !== undefined) {
      const gaze = ordinary(rest.gaze, ['x', 'y', 'target'], 'rest gaze');
      if (Object.hasOwn(gaze, 'target')) {
        ordinary(gaze, ['target'], 'rest target gaze'); elementTarget(gaze.target, document, 'rest gaze target');
        validated.gaze = { target: gaze.target as Element | string };
      } else validated.gaze = { x: finite(gaze.x, -1, 1, 'gaze.x'), y: finite(gaze.y, -1, 1, 'gaze.y') };
    }
    if (rest.bodyOrientation !== undefined) {
      if (typeof rest.bodyOrientation === 'string') { bodyOrientationPreset(rest.bodyOrientation as BodyOrientationPreset); validated.bodyOrientation = rest.bodyOrientation as BodyOrientationPreset; }
      else { const orientation = ordinary(rest.bodyOrientation, ['yaw', 'pitch', 'roll'], 'rest bodyOrientation'); createBodyOrientation(orientation); validated.bodyOrientation = { ...orientation }; }
    }
    if (rest.emotion !== undefined) validated.emotion = parseEmotion(rest.emotion);
    if (rest.emotionIntensity !== undefined) validated.emotionIntensity = finite(rest.emotionIntensity, 0, 1, 'rest emotionIntensity');
    if (rest.behavior !== undefined) {
      const behavior = normalizeBehavior(rest.behavior, document);
      if (behavior.type !== 'idle' && behavior.type !== 'celebrate' && behavior.type !== 'error') throw new TypeError('home rest behavior must be idle, celebrate, or error');
      validated.behavior = behavior;
    }
    result.rest = validated;
  }
  if (input.returnOn !== undefined) {
    const values = input.returnOn;
    if (!Array.isArray(values) || Object.getPrototypeOf(values) !== Array.prototype || values.length > 10000) throw new TypeError('home.returnOn must be an ordinary array of terminal task statuses');
    for (const key of Reflect.ownKeys(values)) {
      if (key === 'length') continue;
      const field = Object.getOwnPropertyDescriptor(values, key)!;
      if (typeof key !== 'string' || !/^(0|[1-9][0-9]*)$/.test(key) || !field.enumerable || !Object.hasOwn(field, 'value')) throw new TypeError('home.returnOn requires ordinary indexed data');
    }
    const found = new Set<SidekickTerminalStatus>();
    for (let index = 0; index < values.length; index++) {
      const item = Object.getOwnPropertyDescriptor(values, String(index))?.value as SidekickTerminalStatus;
      if (!terminalStatuses.includes(item)) throw new TypeError('home.returnOn accepts success, error, or cancelled');
      found.add(item);
    }
    result.returnOn = terminalStatuses.filter(status => found.has(status));
  } else result.returnOn = [...defaultReturns];
  return copy(result, true);
}

/** A generation-guarded coordinator. It never owns the application's task outcome. */
export class LifecycleController {
  private declaration: { presence: SidekickPresence | null; task: SidekickTask | null; home: SidekickHome | null } = { presence: null, task: null, home: null };
  private revision = 0;
  private suspended = false;
  private disposed = false;
  private scheduled = false;
  private cancelling = false;
  private cleanupPending = false;
  private owned = false;
  private appliedVisibility?: boolean;
  private presencePending = false;
  private reactions = new Set<SidekickTerminalStatus>();
  private last: SidekickLifecycleState = { phase: 'idle', taskId: null, taskStatus: null };
  constructor(private readonly host: LifecycleHost) {}
  get presence(): SidekickPresence | null { return copy(this.declaration.presence); }
  get task(): SidekickTask | null { return copy(this.declaration.task); }
  get home(): SidekickHome | null { return copy(this.declaration.home); }
  get state(): SidekickLifecycleState { return { ...this.last }; }

  /** Validate the entire patch before changing any declaration or running operation. */
  update(value: SidekickLifecycleDeclaration): void {
    if (this.disposed) return;
    const input = ordinary(value, ['presence', 'task', 'home'], 'lifecycle');
    const previous = this.declaration, next = { ...previous };
    if (Object.hasOwn(input, 'presence')) next.presence = input.presence == null ? null : validateSidekickPresence(input.presence, this.host.document);
    if (Object.hasOwn(input, 'task')) next.task = input.task == null ? null : validateSidekickTask(input.task, this.host.document);
    if (Object.hasOwn(input, 'home')) next.home = input.home == null ? null : validateSidekickHome(input.home, this.host.document);
    if (same(previous, next)) return;
    this.declaration = next;
    if (previous.task?.id !== next.task?.id) this.reactions.clear();
    const sameTaskWork = previous.task?.id === next.task?.id && previous.task?.status === next.task?.status && (next.task?.status !== 'pending' || same(previous.task?.behavior, next.task.behavior));
    const sameVisibility = previous.presence?.visible === next.presence?.visible;
    // Destination/rest edits must not restart ongoing work or cut off its terminal reaction.
    if (!this.scheduled && !this.suspended && this.owned && sameVisibility) {
      if (next.presence?.visible === false) { this.publish(this.revision, 'hidden'); return; }
      if (sameTaskWork && (next.task?.status === 'pending' || this.last.phase === 'reacting')) return;
      if (sameTaskWork && same(previous.home, next.home)) return;
    }
    this.schedule('declaration-changed');
  }
  private schedule(reason: string): void {
    if (this.scheduled) return;
    // Invalidate async continuations immediately, but batch same-turn framework property writes.
    this.revision++; this.scheduled = true;
    queueMicrotask(() => {
      if (!this.scheduled || this.disposed) return;
      this.scheduled = false; this.restart(reason);
    });
  }
  /** Called once the renderer is ready, or to reassert declarations after a disconnect. */
  reconcile(): void {
    if (this.disposed) return;
    // A cancellation event can request new work. Let the current cleanup unwind first.
    if (this.cancelling) { this.schedule('reconciled'); return; }
    this.scheduled = false; this.restart('reconciled');
  }
  /** Imperative commands release ownership. Equivalent declarations do not take it back. */
  suspend(reason = 'manual-command'): void {
    if (this.disposed) { if (this.cancelling) this.revision++; return; }
    if (this.suspended && !this.cancelling || !this.owned && !this.scheduled && !this.cancelling) return;
    this.scheduled = false; this.suspended = true;
    const revision = ++this.revision, current = () => !this.disposed && this.revision === revision;
    const owned = this.owned || this.cleanupPending; this.owned = false; this.appliedVisibility = undefined; this.presencePending = false;
    if (owned) this.cancelOwned(reason, current);
    if (current()) this.publish(revision, 'suspended', reason);
  }
  /** Report target loss or another failure from a still-owned persistent host operation. */
  reportError(error: unknown): void {
    if (this.owned && !this.suspended && !this.scheduled && !this.disposed) this.fail(this.revision, error);
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true; this.scheduled = false;
    const revision = ++this.revision, owned = this.owned || this.cleanupPending;
    this.owned = false; this.presencePending = false;
    if (owned) this.cancelOwned('disposed', () => this.revision === revision);
  }
  private cancelOwned(reason: string, current: () => boolean): void {
    if (this.cancelling) return;
    this.cancelling = true; this.cleanupPending = true;
    try {
      this.host.cancel(reason, current);
      // A listener may hand ownership to another declaration midway through cleanup.
      // Preserve the obligation so the next run restores baseline before preparing itself.
      if (current()) this.cleanupPending = false;
    } finally { this.cancelling = false; }
  }
  private current(revision: number): boolean { return !this.disposed && !this.suspended && this.revision === revision; }
  private publish(revision: number, phase: SidekickLifecyclePhase, reason?: string): void {
    if (this.disposed || this.revision !== revision) return;
    const task = this.declaration.task;
    const next: SidekickLifecycleState = { phase, taskId: task?.id ?? null, taskStatus: task?.status ?? null, ...(reason ? { reason } : {}) };
    if (same(this.last, next)) return;
    this.last = next; this.host.change(this.state);
  }
  private restart(reason: string): void {
    this.suspended = false;
    const revision = ++this.revision, current = () => this.current(revision);
    const owned = this.owned || this.cleanupPending; this.owned = false;
    if (this.presencePending) this.appliedVisibility = undefined;
    this.presencePending = false;
    if (owned) this.cancelOwned(reason, current);
    if (!current()) return;
    if (!this.host.connected()) { this.publish(revision, 'suspended', 'disconnected'); return; }
    this.owned = !!(this.declaration.presence || this.declaration.task || this.declaration.home);
    void this.execute(revision).catch(error => this.fail(revision, error));
  }
  private fail(revision: number, error: unknown): void {
    if (!this.current(revision)) return;
    const phase = this.last.phase, message = error instanceof Error ? error.message : String(error);
    const nextRevision = ++this.revision, current = () => this.current(nextRevision);
    const owned = this.owned || this.cleanupPending; this.owned = false;
    if (this.presencePending) this.appliedVisibility = undefined;
    this.presencePending = false;
    if (owned) this.cancelOwned('error', current);
    if (!current()) return;
    this.publish(nextRevision, 'error', message);
    if (current()) this.host.error({ phase, taskId: this.declaration.task?.id ?? null, message });
  }
  private async execute(revision: number): Promise<void> {
    const current = () => this.current(revision);
    const { presence, task } = this.declaration;
    if (presence && presence.visible !== this.appliedVisibility) {
      this.publish(revision, presence.visible ? 'entering' : 'hidden');
      if (!current()) return;
      this.appliedVisibility = presence.visible; this.presencePending = true;
      await this.host.presence(copy(presence), current);
      if (!current()) return;
      this.presencePending = false;
    }
    if (presence?.visible === false) { this.publish(revision, 'hidden'); return; }
    if (task?.status === 'pending') {
      if (!task.behavior) { this.publish(revision, 'pending'); return; }
      this.publish(revision, 'working');
      if (!current()) return;
      const result = await this.host.perform(copy(task.behavior), current);
      if (!current()) return;
      if (result.status === 'error') throw new Error(result.reason ?? 'Task behavior failed');
      this.publish(revision, 'pending', result.status === 'cancelled' ? result.reason ?? 'Behavior interrupted' : undefined);
      return;
    }
    if (task && !this.reactions.has(task.status)) {
      const reaction = task.reaction ?? (task.status === 'success' ? { emotion: 'happy' as const, duration: 1000, intensity: 1 } : task.status === 'error' ? { emotion: 'sad' as const, duration: 1000, intensity: 1 } : undefined);
      if (reaction) {
        this.publish(revision, 'reacting');
        if (!current()) return;
        this.reactions.add(task.status);
        await this.host.reactTo(copy(reaction), current);
        if (!current()) return;
      } else this.reactions.add(task.status);
    }
    const home = this.declaration.home;
    if (!home || task && !home.returnOn?.includes(task.status)) { this.publish(revision, task ? 'settled' : 'idle'); return; }
    this.publish(revision, 'returning');
    if (!current()) return;
    const result = await this.host.position(copy(home.positioning), current);
    if (!current()) return;
    if (result && !result.finished) { this.publish(revision, 'settled', 'Home return interrupted'); return; }
    this.host.rest(copy(home.rest ?? null), current);
    if (current()) this.publish(revision, 'resting');
  }
}
