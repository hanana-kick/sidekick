import type { Activity } from '../core/design.js';
import type { BodyOrientation, BodyOrientationPreset } from '../core/body-orientation.js';
import type { Emotion, EmotionResult } from '../core/emotion.js';
import type { TrackingMode } from '../core/tracking.js';
import type { BotBehavior, BehaviorResult } from './behavior.js';
import type { Entrance } from './entrance.js';
import type { Positioning } from './positioning.js';
import type { ExitOptions } from './presence.js';
import type { MoveResult } from './movement.js';
export interface SidekickPresence {
    visible: boolean;
    entrance?: Entrance;
    exit?: ExitOptions;
}
export type SidekickTaskStatus = 'pending' | 'success' | 'error' | 'cancelled';
export type SidekickTerminalStatus = Exclude<SidekickTaskStatus, 'pending'>;
export interface SidekickReaction {
    emotion: Emotion;
    duration?: number;
    intensity?: number;
}
/** The application owns status. Completion of a behavior never changes it. */
export interface SidekickTask {
    id: string | number;
    status: SidekickTaskStatus;
    behavior?: BotBehavior;
    reaction?: SidekickReaction;
}
export interface SidekickRest {
    activity?: Activity;
    trackingMode?: TrackingMode;
    gaze?: {
        x: number;
        y: number;
    } | {
        target: Element | string;
    };
    bodyOrientation?: BodyOrientationPreset | Partial<BodyOrientation>;
    emotion?: Emotion;
    emotionIntensity?: number;
    /** Rest behaviors cannot acquire an element target or take ownership of home positioning. */
    behavior?: Extract<BotBehavior, {
        type: 'idle' | 'celebrate' | 'error';
    }>;
}
export interface SidekickHome {
    positioning: Positioning;
    rest?: SidekickRest;
    returnOn?: readonly SidekickTerminalStatus[];
}
export interface SidekickLifecycleDeclaration {
    presence?: SidekickPresence | null;
    task?: SidekickTask | null;
    home?: SidekickHome | null;
}
export type SidekickLifecyclePhase = 'idle' | 'hidden' | 'entering' | 'working' | 'pending' | 'reacting' | 'returning' | 'resting' | 'settled' | 'suspended' | 'error';
export interface SidekickLifecycleState {
    readonly phase: SidekickLifecyclePhase;
    readonly taskId: string | number | null;
    readonly taskStatus: SidekickTaskStatus | null;
    readonly reason?: string;
}
export interface SidekickLifecycleError {
    phase: SidekickLifecyclePhase;
    taskId: string | number | null;
    message: string;
}
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
export declare function validateSidekickPresence(value: unknown, document: Document): SidekickPresence;
export declare function validateSidekickTask(value: unknown, document: Document): SidekickTask;
export declare function validateSidekickHome(value: unknown, document: Document): SidekickHome;
/** A generation-guarded coordinator. It never owns the application's task outcome. */
export declare class LifecycleController {
    private readonly host;
    private declaration;
    private revision;
    private suspended;
    private disposed;
    private scheduled;
    private cancelling;
    private cleanupPending;
    private owned;
    private appliedVisibility?;
    private presencePending;
    private reactions;
    private last;
    constructor(host: LifecycleHost);
    get presence(): SidekickPresence | null;
    get task(): SidekickTask | null;
    get home(): SidekickHome | null;
    get state(): SidekickLifecycleState;
    /** Validate the entire patch before changing any declaration or running operation. */
    update(value: SidekickLifecycleDeclaration): void;
    private schedule;
    /** Called once the renderer is ready, or to reassert declarations after a disconnect. */
    reconcile(): void;
    /** Imperative commands release ownership. Equivalent declarations do not take it back. */
    suspend(reason?: string): void;
    /** Report target loss or another failure from a still-owned persistent host operation. */
    reportError(error: unknown): void;
    dispose(): void;
    private cancelOwned;
    private current;
    private publish;
    private restart;
    private fail;
    private execute;
}
