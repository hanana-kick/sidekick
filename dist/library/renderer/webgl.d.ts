import type { TravelPresentation } from '../core/travel.js';
import type { Activity, AvatarDesign, RenderStyle, Vec2 } from '../core/design.js';
import type { ActivityFrame, Pose } from '../core/motion.js';
import type { CameraAngles, CameraState } from '../core/camera.js';
import type { ShapeProfile } from '../core/shape-profiles.js';
import type { ShapeContour } from '../core/contours.js';
export interface RenderState {
    pose: Pose;
    activity: Activity;
    time: number;
    delta: number;
    reduced: boolean;
    style: RenderStyle;
    /** Optional runtime activity crossfade; direct renderer clients keep the standard loop. */
    activityFrame?: ActivityFrame;
    travel?: TravelPresentation;
    camera?: CameraAngles & Partial<Pick<CameraState, 'zoom'>>;
    /** Active explicit eye tracks postpone a newly starting idle blink per eye. */
    eyeMotion?: Record<'left' | 'right', boolean>;
    /** Legacy viewing rotations in radians. Prefer camera's explicit degree values. */
    view?: Vec2;
    contour?: ShapeContour;
    profile?: ShapeProfile;
}
/** Dependency-free WebGL2 backend. No DOM outside the supplied canvas is owned here. */
export declare class AvatarRenderer {
    readonly canvas: HTMLCanvasElement | OffscreenCanvas;
    readonly gl: WebGL2RenderingContext;
    private program;
    private uniforms;
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
    private disposed;
    private drawCount;
    private blinkGate;
    private framingKey;
    private frameSpan;
    private displayAspect?;
    private inputSignature;
    private resolvedInput?;
    constructor(canvas: HTMLCanvasElement | OffscreenCanvas);
    private upload;
    resize(width: number, height: number, dpr?: number): void;
    private draw;
    render(input: AvatarDesign, state: RenderState): void;
    get stats(): {
        drawCalls: number;
        buffers: number;
    };
    /** Call immediately after render; the drawing buffer need not be preserved between frames. */
    readPixels(): Uint8Array;
    private deleteMesh;
    dispose(): void;
}
