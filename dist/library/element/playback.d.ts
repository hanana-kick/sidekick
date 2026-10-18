import type { AccessoryDesign, Activity, AvatarDesign, DesignPatch } from '../core/design.js';
import type { EyeExpression } from '../core/expressions.js';
import type { MotionOptions, MotionResult } from '../core/motion.js';
import type { MaterialShapeName } from '../core/shapes.js';
export interface PlayOptions {
    duration?: number;
}
export interface AssetTransitionTarget {
    shape?: MaterialShapeName;
    expression?: EyeExpression;
    /** Complete equipment selection, with one validated accessory per slot. */
    accessories?: readonly AccessoryDesign[];
}
export interface AssetMotionChannels {
    shape: boolean;
    expression: boolean;
}
/** Callbacks keep this controller importable without DOM globals or a renderer. */
export interface PlaybackHost {
    setActivity(activity: Activity): void;
    setShape(shape: MaterialShapeName, options: MotionOptions): Promise<MotionResult>;
    setExpression(side: 'both', expression: EyeExpression, options: MotionOptions): Promise<MotionResult>;
    updateDesign(patch: DesignPatch): Promise<void>;
    getDesign(): AvatarDesign;
    onPlaybackEnd?(result: MotionResult): void;
    onTransitionEnd?(result: MotionResult): void;
    getCanvas(): HTMLCanvasElement | undefined;
    immediateMotion(): boolean;
    isConnected(): boolean;
    cancelAssetMotion(channels: AssetMotionChannels): void;
}
/** Activity playback and coordinated asset changes, independent of worker frame timing. */
export declare class PlaybackController {
    private readonly host;
    private playing?;
    private transition?;
    constructor(host: PlaybackHost);
    play(activity: Activity, options?: PlayOptions): Promise<MotionResult>;
    /** Cancel playback and return to idle, including when setActivity started the loop. */
    stop(): void;
    /** Called before an external setActivity takes ownership of the activity. */
    cancelPlayback(): void;
    private finishPlayback;
    transitionTo(target: AssetTransitionTarget, options?: MotionOptions): Promise<MotionResult>;
    private runTransition;
    private swapAccessories;
    private fade;
    cancelTransition(): void;
    private clearAnimation;
    /** Paused/reduced motion snaps fades; renderer policy snaps shape/eye motion.
     * Playback intervals remain wall-clock intervals, even while visually paused.
     */
    policyChanged(): void;
    disconnect(): void;
}
