import type { PixelBuffer } from '../core/pixels.js';
/** Startup-only proof that the worker bitmap reached its HTML placeholder. */
export interface PresentationSignature {
    width: number;
    height: number;
    alpha: number;
    color: number;
}
export declare function presentationSignature(image: PixelBuffer, bottomUp?: boolean): PresentationSignature;
export declare function matchesPresentation(a: PresentationSignature, b: PresentationSignature): boolean;
