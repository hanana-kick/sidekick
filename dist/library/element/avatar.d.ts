import type { SidekickPresence, SidekickTask, SidekickHome, SidekickLifecycleState } from './lifecycle.js';
import type { Positioning } from './positioning.js';
import type { Emotion, EmotionOptions, EmotionState, EmotionResult, ReactionOptions } from '../core/emotion.js';
import type { BotBehavior, BehaviorState, BehaviorResult, PerformOptions } from './behavior.js';
import type { ElementAnchorState } from './element-anchor.js';
import type { MoveToElementOptions } from './element-target.js';
import type { Entrance } from './entrance.js';
import type { EnterOptions, ExitOptions, PresenceResult, PresenceState } from './presence.js';
import type { PlayOptions, AssetTransitionTarget } from './playback.js';
import type { TravelPresentation } from '../core/travel.js';
import type { AvatarPlacement, AvatarPosition, MovementBounds, MoveResult, MoveOptions, MovementState } from './movement.js';
import type { AccessoryDesign, Activity, AvatarDesign, DesignPatch, RenderStyle } from '../core/design.js';
import type { TrackingMode } from '../core/tracking.js';
import type { ShapeMotionOptions, ShapeMotionResult } from '../core/shape-motion.js';
import type { MaterialShapeName } from '../core/shapes.js';
import type { EyeExpression, EyeShapeWeights } from '../core/expressions.js';
import type { BodyOrientation, BodyOrientationPreset } from '../core/body-orientation.js';
import type { MotionOptions, MotionResult, MotionTarget, Pose } from '../core/motion.js';
import type { SnapshotOptions } from '../core/pixels.js';
import type { PixelBuffer } from '../core/pixels.js';
import type { SidekickEventMap } from './attributes.js';
declare const HTMLElementBase: typeof HTMLElement;
export declare class SidekickAvatar extends HTMLElementBase {
    static observedAttributes: string[];
    addEventListener<K extends keyof SidekickEventMap>(type: K, listener: (this: SidekickAvatar, event: SidekickEventMap[K]) => void, options?: boolean | AddEventListenerOptions): void;
    addEventListener<K extends keyof HTMLElementEventMap>(type: K, listener: (this: HTMLElement, event: HTMLElementEventMap[K]) => void, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions): void;
    removeEventListener<K extends keyof SidekickEventMap>(type: K, listener: (this: SidekickAvatar, event: SidekickEventMap[K]) => void, options?: boolean | EventListenerOptions): void;
    removeEventListener<K extends keyof HTMLElementEventMap>(type: K, listener: (this: HTMLElement, event: HTMLElementEventMap[K]) => void, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions): void;
    private emotionEyeOverrides;
    private setEyeControl;
    private emotionController;
    /** Persistent feeling. Transient reactions are available in emotionState. */
    get emotion(): Emotion;
    set emotion(value: Emotion);
    get emotionIntensity(): number;
    set emotionIntensity(value: number);
    get emotionState(): EmotionState;
    setEmotion(value: Emotion, options?: EmotionOptions): void;
    reactTo(value: Emotion, options?: ReactionOptions): Promise<EmotionResult>;
    cancelReaction(): void;
    private lifecycleCommand;
    private lifecycleRest;
    private lifecycleCancelling;
    private lifecycleGazeCleanup?;
    private lifecycleRestore?;
    private lifecyclePositionPromise?;
    private lifecyclePositionCurrent?;
    private lifecycleEntrancePromise?;
    private lifecycleController;
    get presence(): SidekickPresence | null;
    set presence(value: SidekickPresence | null);
    get task(): SidekickTask | null;
    set task(value: SidekickTask | null);
    get home(): SidekickHome | null;
    set home(value: SidekickHome | null);
    get lifecycleState(): SidekickLifecycleState;
    private lifecycleOperation;
    private interruptLifecycle;
    private applyLifecycleRest;
    private behaviorCommand;
    private behaviorAttention;
    private pendingBehavior;
    private desiredBehavior;
    private behaviorController;
    /** A deterministic semantic intent; null stops it. DOM targets are retained by identity. */
    get behavior(): BotBehavior | null;
    set behavior(value: BotBehavior | null);
    get behaviorState(): BehaviorState;
    perform(value: BotBehavior, options?: PerformOptions): Promise<BehaviorResult>;
    stopBehavior(): void;
    private interruptBehavior;
    private behaviorOperation;
    private behaviorPlacement;
    private watchBehaviorTarget;
    private playbackCommand;
    private playback;
    private ownPlaybackCommand;
    play(activity: Activity, options?: PlayOptions): Promise<MotionResult>;
    stop(): void;
    transitionTo(target: AssetTransitionTarget, options?: MotionOptions): Promise<MotionResult>;
    cancelTransition(): void;
    private placementState;
    private boundsState;
    private movementBox?;
    private measureMovementBox;
    private travelPresentation?;
    private movement;
    private anchorRevision;
    private anchorState;
    private anchorCleanup?;
    private anchorSleeping;
    /** Logical binding only: no reparenting, CSS positioning, or canvas changes. */
    get elementAnchor(): ElementAnchorState | null;
    detachAnchor(): void;
    private releaseAnchor;
    private attachAnchor;
    private positioningTarget;
    private positioningRevision;
    private positioningDeclaration;
    get positioning(): Positioning | null;
    set positioning(value: Positioning | null);
    private clearPositioning;
    private resolvePositioningDeclaration;
    private discardInvalidPositioning;
    private positioningDestination;
    private startPositioning;
    private positioningFailed;
    private entranceDeclaration;
    private entranceApplied;
    private entranceRevision;
    private entranceCleanup?;
    private refreshEntranceClip?;
    get entrance(): Entrance | null;
    set entrance(value: Entrance | null);
    private resumeEntranceBehavior;
    private clearEntrance;
    private startEntrance;
    private presenceHidden;
    private presenceController;
    get presenceState(): PresenceState;
    enter(position: AvatarPosition, options?: EnterOptions): Promise<PresenceResult>;
    exit(options?: ExitOptions): Promise<PresenceResult>;
    get placement(): AvatarPlacement;
    set placement(value: AvatarPlacement);
    get movementBounds(): MovementBounds;
    set movementBounds(value: MovementBounds);
    /** Inline: offset from normal layout. Viewport: layout viewport top-left, CSS pixels. */
    get position(): AvatarPosition;
    get movementState(): MovementState;
    moveTo(position: AvatarPosition, options?: MoveOptions): Promise<MoveResult>;
    /** Sample the target's viewport border-box and align matching anchors, then move with inertia. */
    moveToElement(target: Element, options?: MoveToElementOptions): Promise<MoveResult>;
    moveBy(delta: AvatarPosition, options?: MoveOptions): Promise<MoveResult>;
    cancelMove(): void;
    private constrainPosition;
    private updatePlacement;
    private onViewportResize;
    private configuration;
    private validator;
    private currentPose;
    private bridge?;
    private generation;
    private acknowledgedRevision;
    private poseRevision;
    private timeRevision;
    private snapshotState?;
    private nextRequest;
    private commandBatch?;
    private requests;
    private inputFrame;
    private pendingResize;
    private lastTrackedPointer?;
    private pendingPointer?;
    private pendingDrag?;
    private pendingZoom?;
    private pointers;
    private pinch?;
    private pendingPinchDistance?;
    private wheelTimer?;
    private wheelGesture;
    private connected;
    private transferred;
    private captureCanvas?;
    private canvas?;
    private fallback?;
    private sizeObserver?;
    private visibilityObserver?;
    private media?;
    private visible;
    private reduced;
    private elapsed;
    private readyState;
    private currentActivity;
    private orientationState;
    private zoomState;
    private gazeTarget;
    private manualGaze;
    private pausedState;
    private interactionState;
    private trackingModeState;
    private trackedGaze?;
    private trackingDocument?;
    private acceptedAttributes;
    private pendingAttributes;
    private attributesQueued;
    private propertiesUpgraded;
    private drag?;
    readonly motion: {
        to: (target: MotionTarget, options?: MotionOptions) => Promise<MotionResult>;
        cancel: () => void;
    };
    get design(): AvatarDesign;
    set design(value: AvatarDesign);
    setDesign(value: AvatarDesign | string): Promise<void>;
    /** Apply selections/colors or expression weights without disturbing unrelated animation. */
    updateDesign(patch: DesignPatch): Promise<void>;
    /** Replace only the selected equipment slot, preserving unrelated animation clocks. */
    equipAccessory(accessory: AccessoryDesign): Promise<void>;
    /** Remove one instance by ID; the opposite earring and its motion remain independent. */
    removeAccessory(id: string): Promise<void>;
    private applyDesign;
    /** Persist a shape target now, while moving directly from the currently visible outline. */
    setShape(shape: MaterialShapeName, options?: ShapeMotionOptions): Promise<ShapeMotionResult>;
    /** Persist partial shape-key weights and transition from the currently displayed pose. */
    setEyeWeights(side: 'left' | 'right' | 'both', weights: Partial<EyeShapeWeights>, options?: MotionOptions): Promise<MotionResult>;
    /** Named expressions are convenient exact weight presets, never separate state. */
    setExpression(side: 'left' | 'right' | 'both', expression: EyeExpression, options?: MotionOptions): Promise<MotionResult>;
    get renderStyle(): RenderStyle;
    set renderStyle(value: RenderStyle);
    get activity(): Activity;
    setActivity(value: Activity): void;
    get paused(): boolean;
    set paused(value: boolean);
    /** Legacy enabled flag. An explicit tracking-mode always takes precedence. */
    get mouseTracking(): boolean;
    set mouseTracking(value: boolean);
    get trackingMode(): TrackingMode;
    set trackingMode(value: TrackingMode);
    /** Clear transient cursor reaction immediately, for explicit scene resets/imports. */
    resetTracking(): void;
    get interaction(): 'none' | 'box';
    set interaction(value: 'none' | 'box');
    get ready(): boolean;
    /** Last acknowledged worker pose; configuration and body orientation getters are immediate. */
    get pose(): Pose;
    get diagnostics(): {
        travel?: TravelPresentation;
        ready: boolean;
        running: boolean;
        frames: number;
        drawCalls: number;
        buffers: number;
        backend: 'worker' | 'main' | 'none';
        generation: number;
        revision: number;
        acknowledgedRevision: number;
        time: number;
        renderCpu: {
            lastMs: number;
            totalMs: number;
            maxMs: number;
        };
        renderedRotation: Pose['rotation'];
    };
    /** Body-facing angles in degrees. Reads return an independent snapshot. */
    get bodyOrientation(): BodyOrientation;
    set bodyOrientation(value: BodyOrientation);
    setBodyOrientation(angles: Partial<BodyOrientation>): void;
    setBodyOrientationPreset(preset: BodyOrientationPreset): void;
    resetBodyOrientation(): void;
    get zoom(): number;
    set zoom(value: number);
    lookAt(target: {
        space: 'view';
        x: number;
        y: number;
    }): void;
    seek(seconds: number): void;
    /**
     * Worker mode reads the latest browser-presented bitmap without flushing commands.
     * Use capturePixelsAsync() when fresh ordered GPU output is required. Rows are bottom-up.
     */
    capturePixels(): PixelBuffer;
    /** Render and read a fresh frame after every preceding command and pending input. */
    capturePixelsAsync(): Promise<PixelBuffer>;
    snapshot(options?: SnapshotOptions): Promise<Blob>;
    connectedCallback(): void;
    disconnectedCallback(): void;
    attributeChangedCallback(name: string, old: string | null, value: string | null): void;
    /** Imperative setters commit independently of an unrelated rejected HTML batch. */
    private reflectAttribute;
    /** A synchronous group of DOM writes is one validated transaction. */
    private flushAttributes;
    private upgradeProperties;
    private immediateMotion;
    private initializeRenderer;
    private startupFrame;
    private startupDeadline?;
    private cancelStartupPresentation;
    private presentInitialFrame;
    private runtimeFailure;
    private acceptSnapshot;
    private disposeBridge;
    private request;
    private resolveRequest;
    private send;
    private batch;
    private runtimeState;
    private syncState;
    private attachCanvasListeners;
    private detachCanvasListeners;
    private replaceCanvas;
    private updateInteraction;
    private resize;
    private queueInput;
    private cancelInput;
    private flushInput;
    private emit;
    private resetEyes;
    private onMotionPreference;
    private onVisibility;
    private setGazeTarget;
    private updateMouseTracking;
    private detachMouseTracking;
    private updateTrackingBody;
    private restoreManualTracking;
    private onTrackingBlur;
    private onTrackingLeave;
    private onTrackingOut;
    private onTrackedPointerMove;
    private get gesturing();
    private clearDrag;
    /** Rebase at each pointer-count transition, after flushing the previous gesture. */
    private rebasePointers;
    private onKey;
    private onWheel;
    private onPointerDown;
    private onPointerMove;
    private onPointerUp;
    private onPointerCancel;
    private onLostPointerCapture;
    private onContextRestored;
}
export declare function defineSidekick(tagName?: string): void;
declare global {
    interface HTMLElementTagNameMap {
        'sidekick-avatar': SidekickAvatar;
    }
}
export {};
