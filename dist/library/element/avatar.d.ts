import type { AccessoryDesign, Activity, AvatarDesign, DesignPatch, RenderStyle } from '../core/design.js';
import type { ShapeMotionOptions, ShapeMotionResult } from '../core/shape-motion.js';
import type { MaterialShapeName } from '../core/shapes.js';
import type { EyeExpression, EyeShapeWeights } from '../core/expressions.js';
import type { CameraAngles, CameraPreset } from '../core/camera.js';
import type { MotionOptions, MotionResult, MotionTarget, Pose } from '../core/motion.js';
import type { SnapshotOptions } from '../core/pixels.js';
import type { SidekickEventMap } from './attributes.js';
declare const HTMLElementBase: typeof HTMLElement;
export declare class SidekickAvatar extends HTMLElementBase {
    static observedAttributes: ("shape" | "smile" | "blink" | "expression" | "accessories" | "design" | "motion" | "camera" | "activity" | "paused" | "interaction" | "time" | "body-color" | "eye-color" | "left-expression" | "right-expression" | "left-smile" | "right-smile" | "left-blink" | "right-blink" | "head-accessory" | "head-color" | "eyes-accessory" | "eyes-color" | "mouth-accessory" | "mouth-color" | "neck-accessory" | "neck-color" | "left-ear-accessory" | "left-ear-color" | "right-ear-accessory" | "right-ear-color" | "camera-yaw" | "camera-pitch" | "camera-roll" | "gaze-x" | "gaze-y" | "mouse-tracking" | "render-style" | "shape-duration" | "shape-easing" | "motion-duration" | "motion-easing")[];
    addEventListener<K extends keyof SidekickEventMap>(type: K, listener: (this: SidekickAvatar, event: SidekickEventMap[K]) => void, options?: boolean | AddEventListenerOptions): void;
    addEventListener<K extends keyof HTMLElementEventMap>(type: K, listener: (this: HTMLElement, event: HTMLElementEventMap[K]) => void, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions): void;
    removeEventListener<K extends keyof SidekickEventMap>(type: K, listener: (this: SidekickAvatar, event: SidekickEventMap[K]) => void, options?: boolean | EventListenerOptions): void;
    removeEventListener<K extends keyof HTMLElementEventMap>(type: K, listener: (this: HTMLElement, event: HTMLElementEventMap[K]) => void, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions): void;
    private configuration;
    private timeline;
    private shapeTimeline;
    private renderer?;
    private canvas?;
    private fallback?;
    private sizeObserver?;
    private visibilityObserver?;
    private media?;
    private visible;
    private reduced;
    private raf;
    private lastTick;
    private elapsed;
    private frames;
    private readyState;
    private currentActivity;
    private cameraAngles;
    private gazeTarget;
    private manualGaze;
    private pausedState;
    private interactionState;
    private mouseTrackingState;
    private trackingDocument?;
    private acceptedAttributes;
    private pendingAttributes;
    private attributesQueued;
    private propertiesUpgraded;
    private gazeVelocity;
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
    get mouseTracking(): boolean;
    set mouseTracking(value: boolean);
    get interaction(): 'none' | 'box';
    set interaction(value: 'none' | 'box');
    get ready(): boolean;
    get pose(): Pose;
    get diagnostics(): {
        ready: boolean;
        running: boolean;
        frames: number;
        drawCalls: number;
        buffers: number;
    };
    /** Camera viewing angles in degrees. Reads return an independent snapshot. */
    get camera(): CameraAngles;
    set camera(value: CameraAngles);
    setCamera(angles: Partial<CameraAngles>): void;
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
    /** Stable readback for exports/tests without permanently preserving the WebGL buffer. */
    capturePixels(): {
        width: number;
        height: number;
        pixels: Uint8Array;
    };
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
    private updateInteraction;
    private resize;
    private emit;
    private gazeMoving;
    private resetShape;
    private resetEyes;
    private needsAnimation;
    private wake;
    private stop;
    private tick;
    private draw;
    private onMotionPreference;
    private onVisibility;
    private setGazeTarget;
    private updateMouseTracking;
    private detachMouseTracking;
    private onTrackingBlur;
    private onTrackedPointerMove;
    private clearDrag;
    private onKey;
    private onPointerDown;
    private onPointerMove;
    private onPointerUp;
    private onPointerCancel;
    private onContextLost;
    private onContextRestored;
}
export declare function defineSidekick(tagName?: string): void;
declare global {
    interface HTMLElementTagNameMap {
        'sidekick-avatar': SidekickAvatar;
    }
}
export {};
