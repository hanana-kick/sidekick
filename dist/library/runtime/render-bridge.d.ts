import { createRenderWorker } from './create-worker.js';
import type { RuntimeCommand, RuntimeEvent, RuntimeSnapshot, RuntimeState } from './protocol.js';
import type { PixelBuffer } from '../core/pixels.js';
export interface BridgeCallbacks {
    ready(snapshot: RuntimeSnapshot, revision: number): void;
    event(event: RuntimeEvent, revision: number): void;
    failed(error: Error): void;
}
export interface RenderBridge {
    readonly backend: 'worker' | 'main';
    readonly generation: number;
    readonly revision: number;
    readonly transferred: boolean;
    start(state: RuntimeState): void;
    send(command: RuntimeCommand): void;
    capture?(): PixelBuffer;
    dispose(): void;
}
export declare class LocalRenderBridge implements RenderBridge {
    private canvas;
    readonly generation: number;
    private callbacks;
    readonly backend: "main";
    readonly transferred = false;
    revision: number;
    private engine?;
    private disposed;
    private queued;
    constructor(canvas: HTMLCanvasElement, generation: number, callbacks: BridgeCallbacks);
    start(state: RuntimeState): void;
    send(command: RuntimeCommand): void;
    capture(): PixelBuffer;
    dispose(): void;
}
export declare class WorkerRenderBridge implements RenderBridge {
    private canvas;
    readonly generation: number;
    private callbacks;
    readonly backend: "worker";
    revision: number;
    transferred: boolean;
    private worker;
    private disposed;
    private timeout?;
    constructor(canvas: HTMLCanvasElement, generation: number, callbacks: BridgeCallbacks, create?: typeof createRenderWorker);
    start(state: RuntimeState): void;
    send(command: RuntimeCommand): void;
    private post;
    private message;
    private error;
    private messageError;
    private fail;
    dispose(): void;
}
/** No probe may call getContext() on the HTML canvas before its one transfer. */
export declare function supportsRenderWorker(canvas: HTMLCanvasElement): boolean;
