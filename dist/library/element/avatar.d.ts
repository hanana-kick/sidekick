import type { PlayOptions, AssetTransitionTarget } from './playback.js';
import type { TravelPresentation } from '../core/travel.js';
import type { AvatarPlacement, AvatarPosition, MovementBounds, MoveResult, MoveOptions, MovementState } from './movement.js';
import type { AccessoryDesign, Activity, AvatarDesign, DesignPatch, RenderStyle } from '../core/design.js';
import type { TrackingMode } from '../core/tracking.js';
import type { ShapeMotionOptions, ShapeMotionResult } from '../core/shape-motion.js';
import type { MaterialShapeName } from '../core/shapes.js';
import type { EyeExpression, EyeShapeWeights } from '../core/expressions.js';
import type { CameraAngles, CameraState, CameraPreset } from '../core/camera.js';
import type { MotionOptions, MotionResult, MotionTarget, Pose } from '../core/motion.js';
import type { SnapshotOptions } from '../core/pixels.js';
import type { PixelBuffer } from '../core/pixels.js';
import type { SidekickEventMap } from './attributes.js';
declare const HTMLElementBase: typeof HTMLElement;
export declare class SidekickAvatar extends HTMLElementBase {
    static observedAttributes: ("shape" | "smile" | "blink" | "expression" | "accessories" | "design" | "motion" | "camera" | "activity" | "paused" | "interaction" | "time" | "placement" | "position-x" | "position-y" | "movement-bounds" | "move-duration" | "move-easing" | "move-travel" | "move-max-speed" | "move-acceleration" | "move-deceleration" | "body-color" | "eye-color" | "left-expression" | "right-expression" | "left-smile" | "right-smile" | "left-blink" | "right-blink" | "head-accessory" | "head-color" | "eyes-accessory" | "eyes-color" | "mouth-accessory" | "mouth-color" | "neck-accessory" | "neck-color" | "left-ear-accessory" | "left-ear-color" | "right-ear-accessory" | "right-ear-color" | "camera-yaw" | "camera-pitch" | "camera-roll" | "camera-zoom" | "gaze-x" | "gaze-y" | "mouse-tracking" | "tracking-mode" | "render-style" | "shape-duration" | "shape-easing" | "motion-duration" | "motion-easing")[];
    addEventListener<K extends keyof SidekickEventMap>(type: K, listener: (this: SidekickAvatar, event: SidekickEventMap[K]) => void, options?: boolean | AddEventListenerOptions): void;
    addEventListener<K extends keyof HTMLElementEventMap>(type: K, listener: (this: HTMLElement, event: HTMLElementEventMap[K]) => void, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions): void;
    removeEventListener<K extends keyof SidekickEventMap>(type: K, listener: (this: SidekickAvatar, event: SidekickEventMap[K]) => void, options?: boolean | EventListenerOptions): void;
    removeEventListener<K extends keyof HTMLElementEventMap>(type: K, listener: (this: HTMLElement, event: HTMLElementEventMap[K]) => void, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions): void;
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
    get placement(): AvatarPlacement;
    set placement(value: AvatarPlacement);
    get movementBounds(): MovementBounds;
    set movementBounds(value: MovementBounds);
    /** Inline: offset from normal layout. Viewport: layout viewport top-left, CSS pixels. */
    get position(): AvatarPosition;
    get movementState(): MovementState;
    moveTo(position: AvatarPosition, options?: MoveOptions): Promise<MoveResult>;
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
    private cameraAngles;
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
    /** Last acknowledged worker pose; configuration and camera getters are immediate. */
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
    /** Viewing angles in degrees and centered zoom. Reads return an independent snapshot. */
    get camera(): CameraState;
    set camera(value: CameraAngles & Partial<Pick<CameraState, 'zoom'>>);
    setCamera(angles: Partial<CameraState>): void;
    setCameraPreset(preset: CameraPreset): void;
    resetCamera(): void;
    /** Legacy radians API; yaw/pitch update the camera while preserving its roll. */
    setView(yaw: number, pitch?: number): void;
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
