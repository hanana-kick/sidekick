import type { Activity } from '../core/design.js';
import type { MoveResult } from './movement.js';
export type BehaviorTarget = Element | string;
export type BehaviorSide = 'left' | 'right' | 'above' | 'below';
interface TargetBehaviorOptions {
    side?: BehaviorSide;
    gap?: number;
    timeout?: number;
}
export type BotBehavior = ({
    type: 'wait' | 'follow' | 'guide';
    target: BehaviorTarget;
    duration?: number;
} & TargetBehaviorOptions) | ({
    type: 'review';
    targets: string | readonly Element[];
    dwell?: number;
} & TargetBehaviorOptions) | {
    type: 'idle' | 'celebrate' | 'error';
    duration?: number;
};
export type BehaviorPhase = 'idle' | 'resolving' | 'moving' | 'acting' | 'completed' | 'cancelled' | 'error';
export interface BehaviorState {
    readonly id: number;
    readonly type: BotBehavior['type'] | null;
    readonly status: BehaviorPhase;
    readonly itemIndex: number;
    readonly itemCount: number;
    readonly completedItems: number;
}
export interface BehaviorResult {
    readonly id: number;
    readonly type: BotBehavior['type'];
    readonly status: 'completed' | 'cancelled' | 'error';
    readonly reason?: string;
    readonly completedItems: number;
}
export interface PerformOptions {
    signal?: AbortSignal;
}
export interface BehaviorHost {
    document: Document;
    connected(): boolean;
    capture(): () => void;
    prepare(activity: Activity, expression: 'neutral' | 'smile' | 'blink', current: () => boolean): void;
    move(target: Element, side: BehaviorSide, gap: number): Promise<MoveResult>;
    watch(target: Element, lost: () => void): () => void;
    stop(): void;
    change(state: BehaviorState): void;
    end(result: BehaviorResult): void;
}
/** Copies ordinary data only. Validation never evaluates callbacks or changes the running behavior. */
export declare function validateBehavior(input: unknown, document: Document): BotBehavior;
export declare class BehaviorController {
    private host;
    private revision;
    private active?;
    private last;
    constructor(host: BehaviorHost);
    get state(): BehaviorState;
    get declaration(): BotBehavior | null;
    perform(input: BotBehavior, options?: PerformOptions): Promise<BehaviorResult>;
    cancel(reason?: string, increment?: boolean): void;
    private owns;
    private publish;
    private finish;
    private delay;
    private resolveTargets;
    private execute;
}
export {};
