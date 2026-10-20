import type { Mat4 } from '../core/math.js';
import type { Geometry } from './geometry.js';
import type { SoftwareEyes } from './software-rasterizer.js';
export interface Mesh {
    count: number;
    data: Geometry;
}
export interface RendererOptions {
    renderer?: 'auto' | 'canvas2d';
}
/** The acquired WebGL canvas cannot be rebound to 2D; its owner must replace it. */
export declare class RendererInitializationError extends Error {
    constructor(cause: unknown);
}
export interface RenderBackend {
    readonly kind: 'webgl2' | 'canvas2d';
    readonly gl?: WebGL2RenderingContext;
    readonly maxDimension: number;
    readonly lost: boolean;
    upload(data: Geometry): Mesh;
    update(mesh: Mesh, data: Geometry, indices: boolean, reuseVertices: boolean): void;
    deleteMesh(mesh: Mesh): void;
    begin(projection: Mat4): void;
    eyes(eyes?: SoftwareEyes): void;
    opacity(value: number): void;
    draw(mesh: Mesh, model: Mat4, color: string, count: number, indexOffset: number): void;
    end(): void;
    readPixels(): Uint8Array;
    dispose(): void;
    initializationError(cause: unknown): Error;
}
export declare function createBackend(canvas: HTMLCanvasElement | OffscreenCanvas, options: RendererOptions): RenderBackend;
