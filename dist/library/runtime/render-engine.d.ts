import type { PixelBuffer, SnapshotOptions } from '../core/pixels.js';
import type { RenderState } from '../renderer/webgl.js';
import type { AvatarDesign } from '../core/design.js';
import type { RuntimeCommand, RuntimeEvent, RuntimeSnapshot, RuntimeState } from './protocol.js';
export interface RuntimeRenderer {
    readonly canvas: HTMLCanvasElement | OffscreenCanvas;
    readonly stats: {
        drawCalls: number;
        buffers: number;
    };
    resize(width: number, height: number, dpr: number): void;
    render(design: AvatarDesign, state: RenderState): void;
    readPixels(): Uint8Array;
    dispose(): void;
}
export interface FrameScheduler {
    request(callback: (now: number) => void): number;
    cancel(id: number): void;
}
export declare function frameScheduler(scope?: typeof globalThis): FrameScheduler;
/** All animated state and geometry live here, on the dedicated worker by default. */
export declare class RenderEngine {
    private readonly emit;
    private readonly scheduler;
    private state;
    private timeline;
    private shape;
    private tracking;
    private velocity;
    private scheduled;
    private lastTick;
    private idleDrawElapsed;
    private rendererDelta;
    private dirty;
    private disposed;
    private frames;
    private revision;
    private batchDepth;
    private renderCpu;
    private renderedRotation;
    private readonly contextLost;
    readonly renderer: RuntimeRenderer;
    constructor(canvas: HTMLCanvasElement | OffscreenCanvas, initial: RuntimeState, emit: (event: RuntimeEvent, revision?: number) => void, scheduler?: FrameScheduler, renderer?: RuntimeRenderer);
    get snapshot(): RuntimeSnapshot;
    private notify;
    private complete;
    command(command: RuntimeCommand, revision?: number): void;
    capture(): PixelBuffer;
    private updateTracking;
    private gazeMoving;
    private animated;
    private paceIdle;
    private resetPacing;
    private wake;
    private stop;
    private tick;
    private tickFrame;
    private render;
    dispose(): void;
}
/** GPU bytes are bottom-up; flip after cropping so PNGs retain their orientation. */
export declare function encodeSnapshot(image: PixelBuffer, options: SnapshotOptions, source: HTMLCanvasElement | OffscreenCanvas): Promise<Blob>;
