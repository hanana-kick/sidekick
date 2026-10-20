import type { Mat4 } from '../core/math.js';
import type { Geometry } from './geometry.js';
/** The same body-local eye uniforms used by the WebGL fragment shader. */
export interface SoftwareEyes {
    color: readonly number[];
    centers: readonly number[];
    size: readonly number[];
    states: readonly number[];
    leftTargets: readonly number[];
    rightTargets: readonly number[];
    faceScale: readonly number[];
}
/** Port of the analytic glyph SDF; does not approximate expressions with paths. */
export declare function softwareEyeDistance(x: number, y: number, openness: number, smile: number, size: readonly number[], targets: readonly number[]): number;
/** Orthographic, depth-tested CPU triangle backend. Canvas2D only presents its pixels.
 * Geometry, face chart, culling, depth writes and premultiplied blending agree with
 * the GPU backend. GPU multisample coverage and derivative quads are not emulated.
 */
export declare class SoftwareRasterizer {
    width: number;
    height: number;
    pixels: Uint8ClampedArray<ArrayBuffer>;
    private depth;
    private rgba;
    private projected;
    clear(width: number, height: number): void;
    draw(geometry: Geometry, model: Mat4, projection: Mat4, hex: string, count?: number, indexOffset?: number, opacity?: number, eyes?: SoftwareEyes): void;
    dispose(): void;
    /** WebGL readPixels convention: bottom-up rows and premultiplied RGBA. */
    readPixels(): Uint8Array;
}
