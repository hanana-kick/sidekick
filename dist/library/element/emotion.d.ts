import type { Emotion, EmotionOptions, EmotionResult, EmotionState, ReactionOptions } from '../core/emotion.js';
interface EmotionHost {
    connected(): boolean;
    change(state: EmotionState): void;
    end(result: EmotionResult): void;
    schedule(callback: () => void, milliseconds: number): unknown;
    clear(timer: unknown): void;
}
/** A separate layer: never captures or restores activity, gaze, design or behavior. */
export declare class EmotionController {
    private host;
    private baseline;
    private reaction?;
    constructor(host: EmotionHost);
    get state(): EmotionState;
    set(emotion: Emotion, options?: EmotionOptions): void;
    react(emotion: Emotion, options?: ReactionOptions): Promise<EmotionResult>;
    cancel(reason?: 'cancelled' | 'disconnected'): void;
    private takeReaction;
    private finish;
}
export {};
