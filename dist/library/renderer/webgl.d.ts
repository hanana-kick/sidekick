import type { PartAnimationSample } from '../core/part-animation.js';
import type { ShapeWeights } from '../core/shape-motion.js';
import type { PluginAccessoryInstance } from '../element/plugin-equipment.js';
import type { TravelPresentation } from '../core/travel.js';
import type { Activity, AvatarDesign, RenderStyle } from '../core/design.js';
import type { ActivityFrame, Pose } from '../core/motion.js';
import type { BodyOrientation } from '../core/body-orientation.js';
import type { ShapeProfile } from '../core/shape-profiles.js';
import type { ShapeContour } from '../core/contours.js';
import type { RendererOptions } from './render-backend.js';
export interface RenderState {
    partAnimation?: PartAnimationSample;
    pluginAccessories?: readonly PluginAccessoryInstance[];
    pose: Pose;
    activity: Activity;
    time: number;
    delta: number;
    reduced: boolean;
    style: RenderStyle;
    /** Optional runtime activity crossfade; direct renderer clients keep the standard loop. */
    activityFrame?: ActivityFrame;
    /** Snap presentation while paused; authored state remains immediate either way. */
    instant?: boolean;
    /** Existing whole-canvas transitions already hide the equipment swap. */
    equipmentImmediate?: boolean;
    travel?: TravelPresentation;
    bodyOrientation?: Partial<BodyOrientation>;
    zoom?: number;
    /** Active explicit eye tracks postpone a newly starting idle blink per eye. */
    eyeMotion?: Record<'left' | 'right', boolean>;
    contour?: ShapeContour;
    profile?: ShapeProfile;
    shapeWeights?: ShapeWeights;
}
/** Shared geometry and animation, presented through WebGL2 or Canvas2D. */
export declare class AvatarRenderer {
    readonly canvas: HTMLCanvasElement | OffscreenCanvas;
    private backend;
    private pluginMeshes;
    get gl(): WebGL2RenderingContext | undefined;
    get graphics(): 'webgl2' | 'canvas2d';
    private meshes;
    private beretContour?;
    private beretKey;
    private beretBandIndexCount;
    private glassesContour?;
    private glassesKey;
    private catalogMeshes;
    private bodyDirections;
    private bodyContour?;
    private bodyDeformation;
    private lag;
    private accessoryPose;
    private authoredAccessoryPose;
    private accessoryPoseTakeover;
    private disposed;
    private drawCount;
    private blinkGate;
    private equipment;
    private displayAspect?;
    private inputSignature;
    private resolvedInput?;
    constructor(canvas: HTMLCanvasElement | OffscreenCanvas, options?: RendererOptions);
    private upload;
    resize(width: number, height: number, dpr?: number): void;
    private draw;
    render(input: AvatarDesign, state: RenderState): void;
    get animating(): boolean;
    get stats(): {
        drawCalls: number;
        buffers: number;
    };
    /** Call immediately after render; the drawing buffer need not be preserved between frames. */
    readPixels(): Uint8Array;
    private deleteMesh;
    dispose(): void;
}
